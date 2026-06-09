/**
 * CERSAI Reference CKYC Provider Adapter
 * For CKYC verification via CERSAI reference API
 */

import type {
	ICkycProviderAdapter,
	CkycVerificationRequest,
	CkycVerificationResult,
	CkycProviderHealth,
} from "../ckyc-provider-adapter";

export class CersaiCkycAdapter implements ICkycProviderAdapter {
	readonly providerCode = "cersai_reference";
	readonly providerName = "CERSAI Reference CKYC";

	private apiKey: string;
	private baseUrl: string;

	constructor() {
		this.apiKey = process.env.CERSAI_API_KEY || "";
		this.baseUrl =
			process.env.CERSAI_BASE_URL || "https://api.cersai.org.in/v1/";
	}

	isConfigured(): boolean {
		return !!this.apiKey;
	}

	isInMockMode(): boolean {
		return !this.isConfigured();
	}

	async verify(
		request: CkycVerificationRequest,
	): Promise<CkycVerificationResult> {
		const startTime = Date.now();

		if (this.isInMockMode()) {
			return this.mockVerification(request, startTime);
		}

		try {
			const axios = (await import("axios")).default;

			const response = await axios.post(
				`${this.baseUrl}ckyc/fetch`,
				{
					pan: request.panNumber.toUpperCase(),
					name: request.fullName,
					dob: request.dateOfBirth,
				},
				{
					headers: {
						"X-API-Key": this.apiKey,
						"Content-Type": "application/json",
					},
					timeout: 30000,
				},
			);

			const responseTimeMs = Date.now() - startTime;

			if (response.data?.success && response.data?.data?.kin) {
				const data = response.data.data;
				return {
					success: true,
					found: true,
					provider: this.providerCode,
					kin: data.kin,
					status: "active",
					verificationLevel: "normal",
					data: {
						fullName: data.name || request.fullName,
						dateOfBirth: data.dob || request.dateOfBirth,
						gender: data.gender || "Unknown",
						address: {
							line1: data.address?.line1 || "",
							line2: data.address?.line2,
							city: data.address?.city || "",
							state: data.address?.state || "",
							pincode: data.address?.pincode || "",
							country: "India",
						},
					},
					responseTimeMs,
					message: "CKYC record found via CERSAI",
				};
			}

			return {
				success: true,
				found: false,
				provider: this.providerCode,
				status: "not_found",
				responseTimeMs,
				message: "CKYC record not found",
			};
		} catch (error: any) {
			return {
				success: false,
				found: false,
				provider: this.providerCode,
				responseTimeMs: Date.now() - startTime,
				message: error.message || "CERSAI API error",
				errorCode: "API_ERROR",
			};
		}
	}

	async checkHealth(): Promise<CkycProviderHealth> {
		return {
			provider: this.providerCode,
			healthy: true,
			latencyMs: 0,
			lastChecked: new Date(),
			errorMessage: this.isInMockMode()
				? "Mock mode - no credentials configured"
				: undefined,
		};
	}

	private mockVerification(
		request: CkycVerificationRequest,
		startTime: number,
	): CkycVerificationResult {
		return {
			success: true,
			found: false,
			provider: this.providerCode,
			status: "not_found",
			responseTimeMs: Date.now() - startTime,
			message: "[MOCK] CERSAI provider not configured - record not found",
		};
	}
}
