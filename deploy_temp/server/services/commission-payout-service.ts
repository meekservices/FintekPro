import { db } from "../db";
import { partners, partnerWallets, commissionConfig, progressiveCommissionLedger, commissionExecution, partnerAuditLogs } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const PLATFORM_ACCOUNT = "PLATFORM_ACCOUNT";
const OPERATIONAL_ACCOUNT = "OPERATIONAL_ACCOUNT";
const MAX_UPLINE_LEVELS = 50;

export class CommissionPayoutService {
  private static instance: CommissionPayoutService;

  static getInstance(): CommissionPayoutService {
    if (!this.instance) {
      this.instance = new CommissionPayoutService();
    }
    return this.instance;
  }

  async processTransaction(data: {
    transactionId: string;
    grossCommission: number;
    productType: string;
    sellerPartnerId: string;
  }): Promise<{ success: boolean; ledgerEntries?: any[]; error?: string }> {
    const antiMLM = this.validateAntiMLM(data.productType);
    if (!antiMLM.valid) {
      return { success: false, error: antiMLM.error };
    }

    const [config] = await db.select().from(commissionConfig)
      .where(and(
        eq(commissionConfig.productType, data.productType),
        eq(commissionConfig.isActive, true),
      ))
      .limit(1);

    if (!config) {
      return { success: false, error: `No active commission config for product type: ${data.productType}` };
    }

    const agentPct = parseFloat(config.agentPct?.toString() || '0');
    const platformPct = parseFloat(config.platformPct?.toString() || '0');

    if (agentPct + platformPct >= 100) {
      return { success: false, error: "agent_pct + platform_pct must be < 100" };
    }

    const total = data.grossCommission;
    const uplineIncentivePct = parseFloat(config.uplineIncentivePct?.toString() || '0');
    const minResidualThreshold = parseFloat(config.minResidualThreshold?.toString() || '0');

    try {
      const result = await db.transaction(async (tx) => {
        try {
          await tx.insert(commissionExecution).values({
            transactionId: data.transactionId,
          });
        } catch (e: any) {
          if (e.code === '23505') {
            throw new Error("IDEMPOTENCY_DUPLICATE");
          }
          throw e;
        }

        const partnerChainResult = await tx.execute(sql`
          WITH RECURSIVE chain AS (
            SELECT id, company_name, partner_level, hierarchy_partner_type,
                   parent_partner_id, kyc_status, hierarchy_status, is_active, 0 as depth
            FROM partners WHERE id = ${data.sellerPartnerId}
            UNION ALL
            SELECT p.id, p.company_name, p.partner_level, p.hierarchy_partner_type,
                   p.parent_partner_id, p.kyc_status, p.hierarchy_status, p.is_active, c.depth + 1
            FROM partners p
            INNER JOIN chain c ON c.parent_partner_id = p.id
            WHERE c.depth < ${MAX_UPLINE_LEVELS}
          )
          SELECT * FROM chain ORDER BY depth ASC
        `);
        const allPartners = (partnerChainResult as any).rows || partnerChainResult || [];
        const sellerPartner = allPartners.length > 0 ? allPartners[0] : null;
        const partnerChain = allPartners.filter((p: any) => p.depth > 0);

        const ledgerEntries: any[] = [];

        const agentAmount = this.round2(total * (agentPct / 100));
        const [agentEntry] = await tx.insert(progressiveCommissionLedger).values({
          transactionId: data.transactionId,
          partnerId: data.sellerPartnerId,
          role: 'AGENT',
          levelOffset: 0,
          amount: agentAmount.toFixed(2),
        }).returning();
        ledgerEntries.push(agentEntry);

        const platformAmount = this.round2(total * (platformPct / 100));
        const [platformEntry] = await tx.insert(progressiveCommissionLedger).values({
          transactionId: data.transactionId,
          partnerId: PLATFORM_ACCOUNT,
          role: 'PLATFORM',
          levelOffset: null,
          amount: platformAmount.toFixed(2),
        }).returning();
        ledgerEntries.push(platformEntry);

        let remaining = this.round2(total - agentAmount - platformAmount);

        let level = 1;
        const visitedIds = new Set<string>();

        for (const upline of partnerChain) {
          if (remaining < minResidualThreshold || level > MAX_UPLINE_LEVELS) break;

          if (visitedIds.has(upline.id)) {
            await tx.insert(partnerAuditLogs).values({
              actorId: "SYSTEM",
              action: "CIRCULAR_REFERENCE_DETECTED",
              entityType: "commission",
              entityId: data.transactionId,
              metadata: { circularPartnerId: upline.id, level },
            });
            break;
          }
          visitedIds.add(upline.id);

          const eligible = this.checkEligibility(upline);
          if (!eligible) {
            level++;
            continue;
          }

          const incentive = this.round2(remaining * (uplineIncentivePct / 100));
          if (incentive <= 0) break;

          const [uplineEntry] = await tx.insert(progressiveCommissionLedger).values({
            transactionId: data.transactionId,
            partnerId: upline.id,
            role: 'UPLINE',
            levelOffset: level,
            amount: incentive.toFixed(2),
          }).returning();
          ledgerEntries.push(uplineEntry);

          await this.creditWalletTx(tx, upline.id, incentive);

          remaining = this.round2(remaining - incentive);
          level++;
        }

        if (remaining > 0) {
          const [opsEntry] = await tx.insert(progressiveCommissionLedger).values({
            transactionId: data.transactionId,
            partnerId: null,
            role: 'OPERATIONS',
            levelOffset: null,
            amount: remaining.toFixed(2),
          }).returning();
          ledgerEntries.push(opsEntry);
        }

        if (sellerPartner &&
            (sellerPartner.kyc_status === 'VERIFIED' || sellerPartner.kycStatus === 'VERIFIED') &&
            (sellerPartner.hierarchy_status === 'ACTIVE' || sellerPartner.hierarchyStatus === 'ACTIVE' ||
             sellerPartner.is_active === true || sellerPartner.isActive === true)) {
          await this.creditWalletTx(tx, data.sellerPartnerId, agentAmount);
        }

        await tx.insert(partnerAuditLogs).values({
          actorId: "SYSTEM",
          action: "COMMISSION_PROCESSED",
          entityType: "commission",
          entityId: data.transactionId,
          metadata: {
            grossCommission: total,
            productType: data.productType,
            sellerPartnerId: data.sellerPartnerId,
            entriesCount: ledgerEntries.length,
            agentAmount,
            platformAmount,
            operationalResidual: remaining > 0 ? remaining : 0,
          },
        });

        return ledgerEntries;
      });

      return { success: true, ledgerEntries: result };
    } catch (e: any) {
      if (e.message === "IDEMPOTENCY_DUPLICATE") {
        return { success: false, error: "Transaction already processed (idempotency guard)" };
      }
      throw e;
    }
  }

  private checkEligibility(partner: any): boolean {
    if (!partner) return false;
    const isActive = partner.hierarchy_status === 'ACTIVE' || partner.hierarchyStatus === 'ACTIVE' ||
                     partner.is_active === true || partner.isActive === true;
    if (!isActive) return false;
    const kycVerified = partner.kyc_status === 'VERIFIED' || partner.kycStatus === 'VERIFIED';
    if (!kycVerified) return false;
    return true;
  }

  private async creditWalletTx(tx: any, partnerId: string, amount: number): Promise<void> {
    const existing = await tx.select().from(partnerWallets)
      .where(eq(partnerWallets.partnerId, partnerId)).limit(1);

    if (existing.length === 0) {
      await tx.insert(partnerWallets).values({
        partnerId,
        balance: amount.toFixed(2),
        totalCredited: amount.toFixed(2),
        totalDebited: "0.00",
        lastTransactionAt: new Date(),
      });
    } else {
      await tx.update(partnerWallets).set({
        balance: sql`${partnerWallets.balance} + ${amount.toFixed(2)}::decimal`,
        totalCredited: sql`${partnerWallets.totalCredited} + ${amount.toFixed(2)}::decimal`,
        lastTransactionAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(partnerWallets.partnerId, partnerId));
    }
  }

  private validateAntiMLM(transactionType: string): { valid: boolean; error?: string } {
    const forbidden = ['partner_onboarding', 'partner_registration', 'joining_fee', 'recruitment'];
    if (forbidden.includes(transactionType.toLowerCase())) {
      return { valid: false, error: "Commission on partner onboarding/recruitment is not allowed (Anti-MLM)" };
    }
    return { valid: true };
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  async createConfig(data: {
    productType: string;
    agentPct: number;
    platformPct: number;
    uplineIncentivePct: number;
    minResidualThreshold?: number;
  }): Promise<{ success: boolean; config?: any; error?: string }> {
    if (data.agentPct + data.platformPct >= 100) {
      return { success: false, error: "agent_pct + platform_pct must be less than 100" };
    }

    const existingActive = await db.select().from(commissionConfig)
      .where(and(
        eq(commissionConfig.productType, data.productType),
        eq(commissionConfig.isActive, true),
      ))
      .limit(1);

    if (existingActive.length > 0) {
      await db.update(commissionConfig).set({ isActive: false })
        .where(eq(commissionConfig.configId, existingActive[0].configId));
    }

    const [config] = await db.insert(commissionConfig).values({
      productType: data.productType,
      agentPct: data.agentPct.toFixed(2),
      platformPct: data.platformPct.toFixed(2),
      uplineIncentivePct: data.uplineIncentivePct.toFixed(2),
      minResidualThreshold: (data.minResidualThreshold ?? 1.0).toFixed(2),
      isActive: true,
    }).returning();

    return { success: true, config };
  }

  async getConfigs(): Promise<any[]> {
    return db.select().from(commissionConfig)
      .where(eq(commissionConfig.isActive, true))
      .orderBy(commissionConfig.productType);
  }

  async getConfigByProduct(productType: string): Promise<any> {
    const [config] = await db.select().from(commissionConfig)
      .where(and(
        eq(commissionConfig.productType, productType),
        eq(commissionConfig.isActive, true),
      ))
      .limit(1);
    return config || null;
  }

  async getLedgerByTransaction(transactionId: string): Promise<any[]> {
    return db.select().from(progressiveCommissionLedger)
      .where(eq(progressiveCommissionLedger.transactionId, transactionId))
      .orderBy(progressiveCommissionLedger.createdAt);
  }

  async getLedgerByPartner(partnerId: string, limit: number = 50): Promise<any[]> {
    return db.select().from(progressiveCommissionLedger)
      .where(eq(progressiveCommissionLedger.partnerId, partnerId))
      .orderBy(desc(progressiveCommissionLedger.createdAt))
      .limit(limit);
  }
}

export const commissionPayoutService = CommissionPayoutService.getInstance();
