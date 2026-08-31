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
import { logger } from "../../logger";


export interface FinancialData {
	price: number | null;
	previousClose: number | null;
	marketCap: number | null; // absolute ₹ rupees
	pe: number | null;
	eps: number | null;
	roe: number | null; // decimal fraction (0.084 = 8.4%)
	roce: number | null; // decimal fraction
	pbRatio: number | null; // Price / Book Value
	debtToEquity: number | null;
	revenueGrowth: number | null; // decimal fraction (0.064 = 6.4%)
	earningsGrowth: number | null; // decimal fraction
	fiftyTwoWeekHigh: number | null;
	fiftyTwoWeekLow: number | null;
	dividendYield: number | null; // decimal fraction (0.0039 = 0.39%)
	beta: number | null;
	targetMeanPrice: number | null;
	currency: string;
	bookValue: number | null;
	faceValue: number | null;
	vwap: number | null;
	// Extended fields from screener_financials
	operatingCashFlow: number | null; // absolute ₹ crores
	freeCashFlow: number | null; // absolute ₹ crores
	revenue: number | null; // absolute ₹ crores
	netIncome: number | null; // absolute ₹ crores
	operatingMargin: number | null; // decimal fraction
	// Price returns from listed_stocks
	returns1M: number | null; // decimal fraction
	returns6M: number | null;
	returns1Y: number | null;
}

// ─── Screener data shape ──────────────────────────────────────────────────────

export interface HistoricalTable {
	headers: string[];
	rows: { label: string; values: (number | null)[] }[];
}

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
	operatingMargin: number | null; // decimal fraction
	marketCapCr: number | null; // Market Cap in ₹ Crores — scraped from Screener.in #top section
	// Extended historical data
	plHistory: HistoricalTable | null;
	bsHistory: HistoricalTable | null;
	cfHistory: HistoricalTable | null;
	ratiosHistory: HistoricalTable | null;
	quarterlyHistory: HistoricalTable | null;
	companyDescription: string | null;
	salesCagr3Y: number | null;
	salesCagr5Y: number | null;
	profitCagr3Y: number | null;
	profitCagr5Y: number | null;
	pros: string[];
	cons: string[];
}

// ─── Data quality metadata ────────────────────────────────────────────────────

export interface FundamentalsSource {
	source: "DB_CACHE" | "SCREENER_LIVE" | "PYTHON_YFINANCE" | "NONE";
	scrapedAt: string | null; // ISO timestamp of when DB data was last written
	ageHours: number | null; // how stale the DB data is
}

// ─── Caches ───────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 15 * 60 * 1000;

// ─── Filing-driven cache strategy (Screener.in approach) ─────────────────────
//
//  Screener.in does not use a fixed TTL. Instead, they invalidate data only
//  when a company actually files new results with BSE/NSE. We replicate this by:
//
//   1. Storing the latest quarter label from quarterlyHistory (e.g. "Dec 2025")
//      alongside each cached record.
//   2. Computing the "expected latest filed quarter" from today's date using
//      SEBI LODR deadlines (45 days for quarterly, 60 days for annual).
//   3. Cache is VALID as long as cachedQuarter >= expectedQuarter.
//      No time limit is needed when a company has filed the expected quarter.
//
//  SEBI LODR filing deadlines (mandatory):
//   Q3 (Oct-Dec): Feb 14  → expect "Dec YYYY-1" after Feb 14
//   Q4+Annual (Jan-Mar): May 30 → expect "Mar YYYY" after May 30
//   Q1 (Apr-Jun): Aug 14  → expect "Jun YYYY" after Aug 14
//   Q2 (Jul-Sep): Nov 14  → expect "Sep YYYY" after Nov 14
//
//  DB freshness (when to re-scrape Screener.in for metric updates):
//   During active filing window (within 45 days of quarter end): 6 hours
//   Outside filing window (data frozen): 48 hours

const QUARTER_MONTHS: Record<string, number> = {
	Jan: 1,
	Feb: 2,
	Mar: 3,
	Apr: 4,
	May: 5,
	Jun: 6,
	Jul: 7,
	Aug: 8,
	Sep: 9,
	Oct: 10,
	Nov: 11,
	Dec: 12,
};

/** Convert a Screener.in quarter label (e.g. "Dec 2025") to a comparable score. */
function qtrScore(label: string): number | null {
	const parts = label.trim().split(/\s+/);
	if (parts.length !== 2) return null;
	const m = QUARTER_MONTHS[parts[0]];
	const y = Number.parseInt(parts[1], 10);
	if (!m || Number.isNaN(y)) return null;
	return y * 100 + m;
}

/**
 * Returns the quarter-score we expect to be filed as of `now`.
 * Based on SEBI LODR mandatory deadlines.
 *
 * Timeline (using 2026 as example year):
 *   Jan 1 – Feb 13   → expect Sep 2025 (Q2, deadline was Nov 14)
 *   Feb 14 – May 29  → expect Dec 2025 (Q3, deadline Feb 14)
 *   May 30 – Aug 13  → expect Mar 2026 (Q4+Annual, deadline May 30)
 *   Aug 14 – Nov 13  → expect Jun 2026 (Q1, deadline Aug 14)
 *   Nov 14 – Dec 31  → expect Sep 2026 (Q2, deadline Nov 14)
 */
function expectedQtrScore(now: Date = new Date()): number {
	const m = now.getMonth() + 1;
	const d = now.getDate();
	const y = now.getFullYear();

	// Before Feb 14: Q3 not yet due; last filed = Q2 Sep of previous year
	if (m === 1 || (m === 2 && d < 14)) return (y - 1) * 100 + 9;
	// Feb 14 – May 29: Q3 filed; expect Dec of previous year
	if (m < 5 || (m === 5 && d < 30)) return (y - 1) * 100 + 12;
	// May 30 – Aug 13: Q4+Annual filed; expect Mar of current year
	if (m < 8 || (m === 8 && d < 14)) return y * 100 + 3;
	// Aug 14 – Nov 13: Q1 filed; expect Jun of current year
	if (m < 11 || (m === 11 && d < 14)) return y * 100 + 6;
	// Nov 14 onwards: Q2 filed; expect Sep of current year
	return y * 100 + 9;
}

/** Describes the current filing window — used only for DB re-scrape frequency. */
function dbFreshnessHours(now: Date = new Date()): number {
	const m = now.getMonth() + 1;
	const d = now.getDate();
	// Active filing windows: Jan–Feb 14, May–Jun, Jul–Aug 14, Oct–Nov 14
	const inWindow =
		m <= 2 || // Q3 season: Jan–Feb
		(m >= 4 && m <= 6) || // Q4+Annual: Apr–Jun
		m === 7 ||
		m === 8 || // Q1 season: Jul–Aug
		m === 10 ||
		(m === 11 && d < 14); // Q2 season: Oct–Nov 14
	return inWindow ? 6 : 48;
}

const cache = new Map<string, { data: FinancialData; expiresAt: number }>();

// HistoricalSlice includes the filed quarter label so cache validity can be
// checked against SEBI deadline expectations without using a fixed TTL.
interface HistoricalSlice {
	plHistory: HistoricalTable | null;
	bsHistory: HistoricalTable | null;
	cfHistory: HistoricalTable | null;
	ratiosHistory: HistoricalTable | null;
	quarterlyHistory: HistoricalTable | null;
	companyDescription: string | null;
	salesCagr3Y: number | null;
	salesCagr5Y: number | null;
	profitCagr3Y: number | null;
	profitCagr5Y: number | null;
	pros: string[];
	cons: string[];
	/** Latest quarterly result label present in this slice, e.g. "Dec 2025". */
	latestQtr: string | null;
}

// histCache: no TTL-based expiry; validity is determined by filing-driven check.
// Safety cap of 90 days prevents indefinite retention if quarter labels can't be parsed.
const HIST_SAFETY_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const histCache = new Map<
	string,
	{ data: HistoricalSlice; expiresAt: number }
>();

/**
 * Extract the latest quarter label from a quarterly history table.
 * Headers are ordered oldest → newest (e.g. ["Dec 2024","Mar 2025","Dec 2025"]).
 * Returns the last header that looks like a valid quarter label.
 */
function extractLatestQtr(qt: HistoricalTable | null): string | null {
	if (!qt?.headers?.length) return null;
	// Walk backwards to find the first valid quarter label
	for (let i = qt.headers.length - 1; i >= 0; i--) {
		const h = qt.headers[i];
		if (qtrScore(h) !== null) return h;
	}
	return null;
}

/**
 * Filing-driven cache validity check (Screener.in strategy).
 *
 * Cache is VALID when the data's latestQtr score >= what SEBI deadlines say
 * should be filed by now.  No TTL needed for stable periods — data is frozen
 * until the next results are filed.
 *
 * Falls back to TTL-based check (90-day safety cap) if latestQtr is unavailable.
 */
function isHistCacheValid(entry: {
	data: HistoricalSlice;
	expiresAt: number;
}): boolean {
	// Safety TTL always applies
	if (entry.expiresAt <= Date.now()) return false;

	const { latestQtr } = entry.data;
	if (!latestQtr) return false; // no quarter label → can't validate filing status

	const cached = qtrScore(latestQtr);
	const expected = expectedQtrScore();
	if (cached === null) return false;

	// Valid as long as we have at least the expected quarter
	return cached >= expected;
}

function getHistCached(symbol: string): HistoricalSlice | null {
	const entry = histCache.get(symbol);
	if (!entry) return null;
	if (isHistCacheValid(entry)) return entry.data;
	histCache.delete(symbol); // stale — remove so next request re-fetches
	return null;
}

function setHistCache(symbol: string, data: HistoricalSlice): void {
	histCache.set(symbol, { data, expiresAt: Date.now() + HIST_SAFETY_TTL_MS });
	const exp = expectedQtrScore();
	const cached = data.latestQtr ? qtrScore(data.latestQtr) ?? "?" : "unknown";
	const valid = data.latestQtr && typeof cached === "number" && cached >= exp;
	logger.info(
		`[ResearchNote] histCache SET for ${symbol} | latestQtr="${data.latestQtr ?? "none"}" | ` +
			`expected≥${exp} | filing-valid=${valid} | safety-cap=90d`,
	);
}

function screenerToHistSlice(s: ScreenerData): HistoricalSlice {
	return {
		plHistory: s.plHistory,
		bsHistory: s.bsHistory,
		cfHistory: s.cfHistory,
		ratiosHistory: s.ratiosHistory,
		quarterlyHistory: s.quarterlyHistory,
		companyDescription: s.companyDescription,
		salesCagr3Y: s.salesCagr3Y,
		salesCagr5Y: s.salesCagr5Y,
		profitCagr3Y: s.profitCagr3Y,
		profitCagr5Y: s.profitCagr5Y,
		pros: s.pros ?? [],
		cons: s.cons ?? [],
		latestQtr: extractLatestQtr(s.quarterlyHistory),
	};
}

function applyHistSlice(s: ScreenerData, hist: HistoricalSlice): ScreenerData {
	return { ...s, ...hist };
}

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
		const res = await fetch("https://www.nseindia.com", {
			headers: BROWSER_HEADERS,
		});
		const setCookie = res.headers.get("set-cookie") ?? "";
		if (setCookie) {
			nseCookies = setCookie
				.split(",")
				.map((c) => c.split(";")[0])
				.join("; ");
			nseCookieExpiry = Date.now() + 5 * 60 * 1000;
		}
	} catch (e: any) {
		logger.warn("[ResearchNote] NSE cookie refresh failed:", e?.message);
	}
}

/** Returns NSE-compatible request headers (with live cookie) for use by other modules. */
export async function getSharedNseHeaders(): Promise<Record<string, string>> {
	await refreshNseCookies();
	return {
		...BROWSER_HEADERS,
		Cookie: nseCookies,
		Referer: "https://www.nseindia.com/",
		Accept: "application/json",
	};
}

async function fetchFromNSE(
	nseSymbol: string,
): Promise<Partial<FinancialData>> {
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
	const d = (await res.json()) as any;
	const pi = d.priceInfo ?? {};
	const meta = d.metadata ?? {};
	const sec = d.securityInfo ?? {};
	const whl = pi.weekHighLow ?? {};
	const issuedSize: number | null = sec.issuedSize ?? null;
	const pfNse = (v: any): number | null => {
		if (v === null || v === undefined) return null;
		const n = typeof v === "number" ? v : Number.parseFloat(v);
		return Number.isFinite(n) ? n : null;
	};
	const lastPrice = pfNse(pi.lastPrice);
	const prevClose = pfNse(pi.previousClose);
	// NSE returns lastPrice=0 for InvITs/REITs when market is closed — fall back to previousClose
	const price: number | null =
		lastPrice && lastPrice > 0
			? lastPrice
			: prevClose && prevClose > 0
				? prevClose
				: null;
	// Bug 2 fix: market_cap_value stores absolute ₹ (price × issued shares).
	// issuedSize from NSE is a raw share count (e.g. 2,300,000,000 for 2.3B shares).
	// Resulting market cap is absolute ₹ (e.g. ₹1.67T). NOT in crores.
	const marketCap: number | null =
		price !== null && issuedSize !== null && issuedSize > 0
			? price * issuedSize
			: null;
	return {
		price,
		previousClose: prevClose,
		marketCap,
		pe: pfNse(meta.pdSymbolPe),
		fiftyTwoWeekHigh: pfNse(whl.max),
		fiftyTwoWeekLow: pfNse(whl.min),
		faceValue: pfNse(sec.faceValue),
		// NSE returns vwap=0 for InvITs/REITs when market is closed — fall back to previousClose
		vwap:
			pfNse(pi.vwap) && (pfNse(pi.vwap) ?? 0) > 0
				? pfNse(pi.vwap)
				: prevClose && prevClose > 0
					? prevClose
					: null,
		currency: "INR",
	};
}


// ─── Moneycontrol Price API ───────────────────────────────────────────────────
/**
 * Fetches live price data from the Moneycontrol Price API.
 * No API key required. Accessible from GCP Cloud Run (query1.finance.google.com
 * is DNS-blocked from Cloud Run; Moneycontrol returns HTTP 200).
 *
 * Endpoint: https://priceapi.moneycontrol.com/pricefeed/nse/equitycash/{symbol}
 * Returns: price, marketCap, 52W high/low, bookValue, PE, faceValue
 *
 * @param nseSymbol - NSE ticker without suffix (e.g. "RELIANCE")
 * @param exchange  - "nse" | "bse" (default: "nse")
 */
async function fetchFromMoneycontrol(
	nseSymbol: string,
	exchange: "nse" | "bse" = "nse",
): Promise<Partial<FinancialData>> {
	const sym = nseSymbol.toUpperCase();
	const segment = exchange === "bse" ? "bse/equitycash" : "nse/equitycash";
	const url = `https://priceapi.moneycontrol.com/pricefeed/${segment}/${encodeURIComponent(sym)}`;

	const res = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
			Accept: "application/json, text/plain, */*",
			Referer: "https://www.moneycontrol.com/",
		},
		signal: AbortSignal.timeout(8_000),
	});

	if (!res.ok) throw new Error(`Moneycontrol HTTP ${res.status} for ${sym}`);

	const body = (await res.json()) as any;
	if (body?.code !== "200" && body?.message !== "Success")
		throw new Error(`Moneycontrol: ${body?.message ?? "bad response"} for ${sym}`);

	const d = body?.data ?? {};
	const pf = (v: any): number | null => {
		if (v === null || v === undefined || v === "" || v === "N/A") return null;
		const n = typeof v === "number" ? v : Number.parseFloat(String(v).replace(/,/g, ""));
		return Number.isFinite(n) && n > 0 ? n : null;
	};

	const price = pf(d.pricecurrent);

	// Bug 2 fix: Moneycontrol MKTCAP is in Crores — convert to absolute ₹
	// so market_cap_value is always stored as absolute ₹ (consistent with NSE).
	const mktCapCr = pf(d.MKTCAP);
	const marketCap = mktCapCr !== null ? mktCapCr * 1e7 : null; // Crores → absolute ₹

	return {
		price,
		previousClose: null, // not in Moneycontrol pricefeed
		marketCap,
		pe: pf(d.P_C),
		bookValue: pf(d.BV),
		fiftyTwoWeekHigh: pf(d["52H"]),
		fiftyTwoWeekLow: pf(d["52L"]),
		faceValue: pf(d.FV),
		vwap: null, // not in Moneycontrol pricefeed — dbVwap fallback handles this
		currency: "INR",
	};
}

// ─── Screener.in enrichment ───────────────────────────────────────────────────

function parseNum(text: string): number | null {
	const clean = text.replace(/,/g, "").trim();
	const n = Number.parseFloat(clean);
	return Number.isNaN(n) ? null : n;
}

function extractTableLastTwoRows(
	html: string,
	sectionId: string,
	rowLabel: string,
): [number | null, number | null] {
	const sectionStart = html.indexOf(`id="${sectionId}"`);
	if (sectionStart < 0) return [null, null];
	const sectionEnd = html.indexOf("</section>", sectionStart);
	const section = html.slice(
		sectionStart,
		sectionEnd > 0 ? sectionEnd : sectionStart + 40000,
	);

	const rows = section.split(/<tr[^>]*>/i);
	for (const row of rows) {
		const strictMatch = row.match(/class="text"[^>]*>([\s\S]*?)<\/td>/i);
		let name: string;
		if (strictMatch) {
			name = strictMatch[1]
				.replace(/<[^>]+>/g, "")
				.replace(/&nbsp;/g, " ")
				.replace(/\+/g, "")
				.trim();
		} else {
			const anyMatch = row.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
			if (!anyMatch) continue;
			const candidate = anyMatch[1]
				.replace(/<[^>]+>/g, "")
				.replace(/&nbsp;/g, " ")
				.replace(/\+/g, "")
				.trim();
			if (/^\d+[\d.,\s]*$/.test(candidate) || candidate.length < 2) continue;
			name = candidate;
		}
		if (!name.toLowerCase().includes(rowLabel.toLowerCase())) continue;
		const cells = [...row.matchAll(/<td[^>]*>\s*(-?[\d,\.]+)\s*<\/td>/g)].map(
			(m) => parseNum(m[1]),
		);
		if (cells.length >= 2) {
			return [cells[cells.length - 2], cells[cells.length - 1]];
		}
	}
	return [null, null];
}

/**
 * Extract a full historical table from a Screener.in section.
 * Returns column headers (years/quarters) and row data.
 */
function extractFullTable(
	html: string,
	sectionId: string,
	rowLabels: string[],
	maxCols = 6,
): HistoricalTable | null {
	const sectionStart = html.indexOf(`id="${sectionId}"`);
	if (sectionStart < 0) return null;
	const sectionEnd = html.indexOf("</section>", sectionStart);
	const section = html.slice(
		sectionStart,
		sectionEnd > 0 ? sectionEnd : sectionStart + 60000,
	);

	// Parse column headers from thead
	const theadMatch = section.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
	let headers: string[] = [];
	if (theadMatch) {
		headers = [...theadMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
			.map((m) =>
				m[1]
					.replace(/<[^>]+>/g, "")
					.replace(/&nbsp;/g, " ")
					.trim(),
			)
			.filter((h) => h.length > 0 && h !== "+");
	}

	// Trim to last maxCols data columns (skip the row-label column)
	const dataHeaders = headers.length > 1 ? headers.slice(1) : headers;
	const trimmedHeaders = dataHeaders.slice(-maxCols);

	const tbodyMatch = section.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
	const body = tbodyMatch ? tbodyMatch[1] : section;
	const trBlocks = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(
		(m) => m[1],
	);

	const resultRows: { label: string; values: (number | null)[] }[] = [];

	for (const wantedLabel of rowLabels) {
		for (const block of trBlocks) {
			// Extract label from first td
			const labelMatch = block.match(/<td[^>]*>([\s\S]*?)<\/td>/i);
			if (!labelMatch) continue;
			const rawLabel = labelMatch[1]
				.replace(/<[^>]+>/g, "")
				.replace(/&nbsp;/g, " ")
				.replace(/\+/g, "")
				.trim();
			if (!rawLabel.toLowerCase().includes(wantedLabel.toLowerCase())) continue;

			// Extract all numeric cells
			const allCells = [
				...block.matchAll(/<td[^>]*>\s*(-?[\d,\.]+)%?\s*<\/td>/g),
			].map((m) => parseNum(m[1]));

			// Take the last maxCols values
			const vals = allCells.slice(-maxCols);
			// Pad front with nulls if fewer than expected
			while (vals.length < trimmedHeaders.length) vals.unshift(null);
			// Trim oldest entries if tbody has more cells than thead headers
			// (Screener.in sometimes adds a trailing TTM/interim column not reflected in thead)
			while (vals.length > trimmedHeaders.length) vals.shift();

			resultRows.push({ label: rawLabel, values: vals });
			break;
		}
	}

	if (resultRows.length === 0) return null;
	return { headers: trimmedHeaders, rows: resultRows };
}

function computeCagr(
	values: (number | null)[],
	years: number,
	headers?: string[],
): number | null {
	// Build list of annual (non-TTM) indices
	const annualIdxs = headers
		? headers
				.map((h, i) => ({ h, i }))
				.filter(({ h }) => !h.toUpperCase().includes("TTM"))
				.map(({ i }) => i)
		: values.map((_, i) => i);
	const annualVals = annualIdxs.map((i) => values[i]);
	if (annualVals.length < years + 1) return null;
	const end = annualVals[annualVals.length - 1];
	const start = annualVals[annualVals.length - 1 - years];
	if (end === null || start === null || start <= 0) return null;
	return (end / start) ** (1 / years) - 1;
}

async function fetchFundamentalsFromPython(
	nseSymbol: string,
): Promise<ScreenerData | null> {
	try {
		const resp = await callPython<any>("/market/fundamentals", "POST", {
			symbol: nseSymbol,
		});
		if (!resp || resp.error) return null;

		const pf = (v: any): number | null => {
			if (v === null || v === undefined) return null;
			const n = Number(v);
			return Number.isFinite(n) ? n : null;
		};

		// Validate a HistoricalTable from Python response
		const parseHistory = (v: any): HistoricalTable | null => {
			if (!v || typeof v !== "object") return null;
			if (!Array.isArray(v.headers) || !Array.isArray(v.rows)) return null;
			if (v.rows.length === 0) return null;
			// At least one non-null value must exist
			const hasData = v.rows.some(
				(r: any) =>
					Array.isArray(r.values) && r.values.some((x: any) => x !== null),
			);
			return hasData ? v : null;
		};

		const result: ScreenerData = {
			roe: pf(resp.roe),
			roce: pf(resp.roce),
			dividendYield: pf(resp.dividendYield),
			bookValue: pf(resp.bookValue),
			revenueGrowth: pf(resp.revenueGrowth),
			earningsGrowth: pf(resp.earningsGrowth),
			debtToEquity: pf(resp.debtToEquity),
			pe: pf(resp.pe),
			pb: pf(resp.pb),
			revenue: pf(resp.revenue),
			netIncome: pf(resp.netIncome),
			operatingCashFlow: pf(resp.operatingCashFlow),
			freeCashFlow: pf(resp.freeCashFlow),
			operatingMargin: pf(resp.operatingMargin),
			marketCapCr: pf(resp.marketCapCr) ?? null,
			// Historical tables — now populated by the extended Python sidecar
			plHistory: parseHistory(resp.plHistory),
			bsHistory: parseHistory(resp.bsHistory),
			cfHistory: parseHistory(resp.cfHistory),
			ratiosHistory: parseHistory(resp.ratiosHistory),
			quarterlyHistory: parseHistory(resp.quarterlyHistory),
			companyDescription:
				typeof resp.companyDescription === "string" &&
				resp.companyDescription.length > 10
					? resp.companyDescription
					: null,
			salesCagr3Y: pf(resp.salesCagr3Y),
			salesCagr5Y: pf(resp.salesCagr5Y),
			profitCagr3Y: pf(resp.profitCagr3Y),
			profitCagr5Y: pf(resp.profitCagr5Y),
			pros: [], // Screener-unique — Python cannot derive these
			cons: [],
		};

		const hasData = Object.values(result).some(
			(v) =>
				v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0),
		);
		if (!hasData) return null;

		const histCount = [
			result.plHistory,
			result.bsHistory,
			result.cfHistory,
			result.quarterlyHistory,
		].filter(Boolean).length;
		logger.info(
			`[ResearchNote] Python/yfinance fundamentals for ${nseSymbol}: ` +
				`ROE=${result.roe !== null ? (result.roe * 100).toFixed(1) + "%" : "N/A"}, ` +
				`Rev=${result.revenue !== null ? "₹" + result.revenue.toFixed(0) + "Cr" : "N/A"}, ` +
				`Hist=${histCount}/4 tables, CAGR3Y=${result.salesCagr3Y !== null ? (result.salesCagr3Y * 100).toFixed(1) + "%" : "N/A"}`,
		);
		return result;
	} catch (e: any) {
		logger.warn(
			`[ResearchNote] Python fundamentals failed for ${nseSymbol}:`,
			e?.message?.slice(0, 80),
		);
		return null;
	}
}

function mergeScreenerWithPython(
	screener: ScreenerData,
	python: ScreenerData,
): ScreenerData {
	const pick = <T>(
		a: T | null | undefined,
		b: T | null | undefined,
	): T | null => {
		if (a !== null && a !== undefined) return a;
		return b ?? null;
	};
	return {
		roe: pick(screener.roe, python.roe),
		roce: pick(screener.roce, python.roce),
		dividendYield: pick(screener.dividendYield, python.dividendYield),
		bookValue: pick(screener.bookValue, python.bookValue),
		revenueGrowth: pick(screener.revenueGrowth, python.revenueGrowth),
		earningsGrowth: pick(screener.earningsGrowth, python.earningsGrowth),
		debtToEquity: pick(screener.debtToEquity, python.debtToEquity),
		pe: pick(screener.pe, python.pe),
		pb: pick(screener.pb, python.pb),
		revenue: pick(screener.revenue, python.revenue),
		netIncome: pick(screener.netIncome, python.netIncome),
		operatingCashFlow: pick(
			screener.operatingCashFlow,
			python.operatingCashFlow,
		),
		freeCashFlow: pick(screener.freeCashFlow, python.freeCashFlow),
		operatingMargin: pick(screener.operatingMargin, python.operatingMargin),
		marketCapCr: pick(screener.marketCapCr, python.marketCapCr),
		// Historical tables: Screener.in first; Python-derived as fallback when Screener timed out
		plHistory: pick(screener.plHistory, python.plHistory),
		bsHistory: pick(screener.bsHistory, python.bsHistory),
		cfHistory: pick(screener.cfHistory, python.cfHistory),
		ratiosHistory: pick(screener.ratiosHistory, python.ratiosHistory),
		quarterlyHistory: pick(screener.quarterlyHistory, python.quarterlyHistory),
		companyDescription: pick(
			screener.companyDescription,
			python.companyDescription,
		),
		salesCagr3Y: pick(screener.salesCagr3Y, python.salesCagr3Y),
		salesCagr5Y: pick(screener.salesCagr5Y, python.salesCagr5Y),
		profitCagr3Y: pick(screener.profitCagr3Y, python.profitCagr3Y),
		profitCagr5Y: pick(screener.profitCagr5Y, python.profitCagr5Y),
		// Pros/Cons: only Screener.in has these — never in Python
		pros: screener.pros ?? [],
		cons: screener.cons ?? [],
	};
}

function emptyScreenerData(): ScreenerData {
	return {
		roe: null,
		roce: null,
		dividendYield: null,
		bookValue: null,
		revenueGrowth: null,
		earningsGrowth: null,
		debtToEquity: null,
		pe: null,
		pb: null,
		revenue: null,
		netIncome: null,
		operatingCashFlow: null,
		freeCashFlow: null,
		operatingMargin: null,
		marketCapCr: null,
		plHistory: null,
		bsHistory: null,
		cfHistory: null,
		ratiosHistory: null,
		quarterlyHistory: null,
		companyDescription: null,
		salesCagr3Y: null,
		salesCagr5Y: null,
		profitCagr3Y: null,
		profitCagr5Y: null,
		pros: [],
		cons: [],
	};
}

function parseScreenerHtml(html: string, nseSymbol: string): ScreenerData {
	const topStart = html.indexOf('id="top"');
	const topEnd = html.indexOf("</section>", topStart);
	const topHtml =
		topStart >= 0
			? html.slice(topStart, topEnd > 0 ? topEnd : topStart + 8000)
			: "";

	const liItems = [...topHtml.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)].map((m) =>
		m[1]
			.replace(/<[^>]+>/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&nbsp;/g, " ")
			.replace(/\s+/g, " ")
			.trim(),
	);

	let roe: number | null = null;
	let roce: number | null = null;
	let dividendYield: number | null = null;
	let bookValue: number | null = null;
	let pe: number | null = null;
	let pb: number | null = null;
	let marketCapCr: number | null = null;

	for (const item of liItems) {
		const lower = item.toLowerCase();
		// Market Cap: "Market Cap ₹1,234 Cr" — must check before generic numMatch to handle commas
		if (/market cap/.test(lower) && marketCapCr === null) {
			const mcMatch = item.match(/(?:₹|Rs\.?)?\s*([\d,\.]+)\s*(?:Cr|cr)?/i);
			if (mcMatch) marketCapCr = parseNum(mcMatch[1]);
			continue;
		}
		const numMatch = item.match(/([\d,\.]+)\s*%?$/);
		if (!numMatch) continue;
		const val = parseNum(numMatch[1]);
		if (/\broe\b/.test(lower) && roe === null)
			roe = val !== null ? val / 100 : null;
		else if (/\broce\b/.test(lower) && roce === null)
			roce = val !== null ? val / 100 : null;
		else if (/dividend yield/.test(lower) && dividendYield === null)
			dividendYield = val !== null ? val / 100 : null;
		else if (/stock p\/e|pe ratio|\bp\/e\b/.test(lower) && pe === null)
			pe = val;
		else if (/price to book|p\/b ratio/.test(lower) && pb === null) pb = val;
		else if (/book value/.test(lower) && bookValue === null) {
			const bvMatch = item.match(/(?:₹|Rs\.?)\s*([\d,\.]+)/i);
			bookValue = bvMatch ? parseNum(bvMatch[1]) : val;
			if (bookValue === null && val !== null) bookValue = val;
		}
	}

	// Revenue: try multiple label variants (Screener uses "Sales" for most, but
	// banking/NBFC use "Net Interest Income", insurance use "Premium Earned", etc.)
	const revLabels = [
		"Sales",
		"Revenue from Operations",
		"Revenue",
		"Net Revenue",
		"Net Interest Income",
		"Interest Income",
		"Premium Earned",
		"Net Interest Earned",
	];
	let revPrev: number | null = null,
		revLatest: number | null = null;
	for (const lbl of revLabels) {
		const [p, l] = extractTableLastTwoRows(html, "profit-loss", lbl);
		if (l !== null) {
			revPrev = p;
			revLatest = l;
			break;
		}
	}

	// Net Profit: try multiple label variants
	const patLabels = ["Net Profit", "Profit after tax", "PAT", "Net Income"];
	let patPrev: number | null = null,
		patLatest: number | null = null;
	for (const lbl of patLabels) {
		const [p, l] = extractTableLastTwoRows(html, "profit-loss", lbl);
		if (l !== null) {
			patPrev = p;
			patLatest = l;
			break;
		}
	}

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
	const [, opRaw] = extractTableLastTwoRows(
		html,
		"profit-loss",
		"Operating Profit",
	);
	const operatingMargin: number | null =
		opRaw !== null && revLatest !== null && revLatest > 0
			? Math.round((opRaw / revLatest) * 10000) / 10000 // decimal fraction e.g. 0.254
			: null;

	// Cash flows from cash flow section (₹ Crores) — try multiple row label variants
	const [, cfoRaw1] = extractTableLastTwoRows(
		html,
		"cash-flow",
		"Cash from Operating",
	);
	const [, cfoRaw2] = extractTableLastTwoRows(
		html,
		"cash-flow",
		"Operating Activities",
	);
	const cfoRaw = cfoRaw1 ?? cfoRaw2;
	const [, cfiRaw1] = extractTableLastTwoRows(
		html,
		"cash-flow",
		"Cash from Investing",
	);
	const [, cfiRaw2] = extractTableLastTwoRows(
		html,
		"cash-flow",
		"Investing Activities",
	);
	const cfiRaw = cfiRaw1 ?? cfiRaw2;
	const operatingCashFlow: number | null = cfoRaw ?? null;
	// FCF = Operating CF + Investing CF (investing is typically negative = capex outflows)
	const freeCashFlow: number | null =
		cfoRaw !== null && cfiRaw !== null
			? Math.round((cfoRaw + cfiRaw) * 100) / 100
			: null;

	const [, equityCapital] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Equity Capital",
	);
	const [, reserves] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Reserves",
	);
	// Borrowings: try multiple label variants (non-bank companies)
	const [, borrowings1] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Borrowings",
	);
	const [, borrowings2] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Total Borrowings",
	);
	const [, borrowings3] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Long Term Borrowing",
	);
	// ── Bank/NBFC D/E fix ─────────────────────────────────────────────────────
	// Screener balance sheets for banks/NBFCs use "Borrowings" to mean
	// interbank/market borrowings (NOT deposits — deposits are a bank's product,
	// not traditional debt). If the standard rows all return null, check if this
	// is a banking stock by detecting the "Deposits" row that only banks have.
	// For banks, D/E = Borrowings / Networth (where Borrowings = interbank only).
	// "Other Liabilities" is an additional fallback for NBFCs.
	const [, deposits] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Deposits",
	);
	const [, otherLiabilities] = extractTableLastTwoRows(
		html,
		"balance-sheet",
		"Other Liabilities",
	);
	const isBankingStock = deposits !== null && deposits > 0;

	let borrowings: number | null;
	if (isBankingStock) {
		// For banks: use Borrowings (interbank) if available, else 0 (no traditional D/E debt)
		borrowings = borrowings1 ?? borrowings2 ?? borrowings3 ?? 0;
	} else {
		// Non-bank: standard fallback chain including Other Liabilities for NBFCs
		borrowings = borrowings1 ?? borrowings2 ?? borrowings3 ?? otherLiabilities ?? null;
	}

	const totalEquity = (equityCapital ?? 0) + (reserves ?? 0);
	const debtToEquity: number | null =
		borrowings !== null && totalEquity > 0
			? Math.round((borrowings / totalEquity) * 1000) / 1000
			: borrowings === 0
				? 0 // zero debt (or bank with no interbank borrowings) → D/E = 0
				: null;

	// ─── Extended historical tables ───────────────────────────────────────────

	// Multi-year P&L
	const plHistory = extractFullTable(
		html,
		"profit-loss",
		[
			"Sales",
			"Expenses",
			"Operating Profit",
			"OPM %",
			"Other Income",
			"Interest",
			"Depreciation",
			"Net Profit",
			"EPS in Rs",
		],
		6,
	);

	// Multi-year Balance Sheet
	const bsHistory = extractFullTable(
		html,
		"balance-sheet",
		[
			"Equity Capital",
			"Reserves",
			"Borrowings",
			"Fixed Assets",
			"Total Assets",
		],
		6,
	);

	// Multi-year Cash Flows
	const cfHistory = extractFullTable(
		html,
		"cash-flow",
		[
			"Cash from Operating",
			"Cash from Investing",
			"Cash from Financing",
			"Net Cash Flow",
		],
		6,
	);

	// Key ratios (efficiency metrics)
	const ratiosHistory = extractFullTable(
		html,
		"ratios",
		[
			"Debtor Days",
			"Inventory Days",
			"Days Payable",
			"Cash Conversion Cycle",
			"Working Capital Days",
			"ROCE %",
		],
		6,
	);

	// Quarterly results
	const quarterlyHistory = extractFullTable(
		html,
		"quarters",
		[
			"Sales",
			"Expenses",
			"Operating Profit",
			"OPM %",
			"Net Profit",
			"EPS in Rs",
		],
		5,
	);

	// Company description
	let companyDescription: string | null = null;
	const aboutStart = html.search(/<div[^>]*class="[^"]*about[^"]*"[^>]*>/i);
	if (aboutStart >= 0) {
		const chunk = html.slice(aboutStart, aboutStart + 4000);
		const pMatch = chunk.match(/<p[^>]*>([\s\S]{20,800}?)<\/p>/i);
		if (pMatch) {
			companyDescription = pMatch[1]
				.replace(/<[^>]+>/g, "")
				.replace(/&amp;/g, "&")
				.replace(/&nbsp;/g, " ")
				.replace(/&lt;/g, "<")
				.replace(/&gt;/g, ">")
				.replace(/\s+/g, " ")
				.trim();
		}
	}

	// Pros & Cons (machine-generated by Screener.in)
	const pros: string[] = [];
	const cons: string[] = [];
	const prosIdx = html.indexOf('class="pros"');
	if (prosIdx >= 0) {
		const prosBlock = html.slice(prosIdx, prosIdx + 4000);
		const ulMatch = prosBlock.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
		if (ulMatch) {
			[...ulMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
				.map((m) =>
					m[1]
						.replace(/<[^>]+>/g, "")
						.replace(/&amp;/g, "&")
						.replace(/&nbsp;/g, " ")
						.replace(/\s+/g, " ")
						.trim(),
				)
				.filter((s) => s.length > 5)
				.forEach((s) => pros.push(s));
		}
		const consIdx = prosBlock.indexOf('class="cons"');
		if (consIdx >= 0) {
			const consBlock = prosBlock.slice(consIdx, consIdx + 3000);
			const consUl = consBlock.match(/<ul[^>]*>([\s\S]*?)<\/ul>/i);
			if (consUl) {
				[...consUl[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
					.map((m) =>
						m[1]
							.replace(/<[^>]+>/g, "")
							.replace(/&amp;/g, "&")
							.replace(/&nbsp;/g, " ")
							.replace(/\s+/g, " ")
							.trim(),
					)
					.filter((s) => s.length > 5)
					.forEach((s) => cons.push(s));
			}
		}
	}
	if (pros.length > 0 || cons.length > 0) {
		logger.info(
			`[ResearchNote] Screener.in ${nseSymbol}: ${pros.length} pros, ${cons.length} cons`,
		);
	}

	// CAGR calculations from P&L historical data
	const salesRow = plHistory?.rows.find((r) =>
		r.label.toLowerCase().includes("sales"),
	);
	const profitRow = plHistory?.rows.find((r) =>
		r.label.toLowerCase().includes("net profit"),
	);
	const plHeaders = plHistory?.headers;
	const salesCagr3Y = salesRow
		? computeCagr(salesRow.values, 3, plHeaders)
		: null;
	const salesCagr5Y = salesRow
		? computeCagr(salesRow.values, 5, plHeaders)
		: null;
	const profitCagr3Y = profitRow
		? computeCagr(profitRow.values, 3, plHeaders)
		: null;
	const profitCagr5Y = profitRow
		? computeCagr(profitRow.values, 5, plHeaders)
		: null;

	logger.info(
		`[ResearchNote] Screener.in ${nseSymbol} → ROE:${roe !== null ? (roe * 100).toFixed(2) + "%" : "N/A"} ` +
		`ROCE:${roce !== null ? (roce * 100).toFixed(2) + "%" : "N/A"} ` +
		`PE:${pe ?? "N/A"} PB:${pb ?? "N/A"} ` +
		`DY:${dividendYield !== null ? (dividendYield * 100).toFixed(2) + "%" : "N/A"} ` +
		`D/E:${debtToEquity ?? "N/A"} ` +
		`Rev:${revenue !== null ? "₹" + revenue.toFixed(0) + "Cr" : "N/A"} ` +
		`OPM:${operatingMargin !== null ? (operatingMargin * 100).toFixed(1) + "%" : "N/A"} ` +
		`CFO:${operatingCashFlow !== null ? "₹" + operatingCashFlow.toFixed(0) + "Cr" : "N/A"} ` +
		`FCF:${freeCashFlow !== null ? "₹" + freeCashFlow.toFixed(0) + "Cr" : "N/A"} ` +
		`PLHist:${plHistory?.rows.length ?? 0}rows Qtrs:${quarterlyHistory?.rows.length ?? 0}rows`,
	);


	return {
		roe,
		roce,
		dividendYield,
		bookValue,
		revenueGrowth,
		earningsGrowth,
		debtToEquity,
		pe,
		pb,
		revenue,
		netIncome,
		operatingCashFlow,
		freeCashFlow,
		operatingMargin,
		marketCapCr,
		plHistory,
		bsHistory,
		cfHistory,
		ratiosHistory,
		quarterlyHistory,
		companyDescription,
		salesCagr3Y,
		salesCagr5Y,
		profitCagr3Y,
		profitCagr5Y,
		pros,
		cons,
	};
}

export async function fetchFromScreener(
	nseSymbol: string,
): Promise<ScreenerData> {
	try {
		const searchRes = await fetch(
			`https://www.screener.in/api/company/search/?q=${encodeURIComponent(nseSymbol)}`,
			{
				headers: { ...BROWSER_HEADERS, Accept: "application/json" },
				signal: AbortSignal.timeout(10_000),
			},
		);
		if (!searchRes.ok) return emptyScreenerData();
		const results = (await searchRes.json()) as any[];
		if (!results?.length) return emptyScreenerData();

		const company =
			results.find((r: any) => r.url?.includes("consolidated")) ?? results[0];
		const companyUrl = `https://www.screener.in${company.url}`;

		const pageRes = await fetch(companyUrl, {
			headers: { ...BROWSER_HEADERS, Referer: "https://www.screener.in/" },
			signal: AbortSignal.timeout(15_000),
		});
		if (!pageRes.ok) return emptyScreenerData();
		const html = await pageRes.text();
		return parseScreenerHtml(html, nseSymbol);
	} catch (e: any) {
		logger.warn("[ResearchNote] Screener.in fetch failed:", e?.message);
		return emptyScreenerData();
	}
}

/**
 * Direct Screener.in ticker URL fallback — bypasses the search step.
 * Tries /company/{symbol}/consolidated/ then /company/{symbol}/.
 * Used as a fallback when Yahoo Finance is rate-limited.
 */
async function fetchFromScreenerDirect(symbol: string): Promise<ScreenerData> {
	const urls = [
		`https://www.screener.in/company/${symbol}/consolidated/`,
		`https://www.screener.in/company/${symbol}/`,
	];
	for (const url of urls) {
		try {
			logger.info(`[ResearchNote] Screener direct: ${url}`);
			const res = await fetch(url, {
				headers: { ...BROWSER_HEADERS, Referer: "https://www.screener.in/" },
				signal: AbortSignal.timeout(15_000),
			});
			if (!res.ok) {
				logger.warn(
					`[ResearchNote] Screener direct ${url} → HTTP ${res.status}`,
				);
				continue;
			}
			const html = await res.text();
			const result = parseScreenerHtml(html, symbol);
			if (
				result.revenue !== null ||
				result.roe !== null ||
				result.pe !== null ||
				result.bookValue !== null
			) {
				logger.info(
					`[ResearchNote] Screener direct succeeded for ${symbol} via ${url}`,
				);
				return result;
			}
			logger.warn(
				`[ResearchNote] Screener direct ${url} returned empty metrics — trying next`,
			);
		} catch (e: any) {
			logger.warn(
				`[ResearchNote] Screener direct failed for ${url}:`,
				e?.message,
			);
		}
	}
	return emptyScreenerData();
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
	beta: number | null; // from listed_stocks.beta
	operatingCashFlow: number | null;
	freeCashFlow: number | null;
	revenue: number | null;
	netIncome: number | null;
	operatingMargin: number | null;
	returns1M: number | null;
	returns6M: number | null;
	returns1Y: number | null;
	lastUpdated: Date | null; // when fundamentals were last written to DB
	existsInListedStocks: boolean; // true if symbol row exists in listed_stocks (even with null metrics)
	// Price fields from listed_stocks — used as fallback when NSE/Yahoo are unavailable
	dbPrice: number | null;
	dbMarketCap: number | null;
	dbPeRatio: number | null;
	dbFaceValue: number | null;
	dbFiftyTwoWeekHigh: number | null;
	dbFiftyTwoWeekLow: number | null;
	dbVwap: number | null; // listed_stocks.last_vwap — last VWAP from a live NSE session
	dbPreviousClose: number | null; // listed_stocks.previous_close — last market-close price from DB
}

async function fetchFromDB(nseSymbol: string): Promise<DBData> {
	const empty: DBData = {
		eps: null,
		bookValue: null,
		roe: null,
		roce: null,
		dividendYield: null,
		debtToEquity: null,
		revenueGrowth: null,
		earningsGrowth: null,
		beta: null,
		operatingCashFlow: null,
		freeCashFlow: null,
		revenue: null,
		netIncome: null,
		operatingMargin: null,
		returns1M: null,
		returns6M: null,
		returns1Y: null,
		lastUpdated: null,
		existsInListedStocks: false,
		dbPrice: null,
		dbMarketCap: null,
		dbPeRatio: null,
		dbFaceValue: null,
		dbFiftyTwoWeekHigh: null,
		dbFiftyTwoWeekLow: null,
		dbVwap: null,
		dbPreviousClose: null,
	};
	try {
		const rows = await db.execute(sql`
      SELECT sf.eps, sf.book_value, sf.roe, sf.roce, sf.dividend_yield,
             sf.debt_to_equity, sf.revenue_growth, sf.earnings_growth,
             sf.operating_cash_flow, sf.free_cash_flow,
             sf.revenue, sf.net_income, sf.operating_margin,
             sf.last_updated,
             ls.returns_1m, ls.returns_6m, ls.returns_1y, ls.beta,
             ls.current_price, ls.previous_close, ls.market_cap_value, ls.pe_ratio,
             ls.face_value, ls.week_high_52, ls.week_low_52,
             ls.last_vwap
      FROM screener_financials sf
      LEFT JOIN listed_stocks ls ON ls.symbol = sf.symbol
      WHERE sf.symbol = ${nseSymbol.toUpperCase()}
      ORDER BY sf.fiscal_year DESC NULLS LAST, sf.last_updated DESC NULLS LAST
      LIMIT 1
    `);
		const r = ((rows as any).rows ?? rows)[0] as any;
		if (!r) {
			const lsRows = await db.execute(sql`
        SELECT returns_1m, returns_6m, returns_1y, current_price, previous_close,
               market_cap_value, pe_ratio, face_value,
               week_high_52, week_low_52, last_vwap
        FROM listed_stocks WHERE symbol = ${nseSymbol.toUpperCase()} LIMIT 1
      `);
			const lr = ((lsRows as any).rows ?? lsRows)[0] as any;
			if (lr) {
				const pf = (v: any) =>
					v !== null && v !== undefined ? Number.parseFloat(v) : null;
				return {
					...empty,
					existsInListedStocks: true,
					returns1M: pf(lr.returns_1m),
					returns6M: pf(lr.returns_6m),
					returns1Y: pf(lr.returns_1y),
					dbPrice: pf(lr.current_price),
					dbPreviousClose: pf(lr.previous_close),
					dbMarketCap: pf(lr.market_cap_value),
					dbPeRatio: pf(lr.pe_ratio),
					dbFaceValue: pf(lr.face_value),
					dbFiftyTwoWeekHigh: pf(lr.week_high_52),
					dbFiftyTwoWeekLow: pf(lr.week_low_52),
					dbVwap: pf(lr.last_vwap),
				};
			}
			return empty;
		}
		const pf = (v: any) =>
			v !== null && v !== undefined ? Number.parseFloat(v) : null;
		return {
			eps: pf(r.eps),
			bookValue: pf(r.book_value),
			roe: pf(r.roe),
			roce: pf(r.roce),
			dividendYield: pf(r.dividend_yield),
			debtToEquity: pf(r.debt_to_equity),
			revenueGrowth: pf(r.revenue_growth),
			earningsGrowth: pf(r.earnings_growth),
			beta: pf(r.beta),
			operatingCashFlow: pf(r.operating_cash_flow),
			freeCashFlow: pf(r.free_cash_flow),
			revenue: pf(r.revenue),
			netIncome: pf(r.net_income),
			operatingMargin: pf(r.operating_margin),
			returns1M: pf(r.returns_1m),
			returns6M: pf(r.returns_6m),
			returns1Y: pf(r.returns_1y),
			lastUpdated: r.last_updated ? new Date(r.last_updated) : null,
			existsInListedStocks: true,
			dbPrice: pf(r.current_price),
			dbPreviousClose: pf(r.previous_close),
			dbMarketCap: pf(r.market_cap_value),
			dbPeRatio: pf(r.pe_ratio),
			dbFaceValue: pf(r.face_value),
			// Bug 3 fix: use the actual SQL column name returned by PostgreSQL (week_high_52 / week_low_52)
			// NOT the camelCase alias r.fifty_two_week_high which was never populated.
			dbFiftyTwoWeekHigh: pf(r.week_high_52),
			dbFiftyTwoWeekLow: pf(r.week_low_52),
			dbVwap: pf(r.last_vwap),
		};
	} catch (e: any) {
		logger.warn("[ResearchNote] DB read failed:", e?.message);
		return empty;
	}
}

/** Returns true if DB data is fresh enough to skip a live Screener.in scrape */
function isDbFresh(dbData: DBData): boolean {
	if (!dbData.lastUpdated) return false;
	if (dbData.roe === null && dbData.roce === null) return false; // no useful fundamentals stored
	if (dbData.revenue === null) return false; // re-scrape if new fields missing
	// ── D/E fix: re-scrape if debtToEquity is missing (banks used to store null) ──
	if (dbData.debtToEquity === null) return false;
	const ageMs = Date.now() - dbData.lastUpdated.getTime();
	return ageMs < dbFreshnessHours() * 60 * 60 * 1000;
}


// ─── DB write-back (persist Screener.in results) ──────────────────────────────

async function writeScreenerToDB(
	nseSymbol: string,
	s: ScreenerData,
): Promise<void> {
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
		logger.warn(
			"[ResearchNote] DB write-back failed:",
			e?.message?.slice(0, 80),
		);
	}
}

// ─── Yahoo Finance fallback ───────────────────────────────────────────────────

/**
 * Fetch price + market data from Yahoo Finance v8/chart API directly.
 * More reliable than the yahoo-finance2 npm package for Cloud Run environments:
 *  - Returns regularMarketPrice, fiftyTwoWeekHigh/Low, marketCap, previousClose
 *  - Does NOT require crumb/cookie dance (v8 chart endpoint is open)
 * Falls back to yahoo-finance2 npm library if the direct API fails.
 */
async function fetchFromYahoo(symbol: string): Promise<Partial<FinancialData>> {
	// Primary: direct v8 chart API
	try {
		const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
			signal: AbortSignal.timeout(8_000),
		});
		if (res.ok) {
			const body = (await res.json()) as any;
			const meta = body?.chart?.result?.[0]?.meta;
			if (meta?.regularMarketPrice) {
				const pf = (v: any): number | null => {
					if (v === null || v === undefined) return null;
					const n = typeof v === "number" ? v : Number.parseFloat(v);
					return Number.isFinite(n) && n > 0 ? n : null;
				};
				return {
					price: pf(meta.regularMarketPrice),
					previousClose: pf(meta.previousClose) ?? pf(meta.chartPreviousClose),
					marketCap: pf(meta.marketCap),
					fiftyTwoWeekHigh: pf(meta.fiftyTwoWeekHigh),
					fiftyTwoWeekLow: pf(meta.fiftyTwoWeekLow),
					currency: meta.currency ?? "INR",
				};
			}
		}
	} catch (e: any) {
		logger.warn(`[ResearchNote] Yahoo v8/chart failed for ${symbol}:`, e?.message?.slice(0, 60));
	}

	// Secondary fallback: yahoo-finance2 npm package
	const q = (await yahooFinance.quote(
		symbol,
		{},
		{ validateResult: false },
	)) as any;
	if (!q?.regularMarketPrice)
		throw new Error(`No price from Yahoo for ${symbol}`);
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
	screener: ScreenerData,
): FinancialData {
	// Price fallback chain (highest quality first):
	//  1. Live price from NSE / Moneycontrol / Yahoo (base.price)
	//  2. DB current_price — written by background price-sync cron (dbData.dbPrice)
	//  3. DB last_vwap — last VWAP from a real live NSE session (dbData.dbVwap)
	//  4. DB previous_close — last market close stored in listed_stocks (dbData.dbPreviousClose)
	const price = base.price ?? dbData.dbPrice ?? dbData.dbVwap ?? dbData.dbPreviousClose ?? null;

	const roe =
		screener.roe ??
		dbData.roe ??
		(() => {
			const eps = dbData.eps ?? base.eps ?? null;
			const bv = screener.bookValue ?? dbData.bookValue ?? null;
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
		// Market Cap fallback chain:
		// 1. Live price API (NSE: price × issuedSize, Moneycontrol MKTCAP, Yahoo marketCap)
		// 2. DB market_cap_value — written on every successful NSE live fetch
		// 3. Screener.in #top section "Market Cap ₹X Cr" — always present on Screener page
		marketCap:
			base.marketCap ??
			dbData.dbMarketCap ??
			(screener.marketCapCr !== null ? Math.round(screener.marketCapCr * 1e7) : null) ??
			null,
		pe: (() => {
			const eps = dbData.eps ?? base.eps ?? null;
			// NSE → DB cached PE → screener → compute from price/EPS as last resort
			return (
				base.pe ??
				dbData.dbPeRatio ??
				screener.pe ??
				(price && eps && eps > 0 ? Math.round((price / eps) * 10) / 10 : null)
			);
		})(),
		eps: dbData.eps ?? base.eps ?? null,
		roe,
		roce: screener.roce ?? dbData.roce ?? null,
		pbRatio,
		debtToEquity: screener.debtToEquity ?? dbData.debtToEquity ?? null,
		revenueGrowth: screener.revenueGrowth ?? dbData.revenueGrowth ?? null,
		earningsGrowth: screener.earningsGrowth ?? dbData.earningsGrowth ?? null,
		fiftyTwoWeekHigh: base.fiftyTwoWeekHigh ?? dbData.dbFiftyTwoWeekHigh ?? null,
		fiftyTwoWeekLow: base.fiftyTwoWeekLow ?? dbData.dbFiftyTwoWeekLow ?? null,
		dividendYield:
			screener.dividendYield ??
			dbData.dividendYield ??
			base.dividendYield ??
			null,
		beta: dbData.beta ?? base.beta ?? null,
		targetMeanPrice: null,
		currency: base.currency ?? "INR",
		bookValue,
		faceValue: base.faceValue ?? dbData.dbFaceValue ?? null,
		vwap:
			// Priority order:
			// 1. Live NSE VWAP (market open, vwap > 0)
			// 2. DB last_vwap — last VWAP from a real live session (Bug 1 fix: column now exists)
			// 3. live previousClose from NSE response — best proxy when market is closed
			// 4. DB previous_close — last close stored in listed_stocks (new fallback)
			// 5. DB current_price — last known price (final proxy before null)
			(base.vwap && base.vwap > 0 ? base.vwap : null) ??
			dbData.dbVwap ??
			(base.previousClose && base.previousClose > 0 ? base.previousClose : null) ??
			dbData.dbPreviousClose ??
			dbData.dbPrice ??
			null,
		operatingCashFlow:
			screener.operatingCashFlow ?? dbData.operatingCashFlow ?? null,
		freeCashFlow: screener.freeCashFlow ?? dbData.freeCashFlow ?? null,
		revenue: screener.revenue ?? dbData.revenue ?? null,
		netIncome: screener.netIncome ?? dbData.netIncome ?? null,
		operatingMargin: screener.operatingMargin ?? dbData.operatingMargin ?? null,
		returns1M: dbData.returns1M ?? null,
		returns6M: dbData.returns6M ?? null,
		returns1Y: dbData.returns1Y ?? null,
	};
}

// ─── Python-Powered Price Returns ────────────────────────────────────────────
//
// Reads the golden_prices time-series from the DB (via the Python sidecar)
// and computes 1D / 1W / 1M / 3M / 6M / YTD / 1Y / 3Y / 5Y using Pandas.
// Writes results back to instrument_returns + listed_stocks (write_back=true).
// Falls back to null if Python is unavailable (service gracefully returns null).

async function fetchPythonReturns(
	nseSymbol: string,
): Promise<{
	returns1M: number | null;
	returns6M: number | null;
	returns1Y: number | null;
}> {
	const empty = { returns1M: null, returns6M: null, returns1Y: null };
	try {
		const result = await callPython<{
			status: string;
			raw?: {
				return_1m: number | null;
				return_6m: number | null;
				return_1y: number | null;
			};
		}>("/api/price-returns/compute", "POST", {
			symbol: nseSymbol.toUpperCase(),
			asset_class: "equity",
			write_back: true,
		});

		if (
			!result ||
			result.status === "no_price_history" ||
			result.status === "isin_not_found"
		) {
			logger.warn(
				`[ResearchNote] Python returns: ${result?.status ?? "unavailable"} for ${nseSymbol}`,
			);
			return empty;
		}

		const raw = result.raw ?? {};
		const pf = (v: any) =>
			v !== null && v !== undefined && !Number.isNaN(Number(v))
				? Number(v)
				: null;
		const returns = {
			returns1M: pf((raw as any).return_1m),
			returns6M: pf((raw as any).return_6m),
			returns1Y: pf((raw as any).return_1y),
		};
		logger.info(
			`[ResearchNote] Python returns ${nseSymbol}: 1M=${returns.returns1M !== null ? (returns.returns1M * 100).toFixed(1) + "%" : "N/A"}, ` +
				`6M=${returns.returns6M !== null ? (returns.returns6M * 100).toFixed(1) + "%" : "N/A"}, ` +
				`1Y=${returns.returns1Y !== null ? (returns.returns1Y * 100).toFixed(1) + "%" : "N/A"}`,
		);
		return returns;
	} catch (e: any) {
		logger.warn(
			`[ResearchNote] Python returns fetch failed for ${nseSymbol}:`,
			e?.message?.slice(0, 80),
		);
		return empty;
	}
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main data entry point — DB-first, API-on-miss pattern.
 * Returns both the financial data and metadata about which source was used.
 */
export async function getFinancialData(
	symbol: string,
): Promise<FinancialData & { _fundamentalsSource: FundamentalsSource }> {
	const nseSymbol = toNseSymbol(symbol);
	const cached = cache.get(symbol);
	if (cached && cached.expiresAt > Date.now()) {
		// Overlay any fresh historical tables from histCache (tables are not stored in the 15-min result cache)
		const cachedHist = getHistCached(nseSymbol);
		const existingScreener = (cached.data as any)._screenerData ?? {};
		const mergedScreener = cachedHist
			? { ...existingScreener, ...cachedHist }
			: existingScreener;
		const tableCount = cachedHist
			? [
					cachedHist.plHistory,
					cachedHist.bsHistory,
					cachedHist.cfHistory,
					cachedHist.quarterlyHistory,
				].filter(Boolean).length
			: 0;
		logger.info(
			`[ResearchNote] Cache HIT for ${symbol}${cachedHist ? ` + histCache (${tableCount}/4 tables)` : ""}`,
		);
		return { ...(cached.data as any), _screenerData: mergedScreener };
	}

	// Step 1: Always fetch live price from NSE (fast, lightweight, has own 5-min cookie cache)
	// Step 2: Always read DB fundamentals (fast DB query — always do this)
	const [nseResult, dbResult] = await Promise.allSettled([
		fetchFromNSE(nseSymbol),
		fetchFromDB(nseSymbol),
	]);

	const dbData: DBData =
		dbResult.status === "fulfilled"
			? dbResult.value
			: {
					eps: null,
					bookValue: null,
					roe: null,
					roce: null,
					dividendYield: null,
					debtToEquity: null,
					revenueGrowth: null,
					earningsGrowth: null,
					beta: null,
					operatingCashFlow: null,
					freeCashFlow: null,
					revenue: null,
					netIncome: null,
					operatingMargin: null,
					returns1M: null,
					returns6M: null,
					returns1Y: null,
					lastUpdated: null,
					existsInListedStocks: false,
					dbPrice: null,
					dbPreviousClose: null,
					dbMarketCap: null,
					dbPeRatio: null,
					dbFaceValue: null,
					dbFiftyTwoWeekHigh: null,
					dbFiftyTwoWeekLow: null,
					dbVwap: null,
				};

	// Step 3: DB-first decision — only scrape Screener.in if DB data is stale/missing
	let screener: ScreenerData = {
		roe: null,
		roce: null,
		dividendYield: null,
		bookValue: null,
		revenueGrowth: null,
		earningsGrowth: null,
		debtToEquity: null,
		pe: null,
		pb: null,
		revenue: null,
		netIncome: null,
		operatingCashFlow: null,
		freeCashFlow: null,
		operatingMargin: null,
		marketCapCr: null,
		plHistory: null,
		bsHistory: null,
		cfHistory: null,
		ratiosHistory: null,
		quarterlyHistory: null,
		companyDescription: null,
		salesCagr3Y: null,
		salesCagr5Y: null,
		profitCagr3Y: null,
		profitCagr5Y: null,
		pros: [],
		cons: [],
	};

	let fundamentalsSource: FundamentalsSource;

	if (isDbFresh(dbData)) {
		// DB is fresh — use metrics from DB; still serve historical tables from histCache or Screener.in
		const dbScreener: ScreenerData = {
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
			marketCapCr: null, // not stored in screener_financials — comes from live Screener scrape
			plHistory: null,
			bsHistory: null,
			cfHistory: null,
			ratiosHistory: null,
			quarterlyHistory: null,
			companyDescription: null,
			salesCagr3Y: null,
			salesCagr5Y: null,
			profitCagr3Y: null,
			profitCagr5Y: null,
			pros: [],
			cons: [],
		};
		const ageHours = dbData.lastUpdated
			? Math.round((Date.now() - dbData.lastUpdated.getTime()) / 36000) / 100
			: null;
		fundamentalsSource = {
			source: "DB_CACHE",
			scrapedAt: dbData.lastUpdated?.toISOString() ?? null,
			ageHours,
		};

		// Check 12-hour historical cache for table data (plHistory, bsHistory, cfHistory etc.)
		const cachedHist = getHistCached(nseSymbol);
		if (cachedHist) {
			screener = applyHistSlice(dbScreener, cachedHist);
			const tableCount = [
				cachedHist.plHistory,
				cachedHist.bsHistory,
				cachedHist.cfHistory,
				cachedHist.quarterlyHistory,
			].filter(Boolean).length;
			logger.info(
				`[ResearchNote] DB HIT (fresh, ${ageHours}h) + histCache HIT for ${nseSymbol} (${tableCount}/4 tables)`,
			);
		} else {
			// histCache miss — fetch Screener.in tables now, then cache them
			logger.info(
				`[ResearchNote] DB HIT (fresh, ${ageHours}h) + histCache MISS for ${nseSymbol} — fetching Screener.in tables`,
			);
			const screenerResult = await fetchFromScreener(nseSymbol);
			if (screenerResult.plHistory !== null) {
				screener = applyHistSlice(
					dbScreener,
					screenerToHistSlice(screenerResult),
				);
				setHistCache(nseSymbol, screenerToHistSlice(screenerResult));
				const tableCount = [
					screenerResult.plHistory,
					screenerResult.bsHistory,
					screenerResult.cfHistory,
					screenerResult.quarterlyHistory,
				].filter(Boolean).length;
				logger.info(
					`[ResearchNote] Screener.in tables fetched for ${nseSymbol}: ${tableCount}/4 tables cached`,
				);
			} else {
				// Screener.in table fetch failed — try Python, then cache whatever we get
				const pyData = await fetchFundamentalsFromPython(nseSymbol);
				if (pyData?.plHistory) {
					screener = applyHistSlice(
						dbScreener,
						screenerToHistSlice(
							mergeScreenerWithPython(screenerResult, pyData),
						),
					);
					setHistCache(nseSymbol, screenerToHistSlice(screener));
					logger.info(
						`[ResearchNote] Python fallback tables for ${nseSymbol}: cached`,
					);
				} else {
					screener = dbScreener;
					logger.info(
						`[ResearchNote] No historical tables available for ${nseSymbol} — serving metrics only`,
					);
				}
			}
		}
	} else {
		// DB is stale or empty — fetch from Screener.in
		const staleReason = !dbData.lastUpdated
			? "no DB record"
			: `stale (${Math.round((Date.now() - dbData.lastUpdated.getTime()) / 3600000)}h old)`;
		logger.info(
			`[ResearchNote] DB MISS (${staleReason}) for ${nseSymbol} — fetching from Screener.in`,
		);
		const screenerResult = await fetchFromScreener(nseSymbol);

		// Tier 1: Screener.in completely failed (revenue null) — use Python for everything
		if (screenerResult.revenue === null) {
			const pyData = await fetchFundamentalsFromPython(nseSymbol);
			if (pyData) {
				screener = mergeScreenerWithPython(screenerResult, pyData);
				fundamentalsSource = {
					source: "PYTHON_YFINANCE",
					scrapedAt: new Date().toISOString(),
					ageHours: 0,
				};
			} else {
				screener = screenerResult;
				fundamentalsSource = {
					source: "SCREENER_LIVE",
					scrapedAt: new Date().toISOString(),
					ageHours: 0,
				};
			}
			if (screener.plHistory)
				setHistCache(nseSymbol, screenerToHistSlice(screener));
			writeScreenerToDB(nseSymbol, screener).catch(() => {});
		} else if (screenerResult.plHistory === null) {
			// Tier 2: Screener returned point-in-time ratios but history tables are missing
			// (happens when Screener HTML parse was partial or tables timed out)
			// Enrich immediately with Python-derived history — adds ~1-2s on localhost, <50ms if sidecar unreachable
			const pyData = await fetchFundamentalsFromPython(nseSymbol);
			if (pyData) {
				screener = mergeScreenerWithPython(screenerResult, pyData);
				const histCount = [
					screener.plHistory,
					screener.bsHistory,
					screener.cfHistory,
					screener.quarterlyHistory,
				].filter(Boolean).length;
				logger.info(
					`[ResearchNote] Python enriched missing history for ${nseSymbol}: ${histCount}/4 tables`,
				);
			} else {
				screener = screenerResult;
			}
			if (screener.plHistory)
				setHistCache(nseSymbol, screenerToHistSlice(screener));
			fundamentalsSource = {
				source: "SCREENER_LIVE",
				scrapedAt: new Date().toISOString(),
				ageHours: 0,
			};
			writeScreenerToDB(nseSymbol, screener).catch(() => {});
		} else {
			// Tier 3: Screener returned full data including history tables — use directly
			screener = screenerResult;
			setHistCache(nseSymbol, screenerToHistSlice(screener));
			writeScreenerToDB(nseSymbol, screener).catch(() => {});
			fundamentalsSource = {
				source: "SCREENER_LIVE",
				scrapedAt: new Date().toISOString(),
				ageHours: 0,
			};
		}
	}

	if (nseResult.status === "fulfilled" && nseResult.value.price !== null) {
		// Write-through: persist VWAP and price fields to listed_stocks so they
		// can serve as fallback data when market is closed or APIs are down.
		const nseVal = nseResult.value;
		if (nseVal.vwap && nseVal.vwap > 0) {
			db.execute(sql`
				UPDATE listed_stocks
				SET last_vwap       = ${nseVal.vwap},
				    current_price   = ${nseVal.price ?? null},
				    market_cap_value = ${nseVal.marketCap ?? null},
				    pe_ratio        = ${nseVal.pe ?? null},
				    face_value      = ${nseVal.faceValue ?? null},
				    week_high_52    = ${nseVal.fiftyTwoWeekHigh ?? null},
				    week_low_52     = ${nseVal.fiftyTwoWeekLow ?? null},
				    last_updated    = NOW()
				WHERE symbol = ${nseSymbol.toUpperCase()}
			`).catch((e: any) =>
				logger.warn("[ResearchNote] VWAP write-through failed:", e?.message?.slice(0, 80)),
			);
		}
		let data = buildFull(nseResult.value, dbData, screener);
		// Fetch price returns from NSE historical API when not in DB
		if (
			data.returns1M === null &&
			data.returns6M === null &&
			data.returns1Y === null
		) {
			const returns = await fetchPythonReturns(nseSymbol);
			data = { ...data, ...returns };
		}
		cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
		logger.info(
			`[ResearchNote] Fetched ${symbol} — ₹${data.price} | ROE:${data.roe !== null ? (data.roe * 100).toFixed(1) + "%" : "N/A"} | Rev:${data.revenue !== null ? "₹" + data.revenue.toFixed(0) + "Cr" : "N/A"} | OPM:${data.operatingMargin !== null ? (data.operatingMargin * 100).toFixed(1) + "%" : "N/A"} | src:${fundamentalsSource.source}`,
		);
		return {
			...data,
			_fundamentalsSource: fundamentalsSource,
			_screenerData: screener,
		} as any;
	}

	logger.warn(
		`[ResearchNote] NSE failed for ${nseSymbol}:`,
		(nseResult as any).reason?.message,
	);

	// Fallback 1: Moneycontrol Price API — no API key, accessible from GCP Cloud Run
	// Try NSE exchange first, then BSE for BSE-only stocks
	const isBseOnly = symbol.toUpperCase().endsWith(".BO");
	const gfExchanges: Array<"nse" | "bse"> = isBseOnly
		? ["bse", "nse"]
		: ["nse", "bse"];
	for (const mcExchange of gfExchanges) {
		try {
			logger.info(`[ResearchNote] Moneycontrol fallback: ${nseSymbol} (${mcExchange.toUpperCase()})`);
			const mcData = await fetchFromMoneycontrol(nseSymbol, mcExchange);
			if (mcData.price !== null) {
				let data = buildFull(mcData, dbData, screener);
				// Attempt to fetch returns from Python even on Google Finance path
				if (data.returns1M === null && data.returns6M === null && data.returns1Y === null) {
					const returns = await fetchPythonReturns(nseSymbol).catch(() => ({
						returns1M: null,
						returns6M: null,
						returns1Y: null,
					}));
					data = { ...data, ...returns };
				}
				cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
				logger.info(
					`[ResearchNote] Moneycontrol OK for ${nseSymbol} (${mcExchange.toUpperCase()}) — ₹${data.price}`,
				);
				return {
					...data,
					_fundamentalsSource: fundamentalsSource,
					_screenerData: screener,
				} as any;
			}
		} catch (e: any) {
			logger.warn(
				`[ResearchNote] Moneycontrol failed for ${nseSymbol} (${mcExchange.toUpperCase()}):`,
				e?.message?.slice(0, 80),
			);
		}
	}

	// Fallback 2: Yahoo Finance
	// For BSE-only stocks (symbol has .BO suffix), try .BO first to avoid unnecessary rate-limiting on .NS
	const yahooSymbols = isBseOnly
		? [`${nseSymbol}.BO`, `${nseSymbol}.NS`]
		: [`${nseSymbol}.NS`, `${nseSymbol}.BO`];
	let rateLimited = false;
	for (const ySym of yahooSymbols) {
		try {
			logger.info(`[ResearchNote] Yahoo fallback: ${ySym}`);
			const yData = await fetchFromYahoo(ySym);
			const data = buildFull(yData, dbData, screener);
			cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
			return {
				...data,
				_fundamentalsSource: fundamentalsSource,
				_screenerData: screener,
			} as any;
		} catch (e: any) {
			if (isRateLimit(e)) {
				rateLimited = true;
				logger.warn(
					`[ResearchNote] Yahoo rate-limited for ${ySym}, trying next exchange...`,
				);
				continue;
			}
			logger.warn(`[ResearchNote] Yahoo failed for ${ySym}:`, e?.message);
		}
	}
	// Don't throw on rate limit here — try Screener.in direct ticker URL before giving up.

	// Screener direct-URL fallback: bypass the search step and hit /company/{SYMBOL}/ directly.
	// This is especially useful for InvITs / BSE-only stocks where the search API returns nothing.
	try {
		logger.info(
			`[ResearchNote] Trying Screener direct ticker fallback for ${nseSymbol}`,
		);
		const directScreener = await fetchFromScreenerDirect(nseSymbol);
		if (
			directScreener.revenue !== null ||
			directScreener.roe !== null ||
			directScreener.pe !== null ||
			directScreener.bookValue !== null
		) {
			const data = buildFull({}, dbData, directScreener);
			cache.set(symbol, { data, expiresAt: Date.now() + CACHE_TTL_MS });
			return {
				...data,
				_fundamentalsSource: {
					source: "SCREENER_LIVE" as const,
					scrapedAt: new Date().toISOString(),
					ageHours: 0,
				},
				_screenerData: directScreener,
			} as any;
		}
	} catch (e: any) {
		logger.warn(
			`[ResearchNote] Screener direct fallback threw for ${nseSymbol}:`,
			e?.message,
		);
	}

	// Last resort: serve stale DB data with a price of null so the caller gets partial data.
	// Accept if we have any fundamentals OR if the symbol is a known listed stock in our DB.
	if (
		dbData.roe !== null ||
		dbData.bookValue !== null ||
		dbData.existsInListedStocks
	) {
		const reason = rateLimited ? "rate-limited" : "all sources failed";
		logger.warn(
			`[ResearchNote] ${reason} for ${nseSymbol} — serving stale/partial DB data (existsInDB: ${dbData.existsInListedStocks})`,
		);
		const staleData = buildFull({}, dbData, screener);
		return {
			...staleData,
			_fundamentalsSource: {
				source: "DB_CACHE",
				scrapedAt: dbData.lastUpdated?.toISOString() ?? null,
				ageHours: dbData.lastUpdated
					? Math.round((Date.now() - dbData.lastUpdated.getTime()) / 36000) /
						100
					: null,
			},
			_screenerData: screener,
		} as any;
	}

	throw new Error(
		`Could not fetch financial data for ${symbol}. Please try again.`,
	);
}
