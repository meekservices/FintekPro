import { GovernanceValidator, GovernanceInput, ValidationResult, ValidationViolation } from "../types";

export class FinancialValidator implements GovernanceValidator {
  async validate(input: GovernanceInput): Promise<ValidationResult> {
    const violations: ValidationViolation[] = [];
    const recommendationStr = input.ai_output?.recommendation?.toLowerCase() || "";
    
    // In a real implementation, this would call out to DCF engine or intrinsic-value-calculator
    // Mocking the check conceptually as requested by architectural instructions
    if (recommendationStr.includes("undervalued") && input.ai_output?.confidence_score && input.ai_output.confidence_score < 0.70) {
      violations.push({
        module: "FinancialValidator",
        severity: "MINOR",
        message: "AI claims 'undervalued' but confidence score is too low to deterministically support it without core engine alignment.",
        code: "FIN_001"
      });
    }

    return {
      passed: true, // we don't automatically block in the mock, just modify or flag
      violations,
      ...(violations.length > 0 ? {
        suggested_modifications: {
          enforce_language: [
            { search: "undervalued", replace: "potentially undervalued based on historicals" }
          ]
        }
      } : {})
    };
  }
}
