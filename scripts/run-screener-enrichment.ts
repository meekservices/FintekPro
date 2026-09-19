/**
 * @file run-screener-enrichment.ts
 * @description Standalone CLI runner for Screener Enrichment.
 *
 * Usage:
 *   npx tsx scripts/run-screener-enrichment.ts [--gemini] [--limit=100]
 */

import { bootstrapScreenerMetrics } from "../server/services/screener/screener-enrichment-engine";
import { runGeminiScreenerEnrichment } from "../server/services/screener/gemini-screener-enrichment";

async function main() {
	const args = process.argv.slice(2);
	const isGemini = args.includes("--gemini");
	const limitArg = args.find((a) => a.startsWith("--limit="));
	const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : (isGemini ? 25 : 5000);

	console.log(`\n🚀 [FintekPro] Starting Screener Enrichment (mode: ${isGemini ? "Gemini AI" : "Native Mathematical Bootstrap"}, limit: ${limit})`);

	if (isGemini) {
		const res = await runGeminiScreenerEnrichment({ limit });
		console.log("\n✅ Gemini Screener Enrichment Complete:");
		console.log(`   Processed: ${res.processed}`);
		console.log(`   Analyst Consensus Inserted: ${res.analystInserted}`);
		console.log(`   DCF Valuations Inserted: ${res.dcfInserted}`);
		console.log(`   Forward P/E Updated: ${res.forwardPeUpdated}`);
		console.log(`   Errors: ${res.errors}, Skipped: ${res.skipped}`);
		console.log(`   Duration: ${(res.durationMs / 1000).toFixed(2)}s\n`);
	} else {
		const res = await bootstrapScreenerMetrics({ limit });
		console.log("\n✅ Native Screener Bootstrap Complete:");
		console.log(`   Processed: ${res.processed}`);
		console.log(`   DCF Valuations Inserted: ${res.dcfInserted}`);
		console.log(`   Analyst Consensus Inserted: ${res.analystInserted}`);
		console.log(`   Forward P/E Updated: ${res.forwardPeUpdated}`);
		console.log(`   Technicals Snapshot Updated: ${res.technicalsUpdated}`);
		console.log(`   Duration: ${(res.durationMs / 1000).toFixed(2)}s\n`);
	}

	process.exit(0);
}

main().catch((err) => {
	console.error("\n❌ Screener enrichment failed:", err);
	process.exit(1);
});
