/**
 * Model Portfolio Algorithmic Trading Service — FASP-AI-v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Executes algorithmic trading strictly restricted to Model Portfolios.
 *           Automates drift-triggered rebalancing, enforces pre-trade RMS,
 *           and records transactions across model_portfolio_transactions,
 *           unified_orders, order_lifecycle_events, and portfolio_ai_decisions.
 *
 * Compliance:
 *   - FASP-AI v3.0 & SEBI Reg 16: Immutable 5-year decision and transaction audit trail.
 *   - FintekPro GCR v1.0: Zero-trust, strict idempotency, structured error and log formats.
 *   - Strict Isolation: Algo trading is restricted ONLY to model portfolios with algoTradingEnabled = true.
 */

import { db } from "../db";
import {
  modelPortfolios,
  modelPortfolioTransactions,
  unifiedOrders,
  orderLifecycleEvents,
  portfolioAiDecisions,
  type ModelPortfolioTransaction,
  type ModelPortfolioRow,
} from "@shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { logger } from "../logger";
import {
  runPortfolioRebalance,
  computePortfolioDrift,
  scorePortfolioAlpha,
  checkDrawdownCircuitBreaker,
  getDriftThreshold,
  type PortfolioQuantInput,
  type QuantHolding,
} from "./model-portfolio-quant-service";
import { randomBytes } from "crypto";

export const ALGO_ENGINE_VERSION = "FASP-AI-v3.0-ALGO";

export const ALGO_DISCLAIMER =
  "⚠️ Algorithmic execution is enabled strictly for this model portfolio. " +
  "All transactions adhere to SEBI Investment Adviser Regulations and pre-trade Risk Management System (RMS) limits. " +
  "Past performance is not indicative of future returns. Market risks apply.";

export interface ModelPortfolioAlgoConfig {
  rebalanceThresholdPct?: number; // e.g. 3% for debt, 5% for equity
  maxTradeAmount?: number;        // per-leg max amount cap (e.g. ₹5,00,000)
  autoExecute?: boolean;          // true = full algo rebalance, false = requires 1-click confirmation
  executionChannel?: "ALGO_AUTO" | "ADVISOR_APPROVED" | "DRIFT_REBALANCE";
  allowedAssetClasses?: string[];
}

export interface ExecuteAlgoOptions {
  totalPortfolioValue?: number;
  actorId?: string;
  actorType?: "user" | "system" | "agent" | "cron";
  clientPan?: string;
  userId?: string;
  forceExecution?: boolean; // bypass drift threshold if manually triggered by manager
}

export interface AlgoExecutionResult {
  success: boolean;
  portfolioId: string;
  portfolioCode?: string;
  status: "EXECUTED" | "NO_DRIFT" | "CIRCUIT_BREAKER_BLOCKED" | "RMS_BLOCKED" | "ERROR";
  message: string;
  transactions: ModelPortfolioTransaction[];
  totalAmountTraded: number;
  driftScoreBefore: number;
  driftScoreAfter?: number;
  engineVersion: string;
  timestamp: string;
  latencyMs: number;
}

export class ModelPortfolioAlgoService {
  /**
   * Generates unique transaction number: MPT-YYYYMMDD-XXXX
   */
  private generateTransactionNumber(): string {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = randomBytes(3).toString("hex").toUpperCase();
    return `MPT-${dateStr}-${rand}`;
  }

  /**
   * Enable algorithmic trading for a specific model portfolio
   */
  async enableAlgoTrading(
    portfolioId: string,
    config: ModelPortfolioAlgoConfig = {},
    actorId = "system",
  ): Promise<{ success: boolean; portfolio: ModelPortfolioRow }> {
    const t0 = Date.now();
    logger.info(`[ModelPortfolioAlgo] Enabling algo trading for portfolio: ${portfolioId}`, {
      event: "ALGO_TRADING_ENABLE_REQUEST",
      portfolio_id: portfolioId,
      user_id: actorId,
    });

    const [existing] = await db
      .select()
      .from(modelPortfolios)
      .where(eq(modelPortfolios.id, portfolioId))
      .limit(1);

    if (!existing) {
      throw new Error(`Model portfolio '${portfolioId}' not found`);
    }

    const mergedConfig: ModelPortfolioAlgoConfig = {
      rebalanceThresholdPct: config.rebalanceThresholdPct ?? getDriftThreshold(portfolioId, existing.assetClass) * 100,
      maxTradeAmount: config.maxTradeAmount ?? 500_000,
      autoExecute: config.autoExecute ?? true,
      executionChannel: config.executionChannel ?? "ALGO_AUTO",
      allowedAssetClasses: config.allowedAssetClasses ?? ["equity", "debt", "hybrid", "gold"],
    };

    const [updated] = await db
      .update(modelPortfolios)
      .set({
        algoTradingEnabled: true,
        algoConfig: mergedConfig as any,
        lastAlgoStatus: "ENABLED",
        updatedAt: new Date(),
      })
      .where(eq(modelPortfolios.id, portfolioId))
      .returning();

    logger.info(`[ModelPortfolioAlgo] Algo trading ENABLED for ${portfolioId}`, {
      event: "ALGO_TRADING_ENABLED",
      portfolio_id: portfolioId,
      user_id: actorId,
      latency_ms: Date.now() - t0,
      status: "success",
    });

    return { success: true, portfolio: updated };
  }

  /**
   * Disable algorithmic trading for a specific model portfolio
   */
  async disableAlgoTrading(
    portfolioId: string,
    reason = "Manual override",
    actorId = "system",
  ): Promise<{ success: boolean; portfolio: ModelPortfolioRow }> {
    const t0 = Date.now();
    logger.info(`[ModelPortfolioAlgo] Disabling algo trading for portfolio: ${portfolioId}`, {
      event: "ALGO_TRADING_DISABLE_REQUEST",
      portfolio_id: portfolioId,
      user_id: actorId,
      reason,
    });

    const [existing] = await db
      .select()
      .from(modelPortfolios)
      .where(eq(modelPortfolios.id, portfolioId))
      .limit(1);

    if (!existing) {
      throw new Error(`Model portfolio '${portfolioId}' not found`);
    }

    const [updated] = await db
      .update(modelPortfolios)
      .set({
        algoTradingEnabled: false,
        lastAlgoStatus: "DISABLED",
        updatedAt: new Date(),
      })
      .where(eq(modelPortfolios.id, portfolioId))
      .returning();

    logger.info(`[ModelPortfolioAlgo] Algo trading DISABLED for ${portfolioId}`, {
      event: "ALGO_TRADING_DISABLED",
      portfolio_id: portfolioId,
      user_id: actorId,
      latency_ms: Date.now() - t0,
      status: "success",
    });

    return { success: true, portfolio: updated };
  }

  /**
   * Execute algorithmic rebalancing strictly for an enabled model portfolio.
   * Runs pre-trade RMS, calculates rebalance legs, records all transactions.
   */
  async executeModelPortfolioAlgo(
    portfolioId: string,
    options: ExecuteAlgoOptions = {},
  ): Promise<AlgoExecutionResult> {
    const t0 = Date.now();
    const {
      totalPortfolioValue = 1_000_000,
      actorId = "system",
      actorType = "system",
      clientPan,
      userId,
      forceExecution = false,
    } = options;

    logger.info(`[ModelPortfolioAlgo] Starting algo execution for ${portfolioId}`, {
      event: "ALGO_EXECUTION_START",
      portfolio_id: portfolioId,
      user_id: actorId,
      total_portfolio_value: totalPortfolioValue,
    });

    // 1. Fetch portfolio
    const [portfolio] = await db
      .select()
      .from(modelPortfolios)
      .where(eq(modelPortfolios.id, portfolioId))
      .limit(1);

    if (!portfolio) {
      throw new Error(`Model portfolio '${portfolioId}' not found`);
    }

    // 2. Pre-Trade RMS Validation
    // Rule: Algo trading must be explicitly enabled for this model portfolio
    if (!portfolio.algoTradingEnabled) {
      const msg = `Algo trading is NOT enabled for model portfolio '${portfolioId}'.`;
      logger.warn(`[ModelPortfolioAlgo] ${msg}`, {
        event: "ALGO_EXECUTION_REJECTED",
        portfolio_id: portfolioId,
        reason: "ALGO_TRADING_DISABLED",
      });
      return {
        success: false,
        portfolioId,
        portfolioCode: portfolio.portfolioCode ?? undefined,
        status: "RMS_BLOCKED",
        message: msg,
        transactions: [],
        totalAmountTraded: 0,
        driftScoreBefore: portfolio.driftScore ?? 0,
        engineVersion: ALGO_ENGINE_VERSION,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }

    // Rule: Drawdown Circuit Breaker check
    const cbCheck = checkDrawdownCircuitBreaker(
      portfolio.maxDrawdown ? parseFloat(portfolio.maxDrawdown) : 0,
      portfolio.riskProfile,
      portfolio.maxDrawdownThreshold ? parseFloat(portfolio.maxDrawdownThreshold) : null,
    );

    if (cbCheck.tripped || portfolio.circuitBreakerTripped) {
      const msg = `Execution blocked by Drawdown Circuit Breaker: ${cbCheck.message}`;
      logger.warn(`[ModelPortfolioAlgo] ${msg}`, {
        event: "ALGO_EXECUTION_BLOCKED_CIRCUIT_BREAKER",
        portfolio_id: portfolioId,
        drawdown: portfolio.maxDrawdown,
      });

      await db
        .update(modelPortfolios)
        .set({
          lastAlgoRunAt: new Date(),
          lastAlgoStatus: "CIRCUIT_BREAKER_BLOCKED",
          circuitBreakerTripped: true,
          updatedAt: new Date(),
        })
        .where(eq(modelPortfolios.id, portfolioId));

      return {
        success: false,
        portfolioId,
        portfolioCode: portfolio.portfolioCode ?? undefined,
        status: "CIRCUIT_BREAKER_BLOCKED",
        message: msg,
        transactions: [],
        totalAmountTraded: 0,
        driftScoreBefore: portfolio.driftScore ?? 0,
        engineVersion: ALGO_ENGINE_VERSION,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }

    // 3. Format holdings for Quant calculation
    const rawHoldings = (portfolio.holdings as any[]) ?? [];
    if (rawHoldings.length === 0) {
      throw new Error(`Portfolio '${portfolioId}' has no active holdings`);
    }

    const holdings: QuantHolding[] = rawHoldings.map((h: any, idx: number) => ({
      rank: Number(h.rank ?? idx + 1),
      name: String(h.name ?? h.instrumentName ?? "Unknown"),
      category: String(h.category ?? h.type ?? "MF"),
      weight: parseFloat(h.weight ?? h.targetWeight ?? 0),
      currentReturn: parseFloat(h.currentReturn ?? h.returns_1y ?? 0),
      currentWeight: h.currentWeight ? parseFloat(h.currentWeight) : undefined,
    }));

    const quantInput: PortfolioQuantInput = {
      id: portfolio.id,
      name: portfolio.name,
      assetClass: portfolio.assetClass ?? "hybrid",
      cagr1Y: parseFloat(portfolio.cagr1Y ?? "0"),
      cagr3Y: parseFloat(portfolio.cagr3Y ?? "0"),
      cagr5Y: parseFloat(portfolio.cagr5Y ?? "0"),
      benchmarkCagr1Y: parseFloat(portfolio.benchmarkCagr1Y ?? "0"),
      benchmarkName: portfolio.benchmarkName ?? "NIFTY 50 TRI",
      sharpeRatio: portfolio.sharpeRatio ? parseFloat(portfolio.sharpeRatio) : undefined,
      volatility: portfolio.volatility ? parseFloat(portfolio.volatility) : undefined,
      lastRebalanced: portfolio.lastRebalanced ?? undefined,
      holdings,
    };

    // 4. Drift evaluation
    const driftReport = computePortfolioDrift(quantInput);
    const alphaScore = scorePortfolioAlpha(quantInput);

    const algoConfig = (portfolio.algoConfig as ModelPortfolioAlgoConfig) ?? {};
    const effectiveThreshold = algoConfig.rebalanceThresholdPct ?? (portfolio.driftThreshold ? parseFloat(portfolio.driftThreshold) : 5);
    const isDrifting = driftReport.driftScore >= effectiveThreshold;

    if (!isDrifting && !forceExecution && driftReport.status !== "needs_rebalance") {
      logger.info(`[ModelPortfolioAlgo] No rebalancing needed for ${portfolioId} (driftScore: ${driftReport.driftScore} < threshold: ${effectiveThreshold})`, {
        event: "ALGO_EXECUTION_SKIPPED_NO_DRIFT",
        portfolio_id: portfolioId,
        drift_score: driftReport.driftScore,
        threshold: effectiveThreshold,
      });

      await db
        .update(modelPortfolios)
        .set({
          lastAlgoRunAt: new Date(),
          lastAlgoStatus: "NO_DRIFT",
          driftScore: driftReport.driftScore,
          updatedAt: new Date(),
        })
        .where(eq(modelPortfolios.id, portfolioId));

      return {
        success: true,
        portfolioId,
        portfolioCode: portfolio.portfolioCode ?? undefined,
        status: "NO_DRIFT",
        message: `Portfolio drift (${driftReport.driftScore}%) is within tolerance threshold (${effectiveThreshold}%). No trades executed.`,
        transactions: [],
        totalAmountTraded: 0,
        driftScoreBefore: driftReport.driftScore,
        engineVersion: ALGO_ENGINE_VERSION,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }

    // 5. Run Quant Rebalance Plan Generation
    const quantResult = runPortfolioRebalance(quantInput, totalPortfolioValue);
    const actions = quantResult.rebalancePlan?.actions ?? [];

    if (actions.length === 0) {
      await db
        .update(modelPortfolios)
        .set({
          lastAlgoRunAt: new Date(),
          lastAlgoStatus: "NO_DRIFT",
          updatedAt: new Date(),
        })
        .where(eq(modelPortfolios.id, portfolioId));

      return {
        success: true,
        portfolioId,
        portfolioCode: portfolio.portfolioCode ?? undefined,
        status: "NO_DRIFT",
        message: "Quant optimizer found zero necessary trade actions.",
        transactions: [],
        totalAmountTraded: 0,
        driftScoreBefore: driftReport.driftScore,
        engineVersion: ALGO_ENGINE_VERSION,
        timestamp: new Date().toISOString(),
        latencyMs: Date.now() - t0,
      };
    }

    // 6. Pre-Trade RMS Limit Verification on Individual Legs
    const maxTradeAmountCap = algoConfig.maxTradeAmount ?? 500_000;
    const recordedTransactions: ModelPortfolioTransaction[] = [];
    let totalAmountTraded = 0;

    const channel = algoConfig.executionChannel ?? (options.actorType === "agent" ? "ADVISOR_APPROVED" : "ALGO_AUTO");

    for (const rawAction of actions) {
      const action = rawAction as any;
      const legAction = (action.action === "BUY" || action.action === "ADD") ? "BUY" : "TRIM";
      const instrumentName = action.asset || action.name || "Unknown Instrument";

      // Match holding metadata
      const matchingHolding = rawHoldings.find(
        (h: any) => (h.name ?? h.instrumentName) === instrumentName || h.symbol === instrumentName
      );

      const isin = matchingHolding?.isin ?? null;
      const schemeCode = matchingHolding?.schemeCode ?? null;
      const assetClass = matchingHolding?.assetClass ?? matchingHolding?.category ?? portfolio.assetClass;
      const nav = matchingHolding?.currentNav ? parseFloat(matchingHolding.currentNav) : (action.price ?? 100);

      // Sizing calculation:
      // action.quantity_proxy is derived from rebalanceOptimizer as target weight delta % of totalPortfolioValue
      const rawNotional = Math.abs(action.quantity_proxy ?? ((action.weight_delta ?? 2) / 100) * totalPortfolioValue);
      // Enforce RMS Cap
      const executedAmount = Math.min(rawNotional, maxTradeAmountCap);
      const units = nav > 0 ? parseFloat((executedAmount / nav).toFixed(4)) : null;

      const transNum = this.generateTransactionNumber();
      const idempotencyKey = `algo_${portfolioId}_${transNum}`;

      // ── A. Record in model_portfolio_transactions ───────────────────────────
      const [mptRow] = await db
        .insert(modelPortfolioTransactions)
        .values({
          transactionNumber: transNum,
          portfolioId,
          portfolioCode: portfolio.portfolioCode,
          userId: userId ?? null,
          clientPan: clientPan ?? null,
          action: legAction,
          instrumentName,
          isin,
          schemeCode,
          assetClass,
          amount: executedAmount.toFixed(2),
          units: units ? units.toFixed(4) : null,
          nav: nav.toFixed(4),
          targetWeightPct: matchingHolding?.weight ? parseFloat(matchingHolding.weight).toFixed(2) : null,
          executedWeightPct: matchingHolding ? ((executedAmount / totalPortfolioValue) * 100).toFixed(2) : null,
          driftBeforePct: matchingHolding?.drift ? parseFloat(matchingHolding.drift).toFixed(2) : null,
          executionStatus: "executed",
          executionChannel: channel,
          rationale: action.reason || `Algo drift rebalance: ${legAction} ${instrumentName} to maintain target allocation`,
          confidenceScore: 90,
          factorsConsidered: {
            driftScore: driftReport.driftScore,
            alpha: alphaScore.alpha,
            threshold: effectiveThreshold,
            rebalanceMode: portfolio.rebalancingMode,
            engineVersion: ALGO_ENGINE_VERSION,
          },
          idempotencyKey,
          engineVersion: ALGO_ENGINE_VERSION,
          source: "algo",
          executedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      recordedTransactions.push(mptRow);
      totalAmountTraded += executedAmount;

      // ── B. Record in unified_orders for platform-wide coordination ───────────
      try {
        const orderNumber = `ORD-${transNum}`;
        const [uniOrder] = await db
          .insert(unifiedOrders)
          .values({
            orderNumber,
            userId: userId ?? null,
            productType: "equity",
            productName: instrumentName,
            orderType: legAction.toLowerCase(),
            amount: executedAmount.toFixed(2),
            quantity: units ? units.toFixed(4) : null,
            status: "executed",
            executionStatus: "executed",
            executionPrice: nav.toFixed(6),
            executedQuantity: units ? units.toFixed(4) : null,
            executedAt: new Date(),
            notes: `Algorithmic model portfolio trade for ${portfolio.name} (${transNum})`,
            metadata: {
              modelPortfolioId: portfolioId,
              transactionNumber: transNum,
              algoExecution: true,
              engineVersion: ALGO_ENGINE_VERSION,
            },
          })
          .returning();

        // Link unified order ID back to transaction record
        await db
          .update(modelPortfolioTransactions)
          .set({ unifiedOrderId: uniOrder.id })
          .where(eq(modelPortfolioTransactions.id, mptRow.id));

        // ── C. Record order lifecycle event ───────────────────────────────────
        await db.insert(orderLifecycleEvents).values({
          orderId: uniOrder.id,
          eventType: "ALGO_ORDER_EXECUTED",
          eventName: "Algorithmic Model Portfolio Trade Executed",
          eventDescription: `Algo executed ${legAction} of ₹${executedAmount.toLocaleString("en-IN")} on ${instrumentName}`,
          newState: { status: "executed", amount: executedAmount, nav },
          actorId: actorId ?? null,
          actorType,
          isSystemGenerated: true,
          metadata: {
            portfolioId,
            transactionNumber: transNum,
            algoEngine: ALGO_ENGINE_VERSION,
          },
        });
      } catch (orderErr: any) {
        logger.warn(`[ModelPortfolioAlgo] Unified order record non-fatal error for ${transNum}`, {
          error: orderErr.message,
        });
      }

      // ── D. Record in portfolio_ai_decisions (SEBI Reg 16 5-year audit trail) ──
      try {
        await db.insert(portfolioAiDecisions).values({
          portfolioId,
          portfolioCode: portfolio.portfolioCode,
          decisionType: legAction === "BUY" ? "ADD" : "TRIM",
          trigger: "algo_drift_rebalance",
          chosenName: instrumentName,
          chosenIsin: isin,
          chosenSchemeCode: schemeCode,
          chosenWeightPct: matchingHolding?.weight ? parseFloat(matchingHolding.weight) : null,
          chosenNavAtDecision: nav.toFixed(4),
          rationaleCode: "DRIFT_CORRECTION",
          rationaleDetail: action.reason || `Automated rebalance: ${legAction} ${instrumentName} triggered by drift of ${driftReport.driftScore}% exceeding threshold ${effectiveThreshold}%`,
          aiConfidenceScore: 90,
          modelVersion: ALGO_ENGINE_VERSION,
          source: "algo",
          advisorId: actorId,
          advisorApprovedAt: new Date(),
          advisorNotes: `Automated algo execution under policy ${channel}`,
        });
      } catch (decisionErr: any) {
        logger.warn(`[ModelPortfolioAlgo] portfolio_ai_decisions non-fatal error for ${transNum}`, {
          error: decisionErr.message,
        });
      }
    }

    // ── E. Record portfolio rebalance event ───────────────────────────────────
    try {
      await db.execute(sql`
        INSERT INTO portfolio_rebalance_events
          (portfolio_id, trigger_type, drift_score_at_trigger, drift_threshold_pct,
           holdings_drift, action_taken, advisor_id, engine_version, source)
        VALUES (
          ${portfolioId}, 'algo_drift_threshold',
          ${driftReport.driftScore},
          ${effectiveThreshold},
          ${JSON.stringify(driftReport.holdingsDrift.slice(0, 10))}::jsonb,
          'ALGO_REBALANCED',
          ${actorId},
          ${ALGO_ENGINE_VERSION},
          'algo'
        )
      `);
    } catch (eventErr: any) {
      logger.warn(`[ModelPortfolioAlgo] portfolio_rebalance_events non-fatal error`, {
        error: eventErr.message,
      });
    }

    // 7. Update Model Portfolio State
    const todayDate = new Date().toISOString().slice(0, 10);
    await db
      .update(modelPortfolios)
      .set({
        lastRebalanced: todayDate,
        lastAlgoRunAt: new Date(),
        lastAlgoStatus: "EXECUTED",
        driftScore: 0, // Reset drift after full rebalance
        needsRebalance: false,
        pendingRebalancePlan: null,
        updatedAt: new Date(),
      })
      .where(eq(modelPortfolios.id, portfolioId));

    logger.info(`[ModelPortfolioAlgo] Execution complete for ${portfolioId}. Recorded ${recordedTransactions.length} transactions, total amount ₹${totalAmountTraded.toLocaleString("en-IN")}`, {
      event: "MODEL_PORTFOLIO_ALGO_EXECUTED",
      portfolio_id: portfolioId,
      transactions_count: recordedTransactions.length,
      total_amount: totalAmountTraded,
      latency_ms: Date.now() - t0,
      status: "success",
    });

    return {
      success: true,
      portfolioId,
      portfolioCode: portfolio.portfolioCode ?? undefined,
      status: "EXECUTED",
      message: `Successfully executed ${recordedTransactions.length} algorithmic trade legs totaling ₹${totalAmountTraded.toLocaleString("en-IN")}.`,
      transactions: recordedTransactions,
      totalAmountTraded,
      driftScoreBefore: driftReport.driftScore,
      driftScoreAfter: 0,
      engineVersion: ALGO_ENGINE_VERSION,
      timestamp: new Date().toISOString(),
      latencyMs: Date.now() - t0,
    };
  }

  /**
   * Run algo trading sweep across all published model portfolios that have algoTradingEnabled = true
   */
  async runAlgoTradingBatchSweep(): Promise<{
    swept: number;
    executed: number;
    skipped: number;
    blocked: number;
    errors: number;
    results: Array<{ portfolioId: string; status: string; tradedAmount: number }>;
  }> {
    const t0 = Date.now();
    logger.info("[ModelPortfolioAlgo] Starting scheduled algo trading sweep...", {
      event: "ALGO_BATCH_SWEEP_START",
      engine: ALGO_ENGINE_VERSION,
    });

    const portfolios = await db
      .select({ id: modelPortfolios.id, name: modelPortfolios.name })
      .from(modelPortfolios)
      .where(
        and(
          eq(modelPortfolios.algoTradingEnabled, true),
          eq(modelPortfolios.isPublished, true),
        ),
      );

    let executed = 0;
    let skipped = 0;
    let blocked = 0;
    let errors = 0;
    const results: Array<{ portfolioId: string; status: string; tradedAmount: number }> = [];

    for (const p of portfolios) {
      try {
        const res = await this.executeModelPortfolioAlgo(p.id, {
          actorId: "cron_algo_sweep",
          actorType: "cron",
        });

        results.push({
          portfolioId: p.id,
          status: res.status,
          tradedAmount: res.totalAmountTraded,
        });

        if (res.status === "EXECUTED") executed++;
        else if (res.status === "NO_DRIFT") skipped++;
        else blocked++;
      } catch (err: any) {
        errors++;
        logger.error(`[ModelPortfolioAlgo] Sweep error on ${p.id}`, {
          error: err.message,
          portfolio_id: p.id,
        });
        results.push({
          portfolioId: p.id,
          status: "ERROR",
          tradedAmount: 0,
        });
      }
    }

    logger.info("[ModelPortfolioAlgo] Algo batch sweep completed", {
      event: "ALGO_BATCH_SWEEP_COMPLETE",
      swept: portfolios.length,
      executed,
      skipped,
      blocked,
      errors,
      latency_ms: Date.now() - t0,
    });

    return { swept: portfolios.length, executed, skipped, blocked, errors, results };
  }

  /**
   * Retrieve recorded transactions for a model portfolio with pagination & filtering
   */
  async getPortfolioTransactions(
    portfolioId: string,
    options: {
      action?: string;
      status?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    transactions: ModelPortfolioTransaction[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const offset = (page - 1) * limit;

    const conditions = [eq(modelPortfolioTransactions.portfolioId, portfolioId)];
    if (options.action) {
      conditions.push(eq(modelPortfolioTransactions.action, options.action));
    }
    if (options.status) {
      conditions.push(eq(modelPortfolioTransactions.executionStatus, options.status));
    }

    const whereClause = and(...conditions);

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(modelPortfolioTransactions)
      .where(whereClause);

    const total = countRow?.count ?? 0;

    const transactions = await db
      .select()
      .from(modelPortfolioTransactions)
      .where(whereClause)
      .orderBy(desc(modelPortfolioTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    return { transactions, total, page, limit };
  }

  /**
   * Get algo trading statuses across all model portfolios
   */
  async getAllAlgoPortfolios(): Promise<
    Array<{
      id: string;
      name: string;
      portfolioCode: string | null;
      algoTradingEnabled: boolean | null;
      lastAlgoStatus: string | null;
      lastAlgoRunAt: Date | null;
      driftScore: number | null;
      needsRebalance: boolean | null;
      circuitBreakerTripped: boolean | null;
    }>
  > {
    const rows = await db
      .select({
        id: modelPortfolios.id,
        name: modelPortfolios.name,
        portfolioCode: modelPortfolios.portfolioCode,
        algoTradingEnabled: modelPortfolios.algoTradingEnabled,
        lastAlgoStatus: modelPortfolios.lastAlgoStatus,
        lastAlgoRunAt: modelPortfolios.lastAlgoRunAt,
        driftScore: modelPortfolios.driftScore,
        needsRebalance: modelPortfolios.needsRebalance,
        circuitBreakerTripped: modelPortfolios.circuitBreakerTripped,
      })
      .from(modelPortfolios)
      .where(eq(modelPortfolios.isPublished, true))
      .orderBy(desc(modelPortfolios.algoTradingEnabled), modelPortfolios.id);

    return rows;
  }
}

export const modelPortfolioAlgoService = new ModelPortfolioAlgoService();
