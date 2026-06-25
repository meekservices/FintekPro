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

const INDIAN_API_KEY = process.env.INDIAN_API_KEY || "";
const INDIAN_API_BASE_URL = "https://analyst.indianapi.in";
const MRCHARTIST_BASE_URL = "https://api.mrchartist.in";

// Rate limiting
const RATE_LIMIT_PER_MINUTE = 100;
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;

// Cache TTLs (ms)
const TTL_QUOTE = 5 * 60 * 1_000;              // 5 min
const TTL_FUNDAMENTALS = 24 * 60 * 60 * 1_000; // 24 h
const TTL_RATIOS = 60 * 60 * 1_000;            // 1 h
const TTL_IPO = 30 * 60 * 1_000;               // 30 min
const TTL_FII_DII = 15 * 60 * 1_000;           // 15 min
const TTL_FII_DII_HISTORY = 6 * 60 * 60 * 1_000; // 6 h

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
			headers: {
				"X-API-Key": INDIAN_API_KEY,
				"Content-Type": "application/json",
				Accept: "application/json",
			},
			timeout: 15_000,
		});

		this.mrClient = axios.create({
			baseURL: MRCHARTIST_BASE_URL,
			timeout: 10_000,
		});

		if (!this.isConfigured) {
			// eslint-disable-next-line no-console
	console.warn("⚠️ INDIAN_API_KEY not configured. IndianAPI service disabled.");
		} else {
			// eslint-disable-next-line no-console
	console.info("✅ IndianAPI.in service initialized (enrichment priority: 0.88)");
		}
	}

	isReady(): boolean {
		return this.isConfigured;
	}

	getStatus() {
		return {
			configured: this.isConfigured,
			baseUrl: INDIAN_API_BASE_URL,
			rateLimitRemaining: this.getRateLimitRemaining(),
			source: "indian_api",
		};
	}

	// ── Rate limiting ────────────────────────────────────────────────────────

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
			// eslint-disable-next-line no-console
	console.info(`[IndianAPI] Rate limit reached, waiting ${waitTime}ms`);
			await new Promise((r) => setTimeout(r, waitTime));
			this.requestCount = 0;
			this.windowStart = Date.now();
		}
		this.requestCount++;
	}

	private async retryWithBackoff<T>(
		fn: () => Promise<T>,
		retries = MAX_RETRIES,
	): Promise<T> {
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
					// eslint-disable-next-line no-console
	console.warn(
						`[IndianAPI] HTTP ${status}, retrying in ${delay}ms (attempt ${attempt + 1}/${retries + 1})`,
					);
					await new Promise((r) => setTimeout(r, delay));
				} else {
					throw error;
				}
			}
		}
		throw lastError ?? new Error("[IndianAPI] Max retries exceeded");
	}

	// ── Result builders ──────────────────────────────────────────────────────

	private makeResult<T>(data: T): IndianAPIResult<T> {
		return {
			success: true,
			data,
			source: "indian_api",
			retrievedAt: new Date(),
			rateLimitRemaining: this.getRateLimitRemaining(),
			engine_version: "1.0.0",
			calculation_timestamp: new Date().toISOString(),
		};
	}

	private makeError<T>(msg: string): IndianAPIResult<T> {
		return {
			success: false,
			source: "indian_api",
			retrievedAt: new Date(),
			error: msg,
			engine_version: "1.0.0",
			calculation_timestamp: new Date().toISOString(),
		};
	}

	private notConfigured<T>(): IndianAPIResult<T> {
		return this.makeError<T>("IndianAPI not configured — INDIAN_API_KEY missing");
	}

	// ── Public Methods ───────────────────────────────────────────────────────

	/**
	 * Get live stock quote for NSE/BSE symbol.
	 * @param symbol NSE/BSE ticker e.g. "RELIANCE", "TCS"
	 * @param exchange "NSE" (default) or "BSE"
	 */
	async getStockQuote(
		symbol: string,
		exchange: "NSE" | "BSE" = "NSE",
	): Promise<IndianAPIResult<IndianAPIStockQuote>> {
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
					current_price: Number(raw.currentPrice ?? raw.lastPrice ?? 0),
					previous_close: Number(raw.previousClose ?? 0),
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
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getStockQuote(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_QUOTE);
	}

	/**
	 * Get company profile (name, sector, ISIN, market cap etc.)
	 */
	async getCompanyProfile(
		symbol: string,
	): Promise<IndianAPIResult<IndianAPICompanyProfile>> {
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
					description: raw.about,
					management: raw.management ?? [],
				});
			} catch (error: any) {
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getCompanyProfile(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_FUNDAMENTALS);
	}

	/**
	 * Get Profit & Loss statement (annual, last N years).
	 */
	async getProfitLoss(
		symbol: string,
		years = 5,
	): Promise<IndianAPIResult<IndianAPIProfitLoss[]>> {
		if (!this.isConfigured) return this.notConfigured();

		const key = requestDedupeService.createKey("indian_api", "pl", `${symbol}:${years}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock_financials", { params: { name: symbol.toUpperCase() } }),
				);
				const rawList: any[] = (r.data?.profit_loss ?? r.data?.incomeStatement ?? []).slice(0, years);
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
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getProfitLoss(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_FUNDAMENTALS);
	}

	/**
	 * Get Balance Sheet (annual, last N years).
	 */
	async getBalanceSheet(
		symbol: string,
		years = 5,
	): Promise<IndianAPIResult<IndianAPIBalanceSheet[]>> {
		if (!this.isConfigured) return this.notConfigured();

		const key = requestDedupeService.createKey("indian_api", "bs", `${symbol}:${years}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock_financials", { params: { name: symbol.toUpperCase() } }),
				);
				const rawList: any[] = (r.data?.balance_sheet ?? r.data?.balanceSheet ?? []).slice(0, years);
				return this.makeResult<IndianAPIBalanceSheet[]>(rawList.map((row: any) => ({
					year: row.year ?? row.period ?? "",
					total_assets: Number(row.totalAssets ?? 0),
					total_liabilities: Number(row.totalLiabilities ?? 0),
					networth: Number(row.networth ?? row.shareholdersEquity ?? 0),
					total_debt: Number(row.totalDebt ?? row.borrowings ?? 0),
					current_assets: row.currentAssets ? Number(row.currentAssets) : undefined,
					current_liabilities: row.currentLiabilities ? Number(row.currentLiabilities) : undefined,
					fixed_assets: row.fixedAssets ? Number(row.fixedAssets) : undefined,
					investments: row.investments ? Number(row.investments) : undefined,
					cash_and_bank: row.cashAndBank ? Number(row.cashAndBank) : undefined,
				})));
			} catch (error: any) {
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getBalanceSheet(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_FUNDAMENTALS);
	}

	/**
	 * Get Cash Flow statement (annual, last N years).
	 */
	async getCashFlow(
		symbol: string,
		years = 5,
	): Promise<IndianAPIResult<IndianAPICashFlow[]>> {
		if (!this.isConfigured) return this.notConfigured();

		const key = requestDedupeService.createKey("indian_api", "cf", `${symbol}:${years}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() =>
					this.client.get("/stock_financials", { params: { name: symbol.toUpperCase() } }),
				);
				const rawList: any[] = (r.data?.cash_flow ?? r.data?.cashFlow ?? []).slice(0, years);
				return this.makeResult<IndianAPICashFlow[]>(rawList.map((row: any) => ({
					year: row.year ?? row.period ?? "",
					operating_cash_flow: Number(row.operatingCashFlow ?? row.cfo ?? 0),
					investing_cash_flow: Number(row.investingCashFlow ?? row.cfi ?? 0),
					financing_cash_flow: Number(row.financingCashFlow ?? row.cff ?? 0),
					free_cash_flow: row.freeCashFlow ? Number(row.freeCashFlow) : undefined,
					capex: row.capex ? Number(row.capex) : undefined,
				})));
			} catch (error: any) {
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getCashFlow(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_FUNDAMENTALS);
	}

	/**
	 * Get valuation and financial ratios.
	 * Primary use: screener scoring, Pick of the Day enrichment.
	 */
	async getRatios(
		symbol: string,
	): Promise<IndianAPIResult<IndianAPIRatios>> {
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
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getRatios(${symbol}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_RATIOS);
	}

	/**
	 * Search stocks by name or symbol across NSE + BSE.
	 */
	async searchStocks(
		query: string,
	): Promise<IndianAPIResult<Array<{ symbol: string; name: string; exchange: string }>>> {
		if (!this.isConfigured) return this.notConfigured();

		try {
			const r = await this.retryWithBackoff(() =>
				this.client.get("/search", { params: { q: query } }),
			);
			const results = (r.data?.results ?? r.data ?? []).map((item: any) => ({
				symbol: item.symbol ?? item.ticker ?? "",
				name: item.name ?? item.companyName ?? "",
				exchange: item.exchange ?? "NSE",
			}));
			return this.makeResult(results);
		} catch (error: any) {
			// eslint-disable-next-line no-console
	console.error(`[IndianAPI] searchStocks(${query}) error: ${error.message}`);
			return this.makeError(error.message);
		}
	}

	/**
	 * Get upcoming and recent IPOs.
	 */
	async getIPOList(): Promise<IndianAPIResult<IndianAPIIPO[]>> {
		if (!this.isConfigured) return this.notConfigured();

		const key = requestDedupeService.createKey("indian_api", "ipo", "list");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.retryWithBackoff(() => this.client.get("/ipo"));
				const rawList: any[] = r.data?.data ?? r.data ?? [];
				return this.makeResult<IndianAPIIPO[]>(rawList.map((item: any) => ({
					company_name: item.companyName ?? item.name ?? "",
					symbol: item.symbol,
					open_date: item.openDate ?? item.open ?? "",
					close_date: item.closeDate ?? item.close ?? "",
					listing_date: item.listingDate,
					issue_price: item.issuePrice ? Number(item.issuePrice) : undefined,
					lot_size: item.lotSize ? Number(item.lotSize) : undefined,
					issue_size: item.issueSize ? Number(item.issueSize) : undefined,
					subscription: item.subscription ? {
						qib: item.subscription.qib ? Number(item.subscription.qib) : undefined,
						nii: item.subscription.nii ? Number(item.subscription.nii) : undefined,
						retail: item.subscription.retail ? Number(item.subscription.retail) : undefined,
						total: item.subscription.total ? Number(item.subscription.total) : undefined,
					} : undefined,
					status: item.status ?? "upcoming",
					gmp: item.gmp ? Number(item.gmp) : undefined,
				})));
			} catch (error: any) {
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getIPOList() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_IPO);
	}

	/**
	 * Get latest FII/DII activity (Mr. Chartist free API — no key required).
	 */
	async getLatestFIIDII(): Promise<IndianAPIResult<IndianAPIFIIDII>> {
		const key = requestDedupeService.createKey("indian_api", "fiidii", "latest");
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.mrClient.get("/api/data");
				const raw = r.data;
				return this.makeResult<IndianAPIFIIDII>({
					date: raw.date ?? new Date().toISOString().split("T")[0],
					fii: {
						buy: Number(raw.fii?.buy ?? raw.FII?.buy ?? 0),
						sell: Number(raw.fii?.sell ?? raw.FII?.sell ?? 0),
						net: Number(raw.fii?.net ?? raw.FII?.net ?? 0),
					},
					dii: {
						buy: Number(raw.dii?.buy ?? raw.DII?.buy ?? 0),
						sell: Number(raw.dii?.sell ?? raw.DII?.sell ?? 0),
						net: Number(raw.dii?.net ?? raw.DII?.net ?? 0),
					},
				});
			} catch (error: any) {
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getLatestFIIDII() error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_FII_DII);
	}

	/**
	 * Get FII/DII historical data (last N days).
	 */
	async getFIIDIIHistory(days = 30): Promise<IndianAPIResult<IndianAPIFIIDII[]>> {
		const key = requestDedupeService.createKey("indian_api", "fiidii_history", `${days}`);
		return requestDedupeService.dedupe(key, async () => {
			try {
				const r = await this.mrClient.get("/api/history", { params: { limit: days } });
				const rawList: any[] = r.data ?? [];
				return this.makeResult<IndianAPIFIIDII[]>(rawList.map((raw: any) => ({
					date: raw.date ?? "",
					fii: {
						buy: Number(raw.fii?.buy ?? raw.FII?.buy ?? 0),
						sell: Number(raw.fii?.sell ?? raw.FII?.sell ?? 0),
						net: Number(raw.fii?.net ?? raw.FII?.net ?? 0),
					},
					dii: {
						buy: Number(raw.dii?.buy ?? raw.DII?.buy ?? 0),
						sell: Number(raw.dii?.sell ?? raw.DII?.sell ?? 0),
						net: Number(raw.dii?.net ?? raw.DII?.net ?? 0),
					},
				})));
			} catch (error: any) {
				// eslint-disable-next-line no-console
	console.error(`[IndianAPI] getFIIDIIHistory(${days}) error: ${error.message}`);
				return this.makeError(error.message);
			}
		}, TTL_FII_DII_HISTORY);
	}

	/**
	 * Health check — tests connectivity and returns response time.
	 */
	async healthCheck(): Promise<{
		status: "healthy" | "unhealthy" | "unconfigured";
		message: string;
		responseTime?: number;
		rateLimitRemaining?: number;
	}> {
		if (!this.isConfigured) {
			return { status: "unconfigured", message: "INDIAN_API_KEY not configured" };
		}
		const startTime = Date.now();
		try {
			await this.client.get("/stock", { params: { name: "RELIANCE" } });
			return {
				status: "healthy",
				message: "IndianAPI.in is accessible",
				responseTime: Date.now() - startTime,
				rateLimitRemaining: this.getRateLimitRemaining(),
			};
		} catch (error: any) {
			return {
				status: "unhealthy",
				message: error.message,
				responseTime: Date.now() - startTime,
			};
		}
	}

	/**
	 * Convert to FintekPro enrichment format.
	 * Drop-in compatible with data-enrichment-service MetricValue shape.
	 */
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
