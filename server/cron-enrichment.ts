/**
 * Data Enrichment Cron Domain
 *
 * All market-data and instrument enrichment jobs:
 * REIT · MF/AIF/PMS/Commodity/ExitLoad/AMFI NAV syncs
 * Benchmark sync · Stock financial enrichment
 * Data Lake archival · Corporate Actions
 * Golden Source Pricing Engine · Fixed Income Status
 * NSE/BSE stock sync · Startup stock enrichment
 */

import cron from "node-cron";
import { logger } from "./logger";
import { reitInvitDataService } from "./services/reit-invit-data-service";
import { mfSyncScheduler } from "./services/mf-sync-scheduler";
import { aifNavSyncScheduler } from "./services/aif-nav-sync-scheduler";
import { pmsNavSyncScheduler } from "./services/pms-nav-sync-scheduler";
import { commodityPriceSyncScheduler } from "./services/commodity-price-sync-scheduler";
import { exitLoadSyncScheduler } from "./services/exit-load-sync-scheduler";
import { amfiNavScheduler } from "./services/amfi-nav-scheduler";
import { callPython } from "./clients/python-client";
import { dataEnrichmentScheduler } from "./services/data-enrichment-scheduler";
import { financialMetricsRefreshScheduler } from "./services/financial-metrics-refresh-scheduler";
import { startZohoSyncScheduler } from "./zoho/sync-scheduler";
import { initializeDataLakeCron } from "./cron/data-lake-cron";
import { stockSyncScheduler } from "./services/stock-sync-scheduler";
import {
	isProductionEnvironment,
	isEnrichmentWindow,
} from "./utils/enrichment-guard";
import { runDailyFixedIncomeRefresh } from "./cron/fixed-income-daily-refresh";
import { startModelPortfolioHoldingsRebalanceScheduler } from "./services/model-portfolio-metrics-service";
import { invalidateDistributionCache } from "./routes/screener-routes";
import { refreshAllHoldingNAVs } from "./services/model-portfolio-holdings-service";
import type { StaggerFn } from "./cron/utils";


const STAGGER = 120_000; // 2 min between each staggered service start

// ── Offloading guard ──────────────────────────────────────────────────────────
// When ENRICHMENT_WORKER_URL is set in the environment (i.e. a dedicated
// enrichment-worker Replit project is deployed), the main app skips every
// enrichment job — both the scheduled initializeCronJobs() calls and the
// module-level crons below — to avoid double-firing against the shared DB.
const ENRICHMENT_OFFLOADED = !!process.env.ENRICHMENT_WORKER_URL;

/**
 * Initialize all enrichment crons.
 * @param staggeredStart  - shared stagger helper from coordinator
 * @param delay           - current delay offset (ms); returned incremented
 */
export function initializeEnrichmentCrons(
	staggeredStart: StaggerFn,
	delay: number,
): number {
	if (ENRICHMENT_OFFLOADED) {
		logger.info(
			"⏭️ [Enrichment] All crons SKIPPED — offloaded to dedicated enrichment worker",
		);
		logger.info(`   Worker URL: ${process.env.ENRICHMENT_WORKER_URL}`);
		return delay;
	}

	if (!isProductionEnvironment()) {
		logger.info(
			"⏭️ [Enrichment] All MF/NAV/Benchmark enrichment schedulers SKIPPED (development mode)",
		);
		logger.info(
			"   ℹ️ These will only run on production server between 8 PM - 8 AM IST",
		);
		return delay;
	}

	// ── NAV / fund data syncs ───────────────────────────────────────────────────
	staggeredStart(
		"REIT/InvIT refresh",
		() => {
			reitInvitDataService.startScheduledRefresh(6);
			logger.info(
				"🏢 [REIT/InvIT] Data refresh scheduler started (every 6 hours)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"MF NAV sync",
		() => {
			mfSyncScheduler.start();
			logger.info("📊 [MF Sync] NAV sync scheduler started");
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"AIF NAV sync",
		() => {
			aifNavSyncScheduler.start();
			logger.info("📊 [AIF Sync] NAV sync scheduler started (daily 7 AM IST)");
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"PMS NAV sync",
		() => {
			pmsNavSyncScheduler.start();
			logger.info(
				"📊 [PMS Sync] NAV sync scheduler started (daily 7:30 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Commodity sync",
		() => {
			commodityPriceSyncScheduler.start();
			logger.info(
				"📊 [Commodity Sync] Price sync scheduler started (daily 8 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Exit Load sync",
		() => {
			exitLoadSyncScheduler.start();
			logger.info(
				"📊 [ExitLoad Sync] Exit load sync started (monthly on 1st at 3 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Zoho bidirectional sync",
		() => {
			startZohoSyncScheduler();
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"AMFI Official NAV sync",
		() => {
			amfiNavScheduler.initialize();
			logger.info(
				"📊 [AMFI NAV] Official NAV sync started (daily 11:30 PM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Data Enrichment Scheduler",
		() => {
			dataEnrichmentScheduler.initialize();
			logger.info(
				"📊 [DataEnrichment] Master enrichment scheduler started (daily 5 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Financial Metrics Refresh",
		() => {
			financialMetricsRefreshScheduler.start();
			logger.info(
				"📊 [MetricsRefresh] MF returns + stock metrics scheduler started",
			);
		},
		delay,
	);
	delay += STAGGER;

	logger.info(
		"⏭️ [HistoricalNAV] Historical NAV refresh job disabled — MFAPI dependency removed",
	);
	delay += STAGGER;

	// ── Benchmark jobs ──────────────────────────────────────────────────────────
	staggeredStart(
		"Benchmark Sync",
		() => {
			import("./services/benchmark-sync-service")
				.then(({ benchmarkSyncService }) => {
					cron.schedule("0 1 * * 0", async () => {
						if (!isEnrichmentWindow()) {
							logger.info(
								"⏭️ [BenchmarkSync] Outside 8PM-8AM IST window, skipping",
							);
							return;
						}
						logger.info("[CRON] Starting weekly benchmark index sync...");
						try {
							const result = await benchmarkSyncService.syncAllBenchmarks();
							logger.info(
								`[CRON] Benchmark sync: ${result.synced} synced, ${result.failed.length} failed`,
							);
						} catch (error: any) {
							logger.error("[CRON] Benchmark sync failed:", error.message);
						}
					});
					logger.info(
						"📊 [BenchmarkSync] Weekly benchmark sync scheduled (Sunday 1 AM UTC)",
					);
				})
				.catch((err) =>
					logger.error("❌ Failed to load benchmark sync service:", err),
				);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"AMFI Benchmark Ingestion",
		() => {
			import("./services/amfi-benchmark-ingestion-service")
				.then(({ amfiBenchmarkIngestionService }) => {
					cron.schedule("0 2 * * 1", async () => {
						if (!isEnrichmentWindow()) {
							logger.info(
								"⏭️ [AMFIBenchmark] Outside 8PM-8AM IST window, skipping",
							);
							return;
						}
						logger.info("[CRON] Starting weekly AMFI benchmark ingestion...");
						try {
							const result =
								await amfiBenchmarkIngestionService.syncAmfiSchemeBenchmarks();
							logger.info(
								`[CRON] AMFI benchmark ingestion: ${result.parsed} parsed, ${result.normalized} normalized, ${result.failed} failed`,
							);
						} catch (error: any) {
							logger.error(
								"[CRON] AMFI benchmark ingestion failed:",
								error.message,
							);
						}
					});
					logger.info(
						"📊 [AMFIBenchmark] Weekly AMFI benchmark ingestion scheduled (Monday 2 AM UTC)",
					);
				})
				.catch((err) =>
					logger.error("❌ Failed to load AMFI benchmark service:", err),
				);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"BSE Benchmark Seed",
		() => {
			import("./services/bse-benchmark-service")
				.then(({ bseBenchmarkService }) => {
					bseBenchmarkService
						.seedBseIndices()
						.then((result) => {
							logger.info(
								`📊 [BSEBenchmark] BSE indices seeded: ${result.seeded} new, ${result.existing} existing`,
							);
						})
						.catch((err) => logger.error("❌ BSE index seeding failed:", err));
				})
				.catch((err) =>
					logger.error("❌ Failed to load BSE benchmark service:", err),
				);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Benchmark Auto-Mapping",
		() => {
			import("./services/mf-benchmark-mapping-service")
				.then(({ mfBenchmarkMappingService }) => {
					mfBenchmarkMappingService
						.autoMapUnmappedFunds(5000)
						.then((result) => {
							logger.info(
								`📊 [BenchmarkAutoMap] Auto-mapped ${result.mapped} funds, ${result.skipped} skipped`,
							);
						})
						.catch((err) =>
							logger.error("❌ Benchmark auto-mapping failed:", err),
						);
				})
				.catch((err) =>
					logger.error("❌ Failed to load benchmark mapping service:", err),
				);
		},
		delay,
	);
	delay += STAGGER;

	// ── Stock and MF enrichment ─────────────────────────────────────────────────
	staggeredStart(
		"Stock Financial Enrichment",
		() => {
			cron.schedule("30 12 * * 1-5", async () => {
				if (!isEnrichmentWindow()) {
					logger.info(
						"⏭️ [StockEnrichment] Outside 8PM-8AM IST window, skipping",
					);
					return;
				}
				logger.info(
					"[CRON] Starting daily stock financial enrichment (6 PM IST)...",
				);
				try {
					const { stockFinancialEnrichmentService } = await import(
						"./services/stock-financial-enrichment-service"
					);
					await stockFinancialEnrichmentService.enrichAllStocks({
						useFmp: true,
						maxFmpStocks: 40,
						includeReturns: true,
						batchSize: 50,
					});
					logger.info("[CRON] Stock financial enrichment completed");
				} catch (error: any) {
					logger.error(
						"[CRON] Stock financial enrichment failed:",
						error.message,
					);
				}
			});
			logger.info(
				"📊 [StockEnrichment] Daily stock PE/EPS enrichment scheduled (6 PM IST weekdays)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"MF Extended Enrichment",
		() => {
			cron.schedule("0 18 * * *", async () => {
				if (!isEnrichmentWindow()) {
					logger.info("⏭️ [MFExtended] Outside 8PM-8AM IST window, skipping");
					return;
				}
				logger.info(
					"[CRON] Starting daily MF extended enrichment (TER/AUM)...",
				);
				try {
					const { mfExtendedEnrichmentService } = await import(
						"./services/mf-extended-enrichment-service"
					);
					await mfExtendedEnrichmentService.enrichAllFunds({
						batchSize: 200,
						onlyNulls: true,
					});
					logger.info("[CRON] MF extended enrichment completed");
				} catch (error: any) {
					logger.error("[CRON] MF extended enrichment failed:", error.message);
				}
			});
			logger.info(
				"📊 [MFExtended] Daily MF TER/AUM enrichment scheduled (11:30 PM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Data Lake Archival",
		() => {
			initializeDataLakeCron();
		},
		delay,
	);
	delay += STAGGER;

	// ── Corporate Actions ───────────────────────────────────────────────────────
	staggeredStart(
		"Corporate Actions Sync",
		() => {
			cron.schedule("40 13 * * *", async () => {
				logger.info(
					"[CRON] Starting daily corporate actions sync (7:10 PM IST)...",
				);
				try {
					await callPython("/api/corporate-actions/sync", "POST");
					logger.info("[CRON] Corporate actions sync completed");
				} catch (error: any) {
					logger.error("[CRON] Corporate actions sync failed:", error.message);
				}
			});
			logger.info(
				"📊 [CorpActions] Daily corporate actions sync scheduled (7:10 PM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Corporate Actions Apply",
		() => {
			cron.schedule("50 13 * * *", async () => {
				logger.info(
					"[CRON] Starting daily corporate actions apply (7:20 PM IST)...",
				);
				try {
					await callPython("/api/corporate-actions/apply-adjustments", "POST");
					logger.info("[CRON] Corporate actions apply completed");
				} catch (error: any) {
					logger.error(
						"[CRON] Corporate actions apply failed:",
						error.message,
					);
				}
			});
			logger.info(
				"📊 [CorpActions] Daily corporate actions apply scheduled (7:20 PM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	// ── NSE/BSE stock sync ──────────────────────────────────────────────────────
	stockSyncScheduler.initialize();
	logger.info("📊 [StockSync] NSE/BSE sync scheduler initialized");

	// ── Golden Source Pricing Engine ────────────────────────────────────────────
	// Runs at 9 PM IST (15:30 UTC) weekdays — after market close.
	staggeredStart(
		"Golden Source Pricing Engine",
		() => {
			cron.schedule(
				"30 15 * * 1-5",
				async () => {
					logger.info(
						"[GoldenPricing] Starting daily golden price computation (all asset classes)...",
					);
					try {
						const { runDailyGoldenPricing } = await import(
							"./services/golden-pricing/GoldenPricingEngine"
						);
						const result = await runDailyGoldenPricing();
						logger.info(
							`[GoldenPricing] Run complete: ${result.succeeded}/${result.processed} priced, ` +
								`${result.flagged} flagged, ${result.failed} failed in ${result.durationMs}ms`,
						);
						try {
							const { callPython: cp } = await import(
								"./clients/python-client"
							);
							const triggerResult = await cp(
								"/api/price-returns/daily-run",
								"POST",
								{},
							);
							if (triggerResult)
								logger.info(
									"[GoldenPricing] Python returns computation started in background",
								);
						} catch (retErr: any) {
							logger.warn(
								"[GoldenPricing] Python returns trigger failed (non-critical):",
								retErr?.message,
							);
						}
					} catch (error: any) {
						logger.error("[GoldenPricing] Daily run failed:", error.message);
					}
				},
				{ timezone: "Asia/Kolkata" },
			);
		},
		delay,
	);
	delay += STAGGER;

	// Weekly stale-price cleanup (Sunday 8 PM IST)
	staggeredStart(
		"Golden Price Stale Marker",
		() => {
			cron.schedule(
				"0 20 * * 0",
				async () => {
					logger.info("[GoldenPricing] Marking stale prices...");
					try {
						const { db } = await import("./db");
						const { sql } = await import("drizzle-orm");
						const res = await db.execute(sql`
          UPDATE golden_prices SET is_stale = true, updated_at = NOW()
          WHERE price_date < CURRENT_DATE - INTERVAL '5 days' AND is_stale = false
        `);
						logger.info(
							`[GoldenPricing] Stale marker complete: ${res.rowCount} rows updated`,
						);
					} catch (error: any) {
						logger.error(
							"[GoldenPricing] Stale marker failed:",
							error.message,
						);
					}
				},
				{ timezone: "Asia/Kolkata" },
			);
			logger.info(
				"💰 [GoldenPricing] Daily run (9 PM IST Mon-Fri) + Weekly stale marker (8 PM IST Sun) scheduled",
			);
		},
		delay,
	);
	delay += STAGGER;

	// ── Portfolio Aggregation Sync Jobs ──────────────────────────────────────────
	// These three jobs implement Phase 4 of the broker-agnostic portfolio
	// aggregation architecture. Each job is isolated — a failure in one
	// does NOT affect the others (Promise.allSettled pattern inside each handler).

	staggeredStart(
		"IRIS Holdings Sync",
		() => {
			// Daily 7:30 AM IST (2:00 AM UTC) — after IRIS/KFintech NAV settlement
			cron.schedule(
				"0 2 * * *",
				async () => {
					logger.info(
						"[CRON] [IRISSync] Starting daily IRIS portfolio holdings sync (7:30 AM IST)...",
					);
					const start = Date.now();
					try {
						const { db: dbConn } = await import("./db");
						const { sql: sqlTag, eq: _eq } = await import("drizzle-orm");
						const { users } = await import("../shared/schema");
						const { syncIrisHoldingsForPan } = await import(
							"./services/iris-portfolio-sync-service"
						);

						// Fetch all users who have IRIS/PAN linked
						const linkedUsers = await dbConn
							.select({ id: users.id, pan: (users as any).pan })
							.from(users)
							.where(sqlTag`pan IS NOT NULL AND pan != ''`);

						let synced = 0,
							failed = 0;
						for (const user of linkedUsers) {
							try {
								await syncIrisHoldingsForPan(user.pan, user.id);
								synced++;
							} catch (e: any) {
								logger.warn(
									`[IRISSync] Failed for user ${user.id}:`,
									e?.message?.slice(0, 80),
								);
								failed++;
							}
						}

						logger.info(
							`[IRISSync] Complete: ${synced} synced, ${failed} failed in ${Date.now() - start}ms`,
							{
								event: "IRIS_SYNC_CRON_DONE",
								synced,
								failed,
								latency_ms: Date.now() - start,
								status: failed === 0 ? "success" : "partial",
							},
						);
					} catch (error: any) {
						logger.error("[IRISSync] Cron job failed:", {
							event: "IRIS_SYNC_CRON_ERROR",
							message: error.message,
							retryable: true,
							latency_ms: Date.now() - start,
							status: "error",
						});
					}
				},
				{ timezone: "Asia/Kolkata" },
			);
			logger.info(
				"📊 [IRISSync] Daily IRIS portfolio holdings sync scheduled (7:30 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	staggeredStart(
		"Alpaca Positions Sync",
		() => {
			// Daily 6:30 PM IST (13:00 UTC) weekdays — after US pre-market opens
			// (US market close is ~1:30 AM IST; 6:30 PM IST syncs end-of-previous-day positions)
			cron.schedule(
				"0 13 * * 1-5",
				async () => {
					logger.info(
						"[CRON] [AlpacaSync] Starting daily Alpaca positions sync (6:30 PM IST)...",
					);
					const start = Date.now();
					try {
						const { db: dbConn } = await import("./db");
						const { sql: sqlTag } = await import("drizzle-orm");
						const { alpacaPortfolioSync } = await import(
							"./services/alpaca/portfolio/portfolioSync"
						);

						// Fetch all users with an Alpaca account linked
						const rows = await dbConn.execute(sqlTag`
          SELECT id FROM users WHERE alpaca_account_id IS NOT NULL AND alpaca_account_id != ''
        `);
						const userIds: string[] = ((rows as any).rows ?? rows)
							.map((r: any) => r.id)
							.filter(Boolean);

						let synced = 0,
							failed = 0;
						for (const userId of userIds) {
							try {
								await alpacaPortfolioSync.getNormalizedPositions(userId);
								synced++;
							} catch (e: any) {
								logger.warn(
									`[AlpacaSync] Failed for user ${userId}:`,
									e?.message?.slice(0, 80),
								);
								failed++;
							}
							await new Promise((r) => setTimeout(r, 200)); // throttle
						}

						logger.info(
							`[AlpacaSync] Complete in ${Date.now() - start}ms — ${synced} synced, ${failed} failed`,
							{
								event: "ALPACA_SYNC_CRON_DONE",
								latency_ms: Date.now() - start,
								synced,
								failed,
								status: failed === 0 ? "success" : "partial",
							},
						);
					} catch (error: any) {
						logger.error("[AlpacaSync] Cron job failed:", {
							event: "ALPACA_SYNC_CRON_ERROR",
							message: error.message,
							retryable: true,
							latency_ms: Date.now() - start,
							status: "error",
						});
					}
				},
				{ timezone: "Asia/Kolkata" },
			);
			logger.info(
				"📊 [AlpacaSync] Daily Alpaca positions sync scheduled (6:30 PM IST weekdays)",
			);
		},
		delay,
	);

	delay += STAGGER;

	staggeredStart(
		"Portfolio Price Refresh",
		() => {
			// Daily 8:00 AM IST (2:30 UTC) — after market data is fully settled
			cron.schedule(
				"30 2 * * *",
				async () => {
					logger.info(
						"[CRON] [PortfolioPriceRefresh] Refreshing current_price in comprehensive_holdings...",
					);
					const start = Date.now();
					try {
						const { db: dbConn } = await import("./db");
						const { sql: sqlTag } = await import("drizzle-orm");
						const { comprehensiveHoldings } = await import("../shared/schema");
						const { unifiedStockPriceService } = await import(
							"./services/unified-stock-price-service"
						);

						// Fetch all distinct ISINs/symbols with holdings
						const rows = await dbConn
							.selectDistinct({
								symbol: comprehensiveHoldings.symbol,
								isin: comprehensiveHoldings.isin,
							})
							.from(comprehensiveHoldings)
							.where(
								sqlTag`asset_type IN ('equity', 'mutual_fund') AND symbol IS NOT NULL`,
							);

						let updated = 0,
							failed = 0;
						for (const row of rows) {
							if (!row.symbol) continue;
							try {
								const priceResult = await unifiedStockPriceService.getPrice(
									row.symbol,
								);
								const price = priceResult?.price ?? null;
								if (price !== null && price > 0) {
									await dbConn.execute(sqlTag`
                UPDATE comprehensive_holdings
                SET current_price = ${price}, last_enriched_at = NOW()
                WHERE symbol = ${row.symbol}
              `);
									updated++;
								}
							} catch {
								failed++;
							}
						}

						logger.info(
							`[PortfolioPriceRefresh] Complete: ${updated} updated, ${failed} failed in ${Date.now() - start}ms`,
							{
								event: "PORTFOLIO_PRICE_REFRESH_DONE",
								updated,
								failed,
								latency_ms: Date.now() - start,
								status: "success",
							},
						);
					} catch (error: any) {
						logger.error(
							"[PortfolioPriceRefresh] Cron job failed:",
							{
								event: "PORTFOLIO_PRICE_REFRESH_ERROR",
								error: error.message,
								retryable: true,
								latency_ms: Date.now() - start,
								status: "error",
							},
						);
					}
				},
				{ timezone: "Asia/Kolkata" },
			);
			logger.info(
				"📊 [PortfolioPriceRefresh] Daily comprehensive_holdings price refresh scheduled (8:00 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	// ── Portfolio Reconciliation Engine ──────────────────────────────────────────
	// SEBI (IA) Regulations 2013 requires daily reconciliation of client assets.
	// Runs at 9:30 AM IST (4:00 AM UTC) — after price refresh and broker syncs.
	staggeredStart(
		"Portfolio Reconciliation",
		() => {
			cron.schedule(
				"0 4 * * *",
				async () => {
					logger.info(
						"[CRON] [PortfolioRecon] Starting daily portfolio reconciliation (9:30 AM IST)...",
					);
					const start = Date.now();
					try {
						const { portfolioReconciliationEngine } = await import(
							"./services/portfolio-reconciliation-engine"
						);
						const stats =
							await portfolioReconciliationEngine.reconcileAllClients();
						logger.info(
							`[PortfolioRecon] Done: ${stats.totalClients} clients, ${stats.totalDiscrepancies} discrepancies ` +
								`(${stats.criticalDiscrepancies} critical) in ${stats.durationMs}ms`,
							{
								event: "PORTFOLIO_RECON_CRON_DONE",
								...stats,
								latency_ms: stats.durationMs,
								status: stats.failed === 0 ? "success" : "partial",
							},
						);
						if (stats.criticalDiscrepancies > 0) {
							logger.error(
								`[PortfolioRecon] ⚠️ ${stats.criticalDiscrepancies} CRITICAL discrepancies found — ` +
									`admin review required. Check portfolio_holding_discrepancies table.`,
							);
						}
					} catch (error: any) {
						logger.error("[PortfolioRecon] Cron job failed:", {
							event: "PORTFOLIO_RECON_CRON_ERROR",
							message: error.message,
							retryable: true,
							latency_ms: Date.now() - start,
							status: "error",
						});
					}
				},
				{ timezone: "Asia/Kolkata" },
			);
			logger.info(
				"📊 [PortfolioRecon] Daily reconciliation scheduled (9:30 AM IST — SEBI IA compliance)",
			);
		},
		delay,
	);
	// ── Quarterly Shareholding Pattern Refresh ───────────────────────────────────
	// Runs on 1st of Feb/May/Aug/Nov at 3 AM IST (21:30 UTC previous night)
	// Matches the quarterly BSE/NSE shareholding disclosure schedule.
	staggeredStart(
		"Shareholding Quarterly Refresh",
		() => {
			cron.schedule("30 21 1 2,5,8,11 *", async () => {
				if (!isEnrichmentWindow()) {
					logger.info("⏭️ [ShareholdingCron] Outside enrichment window, skipping");
					return;
				}
				logger.info("[CRON] Starting quarterly shareholding pattern refresh...");
				try {
					const { runShareholdingBatchJob } = await import(
						"./services/screener/shareholding-service"
					);
					const result = await runShareholdingBatchJob(500);
					logger.info(
						`[CRON] Shareholding refresh complete: ${result.processed} processed, ${result.succeeded} succeeded, ${result.failed} failed`,
						{ event: "SHAREHOLDING_BATCH_COMPLETE", ...result },
					);
				} catch (err: any) {
					logger.error("[CRON] Shareholding refresh failed:", err.message);
				}
			});
			logger.info(
				"📊 [Shareholding] Quarterly refresh scheduled (1st Feb/May/Aug/Nov — 3 AM IST)",
			);
		},
		delay,
	);
	delay += STAGGER;

	// ─ Model Portfolio Holdings Refresh + Rebalancing Detection (7:00 AM IST daily) ─
	staggeredStart(
		"Model Portfolio Rebalancing",
		() => {
			startModelPortfolioHoldingsRebalanceScheduler();
			logger.info(
				"📊 [ModelPortfolioRebalance] Holdings refresh + drift/underperformance detection scheduled (7:00 AM IST daily)",
			);
		},
		delay,
	);
	delay += STAGGER;

	return delay;

}

// ── Fixed Income Status — runs at module load (production only) ─────────────
// Daily at 6:05 AM IST (12:35 AM UTC)
// Skipped when ENRICHMENT_WORKER_URL is set — the dedicated worker runs this.
if (isProductionEnvironment() && !ENRICHMENT_OFFLOADED) {
	cron.schedule("35 0 * * *", async () => {
		logger.info("[CRON] Starting Fixed Income status refresh...");
		try {
			const result = await runDailyFixedIncomeRefresh();
			if (result.success) {
				logger.info(`[CRON] Fixed Income refresh: ${result.message}`);
				if (result.stats) {
					logger.info(
						`[CRON] Status distribution: ${result.stats.sellable} SELLABLE, ${result.stats.visible} VISIBLE, ${result.stats.hidden} HIDDEN`,
					);
				}
			} else {
				logger.error(`[CRON] Fixed Income refresh failed: ${result.message}`);
			}
		} catch (error: any) {
			logger.error("[CRON] Fixed Income refresh job failed:", error.message);
		}
	});
	logger.info(
		"📈 [FixedIncomeStatus] Daily status refresh scheduled (6:00 AM IST)",
	);
} else {
	logger.info(
		"⏭️ [FixedIncomeStatus] Skipped (development mode - production only)",
	);
}

// ── Startup + periodic stock enrichment (production only) ────────────────────
// First pass: 5 min after boot, processes up to 150 stocks (by market cap desc).
// Repeat: every 6 hours, processes up to 100 more pending/stale stocks.
// Skipped in development — triggered on-demand via /api/admin/screener-enrich.
// Skipped when ENRICHMENT_WORKER_URL is set — the dedicated worker runs this.

async function runScreenerEnrichmentBatch(
	limit: number,
	label: string,
): Promise<void> {
	try {
		const { db: dbConn } = await import("./db");
		const { sql: sqlTag } = await import("drizzle-orm");
		const staleRows = await dbConn.execute(sqlTag`
      SELECT symbol FROM listed_stocks
      WHERE is_active = true
        AND (
          enrichment_status IS NULL
          OR enrichment_status = 'pending'
          OR enrichment_status = 'failed'
          OR last_enriched_at IS NULL
          OR last_enriched_at < NOW() - INTERVAL '48 hours'
        )
      ORDER BY market_cap_value DESC NULLS LAST
      LIMIT ${limit}
    `);
		const staleSymbols: string[] = ((staleRows as any).rows ?? staleRows).map(
			(r: any) => r.symbol,
		);
		if (staleSymbols.length === 0) {
			logger.info(`[${label}] All stocks already enriched — no action needed`);
			return;
		}
		logger.info(
			`[${label}] Enriching ${staleSymbols.length} stocks via Screener.in (1.5s delay each)...`,
		);
		const { fetchFromScreener } = await import(
			"./modules/research/dataService"
		);
		let done = 0,
			failed = 0;
		for (const sym of staleSymbols) {
			try {
				const s = await fetchFromScreener(sym);
				const hasData =
					s.roe !== null ||
					s.debtToEquity !== null ||
					s.revenueGrowth !== null ||
					s.revenue !== null;
				if (hasData) {
					const updRes = await dbConn.execute(sqlTag`
            UPDATE screener_financials SET
              roe              = COALESCE(${s.roe}, roe),
              roce             = COALESCE(${s.roce}, roce),
              dividend_yield   = COALESCE(${s.dividendYield}, dividend_yield),
              book_value       = COALESCE(${s.bookValue}, book_value),
              revenue_growth   = COALESCE(${s.revenueGrowth}, revenue_growth),
              earnings_growth  = COALESCE(${s.earningsGrowth}, earnings_growth),
              debt_to_equity   = COALESCE(${s.debtToEquity}, debt_to_equity),
              revenue          = COALESCE(${s.revenue}, revenue),
              net_income       = COALESCE(${s.netIncome}, net_income),
              operating_margin = COALESCE(${s.operatingMargin}, operating_margin),
              operating_cash_flow = COALESCE(${s.operatingCashFlow}, operating_cash_flow),
              free_cash_flow   = COALESCE(${s.freeCashFlow}, free_cash_flow),
              last_updated     = NOW()
            WHERE id = (
              SELECT id FROM screener_financials
              WHERE symbol = ${sym}
              ORDER BY fiscal_year DESC NULLS LAST, last_updated DESC NULLS LAST
              LIMIT 1
            )
          `);
					const rowsUpdated = (updRes as any).rowCount ?? 0;
					if (!rowsUpdated) {
						const curYear = new Date().getFullYear();
						await dbConn
							.execute(sqlTag`
              INSERT INTO screener_financials (
                symbol, period, fiscal_year,
                roe, roce, dividend_yield, book_value,
                revenue_growth, earnings_growth, debt_to_equity,
                revenue, net_income, operating_margin, operating_cash_flow, free_cash_flow,
                last_updated
              ) VALUES (
                ${sym}, 'annual', ${curYear},
                ${s.roe}, ${s.roce}, ${s.dividendYield}, ${s.bookValue},
                ${s.revenueGrowth}, ${s.earningsGrowth}, ${s.debtToEquity},
                ${s.revenue}, ${s.netIncome}, ${s.operatingMargin}, ${s.operatingCashFlow}, ${s.freeCashFlow},
                NOW()
              )
            `)
							.catch(() => {});
					}
					await dbConn.execute(sqlTag`
            UPDATE listed_stocks SET enrichment_status = 'complete', last_enriched_at = NOW()
            WHERE symbol = ${sym}
          `);
					done++;
				} else {
					await dbConn.execute(sqlTag`
            UPDATE listed_stocks SET enrichment_status = 'failed', last_enriched_at = NOW()
            WHERE symbol = ${sym}
          `);
					failed++;
				}
			} catch (e: any) {
				logger.warn(
					`[${label}] Enrichment failed for ${sym}:`,
					e?.message?.slice(0, 60),
				);
				failed++;
			}
			await new Promise((r) => setTimeout(r, 1500));
		}
		logger.info(
			`[${label}] Batch complete: ${done} enriched, ${failed} failed out of ${staleSymbols.length}`,
		);
		// Invalidate the 5-min server-side distribution cache so that the next
		// GET /api/screener/distribution reflects freshly enriched sector / market-cap data.
		invalidateDistributionCache();
		logger.info(`[${label}] Distribution cache busted — fresh data on next request.`);
	} catch (e: any) {
		logger.warn(
			`[${label}] Enrichment batch failed:`,
			e?.message?.slice(0, 80),
		);
	}
}

if (isProductionEnvironment() && !ENRICHMENT_OFFLOADED) {
	// First pass: 5 min after boot (150 stocks by market cap)
	setTimeout(() => runScreenerEnrichmentBatch(150, "StartupEnrich"), 300_000);

	// Repeat every 6 hours — processes 100 more pending stocks each time
	setInterval(
		() => runScreenerEnrichmentBatch(100, "PeriodicEnrich"),
		6 * 60 * 60 * 1000,
	);

	// ── Daily deep-enrichment — 1:00 AM IST (7:30 PM UTC) ────────────────────
	// Runs after Indian market close + post-settlement data push from NSE/BSE.
	// Processes 250 stocks — enough to fully refresh the entire ~3700-stock
	// screener universe across 15 daily runs. Busts the distribution cache
	// automatically via the invalidateDistributionCache() call inside
	// runScreenerEnrichmentBatch.
	cron.schedule("30 19 * * *", async () => {
		logger.info("[CRON] 1AM IST daily screener enrichment starting (250 stocks)...");
		await runScreenerEnrichmentBatch(250, "DailyDeepEnrich");
	});

	// ── Phase B — Holding NAV refresh — 1:30 AM IST (20:00 UTC) ─────────────
	// Fires 30 min after the screener enrichment batch so fresh fundamental
	// data is already written before NAV + drift are computed.
	// Updates model_portfolio_holdings: currentNav, navDate, cagr1y, drift, alphaScore.
	cron.schedule("0 20 * * *", async () => {
		logger.info("[CRON] 1:30AM IST Phase B holding NAV refresh starting...");
		try {
			const result = await refreshAllHoldingNAVs();
			logger.info("[CRON] Phase B holding NAV refresh complete", {
				event: "HOLDING_NAV_REFRESH_COMPLETE",
				user_id: "cron",
				status: "success",
				...result,
			});
		} catch (err: unknown) {
			logger.error("[CRON] Phase B holding NAV refresh failed", {
				error: err instanceof Error ? err.message : String(err),
				retryable: true,
			});
		}
	});

	logger.info(
		"✅ [StartupEnrich] Screener enrichment scheduled: 150 at boot+5min | 100 every 6h | 250 at 1AM IST | holding NAV refresh at 1:30AM IST",
	);
} else {
	logger.info(
		"⏭️ [StartupEnrich] Stock enrichment skipped (development mode - use /api/admin/screener-enrich instead)",
	);
}

// Export for use by admin endpoint (works in any environment)
export { runScreenerEnrichmentBatch };
