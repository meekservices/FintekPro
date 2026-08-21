/**
 * Explorium AgentSource API Service
 *
 * Unified B2B data enrichment & lead discovery client.
 * Aggregates 50+ data providers: firmographics, intent signals,
 * technographics, professional profiles, and business events.
 *
 * Architecture: /services layer — no direct DB access, no route logic.
 * Security: API key read from env (EXPLORIUM_API_KEY). Never logged.
 * FASP-AI: Every enrichment call logs { event, latency_ms, status }.
 * Self-Healing: Retry on transient failures (max 3, exponential backoff).
 */

import { logger } from "../logger";

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = process.env.EXPLORIUM_BASE_URL ?? "https://api.explorium.ai/v1";
const API_KEY = process.env.EXPLORIUM_API_KEY ?? "";
const PARTNER_ID = process.env.EXPLORIUM_PARTNER_ID ?? "";
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 500;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExploriumBusinessFilters {
  country?: string;
  city?: string | string[];
  state?: string | string[];
  revenue_band?: string;
  employee_count_min?: number;
  employee_count_max?: number;
  industry?: string | string[];
  technology?: string[];
  founded_after?: number;
  has_recent_funding?: boolean;
}

export interface ExploriumBusiness {
  business_id: string;
  name: string;
  domain?: string;
  city?: string;
  state?: string;
  country?: string;
  revenue_band?: string;
  employee_count?: number;
  industry?: string;
  founded_year?: number;
  website?: string;
}

export type ExploriumSignalType =
  | "funding_round"
  | "ipo_announcement"
  | "executive_hire"
  | "cost_cutting"
  | "legal_proceedings"
  | "new_partnership"
  | "new_product"
  | "office_opening"
  | "office_closing"
  | "m_and_a"
  | "outage"
  | "company_award"
  | "workforce_increase"
  | "workforce_decrease";

export interface ExploriumSignal {
  signal_type: ExploriumSignalType;
  detected_at: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface ExploriumEnrichment {
  business_id: string;
  firmographics: {
    revenue_band?: string;
    employee_count?: number;
    industry?: string;
    founded_year?: number;
    company_type?: string;
    hq_city?: string;
    hq_state?: string;
    description?: string;
  };
  financials?: {
    revenue?: number;
    ebitda?: number;
    funding_total?: number;
    last_funding_round?: string;
    last_funding_date?: string;
  };
  technographics?: {
    technologies: string[];
  };
  workforce?: {
    headcount_trend?: "growing" | "stable" | "shrinking";
  };
  signals?: ExploriumSignal[];
}

export interface ExploriumMatchResult {
  business_id: string;
  match_confidence: number;
  name: string;
  domain?: string;
}

export interface ExploriumDiscoveryResult {
  businesses: ExploriumBusiness[];
  total: number;
  page: number;
  page_size: number;
}

// ── Internal HTTP helper ──────────────────────────────────────────────────────

async function callExplorium<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  attempt = 1,
): Promise<T> {
  if (!API_KEY) {
    throw new Error("EXPLORIUM_API_KEY is not configured. Set it in .env.");
  }
  if (!PARTNER_ID) {
    throw new Error("EXPLORIUM_PARTNER_ID is not configured. Set it in .env.");
  }

  const url = `${BASE_URL}${path}`;
  const startMs = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "api_key": API_KEY,
        "X-Context-Partner-ID": PARTNER_ID,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const latencyMs = Date.now() - startMs;

    if (!response.ok) {
      const errorBody = await response.text();
      if ((response.status === 429 || response.status >= 500) && attempt <= MAX_RETRIES) {
        const waitMs = RETRY_BASE_MS * 2 ** (attempt - 1);
        logger.warn(`[Explorium] ${method} ${path} → ${response.status} — retrying in ${waitMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
        await sleep(waitMs);
        return callExplorium(method, path, body, attempt + 1);
      }
      logger.error("EXPLORIUM_API_ERROR", { path, status: response.status, latency_ms: latencyMs });
      throw new Error(`Explorium API error ${response.status}: ${errorBody.slice(0, 200)}`);
    }

    const data: T = await response.json();
    logger.info("EXPLORIUM_API_CALL", { path, method, status: response.status, latency_ms: latencyMs });
    return data;
  } catch (err: any) {
    if (err.name === "AbortError") throw new Error(`Explorium API timeout after ${DEFAULT_TIMEOUT_MS}ms: ${path}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Discover companies matching given filters.
 * @param filters   - firmographic/geographic/technographic filters
 * @param page      - 1-indexed page number
 * @param pageSize  - records per page (max 100)
 */
export async function discoverCompanies(
  filters: ExploriumBusinessFilters,
  page = 1,
  pageSize = 100,
): Promise<ExploriumDiscoveryResult> {
  return callExplorium<ExploriumDiscoveryResult>("POST", "/businesses/fetch", {
    filters,
    page,
    page_size: pageSize,
  });
}

/**
 * Get audience size estimate BEFORE fetching full records.
 * Use to budget API credits.
 */
export async function getDiscoveryStats(
  filters: ExploriumBusinessFilters,
): Promise<{ total_matches: number; estimated_credits: number }> {
  return callExplorium("POST", "/businesses/stats", { filters });
}

/**
 * Resolve company name + domain → canonical business_id.
 * @param name    - company name (required)
 * @param domain  - website domain (optional, improves accuracy)
 */
export async function matchBusiness(
  name: string,
  domain?: string,
): Promise<ExploriumMatchResult | null> {
  try {
    const result = await callExplorium<{ matches: ExploriumMatchResult[] }>(
      "POST",
      "/businesses/match",
      { name, domain },
    );
    return result.matches?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Bulk match up to 1000 businesses in a single call.
 */
export async function bulkMatchBusinesses(
  entities: Array<{ name: string; domain?: string }>,
): Promise<Array<ExploriumMatchResult | null>> {
  const result = await callExplorium<{
    results: Array<{ matches: ExploriumMatchResult[] }>;
  }>("POST", "/businesses/bulk-match", { entities });
  return result.results.map((r) => r.matches?.[0] ?? null);
}

/**
 * Enrich a matched business with firmographics, financials, workforce, technographics.
 * @param businessId - canonical business_id from matchBusiness()
 */
export async function enrichBusiness(
  businessId: string,
): Promise<ExploriumEnrichment | null> {
  try {
    const result = await callExplorium<{ enrichments: ExploriumEnrichment[] }>(
      "POST",
      "/businesses/bulk-enrich",
      { business_ids: [businessId] },
    );
    return result.enrichments?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Bulk enrich up to 50 businesses per call.
 */
export async function bulkEnrichBusinesses(
  businessIds: string[],
): Promise<ExploriumEnrichment[]> {
  if (businessIds.length === 0) return [];
  const chunk = businessIds.slice(0, 50);
  const result = await callExplorium<{ enrichments: ExploriumEnrichment[] }>(
    "POST",
    "/businesses/bulk-enrich",
    { business_ids: chunk },
  );
  return result.enrichments ?? [];
}

/**
 * Fetch business signals/events for a matched business.
 * @param businessId   - canonical business_id
 * @param signalTypes  - filter to specific types (empty = all)
 * @param since        - only events after this ISO date
 */
export async function getBusinessSignals(
  businessId: string,
  signalTypes?: ExploriumSignalType[],
  since?: string,
): Promise<ExploriumSignal[]> {
  const result = await callExplorium<{ events: ExploriumSignal[] }>(
    "POST",
    "/businesses/events",
    { business_id: businessId, event_types: signalTypes, since },
  );
  return result.events ?? [];
}

/**
 * Enroll a business_id for real-time webhook push delivery.
 * Events will be POSTed to /api/webhooks/explorium.
 * @param businessId     - business to monitor
 * @param enrollmentKey  - internal lead ID for routing
 * @param signalTypes    - which events to watch
 */
export async function enrollBusinessForWebhooks(
  businessId: string,
  enrollmentKey: string,
  signalTypes: ExploriumSignalType[],
): Promise<{ enrollment_id: string; status: string }> {
  return callExplorium("POST", "/webhooks/enrollments", {
    business_id: businessId,
    enrollment_key: enrollmentKey,
    event_types: signalTypes,
    webhook_url: `${process.env.APP_BASE_URL ?? ""}/api/webhooks/explorium`,
  });
}

/**
 * Verify HMAC signature on incoming webhook payloads.
 * @param payload   - raw request body string
 * @param signature - X-Explorium-Signature header value
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const webhookSecret = process.env.EXPLORIUM_WEBHOOK_SECRET ?? "";
  if (!webhookSecret) return false;
  const { createHmac } = require("crypto");
  const expected = createHmac("sha256", webhookSecret).update(payload).digest("hex");
  return signature === `sha256=${expected}`;
}

/**
 * FintekPro ICP (Ideal Customer Profile) for Indian B2B lead discovery.
 * Targets SMEs and growth-stage companies likely to need wealth advisory.
 */
export function buildFintekProICP(
  overrides: Partial<ExploriumBusinessFilters> = {},
): ExploriumBusinessFilters {
  return {
    country: "IN",
    employee_count_min: 20,
    employee_count_max: 5000,
    revenue_band: "1M+",
    city: [
      "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Pune",
      "Chennai", "Ahmedabad", "Kolkata", "Surat", "Jaipur",
    ],
    industry: [
      "Financial Services", "Manufacturing", "Technology",
      "Healthcare", "Real Estate", "Pharmaceuticals", "FMCG",
      "Retail", "Logistics",
    ],
    ...overrides,
  };
}
