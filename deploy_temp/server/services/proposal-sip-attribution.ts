import { db } from '../db';
import { proposalSipRecommendations, proposalVerdicts, InsertProposalSipRecommendation } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export type SipSource = 'rebalancing' | 'fresh' | 'hybrid';

export interface SipRecommendation {
  instrumentType: string;
  instrumentIsin?: string;
  instrumentName: string;
  sipAmount: number;
  sipFrequency: 'monthly' | 'quarterly' | 'weekly';
  sipStartDate?: Date;
  sipDurationMonths?: number;
  sipSource: SipSource;
  sourceRationale: string;
  convertedFromLumpsum?: boolean;
  originalLumpsumAmount?: number;
}

export interface SipSummary {
  proposalId: string;
  totalMonthlyAmount: number;
  rebalancingSipCount: number;
  rebalancingSipAmount: number;
  freshSipCount: number;
  freshSipAmount: number;
  hybridSipCount: number;
  hybridSipAmount: number;
  recommendations: SipRecommendation[];
}

export class ProposalSipAttribution {
  static determineSipSource(
    verdict: 'BUY' | 'HOLD' | 'SELL',
    isExistingHolding: boolean,
    isFreshAllocation: boolean
  ): SipSource {
    if (isExistingHolding && isFreshAllocation) {
      return 'hybrid';
    }
    if (isExistingHolding && (verdict === 'HOLD' || verdict === 'BUY')) {
      return 'rebalancing';
    }
    return 'fresh';
  }

  static async createSipRecommendation(
    proposalId: string,
    recommendation: SipRecommendation
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const verdicts = await db
        .select()
        .from(proposalVerdicts)
        .where(
          and(
            eq(proposalVerdicts.proposalId, proposalId),
            eq(proposalVerdicts.instrumentName, recommendation.instrumentName)
          )
        )
        .limit(1);

      const verdictId = verdicts.length > 0 ? verdicts[0].id : null;

      const values: InsertProposalSipRecommendation = {
        proposalId,
        verdictId,
        instrumentType: recommendation.instrumentType,
        instrumentIsin: recommendation.instrumentIsin,
        instrumentName: recommendation.instrumentName,
        sipAmount: String(recommendation.sipAmount),
        sipFrequency: recommendation.sipFrequency,
        sipStartDate: recommendation.sipStartDate ? recommendation.sipStartDate.toISOString().split('T')[0] : null,
        sipDurationMonths: recommendation.sipDurationMonths,
        sipSource: recommendation.sipSource,
        sourceRationale: recommendation.sourceRationale,
        convertedFromLumpsum: recommendation.convertedFromLumpsum || false,
        originalLumpsumAmount: recommendation.originalLumpsumAmount 
          ? String(recommendation.originalLumpsumAmount) 
          : null
      };

      const [result] = await db.insert(proposalSipRecommendations).values(values).returning({ id: proposalSipRecommendations.id });

      return { success: true, id: result.id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  static async bulkCreateSipRecommendations(
    proposalId: string,
    recommendations: SipRecommendation[]
  ): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];

    for (const rec of recommendations) {
      const result = await this.createSipRecommendation(proposalId, rec);
      if (result.success) {
        created++;
      } else {
        errors.push(`${rec.instrumentName}: ${result.error}`);
      }
    }

    return { created, errors };
  }

  static async convertLumpsumToSip(
    proposalId: string,
    instrumentName: string,
    lumpsumAmount: number,
    sipDurationMonths: number = 12
  ): Promise<{ success: boolean; sipAmount?: number; error?: string }> {
    const monthlyAmount = Math.round(lumpsumAmount / sipDurationMonths);

    const existing = await db
      .select()
      .from(proposalSipRecommendations)
      .where(
        and(
          eq(proposalSipRecommendations.proposalId, proposalId),
          eq(proposalSipRecommendations.instrumentName, instrumentName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(proposalSipRecommendations)
        .set({
          sipAmount: String(monthlyAmount),
          sipDurationMonths,
          convertedFromLumpsum: true,
          originalLumpsumAmount: String(lumpsumAmount),
          sourceRationale: `Converted from lumpsum of ₹${lumpsumAmount.toLocaleString()} to ${sipDurationMonths} monthly SIPs`,
          updatedAt: new Date()
        })
        .where(eq(proposalSipRecommendations.id, existing[0].id));
    } else {
      await this.createSipRecommendation(proposalId, {
        instrumentType: 'mutual_fund',
        instrumentName,
        sipAmount: monthlyAmount,
        sipFrequency: 'monthly',
        sipDurationMonths,
        sipSource: 'fresh',
        sourceRationale: `Converted from lumpsum of ₹${lumpsumAmount.toLocaleString()}`,
        convertedFromLumpsum: true,
        originalLumpsumAmount: lumpsumAmount
      });
    }

    return { success: true, sipAmount: monthlyAmount };
  }

  static async getSipSummary(proposalId: string): Promise<SipSummary> {
    const sips = await db
      .select()
      .from(proposalSipRecommendations)
      .where(eq(proposalSipRecommendations.proposalId, proposalId));

    const rebalancingSips = sips.filter(s => s.sipSource === 'rebalancing');
    const freshSips = sips.filter(s => s.sipSource === 'fresh');
    const hybridSips = sips.filter(s => s.sipSource === 'hybrid');

    const sumAmount = (items: any[]) => 
      items.reduce((sum, s) => sum + parseFloat(s.sipAmount?.toString() || '0'), 0);

    return {
      proposalId,
      totalMonthlyAmount: sumAmount(sips),
      rebalancingSipCount: rebalancingSips.length,
      rebalancingSipAmount: sumAmount(rebalancingSips),
      freshSipCount: freshSips.length,
      freshSipAmount: sumAmount(freshSips),
      hybridSipCount: hybridSips.length,
      hybridSipAmount: sumAmount(hybridSips),
      recommendations: sips.map(s => ({
        instrumentType: s.instrumentType,
        instrumentIsin: s.instrumentIsin || undefined,
        instrumentName: s.instrumentName,
        sipAmount: parseFloat(s.sipAmount?.toString() || '0'),
        sipFrequency: (s.sipFrequency || 'monthly') as 'monthly' | 'quarterly' | 'weekly',
        sipStartDate: s.sipStartDate ? new Date(s.sipStartDate) : undefined,
        sipDurationMonths: s.sipDurationMonths || undefined,
        sipSource: s.sipSource as SipSource,
        sourceRationale: s.sourceRationale || '',
        convertedFromLumpsum: s.convertedFromLumpsum || false,
        originalLumpsumAmount: s.originalLumpsumAmount 
          ? parseFloat(s.originalLumpsumAmount.toString()) 
          : undefined
      }))
    };
  }

  static async deleteSipRecommendation(
    proposalId: string,
    instrumentName: string
  ): Promise<{ success: boolean }> {
    await db
      .delete(proposalSipRecommendations)
      .where(
        and(
          eq(proposalSipRecommendations.proposalId, proposalId),
          eq(proposalSipRecommendations.instrumentName, instrumentName)
        )
      );
    return { success: true };
  }
}

console.log('✅ Proposal SIP Attribution Engine initialized');
