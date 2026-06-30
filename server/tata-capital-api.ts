import * as financial from "financial";
import axios from "axios";

// Tata Capital API Integration
// Based on official Tata Capital API catalogue
export class TataCapitalAPI {
	private baseURL: string = "https://api.tatacapital.com"; // Note: Official API requires partnership

	// Personal Loan Calculator (Based on Tata Capital rates)
	calculatePersonalLoan(
		principal: number,
		tenure: number,
		employmentType: "salaried" | "self-employed",
	): {
		emi: number;
		interestRate: number;
		processingFee: number;
		totalAmount: number;
		eligibility: boolean;
	} {
		// Tata Capital Personal Loan rates
		let interestRate = 10.99; // Starting rate for salaried

		if (employmentType === "self-employed") {
			interestRate = 11.99;
		}

		// Rate adjustments based on amount and tenure
		if (principal > 1000000) interestRate += 0.5;
		if (tenure > 48) interestRate += 0.25;

		const processingFee = Math.min(principal * 0.025, 15000); // Up to 2.5% or max ₹15,000
		const monthlyRate = interestRate / 100 / 12;
		const emi = financial.pmt(monthlyRate, tenure, -principal);
		const totalAmount = emi * tenure;

		// Basic eligibility (simplified)
		const eligibility =
			principal >= 25000 &&
			principal <= 3500000 &&
			tenure >= 12 &&
			tenure <= 84;

		return {
			emi: Math.round(emi),
			interestRate,
			processingFee: Math.round(processingFee),
			totalAmount: Math.round(totalAmount),
			eligibility,
		};
	}

	// Home Loan Calculator
	calculateHomeLoan(
		principal: number,
		tenure: number,
		propertyType: "ready" | "under-construction",
	): {
		emi: number;
		interestRate: number;
		processingFee: number;
		totalAmount: number;
		maxLoanAmount: number;
	} {
		// Tata Capital Home Loan rates
		let interestRate = 8.75; // Base rate

		if (propertyType === "under-construction") {
			interestRate = 9.0; // Higher rate for under-construction
		}

		// Tenure-based adjustments
		if (tenure > 240) interestRate += 0.25; // 20+ years

		const processingFee = Math.min(principal * 0.005, 25000); // Up to 0.5% or max ₹25,000
		const monthlyRate = interestRate / 100 / 12;
		const emi = financial.pmt(monthlyRate, tenure, -principal);
		const totalAmount = emi * tenure;

		// Maximum loan amount (up to 90% of property value)
		const maxLoanAmount = 10000000; // ₹1 Crore

		return {
			emi: Math.round(emi),
			interestRate,
			processingFee: Math.round(processingFee),
			totalAmount: Math.round(totalAmount),
			maxLoanAmount,
		};
	}

	// Business Loan Calculator
	calculateBusinessLoan(
		principal: number,
		tenure: number,
		businessVintage: number,
		turnover: number,
	): {
		emi: number;
		interestRate: number;
		processingFee: number;
		collateralRequired: boolean;
		eligibility: boolean;
	} {
		// Tata Capital Business Loan rates
		let interestRate = 12.5; // Base rate

		// Adjustments based on business profile
		if (businessVintage >= 3) interestRate -= 0.5; // Lower rate for established business
		if (turnover >= 10000000) interestRate -= 0.25; // Lower rate for high turnover

		const processingFee = principal * 0.02; // 2% processing fee
		const collateralRequired = principal > 5000000; // Collateral for loans > ₹50L

		const monthlyRate = interestRate / 100 / 12;
		const emi = financial.pmt(monthlyRate, tenure, -principal);

		// Eligibility criteria
		const eligibility =
			businessVintage >= 2 && turnover >= 2000000 && principal <= 75000000;

		return {
			emi: Math.round(emi),
			interestRate,
			processingFee: Math.round(processingFee),
			collateralRequired,
			eligibility,
		};
	}

	// Used Car Loan Calculator (with VAHAN and IBB integration simulation)
	calculateUsedCarLoan(
		vehiclePrice: number,
		vehicleAge: number,
		downPayment: number,
		tenure: number,
	): {
		loanAmount: number;
		emi: number;
		interestRate: number;
		processingFee: number;
		maxLoanToValue: number;
		vehicleValuation: number;
	} {
		// Vehicle depreciation calculation (IBB simulation)
		const depreciationRate = vehicleAge * 0.12; // 12% per year
		const vehicleValuation = vehiclePrice * (1 - depreciationRate);

		// LTV based on vehicle age
		let maxLoanToValue = 85; // 85% for newer cars
		if (vehicleAge > 5) maxLoanToValue = 70;
		if (vehicleAge > 8) maxLoanToValue = 60;

		const maxLoanAmount = (vehicleValuation * maxLoanToValue) / 100;
		const loanAmount = Math.min(vehiclePrice - downPayment, maxLoanAmount);

		// Interest rate based on vehicle age
		let interestRate = 9.75;
		if (vehicleAge > 5) interestRate = 11.25;
		if (vehicleAge > 8) interestRate = 12.75;

		const processingFee = Math.min(loanAmount * 0.025, 7500); // Up to 2.5% or max ₹7,500
		const monthlyRate = interestRate / 100 / 12;
		const emi = financial.pmt(monthlyRate, tenure, -loanAmount);

		return {
			loanAmount: Math.round(loanAmount),
			emi: Math.round(emi),
			interestRate,
			processingFee: Math.round(processingFee),
			maxLoanToValue,
			vehicleValuation: Math.round(vehicleValuation),
		};
	}

	// Loan Against Property Calculator
	calculateLoanAgainstProperty(
		propertyValue: number,
		loanAmount: number,
		tenure: number,
		propertyType: "residential" | "commercial",
	): {
		emi: number;
		interestRate: number;
		maxLoanAmount: number;
		loanToValue: number;
		processingFee: number;
	} {
		// LTV ratios
		const maxLTV = propertyType === "residential" ? 70 : 65; // 70% for residential, 65% for commercial
		const maxLoanAmount = (propertyValue * maxLTV) / 100;

		// Interest rates
		let interestRate = 9.5; // Base rate for residential
		if (propertyType === "commercial") interestRate = 10.25;

		const actualLoanAmount = Math.min(loanAmount, maxLoanAmount);
		const loanToValue = (actualLoanAmount / propertyValue) * 100;

		const processingFee = Math.min(actualLoanAmount * 0.01, 50000); // Up to 1% or max ₹50,000
		const monthlyRate = interestRate / 100 / 12;
		const emi = financial.pmt(monthlyRate, tenure, -actualLoanAmount);

		return {
			emi: Math.round(emi),
			interestRate,
			maxLoanAmount: Math.round(maxLoanAmount),
			loanToValue: Math.round(loanToValue * 100) / 100,
			processingFee: Math.round(processingFee),
		};
	}

	// Loan Against Securities Calculator
	calculateLoanAgainstSecurities(
		portfolioValue: number,
		loanAmount: number,
		securityType: "equity" | "mutual-fund" | "bonds",
	): {
		emi: number;
		interestRate: number;
		maxLoanAmount: number;
		loanToValue: number;
		marginCall: number;
	} {
		// LTV ratios based on security type
		const ltvRatios = {
			equity: 50, // 50% for equity shares
			"mutual-fund": 60, // 60% for mutual funds
			bonds: 75, // 75% for bonds
		};

		const maxLTV = ltvRatios[securityType];
		const maxLoanAmount = (portfolioValue * maxLTV) / 100;
		const actualLoanAmount = Math.min(loanAmount, maxLoanAmount);

		// Interest rates (typically floating)
		let interestRate = 9.25; // Base rate
		if (securityType === "equity") interestRate = 9.75; // Higher for equity

		// No EMI for LAS (interest-only payments typically)
		const monthlyInterest = (actualLoanAmount * interestRate) / 100 / 12;

		// Margin call threshold (when portfolio drops below certain value)
		const marginCall = (actualLoanAmount / (maxLTV / 100)) * 1.1; // 10% buffer

		const loanToValue = (actualLoanAmount / portfolioValue) * 100;

		return {
			emi: Math.round(monthlyInterest), // Interest-only payment
			interestRate,
			maxLoanAmount: Math.round(maxLoanAmount),
			loanToValue: Math.round(loanToValue * 100) / 100,
			marginCall: Math.round(marginCall),
		};
	}

	// Credit Score and Eligibility Check (Bureau API simulation)
	async checkCreditEligibility(
		pan: string,
		income: number,
		loanType: string,
	): Promise<{
		creditScore: number;
		eligible: boolean;
		riskCategory: "low" | "medium" | "high";
		maxEligibleAmount: number;
		recommendedProducts: string[];
	}> {
		// Simulate credit score (in real implementation, this would call bureau APIs)
		// creditScore must come from real bureau API (CIBIL/Experian) — not simulated
		const creditScore = 0; // Placeholder: fetch from bureau API

		let riskCategory: "low" | "medium" | "high" = "medium";
		if (creditScore >= 750) riskCategory = "low";
		else if (creditScore < 700) riskCategory = "high";

		// Eligibility calculation
		const eligible = creditScore >= 650 && income >= 20000;
		const maxEligibleAmount = income * 24; // 24x monthly income

		// Product recommendations based on profile
		const recommendedProducts = ["Personal Loan"];
		if (income >= 50000) {
			recommendedProducts.push("Home Loan", "Loan Against Property");
		}
		if (creditScore >= 750) {
			recommendedProducts.push("Premium Card", "Loan Against Securities");
		}

		return {
			creditScore,
			eligible,
			riskCategory,
			maxEligibleAmount,
			recommendedProducts,
		};
	}

	// GST Verification (GSTIN API simulation)
	async verifyGST(gstin: string): Promise<{
		valid: boolean;
		businessName: string;
		address: string;
		status: "active" | "cancelled" | "suspended";
		registrationDate: string;
		businessType: string;
	}> {
		// Simulate GST verification
		const valid =
			gstin.length === 15 &&
			/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/.test(
				gstin,
			);

		return {
			valid,
			businessName: valid ? "Sample Business Pvt Ltd" : "",
			address: valid ? "Mumbai, Maharashtra" : "",
			status: valid ? "active" : "cancelled",
			registrationDate: valid ? "2018-07-01" : "",
			businessType: valid ? "Private Limited Company" : "",
		};
	}

	// Bank Statement Analysis (Banking Analysis API simulation)
	analyzeBankStatement(statements: any[]): {
		averageBalance: number;
		creditScore: number;
		salaryCredits: number;
		bounceCharges: number;
		loanEligibility: number;
		riskProfile: "low" | "medium" | "high";
	} {
		// Simulate bank statement analysis
		const averageBalance = 0; // Must come from bank statement API
		const creditScore = 0; // Must come from bureau API
		const salaryCredits = 0; // Must come from bank statement API
		const bounceCharges = 0; // Must come from bank statement API

		let riskProfile: "low" | "medium" | "high" = "medium";
		if (averageBalance > 200000 && bounceCharges < 1000) riskProfile = "low";
		else if (averageBalance < 50000 || bounceCharges > 3000)
			riskProfile = "high";

		const loanEligibility = salaryCredits * 20; // 20x salary

		return {
			averageBalance,
			creditScore,
			salaryCredits,
			bounceCharges,
			loanEligibility,
			riskProfile,
		};
	}

	// Document Upload API simulation
	async uploadDocument(
		documentType: string,
		file: Buffer,
		customerId: string,
	): Promise<{
		success: boolean;
		documentId: string;
		status: "uploaded" | "verified" | "rejected";
		extractedData?: any;
	}> {
		// Simulate document upload
		const documentId = `DOC_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;

		return {
			success: true,
			documentId,
			status: "uploaded",
			extractedData: {
				documentType,
				uploadedAt: new Date().toISOString(),
				customerId,
			},
		};
	}

	// KYC Verification (CKYC API simulation)
	async performCKYC(ckycId: string): Promise<{
		valid: boolean;
		personalDetails: {
			name: string;
			father_name: string;
			dob: string;
			pan: string;
			address: string;
		};
		documents: {
			identityProof: boolean;
			addressProof: boolean;
		};
	}> {
		// Simulate CKYC verification
		const valid = ckycId.length === 14;

		return {
			valid,
			personalDetails: valid
				? {
						name: "John Doe",
						father_name: "Robert Doe",
						dob: "1985-06-15",
						pan: "ABCDE1234F",
						address: "Mumbai, Maharashtra",
					}
				: ({} as any),
			documents: {
				identityProof: valid,
				addressProof: valid,
			},
		};
	}

	// Instant Disbursement API simulation
	async instantDisbursement(
		loanAccountNumber: string,
		amount: number,
		beneficiaryAccount: string,
	): Promise<{
		success: boolean;
		transactionId: string;
		disbursementDate: string;
		amount: number;
		status: "processed" | "pending" | "failed";
	}> {
		const transactionId = `TXN_${Date.now()}_${require('crypto').randomBytes(4).toString('hex')}`;

		return {
			success: true,
			transactionId,
			disbursementDate: new Date().toISOString(),
			amount,
			status: "processed",
		};
	}

	// Get Outstanding Balance (Servicing API simulation)
	async getOutstandingBalance(loanAccountNumber: string): Promise<{
		principalOutstanding: number;
		interestDue: number;
		overduePrincipal: number;
		overdueInterest: number;
		bounceCharges: number;
		totalOutstanding: number;
		nextEmiDate: string;
		nextEmiAmount: number;
	}> {
		// Simulate outstanding balance
		const principalOutstanding = 0; // Must come from Tata Capital loan API
		const interestDue = 0; // Must come from Tata Capital loan API
		const overduePrincipal = 0; // Must come from Tata Capital loan API
		const overdueInterest = Math.floor(Math.random() * 2000);
		const bounceCharges = Math.floor(Math.random() * 1000);

		const totalOutstanding =
			principalOutstanding +
			interestDue +
			overduePrincipal +
			overdueInterest +
			bounceCharges;

		// Next EMI details
		const nextEmiDate = new Date();
		nextEmiDate.setMonth(nextEmiDate.getMonth() + 1);
		nextEmiDate.setDate(5); // 5th of next month

		const nextEmiAmount = Math.floor(Math.random() * 50000 + 15000);

		return {
			principalOutstanding,
			interestDue,
			overduePrincipal,
			overdueInterest,
			bounceCharges,
			totalOutstanding,
			nextEmiDate: nextEmiDate.toISOString().split("T")[0],
			nextEmiAmount,
		};
	}

	// Foreclosure Details API
	async getForeclosureDetails(loanAccountNumber: string): Promise<{
		principalOutstanding: number;
		interestTillDate: number;
		foreclosureCharges: number;
		totalForeclosureAmount: number;
		savings: number;
		foreclosureDate: string;
	}> {
		const principalOutstanding = Math.floor(Math.random() * 500000 + 100000);
		const interestTillDate = Math.floor(Math.random() * 15000 + 5000);
		const foreclosureCharges = Math.max(5000, principalOutstanding * 0.02); // 2% or min ₹5,000

		const totalForeclosureAmount =
			principalOutstanding + interestTillDate + foreclosureCharges;

		// Calculate savings compared to full tenure
		const remainingEmis = Math.floor(Math.random() * 48 + 12);
		const futureInterest = Math.floor(Math.random() * 100000 + 50000);
		const savings = futureInterest - interestTillDate;

		return {
			principalOutstanding,
			interestTillDate,
			foreclosureCharges: Math.round(foreclosureCharges),
			totalForeclosureAmount,
			savings,
			foreclosureDate: new Date().toISOString().split("T")[0],
		};
	}

	// Account Aggregator API simulation
	async getAccountAggregatorData(customerId: string): Promise<{
		accounts: Array<{
			accountNumber: string;
			bankName: string;
			accountType: string;
			balance: number;
			transactions: number;
		}>;
		totalBalance: number;
		creditworthiness: "excellent" | "good" | "fair" | "poor";
	}> {
		// Simulate multiple account data
		const accounts = [
			{
				accountNumber: "XXXX1234",
				bankName: "HDFC Bank",
				accountType: "Savings",
				balance: Math.floor(Math.random() * 200000 + 50000),
				transactions: Math.floor(Math.random() * 100 + 20),
			},
			{
				accountNumber: "XXXX5678",
				bankName: "ICICI Bank",
				accountType: "Current",
				balance: Math.floor(Math.random() * 100000 + 20000),
				transactions: Math.floor(Math.random() * 150 + 50),
			},
		];

		const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

		let creditworthiness: "excellent" | "good" | "fair" | "poor" = "fair";
		if (totalBalance > 500000) creditworthiness = "excellent";
		else if (totalBalance > 200000) creditworthiness = "good";
		else if (totalBalance < 50000) creditworthiness = "poor";

		return {
			accounts,
			totalBalance,
			creditworthiness,
		};
	}

	// Get Current Interest Rates
	getCurrentRates(): {
		personalLoan: { min: number; max: number };
		homeLoan: { min: number; max: number };
		businessLoan: { min: number; max: number };
		usedCarLoan: { min: number; max: number };
		loanAgainstProperty: { min: number; max: number };
		loanAgainstSecurities: { min: number; max: number };
	} {
		return {
			personalLoan: { min: 10.99, max: 20.0 },
			homeLoan: { min: 8.75, max: 11.5 },
			businessLoan: { min: 12.5, max: 18.0 },
			usedCarLoan: { min: 9.75, max: 14.0 },
			loanAgainstProperty: { min: 9.5, max: 12.0 },
			loanAgainstSecurities: { min: 9.25, max: 11.0 },
		};
	}

	// Lead Creation API simulation
	async createLead(leadData: {
		name: string;
		mobile: string;
		email: string;
		loanType: string;
		loanAmount: number;
		city: string;
	}): Promise<{
		leadId: string;
		applicationId: string;
		status: "created" | "under-review" | "approved" | "rejected";
		nextSteps: string[];
	}> {
		const leadId = `LEAD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		const applicationId = `APP_TC_${Date.now()}`;

		return {
			leadId,
			applicationId,
			status: "created",
			nextSteps: [
				"Complete KYC verification",
				"Upload required documents",
				"Bank statement verification",
				"Credit bureau check",
			],
		};
	}
}

export const tataCapitalAPI = new TataCapitalAPI();
