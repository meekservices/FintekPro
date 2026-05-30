import { GovernanceInput, GovernanceOutput, ValidationResult, DecisionType } from "./types";
import { SuitabilityValidator } from "./validators/suitability-validator";
import { ComplianceValidator } from "./validators/compliance-validator";
import { FinancialValidator } from "./validators/financial-validator";
import { RiskValidator } from "./validators/risk-validator";
import { ExplainabilityValidator } from "./validators/explainability-validator";
import { aiGovernanceAuditLogger } from "../../logger";

export class AIGovernanceDecisionEngine {
  private validators = [
    new ExplainabilityValidator(), // Must run first to ensure output structure exists
    new SuitabilityValidator(),
    new ComplianceValidator(),
    new FinancialValidator(),
    new RiskValidator()
  ];

  async validateAndResolve(input: GovernanceInput): Promise<GovernanceOutput> {
    try {
      let allViolations: any[] = [];
      let finalDecision: DecisionType = "APPROVE";
      const finalRiskFlags: string[] = [];
      
      // We start with the original assuming it's valid, and mutate it if minor changes surface
      let workingOutput = { ...input.ai_output } as any; 

      // Execute all validators concurrently to fit inside the < 300ms latency budget
      const results = await Promise.all(this.validators.map(v => v.validate(input)));
      
      for (const res of results) {
        if (!res.passed) {
          // If a critical rule was broken by any validator
          finalDecision = "BLOCK";
        }
        
        if (res.violations && res.violations.length > 0) {
          allViolations = allViolations.concat(res.violations);
          
          const hasCritical = res.violations.some(v => v.severity === "CRITICAL");
          
          if (hasCritical) {
            // 4.2 Hard Blocks: Critical suitability mismatch CANNOT be overridden
            finalDecision = "BLOCK";
          } else if (finalDecision !== "BLOCK") {
            // Check for B2B Delegation Override for Minor Violations
            const isB2BOverride = input.b2b_context?.is_partner_override && 
                                  input.b2b_context?.delegated_governance_mode === "DELEGATED" &&
                                  input.b2b_context?.partner_ria_id;

            if (isB2BOverride) {
              finalDecision = "APPROVE"; // Partner takes absolute RIA responsibility for minor deviations
            } else {
              finalDecision = "MODIFY";
            }
          }
        }

        if (res.risk_metrics) {
          workingOutput.risk_profile = res.risk_metrics;
          finalRiskFlags.push(res.risk_metrics.risk_level);
        }

        if (res.suggested_modifications) {
          // Apply automatic minor structural modifications
          if (res.suggested_modifications.add_disclaimers) {
            workingOutput.recommendation = (workingOutput.recommendation || "") + "\n\nDisclaimer: " + res.suggested_modifications.add_disclaimers.join(" ");
          }
        }
      }

      const governanceOutput: GovernanceOutput = {
        decision: finalDecision,
        final_output: finalDecision === "BLOCK" ? { 
          message: "Recommendation cannot be provided due to compliance constraints", 
          reason: allViolations.map(v => v.message).join(" | "),
          fallback: true
        } : workingOutput,
        violations: allViolations,
        risk_flags: finalRiskFlags,
        compliance_status: finalDecision === "BLOCK" ? "FAIL" : "PASS"
      };

      // Ensure every log is written to the immutable tracing DB
      const auditId = await aiGovernanceAuditLogger.logGovernanceDecision(input, governanceOutput);
      governanceOutput.audit_id = auditId;

      return governanceOutput;

    } catch (e: any) {
      // 9.1 Failsafe Design: If AAGE itself crashes, we hard-block the output.
      return {
        decision: "BLOCK",
        final_output: { message: "Please consult human advisor", reason: "governance_engine_internal_fault", fallback: true },
        violations: [{ module: "AAGE_Core", severity: "CRITICAL", message: e.message || "Unknown error", code: "SYS_ERR"}],
        risk_flags: [],
        compliance_status: "FAIL"
      };
    }
  }
}

export const aiGovernanceEngine = new AIGovernanceDecisionEngine();
