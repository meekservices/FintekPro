import { db } from "../../db";
import { apseSimulationLogs } from "../../../shared/schema/ai";
import { v4 as uuidv4 } from "uuid";
import { SimulationRequestContext, SimulationOutputContract } from "./types";
import { monteCarloEngine } from "../../core/monte-carlo";
import { scenarioEngine } from "../../core/scenario-engine";

export class APSESimulator {
	public async runFullSimulation(
		context: SimulationRequestContext,
	): Promise<SimulationOutputContract> {
		const startTime = Date.now();

		// 1. Process Input Context & Assumptions
		const baseReturn = context.market_assumptions.base_expected_return ?? 0.1; // Default 10%
		const baseVolatility = context.market_assumptions.base_volatility ?? 0.15; // Default 15%

		const timeHorizonYears = this.convertHorizonToYears(context.time_horizon);

		// 2. Concurrently execute heavy quantitative engines to maintain < 2s boundary
		const [mcResult, scenarioResult] = await Promise.all([
			Promise.resolve(
				monteCarloEngine.simulatePortfolio({
					portfolioVolatility: baseVolatility,
					expectedAnnualReturn: baseReturn,
					timeHorizonYears,
				}),
			),
			Promise.resolve(
				scenarioEngine.generateScenarioTraces({
					baseExpectedReturn: baseReturn,
					baseVolatility: baseVolatility,
				}),
			),
		]);

		const executionTimeMs = Date.now() - startTime;

		const output: SimulationOutputContract = {
			expected_return: mcResult.expectedReturn,
			volatility: mcResult.volatility,
			max_drawdown: mcResult.maxDrawdown,
			value_at_risk_95: mcResult.valueAtRisk95,
			scenario_results: scenarioResult,
			confidence_intervals: mcResult.confidenceIntervals,
			execution_time_ms: executionTimeMs,
		};

		// 3. Fire-and-forget: Persist logic chain for RBI/SEBI tracing
		this.persistSimulationLog(context, output);

		return output;
	}

	private convertHorizonToYears(horizon: string): number {
		switch (horizon) {
			case "1mo":
				return 1 / 12;
			case "6mo":
				return 0.5;
			case "1y":
				return 1.0;
			case "5y":
				return 5.0;
			default:
				return 1.0;
		}
	}

	private persistSimulationLog(
		context: SimulationRequestContext,
		output: SimulationOutputContract,
	): void {
		db.insert(apseSimulationLogs)
			.values({
				id: uuidv4(),
				recommendationId: context.recommendation_id || uuidv4(),
				executionTimeMs: output.execution_time_ms,
				inputPortfolioMap: context.portfolio,
				assumptionsVectors: context.market_assumptions,
				outputDistributions: output,
			})
			.execute()
			.catch((e) =>
				console.error(
					"[APSE Failsafe]: Failed to persist simulation tracking map.",
					e,
				),
			);
	}
}

export const apseEngine = new APSESimulator();
