/**
 * Financial data service for Research Note Generator.
 *
 * Data sources (in priority order):
 *  1. NSE India public API — price, PE, 52-week range, market cap via issuedSize
 *  2. FintekPro DB (screener_financials) — EPS, book value → derive ROE, P/B
 *  3. Yahoo Finance quote() — fallback for non-NSE or unknown symbols
 */

import yahooFinance from "yahoo-finance2";
import { db } from "../../db";
import { sql } from "drizzle-orm";

export interface FinancialData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;         // ₹ crores
  pe: number | null;
  eps: number | null;
  roe: number | null;               // % — derived from EPS / BookValue
  pbRatio: number | null;           // Price / Book Value
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  currency: string;
  bookValue: number | null;         // per share ₹
  faceValue: number | null;
  vwap: number | null;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { data: FinancialData; expiresAt: number }>();

// ─── NSE India ────────────────────────────────────────────────────────────────

const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.5",
};

let nseCookies = "";
let nseCookieExpiry = 0;

async function refreshNseCookies(): Promise<void> {
  if (Date.now() < nseCookieExpiry) return;
  try {
    const res = await fetch("https://www.nseindia.com", { headers: NSE_HEADERS });
    const setCookie = res.headers.get("set-cookie") ?? "";
    if (setCookie) {
      nseCookies = setCookie.split(",").map((c) => c.split(";")[0]).join("; ");
      nseCookieExpiry = Date.now() + 5 * 60 * 1000;
    }
  } catch (e: any) {
    console.warn("[ResearchNote] NSE cookie refresh failed:", e?.message);
  }
}

async function fetchFromNSE(nseSymbol: string): Promise<Partial<FinancialData>> {
  await refreshNseCookies();

  const url = `https://www.nseindia.com/api/quote-equity?symbol=${encodeURIComponent(nseSymbol.toUpperCase())}`;
  const res = await fetch(url, {
    headers: {
      ...NSE_HEADERS,
      Cookie: nseCookies,
      Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${nseSymbol}`,
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) throw new Error(`NSE API ${res.status} for ${nseSymbol}`);

  const d = await res.json() as any;
  const pi = d.priceInfo ?? {};
  const meta = d.metadata ?? {};
  const sec = d.securityInfo ?? {};
  const whl = pi.weekHighLow ?? {};

  const price: number | null = pi.lastPrice ?? null;
  const issuedSize: number | null = sec.issuedSize ?? null;
  const marketCap =
    price !== null && issuedSize !== null
      ? price * issuedSize   // absolute ₹ (e.g. RELIANCE ≈ 1.92e13)
      : null;

  return {
    price,
    previousClose: pi.previousClose ?? null,
    marketCap,
    pe: meta.pdSymbolPe ?? null,
    fiftyTwoWeekHigh: typeof whl.max === "number" ? whl.max : null,
    fiftyTwoWeekLow: typeof whl.min === "number" ? whl.min : null,
    faceValue: sec.faceValue ?? null,
    vwap: pi.vwap ?? null,
    currency: "INR",
  };
}

// ─── FintekPro DB enrichment ──────────────────────────────────────────────────

async function fetchFromDB(nseSymbol: string): Promise<{
  eps: number | null;
  bookValue: number | null;
  dividendYield: number | null;
}> {
  try {
    const rows = await db.execute(sql`
      SELECT eps, book_value, dividend_yield
      FROM screener_financials
      WHERE symbol = ${nseSymbol.toUpperCase()}
      ORDER BY fiscal_year DESC
      LIMIT 1
    `);
    const r = ((rows as any).rows ?? rows)[0] as any;
    if (!r) return { eps: null, bookValue: null, dividendYield: null };
    return {
      eps: r.eps !== null ? parseFloat(r.eps) : null,
      bookValue: r.book_value !== null ? parseFloat(r.book_value) : null,
      dividendYield: r.dividend_yield !== null ? parseFloat(r.dividend_yield) : null,
    };
  } catch (e: any) {
    console.warn("[ResearchNote] DB enrichment failed:", e?.message);
    return { eps: null, bookValue: null, dividendYield: null };
  }
}

// ─── Yahoo Finance fallback ───────────────────────────────────────────────────

async function fetchFromYahoo(symbol: string): Promise<Partial<FinancialData>> {
  const q = (await yahooFinance.quote(symbol, {}, { validateResult: false })) as any;
  if (!q?.regularMarketPrice) throw new Error(`No price from Yahoo for ${symbol}`);
  return {
    price: q.regularMarketPrice ?? null,
    previousClose: q.regularMarketPreviousClose ?? null,
    marketCap: q.marketCap ?? null,
    pe: q.trailingPE ?? null,
    eps: q.epsTrailingTwelveMonths ?? null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? null,
    beta: q.beta ?? null,
    currency: q.currency ?? "INR",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNseSymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
}

function isRateLimit(err: any): boolean {
  const m: string = err?.message ?? "";
  return m.includes("Too Many Requests") || m.includes("429");
}

function buildFull(
  base: Partial<FinancialData>,
  db: { eps: number | null; bookValue: number | null; dividendYield: number | null }
): FinancialData {
  // Prefer DB EPS (annual reported) over derived value
  const eps = db.eps ?? base.eps ?? null;
  const bookValue = db.bookValue ?? base.bookValue ?? null;
  const price = base.price ?? null;
  const pe = base.pe ?? null;

  // ROE ≈ EPS / BookValue — send as decimal fraction (frontend multiplies ×100)
  const roe =
    eps !== null && bookValue !== null && bookValue > 0
      ? Math.round((eps / bookValue) * 10000) / 10000   // e.g. 0.1250 for 12.5%
      : null;

  // P/B = Price / BookValue
  const pbRatio =
    price !== null && bookValue !== null && bookValue > 0
      ? Math.round((price / bookValue) * 100) / 100
      : null;

  // Dividend yield: prefer DB value, fallback NSE/Yahoo
  const dividendYield = db.dividendYield ?? base.dividendYield ?? null;

  return {
    price,
    previousClose: base.previousClose ?? null,
    marketCap: base.marketCap ?? null,
    pe,
    eps,
    roe,
    pbRatio,
    debtToEquity: null,
    revenueGrowth: null,
    earningsGrowth: null,
    fiftyTwoWeekHigh: base.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: base.fiftyTwoWeekLow ?? null,
    dividendYield,
    beta: base.beta ?? null,
    targetMeanPrice: null,
    currency: base.currency ?? "INR",
    bookValue,
    faceValue: base.faceValue ?? null,
    vwap: base.vwap ?? null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getFinancialData(symbol: string): Promise<FinancialData> {
  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[ResearchNote] Cache HIT for ${symbol}`);
    return cached.data;
  }

  const nseSymbol = toNseSymbol(symbol);

  // Always enrich from DB (fast, parallel with NSE)
  const [nseResult, dbResult] = await Promise.allSettled([
    fetchFromNSE(nseSymbol),
    fetchFromDB(nseSymbol),
  ]);

  const dbData =
    dbResult.status === "fulfilled"
      ? dbResult.value
      : { eps: null, bookValue: null, dividendYield: null };

  if (nseResult.status === "fulfilled" && nseResult.value.price !== null) {
    const data = buildFull(nseResult.value, dbData);
    cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(
      `[ResearchNote] Cached ${symbol} — price: ${data.price}, mktCap: ${data.marketCap}cr, ROE: ${data.roe}%, EPS: ${data.eps}`
    );
    return data;
  }

  console.warn(`[ResearchNote] NSE India failed for ${nseSymbol}:`, (nseResult as any).reason?.message);

  // Fallback: Yahoo Finance
  const yahooSymbols = [`${nseSymbol}.NS`, `${nseSymbol}.BO`];
  for (const ySym of yahooSymbols) {
    try {
      console.log(`[ResearchNote] Yahoo fallback: ${ySym}`);
      const yData = await fetchFromYahoo(ySym);
      const data = buildFull(yData, dbData);
      cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } catch (e: any) {
      if (isRateLimit(e)) {
        throw new Error(
          "Financial data is temporarily unavailable. Please wait 60 seconds and try again."
        );
      }
      console.warn(`[ResearchNote] Yahoo failed for ${ySym}:`, e?.message);
    }
  }

  throw new Error(`Could not fetch financial data for ${symbol}. Please try again.`);
}
