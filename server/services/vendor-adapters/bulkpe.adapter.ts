/**
 * Bulkpe Director Phone Lookup Adapter
 *
 * Purpose : Fetches a company director's mobile number from Bulkpe using their
 *           DIN (Director Identification Number). This bridges the gap left by
 *           CredHive's free tier, which returns director metadata but not phones.
 *
 * Why Bulkpe over EasyLeadz:
 *   - Input is DIN — which we already have from CredHive (no LinkedIn needed)
 *   - Synchronous response — no webhook complexity
 *   - MCA-sourced data — directly tied to regulatory registrations
 *   - Credits charged only on successful phone retrieval
 *
 * API:
 *   POST https://api.bulkpe.in/client/getdirectorfrommobile
 *   Authorization: Bearer <API_KEY>
 *   Body: { reference: string, din: string }
 *
 *   Success: { status: true, data: { din_number, phone_number, reference } }
 *   Failure: { status: false, message: "No director mobile data found." }
 *
 * Integration point:
 *   Called from prospect-contact-enricher.ts after CredHive populates director
 *   names/designations. Fills primary_mobile, secondary_mobile, tertiary_mobile
 *   for each director tier.
 *
 * GCR compliance:
 *   - Credentials via env vars only — never hardcoded.
 *   - Max 3 retries with exponential backoff on 5xx/429.
 *   - Phone numbers masked in all logs.
 *   - Idempotent: skip if phone already populated.
 *   - Structured logs: { event, lead_id, latency_ms, status }.
 *   - Errors follow: { error_code, message, retryable }.
 */

import axios from "axios";
import { logger } from "../../logger";

// ── Config ────────────────────────────────────────────────────────────────────

const BULKPE_API_KEY = process.env.BULKPE_API_KEY ?? "";
const BULKPE_BASE_URL = "https://api.bulkpe.in/client/getdirectorfrommobile";
const MAX_RETRIES = 3;
const ENGINE_VERSION = "bulkpe-adapter-v1.0";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BulkpePhoneLookupRequest {
  /** Director Identification Number from MCA/CredHive */
  din: string;
  /** The prospect_leads.id — used for reference ID and logging */
  leadId: string;
  /** Director name for logging */
  directorName?: string;
  /** Which contact tier this director belongs to */
  contactTier: "primary" | "secondary" | "tertiary";
}

export interface BulkpePhoneLookupResult {
  success: boolean;
  phone?: string;
  din: string;
  contactTier: "primary" | "secondary" | "tertiary";
  engine_version: string;
  skipped_reason?: string;
}

// Bulkpe raw API response shape
interface BulkpeApiResponse {
  status: boolean;
  statusCode: number;
  message: string;
  data?: {
    din_number?: string;
    phone_number?: string;
    reference?: string;
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, "*");
}

function buildReference(leadId: string, din: string): string {
  // Compact reference ID for Bulkpe dedup — max ~40 chars
  return `fp_${leadId.slice(0, 8)}_${din}`;
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const status = err?.response?.status ?? 0;
      const retryable = status === 429 || status >= 500;
      if (!retryable || attempt === MAX_RETRIES) break;
      const backoff = attempt * 1000;
      await new Promise((r) => setTimeout(r, backoff));
      logger.warn(`${label}_RETRY`, {
        event: `${label}_RETRY`,
        attempt,
        backoff_ms: backoff,
        status: "retrying",
      });
    }
  }
  throw lastErr;
}

// ── Main adapter ──────────────────────────────────────────────────────────────

export class BulkpeAdapter {
  readonly available: boolean;

  constructor() {
    this.available = !!BULKPE_API_KEY;
    if (!this.available) {
      logger.warn("BULKPE_NOT_CONFIGURED", {
        event: "BULKPE_NOT_CONFIGURED",
        message: "BULKPE_API_KEY not set — director phone enrichment via Bulkpe disabled",
        status: "warn",
      });
    }
  }

  /**
   * Fetches a director's mobile number from Bulkpe using their DIN.
   * Synchronous — returns the phone number immediately (no webhook needed).
   *
   * @param req - DIN, leadId, contactTier and optional director name
   * @returns Phone number if found, or { success: false } if not found / not configured
   */
  async getDirectorPhone(
    req: BulkpePhoneLookupRequest,
  ): Promise<BulkpePhoneLookupResult> {
    const startMs = Date.now();

    if (!this.available) {
      return {
        success: false,
        din: req.din,
        contactTier: req.contactTier,
        engine_version: ENGINE_VERSION,
        skipped_reason: "api_key_not_configured",
      };
    }

    if (!req.din) {
      return {
        success: false,
        din: "",
        contactTier: req.contactTier,
        engine_version: ENGINE_VERSION,
        skipped_reason: "no_din",
      };
    }

    const reference = buildReference(req.leadId, req.din);

    try {
      const response = await withRetry(
        () =>
          axios.post<BulkpeApiResponse>(
            BULKPE_BASE_URL,
            { reference, din: req.din },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${BULKPE_API_KEY}`,
              },
              timeout: 12_000,
            },
          ),
        "BULKPE_DIRECTOR_PHONE",
      );

      const body = response.data;

      if (!body.status || !body.data?.phone_number) {
        logger.info("BULKPE_PHONE_NOT_FOUND", {
          event: "BULKPE_PHONE_NOT_FOUND",
          lead_id: req.leadId,
          din: req.din,
          director: req.directorName,
          contact_tier: req.contactTier,
          bulkpe_message: body.message,
          latency_ms: Date.now() - startMs,
          engine_version: ENGINE_VERSION,
          status: "not_found",
        });
        return {
          success: false,
          din: req.din,
          contactTier: req.contactTier,
          engine_version: ENGINE_VERSION,
          skipped_reason: "not_found",
        };
      }

      const phone = body.data.phone_number;

      logger.info("BULKPE_PHONE_FOUND", {
        event: "BULKPE_PHONE_FOUND",
        lead_id: req.leadId,
        din: req.din,
        director: req.directorName,
        contact_tier: req.contactTier,
        phone_masked: maskPhone(phone),
        latency_ms: Date.now() - startMs,
        engine_version: ENGINE_VERSION,
        status: "success",
      });

      return {
        success: true,
        phone,
        din: req.din,
        contactTier: req.contactTier,
        engine_version: ENGINE_VERSION,
      };
    } catch (err: any) {
      logger.error("BULKPE_LOOKUP_FAILED", {
        event: "BULKPE_LOOKUP_FAILED",
        lead_id: req.leadId,
        din: req.din,
        director: req.directorName,
        contact_tier: req.contactTier,
        error: err?.message ?? String(err),
        http_status: err?.response?.status,
        retryable: false,
        latency_ms: Date.now() - startMs,
        engine_version: ENGINE_VERSION,
        status: "error",
      });

      return {
        success: false,
        din: req.din,
        contactTier: req.contactTier,
        engine_version: ENGINE_VERSION,
        skipped_reason: "lookup_error",
      };
    }
  }

  /**
   * Batch lookup for all 3 director tiers in parallel.
   * Skips any tier that already has a phone or is missing a DIN.
   *
   * @param leadId - The prospect_leads.id
   * @param tiers - Array of { tier, din, name, existingPhone }
   * @returns Array of results in same order as input
   */
  async lookupAllTiers(
    leadId: string,
    tiers: Array<{
      tier: "primary" | "secondary" | "tertiary";
      din?: string | null;
      name?: string;
      existingPhone?: string | null;
    }>,
  ): Promise<BulkpePhoneLookupResult[]> {
    const results = await Promise.allSettled(
      tiers
        .filter((t) => !t.existingPhone) // skip tiers that already have a phone
        .filter((t) => !!t.din)          // skip tiers with no DIN
        .map((t) =>
          this.getDirectorPhone({
            leadId,
            din: t.din!,
            directorName: t.name,
            contactTier: t.tier,
          }),
        ),
    );

    return results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            success: false,
            din: "",
            contactTier: "primary" as const,
            engine_version: ENGINE_VERSION,
            skipped_reason: "promise_rejected",
          },
    );
  }
}

export const bulkpeAdapter = new BulkpeAdapter();
