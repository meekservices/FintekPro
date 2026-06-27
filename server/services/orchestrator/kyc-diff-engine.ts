/**
 * KYC Orchestrator — Diff Engine
 *
 * Computes the delta between what an investor's vault currently holds and
 * what a specific broker/segment requires. Returns three buckets:
 *
 *   prefilled_fields   — vault satisfies this field (present + not stale)
 *   required_delta     — must be collected from the investor fresh
 *   stale_fields       — data exists but has expired (broker won't accept)
 *   broker_fresh_only  — fields that are ALWAYS fresh per broker (e-signs,
 *                         segment activations, US self-certifications)
 *
 * This engine reads requirement config JSON files — NOT hardcoded field lists.
 * Adding a new broker requires only a new config file; no code changes here.
 *
 * FASP-AI GCR Rules:
 *  - Same input → same output ALWAYS (deterministic diff)
 *  - SSN/ITIN field never returned in prefilled_fields — always broker_fresh_only
 *  - Structured log: { event, user_id, broker_id, segment, delta_count, stale_count, latency_ms }
 *  - Consent MUST be written by the caller BEFORE sharing vault data with any adapter
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { db } from "../../db";
import { kycVault } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../logger";

// ESM-compatible __dirname shim (esbuild bundles as ESM — no CJS globals)
const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

// ── Types ────────────────────────────────────────────────────────────────────

export interface FieldProvenance {
  source: string;              // "iris_kra" | "broker:{id}" | "user_entered"
  verified_at?: string;        // ISO timestamp
  verification_method?: string;
  confidence_score?: number;
  expiry_date?: string;        // ISO timestamp — field-specific expiry
  last_synced_at?: string;
}

export interface RequirementField {
  canonical_field: string;
  required: boolean;
  prefillable_from_vault: boolean;
  source_constraint?: string | null;
  freshness_window_days: number | null;
  broker_note?: string;
}

export interface BrokerFreshField {
  field_id: string;
  label: string;
  type: string;
  required?: boolean;
  required_if?: string;
  options?: string[];
  broker_note?: string;
  never_prefill?: boolean;
}

export interface BrokerRequirementConfig {
  broker_id: string;
  broker_name: string;
  segment: string;
  region: string;
  version: string;
  notes?: string;
  lrs_compliance_required?: boolean;
  fields: RequirementField[];
  broker_fresh_only_fields: BrokerFreshField[];
}

export interface DiffResult {
  /** Fields the vault already satisfies — prefill in UI with "from your verified profile" label */
  prefilled_fields: Array<{
    canonical_field: string;
    value_ref: string;          // field name in vault (not the decrypted value)
    provenance: FieldProvenance;
  }>;

  /** Fields missing or unstatisfied from vault — must be collected */
  required_delta_fields: Array<{
    canonical_field: string;
    reason: "missing" | "not_prefillable";
    required: boolean;
  }>;

  /** Fields that exist in vault but are too old per broker's freshness window */
  stale_fields: Array<{
    canonical_field: string;
    stale_since: string;         // ISO timestamp when field became stale
    freshness_window_days: number;
  }>;

  /** Fields always collected fresh per broker — never from vault */
  broker_fresh_only_fields: BrokerFreshField[];

  /** Whether LRS compliance check is required before adapter call */
  lrs_compliance_required: boolean;

  /** Config version used for this diff (for auditability) */
  requirement_config_version: string;

  /** Broker ID and segment for which this diff was computed */
  broker_id: string;
  segment: string;
}

// ── Config loader ────────────────────────────────────────────────────────────

const REQUIREMENTS_DIR = join(__dirname, "requirements");

/**
 * Load broker requirement config from JSON file.
 * Files are named: {broker_id}-{segment}.json (e.g. iifl-equity.json)
 * or intermediary/{type}.json (e.g. intermediary/agent.json)
 *
 * @throws Error if config file not found
 */
function loadRequirementConfig(brokerId: string, segment: string): BrokerRequirementConfig {
  const filename = `${brokerId}-${segment}.json`;
  const filepath = join(REQUIREMENTS_DIR, filename);

  if (!existsSync(filepath)) {
    throw Object.assign(
      new Error(`No requirement config for broker="${brokerId}" segment="${segment}". Expected: ${filepath}`),
      { error_code: "BROKER_CONFIG_NOT_FOUND", retryable: false }
    );
  }

  return JSON.parse(readFileSync(filepath, "utf-8")) as BrokerRequirementConfig;
}

// ── Staleness check ──────────────────────────────────────────────────────────

/**
 * Check if a vault field is stale relative to broker's freshness window.
 *
 * @param provenance - Field provenance from vault
 * @param freshnessWindowDays - Broker's max acceptable age in days (null = no expiry)
 * @returns true if field is too old to be accepted by broker
 */
function isFieldStale(
  provenance: FieldProvenance,
  freshnessWindowDays: number | null
): boolean {
  if (freshnessWindowDays === null) return false;
  if (!provenance.last_synced_at && !provenance.verified_at) return true;

  const referenceDate = provenance.last_synced_at || provenance.verified_at!;
  const fieldAge = Date.now() - new Date(referenceDate).getTime();
  const maxAgeMs = freshnessWindowDays * 24 * 60 * 60 * 1000;

  return fieldAge > maxAgeMs;
}

// ── Vault field presence check ───────────────────────────────────────────────

/**
 * Check if a canonical field is populated in the vault row.
 * Maps canonical field names to vault column names.
 */
function getVaultFieldValue(vault: Record<string, unknown>, canonicalField: string): unknown {
  const FIELD_MAP: Record<string, string> = {
    fullLegalName:          "encryptedFullName",
    dateOfBirth:            "encryptedDateOfBirth",
    gender:                 "encryptedGender",
    panNumber:              "tokenizedPan",
    aadhaarLast4:           "aadhaarLast4",
    photoDocumentRef:       "photoDocumentRef",
    signatureDocumentRef:   "signatureDocumentRef",
    mobileNumber:           "encryptedMobile",
    email:                  "encryptedEmail",
    currentAddress:         "encryptedAddress",
    permanentAddress:       "permanentAddressEncrypted",
    addressProofType:       "addressProofType",
    addressProofDocumentRef:"addressProofDocumentRef",
    bankAccountNumber:      "encryptedBankAccountNumber",
    ifscCode:               "encryptedIfscCode",
    annualIncomeBand:       "annualIncomeBand",
    sourceOfFunds:          "sourceOfFunds",
    occupation:             "occupation",
    netWorthBand:           "netWorthBand",
    tradingExperienceYears: "tradingExperienceYears",
    riskProfileCategory:    "riskProfileCategory",
    investmentObjective:    "investmentObjective",
    govtIdType:             "govtIdType",
    govtIdDocumentRef:      "govtIdDocumentRef",
    govtIdExpiry:           "govtIdExpiry",
    nationality:            "nationality",
    taxResidencyCountries:  "taxResidencyCountries",
    nomineeDetails:         "nomineeDetails",
    dematAccountLinked:     "dematAccountLinked",
    segmentActivations:     "segmentActivations",
    // US / Alpaca — NEVER appear in prefilled_fields; handled as broker_fresh_only
    ssnOrItin:              "encryptedSsnOrItin",
    usPersonStatus:         "usPersonStatus",
    w8BenOrW9DocumentRef:   "w8BenOrW9DocumentRef",
    fatcaCrsClassification: "fatcaCrsClassification",
    usEmploymentStatus:     "usEmploymentStatus",
  };

  const vaultColumn = FIELD_MAP[canonicalField];
  return vaultColumn ? vault[vaultColumn] : undefined;
}

// ── Main diff engine ─────────────────────────────────────────────────────────

/**
 * Compute the KYC field diff for a given user, broker, and segment.
 *
 * This is the canonical diff — the frontend renders ONLY what this returns.
 * No broker-specific logic should exist in the frontend.
 *
 * @param userId   - FintekPro user ID
 * @param brokerId - Broker identifier matching config file prefix (e.g. "iifl", "alpaca")
 * @param segment  - Product segment (e.g. "equity", "fo", "us_equity", "mf")
 *
 * @returns DiffResult with three buckets + broker_fresh_only fields
 *
 * @throws Error with { error_code: "VAULT_NOT_FOUND" } if user has no KYC vault
 * @throws Error with { error_code: "BROKER_CONFIG_NOT_FOUND" } if config missing
 *
 * Structured log emitted on every call (success and failure):
 *   { event: "ORCHESTRATOR_DIFF", user_id, broker_id, segment, delta_count, stale_count, latency_ms, status }
 */
export async function computeKycDiff(
  userId: string,
  brokerId: string,
  segment: string
): Promise<DiffResult> {
  const startTs = Date.now();
  const event = "ORCHESTRATOR_DIFF";

  try {
    // 1. Load requirement config (throws if not found)
    const config = loadRequirementConfig(brokerId, segment);

    // 2. Load vault row for user
    const vaultRow = await db
      .select()
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1)
      .then((rows) => rows[0]);

    if (!vaultRow) {
      throw Object.assign(
        new Error(`KYC vault not found for userId="${userId}"`),
        { error_code: "VAULT_NOT_FOUND", retryable: false }
      );
    }

    // 3. Extract per-field provenance sidecar
    const provenanceMap: Record<string, FieldProvenance> =
      (vaultRow.provenanceMetadata as Record<string, FieldProvenance>) ?? {};

    // 4. Diff each required field
    const prefilled: DiffResult["prefilled_fields"] = [];
    const delta: DiffResult["required_delta_fields"] = [];
    const stale: DiffResult["stale_fields"] = [];

    const vault = vaultRow as unknown as Record<string, unknown>;

    for (const fieldSpec of config.fields) {
      const { canonical_field, required, prefillable_from_vault, freshness_window_days } = fieldSpec;

      const rawValue = getVaultFieldValue(vault, canonical_field);
      const provenance = provenanceMap[canonical_field];
      const hasValue = rawValue !== null && rawValue !== undefined && rawValue !== "";

      if (!hasValue) {
        // Field missing from vault entirely
        delta.push({ canonical_field, reason: "missing", required });
        continue;
      }

      if (!prefillable_from_vault) {
        // Field exists in vault but this broker requires fresh collection
        delta.push({ canonical_field, reason: "not_prefillable", required });
        continue;
      }

      if (provenance && isFieldStale(provenance, freshness_window_days)) {
        // Field exists but too old for this broker's freshness window
        stale.push({
          canonical_field,
          stale_since: provenance.last_synced_at ?? provenance.verified_at ?? "unknown",
          freshness_window_days: freshness_window_days!,
        });
        continue;
      }

      // Field satisfies requirements — prefill
      prefilled.push({
        canonical_field,
        value_ref: canonical_field,  // UI uses this to look up display value
        provenance: provenance ?? {
          source: "user_entered",
          last_synced_at: new Date().toISOString(),
        },
      });
    }

    const result: DiffResult = {
      prefilled_fields: prefilled,
      required_delta_fields: delta,
      stale_fields: stale,
      broker_fresh_only_fields: config.broker_fresh_only_fields,
      lrs_compliance_required: config.lrs_compliance_required ?? false,
      requirement_config_version: config.version,
      broker_id: brokerId,
      segment,
    };

    logger.info(event, {
      event,
      user_id: userId,
      broker_id: brokerId,
      segment,
      prefilled_count: prefilled.length,
      delta_count: delta.length,
      stale_count: stale.length,
      broker_fresh_count: config.broker_fresh_only_fields.length,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return result;

  } catch (err: unknown) {
    logger.error(event, {
      event,
      user_id: userId,
      broker_id: brokerId,
      segment,
      latency_ms: Date.now() - startTs,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
