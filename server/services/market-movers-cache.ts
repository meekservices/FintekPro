import yahooFinance from "yahoo-finance2";
import { pool } from "../db";
import { callPython } from "../clients/python-client";
import { distributedCache } from "../utils/distributed-cache";
import { upstoxMarketDataService } from "./upstox-market-data-service";

interface Stock {
	symbol: string;
	name: string;
	price: number;
	change: number;
	changePercent: number;
	previousClose: number;
}

interface MarketMoversData {
	gainers: Stock[];
	losers: Stock[];
}

interface CacheEntry {
	data: MarketMoversData;
	timestamp: number;
	isRefreshing: boolean;
}

interface ProviderMetrics {
	successCount: number;
	failureCount: number;
	lastSuccess: number;
	lastFailure: number;
	lastLatency: number;
	rateLimitErrors: number;
}

interface CacheMetrics {
	hits: number;
	misses: number;
	refreshes: number;
	errors: number;
	rateLimitErrors: number;
	lastRefreshTime: number;
	lastRefreshDuration: number;
	yahooLatency: number;
	backoffUntil: number;
	providers: {
		upstox: ProviderMetrics;
		yahoo: ProviderMetrics;
		finnhub: ProviderMetrics;
		nse: ProviderMetrics;
		bse: ProviderMetrics;
		python: ProviderMetrics;
	};
	lastSuccessfulProvider: string | null;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const STALE_TTL_MS = 60 * 60 * 1000;
const CRUMB_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const INITIAL_BACKOFF_MS = 5 * 60 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BACKOFF_MULTIPLIER = 2;

const INDIAN_STOCKS = [
	{ symbol: "RELIANCE.NS", name: "Reliance Industries" },
	{ symbol: "TCS.NS", name: "Tata Consultancy Services" },
	{ symbol: "HDFCBANK.NS", name: "HDFC Bank Limited" },
	{ symbol: "INFY.NS", name: "Infosys Limited" },
	{ symbol: "ICICIBANK.NS", name: "ICICI Bank Limited" },
	{ symbol: "BAJFINANCE.NS", name: "Bajaj Finance Limited" },
	{ symbol: "MARUTI.NS", name: "Maruti Suzuki India" },
	{ symbol: "ASIANPAINT.NS", name: "Asian Paints Limited" },
	{ symbol: "NESTLEIND.NS", name: "Nestle India Limited" },
	{ symbol: "ULTRACEMCO.NS", name: "UltraTech Cement" },
	{ symbol: "HINDUNILVR.NS", name: "Hindustan Unilever" },
	{ symbol: "LT.NS", name: "Larsen & Toubro" },
	{ symbol: "WIPRO.NS", name: "Wipro Limited" },
	{ symbol: "BHARTIARTL.NS", name: "Bharti Airtel" },
	{ symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank" },
	{ symbol: "ITC.NS", name: "ITC Limited" },
	{ symbol: "SBIN.NS", name: "State Bank of India" },
	{ symbol: "AXISBANK.NS", name: "Axis Bank" },
	{ symbol: "TITAN.NS", name: "Titan Company" },
	{ symbol: "SUNPHARMA.NS", name: "Sun Pharma" },
	{ symbol: "TATAMOTORS.NS", name: "Tata Motors" },
	{ symbol: "TATASTEEL.NS", name: "Tata Steel" },
	{ symbol: "NTPC.NS", name: "NTPC Limited" },
	{ symbol: "ONGC.NS", name: "ONGC" },
	{ symbol: "POWERGRID.NS", name: "Power Grid Corporation" },
	{ symbol: "COALINDIA.NS", name: "Coal India" },
	{ symbol: "HCLTECH.NS", name: "HCL Technologies" },
	{ symbol: "ADANIENT.NS", name: "Adani Enterprises" },
	{ symbol: "JSWSTEEL.NS", name: "JSW Steel" },
	{ symbol: "HINDALCO.NS", name: "Hindalco Industries" },
	{ symbol: "CIPLA.NS", name: "Cipla Limited" },
	{ symbol: "DRREDDY.NS", name: "Dr. Reddy's Laboratories" },
	{ symbol: "TRENT.NS", name: "Trent Limited" },
	{ symbol: "BEL.NS", name: "Bharat Electronics" },
	{ symbol: "BAJAJFINSV.NS", name: "Bajaj Finserv" },
];

const FALLBACK_DATA: MarketMoversData = {
	gainers: [
		{
			symbol: "ITC",
			name: "ITC Limited",
			price: 266.0,
			change: 11.0,
			changePercent: 4.31,
			previousClose: 255.0,
		},
		{
			symbol: "TCS",
			name: "Tata Consultancy Services",
			price: 2156.0,
			change: 80.0,
			changePercent: 3.85,
			previousClose: 2076.0,
		},
		{
			symbol: "INFY",
			name: "Infosys Limited",
			price: 1023.4,
			change: 26.4,
			changePercent: 2.65,
			previousClose: 997.0,
		},
		{
			symbol: "WIPRO",
			name: "Wipro Limited",
			price: 162.57,
			change: 4.19,
			changePercent: 2.65,
			previousClose: 158.38,
		},
		{
			symbol: "LT",
			name: "Larsen & Toubro",
			price: 3703.3,
			change: 78.2,
			changePercent: 2.16,
			previousClose: 3625.1,
		},
	],
	losers: [
		{
			symbol: "RELIANCE",
			name: "Reliance Industries",
			price: 1170.3,
			change: -7.7,
			changePercent: -0.65,
			previousClose: 1178.0,
		},
		{
			symbol: "JSWSTEEL",
			name: "JSW Steel Limited",
			price: 1168.0,
			change: -7.2,
			changePercent: -0.61,
			previousClose: 1175.2,
		},
		{
			symbol: "CIPLA",
			name: "Cipla Limited",
			price: 1301.0,
			change: -5.8,
			changePercent: -0.44,
			previousClose: 1306.8,
		},
		{
			symbol: "BAJFINANCE",
			name: "Bajaj Finance Limited",
			price: 6890.5,
			change: -28.5,
			changePercent: -0.41,
			previousClose: 6919.0,
		},
		{
			symbol: "MARUTI",
			name: "Maruti Suzuki India",
			price: 11420.0,
			change: -45.0,
			changePercent: -0.39,
			previousClose: 11465.0,
		},
	],
};

class FinnhubProvider {
	private apiKey: string | null = null;
	private isAvailable: boolean = false;
	private readonly baseUrl = "https://finnhub.io/api/v1";

	constructor() {
		const apiKey = process.env.FINNHUB_API_KEY;
		if (apiKey && apiKey.length > 0) {
			this.apiKey = apiKey;
			this.isAvailable = true;
   // eslint-disable-next-line no-console
			console.log(
				"✅ [FinnhubProvider] Initialized successfully (API key length:",
				apiKey.length + ")",
			);
		} else {
   // eslint-disable-next-line no-console
			console.log(
				"ℹ️ [FinnhubProvider] FINNHUB_API_KEY not set - Finnhub fallback disabled",
			);
			this.isAvailable = false;
		}
	}

	isEnabled(): boolean {
		return this.isAvailable;
	}

	async getQuote(
		symbol: string,
	): Promise<{
		price: number;
		change: number;
		changePercent: number;
		previousClose: number;
	} | null> {
		if (!this.isAvailable || !this.apiKey) {
			return null;
		}

		try {
			const url = `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`;
			const response = await fetch(url);

			if (!response.ok) {
				if (response.status === 429) {
					throw new Error("Finnhub rate limit exceeded");
				}
				return null;
			}

			const data = await response.json();

			if (!data || data.c === 0 || data.c === undefined) {
				return null;
			}

			return {
				price: data.c || 0,
				change: data.d || 0,
				changePercent: data.dp || 0,
				previousClose: data.pc || 0,
			};
		} catch (error) {
   // eslint-disable-next-line no-console
			console.warn(
				`⚠️ [FinnhubProvider] Quote fetch error for ${symbol}:`,
				error,
			);
			throw error;
		}
	}

	async fetchAllStocks(stocks: typeof INDIAN_STOCKS): Promise<Stock[]> {
		if (!this.isAvailable) {
			throw new Error("Finnhub provider not available");
		}

		const stockQuotes: Stock[] = [];

		for (const stock of stocks) {
			try {
				const nseSymbol = stock.symbol.replace(".NS", "");
				const quote = await this.getQuote(nseSymbol);
				if (quote && quote.price > 0) {
					stockQuotes.push({
						symbol: nseSymbol,
						name: stock.name,
						price: quote.price,
						change: quote.change,
						changePercent: quote.changePercent,
						previousClose: quote.previousClose,
					});
				}
				await new Promise((resolve) => setTimeout(resolve, 150));
			} catch (error) {
				const errorStr = String(error);
				if (errorStr.includes("rate limit") || errorStr.includes("429")) {
					throw error;
				}
    // eslint-disable-next-line no-console
				console.warn(
					`⚠️ [FinnhubProvider] Failed to fetch ${stock.symbol}:`,
					error,
				);
			}
		}

		if (stockQuotes.length === 0) {
			throw new Error("No stock data fetched from Finnhub");
		}

		return stockQuotes;
	}
}

/**
 * IndianAPIMarketProvider
 *
 * Replaces the old NseIndiaProvider cookie-based scraper (403-blocked from
 * Cloud Run IPs). All market-movers and corporate-report data now comes
 * from IndianAPI (paid subscription, 300 req/min on Growth plan).
 *
 * Exported as `nseIndiaProviderInstance` for backward compatibility with
 * stock-strategy.ts and data-enrichment-service.ts.
 */
class IndianAPIMarketProvider {
	private isAvailable: boolean = true;

	constructor() {
		// eslint-disable-next-line no-console
		console.log("✅ [IndianAPIMarketProvider] Initialized (IndianAPI primary source)");
	}

	isEnabled(): boolean {
		return this.isAvailable;
	}

	/**
	 * Fetch top market movers (gainers + trending) from IndianAPI.
	 * Replaces NseIndiaProvider.fetchMarketMovers() which was cookie-scraping
	 * nseindia.com/api/live-analysis-variations — 403 from Cloud Run.
	 */
	async fetchMarketMovers(): Promise<Stock[]> {
		try {
			const { indianApiService, cleanIndianTicker } = await import("./indian-api-service");
			const [activeRes, trendRes] = await Promise.allSettled([
				indianApiService.getMostActive("NSE"),
				indianApiService.getTrendingCategorized("NSE"),
			]);

			const combined: any[] = [];

			// 1. Add categorized gainers and losers from trending
			if (trendRes.status === "fulfilled" && trendRes.value.success && trendRes.value.data) {
				const { gainers, losers } = trendRes.value.data;
				combined.push(...(gainers ?? []), ...(losers ?? []));
			}

			// 2. Add heavyweight active stocks
			if (activeRes.status === "fulfilled" && activeRes.value.success && activeRes.value.data) {
				combined.push(...activeRes.value.data);
			}

			// De-duplicate by cleaned ticker
			const seen = new Set<string>();
			const stockQuotes: Stock[] = [];
			for (const item of combined) {
				const rawTicker = item.ticker || item.symbol || item.ric || "";
				const symbol = cleanIndianTicker(rawTicker);
				if (!symbol || seen.has(symbol)) continue;
				seen.add(symbol);

				const price = Number(item.price ?? 0);
				const changePct = Number(item.percent_change ?? 0);
				const change = Number(
					item.net_change ?? (price * changePct) / (100 + (changePct || 1)),
				);
				const previousClose = price - change;

				stockQuotes.push({
					symbol,
					name: item.company || symbol,
					price: Math.round(price * 100) / 100,
					change: Math.round(change * 100) / 100,
					changePercent: Math.round(changePct * 100) / 100,
					previousClose: Math.round(previousClose * 100) / 100,
				});
			}

			if (stockQuotes.length === 0) throw new Error("No stock data from IndianAPI");
			return stockQuotes;
		} catch (error) {
			// eslint-disable-next-line no-console
			console.warn("⚠️ [IndianAPIMarketProvider] fetchMarketMovers error:", error);
			throw error;
		}
	}

	/**
	 * Fetch corporate reports from IndianAPI.
	 * Replaces NseIndiaProvider.fetchCorporateReports() which scraped
	 * nseindia.com/api/corporates/* — 403 from Cloud Run.
	 *
	 * Returns the same shape consumed by stock-strategy.ts and
	 * data-enrichment-service.ts for backward compatibility.
	 */
	async fetchCorporateReports(symbol: string): Promise<{
		quarterlyResults: any[];
		announcements: any[];
		boardMeetings: any[];
		corporateActions: any[];
		source: "nse";
		success: boolean;
		error?: string;
	}> {
		const result = {
			quarterlyResults: [] as any[],
			announcements: [] as any[],
			boardMeetings: [] as any[],
			corporateActions: [] as any[],
			source: "nse" as const,
			success: false,
			error: undefined as string | undefined,
		};

		try {
			const { indianApiService } = await import("./indian-api-service");
			const sym = symbol.toUpperCase().trim();

			// Fetch corporate actions (dividends, splits, board meetings) and
			// announcements + P&L in parallel
			const [corpActRes, announcementsRes, plRes] = await Promise.allSettled([
				indianApiService.getCorporateActions(sym),
				indianApiService.getRecentAnnouncements(sym),
				indianApiService.getProfitLoss(sym, 5),
			]);

			// Map quarterly results from P&L
			if (plRes.status === "fulfilled" && plRes.value.success) {
				result.quarterlyResults = (plRes.value.data ?? []).slice(0, 20).map((r: any) => ({
					period: r.year,
					periodEnd: r.year,
					revenue: r.revenue ?? r.net_sales ?? null,
					netProfit: r.net_profit ?? r.profit_after_tax ?? null,
					eps: r.eps ?? null,
					broadcastDate: null,
					consolidated: false,
				}));
			}

			// Map announcements
			if (announcementsRes.status === "fulfilled" && announcementsRes.value.success) {
				result.announcements = (announcementsRes.value.data ?? []).slice(0, 50).map((a: any) => ({
					subject: a.subject ?? a.title ?? a.headline,
					broadcastDate: a.date ?? a.announced_date,
					category: a.category ?? "announcement",
					attachmentLink: a.attachment_url ?? null,
				}));
			}

			// Map board meetings + corporate actions from getCorporateActions
			if (corpActRes.status === "fulfilled" && corpActRes.value.success) {
				const ca = corpActRes.value.data;
				result.boardMeetings = (ca?.board_meetings ?? []).slice(0, 20).map((m: any) => ({
					meetingDate: m.meeting_date ?? m.date,
					purpose: m.purpose ?? m.agenda,
					broadcastDate: m.announced_date ?? null,
				}));
				const dividends = (ca?.dividends ?? []).map((d: any) => ({
					actionType: "Dividend",
					exDate: d.ex_date,
					recordDate: d.record_date,
					purpose: d.details ?? `Dividend ${d.dividend_percent ?? ""}`,
				}));
				const splits = (ca?.splits ?? []).map((s: any) => ({
					actionType: "Split",
					exDate: s.ex_date ?? s.date,
					recordDate: s.record_date,
					purpose: s.purpose ?? `Split ${s.ratio ?? ""}`,
				}));
				const bonus = (ca?.bonus ?? []).map((b: any) => ({
					actionType: "Bonus",
					exDate: b.ex_date ?? b.date,
					recordDate: b.record_date,
					purpose: b.purpose ?? `Bonus ${b.ratio ?? ""}`,
				}));
				result.corporateActions = [...dividends, ...splits, ...bonus].slice(0, 20);
			}

			const totalItems =
				result.quarterlyResults.length +
				result.announcements.length +
				result.boardMeetings.length +
				result.corporateActions.length;
			result.success = totalItems > 0;

			// eslint-disable-next-line no-console
			console.log(`[IndianAPIMarketProvider] Corporate reports for ${sym}: ${totalItems} total items`);
			return result;
		} catch (error: any) {
			result.error = error.message;
			// eslint-disable-next-line no-console
			console.warn(`⚠️ [IndianAPIMarketProvider] Corporate reports error: ${error.message}`);
			return result;
		}
	}

	private parseNumber(value: any): number | null {
		if (value === null || value === undefined || value === "" || value === "-")
			return null;
		if (typeof value === "number") return value;
		const cleaned = String(value)
			.replace(/,/g, "")
			.replace(/[^\d.-]/g, "");
		const parsed = Number.parseFloat(cleaned);
		return Number.isNaN(parsed) ? null : parsed;
	}
}

// ─── Deprecated alias: NseIndiaProvider ──────────────────────────────────────
// Kept for import-site backward compatibility. All logic now in IndianAPIMarketProvider.
/** @deprecated Use IndianAPIMarketProvider. Will be removed in a future cleanup. */
type NseIndiaProvider = IndianAPIMarketProvider;

class BseIndiaProvider {
	private readonly baseUrl = "https://api.bseindia.com/BseIndiaAPI/api";
	private isAvailable: boolean = true;

	constructor() {
  // eslint-disable-next-line no-console
		console.log("✅ [BseIndiaProvider] Initialized (BSE India API fallback)");
	}

	isEnabled(): boolean {
		return this.isAvailable;
	}

	async fetchMarketMovers(): Promise<Stock[]> {
		try {
			const response = await fetch(
				`${this.baseUrl}/MktRGainerLoser/w?GLession=G&scripcode=`,
				{
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
						Accept: "application/json",
						"Accept-Language": "en-US,en;q=0.5",
						Referer: "https://www.bseindia.com/",
						Origin: "https://www.bseindia.com",
					},
				},
			);

			if (!response.ok) {
				if (response.status === 429) {
					throw new Error("BSE rate limit exceeded");
				}
				throw new Error(`BSE API error: ${response.status}`);
			}

			const contentType = response.headers.get("content-type") || "";
			if (!contentType.includes("json")) {
				throw new Error(
					`BSE returned non-JSON response (${contentType.split(";")[0] || "unknown"})`,
				);
			}

			const data = await response.json();
			const stockQuotes: Stock[] = [];

			if (data?.Table && Array.isArray(data.Table)) {
				for (const item of data.Table.slice(0, 15)) {
					const price =
						Number.parseFloat(item.LTP) || Number.parseFloat(item.ltp) || 0;
					const change =
						Number.parseFloat(item.Change) ||
						Number.parseFloat(item.change) ||
						0;
					const changePercent =
						Number.parseFloat(item.Chg) ||
						Number.parseFloat(item.chg) ||
						Number.parseFloat(item.PerChg) ||
						0;
					const previousClose =
						Number.parseFloat(item.PrevClose) || price - change || 0;

					if (price > 0) {
						stockQuotes.push({
							symbol: item.scripcode || item.Scripcode || item.SCRIP_CD || "",
							name:
								item.scrip_nm ||
								item.ScripName ||
								item.SCRIP_NAME ||
								item.scripcode ||
								"",
							price,
							change,
							changePercent,
							previousClose,
						});
					}
				}
			}

			if (stockQuotes.length === 0) {
				const sensexResponse = await fetch(
					`${this.baseUrl}/GetSensex30Stocks/w`,
					{
						headers: {
							"User-Agent":
								"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
							Accept: "application/json",
							Referer: "https://www.bseindia.com/",
							Origin: "https://www.bseindia.com",
						},
					},
				);

				const sensexCT = sensexResponse.headers.get("content-type") || "";
				if (sensexResponse.ok && sensexCT.includes("json")) {
					const sensexData = await sensexResponse.json();
					if (sensexData?.Table && Array.isArray(sensexData.Table)) {
						for (const item of sensexData.Table.slice(0, 15)) {
							const price =
								Number.parseFloat(item.CurrPrice) ||
								Number.parseFloat(item.LTP) ||
								0;
							const change =
								Number.parseFloat(item.Chg) ||
								Number.parseFloat(item.Change) ||
								0;
							const changePercent =
								Number.parseFloat(item.ChgPer) ||
								Number.parseFloat(item.PerChg) ||
								0;

							if (price > 0) {
								stockQuotes.push({
									symbol: item.Scripcode || item.scripcode || "",
									name: item.ScripName || item.scrip_nm || "",
									price,
									change,
									changePercent,
									previousClose: price - change,
								});
							}
						}
					}
				}
			}

			if (stockQuotes.length === 0) {
				throw new Error("No stock data from BSE API");
			}

   // eslint-disable-next-line no-console
			console.log(`✅ [BseIndiaProvider] Fetched ${stockQuotes.length} stocks`);
			return stockQuotes;
		} catch (error) {
   // eslint-disable-next-line no-console
			console.warn("⚠️ [BseIndiaProvider] Fetch error:", error);
			throw error;
		}
	}

	async getQuote(
		scripcode: string,
	): Promise<{
		price: number;
		change: number;
		changePercent: number;
		previousClose: number;
	} | null> {
		try {
			const response = await fetch(
				`${this.baseUrl}/StockReachGraph/w?scripcode=${scripcode}&flag=0&fromdate=&todate=&seression=`,
				{
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
						Accept: "application/json",
						Referer: "https://www.bseindia.com/",
						Origin: "https://www.bseindia.com",
					},
				},
			);

			if (!response.ok) {
				return null;
			}

			const data = await response.json();

			if (data?.CurrVal) {
				return {
					price: Number.parseFloat(data.CurrVal) || 0,
					change: Number.parseFloat(data.Chng) || 0,
					changePercent: Number.parseFloat(data.ChngPer) || 0,
					previousClose: Number.parseFloat(data.PrvClose) || 0,
				};
			}

			return null;
		} catch (error) {
   // eslint-disable-next-line no-console
			console.warn(
				`⚠️ [BseIndiaProvider] Quote fetch error for ${scripcode}:`,
				error,
			);
			return null;
		}
	}

	async fetchCorporateReports(
		symbol?: string,
		scripcode?: string,
	): Promise<{
		financialResults: any[];
		announcements: any[];
		corporateActions: any[];
		shareholdingPattern: any[];
		source: "bse";
		success: boolean;
		error?: string;
	}> {
		const result = {
			financialResults: [] as any[],
			announcements: [] as any[],
			corporateActions: [] as any[],
			shareholdingPattern: [] as any[],
			source: "bse" as const,
			success: false,
			error: undefined as string | undefined,
		};

		const headers = {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			Accept: "application/json",
			"Accept-Language": "en-US,en;q=0.5",
			Referer: "https://www.bseindia.com/",
			Origin: "https://www.bseindia.com",
		};

		let resolvedScripcode = scripcode;

		if (!resolvedScripcode && symbol) {
			const normalizedSymbol = symbol.toUpperCase().trim();
			try {
				const searchResponse = await fetch(
					`${this.baseUrl}/Suggest/w?flag=1&query=${encodeURIComponent(normalizedSymbol)}`,
					{ headers },
				);
				if (searchResponse.ok) {
					const searchResults = await searchResponse.json();
					if (Array.isArray(searchResults) && searchResults.length > 0) {
						let match = searchResults.find(
							(r: any) =>
								(r.trdSym || "").toUpperCase().trim() === normalizedSymbol,
						);
						if (!match) {
							match = searchResults.find((r: any) => {
								const scripName = (r.scrip_nm || "").toUpperCase().trim();
								return (
									scripName.startsWith(normalizedSymbol) ||
									scripName.includes(normalizedSymbol)
								);
							});
						}
						if (!match && searchResults.length === 1) match = searchResults[0];
						if (match) {
							resolvedScripcode = match.scrip_cd || match.scripcode;
       // eslint-disable-next-line no-console
							console.log(
								`[BseIndiaProvider] Symbol ${normalizedSymbol} resolved to scripcode ${resolvedScripcode}`,
							);
						}
					}
				}
			} catch (e) {
    // eslint-disable-next-line no-console
				console.warn(`[BseIndiaProvider] Symbol lookup failed`);
			}
		}

		if (!resolvedScripcode) {
			result.error = "Could not resolve scripcode";
			return result;
		}

		try {
			const today = new Date();
			const fromDate = new Date(today.getFullYear() - 2, 0, 1);
			const fromDateStr = `${String(fromDate.getDate()).padStart(2, "0")}/${String(fromDate.getMonth() + 1).padStart(2, "0")}/${fromDate.getFullYear()}`;
			const toDateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

			const [financialsRes, actionsRes] = await Promise.allSettled([
				fetch(
					`${this.baseUrl}/FinancialResults/w?scripcode=${resolvedScripcode}`,
					{ headers },
				),
				fetch(
					`${this.baseUrl}/CorporateActions/w?scripcode=${resolvedScripcode}&fromdt=${fromDateStr}&todt=${toDateStr}`,
					{ headers },
				),
			]);

			if (financialsRes.status === "fulfilled" && financialsRes.value.ok) {
				const data = await financialsRes.value.json();
				const items = data?.Table || [];
				result.financialResults = (Array.isArray(items) ? items : [])
					.slice(0, 20)
					.map((r: any) => ({
						quarterEnded: r.QuarterEnd || r.qtr_end,
						revenue: this.parseNumber(r.Revenue || r.Income),
						netProfit: this.parseNumber(r.NetProfit || r.PAT),
						eps: this.parseNumber(r.EPS),
						ebitda: this.parseNumber(r.EBITDA),
						broadcastDate: r.BroadcastDate || r.broadcast_dt,
						consolidated: r.Consolidated === "Y" || r.consolidated === true,
					}));
			}

			if (actionsRes.status === "fulfilled" && actionsRes.value.ok) {
				const data = await actionsRes.value.json();
				const items = data?.Table || [];
				result.corporateActions = (Array.isArray(items) ? items : [])
					.slice(0, 20)
					.map((c: any) => ({
						purpose: c.Purpose || c.purpose,
						exDate: c.ExDate || c.ex_date,
						recordDate: c.RecordDate || c.record_date,
						bcStartDate: c.BCStartDate,
						bcEndDate: c.BCEndDate,
					}));
			}

			const totalItems =
				result.financialResults.length +
				result.announcements.length +
				result.corporateActions.length;
			result.success = totalItems > 0;

   // eslint-disable-next-line no-console
			console.log(
				`[BseIndiaProvider] Corporate reports for scripcode ${resolvedScripcode}: ${totalItems} total items`,
			);
			return result;
		} catch (error: any) {
			result.error = error.message;
   // eslint-disable-next-line no-console
			console.warn(
				`⚠️ [BseIndiaProvider] Corporate reports error: ${error.message}`,
			);
			return result;
		}
	}

	private parseNumber(value: any): number | null {
		if (value === null || value === undefined || value === "" || value === "-")
			return null;
		if (typeof value === "number") return value;
		const cleaned = String(value)
			.replace(/,/g, "")
			.replace(/[^\d.-]/g, "");
		const parsed = Number.parseFloat(cleaned);
		return Number.isNaN(parsed) ? null : parsed;
	}
}

const nseIndiaProviderInstance = new IndianAPIMarketProvider();
const bseIndiaProviderInstance = new BseIndiaProvider();

export { nseIndiaProviderInstance, bseIndiaProviderInstance };


class MarketMoversCache {
	private cache: CacheEntry | null = null;
	private metrics: CacheMetrics = {
		hits: 0,
		misses: 0,
		refreshes: 0,
		errors: 0,
		rateLimitErrors: 0,
		lastRefreshTime: 0,
		lastRefreshDuration: 0,
		yahooLatency: 0,
		backoffUntil: 0,
		providers: {
			upstox: {
				successCount: 0,
				failureCount: 0,
				lastSuccess: 0,
				lastFailure: 0,
				lastLatency: 0,
				rateLimitErrors: 0,
			},
			yahoo: {
				successCount: 0,
				failureCount: 0,
				lastSuccess: 0,
				lastFailure: 0,
				lastLatency: 0,
				rateLimitErrors: 0,
			},
			finnhub: {
				successCount: 0,
				failureCount: 0,
				lastSuccess: 0,
				lastFailure: 0,
				lastLatency: 0,
				rateLimitErrors: 0,
			},
			nse: {
				successCount: 0,
				failureCount: 0,
				lastSuccess: 0,
				lastFailure: 0,
				lastLatency: 0,
				rateLimitErrors: 0,
			},
			bse: {
				successCount: 0,
				failureCount: 0,
				lastSuccess: 0,
				lastFailure: 0,
				lastLatency: 0,
				rateLimitErrors: 0,
			},
			python: {
				successCount: 0,
				failureCount: 0,
				lastSuccess: 0,
				lastFailure: 0,
				lastLatency: 0,
				rateLimitErrors: 0,
			},
		},
		lastSuccessfulProvider: null,
	};
	private refreshLock = false;
	private crumbInitialized = false;
	private crumbInitTime = 0;
	private isInitialized = false;
	private currentBackoff = INITIAL_BACKOFF_MS;
	private finnhubProvider: FinnhubProvider;
	private nseProvider: IndianAPIMarketProvider;
	private bseProvider: BseIndiaProvider;
	private yahooRateLimited = false;

	constructor() {
		this.finnhubProvider = new FinnhubProvider();
		// Use singleton instances instead of creating new ones
		this.nseProvider = nseIndiaProviderInstance;
		this.bseProvider = bseIndiaProviderInstance;
	}

	private async loadFromDatabase(): Promise<MarketMoversData | null> {
		try {
			const client = await pool.connect();
			try {
				const gainersResult = await client.query(`
          SELECT symbol, name, current_price as price, change, change_percent as "changePercent", previous_close as "previousClose"
          FROM stock_prices_cache 
          WHERE is_gainer = true AND fetched_at > NOW() - INTERVAL '30 minutes'
          ORDER BY gainer_rank ASC NULLS LAST, change_percent DESC
          LIMIT 5
        `);

				const losersResult = await client.query(`
          SELECT symbol, name, current_price as price, change, change_percent as "changePercent", previous_close as "previousClose"
          FROM stock_prices_cache 
          WHERE is_loser = true AND fetched_at > NOW() - INTERVAL '30 minutes'
          ORDER BY loser_rank ASC NULLS LAST, change_percent ASC
          LIMIT 5
        `);

				if (gainersResult.rows.length > 0 || losersResult.rows.length > 0) {
					const gainers = gainersResult.rows.map((row) => ({
						symbol: row.symbol,
						name: row.name,
						price: Number.parseFloat(row.price),
						change: Number.parseFloat(row.change || 0),
						changePercent: Number.parseFloat(row.changePercent || 0),
						previousClose: Number.parseFloat(row.previousClose || 0),
					}));

					const losers = losersResult.rows.map((row) => ({
						symbol: row.symbol,
						name: row.name,
						price: Number.parseFloat(row.price),
						change: Number.parseFloat(row.change || 0),
						changePercent: Number.parseFloat(row.changePercent || 0),
						previousClose: Number.parseFloat(row.previousClose || 0),
					}));

     // eslint-disable-next-line no-console
					console.log(
						`💾 [MarketMoversCache] Loaded from database: ${gainers.length} gainers, ${losers.length} losers`,
					);
					return { gainers, losers };
				}
				return null;
			} finally {
				client.release();
			}
		} catch (error) {
   // eslint-disable-next-line no-console
			console.warn("⚠️ [MarketMoversCache] Database load failed:", error);
			return null;
		}
	}

	private async saveToDatabase(stocks: Stock[], source: string): Promise<void> {
		if (stocks.length === 0) return;
		const isProduction =
			process.env.NODE_ENV === "production" ||
			process.env.REPL_DEPLOYMENT === "1";
		if (!isProduction) return;

		try {
			const client = await pool.connect();
			try {
				const gainers = stocks
					.filter((s) => s.changePercent > 0)
					.sort((a, b) => b.changePercent - a.changePercent);

				const losers = stocks
					.filter((s) => s.changePercent < 0)
					.sort((a, b) => a.changePercent - b.changePercent);

				for (let i = 0; i < stocks.length; i++) {
					const stock = stocks[i];
					const isGainer = stock.changePercent > 0;
					const isLoser = stock.changePercent < 0;
					const gainerRank = isGainer
						? gainers.findIndex((g) => g.symbol === stock.symbol) + 1
						: null;
					const loserRank = isLoser
						? losers.findIndex((l) => l.symbol === stock.symbol) + 1
						: null;

					const exchange =
						source === "bse" ? "BSE" : source === "finnhub" ? "FINNHUB" : "NSE";
					await client.query(
						`
            INSERT INTO stock_prices_cache 
              (symbol, name, exchange, current_price, previous_close, change, change_percent, 
               is_gainer, is_loser, gainer_rank, loser_rank, data_source, fetched_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
            ON CONFLICT (symbol) DO UPDATE SET
              name = EXCLUDED.name,
              exchange = EXCLUDED.exchange,
              current_price = EXCLUDED.current_price,
              previous_close = EXCLUDED.previous_close,
              change = EXCLUDED.change,
              change_percent = EXCLUDED.change_percent,
              is_gainer = EXCLUDED.is_gainer,
              is_loser = EXCLUDED.is_loser,
              gainer_rank = EXCLUDED.gainer_rank,
              loser_rank = EXCLUDED.loser_rank,
              data_source = EXCLUDED.data_source,
              fetched_at = NOW(),
              updated_at = NOW()
          `,
						[
							stock.symbol,
							stock.name,
							exchange,
							stock.price,
							stock.previousClose,
							stock.change,
							stock.changePercent,
							isGainer,
							isLoser,
							gainerRank,
							loserRank,
							source,
						],
					);
				}

    // eslint-disable-next-line no-console
				console.log(
					`💾 [MarketMoversCache] Saved ${stocks.length} stocks to database`,
				);
			} finally {
				client.release();
			}
		} catch (error) {
   // eslint-disable-next-line no-console
			console.warn("⚠️ [MarketMoversCache] Database save failed:", error);
		}
	}

	async initialize(): Promise<void> {
  // eslint-disable-next-line no-console
		console.log("📈 [MarketMoversCache] Starting background initialization...");
		this.initializeInBackground().catch((err) =>
   // eslint-disable-next-line no-console
			console.error(
				"❌ [MarketMoversCache] Background initialization failed:",
				err,
			),
		);
		this.startBackgroundRefresh();
  // eslint-disable-next-line no-console
		console.log(
			"✅ [MarketMoversCache] Background initialization started (non-blocking)",
		);
	}

	private async loadFromRedis(): Promise<MarketMoversData | null> {
		try {
			const cached = await distributedCache.getJson<MarketMoversData>("market:movers:v1");
			if (cached && cached.gainers?.length > 0) {
    // eslint-disable-next-line no-console
				console.log("⚡ [MarketMoversCache] Loaded from Redis (L2 cache)");
				return cached;
			}
		} catch (err) {
   // eslint-disable-next-line no-console
			console.warn("[MarketMoversCache] Redis L2 read failed, falling through to DB", err);
		}
		return null;
	}

	private async saveToRedis(data: MarketMoversData): Promise<void> {
		try {
			await distributedCache.setJson("market:movers:v1", data, Math.floor(CACHE_TTL_MS / 1000));
   // eslint-disable-next-line no-console
			console.log("💾 [MarketMoversCache] Saved to Redis (L2 cache)");
		} catch (err) {
   // eslint-disable-next-line no-console
			console.warn("[MarketMoversCache] Redis L2 write failed", err);
		}
	}

	private async initializeInBackground(): Promise<void> {
		// L2: Try Redis first — survives restarts, much faster than DB or API
		const redisData = await this.loadFromRedis();
		if (redisData) {
			this.cache = { data: redisData, timestamp: Date.now(), isRefreshing: false };
			this.metrics.lastSuccessfulProvider = "redis";
			this.isInitialized = true;
			// Background refresh to keep Redis warm without blocking boot
   // eslint-disable-next-line no-console
			setTimeout(() => this.refreshCache().catch(console.error), 5000);
			return;
		}

		// L3: Try database if Redis is cold
		const dbData = await this.loadFromDatabase();
		if (dbData && dbData.gainers.length > 0) {
			this.cache = {
				data: dbData,
				timestamp: Date.now(),
				isRefreshing: false,
			};
			this.metrics.lastSuccessfulProvider = "database";
			this.isInitialized = true;
   // eslint-disable-next-line no-console
			console.log(
				"✅ [MarketMoversCache] Initialized from database (L3 fast path)",
			);
			// Backfill Redis from DB data immediately
			await this.saveToRedis(dbData);
			// Then schedule a full API refresh
   // eslint-disable-next-line no-console
			setTimeout(() => this.refreshCache().catch(console.error), 5000);
			return;
		}

		// L4: Full API refresh if both Redis and DB are cold
		await this.refreshCache();
		this.isInitialized = true;
  // eslint-disable-next-line no-console
		console.log(
			"✅ [MarketMoversCache] Background initialization completed (API refresh)",
		);
	}

	private isRateLimited(): boolean {
		return Date.now() < this.metrics.backoffUntil;
	}

	private applyBackoff(): void {
		this.metrics.backoffUntil = Date.now() + this.currentBackoff;
  // eslint-disable-next-line no-console
		console.log(
			`⏸️ [MarketMoversCache] Rate limited, backing off for ${Math.round(this.currentBackoff / 1000)}s`,
		);
		this.currentBackoff = Math.min(
			this.currentBackoff * BACKOFF_MULTIPLIER,
			MAX_BACKOFF_MS,
		);
	}

	private resetBackoff(): void {
		this.currentBackoff = INITIAL_BACKOFF_MS;
		this.metrics.backoffUntil = 0;
	}

	private isRateLimitError(error: any): boolean {
		const errorString = String(error);
		return (
			errorString.includes("Too Many Requests") ||
			errorString.includes("429") ||
			errorString.includes("rate limit")
		);
	}

	private async initializeYahooCrumb(): Promise<void> {
		if (
			this.crumbInitialized &&
			Date.now() - this.crumbInitTime < CRUMB_TTL_MS
		) {
			return;
		}

		if (this.isRateLimited()) {
   // eslint-disable-next-line no-console
			console.log("⏸️ [MarketMoversCache] Skipping crumb init - rate limited");
			return;
		}

		try {
   // eslint-disable-next-line no-console
			console.log("🔐 [MarketMoversCache] Initializing Yahoo Finance crumb...");
			const startTime = Date.now();

			yahooFinance.suppressNotices(["yahooSurvey"]);

			await yahooFinance.quote("AAPL");

			this.crumbInitialized = true;
			this.crumbInitTime = Date.now();
			this.yahooRateLimited = false;
			this.resetBackoff();
   // eslint-disable-next-line no-console
			console.log(
				`✅ [MarketMoversCache] Yahoo crumb initialized in ${Date.now() - startTime}ms`,
			);
		} catch (error) {
			if (this.isRateLimitError(error)) {
				this.metrics.rateLimitErrors++;
				this.metrics.providers.yahoo.rateLimitErrors++;
				this.yahooRateLimited = true;
				this.applyBackoff();
			}
   // eslint-disable-next-line no-console
			console.warn(
				"⚠️ [MarketMoversCache] Failed to initialize Yahoo crumb:",
				error,
			);
		}
	}

	private startBackgroundRefresh(): void {
		setInterval(async () => {
			const hasFallback =
				this.finnhubProvider.isEnabled() ||
				this.nseProvider.isEnabled() ||
				this.bseProvider.isEnabled();
			if (this.isRateLimited() && !hasFallback) {
				const remainingMs = this.metrics.backoffUntil - Date.now();
    // eslint-disable-next-line no-console
				console.log(
					`⏸️ [MarketMoversCache] Skipping refresh - rate limited for ${Math.round(remainingMs / 1000)}s more`,
				);
				return;
			}

			const now = Date.now();
			const cacheAge = this.cache
				? now - this.cache.timestamp
				: Number.POSITIVE_INFINITY;

			if (cacheAge >= CACHE_TTL_MS && !this.refreshLock) {
    // eslint-disable-next-line no-console
				console.log("🔄 [MarketMoversCache] Background refresh triggered");
				await this.refreshCache();
			}
		}, REFRESH_INTERVAL_MS);
	}

	private async fetchFromYahoo(): Promise<Stock[]> {
		const startTime = Date.now();
		const stockQuotes: Stock[] = [];

		for (const stock of INDIAN_STOCKS) {
			try {
				const yahooStart = Date.now();
				const quote = await yahooFinance.quote(stock.symbol);
				this.metrics.yahooLatency = Date.now() - yahooStart;

				stockQuotes.push({
					symbol: stock.symbol.replace(".NS", ""),
					name: stock.name,
					price: quote.regularMarketPrice || 0,
					change: quote.regularMarketChange || 0,
					changePercent: quote.regularMarketChangePercent || 0,
					previousClose: quote.regularMarketPreviousClose || 0,
				});

				await new Promise((resolve) => setTimeout(resolve, 100));
			} catch (error) {
				if (this.isRateLimitError(error)) {
					this.metrics.providers.yahoo.rateLimitErrors++;
					this.yahooRateLimited = true;
					throw error;
				}
			}
		}

		if (stockQuotes.length === 0) {
			throw new Error("No stock data fetched from Yahoo");
		}

		this.metrics.providers.yahoo.lastLatency = Date.now() - startTime;
		this.metrics.providers.yahoo.successCount++;
		this.metrics.providers.yahoo.lastSuccess = Date.now();
		this.yahooRateLimited = false;

		return stockQuotes;
	}

	private async fetchFromFinnhub(): Promise<Stock[]> {
		if (!this.finnhubProvider.isEnabled()) {
			throw new Error("Finnhub provider not available");
		}

		const startTime = Date.now();
		const stockQuotes =
			await this.finnhubProvider.fetchAllStocks(INDIAN_STOCKS);

		this.metrics.providers.finnhub.lastLatency = Date.now() - startTime;
		this.metrics.providers.finnhub.successCount++;
		this.metrics.providers.finnhub.lastSuccess = Date.now();

		return stockQuotes;
	}

	private async fetchFromNse(): Promise<Stock[]> {
		if (!this.nseProvider.isEnabled()) {
			throw new Error("NSE provider not available");
		}

		const startTime = Date.now();
		const stockQuotes = await this.nseProvider.fetchMarketMovers();

		this.metrics.providers.nse.lastLatency = Date.now() - startTime;
		this.metrics.providers.nse.successCount++;
		this.metrics.providers.nse.lastSuccess = Date.now();

		return stockQuotes;
	}

	private async fetchFromBse(): Promise<Stock[]> {
		if (!this.bseProvider.isEnabled()) {
			throw new Error("BSE provider not available");
		}

		const startTime = Date.now();
		const stockQuotes = await this.bseProvider.fetchMarketMovers();

		this.metrics.providers.bse.lastLatency = Date.now() - startTime;
		this.metrics.providers.bse.successCount++;
		this.metrics.providers.bse.lastSuccess = Date.now();

		return stockQuotes;
	}

	private async fetchFromPython(): Promise<Stock[]> {
		const startTime = Date.now();

		const resp = await callPython<{
			gainers: Stock[];
			losers: Stock[];
			total: number;
			source: string;
		}>("/market/movers/indian", "GET");

		if (!resp || (!resp.gainers?.length && !resp.losers?.length)) {
			throw new Error("Python sidecar returned empty market movers");
		}

		const all = [...(resp.gainers || []), ...(resp.losers || [])];
		if (all.length === 0) throw new Error("No stocks from Python provider");

		this.metrics.providers.python.lastLatency = Date.now() - startTime;
		this.metrics.providers.python.successCount++;
		this.metrics.providers.python.lastSuccess = Date.now();

		return all;
	}

	private async fetchFromUpstox(): Promise<Stock[]> {
		if (!upstoxMarketDataService.isReady()) {
			throw new Error("Upstox service not configured or active");
		}
		const startTime = Date.now();
		const symbols = [
			"RELIANCE",
			"TCS",
			"HDFCBANK",
			"INFY",
			"ICICIBANK",
			"SBIN",
			"BHARTIARTL",
			"ITC",
			"KOTAKBANK",
			"LT",
			"AXISBANK",
			"HINDUNILVR",
			"BAJFINANCE",
			"MARUTI",
			"TATAMOTORS",
			"TATASTEEL",
			"ASIANPAINT",
			"TITAN",
			"SUNPHARMA",
			"WIPRO",
			"NTPC",
			"ONGC",
			"POWERGRID",
			"COALINDIA",
			"HCLTECH",
			"NESTLEIND",
			"ULTRACEMCO",
			"ADANIENT",
			"JSWSTEEL",
			"HINDALCO",
			"CIPLA",
			"DRREDDY",
			"TRENT",
			"BEL",
			"BAJAJFINSV",
		];
		const res = await upstoxMarketDataService.getBatchQuotes(symbols, "NSE");
		if (!res.success || !res.data || res.data.size === 0) {
			throw new Error(res.error?.message || "No quote data returned from Upstox");
		}

		const stockQuotes: Stock[] = [];
		const seenSymbols = new Set<string>();

		for (const [sym, q] of res.data.entries()) {
			if (sym.startsWith("INE") || sym.includes("|")) continue;
			const cleanSymbol = sym
				.replace(/^NSE_EQ:/, "")
				.replace(/^NSE_EQ\|/, "")
				.replace(/\.NS$/, "");

			if (seenSymbols.has(cleanSymbol)) continue;
			seenSymbols.add(cleanSymbol);

			const stockMeta = INDIAN_STOCKS.find(
				(s) => s.symbol.replace(/\.NS$/, "") === cleanSymbol,
			);
			const name = stockMeta?.name || cleanSymbol;
			const price = q.last_price || 0;
			const prevClose = q.previous_close || (price - (q.change || 0));
			const change =
				q.change !== undefined && q.change !== null
					? q.change
					: prevClose > 0
						? price - prevClose
						: 0;
			const changePercent =
				q.change_percent !== undefined && q.change_percent !== null
					? q.change_percent
					: prevClose > 0
						? (change / prevClose) * 100
						: 0;

			if (price > 0) {
				stockQuotes.push({
					symbol: cleanSymbol,
					name,
					price,
					change,
					changePercent,
					previousClose: prevClose,
				});
			}
		}

		if (stockQuotes.length < 5) {
			throw new Error(
				`Insufficient stocks returned by Upstox (${stockQuotes.length})`,
			);
		}

		this.metrics.providers.upstox.lastLatency = Date.now() - startTime;
		this.metrics.providers.upstox.successCount++;
		this.metrics.providers.upstox.lastSuccess = Date.now();

		return stockQuotes;
	}

	private async refreshCache(): Promise<void> {
		if (this.refreshLock) {
			// eslint-disable-next-line no-console
			console.log(
				"⏳ [MarketMoversCache] Refresh already in progress, skipping",
			);
			return;
		}

		this.refreshLock = true;
		const startTime = Date.now();

		try {
			// eslint-disable-next-line no-console
			console.log("📊 [MarketMoversCache] Fetching fresh market data...");

			let stockQuotes: Stock[] = [];
			let successProvider: string | null = null;

			// Priority 1: Upstox Developer API v2 (SEBI-registered broker licensed NSE/BSE feed)
			if (stockQuotes.length === 0 && upstoxMarketDataService.isReady()) {
				try {
					// eslint-disable-next-line no-console
					console.log(
						"🔄 [MarketMoversCache] Trying Upstox API v2 (Tier-1 licensed feed)...",
					);
					stockQuotes = await this.fetchFromUpstox();
					successProvider = "upstox";
					// eslint-disable-next-line no-console
					console.log(
						`✅ [MarketMoversCache] Upstox succeeded with ${stockQuotes.length} stocks`,
					);
				} catch (upstoxError: any) {
					// eslint-disable-next-line no-console
					console.warn(
						"⚠️ [MarketMoversCache] Upstox API failed:",
						upstoxError?.message || upstoxError,
					);
					this.metrics.providers.upstox.failureCount++;
					this.metrics.providers.upstox.lastFailure = Date.now();
				}
			}

			// Priority 2: NSE India (direct exchange)
			if (stockQuotes.length === 0 && this.nseProvider.isEnabled()) {
				try {
					// eslint-disable-next-line no-console
					console.log("🔄 [MarketMoversCache] Trying NSE India fallback...");
					stockQuotes = await this.fetchFromNse();
					successProvider = "nse";
					// eslint-disable-next-line no-console
					console.log(
						`✅ [MarketMoversCache] NSE India succeeded with ${stockQuotes.length} stocks`,
					);
				} catch (nseError) {
					// eslint-disable-next-line no-console
					console.warn("⚠️ [MarketMoversCache] NSE India failed:", nseError);
					this.metrics.providers.nse.failureCount++;
					this.metrics.providers.nse.lastFailure = Date.now();
				}
			}

			// Priority 2: BSE India (secondary exchange)
			if (stockQuotes.length === 0 && this.bseProvider.isEnabled()) {
				try {
     // eslint-disable-next-line no-console
					console.log("🔄 [MarketMoversCache] Trying BSE India fallback...");
					stockQuotes = await this.fetchFromBse();
					successProvider = "bse";
     // eslint-disable-next-line no-console
					console.log(
						`✅ [MarketMoversCache] BSE India succeeded with ${stockQuotes.length} stocks`,
					);
				} catch (bseError) {
     // eslint-disable-next-line no-console
					console.warn("⚠️ [MarketMoversCache] BSE India failed:", bseError);
					this.metrics.providers.bse.failureCount++;
					this.metrics.providers.bse.lastFailure = Date.now();
				}
			}

			// Priority 3: Python sidecar/yfinance (datacenter-friendly, NIFTY50 coverage)
			if (stockQuotes.length === 0) {
				try {
     // eslint-disable-next-line no-console
					console.log(
						"🔄 [MarketMoversCache] Trying Python/yfinance fallback...",
					);
					stockQuotes = await this.fetchFromPython();
					successProvider = "python";
     // eslint-disable-next-line no-console
					console.log(
						`✅ [MarketMoversCache] Python/yfinance succeeded with ${stockQuotes.length} stocks`,
					);
				} catch (pyError: any) {
     // eslint-disable-next-line no-console
					console.warn(
						"⚠️ [MarketMoversCache] Python/yfinance failed:",
						pyError?.message || pyError,
					);
					this.metrics.providers.python.failureCount++;
					this.metrics.providers.python.lastFailure = Date.now();
				}
			}

			// Priority 4: Yahoo Finance (last resort, most rate-limited)
			if (stockQuotes.length === 0 && !this.yahooRateLimited) {
				try {
     // eslint-disable-next-line no-console
					console.log(
						"🔄 [MarketMoversCache] Trying Yahoo Finance fallback...",
					);
					stockQuotes = await this.fetchFromYahoo();
					successProvider = "yahoo";
     // eslint-disable-next-line no-console
					console.log(
						`✅ [MarketMoversCache] Yahoo Finance succeeded with ${stockQuotes.length} stocks`,
					);
				} catch (yahooError) {
     // eslint-disable-next-line no-console
					console.warn(
						"⚠️ [MarketMoversCache] Yahoo Finance failed:",
						yahooError,
					);
					this.metrics.providers.yahoo.failureCount++;
					this.metrics.providers.yahoo.lastFailure = Date.now();
				}
			}

			// Priority 5: Finnhub (limited Indian stock coverage)
			if (stockQuotes.length === 0 && this.finnhubProvider.isEnabled()) {
				try {
     // eslint-disable-next-line no-console
					console.log("🔄 [MarketMoversCache] Trying Finnhub fallback...");
					stockQuotes = await this.fetchFromFinnhub();
					successProvider = "finnhub";
     // eslint-disable-next-line no-console
					console.log(
						`✅ [MarketMoversCache] Finnhub succeeded with ${stockQuotes.length} stocks`,
					);
				} catch (finnhubError) {
     // eslint-disable-next-line no-console
					console.warn(
						"⚠️ [MarketMoversCache] Finnhub fallback failed:",
						finnhubError,
					);
					this.metrics.providers.finnhub.failureCount++;
					this.metrics.providers.finnhub.lastFailure = Date.now();
				}
			}

			if (stockQuotes.length === 0) {
				throw new Error("All providers failed to fetch stock data");
			}

			const gainers = stockQuotes
				.filter((stock) => stock.changePercent > 0)
				.sort((a, b) => b.changePercent - a.changePercent)
				.slice(0, 5);

			const losers = stockQuotes
				.filter((stock) => stock.changePercent < 0)
				.sort((a, b) => a.changePercent - b.changePercent)
				.slice(0, 5);

			this.cache = {
				data: { gainers, losers },
				timestamp: Date.now(),
				isRefreshing: false,
			};

			this.metrics.refreshes++;
			this.metrics.lastRefreshTime = Date.now();
			this.metrics.lastRefreshDuration = Date.now() - startTime;
			this.metrics.lastSuccessfulProvider = successProvider;

			// Save to Redis (L2) — survives restarts, serves cold-start instantly
			this.saveToRedis({ gainers, losers }).catch((err) =>
    // eslint-disable-next-line no-console
				console.warn("⚠️ [MarketMoversCache] Redis save failed:", err),
			);

			// Save to database (L3) for persistence (non-blocking)
			this.saveToDatabase(stockQuotes, successProvider || "unknown").catch(
				(err) =>
     // eslint-disable-next-line no-console
					console.warn("⚠️ [MarketMoversCache] Background DB save failed:", err),
			);

   // eslint-disable-next-line no-console
			console.log(
				`✅ [MarketMoversCache] Cache refreshed in ${this.metrics.lastRefreshDuration}ms via ${successProvider} (${stockQuotes.length} stocks)`,
			);
		} catch (error) {
			this.metrics.errors++;

			if (this.isRateLimitError(error)) {
    // eslint-disable-next-line no-console
				console.warn("⚠️ [MarketMoversCache] Rate limited by all providers");
			} else {
    // eslint-disable-next-line no-console
				console.error("❌ [MarketMoversCache] Refresh failed:", error);
			}

			if (!this.cache) {
				this.cache = {
					data: FALLBACK_DATA,
					timestamp: Date.now(),
					isRefreshing: false,
				};
				this.metrics.lastSuccessfulProvider = "static_fallback";
    // eslint-disable-next-line no-console
				console.log("📌 [MarketMoversCache] Using fallback data");
			}
		} finally {
			this.refreshLock = false;
		}
	}

	async getMarketMovers(): Promise<{
		data: MarketMoversData;
		cached: boolean;
		cacheAge: number;
		provider: string | null;
	}> {
		const now = Date.now();

		if (this.cache) {
			const cacheAge = now - this.cache.timestamp;

			if (cacheAge < CACHE_TTL_MS) {
				this.metrics.hits++;
				return {
					data: this.cache.data,
					cached: true,
					cacheAge,
					provider: this.metrics.lastSuccessfulProvider,
				};
			}

			if (cacheAge < STALE_TTL_MS) {
				this.metrics.hits++;
    // eslint-disable-next-line no-console
				console.log(
					`📦 [MarketMoversCache] Serving stale cache (age: ${Math.round(cacheAge / 1000)}s)`,
				);

				if (!this.refreshLock) {
     // eslint-disable-next-line no-console
					this.refreshCache().catch(console.error);
				}

				return {
					data: this.cache.data,
					cached: true,
					cacheAge,
					provider: this.metrics.lastSuccessfulProvider,
				};
			}
		}

		this.metrics.misses++;

		const hasFallback =
			this.finnhubProvider.isEnabled() || this.nseProvider.isEnabled();
		const cannotFetch =
			(!this.isInitialized || this.isRateLimited()) && !hasFallback;
		if (cannotFetch) {
   // eslint-disable-next-line no-console
			console.log(
				"📌 [MarketMoversCache] Returning fallback data (not initialized or all providers unavailable)",
			);
			if (!this.refreshLock) {
    // eslint-disable-next-line no-console
				this.refreshCache().catch(console.error);
			}
			return {
				data: this.cache?.data || FALLBACK_DATA,
				cached: false,
				cacheAge: 0,
				provider: this.cache
					? this.metrics.lastSuccessfulProvider
					: "static_fallback",
			};
		}

  // eslint-disable-next-line no-console
		console.log("🔍 [MarketMoversCache] Cache MISS, fetching fresh data...");

		if (!this.refreshLock) {
			await this.refreshCache();
		} else {
			while (this.refreshLock) {
				await new Promise((resolve) => setTimeout(resolve, 50));
			}
		}

		if (this.cache) {
			return {
				data: this.cache.data,
				cached: false,
				cacheAge: 0,
				provider: this.metrics.lastSuccessfulProvider,
			};
		}

		return {
			data: FALLBACK_DATA,
			cached: false,
			cacheAge: 0,
			provider: "static_fallback",
		};
	}

	getMetrics(): CacheMetrics & {
		cacheAge: number | null;
		hitRate: string;
		isRateLimited: boolean;
		backoffRemaining: number;
		finnhubEnabled: boolean;
		nseEnabled: boolean;
		yahooRateLimited: boolean;
	} {
		const cacheAge = this.cache ? Date.now() - this.cache.timestamp : null;
		const total = this.metrics.hits + this.metrics.misses;
		const hitRate =
			total > 0 ? `${((this.metrics.hits / total) * 100).toFixed(1)}%` : "N/A";
		const backoffRemaining = Math.max(
			0,
			this.metrics.backoffUntil - Date.now(),
		);

		return {
			...this.metrics,
			cacheAge,
			hitRate,
			isRateLimited: this.isRateLimited(),
			backoffRemaining,
			finnhubEnabled: this.finnhubProvider.isEnabled(),
			nseEnabled: this.nseProvider.isEnabled(),
			yahooRateLimited: this.yahooRateLimited,
		};
	}
}

export const marketMoversCache = new MarketMoversCache();
