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

const DEFAULT_ETFS = [
	"SPY",
	"QQQ",
	"IWM",
	"VTI",
	"VOO",
	"IVV",
	"VEA",
	"VWO",
	"EFA",
	"AGG",
	"BND",
	"LQD",
	"TLT",
	"GLD",
	"SLV",
	"XLF",
	"XLK",
	"XLE",
	"XLV",
	"XLI",
];

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
