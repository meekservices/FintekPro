/**
 * KYC Vault API Routes
 *
 * Exposes vault CRUD, orchestrator diff, and consent ledger endpoints.
 * All endpoints are authenticated. Agent-assisted endpoints additionally
 * require an active acting_as session context.
 *
 * Routes:
 *   GET  /api/kyc/vault/:userId/profile       — canonical profile + provenance
 *   PATCH /api/kyc/vault/:userId/profile      — field-level upsert (provenance required)
 *   POST  /api/kyc/consent                    — write consent ledger entry
 *   POST  /api/kyc/orchestrator/diff          — compute prefilled/delta/stale buckets
 *
 * FASP-AI GCR Rules:
 *   - API response format: { success, data, meta: { timestamp, version } }
 *   - All list endpoints paginated: page, limit, total
 *   - Errors: { error_code, message, retryable }
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getVaultProfile,
  patchVaultProfile,
  writeConsentEntry,
  getVaultDocuments,
} from "../services/kyc/vault-service";
import { computeKycDiff } from "../services/orchestrator/kyc-diff-engine";
import { requireAuth } from "../middleware/auth";
import { readActingAsContext } from "../middleware/acting-as-context";
import { logger } from "../logger";
import { createHash } from "crypto";

// Simple in-process idempotency cache for PATCH (TTL 60 s)
const patchIdempotencyCache = new Map<string, { ts: number; result: unknown }>();
const IDEMPOTENCY_TTL_MS = 60_000;

function checkIdempotency(key: string): unknown | null {
  const entry = patchIdempotencyCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > IDEMPOTENCY_TTL_MS) {
    patchIdempotencyCache.delete(key);
    return null;
  }
  return entry.result;
}

function setIdempotency(key: string, result: unknown) {
  patchIdempotencyCache.set(key, { ts: Date.now(), result });
  // Prune stale entries (keep map bounded)
  if (patchIdempotencyCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of patchIdempotencyCache) {
      if (now - v.ts > IDEMPOTENCY_TTL_MS) patchIdempotencyCache.delete(k);
    }
  }
}

const router = Router();
const API_VERSION = "v1.0.0";

// ── Schema validation ────────────────────────────────────────────────────────

const provenanceFieldSchema = z.object({
  source: z.string(),
  verification_method: z.enum(["ekyc_otp", "biometric", "document_upload", "manual", "penny_drop", "video_kyc"]),
  confidence_score: z.number().min(0).max(100).optional(),
  expiry_date: z.string().datetime().optional(),
});

const patchVaultSchema = z.object({
  fields: z.record(z.string(), z.unknown()),
  provenance: z.record(z.string(), provenanceFieldSchema),
});

const consentSchema = z.object({
  partnerId: z.string().min(1),
  purpose: z.string().min(1),
  consentType: z.string().min(1),
  fieldNames: z.array(z.string()).min(1),
  consentText: z.string().min(1),
});

const diffSchema = z.object({
  userId: z.string().min(1),
  brokerId: z.string().min(1),
  segment: z.string().min(1),
});

// ── Helper: standard API response wrapper ────────────────────────────────────

function ok(res: Response, data: unknown, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: API_VERSION },
  });
}

function err(res: Response, error_code: string, message: string, retryable = false, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { error_code, message, retryable },
    meta: { timestamp: new Date().toISOString(), version: API_VERSION },
  });
}

// ── GET /api/kyc/vault/:userId/profile ───────────────────────────────────────

router.get(
  "/vault/:userId/profile",
  requireAuth,
  readActingAsContext,
  async (req: Request, res: Response) => {
    const { userId } = req.params;

    // Authorization: user can only read their own vault, or agent with active acting_as
    const actingAs = (req as any).actingAs;
    const requestingUserId = (req as any).user?.id;

    if (requestingUserId !== userId && (!actingAs || actingAs.onBehalfOfUserId !== userId)) {
      return err(res, "UNAUTHORIZED", "Insufficient authorization to read this vault", false, 403);
    }

    try {
      const profile = await getVaultProfile(
        userId,
        actingAs ? `agent:${actingAs.agentId}` : `user:${requestingUserId}`,
      );

      if (!profile) {
        return err(res, "VAULT_NOT_FOUND", "No KYC vault found for this user", false, 404);
      }

      return ok(res, profile);
    } catch (e: unknown) {
      logger.error("VAULT_ROUTE_READ_ERROR", { user_id: userId, error: String(e) });
      return err(res, "INTERNAL_ERROR", "Failed to read vault profile", true, 500);
    }
  }
);

// ── PATCH /api/kyc/vault/:userId/profile ─────────────────────────────────────

router.patch(
  "/vault/:userId/profile",
  requireAuth,
  readActingAsContext,
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const actingAs = (req as any).actingAs;
    const requestingUserId = (req as any).user?.id;

    if (requestingUserId !== userId && (!actingAs || actingAs.onBehalfOfUserId !== userId)) {
      return err(res, "UNAUTHORIZED", "Insufficient authorization to write to this vault", false, 403);
    }

    // ── Idempotency-Key dedup ─────────────────────────────────────────────────
    const idempotencyHeader = req.headers["idempotency-key"] as string | undefined;
    if (idempotencyHeader) {
      const cachedResult = checkIdempotency(`${userId}:${idempotencyHeader}`);
      if (cachedResult) {
        logger.info("VAULT_PATCH_IDEMPOTENT_HIT", { user_id: userId, idempotency_key: idempotencyHeader });
        return res.status(200).json(cachedResult);
      }
    }

    const parsed = patchVaultSchema.safeParse(req.body);
    if (!parsed.success) {
      return err(res, "VALIDATION_ERROR", parsed.error.message, false, 400);
    }

    try {
      await patchVaultProfile(userId, {
        fields: parsed.data.fields,
        // Cast: zod inferred type is structurally identical to FieldProvenanceUpdate
        provenance: parsed.data.provenance as Record<string, import("../services/kyc/vault-service").FieldProvenanceUpdate>,
        actorService: actingAs ? `agent:${actingAs.agentId}` : `user:${requestingUserId}`,
        actingAs: actingAs ? { agentId: actingAs.agentId, onBehalfOfUserId: userId } : undefined,
      });

      const result = ok(res, { updated: true }, 200);
      if (idempotencyHeader) setIdempotency(`${userId}:${idempotencyHeader}`, { success: true, data: { updated: true }, meta: { timestamp: new Date().toISOString(), version: API_VERSION } });
      return result;
    } catch (e: unknown) {
      const typedErr = e as Record<string, unknown>;
      if (typedErr.error_code === "PROVENANCE_REQUIRED") {
        return err(res, "PROVENANCE_REQUIRED", String(typedErr.message ?? e), false, 422);
      }
      logger.error("VAULT_ROUTE_WRITE_ERROR", { user_id: userId, error: String(e) });
      return err(res, "INTERNAL_ERROR", "Failed to update vault profile", true, 500);
    }
  }
);

// ── POST /api/kyc/consent ─────────────────────────────────────────────────────

router.post(
  "/consent",
  requireAuth,
  readActingAsContext,
  async (req: Request, res: Response) => {
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return err(res, "VALIDATION_ERROR", parsed.error.message, false, 400);
    }

    const userId = (req as any).user?.id;
    const actingAs = (req as any).actingAs;

    // Build deterministic field_set_hash from sorted field names
    const sortedFields = [...parsed.data.fieldNames].sort();
    const fieldSetHash = createHash("sha256")
      .update(sortedFields.join("|"))
      .digest("hex");

    try {
      const consentId = await writeConsentEntry({
        userId,
        partnerId: parsed.data.partnerId,
        purpose: parsed.data.purpose,
        consentType: parsed.data.consentType,
        fieldSetHash,
        ipAddress: req.ip,
        consentText: parsed.data.consentText,
        actingAs: actingAs ? { agentId: actingAs.agentId } : undefined,
      });

      return ok(res, { consent_id: consentId, field_set_hash: fieldSetHash }, 201);
    } catch (e: unknown) {
      logger.error("CONSENT_ROUTE_ERROR", { user_id: userId, error: String(e) });
      return err(res, "INTERNAL_ERROR", "Failed to write consent entry", true, 500);
    }
  }
);

// ── GET /api/kyc/vault/:userId/documents ─────────────────────────────────────
// Returns document metadata + presigned short-TTL URLs (never permanent URLs)
// per spec §5.1: "No documents served from a public bucket"

router.get(
  "/vault/:userId/documents",
  requireAuth,
  readActingAsContext,
  async (req: Request, res: Response) => {
    const { userId } = req.params;
    const actingAs = (req as any).actingAs;
    const requestingUserId = (req as any).user?.id;

    if (requestingUserId !== userId && (!actingAs || actingAs.onBehalfOfUserId !== userId)) {
      return err(res, "UNAUTHORIZED", "Insufficient authorization to read documents for this user", false, 403);
    }

    try {
      const documents = await getVaultDocuments(
        userId,
        actingAs ? `agent:${actingAs.agentId}` : `user:${requestingUserId}`,
      );
      return ok(res, { documents });
    } catch (e: unknown) {
      logger.error("VAULT_DOCS_ROUTE_ERROR", { user_id: userId, error: String(e) });
      return err(res, "INTERNAL_ERROR", "Failed to retrieve documents", true, 500);
    }
  }
);

// ── POST /api/kyc/orchestrator/diff ──────────────────────────────────────────

router.post(
  "/orchestrator/diff",
  requireAuth,
  readActingAsContext,
  async (req: Request, res: Response) => {
    const parsed = diffSchema.safeParse(req.body);
    if (!parsed.success) {
      return err(res, "VALIDATION_ERROR", parsed.error.message, false, 400);
    }

    const { userId, brokerId, segment } = parsed.data;
    const requestingUserId = (req as any).user?.id;
    const actingAs = (req as any).actingAs;

    // Authorization
    if (requestingUserId !== userId && (!actingAs || actingAs.onBehalfOfUserId !== userId)) {
      return err(res, "UNAUTHORIZED", "Insufficient authorization to compute diff for this user", false, 403);
    }

    try {
      const diffResult = await computeKycDiff(userId, brokerId, segment);
      return ok(res, diffResult);
    } catch (e: unknown) {
      const typedErr = e as Record<string, unknown>;
      if (typedErr.error_code === "BROKER_CONFIG_NOT_FOUND") {
        return err(res, "BROKER_CONFIG_NOT_FOUND", String(typedErr.message ?? e), false, 404);
      }
      if (typedErr.error_code === "VAULT_NOT_FOUND") {
        return err(res, "VAULT_NOT_FOUND", "No KYC vault found — complete base KYC first", false, 404);
      }
      logger.error("DIFF_ROUTE_ERROR", { user_id: userId, broker_id: brokerId, segment, error: String(e) });
      return err(res, "INTERNAL_ERROR", "Failed to compute KYC diff", true, 500);
    }
  }
);

export default router;
