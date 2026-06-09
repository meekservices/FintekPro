import cron from "node-cron";
import { exchangeStockService } from "./exchange-stock-service";

class StockSyncScheduler {
	private isInitialized = false;

	initialize() {
		if (this.isInitialized) {
			console.log("[Stock Sync Scheduler] Already initialized");
			return;
		}

		// Schedule NSE sync daily at 6:00 AM IST (00:30 UTC) - full sync
		cron.schedule(
			"30 0 * * *",
			async () => {
				console.log(
					"[Stock Sync Scheduler] Starting scheduled NSE full sync...",
				);
				try {
					await exchangeStockService.syncNSEStocks({ topOnly: false });
					console.log("[Stock Sync Scheduler] NSE full sync completed");
				} catch (error) {
					console.error("[Stock Sync Scheduler] NSE sync failed:", error);
				}
			},
			{
				timezone: "Asia/Kolkata",
			},
		);

		// Schedule BSE sync daily at 6:30 AM IST (01:00 UTC) - full sync
		cron.schedule(
			"0 1 * * *",
			async () => {
				console.log(
					"[Stock Sync Scheduler] Starting scheduled BSE full sync...",
				);
				try {
					await exchangeStockService.syncBSEStocks({ topOnly: false });
					console.log("[Stock Sync Scheduler] BSE full sync completed");
				} catch (error) {
					console.error("[Stock Sync Scheduler] BSE sync failed:", error);
				}
			},
			{
				timezone: "Asia/Kolkata",
			},
		);

		this.isInitialized = true;
		console.log(
			"📈 [Stock Sync Scheduler] Initialized - NSE sync at 6:00 AM IST, BSE sync at 6:30 AM IST",
		);
	}

	async runManualSync(exchange: "NSE" | "BSE" | "BOTH" = "BOTH") {
		console.log(
			`[Stock Sync Scheduler] Manual full sync triggered for ${exchange}`,
		);

		if (exchange === "NSE" || exchange === "BOTH") {
			await exchangeStockService.syncNSEStocks({ topOnly: false });
		}

		if (exchange === "BSE" || exchange === "BOTH") {
			await exchangeStockService.syncBSEStocks({ topOnly: false });
		}
	}
}

export const stockSyncScheduler = new StockSyncScheduler();
