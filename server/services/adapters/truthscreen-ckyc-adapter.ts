/**
 * TruthScreen CKYC Provider Adapter
 *
 * Uses TruthScreen's 3-step server-side encrypt/decrypt flow:
 * 1. POST /InstantSearch/encrypted_string — encrypt the request payload server-side
 * 2. POST /api/v2.2/idsearch — submit the encrypted search request
 * 3. POST /InstantSearch/decrypt_encrypted_string — decrypt the response server-side
 *
 * docType 400 = CKYC search
 * Authentication: username header on all requests
 */

import type {
	ICkycProviderAdapter,
	CkycVerificationRequest,
	CkycVerificationResult,
	CkycProviderHealth,
} from "../ckyc-provider-adapter";

export class TruthScreenCkycAdapter implements ICkycProviderAdapter {
	readonly providerCode = "truthscreen";
	readonly providerName = "TruthScreen CKYC API";

	private username: string;
	private password: string;
	private baseUrl: string;

	constructor() {
		this.username = process.env.TRUTHSCREEN_USERNAME || "";
		this.password = process.env.TRUTHSCREEN_PASSWORD || "";
		this.baseUrl =
			process.env.TRUTHSCREEN_BASE_URL || "https://www.truthscreen.com";
	}

	isConfigured(): boolean {
		return !!(this.username && this.password);
	}

	isInMockMode(): boolean {
		return !this.isConfigured();
	}

	private getHeaders() {
		return {
			"Content-Type": "application/json",
			username: this.username,
		};
	}

	private async encryptPayload(payload: object): Promise<string> {
		const axios = (await import("axios")).default;

		console.log(
			`[TruthScreen CKYC] Step 1: Encrypting payload via /InstantSearch/encrypted_string`,
		);

		const response = await axios.post(
			`${this.baseUrl}/InstantSearch/encrypted_string`,
			payload,
			{
				headers: this.getHeaders(),
				timeout: 15000,
			},
		);

		const encryptedString =
			response.data?.encryptedString ||
			response.data?.encrypted_string ||
			response.data;

		if (!encryptedString || typeof encryptedString !== "string") {
			console.error(
				"[TruthScreen CKYC] Encryption response:",
				JSON.stringify(response.data).substring(0, 300),
			);
			throw new Error(
				"TruthScreen encryption endpoint did not return an encrypted string",
			);
		}

		console.log(
			`[TruthScreen CKYC] Step 1 complete: Got encrypted string (${encryptedString.length} chars)`,
		);
		return encryptedString;
	}

	private async submitSearch(encryptedRequestData: string): Promise<string> {
		const axios = (await import("axios")).default;

		console.log(
			`[TruthScreen CKYC] Step 2: Submitting search via /api/v2.2/idsearch`,
		);

		const response = await axios.post(
			`${this.baseUrl}/api/v2.2/idsearch`,
			{ requestData: encryptedRequestData },
			{
				headers: this.getHeaders(),
				timeout: 30000,
			},
		);

		const encryptedResponse =
			response.data?.responseData ||
			response.data?.response_data ||
			response.data;

		if (!encryptedResponse) {
			console.error(
				"[TruthScreen CKYC] Search response (raw):",
				JSON.stringify(response.data).substring(0, 300),
			);
			throw new Error(
				"TruthScreen search endpoint did not return response data",
			);
		}

		if (typeof encryptedResponse === "object") {
			console.log(
				`[TruthScreen CKYC] Step 2 complete: Got unencrypted response object`,
			);
			return JSON.stringify(encryptedResponse);
		}

		console.log(
			`[TruthScreen CKYC] Step 2 complete: Got encrypted response (${encryptedResponse.length} chars)`,
		);
		return encryptedResponse;
	}

	private async decryptResponse(encryptedResponseData: string): Promise<any> {
		try {
			const parsed = JSON.parse(encryptedResponseData);
			console.log(`[TruthScreen CKYC] Response was already unencrypted JSON`);
			return parsed;
		} catch {}

		const axios = (await import("axios")).default;

		console.log(
			`[TruthScreen CKYC] Step 3: Decrypting response via /InstantSearch/decrypt_encrypted_string`,
		);

		const response = await axios.post(
			`${this.baseUrl}/InstantSearch/decrypt_encrypted_string`,
			{ responseData: encryptedResponseData },
			{
				headers: this.getHeaders(),
				timeout: 15000,
			},
		);

		const decrypted = response.data;
		console.log(`[TruthScreen CKYC] Step 3 complete: Got decrypted response`);
		return decrypted;
	}

	async verify(
		request: CkycVerificationRequest,
	): Promise<CkycVerificationResult> {
		const startTime = Date.now();

		try {
			if (this.isInMockMode()) {
				return this.mockVerification(request, startTime);
			}

			const transID = `FTKP${Date.now()}`;
			const encryptionPayload = {
				transID,
				docType: 400,
				docNumber: request.panNumber.toUpperCase(),
			};

			console.log(
				`[TruthScreen CKYC] Starting CKYC lookup for PAN: ${this.maskPAN(request.panNumber)}, transID: ${transID}`,
			);

			const encryptedRequest = await this.encryptPayload(encryptionPayload);

			const encryptedResponse = await this.submitSearch(encryptedRequest);

			const decryptedResponse = await this.decryptResponse(encryptedResponse);

			const responseTimeMs = Date.now() - startTime;

			console.log(
				`[TruthScreen CKYC] Decrypted response keys: ${Object.keys(decryptedResponse || {}).join(", ")}`,
			);
			console.log(
				`[TruthScreen CKYC] Response snippet: ${JSON.stringify(decryptedResponse).substring(0, 500)}`,
			);

			return this.parseResponse(decryptedResponse, request, responseTimeMs);
		} catch (error: any) {
			const responseTimeMs = Date.now() - startTime;

			console.error(
				`[TruthScreen CKYC] Error (${responseTimeMs}ms):`,
				error.message,
			);
			if (error.response?.data) {
				console.error(
					"[TruthScreen CKYC] Error response body:",
					JSON.stringify(error.response.data).substring(0, 500),
				);
			}
			if (error.response?.status) {
				console.error(
					`[TruthScreen CKYC] HTTP status: ${error.response.status}`,
				);
			}

			if (error.response?.status === 404 || error.response?.status === 9) {
				return {
					success: true,
					found: false,
					provider: this.providerCode,
					status: "not_found",
					responseTimeMs,
					message: "CKYC record not found",
				};
			}

			return {
				success: false,
				found: false,
				provider: this.providerCode,
				responseTimeMs,
				message: error.message || "TruthScreen API error",
				errorCode: error.response?.status?.toString() || "UNKNOWN_ERROR",
			};
		}
	}

	private parseResponse(
		data: any,
		request: CkycVerificationRequest,
		responseTimeMs: number,
	): CkycVerificationResult {
		if (!data) {
			return {
				success: true,
				found: false,
				provider: this.providerCode,
				status: "not_found",
				responseTimeMs,
				message: "Empty response from TruthScreen",
			};
		}

		const msg = (data.msg || data.message || data.status_message || "")
			.toString()
			.toLowerCase();
		const status = (data.status || "").toString();

		if (
			status === "0" ||
			msg.includes("no record") ||
			msg.includes("not found") ||
			msg.includes("no data")
		) {
			return {
				success: true,
				found: false,
				provider: this.providerCode,
				status: "not_found",
				responseTimeMs,
				message: data.msg || data.message || "CKYC record not found",
			};
		}

		const kin =
			data.ckycNumber ||
			data.cKYCId ||
			data.kin ||
			data.ckyc_number ||
			data.ckycId;

		if (kin) {
			const isValidated =
				data.kycFlag === "VALIDATED" ||
				data.status === "KYC_VALIDATED" ||
				data.isKycValidated === true ||
				status === "1";

			return {
				success: true,
				found: true,
				provider: this.providerCode,
				kin: kin.toString(),
				status: isValidated ? "active" : "pending",
				verificationLevel: "normal",
				data: {
					fullName:
						data.full_name || data.name || data.fullName || request.fullName,
					fatherName: data.father_name || data.fatherName,
					motherName: data.mother_name || data.motherName,
					dateOfBirth:
						data.dob ||
						data.date_of_birth ||
						data.dateOfBirth ||
						request.dateOfBirth,
					gender: data.gender || "Unknown",
					address: {
						line1:
							data.address?.line1 || data.address || data.corresLine1 || "",
						line2: data.address?.line2 || data.corresLine2,
						city: data.address?.city || data.city || data.corresCity || "",
						state: data.address?.state || data.state || data.corresState || "",
						pincode:
							data.address?.pincode || data.pincode || data.corresPincode || "",
						country: data.address?.country || data.country || "India",
					},
					mobile: data.mobile || data.mobileNo,
					email: data.email || data.emailId,
					kycDate: data.kyc_date || data.ckycApplicationDate || data.kycDate,
				},
				responseTimeMs,
				message: "CKYC record found via TruthScreen",
			};
		}

		if (data.kraRecords || data.kra_records) {
			const kraRecords = data.kraRecords || data.kra_records || [];
			const validatedRecord = kraRecords.find(
				(r: any) =>
					r.statusDescription?.toUpperCase().includes("VALIDATED") ||
					r.modifyStatus?.toUpperCase().includes("VALIDATED"),
			);
			const isKycValidated =
				!!validatedRecord ||
				data.kycFlag === "VALIDATED" ||
				data.status === "KYC_VALIDATED";

			return {
				success: true,
				found: isKycValidated,
				provider: this.providerCode,
				kin: data.ckycNumber || data.cKYCId,
				status: isKycValidated ? "active" : "not_found",
				verificationLevel: "normal",
				responseTimeMs,
				message: isKycValidated
					? "KYC is validated via TruthScreen"
					: "KYC status retrieved but not validated",
			};
		}

		if (status === "1" || msg.includes("success")) {
			return {
				success: true,
				found: true,
				provider: this.providerCode,
				status: "active",
				responseTimeMs,
				message: data.msg || "CKYC check successful via TruthScreen",
			};
		}

		return {
			success: true,
			found: false,
			provider: this.providerCode,
			status: "not_found",
			responseTimeMs,
			message: data.msg || data.message || "CKYC record not found",
		};
	}

	async checkHealth(): Promise<CkycProviderHealth> {
		const startTime = Date.now();

		if (this.isInMockMode()) {
			return {
				provider: this.providerCode,
				healthy: true,
				latencyMs: Date.now() - startTime,
				lastChecked: new Date(),
				errorMessage: "Mock mode - no credentials configured",
			};
		}

		try {
			const axios = (await import("axios")).default;

			const testPayload = {
				transID: `health-${Date.now()}`,
				docType: 400,
				docNumber: "XXXXX0000X",
			};

			await axios.post(
				`${this.baseUrl}/InstantSearch/encrypted_string`,
				testPayload,
				{
					headers: this.getHeaders(),
					timeout: 10000,
				},
			);

			return {
				provider: this.providerCode,
				healthy: true,
				latencyMs: Date.now() - startTime,
				lastChecked: new Date(),
			};
		} catch (error: any) {
			const isApiError = error.response?.status && error.response.status < 500;
			return {
				provider: this.providerCode,
				healthy: isApiError,
				latencyMs: Date.now() - startTime,
				lastChecked: new Date(),
				errorMessage: isApiError
					? "API reachable (test request rejected as expected)"
					: error.message,
			};
		}
	}

	private mockVerification(
		request: CkycVerificationRequest,
		startTime: number,
	): CkycVerificationResult {
		const mockKin = `KIN${request.panNumber.substring(0, 5)}${Date.now().toString().slice(-6)}`;

		return {
			success: true,
			found: true,
			provider: this.providerCode,
			kin: mockKin,
			status: "active",
			verificationLevel: "normal",
			data: {
				fullName: request.fullName,
				dateOfBirth: request.dateOfBirth,
				gender: "Unknown",
				address: {
					line1: "Mock Address Line 1",
					city: "Mumbai",
					state: "Maharashtra",
					pincode: "400001",
					country: "India",
				},
				mobile: request.mobileNumber,
				email: request.emailAddress,
			},
			responseTimeMs: Date.now() - startTime,
			message: "[MOCK] CKYC record found via TruthScreen",
		};
	}

	private maskPAN(pan: string): string {
		if (!pan || pan.length < 4) return "XXXX";
		return `${pan.substring(0, 2)}XXXX${pan.slice(-2)}`;
	}
}
