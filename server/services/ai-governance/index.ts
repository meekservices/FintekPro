/**
 * @file ai-governance/index.ts
 * @description AAGE v1.0 — AI Advisory Governance Engine decision pipeline.
 *
 * Purpose:
 *   Intercepts every AI advisory output and validates it against compliance,
 *   suitability, financial correctness, and explainability rules.
 *   Decides APPROVE | MODIFY | BLOCK and logs an immutable audit record.
 *
 * Inputs:
 *   - GovernanceInput: user_id, query, ai_output, user_profile, b2b_context
 * Outputs:
 *   - GovernanceOutput: decision, final_output, violations, risk_flags, audit_id
 *
 * Edge cases:
 *   - AAGE engine crash → hard-block output + fallback message (§9.1 failsafe)
 *   - confidence_score < 0.5 → auto-downgrade to MODIFY + advisor suggestion (FASP-AI §21.1)
 *   - B2B DELEGATED mode → APPROVE overrides MODIFY for minor violations only
 *
 * GCR v1.0: latency target < 300ms; structured logs with latency_ms.
 * AAGE v1.0: §4.2 MODIFY applies ALL suggested modifications, not just disclaimers.
 */
import {
	GovernanceInput,
	GovernanceOutput,
	ValidationResult,
	DecisionType,
} from "./types";
import { SuitabilityValidator } from "./validators/suitability-validator";
import { ComplianceValidator } from "./validators/compliance-validator";
import { FinancialValidator } from "./validators/financial-validator";
import { RiskValidator } from "./validators/risk-validator";
import { ExplainabilityValidator } from "./validators/explainability-validator";
import { aiGovernanceAuditLogger, logger } from "../../logger";

/** FASP-AI §21.1: confidence threshold below which recommendation is downgraded. */
const LOW_CONFIDENCE_THRESHOLD = 0.5;

export class AIGovernanceDecisionEngine {
	private validators = [
		new ExplainabilityValidator(), // Must run first to ensure output structure exists
		new SuitabilityValidator(),
		new ComplianceValidator(),
		new FinancialValidator(),
		new RiskValidator(),
	];

	async validateAndResolve(input: GovernanceInput): Promise<GovernanceOutput> {
		const t0 = Date.now();
		try {
			let allViolations: any[] = [];
			let finalDecision: DecisionType = "APPROVE";
			const finalRiskFlags: string[] = [];

			// We start with the original assuming it's valid, and mutate it if minor changes surface
			const workingOutput = { ...input.ai_output } as any;

			// Decision priority constants — declared first as they are used in the confidence
			// pre-check below before the validator loop.
			const PRIORITY_APPROVE = 0;
			const PRIORITY_MODIFY  = 1;
			const PRIORITY_BLOCK   = 2;
			const _decisionPriority: Record<DecisionType, number> = { APPROVE: PRIORITY_APPROVE, MODIFY: PRIORITY_MODIFY, BLOCK: PRIORITY_BLOCK };
			/** Sets finalDecision to value only if it's a stricter outcome (APPROVE < MODIFY < BLOCK). */
			const raiseDecision = (val: DecisionType): void => {
				if (_decisionPriority[val] > _decisionPriority[finalDecision]) finalDecision = val;
			};

			// ── FASP-AI §21.1: Low-confidence pre-check — downgrade before validators ──
			// If confidence_score < threshold, force MODIFY and append advisor suggestion.
			// This prevents under-confident outputs from appearing as APPROVED advice.
			const confidenceScore = input.ai_output?.confidence_score ?? 1;
			if (confidenceScore < LOW_CONFIDENCE_THRESHOLD) {
				raiseDecision("MODIFY");
				workingOutput.recommendation =
					(workingOutput.recommendation || "") +
					`\n\n⚠️ This recommendation has a low confidence score (${confidenceScore.toFixed(2)}). ` +
					"Please consult a qualified advisor before making any investment decision.";
				allViolations.push({
					module: "AAGE_ConfidenceCheck",
					severity: "MEDIUM",
					message: `confidence_score ${confidenceScore.toFixed(2)} below threshold ${LOW_CONFIDENCE_THRESHOLD} — recommendation downgraded`,
					code: "LOW_CONFIDENCE",
				});
			}

			// Execute all validators concurrently to fit inside the < 300ms latency budget
			const results = await Promise.all(
				this.validators.map((v) => v.validate(input)),
			);

			for (const res of results) {
				if (!res.passed) {
					raiseDecision("BLOCK");
				}

				if (res.violations && res.violations.length > 0) {
					allViolations = allViolations.concat(res.violations);

					const hasCritical = res.violations.some(
						(v: any) => v.severity === "CRITICAL",
					);

					if (hasCritical) {
						// 4.2 Hard Blocks: Critical suitability mismatch CANNOT be overridden
						raiseDecision("BLOCK");
					} else if (_decisionPriority[finalDecision] < PRIORITY_BLOCK) {
						// Check for B2B Delegation Override for Minor Violations
						const isB2BOverride =
							input.b2b_context?.is_partner_override &&
							input.b2b_context?.delegated_governance_mode === "DELEGATED" &&
							input.b2b_context?.partner_ria_id;

						if (isB2BOverride) {
							// Partner takes absolute RIA responsibility for minor deviations
							// (BLOCK is still hard — this only overrides MODIFY)
							if (_decisionPriority[finalDecision] === PRIORITY_MODIFY) finalDecision = "APPROVE";
						} else {
							raiseDecision("MODIFY");
						}
					}
				}

				if (res.risk_metrics) {
					workingOutput.risk_profile = res.risk_metrics;
					finalRiskFlags.push(res.risk_metrics.risk_level);
				}

				// ── AAGE §4.2 FIX: Apply ALL suggested modifications, not just add_disclaimers ──
				// Previously only add_disclaimers was applied; add_risk_notes and
				// remove_certainty_language were silently dropped, breaking §4.2 compliance.
				if (res.suggested_modifications) {
					const mods = res.suggested_modifications as Record<string, any>;

					// 1. Append disclaimers
					if (Array.isArray(mods.add_disclaimers) && mods.add_disclaimers.length > 0) {
						workingOutput.recommendation =
							(workingOutput.recommendation || "") +
							"\n\nDisclaimer: " +
							mods.add_disclaimers.join(" ");
					}

					// 2. Append risk notes (§4.2 MODIFY requirement)
					if (Array.isArray(mods.add_risk_notes) && mods.add_risk_notes.length > 0) {
						workingOutput.recommendation =
							(workingOutput.recommendation || "") +
							"\n\nRisk Notes: " +
							mods.add_risk_notes.join(" ");
					}

					// 3. Strip certainty language (§4.2: remove deterministic profit language)
					if (mods.remove_certainty_language === true && workingOutput.recommendation) {
						const CERTAINTY_PHRASES = [
							/will give \d+%/gi,
							/guaranteed return/gi,
							/will definitely/gi,
							/certain to/gi,
							/sure to/gi,
							/risk-free/gi,
						];
						for (const pattern of CERTAINTY_PHRASES) {
							workingOutput.recommendation = workingOutput.recommendation.replace(
								pattern,
								"[language moderated per SEBI guidelines]",
							);
						}
					}
				}
			}

			const governanceOutput: GovernanceOutput = {
				decision: finalDecision,
				final_output:
					_decisionPriority[finalDecision] >= PRIORITY_BLOCK
						? {
								message:
									"Recommendation cannot be provided due to compliance constraints",
								reason: allViolations.map((v: any) => v.message).join(" | "),
								fallback: true,
							}
						: workingOutput,
				violations: allViolations,
				risk_flags: finalRiskFlags,
				compliance_status: _decisionPriority[finalDecision] >= PRIORITY_BLOCK ? "FAIL" : "PASS",
			};

			// Ensure every log is written to the immutable tracing DB
			const auditId = await aiGovernanceAuditLogger.logGovernanceDecision(
				input,
				governanceOutput,
			);
			governanceOutput.audit_id = auditId;

			// GCR §5 Observability: emit structured AAGE_DECISION log with latency_ms
			logger.info("[AAGE] Governance decision resolved", {
				event: "AAGE_DECISION",
				user_id: input.user_id || "unknown",
				decision: finalDecision,
				violations_count: allViolations.length,
				compliance_status: governanceOutput.compliance_status,
				model_version: input.ai_output?.model_version || "unknown",
				audit_id: auditId,
				latency_ms: Date.now() - t0,
				status: "success",
			});

			return governanceOutput;
		} catch (e: any) {
			// §9.1 Failsafe Design: If AAGE itself crashes, hard-block the output.
			logger.error("[AAGE] Governance engine internal fault — hard-blocking output", {
				event: "AAGE_DECISION",
				user_id: input.user_id || "unknown",
				decision: "BLOCK",
				violations_count: 1,
				compliance_status: "FAIL",
				model_version: input.ai_output?.model_version || "unknown",
				latency_ms: Date.now() - t0,
				status: "error",
				error_code: "AAGE_INTERNAL_FAULT",
			});
			return {
				decision: "BLOCK",
				final_output: {
					message: "Please consult human advisor",
					reason: "governance_engine_internal_fault",
					fallback: true,
				},
				violations: [
					{
						module: "AAGE_Core",
						severity: "CRITICAL",
						message: e.message || "Unknown error",
						code: "SYS_ERR",
					},
				],
				risk_flags: [],
				compliance_status: "FAIL",
			};
		}
	}
}

export const aiGovernanceEngine = new AIGovernanceDecisionEngine();
