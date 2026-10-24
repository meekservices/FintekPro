/**
 * @file scripts/enforce-model-portfolio-compliance.ts
 * @description Command-line execution script to enforce and record SEBI statutory compliance across all model portfolios.
 *
 * Implements:
 * 1. Seeds & verifies all regulated institutional tiers (Retail MF, HNI PMS, UHNI AIF).
 * 2. Runs SEBI Seventh Schedule holding concentration & statutory limits.
 * 3. Persists structured compliance results directly to model_portfolios.sebi_compliance_rules.
 * 4. Logs immutable compliance audit trails in compliance_audit_trail table.
 */

import { sebiHoldingComplianceService } from "../server/services/sebi-holding-compliance-service";

async function main() {
	console.log("================================================================================");
	console.log("🛡️  FINTEKPRO SEBI STATUTORY COMPLIANCE IMPLEMENTATION ENGINE");
	console.log("================================================================================");

	try {
		const result =
			await sebiHoldingComplianceService.enforceAndRecordAllPortfoliosCompliance();

		console.log("\n📊 COMPLIANCE EXECUTION SUMMARY:");
		console.log(`• Total Portfolios Processed : ${result.totalProcessed}`);
		console.log(`• Fully Compliant           : ${result.compliant}`);
		console.log(`• Warnings (Proactive)       : ${result.warning}`);
		console.log(`• Non-Compliant (Breaches)   : ${result.nonCompliant}`);
		console.log(`• Latency                   : ${result.executionLatencyMs}ms`);

		console.log("\n📋 DETAILED PORTFOLIO AUDIT MATRIX:");
		console.log("--------------------------------------------------------------------------------");
		for (const rec of result.records) {
			const statusSymbol =
				rec.complianceStatus === "COMPLIANT"
					? "✅ PASS"
					: rec.complianceStatus === "WARNING"
						? "⚠️  WARN"
						: "❌ FAIL";

			console.log(`[${statusSymbol}] ${rec.name} (${rec.id})`);
			console.log(`       Tier: ${rec.portfolioTier.toUpperCase()} | Vehicle: ${rec.vehicleType} | Score: ${rec.complianceScore}/100`);
			console.log(`       Regime: ${rec.statutoryRegime}`);
			console.log(`       Statutory Min Floor: ₹${Number(rec.statutoryMinInvestment).toLocaleString("en-IN")}`);
			console.log(`       Custody Structure: ${rec.custodyStructure}`);
			if (rec.breaches.length > 0) {
				console.log(`       🚨 Breaches: ${rec.breaches.join("; ")}`);
			}
			if (rec.warnings.length > 0) {
				console.log(`       ⚠️  Warnings: ${rec.warnings.join("; ")}`);
			}
			console.log(`       Timestamp: ${rec.implementedAt}`);
			console.log("--------------------------------------------------------------------------------");
		}

		console.log("\n✅ All model portfolios successfully audited, enforced, and recorded in database.");
		process.exit(0);
	} catch (error: any) {
		console.error("❌ Fatal error executing SEBI compliance enforcement:", error);
		process.exit(1);
	}
}

main();
