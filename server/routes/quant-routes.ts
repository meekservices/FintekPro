/**
 * @file quant-routes.ts
 * @description Unified API Gateway for FintekPro Quant Alpha Engine & Risk Modeling.
 * 
 * Exposes:
 * 1. Tail-Risk & CVaR Stress-Testing (/api/quant/stress-test, /api/quant/macro-scenarios)
 * 2. Advanced Quant Factor Scoring (/api/quant/factors/vcp, /mansfield, /delivery, /comprehensive)
 * 3. Market Regime Detection (/api/quant/regime)
 * 4. Full Quant Orchestrator Execution (/api/quant/orchestrate)
 * 
 * Complies with FintekPro GCR v1.0 & FASP-AI v1.0.
 */

import { Router, Request, Response } from "express";
import { logger } from "../logger";
import {
	calculateTailRiskAndStress,
	STANDARD_MACRO_SCENARIOS,
	type PortfolioAssetInput,
} from "../services/quant/tail-risk-stress-engine";
import {
	calculateVcp,
	calculateMansfieldRelativeStrength,
	calculateDeliveryVolumeSpike,
	calculateTrendSmoothness,
	type VcpInput,
	type MansfieldInput,
	type DeliveryVolumeInput,
	type DeliveryConvictionInput,
	type TrendSmoothnessInput,
} from "../services/quant/advanced-quant-factors";
import { detectRegime as detectMarketRegime } from "../services/market-regime-detector";
import { quantOrchestrator } from "../services/quant/quant-orchestrator";
import { nightlyFactorScreeningScheduler } from "../services/quant/nightly-factor-screening-scheduler";

const router = Router();

function errorMessage(err: unknown): string {
	if (err instanceof Error) return err.message;
	return String(err);
}

// ── 1. Tail Risk & Macro Crash Stress Testing ─────────────────────────────────

/**
 * GET /api/quant/macro-scenarios
 * Returns the standard historical Indian macro stress scenarios.
 */
router.get("/macro-scenarios", (_req: Request, res: Response) => {
	res.json({
		success: true,
		data: STANDARD_MACRO_SCENARIOS,
		meta: { timestamp: new Date().toISOString() },
	});
});

/**
 * POST /api/quant/stress-test
 * Evaluates Parametric/Historical VaR, Fat-Tailed Expected Shortfall (CVaR @ 95% & 99%),
 * and simulates portfolio drawdowns across historical crises (COVID 2020, GFC 2008, 2013 Taper Tantrum).
 */
router.post(
	"/stress-test",
	async (
		req: Request<any, any, { assets: PortfolioAssetInput[] }>,
		res: Response
	): Promise<void> => {
		const t0 = Date.now();
		try {
			const { assets } = req.body;
			if (!assets || !Array.isArray(assets) || assets.length === 0) {
				res.status(400).json({
					success: false,
					error: "Missing required 'assets' array in request body.",
				});
				return;
			}

			const result = calculateTailRiskAndStress(assets);

			logger.info("[QuantRoutes] Tail-risk stress test evaluated", {
				event: "QUANT_STRESS_TEST_COMPLETED",
				assetsCount: assets.length,
				robustnessScore: result.portfolioRobustnessScore,
				latency_ms: Date.now() - t0,
			});

			res.json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: result.engine_version,
					latency_ms: Date.now() - t0,
				},
			});
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error running stress test:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

// ── 2. Advanced Quant Factor Scoring ──────────────────────────────────────────

/**
 * POST /api/quant/factors/vcp
 * Calculates Minervini Volatility Contraction Pattern (VCP) and ATR compression ratio.
 */
router.post(
	"/factors/vcp",
	async (req: Request<any, any, VcpInput>, res: Response): Promise<void> => {
		try {
			const input = req.body;
			if (!input || !input.symbol || !input.highs || !input.lows || !input.closes) {
				res.status(400).json({
					success: false,
					error: "Missing required VCP inputs (symbol, highs, lows, closes).",
				});
				return;
			}

			const result = calculateVcp(input);
			res.json({ success: true, data: result });
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error computing VCP factor:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

/**
 * POST /api/quant/factors/mansfield
 * Calculates Mansfield Relative Strength (MRS) against Benchmark (Nifty 50).
 */
router.post(
	"/factors/mansfield",
	async (req: Request<any, any, MansfieldInput>, res: Response): Promise<void> => {
		try {
			const input = req.body;
			if (!input || !input.symbol || !input.stockCloses || !input.benchmarkCloses) {
				res.status(400).json({
					success: false,
					error: "Missing required Mansfield inputs (symbol, stockCloses, benchmarkCloses).",
				});
				return;
			}

			const result = calculateMansfieldRelativeStrength(input);
			res.json({ success: true, data: result });
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error computing Mansfield Relative Strength:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

/**
 * POST /api/quant/factors/delivery
 * Calculates Institutional Delivery Volume Spike Factor from Bhavcopy series.
 */
router.post(
	"/factors/delivery",
	async (req: Request<any, any, DeliveryConvictionInput>, res: Response): Promise<void> => {
		try {
			const input = req.body;
			if (
				!input ||
				!input.symbol ||
				input.currentDeliveryQty === undefined ||
				input.currentTotalVolume === undefined ||
				!input.historicalDeliveryQtys
			) {
				res.status(400).json({
					success: false,
					error: "Missing required Delivery Volume inputs (symbol, currentDeliveryQty, currentTotalVolume, historicalDeliveryQtys).",
				});
				return;
			}

			const result = calculateDeliveryVolumeSpike(input);
			res.json({ success: true, data: result });
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error computing Delivery Volume factor:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

/**
 * POST /api/quant/factors/trend-smoothness
 * Calculates Trend Smoothness (R^2 of Log Prices) and persistence.
 */
router.post(
	"/factors/trend-smoothness",
	async (req: Request<any, any, TrendSmoothnessInput>, res: Response): Promise<void> => {
		try {
			const input = req.body;
			if (!input || !input.symbol || !input.closes) {
				res.status(400).json({
					success: false,
					error: "Missing required Trend Smoothness inputs (symbol, closes).",
				});
				return;
			}

			const result = calculateTrendSmoothness(input);
			res.json({ success: true, data: result });
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error computing Trend Smoothness factor:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

/**
 * POST /api/quant/factors/comprehensive
 * Computes all 4 institutional quant factors for a security in a single payload.
 */
router.post(
	"/factors/comprehensive",
	async (
		req: Request<
			any,
			any,
			{
				symbol: string;
				highs: number[];
				lows: number[];
				closes: number[];
				volumes?: number[];
				currentDeliveryQty?: number;
				currentTotalVolume?: number;
				historicalDeliveryQtys?: number[];
				historicalTotalVolumes?: number[];
				benchmarkCloses?: number[];
				weekHigh52?: number;
			}
		>,
		res: Response
	): Promise<void> => {
		const t0 = Date.now();
		try {
			const {
				symbol,
				highs,
				lows,
				closes,
				volumes = [],
				currentDeliveryQty,
				currentTotalVolume,
				historicalDeliveryQtys = [],
				historicalTotalVolumes = [],
				benchmarkCloses = [],
				weekHigh52,
			} = req.body;

			if (!symbol || !highs || !lows || !closes) {
				res.status(400).json({
					success: false,
					error: "Missing required fields (symbol, highs, lows, closes).",
				});
				return;
			}

			const vcp = calculateVcp({ symbol, highs, lows, closes, volumes, weekHigh52 });
			const trend = calculateTrendSmoothness({ symbol, closes });

			const mansfield =
				benchmarkCloses.length >= 10
					? calculateMansfieldRelativeStrength({
							symbol,
							stockCloses: closes,
							benchmarkCloses,
						})
					: null;

			const delivery =
				currentDeliveryQty !== undefined && currentTotalVolume !== undefined && historicalDeliveryQtys.length >= 5
					? calculateDeliveryVolumeSpike({
							symbol,
							currentDeliveryQty,
							currentTotalVolume,
							historicalDeliveryQtys,
							historicalTotalVolumes,
						})
					: null;

			// Composite Institutional Alpha Score (0 - 100)
			let compositeScore = Math.round(vcp.vcpScore * 0.4 + trend.momentumQualityScore * 0.35);
			if (mansfield) compositeScore += Math.round(mansfield.currentRsScore > 0 ? 15 : -10);
			if (delivery && delivery.isInstitutionalAccumulation) compositeScore += 10;
			compositeScore = Math.max(5, Math.min(98, compositeScore));

			res.json({
				success: true,
				data: {
					symbol,
					compositeScore,
					vcp,
					trendSmoothness: trend,
					mansfieldRelativeStrength: mansfield,
					deliveryVolumeSpike: delivery,
				},
				meta: {
					timestamp: new Date().toISOString(),
					latency_ms: Date.now() - t0,
				},
			});
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error computing comprehensive factors:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

// ── 3. Market Regime Detection ────────────────────────────────────────────────

/**
 * GET /api/quant/regime
 * Returns current Indian market volatility regime, breadth, and Black Swan status.
 */
router.get("/regime", async (_req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	try {
		const regime = await detectMarketRegime();
		res.json({
			success: true,
			data: regime,
			meta: {
				timestamp: new Date().toISOString(),
				latency_ms: Date.now() - t0,
			},
		});
	} catch (error: unknown) {
		logger.error("[QuantRoutes] Error detecting market regime:", errorMessage(error));
		res.status(500).json({ success: false, error: errorMessage(error) });
	}
});

// ── 4. Quant Orchestration Engine ─────────────────────────────────────────────

/**
 * POST /api/quant/orchestrate
 * Executes the full Quant Orchestrator (MVO + Black-Litterman + Preemptive Drift Prediction).
 */
router.post(
	"/orchestrate",
	async (req: Request<any, any, any>, res: Response): Promise<void> => {
		const t0 = Date.now();
		try {
			const input = req.body;
			if (!input || !input.assetsData || !input.riskProfile) {
				res.status(400).json({
					success: false,
					error: "Missing required inputs (assetsData, riskProfile).",
				});
				return;
			}

			const result = await quantOrchestrator.run(input);

			res.json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					latency_ms: Date.now() - t0,
				},
			});
		} catch (error: unknown) {
			logger.error("[QuantRoutes] Error orchestrating quant run:", errorMessage(error));
			res.status(500).json({ success: false, error: errorMessage(error) });
		}
	}
);

// ── 5. Automated Overnight Factor Screener ────────────────────────────────────

/**
 * GET /api/quant/screener/results
 * Returns the latest screened stocks sorted by Composite Alpha Score.
 */
router.get("/screener/results", async (_req: Request, res: Response): Promise<void> => {
	try {
		let data = nightlyFactorScreeningScheduler.getScreenedPicks();
		// If empty, trigger a fast on-demand run
		if (data.results.length === 0) {
			const run = await nightlyFactorScreeningScheduler.runScreeningCycle();
			data = {
				lastRunTimestamp: new Date().toISOString(),
				results: run.results,
			};
		}
		res.json({
			success: true,
			data: data.results,
			meta: {
				lastRunTimestamp: data.lastRunTimestamp,
				totalCount: data.results.length,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (error: unknown) {
		logger.error("[QuantRoutes] Error fetching screened factors:", errorMessage(error));
		res.status(500).json({ success: false, error: errorMessage(error) });
	}
});

/**
 * POST /api/quant/screener/run
 * Manually triggers an immediate factor screening cycle.
 */
router.post("/screener/run", async (_req: Request, res: Response): Promise<void> => {
	try {
		const result = await nightlyFactorScreeningScheduler.runScreeningCycle();
		res.json({
			success: true,
			message: `Screened ${result.totalScanned} securities. Found ${result.priorityPicksCount} priority alpha setups.`,
			data: result,
			meta: { timestamp: new Date().toISOString() },
		});
	} catch (error: unknown) {
		logger.error("[QuantRoutes] Error triggering factor screening:", errorMessage(error));
		res.status(500).json({ success: false, error: errorMessage(error) });
	}
});

export default router;
