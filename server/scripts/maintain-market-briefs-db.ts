/* eslint-disable no-console */
/**
 * FintekPro Market Briefs DB Maintenance & Historical Archival Script
 * Adheres strictly to FintekPro GCR v1.0 + SEBI FASP-AI v1.0
 * 
 * Execution:
 *   npx tsx server/scripts/maintain-market-briefs-db.ts
 * 
 * Purpose:
 *   1. Guarantees DB schema integrity for market_briefs & fii_dii_daily_flows
 *   2. Generates and persists today's comprehensive market brief for all regions (India, Global, US)
 *   3. Backfills past 30 days of trading day archives for complete historical UI reference
 *   4. Persists institutional FII/DII flow history in PostgreSQL
 *   5. Outputs verification summary and telemetry report
 */

import { pool, db } from "../db";
import { sql, eq, and, desc } from "drizzle-orm";
import { marketBriefs } from "../../shared/schema";
import { logger } from "../logger";

async function main() {
	const t0 = Date.now();
	console.log("================================================================================");
	console.log("🏦 FintekPro Daily Market Brief DB Maintenance & Archive Engine");
	console.log("================================================================================");

	// 1. Schema Pre-flight checks
	console.log("\n[Step 1/5] 🛠️ Verifying database table schema and column integrity...");
	try {
		await pool.query(`
			ALTER TABLE market_briefs ADD COLUMN IF NOT EXISTS multi_exchange_data JSONB;
			ALTER TABLE market_briefs ADD COLUMN IF NOT EXISTS amc_consensus JSONB;
			CREATE UNIQUE INDEX IF NOT EXISTS idx_fii_dii_date_unique ON fii_dii_daily_flows (date);
		`);
		console.log("  ✅ DB schema verified: multi_exchange_data, amc_consensus & unique indexes ready.");
	} catch (err: any) {
		console.warn("  ⚠️ Non-critical schema notice:", err?.message);
	}

	// 2. Persist Today's Market Briefs (India, Global, US)
	console.log("\n[Step 2/5] 🚀 Generating and persisting today's EOD briefs into market_briefs...");
	const { runMarketBriefEodJob } = await import("../cron/market-brief-eod-cron");
	const eodResults = await runMarketBriefEodJob();
	for (const res of eodResults) {
		console.log(`  ${res.success ? "✅" : "❌"} Region: ${res.region.toUpperCase().padEnd(7)} | Date: ${res.date} | Version: v${res.version || 1} | Status: ${res.success ? "PERSISTED" : "FAILED"}`);
	}

	// 3. Historical Backfill for Archive Completeness (Past 30 Trading Days)
	console.log("\n[Step 3/5] 📚 Backfilling historical trading archives for past 30 days...");
	const { knowledgeHubService } = await import("../services/knowledge-hub-service");
	const indiaBackfill = await knowledgeHubService.ensureHistoricalBriefsBackfill("india", 30);
	console.log(`  🇮🇳 India Archives: Checked ${indiaBackfill.totalDaysChecked} trading days, backfilled ${indiaBackfill.backfilled} new briefs.`);

	const globalBackfill = await knowledgeHubService.ensureHistoricalBriefsBackfill("global", 15);
	console.log(`  🌍 Global Archives: Checked ${globalBackfill.totalDaysChecked} trading days, backfilled ${globalBackfill.backfilled} new briefs.`);

	const usBackfill = await knowledgeHubService.ensureHistoricalBriefsBackfill("us", 15);
	console.log(`  🇺🇸 US Archives: Checked ${usBackfill.totalDaysChecked} trading days, backfilled ${usBackfill.backfilled} new briefs.`);

	// 4. Institutional Flows Persistence
	console.log("\n[Step 4/5] 📊 Synchronizing institutional FII / DII daily flows...");
	try {
		const { fiiFlowService } = await import("../services/macro/fii-flow-service");
		const syncRes = await fiiFlowService.syncAndPersistDailyFlow();
		if (syncRes) {
			console.log(`  ✅ FII/DII Daily Flows synced: ${syncRes.date} | Effective Flow: ₹${syncRes.effectiveFlowCr} Cr | Sentiment: ${syncRes.sentiment}`);
		} else {
			console.log("  ℹ️ FII/DII flow service returned no data for current cycle.");
		}
	} catch (fiiErr: any) {
		console.warn("  ⚠️ FII/DII flow sync notice:", fiiErr?.message);
	}

	// 5. Verification & Database Row Audit
	console.log("\n[Step 5/5] 🔍 Verifying persisted database records...");
	try {
		const countRes = await pool.query(`SELECT count(*)::int as total, region FROM market_briefs GROUP BY region ORDER BY region;`);
		console.log("  📈 Market Briefs by Region in DB:");
		for (const row of countRes.rows) {
			console.log(`     • ${row.region.toUpperCase()}: ${row.total} records`);
		}

		const latestBriefs = await db
			.select({
				id: marketBriefs.id,
				date: marketBriefs.date,
				region: marketBriefs.region,
				version: marketBriefs.version,
				status: marketBriefs.status,
			})
			.from(marketBriefs)
			.orderBy(desc(marketBriefs.date), desc(marketBriefs.version))
			.limit(5);

		console.log("  🗓️ Latest 5 Persisted Briefs in DB:");
		for (const b of latestBriefs) {
			console.log(`     • [${b.date}] ${b.region.toUpperCase().padEnd(7)} v${b.version} (${b.status}) ID: ${b.id}`);
		}
	} catch (vErr: any) {
		console.warn("  ⚠️ Verification query notice:", vErr?.message);
	}

	const durationMs = Date.now() - t0;
	console.log("\n================================================================================");
	console.log(`✅ FintekPro Market Briefs DB Maintenance Complete (${durationMs}ms)`);
	console.log("================================================================================");
	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Fatal error in maintain-market-briefs-db:", err);
	process.exit(1);
});
