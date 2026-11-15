#!/usr/bin/env ts-node
/**
 * Cloud Run Job & Scheduled Worker: fintekpro-regulatory-sync
 *
 * Autonomous Regulatory Ingestion and Amendment Staging Worker.
 * Triggered by Cloud Scheduler / cron: every 4 hours.
 *
 * Responsibilities:
 * 1. Polls official gazette & circular feeds:
 *    - CBDT (Income Tax notifications, cost inflation index, circulars)
 *    - SEBI (Master circulars, scheme categorization, F&O lot sizes, PIT)
 *    - MCA (Companies Act rules, DIN verification windows, ROC notifications)
 *    - IRS (Revenue Procedures, annual inflation adjustments, FATCA/FBAR)
 *    - RBI (Digital lending guidelines, FEMA circulars)
 * 2. Runs automated regression testing on staged amendment diffs.
 * 3. Alerts compliance officers and CAs for review & one-click promotion.
 *
 * Deploy:
 *   gcloud run jobs create fintekpro-regulatory-sync \
 *     --image gcr.io/fintekpro/fintekpro-app:latest \
 *     --command "node" \
 *     --args "dist/jobs/regulatory-sync.js" \
 *     --region asia-south1 \
 *     --project fintekpro
 *
 * @module jobs/regulatory-sync
 */

import { logger } from "../server/logger";
import { regulatoryIngestionService } from "../server/services/regulatory-ingestion-service";

const JOB_NAME = "fintekpro-regulatory-sync";
const VERSION = "1.0.0";
const START_TIME = Date.now();

export async function run(): Promise<void> {
  logger.info(`[${JOB_NAME}] Starting autonomous regulatory sync cycle`, {
    event: "REGULATORY_JOB_START",
    job_name: JOB_NAME,
    version: VERSION,
    timestamp: new Date().toISOString(),
  });

  try {
    const result = await regulatoryIngestionService.pollAllRegulators();

    logger.info(`[${JOB_NAME}] Autonomous regulatory sync completed successfully`, {
      event: "REGULATORY_JOB_COMPLETE",
      job_name: JOB_NAME,
      version: VERSION,
      duration_ms: Date.now() - START_TIME,
      sources_scanned: result.sourcesScanned,
      new_amendments: result.newAmendmentsDiscovered,
      regression_tests_executed: result.regressionTestsExecuted,
      regression_tests_passed: result.regressionTestsPassed,
    });
    process.exit(0);
  } catch (error: any) {
    logger.error(`[${JOB_NAME}] Autonomous regulatory sync failed`, {
      event: "REGULATORY_JOB_ERROR",
      job_name: JOB_NAME,
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

run();
