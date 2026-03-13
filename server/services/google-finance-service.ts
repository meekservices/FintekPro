/**
 * Google Finance Data Service
 * Provides stock price quotes and key metrics for Indian stocks (NSE/BSE)
 * via Google Finance HTML parsing and the legacy JSONP info endpoint.
 *
 * Strategy waterfall (tried in order):
 *   1. finance.google.com/finance/info  — legacy JSONP (fast, low overhead)
 *   2. www.google.com/finance/quote     — HTML parsing with embedded JSON blob
 *
 * Used as a fallback between BSE and Yahoo Finance in the price waterfall,
 * and between FMP and Yahoo Finance in the metrics waterfall.
 */

import * as cheerio from 'cheerio';

const GF_TIMEOUT_MS = 12_000;
const JSONP_TIMEOUT_MS = 6_000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'en-IN,en;q=0.9',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

export interface GFQuote {
  symbol: string;
  price: number;
  change?: number | null;
  changePercent?: number | null;
  previousClose?: number | null;
  source: 'google_finance_jsonp' | 'google_finance_html';
}

export interface GFMetrics {
  pe?: number | null;
  pb?: number | null;
  marketCap?: number | null;
  high52w?: number | null;
  low52w?: number | null;
  dividendYield?: number | null;
  eps?: number | null;
  source: 'google_finance';
}

function safeFloat(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[,₹%\s]/g, '').trim();
  if (!s || s === '-' || s === 'N/A') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ─── Strategy 1: Legacy JSONP endpoint ────────────────────────────────────────

async function tryJsonp(symbol: string, exchange: string): Promise<GFQuote | null> {
  const url = `https://finance.google.com/finance/info?client=ig&q=${exchange}:${symbol}`;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(JSONP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    let text = (await res.text()).trim();
    if (text.startsWith('//')) text = text.slice(2).trim();
    const data = JSON.parse(text);
    if (!Array.isArray(data) || !data[0]) return null;
    const item = data[0];
    const price = safeFloat(item.l_fix ?? item.l);
    if (!price) return null;
    return {
      symbol,
      price,
      change: safeFloat(item.c_fix ?? item.c),
      changePercent: safeFloat(item.cp_fix ?? item.cp),
      previousClose: safeFloat(item.pcls_fix),
      source: 'google_finance_jsonp',
    };
  } catch {
    return null;
  }
}

// ─── Strategy 2: HTML page parsing ────────────────────────────────────────────

const PRICE_PATTERNS = [
  /"PRICE":\[\d+,([\d,]+(?:\.\d+)?)/,
  /"LAST_PRICE":\[\d+,([\d,]+(?:\.\d+)?)/,
];

const CHANGE_PATTERNS = [
  /"CHANGE":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
  /"DAY_CHANGE":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
];

const CHANGE_PCT_PATTERNS = [
  /"CHANGE_PERCENT":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
  /"DAY_CHANGE_PERCENT":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
];

const PE_PATTERNS = [
  /"PE_RATIO":\[\d+,([\d,]+(?:\.\d+)?)/,
  /"PRICE_EARNINGS_RATIO":\[\d+,([\d,]+(?:\.\d+)?)/,
];

const PB_PATTERNS = [
  /"PRICE_TO_BOOK":\[\d+,([\d,]+(?:\.\d+)?)/,
  /"PB_RATIO":\[\d+,([\d,]+(?:\.\d+)?)/,
];

const MKTCAP_PATTERNS = [
  /"MARKET_CAP":\[\d+,([\d,]+(?:\.\d+)?)/,
  /"MKTCAP":\[\d+,([\d,]+(?:\.\d+)?)/,
];

const HIGH52_PATTERNS = [/"HIGH_52_WEEKS":\[\d+,([\d,]+(?:\.\d+)?)/];
const LOW52_PATTERNS = [/"LOW_52_WEEKS":\[\d+,([\d,]+(?:\.\d+)?)/];
const DIVYIELD_PATTERNS = [/"DIVIDEND_YIELD":\[\d+,([\d,]+(?:\.\d+)?)/];
const EPS_PATTERNS = [
  /"EPS":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
  /"EARNINGS_PER_SHARE":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
];

function extractFirst(html: string, patterns: RegExp[]): number | null {
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const v = safeFloat(m[1]);
      if (v !== null && v > 0) return v;
    }
  }
  return null;
}

function extractSigned(html: string, patterns: RegExp[]): number | null {
  for (const pat of patterns) {
    const m = html.match(pat);
    if (m) {
      const v = safeFloat(m[1]);
      if (v !== null) return v;
    }
  }
  return null;
}

async function fetchHtml(symbol: string, exchange: string): Promise<string | null> {
  const url = `https://www.google.com/finance/quote/${symbol}:${exchange}`;
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(GF_TIMEOUT_MS),
    });
    if (res.ok) return await res.text();
  } catch { /* silent */ }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a live price quote for an Indian stock from Google Finance.
 * Tries JSONP first (faster), then falls back to HTML parsing.
 * For NSE symbols, also retries with BOM exchange code if NSE fails.
 */
export async function fetchGFQuote(
  symbol: string,
  exchange: 'NSE' | 'BSE' = 'NSE',
): Promise<GFQuote | null> {
  const gfExchange = exchange === 'BSE' ? 'BOM' : 'NSE';

  let result = await tryJsonp(symbol, gfExchange);
  if (result?.price) return result;

  if (gfExchange === 'NSE') {
    result = await tryJsonp(symbol, 'BOM');
    if (result?.price) return result;
  }

  let html = await fetchHtml(symbol, gfExchange);
  if (!html && gfExchange === 'NSE') {
    html = await fetchHtml(symbol, 'BOM');
  }

  if (html) {
    const price = extractFirst(html, PRICE_PATTERNS);
    if (price) {
      return {
        symbol,
        price,
        change: extractSigned(html, CHANGE_PATTERNS),
        changePercent: extractSigned(html, CHANGE_PCT_PATTERNS),
        source: 'google_finance_html',
      };
    }
  }

  return null;
}

/**
 * Fetch key financial metrics for an Indian stock from Google Finance HTML.
 * Returns PE, PB, market cap, 52-week range, dividend yield, EPS.
 */
export async function fetchGFMetrics(
  symbol: string,
  exchange: 'NSE' | 'BSE' = 'NSE',
): Promise<GFMetrics | null> {
  const gfExchange = exchange === 'BSE' ? 'BOM' : 'NSE';

  let html = await fetchHtml(symbol, gfExchange);
  if (!html && gfExchange === 'NSE') {
    html = await fetchHtml(symbol, 'BOM');
  }
  if (!html) return null;

  const pe = extractFirst(html, PE_PATTERNS);
  const pb = extractFirst(html, PB_PATTERNS);
  const marketCap = extractFirst(html, MKTCAP_PATTERNS);
  const high52w = extractFirst(html, HIGH52_PATTERNS);
  const low52w = extractFirst(html, LOW52_PATTERNS);
  const dividendYield = extractFirst(html, DIVYIELD_PATTERNS);
  const eps = extractSigned(html, EPS_PATTERNS);

  if (!pe && !pb && !marketCap && !high52w && !low52w) {
    return null;
  }

  return {
    pe: pe ?? null,
    pb: pb ?? null,
    marketCap: marketCap ?? null,
    high52w: high52w ?? null,
    low52w: low52w ?? null,
    dividendYield: dividendYield ?? null,
    eps: eps ?? null,
    source: 'google_finance',
  };
}

/**
 * Test connectivity to Google Finance.
 * Returns { ok: boolean, latencyMs: number }.
 */
export async function testGFConnectivity(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = Date.now();
  try {
    const res = await fetch(
      'https://finance.google.com/finance/info?client=ig&q=NSE:RELIANCE',
      { headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8_000) },
    );
    return { ok: res.ok, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}
