import { Router, Request, Response, NextFunction } from "express";
import {
	pickOfTheDayService,
	PickCategory,
} from "../services/pick-of-the-day-service";
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

const router = Router();

router.get("/today", async (req, res) => {
	try {
		let rawPicks = await pickOfTheDayService.getTodaysPicks();
		let isFallback = false;

		if (rawPicks.length === 0) {
			rawPicks = await pickOfTheDayService.getMostRecentPicks();
			isFallback = rawPicks.length > 0;
		}

		const { picks, categoryLastUpdated } =
			await enrichPicksWithDataSource(rawPicks);
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

export default router;
