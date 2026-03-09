/**
 * Financial data service for Research Note Generator.
 * Primary source: NSE India public API (no API key, no rate limits).
 * Fallback: Yahoo Finance quote() for non-NSE symbols.
 */

import yahooFinance from "yahoo-finance2";

export interface FinancialData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  roe: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;
  beta: number | null;
  targetMeanPrice: number | null;
  currency: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { data: FinancialData; expiresAt: number }>();

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ─── NSE India provider ───────────────────────────────────────────────────────

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
  } catch (err: any) {
    console.warn("[ResearchNote] NSE cookie refresh failed:", err?.message);
  }
}

async function fetchFromNSE(nseSymbol: string): Promise<FinancialData> {
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

  if (!res.ok) {
    throw new Error(`NSE API returned ${res.status} for ${nseSymbol}`);
  }

  const d = await res.json() as any;
  const pi = d.priceInfo ?? {};
  const meta = d.metadata ?? {};
  const whl = pi.weekHighLow ?? {};

  const price = pi.lastPrice ?? null;
  const pe = meta.pdSymbolPe ?? null;

  // Estimate EPS from price and PE
  const eps = price !== null && pe !== null && pe > 0 ? price / pe : null;

  return {
    price,
    previousClose: pi.previousClose ?? null,
    marketCap: null, // Not directly available from this endpoint
    pe,
    eps,
    roe: null,
    debtToEquity: null,
    revenueGrowth: null,
    earningsGrowth: null,
    fiftyTwoWeekHigh: whl.max ?? null,
    fiftyTwoWeekLow: whl.min ?? null,
    dividendYield: null,
    beta: null,
    targetMeanPrice: null,
    currency: "INR",
  };
}

// ─── Yahoo Finance fallback (quote only — different endpoint, lighter) ────────

async function fetchFromYahoo(symbol: string): Promise<FinancialData> {
  const q = (await yahooFinance.quote(symbol, {}, { validateResult: false })) as any;
  if (!q || !q.regularMarketPrice) throw new Error(`No price data from Yahoo for ${symbol}`);
  return {
    price: q.regularMarketPrice ?? null,
    previousClose: q.regularMarketPreviousClose ?? null,
    marketCap: q.marketCap ?? null,
    pe: q.trailingPE ?? null,
    eps: q.epsTrailingTwelveMonths ?? null,
    roe: null,
    debtToEquity: null,
    revenueGrowth: null,
    earningsGrowth: null,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? null,
    beta: q.beta ?? null,
    targetMeanPrice: null,
    currency: q.currency ?? "INR",
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Strip exchange suffix to get bare NSE symbol (e.g. "RELIANCE.NS" → "RELIANCE") */
function toNseSymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
}

export async function getFinancialData(symbol: string): Promise<FinancialData> {
  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[ResearchNote] Cache HIT for ${symbol}`);
    return cached.data;
  }

  const nseSymbol = toNseSymbol(symbol);

  // 1. Try NSE India (primary — no rate limits)
  try {
    console.log(`[ResearchNote] Fetching ${nseSymbol} from NSE India...`);
    const data = await fetchFromNSE(nseSymbol);
    if (data.price !== null) {
      cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      console.log(`[ResearchNote] NSE data cached for ${symbol} (price: ${data.price}, pe: ${data.pe})`);
      return data;
    }
    throw new Error("NSE returned null price");
  } catch (nseErr: any) {
    console.warn(`[ResearchNote] NSE India failed for ${nseSymbol}: ${nseErr?.message}`);
  }

  // 2. Fallback: Yahoo Finance quote()
  const yahooSymbols = [
    symbol.includes(".") ? symbol : `${symbol}.NS`,
    symbol.includes(".") ? symbol.replace(/\.(NS|BO)$/, ".BO") : `${symbol}.BO`,
  ];

  for (const ySym of yahooSymbols) {
    try {
      console.log(`[ResearchNote] Fallback: fetching ${ySym} from Yahoo Finance...`);
      const data = await fetchFromYahoo(ySym);
      cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      console.log(`[ResearchNote] Yahoo data cached for ${symbol}`);
      return data;
    } catch (yErr: any) {
      const msg: string = yErr?.message ?? "";
      if (msg.includes("Too Many Requests") || msg.includes("429")) {
        throw new Error(
          "Financial data is temporarily unavailable. Yahoo Finance is rate-limiting this server. Please try again in 60 seconds."
        );
      }
      console.warn(`[ResearchNote] Yahoo fallback failed for ${ySym}: ${msg}`);
    }
  }

  throw new Error(`Could not fetch financial data for ${symbol}. Please try again.`);
}
