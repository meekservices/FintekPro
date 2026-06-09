/**
 * Google Finance Data Service
 *
 * Confirmed working from datacenter:
 *   www.google.com/finance/quote/SYMBOL:NSE  → stock quotes with timestamp
 *   www.google.com/finance/quote/SENSEX:INDEXBOM → BSE SENSEX
 *
 * Dead / blocked from datacenter:
 *   finance.google.com/finance/info (JSONP) → 404 (removed)
 *   BSE API direct → 301 blocked
 *   Yahoo Finance quote() → 429 Too Many Requests (use as last resort only)
 *
 * Load-sharing role:
 *   PRIMARY for: SENSEX, individual BSE stock quotes
 *   SECONDARY for: individual NSE stock quotes (after NSE library)
 *   METRICS: PE, PB, market cap, 52-week H/L, dividend yield, EPS
 */

import * as cheerio from "cheerio";

const GF_TIMEOUT_MS = 10_000;

export const BROWSER_HEADERS = {
	"User-Agent":
		"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
	"Accept-Language": "en-IN,en;q=0.9",
	Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	"Accept-Encoding": "gzip, deflate, br",
};

export interface GFQuote {
	symbol: string;
	price: number;
	change?: number | null;
	changePercent?: number | null;
	previousClose?: number | null;
	/** Unix timestamp in seconds from exchange (data-last-normal-market-timestamp) */
	marketTimestampUnix?: number | null;
	source: "google_finance";
}

export interface GFMetrics {
	pe?: number | null;
	pb?: number | null;
	marketCap?: number | null;
	high52w?: number | null;
	low52w?: number | null;
	dividendYield?: number | null;
	eps?: number | null;
	source: "google_finance";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeFloat(v: string | number | null | undefined): number | null {
	if (v == null) return null;
	const s = String(v)
		.replace(/[,₹%\s]/g, "")
		.trim();
	if (!s || s === "-" || s === "N/A") return null;
	const n = Number.parseFloat(s);
	return Number.isNaN(n) ? null : n;
}

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

// ─── HTML patterns (from embedded JSON blob in Google Finance page) ───────────

const PATTERNS = {
	price: [
		/"PRICE":\[\d+,([\d,]+(?:\.\d+)?)/,
		/"LAST_PRICE":\[\d+,([\d,]+(?:\.\d+)?)/,
	],
	change: [
		/"CHANGE":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
		/"DAY_CHANGE":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
	],
	changePct: [
		/"CHANGE_PERCENT":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
		/"DAY_CHANGE_PERCENT":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
	],
	pe: [
		/"PE_RATIO":\[\d+,([\d,]+(?:\.\d+)?)/,
		/"PRICE_EARNINGS_RATIO":\[\d+,([\d,]+(?:\.\d+)?)/,
	],
	pb: [
		/"PRICE_TO_BOOK":\[\d+,([\d,]+(?:\.\d+)?)/,
		/"PB_RATIO":\[\d+,([\d,]+(?:\.\d+)?)/,
	],
	marketCap: [
		/"MARKET_CAP":\[\d+,([\d,]+(?:\.\d+)?)/,
		/"MKTCAP":\[\d+,([\d,]+(?:\.\d+)?)/,
	],
	high52w: [/"HIGH_52_WEEKS":\[\d+,([\d,]+(?:\.\d+)?)/],
	low52w: [/"LOW_52_WEEKS":\[\d+,([\d,]+(?:\.\d+)?)/],
	divYield: [/"DIVIDEND_YIELD":\[\d+,([\d,]+(?:\.\d+)?)/],
	eps: [
		/"EPS":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
		/"EARNINGS_PER_SHARE":\[\d+,(-?[\d,]+(?:\.\d+)?)/,
	],
};

// ─── Core fetch ───────────────────────────────────────────────────────────────

async function fetchGFPage(
	gfSymbol: string,
	gfExchange: string,
): Promise<string | null> {
	const url = `https://www.google.com/finance/quote/${gfSymbol}:${gfExchange}`;
	try {
		const res = await fetch(url, {
			headers: BROWSER_HEADERS,
			signal: AbortSignal.timeout(GF_TIMEOUT_MS),
		});
		if (res.ok) return await res.text();
	} catch {
		/* silent */
	}
	return null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a live quote from Google Finance HTML.
 * For NSE symbols, retries with BOM if NSE returns no price.
 * Returns null if the page is unreachable or price cannot be parsed.
 *
 * dataQuality = "third_party" (BSE/NSE data via Google Finance proxy)
 */
export async function fetchGFQuote(
	symbol: string,
	exchange: "NSE" | "BSE" = "NSE",
): Promise<GFQuote | null> {
	const gfExchange = exchange === "BSE" ? "BOM" : "NSE";

	let html = await fetchGFPage(symbol, gfExchange);

	// For NSE symbols try BOM if NSE page has no data
	if (!html && gfExchange === "NSE") {
		html = await fetchGFPage(symbol, "BOM");
	}

	if (!html) return null;

	// Primary: data-last-price attribute (fast, reliable for indices and stocks)
	const attrPriceMatch = html.match(/data-last-price="([0-9.]+)"/);
	const attrTsMatch = html.match(
		/data-last-normal-market-timestamp="([0-9]+)"/,
	);
	const attrPrice = attrPriceMatch
		? Number.parseFloat(attrPriceMatch[1])
		: null;

	const price =
		attrPrice && attrPrice > 0 ? attrPrice : extractFirst(html, PATTERNS.price);
	if (!price) return null;

	const change = extractSigned(html, PATTERNS.change);
	const changePct = extractSigned(html, PATTERNS.changePct);
	const tsUnix = attrTsMatch ? Number.parseInt(attrTsMatch[1], 10) : null;

	return {
		symbol,
		price,
		change,
		changePercent: changePct,
		previousClose:
			price && change ? Number.parseFloat((price - change).toFixed(2)) : null,
		marketTimestampUnix: tsUnix,
		source: "google_finance",
	};
}

/**
 * Fetch a live quote from Google Finance for any explicit exchange string.
 * Used for US stocks/ETFs (NASDAQ, NYSE, NYSEARCA, etc.).
 * Returns null if the page is unreachable or price cannot be parsed.
 *
 * dataQuality = "third_party"
 */
export async function fetchGFQuoteUS(
	symbol: string,
	gfExchange: string,
): Promise<GFQuote | null> {
	const html = await fetchGFPage(symbol, gfExchange);
	if (!html) return null;

	const attrPriceMatch = html.match(/data-last-price="([0-9.]+)"/);
	const attrTsMatch = html.match(
		/data-last-normal-market-timestamp="([0-9]+)"/,
	);
	const attrPrice = attrPriceMatch
		? Number.parseFloat(attrPriceMatch[1])
		: null;

	const price =
		attrPrice && attrPrice > 0 ? attrPrice : extractFirst(html, PATTERNS.price);
	if (!price) return null;

	const change = extractSigned(html, PATTERNS.change);
	const changePct = extractSigned(html, PATTERNS.changePct);
	const tsUnix = attrTsMatch ? Number.parseInt(attrTsMatch[1], 10) : null;

	return {
		symbol,
		price,
		change,
		changePercent: changePct,
		previousClose:
			price && change ? Number.parseFloat((price - change).toFixed(2)) : null,
		marketTimestampUnix: tsUnix,
		source: "google_finance",
	};
}

/**
 * Fetch key financial metrics for a stock via Google Finance HTML.
 * PE, PB, market cap, 52-week range, dividend yield, EPS.
 */
export async function fetchGFMetrics(
	symbol: string,
	exchange: "NSE" | "BSE" = "NSE",
): Promise<GFMetrics | null> {
	const gfExchange = exchange === "BSE" ? "BOM" : "NSE";

	let html = await fetchGFPage(symbol, gfExchange);
	if (!html && gfExchange === "NSE") {
		html = await fetchGFPage(symbol, "BOM");
	}
	if (!html) return null;

	const pe = extractFirst(html, PATTERNS.pe);
	const pb = extractFirst(html, PATTERNS.pb);
	const marketCap = extractFirst(html, PATTERNS.marketCap);
	const high52w = extractFirst(html, PATTERNS.high52w);
	const low52w = extractFirst(html, PATTERNS.low52w);
	const divYield = extractFirst(html, PATTERNS.divYield);
	const eps = extractSigned(html, PATTERNS.eps);

	if (!pe && !pb && !marketCap && !high52w && !low52w) return null;

	return {
		pe: pe ?? null,
		pb: pb ?? null,
		marketCap: marketCap ?? null,
		high52w: high52w ?? null,
		low52w: low52w ?? null,
		dividendYield: divYield ?? null,
		eps: eps ?? null,
		source: "google_finance",
	};
}

/**
 * Test connectivity to Google Finance HTML endpoint.
 */
export async function testGFConnectivity(): Promise<{
	ok: boolean;
	latencyMs: number;
}> {
	const start = Date.now();
	try {
		const res = await fetch(
			"https://www.google.com/finance/quote/RELIANCE:NSE",
			{ headers: BROWSER_HEADERS, signal: AbortSignal.timeout(8_000) },
		);
		return { ok: res.ok, latencyMs: Date.now() - start };
	} catch {
		return { ok: false, latencyMs: Date.now() - start };
	}
}
