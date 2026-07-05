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

			console.log("[PortfolioIntel] 🧠 Portfolio Intelligence Engine active (daily regime + weekly rebalance)");
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

		console.log(
			"✅ [Schedulers] All background services initialized. Portal is self-operating.",
		);
	}, delayMs);
}
