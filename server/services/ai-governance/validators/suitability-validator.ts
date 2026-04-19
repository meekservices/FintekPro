import { GovernanceValidator, GovernanceInput, ValidationResult, ValidationViolation } from "../types";

export class SuitabilityValidator implements GovernanceValidator {
  async validate(input: GovernanceInput): Promise<ValidationResult> {
    const violations: ValidationViolation[] = [];
    const recommendationStr = input.ai_output?.recommendation?.toLowerCase() || "";
    
    const isCryptoOrOptions = recommendationStr.includes("options") || 
                              recommendationStr.includes("futures") || 
                              recommendationStr.includes("crypto") || 
                              recommendationStr.includes("margin");
                              
    if (input.user_profile.risk_profile === "low" && isCryptoOrOptions) {
      violations.push({
        module: "SuitabilityValidator",
        severity: "CRITICAL",
        message: "High-risk product recommended to low-risk user profile.",
        code: "SUIT_001"
      });
    }
    
    const isLongTerm = recommendationStr.includes("10 year") || recommendationStr.includes("long term");
    if (input.user_profile.investment_horizon === "short" && isLongTerm) {
      violations.push({
        module: "SuitabilityValidator",
        severity: "CRITICAL",
        message: "Long-term product recommended to short-term horizon user.",
        code: "SUIT_002"
      });
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
