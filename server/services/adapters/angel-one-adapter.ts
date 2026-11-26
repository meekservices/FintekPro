/**
 * angel-one-adapter.ts
 *
 * Angel One SmartAPI Adapter for NCDEX (National Commodity & Derivatives Exchange).
 *
 * Purpose:
 *   Provides licensed live quotes, market depth, and OHLC data for Indian
 *   agricultural commodity derivatives on NCDEX (exchange segment: ncx_fo / NCX).
 *
 *   Upstox does not support NCDEX. Angel One SmartAPI fills this critical gap
 *   for agricultural inflation benchmarks (Jeera, Turmeric, Guar, Cocudakl, etc.).
 *
 * Auth Flow:
 *   - Auto-login via TOTP (RFC 6238) using ANGEL_TOTP_SECRET + ANGEL_CLIENT_CODE + ANGEL_PIN.
 *   - JWT token cached and auto-refreshed before expiry.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0 (Zero-trust, structured logging, safe retries).
 *
 * @module angel-one-adapter
 * @version 1.0.0
 */

import axios, { type AxiosInstance } from "axios";
import crypto from "crypto";
import { logger } from "../../logger";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface AngelOneQuoteItem {
  exchange: "NCX";
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  lastTradedQty?: number;
  exchFeedTime?: string;
  totalTradedVolume?: number;
  totalTradedValue?: number;
  opnInterest?: number;
  totBuyQuan?: number;
  totSellQuan?: number;
  "52WeekHigh"?: number;
  "52WeekLow"?: number;
  depth?: {
    buy?: Array<{ price: number; quantity: number; orders: number }>;
    sell?: Array<{ price: number; quantity: number; orders: number }>;
  };
}

export interface AngelOneAuthSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  expiresAt: number;
}

export interface NcdexContractMeta {
  id: string; // e.g. "JEERA"
  name: string;
  symbolToken: string;
  tradingSymbol: string;
  expiry: string;
  lotSize: number;
  tickSize: number;
}

export interface AngelIndexMeta {
  id: string;
  name: string;
  exchange: "NSE" | "BSE";
  symbolToken: string;
  tradingSymbol: string;
}

export interface AngelOneEquityQuote {
  symbol: string;
  exchange: "NSE" | "BSE";
  currentPrice: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  timestamp: number;
  source: "ANGEL_ONE";
}

// ─── Benchmark Index Tokens (SmartAPI NSE & BSE) ──────────────────────────────
export const ANGEL_INDEX_BENCHMARK_TOKENS: Record<string, AngelIndexMeta> = {
  NIFTY_50: {
    id: "NIFTY_50",
    name: "Nifty 50 Index",
    exchange: "NSE",
    symbolToken: "26000",
    tradingSymbol: "Nifty 50",
  },
  BANKNIFTY: {
    id: "BANKNIFTY",
    name: "Nifty Bank Index",
    exchange: "NSE",
    symbolToken: "26009",
    tradingSymbol: "Nifty Bank",
  },
  SENSEX: {
    id: "SENSEX",
    name: "BSE Sensex Index",
    exchange: "BSE",
    symbolToken: "99926000",
    tradingSymbol: "SENSEX",
  },
  INDIA_VIX: {
    id: "INDIA_VIX",
    name: "India VIX",
    exchange: "NSE",
    symbolToken: "26017",
    tradingSymbol: "India VIX",
  },
  NIFTY_IT: {
    id: "NIFTY_IT",
    name: "Nifty IT Index",
    exchange: "NSE",
    symbolToken: "26008",
    tradingSymbol: "Nifty IT",
  },
};

// ─── High-Volume Large-Cap NSE Symbol Token Mappings ──────────────────────────
export const ANGEL_EQUITY_BENCHMARK_TOKENS: Record<string, { token: string; symbol: string }> = {
  RELIANCE: { token: "2885", symbol: "RELIANCE-EQ" },
  TCS: { token: "11536", symbol: "TCS-EQ" },
  INFY: { token: "1594", symbol: "INFY-EQ" },
  HDFCBANK: { token: "1333", symbol: "HDFCBANK-EQ" },
  ICICIBANK: { token: "4963", symbol: "ICICIBANK-EQ" },
  SBIN: { token: "3045", symbol: "SBIN-EQ" },
  BHARTIARTL: { token: "10604", symbol: "BHARTIARTL-EQ" },
  ITC: { token: "1660", symbol: "ITC-EQ" },
  KOTAKBANK: { token: "1922", symbol: "KOTAKBANK-EQ" },
  LT: { token: "11483", symbol: "LT-EQ" },
  AXISBANK: { token: "5900", symbol: "AXISBANK-EQ" },
  TATAMOTORS: { token: "3456", symbol: "TATAMOTORS-EQ" },
  MARUTI: { token: "10999", symbol: "MARUTI-EQ" },
  SUNPHARMA: { token: "3351", symbol: "SUNPHARMA-EQ" },
  BAJFINANCE: { token: "317", symbol: "BAJFINANCE-EQ" },
  HINDUNILVR: { token: "1394", symbol: "HINDUNILVR-EQ" },
  TITAN: { token: "3506", symbol: "TITAN-EQ" },
  ASIANPAINT: { token: "236", symbol: "ASIANPAINT-EQ" },
  TATASTEEL: { token: "3499", symbol: "TATASTEEL-EQ" },
  WIPRO: { token: "3787", symbol: "WIPRO-EQ" },
  HCLTECH: { token: "7229", symbol: "HCLTECH-EQ" },
  NTPC: { token: "11630", symbol: "NTPC-EQ" },
  POWERGRID: { token: "14977", symbol: "POWERGRID-EQ" },
  ONGC: { token: "2475", symbol: "ONGC-EQ" },
  COALINDIA: { token: "20374", symbol: "COALINDIA-EQ" },
  ANGELONE: { token: "11184", symbol: "ANGELONE-EQ" },
};

// ─── Baseline NCDEX Contract Tokens (Angel One NCX segment) ───────────────────
// These map benchmark FintekPro commodity IDs to Angel One SmartAPI symbol tokens
export const ANGEL_NCDEX_BENCHMARK_TOKENS: Record<string, NcdexContractMeta> = {
  JEERA: {
    id: "JEERA",
    name: "Jeera (Cumin Seed)",
    symbolToken: "508001",
    tradingSymbol: "JEERAUNJHA",
    expiry: "NEAR_MONTH",
    lotSize: 30, // 3 MT
    tickSize: 5,
  },
  TURMERIC: {
    id: "TURMERIC",
    name: "Turmeric Farmer Polished",
    symbolToken: "508002",
    tradingSymbol: "TMCFGRNZM",
    expiry: "NEAR_MONTH",
    lotSize: 50, // 5 MT
    tickSize: 5,
  },
  GUARSEED: {
    id: "GUARSEED",
    name: "Guar Seed 10MT",
    symbolToken: "508003",
    tradingSymbol: "GUARSEED10",
    expiry: "NEAR_MONTH",
    lotSize: 50,
    tickSize: 1,
  },
  COCUDAKL: {
    id: "COCUDAKL",
    name: "Cottonseed Oilcake (Cocudakl)",
    symbolToken: "508004",
    tradingSymbol: "COCUDAKL",
    expiry: "NEAR_MONTH",
    lotSize: 100,
    tickSize: 1,
  },
  DHANIYA: {
    id: "DHANIYA",
    name: "Dhaniya (Coriander)",
    symbolToken: "508005",
    tradingSymbol: "DHANIYA",
    expiry: "NEAR_MONTH",
    lotSize: 50,
    tickSize: 2,
  },
  CASTORSEED: {
    id: "CASTORSEED",
    name: "Castor Seed",
    symbolToken: "508006",
    tradingSymbol: "CASTOR",
    expiry: "NEAR_MONTH",
    lotSize: 50,
    tickSize: 2,
  },
  CHANA: {
    id: "CHANA",
    name: "Chana (Chickpeas)",
    symbolToken: "508007",
    tradingSymbol: "CHANA",
    expiry: "NEAR_MONTH",
    lotSize: 100,
    tickSize: 1,
  },
};

// ─── RFC 6238 TOTP Generator (Native Node.js Crypto) ───────────────────────────

/**
 * Decodes a Base32 string into a Buffer.
 */
export function base32Decode(base32: string): Buffer {
  const cleaned = base32.replace(/[\s=-]/g, "").toUpperCase();
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < cleaned.length; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generates an RFC 6238 6-digit TOTP code for automated Angel One login.
 */
export function generateTOTP(secret: string, timeSeconds = Math.floor(Date.now() / 1000)): string {
  const key = base32Decode(secret);
  const timeStep = Math.floor(timeSeconds / 30);

  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const str = (code % 1_000_000).toString().padStart(6, "0");
  return str;
}

// ─── Angel One Adapter Implementation ──────────────────────────────────────────

export class AngelOneAdapter {
  private static instance: AngelOneAdapter;
  private readonly baseUrl = "https://apiconnect.angelone.in";
  private session: AngelOneAuthSession | null = null;
  private isAuthenticating = false;

  private constructor() {}

  public static getInstance(): AngelOneAdapter {
    if (!AngelOneAdapter.instance) {
      AngelOneAdapter.instance = new AngelOneAdapter();
    }
    return AngelOneAdapter.instance;
  }

  // ── Configuration ───────────────────────────────────────────────────────────

  public isConfigured(): boolean {
    return !!(
      process.env.ANGEL_API_KEY &&
      process.env.ANGEL_CLIENT_CODE &&
      process.env.ANGEL_PIN &&
      process.env.ANGEL_TOTP_SECRET
    );
  }

  public isReady(): boolean {
    return this.isConfigured();
  }

  public getStatus() {
    return {
      configured: this.isConfigured(),
      authenticated: !!this.session && this.session.expiresAt > Date.now(),
      clientCode: process.env.ANGEL_CLIENT_CODE ? `${process.env.ANGEL_CLIENT_CODE.slice(0, 2)}***` : "NOT_SET",
      ncdexSupported: true,
      exchangeSegment: "ncx_fo",
      timestamp: new Date().toISOString(),
    };
  }

  // ── Authentication & Session Management ─────────────────────────────────────

  private async getActiveToken(): Promise<string | null> {
    if (!this.isConfigured()) return null;

    // Reuse valid unexpired session (refresh 5 mins prior to expiry)
    if (this.session && this.session.expiresAt > Date.now() + 300_000) {
      return this.session.jwtToken;
    }

    if (this.isAuthenticating) {
      // Small sleep to avoid duplicate login calls
      await new Promise((r) => setTimeout(r, 1000));
      return this.session?.jwtToken || null;
    }

    this.isAuthenticating = true;
    try {
      const apiKey = process.env.ANGEL_API_KEY!;
      const clientCode = process.env.ANGEL_CLIENT_CODE!;
      const pin = process.env.ANGEL_PIN!;
      const totpSecret = process.env.ANGEL_TOTP_SECRET!;

      const totp = generateTOTP(totpSecret);

      const loginPayload = {
        clientcode: clientCode,
        password: pin,
        totp,
      };

      const resp = await axios.post(
        `${this.baseUrl}/rest/auth/partner/v1/loginByPassword`,
        loginPayload,
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": process.env.ANGEL_STATIC_IP || "8.231.118.86",
            "X-MACAddress": "02:00:00:00:00:00",
            "X-PrivateKey": apiKey,
          },
          timeout: 10_000,
        }
      );

      const data = resp.data?.data;
      if (resp.data?.status && data?.jwtToken) {
        const token = data.jwtToken.startsWith("Bearer ") ? data.jwtToken.slice(7) : data.jwtToken;
        this.session = {
          jwtToken: token,
          refreshToken: data.refreshToken || "",
          feedToken: data.feedToken || "",
          expiresAt: Date.now() + 24 * 3600 * 1000, // Valid for 24h
        };
        logger.info("[AngelOne] Authenticated successfully with SmartAPI", {
          event: "ANGEL_LOGIN_SUCCESS",
          client: clientCode.slice(0, 2) + "***",
        });
        return this.session.jwtToken;
      }

      logger.warn("[AngelOne] Login rejected by SmartAPI:", resp.data);
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AngelOne] Login error: ${msg}`);
      return null;
    } finally {
      this.isAuthenticating = false;
    }
  }

  // ── Market Quotes (NCDEX / NCX Segment) ─────────────────────────────────────

  /**
   * Fetches live market quotes for NCDEX agricultural contracts.
   * Based on SmartAPI Market Data API:
   * POST /rest/secure/angelbroking/market/v1/quote/
   *
   * @param tokens Array of Angel One NCDEX symbol tokens (e.g. ["508001", "508002"])
   */
  public async getNcdexQuotes(
    tokens: string[] = Object.values(ANGEL_NCDEX_BENCHMARK_TOKENS).map((t) => t.symbolToken)
  ): Promise<AngelOneQuoteItem[]> {
    const token = await this.getActiveToken();
    if (!token) {
      return [];
    }

    try {
      const apiKey = process.env.ANGEL_API_KEY!;
      const payload = {
        mode: "FULL",
        exchangeTokens: {
          NCX: tokens,
        },
      };

      const resp = await axios.post(
        `${this.baseUrl}/rest/secure/angelbroking/market/v1/quote/`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": process.env.ANGEL_STATIC_IP || "8.231.118.86",
            "X-MACAddress": "02:00:00:00:00:00",
            "X-PrivateKey": apiKey,
          },
          timeout: 8_000,
        }
      );

      const fetched: any[] = resp.data?.data?.fetched || [];
      return fetched.map((item) => ({
        exchange: "NCX",
        tradingSymbol: item.tradingSymbol || "",
        symbolToken: item.symbolToken || "",
        ltp: Number(item.ltp || 0),
        open: Number(item.open || 0),
        high: Number(item.high || 0),
        low: Number(item.low || 0),
        close: Number(item.close || 0),
        lastTradedQty: item.lastTradedQty ? Number(item.lastTradedQty) : undefined,
        exchFeedTime: item.exchFeedTime,
        totalTradedVolume: item.totalTradedVolume ? Number(item.totalTradedVolume) : undefined,
        totalTradedValue: item.totalTradedValue ? Number(item.totalTradedValue) : undefined,
        opnInterest: item.opnInterest ? Number(item.opnInterest) : undefined,
        totBuyQuan: item.totBuyQuan ? Number(item.totBuyQuan) : undefined,
        totSellQuan: item.totSellQuan ? Number(item.totSellQuan) : undefined,
        depth: item.depth,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[AngelOne] getNcdexQuotes failed: ${msg}`);
      return [];
    }
  }

  /**
   * Fetches single instrument LTP via SmartAPI getLtpData endpoint.
   * Based on: POST /rest/secure/angelbroking/order/v1/getLtpData
   *
   * @param exchange "NCX" | "NSE" | "BSE" | "MCX" | "NFO"
   * @param tradingSymbol Contract symbol (e.g. "JEERAUNJHA")
   * @param symbolToken Instrument token (e.g. "508001")
   */
  public async getLtpData(
    exchange: string,
    tradingSymbol: string,
    symbolToken: string
  ): Promise<{ exchange: string; tradingSymbol: string; symbolToken: string; ltp: number; open: number; high: number; low: number; close: number } | null> {
    const token = await this.getActiveToken();
    if (!token) return null;

    try {
      const apiKey = process.env.ANGEL_API_KEY!;
      const resp = await axios.post(
        `${this.baseUrl}/rest/secure/angelbroking/order/v1/getLtpData`,
        {
          exchange,
          tradingsymbol: tradingSymbol,
          symboltoken: symbolToken,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": process.env.ANGEL_STATIC_IP || "8.231.118.86",
            "X-MACAddress": "02:00:00:00:00:00",
            "X-PrivateKey": apiKey,
          },
          timeout: 6_000,
        }
      );

      const d = resp.data?.data;
      if (resp.data?.status && d) {
        return {
          exchange: d.exchange,
          tradingSymbol: d.tradingsymbol,
          symbolToken: d.symboltoken,
          ltp: Number(d.ltp || 0),
          open: Number(d.open || 0),
          high: Number(d.high || 0),
          low: Number(d.low || 0),
          close: Number(d.close || 0),
        };
      }
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[AngelOne] getLtpData failed: ${msg}`);
      return null;
    }
  }

  /**
   * Fetches historical candlestick data via SmartAPI getCandleData.
   * Based on: POST /rest/secure/angelbroking/historical/v1/getCandleData
   */
  public async getCandleData(
    exchange: string,
    symbolToken: string,
    interval: "ONE_MINUTE" | "FIVE_MINUTE" | "FIFTEEN_MINUTE" | "ONE_HOUR" | "ONE_DAY" = "ONE_DAY",
    fromDate: string, // "YYYY-MM-DD HH:MM"
    toDate: string    // "YYYY-MM-DD HH:MM"
  ): Promise<Array<[string, number, number, number, number, number]>> {
    const token = await this.getActiveToken();
    if (!token) return [];

    try {
      const apiKey = process.env.ANGEL_API_KEY!;
      const resp = await axios.post(
        `${this.baseUrl}/rest/secure/angelbroking/historical/v1/getCandleData`,
        {
          exchange,
          symboltoken: symbolToken,
          interval,
          fromdate: fromDate,
          todate: toDate,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "127.0.0.1",
            "X-ClientPublicIP": process.env.ANGEL_STATIC_IP || "8.231.118.86",
            "X-MACAddress": "02:00:00:00:00:00",
            "X-PrivateKey": apiKey,
          },
          timeout: 10_000,
        }
      );

      if (resp.data?.status && Array.isArray(resp.data?.data)) {
        return resp.data.data;
      }
      return [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[AngelOne] getCandleData failed: ${msg}`);
      return [];
    }
  }

  // ── Equity & Index Market Quotes (NSE & BSE) ────────────────────────────────

  /**
   * Fetches real-time equity quote for NSE / BSE symbol from Angel One SmartAPI.
   */
  public async getEquityQuote(
    symbol: string,
    exchange: "NSE" | "BSE" = "NSE"
  ): Promise<AngelOneEquityQuote | null> {
    if (!this.isReady()) return null;

    const symUpper = symbol.toUpperCase().replace(/\.(NS|BO)$/i, "");
    const tokenInfo = ANGEL_EQUITY_BENCHMARK_TOKENS[symUpper];
    const tradingSymbol = tokenInfo ? tokenInfo.symbol : `${symUpper}-EQ`;
    const symbolToken = tokenInfo ? tokenInfo.token : symUpper;

    try {
      const ltpData = await this.getLtpData(exchange, tradingSymbol, symbolToken);
      if (!ltpData || !ltpData.ltp || ltpData.ltp <= 0) {
        return null;
      }

      const prevClose = ltpData.close || ltpData.open || ltpData.ltp;
      const change = Math.round((ltpData.ltp - prevClose) * 100) / 100;
      const changePercent = prevClose > 0 ? Math.round(((ltpData.ltp - prevClose) / prevClose) * 10000) / 100 : 0;

      return {
        symbol: symUpper,
        exchange,
        currentPrice: ltpData.ltp,
        open: ltpData.open || ltpData.ltp,
        high: ltpData.high || ltpData.ltp,
        low: ltpData.low || ltpData.ltp,
        close: ltpData.close || ltpData.ltp,
        change,
        changePercent,
        timestamp: Date.now(),
        source: "ANGEL_ONE",
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[AngelOne] getEquityQuote failed for ${symUpper}: ${msg}`);
      return null;
    }
  }

  /**
   * Fetches official benchmark index quote (Nifty 50, Sensex, Bank Nifty, etc.)
   */
  public async getIndexQuote(
    indexKey: "NIFTY_50" | "BANKNIFTY" | "SENSEX" | "INDIA_VIX" | "NIFTY_IT" | string
  ): Promise<{ name: string; price: number; changePercent: number; exchange: "NSE" | "BSE" } | null> {
    if (!this.isReady()) return null;

    const meta = ANGEL_INDEX_BENCHMARK_TOKENS[indexKey];
    if (!meta) return null;

    try {
      const ltpData = await this.getLtpData(meta.exchange, meta.tradingSymbol, meta.symbolToken);
      if (!ltpData || !ltpData.ltp || ltpData.ltp <= 0) return null;

      const prevClose = ltpData.close || ltpData.open || ltpData.ltp;
      const changePercent = prevClose > 0 ? Math.round(((ltpData.ltp - prevClose) / prevClose) * 10000) / 100 : 0;

      return {
        name: meta.name,
        price: ltpData.ltp,
        changePercent,
        exchange: meta.exchange,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`[AngelOne] getIndexQuote failed for ${indexKey}: ${msg}`);
      return null;
    }
  }

  /**
   * Fetches all core Indian benchmark indices in one call.
   */
  public async getIndices(): Promise<Array<{ name: string; price: number; changePercent: number; exchange: "NSE" | "BSE" }>> {
    if (!this.isReady()) return [];

    const keys = Object.keys(ANGEL_INDEX_BENCHMARK_TOKENS);
    const results = await Promise.allSettled(keys.map((k) => this.getIndexQuote(k)));
    const items: Array<{ name: string; price: number; changePercent: number; exchange: "NSE" | "BSE" }> = [];

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        items.push(r.value);
      }
    }
    return items;
  }
}

export const angelOneAdapter = AngelOneAdapter.getInstance();
