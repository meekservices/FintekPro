import { db } from "../db";
import { partners, partnerCommissionRules, partnerCommissionLedger, partnerWallets } from "@shared/schema";
import { eq, and, sql, isNull, lte, gte, desc } from "drizzle-orm";

export class CommissionWaterfallEngine {
  private static instance: CommissionWaterfallEngine;

  static getInstance(): CommissionWaterfallEngine {
    if (!this.instance) {
      this.instance = new CommissionWaterfallEngine();
    }
    return this.instance;
  }

  // TICKET 5: Resolve the partner tree at transaction time and apply waterfall
  async processCommission(data: {
    transactionId: string;
    orderId?: string;
    productType: string;
    transactionAmount: number;
    sellingPartnerId: string;
  }): Promise<{ success: boolean; ledgerEntries?: any[]; error?: string }> {
    // 1. Get the commission rule for this product type
    const [rule] = await db.select().from(partnerCommissionRules)
      .where(and(
        eq(partnerCommissionRules.productType, data.productType),
        eq(partnerCommissionRules.isActive, true),
      ))
      .limit(1);

    if (!rule) {
      return { success: false, error: `No commission rule found for product type: ${data.productType}` };
    }

    // 2. Resolve the partner tree from the selling partner up to root
    const partnerChain = await this.resolvePartnerChain(data.sellingPartnerId);
    if (partnerChain.length === 0) {
      return { success: false, error: "Could not resolve partner chain" };
    }

    // 3. Calculate commission amounts based on waterfall percentages
    const totalCommission = data.transactionAmount; // Commission base (could be derived from transaction)
    const ledgerEntries: any[] = [];

    // Map partner levels to commission percentages
    const levelPctMap: Record<string, number> = {
      'L3': parseFloat(rule.agentPct?.toString() || '0'),       // Agent level
      'L2': parseFloat(rule.subPartnerPct?.toString() || '0'),   // Sub-partner level
      'L1': parseFloat(rule.masterPartnerPct?.toString() || '0'), // Master partner level
    };

    let totalAllocated = 0;
    const platformPct = parseFloat(rule.platformPct?.toString() || '0');

    for (const partner of partnerChain) {
      const level = partner.partner_level || partner.partnerLevel || 'L1';
      const pct = levelPctMap[level] || 0;
      
      if (pct <= 0) continue;

      const commissionAmount = (totalCommission * pct) / 100;
      totalAllocated += pct;

      // Check KYC status - if not verified, mark as gated
      const kycGated = partner.kyc_status !== 'VERIFIED' && partner.kycStatus !== 'VERIFIED';

      const [entry] = await db.insert(partnerCommissionLedger).values({
        partnerId: partner.id,
        transactionId: data.transactionId,
        orderId: data.orderId || null,
        productType: data.productType,
        transactionAmount: data.transactionAmount.toString(),
        commissionAmount: commissionAmount.toFixed(2),
        commissionRuleId: rule.id,
        waterfallLevel: level,
        status: kycGated ? 'PENDING' : 'ELIGIBLE',
        kycGated,
        metadata: {
          pctApplied: pct,
          ruleId: rule.id,
          chainPosition: partnerChain.indexOf(partner),
        },
      }).returning();

      ledgerEntries.push(entry);

      // Credit wallet if eligible (KYC verified)
      if (!kycGated) {
        await this.creditWallet(partner.id, commissionAmount);
      }
    }

    // Any unallocated percentage (missing levels) rolls up to platform
    const unallocated = 100 - totalAllocated - platformPct;
    if (unallocated > 0) {
      // Platform absorbs the unallocated commission - log it
      const platformAmount = (totalCommission * (platformPct + unallocated)) / 100;
      const [platformEntry] = await db.insert(partnerCommissionLedger).values({
        partnerId: 'PLATFORM',
        transactionId: data.transactionId,
        orderId: data.orderId || null,
        productType: data.productType,
        transactionAmount: data.transactionAmount.toString(),
        commissionAmount: platformAmount.toFixed(2),
        commissionRuleId: rule.id,
        waterfallLevel: 'PLATFORM',
        status: 'ELIGIBLE',
        kycGated: false,
        metadata: { pctApplied: platformPct + unallocated, rollupFromMissingLevels: true },
      }).returning();
      ledgerEntries.push(platformEntry);
    }

    return { success: true, ledgerEntries };
  }

  // Resolve the partner chain from selling partner up to root
  async resolvePartnerChain(partnerId: string): Promise<any[]> {
    const result = await db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT id, company_name, partner_level, hierarchy_partner_type,
               parent_partner_id, kyc_status, hierarchy_status, 0 as depth
        FROM partners WHERE id = ${partnerId}
        UNION ALL
        SELECT p.id, p.company_name, p.partner_level, p.hierarchy_partner_type,
               p.parent_partner_id, p.kyc_status, p.hierarchy_status, c.depth + 1
        FROM partners p
        INNER JOIN chain c ON c.parent_partner_id = p.id
        WHERE c.depth < 10
      )
      SELECT * FROM chain ORDER BY depth ASC
    `);
    const rows = (result as any).rows || result;
    return rows || [];
  }

  // TICKET 6: Credit wallet
  async creditWallet(partnerId: string, amount: number): Promise<void> {
    // Upsert wallet
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

  // Debit wallet (for payouts)
  async debitWallet(partnerId: string, amount: number): Promise<{ success: boolean; error?: string }> {
    const [wallet] = await db.select().from(partnerWallets)
      .where(eq(partnerWallets.partnerId, partnerId)).limit(1);

    if (!wallet) return { success: false, error: "Wallet not found" };
    
    const currentBalance = parseFloat(wallet.balance?.toString() || '0');
    if (currentBalance < amount) return { success: false, error: "Insufficient balance" };

    await db.update(partnerWallets).set({
      balance: sql`${partnerWallets.balance} - ${amount.toFixed(2)}::decimal`,
      totalDebited: sql`${partnerWallets.totalDebited} + ${amount.toFixed(2)}::decimal`,
      lastTransactionAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(partnerWallets.partnerId, partnerId));

    return { success: true };
  }

  // Get wallet balance
  async getWallet(partnerId: string): Promise<any> {
    const [wallet] = await db.select().from(partnerWallets)
      .where(eq(partnerWallets.partnerId, partnerId)).limit(1);
    return wallet || { partnerId, balance: "0.00", totalCredited: "0.00", totalDebited: "0.00" };
  }

  // Get ledger entries for a partner
  async getLedgerEntries(partnerId: string, limit: number = 50): Promise<any[]> {
    return db.select().from(partnerCommissionLedger)
      .where(eq(partnerCommissionLedger.partnerId, partnerId))
      .orderBy(desc(partnerCommissionLedger.createdAt))
      .limit(limit);
  }

  // TICKET 5: CRUD for commission rules
  async createCommissionRule(data: {
    productType: string;
    agentPct: number;
    subPartnerPct: number;
    masterPartnerPct: number;
    platformPct: number;
    createdBy?: string;
  }): Promise<{ success: boolean; rule?: any; error?: string }> {
    // Validate percentages sum to 100
    const total = data.agentPct + data.subPartnerPct + data.masterPartnerPct + data.platformPct;
    if (Math.abs(total - 100) > 0.01) {
      return { success: false, error: `Commission percentages must sum to 100%. Current sum: ${total}%` };
    }

    const [rule] = await db.insert(partnerCommissionRules).values({
      productType: data.productType,
      agentPct: data.agentPct.toFixed(2),
      subPartnerPct: data.subPartnerPct.toFixed(2),
      masterPartnerPct: data.masterPartnerPct.toFixed(2),
      platformPct: data.platformPct.toFixed(2),
      isActive: true,
      effectiveFrom: new Date(),
      createdBy: data.createdBy || null,
    }).returning();

    return { success: true, rule };
  }

  // Get all commission rules
  async getCommissionRules(): Promise<any[]> {
    return db.select().from(partnerCommissionRules)
      .where(eq(partnerCommissionRules.isActive, true))
      .orderBy(partnerCommissionRules.productType);
  }

  // Update commission rule
  async updateCommissionRule(ruleId: string, data: Partial<{
    agentPct: number;
    subPartnerPct: number;
    masterPartnerPct: number;
    platformPct: number;
  }>): Promise<{ success: boolean; error?: string }> {
    const [existing] = await db.select().from(partnerCommissionRules)
      .where(eq(partnerCommissionRules.id, ruleId)).limit(1);
    if (!existing) return { success: false, error: "Rule not found" };

    const agentPct = data.agentPct ?? parseFloat(existing.agentPct?.toString() || '0');
    const subPartnerPct = data.subPartnerPct ?? parseFloat(existing.subPartnerPct?.toString() || '0');
    const masterPartnerPct = data.masterPartnerPct ?? parseFloat(existing.masterPartnerPct?.toString() || '0');
    const platformPct = data.platformPct ?? parseFloat(existing.platformPct?.toString() || '0');

    const total = agentPct + subPartnerPct + masterPartnerPct + platformPct;
    if (Math.abs(total - 100) > 0.01) {
      return { success: false, error: `Commission percentages must sum to 100%. Current sum: ${total}%` };
    }

    await db.update(partnerCommissionRules).set({
      agentPct: agentPct.toFixed(2),
      subPartnerPct: subPartnerPct.toFixed(2),
      masterPartnerPct: masterPartnerPct.toFixed(2),
      platformPct: platformPct.toFixed(2),
      updatedAt: new Date(),
    }).where(eq(partnerCommissionRules.id, ruleId));

    return { success: true };
  }

  // TICKET 9: Anti-MLM validation - ensure no commission on partner onboarding
  validateAntiMLM(transactionType: string): { valid: boolean; error?: string } {
    const forbiddenTypes = ['partner_onboarding', 'partner_registration', 'joining_fee', 'recruitment'];
    if (forbiddenTypes.includes(transactionType.toLowerCase())) {
      return { valid: false, error: "Commission on partner onboarding/recruitment is not allowed (Anti-MLM)" };
    }
    return { valid: true };
  }
}

export const commissionWaterfallEngine = CommissionWaterfallEngine.getInstance();
