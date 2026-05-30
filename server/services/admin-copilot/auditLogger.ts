/**
 * auditLogger.ts — Immutable Admin Copilot Audit Logger
 * FASP-AI v1.0 compliant — INSERT ONLY, NEVER UPDATE existing rows.
 *
 * Purpose : Single source of truth for every AI action and admin decision.
 * Inputs  : AuditEntry object
 * Outputs : audit_id (UUID)
 * Edge    : DB failure → logs to Cloud Logging as fallback (never throws upstream)
 */

import { db } from '../../db';
import { aiAuditLogs } from '@shared/schema/admin-copilot';
import { randomUUID } from 'crypto';

export interface AuditEntry {
  userId?:           string;
  userRole?:         string;
  agentType:         string;
  agentAction:       string;
  entityId?:         string;
  entityType?:       string;
  inputContext?:     Record<string, unknown>;
  outputSummary?:    string;
  confidenceScore?:  number;
  modelVersion?:     string;
  approvalStatus?:   string;
  approvingAdmin?:   string;
  externalApiCalled?: boolean;
  externalService?:  string;
  externalCallStatus?: string;
  externalCallMs?:   number;
  latencyMs?:        number;
  status?:           string;
  errorCode?:        string;
  errorMessage?:     string;
  retryable?:        boolean;
  source?:           string;
}

/**
 * Append an immutable audit log entry.
 * @returns audit_id — include this in every AI output for traceability
 */
export async function auditLog(entry: AuditEntry): Promise<string> {
  const auditId = randomUUID();

  try {
    await db.insert(aiAuditLogs).values({
      ...entry,
      id:           auditId,
      modelVersion: entry.modelVersion ?? 'gemini-2.0-flash',
      source:       entry.source ?? 'api',
      status:       entry.status ?? 'success',
    });
  } catch (dbErr: any) {
    // Fallback: emit to Cloud Logging — never fail the caller
    console.error('[AuditLogger] DB insert failed — fallback to console log', {
      auditId,
      agentType:   entry.agentType,
      agentAction: entry.agentAction,
      error:       dbErr?.message,
    });
    console.log('[AUDIT_FALLBACK]', JSON.stringify({ auditId, ...entry }));
  }

  return auditId;
}

/**
 * Helper: structured log emitter (follows GCR event format)
 */
export function logCopilotEvent(
  event:     string,
  userId:    string | undefined,
  latencyMs: number,
  status:    'success' | 'failure' | 'partial',
  extra?:    Record<string, unknown>,
): void {
  console.log(JSON.stringify({
    event,
    user_id:    userId,
    latency_ms: latencyMs,
    status,
    ...extra,
    timestamp: new Date().toISOString(),
  }));
}
