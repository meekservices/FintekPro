import { db } from '../db';
import { mutualFunds } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import mfNamingComplianceService from './mf-naming-compliance-service';
import mfLifecycleGlidePathService, { LifecycleMetadata } from './mf-lifecycle-glide-path-service';

export type ComplianceStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'BLOCKED'
  | 'OVERLAP_BREACH'
  | 'GLIDE_PATH_INVALID'
  | 'REQUIRES_REVIEW'
  | 'APPROVED';

interface TransitionResult {
  success: boolean;
  error?: string;
  fromStatus: ComplianceStatus | null;
  toStatus: ComplianceStatus;
}

interface FullComplianceCheckResult {
  schemeCode: string;
  finalStatus: ComplianceStatus;
  checks: {
    naming: { status: 'PASSED' | 'FAILED' | 'SKIPPED'; reason?: string };
    lifecycle: { valid: boolean; violations: string[] } | null;
    overlap: { breached: boolean; overlapPct?: number } | null;
  };
}

// ── Valid state transitions — only these paths are allowed ──────────────────
const VALID_TRANSITIONS: Record<ComplianceStatus, ComplianceStatus[]> = {
  PENDING:           ['VALIDATED', 'REQUIRES_REVIEW', 'BLOCKED', 'OVERLAP_BREACH', 'GLIDE_PATH_INVALID'],
  REQUIRES_REVIEW:   ['VALIDATED', 'BLOCKED', 'APPROVED'],
  VALIDATED:         ['OVERLAP_BREACH', 'GLIDE_PATH_INVALID', 'BLOCKED', 'APPROVED'],
  APPROVED:          ['OVERLAP_BREACH', 'GLIDE_PATH_INVALID', 'BLOCKED'],
  BLOCKED:           ['REQUIRES_REVIEW'],
  OVERLAP_BREACH:    ['REQUIRES_REVIEW'],
  GLIDE_PATH_INVALID: ['REQUIRES_REVIEW'],
};

// States from which only admin can transition out
const ADMIN_ONLY_FROM: ComplianceStatus[] = ['BLOCKED', 'OVERLAP_BREACH', 'GLIDE_PATH_INVALID'];

class MfComplianceStateMachine {
  private static instance: MfComplianceStateMachine;

  static getInstance(): MfComplianceStateMachine {
    if (!this.instance) {
      this.instance = new MfComplianceStateMachine();
    }
    return this.instance;
  }

  async transition(
    schemeCode: string,
    toStatus: ComplianceStatus,
    reason: string,
    triggeredBy: string,
    isAdmin = false
  ): Promise<TransitionResult> {
    // Fetch current status
    const [fund] = await db.select({
      complianceStatus: mutualFunds.complianceStatus,
    }).from(mutualFunds).where(eq(mutualFunds.schemeCode, schemeCode)).limit(1);

    const fromStatus = (fund?.complianceStatus as ComplianceStatus | null) ?? null;
    const currentStatus: ComplianceStatus = fromStatus || 'PENDING';

    // Check admin-only constraint
    if (ADMIN_ONLY_FROM.includes(currentStatus) && !isAdmin) {
      return {
        success: false,
        error: `State ${currentStatus} → ${toStatus} requires admin authorization.`,
        fromStatus,
        toStatus,
      };
    }

    // Validate transition path
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(toStatus)) {
      return {
        success: false,
        error: `Invalid transition: ${currentStatus} → ${toStatus}. Allowed targets: ${allowed.join(', ')}.`,
        fromStatus,
        toStatus,
      };
    }

    // Apply the transition
    try {
      await db.execute(sql`
        UPDATE mutual_funds
        SET compliance_status = ${toStatus}
        WHERE scheme_code = ${schemeCode}
      `);

      await db.execute(sql`
        INSERT INTO mf_compliance_state_log (scheme_code, from_status, to_status, reason, triggered_by)
        VALUES (${schemeCode}, ${fromStatus}, ${toStatus}, ${reason}, ${triggeredBy})
      `);

      return { success: true, fromStatus, toStatus };
    } catch (e: any) {
      return {
        success: false,
        error: `DB error during transition: ${e.message}`,
        fromStatus,
        toStatus,
      };
    }
  }

  async runFullComplianceCheck(
    schemeCode: string,
    triggeredBy = 'SEBI_COMPLIANCE_ENGINE',
    isAdmin = false
  ): Promise<FullComplianceCheckResult> {
    const [fund] = await db.select({
      schemeCode: mutualFunds.schemeCode,
      schemeName: mutualFunds.schemeName,
      category: mutualFunds.category,
      lifecycleMetadata: mutualFunds.lifecycleMetadata,
      complianceStatus: mutualFunds.complianceStatus,
    }).from(mutualFunds).where(eq(mutualFunds.schemeCode, schemeCode)).limit(1);

    if (!fund) {
      return {
        schemeCode,
        finalStatus: 'PENDING',
        checks: { naming: { status: 'SKIPPED', reason: 'Scheme not found' }, lifecycle: null, overlap: null },
      };
    }

    const checks: FullComplianceCheckResult['checks'] = {
      naming: { status: 'SKIPPED' },
      lifecycle: null,
      overlap: null,
    };

    // 1. Naming check
    const namingResult = await mfNamingComplianceService.validateAndPersist(
      schemeCode,
      fund.schemeName || '',
      fund.category,
      fund.lifecycleMetadata
    );
    checks.naming = { status: namingResult.status, reason: namingResult.reason };

    if (namingResult.status === 'FAILED') {
      await this.transition(schemeCode, 'BLOCKED', `Naming validation failed: ${namingResult.reason}`, triggeredBy, true);
      return { schemeCode, finalStatus: 'BLOCKED', checks };
    }

    // 2. Lifecycle glide path check
    if (fund.lifecycleMetadata && typeof fund.lifecycleMetadata === 'object') {
      const meta = fund.lifecycleMetadata as LifecycleMetadata;
      const lifecycleResult = await mfLifecycleGlidePathService.validateAndPersist(schemeCode, meta);
      checks.lifecycle = { valid: lifecycleResult.valid, violations: lifecycleResult.violations };

      if (!lifecycleResult.valid) {
        await this.transition(
          schemeCode,
          'GLIDE_PATH_INVALID',
          `Glide path validation failed: ${lifecycleResult.violations.join('; ')}`,
          triggeredBy,
          true
        );
        return { schemeCode, finalStatus: 'GLIDE_PATH_INVALID', checks };
      }
    }

    // 3. Overlap check — read from mf_overlap_matrix
    try {
      const overlapResult = await db.execute(sql`
        SELECT overlap_percent, breach_flag
        FROM mf_overlap_matrix
        WHERE (scheme_code_a = ${schemeCode} OR scheme_code_b = ${schemeCode})
          AND breach_flag = true
        LIMIT 1
      `);
      const rows = (overlapResult as any).rows || [];
      if (rows.length > 0) {
        checks.overlap = { breached: true, overlapPct: parseFloat(rows[0].overlap_percent) };
        await this.transition(
          schemeCode,
          'OVERLAP_BREACH',
          `Overlap breach detected: ${rows[0].overlap_percent}% overlap`,
          triggeredBy,
          true
        );
        return { schemeCode, finalStatus: 'OVERLAP_BREACH', checks };
      } else {
        checks.overlap = { breached: false };
      }
    } catch (_) {
      checks.overlap = null;
    }

    // All checks passed → VALIDATED
    const currentStatus = fund.complianceStatus as ComplianceStatus;
    if (currentStatus !== 'APPROVED') {
      await this.transition(schemeCode, 'VALIDATED', 'All compliance checks passed', triggeredBy, isAdmin);
    }

    return {
      schemeCode,
      finalStatus: currentStatus === 'APPROVED' ? 'APPROVED' : 'VALIDATED',
      checks,
    };
  }
}

export const mfComplianceStateMachine = MfComplianceStateMachine.getInstance();
export default mfComplianceStateMachine;
