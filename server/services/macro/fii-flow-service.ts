/**
 * @file fii-flow-service.ts
 * @description Manages daily Foreign Institutional Investor (FII) and Domestic Institutional
 *              Investor (DII) cash flows, calculates the effective institutional flow,
 *              and tracks multi-day cumulative institutional trends.
 *
 * GCR v1.0 & FASP-AI v3.0:
 * - Mathematical Effective Flow = FII + 0.3 * DII
 * - Persistent audit trail in fii_dii_daily_flows
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { indianApiService } from "../indian-api-service";
import { logger } from "../../logger";

export interface FiiDiiSummary {
  date: string;
  fiiBuyCr: number;
  fiiSellCr: number;
  fiiNetCr: number;
  diiBuyCr: number;
  diiSellCr: number;
  diiNetCr: number;
  effectiveFlowCr: number;
  sentiment: "RISK_ON" | "RISK_OFF" | "NEUTRAL";
  cumulative5DayNetCr: number;
  topFavoredSector: string;
  updatedAt: string;
}

let _cachedFii: { data: FiiDiiSummary; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export class FiiFlowService {
  /**
   * Syncs today's FII/DII data from IndianAPI, computes effective flow,
   * persists to fii_dii_daily_flows, and returns the enriched summary.
   */
  async syncAndPersistDailyFlow(): Promise<FiiDiiSummary | null> {
    const t0 = Date.now();
    try {
      const res = await indianApiService.getLatestFIIDII();
      if (!res.success || !res.data) {
        logger.warn("[FiiFlowService] IndianAPI FII/DII unavailable");
        return this.getLatestFromDb();
      }

      const { fii, dii, date } = res.data;
      const fiiBuy = fii.buy ?? 0;
      const fiiSell = fii.sell ?? 0;
      const fiiNet = fii.net ?? (fiiBuy - fiiSell);

      const diiBuy = dii.buy ?? 0;
      const diiSell = dii.sell ?? 0;
      const diiNet = dii.net ?? (diiBuy - diiSell);

      const effectiveFlow = Math.round((fiiNet + 0.3 * diiNet) * 100) / 100;

      let sentiment: FiiDiiSummary["sentiment"] = "NEUTRAL";
      let topSector = "banking_finance";

      if (effectiveFlow > 500) {
        sentiment = "RISK_ON";
        topSector = "banking_finance";
      } else if (effectiveFlow < -500) {
        sentiment = "RISK_OFF";
        topSector = "healthcare_pharma";
      }

      // Format date to YYYY-MM-DD
      let isoDate = new Date().toISOString().split("T")[0];
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        isoDate = date;
      }

      let cum5D = 0;

      // Try persisting to DB and calculating 5-day cumulative, with graceful fallback
      try {
        await db.execute(sql`
          INSERT INTO fii_dii_daily_flows (
            date, fii_buy_cr, fii_sell_cr, fii_net_cr,
            dii_buy_cr, dii_sell_cr, dii_net_cr,
            effective_flow_cr, sentiment, top_favored_sector,
            created_at
          ) VALUES (
            ${isoDate}::date, ${fiiBuy}, ${fiiSell}, ${fiiNet},
            ${diiBuy}, ${diiSell}, ${diiNet},
            ${effectiveFlow}, ${sentiment}, ${topSector},
            NOW()
          )
          ON CONFLICT (date) DO UPDATE SET
            fii_buy_cr = EXCLUDED.fii_buy_cr,
            fii_sell_cr = EXCLUDED.fii_sell_cr,
            fii_net_cr = EXCLUDED.fii_net_cr,
            dii_buy_cr = EXCLUDED.dii_buy_cr,
            dii_sell_cr = EXCLUDED.dii_sell_cr,
            dii_net_cr = EXCLUDED.dii_net_cr,
            effective_flow_cr = EXCLUDED.effective_flow_cr,
            sentiment = EXCLUDED.sentiment,
            top_favored_sector = EXCLUDED.top_favored_sector;
        `);

        const cumRes = await db.execute(sql`
          SELECT COALESCE(SUM(fii_net_cr::numeric + dii_net_cr::numeric), 0) AS cum_5d
          FROM (
            SELECT fii_net_cr, dii_net_cr
            FROM fii_dii_daily_flows
            ORDER BY date DESC
            LIMIT 5
          ) sub
        `);
        cum5D = parseFloat((cumRes.rows[0] as any)?.cum_5d || "0");
      } catch (dbErr: any) {
        logger.warn("[FiiFlowService] Non-critical DB persist error for FII/DII; continuing with memory cache", {
          error: dbErr?.message,
        });
        cum5D = fiiNet + diiNet;
      }

      const summary: FiiDiiSummary = {
        date: isoDate,
        fiiBuyCr: fiiBuy,
        fiiSellCr: fiiSell,
        fiiNetCr: fiiNet,
        diiBuyCr: diiBuy,
        diiSellCr: diiSell,
        diiNetCr: diiNet,
        effectiveFlowCr: effectiveFlow,
        sentiment,
        cumulative5DayNetCr: Math.round(cum5D * 100) / 100,
        topFavoredSector: topSector,
        updatedAt: new Date().toISOString(),
      };

      _cachedFii = { data: summary, expiresAt: Date.now() + CACHE_TTL_MS };

      logger.info("[FiiFlowService] Persisted FII/DII flow", {
        event: "FII_DII_FLOW_SYNCED",
        date: isoDate,
        effectiveFlow,
        sentiment,
        latencyMs: Date.now() - t0,
      });

      return summary;
    } catch (err: any) {
      logger.error("[FiiFlowService] Error syncing FII/DII flow", { error: err?.message });
      return this.getLatestFromDb();
    }
  }

  /**
   * Reads latest flow from database.
   */
  async getLatestFromDb(): Promise<FiiDiiSummary | null> {
    try {
      const res = await db.execute(sql`
        SELECT
          date, fii_buy_cr, fii_sell_cr, fii_net_cr,
          dii_buy_cr, dii_sell_cr, dii_net_cr,
          effective_flow_cr, sentiment, top_favored_sector,
          created_at
        FROM fii_dii_daily_flows
        ORDER BY date DESC
        LIMIT 1
      `);

      if (res.rows.length === 0) return null;
      const r = res.rows[0] as any;
      return {
        date: String(r.date),
        fiiBuyCr: parseFloat(r.fii_buy_cr || "0"),
        fiiSellCr: parseFloat(r.fii_sell_cr || "0"),
        fiiNetCr: parseFloat(r.fii_net_cr || "0"),
        diiBuyCr: parseFloat(r.dii_buy_cr || "0"),
        diiSellCr: parseFloat(r.dii_sell_cr || "0"),
        diiNetCr: parseFloat(r.dii_net_cr || "0"),
        effectiveFlowCr: parseFloat(r.effective_flow_cr || "0"),
        sentiment: r.sentiment as any,
        cumulative5DayNetCr: 0,
        topFavoredSector: r.top_favored_sector || "banking_finance",
        updatedAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Retrieves latest FII/DII flow with cache fallback.
   */
  async getLatestFlow(): Promise<FiiDiiSummary | null> {
    if (_cachedFii && Date.now() < _cachedFii.expiresAt) {
      return _cachedFii.data;
    }
    return this.syncAndPersistDailyFlow();
  }
}

export const fiiFlowService = new FiiFlowService();

