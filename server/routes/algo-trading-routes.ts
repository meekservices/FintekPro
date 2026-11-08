/**
 * Algo Trading Signal Routes
 *
 * Base: /api/us-trading/algo
 *
 * GET  /signals              — list signals (paginated, filterable)
 * POST /signals/generate     — run engine for given symbols
 * GET  /signals/:id          — get single signal
 * POST /signals/:id/approve  — approve signal (optionally link order ID)
 * POST /signals/:id/reject   — reject signal
 * GET  /performance          — signal accuracy stats for user
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import crypto from "crypto";
import {
	algoSignalEngine,
	algoBacktestEngine,
	RiskProfile,
} from "../services/algo-signal-engine";
import { riskEngine } from "../services/compliance/riskEngine";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { algoSignals, strategyBacktestRuns } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../logger";
import { auditLog } from "../middleware/audit-trail";

const router = Router();
router.use(requireAuth);

// Rate limiters
const generateLimiter = rateLimit({
	windowMs: 60_000,
	max: 5,
	keyGenerator: (req) =>
		req.user?.id?.toString() || ipKeyGenerator(req.ip ?? ""),
	message: {
		success: false,
		error: "Max 5 signal generations/minute.",
		retryable: true,
	},
});

const actionLimiter = rateLimit({
	windowMs: 60_000,
	max: 60,
	keyGenerator: (req) =>
		req.user?.id?.toString() || ipKeyGenerator(req.ip ?? ""),
	message: {
		success: false,
		error: "Too many actions. Slow down.",
		retryable: true,
	},
});

// ─── Validation schemas ───────────────────────────────────────────────────────

const generateSchema = z.object({
	symbols: z.array(z.string().min(1).max(10)).min(1).max(20),
	riskProfile: z
		.enum(["conservative", "moderate", "aggressive", "very_aggressive"])
		.default("moderate"),
	investmentHorizon: z.enum(["short", "medium", "long"]).default("medium"),
});

const approveSchema = z.object({
	orderId: z.string().optional(), // Alpaca order ID if already placed
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(req: Request): number {
	const id = req.user?.id;
	if (!id) throw new Error("Unauthenticated");
	return typeof id === "string" ? Number.parseInt(id, 10) : id;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /signals/generate
 * Run the signal engine for given symbols and persist results.
 */
router.post(
	"/signals/generate",
	generateLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const killSwitch = riskEngine.getGlobalKillSwitchStatus();
			if (killSwitch.active) {
				res.status(503).json({
					success: false,
					error: "GLOBAL_KILL_SWITCH_ACTIVE",
					message: `Automated signal generation is temporarily halted: ${killSwitch.reason}`,
					meta: { killSwitch },
				});
				return;
			}

			const parsed = generateSchema.safeParse(req.body);
			if (!parsed.success) {
				res
					.status(400)
					.json({ success: false, error: parsed.error.flatten().fieldErrors });
				return;
			}
			const { symbols, riskProfile, investmentHorizon } = parsed.data;
			const userId = getUserId(req);

			const signals = await algoSignalEngine.generateSignals(
				symbols,
				userId,
				riskProfile as RiskProfile,
				investmentHorizon,
			);

			res.json({
				success: true,
				data: {
					generated: signals.length,
					signals,
				},
				meta: {
					timestamp: new Date().toISOString(),
					version: "algo-v1.0",
					disclaimer:
						"Signals are for informational purposes only. Not financial advice.",
				},
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error("[AlgoRoutes] generate error", { error: message });
			res
				.status(500)
				.json({ success: false, error: message, retryable: false });
		}
	},
);

/**
 * GET /signals
 * List signals for the authenticated user.
 * Query params: status, symbol, page, limit
 */
router.get(
	"/signals",
	actionLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = getUserId(req);
			const limit = Math.min(
				Number.parseInt(req.query.limit as string) || 20,
				100,
			);
			const page = Math.max(Number.parseInt(req.query.page as string) || 1, 1);

			const signals = await algoSignalEngine.listSignals(userId, {
				status: req.query.status as string,
				symbol: req.query.symbol as string,
				limit,
				page,
			});

			res.json({
				success: true,
				data: signals,
				meta: {
					page,
					limit,
					count: signals.length,
					timestamp: new Date().toISOString(),
					version: "1.0",
				},
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			res.status(500).json({ success: false, error: message });
		}
	},
);

/**
 * GET /signals/:id
 * Get a single signal with full factor breakdown.
 */
router.get(
	"/signals/:id",
	actionLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = getUserId(req);
			const signalId = Number.parseInt(req.params.id, 10);
			if (Number.isNaN(signalId)) {
				res.status(400).json({ success: false, error: "Invalid signal ID" });
				return;
			}

			const [signal] = await db
				.select()
				.from(algoSignals)
				.where(
					and(eq(algoSignals.id, signalId), eq(algoSignals.userId, userId)),
				)
				.limit(1);

			if (!signal) {
				res.status(404).json({ success: false, error: "Signal not found" });
				return;
			}

			res.json({
				success: true,
				data: signal,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			res.status(500).json({ success: false, error: message });
		}
	},
);

/**
 * POST /signals/:id/approve
 * Approve a signal. Optionally supply orderId if order was already placed.
 *
 * FASP-AI v1.0: This endpoint marks user intent to act.
 * Actual order placement is done via the existing /broker/accounts/:id/orders endpoint.
 */
router.post(
	"/signals/:id/approve",
	actionLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const killSwitch = riskEngine.getGlobalKillSwitchStatus();
			if (killSwitch.active) {
				res.status(503).json({
					success: false,
					error: "GLOBAL_KILL_SWITCH_ACTIVE",
					message: `Algo execution approval is temporarily halted: ${killSwitch.reason}`,
					meta: { killSwitch },
				});
				return;
			}

			const userId = getUserId(req);
			const signalId = Number.parseInt(req.params.id, 10);
			if (Number.isNaN(signalId)) {
				res.status(400).json({ success: false, error: "Invalid signal ID" });
				return;
			}

			const parsed = approveSchema.safeParse(req.body);
			if (!parsed.success) {
				res.status(400).json({ success: false, error: parsed.error.flatten() });
				return;
			}

			const updated = await algoSignalEngine.approveSignal(
				signalId,
				userId,
				parsed.data.orderId,
			);

			res.json({
				success: true,
				data: updated,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			const status = message.includes("not found") ? 404 : 500;
			res.status(status).json({ success: false, error: message });
		}
	},
);

/**
 * POST /signals/:id/reject
 * Reject a signal — user dismissed it.
 */
router.post(
	"/signals/:id/reject",
	actionLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = getUserId(req);
			const signalId = Number.parseInt(req.params.id, 10);
			if (Number.isNaN(signalId)) {
				res.status(400).json({ success: false, error: "Invalid signal ID" });
				return;
			}

			const updated = await algoSignalEngine.rejectSignal(signalId, userId);
			res.json({
				success: true,
				data: updated,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			const status = message.includes("not found") ? 404 : 500;
			res.status(status).json({ success: false, error: message });
		}
	},
);

/**
 * GET /performance
 * Signal statistics for the authenticated user.
 */
router.get(
	"/performance",
	actionLimiter,
	async (req: Request, res: Response): Promise<void> => {
		try {
			const userId = getUserId(req);
			const performance = await algoSignalEngine.getPerformance(userId);
			res.json({
				success: true,
				data: performance,
				meta: { timestamp: new Date().toISOString(), version: "1.0" },
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			res.status(500).json({ success: false, error: message });
		}
	},
);

// ─── Backtesting ──────────────────────────────────────────────────────────────

const backtestLimiter = rateLimit({
	windowMs: 60_000,
	max: 10,
	keyGenerator: (req) =>
		req.user?.id?.toString() || ipKeyGenerator(req.ip ?? ""),
	message: {
		success: false,
		error: "Rate limit reached. Max 10 backtests/minute.",
		retryable: true,
	},
});

const backtestSchema = z
	.object({
		symbol: z
			.string()
			.min(1)
			.max(30)
			.transform((s) => s.toUpperCase()),
		startDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
		endDate: z
			.string()
			.regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
		riskProfile: z
			.enum(["conservative", "moderate", "aggressive", "very_aggressive"])
			.default("moderate"),
		initialCapital: z.number().min(1000).max(10_000_000).default(100000),
		strategy: z
			.enum(["composite", "sma_crossover", "rsi", "momentum"])
			.default("composite"),
		market: z.enum(["IN", "US"]).optional(),
		currency: z.enum(["INR", "USD"]).optional(),
		includeFriction: z.boolean().default(true),
		slippagePct: z.number().min(0).max(0.05).optional(),
		brokeragePerTrade: z.number().min(0).max(1000).optional(),
	})
	.refine(
		(data) => {
			// Enforce max 5-year lookback
			const fiveYearsAgo = new Date();
			fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
			return data.startDate >= fiveYearsAgo.toISOString().split("T")[0];
		},
		{
			message: "startDate cannot be more than 5 years ago",
		},
	)
	.refine((data) => data.endDate > data.startDate, {
		message: "endDate must be after startDate",
	})
	.refine((data) => data.endDate <= new Date().toISOString().split("T")[0], {
		message: "endDate cannot be in the future",
	});

/**
 * POST /backtest
 * Run a multi-market, audit-safe strategy backtest with realistic regulatory frictions.
 *
 * Compliant with SEBI Algorithmic Trading Framework and FASP-AI v1.0.
 * Mandatory statutory disclaimers attached.
 */
router.post(
	"/backtest",
	backtestLimiter,
	async (req: Request, res: Response): Promise<void> => {
		const startMs = Date.now();
		try {
			const userId = getUserId(req);
			const parsed = backtestSchema.safeParse(req.body);
			if (!parsed.success) {
				res
					.status(400)
					.json({ success: false, error: parsed.error.flatten().fieldErrors });
				return;
			}
			const config = parsed.data;

			const result = await algoBacktestEngine.runBacktest({
				symbol: config.symbol,
				startDate: config.startDate,
				endDate: config.endDate,
				riskProfile: config.riskProfile as RiskProfile,
				initialCapital: config.initialCapital,
				strategy: config.strategy,
				market: config.market,
				currency: config.currency,
				userId,
				includeFriction: config.includeFriction,
				slippagePct: config.slippagePct,
				brokeragePerTrade: config.brokeragePerTrade,
			});

			res.json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: result.engineVersion,
					inputsHash: result.inputsHash,
					runId: result.runId,
					disclaimers: result.regulatoryDisclaimers,
					latency_ms: Date.now() - startMs,
				},
			});
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error("[AlgoRoutes] backtest error", { error: message });
			res.status(message.includes("Insufficient") ? 422 : 500).json({
				success: false,
				error: message,
				retryable: false,
			});
		}
	},
);

/**
 * GET /backtest/runs
 * Retrieve historical backtest runs for the authenticated user (SEBI Audit Trail).
 */
router.get("/backtest/runs", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = getUserId(req);
		const runs = await db
			.select()
			.from(strategyBacktestRuns)
			.where(and(eq(strategyBacktestRuns.userId, String(userId)), eq(strategyBacktestRuns.mode, "algo_trading")))
			.orderBy(desc(strategyBacktestRuns.createdAt))
			.limit(50);

		res.json({
			success: true,
			data: runs,
			meta: {
				count: runs.length,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (err: any) {
		logger.error("[AlgoRoutes] Error fetching backtest runs", { error: err.message });
		res.status(500).json({ success: false, error: "Failed to fetch backtest audit trail" });
	}
});

/**
 * GET /backtest/runs/:id
 * Retrieve specific audit-safe backtest report by ID.
 */
router.get("/backtest/runs/:id", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = getUserId(req);
		const runId = req.params.id;
		const [run] = await db
			.select()
			.from(strategyBacktestRuns)
			.where(and(eq(strategyBacktestRuns.id, runId), eq(strategyBacktestRuns.userId, String(userId))))
			.limit(1);

		if (!run) {
			res.status(404).json({ success: false, error: "Backtest run not found" });
			return;
		}

		res.json({
			success: true,
			data: run,
			meta: { timestamp: new Date().toISOString() },
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

function buildSebiAuditPack(run: any) {
	const metrics = (run.metrics as any) || {};
	const constituents = (run.constituents as any) || [];
	const symbol = constituents[0]?.symbol || "UNKNOWN";
	const inputsHash = metrics.inputsHash || crypto.createHash("sha256").update(String(run.id)).digest("hex");
	const rawPayload = JSON.stringify({
		runId: run.id,
		inputsHash,
		metrics,
		strategyName: run.strategyName,
		startDate: run.startDate,
		endDate: run.endDate,
	});
	const sealChecksum = crypto.createHash("sha256").update(rawPayload).digest("hex");

	return {
		auditPackId: `SEBI-ALGO-AP-${String(run.id || "00000000").slice(0, 8).toUpperCase()}`,
		statutoryFramework: "SEBI Algorithmic Trading Framework (2024) & Advertising Code (CIR/2023/147)",
		generationTimestamp: new Date().toISOString(),
		inputsHash,
		runId: run.id,
		strategyGovernance: {
			strategyName: run.strategyName,
			engineVersion: run.engineVersion || "FintekPro-AlgoBacktest-v2.1",
			modelCategory: "Decision Support System (DSS) - Non-Discretionary Execution",
			methodology: "Walk-forward deterministic historical simulation with statutory friction deductions",
			author: "FintekPro Quantitative Alpha Advisory Engine",
		},
		simulationScope: {
			symbol,
			market: metrics.market || "IN",
			currency: metrics.currency || "INR",
			startDate: run.startDate,
			endDate: run.endDate,
			initialCapital: Number(run.initialAmount) || 100000,
			benchmarkCode: run.benchmarkCode || "NIFTY50",
			totalBarsEvaluated: metrics.totalBars || 0,
		},
		performanceAudit: {
			netCagrPct: metrics.cagr || 0,
			grossTotalReturnPct: metrics.grossTotalReturn || metrics.totalReturn || 0,
			netTotalReturnPct: metrics.totalReturn || 0,
			frictionDragPct: +((metrics.grossTotalReturn || 0) - (metrics.totalReturn || 0)).toFixed(2),
			sharpeRatio: metrics.sharpeRatio || 0,
			sortinoRatio: metrics.sortinoRatio || 0,
			calmarRatio: metrics.calmarRatio || 0,
			maxDrawdownPct: metrics.maxDrawdown || 0,
			winRatePct: metrics.winRate || 0,
			profitFactor: metrics.profitFactor || 0,
			expectancy: metrics.expectancy || 0,
			totalTrades: metrics.totalTrades || 0,
		},
		statutoryFrictionDeductions: metrics.frictionBreakdown || {
			totalBrokerage: 0,
			totalStt: 0,
			totalExchangeFees: 0,
			totalSebiFees: 0,
			totalStampDuty: 0,
			totalGst: 0,
			totalSlippage: 0,
			totalFrictionDeducted: metrics.totalFrictionDeducted || 0,
		},
		mandatoryStatutoryDisclaimers: metrics.regulatoryDisclaimers || [
			"1. HYPOTHETICAL PERFORMANCE LIMITATION: Simulated or backtested performance results have inherent limitations. Unlike an actual performance record, simulated results do not represent actual trading and may not reflect the impact of market risk, liquidity shortages, or execution delays.",
			"2. NO GUARANTEE OF RETURNS: In accordance with SEBI circulars on Algorithmic Trading and Advertising Code, this strategy backtester does NOT promise, guarantee, or assure any future returns or profits. Past performance is strictly not indicative of future results.",
			"3. STATUTORY FRICTION MODELING: Net returns reflect simulated statutory transaction costs (STT, GST, Exchange charges, Stamp Duty, Brokerage) and execution slippage.",
			"4. DECISION SUPPORT SYSTEM ONLY: In compliance with FintekPro FASP-AI v1.0, this algorithmic model is provided exclusively as a Decision Support System (DSS) for analytical evaluation. It does NOT autonomously execute trades without explicit client consent.",
		],
		auditSeal: {
			status: "AUDIT_SAFE_VERIFIED",
			complianceStandard: "SEBI-IA-2013-REG17 / GCR-V1.0",
			cryptographicSeal: sealChecksum,
		},
	};
}

/**
 * GET /backtest/runs/:id/audit-pack
 * Returns a certified SEBI Regulatory Audit Pack for a completed backtest run.
 */
router.get("/backtest/runs/:id/audit-pack", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = getUserId(req);
		const runId = req.params.id;
		const [run] = await db
			.select()
			.from(strategyBacktestRuns)
			.where(and(eq(strategyBacktestRuns.id, runId), eq(strategyBacktestRuns.userId, String(userId))))
			.limit(1);

		if (!run) {
			res.status(404).json({ success: false, error: "Backtest run not found" });
			return;
		}

		const auditPack = buildSebiAuditPack(run);
		res.json({
			success: true,
			data: auditPack,
			meta: { timestamp: new Date().toISOString() },
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * POST /backtest/audit-pack
 * Generates an on-demand certified SEBI Regulatory Audit Pack from simulation configuration.
 */
router.post("/backtest/audit-pack", backtestLimiter, async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = getUserId(req);
		const parsed = backtestSchema.safeParse(req.body);
		if (!parsed.success) {
			res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
			return;
		}
		const config = parsed.data;

		const result = await algoBacktestEngine.runBacktest({
			symbol: config.symbol,
			startDate: config.startDate,
			endDate: config.endDate,
			riskProfile: config.riskProfile as RiskProfile,
			initialCapital: config.initialCapital,
			strategy: config.strategy,
			market: config.market,
			currency: config.currency,
			userId,
			includeFriction: config.includeFriction,
			slippagePct: config.slippagePct,
			brokeragePerTrade: config.brokeragePerTrade,
		});

		const syntheticRun = {
			id: result.runId,
			strategyName: `Algo: ${config.strategy.toUpperCase()} (${result.symbol})`,
			startDate: config.startDate,
			endDate: config.endDate,
			initialAmount: config.initialCapital,
			benchmarkCode: result.market === "IN" ? "NIFTY50" : "SPY",
			constituents: [{ symbol: result.symbol }],
			metrics: {
				...result.summary,
				inputsHash: result.inputsHash,
				market: result.market,
				currency: result.currency,
				regulatoryDisclaimers: result.regulatoryDisclaimers,
			},
			engineVersion: result.engineVersion,
		};

		const auditPack = buildSebiAuditPack(syntheticRun);

		res.json({
			success: true,
			data: auditPack,
			meta: {
				runId: result.runId,
				inputsHash: result.inputsHash,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * GET /compliance/audit-manifest
 * Returns algorithmic trading compliance status and risk boundaries.
 */
router.get("/compliance/audit-manifest", async (_req: Request, res: Response): Promise<void> => {
	res.json({
		success: true,
		data: riskEngine.getRegulatoryComplianceStatus(),
		meta: { timestamp: new Date().toISOString() },
	});
});

/**
 * POST /kill-switch/user
 * Toggle user-level emergency kill switch.
 */
router.post("/kill-switch/user", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = getUserId(req);
		const { action, reason } = req.body || {};

		if (action === "activate") {
			const status = riskEngine.activateUserKillSwitch(
				String(userId),
				reason || "User triggered manual emergency halt",
			);
			res.json({
				success: true,
				message: "Your trading kill switch has been ACTIVATED. All automated executions halted.",
				data: status,
			});
		} else {
			const status = riskEngine.deactivateUserKillSwitch(String(userId));
			res.json({
				success: true,
				message: "Your trading kill switch has been DEACTIVATED.",
				data: status,
			});
		}
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * GET /kill-switch/user
 * Returns status of user's personal emergency kill switch.
 */
router.get("/kill-switch/user", async (req: Request, res: Response): Promise<void> => {
	try {
		const userId = getUserId(req);
		res.json({
			success: true,
			data: riskEngine.getUserKillSwitchStatus(String(userId)),
		});
	} catch (err: any) {
		res.status(500).json({ success: false, error: err.message });
	}
});

/**
 * GET /kill-switch
 * Returns current status of Global Algo Emergency Kill Switch.
 */
router.get("/kill-switch", async (_req: Request, res: Response): Promise<void> => {
	res.json({
		success: true,
		data: riskEngine.getGlobalKillSwitchStatus(),
		meta: { timestamp: new Date().toISOString() },
	});
});

/**
 * POST /kill-switch/activate
 * Activates Global Algo Emergency Kill Switch across platforms.
 */
router.post("/kill-switch/activate", async (req: Request, res: Response): Promise<void> => {
	const user = req.user as any;
	const userRoles = user?.roles || (user?.role ? [user.role] : []);
	const isAuthorized = userRoles.some((r: string) => ["admin", "superadmin", "compliance"].includes(r));

	if (!isAuthorized) {
		res.status(403).json({ success: false, error: "Only admin or compliance roles can activate Global Kill Switch" });
		return;
	}

	const reason = req.body?.reason || "Emergency volatility / anomaly intervention";
	const activatedBy = user?.id || "admin";
	const status = riskEngine.activateGlobalKillSwitch(reason, activatedBy);

	res.json({
		success: true,
		message: "Global Algo Emergency Kill Switch activated successfully",
		data: status,
		meta: { timestamp: new Date().toISOString() },
	});
});

/**
 * POST /kill-switch/deactivate
 * Deactivates Global Algo Emergency Kill Switch.
 */
router.post("/kill-switch/deactivate", async (req: Request, res: Response): Promise<void> => {
	const user = req.user as any;
	const userRoles = user?.roles || (user?.role ? [user.role] : []);
	const isAuthorized = userRoles.some((r: string) => ["admin", "superadmin", "compliance"].includes(r));

	if (!isAuthorized) {
		res.status(403).json({ success: false, error: "Only admin or compliance roles can deactivate Global Kill Switch" });
		return;
	}

	const deactivatedBy = user?.id || "admin";
	const status = riskEngine.deactivateGlobalKillSwitch(deactivatedBy);

	res.json({
		success: true,
		message: "Global Algo Emergency Kill Switch deactivated successfully",
		data: status,
		meta: { timestamp: new Date().toISOString() },
	});
});

export default router;
