/**
 * @file amc-portfolio-delta-routes.ts
 * @description API routes for Mutual Fund AMC Portfolio Tracking ("What's In & What's Out").
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Layered architecture: Business logic encapsulated in amcPortfolioDeltaEngine
 * - Standard envelope: { success, data, meta: { timestamp, version } }
 * - Zero hardcoded secrets, input validation with Zod
 */

import { Router, Request, Response } from "express";
import { amcPortfolioDeltaEngine, AMC_PORTFOLIO_DELTA_ENGINE_VERSION } from "../services/amc-portfolio-delta-engine";
import { z } from "zod";
import { db } from "../db";
import { logger } from "../logger";
import { mfAmcPortfolioDeltas } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

/**
 * GET /api/mutual-funds/amc-deltas/consensus
 * Returns cross-AMC smart-money consensus moves (top added & top dumped stocks)
 */
router.get("/consensus", async (req: Request, res: Response) => {
	try {
		const asOfDate = req.query.date as string | undefined;
		const result = await amcPortfolioDeltaEngine.getConsensusInOutMovers(asOfDate);

		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: AMC_PORTFOLIO_DELTA_ENGINE_VERSION,
				source: "amc_portfolio_delta_engine",
			},
		});
	} catch (error: any) {
		logger.error("[AmcDeltas] Consensus error:", { error: error.message });
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch AMC consensus portfolio moves",
		});
	}
});

/**
 * GET /api/mutual-funds/amc-deltas/scheme/:schemeCode
 * Returns "What's In & What's Out" for a specific mutual fund scheme
 */
router.get("/scheme/:schemeCode", async (req: Request, res: Response) => {
	try {
		const { schemeCode } = req.params;
		const asOfDate = req.query.date as string | undefined;

		const summary = await amcPortfolioDeltaEngine.getSchemeInOutSummary(schemeCode, asOfDate);

		if (!summary) {
			return res.status(404).json({
				success: false,
				error: `Scheme ${schemeCode} not found or has insufficient disclosure history`,
			});
		}

		res.json({
			success: true,
			data: summary,
			meta: {
				timestamp: new Date().toISOString(),
				version: AMC_PORTFOLIO_DELTA_ENGINE_VERSION,
			},
		});
	} catch (error: any) {
		logger.error(`[AmcDeltas] Scheme ${req.params.schemeCode} error:`, { error: error.message });
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch scheme in/out summary",
		});
	}
});

/**
 * GET /api/mutual-funds/amc-deltas/stock/:symbol
 * Returns all AMC mutual fund movements for a specific stock (who's buying, who's selling)
 */
router.get("/stock/:symbol", async (req: Request, res: Response) => {
	try {
		const cleanSymbol = req.params.symbol.trim().toUpperCase();

		// Fetch all delta movements for this stock symbol
		const rows = await db
			.select()
			.from(mfAmcPortfolioDeltas)
			.where(sql`UPPER(${mfAmcPortfolioDeltas.stockSymbol}) = ${cleanSymbol}`)
			.orderBy(desc(mfAmcPortfolioDeltas.asOfDate));

		const buyers = rows.filter((r) => r.deltaType === "NEW_ENTRY" || r.deltaType === "INCREASED");
		const sellers = rows.filter((r) => r.deltaType === "COMPLETE_EXIT" || r.deltaType === "TRIMMED");

		res.json({
			success: true,
			data: {
				symbol: cleanSymbol,
				totalMoves: rows.length,
				buyersCount: buyers.length,
				sellersCount: sellers.length,
				buyers: buyers.map((b) => ({
					amcName: b.amcName,
					schemeCode: b.schemeCode,
					deltaType: b.deltaType,
					weightChangePercent: Number.parseFloat(String(b.weightChangePercent || "0")),
					currentWeight: Number.parseFloat(String(b.currentWeight || "0")),
					asOfDate: b.asOfDate,
				})),
				sellers: sellers.map((s) => ({
					amcName: s.amcName,
					schemeCode: s.schemeCode,
					deltaType: s.deltaType,
					weightChangePercent: Number.parseFloat(String(s.weightChangePercent || "0")),
					previousWeight: Number.parseFloat(String(s.previousWeight || "0")),
					asOfDate: s.asOfDate,
				})),
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: AMC_PORTFOLIO_DELTA_ENGINE_VERSION,
			},
		});
	} catch (error: any) {
		logger.error(`[AmcDeltas] Stock ${req.params.symbol} error:`, { error: error.message });
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch stock AMC ownership footprint",
		});
	}
});

/**
 * POST /api/mutual-funds/amc-deltas/compute
 * Triggers delta recomputation for a specific scheme
 */
router.post("/compute", async (req: Request, res: Response) => {
	try {
		const schema = z.object({
			schemeCode: z.string(),
			targetDate: z.string().optional(),
			prevDate: z.string().optional(),
		});

		const { schemeCode, targetDate, prevDate } = schema.parse(req.body);
		const deltas = await amcPortfolioDeltaEngine.computeDeltasForScheme(schemeCode, targetDate, prevDate);

		res.json({
			success: true,
			data: {
				schemeCode,
				deltasCount: deltas.length,
				deltas,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: AMC_PORTFOLIO_DELTA_ENGINE_VERSION,
			},
		});
	} catch (error: any) {
		logger.error("[AmcDeltas] Compute error:", { error: error.message });
		res.status(400).json({
			success: false,
			error: error.message || "Failed to compute AMC portfolio deltas",
		});
	}
});

export default router;

