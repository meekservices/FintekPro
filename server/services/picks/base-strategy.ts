import { PickCategory, DailyPickData } from "../pick-of-the-day-service";
import { IPickStrategy, StrategyContext } from "./types";

export abstract class BaseStrategy implements IPickStrategy {
	abstract category: PickCategory;
	protected readonly DEFAULT_VALIDITY_DAYS = 30;

	abstract generate(
		context: StrategyContext,
	): Promise<DailyPickData | DailyPickData[] | null>;
	abstract score(instrument: any, enriched?: any): number | Promise<number>;
	abstract getLivePrice(instrumentId: string): Promise<number | null>;

	protected getTimeHorizon(category: PickCategory): string {
		switch (category) {
			case "listed_stocks":
			case "global_stocks":
			case "etfs":
				return "short_term";
			case "mutual_funds":
			case "bonds":
			case "fixed_deposits":
				return "medium_term";
			case "unlisted":
			case "reits_invits":
			case "sgb":
				return "long_term";
			default:
				return "medium_term";
		}
	}

	protected getConfidenceScore(
		category: PickCategory,
		score: number,
		maxScore: number,
	): number {
		const scoreRatio = score / Math.max(maxScore, 1);
		let confidence = Math.round(50 + scoreRatio * 40);

		switch (category) {
			case "listed_stocks":
			case "mutual_funds":
				confidence += 5;
				break;
			case "unlisted":
				confidence -= 10;
				break;
			case "global_stocks":
				confidence -= 5;
				break;
		}

		return Math.min(100, Math.max(0, confidence));
	}

	protected getDynamicTargetStoploss(
		category: PickCategory,
		volatility?: number,
	): { targetPct: number; stoplossPct: number } {
		const baseTargets: Record<string, { target: number; stoploss: number }> = {
			listed_stocks: { target: 0.15, stoploss: 0.08 },
			mutual_funds: { target: 0.12, stoploss: 0.05 },
			bonds: { target: 0.08, stoploss: 0.03 },
			global_stocks: { target: 0.15, stoploss: 0.08 },
			etfs: { target: 0.1, stoploss: 0.05 },
			sgb: { target: 0.08, stoploss: 0.03 },
			reits_invits: { target: 0.12, stoploss: 0.06 },
			unlisted: { target: 0.25, stoploss: 0.15 },
			fixed_deposits: { target: 0, stoploss: 0 },
		};

		const base = baseTargets[category] || { target: 0.12, stoploss: 0.06 };

		if (!volatility || volatility <= 0 || category === "fixed_deposits") {
			return { targetPct: base.target, stoplossPct: base.stoploss };
		}

		const volFactor = volatility / 20;
		const adjustedTarget = Math.min(
			base.target * (0.7 + 0.3 * volFactor),
			base.target * 1.5,
		);
		const adjustedStoploss = Math.min(
			base.stoploss * (0.7 + 0.3 * volFactor),
			base.stoploss * 1.5,
		);

		return {
			targetPct: Math.round(adjustedTarget * 1000) / 1000,
			stoplossPct: Math.round(adjustedStoploss * 1000) / 1000,
		};
	}

	protected getExpiryDate(days: number): string {
		const date = new Date();
		date.setDate(date.getDate() + days);
		return date.toISOString().split("T")[0];
	}

	protected getRiskLevel(volatility: number): string {
		if (volatility < 15) return "low";
		if (volatility < 25) return "medium";
		return "high";
	}

	protected deriveSuitableFor(
		riskLevel: string | null | undefined,
		category: PickCategory,
	): string[] {
		const risk = (riskLevel || "").toLowerCase().trim();
		if (risk === "low" || risk === "very low" || risk === "low risk")
			return ["Conservative", "Balanced"];
		if (risk === "moderately low" || risk === "low to moderate")
			return ["Conservative", "Balanced"];
		if (risk === "moderate") return ["Balanced"];
		if (risk === "moderately high" || risk === "moderate to high")
			return ["Balanced", "Aggressive"];
		if (risk === "high") return ["Balanced", "Aggressive"];
		if (risk === "very high" || risk === "very high risk")
			return ["Aggressive"];
		if (
			category === "bonds" ||
			category === "sgb" ||
			category === "fixed_deposits"
		)
			return ["Conservative", "Balanced"];
		if (category === "unlisted") return ["Aggressive"];
		if (
			category === "listed_stocks" ||
			category === "global_stocks" ||
			category === "reits_invits"
		)
			return ["Balanced", "Aggressive"];
		return ["Balanced"];
	}

	protected filterRecentPicks<T extends { id?: string | number }>(
		candidates: T[],
		recentIds: Set<string>,
		idExtractor: (item: T) => string,
	): T[] {
		const filtered = candidates.filter((c) => !recentIds.has(idExtractor(c)));
		if (filtered.length === 0) {
			console.log(
				`[PickStrategy:${this.category}] All candidates recently picked, allowing repeats`,
			);
			return candidates;
		}
		return filtered;
	}
}
