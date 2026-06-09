import {
	CanonicalLoanPayload,
	BankTransformedPayload,
	ICICIPayload,
	HDFCPayloadRow,
	AxisPayload,
	KotakPayload,
	mapLoanProductToCode,
	mapEmploymentType,
} from "./canonical-payload";

export interface PayloadTransformer {
	bankCode: string;
	transform(canonical: CanonicalLoanPayload): BankTransformedPayload;
}

export class ICICITransformer implements PayloadTransformer {
	bankCode = "ICICI";

	transform(canonical: CanonicalLoanPayload): BankTransformedPayload {
		const productCodes = mapLoanProductToCode(canonical.loan.product);
		const employmentMapping = mapEmploymentType(
			canonical.applicant.employment_type,
		);

		const payload: ICICIPayload = {
			applicationId: canonical.application_id,
			applicantName: canonical.applicant.full_name,
			panNumber: canonical.applicant.pan,
			loanAmount: canonical.loan.amount,
			tenure: canonical.loan.tenure_months,
			netMonthlyIncome: canonical.income.monthly_income,
			creditScore: canonical.bureau?.score || 0,
			source: "DSA_FINTEKPRO",
			mobileNumber: this.formatPhone(canonical.applicant.mobile),
			emailId: canonical.applicant.email,
			employmentType: employmentMapping.icici,
			employerName: canonical.income.employer_name,
			dateOfBirth: canonical.applicant.dob,
			existingEmi: canonical.existing_obligations?.total_emi,
		};

		return {
			bankCode: this.bankCode,
			format: "json",
			payload,
			headers: {
				"Content-Type": "application/json",
				"X-DSA-Code": "FINTEKPRO_DSA",
			},
		};
	}

	private formatPhone(phone: string): string {
		return phone.replace(/^\+91/, "").replace(/\D/g, "");
	}
}

export class HDFCTransformer implements PayloadTransformer {
	bankCode = "HDFC";

	transform(canonical: CanonicalLoanPayload): BankTransformedPayload {
		const productCodes = mapLoanProductToCode(canonical.loan.product);

		const row: HDFCPayloadRow = {
			Applicant_Name: canonical.applicant.full_name,
			PAN: canonical.applicant.pan,
			Loan_Amount: canonical.loan.amount,
			Tenure: canonical.loan.tenure_months,
			Net_Income: canonical.income.monthly_income,
			Employer: canonical.income.employer_name || "",
			Mobile: this.formatPhone(canonical.applicant.mobile),
			Email: canonical.applicant.email,
			DOB: this.formatDate(canonical.applicant.dob),
			Credit_Score: canonical.bureau?.score || 0,
			Product_Type: productCodes.hdfc,
			Reference_ID: canonical.application_id,
		};

		const csvRow = this.toCSVRow(row);

		return {
			bankCode: this.bankCode,
			format: "csv",
			payload: {
				headers: Object.keys(row),
				rows: [csvRow],
				rawCSV: this.toCSVString(row),
			},
		};
	}

	private formatPhone(phone: string): string {
		return phone.replace(/^\+91/, "").replace(/\D/g, "");
	}

	private formatDate(date: string): string {
		if (!date) return "";
		const d = new Date(date);
		return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
	}

	private toCSVRow(row: HDFCPayloadRow): string[] {
		return Object.values(row).map((v) => String(v));
	}

	private toCSVString(row: HDFCPayloadRow): string {
		const values = Object.values(row).map((v) => {
			const str = String(v);
			return str.includes(",") ? `"${str}"` : str;
		});
		return values.join(",");
	}
}

export class AxisTransformer implements PayloadTransformer {
	bankCode = "AXIS";

	transform(canonical: CanonicalLoanPayload): BankTransformedPayload {
		const productCodes = mapLoanProductToCode(canonical.loan.product);
		const employmentMapping = mapEmploymentType(
			canonical.applicant.employment_type,
		);

		const payload: AxisPayload = {
			loanApplication: {
				referenceId: canonical.application_id,
				loanAmount: canonical.loan.amount,
				tenureMonths: canonical.loan.tenure_months,
				productCode: productCodes.axis,
				purpose: canonical.loan.purpose,
			},
			customer: {
				name: canonical.applicant.full_name,
				pan: canonical.applicant.pan,
				creditScore: canonical.bureau?.score || 0,
				mobile: this.formatPhone(canonical.applicant.mobile),
				email: canonical.applicant.email,
				dob: canonical.applicant.dob,
				gender: canonical.applicant.gender,
			},
			employment: {
				type: employmentMapping.axis,
				monthlyIncome: canonical.income.monthly_income,
				companyName: canonical.income.employer_name,
				designation: canonical.income.designation,
			},
			dsaCode: "AXIS_DSA_FINTEKPRO",
		};

		return {
			bankCode: this.bankCode,
			format: "json",
			payload,
			headers: {
				"Content-Type": "application/json",
				"X-Partner-Code": "FINTEKPRO",
			},
		};
	}

	private formatPhone(phone: string): string {
		return phone.replace(/^\+91/, "").replace(/\D/g, "");
	}
}

export class KotakTransformer implements PayloadTransformer {
	bankCode = "KOTAK";

	transform(canonical: CanonicalLoanPayload): BankTransformedPayload {
		const productCodes = mapLoanProductToCode(canonical.loan.product);
		const employmentMapping = mapEmploymentType(
			canonical.applicant.employment_type,
		);

		const payload: KotakPayload = {
			ApplicationID: canonical.application_id,
			ApplicantName: canonical.applicant.full_name,
			PAN: canonical.applicant.pan,
			LoanAmount: canonical.loan.amount,
			Tenure: canonical.loan.tenure_months,
			MonthlyIncome: canonical.income.monthly_income,
			CreditScore: canonical.bureau?.score || 0,
			MobileNumber: this.formatPhone(canonical.applicant.mobile),
			EmailID: canonical.applicant.email,
			DateOfBirth: canonical.applicant.dob || "",
			EmploymentType: employmentMapping.kotak,
			EmployerName: canonical.income.employer_name || "",
			ProductType: productCodes.kotak,
		};

		const xml = this.toXML(payload);

		return {
			bankCode: this.bankCode,
			format: "xml",
			payload: {
				object: payload,
				xml,
			},
			headers: {
				"Content-Type": "application/xml",
			},
		};
	}

	private formatPhone(phone: string): string {
		return phone.replace(/^\+91/, "").replace(/\D/g, "");
	}

	private toXML(payload: KotakPayload): string {
		const escapeXml = (str: string) =>
			str
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;")
				.replace(/'/g, "&apos;");

		return `<?xml version="1.0" encoding="UTF-8"?>
<LoanApplication>
  <ApplicationID>${escapeXml(payload.ApplicationID)}</ApplicationID>
  <ApplicantName>${escapeXml(payload.ApplicantName)}</ApplicantName>
  <PAN>${escapeXml(payload.PAN)}</PAN>
  <LoanAmount>${payload.LoanAmount}</LoanAmount>
  <Tenure>${payload.Tenure}</Tenure>
  <MonthlyIncome>${payload.MonthlyIncome}</MonthlyIncome>
  <CreditScore>${payload.CreditScore}</CreditScore>
  <MobileNumber>${escapeXml(payload.MobileNumber)}</MobileNumber>
  <EmailID>${escapeXml(payload.EmailID)}</EmailID>
  <DateOfBirth>${escapeXml(payload.DateOfBirth)}</DateOfBirth>
  <EmploymentType>${escapeXml(payload.EmploymentType)}</EmploymentType>
  <EmployerName>${escapeXml(payload.EmployerName)}</EmployerName>
  <ProductType>${escapeXml(payload.ProductType)}</ProductType>
  <PartnerCode>FINTEKPRO</PartnerCode>
</LoanApplication>`;
	}
}

export class PayloadTransformerFactory {
	private transformers: Map<string, PayloadTransformer> = new Map();

	constructor() {
		this.registerTransformer(new ICICITransformer());
		this.registerTransformer(new HDFCTransformer());
		this.registerTransformer(new AxisTransformer());
		this.registerTransformer(new KotakTransformer());
	}

	registerTransformer(transformer: PayloadTransformer): void {
		this.transformers.set(transformer.bankCode.toUpperCase(), transformer);
	}

	getTransformer(bankCode: string): PayloadTransformer | undefined {
		return this.transformers.get(bankCode.toUpperCase());
	}

	transform(
		bankCode: string,
		canonical: CanonicalLoanPayload,
	): BankTransformedPayload | null {
		const transformer = this.getTransformer(bankCode);
		if (!transformer) {
			console.error(
				`[PayloadTransformer] No transformer found for bank: ${bankCode}`,
			);
			return null;
		}
		return transformer.transform(canonical);
	}

	getSupportedBanks(): string[] {
		return Array.from(this.transformers.keys());
	}
}

export const payloadTransformerFactory = new PayloadTransformerFactory();
