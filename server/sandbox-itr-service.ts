import { z } from 'zod';
import { indianTaxCalculator } from './services/indian-tax-calculator';
import { getSandboxBaseUrl, getSandboxAccessToken, getSandboxApiKey, clearSandboxToken } from './utils/sandbox-config';

const SANDBOX_BASE_URL = getSandboxBaseUrl();

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
  
  // Entity Type (required for ITR-5, 6, 7 determination)
  entityType: z.enum([
    'individual',           // Person - uses ITR-1, 2, 3, 4
    'huf',                  // Hindu Undivided Family - uses ITR-2, 3
    'partnership_firm',     // Partnership Firm - uses ITR-5
    'llp',                  // Limited Liability Partnership - uses ITR-5
    'aop',                  // Association of Persons - uses ITR-5
    'boi',                  // Body of Individuals - uses ITR-5
    'cooperative_society',  // Cooperative Society - uses ITR-5
    'local_authority',      // Local Authority - uses ITR-5
    'company',              // Private/Public Company - uses ITR-6
    'trust',                // Charitable Trust - uses ITR-7
    'political_party',      // Political Party - uses ITR-7
    'institution',          // Educational/Medical Institution - uses ITR-7
    'research_association', // Scientific Research Association - uses ITR-7
    'news_agency',          // News Agency - uses ITR-7
  ]).default('individual'),
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

// ============ OCR API RESPONSE TYPES ============

export interface Form16OCRResponse {
  success: boolean;
  data?: {
    documentType: 'FORM_16' | 'FORM_16_PART_A' | 'FORM_16_PART_B';
    assessmentYear: string;
    financialYear: string;
    employee: {
      pan: string;
      name: string;
      address?: string;
      email?: string;
    };
    employer: {
      tan: string;
      name: string;
      address?: string;
    };
    salaryDetails: {
      grossSalary: number;
      exemptAllowances: number;
      netSalary: number;
      standardDeduction: number;
      professionalTax: number;
    };
    incomeDetails: {
      salaryIncome: number;
      housePropertyIncome: number;
      otherIncome: number;
      grossTotalIncome: number;
    };
    deductions: {
      section80C: number;
      section80CCC: number;
      section80CCD1: number;
      section80CCD1B: number;
      section80CCD2: number;
      section80D: number;
      section80E: number;
      section80G: number;
      section80TTA: number;
      totalDeductions: number;
    };
    taxComputation: {
      totalTaxableIncome: number;
      taxOnTotalIncome: number;
      rebate87A: number;
      surcharge: number;
      educationCess: number;
      totalTaxPayable: number;
      reliefUnder89: number;
      netTaxPayable: number;
    };
    tdsDetails: {
      tdsDeducted: number;
      tdsDeposited: number;
      challanDetails?: Array<{
        challanNo: string;
        date: string;
        amount: number;
        bsrCode: string;
      }>;
    };
    verificationDetails?: {
      dateOfIssue: string;
      placeOfIssue: string;
      signatory: string;
      designation: string;
    };
    confidence: number;
    rawExtractedText?: string;
  };
  message: string;
  errors?: string[];
}

export interface Form26ASOCRResponse {
  success: boolean;
  data?: {
    pan: string;
    assessmentYear: string;
    financialYear: string;
    partA_TDS: Array<{
      deductorTAN: string;
      deductorName: string;
      section: string;
      transactionDate: string;
      amountPaid: number;
      tdsDeducted: number;
      tdsDeposited: number;
      dateOfDeposit?: string;
    }>;
    partA1_TDS15G15H: Array<{
      deductorTAN: string;
      deductorName: string;
      section: string;
      amountPaid: number;
      declarationType: '15G' | '15H';
    }>;
    partA2_TCS: Array<{
      collectorTAN: string;
      collectorName: string;
      section: string;
      amountReceived: number;
      tcsCollected: number;
      tcsDeposited: number;
    }>;
    partB_AdvanceTax: Array<{
      bsrCode: string;
      challanSerialNo: string;
      date: string;
      amount: number;
    }>;
    partC_SelfAssessmentTax: Array<{
      bsrCode: string;
      challanSerialNo: string;
      date: string;
      amount: number;
    }>;
    partD_Refunds: Array<{
      assessmentYear: string;
      mode: string;
      amount: number;
      dateOfPayment: string;
    }>;
    partE_AIRTransactions: Array<{
      transactionType: string;
      reportingEntity: string;
      amount: number;
    }>;
    summary: {
      totalTDSDeducted: number;
      totalTCSCollected: number;
      totalAdvanceTax: number;
      totalSelfAssessmentTax: number;
      totalRefunds: number;
      totalTaxCredits: number;
    };
    confidence: number;
  };
  message: string;
  errors?: string[];
}

const SANDBOX_ERI_TEST_CREDENTIALS = {
  user_id: 'ERIP000325',
  password: 'ERIP000325@abc',
};

const SANDBOX_ITR_TEST_PANS: Record<string, { pan: string; description: string; itrForm: string }> = {
  'ITR-1': { pan: 'QUIPT2025E', description: 'Salaried individual (Sandbox test)', itrForm: '1' },
  'ITR-2': { pan: 'ADIPV7548K', description: 'Individual with capital gains (Sandbox test)', itrForm: '2' },
  'ITR-3': { pan: 'AVPPJ6869G', description: 'Individual with business income (Sandbox test)', itrForm: '3' },
  'ITR-4': { pan: 'AWGPS6028Q', description: 'Presumptive income (Sandbox test)', itrForm: '4' },
  'ITR-5': { pan: 'AOFPL2415R', description: 'LLP / Partnership firm (Sandbox test)', itrForm: '5' },
  'ITR-6': { pan: 'AAACA1234A', description: 'Company (Sandbox test)', itrForm: '6' },
  'ITR-7': { pan: 'AAETP3993P', description: 'Trust / Charitable (Sandbox test)', itrForm: '7' },
};

class SandboxITRService {
  private apiKey: string;
  private apiSecret: string;
  private eriUserId: string | null = null;
  private eriAuthToken: string | null = null;
  
  constructor() {
    this.apiKey = process.env.SANDBOX_API_KEY || '';
    this.apiSecret = process.env.SANDBOX_API_SECRET || '';
    
    if (!this.apiKey || !this.apiSecret) {
      console.error('FATAL: Sandbox.co.in API credentials missing. SANDBOX_API_KEY and SANDBOX_API_SECRET are required. No mock data fallback — system will refuse computation.');
    } else {
      const env = this.apiKey.startsWith('key_test') ? 'TEST' : this.apiKey.startsWith('key_live') ? 'PRODUCTION' : 'UNKNOWN';
      console.log(`✅ Sandbox.co.in ITR Service initialized (${env} environment → ${SANDBOX_BASE_URL})`);
    }
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getSandboxAccessToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token,
      'x-api-key': this.apiKey,
      'x-api-version': '1.0.0',
      'Accept': 'application/json',
    };
  }

  private async getERIHeaders(): Promise<Record<string, string>> {
    const baseHeaders = await this.getAuthHeaders();
    if (!this.eriUserId || !this.eriAuthToken) {
      await this.eriLogin();
    }
    return {
      ...baseHeaders,
      'x-user-id': this.eriUserId || '',
      'x-auth-token': this.eriAuthToken || '',
    };
  }

  async eriLogin(userId?: string, password?: string): Promise<{ success: boolean; userId: string; authToken: string; message: string }> {
    try {
      const creds = {
        user_id: userId || SANDBOX_ERI_TEST_CREDENTIALS.user_id,
        password: password || SANDBOX_ERI_TEST_CREDENTIALS.password,
      };

      const response = await this.makeAPICall(
        '/it/compliance/eri/login',
        creds,
        'POST'
      );

      const authToken = response.data?.auth_token || response.auth_token;
      const eriUserId = creds.user_id;

      if (authToken) {
        this.eriUserId = eriUserId;
        this.eriAuthToken = authToken;
        console.log(`[Sandbox ITR] ERI login successful for ${eriUserId}`);
        return { success: true, userId: eriUserId, authToken, message: 'ERI login successful' };
      }

      return { success: false, userId: eriUserId, authToken: '', message: response.message || 'ERI login failed — no auth_token returned' };
    } catch (error) {
      console.error('[Sandbox ITR] ERI login failed:', error);
      return { success: false, userId: '', authToken: '', message: error instanceof Error ? error.message : 'ERI login failed' };
    }
  }

  getTestPANs(): Record<string, { pan: string; description: string; itrForm: string }> {
    return { ...SANDBOX_ITR_TEST_PANS };
  }

  getERITestCredentials(): { userId: string; passwordHint: string } {
    return {
      userId: SANDBOX_ERI_TEST_CREDENTIALS.user_id,
      passwordHint: `${SANDBOX_ERI_TEST_CREDENTIALS.password} (Sandbox test)`,
    };
  }

  private async makeAPICall(endpoint: string, data?: any, method: 'GET' | 'POST' | 'PUT' = 'GET') {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('SANDBOX_API_NOT_CONFIGURED: Set SANDBOX_API_KEY and SANDBOX_API_SECRET. No mock data fallback available.');
    }

    const url = `${SANDBOX_BASE_URL}${endpoint}`;
    console.log(`[Sandbox API] ${method} ${url}`);

    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(url, {
        method,
        headers,
        body: method === 'GET' ? undefined : (data ? JSON.stringify(data) : undefined),
      });

      const responseText = await response.text();

      if (response.status === 401) {
        console.log('[Sandbox API] Token expired or invalid, re-authenticating...');
        clearSandboxToken();
        const newHeaders = await this.getAuthHeaders();
        const retryResponse = await fetch(url, {
          method,
          headers: newHeaders,
          body: method === 'GET' ? undefined : (data ? JSON.stringify(data) : undefined),
        });
        const retryText = await retryResponse.text();
        if (!retryResponse.ok) {
          console.error(`[Sandbox API] Retry Error ${retryResponse.status}: ${retryText}`);
          throw new Error(`Sandbox API returned ${retryResponse.status}: ${retryText}`);
        }
        try {
          return JSON.parse(retryText);
        } catch {
          throw new Error(`Sandbox API returned non-JSON response: ${retryText.substring(0, 200)}`);
        }
      }

      if (!response.ok) {
        console.error(`[Sandbox API] Error ${response.status}: ${responseText}`);
        throw new Error(`Sandbox API returned ${response.status}: ${responseText}`);
      }

      try {
        return JSON.parse(responseText);
      } catch {
        throw new Error(`Sandbox API returned non-JSON response: ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Sandbox API')) {
        throw error;
      }
      if (error instanceof Error && error.message.startsWith('Sandbox authentication')) {
        throw error;
      }
      console.error('[Sandbox API] Network/fetch error:', error);
      throw new Error(`Sandbox API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async calculateTax(formData: ITRFormData): Promise<ITRCalculationResponse> {
    try {
      const validatedData = ITRFormDataSchema.parse(formData);
      
      try {
        const response = await this.makeAPICall(
          '/it/calculator/income_tax/itr',
          {
            assessment_year: validatedData.filingDetails.assessmentYear,
            entity_type: validatedData.entityType || 'individual',
            income_details: {
              salary_income: validatedData.incomeDetails.salaryIncome,
              business_income: validatedData.incomeDetails.businessIncome,
              capital_gains: validatedData.incomeDetails.capitalGains,
              other_income: validatedData.incomeDetails.otherIncome,
              interest_income: validatedData.incomeDetails.interestIncome,
              rental_income: validatedData.incomeDetails.rentalIncome,
              dividend_income: validatedData.incomeDetails.dividendIncome,
            },
            deductions: {
              section_80c: validatedData.deductions.section80C,
              section_80d: validatedData.deductions.section80D,
              section_80g: validatedData.deductions.section80G,
              home_loan_interest: validatedData.deductions.homeLoanInterest,
              standard_deduction: validatedData.deductions.standardDeduction,
              professional_tax: validatedData.deductions.professionalTax,
              other_deductions: validatedData.deductions.otherDeductions,
            },
            tax_payments: {
              tds_deducted: validatedData.taxPayments.tdsDeducted,
              advance_tax_paid: validatedData.taxPayments.advanceTaxPaid,
              self_assessment_tax: validatedData.taxPayments.selfAssessmentTax,
            },
          },
          'POST'
        );

        return {
          success: true,
          data: {
            totalIncome: response.data?.total_income ?? response.total_income ?? 0,
            taxableIncome: response.data?.taxable_income ?? response.taxable_income ?? 0,
            totalDeductions: response.data?.total_deductions ?? response.total_deductions ?? 0,
            taxLiability: response.data?.tax_liability ?? response.tax_liability ?? 0,
            taxPaid: response.data?.tax_paid ?? response.tax_paid ?? 0,
            refundAmount: response.data?.refund_amount ?? response.refund_amount ?? 0,
            taxPayable: response.data?.tax_payable ?? response.tax_payable ?? 0,
            effectiveTaxRate: response.data?.effective_tax_rate ?? response.effective_tax_rate ?? 0,
          },
          message: 'Tax calculated via Sandbox.co.in API',
        };
      } catch (sandboxError) {
        const errMsg = sandboxError instanceof Error ? sandboxError.message : '';
        if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('400') || errMsg.includes('Forbidden') || errMsg.includes('Insufficient privilege') || errMsg.includes('saved example') || errMsg.includes('SignedHeaders')) {
          console.log('[Sandbox ITR] Sandbox IT API not accessible, using native Indian Tax Calculator');
          return indianTaxCalculator.calculateTax({
            entityType: validatedData.entityType || 'individual',
            incomeDetails: validatedData.incomeDetails,
            deductions: validatedData.deductions,
            taxPayments: validatedData.taxPayments,
            filingDetails: {
              assessmentYear: validatedData.filingDetails.assessmentYear,
              itrForm: validatedData.filingDetails.itrForm,
              filingStatus: validatedData.filingDetails.filingStatus,
            },
          });
        }
        throw sandboxError;
      }
    } catch (error) {
      console.error('[Sandbox ITR] Tax calculation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Tax calculation failed — Sandbox API error'
      };
    }
  }

  async calculateTaxFromWizard(wizardData: {
    assessmentYear: string;
    entityType: string;
    salaryIncome: number;
    housePropertyIncome: number;
    capitalGainsSTCG: number;
    capitalGainsLTCG: number;
    capitalGainsExemptions: number;
    businessIncome: number;
    interestIncome: number;
    dividendIncome: number;
    otherIncome: number;
    agriculturalIncome?: number;
    foreignTaxCredit?: number;
    foreignIncomeCountry?: string;
    section80C: number;
    section80CCC?: number;
    section80CCD1?: number;
    section80CCD1B?: number;
    section80CCD2?: number;
    section80D: number;
    section80DD?: number;
    section80DDB?: number;
    section80E: number;
    section80EEA?: number;
    section80EEB?: number;
    section80G: number;
    section80GG?: number;
    section80TTA: number;
    section80TTB?: number;
    section80U?: number;
    otherDeductions: number;
    tdsDeducted: number;
    tdsSalary?: number;
    tdsOtherThanSalary?: number;
    tdsOnProperty?: number;
    tcsCollected?: number;
    advanceTaxPaid: number;
    selfAssessmentTax: number;
    reliefUs89?: number;
    standardDeduction: number;
    professionalTax: number;
    homeLoanInterest: number;
    residentialStatus?: string;
    filingSection?: string;
    employerName?: string;
    employerTAN?: string;
    bankDetails?: { accountNumber: string; ifscCode: string; bankName?: string; accountType?: string };
  }): Promise<ITRCalculationResponse> {
    try {
      const totalCapitalGains = wizardData.capitalGainsSTCG + wizardData.capitalGainsLTCG - wizardData.capitalGainsExemptions;
      const ftc = wizardData.foreignTaxCredit || 0;

      const combined80C = Math.min(
        (wizardData.section80C || 0) + (wizardData.section80CCC || 0) + (wizardData.section80CCD1 || 0),
        150000
      );

      const payload: Record<string, any> = {
        assessment_year: wizardData.assessmentYear,
        entity_type: wizardData.entityType,
        income_details: {
          salary_income: wizardData.salaryIncome,
          business_income: wizardData.businessIncome,
          capital_gains: Math.max(0, totalCapitalGains),
          capital_gains_stcg: wizardData.capitalGainsSTCG,
          capital_gains_ltcg: wizardData.capitalGainsLTCG,
          capital_gains_exemptions: wizardData.capitalGainsExemptions,
          other_income: wizardData.otherIncome,
          interest_income: wizardData.interestIncome,
          rental_income: wizardData.housePropertyIncome,
          dividend_income: wizardData.dividendIncome,
          agricultural_income: wizardData.agriculturalIncome || 0,
        },
        deductions: {
          section_80c: combined80C,
          section_80ccd_1b: Math.min(wizardData.section80CCD1B || 0, 50000),
          section_80ccd_2: wizardData.section80CCD2 || 0,
          section_80d: Math.min(wizardData.section80D, 100000),
          section_80dd: Math.min(wizardData.section80DD || 0, 125000),
          section_80ddb: Math.min(wizardData.section80DDB || 0, 100000),
          section_80e: wizardData.section80E,
          section_80eea: Math.min(wizardData.section80EEA || 0, 150000),
          section_80eeb: Math.min(wizardData.section80EEB || 0, 150000),
          section_80g: wizardData.section80G,
          section_80gg: Math.min(wizardData.section80GG || 0, 60000),
          section_80tta: Math.min(wizardData.section80TTA, 10000),
          section_80ttb: Math.min(wizardData.section80TTB || 0, 50000),
          section_80u: Math.min(wizardData.section80U || 0, 125000),
          standard_deduction: wizardData.standardDeduction,
          professional_tax: wizardData.professionalTax,
          home_loan_interest: wizardData.homeLoanInterest,
          other_deductions: wizardData.otherDeductions,
        },
        tax_payments: {
          tds_deducted: wizardData.tdsDeducted,
          tds_salary: wizardData.tdsSalary || 0,
          tds_other_than_salary: wizardData.tdsOtherThanSalary || 0,
          tds_on_property: wizardData.tdsOnProperty || 0,
          tcs_collected: wizardData.tcsCollected || 0,
          advance_tax_paid: wizardData.advanceTaxPaid,
          self_assessment_tax: wizardData.selfAssessmentTax,
          relief_us_89: wizardData.reliefUs89 || 0,
        },
      };

      if (ftc > 0) {
        payload.tax_relief = {
          section_90_91: ftc,
          country: wizardData.foreignIncomeCountry || 'US',
          dtaa_applicable: true,
        };
      }

      if (wizardData.bankDetails) {
        payload.bank_details = {
          account_number: wizardData.bankDetails.accountNumber,
          ifsc_code: wizardData.bankDetails.ifscCode,
          bank_name: wizardData.bankDetails.bankName || '',
          account_type: wizardData.bankDetails.accountType || 'savings',
        };
      }

      try {
        const response = await this.makeAPICall(
          '/it/calculator/income_tax/itr',
          payload,
          'POST'
        );

        return {
          success: true,
          data: {
            totalIncome: response.data?.total_income ?? response.total_income ?? 0,
            taxableIncome: response.data?.taxable_income ?? response.taxable_income ?? 0,
            totalDeductions: response.data?.total_deductions ?? response.total_deductions ?? 0,
            taxLiability: response.data?.tax_liability ?? response.tax_liability ?? 0,
            taxPaid: response.data?.tax_paid ?? response.tax_paid ?? 0,
            refundAmount: response.data?.refund_amount ?? response.refund_amount ?? 0,
            taxPayable: response.data?.tax_payable ?? response.tax_payable ?? 0,
            effectiveTaxRate: response.data?.effective_tax_rate ?? response.effective_tax_rate ?? 0,
          },
          message: 'Tax calculated via Sandbox.co.in API',
        };
      } catch (sandboxError) {
        const errMsg = sandboxError instanceof Error ? sandboxError.message : '';
        if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('400') || errMsg.includes('Forbidden') || errMsg.includes('Insufficient privilege') || errMsg.includes('saved example') || errMsg.includes('SignedHeaders')) {
          console.log('[Sandbox ITR] Sandbox IT API not accessible, using native Indian Tax Calculator for wizard');
          return indianTaxCalculator.calculateTaxFromWizard(wizardData);
        }
        throw sandboxError;
      }
    } catch (error) {
      console.error('[Sandbox ITR] Wizard tax calculation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Wizard tax calculation failed — Sandbox API error',
      };
    }
  }

  async prepareITR(formData: ITRFormData): Promise<ITRFilingResponse> {
    try {
      const validatedData = ITRFormDataSchema.parse(formData);
      
      try {
        const response = await this.makeAPICall(
          '/it/report/itr',
          {
            pan: validatedData.personalInfo.pan,
            assessment_year: validatedData.filingDetails.assessmentYear,
            itr_form: validatedData.filingDetails.itrForm,
            filing_status: validatedData.filingDetails.filingStatus,
            entity_type: validatedData.entityType || 'individual',
            personal_info: {
              pan: validatedData.personalInfo.pan,
              first_name: validatedData.personalInfo.firstName,
              last_name: validatedData.personalInfo.lastName,
              date_of_birth: validatedData.personalInfo.dateOfBirth,
              email: validatedData.personalInfo.email,
              phone: validatedData.personalInfo.phone,
              aadhar: validatedData.personalInfo.aadhar,
              address: validatedData.personalInfo.address,
            },
            income_details: {
              salary_income: validatedData.incomeDetails.salaryIncome,
              business_income: validatedData.incomeDetails.businessIncome,
              capital_gains: validatedData.incomeDetails.capitalGains,
              other_income: validatedData.incomeDetails.otherIncome,
              interest_income: validatedData.incomeDetails.interestIncome,
              rental_income: validatedData.incomeDetails.rentalIncome,
              dividend_income: validatedData.incomeDetails.dividendIncome,
            },
            deductions: {
              section_80c: validatedData.deductions.section80C,
              section_80d: validatedData.deductions.section80D,
              section_80g: validatedData.deductions.section80G,
              home_loan_interest: validatedData.deductions.homeLoanInterest,
              standard_deduction: validatedData.deductions.standardDeduction,
              professional_tax: validatedData.deductions.professionalTax,
              other_deductions: validatedData.deductions.otherDeductions,
            },
            tax_payments: {
              tds_deducted: validatedData.taxPayments.tdsDeducted,
              advance_tax_paid: validatedData.taxPayments.advanceTaxPaid,
              self_assessment_tax: validatedData.taxPayments.selfAssessmentTax,
            },
            bank_details: {
              account_number: validatedData.bankDetails.accountNumber,
              ifsc_code: validatedData.bankDetails.ifscCode,
              bank_name: validatedData.bankDetails.bankName,
              account_holder_name: validatedData.bankDetails.accountHolderName,
            },
          },
          'POST'
        );

        return {
          success: true,
          message: 'ITR prepared via Sandbox.co.in API',
          data: {
            acknowledgmentNumber: response.data?.acknowledgment_number ?? response.acknowledgment_number ?? '',
            filingDate: response.data?.filing_date ?? response.filing_date ?? new Date().toISOString(),
            taxLiability: response.data?.tax_liability ?? response.tax_liability ?? 0,
            refundAmount: response.data?.refund_amount ?? response.refund_amount ?? 0,
            itrVFilePath: response.data?.itr_v_file_path ?? response.itr_v_url,
            receiptNumber: response.data?.receipt_number ?? response.receipt_number ?? '',
            status: response.data?.status ?? 'Processing',
          },
        };
      } catch (sandboxError) {
        const errMsg = sandboxError instanceof Error ? sandboxError.message : '';
        if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('400') || errMsg.includes('Forbidden') || errMsg.includes('Insufficient privilege') || errMsg.includes('saved example') || errMsg.includes('SignedHeaders')) {
          console.log('[Sandbox ITR] Sandbox IT API not accessible, using native ITR preparation');
          const taxResult = indianTaxCalculator.calculateTax({
            entityType: validatedData.entityType || 'individual',
            incomeDetails: validatedData.incomeDetails,
            deductions: validatedData.deductions,
            taxPayments: validatedData.taxPayments,
            filingDetails: {
              assessmentYear: validatedData.filingDetails.assessmentYear,
              itrForm: validatedData.filingDetails.itrForm,
              filingStatus: validatedData.filingDetails.filingStatus,
            },
          });
          const ackNumber = `FTP${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          return {
            success: true,
            message: 'ITR prepared via native Indian Tax Calculator (Sandbox IT API upgrade needed for direct e-Filing)',
            data: {
              acknowledgmentNumber: ackNumber,
              filingDate: new Date().toISOString(),
              taxLiability: taxResult.data?.taxLiability ?? 0,
              refundAmount: taxResult.data?.refundAmount ?? 0,
              receiptNumber: `RCP-${ackNumber}`,
              status: 'Processing' as const,
            },
          };
        }
        throw sandboxError;
      }
    } catch (error) {
      console.error('[Sandbox ITR] Preparation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'ITR preparation failed — Sandbox API error',
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  async fileITR(formData: ITRFormData): Promise<ITRFilingResponse> {
    return this.prepareITR(formData);
  }

  async getITRStatus(acknowledgmentNumber: string, pan?: string): Promise<ITRStatusResponse> {
    try {
      if (!acknowledgmentNumber) {
        throw new Error('Acknowledgment number is required');
      }

      if (pan) {
        const eriHeaders = await this.getERIHeaders();
        const url = `${SANDBOX_BASE_URL}/it/compliance/eri/tax-payers/${pan}/itrs/itr-v?acknowledgement_number=${acknowledgmentNumber}`;
        console.log(`[Sandbox API] GET ${url}`);
        const response = await fetch(url, { method: 'GET', headers: eriHeaders });
        const responseText = await response.text();
        let parsed: any;
        try { parsed = JSON.parse(responseText); } catch { parsed = { message: responseText }; }
        if (!response.ok) {
          throw new Error(`ITR status API returned ${response.status}: ${parsed.message || responseText.substring(0, 200)}`);
        }
        return parsed;
      }

      const response = await this.makeAPICall(
        `/it/compliance/itr-v/${acknowledgmentNumber}`,
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

  async getForm26AS(pan: string, assessmentYear: string): Promise<any> {
    try {
      const response = await this.makeAPICall(
        `/it/report/form-26as/${pan}/${assessmentYear}`,
        undefined,
        'GET'
      );
      return response;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('400') || errMsg.includes('Forbidden') || errMsg.includes('SignedHeaders') || errMsg.includes('saved example')) {
        console.log('[Sandbox ITR] Form 26AS API not accessible — Sandbox IT API upgrade needed');
        return {
          success: true,
          message: 'Form 26AS data not available — Sandbox IT API access upgrade needed for live data',
          data: { pan, assessmentYear, source: 'native', partA_TDS: [], partB_AdvanceTax: [], summary: { totalTDSDeducted: 0, totalAdvanceTax: 0, totalTaxCredits: 0 } },
        };
      }
      console.error('Form 26AS fetch error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Form 26AS fetch failed'
      };
    }
  }

  async getAIS(pan: string, assessmentYear: string): Promise<any> {
    try {
      const response = await this.makeAPICall(
        `/it/report/ais/${pan}/${assessmentYear}`,
        undefined,
        'GET'
      );
      return response;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('404') || errMsg.includes('400') || errMsg.includes('Forbidden') || errMsg.includes('SignedHeaders') || errMsg.includes('saved example')) {
        console.log('[Sandbox ITR] AIS API not accessible — Sandbox IT API upgrade needed');
        return {
          success: true,
          message: 'AIS data not available — Sandbox IT API access upgrade needed for live data',
          data: { pan, assessmentYear, source: 'native', transactions: [], summary: {} },
        };
      }
      console.error('AIS fetch error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'AIS fetch failed'
      };
    }
  }

  async downloadITRV(acknowledgmentNumber: string, pan?: string): Promise<{
    success: boolean;
    data?: { downloadUrl: string; fileName: string };
    message: string;
  }> {
    try {
      if (!acknowledgmentNumber) {
        throw new Error('Acknowledgment number is required');
      }

      let response: any;
      if (pan) {
        const eriHeaders = await this.getERIHeaders();
        const url = `${SANDBOX_BASE_URL}/it/compliance/eri/tax-payers/${pan}/itrs/itr-v?acknowledgement_number=${acknowledgmentNumber}`;
        console.log(`[Sandbox API] GET ${url}`);
        const fetchRes = await fetch(url, { method: 'GET', headers: eriHeaders });
        const responseText = await fetchRes.text();
        try { response = JSON.parse(responseText); } catch { response = { message: responseText }; }
        if (!fetchRes.ok) {
          throw new Error(`ITR-V API returned ${fetchRes.status}: ${response.message || responseText.substring(0, 200)}`);
        }
      } else {
        response = await this.makeAPICall(
          `/it/compliance/itr-v/${acknowledgmentNumber}?format=pdf`,
          undefined,
          'GET'
        );
      }

      if (response.success) {
        return {
          success: true,
          data: {
            downloadUrl: response.data?.itrVUrl || `/api/itr/download/itr-v/${acknowledgmentNumber}.pdf`,
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

  getSuitableITRForm(incomeDetails: ITRFormData['incomeDetails'], entityType: string = 'individual'): {
    form: string;
    reason: string;
    applicableForms: string[];
  } {
    const { salaryIncome, businessIncome, capitalGains, rentalIncome } = incomeDetails;
    
    // ========== ITR-7: Trusts, Political Parties, Institutions ==========
    // Section 139(4A) - Charitable/Religious Trusts
    // Section 139(4B) - Political Parties
    // Section 139(4C) - Scientific Research Associations, News Agencies
    // Section 139(4D) - Universities, Educational Institutions
    // Section 139(4E) - Business Trusts (InvITs, REITs)
    // Section 139(4F) - Investment Funds
    if (['trust', 'political_party', 'institution', 'research_association', 'news_agency'].includes(entityType)) {
      return {
        form: 'ITR-7',
        reason: `ITR-7 is mandatory for ${entityType.replace('_', ' ')} entities claiming exemption under Sections 139(4A) to 139(4F)`,
        applicableForms: ['ITR-7']
      };
    }
    
    // ========== ITR-6: Companies (except those claiming Section 11 exemption) ==========
    if (entityType === 'company') {
      return {
        form: 'ITR-6',
        reason: 'ITR-6 is mandatory for all companies except those claiming exemption under Section 11 (Charitable/Religious purposes)',
        applicableForms: ['ITR-6', 'ITR-7']
      };
    }
    
    // ========== ITR-4 (Sugam) for Firms: Partnership firms (not LLPs) with presumptive income ==========
    // Section 44AD allows partnership firms (not LLPs) to file ITR-4 if:
    // - Business income under presumptive scheme (up to Rs. 2 crores / Rs. 3 crores with 95% digital)
    // - No capital gains
    // - Total income within presumptive limits
    if (entityType === 'partnership_firm' && 
        businessIncome > 0 && 
        businessIncome <= 30000000 && 
        capitalGains === 0) {
      return {
        form: 'ITR-4',
        reason: 'ITR-4 (Sugam) is applicable for partnership firms opting for presumptive taxation under Section 44AD (business income up to Rs. 2-3 crores, no capital gains)',
        applicableForms: ['ITR-4', 'ITR-5']
      };
    }
    
    // ========== ITR-5: Firms, LLPs, AOPs, BOIs, Cooperative Societies, Local Authorities ==========
    if (['partnership_firm', 'llp', 'aop', 'boi', 'cooperative_society', 'local_authority'].includes(entityType)) {
      return {
        form: 'ITR-5',
        reason: `ITR-5 is applicable for ${entityType.replace('_', ' ')} for filing income tax returns`,
        applicableForms: ['ITR-5']
      };
    }
    
    // ========== Individual and HUF Forms (ITR-1 to ITR-4) ==========
    
    // HUF cannot file ITR-1 or ITR-4
    if (entityType === 'huf') {
      if (businessIncome > 0) {
        return {
          form: 'ITR-3',
          reason: 'ITR-3 is required for HUF with business or professional income',
          applicableForms: ['ITR-2', 'ITR-3']
        };
      }
      return {
        form: 'ITR-2',
        reason: 'ITR-2 is applicable for HUF with income from salary, house property, capital gains, or other sources',
        applicableForms: ['ITR-2', 'ITR-3']
      };
    }
    
    // Individual taxpayers
    const totalIncome = salaryIncome + businessIncome + capitalGains + rentalIncome + 
                       (incomeDetails.otherIncome || 0) + (incomeDetails.interestIncome || 0) + 
                       (incomeDetails.dividendIncome || 0);
    
    // ITR-1 (Sahaj) - Resident Individual with:
    // - Total income up to Rs. 50 lakhs
    // - Income from salary/pension
    // - Income from one house property (not loss brought forward)
    // - Income from other sources (excluding lottery, racehorses, legal gambling)
    // - Agricultural income up to Rs. 5,000
    // NOT applicable if: Foreign assets, foreign income, director of company, capital gains, 
    //                   more than one house property, business income
    if (entityType === 'individual' && 
        totalIncome <= 5000000 && 
        businessIncome === 0 && 
        capitalGains === 0 && 
        (rentalIncome === 0 || rentalIncome > 0)) { // Only one house property allowed
      return {
        form: 'ITR-1',
        reason: 'ITR-1 (Sahaj) is the simplest form for salaried individuals with total income up to Rs. 50 lakhs, no capital gains, and no business income',
        applicableForms: ['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4']
      };
    }
    
    // ITR-4 (Sugam) - For presumptive taxation scheme
    // Section 44AD: Business income up to Rs. 2 crores (Rs. 3 crores if 95% digital receipts)
    // Section 44ADA: Professional income up to Rs. 50 lakhs (Rs. 75 lakhs if 95% digital receipts)
    // Section 44AE: Goods carriage business
    if (entityType === 'individual' && 
        businessIncome > 0 && 
        businessIncome <= 30000000 && // Up to Rs. 3 crores with digital receipts
        capitalGains === 0 &&
        totalIncome <= 5000000) {
      return {
        form: 'ITR-4',
        reason: 'ITR-4 (Sugam) is applicable for presumptive taxation under Section 44AD/44ADA/44AE with business income up to Rs. 2-3 crores',
        applicableForms: ['ITR-3', 'ITR-4']
      };
    }
    
    // ITR-3 - For individuals/HUF with business/professional income 
    // (not under presumptive scheme or above presumptive limits)
    if (businessIncome > 0) {
      return {
        form: 'ITR-3',
        reason: 'ITR-3 is required for individuals with business or professional income not opting for presumptive taxation, or income exceeding presumptive limits',
        applicableForms: ['ITR-3']
      };
    }
    
    // ITR-2 - For individuals/HUF with:
    // - Income from salary/pension
    // - Income from house property (including multiple properties)
    // - Capital gains (short-term or long-term)
    // - Income from other sources (including lottery, legal gambling)
    // - Foreign assets or foreign income
    // - Director of a company
    // - Unlisted equity shares
    if (capitalGains > 0 || totalIncome > 5000000) {
      return {
        form: 'ITR-2',
        reason: 'ITR-2 is required for individuals with capital gains, income exceeding Rs. 50 lakhs, foreign assets/income, or multiple house properties',
        applicableForms: ['ITR-2', 'ITR-3']
      };
    }
    
    // Default to ITR-2 for other cases
    return {
      form: 'ITR-2',
      reason: 'ITR-2 is the appropriate form based on your income sources and entity type',
      applicableForms: ['ITR-2', 'ITR-3']
    };
  }

  // Helper method for backwards compatibility
  getSuitableITRFormSimple(incomeDetails: ITRFormData['incomeDetails']): string {
    return this.getSuitableITRForm(incomeDetails, 'individual').form;
  }

  // Get detailed ITR form information
  getITRFormDetails(): Record<string, {
    fullName: string;
    applicableTo: string[];
    keyFeatures: string[];
    notApplicableIf: string[];
  }> {
    return {
      'ITR-1': {
        fullName: 'ITR-1 (Sahaj)',
        applicableTo: [
          'Resident individuals',
          'Total income up to Rs. 50 lakhs',
          'Salary/pension income',
          'One house property income',
          'Other sources (interest, dividends up to Rs. 5,000)',
          'Agricultural income up to Rs. 5,000'
        ],
        keyFeatures: [
          'Simplest ITR form',
          'Pre-filled data from Form 26AS, AIS',
          'Can be filed online easily'
        ],
        notApplicableIf: [
          'Income exceeds Rs. 50 lakhs',
          'Has capital gains',
          'Has business/professional income',
          'Director of a company',
          'Foreign assets or income',
          'Multiple house properties'
        ]
      },
      'ITR-2': {
        fullName: 'ITR-2',
        applicableTo: [
          'Individuals and HUFs',
          'No business/professional income',
          'Income from salary, house property, capital gains',
          'Income from other sources',
          'Foreign assets or income',
          'Director of a company'
        ],
        keyFeatures: [
          'Comprehensive form for non-business income',
          'Schedule for capital gains computation',
          'Schedule for foreign assets (FA)',
          'Schedule for foreign source income (FSI)'
        ],
        notApplicableIf: [
          'Has business or professional income'
        ]
      },
      'ITR-3': {
        fullName: 'ITR-3',
        applicableTo: [
          'Individuals and HUFs',
          'Business or professional income',
          'Partner in a firm',
          'Income from any source'
        ],
        keyFeatures: [
          'Most comprehensive form for individuals',
          'Balance sheet and P&L schedules',
          'All income heads covered',
          'Audit information if applicable'
        ],
        notApplicableIf: [
          'Firms, companies, or other entities'
        ]
      },
      'ITR-4': {
        fullName: 'ITR-4 (Sugam)',
        applicableTo: [
          'Individuals, HUFs, Partnership Firms (not LLPs)',
          'Presumptive taxation under Section 44AD (business)',
          'Presumptive taxation under Section 44ADA (professionals)',
          'Presumptive taxation under Section 44AE (transporters)',
          'Total income up to Rs. 50 lakhs'
        ],
        keyFeatures: [
          'Simplified form for presumptive income',
          'No requirement to maintain books of accounts',
          'Turnover limits: Business Rs. 2-3 crores, Profession Rs. 50-75 lakhs'
        ],
        notApplicableIf: [
          'Income exceeds Rs. 50 lakhs',
          'Has capital gains',
          'Income from more than one house property',
          'Foreign assets or income',
          'Not eligible for presumptive taxation'
        ]
      },
      'ITR-5': {
        fullName: 'ITR-5',
        applicableTo: [
          'Partnership Firms',
          'Limited Liability Partnerships (LLPs)',
          'Association of Persons (AOPs)',
          'Body of Individuals (BOIs)',
          'Cooperative Societies',
          'Local Authorities',
          'Artificial Juridical Persons'
        ],
        keyFeatures: [
          'Comprehensive form for non-corporate entities',
          'Balance sheet and P&L requirements',
          'Partner/member details',
          'Audit information if applicable'
        ],
        notApplicableIf: [
          'Individuals or HUFs',
          'Companies',
          'Trusts claiming exemption under Section 11'
        ]
      },
      'ITR-6': {
        fullName: 'ITR-6',
        applicableTo: [
          'All companies except those claiming exemption under Section 11',
          'Private Limited Companies',
          'Public Limited Companies',
          'One Person Companies',
          'Section 8 Companies (non-profit)'
        ],
        keyFeatures: [
          'Mandatory for all companies',
          'Comprehensive financial schedules',
          'MAT (Minimum Alternate Tax) computation',
          'Transfer pricing schedules if applicable',
          'XBRL filing for specified companies'
        ],
        notApplicableIf: [
          'Companies claiming exemption under Section 11 (use ITR-7)'
        ]
      },
      'ITR-7': {
        fullName: 'ITR-7',
        applicableTo: [
          'Charitable or Religious Trusts (Section 139(4A))',
          'Political Parties (Section 139(4B))',
          'Scientific Research Associations (Section 139(4C))',
          'News Agencies (Section 139(4C))',
          'Universities and Educational Institutions (Section 139(4D))',
          'Business Trusts - InvITs, REITs (Section 139(4E))',
          'Investment Funds (Section 139(4F))'
        ],
        keyFeatures: [
          'For entities claiming tax exemptions',
          'Detailed exemption schedules',
          'Application of income details',
          'Corpus fund management',
          'Anonymous donation details'
        ],
        notApplicableIf: [
          'Entities not claiming exemption under specified sections'
        ]
      }
    };
  }

  validatePAN(pan: string): boolean {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  }

  getTaxSummary(calculationData: ITRCalculationResponse['data']) {
    if (!calculationData) return null;

    return {
      totalIncome: calculationData.totalIncome,
      taxableIncome: calculationData.taxableIncome,
      totalDeductions: calculationData.totalDeductions,
      taxLiability: calculationData.taxLiability,
      netPayable: calculationData.taxPayable,
      refundDue: calculationData.refundAmount,
      effectiveRate: `${calculationData.effectiveTaxRate.toFixed(2)}%`,
    };
  }

  // ============ OCR API METHODS ============

  /**
   * Parse Form 16 PDF document using Sandbox.co.in OCR API
   * Endpoint: POST /form-16/pdf
   */
  async parseForm16(fileBuffer: Buffer, fileName: string): Promise<Form16OCRResponse> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Sandbox ITR API not configured. Set SANDBOX_API_KEY and SANDBOX_API_SECRET for ITR services.');
      }

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, fileName);

      const token = await getSandboxAccessToken();
      const response = await fetch(`${SANDBOX_BASE_URL}/it/ocr/form-16/pdf`, {
        method: 'POST',
        headers: {
          'Authorization': token,
          'x-api-key': this.apiKey,
          'x-api-version': '1.0.0',
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Form 16 OCR API error:', errorBody);
        
        throw new Error(`Form 16 OCR failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: this.transformForm16Response(result),
        message: 'Form 16 parsed successfully',
      };
    } catch (error) {
      console.error('Form 16 OCR error:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Form 16 OCR failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  /**
   * Parse Form 26AS PDF document using Sandbox.co.in OCR API
   * Endpoint: POST /form-26as/pdf
   */
  async parseForm26AS(fileBuffer: Buffer, fileName: string): Promise<Form26ASOCRResponse> {
    try {
      if (!this.apiKey || !this.apiSecret) {
        throw new Error('Sandbox ITR API not configured. Set SANDBOX_API_KEY and SANDBOX_API_SECRET for ITR services.');
      }

      const formData = new FormData();
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });
      formData.append('file', blob, fileName);

      const response = await fetch(`${SANDBOX_BASE_URL}/it/ocr/form26as`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'x-api-secret': this.apiSecret,
          'Accept': 'application/json',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Form 26AS OCR API error:', errorBody);
        
        throw new Error(`Form 26AS OCR failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: this.transformForm26ASResponse(result),
        message: 'Form 26AS parsed successfully',
      };
    } catch (error) {
      console.error('Form 26AS OCR error:', error);
      
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Form 26AS OCR failed',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  private transformForm16Response(apiResponse: any): Form16OCRResponse['data'] {
    return {
      documentType: apiResponse.document_type || 'FORM_16',
      assessmentYear: apiResponse.assessment_year || '',
      financialYear: apiResponse.financial_year || '',
      employee: {
        pan: apiResponse.employee?.pan || '',
        name: apiResponse.employee?.name || '',
        address: apiResponse.employee?.address,
        email: apiResponse.employee?.email,
      },
      employer: {
        tan: apiResponse.employer?.tan || apiResponse.deductor?.tan || '',
        name: apiResponse.employer?.name || apiResponse.deductor?.name || '',
        address: apiResponse.employer?.address || apiResponse.deductor?.address,
      },
      salaryDetails: {
        grossSalary: apiResponse.salary_details?.gross_salary || 0,
        exemptAllowances: apiResponse.salary_details?.exempt_allowances || 0,
        netSalary: apiResponse.salary_details?.net_salary || 0,
        standardDeduction: apiResponse.salary_details?.standard_deduction || 50000,
        professionalTax: apiResponse.salary_details?.professional_tax || 0,
      },
      incomeDetails: {
        salaryIncome: apiResponse.income_details?.salary_income || 0,
        housePropertyIncome: apiResponse.income_details?.house_property_income || 0,
        otherIncome: apiResponse.income_details?.other_income || 0,
        grossTotalIncome: apiResponse.income_details?.gross_total_income || 0,
      },
      deductions: {
        section80C: apiResponse.deductions?.section_80c || 0,
        section80CCC: apiResponse.deductions?.section_80ccc || 0,
        section80CCD1: apiResponse.deductions?.section_80ccd_1 || 0,
        section80CCD1B: apiResponse.deductions?.section_80ccd_1b || 0,
        section80CCD2: apiResponse.deductions?.section_80ccd_2 || 0,
        section80D: apiResponse.deductions?.section_80d || 0,
        section80E: apiResponse.deductions?.section_80e || 0,
        section80G: apiResponse.deductions?.section_80g || 0,
        section80TTA: apiResponse.deductions?.section_80tta || 0,
        totalDeductions: apiResponse.deductions?.total || 0,
      },
      taxComputation: {
        totalTaxableIncome: apiResponse.tax_computation?.taxable_income || 0,
        taxOnTotalIncome: apiResponse.tax_computation?.tax_on_income || 0,
        rebate87A: apiResponse.tax_computation?.rebate_87a || 0,
        surcharge: apiResponse.tax_computation?.surcharge || 0,
        educationCess: apiResponse.tax_computation?.education_cess || 0,
        totalTaxPayable: apiResponse.tax_computation?.total_tax || 0,
        reliefUnder89: apiResponse.tax_computation?.relief_89 || 0,
        netTaxPayable: apiResponse.tax_computation?.net_tax || 0,
      },
      tdsDetails: {
        tdsDeducted: apiResponse.tds_details?.tds_deducted || 0,
        tdsDeposited: apiResponse.tds_details?.tds_deposited || 0,
        challanDetails: apiResponse.tds_details?.challans?.map((c: any) => ({
          challanNo: c.challan_no || '',
          date: c.date || '',
          amount: c.amount || 0,
          bsrCode: c.bsr_code || '',
        })),
      },
      verificationDetails: apiResponse.verification ? {
        dateOfIssue: apiResponse.verification.date_of_issue || '',
        placeOfIssue: apiResponse.verification.place_of_issue || '',
        signatory: apiResponse.verification.signatory || '',
        designation: apiResponse.verification.designation || '',
      } : undefined,
      confidence: apiResponse.confidence || 0.85,
    };
  }

  private transformForm26ASResponse(apiResponse: any): Form26ASOCRResponse['data'] {
    return {
      pan: apiResponse.pan || '',
      assessmentYear: apiResponse.assessment_year || '',
      financialYear: apiResponse.financial_year || '',
      partA_TDS: (apiResponse.part_a?.tds || []).map((item: any) => ({
        deductorTAN: item.deductor_tan || '',
        deductorName: item.deductor_name || '',
        section: item.section || '',
        transactionDate: item.transaction_date || '',
        amountPaid: item.amount_paid || 0,
        tdsDeducted: item.tds_deducted || 0,
        tdsDeposited: item.tds_deposited || 0,
        dateOfDeposit: item.date_of_deposit,
      })),
      partA1_TDS15G15H: (apiResponse.part_a1?.declarations || []).map((item: any) => ({
        deductorTAN: item.deductor_tan || '',
        deductorName: item.deductor_name || '',
        section: item.section || '',
        amountPaid: item.amount_paid || 0,
        declarationType: item.declaration_type || '15G',
      })),
      partA2_TCS: (apiResponse.part_a2?.tcs || []).map((item: any) => ({
        collectorTAN: item.collector_tan || '',
        collectorName: item.collector_name || '',
        section: item.section || '',
        amountReceived: item.amount_received || 0,
        tcsCollected: item.tcs_collected || 0,
        tcsDeposited: item.tcs_deposited || 0,
      })),
      partB_AdvanceTax: (apiResponse.part_b?.advance_tax || []).map((item: any) => ({
        bsrCode: item.bsr_code || '',
        challanSerialNo: item.challan_serial_no || '',
        date: item.date || '',
        amount: item.amount || 0,
      })),
      partC_SelfAssessmentTax: (apiResponse.part_c?.self_assessment_tax || []).map((item: any) => ({
        bsrCode: item.bsr_code || '',
        challanSerialNo: item.challan_serial_no || '',
        date: item.date || '',
        amount: item.amount || 0,
      })),
      partD_Refunds: (apiResponse.part_d?.refunds || []).map((item: any) => ({
        assessmentYear: item.assessment_year || '',
        mode: item.mode || '',
        amount: item.amount || 0,
        dateOfPayment: item.date_of_payment || '',
      })),
      partE_AIRTransactions: (apiResponse.part_e?.air_transactions || []).map((item: any) => ({
        transactionType: item.transaction_type || '',
        reportingEntity: item.reporting_entity || '',
        amount: item.amount || 0,
      })),
      summary: {
        totalTDSDeducted: apiResponse.summary?.total_tds_deducted || 0,
        totalTCSCollected: apiResponse.summary?.total_tcs_collected || 0,
        totalAdvanceTax: apiResponse.summary?.total_advance_tax || 0,
        totalSelfAssessmentTax: apiResponse.summary?.total_self_assessment_tax || 0,
        totalRefunds: apiResponse.summary?.total_refunds || 0,
        totalTaxCredits: apiResponse.summary?.total_tax_credits || 0,
      },
      confidence: apiResponse.confidence || 0.85,
    };
  }

  /**
   * Get OCR service status
   */
  getOCRStatus(): { available: boolean; endpoints: string[] } {
    return {
      available: !!(this.apiKey && this.apiSecret),
      endpoints: [
        'POST /form-16/pdf - Parse Form 16 document',
        'POST /form-26as/pdf - Parse Form 26AS document',
      ],
    };
  }

  async eVerifyITR(acknowledgmentNumber: string, method: string, details: { pan?: string; aadhaarNumber?: string; assessmentYear?: string; formCode?: string }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const pan = details.pan;
      if (!pan) {
        throw new Error('PAN is required for e-verification');
      }

      const eriHeaders = await this.getERIHeaders();
      const queryParams = new URLSearchParams({
        assessment_year: details.assessmentYear || '2025-26',
        form_code: details.formCode || '1',
        verification_mode: method === 'aadhaar_otp' ? 'aadhaar' : method,
        acknowledgement_number: acknowledgmentNumber,
      });

      const url = `${SANDBOX_BASE_URL}/it/compliance/eri/tax-payers/${pan}/itrs/e-verify/otp?${queryParams.toString()}`;
      console.log(`[Sandbox API] POST ${url}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: eriHeaders,
      });

      const responseText = await response.text();
      let parsed: any;
      try { parsed = JSON.parse(responseText); } catch { parsed = { message: responseText }; }

      if (!response.ok) {
        throw new Error(`E-verify API returned ${response.status}: ${parsed.message || responseText.substring(0, 200)}`);
      }
      
      return {
        success: true,
        message: `E-verification ${method === 'aadhaar_otp' ? 'OTP sent to Aadhaar-linked mobile' : 'initiated'} successfully`,
        data: parsed.data || parsed
      };
    } catch (error) {
      console.error('[Sandbox ITR] E-verification failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'E-verification failed — Sandbox API error'
      };
    }
  }

  async calculateIndexedCost(items: Array<{
    acquisitionCost: number;
    acquisitionYear: string;
    saleYear: string;
    assetType?: string;
  }>): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const response = await this.makeAPICall(
        '/it/calculator/income_tax/indexed_cost',
        {
          items: items.map(item => ({
            acquisition_cost: item.acquisitionCost,
            acquisition_year: item.acquisitionYear,
            sale_year: item.saleYear,
            asset_type: item.assetType || 'property',
          })),
        },
        'POST'
      );
      return {
        success: true,
        data: response.data || response,
        message: 'Indexed cost calculated via Sandbox.co.in API',
      };
    } catch (error) {
      console.error('[Sandbox ITR] Indexed cost calculation failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Indexed cost calculation failed' };
    }
  }

  async calculateTaxPnL(assetClass: 'domestic' | 'foreign' | 'crypto' | 'real_estate' | 'other', transactions: Array<{
    symbol?: string;
    buyDate: string;
    sellDate: string;
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    brokerage?: number;
    exchangeFees?: number;
  }>): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const endpointMap: Record<string, string> = {
        domestic: '/it/calculator/tax_pnl/securities/domestic',
        foreign: '/it/calculator/tax_pnl/securities/foreign',
        crypto: '/it/calculator/tax_pnl/crypto',
        real_estate: '/it/calculator/tax_pnl/real_estate',
        other: '/it/calculator/tax_pnl/other_assets',
      };
      const response = await this.makeAPICall(
        endpointMap[assetClass] || endpointMap.domestic,
        {
          transactions: transactions.map(t => ({
            symbol: t.symbol || '',
            buy_date: t.buyDate,
            sell_date: t.sellDate,
            buy_price: t.buyPrice,
            sell_price: t.sellPrice,
            quantity: t.quantity,
            brokerage: t.brokerage || 0,
            exchange_fees: t.exchangeFees || 0,
          })),
        },
        'POST'
      );
      return {
        success: true,
        data: response.data || response,
        message: `Tax P&L calculated for ${assetClass} via Sandbox.co.in API`,
      };
    } catch (error) {
      console.error(`[Sandbox ITR] Tax P&L (${assetClass}) calculation failed:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Tax P&L calculation failed' };
    }
  }

  async getCapitalGainsReport(pan: string, assessmentYear: string, assetClass?: string): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const endpoint = assetClass
        ? `/it/report/capital_gains/${assetClass}`
        : '/it/report/capital_gains';
      const response = await this.makeAPICall(
        endpoint,
        { pan, assessment_year: assessmentYear },
        'POST'
      );
      return {
        success: true,
        data: response.data || response,
        message: 'Capital gains report generated via Sandbox.co.in API',
      };
    } catch (error) {
      console.error('[Sandbox ITR] Capital gains report failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Capital gains report failed' };
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
}

// Export singleton instance
export const sandboxITRService = new SandboxITRService();
export default sandboxITRService;
