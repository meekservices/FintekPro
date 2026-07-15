// @ts-nocheck
/* eslint-disable no-console */
/**
 * Financial Metrics Refresh Scheduler
 *
 * Scheduled jobs to refresh mutual fund and stock metrics from real data sources.
 * Runs daily to ensure regulatory compliance with fresh data.
 *
 * Schedule:
 * - Mutual Fund Returns: Daily at 11:00 PM IST (after NAV publication)
 * - Stock Metrics: Daily at 6:00 PM IST (after market close)
 */

import { mutualFundMetricsService } from "./mutual-fund-metrics-service";
import { stockMetricsService } from "./stock-metrics-service";
import { db } from "../db";
import { sql } from "drizzle-orm";
import cron from "node-cron";

interface RefreshJobResult {
	jobType: "mutual_funds" | "stocks";
	startedAt: Date;
	completedAt: Date;
	totalProcessed: number;
	successfulUpdates: number;
	failedUpdates: number;
	duration: number;
	status: "success" | "partial" | "failed";
	errors: string[];
}

interface SchedulerStatus {
	isRunning: boolean;
	lastMutualFundRefresh: RefreshJobResult | null;
	lastStockRefresh: RefreshJobResult | null;
	nextMutualFundRefresh: Date | null;
	nextStockRefresh: Date | null;
}

export class FinancialMetricsRefreshScheduler {
	private static instance: FinancialMetricsRefreshScheduler;
	private mutualFundCronJob: cron.ScheduledTask | null = null;
	private stockCronJob: cron.ScheduledTask | null = null;
	private isRunning: boolean = false;
	private lastMutualFundRefresh: RefreshJobResult | null = null;
	private lastStockRefresh: RefreshJobResult | null = null;

	private constructor() {}

	static getInstance(): FinancialMetricsRefreshScheduler {
		if (!FinancialMetricsRefreshScheduler.instance) {
			FinancialMetricsRefreshScheduler.instance =
				new FinancialMetricsRefreshScheduler();
		}
		return FinancialMetricsRefreshScheduler.instance;
	}

	/**
	 * Start the scheduler with cron-style scheduling at fixed IST times
	 *
	 * SCHEDULE:
	 * - Mutual Fund Returns: Daily at 11:00 PM IST (17:30 UTC) after NAV publication
	 * - Stock Metrics: Daily at 6:00 PM IST (12:30 UTC) after market close
	 */
	start(): void {
		if (this.isRunning) {
			console.log("[MetricsScheduler] Already running");
			return;
		}

		console.log(
			"[MetricsScheduler] Starting financial metrics refresh scheduler...",
		);
		this.isRunning = true;

		// Mutual Fund NAV refresh at 11:00 PM IST (17:30 UTC)
		// AMFI publishes NAV by 9 PM IST, we wait 2 hours for all AMCs to update
		this.mutualFundCronJob = cron.schedule(
			"30 17 * * *",
			async () => {
				console.log(
					"[MetricsScheduler] Triggering scheduled mutual fund refresh (11 PM IST)",
				);
				await this.refreshMutualFundMetrics();
			},
			{
				timezone: "Asia/Kolkata",
			},
		);

		// Second MF refresh pass at 2:00 AM IST to cover the remaining funds
		// (14,269 funds ÷ 3000/run = 5 runs needed; 2 runs/day = full coverage in 3 nights)
		cron.schedule(
			"0 2 * * *",
			async () => {
				console.log(
					"[MetricsScheduler] Triggering second MF refresh pass (2 AM IST)",
				);
				await this.refreshMutualFundMetrics();
			},
			{
				timezone: "Asia/Kolkata",
			},
		);

		// Stock metrics refresh at 6:00 PM IST (12:30 UTC)
		// Market closes at 3:30 PM IST, data available by 6 PM
		// Cron: minute hour day month weekday (IST via timezone)
		this.stockCronJob = cron.schedule(
			"0 18 * * 1-5",
			async () => {
				console.log(
					"[MetricsScheduler] Triggering scheduled stock metrics refresh (6 PM IST)",
				);
				await this.refreshStockMetrics();
			},
			{
				timezone: "Asia/Kolkata",
			},
		);

		console.log("[MetricsScheduler] Scheduler started with fixed IST times");
		console.log(
			"[MetricsScheduler] - Mutual fund refresh: Daily at 11:00 PM IST",
		);
		console.log(
			"[MetricsScheduler] - Stock metrics refresh: Weekdays at 6:00 PM IST",
		);
	}

	/**
	 * Stop the scheduler
	 */
	stop(): void {
		if (this.mutualFundCronJob) {
			this.mutualFundCronJob.stop();
			this.mutualFundCronJob = null;
		}
		if (this.stockCronJob) {
			this.stockCronJob.stop();
			this.stockCronJob = null;
		}
		this.isRunning = false;
		console.log("[MetricsScheduler] Scheduler stopped");
	}

	/**
	 * Refresh mutual fund returns from real AMFI data
	 */
	async refreshMutualFundMetrics(): Promise<RefreshJobResult> {
		const startedAt = new Date();
		console.log(
			`[MetricsScheduler] Starting mutual fund metrics refresh at ${startedAt.toISOString()}`,
		);

		try {
			// Clear audit log before batch update
			mutualFundMetricsService.clearAuditLog();

			// Refresh returns for schemes that need updating
			// 14,269 total funds: batch of 3000 × 2 runs/day = ~6000/day → full coverage in 3 nights
			const result = await mutualFundMetricsService.refreshAllReturns({
				limit: 3000,
		});

			const completedAt = new Date();
			const jobResult: RefreshJobResult = {
				jobType: "mutual_funds",
				startedAt,
				completedAt,
				totalProcessed: result.totalProcessed,
				successfulUpdates: result.successfulUpdates,
				failedUpdates: result.failedUpdates,
				duration: result.duration,
				status:
					result.failedUpdates === 0
						? "success"
						: result.successfulUpdates > 0
							? "partial"
							: "failed",
				errors: result.errors,
			};

			this.lastMutualFundRefresh = jobResult;

			// Log to database for compliance
			await this.logJobExecution(jobResult);

			console.log(
				`[MetricsScheduler] Mutual fund refresh completed: ${result.successfulUpdates} updated, ${result.failedUpdates} failed`,
			);

			return jobResult;
		} catch (error: any) {
			const completedAt = new Date();
			const jobResult: RefreshJobResult = {
				jobType: "mutual_funds",
				startedAt,
				completedAt,
				totalProcessed: 0,
				successfulUpdates: 0,
				failedUpdates: 0,
				duration: completedAt.getTime() - startedAt.getTime(),
				status: "failed",
				errors: [error.message],
			};

			this.lastMutualFundRefresh = jobResult;
			console.error("[MetricsScheduler] Mutual fund refresh failed:", error);

			return jobResult;
		}
	}

	/**
	 * Refresh stock metrics from real market data
	 */
	async refreshStockMetrics(): Promise<RefreshJobResult> {
		const startedAt = new Date();
		console.log(
			`[MetricsScheduler] Starting stock metrics refresh at ${startedAt.toISOString()}`,
		);

		try {
			// Refresh metrics for stocks that need updating
			const result = await stockMetricsService.refreshAllMetrics({
				limit: 200,
			});

			const completedAt = new Date();
			const jobResult: RefreshJobResult = {
				jobType: "stocks",
				startedAt,
				completedAt,
				totalProcessed: result.totalProcessed,
				successfulUpdates: result.successfulUpdates,
				failedUpdates: result.failedUpdates,
				duration: result.duration,
				status:
					result.failedUpdates === 0
						? "success"
						: result.successfulUpdates > 0
							? "partial"
							: "failed",
				errors: result.errors,
			};

			this.lastStockRefresh = jobResult;

			// Log to database for compliance
			await this.logJobExecution(jobResult);

			console.log(
				`[MetricsScheduler] Stock refresh completed: ${result.successfulUpdates} updated, ${result.failedUpdates} failed`,
			);

			return jobResult;
		} catch (error: any) {
			const completedAt = new Date();
			const jobResult: RefreshJobResult = {
				jobType: "stocks",
				startedAt,
				completedAt,
				totalProcessed: 0,
				successfulUpdates: 0,
				failedUpdates: 0,
				duration: completedAt.getTime() - startedAt.getTime(),
				status: "failed",
				errors: [error.message],
			};

			this.lastStockRefresh = jobResult;
			console.error("[MetricsScheduler] Stock refresh failed:", error);

			return jobResult;
		}
	}

	/**
	 * Log job execution to database for compliance audit
	 */
	private async logJobExecution(result: RefreshJobResult): Promise<void> {
		try {
			await db.execute(sql`
        INSERT INTO financial_metrics_refresh_log (
          job_type,
          started_at,
          completed_at,
          total_processed,
          successful_updates,
          failed_updates,
          duration_ms,
          status,
          errors
        ) VALUES (
          ${result.jobType},
          ${result.startedAt.toISOString()},
          ${result.completedAt.toISOString()},
          ${result.totalProcessed},
          ${result.successfulUpdates},
          ${result.failedUpdates},
          ${result.duration},
          ${result.status},
          ${JSON.stringify(result.errors)}
        )
      `);
		} catch (error) {
			// Log table might not exist, silently continue
			console.log(
				"[MetricsScheduler] Could not log to database (table may not exist)",
			);
		}
	}

	/**
	 * Get scheduler status
	 */
	getStatus(): SchedulerStatus {
		const now = new Date();

		return {
			isRunning: this.isRunning,
			lastMutualFundRefresh: this.lastMutualFundRefresh,
			lastStockRefresh: this.lastStockRefresh,
			nextMutualFundRefresh: this.lastMutualFundRefresh
				? new Date(
						this.lastMutualFundRefresh.completedAt.getTime() +
							24 * 60 * 60 * 1000,
					)
				: new Date(now.getTime() + 60 * 60 * 1000), // 1 hour from now if never run
			nextStockRefresh: this.lastStockRefresh
				? new Date(
						this.lastStockRefresh.completedAt.getTime() + 24 * 60 * 60 * 1000,
					)
				: new Date(now.getTime() + 60 * 60 * 1000),
		};
	}

	/**
	 * Trigger immediate refresh for both mutual funds and stocks
	 */
	async triggerImmediateRefresh(): Promise<{
		mutualFunds: RefreshJobResult;
		stocks: RefreshJobResult;
	}> {
		console.log("[MetricsScheduler] Triggering immediate refresh...");

		const [mutualFunds, stocks] = await Promise.all([
			this.refreshMutualFundMetrics(),
			this.refreshStockMetrics(),
		]);

		return { mutualFunds, stocks };
	}

	/**
	 * Get methodology documentation for both data types
	 */
	getMethodologyDocumentation(): string {
		const mfDoc = mutualFundMetricsService.getMethodologyDocumentation();
		const stockDoc = stockMetricsService.getMethodologyDocumentation();

		return `
${mfDoc}

================================================================================

${stockDoc}

================================================================================

SCHEDULER CONFIGURATION
=======================
Mutual Fund Returns Refresh:
- Frequency: Daily
- Trigger Time: 11:00 PM IST (after AMFI NAV publication)
- Data Source: MFAPI.in (AMFI official data)

Stock Metrics Refresh:
- Frequency: Daily  
- Trigger Time: 6:00 PM IST (after market close)
- Data Sources: Finnhub (primary), Yahoo Finance (fallback)

AUDIT & COMPLIANCE
==================
- All data updates are logged with timestamps
- Source attribution maintained for each data point
- Calculation formulas documented inline
- Historical audit trail available for regulator review

Last Scheduler Start: ${this.isRunning ? "Running" : "Stopped"}
    `.trim();
	}
}

export const financialMetricsRefreshScheduler =
	FinancialMetricsRefreshScheduler.getInstance();
