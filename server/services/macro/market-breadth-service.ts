/**
 * @file market-breadth-service.ts
 * @description Ingests, computes, and persists daily market breadth indicators for FintekPro.
 *              Calculates Advance/Decline Ratio, % stocks above 50-DMA and 200-DMA,
 *              and detects Zweig Breadth Thrust anomalies.
 *
 * GCR v1.0 & FASP-AI v3.0:
 * - Deterministic breadth math across all active equities
 * - Caching and persistent historical audit trail in market_breadth_history
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";

export interface MarketBreadthSummary {
  date: string;
  advances: number;
  declines: number;
  unchanged: number;
  advanceDeclineRatio: number;
  pctAbove50Dma: number;
  pctAbove200Dma: number;
  breadthThrustSignal: boolean;
  breadthRegime: "BROAD_ADVANCE" | "SELECTIVE_CHOP" | "BROAD_DECLINE";
  updatedAt: string;
}

let _cachedBreadth: { data: MarketBreadthSummary; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export class MarketBreadthService {
  /**
   * Computes daily market breadth from listed_stocks and screener_technical_indicators_latest,
   * and persists the record into market_breadth_history.
   */
  async computeAndPersistBreadth(targetDate?: string): Promise<MarketBreadthSummary> {
    const t0 = Date.now();
    const dateStr = targetDate || new Date().toISOString().split("T")[0];

    try {
      // 1. Advance / Decline counts from listed_stocks
      const adRes = await db.execute(sql`
        SELECT
          count(*) FILTER (WHERE day_change_percent::numeric > 0) AS advances,
          count(*) FILTER (WHERE day_change_percent::numeric < 0) AS declines,
          count(*) FILTER (WHERE day_change_percent::numeric = 0 OR day_change_percent IS NULL) AS unchanged
        FROM listed_stocks
        WHERE is_active = true
      `);

      const adRow = adRes.rows[0] as any;
      const advances = Number(adRow?.advances || 0);
      const declines = Number(adRow?.declines || 0);
      const unchanged = Number(adRow?.unchanged || 0);

      const adRatio = declines > 0
        ? Math.round((advances / declines) * 100) / 100
        : advances > 0 ? 2.5 : 1.0;

      // 2. % stocks above 50-DMA and 200-DMA from screener_technical_indicators_latest
      const dmaRes = await db.execute(sql`
        SELECT
          count(*) AS total,
          count(*) FILTER (WHERE close::numeric > sma_50::numeric AND sma_50 IS NOT NULL) AS above_50,
          count(*) FILTER (WHERE close::numeric > sma_200::numeric AND sma_200 IS NOT NULL) AS above_200
        FROM screener_technical_indicators_latest
      `);

      const dmaRow = dmaRes.rows[0] as any;
      const totalDma = Number(dmaRow?.total || 1);
      const above50 = Number(dmaRow?.above_50 || 0);
      const above200 = Number(dmaRow?.above_200 || 0);

      const pctAbove50 = Math.round((above50 / totalDma) * 10000) / 100;
      const pctAbove200 = Math.round((above200 / totalDma) * 10000) / 100;

      // 3. Zweig Breadth Thrust: Advance ratio surges (approximated here by pctAbove50 > 65% and A/D > 2.0)
      const breadthThrustSignal = pctAbove50 >= 65 && adRatio >= 2.0;

      let breadthRegime: MarketBreadthSummary["breadthRegime"] = "SELECTIVE_CHOP";
      if (adRatio >= 1.40 && pctAbove50 >= 55) {
        breadthRegime = "BROAD_ADVANCE";
      } else if (adRatio <= 0.70 || pctAbove50 <= 35) {
        breadthRegime = "BROAD_DECLINE";
      }

      // 4. Upsert into market_breadth_history
      await db.execute(sql`
        INSERT INTO market_breadth_history (
          date, advances, declines, unchanged,
          advance_decline_ratio, pct_above_50_dma, pct_above_200_dma,
          breadth_thrust_signal, created_at
        ) VALUES (
          ${dateStr}::date, ${advances}, ${declines}, ${unchanged},
          ${adRatio}, ${pctAbove50}, ${pctAbove200},
          ${breadthThrustSignal}, NOW()
        )
        ON CONFLICT (date) DO UPDATE SET
          advances = EXCLUDED.advances,
          declines = EXCLUDED.declines,
          unchanged = EXCLUDED.unchanged,
          advance_decline_ratio = EXCLUDED.advance_decline_ratio,
          pct_above_50_dma = EXCLUDED.pct_above_50_dma,
          pct_above_200_dma = EXCLUDED.pct_above_200_dma,
          breadth_thrust_signal = EXCLUDED.breadth_thrust_signal;
      `);

      const summary: MarketBreadthSummary = {
        date: dateStr,
        advances,
        declines,
        unchanged,
        advanceDeclineRatio: adRatio,
        pctAbove50Dma: pctAbove50,
        pctAbove200Dma: pctAbove200,
        breadthThrustSignal,
        breadthRegime,
        updatedAt: new Date().toISOString(),
      };

      _cachedBreadth = { data: summary, expiresAt: Date.now() + CACHE_TTL_MS };

      logger.info("[MarketBreadth] Computed breadth", {
        event: "MARKET_BREADTH_COMPUTED",
        date: dateStr,
        adRatio,
        pctAbove50Dma: pctAbove50,
        pctAbove200Dma: pctAbove200,
        latencyMs: Date.now() - t0,
      });

      return summary;
    } catch (err: any) {
      logger.error("[MarketBreadth] Failed to compute breadth", { error: err?.message });
      throw err;
    }
  }

  /**
   * Retrieves latest market breadth with cache fallback.
   */
  async getLatestBreadth(): Promise<MarketBreadthSummary> {
    if (_cachedBreadth && Date.now() < _cachedBreadth.expiresAt) {
      return _cachedBreadth.data;
    }

    try {
      const res = await db.execute(sql`
        SELECT
          date, advances, declines, unchanged,
          advance_decline_ratio, pct_above_50_dma, pct_above_200_dma,
          breadth_thrust_signal, created_at
        FROM market_breadth_history
        ORDER BY date DESC
        LIMIT 1
      `);

      if (res.rows.length > 0) {
        const row = res.rows[0] as any;
        const adRatio = parseFloat(row.advance_decline_ratio || "1.0");
        const pctAbove50 = parseFloat(row.pct_above_50_dma || "50");

        let breadthRegime: MarketBreadthSummary["breadthRegime"] = "SELECTIVE_CHOP";
        if (adRatio >= 1.40 && pctAbove50 >= 55) breadthRegime = "BROAD_ADVANCE";
        else if (adRatio <= 0.70 || pctAbove50 <= 35) breadthRegime = "BROAD_DECLINE";

        const summary: MarketBreadthSummary = {
          date: String(row.date),
          advances: Number(row.advances),
          declines: Number(row.declines),
          unchanged: Number(row.unchanged),
          advanceDeclineRatio: adRatio,
          pctAbove50Dma: pctAbove50,
          pctAbove200Dma: parseFloat(row.pct_above_200_dma || "50"),
          breadthThrustSignal: Boolean(row.breadth_thrust_signal),
          breadthRegime,
          updatedAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
        };

        _cachedBreadth = { data: summary, expiresAt: Date.now() + CACHE_TTL_MS };
        return summary;
      }
    } catch {
      // Fall through to live compute
    }

    return this.computeAndPersistBreadth();
  }
}

export const marketBreadthService = new MarketBreadthService();

