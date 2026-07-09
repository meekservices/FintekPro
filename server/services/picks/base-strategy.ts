import { PickCategory, DailyPickData } from "../pick-of-the-day-service";
import { IPickStrategy, StrategyContext } from "./types";
import { logger } from "../../logger";


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
		/** Number of keyMetrics signals present at pick time (for data-density gate) */
		keyMetricsCount = 4,
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

		// ── Fix 12: Data-density gate ────────────────────────────────────────────
		// Replace the blanket 60-floor with a density-scaled cap+floor.
		// Data-rich picks (4+ signals) → normal governance floor of 60.
		// Data-sparse picks (2–3 signals) → max 70, floor 55 (honest uncertainty).
		// Very sparse (≤1 signal) → max 65, floor 50 (clear low-confidence label).
		let maxConfidence: number;
		let minConfidence: number;
		if (keyMetricsCount >= 4) {
			maxConfidence = 100;
			minConfidence = 60; // full governance gate
		} else if (keyMetricsCount >= 2) {
			maxConfidence = 70;
			minConfidence = 55; // moderate uncertainty
		} else {
			maxConfidence = 65;
			minConfidence = 50; // sparse data — honest low-confidence
		}
		return Math.min(maxConfidence, Math.max(minConfidence, confidence));
	}

	protected getDynamicTargetStoploss(
		category: PickCategory,
		volatility?: number,
		currentPrice?: number,
	): { targetPct: number; stoplossPct: number; atrPct?: number } {
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

		// ── Fix C: ATR-based stoploss ──────────────────────────────────────────
		// When currentPrice is provided, compute a synthetic 14-day ATR using the
		// relationship between annualised volatility and intraday true range:
		//   ATR_14 ≈ price × (annualVol% / 100) / √252 × √14
		// Stoploss at 1.5× ATR (tight in low-vol, wide in high-vol).
		// Target at 3× ATR above entry to maintain a 2:1 reward-to-risk ratio.
		// Floors: stoploss ≥ 3%, target ≥ 6% (protect against near-zero ATR).
		// Caps: stoploss ≤ 15%, target ≤ 35%.
		if (
			currentPrice != null &&
			currentPrice > 0 &&
			(category === "listed_stocks" || category === "global_stocks" || category === "etfs")
		) {
			const annualVolFrac = volatility / 100;
			// ATR as a fraction of price (14-day window)
			const atrFrac = annualVolFrac / Math.sqrt(252) * Math.sqrt(14);
			const stoplossPct = Math.min(0.15, Math.max(0.03, Math.round(atrFrac * 1.5 * 1000) / 1000));
			const targetPct = Math.min(0.35, Math.max(0.06, Math.round(atrFrac * 3.0 * 1000) / 1000));
			return {
				targetPct,
				stoplossPct,
				atrPct: Math.round(atrFrac * 10000) / 10000, // expose for keyMetrics
			};
		}

		// Fallback: annualised-vol scaling (original formula for non-equity categories)
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
			logger.info(
				`[PickStrategy:${this.category}] All candidates recently picked, allowing repeats`,
			);
			return candidates;
		}
		return filtered;

	}
}
