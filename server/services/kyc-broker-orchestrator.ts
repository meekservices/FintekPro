/**
 * KYC Broker Orchestrator — Diff Engine
 *
 * Core service of the KYC Vault system. Given a user + broker + segment,
 * produces a structured diff of:
 *   - prefilled_fields: canonical vault fields that satisfy broker requirements
 *   - required_delta_fields: fields the user must still provide (missing/stale/never-shareable)
 *   - stale_fields: vault fields that exist but have exceeded their freshness window
 *   - not_applicable_fields: fields excluded from this broker's requirements
 *   - delta_form_spec: JSON Schema-like spec for the frontend to render only delta fields
 *
 * Also handles broker submission by:
 *   1. Enforcing consent-before-share (consent guard)
 *   2. Checking idempotency (idempotency guard)
 *   3. Resolving and calling the correct adapter
 *   4. Recording the result atomically
 *
 * GCR Rules:
 *  - Consent is always written before any data is shared
 *  - Idempotency key always checked before any outbound call
 *  - SSN/ITIN is decrypted immediately before the call and not held longer
 *  - All operations emit structured { event, user_id, latency_ms, status }
 */

import path from "path";
import fs from "fs";
import { db } from "../db";
import { kycVault, kycAuditLogs } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { encryptionService } from "../encryption-service";
import type { CanonicalKycProfile, BrokerAdapter, FieldProvenance } from "./adapters/broker-adapter.interface";
import { alpacaAdapter } from "./adapters/alpaca-adapter";
import { iiflAdapter } from "./adapters/iifl-adapter";
import { jmFinancialAdapter } from "./adapters/jm-financial-adapter";
import {
  checkIdempotency,
  recordSubmissionResult,
} from "../middleware/kyc-idempotency-guard";
import { ensureConsentBeforeShare } from "../middleware/consent-before-share-guard";
import { logger } from "../logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrokerDiffRequest {
  userId: string;
  brokerId: "iifl" | "jm_financial" | "alpaca";
  segment: string;
  /** Pass IP from request for consent artifact */
  ipAddress?: string;
}

export interface FieldDiffItem {
  fieldName: string;
  /** Human-readable label for the delta form */
  label: string;
  /** "text" | "date" | "select" | "boolean" | "document" | "number" */
  inputType: string;
  /** Options for "select" type */
  options?: string[];
  required: boolean;
  /** Reason this field is in the delta: "missing" | "stale" | "always_required" */
  deltaReason: "missing" | "stale" | "always_required";
  /** For stale: how long ago it expired */
  stalenessInfo?: string;
}

export interface BrokerDiffResult {
  userId: string;
  brokerId: string;
  segment: string;
  /** Fields from vault that satisfy broker requirements — ready to prefill */
  prefilledFields: Record<string, unknown>;
  /** Fields the user must still provide */
  requiredDeltaFields: FieldDiffItem[];
  /** Vault fields that exist but are stale per broker's freshness window */
  staleFields: FieldDiffItem[];
  /** Fields explicitly excluded from this broker's requirements */
  notApplicableFields: string[];
  /** True if no delta is required (all fields are satisfied) */
  isReadyToSubmit: boolean;
  calculationTimestamp: string;
  engine_version: string;
}

export interface BrokerSubmitRequest {
  userId: string;
  brokerId: "iifl" | "jm_financial" | "alpaca";
  segment: string;
  /** User-provided delta fields (form submission) */
  brokerDelta: Record<string, unknown>;
  ipAddress?: string;
  /**
   * The ID of the person performing the action.
   * When an agent acts on behalf of an investor, this is the agent's ID.
   * When the investor acts directly, this equals userId.
   */
  actorId?: string;
  /**
   * Single-use authorization event ID produced by POST /api/kyc/investor-authorize/confirm.
   * Required when actorId !== userId (i.e., agent is submitting on behalf of investor).
   */
  investorAuthorizationEventId?: string;
}

// ─── Adapter registry ────────────────────────────────────────────────────────

const ADAPTER_REGISTRY: Record<string, BrokerAdapter> = {
  iifl:         iiflAdapter,
  jm_financial: jmFinancialAdapter,
  alpaca:       alpacaAdapter,
};

// ─── Broker schema loader ─────────────────────────────────────────────────────

function loadBrokerSchema(brokerId: string): Record<string, unknown> {
  const schemaPath = path.join(
    process.cwd(),
    "infra",
    "broker-schemas",
    `${brokerId.replace("_", "-")}.json`
  );
  try {
    return JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
  } catch {
    throw Object.assign(
      new Error(`Broker schema not found for '${brokerId}'`),
      { retryable: false, error_code: "SCHEMA_NOT_FOUND" }
    );
  }
}

// ─── Field label map for delta form ──────────────────────────────────────────

const FIELD_LABELS: Record<string, { label: string; inputType: string; options?: string[] }> = {
  full_legal_name:                    { label: "Full Legal Name", inputType: "text" },
  date_of_birth:                      { label: "Date of Birth", inputType: "date" },
  pan_number:                         { label: "PAN Number", inputType: "text" },
  mobile_number:                      { label: "Mobile Number", inputType: "text" },
  email:                              { label: "Email Address", inputType: "text" },
  current_address:                    { label: "Current Address", inputType: "text" },
  permanent_address:                  { label: "Permanent Address", inputType: "text" },
  bank_account_number:                { label: "Bank Account Number", inputType: "text" },
  ifsc_code:                          { label: "IFSC Code", inputType: "text" },
  occupation:                         { label: "Occupation", inputType: "select", options: ["salaried", "business", "professional", "retired", "student", "other"] },
  annual_income_band:                 { label: "Annual Income", inputType: "select", options: ["<1L", "1-5L", "5-10L", "10-25L", ">25L"] },
  net_worth_band:                     { label: "Net Worth", inputType: "select", options: ["<10L", "10-50L", "50L-1Cr", ">1Cr"] },
  trading_experience_years:           { label: "Trading Experience (years)", inputType: "number" },
  risk_profile_category:              { label: "Risk Profile", inputType: "select", options: ["conservative", "moderate", "aggressive"] },
  investment_objective:               { label: "Investment Objective", inputType: "select", options: ["growth", "income", "capital_preservation", "speculation"] },
  nominee_details:                    { label: "Nominee Details", inputType: "text" },
  demat_account_linked:               { label: "Demat Account Linked", inputType: "boolean" },
  ssn_or_itin:                        { label: "SSN / ITIN", inputType: "text" },
  tax_residency_countries:            { label: "Country of Tax Residency", inputType: "select", options: ["IN", "US", "GB", "other"] },
  us_person_status:                   { label: "US Person Status", inputType: "select", options: ["us_citizen", "us_resident", "non_us"] },
  employment_status:                  { label: "Employment Status", inputType: "select", options: ["employed", "self_employed", "retired", "student", "unemployed"] },
  broker_dealer_affiliation_disclosure: { label: "Affiliated with a Broker-Dealer or FINRA?", inputType: "boolean" },
  w8_ben_or_w9_document_ref:          { label: "W-8BEN / W-9 Form", inputType: "document" },
  fatca_crs_classification:           { label: "FATCA/CRS Tax Classification", inputType: "select", options: ["individual_us", "individual_non_us", "entity_us", "entity_non_us"] },
  photo_document_ref:                 { label: "Government-Issued Photo ID", inputType: "document" },
};

// ─── Service ──────────────────────────────────────────────────────────────────

class KycBrokerOrchestrator {
  /**
   * Compute the diff between a user's vault profile and broker requirements.
   *
   * Purpose: Determines exactly what information the user needs to provide
   *          for a specific broker, vs what can be auto-prefilled from vault.
   * Inputs:  userId, brokerId, segment
   * Outputs: BrokerDiffResult with prefilled/delta/stale field classification
   */
  async diff(req: BrokerDiffRequest): Promise<BrokerDiffResult> {
    const startTs = Date.now();
    const { userId, brokerId, segment } = req;

    logger.info("KYC_ORCHESTRATOR_DIFF", {
      user_id: userId,
      broker_id: brokerId,
      segment,
});

    // 1. Load broker requirement schema
    const brokerSchema = loadBrokerSchema(brokerId);
    const segmentSchema = (brokerSchema.segments as Record<string, unknown>)?.[segment] as Record<string, unknown> | undefined;
    if (!segmentSchema) {
      throw Object.assign(
        new Error(`Segment '${segment}' not found in ${brokerId} schema`),
        { retryable: false, error_code: "SEGMENT_NOT_FOUND" }
      );
    }

    const requiredFields     = (segmentSchema.required_fields    as string[]) ?? [];
    const prefillableFields  = (segmentSchema.prefillable_from_kra ?? segmentSchema.prefillable_from_vault as string[]) as string[] ?? [];
    const alwaysDeltaFields  = (segmentSchema.always_required_delta as string[]) ?? [];
    const notApplicableFields = (segmentSchema.not_applicable_from_india_kra as string[]) ?? [];
    const freshnessWindows   = (segmentSchema.freshness_windows_days as Record<string, number>) ?? {};

    // 2. Read vault
    const vaultRows = await db
      .select()
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1);

    const vault = vaultRows[0] ?? null;
    const provenance = (vault?.provenanceMetadata ?? {}) as Record<string, { expiry_date?: string; last_synced_at?: string }>;

    // 3. Build canonical profile snapshot (decrypt needed display fields)
    const profile = await this.buildCanonicalSnapshot(vault, false); // no decrypt for diff

    // 4. Run the diff
    const prefilledFields: Record<string, unknown> = {};
    const requiredDeltaFields: FieldDiffItem[] = [];
    const staleFields: FieldDiffItem[] = [];

    for (const field of requiredFields) {
      // Always-delta fields are NEVER prefillable regardless of vault state
      if (alwaysDeltaFields.includes(field)) {
        requiredDeltaFields.push({
          fieldName:  field,
          label:      FIELD_LABELS[field]?.label ?? field,
          inputType:  FIELD_LABELS[field]?.inputType ?? "text",
          options:    FIELD_LABELS[field]?.options,
          required:   true,
          deltaReason: "always_required",
        });
        continue;
      }

      const canonicalKey = this.fieldToCanonicalKey(field);
      const vaultValue   = profile[canonicalKey as keyof CanonicalKycProfile];

      if (!vaultValue) {
        // Field missing from vault
        requiredDeltaFields.push({
          fieldName:  field,
          label:      FIELD_LABELS[field]?.label ?? field,
          inputType:  FIELD_LABELS[field]?.inputType ?? "text",
          options:    FIELD_LABELS[field]?.options,
          required:   true,
          deltaReason: "missing",
        });
      } else {
        // Check freshness
        const freshnessKey = this.fieldToFreshnessKey(field);
        const windowDays   = freshnessWindows[freshnessKey];
        const isStale      = windowDays ? this.isFieldStale(field, provenance, windowDays) : false;

        if (isStale) {
          const stalenessInfo = this.getStalenessInfo(field, provenance, windowDays);
          staleFields.push({
            fieldName:   field,
            label:       FIELD_LABELS[field]?.label ?? field,
            inputType:   FIELD_LABELS[field]?.inputType ?? "text",
            options:     FIELD_LABELS[field]?.options,
            required:    false, // stale = soft refresh, not hard requirement
            deltaReason: "stale",
            stalenessInfo,
          });
          // Still prefill with current value but mark as stale
          prefilledFields[field] = vaultValue;
        } else {
          // Fresh and available — prefill
          prefilledFields[field] = vaultValue;
        }
      }
    }

    const isReadyToSubmit = requiredDeltaFields.length === 0;

    logger.info("KYC_ORCHESTRATOR_DIFF_COMPLETE", {
      user_id: userId,
      broker_id: brokerId,
      segment,
      prefilled_count: Object.keys(prefilledFields).length,
      delta_count:     requiredDeltaFields.length,
      stale_count:     staleFields.length,
      is_ready:        isReadyToSubmit,
      latency_ms:      Date.now() - startTs,
      status:          "success",
});

    return {
      userId,
      brokerId,
      segment,
      prefilledFields,
      requiredDeltaFields,
      staleFields,
      notApplicableFields,
      isReadyToSubmit,
      calculationTimestamp: new Date().toISOString(),
      engine_version: "1.0.0",
    };
  }

  /**
   * Submit KYC to a broker with full guardrails applied.
   *
   * Ordering (non-negotiable):
   * 1. Consent before share (ensureConsentBeforeShare)
   * 2. Idempotency check (checkIdempotency)
   * 3. Build canonical profile (decrypt PII)
   * 4. Call adapter.submitKyc
   * 5. Record result (recordSubmissionResult)
   * 6. Write audit log
   */
  async submit(req: BrokerSubmitRequest): Promise<{
    submissionId?: string;
    brokerClientId?: string;
    status: string;
    cached: boolean;
  }> {
    const startTs = Date.now();
    const { userId, brokerId, segment, brokerDelta, ipAddress } = req;

    // Step 1 — Consent before share (hard stop if fails)
    const fieldNames = Object.keys(brokerDelta).length > 0
      ? Object.keys(brokerDelta)
      : ["full_legal_name", "date_of_birth", "mobile_number", "email"];
    await ensureConsentBeforeShare(userId, brokerId, fieldNames, ipAddress);

    // Step 2 — Idempotency check
    const idempotency = await checkIdempotency(userId, brokerId, segment);
    if (idempotency.isCachedSuccess && idempotency.cachedResult) {
      logger.info("KYC_ORCHESTRATOR_SUBMIT_CACHED", {
        user_id: userId,
        broker_id: brokerId,
        status: "success",
        latency_ms: Date.now() - startTs,
});
      return {
        submissionId: idempotency.submissionId,
        brokerClientId: idempotency.cachedResult.brokerClientId,
        status: idempotency.cachedResult.status,
        cached: true,
      };
    }

    if (!idempotency.canRetry) {
      throw Object.assign(
        new Error("Max retry attempts exceeded for this broker submission"),
        { retryable: false, error_code: "MAX_RETRIES_EXCEEDED" }
      );
    }

    // Step 3 — Build canonical profile with decrypted PII
    const vaultRows = await db
      .select()
      .from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1);

    const vault = vaultRows[0];
    if (!vault) {
      throw Object.assign(
        new Error("No vault profile found for user"),
        { retryable: false, error_code: "VAULT_NOT_FOUND" }
      );
    }

    const profile = await this.buildCanonicalSnapshot(vault, true); // decrypt=true for submission

    // Step 4 — Resolve adapter and submit
    const adapter = ADAPTER_REGISTRY[brokerId];
    if (!adapter) {
      throw Object.assign(
        new Error(`No adapter registered for broker '${brokerId}'`),
        { retryable: false, error_code: "ADAPTER_NOT_FOUND" }
      );
    }

    try {
      const result = await adapter.submitKyc(profile, brokerDelta, idempotency.idempotencyKey);

      // Step 5 — Record result
      await recordSubmissionResult(idempotency.idempotencyKey, {
        success: true,
        brokerClientId: result.brokerClientId,
        status: result.status,
        rawResponseRef: result.rawResponseRef,
        canonicalWriteBack: result.canonicalWriteBack as Record<string, unknown>,
      });

      // Step 6 — Audit log
      await this.writeAuditLog({
        userId,
        brokerId,
        accessType: "kyc_submit",
        purpose: `KYC submitted to ${brokerId}`,
        ipAddress,
        status: "success",
      });

      logger.info("KYC_ORCHESTRATOR_SUBMIT_SUCCESS", {
        user_id: userId,
        broker_id: brokerId,
        broker_client_id: result.brokerClientId,
        latency_ms: Date.now() - startTs,
        status: "success",
});

      return {
        brokerClientId: result.brokerClientId,
        status: result.status,
        cached: false,
      };
    } catch (error: any) {
      await recordSubmissionResult(idempotency.idempotencyKey, {
        success: false,
        errorCode: error.error_code ?? "UNKNOWN",
        errorMessage: error.message,
        retryable: !!error.retryable,
      });
      throw error;
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Build a canonical profile from a vault row.
   * When decrypt=true, decrypts encrypted fields. When false, only includes
   * non-sensitive fields (for diff — no decryption needed).
   */
  private async buildCanonicalSnapshot(
    vault: typeof kycVault.$inferSelect | null,
    decrypt: boolean
  ): Promise<CanonicalKycProfile> {
    if (!vault) return { userId: "" };

    const decryptField = (encrypted: string | null | undefined): string | undefined => {
      if (!encrypted || !decrypt) return undefined;
      try {
        return encryptionService.decrypt(encrypted) ?? undefined;
      } catch {
        return undefined;
      }
    };

    return {
      userId: vault.userId,
      // Identity (non-sensitive for diff)
      occupation:      vault.occupation ?? undefined,
      nationality:     vault.nationality ?? undefined,
      taxResidencyCountries: vault.taxResidencyCountries ?? [],
      // Contact
      email:           decrypt ? decryptField(vault.encryptedEmail) : undefined,
      mobileNumber:    decrypt ? decryptField(vault.encryptedMobile) : undefined,
      // PII (only decrypted for submission)
      fullLegalName:   decryptField(vault.encryptedFullName),
      dateOfBirth:     decryptField(vault.encryptedDateOfBirth),
      gender:          decryptField(vault.encryptedGender) as "M" | "F" | "O" | undefined,
      // Financial
      annualIncomeBand:       vault.annualIncomeBand ?? undefined,
      netWorthBand:           vault.netWorthBand ?? undefined,
      tradingExperienceYears: vault.tradingExperienceYears ?? undefined,
      riskProfileCategory:    vault.riskProfileCategory ?? undefined,
      investmentObjective:    vault.investmentObjective ?? undefined,
      sourceOfFunds:          vault.sourceOfFunds ?? undefined,
      // India-specific (decrypted only for submission)
      bankAccountNumber: decryptField(vault.encryptedBankAccountNumber),
      ifscCode:          decryptField(vault.encryptedIfscCode),
      dematAccountLinked: vault.dematAccountLinked ?? false,
      segmentActivations: vault.segmentActivations as Record<string, string[]> | undefined,
      nomineeDetails:     vault.nomineeDetails as Record<string, unknown> | undefined,
      // Current address (decrypt for submission)
      currentAddress: decrypt && vault.encryptedAddress ? {
        line1: decryptField(vault.encryptedAddress),
        city:  decryptField(vault.encryptedCity),
        state: decryptField(vault.encryptedState),
        pincode: decryptField(vault.encryptedPincode),
        country: "India",
      } : undefined,
      // US fields — ONLY set if explicitly in vault and decrypt=true
      // ssnOrItin is NEVER prefilled into canonical for Alpaca (adapter enforces this too)
      usPersonStatus:                   vault.usPersonStatus ?? undefined,
      w8BenOrW9DocumentRef:             vault.w8BenOrW9DocumentRef ?? undefined,
      fatcaCrsClassification:           vault.fatcaCrsClassification ?? undefined,
      usEmploymentStatus:               vault.usEmploymentStatus ?? undefined,
      brokerDealerAffiliationDisclosure: vault.brokerDealerAffiliationDisclosure ?? undefined,
      // Provenance
      provenanceMetadata: vault.provenanceMetadata as unknown as Record<string, FieldProvenance> | undefined,
    };
  }

  private fieldToCanonicalKey(field: string): string {
    // snake_case → camelCase
    return field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }

  private fieldToFreshnessKey(field: string): string {
    if (field.includes("address")) return "address_proof";
    if (field === "bank_account_number" || field === "ifsc_code") return "bank_details";
    if (field === "pan_number") return "pan_verification";
    if (field.includes("net_worth")) return "net_worth_certificate";
    return field;
  }

  private isFieldStale(
    field: string,
    provenance: Record<string, { expiry_date?: string; last_synced_at?: string }>,
    windowDays: number
  ): boolean {
    const key = this.fieldToCanonicalKey(field);
    const prov = provenance[key];
    if (!prov) return false;
    if (prov.expiry_date && new Date(prov.expiry_date) < new Date()) return true;
    if (prov.last_synced_at) {
      const syncedAt = new Date(prov.last_synced_at);
      const cutoff   = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
      return syncedAt < cutoff;
    }
    return false;
  }

  private getStalenessInfo(
    field: string,
    provenance: Record<string, { expiry_date?: string; last_synced_at?: string }>,
    windowDays: number
  ): string {
    const key = this.fieldToCanonicalKey(field);
    const prov = provenance[key];
    if (prov?.expiry_date) {
      const daysAgo = Math.round((Date.now() - new Date(prov.expiry_date).getTime()) / 86400000);
      return `Expired ${daysAgo} days ago`;
    }
    return `Older than ${windowDays}-day freshness window`;
  }

  private async writeAuditLog(params: {
    userId: string;
    brokerId: string;
    accessType: string;
    purpose: string;
    ipAddress?: string;
    status: string;
  }): Promise<void> {
    try {
      await db.insert(kycAuditLogs).values({
        userId:          params.userId,
        accessedBy:      "system",
        accessType:      params.accessType,
        externalParty:   params.brokerId,
        purpose:         params.purpose,
        ipAddress:       params.ipAddress,
        accessStatus:    params.status,
        regulatoryPurpose: "broker_kyc_onboarding",
        complianceCheckPassed: params.status === "success",
      });
    } catch (err) {
      // Audit log write failure does not abort the main flow, but is logged
      logger.error("KYC_AUDIT_LOG_WRITE_FAILED", {
        user_id: params.userId,
        message: (err as Error).message,
        status: "error",
});
    }
  }
}

export const kycBrokerOrchestrator = new KycBrokerOrchestrator();
