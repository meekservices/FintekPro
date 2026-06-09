/**
 * Data Enrichment Scheduler
 *
 * Runs scheduled enrichment jobs to fill NULL database columns with real data.
 * Jobs run during off-peak hours (early morning IST) with rate limiting.
 */

import { db } from "../db";
import { getProductionDb, hasProductionDb } from "../db";
import { sql } from "drizzle-orm";

interface SchedulerStatus {
	isRunning: boolean;
	lastRunTime: Date | null;
	nextRunTime: Date | null;
	lastRunStats: {
		mfEnriched: number;
		stocksEnriched: number;
		navMetricsUpdated: number;
		duration: number;
	} | null;
}

class DataEnrichmentScheduler {
	private static instance: DataEnrichmentScheduler;
	private isRunning = false;
	private lastRunTime: Date | null = null;
	private nextRunTime: Date | null = null;
	private lastRunStats: SchedulerStatus["lastRunStats"] = null;
	private intervalId: NodeJS.Timeout | null = null;
	private readonly ENRICHMENT_HOUR = 5; // 5 AM IST (11:30 PM UTC previous day)

	private constructor() {}

	static getInstance(): DataEnrichmentScheduler {
		if (!DataEnrichmentScheduler.instance) {
			DataEnrichmentScheduler.instance = new DataEnrichmentScheduler();
		}
		return DataEnrichmentScheduler.instance;
	}

	getStatus(): SchedulerStatus {
		return {
			isRunning: this.isRunning,
			lastRunTime: this.lastRunTime,
			nextRunTime: this.nextRunTime,
			lastRunStats: this.lastRunStats,
		};
	}

	/**
	 * Initialize the scheduler - runs daily at 5 AM IST
	 */
	initialize(): void {
		if (this.intervalId) {
			console.log("[DataEnrichmentScheduler] Already initialized");
			return;
		}

		// Calculate next run time
		this.scheduleNextRun();

		console.log(
			`[DataEnrichmentScheduler] Initialized - next run at ${this.nextRunTime?.toISOString()}`,
		);
	}

	private scheduleNextRun(): void {
		const now = new Date();
		const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
		const nowIST = new Date(now.getTime() + istOffset);

		// Set target to 5 AM IST today or tomorrow
		const targetIST = new Date(nowIST);
		targetIST.setHours(this.ENRICHMENT_HOUR, 0, 0, 0);

		if (nowIST > targetIST) {
			// Already past 5 AM IST, schedule for tomorrow
			targetIST.setDate(targetIST.getDate() + 1);
		}

		// Convert back to UTC
		this.nextRunTime = new Date(targetIST.getTime() - istOffset);

		// Calculate delay
		const delay = this.nextRunTime.getTime() - now.getTime();

		// Set timeout for next run
		if (this.intervalId) {
			clearTimeout(this.intervalId);
		}

		this.intervalId = setTimeout(() => {
			this.runEnrichmentJobs();
		}, delay);
	}

	/**
	 * Run all enrichment jobs
	 */
	async runEnrichmentJobs(): Promise<void> {
		if (this.isRunning) {
			console.log("[DataEnrichmentScheduler] Already running, skipping");
			return;
		}

		if (!hasProductionDb()) {
			console.warn(
				"[DataEnrichmentScheduler] PRODUCTION_DATABASE_URL not set. Enrichment runs on production only. Skipping.",
			);
			return;
		}

		this.isRunning = true;
		const startTime = Date.now();
		console.log(
			"[DataEnrichmentScheduler] Starting scheduled enrichment run (targeting PRODUCTION DB)...",
		);

		const stats = {
			mfEnriched: 0,
			stocksEnriched: 0,
			navMetricsUpdated: 0,
			duration: 0,
		};

		try {
			// Run MF extended enrichment
			try {
				const { mfExtendedEnrichmentService } = await import(
					"./mf-extended-enrichment-service"
				);
				const mfResult = await mfExtendedEnrichmentService.enrichAllFunds({
					forceRefresh: false,
					batchSize: 500,
				});
				stats.mfEnriched = mfResult.fundsEnriched;
				console.log(
					`[DataEnrichmentScheduler] MF enrichment: ${stats.mfEnriched} funds enriched`,
				);
			} catch (error: any) {
				console.error(
					"[DataEnrichmentScheduler] MF enrichment failed:",
					error.message,
				);
			}

			// Run stock financial enrichment
			try {
				const { stockFinancialEnrichmentService } = await import(
					"./stock-financial-enrichment-service"
				);
				const stockResult =
					await stockFinancialEnrichmentService.enrichAllStocks({
						useFmp: true,
						maxFmpStocks: 40,
						includeReturns: true,
						batchSize: 50,
					});
				stats.stocksEnriched = stockResult.stocksEnriched;
				console.log(
					`[DataEnrichmentScheduler] Stock enrichment: ${stats.stocksEnriched} stocks enriched`,
				);
			} catch (error: any) {
				console.error(
					"[DataEnrichmentScheduler] Stock enrichment failed:",
					error.message,
				);
			}

			// Run NAV-based metrics sync
			try {
				const { mfReturnsSyncService } = await import(
					"./mf-returns-sync-service"
				);
				const navResult = await mfReturnsSyncService.runBatchSync(100);
				stats.navMetricsUpdated = navResult.successful;
				console.log(
					`[DataEnrichmentScheduler] NAV metrics: ${stats.navMetricsUpdated} funds updated`,
				);
			} catch (error: any) {
				console.error(
					"[DataEnrichmentScheduler] NAV metrics failed:",
					error.message,
				);
			}

			// Run extended data extraction
			try {
				const { mfExtendedDataExtractor } = await import(
					"./mf-extended-data-extractor"
				);
				const extractionResult = await mfExtendedDataExtractor.extractAllFunds({
					forceRefresh: false,
				});
				console.log(
					`[DataEnrichmentScheduler] Extraction: ${extractionResult.exitLoadUpdated} exit loads, ${extractionResult.minAmountsUpdated} min amounts`,
				);
			} catch (error: any) {
				console.error(
					"[DataEnrichmentScheduler] Extraction failed:",
					error.message,
				);
			}

			stats.duration = Date.now() - startTime;
			this.lastRunStats = stats;
			this.lastRunTime = new Date();

			console.log(`[DataEnrichmentScheduler] Completed in ${stats.duration}ms`);
		} catch (error: any) {
			console.error("[DataEnrichmentScheduler] Fatal error:", error.message);
		} finally {
			this.isRunning = false;

			// Schedule next run
			this.scheduleNextRun();
		}
	}

	/**
	 * Stop the scheduler
	 */
	stop(): void {
		if (this.intervalId) {
			clearTimeout(this.intervalId);
			this.intervalId = null;
			console.log("[DataEnrichmentScheduler] Stopped");
		}
	}
}

export const dataEnrichmentScheduler = DataEnrichmentScheduler.getInstance();
