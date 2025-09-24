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
      return await storage.getCreditProfile(userId);
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

    const requestData: InsertLoanRequest = {
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
        eligibilityScore: parseFloat(offer.eligibilityScore),
        approvalProbability: parseFloat(offer.approvalProbability),
        qualityScore: parseFloat(offer.qualityScore),
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
}

// Export singleton instance
export const loanOrchestrator = new LoanOrchestrator();