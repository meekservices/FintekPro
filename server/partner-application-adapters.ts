import type {
	PartnerApplication,
	InsertPartnerApplication,
} from "@shared/schema";

// Unified application data structure for frontend
export interface UnifiedApplicationData {
	// Personal Information
	firstName: string;
	lastName: string;
	panNumber: string;
	aadharNumber?: string;
	dateOfBirth: string;
	gender: string;
	maritalStatus: string;
	email: string;
	mobile: string;

	// Address Information
	currentAddress: string;
	currentCity: string;
	currentState: string;
	currentPincode: string;
	addressType: "owned" | "rented" | "family";

	// Employment Information
	employmentType: "salaried" | "self_employed" | "business" | "professional";
	employerName?: string;
	designation?: string;
	workExperience: number; // years
	monthlyIncome: number;

	// Banking Information
	bankName: string;
	accountNumber?: string;
	accountType?: "savings" | "current";

	// Loan Information
	loanAmount: number;
	tenure: number; // months
	loanPurpose: string;

	// KYC Documents
	documents: {
		panCard?: File;
		aadharCard?: File;
		salarySlips?: File[];
		bankStatements?: File[];
		employmentLetter?: File;
	};
}

// Provider-specific API request formats
export interface ProviderApiRequest {
	lender: string;
	endpoint: string;
	method: "POST" | "PUT" | "PATCH";
	headers: Record<string, string>;
	body: any;
}

// Base provider adapter interface
export interface IProviderAdapter {
	lenderName: string;
	transformToProvider(data: UnifiedApplicationData): ProviderApiRequest;
	transformFromProvider(providerResponse: any): Partial<PartnerApplication>;
	getRequiredFields(): string[];
	validateData(data: UnifiedApplicationData): {
		isValid: boolean;
		errors: string[];
	};
	getFieldMappings(): Record<string, string>;
}

// Bajaj Finance adapter
export class BajajFinanceAdapter implements IProviderAdapter {
	lenderName = "bajaj_finance";

	transformToProvider(data: UnifiedApplicationData): ProviderApiRequest {
		return {
			lender: "bajaj_finance",
			endpoint: "/api/bajaj-finance/personal-loan/apply",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Source": "fintek_pro",
			},
			body: {
				// Bajaj Finance specific format
				applicant: {
					firstName: data.firstName,
					lastName: data.lastName,
					pan: data.panNumber,
					aadhaar: data.aadharNumber,
					dob: data.dateOfBirth,
					gender: data.gender.toUpperCase(),
					marital_status: data.maritalStatus,
					email: data.email,
					mobile: data.mobile,
				},
				address: {
					current_address: data.currentAddress,
					city: data.currentCity,
					state: data.currentState,
					pincode: data.currentPincode,
					residence_type: data.addressType,
				},
				employment: {
					type: data.employmentType,
					company_name: data.employerName,
					designation: data.designation,
					experience_years: data.workExperience,
					monthly_income: data.monthlyIncome,
				},
				banking: {
					bank_name: data.bankName,
					account_number: data.accountNumber,
					account_type: data.accountType,
				},
				loan: {
					amount: data.loanAmount,
					tenure_months: data.tenure,
					purpose: data.loanPurpose,
				},
			},
		};
	}

	transformFromProvider(providerResponse: any): Partial<PartnerApplication> {
		return {
			providerApplicationId:
				providerResponse.application_id || providerResponse.reference_id,
			status: this.mapProviderStatus(providerResponse.status),
			providerMeta: providerResponse as any,
			statusUpdates: providerResponse.status_history || [],
		};
	}

	getRequiredFields(): string[] {
		return [
			"firstName",
			"lastName",
			"panNumber",
			"dateOfBirth",
			"gender",
			"email",
			"mobile",
			"currentAddress",
			"currentCity",
			"currentState",
			"currentPincode",
			"employmentType",
			"monthlyIncome",
			"loanAmount",
			"tenure",
		];
	}

	validateData(data: UnifiedApplicationData): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];
		const required = this.getRequiredFields();

		for (const field of required) {
			if (!data[field as keyof UnifiedApplicationData]) {
				errors.push(`${field} is required for Bajaj Finance applications`);
			}
		}

		// Bajaj-specific validations
		if (data.loanAmount < 25000 || data.loanAmount > 3000000) {
			errors.push(
				"Loan amount must be between ₹25,000 and ₹30,00,000 for Bajaj Finance",
			);
		}

		if (data.tenure < 12 || data.tenure > 84) {
			errors.push(
				"Loan tenure must be between 12 and 84 months for Bajaj Finance",
			);
		}

		return { isValid: errors.length === 0, errors };
	}

	getFieldMappings(): Record<string, string> {
		return {
			firstName: "applicant.firstName",
			lastName: "applicant.lastName",
			panNumber: "applicant.pan",
			aadharNumber: "applicant.aadhaar",
			dateOfBirth: "applicant.dob",
			gender: "applicant.gender",
			maritalStatus: "applicant.marital_status",
			email: "applicant.email",
			mobile: "applicant.mobile",
			currentAddress: "address.current_address",
			currentCity: "address.city",
			currentState: "address.state",
			currentPincode: "address.pincode",
			addressType: "address.residence_type",
			employmentType: "employment.type",
			employerName: "employment.company_name",
			designation: "employment.designation",
			workExperience: "employment.experience_years",
			monthlyIncome: "employment.monthly_income",
			bankName: "banking.bank_name",
			accountNumber: "banking.account_number",
			accountType: "banking.account_type",
			loanAmount: "loan.amount",
			tenure: "loan.tenure_months",
			loanPurpose: "loan.purpose",
		};
	}

	private mapProviderStatus(providerStatus: string): string {
		const statusMap: Record<string, string> = {
			submitted: "submitted",
			under_review: "under_review",
			documents_required: "pending_documents",
			approved: "approved",
			rejected: "rejected",
			disbursed: "disbursed",
		};
		return statusMap[providerStatus] || "submitted";
	}
}

// Tata Capital adapter
export class TataCapitalAdapter implements IProviderAdapter {
	lenderName = "tata_capital";

	transformToProvider(data: UnifiedApplicationData): ProviderApiRequest {
		return {
			lender: "tata_capital",
			endpoint: "/api/tata-capital/personal-loan/apply",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Partner-ID": "fintek_pro",
			},
			body: {
				// Tata Capital specific format
				customerDetails: {
					first_name: data.firstName,
					last_name: data.lastName,
					pan_number: data.panNumber,
					aadhaar_number: data.aadharNumber,
					date_of_birth: data.dateOfBirth,
					gender: data.gender,
					marital_status: data.maritalStatus,
					email_id: data.email,
					mobile_number: data.mobile,
				},
				addressDetails: {
					address_line_1: data.currentAddress,
					city: data.currentCity,
					state: data.currentState,
					pin_code: data.currentPincode,
					residence_type: data.addressType,
				},
				employmentDetails: {
					employment_type: data.employmentType,
					employer_name: data.employerName,
					job_title: data.designation,
					work_experience_years: data.workExperience,
					gross_monthly_income: data.monthlyIncome,
				},
				bankingDetails: {
					bank_name: data.bankName,
					account_no: data.accountNumber,
					account_type: data.accountType,
				},
				loanDetails: {
					loan_amount_requested: data.loanAmount,
					repayment_tenure_months: data.tenure,
					loan_purpose: data.loanPurpose,
				},
			},
		};
	}

	transformFromProvider(providerResponse: any): Partial<PartnerApplication> {
		return {
			providerApplicationId:
				providerResponse.applicationId || providerResponse.referenceNumber,
			status: this.mapProviderStatus(providerResponse.applicationStatus),
			providerMeta: providerResponse as any,
			statusUpdates: providerResponse.statusHistory || [],
		};
	}

	getRequiredFields(): string[] {
		return [
			"firstName",
			"lastName",
			"panNumber",
			"dateOfBirth",
			"gender",
			"email",
			"mobile",
			"currentAddress",
			"currentCity",
			"currentState",
			"currentPincode",
			"employmentType",
			"monthlyIncome",
			"loanAmount",
			"tenure",
		];
	}

	validateData(data: UnifiedApplicationData): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];
		const required = this.getRequiredFields();

		for (const field of required) {
			if (!data[field as keyof UnifiedApplicationData]) {
				errors.push(`${field} is required for Tata Capital applications`);
			}
		}

		// Tata Capital specific validations
		if (data.loanAmount < 75000 || data.loanAmount > 2500000) {
			errors.push(
				"Loan amount must be between ₹75,000 and ₹25,00,000 for Tata Capital",
			);
		}

		if (data.tenure < 12 || data.tenure > 72) {
			errors.push(
				"Loan tenure must be between 12 and 72 months for Tata Capital",
			);
		}

		return { isValid: errors.length === 0, errors };
	}

	getFieldMappings(): Record<string, string> {
		return {
			firstName: "customerDetails.first_name",
			lastName: "customerDetails.last_name",
			panNumber: "customerDetails.pan_number",
			aadharNumber: "customerDetails.aadhaar_number",
			dateOfBirth: "customerDetails.date_of_birth",
			gender: "customerDetails.gender",
			maritalStatus: "customerDetails.marital_status",
			email: "customerDetails.email_id",
			mobile: "customerDetails.mobile_number",
			currentAddress: "addressDetails.address_line_1",
			currentCity: "addressDetails.city",
			currentState: "addressDetails.state",
			currentPincode: "addressDetails.pin_code",
			addressType: "addressDetails.residence_type",
			employmentType: "employmentDetails.employment_type",
			employerName: "employmentDetails.employer_name",
			designation: "employmentDetails.job_title",
			workExperience: "employmentDetails.work_experience_years",
			monthlyIncome: "employmentDetails.gross_monthly_income",
			bankName: "bankingDetails.bank_name",
			accountNumber: "bankingDetails.account_no",
			accountType: "bankingDetails.account_type",
			loanAmount: "loanDetails.loan_amount_requested",
			tenure: "loanDetails.repayment_tenure_months",
			loanPurpose: "loanDetails.loan_purpose",
		};
	}

	private mapProviderStatus(providerStatus: string): string {
		const statusMap: Record<string, string> = {
			SUBMITTED: "submitted",
			IN_PROGRESS: "under_review",
			DOCS_PENDING: "pending_documents",
			APPROVED: "approved",
			DECLINED: "rejected",
			DISBURSED: "disbursed",
		};
		return statusMap[providerStatus] || "submitted";
	}
}

// HDFC Bank adapter
export class HdfcBankAdapter implements IProviderAdapter {
	lenderName = "hdfc_bank";

	transformToProvider(data: UnifiedApplicationData): ProviderApiRequest {
		return {
			lender: "hdfc_bank",
			endpoint: "/api/hdfc-bank/personal-loan/apply",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Channel": "partner",
			},
			body: {
				// HDFC Bank specific format
				personalInfo: {
					firstName: data.firstName,
					lastName: data.lastName,
					panNumber: data.panNumber,
					aadharNumber: data.aadharNumber,
					dateOfBirth: data.dateOfBirth,
					gender: data.gender,
					maritalStatus: data.maritalStatus,
					emailAddress: data.email,
					mobileNumber: data.mobile,
				},
				addressInfo: {
					residentialAddress: data.currentAddress,
					city: data.currentCity,
					state: data.currentState,
					zipCode: data.currentPincode,
					residenceType: data.addressType,
				},
				employmentInfo: {
					employmentCategory: data.employmentType,
					companyName: data.employerName,
					jobDesignation: data.designation,
					totalExperience: data.workExperience,
					netMonthlyIncome: data.monthlyIncome,
				},
				bankingInfo: {
					primaryBankName: data.bankName,
					accountNumber: data.accountNumber,
					accountType: data.accountType,
				},
				loanInfo: {
					requestedAmount: data.loanAmount,
					tenureInMonths: data.tenure,
					purposeOfLoan: data.loanPurpose,
				},
			},
		};
	}

	transformFromProvider(providerResponse: any): Partial<PartnerApplication> {
		return {
			providerApplicationId:
				providerResponse.applicationNumber || providerResponse.trackingId,
			status: this.mapProviderStatus(providerResponse.currentStatus),
			providerMeta: providerResponse as any,
			statusUpdates: providerResponse.auditTrail || [],
		};
	}

	getRequiredFields(): string[] {
		return [
			"firstName",
			"lastName",
			"panNumber",
			"dateOfBirth",
			"gender",
			"email",
			"mobile",
			"currentAddress",
			"currentCity",
			"currentState",
			"currentPincode",
			"employmentType",
			"monthlyIncome",
			"loanAmount",
			"tenure",
		];
	}

	validateData(data: UnifiedApplicationData): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];
		const required = this.getRequiredFields();

		for (const field of required) {
			if (!data[field as keyof UnifiedApplicationData]) {
				errors.push(`${field} is required for HDFC Bank applications`);
			}
		}

		// HDFC Bank specific validations
		if (data.loanAmount < 100000 || data.loanAmount > 4000000) {
			errors.push(
				"Loan amount must be between ₹1,00,000 and ₹40,00,000 for HDFC Bank",
			);
		}

		if (data.tenure < 12 || data.tenure > 60) {
			errors.push("Loan tenure must be between 12 and 60 months for HDFC Bank");
		}

		return { isValid: errors.length === 0, errors };
	}

	getFieldMappings(): Record<string, string> {
		return {
			firstName: "personalInfo.firstName",
			lastName: "personalInfo.lastName",
			panNumber: "personalInfo.panNumber",
			aadharNumber: "personalInfo.aadharNumber",
			dateOfBirth: "personalInfo.dateOfBirth",
			gender: "personalInfo.gender",
			maritalStatus: "personalInfo.maritalStatus",
			email: "personalInfo.emailAddress",
			mobile: "personalInfo.mobileNumber",
			currentAddress: "addressInfo.residentialAddress",
			currentCity: "addressInfo.city",
			currentState: "addressInfo.state",
			currentPincode: "addressInfo.zipCode",
			addressType: "addressInfo.residenceType",
			employmentType: "employmentInfo.employmentCategory",
			employerName: "employmentInfo.companyName",
			designation: "employmentInfo.jobDesignation",
			workExperience: "employmentInfo.totalExperience",
			monthlyIncome: "employmentInfo.netMonthlyIncome",
			bankName: "bankingInfo.primaryBankName",
			accountNumber: "bankingInfo.accountNumber",
			accountType: "bankingInfo.accountType",
			loanAmount: "loanInfo.requestedAmount",
			tenure: "loanInfo.tenureInMonths",
			loanPurpose: "loanInfo.purposeOfLoan",
		};
	}

	private mapProviderStatus(providerStatus: string): string {
		const statusMap: Record<string, string> = {
			SUBMITTED: "submitted",
			UNDER_REVIEW: "under_review",
			DOCUMENT_COLLECTION: "pending_documents",
			APPROVED: "approved",
			REJECTED: "rejected",
			DISBURSED: "disbursed",
		};
		return statusMap[providerStatus] || "submitted";
	}
}

// ICICI Bank adapter
export class IcicieBankAdapter implements IProviderAdapter {
	lenderName = "icici_bank";

	transformToProvider(data: UnifiedApplicationData): ProviderApiRequest {
		return {
			lender: "icici_bank",
			endpoint: "/api/icici-bank/personal-loan/apply",
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Partner-Code": "FINTEK",
			},
			body: {
				// ICICI Bank specific format
				applicantProfile: {
					name: {
						first: data.firstName,
						last: data.lastName,
					},
					identifiers: {
						pan: data.panNumber,
						aadhaar: data.aadharNumber,
					},
					demographics: {
						birthDate: data.dateOfBirth,
						gender: data.gender.toLowerCase(),
						maritalStatus: data.maritalStatus,
					},
					contact: {
						email: data.email,
						mobile: data.mobile,
					},
				},
				residenceDetails: {
					address: data.currentAddress,
					city: data.currentCity,
					state: data.currentState,
					pincode: data.currentPincode,
					ownershipType: data.addressType,
				},
				professionalProfile: {
					category: data.employmentType,
					organization: data.employerName,
					role: data.designation,
					experienceYears: data.workExperience,
					monthlyEarnings: data.monthlyIncome,
				},
				bankAccount: {
					bankName: data.bankName,
					accountNumber: data.accountNumber,
					accountCategory: data.accountType,
				},
				loanRequirement: {
					principal: data.loanAmount,
					termMonths: data.tenure,
					usage: data.loanPurpose,
				},
			},
		};
	}

	transformFromProvider(providerResponse: any): Partial<PartnerApplication> {
		return {
			providerApplicationId:
				providerResponse.applicationId || providerResponse.referenceId,
			status: this.mapProviderStatus(providerResponse.status),
			providerMeta: providerResponse as any,
			statusUpdates: providerResponse.timeline || [],
		};
	}

	getRequiredFields(): string[] {
		return [
			"firstName",
			"lastName",
			"panNumber",
			"dateOfBirth",
			"gender",
			"email",
			"mobile",
			"currentAddress",
			"currentCity",
			"currentState",
			"currentPincode",
			"employmentType",
			"monthlyIncome",
			"loanAmount",
			"tenure",
		];
	}

	validateData(data: UnifiedApplicationData): {
		isValid: boolean;
		errors: string[];
	} {
		const errors: string[] = [];
		const required = this.getRequiredFields();

		for (const field of required) {
			if (!data[field as keyof UnifiedApplicationData]) {
				errors.push(`${field} is required for ICICI Bank applications`);
			}
		}

		// ICICI Bank specific validations
		if (data.loanAmount < 50000 || data.loanAmount > 5000000) {
			errors.push(
				"Loan amount must be between ₹50,000 and ₹50,00,000 for ICICI Bank",
			);
		}

		if (data.tenure < 12 || data.tenure > 72) {
			errors.push(
				"Loan tenure must be between 12 and 72 months for ICICI Bank",
			);
		}

		return { isValid: errors.length === 0, errors };
	}

	getFieldMappings(): Record<string, string> {
		return {
			firstName: "applicantProfile.name.first",
			lastName: "applicantProfile.name.last",
			panNumber: "applicantProfile.identifiers.pan",
			aadharNumber: "applicantProfile.identifiers.aadhaar",
			dateOfBirth: "applicantProfile.demographics.birthDate",
			gender: "applicantProfile.demographics.gender",
			maritalStatus: "applicantProfile.demographics.maritalStatus",
			email: "applicantProfile.contact.email",
			mobile: "applicantProfile.contact.mobile",
			currentAddress: "residenceDetails.address",
			currentCity: "residenceDetails.city",
			currentState: "residenceDetails.state",
			currentPincode: "residenceDetails.pincode",
			addressType: "residenceDetails.ownershipType",
			employmentType: "professionalProfile.category",
			employerName: "professionalProfile.organization",
			designation: "professionalProfile.role",
			workExperience: "professionalProfile.experienceYears",
			monthlyIncome: "professionalProfile.monthlyEarnings",
			bankName: "bankAccount.bankName",
			accountNumber: "bankAccount.accountNumber",
			accountType: "bankAccount.accountCategory",
			loanAmount: "loanRequirement.principal",
			tenure: "loanRequirement.termMonths",
			loanPurpose: "loanRequirement.usage",
		};
	}

	private mapProviderStatus(providerStatus: string): string {
		const statusMap: Record<string, string> = {
			received: "submitted",
			processing: "under_review",
			doc_required: "pending_documents",
			sanctioned: "approved",
			declined: "rejected",
			disbursed: "disbursed",
		};
		return statusMap[providerStatus] || "submitted";
	}
}

// Provider registry
export class ProviderAdapterRegistry {
	private adapters: Map<string, IProviderAdapter> = new Map();

	constructor() {
		this.registerAdapters();
	}

	private registerAdapters(): void {
		const adapters = [
			new BajajFinanceAdapter(),
			new TataCapitalAdapter(),
			new HdfcBankAdapter(),
			new IcicieBankAdapter(),
		];

		adapters.forEach((adapter) => {
			this.adapters.set(adapter.lenderName, adapter);
		});
	}

	getAdapter(lenderName: string): IProviderAdapter {
		const adapter = this.adapters.get(lenderName);
		if (!adapter) {
			throw new Error(`No adapter found for lender: ${lenderName}`);
		}
		return adapter;
	}

	getAllLenders(): string[] {
		return Array.from(this.adapters.keys());
	}

	validateApplicationData(
		lenderName: string,
		data: UnifiedApplicationData,
	): { isValid: boolean; errors: string[] } {
		const adapter = this.getAdapter(lenderName);
		return adapter.validateData(data);
	}

	transformToProviderFormat(
		lenderName: string,
		data: UnifiedApplicationData,
	): ProviderApiRequest {
		const adapter = this.getAdapter(lenderName);
		return adapter.transformToProvider(data);
	}

	transformFromProviderFormat(
		lenderName: string,
		providerResponse: any,
	): Partial<PartnerApplication> {
		const adapter = this.getAdapter(lenderName);
		return adapter.transformFromProvider(providerResponse);
	}

	getRequiredFields(lenderName: string): string[] {
		const adapter = this.getAdapter(lenderName);
		return adapter.getRequiredFields();
	}

	getFieldMappings(lenderName: string): Record<string, string> {
		const adapter = this.getAdapter(lenderName);
		return adapter.getFieldMappings();
	}
}

// Export singleton instance
export const providerRegistry = new ProviderAdapterRegistry();
