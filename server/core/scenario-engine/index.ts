export interface ScenarioReplayInput {
	baseExpectedReturn: number;
	baseVolatility: number;
}

export interface ScenarioResultSet {
	bull: { return: number; drawdown: number; probability: number };
	base: { return: number; drawdown: number; probability: number };
	bear: { return: number; drawdown: number; probability: number };
}

export class ScenarioReplayEngine {
	/**
	 * Applies abstract / mocked market factors mimicking historical data replays
	 * In future phases, these arrays would be hydrated by live API historical scrapes.
	 */
	public generateScenarioTraces(
		params: ScenarioReplayInput,
	): ScenarioResultSet {
		const baseRet = params.baseExpectedReturn;
		const baseVol = params.baseVolatility;

		// Bear: Mimics 2008 / Covid style shock. High Volatility multiplier, severe downside clipping
		const bearVol = baseVol * 2.5;
		const bearRet = baseRet - bearVol * 1.5; // Systematic beta drop
		const bearDrawdown = bearVol * 2.0;

		// Bull: Optimistic liquidity rush. Low volatility multiplier, upside momentum
		const bullVol = baseVol * 0.7;
		const bullRet = baseRet + bullVol * 1.0;
		const bullDrawdown = bullVol * 0.8;

		return {
			bull: {
				return: bullRet,
				drawdown: bullDrawdown,
				probability: 0.2, // 20% historic probability weight
			},
			base: {
				return: baseRet,
				drawdown: baseVol * 0.6,
				probability: 0.65, // 65% historic probability weight
			},
			bear: {
				return: bearRet,
				drawdown: bearDrawdown > 0 ? bearDrawdown : 0.05, // clamp min bound
				probability: 0.15, // 15% fat tail risk
			},
		};
	}
}

export const scenarioEngine = new ScenarioReplayEngine();
