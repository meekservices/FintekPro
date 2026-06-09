export interface CanonicalLoanPayload {
	application_id: string;
	applicant: {
		full_name: string;
		dob: string;
		pan: string;
		mobile: string;
		email: string;
		employment_type: "SALARIED" | "SELF_EMPLOYED" | "BUSINESS";
		gender?: "MALE" | "FEMALE" | "OTHER";
		address?: {
			line1: string;
			line2?: string;
			city: string;
			state: string;
			pincode: string;
		};
	};
	income: {
		monthly_income: number;
		annual_income?: number;
		employer_name?: string;
		designation?: string;
		work_experience_years?: number;
	};
	loan: {
		product: LoanProductType;
		amount: number;
		tenure_months: number;
		purpose?: string;
	};
	bureau?: {
		score: number;
		bureau_name: "CIBIL" | "EXPERIAN" | "EQUIFAX" | "CRIF";
	};
	documents?: {
		aadhaar?: string;
		pan?: string;
		bank_statement?: string;
		salary_slips?: string[];
		itr?: string[];
	};
	consent: {
		timestamp: string;
		ip: string;
		terms_accepted: boolean;
	};
	existing_obligations?: {
		total_emi: number;
		loan_count: number;
	};
	collateral?: {
		type: string;
		value: number;
		description?: string;
	};
}

export type LoanProductType =
	| "PERSONAL_LOAN"
	| "BUSINESS_LOAN"
	| "HOME_LOAN"
	| "LAP"
	| "CAR_LOAN"
	| "EDUCATION_LOAN"
	| "GOLD_LOAN"
	| "LOAN_AGAINST_SECURITIES";

export interface BankTransformedPayload {
	bankCode: string;
	format: "json" | "csv" | "xml";
	payload: any;
	headers?: Record<string, string>;
}

export interface ICICIPayload {
	applicationId: string;
	applicantName: string;
	panNumber: string;
	loanAmount: number;
	tenure: number;
	netMonthlyIncome: number;
	creditScore: number;
	source: string;
	mobileNumber: string;
	emailId: string;
	employmentType: string;
	employerName?: string;
	dateOfBirth?: string;
	existingEmi?: number;
}

export interface HDFCPayloadRow {
	Applicant_Name: string;
	PAN: string;
	Loan_Amount: number;
	Tenure: number;
	Net_Income: number;
	Employer: string;
	Mobile: string;
	Email: string;
	DOB: string;
	Credit_Score: number;
	Product_Type: string;
	Reference_ID: string;
}

export interface AxisPayload {
	loanApplication: {
		referenceId: string;
		loanAmount: number;
		tenureMonths: number;
		productCode: string;
		purpose?: string;
	};
	customer: {
		name: string;
		pan: string;
		creditScore: number;
		mobile: string;
		email: string;
		dob?: string;
		gender?: string;
	};
	employment: {
		type: "SAL" | "SEP" | "BUS";
		monthlyIncome: number;
		companyName?: string;
		designation?: string;
	};
	dsaCode: string;
}

export interface KotakPayload {
	ApplicationID: string;
	ApplicantName: string;
	PAN: string;
	LoanAmount: number;
	Tenure: number;
	MonthlyIncome: number;
	CreditScore: number;
	MobileNumber: string;
	EmailID: string;
	DateOfBirth: string;
	EmploymentType: string;
	EmployerName: string;
	ProductType: string;
}

export function mapLoanProductToCode(product: LoanProductType): {
	icici: string;
	hdfc: string;
	axis: string;
	kotak: string;
} {
	const mapping: Record<
		LoanProductType,
		{ icici: string; hdfc: string; axis: string; kotak: string }
	> = {
		PERSONAL_LOAN: { icici: "PL", hdfc: "PERSONAL", axis: "PL", kotak: "PL" },
		BUSINESS_LOAN: { icici: "BL", hdfc: "BUSINESS", axis: "BL", kotak: "BL" },
		HOME_LOAN: { icici: "HL", hdfc: "HOME", axis: "HL", kotak: "HL" },
		LAP: { icici: "LAP", hdfc: "LAP", axis: "LAP", kotak: "LAP" },
		CAR_LOAN: { icici: "AL", hdfc: "AUTO", axis: "AL", kotak: "AL" },
		EDUCATION_LOAN: { icici: "EL", hdfc: "EDUCATION", axis: "EL", kotak: "EL" },
		GOLD_LOAN: { icici: "GL", hdfc: "GOLD", axis: "GL", kotak: "GL" },
		LOAN_AGAINST_SECURITIES: {
			icici: "LAS",
			hdfc: "LAS",
			axis: "LAS",
			kotak: "LAS",
		},
	};
	return mapping[product];
}

export function mapEmploymentType(type: string): {
	icici: string;
	hdfc: string;
	axis: "SAL" | "SEP" | "BUS";
	kotak: string;
} {
	const mapping: Record<
		string,
		{ icici: string; hdfc: string; axis: "SAL" | "SEP" | "BUS"; kotak: string }
	> = {
		SALARIED: {
			icici: "SALARIED",
			hdfc: "SAL",
			axis: "SAL",
			kotak: "SALARIED",
		},
		SELF_EMPLOYED: {
			icici: "SELF_EMPLOYED",
			hdfc: "SEP",
			axis: "SEP",
			kotak: "SELF_EMPLOYED",
		},
		BUSINESS: {
			icici: "BUSINESS",
			hdfc: "BUS",
			axis: "BUS",
			kotak: "BUSINESS",
		},
	};
	return (
		mapping[type] || {
			icici: "SALARIED",
			hdfc: "SAL",
			axis: "SAL",
			kotak: "SALARIED",
		}
	);
}
