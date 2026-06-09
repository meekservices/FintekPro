/**
 * TruthScreen CKYC Service
 *
 * AuthBridge and TruthScreen are the same company.
 * This file previously used AUTHBRIDGE_API_KEY / api.authbridge.com.
 * It now delegates to TruthScreenCkycAdapter (TRUTHSCREEN_USERNAME + TRUTHSCREEN_PASSWORD)
 * which implements the correct 3-step encrypt/search/decrypt flow against www.truthscreen.com.
 *
 * The exported singleton is still named `authBridgeCKYCService` for backward compatibility
 * with existing call sites in server/routes/kyc/index.ts and server/routes.ts.
 * No call-site changes are required.
 */

import { TruthScreenCkycAdapter } from "./services/adapters/truthscreen-ckyc-adapter";
import type { CkycVerificationRequest } from "./services/ckyc-provider-adapter";
import { AppError } from "./utils/errors";

// ── Public types — kept unchanged so existing callers compile without edits ──

export interface AuthBridgeCKYCRequest {
	pan: string;
	full_name: string;
	date_of_birth: string;
	aadhaar?: string;
}

export interface AuthBridgeCKYCResponse {
	status: "success" | "failure";
	data?: {
		kin: string;
		full_name: string;
		pan: string;
		date_of_birth: string;
		gender: string;
		father_name?: string;
		mother_name?: string;
		address: {
			line1: string;
			line2?: string;
			city: string;
			state: string;
			pincode: string;
			country: string;
		};
		mobile?: string;
		email?: string;
		kyc_type: "Simplified" | "Normal";
		kyc_date: string;
		photo_url?: string;
		signature_url?: string;
		documents?: Array<{
			type: string;
			number: string;
			verified: boolean;
		}>;
	};
	message?: string;
	error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────

class AuthBridgeCKYCService {
	private readonly adapter: TruthScreenCkycAdapter;

	constructor() {
		this.adapter = new TruthScreenCkycAdapter();

		if (this.adapter.isInMockMode()) {
			console.log(
				`[TruthScreen CKYC] Running in mock mode (TRUTHSCREEN_USERNAME / TRUTHSCREEN_PASSWORD not set)`,
			);
		} else {
			console.log(
				`✅ [TruthScreen CKYC] Initialized — credentials loaded from TRUTHSCREEN_USERNAME`,
			);
		}
	}

	getEnvironment(): string {
		return process.env.NODE_ENV === "production" ? "production" : "sandbox";
	}

	isInMockMode(): boolean {
		return this.adapter.isInMockMode();
	}

	/**
	 * Fetch a CKYC record by PAN.
	 * Delegates to TruthScreenCkycAdapter and maps the result to AuthBridgeCKYCResponse
	 * so existing call sites require no changes.
	 */
	async fetchCKYC(
		request: AuthBridgeCKYCRequest,
	): Promise<AuthBridgeCKYCResponse> {
		const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
		if (!panRegex.test(request.pan)) {
			throw new AppError("Invalid PAN format", 400, "INVALID_PAN_FORMAT");
		}

		const verifyRequest: CkycVerificationRequest = {
			panNumber: request.pan.toUpperCase(),
			fullName: request.full_name,
			dateOfBirth: request.date_of_birth,
			aadhaarNumber: request.aadhaar,
			userId: "system",
		};

		const result = await this.adapter.verify(verifyRequest);

		if (!result.success || !result.found || !result.data) {
			const maskedPan = `${request.pan.slice(0, 4)}${"*".repeat(5)}${request.pan.slice(-1)}`;
			console.log(
				`ℹ️ [TruthScreen CKYC] Record not found for PAN: ${maskedPan} — ${result.message}`,
			);
			return {
				status: "failure",
				message: result.message || "CKYC record not found",
				error: result.errorCode || "CKYC_NOT_FOUND",
			};
		}

		const maskedPan = `${request.pan.slice(0, 4)}${"*".repeat(5)}${request.pan.slice(-1)}`;
		console.log(
			`✅ [TruthScreen CKYC] Record found — PAN: ${maskedPan}, KIN: ${result.kin}`,
		);
		return {
			status: "success",
			data: {
				kin: result.kin || "",
				full_name: result.data.fullName,
				pan: request.pan.toUpperCase(),
				date_of_birth: result.data.dateOfBirth,
				gender: result.data.gender,
				father_name: result.data.fatherName,
				mother_name: result.data.motherName,
				address: result.data.address,
				mobile: result.data.mobile,
				email: result.data.email,
				kyc_type:
					result.verificationLevel === "simplified" ? "Simplified" : "Normal",
				kyc_date: result.data.kycDate || new Date().toISOString().split("T")[0],
				photo_url: result.data.photoUrl,
				signature_url: result.data.signatureUrl,
				documents: result.data.documents,
			},
		};
	}

	/** Quick check: does a CKYC record exist for this PAN? */
	async ckycExists(pan: string): Promise<boolean> {
		try {
			const response = await this.fetchCKYC({
				pan,
				full_name: "Check",
				date_of_birth: "01/01/1990",
			});
			return response.status === "success" && !!response.data;
		} catch {
			return false;
		}
	}

	/** Map CKYC response data to a flat profile object for user record updates. */
	extractProfileData(ckycData: AuthBridgeCKYCResponse["data"]) {
		if (!ckycData) return null;

		return {
			fullName: ckycData.full_name,
			pan: ckycData.pan,
			dateOfBirth: ckycData.date_of_birth,
			gender: ckycData.gender,
			fatherName: ckycData.father_name,
			motherName: ckycData.mother_name,
			address:
				ckycData.address.line1 +
				(ckycData.address.line2 ? ", " + ckycData.address.line2 : ""),
			city: ckycData.address.city,
			state: ckycData.address.state,
			pincode: ckycData.address.pincode,
			country: ckycData.address.country,
			mobile: ckycData.mobile,
			email: ckycData.email,
			ckycKin: ckycData.kin,
			ckycType: ckycData.kyc_type,
			ckycDate: ckycData.kyc_date,
		};
	}
}

// Singleton — same export name as before so no call-site changes are needed
export const authBridgeCKYCService = new AuthBridgeCKYCService();
