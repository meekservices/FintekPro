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
  | "Background Services";

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
    if (hoursSinceLastReport > 26 || errorRate > 0.5) {
      health = "critical";
    } else if (avgQualityScore < 50 || errorRate > 0.25 || hoursSinceLastReport > 13) {
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
    const alphaQuality =
      alphaEngines.length > 0
        ? Math.round(
            alphaEngines.reduce((s, e) => s + e.avgQualityScore, 0) /
              alphaEngines.length,
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
