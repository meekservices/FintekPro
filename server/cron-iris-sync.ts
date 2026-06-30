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

  logger.info("[CRON][PortfolioSync] All-registrar sync crons initialized", {
    event: "CRON_ALL_REGISTRAR_SYNC_INIT",
    schedules: [
      "nightly_all_registrar@02:30_IST",
      "daily_alpha_rebalancing@07:00_IST",
    ],
    registrars: ["kfintech_iris", "cams", "mfcentral"],
  });
}
