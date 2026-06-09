import { logger } from "../../logger";

interface UserProfile {
	kycStatus: string;
	riskProfile: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
	netWorthCategory: "RETAIL" | "HNI" | "UHNI";
}

interface Product {
	assetClass: string;
	riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
	minInvestment: number;
}

export class ProductEligibilityEngine {
	/**
	 * Determines if a user is eligible to invest in a specific product
	 */
	evaluateEligibility(
		user: UserProfile,
		product: Product,
	): { eligible: boolean; reasons: string[] } {
		const reasons: string[] = [];

		// 1. KYC Check (Mandatory for all)
		if (user.kycStatus !== "VERIFIED") {
			reasons.push("User KYC is not fully verified");
			return { eligible: false, reasons }; // Fast fail
		}

		// 2. Asset Class Specific Rules
		switch (product.assetClass) {
			case "PMS":
			case "AIF":
				// SEBI rules for PMS/AIF typically require higher minimums and HNI status
				if (user.netWorthCategory === "RETAIL") {
					reasons.push("PMS/AIF products are restricted to HNI/UHNI investors");
				}
				if (product.minInvestment < 5000000) {
					// 50 Lakh minimum for PMS generally
					logger.warn(
						`[EligibilityEngine] Suspicious PMS product with low minimum: ${product.minInvestment}`,
					);
				}
				break;

			case "MUTUAL_FUND":
			case "FIXED_DEPOSIT":
				// Generally open to retail
				break;

			default:
				reasons.push(`Unknown asset class: ${product.assetClass}`);
		}

		// 3. Risk Profile Matching
		if (!this.isRiskCompatible(user.riskProfile, product.riskLevel)) {
			reasons.push(
				`Product risk (${product.riskLevel}) exceeds user risk tolerance (${user.riskProfile})`,
			);
		}

		return {
			eligible: reasons.length === 0,
			reasons,
		};
	}

	private isRiskCompatible(userRisk: string, productRisk: string): boolean {
		const riskScores: Record<string, number> = {
			LOW: 1,
			MEDIUM: 2,
			HIGH: 3,
			CRITICAL: 4,
		};

		const toleranceScores: Record<string, number> = {
			CONSERVATIVE: 1,
			MODERATE: 2,
			AGGRESSIVE: 4,
		};

		const pScore = riskScores[productRisk] || 4;
		const uScore = toleranceScores[userRisk] || 1;

		// User can invest in products up to their tolerance score
		return pScore <= uScore;
	}
}

export const productEligibilityEngine = new ProductEligibilityEngine();
