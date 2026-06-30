/**
 * IRIS Portfolio Sync Cron Domain
 *
 * Schedule overview (IST):
 *   Daily 2:30 AM  │ Nightly IRIS / KFintech CAS sync for all active PANs
 *   Daily 7:00 AM  │ Model portfolio rebalancing + alpha upgrade check
 *
 * GCR: All portfolio sync operations use Drizzle ORM.
 *      No raw SQL mutations. All writes include updated_at + source: "cron".
 */

import cron from "node-cron";
import { logger } from "./logger";
import { runNightlyIrisCasSync } from "./services/iris-portfolio-sync-service";

export function initializeIrisSyncCrons(): void {
  // ── Daily 2:30 AM IST (21:00 UTC) — Nightly IRIS/CAS portfolio sync ────────
  // Syncs KFintech holdings for all users with a registered PAN.
  // Throttled at 2s between PANs to avoid IRIS rate limits.
  cron.schedule("0 21 * * *", async () => {
    logger.info("[CRON][IRISSync] Starting nightly IRIS CAS sync", {
      event: "CRON_IRIS_SYNC_START",
      schedule: "daily_0230_IST",
      timestamp: new Date().toISOString(),
    });
    try {
      await runNightlyIrisCasSync();
    } catch (err: unknown) {
      logger.error("[CRON][IRISSync] Nightly CAS sync failed", {
        event: "CRON_IRIS_SYNC_FAILED",
        error: err instanceof Error ? err.message : String(err),
        retryable: false, // next run tomorrow
        timestamp: new Date().toISOString(),
      });
    }
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
      // Trigger alpha scoring refresh for all active model portfolios
      // The scoring engine reads model_portfolio_holdings and updates alpha scores
      const { selectTopFundsByAlphaScore } = await import("./services/model-portfolio-metrics-service");
      // Asset classes to refresh
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

  logger.info("[CRON][IRISSync] IRIS sync crons initialized", {
    event: "CRON_IRIS_SYNC_INIT",
    schedules: ["nightly_CAS_sync@02:30_IST", "daily_rebalancing@07:00_IST"],
  });
}
