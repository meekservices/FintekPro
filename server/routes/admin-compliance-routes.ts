/**
 * Admin Compliance Dashboard Routes
 *
 * Read-only query surface over the existing kycAuditLogs and kycConsentLogs
 * tables. No new data model — surfaces existing structured audit data with
 * pagination, filtering, and SEBI-required report generation.
 *
 * All routes require admin role. Zero trust — validate all query parameters.
 *
 * Endpoints:
 *  GET /api/admin/compliance/audit           — All audit events with filters
 *  GET /api/admin/compliance/assisted-access — Agent acting-as events per user
 *  GET /api/admin/compliance/kra-reuse       — All cross-broker KRA data shares
 *  GET /api/admin/compliance/summary/:userId — Per-user compliance summary
 *
 * GCR Rules:
 *  - Paginated responses: page, limit, total in all list responses
 *  - Structured logging on each query: { event, admin_id, query_params, latency_ms }
 *  - PAN/Aadhaar values NEVER returned — only access log metadata
 *  - Admin access to compliance data is itself audit-logged
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { kycAuditLogs, kycConsentLogs, kycVault } from "@shared/schema";
import { and, eq, gte, lte, desc, count, sql } from "drizzle-orm";
import { logger } from "../logger";

export const adminComplianceRouter = Router();

// ── Admin auth guard ──────────────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: Function) {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({
      success: false,
      error: { error_code: "UNAUTHORIZED", message: "Authentication required", retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
  const role = (user.role ?? user.userType ?? "").toLowerCase();
  if (!["admin", "superadmin"].includes(role)) {
    return res.status(403).json({
      success: false,
      error: { error_code: "INSUFFICIENT_ROLE", message: "Admin access required", retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
  return next();
}

const auditQuerySchema = z.object({
  userId:     z.string().optional(),
  accessType: z.string().optional(),
  from:       z.string().optional(), // ISO date
  to:         z.string().optional(), // ISO date
  page:       z.coerce.number().min(1).default(1),
  limit:      z.coerce.number().min(1).max(200).default(50),
});

/**
 * GET /api/admin/compliance/audit
 *
 * Returns all KYC audit log entries matching the filters.
 * Supports pagination, date range filtering, and access-type filtering.
 *
 * Does NOT return PAN, Aadhaar, or SSN values — only access metadata.
 */
adminComplianceRouter.get("/audit", requireAdmin, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const adminUser = (req as any).user;

  const parse = auditQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { userId, accessType, from, to, page, limit } = parse.data;
  const offset = (page - 1) * limit;

  try {
    // Build conditions
    const conditions = [];
    if (userId) conditions.push(eq(kycAuditLogs.userId, userId));
    if (accessType) conditions.push(eq(kycAuditLogs.accessType, accessType));
    if (from) conditions.push(gte(kycAuditLogs.accessedAt, new Date(from)));
    if (to)   conditions.push(lte(kycAuditLogs.accessedAt, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db.select({
        id:                kycAuditLogs.id,
        userId:            kycAuditLogs.userId,
        accessedBy:        kycAuditLogs.accessedBy,
        accessType:        kycAuditLogs.accessType,
        purpose:           kycAuditLogs.purpose,
        dataFieldsAccessed: kycAuditLogs.dataFieldsAccessed,
        externalParty:     kycAuditLogs.externalParty,
        ipAddress:         kycAuditLogs.ipAddress,
        accessStatus:      kycAuditLogs.accessStatus,
        regulatoryPurpose: kycAuditLogs.regulatoryPurpose,
        accessedAt:        kycAuditLogs.accessedAt,
      })
        .from(kycAuditLogs)
        .where(where)
        .orderBy(desc(kycAuditLogs.accessedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(kycAuditLogs).where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;

    logger.info("[AdminCompliance] Audit query executed", {
      event: "ADMIN_COMPLIANCE_AUDIT_QUERY",
      admin_id: adminUser.id,
      filters: { userId, accessType, from, to },
      result_count: rows.length,
      total,
      latency_ms: Date.now() - startTs,
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    logger.error("[AdminCompliance] Audit query error", { message: error.message });
    return res.status(500).json({
      success: false,
      error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

/**
 * GET /api/admin/compliance/assisted-access
 *
 * Returns all agent acting-on-behalf-of events (AGENT_DELEGATION_AUTHORIZED
 * and agent_delegation_request audit entries) for compliance audit.
 *
 * This is the SEBI-required "assisted access" log — every time an agent
 * acted on behalf of an investor must be visible with timestamps showing:
 *  - When the agent requested (agent_delegation_request)
 *  - When the investor authorized (agent_delegation_authorized)
 *  - Which scope was authorized
 */
adminComplianceRouter.get("/assisted-access", requireAdmin, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const adminUser = (req as any).user;

  const parse = auditQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { userId, from, to, page, limit } = parse.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [
      sql`${kycAuditLogs.accessType} IN ('agent_delegation_request', 'agent_delegation_authorized')`,
    ];
    if (userId) conditions.push(eq(kycAuditLogs.userId, userId));
    if (from)   conditions.push(gte(kycAuditLogs.accessedAt, new Date(from)));
    if (to)     conditions.push(lte(kycAuditLogs.accessedAt, new Date(to)));

    const where = and(...conditions);

    const [rows, totalRows] = await Promise.all([
      db.select({
        id:           kycAuditLogs.id,
        userId:       kycAuditLogs.userId,
        accessedBy:   kycAuditLogs.accessedBy, // agent ID
        accessType:   kycAuditLogs.accessType,  // request | authorized
        purpose:      kycAuditLogs.purpose,
        dataFieldsAccessed: kycAuditLogs.dataFieldsAccessed, // scope
        ipAddress:    kycAuditLogs.ipAddress,
        accessStatus: kycAuditLogs.accessStatus,
        accessedAt:   kycAuditLogs.accessedAt,
      })
        .from(kycAuditLogs)
        .where(where)
        .orderBy(desc(kycAuditLogs.accessedAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(kycAuditLogs).where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;

    logger.info("[AdminCompliance] Assisted-access query", {
      event: "ADMIN_COMPLIANCE_ASSISTED_ACCESS_QUERY",
      admin_id: adminUser.id,
      result_count: rows.length,
      total,
      latency_ms: Date.now() - startTs,
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

/**
 * GET /api/admin/compliance/kra-reuse
 *
 * Returns all KYC consent ledger entries representing cross-broker KRA data
 * sharing events. Each entry shows: user, broker, field set hash, and timestamp.
 *
 * This is the SEBI KRA reuse audit trail — regulators can verify that every
 * cross-broker share had consent written BEFORE the share occurred.
 */
adminComplianceRouter.get("/kra-reuse", requireAdmin, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const adminUser = (req as any).user;

  const parse = auditQuerySchema.safeParse(req.query);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { userId, from, to, page, limit } = parse.data;
  const offset = (page - 1) * limit;

  try {
    const conditions = [];
    if (userId) conditions.push(eq(kycConsentLogs.userId, userId));
    if (from)   conditions.push(gte(kycConsentLogs.consentTimestamp, new Date(from)));
    if (to)     conditions.push(lte(kycConsentLogs.consentTimestamp, new Date(to)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, totalRows] = await Promise.all([
      db.select()
        .from(kycConsentLogs)
        .where(where)
        .orderBy(desc(kycConsentLogs.consentTimestamp))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(kycConsentLogs).where(where),
    ]);

    const total = totalRows[0]?.total ?? 0;

    logger.info("[AdminCompliance] KRA-reuse consent query", {
      event: "ADMIN_COMPLIANCE_KRA_REUSE_QUERY",
      admin_id: adminUser.id,
      result_count: rows.length,
      total,
      latency_ms: Date.now() - startTs,
    });

    return res.json({
      success: true,
      data: rows,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

/**
 * GET /api/admin/compliance/summary/:userId
 *
 * Per-user compliance summary: KYC status, audit event counts by type,
 * consent log count, last access timestamp, and broker submissions.
 */
adminComplianceRouter.get("/summary/:userId", requireAdmin, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const adminUser = (req as any).user;
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: { error_code: "MISSING_USER_ID", message: "userId is required", retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  try {
    const [auditCounts, consentCount, lastAuditEntry, kycVaultStatus] = await Promise.all([
      // Count audit events by type
      db.select({
        accessType: kycAuditLogs.accessType,
        count: count(),
      })
        .from(kycAuditLogs)
        .where(eq(kycAuditLogs.userId, userId))
        .groupBy(kycAuditLogs.accessType),
      // Count consent entries
      db.select({ total: count() })
        .from(kycConsentLogs)
        .where(eq(kycConsentLogs.userId, userId)),
      db.select({ createdAt: kycAuditLogs.accessedAt })
        .from(kycAuditLogs)
        .where(eq(kycAuditLogs.userId, userId))
        .orderBy(desc(kycAuditLogs.accessedAt))
        .limit(1),
      // KYC vault status (non-PII fields only)
      db.select({
        kycStatus: kycVault.kycStatus,
        isReusable: kycVault.isReusable,
        kycVerifiedAt: kycVault.kycVerifiedAt,
        source: kycVault.source,
      }).from(kycVault).where(eq(kycVault.userId, userId)).limit(1),
    ]);

    logger.info("[AdminCompliance] Per-user summary query", {
      event: "ADMIN_COMPLIANCE_SUMMARY_QUERY",
      admin_id: adminUser.id,
      target_user_id: userId,
      latency_ms: Date.now() - startTs,
    });

    return res.json({
      success: true,
      data: {
        userId,
        kycVault: kycVaultStatus[0] ?? null,
        auditEventCounts: auditCounts.reduce(
          (acc: Record<string, number>, row: any) => {
            acc[row.accessType] = Number(row.count);
            return acc;
          },
          {},
        ),
        totalConsentEntries: Number(consentCount[0]?.total ?? 0),
        lastAuditAt: lastAuditEntry[0]?.createdAt ?? null,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: { error_code: "INTERNAL_ERROR", message: error.message, retryable: true },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});
