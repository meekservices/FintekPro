/* eslint-disable no-console */
import { Router } from "express";
import { z } from "zod";
import { db } from "../../db";
import { sql, eq, desc } from "drizzle-orm";
import { aiPromptVersions } from "@shared/schema";
import { ALL_PROMPTS } from "../../ai/prompts/registry";
import { requireAdmin } from "../../middleware/roleMiddleware";
import { aiAdvisoryDecisionService } from "../../services/ai-advisory-decision-service";

const VALID_DECISIONS = ["APPROVED", "MODIFIED", "BLOCKED", "DOWNGRADED"] as const;

const downgradeAdviceSchema = z.object({
	eventId: z.string().trim().min(1, "eventId is required"),
	reason: z.string().trim().max(500).optional(),
});

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
	} catch (err: unknown) {
		console.error("[AI Governance] Table init error:", err instanceof Error ? err.message : String(err));
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
	} catch (error: unknown) {
		console.error("[AI Governance] Failed to list prompts:", error instanceof Error ? error.message : String(error));
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
		} catch (error: unknown) {
			console.error(
				"[AI Governance] Failed to get prompt history:",
				error instanceof Error ? error.message : String(error),
			);
			res.status(500).json({ error: "Failed to retrieve prompt history" });
		}
	},
);

// ── Live AI Advisory Governance Feed (FASP-AI v1.0 & SEBI RIA Norms) ──────────

router.get("/api/admin/ai/governance-events", requireAdmin, async (req, res) => {
	try {
		const rawPage = Number.parseInt(String(req.query.page ?? "1"), 10);
		const rawLimit = Number.parseInt(String(req.query.limit ?? "50"), 10);
		const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
		const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(100, rawLimit) : 50;

		const rawDecision = typeof req.query.decision === "string" ? req.query.decision.toUpperCase() : undefined;
		if (rawDecision && !VALID_DECISIONS.includes(rawDecision as (typeof VALID_DECISIONS)[number])) {
			return res.status(400).json({
				success: false,
				error_code: "INVALID_DECISION_FILTER",
				message: `Invalid decision filter. Expected one of: ${VALID_DECISIONS.join(", ")}`,
				retryable: false,
			});
		}

		const result = await aiAdvisoryDecisionService.getDecisions({
			page,
			limit,
			decision: rawDecision as (typeof VALID_DECISIONS)[number] | undefined,
		});

		res.json({
			success: true,
			data: result.items,
			total: result.total,
			page: result.page,
			limit: result.limit,
			summary: result.summary,
			meta: result.meta,
		});
	} catch (error: unknown) {
		console.error("[AI Governance] Error fetching governance events:", error instanceof Error ? error.message : String(error));
		res.status(500).json({
			success: false,
			error_code: "AI_GOVERNANCE_FEED_ERROR",
			message: "Failed to retrieve AI governance feed",
			retryable: true,
		});
	}
});

router.post("/api/admin/ai/downgrade-advice", requireAdmin, async (req, res) => {
	try {
		const parsed = downgradeAdviceSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				error_code: "INVALID_DOWNGRADE_PAYLOAD",
				message: parsed.error.issues[0]?.message || "Invalid request payload",
				retryable: false,
			});
		}

		const { eventId, reason } = parsed.data;
		const reqUser = (req as { user?: { id?: string; userId?: string } }).user;
		const adminUserId = reqUser?.id || reqUser?.userId || "admin";
		const result = await aiAdvisoryDecisionService.downgradeDecision(
			eventId,
			reason || "Quarantined by Administrator",
			adminUserId,
		);

		if (result.status === "NOT_FOUND") {
			return res.status(404).json({
				success: false,
				error_code: "DECISION_NOT_FOUND",
				message: `Advisory decision '${eventId}' was not found`,
				retryable: false,
			});
		}

		if (!result.success) {
			return res.status(500).json({
				success: false,
				error_code: "DOWNGRADE_FAILED",
				message: "Failed to downgrade advice",
				retryable: true,
			});
		}

		res.json({
			success: true,
			data: { eventId, status: result.status, timestamp: new Date().toISOString() },
		});
	} catch (error: unknown) {
		console.error("[AI Governance] Downgrade failed:", error instanceof Error ? error.message : String(error));
		res.status(500).json({
			success: false,
			error_code: "DOWNGRADE_FAILED",
			message: "Failed to downgrade advice",
			retryable: true,
		});
	}
});

export default router;
