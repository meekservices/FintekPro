/**
 * IndianAPI.in Service
 *
 * Primary Indian market data source for:
 * - Live NSE/BSE stock quotes (price, volume, 52W H/L)
 * - Company fundamentals (P&L, Balance Sheet, Cash Flow)
 * - Valuation ratios (PE, PB, ROE, ROA, Debt/Equity)
 * - IPO data (upcoming, recent, subscription status)
 * - Stock search across NSE+BSE
 * - FII/DII institutional flows (via MrChartist free API)
 *
 * Auth: X-API-Key header
 * Base URL: https://analyst.indianapi.in
 * Enrichment chain priority: 0.88
 * (Slots between NSE/BSE 0.90 and Finnhub 0.75 — India-native, SEBI-safe)
 *
 * @module indian-api-service
 */

import axios, { AxiosInstance } from "axios";
import { requestDedupeService } from "./request-deduplication-service";
import { logger } from "../logger";

const INDIAN_API_KEY = process.env.INDIAN_API_KEY || "";
const INDIAN_API_BASE_URL = "https://analyst.indianapi.in";
const MRCHARTIST_BASE_URL = "https://api.mrchartist.in";
const ENGINE_VERSION = "2.0.0";

// Growth plan — dedicated server, generous limits
const RATE_LIMIT_PER_MINUTE = 300;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// ── Cache TTLs (ms) ───────────────────────────────────────────────────────────
const TTL = {
	QUOTE:            5  * 60 * 1_000,   // 5 min  — live price
	MARKET:           3  * 60 * 1_000,   // 3 min  — most active, trending
	FUNDAMENTALS:     24 * 60 * 60 * 1_000, // 24h — ratios, B/S, P&L
	CORPORATE:        6  * 60 * 60 * 1_000, // 6h  — dividends, splits
	NEWS:             15 * 60 * 1_000,   // 15 min — news feeds
	IPO:              30 * 60 * 1_000,   // 30 min — IPO data
	MF:               60 * 60 * 1_000,   // 1h  — mutual fund data
	LOGO:             7  * 24 * 60 * 60 * 1_000, // 7d — company logos
	FII_DII:          15 * 60 * 1_000,   // 15 min
	FII_DII_HISTORY:  6  * 60 * 60 * 1_000, // 6h
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface IndianAPIStockQuote {
	symbol: string;
	company_name: string;
	exchange: "NSE" | "BSE";
	current_price: number;
	previous_close: number;
	change: number;
	change_percent: number;
	volume: number;
	market_cap?: number;
	high_52w?: number;
	low_52w?: number;
	day_high?: number;
	day_low?: number;
	pe_ratio?: number;
	pb_ratio?: number;
	eps?: number;
	face_value?: number;
	isin?: string;
	sector?: string;
	industry?: string;
}

export interface IndianAPIBalanceSheet {
	year: string;
	total_assets: number;
	total_liabilities: number;
	networth: number;
	total_debt: number;
	current_assets?: number;
	current_liabilities?: number;
	fixed_assets?: number;
	investments?: number;
	cash_and_bank?: number;
}

export interface IndianAPIProfitLoss {
	year: string;
	revenue: number;
	gross_profit?: number;
	ebitda?: number;
	ebit?: number;
	pat: number;
	eps: number;
	dividend?: number;
	operating_margin?: number;
	net_margin?: number;
}

export interface IndianAPICashFlow {
	year: string;
	operating_cash_flow: number;
	investing_cash_flow: number;
	financing_cash_flow: number;
	free_cash_flow?: number;
	capex?: number;
}

export interface IndianAPIRatios {
	symbol: string;
	pe_ratio?: number;
	pb_ratio?: number;
	roe?: number;
	roa?: number;
	roce?: number;
	debt_equity?: number;
	current_ratio?: number;
	quick_ratio?: number;
	interest_coverage?: number;
	dividend_yield?: number;
	peg_ratio?: number;
}

export interface IndianAPICompanyProfile {
	symbol: string;
	company_name: string;
	isin: string;
	sector: string;
	industry: string;
	exchange: string;
	market_cap: number;
	face_value: number;
	listing_date?: string;
	website?: string;
	description?: string;
	management?: Array<{ name: string; designation: string }>;
}

export interface IndianAPIIPO {
	company_name: string;
	symbol?: string;
	open_date: string;
	close_date: string;
	listing_date?: string;
	issue_price?: number;
	lot_size?: number;
	issue_size?: number;
	subscription?: {
		qib?: number;
		nii?: number;
		retail?: number;
		total?: number;
	};
	status: "upcoming" | "open" | "allotment" | "listing" | "listed";
	gmp?: number;
	issue_type?: string;
}

export interface IndianAPIFIIDII {
	date: string;
	fii: { buy: number; sell: number; net: number };
	dii: { buy: number; sell: number; net: number };
}

export interface IndianAPIResult<T> {
	success: boolean;
	data?: T;
	source: "indian_api";
	retrievedAt: Date;
	error?: string;
	rateLimitRemaining?: number;
	engine_version: string;
	calculation_timestamp: string;
}

/** Parsed dividend entry from corporate_actions.dividends.data */
export interface DividendRecord {
	record_date: string;
	ex_date: string;
	dividend_percent: string;
	amount_per_share: number | null;
	details: string;
}

export interface CorporateActions {
	dividends: DividendRecord[];
	splits: any[];
	bonus: any[];
	rights: any[];
	board_meetings: any[];
}

export interface AnalystTargetPrice {
	currency: string;
	mean: number;
	median: number;
	high: number;
	low: number;
	num_estimates: number;
	std_deviation: number;
	snapshots: Array<{ age: string; mean: number; high: number; low: number; num_estimates: number }>;
}

export interface MostActiveStock {
	ticker: string;
	company: string;
	price: number;
	percent_change: number;
	net_change: number;
	volume: number;
	high: number;
	low: number;
	week_high_52: number;
	week_low_52: number;
	overall_rating?: string;
}

export interface MutualFundSummary {
	id: string;
	name: string;
	category?: string;
	nav?: number;
	aum?: number;
	returns_1y?: number;
	returns_3y?: number;
	risk_rating?: string;
}

export interface MutualFundDetails {
	id: string;
	name: string;
	category: string;
	nav: number;
	aum?: number;
	expense_ratio?: number;
	returns_1y?: number;
	returns_3y?: number;
	returns_5y?: number;
	fund_manager?: string;
	benchmark?: string;
	min_sip?: number;
	min_lumpsum?: number;
	exit_load?: string;
	risk_rating?: string;
	isin?: string;
}

export interface NewsItem {
	title: string;
	url: string;
	source?: string;
	published_at?: string;
	summary?: string;
	category?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractDividendAmount(text: string): number | null {
	const match = text.match(/Rs\.?\s*([\d,]+\.?\d*)\s*per\s*(equity\s*)?share/i);
	if (match) return parseFloat(match[1].replace(/,/g, ""));
	const match2 = text.match(/dividend\s+of\s+Rs\.?\s*([\d,]+\.?\d*)/i);
	if (match2) return parseFloat(match2[1].replace(/,/g, ""));
	return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service class
// ─────────────────────────────────────────────────────────────────────────────

class IndianAPIService {
	private client: AxiosInstance;
	private mrClient: AxiosInstance;
	private isConfigured: boolean;
	private requestCount = 0;
	private windowStart = Date.now();

	constructor() {
		this.isConfigured = Boolean(INDIAN_API_KEY);
		this.client = axios.create({
			baseURL: INDIAN_API_BASE_URL,
			headers: { "X-API-Key": INDIAN_API_KEY, "Content-Type": "application/json" },
			timeout: 15_000,
		});
		this.mrClient = axios.create({
			baseURL: MRCHARTIST_BASE_URL,
			timeout: 10_000,
		});

		if (!this.isConfigured) {
			logger.warn("⚠️ INDIAN_API_KEY not configured. IndianAPI service disabled.");
		} else {
			logger.info("✅ IndianAPI.in Growth Plan service initialized (enrichment priority: 0.88, 31 endpoints active)");
		}
	}

	isReady(): boolean { return this.isConfigured; }

	getStatus() {
		return {
			configured: this.isConfigured,
			baseUrl: INDIAN_API_BASE_URL,
			plan: "Growth (Dedicated Server)",
			endpoints_active: 31,
			rateLimitRemaining: this.getRateLimitRemaining(),
			source: "indian_api",
		};
	}

	private getRateLimitRemaining(): number {
		const now = Date.now();
		if (now - this.windowStart >= RATE_LIMIT_WINDOW_MS) {
			this.requestCount = 0;
			this.windowStart = now;
		}
		return RATE_LIMIT_PER_MINUTE - this.requestCount;
	}

	private async checkRateLimit(): Promise<void> {
		const remaining = this.getRateLimitRemaining();
		if (remaining <= 0) {
			const waitTime = RATE_LIMIT_WINDOW_MS - (Date.now() - this.windowStart);
			logger.info(`[IndianAPI] Rate limit reached, waiting ${waitTime}ms`);
			await new Promise((r) => setTimeout(r, waitTime));
			this.requestCount = 0;
			this.windowStart = Date.now();
		}
		this.requestCount++;
	}

	private async retryWithBackoff<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
		let lastError: Error | null = null;
		for (let attempt = 0; attempt <= retries; attempt++) {
			try {
				await this.checkRateLimit();
				return await fn();
			} catch (error: any) {
				lastError = error;
				const status = error.response?.status;
				if (status === 429 || (status && status >= 500)) {
					const delay = BASE_DELAY_MS * 2 ** attempt;
					logger.warn(`[IndianAPI] HTTP ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`);
					await new Promise((r) => setTimeout(r, delay));
				} else {
					throw error;
				}
			}
		}
		throw lastError ?? new Error("[IndianAPI] Max retries exceeded");
	}

	private makeResult<T>(data: T): IndianAPIResult<T> {
		return {
			success: true,
			data,
			source: "indian_api",
			retrievedAt: new Date(),
			rateLimitRemaining: this.getRateLimitRemaining(),
			engine_version: ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	private makeError<T>(msg: string): IndianAPIResult<T> {
		return {
			success: false,
			source: "indian_api",
			retrievedAt: new Date(),
			error: msg,
			engine_version: ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	private notConfigured<T>(): IndianAPIResult<T> {
		return this.makeError<T>("IndianAPI not configured — INDIAN_API_KEY missing");
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// MODULE A: Market Intelligence
	// ═══════════════════════════════════════════════════════════════════════════

	async getMostActive(exchange: "NSE" | "BSE" = "NSE"): Promise<IndianAPIResult<MostActiveStock[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "most_active", exchange);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const endpoint = exchange === "NSE" ? "/NSE_most_active" : "/BSE_most_active";
				const r = await this.retryWithBackoff(() => this.client.get(endpoint));
				const rawList: any[] = Array.isArray(r.data) ? r.data : r.data?.data ?? [];
				return this.makeResult<MostActiveStock[]>(rawList.map((s: any) => ({
					ticker: s.ticker ?? s.symbol ?? "",
					company: s.company ?? s.companyName ?? "",
					price: Number(s.price ?? 0),
					percent_change: Number(s.percent_change ?? s.pChange ?? 0),
					net_change: Number(s.net_change ?? s.change ?? 0),
					volume: Number(s.volume ?? 0),
					high: Number(s.high ?? 0),
					low: Number(s.low ?? 0),
					week_high_52: Number(s["52_week_high"] ?? s.weekHigh52 ?? 0),
					week_low_52: Number(s["52_week_low"] ?? s.weekLow52 ?? 0),
					overall_rating: s.overall_rating,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getMostActive(${exchange}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MARKET);
	}

	async getTrending(exchange: "NSE" | "BSE" = "NSE"): Promise<IndianAPIResult<MostActiveStock[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "trending", exchange);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/trending", { params: { exchange } }),
				);
				const rawList: any[] = r.data?.trending_stocks ?? (Array.isArray(r.data) ? r.data : []);
				return this.makeResult<MostActiveStock[]>(rawList.map((s: any) => ({
					ticker: s.ticker ?? s.symbol ?? "",
					company: s.company ?? s.companyName ?? "",
					price: Number(s.price ?? 0),
					percent_change: Number(s.percent_change ?? s.pChange ?? 0),
					net_change: Number(s.net_change ?? s.change ?? 0),
					volume: Number(s.volume ?? 0),
					high: Number(s.high ?? 0),
					low: Number(s.low ?? 0),
					week_high_52: Number(s["52_week_high"] ?? 0),
					week_low_52: Number(s["52_week_low"] ?? 0),
					overall_rating: s.overall_rating,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getTrending(${exchange}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MARKET);
	}

	async getPriceShockers(): Promise<IndianAPIResult<{ nse: any[]; bse: any[] }>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "price_shockers", "all");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get("/price_shockers"));
				return this.makeResult({ nse: r.data?.NSE_PriceShocker ?? [], bse: r.data?.BSE_PriceShocker ?? [] });
			} catch (error: any) {
				logger.error(`[IndianAPI] getPriceShockers() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MARKET);
	}

	async get52WeekHighLow(): Promise<IndianAPIResult<{ nse: any[]; bse: any[] }>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "52whl", "all");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get("/fetch_52_week_high_low_data"));
				return this.makeResult({ nse: r.data?.NSE_52WeekHighLow ?? [], bse: r.data?.BSE_52WeekHighLow ?? [] });
			} catch (error: any) {
				logger.error(`[IndianAPI] get52WeekHighLow() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MARKET);
	}

	async getBatchLivePriceNSE(symbols: string[]): Promise<IndianAPIResult<Record<string, number>>> {
		if (!this.isConfigured) return this.notConfigured();
		try {
			const r = await this.retryWithBackoff(() =>
				this.client.post("/nse_stock_batch_live_price", { stock_ids: symbols }),
			);
			const prices: Record<string, number> = {};
			(r.data ?? []).forEach((item: any) => {
				if (item.symbol ?? item.ticker) {
					prices[item.symbol ?? item.ticker] = Number(item.price ?? item.lastPrice ?? 0);
				}
			});
			return this.makeResult(prices);
		} catch (error: any) {
			logger.error(`[IndianAPI] getBatchLivePriceNSE() error: ${error.message}`);
			return this.makeError(error.message);
		}
	}

	async getBatchLivePriceBSE(symbols: string[]): Promise<IndianAPIResult<Record<string, number>>> {
		if (!this.isConfigured) return this.notConfigured();
		try {
			const r = await this.retryWithBackoff(() =>
				this.client.post("/bse_stock_batch_live_price", { stock_ids: symbols }),
			);
			const prices: Record<string, number> = {};
			(r.data ?? []).forEach((item: any) => {
				if (item.symbol ?? item.ticker) {
					prices[item.symbol ?? item.ticker] = Number(item.price ?? item.lastPrice ?? 0);
				}
			});
			return this.makeResult(prices);
		} catch (error: any) {
			logger.error(`[IndianAPI] getBatchLivePriceBSE() error: ${error.message}`);
			return this.makeError(error.message);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// MODULE B: Corporate Actions & Dividends
	// ═══════════════════════════════════════════════════════════════════════════

	async getCorporateActions(symbol: string): Promise<IndianAPIResult<CorporateActions>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "corporate_actions", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/corporate_actions", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const raw = r.data ?? {};
				const divRaw = raw.dividends ?? {};
				const divData: any[][] = divRaw.data ?? [];
				const dividends: DividendRecord[] = divData.map((row: any[]) => ({
					record_date: row[0] ?? "",
					ex_date: row[1] ?? "",
					dividend_percent: row[2] ?? "",
					amount_per_share: extractDividendAmount(row[3] ?? ""),
					details: row[3] ?? "",
				}));
				const splitRaw = raw.splits ?? {};
				const splits: any[] = Array.isArray(splitRaw) ? splitRaw : (splitRaw.data ?? []);
				const bonusRaw = raw.bonus ?? {};
				const bonus: any[] = Array.isArray(bonusRaw) ? bonusRaw : (bonusRaw.data ?? []);
				const rightsRaw = raw.rights ?? {};
				const rights: any[] = Array.isArray(rightsRaw) ? rightsRaw : (rightsRaw.data ?? []);
				const bmRaw = raw.board_meetings ?? {};
				const board_meetings: any[] = Array.isArray(bmRaw) ? bmRaw : (bmRaw.data ?? []);

				return this.makeResult<CorporateActions>({ dividends, splits, bonus, rights, board_meetings });
			} catch (error: any) {
				logger.error(`[IndianAPI] getCorporateActions(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.CORPORATE);
	}

	async getEnrichedStockData(symbol: string): Promise<IndianAPIResult<any>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "enriched_stock", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/get_stock_data", { params: { stock_name: symbol.toUpperCase() } }),
				);
				return this.makeResult(r.data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getEnrichedStockData(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.QUOTE);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// MODULE C: Fundamental Research
	// ═══════════════════════════════════════════════════════════════════════════

	async getStockQuote(symbol: string, exchange: "NSE" | "BSE" = "NSE"): Promise<IndianAPIResult<IndianAPIStockQuote>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "quote", `${exchange}:${symbol}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock", { params: { name: symbol.toUpperCase() } }),
				);
				const raw = r.data;
				return this.makeResult<IndianAPIStockQuote>({
					symbol: raw.symbol ?? symbol,
					company_name: raw.companyName ?? raw.name ?? symbol,
					exchange,
					current_price: Number(raw.currentPrice ?? raw.lastPrice ?? raw.price_data?.current_price ?? 0),
					previous_close: Number(raw.previousClose ?? raw.price_data?.previous_close ?? 0),
					change: Number(raw.change ?? 0),
					change_percent: Number(raw.pChange ?? raw.changePercent ?? 0),
					volume: Number(raw.totalTradedVolume ?? raw.volume ?? 0),
					market_cap: raw.marketCap ? Number(raw.marketCap) : undefined,
					high_52w: raw["52WeekHigh"] ? Number(raw["52WeekHigh"]) : undefined,
					low_52w: raw["52WeekLow"] ? Number(raw["52WeekLow"]) : undefined,
					day_high: raw.dayHigh ? Number(raw.dayHigh) : undefined,
					day_low: raw.dayLow ? Number(raw.dayLow) : undefined,
					pe_ratio: raw.pe ? Number(raw.pe) : undefined,
					pb_ratio: raw.pb ? Number(raw.pb) : undefined,
					eps: raw.eps ? Number(raw.eps) : undefined,
					face_value: raw.faceValue ? Number(raw.faceValue) : undefined,
					isin: raw.isin ?? undefined,
					sector: raw.sector ?? undefined,
					industry: raw.industry ?? undefined,
				});
			} catch (error: any) {
				logger.error(`[IndianAPI] getStockQuote(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.QUOTE);
	}

	async getCompanyProfile(symbol: string): Promise<IndianAPIResult<IndianAPICompanyProfile>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "profile", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock", { params: { name: symbol.toUpperCase() } }),
				);
				const raw = r.data;
				return this.makeResult<IndianAPICompanyProfile>({
					symbol: raw.symbol ?? symbol,
					company_name: raw.companyName ?? symbol,
					isin: raw.isin ?? "",
					sector: raw.sector ?? "",
					industry: raw.industry ?? "",
					exchange: raw.exchange ?? "NSE",
					market_cap: Number(raw.marketCap ?? 0),
					face_value: Number(raw.faceValue ?? 10),
					listing_date: raw.listingDate,
					website: raw.website,
					description: raw.about ?? raw.description,
					management: raw.management ?? [],
				});
			} catch (error: any) {
				logger.error(`[IndianAPI] getCompanyProfile(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getProfitLoss(symbol: string, years = 5): Promise<IndianAPIResult<IndianAPIProfitLoss[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "pl", `${symbol}:${years}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/statement", { params: { stock_name: symbol.toUpperCase(), stats: "profit-loss" } }),
				);
				const rawList: any[] = (r.data?.profit_loss ?? r.data?.incomeStatement ?? r.data ?? []).slice(0, years);
				return this.makeResult<IndianAPIProfitLoss[]>(rawList.map((row: any) => ({
					year: row.year ?? row.period ?? "",
					revenue: Number(row.revenue ?? row.netSales ?? row.totalIncome ?? 0),
					gross_profit: row.grossProfit ? Number(row.grossProfit) : undefined,
					ebitda: row.ebitda ? Number(row.ebitda) : undefined,
					ebit: row.ebit ? Number(row.ebit) : undefined,
					pat: Number(row.pat ?? row.netProfit ?? row.netIncome ?? 0),
					eps: Number(row.eps ?? row.basicEps ?? 0),
					dividend: row.dividend ? Number(row.dividend) : undefined,
					operating_margin: row.operatingMargin ? Number(row.operatingMargin) : undefined,
					net_margin: row.netMargin ? Number(row.netMargin) : undefined,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getProfitLoss(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getBalanceSheet(symbol: string, years = 5): Promise<IndianAPIResult<IndianAPIBalanceSheet[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "bs", `${symbol}:${years}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/statement", { params: { stock_name: symbol.toUpperCase(), stats: "balance-sheet" } }),
				);
				const rawList: any[] = (r.data?.balance_sheet ?? r.data?.balanceSheet ?? r.data ?? []).slice(0, years);
				return this.makeResult<IndianAPIBalanceSheet[]>(rawList.map((row: any) => ({
					year: row.year ?? row.period ?? "",
					total_assets: Number(row.totalAssets ?? row.total_assets ?? 0),
					total_liabilities: Number(row.totalLiabilities ?? row.total_liabilities ?? 0),
					networth: Number(row.networth ?? row.shareholdersEquity ?? 0),
					total_debt: Number(row.totalDebt ?? row.borrowings ?? 0),
					current_assets: row.currentAssets ? Number(row.currentAssets) : undefined,
					current_liabilities: row.currentLiabilities ? Number(row.currentLiabilities) : undefined,
					fixed_assets: row.fixedAssets ? Number(row.fixedAssets) : undefined,
					investments: row.investments ? Number(row.investments) : undefined,
					cash_and_bank: row.cashAndBank ? Number(row.cashAndBank) : undefined,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getBalanceSheet(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getCashFlow(symbol: string, years = 5): Promise<IndianAPIResult<IndianAPICashFlow[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "cf", `${symbol}:${years}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/statement", { params: { stock_name: symbol.toUpperCase(), stats: "cash-flow" } }),
				);
				const rawList: any[] = (r.data?.cash_flow ?? r.data?.cashFlow ?? r.data ?? []).slice(0, years);
				return this.makeResult<IndianAPICashFlow[]>(rawList.map((row: any) => ({
					year: row.year ?? row.period ?? "",
					operating_cash_flow: Number(row.operatingCashFlow ?? row.cfo ?? row.operating ?? 0),
					investing_cash_flow: Number(row.investingCashFlow ?? row.cfi ?? row.investing ?? 0),
					financing_cash_flow: Number(row.financingCashFlow ?? row.cff ?? row.financing ?? 0),
					free_cash_flow: row.freeCashFlow ? Number(row.freeCashFlow) : undefined,
					capex: row.capex ? Number(row.capex) : undefined,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getCashFlow(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getRatios(symbol: string): Promise<IndianAPIResult<IndianAPIRatios>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "ratios", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock", { params: { name: symbol.toUpperCase() } }),
				);
				const raw = r.data;
				return this.makeResult<IndianAPIRatios>({
					symbol,
					pe_ratio: raw.pe ? Number(raw.pe) : undefined,
					pb_ratio: raw.pb ? Number(raw.pb) : undefined,
					roe: raw.roe ? Number(raw.roe) : undefined,
					roa: raw.roa ? Number(raw.roa) : undefined,
					roce: raw.roce ? Number(raw.roce) : undefined,
					debt_equity: (raw.debtEquity ?? raw.de) ? Number(raw.debtEquity ?? raw.de) : undefined,
					current_ratio: raw.currentRatio ? Number(raw.currentRatio) : undefined,
					quick_ratio: raw.quickRatio ? Number(raw.quickRatio) : undefined,
					interest_coverage: raw.interestCoverage ? Number(raw.interestCoverage) : undefined,
					dividend_yield: raw.dividendYield ? Number(raw.dividendYield) : undefined,
					peg_ratio: raw.peg ? Number(raw.peg) : undefined,
				});
			} catch (error: any) {
				logger.error(`[IndianAPI] getRatios(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getAnalystTargetPrice(symbol: string): Promise<IndianAPIResult<AnalystTargetPrice>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "target_price", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock_target_price", { params: { stock_id: symbol.toUpperCase() } }),
				);
				const pt = r.data?.priceTarget ?? r.data ?? {};
				const snapshots = (r.data?.priceTargetSnapshots?.PriceTargetSnapshot ?? []).map((s: any) => ({
					age: s.Age ?? "",
					mean: Number(s.Mean ?? 0),
					high: Number(s.High ?? 0),
					low: Number(s.Low ?? 0),
					num_estimates: Number(s.NumberOfEstimates ?? 0),
				}));
				return this.makeResult<AnalystTargetPrice>({
					currency: pt.CurrencyCode ?? "INR",
					mean: Number(pt.Mean ?? pt.UnverifiedMean ?? 0),
					median: Number(pt.Median ?? 0),
					high: Number(pt.High ?? 0),
					low: Number(pt.Low ?? 0),
					num_estimates: Number(pt.NumberOfEstimates ?? 0),
					std_deviation: Number(pt.StandardDeviation ?? 0),
					snapshots,
				});
			} catch (error: any) {
				logger.error(`[IndianAPI] getAnalystTargetPrice(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getCreditRatings(symbol: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "credit_ratings", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/credit_ratings", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getCreditRatings(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getAnnualReports(symbol: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "annual_reports", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/annual_reports", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getAnnualReports(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getConcalls(symbol: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "concalls", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/concalls", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
				return this.makeResult<any[]>(data.map((c: any) => ({
					date: c.date ?? "",
					transcript_url: c.transcript ?? null,
					ai_summary_path: c["ai summary"] ?? null,
					ppt_url: c.ppt ?? null,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getConcalls(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FUNDAMENTALS);
	}

	async getDocuments(symbol: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "documents", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/documents", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getDocuments(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.NEWS);
	}

	async getRecentAnnouncements(symbol: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "announcements", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/recent_announcements", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getRecentAnnouncements(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.NEWS);
	}

	async getHistoricalData(symbol: string, period = "1y"): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "historical_data", `${symbol}:${period}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/historical_data", {
						params: { stock_name: symbol.toUpperCase(), period, filter: "default" },
					}),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.prices ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getHistoricalData(${symbol}, ${period}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MARKET);
	}

	async getCompanyLogo(symbol: string): Promise<IndianAPIResult<{ logo_url: string | null }>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "logo", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/logo", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const url = r.data?.logo ?? r.data?.url ?? r.data?.logo_url ?? null;
				return this.makeResult({ logo_url: url });
			} catch (error: any) {
				logger.error(`[IndianAPI] getCompanyLogo(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.LOGO);
	}

	async searchStocks(query: string): Promise<IndianAPIResult<Array<{ symbol: string; name: string; exchange: string }>>> {
		if (!this.isConfigured) return this.notConfigured();
		try {
			const r = await this.retryWithBackoff(() =>
				this.client.get("/industry_search", { params: { query } }),
			);
			const results = (r.data?.results ?? r.data ?? []).map((item: any) => ({
				symbol: item.symbol ?? item.ticker ?? "",
				name: item.name ?? item.companyName ?? "",
				exchange: item.exchange ?? "NSE",
			}));
			return this.makeResult(results);
		} catch (error: any) {
			logger.error(`[IndianAPI] searchStocks(${query}) error: ${error.message}`);
			return this.makeError(error.message);
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// MODULE D: Mutual Funds
	// ═══════════════════════════════════════════════════════════════════════════

	async getAllMutualFunds(): Promise<IndianAPIResult<MutualFundSummary[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "mf_all", "list");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get("/mutual_funds"));
				const rawList: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.funds ?? []);
				return this.makeResult<MutualFundSummary[]>(rawList.map((f: any) => ({
					id: f.id ?? f.schemeCode ?? f.scheme_code ?? "",
					name: f.name ?? f.schemeName ?? f.scheme_name ?? "",
					category: f.category ?? f.schemeCategory,
					nav: f.nav ? Number(f.nav) : undefined,
					aum: f.aum ? Number(f.aum) : undefined,
					returns_1y: (f.returns_1y ?? f.return1Year) ? Number(f.returns_1y ?? f.return1Year) : undefined,
					returns_3y: (f.returns_3y ?? f.return3Year) ? Number(f.returns_3y ?? f.return3Year) : undefined,
					risk_rating: f.riskometer ?? f.risk,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getAllMutualFunds() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MF);
	}

	async getMutualFundDetails(schemeSlug: string): Promise<IndianAPIResult<MutualFundDetails>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "mf_details", schemeSlug);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/mutual_funds_details", { params: { stock_name: schemeSlug } }),
				);
				const raw = r.data ?? {};
				return this.makeResult<MutualFundDetails>({
					id: raw.id ?? raw.schemeCode ?? schemeSlug,
					name: raw.name ?? raw.schemeName ?? "",
					category: raw.category ?? raw.schemeCategory ?? "",
					nav: Number(raw.nav ?? 0),
					aum: raw.aum ? Number(raw.aum) : undefined,
					expense_ratio: raw.expenseRatio ? Number(raw.expenseRatio) : undefined,
					returns_1y: raw.returns_1y ? Number(raw.returns_1y) : undefined,
					returns_3y: raw.returns_3y ? Number(raw.returns_3y) : undefined,
					returns_5y: raw.returns_5y ? Number(raw.returns_5y) : undefined,
					fund_manager: raw.fundManager ?? raw.fund_manager,
					benchmark: raw.benchmark,
					min_sip: raw.minSip ? Number(raw.minSip) : undefined,
					min_lumpsum: raw.minLumpsum ? Number(raw.minLumpsum) : undefined,
					exit_load: raw.exitLoad,
					risk_rating: raw.riskometer ?? raw.risk,
					isin: raw.isin,
				});
			} catch (error: any) {
				logger.error(`[IndianAPI] getMutualFundDetails(${schemeSlug}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MF);
	}

	async searchMutualFunds(query: string): Promise<IndianAPIResult<MutualFundSummary[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "mf_search", query.toLowerCase());
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/mutual_fund_search", { params: { query } }),
				);
				const rawList: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.results ?? []);
				return this.makeResult<MutualFundSummary[]>(rawList.map((f: any) => ({
					id: f.id ?? f.schemeCode ?? f.scheme_code ?? "",
					name: f.name ?? f.schemeName ?? f.scheme_name ?? "",
					category: f.category ?? f.schemeCategory,
					nav: f.nav ? Number(f.nav) : undefined,
					aum: f.aum ? Number(f.aum) : undefined,
					risk_rating: f.riskometer ?? f.risk,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] searchMutualFunds(${query}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MF);
	}

	async getMFHoldings(schemeId: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "mf_holdings", schemeId);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/mf_holdings", { params: { stock_id: schemeId } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.holdings ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getMFHoldings(${schemeId}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MF);
	}

	async getMFNavHistory(schemeId: string): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "mf_nav_history", schemeId);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/get_mf_historical_data", { params: { stock_id: schemeId, stats: "nav" } }),
				);
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.navHistory ?? []);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getMFNavHistory(${schemeId}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MF);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// MODULE E: IPO Intelligence
	// ═══════════════════════════════════════════════════════════════════════════

	async getIPOList(): Promise<IndianAPIResult<IndianAPIIPO[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "ipo", "list");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get("/ipo"));
				const rawList: any[] = r.data?.data ?? (Array.isArray(r.data) ? r.data : []);
				return this.makeResult<IndianAPIIPO[]>(rawList.map((item: any) => ({
					company_name: item.companyName ?? item.name ?? "",
					symbol: item.symbol,
					open_date: item.openDate ?? item.open ?? "",
					close_date: item.closeDate ?? item.close ?? "",
					listing_date: item.listingDate,
					issue_price: item.issuePrice ? Number(item.issuePrice) : undefined,
					lot_size: item.lotSize ? Number(item.lotSize) : undefined,
					issue_size: item.issueSize ? Number(item.issueSize) : undefined,
					subscription: item.subscription,
					status: item.status ?? "upcoming",
					gmp: item.gmp ? Number(item.gmp) : undefined,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getIPOList() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.IPO);
	}

	async getIPOv2(status?: string, issueType?: string): Promise<IndianAPIResult<IndianAPIIPO[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "ipo_v2", `${status ?? "all"}:${issueType ?? "all"}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const params: Record<string, string> = {};
				if (status) params.status = status;
				if (issueType) params.issue_type = issueType;
				const r = await this.retryWithBackoff(() => this.client.get("/ipo/v2", { params }));
				const rawList: any[] = r.data?.data ?? (Array.isArray(r.data) ? r.data : []);
				return this.makeResult<IndianAPIIPO[]>(rawList.map((item: any) => ({
					company_name: item.companyName ?? item.name ?? "",
					symbol: item.symbol,
					open_date: item.openDate ?? item.open ?? "",
					close_date: item.closeDate ?? item.close ?? "",
					listing_date: item.listingDate,
					issue_price: item.issuePrice ? Number(item.issuePrice) : undefined,
					lot_size: item.lotSize ? Number(item.lotSize) : undefined,
					issue_size: item.issueSize ? Number(item.issueSize) : undefined,
					subscription: item.subscription,
					status: item.status ?? status ?? "upcoming",
					gmp: item.gmp ? Number(item.gmp) : undefined,
					issue_type: item.issueType ?? issueType,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getIPOv2() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.IPO);
	}

	async getIPOById(id: string): Promise<IndianAPIResult<any>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "ipo_detail", id);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get(`/ipo/${id}`));
				return this.makeResult(r.data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getIPOById(${id}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.IPO);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// MODULE F: News & Sentiment + Commodities
	// ═══════════════════════════════════════════════════════════════════════════

	async getMarketNews(page = 1, size = 20): Promise<IndianAPIResult<NewsItem[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "news", `${page}:${size}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/news", { params: { page_no: page, size } }),
				);
				const rawList: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.news ?? []);
				return this.makeResult<NewsItem[]>(rawList.map((n: any) => ({
					title: n.title ?? "",
					url: n.url ?? n.link ?? "",
					source: n.source ?? n.publisher,
					published_at: n.publishedAt ?? n.published_at ?? n.date,
					summary: n.summary ?? n.description,
					category: n.category,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getMarketNews() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.NEWS);
	}

	async getAINews(category = "market"): Promise<IndianAPIResult<NewsItem[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "ai_news", category);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/ai_news", { params: { category } }),
				);
				const rawList: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.news ?? []);
				return this.makeResult<NewsItem[]>(rawList.map((n: any) => ({
					title: n.title ?? "",
					url: n.url ?? n.link ?? "",
					source: n.source ?? n.publisher,
					published_at: n.publishedAt ?? n.published_at ?? n.date,
					summary: n.summary ?? n.description,
					category: n.category ?? category,
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getAINews(${category}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.NEWS);
	}

	async getCompanyNews(symbol: string): Promise<IndianAPIResult<NewsItem[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "company_news", symbol);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/company_news", { params: { stock_name: symbol.toUpperCase() } }),
				);
				const rawList: any[] = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.news ?? []);
				return this.makeResult<NewsItem[]>(rawList.map((n: any) => ({
					title: n.title ?? "",
					url: n.url ?? n.link ?? "",
					source: n.source ?? n.publisher,
					published_at: n.publishedAt ?? n.published_at ?? n.date,
					summary: n.summary ?? n.description,
					category: "company",
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getCompanyNews(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.NEWS);
	}

	async getCommodities(): Promise<IndianAPIResult<any[]>> {
		if (!this.isConfigured) return this.notConfigured();
		const key = requestDedupeService.createKey("indian_api", "commodities", "all");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get("/commodities"));
				const data = Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.commodities ?? [r.data]);
				return this.makeResult<any[]>(data);
			} catch (error: any) {
				logger.error(`[IndianAPI] getCommodities() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.MARKET);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// FII/DII (Mr. Chartist — unchanged)
	// ═══════════════════════════════════════════════════════════════════════════

	async getLatestFIIDII(): Promise<IndianAPIResult<IndianAPIFIIDII>> {
		const key = requestDedupeService.createKey("indian_api", "fiidii", "latest");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.mrClient.get("/api/data");
				const raw = r.data;
				return this.makeResult<IndianAPIFIIDII>({
					date: raw.date ?? new Date().toISOString().split("T")[0],
					fii: { buy: Number(raw.fii?.buy ?? raw.FII?.buy ?? 0), sell: Number(raw.fii?.sell ?? raw.FII?.sell ?? 0), net: Number(raw.fii?.net ?? raw.FII?.net ?? 0) },
					dii: { buy: Number(raw.dii?.buy ?? raw.DII?.buy ?? 0), sell: Number(raw.dii?.sell ?? raw.DII?.sell ?? 0), net: Number(raw.dii?.net ?? raw.DII?.net ?? 0) },
				});
			} catch (error: any) {
				logger.error(`[IndianAPI] getLatestFIIDII() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FII_DII);
	}

	async getFIIDIIHistory(days = 30): Promise<IndianAPIResult<IndianAPIFIIDII[]>> {
		const key = requestDedupeService.createKey("indian_api", "fiidii_history", `${days}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.mrClient.get("/api/history", { params: { limit: days } });
				const rawList: any[] = r.data ?? [];
				return this.makeResult<IndianAPIFIIDII[]>(rawList.map((raw: any) => ({
					date: raw.date ?? "",
					fii: { buy: Number(raw.fii?.buy ?? raw.FII?.buy ?? 0), sell: Number(raw.fii?.sell ?? raw.FII?.sell ?? 0), net: Number(raw.fii?.net ?? raw.FII?.net ?? 0) },
					dii: { buy: Number(raw.dii?.buy ?? raw.DII?.buy ?? 0), sell: Number(raw.dii?.sell ?? raw.DII?.sell ?? 0), net: Number(raw.dii?.net ?? raw.DII?.net ?? 0) },
				})));
			} catch (error: any) {
				logger.error(`[IndianAPI] getFIIDIIHistory(${days}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL.FII_DII_HISTORY);
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// Health & enrichment helpers
	// ═══════════════════════════════════════════════════════════════════════════

	async healthCheck(): Promise<{ status: "healthy" | "unhealthy" | "unconfigured"; message: string; responseTime?: number; rateLimitRemaining?: number }> {
		if (!this.isConfigured) return { status: "unconfigured", message: "INDIAN_API_KEY not configured" };
		const startTime = Date.now();
		try {
			await this.client.get("/ping");
			return {
				status: "healthy",
				message: "IndianAPI.in Growth Plan is accessible",
				responseTime: Date.now() - startTime,
				rateLimitRemaining: this.getRateLimitRemaining(),
			};
		} catch (error: any) {
			return { status: "unhealthy", message: error.message, responseTime: Date.now() - startTime };
		}
	}

	convertToEnrichedFormat(
		ratios: IndianAPIRatios,
		plLatest: IndianAPIProfitLoss | null,
		bsLatest: IndianAPIBalanceSheet | null,
	) {
		const mk = (value: number | undefined) =>
			value !== undefined
				? { value, source: "indian_api" as const, retrievedAt: new Date(), confidenceScore: 0.88 }
				: undefined;

		return {
			peRatio: mk(ratios.pe_ratio),
			pbRatio: mk(ratios.pb_ratio),
			roe: mk(ratios.roe),
			roa: mk(ratios.roa),
			roce: mk(ratios.roce),
			debtEquity: mk(ratios.debt_equity),
			currentRatio: mk(ratios.current_ratio),
			dividendYield: mk(ratios.dividend_yield),
			revenue: plLatest ? mk(plLatest.revenue) : undefined,
			pat: plLatest ? mk(plLatest.pat) : undefined,
			ebitda: plLatest ? mk(plLatest.ebitda) : undefined,
			eps: plLatest ? mk(plLatest.eps) : undefined,
			totalAssets: bsLatest ? mk(bsLatest.total_assets) : undefined,
			totalDebt: bsLatest ? mk(bsLatest.total_debt) : undefined,
			networth: bsLatest ? mk(bsLatest.networth) : undefined,
		};
	}
}

export const indianApiService = new IndianAPIService();
