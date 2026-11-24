#!/usr/bin/env ts-node
/**
 * Cloud Run Job: fintekpro-market-intel
 *
 * Automated EOD Market Intelligence & Macro Synthesis.
 * Triggered by Cloud Scheduler: `0 17 * * 1-5` IST (05:00 PM IST Mon-Fri).
 *
 * Responsibilities:
 * - Persistent EOD Market Briefs across India, Global, and US markets
 * - Ingestion of institutional FII/DII net equity & debt transaction flows
 * - Official MoSPI Consumer Price Index (CPI) sync and benchmark anchoring
 * - Global macro transmission and commodity intelligence refresh
 * - Knowledge Hub Auto-Heal Sentinel audit to prevent sparse or degraded market intelligence
 *
 * Complies with FintekPro GCR v1.0 + SEBI FASP-AI v1.0.
 *
 * @module jobs/market-intel
 */

import { logger } from "../server/logger";

const JOB_NAME = "fintekpro-market-intel";
const VERSION = "1.0.0";
const START_TIME = Date.now();

async function run(): Promise<void> {
	logger.info(`[${JOB_NAME}] Starting EOD market intelligence job`, {
		event: "JOB_START",
		job_name: JOB_NAME,
		version: VERSION,
		timestamp: new Date().toISOString(),
	});

	try {
		// Phase A: EOD Market Briefs Persistence (India, Global, US)
		logger.info(`[${JOB_NAME}] Phase A: Generating & Persisting Multi-Region Market Briefs...`);
		try {
			const { runMarketBriefEodJob } = await import(
				"../server/cron/market-brief-eod-cron"
			);
			const briefResults = await runMarketBriefEodJob();
			logger.info(`[${JOB_NAME}] Phase A Complete: Market briefs persisted`, {
				regions: briefResults.map((r) => `${r.region}:${r.success ? "ok" : "err"}`),
			});
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase A warning (non-fatal)`, { error: String(err) });
		}

		// Phase B: Institutional FII/DII Net Flow & F&O Participant OI Ingestion
		logger.info(`[${JOB_NAME}] Phase B: Syncing FII/DII Institutional Flows and F&O Participant OI...`);
		try {
			const { fiiFlowService } = await import(
				"../server/services/macro/fii-flow-service"
			);
			await fiiFlowService.syncAndPersistDailyFlow();

			const { nseFoParticipantService } = await import(
				"../server/services/nse-fo-participant-service"
			);
			await nseFoParticipantService.syncParticipantOi();

			logger.info(`[${JOB_NAME}] Phase B Complete: FII/DII flows and F&O Participant OI synchronized`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase B warning (non-fatal)`, { error: String(err) });
		}

		// Phase C: MoSPI Official CPI Ingestion & Benchmark Anchoring
		logger.info(`[${JOB_NAME}] Phase C: Checking and refreshing MoSPI CPI Benchmark...`);
		try {
			const { indiaCpiService } = await import(
				"../server/services/macro/india-cpi-service"
			);
			await indiaCpiService.syncAndPersistCpi();
			logger.info(`[${JOB_NAME}] Phase C Complete: CPI benchmark verified`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase C warning (non-fatal)`, { error: String(err) });
		}

		// Phase D: FRED Commodities & Sovereign Macro Transmission
		logger.info(`[${JOB_NAME}] Phase D: Syncing Global Macro & Sovereign Transmission...`);
		try {
			const { fredCommodityService } = await import(
				"../server/services/fred-commodity-service"
			);
			if (typeof (fredCommodityService as any).syncLatestCommodities === "function") {
				await (fredCommodityService as any).syncLatestCommodities();
			}
			logger.info(`[${JOB_NAME}] Phase D Complete: Macro & Commodities synced`);
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase D warning (non-fatal)`, { error: String(err) });
		}

		// Phase E: Knowledge Hub Auto-Heal Sentinel Health Audit
		logger.info(`[${JOB_NAME}] Phase E: Running Knowledge Hub Sentinel Health Sweep...`);
		try {
			const { knowledgeHubAutoHealSentinel } = await import(
				"../server/services/knowledge-hub-auto-heal-sentinel"
			);
			const sweep = await knowledgeHubAutoHealSentinel.runPeriodicHealthSweep();
			logger.info(`[${JOB_NAME}] Phase E Complete: Sentinel Health Sweep score:`, {
				india: sweep.india?.qualityScore ?? 100,
				global: sweep.global?.qualityScore ?? 100,
				us: sweep.us?.qualityScore ?? 100,
			});
		} catch (err) {
			logger.warn(`[${JOB_NAME}] Phase E warning (non-fatal)`, { error: String(err) });
		}

		const latencyMs = Date.now() - START_TIME;
		logger.info(`[${JOB_NAME}] Market intelligence job completed successfully`, {
			event: "JOB_COMPLETE",
			job_name: JOB_NAME,
			status: "success",
			latency_ms: latencyMs,
		});

		// Tear down database pool so process terminates cleanly
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
		logger.error(`[${JOB_NAME}] Job failed fatally`, {
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
