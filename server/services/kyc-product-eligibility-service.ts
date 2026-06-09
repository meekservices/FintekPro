import { db } from "../db";
import { kycProductEligibilityRules } from "@shared/schema";
import { eq, and } from "drizzle-orm";

interface UserKycState {
	kycTier: string;
	kycTierStatus: string;
	amlRiskLevel: string | null;
	fatcaSigned: boolean;
	videoKycDone: boolean;
	makerCheckerApproved: boolean;
	femaCompliant: boolean;
}

interface EligibilityResult {
	productCode: string;
	productName: string;
	eligible: boolean;
	locked: boolean;
	reason?: string;
	requiredTier: string;
	requiredTierStatus: string;
	maxAmount: number | null;
	missingConditions: string[];
	regulatoryBasis?: string;
}

class KycProductEligibilityService {
	constructor() {
		console.log("✅ KYC Product Eligibility Service initialized");
	}

	private tierRank(tier: string): number {
		switch (tier) {
			case "basic":
				return 1;
			case "enhanced":
				return 2;
			case "accredited_investor":
				return 3;
			default:
				return 0;
		}
	}

	private tierStatusRank(status: string): number {
		switch (status) {
			case "provisional":
				return 1;
			case "final":
				return 2;
			default:
				return 0;
		}
	}

	private checkConditions(
		conditions: string[],
		userState: UserKycState,
	): string[] {
		const missing: string[] = [];
		for (const cond of conditions) {
			switch (cond) {
				case "AML_OK":
					if (
						!userState.amlRiskLevel ||
						["HIGH", "CRITICAL"].includes(userState.amlRiskLevel)
					) {
						missing.push("AML_OK");
					}
					break;
				case "FATCA_SIGNED":
					if (!userState.fatcaSigned) missing.push("FATCA_SIGNED");
					break;
				case "VIDEO_KYC_DONE":
					if (!userState.videoKycDone) missing.push("VIDEO_KYC_DONE");
					break;
				case "MAKER_CHECKER_APPROVED":
					if (!userState.makerCheckerApproved)
						missing.push("MAKER_CHECKER_APPROVED");
					break;
				case "FEMA_COMPLIANT":
					if (!userState.femaCompliant) missing.push("FEMA_COMPLIANT");
					break;
			}
		}
		return missing;
	}

	async checkEligibility(
		userState: UserKycState,
	): Promise<EligibilityResult[]> {
		try {
			const rules = await db
				.select()
				.from(kycProductEligibilityRules)
				.where(eq(kycProductEligibilityRules.isActive, true));

			return rules.map((rule) => {
				const conditions = (rule.conditions || []) as string[];
				const missingConditions = this.checkConditions(conditions, userState);

				const tierMet =
					this.tierRank(userState.kycTier) >= this.tierRank(rule.requiredTier);
				const statusMet =
					this.tierStatusRank(userState.kycTierStatus) >=
					this.tierStatusRank(rule.requiredTierStatus || "final");

				const amlOk =
					!rule.amlMaxRisk ||
					!userState.amlRiskLevel ||
					this.amlRiskRank(userState.amlRiskLevel) <=
						this.amlRiskRank(rule.amlMaxRisk);

				const eligible =
					tierMet && statusMet && missingConditions.length === 0 && amlOk;

				let reason: string | undefined;
				if (!tierMet) {
					reason = `Requires ${rule.requiredTier} tier (current: ${userState.kycTier})`;
				} else if (!statusMet) {
					reason = `Requires ${rule.requiredTierStatus} tier status (current: ${userState.kycTierStatus})`;
				} else if (!amlOk) {
					reason = `AML risk level too high (${userState.amlRiskLevel}), maximum allowed: ${rule.amlMaxRisk}`;
				} else if (missingConditions.length > 0) {
					reason = `Missing: ${missingConditions.join(", ")}`;
				}

				return {
					productCode: rule.productCode,
					productName: rule.productName,
					eligible,
					locked: !eligible,
					reason,
					requiredTier: rule.requiredTier,
					requiredTierStatus: rule.requiredTierStatus || "final",
					maxAmount: rule.maxAmount ? Number.parseFloat(rule.maxAmount) : null,
					missingConditions,
					regulatoryBasis: rule.regulatoryBasis || undefined,
				};
			});
		} catch (error) {
			console.error("[ProductEligibility] Error checking eligibility:", error);
			return [];
		}
	}

	async checkSingleProduct(
		productCode: string,
		userState: UserKycState,
	): Promise<EligibilityResult | null> {
		const results = await this.checkEligibility(userState);
		return results.find((r) => r.productCode === productCode) || null;
	}

	private amlRiskRank(risk: string): number {
		switch (risk?.toUpperCase()) {
			case "LOW":
				return 1;
			case "MEDIUM":
				return 2;
			case "HIGH":
				return 3;
			case "CRITICAL":
				return 4;
			default:
				return 0;
		}
	}

	async getRules(): Promise<any[]> {
		try {
			return await db
				.select()
				.from(kycProductEligibilityRules)
				.where(eq(kycProductEligibilityRules.isActive, true));
		} catch {
			return [];
		}
	}
}

export const kycProductEligibilityService = new KycProductEligibilityService();
