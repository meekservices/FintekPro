import { z } from "zod";

export const AssetClassBandSchema = z
	.object({
		target: z.number().min(0).max(100),
		lowerBand: z.number().min(0).max(100),
		upperBand: z.number().min(0).max(100),
	})
	.refine(
		(data) => data.lowerBand <= data.target && data.target <= data.upperBand,
		{
			message: "Band constraint: lowerBand <= target <= upperBand",
		},
	);

export const AllocationPolicySchema = z
	.object({
		equity: AssetClassBandSchema.optional(),
		debt: AssetClassBandSchema.optional(),
		gold: AssetClassBandSchema.optional(),
		cash: AssetClassBandSchema.optional(),
		alternates: AssetClassBandSchema.optional(),
		international: AssetClassBandSchema.optional(),
	})
	.refine(
		(data) => {
			const totalTarget = Object.values(data)
				.filter((v) => v !== undefined)
				.reduce((sum, band) => sum + (band?.target || 0), 0);
			return Math.abs(totalTarget - 100) < 0.01;
		},
		{
			message: "Total target allocation must sum to 100%",
		},
	);

export type AssetClassBand = z.infer<typeof AssetClassBandSchema>;
export type AllocationPolicy = z.infer<typeof AllocationPolicySchema>;

export interface BandBreachResult {
	assetClass: string;
	currentWeight: number;
	targetWeight: number;
	lowerBand: number;
	upperBand: number;
	breachType: "UNDER" | "OVER" | "NONE";
	deviationPercent: number;
}

export class AllocationPolicyService {
	private static instance: AllocationPolicyService;

	private constructor() {}

	static getInstance(): AllocationPolicyService {
		if (!AllocationPolicyService.instance) {
			AllocationPolicyService.instance = new AllocationPolicyService();
		}
		return AllocationPolicyService.instance;
	}

	validatePolicy(policy: unknown): { valid: boolean; errors?: string[] } {
		const result = AllocationPolicySchema.safeParse(policy);
		if (result.success) {
			return { valid: true };
		}
		return {
			valid: false,
			errors: result.error.issues.map((i) => i.message),
		};
	}

	getDefaultPolicy(riskProfile: string): AllocationPolicy {
		const policies: Record<string, AllocationPolicy> = {
			conservative: {
				equity: { target: 30, lowerBand: 20, upperBand: 40 },
				debt: { target: 50, lowerBand: 40, upperBand: 60 },
				gold: { target: 10, lowerBand: 5, upperBand: 15 },
				cash: { target: 10, lowerBand: 5, upperBand: 15 },
			},
			moderate: {
				equity: { target: 50, lowerBand: 40, upperBand: 60 },
				debt: { target: 30, lowerBand: 20, upperBand: 40 },
				gold: { target: 10, lowerBand: 5, upperBand: 15 },
				cash: { target: 10, lowerBand: 5, upperBand: 15 },
			},
			aggressive: {
				equity: { target: 70, lowerBand: 60, upperBand: 80 },
				debt: { target: 15, lowerBand: 10, upperBand: 25 },
				gold: { target: 10, lowerBand: 5, upperBand: 15 },
				cash: { target: 5, lowerBand: 0, upperBand: 10 },
			},
			"very-aggressive": {
				equity: { target: 85, lowerBand: 75, upperBand: 95 },
				debt: { target: 5, lowerBand: 0, upperBand: 15 },
				gold: { target: 5, lowerBand: 0, upperBand: 10 },
				cash: { target: 5, lowerBand: 0, upperBand: 10 },
			},
		};

		return policies[riskProfile] || policies.moderate;
	}

	checkBandBreaches(
		currentAllocations: Record<string, number>,
		policy: AllocationPolicy,
	): BandBreachResult[] {
		const results: BandBreachResult[] = [];

		for (const [assetClass, band] of Object.entries(policy)) {
			if (!band) continue;

			const currentWeight = currentAllocations[assetClass] || 0;
			let breachType: "UNDER" | "OVER" | "NONE" = "NONE";
			let deviationPercent = 0;

			if (currentWeight < band.lowerBand) {
				breachType = "UNDER";
				deviationPercent = band.lowerBand - currentWeight;
			} else if (currentWeight > band.upperBand) {
				breachType = "OVER";
				deviationPercent = currentWeight - band.upperBand;
			}

			results.push({
				assetClass,
				currentWeight,
				targetWeight: band.target,
				lowerBand: band.lowerBand,
				upperBand: band.upperBand,
				breachType,
				deviationPercent,
			});
		}

		return results;
	}

	calculateRebalanceActions(
		currentAllocations: Record<string, number>,
		totalValue: number,
		policy: AllocationPolicy,
	): Array<{
		assetClass: string;
		action: "BUY" | "SELL" | "HOLD";
		amountChange: number;
		percentChange: number;
		reason: string;
	}> {
		const breaches = this.checkBandBreaches(currentAllocations, policy);
		const actions: Array<{
			assetClass: string;
			action: "BUY" | "SELL" | "HOLD";
			amountChange: number;
			percentChange: number;
			reason: string;
		}> = [];

		for (const breach of breaches) {
			if (breach.breachType === "NONE") {
				actions.push({
					assetClass: breach.assetClass,
					action: "HOLD",
					amountChange: 0,
					percentChange: 0,
					reason: `${breach.assetClass} is within target band (${breach.lowerBand}%-${breach.upperBand}%)`,
				});
			} else if (breach.breachType === "UNDER") {
				const targetValue = (breach.targetWeight / 100) * totalValue;
				const currentValue = (breach.currentWeight / 100) * totalValue;
				const amountChange = targetValue - currentValue;

				actions.push({
					assetClass: breach.assetClass,
					action: "BUY",
					amountChange,
					percentChange: breach.targetWeight - breach.currentWeight,
					reason: `${breach.assetClass} underweight by ${breach.deviationPercent.toFixed(1)}% (current: ${breach.currentWeight.toFixed(1)}%, lower band: ${breach.lowerBand}%)`,
				});
			} else if (breach.breachType === "OVER") {
				const targetValue = (breach.targetWeight / 100) * totalValue;
				const currentValue = (breach.currentWeight / 100) * totalValue;
				const amountChange = currentValue - targetValue;

				actions.push({
					assetClass: breach.assetClass,
					action: "SELL",
					amountChange,
					percentChange: breach.currentWeight - breach.targetWeight,
					reason: `${breach.assetClass} overweight by ${breach.deviationPercent.toFixed(1)}% (current: ${breach.currentWeight.toFixed(1)}%, upper band: ${breach.upperBand}%)`,
				});
			}
		}

		return actions;
	}

	normalizeAllocations(
		holdings: Array<{ assetType: string; currentValue: number }>,
	): Record<string, number> {
		const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
		if (totalValue === 0) return {};

		const allocations: Record<string, number> = {};

		const assetClassMapping: Record<string, string> = {
			equity: "equity",
			mutual_fund: "equity",
			etf: "equity",
			stock: "equity",
			bond: "debt",
			fd: "debt",
			debt: "debt",
			gold: "gold",
			cash: "cash",
			money_market: "cash",
			liquid: "cash",
			pms: "alternates",
			aif: "alternates",
			real_estate: "alternates",
			international: "international",
			us_stocks: "international",
		};

		for (const holding of holdings) {
			const normalizedClass =
				assetClassMapping[holding.assetType.toLowerCase()] || "alternates";
			allocations[normalizedClass] =
				(allocations[normalizedClass] || 0) + holding.currentValue;
		}

		for (const key of Object.keys(allocations)) {
			allocations[key] = (allocations[key] / totalValue) * 100;
		}

		return allocations;
	}
}

export const allocationPolicyService = AllocationPolicyService.getInstance();
