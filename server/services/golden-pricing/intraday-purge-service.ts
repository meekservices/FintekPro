/**
 * Intraday Golden Prices Rolling Purge Service
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 * Purpose: Maintains database storage efficiency and query speed by purging
 * tick-level intraday prices from `golden_prices_intraday` older than the retention window (default 5 trading days).
 *
 * Daily EOD prices are permanently preserved in `golden_prices`.
 */

import { pool } from "../../db";
import { logger } from "../../logger";

export interface PurgeResult {
	success: boolean;
	deletedCount: number;
	durationMs: number;
	purgedBeforeDate: string;
	error?: string;
}

export class IntradayPurgeService {
	private intervalHandle: NodeJS.Timeout | null = null;
	private isRunning: boolean = false;

	/**
	 * Deletes rows from golden_prices_intraday where tick_ts is older than retentionDays.
	 * Default retention is 5 days.
	 */
	public async purgeIntradayOlderThan(retentionDays: number = 5): Promise<PurgeResult> {
		if (this.isRunning) {
			logger.warn("[IntradayPurgeService] Purge already in progress, skipping concurrent run", {
				event: "INTRADAY_PURGE_CONCURRENT_SKIP",
			});
			return {
				success: false,
				deletedCount: 0,
				durationMs: 0,
				purgedBeforeDate: new Date().toISOString(),
				error: "Purge already running",
			};
		}

		this.isRunning = true;
		const startTime = Date.now();
		const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
		const cutoffIso = cutoffDate.toISOString();

		try {
			// Fast indexed deletion using tick_ts index
			const query = `
				DELETE FROM golden_prices_intraday
				WHERE tick_ts < $1::timestamptz
			`;
			const res = await pool.query(query, [cutoffIso]);
			const deletedCount = res.rowCount ?? 0;
			const durationMs = Date.now() - startTime;

			logger.info("[IntradayPurgeService] Completed 5-day rolling purge of intraday prices", {
				event: "INTRADAY_PRICES_PURGED",
				retention_days: retentionDays,
				deleted_count: deletedCount,
				purged_before: cutoffIso,
				latency_ms: durationMs,
				status: "SUCCESS",
			});

			return {
				success: true,
				deletedCount,
				durationMs,
				purgedBeforeDate: cutoffIso,
			};
		} catch (err: any) {
			const durationMs = Date.now() - startTime;
			logger.error("[IntradayPurgeService] Failed to purge old intraday prices", {
				event: "INTRADAY_PRICES_PURGE_ERROR",
				error: err?.message,
				latency_ms: durationMs,
				status: "ERROR",
			});

			return {
				success: false,
				deletedCount: 0,
				durationMs,
				purgedBeforeDate: cutoffIso,
				error: err?.message,
			};
		} finally {
			this.isRunning = false;
		}
	}

	/**
	 * Starts the recurring purge scheduler (runs once every 24 hours, plus 10s after startup).
	 */
	public startPurgeScheduler(intervalMs: number = 24 * 60 * 60 * 1000): void {
		if (this.intervalHandle) {
			return;
		}

		// Initial purge pass 15 seconds after startup
		setTimeout(() => {
			void this.purgeIntradayOlderThan(5);
		}, 15_000);

		// Daily recurring purge
		this.intervalHandle = setInterval(() => {
			void this.purgeIntradayOlderThan(5);
		}, intervalMs);

		logger.info("[IntradayPurgeService] 5-day rolling purge scheduler started", {
			event: "INTRADAY_PURGE_SCHEDULER_STARTED",
			interval_ms: intervalMs,
		});
	}

	/**
	 * Stops the recurring scheduler.
	 */
	public stopPurgeScheduler(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}
}

export const intradayPurgeService = new IntradayPurgeService();

