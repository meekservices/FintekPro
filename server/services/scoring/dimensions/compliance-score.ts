import { TrackedRecommendation, OutcomeData, ScoreDimensionResult } from "../types";

export function calculateComplianceScore(rec: TrackedRecommendation, outcome: OutcomeData): ScoreDimensionResult {
  let score = 100;
  const factors = [];

  const flags = outcome.actual_outcome_data.compliance_flags || [];

  if (flags.length > 0) {
    const penalty = flags.length * 20;
    score = Math.max(0, 100 - penalty);
    factors.push(`Recommendation triggered Governance Flags: ${flags.join(", ")}`);
  } else {
    factors.push("No governance block or severe modify triggers associated with this output.");
  }

  return {
    score,
    weight: 0.20,
    factors
  };
}
