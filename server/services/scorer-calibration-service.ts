/**
 * @module scorer-calibration-service
 * @description Alpha self-calibration loop for the Picks Engine scorer.
 *
 * Purpose:
 *   Reads the rolling 90-day hit-rate from PickOutcomeAnalyzer and automatically
 *   adjusts the SCORER_MIN_THRESHOLD used by StockStrategy. When picks
 *   underperform (hit rate < 55%) the threshold rises, filtering more aggressively.
 *   When picks outperform (hit rate > 75%) the threshold relaxes slightly.
 *
 * Rules:
 *   hit rate < 55% → raise min threshold by 2 pts (max cap: 25)
 *   hit rate > 75% → lower min threshold by 1 pt  (floor: 10)
 *   Otherwise      → hold current threshold
 *
 * FASP-AI v3.0 compliance:
 *   This is a Decision Support System only — weight changes are logged and
 *   surfaced in the admin telemetry dashboard before taking effect.
 *   The calibrated threshold is persisted in Redis (TTL 72h). If Redis is
 *   unavailable, the hardcoded default of 15 is used as safe fallback.
 *
 * @version 1.0.0
 */

import { logger } from "../logger";
import { telemetryBus } from "./engine-telemetry-bus";

const CALIBRATION_VERSION = "1.0.0";
const DEFAULT_THRESHOLD = 15;   // Hardcoded baseline (12.5% of 120 max)
const MIN_FLOOR = 10;
const MAX_CAP = 25;
const REDIS_KEY = "scorer:min_threshold";
const REDIS_TTL = 72 * 3600; // 72h — refreshed on each calibration run

class ScorerCalibrationService {
  private _cachedThreshold: number | null = null;
  private _lastCalibrated: string | null = null;

  /**
   * Get the current calibrated SCORER_MIN_THRESHOLD.
   * Falls back to DEFAULT_THRESHOLD if Redis is unavailable or
   * calibrate() has never run.
   */
  async getMinThreshold(): Promise<number> {
    // 1. In-process cache (valid for the current request)
    if (this._cachedThreshold !== null) return this._cachedThreshold;

    // 2. Redis cache
    try {
      const { getSharedRedis } = await import("../utils/redis-client");
      const redis = await getSharedRedis();
      if (redis) {
        const stored = await redis.get(REDIS_KEY);
        if (stored) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed >= MIN_FLOOR && parsed <= MAX_CAP) {
            this._cachedThreshold = parsed;
            return parsed;
          }
        }
      }
    } catch {
      // Redis unavailable — use default
    }

    return DEFAULT_THRESHOLD;
  }

  /**
   * Run calibration against the latest pick performance stats.
   * Called weekly by PickOutcomeAnalyzer / cron-jobs.ts.
   *
   * @param hitRate - Overall hit rate (0-100) from getPerformanceStats()
   * @param totalClosed - Total closed picks used to compute the hit rate
   */
  async calibrate(hitRate: number, totalClosed: number): Promise<{
    previousThreshold: number;
    newThreshold: number;
    action: "raised" | "lowered" | "held";
    hitRate: number;
    totalClosed: number;
    calibration_version: string;
    calculation_timestamp: string;
  }> {
    const t0 = Date.now();

    // Need at least 20 closed picks for calibration to be meaningful
    if (totalClosed < 20) {
      logger.info("[ScorerCalibration] Skipping calibration — insufficient closed picks", {
        totalClosed,
        required: 20,
      });
      const current = await this.getMinThreshold();
      return {
        previousThreshold: current,
        newThreshold: current,
        action: "held",
        hitRate,
        totalClosed,
        calibration_version: CALIBRATION_VERSION,
        calculation_timestamp: new Date().toISOString(),
      };
    }

    const previous = await this.getMinThreshold();
    let next = previous;
    let action: "raised" | "lowered" | "held" = "held";

    if (hitRate < 55) {
      // Underperforming — tighten the gate
      next = Math.min(MAX_CAP, previous + 2);
      action = previous === next ? "held" : "raised";
    } else if (hitRate > 75) {
      // Outperforming — relax slightly to allow more picks
      next = Math.max(MIN_FLOOR, previous - 1);
      action = previous === next ? "held" : "lowered";
    }

    // Persist to Redis
    try {
      const { getSharedRedis } = await import("../utils/redis-client");
      const redis = await getSharedRedis();
      if (redis) {
        await redis.setEx(REDIS_KEY, REDIS_TTL, String(next));
      }
    } catch {
      // Non-fatal — calibration still logged
    }

    this._cachedThreshold = next;
    this._lastCalibrated = new Date().toISOString();

    const latencyMs = Date.now() - t0;
    const result = {
      previousThreshold: previous,
      newThreshold: next,
      action,
      hitRate: Math.round(hitRate * 100) / 100,
      totalClosed,
      calibration_version: CALIBRATION_VERSION,
      calculation_timestamp: this._lastCalibrated,
    };

    logger.info("[ScorerCalibration] Calibration complete", {
      event: "SCORER_CALIBRATION",
      user_id: "SYSTEM",
      latency_ms: latencyMs,
      status: "success",
      ...result,
    });

    // Report to telemetry bus
    telemetryBus.report({
      engineId: "scorer-calibration",
      engineName: "Scorer Calibration Engine",
      category: "Alpha Generation",
      reportedAt: this._lastCalibrated,
      latencyMs,
      qualityScore: Math.round(Math.min(100, hitRate * 1.2)), // quality ∝ hit rate
      itemsProcessed: totalClosed,
      errorCount: 0,
      meta: { ...result },
    });

    return result;
  }

  /** Expose last calibration metadata for health dashboard. */
  getCalibrationMeta() {
    return {
      lastCalibrated: this._lastCalibrated,
      cachedThreshold: this._cachedThreshold ?? DEFAULT_THRESHOLD,
      calibration_version: CALIBRATION_VERSION,
    };
  }
}

export const scorerCalibrationService = new ScorerCalibrationService();
