import * as financial from 'financial';

// Bajaj Finance API Simulation
// Since Bajaj Finance doesn't offer public APIs, this simulates their financial products
export class BajajFinanceAPI {
  constructor() {
  }

  // EMI Calculator (Based on Bajaj Finance rates)
  calculateEMI(principal: number, interestRate: number, tenure: number): {
    emi: number;
    totalAmount: number;
    totalInterest: number;
    breakdown: Array<{month: number, emi: number, principal: number, interest: number, balance: number}>;
  } {
    const monthlyRate = interestRate / 100 / 12;
    const emi = financial.pmt(monthlyRate, tenure, -principal);
    
    const totalAmount = emi * tenure;
    const totalInterest = totalAmount - principal;
    
    // Generate amortization schedule
    const breakdown = [];
    let balance = principal;
    
    for (let month = 1; month <= tenure; month++) {
      const interestComponent = balance * monthlyRate;
      const principalComponent = emi - interestComponent;
      balance = balance - principalComponent;
      
      breakdown.push({
        month,
        emi: Math.round(emi),
        principal: Math.round(principalComponent),
        interest: Math.round(interestComponent),
        balance: Math.round(balance)
      });
    }

    return {
      emi: Math.round(emi),
      totalAmount: Math.round(totalAmount),
      totalInterest: Math.round(totalInterest),
      breakdown
    };
  }

  // Personal Loan Calculator
  calculatePersonalLoan(amount: number, tenure: number): {
    emi: number;
    interestRate: number;
    processingFee: number;
    totalAmount: number;
  } {
    // Bajaj Finance Personal Loan rates (approximated from public data)
    let interestRate = 10.99; // Starting rate
    
    // Rate adjustments based on amount and tenure
    if (amount > 500000) interestRate = 10.99;
    else if (amount > 200000) interestRate = 11.99;
    else interestRate = 12.99;

    if (tenure > 36) interestRate += 0.5;

    const processingFee = Math.min(amount * 0.0299, 9999); // Up to 2.99% or max ₹9,999
    const emiResult = this.calculateEMI(amount, interestRate, tenure);

    return {
      emi: emiResult.emi,
      interestRate,
      processingFee: Math.round(processingFee),
      totalAmount: emiResult.totalAmount
    };
  }

  // Business Loan Calculator
  calculateBusinessLoan(amount: number, tenure: number, businessType: string): {
    emi: number;
    interestRate: number;
    processingFee: number;
    collateralRequired: boolean;
  } {
    // Bajaj Finance Business Loan rates
    let interestRate = 16.0; // Base rate

    // Adjust based on business type
    const businessRates: Record<string, number> = {
      'manufacturing': 14.0,
      'trading': 16.0,
      'services': 18.0,
      'retail': 19.0,
      'other': 20.0
    };

    interestRate = businessRates[businessType.toLowerCase()] || 20.0;

    // Collateral requirement
    const collateralRequired = amount > 1000000;
    
    const processingFee = amount * 0.02; // 2% processing fee
    const emiResult = this.calculateEMI(amount, interestRate, tenure);

    return {
      emi: emiResult.emi,
      interestRate,
      processingFee: Math.round(processingFee),
      collateralRequired
    };
  }

  // Fixed Deposit Calculator
  calculateFD(amount: number, tenure: number, fdType: 'regular' | 'senior-citizen' = 'regular'): {
    maturityAmount: number;
    interestEarned: number;
    interestRate: number;
  } {
    // Bajaj Finance FD rates (approximated)
    let interestRate = 8.10; // Base rate for regular FD

    if (fdType === 'senior-citizen') {
      interestRate = 8.50; // Additional 0.4% for senior citizens
    }

    // Tenure-based rate adjustments
    if (tenure >= 36) interestRate = 8.35;
    else if (tenure >= 24) interestRate = 8.25;
    else if (tenure >= 12) interestRate = 8.10;
    else interestRate = 7.90;

    if (fdType === 'senior-citizen') interestRate += 0.40;

    const maturityAmount = financial.fv(interestRate / 100 / 12, tenure, 0, -amount);
    const interestEarned = maturityAmount - amount;

    return {
      maturityAmount: Math.round(maturityAmount),
      interestEarned: Math.round(interestEarned),
      interestRate
    };
  }

  // Two Wheeler Loan Calculator
  calculateTwoWheelerLoan(vehiclePrice: number, downPayment: number, tenure: number): {
    loanAmount: number;
    emi: number;
    interestRate: number;
    processingFee: number;
  } {
    const loanAmount = vehiclePrice - downPayment;
    const interestRate = 11.99; // Bajaj Auto Finance rate
    const processingFee = 999; // Fixed processing fee

    const emiResult = this.calculateEMI(loanAmount, interestRate, tenure);

    return {
      loanAmount,
      emi: emiResult.emi,
      interestRate,
      processingFee
    };
  }

  // Insurance Premium Calculator
  calculateInsurancePremium(age: number, sumAssured: number, policyType: 'life' | 'health' | 'motor'): {
    premium: number;
    coverage: number;
    benefits: string[];
  } {
    let premium = 0;
    let benefits: string[] = [];

    switch (policyType) {
      case 'life':
        premium = (sumAssured * 0.05) + (age * 50);
        benefits = ['Life Cover', 'Maturity Benefit', 'Tax Benefits', 'Loan Facility'];
        break;
      case 'health':
        premium = (sumAssured * 0.03) + (age * 100);
        benefits = ['Hospitalization', 'Pre/Post Hospitalization', 'Ambulance', 'Health Checkup'];
        break;
      case 'motor':
        premium = sumAssured * 0.02;
        benefits = ['Third Party Cover', 'Own Damage', 'Personal Accident', 'Roadside Assistance'];
        break;
    }

    return {
      premium: Math.round(premium),
      coverage: sumAssured,
      benefits
    };
  }

  // SIP Calculator
  calculateSIP(monthlyAmount: number, annualReturn: number, tenure: number): {
    totalInvestment: number;
    expectedAmount: number;
    wealthGain: number;
  } {
    const monthlyReturn = annualReturn / 100 / 12;
    const totalMonths = tenure * 12;
    
    const futureValue = financial.fv(monthlyReturn, totalMonths, -monthlyAmount, 0);
    const totalInvestment = monthlyAmount * totalMonths;
    const wealthGain = futureValue - totalInvestment;

    return {
      totalInvestment: Math.round(totalInvestment),
      expectedAmount: Math.round(futureValue),
      wealthGain: Math.round(wealthGain)
    };
  }

  // Get current interest rates (simulated data)
  getCurrentRates(): {
    personalLoan: { min: number; max: number };
    businessLoan: { min: number; max: number };
    homeLoan: { min: number; max: number };
    fixedDeposit: { regular: number; seniorCitizen: number };
    autoLoan: { min: number; max: number };
  } {
    return {
      personalLoan: { min: 10.99, max: 21.00 },
      businessLoan: { min: 14.00, max: 20.00 },
      homeLoan: { min: 8.50, max: 11.50 },
      fixedDeposit: { regular: 8.10, seniorCitizen: 8.50 },
      autoLoan: { min: 9.50, max: 13.99 }
    };
  }

  // Eligibility checker
  checkLoanEligibility(salary: number, age: number, loanType: string): {
    eligible: boolean;
    maxLoanAmount: number;
    reason?: string;
  } {
    // Basic eligibility criteria
    const minAge = 21;
    const maxAge = loanType === 'home' ? 65 : 60;
    const minSalary = 15000;

    if (age < minAge || age > maxAge) {
      return {
        eligible: false,
        maxLoanAmount: 0,
        reason: `Age should be between ${minAge} and ${maxAge} years`
      };
    }

    if (salary < minSalary) {
      return {
        eligible: false,
        maxLoanAmount: 0,
        reason: `Minimum salary requirement is ₹${minSalary.toLocaleString()}`
      };
    }

    // Calculate max loan amount (generally 20x of monthly salary)
    const maxLoanAmount = salary * 20;

    return {
      eligible: true,
      maxLoanAmount
    };
  }
}

export const bajajFinanceAPI = new BajajFinanceAPI();