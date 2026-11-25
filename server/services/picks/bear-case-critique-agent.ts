import type { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export const BEAR_CASE_AGENT_VERSION = "1.0.0";

export interface BearCaseCritiqueResult {
	flags: string[];
	downgradedSignal: boolean;
	originalSignal: string;
	finalSignal: string;
	confidenceDelta: number;
	adjustedConfidence: number;
	aiBearNote?: string;
	engine_version: string;
	calculation_timestamp: string;
}

const FIXED_INCOME_CATEGORIES = new Set<PickCategory>(["bonds", "fixed_deposits", "sgb"]);

/**
 * Devil's Advocate / Bear-Case Critique Agent.
 *
 * Purpose: Perform an adversarial second-pass check on actionable picks before publishing
 *          to catch weak risk-reward, stretched valuations, or tight stop-loss cushions.
 * Inputs: `pick` (`DailyPickData`), `options.useAi` (optional lightweight LLM critique), `options.minConfidenceFloor`.
 * Outputs: `BearCaseCritiqueResult` with deterministic flags, optional signal downgrade, and confidence delta.
 * Edge cases: Fixed-income instruments (`bonds`, `fixed_deposits`, `sgb`) skip equity R:R and P/E checks;
 *             AI critique failures are non-fatal and never block deterministic output.
 */
export async function runBearCaseCritique(
	pick: DailyPickData,
	options: { useAi?: boolean; minConfidenceFloor?: number } = {},
): Promise<BearCaseCritiqueResult> {
	const calculation_timestamp = new Date().toISOString();
	const minFloor = options.minConfidenceFloor ?? 45;
	const flags: string[] = [];

	const metrics = (pick.keyMetrics ?? {}) as Record<string, unknown>;
	const originalSignal = String(metrics.signal ?? metrics.recommendation ?? "buy");
	const reco = Number(pick.recoPrice ?? 0);
	const target = Number(pick.targetPrice ?? 0);
	const sl = Number(pick.stoplossPrice ?? 0);
	const isCredit = metrics.isCreditStrategy === true || (pick.category === "derivatives" && target < reco && reco > 0);
	const isFixedIncome = FIXED_INCOME_CATEGORIES.has(pick.category as PickCategory);

	if (!isFixedIncome && reco > 0 && target > 0 && sl > 0) {
		const reward = isCredit ? reco - target : target - reco;
		const risk = isCredit ? sl - reco : reco - sl;
		if (risk > 0) {
			const rrRatio = reward / risk;
			if (rrRatio < 1.5) {
				flags.push(`Sub-optimal R:R ratio (${rrRatio.toFixed(2)}x < 1.50x)`);
			}
		}

		// Tight stop-loss check for positional equity picks (< 2.5% cushion)
		if (
			(pick.category === "listed_stocks" || pick.category === "global_stocks") &&
			pick.timeHorizon !== "intraday" &&
			!isCredit
		) {
			const slPct = ((reco - sl) / reco) * 100;
			if (slPct > 0 && slPct < 2.5) {
				flags.push(`Tight stop-loss cushion (${slPct.toFixed(1)}% < 2.5%)`);
			}
		}
	}

	// Valuation stretch check for equities
	const peRatio = Number(metrics.peRatio ?? metrics.pe ?? 0);
	if ((pick.category === "listed_stocks" || pick.category === "global_stocks") && peRatio > 50) {
		flags.push(`Elevated valuation (P/E ${peRatio.toFixed(1)}x > 50x)`);
	}

	// Negative FII sector flow check if already tagged
	const fiiSignal = String(metrics.fiiSectorSignal ?? "").toLowerCase();
	if (fiiSignal === "outflow" || fiiSignal === "bearish") {
		flags.push("Sector experiencing FII net outflows");
	}

	let aiBearNote: string | undefined;
	if (options.useAi && originalSignal === "strong_buy") {
		try {
			const { aiService, AICapability } = await import("../ai-service");
			const resp = await aiService.chat(
				[
					{
						role: "system",
						content:
							"You are a conservative SEBI-compliant risk reviewer. In 1 short sentence (max 25 words), state the single biggest downside risk for this pick. Never promise returns.",
					},
					{
						role: "user",
						content: `${pick.instrumentName} (${pick.category}), Entry: ${reco}, Target: ${target}, SL: ${sl}, Risk: ${pick.riskLevel}`,
					},
				],
				{
					capability: AICapability.OPTIMIZED,
					maxTokens: 60,
					temperature: 0.2,
					feature: "potd_bear_case_critique",
				},
			);
			const text = resp?.content?.trim();
			if (text) aiBearNote = text;
		} catch {
			// Non-fatal: deterministic critique remains authoritative
		}
	}

	const downgradedSignal = flags.length >= 2 && originalSignal === "strong_buy";
	const finalSignal = downgradedSignal ? "buy" : originalSignal;
	const rawPenalty = flags.length * 4;
	const currentConf = Number(pick.confidenceScore ?? 65);
	const adjustedConfidence = Math.max(minFloor, currentConf - rawPenalty);
	const confidenceDelta = adjustedConfidence - currentConf;

	return {
		flags,
		downgradedSignal,
		originalSignal,
		finalSignal,
		confidenceDelta,
		adjustedConfidence,
		aiBearNote,
		engine_version: BEAR_CASE_AGENT_VERSION,
		calculation_timestamp,
	};
}
