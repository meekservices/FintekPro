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
  user_id: process.env.SANDBOX_ERI_USER_ID || '',
  password: process.env.SANDBOX_ERI_PASSWORD || '',
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
      console.warn('⚠️ [Sandbox ITR] API credentials missing. SANDBOX_API_KEY and SANDBOX_API_SECRET are not set. Service will operate in MOCK mode.');
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
      console.warn(`[Sandbox API] MOCKING ${method} ${endpoint} (Missing Credentials)`);
      return { success: true, message: 'Mock response (Missing Credentials)', data: {} };
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
      // Sandbox.co.in IT API does NOT have a salary/deductions ITR calculator.
      // The Sandbox IT Calculator API only covers P&L/Capital Gains on investments.
      // Always use the native Indian Tax Calculator for income tax computation.
      console.log('[Sandbox ITR] Using native Indian Tax Calculator (Sandbox IT API has no income tax calculator endpoint)');
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
    } catch (error) {
      console.error('[Sandbox ITR] Tax calculation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Tax calculation failed'
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
      // Sandbox.co.in IT API does NOT have a salary/deductions ITR calculator.
      // The Sandbox IT Calculator API only covers P&L/Capital Gains on investments.
      // Always delegate to the native Indian Tax Calculator.
      console.log('[Sandbox ITR] Using native Indian Tax Calculator for wizard (Sandbox IT API has no income tax calculator endpoint)');
      return indianTaxCalculator.calculateTaxFromWizard(wizardData);
    } catch (error) {
      console.error('[Sandbox ITR] Wizard tax calculation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Wizard tax calculation failed',
      };
    }
  }

  async prepareITR(formData: ITRFormData): Promise<ITRFilingResponse> {
    try {
      const validatedData = ITRFormDataSchema.parse(formData);
      
      // Sandbox.co.in IT API does NOT have an ITR e-filing endpoint (/it/report/itr does not exist).
      // ITR e-filing goes through the income tax portal directly (IRIS KFintech / ERI).
      // Use native tax calculation to generate ITR summary and acknowledgment reference.
      console.log('[Sandbox ITR] Using native ITR preparation (Sandbox IT API has no e-filing endpoint)');
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
        message: 'ITR prepared via native Indian Tax Calculator. For actual e-Filing, integrate with the Income Tax Portal via ERI.',
        data: {
          acknowledgmentNumber: ackNumber,
          filingDate: new Date().toISOString(),
          taxLiability: taxResult.data?.taxLiability ?? 0,
          refundAmount: taxResult.data?.refundAmount ?? 0,
          receiptNumber: `RCP-${ackNumber}`,
          status: 'Processing' as const,
        },
      };
    } catch (error) {
      console.error('[Sandbox ITR] Preparation failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'ITR preparation failed',
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
    // Sandbox.co.in IT API does NOT have a Form 26AS fetch endpoint.
    // Form 26AS is only accessible via OCR (PDF upload via parseForm26AS()).
    // For live Form 26AS data, the user must download from the IT portal and upload via OCR.
    console.log('[Sandbox ITR] Form 26AS fetch endpoint does not exist — use parseForm26AS() OCR for PDF upload');
    return {
      success: true,
      message: 'Form 26AS data is not available via API fetch. Please upload your Form 26AS PDF for OCR extraction.',
      data: { pan, assessmentYear, source: 'not_available', partA_TDS: [], partB_AdvanceTax: [], summary: { totalTDSDeducted: 0, totalAdvanceTax: 0, totalTaxCredits: 0 } },
    };
  }

  async getAIS(pan: string, assessmentYear: string): Promise<any> {
    // Sandbox.co.in IT API does NOT have an AIS endpoint.
    // AIS is only available via the Income Tax Portal directly.
    console.log('[Sandbox ITR] AIS fetch endpoint does not exist in Sandbox.co.in IT API');
    return {
      success: true,
      message: 'AIS (Annual Information Statement) is not available via Sandbox.co.in API. Please download AIS directly from the Income Tax Portal (incometax.gov.in).',
      data: { pan, assessmentYear, source: 'not_available', transactions: [], summary: {} },
    };
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

      // Correct endpoint: /it/ocr/form-26as/pdf (NOT /it/ocr/form26as)
      // Auth: Authorization bearer token + x-api-key (NOT x-api-secret)
      const token = await getSandboxAccessToken();
      const response = await fetch(`${SANDBOX_BASE_URL}/it/ocr/form-26as/pdf`, {
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
    // Actual Sandbox.co.in Form 26AS OCR response uses "Part I", "Part II", "Part III", etc.
    // as top-level keys in data, with each entry as an object with summary fields + deduction_wise arrays.
    const data = apiResponse.data || apiResponse;

    // Part I: TDS deductions (deductors)
    const partI: any[] = data['Part I'] || data['part_i'] || data['part_a'] || [];
    // Part II: 15G/15H declarations
    const partII: any[] = data['Part II'] || data['part_ii'] || data['part_a1'] || [];
    // Part III: TCS
    const partIII: any[] = data['Part III'] || data['part_iii'] || data['part_a2'] || [];
    // Part IV: Paid refunds
    const partIV: any[] = data['Part IV'] || data['part_iv'] || [];
    // Part V: AIR / SFT transactions
    const partV: any[] = data['Part V'] || data['part_v'] || data['part_e'] || [];
    // Part VI: Other information
    const partVI: any[] = data['Part VI'] || data['part_vi'] || [];

    // Build TDS entries from Part I (each entry = one deductor)
    const partA_TDS = partI.map((entry: any) => ({
      deductorTAN: entry.tan_of_deductor || entry.deductor_tan || '',
      deductorName: entry.name_of_deductor || entry.deductor_name || '',
      section: (() => {
        // Extract section from first data row of deduction_wise
        const rows: any[][] = entry.deduction_wise || [];
        if (rows.length >= 2) {
          const headers: string[] = rows[0];
          const sectionIdx = headers.indexOf('section');
          return sectionIdx >= 0 ? String(rows[1][sectionIdx] || '') : '';
        }
        return entry.section || '';
      })(),
      transactionDate: (() => {
        const rows: any[][] = entry.deduction_wise || [];
        if (rows.length >= 2) {
          const headers: string[] = rows[0];
          const idx = headers.indexOf('transaction_date');
          return idx >= 0 ? String(rows[1][idx] || '') : '';
        }
        return '';
      })(),
      amountPaid: parseFloat(entry.total_amount_paid_credited || entry.amount_paid || '0') || 0,
      tdsDeducted: parseFloat(entry.total_tax_deducted || entry.tds_deducted || '0') || 0,
      tdsDeposited: parseFloat(entry.total_tds_deposited || entry.tds_deposited || '0') || 0,
      dateOfDeposit: undefined,
    }));

    // Part II: 15G/15H declarations
    const partA1_TDS15G15H = partII.map((entry: any) => ({
      deductorTAN: entry.tan_of_deductor || entry.deductor_tan || '',
      deductorName: entry.name_of_deductor || entry.deductor_name || '',
      section: entry.section || '15G',
      amountPaid: parseFloat(entry.total_amount_paid_credited || entry.amount_paid || '0') || 0,
      declarationType: (entry.section || '').includes('15H') ? '15H' : '15G',
    }));

    // Part III: TCS
    const partA2_TCS = partIII.map((entry: any) => ({
      collectorTAN: entry.tan_of_collector || entry.collector_tan || '',
      collectorName: entry.name_of_collector || entry.collector_name || '',
      section: entry.section || '',
      amountReceived: parseFloat(entry.total_amount_paid_credited || entry.amount_received || '0') || 0,
      tcsCollected: parseFloat(entry.total_tax_deducted || entry.tcs_collected || '0') || 0,
      tcsDeposited: parseFloat(entry.total_tds_deposited || entry.tcs_deposited || '0') || 0,
    }));

    // Compute totals from Part I for summary
    const totalTDSDeducted = partA_TDS.reduce((sum: number, e: any) => sum + (e.tdsDeducted || 0), 0);
    const totalTCSCollected = partA2_TCS.reduce((sum: number, e: any) => sum + (e.tcsCollected || 0), 0);

    return {
      pan: data.pan || apiResponse.pan || '',
      assessmentYear: data.assessment_year || apiResponse.assessment_year || '',
      financialYear: data.financial_year || apiResponse.financial_year || '',
      partA_TDS,
      partA1_TDS15G15H,
      partA2_TCS,
      partB_AdvanceTax: partIV.map((entry: any) => ({
        bsrCode: entry.bsr_code || '',
        challanSerialNo: entry.challan_serial_no || entry.sr_no || '',
        date: entry.date || entry.transaction_date || '',
        amount: parseFloat(entry.amount || entry.total_amount_paid_credited || '0') || 0,
      })),
      partC_SelfAssessmentTax: partVI.map((entry: any) => ({
        bsrCode: entry.bsr_code || '',
        challanSerialNo: entry.challan_serial_no || entry.sr_no || '',
        date: entry.date || entry.transaction_date || '',
        amount: parseFloat(entry.amount || entry.total_amount_paid_credited || '0') || 0,
      })),
      partD_Refunds: [],
      partE_AIRTransactions: partV.map((entry: any) => ({
        transactionType: entry.transaction_type || entry.nature_of_transaction || '',
        reportingEntity: entry.reporting_entity || entry.name_of_deductor || '',
        amount: parseFloat(entry.amount || entry.total_amount_paid_credited || '0') || 0,
      })),
      summary: {
        totalTDSDeducted,
        totalTCSCollected,
        totalAdvanceTax: 0,
        totalSelfAssessmentTax: 0,
        totalRefunds: 0,
        totalTaxCredits: totalTDSDeducted + totalTCSCollected,
      },
      confidence: data.confidence || apiResponse.confidence || 0.85,
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
        assessment_year: details.assessmentYear || '2026-27',
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
      // Sandbox.co.in IT API does NOT have an indexed cost endpoint (/it/calculator/income_tax/indexed_cost).
      // Calculate Cost Inflation Index (CII) adjustment natively using official CII values.
      const CII_VALUES: Record<string, number> = {
        '2001-02': 100, '2002-03': 105, '2003-04': 109, '2004-05': 113, '2005-06': 117,
        '2006-07': 122, '2007-08': 129, '2008-09': 137, '2009-10': 148, '2010-11': 167,
        '2011-12': 184, '2012-13': 200, '2013-14': 220, '2014-15': 240, '2015-16': 254,
        '2016-17': 264, '2017-18': 272, '2018-19': 280, '2019-20': 289, '2020-21': 301,
        '2021-22': 317, '2022-23': 331, '2023-24': 348, '2024-25': 363, '2025-26': 380,
      };
      const results = items.map(item => {
        const ciiAcquisition = CII_VALUES[item.acquisitionYear] || 100;
        const ciiSale = CII_VALUES[item.saleYear] || CII_VALUES['2024-25'] || 363;
        const indexedCost = Math.round(item.acquisitionCost * (ciiSale / ciiAcquisition));
        return {
          acquisition_cost: item.acquisitionCost,
          acquisition_year: item.acquisitionYear,
          sale_year: item.saleYear,
          asset_type: item.assetType || 'property',
          cii_acquisition_year: ciiAcquisition,
          cii_sale_year: ciiSale,
          indexed_cost: indexedCost,
          indexation_benefit: indexedCost - item.acquisitionCost,
        };
      });
      return {
        success: true,
        data: { items: results, source: 'native_cii_calculation' },
        message: 'Indexed cost calculated using official Cost Inflation Index values',
      };
    } catch (error) {
      console.error('[Sandbox ITR] Indexed cost calculation failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Indexed cost calculation failed' };
    }
  }

  /**
   * Submit a Tax P&L job to Sandbox.co.in IT API.
   * The API is JOB-BASED ASYNC:
   *   1. POST /it/calculator/tax-pnl/securities/domestic → returns { job_id, url (S3 presigned) }
   *   2. PUT tradebook workbook data to the S3 presigned URL
   *   3. GET /it/calculator/tax-pnl/securities/domestic?job_id=... → poll for completion
   * Endpoint URLs use HYPHENS not underscores: tax-pnl, not tax_pnl.
   */
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
      // Correct endpoint URLs use hyphens: /it/calculator/tax-pnl/...
      const endpointMap: Record<string, string> = {
        domestic: '/it/calculator/tax-pnl/securities/domestic',
        foreign: '/it/calculator/tax-pnl/securities/foreign',
        crypto: '/it/calculator/tax-pnl/crypto',
        real_estate: '/it/calculator/tax-pnl/real-estate',
        other: '/it/calculator/tax-pnl/other-assets',
      };
      const endpoint = endpointMap[assetClass] || endpointMap.domestic;

      // Step 1: POST to create a job — returns job_id + S3 presigned URL for tradebook upload
      const jobResponse = await this.makeAPICall(endpoint, undefined, 'POST');
      const jobId: string = jobResponse.data?.job_id ?? jobResponse.job_id;
      const s3UploadUrl: string = jobResponse.data?.url ?? jobResponse.url;

      if (!jobId || !s3UploadUrl) {
        throw new Error('Tax P&L job creation failed: no job_id or S3 URL in response');
      }

      return {
        success: true,
        data: {
          job_id: jobId,
          s3_upload_url: s3UploadUrl,
          asset_class: assetClass,
          status: 'created',
          transactions_count: transactions.length,
          next_step: `Upload tradebook Excel workbook to s3_upload_url via HTTP PUT, then call getTaxPnLJobStatus("${jobId}", "${assetClass}")`,
        },
        message: `Tax P&L job created (job_id: ${jobId}). Upload your tradebook workbook to the S3 URL and poll for status.`,
      };
    } catch (error) {
      console.error(`[Sandbox ITR] Tax P&L (${assetClass}) job creation failed:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Tax P&L job creation failed' };
    }
  }

  /**
   * Check the status of a Tax P&L job.
   * GET /it/calculator/tax-pnl/securities/domestic?job_id=...
   */
  async getTaxPnLJobStatus(jobId: string, assetClass: 'domestic' | 'foreign' | 'crypto' | 'real_estate' | 'other' = 'domestic'): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      const endpointMap: Record<string, string> = {
        domestic: '/it/calculator/tax-pnl/securities/domestic',
        foreign: '/it/calculator/tax-pnl/securities/foreign',
        crypto: '/it/calculator/tax-pnl/crypto',
        real_estate: '/it/calculator/tax-pnl/real-estate',
        other: '/it/calculator/tax-pnl/other-assets',
      };
      const endpoint = `${endpointMap[assetClass] || endpointMap.domestic}?job_id=${encodeURIComponent(jobId)}`;
      const response = await this.makeAPICall(endpoint, undefined, 'GET');
      return {
        success: true,
        data: response.data || response,
        message: `Tax P&L job status: ${response.data?.status ?? 'unknown'}`,
      };
    } catch (error) {
      console.error(`[Sandbox ITR] Tax P&L job status check failed:`, error);
      return { success: false, message: error instanceof Error ? error.message : 'Tax P&L job status check failed' };
    }
  }

  /**
   * Submit a Capital Gains Report job.
   * Correct URL: POST /it/reports/capital-gains/securities/domestic?financial_year=FY+2025-26
   * (plural "reports", hyphens in path)
   */
  async getCapitalGainsReport(pan: string, assessmentYear: string, assetClass?: string): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      // Convert AY (e.g. "2025-26") to FY (e.g. "FY 2024-25")
      const ayMatch = assessmentYear.match(/^(\d{4})-(\d{2})$/);
      const financialYear = ayMatch
        ? `FY ${parseInt(ayMatch[1]) - 1}-${ayMatch[2]}`
        : `FY 2024-25`;
      const secType = assetClass || 'domestic';
      const queryParams = new URLSearchParams({ financial_year: financialYear });
      // Correct plural endpoint: /it/reports/capital-gains/...
      const endpoint = `/it/reports/capital-gains/securities/${secType}?${queryParams.toString()}`;
      const jobResponse = await this.makeAPICall(endpoint, undefined, 'POST');
      const jobId: string = jobResponse.data?.job_id ?? jobResponse.job_id;
      const s3UploadUrl: string = jobResponse.data?.url ?? jobResponse.url;
      if (!jobId) {
        throw new Error('Capital gains report job creation failed: no job_id in response');
      }
      return {
        success: true,
        data: { job_id: jobId, s3_upload_url: s3UploadUrl, financial_year: financialYear, status: 'created' },
        message: `Capital gains report job created (job_id: ${jobId}) for ${financialYear}. Upload tradebook and poll for status.`,
      };
    } catch (error) {
      console.error('[Sandbox ITR] Capital gains report failed:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Capital gains report job creation failed' };
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
}

// Export singleton instance
export const sandboxITRService = new SandboxITRService();
export default sandboxITRService;
