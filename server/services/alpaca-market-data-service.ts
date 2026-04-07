/**
 * Market Data Service — Alpaca Data API
 * ──────────────────────────────────────
 * Primary  : data.alpaca.markets/v2  (Broker API Basic auth — KEY:SECRET)
 * Fallback : Yahoo Finance            (when Alpaca credentials absent or fail)
 * FX       : ExchangeRate-API → open.er-api.com
 *
 * Broker API keys (ALPACA_API_KEY / ALPACA_SECRET_KEY) authenticate against
 * BOTH broker-api.*.alpaca.markets AND data.alpaca.markets via HTTP Basic auth
 * (Authorization: Basic base64(KEY:SECRET)).  The Standard plan (included with
 * every Broker API integration) gives 1,000 RPM and unlimited symbol streaming.
 *
 * Feed selection:
 *   Sandbox keys → "iex"   (Investors Exchange — free tier)
 *   Live keys    → "sip"   (all US exchanges — full SIP feed)
 *
 * Public interface is identical to the previous Yahoo Finance version so all
 * existing callers continue to work without changes.
 */

import axios from "axios";
import { logger } from "../logger";
import { guardedExecution, validateStockPrice, validateChangePercent } from "./guarded-execution";

// ─── Endpoints ─────────────────────────────────────────────────────────────────

const ALPACA_DATA_URL          = "https://data.alpaca.markets/v2";
const ALPACA_BROKER_SANDBOX    = "https://broker-api.sandbox.alpaca.markets";
const ALPACA_BROKER_LIVE       = "https://broker-api.alpaca.markets";
const YF_BASE                  = "https://query1.finance.yahoo.com";
const YF_HDRS                  = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

// ─── Cache TTLs ────────────────────────────────────────────────────────────────

const QUOTE_CACHE_TTL    = 30_000;       // 30 s  — live quotes
const SNAPSHOT_CACHE_TTL = 30_000;       // 30 s  — full snapshots
const FX_CACHE_TTL       = 300_000;      // 5 min — USD/INR rate
const DETAILS_CACHE_TTL  = 3_600_000;    // 1 hr  — static asset details

// ─── Public Types ─────────────────────────────────────────────────────────────

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  vwap?: number;
}

export interface StockSnapshot {
  symbol: string;
  latestTrade: { price: number; size: number; timestamp: string; exchange: string };
  latestQuote: { askPrice: number; askSize: number; bidPrice: number; bidSize: number; timestamp: string };
  minuteBar: { open: number; high: number; low: number; close: number; volume: number; vwap: number; timestamp: string };
  dailyBar: { open: number; high: number; low: number; close: number; volume: number; vwap: number; timestamp: string };
  prevDailyBar: { open: number; high: number; low: number; close: number; volume: number; vwap: number; timestamp: string };
}

export interface StockBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  tradeCount: number;
}

export interface StockDetails {
  symbol: string;
  name: string;
  market: string;
  locale: string;
  primaryExchange: string;
  type: string;
  currency: string;
  marketCap?: number;
  description?: string;
  logo_url?: string;
}

export type BarTimeframe =
  | "1Min" | "5Min" | "15Min" | "30Min"
  | "1Hour" | "4Hour"
  | "1Day" | "1Week" | "1Month";

// ─── Internal Cache Types ──────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; cachedAt: number }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/** Map our BarTimeframe to Alpaca Data API timeframe string */
function toAlpacaTimeframe(tf: BarTimeframe): string {
  const map: Record<BarTimeframe, string> = {
    "1Min":   "1Min",
    "5Min":   "5Min",
    "15Min":  "15Min",
    "30Min":  "30Min",
    "1Hour":  "1Hour",
    "4Hour":  "4Hour",
    "1Day":   "1Day",
    "1Week":  "1Week",
    "1Month": "1Month",
  };
  return map[tf] ?? "1Day";
}

/** Default start date for each timeframe when none supplied */
function defaultStart(tf: BarTimeframe): string {
  const now = new Date();
  switch (tf) {
    case "1Min":   now.setDate(now.getDate() - 1);   break;
    case "5Min":   now.setDate(now.getDate() - 1);   break;
    case "15Min":  now.setDate(now.getDate() - 5);   break;
    case "30Min":  now.setDate(now.getDate() - 5);   break;
    case "1Hour":  now.setDate(now.getDate() - 30);  break;
    case "4Hour":  now.setMonth(now.getMonth() - 3); break;
    case "1Day":   now.setFullYear(now.getFullYear() - 1); break;
    case "1Week":  now.setFullYear(now.getFullYear() - 5); break;
    case "1Month": now.setFullYear(now.getFullYear() - 10); break;
  }
  return now.toISOString().split("T")[0];
}

// ─── Yahoo Finance helpers (fallback) ─────────────────────────────────────────

function yfInterval(tf: BarTimeframe): { interval: string; fallbackRange: string } {
  switch (tf) {
    case "1Min":   return { interval: "1m",  fallbackRange: "1d" };
    case "5Min":   return { interval: "5m",  fallbackRange: "1d" };
    case "15Min":  return { interval: "15m", fallbackRange: "5d" };
    case "30Min":  return { interval: "30m", fallbackRange: "5d" };
    case "1Hour":  return { interval: "60m", fallbackRange: "5d" };
    case "4Hour":  return { interval: "60m", fallbackRange: "1mo" };
    case "1Day":   return { interval: "1d",  fallbackRange: "1y" };
    case "1Week":  return { interval: "1wk", fallbackRange: "5y" };
    case "1Month": return { interval: "1mo", fallbackRange: "max" };
    default:       return { interval: "1d",  fallbackRange: "1y" };
  }
}

function yfRange(start?: string, end?: string, fallback = "1y"): string {
  if (!start) return fallback;
  const days = (Date.now() - new Date(start).getTime()) / 86_400_000;
  if (days <= 1)    return "1d";
  if (days <= 5)    return "5d";
  if (days <= 30)   return "1mo";
  if (days <= 90)   return "3mo";
  if (days <= 180)  return "6mo";
  if (days <= 365)  return "1y";
  if (days <= 730)  return "2y";
  if (days <= 1825) return "5y";
  return "max";
}

// ─── Service ──────────────────────────────────────────────────────────────────

class AlpacaMarketDataService {
  private quoteCache   = new Map<string, CacheEntry<StockQuote>>();
  private snapCache    = new Map<string, CacheEntry<StockSnapshot>>();
  private detailsCache = new Map<string, CacheEntry<StockDetails>>();
  private fxCache: CacheEntry<number> | null = null;

  // ─── Credentials & Config ──────────────────────────────────────────────────

  isConfigured(): boolean {
    return !!(process.env.ALPACA_API_KEY && process.env.ALPACA_SECRET_KEY);
  }

  testConnection(): { success: boolean; message: string; feed: string } {
    if (!this.isConfigured()) return { success: false, message: "ALPACA_API_KEY / ALPACA_SECRET_KEY not set", feed: "yahoo" };
    return { success: true, message: "Alpaca Data API configured", feed: this.feed };
  }

  private get authHeaders(): Record<string, string> | null {
    const key    = process.env.ALPACA_API_KEY;
    const secret = process.env.ALPACA_SECRET_KEY;
    if (!key || !secret) return null;
    const basic = Buffer.from(`${key}:${secret}`).toString("base64");
    return { Authorization: `Basic ${basic}` };
  }

  private get brokerBaseUrl(): string {
    const base = process.env.ALPACA_BASE_URL || ALPACA_BROKER_SANDBOX;
    return base.includes("broker-api") ? base : ALPACA_BROKER_SANDBOX;
  }

  private get feed(): "sip" | "iex" {
    const base = process.env.ALPACA_BASE_URL || ALPACA_BROKER_SANDBOX;
    return base.includes("sandbox") ? "iex" : "sip";
  }

  private valid(cachedAt: number, ttl: number): boolean {
    return Date.now() - cachedAt < ttl;
  }

  // ─── Alpaca Data API: Snapshots ────────────────────────────────────────────

  private async alpacaSnapshots(symbols: string[]): Promise<Record<string, any>> {
    const headers = this.authHeaders;
    if (!headers || symbols.length === 0) return {};
    const res = await axios.get(`${ALPACA_DATA_URL}/stocks/snapshots`, {
      headers,
      params: { symbols: symbols.join(","), feed: this.feed },
      timeout: 12_000,
    });
    return res.data || {};
  }

  private mapAlpacaSnapshot(symbol: string, raw: any): StockSnapshot {
    const lt  = raw.latestTrade   || {};
    const lq  = raw.latestQuote   || {};
    const mb  = raw.minuteBar     || {};
    const db  = raw.dailyBar      || {};
    const pb  = raw.prevDailyBar  || {};
    const now = new Date().toISOString();

    const price = lt.p || db.c || 0;

    return {
      symbol,
      latestTrade: {
        price,
        size:      lt.s  || 0,
        timestamp: lt.t  || now,
        exchange:  lt.x  || "",
      },
      latestQuote: {
        askPrice:  lq.ap || price,
        askSize:   lq.as || 0,
        bidPrice:  lq.bp || price,
        bidSize:   lq.bs || 0,
        timestamp: lq.t  || now,
      },
      minuteBar: {
        open:      mb.o  || 0,
        high:      mb.h  || 0,
        low:       mb.l  || 0,
        close:     mb.c  || 0,
        volume:    mb.v  || 0,
        vwap:      mb.vw || 0,
        timestamp: mb.t  || now,
      },
      dailyBar: {
        open:      db.o  || 0,
        high:      db.h  || 0,
        low:       db.l  || 0,
        close:     db.c  || price,
        volume:    db.v  || 0,
        vwap:      db.vw || price,
        timestamp: db.t  || now,
      },
      prevDailyBar: {
        open:      pb.o  || 0,
        high:      pb.h  || 0,
        low:       pb.l  || 0,
        close:     pb.c  || 0,
        volume:    pb.v  || 0,
        vwap:      pb.vw || 0,
        timestamp: pb.t  || now,
      },
    };
  }

  // ─── Alpaca Data API: Bars ─────────────────────────────────────────────────

  private async alpacaBars(
    symbols: string[],
    timeframe: BarTimeframe,
    start?: string,
    end?: string,
    limit = 1000,
  ): Promise<Record<string, StockBar[]>> {
    const headers = this.authHeaders;
    if (!headers || symbols.length === 0) return {};

    const params: Record<string, any> = {
      symbols:   symbols.join(","),
      timeframe: toAlpacaTimeframe(timeframe),
      start:     start || defaultStart(timeframe),
      limit:     Math.min(limit, 10_000),
      feed:      this.feed,
      adjustment: "all",
    };
    if (end) params.end = end;

    const res = await axios.get(`${ALPACA_DATA_URL}/stocks/bars`, {
      headers,
      params,
      timeout: 15_000,
    });

    const raw: Record<string, any[]> = res.data?.bars || {};
    const result: Record<string, StockBar[]> = {};
    for (const [sym, bars] of Object.entries(raw)) {
      result[sym] = (bars || []).map((b: any) => ({
        timestamp:  b.t || new Date().toISOString(),
        open:       b.o ?? 0,
        high:       b.h ?? 0,
        low:        b.l ?? 0,
        close:      b.c ?? 0,
        volume:     b.v ?? 0,
        vwap:       b.vw ?? b.c ?? 0,
        tradeCount: b.n ?? 0,
      }));
    }
    return result;
  }

  // ─── Yahoo Finance: snapshot fallback ─────────────────────────────────────

  private async yfChart(symbol: string, interval = "1d", range = "1d"): Promise<any> {
    const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const res = await axios.get(url, {
      params:  { interval, range, includePrePost: false },
      headers: YF_HDRS,
      timeout: 10_000,
    });
    const result = res.data?.chart?.result?.[0];
    if (!result) throw new Error(`No data for ${symbol}`);
    return result;
  }

  private async fetchYahooSnapshot(symbol: string): Promise<StockSnapshot> {
    const r    = await this.yfChart(symbol, "1d", "5d");
    const meta = r.meta || {};
    const now  = new Date().toISOString();

    const price     = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const open      = meta.regularMarketOpen ?? price;
    const high      = meta.regularMarketDayHigh ?? price;
    const low       = meta.regularMarketDayLow ?? price;
    const volume    = meta.regularMarketVolume ?? 0;

    const timestamps: number[] = r.timestamp || [];
    const quotes = r.indicators?.quote?.[0] || {};
    const closes: number[] = quotes.close  || [];
    const opens:  number[] = quotes.open   || [];
    const highs:  number[] = quotes.high   || [];
    const lows:   number[] = quotes.low    || [];
    const vols:   number[] = quotes.volume || [];

    const lastIdx = timestamps.length - 1;
    const prevIdx = timestamps.length - 2;

    const dailyTs = lastIdx >= 0 ? new Date(timestamps[lastIdx] * 1000).toISOString() : now;
    const prevTs  = prevIdx >= 0 ? new Date(timestamps[prevIdx] * 1000).toISOString() : now;

    return {
      symbol,
      latestTrade:  { price, size: 0, timestamp: now, exchange: meta.exchangeName || "" },
      latestQuote:  { askPrice: price, askSize: 0, bidPrice: price, bidSize: 0, timestamp: now },
      minuteBar:    { open: price, high: price, low: price, close: price, volume: 0, vwap: price, timestamp: now },
      dailyBar:     { open: opens[lastIdx] ?? open, high: highs[lastIdx] ?? high, low: lows[lastIdx] ?? low, close: closes[lastIdx] ?? price, volume: vols[lastIdx] ?? volume, vwap: price, timestamp: dailyTs },
      prevDailyBar: { open: opens[prevIdx] ?? prevClose, high: highs[prevIdx] ?? prevClose, low: lows[prevIdx] ?? prevClose, close: closes[prevIdx] ?? prevClose, volume: vols[prevIdx] ?? 0, vwap: prevClose, timestamp: prevTs },
    };
  }

  private async fetchYahooFallback(symbols: string[], result: Map<string, StockSnapshot>): Promise<void> {
    await pMap(symbols, async (sym) => {
      try {
        const snap = await this.fetchYahooSnapshot(sym);
        this.snapCache.set(sym, { data: snap, cachedAt: Date.now() });
        result.set(sym, snap);
      } catch (err: any) {
        logger.warn(`MarketData(YF fallback): ${sym}: ${err.message}`);
      }
    }, 5);
  }

  // ─── Snapshots (public) ────────────────────────────────────────────────────

  async getSnapshots(symbols: string[]): Promise<Map<string, StockSnapshot>> {
    const result:   Map<string, StockSnapshot> = new Map();
    const toFetch:  string[] = [];

    for (const sym of symbols) {
      const upper  = sym.toUpperCase();
      const cached = this.snapCache.get(upper);
      if (cached && this.valid(cached.cachedAt, SNAPSHOT_CACHE_TTL)) {
        result.set(upper, cached.data);
      } else {
        toFetch.push(upper);
      }
    }

    if (toFetch.length === 0) return result;

    if (this.isConfigured()) {
      const batches = chunk(toFetch, 100);
      for (const batch of batches) {
        try {
          const data = await this.alpacaSnapshots(batch);
          const missing: string[] = [];
          for (const sym of batch) {
            const raw = data[sym];
            if (raw) {
              const snap = this.mapAlpacaSnapshot(sym, raw);
              this.snapCache.set(sym, { data: snap, cachedAt: Date.now() });
              result.set(sym, snap);
            } else {
              missing.push(sym);
            }
          }
          if (missing.length > 0) await this.fetchYahooFallback(missing, result);
        } catch (err: any) {
          logger.warn(`MarketData: Alpaca snapshots failed (${err.message}), falling back to Yahoo Finance`);
          await this.fetchYahooFallback(batch, result);
        }
      }
    } else {
      await this.fetchYahooFallback(toFetch, result);
    }

    return result;
  }

  async getSnapshot(symbol: string): Promise<StockSnapshot | null> {
    const upper = symbol.toUpperCase();
    const snaps = await this.getSnapshots([upper]);
    return snaps.get(upper) ?? null;
  }

  // ─── Snapshot → StockQuote ─────────────────────────────────────────────────

  private toQuote(snap: StockSnapshot): StockQuote {
    const price     = snap.latestTrade.price || snap.dailyBar.close;
    const prevClose = snap.prevDailyBar.close || snap.dailyBar.open || price;
    const change    = price - prevClose;
    const pct       = prevClose > 0 ? (change / prevClose) * 100 : 0;
    return {
      symbol:        snap.symbol,
      price,
      change,
      changePercent: pct,
      open:          snap.dailyBar.open,
      high:          snap.dailyBar.high,
      low:           snap.dailyBar.low,
      close:         snap.dailyBar.close,
      volume:        snap.dailyBar.volume,
      timestamp:     new Date(snap.dailyBar.timestamp || snap.latestTrade.timestamp || Date.now()).getTime(),
      bid:           snap.latestQuote.bidPrice,
      ask:           snap.latestQuote.askPrice,
      vwap:          snap.dailyBar.vwap,
    };
  }

  // ─── Quote Interface ───────────────────────────────────────────────────────

  async getQuote(symbol: string): Promise<StockQuote | null> {
    const upper  = symbol.toUpperCase();
    const cached = this.quoteCache.get(upper);
    if (cached && this.valid(cached.cachedAt, QUOTE_CACHE_TTL)) return cached.data;

    return guardedExecution(
      async () => {
        const snap = await this.getSnapshot(upper);
        if (!snap) return null;
        const quote = this.toQuote(snap);
        validateStockPrice(quote.price, upper);
        validateChangePercent(quote.changePercent, upper);
        this.quoteCache.set(upper, { data: quote, cachedAt: Date.now() });
        return quote;
      },
      {
        module:    "pricing_engine",
        operation: "alpaca_quote",
        input:     { symbol: upper },
        fallback:  null,
        code:      `Alpaca Data API → getQuote for ${upper}`,
      },
    );
  }

  async getMultipleQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const snaps  = await this.getSnapshots(symbols);
    const result = new Map<string, StockQuote>();
    for (const [sym, snap] of snaps) {
      const q = this.toQuote(snap);
      result.set(sym, q);
      this.quoteCache.set(sym, { data: q, cachedAt: Date.now() });
    }
    return result;
  }

  // ─── Historical Bars ───────────────────────────────────────────────────────

  async getBars(
    symbols: string | string[],
    timeframe: BarTimeframe = "1Day",
    start?: string,
    end?: string,
    limit = 1000,
  ): Promise<Map<string, StockBar[]>> {
    const symList = (Array.isArray(symbols) ? symbols : [symbols]).map(s => s.toUpperCase());
    const result  = new Map<string, StockBar[]>();

    if (this.isConfigured()) {
      try {
        const data = await this.alpacaBars(symList, timeframe, start, end, limit);
        for (const sym of symList) {
          result.set(sym, data[sym] || []);
        }
        return result;
      } catch (err: any) {
        logger.warn(`MarketData: Alpaca bars failed (${err.message}), falling back to Yahoo Finance`);
      }
    }

    // Yahoo Finance fallback for bars
    const { interval, fallbackRange } = yfInterval(timeframe);
    const range = yfRange(start, end, fallbackRange);
    await pMap(symList, async (sym) => {
      try {
        const r    = await this.yfChart(sym, interval, range);
        const ts   = (r.timestamp || []) as number[];
        const q    = r.indicators?.quote?.[0] || {};
        const bars: StockBar[] = [];
        for (let i = 0; i < ts.length; i++) {
          const c = (q.close || [])[i];
          if (c == null) continue;
          bars.push({
            timestamp:  new Date(ts[i] * 1000).toISOString(),
            open:       (q.open   || [])[i] ?? c,
            high:       (q.high   || [])[i] ?? c,
            low:        (q.low    || [])[i] ?? c,
            close:      c,
            volume:     (q.volume || [])[i] ?? 0,
            vwap:       c,
            tradeCount: 0,
          });
        }
        result.set(sym, bars.slice(-limit));
      } catch (err: any) {
        logger.warn(`MarketData: getBars(YF) failed for ${sym}: ${err.message}`);
        result.set(sym, []);
      }
    }, 3);

    return result;
  }

  async getLatestBars(symbols: string[]): Promise<Map<string, StockBar>> {
    const snaps  = await this.getSnapshots(symbols);
    const result = new Map<string, StockBar>();
    for (const [sym, snap] of snaps) {
      result.set(sym, {
        timestamp:  snap.dailyBar.timestamp,
        open:       snap.dailyBar.open,
        high:       snap.dailyBar.high,
        low:        snap.dailyBar.low,
        close:      snap.dailyBar.close,
        volume:     snap.dailyBar.volume,
        vwap:       snap.dailyBar.vwap,
        tradeCount: 0,
      });
    }
    return result;
  }

  // ─── Latest Quotes (bid / ask) ─────────────────────────────────────────────

  async getLatestQuotes(symbols: string[]): Promise<Map<string, {
    bidPrice: number; askPrice: number; bidSize: number; askSize: number; timestamp: string;
  }>> {
    const snaps  = await this.getSnapshots(symbols);
    const result = new Map<string, any>();
    for (const [sym, snap] of snaps) {
      result.set(sym, {
        bidPrice:  snap.latestQuote.bidPrice,
        askPrice:  snap.latestQuote.askPrice,
        bidSize:   snap.latestQuote.bidSize,
        askSize:   snap.latestQuote.askSize,
        timestamp: snap.latestTrade.timestamp,
      });
    }
    return result;
  }

  // ─── Asset / Symbol Details ────────────────────────────────────────────────

  async getStockDetails(symbol: string): Promise<StockDetails | null> {
    const upper  = symbol.toUpperCase();
    const cached = this.detailsCache.get(upper);
    if (cached && this.valid(cached.cachedAt, DETAILS_CACHE_TTL)) return cached.data;

    if (this.isConfigured()) {
      try {
        const headers = this.authHeaders!;
        const res     = await axios.get(`${this.brokerBaseUrl}/v1/assets/${upper}`, {
          headers,
          timeout: 8_000,
        });
        const a = res.data;
        const details: StockDetails = {
          symbol:          upper,
          name:            a.name || upper,
          market:          a.asset_class || "us_equity",
          locale:          "us",
          primaryExchange: a.exchange || "",
          type:            a.asset_class === "etf" ? "ETF" : "CS",
          currency:        "USD",
        };
        this.detailsCache.set(upper, { data: details, cachedAt: Date.now() });
        return details;
      } catch { /* fall through to Yahoo Finance */ }
    }

    try {
      const r    = await this.yfChart(upper, "1d", "1d");
      const meta = r.meta || {};
      const details: StockDetails = {
        symbol:          upper,
        name:            meta.longName || meta.shortName || upper,
        market:          "stocks",
        locale:          "us",
        primaryExchange: meta.exchangeName || "",
        type:            meta.instrumentType === "ETF" ? "ETF" : "CS",
        currency:        meta.currency || "USD",
      };
      this.detailsCache.set(upper, { data: details, cachedAt: Date.now() });
      return details;
    } catch {
      const fallback: StockDetails = { symbol: upper, name: upper, market: "stocks", locale: "us", primaryExchange: "", type: "CS", currency: "USD" };
      this.detailsCache.set(upper, { data: fallback, cachedAt: Date.now() });
      return fallback;
    }
  }

  // ─── Symbol Search ─────────────────────────────────────────────────────────

  async searchSymbols(query: string, limit = 10): Promise<StockDetails[]> {
    if (this.isConfigured()) {
      try {
        const headers = this.authHeaders!;
        const res     = await axios.get(`${this.brokerBaseUrl}/v1/assets`, {
          headers,
          params: {
            status:      "active",
            asset_class: "us_equity",
            search:      query,
          },
          timeout: 8_000,
        });
        const assets: any[] = res.data || [];
        if (assets.length > 0) {
          return assets.slice(0, limit).map(a => ({
            symbol:          a.symbol || "",
            name:            a.name   || a.symbol || "",
            market:          "stocks",
            locale:          "us",
            primaryExchange: a.exchange || "",
            type:            a.asset_class === "etf" ? "ETF" : "CS",
            currency:        "USD",
          }));
        }
      } catch (err: any) {
        logger.warn(`MarketData: Alpaca asset search failed (${err.message}), falling back to Yahoo`);
      }
    }

    try {
      const res    = await axios.get(`${YF_BASE}/v1/finance/search`, {
        params:  { q: query, quotesCount: limit, newsCount: 0, enableFuzzyQuery: false, enableCb: false },
        headers: YF_HDRS,
        timeout: 8_000,
      });
      const quotes: any[] = res.data?.quotes || [];
      return quotes
        .filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF")
        .slice(0, limit)
        .map(q => ({
          symbol:          q.symbol   || "",
          name:            q.longname || q.shortname || q.symbol || "",
          market:          "stocks",
          locale:          "us",
          primaryExchange: q.exchDisp || q.exchange  || "",
          type:            q.quoteType === "ETF" ? "ETF" : "CS",
          currency:        "USD",
        }));
    } catch (err: any) {
      logger.warn(`MarketData: searchSymbols error: ${err.message}`);
      return [];
    }
  }

  // ─── Popular Lists ──────────────────────────────────────────────────────────

  getSP500Constituents(): string[] {
    return [
      "AAPL", "MSFT", "AMZN", "NVDA", "GOOGL", "META", "TSLA", "BRK.B", "UNH", "JNJ",
      "XOM", "JPM", "V", "PG", "MA", "HD", "CVX", "MRK", "ABBV", "LLY",
      "PEP", "KO", "AVGO", "COST", "MCD", "WMT", "TMO", "ACN", "CSCO", "DHR",
    ];
  }

  async getPopularStocks(): Promise<(StockDetails & { price?: number; change?: number; changePercent?: number; volume?: number; vwap?: number })[]> {
    const symbols   = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"];
    const snapshots = await this.getSnapshots(symbols);
    return symbols.map(sym => {
      const snap  = snapshots.get(sym);
      const quote = snap ? this.toQuote(snap) : null;
      return { symbol: sym, name: sym, market: "stocks", locale: "us", primaryExchange: "", type: "CS", currency: "USD", price: quote?.price, change: quote?.change, changePercent: quote?.changePercent, volume: quote?.volume, vwap: quote?.vwap };
    });
  }

  async getPopularETFs(): Promise<(StockDetails & { price?: number; change?: number; changePercent?: number; expenseRatio?: number; category?: string })[]> {
    const meta: Record<string, { name: string; category: string; expenseRatio: number }> = {
      SPY:  { name: "SPDR S&P 500 ETF Trust",               category: "Large Cap Blend",  expenseRatio: 0.0945 },
      QQQ:  { name: "Invesco QQQ Trust",                     category: "Large Cap Growth", expenseRatio: 0.20   },
      VOO:  { name: "Vanguard S&P 500 ETF",                  category: "Large Cap Blend",  expenseRatio: 0.03   },
      DIA:  { name: "SPDR Dow Jones Industrial Average ETF",  category: "Large Cap Value",  expenseRatio: 0.16   },
      IVV:  { name: "iShares Core S&P 500 ETF",              category: "Large Cap Blend",  expenseRatio: 0.03   },
      VTI:  { name: "Vanguard Total Stock Market ETF",        category: "Large Cap Blend",  expenseRatio: 0.03   },
      VGT:  { name: "Vanguard Information Technology ETF",    category: "Technology",       expenseRatio: 0.10   },
      ARKK: { name: "ARK Innovation ETF",                    category: "Mid-Cap Growth",   expenseRatio: 0.75   },
    };
    const snapshots = await this.getSnapshots(Object.keys(meta));
    return Object.keys(meta).map(sym => {
      const snap  = snapshots.get(sym);
      const quote = snap ? this.toQuote(snap) : null;
      return { symbol: sym, name: meta[sym].name, market: "etfs", locale: "us", primaryExchange: "", type: "ETF", currency: "USD", category: meta[sym].category, expenseRatio: meta[sym].expenseRatio, price: quote?.price, change: quote?.change, changePercent: quote?.changePercent };
    });
  }

  // ─── USD/INR FX Rate ───────────────────────────────────────────────────────

  async getUsdInrRate(): Promise<number> {
    if (this.fxCache && this.valid(this.fxCache.cachedAt, FX_CACHE_TTL)) return this.fxCache.data;

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    try {
      if (apiKey) {
        const res  = await axios.get(`https://v6.exchangerate-api.com/v6/${apiKey}/pair/USD/INR`, { timeout: 5_000 });
        const rate = res.data?.conversion_rate as number;
        if (rate && rate > 0) { this.fxCache = { data: rate, cachedAt: Date.now() }; return rate; }
      }
      const res  = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 5_000 });
      const rate = res.data?.rates?.INR as number;
      if (rate && rate > 0) { this.fxCache = { data: rate, cachedAt: Date.now() }; return rate; }
    } catch { /* fall through */ }
    return this.fxCache?.data || 84.0;
  }

  // ─── Market Status ─────────────────────────────────────────────────────────

  getMarketStatus(): { isOpen: boolean; nextOpen: string; nextClose: string; timestamp: string } {
    const now  = new Date();
    const et   = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day  = et.getDay();
    const h    = et.getHours();
    const m    = et.getMinutes();
    const mins = h * 60 + m;
    const mo   = 9 * 60 + 30;
    const mc   = 16 * 60;

    const isWeekday = day >= 1 && day <= 5;
    const isOpen    = isWeekday && mins >= mo && mins < mc;

    const nextOpenDate = new Date(et);
    if (!isWeekday || mins >= mc) {
      const daysUntilMonday = day === 6 ? 2 : day === 0 ? 1 : 1;
      nextOpenDate.setDate(nextOpenDate.getDate() + daysUntilMonday);
    }
    nextOpenDate.setHours(9, 30, 0, 0);

    const nextCloseDate = new Date(et);
    nextCloseDate.setHours(16, 0, 0, 0);

    return {
      isOpen,
      nextOpen:  nextOpenDate.toISOString(),
      nextClose: nextCloseDate.toISOString(),
      timestamp: now.toISOString(),
    };
  }

  // ─── Legacy Polygon Flat-File stubs (not supported on Alpaca Data API) ────

  async getAvailableDatasets(): Promise<string[]> {
    logger.info("MarketData: getAvailableDatasets — Polygon flat files not available via Alpaca Data API");
    return [];
  }

  async listFlatFiles(_prefix: string, _maxKeys = 50): Promise<any[]> {
    logger.info("MarketData: listFlatFiles — Polygon flat files not available via Alpaca Data API");
    return [];
  }

  async getHistoricalDayAggs(_date: string): Promise<any[]> {
    logger.info("MarketData: getHistoricalDayAggs — use getBars() with 1Day timeframe instead");
    return [];
  }

  // ─── Diagnostics ───────────────────────────────────────────────────────────

  getDataSource(): string {
    return this.isConfigured()
      ? `Alpaca Data API (${this.feed.toUpperCase()} feed) + Yahoo Finance fallback`
      : "Yahoo Finance (Alpaca credentials not configured)";
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────────

export const alpacaMarketDataService = new AlpacaMarketDataService();
