/**
 * Admin Compliance Dashboard Routes
 *
 * GET /api/admin/compliance/audit           — paginated KYC audit log
 * GET /api/admin/compliance/assisted-access — agent acting-as sessions
 * GET /api/admin/compliance/kra-reuse       — consent ledger per user
 *
 * All routes require ADMIN role.
 * Response shape: { success, data, meta: { timestamp, version, page, limit, total } }
 *
 * FASP-AI GCR Rules:
 *  - PAN, Aadhaar, SSN never appear in responses — field names only
 *  - Structured logs: { event, admin_id, filters, result_count, latency_ms, status }
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "../db";
import { kycAuditLogs, kycConsentLogs, regulatoryAuditPacks } from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../logger";

export const adminComplianceRouter = Router();
const API_VERSION = "v1.0.0";
const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE_LIMIT = 50;

// ── Response helpers ──────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, meta?: Record<string, unknown>) {
  return res.status(200).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: API_VERSION, ...meta },
  });
}

function errResp(res: Response, error_code: string, message: string, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { error_code, message, retryable: false },
    meta: { timestamp: new Date().toISOString(), version: API_VERSION },
  });
}

// ── Shared query param schema ─────────────────────────────────────────────────

const auditQuerySchema = z.object({
  userId:     z.string().optional(),
  accessedBy: z.string().optional(),
  accessType: z.enum(["read", "write", "share"]).optional(),
  from:       z.string().datetime().optional(),
  to:         z.string().datetime().optional(),
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

const consentQuerySchema = z.object({
  userId:    z.string().optional(),
  partnerId: z.string().optional(),
  from:      z.string().datetime().optional(),
  to:        z.string().datetime().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
});

// ── GET /api/admin/compliance/audit ──────────────────────────────────────────
// Full KYC audit trail — every read/write/share on every user vault.

adminComplianceRouter.get(
  "/audit",
  requireAdmin,
  async (req: Request, res: Response) => {
    const startTs = Date.now();
    const adminId = (req as any).user?.id;

    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) return errResp(res, "VALIDATION_ERROR", parsed.error.message);

    const { userId, accessedBy, accessType, from, to, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (userId)     conditions.push(eq(kycAuditLogs.userId, userId));
      if (accessedBy) conditions.push(eq(kycAuditLogs.accessedBy, accessedBy));
      if (accessType) conditions.push(eq(kycAuditLogs.accessType, accessType));
      if (from)       conditions.push(gte(kycAuditLogs.accessedAt, new Date(from)));
      if (to)         conditions.push(lte(kycAuditLogs.accessedAt, new Date(to)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [{ total }]] = await Promise.all([
        db.select().from(kycAuditLogs).where(whereClause)
          .orderBy(desc(kycAuditLogs.accessedAt)).limit(limit).offset(offset),
        db.select({ total: sql<number>`COUNT(*)::int` }).from(kycAuditLogs).where(whereClause),
      ]);

      logger.info("ADMIN_COMPLIANCE_AUDIT_READ", {
        event: "ADMIN_COMPLIANCE_AUDIT_READ", admin_id: adminId,
        filters: { userId, accessedBy, accessType, from, to },
        result_count: rows.length, total, latency_ms: Date.now() - startTs, status: "success",
      });

      return ok(res, rows, { page, limit, total, pages: Math.ceil(total / limit) });
    } catch (e: unknown) {
      logger.error("ADMIN_COMPLIANCE_AUDIT_ERROR", { admin_id: adminId, error: e instanceof Error ? e.message : String(e) });
      return errResp(res, "INTERNAL_ERROR", "Failed to fetch audit log", 500);
    }
  }
);

// ── GET /api/admin/compliance/assisted-access ─────────────────────────────────
// Shows all agent acting-as sessions from the audit log (accessedBy starts "agent:").

adminComplianceRouter.get(
  "/assisted-access",
  requireAdmin,
  async (req: Request, res: Response) => {
    const startTs = Date.now();
    const adminId = (req as any).user?.id;

    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) return errResp(res, "VALIDATION_ERROR", parsed.error.message);

    const { userId, from, to, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    try {
      const conditions = [sql`${kycAuditLogs.accessedBy} LIKE 'agent:%'`];
      if (userId) conditions.push(eq(kycAuditLogs.userId, userId));
      if (from)   conditions.push(gte(kycAuditLogs.accessedAt, new Date(from)));
      if (to)     conditions.push(lte(kycAuditLogs.accessedAt, new Date(to)));

      const whereClause = and(...conditions);

      const [rows, [{ total }]] = await Promise.all([
        db.select().from(kycAuditLogs).where(whereClause)
          .orderBy(desc(kycAuditLogs.accessedAt)).limit(limit).offset(offset),
        db.select({ total: sql<number>`COUNT(*)::int` }).from(kycAuditLogs).where(whereClause),
      ]);

      logger.info("ADMIN_COMPLIANCE_ASSISTED_ACCESS_READ", {
        event: "ADMIN_COMPLIANCE_ASSISTED_ACCESS_READ", admin_id: adminId,
        filters: { userId, from, to }, result_count: rows.length, total,
        latency_ms: Date.now() - startTs, status: "success",
      });

      return ok(res, rows, { page, limit, total, pages: Math.ceil(total / limit) });
    } catch (e: unknown) {
      logger.error("ADMIN_COMPLIANCE_ASSISTED_ACCESS_ERROR", { admin_id: adminId, error: e instanceof Error ? e.message : String(e) });
      return errResp(res, "INTERNAL_ERROR", "Failed to fetch assisted access log", 500);
    }
  }
);

// ── GET /api/admin/compliance/kra-reuse ───────────────────────────────────────
// Consent ledger — every broker every user's data was shared with, and when.
// Required for SEBI data governance: "show every broker this user's data has been shared with".

adminComplianceRouter.get(
  "/kra-reuse",
  requireAdmin,
  async (req: Request, res: Response) => {
    const startTs = Date.now();
    const adminId = (req as any).user?.id;

    const parsed = consentQuerySchema.safeParse(req.query);
    if (!parsed.success) return errResp(res, "VALIDATION_ERROR", parsed.error.message);

    const { userId, partnerId, from, to, page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    try {
      const conditions = [];
      if (userId)    conditions.push(eq(kycConsentLogs.userId, userId));
      if (partnerId) conditions.push(eq(kycConsentLogs.partnerId, partnerId));
      if (from)      conditions.push(gte(kycConsentLogs.consentTimestamp, new Date(from)));
      if (to)        conditions.push(lte(kycConsentLogs.consentTimestamp, new Date(to)));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [{ total }]] = await Promise.all([
        db.select().from(kycConsentLogs).where(whereClause)
          .orderBy(desc(kycConsentLogs.consentTimestamp)).limit(limit).offset(offset),
        db.select({ total: sql<number>`COUNT(*)::int` }).from(kycConsentLogs).where(whereClause),
      ]);

      logger.info("ADMIN_COMPLIANCE_KRA_REUSE_READ", {
        event: "ADMIN_COMPLIANCE_KRA_REUSE_READ", admin_id: adminId,
        filters: { userId, partnerId, from, to }, result_count: rows.length, total,
        latency_ms: Date.now() - startTs, status: "success",
      });

      return ok(res, rows, { page, limit, total, pages: Math.ceil(total / limit) });
    } catch (e: unknown) {
      logger.error("ADMIN_COMPLIANCE_KRA_REUSE_ERROR", { admin_id: adminId, error: e instanceof Error ? e.message : String(e) });
      return errResp(res, "INTERNAL_ERROR", "Failed to fetch consent ledger", 500);
    }
  }
);

// ── GET /api/admin/compliance/audit-packs ─────────────────────────────────────
// Full SEBI Regulatory Audit Packs (KYC + Suitability + Platform Fee + Cryptographic Hash)

adminComplianceRouter.get(
  "/audit-packs",
  requireAdmin,
  async (req: Request, res: Response) => {
    const startTs = Date.now();
    const adminId = (req as any).user?.id;
    const { userId, packType, page = 1, limit = 50 } = req.query as any;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const offset = (pageNum - 1) * limitNum;

    try {
      const conditions = [];
      if (userId)   conditions.push(eq(regulatoryAuditPacks.userId, userId));
      if (packType) conditions.push(eq(regulatoryAuditPacks.packType, packType));

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, [{ total }]] = await Promise.all([
        db.select().from(regulatoryAuditPacks).where(whereClause)
          .orderBy(desc(regulatoryAuditPacks.createdAt)).limit(limitNum).offset(offset),
        db.select({ total: sql<number>`COUNT(*)::int` }).from(regulatoryAuditPacks).where(whereClause),
      ]);

      logger.info("ADMIN_COMPLIANCE_AUDIT_PACKS_READ", {
        event: "ADMIN_COMPLIANCE_AUDIT_PACKS_READ", admin_id: adminId,
        result_count: rows.length, total, latency_ms: Date.now() - startTs, status: "success",
      });

      return ok(res, rows, { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) });
    } catch (e: unknown) {
      logger.error("ADMIN_COMPLIANCE_AUDIT_PACKS_ERROR", { admin_id: adminId, error: e instanceof Error ? e.message : String(e) });
      return errResp(res, "INTERNAL_ERROR", "Failed to fetch regulatory audit packs", 500);
    }
  }
);

// ── GET /api/admin/compliance/audit-packs/:id/export ──────────────────────────
// 1-Click SEBI Audit Dossier Export

adminComplianceRouter.get(
  "/audit-packs/:id/export",
  requireAdmin,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const packId = Number(id);

    try {
      const [pack] = await db.select().from(regulatoryAuditPacks)
        .where(eq(regulatoryAuditPacks.id, packId)).limit(1);

      if (!pack) {
        return errResp(res, "NOT_FOUND", "Audit pack not found", 404);
      }

      const dossier = {
        title: "SEBI Form IA Regulatory Compliance Dossier",
        dossierVersion: "1.0.0",
        exportTimestamp: new Date().toISOString(),
        auditPackId: pack.id,
        investorId: pack.userId,
        eventType: pack.packType,
        transactionId: pack.transactionId,
        cryptographicProof: {
          auditHash: pack.auditHash,
          algorithm: "SHA-256",
          createdAt: pack.createdAt,
        },
        regulatorySnapshots: {
          kycVerification: pack.kycSnapshot,
          investorSuitability: pack.suitabilitySnapshot,
          executionOrder: pack.orderSnapshot,
          statutoryPlatformFees: pack.platformConfigSnapshot,
        },
        complianceDeclaration: "This electronic dossier is generated from FintekPro's immutable audit vault pursuant to SEBI (Investment Advisers) Regulations, 2013 and SEBI Master Circular on Cybersecurity and System Audit.",
      };

      return ok(res, dossier);
    } catch (e: unknown) {
      return errResp(res, "INTERNAL_ERROR", "Failed to export audit dossier", 500);
    }
  }
);
