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
    const existing = await db.select().from(commissionExecution)
      .where(eq(commissionExecution.transactionId, data.transactionId))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: "Transaction already processed (idempotency guard)" };
    }

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
    const ledgerEntries: any[] = [];

    const agentAmount = this.round2(total * (agentPct / 100));
    const agentEntry = await this.credit(data.transactionId, data.sellerPartnerId, agentAmount, 'AGENT', 0);
    ledgerEntries.push(agentEntry);

    const platformAmount = this.round2(total * (platformPct / 100));
    const platformEntry = await this.credit(data.transactionId, PLATFORM_ACCOUNT, platformAmount, 'PLATFORM', null);
    ledgerEntries.push(platformEntry);

    let remaining = this.round2(total - agentAmount - platformAmount);

    let level = 1;
    let currentPartnerId = await this.getParentId(data.sellerPartnerId);
    const visitedIds = new Set<string>();

    while (currentPartnerId && remaining >= minResidualThreshold && level <= MAX_UPLINE_LEVELS) {
      if (visitedIds.has(currentPartnerId)) {
        await this.logAudit("SYSTEM", "CIRCULAR_REFERENCE_DETECTED", "commission", data.transactionId, {
          circularPartnerId: currentPartnerId,
          level,
        });
        break;
      }
      visitedIds.add(currentPartnerId);

      const eligible = await this.isEligible(currentPartnerId);
      if (!eligible) {
        currentPartnerId = await this.getParentId(currentPartnerId);
        level++;
        continue;
      }

      const incentive = this.round2(remaining * (uplineIncentivePct / 100));
      if (incentive <= 0) break;

      const uplineEntry = await this.credit(data.transactionId, currentPartnerId, incentive, 'UPLINE', level);
      ledgerEntries.push(uplineEntry);

      await this.creditWallet(currentPartnerId, incentive);

      remaining = this.round2(remaining - incentive);
      currentPartnerId = await this.getParentId(currentPartnerId);
      level++;
    }

    if (remaining > 0) {
      const opsEntry = await this.credit(data.transactionId, null, remaining, 'OPERATIONS', null);
      ledgerEntries.push(opsEntry);
    }

    const sellerPartner = await this.getPartner(data.sellerPartnerId);
    if (sellerPartner && sellerPartner.kycStatus === 'VERIFIED' && sellerPartner.hierarchyStatus === 'ACTIVE') {
      await this.creditWallet(data.sellerPartnerId, agentAmount);
    }

    await db.insert(commissionExecution).values({
      transactionId: data.transactionId,
    });

    await this.logAudit("SYSTEM", "COMMISSION_PROCESSED", "commission", data.transactionId, {
      grossCommission: total,
      productType: data.productType,
      sellerPartnerId: data.sellerPartnerId,
      entriesCount: ledgerEntries.length,
      agentAmount,
      platformAmount,
      operationalResidual: remaining > 0 ? remaining : 0,
    });

    return { success: true, ledgerEntries };
  }

  private async credit(
    transactionId: string,
    partnerId: string | null,
    amount: number,
    role: string,
    levelOffset: number | null,
  ): Promise<any> {
    const [entry] = await db.insert(progressiveCommissionLedger).values({
      transactionId,
      partnerId,
      role,
      levelOffset,
      amount: amount.toFixed(2),
    }).returning();

    await this.logAudit("SYSTEM", "COMMISSION_CREDITED", "ledger", entry.ledgerId, {
      transactionId,
      partnerId: partnerId || OPERATIONAL_ACCOUNT,
      role,
      levelOffset,
      amount: amount.toFixed(2),
    });

    return entry;
  }

  private async isEligible(partnerId: string): Promise<boolean> {
    const partner = await this.getPartner(partnerId);
    if (!partner) return false;
    if (partner.hierarchyStatus !== 'ACTIVE' && partner.isActive !== true) return false;
    if (partner.kycStatus !== 'VERIFIED') return false;
    return true;
  }

  private async getParentId(partnerId: string): Promise<string | null> {
    const partner = await this.getPartner(partnerId);
    return partner?.parentPartnerId || null;
  }

  private async getPartner(partnerId: string): Promise<any> {
    const [partner] = await db.select().from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);
    return partner || null;
  }

  private async creditWallet(partnerId: string, amount: number): Promise<void> {
    const existing = await db.select().from(partnerWallets)
      .where(eq(partnerWallets.partnerId, partnerId)).limit(1);

    if (existing.length === 0) {
      await db.insert(partnerWallets).values({
        partnerId,
        balance: amount.toFixed(2),
        totalCredited: amount.toFixed(2),
        totalDebited: "0.00",
        lastTransactionAt: new Date(),
      });
    } else {
      await db.update(partnerWallets).set({
        balance: sql`${partnerWallets.balance} + ${amount.toFixed(2)}::decimal`,
        totalCredited: sql`${partnerWallets.totalCredited} + ${amount.toFixed(2)}::decimal`,
        lastTransactionAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(partnerWallets.partnerId, partnerId));
    }
  }

  private async logAudit(actorId: string, action: string, entityType: string, entityId: string, metadata: any): Promise<void> {
    await db.insert(partnerAuditLogs).values({
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    });
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
