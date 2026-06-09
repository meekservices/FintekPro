import {
	TrackedRecommendation,
	OutcomeData,
	ScoreDimensionResult,
} from "../types";

export function calculateAccuracyScore(
	rec: TrackedRecommendation,
	outcome: OutcomeData,
): ScoreDimensionResult {
	let score = 100;
	const factors = [];

	const predicted = rec.expected_outcome.predicted_return;
	const actual = outcome.actual_outcome_data.actual_return;

	if (predicted !== undefined && actual !== undefined) {
		const absDiff = Math.abs(predicted - actual);
		// Simple penalty model: subtract 10 points for every 1% deviation
		const penalty = Math.min(absDiff * 10, 100);
		score = Math.max(0, 100 - penalty);
		factors.push(
			`Predicted Return: ${predicted}%, Actual: ${actual}%. Penalty applied: ${penalty.toFixed(2)}`,
		);
	} else {
		// If no predicted vs actual returns are provided, we default to neutral 50 but log factor
		score = 50;
		factors.push(
			"Missing predicted or actual return metrics to perform absolute accuracy score.",
		);
	}

	return {
		score,
		weight: 0.2,
		factors,
	};
}
