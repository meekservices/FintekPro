/**
 * upstox-market-data-service.ts
 *
 * Upstox Market Data Service — Licensed NSE/BSE data provider for FintekPro.
 *
 * Purpose:
 *   Provides real-time and historical market data from Upstox Developer API v2.
 *   Upstox is a SEBI-registered broker with a licensed NSE/BSE data feed —
 *   legally clean for commercial use in a SEBI-regulated advisory platform.
 *
 * Auth Flow:
 *   Upstox uses OAuth2 Authorization Code flow for full trading access.
 *   For market data only (read-only), a long-lived Access Token from the
 *   Upstox Developer Portal is sufficient (no per-user OAuth required).
 *   Set UPSTOX_ACCESS_TOKEN in env vars — refresh it from the portal monthly.
 *
 * Key Endpoints Used:
 *   GET /market-quote/ltp           — Last Traded Price (batch, up to 500 symbols)
 *   GET /market-quote/quotes        — Full OHLCV quote (batch)
 *   GET /historical-candle/{symbol} — OHLCV historical data
 *
 * Symbol Format:
 *   NSE equity: "NSE_EQ|{SYMBOL}"  e.g. "NSE_EQ|RELIANCE"
 *   BSE equity: "BSE_EQ|{SYMBOL}"
 *   Index:      "NSE_INDEX|Nifty 50"
 *
 * Rate Limits (Upstox Developer API):
 *   - 1000 requests/minute
 *   - Batch: up to 500 instruments per call
 *
 * FASP-AI Compliance (FintekPro GCR v1.0):
 *   - Raw price data only — no AI forecasts or recommendations passed through
 *   - All outputs include data_source, timestamp, exchange, engine_version
 *   - Structured error format: { error_code, message, retryable }
 *
 * @module upstox-market-data-service
 * @version 1.0.0
 * @since Phase 6 — Licensed market data integration
 */

import axios, { type AxiosInstance } from "axios";
import { logger } from "../logger";
import { opsAlertService } from "./ops-alert-service";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface UpstoxQuote {
  symbol: string;
  exchange: "NSE" | "BSE";
  isin?: string;
  last_price: number;
  previous_close?: number;
  open_price?: number;
  high_price?: number;
  low_price?: number;
  close_price?: number;
  volume?: number;
  change?: number;
  change_percent?: number;
  timestamp: number;
  data_source: "UPSTOX";
  engine_version: string;
}

export interface UpstoxHistoricalCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface UpstoxServiceResult<T> {
  success: boolean;
  data?: T;
  error?: {
    error_code: string;
    message: string;
    retryable: boolean;
  };
  meta: {
    timestamp: string;
    version: string;
    source: "UPSTOX";
    latency_ms?: number;
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────

const UPSTOX_BASE_URL = "https://api.upstox.com/v2";
const ENGINE_VERSION = "upstox-market-data-service@1.0.0";

// Top NSE/BSE symbol to ISIN dictionary for instant resolution
export const SYMBOL_TO_ISIN: Record<string, string> = {
  RELIANCE: "INE002A01018",
  TCS: "INE467B01029",
  HDFCBANK: "INE040A01034",
  INFY: "INE009A01021",
  ICICIBANK: "INE090A01021",
  SBIN: "INE062A01020",
  BHARTIARTL: "INE397D01024",
  ITC: "INE154A01025",
  KOTAKBANK: "INE237A01036",
  LT: "INE018A01030",
  AXISBANK: "INE238A01034",
  HINDUNILVR: "INE030A01027",
  BAJFINANCE: "INE296A01024",
  MARUTI: "INE585B01010",
  TATAMOTORS: "INE155A01022",
  TATASTEEL: "INE081A01020",
  ASIANPAINT: "INE176A01028",
  TITAN: "INE280A01028",
  SUNPHARMA: "INE044A01036",
  WIPRO: "INE075A01022",
  NTPC: "INE733E01010",
  ONGC: "INE213A01029",
  POWERGRID: "INE752E01010",
  COALINDIA: "INE522F01014",
  HCLTECH: "INE860A01027",
  NESTLEIND: "INE239A01016",
  ULTRACEMCO: "INE481G01011",
  ADANIENT: "INE423A01024",
  JSWSTEEL: "INE019A01038",
  HINDALCO: "INE038A01020",
  CIPLA: "INE059A01026",
  DRREDDY: "INE089A01031",
  TRENT: "INE849A01020",
  BEL: "INE263A01024",
  BAJAJFINSV: "INE918I01018",
  TATAPOWER: "INE245A01021",
  SUZLON: "INE040H01021",
  JSWENERGY: "INE121E01018",
  NTPCGREEN: "INE0ONG01011",
  NHPC: "INE848E01016",
  IREDA: "INE202E01016",
  ACMESOLAR: "INE622W01025",
  SJVN: "INE002L01015",
  INDIGRID: "INE219X23014",
  INOXWIND: "INE066P01011",
  IW: "INE066P01011",
  HAL: "INE066F01020",
  MAZDOCK: "INE249Z01020",
  COCHINSHIP: "INE704P01025",
  BDL: "INE171Z01026",
  BEML: "INE258A01024",
  OLECTRA: "INE260D01016",
  JBMA: "INE927D01051",
  JBMMA: "INE927D01051",
  EXIDEIND: "INE302A01020",
  KPITTECH: "INE04I401011",
  MOTHERSON: "INE775A01035",
  SONACOMS: "INE073K01018",
  TIMKEN: "INE325A01013",
  THERMAX: "INE152A01029",
  WAAREEENER: "INE377N01017",
  WEL01: "INE377N01017",
  AIAENG: "INE212H01026",
  "GVT&D": "INE200A01026",
  GEC: "INE200A01026",
  CUMMINSIND: "INE298A01020",
  KEI: "INE878B01027",
  ZOMATO: "INE758T01015",
  PAYTM: "INE982J01020",
  SWIGGY: "INE00H001014",
  DIXON: "INE935N01020",
  INDUSINDBK: "INE095A01012",
  WABAG: "INE956G01038",
  VAML: "INE956G01038",
  "BAJAJ-AUTO": "INE917I01010",
  // Top candidates & market movers
  AMBUJACEM: "INE079A01024",
  MANKIND: "INE634S01028",
  PFC: "INE134E01011",
  RECLTD: "INE020B01018",
  CHOLAFIN: "INE121A01024",
  HINDPETRO: "INE094A01015",
  ERIS: "INE406M01024",
  LICI: "INE0J1Y01017",
  VEDL: "INE205A01025",
  INDIGO: "INE646L01027",
  DLF: "INE271C01023",
  JIOFIN: "INE758E01017",
  TATACONSUM: "INE192A01025",
  SHREECEM: "INE070A01015",
  ACCCEM: "INE012A01025",
  ACC: "INE012A01025",
  BAJAJHLDNG: "INE118A01012",
  BPCL: "INE029A01011",
  IOC: "INE242A01010",
  GAIL: "INE129A01019",
  DIVISLAB: "INE361B01024",
  APOLLOHOSP: "INE437A01024",
  EICHERMOT: "INE066A01021",
  GRASIM: "INE047A01021",
  HEROMOTOCO: "INE158A01026",
  HINDZINC: "INE267A01025",
  PIDILITIND: "INE318A01026",
  SIEMENS: "INE003A01024",
  ABB: "INE117A01022",
  POLYCAB: "INE455K01017",
  PERSISTENT: "INE262H01013",
  COFORGE: "INE591G01017",
  MPHASIS: "INE356A01018",
  LTIM: "INE214T01019",
  TATACOMM: "INE151A01013",
  IRFC: "INE053F01010",
  RVNL: "INE415G01027",
  IRCTC: "INE335Y01020",
  CONCOR: "INE111A01025",
  BOSCHLTD: "INE323A01026",
  TVSMOTOR: "INE494B01023",
  ASHOKLEY: "INE214A01028",
  BHARATFORG: "INE465A01025",
  ASTRAL: "INE006I01046",
  SUPREMEIND: "INE578A01017",
  VOLTAS: "INE226A01021",
  BLUESTARCO: "INE472A01039",
  HAVELLS: "INE176B01034",
  CROMPTON: "INE299U01018",
  KALYANKJIL: "INE303R01014",
  MUTHOOTFIN: "INE414G01012",
  MANAPPURAM: "INE522D01027",
  FEDERALBNK: "INE171A01029",
  IDFCFIRSTB: "INE092T01019",
  PNB: "INE160A01022",
  BANKBARODA: "INE077A01032",
  CANBK: "INE476A01022",
  UNIONBANK: "INE692A01016",
  IOB: "INE565A01014",
  INDIANB: "INE562A01011",
  MAXHEALTH: "INE027H01010",
  FORTIS: "INE061F01013",
  MEDANTA: "INE474Q01031",
  LUPIN: "INE326A01037",
  AUROPHARMA: "INE406A01037",
  BIOCON: "INE376G01013",
  ALKEM: "INE540L01014",
  TORNTPHARM: "INE685A01028",
  GLENMARK: "INE936A01020",
  IPCALAB: "INE571A01038",
  NATCOPHARM: "INE987B01026",
  AJANTPHARM: "INE031B01049",
  JBCHEPHARM: "INE572A01036",
  GRANULES: "INE101A01026",
  LAURUSLABS: "INE947Q01028",
  SYNGENE: "INE398R01022",
  EMBASSY: "INE041025011",
  MINDSPACE: "INE0CCU25019",
  BIRET: "INE0E1925017",
  PGINVIT: "INE0G2723012",
};

export const toNseKey = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.startsWith("NSE_") || upper.startsWith("BSE_")) return upper;
  if (/^IN[A-Z0-9]{10}$/.test(upper)) return `NSE_EQ|${upper}`;
  const isin = SYMBOL_TO_ISIN[upper] || upper;
  return `NSE_EQ|${isin}`;
};

export const toBseKey = (symbol: string): string => {
  const upper = symbol.toUpperCase();
  if (upper.startsWith("NSE_") || upper.startsWith("BSE_")) return upper;
  if (/^IN[A-Z0-9]{10}$/.test(upper)) return `BSE_EQ|${upper}`;
  const isin = SYMBOL_TO_ISIN[upper] || upper;
  return `BSE_EQ|${isin}`;
};

// ── Service Class ──────────────────────────────────────────────────────────────

class UpstoxMarketDataService {
  private client: AxiosInstance | null = null;
  private accessToken: string | null = null;

  /** Tracks the first moment an AUTH_EXPIRED error was detected this process lifetime. */
  private tokenExpiredAt: number | null = null;

  /** Exponential backoff delays (ms): 400ms → 800ms → 1600ms */
  private readonly RETRY_DELAYS = [400, 800, 1600];

  /**
   * Days until token needs rotation.
   * Upstox tokens are valid for ~1 year. We warn at 30 days before expiry.
   */
  private static readonly TOKEN_LIFETIME_DAYS = 365;
  private static readonly TOKEN_WARN_DAYS_BEFORE = 30;

  constructor() {
    this.init();
  }

  private init(): void {
    const token = process.env.UPSTOX_ACCESS_TOKEN;
    if (!token) {
      logger.warn("[Upstox] UPSTOX_ACCESS_TOKEN not set — service inactive.", {
        event: "UPSTOX_SERVICE_INACTIVE",
        status: "SKIPPED",
        message: "Set UPSTOX_ACCESS_TOKEN via: https://account.upstox.com/developer/apps",
      });
      return;
    }
    this.accessToken = token;
    this.client = axios.create({
      baseURL: UPSTOX_BASE_URL,
      timeout: 10_000,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Api-Version": "2.0",
      },
    });
    logger.info("[Upstox] Market Data Service initialized", {
      event: "UPSTOX_SERVICE_READY",
      status: "SUCCESS",
    });

    // ── Proactive yearly-rotation warning ──────────────────────────────────
    // UPSTOX_TOKEN_ISSUED_AT lets us compute days-since-issued and warn 30
    // days before the 1-year mark. Set it when rotating the token.
    const issuedAtStr = process.env.UPSTOX_TOKEN_ISSUED_AT;
    if (issuedAtStr) {
      const issuedAt = new Date(issuedAtStr);
      if (!Number.isNaN(issuedAt.getTime())) {
        const daysSince = (Date.now() - issuedAt.getTime()) / 86_400_000;
        const daysRemaining =
          UpstoxMarketDataService.TOKEN_LIFETIME_DAYS - daysSince;
        const warnThreshold =
          UpstoxMarketDataService.TOKEN_LIFETIME_DAYS -
          UpstoxMarketDataService.TOKEN_WARN_DAYS_BEFORE;

        logger.info("[Upstox] Token age check", {
          event: "UPSTOX_TOKEN_AGE_CHECK",
          issued_at: issuedAtStr,
          days_since_issued: Math.round(daysSince),
          days_remaining: Math.round(daysRemaining),
        });

        if (daysSince > warnThreshold) {
          const expiryDate = new Date(
            issuedAt.getTime() +
              UpstoxMarketDataService.TOKEN_LIFETIME_DAYS * 86_400_000,
          ).toDateString();
          // Non-blocking — fire and forget
          opsAlertService
            .fire({
              code: "UPSTOX_TOKEN_EXPIRY_WARNING",
              severity: "WARNING",
              title: `⚠️ Upstox Token Expires in ~${Math.ceil(daysRemaining)} Days`,
              message:
                `Token issued ${Math.round(daysSince)} days ago. ` +
                `Estimated expiry: ${expiryDate}. ` +
                `Rotate before expiry to avoid pricing degradation.`,
              action:
                "gcloud run services update fintekpro-app " +
                "--region=asia-south1 " +
                '--update-env-vars="UPSTOX_ACCESS_TOKEN=<new_token>,UPSTOX_TOKEN_ISSUED_AT=<today_iso>"',
            })
            .catch(() => {/* webhook failure already logged inside opsAlertService */});
        }
      } else {
        logger.warn("[Upstox] UPSTOX_TOKEN_ISSUED_AT is not a valid ISO date — token age check skipped", {
          event: "UPSTOX_TOKEN_ISSUED_AT_INVALID",
          value: issuedAtStr,
        });
      }
    }
  }

  /** Returns true if UPSTOX_ACCESS_TOKEN is configured. */
  isReady(): boolean {
    return this.client !== null && this.accessToken !== null;
  }

  /**
   * Hot-reload the service with a new token (in-process, no restart required).
   * Called by the admin token-rotation endpoint after updating the secret.
   *
   * @param newToken  The new Upstox access token
   * @param issuedAt  ISO date string YYYY-MM-DD for the token issue date
   */
  hotReload(newToken: string, issuedAt: string): void {
    process.env.UPSTOX_ACCESS_TOKEN = newToken;
    process.env.UPSTOX_TOKEN_ISSUED_AT = issuedAt;
    this.tokenExpiredAt = null; // clear any existing expiry flag
    this.client = null;
    this.accessToken = null;
    this.init();
    logger.info("[Upstox] Service hot-reloaded with new token", {
      event: "UPSTOX_TOKEN_HOT_RELOAD",
      issued_at: issuedAt,
      status: "SUCCESS",
    });
  }

  /**
   * Probe the token with a canary getLTP call for RELIANCE.
   * Used by eodPricingHealthCheck() at startup.
   *
   * @returns "ok" | "expired" | "inactive"
   */
  async probeToken(): Promise<"ok" | "expired" | "inactive"> {
    if (!this.isReady()) return "inactive";
    try {
      const r = await this.getLTP("RELIANCE", "NSE");
      if (r.error?.error_code === "AUTH_EXPIRED") return "expired";
      return r.success ? "ok" : "inactive";
    } catch {
      return "inactive";
    }
  }

  /**
   * Returns token health metadata for observability.
   */
  getTokenHealth(): {
    configured: boolean;
    expiredSince: string | null;
    daysSinceIssued: number | null;
  } {
    const issuedAtStr = process.env.UPSTOX_TOKEN_ISSUED_AT;
    let daysSinceIssued: number | null = null;
    if (issuedAtStr) {
      const issuedAt = new Date(issuedAtStr);
      if (!Number.isNaN(issuedAt.getTime())) {
        daysSinceIssued = Math.round((Date.now() - issuedAt.getTime()) / 86_400_000);
      }
    }
    return {
      configured: this.isReady(),
      expiredSince: this.tokenExpiredAt
        ? new Date(this.tokenExpiredAt).toISOString()
        : null,
      daysSinceIssued,
    };
  }

  /**
   * Resolves a symbol or ISIN to its canonical Upstox instrument key.
   * If the symbol is not in memory, performs a fast DB lookup against listed_stocks.
   */
  async resolveInstrumentKey(
    symbolOrIsin: string,
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<string> {
    const upper = symbolOrIsin.toUpperCase();
    if (upper.startsWith("NSE_") || upper.startsWith("BSE_")) return upper;
    if (/^IN[A-Z0-9]{10}$/.test(upper)) return `${exchange}_EQ|${upper}`;
    if (SYMBOL_TO_ISIN[upper]) return `${exchange}_EQ|${SYMBOL_TO_ISIN[upper]}`;

    // Lazy load from DB if not yet cached
    try {
      const { db } = await import("../db");
      const { listedStocks } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [stock] = await db
        .select({ isin: listedStocks.isin })
        .from(listedStocks)
        .where(eq(listedStocks.symbol, upper))
        .limit(1);
      if (stock?.isin) {
        SYMBOL_TO_ISIN[upper] = stock.isin;
        return `${exchange}_EQ|${stock.isin}`;
      }
    } catch {
      // Non-fatal fallback
    }

    // Dynamic Upstox Instrument Search resolution
    if (this.client) {
      try {
        const searchRes = await this.client.get("/instruments/search", {
          params: { query: upper, exchange },
        });
        const items = searchRes.data?.data || [];
        const match = items.find(
          (d: any) =>
            d.trading_symbol?.toUpperCase() === upper &&
            (d.segment === `${exchange}_EQ` || d.segment === `${exchange}_INDEX`)
        );
        if (match?.isin) {
          SYMBOL_TO_ISIN[upper] = match.isin;
          return `${exchange}_EQ|${match.isin}`;
        }
        if (match?.instrument_key) {
          return match.instrument_key;
        }
      } catch {
        // dynamic search failed, proceed to fallback
      }
    }

    return `${exchange}_EQ|${upper}`;
  }

  // ── Single LTP ─────────────────────────────────────────────────────────────

  /**
   * Get Last Traded Price for a single symbol.
   *
   * @param symbol   NSE/BSE ticker e.g. "RELIANCE"
   * @param exchange "NSE" (default) or "BSE"
   *
   * Edge cases:
   *   - Returns error if UPSTOX_ACCESS_TOKEN not set
   *   - 429: retryable=true, exponential backoff applied automatically
   *   - 401: retryable=false, caller must rotate UPSTOX_ACCESS_TOKEN
   */
  async getLTP(
    symbol: string,
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<UpstoxServiceResult<UpstoxQuote>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<UpstoxQuote>();

    let key = await this.resolveInstrumentKey(symbol, exchange);

    return this._withRetry<UpstoxQuote>(async () => {
      let res = await this.client!.get("/market-quote/ltp", {
        params: { instrument_key: key },
      });
      let dataObj = (res.data?.data ?? {}) as Record<string, any>;
      let raw =
        dataObj[key] ??
        dataObj[`${exchange}_EQ:${symbol.toUpperCase()}`] ??
        dataObj[`${exchange}_EQ|${symbol.toUpperCase()}`] ??
        Object.values(dataObj)[0];

      // Self-healing: if initial key yielded no last_price and wasn't dynamically verified, search Upstox instruments
      if (!raw?.last_price && !symbol.toUpperCase().startsWith("IN")) {
        try {
          const searchRes = await this.client!.get("/instruments/search", {
            params: { query: symbol.toUpperCase(), exchange },
          });
          const items = searchRes.data?.data || [];
          const match = items.find(
            (d: any) =>
              d.trading_symbol?.toUpperCase() === symbol.toUpperCase() &&
              d.segment === `${exchange}_EQ`
          );
          if (match?.isin && `${exchange}_EQ|${match.isin}` !== key) {
            key = `${exchange}_EQ|${match.isin}`;
            SYMBOL_TO_ISIN[symbol.toUpperCase()] = match.isin;
            res = await this.client!.get("/market-quote/ltp", {
              params: { instrument_key: key },
            });
            dataObj = (res.data?.data ?? {}) as Record<string, any>;
            raw = dataObj[key] ?? Object.values(dataObj)[0];
          }
        } catch { /* proceed */ }
      }

      if (!raw?.last_price) {
        return {
          success: false,
          error: {
            error_code: "NO_DATA",
            message: `No LTP data for ${symbol} on ${exchange}`,
            retryable: false,
          },
          meta: this._meta(t0),
        };
      }
      return {
        success: true,
        data: this._mapLtp(raw.symbol ?? symbol, exchange, raw),
        meta: this._meta(t0),
      };
    }, t0);
  }

  // ── Batch Quotes (up to 500 symbols) ───────────────────────────────────────

  /**
   * Get full OHLCV quotes for multiple symbols in one request.
   * Automatically chunks into batches of 500 if needed.
   *
   * @param symbols  Array of tickers e.g. ["RELIANCE", "TCS", "HDFCBANK"]
   * @param exchange "NSE" (default) or "BSE"
   */
  async getBatchQuotes(
    symbols: string[],
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<UpstoxServiceResult<Map<string, UpstoxQuote>>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<Map<string, UpstoxQuote>>();

    const resultMap = new Map<string, UpstoxQuote>();

    // Chunk into batches of 500 (Upstox limit)
    for (let i = 0; i < symbols.length; i += 500) {
      const chunk = symbols.slice(i, i + 500);
      const keys = await Promise.all(
        chunk.map((s) => this.resolveInstrumentKey(s, exchange))
      );

      const chunkResult = await this._withRetry<Record<string, unknown>>(async () => {
        const res = await this.client!.get("/market-quote/quotes", {
          params: { instrument_key: keys.join(",") },
        });
        return {
          success: true,
          data: res.data?.data ?? {},
          meta: this._meta(t0),
        };
      }, t0);

      if (!chunkResult.success) {
        logger.warn("[Upstox] Batch chunk failed", {
          event: "UPSTOX_BATCH_CHUNK_FAILED",
          status: "FAILURE",
          message: chunkResult.error?.message,
          error_code: chunkResult.error?.error_code,
          retryable: chunkResult.error?.retryable ?? false,
        });
        continue;
      }

      const raw = (chunkResult.data ?? {}) as Record<string, any>;
      // Map both by exact key and by returned symbol (e.g. NSE_EQ:RELIANCE -> RELIANCE)
      for (const [resKey, quoteObj] of Object.entries(raw)) {
        const q = quoteObj as any;
        const sym = q?.symbol || resKey.split(":")[1] || resKey.split("|")[1];
        if (sym && q?.last_price) {
          const mapped = this._mapFullQuote(sym, exchange, q);
          resultMap.set(sym.toUpperCase(), mapped);
          if (q.instrument_token) {
            const tokenIsin = q.instrument_token.split("|")[1];
            if (tokenIsin) resultMap.set(tokenIsin.toUpperCase(), mapped);
          }
          const tokenKey = resKey.split("|")[1] || resKey.split(":")[1];
          if (tokenKey) resultMap.set(tokenKey.toUpperCase(), mapped);
        }
      }

      // Ensure all requested chunk symbols have an entry if their mapped ISIN was resolved
      for (const reqSym of chunk) {
        const upper = reqSym.toUpperCase();
        if (!resultMap.has(upper)) {
          const mappedIsin = SYMBOL_TO_ISIN[upper];
          if (mappedIsin && resultMap.has(mappedIsin)) {
            resultMap.set(upper, resultMap.get(mappedIsin)!);
          }
        }
      }
    }

    return { success: true, data: resultMap, meta: this._meta(t0) };
  }

  /**
   * Get full OHLC quote (open, high, low, close, volume) for a single ticker or ISIN.
   */
  async getFullQuote(
    symbolOrIsin: string,
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<UpstoxServiceResult<UpstoxQuote>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<UpstoxQuote>();

    const key = await this.resolveInstrumentKey(symbolOrIsin, exchange);

    return this._withRetry<UpstoxQuote>(async () => {
      const res = await this.client!.get("/market-quote/quotes", {
        params: { instrument_key: key },
      });
      const dataObj = (res.data?.data ?? {}) as Record<string, any>;
      const raw =
        dataObj[key] ??
        dataObj[`${exchange}_EQ:${symbolOrIsin.toUpperCase()}`] ??
        dataObj[`${exchange}_EQ|${symbolOrIsin.toUpperCase()}`] ??
        Object.values(dataObj)[0];

      if (!raw || (!raw.last_price && !raw.ohlc?.close)) {
        // Fallback to getLTP if quotes endpoint had no match
        return this.getLTP(symbolOrIsin, exchange);
      }
      return {
        success: true,
        data: this._mapFullQuote(raw.symbol ?? symbolOrIsin, exchange, raw),
        meta: this._meta(t0),
      };
    }, t0);
  }

  /**
   * Quote endpoint providing LTP along with full dayHigh, dayLow and OHLC metrics.
   */
  async getQuote(
    symbol: string,
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<UpstoxServiceResult<UpstoxQuote>> {
    return this.getFullQuote(symbol, exchange);
  }

  // ── Historical OHLCV ───────────────────────────────────────────────────────

  /**
   * Get historical OHLCV candles for a symbol.
   *
   * @param symbol    NSE ticker e.g. "RELIANCE"
   * @param interval  "1minute" | "30minute" | "day" | "week" | "month"
   * @param fromDate  "YYYY-MM-DD"
   * @param toDate    "YYYY-MM-DD"
   * @param exchange  "NSE" (default) or "BSE"
   */
  async getHistoricalData(
    symbol: string,
    interval: "1minute" | "30minute" | "day" | "week" | "month",
    fromDate: string,
    toDate: string,
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<UpstoxServiceResult<UpstoxHistoricalCandle[]>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<UpstoxHistoricalCandle[]>();

    const key = exchange === "BSE" ? toBseKey(symbol) : toNseKey(symbol);
    const encodedKey = encodeURIComponent(key);

    return this._withRetry<UpstoxHistoricalCandle[]>(async () => {
      const res = await this.client!.get(
        `/historical-candle/${encodedKey}/${interval}/${toDate}/${fromDate}`
      );
      const candles = res.data?.data?.candles;
      if (!Array.isArray(candles)) {
        return {
          success: false,
          error: {
            error_code: "NO_CANDLES",
            message: `No historical data for ${symbol} (${fromDate} to ${toDate})`,
            retryable: false,
          },
          meta: this._meta(t0),
        };
      }
      return {
        success: true,
        data: candles.map(([ts, open, high, low, close, volume]: any[]) => ({
          timestamp: String(ts),
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
        })),
        meta: this._meta(t0),
      };
    }, t0);
  }

  // ── Nifty 50 / Sensex Index ────────────────────────────────────────────────

  /**
   * Get Nifty 50 index LTP — market benchmark for portfolio analytics.
   * Used in portfolio-risk-guard.ts for market regime detection.
   */
  async getNiftyLTP(): Promise<UpstoxServiceResult<UpstoxQuote>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<UpstoxQuote>();

    const INDEX_KEY = "NSE_INDEX|Nifty 50";
    return this._withRetry<UpstoxQuote>(async () => {
      const res = await this.client!.get("/market-quote/ltp", {
        params: { instrument_key: INDEX_KEY },
      });
      const dataObj = (res.data?.data ?? {}) as Record<string, any>;
      const raw = dataObj[INDEX_KEY] ?? dataObj["NSE_INDEX:Nifty 50"] ?? Object.values(dataObj)[0];
      if (!raw?.last_price) {
        return {
          success: false,
          error: {
            error_code: "NO_INDEX_DATA",
            message: "Nifty 50 LTP unavailable",
            retryable: true,
          },
          meta: this._meta(t0),
        };
      }
      return {
        success: true,
        data: {
          symbol: "NIFTY50",
          exchange: "NSE",
          last_price: Number(raw.last_price),
          previous_close: raw.ohlc?.close ? Number(raw.ohlc.close) : undefined,
          timestamp: Date.now(),
          data_source: "UPSTOX",
          engine_version: ENGINE_VERSION,
        },
        meta: this._meta(t0),
      };
    }, t0);
  }

  /**
   * Get all major Indian market benchmark indices in a single fast call (Nifty 50, Nifty Bank, Sensex).
   */
  async getMajorIndices(): Promise<UpstoxServiceResult<Record<string, UpstoxQuote>>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<Record<string, UpstoxQuote>>();

    const keys = "NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX";
    return this._withRetry<Record<string, UpstoxQuote>>(async () => {
      const res = await this.client!.get("/market-quote/ltp", {
        params: { instrument_key: keys },
      });
      const dataObj = (res.data?.data ?? {}) as Record<string, any>;
      const result: Record<string, UpstoxQuote> = {};

      const mapIndex = (key: string, symbol: string, exchange: "NSE" | "BSE") => {
        const raw =
          dataObj[key] ??
          Object.values(dataObj).find(
            (v: any) => v?.instrument_token === key || v?.symbol === symbol
          );
        if (raw?.last_price) {
          result[symbol] = {
            symbol,
            exchange,
            last_price: Number(raw.last_price),
            previous_close: raw.ohlc?.close ? Number(raw.ohlc.close) : undefined,
            timestamp: Date.now(),
            data_source: "UPSTOX",
            engine_version: ENGINE_VERSION,
          };
        }
      };

      mapIndex("NSE_INDEX|Nifty 50", "NIFTY50", "NSE");
      mapIndex("NSE_INDEX|Nifty Bank", "BANKNIFTY", "NSE");
      mapIndex("BSE_INDEX|SENSEX", "SENSEX", "BSE");

      return {
        success: true,
        data: result,
        meta: this._meta(t0),
      };
    }, t0);
  }

  // ── IPO (Initial Public Offering) ──────────────────────────────────────────

  /**
   * List publicly available IPOs on NSE/BSE via Upstox API v2.
   *
   * @param status 'open' | 'upcoming' | 'closed' | 'listed' (default: 'open')
   * @param issue_type 'regular' | 'sme' (optional)
   */
  async getIPOs(
    status: "open" | "upcoming" | "closed" | "listed" = "open",
    issue_type?: "regular" | "sme"
  ): Promise<UpstoxServiceResult<any[]>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<any[]>();

    return this._withRetry<any[]>(async () => {
      const res = await this.client!.get("/ipos", {
        params: { status, ...(issue_type ? { issue_type } : {}) },
      });
      return {
        success: true,
        data: res.data?.data ?? [],
        meta: this._meta(t0),
      };
    }, t0);
  }

  /**
   * Fetch full public details of a single IPO by ID/slug from Upstox.
   */
  async getIPODetails(ipoId: string): Promise<UpstoxServiceResult<any>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<any>();

    return this._withRetry<any>(async () => {
      const res = await this.client!.get(`/ipos/${encodeURIComponent(ipoId)}`);
      return {
        success: true,
        data: res.data?.data,
        meta: this._meta(t0),
      };
    }, t0);
  }

  /**
   * Apply / Submit an IPO Bid application order through Upstox UPI ASBA.
   *
   * @param params.ipo_id Upstox IPO ID slug (e.g. 'bombay-coated-and-special-steels-limited-ipo')
   * @param params.upi_id Investor's UPI ID (e.g. 'name@okhdfcbank')
   * @param params.bids Array of quantity, price, cut_off
   */
  async applyIPO(params: {
    ipo_id: string;
    upi_id: string;
    bids: Array<{
      quantity: number;
      price?: number;
      cut_off?: boolean;
    }>;
    terms_and_conditions_consent?: boolean;
  }): Promise<UpstoxServiceResult<any>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<any>();

    return this._withRetry<any>(async () => {
      const payload = {
        ipo_id: params.ipo_id,
        upi_id: params.upi_id,
        bids: params.bids.map((b) => ({
          quantity: b.quantity,
          price: b.cut_off ? undefined : b.price,
          cut_off: Boolean(b.cut_off),
        })),
        terms_and_conditions_consent: params.terms_and_conditions_consent !== false,
      };

      logger.info("[Upstox] Submitting IPO application order", {
        event: "UPSTOX_IPO_APPLY_SUBMITTED",
        ipo_id: params.ipo_id,
        upi_id_masked: params.upi_id.replace(/^(.{2})(.*)(@.*)$/, "$1***$3"),
        bid_count: params.bids.length,
      });

      const res = await this.client!.post("/ipos/apply", payload);
      return {
        success: true,
        data: res.data?.data,
        meta: this._meta(t0),
      };
    }, t0);
  }

  /**
   * Fetch authenticated user's submitted IPO application orders.
   */
  async getIPOOrders(page_number = 1, records = 20): Promise<UpstoxServiceResult<any[]>> {
    const t0 = Date.now();
    if (!this.isReady()) return this._inactive<any[]>();

    return this._withRetry<any[]>(async () => {
      const res = await this.client!.get("/ipos/orders", {
        params: { page_number, records },
      });
      return {
        success: true,
        data: res.data?.data ?? [],
        meta: this._meta(t0),
      };
    }, t0);
  }

  // ── Private Helpers ────────────────────────────────────────────────────────

  private _mapLtp(
    symbol: string,
    exchange: "NSE" | "BSE",
    raw: any
  ): UpstoxQuote {
    return {
      symbol,
      exchange,
      last_price: Number(raw.last_price),
      previous_close: raw.ohlc?.close ? Number(raw.ohlc.close) : undefined,
      open_price: raw.ohlc?.open ? Number(raw.ohlc.open) : undefined,
      high_price: raw.ohlc?.high ? Number(raw.ohlc.high) : undefined,
      low_price: raw.ohlc?.low ? Number(raw.ohlc.low) : undefined,
      timestamp: Date.now(),
      data_source: "UPSTOX",
      engine_version: ENGINE_VERSION,
    };
  }

  private _mapFullQuote(
    symbol: string,
    exchange: "NSE" | "BSE",
    raw: any
  ): UpstoxQuote {
    const lastPrice = Number(raw.last_price ?? 0);
    // In Upstox v2 API, raw.net_change provides the exact daily net change.
    // If raw.net_change is available, prevClose = lastPrice - net_change.
    let change: number | undefined = undefined;
    let prevClose: number | undefined = undefined;

    if (raw.net_change !== undefined && raw.net_change !== null) {
      change = Number(raw.net_change);
      prevClose = lastPrice - change;
    } else if (raw.ohlc?.close) {
      prevClose = Number(raw.ohlc.close);
      change = lastPrice - prevClose;
    }

    const changePct =
      prevClose && prevClose > 0 && change !== undefined
        ? Math.round(((change / prevClose) * 100) * 100) / 100
        : undefined;

    return {
      symbol,
      exchange,
      isin: raw.instrument_token,
      last_price: lastPrice,
      previous_close: prevClose,
      open_price: raw.ohlc?.open ? Number(raw.ohlc.open) : undefined,
      high_price: raw.ohlc?.high ? Number(raw.ohlc.high) : undefined,
      low_price: raw.ohlc?.low ? Number(raw.ohlc.low) : undefined,
      close_price: prevClose,
      volume: raw.volume ? Number(raw.volume) : undefined,
      change,
      change_percent: changePct,
      timestamp: Date.now(),
      data_source: "UPSTOX",
      engine_version: ENGINE_VERSION,
    };
  }

  /**
   * Retry wrapper: up to 3 retries with exponential backoff.
   * Retries on: 429 (rate limit) and 5xx (transient server errors).
   * Does NOT retry on 401 (auth) or 400 (bad request).
   */
  private async _withRetry<T>(
    fn: () => Promise<UpstoxServiceResult<T>>,
    t0: number,
    attempt = 0
  ): Promise<UpstoxServiceResult<T>> {
    try {
      return await fn();
    } catch (err: any) {
      const status: number | undefined = err?.response?.status;
      const isRateLimit = status === 429;
      const isTransient = isRateLimit || (status !== undefined && status >= 500 && status < 600);
      const isAuthError = status === 401;

      if (isAuthError) {
        logger.error("[Upstox] 401 Unauthorized — UPSTOX_ACCESS_TOKEN expired", {
          event: "UPSTOX_AUTH_EXPIRED",
          status: "FAILURE",
          error_code: "AUTH_EXPIRED",
          message: "Rotate UPSTOX_ACCESS_TOKEN at https://account.upstox.com/developer/apps",
          retryable: false,
          latency_ms: Date.now() - t0,
        });

        // Fire CRITICAL ops alert once per process lifetime (dedup prevents storms).
        if (!this.tokenExpiredAt) {
          this.tokenExpiredAt = Date.now();
          opsAlertService
            .fire({
              code: "UPSTOX_TOKEN_EXPIRED",
              severity: "CRITICAL",
              title: "🚨 Upstox Access Token EXPIRED — Pricing Degraded to Tier 1",
              message:
                "Live stock pricing has fallen back to IndianAPI (Tier 1) or Yahoo (Tier 2). " +
                "SEBI-grade Upstox data is unavailable until the token is rotated.",
              action:
                "gcloud run services update fintekpro-app " +
                "--region=asia-south1 " +
                '--update-env-vars="UPSTOX_ACCESS_TOKEN=<new_token>,UPSTOX_TOKEN_ISSUED_AT=<today_iso>"',
            })
            .catch(() => {/* webhook failure already logged inside opsAlertService */});
        }

        return {
          success: false,
          error: {
            error_code: "AUTH_EXPIRED",
            message: "Upstox access token expired — rotate UPSTOX_ACCESS_TOKEN",
            retryable: false,
          },
          meta: this._meta(t0),
        };
      }

      if (isTransient && attempt < this.RETRY_DELAYS.length) {
        const delay = this.RETRY_DELAYS[attempt];
        logger.warn("[Upstox] Transient error — retrying with backoff", {
          event: "UPSTOX_RETRY",
          status: "PENDING",
          http_status: status,
          attempt: attempt + 1,
          max_attempts: this.RETRY_DELAYS.length,
          backoff_ms: delay,
          retryable: true,
        });
        await new Promise((r) => setTimeout(r, delay));
        return this._withRetry<T>(fn, t0, attempt + 1);
      }

      logger.error("[Upstox] Request failed", {
        event: "UPSTOX_REQUEST_FAILED",
        status: "FAILURE",
        error_code: `HTTP_${status ?? "UNKNOWN"}`,
        message: err?.message,
        http_status: status,
        retryable: isTransient,
        latency_ms: Date.now() - t0,
      });
      return {
        success: false,
        error: {
          error_code: `HTTP_${status ?? "UNKNOWN"}`,
          message:
            err?.response?.data?.errors?.[0]?.message ??
            err?.message ??
            "Unknown Upstox API error",
          retryable: isTransient,
        },
        meta: this._meta(t0),
      };
    }
  }

  private _inactive<T>(): UpstoxServiceResult<T> {
    return {
      success: false,
      error: {
        error_code: "SERVICE_INACTIVE",
        message:
          "UPSTOX_ACCESS_TOKEN not configured. Set it via: " +
          "gcloud run services update fintekpro-app --update-env-vars UPSTOX_ACCESS_TOKEN=<token>",
        retryable: false,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        source: "UPSTOX",
      },
    };
  }

  private _meta(t0: number) {
    return {
      timestamp: new Date().toISOString(),
      version: ENGINE_VERSION,
      source: "UPSTOX" as const,
      latency_ms: Date.now() - t0,
    };
  }
}

// ── Singleton Export ───────────────────────────────────────────────────────────

export const upstoxMarketDataService = new UpstoxMarketDataService();
