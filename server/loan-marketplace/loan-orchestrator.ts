// Loan Orchestrator Service
// Central service that coordinates loan offers from multiple providers
// Manages the entire loan marketplace workflow

import { 
  LoanOfferRequest, 
  LoanOfferResponse, 
  ProviderLoanOffer,
  LoanProviderAdapter,
  providerRegistry 
} from './provider-adapter';
import { 
  LoanProduct,
  LoanProvider,
  ProviderProduct,
  CreditProfile,
  LoanRequest,
  LoanOffer,
  LoanApplicationMarketplace,
  InsertLoanRequest,
  InsertLoanOffer,
  InsertLoanApplicationMarketplace
} from '@shared/schema';
import { storage } from '../storage';

// Orchestrator response with ranked offers
export interface OrchestatedOfferResponse {
  success: boolean;
  requestId: string;
  totalOffers: number;
  offers: RankedLoanOffer[];
  bestOffer?: RankedLoanOffer;
  metadata: {
    providersQueried: number;
    providersResponded: number;
    avgResponseTime: number;
    timestamp: Date;
  };
  errors?: string[];
  warnings?: string[];
}

export interface RankedLoanOffer extends ProviderLoanOffer {
  id: string; // Database ID for the offer
  rank: number; // 1 = best offer
  reasonsForRanking: string[];
  competitiveAdvantages: string[];
  potentialDisadvantages: string[];
  recommendationScore: number; // 0-100
}

// Orchestrator configuration
export interface OrchestratorConfig {
  maxConcurrentProviders: number;
  requestTimeoutMs: number;
  minOffersRequired: number;
  enableAsyncProcessing: boolean;
  qualityWeights: {
    interestRate: number;
    processingFee: number;
    approvalProbability: number;
    providerReputation: number;
    disbursalSpeed: number;
  };
}

export class LoanOrchestrator {
  private config: OrchestratorConfig;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      maxConcurrentProviders: 10,
      requestTimeoutMs: 30000, // 30 seconds
      minOffersRequired: 1,
      enableAsyncProcessing: true,
      qualityWeights: {
        interestRate: 0.3,
        processingFee: 0.2,
        approvalProbability: 0.2,
        providerReputation: 0.15,
        disbursalSpeed: 0.15
      },
      ...config
    };
  }

  // Main orchestration method - generates offers from all suitable providers
  async orchestrateOffers(
    userId: string,
    productKey: string,
    requestedAmount: number,
    preferredTenure: number,
    purpose?: string,
    collateralDetails?: any
  ): Promise<OrchestatedOfferResponse> {
    const startTime = Date.now();
    
    try {
      // 1. Get user's credit profile
      const creditProfile = await this.getCreditProfile(userId);
      if (!creditProfile) {
        return {
          success: false,
          requestId: '',
          totalOffers: 0,
          offers: [],
          metadata: {
            providersQueried: 0,
            providersResponded: 0,
            avgResponseTime: 0,
            timestamp: new Date()
          },
          errors: ['Credit profile not found. Please complete your profile first.']
        };
      }

      // 2. Create loan request record
      const loanRequest = await this.createLoanRequest({
        userId,
        productKey,
        requestedAmount,
        preferredTenure,
        purpose,
        collateralDetails
      });

      // 3. Get suitable providers for this product
      const suitableProviders = await this.getSuitableProviders(productKey, requestedAmount, creditProfile);
      
      if (suitableProviders.length === 0) {
        return {
          success: false,
          requestId: loanRequest.id,
          totalOffers: 0,
          offers: [],
          metadata: {
            providersQueried: 0,
            providersResponded: 0,
            avgResponseTime: 0,
            timestamp: new Date()
          },
          warnings: ['No suitable providers found for your requirements']
        };
      }

      // 4. Prepare offer request
      const offerRequest: LoanOfferRequest = {
        userId,
        productKey,
        requestedAmount,
        preferredTenure,
        purpose,
        collateralDetails,
        creditProfile,
        urgency: 'within_week', // Default
        sourceChannel: 'web'
      };

      // 5. Generate offers from providers concurrently
      const providerOffers = await this.generateOffersFromProviders(suitableProviders, offerRequest);

      // 6. Process and rank offers
      const rankedOffers = await this.rankOffers(providerOffers, loanRequest.id);

      // 7. Store offers in database
      await this.storeOffers(rankedOffers, loanRequest.id);

      const endTime = Date.now();
      const avgResponseTime = endTime - startTime;

      return {
        success: true,
        requestId: loanRequest.id,
        totalOffers: rankedOffers.length,
        offers: rankedOffers,
        bestOffer: rankedOffers[0], // First offer is the best
        metadata: {
          providersQueried: suitableProviders.length,
          providersResponded: providerOffers.filter(o => o.success && o.offers.length > 0).length,
          avgResponseTime,
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('Orchestration failed:', error);
      return {
        success: false,
        requestId: '',
        totalOffers: 0,
        offers: [],
        metadata: {
          providersQueried: 0,
          providersResponded: 0,
          avgResponseTime: Date.now() - startTime,
          timestamp: new Date()
        },
        errors: ['Internal error while processing loan request']
      };
    }
  }

  // Get user's credit profile
  private async getCreditProfile(userId: string): Promise<CreditProfile | null> {
    try {
      return (await storage.getCreditProfile(userId)) ?? null;
    } catch (error) {
      console.error('Error fetching credit profile:', error);
      return null;
    }
  }

  // Create loan request record
  private async createLoanRequest(data: {
    userId: string;
    productKey: string;
    requestedAmount: number;
    preferredTenure: number;
    purpose?: string;
    collateralDetails?: any;
  }): Promise<LoanRequest> {
    // Find the product
    const product = await storage.getLoanProductByKey(data.productKey);
    if (!product) {
      throw new Error(`Product not found: ${data.productKey}`);
    }

    const requestData: InsertLoanRequest = ({} as InsertLoanRequest & Record<string, any>) && {
      userId: data.userId,
      productId: product.id,
      requestedAmount: data.requestedAmount.toString(),
      preferredTenure: data.preferredTenure,
      purpose: data.purpose,
      collateralDetails: data.collateralDetails,
      estimatedCollateralValue: data.collateralDetails?.estimatedValue?.toString()
    };

    return await storage.createLoanRequest(requestData);
  }

  // Get suitable providers for the loan request
  private async getSuitableProviders(
    productKey: string,
    requestedAmount: number,
    creditProfile: CreditProfile
  ): Promise<Array<{ provider: LoanProvider; adapter: LoanProviderAdapter; products: ProviderProduct[] }>> {
    const activeProviders = providerRegistry.getActiveProviders(productKey);
    const suitableProviders = [];

    for (const { provider, adapter, integration } of activeProviders) {
      try {
        // Get provider's products for this loan type
        const providerProducts = await storage.getProviderProductsByProvider(provider.id, productKey);
        
        if (providerProducts.length === 0) continue;

        // Check basic eligibility
        const isEligible = this.checkBasicEligibility(providerProducts, requestedAmount, creditProfile);
        
        if (isEligible) {
          suitableProviders.push({
            provider,
            adapter,
            products: providerProducts
          });
        }
      } catch (error) {
        console.error(`Error evaluating provider ${provider.providerName}:`, error);
        // Continue with other providers
      }
    }

    return suitableProviders;
  }

  // Basic eligibility check
  private checkBasicEligibility(
    products: ProviderProduct[],
    requestedAmount: number,
    creditProfile: CreditProfile
  ): boolean {
    return products.some(product => {
      // Amount check
      const minAmount = product.minAmount ? parseFloat(product.minAmount.toString()) : 0;
      const maxAmount = product.maxAmount ? parseFloat(product.maxAmount.toString()) : Infinity;
      
      if (requestedAmount < minAmount || requestedAmount > maxAmount) {
        return false;
      }

      // CIBIL score check (basic)
      const cibilScore = creditProfile.cibilScore || 0;
      if (cibilScore > 0 && cibilScore < 650) { // Minimum acceptable score
        return false;
      }

      return true;
    });
  }

  // Generate offers from multiple providers concurrently
  private async generateOffersFromProviders(
    providers: Array<{ provider: LoanProvider; adapter: LoanProviderAdapter; products: ProviderProduct[] }>,
    request: LoanOfferRequest
  ): Promise<LoanOfferResponse[]> {
    const promises = providers.map(({ provider, adapter, products }) => 
      this.getOfferFromProvider(adapter, request)
        .catch(error => {
          console.error(`Error from provider ${provider.providerName}:`, error);
          return {
            success: false,
            offers: [],
            errors: [error.message || 'Provider error']
          } as LoanOfferResponse;
        })
    );

    // Use Promise.allSettled to handle partial failures
    const results = await Promise.allSettled(promises);
    
    return results.map(result => 
      result.status === 'fulfilled' 
        ? result.value 
        : { success: false, offers: [], errors: ['Provider timeout or error'] }
    );
  }

  // Get offer from a specific provider with timeout
  private async getOfferFromProvider(
    adapter: LoanProviderAdapter,
    request: LoanOfferRequest
  ): Promise<LoanOfferResponse> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Provider request timeout'));
      }, this.config.requestTimeoutMs);

      try {
        const response = await adapter.generateOffers(request);
        clearTimeout(timeout);
        resolve(response);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // Rank and score offers
  private async rankOffers(
    providerResponses: LoanOfferResponse[],
    requestId: string
  ): Promise<RankedLoanOffer[]> {
    const allOffers: ProviderLoanOffer[] = [];
    
    // Collect all offers from successful responses
    for (const response of providerResponses) {
      if (response.success && response.offers) {
        allOffers.push(...response.offers);
      }
    }

    if (allOffers.length === 0) {
      return [];
    }

    // Calculate recommendation scores
    const scoredOffers = allOffers.map(offer => {
      const score = this.calculateRecommendationScore(offer, allOffers);
      return {
        ...offer,
        recommendationScore: score
      };
    });

    // Sort by recommendation score (highest first)
    const sortedOffers = scoredOffers.sort((a, b) => b.recommendationScore - a.recommendationScore);

    // Convert to ranked offers
    const rankedOffers: RankedLoanOffer[] = sortedOffers.map((offer, index) => ({
      ...offer,
      id: '', // Will be set when stored in DB
      rank: index + 1,
      reasonsForRanking: this.generateRankingReasons(offer, index === 0, allOffers),
      competitiveAdvantages: this.identifyAdvantages(offer, allOffers),
      potentialDisadvantages: this.identifyDisadvantages(offer, allOffers)
    }));

    return rankedOffers;
  }

  // Calculate recommendation score for an offer
  private calculateRecommendationScore(offer: ProviderLoanOffer, allOffers: ProviderLoanOffer[]): number {
    let score = 0;
    const weights = this.config.qualityWeights;

    // Interest rate score (lower is better)
    const interestRates = allOffers.map(o => o.interestRate);
    const minRate = Math.min(...interestRates);
    const maxRate = Math.max(...interestRates);
    const rateScore = maxRate === minRate ? 100 : ((maxRate - offer.interestRate) / (maxRate - minRate)) * 100;
    score += rateScore * weights.interestRate;

    // Processing fee score (lower is better)
    const processingFees = allOffers.map(o => (o.processingFee / o.approvedAmount) * 100);
    const minFee = Math.min(...processingFees);
    const maxFee = Math.max(...processingFees);
    const currentFeePercent = (offer.processingFee / offer.approvedAmount) * 100;
    const feeScore = maxFee === minFee ? 100 : ((maxFee - currentFeePercent) / (maxFee - minFee)) * 100;
    score += feeScore * weights.processingFee;

    // Approval probability score
    score += offer.approvalProbability * weights.approvalProbability;

    // Provider reputation (can be enhanced with actual provider ratings)
    score += 75 * weights.providerReputation; // Default reputation score

    // Disbursal speed score (can be enhanced with actual timing data)
    const disbursalScore = offer.expectedDisbursalTime.includes('24 hours') ? 100 :
                          offer.expectedDisbursalTime.includes('2-3 days') ? 80 :
                          offer.expectedDisbursalTime.includes('week') ? 60 : 40;
    score += disbursalScore * weights.disbursalSpeed;

    return Math.round(score);
  }

  // Generate reasons for ranking
  private generateRankingReasons(offer: ProviderLoanOffer, isBest: boolean, allOffers: ProviderLoanOffer[]): string[] {
    const reasons: string[] = [];

    if (isBest) {
      reasons.push('Best overall value based on our analysis');
    }

    // Interest rate comparison
    const sortedByRate = allOffers.sort((a, b) => a.interestRate - b.interestRate);
    const rateRank = sortedByRate.findIndex(o => o.providerId === offer.providerId) + 1;
    
    if (rateRank === 1) {
      reasons.push('Lowest interest rate available');
    } else if (rateRank <= 3) {
      reasons.push('Competitive interest rate');
    }

    // Processing fee
    const feePercent = (offer.processingFee / offer.approvedAmount) * 100;
    if (feePercent <= 1) {
      reasons.push('Low processing fee');
    }

    // High approval probability
    if (offer.approvalProbability >= 90) {
      reasons.push('High approval probability');
    }

    // Special offers
    if (offer.specialOffers && offer.specialOffers.length > 0) {
      reasons.push('Includes special offers and benefits');
    }

    return reasons;
  }

  // Identify competitive advantages
  private identifyAdvantages(offer: ProviderLoanOffer, allOffers: ProviderLoanOffer[]): string[] {
    const advantages: string[] = [];

    // Compare with other offers
    const avgRate = allOffers.reduce((sum, o) => sum + o.interestRate, 0) / allOffers.length;
    if (offer.interestRate < avgRate) {
      advantages.push(`Interest rate ${(avgRate - offer.interestRate).toFixed(2)}% below average`);
    }

    const avgFee = allOffers.reduce((sum, o) => sum + (o.processingFee / o.approvedAmount * 100), 0) / allOffers.length;
    const offerFeePercent = (offer.processingFee / offer.approvedAmount) * 100;
    if (offerFeePercent < avgFee) {
      advantages.push(`Processing fee ${(avgFee - offerFeePercent).toFixed(2)}% below average`);
    }

    if (offer.specialOffers && offer.specialOffers.length > 0) {
      advantages.push(...offer.specialOffers);
    }

    return advantages;
  }

  // Identify potential disadvantages
  private identifyDisadvantages(offer: ProviderLoanOffer, allOffers: ProviderLoanOffer[]): string[] {
    const disadvantages: string[] = [];

    // Compare with best offers
    const bestRate = Math.min(...allOffers.map(o => o.interestRate));
    if (offer.interestRate > bestRate) {
      const diff = offer.interestRate - bestRate;
      if (diff > 1) {
        disadvantages.push(`Interest rate ${diff.toFixed(2)}% higher than best available`);
      }
    }

    const minFee = Math.min(...allOffers.map(o => (o.processingFee / o.approvedAmount) * 100));
    const offerFeePercent = (offer.processingFee / offer.approvedAmount) * 100;
    if (offerFeePercent > minFee + 0.5) {
      disadvantages.push('Higher processing fee than some competitors');
    }

    if (offer.approvalProbability < 80) {
      disadvantages.push('Lower approval probability');
    }

    return disadvantages;
  }

  // Store offers in database
  private async storeOffers(rankedOffers: RankedLoanOffer[], requestId: string): Promise<void> {
    for (const offer of rankedOffers) {
      try {
        const offerData: InsertLoanOffer = {
          requestId,
          providerId: offer.providerId,
          productId: '', // Will need to resolve this
          approvedAmount: offer.approvedAmount.toString(),
          interestRate: offer.interestRate.toString(),
          tenure: offer.tenure,
          emi: offer.emi.toString(),
          processingFee: offer.processingFee.toString(),
          legalCharges: (offer.legalCharges || 0).toString(),
          otherCharges: (offer.otherCharges || 0).toString(),
          totalCost: offer.totalCost.toString(),
          eligibilityScore: offer.eligibilityScore.toString(),
          qualityScore: offer.qualityScore.toString(),
          approvalProbability: offer.approvalProbability.toString(),
          offerSource: offer.offerSource,
          rateType: offer.rateType,
          ltvRatio: offer.ltvRatio?.toString(),
          terms: offer.terms,
          specialOffers: offer.specialOffers,
          validUntil: new Date(Date.now() + (offer.validityDays * 24 * 60 * 60 * 1000))
        };

        const savedOffer = await storage.createLoanOffer(offerData);
        offer.id = savedOffer.id;
      } catch (error) {
        console.error('Error storing offer:', error);
      }
    }
  }

  // Get offers for a specific request
  async getOffersForRequest(requestId: string): Promise<RankedLoanOffer[]> {
    try {
      const offers = await storage.getLoanOffersByRequest(requestId);
      
      // Convert to ranked offers (assuming they're already sorted by rank)
      return offers.map((offer, index) => ({
        ...offer,
        providerId: offer.providerId,
        providerName: '', // Will need to populate from provider data
        productKey: '',
        productName: '',
        approvedAmount: parseFloat(offer.approvedAmount),
        interestRate: parseFloat(offer.interestRate),
        tenure: offer.tenure,
        emi: parseFloat(offer.emi),
        processingFee: parseFloat(offer.processingFee),
        legalCharges: parseFloat(offer.legalCharges || '0'),
        otherCharges: parseFloat(offer.otherCharges || '0'),
        totalCost: parseFloat(offer.totalCost),
        eligibilityScore: parseFloat(offer.eligibilityScore ?? '0'),
        approvalProbability: parseFloat(offer.approvalProbability ?? '0'),
        qualityScore: parseFloat(offer.qualityScore ?? '0'),
        offerSource: offer.offerSource as 'api' | 'rules_engine',
        rateType: offer.rateType as 'fixed' | 'floating' | 'hybrid',
        ltvRatio: offer.ltvRatio ? parseFloat(offer.ltvRatio) : undefined,
        validityDays: Math.ceil((new Date(offer.validUntil).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
        terms: offer.terms as string[],
        specialOffers: offer.specialOffers as string[],
        documentsRequired: [],
        expectedDisbursalTime: '2-3 days',
        rank: index + 1,
        reasonsForRanking: [],
        competitiveAdvantages: [],
        potentialDisadvantages: [],
        recommendationScore: parseFloat(offer.qualityScore)
      }));
    } catch (error) {
      console.error('Error fetching offers:', error);
      return [];
    }
  }

  // ==================== Product & Provider Methods ====================
  
  // Get all loan products with their details
  getLoanProducts(): LoanProductData[] {
    return LOAN_PRODUCTS;
  }

  // Get a specific loan product by key
  getLoanProduct(productKey: string): LoanProductData | undefined {
    return LOAN_PRODUCTS.find(p => p.productKey === productKey);
  }

  // Get all loan providers with their details
  getLoanProviders(): LoanProviderData[] {
    return LOAN_PROVIDERS;
  }

  // Get a specific loan provider by key
  getLoanProvider(providerKey: string): LoanProviderData | undefined {
    return LOAN_PROVIDERS.find(p => p.providerKey === providerKey);
  }

  // Get products offered by a specific provider
  getProviderProducts(providerKey: string): ProviderProductOffering[] | undefined {
    const provider = LOAN_PROVIDERS.find(p => p.providerKey === providerKey);
    if (!provider) return undefined;
    
    return provider.products;
  }

  // Get all providers offering a specific product
  getProductProviders(productKey: string): LoanProviderData[] {
    return LOAN_PROVIDERS.filter(p => 
      p.products.some(prod => prod.productKey === productKey && prod.isActive)
    );
  }

  // ==================== EMI Calculator ====================
  
  calculateEMI(principal: number, annualRate: number, tenureMonths: number): EMICalculation {
    // Handle edge cases to prevent NaN
    if (tenureMonths <= 0) {
      return {
        emi: 0,
        totalPayment: 0,
        totalInterest: 0,
        principal,
        interestRate: annualRate,
        tenureMonths,
        schedule: []
      };
    }
    
    if (annualRate <= 0) {
      // Zero interest case - simple division
      const emi = principal / tenureMonths;
      const schedule: AmortizationEntry[] = [];
      let balance = principal;
      
      for (let month = 1; month <= tenureMonths; month++) {
        const principalPayment = emi;
        balance -= principalPayment;
        schedule.push({
          month,
          emi: Math.round(emi * 100) / 100,
          principal: Math.round(principalPayment * 100) / 100,
          interest: 0,
          balance: Math.max(0, Math.round(balance * 100) / 100)
        });
      }
      
      return {
        emi: Math.round(emi * 100) / 100,
        totalPayment: Math.round(principal * 100) / 100,
        totalInterest: 0,
        principal,
        interestRate: annualRate,
        tenureMonths,
        schedule
      };
    }
    
    const monthlyRate = annualRate / 12 / 100;
    
    // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
    const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths) / 
                (Math.pow(1 + monthlyRate, tenureMonths) - 1);
    
    const totalPayment = emi * tenureMonths;
    const totalInterest = totalPayment - principal;
    
    // Generate amortization schedule
    const schedule: AmortizationEntry[] = [];
    let balance = principal;
    
    for (let month = 1; month <= tenureMonths; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = emi - interestPayment;
      balance -= principalPayment;
      
      schedule.push({
        month,
        emi: Math.round(emi * 100) / 100,
        principal: Math.round(principalPayment * 100) / 100,
        interest: Math.round(interestPayment * 100) / 100,
        balance: Math.max(0, Math.round(balance * 100) / 100)
      });
    }
    
    return {
      emi: Math.round(emi * 100) / 100,
      totalPayment: Math.round(totalPayment * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      principal,
      interestRate: annualRate,
      tenureMonths,
      schedule
    };
  }

  // ==================== Pre-qualification Check ====================
  
  async softPrequalify(
    productKey: string,
    requestedAmount: number,
    monthlyIncome: number,
    creditScore?: number,
    existingEMIs?: number
  ): Promise<PrequalificationResult> {
    const product = this.getLoanProduct(productKey);
    if (!product) {
      return {
        eligible: false,
        score: 0,
        maxEligibleAmount: 0,
        reasons: ['Invalid product selected'],
        recommendations: []
      };
    }

    const score = this.calculateEligibilityScore(productKey, requestedAmount, monthlyIncome, creditScore, existingEMIs);
    const foirLimit = 0.5; // Fixed Obligation to Income Ratio limit
    const availableIncome = monthlyIncome - (existingEMIs || 0);
    const maxEMI = availableIncome * foirLimit;
    
    // Estimate max loan amount based on available EMI capacity
    const avgRate = (product.minInterestRate + product.maxInterestRate) / 2;
    const avgTenure = Math.floor((product.minTenure + product.maxTenure) / 2);
    const maxEligibleAmount = this.calculateMaxLoanFromEMI(maxEMI, avgRate, avgTenure);
    
    const reasons: string[] = [];
    const recommendations: string[] = [];
    
    // Check amount limits
    if (requestedAmount < product.minAmount) {
      reasons.push(`Minimum loan amount is ₹${product.minAmount.toLocaleString('en-IN')}`);
    }
    if (requestedAmount > product.maxAmount) {
      reasons.push(`Maximum loan amount is ₹${product.maxAmount.toLocaleString('en-IN')}`);
    }
    
    // Check income eligibility
    if (monthlyIncome < (product.minIncome || 0)) {
      reasons.push(`Minimum monthly income requirement is ₹${(product.minIncome || 0).toLocaleString('en-IN')}`);
    }
    
    // Check credit score
    if (creditScore && creditScore < (product.minCibilScore || 600)) {
      reasons.push(`Minimum credit score requirement is ${product.minCibilScore || 600}`);
      recommendations.push('Consider improving your credit score before applying');
    }
    
    // Check FOIR
    if (requestedAmount > maxEligibleAmount) {
      reasons.push('Loan amount exceeds your repayment capacity');
      recommendations.push(`Based on your income, you may be eligible for up to ₹${Math.floor(maxEligibleAmount).toLocaleString('en-IN')}`);
    }
    
    const eligible = reasons.length === 0 && score >= 60;
    
    if (eligible) {
      recommendations.push('You appear to be eligible for this loan. Complete your application to get personalized offers.');
    }
    
    return {
      eligible,
      score,
      maxEligibleAmount: Math.min(maxEligibleAmount, product.maxAmount),
      reasons,
      recommendations,
      suggestedProviders: eligible ? this.getProductProviders(productKey).slice(0, 3).map(p => p.providerName) : []
    };
  }

  private calculateEligibilityScore(
    productKey: string,
    amount: number,
    monthlyIncome: number,
    creditScore?: number,
    existingEMIs?: number
  ): number {
    let score = 50; // Base score
    
    // Credit score contribution (30 points)
    if (creditScore) {
      if (creditScore >= 750) score += 30;
      else if (creditScore >= 700) score += 20;
      else if (creditScore >= 650) score += 10;
      else if (creditScore >= 600) score += 5;
    }
    
    // Income vs loan amount ratio (20 points)
    const loanToIncomeRatio = amount / (monthlyIncome * 12);
    if (loanToIncomeRatio <= 2) score += 20;
    else if (loanToIncomeRatio <= 4) score += 15;
    else if (loanToIncomeRatio <= 6) score += 10;
    else if (loanToIncomeRatio <= 8) score += 5;
    
    // FOIR check (20 points)
    const foir = (existingEMIs || 0) / monthlyIncome;
    if (foir <= 0.3) score += 20;
    else if (foir <= 0.4) score += 15;
    else if (foir <= 0.5) score += 10;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateMaxLoanFromEMI(maxEMI: number, annualRate: number, tenureMonths: number): number {
    const monthlyRate = annualRate / 12 / 100;
    // P = EMI * ((1+r)^n - 1) / (r * (1+r)^n)
    const principal = maxEMI * (Math.pow(1 + monthlyRate, tenureMonths) - 1) / 
                      (monthlyRate * Math.pow(1 + monthlyRate, tenureMonths));
    return Math.floor(principal);
  }
}

// ==================== Static Product & Provider Data ====================

export interface LoanProductData {
  productKey: string;
  productName: string;
  category: 'secured' | 'unsecured';
  collateralType?: string;
  description: string;
  icon: string;
  minAmount: number;
  maxAmount: number;
  minTenure: number; // months
  maxTenure: number;
  minInterestRate: number;
  maxInterestRate: number;
  minAge: number;
  maxAge: number;
  minIncome?: number;
  minCibilScore?: number;
  documentsRequired: string[];
  features: string[];
  eligibilityCriteria: string[];
  isActive: boolean;
}

export interface ProviderProductOffering {
  productKey: string;
  productName: string;
  interestRateMin: number;
  interestRateMax: number;
  processingFee: number; // percentage
  maxProcessingFee?: number; // flat cap
  maxLTV?: number; // for secured loans
  commissionRate: number; // % of loan amount
  features: string[];
  isActive: boolean;
}

export interface LoanProviderData {
  providerKey: string;
  providerName: string;
  providerType: 'bank' | 'nbfc';
  logoUrl?: string;
  description: string;
  rating: number; // out of 5
  avgProcessingTime: string;
  hasApi: boolean;
  supportsInstantOffers: boolean;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  products: ProviderProductOffering[];
  isActive: boolean;
}

export interface EMICalculation {
  emi: number;
  totalPayment: number;
  totalInterest: number;
  principal: number;
  interestRate: number;
  tenureMonths: number;
  schedule: AmortizationEntry[];
}

export interface AmortizationEntry {
  month: number;
  emi: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface PrequalificationResult {
  eligible: boolean;
  score: number;
  maxEligibleAmount: number;
  reasons: string[];
  recommendations: string[];
  suggestedProviders?: string[];
}

// Loan Products Data
const LOAN_PRODUCTS: LoanProductData[] = [
  {
    productKey: 'personal',
    productName: 'Personal Loan',
    category: 'unsecured',
    description: 'Multipurpose loan for personal needs like medical emergencies, travel, wedding, or home renovation.',
    icon: 'User',
    minAmount: 50000,
    maxAmount: 4000000,
    minTenure: 12,
    maxTenure: 60,
    minInterestRate: 10.49,
    maxInterestRate: 24.00,
    minAge: 21,
    maxAge: 60,
    minIncome: 20000,
    minCibilScore: 650,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Income Proof', 'Bank Statements (6 months)', 'Address Proof'],
    features: ['No collateral required', 'Quick disbursement', 'Flexible tenure', 'Minimal documentation'],
    eligibilityCriteria: ['Age 21-60 years', 'Minimum income ₹20,000/month', 'CIBIL score 650+', 'Employed or self-employed'],
    isActive: true
  },
  {
    productKey: 'home',
    productName: 'Home Loan',
    category: 'secured',
    collateralType: 'property',
    description: 'Finance your dream home with competitive interest rates and long tenure options.',
    icon: 'Home',
    minAmount: 500000,
    maxAmount: 100000000,
    minTenure: 60,
    maxTenure: 360,
    minInterestRate: 8.35,
    maxInterestRate: 12.00,
    minAge: 21,
    maxAge: 65,
    minIncome: 25000,
    minCibilScore: 650,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Income Proof', 'Bank Statements (12 months)', 'Property Documents', 'Sale Agreement', 'NOC from Society'],
    features: ['Lowest interest rates', 'Up to 30 years tenure', 'Tax benefits under Section 80C & 24(b)', 'Balance transfer facility'],
    eligibilityCriteria: ['Age 21-65 years', 'Minimum income ₹25,000/month', 'CIBIL score 650+', 'Clear property title'],
    isActive: true
  },
  {
    productKey: 'car',
    productName: 'Car Loan',
    category: 'secured',
    collateralType: 'vehicle',
    description: 'Drive your dream car home with easy financing for new and pre-owned vehicles.',
    icon: 'Car',
    minAmount: 100000,
    maxAmount: 10000000,
    minTenure: 12,
    maxTenure: 84,
    minInterestRate: 7.25,
    maxInterestRate: 15.00,
    minAge: 21,
    maxAge: 65,
    minIncome: 20000,
    minCibilScore: 650,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Income Proof', 'Bank Statements (6 months)', 'Proforma Invoice', 'Driving License'],
    features: ['Up to 100% on-road funding', 'Quick approval', 'Flexible repayment', 'Used car financing available'],
    eligibilityCriteria: ['Age 21-65 years', 'Minimum income ₹20,000/month', 'CIBIL score 650+', 'Valid driving license'],
    isActive: true
  },
  {
    productKey: 'business',
    productName: 'Business Loan',
    category: 'unsecured',
    description: 'Fuel your business growth with working capital and expansion finance.',
    icon: 'Building2',
    minAmount: 100000,
    maxAmount: 50000000,
    minTenure: 12,
    maxTenure: 60,
    minInterestRate: 12.00,
    maxInterestRate: 24.00,
    minAge: 21,
    maxAge: 65,
    minIncome: 50000,
    minCibilScore: 675,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Business Registration', 'GST Returns', 'ITR (2 years)', 'Bank Statements (12 months)', 'Financial Statements'],
    features: ['No collateral required', 'Overdraft facility', 'Flexible end-use', 'Quick processing'],
    eligibilityCriteria: ['Business vintage 2+ years', 'Annual turnover ₹10 Lakhs+', 'CIBIL score 675+', 'Profitable operations'],
    isActive: true
  },
  {
    productKey: 'education',
    productName: 'Education Loan',
    category: 'unsecured',
    description: 'Invest in your future with education loans for higher studies in India and abroad.',
    icon: 'GraduationCap',
    minAmount: 100000,
    maxAmount: 15000000,
    minTenure: 36,
    maxTenure: 180,
    minInterestRate: 8.50,
    maxInterestRate: 14.00,
    minAge: 18,
    maxAge: 35,
    minIncome: 0, // Co-applicant income considered
    minCibilScore: 650,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Admission Letter', 'Fee Structure', 'Academic Records', 'Co-applicant Income Proof'],
    features: ['Moratorium during study', 'Tax benefits under Section 80E', 'Covers tuition, living, travel', 'Subsidy schemes available'],
    eligibilityCriteria: ['Age 18-35 years', 'Confirmed admission', 'Co-applicant with income', 'Academic merit'],
    isActive: true
  },
  {
    productKey: 'gold',
    productName: 'Gold Loan',
    category: 'secured',
    collateralType: 'gold',
    description: 'Get instant funds against your gold jewelry with minimal documentation.',
    icon: 'Star',
    minAmount: 10000,
    maxAmount: 10000000,
    minTenure: 3,
    maxTenure: 36,
    minInterestRate: 7.00,
    maxInterestRate: 17.00,
    minAge: 18,
    maxAge: 70,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Gold Ornaments'],
    features: ['Instant disbursement', 'Minimal documentation', 'No income proof required', 'Flexible repayment'],
    eligibilityCriteria: ['Age 18-70 years', 'Own gold jewelry (18-22 Karat)', 'Valid ID proof'],
    isActive: true
  },
  {
    productKey: 'lap',
    productName: 'Loan Against Property',
    category: 'secured',
    collateralType: 'property',
    description: 'Unlock the value of your property for business or personal needs.',
    icon: 'Building2',
    minAmount: 500000,
    maxAmount: 50000000,
    minTenure: 36,
    maxTenure: 240,
    minInterestRate: 9.00,
    maxInterestRate: 14.00,
    minAge: 25,
    maxAge: 70,
    minIncome: 30000,
    minCibilScore: 650,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Income Proof', 'Property Documents', 'Valuation Report', 'Bank Statements (12 months)'],
    features: ['Higher loan amount', 'Lower interest rates', 'Long tenure', 'Multipurpose usage'],
    eligibilityCriteria: ['Age 25-70 years', 'Own property (residential/commercial)', 'Clear title', 'CIBIL score 650+'],
    isActive: true
  },
  {
    productKey: 'securities',
    productName: 'Loan Against Securities',
    category: 'secured',
    collateralType: 'securities',
    description: 'Get funds against your shares, mutual funds, bonds, and other securities without selling them.',
    icon: 'TrendingUp',
    minAmount: 100000,
    maxAmount: 200000000,
    minTenure: 12,
    maxTenure: 36,
    minInterestRate: 9.00,
    maxInterestRate: 12.50,
    minAge: 21,
    maxAge: 70,
    minIncome: 50000,
    minCibilScore: 700,
    documentsRequired: ['PAN Card', 'Aadhaar Card', 'Demat Account Statement', 'Securities Pledge Agreement', 'Bank Statements (6 months)', 'Income Proof'],
    features: ['Retain ownership of securities', 'Continue earning dividends', 'No foreclosure charges', 'Overdraft facility available', 'Quick disbursement'],
    eligibilityCriteria: ['Age 21-70 years', 'Demat account with approved securities', 'Minimum portfolio value ₹5 Lakhs', 'CIBIL score 700+'],
    isActive: true
  }
];

// Partner Lenders Data
const LOAN_PROVIDERS: LoanProviderData[] = [
  {
    providerKey: 'icici',
    providerName: 'ICICI Bank',
    providerType: 'bank',
    description: "India's leading private sector bank with extensive loan offerings.",
    rating: 4.5,
    avgProcessingTime: '2-3 days',
    hasApi: true,
    supportsInstantOffers: true,
    website: 'https://www.icicibank.com',
    products: [
      { productKey: 'personal', productName: 'Personal Loan', interestRateMin: 10.75, interestRateMax: 19.00, processingFee: 2.25, maxProcessingFee: 5000, commissionRate: 0.75, features: ['Instant approval', 'Zero prepayment charges'], isActive: true },
      { productKey: 'home', productName: 'Home Loan', interestRateMin: 8.40, interestRateMax: 10.05, processingFee: 0.50, maxProcessingFee: 10000, maxLTV: 80, commissionRate: 0.40, features: ['Balance transfer benefit', 'Property search assistance'], isActive: true },
      { productKey: 'car', productName: 'Car Loan', interestRateMin: 7.75, interestRateMax: 12.00, processingFee: 0.50, maxProcessingFee: 6000, maxLTV: 100, commissionRate: 0.50, features: ['100% on-road funding', 'Used car loans available'], isActive: true },
      { productKey: 'business', productName: 'Business Loan', interestRateMin: 14.00, interestRateMax: 20.00, processingFee: 2.00, commissionRate: 1.00, features: ['Overdraft facility', 'Quick turnaround'], isActive: true },
      { productKey: 'lap', productName: 'Loan Against Property', interestRateMin: 9.25, interestRateMax: 12.50, processingFee: 1.00, maxLTV: 65, commissionRate: 0.50, features: ['High loan amount', 'Balance transfer option'], isActive: true },
      { productKey: 'securities', productName: 'Loan Against Securities', interestRateMin: 9.00, interestRateMax: 11.50, processingFee: 0.50, maxLTV: 50, commissionRate: 0.35, features: ['Overdraft facility', 'Retain dividends', 'Quick disbursement'], isActive: true }
    ],
    isActive: true
  },
  {
    providerKey: 'hdfc',
    providerName: 'HDFC Bank',
    providerType: 'bank',
    description: "India's largest private sector bank by assets with diverse loan portfolio.",
    rating: 4.6,
    avgProcessingTime: '2-4 days',
    hasApi: true,
    supportsInstantOffers: true,
    website: 'https://www.hdfcbank.com',
    products: [
      { productKey: 'personal', productName: 'Personal Loan', interestRateMin: 10.50, interestRateMax: 21.00, processingFee: 2.50, maxProcessingFee: 4500, commissionRate: 0.80, features: ['Pre-approved offers', 'Instant disbursal'], isActive: true },
      { productKey: 'home', productName: 'Home Loan', interestRateMin: 8.35, interestRateMax: 9.90, processingFee: 0.50, maxProcessingFee: 15000, maxLTV: 85, commissionRate: 0.35, features: ['Top-up facility', 'Part-prepayment allowed'], isActive: true },
      { productKey: 'car', productName: 'Car Loan', interestRateMin: 7.50, interestRateMax: 13.00, processingFee: 0.40, maxLTV: 100, commissionRate: 0.55, features: ['Pre-approved for existing customers', 'Zero foreclosure charges'], isActive: true },
      { productKey: 'business', productName: 'Business Loan', interestRateMin: 13.50, interestRateMax: 19.50, processingFee: 1.75, commissionRate: 0.90, features: ['Working capital finance', 'GST-linked loans'], isActive: true },
      { productKey: 'education', productName: 'Education Loan', interestRateMin: 9.55, interestRateMax: 13.25, processingFee: 1.00, commissionRate: 0.40, features: ['Moratorium benefit', 'Top foreign universities covered'], isActive: true },
      { productKey: 'securities', productName: 'Loan Against Securities', interestRateMin: 9.25, interestRateMax: 11.75, processingFee: 0.50, maxLTV: 50, commissionRate: 0.30, features: ['HDFC Demat integration', 'No prepayment charges', 'Overdraft facility'], isActive: true }
    ],
    isActive: true
  },
  {
    providerKey: 'bajaj_finance',
    providerName: 'Bajaj Finserv',
    providerType: 'nbfc',
    description: 'Leading NBFC with quick digital loan processing and wide product range.',
    rating: 4.3,
    avgProcessingTime: '24 hours',
    hasApi: true,
    supportsInstantOffers: true,
    website: 'https://www.bajajfinserv.in',
    products: [
      { productKey: 'personal', productName: 'Personal Loan', interestRateMin: 11.00, interestRateMax: 22.00, processingFee: 3.00, maxProcessingFee: 4000, commissionRate: 1.00, features: ['Flexi loan option', 'Part-prepayment allowed'], isActive: true },
      { productKey: 'business', productName: 'Business Loan', interestRateMin: 15.00, interestRateMax: 24.00, processingFee: 2.50, commissionRate: 1.25, features: ['Flexi business loan', 'Instant approval'], isActive: true },
      { productKey: 'gold', productName: 'Gold Loan', interestRateMin: 7.50, interestRateMax: 14.00, processingFee: 1.00, maxLTV: 75, commissionRate: 0.60, features: ['Instant disbursement', 'No income proof needed'], isActive: true },
      { productKey: 'lap', productName: 'Loan Against Property', interestRateMin: 9.50, interestRateMax: 13.00, processingFee: 1.25, maxLTV: 70, commissionRate: 0.65, features: ['High loan-to-value', 'Flexible tenure'], isActive: true }
    ],
    isActive: true
  },
  {
    providerKey: 'tata_capital',
    providerName: 'Tata Capital',
    providerType: 'nbfc',
    description: 'Trusted Tata Group company offering comprehensive lending solutions.',
    rating: 4.2,
    avgProcessingTime: '2-3 days',
    hasApi: false,
    supportsInstantOffers: false,
    website: 'https://www.tatacapital.com',
    products: [
      { productKey: 'personal', productName: 'Personal Loan', interestRateMin: 10.99, interestRateMax: 20.00, processingFee: 2.00, commissionRate: 0.85, features: ['Trusted brand', 'Transparent pricing'], isActive: true },
      { productKey: 'home', productName: 'Home Loan', interestRateMin: 8.75, interestRateMax: 11.00, processingFee: 0.75, maxLTV: 80, commissionRate: 0.45, features: ['Home improvement loans', 'Plot + construction'], isActive: true },
      { productKey: 'car', productName: 'Car Loan', interestRateMin: 8.00, interestRateMax: 14.00, processingFee: 0.50, maxLTV: 90, commissionRate: 0.50, features: ['Used car financing', 'Refinance available'], isActive: true },
      { productKey: 'business', productName: 'Business Loan', interestRateMin: 14.50, interestRateMax: 21.00, processingFee: 2.00, commissionRate: 1.00, features: ['MSME focus', 'Equipment finance'], isActive: true },
      { productKey: 'education', productName: 'Education Loan', interestRateMin: 10.00, interestRateMax: 13.50, processingFee: 1.00, commissionRate: 0.45, features: ['Study abroad loans', 'Domestic courses covered'], isActive: true }
    ],
    isActive: true
  },
  {
    providerKey: 'kotak',
    providerName: 'Kotak Mahindra Bank',
    providerType: 'bank',
    description: 'Premium banking experience with competitive loan offerings.',
    rating: 4.4,
    avgProcessingTime: '2-4 days',
    hasApi: true,
    supportsInstantOffers: true,
    website: 'https://www.kotak.com',
    products: [
      { productKey: 'personal', productName: 'Personal Loan', interestRateMin: 10.99, interestRateMax: 18.00, processingFee: 2.00, maxProcessingFee: 5000, commissionRate: 0.70, features: ['Instant approval', 'No hidden charges'], isActive: true },
      { productKey: 'home', productName: 'Home Loan', interestRateMin: 8.50, interestRateMax: 10.50, processingFee: 0.50, maxLTV: 80, commissionRate: 0.38, features: ['Doorstep service', 'Quick sanction'], isActive: true },
      { productKey: 'car', productName: 'Car Loan', interestRateMin: 7.99, interestRateMax: 12.50, processingFee: 0.50, maxLTV: 100, commissionRate: 0.52, features: ['Pre-approved for salary accounts', 'Zero documentation'], isActive: true },
      { productKey: 'business', productName: 'Business Loan', interestRateMin: 14.00, interestRateMax: 20.00, processingFee: 1.50, commissionRate: 0.95, features: ['Trade finance', 'Bill discounting'], isActive: true },
      { productKey: 'gold', productName: 'Gold Loan', interestRateMin: 8.00, interestRateMax: 15.00, processingFee: 0.50, maxLTV: 75, commissionRate: 0.55, features: ['Online gold loan', 'Flexible repayment'], isActive: true },
      { productKey: 'lap', productName: 'Loan Against Property', interestRateMin: 9.00, interestRateMax: 12.00, processingFee: 1.00, maxLTV: 65, commissionRate: 0.55, features: ['Competitive rates', 'Fast processing'], isActive: true },
      { productKey: 'securities', productName: 'Loan Against Securities', interestRateMin: 9.50, interestRateMax: 12.00, processingFee: 0.50, maxLTV: 50, commissionRate: 0.35, features: ['Kotak Securities integration', 'Zero margin calls', 'Instant credit line'], isActive: true }
    ],
    isActive: true
  }
];

// Export singleton instance
export const loanOrchestrator = new LoanOrchestrator();