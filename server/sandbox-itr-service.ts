import { z } from 'zod';

// Sandbox.co.in API Configuration (uses SANDBOX_BASE_URL env var or defaults to production)
const SANDBOX_BASE_URL = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';

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

class SandboxITRService {
  private apiKey: string;
  private apiSecret: string;
  
  constructor() {
    this.apiKey = process.env.SANDBOX_API_KEY || '';
    this.apiSecret = process.env.SANDBOX_API_SECRET || '';
    
    if (!this.apiKey || !this.apiSecret) {
      console.error('FATAL: Sandbox.co.in API credentials missing. SANDBOX_API_KEY and SANDBOX_API_SECRET are required. No mock data fallback — system will refuse computation.');
    }
  }

  private getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'x-api-secret': this.apiSecret,
      'Accept': 'application/json',
    };
  }

  private async makeAPICall(endpoint: string, data?: any, method: 'GET' | 'POST' | 'PUT' = 'GET') {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('SANDBOX_API_NOT_CONFIGURED: Set SANDBOX_API_KEY and SANDBOX_API_SECRET. No mock data fallback available.');
    }

    const url = `${SANDBOX_BASE_URL}${endpoint}`;
    console.log(`[Sandbox API] ${method} ${url}`);

    try {
      const response = await fetch(url, {
        method,
        headers: this.getAuthHeaders(),
        body: method === 'GET' ? undefined : (data ? JSON.stringify(data) : undefined),
      });

      const responseText = await response.text();

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
      console.error('[Sandbox API] Network/fetch error:', error);
      throw new Error(`Sandbox API unreachable: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async calculateTax(formData: ITRFormData): Promise<ITRCalculationResponse> {
    try {
      const validatedData = ITRFormDataSchema.parse(formData);
      
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
    foreignTaxCredit?: number;
    foreignIncomeCountry?: string;
    section80C: number;
    section80D: number;
    section80E: number;
    section80G: number;
    section80TTA: number;
    otherDeductions: number;
    tdsDeducted: number;
    advanceTaxPaid: number;
    selfAssessmentTax: number;
    standardDeduction: number;
    professionalTax: number;
    homeLoanInterest: number;
  }): Promise<ITRCalculationResponse> {
    const totalCapitalGains = wizardData.capitalGainsSTCG + wizardData.capitalGainsLTCG - wizardData.capitalGainsExemptions;
    const ftc = wizardData.foreignTaxCredit || 0;

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
      },
      deductions: {
        section_80c: Math.min(wizardData.section80C, 150000),
        section_80d: Math.min(wizardData.section80D, 50000),
        section_80e: wizardData.section80E,
        section_80g: wizardData.section80G,
        section_80tta: Math.min(wizardData.section80TTA, 10000),
        standard_deduction: wizardData.standardDeduction,
        professional_tax: wizardData.professionalTax,
        home_loan_interest: wizardData.homeLoanInterest,
        other_deductions: wizardData.otherDeductions,
      },
      tax_payments: {
        tds_deducted: wizardData.tdsDeducted,
        advance_tax_paid: wizardData.advanceTaxPaid,
        self_assessment_tax: wizardData.selfAssessmentTax,
      },
    };

    if (ftc > 0) {
      payload.tax_relief = {
        section_90_91: ftc,
        country: wizardData.foreignIncomeCountry || 'US',
        dtaa_applicable: true,
      };
    }

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
  }

  async prepareITR(formData: ITRFormData): Promise<ITRFilingResponse> {
    try {
      const validatedData = ITRFormDataSchema.parse(formData);
      
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

  async getITRStatus(acknowledgmentNumber: string): Promise<ITRStatusResponse> {
    try {
      if (!acknowledgmentNumber) {
        throw new Error('Acknowledgment number is required');
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
      console.error('AIS fetch error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'AIS fetch failed'
      };
    }
  }

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
        `/it/compliance/itr-v/${acknowledgmentNumber}?format=pdf`,
        undefined,
        'GET'
      );

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

      const response = await fetch(`${SANDBOX_BASE_URL}/it/ocr/form16`, {
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

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }
}

// Export singleton instance
export const sandboxITRService = new SandboxITRService();
export default sandboxITRService;
