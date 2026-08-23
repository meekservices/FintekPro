/**
 * IRIS Portfolio Sync Cron Domain
 *
 * Schedule overview (IST):
 *   Daily 2:30 AM  │ Nightly IRIS/KFintech + CAMS + MFCentral CAS sync (all registrars)
 *   Daily 7:00 AM  │ Model portfolio alpha scoring + rebalancing check
 *
 * GCR: All portfolio sync operations use Drizzle ORM.
 *      No raw SQL mutations. All writes include updated_at + source: "cron".
 */

import cron from "node-cron";
import { logger } from "./logger";
import { runNightlyIrisCasSync } from "./services/iris-portfolio-sync-service";
import { runNightlyCAMSSync } from "./services/cams-holdings-sync-service";
import { runNightlyMFCentralSync } from "./services/mfcentral-holdings-sync-service";

export function initializeIrisSyncCrons(): void {
  // ── Daily 2:30 AM IST (21:00 UTC) — All-registrar nightly portfolio sync ───
  // Syncs KFintech (IRIS), CAMS, and MFCentral holdings for all active PANs.
  // Runs sequentially per registrar; individual failures are self-healing.
  cron.schedule("0 21 * * *", async () => {
    logger.info("[CRON][PortfolioSync] Starting nightly all-registrar sync", {
      event: "CRON_ALL_REGISTRAR_SYNC_START",
      registrars: ["kfintech_iris", "cams", "mfcentral"],
      schedule: "daily_0230_IST",
      timestamp: new Date().toISOString(),
    });

    // 1. KFintech / IRIS
    try {
      await runNightlyIrisCasSync();
      logger.info("[CRON][PortfolioSync] KFintech sync done", { event: "CRON_KFINTECH_SYNC_DONE" });
    } catch (err: unknown) {
      logger.error("[CRON][PortfolioSync] KFintech sync failed", {
        event: "CRON_KFINTECH_SYNC_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: false,
      });
    }

    // 2. CAMS (only if credentials are configured)
    if (process.env.CAMS_API_KEY && process.env.CAMS_MEMBER_ID) {
      try {
        await runNightlyCAMSSync();
        logger.info("[CRON][PortfolioSync] CAMS sync done", { event: "CRON_CAMS_SYNC_DONE" });
      } catch (err: unknown) {
        logger.error("[CRON][PortfolioSync] CAMS sync failed", {
          event: "CRON_CAMS_SYNC_FAILED",
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        });
      }
    } else {
      logger.warn("[CRON][PortfolioSync] CAMS skipped — credentials not configured", {
        event: "CRON_CAMS_SYNC_SKIPPED"
      });
    }

    // 3. MFCentral (only if credentials are configured)
    if (process.env.MFCENTRAL_CLIENT_ID && process.env.MFCENTRAL_CLIENT_SECRET) {
      try {
        await runNightlyMFCentralSync();
        logger.info("[CRON][PortfolioSync] MFCentral sync done", { event: "CRON_MFCENTRAL_SYNC_DONE" });
      } catch (err: unknown) {
        logger.error("[CRON][PortfolioSync] MFCentral sync failed", {
          event: "CRON_MFCENTRAL_SYNC_FAILED",
          error: err instanceof Error ? err.message : String(err),
          retryable: false,
        });
      }
    } else {
      logger.warn("[CRON][PortfolioSync] MFCentral skipped — credentials not configured", {
        event: "CRON_MFCENTRAL_SYNC_SKIPPED"
      });
    }

    logger.info("[CRON][PortfolioSync] All-registrar sync complete", {
      event: "CRON_ALL_REGISTRAR_SYNC_COMPLETE",
      timestamp: new Date().toISOString(),
    });
  });

  // ── Daily 7:00 AM IST (01:30 UTC) — Model portfolio rebalancing alpha cron ─
  // Triggers the daily alpha scoring + rebalancing check across model portfolios.
  cron.schedule("30 1 * * *", async () => {
    logger.info("[CRON][Rebalancing] Starting daily alpha rebalancing run", {
      event: "CRON_REBALANCE_ALPHA_START",
      schedule: "daily_0700_IST",
      timestamp: new Date().toISOString(),
    });
    try {
      // ── FASP-AI-v2.0: Run nightly quant rebalance for all 37 model portfolios ─
      const { runNightlyModelPortfolioRebalance } = await import("./services/model-portfolio-quant-service");
      const quantResult = await runNightlyModelPortfolioRebalance();
      logger.info("[CRON][Rebalancing] Nightly quant rebalance complete", {
        event: "CRON_NIGHTLY_QUANT_COMPLETE",
        portfolios_scored: quantResult.portfolios_scored,
        drifting: quantResult.drifting,
        needing_rebalance: quantResult.needing_rebalance,
        errors: quantResult.errors,
        latency_ms: quantResult.latency_ms,
        engine: "FASP-AI-v2.0",
      });

      // ── Also refresh alpha scoring from model_portfolio_holdings ──────────
      try {
        const { selectTopFundsByAlphaScore } = await import("./services/model-portfolio-metrics-service");
        const assetClasses = ["equity", "debt", "gold", "international", "liquid"];
        const riskProfiles = ["conservative", "moderate", "aggressive"];
        let refreshCount = 0;
        for (const ac of assetClasses) {
          for (const rp of riskProfiles) {
            await selectTopFundsByAlphaScore(ac, ac, rp, 5);
            refreshCount++;
          }
        }
        logger.info("[CRON][Rebalancing] Alpha scores refreshed", {
          event: "CRON_ALPHA_REFRESH_COMPLETE", refreshCount
        });
      } catch (metricsErr: unknown) {
        logger.warn("[CRON][Rebalancing] Alpha metrics refresh (non-fatal)", {
          error: metricsErr instanceof Error ? metricsErr.message : String(metricsErr),
        });
      }
      // ── Phase 3: Materialise TWRR period returns on model_portfolios ────────
      try {
        const { computeAndPersistAllPortfolioTWRRPeriods } = await import("./services/model-portfolio-metrics-service");
        const twrrResult = await computeAndPersistAllPortfolioTWRRPeriods();
        logger.info("[CRON][TWRR] Period returns materialised", {
          event: "CRON_TWRR_PERIODS_COMPLETE",
          updated: twrrResult.updated,
          skipped: twrrResult.skipped,
          latency_ms: twrrResult.latencyMs,
        });
      } catch (twrrErr: unknown) {
        logger.warn("[CRON][TWRR] Period compute (non-fatal)", {
          error: twrrErr instanceof Error ? twrrErr.message : String(twrrErr),
        });
      }

      logger.info("[CRON][Rebalancing] Daily alpha rebalancing complete", {
        event: "CRON_REBALANCE_ALPHA_COMPLETE",
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      logger.error("[CRON][Rebalancing] Daily alpha rebalancing failed", {
        event: "CRON_REBALANCE_ALPHA_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: false,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // ── FASP-AI v3.0: Nightly NAV update — 9PM IST (after AMFI publishes EOD NAVs) ────
  cron.schedule("0 21 * * 1-5", async () => {
    logger.info("[CRON][NAV] Nightly NAV update starting", { event: "CRON_NAV_UPDATE_START" });
    try {
      const { runNightlyNAVUpdate } = await import("./services/nav-feed-service");
      await runNightlyNAVUpdate();
    } catch (err: unknown) {
      logger.error("[CRON][NAV] Nightly NAV update failed", {
        event: "CRON_NAV_UPDATE_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      });
    }
  }, { timezone: "Asia/Kolkata" });

  // ── FASP-AI v3.0: Weekly rolling returns — Sunday 6AM IST ────────────────────
  cron.schedule("0 6 * * 0", async () => {
    logger.info("[CRON][Returns] Weekly rolling returns refresh starting", { event: "CRON_ROLLING_RETURNS_START" });
    try {
      const { refreshFundPerformanceCache } = await import("./services/rolling-returns-service");
      await refreshFundPerformanceCache();
    } catch (err: unknown) {
      logger.error("[CRON][Returns] Rolling returns refresh failed", {
        event: "CRON_ROLLING_RETURNS_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      });
    }
  }, { timezone: "Asia/Kolkata" });

  // ── FASP-AI v3.0: Weekly fund screener — Sunday 7AM IST (after returns refresh) ──
  cron.schedule("0 7 * * 0", async () => {
    logger.info("[CRON][Screener] Weekly fund screener starting", { event: "CRON_FUND_SCREENER_START" });
    try {
      const { runWeeklyScreener } = await import("./services/fund-screener-service");
      await runWeeklyScreener();
    } catch (err: unknown) {
      logger.error("[CRON][Screener] Weekly fund screener failed", {
        event: "CRON_FUND_SCREENER_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      });
    }
  }, { timezone: "Asia/Kolkata" });

  // ── FASP-AI Track Record: Nightly outcome compute — 2:00 AM IST ─────────────
  // For every portfolio_ai_decisions row where outcome_computed_at IS NULL,
  // fetches mf_monthwise_performance returns since decided_at for both chosen
  // and rejected instruments, computes TWRR, sets is_win and alpha_captured_pct.
  cron.schedule("30 20 * * *", async () => {
    logger.info("[CRON][FASP-AI] Nightly AI decision outcome compute starting", {
      event: "CRON_AI_OUTCOME_COMPUTE_START",
      schedule: "daily_0200_IST",
      timestamp: new Date().toISOString(),
    });
    try {
      const { computeAiDecisionOutcomes } = await import("./services/model-portfolio-metrics-service");
      const result = await computeAiDecisionOutcomes();
      logger.info("[CRON][FASP-AI] AI decision outcome compute complete", {
        event: "CRON_AI_OUTCOME_COMPUTE_COMPLETE",
        decisions_processed: result.processed,
        decisions_won: result.won,
        decisions_lost: result.lost,
        latency_ms: result.latencyMs,
        engine: "FASP-AI-v2.0",
      });
    } catch (err: unknown) {
      logger.error("[CRON][FASP-AI] AI decision outcome compute failed", {
        event: "CRON_AI_OUTCOME_COMPUTE_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      });
    }
  }, { timezone: "Asia/Kolkata" });

  // ── Alert maintenance: 3:00 AM IST — expire stale + create drift alerts ────
  cron.schedule("30 21 * * *", async () => {
    try {
      const { expireStaleAlerts, createDriftAlert } = await import("./services/portfolio-alert-service");
      const { pool: alertPool } = await import("./db");

      // 1. Expire alerts older than 7 days
      const expired = await expireStaleAlerts();
      logger.info("[CRON][Alerts] Stale alerts expired", {
        event: "CRON_ALERTS_EXPIRE_COMPLETE",
        expired_count: expired,
        timestamp: new Date().toISOString(),
      });

      // 2. Create drift alerts for any portfolio over threshold
      const driftRows = await alertPool.query(`
        SELECT mp.id, mp.name,
               COALESCE(mp.drift_score, 0) AS drift_score,
               COALESCE(mp.drift_threshold, 5) AS drift_threshold
        FROM model_portfolios mp
        WHERE mp.is_published = true
          AND COALESCE(mp.drift_score, 0) > COALESCE(mp.drift_threshold, 5) * 10
      `);
      for (const row of driftRows.rows as Array<{ id: string; name: string; drift_score: number; drift_threshold: number }>) {
        await createDriftAlert(row.id, row.name, row.drift_score ?? row.drift_threshold * 10);
      }
      logger.info("[CRON][Alerts] Drift alerts created", {
        event: "CRON_ALERTS_DRIFT_COMPLETE",
        portfolios_checked: driftRows.rows.length,
        timestamp: new Date().toISOString(),
      });
    } catch (err: unknown) {
      logger.error("[CRON][Alerts] Alert maintenance failed", {
        event: "CRON_ALERTS_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
      });
    }
  }, { timezone: "Asia/Kolkata" });

    logger.info("[CRON][PortfolioSync] All-registrar sync crons initialized", {
    event: "CRON_ALL_REGISTRAR_SYNC_INIT",
    schedules: [
      "nightly_all_registrar@02:30_IST",
      "daily_alpha_rebalancing@07:00_IST",
      "nightly_nav_update@21:00_IST",
      "weekly_rolling_returns@06:00_IST_Sunday",
      "weekly_fund_screener@07:00_IST_Sunday",
      "nightly_ai_outcome_compute@02:00_IST",
      "nightly_alert_maintenance@03:00_IST",
    ],
    registrars: ["kfintech_iris", "cams", "mfcentral"],
    faspaiv3: "nav_feed+rolling_returns+fund_screener+ai_outcome_compute",
  });
}
