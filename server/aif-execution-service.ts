/**
 * AIF Order Execution Service
 * 
 * Handles Alternative Investment Fund order processing with:
 * - Accredited investor verification (SEBI compliance)
 * - Subscription agreement generation
 * - Order lifecycle management
 * - Integration with unified order management
 */

import { db } from "./db";
import { userProfiles, unifiedOrders } from "@shared/schema";
import { eq } from "drizzle-orm";
import { orderManagementService } from "./order-management-service";
import { ACCREDITED_INVESTOR_CRITERIA } from "./kyc-tier-service";

// AIF Categories and minimum investments per SEBI regulations
// Updated: ₹10L minimum with partial payment support
export const AIF_CATEGORIES = {
  CAT_I: {
    name: "Category I AIF",
    description: "Venture capital, SME funds, social venture funds, infrastructure funds",
    minInvestment: 1000000, // ₹10 Lakh (initial payment, balance on demand)
    lockInPeriod: "3 years",
    riskLevel: "medium-high",
    sebiRegulated: true,
  },
  CAT_II: {
    name: "Category II AIF",
    description: "Private equity funds, debt funds (other than Cat I & III)",
    minInvestment: 1000000, // ₹10 Lakh (initial payment, balance on demand)
    lockInPeriod: "3 years",
    riskLevel: "medium-high",
    sebiRegulated: true,
  },
  CAT_III: {
    name: "Category III AIF",
    description: "Hedge funds, PIPE funds (complex trading strategies)",
    minInvestment: 1000000, // ₹10 Lakh (initial payment, balance on demand)
    lockInPeriod: "1 year minimum",
    riskLevel: "high",
    sebiRegulated: true,
  },
};

export interface AIFExecutionRequest {
  orderId: string;
  userId: string;
  aifCategory: 'CAT_I' | 'CAT_II' | 'CAT_III';
  fundName: string;
  fundCode: string;
  investmentAmount: number; // Total committed investment
  paidAmount: number; // Amount paid so far (initial or balance payment)
  isPartialPayment?: boolean; // Whether this is a partial payment scenario
  units?: number;
  navPerUnit?: number;
}

export interface AIFExecutionResult {
  success: boolean;
  orderId: string;
  message: string;
  subscriptionAgreementUrl?: string;
  folioNumber?: string;
  allotmentDate?: Date;
  errors?: string[];
}

interface AccreditedInvestorValidation {
  isValid: boolean;
  tier: string;
  qualificationRoute?: string;
  errors: string[];
}

interface SubscriptionAgreement {
  agreementId: string;
  investorName: string;
  fundDetails: {
    name: string;
    category: string;
    minInvestment: number;
  };
  investmentAmount: number;
  paidAmount: number;
  balanceAmount: number;
  isPartialPayment: boolean;
  balanceDueDate?: string;
  riskDisclosures: string[];
  termsAndConditions: string[];
  generatedAt: Date;
  expiresAt: Date;
}

/**
 * AIF Order Execution Service Class
 */
class AIFExecutionService {
  
  /**
   * Execute AIF order after payment completion
   */
  async executeOrder(request: AIFExecutionRequest): Promise<AIFExecutionResult> {
    const errors: string[] = [];
    
    try {
      console.log(`[AIF Execution] Starting execution for order ${request.orderId}`);
      
      // Step 1: Validate accredited investor status (MANDATORY for AIF)
      const investorValidation = await this.validateAccreditedInvestor(request.userId);
      if (!investorValidation.isValid) {
        await this.handleExecutionFailure(request.orderId, investorValidation.errors);
        return {
          success: false,
          orderId: request.orderId,
          message: `Accredited investor verification failed: ${investorValidation.errors.join(', ')}`,
          errors: investorValidation.errors,
        };
      }
      
      console.log(`[AIF Execution] Accredited investor verified via ${investorValidation.qualificationRoute}`);
      
      // Step 2: Validate minimum investment criteria with partial payment support
      const categoryConfig = AIF_CATEGORIES[request.aifCategory];
      const totalInvestment = request.investmentAmount;
      const paidAmount = request.paidAmount;
      const balanceAmount = totalInvestment - paidAmount;
      
      // Validate minimum initial payment (₹10L)
      if (paidAmount < categoryConfig.minInvestment) {
        const error = `Initial payment ₹${paidAmount.toLocaleString()} is below minimum ₹${categoryConfig.minInvestment.toLocaleString()} for ${categoryConfig.name}`;
        await this.handleExecutionFailure(request.orderId, [error]);
        return {
          success: false,
          orderId: request.orderId,
          message: error,
          errors: [error],
        };
      }
      
      // Determine if this is a partial payment scenario
      const isPartialPayment = balanceAmount > 0;
      const paymentStage = isPartialPayment ? 'initial_payment' : 'fully_paid';
      
      console.log(`[AIF Execution] Payment validation: Total=₹${totalInvestment.toLocaleString()}, Paid=₹${paidAmount.toLocaleString()}, Balance=₹${balanceAmount.toLocaleString()}, Stage=${paymentStage}`);
      
      // Step 3: Generate subscription agreement
      const agreement = await this.generateSubscriptionAgreement(request);
      console.log(`[AIF Execution] Subscription agreement generated: ${agreement.agreementId}`);
      
      // Step 4: Update order status to processing
      await orderManagementService.updateOrderStatus({
        orderId: request.orderId,
        status: 'processing',
        executionStatus: 'initiated',
        notes: `AIF subscription agreement generated. Category: ${request.aifCategory}, Total: ₹${totalInvestment.toLocaleString()}, Paid: ₹${paidAmount.toLocaleString()}, Balance: ₹${balanceAmount.toLocaleString()}`,
        metadata: {
          aifCategory: request.aifCategory,
          fundName: request.fundName,
          subscriptionAgreementId: agreement.agreementId,
          investorQualification: investorValidation.qualificationRoute,
          // Partial payment tracking
          totalInvestmentAmount: totalInvestment,
          initialPaymentAmount: paidAmount,
          balanceAmount: balanceAmount,
          paymentStage: paymentStage,
          isPartialPayment: isPartialPayment,
          balanceDueDate: isPartialPayment ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null, // 90 days from now
        },
        actorId: 'system',
        actorType: 'system',
      });
      
      // Step 5: Simulate AIF subscription processing (in production, this would call AMC API)
      const executionResult = await this.processAIFSubscription(request, agreement);
      
      if (executionResult.success) {
        // Step 6: Store subscription agreement document (to Object Storage in production)
        const agreementUrl = await this.storeSubscriptionAgreement(agreement, request);
        
        // Step 7: Update order to executed status
        await orderManagementService.updateOrderStatus({
          orderId: request.orderId,
          status: isPartialPayment ? 'executed' : 'executed', // Same status, but payment stage differs
          executionStatus: 'completed',
          notes: isPartialPayment 
            ? `AIF subscription executed (partial payment). Folio: ${executionResult.folioNumber}. Balance ₹${balanceAmount.toLocaleString()} due on demand.`
            : `AIF subscription executed (full payment). Folio: ${executionResult.folioNumber}`,
          metadata: {
            folioNumber: executionResult.folioNumber,
            allotmentDate: executionResult.allotmentDate,
            units: request.units,
            navPerUnit: request.navPerUnit,
            // Partial payment details
            totalInvestmentAmount: totalInvestment,
            paidAmount: paidAmount,
            balanceAmount: balanceAmount,
            paymentStage: isPartialPayment ? 'balance_pending' : 'fully_paid',
            balanceDueDate: isPartialPayment ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() : null,
          },
          actorId: 'system',
          actorType: 'system',
        });
        
        // Step 8: Add subscription agreement document to order
        await orderManagementService.addDocument({
          orderId: request.orderId,
          documentType: 'subscription_agreement',
          documentUrl: agreementUrl,
          title: `AIF Subscription Agreement - ${request.fundName}`,
          uploadedBy: 'system',
          metadata: {
            agreementId: agreement.agreementId,
            category: request.aifCategory,
          },
        });
        
        console.log(`[AIF Execution] Order ${request.orderId} executed successfully`);
        
        return {
          success: true,
          orderId: request.orderId,
          message: `AIF subscription executed successfully for ${request.fundName}`,
          subscriptionAgreementUrl: agreementUrl,
          folioNumber: executionResult.folioNumber,
          allotmentDate: executionResult.allotmentDate,
        };
      } else {
        await this.handleExecutionFailure(request.orderId, executionResult.errors || ['Unknown execution error']);
        return {
          success: false,
          orderId: request.orderId,
          message: `AIF subscription failed: ${executionResult.errors?.join(', ')}`,
          errors: executionResult.errors,
        };
      }
      
    } catch (error) {
      console.error(`[AIF Execution] Error executing order ${request.orderId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleExecutionFailure(request.orderId, [errorMessage]);
      
      return {
        success: false,
        orderId: request.orderId,
        message: `AIF execution failed: ${errorMessage}`,
        errors: [errorMessage],
      };
    }
  }
  
  /**
   * Validate accredited investor status per SEBI regulations
   */
  private async validateAccreditedInvestor(userId: string): Promise<AccreditedInvestorValidation> {
    const errors: string[] = [];
    
    try {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.userId, userId),
      });
      
      if (!profile) {
        return {
          isValid: false,
          tier: 'none',
          errors: ['User profile not found'],
        };
      }
      
      // Check KYC tier - must be accredited_investor
      if ((profile as any).kycTier !== 'accredited_investor') {
        errors.push(`KYC tier is ${(profile as any).kycTier}, must be accredited_investor for AIF investments`);
      }
      
      // Check accredited investor status
      if (profile.accreditedInvestorStatus !== 'verified') {
        errors.push(`Accredited investor status is ${profile.accreditedInvestorStatus}, must be verified`);
      }
      
      // Check if accredited status has expired
      if (profile.accreditedInvestorExpiryDate && new Date(profile.accreditedInvestorExpiryDate) < new Date()) {
        errors.push('Accredited investor certification has expired. Annual renewal required.');
      }
      
      // Verify qualification route
      let qualificationRoute = (profile as any).accreditedInvestorType || 'unknown';
      
      // Income-based qualification
      if (qualificationRoute === 'income_based') {
        if (!(profile as any).annualIncomeAmount || Number((profile as any).annualIncomeAmount) < ACCREDITED_INVESTOR_CRITERIA.ANNUAL_INCOME_THRESHOLD) {
          errors.push(`Annual income must be ₹${(ACCREDITED_INVESTOR_CRITERIA.ANNUAL_INCOME_THRESHOLD / 10000000).toFixed(1)}Cr+`);
        }
        if (!(profile as any).incomeProofDocuments || (Array.isArray((profile as any).incomeProofDocuments) && (profile as any).incomeProofDocuments.length === 0)) {
          errors.push('Income proof documents required');
        }
      }
      
      // Net worth-based qualification
      else if (qualificationRoute === 'networth_based') {
        if (!(profile as any).netWorthExcludingResidence || Number((profile as any).netWorthExcludingResidence) < ACCREDITED_INVESTOR_CRITERIA.NET_WORTH_THRESHOLD) {
          errors.push(`Net worth (excluding residence) must be ₹${(ACCREDITED_INVESTOR_CRITERIA.NET_WORTH_THRESHOLD / 10000000).toFixed(1)}Cr+`);
        }
        if (!(profile as any).caCertificateUrl) {
          errors.push('CA certificate for net worth verification required');
        }
      }
      
      // Portfolio-based qualification
      else if (qualificationRoute === 'portfolio_based') {
        if (!profile.portfolioValueAmount || Number(profile.portfolioValueAmount) < ACCREDITED_INVESTOR_CRITERIA.PORTFOLIO_VALUE_THRESHOLD) {
          errors.push(`Portfolio value must be ₹${(ACCREDITED_INVESTOR_CRITERIA.PORTFOLIO_VALUE_THRESHOLD / 10000000).toFixed(1)}Cr+`);
        }
        if (!(profile as any).portfolioStatementUrl) {
          errors.push('Portfolio statement required');
        }
      }
      
      // Professional qualification
      else if (qualificationRoute === 'professional') {
        if (!profile.professionalQualification || !ACCREDITED_INVESTOR_CRITERIA.PROFESSIONAL_QUALIFICATIONS.includes(profile.professionalQualification)) {
          errors.push('Valid professional qualification (CA/CFA/MBA Finance) required');
        }
        if (!profile.professionalQualificationVerified) {
          errors.push('Professional qualification must be verified');
        }
        if ((profile.professionalExperienceYears || 0) < ACCREDITED_INVESTOR_CRITERIA.MIN_EXPERIENCE_YEARS) {
          errors.push(`Minimum ${ACCREDITED_INVESTOR_CRITERIA.MIN_EXPERIENCE_YEARS} years professional experience required`);
        }
      } else {
        errors.push('Unknown accredited investor qualification route');
      }
      
      // AML and PEP checks
      if (profile.amlStatus !== 'clear') {
        errors.push(`AML status is ${profile.amlStatus}, must be clear`);
      }
      
      if (profile.pepStatus === 'Y') {
        errors.push('PEP (Politically Exposed Person) status requires additional compliance approval');
      }
      
      return {
        isValid: errors.length === 0,
        tier: (profile as any).kycTier || 'unknown',
        qualificationRoute,
        errors,
      };
      
    } catch (error) {
      console.error('[AIF Execution] Accredited investor validation error:', error);
      return {
        isValid: false,
        tier: 'error',
        errors: [error instanceof Error ? error.message : 'Validation failed'],
      };
    }
  }
  
  /**
   * Generate subscription agreement document
   */
  private async generateSubscriptionAgreement(request: AIFExecutionRequest): Promise<SubscriptionAgreement> {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, request.userId),
    });
    
    const investorName = profile 
      ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Investor'
      : 'Investor';
    
    const categoryConfig = AIF_CATEGORIES[request.aifCategory];
    const agreementId = `AIF-SUB-${Date.now()}-${request.orderId.slice(0, 8)}`;
    
    // Calculate partial payment details
    const totalInvestment = request.investmentAmount;
    const paidAmount = request.paidAmount;
    const balanceAmount = totalInvestment - paidAmount;
    const isPartialPayment = balanceAmount > 0;
    const balanceDueDate = isPartialPayment 
      ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString() 
      : undefined;
    
    // Build terms and conditions with partial payment clauses if applicable
    const baseTerms = [
      'Investor confirms accredited investor status as per SEBI AIF Regulations 2012',
      'Investor has read and understood the Private Placement Memorandum (PPM)',
      'Investment is subject to fund manager approval',
    ];
    
    const paymentTerms = isPartialPayment ? [
      `PARTIAL PAYMENT AGREEMENT: Total investment commitment: ₹${totalInvestment.toLocaleString()}`,
      `Initial payment received: ₹${paidAmount.toLocaleString()} (minimum ₹${categoryConfig.minInvestment.toLocaleString()})`,
      `Balance amount due: ₹${balanceAmount.toLocaleString()}`,
      `Balance payment due on demand by AMC/Fund Manager (within 90 days or as specified)`,
      'Failure to pay balance amount on demand may result in forfeiture of investment and allotment cancellation',
      'Units will be provisionally allotted based on initial payment, final allotment subject to full payment',
    ] : [
      `Full payment received: ₹${totalInvestment.toLocaleString()}`,
      'Subscription amount will be held in escrow until allotment',
    ];
    
    const finalTerms = [
      'Units will be allotted as per fund NAV on allotment date',
      'Investor agrees to fund terms, fees, and exit load structure',
      'This is a private placement and not a public offering',
    ];
    
    return {
      agreementId,
      investorName,
      fundDetails: {
        name: request.fundName,
        category: categoryConfig.name,
        minInvestment: categoryConfig.minInvestment,
      },
      investmentAmount: totalInvestment,
      paidAmount,
      balanceAmount,
      isPartialPayment,
      balanceDueDate,
      riskDisclosures: [
        'Alternative Investment Funds (AIFs) are high-risk investments',
        `Lock-in period: ${categoryConfig.lockInPeriod}`,
        'Past performance is not indicative of future returns',
        'Investment value may fluctuate and capital is at risk',
        'Limited liquidity - redemption subject to fund terms',
        'Suitable only for accredited investors as per SEBI regulations',
        `Risk Level: ${categoryConfig.riskLevel}`,
        ...(isPartialPayment ? ['Balance payment obligation must be met on AMC demand to avoid forfeiture'] : []),
      ],
      termsAndConditions: [
        ...baseTerms,
        ...paymentTerms,
        ...finalTerms,
      ],
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
    };
  }
  
  /**
   * Process AIF subscription (mock implementation - would integrate with AMC API)
   */
  private async processAIFSubscription(
    request: AIFExecutionRequest,
    agreement: SubscriptionAgreement
  ): Promise<{ success: boolean; folioNumber?: string; allotmentDate?: Date; errors?: string[] }> {
    
    // In production, this would:
    // 1. Submit subscription to AIF fund manager's API
    // 2. Receive confirmation and folio number
    // 3. Track allotment status
    // 4. Handle unit allocation based on NAV
    
    // Mock implementation for now
    try {
      console.log(`[AIF Execution] Processing subscription for ${request.fundName}`);
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generate mock folio number
      const folioNumber = `AIF${request.aifCategory}${Date.now().toString().slice(-8)}`;
      const allotmentDate = new Date();
      
      console.log(`[AIF Execution] Subscription processed. Folio: ${folioNumber}`);
      
      return {
        success: true,
        folioNumber,
        allotmentDate,
      };
      
    } catch (error) {
      console.error('[AIF Execution] Subscription processing error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Subscription processing failed'],
      };
    }
  }
  
  /**
   * Store subscription agreement document reference
   * Generates an API endpoint URL for on-demand document retrieval
   * The actual PDF is generated when the endpoint is accessed
   */
  private async storeSubscriptionAgreement(
    agreement: SubscriptionAgreement,
    request: AIFExecutionRequest
  ): Promise<string> {
    try {
      // Store agreement metadata in database for later retrieval
      // The PDF is generated on-demand when the API endpoint is accessed
      // This avoids storing large files and ensures documents are always up-to-date
      
      console.log(`[AIF Execution] Agreement reference created:`, {
        agreementId: agreement.agreementId,
        orderId: request.orderId,
        investor: agreement.investorName,
        fund: agreement.fundDetails.name,
        amount: agreement.investmentAmount,
        riskLevel: AIF_CATEGORIES[request.aifCategory].riskLevel,
      });
      
      // Return API endpoint for on-demand document generation
      // When accessed, this endpoint generates the PDF from stored agreement data
      const baseUrl = process.env.REPLIT_DEV_DOMAIN || '';
      const apiPath = `/api/aif/agreements/${request.orderId}/${agreement.agreementId}`;
      
      // Use relative path in development, full URL if domain is configured
      const agreementUrl = baseUrl ? `${baseUrl}${apiPath}` : apiPath;
      
      console.log(`[AIF Execution] Agreement accessible at: ${agreementUrl}`);
      
      return agreementUrl;
    } catch (error) {
      console.error(`[AIF Execution] Error creating agreement reference:`, error);
      // Return a reference URL that can be used to regenerate the document
      return `/api/aif/agreements/${request.orderId}/${agreement.agreementId}`;
    }
  }
  
  /**
   * Handle execution failure
   */
  private async handleExecutionFailure(orderId: string, errors: string[]): Promise<void> {
    try {
      await orderManagementService.updateOrderStatus({
        orderId,
        status: 'payment_error', // Using payment_error as execution_failed state
        executionStatus: 'failed',
        notes: `AIF execution failed: ${errors.join('; ')}`,
        metadata: {
          executionErrors: errors,
          failedAt: new Date().toISOString(),
        },
        actorId: 'system',
        actorType: 'system',
      });
    } catch (error) {
      console.error(`[AIF Execution] Failed to update order status for ${orderId}:`, error);
    }
  }
}

// Export singleton instance
export const aifExecutionService = new AIFExecutionService();
