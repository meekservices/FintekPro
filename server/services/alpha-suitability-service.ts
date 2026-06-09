import { db } from "../db";
import { userProfiles, aiPredictionLogs, dailyPicks } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "../logger";
import { marketRegimeDetector } from "./risk";

export type RiskLevel =
	| "low"
	| "moderate"
	| "moderately_high"
	| "high"
	| "very_high";

const RISK_RANK: Record<RiskLevel, number> = {
	low: 1,
	moderate: 2,
	moderately_high: 3,
	high: 4,
	very_high: 5,
};

export class AlphaSuitabilityService {
	private static instance: AlphaSuitabilityService;

	static getInstance(): AlphaSuitabilityService {
		if (!AlphaSuitabilityService.instance) {
			AlphaSuitabilityService.instance = new AlphaSuitabilityService();
		}
		return AlphaSuitabilityService.instance;
	}

	/**
	 * Recommends AI Alpha picks based on user's risk profile.
	 * If a pick is higher risk than user profile, it triggers a warning.
	 */
	async getRecommendedAlphaPicks(
		userId: string,
		limit: number = 5,
	): Promise<any[]> {
		try {
			// 1. Get user risk category
			const [profile] = await db
				.select({ riskCategory: userProfiles.riskCategory })
				.from(userProfiles)
				.where(eq(userProfiles.userId, userId))
				.limit(1);

			const userRisk = (profile?.riskCategory as RiskLevel) || "moderate";
			const userRank = RISK_RANK[userRisk];

			// 2. Fetch live picks with AI scores
			const picks = await db
				.select()
				.from(dailyPicks)
				.where(eq(dailyPicks.status, "live"))
				.orderBy(desc(dailyPicks.confidenceScore))
				.limit(20);

			const isBlackSwan = marketRegimeDetector.detectBlackSwanEvent();

			// 3. Annotate picks with suitability
			return picks
				.map((pick) => {
					const productRisk = (pick.riskLevel as RiskLevel) || "high"; // Default AI picks to high
					const productRank = RISK_RANK[productRisk];

					let isSuitable = productRank <= userRank;
					let systemicSafetyBlock = false;

					// Policy Override: During Black Swan, high-risk items are blocked for EVERYONE
					if (isBlackSwan && productRank >= 4) {
						isSuitable = false;
						systemicSafetyBlock = true;
					}

					return {
						...pick,
						suitability: {
							isSuitable,
							userRiskLevel: userRisk,
							productRiskLevel: productRisk,
							requiresWarning: !isSuitable,
							systemicSafetyBlock,
							warningMessage: systemicSafetyBlock
								? `Systemic Safety Guard: This pick is restricted due to extreme market volatility (${marketRegimeDetector.getMarketRegimeDetails()?.volatilityLevel || "High"}). Advice is pivoted to stability-only.`
								: !isSuitable
									? `This 'High-Alpha' pick carries ${productRisk.replace("_", " ")} risk, which exceeds your ${userRisk} risk profile. Click to view Informed Consent details.`
									: null,
						},
					};
				})
				.slice(0, limit);
		} catch (err: any) {
			logger.error("[AlphaSuitability] Failed to fetch recommendations", {
				userId,
				error: err.message,
			});
			return [];
		}
	}

	/**
	 * Generates a regulatory-compliant Informed Consent payload for high-alpha trades.
	 * SEBI/AMFI Audit Safety: We must prove the user was warned OR explicitly consented.
	 */
	async generateInformedConsent(userId: string, pickId: number): Promise<any> {
		const [pick] = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, pickId))
			.limit(1);
		const [profile] = await db
			.select({ riskCategory: userProfiles.riskCategory })
			.from(userProfiles)
			.where(eq(userProfiles.userId, userId))
			.limit(1);

		if (!pick) throw new Error("Pick not found");

		return {
			consentId: `IC-${Date.now()}-${userId.substring(0, 8)}`,
			timestamp: new Date().toISOString(),
			disclosures: [
				{
					title: "Risk Mismatch Disclosure",
					content: `You are investing in ${pick.assetName} (${pick.assetClass}). This product is categorized as ${pick.riskLevel?.toUpperCase()} risk, while your assessed risk profile is ${profile?.riskCategory?.toUpperCase()}.`,
				},
				{
					title: "High-Alpha AI Strategy",
					content:
						"AI-driven Alpha picks use predictive models that can be volatile. Historical backtesting ('Alpha') does not guarantee future results.",
				},
				{
					title: "Regulatory Acknowledgment",
					content:
						"By proceeding, you acknowledge that you have read the suitability warning and are making this investment based on your independent judgment, overriding the default suitability filter.",
				},
			],
			auditTrail: {
				userRiskAtT0: profile?.riskCategory,
				productRiskAtT0: pick.riskLevel,
				alphaConfidence: pick.confidenceScore,
			},
		};
	}

	/**
	 * Logs informed consent to the audit trail.
	 * Makes the platform 'Audit Safe'.
	 */
	async logInformedConsent(
		userId: string,
		pickId: number,
		consentData: any,
	): Promise<void> {
		await db.insert(aiPredictionLogs).values({
			userId,
			pickId,
			actionType: "suitability_override_consent",
			metadata: consentData,
			outcome: "consented",
			timestamp: new Date(),
		});
		logger.info(
			"[Audit] User completed informed consent for suitability override",
			{ userId, pickId },
		);
	}
}

export const alphaSuitabilityService = AlphaSuitabilityService.getInstance();
