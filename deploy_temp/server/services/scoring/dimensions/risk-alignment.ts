import { TrackedRecommendation, OutcomeData, ScoreDimensionResult } from "../types";

export function calculateRiskAlignmentScore(rec: TrackedRecommendation, outcome: OutcomeData): ScoreDimensionResult {
  let score = 100;
  const factors = [];

  const riskLevel = rec.expected_outcome.risk_level || "medium";
  const realizedVolatility = outcome.volatility;

  if (realizedVolatility !== undefined) {
    // Arbitrary threshold map for example scoring
    const isHighVol = realizedVolatility > 0.20;
    const isMedVol = realizedVolatility > 0.10 && realizedVolatility <= 0.20;

    if (riskLevel === "low" && isHighVol) {
      score = 0; // Huge penalty for breaching risk parameter massively
      factors.push("Severe mismatch: Realized High Volatility on a Low Risk recommendation profile.");
    } else if (riskLevel === "low" && isMedVol) {
      score = 40;
      factors.push("Moderate mismatch: Realized Medium Volatility on a Low Risk profile.");
    } else if (riskLevel === "medium" && isHighVol) {
      score = 50;
      factors.push("Moderate mismatch: Realized High Volatility on a Medium Risk profile.");
    } else {
      factors.push(`Risk matched profile. Realized Volatility: ${realizedVolatility}`);
    }
  } else {
    score = 50;
    factors.push("Insufficient realized volatility data available to complete risk mapping.");
  }

  return {
    score,
    weight: 0.20,
    factors
  };
}
