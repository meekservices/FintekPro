#!/usr/bin/env ts-node
/**
 * Cloud Run Job: fintekpro-picks
 *
 * Entrypoint for daily investment recommendations (Pick of the Day) as a Cloud Run Job.
 * Triggered by Cloud Scheduler: `15 3 * * 1-5` UTC (08:45 AM IST Mon-Fri).
 *
 * Runs deterministic candidate evaluation across 11 asset classes:
 * - Stocks, Mutual Funds, Unlisted & Pre-IPO, Bonds, REITs/InvITs, ETFs, Global Stocks
 * - Real-time Google Search grounding check via Gemini (Phase 2)
 * - GCS PDF 1-Pager creation & FCM Push Broadcast (Phase 3)
 * - In-memory Redis cache warmup for sub-20ms market open load times
 *
 * Deploy:
 *   gcloud run jobs create fintekpro-picks \
 *     --image asia-south1-docker.pkg.dev/fintekpro/fintekpro-repo/fintekpro-app:latest \
 *     --command "node" \
 *     --args "dist/jobs/picks.js" \
 *     --region asia-south1 \
 *     --project fintekpro \
 *     --set-secrets DATABASE_URL=DATABASE_URL:latest,PRODUCTION_DATABASE_URL=PRODUCTION_DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest \
 *     --vpc-connector fintekpro-vpc-connector \
 *     --vpc-egress all \
 *     --add-cloudsql-instances fintekpro:asia-south1:fintekpro-db \
 *     --max-retries 1 \
 *     --task-timeout 600s
 *
 * @module jobs/picks
 */

import { logger } from "../server/logger";

const JOB_NAME = "fintekpro-picks";
const VERSION = "1.0.0";
const START_TIME = Date.now();

async function run(): Promise<void> {
	logger.info(`[${JOB_NAME}] Starting daily pick generation job`, {
		event: "JOB_START",
		job_name: JOB_NAME,
		version: VERSION,
		timestamp: new Date().toISOString(),
	});

	try {
		// Import service dynamically to ensure clean process boot
		const { pickOfTheDayService } = await import(
			"../server/services/pick-of-the-day-service"
		);

		logger.info(`[${JOB_NAME}] Invoking generateDailyPicks() across multi-asset universe...`);
		const picks = await pickOfTheDayService.generateDailyPicks();

		const latencyMs = Date.now() - START_TIME;
		logger.info(`[${JOB_NAME}] Pick generation job completed successfully`, {
			event: "JOB_COMPLETE",
			job_name: JOB_NAME,
			status: "success",
			picks_count: picks?.length ?? 0,
			latency_ms: latencyMs,
		});

		// Tear down database pool so the container process exits immediately without hanging
		try {
			const { pool } = await import("../server/db");
			if (pool && typeof pool.end === "function") {
				await pool.end();
			}
		} catch {
			// Non-fatal pool teardown
		}

		process.exit(0);
	} catch (err) {
		const latencyMs = Date.now() - START_TIME;
		logger.error(`[${JOB_NAME}] Job failed with error`, {
			event: "JOB_FAILED",
			job_name: JOB_NAME,
			status: "error",
			error: err instanceof Error ? err.message : String(err),
			latency_ms: latencyMs,
			retryable: false,
		});

		try {
			const { pool } = await import("../server/db");
			if (pool && typeof pool.end === "function") {
				await pool.end();
			}
		} catch {
			// Non-fatal pool teardown
		}

		process.exit(1);
	}
}

run();
