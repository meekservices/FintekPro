import { db } from "../../db";
import { arModelMetrics } from "../../../shared/schema/ai";
import { eq } from "drizzle-orm";
import { ScoreResult } from "../scoring/types";

export class AIFeedbackService {
	private readonly POOR_MODEL_THRESHOLD = 60.0;
	private readonly CRITICAL_BLINDSIDE_THRESHOLD = 40.0;

	/**
	 * Process a new score entry to update model rankings and flag anomalies
	 */
	async processScoreFeedback(
		modelVersion: string,
		latestScore: number,
		context: ScoreResult,
	): Promise<void> {
		if (!modelVersion) return;

		try {
			// 1. Fetch current standing of the AI model
			const existingMetrics = await db
				.select()
				.from(arModelMetrics)
				.where(eq(arModelMetrics.modelVersion, modelVersion));

			if (existingMetrics.length > 0) {
				const current = existingMetrics[0];

				// Rolling average approximation
				const count = current.totalEvaluations + 1;
				const oldTotal =
					Number.parseFloat(current.averageScore as string) *
					current.totalEvaluations;
				const newAvg = (oldTotal + latestScore) / count;

				await db
					.update(arModelMetrics)
					.set({
						averageScore: newAvg.toString(),
						totalEvaluations: count,
						lastUpdated: new Date(),
					})
					.where(eq(arModelMetrics.modelVersion, modelVersion));

				// 2. Failsafe Handling: Evaluate if the model is severely degraded
				if (newAvg < this.POOR_MODEL_THRESHOLD && count > 10) {
					this.triggerModelDowngradeAlert(modelVersion, newAvg);
				}
			} else {
				// Initialize tracking for a newly observed model signature
				await db.insert(arModelMetrics).values({
					modelVersion,
					averageScore: latestScore.toString(),
					consistencyScore: "1.0",
					totalEvaluations: 1,
				});
			}

			// 3. Immediately flag critical pattern detections (irrespective of historical rolling avg)
			if (latestScore < this.CRITICAL_BLINDSIDE_THRESHOLD) {
				this.triggerCriticalBlindsideAlert(modelVersion, context);
			}
		} catch (e: any) {
			console.error(`[Feedback Engine Error]: ${e.message}`);
		}
	}

	private triggerModelDowngradeAlert(version: string, avgScore: number) {
		// In production, this pushes to Slack/PagerDuty or auto-reroutes internal endpoints
		console.warn(
			`[ARSE FAILSAFE TRIGGERED]: Model ${version} has dropped below acceptable bounds (Score: ${Math.round(avgScore)}). Restricting platform usage.`,
		);
	}

	private triggerCriticalBlindsideAlert(version: string, context: ScoreResult) {
		console.error(
			`[ARSE HIGHRISK FLAG]: Model ${version} issued a critically failed response leading to severe penalties. Engaging Governance review.`,
		);
	}
}

export const aiFeedbackService = new AIFeedbackService();
