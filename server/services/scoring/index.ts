import { v4 as uuidv4 } from "uuid";
import { db } from "../../db";
import { arScores } from "../../../shared/schema/ai";
import {
	ScoringEngine,
	TrackedRecommendation,
	OutcomeData,
	ScoreResult,
} from "./types";
import { calculateAccuracyScore } from "./dimensions/accuracy";
import { calculateRiskAlignmentScore } from "./dimensions/risk-alignment";
import { calculateOutcomeQualityScore } from "./dimensions/outcome-quality";
import { calculateTimeHorizonScore } from "./dimensions/time-horizon";
import { calculateComplianceScore } from "./dimensions/compliance-score";
import { aiFeedbackService } from "../feedback";

export class AIRecommendationScoringEngine implements ScoringEngine {
	async calculateScore(
		recommendation: TrackedRecommendation,
		outcome: OutcomeData,
	): Promise<ScoreResult> {
		// 1. Calculate each dimension individually
		const accuracy = calculateAccuracyScore(recommendation, outcome);
		const riskAlignment = calculateRiskAlignmentScore(recommendation, outcome);
		const outcomeQuality = calculateOutcomeQualityScore(
			recommendation,
			outcome,
		);
		const timeHorizon = calculateTimeHorizonScore(recommendation, outcome);
		const compliance = calculateComplianceScore(recommendation, outcome);

		// 2. Synthesize total score based on configured weighting maps (defaulting to equal 20% splits)
		const totalScore =
			accuracy.score * accuracy.weight +
			riskAlignment.score * riskAlignment.weight +
			outcomeQuality.score * outcomeQuality.weight +
			timeHorizon.score * timeHorizon.weight +
			compliance.score * compliance.weight;

		const finalResult: ScoreResult = {
			accuracy,
			riskAlignment,
			outcomeQuality,
			timeHorizon,
			compliance,
			total_score: totalScore,
		};

		// 3. Fire-and-forget: Push the calculated score natively to the database for persistence
		const scoreId = uuidv4();
		db.insert(arScores)
			.values({
				id: scoreId,
				recommendationId: recommendation.id,
				accuracyScore: accuracy.score.toString(),
				riskAlignmentScore: riskAlignment.score.toString(),
				outcomeQualityScore: outcomeQuality.score.toString(),
				timeHorizonScore: timeHorizon.score.toString(),
				complianceScore: compliance.score.toString(),
				totalScore: totalScore.toString(),
			})
			.execute()
			.catch((e) =>
				console.error("[ARSE Core]: Failed to log score to database", e),
			);

		// 4. Trigger Feedback Loop Asynchronously
		aiFeedbackService
			.processScoreFeedback(
				recommendation.model_version,
				totalScore,
				finalResult,
			)
			.catch((e) => console.error("[ARSE Feedback loop failure]", e));

		return finalResult;
	}
}

export const aiScoringEngine = new AIRecommendationScoringEngine();
