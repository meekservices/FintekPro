// @ts-nocheck
import { db } from "../db";
import { bankEligibilityRules, InsertBankEligibilityRules } from "@shared/schema";
import { eq, and, gte, lte, or } from "drizzle-orm";

export interface ApplicantProfile {
  cibilScore?: number;
  monthlyIncome?: number;
  employmentType?: 'salaried' | 'self_employed' | 'professional' | 'business_owner';
  businessVintageMonths?: number;
  annualTurnover?: number;
  age?: number;
  city?: string;
  propertyType?: 'residential' | 'commercial' | 'mixed';
  requestedAmount?: number;
  requestedTenure?: number;
}

export interface EligibilityResult {
  bankCode: string;
  productType: string;
  isEligible: boolean;
  eligibilityScore: number;
  routingPriority: number;
  reasons: string[];
  matchedCriteria: string[];
  failedCriteria: string[];
}

export interface RoutingRecommendation {
  productType: string;
  eligibleBanks: EligibilityResult[];
  recommendedOrder: string[];
  summary: {
    totalBanksChecked: number;
    eligibleCount: number;
    topRecommendation?: string;
  };
}

class EligibilityMatrixService {
  async evaluateEligibility(
    applicant: ApplicantProfile,
    productType: string,
    bankCode?: string
  ): Promise<EligibilityResult[]> {
    try {
      let rules;
      
      if (bankCode) {
        rules = await db
          .select()
          .from(bankEligibilityRules)
          .where(
            and(
              eq(bankEligibilityRules.productType, productType),
              eq(bankEligibilityRules.bankCode, bankCode),
              eq(bankEligibilityRules.isActive, true)
            )
          );
      } else {
        rules = await db
          .select()
          .from(bankEligibilityRules)
          .where(
            and(
              eq(bankEligibilityRules.productType, productType),
              eq(bankEligibilityRules.isActive, true)
            )
          );
      }

      const results: EligibilityResult[] = [];

      for (const rule of rules) {
        const result = this.evaluateRule(applicant, rule);
        results.push(result);
      }

      return results.sort((a, b) => {
        if (a.isEligible && !b.isEligible) return -1;
        if (!a.isEligible && b.isEligible) return 1;
        if (a.isEligible && b.isEligible) {
          return a.routingPriority - b.routingPriority;
        }
        return b.eligibilityScore - a.eligibilityScore;
      });
    } catch (error) {
      console.error('[EligibilityMatrix] Error evaluating eligibility:', error);
      return [];
    }
  }

  private evaluateRule(applicant: ApplicantProfile, rule: any): EligibilityResult {
    const matchedCriteria: string[] = [];
    const failedCriteria: string[] = [];
    let eligibilityScore = 100;

    if (rule.minCibilScore && applicant.cibilScore !== undefined) {
      if (applicant.cibilScore >= rule.minCibilScore) {
        matchedCriteria.push(`CIBIL Score ${applicant.cibilScore} >= ${rule.minCibilScore}`);
        if (applicant.cibilScore >= 750) eligibilityScore += 20;
        else if (applicant.cibilScore >= 700) eligibilityScore += 10;
      } else {
        failedCriteria.push(`CIBIL Score ${applicant.cibilScore} < ${rule.minCibilScore} required`);
        eligibilityScore -= 40;
      }
    }

    if (rule.minMonthlyIncome && applicant.monthlyIncome !== undefined) {
      const minIncome = parseFloat(rule.minMonthlyIncome);
      if (applicant.monthlyIncome >= minIncome) {
        matchedCriteria.push(`Monthly Income ₹${applicant.monthlyIncome.toLocaleString()} >= ₹${minIncome.toLocaleString()}`);
        eligibilityScore += 10;
      } else {
        failedCriteria.push(`Monthly Income ₹${applicant.monthlyIncome.toLocaleString()} < ₹${minIncome.toLocaleString()} required`);
        eligibilityScore -= 30;
      }
    }

    if (rule.allowedEmploymentTypes && rule.allowedEmploymentTypes.length > 0 && applicant.employmentType) {
      if (rule.allowedEmploymentTypes.includes(applicant.employmentType)) {
        matchedCriteria.push(`Employment type '${applicant.employmentType}' is allowed`);
      } else {
        failedCriteria.push(`Employment type '${applicant.employmentType}' not in allowed types: ${rule.allowedEmploymentTypes.join(', ')}`);
        eligibilityScore -= 50;
      }
    }

    if (rule.minBusinessVintageMonths && applicant.businessVintageMonths !== undefined) {
      if (applicant.businessVintageMonths >= rule.minBusinessVintageMonths) {
        matchedCriteria.push(`Business vintage ${applicant.businessVintageMonths} months >= ${rule.minBusinessVintageMonths} required`);
      } else {
        failedCriteria.push(`Business vintage ${applicant.businessVintageMonths} months < ${rule.minBusinessVintageMonths} required`);
        eligibilityScore -= 35;
      }
    }

    if (rule.minAnnualTurnover && applicant.annualTurnover !== undefined) {
      const minTurnover = parseFloat(rule.minAnnualTurnover);
      if (applicant.annualTurnover >= minTurnover) {
        matchedCriteria.push(`Annual Turnover ₹${(applicant.annualTurnover / 100000).toFixed(1)}L >= ₹${(minTurnover / 100000).toFixed(1)}L`);
      } else {
        failedCriteria.push(`Annual Turnover ₹${(applicant.annualTurnover / 100000).toFixed(1)}L < ₹${(minTurnover / 100000).toFixed(1)}L required`);
        eligibilityScore -= 30;
      }
    }

    if (rule.minAge && applicant.age !== undefined) {
      if (applicant.age >= rule.minAge) {
        matchedCriteria.push(`Age ${applicant.age} >= ${rule.minAge}`);
      } else {
        failedCriteria.push(`Age ${applicant.age} < ${rule.minAge} minimum`);
        eligibilityScore -= 100;
      }
    }

    if (rule.maxAge && applicant.age !== undefined) {
      if (applicant.age <= rule.maxAge) {
        matchedCriteria.push(`Age ${applicant.age} <= ${rule.maxAge}`);
      } else {
        failedCriteria.push(`Age ${applicant.age} > ${rule.maxAge} maximum`);
        eligibilityScore -= 100;
      }
    }

    if (rule.minLoanAmount && applicant.requestedAmount !== undefined) {
      const minAmount = parseFloat(rule.minLoanAmount);
      if (applicant.requestedAmount >= minAmount) {
        matchedCriteria.push(`Loan amount within range`);
      } else {
        failedCriteria.push(`Requested amount ₹${applicant.requestedAmount.toLocaleString()} < ₹${minAmount.toLocaleString()} minimum`);
        eligibilityScore -= 20;
      }
    }

    if (rule.maxLoanAmount && applicant.requestedAmount !== undefined) {
      const maxAmount = parseFloat(rule.maxLoanAmount);
      if (applicant.requestedAmount <= maxAmount) {
        matchedCriteria.push(`Loan amount within maximum limit`);
      } else {
        failedCriteria.push(`Requested amount ₹${applicant.requestedAmount.toLocaleString()} > ₹${maxAmount.toLocaleString()} maximum`);
        eligibilityScore -= 20;
      }
    }

    if (rule.allowedPropertyTypes && rule.allowedPropertyTypes.length > 0 && applicant.propertyType) {
      if (rule.allowedPropertyTypes.includes(applicant.propertyType)) {
        matchedCriteria.push(`Property type '${applicant.propertyType}' is allowed`);
      } else {
        failedCriteria.push(`Property type '${applicant.propertyType}' not in allowed types: ${rule.allowedPropertyTypes.join(', ')}`);
        eligibilityScore -= 40;
      }
    }

    const isEligible = failedCriteria.length === 0 && eligibilityScore > 0;

    return {
      bankCode: rule.bankCode,
      productType: rule.productType,
      isEligible,
      eligibilityScore: Math.max(0, Math.min(100, eligibilityScore)),
      routingPriority: rule.routingPriority || 100,
      reasons: isEligible 
        ? ['Meets all eligibility criteria'] 
        : failedCriteria,
      matchedCriteria,
      failedCriteria,
    };
  }

  async getRoutingRecommendation(
    applicant: ApplicantProfile,
    productType: string
  ): Promise<RoutingRecommendation> {
    const results = await this.evaluateEligibility(applicant, productType);
    
    const eligibleBanks = results.filter(r => r.isEligible);
    const recommendedOrder = eligibleBanks.map(r => r.bankCode);

    return {
      productType,
      eligibleBanks: results,
      recommendedOrder,
      summary: {
        totalBanksChecked: results.length,
        eligibleCount: eligibleBanks.length,
        topRecommendation: recommendedOrder[0],
      },
    };
  }

  async getAllRules(): Promise<any[]> {
    return db.select().from(bankEligibilityRules);
  }

  async getRulesByProduct(productType: string): Promise<any[]> {
    return db
      .select()
      .from(bankEligibilityRules)
      .where(eq(bankEligibilityRules.productType, productType));
  }

  async getRulesByBank(bankCode: string): Promise<any[]> {
    return db
      .select()
      .from(bankEligibilityRules)
      .where(eq(bankEligibilityRules.bankCode, bankCode));
  }

  async createRule(rule: InsertBankEligibilityRules): Promise<any> {
    const [created] = await db
      .insert(bankEligibilityRules)
      .values(rule)
      .returning();
    return created;
  }

  async updateRule(id: string, updates: Partial<InsertBankEligibilityRules>): Promise<any> {
    const [updated] = await db
      .update(bankEligibilityRules)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bankEligibilityRules.id, id))
      .returning();
    return updated;
  }

  async deleteRule(id: string): Promise<void> {
    await db.delete(bankEligibilityRules).where(eq(bankEligibilityRules.id, id));
  }

  async seedDefaultRules(): Promise<void> {
    const existingRules = await db.select().from(bankEligibilityRules).limit(1);
    if (existingRules.length > 0) {
      console.log('[EligibilityMatrix] Rules already exist, skipping seed');
      return;
    }

    const defaultRules: InsertBankEligibilityRules[] = [
      {
        bankCode: 'ICICI',
        productType: 'personal',
        allowedEmploymentTypes: ['salaried'],
        minCibilScore: 750,
        minMonthlyIncome: '25000',
        minLoanAmount: '50000',
        maxLoanAmount: '4000000',
        maxTenureMonths: 72,
        minAge: 21,
        maxAge: 60,
        routingPriority: 1,
        notes: 'Strong metro approval',
      },
      {
        bankCode: 'HDFC',
        productType: 'personal',
        allowedEmploymentTypes: ['salaried'],
        minCibilScore: 740,
        minMonthlyIncome: '30000',
        minLoanAmount: '100000',
        maxLoanAmount: '4000000',
        maxTenureMonths: 60,
        minAge: 21,
        maxAge: 60,
        routingPriority: 2,
        notes: 'Employer profiling critical',
      },
      {
        bankCode: 'AXIS',
        productType: 'personal',
        allowedEmploymentTypes: ['salaried', 'self_employed'],
        minCibilScore: 720,
        minMonthlyIncome: '25000',
        minLoanAmount: '50000',
        maxLoanAmount: '3500000',
        maxTenureMonths: 60,
        minAge: 21,
        maxAge: 60,
        routingPriority: 3,
        notes: 'Flexible underwriting',
      },
      {
        bankCode: 'KOTAK',
        productType: 'personal',
        allowedEmploymentTypes: ['salaried'],
        minCibilScore: 730,
        minMonthlyIncome: '20000',
        minLoanAmount: '50000',
        maxLoanAmount: '3000000',
        maxTenureMonths: 60,
        minAge: 21,
        maxAge: 58,
        routingPriority: 4,
        notes: 'Faster TAT, lower ticket',
      },
      {
        bankCode: 'ICICI',
        productType: 'business',
        allowedEmploymentTypes: ['self_employed', 'business_owner'],
        minCibilScore: 700,
        minMonthlyIncome: '50000',
        minBusinessVintageMonths: 36,
        minAnnualTurnover: '4000000',
        minLoanAmount: '500000',
        maxLoanAmount: '5000000',
        maxTenureMonths: 60,
        minAge: 25,
        maxAge: 65,
        routingPriority: 1,
        notes: 'GST + banking strong',
      },
      {
        bankCode: 'HDFC',
        productType: 'business',
        allowedEmploymentTypes: ['self_employed', 'business_owner'],
        minCibilScore: 700,
        minMonthlyIncome: '40000',
        minBusinessVintageMonths: 24,
        minAnnualTurnover: '2500000',
        minLoanAmount: '500000',
        maxLoanAmount: '4000000',
        maxTenureMonths: 60,
        minAge: 25,
        maxAge: 65,
        routingPriority: 2,
        notes: 'CA financials needed',
      },
      {
        bankCode: 'AXIS',
        productType: 'business',
        allowedEmploymentTypes: ['self_employed', 'business_owner'],
        minCibilScore: 680,
        minMonthlyIncome: '30000',
        minBusinessVintageMonths: 12,
        minAnnualTurnover: '1500000',
        minLoanAmount: '300000',
        maxLoanAmount: '2500000',
        maxTenureMonths: 48,
        minAge: 23,
        maxAge: 65,
        routingPriority: 3,
        notes: 'MSME-friendly',
      },
      {
        bankCode: 'KOTAK',
        productType: 'business',
        allowedEmploymentTypes: ['self_employed', 'business_owner'],
        minCibilScore: 690,
        minMonthlyIncome: '35000',
        minBusinessVintageMonths: 24,
        minAnnualTurnover: '2000000',
        minLoanAmount: '500000',
        maxLoanAmount: '3000000',
        maxTenureMonths: 60,
        minAge: 25,
        maxAge: 65,
        routingPriority: 4,
        notes: 'Conservative',
      },
      {
        bankCode: 'ICICI',
        productType: 'lap',
        allowedEmploymentTypes: ['salaried', 'self_employed', 'business_owner'],
        minCibilScore: 700,
        minMonthlyIncome: '40000',
        allowedPropertyTypes: ['residential'],
        maxLtvRatio: '60.00',
        minLoanAmount: '500000',
        maxLoanAmount: '50000000',
        maxTenureMonths: 180,
        minAge: 25,
        maxAge: 65,
        routingPriority: 1,
        notes: 'Strong valuation checks',
      },
      {
        bankCode: 'HDFC',
        productType: 'lap',
        allowedEmploymentTypes: ['salaried', 'self_employed', 'business_owner'],
        minCibilScore: 700,
        minMonthlyIncome: '50000',
        allowedPropertyTypes: ['residential'],
        maxLtvRatio: '65.00',
        minLoanAmount: '500000',
        maxLoanAmount: '50000000',
        maxTenureMonths: 180,
        minAge: 25,
        maxAge: 65,
        routingPriority: 2,
        notes: 'Best pricing',
      },
      {
        bankCode: 'AXIS',
        productType: 'lap',
        allowedEmploymentTypes: ['salaried', 'self_employed', 'business_owner'],
        minCibilScore: 680,
        minMonthlyIncome: '35000',
        allowedPropertyTypes: ['residential', 'commercial'],
        maxLtvRatio: '60.00',
        minLoanAmount: '300000',
        maxLoanAmount: '40000000',
        maxTenureMonths: 180,
        minAge: 23,
        maxAge: 65,
        routingPriority: 3,
        notes: 'Flexible usage',
      },
      {
        bankCode: 'KOTAK',
        productType: 'lap',
        allowedEmploymentTypes: ['salaried', 'self_employed', 'business_owner'],
        minCibilScore: 690,
        minMonthlyIncome: '40000',
        allowedPropertyTypes: ['residential'],
        maxLtvRatio: '55.00',
        minLoanAmount: '500000',
        maxLoanAmount: '30000000',
        maxTenureMonths: 180,
        minAge: 25,
        maxAge: 65,
        routingPriority: 4,
        notes: 'Faster approvals',
      },
    ];

    for (const rule of defaultRules) {
      await this.createRule(rule);
    }

    console.log(`[EligibilityMatrix] Seeded ${defaultRules.length} default eligibility rules`);
  }
}

export const eligibilityMatrixService = new EligibilityMatrixService();
