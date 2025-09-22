import { z } from 'zod';

// TaxCloud India API Configuration
const TAXCLOUD_BASE_URL = process.env.TAXCLOUD_BASE_URL || 'https://api.taxcloud.in';
const TAXCLOUD_ENVIRONMENT = process.env.TAXCLOUD_ENVIRONMENT || 'sandbox';

// Types for Income Tax Return filing
export const ITRFormDataSchema = z.object({
  // Personal Information
  personalInfo: z.object({
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dateOfBirth: z.string(),
    email: z.string().email('Invalid email format'),
    phone: z.string().min(10, 'Phone number must be 10 digits'),
    aadhar: z.string().regex(/^[0-9]{12}$/, 'Invalid Aadhar number'),
    address: z.object({
      line1: z.string().min(1, 'Address is required'),
      line2: z.string().optional(),
      city: z.string().min(1, 'City is required'),
      state: z.string().min(1, 'State is required'),
      pincode: z.string().regex(/^[0-9]{6}$/, 'Invalid pincode'),
    }),
  }),
  
  // Income Details
  incomeDetails: z.object({
    salaryIncome: z.number().min(0, 'Salary income must be non-negative'),
    businessIncome: z.number().min(0, 'Business income must be non-negative'),
    capitalGains: z.number().min(0, 'Capital gains must be non-negative'),
    otherIncome: z.number().min(0, 'Other income must be non-negative'),
    interestIncome: z.number().min(0, 'Interest income must be non-negative'),
    rentalIncome: z.number().min(0, 'Rental income must be non-negative'),
    dividendIncome: z.number().min(0, 'Dividend income must be non-negative'),
  }),
  
  // Deductions
  deductions: z.object({
    section80C: z.number().min(0, 'Section 80C deduction must be non-negative'),
    section80D: z.number().min(0, 'Section 80D deduction must be non-negative'),
    section80G: z.number().min(0, 'Section 80G deduction must be non-negative'),
    homeLoanInterest: z.number().min(0, 'Home loan interest must be non-negative'),
    standardDeduction: z.number().min(0, 'Standard deduction must be non-negative'),
    professionalTax: z.number().min(0, 'Professional tax must be non-negative'),
    otherDeductions: z.number().min(0, 'Other deductions must be non-negative'),
  }),
  
  // Tax Payments (TDS, Advance Tax, etc.)
  taxPayments: z.object({
    tdsDeducted: z.number().min(0, 'TDS deducted must be non-negative'),
    advanceTaxPaid: z.number().min(0, 'Advance tax paid must be non-negative'),
    selfAssessmentTax: z.number().min(0, 'Self assessment tax must be non-negative'),
  }),
  
  // Bank Details for Refund
  bankDetails: z.object({
    accountNumber: z.string().min(9, 'Invalid account number'),
    ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
    bankName: z.string().min(1, 'Bank name is required'),
    accountHolderName: z.string().min(1, 'Account holder name is required'),
  }),
  
  // Filing Details
  filingDetails: z.object({
    assessmentYear: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid assessment year format (YYYY-YY)'),
    itrForm: z.enum(['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4', 'ITR-5', 'ITR-6', 'ITR-7']),
    filingStatus: z.enum(['Original', 'Revised']),
    isDefective: z.boolean().default(false),
    acknowledgmentNumber: z.string().optional(),
  }),
});

export type ITRFormData = z.infer<typeof ITRFormDataSchema>;

// ITR Filing Response Types
export interface ITRFilingResponse {
  success: boolean;
  message: string;
  data?: {
    acknowledgmentNumber: string;
    filingDate: string;
    taxLiability: number;
    refundAmount: number;
    itrVFilePath?: string;
    receiptNumber: string;
    status: 'Filed' | 'Processing' | 'Verified' | 'Failed';
  };
  errors?: string[];
}

export interface ITRStatusResponse {
  success: boolean;
  data?: {
    acknowledgmentNumber: string;
    status: 'Filed' | 'Processing' | 'Verified' | 'Failed' | 'Defective';
    filingDate: string;
    verificationDate?: string;
    refundStatus?: 'Pending' | 'Processed' | 'Issued';
    refundAmount?: number;
    taxLiability: number;
  };
  message: string;
}

export interface ITRCalculationResponse {
  success: boolean;
  data?: {
    totalIncome: number;
    taxableIncome: number;
    totalDeductions: number;
    taxLiability: number;
    taxPaid: number;
    refundAmount: number;
    taxPayable: number;
    effectiveTaxRate: number;
  };
  message: string;
}

class TaxCloudITRService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.TAXCLOUD_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ TaxCloud API key not configured. ITR services will use mock data.');
    }
  }

  private async makeAPICall(endpoint: string, data?: any, method: 'GET' | 'POST' | 'PUT' = 'GET') {
    if (!this.apiKey) {
      // Return mock data when API key is not available
      return this.getMockResponse(endpoint, data);
    }

    try {
      const response = await fetch(`${TAXCLOUD_BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        // Future-proof: Omit body for GET requests regardless of data parameter
        body: method === 'GET' ? undefined : (data ? JSON.stringify(data) : undefined),
      });

      if (!response.ok) {
        throw new Error(`TaxCloud API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('TaxCloud API call failed:', error);
      throw error;
    }
  }

  private calculateMockTax(taxableIncome: number): number {
    // Simple progressive tax calculation for mock
    if (taxableIncome <= 300000) return 0;
    if (taxableIncome <= 600000) return (taxableIncome - 300000) * 0.05;
    if (taxableIncome <= 900000) return 15000 + (taxableIncome - 600000) * 0.10;
    if (taxableIncome <= 1200000) return 45000 + (taxableIncome - 900000) * 0.15;
    if (taxableIncome <= 1500000) return 90000 + (taxableIncome - 1200000) * 0.20;
    return 150000 + (taxableIncome - 1500000) * 0.30;
  }

  private getMockResponse(endpoint: string, data?: any) {
    // Mock responses for development/testing
    if (endpoint.includes('/calculate-tax')) {
      // Include all income sources using nullish coalescing
      const totalIncome = (data?.incomeDetails?.salaryIncome ?? 0) + 
                         (data?.incomeDetails?.businessIncome ?? 0) + 
                         (data?.incomeDetails?.capitalGains ?? 0) +
                         (data?.incomeDetails?.otherIncome ?? 0) +
                         (data?.incomeDetails?.interestIncome ?? 0) +
                         (data?.incomeDetails?.rentalIncome ?? 0) +
                         (data?.incomeDetails?.dividendIncome ?? 0);
      
      const totalDeductions = (data?.deductions?.section80C ?? 0) + 
                             (data?.deductions?.section80D ?? 0) + 
                             (data?.deductions?.section80G ?? 0) +
                             (data?.deductions?.homeLoanInterest ?? 0) +
                             (data?.deductions?.standardDeduction ?? 50000) +
                             (data?.deductions?.professionalTax ?? 0) +
                             (data?.deductions?.otherDeductions ?? 0);
      
      const taxableIncome = Math.max(0, totalIncome - totalDeductions);
      const taxLiability = this.calculateMockTax(taxableIncome);
      const taxPaid = data?.taxPayments?.tdsDeducted ?? 0;
      
      return {
        success: true,
        data: {
          totalIncome,
          taxableIncome,
          totalDeductions,
          taxLiability,
          taxPaid,
          refundAmount: Math.max(0, taxPaid - taxLiability),
          taxPayable: Math.max(0, taxLiability - taxPaid),
          effectiveTaxRate: totalIncome > 0 ? (taxLiability / totalIncome) * 100 : 0,
        },
        message: 'Tax calculation completed (Mock Data)'
      };
    }

    if (endpoint.includes('/file-itr')) {
      return {
        success: true,
        data: {
          acknowledgmentNumber: `ITR${Date.now()}`,
          filingDate: new Date().toISOString(),
          taxLiability: 45000,
          refundAmount: 5000,
          receiptNumber: `REC${Date.now()}`,
          status: 'Filed' as const,
        },
        message: 'ITR filed successfully (Mock Data)'
      };
    }

    if (endpoint.includes('/itr-status')) {
      // Parse acknowledgment number from URL path since GET doesn't have body
      const acknowledgmentNumber = endpoint.split('/').pop() || `ITR${Date.now()}`;
      return {
        success: true,
        data: {
          acknowledgmentNumber,
          status: 'Filed' as const,
          filingDate: new Date().toISOString(),
          taxLiability: 45000,
          refundStatus: 'Pending' as const,
          refundAmount: 5000,
        },
        message: 'ITR status retrieved successfully (Mock Data)'
      };
    }

    if (endpoint.includes('/download-itr-v')) {
      return {
        success: true,
        data: {
          downloadUrl: `/mock-itr-v/${endpoint.split('/').pop()}.pdf`,
          fileName: `ITR-V-${endpoint.split('/').pop()}.pdf`,
          contentType: 'application/pdf'
        },
        message: 'ITR-V download link generated (Mock Data)'
      };
    }

    return { success: false, message: 'Unknown endpoint' };
  }

  /**
   * Calculate tax liability based on income and deductions
   */
  async calculateTax(formData: ITRFormData): Promise<ITRCalculationResponse> {
    try {
      // Validate input data
      const validatedData = ITRFormDataSchema.parse(formData);
      
      const response = await this.makeAPICall('/api/v1/calculate-tax', validatedData, 'POST');
      return response;
    } catch (error) {
      console.error('Tax calculation error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Tax calculation failed'
      };
    }
  }

  /**
   * File Income Tax Return
   */
  async fileITR(formData: ITRFormData): Promise<ITRFilingResponse> {
    try {
      // Validate input data
      const validatedData = ITRFormDataSchema.parse(formData);
      
      const response = await this.makeAPICall('/api/v1/file-itr', validatedData, 'POST');
      return response;
    } catch (error) {
      console.error('ITR filing error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'ITR filing failed',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Check ITR filing status
   */
  async getITRStatus(acknowledgmentNumber: string): Promise<ITRStatusResponse> {
    try {
      if (!acknowledgmentNumber) {
        throw new Error('Acknowledgment number is required');
      }

      // Fix: Remove JSON body from GET request
      const response = await this.makeAPICall(
        `/api/v1/itr-status/${acknowledgmentNumber}`,
        undefined,
        'GET'
      );
      return response;
    } catch (error) {
      console.error('ITR status check error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Status check failed'
      };
    }
  }

  /**
   * Download ITR-V form
   */
  async downloadITRV(acknowledgmentNumber: string): Promise<{
    success: boolean;
    data?: { downloadUrl: string; fileName: string };
    message: string;
  }> {
    try {
      if (!acknowledgmentNumber) {
        throw new Error('Acknowledgment number is required');
      }

      const response = await this.makeAPICall(
        `/api/v1/download-itr-v/${acknowledgmentNumber}`,
        undefined,
        'GET'
      );

      if (response.success) {
        return {
          success: true,
          data: {
            downloadUrl: response.data?.downloadUrl || `/mock-itr-v/${acknowledgmentNumber}.pdf`,
            fileName: `ITR-V-${acknowledgmentNumber}.pdf`
          },
          message: 'ITR-V download link generated successfully'
        };
      }

      return response;
    } catch (error) {
      console.error('ITR-V download error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'ITR-V download failed'
      };
    }
  }

  /**
   * Get available ITR forms based on income sources
   */
  getSuitableITRForm(incomeDetails: ITRFormData['incomeDetails']): string {
    const { salaryIncome, businessIncome, capitalGains, rentalIncome } = incomeDetails;
    
    // ITR-1 (Sahaj) - For salary income up to 50 lakhs with no business/capital gains
    if (salaryIncome <= 5000000 && businessIncome === 0 && capitalGains === 0 && rentalIncome === 0) {
      return 'ITR-1';
    }
    
    // ITR-4 (Sugam) - For presumptive business income up to 2 crores
    if (businessIncome > 0 && businessIncome <= 20000000) {
      return 'ITR-4';
    }
    
    // ITR-3 - For individuals with business/professional income above presumptive limit
    if (businessIncome > 20000000) {
      return 'ITR-3';
    }
    
    // ITR-2 - For individuals with capital gains or rental income
    if (businessIncome === 0 && (capitalGains > 0 || rentalIncome > 0)) {
      return 'ITR-2';
    }
    
    // Default to ITR-2 for other cases
    return 'ITR-2';
  }

  /**
   * Validate PAN number format
   */
  validatePAN(pan: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  /**
   * Get tax calculation summary
   */
  getTaxSummary(calculationData: ITRCalculationResponse['data']) {
    if (!calculationData) return null;

    return {
      totalIncome: calculationData.totalIncome,
      taxableIncome: calculationData.taxableIncome,
      totalDeductions: calculationData.totalDeductions,
      taxLiability: calculationData.taxLiability,
      netPayable: calculationData.taxPayable,
      refundDue: calculationData.refundAmount,
      effectiveRate: `${calculationData.effectiveTaxRate}%`,
    };
  }
}

// Export singleton instance
export const taxCloudITRService = new TaxCloudITRService();
export default taxCloudITRService;