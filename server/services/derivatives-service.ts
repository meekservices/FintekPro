/**
 * Derivatives Service — FintekPro
 *
 * Data source tiers (domestic & global):
 *
 * Indian (NSE/BSE) F&O
 *   Tier 1 — NSE official AJAX API (option chain, futures quotes, spot price)
 *             Cookie session managed internally; fast-timeout to avoid blocking
 *   Tier 2 — Python / yfinance  (/derivatives/nse-spot)
 *             Works from any server; handles indices (^NSEI) + equities (.NS)
 *   Tier 3 — Hardcoded reference prices (existing fallback, kept for dev/offline)
 *
 * Global Derivatives
 *   Tier 1 — FMP /quotes/future  (CME + CBOT futures, real-time)
 *   Tier 2 — Python / yfinance   (/derivatives/global-futures)
 *             Covers 30 symbols: equity indices, commodities, bonds, FX, agricultural
 *   Tier 3 — Cached synthetic data (last known values, or math fallback)
 */

import { callPython } from "../clients/python-client";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface OptionData {
	strikePrice: number;
	expiryDate: string;
	optionType: "CE" | "PE";
	openInterest: number;
	changeinOpenInterest: number;
	totalTradedVolume: number;
	impliedVolatility: number;
	lastPrice: number;
	change: number;
	pChange: number;
	totalBuyQuantity: number;
	totalSellQuantity: number;
	bidQty: number;
	bidPrice: number;
	askQty: number;
	askPrice: number;
	underlyingValue: number;
}

interface OptionsChain {
	symbol: string;
	underlyingValue: number;
	expiryDates: string[];
	strikePrices: number[];
	options: { calls: OptionData[]; puts: OptionData[] };
	timestamp: string;
	dataSource: "nse" | "synthetic";
}

interface FuturesData {
	symbol: string;
	expiryDate: string;
	lastPrice: number;
	change: number;
	pChange: number;
	openInterest: number;
	changeinOpenInterest: number;
	totalTradedVolume: number;
	underlyingValue: number;
	premium: number;
	basis: number;
	basisPct: number;
	dataSource?: string;
}

interface GlobalFuture {
	symbol: string;
	name: string;
	category: string;
	market: string;
	price: number;
	previousClose?: number;
	change?: number;
	changePercent?: number;
	dayHigh?: number;
	dayLow?: number;
	dataSource: string;
}

interface Greeks {
	delta: number;
	gamma: number;
	theta: number;
	vega: number;
	rho: number;
	impliedVolatility: number;
}

interface OIAnalysis {
	symbol: string;
	spotPrice: number;
	expiryDate: string;
	maxPainStrike: number;
	pcr: number; // put-call ratio (OI-based)
	callOI: number;
	putOI: number;
	highOICallStrikes: { strike: number; oi: number }[];
	highOIPutStrikes: { strike: number; oi: number }[];
	dataSource: string;
	timestamp: string;
}

interface StrategyLeg {
	type: "call" | "put" | "stock" | "future";
	action: "buy" | "sell";
	strikePrice?: number;
	quantity: number;
	premium?: number;
	expiryDate?: string;
}

interface StrategyPayoff {
	strategy: string;
	legs: StrategyLeg[];
	maxProfit: number | "unlimited";
	maxLoss: number | "unlimited";
	breakeven: number[];
	payoffData: { price: number; profit: number }[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const NSE_SYMBOLS = [
	"NIFTY",
	"BANKNIFTY",
	"FINNIFTY",
	"MIDCPNIFTY",
	"RELIANCE",
	"TCS",
	"INFY",
	"HDFCBANK",
	"ICICIBANK",
	"SBIN",
	"BHARTIARTL",
	"ITC",
	"KOTAKBANK",
	"LT",
	"AXISBANK",
	"MARUTI",
	"TITAN",
	"BAJFINANCE",
	"ASIANPAINT",
	"TATAMOTORS",
	"SUNPHARMA",
	"HCLTECH",
	"WIPRO",
	"TATASTEEL",
	"ONGC",
	"NTPC",
	"POWERGRID",
	"COALINDIA",
	"JSWSTEEL",
	"HINDALCO",
];

const LOT_SIZES: Record<string, number> = {
	NIFTY: 50,
	BANKNIFTY: 15,
	FINNIFTY: 40,
	MIDCPNIFTY: 75,
	RELIANCE: 250,
	TCS: 150,
	INFY: 300,
	HDFCBANK: 550,
	ICICIBANK: 700,
	SBIN: 1500,
	BHARTIARTL: 475,
	ITC: 1600,
	KOTAKBANK: 400,
	LT: 150,
	AXISBANK: 600,
	MARUTI: 100,
	TITAN: 175,
	BAJFINANCE: 125,
	ASIANPAINT: 200,
	TATAMOTORS: 1425,
	SUNPHARMA: 350,
	HCLTECH: 350,
	WIPRO: 1500,
	TATASTEEL: 5500,
	ONGC: 3850,
	NTPC: 2250,
	POWERGRID: 2700,
	COALINDIA: 2100,
	JSWSTEEL: 675,
	HINDALCO: 1075,
};

// Baseline prices used as fallback when all live sources fail
const REFERENCE_PRICES: Record<string, number> = {
	NIFTY: 24500,
	BANKNIFTY: 52000,
	FINNIFTY: 23500,
	MIDCPNIFTY: 12500,
	RELIANCE: 2950,
	TCS: 4200,
	INFY: 1850,
	HDFCBANK: 1750,
	ICICIBANK: 1280,
	SBIN: 840,
	BHARTIARTL: 1680,
	ITC: 485,
	KOTAKBANK: 1850,
	LT: 3650,
	AXISBANK: 1180,
	MARUTI: 12500,
	TITAN: 3750,
	BAJFINANCE: 7200,
	ASIANPAINT: 2350,
	TATAMOTORS: 780,
	SUNPHARMA: 1920,
	HCLTECH: 1950,
	WIPRO: 295,
	TATASTEEL: 145,
	ONGC: 255,
	NTPC: 385,
	POWERGRID: 345,
	COALINDIA: 420,
	JSWSTEEL: 920,
	HINDALCO: 665,
};

const NSE_INDICES = new Set(["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]);

// ── NSE Session Manager ────────────────────────────────────────────────────────
// Manages cookie refresh for the NSE AJAX API.
// NSE requires valid browser cookies (set by the homepage) to accept API calls.
class NseSession {
	private cookies = "";
	private lastRefresh = 0;
	private readonly TTL = 90_000; // 90 seconds
	private pending: Promise<void> | null = null;

	private readonly BASE_HEADERS = {
		"User-Agent":
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
		Accept: "*/*",
		"Accept-Language": "en-US,en;q=0.9",
		Referer: "https://www.nseindia.com/option-chain",
		"X-Requested-With": "XMLHttpRequest",
		"sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="122"',
		"sec-ch-ua-mobile": "?0",
		"sec-fetch-dest": "empty",
		"sec-fetch-mode": "cors",
		"sec-fetch-site": "same-origin",
	};

	async fetchHeaders(): Promise<Record<string, string>> {
		if (Date.now() - this.lastRefresh < this.TTL && this.cookies) {
			return { ...this.BASE_HEADERS, Cookie: this.cookies };
		}
		if (this.pending) await this.pending;
		else {
			this.pending = this.refresh().finally(() => {
				this.pending = null;
			});
			await this.pending;
		}
		return { ...this.BASE_HEADERS, Cookie: this.cookies };
	}

	private async refresh(): Promise<void> {
		try {
			const homeResp = await fetch("https://www.nseindia.com", {
				signal: AbortSignal.timeout(6000),
				headers: {
					"User-Agent": this.BASE_HEADERS["User-Agent"],
					Accept:
						"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				},
			});
			const raw = homeResp.headers.get("set-cookie") || "";
			this.cookies = raw
				.split(",")
				.map((c) => c.split(";")[0].trim())
				.filter(Boolean)
				.join("; ");
			this.lastRefresh = Date.now();
		} catch {
			// NSE unreachable from this server — cookies stay empty, callers handle gracefully
		}
	}

	async get(url: string): Promise<any | null> {
		try {
			const headers = await this.fetchHeaders();
			const resp = await fetch(url, {
				signal: AbortSignal.timeout(8000),
				headers,
			});
			if (!resp.ok) return null;
			return await resp.json();
		} catch {
			return null;
		}
	}
}

const nseSession = new NseSession();

// ── Main Service ──────────────────────────────────────────────────────────────

class DerivativesService {
	private cache = new Map<string, { data: any; ts: number }>();
	private readonly CACHE_TTL = 60_000; // 1 min

	constructor() {
		console.log(
			"✅ Derivatives Service initialized (NSE + FMP + Python/yfinance tiers)",
		);
	}

	// ── Internal cache helpers ───────────────────────────────────────────────

	private getCached<T>(key: string): T | null {
		const hit = this.cache.get(key);
		if (hit && Date.now() - hit.ts < this.CACHE_TTL) return hit.data as T;
		return null;
	}

	private setCached(key: string, data: any): void {
		this.cache.set(key, { data, ts: Date.now() });
	}

	// ── Tier helpers ─────────────────────────────────────────────────────────

	/** Tier 1 (NSE): fetch option chain for an index or equity */
	private async fetchNSEOptionChain(
		symbol: string,
		expiry?: string,
	): Promise<any | null> {
		const isIndex = NSE_INDICES.has(symbol);
		const url = isIndex
			? `https://www.nseindia.com/api/option-chain-indices?symbol=${symbol}`
			: `https://www.nseindia.com/api/option-chain-equities?symbol=${symbol}`;
		return nseSession.get(url);
	}

	/** Tier 1 (NSE): fetch futures data for a symbol */
	private async fetchNSEFutures(symbol: string): Promise<any | null> {
		return nseSession.get(
			`https://www.nseindia.com/api/quote-derivative?symbol=${symbol}`,
		);
	}

	/** Tier 1 (FMP): fetch all global futures quotes */
	private async fetchFMPGlobalFutures(): Promise<GlobalFuture[]> {
		const apiKey = process.env.FMP_API_KEY;
		if (!apiKey) return [];
		try {
			const resp = await fetch(
				`https://financialmodelingprep.com/api/v3/quotes/future?apikey=${apiKey}`,
				{
					signal: AbortSignal.timeout(10000),
					headers: { Accept: "application/json" },
				},
			);
			if (!resp.ok) return [];
			const data: any[] = await resp.json();
			if (!Array.isArray(data)) return [];
			return data
				.filter((d) => d.symbol && d.price > 0)
				.map((d) => ({
					symbol: d.symbol,
					name: d.name || d.symbol,
					category: this.categorizeFuture(d.symbol),
					market: this.marketOfFuture(d.symbol),
					price: Number.parseFloat(d.price),
					previousClose: d.previousClose
						? Number.parseFloat(d.previousClose)
						: undefined,
					change: d.change ? Number.parseFloat(d.change) : undefined,
					changePercent: d.changesPercentage
						? Number.parseFloat(d.changesPercentage)
						: undefined,
					dayHigh: d.dayHigh ? Number.parseFloat(d.dayHigh) : undefined,
					dayLow: d.dayLow ? Number.parseFloat(d.dayLow) : undefined,
					dataSource: "fmp",
				}));
		} catch {
			return [];
		}
	}

	/** Tier 2 (Python/yfinance): global futures */
	private async fetchPythonGlobalFutures(): Promise<GlobalFuture[]> {
		try {
			const resp = await callPython<{ futures: any[]; count: number }>(
				"/derivatives/global-futures",
				"GET",
			);
			if (!resp?.futures) return [];
			return resp.futures.map((f) => ({
				symbol: f.symbol,
				name: f.name,
				category: f.category,
				market: f.market,
				price: Number.parseFloat(f.price),
				previousClose: f.previousClose
					? Number.parseFloat(f.previousClose)
					: undefined,
				change: f.change ? Number.parseFloat(f.change) : undefined,
				changePercent: f.changePercent
					? Number.parseFloat(f.changePercent)
					: undefined,
				dayHigh: f.dayHigh ? Number.parseFloat(f.dayHigh) : undefined,
				dayLow: f.dayLow ? Number.parseFloat(f.dayLow) : undefined,
				dataSource: "python-yfinance",
			}));
		} catch {
			return [];
		}
	}

	/** Tier 2 (Python/yfinance): NSE spot prices */
	private async fetchPythonNseSpot(
		symbols: string[],
	): Promise<Map<string, number>> {
		const prices = new Map<string, number>();
		if (!symbols.length) return prices;
		try {
			const resp = await callPython<{ results: Record<string, any> }>(
				"/derivatives/nse-spot",
				"POST",
				{ symbols },
			);
			if (!resp?.results) return prices;
			for (const [sym, data] of Object.entries(resp.results)) {
				if (data?.price > 0)
					prices.set(sym.toUpperCase(), Number.parseFloat(data.price));
			}
		} catch {
			/* Python unavailable — fall through */
		}
		return prices;
	}

	// ── Real spot price (used for all BS calculations) ───────────────────────

	private spotCache = new Map<string, { price: number; ts: number }>();
	private readonly SPOT_TTL = 60_000;

	async getSpotPrice(symbol: string): Promise<number> {
		const upper = symbol.toUpperCase();
		const cached = this.spotCache.get(upper);
		if (cached && Date.now() - cached.ts < this.SPOT_TTL) return cached.price;

		// Tier 2: Python/yfinance (Tier 1 NSE is wired into option chain directly)
		const pyPrices = await this.fetchPythonNseSpot([upper]);
		if (pyPrices.has(upper)) {
			const price = pyPrices.get(upper)!;
			this.spotCache.set(upper, { price, ts: Date.now() });
			return price;
		}

		// Tier 3: reference prices
		return REFERENCE_PRICES[upper] || 1000;
	}

	// ── Public API ────────────────────────────────────────────────────────────

	async getAvailableSymbols(): Promise<{
		symbols: string[];
		lotSizes: Record<string, number>;
	}> {
		return { symbols: NSE_SYMBOLS, lotSizes: LOT_SIZES };
	}

	async getExpiryDates(symbol: string): Promise<string[]> {
		// Try NSE first
		try {
			const nseData = await this.fetchNSEOptionChain(symbol);
			if (nseData?.records?.expiryDates?.length) {
				return nseData.records.expiryDates.slice(0, 12);
			}
		} catch {
			/* fall through */
		}

		// Compute Thursday-based expiry calendar (NSE pattern)
		const today = new Date();
		const isIndex = NSE_INDICES.has(symbol.toUpperCase());
		const expiries: string[] = [];

		for (let i = 0; i < 12; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() + i * 7);
			const thu = new Date(d);
			thu.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
			if (thu > today) expiries.push(thu.toISOString().split("T")[0]);
			if (!isIndex && expiries.length >= 3) break;
		}

		const monthly: string[] = [];
		for (let m = 0; m < 3; m++) {
			const end = new Date(today.getFullYear(), today.getMonth() + m + 1, 0);
			while (end.getDay() !== 4) end.setDate(end.getDate() - 1);
			if (end > today) monthly.push(end.toISOString().split("T")[0]);
		}

		return Array.from(new Set([...expiries, ...monthly])).sort();
	}

	async getOptionsChain(
		symbol: string,
		expiryDate?: string,
	): Promise<OptionsChain> {
		const cacheKey = `options_${symbol}_${expiryDate || "all"}`;
		const cached = this.getCached<OptionsChain>(cacheKey);
		if (cached) return cached;

		// ── Tier 1: NSE real option chain ─────────────────────────────────────
		try {
			const nseData = await this.fetchNSEOptionChain(symbol, expiryDate);
			if (nseData?.records?.data?.length) {
				const expiries: string[] = nseData.records.expiryDates || [];
				const selected = expiryDate || expiries[0];
				const underlying =
					nseData.records.underlyingValue || nseData.filtered?.IVs?.[0] || 0;

				const filtered = expiryDate
					? nseData.records.data.filter((d: any) => d.expiryDate === expiryDate)
					: nseData.filtered?.data || nseData.records.data;

				const strikePrices = [
					...new Set<number>(filtered.map((d: any) => d.strikePrice)),
				].sort((a, b) => a - b);

				const calls: OptionData[] = [];
				const puts: OptionData[] = [];

				for (const row of filtered) {
					const base: Omit<OptionData, "optionType"> = {
						strikePrice: row.strikePrice,
						expiryDate: row.expiryDate || selected,
						openInterest: 0,
						changeinOpenInterest: 0,
						totalTradedVolume: 0,
						impliedVolatility: 0,
						lastPrice: 0,
						change: 0,
						pChange: 0,
						totalBuyQuantity: 0,
						totalSellQuantity: 0,
						bidQty: 0,
						bidPrice: 0,
						askQty: 0,
						askPrice: 0,
						underlyingValue: underlying,
					};
					if (row.CE) {
						const ce = row.CE;
						calls.push({
							...base,
							optionType: "CE",
							openInterest: ce.openInterest || 0,
							changeinOpenInterest: ce.changeinOpenInterest || 0,
							totalTradedVolume: ce.totalTradedVolume || 0,
							impliedVolatility: ce.impliedVolatility || 0,
							lastPrice: ce.lastPrice || 0,
							change: ce.change || 0,
							pChange: ce.pChange || 0,
							totalBuyQuantity: ce.totalBuyQuantity || 0,
							totalSellQuantity: ce.totalSellQuantity || 0,
							bidQty: ce.bidQty || 0,
							bidPrice: ce.bidPrice || 0,
							askQty: ce.askQty || 0,
							askPrice: ce.askPrice || 0,
						});
					}
					if (row.PE) {
						const pe = row.PE;
						puts.push({
							...base,
							optionType: "PE",
							openInterest: pe.openInterest || 0,
							changeinOpenInterest: pe.changeinOpenInterest || 0,
							totalTradedVolume: pe.totalTradedVolume || 0,
							impliedVolatility: pe.impliedVolatility || 0,
							lastPrice: pe.lastPrice || 0,
							change: pe.change || 0,
							pChange: pe.pChange || 0,
							totalBuyQuantity: pe.totalBuyQuantity || 0,
							totalSellQuantity: pe.totalSellQuantity || 0,
							bidQty: pe.bidQty || 0,
							bidPrice: pe.bidPrice || 0,
							askQty: pe.askQty || 0,
							askPrice: pe.askPrice || 0,
						});
					}
				}

				const chain: OptionsChain = {
					symbol,
					underlyingValue: underlying,
					expiryDates: expiries,
					strikePrices,
					options: { calls, puts },
					timestamp: new Date().toISOString(),
					dataSource: "nse",
				};
				this.setCached(cacheKey, chain);
				return chain;
			}
		} catch {
			/* fall through */
		}

		// ── Tier 2/3: Black-Scholes with real spot price ───────────────────────
		return this.buildSyntheticChain(symbol, expiryDate);
	}

	/** Returns OI analysis — max pain, PCR, high OI strikes — from NSE data */
	async getOIAnalysis(symbol: string): Promise<OIAnalysis> {
		const expiries = await this.getExpiryDates(symbol);
		const nearExpiry = expiries[0] || new Date().toISOString().split("T")[0];
		const chain = await this.getOptionsChain(symbol, nearExpiry);

		const spotPrice =
			chain.underlyingValue || (await this.getSpotPrice(symbol));
		const { calls, puts } = chain.options;

		// PCR (OI-based)
		const totalCallOI = calls.reduce((sum, c) => sum + c.openInterest, 0);
		const totalPutOI = puts.reduce((sum, p) => sum + p.openInterest, 0);
		const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 1;

		// Max pain: strike where total option buyers lose most
		const allStrikes = [
			...new Set([...calls, ...puts].map((o) => o.strikePrice)),
		].sort((a, b) => a - b);
		let maxPainStrike = allStrikes[0] || spotPrice;
		let maxPainLoss = Number.NEGATIVE_INFINITY;

		for (const strike of allStrikes) {
			const callLoss = calls.reduce(
				(s, c) => s + c.openInterest * Math.max(0, c.strikePrice - strike),
				0,
			);
			const putLoss = puts.reduce(
				(s, p) => s + p.openInterest * Math.max(0, strike - p.strikePrice),
				0,
			);
			const totalLoss = callLoss + putLoss;
			if (totalLoss > maxPainLoss) {
				maxPainLoss = totalLoss;
				maxPainStrike = strike;
			}
		}

		// Top 5 strikes by OI
		const highOICallStrikes = [...calls]
			.sort((a, b) => b.openInterest - a.openInterest)
			.slice(0, 5)
			.map((c) => ({ strike: c.strikePrice, oi: c.openInterest }));

		const highOIPutStrikes = [...puts]
			.sort((a, b) => b.openInterest - a.openInterest)
			.slice(0, 5)
			.map((p) => ({ strike: p.strikePrice, oi: p.openInterest }));

		return {
			symbol,
			spotPrice,
			expiryDate: nearExpiry,
			maxPainStrike,
			pcr: Math.round(pcr * 100) / 100,
			callOI: totalCallOI,
			putOI: totalPutOI,
			highOICallStrikes,
			highOIPutStrikes,
			dataSource: chain.dataSource,
			timestamp: chain.timestamp,
		};
	}

	async getFuturesData(symbol: string): Promise<FuturesData[]> {
		const cacheKey = `futures_${symbol}`;
		const cached = this.getCached<FuturesData[]>(cacheKey);
		if (cached) return cached;

		// ── Tier 1: NSE real futures data ────────────────────────────────────
		try {
			const nseData = await this.fetchNSEFutures(symbol);
			const futureRecords = nseData?.stocks?.filter(
				(s: any) =>
					s.metadata?.instrumentType === "Stock Futures" ||
					s.metadata?.instrumentType === "Index Futures",
			);
			if (futureRecords?.length) {
				const spotPrice = await this.getSpotPrice(symbol);
				const result: FuturesData[] = futureRecords
					.slice(0, 3)
					.map((r: any) => {
						const m = r.metadata;
						const d = r.marketDeptOrderBook?.tradeInfo || {};
						const lastPrice = Number.parseFloat(
							m.lastPrice || m.closePrice || "0",
						);
						const basis = lastPrice - spotPrice;
						return {
							symbol: `${symbol}${m.expiryDate?.slice(0, 3)?.toUpperCase() || ""}`,
							expiryDate: m.expiryDate || "",
							lastPrice,
							change: Number.parseFloat(m.change || "0"),
							pChange: Number.parseFloat(m.pChange || "0"),
							openInterest: Number.parseInt(
								d.openInterest || m.openInterest || "0",
							),
							changeinOpenInterest: Number.parseInt(
								d.changeinOpenInterest || "0",
							),
							totalTradedVolume: Number.parseInt(m.totalTradedVolume || "0"),
							underlyingValue: spotPrice,
							premium: basis,
							basis,
							basisPct: spotPrice > 0 ? (basis / spotPrice) * 100 : 0,
							dataSource: "nse",
						};
					});
				this.setCached(cacheKey, result);
				return result;
			}
		} catch {
			/* fall through */
		}

		// ── Tier 2/3: synthetic with real spot price ─────────────────────────
		const spotPrice = await this.getSpotPrice(symbol);
		const expiries = await this.getExpiryDates(symbol);
		const monthly = expiries.filter((_, i) => i % 4 === 0).slice(0, 3);
		const labels = ["Current", "Next", "Far"];

		const result: FuturesData[] = monthly.map((expiry, i) => {
			const dte = this.daysToExpiry(expiry);
			const carry = spotPrice * 0.065 * (dte / 365);
			const noise = (Math.random() - 0.5) * spotPrice * 0.003;
			const futPrice = spotPrice + carry + noise;
			const basis = futPrice - spotPrice;
			return {
				symbol: `${symbol}${labels[i].toUpperCase().slice(0, 3)}`,
				expiryDate: expiry,
				lastPrice: Math.round(futPrice * 100) / 100,
				change:
					Math.round((Math.random() - 0.5) * spotPrice * 0.01 * 100) / 100,
				pChange: Math.round((Math.random() - 0.5) * 1 * 100) / 100,
				openInterest: Math.floor(Math.random() * 800_000) + 100_000,
				changeinOpenInterest: Math.floor((Math.random() - 0.5) * 30_000),
				totalTradedVolume: Math.floor(Math.random() * 400_000),
				underlyingValue: spotPrice,
				premium: Math.round(basis * 100) / 100,
				basis: Math.round(basis * 100) / 100,
				basisPct: Math.round((basis / spotPrice) * 10000) / 100,
				dataSource: "synthetic",
			};
		});

		this.setCached(cacheKey, result);
		return result;
	}

	/** Returns global futures — FMP first, Python/yfinance fallback */
	async getGlobalFutures(): Promise<{
		futures: GlobalFuture[];
		count: number;
		dataSource: string;
		timestamp: string;
	}> {
		const cacheKey = "global_futures";
		const cached = this.getCached<any>(cacheKey);
		if (cached) return cached;

		// Tier 1: FMP
		const fmpFutures = await this.fetchFMPGlobalFutures();
		if (fmpFutures.length >= 5) {
			const result = {
				futures: fmpFutures,
				count: fmpFutures.length,
				dataSource: "fmp",
				timestamp: new Date().toISOString(),
			};
			this.setCached(cacheKey, result);
			return result;
		}

		// Tier 2: Python/yfinance
		const pyFutures = await this.fetchPythonGlobalFutures();
		if (pyFutures.length >= 3) {
			const merged = this.mergeFutures(fmpFutures, pyFutures);
			const result = {
				futures: merged,
				count: merged.length,
				dataSource: "python-yfinance",
				timestamp: new Date().toISOString(),
			};
			this.setCached(cacheKey, result);
			return result;
		}

		// Tier 3: empty (let frontend show loading state)
		return {
			futures: [],
			count: 0,
			dataSource: "unavailable",
			timestamp: new Date().toISOString(),
		};
	}

	/** Merge two futures arrays, preferring FMP data when both have the same symbol */
	private mergeFutures(
		primary: GlobalFuture[],
		secondary: GlobalFuture[],
	): GlobalFuture[] {
		const map = new Map<string, GlobalFuture>();
		for (const f of secondary) map.set(f.symbol, f);
		for (const f of primary) map.set(f.symbol, f); // FMP overwrites
		return Array.from(map.values());
	}

	// ── Analytics (unchanged — mathematically correct) ────────────────────────

	calculateGreeks(
		spotPrice: number,
		strikePrice: number,
		daysToExpiry: number,
		volatility: number,
		riskFreeRate = 0.065,
		optionType: "call" | "put" = "call",
	): Greeks {
		const T = daysToExpiry / 365;
		const S = spotPrice,
			K = strikePrice,
			r = riskFreeRate,
			sigma = volatility;

		if (T <= 0)
			return {
				delta: optionType === "call" ? (S > K ? 1 : 0) : S < K ? -1 : 0,
				gamma: 0,
				theta: 0,
				vega: 0,
				rho: 0,
				impliedVolatility: volatility * 100,
			};

		const d1 =
			(Math.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
		const d2 = d1 - sigma * Math.sqrt(T);
		const Nd1 = this.normalCDF(d1),
			Nd2 = this.normalCDF(d2),
			nd1 = this.normalPDF(d1);

		const delta = optionType === "call" ? Nd1 : Nd1 - 1;
		const theta =
			optionType === "call"
				? (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) -
						r * K * Math.exp(-r * T) * Nd2) /
					365
				: (-(S * nd1 * sigma) / (2 * Math.sqrt(T)) +
						r * K * Math.exp(-r * T) * (1 - Nd2)) /
					365;
		const rho =
			optionType === "call"
				? (K * T * Math.exp(-r * T) * Nd2) / 100
				: (-K * T * Math.exp(-r * T) * (1 - Nd2)) / 100;
		const gamma = nd1 / (S * sigma * Math.sqrt(T));
		const vega = (S * nd1 * Math.sqrt(T)) / 100;

		return {
			delta: Math.round(delta * 10000) / 10000,
			gamma: Math.round(gamma * 10000) / 10000,
			theta: Math.round(theta * 100) / 100,
			vega: Math.round(vega * 100) / 100,
			rho: Math.round(rho * 100) / 100,
			impliedVolatility: volatility * 100,
		};
	}

	calculateStrategyPayoff(
		legs: StrategyLeg[],
		spotPrice: number,
		priceRange?: { min: number; max: number },
	): StrategyPayoff {
		const range = priceRange || { min: spotPrice * 0.8, max: spotPrice * 1.2 };
		const step = (range.max - range.min) / 100;
		const payoffData: { price: number; profit: number }[] = [];

		for (let price = range.min; price <= range.max; price += step) {
			let totalProfit = 0;
			for (const leg of legs) {
				const mult = leg.action === "buy" ? 1 : -1;
				const qty = leg.quantity;
				if (leg.type === "call")
					totalProfit +=
						(Math.max(0, price - (leg.strikePrice || 0)) - (leg.premium || 0)) *
						mult *
						qty;
				else if (leg.type === "put")
					totalProfit +=
						(Math.max(0, (leg.strikePrice || 0) - price) - (leg.premium || 0)) *
						mult *
						qty;
				else totalProfit += (price - spotPrice) * mult * qty;
			}
			payoffData.push({
				price: Math.round(price * 100) / 100,
				profit: Math.round(totalProfit * 100) / 100,
			});
		}

		const profits = payoffData.map((p) => p.profit);
		const maxProfit = Math.max(...profits);
		const maxLoss = Math.min(...profits);
		const breakeven: number[] = [];
		for (let i = 1; i < payoffData.length; i++) {
			if (
				(payoffData[i - 1].profit < 0 && payoffData[i].profit >= 0) ||
				(payoffData[i - 1].profit >= 0 && payoffData[i].profit < 0)
			) {
				breakeven.push(payoffData[i].price);
			}
		}

		return {
			strategy: this.identifyStrategy(legs),
			legs,
			maxProfit: maxProfit > 1_000_000 ? "unlimited" : maxProfit,
			maxLoss: maxLoss < -1_000_000 ? "unlimited" : maxLoss,
			breakeven,
			payoffData,
		};
	}

	getMarginRequirement(symbol: string, legs: StrategyLeg[]) {
		const lotSize = LOT_SIZES[symbol] || 100;
		let spanMargin = 0,
			exposureMargin = 0,
			premium = 0;
		for (const leg of legs) {
			const qty = leg.quantity * lotSize;
			const K = leg.strikePrice || 0;
			if (leg.action === "sell") {
				if (leg.type === "call" || leg.type === "put") {
					spanMargin += K * qty * 0.12;
					exposureMargin += K * qty * 0.03;
				} else if (leg.type === "future") {
					spanMargin += K * qty * 0.1;
					exposureMargin += K * qty * 0.025;
				}
			} else {
				premium += (leg.premium || 0) * qty;
			}
		}
		return {
			spanMargin: Math.round(spanMargin),
			exposureMargin: Math.round(exposureMargin),
			totalMargin: Math.round(spanMargin + exposureMargin + premium),
			premium: Math.round(premium),
		};
	}

	getPopularStrategies() {
		return [
			{
				name: "Long Call",
				description: "Buy a call option expecting price to rise",
				outlook: "bullish",
				legs: [{ type: "call", action: "buy" }],
				riskReward: "Limited risk, Unlimited reward",
			},
			{
				name: "Long Put",
				description: "Buy a put option expecting price to fall",
				outlook: "bearish",
				legs: [{ type: "put", action: "buy" }],
				riskReward: "Limited risk, Limited reward",
			},
			{
				name: "Covered Call",
				description: "Own stock and sell call to generate income",
				outlook: "neutral",
				legs: [
					{ type: "stock", action: "buy" },
					{ type: "call", action: "sell" },
				],
				riskReward: "Limited upside, Stock risk",
			},
			{
				name: "Bull Call Spread",
				description: "Buy lower strike call, sell higher strike call",
				outlook: "bullish",
				legs: [
					{ type: "call", action: "buy" },
					{ type: "call", action: "sell" },
				],
				riskReward: "Limited risk, Limited reward",
			},
			{
				name: "Bear Put Spread",
				description: "Buy higher strike put, sell lower strike put",
				outlook: "bearish",
				legs: [
					{ type: "put", action: "buy" },
					{ type: "put", action: "sell" },
				],
				riskReward: "Limited risk, Limited reward",
			},
			{
				name: "Long Straddle",
				description: "Buy call and put at same strike",
				outlook: "volatile",
				legs: [
					{ type: "call", action: "buy" },
					{ type: "put", action: "buy" },
				],
				riskReward: "Limited risk, Unlimited reward",
			},
			{
				name: "Long Strangle",
				description: "Buy OTM call and OTM put",
				outlook: "volatile",
				legs: [
					{ type: "call", action: "buy" },
					{ type: "put", action: "buy" },
				],
				riskReward: "Limited risk, Unlimited reward",
			},
			{
				name: "Iron Condor",
				description: "Sell OTM call spread and OTM put spread",
				outlook: "neutral",
				legs: [
					{ type: "put", action: "buy" },
					{ type: "put", action: "sell" },
					{ type: "call", action: "sell" },
					{ type: "call", action: "buy" },
				],
				riskReward: "Limited risk, Limited reward",
			},
			{
				name: "Iron Butterfly",
				description: "Sell ATM straddle, buy OTM strangle",
				outlook: "neutral",
				legs: [
					{ type: "put", action: "buy" },
					{ type: "put", action: "sell" },
					{ type: "call", action: "sell" },
					{ type: "call", action: "buy" },
				],
				riskReward: "Limited risk, Limited reward",
			},
		] as const;
	}

	getExpiryCalendar(): {
		date: string;
		type: "weekly" | "monthly";
		symbols: string[];
	}[] {
		const calendar: {
			date: string;
			type: "weekly" | "monthly";
			symbols: string[];
		}[] = [];
		const today = new Date();
		for (let i = 0; i < 8; i++) {
			const d = new Date(today);
			d.setDate(today.getDate() + i * 7);
			const thu = new Date(d);
			thu.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7));
			if (thu > today) {
				const isMonthEnd = this.isLastThursday(thu);
				calendar.push({
					date: thu.toISOString().split("T")[0],
					type: isMonthEnd ? "monthly" : "weekly",
					symbols: isMonthEnd
						? NSE_SYMBOLS
						: ["NIFTY", "BANKNIFTY", "FINNIFTY"],
				});
			}
		}
		return calendar;
	}

	// ── Private helpers ───────────────────────────────────────────────────────

	private async buildSyntheticChain(
		symbol: string,
		expiryDate?: string,
	): Promise<OptionsChain> {
		const spotPrice = await this.getSpotPrice(symbol);
		const expiries = await this.getExpiryDates(symbol);
		const selected = expiryDate || expiries[0];
		const isIndex = NSE_INDICES.has(symbol.toUpperCase());
		const interval = isIndex
			? symbol === "BANKNIFTY"
				? 100
				: 50
			: this.strikeInterval(spotPrice);
		const atm = Math.round(spotPrice / interval) * interval;
		const strikes = Array.from(
			{ length: 31 },
			(_, i) => atm + (i - 15) * interval,
		);
		const dte = this.daysToExpiry(selected);
		const iv = 0.15 + Math.random() * 0.2;
		const calls: OptionData[] = [];
		const puts: OptionData[] = [];

		for (const strike of strikes) {
			const callP = this.bsPrice(spotPrice, strike, dte, iv, "call");
			const putP = this.bsPrice(spotPrice, strike, dte, iv, "put");
			const oi = () => Math.floor(Math.random() * 500_000) + 10_000;

			const base = (price: number, type: "CE" | "PE"): OptionData => ({
				strikePrice: strike,
				expiryDate: selected,
				optionType: type,
				openInterest: oi(),
				changeinOpenInterest: Math.floor((Math.random() - 0.5) * 50_000),
				totalTradedVolume: Math.floor(Math.random() * 100_000),
				impliedVolatility: iv * 100,
				lastPrice: price,
				change: (Math.random() - 0.5) * price * 0.1,
				pChange: (Math.random() - 0.5) * 10,
				totalBuyQuantity: Math.floor(Math.random() * 10_000),
				totalSellQuantity: Math.floor(Math.random() * 10_000),
				bidQty: Math.floor(Math.random() * 1000),
				bidPrice: price * 0.99,
				askQty: Math.floor(Math.random() * 1000),
				askPrice: price * 1.01,
				underlyingValue: spotPrice,
			});

			calls.push(base(callP, "CE"));
			puts.push(base(putP, "PE"));
		}

		const chain: OptionsChain = {
			symbol,
			underlyingValue: spotPrice,
			expiryDates: expiries,
			strikePrices: strikes,
			options: { calls, puts },
			timestamp: new Date().toISOString(),
			dataSource: "synthetic",
		};

		this.setCached(`options_${symbol}_${expiryDate || "all"}`, chain);
		return chain;
	}

	private bsPrice(
		S: number,
		K: number,
		dte: number,
		sigma: number,
		type: "call" | "put",
	): number {
		const T = dte / 365;
		const r = 0.065;
		if (T <= 0)
			return type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
		const d1 =
			(Math.log(S / K) + (r + sigma ** 2 / 2) * T) / (sigma * Math.sqrt(T));
		const d2 = d1 - sigma * Math.sqrt(T);
		const price =
			type === "call"
				? S * this.normalCDF(d1) - K * Math.exp(-r * T) * this.normalCDF(d2)
				: K * Math.exp(-r * T) * this.normalCDF(-d2) - S * this.normalCDF(-d1);
		return Math.round(Math.max(0.05, price) * 100) / 100;
	}

	private daysToExpiry(expiry: string): number {
		return Math.max(
			0,
			Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000),
		);
	}

	private strikeInterval(price: number): number {
		if (price < 100) return 2.5;
		if (price < 500) return 5;
		if (price < 1000) return 10;
		if (price < 5000) return 25;
		return 50;
	}

	private isLastThursday(date: Date): boolean {
		const next = new Date(date);
		next.setDate(date.getDate() + 7);
		return next.getMonth() !== date.getMonth();
	}

	private categorizeFuture(symbol: string): string {
		if (/^(ES|NQ|YM|RTY|NIY|HSI)=F/.test(symbol)) return "equity_index";
		if (/^(GC|SI|PL|PA)=F/.test(symbol)) return "precious_metal";
		if (/^(CL|BZ|NG|HO)=F/.test(symbol)) return "energy";
		if (/^(HG|ALI|ZN|ZB|ZT)=F/.test(symbol))
			return symbol.startsWith("HG") || symbol.startsWith("ALI")
				? "industrial_metal"
				: "bond";
		if (/^6[EJBAC]=F/.test(symbol)) return "currency";
		if (/^(ZW|ZC|ZS|KC|CT)=F/.test(symbol)) return "agricultural";
		return "other";
	}

	private marketOfFuture(symbol: string): string {
		if (
			/^(ES|NQ|YM|RTY|ZN|ZB|ZT|GC|SI|PL|PA|CL|HG|NG|HO|ALI|ZW|ZC|ZS|KC|CT|6[EJBAC])=F/.test(
				symbol,
			)
		)
			return "US/CME";
		if (/^NIY=F/.test(symbol)) return "Japan";
		if (/^HSI=F/.test(symbol)) return "HK";
		return "Global";
	}

	private normalCDF(x: number): number {
		const a1 = 0.254829592,
			a2 = -0.284496736,
			a3 = 1.421413741,
			a4 = -1.453152027,
			a5 = 1.061405429,
			p = 0.3275911;
		const sign = x < 0 ? -1 : 1;
		x = Math.abs(x) / Math.sqrt(2);
		const t = 1 / (1 + p * x);
		const y =
			1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
		return 0.5 * (1 + sign * y);
	}

	private normalPDF(x: number): number {
		return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
	}

	private identifyStrategy(legs: StrategyLeg[]): string {
		const cb = legs.filter(
			(l) => l.type === "call" && l.action === "buy",
		).length;
		const cs = legs.filter(
			(l) => l.type === "call" && l.action === "sell",
		).length;
		const pb = legs.filter(
			(l) => l.type === "put" && l.action === "buy",
		).length;
		const ps = legs.filter(
			(l) => l.type === "put" && l.action === "sell",
		).length;
		const hs = legs.some((l) => l.type === "stock" || l.type === "future");
		if (cb === 1 && cs === 0 && pb === 0 && ps === 0 && !hs) return "Long Call";
		if (cb === 0 && cs === 1 && pb === 0 && ps === 0 && !hs)
			return "Short Call";
		if (cb === 0 && cs === 0 && pb === 1 && ps === 0 && !hs) return "Long Put";
		if (cb === 0 && cs === 0 && pb === 0 && ps === 1 && !hs) return "Short Put";
		if (cb === 1 && cs === 1 && pb === 0 && ps === 0) return "Call Spread";
		if (cb === 0 && cs === 0 && pb === 1 && ps === 1) return "Put Spread";
		if (cb === 1 && cs === 0 && pb === 1 && ps === 0)
			return "Long Straddle/Strangle";
		if (cb === 0 && cs === 1 && pb === 0 && ps === 1)
			return "Short Straddle/Strangle";
		if (cb === 1 && cs === 1 && pb === 1 && ps === 1)
			return "Iron Condor/Butterfly";
		if (hs && cs === 1) return "Covered Call";
		if (hs && pb === 1) return "Protective Put";
		return "Custom Strategy";
	}
}

export const derivativesService = new DerivativesService();
