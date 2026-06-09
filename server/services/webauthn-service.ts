// @ts-nocheck
import {
	generateRegistrationOptions,
	verifyRegistrationResponse,
	generateAuthenticationOptions,
	verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
	RegistrationResponseJSON,
	AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { db } from "../db";
import {
	userWebauthnCredentials,
	webauthnChallenges,
	webauthnAuditLog,
} from "../../shared/schema";
import { eq, and, gt, lt } from "drizzle-orm";

const RP_NAME = "FintekPro";
const RP_ID =
	process.env.NODE_ENV === "production" ? "fintekpro.com" : "localhost";
const EXPECTED_ORIGIN =
	process.env.NODE_ENV === "production"
		? ["https://fintekpro.com", "https://www.fintekpro.com"]
		: ["http://localhost:5000", "https://localhost:5000"];
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function iBuffToB64(buf: Uint8Array): string {
	return Buffer.from(buf).toString("base64url");
}

function b64ToIBuff(b64: string): Uint8Array {
	return new Uint8Array(Buffer.from(b64, "base64url"));
}

export interface RiskContext {
	newDevice: boolean;
	geoMismatch: boolean;
	txnAmount?: number;
	inactiveDays?: number;
	failedAttempts?: number;
}

export interface RiskResult {
	score: number;
	factors: Record<string, number>;
	level: "low" | "medium" | "high" | "very_high";
	stepUpRequired: "none" | "biometric" | "biometric_otp";
}

export function calculateRiskScore(ctx: RiskContext): RiskResult {
	const factors: Record<string, number> = {};
	let score = 0;

	if (ctx.newDevice) {
		factors.new_device = 30;
		score += 30;
	}
	if (ctx.geoMismatch) {
		factors.geo_mismatch = 25;
		score += 25;
	}
	if ((ctx.txnAmount ?? 0) > 500000) {
		factors.high_txn_amount = 40;
		score += 40;
	}
	if ((ctx.inactiveDays ?? 0) > 30) {
		factors.inactive_days = 20;
		score += 20;
	}
	if ((ctx.failedAttempts ?? 0) > 3) {
		factors.failed_attempts = 50;
		score += 50;
	}

	let level: RiskResult["level"] = "low";
	let stepUpRequired: RiskResult["stepUpRequired"] = "none";

	if (score >= 70) {
		level = "very_high";
		stepUpRequired = "biometric_otp";
	} else if (score >= 40) {
		level = score >= 55 ? "high" : "medium";
		stepUpRequired = "biometric";
	}

	return { score, factors, level, stepUpRequired };
}

export const webauthnService = {
	async getRegistrationOptions(
		userId: string,
		userEmail: string,
		userName: string,
	) {
		await this.cleanExpiredChallenges();

		const existingCredentials = await db
			.select({ credentialId: userWebauthnCredentials.credentialId })
			.from(userWebauthnCredentials)
			.where(eq(userWebauthnCredentials.userId, userId));

		const options = await generateRegistrationOptions({
			rpName: RP_NAME,
			rpID: RP_ID,
			userName: userEmail,
			userDisplayName: userName,
			timeout: 60000,
			attestationType: "none",
			excludeCredentials: existingCredentials.map((c) => ({
				id: c.credentialId,
				transports: ["internal"] as AuthenticatorTransport[],
			})),
			authenticatorSelection: {
				authenticatorAttachment: "platform",
				userVerification: "required",
				residentKey: "preferred",
			},
		});

		await db.insert(webauthnChallenges).values({
			userId,
			challenge: options.challenge,
			type: "registration",
			expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
		});

		return options;
	},

	async verifyRegistration(
		userId: string,
		response: RegistrationResponseJSON,
		ipAddress?: string,
		userAgent?: string,
	) {
		const [challengeRow] = await db
			.select()
			.from(webauthnChallenges)
			.where(
				and(
					eq(webauthnChallenges.userId, userId),
					eq(webauthnChallenges.type, "registration"),
					gt(webauthnChallenges.expiresAt, new Date()),
				),
			)
			.orderBy(webauthnChallenges.createdAt)
			.limit(1);

		if (!challengeRow) {
			await this.auditLog(
				userId,
				"registration_failure",
				null,
				ipAddress,
				userAgent,
				false,
				"No valid challenge found",
			);
			throw new Error("Challenge expired or not found");
		}

		let verification;
		try {
			verification = await verifyRegistrationResponse({
				response,
				expectedChallenge: challengeRow.challenge,
				expectedOrigin: EXPECTED_ORIGIN,
				expectedRPID: RP_ID,
				requireUserVerification: true,
			});
		} catch (err) {
			await this.auditLog(
				userId,
				"registration_failure",
				null,
				ipAddress,
				userAgent,
				false,
				String(err),
			);
			throw err;
		} finally {
			await db
				.delete(webauthnChallenges)
				.where(eq(webauthnChallenges.id, challengeRow.id));
		}

		if (!verification.verified || !verification.registrationInfo) {
			await this.auditLog(
				userId,
				"registration_failure",
				null,
				ipAddress,
				userAgent,
				false,
				"Verification failed",
			);
			throw new Error("Registration verification failed");
		}

		const { credential, credentialDeviceType, credentialBackedUp, aaguid } =
			verification.registrationInfo;

		const credentialId = iBuffToB64(credential.id as Uint8Array<ArrayBuffer>);
		const publicKey = iBuffToB64(
			credential.publicKey as Uint8Array<ArrayBuffer>,
		);

		const [saved] = await db
			.insert(userWebauthnCredentials)
			.values({
				userId,
				credentialId,
				publicKey,
				signCount: credential.counter,
				deviceType: credentialDeviceType,
				backedUp: credentialBackedUp,
				aaguid: aaguid || null,
				transports: (response.response as any).transports ?? [],
				lastUsedAt: new Date(),
			})
			.returning();

		await this.auditLog(
			userId,
			"registration_success",
			credentialId,
			ipAddress,
			userAgent,
			true,
			null,
			credentialDeviceType ?? undefined,
		);
		return saved;
	},

	async getAuthenticationOptions(userId: string) {
		await this.cleanExpiredChallenges();

		const credentials = await db
			.select()
			.from(userWebauthnCredentials)
			.where(eq(userWebauthnCredentials.userId, userId));

		if (credentials.length === 0) {
			throw new Error("No registered credentials found for this user");
		}

		const options = await generateAuthenticationOptions({
			rpID: RP_ID,
			timeout: 60000,
			allowCredentials: credentials.map((c) => ({
				id: c.credentialId,
				transports: (c.transports as AuthenticatorTransport[]) ?? ["internal"],
			})),
			userVerification: "required",
		});

		await db.insert(webauthnChallenges).values({
			userId,
			challenge: options.challenge,
			type: "authentication",
			expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
		});

		return options;
	},

	async verifyAuthentication(
		userId: string,
		response: AuthenticationResponseJSON,
		ipAddress?: string,
		userAgent?: string,
		riskContext?: Partial<RiskContext>,
	) {
		const [challengeRow] = await db
			.select()
			.from(webauthnChallenges)
			.where(
				and(
					eq(webauthnChallenges.userId, userId),
					eq(webauthnChallenges.type, "authentication"),
					gt(webauthnChallenges.expiresAt, new Date()),
				),
			)
			.orderBy(webauthnChallenges.createdAt)
			.limit(1);

		if (!challengeRow) {
			await this.auditLog(
				userId,
				"auth_failure",
				null,
				ipAddress,
				userAgent,
				false,
				"Challenge expired or not found",
			);
			throw new Error("Challenge expired or not found");
		}

		const credentialIdB64 = response.id;
		const [credential] = await db
			.select()
			.from(userWebauthnCredentials)
			.where(
				and(
					eq(userWebauthnCredentials.credentialId, credentialIdB64),
					eq(userWebauthnCredentials.userId, userId),
				),
			)
			.limit(1);

		if (!credential) {
			await this.auditLog(
				userId,
				"auth_failure",
				credentialIdB64,
				ipAddress,
				userAgent,
				false,
				"Credential not found",
			);
			throw new Error("Credential not found");
		}

		let verification;
		try {
			verification = await verifyAuthenticationResponse({
				response,
				expectedChallenge: challengeRow.challenge,
				expectedOrigin: EXPECTED_ORIGIN,
				expectedRPID: RP_ID,
				credential: {
					id: credential.credentialId,
					publicKey: b64ToIBuff(
						credential.publicKey,
					) as Uint8Array<ArrayBuffer>,
					counter: credential.signCount,
					transports: (credential.transports as AuthenticatorTransport[]) ?? [
						"internal",
					],
				},
				requireUserVerification: true,
			});
		} catch (err) {
			await this.auditLog(
				userId,
				"auth_failure",
				credentialIdB64,
				ipAddress,
				userAgent,
				false,
				String(err),
			);
			throw err;
		} finally {
			await db
				.delete(webauthnChallenges)
				.where(eq(webauthnChallenges.id, challengeRow.id));
		}

		if (!verification.verified) {
			await this.auditLog(
				userId,
				"auth_failure",
				credentialIdB64,
				ipAddress,
				userAgent,
				false,
				"Signature verification failed",
			);
			throw new Error("Authentication verification failed");
		}

		const { newCounter } = verification.authenticationInfo;

		if (newCounter <= credential.signCount && credential.signCount > 0) {
			await this.auditLog(
				userId,
				"replay_blocked",
				credentialIdB64,
				ipAddress,
				userAgent,
				false,
				"Replay attack: counter not incremented",
			);
			throw new Error("Replay attack detected");
		}

		await db
			.update(userWebauthnCredentials)
			.set({
				signCount: newCounter,
				lastUsedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(userWebauthnCredentials.id, credential.id));

		const risk = calculateRiskScore({
			newDevice: false,
			geoMismatch: riskContext?.geoMismatch ?? false,
			txnAmount: riskContext?.txnAmount,
			inactiveDays: riskContext?.inactiveDays,
			failedAttempts: riskContext?.failedAttempts,
		});

		await this.auditLog(
			userId,
			"auth_success",
			credentialIdB64,
			ipAddress,
			userAgent,
			true,
			null,
			credential.deviceType ?? undefined,
			risk.score,
			risk.factors,
			risk.stepUpRequired,
		);

		return { verified: true, risk, credentialId: credentialIdB64 };
	},

	async listCredentials(userId: string) {
		return db
			.select({
				id: userWebauthnCredentials.id,
				credentialId: userWebauthnCredentials.credentialId,
				deviceType: userWebauthnCredentials.deviceType,
				deviceName: userWebauthnCredentials.deviceName,
				backedUp: userWebauthnCredentials.backedUp,
				transports: userWebauthnCredentials.transports,
				lastUsedAt: userWebauthnCredentials.lastUsedAt,
				createdAt: userWebauthnCredentials.createdAt,
			})
			.from(userWebauthnCredentials)
			.where(eq(userWebauthnCredentials.userId, userId));
	},

	async renameCredential(
		userId: string,
		credentialDbId: string,
		deviceName: string,
	) {
		const [updated] = await db
			.update(userWebauthnCredentials)
			.set({ deviceName, updatedAt: new Date() })
			.where(
				and(
					eq(userWebauthnCredentials.id, credentialDbId),
					eq(userWebauthnCredentials.userId, userId),
				),
			)
			.returning();
		return updated;
	},

	async deleteCredential(
		userId: string,
		credentialDbId: string,
		ipAddress?: string,
	) {
		const [deleted] = await db
			.delete(userWebauthnCredentials)
			.where(
				and(
					eq(userWebauthnCredentials.id, credentialDbId),
					eq(userWebauthnCredentials.userId, userId),
				),
			)
			.returning();

		if (deleted) {
			await this.auditLog(
				userId,
				"credential_deleted",
				deleted.credentialId,
				ipAddress,
				undefined,
				true,
				null,
			);
		}
		return deleted;
	},

	async getAuditLog(userId: string, limit = 50) {
		return db
			.select()
			.from(webauthnAuditLog)
			.where(eq(webauthnAuditLog.userId, userId))
			.orderBy(webauthnAuditLog.createdAt)
			.limit(limit);
	},

	async hasCredentials(userId: string): Promise<boolean> {
		const rows = await db
			.select({ id: userWebauthnCredentials.id })
			.from(userWebauthnCredentials)
			.where(eq(userWebauthnCredentials.userId, userId))
			.limit(1);
		return rows.length > 0;
	},

	async cleanExpiredChallenges() {
		await db
			.delete(webauthnChallenges)
			.where(lt(webauthnChallenges.expiresAt, new Date()));
	},

	async auditLog(
		userId: string,
		event: string,
		credentialId: string | null,
		ipAddress?: string,
		userAgent?: string,
		success = true,
		failureReason?: string | null,
		deviceType?: string,
		riskScore?: number,
		riskFactors?: Record<string, number>,
		stepUpRequired?: string,
	) {
		try {
			await db.insert(webauthnAuditLog).values({
				userId,
				event,
				credentialId,
				ipAddress,
				userAgent,
				deviceType,
				riskScore,
				riskFactors,
				stepUpRequired,
				success,
				failureReason,
			});
		} catch (e) {
			console.error("[WebAuthn] Audit log failed:", e);
		}
	},
};

export function requireBiometricStepUp(
	minRiskLevel: "medium" | "high" | "very_high" = "medium",
) {
	return async (req: any, res: any, next: any) => {
		if (!req.user) return res.status(401).json({ error: "Unauthorized" });

		const userId: string = req.user.id;
		const hasCredentials = await webauthnService.hasCredentials(userId);

		if (!hasCredentials) return next();

		const sessionFlag = (req.session as any)?.biometricVerifiedAt;
		const isRecentlyVerified =
			sessionFlag &&
			Date.now() - new Date(sessionFlag).getTime() < 15 * 60 * 1000;

		if (isRecentlyVerified) return next();

		return res.status(403).json({
			error: "step_up_required",
			message: "Biometric verification required for this action",
			stepUp: "biometric",
		});
	};
}
