import { pool } from "../db";
import yahooFinance from "yahoo-finance2";
import axios from "axios";
import { executeWithRetry } from "../utils/retry";
import {
	callPython,
	isPythonServiceConfigured,
} from "../clients/python-client";
import { fetchGFQuoteUS } from "./google-finance-service";
import { ETF_REGISTRY } from "./financial-data-scheduler";

// ─── Exchange map for known US-listed symbols ─────────────────────────────────
// Google Finance HTML requires SYMBOL:EXCHANGE. This map covers all default
// global stocks and ETFs. Unknown symbols fall back to NASDAQ then NYSE.
const GF_US_EXCHANGE_MAP: Record<string, string> = {
	// US large-cap equities (NYSE)
	"BRK-B": "NYSE",
	JPM: "NYSE",
	V: "NYSE",
	UNH: "NYSE",
	MA: "NYSE",
	JNJ: "NYSE",
	XOM: "NYSE",
	HD: "NYSE",
	PG: "NYSE",
	CVX: "NYSE",
	MRK: "NYSE",
	ABBV: "NYSE",
	PFE: "NYSE",
	BAC: "NYSE",
	WMT: "NYSE",
	KO: "NYSE",
	DIS: "NYSE",
	NKE: "NYSE",
	MCD: "NYSE",
	VZ: "NYSE",
	T: "NYSE",
	PM: "NYSE",
	IBM: "NYSE",
	MMM: "NYSE",
	GE: "NYSE",
	CAT: "NYSE",
	BA: "NYSE",
	GS: "NYSE",
	MS: "NYSE",
	AXP: "NYSE",
	// US large-cap equities (NASDAQ)
	AAPL: "NASDAQ",
	MSFT: "NASDAQ",
	GOOGL: "NASDAQ",
	GOOG: "NASDAQ",
	AMZN: "NASDAQ",
	NVDA: "NASDAQ",
	META: "NASDAQ",
	TSLA: "NASDAQ",
	AVGO: "NASDAQ",
	COST: "NASDAQ",
	NFLX: "NASDAQ",
	AMD: "NASDAQ",
	INTC: "NASDAQ",
	QCOM: "NASDAQ",
	CSCO: "NASDAQ",
	TXN: "NASDAQ",
	ADBE: "NASDAQ",
	AMAT: "NASDAQ",
	MU: "NASDAQ",
	LRCX: "NASDAQ",
	// ETFs (NYSEARCA)
	SPY: "NYSEARCA",
	IWM: "NYSEARCA",
	VTI: "NYSEARCA",
	VOO: "NYSEARCA",
	IVV: "NYSEARCA",
	VEA: "NYSEARCA",
	VWO: "NYSEARCA",
	EFA: "NYSEARCA",
	AGG: "NYSEARCA",
	LQD: "NYSEARCA",
	GLD: "NYSEARCA",
	SLV: "NYSEARCA",
	XLF: "NYSEARCA",
	XLK: "NYSEARCA",
	XLE: "NYSEARCA",
	XLV: "NYSEARCA",
	XLI: "NYSEARCA",
	IAU: "NYSEARCA",
	HYG: "NYSEARCA",
	EMB: "NYSEARCA",
	// ETFs (NASDAQ)
	QQQ: "NASDAQ",
	BND: "NASDAQ",
	TLT: "NASDAQ",
	IEMG: "NASDAQ",
};

const YAHOO_RETRY_OPTIONS = {
	maxAttempts: 2,
	baseDelay: 2000,
	maxDelay: 10000,
	jitter: true,
	timeoutMs: 15000,
	shouldRetry: (error: Error): boolean => {
		const errorStr = error.message.toLowerCase();
		if (
			errorStr.includes("429") ||
			errorStr.includes("too many") ||
			errorStr.includes("unexpected token 't'")
		) {
			return false;
		}
		return (
			errorStr.includes("socket") ||
			errorStr.includes("econnreset") ||
			errorStr.includes("etimedout") ||
			errorStr.includes("enotfound") ||
			errorStr.includes("other side closed") ||
			errorStr.includes("network") ||
			errorStr.includes("fetch failed")
		);
	},
	onRetry: (error: Error, attempt: number) => {
		if (attempt >= 2) {
			console.log(
				`🔄 [FinancialDataRepository] Retry failed: ${error.message}`,
			);
		}
	},
};

interface InstrumentData {
	instrumentType: string;
	symbol: string;
	name: string;
	exchange?: string;
	currency?: string;
	country?: string;
	currentPrice?: number;
	previousClose?: number;
	dayChange?: number;
	dayChangePercent?: number;
	dayHigh?: number;
	dayLow?: number;
	openPrice?: number;
	volume?: number;
	nav?: number;
	navDate?: string;
	return1y?: number;
	return3y?: number;
	return5y?: number;
	yieldPercent?: number;
	couponRate?: number;
	maturityDate?: string;
	marketCap?: number;
	peRatio?: number;
	dividendYield?: number;
	category?: string;
	sector?: string;
	amc?: string;
	expenseRatio?: number;
	aum?: number;
	riskLevel?: string;
	dataSource: string;
	secondarySource?: string;
	confidenceScore?: number;
}

interface FetchResult {
	success: boolean;
	data?: InstrumentData;
	error?: string;
}

const PRICE_TOLERANCE_PERCENT = 2;

function convertDateFormat(dateStr: string | undefined): string | undefined {
	if (!dateStr) return undefined;
	const parts = dateStr.split("-");
	if (parts.length === 3) {
		if (parts[0].length === 4) return dateStr;
		return `${parts[2]}-${parts[1]}-${parts[0]}`;
	}
	return dateStr;
}

class FinancialDataRepository {
	private isInitialized = false;

	async initialize(): Promise<void> {
		console.log("📊 [FinancialDataRepository] Initializing...");
		this.isInitialized = true;
		console.log("✅ [FinancialDataRepository] Initialized");
	}

	private calculateConfidenceScore(
		primary: InstrumentData,
		secondary?: InstrumentData,
	): number {
		if (!secondary || !primary.currentPrice || !secondary.currentPrice) {
			return 80;
		}

		const priceDiff = Math.abs(primary.currentPrice - secondary.currentPrice);
		const percentDiff = (priceDiff / primary.currentPrice) * 100;

		if (percentDiff <= 0.5) return 100;
		if (percentDiff <= 1) return 95;
		if (percentDiff <= PRICE_TOLERANCE_PERCENT) return 85;
		if (percentDiff <= 5) return 70;
		return 50;
	}

	private async fetchFromMassive(symbol: string): Promise<FetchResult> {
		const apiKey = process.env.POLYGON_API_KEY;
		if (!apiKey)
			return { success: false, error: "Massive API key not configured" };

		try {
			const [snapshotResp, detailsResp] = await Promise.all([
				axios
					.get(
						`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${symbol}`,
						{
							params: { apiKey },
							timeout: 8000,
						},
					)
					.catch(() => null),
				axios
					.get(`https://api.polygon.io/v3/reference/tickers/${symbol}`, {
						params: { apiKey },
						timeout: 8000,
					})
					.catch(() => null),
			]);

			const snapshot = snapshotResp?.data?.ticker;
			const details = detailsResp?.data?.results;

			if (!snapshot && !details) {
				return { success: false, error: "No data from Massive API" };
			}

			const day = snapshot?.day || {};
			const prevDay = snapshot?.prevDay || {};

			const currentPrice = day.c || snapshot?.lastTrade?.p;
			const prevClose = prevDay.c;

			const data: InstrumentData = {
				instrumentType: "global_stock",
				symbol,
				name: details?.name || symbol,
				exchange: details?.primary_exchange || "US",
				currency: details?.currency_name?.toUpperCase() || "USD",
				country: "US",
				currentPrice: currentPrice,
				previousClose: prevClose,
				dayChange:
					currentPrice && prevClose ? currentPrice - prevClose : undefined,
				dayChangePercent:
					currentPrice && prevClose
						? ((currentPrice - prevClose) / prevClose) * 100
						: undefined,
				dayHigh: day.h,
				dayLow: day.l,
				openPrice: day.o,
				volume: day.v,
				marketCap: details?.market_cap,
				sector: details?.sic_description,
				dataSource: "massive",
				confidenceScore: 95,
			};

			return { success: true, data };
		} catch (error: any) {
			return { success: false, error: `Massive API error: ${error.message}` };
		}
	}

	private async fetchFromAlphaVantage(symbol: string): Promise<FetchResult> {
		const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
		if (!apiKey)
			return { success: false, error: "Alpha Vantage API key not configured" };

		try {
			const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: { Accept: "application/json", "User-Agent": "FintekPro/2.5" },
			});
			clearTimeout(timeoutId);

			if (!response.ok) {
				return {
					success: false,
					error: `Alpha Vantage HTTP ${response.status}`,
				};
			}

			const json = await response.json();

			if (json["Error Message"]) {
				return { success: false, error: json["Error Message"] };
			}
			if (json.Note || json.Information) {
				return { success: false, error: "Alpha Vantage rate limit reached" };
			}

			const q = json["Global Quote"];
			if (!q || !q["05. price"]) {
				return { success: false, error: "No quote data from Alpha Vantage" };
			}

			const price = Number.parseFloat(q["05. price"]);
			const prevClose = Number.parseFloat(q["08. previous close"]);
			const change = Number.parseFloat(q["09. change"]);
			const changePct = Number.parseFloat(
				(q["10. change percent"] || "0").replace("%", ""),
			);

			const exchangeMap: Record<
				string,
				{ exchange: string; currency: string; country: string }
			> = {
				".HK": { exchange: "HKEX", currency: "HKD", country: "HK" },
				".T": { exchange: "TSE", currency: "JPY", country: "JP" },
				".L": { exchange: "LSE", currency: "GBP", country: "UK" },
				".AS": { exchange: "AMS", currency: "EUR", country: "NL" },
				".DE": { exchange: "FRA", currency: "EUR", country: "DE" },
				".PA": { exchange: "PAR", currency: "EUR", country: "FR" },
				".NS": { exchange: "NSE", currency: "INR", country: "IN" },
				".BO": { exchange: "BSE", currency: "INR", country: "IN" },
			};
			const suffix = Object.keys(exchangeMap).find((s) => symbol.includes(s));
			const marketInfo = suffix
				? exchangeMap[suffix]
				: { exchange: "US", currency: "USD", country: "US" };

			const data: InstrumentData = {
				instrumentType: "global_stock",
				symbol: q["01. symbol"] || symbol,
				name: symbol,
				exchange: marketInfo.exchange,
				currency: marketInfo.currency,
				country: marketInfo.country,
				currentPrice: price,
				previousClose: prevClose || undefined,
				dayChange: change || undefined,
				dayChangePercent: changePct || undefined,
				dayHigh: Number.parseFloat(q["03. high"]) || undefined,
				dayLow: Number.parseFloat(q["04. low"]) || undefined,
				openPrice: Number.parseFloat(q["02. open"]) || undefined,
				volume: Number.parseInt(q["06. volume"]) || undefined,
				dataSource: "alpha_vantage",
				confidenceScore: 92,
			};

			return { success: true, data };
		} catch (error: any) {
			if (error.name === "AbortError") {
				return { success: false, error: "Alpha Vantage timeout" };
			}
			return { success: false, error: `Alpha Vantage error: ${error.message}` };
		}
	}

	private async fetchBatchFromAlphaVantage(
		symbols: string[],
		instrumentType: "global_stock" | "etf" = "global_stock",
	): Promise<Map<string, InstrumentData>> {
		const results = new Map<string, InstrumentData>();
		if (!process.env.ALPHA_VANTAGE_API_KEY || !symbols.length) return results;

		// Fire all requests concurrently — AV will respond with "Note" if rate-limited;
		// those are caught gracefully and simply stay absent so the next tier handles them.
		const settled = await Promise.allSettled(
			symbols.map((sym) => this.fetchFromAlphaVantage(sym)),
		);

		let rateLimited = 0;
		for (let i = 0; i < symbols.length; i++) {
			const r = settled[i];
			if (
				r.status === "fulfilled" &&
				r.value.success &&
				r.value.data?.currentPrice
			) {
				results.set(symbols[i], { ...r.value.data, instrumentType });
			} else if (
				r.status === "fulfilled" &&
				(r.value.error?.toLowerCase().includes("rate limit") ||
					r.value.error?.toLowerCase().includes("note"))
			) {
				rateLimited++;
			}
		}

		if (results.size > 0) {
			console.log(
				`✅ [AlphaVantage] Batch: ${results.size}/${symbols.length} ${instrumentType}s (${rateLimited} rate-limited)`,
			);
		} else if (rateLimited > 0) {
			console.log(
				`⚠️ [AlphaVantage] Rate-limited for all ${rateLimited} ${instrumentType} requests — next tier takes over`,
			);
		}

		return results;
	}

	/**
	 * Fetch a batch of US-listed ETFs/stocks via the Yahoo Finance chart REST API.
	 *
	 * Endpoint: https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
	 * - No API key required, no cookie/session needed (different path from yahoo-finance2)
	 * - Returns regularMarketPrice, previousClose, 52W H/L, volume — confirmed HTTP 200
	 *   from Cloud Run (tested: SPY, QQQ, GLD, TLT all return live prices)
	 * - Rate limit: more generous than yahoo-finance2; use for batch ETF cron only.
	 *
	 * @param symbols       - List of US ETF tickers (e.g. ["SPY", "QQQ", "GLD"])
	 * @param instrumentType - "etf" | "global_stock"
	 */
	private async fetchBatchFromYahooChart(
		symbols: string[],
		instrumentType: "global_stock" | "etf",
	etfMetaMap?: Map<string, { name: string; country: string; currency: string; exchange: string; category: string; assetFocus: string }>,
	): Promise<Map<string, InstrumentData>> {
		const results = new Map<string, InstrumentData>();
		if (!symbols.length) return results;

		// Run up to 5 concurrently — each is a separate GET, no shared session
		const CONCURRENCY = 5;

		const fetchOne = async (sym: string): Promise<[string, InstrumentData] | null> => {
			try {
				const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`;
				const res = await fetch(url, {
					headers: {
						"User-Agent": "Mozilla/5.0 (compatible; FintekPro/1.0; +https://fintekpro.com)",
						Accept: "application/json",
					},
					signal: AbortSignal.timeout(8_000),
				});
				if (!res.ok) return null;
				const body = (await res.json()) as any;
				const meta = body?.chart?.result?.[0]?.meta;
				if (!meta?.regularMarketPrice) return null;

				const pf = (v: any): number | undefined => {
					const n = Number(v);
					return Number.isFinite(n) && n > 0 ? n : undefined;
				};

				// Enrich with static ETF registry metadata when available
				const reg = etfMetaMap?.get(sym);
				const isIndian = sym.includes(".NS") || sym.includes(".BO");

				return [
					sym,
					{
						instrumentType,
						symbol: sym,
						name: reg?.name || meta.longName || meta.shortName || sym,
						exchange: reg?.exchange || meta.exchangeName || (isIndian ? "NSE" : "US"),
						currency: reg?.currency || meta.currency || (isIndian ? "INR" : "USD"),
						country: reg?.country || (isIndian ? "IN" : "US"),
						category: reg?.category,
						sector: reg?.assetFocus,
						currentPrice: pf(meta.regularMarketPrice),
						previousClose: pf(meta.chartPreviousClose) ?? pf(meta.previousClose),
						dayHigh: pf(meta.regularMarketDayHigh),
						dayLow: pf(meta.regularMarketDayLow),
						volume: pf(meta.regularMarketVolume),
						dataSource: "yahoo-chart",
						confidenceScore: 88,
					},
				];
			} catch {
				return null;
			}
		};

		for (let i = 0; i < symbols.length; i += CONCURRENCY) {
			const chunk = symbols.slice(i, i + CONCURRENCY);
			const settled = await Promise.allSettled(chunk.map(fetchOne));
			for (const r of settled) {
				if (r.status === "fulfilled" && r.value)
					results.set(r.value[0], r.value[1]);
			}
		}

		if (results.size > 0) {
			console.log(
				`✅ [YahooChart] Batch: ${results.size}/${symbols.length} ${instrumentType}s via /v8/finance/chart`,
			);
		}
		return results;
	}

	async fetchAlphaVantageHistorical(
		symbol: string,
		outputSize: string = "compact",
	): Promise<{
		success: boolean;
		data?: Array<{
			date: string;
			open: number;
			high: number;
			low: number;
			close: number;
			volume: number;
		}>;
		error?: string;
	}> {
		const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
		if (!apiKey)
			return { success: false, error: "Alpha Vantage API key not configured" };

		try {
			const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=${outputSize}&apikey=${apiKey}`;
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 15000);

			const response = await fetch(url, {
				signal: controller.signal,
				headers: { Accept: "application/json", "User-Agent": "FintekPro/2.5" },
			});
			clearTimeout(timeoutId);

			if (!response.ok) {
				return {
					success: false,
					error: `Alpha Vantage HTTP ${response.status}`,
				};
			}

			const json = await response.json();
			if (json["Error Message"] || json.Note || json.Information) {
				return {
					success: false,
					error: json["Error Message"] || json.Note || json.Information,
				};
			}

			const timeSeries = json["Time Series (Daily)"];
			if (!timeSeries) {
				return { success: false, error: "No time series data" };
			}

			const data = Object.entries(timeSeries).map(
				([date, values]: [string, any]) => ({
					date,
					open: Number.parseFloat(values["1. open"]),
					high: Number.parseFloat(values["2. high"]),
					low: Number.parseFloat(values["3. low"]),
					close: Number.parseFloat(values["4. close"]),
					volume: Number.parseInt(values["5. volume"]),
				}),
			);

			return { success: true, data };
		} catch (error: any) {
			return {
				success: false,
				error: `Alpha Vantage historical error: ${error.message}`,
			};
		}
	}

	private async fetchBatchFromFMP(
		symbols: string[],
		instrumentType: "global_stock" | "etf",
	): Promise<Map<string, InstrumentData>> {
		const apiKey = process.env.FMP_API_KEY;
		const results = new Map<string, InstrumentData>();
		if (!apiKey || symbols.length === 0) return results;

		const safeFloat = (v: any): number | undefined => {
			if (v == null) return undefined;
			const n =
				typeof v === "string"
					? Number.parseFloat(v.replace(/[()%$,\s]/g, ""))
					: Number(v);
			return Number.isFinite(n) ? n : undefined;
		};

		// FMP v3 /quote/{symbols} supports a comma-separated list (up to 50).
		// It works on the free tier and returns live price + change data.
		// The old /stable/profile endpoint required a paid plan.
		try {
			const capped = symbols.slice(0, 50);
			const joined = capped.map((s) => encodeURIComponent(s)).join(",");
			const resp = await fetch(
				`https://financialmodelingprep.com/api/v3/quote/${joined}?apikey=${apiKey}`,
				{
					signal: AbortSignal.timeout(12000),
					headers: {
						Accept: "application/json",
						"User-Agent": "FintekPro/2.5",
					},
				},
			);
			if (!resp.ok) {
				console.log(
					`⚠️ [FMP] HTTP ${resp.status} for batch ${instrumentType} quotes`,
				);
				return results;
			}
			const data: any[] = await resp.json();
			if (!Array.isArray(data)) return results;

			for (const q of data) {
				if (!q?.symbol || q.price == null) continue;
				results.set(q.symbol, {
					instrumentType,
					symbol: q.symbol,
					name: q.name || q.symbol,
					exchange: q.exchange || "US",
					currency: q.currency || "USD",
					country: "US",
					currentPrice: safeFloat(q.price),
					previousClose: safeFloat(q.previousClose),
					dayChange: safeFloat(q.change),
					dayChangePercent: safeFloat(q.changesPercentage),
					dayHigh: safeFloat(q.dayHigh),
					dayLow: safeFloat(q.dayLow),
					openPrice: safeFloat(q.open),
					volume: safeFloat(q.volume),
					marketCap: safeFloat(q.marketCap),
					peRatio: safeFloat(q.pe),
					dividendYield: undefined,
					sector: undefined,
					category: undefined,
					expenseRatio: undefined,
					aum: instrumentType === "etf" ? safeFloat(q.marketCap) : undefined,
					dataSource: "fmp",
					confidenceScore: 88,
				});
			}

			console.log(
				`✅ [FMP] Fetched ${results.size}/${capped.length} ${instrumentType} quotes`,
			);
		} catch (error: any) {
			console.log(`⚠️ [FMP] Error: ${error.message}`);
		}

		return results;
	}

	/**
	 * Fetch a batch of US-listed stocks or ETFs via Google Finance HTML.
	 * Uses the GF_US_EXCHANGE_MAP to resolve each symbol's exchange.
	 * Unknown symbols try NASDAQ first then NYSE (covers ~95% of US listings).
	 * Runs up to 6 requests concurrently to balance speed vs. polite usage.
	 */
	private async fetchBatchFromGoogleFinance(
		symbols: string[],
		instrumentType: "global_stock" | "etf",
	): Promise<Map<string, InstrumentData>> {
		const results = new Map<string, InstrumentData>();
		if (!symbols.length) return results;

		const CONCURRENCY = 6;

		const fetchOne = async (
			sym: string,
		): Promise<[string, InstrumentData] | null> => {
			const gfExchange = GF_US_EXCHANGE_MAP[sym];
			let quote = gfExchange ? await fetchGFQuoteUS(sym, gfExchange) : null;

			// For unknown symbols, probe the two most common US exchanges
			if (!quote && !gfExchange) {
				quote = await fetchGFQuoteUS(sym, "NASDAQ");
				if (!quote) quote = await fetchGFQuoteUS(sym, "NYSE");
				if (!quote) quote = await fetchGFQuoteUS(sym, "NYSEARCA");
			}

			if (!quote) return null;

			return [
				sym,
				{
					instrumentType,
					symbol: sym,
					name: sym,
					exchange: gfExchange || "US",
					currency: "USD",
					country: "US",
					currentPrice: quote.price,
					previousClose: quote.previousClose ?? undefined,
					dayChange: quote.change ?? undefined,
					dayChangePercent: quote.changePercent ?? undefined,
					dataSource: "google_finance",
					confidenceScore: 82,
				},
			];
		};

		// Run in chunks of CONCURRENCY
		for (let i = 0; i < symbols.length; i += CONCURRENCY) {
			const chunk = symbols.slice(i, i + CONCURRENCY);
			const settled = await Promise.allSettled(chunk.map(fetchOne));
			for (const r of settled) {
				if (r.status === "fulfilled" && r.value)
					results.set(r.value[0], r.value[1]);
			}
		}

		if (results.size > 0) {
			console.log(
				`✅ [GF-HTML] Fetched ${results.size}/${symbols.length} ${instrumentType}s via Google Finance HTML`,
			);
		}

		return results;
	}

	async fetchGlobalStock(symbol: string): Promise<FetchResult> {
		const isIndianSymbol = symbol.includes(".NS") || symbol.includes(".BO");

		if (!isIndianSymbol && process.env.FMP_API_KEY) {
			const fmpResults = await this.fetchBatchFromFMP([symbol], "global_stock");
			const fmpData = fmpResults.get(symbol);
			if (fmpData) return { success: true, data: fmpData };
		}

		if (!isIndianSymbol && process.env.POLYGON_API_KEY) {
			const massiveResult = await this.fetchFromMassive(symbol);
			if (massiveResult.success && massiveResult.data?.currentPrice) {
				return massiveResult;
			}
		}

		if (process.env.ALPHA_VANTAGE_API_KEY) {
			const avResult = await this.fetchFromAlphaVantage(symbol);
			if (avResult.success && avResult.data?.currentPrice) {
				const currSymbol = isIndianSymbol
					? "₹"
					: symbol.includes(".L")
						? "£"
						: symbol.includes(".HK") || symbol.includes(".T")
							? "¥"
							: "$";
				console.log(
					`✅ [AlphaVantage] ${symbol}: ${currSymbol}${avResult.data.currentPrice}`,
				);
				return avResult;
			}
		}

		try {
			yahooFinance.suppressNotices(["yahooSurvey"]);

			const { result: quote } = await executeWithRetry(
				() => yahooFinance.quote(symbol),
				YAHOO_RETRY_OPTIONS,
			);

			if (!quote) {
				return { success: false, error: "No data returned" };
			}

			if (!quote.regularMarketPrice && !quote.shortName) {
				console.log(
					`[FinancialDataRepository] Possible rate limit for ${symbol}, skipping`,
				);
				return { success: false, error: "Rate limited or no market data" };
			}

			// Cast to any for extended yahoo-finance fields absent from the narrow union type
			const q = quote as any;
			const data: InstrumentData = {
				instrumentType: "global_stock",
				symbol: symbol.replace(".NS", "").replace(".BO", ""),
				name: quote.shortName || quote.longName || symbol,
				exchange: quote.exchange || "UNKNOWN",
				currency: quote.currency || "USD",
				country: quote.exchange?.includes("NS") ? "IN" : "US",
				currentPrice: quote.regularMarketPrice,
				previousClose: quote.regularMarketPreviousClose,
				dayChange: quote.regularMarketChange,
				dayChangePercent: quote.regularMarketChangePercent,
				dayHigh: quote.regularMarketDayHigh,
				dayLow: quote.regularMarketDayLow,
				openPrice: quote.regularMarketOpen,
				volume: quote.regularMarketVolume,
				marketCap: quote.marketCap,
				peRatio: quote.trailingPE,
				dividendYield: q.dividendYield ? q.dividendYield * 100 : undefined,
				sector: q.sector,
				dataSource: "yahoo",
				confidenceScore: 90,
			};

			return { success: true, data };
		} catch (error) {
			const errorStr = String(error);
			if (
				errorStr.includes("Too Many") ||
				errorStr.includes("429") ||
				errorStr.includes("Unexpected token 'T'")
			) {
				console.log(`[FinancialDataRepository] Rate limit for ${symbol}`);
				return { success: false, error: "Rate limited - Too Many Requests" };
			}
			console.log(
				`[FinancialDataRepository] Yahoo fetch failed for ${symbol}: ${errorStr}`,
			);
			return { success: false, error: errorStr };
		}
	}

	async fetchETF(symbol: string): Promise<FetchResult> {
		try {
			yahooFinance.suppressNotices(["yahooSurvey"]);

			// Use retry logic for transient network errors
			const { result: quote } = await executeWithRetry(
				() => yahooFinance.quote(symbol),
				YAHOO_RETRY_OPTIONS,
			);

			if (!quote) {
				return { success: false, error: "No data returned" };
			}

			// Check for rate limit response
			if (!quote.regularMarketPrice && !quote.shortName) {
				console.log(
					`[FinancialDataRepository] Possible rate limit for ${symbol}, skipping`,
				);
				return { success: false, error: "Rate limited or no market data" };
			}

			// Cast to any for extended yahoo-finance ETF fields absent from the narrow union type
			const q = quote as any;
			const data: InstrumentData = {
				instrumentType: "etf",
				symbol: symbol,
				name: quote.shortName || quote.longName || symbol,
				exchange: quote.exchange || "UNKNOWN",
				currency: quote.currency || "USD",
				currentPrice: quote.regularMarketPrice,
				nav: q.navPrice,
				previousClose: quote.regularMarketPreviousClose,
				dayChange: quote.regularMarketChange,
				dayChangePercent: quote.regularMarketChangePercent,
				dayHigh: quote.regularMarketDayHigh,
				dayLow: quote.regularMarketDayLow,
				volume: quote.regularMarketVolume,
				dividendYield: q.yield ? q.yield * 100 : undefined,
				expenseRatio: q.annualReportExpenseRatio,
				aum: q.totalAssets,
				category: q.category,
				dataSource: "yahoo",
				confidenceScore: 90,
			};

			return { success: true, data };
		} catch (error) {
			const errorStr = String(error);
			// Detect rate limit errors from Yahoo Finance
			if (
				errorStr.includes("Too Many") ||
				errorStr.includes("429") ||
				errorStr.includes("Unexpected token 'T'")
			) {
				console.log(`[FinancialDataRepository] Rate limit for ETF ${symbol}`);
				return { success: false, error: "Rate limited - Too Many Requests" };
			}
			console.log(
				`[FinancialDataRepository] ETF fetch failed for ${symbol}: ${errorStr}`,
			);
			return { success: false, error: errorStr };
		}
	}

	async fetchMutualFundFromMFAPI(schemeCode: string): Promise<FetchResult> {
		try {
			const response = await fetch(`https://api.mfapi.in/mf/${schemeCode}`);
			if (!response.ok) {
				return { success: false, error: `API returned ${response.status}` };
			}

			const data = await response.json();
			if (!data || !data.data || data.data.length === 0) {
				return { success: false, error: "No NAV data returned" };
			}

			const latestNav = data.data[0];
			const meta = data.meta || {};

			const result: InstrumentData = {
				instrumentType: "mutual_fund",
				symbol: schemeCode,
				name: meta.scheme_name || `Scheme ${schemeCode}`,
				exchange: "AMFI",
				currency: "INR",
				country: "IN",
				nav: Number.parseFloat(latestNav.nav),
				navDate: convertDateFormat(latestNav.date),
				amc: meta.fund_house,
				category: meta.scheme_category,
				dataSource: "mfapi",
				confidenceScore: 95,
			};

			return { success: true, data: result };
		} catch (error) {
			console.warn(
				`⚠️ [FinancialDataRepository] MFAPI fetch failed for ${schemeCode}:`,
				error,
			);
			return { success: false, error: String(error) };
		}
	}

	async saveToDatabase(instrument: InstrumentData): Promise<boolean> {
		const client = await pool.connect();
		try {
			await client.query(
				`
        INSERT INTO financial_instruments_cache 
          (instrument_type, symbol, name, exchange, currency, country,
           current_price, previous_close, day_change, day_change_percent,
           day_high, day_low, open_price, volume, nav, nav_date,
           return_1y, return_3y, return_5y, yield_percent, coupon_rate, maturity_date,
           market_cap, pe_ratio, dividend_yield, category, sector, amc, expense_ratio, aum,
           risk_level, data_source, secondary_source, confidence_score,
           price_updated_at, fetched_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
                $31, $32, $33, $34, NOW(), NOW(), NOW())
        ON CONFLICT (instrument_type, symbol, exchange) DO UPDATE SET
          name = EXCLUDED.name,
          current_price = EXCLUDED.current_price,
          previous_close = EXCLUDED.previous_close,
          day_change = EXCLUDED.day_change,
          day_change_percent = EXCLUDED.day_change_percent,
          day_high = EXCLUDED.day_high,
          day_low = EXCLUDED.day_low,
          open_price = EXCLUDED.open_price,
          volume = EXCLUDED.volume,
          nav = EXCLUDED.nav,
          nav_date = EXCLUDED.nav_date,
          return_1y = COALESCE(EXCLUDED.return_1y, financial_instruments_cache.return_1y),
          return_3y = COALESCE(EXCLUDED.return_3y, financial_instruments_cache.return_3y),
          return_5y = COALESCE(EXCLUDED.return_5y, financial_instruments_cache.return_5y),
          market_cap = EXCLUDED.market_cap,
          pe_ratio = EXCLUDED.pe_ratio,
          dividend_yield = EXCLUDED.dividend_yield,
          category = COALESCE(EXCLUDED.category, financial_instruments_cache.category),
          sector = COALESCE(EXCLUDED.sector, financial_instruments_cache.sector),
          amc = COALESCE(EXCLUDED.amc, financial_instruments_cache.amc),
          expense_ratio = COALESCE(EXCLUDED.expense_ratio, financial_instruments_cache.expense_ratio),
          aum = COALESCE(EXCLUDED.aum, financial_instruments_cache.aum),
          data_source = EXCLUDED.data_source,
          secondary_source = EXCLUDED.secondary_source,
          confidence_score = EXCLUDED.confidence_score,
          price_updated_at = NOW(),
          fetched_at = NOW(),
          updated_at = NOW()
      `,
				[
					instrument.instrumentType,
					instrument.symbol,
					instrument.name,
					instrument.exchange || null,
					instrument.currency || "INR",
					instrument.country || "IN",
					instrument.currentPrice || null,
					instrument.previousClose || null,
					instrument.dayChange || null,
					instrument.dayChangePercent || null,
					instrument.dayHigh || null,
					instrument.dayLow || null,
					instrument.openPrice || null,
					instrument.volume || null,
					instrument.nav || null,
					instrument.navDate || null,
					instrument.return1y || null,
					instrument.return3y || null,
					instrument.return5y || null,
					instrument.yieldPercent || null,
					instrument.couponRate || null,
					instrument.maturityDate || null,
					instrument.marketCap || null,
					instrument.peRatio || null,
					instrument.dividendYield || null,
					instrument.category || null,
					instrument.sector || null,
					instrument.amc || null,
					instrument.expenseRatio || null,
					instrument.aum || null,
					instrument.riskLevel || null,
					instrument.dataSource,
					instrument.secondarySource || null,
					instrument.confidenceScore || 80,
				],
			);

			if (
				instrument.instrumentType === "global_stock" &&
				instrument.currentPrice
			) {
				await client
					.query(
						`
          UPDATE global_instruments 
          SET last_price = $1, 
              price_change_percent = $2,
              data_source = $3,
              last_updated = NOW()
          WHERE symbol = $4
        `,
						[
							instrument.currentPrice,
							instrument.dayChangePercent || null,
							instrument.dataSource,
							instrument.symbol,
						],
					)
					.catch(() => {});
			}

			return true;
		} catch (error) {
			console.error("❌ [FinancialDataRepository] Save failed:", error);
			return false;
		} finally {
			client.release();
		}
	}

	async getFromDatabase(
		instrumentType: string,
		symbol: string,
		maxAgeMinutes: number = 30,
	): Promise<InstrumentData | null> {
		const client = await pool.connect();
		try {
			const result = await client.query(
				`
        SELECT * FROM financial_instruments_cache 
        WHERE instrument_type = $1 AND symbol = $2
        AND fetched_at > NOW() - INTERVAL '${maxAgeMinutes} minutes'
        ORDER BY fetched_at DESC LIMIT 1
      `,
				[instrumentType, symbol],
			);

			if (result.rows.length === 0) return null;

			const row = result.rows[0];
			return {
				instrumentType: row.instrument_type,
				symbol: row.symbol,
				name: row.name,
				exchange: row.exchange,
				currency: row.currency,
				country: row.country,
				currentPrice: row.current_price
					? Number.parseFloat(row.current_price)
					: undefined,
				previousClose: row.previous_close
					? Number.parseFloat(row.previous_close)
					: undefined,
				dayChange: row.day_change
					? Number.parseFloat(row.day_change)
					: undefined,
				dayChangePercent: row.day_change_percent
					? Number.parseFloat(row.day_change_percent)
					: undefined,
				nav: row.nav ? Number.parseFloat(row.nav) : undefined,
				navDate: row.nav_date,
				marketCap: row.market_cap
					? Number.parseFloat(row.market_cap)
					: undefined,
				peRatio: row.pe_ratio ? Number.parseFloat(row.pe_ratio) : undefined,
				category: row.category,
				sector: row.sector,
				amc: row.amc,
				dataSource: row.data_source,
				confidenceScore: row.confidence_score,
			};
		} finally {
			client.release();
		}
	}

	async fetchWithValidation(
		instrumentType: string,
		symbol: string,
	): Promise<InstrumentData | null> {
		const cached = await this.getFromDatabase(instrumentType, symbol);
		if (cached) {
			console.log(
				`💾 [FinancialDataRepository] Using cached data for ${symbol}`,
			);
			return cached;
		}

		let result: FetchResult;

		switch (instrumentType) {
			case "global_stock":
				result = await this.fetchGlobalStock(symbol);
				break;
			case "etf":
				result = await this.fetchETF(symbol);
				break;
			case "mutual_fund":
				result = await this.fetchMutualFundFromMFAPI(symbol);
				break;
			case "bond":
			case "ncd":
			case "govt_security":
				result = await this.fetchDebtInstrument(symbol, instrumentType);
				break;
			default:
				return null;
		}

		if (result.success && result.data) {
			await this.saveToDatabase(result.data);
			return result.data;
		}

		return null;
	}

	private async fetchBatchFromPython(
		symbols: string[],
		instrumentType: "global_stock" | "etf",
	): Promise<Map<string, InstrumentData>> {
		const results = new Map<string, InstrumentData>();
		if (!symbols.length) return results;

		// Skip the network call entirely when Python sidecar is not configured —
		// prevents "fetch failed" log noise on deploys that don't run the sidecar.
		if (!isPythonServiceConfigured()) return results;

		try {
			const resp = await callPython<{
				results: Record<string, any>;
				count: number;
			}>("/market/quotes", "POST", { symbols });
			if (!resp?.results) return results;

			for (const [sym, q] of Object.entries(resp.results)) {
				const price = q.price != null ? Number(q.price) : undefined;
				const prevClose =
					q.previousClose != null ? Number(q.previousClose) : undefined;
				if (!price) continue;

				const suffix = sym.includes(".HK")
					? { exchange: "HKEX", currency: "HKD", country: "HK" }
					: sym.includes(".T")
						? { exchange: "TSE", currency: "JPY", country: "JP" }
						: sym.includes(".L")
							? { exchange: "LSE", currency: "GBP", country: "UK" }
							: sym.includes(".NS")
								? { exchange: "NSE", currency: "INR", country: "IN" }
								: sym.includes(".BO")
									? { exchange: "BSE", currency: "INR", country: "IN" }
									: {
											exchange: q.exchange || "US",
											currency: q.currency || "USD",
											country: "US",
										};

				results.set(sym, {
					instrumentType,
					symbol: sym,
					name: sym,
					exchange: suffix.exchange,
					currency: suffix.currency,
					country: suffix.country,
					currentPrice: price,
					previousClose: prevClose,
					dayChange: q.change != null ? Number(q.change) : undefined,
					dayChangePercent:
						q.changePercent != null ? Number(q.changePercent) : undefined,
					dayHigh: q.dayHigh != null ? Number(q.dayHigh) : undefined,
					dayLow: q.dayLow != null ? Number(q.dayLow) : undefined,
					volume: q.volume != null ? Number(q.volume) : undefined,
					marketCap: q.marketCap != null ? Number(q.marketCap) : undefined,
					dataSource: "python-yfinance",
					confidenceScore: 90,
				});
			}

			if (results.size > 0) {
				console.log(
					`[FinancialDataRepository] Python/yfinance fetched ${results.size}/${symbols.length} ${instrumentType}s`,
				);
			}
		} catch (err: any) {
			console.warn(
				`[FinancialDataRepository] Python sidecar unavailable for ${instrumentType}s: ${err.message}`,
			);
		}

		return results;
	}

	async refreshGlobalStocks(
		symbols: string[],
	): Promise<{ success: number; failed: number }> {
		let success = 0;
		let failed = 0;
		const saved = new Set<string>();

		const persist = async (
			data: InstrumentData,
			sym: string,
		): Promise<void> => {
			try {
				await this.saveToDatabase(data);
				saved.add(sym);
				success++;
			} catch (err: any) {
				console.warn(`[GlobalStocks] Save failed for ${sym}: ${err.message}`);
			}
		};

		const usSymbols = symbols.filter((s) => !s.includes("."));
		const indSymbols = symbols.filter(
			(s) => s.includes(".NS") || s.includes(".BO"),
		);
		const intlSymbols = symbols.filter(
			(s) => s.includes(".") && !s.includes(".NS") && !s.includes(".BO"),
		);

		// ── Tier 1-A: Alpha Vantage for US equities (separate infra from Yahoo) ─
		if (usSymbols.length && process.env.ALPHA_VANTAGE_API_KEY) {
			const avResults = await this.fetchBatchFromAlphaVantage(
				usSymbols,
				"global_stock",
			);
			for (const [sym, data] of avResults) await persist(data, sym);
		}

		// ── Tier 1-B: Google Finance HTML for US stocks AV missed ─────────────
		// No API key, works from datacenter IPs, completely independent of Yahoo.
		// Promoted ahead of Python to reduce dependency on the Python sidecar for US data.
		const gfUsNeeded = usSymbols.filter((s) => !saved.has(s));
		if (gfUsNeeded.length) {
			console.log(
				`[GlobalStocks] ${gfUsNeeded.length} US symbols after AV → Google Finance HTML`,
			);
			const gfResults = await this.fetchBatchFromGoogleFinance(
				gfUsNeeded,
				"global_stock",
			);
			for (const [sym, data] of gfResults) await persist(data, sym);
		}

		// ── Tier 2: FMP batch for any still-missing US symbols ─────────────────
		// FMP /api/v3/quote supports free-tier batch lookups (up to 50 symbols).
		const fmpUsNeeded = usSymbols.filter((s) => !saved.has(s));
		if (fmpUsNeeded.length && process.env.FMP_API_KEY) {
			console.log(
				`[GlobalStocks] ${fmpUsNeeded.length} US symbols after GF → FMP batch`,
			);
			const fmpResults = await this.fetchBatchFromFMP(
				fmpUsNeeded,
				"global_stock",
			);
			for (const [sym, data] of fmpResults) await persist(data, sym);
		}

		// ── Tier 3: Python/yfinance for Indian + Intl (best non-US source) ─────
		const nonUsNeeded = [...indSymbols, ...intlSymbols].filter(
			(s) => !saved.has(s),
		);
		if (nonUsNeeded.length) {
			const pythonResults = await this.fetchBatchFromPython(
				nonUsNeeded,
				"global_stock",
			);
			for (const [sym, data] of pythonResults) await persist(data, sym);
		}

		// ── Tier 4: Python/yfinance for any still-missing US symbols ───────────
		const pythonUsNeeded = usSymbols.filter((s) => !saved.has(s));
		if (pythonUsNeeded.length) {
			console.log(
				`[GlobalStocks] ${pythonUsNeeded.length} US symbols after GF+FMP → Python`,
			);
			const pythonResults = await this.fetchBatchFromPython(
				pythonUsNeeded,
				"global_stock",
			);
			for (const [sym, data] of pythonResults) await persist(data, sym);
		}

		// ── Tier 5: Yahoo Finance — last resort, capped at 5 symbols ──────────
		// Yahoo rate-limits datacenter IPs aggressively; exceeding 2 consecutive
		// requests triggers a 429 that kills the remaining batch. Strict cap prevents
		// burning the quota on symbols that GF/FMP/Python already covered.
		const yahooNeeded = symbols.filter((s) => !saved.has(s)).slice(0, 5);
		failed = symbols.filter((s) => !saved.has(s)).length;
		if (yahooNeeded.length) {
			console.log(
				`[GlobalStocks] ${yahooNeeded.length} symbols → Yahoo (capped at 5)`,
			);
			const yahooResult = await this.refreshViaYahoo(
				yahooNeeded,
				"global_stock",
			);
			success += yahooResult.success;
			failed = Math.max(
				0,
				symbols.filter((s) => !saved.has(s) && !yahooResult.success).length,
			);
		}

		console.log(
			`📊 [FinancialDataRepository] Refreshed global stocks: ${success} success, ${failed} failed`,
		);
		return { success, failed };
	}

	async refreshETFs(
		symbols: string[],
	): Promise<{ success: number; failed: number }> {
		let success = 0;
		let failed = 0;
		const saved = new Set<string>();

		const persist = async (
			data: InstrumentData,
			sym: string,
		): Promise<void> => {
			try {
				await this.saveToDatabase(data);
				saved.add(sym);
				success++;
			} catch (err: any) {
				console.warn(`[ETFs] Save failed for ${sym}: ${err.message}`);
			}
		};

		// ── Tier 1: Yahoo Finance chart API — no cookie/session, confirmed HTTP 200 from
		// Cloud Run for US ETFs (SPY, QQQ, GLD, TLT all return live prices). This is
		// different from the yahoo-finance2 package which uses a cookie-gated endpoint
		// that rate-limits aggressively from datacenter IPs.
		// Build ETF metadata map for country/name enrichment
		const etfMetaMap = new Map(ETF_REGISTRY.map((e) => [e.symbol, e]));

		// US ETFs: symbols without a dot suffix (NYSEARCA/NASDAQ listed)
		const usEtfs = symbols.filter((s) => !s.includes("."));
		// Indian ETFs: .NS suffix (NSE-listed)
		const indiaEtfs = symbols.filter((s) => s.includes(".NS") || s.includes(".BO"));
		const allFetchable = [...usEtfs, ...indiaEtfs];

		if (allFetchable.length) {
			const ycResults = await this.fetchBatchFromYahooChart(allFetchable, "etf", etfMetaMap);
			for (const [sym, data] of ycResults) await persist(data, sym);
			if (saved.size === symbols.length) {
				console.log(
					`📊 [ETFs] Refreshed ${success} ETFs via Yahoo chart API (no fallback needed)`,
				);
				return { success, failed };
			}
		}

		// ── Tier 2: Google Finance HTML — for ETFs missed by Yahoo chart ──────────
		// Works locally; may be DNS-blocked from Cloud Run (www.google.com/finance
		// sometimes returns DNS failure on GCP). Kept as fallback.
		const gfNeeded = usEtfs.filter((s) => !saved.has(s));
		if (gfNeeded.length) {
			const gfResults = await this.fetchBatchFromGoogleFinance(gfNeeded, "etf");
			for (const [sym, data] of gfResults) await persist(data, sym);
			if (saved.size === symbols.length) {
				console.log(
					`📊 [ETFs] Refreshed ${success} ETFs via Google Finance HTML (no fallback needed)`,
				);
				return { success, failed };
			}
		}

		// ── Tier 3: FMP batch — free-tier /api/v3/quote, ETF specialist ────────
		const fmpNeeded = symbols.filter((s) => !saved.has(s));
		if (fmpNeeded.length && process.env.FMP_API_KEY) {
			console.log(`[ETFs] ${fmpNeeded.length} ETFs after GF → FMP batch`);
			const fmpResults = await this.fetchBatchFromFMP(fmpNeeded, "etf");
			for (const [sym, data] of fmpResults) await persist(data, sym);
		}

		// ── Tier 3: Python/yfinance for any still-missing ──────────────────────
		const pythonNeeded = symbols.filter((s) => !saved.has(s));
		if (pythonNeeded.length) {
			console.log(
				`[ETFs] ${pythonNeeded.length} ETFs after GF+FMP → Python/yfinance`,
			);
			const pythonResults = await this.fetchBatchFromPython(
				pythonNeeded,
				"etf",
			);
			for (const [sym, data] of pythonResults) await persist(data, sym);
		}

		// ── Tier 4: Alpha Vantage for US ETFs still missing ────────────────────
		const avNeeded = symbols.filter((s) => !saved.has(s) && !s.includes("."));
		if (avNeeded.length && process.env.ALPHA_VANTAGE_API_KEY) {
			console.log(
				`[ETFs] ${avNeeded.length} US ETFs after Python → Alpha Vantage`,
			);
			const avResults = await this.fetchBatchFromAlphaVantage(avNeeded, "etf");
			for (const [sym, data] of avResults) await persist(data, sym);
		}

		// ── Tier 5: Yahoo Finance — last resort, capped at 5 ─────────────────
		const yahooNeeded = symbols.filter((s) => !saved.has(s)).slice(0, 5);
		failed = symbols.filter((s) => !saved.has(s)).length;
		if (yahooNeeded.length) {
			console.log(`[ETFs] ${yahooNeeded.length} ETFs → Yahoo (capped at 5)`);
			const yahooResult = await this.refreshViaYahoo(yahooNeeded, "etf");
			success += yahooResult.success;
			failed = Math.max(
				0,
				symbols.filter((s) => !saved.has(s)).length - yahooResult.success,
			);
		}

		console.log(
			`📊 [FinancialDataRepository] Refreshed ETFs: ${success} success, ${failed} failed`,
		);
		return { success, failed };
	}

	private async refreshViaYahoo(
		symbols: string[],
		type: "global_stock" | "etf",
	): Promise<{ success: number; failed: number }> {
		let success = 0;
		let failed = 0;
		// 15s initial delay — datacenter IPs get 429 fast; spacing out drastically
		// reduces repeat failures. Bail immediately on the first rate-limit hit.
		const DELAY_MS = 15_000;

		for (const symbol of symbols) {
			try {
				const result =
					type === "etf"
						? await this.fetchETF(symbol)
						: await this.fetchGlobalStock(symbol);
				if (result.success && result.data) {
					await this.saveToDatabase(result.data);
					success++;
				} else {
					failed++;
					if (
						result.error?.includes("Rate limited") ||
						result.error?.includes("Too Many")
					) {
						console.log(
							`[Yahoo] Rate limited on ${symbol} — stopping Yahoo requests for this cycle`,
						);
						failed += symbols.length - (success + failed);
						break;
					}
				}
				await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
			} catch {
				failed++;
			}
		}

		return { success, failed };
	}

	async fetchDebtInstrument(
		symbol: string,
		type: string = "bond",
	): Promise<FetchResult> {
		try {
			const data: InstrumentData = {
				instrumentType: type,
				symbol: symbol,
				name: `${type.toUpperCase()} - ${symbol}`,
				exchange: type === "govt_security" ? "RBI" : "NSE",
				currency: "INR",
				country: "IN",
				dataSource: "internal",
				confidenceScore: 75,
				riskLevel: type === "govt_security" ? "Low" : "Moderate",
			};

			return { success: true, data };
		} catch (error) {
			console.warn(
				`⚠️ [FinancialDataRepository] Debt fetch failed for ${symbol}:`,
				error,
			);
			return { success: false, error: String(error) };
		}
	}

	async refreshDebtInstruments(
		instruments: Array<{
			symbol: string;
			type: string;
			name: string;
			yieldPercent?: number;
			couponRate?: number;
			maturityDate?: string;
		}>,
	): Promise<{ success: number; failed: number }> {
		let success = 0;
		let failed = 0;

		for (const inst of instruments) {
			try {
				const data: InstrumentData = {
					instrumentType: inst.type,
					symbol: inst.symbol,
					name: inst.name,
					exchange: inst.type === "govt_security" ? "RBI" : "NSE",
					currency: "INR",
					country: "IN",
					yieldPercent: inst.yieldPercent,
					couponRate: inst.couponRate,
					maturityDate: inst.maturityDate,
					dataSource: "internal",
					confidenceScore: 85,
					riskLevel: inst.type === "govt_security" ? "Low" : "Moderate",
				};
				await this.saveToDatabase(data);
				success++;
			} catch (error) {
				failed++;
			}
		}

		console.log(
			`📊 [FinancialDataRepository] Refreshed debt instruments: ${success} success, ${failed} failed`,
		);
		return { success, failed };
	}

	async refreshMutualFunds(
		schemeCodes: string[],
	): Promise<{ success: number; failed: number }> {
		let success = 0;
		let failed = 0;

		for (const code of schemeCodes) {
			try {
				const result = await this.fetchMutualFundFromMFAPI(code);
				if (result.success && result.data) {
					await this.saveToDatabase(result.data);
					success++;
				} else {
					failed++;
				}
				await new Promise((resolve) => setTimeout(resolve, 200));
			} catch (error) {
				failed++;
			}
		}

		console.log(
			`📊 [FinancialDataRepository] Refreshed mutual funds: ${success} success, ${failed} failed`,
		);
		return { success, failed };
	}

	async cleanupStaleData(maxAgeDays: number = 7): Promise<number> {
		const client = await pool.connect();
		try {
			const result = await client.query(`
        DELETE FROM financial_instruments_cache 
        WHERE updated_at < NOW() - INTERVAL '${maxAgeDays} days'
        RETURNING id
      `);
			const deleted = result.rowCount || 0;
			if (deleted > 0) {
				console.log(
					`🧹 [FinancialDataRepository] Cleaned up ${deleted} stale records`,
				);
			}
			return deleted;
		} finally {
			client.release();
		}
	}

	async getStatistics(): Promise<{
		totalRecords: number;
		byType: Record<string, number>;
		avgConfidence: number;
		lastUpdated: Date | null;
	}> {
		const client = await pool.connect();
		try {
			const countResult = await client.query(
				`SELECT COUNT(*) as total FROM financial_instruments_cache`,
			);
			const typeResult = await client.query(`
        SELECT instrument_type, COUNT(*) as count 
        FROM financial_instruments_cache 
        GROUP BY instrument_type
      `);
			const avgResult = await client.query(
				`SELECT AVG(confidence_score) as avg FROM financial_instruments_cache`,
			);
			const lastResult = await client.query(
				`SELECT MAX(updated_at) as last FROM financial_instruments_cache`,
			);

			const byType: Record<string, number> = {};
			typeResult.rows.forEach((row) => {
				byType[row.instrument_type] = Number.parseInt(row.count);
			});

			return {
				totalRecords: Number.parseInt(countResult.rows[0]?.total || 0),
				byType,
				avgConfidence: Number.parseFloat(avgResult.rows[0]?.avg || 0),
				lastUpdated: lastResult.rows[0]?.last || null,
			};
		} finally {
			client.release();
		}
	}

	async getInstrumentsForProposals(): Promise<{
		mutualFunds: any[];
		globalStocks: any[];
		etfs: any[];
		debtInstruments: any[];
		lastUpdated: string;
	}> {
		const client = await pool.connect();
		try {
			const [mfResult, stocksResult, etfsResult, debtResult] =
				await Promise.all([
					client.query(
						`SELECT * FROM financial_instruments_cache WHERE instrument_type = 'mutual_fund' AND confidence_score >= 80 ORDER BY confidence_score DESC LIMIT 100`,
					),
					client.query(
						`SELECT * FROM financial_instruments_cache WHERE instrument_type = 'global_stock' AND confidence_score >= 70 ORDER BY confidence_score DESC LIMIT 50`,
					),
					client.query(
						`SELECT * FROM financial_instruments_cache WHERE instrument_type = 'etf' AND confidence_score >= 70 ORDER BY confidence_score DESC LIMIT 50`,
					),
					client.query(
						`SELECT * FROM financial_instruments_cache WHERE instrument_type IN ('bond', 'ncd', 'govt_security') ORDER BY confidence_score DESC LIMIT 50`,
					),
				]);

			return {
				mutualFunds: mfResult.rows.map((row) => ({
					symbol: row.symbol,
					name: row.name,
					nav: row.nav ? Number.parseFloat(row.nav) : null,
					navDate: row.nav_date,
					category: row.category,
					amc: row.amc,
					return1y: row.return_1y ? Number.parseFloat(row.return_1y) : null,
					return3y: row.return_3y ? Number.parseFloat(row.return_3y) : null,
					return5y: row.return_5y ? Number.parseFloat(row.return_5y) : null,
					riskLevel: row.risk_level,
					confidenceScore: row.confidence_score,
					source: row.data_source,
				})),
				globalStocks: stocksResult.rows.map((row) => ({
					symbol: row.symbol,
					name: row.name,
					price: row.current_price
						? Number.parseFloat(row.current_price)
						: null,
					change: row.day_change_percent
						? Number.parseFloat(row.day_change_percent)
						: null,
					marketCap: row.market_cap ? Number.parseFloat(row.market_cap) : null,
					sector: row.sector,
					exchange: row.exchange,
					confidenceScore: row.confidence_score,
					source: row.data_source,
				})),
				etfs: etfsResult.rows.map((row) => ({
					symbol: row.symbol,
					name: row.name,
					price: row.current_price
						? Number.parseFloat(row.current_price)
						: null,
					nav: row.nav ? Number.parseFloat(row.nav) : null,
					category: row.category,
					expenseRatio: row.expense_ratio
						? Number.parseFloat(row.expense_ratio)
						: null,
					aum: row.aum ? Number.parseFloat(row.aum) : null,
					confidenceScore: row.confidence_score,
					source: row.data_source,
				})),
				debtInstruments: debtResult.rows.map((row) => ({
					symbol: row.symbol,
					name: row.name,
					type: row.instrument_type,
					yieldPercent: row.yield_percent
						? Number.parseFloat(row.yield_percent)
						: null,
					couponRate: row.coupon_rate
						? Number.parseFloat(row.coupon_rate)
						: null,
					maturityDate: row.maturity_date,
					riskLevel: row.risk_level,
					confidenceScore: row.confidence_score,
					source: row.data_source,
				})),
				lastUpdated: new Date().toISOString(),
			};
		} finally {
			client.release();
		}
	}

	async getMutualFundBySchemeCode(schemeCode: string): Promise<any | null> {
		const client = await pool.connect();
		try {
			const result = await client.query(
				`SELECT * FROM financial_instruments_cache WHERE instrument_type = 'mutual_fund' AND symbol = $1 LIMIT 1`,
				[schemeCode],
			);
			if (result.rows.length === 0) return null;
			const row = result.rows[0];
			return {
				symbol: row.symbol,
				name: row.name,
				nav: row.nav ? Number.parseFloat(row.nav) : null,
				navDate: row.nav_date,
				category: row.category,
				amc: row.amc,
				confidenceScore: row.confidence_score,
			};
		} finally {
			client.release();
		}
	}
}

export const financialDataRepository = new FinancialDataRepository();
