import {
	GovernanceValidator,
	GovernanceInput,
	ValidationResult,
	ValidationViolation,
} from "../types";

export class ExplainabilityValidator implements GovernanceValidator {
	async validate(input: GovernanceInput): Promise<ValidationResult> {
		const violations: ValidationViolation[] = [];
		const ai_output = input.ai_output;

		if (!ai_output) {
			return {
				passed: false,
				violations: [
					{
						module: "ExplainabilityValidator",
						severity: "CRITICAL",
						message:
							"No structured AI output present / Black-box output detected.",
						code: "EXP_001",
					},
				],
			};
		}

		if (
			!ai_output.factors_considered ||
			ai_output.factors_considered.length === 0
		) {
			violations.push({
				module: "ExplainabilityValidator",
				severity: "CRITICAL",
				message:
					"No explainable factors_considered provided in advisory recommendation.",
				code: "EXP_002",
			});
		}

		if (!ai_output.confidence_score) {
			violations.push({
				module: "ExplainabilityValidator",
				severity: "MINOR",
				message: "Missing confidence score.",
				code: "EXP_003",
			});
		} else if (ai_output.confidence_score < 0.6) {
			// Low confidence failure handling required
			violations.push({
				module: "ExplainabilityValidator",
				severity: "CRITICAL",
				message:
					"AI confidence score below threshold. Must suggest human advisor.",
				code: "EXP_004",
			});
		}

		return {
			passed: violations.filter((v) => v.severity === "CRITICAL").length === 0,
			violations,
		};
	}
}
