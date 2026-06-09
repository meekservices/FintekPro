import crypto from "crypto";
import { db } from "../db";
import { eq } from "drizzle-orm";
import {
	identityProfiles,
	productConfigurations,
	type IdentityProfile,
} from "@shared/schema";

const LOG_PREFIX = "[IDENTITY-TOKEN]";

const KYC_LEVELS = ["NONE", "BASIC", "FULL", "ENHANCED"] as const;

class IdentityTokenService {
	async getOrCreateProfile(userId: string): Promise<IdentityProfile> {
		try {
			const existing = await db
				.select()
				.from(identityProfiles)
				.where(eq(identityProfiles.userId, userId))
				.limit(1);

			if (existing.length > 0) {
				console.log(`${LOG_PREFIX} Found existing profile for user ${userId}`);
				return existing[0];
			}

			const identityTokenId = `IDT-${crypto.randomUUID()}`;

			const [newProfile] = await db
				.insert(identityProfiles)
				.values({
					userId,
					identityTokenId,
					kycLevel: "NONE",
					overallStatus: "PENDING",
				})
				.returning();

			console.log(
				`${LOG_PREFIX} Created new identity profile for user ${userId} with token ${identityTokenId}`,
			);
			return newProfile;
		} catch (error: any) {
			console.error(
				`${LOG_PREFIX} Error in getOrCreateProfile for user ${userId}:`,
				error?.message || error,
			);
			throw error;
		}
	}

	async updateVerificationStatus(
		userId: string,
		verificationType: "pan" | "aadhaar" | "ckyc" | "bank" | "address",
		data: {
			verified: boolean;
			provider: string;
			details?: Record<string, any>;
		},
	): Promise<IdentityProfile> {
		try {
			const now = new Date();
			let updateFields: Record<string, any> = {};

			switch (verificationType) {
				case "pan":
					updateFields = {
						panVerified: data.verified,
						panVerifiedAt: now,
						panProvider: data.provider,
						...(data.details?.panNumber && {
							panNumber: data.details.panNumber,
						}),
					};
					break;
				case "aadhaar":
					updateFields = {
						aadhaarVerified: data.verified,
						aadhaarVerifiedAt: now,
						aadhaarProvider: data.provider,
						...(data.details?.aadhaarLastFour && {
							aadhaarLastFour: data.details.aadhaarLastFour,
						}),
					};
					break;
				case "ckyc":
					updateFields = {
						ckycVerified: data.verified,
						ckycVerifiedAt: now,
						ckycProvider: data.provider,
						...(data.details?.ckycNumber && {
							ckycNumber: data.details.ckycNumber,
						}),
					};
					break;
				case "bank":
					updateFields = {
						bankVerified: data.verified,
						bankVerifiedAt: now,
						bankProvider: data.provider,
					};
					break;
				case "address":
					updateFields = {
						addressVerified: data.verified,
						addressVerifiedAt: now,
						addressProvider: data.provider,
					};
					break;
			}

			updateFields.updatedAt = now;
			updateFields.lastVerifiedAt = now;

			const [updated] = await db
				.update(identityProfiles)
				.set(updateFields)
				.where(eq(identityProfiles.userId, userId))
				.returning();

			if (!updated) {
				throw new Error(`Identity profile not found for user ${userId}`);
			}

			const { level, status } = this.calculateKycLevel(updated);

			const [finalProfile] = await db
				.update(identityProfiles)
				.set({ kycLevel: level, overallStatus: status, updatedAt: new Date() })
				.where(eq(identityProfiles.userId, userId))
				.returning();

			console.log(
				`${LOG_PREFIX} Updated ${verificationType} verification for user ${userId} - KYC level: ${level}, status: ${status}`,
			);
			return finalProfile;
		} catch (error: any) {
			console.error(
				`${LOG_PREFIX} Error updating verification status for user ${userId}:`,
				error?.message || error,
			);
			throw error;
		}
	}

	calculateKycLevel(profile: Partial<IdentityProfile>): {
		level: string;
		status: string;
	} {
		const panVerified = profile.panVerified === true;
		const aadhaarVerified = profile.aadhaarVerified === true;
		const ckycVerified = profile.ckycVerified === true;
		const bankVerified = profile.bankVerified === true;

		let level = "NONE";
		let status = "PENDING";

		if (panVerified && aadhaarVerified && ckycVerified && bankVerified) {
			level = "ENHANCED";
			status = "VERIFIED";
		} else if (panVerified && aadhaarVerified) {
			level = "FULL";
			status = "IN_PROGRESS";
		} else if (panVerified) {
			level = "BASIC";
			status = "IN_PROGRESS";
		} else {
			level = "NONE";
			status = "PENDING";
		}

		return { level, status };
	}

	async declareFatca(userId: string): Promise<void> {
		try {
			await db
				.update(identityProfiles)
				.set({
					fatcaDeclared: true,
					fatcaDeclaredAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(identityProfiles.userId, userId));

			console.log(`${LOG_PREFIX} FATCA declared for user ${userId}`);
		} catch (error: any) {
			console.error(
				`${LOG_PREFIX} Error declaring FATCA for user ${userId}:`,
				error?.message || error,
			);
			throw error;
		}
	}

	async assessRisk(
		userId: string,
		riskData: { category: string; score: number },
	): Promise<void> {
		try {
			await db
				.update(identityProfiles)
				.set({
					riskCategory: riskData.category,
					riskScore: riskData.score,
					riskAssessedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(eq(identityProfiles.userId, userId));

			console.log(
				`${LOG_PREFIX} Risk assessed for user ${userId} - category: ${riskData.category}, score: ${riskData.score}`,
			);
		} catch (error: any) {
			console.error(
				`${LOG_PREFIX} Error assessing risk for user ${userId}:`,
				error?.message || error,
			);
			throw error;
		}
	}

	async getProfileByToken(tokenId: string): Promise<IdentityProfile | null> {
		try {
			const results = await db
				.select()
				.from(identityProfiles)
				.where(eq(identityProfiles.identityTokenId, tokenId))
				.limit(1);

			return results.length > 0 ? results[0] : null;
		} catch (error: any) {
			console.error(
				`${LOG_PREFIX} Error fetching profile by token ${tokenId}:`,
				error?.message || error,
			);
			throw error;
		}
	}

	async checkKycEligibility(
		userId: string,
		productType: string,
	): Promise<{
		eligible: boolean;
		missingSteps: string[];
		currentLevel: string;
		requiredLevel: string;
	}> {
		try {
			const profiles = await db
				.select()
				.from(identityProfiles)
				.where(eq(identityProfiles.userId, userId))
				.limit(1);

			if (profiles.length === 0) {
				return {
					eligible: false,
					missingSteps: ["identity_profile"],
					currentLevel: "NONE",
					requiredLevel: "UNKNOWN",
				};
			}

			const profile = profiles[0];

			const productConfigs = await db
				.select()
				.from(productConfigurations)
				.where(eq(productConfigurations.productCode, productType))
				.limit(1);

			if (productConfigs.length === 0) {
				console.log(
					`${LOG_PREFIX} No product configuration found for ${productType}, defaulting to BASIC`,
				);
				return {
					eligible: profile.kycLevel !== "NONE",
					missingSteps: profile.kycLevel === "NONE" ? ["pan_verification"] : [],
					currentLevel: profile.kycLevel || "NONE",
					requiredLevel: "BASIC",
				};
			}

			const productConfig = productConfigs[0];
			const requiredLevel = productConfig.requiredKycLevel || "BASIC";
			const requiredSteps = (productConfig.requiredKycSteps as string[]) || [];

			const currentLevelIndex = KYC_LEVELS.indexOf(
				(profile.kycLevel || "NONE") as (typeof KYC_LEVELS)[number],
			);
			const requiredLevelIndex = KYC_LEVELS.indexOf(
				requiredLevel as (typeof KYC_LEVELS)[number],
			);

			const missingSteps: string[] = [];

			if (requiredSteps.length > 0) {
				for (const step of requiredSteps) {
					switch (step) {
						case "pan":
							if (!profile.panVerified) missingSteps.push("pan_verification");
							break;
						case "aadhaar":
							if (!profile.aadhaarVerified)
								missingSteps.push("aadhaar_verification");
							break;
						case "ckyc":
							if (!profile.ckycVerified) missingSteps.push("ckyc_verification");
							break;
						case "bank":
							if (!profile.bankVerified) missingSteps.push("bank_verification");
							break;
						case "address":
							if (!profile.addressVerified)
								missingSteps.push("address_verification");
							break;
						case "fatca":
							if (!profile.fatcaDeclared)
								missingSteps.push("fatca_declaration");
							break;
					}
				}
			} else {
				if (requiredLevelIndex >= 1 && !profile.panVerified) {
					missingSteps.push("pan_verification");
				}
				if (requiredLevelIndex >= 2 && !profile.aadhaarVerified) {
					missingSteps.push("aadhaar_verification");
				}
				if (requiredLevelIndex >= 3) {
					if (!profile.ckycVerified) missingSteps.push("ckyc_verification");
					if (!profile.bankVerified) missingSteps.push("bank_verification");
				}
			}

			const eligible =
				currentLevelIndex >= requiredLevelIndex && missingSteps.length === 0;

			console.log(
				`${LOG_PREFIX} KYC eligibility check for user ${userId}, product ${productType}: eligible=${eligible}, missing=${missingSteps.join(",")}`,
			);

			return {
				eligible,
				missingSteps,
				currentLevel: profile.kycLevel || "NONE",
				requiredLevel,
			};
		} catch (error: any) {
			console.error(
				`${LOG_PREFIX} Error checking KYC eligibility for user ${userId}:`,
				error?.message || error,
			);
			throw error;
		}
	}
}

export const identityTokenService = new IdentityTokenService();
