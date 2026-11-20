import dotenv from "dotenv";
dotenv.config();

import { db, pool } from "../server/db";
import { dailyPicks } from "../shared/schema";
import { eq } from "drizzle-orm";
import { faspAiGuardrailService } from "../server/services/fasp-ai-guardrail-service";
import { pickOfTheDayService } from "../server/services/pick-of-the-day-service";

async function remediate() {
	console.log("================================================================================");
	console.log("   REMEDIATING TODAY'S PICKS (2026-11-20) MISSING GUARDRAILS");
	console.log("================================================================================\n");

	try {
		const today = "2026-11-20";
		const picks = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, today));

		console.log(`Found ${picks.length} picks in daily_picks for ${today}. Checking guardrails...\n`);

		let remediatedCount = 0;

		for (const p of picks) {
			const reco = Number(p.recoPrice);
			const target = Number(p.targetPrice);
			const sl = Number(p.stoplossPrice);
			const isCredit = (p.keyMetrics as any)?.isCreditStrategy === true ||
				(p.category === "derivatives" && target < reco && reco > 0);

			// Run FASP-AI Guardrail Audit to scrub deterministic claims and append mandatory disclaimer
			const audit = faspAiGuardrailService.auditOutbound(p.rationale, {
				userId: "SYSTEM_ADVISORY",
				riskProfile: p.riskLevel || "medium",
				investmentHorizon: p.timeHorizon || "medium_term",
				factorsConsidered: [
					`category: ${p.category}`,
					`riskLevel: ${p.riskLevel}`,
					`recoPrice: ${p.recoPrice}`,
					`targetPrice: ${p.targetPrice}`,
					`stoplossPrice: ${p.stoplossPrice}`,
					...(p.sectorCategory ? [`sector: ${p.sectorCategory}`] : []),
					...(p.timeHorizon ? [`horizon: ${p.timeHorizon}`] : []),
				],
				confidenceScore: p.confidenceScore || 75,
				modelVersion: p.engineVersion || "FASP-AI-v2.0",
			});

			const km = ((p.keyMetrics as any) || {}) as Record<string, any>;
			const engineVersion = p.engineVersion || "FASP-AI-v2.0";
			const calcTimestamp = p.calculationTimestamp || p.createdAt || new Date();

			const updatedKm = {
				...km,
				engine_version: engineVersion,
				calculation_timestamp: calcTimestamp instanceof Date ? calcTimestamp.toISOString() : String(calcTimestamp),
				fasp_ai_audit: {
					approved: audit.approved,
					violations: audit.deterministicViolations,
					explainability: audit.explainability,
				},
			};

			const needsUpdate =
				p.rationale !== audit.scrubbedText ||
				!p.engineVersion ||
				!p.calculationTimestamp ||
				!km.engine_version;

			if (needsUpdate) {
				await db
					.update(dailyPicks)
					.set({
						rationale: audit.scrubbedText,
						engineVersion,
						calculationTimestamp: calcTimestamp instanceof Date ? calcTimestamp : new Date(calcTimestamp),
						keyMetrics: updatedKm,
						updatedAt: new Date(),
					})
					.where(eq(dailyPicks.id, p.id));

				console.log(`✅ Remediated Pick #${p.id} [${p.category.toUpperCase()}] ${p.instrumentName}:`);
				console.log(`   - Attached Regulatory Disclaimer & scrubbed ${audit.deterministicViolations.length} violations`);
				console.log(`   - Enforced engineVersion: ${engineVersion} | calcTimestamp: ${calcTimestamp}`);
				remediatedCount++;
			} else {
				console.log(`✓ Pick #${p.id} [${p.category.toUpperCase()}] ${p.instrumentName} already satisfies all guardrails.`);
			}
		}

		console.log(`\nRemediation complete! Updated ${remediatedCount} of ${picks.length} picks.`);

		// Invalidate caches
		await pickOfTheDayService.invalidatePicksCache();
		console.log("✅ Invalidated POTD Redis cache keys (picks:live, picks:daily:2026-11-20).");

	} catch (err: any) {
		console.error("❌ Remediation error:", err);
	} finally {
		if (pool && typeof pool.end === "function") await pool.end();
		process.exit(0);
	}
}

remediate();
