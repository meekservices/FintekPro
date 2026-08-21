/**
 * EasyLeadz Adapter
 *
 * Purpose : Fetches direct mobile phone numbers for Indian company directors
 *           using EasyLeadz (Mr. E) API. Used as a fallback enrichment layer
 *           when CredHive doesn't return per-director phone numbers.
 *
 * Flow    : Async / webhook-based
 *   1. FintekPro calls POST https://app.easyleadz.com/api/prod/
 *      with { url: linkedInUrl OR email: email, callbackUrl: ourWebhook }
 *   2. EasyLeadz processes and POSTs result to our /api/webhooks/easyleadz
 *   3. Webhook handler stores the phone in the correct prospect_leads tier column
 *
 * Inputs  :
 *   - Director name (for logging / dedup)
 *   - LinkedIn URL  (preferred identifier — higher hit rate)
 *   - Email         (fallback identifier)
 *   - leadId        (passed as metadata in callbackUrl query param for routing)
 *   - contactTier   ("primary" | "secondary" | "tertiary")
 *
 * GCR compliance:
 *   - No raw SQL: all DB writes via Drizzle ORM in the webhook handler.
 *   - Idempotent: checks if phone already exists before firing request.
 *   - Credits-aware: EasyLeadz only charges on successful phone find.
 *   - Observability: structured log on every request + webhook receipt.
 *   - Mobile numbers masked in all logs.
 *   - Max 3 retries with backoff on 5xx.
 */

import axios from "axios";
import { logger } from "../../logger";

// ── Config ────────────────────────────────────────────────────────────────────

const EASYLEADZ_API_KEY = process.env.EASYLEADZ_API_KEY ?? "";
const EASYLEADZ_BASE_URL = "https://app.easyleadz.com/api/prod/";
// The publicly reachable URL FintekPro hosts its webhook on
const EASYLEADZ_CALLBACK_BASE_URL =
  process.env.EASYLEADZ_CALLBACK_URL ??
  "https://fintekpro-app-7f3fb64pqq-el.a.run.app";

const MAX_RETRIES = 3;
const ENGINE_VERSION = "easyleadz-adapter-v1.0";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ContactTier = "primary" | "secondary" | "tertiary";

export interface EasyLeadzRequest {
  /** Director's name — used for logging only */
  directorName: string;
  /** LinkedIn profile URL — preferred over email for accuracy */
  linkedinUrl?: string;
  /** Professional email — used if no LinkedIn URL available */
  email?: string;
  /** The prospect_leads.id to update when callback fires */
  leadId: string;
  /** Which contact tier column to write the phone into */
  contactTier: ContactTier;
  /** DIN for de-dup tracking */
  din?: string;
}

export interface EasyLeadzDispatchResult {
  dispatched: boolean;
  requestId?: string;
  skipped_reason?: string;
  engine_version: string;
}

// Inbound webhook payload from EasyLeadz
export interface EasyLeadzWebhookPayload {
  request_id: string;
  status: "1" | "0"; // "1" = found, "0" = not found
  message: string;
  data: {
    phone?: string;          // The direct dial found
    email?: string;
    url?: string;            // LinkedIn URL echoed back
    live_mode?: string;
    // FintekPro metadata we embedded in the callbackUrl
    lead_id?: string;
    contact_tier?: ContactTier;
    din?: string;
  };
}

// ── Utility ───────────────────────────────────────────────────────────────────

function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, "*");
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
      const backoff = attempt * 1200;
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

export class EasyLeadzAdapter {
  readonly available: boolean;

  constructor() {
    this.available = !!EASYLEADZ_API_KEY;
    if (!this.available) {
      logger.warn("EASYLEADZ_NOT_CONFIGURED", {
        event: "EASYLEADZ_NOT_CONFIGURED",
        message: "EASYLEADZ_API_KEY not set — director phone enrichment disabled",
        status: "warn",
      });
    }
  }

  /**
   * Dispatches an async phone enrichment request to EasyLeadz.
   * The result will be delivered to POST /api/webhooks/easyleadz
   * with leadId + contactTier embedded in the callback URL query string.
   *
   * Credits are only consumed by EasyLeadz if a phone number is found.
   *
   * @param req - Enrichment request parameters
   * @returns Dispatch result including request_id for tracking
   */
  async dispatchPhoneLookup(
    req: EasyLeadzRequest,
  ): Promise<EasyLeadzDispatchResult> {
    const startMs = Date.now();

    // Guard: must have LinkedIn URL or email
    if (!req.linkedinUrl && !req.email) {
      logger.info("EASYLEADZ_SKIPPED", {
        event: "EASYLEADZ_SKIPPED",
        lead_id: req.leadId,
        director: req.directorName,
        reason: "no_identifier",
        status: "skipped",
      });
      return {
        dispatched: false,
        skipped_reason: "no_linkedin_or_email",
        engine_version: ENGINE_VERSION,
      };
    }

    if (!this.available) {
      return {
        dispatched: false,
        skipped_reason: "api_key_not_configured",
        engine_version: ENGINE_VERSION,
      };
    }

    // Build callback URL with FintekPro routing metadata embedded as query params
    // EasyLeadz will POST to this URL when the phone is found
    const callbackUrl = new URL(`${EASYLEADZ_CALLBACK_BASE_URL}/api/webhooks/easyleadz`);
    callbackUrl.searchParams.set("lead_id", req.leadId);
    callbackUrl.searchParams.set("contact_tier", req.contactTier);
    if (req.din) callbackUrl.searchParams.set("din", req.din);

    const payload: Record<string, unknown> = {
      data: {
        callbackUrl: callbackUrl.toString(),
        ...(req.linkedinUrl ? { url: req.linkedinUrl } : {}),
        ...(req.email && !req.linkedinUrl ? { email: req.email } : {}),
      },
    };

    try {
      const response = await withRetry(
        () =>
          axios.post(EASYLEADZ_BASE_URL, payload, {
            headers: {
              "Content-Type": "application/json",
              "Enapi-Key": EASYLEADZ_API_KEY,
            },
            timeout: 10_000,
          }),
        "EASYLEADZ_DISPATCH",
      );

      const requestId: string =
        response.data?.data?.request_id ?? "unknown";

      logger.info("EASYLEADZ_DISPATCHED", {
        event: "EASYLEADZ_DISPATCHED",
        lead_id: req.leadId,
        director: req.directorName,
        contact_tier: req.contactTier,
        din: req.din,
        request_id: requestId,
        identifier_type: req.linkedinUrl ? "linkedin" : "email",
        latency_ms: Date.now() - startMs,
        engine_version: ENGINE_VERSION,
        status: "success",
      });

      return {
        dispatched: true,
        requestId,
        engine_version: ENGINE_VERSION,
      };
    } catch (err: any) {
      logger.error("EASYLEADZ_DISPATCH_FAILED", {
        event: "EASYLEADZ_DISPATCH_FAILED",
        lead_id: req.leadId,
        director: req.directorName,
        contact_tier: req.contactTier,
        error: err?.message ?? String(err),
        http_status: err?.response?.status,
        retryable: false,
        status: "error",
      });

      return {
        dispatched: false,
        skipped_reason: "dispatch_error",
        engine_version: ENGINE_VERSION,
      };
    }
  }

  /**
   * Convenience: dispatch lookups for all 3 director tiers in parallel.
   * Only fires for tiers that have no phone yet and have an identifier.
   */
  async dispatchForAllTiers(
    leadId: string,
    tiers: Array<{
      tier: ContactTier;
      name: string;
      linkedinUrl?: string;
      email?: string;
      din?: string;
      existingPhone?: string | null;
    }>,
  ): Promise<EasyLeadzDispatchResult[]> {
    const results = await Promise.allSettled(
      tiers
        .filter((t) => !t.existingPhone) // skip tiers already have a phone
        .filter((t) => t.linkedinUrl || t.email) // skip tiers with no identifier
        .map((t) =>
          this.dispatchPhoneLookup({
            leadId,
            directorName: t.name,
            linkedinUrl: t.linkedinUrl,
            email: t.email,
            contactTier: t.tier,
            din: t.din,
          }),
        ),
    );

    return results.map((r) =>
      r.status === "fulfilled"
        ? r.value
        : {
            dispatched: false,
            skipped_reason: "promise_rejected",
            engine_version: ENGINE_VERSION,
          },
    );
  }
}

export const easyLeadzAdapter = new EasyLeadzAdapter();
