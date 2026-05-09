/**
 * Insurance Product Suitability Assessment Service
 * 
 * Implements IRDAI (Protection of Policyholders) Regulations 2024 compliance:
 * - Mandatory suitability assessment before recommending insurance products
 * - Assesses financial needs, risk appetite, and insurance requirements
 * - Documents suitability analysis for audit trail
 * - Ensures appropriate product recommendations
 */

export interface InsuranceSuitabilityAssessment {
  assessmentId: string;
  clientId: string;
  agentId: string;
  assessmentDate: Date;
  validUntil: Date;
  
  personalInformation: {
    age: number;
    gender: 'male' | 'female' | 'other';
    maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
    dependents: number;
    occupation: string;
    employmentType: 'salaried' | 'self_employed' | 'business' | 'retired' | 'homemaker';
  };
  
  financialProfile: {
    annualIncome: number;
    monthlyExpenses: number;
    existingLiabilities: number;
    existingSavings: number;
    existingInsurance: {
      type: string;
      sumAssured: number;
      premium: number;
      provider: string;
    }[];
  };
  
  insuranceNeeds: {
    primaryGoal: 'life_protection' | 'wealth_creation' | 'retirement' | 'child_education' | 'health_coverage' | 'tax_saving';
    coverageAmount: number;
    premiumAffordability: number;
    preferredTenure: number;
    riskAppetite: 'conservative' | 'moderate' | 'aggressive';
  };
  
  healthProfile: {
    existingConditions: string[];
    smoker: boolean;
    alcoholConsumption: 'none' | 'occasional' | 'regular';
    familyHealthHistory: string[];
  };
  
  suitabilityScore: number;
  recommendedProducts: {
    productType: string;
    suitabilityRating: 'highly_suitable' | 'suitable' | 'moderately_suitable' | 'not_suitable';
    reasoning: string;
    coverageRecommendation: number;
    premiumEstimate: number;
  }[];
  
  riskDisclosures: string[];
  regulatoryReference: string;
  clientAcknowledgement: boolean;
  acknowledgementTimestamp?: Date;
}

interface SuitabilityInput {
  clientId: string;
  agentId: string;
  personalInfo: InsuranceSuitabilityAssessment['personalInformation'];
  financialProfile: InsuranceSuitabilityAssessment['financialProfile'];
  insuranceNeeds: InsuranceSuitabilityAssessment['insuranceNeeds'];
  healthProfile: InsuranceSuitabilityAssessment['healthProfile'];
}

class InsuranceSuitabilityService {
  private readonly REGULATORY_REFERENCE = 'IRDAI (Protection of Policyholders) Regulations 2024';
  private readonly ASSESSMENT_VALIDITY_DAYS = 180;
  private assessmentCache: Map<string, InsuranceSuitabilityAssessment> = new Map();

  async conductSuitabilityAssessment(input: SuitabilityInput): Promise<InsuranceSuitabilityAssessment> {
    const assessmentId = `ISA_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const validUntil = new Date(now.getTime() + this.ASSESSMENT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);
    
    const suitabilityScore = this.calculateSuitabilityScore(input);
    const recommendedProducts = this.generateProductRecommendations(input, suitabilityScore);
    const riskDisclosures = this.generateRiskDisclosures(input, recommendedProducts);
    
    const assessment: InsuranceSuitabilityAssessment = {
      assessmentId,
      clientId: input.clientId,
      agentId: input.agentId,
      assessmentDate: now,
      validUntil,
      personalInformation: input.personalInfo,
      financialProfile: input.financialProfile,
      insuranceNeeds: input.insuranceNeeds,
      healthProfile: input.healthProfile,
      suitabilityScore,
      recommendedProducts,
      riskDisclosures,
      regulatoryReference: this.REGULATORY_REFERENCE,
      clientAcknowledgement: false,
    };
    
    this.assessmentCache.set(assessmentId, assessment);
    
    return assessment;
  }
  
  private calculateSuitabilityScore(input: SuitabilityInput): number {
    let score = 50;
    
    const incomeToExpenseRatio = input.financialProfile.annualIncome / 12 / Math.max(input.financialProfile.monthlyExpenses, 1);
    if (incomeToExpenseRatio >= 2) score += 15;
    else if (incomeToExpenseRatio >= 1.5) score += 10;
    else if (incomeToExpenseRatio >= 1.2) score += 5;
    
    const existingCoverage = input.financialProfile.existingInsurance.reduce((sum, ins) => sum + ins.sumAssured, 0);
    const coverageGap = input.insuranceNeeds.coverageAmount - existingCoverage;
    if (coverageGap > 0) score += 10;
    
    const premiumAffordabilityRatio = input.insuranceNeeds.premiumAffordability / (input.financialProfile.annualIncome / 12);
    if (premiumAffordabilityRatio >= 0.1 && premiumAffordabilityRatio <= 0.2) score += 10;
    else if (premiumAffordabilityRatio > 0.2) score -= 5;
    
    if (input.personalInfo.dependents > 0) score += 5;
    
    if (input.healthProfile.smoker) score -= 10;
    if (input.healthProfile.existingConditions.length > 0) score -= 5;
    
    return Math.min(100, Math.max(0, score));
  }
  
  private generateProductRecommendations(input: SuitabilityInput, suitabilityScore: number): InsuranceSuitabilityAssessment['recommendedProducts'] {
    const recommendations: InsuranceSuitabilityAssessment['recommendedProducts'] = [];
    const age = input.personalInfo.age;
    const hasDependents = input.personalInfo.dependents > 0;
    const goal = input.insuranceNeeds.primaryGoal;
    
    if ((goal === 'life_protection' || hasDependents) && age < 60) {
      const coverageNeeded = input.insuranceNeeds.coverageAmount > 0 
        ? input.insuranceNeeds.coverageAmount 
        : input.financialProfile.annualIncome * 10;
      
      recommendations.push({
        productType: 'Term Life Insurance',
        suitabilityRating: hasDependents ? 'highly_suitable' : 'suitable',
        reasoning: hasDependents 
          ? 'Term insurance provides high coverage at low cost, essential for income protection with dependents.'
          : 'Term insurance offers cost-effective life coverage for financial protection.',
        coverageRecommendation: coverageNeeded,
        premiumEstimate: Math.round(coverageNeeded * 0.001 * (age < 35 ? 0.5 : age < 45 ? 0.8 : 1.2)),
      });
    }
    
    if (goal === 'health_coverage' || input.healthProfile.existingConditions.length === 0) {
      const healthCoverage = Math.max(500000, input.financialProfile.annualIncome * 0.5);
      
      recommendations.push({
        productType: 'Health Insurance',
        suitabilityRating: 'highly_suitable',
        reasoning: 'Health insurance is essential protection against medical expenses. Family floater recommended for dependents.',
        coverageRecommendation: healthCoverage,
        premiumEstimate: Math.round(healthCoverage * 0.015),
      });
    }
    
    if ((goal === 'wealth_creation' || goal === 'retirement') && input.insuranceNeeds.riskAppetite !== 'conservative') {
      const ulipCoverage = input.insuranceNeeds.premiumAffordability * 12;
      
      recommendations.push({
        productType: 'ULIP (Unit Linked Insurance Plan)',
        suitabilityRating: input.insuranceNeeds.riskAppetite === 'aggressive' ? 'suitable' : 'moderately_suitable',
        reasoning: 'ULIPs combine insurance with market-linked returns. Suitable for long-term wealth creation with some risk appetite.',
        coverageRecommendation: ulipCoverage * 10,
        premiumEstimate: ulipCoverage,
      });
    }
    
    if (goal === 'child_education' && input.personalInfo.dependents > 0) {
      recommendations.push({
        productType: 'Child Education Plan',
        suitabilityRating: 'highly_suitable',
        reasoning: 'Child plans ensure education funding continues even in unfortunate circumstances.',
        coverageRecommendation: 2500000,
        premiumEstimate: Math.round(2500000 * 0.05 / input.insuranceNeeds.preferredTenure),
      });
    }
    
    if (goal === 'retirement' && age >= 40) {
      const annuityAmount = input.financialProfile.annualIncome * 0.5;
      
      recommendations.push({
        productType: 'Pension/Annuity Plan',
        suitabilityRating: age >= 50 ? 'highly_suitable' : 'suitable',
        reasoning: 'Pension plans provide guaranteed income post-retirement for financial security.',
        coverageRecommendation: annuityAmount * (65 - age),
        premiumEstimate: annuityAmount * 0.15,
      });
    }
    
    if (goal === 'tax_saving') {
      recommendations.push({
        productType: 'Tax-Saving Endowment Plan',
        suitabilityRating: 'moderately_suitable',
        reasoning: 'Endowment plans offer tax benefits under Section 80C with guaranteed maturity benefits.',
        coverageRecommendation: 150000 * 10,
        premiumEstimate: 150000,
      });
    }
    
    return recommendations;
  }
  
  private generateRiskDisclosures(input: SuitabilityInput, recommendations: InsuranceSuitabilityAssessment['recommendedProducts']): string[] {
    const disclosures: string[] = [
      'Insurance is a contract of utmost good faith. All material information must be disclosed accurately.',
      'Premium rates may vary based on underwriting and medical examination results.',
      'Policy benefits are subject to terms and conditions of the policy document.',
      'Past performance of ULIPs/investments does not guarantee future returns.',
      'Free-look period of 15 days is available for policy cancellation with refund.',
    ];
    
    if (input.healthProfile.existingConditions.length > 0) {
      disclosures.push('Pre-existing conditions may affect premium loading or policy terms.');
    }
    
    if (input.healthProfile.smoker) {
      disclosures.push('Tobacco usage results in higher premium rates.');
    }
    
    if (recommendations.some(r => r.productType.includes('ULIP'))) {
      disclosures.push('ULIPs are subject to market risks. Read offer document carefully before investing.');
      disclosures.push('Minimum lock-in period for ULIPs is 5 years.');
    }
    
    if (input.personalInfo.age >= 55) {
      disclosures.push('Coverage options may be limited due to age. Medical underwriting may be stricter.');
    }
    
    disclosures.push(`This assessment is valid for ${this.ASSESSMENT_VALIDITY_DAYS} days from the assessment date.`);
    disclosures.push('IRDAI does not involve in sale of any insurance product. Verify agent registration on IRDAI website.');
    
    return disclosures;
  }
  
  async acknowledgeAssessment(assessmentId: string, clientId: string): Promise<{ success: boolean; message: string }> {
    const assessment = this.assessmentCache.get(assessmentId);
    
    if (!assessment) {
      return { success: false, message: 'Assessment not found' };
    }
    
    if (assessment.clientId !== clientId) {
      return { success: false, message: 'Client ID mismatch' };
    }
    
    assessment.clientAcknowledgement = true;
    assessment.acknowledgementTimestamp = new Date();
    this.assessmentCache.set(assessmentId, assessment);
    
    return { success: true, message: 'Assessment acknowledged successfully' };
  }
  
  getAssessment(assessmentId: string): InsuranceSuitabilityAssessment | null {
    return this.assessmentCache.get(assessmentId) || null;
  }
  
  getClientAssessments(clientId: string): InsuranceSuitabilityAssessment[] {
    const assessments: InsuranceSuitabilityAssessment[] = [];
    this.assessmentCache.forEach(assessment => {
      if (assessment.clientId === clientId) {
        assessments.push(assessment);
      }
    });
    return assessments.sort((a, b) => b.assessmentDate.getTime() - a.assessmentDate.getTime());
  }
  
  isAssessmentValid(assessmentId: string): boolean {
    const assessment = this.assessmentCache.get(assessmentId);
    if (!assessment) return false;
    return new Date() < assessment.validUntil;
  }
}

export const insuranceSuitabilityService = new InsuranceSuitabilityService();
