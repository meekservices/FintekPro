// @ts-nocheck
import { Router } from "express";
import { db } from "../db";
import {
	mldMaster,
	mldPriceHistory,
	mldMonthwisePerformance,
	clientPortfolioMld,
	users,
	investmentInquiries,
} from "@shared/schema";
import { eq, desc, and, ilike, or, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import {
	scrapeBseMldListings,
	generateSampleMldListings,
	type BseMldListing,
} from "../services/bse-mld-scraper";
import {
	scrapeNseMldListings,
	generateSampleNseMldListings,
	type NseMldListing,
} from "../services/nse-mld-scraper";

const router = Router();

// ============ MLD STORE ENDPOINTS ============

// GET /mld - List all published MLDs for store
router.get("/mld", async (req, res) => {
	try {
		const {
			issuer,
			underlying,
			payoffType,
			status,
			search,
			limit = "50",
			offset = "0",
		} = req.query;

		const conditions = [eq(mldMaster.isPublished, true)];

		if (issuer) conditions.push(eq(mldMaster.issuer, issuer as string));
		if (underlying)
			conditions.push(eq(mldMaster.underlying, underlying as string));
		if (payoffType)
			conditions.push(eq(mldMaster.payoffType, payoffType as string));
		if (status) conditions.push(eq(mldMaster.status, status as string));
		if (search) {
			conditions.push(
				or(
					ilike(mldMaster.name, `%${search}%`),
					ilike(mldMaster.isin, `%${search}%`),
					ilike(mldMaster.issuer, `%${search}%`),
				)!,
			);
		}

		const mlds = await db
			.select()
			.from(mldMaster)
			.where(and(...conditions))
			.orderBy(desc(mldMaster.createdAt))
			.limit(Number.parseInt(limit as string))
			.offset(Number.parseInt(offset as string));

		// Get total count for pagination
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(mldMaster)
			.where(and(...conditions));

		res.json({
			mlds,
			total: countResult?.count || 0,
			limit: Number.parseInt(limit as string),
			offset: Number.parseInt(offset as string),
		});
	} catch (error: any) {
		console.error("Error fetching MLDs:", error);
		res.status(500).json({ error: "Failed to fetch MLDs" });
	}
});

// GET /mld/:id - Get MLD details
router.get("/mld/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const [mld] = await db.select().from(mldMaster).where(eq(mldMaster.id, id));

		if (!mld) {
			return res.status(404).json({ error: "MLD not found" });
		}

		// Get price history
		const priceHistory = await db
			.select()
			.from(mldPriceHistory)
			.where(eq(mldPriceHistory.mldId, id))
			.orderBy(desc(mldPriceHistory.priceDate))
			.limit(100);

		// Get monthly performance
		const monthlyPerformance = await db
			.select()
			.from(mldMonthwisePerformance)
			.where(eq(mldMonthwisePerformance.mldId, id))
			.orderBy(desc(mldMonthwisePerformance.monthYear))
			.limit(24);

		// Calculate scenario payoffs
		const scenarioPayoffs = calculateScenarioPayoffs(mld);

		res.json({
			mld,
			priceHistory,
			monthlyPerformance,
			scenarioPayoffs,
		});
	} catch (error: any) {
		console.error("Error fetching MLD details:", error);
		res.status(500).json({ error: "Failed to fetch MLD details" });
	}
});

// GET /mld/:id/analytics - Get MLD analytics
router.get("/mld/:id/analytics", async (req, res) => {
	try {
		const { id } = req.params;

		const [mld] = await db.select().from(mldMaster).where(eq(mldMaster.id, id));

		if (!mld) {
			return res.status(404).json({ error: "MLD not found" });
		}

		const analytics = calculateMldAnalytics(mld);

		res.json(analytics);
	} catch (error: any) {
		console.error("Error fetching MLD analytics:", error);
		res.status(500).json({ error: "Failed to fetch MLD analytics" });
	}
});

// GET /mld/:id/scenario - Get scenario analysis
router.get("/mld/:id/scenario", async (req, res) => {
	try {
		const { id } = req.params;

		const [mld] = await db.select().from(mldMaster).where(eq(mldMaster.id, id));

		if (!mld) {
			return res.status(404).json({ error: "MLD not found" });
		}

		const scenarios = generateScenarioAnalysis(mld);

		res.json(scenarios);
	} catch (error: any) {
		console.error("Error generating scenario analysis:", error);
		res.status(500).json({ error: "Failed to generate scenario analysis" });
	}
});

// ============ ADMIN MLD MANAGEMENT ============

// GET /admin/mld - List all MLDs for admin
router.get("/admin/mld", requireAdmin, async (req, res) => {
	try {
		const mlds = await db
			.select()
			.from(mldMaster)
			.orderBy(desc(mldMaster.createdAt));

		res.json({ mlds });
	} catch (error: any) {
		console.error("Error fetching admin MLDs:", error);
		res.status(500).json({ error: "Failed to fetch MLDs" });
	}
});

// POST /admin/mld - Create new MLD
router.post("/admin/mld", requireAdmin, async (req, res) => {
	try {
		const mldData = req.body;

		// Validate required fields
		if (
			!mldData.isin ||
			!mldData.name ||
			!mldData.issuer ||
			!mldData.underlying ||
			!mldData.payoffType ||
			!mldData.maturityDate
		) {
			return res.status(400).json({
				error:
					"Missing required fields: isin, name, issuer, underlying, payoffType, maturityDate",
			});
		}

		const [newMld] = await db
			.insert(mldMaster)
			.values({
				...mldData,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning();

		res.status(201).json(newMld);
	} catch (error: any) {
		console.error("Error creating MLD:", error);
		if (error.code === "23505") {
			return res
				.status(400)
				.json({ error: "MLD with this ISIN already exists" });
		}
		res.status(500).json({ error: "Failed to create MLD" });
	}
});

// PUT /admin/mld/:id - Update MLD
router.put("/admin/mld/:id", requireAdmin, async (req, res) => {
	try {
		const { id } = req.params;
		const updateData = req.body;

		const [updated] = await db
			.update(mldMaster)
			.set({
				...updateData,
				updatedAt: new Date(),
			})
			.where(eq(mldMaster.id, id))
			.returning();

		if (!updated) {
			return res.status(404).json({ error: "MLD not found" });
		}

		res.json(updated);
	} catch (error: any) {
		console.error("Error updating MLD:", error);
		res.status(500).json({ error: "Failed to update MLD" });
	}
});

// PUT /admin/mld/:id/publish - Toggle publish status by URL param (PUT method)
router.put("/admin/mld/:id/publish", requireAdmin, async (req, res) => {
	try {
		const mldId = req.params.id;
		const { isPublished = true } = req.body;

		if (isPublished) {
			const [mld] = await db
				.select()
				.from(mldMaster)
				.where(eq(mldMaster.id, mldId));

			if (!mld) {
				return res.status(404).json({ error: "MLD not found" });
			}

			const missingFields = [];
			if (!mld.isin) missingFields.push("ISIN");
			if (!mld.payoffType) missingFields.push("Payoff Type");
			if (!mld.maturityDate) missingFields.push("Maturity Date");
			if (!mld.underlying) missingFields.push("Underlying Index");

			if (missingFields.length > 0) {
				return res.status(400).json({
					error: `Cannot publish MLD. Missing required fields: ${missingFields.join(", ")}`,
				});
			}
		}

		const [updated] = await db
			.update(mldMaster)
			.set({
				isPublished,
				updatedAt: new Date(),
			})
			.where(eq(mldMaster.id, mldId))
			.returning();

		if (!updated) {
			return res.status(404).json({ error: "MLD not found" });
		}

		res.json({
			success: true,
			mld: updated,
			message: isPublished
				? "MLD published to store"
				: "MLD unpublished from store",
		});
	} catch (error: any) {
		console.error("Error toggling MLD publish status:", error);
		res.status(500).json({ error: "Failed to update publish status" });
	}
});

// POST /admin/mld/:id/publish - Toggle publish status by URL param
router.post("/admin/mld/:id/publish", requireAdmin, async (req, res) => {
	try {
		const mldId = req.params.id;
		const { isPublished = true } = req.body;

		// Validate before publishing
		if (isPublished) {
			const [mld] = await db
				.select()
				.from(mldMaster)
				.where(eq(mldMaster.id, mldId));

			if (!mld) {
				return res.status(404).json({ error: "MLD not found" });
			}

			const missingFields = [];
			if (!mld.isin) missingFields.push("ISIN");
			if (!mld.payoffType) missingFields.push("Payoff Type");
			if (!mld.maturityDate) missingFields.push("Maturity Date");
			if (!mld.underlying) missingFields.push("Underlying Index");

			if (missingFields.length > 0) {
				return res.status(400).json({
					error: `Cannot publish MLD. Missing required fields: ${missingFields.join(", ")}`,
				});
			}
		}

		const [updated] = await db
			.update(mldMaster)
			.set({
				isPublished,
				updatedAt: new Date(),
			})
			.where(eq(mldMaster.id, mldId))
			.returning();

		if (!updated) {
			return res.status(404).json({ error: "MLD not found" });
		}

		res.json({
			success: true,
			mld: updated,
			message: isPublished
				? "MLD published to store"
				: "MLD unpublished from store",
		});
	} catch (error: any) {
		console.error("Error toggling MLD publish status:", error);
		res.status(500).json({ error: "Failed to update publish status" });
	}
});

// POST /admin/mld/publish - Toggle publish status (Seed to Store) - Legacy body-based
router.post("/admin/mld/publish", requireAdmin, async (req, res) => {
	try {
		const { mldId, isPublished } = req.body;

		// Validate before publishing
		if (isPublished) {
			const [mld] = await db
				.select()
				.from(mldMaster)
				.where(eq(mldMaster.id, mldId));

			if (!mld) {
				return res.status(404).json({ error: "MLD not found" });
			}

			// Check mandatory fields
			const missingFields = [];
			if (!mld.isin) missingFields.push("ISIN");
			if (!mld.payoffType) missingFields.push("Payoff Type");
			if (!mld.maturityDate) missingFields.push("Maturity Date");
			if (!mld.underlying) missingFields.push("Underlying Index");

			if (missingFields.length > 0) {
				return res.status(400).json({
					error: `Cannot publish MLD. Missing required fields: ${missingFields.join(", ")}`,
				});
			}
		}

		const [updated] = await db
			.update(mldMaster)
			.set({
				isPublished,
				updatedAt: new Date(),
			})
			.where(eq(mldMaster.id, mldId))
			.returning();

		res.json({
			success: true,
			mld: updated,
			message: isPublished
				? "MLD published to store"
				: "MLD unpublished from store",
		});
	} catch (error: any) {
		console.error("Error toggling MLD publish status:", error);
		res.status(500).json({ error: "Failed to update publish status" });
	}
});

// DELETE /admin/mld/:id - Delete MLD

export default router;
