import { z } from 'zod';

// Sandbox.co.in TDS API Configuration (uses SANDBOX_BASE_URL env var or defaults to production)
const SANDBOX_BASE_URL = process.env.SANDBOX_BASE_URL || 'https://api.sandbox.co.in';

// ============ TDS CALCULATOR SCHEMAS ============

export const TDSSalaryInputSchema = z.object({
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid financial year format (YYYY-YY)'),
  employerTAN: z.string().regex(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, 'Invalid TAN format').optional(),
  grossSalary: z.number().min(0),
  basicSalary: z.number().min(0),
  hra: z.number().min(0).default(0),
  specialAllowance: z.number().min(0).default(0),
  lta: z.number().min(0).default(0),
  bonus: z.number().min(0).default(0),
  perquisites: z.number().min(0).default(0),
  profitInLieu: z.number().min(0).default(0),
  deductions: z.object({
    section80C: z.number().min(0).max(150000).default(0),
    section80D: z.number().min(0).max(100000).default(0),
    section80E: z.number().min(0).default(0),
    section80G: z.number().min(0).default(0),
    section80TTA: z.number().min(0).max(10000).default(0),
    nps80CCD1B: z.number().min(0).max(50000).default(0),
    homeLoanInterest: z.number().min(0).max(200000).default(0),
    standardDeduction: z.number().min(0).max(50000).default(50000),
    professionalTax: z.number().min(0).max(2500).default(0),
    hraExemption: z.number().min(0).default(0),
  }).default({}),
  rentPaid: z.number().min(0).default(0),
  metroCity: z.boolean().default(true),
  taxRegime: z.enum(['old', 'new']).default('new'),
});

export const TDSNonSalaryInputSchema = z.object({
  deductorTAN: z.string().regex(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, 'Invalid TAN format'),
  deducteePAN: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  paymentType: z.enum([
    'contractor', 'professional', 'rent', 'interest', 'dividend',
    'commission', 'royalty', 'technical_services', 'sale_of_property',
    'lottery', 'horse_racing', 'insurance_commission'
  ]),
  amount: z.number().min(0),
  paymentDate: z.string(),
  section: z.enum([
    '194C', '194J', '194I', '194A', '194', '194H', 
    '194O', '194DA', '194B', '194BB', '194D', '194N'
  ]).optional(),
  isIndividualHUF: z.boolean().default(false),
  hasValidPAN: z.boolean().default(true),
  thresholdExceeded: z.boolean().default(true),
});

export const TDSForm16InputSchema = z.object({
  deductorTAN: z.string().regex(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, 'Invalid TAN format'),
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid financial year format'),
  employees: z.array(z.object({
    pan: z.string(),
    name: z.string(),
    grossSalary: z.number(),
    tdsDeducted: z.number(),
    employeeId: z.string().optional(),
  })),
});

export const TDSReturnInputSchema = z.object({
  deductorTAN: z.string().regex(/^[A-Z]{4}[0-9]{5}[A-Z]{1}$/, 'Invalid TAN format'),
  deductorPAN: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
  formType: z.enum(['24Q', '26Q', '27Q', '27EQ']),
  quarter: z.enum(['Q1', 'Q2', 'Q3', 'Q4']),
  financialYear: z.string(),
  deductorDetails: z.object({
    name: z.string(),
    category: z.enum(['company', 'government', 'other']),
    address: z.object({
      line1: z.string(),
      line2: z.string().optional(),
      city: z.string(),
      state: z.string(),
      pincode: z.string(),
    }),
    email: z.string().email(),
    phone: z.string(),
  }),
  challanDetails: z.array(z.object({
    bsrCode: z.string(),
    challanSerialNo: z.string(),
    challanDate: z.string(),
    amount: z.number(),
    tdsAmount: z.number(),
    surcharge: z.number().default(0),
    educationCess: z.number().default(0),
    interest: z.number().default(0),
    others: z.number().default(0),
  })),
  deducteeDetails: z.array(z.object({
    pan: z.string(),
    name: z.string(),
    section: z.string(),
    paymentDate: z.string(),
    paymentAmount: z.number(),
    tdsDeducted: z.number(),
    tdsDeposited: z.number(),
    challanNo: z.string().optional(),
  })),
});

export type TDSSalaryInput = z.infer<typeof TDSSalaryInputSchema>;
export type TDSNonSalaryInput = z.infer<typeof TDSNonSalaryInputSchema>;
export type TDSForm16Input = z.infer<typeof TDSForm16InputSchema>;
export type TDSReturnInput = z.infer<typeof TDSReturnInputSchema>;

// Response Types
export interface TDSCalculationResponse {
  success: boolean;
  data?: {
    grossIncome: number;
    totalDeductions: number;
    taxableIncome: number;
    taxLiability: number;
    surcharge: number;
    educationCess: number;
    totalTax: number;
    monthlyTDS: number;
    effectiveRate: number;
    taxRegime: 'old' | 'new';
    breakdown: {
      basicTax: number;
      surcharge: number;
      cess: number;
    };
    slabWise?: Array<{
      slab: string;
      rate: number;
      taxableAmount: number;
      tax: number;
    }>;
  };
  message: string;
}

export interface TDSNonSalaryResponse {
  success: boolean;
  data?: {
    amount: number;
    section: string;
    tdsRate: number;
    tdsAmount: number;
    surcharge: number;
    educationCess: number;
    totalTDS: number;
    netPayable: number;
    thresholdLimit: number;
    remarks: string;
  };
  message: string;
}

export interface TDSAnalyticsResponse {
  success: boolean;
  data?: {
    totalTDSDeducted: number;
    totalTDSDeposited: number;
    pendingDeposit: number;
    potentialNotices: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      section: string;
      amount: number;
      dueDate?: string;
    }>;
    compliance: {
      filedQuarters: string[];
      pendingQuarters: string[];
      lastFilingDate?: string;
      nextDueDate: string;
    };
    recommendations: string[];
  };
  message: string;
}

export interface Form16Response {
  success: boolean;
  data?: {
    form16Id: string;
    deductorTAN: string;
    financialYear: string;
    generatedCount: number;
    downloadUrl: string;
    status: 'generated' | 'processing' | 'failed';
    generatedAt: string;
  };
  message: string;
}

export interface TDSReturnResponse {
  success: boolean;
  data?: {
    returnId: string;
    formType: string;
    quarter: string;
    financialYear: string;
    status: 'prepared' | 'validated' | 'filed' | 'acknowledged';
    tokenNumber?: string;
    acknowledgmentNumber?: string;
    filingDate?: string;
    fvuFile?: string;
    txtFile?: string;
    errors?: string[];
    warnings?: string[];
  };
  message: string;
}

// TDS Section Rates (FY 2024-25)
const TDS_RATES: Record<string, { rate: number; thresholdIndividual: number; thresholdOther: number; description: string }> = {
  '194C': { rate: 1, thresholdIndividual: 30000, thresholdOther: 100000, description: 'Contractor payments (Individual/HUF: 1%, Others: 2%)' },
  '194J': { rate: 10, thresholdIndividual: 30000, thresholdOther: 30000, description: 'Professional/Technical services' },
  '194I': { rate: 10, thresholdIndividual: 240000, thresholdOther: 240000, description: 'Rent (Plant/Equipment: 2%, Land/Building: 10%)' },
  '194A': { rate: 10, thresholdIndividual: 40000, thresholdOther: 50000, description: 'Interest other than securities' },
  '194': { rate: 10, thresholdIndividual: 5000, thresholdOther: 5000, description: 'Dividend' },
  '194H': { rate: 5, thresholdIndividual: 15000, thresholdOther: 15000, description: 'Commission/Brokerage' },
  '194O': { rate: 1, thresholdIndividual: 500000, thresholdOther: 500000, description: 'E-commerce transactions' },
  '194DA': { rate: 5, thresholdIndividual: 100000, thresholdOther: 100000, description: 'Life insurance maturity' },
  '194B': { rate: 30, thresholdIndividual: 10000, thresholdOther: 10000, description: 'Lottery winnings' },
  '194BB': { rate: 30, thresholdIndividual: 10000, thresholdOther: 10000, description: 'Horse racing winnings' },
  '194D': { rate: 5, thresholdIndividual: 15000, thresholdOther: 15000, description: 'Insurance commission' },
  '194N': { rate: 2, thresholdIndividual: 10000000, thresholdOther: 10000000, description: 'Cash withdrawal exceeding ₹1 crore' },
};

// Mapping from payment types to TDS sections
// Note: Only sections allowed in TDSNonSalaryInputSchema are included
const PAYMENT_TO_SECTION: Record<string, string> = {
  'contractor': '194C',
  'professional': '194J',
  'rent': '194I',
  'interest': '194A',
  'dividend': '194',
  'commission': '194H',
  'technical_services': '194J',
  'sale_of_property': '194I', // Use 194I for property sales (closest match in schema)
  'lottery': '194B',
  'horse_racing': '194BB',
  'insurance_commission': '194D',
  'royalty': '194J',
};

class SandboxTDSService {
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey = process.env.SANDBOX_API_KEY || '';
    this.apiSecret = process.env.SANDBOX_API_SECRET || '';

    if (!this.apiKey || !this.apiSecret) {
      console.warn('⚠️ Sandbox.co.in API credentials not configured. TDS services will use calculated data.');
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

  private async makeAPICall(endpoint: string, data?: any, method: 'GET' | 'POST' = 'POST') {
    if (!this.apiKey || !this.apiSecret) {
      return this.getCalculatedResponse(endpoint, data);
    }

    try {
      const response = await fetch(`${SANDBOX_BASE_URL}${endpoint}`, {
        method,
        headers: this.getAuthHeaders(),
        body: method === 'GET' ? undefined : (data ? JSON.stringify(data) : undefined),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Sandbox TDS API error:', errorBody);
        throw new Error(`Sandbox TDS API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Sandbox TDS API call failed:', error);
      return this.getCalculatedResponse(endpoint, data);
    }
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }

  /**
   * Get all TDS sections with their rates and thresholds
   */
  getTDSSections(): Array<{
    section: string;
    rate: number;
    thresholdIndividual: number;
    thresholdOther: number;
    description: string;
  }> {
    return Object.entries(TDS_RATES).map(([section, config]) => ({
      section,
      rate: config.rate,
      thresholdIndividual: config.thresholdIndividual,
      thresholdOther: config.thresholdOther,
      description: config.description,
    }));
  }

  // ============ TAX CALCULATION HELPERS ============

  private calculateOldRegimeTax(taxableIncome: number): { tax: number; slabs: any[] } {
    const slabs = [];
    let tax = 0;

    if (taxableIncome <= 250000) {
      slabs.push({ slab: '0 - 2.5L', rate: 0, taxableAmount: taxableIncome, tax: 0 });
      return { tax: 0, slabs };
    }

    slabs.push({ slab: '0 - 2.5L', rate: 0, taxableAmount: 250000, tax: 0 });

    if (taxableIncome <= 500000) {
      const taxable = taxableIncome - 250000;
      const slabTax = taxable * 0.05;
      slabs.push({ slab: '2.5L - 5L', rate: 5, taxableAmount: taxable, tax: slabTax });
      tax = slabTax;
    } else {
      slabs.push({ slab: '2.5L - 5L', rate: 5, taxableAmount: 250000, tax: 12500 });
      tax = 12500;

      if (taxableIncome <= 1000000) {
        const taxable = taxableIncome - 500000;
        const slabTax = taxable * 0.20;
        slabs.push({ slab: '5L - 10L', rate: 20, taxableAmount: taxable, tax: slabTax });
        tax += slabTax;
      } else {
        slabs.push({ slab: '5L - 10L', rate: 20, taxableAmount: 500000, tax: 100000 });
        tax = 112500;

        const taxable = taxableIncome - 1000000;
        const slabTax = taxable * 0.30;
        slabs.push({ slab: '10L+', rate: 30, taxableAmount: taxable, tax: slabTax });
        tax += slabTax;
      }
    }

    return { tax, slabs };
  }

  private calculateNewRegimeTax(taxableIncome: number): { tax: number; slabs: any[] } {
    const slabs = [];
    let tax = 0;
    let remaining = taxableIncome;

    const newSlabs = [
      { limit: 300000, rate: 0 },
      { limit: 700000, rate: 5 },
      { limit: 1000000, rate: 10 },
      { limit: 1200000, rate: 15 },
      { limit: 1500000, rate: 20 },
      { limit: Infinity, rate: 30 },
    ];

    let prevLimit = 0;
    for (const slab of newSlabs) {
      if (remaining <= 0) break;

      const slabAmount = Math.min(remaining, slab.limit - prevLimit);
      const slabTax = slabAmount * (slab.rate / 100);

      slabs.push({
        slab: `${(prevLimit / 100000).toFixed(1)}L - ${slab.limit === Infinity ? '∞' : (slab.limit / 100000).toFixed(1) + 'L'}`,
        rate: slab.rate,
        taxableAmount: slabAmount,
        tax: slabTax,
      });

      tax += slabTax;
      remaining -= slabAmount;
      prevLimit = slab.limit;
    }

    return { tax, slabs };
  }

  private calculateSurcharge(tax: number, income: number): number {
    if (income <= 5000000) return 0;
    if (income <= 10000000) return tax * 0.10;
    if (income <= 20000000) return tax * 0.15;
    if (income <= 50000000) return tax * 0.25;
    return tax * 0.37;
  }

  // ============ CALCULATED RESPONSES ============

  private getCalculatedResponse(endpoint: string, data?: any) {
    if (endpoint.includes('/tds/calculator/salary')) {
      return this.calculateSalaryTDS(data);
    }

    if (endpoint.includes('/tds/calculator/non-salary')) {
      return this.calculateNonSalaryTDS(data);
    }

    if (endpoint.includes('/tds/analytics')) {
      return this.getAnalyticsMockData(data);
    }

    if (endpoint.includes('/tds/compliance/form16')) {
      return this.generateForm16Mock(data);
    }

    if (endpoint.includes('/tds/reports/prepare')) {
      return this.prepareTDSReturnMock(data);
    }

    if (endpoint.includes('/tds/compliance/e-file')) {
      return this.eFileTDSReturnMock(data);
    }

    return { success: false, message: 'Unknown endpoint' };
  }

  private calculateSalaryTDS(input: TDSSalaryInput): TDSCalculationResponse {
    try {
      const validated = TDSSalaryInputSchema.parse(input);

      const grossIncome = validated.grossSalary + validated.bonus + 
                          validated.perquisites + validated.profitInLieu;

      let totalDeductions = 0;
      
      if (validated.taxRegime === 'old') {
        totalDeductions = 
          validated.deductions.section80C +
          validated.deductions.section80D +
          validated.deductions.section80E +
          validated.deductions.section80G +
          validated.deductions.section80TTA +
          validated.deductions.nps80CCD1B +
          validated.deductions.homeLoanInterest +
          validated.deductions.standardDeduction +
          validated.deductions.professionalTax +
          validated.deductions.hraExemption;
      } else {
        totalDeductions = 75000; // Standard deduction in new regime (FY 2024-25)
      }

      const taxableIncome = Math.max(0, grossIncome - totalDeductions);

      const { tax: basicTax, slabs: slabWise } = validated.taxRegime === 'old'
        ? this.calculateOldRegimeTax(taxableIncome)
        : this.calculateNewRegimeTax(taxableIncome);

      const surcharge = this.calculateSurcharge(basicTax, taxableIncome);
      const educationCess = (basicTax + surcharge) * 0.04;
      const totalTax = basicTax + surcharge + educationCess;

      // Rebate u/s 87A (new regime: up to 7L, old regime: up to 5L)
      let finalTax = totalTax;
      if (validated.taxRegime === 'new' && taxableIncome <= 700000) {
        finalTax = Math.max(0, totalTax - 25000);
      } else if (validated.taxRegime === 'old' && taxableIncome <= 500000) {
        finalTax = Math.max(0, totalTax - 12500);
      }

      const monthlyTDS = Math.ceil(finalTax / 12);
      const effectiveRate = grossIncome > 0 ? (finalTax / grossIncome) * 100 : 0;

      return {
        success: true,
        data: {
          grossIncome,
          totalDeductions,
          taxableIncome,
          taxLiability: basicTax,
          surcharge,
          educationCess,
          totalTax: finalTax,
          monthlyTDS,
          effectiveRate: Math.round(effectiveRate * 100) / 100,
          taxRegime: validated.taxRegime,
          breakdown: {
            basicTax,
            surcharge,
            cess: educationCess,
          },
          slabWise,
        },
        message: 'TDS on salary calculated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'TDS calculation failed',
      };
    }
  }

  private calculateNonSalaryTDS(input: TDSNonSalaryInput): TDSNonSalaryResponse {
    try {
      const validated = TDSNonSalaryInputSchema.parse(input);

      const section = validated.section || PAYMENT_TO_SECTION[validated.paymentType] || '194J';
      const sectionInfo = TDS_RATES[section] || { rate: 10, thresholdIndividual: 30000, thresholdOther: 30000, description: 'Default rate' };

      const threshold = validated.isIndividualHUF ? sectionInfo.thresholdIndividual : sectionInfo.thresholdOther;
      
      let tdsRate = sectionInfo.rate;
      
      // Higher rate for no PAN (20% or normal rate, whichever is higher)
      if (!validated.hasValidPAN) {
        tdsRate = Math.max(20, tdsRate);
      }

      // 194C special case: 1% for Individual/HUF, 2% for others
      if (section === '194C' && !validated.isIndividualHUF) {
        tdsRate = 2;
      }

      // Check threshold
      const applicableTDS = validated.thresholdExceeded || validated.amount > threshold;
      const tdsAmount = applicableTDS ? Math.round(validated.amount * (tdsRate / 100)) : 0;
      const surcharge = 0; // Non-salary TDS doesn't typically have surcharge unless special cases
      const educationCess = Math.round(tdsAmount * 0.04);
      const totalTDS = tdsAmount + surcharge + educationCess;

      return {
        success: true,
        data: {
          amount: validated.amount,
          section,
          tdsRate,
          tdsAmount,
          surcharge,
          educationCess,
          totalTDS,
          netPayable: validated.amount - totalTDS,
          thresholdLimit: threshold,
          remarks: applicableTDS 
            ? `TDS @ ${tdsRate}% u/s ${section} - ${sectionInfo.description}`
            : `No TDS - Amount below threshold of ₹${threshold.toLocaleString()}`,
        },
        message: 'TDS on non-salary payment calculated successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'TDS calculation failed',
      };
    }
  }

  private getAnalyticsMockData(data: any): TDSAnalyticsResponse {
    const tan = data?.tan || 'XXXX00000X';
    const fy = data?.financialYear || '2024-25';

    return {
      success: true,
      data: {
        totalTDSDeducted: 1250000,
        totalTDSDeposited: 1150000,
        pendingDeposit: 100000,
        potentialNotices: [
          {
            type: 'Late Deposit',
            severity: 'medium',
            description: 'TDS for October 2024 deposited 5 days late',
            section: '234E',
            amount: 2500,
            dueDate: '2024-11-07',
          },
          {
            type: 'Return Filing Due',
            severity: 'high',
            description: 'Q2 TDS return filing pending',
            section: '271H',
            amount: 0,
            dueDate: '2024-10-31',
          },
        ],
        compliance: {
          filedQuarters: ['Q1'],
          pendingQuarters: ['Q2', 'Q3', 'Q4'],
          lastFilingDate: '2024-07-31',
          nextDueDate: '2024-10-31',
        },
        recommendations: [
          'File Q2 TDS return before 31st October to avoid penalty',
          'Deposit pending TDS of ₹1,00,000 immediately to reduce interest liability',
          'Verify all deductee PANs to avoid higher TDS rate notices',
          'Generate Form 16A for Q1 deductees',
        ],
      },
      message: `TDS analytics for TAN ${tan} for FY ${fy}`,
    };
  }

  private generateForm16Mock(input: TDSForm16Input): Form16Response {
    try {
      const validated = TDSForm16InputSchema.parse(input);

      return {
        success: true,
        data: {
          form16Id: `F16-${Date.now()}`,
          deductorTAN: validated.deductorTAN,
          financialYear: validated.financialYear,
          generatedCount: validated.employees.length,
          downloadUrl: `/api/tds/download/form16/${Date.now()}`,
          status: 'generated',
          generatedAt: new Date().toISOString(),
        },
        message: `Form 16 generated for ${validated.employees.length} employees`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Form 16 generation failed',
      };
    }
  }

  private prepareTDSReturnMock(input: TDSReturnInput): TDSReturnResponse {
    try {
      const validated = TDSReturnInputSchema.parse(input);

      const warnings: string[] = [];
      const errors: string[] = [];

      // Validate challan vs deductee totals
      const challanTotal = validated.challanDetails.reduce((sum, c) => sum + c.tdsAmount, 0);
      const deducteeTotal = validated.deducteeDetails.reduce((sum, d) => sum + d.tdsDeducted, 0);

      if (Math.abs(challanTotal - deducteeTotal) > 1) {
        warnings.push(`Challan total (₹${challanTotal}) doesn't match deductee TDS total (₹${deducteeTotal})`);
      }

      return {
        success: true,
        data: {
          returnId: `RET-${validated.formType}-${validated.quarter}-${Date.now()}`,
          formType: validated.formType,
          quarter: validated.quarter,
          financialYear: validated.financialYear,
          status: 'prepared',
          fvuFile: `/api/tds/download/fvu/${Date.now()}`,
          txtFile: `/api/tds/download/txt/${Date.now()}`,
          errors,
          warnings,
        },
        message: `TDS return ${validated.formType} for ${validated.quarter} prepared successfully`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'TDS return preparation failed',
      };
    }
  }

  private eFileTDSReturnMock(data: any): TDSReturnResponse {
    return {
      success: true,
      data: {
        returnId: data.returnId || `RET-${Date.now()}`,
        formType: data.formType || '24Q',
        quarter: data.quarter || 'Q1',
        financialYear: data.financialYear || '2024-25',
        status: 'filed',
        tokenNumber: `TKN${Date.now()}`,
        acknowledgmentNumber: `ACK${Date.now()}`,
        filingDate: new Date().toISOString(),
      },
      message: 'TDS return e-filed successfully (Sandbox Mock)',
    };
  }

  // ============ PUBLIC API METHODS ============

  async calculateSalaryTDSAPI(input: TDSSalaryInput): Promise<TDSCalculationResponse> {
    try {
      const validatedInput = TDSSalaryInputSchema.parse(input);
      
      const response = await this.makeAPICall(
        '/tds/calculator/salary',
        validatedInput,
        'POST'
      );

      return response;
    } catch (error) {
      return this.calculateSalaryTDS(input);
    }
  }

  async calculateNonSalaryTDSAPI(input: TDSNonSalaryInput): Promise<TDSNonSalaryResponse> {
    try {
      const validatedInput = TDSNonSalaryInputSchema.parse(input);

      const response = await this.makeAPICall(
        '/tds/calculator/non-salary',
        validatedInput,
        'POST'
      );

      return response;
    } catch (error) {
      return this.calculateNonSalaryTDS(input);
    }
  }

  async getTDSAnalytics(tan: string, financialYear: string): Promise<TDSAnalyticsResponse> {
    try {
      const response = await this.makeAPICall(
        `/tds/analytics/${tan}/${financialYear}`,
        undefined,
        'GET'
      );

      return response;
    } catch (error) {
      return this.getAnalyticsMockData({ tan, financialYear });
    }
  }

  async generateForm16(input: TDSForm16Input): Promise<Form16Response> {
    try {
      const validatedInput = TDSForm16InputSchema.parse(input);

      const response = await this.makeAPICall(
        '/tds/compliance/form16/generate',
        validatedInput,
        'POST'
      );

      return response;
    } catch (error) {
      return this.generateForm16Mock(input);
    }
  }

  async generateForm16A(tan: string, pan: string, quarter: string, fy: string): Promise<Form16Response> {
    try {
      const response = await this.makeAPICall(
        '/tds/compliance/form16a/generate',
        { tan, pan, quarter, financialYear: fy },
        'POST'
      );

      return response;
    } catch (error) {
      return {
        success: true,
        data: {
          form16Id: `F16A-${Date.now()}`,
          deductorTAN: tan,
          financialYear: fy,
          generatedCount: 1,
          downloadUrl: `/api/tds/download/form16a/${Date.now()}`,
          status: 'generated',
          generatedAt: new Date().toISOString(),
        },
        message: `Form 16A generated for PAN ${pan}`,
      };
    }
  }

  async prepareTDSReturn(input: TDSReturnInput): Promise<TDSReturnResponse> {
    try {
      const validatedInput = TDSReturnInputSchema.parse(input);

      const response = await this.makeAPICall(
        '/tds/reports/prepare',
        validatedInput,
        'POST'
      );

      return response;
    } catch (error) {
      return this.prepareTDSReturnMock(input);
    }
  }

  async eFileTDSReturn(returnId: string, credentials: { userId: string; password: string }): Promise<TDSReturnResponse> {
    try {
      const response = await this.makeAPICall(
        '/tds/compliance/e-file',
        { returnId, ...credentials },
        'POST'
      );

      return response;
    } catch (error) {
      return this.eFileTDSReturnMock({ returnId });
    }
  }

  async downloadCSI(tan: string, financialYear: string): Promise<{
    success: boolean;
    data?: { downloadUrl: string; fileName: string };
    message: string;
  }> {
    try {
      const response = await this.makeAPICall(
        `/tds/compliance/csi/${tan}/${financialYear}`,
        undefined,
        'GET'
      );

      if (response.success) {
        return response;
      }

      return {
        success: true,
        data: {
          downloadUrl: `/api/tds/download/csi/${tan}/${financialYear}`,
          fileName: `CSI-${tan}-${financialYear}.pdf`,
        },
        message: 'Challan Status Inquiry file ready for download',
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'CSI download failed',
      };
    }
  }

  getTDSSectionRates(): Record<string, { rate: number; thresholdIndividual: number; thresholdOther: number; description: string }> {
    return TDS_RATES;
  }

  // Universal TDS calculation method that auto-detects salary vs non-salary
  async calculateTDS(input: any): Promise<TDSCalculationResponse | TDSNonSalaryResponse> {
    // Determine if this is a salary or non-salary calculation
    const isSalaryCalculation = 
      input.grossSalary !== undefined || 
      input.basicSalary !== undefined ||
      input.employerTAN !== undefined ||
      (input.type === 'salary');

    if (isSalaryCalculation) {
      // Map input to salary format
      const salaryInput: TDSSalaryInput = {
        pan: input.pan || 'AAAAA0000A',
        financialYear: input.financialYear || '2024-25',
        employerTAN: input.employerTAN,
        grossSalary: input.grossSalary || input.amount || 0,
        basicSalary: input.basicSalary || (input.grossSalary * 0.5) || 0,
        hra: input.hra || 0,
        specialAllowance: input.specialAllowance || 0,
        lta: input.lta || 0,
        bonus: input.bonus || 0,
        perquisites: input.perquisites || 0,
        profitInLieu: input.profitInLieu || 0,
        deductions: input.deductions || {},
        rentPaid: input.rentPaid || 0,
        metroCity: input.metroCity ?? true,
        taxRegime: input.taxRegime || 'new',
      };
      return this.calculateSalaryTDSAPI(salaryInput);
    } else {
      // Map input to non-salary format
      const nonSalaryInput: TDSNonSalaryInput = {
        deductorTAN: input.deductorTAN || input.tan || 'AAAA00000A',
        deducteePAN: input.deducteePAN || input.pan || 'AAAAA0000A',
        paymentType: input.paymentType || this.getSectionPaymentType(input.section),
        amount: input.amount || 0,
        paymentDate: input.paymentDate || new Date().toISOString().split('T')[0],
        section: input.section,
        isIndividualHUF: input.isIndividualHUF ?? (input.entityType === 'individual' || input.entityType === 'huf'),
        hasValidPAN: input.hasValidPAN ?? true,
        thresholdExceeded: input.thresholdExceeded ?? true,
      };
      return this.calculateNonSalaryTDSAPI(nonSalaryInput);
    }
  }

  // Helper to map section codes to payment types
  // Note: Maps TDS sections to valid paymentType values from TDSNonSalaryInputSchema
  private getSectionPaymentType(section?: string): TDSNonSalaryInput['paymentType'] {
    const sectionMap: Record<string, TDSNonSalaryInput['paymentType']> = {
      '194C': 'contractor',
      '194J': 'professional',
      '194I': 'rent',
      '194A': 'interest',
      '194': 'dividend',
      '194H': 'commission',
      '194O': 'technical_services',
      '194DA': 'insurance_commission',
      '194B': 'lottery',
      '194BB': 'horse_racing',
      '194D': 'insurance_commission',
      // 194N (cash withdrawal) doesn't have a direct payment type mapping
      // Falls back to 'contractor' which is the default
    };
    return sectionMap[section || '194C'] || 'contractor';
  }

  getTDSFormTypes(): Array<{ form: string; description: string; applicableFor: string[] }> {
    return [
      { 
        form: '24Q', 
        description: 'TDS on Salary', 
        applicableFor: ['Salary payments to employees'] 
      },
      { 
        form: '26Q', 
        description: 'TDS on Non-Salary (Residents)', 
        applicableFor: ['Contractor payments', 'Professional fees', 'Rent', 'Interest', 'Commission'] 
      },
      { 
        form: '27Q', 
        description: 'TDS on Non-Residents', 
        applicableFor: ['Payments to NRIs', 'Foreign companies', 'Technical services'] 
      },
      { 
        form: '27EQ', 
        description: 'TCS (Tax Collected at Source)', 
        applicableFor: ['Sale of goods', 'Scrap', 'Minerals', 'Motor vehicles above ₹10L'] 
      },
    ];
  }

  getTDSQuarterDueDates(financialYear: string): Array<{ quarter: string; period: string; depositDue: string; returnDue: string }> {
    const [startYear] = financialYear.split('-').map(Number);

    return [
      {
        quarter: 'Q1',
        period: `Apr-Jun ${startYear}`,
        depositDue: `7th of next month`,
        returnDue: `31st July ${startYear}`,
      },
      {
        quarter: 'Q2',
        period: `Jul-Sep ${startYear}`,
        depositDue: `7th of next month`,
        returnDue: `31st October ${startYear}`,
      },
      {
        quarter: 'Q3',
        period: `Oct-Dec ${startYear}`,
        depositDue: `7th of next month`,
        returnDue: `31st January ${startYear + 1}`,
      },
      {
        quarter: 'Q4',
        period: `Jan-Mar ${startYear + 1}`,
        depositDue: `30th April ${startYear + 1} (March) / 7th (Others)`,
        returnDue: `31st May ${startYear + 1}`,
      },
    ];
  }
}

// ============ SHEET JSON FORMAT HELPERS ============
// Sandbox.co.in uses Sheet JSON format for bulk TDS operations (Form 24Q, 26Q, 27Q, 27EQ)

interface SheetBlock {
  name: string;
  '@entity': 'list' | 'table';
  items?: Array<[string, any]>;  // For list entity
  header?: string[];              // For table entity
  rows?: any[][];                 // For table entity
}

interface Sheet {
  name: string;
  blocks: SheetBlock[];
}

interface SheetJSON {
  name: string;
  sheets: Sheet[];
}

export function buildTDSSheetJSON(formType: '24Q' | '26Q' | '27Q' | '27EQ', data: {
  payer: {
    name: string;
    tan: string;
    pan: string;
    branch?: string;
    gstin?: string;
    street: string;
    area?: string;
    city: string;
    state: string;
    postalCode: string;
    email: string;
    mobile: string;
  };
  responsiblePerson: {
    designation: string;
    name: string;
    pan: string;
    street: string;
    area?: string;
    city: string;
    state: string;
    postalCode: string;
    email: string;
    mobile: string;
  };
  payees: Array<{
    srNo: number;
    pan: string;
    name: string;
  }>;
  challans: Array<{
    challanSerial: string;
    bsrCode: string;
    paidDate: number; // Unix timestamp in ms
    minorHead: string;
    tdsAmount: number;
    surcharge: number;
    healthAndEducationCess: number;
    interest: number;
    lateFilingFees: number;
    otherPenalty: number;
  }>;
  payments: Array<{
    payeeSrNo: number;
    challanSerial: string;
    bsrCode: string;
    section: string;
    creditAmount: number;
    creditDate: number; // Unix timestamp in ms
    tdsAmount: number;
    surcharge: number;
    healthAndEducationCess: number;
    deductionDate: number; // Unix timestamp in ms
    reasonForLowerDeduction?: string;
    certificateNumber?: string;
    // 194N cash withdrawal fields
    cashWithdrawalMoreThan1Crore?: number;
    cashWithdrawal20LTo1CrNonFilers?: number;
    cashWithdrawalMoreThan1CrNonFilers?: number;
    cashWithdrawalMoreThan3CrCoopSocieties?: number;
    cashWithdrawal20LTo3CrNonFilers?: number;
    cashWithdrawalMoreThan3CrNonFilers?: number;
  }>;
}): SheetJSON {
  return {
    name: `Form ${formType}`,
    sheets: [
      {
        name: 'Payer',
        blocks: [
          {
            name: 'Payer',
            '@entity': 'list',
            items: [
              ['name', data.payer.name],
              ['tan', data.payer.tan],
              ['pan', data.payer.pan],
              ['branch', data.payer.branch || 'HQ'],
              ['gstin', data.payer.gstin || ''],
              ['street', data.payer.street],
              ['area', data.payer.area || ''],
              ['city', data.payer.city],
              ['state', data.payer.state],
              ['postal_code', data.payer.postalCode],
              ['email', data.payer.email],
              ['mobile', data.payer.mobile],
            ],
          },
          {
            name: 'Responsible Person',
            '@entity': 'list',
            items: [
              ['designation', data.responsiblePerson.designation],
              ['name', data.responsiblePerson.name],
              ['pan', data.responsiblePerson.pan],
              ['street', data.responsiblePerson.street],
              ['area', data.responsiblePerson.area || ''],
              ['city', data.responsiblePerson.city],
              ['state', data.responsiblePerson.state],
              ['postal_code', data.responsiblePerson.postalCode],
              ['email', data.responsiblePerson.email],
              ['mobile', data.responsiblePerson.mobile],
            ],
          },
        ],
      },
      {
        name: 'Payee',
        blocks: [
          {
            name: 'Payee',
            '@entity': 'table',
            header: ['sr_no', 'pan', 'name'],
            rows: data.payees.map(p => [p.srNo, p.pan, p.name]),
          },
        ],
      },
      {
        name: 'Challan',
        blocks: [
          {
            name: 'Challan',
            '@entity': 'table',
            header: [
              'challan_serial', 'bsr_code', 'paid_date', 'minor_head',
              'tds_amount', 'surcharge', 'health_and_education_cess',
              'interest', 'late_filing_fees', 'other_penalty',
            ],
            rows: data.challans.map(c => [
              c.challanSerial, c.bsrCode, c.paidDate, c.minorHead,
              c.tdsAmount, c.surcharge, c.healthAndEducationCess,
              c.interest, c.lateFilingFees, c.otherPenalty,
            ]),
          },
        ],
      },
      {
        name: 'Payment',
        blocks: [
          {
            name: 'Payment',
            '@entity': 'table',
            header: [
              'payee_sr_no', 'challan_serial', 'bsr_code', 'section',
              'credit_amount', 'credit_date', 'tds_amount', 'surcharge',
              'health_and_education_cess', 'deduction_date',
              'reason_for_lower_deduction', 'certificate_number',
              'amount_of_cash_withdrawal_more_than_1_crore_us_194N',
              'amount_of_cash_withdrawal_between_20_lakhs_and_1_crore_us_194N_for_non_filers',
              'amount_of_cash_withdrawal_more_than_1_crore_us_194N_for_non_filers',
              'amount_of_cash_withdrawal_more_than_3_crore_us_194N_for_co-operative_societies',
              'amount_of_cash_withdrawal_between_20_lakhs_and_3_crore_us_194N_for_non_filers',
              'amount_of_cash_withdrawal_more_than_3_crore_us_194N_for_non_filers',
            ],
            rows: data.payments.map(p => [
              p.payeeSrNo, p.challanSerial, p.bsrCode, p.section,
              p.creditAmount, p.creditDate, p.tdsAmount, p.surcharge,
              p.healthAndEducationCess, p.deductionDate,
              p.reasonForLowerDeduction || '', p.certificateNumber || '',
              p.cashWithdrawalMoreThan1Crore || 0,
              p.cashWithdrawal20LTo1CrNonFilers || 0,
              p.cashWithdrawalMoreThan1CrNonFilers || 0,
              p.cashWithdrawalMoreThan3CrCoopSocieties || 0,
              p.cashWithdrawal20LTo3CrNonFilers || 0,
              p.cashWithdrawalMoreThan3CrNonFilers || 0,
            ]),
          },
        ],
      },
    ],
  };
}

export function parseSheetJSON(sheetJson: SheetJSON): {
  payer?: Record<string, any>;
  responsiblePerson?: Record<string, any>;
  payees: Array<Record<string, any>>;
  challans: Array<Record<string, any>>;
  payments: Array<Record<string, any>>;
} {
  const result: {
    payer?: Record<string, any>;
    responsiblePerson?: Record<string, any>;
    payees: Array<Record<string, any>>;
    challans: Array<Record<string, any>>;
    payments: Array<Record<string, any>>;
  } = { payees: [], challans: [], payments: [] };

  for (const sheet of sheetJson.sheets) {
    for (const block of sheet.blocks) {
      if (block['@entity'] === 'list' && block.items) {
        const obj: Record<string, any> = {};
        for (const [key, value] of block.items) {
          obj[key] = value;
        }
        if (block.name === 'Payer') {
          result.payer = obj;
        } else if (block.name === 'Responsible Person') {
          result.responsiblePerson = obj;
        }
      } else if (block['@entity'] === 'table' && block.header && block.rows) {
        const rows = block.rows.map(row => {
          const obj: Record<string, any> = {};
          block.header!.forEach((key, i) => {
            obj[key] = row[i];
          });
          return obj;
        });
        if (block.name === 'Payee') {
          result.payees = rows;
        } else if (block.name === 'Challan') {
          result.challans = rows;
        } else if (block.name === 'Payment') {
          result.payments = rows;
        }
      }
    }
  }

  return result;
}

export const sandboxTDSService = new SandboxTDSService();
