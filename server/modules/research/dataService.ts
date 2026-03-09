/**
 * Financial data service for Research Note Generator.
 *
 * Data sources (in priority order):
 *  1. NSE India public API   — price, PE, 52-week range, market cap, VWAP, Face Value
 *  2. Screener.in HTML scrape — ROE, ROCE, Dividend Yield, Book Value, Revenue/Earnings Growth, D/E
 *  3. FintekPro DB (screener_financials) — cached Screener.in enrichment from previous fetches
 *  4. Yahoo Finance quote()  — fallback for non-NSE or unknown symbols
 *
 * Write-through: after live Screener.in fetch, results are cached in DB for future requests.
 */

import yahooFinance from "yahoo-finance2";
import { db } from "../../db";
import { sql } from "drizzle-orm";

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
}

// ─── Caches ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000;
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

function extractTopMetric(html: string, label: string): number | null {
  // Matches: "ROE 8.40 %" or "Book Value ₹ 648" in the top metrics li items
  const re = new RegExp(`${label}[^<]*?([\\d,\\.]+)`, "i");
  const m = re.exec(html);
  return m ? parseNum(m[1]) : null;
}

function extractTableLastTwoRows(html: string, sectionId: string, rowLabel: string): [number | null, number | null] {
  const sectionStart = html.indexOf(`id="${sectionId}"`);
  if (sectionStart < 0) return [null, null];
  const sectionEnd = html.indexOf("</section>", sectionStart);
  const section = html.slice(sectionStart, sectionEnd > 0 ? sectionEnd : sectionStart + 40000);

  // Split by <tr> tags
  const rows = section.split(/<tr[^>]*>/i);
  for (const row of rows) {
    const nameMatch = row.match(/class="text"[^>]*>([\s\S]*?)<\/td>/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\+/g, "").trim();
    if (!name.toLowerCase().includes(rowLabel.toLowerCase())) continue;
    const cells = [...row.matchAll(/<td[^>]*>\s*([\d,\.]+)\s*<\/td>/g)].map(m => parseNum(m[1]));
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
  };

  try {
    // Step 1: Get the company URL
    const searchRes = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(nseSymbol)}`,
      { headers: { ...BROWSER_HEADERS, Accept: "application/json" }, signal: AbortSignal.timeout(10_000) }
    );
    if (!searchRes.ok) return empty;
    const results = await searchRes.json() as any[];
    if (!results?.length) return empty;

    // Prefer consolidated view
    const company = results.find((r: any) => r.url?.includes("consolidated")) ?? results[0];
    const companyUrl = `https://www.screener.in${company.url}`;

    // Step 2: Fetch the company page
    const pageRes = await fetch(companyUrl, {
      headers: { ...BROWSER_HEADERS, Referer: "https://www.screener.in/" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!pageRes.ok) return empty;
    const html = await pageRes.text();

    // Step 3: Parse top section (id="top") for key ratios
    const topStart = html.indexOf('id="top"');
    const topEnd   = html.indexOf("</section>", topStart);
    const topHtml  = topStart >= 0 ? html.slice(topStart, topEnd > 0 ? topEnd : topStart + 8000) : "";

    // Extract all <li> items from top section
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

    // Step 4: P&L table — extract Revenue and Net Profit for last 2 years
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

    // Step 5: Balance sheet — compute Debt/Equity
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
      `RevGrowth:${revenueGrowth !== null ? (revenueGrowth * 100).toFixed(1) + "%" : "N/A"}`,
      `EPS Growth:${earningsGrowth !== null ? (earningsGrowth * 100).toFixed(1) + "%" : "N/A"}`
    );

    return { roe, roce, dividendYield, bookValue, revenueGrowth, earningsGrowth, debtToEquity, pe, pb };
  } catch (e: any) {
    console.warn("[ResearchNote] Screener.in fetch failed:", e?.message);
    return empty;
  }
}

// ─── DB enrichment (read all cached fields) ───────────────────────────────────

interface DBData {
  eps: number | null;
  bookValue: number | null;
  roe: number | null;
  roce: number | null;
  dividendYield: number | null;
  debtToEquity: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  beta: number | null;
  operatingCashFlow: number | null;
  freeCashFlow: number | null;
  revenue: number | null;
  netIncome: number | null;
  operatingMargin: number | null;
  returns1M: number | null;
  returns6M: number | null;
  returns1Y: number | null;
}

async function fetchFromDB(nseSymbol: string): Promise<DBData> {
  const empty: DBData = {
    eps: null, bookValue: null, roe: null, roce: null, dividendYield: null,
    debtToEquity: null, revenueGrowth: null, earningsGrowth: null, beta: null,
    operatingCashFlow: null, freeCashFlow: null, revenue: null, netIncome: null,
    operatingMargin: null, returns1M: null, returns6M: null, returns1Y: null,
  };
  try {
    const rows = await db.execute(sql`
      SELECT sf.eps, sf.book_value, sf.roe, sf.roce, sf.dividend_yield,
             sf.debt_to_equity, sf.revenue_growth, sf.earnings_growth,
             sf.operating_cash_flow, sf.free_cash_flow,
             sf.revenue, sf.net_income, sf.operating_margin,
             ls.returns_1m, ls.returns_6m, ls.returns_1y
      FROM screener_financials sf
      LEFT JOIN listed_stocks ls ON ls.symbol = sf.symbol
      WHERE sf.symbol = ${nseSymbol.toUpperCase()}
      ORDER BY sf.fiscal_year DESC NULLS LAST, sf.last_updated DESC NULLS LAST
      LIMIT 1
    `);
    const r = ((rows as any).rows ?? rows)[0] as any;
    if (!r) {
      // Try listed_stocks only for returns
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
      beta:             null,
      operatingCashFlow: pf(r.operating_cash_flow),
      freeCashFlow:     pf(r.free_cash_flow),
      revenue:          pf(r.revenue),
      netIncome:        pf(r.net_income),
      operatingMargin:  pf(r.operating_margin),
      returns1M:        pf(r.returns_1m),
      returns6M:        pf(r.returns_6m),
      returns1Y:        pf(r.returns_1y),
    };
  } catch (e: any) {
    console.warn("[ResearchNote] DB read failed:", e?.message);
    return empty;
  }
}

// ─── DB write-back (cache Screener.in results) ───────────────────────────────

async function writeScreenerToDB(nseSymbol: string, s: ScreenerData): Promise<void> {
  try {
    // Only update rows that exist (don't create new ones)
    await db.execute(sql`
      UPDATE screener_financials
      SET
        roe            = COALESCE(${s.roe}, roe),
        roce           = COALESCE(${s.roce}, roce),
        dividend_yield = COALESCE(${s.dividendYield}, dividend_yield),
        book_value     = COALESCE(${s.bookValue}, book_value),
        revenue_growth = COALESCE(${s.revenueGrowth}, revenue_growth),
        earnings_growth= COALESCE(${s.earningsGrowth}, earnings_growth),
        debt_to_equity = COALESCE(${s.debtToEquity}, debt_to_equity),
        last_updated   = now()
      WHERE symbol = ${nseSymbol.toUpperCase()}
        AND fiscal_year = (
          SELECT MAX(fiscal_year) FROM screener_financials
          WHERE symbol = ${nseSymbol.toUpperCase()}
        )
    `);
  } catch (e: any) {
    console.warn("[ResearchNote] DB write-back failed:", e?.message);
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

  // ROE: Screener.in (real) > DB > derived from EPS/BookValue
  const roe =
    screener.roe ??
    dbData.roe ??
    (() => {
      const eps = dbData.eps ?? base.eps ?? null;
      const bv  = screener.bookValue ?? dbData.bookValue ?? null;
      return eps !== null && bv !== null && bv > 0 ? eps / bv : null;
    })();

  // Book Value: Screener.in (more accurate) > DB
  const bookValue = screener.bookValue ?? dbData.bookValue ?? null;

  // P/B: Price / BookValue
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
    operatingCashFlow: dbData.operatingCashFlow ?? null,
    freeCashFlow:   dbData.freeCashFlow ?? null,
    revenue:        dbData.revenue ?? null,
    netIncome:      dbData.netIncome ?? null,
    operatingMargin: dbData.operatingMargin ?? null,
    returns1M:      dbData.returns1M ?? null,
    returns6M:      dbData.returns6M ?? null,
    returns1Y:      dbData.returns1Y ?? null,
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

  // Fire all three sources in parallel
  const [nseResult, dbResult, screenerResult] = await Promise.allSettled([
    fetchFromNSE(nseSymbol),
    fetchFromDB(nseSymbol),
    fetchFromScreener(nseSymbol),
  ]);

  const dbData: DBData =
    dbResult.status === "fulfilled" ? dbResult.value : {
      eps: null, bookValue: null, roe: null, roce: null, dividendYield: null,
      debtToEquity: null, revenueGrowth: null, earningsGrowth: null, beta: null,
    };

  const screener: ScreenerData =
    screenerResult.status === "fulfilled" ? screenerResult.value : {
      roe: null, roce: null, dividendYield: null, bookValue: null,
      revenueGrowth: null, earningsGrowth: null, debtToEquity: null,
    };

  // Write Screener.in results back to DB asynchronously (non-blocking)
  if (screenerResult.status === "fulfilled") {
    writeScreenerToDB(nseSymbol, screener).catch(() => {});
  }

  if (nseResult.status === "fulfilled" && nseResult.value.price !== null) {
    const data = buildFull(nseResult.value, dbData, screener);
    cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    console.log(
      `[ResearchNote] Fetched ${symbol} — ₹${data.price} | ROE:${data.roe !== null ? (data.roe * 100).toFixed(1) + "%" : "N/A"} | D/E:${data.debtToEquity ?? "N/A"} | RevG:${data.revenueGrowth !== null ? (data.revenueGrowth * 100).toFixed(1) + "%" : "N/A"}`
    );
    return data;
  }

  console.warn(`[ResearchNote] NSE failed for ${nseSymbol}:`, (nseResult as any).reason?.message);

  // Fallback to Yahoo Finance
  for (const ySym of [`${nseSymbol}.NS`, `${nseSymbol}.BO`]) {
    try {
      console.log(`[ResearchNote] Yahoo fallback: ${ySym}`);
      const yData = await fetchFromYahoo(ySym);
      const data  = buildFull(yData, dbData, screener);
      cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } catch (e: any) {
      if (isRateLimit(e)) {
        throw new Error("Financial data is temporarily unavailable. Please wait 60 seconds and try again.");
      }
      console.warn(`[ResearchNote] Yahoo failed for ${ySym}:`, e?.message);
    }
  }

  throw new Error(`Could not fetch financial data for ${symbol}. Please try again.`);
}
