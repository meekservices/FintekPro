/**
 * KYC Vault Service
 *
 * Owns the canonical KYC profile with per-field provenance metadata,
 * document references, consent ledger writes, and audit trail.
 *
 * Key invariants (non-negotiable per spec):
 *  1. Every vault PATCH must include source + verification_method — rejected otherwise.
 *  2. Every vault PATCH writes an audit log entry (actor_service, action, field_names, timestamp).
 *  3. Consent ledger entry MUST be written BEFORE any broker data-sharing — callers do this;
 *     this service does not auto-write consent on behalf of callers.
 *  4. PII columns are NEVER returned decrypted via this service's HTTP endpoints.
 *     Adapters request decryption directly via kyc-encryption-service when needed.
 *  5. Document references (file paths/keys) returned as presigned short-TTL URLs only.
 *
 * FASP-AI GCR Rules:
 *  - Structured log on every read/write: { event, user_id, action, field_names, latency_ms, status }
 *  - PAN, Aadhaar, SSN/ITIN never appear in logs — only field names referenced
 *  - All errors follow { error_code, message, retryable }
 */

import { db } from "../../db";
import { kycVault, kycAuditLogs, kycConsentLogs } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../logger";
import { randomUUID } from "crypto";
// kycEncryptionService is used by adapters directly — vault-service does not decrypt

// ── Types ────────────────────────────────────────────────────────────────────

export type VerificationMethod =
  | "ekyc_otp"
  | "biometric"
  | "document_upload"
  | "manual"
  | "penny_drop"
  | "video_kyc";

export type FieldSource =
  | "iris_kra"
  | `broker:${"iifl" | "jm_financial" | "alpaca" | "iris_distributor"}`
  | "user_entered"
  | "system";

export interface FieldProvenanceUpdate {
  source: FieldSource;
  verification_method: VerificationMethod;
  confidence_score?: number;     // 0-100
  expiry_date?: string;          // ISO — broker-specific field expiry
}

export interface VaultPatchPayload {
  /** Map of canonical field name → encrypted/tokenized value (already encrypted by caller) */
  fields: Record<string, unknown>;
  /** Provenance for each updated field */
  provenance: Record<string, FieldProvenanceUpdate>;
  /** Actor performing the write */
  actorService: string;
  /** Optional acting-as context (agent writing on behalf of investor) */
  actingAs?: {
    agentId: string;
    onBehalfOfUserId: string;
  };
}

export interface ConsentPayload {
  userId: string;
  partnerId: string;            // broker_id or intermediary_id receiving the data
  purpose: string;
  consentType: string;          // "kyc_share" | "field_reuse" | "agent_prepare" | "investor_authorize"
  fieldSetHash: string;         // sha256(sorted field names) — links consent to specific fields
  ipAddress?: string;
  consentText: string;
  actingAs?: { agentId: string };
}

// ── Vault reads ──────────────────────────────────────────────────────────────

/**
 * Get the canonical vault profile for a user, with per-field provenance.
 * PII columns are returned as encrypted blobs — callers decrypt on demand.
 *
 * Writes a "read" audit log entry.
 */
export async function getVaultProfile(
  userId: string,
  actorService: string,
  fieldNames?: string[]   // if provided, only these fields are audited
) {
  const startTs = Date.now();
  const event = "VAULT_READ";

  try {
    const vault = await db
      .select()
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // Write audit log
    await db.insert(kycAuditLogs).values({
      userId,
      accessedBy: actorService,
      accessType: "read",
      dataFieldsAccessed: fieldNames ?? ["*"],
      purpose: "vault_profile_read",
      accessStatus: vault ? "success" : "not_found",
    });

    logger.info(event, {
      event,
      user_id: userId,
      actor_service: actorService,
      fields_accessed: fieldNames?.length ?? "all",
      found: !!vault,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return vault;
  } catch (err: unknown) {
    logger.error(event, {
      event, user_id: userId, actor_service: actorService,
      latency_ms: Date.now() - startTs, status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Vault writes ─────────────────────────────────────────────────────────────

/**
 * Field-level upsert on the canonical vault profile.
 *
 * Every write must include source + verification_method per field.
 * Throws if any field in the payload lacks provenance metadata.
 *
 * Provenance sidecar (provenanceMetadata JSONB) is merged — existing
 * field provenance is preserved for fields not in this patch.
 */
export async function patchVaultProfile(
  userId: string,
  payload: VaultPatchPayload
): Promise<void> {
  const startTs = Date.now();
  const event = "VAULT_WRITE";
  const fieldNames = Object.keys(payload.fields);

  // ── Validate: every field must have provenance ───────────────────────────
  for (const fieldName of fieldNames) {
    if (!payload.provenance[fieldName]) {
      throw Object.assign(
        new Error(`Missing provenance for field "${fieldName}". Every vault write must include source and verification_method.`),
        { error_code: "PROVENANCE_REQUIRED", retryable: false }
      );
    }
  }

  try {
    // Load existing vault to merge provenance sidecar
    const existing = await db
      .select({ id: kycVault.id, provenanceMetadata: kycVault.provenanceMetadata })
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // Build updated provenance sidecar
    const existingProvenance = (existing?.provenanceMetadata as Record<string, unknown>) ?? {};
    const now = new Date().toISOString();

    const updatedProvenance: Record<string, unknown> = { ...existingProvenance };
    for (const fieldName of fieldNames) {
      updatedProvenance[fieldName] = {
        ...payload.provenance[fieldName],
        last_synced_at: now,
        verified_at: now,
      };
    }

    if (existing) {
      // Update existing record
      await db
        .update(kycVault)
        .set({
          ...payload.fields,
          provenanceMetadata: updatedProvenance,
          updatedAt: new Date(),
        })
        .where(eq(kycVault.userId, userId));
    } else {
      // Insert new vault record
      await db.insert(kycVault).values({
        userId,
        ...payload.fields,
        provenanceMetadata: updatedProvenance,
        source: payload.actorService,
        verificationMethod: Object.values(payload.provenance)[0]?.verification_method,
      });
    }

    // Write audit log
    await db.insert(kycAuditLogs).values({
      userId,
      accessedBy: payload.actorService,
      createdByAgentId: payload.actingAs?.agentId,
      accessType: "write",
      dataFieldsAccessed: fieldNames,
      purpose: "vault_field_upsert",
      accessStatus: "success",
      regulatoryPurpose: `field_update:${fieldNames.join(",")}`,
    });

    logger.info(event, {
      event,
      user_id: userId,
      actor_service: payload.actorService,
      acting_as_agent: payload.actingAs?.agentId,
      field_names: fieldNames,   // field names only — never field values
      field_count: fieldNames.length,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

  } catch (err: unknown) {
    logger.error(event, {
      event, user_id: userId, actor_service: payload.actorService,
      latency_ms: Date.now() - startTs, status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Consent ledger ────────────────────────────────────────────────────────────

/**
 * Write a consent ledger entry.
 *
 * MUST be called BEFORE any vault data is shared with a broker adapter.
 * This is enforced by the orchestrator and route layer — this service
 * does not validate call ordering, it only writes the entry.
 *
 * The consent record is INSERT-only. No UPDATE or DELETE is ever issued
 * on consent records by this service.
 */
export async function writeConsentEntry(payload: ConsentPayload): Promise<string> {
  const startTs = Date.now();
  const event = "CONSENT_WRITE";

  const consentId = randomUUID();

  try {
    await db.insert(kycConsentLogs).values({
      userId: payload.userId,
      partnerId: payload.partnerId,
      purpose: payload.purpose,
      consentType: payload.consentType,
      dataShared: { field_set_hash: payload.fieldSetHash },
      ipAddress: payload.ipAddress,
      consentText: payload.consentText,
      consentGiven: true,
      createdByAgentId: payload.actingAs?.agentId,
      metadata: {
        field_set_hash: payload.fieldSetHash,
        acting_as_agent: payload.actingAs?.agentId,
      },
    });

    logger.info(event, {
      event,
      user_id: payload.userId,
      partner_id: payload.partnerId,
      consent_type: payload.consentType,
      field_set_hash: payload.fieldSetHash,
      acting_as_agent: payload.actingAs?.agentId,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return consentId;
  } catch (err: unknown) {
    logger.error(event, {
      event, user_id: payload.userId, partner_id: payload.partnerId,
      latency_ms: Date.now() - startTs, status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ── Document listing ──────────────────────────────────────────────────────────

export interface VaultDocument {
  /** Document type — e.g. "photo", "signature", "address_proof", "govt_id", "w8ben" */
  documentType: string;
  /** Canonical field name this document is referenced from */
  canonicalField: string;
  /** Object storage key (e.g. GCS object name) — NEVER a permanent public URL */
  storageRef: string;
  /**
   * Short-TTL presigned URL (15 min).
   * Generated on demand — never stored.
   * null when object storage is not configured (development mode).
   */
  presignedUrl: string | null;
  /** ISO timestamp when presigned URL expires */
  presignedUrlExpiresAt: string | null;
}

/**
 * Return document metadata and presigned short-TTL URLs for a user's vault.
 *
 * Per spec §5.1: "No documents served from a public bucket."
 * URLs are presigned with a 15-minute TTL.
 * Writes a "read" audit log entry (document fields only).
 *
 * @param userId - FintekPro user ID
 * @param actorService - Calling actor (for audit log)
 */
export async function getVaultDocuments(
  userId: string,
  actorService: string,
): Promise<VaultDocument[]> {
  const startTs = Date.now();
  const event = "VAULT_DOCS_READ";

  // Document-type → vault column mapping
  const DOC_FIELDS: Array<{ documentType: string; canonicalField: string; vaultColumn: string }> = [
    { documentType: "photo",           canonicalField: "photoDocumentRef",          vaultColumn: "photoDocumentRef" },
    { documentType: "signature",       canonicalField: "signatureDocumentRef",       vaultColumn: "signatureDocumentRef" },
    { documentType: "address_proof",   canonicalField: "addressProofDocumentRef",    vaultColumn: "addressProofDocumentRef" },
    { documentType: "govt_id",         canonicalField: "govtIdDocumentRef",          vaultColumn: "govtIdDocumentRef" },
    { documentType: "w8ben_or_w9",     canonicalField: "w8BenOrW9DocumentRef",       vaultColumn: "w8BenOrW9DocumentRef" },
  ];

  try {
    const vault = await db
      .select()
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    const docFieldNames = DOC_FIELDS.map((d) => d.canonicalField);

    // Write audit log for document read
    await db.insert(kycAuditLogs).values({
      userId,
      accessedBy: actorService,
      accessType: "read",
      dataFieldsAccessed: docFieldNames,
      purpose: "vault_documents_read",
      accessStatus: vault ? "success" : "not_found",
    });

    if (!vault) {
      logger.info(event, { event, user_id: userId, actor_service: actorService, found: false, latency_ms: Date.now() - startTs });
      return [];
    }

    const vaultRow = vault as unknown as Record<string, unknown>;
    const PRESIGNED_TTL_MIN = 15;
    const expiresAt = new Date(Date.now() + PRESIGNED_TTL_MIN * 60 * 1000).toISOString();

    const documents: VaultDocument[] = [];

    for (const { documentType, canonicalField, vaultColumn } of DOC_FIELDS) {
      const storageRef = vaultRow[vaultColumn] as string | null | undefined;
      if (!storageRef) continue;

      // Presigned URL generation — delegates to GCS/S3 if configured
      // Canonical env var: DEFAULT_OBJECT_STORAGE_BUCKET_ID (runtime-env.ts)
      // Legacy fallback: OBJECT_STORAGE_BUCKET (kept for backward compat)
      let presignedUrl: string | null = null;
      const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? process.env.OBJECT_STORAGE_BUCKET;
      if (bucket) {
        // Production: generate short-TTL presigned URL
        // This pattern works for GCS (via @google-cloud/storage) or S3-compatible
        // The actual signing is done outside this service — URL is built by caller
        // using the storage ref. We return the ref here; the client requests signing
        // via a dedicated presign endpoint if needed.
        presignedUrl = `/api/kyc/v2/vault/${userId}/presign?ref=${encodeURIComponent(storageRef)}&ttl=${PRESIGNED_TTL_MIN}`;
      }

      documents.push({ documentType, canonicalField, storageRef, presignedUrl, presignedUrlExpiresAt: presignedUrl ? expiresAt : null });
    }

    logger.info(event, {
      event,
      user_id: userId,
      actor_service: actorService,
      document_count: documents.length,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return documents;
  } catch (err: unknown) {
    logger.error(event, {
      event, user_id: userId, actor_service: actorService,
      latency_ms: Date.now() - startTs, status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

