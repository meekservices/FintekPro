#!/usr/bin/env ts-node
/**
 * Cloud Run Job: fintekpro-nav-sync
 *
 * Entrypoint for NAV sync as a Cloud Run Job.
 * Triggered by Cloud Scheduler: `30 15 * * 1-5` IST (3:30 PM after market close).
 *
 * This job replaces Phase 3 (mfSyncScheduler + amfiNavScheduler) from
 * background-schedulers.ts. Running as a Cloud Run Job means:
 *   - Zero CPU contention with live HTTP requests on fintekpro-app
 *   - Automatic retries handled by Cloud Run Jobs (max 3)
 *   - Logs visible separately in Cloud Logging with job_name label
 *
 * Deploy:
 *   gcloud run jobs create fintekpro-nav-sync \
 *     --image gcr.io/fintekpro/fintekpro-app:latest \
 *     --command "node" \
 *     --args "dist/jobs/nav-sync.js" \
 *     --region asia-south1 \
 *     --project fintekpro \
 *     --set-secrets DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest \
 *     --vpc-connector fintekpro-vpc-connector \
 *     --max-retries 3 \
 *     --task-timeout 1800s
 *
 * Schedule:
 *   gcloud scheduler jobs create http fintekpro-nav-sync-trigger \
 *     --schedule "30 10 * * 1-5" \
 *     --uri "https://run.googleapis.com/apis/run.googleapis.com/v1/namespaces/fintekpro/jobs/fintekpro-nav-sync:run" \
 *     --oauth-service-account-email fintekpro-jobs@fintekpro.iam.gserviceaccount.com \
 *     --location asia-south1
 *
 * @module jobs/nav-sync
 */

import { logger } from "../server/logger";

const JOB_NAME = "fintekpro-nav-sync";
const VERSION = "1.0.0";
const START_TIME = Date.now();

async function run(): Promise<void> {
	logger.info(`[${JOB_NAME}] Starting NAV sync job`, {
		event: "JOB_START",
		job_name: JOB_NAME,
		version: VERSION,
		timestamp: new Date().toISOString(),
	});

	try {
		// Phase A: Mutual Fund NAV sync (AMFI)
		logger.info(`[${JOB_NAME}] Phase A: AMFI NAV sync`);
		try {
			const { amfiNavScheduler } = await import("../server/services/amfi-nav-scheduler");
			await amfiNavScheduler.runAMFIMasterSync();
			logger.info(`[${JOB_NAME}] Phase A complete: AMFI NAV sync`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase A failed (non-fatal)`, { error: String(err) });
		}

		// Phase B: MF sync (scheme metadata, portfolio linkage)
		logger.info(`[${JOB_NAME}] Phase B: MF scheme sync`);
		try {
			const { mfSyncScheduler } = await import("../server/services/mf-sync-scheduler");
			await mfSyncScheduler.runAMFIMasterSync();
			logger.info(`[${JOB_NAME}] Phase B complete: MF sync`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase B failed (non-fatal)`, { error: String(err) });
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
		logger.error(`[${JOB_NAME}] Job failed with unhandled error`, {
			event: "JOB_FAILED",
			job_name: JOB_NAME,
			status: "error",
			error: String(err),
			latency_ms: latencyMs,
			retryable: true,
		});
		process.exit(1); // Cloud Run Jobs will retry on non-zero exit
	}
}

run();
