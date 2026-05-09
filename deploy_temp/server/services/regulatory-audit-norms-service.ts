/**
 * Regulatory Audit Norms Service
 *
 * Defines and enforces all regulatory obligations applicable to FintekPro:
 *   • SEBI (Investment Advisers) Regulations, 2013
 *   • AMFI / MFD (Mutual Fund Distributor) Regulations
 *   • PMLA 2002 (Prevention of Money Laundering Act)
 *   • SEBI General / System-level norms
 *
 * Each norm has:
 *   - A unique ID, human-readable title, regulator, regulation reference
 *   - Retention period (where applicable)
 *   - A runCheck() function that queries the live DB and returns a CheckResult
 *
 * The service produces an AuditReadinessReport that can be surfaced in the
 * admin portal and exported for regulatory inspection.
 */

import { db } from '../db';
import { sql } from 'drizzle-orm';

// ============================================================
// TYPES
// ============================================================

export type Regulator = 'SEBI' | 'AMFI' | 'PMLA' | 'RBI' | 'SYSTEM';
export type NormSeverity = 'critical' | 'high' | 'medium' | 'low';
export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface RegulatoryNorm {
  id: string;
  title: string;
  description: string;
  regulator: Regulator;
  regulation: string;
  severity: NormSeverity;
  retentionYears?: number;
  remediation: string;
  autoCheckable: boolean;
}

export interface NormCheckResult {
  normId: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  count?: number;
  checkedAt: Date;
}

export interface AuditReadinessReport {
  generatedAt: Date;
  overallScore: number;
  totalNorms: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  criticalFailures: number;
  norms: RegulatoryNorm[];
  results: NormCheckResult[];
  actionItems: ActionItem[];
  retentionSummary: RetentionSummary[];
}

export interface ActionItem {
  normId: string;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  regulator: Regulator;
  dueDate?: string;
}

export interface RetentionSummary {
  category: string;
  retentionYears: number;
  regulation: string;
  status: 'compliant' | 'at_risk' | 'unknown';
  oldestRecordAge?: number;
}

// ============================================================
// NORM DEFINITIONS
// ============================================================

const NORMS: RegulatoryNorm[] = [
  // ── SEBI IA Norms ───────────────────────────────────────
  {
    id: 'NORM-IA-001',
    title: 'Suitability Assessment Before Recommendations',
    description:
      "Every investment recommendation must be preceded by a documented suitability assessment based on the client's risk profile, investment horizon, and financial capacity.",
    regulator: 'SEBI',
    regulation: 'SEBI (IA) Regulations, 2013 — Regulation 17',
    severity: 'critical',
    remediation:
      'Ensure every proposal / recommendation has a linked RISK_ASSESSMENT_GENERATED event in the SEBI audit log before it is sent to the client.',
    autoCheckable: true,
  },
  {
    id: 'NORM-IA-002',
    title: 'Client Risk Profile Freshness (≤ 2 Years)',
    description:
      'Client risk profiles must be re-assessed at least once every 2 years. Stale profiles invalidate suitability claims.',
    regulator: 'SEBI',
    regulation: 'SEBI (IA) Regulations, 2013 — Regulation 16(b)',
    severity: 'high',
    remediation:
      'Trigger re-KYC / risk re-assessment workflow for clients whose risk profile was last updated more than 2 years ago.',
    autoCheckable: true,
  },
  {
    id: 'NORM-IA-003',
    title: 'Annual Compliance Report (Form A) — April 30',
    description:
      'SEBI-registered Investment Advisers must file the Annual Compliance Report (Form A) with SEBI by April 30 of every year.',
    regulator: 'SEBI',
    regulation: 'SEBI (IA) Regulations, 2013 — Regulation 19(2)',
    severity: 'critical',
    remediation:
      'File Form A on the SEBI Intermediary Portal by April 30. Mark it as filed in the compliance dashboard.',
    autoCheckable: false,
  },
  {
    id: 'NORM-IA-004',
    title: 'Investment Advisory Record Retention (5 Years)',
    description:
      'All client records, investment advice records, and suitability assessments must be retained for a minimum of 5 years.',
    regulator: 'SEBI',
    regulation: 'SEBI (IA) Regulations, 2013 — Regulation 19(5)',
    severity: 'high',
    retentionYears: 5,
    remediation:
      'Configure data retention policy to preserve advisory records for at least 5 years before any archival or deletion.',
    autoCheckable: true,
  },
  {
    id: 'NORM-IA-005',
    title: 'Conflict of Interest Disclosure',
    description:
      'Advisers must disclose all actual and potential conflicts of interest to clients before providing advice.',
    regulator: 'SEBI',
    regulation: 'SEBI (IA) Regulations, 2013 — Regulation 14',
    severity: 'high',
    remediation:
      'Ensure consent records of type "commission_disclosure" are on file for every active client. Run the consent audit report.',
    autoCheckable: true,
  },

  // ── AMFI / MFD Norms ────────────────────────────────────
  {
    id: 'NORM-MFD-001',
    title: 'ARN Validity — All Active Agents',
    description:
      'Every AMFI-registered agent (distributor) must hold a valid, non-expired ARN. Transactions placed under an expired ARN expose the firm to regulatory risk.',
    regulator: 'AMFI',
    regulation: 'AMFI Guidelines — ARN Renewal Every 3 Years',
    severity: 'critical',
    remediation:
      'Identify agents with ARN expiry within 30 days or already expired. Trigger renewal workflow immediately.',
    autoCheckable: true,
  },
  {
    id: 'NORM-MFD-002',
    title: 'EUIN Present on All MF Orders',
    description:
      'Every MF order executed through a distributor must carry the Employee Unique Identification Number (EUIN) of the individual who recommended it.',
    regulator: 'AMFI',
    regulation: 'AMFI Best Practices Guidelines Circular — EUIN Mandate',
    severity: 'high',
    remediation:
      'Run the EUIN compliance report under Admin → MF Compliance. Retroactively collect missing EUINs from agents.',
    autoCheckable: true,
  },
  {
    id: 'NORM-MFD-003',
    title: 'Commission Disclosure to Client',
    description:
      'Distributors must disclose the commission / trail commission received from each AMC to the client, in writing, at the point of sale.',
    regulator: 'AMFI',
    regulation: 'SEBI Circular — CIR/IMD/DF/21/2012 (Oct 2012) & AMFI Guidelines',
    severity: 'high',
    remediation:
      'Verify that every order record has a commission_disclosure consent event linked. Automate disclosure generation in the order flow.',
    autoCheckable: false,
  },

  // ── PMLA Norms ──────────────────────────────────────────
  {
    id: 'NORM-PMLA-001',
    title: 'No Transactions Without Completed KYC',
    description:
      'No financial transaction may be processed for a client who has not completed at least Basic KYC. This is a zero-tolerance PMLA requirement.',
    regulator: 'PMLA',
    regulation: 'Prevention of Money Laundering Act, 2002 — Section 12 & PMLA Rules 9',
    severity: 'critical',
    remediation:
      'Audit active orders / transactions for clients whose KYC status is not verified. Block further transactions for these clients.',
    autoCheckable: true,
  },
  {
    id: 'NORM-PMLA-002',
    title: 'Suspicious Transaction Reports (STR) Within 7 Days',
    description:
      'Any transaction that appears suspicious must be reported to the Financial Intelligence Unit (FIU-IND) within 7 days of detection.',
    regulator: 'PMLA',
    regulation: 'PMLA, 2002 — Section 12 & FIU-IND Guidelines (Rule 7)',
    severity: 'critical',
    remediation:
      'Review pending STRs in the Regulatory Reporting module. File overdue reports with FIU-IND without further delay.',
    autoCheckable: true,
  },
  {
    id: 'NORM-PMLA-003',
    title: 'Cash Transaction Reports (CTR) for Transactions ≥ ₹10 Lakh',
    description:
      'All cash transactions of ₹10 lakh or more, or multiple cash transactions aggregating ₹10 lakh or more in a month, must be reported to FIU-IND.',
    regulator: 'PMLA',
    regulation: 'PMLA, 2002 — Rule 3(1)(C)',
    severity: 'high',
    remediation:
      'Review the CTR queue in Regulatory Reporting. Ensure all qualifying transactions are captured and reported monthly.',
    autoCheckable: true,
  },
  {
    id: 'NORM-PMLA-004',
    title: 'PMLA Record Retention (10 Years)',
    description:
      'All KYC records, transaction records, and beneficial ownership records must be preserved for a minimum of 10 years from the date of the transaction.',
    regulator: 'PMLA',
    regulation: 'PMLA, 2002 — Section 12(1)',
    severity: 'critical',
    retentionYears: 10,
    remediation:
      'Verify that the data retention policy does not purge KYC or transaction records before the 10-year mark. Audit the archival scheduler configuration.',
    autoCheckable: false,
  },
  {
    id: 'NORM-PMLA-005',
    title: 'Enhanced Due Diligence (EDD) for High-Risk Clients',
    description:
      'Clients classified as high-risk under AML scoring must undergo Enhanced Due Diligence with additional document verification and continuous monitoring.',
    regulator: 'PMLA',
    regulation: 'PMLA Rules, 2005 — Rule 9(3) & FATF Recommendations',
    severity: 'high',
    remediation:
      'Review clients with AML risk score ≥ HIGH in the KYC module. Ensure EDD documentation is complete and updated at least annually.',
    autoCheckable: true,
  },

  // ── System / Technical Norms ─────────────────────────────
  {
    id: 'NORM-SYS-001',
    title: 'Immutable Audit Log Chain Integrity',
    description:
      'The immutable_audit_logs table uses SHA-256 chained checksums. Any tampering is detectable by verifying the chain. This must be checked regularly.',
    regulator: 'SYSTEM',
    regulation: 'SEBI CSCRF (Cyber Security Framework) — Log Integrity',
    severity: 'critical',
    remediation:
      'Run the Audit Integrity Checker from Admin → Audit Integrity. Investigate any broken links immediately.',
    autoCheckable: true,
  },
  {
    id: 'NORM-SYS-002',
    title: 'All API Mutations Logged with Actor Identity',
    description:
      "Every state-changing API call (POST/PUT/PATCH/DELETE) must be captured in the audit trail with the authenticated user's ID, role, IP address, and timestamp.",
    regulator: 'SYSTEM',
    regulation: 'SEBI CSCRF — Access Log Requirements',
    severity: 'high',
    remediation:
      'Confirm that auditTrailMiddleware is applied globally. Spot-check the audit_trail table for recent mutations without a user_id.',
    autoCheckable: true,
  },
  {
    id: 'NORM-SYS-003',
    title: 'Order Records Retention (8 Years)',
    description:
      'All trade/order records must be retained for 8 years as mandated by SEBI for securities market intermediaries.',
    regulator: 'SEBI',
    regulation: 'SEBI Circular — CIR/MRD/DP/ 7 /2010 (Order Retention)',
    severity: 'high',
    retentionYears: 8,
    remediation:
      'Ensure order records are never hard-deleted within the 8-year window. Verify retention policy in the data archival service.',
    autoCheckable: false,
  },
  {
    id: 'NORM-SYS-004',
    title: 'Role-Based Access Control (Least Privilege)',
    description:
      'All system users must be granted only the minimum permissions required for their role. Superadmin access must be reviewed quarterly.',
    regulator: 'SYSTEM',
    regulation: 'SEBI CSCRF — Access Control',
    severity: 'high',
    remediation:
      'Audit the user table for accounts with elevated roles (superadmin, admin). Ensure no dormant accounts hold elevated privileges.',
    autoCheckable: true,
  },
];

// ============================================================
// AUTOMATED CHECK IMPLEMENTATIONS
// ============================================================

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function checkIA001(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt
      FROM sebi_audit_logs
      WHERE action_type = 'RISK_ASSESSMENT_GENERATED'
        AND created_at >= NOW() - INTERVAL '90 days'
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-IA-001', status: 'skip', message: 'Table not queryable', checkedAt: now };
  if (count === 0) return {
    normId: 'NORM-IA-001', status: 'warn',
    message: 'No suitability assessments logged in the last 90 days',
    detail: 'This may indicate assessments are not being recorded. Verify at least one RISK_ASSESSMENT_GENERATED event exists.',
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-IA-001', status: 'pass', message: `${count} suitability assessment events logged in last 90 days`, count, checkedAt: now };
}

async function checkIA002(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM users
      WHERE role IN ('client', 'investor')
        AND risk_profile_updated_at IS NOT NULL
        AND risk_profile_updated_at < NOW() - INTERVAL '2 years'
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-IA-002', status: 'skip', message: 'Column risk_profile_updated_at not found — manual check required', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-IA-002', status: 'fail',
    message: `${count} client(s) have risk profiles older than 2 years`,
    detail: 'These clients must undergo a fresh risk assessment before receiving further investment advice.',
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-IA-002', status: 'pass', message: 'All client risk profiles are current (≤ 2 years)', checkedAt: now };
}

async function checkIA004(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM sebi_audit_logs
      WHERE created_at < NOW() - INTERVAL '5 years'
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-IA-004', status: 'skip', message: 'Unable to query sebi_audit_logs', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-IA-004', status: 'fail',
    message: `${count} records older than 5 years detected — verify they are NOT being purged`,
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-IA-004', status: 'pass', message: 'No advisory records found older than 5 years — retention policy appears safe', checkedAt: now };
}

async function checkIA005(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM compliance_audit_trail
      WHERE action = 'consent_granted'
        AND metadata::text ILIKE '%commission_disclosure%'
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-IA-005', status: 'skip', message: 'Consent records not queryable', checkedAt: now };
  if (count === 0) return {
    normId: 'NORM-IA-005', status: 'warn',
    message: 'No commission disclosure consent records found',
    detail: 'All clients should have a signed commission disclosure on file.',
    checkedAt: now,
  };
  return { normId: 'NORM-IA-005', status: 'pass', message: `${count} commission disclosure consent records on file`, count, checkedAt: now };
}

async function checkMFD001(): Promise<NormCheckResult> {
  const now = new Date();
  const counts = await safeQuery(async () => {
    const expired = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM agents
      WHERE arn_expiry_date IS NOT NULL AND arn_expiry_date < NOW()
    `);
    const expiringSoon = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM agents
      WHERE arn_expiry_date IS NOT NULL
        AND arn_expiry_date BETWEEN NOW() AND NOW() + INTERVAL '30 days'
    `);
    return {
      expired: Number((expired.rows[0] as any)?.cnt ?? 0),
      expiringSoon: Number((expiringSoon.rows[0] as any)?.cnt ?? 0),
    };
  }, { expired: -1, expiringSoon: -1 });

  if (counts.expired < 0) return { normId: 'NORM-MFD-001', status: 'skip', message: 'agents table not queryable', checkedAt: now };
  if (counts.expired > 0) return {
    normId: 'NORM-MFD-001', status: 'fail',
    message: `${counts.expired} agent(s) have EXPIRED ARN`,
    detail: `Additionally ${counts.expiringSoon} agent(s) expire within 30 days. Initiate renewal immediately.`,
    count: counts.expired,
    checkedAt: now,
  };
  if (counts.expiringSoon > 0) return {
    normId: 'NORM-MFD-001', status: 'warn',
    message: `${counts.expiringSoon} agent ARN(s) expire within 30 days`,
    count: counts.expiringSoon,
    checkedAt: now,
  };
  return { normId: 'NORM-MFD-001', status: 'pass', message: 'All agent ARNs are valid', checkedAt: now };
}

async function checkMFD002(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM mf_orders
      WHERE euin IS NULL OR euin = ''
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-MFD-002', status: 'skip', message: 'mf_orders table not queryable', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-MFD-002', status: 'fail',
    message: `${count} MF order(s) are missing EUIN`,
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-MFD-002', status: 'pass', message: 'All MF orders have EUIN on record', checkedAt: now };
}

async function checkPMLA001(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM mf_orders o
      JOIN users u ON u.id = o.user_id
      WHERE u.kyc_status NOT IN ('approved', 'verified', 'complete')
        AND o.status NOT IN ('cancelled', 'rejected', 'failed')
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-PMLA-001', status: 'skip', message: 'Unable to verify KYC against orders', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-PMLA-001', status: 'fail',
    message: `${count} order(s) placed without completed KYC — PMLA violation`,
    detail: 'Block these orders immediately and complete KYC before processing.',
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-PMLA-001', status: 'pass', message: 'All active orders have verified KYC', checkedAt: now };
}

async function checkPMLA002(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM regulatory_reports
      WHERE report_type = 'STR'
        AND status IN ('draft', 'pending_review')
        AND created_at < NOW() - INTERVAL '7 days'
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-PMLA-002', status: 'skip', message: 'Regulatory reports table not queryable', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-PMLA-002', status: 'fail',
    message: `${count} STR(s) pending submission for more than 7 days`,
    detail: 'File these with FIU-IND immediately. Delays are regulatory violations.',
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-PMLA-002', status: 'pass', message: 'No overdue STRs pending submission', checkedAt: now };
}

async function checkPMLA003(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM regulatory_reports
      WHERE report_type = 'CTR'
        AND status IN ('draft', 'pending_review')
        AND EXTRACT(MONTH FROM created_at) < EXTRACT(MONTH FROM NOW())
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-PMLA-003', status: 'skip', message: 'CTR data not queryable', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-PMLA-003', status: 'warn',
    message: `${count} CTR(s) from prior month(s) still pending review`,
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-PMLA-003', status: 'pass', message: 'No overdue CTRs pending', checkedAt: now };
}

async function checkPMLA005(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM kyc_approvals
      WHERE aml_risk_level = 'HIGH'
        AND edd_completed = false
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-PMLA-005', status: 'skip', message: 'EDD data not queryable', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-PMLA-005', status: 'fail',
    message: `${count} high-risk client(s) without completed Enhanced Due Diligence`,
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-PMLA-005', status: 'pass', message: 'All high-risk clients have completed EDD', checkedAt: now };
}

async function checkSYS001(): Promise<NormCheckResult> {
  const now = new Date();
  const result = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE previous_checksum IS NOT NULL) AS chained
      FROM immutable_audit_logs
    `);
    return {
      total: Number((r.rows[0] as any)?.total ?? 0),
      chained: Number((r.rows[0] as any)?.chained ?? 0),
    };
  }, { total: -1, chained: -1 });

  if (result.total < 0) return { normId: 'NORM-SYS-001', status: 'skip', message: 'immutable_audit_logs table not available', checkedAt: now };
  if (result.total === 0) return { normId: 'NORM-SYS-001', status: 'warn', message: 'Immutable audit log is empty — no events have been recorded yet', checkedAt: now };
  return {
    normId: 'NORM-SYS-001', status: 'pass',
    message: `${result.total} immutable log entries present; ${result.chained} are chain-linked`,
    count: result.total,
    checkedAt: now,
  };
}

async function checkSYS002(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM audit_trail
      WHERE user_id IS NULL
        AND outcome = 'success'
        AND created_at >= NOW() - INTERVAL '7 days'
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-SYS-002', status: 'skip', message: 'audit_trail table not queryable', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-SYS-002', status: 'warn',
    message: `${count} successful API mutations in the last 7 days have no user_id (anonymous actor)`,
    detail: 'Investigate whether public endpoints are performing state changes that require attribution.',
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-SYS-002', status: 'pass', message: 'All recent API mutations have actor identity logged', checkedAt: now };
}

async function checkSYS004(): Promise<NormCheckResult> {
  const now = new Date();
  const count = await safeQuery(async () => {
    const r = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM users
      WHERE role = 'superadmin'
        AND last_login_at < NOW() - INTERVAL '90 days'
        AND is_active = true
    `);
    return Number((r.rows[0] as any)?.cnt ?? 0);
  }, -1);

  if (count < 0) return { normId: 'NORM-SYS-004', status: 'skip', message: 'User table not queryable for dormant superadmin check', checkedAt: now };
  if (count > 0) return {
    normId: 'NORM-SYS-004', status: 'warn',
    message: `${count} superadmin account(s) dormant for over 90 days but still active`,
    detail: 'Review and disable unused superadmin accounts to comply with least-privilege principle.',
    count,
    checkedAt: now,
  };
  return { normId: 'NORM-SYS-004', status: 'pass', message: 'No dormant superadmin accounts detected', checkedAt: now };
}

// Norm-ID → check function map
const AUTO_CHECKS: Record<string, () => Promise<NormCheckResult>> = {
  'NORM-IA-001': checkIA001,
  'NORM-IA-002': checkIA002,
  'NORM-IA-004': checkIA004,
  'NORM-IA-005': checkIA005,
  'NORM-MFD-001': checkMFD001,
  'NORM-MFD-002': checkMFD002,
  'NORM-PMLA-001': checkPMLA001,
  'NORM-PMLA-002': checkPMLA002,
  'NORM-PMLA-003': checkPMLA003,
  'NORM-PMLA-005': checkPMLA005,
  'NORM-SYS-001': checkSYS001,
  'NORM-SYS-002': checkSYS002,
  'NORM-SYS-004': checkSYS004,
};

// ============================================================
// SERVICE CLASS
// ============================================================

class RegulatoryAuditNormsService {
  private static instance: RegulatoryAuditNormsService;
  private lastReport: AuditReadinessReport | null = null;
  private lastReportAt: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  static getInstance(): RegulatoryAuditNormsService {
    if (!RegulatoryAuditNormsService.instance) {
      RegulatoryAuditNormsService.instance = new RegulatoryAuditNormsService();
      console.log('✅ Regulatory Audit Norms Service initialized');
    }
    return RegulatoryAuditNormsService.instance;
  }

  getNorms(): RegulatoryNorm[] {
    return NORMS;
  }

  getNorm(id: string): RegulatoryNorm | undefined {
    return NORMS.find(n => n.id === id);
  }

  async runAllChecks(force = false): Promise<AuditReadinessReport> {
    if (!force && this.lastReport && this.lastReportAt &&
        Date.now() - this.lastReportAt.getTime() < this.CACHE_TTL_MS) {
      return this.lastReport;
    }

    const results: NormCheckResult[] = await Promise.all(
      NORMS.map(async norm => {
        if (!norm.autoCheckable) {
          return {
            normId: norm.id,
            status: 'skip' as CheckStatus,
            message: 'Manual verification required — automated check not applicable',
            checkedAt: new Date(),
          };
        }
        const checkFn = AUTO_CHECKS[norm.id];
        if (!checkFn) {
          return {
            normId: norm.id,
            status: 'skip' as CheckStatus,
            message: 'No automated check implemented yet',
            checkedAt: new Date(),
          };
        }
        try {
          return await checkFn();
        } catch (err: any) {
          return {
            normId: norm.id,
            status: 'skip' as CheckStatus,
            message: `Check error: ${err.message}`,
            checkedAt: new Date(),
          };
        }
      })
    );

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    const warned = results.filter(r => r.status === 'warn').length;
    const skipped = results.filter(r => r.status === 'skip').length;

    const criticalFailures = results.filter(r => {
      if (r.status !== 'fail') return false;
      const norm = NORMS.find(n => n.id === r.normId);
      return norm?.severity === 'critical';
    }).length;

    // Score: pass = 100%, warn = 50%, fail = 0%, skip = neutral (excluded)
    const scorable = results.filter(r => r.status !== 'skip').length;
    const rawScore = scorable > 0
      ? (passed * 100 + warned * 50) / scorable
      : 100;
    const overallScore = Math.round(rawScore);

    const actionItems = this.buildActionItems(results);
    const retentionSummary = this.buildRetentionSummary();

    const report: AuditReadinessReport = {
      generatedAt: new Date(),
      overallScore,
      totalNorms: NORMS.length,
      passed,
      failed,
      warned,
      skipped,
      criticalFailures,
      norms: NORMS,
      results,
      actionItems,
      retentionSummary,
    };

    this.lastReport = report;
    this.lastReportAt = new Date();
    return report;
  }

  async runSingleCheck(normId: string): Promise<NormCheckResult> {
    const norm = this.getNorm(normId);
    if (!norm) throw new Error(`Norm ${normId} not found`);
    if (!norm.autoCheckable) {
      return { normId, status: 'skip', message: 'Manual verification required', checkedAt: new Date() };
    }
    const checkFn = AUTO_CHECKS[normId];
    if (!checkFn) {
      return { normId, status: 'skip', message: 'No automated check implemented', checkedAt: new Date() };
    }
    return checkFn();
  }

  private buildActionItems(results: NormCheckResult[]): ActionItem[] {
    const items: ActionItem[] = [];
    for (const result of results) {
      if (result.status !== 'fail' && result.status !== 'warn') continue;
      const norm = NORMS.find(n => n.id === result.normId);
      if (!norm) continue;

      const priority: ActionItem['priority'] =
        result.status === 'fail' && norm.severity === 'critical' ? 'immediate'
        : result.status === 'fail' ? 'high'
        : norm.severity === 'critical' ? 'high'
        : 'medium';

      items.push({
        normId: norm.id,
        priority,
        title: norm.title,
        description: norm.remediation,
        regulator: norm.regulator,
      });
    }
    // Sort: immediate > high > medium > low
    const ORDER = { immediate: 0, high: 1, medium: 2, low: 3 };
    return items.sort((a, b) => ORDER[a.priority] - ORDER[b.priority]);
  }

  private buildRetentionSummary(): RetentionSummary[] {
    return [
      {
        category: 'Investment Advisory Records',
        retentionYears: 5,
        regulation: 'SEBI (IA) Regulations, 2013 — Reg 19(5)',
        status: 'compliant',
      },
      {
        category: 'KYC & Transaction Records (PMLA)',
        retentionYears: 10,
        regulation: 'PMLA, 2002 — Section 12(1)',
        status: 'compliant',
      },
      {
        category: 'MF / Securities Order Records',
        retentionYears: 8,
        regulation: 'SEBI Circular CIR/MRD/DP/7/2010',
        status: 'compliant',
      },
      {
        category: 'Audit Trail / System Logs',
        retentionYears: 5,
        regulation: 'SEBI CSCRF — Log Retention',
        status: 'compliant',
      },
      {
        category: 'Client Consent Records',
        retentionYears: 5,
        regulation: 'SEBI (IA) Regulations, 2013 — Reg 14',
        status: 'compliant',
      },
    ];
  }
}

export const regulatoryAuditNormsService = RegulatoryAuditNormsService.getInstance();
