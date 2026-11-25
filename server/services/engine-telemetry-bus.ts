/**
 * @module engine-telemetry-bus
 * @description Central engine telemetry bus for FintekPro.
 *
 * Purpose:
 *   Engines call `telemetryBus.report()` after each generation cycle.
 *   The bus aggregates signals, computes a composite α-quality score,
 *   and exposes `getStatus()` / `getAlphaSignal()` for the health dashboard
 *   and for cross-engine calibration.
 *
 * Design:
 *   - In-memory rolling window (last 100 reports per engine)
 *   - Redis backing for persistence across Cloud Run instance restarts
 *   - Non-blocking: every `report()` call is fire-and-forget
 *
 * GCR v1.0 / FASP-AI v3.0 compliance:
 *   - Structured logs: { event, user_id, latency_ms, status }
 *   - engine_version and calculation_timestamp on every output
 *
 * @version 1.0.0
 */

import { logger } from "../logger";

const BUS_VERSION = "1.0.0";
const MAX_REPORTS_PER_ENGINE = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

export type EngineCategory =
  | "Alpha Generation"
  | "Portfolio"
  | "Risk & Regime"
  | "AI Orchestration"
  | "Data Quality"
  | "Compliance"
  | "Transaction"
  | "Background Services"
  | "Execution & Rebalancing";

export interface EngineReport {
  engineId: string;
  engineName: string;
  category: EngineCategory;
  reportedAt: string;
  latencyMs: number;
  /** 0–100 composite quality score for the output */
  qualityScore: number;
  itemsProcessed: number;
  errorCount: number;
  meta?: Record<string, unknown>;
}

export interface EngineHealthStatus {
  engineId: string;
  engineName: string;
  category: EngineCategory;
  health: "healthy" | "degraded" | "critical" | "unknown";
  p50LatencyMs: number;
  avgQualityScore: number;
  /** 0–1 */
  errorRate: number;
  reportCount: number;
  lastReportedAt: string | null;
  lastMeta?: Record<string, unknown>;
}

export interface AlphaSignal {
  /**
   * Composite α-quality: weighted avg of Alpha Generation + Portfolio engine scores.
   * ≥ 80 → "strong" | ≥ 60 → "moderate" | ≥ 40 → "weak" | < 40 → "poor"
   */
  alphaQuality: number;
  alphaLabel: "strong" | "moderate" | "weak" | "poor";
  regime: string;
  systemHealth: "HEALTHY" | "DEGRADED" | "CRITICAL";
  degradedEngines: number;
  failedEngines: number;
  calculatedAt: string;
  bus_version: string;
}

// ── Bus Implementation ─────────────────────────────────────────────────────────

class EngineTelemetryBus {
  private readonly _buffer = new Map<string, EngineReport[]>();
  private readonly _meta = new Map<string, { name: string; category: EngineCategory }>();
  private _latestRegime = "unknown";

  constructor() {
    this._seedCoreEngines();
    void this.hydrateFromRedis();
  }

  private _seedCoreEngines(): void {
    const coreEngines: Array<{ id: string; name: string; category: EngineCategory }> = [
      { id: "pick-of-the-day", name: "Pick of the Day Engine", category: "Alpha Generation" },
      { id: "pro-thematic-screener", name: "Pro Thematic Screener", category: "Alpha Generation" },
      { id: "fast-analytical-engine", name: "Fast Analytical In-Memory Engine", category: "Alpha Generation" },
      { id: "derived-metrics-engine", name: "Screener Derived Metrics Engine", category: "Alpha Generation" },
      { id: "institutional-flow", name: "Institutional Ownership & Flow Engine", category: "Alpha Generation" },
      { id: "exit-strategy-engine", name: "Algorithmic Trailing Exit Engine", category: "Alpha Generation" },
      { id: "model-portfolio-optimizer", name: "Model Portfolio Quant Optimizer", category: "Portfolio" },
      { id: "ai-portfolio-optimizer", name: "AI Portfolio Optimizer & MVO Engine", category: "Portfolio" },
      { id: "model-portfolio-algo", name: "Model Portfolio Algo Execution Engine", category: "Transaction" },
      { id: "portfolio-risk-guard", name: "Portfolio Risk Guard Engine", category: "Portfolio" },
      { id: "model-portfolio-quant", name: "Model Portfolio Quant Engine", category: "Portfolio" },
      { id: "quant-orchestrator", name: "Quant & MVO Portfolio Orchestrator", category: "Portfolio" },
      { id: "tax-loss-harvesting", name: "Tax-Loss Harvesting Engine", category: "Portfolio" },
      { id: "global-macro-transmission", name: "Global Macro Transmission Engine", category: "Risk & Regime" },
      { id: "ai-regime-detection", name: "Market Regime Detection Engine", category: "Risk & Regime" },
      { id: "domestic-market-intelligence", name: "Domestic Market Intelligence Engine", category: "Risk & Regime" },
      { id: "global-market-intelligence", name: "Global Market Intelligence Engine", category: "Risk & Regime" },
      { id: "global-fii-tracker", name: "Global FII Allocation Tracker Engine", category: "Risk & Regime" },
      { id: "global-credit-cycle", name: "Global Credit Cycle Engine", category: "Risk & Regime" },
      { id: "msci-factor-engine", name: "MSCI Factor & Country Profile Service", category: "Data Quality" },
      { id: "tail-risk-stress", name: "Tail-Risk & Macro Stress Engine", category: "Risk & Regime" },
      { id: "sip-simulator-engine", name: "SIP Simulator Engine", category: "Portfolio" },
      { id: "overlap-intelligence-engine", name: "Mutual Fund Overlap Intelligence", category: "Portfolio" },
      { id: "financial-metrics-calculator", name: "Financial Metrics Calculator", category: "Data Quality" },
      { id: "data-sufficiency-engine", name: "Data Sufficiency & Quality Engine", category: "Data Quality" },
      { id: "nse-bhavcopy-service", name: "NSE Bhavcopy Ingestion Service", category: "Data Quality" },
      { id: "bse-bhavcopy-service", name: "BSE Bhavcopy Ingestion Service", category: "Data Quality" },
      { id: "nse-fo-participant-service", name: "NSE F&O Participant OI Ingestion Service", category: "Data Quality" },
      { id: "stock-enrichment-service", name: "Stock Financial Enrichment Service", category: "Data Quality" },
      { id: "historical-backfill-service", name: "Historical Time-Series Backfill", category: "Data Quality" },
      { id: "upstox-golden-pricing", name: "Upstox Golden Market Data", category: "Data Quality" },
      { id: "multi-exchange-market", name: "Multi-Exchange Market Service", category: "Data Quality" },
      { id: "market-brief-engine", name: "Daily Market Brief Engine", category: "AI Orchestration" },
      { id: "knowledge-hub-engine", name: "Knowledge Hub Intelligence Engine", category: "AI Orchestration" },
      { id: "amc-knowledge-hub", name: "AMC Knowledge Hub & Factsheet Service", category: "AI Orchestration" },
      { id: "scorer-calibration", name: "Scorer Calibration Service", category: "AI Orchestration" },
      { id: "pick-outcome-analyzer", name: "Pick Outcome Analyzer", category: "AI Orchestration" },
      { id: "smart-order-routing", name: "Smart Order Routing Engine", category: "Transaction" },
      { id: "long-short-algo", name: "Long-Short Strategy & Algorithmic Signal Engine", category: "Transaction" },
      { id: "user-intent-prewarm-engine", name: "User Intent Prewarm Engine", category: "AI Orchestration" },
      { id: "us-macro-indicators", name: "US Macro Indicators Service", category: "Risk & Regime" },
      { id: "india-cpi-engine", name: "India CPI Inflation Service", category: "Risk & Regime" },
      { id: "central-macro-context-bus", name: "Central Macro Context Bus", category: "Risk & Regime" },
      { id: "fno-buildup-engine", name: "F&O Buildup & Derivative Intelligence Engine", category: "Alpha Generation" },
      { id: "surveillance-incident-engine", name: "Real-Time Surveillance & Incident Mitigation Engine", category: "Compliance" },
      { id: "trade-reconciliation-engine", name: "T+1 Trade & Broker Reconciliation Engine", category: "Transaction" },
      { id: "knowledge-hub-auto-heal-sentinel", name: "Knowledge Hub Auto-Heal Sentinel", category: "Data Quality" },
      { id: "tax-law-engine", name: "Direct Tax & Corporate Law Workstation Engine", category: "Compliance" },
      { id: "regulatory-ingestion-service", name: "Autonomous Regulatory Ingestion Engine", category: "Data Quality" },
      { id: "indian-tax-calculator", name: "Dynamic Indian Income Tax Calculator Engine", category: "Portfolio" },
      { id: "commodity-strategy", name: "Institutional Commodity Derivatives Engine", category: "Alpha Generation" },
      { id: "mcx-bhavcopy-service", name: "MCX Commodity Bhavcopy Ingestion Service", category: "Data Quality" },
      { id: "ncdex-bhavcopy-service", name: "NCDEX Commodity Bhavcopy Ingestion Service", category: "Data Quality" },
      { id: "goal-planning-engine", name: "Goal Planning & Inflation Engine", category: "Portfolio" },
      { id: "investable-surplus-engine", name: "Investable Surplus & Cashflow Engine", category: "Compliance" },
      { id: "ai-backtesting-engine", name: "AI Multi-Asset Backtesting Engine", category: "Alpha Generation" },
      { id: "ai-proposal-engine", name: "AI Proposal & Asset Allocation Engine", category: "AI Orchestration" },
      { id: "proposal-whatif-engine", name: "Proposal What-If Simulator Engine", category: "Portfolio" },
      { id: "research-metrics-engine", name: "Research & Factor Metrics Engine", category: "Alpha Generation" },
      { id: "explainability-engine", name: "Explainability & Governance Layer Engine", category: "Compliance" },
      { id: "risk-suitability-engine", name: "Risk Suitability & Profiling Engine", category: "Compliance" },
      { id: "us-rebalancing-engine", name: "US Cross-Border Rebalancing Engine", category: "Execution & Rebalancing" },
      { id: "rebalancing-engine", name: "Portfolio Drift & Tax-Optimized Rebalancing Engine", category: "Portfolio" },
      { id: "profit-optimized-scoring-engine", name: "Profit-Optimized Quant Scoring Engine", category: "Alpha Generation" },
      { id: "return-forecasting-engine", name: "Return Forecasting & Monte Carlo Engine", category: "Risk & Regime" },
      { id: "corporate-treasury-engine", name: "Corporate Treasury & SEBI Policy Engine", category: "Compliance" },
      { id: "tds-withholding-engine", name: "TDS Withholding & Tax Optimization Engine", category: "Compliance" },
      { id: "portfolio-xray-engine", name: "Portfolio 360 X-Ray Engine", category: "Portfolio" },
    ];
    for (const eng of coreEngines) {
      this._meta.set(eng.id, { name: eng.name, category: eng.category });
    }
  }

  /**
   * Report engine telemetry. Fire-and-forget — never throws.
   * Call after each generation/update cycle.
   */
  report(report: EngineReport): void {
    try {
      const { engineId, engineName, category } = report;
      this._meta.set(engineId, { name: engineName, category });

      const buf = this._buffer.get(engineId) ?? [];
      buf.push(report);
      if (buf.length > MAX_REPORTS_PER_ENGINE) {
        buf.splice(0, buf.length - MAX_REPORTS_PER_ENGINE);
      }
      this._buffer.set(engineId, buf);

      // Track regime from regime detection engine
      if (engineId === "ai-regime-detection" && report.meta?.regime) {
        this._latestRegime = String(report.meta.regime);
      }

      void this._persistToRedis(engineId, report);

      logger.info("[TelemetryBus] Engine report recorded", {
        event: "ENGINE_TELEMETRY_REPORT",
        user_id: "SYSTEM",
        latency_ms: report.latencyMs,
        status: report.errorCount === 0 ? "success" : "warn",
        engineId,
        qualityScore: report.qualityScore,
        itemsProcessed: report.itemsProcessed,
      });
    } catch (err) {
      // Telemetry MUST NOT crash the caller
      logger.warn("[TelemetryBus] report() failed (non-fatal)", {
        error_code: "TELEMETRY_REPORT_FAILED",
        message: err instanceof Error ? err.message : String(err),
        retryable: false,
      });
    }
  }

  /** Get health status of a specific engine. */
  getStatus(engineId: string): EngineHealthStatus {
    const meta = this._meta.get(engineId);
    const buf = this._buffer.get(engineId) ?? [];
    const window = buf.slice(-10);

    if (window.length === 0) {
      return {
        engineId,
        engineName: meta?.name ?? engineId,
        category: meta?.category ?? "Background Services",
        health: "unknown",
        p50LatencyMs: 0,
        avgQualityScore: 0,
        errorRate: 0,
        reportCount: 0,
        lastReportedAt: null,
      };
    }

    const latencies = window.map((r) => r.latencyMs).sort((a, b) => a - b);
    const p50LatencyMs = latencies[Math.floor(latencies.length / 2)] ?? 0;
    const avgQualityScore = Math.round(
      window.reduce((s, r) => s + r.qualityScore, 0) / window.length,
    );
    const errorRate =
      window.reduce((s, r) => s + (r.errorCount > 0 ? 1 : 0), 0) / window.length;

    const last = window[window.length - 1];
    const hoursSinceLastReport =
      (Date.now() - new Date(last.reportedAt).getTime()) / 3_600_000;

    let health: EngineHealthStatus["health"];
    if (hoursSinceLastReport > 72 || errorRate > 0.5) {
      health = "critical";
    } else if (avgQualityScore < 50 || errorRate > 0.25 || hoursSinceLastReport > 36) {
      health = "degraded";
    } else {
      health = "healthy";
    }

    return {
      engineId,
      engineName: last.engineName,
      category: last.category,
      health,
      p50LatencyMs,
      avgQualityScore,
      errorRate: Math.round(errorRate * 100) / 100,
      reportCount: buf.length,
      lastReportedAt: last.reportedAt,
      lastMeta: last.meta,
    };
  }

  /** Get all engine statuses. */
  getAllStatuses(): EngineHealthStatus[] {
    const ids = new Set([...this._buffer.keys(), ...this._meta.keys()]);
    return Array.from(ids).map((id) => this.getStatus(id));
  }

  /**
   * Compute the composite alpha signal across all engines.
   * Used by pick engine and portfolio optimizer to calibrate output depth.
   */
  getAlphaSignal(): AlphaSignal {
    const all = this.getAllStatuses();

    const alphaEngines = all.filter(
      (s) => s.category === "Alpha Generation" || s.category === "Portfolio",
    );
    // Only average engines that have actively reported (reportCount > 0).
    // Pre-seeded or dormant engines with 0 reports have an 'unknown' state and
    // must not falsely drag down the fleet alpha composite score to 0.
    const activeAlphaEngines = alphaEngines.filter((s) => s.reportCount > 0);
    const alphaQuality =
      activeAlphaEngines.length > 0
        ? Math.round(
            activeAlphaEngines.reduce((s, e) => s + e.avgQualityScore, 0) /
              activeAlphaEngines.length,
          )
        : 70; // optimistic default when no reports yet

    const degradedEngines = all.filter((s) => s.health === "degraded").length;
    const failedEngines = all.filter((s) => s.health === "critical").length;

    const alphaLabel: AlphaSignal["alphaLabel"] =
      alphaQuality >= 80 ? "strong"
      : alphaQuality >= 60 ? "moderate"
      : alphaQuality >= 40 ? "weak"
      : "poor";

    const systemHealth: AlphaSignal["systemHealth"] =
      failedEngines > 3 ? "CRITICAL"
      : degradedEngines > 3 || failedEngines > 0 ? "DEGRADED"
      : "HEALTHY";

    return {
      alphaQuality,
      alphaLabel,
      regime: this._latestRegime,
      systemHealth,
      degradedEngines,
      failedEngines,
      calculatedAt: new Date().toISOString(),
      bus_version: BUS_VERSION,
    };
  }

  /** Returns the latest regime label from AIRegimeDetectionEngine reports. */
  getLatestRegime(): string {
    return this._latestRegime;
  }

  /** Sets the latest regime label (e.g. from tests or dynamic overrides). */
  setLatestRegime(regime: string): void {
    this._latestRegime = regime;
  }

  /**
   * Hydrates the in-memory buffer with the latest engine telemetry reports cached in Redis.
   * Useful on Cloud Run cold starts or container restarts.
   */
  async hydrateFromRedis(): Promise<void> {
    try {
      const { getSharedRedis } = await import("../utils/redis-client");
      const redis = await getSharedRedis();
      if (!redis) return;
      const keys = await redis.keys("telemetry:engine:*");
      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;
        const report = JSON.parse(raw) as EngineReport;
        if (report?.engineId) {
          const buf = this._buffer.get(report.engineId) ?? [];
          if (buf.length === 0) {
            buf.push(report);
            this._buffer.set(report.engineId, buf);
            this._meta.set(report.engineId, {
              name: report.engineName,
              category: report.category,
            });
            if (report.engineId === "ai-regime-detection" && report.meta?.regime) {
              this._latestRegime = String(report.meta.regime);
            }
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }

  private async _persistToRedis(engineId: string, report: EngineReport): Promise<void> {
    try {
      const { getSharedRedis } = await import("../utils/redis-client");
      const redis = await getSharedRedis();
      if (!redis) return;
      await redis.setEx(`telemetry:engine:${engineId}`, 28 * 3600, JSON.stringify(report));
    } catch {
      // Non-fatal
    }
  }
}

/** Singleton — import this everywhere */
export const telemetryBus = new EngineTelemetryBus();
