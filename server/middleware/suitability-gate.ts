/**
 * Product Suitability Gate (H-5)
 *
 * SEBI Investment Adviser Regulations 2013 (amended 2020), Regulation 17:
 *  - Every investment recommendation must be based on a risk profile assessment
 *  - The recommended product must match the investor's risk tolerance
 *  - Suitability assessment must be re-done annually
 *
 * Express middleware: `requireSuitability(productRiskLevel)`
 * Returns 403 if user's risk tolerance is lower than product risk level.
 */

import { Request, Response, NextFunction } from "express";
import { db } from "../db";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

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

/** Map from SEBI risk profiling score (1-7) to risk level */
function scoreToRiskLevel(score: number): RiskLevel {
	if (score <= 1) return "low";
	if (score <= 2) return "moderate";
	if (score <= 4) return "moderately_high";
	if (score <= 6) return "high";
	return "very_high";
}

/**
 * Check suitability: returns null if suitable, error string if not.
 */
export async function checkSuitability(
	userId: string,
	productRiskLevel: RiskLevel,
): Promise<{ suitable: boolean; userRiskLevel: RiskLevel; reason?: string }> {
	try {
		// Fetch risk profile from userProfiles (riskCategory is set during onboarding risk assessment)
		const [profile] = await db
			.select({
				riskCategory: (schema.userProfiles as any).riskCategory,
				riskLastAssessed: (schema.userProfiles as any).riskLastAssessed,
			})
			.from(schema.userProfiles)
			.where(eq(schema.userProfiles.userId, userId))
			.limit(1);

		if (!profile || !profile.riskCategory) {
			return {
				suitable: false,
				userRiskLevel: "low",
				reason:
					"Risk profile assessment not found. Please complete the SEBI risk assessment before investing.",
			};
		}

		// Check if assessment is stale (>1 year old per SEBI IA Reg)
		const assessmentAge =
			Date.now() - (profile.riskLastAssessed?.getTime() ?? 0);
		const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
		if (assessmentAge > ONE_YEAR_MS) {
			return {
				suitable: false,
				userRiskLevel: profile.riskCategory as RiskLevel,
				reason:
					"Your risk profile assessment has expired (>1 year). Please update your risk profile before investing. Required under SEBI Investment Adviser Regulations 2020.",
			};
		}

		const userRiskLevel = profile.riskCategory as RiskLevel;
		const userRank = RISK_RANK[userRiskLevel] ?? 1;
		const productRank = RISK_RANK[productRiskLevel];

		if (productRank > userRank) {
			return {
				suitable: false,
				userRiskLevel,
				reason: `This product (${productRiskLevel.replace(/_/g, " ")} risk) exceeds your risk tolerance (${userRiskLevel.replace(/_/g, " ")}). Please select a product matching your risk profile or update your assessment.`,
			};
		}

		return { suitable: true, userRiskLevel };
	} catch (err) {
		logger.error("[SuitabilityGate] Check failed, failing open", {
			userId,
			productRiskLevel,
			err,
		});
		// Fail open with warning — don't block genuine investors on system errors
		return { suitable: true, userRiskLevel: "low" };
	}
}

/**
 * Express middleware factory: requireSuitability(productRiskLevel)
 *
 * Usage on recommendation/order routes:
 *   app.post('/api/mf-orders', requireSuitability('moderately_high'), handler);
 *
 * The product risk level can also be read from req.body or request params
 * by passing a resolver function.
 */
export function requireSuitability(
	riskLevelOrResolver: RiskLevel | ((req: Request) => RiskLevel),
) {
	return async (req: Request, res: Response, next: NextFunction) => {
		if (!req.user?.id) return next(); // auth middleware handles unauthenticated

		const productRiskLevel =
			typeof riskLevelOrResolver === "function"
				? riskLevelOrResolver(req)
				: riskLevelOrResolver;

		const result = await checkSuitability(req.user.id, productRiskLevel);

		if (!result.suitable) {
			logger.warn("[SuitabilityGate] Blocked unsuitable investment", {
				userId: req.user.id,
				productRiskLevel,
				userRiskLevel: result.userRiskLevel,
				path: req.path,
			});
			return res.status(403).json({
				code: "SUITABILITY_MISMATCH",
				message: result.reason,
				productRiskLevel,
				userRiskLevel: result.userRiskLevel,
				regulatoryBasis:
					"SEBI Investment Adviser Regulations 2013 (amended 2020), Regulation 17",
				updateProfileUrl: "/profile?tab=risk-assessment",
			});
		}

		next();
	};
}
