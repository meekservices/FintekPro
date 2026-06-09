/**
 * BSE Star MFD AddInvestor API - UCC Creation Service
 *
 * Creates Unique Client Code (UCC) for mutual fund investors
 * Required before placing any mutual fund orders on BSE Star platform
 *
 * API Documentation: BSE Star MFD Web Services v3.1 - AddInvestor
 */

import axios from "axios";
import * as crypto from "crypto";

// Environment configuration - Use BSE_ENVIRONMENT for BSE-specific production flag
const IS_PRODUCTION = process.env.BSE_ENVIRONMENT === "production";
const USE_MOCKS = !IS_PRODUCTION; // Use mocks when not in BSE production mode

// BSE Star API URLs
const BSE_API_CONFIG = {
	demo: {
		baseUrl: "https://bsestarmfdemo.bseindia.com/StarMFCommonAPI/api",
	},
	production: {
		baseUrl: "https://www.bsestarmf.in/StarMFCommonAPI/api",
	},
};

const API_CONFIG = IS_PRODUCTION
	? BSE_API_CONFIG.production
	: BSE_API_CONFIG.demo;

// BSE Credentials
const BSE_CREDENTIALS = {
	userId: process.env.BSE_USER_ID || "",
	password: process.env.BSE_PASSWORD || "",
	memberId: process.env.BSE_MEMBER_ID || "",
	passKey: process.env.BSE_PASS_KEY || "",
};

/**
 * Request interface for AddInvestor API
 */
export interface UCCCreationRequest {
	// Personal Information
	firstName: string;
	middleName?: string;
	lastName: string;
	dateOfBirth: string; // YYYY-MM-DD
	gender: "M" | "F" | "T";

	// Identity
	panNumber: string;
	ckycNumber?: string;

	// Contact
	mobile: string;
	email: string;

	// Address
	addressLine1: string;
	addressLine2?: string;
	city: string;
	state: string;
	pincode: string;
	country?: string;

	// Bank Details
	bankAccountNumber: string;
	bankIfscCode: string;
	bankAccountType: "SB" | "CA" | "CC" | "NRE" | "NRO";

	// Occupation & Income
	occupation?: string;
	annualIncome?: string;

	// Nominee Details (optional)
	nomineeName?: string;
	nomineeRelationship?: string;
	nomineeDob?: string;

	// Tax Status
	taxStatus: "INDIVIDUAL" | "MINOR" | "NRI" | "HUF" | "COMPANY" | "TRUST";

	// FATCA & PEP
	taxResidency?: string;
	isTaxResident?: boolean;
	isPEP?: boolean;
}

/**
 * Response interface for AddInvestor API
 */
export interface UCCCreationResponse {
	success: boolean;
	uccCode?: string;
	clientCode?: string;
	message: string;
	bseReference?: string;
	errors?: string[];
}

/**
 * BSE UCC Service Class
 */
class BSEUCCService {
	private hasCredentials: boolean;

	constructor() {
		this.hasCredentials = this.validateCredentials();

		if (!this.hasCredentials) {
			if (IS_PRODUCTION) {
				throw new Error(
					"BSE API credentials (BSE_USER_ID, BSE_PASSWORD, BSE_MEMBER_ID, BSE_PASS_KEY) must be configured in production",
				);
			}
			console.warn("⚠️ BSE API credentials not configured");
			console.warn("⚠️ UCC creation will use mock responses in development");
		} else {
			console.log("✅ BSE UCC service initialized with valid credentials");
		}
	}

	/**
	 * Validate BSE API credentials
	 */
	private validateCredentials(): boolean {
		return !!(
			BSE_CREDENTIALS.userId &&
			BSE_CREDENTIALS.password &&
			BSE_CREDENTIALS.memberId &&
			BSE_CREDENTIALS.passKey &&
			BSE_CREDENTIALS.userId !== "demo_user" &&
			BSE_CREDENTIALS.password !== "demo_password"
		);
	}

	/**
	 * Check if service has valid credentials
	 */
	public hasValidCredentials(): boolean {
		return this.hasCredentials;
	}

	/**
	 * Create UCC (Unique Client Code) for a new investor
	 */
	async createUCC(request: UCCCreationRequest): Promise<UCCCreationResponse> {
		try {
			// If no credentials in development mode, return mock response
			if (!this.hasCredentials && USE_MOCKS) {
				return this.mockUCCCreation(request);
			}

			// If no credentials in production, throw error
			if (!this.hasCredentials) {
				throw new Error("BSE API credentials not configured");
			}

			// Prepare BSE AddInvestor request
			const bseRequest = this.prepareBSERequest(request);

			// Call BSE AddInvestor API
			const response = await axios.post(
				`${API_CONFIG.baseUrl}/AddInvestor`,
				bseRequest,
				{
					headers: {
						"Content-Type": "application/json",
					},
					timeout: 30000,
				},
			);

			// Parse BSE response
			return this.parseBSEResponse(response.data);
		} catch (error: any) {
			console.error("BSE UCC creation error:", error);

			// If API call failed in development, return mock
			if (USE_MOCKS && !this.hasCredentials) {
				console.warn("⚠️ BSE API call failed, using mock response");
				return this.mockUCCCreation(request);
			}

			throw new Error(
				`BSE UCC creation failed: ${error.message || "Unknown error"}`,
			);
		}
	}

	/**
	 * Prepare BSE AddInvestor API request
	 */
	private prepareBSERequest(request: UCCCreationRequest): any {
		// Generate client code (format: MemberID + 8-digit random number)
		const clientCode = this.generateClientCode();

		return {
			UserId: BSE_CREDENTIALS.userId,
			MemberId: BSE_CREDENTIALS.memberId,
			Password: BSE_CREDENTIALS.password,
			PassKey: BSE_CREDENTIALS.passKey,

			// Client Details
			ClientCode: clientCode,
			InvestorName: `${request.firstName}${request.middleName ? " " + request.middleName : ""} ${request.lastName}`,
			PAN: request.panNumber,
			DOB: this.formatDateForBSE(request.dateOfBirth),
			Gender: request.gender,

			// Contact
			Email: request.email,
			Mobile: request.mobile,

			// Address
			Add1: request.addressLine1,
			Add2: request.addressLine2 || "",
			Add3: "",
			City: request.city,
			State: request.state,
			Pincode: request.pincode,
			Country: request.country || "India",

			// Bank Details
			AccountNo: request.bankAccountNumber,
			IFSCCode: request.bankIfscCode,
			AccountType: request.bankAccountType,

			// Occupation
			Occupation: request.occupation || "Service",

			// Tax Status
			HoldNature: request.taxStatus,

			// CKYC
			CKYCNumber: request.ckycNumber || "",

			// PEP Declaration
			PEP: request.isPEP ? "Y" : "N",

			// Tax Residency
			TaxCountry: request.taxResidency || "India",
			TaxResident: request.isTaxResident !== false ? "Y" : "N",

			// Nominee (if provided)
			NomineeName: request.nomineeName || "",
			NomineeRelation: request.nomineeRelationship || "",
			NomineeDOB: request.nomineeDob
				? this.formatDateForBSE(request.nomineeDob)
				: "",
		};
	}

	/**
	 * Parse BSE AddInvestor API response
	 */
	private parseBSEResponse(data: any): UCCCreationResponse {
		// BSE returns status in various formats
		if (data.Status === "Success" || data.ResponseCode === "100") {
			return {
				success: true,
				uccCode: data.ClientCode || data.UCC,
				clientCode: data.ClientCode || data.UCC,
				message: "UCC created successfully",
				bseReference: data.ReferenceNo || data.TransactionNo,
			};
		}
		return {
			success: false,
			message: data.Message || data.ResponseMessage || "UCC creation failed",
			errors: data.Errors || [data.Message],
		};
	}

	/**
	 * Generate client code (UCC)
	 * Format: MemberID + Random 8-digit number
	 */
	private generateClientCode(): string {
		const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
		return `${BSE_CREDENTIALS.memberId}${randomDigits}`;
	}

	/**
	 * Format date for BSE API (DD/MM/YYYY)
	 */
	private formatDateForBSE(dateString: string): string {
		const date = new Date(dateString);
		const day = String(date.getDate()).padStart(2, "0");
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const year = date.getFullYear();
		return `${day}/${month}/${year}`;
	}

	/**
	 * Mock UCC creation for development/testing
	 */
	private mockUCCCreation(request: UCCCreationRequest): UCCCreationResponse {
		// Generate mock UCC code
		const panHash = request.panNumber
			.split("")
			.reduce((sum, char) => sum + char.charCodeAt(0), 0);
		const mockUCC = `MOCK${String(panHash % 100000000).padStart(8, "0")}`;

		console.log(`🔧 [MOCK] Creating UCC for PAN: ${request.panNumber}`);
		console.log(`🔧 [MOCK] Generated UCC: ${mockUCC}`);

		return {
			success: true,
			uccCode: mockUCC,
			clientCode: mockUCC,
			message: "UCC created successfully (MOCK)",
			bseReference: `MOCK-REF-${Date.now()}`,
		};
	}
}

// Export singleton instance
export const bseUCCService = new BSEUCCService();
