import { db } from "../db";
import { 
  incomeStreams, investableSurplus, financialObligations, 
  emergencyFunds, clientSegments, users,
  type IncomeStream, type FinancialObligation, type EmergencyFund,
  type InvestableSurplus, type ClientSegment
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

// PRD Section 6: Client Segmentation Thresholds (in INR)
const SEGMENT_THRESHOLDS = {
  retail: { min: 0, max: 2500000 },      // < ₹25L
  hni: { min: 2500000, max: 10000000 },  // ₹25L - ₹1Cr
  shni: { min: 10000000, max: 50000000 }, // ₹1Cr - ₹5Cr
  bhni: { min: 50000000, max: null },    // ₹5Cr+
  corporate: { min: 0, max: null },       // Entity-based
};

// Product eligibility by segment
const SEGMENT_PRODUCT_ELIGIBILITY: Record<string, string[]> = {
  retail: ['mutual_funds', 'stocks', 'bonds', 'nps', 'ppf', 'fd', 'gold'],
  hni: ['mutual_funds', 'stocks', 'bonds', 'nps', 'ppf', 'fd', 'gold', 'pms'],
  shni: ['mutual_funds', 'stocks', 'bonds', 'nps', 'ppf', 'fd', 'gold', 'pms', 'aif_cat2'],
  bhni: ['mutual_funds', 'stocks', 'bonds', 'nps', 'ppf', 'fd', 'gold', 'pms', 'aif_cat2', 'aif_cat3', 'mld', 'unlisted'],
  corporate: ['overnight_mf', 'liquid_mf', 'money_market_mf', 'tbills', 'cp', 'cd', 'short_term_bonds'],
};

// Investment caps by segment (in INR)
const SEGMENT_INVESTMENT_CAPS: Record<string, {
  pms: number | null;
  aif_cat2: number | null;
  aif_cat3: number | null;
  mld: number | null;
  unlisted: number | null;
}> = {
  retail: { pms: null, aif_cat2: null, aif_cat3: null, mld: null, unlisted: null },
  hni: { pms: 5000000, aif_cat2: null, aif_cat3: null, mld: null, unlisted: null },
  shni: { pms: null, aif_cat2: 10000000, aif_cat3: null, mld: null, unlisted: null },
  bhni: { pms: null, aif_cat2: null, aif_cat3: 10000000, mld: null, unlisted: null },
  corporate: { pms: null, aif_cat2: null, aif_cat3: null, mld: null, unlisted: null },
};

interface IncomeBreakdown {
  salary: number;
  business: number;
  rental: number;
  interest: number;
  dividend: number;
  other: number;
}

interface ObligationsBreakdown {
  loans: number;
  insurance: number;
  rent: number;
  utilities: number;
  other: number;
}

interface SurplusCalculationResult {
  totalGrossIncome: number;
  totalNetIncome: number;
  incomeBreakdown: IncomeBreakdown;
  totalObligations: number;
  obligationsBreakdown: ObligationsBreakdown;
  emergencyBufferAmount: number;
  emergencyBufferStatus: 'adequate' | 'partial' | 'inadequate';
  annualInvestableSurplus: number;
  monthlyInvestableSurplus: number;
  surplusStability: 'stable' | 'moderate' | 'volatile';
  confidenceScore: number;
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

interface SegmentResult {
  segment: string;
  clientType: string;
  eligibleProducts: string[];
  restrictedProducts: string[];
  investmentCaps: typeof SEGMENT_INVESTMENT_CAPS['retail'];
  segmentThreshold: { min: number; max: number | null; currency: string };
}

export class InvestableSurplusEngine {
  
  /**
   * Calculate total income from all streams for a user (annualized)
   */
  async calculateTotalIncome(userId: string): Promise<{
    grossIncome: number;
    netIncome: number;
    breakdown: IncomeBreakdown;
    stabilityScore: number;
  }> {
    const streams = await db
      .select()
      .from(incomeStreams)
      .where(and(eq(incomeStreams.userId, userId), eq(incomeStreams.isActive, true)));

    let grossIncome = 0;
    let netIncome = 0;
    let totalStabilityWeight = 0;
    let weightedStability = 0;

    const breakdown: IncomeBreakdown = {
      salary: 0,
      business: 0,
      rental: 0,
      interest: 0,
      dividend: 0,
      other: 0,
    };

    for (const stream of streams) {
      const grossAmount = parseFloat(stream.grossAmount || "0");
      const netAmount = parseFloat(stream.netAmount || "0");
      const frequency = stream.frequency || "monthly";
      
      // Annualize based on frequency
      let annualMultiplier = 1;
      switch (frequency) {
        case 'monthly': annualMultiplier = 12; break;
        case 'quarterly': annualMultiplier = 4; break;
        case 'annually': annualMultiplier = 1; break;
        case 'one_time': annualMultiplier = 1; break; // One-time treated as annual
      }

      const annualGross = grossAmount * annualMultiplier;
      const annualNet = netAmount * annualMultiplier;

      grossIncome += annualGross;
      netIncome += annualNet;

      // Track breakdown by type
      const type = stream.incomeType as keyof IncomeBreakdown;
      if (type in breakdown) {
        breakdown[type] += annualNet;
      } else {
        breakdown.other += annualNet;
      }

      // Calculate weighted stability score
      const weight = annualNet;
      const stability = stream.stabilityScore || 100;
      weightedStability += weight * stability;
      totalStabilityWeight += weight;
    }

    const stabilityScore = totalStabilityWeight > 0 
      ? Math.round(weightedStability / totalStabilityWeight)
      : 100;

    return { grossIncome, netIncome, breakdown, stabilityScore };
  }

  /**
   * Calculate total obligations (annualized)
   */
  async calculateTotalObligations(userId: string): Promise<{
    totalObligations: number;
    breakdown: ObligationsBreakdown;
  }> {
    const obligations = await db
      .select()
      .from(financialObligations)
      .where(and(eq(financialObligations.userId, userId), eq(financialObligations.isActive, true)));

    let totalObligations = 0;
    const breakdown: ObligationsBreakdown = {
      loans: 0,
      insurance: 0,
      rent: 0,
      utilities: 0,
      other: 0,
    };

    for (const obligation of obligations) {
      const monthlyAmount = parseFloat(obligation.monthlyAmount || "0");
      const annualAmount = monthlyAmount * 12;
      totalObligations += annualAmount;

      // Categorize by type
      const type = obligation.obligationType || "";
      if (['home_loan', 'car_loan', 'personal_loan', 'education_loan', 'other_emi'].includes(type)) {
        breakdown.loans += annualAmount;
      } else if (type === 'insurance_premium') {
        breakdown.insurance += annualAmount;
      } else if (type === 'rent') {
        breakdown.rent += annualAmount;
      } else if (['utility', 'maintenance'].includes(type)) {
        breakdown.utilities += annualAmount;
      } else {
        breakdown.other += annualAmount;
      }
    }

    return { totalObligations, breakdown };
  }

  /**
   * Get emergency fund status
   * PRD Section 5.2: Emergency buffer = 6 months expenses (mandatory)
   */
  async getEmergencyFundStatus(userId: string): Promise<{
    required: number;
    current: number;
    shortfall: number;
    coverageMonths: number;
    status: 'adequate' | 'partial' | 'inadequate';
    monthlyExpenses: number;
  }> {
    const fund = await db
      .select()
      .from(emergencyFunds)
      .where(eq(emergencyFunds.userId, userId))
      .limit(1);

    if (fund.length === 0) {
      // No emergency fund record - needs to be created
      return {
        required: 0,
        current: 0,
        shortfall: 0,
        coverageMonths: 0,
        status: 'inadequate',
        monthlyExpenses: 0,
      };
    }

    const emergencyFund = fund[0];
    const monthlyExpenses = parseFloat(emergencyFund.monthlyExpenses || "0");
    const required = monthlyExpenses * 6; // 6 months mandatory
    const current = parseFloat(emergencyFund.currentEmergencyFund || "0");
    const shortfall = Math.max(0, required - current);
    const coverageMonths = monthlyExpenses > 0 ? current / monthlyExpenses : 0;

    let status: 'adequate' | 'partial' | 'inadequate';
    if (coverageMonths >= 6) {
      status = 'adequate';
    } else if (coverageMonths >= 3) {
      status = 'partial';
    } else {
      status = 'inadequate';
    }

    return { required, current, shortfall, coverageMonths, status, monthlyExpenses };
  }

  /**
   * Calculate investable surplus
   * PRD Section 5.2: Annual Investable Surplus = Net Income – Obligations – Emergency Buffer
   */
  async calculateInvestableSurplus(userId: string): Promise<SurplusCalculationResult> {
    // Get income
    const incomeResult = await this.calculateTotalIncome(userId);
    
    // Get obligations
    const obligationsResult = await this.calculateTotalObligations(userId);
    
    // Get emergency fund status
    const emergencyResult = await this.getEmergencyFundStatus(userId);
    
    // Calculate annual emergency buffer contribution needed
    // PRD: Full 6-month emergency coverage is mandatory before surplus is available for investment
    // If shortfall exists, reserve the full shortfall amount from investable surplus
    // The shortfall represents the gap to reach 6-month mandatory coverage
    const emergencyBufferAmount = emergencyResult.shortfall > 0 
      ? emergencyResult.shortfall  // Full shortfall reserved per PRD 6-month mandate
      : 0;
    
    // Calculate investable surplus
    // Formula: Net Income - Obligations - Emergency Buffer
    const annualInvestableSurplus = Math.max(
      0,
      incomeResult.netIncome - obligationsResult.totalObligations - emergencyBufferAmount
    );
    const monthlyInvestableSurplus = annualInvestableSurplus / 12;

    // Determine surplus stability based on income stability
    let surplusStability: 'stable' | 'moderate' | 'volatile';
    if (incomeResult.stabilityScore >= 80) {
      surplusStability = 'stable';
    } else if (incomeResult.stabilityScore >= 50) {
      surplusStability = 'moderate';
    } else {
      surplusStability = 'volatile';
    }

    // Calculate confidence score (based on verified income and obligations)
    const confidenceScore = incomeResult.stabilityScore;

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      annualInvestableSurplus,
      emergencyResult,
      obligationsResult.totalObligations,
      incomeResult.netIncome
    );

    return {
      totalGrossIncome: incomeResult.grossIncome,
      totalNetIncome: incomeResult.netIncome,
      incomeBreakdown: incomeResult.breakdown,
      totalObligations: obligationsResult.totalObligations,
      obligationsBreakdown: obligationsResult.breakdown,
      emergencyBufferAmount,
      emergencyBufferStatus: emergencyResult.status,
      annualInvestableSurplus,
      monthlyInvestableSurplus,
      surplusStability,
      confidenceScore,
      recommendations,
    };
  }

  /**
   * Generate smart recommendations based on surplus calculation
   */
  private generateRecommendations(
    surplus: number,
    emergency: { status: string; shortfall: number; coverageMonths: number },
    obligations: number,
    income: number
  ): { immediate: string[]; shortTerm: string[]; longTerm: string[] } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Emergency fund recommendations
    if (emergency.status === 'inadequate') {
      immediate.push('Build emergency fund to cover at least 3 months of expenses');
      shortTerm.push(`Grow emergency fund to ₹${(emergency.shortfall / 100000).toFixed(1)}L (6 months coverage)`);
    } else if (emergency.status === 'partial') {
      shortTerm.push(`Increase emergency fund by ₹${(emergency.shortfall / 100000).toFixed(1)}L to reach 6 months coverage`);
    }

    // Debt ratio recommendations
    const debtToIncome = income > 0 ? (obligations / income) * 100 : 0;
    if (debtToIncome > 50) {
      immediate.push('High debt-to-income ratio (>50%). Consider debt consolidation');
    } else if (debtToIncome > 40) {
      shortTerm.push('Consider reducing debt obligations to below 40% of income');
    }

    // Surplus utilization recommendations
    if (surplus > 0) {
      const monthlySurplus = surplus / 12;
      if (monthlySurplus >= 50000) {
        shortTerm.push('Start SIPs in diversified equity funds for long-term wealth creation');
        longTerm.push('Consider PMS or AIF investments for higher returns');
      } else if (monthlySurplus >= 10000) {
        shortTerm.push('Start systematic investment plans (SIPs) in equity mutual funds');
        longTerm.push('Build corpus for retirement and major life goals');
      } else {
        immediate.push('Start small SIPs of ₹500-1000 to build investment habit');
        shortTerm.push('Focus on increasing income or reducing expenses');
      }
    } else {
      immediate.push('No investable surplus currently. Focus on increasing income or reducing expenses');
    }

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Determine client segment based on investable surplus
   * PRD Section 6: Client Segmentation Logic
   */
  async determineClientSegment(userId: string, clientType: string = 'individual'): Promise<SegmentResult> {
    // For non-individual (corporate), return corporate segment
    if (clientType !== 'individual') {
      return {
        segment: 'corporate',
        clientType,
        eligibleProducts: SEGMENT_PRODUCT_ELIGIBILITY.corporate,
        restrictedProducts: ['pms', 'aif', 'mld', 'unlisted', 'equity'],
        investmentCaps: SEGMENT_INVESTMENT_CAPS.corporate,
        segmentThreshold: { min: 0, max: null, currency: 'INR' },
      };
    }

    // Calculate investable surplus
    const surplusResult = await this.calculateInvestableSurplus(userId);
    const surplus = surplusResult.annualInvestableSurplus;

    // Determine segment based on surplus thresholds
    let segment: string;
    if (surplus >= SEGMENT_THRESHOLDS.bhni.min) {
      segment = 'bhni';
    } else if (surplus >= SEGMENT_THRESHOLDS.shni.min) {
      segment = 'shni';
    } else if (surplus >= SEGMENT_THRESHOLDS.hni.min) {
      segment = 'hni';
    } else {
      segment = 'retail';
    }

    const eligibleProducts = SEGMENT_PRODUCT_ELIGIBILITY[segment] || SEGMENT_PRODUCT_ELIGIBILITY.retail;
    const allProducts = Object.values(SEGMENT_PRODUCT_ELIGIBILITY).flat();
    const uniqueProducts = Array.from(new Set(allProducts));
    const restrictedProducts = uniqueProducts.filter(p => !eligibleProducts.includes(p));
    const thresholds = SEGMENT_THRESHOLDS[segment as keyof typeof SEGMENT_THRESHOLDS];

    return {
      segment,
      clientType,
      eligibleProducts,
      restrictedProducts,
      investmentCaps: SEGMENT_INVESTMENT_CAPS[segment] || SEGMENT_INVESTMENT_CAPS.retail,
      segmentThreshold: { min: thresholds.min, max: thresholds.max, currency: 'INR' },
    };
  }

  /**
   * Save calculated surplus to database
   */
  async saveInvestableSurplus(userId: string, result: SurplusCalculationResult): Promise<InvestableSurplus> {
    const [saved] = await db
      .insert(investableSurplus)
      .values({
        userId,
        periodType: 'annual',
        totalGrossIncome: result.totalGrossIncome.toString(),
        totalNetIncome: result.totalNetIncome.toString(),
        incomeBreakdown: result.incomeBreakdown,
        totalObligations: result.totalObligations.toString(),
        obligationsBreakdown: result.obligationsBreakdown,
        emergencyBufferAmount: result.emergencyBufferAmount.toString(),
        emergencyBufferStatus: result.emergencyBufferStatus,
        annualInvestableSurplus: result.annualInvestableSurplus.toString(),
        monthlyInvestableSurplus: result.monthlyInvestableSurplus.toString(),
        surplusStability: result.surplusStability,
        confidenceScore: result.confidenceScore,
        surplusRecommendations: result.recommendations,
      })
      .returning();

    return saved;
  }

  /**
   * Save client segment to database
   */
  async saveClientSegment(userId: string, result: SegmentResult, surplus: number): Promise<ClientSegment> {
    // Check if segment already exists
    const existing = await db
      .select()
      .from(clientSegments)
      .where(eq(clientSegments.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(clientSegments)
        .set({
          segment: result.segment,
          clientType: result.clientType,
          annualInvestableSurplus: surplus.toString(),
          eligibleProducts: result.eligibleProducts,
          restrictedProducts: result.restrictedProducts,
          investmentCaps: result.investmentCaps,
          segmentThreshold: result.segmentThreshold,
          previousSegment: existing[0].segment !== result.segment ? existing[0].segment : undefined,
          segmentChangedAt: existing[0].segment !== result.segment ? new Date() : undefined,
          assessedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientSegments.userId, userId))
        .returning();
      return updated;
    } else {
      // Insert new
      const [inserted] = await db
        .insert(clientSegments)
        .values({
          userId,
          segment: result.segment,
          clientType: result.clientType,
          annualInvestableSurplus: surplus.toString(),
          eligibleProducts: result.eligibleProducts,
          restrictedProducts: result.restrictedProducts,
          investmentCaps: result.investmentCaps,
          segmentThreshold: result.segmentThreshold,
        })
        .returning();
      return inserted;
    }
  }

  /**
   * Get latest surplus calculation for a user
   */
  async getLatestSurplus(userId: string): Promise<InvestableSurplus | null> {
    const [latest] = await db
      .select()
      .from(investableSurplus)
      .where(eq(investableSurplus.userId, userId))
      .orderBy(desc(investableSurplus.calculationDate))
      .limit(1);

    return latest || null;
  }

  /**
   * Get client segment for a user
   */
  async getClientSegment(userId: string): Promise<ClientSegment | null> {
    const [segment] = await db
      .select()
      .from(clientSegments)
      .where(eq(clientSegments.userId, userId))
      .limit(1);

    return segment || null;
  }

  /**
   * Full assessment: Calculate and save surplus + segment
   */
  async performFullAssessment(userId: string): Promise<{
    surplus: InvestableSurplus;
    segment: ClientSegment;
  }> {
    // Calculate surplus
    const surplusResult = await this.calculateInvestableSurplus(userId);
    
    // Determine segment
    const segmentResult = await this.determineClientSegment(userId);
    
    // Save both
    const surplus = await this.saveInvestableSurplus(userId, surplusResult);
    const segment = await this.saveClientSegment(userId, segmentResult, surplusResult.annualInvestableSurplus);
    
    return { surplus, segment };
  }
}

export const investableSurplusEngine = new InvestableSurplusEngine();
