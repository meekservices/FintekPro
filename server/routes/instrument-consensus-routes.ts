/**
 * @module instrument-consensus-routes
 * @description API routes for Unified Instrument Consensus Service (UICS)
 * and Adverse Signal Quarantine Bus (ASQB).
 *
 * Architecture: GCR v1.0 + FASP-AI v1.0
 * Zero Redis cost — backed by Cloud SQL PostgreSQL and in-process LRU cache.
 */

import { Router, Request, Response } from "express";
import {
	unifiedInstrumentConsensusService,
	CONSENSUS_ENGINE_VERSION,
} from "../services/unified-instrument-consensus-service";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import { z } from "zod";
import { logger } from "../logger";

const router = Router();

const overrideSchema = z.object({
	symbol: z.string().min(1).max(50),
	reason: z.string().min(5).max(500),
	durationHours: z.number().int().min(1).max(168).optional(), // 1h to 7 days
});

const liftSchema = z.object({
	symbol: z.string().min(1).max(50),
	reason: z.string().min(3).max(500),
});

/**
 * GET /api/consensus/status/:symbol
 * Public & Desk check: Returns the unified consensus rating, composite score,
 * and whether a BUY recommendation is currently permitted.
 */
router.get("/status/:symbol", async (req: Request, res: Response) => {
	const symbol = (req.params.symbol || "").trim().toUpperCase();
	if (!symbol) {
		return res.status(400).json({
			success: false,
			error_code: "INVALID_SYMBOL",
			message: "Symbol parameter is required",
		});
	}

	try {
		const [consensus, buyCheck] = await Promise.all([
			unifiedInstrumentConsensusService.getConsensus(symbol),
			unifiedInstrumentConsensusService.isBuyAllowed(symbol),
		]);

		return res.json({
			success: true,
			data: {
				symbol,
				isBuyAllowed: buyCheck.allowed,
				consensusStatus: buyCheck.consensusStatus,
				primaryRating: buyCheck.primaryRating ?? consensus?.primaryRating ?? "HOLD",
				compositeScore: buyCheck.compositeScore ?? (consensus?.compositeScore ? Number(consensus.compositeScore) : 50),
				rejectionReason: buyCheck.reason ?? null,
				quarantinedUntil: consensus?.quarantinedUntil ?? null,
				driftDetected: consensus?.driftDetected ?? false,
				driftSpread: consensus?.driftSpread ? Number(consensus.driftSpread) : 0,
				manualOverride: consensus?.manualOverride ?? false,
				engineRatings: consensus?.engineRatings ?? {},
			},
			meta: {
				version: CONSENSUS_ENGINE_VERSION,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (err: unknown) {
		logger.error("[API/Consensus] Error fetching consensus status:", {
			symbol,
			error: err instanceof Error ? err.message : String(err),
		});
		return res.status(500).json({
			success: false,
			error_code: "CONSENSUS_FETCH_FAILED",
			message: "Failed to fetch instrument consensus status",
			retryable: true,
		});
	}
});

/**
 * GET /api/consensus/quarantined
 * Oversight endpoint: Returns all currently quarantined instruments.
 */
router.get("/quarantined", async (req: Request, res: Response) => {
	const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
	const offset = (page - 1) * limit;

	try {
		const quarantined = await unifiedInstrumentConsensusService.listQuarantined(limit, offset);

		return res.json({
			success: true,
			data: quarantined.map((q) => ({
				symbol: q.symbol,
				isin: q.isin,
				instrumentName: q.instrumentName,
				consensusStatus: q.consensusStatus,
				primaryRating: q.primaryRating,
				compositeScore: q.compositeScore ? Number(q.compositeScore) : null,
				quarantineReason: q.quarantineReason,
				quarantinedByEngine: q.quarantinedByEngine,
				quarantinedUntil: q.quarantinedUntil,
				manualOverride: q.manualOverride,
				updatedAt: q.updatedAt,
			})),
			meta: {
				page,
				limit,
				total: quarantined.length,
				version: CONSENSUS_ENGINE_VERSION,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (err: unknown) {
		logger.error("[API/Consensus] Error listing quarantined instruments:", {
			error: err instanceof Error ? err.message : String(err),
		});
		return res.status(500).json({
			success: false,
			error_code: "QUARANTINE_LIST_FAILED",
			message: "Failed to list quarantined instruments",
			retryable: true,
		});
	}
});

/**
 * GET /api/consensus/drift-alerts
 * Oversight endpoint: Returns instruments with detected cross-engine score drift.
 */
router.get("/drift-alerts", async (req: Request, res: Response) => {
	const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
	const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
	const offset = (page - 1) * limit;

	try {
		const alerts = await unifiedInstrumentConsensusService.listDriftAlerts(limit, offset);

		return res.json({
			success: true,
			data: alerts.map((a) => ({
				symbol: a.symbol,
				instrumentName: a.instrumentName,
				driftSpread: a.driftSpread ? Number(a.driftSpread) : 0,
				primaryRating: a.primaryRating,
				compositeScore: a.compositeScore ? Number(a.compositeScore) : null,
				engineRatings: a.engineRatings,
				updatedAt: a.updatedAt,
			})),
			meta: {
				page,
				limit,
				total: alerts.length,
				version: CONSENSUS_ENGINE_VERSION,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (err: unknown) {
		logger.error("[API/Consensus] Error listing drift alerts:", {
			error: err instanceof Error ? err.message : String(err),
		});
		return res.status(500).json({
			success: false,
			error_code: "DRIFT_LIST_FAILED",
			message: "Failed to list drift alerts",
			retryable: true,
		});
	}
});

/**
 * POST /api/consensus/override
 * Certified Advisor (SEBI RIA / CA) action: Overrides adverse quarantine.
 */
router.post("/override", requireAuth, async (req: Request, res: Response) => {
	const parsed = overrideSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error_code: "VALIDATION_ERROR",
			message: "Invalid override request parameters",
			details: parsed.error.format(),
		});
	}

	const userId = String((req as any).user?.id || "advisor");
	const ok = await unifiedInstrumentConsensusService.applyManualOverride({
		symbol: parsed.data.symbol,
		userId,
		reason: parsed.data.reason,
		durationHours: parsed.data.durationHours,
	});

	if (!ok) {
		return res.status(500).json({
			success: false,
			error_code: "OVERRIDE_FAILED",
			message: "Failed to record manual override in consensus store",
		});
	}

	return res.json({
		success: true,
		message: `Manual RIA override applied for ${parsed.data.symbol.toUpperCase()}`,
		meta: {
			symbol: parsed.data.symbol.toUpperCase(),
			userId,
			version: CONSENSUS_ENGINE_VERSION,
			timestamp: new Date().toISOString(),
		},
	});
});

/**
 * POST /api/consensus/lift
 * Admin / Compliance action: Lifts adverse quarantine.
 */
router.post("/lift", requireAuth, requireAdmin, async (req: Request, res: Response) => {
	const parsed = liftSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error_code: "VALIDATION_ERROR",
			message: "Invalid lift request parameters",
		});
	}

	const ok = await unifiedInstrumentConsensusService.liftQuarantine(
		parsed.data.symbol,
		parsed.data.reason,
	);

	if (!ok) {
		return res.status(500).json({
			success: false,
			error_code: "LIFT_FAILED",
			message: "Failed to lift quarantine in consensus store",
		});
	}

	return res.json({
		success: true,
		message: `Quarantine lifted for ${parsed.data.symbol.toUpperCase()}`,
		meta: {
			symbol: parsed.data.symbol.toUpperCase(),
			version: CONSENSUS_ENGINE_VERSION,
			timestamp: new Date().toISOString(),
		},
	});
});

export default router;
