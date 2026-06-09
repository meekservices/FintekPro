import cron from "node-cron";
import { MultiSourceMFService } from "./services/multisource-mf-service";
import { storage } from "./storage";

/**
 * Background job to refresh popular mutual funds data
 * Runs every 6 hours to keep database fresh with latest NAV and returns
 */
export class MutualFundsRefreshJob {
	private mfService: MultiSourceMFService;
	private isRunning = false;

	constructor() {
		this.mfService = new MultiSourceMFService(storage);
	}

	/**
	 * Start the cron job
	 */
	start(): void {
		// Run every 6 hours at minute 0
		cron.schedule("0 */6 * * *", async () => {
			await this.refreshPopularFunds();
		});

		// Also run immediately on startup (with delay to avoid startup race conditions)
		setTimeout(() => {
			this.refreshPopularFunds();
		}, 30000); // 30 seconds delay

		console.log("🔄 Mutual Funds refresh job scheduled (every 6 hours)");
	}

	/**
	 * Refresh popular funds data
	 */
	private async refreshPopularFunds(): Promise<void> {
		if (this.isRunning) {
			console.log("⏭️  Mutual Funds refresh already in progress, skipping...");
			return;
		}

		try {
			this.isRunning = true;
			console.log("🔄 Starting Mutual Funds database refresh...");

			// Fetch popular funds from external sources
			const popularFunds = await this.mfService.getPopularFunds();

			if (popularFunds && popularFunds.length > 0) {
				console.log(
					`✅ Refreshed ${popularFunds.length} popular mutual funds in database`,
				);

				// Get all funds from database to check staleness
				const allDbFunds = await storage.getAllMutualFunds();
				const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;

				const staleFunds = allDbFunds.filter((fund) => {
					const lastUpdated = fund.lastUpdated
						? new Date(fund.lastUpdated).getTime()
						: 0;
					return lastUpdated < sixHoursAgo;
				});

				console.log(
					`📊 Database status: ${allDbFunds.length} total funds, ${staleFunds.length} stale (>6 hours old)`,
				);

				// Optionally refresh some stale funds (limit to avoid overwhelming APIs)
				if (staleFunds.length > 0) {
					// Filter out funds with invalid scheme codes
					const validStaleFunds = staleFunds.filter(
						(fund) => fund.schemeCode && fund.schemeCode.trim() !== "",
					);

					const fundsToRefresh = validStaleFunds.slice(0, 10); // Refresh top 10 stale funds

					for (const staleFund of fundsToRefresh) {
						try {
							await this.mfService.getFund(staleFund.schemeCode);
							console.log(
								`✅ Refreshed stale fund ${staleFund.schemeCode}: ${staleFund.schemeName}`,
							);
						} catch (error) {
							console.warn(
								`Failed to refresh stale fund ${staleFund.schemeCode}:`,
								error,
							);
						}
					}

					console.log(
						`🔄 Refreshed ${fundsToRefresh.length} stale funds (${staleFunds.length - validStaleFunds.length} skipped due to invalid scheme codes)`,
					);
				}
			}
		} catch (error) {
			console.error("❌ Error refreshing mutual funds:", error);
		} finally {
			this.isRunning = false;
		}
	}

	/**
	 * Manual trigger for testing
	 */
	async triggerRefresh(): Promise<void> {
		await this.refreshPopularFunds();
	}
}

// Create and export singleton instance
export const mutualFundsRefreshJob = new MutualFundsRefreshJob();
