import { db } from "../db";
import { partners, partnerCommissionRules, partnerCommissionLedger, partnerWallets, platformConfig, fintekproCaRegistry } from "@shared/schema";
import { eq, and, sql, isNull, lte, gte, desc } from "drizzle-orm";
import { logger } from "../logger";

export class CommissionWaterfallEngine {
  private static instance: CommissionWaterfallEngine;

  static getInstance(): CommissionWaterfallEngine {
    if (!this.instance) {
      this.instance = new CommissionWaterfallEngine();
    }
    return this.instance;
  }

  // GAP 1 FIX: Dynamic waterfall — handles any chain depth, not just 3 levels
  async processCommission(data: {
    transactionId: string;
    orderId?: string;
    productType: string;
    transactionAmount: number;
    sellingPartnerId: string;
  }): Promise<{ success: boolean; ledgerEntries?: any[]; error?: string }> {
    // ── CA Marketplace Special Handling ─────────────────────────────────────
    if (data.productType === 'ca_consultation') {
      return this.processCaMarketplaceCommission(data);
    }

    const [rule] = await db.select().from(partnerCommissionRules)
      .where(and(
        eq(partnerCommissionRules.productType, data.productType),
        eq(partnerCommissionRules.isActive, true),
      ))
      .limit(1);

    if (!rule) {
      return { success: false, error: `No commission rule found for product type: ${data.productType}` };
    }

    const partnerChain = await this.resolvePartnerChain(data.sellingPartnerId);
    if (partnerChain.length === 0) {
      return { success: false, error: "Could not resolve partner chain" };
    }

    const totalCommission = data.transactionAmount;
    const ledgerEntries: any[] = [];

    const agentPct = parseFloat(rule.agentPct?.toString() || '0');
    const subPartnerPct = parseFloat(rule.subPartnerPct?.toString() || '0');
    const masterPartnerPct = parseFloat(rule.masterPartnerPct?.toString() || '0');
    const platformPct = parseFloat(rule.platformPct?.toString() || '0');

    // GAP 1 FIX: Dynamic level-to-percentage mapping based on chain position
    // chain[0] = seller (bottom of chain), chain[last] = root master (top of chain)
    // Intermediate levels share subPartnerPct equally
    const chainLength = partnerChain.length;
    const intermediateCount = Math.max(chainLength - 2, 0); // levels between seller and root
    const intermediatePctEach = intermediateCount > 0 ? subPartnerPct / intermediateCount : 0;

    let totalAllocated = 0;

    for (let i = 0; i < chainLength; i++) {
      const partner = partnerChain[i];
      let pct: number;
      let waterfallLevel: string;

      if (i === 0) {
        // Seller / frontline agent
        pct = agentPct;
        waterfallLevel = `L${chainLength}`;
      } else if (i === chainLength - 1) {
        // Root master partner at top of chain
        pct = masterPartnerPct;
        waterfallLevel = 'L1';
      } else {
        // Intermediate levels — split subPartnerPct equally
        pct = intermediatePctEach;
        waterfallLevel = `L${chainLength - i}`;
      }

      if (pct <= 0) continue;

      const commissionAmount = (totalCommission * pct) / 100;
      totalAllocated += pct;

      const kycGated = partner.kyc_status !== 'VERIFIED' && partner.kycStatus !== 'VERIFIED';

      const [entry] = await db.insert(partnerCommissionLedger).values({
        partnerId: partner.id,
        transactionId: data.transactionId,
        orderId: data.orderId || null,
        productType: data.productType,
        transactionAmount: data.transactionAmount.toString(),
        commissionAmount: commissionAmount.toFixed(2),
        commissionRuleId: rule.id,
        waterfallLevel,
        status: kycGated ? 'PENDING' : 'ELIGIBLE',
        kycGated,
        metadata: {
          pctApplied: pct,
          ruleId: rule.id,
          chainPosition: i,
          chainLength,
          dynamicAllocation: true,
        },
      }).returning();

      ledgerEntries.push(entry);

      if (!kycGated) {
        await this.creditWallet(partner.id, commissionAmount);
      }
    }

    // Any unallocated rolls to platform (handles missing levels gracefully)
    const unallocated = 100 - totalAllocated - platformPct;
    const platformAmount = (totalCommission * (platformPct + Math.max(unallocated, 0))) / 100;

    if (platformAmount > 0) {
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
        metadata: { pctApplied: platformPct + Math.max(unallocated, 0), rollupFromMissingLevels: unallocated > 0 },
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

  // Credit wallet
  async creditWallet(partnerId: string, amount: number): Promise<void> {
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

  // CRUD for commission rules
  async createCommissionRule(data: {
    productType: string;
    agentPct: number;
    subPartnerPct: number;
    masterPartnerPct: number;
    platformPct: number;
    createdBy?: string;
  }): Promise<{ success: boolean; rule?: any; error?: string }> {
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

  /**
   * Special Waterfall for CA Marketplace
   * [1] Platform Fee (dynamic from config)
   * [2] Referral Bonus (dynamic from config)
   * [3] CA Payout (Remainder)
   */
  private async processCaMarketplaceCommission(data: {
    transactionId: string;
    orderId?: string;
    productType: string;
    transactionAmount: number;
    sellingPartnerId: string;
  }): Promise<{ success: boolean; ledgerEntries?: any[]; error?: string }> {
    try {
      // 1. Fetch dynamic config
      let [config] = await db.select().from(platformConfig).limit(1);
      if (!config) {
        // Fallback to defaults if no config row exists yet
        config = {
          caPlatformFeePct: "10.00",
          caReferralBonusPct: "5.00",
        } as any;
      }

      const platformPct = parseFloat(config!.caPlatformFeePct?.toString() || '10.00');
      const referralPct = parseFloat(config!.caReferralBonusPct?.toString() || '5.00');

      // 2. Resolve the CA and their referring partner
      const [caRegistry] = await db.select()
        .from(fintekproCaRegistry)
        .where(eq(fintekproCaRegistry.partnersTableId, data.sellingPartnerId))
        .limit(1);

      const referrerCode = caRegistry?.referredByCode;
      let referrerPartnerId: string | null = null;

      if (referrerCode) {
        const [referrer] = await db.select({ id: fintekproCaRegistry.partnersTableId })
          .from(fintekproCaRegistry)
          .where(eq(fintekproCaRegistry.referralCode, referrerCode))
          .limit(1);
        referrerPartnerId = referrer?.id || null;
      }

      const ledgerEntries: any[] = [];
      const totalAmount = data.transactionAmount;

      // 3. Platform Payout
      const platformAmount = (totalAmount * platformPct) / 100;
      const [platformEntry] = await db.insert(partnerCommissionLedger).values({
        partnerId: 'PLATFORM',
        transactionId: data.transactionId,
        orderId: data.orderId || null,
        productType: 'ca_consultation',
        transactionAmount: totalAmount.toString(),
        commissionAmount: platformAmount.toFixed(2),
        waterfallLevel: 'PLATFORM',
        status: 'ELIGIBLE',
        metadata: { pctApplied: platformPct, type: 'marketplace_fee' },
      }).returning();
      ledgerEntries.push(platformEntry);

      // 4. Referrer Payout (if exists)
      let allocatedToReferrer = 0;
      if (referrerPartnerId && referralPct > 0) {
        allocatedToReferrer = (totalAmount * referralPct) / 100;
        const [referrerEntry] = await db.insert(partnerCommissionLedger).values({
          partnerId: referrerPartnerId,
          transactionId: data.transactionId,
          orderId: data.orderId || null,
          productType: 'ca_consultation',
          transactionAmount: totalAmount.toString(),
          commissionAmount: allocatedToReferrer.toFixed(2),
          waterfallLevel: 'REFERRAL',
          status: 'ELIGIBLE',
          metadata: { pctApplied: referralPct, type: 'referral_bonus' },
        }).returning();
        ledgerEntries.push(referrerEntry);
        await this.creditWallet(referrerPartnerId, allocatedToReferrer);
      }

      // 5. CA Payout (Remainder)
      const caPayoutPct = 100 - platformPct - (referrerPartnerId ? referralPct : 0);
      const caPayoutAmount = (totalAmount * caPayoutPct) / 100;
      
      const [caEntry] = await db.insert(partnerCommissionLedger).values({
        partnerId: data.sellingPartnerId,
        transactionId: data.transactionId,
        orderId: data.orderId || null,
        productType: 'ca_consultation',
        transactionAmount: totalAmount.toString(),
        commissionAmount: caPayoutAmount.toFixed(2),
        waterfallLevel: 'L1',
        status: 'ELIGIBLE',
        metadata: { pctApplied: caPayoutPct, type: 'ca_payout' },
      }).returning();
      ledgerEntries.push(caEntry);
      
      await this.creditWallet(data.sellingPartnerId, caPayoutAmount);

      logger.info('[Commission] CA Marketplace transaction processed', {
        transactionId: data.transactionId,
        platformAmount,
        caPayoutAmount,
        referrerAmount: allocatedToReferrer
      });

      return { success: true, ledgerEntries };
    } catch (err: any) {
      logger.error('[Commission] CA Marketplace processing failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }
}

export const commissionWaterfallEngine = CommissionWaterfallEngine.getInstance();
