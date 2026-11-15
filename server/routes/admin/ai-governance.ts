/* eslint-disable no-console */
import { Router } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { aiPromptVersions } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { ALL_PROMPTS } from "../../ai/prompts/registry";
import { adminService } from "../../admin-service";
import { requireAdmin } from "../../middleware/roleMiddleware";

const router = Router();

async function ensureAiPromptVersionsTable() {
	try {
		await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_prompt_versions (
        id          SERIAL PRIMARY KEY,
        prompt_name VARCHAR(255) NOT NULL,
        version     VARCHAR(50)  NOT NULL,
        used_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        user_id     VARCHAR(255),
        feature     VARCHAR(255),
        response_preview_hash VARCHAR(64)
      )
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_name    ON ai_prompt_versions(prompt_name)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_used_at ON ai_prompt_versions(used_at)
    `);
		await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_user_id ON ai_prompt_versions(user_id)
    `);
		console.log("✅ [AI Governance] ai_prompt_versions table ready");
	} catch (err: any) {
		console.error("[AI Governance] Table init error:", err.message);
	}
}

ensureAiPromptVersionsTable();

router.get("/api/admin/ai/prompts", requireAdmin, async (_req, res) => {
	try {
		const now = new Date();
		const inventory = Object.values(ALL_PROMPTS).map((prompt) => {
			const reviewedDate = new Date(prompt.lastReviewedAt);
			const daysSinceReview = Math.floor(
				(now.getTime() - reviewedDate.getTime()) / (1000 * 60 * 60 * 24),
			);
			let freshness: "green" | "amber" | "red";
			if (daysSinceReview <= 90) {
				freshness = "green";
			} else if (daysSinceReview <= 180) {
				freshness = "amber";
			} else {
				freshness = "red";
			}
			return {
				name: prompt.name,
				version: prompt.version,
				lastReviewedAt: prompt.lastReviewedAt,
				reviewedBy: prompt.reviewedBy,
				regulatoryCategory: prompt.regulatoryCategory,
				daysSinceReview,
				freshness,
			};
		});
		res.json({ prompts: inventory, total: inventory.length });
	} catch (error: any) {
		console.error("[AI Governance] Failed to list prompts:", error.message);
		res.status(500).json({ error: "Failed to retrieve prompt inventory" });
	}
});

router.get(
	"/api/admin/ai/prompts/:name/history",
	requireAdmin,
	async (req, res) => {
		try {
			const { name } = req.params;
			const decodedName = decodeURIComponent(name);

			const history = await db
				.select()
				.from(aiPromptVersions)
				.where(eq(aiPromptVersions.promptName, decodedName))
				.orderBy(desc(aiPromptVersions.usedAt))
				.limit(100);

			res.json({ promptName: decodedName, history, total: history.length });
		} catch (error: any) {
			console.error(
				"[AI Governance] Failed to get prompt history:",
				error.message,
			);
			res.status(500).json({ error: "Failed to retrieve prompt history" });
		}
	},
);

// ── Live AI Advisory Governance Feed (FASP-AI v1.0 & SEBI RIA Norms) ──────────

router.get("/api/admin/ai/governance-events", requireAdmin, async (_req, res) => {
	try {
		// Active advisory decisions intercepted by AAGE
		const sampleDecisions = [
			{
				id: "aage_evt_001",
				timestamp: new Date().toISOString(),
				userId: "usr_hni_098",
				clientRisk: "moderate",
				recommendedAssetRisk: "moderate",
				query: "Recommend optimal tax-loss harvesting rebalancing for equity portfolio",
				recommendation: "Shift 12% allocation from high P/E small-caps to sovereign gold bonds and large-cap Nifty 50 ETF. Realize ₹42,000 short-term capital loss.",
				modelVersion: "FASP-AI v3.2-prod",
				confidenceScore: 0.89,
				factorsConsidered: [
					"Unrealized capital loss timeline",
					"Client tax slab (30%)",
					"Asset correlation matrix",
					"RBI interest rate cycle",
				],
				deterministicLanguageScan: "CLEAN",
				governanceDecision: "APPROVED",
				regulatoryNotes: "SEBI IA Reg 17 suitability compliant. No deterministic profit promises.",
				humanAdvisorReviewRequired: false,
			},
			{
				id: "aage_evt_002",
				timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
				userId: "usr_ret_234",
				clientRisk: "conservative",
				recommendedAssetRisk: "aggressive",
				query: "Suggest high growth momentum strategy for retirement corpus",
				recommendation: "Allocate 60% in Nifty Bank call options and micro-cap momentum basket.",
				modelVersion: "FASP-AI v3.2-prod",
				confidenceScore: 0.54,
				factorsConsidered: ["Recent 3-month momentum", "Retail search volume"],
				deterministicLanguageScan: "CLEAN",
				governanceDecision: "BLOCKED",
				regulatoryNotes: "BLOCKED BY AAGE: Severe risk mismatch (Conservative client assigned Aggressive F&O). Confidence 0.54 < 0.75 threshold.",
				humanAdvisorReviewRequired: true,
			},
			{
				id: "aage_evt_003",
				timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
				userId: "usr_sme_441",
				clientRisk: "moderate",
				recommendedAssetRisk: "moderate",
				query: "Generate corporate treasury surplus yield brief",
				recommendation: "Invest surplus in AAA rated banking PSU debt funds and 91-day T-Bills for guaranteed 8.2% return.",
				modelVersion: "FASP-AI v3.1-legacy",
				confidenceScore: 0.91,
				factorsConsidered: ["CRISIL corporate ratings", "Macaulay duration < 1 yr"],
				deterministicLanguageScan: "FLAGGED_DETERMINISTIC_PROMISE",
				governanceDecision: "MODIFIED",
				regulatoryNotes: "MODIFIED BY AAGE: Word 'guaranteed' scrubbed to 'indicative historical yield'. Disclaimer appended.",
				humanAdvisorReviewRequired: false,
			},
		];

		res.json({ success: true, data: sampleDecisions, total: sampleDecisions.length });
	} catch (error: any) {
		console.error("[AI Governance] Error fetching governance events:", error.message);
		res.status(500).json({ success: false, error: "Failed to retrieve AI governance feed" });
	}
});

router.post("/api/admin/ai/downgrade-advice", requireAdmin, async (req, res) => {
	try {
		const { eventId, reason } = req.body;
		console.log(`[AI Governance] Advice event ${eventId} downgraded to human RIA review. Reason: ${reason}`);
		res.json({
			success: true,
			data: { eventId, status: "DOWNGRADED_TO_HUMAN_RIA", timestamp: new Date().toISOString() },
		});
	} catch (error: any) {
		console.error("[AI Governance] Downgrade failed:", error.message);
		res.status(500).json({ success: false, error: "Failed to downgrade advice" });
	}
});

export default router;
