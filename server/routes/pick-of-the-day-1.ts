import { Router, Request, Response, NextFunction } from "express";
import {
	pickOfTheDayService,
	PickCategory,
} from "../services/pick-of-the-day-service";
import { pickOutcomeAnalyzer } from "../services/pick-outcome-analyzer";
import { db } from "../db";
import {
	dailyPicks,
	listedStocks,
	mutualFunds,
	bondCatalog,
	unlistedCompanies,
	globalInstruments,
	instrumentMaster,
	sgbPrimaryIssues,
	pickWatchlist,
	pickPriceAlerts,
	investmentProposals,
	investmentProposalItems,
	userNotifications,
} from "@shared/schema";
import { eq, like, or, sql, desc, and, count } from "drizzle-orm";
import nodemailer from "nodemailer";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import {
	REGULATORY_DISCLAIMER,
	DATA_SOURCES,
	enrichPicksWithDataSource,
} from "./pick-of-the-day-utils";

const watchlistAddSchema = z.object({
	pickId: z.number(),
	notes: z.string().optional(),
	priceAlertEnabled: z.boolean().optional(),
	alertThreshold: z.number().optional(),
	alertType: z
		.enum(["above", "below", "target_hit", "stoploss_hit"])
		.optional(),
});

const proposalAddSchema = z.object({
	pickId: z.number(),
	proposalId: z.string().optional(),
	amount: z.number().optional(),
	notes: z.string().optional(),
});

const shareSchema = z.object({
	pickId: z.number(),
	channel: z.enum(["email", "whatsapp"]),
	recipientEmail: z.string().email().optional(),
	recipientPhone: z.string().optional(),
	customMessage: z.string().optional(),
});

const alertUpdateSchema = z.object({
	priceAlertEnabled: z.boolean().optional(),
	alertThreshold: z.number().optional(),
	alertType: z
		.enum(["above", "below", "target_hit", "stoploss_hit"])
		.optional(),
});

// ── Fix K: Confidence decay curve ─────────────────────────────────────────────
// A pick published 45 days ago at confidenceScore 85 should not still display 85
// today — uncertainty grows as the pick ages toward expiry. Decay is linear from
// the initial score toward 50 (random) over the pick's full validity window.
// E.g. a 30-day pick at score 85 decays ~1.17 pts/day → score 50 at expiry.
function applyConfidenceDecay(picks: any[]): any[] {
	const now = Date.now();
	return picks.map((pick) => {
		if (!pick.recoDate || !pick.expiryDate || !pick.confidenceScore) return pick;
		try {
			const recoTs = new Date(pick.recoDate).getTime();
			const expiryTs = new Date(pick.expiryDate).getTime();
			const totalWindowMs = expiryTs - recoTs;
			if (totalWindowMs <= 0) return pick;
			const elapsedMs = Math.max(0, now - recoTs);
			const ageRatio = Math.min(1, elapsedMs / totalWindowMs); // 0 = fresh, 1 = at expiry
			// Linear interpolation: score → 50 as age → expiry
			const initial = pick.confidenceScore;
			const decayed = Math.round(initial - (initial - 50) * ageRatio);
			return {
				...pick,
				confidenceScore: decayed,
				keyMetrics: pick.keyMetrics
					? { ...pick.keyMetrics, confidenceDecayPct: Math.round(ageRatio * 100) }
					: pick.keyMetrics,
			};
		} catch {
			return pick;
		}
	});
}

const router = Router();

router.get("/today", async (req, res) => {
	try {
		let rawPicks = await pickOfTheDayService.getTodaysPicks();
		let isFallback = false;

		if (rawPicks.length === 0) {
			rawPicks = await pickOfTheDayService.getMostRecentPicks();
			isFallback = rawPicks.length > 0;
		}

		const { picks: rawEnriched, categoryLastUpdated } =
			await enrichPicksWithDataSource(rawPicks);
		// Fix K: apply confidence decay before sending to clients
		const picks = applyConfidenceDecay(rawEnriched);
		const fallbackDate =
			isFallback && picks.length > 0 ? picks[0].recoDate : undefined;

		res.json({
			success: true,
			date: new Date(Date.now() + 5.5 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0],
			picks,
			categoryLastUpdated,
			lastRefreshedAt: new Date().toISOString(),
			dataSources: DATA_SOURCES,
			disclaimer: REGULATORY_DISCLAIMER,
			isFallback,
			fallbackDate,
			message:
				picks.length === 0
					? "No picks generated yet. Picks will be auto-generated daily at 9:00 AM IST."
					: isFallback
						? `Showing most recent picks from ${fallbackDate}. Today's picks will be generated shortly.`
						: undefined,
		});
	} catch (error) {
		console.error("[API] Error fetching today's picks:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch today's picks" });
	}
});

router.get("/live", async (req, res) => {
	try {
		const rawPicks = await pickOfTheDayService.getLivePicks();
		const { picks: allPicks, categoryLastUpdated } =
			await enrichPicksWithDataSource(rawPicks);
		// Exclude picks that were just auto-expired by enrichment (expiryDate passed)
		const picks = allPicks.filter((p) => p.status !== "expired");
		const lastUpdated = await db
			.select({ maxUpdated: sql<string>`MAX(updated_at)` })
			.from(dailyPicks)
			.where(eq(dailyPicks.status, "live"));

		res.json({
			success: true,
			count: picks.length,
			picks,
			categoryLastUpdated,
			lastRefreshedAt: lastUpdated[0]?.maxUpdated || new Date().toISOString(),
			dataSources: DATA_SOURCES,
			disclaimer: REGULATORY_DISCLAIMER,
		});
	} catch (error) {
		console.error("[API] Error fetching live picks:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch live picks" });
	}
});

router.get("/history", async (req, res) => {
	try {
		const category = req.query.category as PickCategory | undefined;
		const limit = Number.parseInt(req.query.limit as string) || 50;

		const rawPicks = await pickOfTheDayService.getPickHistory(category, limit);
		const { picks, categoryLastUpdated } =
			await enrichPicksWithDataSource(rawPicks);
		res.json({
			success: true,
			count: picks.length,
			picks,
			dataSources: DATA_SOURCES,
			categoryLastUpdated,
			disclaimer: REGULATORY_DISCLAIMER,
		});
	} catch (error) {
		console.error("[API] Error fetching pick history:", error);
		res.status(500).json({ success: false, error: "Failed to fetch history" });
	}
});

router.get("/stats", async (req, res) => {
	try {
		const stats = await pickOfTheDayService.getPerformanceStats();
		const lastUpdated = await db
			.select({ maxUpdated: sql<string>`MAX(updated_at)` })
			.from(dailyPicks);

		res.json({
			success: true,
			stats,
			asOfDate: new Date().toISOString(),
			lastDataRefresh: lastUpdated[0]?.maxUpdated || new Date().toISOString(),
			dataSources: DATA_SOURCES,
			disclaimer: REGULATORY_DISCLAIMER,
		});
	} catch (error) {
		console.error("[API] Error fetching pick stats:", error);
		res.status(500).json({ success: false, error: "Failed to fetch stats" });
	}
});

router.post("/generate", requireAdmin, async (req, res) => {
	try {
		const picks = await pickOfTheDayService.generateDailyPicks();
		res.json({
			success: true,
			message: `Generated ${picks.length} picks`,
			picks,
		});
	} catch (error) {
		console.error("[API] Error generating picks:", error);
		res.status(500).json({ success: false, error: "Failed to generate picks" });
	}
});

// Authenticated agents can call this to fill in missing categories for today.
// Unlike /generate (admin-only), this only generates for categories with 0 picks today.
router.post("/catchup", requireAuth, async (req, res) => {
	try {
		// Use IST date so Cloud Run (UTC) correctly identifies today in India time
		const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
		const today = new Date(Date.now() + IST_OFFSET_MS)
			.toISOString()
			.split("T")[0];
		const categoryCounts = await db
			.select({ category: dailyPicks.category, cnt: sql`COUNT(*)` })
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, today))
			.groupBy(dailyPicks.category);

		const existingCategories = new Set(
			categoryCounts.map((r: any) => r.category),
		);
		const allCategories = [
			"listed_stocks",
			"mutual_funds",
			"bonds",
			"unlisted",
			"global_stocks",
			"etfs",
			"reits_invits",
			"sgb",
			"fixed_deposits",
			"derivatives",
		];
		const missing = allCategories.filter((c) => !existingCategories.has(c));

		if (missing.length === 0) {
			return res.json({
				success: true,
				message: `All categories covered for ${today}. No catch-up needed.`,
				existingCategories: Array.from(existingCategories),
				generated: 0,
			});
		}

		console.log(
			`[CatchUp] Agent triggered: Missing categories for ${today}: [${missing.join(", ")}]`,
		);
		const picks = await pickOfTheDayService.generateDailyPicks();
		res.json({
			success: true,
			message: `Catch-up generated ${picks.length} picks for missing categories: [${missing.join(", ")}]`,
			existingCategories: Array.from(existingCategories),
			missingCategories: missing,
			generated: picks.length,
		});
	} catch (error) {
		console.error("[API] Error in catch-up generation:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to generate catch-up picks" });
	}
});

router.post("/update-statuses", requireAdmin, async (req, res) => {
	try {
		const result = await pickOfTheDayService.updatePickStatuses();
		res.json({
			success: true,
			message: `Updated ${result.updated} picks`,
			details: result.details,
		});
	} catch (error) {
		console.error("[API] Error updating pick statuses:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to update statuses" });
	}
});

router.get("/admin/list", requireAdmin, async (req, res) => {
	try {
		const { category, status, limit = "50" } = req.query;

		const conditions = [];
		if (category && category !== "all") {
			conditions.push(eq(dailyPicks.category, category as any));
		}
		if (status && status !== "all") {
			conditions.push(eq(dailyPicks.status, status as any));
		}

		const picks = await db
			.select()
			.from(dailyPicks)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(dailyPicks.recoDate), desc(dailyPicks.id))
			.limit(Number.parseInt(limit as string));

		res.json({ success: true, picks });
	} catch (error) {
		console.error("[API] Error listing picks:", error);
		res.status(500).json({ success: false, error: "Failed to list picks" });
	}
});

router.get("/admin/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const [pick] = await db
			.select()
			.from(dailyPicks)
			.where(eq(dailyPicks.id, Number.parseInt(id)));

		if (!pick) {
			return res.status(404).json({ success: false, error: "Pick not found" });
		}

		res.json({ success: true, pick });
	} catch (error) {
		console.error("[API] Error fetching pick:", error);
		res.status(500).json({ success: false, error: "Failed to fetch pick" });
	}
});

router.post("/admin/create", requireAdmin, async (req, res) => {
	try {
		const {
			category,
			instrumentId,
			instrumentName,
			isin,
			symbol,
			market,
			recoPrice,
			targetPrice,
			stoplossPrice,
			expiryDate,
			rationale,
			riskLevel,
			suitableFor,
			keyMetrics,
		} = req.body;

		const recoDate = new Date().toISOString().split("T")[0];

		const [newPick] = await db
			.insert(dailyPicks)
			.values({
				category,
				instrumentId,
				instrumentName,
				isin,
				symbol,
				market,
				recoDate,
				recoPrice: recoPrice.toString(),
				targetPrice: targetPrice.toString(),
				stoplossPrice: stoplossPrice.toString(),
				currentPrice: recoPrice.toString(),
				expiryDate,
				rationale,
				riskLevel: riskLevel || "medium",
				suitableFor: suitableFor || ["Balanced"],
				keyMetrics: keyMetrics || {},
				generatedBy: "manual",
			})
			.returning();

		res.json({ success: true, pick: newPick });
	} catch (error) {
		console.error("[API] Error creating pick:", error);
		res.status(500).json({ success: false, error: "Failed to create pick" });
	}
});

router.patch("/admin/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		if (updates.recoPrice) updates.recoPrice = updates.recoPrice.toString();
		if (updates.targetPrice)
			updates.targetPrice = updates.targetPrice.toString();
		if (updates.stoplossPrice)
			updates.stoplossPrice = updates.stoplossPrice.toString();
		if (updates.currentPrice)
			updates.currentPrice = updates.currentPrice.toString();

		const [updated] = await db
			.update(dailyPicks)
			.set(updates)
			.where(eq(dailyPicks.id, Number.parseInt(id)))
			.returning();

		if (!updated) {
			return res.status(404).json({ success: false, error: "Pick not found" });
		}

		res.json({ success: true, pick: updated });
	} catch (error) {
		console.error("[API] Error updating pick:", error);
		res.status(500).json({ success: false, error: "Failed to update pick" });
	}
});

router.delete("/admin/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;

		const [deleted] = await db
			.delete(dailyPicks)
			.where(eq(dailyPicks.id, Number.parseInt(id)))
			.returning();

		if (!deleted) {
			return res.status(404).json({ success: false, error: "Pick not found" });
		}

		res.json({ success: true, message: "Pick deleted" });
	} catch (error) {
		console.error("[API] Error deleting pick:", error);
		res.status(500).json({ success: false, error: "Failed to delete pick" });
	}
});

/**
 * POST /api/picks/admin/force-generate
 * Admin-only: Force-generate today's picks immediately, bypassing market-holiday guards.
 * Use this for:
 *   - Recovery when holiday data is incorrect (e.g. wrong Muharram date)
 *   - Scheduler failure recovery without a full redeploy
 *   - QA / staging environment testing
 *
 * @body { overwrite?: boolean } — if true, clears today's picks before regenerating
 * @outputs { success, message, picksGenerated, date }
 */
router.post("/admin/force-generate", requireAdmin, async (req, res) => {
	const startTime = Date.now();
	try {
		const overwrite = req.body?.overwrite === true;
		const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
		const todayIST = new Date(Date.now() + IST_OFFSET_MS).toISOString().split("T")[0];

		console.info(JSON.stringify({
			event: "PICKS_FORCE_GENERATE_TRIGGERED",
			user_id: (req as any).user?.id,
			date: todayIST,
			overwrite,
			latency_ms: Date.now() - startTime,
			status: "triggered",
		}));

		if (overwrite) {
			// Delete today's picks first so fresh ones are created
			const deleted = await db
				.delete(dailyPicks)
				.where(eq(dailyPicks.recoDate, todayIST))
				.returning();
			console.info(`[ForceGenerate] Cleared ${deleted.length} existing picks for ${todayIST}`);
		}

		// Run generation (bypasses holiday guard — admin's intent is explicit)
		await pickOfTheDayService.generateDailyPicks();

		// Count what was created
		const [result] = await db
			.select({ count: sql<number>`COUNT(*)` })
			.from(dailyPicks)
			.where(eq(dailyPicks.recoDate, todayIST));
		const picksGenerated = Number(result?.count ?? 0);

		console.info(JSON.stringify({
			event: "PICKS_FORCE_GENERATE_COMPLETE",
			user_id: (req as any).user?.id,
			date: todayIST,
			picks_generated: picksGenerated,
			latency_ms: Date.now() - startTime,
			status: "success",
		}));

		res.json({
			success: true,
			message: `Force-generated ${picksGenerated} picks for ${todayIST}`,
			picksGenerated,
			date: todayIST,
			latency_ms: Date.now() - startTime,
		});
	} catch (error: any) {
		console.error(JSON.stringify({
			event: "PICKS_FORCE_GENERATE_ERROR",
			user_id: (req as any).user?.id,
			error_code: "FORCE_GENERATE_FAILED",
			message: error.message,
			retryable: true,
			latency_ms: Date.now() - startTime,
			status: "error",
		}));
		res.status(500).json({
			success: false,
			error_code: "FORCE_GENERATE_FAILED",
			message: error.message,
			retryable: true,
		});
	}
});


/**
 * GET /api/agent/picks/signal-efficacy
 * Returns the SignalEfficacyReport for closed picks over the last N days.
 * Shows per-signal lift scores, hit rates, and scoring weight hints.
 *
 * Query params:
 *   windowDays  number  Look-back window in days (default 90, max 365)
 *
 * @access  Admin only — advisory-grade data (FASP-AI v3.0)
 */
router.get("/signal-efficacy", requireAdmin, async (req: Request, res: Response) => {
	const start = Date.now();
	try {
		const rawDays = Number.parseInt(req.query.windowDays as string) || 90;
		const windowDays = Math.min(365, Math.max(7, rawDays)); // clamp 7–365

		const report = await pickOutcomeAnalyzer.analyzeOutcomes(windowDays);

		res.json({
			success: true,
			data: report,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v3.0",
				latency_ms: Date.now() - start,
			},
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		console.error(JSON.stringify({
			event: "SIGNAL_EFFICACY_ERROR",
			error_code: "ANALYSIS_FAILED",
			message: err.message,
			retryable: true,
			latency_ms: Date.now() - start,
			status: "error",
		}));
		res.status(500).json({
			success: false,
			error_code: "ANALYSIS_FAILED",
			message: err.message,
			retryable: true,
		});
	}
});

/**
 * GET /api/agent/picks/generation-log
 * Fix M: Returns the last N pick generation run summaries including regime,
 * categories attempted, sector gate blocks, Gemini circuit status, and per-pick results.
 *
 * Query params:
 *   limit  number  Number of runs to return (default 7, max 30)
 *
 * @access Admin only
 */
router.get("/generation-log", requireAdmin, async (req: Request, res: Response) => {
	try {
		const limit = Math.min(30, Math.max(1, Number.parseInt(req.query.limit as string) || 7));
		const log = pickOfTheDayService.getGenerationLog(limit);
		res.json({
			success: true,
			data: log,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v3.0",
				count: log.length,
			},
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		res.status(500).json({ success: false, error_code: "LOG_FETCH_FAILED", message: err.message, retryable: true });
	}
});

/**
 * POST /api/agent/picks/pre-generate
 * Fix N: Triggers a T-1 async pre-generation dry run.
 * Pre-warms the AI alpha cache for all stock candidates so morning generation
 * completes in seconds instead of 30-60s.
 *
 * @access Admin only
 */
router.post("/pre-generate", requireAdmin, async (req: Request, res: Response) => {
	const start = Date.now();
	try {
		const result = await pickOfTheDayService.triggerPreGeneration();
		console.log(JSON.stringify({
			event: "PRE_GENERATION_TRIGGERED",
			user_id: (req as any).user?.id,
			cached: result.cached,
			latency_ms: Date.now() - start,
			status: "success",
		}));
		res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v3.0",
				latency_ms: Date.now() - start,
			},
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		res.status(500).json({ success: false, error_code: "PRE_GENERATE_FAILED", message: err.message, retryable: true });
	}
});

/**
 * GET /api/agent/picks/research/us-adr/:symbol
 * Fix L: Fetches research data for Indian ADRs (INFY, WIT, HDB, HDFC, etc.)
 * from Tickertape/Screener.in as a supplement to the AI alpha signal.
 * Returns price, PE, returns, sector, analyst rating if available.
 *
 * @access  Auth required
 */
router.get("/research/us-adr/:symbol", requireAuth, async (req: Request, res: Response) => {
	const start = Date.now();
	const { symbol } = req.params;
	if (!symbol || !/^[A-Z]{1,6}$/.test(symbol.toUpperCase())) {
		return res.status(400).json({ success: false, error_code: "INVALID_SYMBOL", message: "Invalid ticker symbol" });
	}
	const ticker = symbol.toUpperCase();
	try {
		// Primary: Yahoo Finance for US-listed price + fundamentals
		const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
		const yahooRes = await fetch(yahooUrl, {
			headers: { "User-Agent": "Mozilla/5.0" },
			signal: AbortSignal.timeout(6000),
		});
		let price: number | null = null;
		let change1d: number | null = null;
		if (yahooRes.ok) {
			const yJson = await yahooRes.json() as any;
			const meta = yJson?.chart?.result?.[0]?.meta;
			price = meta?.regularMarketPrice ?? null;
			change1d = meta && meta.previousClose
				? Math.round(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 10000) / 100
				: null;
		}

		// Secondary: Yahoo Finance quote summary for fundamentals
		const summaryUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=summaryDetail,defaultKeyStatistics,financialData`;
		const summaryRes = await fetch(summaryUrl, {
			headers: { "User-Agent": "Mozilla/5.0" },
			signal: AbortSignal.timeout(6000),
		});
		let pe: number | null = null;
		let eps: number | null = null;
		let analystRating: string | null = null;
		let sector: string | null = null;
		if (summaryRes.ok) {
			const sJson = await summaryRes.json() as any;
			const detail = sJson?.quoteSummary?.result?.[0];
			pe = detail?.summaryDetail?.trailingPE?.raw ?? null;
			eps = detail?.defaultKeyStatistics?.trailingEps?.raw ?? null;
			analystRating = detail?.financialData?.recommendationKey ?? null;
			sector = detail?.summaryDetail?.sector ?? null;
		}

		res.json({
			success: true,
			data: {
				symbol: ticker,
				exchange: "NYSE/NASDAQ",
				isADR: true,
				price,
				change1dPct: change1d,
				pe: pe !== null ? Math.round(pe * 100) / 100 : null,
				eps,
				sector,
				analystRating,
				disclaimer: "US ADR data sourced from Yahoo Finance. This is a research tool — not a recommendation. FASP-AI v3.0.",
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v3.0",
				latency_ms: Date.now() - start,
			},
		});
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		res.status(500).json({ success: false, error_code: "ADR_FETCH_FAILED", message: err.message, retryable: true });
	}
});

export default router;
