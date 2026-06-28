// @ts-nocheck
/**
 * Bloomberg-Style Golden Source Pricing Engine
 *
 * Produces a single authoritative "golden price" per instrument per date
 * using a multi-source hierarchy with validation, audit trail, and confidence scoring.
 *
 * Source Hierarchy (equity):
 *   NSE_BHAVCOPY(98) → INDIAN_API(93) → YAHOO_FINANCE(82) → FMP(85)
 *   → ALPHAVANTAGE(80) → LAST_TRADE(70) → MODEL_PRICE(60) → BROKER_QUOTE(50)
 *
 * Indian Sources:
 *   IndianAPI.in /stock         → live NSE+BSE dual quote (API key in Secret Manager)
 *   IndianAPI.in /historical_data → EOD close backfill (daily prices, 1m-1y range)
 *   IndianAPI.in /nse_stock_batch_live_price → bulk 5000-stock pricing runs
 *
 * Asset-class specialisations:
 *   Mutual Funds  → AMFI_NAV
 *   Bonds         → YIELD_CURVE / DCF model
 *   Unlisted      → CREDHIVE → liquidity-discount model
 *   Derivatives   → BLACK_SCHOLES
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { goldenPrices, priceAuditLog } from "../../../shared/schema";
import fetch from "node-fetch";
import { indianBondService } from "../indian-bond-service";
import {
	guardedExecution,
	validateStockPrice,
	validateNav,
	validateChangePercent,
} from "../guarded-execution";

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
	metadata?: Record<string, unknown>;
}

interface PricingJob {
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

const SOURCE_CONFIDENCE: Record<string, number> = {
	NSE_BHAVCOPY: 98,
	AMFI_NAV: 97,
	INDIAN_API: 93,    // IndianAPI.in — India-native, NSE+BSE dual quotes, SEBI-safe, INDIAN_API_KEY in Secret Manager
	BSE_CLOSE: 95,
	FMP: 85,
	YAHOO_FINANCE: 82, // Free, no API key, confirmed working from GCP datacenter
	ALPHAVANTAGE: 80,
	CREDHIVE: 75,
	YIELD_CURVE: 80,
	LAST_TRADE: 70,
	MODEL_PRICE: 60,
	BROKER_QUOTE: 50,
	BLACK_SCHOLES: 65,
};

// ─── Price Validation ─────────────────────────────────────────────────────────

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

async function fetchNSEClose(symbol: string): Promise<RawPrice | null> {
	return guardedExecution(
		async () => {
			const encoded = encodeURIComponent(symbol);
			const url = `https://www.nseindia.com/api/quote-equity?symbol=${encoded}`;
			const resp = await fetch(url, {
				headers: {
					"User-Agent": "Mozilla/5.0",
					Accept: "application/json",
					Referer: "https://www.nseindia.com/",
				},
				signal: AbortSignal.timeout(6000),
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

async function fetchFMPPrice(symbol: string): Promise<RawPrice | null> {
	return guardedExecution(
		async () => {
			const apiKey =
				process.env.FMP_API_KEY ?? process.env.FINANCIAL_MODELING_PREP_API_KEY;
			if (!apiKey) return null;
			const resp = await fetch(
				`https://financialmodelingprep.com/stable/profile?symbol=${symbol}.NS&apikey=${apiKey}`,
				{ signal: AbortSignal.timeout(8000) },
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

// ── Indian-Native Sources ─────────────────────────────────────────────────────

/**
 * IndianAPI.in /stock endpoint — India's primary market data API.
 * Returns live NSE + BSE dual price, 52W H/L, PE, volume.
 * Requires INDIAN_API_KEY (stored in Secret Manager as INDIAN_API_KEY:latest).
 *
 * Response: { currentPrice: { NSE: '1318.10', BSE: '1318.25' }, percentChange, yearHigh, yearLow }
 * Confidence: 93 — India-native, SEBI-safe, dedicated growth plan (300 req/min)
 */
async function fetchIndianAPIPrice(
	symbol: string,
): Promise<RawPrice | null> {
	const apiKey = process.env.INDIAN_API_KEY;
	if (!apiKey) return null;

	try {
		const url = `https://analyst.indianapi.in/stock?name=${encodeURIComponent(symbol.toUpperCase())}`;
		const resp = await fetch(url, {
			headers: { "X-API-Key": apiKey },
			signal: AbortSignal.timeout(8000),
		});
		if (!resp.ok) return null;
		const data = (await resp.json()) as any;

		// currentPrice is { NSE: '1318.10', BSE: '1318.25' }
		const priceObj = data?.currentPrice;
		if (!priceObj) return null;

		const nsePrice = priceObj?.NSE ? Number.parseFloat(String(priceObj.NSE).replace(/,/g, "")) : null;
		const bsePrice = priceObj?.BSE ? Number.parseFloat(String(priceObj.BSE).replace(/,/g, "")) : null;
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
 * IndianAPI.in /historical_data — EOD close prices for a symbol over a period.
 * Returns array of { metric, label, values: [[date, price], ...] }.
 * Used for backfilling historical_nav_data for equity instruments.
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
			`https://analyst.indianapi.in/historical_data`,
			`?stock_name=${encodeURIComponent(symbol.toUpperCase())}`,
			`&period=${period}&filter=default`,
		].join("");
		const resp = await fetch(url, {
			headers: { "X-API-Key": apiKey },
			signal: AbortSignal.timeout(15000),
		});
		if (!resp.ok) return [];
		const raw = (await resp.json()) as any[];

		// raw = [{ metric, label, values: [[date, priceStr], ...] }, ...]
		const priceDataset = Array.isArray(raw)
			? raw.find((d: any) => d?.metric === "Price" || d?.label?.toLowerCase().includes("price"))
			: null;
		if (!priceDataset?.values) return [];

		return (priceDataset.values as [string, string][])
			.map(([date, priceStr]) => ({
				date,
				close: Number.parseFloat(priceStr.replace(/,/g, "")),
			}))
			.filter((r) => r.close > 0)
			.sort((a, b) => a.date.localeCompare(b.date));
	} catch {
		return [];
	}
}

/**
 * IndianAPI.in /nse_stock_batch_live_price — bulk live prices for up to 500 NSE symbols.
 * Used by the EOD Golden Pricing Engine batch run for all listed stocks.
 *
 * @param symbols  Array of NSE symbols
 * @returns Map of symbol → price
 */
export async function fetchIndianAPIBatchPrices(
	symbols: string[],
): Promise<Map<string, number>> {
	const result = new Map<string, number>();
	const apiKey = process.env.INDIAN_API_KEY;
	if (!apiKey || symbols.length === 0) return result;

	// Process in chunks of 100 (API limit)
	const CHUNK_SIZE = 100;
	for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
		const chunk = symbols.slice(i, i + CHUNK_SIZE);
		try {
			const resp = await fetch(
				"https://analyst.indianapi.in/nse_stock_batch_live_price",
				{
					method: "POST",
					headers: {
						"X-API-Key": apiKey,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ stock_ids: chunk.map((s) => s.toUpperCase()) }),
					signal: AbortSignal.timeout(15000),
				},
			);
			if (!resp.ok) continue;
			const data = (await resp.json()) as any;
			// Response is { RELIANCE: { price: 1318.10, ... }, TCS: { ... }, ... }
			if (typeof data === "object" && data !== null) {
				for (const [sym, info] of Object.entries(data)) {
					const p = (info as any)?.price ?? (info as any)?.currentPrice ?? (info as any)?.last_price;
					if (p && Number(p) > 0) result.set(sym.toUpperCase(), Number(p));
				}
			}
		} catch {
			// continue with next chunk
		}
		// Respect 300 req/min rate limit — 100ms between chunks
		if (i + CHUNK_SIZE < symbols.length) {
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	return result;
}

/**
 * Yahoo Finance chart API — free, no API key, confirmed working from GCP datacenter.
 * Tries NSE (.NS suffix) first, BSE (.BO) as fallback.
 * Used as priority-3 in the equity waterfall when NSE direct is 403-blocked.
 *
 * Confidence: 82 (higher than AlphaVantage, below FMP)
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
				headers: { "User-Agent": "Mozilla/5.0" },
				signal: AbortSignal.timeout(8000),
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
				volume: lastIdx >= 0 ? (quote?.volume?.[lastIdx] ?? undefined) : undefined,
				changePercent: validateChangePercent(meta.regularMarketChangePercent, symbol),
				source: "YAHOO_FINANCE",
				confidence: SOURCE_CONFIDENCE.YAHOO_FINANCE,
			};
		} catch {
			// try next suffix
		}
	}
	return null;
}

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

		// Fetch live India G-Sec yield for this tenor from IndianBondService
		// Sources: FMP treasury-rates (confirmed ✅) → AlphaVantage 10Y (✅) → RBI repo fallback
		const ytmResult = await indianBondService.getIndiaYTM(years);
		const yieldRate = ytmResult.ytm / 100; // convert % to decimal

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
			// @ts-ignore — metadata passthrough for audit trail
			metadata: { ytm: ytmResult.ytm, ytmSource: ytmResult.source, tenorYears: years, asOf: ytmResult.asOf },
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
				signal: AbortSignal.timeout(8000),
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

async function discoverBestPrice(
	job: PricingJob,
	priceDate: string,
): Promise<RawPrice | null> {
	const { isin, symbol, assetClass } = job;

	if (assetClass === "mutual_fund") {
		return (await fetchAMFINav(isin)) ?? null;
	}

	if (assetClass === "bond") {
		return (
			(await fetchBondPrice(job)) ??
			(await fetchLastKnownPrice(isin, priceDate))
		);
	}

	if (assetClass === "unlisted") {
		return (
			(await fetchUnlistedPrice(isin, job)) ??
			(await fetchLastKnownPrice(isin, priceDate))
		);
	}

	if (assetClass === "derivative") {
		const underlyingSymbol = job.underlying ?? symbol;
		let uPrice = 0;

		// 1. Try golden_prices DB for underlying first (fastest, no external call)
		if (underlyingSymbol) {
			const gpRow = await db
				.execute(sql`
        SELECT price FROM golden_prices WHERE symbol = ${underlyingSymbol}
        ORDER BY price_date DESC LIMIT 1
      `)
				.catch(() => ({ rows: [] }));
			if (gpRow.rows?.[0])
				uPrice = Number.parseFloat((gpRow.rows[0] as any).price);
		}

		// 2. Fallback: live NSE quote
		if (uPrice <= 0 && underlyingSymbol) {
			const nseQuote = await fetchNSEClose(underlyingSymbol);
			if (nseQuote?.price) uPrice = nseQuote.price;
		}

		// 3. Fallback: FMP
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

	// Equity / ETF / Commodity waterfall:
	// NSE_BHAVCOPY(98) → INDIAN_API(93) → YAHOO_FINANCE(82) → FMP(85) → LAST_KNOWN
	if (symbol) {
		// 1. NSE direct — primary (403 blocked from datacenter IPs, fails gracefully)
		const nse = await fetchNSEClose(symbol);
		if (nse?.price) return nse;

		// 2. IndianAPI.in — India-native, NSE+BSE dual quotes, INDIAN_API_KEY in Secret Manager
		const indianApi = await fetchIndianAPIPrice(symbol);
		if (indianApi?.price) return indianApi;

		// 3. Yahoo Finance — free, no API key, confirmed working from Cloud Run
		const yahoo = await fetchYahooFinancePrice(
			symbol,
			(job.exchange === "BSE" ? "BSE" : "NSE"),
		);
		if (yahoo?.price) return yahoo;

		// 4. FMP — requires FMP_API_KEY (stored in Secret Manager as FMP_API_KEY:latest)
		const fmp = await fetchFMPPrice(symbol);
		if (fmp?.price) return fmp;
	}

	return await fetchLastKnownPrice(isin, priceDate);
}

// ─── Core: Price One Instrument ───────────────────────────────────────────────

export async function priceInstrument(
	job: PricingJob,
	priceDate: string,
	opts: { changedBy?: string; dryRun?: boolean } = {},
): Promise<GoldenPriceResult | null> {
	const { isin, symbol, assetClass = "equity" } = job;
	const { changedBy = "system", dryRun = false } = opts;

	const raw = await discoverBestPrice(job, priceDate);
	if (!raw || !raw.price || raw.price <= 0) return null;

	const prevRow = await db
		.execute(sql`
    SELECT price FROM golden_prices WHERE isin = ${isin} ORDER BY price_date DESC LIMIT 1
  `)
		.catch(() => ({ rows: [] }));
	const prevPrice = prevRow.rows?.[0]
		? Number.parseFloat((prevRow.rows[0] as any).price)
		: null;

	const { valid, deviation } = validatePrice(raw.price, prevPrice);

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
		metadata: {
			open: raw.open,
			high: raw.high,
			low: raw.low,
			volume: raw.volume,
			changePercent: raw.changePercent,
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
        INSERT INTO price_audit_log (isin, price_date, old_price, new_price, old_source, new_source, change_reason, changed_by, confidence_score)
        VALUES (${isin}, ${priceDate}, ${ex.price}, ${raw.price}, ${ex.source}, ${raw.source}, ${"Daily pricing run update"}, ${changedBy}, ${raw.confidence})
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
      INSERT INTO price_audit_log (isin, price_date, new_price, new_source, change_reason, changed_by, confidence_score)
      VALUES (${isin}, ${priceDate}, ${raw.price}, ${raw.source}, ${"Initial golden price set"}, ${changedBy}, ${raw.confidence})
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

export async function runDailyGoldenPricing(
	priceDate?: string,
	opts: { batchSize?: number; delayMs?: number } = {},
): Promise<DailyPricingRunResult> {
	const { batchSize = 20, delayMs = 500 } = opts;
	const date = priceDate ?? new Date().toISOString().slice(0, 10);
	const start = Date.now();

	console.log(`[GoldenPricing] Starting daily run for ${date}...`);

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

	// Process in batches
	for (let i = 0; i < jobs.length; i += batchSize) {
		const batch = jobs.slice(i, i + batchSize);
		await Promise.allSettled(
			batch.map(async (job) => {
				processed++;
				try {
					const result = await priceInstrument(job, date);
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
	console.log(
		`[GoldenPricing] Daily run complete: ${succeeded}/${processed} priced, ${flagged} flagged, ${failed} failed in ${durationMs}ms`,
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

	// Build safe IN clause with individual Drizzle params
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
