/* eslint-disable no-console */
import { Router } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import { aiPromptVersions } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { ALL_PROMPTS } from "../../ai/prompts/registry";
import { adminService } from "../../admin-service";
import { requireAdmin } from "../../middleware/roleMiddleware";
import { aiAdvisoryDecisionService } from "../../services/ai-advisory-decision-service";

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

router.get("/api/admin/ai/governance-events", requireAdmin, async (req, res) => {
	try {
		const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
		const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
		const decision = req.query.decision as any;

		const result = await aiAdvisoryDecisionService.getDecisions({
			page,
			limit,
			decision,
		});

		res.json({
			success: true,
			data: result.items,
			total: result.total,
			page: result.page,
			limit: result.limit,
			meta: result.meta,
		});
	} catch (error: any) {
		console.error("[AI Governance] Error fetching governance events:", error.message);
		res.status(500).json({ success: false, error: "Failed to retrieve AI governance feed" });
	}
});

router.post("/api/admin/ai/downgrade-advice", requireAdmin, async (req, res) => {
	try {
		const { eventId, reason } = req.body;
		const adminUserId = (req as any).user?.id || (req as any).user?.userId || "admin";
		const result = await aiAdvisoryDecisionService.downgradeDecision(
			eventId,
			reason || "Quarantined by Administrator",
			adminUserId,
		);

		res.json({
			success: result.success,
			data: { eventId, status: result.status, timestamp: new Date().toISOString() },
		});
	} catch (error: any) {
		console.error("[AI Governance] Downgrade failed:", error.message);
		res.status(500).json({ success: false, error: "Failed to downgrade advice" });
	}
});

export default router;
