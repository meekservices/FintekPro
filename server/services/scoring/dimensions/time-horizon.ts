import {
	TrackedRecommendation,
	OutcomeData,
	ScoreDimensionResult,
} from "../types";

export function calculateTimeHorizonScore(
	rec: TrackedRecommendation,
	outcome: OutcomeData,
): ScoreDimensionResult {
	let score = 100;
	const factors = [];

	const expectedHorizon = rec.expected_outcome.holding_period;
	const actualHorizon = outcome.holding_period_days;

	if (expectedHorizon !== undefined && actualHorizon !== undefined) {
		if (actualHorizon < expectedHorizon * 0.1) {
			// Extremely premature exit
			score = 20;
			factors.push(
				`Outcome materialized in ${actualHorizon} days, severely missing expected ${expectedHorizon} days horizon.`,
			);
		} else if (actualHorizon > expectedHorizon * 2) {
			score = 50;
			factors.push(
				`Outcome materialized vastly late (${actualHorizon} vs expected ${expectedHorizon}). Penalty applied.`,
			);
		} else {
			factors.push(
				`Outcome materialized within acceptable projected horizon footprint.`,
			);
		}
	} else {
		score = 50;
		factors.push(
			"Lack of holding period data to accurately judge time horizon alignment.",
		);
	}

	return {
		score,
		weight: 0.2,
		factors,
	};
}
