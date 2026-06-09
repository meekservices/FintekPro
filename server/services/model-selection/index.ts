import { v4 as uuidv4 } from "uuid";
import { db } from "../../db";
import { amseSelectionLogs } from "../../../shared/schema/ai";
import { modelRegistry } from "../model-registry";
import { aiRoutingEngine } from "../../core/routing-engine";
import { SelectionContext, SelectionResult } from "./types";

export class AIModelSelectionEngine {
	async selectOptimalModel(
		context: SelectionContext,
	): Promise<SelectionResult> {
		try {
			const requiredCaps = context.capabilities_required || [];
			const eligibleModels =
				await modelRegistry.getEligibleModels(requiredCaps);

			if (eligibleModels.length === 0) {
				return this.triggerFailsafeLog(
					context,
					"No valid models match required capabilities.",
				);
			}

			// Compute multi-factor scores for every eligible model based on context weights
			const rankedModels = eligibleModels
				.map((model) => {
					const score = aiRoutingEngine.calculateModelRoutingScore(
						model,
						context,
					);
					return { model, score };
				})
				.sort((a, b) => b.score - a.score); // Descending rank

			const bestModelObj = rankedModels[0];

			// SafeMode Enforcement: Check if the best model meets minimal confidence baseline
			const confidenceRequired = context.confidence_required || 0.8;

			// We convert 100-point registry compliance score to 0.0-1.0 confidence proxy
			const expectedConfidence = bestModelObj.model.compliance_score / 100;

			if (expectedConfidence < confidenceRequired) {
				// Safe Mode trigger
				return this.triggerFailsafeLog(
					context,
					`Highest ranked model (${bestModelObj.model.model_id}) yields expected confidence (${expectedConfidence}) lower than strict required threshold (${confidenceRequired}).`,
				);
			}

			const alternatives = rankedModels
				.slice(1, 4)
				.map((m) => m.model.model_id);

			// Async log to DB tracing layer
			this.persistSelectionLog(
				context,
				bestModelObj.model.model_id,
				bestModelObj.score,
				false,
				alternatives,
				"Highest dynamically weighted score achieved.",
			);

			return {
				selected_model: bestModelObj.model.model_id,
				confidence_target: expectedConfidence,
				selection_score: bestModelObj.score,
				reason: "optimal_math_routing",
				fallback_triggered: false,
				alternative_models: alternatives,
			};
		} catch (e: any) {
			console.error("[AMSE SYSTEM FAULT]:", e);
			return this.triggerFailsafeLog(
				context,
				"Internal Selection Engine Error",
			);
		}
	}

	private triggerFailsafeLog(
		context: SelectionContext,
		errorReason: string,
	): SelectionResult {
		// 11.1 Failsafe Mechanisms
		// In Phase 1 implementation, if optimal thresholds fail or no models surface, we structurally block.
		const SEBI_BLOCK_STRING =
			"SEBI_BLOCK: Unable to generate compliant recommendation";
		this.persistSelectionLog(
			context,
			SEBI_BLOCK_STRING,
			0,
			true,
			[],
			errorReason,
		);

		return {
			selected_model: SEBI_BLOCK_STRING,
			confidence_target: 0,
			selection_score: 0,
			reason: errorReason,
			fallback_triggered: true,
		};
	}

	private persistSelectionLog(
		context: SelectionContext,
		model: string,
		score: number,
		fallback: boolean,
		alts: string[],
		reason: string,
	) {
		db.insert(amseSelectionLogs)
			.values({
				id: uuidv4(),
				queryId: context.query_id || uuidv4(),
				userId: context.user_id,
				selectedModel: model,
				alternativeModels: alts,
				selectionScore: score.toString(),
				selectionReason: reason,
				fallbackTriggered: fallback,
			})
			.execute()
			.catch((e) => console.error("[AMSE Core]: DB Audit log failed.", e));
	}
}

export const aiModelSelectionEngine = new AIModelSelectionEngine();
