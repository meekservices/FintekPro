/**
 * FintekPro Market Brief EOD Scheduler
 * Adheres strictly to FintekPro GCR v1.0 + SEBI FASP-AI v1.0
 * 
 * Schedules automated End-Of-Day (EOD) market brief generation, SSOT golden pricing persistence,
 * and day-wise historical archive maintenance.
 */

import cron from "node-cron";
import { logger } from "../logger";
import { telemetryBus } from "../services/engine-telemetry-bus";

export interface EodExecutionResult {
	region: string;
	date: string;
	success: boolean;
	version?: number;
	error?: string;
}

/**
 * Executes EOD persistence for a given region (or all regions if unspecified)
 */
export async function runMarketBriefEodJob(targetRegion?: string): Promise<EodExecutionResult[]> {
	const regions = targetRegion ? [targetRegion] : ["india", "global", "us"];
	const today = new Date().toISOString().split("T")[0];
	const results: EodExecutionResult[] = [];
	const t0 = Date.now();

	logger.info(`[MarketBriefEodCron] 🚀 Starting EOD Market Brief persistence for [${regions.join(", ")}]...`);

	for (const region of regions) {
		try {
			// 1. Force refresh golden pricing benchmarks
			const { goldenPricingEngine } = await import("../services/golden-pricing/GoldenPricingEngine");
			await goldenPricingEngine.getDailyMarketBriefLiveSnapshot(region, true);

			// 1b. For India, synchronize daily FII/DII institutional flows
			if (region === "india") {
				try {
					const { fiiFlowService } = await import("../services/macro/fii-flow-service");
					await fiiFlowService.syncAndPersistDailyFlow();
				} catch (fErr: any) {
					logger.debug(`[MarketBriefEodCron] FII flow sync notice: ${fErr?.message}`);
				}
			}

			// 2. Generate, format, and upsert daily market brief in DB
			const { knowledgeHubService } = await import("../services/knowledge-hub-service");
			const brief = await knowledgeHubService.generateAndPublishDailyBrief(region, today);

			results.push({
				region,
				date: today,
				success: true,
				version: brief?.version ?? 1,
			});

			logger.info(`[MarketBriefEodCron] ✅ EOD brief persisted for ${region} (v${brief?.version ?? 1}) on ${today}`);
		} catch (err: any) {
			logger.error(`[MarketBriefEodCron] ❌ EOD brief generation failed for ${region}: ${err?.message}`);
			results.push({
				region,
				date: today,
				success: false,
				error: err?.message,
			});
		}
	}

	telemetryBus.report({
		engineId: "market-brief-engine",
		engineName: "Daily Market Brief Engine",
		category: "AI Orchestration",
		reportedAt: new Date().toISOString(),
		latencyMs: Date.now() - t0,
		qualityScore: results.every((r) => r.success) ? 99 : 80,
		itemsProcessed: results.length,
		errorCount: results.filter((r) => !r.success).length,
		meta: { event: "EOD_BRIEF_CRON_COMPLETE", results },
	});

	return results;
}

/**
 * Initializes node-cron background schedulers for day-wise market briefs
 */
export function initializeMarketBriefEodCron(): void {
	// ─── 1. India EOD Brief (Mon–Fri at 16:30 IST / 11:00 UTC) ────────────────
	// Market close at 15:30 IST, clearing & settlement references settled by 16:30 IST
	cron.schedule("30 16 * * 1-5", async () => {
		logger.info("[MarketBriefEodCron] ⏰ Triggered India EOD Market Brief scheduler (16:30 IST)");
		await runMarketBriefEodJob("india");
	}, {
		timezone: "Asia/Kolkata",
	});

	// ─── 2. Global EOD Brief (Mon–Fri at 18:30 IST / 13:00 UTC) ───────────────
	// European market close & Asian consolidation
	cron.schedule("30 18 * * 1-5", async () => {
		logger.info("[MarketBriefEodCron] ⏰ Triggered Global EOD Market Brief scheduler (18:30 IST)");
		await runMarketBriefEodJob("global");
	}, {
		timezone: "Asia/Kolkata",
	});

	// ─── 3. US EOD Brief (Tue–Sat at 04:30 AM IST / 23:00 UTC Mon–Fri) ─────────
	// NYSE & NASDAQ close at 04:00 AM IST (16:00 EST)
	cron.schedule("30 4 * * 2-6", async () => {
		logger.info("[MarketBriefEodCron] ⏰ Triggered US EOD Market Brief scheduler (04:30 AM IST)");
		await runMarketBriefEodJob("us");
	}, {
		timezone: "Asia/Kolkata",
	});

	// ─── 4. Non-blocking Boot Backfill & Sentinel Initial Sweep ───────────────
	Promise.resolve().then(async () => {
		try {
			const { knowledgeHubService } = await import("../services/knowledge-hub-service");
			const existingBriefs = await knowledgeHubService.getMarketBriefs({ region: "india", limit: 10 });
			if (!existingBriefs || existingBriefs.length < 5) {
				logger.info("[MarketBriefEodCron] 📜 Historical briefs sparse (< 5 records) — running 30-day archive backfill...");
				const res = await knowledgeHubService.ensureHistoricalBriefsBackfill("india", 30);
				logger.info(`[MarketBriefEodCron] ✅ Historical archive backfill completed (${res.backfilled} briefs backfilled)`);
			}
		} catch (bErr: any) {
			logger.warn(`[MarketBriefEodCron] Boot archive backfill check notice: ${bErr?.message}`);
		}

		// Initial Sentinel Health Audit on boot
		try {
			const { knowledgeHubAutoHealSentinel } = await import("../services/knowledge-hub-auto-heal-sentinel");
			logger.info("[MarketBriefEodCron] 🛡️ Running initial Knowledge Hub Sentinel health audit...");
			const sweep = await knowledgeHubAutoHealSentinel.runPeriodicHealthSweep();
			logger.info(`[MarketBriefEodCron] 🛡️ Initial Sentinel audit complete: India ${sweep.india?.qualityScore ?? 99}%, Global ${sweep.global?.qualityScore ?? 99}%, US ${sweep.us?.qualityScore ?? 99}%`);
		} catch (sErr: any) {
			logger.warn(`[MarketBriefEodCron] Boot Sentinel audit notice: ${sErr?.message}`);
		}
	});

	// ─── 5. Sentinel Auto-Heal Continuous Monitor (Every 15 min during IST market hours) ──
	cron.schedule("*/15 9-16 * * 1-5", async () => {
		try {
			const { knowledgeHubAutoHealSentinel } = await import("../services/knowledge-hub-auto-heal-sentinel");
			logger.info("[MarketBriefEodCron] 🛡️ Periodic Market Hours Sentinel sweep...");
			await knowledgeHubAutoHealSentinel.runPeriodicHealthSweep();
		} catch (err: any) {
			logger.warn(`[MarketBriefEodCron] Periodic Sentinel sweep warning: ${err?.message}`);
		}
	}, {
		timezone: "Asia/Kolkata",
	});

	// ─── 6. Off-Market Hourly Sentinel Audit & Auto-Heal (Mon–Sun every 2 hours) ───
	cron.schedule("0 */2 * * *", async () => {
		try {
			const { knowledgeHubAutoHealSentinel } = await import("../services/knowledge-hub-auto-heal-sentinel");
			logger.debug("[MarketBriefEodCron] 🛡️ Off-market 2-hour Sentinel sweep...");
			await knowledgeHubAutoHealSentinel.runPeriodicHealthSweep();
		} catch (err: any) {
			logger.debug(`[MarketBriefEodCron] Off-market Sentinel sweep notice: ${err?.message}`);
		}
	}, {
		timezone: "Asia/Kolkata",
	});

	logger.info("📅 [MarketBriefEodCron] Automated EOD schedulers & 24/7 Auto-Heal Sentinel active");
}
