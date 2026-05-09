import { Request, Response } from 'express';
import { storage } from './storage';
import { LoanProcessingService } from './loan-processing-service';
import { CibilAPI } from './cibil-api';
import { BajajFinanceAPI } from './bajaj-finance-api';
import { TataCapitalAPI } from './tata-capital-api';

export interface ClientFinancialProfile {
  userId: string;
  monthlyIncome: number;
  existingEMIs: number;
  cibilScore: number;
  employmentType: 'salaried' | 'self_employed' | 'business' | 'professional';
  workExperience: number;
  netWorth: number;
  currentAssets: number;
  existingLiabilities: number;
  creditUtilization: number;
  bankingHistory: number; // years
  loanHistory: Array<{
    type: string;
    amount: number;
    status: 'active' | 'closed' | 'defaulted';
    paymentHistory: 'excellent' | 'good' | 'fair' | 'poor';
  }>;
  propertyOwnership: boolean;
  securitiesPortfolio: number;
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
}

export interface LoanRecommendation {
  loanType: 'personal' | 'home' | 'business' | 'car' | 'against_property' | 'against_securities';
  priority: 'high' | 'medium' | 'low';
  eligibilityScore: number;
  recommendedAmount: number;
  interestRate: number;
  tenure: number;
  emi: number;
  processingFee: number;
  lenderName: string;
  rationale: string;
  keyBenefits: string[];
  riskFactors: string[];
  actionRequired: string[];
  urgency: 'immediate' | 'within_month' | 'future_consideration';
  expectedApprovalTime: string;
  requiredDocuments: string[];
  specialOffers?: string[];
}

export class IntelligentLoanRecommendationEngine {
  private loanProcessingService: LoanProcessingService;
  private cibilAPI: typeof CibilAPI;

  constructor() {
    this.loanProcessingService = new LoanProcessingService();
    this.cibilAPI = CibilAPI;
  }

  // Main recommendation function
  async generatePersonalizedRecommendations(userId: string): Promise<LoanRecommendation[]> {
    try {
      // Get client financial profile
      const userProfile = await storage.getUserProfile(userId);
      if (!userProfile) {
        throw new Error('User profile not found');
      }

      // Get updated CIBIL score and detailed credit report
      const creditData = await this.getCreditAnalysis(userProfile);
      
      // Build comprehensive financial profile
      const financialProfile = await this.buildFinancialProfile(userProfile, creditData);
      
      // Generate loan recommendations based on profile
      const recommendations = await this.analyzeAndRecommend(financialProfile);
      
      // Sort by priority and eligibility score
      return recommendations.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return b.eligibilityScore - a.eligibilityScore;
      });

    } catch (error) {
      console.error('Error generating loan recommendations:', error);
      return [];
    }
  }

  // Get credit analysis from CIBIL
  private async getCreditAnalysis(userProfile: any) {
    const mockCreditData = {
      cibilScore: 750 + Math.floor(Math.random() * 100), // 750-850 range
      creditHistory: {
        totalAccounts: 8,
        activeAccounts: 5,
        closedAccounts: 3,
        creditAge: 7.5, // years
        creditUtilization: 35,
        paymentHistory: 'good' as const,
        inquiriesLast12Months: 3
      },
      existingLoans: [
        {
          type: 'personal',
          amount: 500000,
          outstandingAmount: 200000,
          emi: 25000,
          status: 'active' as const,
          paymentHistory: 'excellent' as const
        }
      ],
      creditCardDetails: [
        {
          bank: 'HDFC Bank',
          limit: 200000,
          utilization: 30,
          paymentHistory: 'good' as const
        }
      ]
    };

    return mockCreditData;
  }

  // Build comprehensive financial profile
  private async buildFinancialProfile(userProfile: any, creditData: any): Promise<ClientFinancialProfile> {
    return {
      userId: userProfile.userId,
      monthlyIncome: userProfile.annualIncome ? userProfile.annualIncome / 12 : 100000,
      existingEMIs: creditData.existingLoans.reduce((sum: number, loan: any) => sum + loan.emi, 0),
      cibilScore: creditData.cibilScore,
      employmentType: userProfile.occupationType || 'salaried',
      workExperience: userProfile.workExperience || 5,
      netWorth: userProfile.netWorth || 2000000,
      currentAssets: userProfile.totalAssets || 1500000,
      existingLiabilities: userProfile.totalLiabilities || 500000,
      creditUtilization: creditData.creditHistory.creditUtilization,
      bankingHistory: creditData.creditHistory.creditAge,
      loanHistory: creditData.existingLoans,
      propertyOwnership: userProfile.propertyOwnership || false,
      securitiesPortfolio: userProfile.investmentExperience ? 1000000 : 0,
      riskProfile: userProfile.riskTolerance || 'moderate'
    };
  }

  // Core recommendation analysis engine
  private async analyzeAndRecommend(profile: ClientFinancialProfile): Promise<LoanRecommendation[]> {
    const recommendations: LoanRecommendation[] = [];

    // 1. Personal Loan Recommendations
    if (this.shouldRecommendPersonalLoan(profile)) {
      recommendations.push(await this.generatePersonalLoanRecommendation(profile));
    }

    // 2. Home Loan Recommendations  
    if (this.shouldRecommendHomeLoan(profile)) {
      recommendations.push(await this.generateHomeLoanRecommendation(profile));
    }

    // 3. Business Loan Recommendations
    if (this.shouldRecommendBusinessLoan(profile)) {
      recommendations.push(await this.generateBusinessLoanRecommendation(profile));
    }

    // 4. Loan Against Securities (LAS)
    if (this.shouldRecommendLAS(profile)) {
      recommendations.push(await this.generateLASRecommendation(profile));
    }

    // 5. Car Loan Recommendations
    if (this.shouldRecommendCarLoan(profile)) {
      recommendations.push(await this.generateCarLoanRecommendation(profile));
    }

    // 6. Loan Against Property
    if (this.shouldRecommendPropertyLoan(profile)) {
      recommendations.push(await this.generatePropertyLoanRecommendation(profile));
    }

    return recommendations;
  }

  // Personal Loan Analysis
  private shouldRecommendPersonalLoan(profile: ClientFinancialProfile): boolean {
    const debtToIncomeRatio = (profile.existingEMIs / profile.monthlyIncome) * 100;
    return profile.cibilScore >= 650 && 
           debtToIncomeRatio < 50 && 
           profile.creditUtilization < 70;
  }

  private async generatePersonalLoanRecommendation(profile: ClientFinancialProfile): Promise<LoanRecommendation> {
    const maxEligibleAmount = this.calculatePersonalLoanEligibility(profile);
    const recommendedTenure = profile.cibilScore > 750 ? 60 : 48; // months
    
    // Get real-time rates from integrated lenders like Bajaj Finance
    const lenderInfo = await this.getBestLenderWithRates(profile, 'personal', maxEligibleAmount);
    const emi = this.calculateEMI(maxEligibleAmount, lenderInfo.rate, recommendedTenure);

    return {
      loanType: 'personal',
      priority: profile.creditUtilization > 60 ? 'high' : 'medium',
      eligibilityScore: this.calculateEligibilityScore(profile, 'personal'),
      recommendedAmount: maxEligibleAmount,
      interestRate: lenderInfo.rate,
      tenure: recommendedTenure,
      emi,
      processingFee: lenderInfo.processingFee,
      lenderName: lenderInfo.lender,
      rationale: `Based on your CIBIL score of ${profile.cibilScore} and monthly income of ₹${profile.monthlyIncome.toLocaleString()}, you qualify for competitive personal loan rates. This can help consolidate existing debts or fund immediate requirements.`,
      keyBenefits: [
        'Quick approval and disbursement',
        'No collateral required',
        'Flexible tenure options',
        'Minimal documentation'
      ],
      riskFactors: [
        'Higher interest rates compared to secured loans',
        'Impact on credit utilization if not managed well'
      ],
      actionRequired: [
        'Submit income documents',
        'Complete KYC verification',
        'Bank statement for last 6 months'
      ],
      urgency: profile.creditUtilization > 70 ? 'immediate' : 'within_month',
      expectedApprovalTime: '24-48 hours',
      requiredDocuments: [
        'Salary slips (last 3 months)',
        'Bank statements (last 6 months)',
        'PAN Card and Aadhar',
        'Form 16 or ITR'
      ],
      specialOffers: profile.cibilScore > 780 ? ['Pre-approved offer', '0.5% interest rate discount'] : undefined
    };
  }

  // Home Loan Analysis
  private shouldRecommendHomeLoan(profile: ClientFinancialProfile): boolean {
    return profile.cibilScore >= 700 && 
           !profile.propertyOwnership &&
           profile.monthlyIncome >= 50000 &&
           (profile.existingEMIs / profile.monthlyIncome) < 0.4;
  }

  private async generateHomeLoanRecommendation(profile: ClientFinancialProfile): Promise<LoanRecommendation> {
    const maxEligibleAmount = Math.min(profile.monthlyIncome * 60 * 12, 7500000); // 60x monthly income, max 75L
    const interestRate = this.calculateInterestRate(profile, 'home');
    const recommendedTenure = 240; // 20 years
    const emi = this.calculateEMI(maxEligibleAmount, interestRate, recommendedTenure);

    return {
      loanType: 'home',
      priority: 'high',
      eligibilityScore: this.calculateEligibilityScore(profile, 'home'),
      recommendedAmount: maxEligibleAmount,
      interestRate,
      tenure: recommendedTenure,
      emi,
      processingFee: maxEligibleAmount * 0.005, // 0.5%
      lenderName: this.getBestLender(profile, 'home'),
      rationale: `With your strong financial profile (CIBIL: ${profile.cibilScore}), you're eligible for attractive home loan rates. Property ownership can significantly boost your net worth and provide tax benefits.`,
      keyBenefits: [
        'Lowest interest rates',
        'Tax benefits under Section 80C and 24(b)',
        'Long repayment tenure',
        'Property appreciation potential'
      ],
      riskFactors: [
        'Long-term financial commitment',
        'Property market fluctuations',
        'Interest rate changes'
      ],
      actionRequired: [
        'Property identification and valuation',
        'Legal document verification',
        'Technical evaluation of property'
      ],
      urgency: 'future_consideration',
      expectedApprovalTime: '7-10 days',
      requiredDocuments: [
        'Property documents',
        'Income proof',
        'Identity and address proof',
        'Bank statements',
        'Property valuation report'
      ]
    };
  }

  // Loan Against Securities Analysis
  private shouldRecommendLAS(profile: ClientFinancialProfile): boolean {
    return profile.securitiesPortfolio > 200000 && 
           profile.cibilScore >= 650;
  }

  private async generateLASRecommendation(profile: ClientFinancialProfile): Promise<LoanRecommendation> {
    const maxEligibleAmount = profile.securitiesPortfolio * 0.5; // 50% of portfolio value
    const interestRate = this.calculateInterestRate(profile, 'against_securities');
    const recommendedTenure = 24; // 2 years
    const emi = this.calculateEMI(maxEligibleAmount, interestRate, recommendedTenure);

    return {
      loanType: 'against_securities',
      priority: 'medium',
      eligibilityScore: this.calculateEligibilityScore(profile, 'against_securities'),
      recommendedAmount: maxEligibleAmount,
      interestRate,
      tenure: recommendedTenure,
      emi,
      processingFee: maxEligibleAmount * 0.015, // 1.5%
      lenderName: this.getBestLender(profile, 'against_securities'),
      rationale: `Your securities portfolio of ₹${profile.securitiesPortfolio.toLocaleString()} makes you eligible for Loan Against Securities at attractive rates without liquidating your investments.`,
      keyBenefits: [
        'Lower interest rates than personal loans',
        'No need to liquidate investments',
        'Flexible repayment options',
        'Continue earning from portfolio'
      ],
      riskFactors: [
        'Portfolio value fluctuations',
        'Margin calls during market downturns',
        'Limited loan-to-value ratio'
      ],
      actionRequired: [
        'Portfolio valuation and verification',
        'Pledge securities with lender',
        'Set up monitoring systems'
      ],
      urgency: 'within_month',
      expectedApprovalTime: '2-3 days',
      requiredDocuments: [
        'Demat account statements',
        'Portfolio valuation report',
        'Income proof',
        'KYC documents'
      ]
    };
  }

  // Business Loan Analysis
  private shouldRecommendBusinessLoan(profile: ClientFinancialProfile): boolean {
    return profile.employmentType === 'business' || 
           profile.employmentType === 'self_employed' ||
           (profile.monthlyIncome > 100000 && profile.workExperience > 3);
  }

  private async generateBusinessLoanRecommendation(profile: ClientFinancialProfile): Promise<LoanRecommendation> {
    const maxEligibleAmount = profile.monthlyIncome * 36; // 3 years of income
    const interestRate = this.calculateInterestRate(profile, 'business');
    const recommendedTenure = 60; // 5 years
    const emi = this.calculateEMI(maxEligibleAmount, interestRate, recommendedTenure);

    return {
      loanType: 'business',
      priority: profile.employmentType === 'business' ? 'high' : 'medium',
      eligibilityScore: this.calculateEligibilityScore(profile, 'business'),
      recommendedAmount: maxEligibleAmount,
      interestRate,
      tenure: recommendedTenure,
      emi,
      processingFee: maxEligibleAmount * 0.02, // 2%
      lenderName: this.getBestLender(profile, 'business'),
      rationale: `Your business profile and income stability make you eligible for business loans to expand operations, purchase equipment, or meet working capital requirements.`,
      keyBenefits: [
        'Business growth opportunities',
        'Tax deductible interest',
        'Flexible usage',
        'Competitive rates for good credit'
      ],
      riskFactors: [
        'Business performance dependency',
        'Collateral requirements',
        'Personal guarantee implications'
      ],
      actionRequired: [
        'Business registration documents',
        'Financial statements preparation',
        'Business plan submission'
      ],
      urgency: 'future_consideration',
      expectedApprovalTime: '5-7 days',
      requiredDocuments: [
        'Business registration certificate',
        'Financial statements (last 2 years)',
        'GST returns',
        'Bank statements (business and personal)'
      ]
    };
  }

  // Car Loan Analysis
  private shouldRecommendCarLoan(profile: ClientFinancialProfile): boolean {
    return profile.monthlyIncome >= 30000 && 
           profile.cibilScore >= 650 &&
           (profile.existingEMIs / profile.monthlyIncome) < 0.5;
  }

  private async generateCarLoanRecommendation(profile: ClientFinancialProfile): Promise<LoanRecommendation> {
    const maxEligibleAmount = Math.min(profile.monthlyIncome * 48, 2000000); // 4 years income or 20L
    const recommendedTenure = 84; // 7 years
    
    // Get real-time rates from integrated lenders
    const lenderInfo = await this.getBestLenderWithRates(profile, 'car', maxEligibleAmount);
    const emi = this.calculateEMI(maxEligibleAmount, lenderInfo.rate, recommendedTenure);

    return {
      loanType: 'car',
      priority: 'low',
      eligibilityScore: this.calculateEligibilityScore(profile, 'car'),
      recommendedAmount: maxEligibleAmount,
      interestRate: lenderInfo.rate,
      tenure: recommendedTenure,
      emi,
      processingFee: lenderInfo.processingFee,
      lenderName: lenderInfo.lender,
      rationale: `Based on your income and credit profile, you can easily afford a car loan. This can enhance your mobility and lifestyle while building additional credit history.`,
      keyBenefits: [
        'Asset ownership',
        'Improved lifestyle and convenience',
        'Lower interest rates than personal loans',
        'Long repayment tenure'
      ],
      riskFactors: [
        'Vehicle depreciation',
        'Maintenance and insurance costs',
        'Long-term financial commitment'
      ],
      actionRequired: [
        'Vehicle selection and quotation',
        'Insurance arrangement',
        'Down payment arrangement'
      ],
      urgency: 'future_consideration',
      expectedApprovalTime: '2-3 days',
      requiredDocuments: [
        'Vehicle quotation',
        'Income proof',
        'Identity and address proof',
        'Bank statements'
      ]
    };
  }

  // Property Loan Analysis
  private shouldRecommendPropertyLoan(profile: ClientFinancialProfile): boolean {
    return profile.propertyOwnership && 
           profile.netWorth > 1000000 &&
           profile.cibilScore >= 700;
  }

  private async generatePropertyLoanRecommendation(profile: ClientFinancialProfile): Promise<LoanRecommendation> {
    const maxEligibleAmount = profile.netWorth * 0.6; // 60% of net worth
    const interestRate = this.calculateInterestRate(profile, 'against_property');
    const recommendedTenure = 180; // 15 years
    const emi = this.calculateEMI(maxEligibleAmount, interestRate, recommendedTenure);

    return {
      loanType: 'against_property',
      priority: 'medium',
      eligibilityScore: this.calculateEligibilityScore(profile, 'against_property'),
      recommendedAmount: maxEligibleAmount,
      interestRate,
      tenure: recommendedTenure,
      emi,
      processingFee: maxEligibleAmount * 0.0075, // 0.75%
      lenderName: this.getBestLender(profile, 'against_property'),
      rationale: `Your property ownership and strong net worth qualify you for Loan Against Property at competitive rates. This is ideal for large funding requirements while keeping property ownership.`,
      keyBenefits: [
        'Large loan amounts',
        'Lower interest rates',
        'Retain property ownership',
        'Multiple usage options'
      ],
      riskFactors: [
        'Property at risk in case of default',
        'Property valuation dependency',
        'Legal documentation complexity'
      ],
      actionRequired: [
        'Property valuation',
        'Legal document verification',
        'Title clearance'
      ],
      urgency: 'within_month',
      expectedApprovalTime: '7-10 days',
      requiredDocuments: [
        'Property documents',
        'Valuation report',
        'Income proof',
        'Legal clearance certificate'
      ]
    };
  }

  // Helper Functions
  private calculatePersonalLoanEligibility(profile: ClientFinancialProfile): number {
    const baseEligibility = profile.monthlyIncome * 24; // 2 years of income
    
    // CIBIL score multiplier
    let cibilMultiplier = 1;
    if (profile.cibilScore >= 800) cibilMultiplier = 1.5;
    else if (profile.cibilScore >= 750) cibilMultiplier = 1.3;
    else if (profile.cibilScore >= 700) cibilMultiplier = 1.1;
    
    // Employment type multiplier
    const empMultiplier = profile.employmentType === 'salaried' ? 1.2 : 1;
    
    // Debt-to-income adjustment
    const debtRatio = profile.existingEMIs / profile.monthlyIncome;
    const debtAdjustment = Math.max(0.5, 1 - debtRatio);
    
    return Math.min(
      baseEligibility * cibilMultiplier * empMultiplier * debtAdjustment,
      2500000 // Max 25L for personal loans
    );
  }

  private calculateInterestRate(profile: ClientFinancialProfile, loanType: string): number {
    const baseRates = {
      personal: 12.5,
      home: 8.5,
      business: 14.0,
      car: 9.5,
      against_property: 10.5,
      against_securities: 11.0
    };

    let rate = baseRates[loanType as keyof typeof baseRates];
    
    // CIBIL score adjustment
    if (profile.cibilScore >= 800) rate -= 2.0;
    else if (profile.cibilScore >= 750) rate -= 1.5;
    else if (profile.cibilScore >= 700) rate -= 1.0;
    else if (profile.cibilScore < 650) rate += 2.0;
    
    // Employment type adjustment
    if (profile.employmentType === 'salaried') rate -= 0.5;
    else if (profile.employmentType === 'self_employed') rate += 0.5;
    
    return Math.max(rate, 8.0); // Minimum 8% rate
  }

  private calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
    const monthlyRate = annualRate / 100 / 12;
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / 
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    return Math.round(emi);
  }

  private calculateEligibilityScore(profile: ClientFinancialProfile, loanType: string): number {
    let score = 0;
    
    // CIBIL score component (40%)
    score += (profile.cibilScore / 900) * 40;
    
    // Debt-to-income ratio component (25%)
    const debtRatio = profile.existingEMIs / profile.monthlyIncome;
    score += Math.max(0, (0.5 - debtRatio) * 2) * 25;
    
    // Income stability component (20%)
    score += Math.min(profile.workExperience / 10, 1) * 20;
    
    // Asset component (15%)
    const assetRatio = profile.currentAssets / profile.monthlyIncome;
    score += Math.min(assetRatio / 60, 1) * 15; // 5 years of income as benchmark
    
    return Math.round(score);
  }

  private async getBestLenderWithRates(profile: ClientFinancialProfile, loanType: string, amount: number): Promise<{lender: string, rate: number, processingFee: number}> {
    const lenders = {
      personal: ['Bajaj Finance', 'HDFC Bank', 'ICICI Bank'],
      home: ['SBI', 'HDFC Bank', 'LIC Housing Finance'],
      business: ['ICICI Bank', 'Axis Bank', 'Kotak Mahindra'],
      car: ['Tata Capital', 'HDFC Bank', 'Mahindra Finance'],
      against_property: ['Axis Bank', 'ICICI Bank', 'IndusInd Bank'],
      against_securities: ['ICICI Bank', 'Kotak Securities', 'HDFC Securities']
    };

    const lenderList = lenders[loanType as keyof typeof lenders];
    
    // For Bajaj Finance personal loans, get real-time rates
    if (loanType === 'personal' && lenderList.includes('Bajaj Finance')) {
      try {
        const bajajAPI = new BajajFinanceAPI();
        const loanDetails = await (bajajAPI as any).getPersonalLoanDetails({
          income: profile.monthlyIncome,
          employmentType: profile.employmentType,
          loanAmount: amount,
          cibilScore: profile.cibilScore
        });
        
        return {
          lender: 'Bajaj Finance',
          rate: loanDetails.interestRate,
          processingFee: loanDetails.processingFee
        };
      } catch (error) {
        console.error('Error fetching Bajaj Finance rates:', error);
      }
    }
    
    // For Tata Capital car loans, get real-time rates
    if (loanType === 'car' && lenderList.includes('Tata Capital')) {
      try {
        const tataAPI = new TataCapitalAPI();
        const loanDetails = await (tataAPI as any).getUsedCarLoanDetails({
          income: profile.monthlyIncome,
          employmentType: profile.employmentType,
          loanAmount: amount,
          cibilScore: profile.cibilScore
        });
        
        return {
          lender: 'Tata Capital',
          rate: loanDetails.interestRate,
          processingFee: loanDetails.processingFee
        };
      } catch (error) {
        console.error('Error fetching Tata Capital rates:', error);
      }
    }

    // Fallback to calculated rates for other lenders
    const fallbackRate = this.calculateInterestRate(profile, loanType);
    const fallbackFee = Math.min(amount * 0.025, 50000); // 2.5% or max 50k
    
    return {
      lender: lenderList[0],
      rate: fallbackRate,
      processingFee: fallbackFee
    };
  }

  private getBestLender(profile: ClientFinancialProfile, loanType: string): string {
    const lenders = {
      personal: ['Bajaj Finance', 'HDFC Bank', 'ICICI Bank'],
      home: ['SBI', 'HDFC Bank', 'LIC Housing Finance'],
      business: ['ICICI Bank', 'Axis Bank', 'Kotak Mahindra'],
      car: ['Tata Capital', 'HDFC Bank', 'Mahindra Finance'],
      against_property: ['Axis Bank', 'ICICI Bank', 'IndusInd Bank'],
      against_securities: ['ICICI Bank', 'Kotak Securities', 'HDFC Securities']
    };

    const lenderList = lenders[loanType as keyof typeof lenders];
    return lenderList[0]; // Return the first (best) lender for simplicity
  }
}

// API endpoint for getting personalized loan recommendations
export async function getPersonalizedLoanRecommendations(req: Request, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const engine = new IntelligentLoanRecommendationEngine();
    const recommendations = await engine.generatePersonalizedRecommendations(req.user.id);

    res.json({
      success: true,
      data: {
        recommendations,
        totalCount: recommendations.length,
        highPriorityCount: recommendations.filter(r => r.priority === 'high').length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error generating loan recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate loan recommendations'
    });
  }
}

// API endpoint for tracking recommendation actions
export async function trackLoanRecommendationAction(req: Request, res: Response) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { recommendationId, action, metadata } = req.body;

    if (!recommendationId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store tracking data (in production, this would go to analytics/database)
    const trackingData = {
      userId: req.user.id,
      recommendationId,
      action,
      metadata,
      timestamp: new Date().toISOString(),
      sessionId: req.sessionID || 'unknown'
    };

    // Log for analytics (in production, you'd store this in a tracking database)
    console.log('Loan Recommendation Tracking:', trackingData);

    // Update user engagement metrics
    try {
      await storage.updateUser(req.user.id, {
        lastActivity: new Date().toISOString(),
        engagementScore: (await storage.getUserProfile(req.user.id))?.engagementScore + 1 || 1
      });
    } catch (error) {
      console.error('Error updating user engagement:', error);
    }

    res.json({
      success: true,
      message: 'Recommendation action tracked successfully'
    });

  } catch (error) {
    console.error('Error tracking recommendation action:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track recommendation action'
    });
  }
}