// Financial calculation utilities

export interface TaxCalculationInput {
  annualIncome: number;
  regime: 'new' | 'old';
  section80C: number;
  section80D: number;
  age: 'below60' | '60to80' | 'above80';
}

export interface TaxCalculationResult {
  grossIncome: number;
  taxableIncome: number;
  incomeTax: number;
  cess: number;
  totalTax: number;
  netIncome: number;
  effectiveRate: number;
  marginalRate: number;
  regime: 'new' | 'old';
  deductions: {
    section80C: number;
    section80D: number;
    standardDeduction: number;
    total: number;
  };
  slabBreakdown: Array<{
    slab: string;
    rate: string;
    tax: number;
  }>;
}

export interface SipCalculationInput {
  monthlyInvestment: number;
  expectedReturn: number;
  timePeriod: number;
}

export interface SipCalculationResult {
  totalInvestment: number;
  expectedReturns: number;
  maturityAmount: number;
  totalGainPercent: number;
}

export interface EmiCalculationInput {
  loanAmount: number;
  interestRate: number;
  tenure: number;
}

export interface EmiCalculationResult {
  monthlyEmi: number;
  totalInterest: number;
  totalAmount: number;
  schedule: Array<{
    month: number;
    emi: number;
    principal: number;
    interest: number;
    balance: number;
  }>;
}

/**
 * Calculate income tax based on the input parameters
 */
export function calculateIncomeTax(input: TaxCalculationInput): TaxCalculationResult {
  const { annualIncome, regime, section80C, section80D, age } = input;
  
  // Standard deduction for both regimes
  const standardDeduction = 50000;
  
  // Calculate deductions based on regime
  let totalDeductions = standardDeduction;
  let deductionBreakdown = {
    section80C: 0,
    section80D: 0,
    standardDeduction,
    total: standardDeduction
  };
  
  if (regime === 'old') {
    const maxSection80C = Math.min(section80C, 150000);
    const maxSection80D = Math.min(section80D, age === 'above80' ? 50000 : age === '60to80' ? 30000 : 25000);
    
    totalDeductions += maxSection80C + maxSection80D;
    deductionBreakdown = {
      section80C: maxSection80C,
      section80D: maxSection80D,
      standardDeduction,
      total: totalDeductions
    };
  }
  
  const taxableIncome = Math.max(0, annualIncome - totalDeductions);
  
  // Calculate tax based on regime and slabs
  let incomeTax = 0;
  const slabBreakdown: Array<{ slab: string; rate: string; tax: number }> = [];
  
  if (regime === 'new') {
    // New regime slabs (2024-25)
    const slabs = [
      { min: 0, max: 300000, rate: 0 },
      { min: 300000, max: 600000, rate: 5 },
      { min: 600000, max: 900000, rate: 10 },
      { min: 900000, max: 1200000, rate: 15 },
      { min: 1200000, max: 1500000, rate: 20 },
      { min: 1500000, max: Infinity, rate: 30 }
    ];
    
    for (const slab of slabs) {
      if (taxableIncome > slab.min) {
        const taxableAtSlab = Math.min(taxableIncome, slab.max) - slab.min;
        const taxAtSlab = (taxableAtSlab * slab.rate) / 100;
        
        if (taxAtSlab > 0) {
          incomeTax += taxAtSlab;
          slabBreakdown.push({
            slab: slab.max === Infinity 
              ? `₹${(slab.min / 100000).toFixed(0)} lakh+` 
              : `₹${(slab.min / 100000).toFixed(0)} - ${(slab.max / 100000).toFixed(0)} lakh`,
            rate: `${slab.rate}%`,
            tax: taxAtSlab
          });
        }
      }
    }
  } else {
    // Old regime slabs
    const slabs = [
      { min: 0, max: 250000, rate: 0 },
      { min: 250000, max: 500000, rate: 5 },
      { min: 500000, max: 1000000, rate: 20 },
      { min: 1000000, max: Infinity, rate: 30 }
    ];
    
    // Adjust basic exemption for age
    if (age === '60to80') {
      slabs[0].max = 300000;
      slabs[1].min = 300000;
    } else if (age === 'above80') {
      slabs[0].max = 500000;
      slabs[1].min = 500000;
    }
    
    for (const slab of slabs) {
      if (taxableIncome > slab.min) {
        const taxableAtSlab = Math.min(taxableIncome, slab.max) - slab.min;
        const taxAtSlab = (taxableAtSlab * slab.rate) / 100;
        
        if (taxAtSlab > 0) {
          incomeTax += taxAtSlab;
          slabBreakdown.push({
            slab: slab.max === Infinity 
              ? `₹${(slab.min / 100000).toFixed(0)} lakh+` 
              : `₹${(slab.min / 100000).toFixed(0)} - ${(slab.max / 100000).toFixed(0)} lakh`,
            rate: `${slab.rate}%`,
            tax: taxAtSlab
          });
        }
      }
    }
  }
  
  // Calculate cess (4% on income tax)
  const cess = incomeTax * 0.04;
  const totalTax = incomeTax + cess;
  const netIncome = annualIncome - totalTax;
  const effectiveRate = annualIncome > 0 ? (totalTax / annualIncome) * 100 : 0;
  
  // Determine marginal rate
  let marginalRate = 0;
  if (regime === 'new') {
    if (taxableIncome > 1500000) marginalRate = 30;
    else if (taxableIncome > 1200000) marginalRate = 20;
    else if (taxableIncome > 1000000) marginalRate = 15;
    else if (taxableIncome > 700000) marginalRate = 10;
    else if (taxableIncome > 300000) marginalRate = 5;
  } else {
    if (taxableIncome > 1000000) marginalRate = 30;
    else if (taxableIncome > 500000) marginalRate = 20;
    else if (taxableIncome > (age === 'above80' ? 500000 : age === '60to80' ? 300000 : 250000)) marginalRate = 5;
  }
  
  return {
    grossIncome: annualIncome,
    taxableIncome,
    incomeTax,
    cess,
    totalTax,
    netIncome,
    effectiveRate,
    marginalRate,
    regime,
    deductions: deductionBreakdown,
    slabBreakdown
  };
}

/**
 * Calculate SIP returns using compound interest formula
 */
export function calculateSipReturns(input: SipCalculationInput): SipCalculationResult {
  const { monthlyInvestment, expectedReturn, timePeriod } = input;
  
  const monthlyRate = expectedReturn / 100 / 12;
  const totalMonths = timePeriod * 12;
  const totalInvestment = monthlyInvestment * totalMonths;
  
  // SIP maturity calculation using compound interest formula
  const maturityAmount = monthlyInvestment * (((Math.pow(1 + monthlyRate, totalMonths)) - 1) / monthlyRate) * (1 + monthlyRate);
  const expectedReturns = maturityAmount - totalInvestment;
  const totalGainPercent = totalInvestment > 0 ? (expectedReturns / totalInvestment) * 100 : 0;
  
  return {
    totalInvestment,
    expectedReturns,
    maturityAmount,
    totalGainPercent
  };
}

/**
 * Calculate EMI and payment schedule
 */
export function calculateEmiSchedule(input: EmiCalculationInput): EmiCalculationResult {
  const { loanAmount, interestRate, tenure } = input;
  
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = tenure * 12;
  
  // EMI calculation using standard formula
  const emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / 
    (Math.pow(1 + monthlyRate, totalMonths) - 1);
  
  const totalAmount = emi * totalMonths;
  const totalInterest = totalAmount - loanAmount;
  
  // Generate amortization schedule for first 12 months
  let balance = loanAmount;
  const schedule = [];
  
  for (let month = 1; month <= Math.min(12, totalMonths); month++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = emi - interestPayment;
    balance = balance - principalPayment;
    
    schedule.push({
      month,
      emi: Math.round(emi),
      principal: Math.round(principalPayment),
      interest: Math.round(interestPayment),
      balance: Math.round(balance)
    });
  }
  
  return {
    monthlyEmi: emi,
    totalInterest,
    totalAmount,
    schedule
  };
}

// ============================================================================
// IPO Listing Gain & Grey Market Premium (GMP) Engine (FASP-IPO-v1.0)
// ============================================================================

export interface IpoListingGainInput {
  /** Cap / Cut-off price of the price band in INR (₹) */
  issuePrice: number;
  /** Latest Grey Market Premium quote per share in INR (₹) */
  gmp: number;
  /** Number of shares in 1 retail bid lot */
  lotSize: number;
  /** Total issue size in ₹ Crores (optional, default: 1000 Cr) */
  issueSizeCrores?: number;
  /** QIB subscription multiple, e.g. 45.5 for 45.5x (optional) */
  qibSubscription?: number;
  /** Retail subscription multiple, e.g. 12.0 for 12.0x (optional) */
  retailSubscription?: number;
  /** Total subscription multiple across all categories (optional) */
  totalSubscription?: number;
  /** Issue category: 'mainboard' or 'sme' (default: 'mainboard') */
  issueType?: "mainboard" | "sme";
  /** Percentage market index change from close to listing, e.g. -1.5 for -1.5% (optional) */
  marketDriftPercent?: number;
}

export interface IpoListingGainResult {
  engineVersion: "FASP-IPO-v1.0";
  calculationTimestamp: string;
  issuePrice: number;
  rawGmp: number;
  rawGmpPercent: number;
  lotSize: number;
  totalLotInvestment: number;
  expectedListingPrice: number;
  expectedListingGainPercent: number;
  expectedGrossGainPerLot: number;
  expectedNetPostTaxGainPerLot: number; // Post 20% STCG (Finance Act 2024) + STT/charges
  priceRange: {
    bearishPrice: number;
    bearishGainPercent: number;
    basePrice: number;
    baseGainPercent: number;
    bullishPrice: number;
    bullishGainPercent: number;
  };
  applicationEconomics: {
    retailAllotmentProbability: number; // 0.0 to 1.0
    expectedMonetaryValuePerApplication: number; // EV = prob * net_gain
  };
  adjustments: {
    qibMultiplier: number;
    issueSizeFactor: number;
    marketDriftApplied: number;
    regulatoryCapApplied: boolean;
  };
  disclaimer: string;
}

/**
 * Calculates high-accuracy expected IPO listing gain and listing price
 * by adjusting raw Grey Market Premium (GMP) with:
 * 1. Institutional Demand Quality Multiplier (QIB elasticity)
 * 2. Issue Size Float Scarcity Factor (mega-issue overhang vs micro-issue scarcity)
 * 3. Market Beta Drift (systematic index movement between close and listing)
 * 4. Regulatory Circuit Filters (SEBI July 2024 SME +90% listing day cap)
 * 5. Three-point volatility confidence interval (Bearish / Base / Bullish)
 * 6. Post-tax net gains (Finance Act 2024 20% STCG + statutory charges)
 * 7. Retail lottery allotment odds and Expected Monetary Value (EMV)
 */
export function calculateIpoListingGain(input: IpoListingGainInput): IpoListingGainResult {
  const issuePrice = Math.max(1, Number(input.issuePrice) || 100);
  const rawGmp = Number(input.gmp) || 0;
  const lotSize = Math.max(1, Number(input.lotSize) || 1);
  const issueSize = Math.max(10, Number(input.issueSizeCrores) || 1000);
  const isSme = input.issueType === "sme";

  // 1. Raw GMP Yield
  const rawYield = rawGmp / issuePrice;

  // 2. QIB Institutional Multiplier (CQIB)
  let qibMultiplier = 1.0;
  if (typeof input.qibSubscription === "number" && input.qibSubscription > 0) {
    const qib = input.qibSubscription;
    // Log-sigmoid centered at 10x subscription
    const logDiff = Math.log(1 + qib) - Math.log(1 + 10);
    qibMultiplier = 1.0 + 0.22 * Math.tanh(logDiff / 2.5);
  } else if (typeof input.totalSubscription === "number" && input.totalSubscription > 0) {
    const sub = input.totalSubscription;
    const logDiff = Math.log(1 + sub) - Math.log(1 + 10);
    qibMultiplier = 1.0 + 0.15 * Math.tanh(logDiff / 3.0);
  }

  // 3. Issue Size Float Scarcity Factor (Fsize)
  const logSize = Math.log10(Math.max(50, issueSize));
  const minLog = Math.log10(50);
  const maxLog = Math.log10(25000);
  const normSize = (logSize - minLog) / (maxLog - minLog);
  const issueSizeFactor = Math.min(1.08, Math.max(0.88, 1.0 - 0.12 * (normSize - 0.5)));

  // 4. Systematic Market Drift (delta_market)
  const marketBeta = isSme ? 2.0 : 1.5;
  const marketDrift = typeof input.marketDriftPercent === "number"
    ? (input.marketDriftPercent / 100) * marketBeta
    : 0;

  // 5. Unbounded Return
  let expectedReturn = (rawYield * qibMultiplier * issueSizeFactor) + marketDrift;

  // 6. Regulatory Circuit Cap Enforcement
  let regulatoryCapApplied = false;
  if (isSme && expectedReturn > 0.90) {
    expectedReturn = 0.90; // SEBI July 2024 SME listing day 90% cap
    regulatoryCapApplied = true;
  }
  expectedReturn = Math.max(-0.40, expectedReturn); // Floor at -40%

  // 7. Expected Prices & Volatility Bounds
  const expectedListingPrice = Math.round(issuePrice * (1 + expectedReturn) * 100) / 100;
  const sigma = 0.05 + 0.12 * Math.abs(expectedReturn);

  const bearReturn = Math.max(-0.40, expectedReturn - sigma);
  const maxBullCap = isSme ? 0.90 : 2.50;
  const bullReturn = Math.min(maxBullCap, expectedReturn + sigma);

  const bearishPrice = Math.round(issuePrice * (1 + bearReturn) * 100) / 100;
  const bullishPrice = Math.round(issuePrice * (1 + bullReturn) * 100) / 100;

  // 8. Financial Gains & Taxes
  const totalLotInvestment = issuePrice * lotSize;
  const grossGainPerLot = Math.round((expectedListingPrice - issuePrice) * lotSize);

  // Finance Act 2024: 20% STCG + ~0.35% STT/Brokerage/Turnover on gross gain
  const netPostTaxGainPerLot = grossGainPerLot > 0
    ? Math.round(grossGainPerLot * 0.795)
    : grossGainPerLot;

  // 9. Application Economics (Lottery Probability & EV)
  const retailSub = Math.max(1, Number(input.retailSubscription) || (Number(input.totalSubscription) || 1));
  const retailProb = Math.round((1.0 / retailSub) * 10000) / 10000;
  const evPerApplication = Math.round(retailProb * netPostTaxGainPerLot);

  return {
    engineVersion: "FASP-IPO-v1.0",
    calculationTimestamp: new Date().toISOString(),
    issuePrice,
    rawGmp,
    rawGmpPercent: Math.round(rawYield * 1000) / 10,
    lotSize,
    totalLotInvestment,
    expectedListingPrice,
    expectedListingGainPercent: Math.round(expectedReturn * 1000) / 10,
    expectedGrossGainPerLot: grossGainPerLot,
    expectedNetPostTaxGainPerLot: netPostTaxGainPerLot,
    priceRange: {
      bearishPrice,
      bearishGainPercent: Math.round(bearReturn * 1000) / 10,
      basePrice: expectedListingPrice,
      baseGainPercent: Math.round(expectedReturn * 1000) / 10,
      bullishPrice,
      bullishGainPercent: Math.round(bullReturn * 1000) / 10,
    },
    applicationEconomics: {
      retailAllotmentProbability: Math.min(1.0, retailProb),
      expectedMonetaryValuePerApplication: evPerApplication,
    },
    adjustments: {
      qibMultiplier: Math.round(qibMultiplier * 1000) / 1000,
      issueSizeFactor: Math.round(issueSizeFactor * 1000) / 1000,
      marketDriftApplied: Math.round(marketDrift * 10000) / 100,
      regulatoryCapApplied,
    },
    disclaimer: "Grey Market Premium (GMP) is an unregulated OTC indicator and not a guaranteed listing price. Final listing is determined by the stock exchange pre-open call auction.",
  };
}