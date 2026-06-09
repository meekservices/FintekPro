// @ts-nocheck
/**
 * Protean (NSDL) Aadhaar eSign Service
 *
 * Handles Aadhaar-based Digital Signature via Protean (formerly NSDL e-Gov) API
 * Currently in mock mode - ready for real API integration when credentials are available
 *
 * Protean is a government-certified eSign Service Provider (ESP) under CCA India
 * Offers competitive pricing compared to other ESPs
 */

import axios, { AxiosError } from "axios";
import crypto from "crypto";
import { AppError } from "../utils/errors";
import { db } from "../db";
import { esignRequests, esignCertificates } from "@shared/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

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

class ProteanESignService {
	private baseUrl: string;
	private aspId: string;
	private aspSecret: string;
	private licenseKey: string;
	private environment: "sandbox" | "production";

	private static readonly SANDBOX_URL =
		"https://esign.proteantech.in/esign2.1/2.1";
	private static readonly PRODUCTION_URL =
		"https://esign.proteantech.in/esign2.1/2.1";

	private static readonly ESIGN_INITIATE = "/esign-doc";
	private static readonly ESIGN_STATUS = "/esign-status";

	constructor() {
		const explicitEnv = process.env.PROTEAN_ESIGN_ENVIRONMENT;
		if (explicitEnv === "production" || explicitEnv === "PRODUCTION") {
			this.environment = "production";
		} else {
			this.environment = "sandbox";
		}

		this.baseUrl =
			process.env.PROTEAN_ESIGN_BASE_URL ||
			(this.environment === "production"
				? ProteanESignService.PRODUCTION_URL
				: ProteanESignService.SANDBOX_URL);

		this.aspId = process.env.PROTEAN_ASP_ID || "";
		this.aspSecret = process.env.PROTEAN_ASP_SECRET || "";
		this.licenseKey = process.env.PROTEAN_LICENSE_KEY || "";

		if (!this.aspId || !this.aspSecret) {
			console.log(`[Protean eSign] Running in mock mode (no API credentials)`);
			console.log(
				`ℹ️ [Protean eSign] Set PROTEAN_ASP_ID, PROTEAN_ASP_SECRET, PROTEAN_LICENSE_KEY when available`,
			);
		} else {
			console.log(
				`✅ [Protean eSign] Initialized in ${this.environment.toUpperCase()} mode`,
			);
		}
	}

	getEnvironment(): string {
		return this.environment;
	}

	isInMockMode(): boolean {
		return !this.aspId || !this.aspSecret;
	}

	generateDocumentHash(documentContent: Buffer | string): string {
		const content =
			typeof documentContent === "string"
				? Buffer.from(documentContent)
				: documentContent;
		return crypto.createHash("sha256").update(content).digest("hex");
	}

	private maskAadhaar(aadhaar: string): string {
		const cleaned = aadhaar.replace(/\s/g, "");
		if (cleaned.length !== 12) return "XXXX-XXXX-XXXX";
		return `XXXX-XXXX-${cleaned.slice(-4)}`;
	}

	async initiateESign(
		request: ESignInitiateRequest,
	): Promise<ESignInitiateResponse> {
		const transactionId = `PROTEAN-${Date.now()}-${nanoid(8)}`;

		try {
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
				expiresAt: new Date(Date.now() + 10 * 60 * 1000),
				provider: "protean-esign",
			});

			if (this.isInMockMode()) {
				console.log(
					`[Protean eSign] Mock mode - simulating OTP sent for transaction: ${transactionId}`,
				);

				await db
					.update(esignRequests)
					.set({ status: "otp_sent" } as any)
					.where(eq(esignRequests.transactionId, transactionId));

				return {
					success: true,
					transactionId,
					requestId: `PROT-${nanoid(10)}`,
					message:
						"OTP sent successfully to Aadhaar-linked mobile (Protean Mock)",
					otpSent: true,
					maskedMobile: "XXXXXX9876",
					expiresAt: new Date(Date.now() + 10 * 60 * 1000),
				};
			}

			const xmlPayload = this.buildESignXmlRequest(request, transactionId);

			const response = await axios.post(
				`${this.baseUrl}${ProteanESignService.ESIGN_INITIATE}`,
				xmlPayload,
				{
					headers: {
						"Content-Type": "application/xml",
						"asp-id": this.aspId,
						"asp-license-key": this.licenseKey,
					},
					timeout: 30000,
				},
			);

			const responseData = this.parseESignResponse(response.data);

			await db
				.update(esignRequests)
				.set({
					status: responseData.status === "otp_sent" ? "otp_sent" : "failed",
					apiResponse: responseData,
				} as any)
				.where(eq(esignRequests.transactionId, transactionId));

			return {
				success: responseData.status === "otp_sent",
				transactionId,
				requestId: responseData.requestId,
				message: responseData.message || "OTP sent to Aadhaar-linked mobile",
				otpSent: responseData.otpSent,
				maskedMobile: responseData.maskedMobile,
				expiresAt: new Date(Date.now() + 10 * 60 * 1000),
			};
		} catch (error) {
			console.error("[Protean eSign] Initiate error:", error);

			await db
				.update(esignRequests)
				.set({
					status: "failed",
					errorMessage: (error as Error).message,
				} as any)
				.where(eq(esignRequests.transactionId, transactionId));

			if (error instanceof AxiosError) {
				throw new AppError(
					error.response?.data?.message ||
						"Failed to initiate eSign via Protean",
					error.response?.status || 500,
					"PROTEAN_ESIGN_INITIATE_FAILED",
				);
			}
			throw error;
		}
	}

	async verifyESign(request: ESignVerifyRequest): Promise<ESignVerifyResponse> {
		try {
			const [esignRequest] = await db
				.select()
				.from(esignRequests)
				.where(eq(esignRequests.transactionId, request.transactionId))
				.limit(1);

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
				if (request.otp.length !== 6 || !/^\d+$/.test(request.otp)) {
					throw new AppError("Invalid OTP format", 400, "INVALID_OTP");
				}

				const certificateId = `PROT-CERT-${nanoid(12)}`;
				const signedAt = new Date();

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
					validTo: new Date(signedAt.getTime() + 365 * 24 * 60 * 60 * 1000),
					signatureAlgorithm: "SHA256withRSA",
					status: "valid",
					provider: "protean-esign",
				});

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
					message: "Document signed successfully via Protean eSign",
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

			throw new AppError(
				"Real Protean API not yet implemented",
				501,
				"NOT_IMPLEMENTED",
			);
		} catch (error) {
			console.error("[Protean eSign] Verify error:", error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				"Failed to verify eSign OTP",
				500,
				"PROTEAN_ESIGN_VERIFY_FAILED",
			);
		}
	}

	async resendOTP(
		transactionId: string,
	): Promise<{ success: boolean; message: string }> {
		try {
			const [esignRequest] = await db
				.select()
				.from(esignRequests)
				.where(eq(esignRequests.transactionId, transactionId))
				.limit(1);

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
					message: "OTP resent successfully via Protean eSign",
				};
			}

			throw new AppError(
				"Real Protean resend OTP not yet implemented",
				501,
				"NOT_IMPLEMENTED",
			);
		} catch (error) {
			console.error("[Protean eSign] Resend OTP error:", error);
			if (error instanceof AppError) throw error;
			throw new AppError(
				"Failed to resend OTP",
				500,
				"PROTEAN_ESIGN_RESEND_FAILED",
			);
		}
	}

	async getStatus(transactionId: string): Promise<{
		status: string;
		documentName: string;
		signerName: string;
		initiatedAt: Date;
		completedAt?: Date;
		certificateId?: string;
	}> {
		const [esignRequest] = await db
			.select()
			.from(esignRequests)
			.where(eq(esignRequests.transactionId, transactionId))
			.limit(1);

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

	private buildESignXmlRequest(
		request: ESignInitiateRequest,
		transactionId: string,
	): string {
		return `<?xml version="1.0" encoding="UTF-8"?>
<Esign ver="2.1" sc="Y" ts="${new Date().toISOString()}" txn="${transactionId}" 
       ekycIdType="A" aspId="${this.aspId}" AuthMode="1">
  <Docs>
    <InputHash id="1" hashAlgorithm="SHA256" docInfo="${request.documentName}">
      ${request.documentHash}
    </InputHash>
  </Docs>
</Esign>`;
	}

	private parseESignResponse(xmlData: string): any {
		return {
			status: "otp_sent",
			requestId: `PROT-${nanoid(10)}`,
			message: "OTP sent successfully",
			otpSent: true,
			maskedMobile: "XXXXXX9876",
		};
	}
}

export const proteanESignService = new ProteanESignService();
export default proteanESignService;
