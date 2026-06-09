import { z } from "zod";

// TaxCloud India API Configuration
const TAXCLOUD_BASE_URL =
	process.env.TAXCLOUD_BASE_URL || "https://api.taxcloud.in";
const TAXCLOUD_ENVIRONMENT = process.env.TAXCLOUD_ENVIRONMENT || "sandbox";

// Types for Income Tax Return filing
export const ITRFormDataSchema = z.object({
	// Personal Information
	personalInfo: z.object({
		pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
		firstName: z.string().min(1, "First name is required"),
		lastName: z.string().min(1, "Last name is required"),
		dateOfBirth: z.string(),
		email: z.string().email("Invalid email format"),
		phone: z.string().min(10, "Phone number must be 10 digits"),
		aadhar: z.string().regex(/^[0-9]{12}$/, "Invalid Aadhar number"),
		address: z.object({
			line1: z.string().min(1, "Address is required"),
			line2: z.string().optional(),
			city: z.string().min(1, "City is required"),
			state: z.string().min(1, "State is required"),
			pincode: z.string().regex(/^[0-9]{6}$/, "Invalid pincode"),
		}),
	}),

	// Income Details
	incomeDetails: z.object({
		salaryIncome: z.number().min(0, "Salary income must be non-negative"),
		businessIncome: z.number().min(0, "Business income must be non-negative"),
		capitalGains: z.number().min(0, "Capital gains must be non-negative"),
		otherIncome: z.number().min(0, "Other income must be non-negative"),
		interestIncome: z.number().min(0, "Interest income must be non-negative"),
		rentalIncome: z.number().min(0, "Rental income must be non-negative"),
		dividendIncome: z.number().min(0, "Dividend income must be non-negative"),
	}),

	// Deductions
	deductions: z.object({
		section80C: z.number().min(0, "Section 80C deduction must be non-negative"),
		section80D: z.number().min(0, "Section 80D deduction must be non-negative"),
		section80G: z.number().min(0, "Section 80G deduction must be non-negative"),
		homeLoanInterest: z
			.number()
			.min(0, "Home loan interest must be non-negative"),
		standardDeduction: z
			.number()
			.min(0, "Standard deduction must be non-negative"),
		professionalTax: z.number().min(0, "Professional tax must be non-negative"),
		otherDeductions: z.number().min(0, "Other deductions must be non-negative"),
	}),

	// Tax Payments (TDS, Advance Tax, etc.)
	taxPayments: z.object({
		tdsDeducted: z.number().min(0, "TDS deducted must be non-negative"),
		advanceTaxPaid: z.number().min(0, "Advance tax paid must be non-negative"),
		selfAssessmentTax: z
			.number()
			.min(0, "Self assessment tax must be non-negative"),
	}),

	// Bank Details for Refund
	bankDetails: z.object({
		accountNumber: z.string().min(9, "Invalid account number"),
		ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"),
		bankName: z.string().min(1, "Bank name is required"),
		accountHolderName: z.string().min(1, "Account holder name is required"),
	}),

	// Filing Details
	filingDetails: z.object({
		assessmentYear: z
			.string()
			.regex(/^\d{4}-\d{2}$/, "Invalid assessment year format (YYYY-YY)"),
		itrForm: z.enum([
			"ITR-1",
			"ITR-2",
			"ITR-3",
			"ITR-4",
			"ITR-5",
			"ITR-6",
			"ITR-7",
		]),
		filingStatus: z.enum(["Original", "Revised"]),
		isDefective: z.boolean().default(false),
		acknowledgmentNumber: z.string().optional(),
	}),
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
		status: "Filed" | "Processing" | "Verified" | "Failed";
	};
	errors?: string[];
}

export interface ITRStatusResponse {
	success: boolean;
	data?: {
		acknowledgmentNumber: string;
		status: "Filed" | "Processing" | "Verified" | "Failed" | "Defective";
		filingDate: string;
		verificationDate?: string;
		refundStatus?: "Pending" | "Processed" | "Issued";
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

class TaxCloudITRService {
	private apiKey: string;

	constructor() {
		this.apiKey = process.env.TAXCLOUD_API_KEY || "";

		if (!this.apiKey) {
			console.warn("⚠️ TaxCloud API key not configured.");
		}
	}

	private async makeAPICall(
		endpoint: string,
		data?: any,
		method: "GET" | "POST" | "PUT" = "GET",
	) {
		if (!this.apiKey) {
			throw new Error(
				"TaxCloud API not configured. Set TAXCLOUD_API_KEY for ITR filing services.",
			);
		}

		try {
			const response = await fetch(`${TAXCLOUD_BASE_URL}${endpoint}`, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${this.apiKey}`,
					Accept: "application/json",
				},
				// Future-proof: Omit body for GET requests regardless of data parameter
				body:
					method === "GET"
						? undefined
						: data
							? JSON.stringify(data)
							: undefined,
			});

			if (!response.ok) {
				throw new Error(
					`TaxCloud API error: ${response.status} ${response.statusText}`,
				);
			}

			return await response.json();
		} catch (error) {
			console.error("TaxCloud API call failed:", error);
			throw error;
		}
	}

	/**
	 * Calculate tax liability based on income and deductions
	 */
	async calculateTax(formData: ITRFormData): Promise<ITRCalculationResponse> {
		try {
			// Validate input data
			const validatedData = ITRFormDataSchema.parse(formData);

			const response = await this.makeAPICall(
				"/api/v1/calculate-tax",
				validatedData,
				"POST",
			);
			return response;
		} catch (error) {
			console.error("Tax calculation error:", error);
			return {
				success: false,
				message:
					error instanceof Error ? error.message : "Tax calculation failed",
			};
		}
	}

	/**
	 * File Income Tax Return
	 */
	async fileITR(formData: ITRFormData): Promise<ITRFilingResponse> {
		try {
			// Validate input data
			const validatedData = ITRFormDataSchema.parse(formData);

			const response = await this.makeAPICall(
				"/api/v1/file-itr",
				validatedData,
				"POST",
			);
			return response;
		} catch (error) {
			console.error("ITR filing error:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "ITR filing failed",
				errors: [error instanceof Error ? error.message : "Unknown error"],
			};
		}
	}

	/**
	 * Check ITR filing status
	 */
	async getITRStatus(acknowledgmentNumber: string): Promise<ITRStatusResponse> {
		try {
			if (!acknowledgmentNumber) {
				throw new Error("Acknowledgment number is required");
			}

			// Fix: Remove JSON body from GET request
			const response = await this.makeAPICall(
				`/api/v1/itr-status/${acknowledgmentNumber}`,
				undefined,
				"GET",
			);
			return response;
		} catch (error) {
			console.error("ITR status check error:", error);
			return {
				success: false,
				message: error instanceof Error ? error.message : "Status check failed",
			};
		}
	}

	/**
	 * Download ITR-V form
	 */
	async downloadITRV(acknowledgmentNumber: string): Promise<{
		success: boolean;
		data?: { downloadUrl: string; fileName: string };
		message: string;
	}> {
		try {
			if (!acknowledgmentNumber) {
				throw new Error("Acknowledgment number is required");
			}

			const response = await this.makeAPICall(
				`/api/v1/download-itr-v/${acknowledgmentNumber}`,
				undefined,
				"GET",
			);

			if (response.success) {
				return {
					success: true,
					data: {
						downloadUrl:
							response.data?.downloadUrl ||
							`/mock-itr-v/${acknowledgmentNumber}.pdf`,
						fileName: `ITR-V-${acknowledgmentNumber}.pdf`,
					},
					message: "ITR-V download link generated successfully",
				};
			}

			return response;
		} catch (error) {
			console.error("ITR-V download error:", error);
			return {
				success: false,
				message:
					error instanceof Error ? error.message : "ITR-V download failed",
			};
		}
	}

	/**
	 * Get available ITR forms based on income sources
	 */
	getSuitableITRForm(incomeDetails: ITRFormData["incomeDetails"]): string {
		const { salaryIncome, businessIncome, capitalGains, rentalIncome } =
			incomeDetails;

		// ITR-1 (Sahaj) - For salary income up to 50 lakhs with no business/capital gains
		if (
			salaryIncome <= 5000000 &&
			businessIncome === 0 &&
			capitalGains === 0 &&
			rentalIncome === 0
		) {
			return "ITR-1";
		}

		// ITR-4 (Sugam) - For presumptive business income up to 2 crores
		if (businessIncome > 0 && businessIncome <= 20000000) {
			return "ITR-4";
		}

		// ITR-3 - For individuals with business/professional income above presumptive limit
		if (businessIncome > 20000000) {
			return "ITR-3";
		}

		// ITR-2 - For individuals with capital gains or rental income
		if (businessIncome === 0 && (capitalGains > 0 || rentalIncome > 0)) {
			return "ITR-2";
		}

		// Default to ITR-2 for other cases
		return "ITR-2";
	}

	/**
	 * Validate PAN number format
	 */
	validatePAN(pan: string): boolean {
		const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
		return panRegex.test(pan);
	}

	/**
	 * Get tax calculation summary
	 */
	getTaxSummary(calculationData: ITRCalculationResponse["data"]) {
		if (!calculationData) return null;

		return {
			totalIncome: calculationData.totalIncome,
			taxableIncome: calculationData.taxableIncome,
			totalDeductions: calculationData.totalDeductions,
			taxLiability: calculationData.taxLiability,
			netPayable: calculationData.taxPayable,
			refundDue: calculationData.refundAmount,
			effectiveRate: `${calculationData.effectiveTaxRate}%`,
		};
	}
}

// Export singleton instance
export const taxCloudITRService = new TaxCloudITRService();
export default taxCloudITRService;
