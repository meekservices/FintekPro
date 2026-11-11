/**
 * Admin Data Sufficiency & Quality Assurance Routes
 *
 * Endpoints for monitoring data completeness, surfacing regulatory alerts,
 * and triggering immediate background enrichments for data gaps.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 */

import { Router, Request, Response } from "express";
import { dataSufficiencyEngine } from "../services/data-sufficiency-engine";
import { logger } from "../logger";

export const adminDataSufficiencyRouter = Router();

/**
 * GET /api/admin/data-sufficiency/status
 * Real-time sufficiency statistics, coverage rates, and active warnings
 */
adminDataSufficiencyRouter.get("/status", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const forceRefresh = req.query.force === "true";
		const stats = await dataSufficiencyEngine.getUniverseSufficiencyStats(forceRefresh);

		logger.info("Admin data sufficiency stats requested", {
			event: "ADMIN_DATA_SUFFICIENCY_VIEWED",
			latency_ms: Date.now() - startTime,
			status: "success",
		});

		return res.json({
			success: true,
			data: stats,
			meta: {
				timestamp: new Date().toISOString(),
				version: stats.engineVersion,
			},
		});
	} catch (error: any) {
		logger.error("Error retrieving data sufficiency status:", error);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "DATA_SUFFICIENCY_ERROR",
				message: error.message || "Failed to retrieve data sufficiency status.",
				retryable: true,
			},
		});
	}
});

/**
 * GET /api/admin/data-sufficiency/stocks
 * Paginated list of stocks flagged for data gaps or staleness
 */
adminDataSufficiencyRouter.get("/stocks", async (req: Request, res: Response) => {
	try {
		const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
		const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
		const search = req.query.search as string | undefined;

		const result = await dataSufficiencyEngine.getInsufficientStocks({
			limit,
			offset,
			search,
		});

		return res.json({
			success: true,
			data: result.stocks,
			pagination: {
				total: result.total,
				limit: result.limit,
				offset: result.offset,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	} catch (error: any) {
		logger.error("Error retrieving insufficient stocks:", error);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "INSUFFICIENT_STOCKS_FETCH_ERROR",
				message: error.message || "Failed to retrieve insufficient stocks list.",
				retryable: true,
			},
		});
	}
});

/**
 * POST /api/admin/data-sufficiency/trigger-enrichment
 * Admin-triggered or automated job to backfill missing ratios, filings, and prices
 */
adminDataSufficiencyRouter.post("/trigger-enrichment", async (req: Request, res: Response) => {
	try {
		const result = await dataSufficiencyEngine.triggerSelfHealing();

		return res.json({
			success: true,
			data: {
				message: result.message,
				status: result.triggered ? "RUNNING" : "HEALTHY",
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0.0",
			},
		});
	} catch (error: any) {
		logger.error("Error triggering data enrichment:", error);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "TRIGGER_ENRICHMENT_FAILED",
				message: error.message || "Failed to trigger enrichment job.",
				retryable: false,
			},
		});
	}
});

