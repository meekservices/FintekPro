/**
 * @file macro-routes.ts
 * @description REST API endpoints for the Global Macro Transmission Engine (GMTE).
 *
 * Routes:
 *   - GET  /api/macro/global-radar         — Comprehensive 5-pillar composite dashboard report
 *   - GET  /api/macro/sector-sensitivities — Dynamic sector macro tailwind / headwind matrix
 *   - POST /api/macro/stress-test          — Simulates portfolio drawdowns under global macro shocks
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v3.0
 */

import { type Express, type Request, type Response } from "express";
import { globalMacroTransmissionService } from "../services/macro/global-macro-transmission-service";
import { logger } from "../logger";

export function registerMacroRoutes(app: Express): void {
	/**
	 * GET /api/macro/global-radar
	 * Returns real-time 5-pillar composite report with Global Tailwind Score (0-100) and Macro Bias.
	 */
	app.get("/api/macro/global-radar", async (_req: Request, res: Response) => {
		const t0 = Date.now();
		try {
			const report = await globalMacroTransmissionService.getGlobalMacroReport();
			return res.status(200).json({
				success: true,
				data: report,
				meta: {
					...report.meta,
					latency_ms: Date.now() - t0,
				},
			});
		} catch (err: any) {
			logger.error("[MacroRoutes] Failed to fetch global macro report", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "GLOBAL_MACRO_FETCH_FAILED",
				message: err?.message || "Failed to generate global macro report",
				meta: { timestamp: new Date().toISOString(), version: "GMTE-v1.0.0" },
			});
		}
	});

	/**
	 * GET /api/macro/sector-sensitivities
	 * Returns sector sensitivity matrix reflecting current crude, forex, and yield dynamics.
	 */
	app.get("/api/macro/sector-sensitivities", async (_req: Request, res: Response) => {
		try {
			const report = await globalMacroTransmissionService.getGlobalMacroReport();
			return res.status(200).json({
				success: true,
				data: {
					macroBias: report.macroBias,
					globalTailwindScore: report.globalTailwindScore,
					sectorImpactMatrix: report.sectorImpactMatrix,
				},
				meta: report.meta,
			});
		} catch (err: any) {
			logger.error("[MacroRoutes] Failed to fetch sector sensitivities", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "SECTOR_SENSITIVITIES_FAILED",
				message: err?.message || "Failed to fetch sector sensitivities",
				meta: { timestamp: new Date().toISOString(), version: "GMTE-v1.0.0" },
			});
		}
	});

	/**
	 * POST /api/macro/stress-test
	 * Simulates portfolio drawdown under hypothetical global macro shocks.
	 */
	app.post("/api/macro/stress-test", async (req: Request, res: Response) => {
		try {
			const { holdings, scenario } = req.body || {};
			if (!Array.isArray(holdings) || holdings.length === 0) {
				return res.status(400).json({
					success: false,
					error: "INVALID_HOLDINGS",
					message: "Holdings array is required with { name, weight } entries.",
					meta: { timestamp: new Date().toISOString(), version: "GMTE-v1.0.0" },
				});
			}

			const result = await globalMacroTransmissionService.simulatePortfolioStress(
				holdings,
				scenario || "OIL_SPIKE_95"
			);

			return res.status(200).json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: "GMTE-v1.0.0",
				},
			});
		} catch (err: any) {
			logger.error("[MacroRoutes] Portfolio stress test simulation failed", { error: err?.message });
			return res.status(500).json({
				success: false,
				error: "STRESS_TEST_FAILED",
				message: err?.message || "Failed to execute stress test simulation",
				meta: { timestamp: new Date().toISOString(), version: "GMTE-v1.0.0" },
			});
		}
	});
}
