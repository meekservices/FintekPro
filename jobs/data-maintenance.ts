#!/usr/bin/env ts-node
/**
 * Cloud Run Job: fintekpro-data-maintenance
 *
 * Automated Database & Data Lake Hygiene Worker.
 * Triggered by Cloud Scheduler: `0 20 * * 0` UTC (Sunday 01:30 AM IST).
 *
 * Responsibilities:
 * - Purge expired user session cookies from `session` table
 * - Clean stale distributed locks and lease records from `distributed_locks`
 * - Evict expired database cache entries (`cache` / `distributed_cache`)
 * - Transition unlisted stocks & clean zero-price records
 * - Update PostgreSQL query planner statistics via `ANALYZE` on high-throughput tables
 *
 * Complies with FintekPro GCR v1.0.
 *
 * @module jobs/data-maintenance
 */

import { logger } from "../server/logger";

const JOB_NAME = "fintekpro-data-maintenance";
const VERSION = "1.0.0";
const START_TIME = Date.now();

async function run(): Promise<void> {
	logger.info(`[${JOB_NAME}] Starting autonomous data maintenance job`, {
		event: "JOB_START",
		job_name: JOB_NAME,
		version: VERSION,
		timestamp: new Date().toISOString(),
	});

	try {
		const { pool } = await import("../server/db");

		// Phase 1: Expired Sessions Purge
		logger.info(`[${JOB_NAME}] Phase 1: Purging expired sessions...`);
		try {
			const res = await pool.query(
				"DELETE FROM session WHERE expire < NOW()",
			);
			logger.info(`[${JOB_NAME}] Phase 1 Complete: Purged ${res.rowCount ?? 0} expired sessions`);
		} catch (sessErr: any) {
			logger.warn(`[${JOB_NAME}] Phase 1 notice: ${sessErr?.message}`);
		}

		// Phase 2: Stale Distributed Locks Purge
		logger.info(`[${JOB_NAME}] Phase 2: Purging stale distributed locks...`);
		try {
			const lockRes = await pool.query(
				"DELETE FROM distributed_locks WHERE expires_at < NOW()",
			);
			logger.info(`[${JOB_NAME}] Phase 2 Complete: Purged ${lockRes.rowCount ?? 0} expired distributed locks`);
		} catch (lockErr: any) {
			logger.warn(`[${JOB_NAME}] Phase 2 notice: ${lockErr?.message}`);
		}

		// Phase 3: Expired Database Cache Eviction
		logger.info(`[${JOB_NAME}] Phase 3: Evicting expired cache records...`);
		try {
			const cacheRes = await pool.query(
				"DELETE FROM cache WHERE expires_at < NOW()",
			);
			logger.info(`[${JOB_NAME}] Phase 3 Complete: Purged ${cacheRes.rowCount ?? 0} expired cache entries`);
		} catch {
			// table may not exist in all environments — non-fatal
		}

		// Phase 4: Unlisted Lifecycle & Zero-Price Cleanup
		logger.info(`[${JOB_NAME}] Phase 4: Running unlisted company lifecycle maintenance...`);
		try {
			const { runUnlistedLifecycleCleanup } = await import(
				"../server/services/unlisted/unlisted-lifecycle-cleanup"
			).catch(() => ({ runUnlistedLifecycleCleanup: null }));
			if (typeof runUnlistedLifecycleCleanup === "function") {
				await runUnlistedLifecycleCleanup();
				logger.info(`[${JOB_NAME}] Phase 4 Complete: Unlisted lifecycle sweep finished`);
			}
		} catch (unlErr: any) {
			logger.warn(`[${JOB_NAME}] Phase 4 notice: ${unlErr?.message}`);
		}

		// Phase 5: PostgreSQL Statistics Refresh (ANALYZE)
		logger.info(`[${JOB_NAME}] Phase 5: Updating PostgreSQL query planner statistics (ANALYZE)...`);
		const tablesToAnalyze = [
			"listed_stocks",
			"mutual_funds",
			"model_portfolios",
			"model_portfolio_holdings",
			"market_briefs",
			"financial_metrics",
			"stock_price_candles",
			"screener_master_snapshots",
			"self_healing_events",
		];

		for (const table of tablesToAnalyze) {
			try {
				await pool.query(`ANALYZE "${table}"`);
				logger.debug(`[${JOB_NAME}] Analyzed table: ${table}`);
			} catch {
				// Non-fatal if table doesn't exist yet
			}
		}
		logger.info(`[${JOB_NAME}] Phase 5 Complete: Optimizer statistics refreshed`);

		const latencyMs = Date.now() - START_TIME;
		logger.info(`[${JOB_NAME}] Autonomous data maintenance completed successfully`, {
			event: "JOB_COMPLETE",
			job_name: JOB_NAME,
			status: "success",
			latency_ms: latencyMs,
		});

		try {
			if (pool && typeof pool.end === "function") {
				await pool.end();
			}
		} catch {
			// Non-fatal
		}

		process.exit(0);
	} catch (err) {
		const latencyMs = Date.now() - START_TIME;
		logger.error(`[${JOB_NAME}] Maintenance job failed`, {
			event: "JOB_FAILED",
			job_name: JOB_NAME,
			status: "error",
			error: err instanceof Error ? err.message : String(err),
			latency_ms: latencyMs,
		});

		try {
			const { pool } = await import("../server/db");
			if (pool && typeof pool.end === "function") {
				await pool.end();
			}
		} catch {
			// Non-fatal
		}

		process.exit(1);
	}
}

run();
