export interface TrackedRecommendation {
	id: string;
	user_id: string;
	asset: string;
	type: "equity" | "bond" | "tax" | "allocation";
	timestamp: string;
	expected_outcome: {
		predicted_return?: number;
		predicted_volatility?: number;
		holding_period?: number;
		risk_level?: "low" | "medium" | "high";
	};
	model_version: string;
}

export interface OutcomeData {
	id: string;
	recommendation_id: string;
	entry_price?: number;
	current_price?: number;
	holding_period_days?: number;
	volatility?: number;
	actual_outcome_data: {
		actual_return?: number;
		drawdown?: number;
		compliance_flags?: string[];
	};
	recorded_at: string;
}

export interface ScoreDimensionResult {
	score: number; // 0-100
	weight: number;
	factors: string[];
}

export interface ScoreResult {
	accuracy: ScoreDimensionResult;
	riskAlignment: ScoreDimensionResult;
	outcomeQuality: ScoreDimensionResult;
	timeHorizon: ScoreDimensionResult;
	compliance: ScoreDimensionResult;
	total_score: number;
}

export interface ScoringEngine {
	calculateScore(
		recommendation: TrackedRecommendation,
		outcome: OutcomeData,
	): Promise<ScoreResult>;
}

export interface ModelRanking {
	model_version: string;
	average_score: number;
	consistency_score: number;
}
