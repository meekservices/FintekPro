/* eslint-disable no-console */
/**
 * FintekPro — Background Scheduler Registry
 *
 * Philosophy: Admin supervises, system operates.
 * Every market-data operation runs automatically on a schedule.
 * Admin routes remain for compliance overrides, regulatory exceptions, and manual escalations.
 *
 * Execution order matters — data must exist before picks can be generated:
 *   AutoPublish → StockSync → MFSync → Enrichment → PickScheduler → AutoHeal loop
 */


const SCHEDULER_START_DELAY_MS = 5000;
const AUDIT_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────────────────────────────────────

async function runStartupTask(name: string, task: () => Promise<void>) {
	try {
		console.log(`⚙️  [Scheduler] Starting: ${name}`);
		await task();
		console.log(`✅ [Scheduler] Ready:    ${name}`);
	} catch (error) {
		console.error(`❌ [Scheduler] Failed:   ${name}`, error);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. AUTO-PUBLISH ALL INSTRUMENT TYPES
//    Root cause of pick failures: instruments default to isPublished=false.
//    This task auto-publishes any instrument that has valid price/NAV data.
//    Runs on boot + every 24 h. Admin can still manually unpublish bad data.
// ─────────────────────────────────────────────────────────────────────────────

async function autoPublishAllInstruments() {
	const { db } = await import("../db");
	const { sql } = await import("drizzle-orm");

	// Tables and their publish conditions (using actual DB column names from schema).
	// Tables that have no is_published flag are skipped silently — they're always visible.
	const tasks: Array<{ label: string; query: ReturnType<typeof sql> }> = [
		{
			// listed_stocks: has is_published, is_active, current_price columns
			label: "listed_stocks",
			query: sql`
        UPDATE listed_stocks
        SET is_published = true, published_at = NOW(), published_by = 'system_auto_publish'
        WHERE is_published = false
          AND is_active = true
          AND current_price IS NOT NULL
          AND CAST(current_price AS DECIMAL) > 50
      `,
		},
		{
			// mutual_funds: main catalogue table — timestamp column is `last_updated` (not updated_at)
			label: "mutual_funds",
			query: sql`
        UPDATE mutual_funds
        SET is_published = true, last_updated = NOW()
        WHERE is_published = false
          AND is_active = true
          AND nav IS NOT NULL
          AND CAST(nav AS DECIMAL) > 0
      `,
		},
		{
			// bond_catalog: uses is_active, no is_published gate — publish by setting is_active=true
			// for bonds that have a valid clean_price or ytm (meaning they have market data)
			label: "bond_catalog",
			query: sql`
        UPDATE bond_catalog
        SET is_active = true
        WHERE is_active = false
          AND face_value IS NOT NULL
          AND maturity_date > NOW()
      `,
		},
		{
			// reits: uses current_price (not nav_per_unit), no is_published — ensure is_active
			label: "reits",
			query: sql`
        UPDATE reits
        SET is_active = true
        WHERE is_active = false
          AND current_price IS NOT NULL
          AND CAST(current_price AS DECIMAL) > 0
      `,
		},
		{
			// invits: same pattern as reits
			label: "invits",
			query: sql`
        UPDATE invits
        SET is_active = true
        WHERE is_active = false
          AND current_price IS NOT NULL
          AND CAST(current_price AS DECIMAL) > 0
      `,
		},
		{
			// global_instruments: uses last_price (not current_price), is_active flag
			label: "global_instruments",
			query: sql`
        UPDATE global_instruments
        SET is_active = true
        WHERE is_active = false
          AND last_price IS NOT NULL
          AND CAST(last_price AS DECIMAL) > 0
      `,
		},
	];

	console.log(
		"🔓 [AutoPublish] Running auto-publish for all instrument types...",
	);
	for (const { label, query } of tasks) {
		try {
			const result = await db.execute(query);
			const count = (result as any).rowCount ?? (result as any).count ?? 0;
			if (count > 0) {
				console.log(`  ✅ [AutoPublish] ${label}: published ${count} records`);
			}
		} catch (err: any) {
			// Table may not exist for all instrument types — non-fatal
			if (!err.message?.includes("does not exist")) {
				console.error(`  ⚠️  [AutoPublish] ${label} failed:`, err.message);
			}
		}
	}

	// Re-run every 24h so newly synced instruments go live without admin action
	setInterval(async () => {
		for (const { label, query } of tasks) {
			try {
				await db.execute(query);
			} catch {
				// Silent — non-critical periodic task
			}
		}
		console.log("[AutoPublish] Periodic instrument publish check complete");
	}, TWENTY_FOUR_HOURS_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. STOCK SYNC — NSE & BSE daily at 6 AM / 6:30 AM IST
//    The StockSyncScheduler was coded but never wired up. Connecting it here.
// ─────────────────────────────────────────────────────────────────────────────

async function startStockSyncScheduler() {
	const { stockSyncScheduler } = await import(
		"../services/stock-sync-scheduler"
	);
	stockSyncScheduler.initialize();
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PICK OF THE DAY — 9 AM IST daily + 6h auto-heal
// ─────────────────────────────────────────────────────────────────────────────

async function startPickOfTheDayScheduler() {
	const { pickOfTheDayService } = await import(
		"../services/pick-of-the-day-service"
	);
	pickOfTheDayService.startDailyScheduler();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MUTUAL FUND DATA SYNC — AMFI NAV + MF catalogue + returns
// ─────────────────────────────────────────────────────────────────────────────

async function startMutualFundSync() {
	try {
		const { mfSyncScheduler } = await import("../services/mf-sync-scheduler");
		mfSyncScheduler.start();
	} catch {
		console.warn("[Scheduler] mf-sync-scheduler not available, skipping");
	}

	try {
		const { amfiNavScheduler } = await import("../services/amfi-nav-scheduler");
		amfiNavScheduler.initialize();
	} catch {
		console.warn("[Scheduler] amfi-nav-scheduler not available, skipping");
	}

	try {
		const { mfReturnsScheduler } = await import(
			"../services/mf-returns-scheduler"
		);
		await mfReturnsScheduler.initialize();
	} catch {
		console.warn("[Scheduler] mf-returns-scheduler not available, skipping");
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DATA ENRICHMENT — Screener stock enrichment (FMP / Alpha Vantage)
// ─────────────────────────────────────────────────────────────────────────────

async function startDataEnrichment() {
	try {
		const { dataEnrichmentScheduler } = await import(
			"../services/data-enrichment-scheduler"
		);
		dataEnrichmentScheduler.initialize();
	} catch {
		console.warn(
			"[Scheduler] data-enrichment-scheduler not available, skipping",
		);
	}
}

// ── Market Cap Category Normalization ──────────────────────────────────────────
// Fixes 'Micro Cap' -> 'micro', 'Large Cap' -> 'large', etc.
// Runs on every boot AND daily at 1:30 AM IST (20:00 UTC) to heal newly-added
// stocks that arrive with raw category strings from NSE/BSE data feeds.
async function normalizeMarketCapCategories() {
	try {
		const { recalculateAllMetrics } = await import(
			"../services/screener/derived-metrics-engine"
		);
		// recalculateAllMetrics already includes the normalization step as Step 2
		await recalculateAllMetrics();
		console.log("[Scheduler] Market cap category normalization complete");

		// Invalidate distribution cache so next /api/screener/distribution
		// reflects the fresh normalized data (avoids 5-min stale window after normalization)
		try {
			const { invalidateDistributionCache } = await import(
				"../routes/screener-routes"
			);
			invalidateDistributionCache();
			console.log("[Scheduler] Distribution cache invalidated after normalization");
		} catch {
			// screener-routes may not be loaded yet on first boot pass — safe to ignore
		}
	} catch (err: any) {
		console.warn("[Scheduler] Market cap normalization skipped:", err?.message);
	}
}

// Daily normalization cron: 1:30 AM IST = 20:00 UTC
// Uses a lightweight setInterval wrapper \u2014 fires once per 24h from boot time,
// then self-corrects to wall-clock time within the same day window.
function scheduleDailyNormalization() {
	const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

	// Calculate ms until next 20:00 UTC (1:30 AM IST)
	function msUntilNext2000UTC(): number {
		const now = new Date();
		const next = new Date(now);
		next.setUTCHours(20, 0, 0, 0);
		if (next.getTime() <= now.getTime()) {
			next.setUTCDate(next.getUTCDate() + 1);
		}
		return next.getTime() - now.getTime();
	}

	// Fire once at the next 20:00 UTC, then repeat every 24h
	setTimeout(() => {
		console.log("[Scheduler] Daily market cap normalization triggered (1:30 AM IST)");
		void normalizeMarketCapCategories();
		setInterval(() => {
			console.log("[Scheduler] Daily market cap normalization triggered (1:30 AM IST)");
			void normalizeMarketCapCategories();
		}, TWENTY_FOUR_H_MS);
	}, msUntilNext2000UTC());

	console.log(
		`[Scheduler] Daily market cap normalization scheduled — next run in ${Math.round(msUntilNext2000UTC() / 60000)} min`,
	);
}


// ─────────────────────────────────────────────────────────────────────────────
// 6. FINANCIAL DATA SCHEDULER — PE/PB/EPS/financial metrics refresh
// ─────────────────────────────────────────────────────────────────────────────

async function startFinancialDataScheduler() {
	try {
		// Wait for background migrations to finish before querying
		// financial_instruments_cache — the confidence_score column (among others)
		// is added by Step 2e-1 and queries will fail if we start too early.
		const { schemaReady } = await import("../utils/schema-gate");
		await schemaReady;
		const { financialDataScheduler } = await import(
			"../services/financial-data-scheduler"
		);
		await financialDataScheduler.start();
	} catch {
		console.warn(
			"[Scheduler] financial-data-scheduler not available, skipping",
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. REIT/InvIT DATA REFRESH — every 6 hours
// ─────────────────────────────────────────────────────────────────────────────

async function startReitInvitRefresh() {
	try {
		const { reitInvitDataService } = await import(
			"../services/reit-invit-data-service"
		);
		reitInvitDataService.startScheduledRefresh(6); // every 6 hours
	} catch {
		console.warn("[Scheduler] reit-invit-data-service not available, skipping");
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. KYC & COMPLIANCE
// ─────────────────────────────────────────────────────────────────────────────

async function startKycExpiryMonitor() {
	if (process.env.NODE_ENV !== "production") return;
	const { kycExpiryMonitor } = await import("../services/kyc-expiry-monitor");
	kycExpiryMonitor.start();
}

async function startKycLrsMonitor() {
	const { kycLrsMonitorService } = await import(
		"../services/kyc-lrs-monitor-service"
	);
	kycLrsMonitorService.start();
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. AI REGULATORY MONITORING & ACTIVITY INSIGHTS
// ─────────────────────────────────────────────────────────────────────────────

async function startActivityInsightsMonitoring() {
	const { activityInsightsService } = await import(
		"../services/activity-insights-service"
	);
	activityInsightsService.startAutomatedMonitoring();
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. AUDIT & COMPLIANCE CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

async function startUnlistedRegulatoryAuditCleanup() {
	const { unlistedRegulatoryAuditService } = await import(
		"../services/unlisted-regulatory-audit-service"
	);
	await unlistedRegulatoryAuditService.cleanupExpiredRecords(false);
	setInterval(async () => {
		try {
			await unlistedRegulatoryAuditService.cleanupExpiredRecords(false);
		} catch (error) {
			console.error("❌ Failed to run periodic audit cleanup:", error);
		}
	}, AUDIT_CLEANUP_INTERVAL_MS);
}

async function verifyForensicAuditIntegrity() {
	const { auditLogService } = await import("../services/audit-log-service");
	const integrityResult = await auditLogService.verifyChainIntegrity();
	if (integrityResult.valid) {
		console.log(
			"✅ Forensic Audit Chain Integrity: VERIFIED (HMAC-SHA256 Chain Intact)",
		);
	} else {
		console.error(
			"❌ [CRITICAL] Forensic Audit Chain BREACHED! Tampering detected.",
		);
		console.error(
			"Broken Links:",
			JSON.stringify(integrityResult.brokenLinks, null, 2),
		);
	}
	if (!process.env.COMPLIANCE_SECRET) {
		console.warn(
			"⚠️  [WARNING] COMPLIANCE_SECRET is not set. Forensic integrity is compromised.",
		);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. DATA HEALTH MONITOR — logs a system-wide data health snapshot every hour
//     Gives admin a supervisor view without requiring manual triggers.
// ─────────────────────────────────────────────────────────────────────────────

async function startDataHealthMonitor() {
	const logHealthSnapshot = async () => {
		try {
			const { db } = await import("../db");
			const { sql } = await import("drizzle-orm");

			const [stocks, mfs, bonds, picks] = await Promise.all([
				db
					.execute(
						sql`SELECT COUNT(*) as total, SUM(CASE WHEN is_published THEN 1 ELSE 0 END) as published FROM listed_stocks WHERE is_active = true`,
					)
					.catch(() => null),
				db
					.execute(
						sql`SELECT COUNT(*) as total, SUM(CASE WHEN is_published THEN 1 ELSE 0 END) as published FROM mutual_funds WHERE is_active = true`,
					)
					.catch(() => null),
				db
					.execute(
						sql`SELECT COUNT(*) as total, SUM(CASE WHEN is_published THEN 1 ELSE 0 END) as published FROM bond_catalog WHERE is_active = true`,
					)
					.catch(() => null),
				db
					.execute(
						sql`SELECT COUNT(*) as count FROM daily_picks WHERE reco_date = CURRENT_DATE`,
					)
					.catch(() => null),
			]);

			const stockRow = (stocks as any)?.rows?.[0];
			const mfRow = (mfs as any)?.rows?.[0];
			const bondRow = (bonds as any)?.rows?.[0];
			const pickCount = (picks as any)?.rows?.[0]?.count ?? 0;

			console.log(
				`📊 [DataHealth] ${new Date().toISOString()} | ` +
					`Stocks: ${stockRow?.published ?? "?"}/${stockRow?.total ?? "?"} published | ` +
					`MFs: ${mfRow?.published ?? "?"}/${mfRow?.total ?? "?"} | ` +
					`Bonds: ${bondRow?.published ?? "?"}/${bondRow?.total ?? "?"} | ` +
					`Today's picks: ${pickCount}`,
			);
		} catch {
			// Non-critical monitor
		}
	};

	// Run once at startup (after a short delay), then every hour
	setTimeout(logHealthSnapshot, 30000);
	setInterval(logHealthSnapshot, 60 * 60 * 1000);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export function startBackgroundSchedulers(delayMs = SCHEDULER_START_DELAY_MS) {
	if (process.env.RUN_BACKGROUND_SCHEDULERS === "false") {
		console.log(
			"[Schedulers] Background schedulers disabled by RUN_BACKGROUND_SCHEDULERS=false",
		);
		return undefined;
	}

	return setTimeout(async () => {
		console.log("🚀 [Schedulers] Initializing all background services...");

		// ── Phase 1: Publish existing data so it's queryable ──────────────────────
		await runStartupTask(
			"Auto-Publish All Instruments",
			autoPublishAllInstruments,
		);

		// ── Phase 2: KYC & Compliance (high priority, before data ops) ────────────
		await runStartupTask("KYC Expiry Monitor", startKycExpiryMonitor);
		await runStartupTask("KYC LRS/TCS Monitor", startKycLrsMonitor);

		// ── Phase 3: Market Data Sync (runs async, feeds Phase 4) ────────────────
		// These are fire-and-forget — they schedule their own crons internally
		runStartupTask("Stock Sync Scheduler (NSE/BSE)", startStockSyncScheduler);
		runStartupTask("Mutual Fund Sync", startMutualFundSync);
		runStartupTask("Data Enrichment Scheduler", startDataEnrichment);
		runStartupTask("Financial Data Scheduler", startFinancialDataScheduler);
		runStartupTask("REIT/InvIT Data Refresh", startReitInvitRefresh);
		// Auto-normalize market_cap_category on every boot (no admin action needed)
		runStartupTask("Market Cap Category Normalization", normalizeMarketCapCategories);
		// Schedule daily re-normalization at 1:30 AM IST for newly added stocks
		scheduleDailyNormalization();

		// ── Phase 3b: FMP Priority Enrichment (production only) ──────────────────
		// Progressively fills T1-T4 FMP satellite tables (screener_growth_metrics,
		// screener_key_metrics, screener_dcf_valuations, etc.) using 200 API calls/day.
		// This is what drives the Screener Admin tab tier progress bars.
		// Only runs when NODE_ENV=production to avoid consuming API quota in dev.
		// Runs daily at 2:30 AM IST (21:00 UTC) — after NSE data sync completes.
		runStartupTask("FMP Priority Enrichment Scheduler", async () => {
			try {
				const { isProductionEnrichmentAllowed } = await import(
					"../services/screener/enrichment-service"
				);
				if (!isProductionEnrichmentAllowed()) {
					console.log("[FMPEnrich] Skipping auto-scheduler (non-production)");
					return;
				}

				const DAILY_MS = 24 * 60 * 60 * 1000;
				const nowMs   = Date.now();
				const nextRun  = new Date();
				// 2:30 AM IST = 21:00 UTC previous day
				nextRun.setUTCHours(21, 0, 0, 0);
				if (nextRun.getTime() <= nowMs) {
					nextRun.setTime(nextRun.getTime() + DAILY_MS);
				}

				const runBatch = async () => {
					try {
						console.log("[FMPEnrich] 🚀 Daily priority enrichment starting (budget: 200 calls)...");
						const { runPriorityEnrichmentBatch } = await import(
							"../services/screener/priority-enrichment-scheduler"
						);
						const result = await runPriorityEnrichmentBatch(undefined, 200);
						console.log(
							`[FMPEnrich] ✅ Priority enrichment complete: ` +
							`${result.totalApiCalls ?? 0} API calls, ` +
							`T1=${result.tiers?.[0]?.totalApiCalls ?? 0} ` +
							`T2=${result.tiers?.[1]?.totalApiCalls ?? 0} ` +
							`T3=${result.tiers?.[2]?.totalApiCalls ?? 0} ` +
							`T4=${result.tiers?.[3]?.totalApiCalls ?? 0} calls`
						);
					} catch (err) {
						console.error("[FMPEnrich] Daily batch failed:", err);
					}
				};

				setTimeout(async () => {
					await runBatch();
					setInterval(runBatch, DAILY_MS);
				}, Math.max(nextRun.getTime() - nowMs, 1000));

				console.log(`[FMPEnrich] 📅 Scheduled next run at ${nextRun.toISOString()}`);
			} catch (err) {
				console.warn("[FMPEnrich] Scheduler init failed:", err);
			}
		});

		// ── Phase 4: Pick of the Day (needs Phase 3 data, runs at 9 AM IST) ──────
		await runStartupTask(
			"Pick of the Day Scheduler",
			startPickOfTheDayScheduler,
		);

		// ── Phase 4b: Boot-time live price refresh ────────────────────────────────
		// Runs refreshLivePicks immediately after service starts so current prices
		// and returns are populated right away (not waiting for scheduled 12:30/4PM IST).
		// Critical for global stocks where getLivePrice now calls FMP directly.
		runStartupTask("Boot-time Live Price Refresh", async () => {
			const { pickOfTheDayService } = await import(
				"../services/pick-of-the-day-service"
			);
			// 15s delay: let Phase 3 data (stock sync, financial data) settle first
			await new Promise((r) => setTimeout(r, 15_000));
			const result = await pickOfTheDayService.refreshLivePicks();
			console.log(
				`💹 [BootRefresh] Live prices updated: ${result.updated} picks refreshed, ${result.errors} errors`,
			);
		});

		// ── Phase 5: AI & Analytics ───────────────────────────────────────────────
		runStartupTask("AI Regulatory Monitoring", startActivityInsightsMonitoring);

		// ── Phase 5b: ML Model Auto-Training ─────────────────────────────────────
		// Trains scoring models on all closed picks (target_hit/stoploss_hit/expired).
		// Safe to run on every boot — skips asset classes with < 10 completed picks.
		// Re-trains weekly to incorporate new closed picks and improve accuracy.
		runStartupTask("ML Scoring Model Auto-Train", async () => {
			const { aiMLScoringEngine } = await import(
				"../services/ai-ml-scoring-engine"
			);
			// Small delay to let Phase 3/4 data settle
			await new Promise((r) => setTimeout(r, 10_000));
			const models = await aiMLScoringEngine.trainAllModels({
				maxStumps: 30,
				learningRate: 0.1,
				minSamples: 10,
				nFolds: 3,
			});
			console.log(
				`🤖 [MLAutoTrain] Boot training complete: ${models.length} models trained.`,
			);

			// Weekly re-training (every 7 days)
			const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;
			setInterval(async () => {
				try {
					const refreshed = await aiMLScoringEngine.trainAllModels({
						maxStumps: 50,
						learningRate: 0.1,
						minSamples: 10,
						nFolds: 5,
					});
					console.log(
						`🔄 [MLAutoTrain] Weekly re-train: ${refreshed.length} models updated.`,
					);
				} catch (err) {
					console.error("[MLAutoTrain] Weekly re-train failed:", err);
				}
			}, WEEKLY_MS);
		});

		// ── Phase 5c: Model Portfolio Metrics Scheduler (engine audit Fix #7 + #8) ─
		// Daily @ 6:00 AM IST — computes CAGR/Sharpe/MaxDrawdown via FintekAnalytics
		// + generates AI insights (Gemini, cached 24h) per portfolio.
		runStartupTask("Model Portfolio Metrics Scheduler", async () => {
			try {
				const { startModelPortfolioMetricsScheduler } = await import(
					"../services/model-portfolio-metrics-service"
				);
				startModelPortfolioMetricsScheduler();
			} catch {
				console.warn("[Scheduler] model-portfolio-metrics-service not available, skipping");
			}
		});

		// ── Phase 5d: Portfolio Intelligence Engine (FASP-AI v3.0) ───────────────
		// Autonomous model portfolio maintenance — detects market regime, momentum
		// signals, and alpha/risk breaches. Auto-rebalances MODEL TEMPLATES only.
		// Client account rebalancing is queued for 1-tap approval (SEBI IA compliant).
		runStartupTask("Portfolio Intelligence Engine", async () => {
			const DAILY_MS   = 24 * 60 * 60 * 1000;
			const WEEKLY_MS  = 7  * DAILY_MS;

			// ── Daily 6:30 AM IST (01:00 UTC) — regime + risk scan ────────────
			const scheduleDailyRegimeScan = () => {
				const now = new Date();
				const next = new Date();
				next.setUTCHours(1, 0, 0, 0);
				if (next <= now) next.setTime(next.getTime() + DAILY_MS);
				const delay = next.getTime() - now.getTime();

				setTimeout(async () => {
					try {
						const { detectRegime } = await import("../services/market-regime-detector");
						const { buildPortfolioRiskSummary } = await import("../services/portfolio-risk-guard");
						const { db } = await import("../db");
						const { modelPortfolios } = await import("../../shared/schema");

						const regime = await detectRegime(true); // force refresh
						console.log(`[PortfolioIntel] Market regime: ${regime.regime} (breadth=${regime.breadthScore})`);

						const allPortfolios = await db.select({
							id: modelPortfolios.id,
							riskProfile: modelPortfolios.riskProfile,
							holdings: modelPortfolios.holdings,
						}).from(modelPortfolios);

						const riskReports = await buildPortfolioRiskSummary(
							allPortfolios.map(p => ({
								id: p.id,
								riskProfile: p.riskProfile,
								holdings: Array.isArray(p.holdings) ? p.holdings : [],
							}))
						);

						const breaches = riskReports.filter(r => !r.approved);
						if (breaches.length > 0) {
							console.warn(`[PortfolioIntel] ⚠️  ${breaches.length} portfolios have hard risk breaches: ${breaches.map(b => b.portfolioId).join(", ")}`);
						}
					} catch (err) {
						console.error("[PortfolioIntel] Daily regime scan failed:", err);
					}
					setInterval(async () => {
						try {
							const { detectRegime } = await import("../services/market-regime-detector");
							await detectRegime(true);
						} catch { /* silent */ }
					}, DAILY_MS);
				}, delay);
			};
			scheduleDailyRegimeScan();

			// ── Weekly Sunday 11 PM IST (17:30 UTC) — momentum rescore + auto-rebalance ─
			const scheduleWeeklyRebalance = () => {
				const now = new Date();
				const next = new Date();
				// Next Sunday
				const daysToSunday = (7 - now.getUTCDay()) % 7 || 7;
				next.setTime(now.getTime() + daysToSunday * DAILY_MS);
				next.setUTCHours(17, 30, 0, 0);

				setTimeout(async () => {
					try {
						console.log("[PortfolioIntel] 🔄 Weekly rebalance scan starting...");
						const { autoApplyHighConfidenceSwaps } = await import(
							"../services/portfolio-rebalance-scheduler"
						);
						const results = await autoApplyHighConfidenceSwaps();
						const applied = results.filter(r => r.swapsApplied > 0);
						console.log(`[PortfolioIntel] ✅ Weekly rebalance: ${applied.length} portfolios updated, ${results.reduce((s, r) => s + r.swapsApplied, 0)} swaps applied`);

						// Re-enrich updated holdings
						if (applied.length > 0) {
							const { default: fetch } = await import("node-fetch").catch(() => ({ default: null as any }));
							if (fetch) {
								await fetch("http://localhost:5000/api/model-portfolios/admin/persist-holdings-enrichment", { method: "POST" })
									.catch(() => { /* non-fatal */ });
								await fetch("http://localhost:5000/api/model-portfolios/admin/recompute-cagr-from-holdings", { method: "POST" })
									.catch(() => { /* non-fatal */ });
							}
						}
					} catch (err) {
						console.error("[PortfolioIntel] Weekly rebalance failed:", err);
					}
					setInterval(async () => {
						try {
							const { autoApplyHighConfidenceSwaps } = await import(
								"../services/portfolio-rebalance-scheduler"
							);
							await autoApplyHighConfidenceSwaps();
						} catch { /* silent */ }
					}, WEEKLY_MS);
				}, Math.max(next.getTime() - now.getTime(), 1000));
			};
			scheduleWeeklyRebalance();

			// ── Monthly: Calendar-triggered autonomous rebalancing ────────────────
			// Checks every published portfolio against its configured frequency
			// (weekly/monthly/quarterly/annually) and applies AI-driven swaps
			// automatically if guardrails pass. No human intervention required.
			// Runs Mon/Wed/Fri at 7 PM IST (13:30 UTC) — picks up all frequency tiers.
			const scheduleCalendarRebalance = () => {
				const DAILY_MS_CAL = 24 * 60 * 60 * 1000;
				const now = new Date();
				const next = new Date();
				next.setUTCHours(13, 30, 0, 0);
				if (next <= now) next.setTime(next.getTime() + DAILY_MS_CAL);

				setTimeout(async () => {
					const runCalendarRebalance = async () => {
						try {
							const day = new Date().getUTCDay(); // 0=Sun,1=Mon,...
							if (day === 1 || day === 3 || day === 5) { // Mon, Wed, Fri only
								console.log("[PortfolioIntel] 📅 Calendar rebalance check starting...");
								const { autoApplyCalendarRebalancing } = await import(
									"../services/portfolio-rebalance-scheduler"
								);
								const summary = await autoApplyCalendarRebalancing();
								console.log(
									`[PortfolioIntel] ✅ Calendar rebalance: ` +
									`${summary.portfoliosRebalanced} updated, ` +
									`${summary.portfoliosSkipped} already current, ` +
									`checked=${summary.portfoliosChecked}`
								);
							}
						} catch (err) {
							console.error("[PortfolioIntel] Calendar rebalance failed:", err);
						}
					};
					await runCalendarRebalance();
					setInterval(runCalendarRebalance, DAILY_MS_CAL);
				}, Math.max(next.getTime() - now.getTime(), 1000));
			};
			scheduleCalendarRebalance();

			// ── Daily: Drift score refresh (after calendar check) ─────────────────
			// Updates drift_score + drift_details on every published portfolio.
			// Powers the drift meter progress bar on the portfolio card.
			// Runs daily at 7:15 PM IST (13:45 UTC) — 15 min after calendar rebalance.
			const scheduleDriftRefresh = () => {
				const DAILY_MS_DRIFT = 24 * 60 * 60 * 1000;
				const nowD = new Date();
				const nextD = new Date();
				nextD.setUTCHours(13, 45, 0, 0);
				if (nextD <= nowD) nextD.setTime(nextD.getTime() + DAILY_MS_DRIFT);

				setTimeout(async () => {
					const runDriftRefresh = async () => {
						try {
							console.log("[DriftRefresh] 📊 Daily drift score refresh starting...");
							const { refreshDriftScores } = await import(
								"../services/portfolio-rebalance-scheduler"
							);
							const result = await refreshDriftScores();
							console.log(
								`[DriftRefresh] ✅ Drift scores refreshed: ` +
								`${result.refreshed} updated, ${result.errors} errors`
							);
						} catch (err) {
							console.error("[DriftRefresh] Daily refresh failed:", err);
						}
					};
					await runDriftRefresh();
					setInterval(runDriftRefresh, DAILY_MS_DRIFT);
				}, Math.max(nextD.getTime() - nowD.getTime(), 1000));
			};
			scheduleDriftRefresh();

			// ── Daily: Portfolio NAV History Refresh ──────────────────────────────
			// Computes monthly NAV time-series for all published portfolios.
			// Powers the rolling bar chart and cumulative benchmark line chart
			// on the portfolio card (brief §2 & §3).
			// Runs daily at 6:00 AM IST (00:30 UTC).
			const scheduleNavHistoryRefresh = () => {
				const DAILY_MS_NAV = 24 * 60 * 60 * 1000;
				const nowN = new Date();
				const nextN = new Date();
				nextN.setUTCHours(0, 30, 0, 0);
				if (nextN <= nowN) nextN.setTime(nextN.getTime() + DAILY_MS_NAV);

				setTimeout(async () => {
					const runNavRefresh = async () => {
						try {
							console.log("[NavHistory] 📅 Nightly portfolio NAV history refresh starting...");
							const { db: navDb } = await import("../db");
							const { refreshAllPortfolioNavHistory } = await import(
								"../services/model-portfolio-nav-service"
							);
							const summary = await refreshAllPortfolioNavHistory(navDb);
							console.log(
								`[NavHistory] ✅ NAV history refreshed: ` +
								`${summary.ok}/${summary.total} portfolios, ` +
								`${summary.errors} errors, ${summary.noData} no data`
							);

							// ── Fix A: Holdings enrichment (nightly) ──────────────────
							// Populates amfiSchemeCode + currentReturn so CAGR computation
							// achieves ≥50% coverage. Previously admin-only.
							try {
								console.log("[NavHistory] 🔄 Holdings enrichment starting...");
								const { enrichAndPersistAllHoldings } = await import(
									"../services/model-portfolio-metrics-service"
								);
								const enrichResult = await enrichAndPersistAllHoldings();
								console.log(`[NavHistory] ✅ Holdings enrichment: ${enrichResult.enriched} holdings across ${enrichResult.portfolios} portfolios`);
							} catch (enrichErr) {
								console.warn("[NavHistory] Holdings enrichment failed (non-fatal):", enrichErr);
							}

							// ── Fix B: TWRR period computation (nightly) ───────────────
							// Populates return_1m, return_3m, return_6m, return_ytd,
							// cagr_2y, return_since_inception. Previously admin-only.
							try {
								console.log("[NavHistory] 🔄 TWRR period computation starting...");
								const { computeAndPersistAllPortfolioTWRRPeriods } = await import(
									"../services/model-portfolio-metrics-service"
								);
								const twrrResult = await computeAndPersistAllPortfolioTWRRPeriods();
								console.log(`[NavHistory] ✅ TWRR periods: ${twrrResult.updated}/${twrrResult.processed} portfolios (${twrrResult.skipped} skipped, ${twrrResult.latencyMs}ms)`);
							} catch (twrrErr) {
								console.warn("[NavHistory] TWRR computation failed (non-fatal):", twrrErr);
							}

							// ── Fix C: CAGR/Sharpe/Drawdown computation (nightly) ──────
							// Populates cagr_1y, cagr_3y, cagr_5y, sharpe_ratio,
							// max_drawdown, alpha. Previously only via /admin/calibrate-metrics.
							try {
								console.log("[NavHistory] 🔄 CAGR/Sharpe/Drawdown computation starting...");
								const { computeAndPersistAllPortfolioCAGRs } = await import(
									"../services/model-portfolio-metrics-service"
								);
								const cagrResult = await computeAndPersistAllPortfolioCAGRs();
								console.log(`[NavHistory] ✅ CAGR: ${cagrResult.updated}/${cagrResult.processed} portfolios (${cagrResult.skipped} skipped)`);
							} catch (cagrErr) {
								console.warn("[NavHistory] CAGR computation failed (non-fatal):", cagrErr);
							}

						} catch (err) {
							console.error("[NavHistory] Nightly refresh failed:", err);
						}
					};
					await runNavRefresh();
					setInterval(runNavRefresh, DAILY_MS_NAV);
				}, Math.max(nextN.getTime() - nowN.getTime(), 1000));
			};
			scheduleNavHistoryRefresh();

			// ── Phase 5g: Nightly Quant Scorer + Drift-Triggered Rebalance ────────
			// BUG-1 FIX: runNightlyModelPortfolioRebalance() was only admin-triggerable.
			//   Now wired at 11:30 PM IST (18:00 UTC) — after NAV refresh (00:30 UTC),
			//   before next calendar rebalance slot (13:30 UTC the following day).
			//
			// BUG-3 FIX: After scoring, portfolios with drift_score > 15 (needs_rebalance)
			//   are passed to autoApplyHighConfidenceSwaps() — closing the feedback loop
			//   between quant drift detection and actual rebalancing execution.
			const scheduleNightlyQuantRun = () => {
				const DAILY_MS_QUANT = 24 * 60 * 60 * 1000;
				const nowQ = new Date();
				const nextQ = new Date();
				nextQ.setUTCHours(18, 0, 0, 0); // 11:30 PM IST = 18:00 UTC
				if (nextQ <= nowQ) nextQ.setTime(nextQ.getTime() + DAILY_MS_QUANT);

				setTimeout(async () => {
					const runQuantAndRebalance = async () => {
						const t0 = Date.now();
						try {
							console.log("[QuantEngine] 🔬 Nightly quant scorer starting...");
							const { runNightlyModelPortfolioRebalance } = await import(
								"../services/model-portfolio-quant-service"
							);
							const result = await runNightlyModelPortfolioRebalance();

							console.log(
								`[QuantEngine] ✅ Scored ${result.portfolios_scored} portfolios: ` +
								`${result.drifting} drifting, ${result.needing_rebalance} needing rebalance, ` +
								`${result.errors} errors (${Date.now() - t0}ms)`
							);

							// BUG-3: Chain drift-triggered portfolios to auto-apply
							if (result.needing_rebalance > 0 && result.drift_triggered_ids.length > 0) {
								const driftIds = result.drift_triggered_ids;
								if (driftIds.length > 0) {
									console.log(`[QuantEngine] 🔄 Drift-triggered rebalance for ${driftIds.length} portfolios: ${driftIds.join(", ")}`);
									const { autoApplyHighConfidenceSwaps } = await import(
										"../services/portfolio-rebalance-scheduler"
									);
									const rebalanceResults = await autoApplyHighConfidenceSwaps(driftIds);
									const applied = rebalanceResults.filter(r => r.swapsApplied > 0);
									console.log(
										`[QuantEngine] ✅ Drift-triggered auto-rebalance: ` +
										`${applied.length} portfolios updated, ` +
										`${rebalanceResults.reduce((s, r) => s + r.swapsApplied, 0)} swaps applied`
									);
								}
							}
						} catch (err) {
							console.error("[QuantEngine] Nightly quant run failed:", err);
						}
					};
					await runQuantAndRebalance();
					setInterval(runQuantAndRebalance, DAILY_MS_QUANT);
				}, Math.max(nextQ.getTime() - nowQ.getTime(), 1000));
			};
			scheduleNightlyQuantRun();

			console.log("[PortfolioIntel] 🧠 Portfolio Intelligence Engine active (daily regime + weekly momentum + calendar rebalance + drift refresh + NAV history + nightly quant scorer)");
		});

		// ── Phase 6: Audit & Compliance Cleanup ──────────────────────────────────
		runStartupTask(
			"Unlisted Regulatory Audit Cleanup",
			startUnlistedRegulatoryAuditCleanup,
		);
		runStartupTask(
			"Forensic Audit Integrity Check",
			verifyForensicAuditIntegrity,
		);

		// ── Phase 7: Supervisor Dashboard ────────────────────────────────────────
		runStartupTask("Data Health Monitor", startDataHealthMonitor);

		// ── Phase 5e: NSE India Beta + return_1m Enrichment ─────────────────────
		// Weekly Saturday midnight IST — fills null beta values in screener_derived_metrics
		// using NSE public API. Critical for RiskGuard accuracy (Audit #6 upgrade).
		runStartupTask("NSE India Data Enrichment", async () => {
			const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;
			const now = new Date();
			const next = new Date();
			const daysToSat = (6 - now.getUTCDay() + 7) % 7 || 7;
			next.setTime(now.getTime() + daysToSat * 24 * 60 * 60 * 1000);
			next.setUTCHours(18, 30, 0, 0); // midnight IST

			setTimeout(async () => {
				const run = async () => {
					try {
						console.log("[NSEEnrich] Starting beta + return_1m enrichment...");
						const { enrichScreenerWithNSEData } = await import("../services/screener/nse-india-provider");
						const { db } = await import("../db");
						const { sql } = await import("drizzle-orm");

						// Get symbols with null beta (top 200 most critical)
						const res = await db.execute(sql`
							SELECT DISTINCT symbol FROM screener_derived_metrics
							WHERE (beta IS NULL OR ABS(CAST(beta AS numeric) - 1.0) < 0.001)
							  AND return_1y IS NOT NULL
							ORDER BY return_1y DESC NULLS LAST
							LIMIT 200
						`).catch(() => ({ rows: [] }));

						const symbols = ((res as any).rows ?? []).map((r: any) => r.symbol as string);
						if (symbols.length > 0) {
							const { enriched, errors } = await enrichScreenerWithNSEData(db, sql, symbols);
							console.log(`[NSEEnrich] ✅ Enriched ${enriched} symbols, ${errors} errors`);
						}
					} catch (err) {
						console.error("[NSEEnrich] Weekly enrichment failed:", err);
					}
					setInterval(run, WEEKLY_MS);
				};
				await run();
			}, Math.max(next.getTime() - now.getTime(), 1000));

			console.log("[NSEEnrich] 📊 NSE beta enrichment scheduled (weekly Saturday midnight IST)");
		});

		// ── Phase 5g: Stock Financial Metrics Nightly Refresh ─────────────────────
		// Populates stock_financial_metrics table for all published listed stocks.
		// This is a CRITICAL Phase 2 quant-engine fix (BUG-3 root cause):
		//   stockFinancialMetrics was NEVER populated → Piotroski F-Score, Beneish
		//   M-Score, Interest Coverage, Quick Ratio (±75pts of the 120pt scoring scale)
		//   returned {} for every stock, leaving the engine at ~37% signal capacity.
		//
		// Schedule: 10:30 PM IST = 17:00 UTC — runs AFTER FMP enrichment batch
		//   (which populates companyFinancials at ~9 PM IST) and BEFORE next-day
		//   pick generation (7:30 AM IST). Window: 10 hours of stable data.
		//
		// Batch size: 100 stocks per run (100ms throttle per stock ≈ 10s total).
		// Increments to full universe as the table warms up over nightly runs.
		runStartupTask("Stock Financial Metrics Refresh", async () => {
			const msUntilNext1700UTC = (): number => {
				const now = new Date();
				const next = new Date();
				next.setUTCHours(17, 0, 0, 0); // 10:30 PM IST
				if (next <= now) next.setTime(next.getTime() + 24 * 60 * 60 * 1000);
				return next.getTime() - now.getTime();
			};

			const runRefresh = async () => {
				try {
					const { FinancialMetricsRefreshService } = await import(
						"../services/financial-metrics-refresh-service"
					);
					const svc = new FinancialMetricsRefreshService();
					console.log("[MetricsRefresh] 🔄 Starting nightly stockFinancialMetrics refresh (batch=100)...");
					const result = await svc.refreshAllStockMetrics(100);
					console.log(`[MetricsRefresh] ✅ Done: ${result.success} success, ${result.failed} failed`);
				} catch (err) {
					console.warn("[MetricsRefresh] ⚠️ Nightly refresh failed (non-fatal):", err);
				}
			};

			// First run: at next 10:30 PM IST
			setTimeout(() => {
				void runRefresh();
				// Then nightly thereafter
				setInterval(() => { void runRefresh(); }, 24 * 60 * 60 * 1000);
			}, msUntilNext1700UTC());

			console.log(
				`[MetricsRefresh] 📊 Nightly stockFinancialMetrics refresh scheduled — ` +
				`next run in ${Math.round(msUntilNext1700UTC() / 60000)} min (10:30 PM IST)`,
			);
		});

		// ── Phase 5f: Redis Cache Warming ────────────────────────────────────────
		// Warms the top 5 expensive operations into Redis on boot + daily refresh.
		// Prevents cold-start latency spikes for regime/pick/screener data.
		runStartupTask("Redis Cache Warming", async () => {
			if (!process.env.REDIS_URL) {
				console.log("[CacheWarm] REDIS_URL not set — skipping Redis warming");

				return;
			}
			const warm = async () => {
				try {
					// 1. Market regime (consumed by portfolio intelligence engine)
					const { detectRegime } = await import("../services/market-regime-detector");
					await detectRegime(true); // force-refresh into Redis
					console.log("[CacheWarm] ✅ Market regime cached");
				} catch { /* non-fatal */ }

				try {
					// 2. screener_derived_metrics aggregate (consumed by optimizer + regime detector)
					const { createClient } = await import("redis");
					const redis = createClient({ url: process.env.REDIS_URL });
					redis.on("error", () => {});
					await redis.connect().catch(() => {});
					const { db } = await import("../db");
					const { sql } = await import("drizzle-orm");
					const res = await db.execute(sql`
						SELECT
							COUNT(*) as total,
							AVG(return_1y) as avg_return_1y,
							AVG(CAST(beta AS numeric)) as avg_beta,
							COUNT(*) FILTER (WHERE return_1y > 20) as above_20pct
						FROM screener_derived_metrics
						WHERE return_1y IS NOT NULL
					`).catch(() => ({ rows: [] }));
					const row = (res as any).rows?.[0];
					if (row && redis.isOpen) {
						await redis.setEx("screener:aggregate", 3600, JSON.stringify(row));
						console.log("[CacheWarm] ✅ Screener aggregate cached (1h TTL)");
					}
					await redis.disconnect().catch(() => {});
				} catch { /* non-fatal */ }
			};

			await warm();
			// Refresh daily at 7:30 AM IST (02:00 UTC)
			const now2 = new Date();
			const next2 = new Date();
			next2.setUTCHours(2, 0, 0, 0);
			if (next2 <= now2) next2.setTime(next2.getTime() + 24 * 60 * 60 * 1000);
			setTimeout(() => {
				warm();
				setInterval(warm, 24 * 60 * 60 * 1000);
			}, next2.getTime() - now2.getTime());

			console.log("[CacheWarm] 🔥 Redis cache warming active");
		});


		console.log(
			"✅ [Schedulers] All background services initialized. Portal is self-operating.",
		);
	}, delayMs);
}
