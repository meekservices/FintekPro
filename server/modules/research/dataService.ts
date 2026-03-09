/**
 * Financial data service for Research Note Generator.
 *
 * Data sources (priority order — DB-FIRST pattern):
 *  1. In-memory cache (15 min TTL) — fastest, avoids all I/O
 *  2. NSE India public API — live price (fast, always fetched fresh)
 *  3. FintekPro DB (screener_financials) — fundamentals cache; used if data < 6 hours old
 *  4. Screener.in HTML scrape — only called when DB data is missing or stale (> 6 hours)
 *  5. Yahoo Finance quote() — last-resort fallback if NSE fails
 *
 * Write-through: every successful Screener.in scrape is persisted to DB immediately.
 * Stale-serve: if all live sources fail, stale DB data is returned so users always see data.
 */

import yahooFinance from "yahoo-finance2";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { callPython } from "../../clients/python-client";

export interface FinancialData {
  price: number | null;
  previousClose: number | null;
  marketCap: number | null;         // absolute ₹ rupees
  pe: number | null;
  eps: number | null;
  roe: number | null;               // decimal fraction (0.084 = 8.4%)
  roce: number | null;              // decimal fraction
  pbRatio: number | null;           // Price / Book Value
  debtToEquity: number | null;
  revenueGrowth: number | null;     // decimal fraction (0.064 = 6.4%)
  earningsGrowth: number | null;    // decimal fraction
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  dividendYield: number | null;     // decimal fraction (0.0039 = 0.39%)
  beta: number | null;
  targetMeanPrice: number | null;
  currency: string;
  bookValue: number | null;
  faceValue: number | null;
  vwap: number | null;
  // Extended fields from screener_financials
  operatingCashFlow: number | null; // absolute ₹ crores
  freeCashFlow: number | null;      // absolute ₹ crores
  revenue: number | null;           // absolute ₹ crores
  netIncome: number | null;         // absolute ₹ crores
  operatingMargin: number | null;   // decimal fraction
  // Price returns from listed_stocks
  returns1M: number | null;         // decimal fraction
  returns6M: number | null;
  returns1Y: number | null;
}

// ─── Screener data shape ──────────────────────────────────────────────────────

export interface ScreenerData {
  roe: number | null;
  roce: number | null;
  dividendYield: number | null;
  bookValue: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  pe: number | null;
  pb: number | null;
  // Absolute financial figures (₹ Crores)
  revenue: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  operatingMargin: number | null;   // decimal fraction
}

// ─── Data quality metadata ────────────────────────────────────────────────────

export interface FundamentalsSource {
  source: "DB_CACHE" | "SCREENER_LIVE" | "NONE";
  scrapedAt: string | null;   // ISO timestamp of when DB data was last written
  ageHours: number | null;    // how stale the DB data is
}

// ─── Caches ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000;
const DB_FRESHNESS_HOURS = 6;   // use DB if data is < 6 hours old, else re-scrape

const cache = new Map<string, { data: FinancialData; expiresAt: number }>();

// ─── NSE India ────────────────────────────────────────────────────────────────

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

let nseCookies = "";
let nseCookieExpiry = 0;

async function refreshNseCookies(): Promise<void> {
  if (Date.now() < nseCookieExpiry) return;
  try {
    const res = await fetch("https://www.nseindia.com", { headers: BROWSER_HEADERS });
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
      ...BROWSER_HEADERS,
      Accept: "application/json",
      Cookie: nseCookies,
      Referer: `https://www.nseindia.com/get-quotes/equity?symbol=${nseSymbol}`,
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`NSE API ${res.status} for ${nseSymbol}`);
  const d = await res.json() as any;
  const pi  = d.priceInfo ?? {};
  const meta = d.metadata ?? {};
  const sec  = d.securityInfo ?? {};
  const whl  = pi.weekHighLow ?? {};
  const price: number | null = pi.lastPrice ?? null;
  const issuedSize: number | null = sec.issuedSize ?? null;
  return {
    price,
    previousClose: pi.previousClose ?? null,
    marketCap: price !== null && issuedSize !== null ? price * issuedSize : null,
    pe: meta.pdSymbolPe ?? null,
    fiftyTwoWeekHigh: typeof whl.max === "number" ? whl.max : null,
    fiftyTwoWeekLow:  typeof whl.min === "number" ? whl.min : null,
    faceValue: sec.faceValue ?? null,
    vwap: pi.vwap ?? null,
    currency: "INR",
  };
}

// ─── Screener.in enrichment ───────────────────────────────────────────────────

function parseNum(text: string): number | null {
  const clean = text.replace(/,/g, "").trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

function extractTableLastTwoRows(html: string, sectionId: string, rowLabel: string): [number | null, number | null] {
  const sectionStart = html.indexOf(`id="${sectionId}"`);
  if (sectionStart < 0) return [null, null];
  const sectionEnd = html.indexOf("</section>", sectionStart);
  const section = html.slice(sectionStart, sectionEnd > 0 ? sectionEnd : sectionStart + 40000);

  const rows = section.split(/<tr[^>]*>/i);
  for (const row of rows) {
    // Try class="text" first, then fall back to any first <td> that looks like a label
    const strictMatch = row.match(/class="text"[^>]*>([\s\S]*?)<\/td>/i);
    let name: string;
    if (strictMatch) {
      name = strictMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\+/g, "").trim();
    } else {
      const anyMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
      if (!anyMatch) continue;
      const candidate = anyMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\+/g, "").trim();
      if (/^\d+[\d.,\s]*$/.test(candidate) || candidate.length < 2) continue; // skip numeric/empty cells
      name = candidate;
    }
    if (!name.toLowerCase().includes(rowLabel.toLowerCase())) continue;
    const cells = [...row.matchAll(/<td[^>]*>\s*(-?[\d,\.]+)\s*<\/td>/g)].map(m => parseNum(m[1]));
    if (cells.length >= 2) {
      return [cells[cells.length - 2], cells[cells.length - 1]];
    }
  }
  return [null, null];
}

export async function fetchFromScreener(nseSymbol: string): Promise<ScreenerData> {
  const empty: ScreenerData = {
    roe: null, roce: null, dividendYield: null, bookValue: null,
    revenueGrowth: null, earningsGrowth: null, debtToEquity: null,
    pe: null, pb: null,
    revenue: null, netIncome: null, operatingCashFlow: null, freeCashFlow: null, operatingMargin: null,
  };

  try {
    const searchRes = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(nseSymbol)}`,
      { headers: { ...BROWSER_HEADERS, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) }
    );
    if (!searchRes.ok) return empty;
    const results = await searchRes.json() as any[];
    if (!results?.length) return empty;

    const company = results.find((r: any) => r.url?.includes("consolidated")) ?? results[0];
    const companyUrl = `https://www.screener.in${company.url}`;

    const pageRes = await fetch(companyUrl, {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.screener.in/" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!pageRes.ok) return empty;
    const html = await pageRes.text();

    const topStart = html.indexOf('id="top"');
    const topEnd   = html.indexOf("</section>", topStart);
    const topHtml  = topStart >= 0 ? html.slice(topStart, topEnd > 0 ? topEnd : topStart + 8000) : "";

    const liItems = [...topHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map(m =>
      m[1].replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
    );

    let roe: number | null = null;
    let roce: number | null = null;
    let dividendYield: number | null = null;
    let bookValue: number | null = null;
    let pe: number | null = null;
    let pb: number | null = null;

    for (const item of liItems) {
      const numMatch = item.match(/([\d,\.]+)\s*%?$/);
      if (!numMatch) continue;
      const val = parseNum(numMatch[1]);
      const lower = item.toLowerCase();
      if (/\broe\b/.test(lower) && roe === null)                          roe = val !== null ? val / 100 : null;
      else if (/\broce\b/.test(lower) && roce === null)                   roce = val !== null ? val / 100 : null;
      else if (/dividend yield/.test(lower) && dividendYield === null)    dividendYield = val !== null ? val / 100 : null;
      else if (/stock p\/e|pe ratio|\bp\/e\b/.test(lower) && pe === null) pe = val;
      else if (/price to book|p\/b ratio/.test(lower) && pb === null)     pb = val;
      else if (/book value/.test(lower) && bookValue === null) {
        const bvMatch = item.match(/(?:₹|Rs\.?)\s*([\d,\.]+)/i);
        bookValue = bvMatch ? parseNum(bvMatch[1]) : val;
        if (bookValue === null && val !== null) bookValue = val;
      }
    }

    const [revPrev, revLatest] = extractTableLastTwoRows(html, "profit-loss", "Sales");
    const [patPrev, patLatest] = extractTableLastTwoRows(html, "profit-loss", "Net Profit");

    const revenueGrowth: number | null =
      revPrev && revLatest && revPrev > 0
        ? (revLatest - revPrev) / revPrev
        : null;

    const earningsGrowth: number | null =
      patPrev && patLatest && Math.abs(patPrev) > 0
        ? (patLatest - patPrev) / Math.abs(patPrev)
        : null;

    // Absolute revenue and net income (₹ Crores)
    const revenue: number | null = revLatest;
    const netIncome: number | null = patLatest;

    // Operating Profit (absolute) → use to compute OPM %
    const [, opRaw] = extractTableLastTwoRows(html, "profit-loss", "Operating Profit");
    const operatingMargin: number | null =
      opRaw !== null && revLatest !== null && revLatest > 0
        ? Math.round((opRaw / revLatest) * 10000) / 10000   // decimal fraction e.g. 0.254
        : null;

    // Cash flows from cash flow section (₹ Crores) — try multiple row label variants
    const [, cfoRaw1] = extractTableLastTwoRows(html, "cash-flow", "Cash from Operating");
    const [, cfoRaw2] = extractTableLastTwoRows(html, "cash-flow", "Operating Activities");
    const cfoRaw = cfoRaw1 ?? cfoRaw2;
    const [, cfiRaw1] = extractTableLastTwoRows(html, "cash-flow", "Cash from Investing");
    const [, cfiRaw2] = extractTableLastTwoRows(html, "cash-flow", "Investing Activities");
    const cfiRaw = cfiRaw1 ?? cfiRaw2;
    const operatingCashFlow: number | null = cfoRaw ?? null;
    // FCF = Operating CF + Investing CF (investing is typically negative = capex outflows)
    const freeCashFlow: number | null =
      cfoRaw !== null && cfiRaw !== null ? Math.round((cfoRaw + cfiRaw) * 100) / 100 : null;

    const [, equityCapital] = extractTableLastTwoRows(html, "balance-sheet", "Equity Capital");
    const [, reserves]      = extractTableLastTwoRows(html, "balance-sheet", "Reserves");
    const [, borrowings]    = extractTableLastTwoRows(html, "balance-sheet", "Borrowings");

    const totalEquity = (equityCapital ?? 0) + (reserves ?? 0);
    const debtToEquity: number | null =
      borrowings !== null && totalEquity > 0
        ? Math.round((borrowings / totalEquity) * 1000) / 1000
        : null;

    console.log(
      `[ResearchNote] Screener.in ${nseSymbol} → ROE:${roe !== null ? (roe * 100).toFixed(2) + "%" : "N/A"}`,
      `ROCE:${roce !== null ? (roce * 100).toFixed(2) + "%" : "N/A"}`,
      `PE:${pe ?? "N/A"} PB:${pb ?? "N/A"}`,
      `DY:${dividendYield !== null ? (dividendYield * 100).toFixed(2) + "%" : "N/A"}`,
      `D/E:${debtToEquity ?? "N/A"}`,
      `Rev:${revenue !== null ? "₹" + revenue.toFixed(0) + "Cr" : "N/A"}`,
      `OPM:${operatingMargin !== null ? (operatingMargin * 100).toFixed(1) + "%" : "N/A"}`,
      `CFO:${operatingCashFlow !== null ? "₹" + operatingCashFlow.toFixed(0) + "Cr" : "N/A"}`,
      `FCF:${freeCashFlow !== null ? "₹" + freeCashFlow.toFixed(0) + "Cr" : "N/A"}`
    );

    return {
      roe, roce, dividendYield, bookValue, revenueGrowth, earningsGrowth, debtToEquity, pe, pb,
      revenue, netIncome, operatingCashFlow, freeCashFlow, operatingMargin,
    };
  } catch (e: any) {
    console.warn("[ResearchNote] Screener.in fetch failed:", e?.message);
    return empty;
  }
}

// ─── DB enrichment (read all cached fields + freshness check) ─────────────────

interface DBData {
  eps: number | null;
  bookValue: number | null;
  roe: number | null;
  roce: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  beta: number | null;          // from listed_stocks.beta
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  revenue: number | null;
  netIncome: number | null;
  operatingMargin: number | null;
  returns1M: number | null;
  returns6M: number | null;
  returns1Y: number | null;
  lastUpdated: Date | null;     // when fundamentals were last written to DB
}

async function fetchFromDB(nseSymbol: string): Promise<DBData> {
  const empty: DBData = {
    eps: null, bookValue: null, roe: null, roce: null, dividendYield: null,
    debtToEquity: null, revenueGrowth: null, earningsGrowth: null, beta: null,
    operatingCashFlow: null, freeCashFlow: null, revenue: null, netIncome: null,
    operatingMargin: null, returns1M: null, returns6M: null, returns1Y: null,
    lastUpdated: null,
  };
  try {
    const rows = await db.execute(sql`
      SELECT sf.eps, sf.book_value, sf.roe, sf.roce, sf.dividend_yield,
             sf.debt_to_equity, sf.revenue_growth, sf.earnings_growth,
             sf.operating_cash_flow, sf.free_cash_flow,
             sf.revenue, sf.net_income, sf.operating_margin,
             sf.last_updated,
             ls.returns_1m, ls.returns_6m, ls.returns_1y, ls.beta
      FROM screener_financials sf
      LEFT JOIN listed_stocks ls ON ls.symbol = sf.symbol
      WHERE sf.symbol = ${nseSymbol.toUpperCase()}
      ORDER BY sf.fiscal_year DESC NULLS LAST, sf.last_updated DESC NULLS LAST
      LIMIT 1
    `);
    const r = ((rows as any).rows ?? rows)[0] as any;
    if (!r) {
      const lsRows = await db.execute(sql`
        SELECT returns_1m, returns_6m, returns_1y FROM listed_stocks WHERE symbol = ${nseSymbol.toUpperCase()} LIMIT 1
      `);
      const lr = ((lsRows as any).rows ?? lsRows)[0] as any;
      if (lr) {
        const pf = (v: any) => (v !== null && v !== undefined ? parseFloat(v) : null);
        return { ...empty, returns1M: pf(lr.returns_1m), returns6M: pf(lr.returns_6m), returns1Y: pf(lr.returns_1y) };
      }
      return empty;
    }
    const pf = (v: any) => (v !== null && v !== undefined ? parseFloat(v) : null);
    return {
      eps:              pf(r.eps),
      bookValue:        pf(r.book_value),
      roe:              pf(r.roe),
      roce:             pf(r.roce),
      dividendYield:    pf(r.dividend_yield),
      debtToEquity:     pf(r.debt_to_equity),
      revenueGrowth:    pf(r.revenue_growth),
      earningsGrowth:   pf(r.earnings_growth),
      beta:             pf(r.beta),
      operatingCashFlow: pf(r.operating_cash_flow),
      freeCashFlow:     pf(r.free_cash_flow),
      revenue:          pf(r.revenue),
      netIncome:        pf(r.net_income),
      operatingMargin:  pf(r.operating_margin),
      returns1M:        pf(r.returns_1m),
      returns6M:        pf(r.returns_6m),
      returns1Y:        pf(r.returns_1y),
      lastUpdated:      r.last_updated ? new Date(r.last_updated) : null,
    };
  } catch (e: any) {
    console.warn("[ResearchNote] DB read failed:", e?.message);
    return empty;
  }
}

/** Returns true if DB data is fresh enough to skip a live Screener.in scrape */
function isDbFresh(dbData: DBData): boolean {
  if (!dbData.lastUpdated) return false;
  if (dbData.roe === null && dbData.roce === null) return false; // no useful fundamentals stored
  if (dbData.revenue === null) return false;                     // re-scrape if new fields missing
  const ageMs = Date.now() - dbData.lastUpdated.getTime();
  return ageMs < DB_FRESHNESS_HOURS * 60 * 60 * 1000;
}

// ─── DB write-back (persist Screener.in results) ──────────────────────────────

async function writeScreenerToDB(nseSymbol: string, s: ScreenerData): Promise<void> {
  const sym = nseSymbol.toUpperCase();
  try {
    const upd = await db.execute(sql`
      UPDATE screener_financials
      SET
        roe              = COALESCE(${s.roe}, roe),
        roce             = COALESCE(${s.roce}, roce),
        dividend_yield   = COALESCE(${s.dividendYield}, dividend_yield),
        book_value       = COALESCE(${s.bookValue}, book_value),
        revenue_growth   = COALESCE(${s.revenueGrowth}, revenue_growth),
        earnings_growth  = COALESCE(${s.earningsGrowth}, earnings_growth),
        debt_to_equity   = COALESCE(${s.debtToEquity}, debt_to_equity),
        revenue          = COALESCE(${s.revenue}, revenue),
        net_income       = COALESCE(${s.netIncome}, net_income),
        operating_cash_flow = COALESCE(${s.operatingCashFlow}, operating_cash_flow),
        free_cash_flow   = COALESCE(${s.freeCashFlow}, free_cash_flow),
        operating_margin = COALESCE(${s.operatingMargin}, operating_margin),
        last_updated     = now()
      WHERE id = (
        SELECT id FROM screener_financials
        WHERE symbol = ${sym}
        ORDER BY fiscal_year DESC NULLS LAST, last_updated DESC NULLS LAST
        LIMIT 1
      )
    `);
    const rowsUpdated = (upd as any).rowCount ?? 0;
    if (!rowsUpdated) {
      const curYear = new Date().getFullYear();
      await db.execute(sql`
        INSERT INTO screener_financials (
          symbol, period, fiscal_year, roe, roce, dividend_yield, book_value,
          revenue_growth, earnings_growth, debt_to_equity,
          revenue, net_income, operating_cash_flow, free_cash_flow, operating_margin,
          last_updated
        ) VALUES (
          ${sym}, 'annual', ${curYear}, ${s.roe}, ${s.roce}, ${s.dividendYield}, ${s.bookValue},
          ${s.revenueGrowth}, ${s.earningsGrowth}, ${s.debtToEquity},
          ${s.revenue}, ${s.netIncome}, ${s.operatingCashFlow}, ${s.freeCashFlow}, ${s.operatingMargin},
          now()
        )
      `);
    }
  } catch (e: any) {
    console.warn("[ResearchNote] DB write-back failed:", e?.message?.slice(0, 80));
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
    fiftyTwoWeekLow:  q.fiftyTwoWeekLow ?? null,
    dividendYield: q.trailingAnnualDividendYield ?? null,
    beta: q.beta ?? null,
    currency: q.currency ?? "INR",
  };
}

// ─── Merge & build final FinancialData ────────────────────────────────────────

function toNseSymbol(symbol: string): string {
  return symbol.replace(/\.(NS|BO|NSE|BSE)$/i, "").toUpperCase();
}

function isRateLimit(err: any): boolean {
  const m: string = err?.message ?? "";
  return m.includes("Too Many Requests") || m.includes("429");
}

function buildFull(
  base: Partial<FinancialData>,
  dbData: DBData,
  screener: ScreenerData
): FinancialData {
  const price = base.price ?? null;

  const roe =
    screener.roe ??
    dbData.roe ??
    (() => {
      const eps = dbData.eps ?? base.eps ?? null;
      const bv  = screener.bookValue ?? dbData.bookValue ?? null;
      return eps !== null && bv !== null && bv > 0 ? eps / bv : null;
    })();

  const bookValue = screener.bookValue ?? dbData.bookValue ?? null;

  const pbRatio =
    price !== null && bookValue !== null && bookValue > 0
      ? Math.round((price / bookValue) * 100) / 100
      : null;

  return {
    price,
    previousClose: base.previousClose ?? null,
    marketCap:     base.marketCap ?? null,
    pe:            base.pe ?? null,
    eps:           dbData.eps ?? base.eps ?? null,
    roe,
    roce:          screener.roce ?? dbData.roce ?? null,
    pbRatio,
    debtToEquity:  screener.debtToEquity ?? dbData.debtToEquity ?? null,
    revenueGrowth: screener.revenueGrowth ?? dbData.revenueGrowth ?? null,
    earningsGrowth: screener.earningsGrowth ?? dbData.earningsGrowth ?? null,
    fiftyTwoWeekHigh: base.fiftyTwoWeekHigh ?? null,
    fiftyTwoWeekLow:  base.fiftyTwoWeekLow ?? null,
    dividendYield: screener.dividendYield ?? dbData.dividendYield ?? base.dividendYield ?? null,
    beta:          dbData.beta ?? base.beta ?? null,
    targetMeanPrice: null,
    currency:      base.currency ?? "INR",
    bookValue,
    faceValue:     base.faceValue ?? null,
    vwap:          base.vwap ?? null,
    operatingCashFlow: screener.operatingCashFlow ?? dbData.operatingCashFlow ?? null,
    freeCashFlow:   screener.freeCashFlow   ?? dbData.freeCashFlow   ?? null,
    revenue:        screener.revenue        ?? dbData.revenue        ?? null,
    netIncome:      screener.netIncome      ?? dbData.netIncome      ?? null,
    operatingMargin: screener.operatingMargin ?? dbData.operatingMargin ?? null,
    returns1M:      dbData.returns1M ?? null,
    returns6M:      dbData.returns6M ?? null,
    returns1Y:      dbData.returns1Y ?? null,
  };
}

// ─── Python-Powered Price Returns ────────────────────────────────────────────
//
// Reads the golden_prices time-series from the DB (via the Python sidecar)
// and computes 1D / 1W / 1M / 3M / 6M / YTD / 1Y / 3Y / 5Y using Pandas.
// Writes results back to instrument_returns + listed_stocks (write_back=true).
// Falls back to null if Python is unavailable (service gracefully returns null).

async function fetchPythonReturns(nseSymbol: string): Promise<{ returns1M: number | null; returns6M: number | null; returns1Y: number | null }> {
  const empty = { returns1M: null, returns6M: null, returns1Y: null };
  try {
    const result = await callPython<{
      status: string;
      raw?: { return_1m: number | null; return_6m: number | null; return_1y: number | null };
    }>("/api/price-returns/compute", "POST", {
      symbol: nseSymbol.toUpperCase(),
      asset_class: "equity",
      write_back: true,
    });

    if (!result || result.status === "no_price_history" || result.status === "isin_not_found") {
      console.warn(`[ResearchNote] Python returns: ${result?.status ?? "unavailable"} for ${nseSymbol}`);
      return empty;
    }

    const raw = result.raw ?? {};
    const pf = (v: any) => (v !== null && v !== undefined && !isNaN(Number(v)) ? Number(v) : null);
    const returns = { returns1M: pf(raw.return_1m), returns6M: pf(raw.return_6m), returns1Y: pf(raw.return_1y) };
    console.log(
      `[ResearchNote] Python returns ${nseSymbol}: 1M=${returns.returns1M !== null ? (returns.returns1M * 100).toFixed(1) + "%" : "N/A"}, ` +
      `6M=${returns.returns6M !== null ? (returns.returns6M * 100).toFixed(1) + "%" : "N/A"}, ` +
      `1Y=${returns.returns1Y !== null ? (returns.returns1Y * 100).toFixed(1) + "%" : "N/A"}`
    );
    return returns;
  } catch (e: any) {
    console.warn(`[ResearchNote] Python returns fetch failed for ${nseSymbol}:`, e?.message?.slice(0, 80));
    return empty;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main data entry point — DB-first, API-on-miss pattern.
 * Returns both the financial data and metadata about which source was used.
 */
export async function getFinancialData(symbol: string): Promise<FinancialData & { _fundamentalsSource: FundamentalsSource }> {
  const cached = cache.get(symbol);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(`[ResearchNote] Cache HIT for ${symbol}`);
    return { ...(cached.data as any) };
  }

  const nseSymbol = toNseSymbol(symbol);

  // Step 1: Always fetch live price from NSE (fast, lightweight, has own 5-min cookie cache)
  // Step 2: Always read DB fundamentals (fast DB query — always do this)
  const [nseResult, dbResult] = await Promise.allSettled([
    fetchFromNSE(nseSymbol),
    fetchFromDB(nseSymbol),
  ]);

  const dbData: DBData =
    dbResult.status === "fulfilled" ? dbResult.value : {
      eps: null, bookValue: null, roe: null, roce: null, dividendYield: null,
      debtToEquity: null, revenueGrowth: null, earningsGrowth: null, beta: null,
      operatingCashFlow: null, freeCashFlow: null, revenue: null, netIncome: null,
      operatingMargin: null, returns1M: null, returns6M: null, returns1Y: null,
      lastUpdated: null,
    };

  // Step 3: DB-first decision — only scrape Screener.in if DB data is stale/missing
  let screener: ScreenerData = {
    roe: null, roce: null, dividendYield: null, bookValue: null,
    revenueGrowth: null, earningsGrowth: null, debtToEquity: null, pe: null, pb: null,
    revenue: null, netIncome: null, operatingCashFlow: null, freeCashFlow: null, operatingMargin: null,
  };

  let fundamentalsSource: FundamentalsSource;

  if (isDbFresh(dbData)) {
    // DB is fresh — use it directly, skip Screener.in scrape
    screener = {
      roe: dbData.roe,
      roce: dbData.roce,
      dividendYield: dbData.dividendYield,
      bookValue: dbData.bookValue,
      revenueGrowth: dbData.revenueGrowth,
      earningsGrowth: dbData.earningsGrowth,
      debtToEquity: dbData.debtToEquity,
      pe: null,
      pb: null,
      revenue: dbData.revenue,
      netIncome: dbData.netIncome,
      operatingCashFlow: dbData.operatingCashFlow,
      freeCashFlow: dbData.freeCashFlow,
      operatingMargin: dbData.operatingMargin,
    };
    const ageHours = dbData.lastUpdated
      ? Math.round((Date.now() - dbData.lastUpdated.getTime()) / 36000) / 100
      : null;
    fundamentalsSource = {
      source: "DB_CACHE",
      scrapedAt: dbData.lastUpdated?.toISOString() ?? null,
      ageHours,
    };
    console.log(`[ResearchNote] DB HIT (fresh) for ${nseSymbol} — fundamentals age: ${ageHours}h, skipping Screener.in`);
  } else {
    // DB is stale or empty — fetch from Screener.in
    const staleReason = !dbData.lastUpdated ? "no DB record" : `stale (${Math.round((Date.now() - dbData.lastUpdated.getTime()) / 3600000)}h old)`;
    console.log(`[ResearchNote] DB MISS (${staleReason}) for ${nseSymbol} — fetching from Screener.in`);
    const screenerResult = await fetchFromScreener(nseSymbol);
    screener = screenerResult;

    // Write-through to DB immediately (await to ensure persistence before returning)
    writeScreenerToDB(nseSymbol, screener).catch(() => {});

    fundamentalsSource = {
      source: "SCREENER_LIVE",
      scrapedAt: new Date().toISOString(),
      ageHours: 0,
    };
  }

  if (nseResult.status === "fulfilled" && nseResult.value.price !== null) {
    let data = buildFull(nseResult.value, dbData, screener);
    // Fetch price returns from NSE historical API when not in DB
    if (data.returns1M === null && data.returns6M === null && data.returns1Y === null) {
      const returns = await fetchPythonReturns(nseSymbol);
      data = { ...data, ...returns };
    }
    cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(
      `[ResearchNote] Fetched ${symbol} — ₹${data.price} | ROE:${data.roe !== null ? (data.roe * 100).toFixed(1) + "%" : "N/A"} | Rev:${data.revenue !== null ? "₹" + data.revenue.toFixed(0) + "Cr" : "N/A"} | OPM:${data.operatingMargin !== null ? (data.operatingMargin * 100).toFixed(1) + "%" : "N/A"} | src:${fundamentalsSource.source}`
    );
    return { ...data, _fundamentalsSource: fundamentalsSource };
  }

  console.warn(`[ResearchNote] NSE failed for ${nseSymbol}:`, (nseResult as any).reason?.message);

  // Fallback to Yahoo Finance
  for (const ySym of [`${nseSymbol}.NS`, `${nseSymbol}.BO`]) {
    try {
      console.log(`[ResearchNote] Yahoo fallback: ${ySym}`);
      const yData = await fetchFromYahoo(ySym);
      const data  = buildFull(yData, dbData, screener);
      cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return { ...data, _fundamentalsSource: fundamentalsSource };
    } catch (e: any) {
      if (isRateLimit(e)) {
        throw new Error("Financial data is temporarily unavailable. Please wait 60 seconds and try again.");
      }
      console.warn(`[ResearchNote] Yahoo failed for ${ySym}:`, e?.message);
    }
  }

  // Last resort: serve stale DB data with a price of null so the caller gets partial data
  if (dbData.roe !== null || dbData.bookValue !== null) {
    console.warn(`[ResearchNote] All live sources failed for ${nseSymbol} — serving stale DB data`);
    const staleData = buildFull({}, dbData, screener);
    return {
      ...staleData,
      _fundamentalsSource: {
        source: "DB_CACHE",
        scrapedAt: dbData.lastUpdated?.toISOString() ?? null,
        ageHours: dbData.lastUpdated ? Math.round((Date.now() - dbData.lastUpdated.getTime()) / 36000) / 100 : null,
      },
    };
  }

  throw new Error(`Could not fetch financial data for ${symbol}. Please try again.`);
}
