/**
 * Parser Admin Routes
 *
 * Admin endpoints for controlling Unified PDF Parser configuration:
 * - View parser stats and cache
 * - Enable/disable learning mode
 * - Set confidence threshold
 * - Clear caches
 */

import { Router } from "express";
import { unifiedPDFParser } from "../services/unified-pdf-parser";

const router = Router();

router.get("/config", (req, res) => {
	try {
		const cacheStats = unifiedPDFParser.getProfileCacheStats();
		const metrics = unifiedPDFParser.getParsingMetrics(24);
		const config = unifiedPDFParser.getConfig();

		res.json({
			success: true,
			config,
			cache: cacheStats,
			metrics: {
				last24Hours: metrics,
			},
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

router.post("/config", (req, res) => {
	try {
		if (typeof req.body.enableLearning === "boolean") {
			unifiedPDFParser.setLearningEnabled(req.body.enableLearning);
		}

		if (typeof req.body.minConfidenceThreshold === "number") {
			unifiedPDFParser.setMinConfidenceThreshold(
				req.body.minConfidenceThreshold,
			);
		}

		res.json({
			success: true,
			message: "Parser configuration updated",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

router.post("/cache/clear", (req, res) => {
	try {
		const { type } = req.body;

		if (type === "profile" || type === "all") {
			unifiedPDFParser.clearProfileCache();
		}

		if (type === "all") {
			unifiedPDFParser.clearParseCache();
		}

		res.json({
			success: true,
			message: `Cache${type === "all" ? "s" : ""} cleared successfully`,
			cacheStats: unifiedPDFParser.getProfileCacheStats(),
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

router.get("/stats", (req, res) => {
	try {
		const hours = Number.parseInt(req.query.hours as string) || 24;
		const metrics = unifiedPDFParser.getParsingMetrics(hours);
		const cacheStats = unifiedPDFParser.getProfileCacheStats();

		res.json({
			success: true,
			metrics,
			cache: cacheStats,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

router.get("/errors", (req, res) => {
	try {
		const limit = Number.parseInt(req.query.limit as string) || 20;
		const errors = unifiedPDFParser.getErrorSummary(limit);

		res.json({
			success: true,
			errors,
			count: errors.length,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message,
		});
	}
});

export default router;
