import { GovernanceValidator, GovernanceInput, ValidationResult, ValidationViolation } from "../types";

export class RiskValidator implements GovernanceValidator {
  async validate(input: GovernanceInput): Promise<ValidationResult> {
    const recommendationStr = input.ai_output?.recommendation?.toLowerCase() || "";
    
    // Determine risk metrics dynamically based on content keywords
    let risk_level: "low" | "medium" | "high" = "medium";
    let downside_probability = 0.5;
    let volatility_score = 0.5;
    let liquidity_profile: "low" | "medium" | "high" = "medium";
    
    if (recommendationStr.includes("equity") || recommendationStr.includes("stock") || recommendationStr.includes("crypto")) {
      risk_level = "high";
      downside_probability = 0.6;
      volatility_score = 0.8;
      liquidity_profile = recommendationStr.includes("unlisted") ? "low" : "high";
    } else if (recommendationStr.includes("bond") || recommendationStr.includes("fd") || recommendationStr.includes("gsec")) {
      risk_level = "low";
      downside_probability = 0.1;
      volatility_score = 0.2;
      liquidity_profile = "high";
    }

    // Risk Validator predominantly enriches the output with risk metrics as defined in requirements
    return {
      passed: true,
      violations: [],
      risk_metrics: {
        risk_level,
        downside_probability,
        volatility_score,
        liquidity_profile
      }
    };
  }
}
