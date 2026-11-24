/**
 * CLI Script: Enrich Prospect Leads with MCA & Financial Intelligence
 *
 * Scans `prospect_leads` for records with missing CIN or missing Revenue,
 * resolves them against CredHive / Probe42 / internal databases,
 * and updates their corporate financials, CIN, GST, and realistic data quality score.
 *
 * Usage:
 *   npx tsx scripts/enrich-prospect-leads.ts [--limit=50]
 */

import { leadMcaEnrichmentService } from "../server/services/lead-mca-enrichment-service";

async function main() {
	console.log("🚀 Starting Prospect Leads MCA & Corporate Financials Enrichment...");

	const limitArg = process.argv.find((a) => a.startsWith("--limit="));
	const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : 50;

	const summary = await leadMcaEnrichmentService.batchEnrichLeads(limit);

	console.log("\n=======================================================");
	console.log("📊 LEAD MCA ENRICHMENT BATCH SUMMARY");
	console.log("=======================================================");
	console.log(`Total Leads Processed : ${summary.totalProcessed}`);
	console.log(`Fully Enriched (MCA+Fin): ${summary.fullyEnriched}`);
	console.log(`Partially Enriched (CIN): ${summary.partiallyEnriched}`);
	console.log(`Contact Only (No CIN) : ${summary.contactOnly}`);
	console.log(`Errors                : ${summary.errors}`);
	console.log(`Total Latency         : ${summary.latencyMs}ms`);
	console.log("=======================================================\n");

	if (summary.results.length > 0) {
		console.log("Results Breakdown:");
		for (const r of summary.results) {
			console.log(
				`- [${r.status}] ${r.companyName} | CIN: ${r.cin || "N/A"} | Rev: ${r.annualRevenue ? `₹${(Number(r.annualRevenue)/1e7).toFixed(2)}Cr` : "N/A"} | Quality: ${r.enrichmentScore}% | Score: ${r.leadScore}/100`,
			);
		}
	}

	process.exit(0);
}

main().catch((err) => {
	console.error("❌ Fatal error during lead enrichment:", err);
	process.exit(1);
});
