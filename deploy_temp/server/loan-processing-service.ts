import { ICICIBankAPI } from './icici-bank-api';
import { HDFCBankAPI } from './hdfc-bank-api';
import { TataCapitalAPI } from './tata-capital-api';
import { BajajFinanceAPI } from './bajaj-finance-api';

// Unified loan application interface
export interface LoanApplication {
  id: string;
  applicantId: string;
  loanType: 'personal' | 'home' | 'business' | 'car' | 'against_property' | 'against_securities';
  amount: number;
  tenure: number;
  purpose: string;
  employmentType: 'salaried' | 'self_employed' | 'business';
  monthlyIncome: number;
  cibilScore?: number;
  existingLoans?: number;
  collateralValue?: number;
  applicantDetails: {
    name: string;
    email: string;
    phone: string;
    pan: string;
    address: string;
    age: number;
  };
  preferredLender?: 'icici' | 'hdfc' | 'tata_capital' | 'bajaj_finance' | 'all';
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  createdAt: Date;
  updatedAt: Date;
}

export interface LoanOffer {
  lenderId: string;
  lenderName: string;
  interestRate: number;
  emi: number;
  processingFee: number;
  totalAmount: number;
  tenure: number;
  eligibilityScore: number;
  specialOffers?: string[];
  validityDays: number;
  terms: string[];
}

export interface LoanEligibilityRequest {
  loanType: string;
  amount: number;
  tenure: number;
  monthlyIncome: number;
  cibilScore?: number;
  employmentType: string;
  existingLoans?: number;
  age: number;
}

export class LoanProcessingService {
  private iciciBankAPI: ICICIBankAPI;
  private hdfcBankAPI: HDFCBankAPI;
  private tataCapitalAPI: TataCapitalAPI;
  private bajajFinanceAPI: BajajFinanceAPI;

  constructor() {
    // Initialize all bank APIs
    this.iciciBankAPI = new ICICIBankAPI({
      appKey: process.env.ICICI_BANK_APP_KEY || 'demo-key',
      secretKey: process.env.ICICI_BANK_SECRET_KEY || 'demo-secret',
      baseUrl: 'https://apigwuat.icicibank.com',
      environment: (process.env.ICICI_BANK_ENVIRONMENT as 'sandbox' | 'uat' | 'production') || 'sandbox'
    });

    this.hdfcBankAPI = new HDFCBankAPI({
      clientId: process.env.HDFC_BANK_CLIENT_ID || 'demo-client',
      clientSecret: process.env.HDFC_BANK_CLIENT_SECRET || 'demo-secret',
      baseUrl: 'https://api.hdfcbank.com',
      environment: (process.env.HDFC_BANK_ENVIRONMENT as 'sandbox' | 'uat' | 'production') || 'sandbox'
    });

    this.tataCapitalAPI = new TataCapitalAPI();
    this.bajajFinanceAPI = new BajajFinanceAPI();
  }

  // Check loan eligibility across all lenders
  async checkLoanEligibility(request: LoanEligibilityRequest): Promise<{
    eligible: boolean;
    offers: LoanOffer[];
    reasons?: string[];
  }> {
    const offers: LoanOffer[] = [];
    const reasons: string[] = [];

    try {
      // Check eligibility with each lender
      const eligibilityChecks = await Promise.allSettled([
        this.checkICICIEligibility(request),
        this.checkHDFCEligibility(request),
        this.checkTataCapitalEligibility(request),
        this.checkBajajFinanceEligibility(request)
      ]);

      eligibilityChecks.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          offers.push(result.value);
        } else if (result.status === 'rejected') {
          const lenderNames = ['ICICI Bank', 'HDFC Bank', 'Tata Capital', 'Bajaj Finance'];
          reasons.push(`${lenderNames[index]}: ${result.reason}`);
        }
      });

      // Sort offers by best interest rate
      offers.sort((a, b) => a.interestRate - b.interestRate);

      return {
        eligible: offers.length > 0,
        offers,
        reasons: reasons.length > 0 ? reasons : undefined
      };

    } catch (error) {
      console.error('Error checking loan eligibility:', error);
      return {
        eligible: false,
        offers: [],
        reasons: ['System error while checking eligibility']
      };
    }
  }

  // Apply for loan with selected lender
  async applyForLoan(application: LoanApplication): Promise<{
    success: boolean;
    applicationId?: string;
    message: string;
    estimatedProcessingDays?: number;
  }> {
    try {
      const { preferredLender, loanType, amount, tenure } = application;

      let result;
      switch (preferredLender) {
        case 'icici':
          result = await this.applyICICILoan(application);
          break;
        case 'hdfc':
          result = await this.applyHDFCLoan(application);
          break;
        case 'tata_capital':
          result = await this.applyTataCapitalLoan(application);
          break;
        case 'bajaj_finance':
          result = await this.applyBajajFinanceLoan(application);
          break;
        default:
          // Apply to all lenders and return best offer
          result = await this.applyToBestLender(application);
      }

      return result;

    } catch (error) {
      console.error('Error applying for loan:', error);
      return {
        success: false,
        message: 'Failed to submit loan application. Please try again.'
      };
    }
  }

  // Check loan status across lenders
  async checkLoanStatus(applicationId: string, lenderId: string): Promise<{
    status: string;
    stage: string;
    documentsRequired?: string[];
    nextSteps?: string[];
    estimatedDisbursementDate?: Date;
  }> {
    try {
      switch (lenderId) {
        case 'icici':
          return await this.checkICICILoanStatus(applicationId);
        case 'hdfc':
          return await this.checkHDFCLoanStatus(applicationId);
        case 'tata_capital':
          return await this.checkTataCapitalLoanStatus(applicationId);
        case 'bajaj_finance':
          return await this.checkBajajFinanceLoanStatus(applicationId);
        default:
          throw new Error('Invalid lender ID');
      }
    } catch (error) {
      console.error('Error checking loan status:', error);
      return {
        status: 'error',
        stage: 'Unable to fetch status'
      };
    }
  }

  // ICICI Bank loan methods
  private async checkICICIEligibility(request: LoanEligibilityRequest): Promise<LoanOffer> {
    // ICICI eligibility logic
    const { amount, monthlyIncome, employmentType, cibilScore = 750 } = request;
    
    // Basic eligibility criteria
    const minCibil = 650;
    const maxLTV = employmentType === 'salaried' ? 0.85 : 0.75;
    const maxEMIRatio = 0.50;

    if (cibilScore < minCibil) {
      throw new Error('CIBIL score below minimum requirement');
    }

    // Calculate offer
    let interestRate = 10.50; // Base rate for ICICI
    if (employmentType === 'self_employed') interestRate += 0.5;
    if (cibilScore < 700) interestRate += 0.25;
    if (amount > 1000000) interestRate += 0.25;

    const monthlyRate = interestRate / 100 / 12;
    const emi = (amount * monthlyRate * Math.pow(1 + monthlyRate, request.tenure)) / 
                 (Math.pow(1 + monthlyRate, request.tenure) - 1);
    
    const emiRatio = emi / monthlyIncome;
    if (emiRatio > maxEMIRatio) {
      throw new Error('EMI to income ratio too high');
    }

    return {
      lenderId: 'icici',
      lenderName: 'ICICI Bank',
      interestRate,
      emi: Math.round(emi),
      processingFee: Math.min(amount * 0.02, 50000), // 2% or max ₹50k
      totalAmount: Math.round(emi * request.tenure),
      tenure: request.tenure,
      eligibilityScore: this.calculateEligibilityScore(cibilScore, emiRatio, employmentType),
      specialOffers: cibilScore > 780 ? ['0.25% rate reduction for high CIBIL', 'Free insurance'] : [],
      validityDays: 15,
      terms: ['Income proof required', 'Property documents for secured loans', 'Bank account statements']
    };
  }

  private async checkHDFCEligibility(request: LoanEligibilityRequest): Promise<LoanOffer> {
    // HDFC eligibility logic
    const { amount, monthlyIncome, employmentType, cibilScore = 750 } = request;
    
    const minCibil = 675;
    const maxEMIRatio = 0.55; // HDFC allows slightly higher EMI ratio

    if (cibilScore < minCibil) {
      throw new Error('CIBIL score below minimum requirement');
    }

    // Calculate HDFC offer
    let interestRate = 10.75; // Base rate for HDFC
    if (employmentType === 'self_employed') interestRate += 0.75;
    if (cibilScore < 720) interestRate += 0.5;
    if (amount > 1500000) interestRate += 0.25;

    const monthlyRate = interestRate / 100 / 12;
    const emi = (amount * monthlyRate * Math.pow(1 + monthlyRate, request.tenure)) / 
                 (Math.pow(1 + monthlyRate, request.tenure) - 1);

    const emiRatio = emi / monthlyIncome;
    if (emiRatio > maxEMIRatio) {
      throw new Error('EMI to income ratio too high');
    }

    return {
      lenderId: 'hdfc',
      lenderName: 'HDFC Bank',
      interestRate,
      emi: Math.round(emi),
      processingFee: Math.min(amount * 0.025, 75000), // 2.5% or max ₹75k
      totalAmount: Math.round(emi * request.tenure),
      tenure: request.tenure,
      eligibilityScore: this.calculateEligibilityScore(cibilScore, emiRatio, employmentType),
      specialOffers: amount > 500000 ? ['Priority processing', 'Relationship rewards'] : [],
      validityDays: 20,
      terms: ['Salary slips', 'ITR for self-employed', 'Bank statements', 'Identity proof']
    };
  }

  private async checkTataCapitalEligibility(request: LoanEligibilityRequest): Promise<LoanOffer> {
    // Use existing Tata Capital API
    const result = this.tataCapitalAPI.calculatePersonalLoan(
      request.amount,
      request.tenure,
      request.employmentType as 'salaried' | 'self-employed'
    );

    if (!result.eligibility) {
      throw new Error('Does not meet Tata Capital criteria');
    }

    return {
      lenderId: 'tata_capital',
      lenderName: 'Tata Capital',
      interestRate: result.interestRate,
      emi: result.emi,
      processingFee: result.processingFee,
      totalAmount: result.totalAmount,
      tenure: request.tenure,
      eligibilityScore: this.calculateEligibilityScore(request.cibilScore || 750, result.emi / request.monthlyIncome, request.employmentType),
      specialOffers: ['Digital application', 'Quick approval'],
      validityDays: 10,
      terms: ['Income proof', 'Address proof', 'Bank statements']
    };
  }

  private async checkBajajFinanceEligibility(request: LoanEligibilityRequest): Promise<LoanOffer> {
    // Use existing Bajaj Finance API
    const result = this.bajajFinanceAPI.calculatePersonalLoan(request.amount, request.tenure);

    return {
      lenderId: 'bajaj_finance',
      lenderName: 'Bajaj Finance',
      interestRate: result.interestRate,
      emi: result.emi,
      processingFee: result.processingFee,
      totalAmount: result.totalAmount,
      tenure: request.tenure,
      eligibilityScore: this.calculateEligibilityScore(request.cibilScore || 750, result.emi / request.monthlyIncome, request.employmentType),
      specialOffers: ['Flexi loan option', 'No prepayment charges'],
      validityDays: 7,
      terms: ['Instant approval', 'Minimal documentation', 'Aadhaar based KYC']
    };
  }

  private calculateEligibilityScore(cibilScore: number, emiRatio: number, employmentType: string): number {
    let score = 0;
    
    // CIBIL score weightage (40%)
    if (cibilScore >= 800) score += 40;
    else if (cibilScore >= 750) score += 35;
    else if (cibilScore >= 700) score += 30;
    else if (cibilScore >= 650) score += 20;
    else score += 10;

    // EMI ratio weightage (30%)
    if (emiRatio <= 0.3) score += 30;
    else if (emiRatio <= 0.4) score += 25;
    else if (emiRatio <= 0.5) score += 15;
    else score += 5;

    // Employment type weightage (20%)
    if (employmentType === 'salaried') score += 20;
    else score += 15;

    // Additional factors (10%)
    score += 10; // Base score for applying

    return Math.min(score, 100);
  }

  // Application submission methods
  private async applyICICILoan(application: LoanApplication) {
    // Simulate ICICI loan application
    const applicationId = `ICICI-${Date.now()}`;
    
    return {
      success: true,
      applicationId,
      message: 'Application submitted successfully to ICICI Bank',
      estimatedProcessingDays: 3
    };
  }

  private async applyHDFCLoan(application: LoanApplication) {
    // Simulate HDFC loan application  
    const applicationId = `HDFC-${Date.now()}`;
    
    return {
      success: true,
      applicationId,
      message: 'Application submitted successfully to HDFC Bank',
      estimatedProcessingDays: 5
    };
  }

  private async applyTataCapitalLoan(application: LoanApplication) {
    // Simulate Tata Capital loan application
    const applicationId = `TATA-${Date.now()}`;
    
    return {
      success: true,
      applicationId,
      message: 'Application submitted successfully to Tata Capital',
      estimatedProcessingDays: 2
    };
  }

  private async applyBajajFinanceLoan(application: LoanApplication) {
    // Simulate Bajaj Finance loan application
    const applicationId = `BAJAJ-${Date.now()}`;
    
    return {
      success: true,
      applicationId,
      message: 'Application submitted successfully to Bajaj Finance',
      estimatedProcessingDays: 1
    };
  }

  private async applyToBestLender(application: LoanApplication) {
    // Check eligibility with all lenders and apply to the best one
    const eligibilityResult = await this.checkLoanEligibility({
      loanType: application.loanType,
      amount: application.amount,
      tenure: application.tenure,
      monthlyIncome: application.monthlyIncome,
      cibilScore: application.cibilScore,
      employmentType: application.employmentType,
      existingLoans: application.existingLoans,
      age: application.applicantDetails.age
    });

    if (!eligibilityResult.eligible || eligibilityResult.offers.length === 0) {
      return {
        success: false,
        message: 'Not eligible for loan from any lender'
      };
    }

    // Apply to the lender with best offer (lowest interest rate)
    const bestOffer = eligibilityResult.offers[0];
    application.preferredLender = bestOffer.lenderId as any;

    return await this.applyForLoan(application);
  }

  // Status checking methods
  private async checkICICILoanStatus(applicationId: string) {
    // Simulate ICICI loan status
    const statuses = ['submitted', 'under_review', 'approved', 'disbursed'];
    const stages = ['Application submitted', 'Document verification', 'Credit assessment', 'Approved'];
    
    return {
      status: 'approved',
      stage: 'Credit assessment completed',
      documentsRequired: ['Latest salary slips', 'Bank statements'],
      nextSteps: ['Final approval pending', 'Disbursement in 1-2 days'],
      estimatedDisbursementDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    };
  }

  private async checkHDFCLoanStatus(applicationId: string) {
    // Simulate HDFC loan status
    return {
      status: 'under_review',
      stage: 'Document verification in progress',
      documentsRequired: ['ITR documents', 'Form 16'],
      nextSteps: ['Upload pending documents', 'Wait for verification'],
      estimatedDisbursementDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
    };
  }

  private async checkTataCapitalLoanStatus(applicationId: string) {
    // Simulate Tata Capital loan status
    return {
      status: 'approved',
      stage: 'Loan approved - Ready for disbursement',
      nextSteps: ['E-sign loan agreement', 'Provide bank account details'],
      estimatedDisbursementDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000)
    };
  }

  private async checkBajajFinanceLoanStatus(applicationId: string) {
    // Simulate Bajaj Finance loan status
    return {
      status: 'disbursed',
      stage: 'Loan disbursed successfully',
      nextSteps: ['First EMI due on 15th of next month'],
      estimatedDisbursementDate: new Date()
    };
  }
}

// Export singleton instance
export const loanProcessingService = new LoanProcessingService();