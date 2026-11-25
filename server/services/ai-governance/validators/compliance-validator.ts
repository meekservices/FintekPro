import {
	GovernanceValidator,
	GovernanceInput,
	ValidationResult,
	ValidationViolation,
} from "../types";

const PROHIBITED_PHRASES = [
	"guaranteed return",
	"surefire",
	"risk-free",
	"cannot lose",
	"100% chance",
	"will double",
	"will definitely",
];

export class ComplianceValidator implements GovernanceValidator {
	async validate(input: GovernanceInput): Promise<ValidationResult> {
		const violations: ValidationViolation[] = [];
		const suggested_modifications: any = {
			add_disclaimers: [],
			enforce_language: [],
		};
		const recommendationStr =
			input.ai_output?.recommendation?.toLowerCase() || "";

		// Strip disclaimer blocks and negative disclaimers to prevent false-positive blocks
		// (e.g. "Not deterministic investment advice or guaranteed return solicitation")
		let cleanText = recommendationStr
			.replace(/---\s*\*?fasp-ai[\s\S]*$/i, "")
			.replace(/\bdisclaimer:[\s\S]*$/i, "")
			.replace(/\bnot\s+(?:deterministic\s+investment\s+advice\s+or\s+)?guaranteed\s+returns?\b/gi, "")
			.replace(/\bno\s+guaranteed\s+returns?\b/gi, "")
			.replace(/\bnot\s+risk[- ]?free\b/gi, "");

		// Check for prohibited language
		let containsProhibited = false;
		for (const phrase of PROHIBITED_PHRASES) {
			if (cleanText.includes(phrase)) {
				containsProhibited = true;
				violations.push({
					module: "ComplianceValidator",
					severity: "CRITICAL",
					message: `Prohibited deterministic profit language detected: "${phrase}"`,
					code: "COMP_001",
				});
			}
		}

		if (containsProhibited) {
			return { passed: false, violations };
		}

		// Modification: Enforce disclaimers if not present
		if (
			!recommendationStr.includes("not investment advice") &&
			!recommendationStr.includes("risk disclosure")
		) {
			violations.push({
				module: "ComplianceValidator",
				severity: "MINOR",
				message: "Missing mandatory regulatory disclaimers in advisory output.",
				code: "COMP_002",
			});
			suggested_modifications.add_disclaimers.push(
				"Not investment advice. Market volatility warning: Investments are subject to market risks.",
			);
		}

		return {
			passed: violations.filter((v) => v.severity === "CRITICAL").length === 0,
			violations,
			...(violations.length > 0 ? { suggested_modifications } : {}),
		};
	}
}
