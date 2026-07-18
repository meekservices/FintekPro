#!/usr/bin/env ts-node
/**
 * Cloud Run Job: fintekpro-enrichment
 *
 * Entrypoint for stock and MF data enrichment as a Cloud Run Job.
 * Triggered by Cloud Scheduler: `30 2 * * *` IST (2:30 AM daily, after NAV sync).
 *
 * Replaces Phase 3 (dataEnrichmentScheduler + financialDataScheduler)
 * from background-schedulers.ts.
 *
 * Deploy:
 *   gcloud run jobs create fintekpro-enrichment \
 *     --image gcr.io/fintekpro/fintekpro-app:latest \
 *     --command "node" \
 *     --args "dist/jobs/enrichment.js" \
 *     --region asia-south1 \
 *     --project fintekpro \
 *     --set-secrets DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest,INDIAN_API_KEY=INDIAN_API_KEY:latest \
 *     --vpc-connector fintekpro-vpc-connector \
 *     --max-retries 2 \
 *     --task-timeout 3600s \
 *     --memory 2Gi
 *
 * @module jobs/enrichment
 */

import { logger } from "../server/logger";

const JOB_NAME = "fintekpro-enrichment";
const VERSION = "1.0.0";
const START_TIME = Date.now();

async function run(): Promise<void> {
	logger.info(`[${JOB_NAME}] Starting data enrichment job`, {
		event: "JOB_START",
		job_name: JOB_NAME,
		version: VERSION,
		timestamp: new Date().toISOString(),
	});

	try {
		// Phase A: Stock data enrichment (IndianAPI + Finnhub)
		logger.info(`[${JOB_NAME}] Phase A: Stock/financial data enrichment`);
		try {
			const { dataEnrichmentScheduler } = await import(
				"../server/services/data-enrichment-scheduler"
			);
			await dataEnrichmentScheduler.runEnrichmentJobs();
			logger.info(`[${JOB_NAME}] Phase A complete`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase A failed (non-fatal)`, { error: String(err) });
		}

		// Phase B: Financial metrics enrichment (PE, PB, ROE etc.)
		// Note: financialDataScheduler.start() creates a cron loop — not suitable for one-shot jobs.
		// Its data (FMP ratios/returns) is already covered by Phase A (dataEnrichmentScheduler)
		// so this phase is intentionally skipped in one-shot mode.
		logger.info(`[${JOB_NAME}] Phase B: Skipped (financialDataScheduler is cron-loop-only; covered by Phase A)`);

		// Phase C: MF comprehensive enrichment (ratings, returns, metrics)
		logger.info(`[${JOB_NAME}] Phase C: MF comprehensive enrichment`);
		try {
			const { runComprehensiveEnrichment } = await import(
				"../server/services/mf-comprehensive-enrichment-service"
			);
			await runComprehensiveEnrichment();
			logger.info(`[${JOB_NAME}] Phase C complete`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase C failed (non-fatal)`, { error: String(err) });
		}

		// Phase D: IRIS KFintech instrument seeding
		//   D1 — Fixed Deposit product catalog (GET /user/fixed-deposit/products)
		//   D2 — NPS fund options            (GET /user/nps/links)
		//   D3 — PMS + AIF catalog           (GET /pms/links + /aif/links)
		//   D4 — MF portfolio-holdings       (GET /sif/schemes/{code}/portfolio-holdings)
		//   D5 — MF factsheet enrichment     (GET /sif/schemes/{code}/factsheet)
		// All sub-jobs are independently non-fatal; skipped if IRIS_USERNAME not configured.
		logger.info(`[${JOB_NAME}] Phase D: IRIS instrument seeding (FD / NPS / PMS+AIF / MF enrichment)`);
		try {
			const { runAllSeedingJobs } = await import(
				"../server/services/iris-instrument-seeding-service"
			);
			await runAllSeedingJobs();
			logger.info(`[${JOB_NAME}] Phase D complete`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase D failed (non-fatal)`, { error: String(err) });
		}

		const latencyMs = Date.now() - START_TIME;
		logger.info(`[${JOB_NAME}] Job completed successfully`, {
			event: "JOB_COMPLETE",
			job_name: JOB_NAME,
			status: "success",
			latency_ms: latencyMs,
		});
		process.exit(0);

	} catch (err) {
		const latencyMs = Date.now() - START_TIME;
		logger.error(`[${JOB_NAME}] Job failed`, {
			event: "JOB_FAILED",
			job_name: JOB_NAME,
			status: "error",
			error: String(err),
			latency_ms: latencyMs,
			retryable: true,
		});
		process.exit(1);
	}
}

run();
