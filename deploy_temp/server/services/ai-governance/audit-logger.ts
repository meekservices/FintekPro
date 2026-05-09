import { db } from "../../db";
import { aiGovernanceAuditLogs } from "../../../shared/schema/ai";
import { GovernanceInput, GovernanceOutput } from "./types";
import { v4 as uuidv4 } from "uuid";

export class AIGovernanceAuditLogger {
  async logGovernanceDecision(
    input: GovernanceInput, 
    output: GovernanceOutput,
    traceId?: string
  ): Promise<string> {
    const auditId = uuidv4();
    
    // We do not await this insertion, it fires in the background (fire-and-forget) to minimize latency overhead < 300ms
    db.insert(aiGovernanceAuditLogs)
      .values({
        auditId,
        userId: input.user_id,
        inputQuery: input.query,
        aiRawOutput: input.ai_output || {},
        finalOutput: output.final_output,
        decision: output.decision,
        violations: output.violations,
        riskFlags: output.risk_flags || [],
        modelVersion: input.ai_output?.model_version || "unknown-version",
        traceId: traceId || input.trace_id || auditId
      })
      .execute()
      .catch((err) => {
        console.error(`[AAGE Critical Failure] Failed to append AI Governance Log: ${err.message}`);
      });
      
    return auditId;
  }
}

export const aiGovernanceAuditLogger = new AIGovernanceAuditLogger();
