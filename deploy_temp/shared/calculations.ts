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