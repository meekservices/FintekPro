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

const toNseKey = (symbol: string): string => `NSE_EQ|${symbol.toUpperCase()}`;
const toBseKey = (symbol: string): string => `BSE_EQ|${symbol.toUpperCase()}`;

// ── Service Class ──────────────────────────────────────────────────────────────

class UpstoxMarketDataService {
  private client: AxiosInstance | null = null;
  private accessToken: string | null = null;

  /** Exponential backoff delays (ms): 400ms → 800ms → 1600ms */
  private readonly RETRY_DELAYS = [400, 800, 1600];

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
  }

  /** Returns true if UPSTOX_ACCESS_TOKEN is configured. */
  isReady(): boolean {
    return this.client !== null && this.accessToken !== null;
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

    const key = exchange === "BSE" ? toBseKey(symbol) : toNseKey(symbol);

    return this._withRetry<UpstoxQuote>(async () => {
      const res = await this.client!.get("/market-quote/ltp", {
        params: { instrument_key: key },
      });
      const raw = res.data?.data?.[key];
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
        data: this._mapLtp(symbol, exchange, raw),
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
      const keys = chunk.map((s) =>
        exchange === "BSE" ? toBseKey(s) : toNseKey(s)
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
      chunk.forEach((sym, idx) => {
        const q = raw[keys[idx]];
        if (q?.last_price) {
          resultMap.set(sym, this._mapFullQuote(sym, exchange, q));
        }
      });
    }

    return { success: true, data: resultMap, meta: this._meta(t0) };
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
      const raw = res.data?.data?.[INDEX_KEY];
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
    const prevClose = raw.ohlc?.close ? Number(raw.ohlc.close) : undefined;
    const change = prevClose !== undefined ? lastPrice - prevClose : undefined;
    const changePct =
      prevClose && prevClose > 0
        ? Math.round(((change! / prevClose) * 100) * 100) / 100
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
