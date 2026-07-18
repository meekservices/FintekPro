/**
 * IRIS KYC Vault Write-Back Service
 *
 * Purpose:
 *   When a client completes KYC via IRIS (the primary broker/platform),
 *   this service fetches the verified identity data from IRIS and writes it
 *   into the canonical KYC Vault with:
 *     - source = "iris_kra"
 *     - isReusable = true
 *     - per-field provenanceMetadata entries
 *
 *   Once the vault is populated, ALL other broker adapters (IIFL, JM Financial,
 *   Alpaca, BSE Star, etc.) read from this vault via the diff engine and
 *   prefill their KYC forms — the client is NEVER asked to re-enter data
 *   they already submitted via IRIS.
 *
 * Trigger points:
 *   1. Manually: POST /api/iris/kyc/:pan/write-to-vault (agent-triggered after eKYC)
 *   2. Webhook:  IRIS eKYC-complete webhook → auto write-back
 *   3. Cron:     Enrichment job Phase D — writes back for all investors with eKYC complete
 *
 * Security:
 *   - All PII encrypted at rest via encryptionService before vault write
 *   - PAN tokenized (never stored in plaintext)
 *   - Aadhaar: only last-4 stored; full number NEVER persisted
 *   - Structured audit trail written to kycAuditLogs on every write
 *   - Idempotent: safe to call multiple times (upserts by userId)
 *
 * FASP-AI GCR:
 *   - Logs emit { event, user_id, latency_ms, status } — PAN masked
 *   - No PII in logs
 *   - Retryable errors: IRIS 5xx, network timeouts
 *   - Non-retryable: PAN not found in IRIS, encryption failure
 */

import { db } from "../../db";
import { users, kycVault } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { encryptionService } from "../../encryption-service";
import { irisKfintechService } from "../iris-kfintech-service";
import { patchVaultProfile, type VaultPatchPayload } from "./vault-service";
import { logger } from "../../logger";


// ── Types ─────────────────────────────────────────────────────────────────────

export interface IrisWriteBackResult {
  success: boolean;
  userId: string;
  fieldsWritten: string[];
  isReusable: boolean;
  alreadyCurrent?: boolean;
  error?: string;
}

export interface IrisWriteBackOptions {
  /** Acting agent ID (if agent-triggered) — for audit trail */
  agentId?: string;
  /** Force re-write even if vault already has iris_kra data */
  forceRefresh?: boolean;
}

const ACTOR_SERVICE = "iris_kyc_writeback";

function log(
  event: string,
  extra: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
): void {
  const entry = JSON.stringify({
    event,
    service: ACTOR_SERVICE,
    timestamp: new Date().toISOString(),
    ...extra,
  });
  if (level === "error") logger.error(entry);
  else if (level === "warn") logger.warn(entry);
  else logger.info(entry);

}

function maskPan(pan: string): string {
  return pan ? pan.slice(0, 5) + "*****" : "UNKNOWN";
}

// ── Core write-back function ──────────────────────────────────────────────────

/**
 * Write IRIS-verified KYC data to the canonical vault for a given user.
 *
 * @param userId - FintekPro user ID (from users table)
 * @param pan    - Client's PAN (used to fetch from IRIS)
 * @param opts   - Options (agentId, forceRefresh)
 */
export async function writeIrisKycToVault(
  userId: string,
  pan: string,
  opts: IrisWriteBackOptions = {},
): Promise<IrisWriteBackResult> {
  const startMs = Date.now();
  const panMasked = maskPan(pan);

  log("IRIS_VAULT_WRITEBACK_START", { user_id: userId, pan_masked: panMasked });

  if (!irisKfintechService.isConfigured) {
    log("IRIS_VAULT_WRITEBACK_SKIP", { user_id: userId, pan_masked: panMasked, reason: "IRIS not configured" }, "warn");
    return { success: false, userId, fieldsWritten: [], isReusable: false, error: "IRIS not configured" };
  }

  // ── Check if vault already has fresh iris_kra data ──────────────────────
  if (!opts.forceRefresh) {
    const existing = await db
      .select({ provenanceMetadata: kycVault.provenanceMetadata, kycVerifiedAt: kycVault.kycVerifiedAt })
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (existing) {
      const prov = (existing.provenanceMetadata ?? {}) as Record<string, { source?: string; verified_at?: string }>;
      const irisFields = Object.values(prov).filter((p) => p?.source === "iris_kra");
      // If we already have 5+ fields from iris_kra and verified within 30 days → skip
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const freshFields = irisFields.filter((p) => p.verified_at && p.verified_at > thirtyDaysAgo);
      if (freshFields.length >= 5) {
        log("IRIS_VAULT_WRITEBACK_SKIP", {
          user_id: userId, pan_masked: panMasked,
          reason: "vault_already_current", iris_fields: freshFields.length,
          latency_ms: Date.now() - startMs, status: "skipped",
        });
        return { success: true, userId, fieldsWritten: [], isReusable: true, alreadyCurrent: true };
      }
    }
  }

  // ── Fetch investor profile and KYC details from IRIS ────────────────────
  let irisProfile: any = null;
  let irisKyc: any = null;
  let ekycStatus: any = null;

  try {
    [irisProfile, irisKyc, ekycStatus] = await Promise.all([
      irisKfintechService.getInvestorDetails(pan).catch(() => null),
      irisKfintechService.getInvestorKycDetails(pan).catch(() => null),
      irisKfintechService.getEkycStatus(pan).catch(() => null),
    ]);
  } catch (err: any) {
    log("IRIS_VAULT_WRITEBACK_FETCH_ERROR", { user_id: userId, pan_masked: panMasked, error: err.message }, "error");
    return { success: false, userId, fieldsWritten: [], isReusable: false, error: `IRIS fetch failed: ${err.message}` };
  }

  if (!irisProfile && !irisKyc) {
    log("IRIS_VAULT_WRITEBACK_NOT_FOUND", { user_id: userId, pan_masked: panMasked }, "warn");
    return { success: false, userId, fieldsWritten: [], isReusable: false, error: "Investor not found in IRIS" };
  }

  const src = irisProfile ?? irisKyc ?? {};

  // ── Determine verification method from eKYC status ──────────────────────
  const verificationMethod = resolveVerificationMethod(ekycStatus, irisKyc);

  // ── Build encrypted field map ────────────────────────────────────────────
  const enc = (val: string | null | undefined): string | null =>
    val ? (encryptionService.encrypt(val) ?? null) : null;

  const safeStr = (v: unknown): string | null =>
    v != null && v !== "" ? String(v) : null;

  // Extract address components
  const addr = src.address ?? irisKyc?.address ?? {};
  const addressLine = [addr.houseNumber, addr.street, addr.addressLine1, addr.address]
    .filter(Boolean).join(", ");

  const encryptedFields: Record<string, unknown> = {};
  const provenance: VaultPatchPayload["provenance"] = {};
  const fieldsWritten: string[] = [];

  function addField(
    vaultCol: string,
    encryptedValue: string | null,
    rawPresent: boolean,
  ) {
    if (!rawPresent || encryptedValue == null) return;
    encryptedFields[vaultCol] = encryptedValue;
    provenance[vaultCol] = {
      source: "iris_kra",
      verification_method: verificationMethod,
      confidence_score: 90,
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
    };
    fieldsWritten.push(vaultCol);
  }

  // Identity fields
  addField("encryptedFullName",    enc(safeStr(src.name ?? src.fullName ?? src.investorName)),    !!(src.name ?? src.fullName ?? src.investorName));
  addField("encryptedDateOfBirth", enc(safeStr(src.dateOfBirth ?? src.dob)),                      !!(src.dateOfBirth ?? src.dob));
  addField("encryptedGender",      enc(safeStr(src.gender)),                                       !!(src.gender));
  addField("encryptedFatherName",  enc(safeStr(src.fatherName ?? src.fathersName)),               !!(src.fatherName ?? src.fathersName));
  addField("encryptedMobile",      enc(safeStr(src.mobile ?? src.mobileNumber)),                  !!(src.mobile ?? src.mobileNumber));
  addField("encryptedEmail",       enc(safeStr(src.email ?? src.emailId)),                        !!(src.email ?? src.emailId));

  // Address components
  addField("encryptedAddress", enc(safeStr(addressLine || null)),               !!addressLine);
  addField("encryptedCity",    enc(safeStr(addr.city ?? addr.district ?? null)),!!(addr.city ?? addr.district));
  addField("encryptedState",   enc(safeStr(addr.state ?? null)),                !!(addr.state));
  addField("encryptedPincode", enc(safeStr(addr.pincode ?? addr.zipCode ?? null)), !!(addr.pincode ?? addr.zipCode));

  // Non-encrypted metadata fields
  if (src.nationality || irisKyc?.nationality) {
    encryptedFields["nationality"] = safeStr(src.nationality ?? irisKyc?.nationality);
    provenance["nationality"] = { source: "iris_kra", verification_method: verificationMethod, confidence_score: 90 };
    fieldsWritten.push("nationality");
  }

  if (irisKyc?.aadhaarLast4) {
    encryptedFields["aadhaarLast4"] = irisKyc.aadhaarLast4.slice(-4);
    provenance["aadhaarLast4"] = { source: "iris_kra", verification_method: verificationMethod, confidence_score: 85 };
    fieldsWritten.push("aadhaarLast4");
  }

  // KYC status from IRIS
  const kycStatusValue = resolveKycStatus(irisKyc?.kycStatus ?? irisKyc?.status ?? ekycStatus);
  encryptedFields["kycStatus"] = kycStatusValue;
  encryptedFields["isReusable"] = kycStatusValue === "verified";
  encryptedFields["source"] = "iris_kra";
  encryptedFields["kycVerifiedAt"] = new Date();
  encryptedFields["verificationMethod"] = verificationMethod;
  provenance["kycStatus"] = { source: "iris_kra", verification_method: verificationMethod, confidence_score: 95 };
  fieldsWritten.push("kycStatus");

  // CKYC / KIN number (if IRIS provides it)
  const ckycKin = irisKyc?.ckycNumber ?? irisKyc?.kinNumber ?? irisKyc?.kraKinNumber ?? null;
  if (ckycKin) {
    encryptedFields["tokenizedCkycKin"] = encryptionService.encrypt(ckycKin) ?? null;
    encryptedFields["ckycStatus"]       = "verified";
    encryptedFields["ckycVerificationLevel"] = "normal";
    provenance["tokenizedCkycKin"] = { source: "iris_kra", verification_method: verificationMethod, confidence_score: 95 };
    fieldsWritten.push("tokenizedCkycKin", "ckycStatus");
  }

  if (fieldsWritten.length === 0) {
    log("IRIS_VAULT_WRITEBACK_NO_DATA", { user_id: userId, pan_masked: panMasked, latency_ms: Date.now() - startMs }, "warn");
    return { success: false, userId, fieldsWritten: [], isReusable: false, error: "No usable data in IRIS response" };
  }

  // ── Write to vault via patchVaultProfile ─────────────────────────────────
  try {
    await patchVaultProfile(userId, {
      fields: encryptedFields,
      provenance,
      actorService: ACTOR_SERVICE,
      actingAs: opts.agentId ? { agentId: opts.agentId, onBehalfOfUserId: userId } : undefined,
    });

    log("IRIS_VAULT_WRITEBACK_OK", {
      user_id: userId,
      pan_masked: panMasked,
      fields_written: fieldsWritten,
      fields_count: fieldsWritten.length,
      is_reusable: kycStatusValue === "verified",
      latency_ms: Date.now() - startMs,
      status: "success",
    });

    return {
      success: true,
      userId,
      fieldsWritten,
      isReusable: kycStatusValue === "verified",
    };
  } catch (err: any) {
    log("IRIS_VAULT_WRITEBACK_WRITE_ERROR", {
      user_id: userId,
      pan_masked: panMasked,
      error: err.message,
      latency_ms: Date.now() - startMs,
    }, "error");
    return { success: false, userId, fieldsWritten: [], isReusable: false, error: `Vault write failed: ${err.message}` };
  }
}

// ── Batch write-back (enrichment job) ────────────────────────────────────────

/**
 * Batch write IRIS KYC to vault for multiple users.
 * Used by the enrichment job to backfill all users who have completed IRIS eKYC.
 *
 * @param batchSize - Max users to process per run (default 100)
 */
export async function batchWriteIrisKycToVault(batchSize = 100): Promise<{
  processed: number;
  written: number;
  skipped: number;
  failed: number;
}> {
  const startMs = Date.now();
  log("IRIS_VAULT_BATCH_START", { batch_size: batchSize });

  let processed = 0, written = 0, skipped = 0, failed = 0;

  if (!irisKfintechService.isConfigured) {
    log("IRIS_VAULT_BATCH_SKIP", { reason: "IRIS not configured" }, "warn");
    return { processed: 0, written: 0, skipped: 0, failed: 0 };
  }

  // Select users who have PAN set in their profile
  const allUsersWithPan = await db
    .select({ id: users.id, pan: users.panNumber })
    .from(users)
    .where(sql`pan_number IS NOT NULL AND pan_number ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'`)
    .limit(batchSize)
    .catch(() => [] as { id: string; pan: string | null }[]);

  for (const user of allUsersWithPan) {
    if (!user.pan) continue;
    processed++;
    try {
      const result = await writeIrisKycToVault(user.id, user.pan);
      if (result.alreadyCurrent) skipped++;
      else if (result.success) written++;
      else failed++;
    } catch (err: any) {
      failed++;
      log("IRIS_VAULT_BATCH_ROW_ERROR", { user_id: user.id, error: err.message }, "error");
    }
    // Rate-limit: 100ms between IRIS calls
    await new Promise((r) => setTimeout(r, 100));
  }

  log("IRIS_VAULT_BATCH_DONE", {
    processed, written, skipped, failed,
    latency_ms: Date.now() - startMs,
    status: "success",
  });

  return { processed, written, skipped, failed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveVerificationMethod(
  ekycStatus: any,
  kycDetails: any,
): "ekyc_otp" | "biometric" | "document_upload" | "manual" {
  const raw = String(
    ekycStatus?.verificationMode ??
    ekycStatus?.mode ??
    kycDetails?.kycMode ??
    kycDetails?.verificationMethod ??
    ""
  ).toLowerCase();

  if (raw.includes("otp") || raw.includes("ekyc") || raw.includes("aadhaar")) return "ekyc_otp";
  if (raw.includes("biometric") || raw.includes("face")) return "biometric";
  if (raw.includes("document") || raw.includes("upload")) return "document_upload";
  return "manual";
}

function resolveKycStatus(raw: unknown): "verified" | "pending" | "rejected" {
  if (!raw) return "pending";
  const s = String(raw).toLowerCase();
  if (s.includes("complete") || s.includes("verified") || s.includes("active") || s.includes("success")) return "verified";
  if (s.includes("reject") || s.includes("fail")) return "rejected";
  return "pending";
}
