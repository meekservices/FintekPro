import { logger } from "../logger";
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
			logger.info("[DataEnrichmentScheduler] Already initialized");
			return;
		}

		// Calculate next run time
		this.scheduleNextRun();

		logger.info(
			`[DataEnrichmentScheduler] Initialized - next run at ${this.nextRunTime?.toISOString()}`,
		);
	}

	private scheduleNextRun(): void {
		const nowUtcMs = Date.now();
		const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
		const nowIstDate = new Date(nowUtcMs + IST_OFFSET_MS);

		// 5 AM IST → UTC: hour=5, min=0 → UTC hour = 5-5=0, min = 0-30=-30 → borrow 1h → UTC 23:30 prev day
		const targetHourUtc = this.ENRICHMENT_HOUR - 5; // 0
		const targetMinUtc = 0 - 30;                    // -30 → need borrow
		const borrowHour = targetMinUtc < 0 ? 1 : 0;
		const finalHourUtc = targetHourUtc - borrowHour; // -1 → Date.UTC handles overflow to prev day
		const finalMinUtc = targetMinUtc < 0 ? targetMinUtc + 60 : targetMinUtc; // 30

		let targetMs = Date.UTC(
			nowIstDate.getUTCFullYear(),
			nowIstDate.getUTCMonth(),
			nowIstDate.getUTCDate(),
			finalHourUtc,
			finalMinUtc,
			0,
			0,
		);

		// If 5 AM IST has already passed today, target tomorrow
		if (targetMs <= nowUtcMs) {
			targetMs += 24 * 60 * 60 * 1000;
		}

		this.nextRunTime = new Date(targetMs);
		const delay = targetMs - nowUtcMs;

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
			logger.info("[DataEnrichmentScheduler] Already running, skipping");
			return;
		}

		if (!hasProductionDb()) {
			logger.warn(
				"[DataEnrichmentScheduler] PRODUCTION_DATABASE_URL not set. Enrichment runs on production only. Skipping.",
			);
			return;
		}

		this.isRunning = true;
		const startTime = Date.now();
		logger.info(
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
				logger.info(
					`[DataEnrichmentScheduler] MF enrichment: ${stats.mfEnriched} funds enriched`,
				);
			} catch (error: any) {
				logger.error(
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
				logger.info(
					`[DataEnrichmentScheduler] Stock enrichment: ${stats.stocksEnriched} stocks enriched`,
				);
			} catch (error: any) {
				logger.error(
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
				logger.info(
					`[DataEnrichmentScheduler] NAV metrics: ${stats.navMetricsUpdated} funds updated`,
				);
			} catch (error: any) {
				logger.error(
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
				logger.info(
					`[DataEnrichmentScheduler] Extraction: ${extractionResult.exitLoadUpdated} exit loads, ${extractionResult.minAmountsUpdated} min amounts`,
				);
			} catch (error: any) {
				logger.error(
					"[DataEnrichmentScheduler] Extraction failed:",
					error.message,
				);
			}

			stats.duration = Date.now() - startTime;
			this.lastRunStats = stats;
			this.lastRunTime = new Date();

			logger.info(`[DataEnrichmentScheduler] Completed in ${stats.duration}ms`);
		} catch (error: any) {
			logger.error("[DataEnrichmentScheduler] Fatal error:", error.message instanceof Error ? error.message : new Error(String(error.message)));
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
			logger.info("[DataEnrichmentScheduler] Stopped");
		}
	}
}

export const dataEnrichmentScheduler = DataEnrichmentScheduler.getInstance();
