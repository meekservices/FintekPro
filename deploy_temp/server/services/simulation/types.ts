export interface PortfolioAssetInput {
  asset: string;
  weight: number; 
}

export interface SimulationRequestContext {
  recommendation_id: string; // Linking back to ARSE mapping
  portfolio: PortfolioAssetInput[];
  time_horizon: "1mo" | "6mo" | "1y" | "5y";
  risk_profile: "low" | "medium" | "high";
  market_assumptions: {
    base_expected_return?: number; // e.g. 0.12
    base_volatility?: number; // e.g. 0.18
  };
}

export interface SimulationOutputContract {
  expected_return: number;
  volatility: number;
  max_drawdown: number;
  value_at_risk_95: number;
  scenario_results: {
    bull: { return: number; drawdown: number; probability: number };
    base: { return: number; drawdown: number; probability: number };
    bear: { return: number; drawdown: number; probability: number };
  };
  confidence_intervals: {
    p5: number;
    p50: number;
    p95: number;
  };
  execution_time_ms: number;
}
