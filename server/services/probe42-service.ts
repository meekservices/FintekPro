/**
 * Probe42 Integration Service
 *
 * Secondary / fallback provider for company director enrichment.
 * Activated automatically when CredHive is unavailable (API key missing,
 * quota exhausted, or repeated HTTP failures).
 *
 * Endpoints used:
 *   POST /v2/company/search          – search by name or CIN
 *   GET  /v2/company/{cin}           – company profile
 *   GET  /v2/company/{cin}/directors – director information
 *
 * Configuration (env vars):
 *   PROBE42_API_KEY      – required; service is no-op when absent
 *   PROBE42_BASE_URL     – optional; defaults to https://api.probe42.in/prod_new
 *
 * GCR compliance:
 *   - Stateless; no DB writes (persistence is handled by director-contact-service)
 *   - Retry: 3 attempts with exponential backoff (400 ms, 800 ms, 1600 ms)
 *   - Cache: 24 h TTL via distributedCache (same as CredHive)
 *   - Logs: structured JSON per { event, latency_ms, status }
 *   - Secrets: API key read from env only — never logged or exposed
 *   - Director response is normalised to the same `CredhiveDirector` shape so
 *     `runDirectorContactPipeline()` requires zero changes
 */

import axios, { AxiosInstance } from "axios";
import { distributedCache } from "../utils/distributed-cache";
import { logger } from "../logger";
import type { CredhiveDirector } from "./credhive-service";

// ── Config ────────────────────────────────────────────────────────────────────

const PROBE42_API_KEY = process.env.PROBE42_API_KEY ?? "";
const PROBE42_BASE_URL =
  process.env.PROBE42_BASE_URL ?? "https://apiportal.probe42.in/v2";

const RETRY_DELAYS_MS = [400, 800, 1600];
const CACHE_TTL_S = 86_400; // 24 hours

// ── Response types (public) ───────────────────────────────────────────────────

export interface Probe42SearchResult {
  cin: string;
  company_name: string;
  status: string;
  company_type?: string;
  roc_state?: string;
  date_of_incorporation?: string;
}

export interface Probe42CompanyProfile {
  cin: string;
  company_name: string;
  status: string;
  company_type?: string;
  roc_state?: string;
  date_of_incorporation?: string;
  registered_address?: string;
  authorized_capital?: number;
  paid_up_capital?: number;
  sector?: string;
  industry?: string;
  email?: string;
  website?: string;
}

export interface Probe42SearchResponse {
  success: boolean;
  data?: Probe42SearchResult[];
  error?: string;
  isApiKeyMissing?: boolean;
}

export interface Probe42ProfileResponse {
  success: boolean;
  data?: Probe42CompanyProfile;
  error?: string;
  isApiKeyMissing?: boolean;
}

export interface Probe42DirectorsResponse {
  success: boolean;
  /** Normalised to CredhiveDirector shape so the pipeline consumes it unchanged */
  data?: CredhiveDirector[];
  error?: string;
  isApiKeyMissing?: boolean;
}

// ── Service ───────────────────────────────────────────────────────────────────

class Probe42Service {
  private readonly client: AxiosInstance;
  private readonly available: boolean;

  constructor() {
    this.available = !!PROBE42_API_KEY;
    this.client = axios.create({
      baseURL: PROBE42_BASE_URL,
      timeout: 15_000,
      headers: {
        "x-api-key": PROBE42_API_KEY,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  /** Returns true when PROBE42_API_KEY is configured */
  isAvailable(): boolean {
    return this.available;
  }

  // ── Search ────────────────────────────────────────────────────────────────

  /**
   * Search companies by name or CIN.
   *
   * @param query  Company name fragment or full 21-character CIN
   */
  async searchCompanies(query: string): Promise<Probe42SearchResponse> {
    if (!this.available) {
      return this._unavailable<Probe42SearchResponse>({ data: [] });
    }

    const t0 = Date.now();
    try {
      const isCin = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/i.test(
        query.trim(),
      );
      const response = await this._withRetry(() =>
        this.client.post("/company/search", {
          query: query.trim(),
          search_type: isCin ? "cin" : "name",
          limit: 10,
        }),
      );

      const rows: any[] =
        response.data?.data ||
        response.data?.results ||
        (Array.isArray(response.data) ? response.data : []);

      const data: Probe42SearchResult[] = rows.map((r: any) => ({
        cin: r.cin ?? r.company_cin ?? "",
        company_name: r.company_name ?? r.name ?? "",
        status: r.company_status ?? r.status ?? "unknown",
        company_type: r.company_type ?? r.company_category,
        roc_state: r.roc_state ?? r.roc_code,
        date_of_incorporation:
          r.date_of_incorporation ?? r.incorporation_date,
      }));

      this._log("PROBE42_SEARCH_SUCCESS", { query, count: data.length, latency_ms: Date.now() - t0 });
      return { success: true, data };
    } catch (err: any) {
      return this._handleError<Probe42SearchResponse>(err, "PROBE42_SEARCH_ERROR", { query, latency_ms: Date.now() - t0 });
    }
  }

  // ── Company profile ───────────────────────────────────────────────────────

  /**
   * Fetch full company profile by CIN.
   * Result is cached for 24 hours.
   */
  async getCompanyProfile(
    cin: string,
    forceRefresh = false,
  ): Promise<Probe42ProfileResponse> {
    if (!this.available) {
      return this._unavailable<Probe42ProfileResponse>();
    }

    const cacheKey = `probe42:profile:${cin}`;
    if (!forceRefresh) {
      const cached = await distributedCache.getJson<Probe42CompanyProfile>(cacheKey);
      if (cached) {
        this._log("PROBE42_PROFILE_CACHE_HIT", { cin });
        return { success: true, data: cached };
      }
    }

    const t0 = Date.now();
    try {
      const response = await this._withRetry(() =>
        this.client.get(`/company/${encodeURIComponent(cin)}`),
      );
      const d: any = response.data?.data ?? response.data;

      const profile: Probe42CompanyProfile = {
        cin: d.cin ?? cin,
        company_name: d.company_name ?? d.name ?? "",
        status: d.company_status ?? d.status ?? "unknown",
        company_type: d.company_type ?? d.company_category,
        roc_state: d.roc_state ?? d.roc_code,
        date_of_incorporation: d.date_of_incorporation ?? d.incorporation_date,
        registered_address: this._stringifyAddress(d.registered_address),
        authorized_capital: this._num(d.authorized_capital),
        paid_up_capital: this._num(d.paid_up_capital),
        sector: d.sector ?? d.industry_class,
        industry: d.industry ?? d.sub_industry,
        email: d.email ?? d.email_id,
        website: d.website ?? d.url,
      };

      await distributedCache.setJson(cacheKey, profile, CACHE_TTL_S);
      this._log("PROBE42_PROFILE_SUCCESS", { cin, latency_ms: Date.now() - t0 });
      return { success: true, data: profile };
    } catch (err: any) {
      return this._handleError<Probe42ProfileResponse>(err, "PROBE42_PROFILE_ERROR", { cin, latency_ms: Date.now() - t0 });
    }
  }

  // ── Directors ─────────────────────────────────────────────────────────────

  /**
   * Fetch directors for a company by CIN.
   *
   * The Probe42 director shape is normalised to the same `CredhiveDirector`
   * interface so `runDirectorContactPipeline()` works without modification.
   * Result is cached for 24 hours.
   *
   * @param cin  21-character Company Identification Number
   */
  async getDirectors(cin: string): Promise<Probe42DirectorsResponse> {
    if (!this.available) {
      return this._unavailable<Probe42DirectorsResponse>({ data: [] });
    }

    const cacheKey = `probe42:directors:${cin}`;
    const cached = await distributedCache.getJson<CredhiveDirector[]>(cacheKey);
    if (cached) {
      this._log("PROBE42_DIRECTORS_CACHE_HIT", { cin, count: cached.length });
      return { success: true, data: cached };
    }

    const t0 = Date.now();
    try {
      const response = await this._withRetry(() =>
        this.client.get(`/company/${encodeURIComponent(cin)}/directors`),
      );

      const rows: any[] =
        response.data?.data?.directors ??
        response.data?.directors ??
        response.data?.data ??
        (Array.isArray(response.data) ? response.data : []);

      // Normalise Probe42 fields → CredhiveDirector
      const directors: CredhiveDirector[] = rows.map((r: any) =>
        this._normaliseDirector(r),
      );

      await distributedCache.setJson(cacheKey, directors, CACHE_TTL_S);
      this._log("PROBE42_DIRECTORS_SUCCESS", { cin, count: directors.length, latency_ms: Date.now() - t0 });
      return { success: true, data: directors };
    } catch (err: any) {
      return this._handleError<Probe42DirectorsResponse>(err, "PROBE42_DIRECTORS_ERROR", { cin, latency_ms: Date.now() - t0 });
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Normalise a raw Probe42 director object to the `CredhiveDirector` shape.
   * Probe42 field names are mapped based on the documented API response.
   * Add additional field aliases here if the actual shape differs.
   */
  private _normaliseDirector(r: any): CredhiveDirector {
    // Probe42 uses various aliases — handle them all
    const din: string =
      r.din ?? r.director_din ?? r.dpin ?? "";
    const name: string =
      r.name ?? r.director_name ?? r.full_name ?? "";
    const designation: string =
      r.designation ?? r.director_designation ?? r.role ?? "Director";
    const mobile: string | undefined =
      r.mobile ?? r.phone ?? r.contact_number ?? r.director_mobile ?? undefined;
    const email: string | undefined =
      r.email ?? r.director_email ?? undefined;

    // Probe42 may use "cessation_date" or "date_of_cessation"
    const dateCessation: string | undefined =
      r.date_of_cessation ?? r.cessation_date ?? r.cessation ?? undefined;
    const dateAppointment: string | undefined =
      r.date_of_appointment ?? r.appointment_date ?? r.appointment ?? undefined;

    // Determine active status from Probe42's is_active flag or cessation date
    const isActive: boolean =
      typeof r.is_active === "boolean"
        ? r.is_active
        : typeof r.status === "string"
          ? r.status.toLowerCase() === "active"
          : !dateCessation; // fallback: has no cessation date → still active

    return {
      din,
      name,
      designation,
      date_of_appointment: dateAppointment,
      date_of_cessation: dateCessation,
      is_active: isActive,
      mobile,
      email,
      shareholding_percentage: this._num(
        r.shareholding_percentage ?? r.shareholding,
      ),
      is_promoter: r.is_promoter ?? r.promoter ?? false,
      executive_type: r.executive_type ?? r.director_type,
    };
  }

  /** Retry an axios call with exponential backoff — 3 max attempts */
  private async _withRetry<T>(
    fn: () => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const status: number = err?.response?.status ?? 0;
      // Do not retry on 4xx auth/not-found — only transient errors
      if (attempt >= RETRY_DELAYS_MS.length || (status >= 400 && status < 500)) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
      return this._withRetry(fn, attempt + 1);
    }
  }

  /** Return a graceful "unavailable" response when API key not configured */
  private _unavailable<T extends { success: boolean; error?: string; isApiKeyMissing?: boolean }>(
    extra?: Partial<T>,
  ): T {
    return { success: false, error: "PROBE42_API_KEY not configured", isApiKeyMissing: true, ...extra } as T;
  }

  /** Structured error handler — maps HTTP status to clean response */
  private _handleError<T extends { success: boolean; error?: string; isApiKeyMissing?: boolean }>(
    err: any,
    event: string,
    ctx: Record<string, unknown>,
  ): T {
    const status: number = err?.response?.status ?? 0;
    const isAuth = status === 401 || status === 403;
    const message: string = isAuth
      ? "Invalid PROBE42_API_KEY — check your credentials"
      : (err?.message ?? "Probe42 request failed");

    logger.error(event, {
      event,
      ...ctx,
      http_status: status || undefined,
      error_code: isAuth ? "PROBE42_AUTH_FAILED" : "PROBE42_REQUEST_FAILED",
      message,
      retryable: !isAuth,
      status: "error",
    });

    return { success: false, error: message, isApiKeyMissing: isAuth } as T;
  }

  private _log(event: string, ctx: Record<string, unknown>): void {
    logger.info(event, { event, ...ctx, status: "ok" });
  }

  private _num(v: any): number | undefined {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }

  private _stringifyAddress(addr: any): string | undefined {
    if (!addr) return undefined;
    if (typeof addr === "string") return addr;
    return [addr.address_line, addr.city, addr.state, addr.pincode]
      .filter(Boolean)
      .join(", ");
  }
}

// ── Singleton export ──────────────────────────────────────────────────────────

export const probe42Service = new Probe42Service();
