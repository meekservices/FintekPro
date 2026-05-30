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

import { Router, Response } from "express";
import { z } from "zod";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { algoSignalEngine, algoBacktestEngine, RiskProfile } from "../services/algo-signal-engine";
import { requireAuth } from "../middleware/auth";
import { db } from "../db";
import { algoSignals } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import type { AuthRequest } from "../types/broker-types";
import { logger } from "../logger";
import { auditLog } from "../middleware/audit-trail";

const router = Router();
router.use(requireAuth);

// Rate limiters
const generateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req) => (req as AuthRequest).user?.id?.toString() || ipKeyGenerator(req),
  message: { success: false, error: "Max 5 signal generations/minute.", retryable: true },
});

const actionLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  keyGenerator: (req) => (req as AuthRequest).user?.id?.toString() || ipKeyGenerator(req),
  message: { success: false, error: "Too many actions. Slow down.", retryable: true },
});

// ─── Validation schemas ───────────────────────────────────────────────────────

const generateSchema = z.object({
  symbols:           z.array(z.string().min(1).max(10)).min(1).max(20),
  riskProfile:       z.enum(["conservative", "moderate", "aggressive", "very_aggressive"]).default("moderate"),
  investmentHorizon: z.enum(["short", "medium", "long"]).default("medium"),
});

const approveSchema = z.object({
  orderId: z.string().optional(), // Alpaca order ID if already placed
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getUserId(req: AuthRequest): number {
  const id = req.user?.id;
  if (!id) throw new Error("Unauthenticated");
  return typeof id === "string" ? parseInt(id, 10) : id;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * POST /signals/generate
 * Run the signal engine for given symbols and persist results.
 */
router.post("/signals/generate", generateLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = generateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
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
        timestamp:    new Date().toISOString(),
        version:      "algo-v1.0",
        disclaimer:   "Signals are for informational purposes only. Not financial advice.",
      },
    });
  } catch (err: any) {
    logger.error("[AlgoRoutes] generate error", { error: err.message });
    res.status(500).json({ success: false, error: err.message, retryable: false });
  }
});

/**
 * GET /signals
 * List signals for the authenticated user.
 * Query params: status, symbol, page, limit
 */
router.get("/signals", actionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const limit  = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const page   = Math.max(parseInt(req.query.page  as string) || 1, 1);

    const signals = await algoSignalEngine.listSignals(userId, {
      status: req.query.status as string,
      symbol: req.query.symbol as string,
      limit,
      page,
    });

    res.json({
      success: true,
      data: signals,
      meta: { page, limit, count: signals.length, timestamp: new Date().toISOString(), version: "1.0" },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /signals/:id
 * Get a single signal with full factor breakdown.
 */
router.get("/signals/:id", actionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId   = getUserId(req);
    const signalId = parseInt(req.params.id, 10);
    if (isNaN(signalId)) { res.status(400).json({ success: false, error: "Invalid signal ID" }); return; }

    const [signal] = await db
      .select()
      .from(algoSignals)
      .where(and(eq(algoSignals.id, signalId), eq(algoSignals.userId, userId)))
      .limit(1);

    if (!signal) { res.status(404).json({ success: false, error: "Signal not found" }); return; }

    res.json({ success: true, data: signal, meta: { timestamp: new Date().toISOString(), version: "1.0" } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /signals/:id/approve
 * Approve a signal. Optionally supply orderId if order was already placed.
 *
 * FASP-AI v1.0: This endpoint marks user intent to act.
 * Actual order placement is done via the existing /broker/accounts/:id/orders endpoint.
 */
router.post("/signals/:id/approve", actionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId   = getUserId(req);
    const signalId = parseInt(req.params.id, 10);
    if (isNaN(signalId)) { res.status(400).json({ success: false, error: "Invalid signal ID" }); return; }

    const parsed = approveSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ success: false, error: parsed.error.flatten() }); return; }

    const updated = await algoSignalEngine.approveSignal(signalId, userId, parsed.data.orderId);

    res.json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * POST /signals/:id/reject
 * Reject a signal — user dismissed it.
 */
router.post("/signals/:id/reject", actionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId   = getUserId(req);
    const signalId = parseInt(req.params.id, 10);
    if (isNaN(signalId)) { res.status(400).json({ success: false, error: "Invalid signal ID" }); return; }

    const updated = await algoSignalEngine.rejectSignal(signalId, userId);
    res.json({ success: true, data: updated, meta: { timestamp: new Date().toISOString(), version: "1.0" } });
  } catch (err: any) {
    const status = err.message.includes("not found") ? 404 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

/**
 * GET /performance
 * Signal statistics for the authenticated user.
 */
router.get("/performance", actionLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = getUserId(req);
    const performance = await algoSignalEngine.getPerformance(userId);
    res.json({ success: true, data: performance, meta: { timestamp: new Date().toISOString(), version: "1.0" } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Backtesting ──────────────────────────────────────────────────────────────

const backtestLimiter = rateLimit({
  windowMs: 60_000,
  max: 3, // Alpaca historical data calls are expensive — cap at 3/min
  keyGenerator: (req) => (req as AuthRequest).user?.id?.toString() || ipKeyGenerator(req),
  message: { success: false, error: "Max 3 backtests/minute. Alpaca data rate-limited.", retryable: true },
});

const backtestSchema = z.object({
  symbol:         z.string().min(1).max(10).transform(s => s.toUpperCase()),
  startDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  riskProfile:    z.enum(["conservative", "moderate", "aggressive", "very_aggressive"]).default("moderate"),
  initialCapital: z.number().min(1000).max(1_000_000).default(10000),
  strategy:       z.enum(["composite", "sma_crossover", "rsi", "momentum"]).default("composite"),
}).refine(data => {
  // Enforce max 2-year lookback (free Alpaca tier)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return data.startDate >= twoYearsAgo.toISOString().split("T")[0];
}, { message: "startDate cannot be more than 2 years ago (free Alpaca data tier limit)" })
.refine(data => data.endDate > data.startDate, { message: "endDate must be after startDate" })
.refine(data => data.endDate <= new Date().toISOString().split("T")[0], { message: "endDate cannot be in the future" });

/**
 * POST /backtest
 * Run a walk-forward strategy backtest using Alpaca historical daily bars.
 *
 * FASP-AI v1.0: Result is hypothetical — mandatory disclaimer included.
 * Decision Support System only. Does not constitute financial advice.
 *
 * Body: { symbol, startDate, endDate, riskProfile, initialCapital, strategy }
 */
router.post("/backtest", backtestLimiter, async (req: AuthRequest, res: Response): Promise<void> => {
  const startMs = Date.now();
  try {
    const userId = getUserId(req);
    const parsed = backtestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.flatten().fieldErrors });
      return;
    }
    const config = parsed.data;

    const result = await algoBacktestEngine.runBacktest({
      symbol:         config.symbol,
      startDate:      config.startDate,
      endDate:        config.endDate,
      riskProfile:    config.riskProfile as RiskProfile,
      initialCapital: config.initialCapital,
      strategy:       config.strategy,
    });

    // Audit log — backtest runs are logged for governance
    await auditLog({
      action:    "algo_backtest_run",
      category:  "trading",
      outcome:   "success",
      riskLevel: "low",
      details: {
        event:         "ALGO_BACKTEST_RUN",
        user_id:       userId,
        symbol:        config.symbol,
        strategy:      config.strategy,
        date_range:    `${config.startDate}→${config.endDate}`,
        total_trades:  result.summary.totalTrades,
        win_rate:      result.summary.winRate,
        sharpe:        result.summary.sharpeRatio,
        model_version: result.modelVersion,
        latency_ms:    Date.now() - startMs,
        timestamp:     new Date().toISOString(),
      },
    }).catch(() => {});

    res.json({
      success: true,
      data: result,
      meta: {
        timestamp:   new Date().toISOString(),
        version:     "algo-v1.0",
        disclaimer:  "Backtested results are hypothetical. Past performance does not predict future returns. Not financial advice.",
        latency_ms:  Date.now() - startMs,
      },
    });
  } catch (err: any) {
    logger.error("[AlgoRoutes] backtest error", { error: err.message });
    res.status(err.message.includes("Insufficient") ? 422 : 500).json({
      success: false,
      error:   err.message,
      retryable: false,
    });
  }
});

export default router;
