import { financialDataRepository } from "./financial-data-repository";
import { db } from "../db";
import { globalInstruments } from "@shared/schema";

const DEFAULT_GLOBAL_STOCKS = [
	"AAPL",
	"MSFT",
	"GOOGL",
	"AMZN",
	"NVDA",
	"META",
	"TSLA",
	"BRK-B",
	"JPM",
	"V",
	"UNH",
	"MA",
	"JNJ",
	"XOM",
	"HD",
	"PG",
	"CVX",
	"MRK",
	"ABBV",
	"PFE",
];

/**
 * ETF Registry — country/region-mapped.
 * Covers every ETF reachable via Yahoo Chart /v8/finance/chart/ (no API key).
 * Fields: symbol, name, country (where underlying assets are), currency,
 *         exchange (where the ETF itself is listed), category, assetFocus.
 *
 * Grouped by geographic focus:
 *  US_BROAD      → broad US market (S&P 500, Nasdaq, Total Market)
 *  US_SECTOR     → US sector ETFs (Finance, Tech, Energy, Health, Industrials)
 *  US_BOND       → US fixed-income (Aggregate, Corporate, Treasury, Short-Term)
 *  COMMODITY     → Gold, Silver (global commodities, USD-priced)
 *  INDIA         → Indian equity & gold ETFs listed on NSE (INR)
 *  EM            → Emerging Markets broad (VWO, EEM, IEMG)
 *  INTL_DEVLPD   → International Developed Markets (EFA, VEA)
 *  EUROPE        → Europe-focused (IEUR, VGK)
 *  ASIA_PACIFIC  → Asia-Pacific ex-Japan + Japan (EWJ, AAXJ)
 *  GLOBAL_DIV    → Global Dividend income ETFs (DVY, VIG, SCHD)
 */
export interface ETFMeta {
	symbol: string;
	name: string;
	/** Country/region the ETF's underlying assets represent */
	country: string;
	currency: string;
	/** Exchange where the ETF itself is listed */
	exchange: string;
	/** Broad category: Equity | Bond | Commodity | Mixed */
	category: string;
	/** Geographic/thematic focus label shown in UI */
	assetFocus: string;
}

export const ETF_REGISTRY: ETFMeta[] = [
	// ── US Broad Market ───────────────────────────────────────────────────────
	{ symbol: "SPY",  name: "SPDR S&P 500 ETF Trust",             country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Large Cap" },
	{ symbol: "QQQ",  name: "Invesco Nasdaq-100 ETF",              country: "US", currency: "USD", exchange: "NASDAQ",   category: "Equity",    assetFocus: "US Tech / Growth" },
	{ symbol: "IWM",  name: "iShares Russell 2000 ETF",            country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Small Cap" },
	{ symbol: "VTI",  name: "Vanguard Total Stock Market ETF",     country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Total Market" },
	{ symbol: "VOO",  name: "Vanguard S&P 500 ETF",                country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Large Cap" },
	{ symbol: "IVV",  name: "iShares Core S&P 500 ETF",           country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Large Cap" },
	{ symbol: "VUG",  name: "Vanguard Growth ETF",                 country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Growth" },
	{ symbol: "VTV",  name: "Vanguard Value ETF",                  country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Value" },
	// ── US Sector ─────────────────────────────────────────────────────────────
	{ symbol: "XLF",  name: "Financial Select Sector SPDR Fund",  country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Financials" },
	{ symbol: "XLK",  name: "Technology Select Sector SPDR Fund", country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Technology" },
	{ symbol: "XLE",  name: "Energy Select Sector SPDR Fund",     country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Energy" },
	{ symbol: "XLV",  name: "Health Care Select Sector SPDR Fund",country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Healthcare" },
	{ symbol: "XLI",  name: "Industrial Select Sector SPDR Fund", country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Industrials" },
	{ symbol: "XLC",  name: "Communication Services Select Sector",country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Communication" },
	{ symbol: "XLRE", name: "Real Estate Select Sector SPDR Fund", country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Real Estate" },
	// ── US Fixed Income ────────────────────────────────────────────────────────
	{ symbol: "AGG",  name: "iShares Core US Aggregate Bond ETF", country: "US", currency: "USD", exchange: "NYSEARCA", category: "Bond",      assetFocus: "US Aggregate Bond" },
	{ symbol: "BND",  name: "Vanguard Total Bond Market ETF",      country: "US", currency: "USD", exchange: "NASDAQ",   category: "Bond",      assetFocus: "US Total Bond" },
	{ symbol: "LQD",  name: "iShares iBoxx Investment Grade Corp", country: "US", currency: "USD", exchange: "NYSEARCA", category: "Bond",      assetFocus: "US Corporate Bond" },
	{ symbol: "TLT",  name: "iShares 20+ Year Treasury Bond ETF", country: "US", currency: "USD", exchange: "NASDAQ",   category: "Bond",      assetFocus: "US Long Treasury" },
	{ symbol: "SHY",  name: "iShares 1-3 Year Treasury Bond ETF", country: "US", currency: "USD", exchange: "NASDAQ",   category: "Bond",      assetFocus: "US Short Treasury" },
	{ symbol: "HYG",  name: "iShares iBoxx High Yield Corp ETF",  country: "US", currency: "USD", exchange: "NYSEARCA", category: "Bond",      assetFocus: "US High Yield Bond" },
	// ── Commodities ────────────────────────────────────────────────────────────
	{ symbol: "GLD",  name: "SPDR Gold Shares",                    country: "GLOBAL", currency: "USD", exchange: "NYSEARCA", category: "Commodity", assetFocus: "Gold" },
	{ symbol: "SLV",  name: "iShares Silver Trust",                country: "GLOBAL", currency: "USD", exchange: "NYSEARCA", category: "Commodity", assetFocus: "Silver" },
	{ symbol: "IAU",  name: "iShares Gold Trust",                  country: "GLOBAL", currency: "USD", exchange: "NYSEARCA", category: "Commodity", assetFocus: "Gold" },
	{ symbol: "PDBC", name: "Invesco Diversified Commodity ETF",   country: "GLOBAL", currency: "USD", exchange: "NASDAQ",   category: "Commodity", assetFocus: "Multi-Commodity" },
	// ── India ETFs (NSE-listed, INR) ───────────────────────────────────────────
	// These are Indian ETFs tracking domestic indices — fetched via NSE symbol
	// Note: Yahoo chart uses .NS suffix for NSE-listed instruments
	{ symbol: "NIFTYBEES.NS",  name: "Nippon India ETF Nifty BeES",      country: "IN", currency: "INR", exchange: "NSE", category: "Equity",    assetFocus: "India Nifty 50" },
	{ symbol: "JUNIORBEES.NS", name: "Nippon India ETF Junior BeES",     country: "IN", currency: "INR", exchange: "NSE", category: "Equity",    assetFocus: "India Nifty Next 50" },
	{ symbol: "GOLDBEES.NS",   name: "Nippon India ETF Gold BeES",       country: "IN", currency: "INR", exchange: "NSE", category: "Commodity", assetFocus: "India Gold" },
	{ symbol: "BANKBEES.NS",   name: "Nippon India ETF Bank BeES",       country: "IN", currency: "INR", exchange: "NSE", category: "Equity",    assetFocus: "India Banking" },
	{ symbol: "ITBEES.NS",     name: "Nippon India ETF IT BeES",         country: "IN", currency: "INR", exchange: "NSE", category: "Equity",    assetFocus: "India IT" },
	{ symbol: "LIQUIDBEES.NS", name: "Nippon India ETF Liquid BeES",     country: "IN", currency: "INR", exchange: "NSE", category: "Bond",      assetFocus: "India Liquid" },
	{ symbol: "SETFNIF50.NS",  name: "SBI ETF Nifty 50",                 country: "IN", currency: "INR", exchange: "NSE", category: "Equity",    assetFocus: "India Nifty 50" },
	{ symbol: "ICICIB22.NS",   name: "ICICI Prudential Bharat 22 ETF",  country: "IN", currency: "INR", exchange: "NSE", category: "Equity",    assetFocus: "India PSU / Bharat 22" },
	{ symbol: "MOM100.NS",     name: "Motilal Oswal Nifty Midcap 100 ETF",country:"IN",currency:"INR",exchange:"NSE",   category: "Equity",    assetFocus: "India Midcap" },
	// ── Emerging Markets ───────────────────────────────────────────────────────
	{ symbol: "VWO",  name: "Vanguard FTSE Emerging Markets ETF", country: "EM", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Emerging Markets" },
	{ symbol: "EEM",  name: "iShares MSCI Emerging Markets ETF",  country: "EM", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Emerging Markets" },
	{ symbol: "IEMG", name: "iShares Core MSCI Emerging Markets", country: "EM", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Emerging Markets" },
	// ── International Developed ────────────────────────────────────────────────
	{ symbol: "EFA",  name: "iShares MSCI EAFE ETF",              country: "INTL", currency: "USD", exchange: "NYSEARCA", category: "Equity", assetFocus: "Developed ex-US" },
	{ symbol: "VEA",  name: "Vanguard FTSE Developed Markets ETF",country: "INTL", currency: "USD", exchange: "NYSEARCA", category: "Equity", assetFocus: "Developed ex-US" },
	{ symbol: "IXUS", name: "iShares Core MSCI Total Intl Stock", country: "INTL", currency: "USD", exchange: "NASDAQ",   category: "Equity", assetFocus: "Total International" },
	// ── Europe ────────────────────────────────────────────────────────────────
	{ symbol: "IEUR", name: "iShares Core MSCI Europe ETF",       country: "EU", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Europe" },
	{ symbol: "VGK",  name: "Vanguard FTSE Europe ETF",           country: "EU", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Europe" },
	{ symbol: "EWG",  name: "iShares MSCI Germany ETF",           country: "DE", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Germany" },
	{ symbol: "EWU",  name: "iShares MSCI United Kingdom ETF",    country: "UK", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "United Kingdom" },
	// ── Asia-Pacific ──────────────────────────────────────────────────────────
	{ symbol: "EWJ",  name: "iShares MSCI Japan ETF",             country: "JP", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "Japan" },
	{ symbol: "AAXJ", name: "iShares MSCI All Country Asia ex-JP",country: "AP", currency: "USD", exchange: "NASDAQ",   category: "Equity",    assetFocus: "Asia ex-Japan" },
	{ symbol: "FXI",  name: "iShares China Large-Cap ETF",        country: "CN", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "China" },
	{ symbol: "EWY",  name: "iShares MSCI South Korea ETF",       country: "KR", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "South Korea" },
	// ── Global Dividend ───────────────────────────────────────────────────────
	{ symbol: "DVY",  name: "iShares Select Dividend ETF",        country: "US", currency: "USD", exchange: "NASDAQ",   category: "Equity",    assetFocus: "US High Dividend" },
	{ symbol: "VIG",  name: "Vanguard Dividend Appreciation ETF", country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Dividend Growth" },
	{ symbol: "SCHD", name: "Schwab US Dividend Equity ETF",      country: "US", currency: "USD", exchange: "NYSEARCA", category: "Equity",    assetFocus: "US Dividend" },
];

/** Flat symbol list extracted from registry — passed to refreshETFs() */
const DEFAULT_ETFS = ETF_REGISTRY.map((e) => e.symbol);

const DEFAULT_MUTUAL_FUNDS = [
	"119551",
	"120503",
	"120505",
	"119597",
	"120847",
	"118551",
	"118632",
	"118633",
	"118634",
	"118636",
	"102885",
	"100356",
	"106235",
	"105758",
	"100474",
];

const DEFAULT_DEBT_INSTRUMENTS = [
	{
		symbol: "GSEC-2030",
		type: "govt_security",
		name: "Government Securities 2030",
		yieldPercent: 7.25,
		couponRate: 7.26,
	},
	{
		symbol: "GSEC-2033",
		type: "govt_security",
		name: "Government Securities 2033",
		yieldPercent: 7.32,
		couponRate: 7.18,
	},
	{
		symbol: "SGB-2024",
		type: "bond",
		name: "Sovereign Gold Bond 2024",
		yieldPercent: 2.5,
	},
	{
		symbol: "REC-NCD-24",
		type: "ncd",
		name: "REC Limited NCD 2024",
		yieldPercent: 7.95,
		couponRate: 7.95,
	},
	{
		symbol: "PFC-NCD-24",
		type: "ncd",
		name: "PFC Limited NCD 2024",
		yieldPercent: 7.85,
		couponRate: 7.85,
	},
];

interface SchedulerConfig {
	globalStocksIntervalMinutes: number;
	etfsIntervalMinutes: number;
	mutualFundsIntervalMinutes: number;
	debtIntervalMinutes: number;
	cleanupIntervalHours: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
	globalStocksIntervalMinutes: 60,
	etfsIntervalMinutes: 60,
	mutualFundsIntervalMinutes: 60,
	debtIntervalMinutes: 120,
	cleanupIntervalHours: 24,
};

class FinancialDataScheduler {
	private globalStocksTimer: NodeJS.Timeout | null = null;
	private etfsTimer: NodeJS.Timeout | null = null;
	private mutualFundsTimer: NodeJS.Timeout | null = null;
	private debtTimer: NodeJS.Timeout | null = null;
	private cleanupTimer: NodeJS.Timeout | null = null;
	private isRunning = false;
	private config: SchedulerConfig;
	private lastRefreshTimes: Record<string, Date> = {};

	constructor(config?: Partial<SchedulerConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	async start(): Promise<void> {
		if (this.isRunning) {
			console.log("⚠️ [FinancialDataScheduler] Already running");
			return;
		}

		console.log(
			"🚀 [FinancialDataScheduler] Starting periodic data refresh...",
		);
		this.isRunning = true;

		await financialDataRepository.initialize();

		await this.runInitialRefresh();

		this.schedulePeriodicRefresh();

		console.log("✅ [FinancialDataScheduler] Scheduler started successfully");
	}

	private async runInitialRefresh(): Promise<void> {
		console.log("📊 [FinancialDataScheduler] Running initial data refresh...");

		try {
			console.log(
				"📊 [FinancialDataScheduler] Refreshing global stocks (FMP primary, Yahoo fallback)...",
			);
			await this.refreshGlobalStocks();

			await new Promise((resolve) => setTimeout(resolve, 5000));

			console.log(
				"📊 [FinancialDataScheduler] Refreshing ETFs (FMP primary, Yahoo fallback)...",
			);
			await this.refreshETFs();

			// Mutual funds and debt don't use Yahoo Finance, can run in parallel
			await Promise.all([
				this.refreshMutualFunds(),
				this.refreshDebtInstruments(),
			]);
			console.log("✅ [FinancialDataScheduler] Initial refresh completed");
		} catch (error) {
			console.error(
				"❌ [FinancialDataScheduler] Initial refresh failed:",
				error,
			);
		}
	}

	private schedulePeriodicRefresh(): void {
		this.globalStocksTimer = setInterval(
			() => this.refreshGlobalStocks(),
			this.config.globalStocksIntervalMinutes * 60 * 1000,
		);

		this.etfsTimer = setInterval(
			() => this.refreshETFs(),
			this.config.etfsIntervalMinutes * 60 * 1000,
		);

		this.mutualFundsTimer = setInterval(
			() => this.refreshMutualFunds(),
			this.config.mutualFundsIntervalMinutes * 60 * 1000,
		);

		this.debtTimer = setInterval(
			() => this.refreshDebtInstruments(),
			this.config.debtIntervalMinutes * 60 * 1000,
		);

		this.cleanupTimer = setInterval(
			() => this.runCleanup(),
			this.config.cleanupIntervalHours * 60 * 60 * 1000,
		);

		console.log(`📅 [FinancialDataScheduler] Scheduled:
      - Global Stocks: every ${this.config.globalStocksIntervalMinutes} minutes
      - ETFs: every ${this.config.etfsIntervalMinutes} minutes
      - Mutual Funds: every ${this.config.mutualFundsIntervalMinutes} minutes
      - Debt: every ${this.config.debtIntervalMinutes} minutes
      - Cleanup: every ${this.config.cleanupIntervalHours} hours`);
	}

	private async refreshGlobalStocks(): Promise<void> {
		console.log("🔄 [FinancialDataScheduler] Refreshing global stocks...");
		try {
			const dbInstruments = await db
				.select({ symbol: globalInstruments.symbol })
				.from(globalInstruments);
			const dbSymbols = dbInstruments.map((i) => i.symbol).filter(Boolean);
			const allSymbols = [...new Set([...DEFAULT_GLOBAL_STOCKS, ...dbSymbols])];
			console.log(
				`📊 [FinancialDataScheduler] Refreshing ${allSymbols.length} global stocks (${DEFAULT_GLOBAL_STOCKS.length} default + ${dbSymbols.length} from DB)`,
			);
			const result =
				await financialDataRepository.refreshGlobalStocks(allSymbols);
			this.lastRefreshTimes.globalStocks = new Date();
			console.log(
				`✅ Global stocks: ${result.success} updated, ${result.failed} failed`,
			);
		} catch (error) {
			console.error(
				"❌ [FinancialDataScheduler] Global stocks refresh error:",
				error,
			);
		}
	}

	private async refreshETFs(): Promise<void> {
		console.log("🔄 [FinancialDataScheduler] Refreshing ETFs...");
		try {
			const result = await financialDataRepository.refreshETFs(DEFAULT_ETFS);
			this.lastRefreshTimes.etfs = new Date();
			console.log(
				`✅ ETFs: ${result.success} updated, ${result.failed} failed`,
			);
		} catch (error) {
			console.error("❌ [FinancialDataScheduler] ETFs refresh error:", error);
		}
	}

	private async refreshMutualFunds(): Promise<void> {
		console.log("🔄 [FinancialDataScheduler] Refreshing mutual funds...");
		try {
			const result =
				await financialDataRepository.refreshMutualFunds(DEFAULT_MUTUAL_FUNDS);
			this.lastRefreshTimes.mutualFunds = new Date();
			console.log(
				`✅ Mutual funds: ${result.success} updated, ${result.failed} failed`,
			);
		} catch (error) {
			console.error(
				"❌ [FinancialDataScheduler] Mutual funds refresh error:",
				error,
			);
		}
	}

	private async refreshDebtInstruments(): Promise<void> {
		console.log("🔄 [FinancialDataScheduler] Refreshing debt instruments...");
		try {
			const result = await financialDataRepository.refreshDebtInstruments(
				DEFAULT_DEBT_INSTRUMENTS,
			);
			this.lastRefreshTimes.debt = new Date();
			console.log(
				`✅ Debt instruments: ${result.success} updated, ${result.failed} failed`,
			);
		} catch (error) {
			console.error("❌ [FinancialDataScheduler] Debt refresh error:", error);
		}
	}

	private async runCleanup(): Promise<void> {
		console.log("🧹 [FinancialDataScheduler] Running cleanup...");
		try {
			const deleted = await financialDataRepository.cleanupStaleData(7);
			this.lastRefreshTimes.cleanup = new Date();
			console.log(`✅ Cleanup: ${deleted} stale records removed`);
		} catch (error) {
			console.error("❌ [FinancialDataScheduler] Cleanup error:", error);
		}
	}

	async stop(): Promise<void> {
		if (!this.isRunning) return;

		console.log("🛑 [FinancialDataScheduler] Stopping...");

		if (this.globalStocksTimer) clearInterval(this.globalStocksTimer);
		if (this.etfsTimer) clearInterval(this.etfsTimer);
		if (this.mutualFundsTimer) clearInterval(this.mutualFundsTimer);
		if (this.debtTimer) clearInterval(this.debtTimer);
		if (this.cleanupTimer) clearInterval(this.cleanupTimer);

		this.isRunning = false;
		console.log("✅ [FinancialDataScheduler] Stopped");
	}

	getStatus(): {
		isRunning: boolean;
		lastRefreshTimes: Record<string, Date>;
		config: SchedulerConfig;
	} {
		return {
			isRunning: this.isRunning,
			lastRefreshTimes: this.lastRefreshTimes,
			config: this.config,
		};
	}

	async forceRefresh(
		type?: "globalStocks" | "etfs" | "mutualFunds" | "debt" | "all",
	): Promise<void> {
		if (!type || type === "all") {
			await Promise.all([
				this.refreshGlobalStocks(),
				this.refreshETFs(),
				this.refreshMutualFunds(),
				this.refreshDebtInstruments(),
			]);
		} else {
			switch (type) {
				case "globalStocks":
					await this.refreshGlobalStocks();
					break;
				case "etfs":
					await this.refreshETFs();
					break;
				case "mutualFunds":
					await this.refreshMutualFunds();
					break;
				case "debt":
					await this.refreshDebtInstruments();
					break;
			}
		}
	}
}

export const financialDataScheduler = new FinancialDataScheduler();
