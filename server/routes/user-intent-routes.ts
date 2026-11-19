/**
 * User Intent & Predictive Pre-Warming Routes
 *
 * Compliance: FintekPro GCR v1.0, FASP-AI v1.0, DPDP Act 2023 (Section 6)
 *
 * Endpoints:
 *   POST /api/user-intent/signal         - Non-blocking ingestion of user intent signals
 *   GET  /api/user-intent/prewarmed      - Instant retrieval of pre-warmed context
 *   GET  /api/user-intent/health         - Service health and status
 *
 * @version 1.0.0
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { userIntentPrewarmEngine, USER_INTENT_ENGINE_VERSION } from "../services/user-intent-prewarm-engine";
import { logger } from "../logger";

export const userIntentRouter = Router();

const intentSignalSchema = z.object({
	intentType: z.enum([
		"SESSION_INITIALIZED",
		"INSTRUMENT_FOCUS",
		"PORTFOLIO_DRIFT_SCAN",
		"TAX_HARVEST_INTENT",
		"WATCHLIST_INTERACTION",
	]),
	symbol: z.string().trim().max(20).optional(),
	isin: z.string().trim().max(12).optional(),
	assetClass: z.string().trim().max(30).optional(),
	consentGranted: z.boolean().optional().default(true),
});

/**
 * POST /api/user-intent/signal
 * Non-blocking ingestion of user intent triggers.
 */
userIntentRouter.post("/signal", (req: Request, res: Response) => {
	const startTime = Date.now();
	const userId = (req.user as any)?.id || (req.session as any)?.userId || req.body?.userId;

	if (!userId) {
		return res.status(401).json({
			success: false,
			error: {
				error_code: "UNAUTHENTICATED",
				message: "Authentication required to ingest user intent signals.",
				retryable: false,
			},
		});
	}

	const parsed = intentSignalSchema.safeParse(req.body);
	if (!parsed.success) {
		return res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_INTENT_PAYLOAD",
				message: "Invalid intent signal payload format.",
				details: parsed.error.format(),
				retryable: false,
			},
		});
	}

	// Dispatch non-blocking pre-warm job
	userIntentPrewarmEngine.emitIntentSignal({
		userId: String(userId),
		intentType: parsed.data.intentType,
		symbol: parsed.data.symbol,
		isin: parsed.data.isin,
		assetClass: parsed.data.assetClass,
		consentGranted: parsed.data.consentGranted,
		timestamp: new Date().toISOString(),
	});

	logger.info("[UserIntentRoutes] Intent signal dispatched", {
		event: "USER_INTENT_SIGNAL_ACCEPTED",
		intent: parsed.data.intentType,
		latency_ms: Date.now() - startTime,
		status: "ACCEPTED",
	});

	return res.status(202).json({
		success: true,
		data: {
			status: "PREWARM_SCHEDULED",
			intentType: parsed.data.intentType,
		},
		meta: {
			timestamp: new Date().toISOString(),
			version: USER_INTENT_ENGINE_VERSION,
		},
	});
});

/**
 * GET /api/user-intent/prewarmed
 * Retrieves instant pre-warmed context (holdings, Golden Prices, suitability status, focused instrument).
 */
userIntentRouter.get("/prewarmed", async (req: Request, res: Response) => {
	const startTime = Date.now();
	const userId = (req.user as any)?.id || (req.session as any)?.userId || (req.query.userId as string);

	if (!userId) {
		return res.status(401).json({
			success: false,
			error: {
				error_code: "UNAUTHENTICATED",
				message: "Authentication required to retrieve pre-warmed context.",
				retryable: false,
			},
		});
	}

	try {
		const context = await userIntentPrewarmEngine.getPrewarmedContext(String(userId));

		logger.info("[UserIntentRoutes] Pre-warmed context served", {
			event: "USER_INTENT_PREWARMED_SERVED",
			hasContext: Boolean(context),
			latency_ms: Date.now() - startTime,
			status: "SUCCESS",
		});

		return res.json({
			success: true,
			data: context || {
				status: "EMPTY",
				message: "No pre-warmed context available for this session yet.",
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: USER_INTENT_ENGINE_VERSION,
			},
		});
	} catch (error: any) {
		logger.error("[UserIntentRoutes] Error retrieving pre-warmed context:", error);
		return res.status(500).json({
			success: false,
			error: {
				error_code: "PREWARM_FETCH_ERROR",
				message: error.message || "Failed to retrieve pre-warmed context.",
				retryable: true,
			},
		});
	}
});

/**
 * GET /api/user-intent/health
 * Health check & engine metadata.
 */
userIntentRouter.get("/health", (_req: Request, res: Response) => {
	return res.json({
		success: true,
		data: {
			engine: "User Intent & Predictive Pre-Warming Engine",
			version: USER_INTENT_ENGINE_VERSION,
			status: "HEALTHY",
			capabilities: [
				"SESSION_INITIALIZED",
				"INSTRUMENT_FOCUS",
				"PORTFOLIO_DRIFT_SCAN",
				"TAX_HARVEST_INTENT",
				"WATCHLIST_INTERACTION",
			],
			compliance: ["SEBI IA Reg 17", "DPDP Act 2023 Sec 6", "FASP-AI v1.0"],
		},
		meta: {
			timestamp: new Date().toISOString(),
			version: USER_INTENT_ENGINE_VERSION,
		},
	});
});

export default userIntentRouter;
