#!/usr/bin/env ts-node
/**
 * Cloud Run Job: fintekpro-compliance
 *
 * Entrypoint for compliance monitoring as a Cloud Run Job.
 * Triggered by Cloud Scheduler: `0 6 * * *` IST (6 AM daily).
 *
 * Replaces Phase 2 (KYC Expiry Monitor + LRS/TCS Monitor)
 * from background-schedulers.ts.
 *
 * Deploy:
 *   gcloud run jobs create fintekpro-compliance \
 *     --image gcr.io/fintekpro/fintekpro-app:latest \
 *     --command "node" \
 *     --args "dist/jobs/compliance.js" \
 *     --region asia-south1 \
 *     --project fintekpro \
 *     --set-secrets DATABASE_URL=DATABASE_URL:latest,REDIS_URL=REDIS_URL:latest \
 *     --vpc-connector fintekpro-vpc-connector \
 *     --max-retries 3 \
 *     --task-timeout 1800s
 *
 * @module jobs/compliance
 */

import { logger } from "../server/logger";

const JOB_NAME = "fintekpro-compliance";
const VERSION = "1.0.0";
const START_TIME = Date.now();

async function run(): Promise<void> {
	logger.info(`[${JOB_NAME}] Starting compliance monitoring job`, {
		event: "JOB_START",
		job_name: JOB_NAME,
		version: VERSION,
		timestamp: new Date().toISOString(),
	});

	try {
		// Phase A: KYC expiry checks
		logger.info(`[${JOB_NAME}] Phase A: KYC expiry monitoring`);
		try {
			const { kycExpiryMonitor } = await import(
				"../server/services/kyc-expiry-monitor"
			);
			await kycExpiryMonitor.runCheck();
			logger.info(`[${JOB_NAME}] Phase A complete: KYC expiry checks`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase A failed (non-fatal)`, { error: String(err) });
		}

		// Phase B: LRS/TCS compliance scans
		logger.info(`[${JOB_NAME}] Phase B: LRS/TCS monitoring`);
		try {
			const { kycLrsMonitorService } = await import(
				"../server/services/kyc-lrs-monitor-service"
			);
			await kycLrsMonitorService.runMonitoringCycle();
			logger.info(`[${JOB_NAME}] Phase B complete: LRS/TCS monitoring`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase B failed (non-fatal)`, { error: String(err) });
		}

		// Phase C: Audit log cleanup
		logger.info(`[${JOB_NAME}] Phase C: Audit cleanup`);
		try {
			const { unlistedRegulatoryAuditService } = await import(
				"../server/services/unlisted-regulatory-audit-service"
			);
			await unlistedRegulatoryAuditService.cleanupExpiredRecords(false);
			logger.info(`[${JOB_NAME}] Phase C complete: Audit cleanup`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase C failed (non-fatal)`, { error: String(err) });
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
