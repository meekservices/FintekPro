/**
 * Bloomberg-Style Golden Source Pricing Engine
 *
 * Produces a single authoritative "golden price" per instrument per date
 * using a multi-source hierarchy with validation, audit trail, and confidence scoring.
 *
 * Source Hierarchy (equity):
 *   UPSTOX(96) → NSE_BHAVCOPY(98/DB) → INDIAN_API(93) → YAHOO_FINANCE(82) → FMP(85)
 *   → ALPHAVANTAGE(80) → LAST_TRADE(70) → MODEL_PRICE(60) → BROKER_QUOTE(50)
 *
 * Asset-class specialisations:
 *   Mutual Funds  → AMFI_NAV → LAST_KNOWN
 *   Bonds         → YIELD_CURVE / DCF model
 *   Unlisted      → CREDHIVE → liquidity-discount model
 *   Derivatives   → BLACK_SCHOLES
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0 (Explainability, Versioning, Observability)
 * Version: 2.1.0
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import type { GoldenPrice } from "@shared/schema";
import fetch from "node-fetch";
import { indianBondService } from "../indian-bond-service";
import {
	guardedExecution,
	validateStockPrice,
	validateNav,
	validateChangePercent,
} from "../guarded-execution";
import { logger } from "../../logger";
import {
	upstoxMarketDataService,
	type UpstoxQuote,
} from "../upstox-market-data-service";

const INDIAN_API_BASE_URL =
	process.env.INDIAN_API_BASE_URL || "https://analyst.indianapi.in";

export const GOLDEN_PRICING_ENGINE_VERSION = "2.1.0";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AssetClass =
	| "equity"
	| "mutual_fund"
	| "bond"
	| "unlisted"
	| "derivative"
	| "etf"
	| "commodity";

export interface RawPrice {
	price: number;
	open?: number;
	high?: number;
	low?: number;
	volume?: number;
	changePercent?: number;
	source: string;
	confidence: number;
	metadata?: Record<string, unknown>;
}

export interface ExplainabilityLayer {
	inputs_used: Record<string, unknown>;
	formula_applied: string;
	intermediate_steps: string[];
}

export interface GoldenPriceResult {
	isin: string;
	symbol?: string;
	priceDate: string;
	assetClass: AssetClass;
	price: number;
	source: string;
	confidence: number;
	isValidated: boolean;
	isFlagged: boolean;
	flagReason?: string;
	deviationPct?: number;
	engine_version: string;
	calculation_timestamp: string;
	explainability: ExplainabilityLayer;
	metadata?: Record<string, unknown>;
}

export interface PricingJob {
	isin: string;
	symbol?: string;
	assetClass: AssetClass;
	exchange?: string;
	couponRate?: number;
	maturityDate?: string;
	faceValue?: number;
	strikePrice?: number;
	underlying?: string;
	lastRoundPrice?: number;
}

// ─── Source Confidence Map ────────────────────────────────────────────────────

export const SOURCE_CONFIDENCE: Record<string, number> = {
	NSE_BHAVCOPY: 98,
	AMFI_NAV: 97,
	UPSTOX: 96, // Upstox Developer API v2 — Licensed NSE/BSE broker feed, SEBI-compliant
	INDIAN_API: 93, // IndianAPI.in — India-native, NSE+BSE dual quotes, SEBI-safe
	BSE_CLOSE: 95,
	FMP: 85,
	YAHOO_FINANCE: 82, // Free, confirmed working from GCP datacenter
	ALPHAVANTAGE: 80,
	CREDHIVE: 75,
	YIELD_CURVE: 80,
	LAST_TRADE: 70,
	MODEL_PRICE: 60,
	BROKER_QUOTE: 50,
	BLACK_SCHOLES: 65,
};

// ─── Price Validation ─────────────────────────────────────────────────────────

/**
 * Validates price change deviation against the prior authoritative price.
 * Flags prices moving greater than 20% in a single day for SEBI/compliance audit.
 *
 * @param price Current candidate price
 * @param prevPrice Previous close price (if available)
 */
function validatePrice(
	price: number,
	prevPrice: number | null,
): { valid: boolean; deviation?: number } {
	if (!prevPrice || prevPrice <= 0) return { valid: true };
	const deviation = Math.abs(price - prevPrice) / prevPrice;
	if (deviation > 0.2) return { valid: false, deviation: deviation * 100 };
	return { valid: true, deviation: deviation * 100 };
}

// ─── Source Adapters ──────────────────────────────────────────────────────────

/**
 * Fetches equity quote from NSE India endpoint via guarded execution.
 * Note: Data centers may be blocked with 403; fails gracefully to downstream sources.
 */
async function fetchNSEClose(symbol: string): Promise<RawPrice | null> {
	return guardedExecution(
		async () => {
			const encoded = encodeURIComponent(symbol);
			const url = `https://www.nseindia.com/api/quote-equity?symbol=${encoded}`;
			const resp = await fetch(url, {
				headers: {
					"User-Agent": "Mozilla/5.0 (compatible; FintekPro/2.1)",
					Accept: "application/json",
					Referer: "https://www.nseindia.com/",
				},
				signal: AbortSignal.timeout(4000),
			});
			if (!resp.ok) return null;
			const data = (await resp.json()) as any;
			const cp = data?.priceInfo?.lastPrice ?? data?.priceInfo?.close;
			if (!cp) return null;
			const price = Number.parseFloat(cp);
			validateStockPrice(price, symbol);
			return {
				price,
				open: data?.priceInfo?.open,
				high: data?.priceInfo?.intraDayHighLow?.max,
				low: data?.priceInfo?.intraDayHighLow?.min,
				volume: data?.preOpenMarket?.totalTradedVolume,
				changePercent: validateChangePercent(data?.priceInfo?.pChange, symbol),
				source: "NSE_BHAVCOPY",
				confidence: SOURCE_CONFIDENCE.NSE_BHAVCOPY,
			};
		},
		{
			module: "pricing_engine",
			operation: "nse_close_fetch",
			input: { symbol },
			fallback: null,
			code: `NSE equity API → priceInfo.lastPrice for ${symbol}`,
		},
	);
}

/**
 * Fetches latest mutual fund Net Asset Value (NAV) from AMFI / mfapi.in.
 */
async function fetchAMFINav(isin: string): Promise<RawPrice | null> {
	return guardedExecution(
		async () => {
			const resp = await fetch(`https://api.mfapi.in/mf/latest?isin=${isin}`, {
				signal: AbortSignal.timeout(6000),
			});
			if (!resp.ok) return null;
			const data = (await resp.json()) as any;
			const nav = data?.[0]?.nav ?? data?.nav;
			if (!nav) return null;
			const price = Number.parseFloat(nav);
			validateNav(price, isin);
			return {
				price,
				source: "AMFI_NAV",
				confidence: SOURCE_CONFIDENCE.AMFI_NAV,
			};
		},
		{
			module: "pricing_engine",
			operation: "amfi_nav_fetch",
			input: { isin },
			fallback: null,
			code: `AMFI mfapi.in → nav for ISIN ${isin}`,
		},
	);
}

/**
 * Fetches US or global equity price from Financial Modeling Prep (FMP).
 */
async function fetchFMPPrice(symbol: string): Promise<RawPrice | null> {
	return guardedExecution(
		async () => {
			const apiKey =
				process.env.FMP_API_KEY ?? process.env.FINANCIAL_MODELING_PREP_API_KEY;
			if (!apiKey) return null;
			const resp = await fetch(
				`https://financialmodelingprep.com/stable/profile?symbol=${symbol}.NS&apikey=${apiKey}`,
				{ signal: AbortSignal.timeout(6000) },
			);
			if (!resp.ok) return null;
			const data = (await resp.json()) as any[];
			if (!data?.[0]?.price) return null;
			const q = data[0];
			validateStockPrice(q.price, symbol);
			return {
				price: q.price,
				open: undefined,
				high: undefined,
				low: undefined,
				volume: q.volume,
				changePercent: validateChangePercent(q.changePercentage, symbol),
				source: "FMP",
				confidence: SOURCE_CONFIDENCE.FMP,
			};
		},
		{
			module: "pricing_engine",
			operation: "fmp_price_fetch",
			input: { symbol },
			fallback: null,
			code: `FMP stable/profile → price for ${symbol}.NS`,
		},
	);
}

/**
 * Fetches stock price from IndianAPI.in.
 * Returns live NSE + BSE dual price, 52W H/L, PE, volume.
 */
async function fetchIndianAPIPrice(
	symbol: string,
): Promise<RawPrice | null> {
	const apiKey = process.env.INDIAN_API_KEY;
	if (!apiKey) return null;

	try {
		const url = `${INDIAN_API_BASE_URL}/stock?name=${encodeURIComponent(symbol.toUpperCase())}`;
		const resp = await fetch(url, {
			headers: { "X-API-Key": apiKey },
			signal: AbortSignal.timeout(6000),
		});
		if (!resp.ok) return null;
		const data = (await resp.json()) as any;

		const priceObj = data?.currentPrice;
		if (!priceObj) return null;

		const nsePrice = priceObj?.NSE
			? Number.parseFloat(String(priceObj.NSE).replace(/,/g, ""))
			: null;
		const bsePrice = priceObj?.BSE
			? Number.parseFloat(String(priceObj.BSE).replace(/,/g, ""))
			: null;
		const price = nsePrice ?? bsePrice;
		if (!price || price <= 0) return null;

		validateStockPrice(price, symbol);

		return {
			price,
			high: data?.yearHigh ? Number.parseFloat(String(data.yearHigh)) : undefined,
			low: data?.yearLow ? Number.parseFloat(String(data.yearLow)) : undefined,
			changePercent: validateChangePercent(data?.percentChange, symbol),
			source: "INDIAN_API",
			confidence: SOURCE_CONFIDENCE.INDIAN_API,
		};
	} catch {
		return null;
	}
}

/**
 * analyst.indianapi.in /historical_data — EOD close prices for a symbol over a period.
 *
 * @param symbol  NSE symbol e.g. "RELIANCE"
 * @param period  "1m" | "3m" | "6m" | "1y"
 * @returns Array of { date: string, close: number } sorted ascending
 */
export async function fetchIndianAPIHistorical(
	symbol: string,
	period: "1m" | "3m" | "6m" | "1y" = "1m",
): Promise<{ date: string; close: number }[]> {
	const apiKey = process.env.INDIAN_API_KEY;
	if (!apiKey) return [];

	try {
		const url = [
			`${INDIAN_API_BASE_URL}/historical_data`,
			`?stock_name=${encodeURIComponent(symbol.toUpperCase())}`,
			`&period=${period}&filter=default`,
		].join("");
		const resp = await fetch(url, {
			headers: { "X-API-Key": apiKey },
			signal: AbortSignal.timeout(12000),
		});
		if (!resp.ok) return [];
		const raw = (await resp.json()) as any;

		const datasets: any[] = Array.isArray(raw)
			? raw
			: Array.isArray(raw?.datasets)
			? raw.datasets
			: [];
		const priceDataset = datasets.find(
			(d: any) =>
				d?.metric === "Price" || d?.label?.toLowerCase().includes("price"),
		);
		if (!priceDataset?.values) return [];

		return (priceDataset.values as [string, string][])
			.map(([date, priceStr]) => ({
				date,
				close: Number.parseFloat(String(priceStr).replace(/,/g, "")),
			}))
			.filter((r) => r.close > 0)
			.sort((a, b) => a.date.localeCompare(b.date));
	} catch {
		return [];
	}
}

/**
 * Fetch daily historical close prices from Yahoo Finance v8/chart API.
 * No API key required. Tries NSE (.NS) suffix first, falls back to BSE (.BO).
 */
export async function fetchYahooHistorical(
	symbol: string,
	period: "1m" | "3m" | "6m" | "1y" = "1y",
): Promise<{ date: string; close: number }[]> {
	const rangeMap: Record<string, string> = {
		"1m": "1mo",
		"3m": "3mo",
		"6m": "6mo",
		"1y": "1y",
	};
	const range = rangeMap[period] ?? "1y";

	for (const suffix of [".NS", ".BO"]) {
		try {
			const ticker = `${symbol.toUpperCase()}${suffix}`;
			const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=${range}`;
			const resp = await fetch(url, {
				headers: { "User-Agent": "Mozilla/5.0 (compatible; FintekPro/2.1)" },
				signal: AbortSignal.timeout(10000),
			});
			if (!resp.ok) continue;
			const raw = (await resp.json()) as any;
			const result = raw?.chart?.result?.[0];
			if (!result) continue;

			const timestamps: number[] = result.timestamp ?? [];
			const closes: (number | null)[] =
				result.indicators?.quote?.[0]?.close ?? [];
			if (timestamps.length === 0) continue;

			const rows = timestamps
				.map((ts: number, i: number) => ({
					date: new Date(ts * 1000).toISOString().slice(0, 10),
					close: closes[i] ?? 0,
				}))
				.filter((r) => r.close > 0)
				.sort((a, b) => a.date.localeCompare(b.date));

			if (rows.length >= 5) return rows;
		} catch {
			// try next suffix
		}
	}
	return [];
}

/**
 * Fetch batch prices for an array of symbols or ISINs.
 * 1. Tries Upstox licensed batch market quote feed first (up to 500 symbols per request)
 * 2. Falls back to Yahoo Finance in parallel for any remaining missing symbols
 */
export async function fetchIndianAPIBatchPrices(
	symbols: string[],
): Promise<Map<string, number>> {
	const result = new Map<string, number>();
	if (symbols.length === 0) return result;

	// 1. Try Upstox licensed batch market quote feed first
	if (upstoxMarketDataService.isReady()) {
		try {
			const upstoxRes = await upstoxMarketDataService.getBatchQuotes(
				symbols,
				"NSE",
			);
			if (upstoxRes.success && upstoxRes.data) {
				for (const [sym, quote] of upstoxRes.data.entries()) {
					if (quote.last_price && quote.last_price > 0) {
						result.set(sym.toUpperCase(), quote.last_price);
					}
				}
				if (result.size >= symbols.length) return result;
			}
		} catch (err: any) {
			logger.warn(
				`[GoldenPricing] Upstox batch quote error: ${err?.message || err}`,
			);
		}
	}

	// 2. Resilient fallback to Yahoo Finance for any missing symbols
	const remaining = symbols.filter((s) => !result.has(s.toUpperCase()));
	if (remaining.length > 0) {
		const CHUNK_SIZE = 10;
		for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
			const slice = remaining.slice(i, i + CHUNK_SIZE);
			await Promise.allSettled(
				slice.map(async (sym) => {
					const yf = await fetchYahooFinancePrice(sym);
					if (yf?.price && yf.price > 0) {
						result.set(sym.toUpperCase(), yf.price);
					}
				}),
			);
		}
	}

	return result;
}

/**
 * Yahoo Finance chart API — free, verified reliable from GCP Cloud Run.
 * Tries NSE (.NS) first, then BSE (.BO).
 */
async function fetchYahooFinancePrice(
	symbol: string,
	exchange: "NSE" | "BSE" = "NSE",
): Promise<RawPrice | null> {
	const suffixes = exchange === "BSE" ? [".BO", ".NS"] : [".NS", ".BO"];

	for (const suffix of suffixes) {
		try {
			const ticker = encodeURIComponent(`${symbol}${suffix}`);
			const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
			const resp = await fetch(url, {
				headers: { "User-Agent": "Mozilla/5.0 (compatible; FintekPro/2.1)" },
				signal: AbortSignal.timeout(6000),
			});
			if (!resp.ok) continue;
			const data = (await resp.json()) as any;
			const meta = data?.chart?.result?.[0]?.meta;
			if (!meta) continue;

			const price = meta.regularMarketPrice ?? meta.chartPreviousClose;
			if (!price || price <= 0) continue;

			validateStockPrice(price, symbol);

			const quote = data?.chart?.result?.[0]?.indicators?.quote?.[0];
			const timestamps: number[] = data?.chart?.result?.[0]?.timestamp ?? [];
			const lastIdx = timestamps.length - 1;

			return {
				price,
				open: lastIdx >= 0 ? (quote?.open?.[lastIdx] ?? undefined) : undefined,
				high: lastIdx >= 0 ? (quote?.high?.[lastIdx] ?? undefined) : undefined,
				low: lastIdx >= 0 ? (quote?.low?.[lastIdx] ?? undefined) : undefined,
				volume:
					lastIdx >= 0 ? (quote?.volume?.[lastIdx] ?? undefined) : undefined,
				changePercent: validateChangePercent(
					meta.regularMarketChangePercent,
					symbol,
				),
				source: "YAHOO_FINANCE",
				confidence: SOURCE_CONFIDENCE.YAHOO_FINANCE,
			};
		} catch {
			// try next suffix
		}
	}
	return null;
}

/**
 * Fetches the most recent authoritative golden price from DB history for this ISIN.
 */
async function fetchLastKnownPrice(
	isin: string,
	priceDate: string,
): Promise<RawPrice | null> {
	try {
		const row = await db.execute(sql`
      SELECT price, source FROM golden_prices
      WHERE isin = ${isin} AND price_date < ${priceDate}
      ORDER BY price_date DESC LIMIT 1
    `);
		if (!row.rows?.[0]) return null;
		const r = row.rows[0] as any;
		return {
			price: Number.parseFloat(r.price),
			source: "LAST_TRADE",
			confidence: SOURCE_CONFIDENCE.LAST_TRADE,
		};
	} catch {
		return null;
	}
}

// ── Bond pricing: DCF / yield-curve ──────────────────────────────────────────

function priceBond(
	faceValue: number,
	couponRate: number,
	yieldRate: number,
	yearsToMaturity: number,
): number {
	let price = 0;
	const periods = Math.max(1, Math.round(yearsToMaturity));
	for (let t = 1; t <= periods; t++) {
		price += (faceValue * couponRate) / (1 + yieldRate) ** t;
	}
	price += faceValue / (1 + yieldRate) ** periods;
	return Math.round(price * 100) / 100;
}

async function fetchBondPrice(job: PricingJob): Promise<RawPrice | null> {
	if (!job.faceValue || !job.couponRate || !job.maturityDate) return null;
	try {
		const maturity = new Date(job.maturityDate);
		const now = new Date();
		const years = Math.max(
			0.5,
			(maturity.getTime() - now.getTime()) / (365.25 * 24 * 3600 * 1000),
		);

		const ytmResult = await indianBondService.getIndiaYTM(years);
		const yieldRate = ytmResult.ytm / 100;

		const price = priceBond(
			job.faceValue,
			job.couponRate / 100,
			yieldRate,
			years,
		);
		return {
			price,
			source: "YIELD_CURVE",
			confidence: SOURCE_CONFIDENCE.YIELD_CURVE,
			metadata: {
				ytm: ytmResult.ytm,
				ytmSource: ytmResult.source,
				tenorYears: years,
				asOf: ytmResult.asOf,
			},
		};
	} catch {
		return null;
	}
}

// ── Unlisted: Credhive → liquidity discount ───────────────────────────────────

async function fetchUnlistedPrice(
	isin: string,
	job: PricingJob,
): Promise<RawPrice | null> {
	try {
		const apiKey = process.env.CREDHIVE_API_KEY;
		const baseUrl =
			process.env.CREDHIVE_BASE_URL || "https://api.credhive.in/v1";
		if (apiKey) {
			const resp = await fetch(`${baseUrl}/company/search?isin=${isin}`, {
				headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
				signal: AbortSignal.timeout(6000),
			});
			if (resp.ok) {
				const data = (await resp.json()) as any;
				const val = data?.last_funding_valuation ?? data?.estimated_valuation;
				const shares = data?.total_shares ?? data?.shares_outstanding;
				if (val && shares && shares > 0) {
					const rawPrice = val / shares;
					const liquidityDiscount = 0.3;
					return {
						price: Math.round(rawPrice * (1 - liquidityDiscount) * 100) / 100,
						source: "CREDHIVE",
						confidence: SOURCE_CONFIDENCE.CREDHIVE,
					};
				}
			}
		}
	} catch {}

	if (job.lastRoundPrice) {
		const liquidityDiscount = 0.3;
		return {
			price:
				Math.round(job.lastRoundPrice * (1 - liquidityDiscount) * 100) / 100,
			source: "MODEL_PRICE",
			confidence: SOURCE_CONFIDENCE.MODEL_PRICE,
		};
	}
	return null;
}

// ── Derivatives: Black-Scholes (call option) ──────────────────────────────────

function normalCDF(x: number): number {
	const a1 = 0.254829592,
		a2 = -0.284496736,
		a3 = 1.421413741;
	const a4 = -1.453152027,
		a5 = 1.061405429,
		p = 0.3275911;
	const sign = x < 0 ? -1 : 1;
	const t = 1 / (1 + p * Math.abs(x));
	const y =
		1 -
		((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp((-x * x) / 2);
	return 0.5 * (1 + sign * y);
}

function blackScholes(
	S: number,
	K: number,
	r: number,
	t: number,
	sigma: number,
): number {
	if (t <= 0) return Math.max(S - K, 0);
	const sqrtT = Math.sqrt(t);
	const d1 =
		(Math.log(S / K) + (r + (sigma * sigma) / 2) * t) / (sigma * sqrtT);
	const d2 = d1 - sigma * sqrtT;
	return S * normalCDF(d1) - K * Math.exp(-r * t) * normalCDF(d2);
}

async function fetchDerivativePrice(
	job: PricingJob,
	underlyingPrice: number,
): Promise<RawPrice | null> {
	if (!job.strikePrice) return null;
	try {
		const maturity = job.maturityDate
			? new Date(job.maturityDate)
			: new Date(Date.now() + 30 * 24 * 3600 * 1000);
		const t = Math.max(
			0.01,
			(maturity.getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000),
		);
		const r = 0.065;
		const sigma = 0.25;
		const price = blackScholes(underlyingPrice, job.strikePrice, r, t, sigma);
		return {
			price: Math.round(price * 100) / 100,
			source: "BLACK_SCHOLES",
			confidence: SOURCE_CONFIDENCE.BLACK_SCHOLES,
		};
	} catch {
		return null;
	}
}

// ─── Hierarchy Waterfall ──────────────────────────────────────────────────────

/**
 * Discovers the authoritative golden price for an instrument across multi-tier hierarchy.
 *
 * Tier order:
 *  - Mutual funds: AMFI NAV → Last Known Price
 *  - Bonds: DCF / Yield Curve → Last Known Price
 *  - Unlisted: CredHive / Valuation → Last Known Price
 *  - Equity / ETF / Commodity:
 *    1. Pre-fetched Upstox Quote (bulk cache)
 *    2. Live Upstox Market Quote (SEBI licensed)
 *    3. Official NSE Bhavcopy in local DB (0 network latency)
 *    4. IndianAPI Dual NSE/BSE Quote
 *    5. Yahoo Finance
 *    6. FMP Profile
 *    7. Last Authoritative Golden Price
 */
async function discoverBestPrice(
	job: PricingJob,
	priceDate: string,
	preFetchedQuote?: UpstoxQuote,
): Promise<RawPrice | null> {
	const { isin, assetClass } = job;

	// 1. Mutual Funds — AMFI with reliable fallback
	if (assetClass === "mutual_fund") {
		const amfi = await fetchAMFINav(isin);
		if (amfi?.price) return amfi;
		return await fetchLastKnownPrice(isin, priceDate);
	}

	// 2. Bonds
	if (assetClass === "bond") {
		return (
			(await fetchBondPrice(job)) ??
			(await fetchLastKnownPrice(isin, priceDate))
		);
	}

	// 3. Unlisted Stocks
	if (assetClass === "unlisted") {
		return (
			(await fetchUnlistedPrice(isin, job)) ??
			(await fetchLastKnownPrice(isin, priceDate))
		);
	}

	// 4. Derivatives
	if (assetClass === "derivative") {
		const underlyingSymbol = job.underlying ?? job.symbol;
		let uPrice = 0;

		if (underlyingSymbol) {
			const gpRow = await db
				.execute(sql`
        SELECT price FROM golden_prices WHERE symbol = ${underlyingSymbol}
        ORDER BY price_date DESC LIMIT 1
      `)
				.catch(() => ({ rows: [] }));
			if (gpRow.rows?.[0]) {
				uPrice = Number.parseFloat((gpRow.rows[0] as any).price);
			}
		}

		if (uPrice <= 0 && underlyingSymbol) {
			const nseQuote = await fetchNSEClose(underlyingSymbol);
			if (nseQuote?.price) uPrice = nseQuote.price;
		}

		if (uPrice <= 0 && underlyingSymbol) {
			const fmpQuote = await fetchFMPPrice(underlyingSymbol);
			if (fmpQuote?.price) uPrice = fmpQuote.price;
		}

		if (uPrice > 0) {
			const deriv = await fetchDerivativePrice(job, uPrice);
			if (deriv) return deriv;
		}
		return await fetchLastKnownPrice(isin, priceDate);
	}

	// 5. Equity / ETF / Commodity Waterfall
	// Resolve missing symbol from DB if only ISIN was passed
	let resolvedSymbol = job.symbol;
	if (!resolvedSymbol && isin) {
		const stockRow = await db
			.execute(sql`
      SELECT symbol, exchange FROM listed_stocks WHERE isin = ${isin} LIMIT 1
    `)
			.catch(() => ({ rows: [] }));
		if (stockRow.rows?.[0]) {
			resolvedSymbol = (stockRow.rows[0] as any).symbol;
			if (!job.exchange) job.exchange = (stockRow.rows[0] as any).exchange;
		}
	}

	// 5a. Use pre-fetched Upstox quote if available
	if (preFetchedQuote?.last_price && preFetchedQuote.last_price > 0) {
		validateStockPrice(preFetchedQuote.last_price, resolvedSymbol || isin);
		return {
			price: preFetchedQuote.last_price,
			open: preFetchedQuote.open_price,
			high: preFetchedQuote.high_price,
			low: preFetchedQuote.low_price,
			changePercent: preFetchedQuote.change_percent,
			source: "UPSTOX",
			confidence: SOURCE_CONFIDENCE.UPSTOX,
		};
	}

	const queryTarget = resolvedSymbol || isin;

	// 5b. Live Upstox Quote (Licensed SEBI feed)
	if (queryTarget && upstoxMarketDataService.isReady()) {
		try {
			const upstoxRes = await upstoxMarketDataService.getQuote(
				queryTarget,
				job.exchange === "BSE" ? "BSE" : "NSE",
			);
			if (upstoxRes.success && upstoxRes.data?.last_price) {
				const q = upstoxRes.data;
				validateStockPrice(q.last_price, queryTarget);
				return {
					price: q.last_price,
					open: q.open_price,
					high: q.high_price,
					low: q.low_price,
					changePercent: q.change_percent,
					source: "UPSTOX",
					confidence: SOURCE_CONFIDENCE.UPSTOX,
				};
			}
		} catch (err: any) {
			logger.warn(
				`[GoldenPricing] Upstox quote failed for ${queryTarget}: ${err?.message || err}`,
			);
		}
	}

	// 5c. Official Bhavcopy in local DB (populated by nightly Bhavcopy Ingestion, 0 network lag)
	if (resolvedSymbol || isin) {
		const bhavRow = await db
			.execute(sql`
      SELECT current_price, previous_close, change_percent
      FROM listed_stocks
      WHERE (isin = ${isin} OR symbol = ${resolvedSymbol ?? null})
        AND current_price IS NOT NULL AND current_price > 0
      LIMIT 1
    `)
			.catch(() => ({ rows: [] }));
		if (bhavRow.rows?.[0]) {
			const r = bhavRow.rows[0] as any;
			const price = Number.parseFloat(r.current_price);
			if (price > 0) {
				return {
					price,
					changePercent: r.change_percent
						? Number.parseFloat(r.change_percent)
						: undefined,
					source: "NSE_BHAVCOPY",
					confidence: SOURCE_CONFIDENCE.NSE_BHAVCOPY,
				};
			}
		}
	}

	// 5d. IndianAPI.in Dual Quote
	if (resolvedSymbol) {
		const indianApi = await fetchIndianAPIPrice(resolvedSymbol);
		if (indianApi?.price) return indianApi;
	}

	// 5e. Yahoo Finance
	if (resolvedSymbol) {
		const yahoo = await fetchYahooFinancePrice(
			resolvedSymbol,
			job.exchange === "BSE" ? "BSE" : "NSE",
		);
		if (yahoo?.price) return yahoo;
	}

	// 5f. FMP Profile
	if (resolvedSymbol) {
		const fmp = await fetchFMPPrice(resolvedSymbol);
		if (fmp?.price) return fmp;
	}

	// 5g. Direct NSE Scraping fallback
	if (resolvedSymbol) {
		const nse = await fetchNSEClose(resolvedSymbol);
		if (nse?.price) return nse;
	}

	// 5h. Last known authoritative price
	return await fetchLastKnownPrice(isin, priceDate);
}

// ─── Core: Price One Instrument ───────────────────────────────────────────────

/**
 * Computes the authoritative golden price for an instrument on a given date.
 * Enforces validation, audit trail, versioning, and explainability layer.
 *
 * @param job Instrument pricing parameters
 * @param priceDate Date string "YYYY-MM-DD"
 * @param opts Configuration options
 */
export async function priceInstrument(
	job: PricingJob,
	priceDate: string,
	opts: {
		changedBy?: string;
		dryRun?: boolean;
		preFetchedQuote?: UpstoxQuote;
	} = {},
): Promise<GoldenPriceResult | null> {
	const { isin, symbol, assetClass = "equity" } = job;
	const { changedBy = "system", dryRun = false, preFetchedQuote } = opts;

	const raw = await discoverBestPrice(job, priceDate, preFetchedQuote);
	if (!raw?.price || raw.price <= 0) return null;

	const prevRow = await db
		.execute(sql`
    SELECT price FROM golden_prices WHERE isin = ${isin} ORDER BY price_date DESC LIMIT 1
  `)
		.catch(() => ({ rows: [] }));
	const prevPrice = prevRow.rows?.[0]
		? Number.parseFloat((prevRow.rows[0] as any).price)
		: null;

	const { valid, deviation } = validatePrice(raw.price, prevPrice);

	const calcTimestamp = new Date().toISOString();
	const explainability: ExplainabilityLayer = {
		inputs_used: {
			isin,
			symbol,
			assetClass,
			priceDate,
			prevPrice,
			source: raw.source,
			confidence: raw.confidence,
		},
		formula_applied: `${raw.source}_HIERARCHICAL_DISCOVERY`,
		intermediate_steps: [
			`Discovered candidate price ₹${raw.price} from source '${raw.source}' (confidence: ${raw.confidence})`,
			prevPrice
				? `Prior price: ₹${prevPrice}. Calculated deviation: ${(deviation ?? 0).toFixed(2)}%`
				: "No prior reference price found. Baseline initialization.",
			valid
				? "Validation passed (deviation within allowable 20% band)"
				: `FLAGGED: Deviation of ${(deviation ?? 0).toFixed(1)}% exceeds 20% limit. Compliance audit triggered.`,
		],
	};

	const result: GoldenPriceResult = {
		isin,
		symbol,
		priceDate,
		assetClass,
		price: raw.price,
		source: raw.source,
		confidence: raw.confidence,
		isValidated: valid,
		isFlagged: !valid,
		flagReason: !valid
			? `Price deviation ${deviation?.toFixed(1)}% exceeds 20% threshold`
			: undefined,
		deviationPct: deviation,
		engine_version: GOLDEN_PRICING_ENGINE_VERSION,
		calculation_timestamp: calcTimestamp,
		explainability,
		metadata: {
			open: raw.open,
			high: raw.high,
			low: raw.low,
			volume: raw.volume,
			changePercent: raw.changePercent,
			engine_version: GOLDEN_PRICING_ENGINE_VERSION,
			calculation_timestamp: calcTimestamp,
			explainability,
			...raw.metadata,
		},
	};

	if (dryRun) return result;

	// Upsert into golden_prices
	const existing = await db
		.execute(sql`
    SELECT id, price, source FROM golden_prices WHERE isin = ${isin} AND price_date = ${priceDate} LIMIT 1
  `)
		.catch(() => ({ rows: [] }));

	if (existing.rows?.[0]) {
		const ex = existing.rows[0] as any;
		await db.execute(sql`
      UPDATE golden_prices SET
        price = ${raw.price},
        open_price = ${raw.open ?? null},
        high_price = ${raw.high ?? null},
        low_price = ${raw.low ?? null},
        volume = ${raw.volume ?? null},
        change_percent = ${raw.changePercent ?? null},
        source = ${raw.source},
        confidence_score = ${raw.confidence},
        is_validated = ${valid},
        is_stale = false,
        is_flagged = ${!valid},
        flag_reason = ${result.flagReason ?? null},
        previous_price = ${prevPrice ?? null},
        deviation_pct = ${deviation ?? null},
        metadata = ${JSON.stringify(result.metadata)}::jsonb,
        updated_at = NOW()
      WHERE isin = ${isin} AND price_date = ${priceDate}
    `);

		if (Number.parseFloat(ex.price) !== raw.price) {
			await db.execute(sql`
        INSERT INTO price_audit_log (
          isin, price_date, old_price, new_price, old_source, new_source,
          change_reason, changed_by, confidence_score, metadata
        ) VALUES (
          ${isin}, ${priceDate}, ${ex.price}, ${raw.price}, ${ex.source}, ${raw.source},
          ${"Authoritative golden price update"}, ${changedBy}, ${raw.confidence},
          ${JSON.stringify({ engine_version: GOLDEN_PRICING_ENGINE_VERSION, explainability })}::jsonb
        )
      `);
		}
	} else {
		await db.execute(sql`
      INSERT INTO golden_prices (
        isin, symbol, price_date, asset_class, price, open_price, high_price, low_price,
        volume, change_percent, source, confidence_score, is_validated, is_stale,
        is_flagged, flag_reason, previous_price, deviation_pct, currency, metadata
      ) VALUES (
        ${isin}, ${symbol ?? null}, ${priceDate}, ${assetClass},
        ${raw.price}, ${raw.open ?? null}, ${raw.high ?? null}, ${raw.low ?? null},
        ${raw.volume ?? null}, ${raw.changePercent ?? null}, ${raw.source}, ${raw.confidence},
        ${valid}, false, ${!valid}, ${result.flagReason ?? null},
        ${prevPrice ?? null}, ${deviation ?? null}, 'INR', ${JSON.stringify(result.metadata)}::jsonb
      )
    `);
		await db.execute(sql`
      INSERT INTO price_audit_log (
        isin, price_date, new_price, new_source, change_reason, changed_by,
        confidence_score, metadata
      ) VALUES (
        ${isin}, ${priceDate}, ${raw.price}, ${raw.source},
        ${"Initial authoritative golden price established"}, ${changedBy}, ${raw.confidence},
        ${JSON.stringify({ engine_version: GOLDEN_PRICING_ENGINE_VERSION, explainability })}::jsonb
      )
    `);
	}

	return result;
}

// ─── Batch Daily Pricing Run ──────────────────────────────────────────────────

export interface DailyPricingRunResult {
	date: string;
	processed: number;
	succeeded: number;
	failed: number;
	flagged: number;
	durationMs: number;
	errors: string[];
}

/**
 * Runs the nightly EOD Golden Pricing Run across all active instruments.
 * Upgraded with Upstox bulk pre-fetching (chunks of 500) to eliminate N+1 latency.
 */
export async function runDailyGoldenPricing(
	priceDate?: string,
	opts: { batchSize?: number; delayMs?: number } = {},
): Promise<DailyPricingRunResult> {
	const { batchSize = 25, delayMs = 100 } = opts;
	const date = priceDate ?? new Date().toISOString().slice(0, 10);
	const start = Date.now();

	logger.info(`[GoldenPricing] Starting daily run for ${date}...`, {
		event: "GOLDEN_PRICING_DAILY_START",
		price_date: date,
	});

	let processed = 0,
		succeeded = 0,
		failed = 0,
		flagged = 0;
	const errors: string[] = [];

	// Fetch all instruments that need pricing
	const instruments = await db
		.execute(sql`
    SELECT
      ls.isin, ls.symbol, ls.exchange,
      CASE
        WHEN ls.instrument_type IN ('ETF', 'etf') THEN 'etf'
        ELSE 'equity'
      END as asset_class
    FROM listed_stocks ls
    WHERE ls.isin IS NOT NULL
      AND ls.is_active = true
    LIMIT 2000
  `)
		.catch(() => ({ rows: [] }));

	const jobs: PricingJob[] = (instruments.rows as any[]).map((r) => ({
		isin: r.isin,
		symbol: r.symbol,
		assetClass: r.asset_class as AssetClass,
		exchange: r.exchange,
	}));

	// Also fetch mutual funds
	const mfRows = await db
		.execute(sql`
    SELECT isin, symbol FROM mf_schemes WHERE isin IS NOT NULL LIMIT 1000
  `)
		.catch(() => ({ rows: [] }));

	for (const r of mfRows.rows as any[]) {
		jobs.push({ isin: r.isin, symbol: r.symbol, assetClass: "mutual_fund" });
	}

	// ── Bulk Pre-fetch Upstox Quotes in chunks of 500 (Eliminates 2,000 single HTTP calls)
	const equitySymbols = jobs
		.filter(
			(j) =>
				(j.assetClass === "equity" || j.assetClass === "etf") &&
				Boolean(j.symbol),
		)
		.map((j) => j.symbol as string);

	const preFetchedMap = new Map<string, UpstoxQuote>();
	if (equitySymbols.length > 0 && upstoxMarketDataService.isReady()) {
		try {
			logger.info(
				`[GoldenPricing] Pre-fetching batch quotes for ${equitySymbols.length} equities...`,
			);
			const batchRes = await upstoxMarketDataService.getBatchQuotes(
				equitySymbols,
				"NSE",
			);
			if (batchRes.success && batchRes.data) {
				for (const [sym, quote] of batchRes.data.entries()) {
					if (quote.last_price && quote.last_price > 0) {
						preFetchedMap.set(sym.toUpperCase(), quote);
					}
				}
				logger.info(
					`[GoldenPricing] Batch pre-fetch resolved ${preFetchedMap.size}/${equitySymbols.length} symbols`,
				);
			}
		} catch (err: any) {
			logger.warn(
				`[GoldenPricing] Bulk pre-fetch failed (will fall back to single discovery): ${err?.message || err}`,
			);
		}
	}

	// Process in batches
	for (let i = 0; i < jobs.length; i += batchSize) {
		const batch = jobs.slice(i, i + batchSize);
		await Promise.allSettled(
			batch.map(async (job) => {
				processed++;
				try {
					const preQuote = job.symbol
						? preFetchedMap.get(job.symbol.toUpperCase())
						: undefined;
					const result = await priceInstrument(job, date, {
						preFetchedQuote: preQuote,
					});
					if (!result) {
						failed++;
						return;
					}
					succeeded++;
					if (result.isFlagged) flagged++;
				} catch (e: any) {
					failed++;
					errors.push(`${job.isin}: ${e?.message}`);
				}
			}),
		);

		if (i + batchSize < jobs.length && delayMs > 0) {
			await new Promise((r) => setTimeout(r, delayMs));
		}
	}

	const durationMs = Date.now() - start;
	logger.info(
		`[GoldenPricing] Daily run complete: ${succeeded}/${processed} priced, ${flagged} flagged, ${failed} failed in ${durationMs}ms`,
		{
			event: "GOLDEN_PRICING_DAILY_COMPLETE",
			price_date: date,
			succeeded,
			processed,
			flagged,
			failed,
			latency_ms: durationMs,
		},
	);

	return { date, processed, succeeded, failed, flagged, durationMs, errors };
}

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

export async function getGoldenPrice(
	isin: string,
	priceDate?: string,
): Promise<GoldenPrice | null> {
	const date = priceDate ?? new Date().toISOString().slice(0, 10);
	const rows = await db
		.execute(sql`
    SELECT * FROM golden_prices WHERE isin = ${isin} AND price_date = ${date} LIMIT 1
  `)
		.catch(() => ({ rows: [] }));
	return (rows.rows?.[0] as any) ?? null;
}

export async function getLatestGoldenPrice(
	isin: string,
): Promise<GoldenPriceRow | null> {
	const rows = await db
		.execute(sql`
    SELECT * FROM golden_prices WHERE isin = ${isin} ORDER BY price_date DESC LIMIT 1
  `)
		.catch(() => ({ rows: [] }));
	return (rows.rows?.[0] as any) ?? null;
}

export async function batchGetGoldenPrices(
	isins: string[],
	priceDate?: string,
): Promise<Record<string, GoldenPriceRow>> {
	if (!isins.length) return {};
	const date = priceDate ?? new Date().toISOString().slice(0, 10);

	const inParts = isins.map((i) => sql`${i}`);
	const inClause = sql.join(inParts, sql`, `);

	const rows = await db
		.execute(sql`
    SELECT * FROM golden_prices WHERE isin IN (${inClause}) AND price_date = ${date}
  `)
		.catch(() => ({ rows: [] }));

	const out: Record<string, GoldenPriceRow> = {};
	for (const r of rows.rows as any[]) out[r.isin] = r;
	return out;
}

// ─── Types re-exported ────────────────────────────────────────────────────────
type GoldenPriceRow = {
	id: number;
	isin: string;
	symbol?: string;
	price_date: string;
	asset_class: string;
	price: string;
	open_price?: string | number | null;
	high_price?: string | number | null;
	low_price?: string | number | null;
	volume?: string | number | null;
	change_percent?: string | number | null;
	source: string;
	confidence_score: number;
	is_validated: boolean;
	is_stale: boolean;
	is_flagged: boolean;
	flag_reason?: string;
	previous_price?: string;
	deviation_pct?: string;
	currency?: string;
	metadata?: Record<string, unknown>;
	created_at: string;
	updated_at: string;
};

export type { GoldenPriceRow };
