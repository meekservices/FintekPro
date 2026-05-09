import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import {
  riskProfiles,
  riskAssessmentQuestions,
  clientSegments,
  investableSurplus,
  users,
} from "@shared/schema";

interface RiskQuestionAnswer {
  questionId: string;
  answerId: string;
  score: number;
}

interface RiskAssessmentResult {
  riskScore: number;
  riskCategory: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  riskFactors: {
    category: string;
    score: number;
    weight: number;
    contribution: number;
  }[];
  assessmentDate: Date;
  nextReviewDate: Date;
}

interface ProductEligibility {
  productType: string;
  eligible: boolean;
  reason: string;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  minRiskScore: number;
  maxRiskScore: number;
  clientSegmentRequired?: string[];
}

interface SuitabilityCheck {
  productId: string;
  productType: string;
  suitable: boolean;
  riskProfileMatch: boolean;
  clientSegmentMatch: boolean;
  investmentCapacityMatch: boolean;
  warnings: string[];
  recommendations: string[];
  suitabilityScore: number;
}

class RiskSuitabilityEngine {
  private static instance: RiskSuitabilityEngine;

  private readonly riskCategoryThresholds = {
    conservative: { min: 0, max: 25 },
    moderate: { min: 26, max: 50 },
    aggressive: { min: 51, max: 75 },
    very_aggressive: { min: 76, max: 100 },
  };

  private readonly productRiskMatrix: Record<string, { minScore: number; maxScore: number; riskLevel: 'low' | 'medium' | 'high' | 'very_high'; segments?: string[] }> = {
    savings_account: { minScore: 0, maxScore: 100, riskLevel: 'low' },
    fixed_deposit: { minScore: 0, maxScore: 100, riskLevel: 'low' },
    government_bonds: { minScore: 0, maxScore: 100, riskLevel: 'low' },
    corporate_bonds_aaa: { minScore: 10, maxScore: 100, riskLevel: 'low' },
    corporate_bonds_aa: { minScore: 20, maxScore: 100, riskLevel: 'medium' },
    debt_mutual_funds: { minScore: 15, maxScore: 100, riskLevel: 'low' },
    balanced_mutual_funds: { minScore: 30, maxScore: 100, riskLevel: 'medium' },
    large_cap_mutual_funds: { minScore: 40, maxScore: 100, riskLevel: 'medium' },
    mid_cap_mutual_funds: { minScore: 50, maxScore: 100, riskLevel: 'high' },
    small_cap_mutual_funds: { minScore: 60, maxScore: 100, riskLevel: 'high' },
    direct_equity: { minScore: 50, maxScore: 100, riskLevel: 'high' },
    ipo: { minScore: 45, maxScore: 100, riskLevel: 'high' },
    unlisted_shares: { minScore: 70, maxScore: 100, riskLevel: 'very_high', segments: ['hni', 'shni', 'bhni'] },
    derivatives: { minScore: 75, maxScore: 100, riskLevel: 'very_high', segments: ['hni', 'shni', 'bhni'] },
    alternative_investments: { minScore: 65, maxScore: 100, riskLevel: 'very_high', segments: ['shni', 'bhni'] },
    pms: { minScore: 55, maxScore: 100, riskLevel: 'high', segments: ['hni', 'shni', 'bhni'] },
    aif_cat1: { minScore: 60, maxScore: 100, riskLevel: 'high', segments: ['shni', 'bhni'] },
    aif_cat2: { minScore: 65, maxScore: 100, riskLevel: 'very_high', segments: ['shni', 'bhni'] },
    aif_cat3: { minScore: 75, maxScore: 100, riskLevel: 'very_high', segments: ['bhni'] },
  };

  private readonly questionWeights: Record<string, number> = {
    investment_horizon: 0.15,
    risk_tolerance: 0.25,
    investment_experience: 0.15,
    loss_capacity: 0.20,
    income_stability: 0.10,
    financial_goals: 0.10,
    liquidity_needs: 0.05,
  };

  private constructor() {}

  public static getInstance(): RiskSuitabilityEngine {
    if (!RiskSuitabilityEngine.instance) {
      RiskSuitabilityEngine.instance = new RiskSuitabilityEngine();
    }
    return RiskSuitabilityEngine.instance;
  }

  async calculateRiskScore(answers: RiskQuestionAnswer[]): Promise<RiskAssessmentResult> {
    const categoryScores: Record<string, { totalScore: number; count: number }> = {};
    
    for (const answer of answers) {
      const category = await this.getQuestionCategory(answer.questionId);
      if (!categoryScores[category]) {
        categoryScores[category] = { totalScore: 0, count: 0 };
      }
      categoryScores[category].totalScore += answer.score;
      categoryScores[category].count += 1;
    }

    const riskFactors: RiskAssessmentResult['riskFactors'] = [];
    let weightedScore = 0;
    let totalWeight = 0;

    for (const [category, data] of Object.entries(categoryScores)) {
      const avgScore = data.count > 0 ? data.totalScore / data.count : 0;
      const normalizedScore = Math.min(100, Math.max(0, avgScore));
      const weight = this.questionWeights[category] || 0.1;
      const contribution = normalizedScore * weight;
      
      riskFactors.push({
        category,
        score: normalizedScore,
        weight,
        contribution,
      });
      
      weightedScore += contribution;
      totalWeight += weight;
    }

    const riskScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight * 100) / 100 : 50;
    const normalizedRiskScore = Math.min(100, Math.max(0, riskScore));
    
    const riskCategory = this.getRiskCategory(normalizedRiskScore);
    
    const reviewMonths = this.getReviewMonthsByRisk(riskCategory);
    const nextReviewDate = new Date();
    nextReviewDate.setMonth(nextReviewDate.getMonth() + reviewMonths);

    return {
      riskScore: normalizedRiskScore,
      riskCategory,
      riskFactors,
      assessmentDate: new Date(),
      nextReviewDate,
    };
  }

  private async getQuestionCategory(questionId: string): Promise<string> {
    const question = await db
      .select({ category: riskAssessmentQuestions.category })
      .from(riskAssessmentQuestions)
      .where(eq(riskAssessmentQuestions.id, questionId))
      .limit(1);
    
    return question[0]?.category || 'risk_tolerance';
  }

  private getRiskCategory(score: number): 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive' {
    if (score <= this.riskCategoryThresholds.conservative.max) return 'conservative';
    if (score <= this.riskCategoryThresholds.moderate.max) return 'moderate';
    if (score <= this.riskCategoryThresholds.aggressive.max) return 'aggressive';
    return 'very_aggressive';
  }

  private getReviewMonthsByRisk(category: string): number {
    switch (category) {
      case 'conservative': return 120;
      case 'moderate': return 96;
      case 'aggressive': return 48;
      case 'very_aggressive': return 24;
      default: return 96;
    }
  }

  async saveRiskProfile(userId: string, assessment: RiskAssessmentResult, answers: RiskQuestionAnswer[]): Promise<void> {
    const existing = await db
      .select()
      .from(riskProfiles)
      .where(eq(riskProfiles.userId, userId))
      .limit(1);

    const profileData = {
      userId,
      riskTolerance: assessment.riskCategory,
      investmentHorizon: this.getInvestmentHorizonFromAnswers(answers),
      investmentExperience: this.getExperienceFromAnswers(answers),
      incomeStability: this.getIncomeStabilityFromAnswers(answers),
      liquidityNeeds: this.getLiquidityNeedsFromAnswers(answers),
      dependents: 0,
      riskScore: assessment.riskScore,
      assessmentDate: assessment.assessmentDate,
      reviewDate: assessment.nextReviewDate,
      updatedAt: new Date(),
    };

    if (existing.length > 0) {
      await db
        .update(riskProfiles)
        .set(profileData)
        .where(eq(riskProfiles.userId, userId));
    } else {
      await db.insert(riskProfiles).values(profileData);
    }
  }

  private getInvestmentHorizonFromAnswers(answers: RiskQuestionAnswer[]): string {
    const horizonAnswer = answers.find(a => a.questionId.includes('horizon'));
    if (!horizonAnswer) return 'medium_term';
    if (horizonAnswer.score <= 25) return 'short_term';
    if (horizonAnswer.score <= 50) return 'medium_term';
    if (horizonAnswer.score <= 75) return 'long_term';
    return 'very_long_term';
  }

  private getExperienceFromAnswers(answers: RiskQuestionAnswer[]): string {
    const expAnswer = answers.find(a => a.questionId.includes('experience'));
    if (!expAnswer) return 'beginner';
    if (expAnswer.score <= 25) return 'beginner';
    if (expAnswer.score <= 50) return 'intermediate';
    if (expAnswer.score <= 75) return 'experienced';
    return 'expert';
  }

  private getIncomeStabilityFromAnswers(answers: RiskQuestionAnswer[]): string {
    const stabilityAnswer = answers.find(a => a.questionId.includes('stability') || a.questionId.includes('income'));
    if (!stabilityAnswer) return 'stable';
    if (stabilityAnswer.score <= 25) return 'variable';
    if (stabilityAnswer.score <= 50) return 'irregular';
    return 'stable';
  }

  private getLiquidityNeedsFromAnswers(answers: RiskQuestionAnswer[]): string {
    const liquidityAnswer = answers.find(a => a.questionId.includes('liquidity'));
    if (!liquidityAnswer) return 'medium';
    if (liquidityAnswer.score <= 30) return 'high';
    if (liquidityAnswer.score <= 60) return 'medium';
    return 'low';
  }

  async getRiskProfile(userId: string): Promise<RiskAssessmentResult | null> {
    const profile = await db
      .select()
      .from(riskProfiles)
      .where(eq(riskProfiles.userId, userId))
      .limit(1);

    if (!profile.length) return null;

    const p = profile[0];
    return {
      riskScore: p.riskScore || 50,
      riskCategory: (p.riskTolerance as any) || 'moderate',
      riskFactors: [],
      assessmentDate: p.assessmentDate || new Date(),
      nextReviewDate: p.reviewDate || new Date(),
    };
  }

  async getProductEligibility(userId: string): Promise<ProductEligibility[]> {
    const riskProfile = await this.getRiskProfile(userId);
    const riskScore = riskProfile?.riskScore || 50;
    
    const segment = await db
      .select()
      .from(clientSegments)
      .where(eq(clientSegments.userId, userId))
      .limit(1);
    
    const clientSegmentType = segment[0]?.segment || 'retail';
    
    const eligibilityList: ProductEligibility[] = [];
    
    for (const [productType, config] of Object.entries(this.productRiskMatrix)) {
      const riskEligible = riskScore >= config.minScore && riskScore <= config.maxScore;
      const segmentEligible = !config.segments || config.segments.includes(clientSegmentType);
      const eligible = riskEligible && segmentEligible;
      
      let reason = '';
      if (!eligible) {
        if (!riskEligible) {
          reason = `Risk score ${riskScore} outside range ${config.minScore}-${config.maxScore}`;
        } else if (!segmentEligible) {
          reason = `Requires ${config.segments?.join(' or ')} segment`;
        }
      }
      
      eligibilityList.push({
        productType,
        eligible,
        reason,
        riskLevel: config.riskLevel,
        minRiskScore: config.minScore,
        maxRiskScore: config.maxScore,
        clientSegmentRequired: config.segments,
      });
    }
    
    return eligibilityList;
  }

  async checkProductSuitability(
    userId: string,
    productId: string,
    productType: string,
    investmentAmount: number
  ): Promise<SuitabilityCheck> {
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    const riskProfile = await this.getRiskProfile(userId);
    const riskScore = riskProfile?.riskScore || 50;
    const riskCategory = riskProfile?.riskCategory || 'moderate';
    
    const productConfig = this.productRiskMatrix[productType];
    if (!productConfig) {
      return {
        productId,
        productType,
        suitable: false,
        riskProfileMatch: false,
        clientSegmentMatch: false,
        investmentCapacityMatch: false,
        warnings: ['Unknown product type'],
        recommendations: ['Please select a valid product type'],
        suitabilityScore: 0,
      };
    }
    
    const riskProfileMatch = riskScore >= productConfig.minScore && riskScore <= productConfig.maxScore;
    if (!riskProfileMatch) {
      if (riskScore < productConfig.minScore) {
        warnings.push(`This product requires a minimum risk score of ${productConfig.minScore}. Your score: ${riskScore}`);
        recommendations.push('Consider less risky alternatives or update your risk profile');
      } else {
        recommendations.push('This product may be too conservative for your risk profile');
      }
    }
    
    const segment = await db
      .select()
      .from(clientSegments)
      .where(eq(clientSegments.userId, userId))
      .limit(1);
    
    const clientSegmentType = segment[0]?.segment || 'retail';
    const clientSegmentMatch = !productConfig.segments || productConfig.segments.includes(clientSegmentType);
    
    if (!clientSegmentMatch) {
      warnings.push(`This product requires ${productConfig.segments?.join(' or ')} client segment`);
      recommendations.push('Increase your investable surplus to qualify for higher segments');
    }
    
    const surplus = await db
      .select()
      .from(investableSurplus)
      .where(eq(investableSurplus.userId, userId))
      .limit(1);
    
    const monthlyInvestable = parseFloat(surplus[0]?.monthlyInvestableSurplus || "0");
    const annualInvestable = monthlyInvestable * 12;
    
    const investmentCapacityMatch = investmentAmount <= annualInvestable * 0.5;
    
    if (!investmentCapacityMatch) {
      if (investmentAmount > annualInvestable) {
        warnings.push('Investment amount exceeds your annual investable surplus');
        recommendations.push('Consider a smaller investment or wait until you have more surplus');
      } else if (investmentAmount > annualInvestable * 0.5) {
        warnings.push('Investment exceeds 50% of annual surplus - high concentration risk');
        recommendations.push('Consider diversifying across multiple products');
      }
    }
    
    let suitabilityScore = 100;
    if (!riskProfileMatch) suitabilityScore -= 40;
    if (!clientSegmentMatch) suitabilityScore -= 30;
    if (!investmentCapacityMatch) suitabilityScore -= 30;
    
    if (riskScore < productConfig.minScore) {
      const gap = productConfig.minScore - riskScore;
      suitabilityScore -= Math.min(20, gap / 2);
    }
    
    suitabilityScore = Math.max(0, Math.min(100, suitabilityScore));
    
    const suitable = riskProfileMatch && clientSegmentMatch && suitabilityScore >= 60;
    
    return {
      productId,
      productType,
      suitable,
      riskProfileMatch,
      clientSegmentMatch,
      investmentCapacityMatch,
      warnings,
      recommendations,
      suitabilityScore: Math.round(suitabilityScore),
    };
  }

  async getFullSuitabilityReport(userId: string): Promise<{
    riskProfile: RiskAssessmentResult | null;
    clientSegment: any;
    productEligibility: ProductEligibility[];
    surplusSummary: any;
    recommendations: string[];
  }> {
    const riskProfile = await this.getRiskProfile(userId);
    
    const segment = await db
      .select()
      .from(clientSegments)
      .where(eq(clientSegments.userId, userId))
      .limit(1);
    
    const productEligibility = await this.getProductEligibility(userId);
    
    const surplus = await db
      .select()
      .from(investableSurplus)
      .where(eq(investableSurplus.userId, userId))
      .limit(1);
    
    const recommendations: string[] = [];
    
    if (!riskProfile) {
      recommendations.push('Complete risk assessment to unlock investment recommendations');
    } else {
      const eligibleProducts = productEligibility.filter(p => p.eligible);
      const eligibleHighRisk = eligibleProducts.filter(p => p.riskLevel === 'high' || p.riskLevel === 'very_high');
      
      if (eligibleHighRisk.length === 0 && riskProfile.riskScore > 50) {
        recommendations.push('Consider increasing your surplus to access higher-return products');
      }
      
      if (riskProfile.riskScore < 30) {
        recommendations.push('Focus on debt instruments and fixed deposits for capital preservation');
      } else if (riskProfile.riskScore < 50) {
        recommendations.push('Consider balanced funds for moderate growth with stability');
      } else if (riskProfile.riskScore < 70) {
        recommendations.push('Equity mutual funds and direct stocks align with your risk profile');
      } else {
        recommendations.push('Your profile supports alternative investments and derivatives');
      }
    }
    
    return {
      riskProfile,
      clientSegment: segment[0] || null,
      productEligibility,
      surplusSummary: surplus[0] || null,
      recommendations,
    };
  }

  async getDefaultRiskQuestions(): Promise<any[]> {
    return [
      {
        id: 'investment_horizon',
        category: 'investment_horizon',
        question: 'What is your investment time horizon?',
        options: [
          { id: 'h1', text: 'Less than 1 year', score: 10 },
          { id: 'h2', text: '1-3 years', score: 30 },
          { id: 'h3', text: '3-5 years', score: 50 },
          { id: 'h4', text: '5-10 years', score: 75 },
          { id: 'h5', text: 'More than 10 years', score: 100 },
        ],
      },
      {
        id: 'risk_tolerance',
        category: 'risk_tolerance',
        question: 'How would you react if your investment dropped 20% in value?',
        options: [
          { id: 'r1', text: 'Sell everything immediately', score: 10 },
          { id: 'r2', text: 'Sell some to reduce risk', score: 30 },
          { id: 'r3', text: 'Hold and wait for recovery', score: 60 },
          { id: 'r4', text: 'Buy more at lower prices', score: 90 },
        ],
      },
      {
        id: 'investment_experience',
        category: 'investment_experience',
        question: 'What is your investment experience?',
        options: [
          { id: 'e1', text: 'No experience - new to investing', score: 15 },
          { id: 'e2', text: 'Limited - FDs and savings only', score: 30 },
          { id: 'e3', text: 'Moderate - mutual funds experience', score: 55 },
          { id: 'e4', text: 'Experienced - direct equity trading', score: 75 },
          { id: 'e5', text: 'Expert - derivatives and alternatives', score: 95 },
        ],
      },
      {
        id: 'loss_capacity',
        category: 'loss_capacity',
        question: 'What maximum loss can you tolerate in a year?',
        options: [
          { id: 'l1', text: 'Cannot tolerate any loss', score: 5 },
          { id: 'l2', text: 'Up to 5% loss', score: 25 },
          { id: 'l3', text: 'Up to 10% loss', score: 45 },
          { id: 'l4', text: 'Up to 20% loss', score: 70 },
          { id: 'l5', text: 'Up to 30% or more loss', score: 95 },
        ],
      },
      {
        id: 'income_stability',
        category: 'income_stability',
        question: 'How stable is your current income?',
        options: [
          { id: 's1', text: 'Very unstable - variable income', score: 20 },
          { id: 's2', text: 'Somewhat stable - contract work', score: 40 },
          { id: 's3', text: 'Stable - salaried employee', score: 65 },
          { id: 's4', text: 'Very stable - government/secure job', score: 85 },
        ],
      },
      {
        id: 'financial_goals',
        category: 'financial_goals',
        question: 'What is your primary financial goal?',
        options: [
          { id: 'g1', text: 'Capital preservation', score: 15 },
          { id: 'g2', text: 'Regular income generation', score: 35 },
          { id: 'g3', text: 'Balanced growth and income', score: 55 },
          { id: 'g4', text: 'Long-term wealth creation', score: 75 },
          { id: 'g5', text: 'Aggressive growth', score: 95 },
        ],
      },
      {
        id: 'liquidity_needs',
        category: 'liquidity_needs',
        question: 'How soon might you need to access your investments?',
        options: [
          { id: 'q1', text: 'Within 6 months', score: 15 },
          { id: 'q2', text: '6 months to 1 year', score: 35 },
          { id: 'q3', text: '1-3 years', score: 60 },
          { id: 'q4', text: 'More than 3 years', score: 85 },
        ],
      },
    ];
  }
  getAssetAllocationForRiskScore(riskScore: number): Record<string, number> {
    if (riskScore <= 25) {
      return { 'Debt': 50, 'Large Cap': 15, 'Bonds': 25, 'Gold': 10 };
    } else if (riskScore <= 50) {
      return { 'Large Cap': 25, 'Mid Cap': 15, 'Flexi Cap': 10, 'Debt': 25, 'Bonds': 15, 'Gold': 10 };
    } else if (riskScore <= 75) {
      return { 'Large Cap': 30, 'Mid Cap': 20, 'Flexi Cap': 15, 'Stocks': 15, 'Debt': 15, 'Bonds': 5 };
    } else {
      return { 'Large Cap': 20, 'Mid Cap': 25, 'Flexi Cap': 15, 'Stocks': 25, 'Debt': 10, 'Bonds': 5 };
    }
  }
}

export const riskSuitabilityEngine = RiskSuitabilityEngine.getInstance();
