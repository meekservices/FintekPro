/**
 * KRA (KYC Registration Agency) Status Check Service
 *
 * Integrates with NSDL/CVL KRA APIs to check existing KYC status.
 * This allows users with verified KYC to skip Aadhaar verification.
 *
 * Status Types:
 * - VERIFIED: KYC exists and is active
 * - ONHOLD: KYC exists but needs review
 * - KYC_NOT_FOUND: No KYC record found
 * - REJECTED: KYC application was rejected
 */

export interface KRAStatusRequest {
	panNumber: string;
	dateOfBirth: string; // Format: YYYY-MM-DD
	fullName?: string; // Optional for additional validation
}

export interface KRAStatusResponse {
	success: boolean;
	status: "VERIFIED" | "ONHOLD" | "KYC_NOT_FOUND" | "REJECTED";
	ckycNumber?: string; // KIN (KYC Identification Number)
	verificationDate?: string;
	expiryDate?: string;
	kycDetails?: {
		name: string;
		dob: string;
		address?: string;
		mobile?: string;
		email?: string;
	};
	message: string;
	errors?: string[];
}

export class KRAStatusService {
	private nsdlApiUrl: string;
	private cvlApiUrl: string;
	private apiKey: string;
	private apiSecret: string;

	constructor() {
		// NSDL KRA API (primary)
		this.nsdlApiUrl =
			process.env.NSDL_KRA_API_URL || "https://kra.nsdl.com/api/v1";

		// CVL KRA API (fallback)
		this.cvlApiUrl =
			process.env.CVL_KRA_API_URL || "https://www.cvlindia.com/kra/api/v1";

		// API credentials
		this.apiKey = process.env.KRA_API_KEY || "";
		this.apiSecret = process.env.KRA_API_SECRET || "";
	}

	/**
	 * Normalize external KRA status to internal enum
	 */
	private normalizeKRAStatus(
		externalStatus: string,
	): "VERIFIED" | "ONHOLD" | "KYC_NOT_FOUND" | "REJECTED" {
		const status = externalStatus?.toUpperCase() || "";

		// Map various external status values to our enum
		if (status === "VERIFIED" || status === "ACTIVE" || status === "APPROVED") {
			return "VERIFIED";
		}
		if (status === "ONHOLD" || status === "PENDING" || status === "HOLD") {
			return "ONHOLD";
		}
		if (
			status === "REJECTED" ||
			status === "DECLINED" ||
			status === "INVALID"
		) {
			return "REJECTED";
		}

		// Default to NOT_FOUND for unknown/empty statuses
		console.warn(
			"⚠️ Unknown KRA status received:",
			externalStatus,
			"- defaulting to KYC_NOT_FOUND",
		);
		return "KYC_NOT_FOUND";
	}

	/**
	 * Check KYC status with NSDL KRA
	 * Throws error on failure to enable CVL fallback
	 */
	async checkNSDLStatus(request: KRAStatusRequest): Promise<KRAStatusResponse> {
		console.log(
			"🔍 Checking NSDL KRA status for PAN:",
			request.panNumber.slice(0, 4) + "***",
		);

		const response = await fetch(`${this.nsdlApiUrl}/kyc-status`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-API-Key": this.apiKey,
				"X-API-Secret": this.apiSecret,
			},
			body: JSON.stringify({
				pan: request.panNumber,
				dob: request.dateOfBirth,
				name: request.fullName,
			}),
		});

		if (!response.ok) {
			throw new Error(
				`NSDL KRA API error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		// Normalize the status to our enum
		const normalizedStatus = this.normalizeKRAStatus(data.status);

		return {
			success: true,
			status: normalizedStatus,
			ckycNumber: data.ckyc_number || data.kin,
			verificationDate: data.verification_date,
			expiryDate: data.expiry_date,
			kycDetails: data.kyc_details
				? {
						name: data.kyc_details.name,
						dob: data.kyc_details.dob,
						address: data.kyc_details.address,
						mobile: data.kyc_details.mobile,
						email: data.kyc_details.email,
					}
				: undefined,
			message: data.message || "KYC status check completed",
		};
	}

	/**
	 * Check KYC status with CVL KRA (fallback)
	 * Throws error on failure
	 */
	async checkCVLStatus(request: KRAStatusRequest): Promise<KRAStatusResponse> {
		console.log(
			"🔍 Checking CVL KRA status for PAN:",
			request.panNumber.slice(0, 4) + "***",
		);

		const response = await fetch(`${this.cvlApiUrl}/search`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${this.apiKey}`,
			},
			body: JSON.stringify({
				pan_number: request.panNumber,
				date_of_birth: request.dateOfBirth,
			}),
		});

		if (!response.ok) {
			throw new Error(
				`CVL KRA API error: ${response.status} ${response.statusText}`,
			);
		}

		const data = await response.json();

		// Normalize the status to our enum
		const normalizedStatus = this.normalizeKRAStatus(data.kyc_status);

		return {
			success: true,
			status: normalizedStatus,
			ckycNumber: data.application_id,
			verificationDate: data.verified_on,
			expiryDate: data.valid_till,
			kycDetails: data.applicant_details
				? {
						name: data.applicant_details.name,
						dob: data.applicant_details.dob,
						address: data.applicant_details.address,
						mobile: data.applicant_details.mobile,
						email: data.applicant_details.email,
					}
				: undefined,
			message: data.message || "KYC status retrieved",
		};
	}

	/**
	 * Check KRA status with automatic fallback
	 * Tries NSDL first, then CVL if NSDL fails
	 */
	async checkKRAStatus(request: KRAStatusRequest): Promise<KRAStatusResponse> {
		// Validate inputs
		if (!request.panNumber || request.panNumber.length !== 10) {
			return {
				success: false,
				status: "KYC_NOT_FOUND",
				message: "Invalid PAN number",
				errors: ["PAN number must be 10 characters"],
			};
		}

		if (!request.dateOfBirth) {
			return {
				success: false,
				status: "KYC_NOT_FOUND",
				message: "Date of birth is required",
				errors: ["Date of birth is required for KRA verification"],
			};
		}

		// If in development mode with no API credentials, use mocks explicitly
		const isDevelopment = process.env.NODE_ENV === "development";
		const hasCredentials = this.apiKey && this.apiSecret;

		if (isDevelopment && !hasCredentials) {
			throw new Error(
				"KRA verification service not configured. Set KRA_API_KEY and KRA_API_SECRET for KYC status verification.",
			);
		}

		try {
			// Try NSDL first (primary KRA)
			const nsdlResult = await this.checkNSDLStatus(request);

			// If NSDL finds a record, return it
			if (nsdlResult.status !== "KYC_NOT_FOUND") {
				console.log("✅ NSDL KRA status:", nsdlResult.status);
				return nsdlResult;
			}

			// Fallback to CVL if NSDL doesn't find anything
			console.log("🔄 NSDL not found, trying CVL KRA...");
			const cvlResult = await this.checkCVLStatus(request);
			console.log("✅ CVL KRA status:", cvlResult.status);
			return cvlResult;
		} catch (nsdlError: any) {
			console.error("❌ NSDL KRA check failed:", nsdlError.message);

			// Try CVL fallback before giving up
			try {
				console.log("🔄 Attempting CVL KRA fallback due to NSDL failure...");
				const cvlResult = await this.checkCVLStatus(request);
				console.log("✅ CVL KRA status (fallback):", cvlResult.status);
				return cvlResult;
			} catch (cvlError: any) {
				console.error("❌ CVL KRA fallback also failed:", cvlError.message);

				// Both KRAs failed - return error in production, mock only in dev without credentials
				if (!isDevelopment || hasCredentials) {
					return {
						success: false,
						status: "KYC_NOT_FOUND",
						message:
							"Unable to verify KRA status. Please proceed with Aadhaar verification.",
						errors: [`NSDL: ${nsdlError.message}`, `CVL: ${cvlError.message}`],
					};
				}

				throw new Error(
					"KRA verification service not configured. Set KRA_API_KEY and KRA_API_SECRET for KYC status verification.",
				);
			}
		}
	}

	/**
	 * Download KYC details from KRA (for reuse)
	 */
	async downloadKYCDetails(ckycNumber: string): Promise<any> {
		try {
			const response = await fetch(`${this.nsdlApiUrl}/kyc-download`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-API-Key": this.apiKey,
					"X-API-Secret": this.apiSecret,
				},
				body: JSON.stringify({
					ckyc_number: ckycNumber,
				}),
			});

			if (!response.ok) {
				throw new Error(`KYC download failed: ${response.statusText}`);
			}

			const data = await response.json();
			console.log("✅ KYC details downloaded successfully");
			return data;
		} catch (error: any) {
			console.error("KYC download error:", error);
			return null;
		}
	}
}

// Export singleton instance
export const kraStatusService = new KRAStatusService();
