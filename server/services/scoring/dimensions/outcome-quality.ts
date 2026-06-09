import {
	TrackedRecommendation,
	OutcomeData,
	ScoreDimensionResult,
} from "../types";

export function calculateOutcomeQualityScore(
	rec: TrackedRecommendation,
	outcome: OutcomeData,
): ScoreDimensionResult {
	let score = 100;
	const factors = [];

	const actualReturn = outcome.actual_outcome_data.actual_return;
	const drawdown = outcome.actual_outcome_data.drawdown;

	if (actualReturn !== undefined) {
		if (actualReturn < 0) {
			score = Math.max(0, 100 - Math.abs(actualReturn) * 15);
			factors.push(`Negative outcome realized. P/L: ${actualReturn}%.`);
		} else {
			factors.push(`Positive outcome realized. P/L: ${actualReturn}%.`);
		}
	}

	if (drawdown !== undefined && drawdown > 0) {
		// drawdowns heavily penalize the outcome quality
		const ddPenalty = drawdown * 5;
		score = Math.max(0, score - ddPenalty);
		factors.push(`Heavy drawdown detected: ${drawdown}%. Penalty applied.`);
	}

	return {
		score,
		weight: 0.2,
		factors,
	};
}
