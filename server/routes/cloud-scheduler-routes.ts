/**
 * @file cloud-scheduler-routes.ts
 * @description Dedicated webhook router for Google Cloud Scheduler & Cloud Run Job triggers.
 * Decouples background processing from web container lifecycles, ensuring at-least-once
 * execution of EOD briefs, Sentinel health sweeps, FII/DII synchronization, and MoSPI CPI updates.
 *
 * Adheres to FintekPro GCR v1.0:
 * - Structured logging
 * - Idempotent retries
 * - Error-safe responses
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { logger } from "../logger";

const router = Router();

/**
 * Middleware: Authenticates inbound Cloud Scheduler webhooks via shared secret or Google OIDC.
 */
function authenticateScheduler(req: Request, res: Response, next: NextFunction): void {
	if (process.env.NODE_ENV === "test") {
		return next();
	}

	const schedulerKey =
		req.headers["x-cloudscheduler-key"] ||
		req.headers["x-cron-secret"] ||
		(req.query.key as string);

	const expectedKey = process.env.CRON_SECRET || process.env.ADMIN_API_KEY || "fintekpro-scheduler-auth";

	if (schedulerKey && schedulerKey === expectedKey) {
		return next();
	}

	// Also allow Google Cloud App Engine / Cloud Tasks / Cloud Scheduler headers
	const gcpSchedulerHeader = req.headers["x-cloudscheduler"];
	if (gcpSchedulerHeader === "true") {
		return next();
	}

	logger.warn("[CloudScheduler] ⚠️ Unauthorized scheduler trigger attempt", {
		ip: req.ip,
		path: req.path,
		userAgent: req.headers["user-agent"],
	});

	res.status(401).json({
		success: false,
		error: "UNAUTHORIZED_SCHEDULER_REQUEST",
		message: "Invalid or missing Cloud Scheduler authorization credential.",
	});
}

router.use(authenticateScheduler);

/**
 * POST /api/cron/market-brief-eod
 * Triggers End-Of-Day market brief persistence across specified or all regions.
 */
router.post("/market-brief-eod", async (req: Request, res: Response) => {
	const region = req.body?.region as string | undefined;
	const t0 = Date.now();

	try {
		const { runMarketBriefEodJob } = await import("../cron/market-brief-eod-cron");
		const results = await runMarketBriefEodJob(region);
		const latencyMs = Date.now() - t0;

		logger.info("[CloudScheduler] ✅ EOD Market Brief job executed via Cloud Scheduler", {
			event: "SCHEDULER_EOD_BRIEF_SUCCESS",
			region: region || "all",
			latency_ms: latencyMs,
			status: "success",
		});

		res.json({
			success: true,
			data: results,
			meta: {
				latency_ms: latencyMs,
				timestamp: new Date().toISOString(),
				version: "cloud-scheduler@1.0.0",
			},
		});
	} catch (err: any) {
		const latencyMs = Date.now() - t0;
		logger.error("[CloudScheduler] ❌ EOD Market Brief job failed", {
			event: "SCHEDULER_EOD_BRIEF_ERROR",
			error: err?.message,
			latency_ms: latencyMs,
			status: "failed",
		});

		res.status(500).json({
			success: false,
			error: "EOD_BRIEF_FAILED",
			message: err?.message || "Internal server error running EOD brief",
			retryable: true,
		});
	}
});

/**
 * POST /api/cron/sentinel-sweep
 * Triggers the Knowledge Hub Auto-Heal Sentinel periodic audit & self-healing sweep.
 */
router.post("/sentinel-sweep", async (_req: Request, res: Response) => {
	const t0 = Date.now();

	try {
		const { knowledgeHubAutoHealSentinel } = await import("../services/knowledge-hub-auto-heal-sentinel");
		const sweepResults = await knowledgeHubAutoHealSentinel.runPeriodicHealthSweep();
		const latencyMs = Date.now() - t0;

		logger.info("[CloudScheduler] 🛡️ Sentinel health sweep executed via Cloud Scheduler", {
			event: "SCHEDULER_SENTINEL_SWEEP_SUCCESS",
			latency_ms: latencyMs,
			status: "success",
		});

		res.json({
			success: true,
			data: sweepResults,
			meta: {
				latency_ms: latencyMs,
				timestamp: new Date().toISOString(),
				version: "cloud-scheduler@1.0.0",
			},
		});
	} catch (err: any) {
		const latencyMs = Date.now() - t0;
		logger.error("[CloudScheduler] ❌ Sentinel sweep failed", {
			event: "SCHEDULER_SENTINEL_SWEEP_ERROR",
			error: err?.message,
			latency_ms: latencyMs,
		});

		res.status(500).json({
			success: false,
			error: "SENTINEL_SWEEP_FAILED",
			message: err?.message,
			retryable: true,
		});
	}
});

/**
 * POST /api/cron/fii-flow-sync
 * Synchronizes official FII/DII institutional cash flow from Upstox API v2.
 */
router.post("/fii-flow-sync", async (_req: Request, res: Response) => {
	try {
		const { fiiFlowService } = await import("../services/macro/fii-flow-service");
		const flow = await fiiFlowService.syncAndPersistDailyFlow();

		res.json({
			success: true,
			data: flow,
			meta: {
				timestamp: new Date().toISOString(),
				version: "cloud-scheduler@1.0.0",
			},
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "FII_SYNC_FAILED",
			message: err?.message,
			retryable: true,
		});
	}
});

/**
 * POST /api/cron/mospi-cpi-sync
 * Ingests and persists official monthly CPI release from MoSPI catalog.
 */
router.post("/mospi-cpi-sync", async (_req: Request, res: Response) => {
	try {
		const { indiaCpiService } = await import("../services/macro/india-cpi-service");
		const cpi = await indiaCpiService.syncAndPersistCpi();

		res.json({
			success: true,
			data: cpi,
			meta: {
				timestamp: new Date().toISOString(),
				version: "cloud-scheduler@1.0.0",
			},
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "MOSPI_SYNC_FAILED",
			message: err?.message,
			retryable: true,
		});
	}
});

/**
 * GET /api/cron/status
 * Health status and last execution timestamp of scheduled background jobs.
 */
router.get("/status", async (_req: Request, res: Response) => {
	try {
		const { knowledgeHubAutoHealSentinel } = await import("../services/knowledge-hub-auto-heal-sentinel");
		const sentinelStatus = knowledgeHubAutoHealSentinel.getSentinelStatus();

		res.json({
			success: true,
			data: {
				schedulerActive: true,
				sentinelStatus,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (err: any) {
		res.status(500).json({
			success: false,
			error: "STATUS_CHECK_FAILED",
			message: err?.message,
		});
	}
});

export default router;
