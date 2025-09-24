// Provider Adapter Interface for Loan Marketplace
// This interface provides a standardized way to integrate different banks and NBFCs
// allowing the marketplace to generate offers from multiple providers

import { 
  LoanProduct, 
  LoanProvider, 
  ProviderProduct, 
  CreditProfile, 
  LoanRequest, 
  LoanOffer, 
  LoanApplicationMarketplace,
  ApplicationDocument 
} from '@shared/schema';

// Standard request format for all providers
export interface LoanOfferRequest {
  userId: string;
  productKey: string; // personal, home, lap, las, business, education, vehicle
  requestedAmount: number;
  preferredTenure: number; // months
  purpose?: string;
  collateralDetails?: any;
  creditProfile: CreditProfile;
  
  // Additional context
  urgency: 'immediate' | 'within_week' | 'within_month';
  sourceChannel: 'web' | 'mobile' | 'agent';
  referralCode?: string;
}

// Standard response format from all providers
export interface LoanOfferResponse {
  success: boolean;
  offers: ProviderLoanOffer[];
  errors?: string[];
  warnings?: string[];
  metadata?: {
    processingTime: number;
    apiVersion: string;
    requestId: string;
  };
}

export interface ProviderLoanOffer {
  providerId: string;
  providerName: string;
  productKey: string;
  productName: string;
  
  // Offer Terms
  approvedAmount: number;
  interestRate: number;
  tenure: number; // months
  emi: number;
  
  // Fees and Charges
  processingFee: number;
  legalCharges?: number;
  otherCharges?: number;
  totalCost: number;
  
  // Eligibility and Risk
  eligibilityScore: number; // 0-100
  approvalProbability: number; // 0-100
  qualityScore: number; // 0-100 (calculated by our system)
  
  // Offer Metadata
  offerSource: 'api' | 'rules_engine';
  rateType: 'fixed' | 'floating' | 'hybrid';
  ltvRatio?: number;
  validityDays: number;
  
  // Additional Information
  terms: string[];
  specialOffers: string[];
  documentsRequired: string[];
  expectedDisbursalTime: string; // "2-3 days", "within 24 hours"
  
  // Provider-specific data
  providerOfferRef?: string;
  internalScore?: number;
}

// Application submission interface
export interface LoanApplicationRequest {
  userId: string;
  offerId: string;
  applicantDetails: {
    personalInfo: any;
    employmentInfo: any;
    financialInfo: any;
    documentsInfo: any;
  };
  additionalData?: any;
}

export interface LoanApplicationResponse {
  success: boolean;
  applicationId?: string;
  providerApplicationRef?: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  nextSteps: string[];
  errors?: string[];
}

// Document upload interface
export interface DocumentUploadRequest {
  applicationId: string;
  documentType: string;
  documentData: {
    fileName: string;
    fileContent: Buffer | string;
    fileFormat: string;
  };
}

export interface DocumentUploadResponse {
  success: boolean;
  documentId?: string;
  providerDocumentRef?: string;
  status: 'uploaded' | 'processing' | 'verified' | 'rejected';
  errors?: string[];
}

// Status check interface
export interface ApplicationStatusRequest {
  applicationId: string;
  providerApplicationRef: string;
}

export interface ApplicationStatusResponse {
  success: boolean;
  status: string;
  stage: string;
  timeline: Array<{
    stage: string;
    timestamp: Date;
    description: string;
  }>;
  nextSteps: string[];
  errors?: string[];
}

// Base Provider Adapter Interface
export abstract class LoanProviderAdapter {
  protected provider: LoanProvider;
  protected integration: any; // Provider integration config
  
  constructor(provider: LoanProvider, integration: any) {
    this.provider = provider;
    this.integration = integration;
  }
  
  // Core methods that all providers must implement
  abstract generateOffers(request: LoanOfferRequest): Promise<LoanOfferResponse>;
  abstract submitApplication(request: LoanApplicationRequest): Promise<LoanApplicationResponse>;
  abstract checkApplicationStatus(request: ApplicationStatusRequest): Promise<ApplicationStatusResponse>;
  
  // Optional methods (providers can override if they support these features)
  async uploadDocument(request: DocumentUploadRequest): Promise<DocumentUploadResponse> {
    return {
      success: false,
      status: 'rejected',
      errors: ['Document upload not supported by this provider']
    };
  }
  
  async preQualify(request: LoanOfferRequest): Promise<{ qualified: boolean; reasons?: string[] }> {
    return { qualified: true }; // Default implementation
  }
  
  async validateOffer(offerId: string): Promise<{ valid: boolean; errors?: string[] }> {
    return { valid: true }; // Default implementation
  }
  
  // Health check for the provider integration
  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    return { healthy: true };
  }
  
  // Get provider capabilities
  getCapabilities(): {
    supportsApi: boolean;
    supportsPrequalification: boolean;
    supportsInstantOffers: boolean;
    supportsWebhooks: boolean;
    supportsDocumentUpload: boolean;
  } {
    return {
      supportsApi: this.provider.hasApi ?? false,
      supportsPrequalification: this.provider.supportsPrequalification ?? false,
      supportsInstantOffers: this.provider.supportsInstantOffers ?? false,
      supportsWebhooks: this.provider.supportsWebhooks ?? false,
      supportsDocumentUpload: false, // Default
    };
  }
  
  // Utility method to calculate offer quality score
  protected calculateQualityScore(offer: ProviderLoanOffer): number {
    let score = 50; // Base score
    
    // Lower interest rate increases quality
    if (offer.interestRate <= 10) score += 20;
    else if (offer.interestRate <= 12) score += 15;
    else if (offer.interestRate <= 15) score += 10;
    else if (offer.interestRate <= 18) score += 5;
    
    // Lower processing fee increases quality
    const processingFeePercent = (offer.processingFee / offer.approvedAmount) * 100;
    if (processingFeePercent <= 1) score += 15;
    else if (processingFeePercent <= 2) score += 10;
    else if (processingFeePercent <= 3) score += 5;
    
    // Higher approval probability increases quality
    score += (offer.approvalProbability / 100) * 15;
    
    // Special offers boost quality
    if (offer.specialOffers && offer.specialOffers.length > 0) {
      score += 5;
    }
    
    // Cap at 100
    return Math.min(score, 100);
  }
  
  // Utility method to generate offer reference
  protected generateOfferRef(): string {
    return `${this.provider.providerKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  // Common validation for loan requests
  protected validateLoanRequest(request: LoanOfferRequest): string[] {
    const errors: string[] = [];
    
    if (!request.userId) errors.push('User ID is required');
    if (!request.productKey) errors.push('Product key is required');
    if (request.requestedAmount <= 0) errors.push('Requested amount must be greater than 0');
    if (request.preferredTenure <= 0) errors.push('Preferred tenure must be greater than 0');
    if (!request.creditProfile) errors.push('Credit profile is required');
    
    return errors;
  }
}

// Provider Adapter Factory
export class ProviderAdapterFactory {
  private static adapters: Map<string, new (provider: LoanProvider, integration: any) => LoanProviderAdapter> = new Map();
  
  static register(providerKey: string, adapterClass: new (provider: LoanProvider, integration: any) => LoanProviderAdapter) {
    this.adapters.set(providerKey, adapterClass);
  }
  
  static create(provider: LoanProvider, integration: any): LoanProviderAdapter | null {
    const AdapterClass = this.adapters.get(provider.providerKey);
    if (!AdapterClass) {
      console.warn(`No adapter registered for provider: ${provider.providerKey}`);
      return null;
    }
    
    return new AdapterClass(provider, integration);
  }
  
  static getRegisteredProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
}

// Provider Registry for managing all active providers
export class ProviderRegistry {
  private providers: Map<string, { provider: LoanProvider; adapter: LoanProviderAdapter; integration: any }> = new Map();
  
  async initialize(providers: LoanProvider[], integrations: any[]): Promise<void> {
    for (const provider of providers) {
      if (!provider.isActive) continue;
      
      const integration = integrations.find(i => i.providerId === provider.id);
      if (!integration?.isEnabled) continue;
      
      const adapter = ProviderAdapterFactory.create(provider, integration);
      if (adapter) {
        this.providers.set(provider.providerKey, {
          provider,
          adapter,
          integration
        });
        
        console.log(`Initialized provider: ${provider.providerName}`);
      }
    }
  }
  
  getProvider(providerKey: string): { provider: LoanProvider; adapter: LoanProviderAdapter; integration: any } | undefined {
    return this.providers.get(providerKey);
  }
  
  getAllProviders(): Array<{ provider: LoanProvider; adapter: LoanProviderAdapter; integration: any }> {
    return Array.from(this.providers.values());
  }
  
  getActiveProviders(productKey?: string): Array<{ provider: LoanProvider; adapter: LoanProviderAdapter; integration: any }> {
    return this.getAllProviders().filter(({ provider }) => {
      if (!provider.isActive) return false;
      // Add product-specific filtering logic here if needed
      return true;
    });
  }
  
  async performHealthChecks(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const providerKeys = Array.from(this.providers.keys());
    
    for (const key of providerKeys) {
      const provider = this.providers.get(key);
      if (provider) {
        try {
          const health = await provider.adapter.healthCheck();
          results.set(key, health.healthy);
        } catch (error) {
          console.error(`Health check failed for ${key}:`, error);
          results.set(key, false);
        }
      }
    }
    
    return results;
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();