/**
 * TruthScreen Aadhaar eSign (DSC) Service
 * (Previously named "AuthBridge" — same company, same service.)
 *
 * Handles Aadhaar-based Digital Signature Certificate (eSign) via TruthScreen API.
 * Used for legally valid electronic document signing under IT Act 2000.
 *
 * NOTE: The active eSign path in production is server/services/unified-esign-service.ts,
 * which uses server/services/truthscreen-esign-service.ts as the TruthScreen provider.
 * This file is kept for reference / direct usage. Credentials are read from
 * TRUTHSCREEN_USERNAME + TRUTHSCREEN_PASSWORD (same as all other TruthScreen services).
 *
 * Flow:
 * 1. Initiate eSign request with document hash
 * 2. Send Aadhaar OTP to user's linked mobile
 * 3. Verify OTP and generate signed document
 * 4. Store signature certificate for audit trail
 */

import axios, { AxiosError } from "axios";
import crypto from "crypto";
import { AppError } from "./utils/errors";
import { db } from "./db";
import { esignRequests, esignCertificates } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";

// eSign Request Types
interface ESignInitiateRequest {
	userId: string;
	documentType:
		| "itr_verification"
		| "form_15ca"
		| "form_15cb"
		| "investment_agreement"
		| "kyc_consent"
		| "mandate"
		| "other";
	documentName: string;
	documentHash: string;
	documentUrl?: string;
	aadhaarNumber: string;
	fullName: string;
	callbackUrl?: string;
}

interface ESignInitiateResponse {
	success: boolean;
	transactionId: string;
	requestId: string;
	message: string;
	otpSent?: boolean;
	maskedMobile?: string;
	expiresAt?: Date;
}

interface ESignVerifyRequest {
	transactionId: string;
	otp: string;
}

interface ESignVerifyResponse {
	success: boolean;
	message: string;
	signedDocumentUrl?: string;
	certificateId?: string;
	signatureData?: {
		signedAt: Date;
		signerName: string;
		signerAadhaar: string;
		certificateSerial: string;
		signatureAlgorithm: string;
		validFrom: Date;
		validTo: Date;
	};
}

interface ESignCertificate {
	id: string;
	userId: string;
	transactionId: string;
	documentType: string;
	documentName: string;
	documentHash: string;
	signedDocumentUrl: string;
	certificateSerial: string;
	signerName: string;
	signerAadhaarMasked: string;
	signedAt: Date;
	validFrom: Date;
	validTo: Date;
	signatureAlgorithm: string;
	status: "valid" | "expired" | "revoked";
}

class AuthBridgeESignService {
	private baseUrl: string;
	private apiKey: string; // maps to TRUTHSCREEN_USERNAME
	private clientId: string; // maps to TRUTHSCREEN_PASSWORD (kept as clientId for API header compat)
	private clientSecret: string;
	private environment: "sandbox" | "production";

	// TruthScreen eSign API base URL (AuthBridge = TruthScreen, same company)
	private static readonly PRODUCTION_URL = "https://www.truthscreen.com";
	private static readonly SANDBOX_URL = "https://www.truthscreen.com"; // same base, docType controls mode

	// eSign API Endpoints (TruthScreen format)
	private static readonly ESIGN_INITIATE = "/v2/esign/aadhaar/initiate";
	private static readonly ESIGN_VERIFY = "/v2/esign/aadhaar/verify";
	private static readonly ESIGN_STATUS = "/v2/esign/status";
	private static readonly ESIGN_DOWNLOAD = "/v2/esign/download";
	private static readonly ESIGN_RESEND_OTP = "/v2/esign/resend-otp";

	constructor() {
		this.environment =
			process.env.NODE_ENV === "production" ? "production" : "sandbox";

		// Credentials: TRUTHSCREEN_USERNAME / TRUTHSCREEN_PASSWORD
		// (AUTHBRIDGE_* env vars are accepted as fallbacks for backward compatibility
		//  during the Railway variable migration period)
		this.baseUrl =
			process.env.TRUTHSCREEN_BASE_URL ||
			process.env.AUTHBRIDGE_ESIGN_BASE_URL ||
			process.env.AUTHBRIDGE_BASE_URL ||
			AuthBridgeESignService.PRODUCTION_URL;

		this.apiKey =
			process.env.TRUTHSCREEN_USERNAME ||
			process.env.AUTHBRIDGE_ESIGN_API_KEY ||
			process.env.AUTHBRIDGE_API_KEY ||
			"";

		this.clientId =
			process.env.TRUTHSCREEN_PASSWORD ||
			process.env.AUTHBRIDGE_ESIGN_CLIENT_ID ||
			process.env.AUTHBRIDGE_CLIENT_ID ||
			"";

		this.clientSecret =
			process.env.AUTHBRIDGE_ESIGN_CLIENT_SECRET ||
			process.env.AUTHBRIDGE_CLIENT_SECRET ||
			"";

		if (!this.apiKey || !this.clientId) {
			console.log(
				`[TruthScreen eSign] Running in mock mode (TRUTHSCREEN_USERNAME / TRUTHSCREEN_PASSWORD not set)`,
			);
		} else {
			console.log(
				`✅ [TruthScreen eSign] Initialized in ${this.environment.toUpperCase()} mode`,
			);
			console.log(`   Base URL: ${this.baseUrl}`);
		}
	}

	getEnvironment(): string {
		return this.environment;
	}

	isInMockMode(): boolean {
		return !this.apiKey || !this.clientId;
	}

	/**
	 * Generate document hash for signing
	 */
	generateDocumentHash(documentContent: Buffer | string): string {
		const content =
			typeof documentContent === "string"
				? Buffer.from(documentContent)
				: documentContent;
		return crypto.createHash("sha256").update(content).digest("hex");
	}

	/**
	 * Mask Aadhaar number for storage (show only last 4 digits)
	 */
	private maskAadhaar(aadhaar: string): string {
		const cleaned = aadhaar.replace(/\s/g, "");
		if (cleaned.length !== 12) return "XXXX-XXXX-XXXX";
		return `XXXX-XXXX-${cleaned.slice(-4)}`;
	}

	/**
	 * Initiate Aadhaar eSign request
	 * Sends OTP to Aadhaar-linked mobile number
	 */
	async initiateESign(
		request: ESignInitiateRequest,
	): Promise<ESignInitiateResponse> {
		const transactionId = `ESIGN-${Date.now()}-${nanoid(8)}`;

		try {
			// Store the request in database first
			await db.insert(esignRequests).values({
				id: nanoid(),
				userId: request.userId,
				transactionId,
				documentType: request.documentType,
				documentName: request.documentName,
				documentHash: request.documentHash,
				documentUrl: request.documentUrl || null,
				aadhaarMasked: this.maskAadhaar(request.aadhaarNumber),
				signerName: request.fullName,
				status: "initiated",
				otpSentAt: new Date(),
				expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
			} as any);

			if (this.isInMockMode()) {
				console.log(
					`[TruthScreen eSign] Mock mode - simulating OTP sent for transaction: ${transactionId}`,
				);

				return {
					success: true,
					transactionId,
					requestId: `REQ-${nanoid(10)}`,
					message: "OTP sent successfully to Aadhaar-linked mobile",
					otpSent: true,
					maskedMobile: "XXXXXX9876",
					expiresAt: new Date(Date.now() + 10 * 60 * 1000),
				};
			}

			// Real API call to AuthBridge
			const response = await axios.post(
				`${this.baseUrl}${AuthBridgeESignService.ESIGN_INITIATE}`,
				{
					transaction_id: transactionId,
					aadhaar_number: request.aadhaarNumber,
					full_name: request.fullName,
					document_hash: request.documentHash,
					document_type: request.documentType,
					document_name: request.documentName,
					callback_url: request.callbackUrl,
				},
				{
					headers: {
						"Content-Type": "application/json",
						"X-API-Key": this.apiKey,
						"X-Client-ID": this.clientId,
						Authorization: `Bearer ${this.clientSecret}`,
					},
					timeout: 30000,
				},
			);

			const data = response.data;

			// Update request status
			await db
				.update(esignRequests)
				.set({
					status: data.status === "otp_sent" ? "otp_sent" : "failed",
					apiResponse: data,
				} as any)
				.where(eq(esignRequests.transactionId, transactionId));

			return {
				success: data.status === "otp_sent",
				transactionId,
				requestId: data.request_id,
				message: data.message || "OTP sent to Aadhaar-linked mobile",
				otpSent: data.otp_sent,
				maskedMobile: data.masked_mobile,
				expiresAt: new Date(Date.now() + 10 * 60 * 1000),
			};
		} catch (error) {
			console.error("[TruthScreen eSign] Initiate error:", error);

			// Update request as failed
			await db
				.update(esignRequests)
				.set({
					status: "failed",
					errorMessage: (error as Error).message,
				} as any)
				.where(eq(esignRequests.transactionId, transactionId));

			if (error instanceof AxiosError) {
				throw new AppError(
					error.response?.data?.message || "Failed to initiate eSign",
					error.response?.status || 500,
					"ESIGN_INITIATE_FAILED",
				);
			}
			throw error;
		}
	}

	/**
	 * Verify OTP and complete eSign
	 */
	async verifyESign(request: ESignVerifyRequest): Promise<ESignVerifyResponse> {
		try {
			// Get the pending request
			const [esignRequest] = (await db
				.select()
				.from(esignRequests)
				.where(eq(esignRequests.transactionId, request.transactionId))
				.limit(1)) as any[];

			if (!esignRequest) {
				throw new AppError("eSign request not found", 404, "ESIGN_NOT_FOUND");
			}

			if (esignRequest.status === "completed") {
				throw new AppError(
					"eSign already completed",
					400,
					"ESIGN_ALREADY_COMPLETED",
				);
			}

			if (
				esignRequest.status === "failed" ||
				esignRequest.status === "expired"
			) {
				throw new AppError(
					"eSign request expired or failed",
					400,
					"ESIGN_EXPIRED",
				);
			}

			// Check expiry
			if (
				esignRequest.expiresAt &&
				new Date() > new Date(esignRequest.expiresAt)
			) {
				await db
					.update(esignRequests)
					.set({ status: "expired" } as any)
					.where(eq(esignRequests.transactionId, request.transactionId));
				throw new AppError("eSign request expired", 400, "ESIGN_EXPIRED");
			}

			if (this.isInMockMode()) {
				// Mock verification - accept any 6-digit OTP
				if (request.otp.length !== 6 || !/^\d+$/.test(request.otp)) {
					throw new AppError("Invalid OTP format", 400, "INVALID_OTP");
				}

				const certificateId = `CERT-${nanoid(12)}`;
				const signedAt = new Date();

				// Create certificate record
				await db.insert(esignCertificates).values({
					id: nanoid(),
					userId: esignRequest.userId,
					transactionId: request.transactionId,
					documentType: esignRequest.documentType,
					documentName: esignRequest.documentName,
					documentHash: esignRequest.documentHash,
					signedDocumentUrl: `/api/esign/download/${request.transactionId}`,
					certificateSerial: certificateId,
					signerName: esignRequest.signerName,
					signerAadhaarMasked: esignRequest.aadhaarMasked,
					signedAt,
					validFrom: signedAt,
					validTo: new Date(signedAt.getTime() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
					signatureAlgorithm: "SHA256withRSA",
					status: "valid",
				});

				// Update request as completed
				await db
					.update(esignRequests)
					.set({
						status: "completed",
						completedAt: signedAt,
						certificateId,
					} as any)
					.where(eq(esignRequests.transactionId, request.transactionId));

				return {
					success: true,
					message: "Document signed successfully",
					signedDocumentUrl: `/api/esign/download/${request.transactionId}`,
					certificateId,
					signatureData: {
						signedAt,
						signerName: esignRequest.signerName,
						signerAadhaar: esignRequest.aadhaarMasked,
						certificateSerial: certificateId,
						signatureAlgorithm: "SHA256withRSA",
						validFrom: signedAt,
						validTo: new Date(signedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
					},
				};
			}

			// Real API call to AuthBridge
			const response = await axios.post(
				`${this.baseUrl}${AuthBridgeESignService.ESIGN_VERIFY}`,
				{
					transaction_id: request.transactionId,
					otp: request.otp,
				},
				{
					headers: {
						"Content-Type": "application/json",
						"X-API-Key": this.apiKey,
						"X-Client-ID": this.clientId,
						Authorization: `Bearer ${this.clientSecret}`,
					},
					timeout: 30000,
				},
			);

			const data = response.data;

			if (data.status === "signed") {
				const certificateId = data.certificate_id;
				const signedAt = new Date(data.signed_at);

				// Create certificate record
				await db.insert(esignCertificates).values({
					id: nanoid(),
					userId: esignRequest.userId,
					transactionId: request.transactionId,
					documentType: esignRequest.documentType,
					documentName: esignRequest.documentName,
					documentHash: esignRequest.documentHash,
					signedDocumentUrl: data.signed_document_url,
					certificateSerial: certificateId,
					signerName: data.signer_name,
					signerAadhaarMasked: esignRequest.aadhaarMasked,
					signedAt,
					validFrom: new Date(data.valid_from),
					validTo: new Date(data.valid_to),
					signatureAlgorithm: data.signature_algorithm || "SHA256withRSA",
					status: "valid",
				});

				// Update request as completed
				await db
					.update(esignRequests)
					.set({
						status: "completed",
						completedAt: signedAt,
						certificateId,
					} as any)
					.where(eq(esignRequests.transactionId, request.transactionId));

				return {
					success: true,
					message: "Document signed successfully",
					signedDocumentUrl: data.signed_document_url,
					certificateId,
					signatureData: {
						signedAt,
						signerName: data.signer_name,
						signerAadhaar: esignRequest.aadhaarMasked,
						certificateSerial: certificateId,
						signatureAlgorithm: data.signature_algorithm || "SHA256withRSA",
						validFrom: new Date(data.valid_from),
						validTo: new Date(data.valid_to),
					},
				};
			}
			// OTP verification failed
			await db
				.update(esignRequests)
				.set({
					status: "otp_failed",
					errorMessage: data.message || "OTP verification failed",
				} as any)
				.where(eq(esignRequests.transactionId, request.transactionId));

			return {
				success: false,
				message: data.message || "OTP verification failed",
			};
		} catch (error) {
			console.error("[TruthScreen eSign] Verify error:", error);

			if (error instanceof AppError) throw error;

			if (error instanceof AxiosError) {
				throw new AppError(
					error.response?.data?.message || "Failed to verify eSign OTP",
					error.response?.status || 500,
					"ESIGN_VERIFY_FAILED",
				);
			}
			throw error;
		}
	}

	/**
	 * Resend OTP for pending eSign request
	 */
	async resendOTP(
		transactionId: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			const [esignRequest] = (await db
				.select()
				.from(esignRequests)
				.where(eq(esignRequests.transactionId, transactionId))
				.limit(1)) as any[];

			if (!esignRequest) {
				throw new AppError("eSign request not found", 404, "ESIGN_NOT_FOUND");
			}

			if (esignRequest.status === "completed") {
				throw new AppError(
					"eSign already completed",
					400,
					"ESIGN_ALREADY_COMPLETED",
				);
			}

			if (this.isInMockMode()) {
				// Update OTP sent timestamp
				await db
					.update(esignRequests)
					.set({
						otpSentAt: new Date(),
						expiresAt: new Date(Date.now() + 10 * 60 * 1000),
						status: "otp_sent",
					} as any)
					.where(eq(esignRequests.transactionId, transactionId));

				return {
					success: true,
					message: "OTP resent successfully to Aadhaar-linked mobile",
				};
			}

			const response = await axios.post(
				`${this.baseUrl}${AuthBridgeESignService.ESIGN_RESEND_OTP}`,
				{ transaction_id: transactionId },
				{
					headers: {
						"Content-Type": "application/json",
						"X-API-Key": this.apiKey,
						"X-Client-ID": this.clientId,
						Authorization: `Bearer ${this.clientSecret}`,
					},
					timeout: 30000,
				},
			);

			await db
				.update(esignRequests)
				.set({
					otpSentAt: new Date(),
					expiresAt: new Date(Date.now() + 10 * 60 * 1000),
					status: "otp_sent",
				} as any)
				.where(eq(esignRequests.transactionId, transactionId));

			return {
				success: response.data.status === "success",
				message: response.data.message || "OTP resent successfully",
			};
		} catch (error) {
			console.error("[TruthScreen eSign] Resend OTP error:", error);
			if (error instanceof AppError) throw error;
			throw new AppError("Failed to resend OTP", 500, "ESIGN_RESEND_FAILED");
		}
	}

	/**
	 * Get eSign request status
	 */
	async getStatus(transactionId: string): Promise<{
		status: string;
		documentName: string;
		signerName: string;
		initiatedAt: Date;
		completedAt?: Date;
		certificateId?: string;
	}> {
		const [esignRequest] = (await db
			.select()
			.from(esignRequests)
			.where(eq(esignRequests.transactionId, transactionId))
			.limit(1)) as any[];

		if (!esignRequest) {
			throw new AppError("eSign request not found", 404, "ESIGN_NOT_FOUND");
		}

		return {
			status: esignRequest.status,
			documentName: esignRequest.documentName,
			signerName: esignRequest.signerName,
			initiatedAt: esignRequest.createdAt!,
			completedAt: esignRequest.completedAt || undefined,
			certificateId: esignRequest.certificateId || undefined,
		};
	}

	/**
	 * Get user's eSign certificates
	 */
	async getUserCertificates(userId: string): Promise<ESignCertificate[]> {
		const certificates = await db
			.select()
			.from(esignCertificates)
			.where(eq(esignCertificates.userId, userId))
			.orderBy(desc(esignCertificates.signedAt));

		return certificates.map((cert) => ({
			id: cert.id,
			userId: cert.userId,
			transactionId: cert.transactionId,
			documentType: cert.documentType,
			documentName: cert.documentName,
			documentHash: cert.documentHash,
			signedDocumentUrl: cert.signedDocumentUrl || "",
			certificateSerial: cert.certificateSerial,
			signerName: cert.signerName,
			signerAadhaarMasked: cert.signerAadhaarMasked,
			signedAt: cert.signedAt,
			validFrom: cert.validFrom,
			validTo: cert.validTo,
			signatureAlgorithm: cert.signatureAlgorithm || "SHA256withRSA",
			status: cert.status as "valid" | "expired" | "revoked",
		})) as any;
	}

	/**
	 * Verify a signed document certificate
	 */
	async verifyCertificate(certificateSerial: string): Promise<{
		valid: boolean;
		certificate?: ESignCertificate;
		message: string;
	}> {
		const [cert] = await db
			.select()
			.from(esignCertificates)
			.where(eq(esignCertificates.certificateSerial, certificateSerial))
			.limit(1);

		if (!cert) {
			return { valid: false, message: "Certificate not found" };
		}

		const now = new Date();
		if (now > cert.validTo) {
			return {
				valid: false,
				certificate: cert as unknown as ESignCertificate,
				message: "Certificate has expired",
			};
		}

		if (cert.status === "revoked") {
			return {
				valid: false,
				certificate: cert as unknown as ESignCertificate,
				message: "Certificate has been revoked",
			};
		}

		return {
			valid: true,
			certificate: cert as unknown as ESignCertificate,
			message: "Certificate is valid",
		};
	}
}

export const authBridgeESignService = new AuthBridgeESignService();
export default authBridgeESignService;
