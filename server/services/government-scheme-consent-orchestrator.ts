/**
 * Government Scheme Consent Orchestrator
 *
 * Manages OTP-based consent collection for fetching data from government sources:
 * - EPFO (EPF/EPS)
 * - NSDL CRA (NPS)
 * - PFRDA (APY)
 *
 * Implements PMLA/RBI compliant audit logging with retention policy
 * All data is persisted to database for compliance and reliability
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc, sql, gt, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { governmentSchemeDataFetcher } from "./government-scheme-data-fetcher";

export type SchemeType = "epf" | "eps" | "ppf" | "nps" | "apy" | "insurance";
export type ConsentStatus = "pending" | "verified" | "expired" | "revoked";
export type OTPChannel = "mobile" | "aadhaar" | "email";

const RETENTION_PERIOD_YEARS = 8;
const CONSENT_EXPIRY_DAYS = 365;
const OTP_EXPIRY_MINUTES = 10;
const OTP_LENGTH = 6;

const SCHEME_PURPOSES: Record<SchemeType, string> = {
	epf: "Employee Provident Fund balance and contribution history retrieval from EPFO",
	eps: "Employee Pension Scheme details and eligibility retrieval from EPFO",
	ppf: "Public Provident Fund account details retrieval from Post Office/Bank",
	nps: "National Pension System account balance and holdings retrieval from NSDL CRA",
	apy: "Atal Pension Yojana account and contribution details retrieval from PFRDA",
	insurance:
		"Insurance policy details retrieval from insurance providers via Turtlefin",
};

const SCHEME_SCOPES: Record<SchemeType, string[]> = {
	epf: [
		"account_number",
		"uan",
		"employer_name",
		"balance",
		"contributions",
		"interest",
		"nominee_details",
	],
	eps: [
		"account_number",
		"employer_history",
		"pensionable_service",
		"expected_pension",
		"nominee_details",
	],
	ppf: [
		"account_number",
		"bank_details",
		"balance",
		"deposits",
		"interest",
		"maturity",
		"nominee_details",
	],
	nps: [
		"pran",
		"tier1_balance",
		"tier2_balance",
		"asset_allocation",
		"fund_manager",
		"contributions",
		"returns",
		"nominee_details",
	],
	apy: [
		"pran",
		"pension_amount",
		"monthly_contribution",
		"bank_details",
		"maturity_details",
		"government_contribution",
		"nominee_details",
	],
	insurance: [
		"policy_number",
		"policy_type",
		"insurer",
		"sum_assured",
		"premium",
		"maturity_date",
		"status",
		"nominee_details",
	],
};

interface OTPRequest {
	userId: string;
	schemeType: SchemeType;
	channel: OTPChannel;
	mobile?: string;
	email?: string;
	ipAddress?: string;
	userAgent?: string;
}

interface OTPVerification {
	userId: string;
	schemeType: SchemeType;
	challengeId: string;
	otp: string;
	ipAddress?: string;
	userAgent?: string;
}

class GovernmentSchemeConsentOrchestrator {
	generateOTP(): string {
		return crypto.randomInt(100000, 999999).toString();
	}

	private hashOTP(otp: string): string {
		return crypto.createHash("sha256").update(otp).digest("hex");
	}

	private generateChecksum(data: any): string {
		return crypto
			.createHash("sha256")
			.update(JSON.stringify(data))
			.digest("hex");
	}

	async initiateConsent(request: OTPRequest): Promise<{
		success: boolean;
		challengeId: string;
		expiresAt: Date;
		message: string;
	}> {
		const existingConsents = await db
			.select()
			.from(schema.schemeConsents)
			.where(
				and(
					eq(schema.schemeConsents.userId, request.userId),
					eq(schema.schemeConsents.schemeType, request.schemeType),
				),
			)
			.limit(1);

		const existingConsent = existingConsents[0];

		if (existingConsent && existingConsent.status === "verified") {
			const consentExpiry = new Date(
				existingConsent.consentTimestamp ||
					existingConsent.verifiedAt ||
					new Date(),
			);
			consentExpiry.setFullYear(
				consentExpiry.getFullYear() + RETENTION_PERIOD_YEARS,
			);

			if (new Date() < consentExpiry) {
				return {
					success: true,
					challengeId: existingConsent.challengeId,
					expiresAt: consentExpiry,
					message:
						"Consent already granted for this scheme. Data access authorized.",
				};
			}
		}

		const challengeId = uuidv4();
		const otp = this.generateOTP();
		const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

		try {
			if (existingConsent) {
				await db
					.update(schema.schemeConsents)
					.set({
						challengeId,
						otpHash: this.hashOTP(otp),
						otpChannel: request.channel,
						status: "pending",
						expiresAt,
						ipAddress: request.ipAddress,
						userAgent: request.userAgent,
						updatedAt: new Date(),
					})
					.where(eq(schema.schemeConsents.id, existingConsent.id));

				console.log(
					`[SCHEME_CONSENT] Updated existing consent record for ${request.schemeType}`,
				);
			} else {
				await db.insert(schema.schemeConsents).values({
					id: challengeId,
					userId: request.userId,
					schemeType: request.schemeType,
					purpose: SCHEME_PURPOSES[request.schemeType],
					scope: SCHEME_SCOPES[request.schemeType],
					otpChannel: request.channel,
					challengeId,
					otpHash: this.hashOTP(otp),
					status: "pending",
					expiresAt,
					ipAddress: request.ipAddress,
					userAgent: request.userAgent,
					retentionPeriodYears: RETENTION_PERIOD_YEARS,
				});

				console.log(
					`[SCHEME_CONSENT] Created new consent record for ${request.schemeType}`,
				);
			}
		} catch (error) {
			console.error(
				"[SCHEME_CONSENT] Failed to create/update consent record:",
				error,
			);
			throw new Error("Failed to initiate consent");
		}

		await this.logAuditEvent({
			userId: request.userId,
			schemeType: request.schemeType,
			eventType: "consent_initiated",
			requestId: challengeId,
			ipAddress: request.ipAddress,
			userAgent: request.userAgent,
			details: {
				channel: request.channel,
				purpose: SCHEME_PURPOSES[request.schemeType],
				scope: SCHEME_SCOPES[request.schemeType],
			},
		});

		if (request.channel === "mobile" && request.mobile) {
			await this.sendOTPViaSMS(request.mobile, otp);
		} else if (request.channel === "email" && request.email) {
			await this.sendOTPViaEmail(request.email, otp);
		}

		await this.logAuditEvent({
			userId: request.userId,
			schemeType: request.schemeType,
			eventType: "otp_sent",
			requestId: challengeId,
			ipAddress: request.ipAddress,
			details: {
				channel: request.channel,
				destination: request.mobile
					? `XXXXXX${request.mobile.slice(-4)}`
					: request.email
						? `${request.email.slice(0, 3)}***`
						: "registered",
			},
		});

		return {
			success: true,
			challengeId,
			expiresAt,
			message: `OTP sent to your registered ${request.channel}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
		};
	}

	async verifyOTPAndGrantConsent(verification: OTPVerification): Promise<{
		success: boolean;
		consentId?: string;
		message: string;
		consentExpiresAt?: Date;
		dataFetched?: {
			recordsCreated: number;
			recordsUpdated: number;
		};
	}> {
		const consents = await db
			.select()
			.from(schema.schemeConsents)
			.where(eq(schema.schemeConsents.challengeId, verification.challengeId))
			.limit(1);

		const consent = consents[0];

		if (!consent) {
			return {
				success: false,
				message: "Invalid or expired challenge. Please request a new OTP.",
			};
		}

		if (consent.userId !== verification.userId) {
			return {
				success: false,
				message: "Unauthorized consent verification attempt.",
			};
		}

		if (consent.status !== "pending") {
			return {
				success: false,
				message: `Consent is already ${consent.status}. Please request a new OTP.`,
			};
		}

		if (new Date() > consent.expiresAt) {
			await db
				.update(schema.schemeConsents)
				.set({ status: "expired" })
				.where(eq(schema.schemeConsents.id, consent.id));
			return {
				success: false,
				message: "OTP has expired. Please request a new one.",
			};
		}

		// Dev mode bypass: accept "123456" as valid OTP in development
		const isDevMode = process.env.NODE_ENV !== "production";
		const isDevOtp = verification.otp === "123456";

		const providedHash = this.hashOTP(verification.otp);
		const otpValid =
			(isDevMode && isDevOtp) || providedHash === consent.otpHash;

		if (!otpValid) {
			return { success: false, message: "Invalid OTP. Please try again." };
		}

		if (isDevMode && isDevOtp) {
			console.log(
				`🔧 [DEV_MODE] Accepted dev OTP for ${consent.schemeType} consent`,
			);
		}

		const consentExpiresAt = new Date(
			Date.now() + CONSENT_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
		);
		const now = new Date();

		await db
			.update(schema.schemeConsents)
			.set({
				status: "verified",
				verifiedAt: now,
				consentTimestamp: now,
				expiresAt: consentExpiresAt,
			})
			.where(eq(schema.schemeConsents.id, consent.id));

		await this.logAuditEvent({
			userId: verification.userId,
			schemeType: consent.schemeType as SchemeType,
			eventType: "otp_verified",
			requestId: verification.challengeId,
			ipAddress: verification.ipAddress,
			userAgent: verification.userAgent,
			details: { verificationTime: now },
		});

		await this.logAuditEvent({
			userId: verification.userId,
			schemeType: consent.schemeType as SchemeType,
			eventType: "consent_granted",
			requestId: verification.challengeId,
			ipAddress: verification.ipAddress,
			userAgent: verification.userAgent,
			details: {
				purpose: consent.purpose,
				scope: consent.scope,
				retentionPeriodYears: consent.retentionPeriodYears,
				expiresAt: consentExpiresAt,
			},
		});

		// Fetch user profile data for API calls
		const userProfiles = await db
			.select()
			.from(schema.users)
			.where(eq(schema.users.id, verification.userId))
			.limit(1);

		const userProfile = userProfiles[0];

		let dataFetched = { recordsCreated: 0, recordsUpdated: 0 };

		if (userProfile?.panNumber) {
			// Trigger data fetching from government APIs
			console.log(
				`🔄 [CONSENT] Triggering ${consent.schemeType} data fetch after OTP verification`,
			);

			const fullName = [
				userProfile.firstName,
				userProfile.middleName,
				userProfile.lastName,
			]
				.filter(Boolean)
				.join(" ");

			try {
				const fetchResult = await governmentSchemeDataFetcher.fetchSchemeData({
					userId: verification.userId,
					schemeType: consent.schemeType as SchemeType,
					panNumber: userProfile.panNumber,
					name: fullName || "",
					dateOfBirth: userProfile.dateOfBirth || "",
					mobile: userProfile.mobile || undefined,
					email: userProfile.email || undefined,
					consentId: consent.id,
				});

				dataFetched = {
					recordsCreated: fetchResult.recordsCreated,
					recordsUpdated: fetchResult.recordsUpdated,
				};

				// Log data fetch audit event
				await this.logAuditEvent({
					userId: verification.userId,
					schemeType: consent.schemeType as SchemeType,
					eventType: "data_fetched",
					requestId: verification.challengeId,
					ipAddress: verification.ipAddress,
					details: {
						success: fetchResult.success,
						recordsCreated: fetchResult.recordsCreated,
						recordsUpdated: fetchResult.recordsUpdated,
						message: fetchResult.message,
					},
				});

				console.log(
					`✅ [CONSENT] Data fetch complete: ${fetchResult.recordsCreated} created, ${fetchResult.recordsUpdated} updated`,
				);
			} catch (fetchError) {
				console.error(`❌ [CONSENT] Data fetch failed:`, fetchError);
				// Don't fail the consent - data can be re-fetched later
			}
		} else {
			console.warn(
				`⚠️ [CONSENT] No KYC profile found for user ${verification.userId} - data fetch skipped`,
			);
		}

		return {
			success: true,
			consentId: consent.id,
			message:
				dataFetched.recordsCreated > 0 || dataFetched.recordsUpdated > 0
					? `Consent granted and ${dataFetched.recordsCreated + dataFetched.recordsUpdated} record(s) fetched from government sources.`
					: "Consent granted successfully. Data will be fetched from government sources.",
			consentExpiresAt,
			dataFetched,
		};
	}

	async hasActiveConsent(
		userId: string,
		schemeType: SchemeType,
	): Promise<{
		hasConsent: boolean;
		consent?: any;
	}> {
		const now = new Date();

		const consents = await db
			.select()
			.from(schema.schemeConsents)
			.where(
				and(
					eq(schema.schemeConsents.userId, userId),
					eq(schema.schemeConsents.schemeType, schemeType),
					eq(schema.schemeConsents.status, "verified"),
					gt(schema.schemeConsents.expiresAt, now),
				),
			)
			.orderBy(desc(schema.schemeConsents.consentTimestamp))
			.limit(1);

		if (consents.length === 0) {
			return { hasConsent: false };
		}

		return {
			hasConsent: true,
			consent: {
				userId: consents[0].userId,
				schemeType: consents[0].schemeType,
				isActive: true,
				consentGrantedAt: consents[0].consentTimestamp,
				expiresAt: consents[0].expiresAt,
			},
		};
	}

	async revokeConsent(
		userId: string,
		schemeType: SchemeType,
		reason?: string,
		ipAddress?: string,
	): Promise<{
		success: boolean;
		message: string;
	}> {
		const consents = await db
			.select()
			.from(schema.schemeConsents)
			.where(
				and(
					eq(schema.schemeConsents.userId, userId),
					eq(schema.schemeConsents.schemeType, schemeType),
					eq(schema.schemeConsents.status, "verified"),
				),
			);

		if (consents.length === 0) {
			return { success: false, message: "No consent found to revoke." };
		}

		for (const consent of consents) {
			await db
				.update(schema.schemeConsents)
				.set({
					status: "revoked",
					revokedAt: new Date(),
				})
				.where(eq(schema.schemeConsents.id, consent.id));
		}

		await this.logAuditEvent({
			userId,
			schemeType,
			eventType: "consent_revoked",
			requestId: uuidv4(),
			ipAddress,
			details: { reason: reason || "User requested revocation" },
		});

		return {
			success: true,
			message:
				"Consent revoked successfully. Your data will be retained as per regulatory requirements.",
		};
	}

	async recordDataFetch(
		userId: string,
		schemeType: SchemeType,
		data: any,
		providerTraceId?: string,
		ipAddress?: string,
	): Promise<void> {
		await this.logAuditEvent({
			userId,
			schemeType,
			eventType: "data_fetched",
			requestId: uuidv4(),
			providerTraceId,
			dataChecksum: this.generateChecksum(data),
			ipAddress,
			details: {
				recordCount: Array.isArray(data) ? data.length : 1,
				fetchTimestamp: new Date().toISOString(),
			},
		});
	}

	async recordDataAccess(
		userId: string,
		schemeType: SchemeType,
		accessType: "view" | "export" | "api",
		ipAddress?: string,
	): Promise<void> {
		await this.logAuditEvent({
			userId,
			schemeType,
			eventType: "data_accessed",
			requestId: uuidv4(),
			ipAddress,
			details: { accessType },
		});
	}

	private async logAuditEvent(event: {
		userId: string;
		schemeType: SchemeType;
		eventType: string;
		requestId: string;
		ipAddress?: string;
		userAgent?: string;
		providerTraceId?: string;
		dataChecksum?: string;
		details?: any;
	}): Promise<void> {
		const retentionExpiresAt = new Date(
			Date.now() + RETENTION_PERIOD_YEARS * 365 * 24 * 60 * 60 * 1000,
		);

		try {
			await db.insert(schema.governmentSchemeAudit).values({
				id: uuidv4(),
				userId: event.userId,
				schemeType: event.schemeType,
				eventType: event.eventType,
				requestId: event.requestId,
				ipAddress: event.ipAddress,
				userAgent: event.userAgent,
				providerTraceId: event.providerTraceId,
				dataChecksum: event.dataChecksum,
				details: event.details,
				retentionExpiresAt,
			});
		} catch (error) {
			console.error("[SCHEME_AUDIT] Failed to log audit event:", error);
		}

		console.log(
			`[SCHEME_AUDIT] ${event.eventType}: ${event.schemeType} for user ${event.userId.substring(0, 8)}...`,
		);
	}

	async getAuditLog(
		userId: string,
		schemeType?: SchemeType,
		limit = 50,
	): Promise<any[]> {
		let query = db
			.select()
			.from(schema.governmentSchemeAudit)
			.where(eq(schema.governmentSchemeAudit.userId, userId));

		if (schemeType) {
			query = db
				.select()
				.from(schema.governmentSchemeAudit)
				.where(
					and(
						eq(schema.governmentSchemeAudit.userId, userId),
						eq(schema.governmentSchemeAudit.schemeType, schemeType),
					),
				);
		}

		const results = await query
			.orderBy(desc(schema.governmentSchemeAudit.timestamp))
			.limit(limit);

		return results;
	}

	async cleanupExpiredRecords(): Promise<{ removedCount: number }> {
		const now = new Date();

		const expiredRecords = await db
			.select({ id: schema.governmentSchemeAudit.id })
			.from(schema.governmentSchemeAudit)
			.where(lt(schema.governmentSchemeAudit.retentionExpiresAt, now));

		const removedCount = expiredRecords.length;

		if (removedCount > 0) {
			await db
				.delete(schema.governmentSchemeAudit)
				.where(lt(schema.governmentSchemeAudit.retentionExpiresAt, now));
			console.log(
				`[SCHEME_AUDIT] Cleaned up ${removedCount} expired audit records`,
			);
		}

		return { removedCount };
	}

	async getConsentStatus(userId: string): Promise<
		Record<
			SchemeType,
			{
				hasConsent: boolean;
				grantedAt?: Date;
				expiresAt?: Date;
				lastRefreshAt?: Date;
			}
		>
	> {
		const schemes: SchemeType[] = [
			"epf",
			"eps",
			"ppf",
			"nps",
			"apy",
			"insurance",
		];
		const status: Record<string, any> = {};

		for (const scheme of schemes) {
			const { hasConsent, consent } = await this.hasActiveConsent(
				userId,
				scheme,
			);
			status[scheme] = {
				hasConsent,
				grantedAt: consent?.consentGrantedAt,
				expiresAt: consent?.expiresAt,
			};
		}

		return status as any;
	}

	private async sendOTPViaSMS(mobile: string, otp: string): Promise<void> {
		const maskedMobile = `${mobile.slice(0, 2)}XXXXXX${mobile.slice(-2)}`;
		try {
			const { smsService } = await import("./sms-service");
			const sent = await smsService.sendOTP(mobile, otp);
			if (sent) {
				console.log(`📱 [SMS] OTP sent successfully to ${maskedMobile}`);
			} else {
				console.log(
					`📱 [SMS] Development mode: OTP logged for ${maskedMobile} (Twilio not configured)`,
				);
			}
		} catch (error) {
			console.error(
				`📱 [SMS] Failed to send OTP to ${maskedMobile}:`,
				error instanceof Error ? error.message : "Unknown error",
			);
			console.log(
				`📱 [SMS] Development mode: OTP delivery simulated for ${maskedMobile}`,
			);
		}
	}

	private async sendOTPViaEmail(email: string, otp: string): Promise<void> {
		const maskedEmail = `${email.slice(0, 3)}***@***`;
		try {
			const { emailService } = await import("../email-service");
			const sent = await emailService.sendEmail({
				to: email,
				subject: "FintekPro - Government Scheme Access Verification",
				html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Government Scheme Access Verification</h2>
            <p>Your verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; padding: 20px; background: #f5f5f5; text-align: center; letter-spacing: 8px;">
              ${otp}
            </div>
            <p>This code is valid for ${OTP_EXPIRY_MINUTES} minutes.</p>
            <p><strong>Do not share this code with anyone.</strong></p>
            <p>If you did not request this code, please ignore this email.</p>
          </div>
        `,
				text: `Your FintekPro verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes.`,
			});
			if (sent) {
				console.log(`📧 [EMAIL] OTP sent successfully to ${maskedEmail}`);
			} else {
				console.log(
					`📧 [EMAIL] Development mode: OTP simulated for ${maskedEmail} (Email not configured)`,
				);
			}
		} catch (error) {
			console.error(
				`📧 [EMAIL] Failed to send OTP to ${maskedEmail}:`,
				error instanceof Error ? error.message : "Unknown error",
			);
			console.log(
				`📧 [EMAIL] Development mode: OTP delivery simulated for ${maskedEmail}`,
			);
		}
	}
}

export const governmentSchemeConsentOrchestrator =
	new GovernmentSchemeConsentOrchestrator();
