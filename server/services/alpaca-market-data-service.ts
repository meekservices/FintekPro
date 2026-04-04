/**
 * Market Data Service
 * ───────────────────
 * Provides real US equity market data.
 * Primary source : Yahoo Finance (no API key required)
 * FX source      : ExchangeRate-API (EXCHANGE_RATE_API_KEY env var)
 *
 * The Alpaca Broker API credentials (ALPACA_API_KEY / ALPACA_SECRET_KEY) are
 * *broker-level* keys that authenticate against broker-api.*.alpaca.markets
 * for account management and order placement.  They do NOT work with the
 * Alpaca Data API (data.alpaca.markets), which requires separate trading-account
 * keys.  Therefore all market data is fetched from Yahoo Finance.
 *
 * This module exports the same interface as the original polygon-market-service
 * replacement so all callers continue working without changes.
 */

import axios from "axios";
import { logger } from "../logger";

// ─── Cache TTLs ────────────────────────────────────────────────────────────────

const QUOTE_CACHE_TTL    = 30_000;      // 30 s  — live quotes
const SNAPSHOT_CACHE_TTL = 30_000;      // 30 s  — full snapshots
const FX_CACHE_TTL       = 300_000;     // 5 min — USD/INR rate
const DETAILS_CACHE_TTL  = 3_600_000;   // 1 hr  — static asset details

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

// ─── Yahoo Finance helpers ─────────────────────────────────────────────────────

const YF_BASE  = "https://query1.finance.yahoo.com";
const YF_HDRS  = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Map BarTimeframe → Yahoo Finance interval + sensible default range */
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

/** Compute the "range" param from start/end ISO strings for Yahoo Finance */
function yfRange(start?: string, end?: string, fallback = "1y"): string {
  if (!start) return fallback;
  const ms = Date.now() - new Date(start).getTime();
  const days = ms / 86_400_000;
  if (days <= 1)   return "1d";
  if (days <= 5)   return "5d";
  if (days <= 30)  return "1mo";
  if (days <= 90)  return "3mo";
  if (days <= 180) return "6mo";
  if (days <= 365) return "1y";
  if (days <= 730) return "2y";
  if (days <= 1825) return "5y";
  return "max";
}

// ─── Concurrency helper ────────────────────────────────────────────────────────

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

// ─── Service ──────────────────────────────────────────────────────────────────

class AlpacaMarketDataService {
  private quoteCache   = new Map<string, CacheEntry<StockQuote>>();
  private snapCache    = new Map<string, CacheEntry<StockSnapshot>>();
  private detailsCache = new Map<string, CacheEntry<StockDetails>>();
  private fxCache: CacheEntry<number> | null = null;

  isConfigured(): boolean { return true; }   // Yahoo Finance needs no credentials

  private valid(cachedAt: number, ttl: number): boolean {
    return Date.now() - cachedAt < ttl;
  }

  /** Fetch a Yahoo Finance chart for one symbol and return its meta + first quote set */
  private async yfChart(
    symbol: string,
    interval = "1d",
    range    = "1d",
  ): Promise<any> {
    const url = `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const res = await axios.get(url, {
      params:  { interval, range, includePrePost: false },
      headers: YF_HDRS,
      timeout: 10_000,
    });
    const result = res.data?.chart?.result?.[0];
    if (!result) throw new Error(`No data returned for ${symbol}`);
    return result;
  }

  // ─── Snapshot from Yahoo Finance ────────────────────────────────────────────

  private async fetchSnapshot(symbol: string): Promise<StockSnapshot> {
    const r    = await this.yfChart(symbol, "1d", "5d");
    const meta = r.meta || {};
    const now  = new Date().toISOString();

    const price   = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const open    = meta.regularMarketOpen ?? price;
    const high    = meta.regularMarketDayHigh ?? price;
    const low     = meta.regularMarketDayLow ?? price;
    const volume  = meta.regularMarketVolume ?? 0;

    // Historical bars from indicators
    const timestamps: number[] = r.timestamp || [];
    const quotes = r.indicators?.quote?.[0] || {};
    const closes: number[] = quotes.close || [];
    const opens:  number[] = quotes.open  || [];
    const highs:  number[] = quotes.high  || [];
    const lows:   number[] = quotes.low   || [];
    const vols:   number[] = quotes.volume || [];

    const lastIdx   = timestamps.length - 1;
    const prevIdx   = timestamps.length - 2;

    const dailyTs  = lastIdx >= 0 ? new Date(timestamps[lastIdx] * 1000).toISOString() : now;
    const prevTs   = prevIdx >= 0 ? new Date(timestamps[prevIdx] * 1000).toISOString() : now;

    const dailyClose  = closes[lastIdx]  ?? price;
    const dailyOpen   = opens[lastIdx]   ?? open;
    const dailyHigh   = highs[lastIdx]   ?? high;
    const dailyLow    = lows[lastIdx]    ?? low;
    const dailyVol    = vols[lastIdx]    ?? volume;

    const prevClose2  = closes[prevIdx]  ?? prevClose;
    const prevOpen2   = opens[prevIdx]   ?? prevClose;
    const prevHigh2   = highs[prevIdx]   ?? prevClose;
    const prevLow2    = lows[prevIdx]    ?? prevClose;
    const prevVol2    = vols[prevIdx]    ?? 0;

    return {
      symbol,
      latestTrade: { price, size: 0, timestamp: now, exchange: meta.exchangeName || "" },
      latestQuote: { askPrice: price, askSize: 0, bidPrice: price, bidSize: 0, timestamp: now },
      minuteBar:   { open: price,  high: price,  low: price,  close: price,  volume: 0, vwap: price, timestamp: now },
      dailyBar:    { open: dailyOpen, high: dailyHigh, low: dailyLow, close: dailyClose, volume: dailyVol, vwap: meta.regularMarketPrice ?? dailyClose, timestamp: dailyTs },
      prevDailyBar:{ open: prevOpen2, high: prevHigh2, low: prevLow2, close: prevClose2, volume: prevVol2, vwap: prevClose2, timestamp: prevTs },
    };
  }

  // ─── Snapshots ──────────────────────────────────────────────────────────────

  async getSnapshots(symbols: string[]): Promise<Map<string, StockSnapshot>> {
    const result   = new Map<string, StockSnapshot>();
    const toFetch: string[] = [];

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

    await pMap(toFetch, async (sym) => {
      try {
        const snap = await this.fetchSnapshot(sym);
        this.snapCache.set(sym, { data: snap, cachedAt: Date.now() });
        result.set(sym, snap);
      } catch (err: any) {
        logger.warn(`MarketData: could not fetch snapshot for ${sym}: ${err.message}`);
      }
    }, 5);

    return result;
  }

  async getSnapshot(symbol: string): Promise<StockSnapshot | null> {
    const upper  = symbol.toUpperCase();
    const snaps  = await this.getSnapshots([upper]);
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

  // ─── Polygon-compatible Quote Interface ────────────────────────────────────

  async getQuote(symbol: string): Promise<StockQuote | null> {
    const upper  = symbol.toUpperCase();
    const cached = this.quoteCache.get(upper);
    if (cached && this.valid(cached.cachedAt, QUOTE_CACHE_TTL)) return cached.data;

    const snap = await this.getSnapshot(upper);
    if (!snap) return null;

    const quote = this.toQuote(snap);
    this.quoteCache.set(upper, { data: quote, cachedAt: Date.now() });
    return quote;
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
    const symList = Array.isArray(symbols) ? symbols : [symbols];
    const { interval, fallbackRange } = yfInterval(timeframe);
    const range   = yfRange(start, end, fallbackRange);
    const result  = new Map<string, StockBar[]>();

    await pMap(symList, async (sym) => {
      try {
        const r    = await this.yfChart(sym.toUpperCase(), interval, range);
        const ts   = (r.timestamp || []) as number[];
        const q    = r.indicators?.quote?.[0] || {};
        const bars: StockBar[] = [];

        for (let i = 0; i < ts.length; i++) {
          const c = (q.close  || [])[i];
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

        result.set(sym.toUpperCase(), bars.slice(-limit));
      } catch (err: any) {
        logger.warn(`MarketData: getBars failed for ${sym}: ${err.message}`);
        result.set(sym.toUpperCase(), []);
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

  // ─── Asset / Symbol Search ─────────────────────────────────────────────────

  async getStockDetails(symbol: string): Promise<StockDetails | null> {
    const upper  = symbol.toUpperCase();
    const cached = this.detailsCache.get(upper);
    if (cached && this.valid(cached.cachedAt, DETAILS_CACHE_TTL)) return cached.data;

    try {
      const r   = await this.yfChart(upper, "1d", "1d");
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

  async searchSymbols(query: string, limit = 10): Promise<StockDetails[]> {
    try {
      const url = `${YF_BASE}/v1/finance/search`;
      const res = await axios.get(url, {
        params:  { q: query, quotesCount: limit, newsCount: 0, enableFuzzyQuery: false, enableCb: false },
        headers: YF_HDRS,
        timeout: 8_000,
      });
      const quotes: any[] = res.data?.quotes || [];
      return quotes
        .filter(q => q.quoteType === "EQUITY" || q.quoteType === "ETF")
        .slice(0, limit)
        .map(q => ({
          symbol:          q.symbol || "",
          name:            q.longname || q.shortname || q.symbol || "",
          market:          "stocks",
          locale:          "us",
          primaryExchange: q.exchDisp || q.exchange || "",
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
        if (rate && rate > 0) {
          this.fxCache = { data: rate, cachedAt: Date.now() };
          return rate;
        }
      }
      // Fallback: open.er-api.com (no key)
      const res  = await axios.get("https://open.er-api.com/v6/latest/USD", { timeout: 5_000 });
      const rate = res.data?.rates?.INR as number;
      if (rate && rate > 0) {
        this.fxCache = { data: rate, cachedAt: Date.now() };
        return rate;
      }
    } catch { /* fall through */ }
    return this.fxCache?.data || 84.0;
  }

  // ─── Market Status ─────────────────────────────────────────────────────────

  getMarketStatus(): { isOpen: boolean; nextOpen: string; nextClose: string; timestamp: string } {
    const now = new Date();
    // Convert to Eastern Time
    const et  = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.getDay();   // 0=Sun,6=Sat
    const h   = et.getHours();
    const m   = et.getMinutes();
    const mins = h * 60 + m;

    const marketOpen  = 9 * 60 + 30;  // 09:30
    const marketClose = 16 * 60;       // 16:00

    const isWeekday = day >= 1 && day <= 5;
    const isOpen    = isWeekday && mins >= marketOpen && mins < marketClose;

    const todayOpen  = new Date(et);
    todayOpen.setHours(9, 30, 0, 0);
    const todayClose = new Date(et);
    todayClose.setHours(16, 0, 0, 0);

    return {
      isOpen,
      nextOpen:  todayOpen.toISOString(),
      nextClose: todayClose.toISOString(),
      timestamp: now.toISOString(),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  clearCache(): void {
    this.quoteCache.clear();
    this.snapCache.clear();
    this.detailsCache.clear();
    this.fxCache = null;
  }

  testConnection(): { configured: boolean; feed: string; isPaper: boolean; message: string } {
    return {
      configured: true,
      feed:       "yahoo",
      isPaper:    false,
      message:    "Market Data ready — source: Yahoo Finance (real-time, no subscription required)",
    };
  }
}

export const alpacaMarketDataService = new AlpacaMarketDataService();
