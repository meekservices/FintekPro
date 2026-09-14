/**
 * Unified Instruments Routes — v1.0
 *
 * Provides a single discoverable catalog endpoint for all equity instruments
 * across FintekPro: Listed Stocks, Pre-IPO, Live IPOs, and Unlisted OTC.
 *
 * Every instrument appears in EXACTLY ONE stage bucket (mutual exclusivity).
 *
 * Endpoints:
 *   GET /api/instruments/unified        — paginated unified catalog
 *   GET /api/instruments/unified/stages — available stage counts (for nav badges)
 *
 * GCR v1.0: Standard API response: { success, data, meta: { timestamp, version } }
 * SEBI: Read-only discovery — no investment action taken.
 */

import { Router, Request, Response } from "express";
import {
	unifiedInstrumentsService,
	type UnifiedStage,
} from "../services/unified-instruments-service";
import { logger } from "../logger";

const router = Router();

const VALID_STAGES = new Set<string>(["all", "unlisted", "pre_ipo", "ipo", "listed"]);

// ── GET /api/instruments/unified ───────────────────────────────────────────────
/**
 * Paginated unified instrument catalog across all equity asset classes.
 *
 * Query params:
 *   stage  — "all" | "unlisted" | "pre_ipo" | "ipo" | "listed"  (default: "all")
 *   search — freetext search (name / symbol / ISIN / CIN)
 *   sector — exact sector string filter
 *   page   — 1-based page number (default: 1)
 *   limit  — items per page (default: 50, max: 200)
 *
 * Response:
 *   { success: true, data: UnifiedInstrument[], meta: { total, page, limit, timestamp, version } }
 */
router.get("/unified", async (req: Request, res: Response) => {
	try {
		const {
			stage = "all",
			search,
			sector,
			page: pageStr = "1",
			limit: limitStr = "50",
		} = req.query as Record<string, string>;

		// Validate stage param
		if (!VALID_STAGES.has(stage)) {
			return res.status(400).json({
				success: false,
				data: null,
				meta: {
					timestamp: new Date().toISOString(),
					version: "1.0",
				},
				error: {
					error_code: "INVALID_STAGE",
					message: `stage must be one of: ${Array.from(VALID_STAGES).join(", ")}`,
					retryable: false,
				},
			});
		}

		const page = Math.max(1, parseInt(pageStr, 10) || 1);
		const limit = Math.min(200, Math.max(1, parseInt(limitStr, 10) || 50));

		const result = await unifiedInstrumentsService.getUnifiedInstruments({
			stage: stage as UnifiedStage | "all",
			search: search?.trim() || undefined,
			sector: sector?.trim() || undefined,
			page,
			limit,
		});

		return res.json({
			success: true,
			data: result.instruments,
			meta: {
				total: result.total,
				page: result.page,
				limit: result.limit,
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (err: any) {
		logger.error("[UnifiedInstrumentsRoutes] GET /unified error", {
			event: "UNIFIED_INSTRUMENTS_ROUTE_ERROR",
			user_id: (req as any).user?.id ?? "anonymous",
			latency_ms: 0,
			status: "error",
			error: err?.message,
		});
		return res.status(500).json({
			success: false,
			data: null,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
			error: {
				error_code: "INTERNAL_ERROR",
				message: "Failed to fetch unified instruments",
				retryable: true,
			},
		});
	}
});

// ── GET /api/instruments/unified/stages ────────────────────────────────────────
/**
 * Returns per-stage counts for all four asset classes.
 * Used by navigation tabs and discovery badges to show live counts without
 * fetching full instrument lists.
 *
 * Response:
 *   { success: true, data: { unlisted: n, pre_ipo: n, ipo: n, listed: n, all: n } }
 */
router.get("/unified/stages", async (req: Request, res: Response) => {
	try {
		const [unlistedResult, preIpoResult, ipoResult, listedResult] = await Promise.all([
			unifiedInstrumentsService.getUnifiedInstruments({ stage: "unlisted", limit: 1 }),
			unifiedInstrumentsService.getUnifiedInstruments({ stage: "pre_ipo", limit: 1 }),
			unifiedInstrumentsService.getUnifiedInstruments({ stage: "ipo", limit: 1 }),
			unifiedInstrumentsService.getUnifiedInstruments({ stage: "listed", limit: 1 }),
		]);

		const counts = {
			unlisted: unlistedResult.total,
			pre_ipo: preIpoResult.total,
			ipo: ipoResult.total,
			listed: listedResult.total,
			all:
				unlistedResult.total +
				preIpoResult.total +
				ipoResult.total +
				listedResult.total,
		};

		return res.json({
			success: true,
			data: counts,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
		});
	} catch (err: any) {
		return res.status(500).json({
			success: false,
			data: null,
			meta: { timestamp: new Date().toISOString(), version: "1.0" },
			error: {
				error_code: "INTERNAL_ERROR",
				message: "Failed to fetch stage counts",
				retryable: true,
			},
		});
	}
});

export default router;
