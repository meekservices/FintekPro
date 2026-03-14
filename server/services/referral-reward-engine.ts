/**
 * GAP 2 FIX: Referral Reward Engine
 * Triggers SEBI/AMFI-compliant one-time fixed rewards when:
 *   1. A referred user completes KYC (kyc_complete event)
 *   2. A referred user makes their first investment (first_investment event)
 *
 * Anti-MLM: rewards are flat one-time credits, NOT recurring commissions.
 * commissionWaterfallEngine.validateAntiMLM() still blocks any recruitment commissions.
 */

import { db } from "../db";
import { userReferrals, partnerWallets } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

const DEFAULT_KYC_REWARD = 100;        // ₹100 flat on KYC completion
const DEFAULT_FIRST_INVESTMENT_REWARD = 250; // ₹250 flat on first investment

export class ReferralRewardEngine {
  private static instance: ReferralRewardEngine;

  static getInstance(): ReferralRewardEngine {
    if (!this.instance) {
      this.instance = new ReferralRewardEngine();
    }
    return this.instance;
  }

  /**
   * Called after a referred user completes KYC.
   * Marks the referral as kyc_complete and credits the referrer a flat reward.
   */
  async processKycComplete(refereeId: string): Promise<{ credited: boolean; amount?: number; error?: string }> {
    try {
      const [referral] = await db.select().from(userReferrals)
        .where(and(
          eq(userReferrals.refereeId, refereeId),
          eq(userReferrals.status, 'registered'),
        ))
        .limit(1);

      if (!referral) return { credited: false };

      const rewardAmount = parseFloat(referral.referrerRewardAmount?.toString() || '0') || DEFAULT_KYC_REWARD;

      await db.update(userReferrals).set({
        status: 'kyc_complete',
        kycCompletedAt: new Date(),
        referrerRewardAmount: rewardAmount.toFixed(2),
      }).where(eq(userReferrals.id, referral.id));

      await this.creditReferrerWallet(referral.referrerId, rewardAmount, 'kyc_complete', referral.id);

      console.log(`[ReferralReward] KYC reward ₹${rewardAmount} credited to referrer ${referral.referrerId} for referee ${refereeId}`);
      return { credited: true, amount: rewardAmount };
    } catch (error) {
      console.error("[ReferralReward] processKycComplete error:", error);
      return { credited: false, error: String(error) };
    }
  }

  /**
   * Called after a referred user makes their first investment.
   * Marks the referral as rewarded and credits the referrer an additional reward.
   */
  async processFirstInvestment(refereeId: string): Promise<{ credited: boolean; amount?: number; error?: string }> {
    try {
      const [referral] = await db.select().from(userReferrals)
        .where(and(
          eq(userReferrals.refereeId, refereeId),
          eq(userReferrals.status, 'kyc_complete'),
        ))
        .limit(1);

      if (!referral) return { credited: false };

      const rewardAmount = parseFloat(referral.refereeRewardAmount?.toString() || '0') || DEFAULT_FIRST_INVESTMENT_REWARD;

      await db.update(userReferrals).set({
        status: 'rewarded',
        firstInvestmentAt: new Date(),
        referrerRewardPaidAt: new Date(),
        refereeRewardAmount: rewardAmount.toFixed(2),
      }).where(eq(userReferrals.id, referral.id));

      await this.creditReferrerWallet(referral.referrerId, rewardAmount, 'first_investment', referral.id);

      console.log(`[ReferralReward] First-investment reward ₹${rewardAmount} credited to referrer ${referral.referrerId}`);
      return { credited: true, amount: rewardAmount };
    } catch (error) {
      console.error("[ReferralReward] processFirstInvestment error:", error);
      return { credited: false, error: String(error) };
    }
  }

  /**
   * Credit the referrer's partner wallet.
   * Uses the partnerWallets table (same wallet used by the commission engine).
   */
  private async creditReferrerWallet(referrerId: string, amount: number, event: string, referralId: string): Promise<void> {
    try {
      const existing = await db.select().from(partnerWallets)
        .where(eq(partnerWallets.partnerId, referrerId)).limit(1);

      if (existing.length === 0) {
        await db.insert(partnerWallets).values({
          partnerId: referrerId,
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
        }).where(eq(partnerWallets.partnerId, referrerId));
      }
    } catch (error) {
      console.error(`[ReferralReward] Failed to credit wallet for referrer ${referrerId}:`, error);
    }
  }

  /**
   * Get referral status summary for a referrer.
   */
  async getReferralSummary(referrerId: string): Promise<{
    total: number;
    pending: number;
    registered: number;
    kycComplete: number;
    rewarded: number;
    totalRewardCredited: number;
  }> {
    const referrals = await db.select().from(userReferrals)
      .where(eq(userReferrals.referrerId, referrerId));

    const totalRewardCredited = referrals
      .filter(r => r.status === 'rewarded' || r.status === 'kyc_complete')
      .reduce((sum, r) => sum + parseFloat(r.referrerRewardAmount?.toString() || '0'), 0);

    return {
      total: referrals.length,
      pending: referrals.filter(r => r.status === 'pending').length,
      registered: referrals.filter(r => r.status === 'registered').length,
      kycComplete: referrals.filter(r => r.status === 'kyc_complete').length,
      rewarded: referrals.filter(r => r.status === 'rewarded').length,
      totalRewardCredited,
    };
  }
}

export const referralRewardEngine = ReferralRewardEngine.getInstance();
