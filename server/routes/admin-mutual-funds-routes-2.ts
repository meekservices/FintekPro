import { Router, Request, Response } from "express";
import { db } from "../db";
import {
	storeProducts,
	storeCategories,
	advisorySubscriptions,
	mutualFunds,
	mutualFundAmcs,
} from "@shared/schema";
import { eq, and, or, like, desc, asc, sql, ilike } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const seedMutualFundSchema = z.object({
	schemeName: z.string().min(1),
	schemeCode: z.string().min(1),
	categoryId: z.string().min(1),
	fundHouse: z.string().min(1),
	planType: z.enum(["direct", "regular"]),
	nav: z.number().optional(),
	expenseRatio: z.number().optional(),
	trailCommission: z.number().optional(),
	exitLoad: z.number().optional(),
	exitLoadPeriod: z.number().optional(),
	minimumInvestment: z.number().optional(),
	lockInPeriod: z.number().optional(),
	riskLevel: z.enum(["low", "medium", "high"]).optional(),
	returns1y: z.number().optional(),
	returns3y: z.number().optional(),
	returns5y: z.number().optional(),
	amfiCode: z.string().optional(),
	isinCode: z.string().optional(),
	shortDescription: z.string().optional(),
	fullDescription: z.string().optional(),
	features: z.array(z.string()).optional(),
	isActive: z.boolean().default(true),
	isFeatured: z.boolean().default(false),
});

const updateCategoryToggleSchema = z.object({
	isEnabled: z.boolean().optional(),
	directFundsEnabled: z.boolean().optional(),
	comingSoonMessage: z.string().optional(),
	comingSoonExpectedDate: z.string().optional(),
});

router.get("/check-advisory/:userId", async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;

		const activeSubscription = await db
			.select()
			.from(advisorySubscriptions)
			.where(
				and(
					eq(advisorySubscriptions.userId, userId),
					eq(advisorySubscriptions.status, "active"),
				),
			)
			.limit(1);

		const hasAdvisory = activeSubscription.length > 0;
		const subscription = hasAdvisory ? activeSubscription[0] : null;

		res.json({
			success: true,
			hasAdvisorySubscription: hasAdvisory,
			subscription,
			directFundsAccess: hasAdvisory && subscription?.directFundsAccess,
		});
	} catch (error: any) {
		console.error("[Admin MF] Error checking advisory subscription:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// =============================================
// AMC (Asset Management Company) Level Controls
// =============================================

// Get all AMCs with scheme counts
router.get("/amcs", async (req: Request, res: Response) => {
	try {
		const { search } = req.query;

		// Get AMCs with their scheme counts
		const amcs = await db
			.select()
			.from(mutualFundAmcs)
			.orderBy(desc(mutualFundAmcs.totalSchemes));

		// If search provided, filter
		let filteredAmcs = amcs;
		if (search) {
			const searchLower = (search as string).toLowerCase();
			filteredAmcs = amcs.filter(
				(amc) =>
					amc.name?.toLowerCase().includes(searchLower) ||
					amc.displayName?.toLowerCase().includes(searchLower),
			);
		}

		// Get actual counts from mutual_funds table for each AMC
		const amcsWithCounts = await Promise.all(
			filteredAmcs.map(async (amc) => {
				const totalResult = await db
					.select({ count: sql<number>`count(*)` })
					.from(mutualFunds)
					.where(eq(mutualFunds.fundHouse, amc.name));

				const publishedResult = await db
					.select({ count: sql<number>`count(*)` })
					.from(mutualFunds)
					.where(
						and(
							eq(mutualFunds.fundHouse, amc.name),
							eq(mutualFunds.isPublished, true),
							eq(mutualFunds.planType, "regular"),
						),
					);

				return {
					...amc,
					totalSchemes: Number(totalResult[0]?.count || 0),
					publishedRegularSchemes: Number(publishedResult[0]?.count || 0),
				};
			}),
		);

		res.json({ success: true, amcs: amcsWithCounts });
	} catch (error: any) {
		console.error("[Admin MF] Error fetching AMCs:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// Toggle AMC regular plans (bulk publish/unpublish)
router.put("/amcs/:id/toggle", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { regularPlansEnabled, adminId } = req.body;

		// Get AMC info
		const [amc] = await db
			.select()
			.from(mutualFundAmcs)
			.where(eq(mutualFundAmcs.id, id));
		if (!amc) {
			return res.status(404).json({ success: false, error: "AMC not found" });
		}

		// Update all Regular schemes from this AMC
		const publishedAt = regularPlansEnabled ? new Date() : null;

		await db
			.update(mutualFunds)
			.set({
				isPublished: regularPlansEnabled,
				publishedAt: publishedAt,
				publishedBy: regularPlansEnabled ? adminId : null,
			})
			.where(
				and(
					eq(mutualFunds.fundHouse, amc.name),
					eq(mutualFunds.planType, "regular"),
				),
			);

		// Update AMC toggle status
		const [updatedAmc] = await db
			.update(mutualFundAmcs)
			.set({
				regularPlansEnabled,
				lastToggledAt: new Date(),
				lastToggledBy: adminId,
				updatedAt: new Date(),
			})
			.where(eq(mutualFundAmcs.id, id))
			.returning();

		// Get updated count
		const publishedResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(mutualFunds)
			.where(
				and(
					eq(mutualFunds.fundHouse, amc.name),
					eq(mutualFunds.isPublished, true),
					eq(mutualFunds.planType, "regular"),
				),
			);

		console.log(
			`[Admin MF] AMC ${amc.name} Regular plans ${regularPlansEnabled ? "ENABLED" : "DISABLED"} by ${adminId}`,
		);

		res.json({
			success: true,
			amc: {
				...updatedAmc,
				publishedRegularSchemes: Number(publishedResult[0]?.count || 0),
			},
			message: `${regularPlansEnabled ? "Published" : "Unpublished"} all Regular schemes for ${amc.name}`,
		});
	} catch (error: any) {
		console.error("[Admin MF] Error toggling AMC:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// Batch toggle AMCs (bulk enable/disable multiple AMCs)
router.put("/amcs/batch-toggle", async (req: Request, res: Response) => {
	try {
		const { amcIds, regularPlansEnabled, adminId } = req.body;

		if (!amcIds || !Array.isArray(amcIds) || amcIds.length === 0) {
			return res
				.status(400)
				.json({ success: false, error: "amcIds array is required" });
		}

		const publishedAt = regularPlansEnabled ? new Date() : null;
		let updatedCount = 0;
		const updatedAmcNames: string[] = [];

		// Process each AMC
		for (const amcId of amcIds) {
			const [amc] = await db
				.select()
				.from(mutualFundAmcs)
				.where(eq(mutualFundAmcs.id, amcId));
			if (!amc) continue;

			// Update all Regular schemes from this AMC
			await db
				.update(mutualFunds)
				.set({
					isPublished: regularPlansEnabled,
					publishedAt: publishedAt,
					publishedBy: regularPlansEnabled ? adminId : null,
				})
				.where(
					and(
						eq(mutualFunds.fundHouse, amc.name),
						eq(mutualFunds.planType, "regular"),
					),
				);

			// Update AMC toggle status
			await db
				.update(mutualFundAmcs)
				.set({
					regularPlansEnabled,
					lastToggledAt: new Date(),
					lastToggledBy: adminId,
					updatedAt: new Date(),
				})
				.where(eq(mutualFundAmcs.id, amcId));

			updatedCount++;
			updatedAmcNames.push(amc.name);
		}

		console.log(
			`[Admin MF] Batch ${regularPlansEnabled ? "ENABLED" : "DISABLED"} ${updatedCount} AMCs by ${adminId}: ${updatedAmcNames.join(", ")}`,
		);

		res.json({
			success: true,
			updatedCount,
			message: `${regularPlansEnabled ? "Enabled" : "Disabled"} ${updatedCount} AMC(s) successfully`,
		});
	} catch (error: any) {
		console.error("[Admin MF] Error batch toggling AMCs:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// Get schemes for a specific AMC (Regular plans only)
router.get("/amcs/:id/schemes", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { search, published, page = "1", limit = "50" } = req.query;

		const pageNum = Number.parseInt(page as string);
		const limitNum = Number.parseInt(limit as string);
		const offset = (pageNum - 1) * limitNum;

		// Get AMC info
		const [amc] = await db
			.select()
			.from(mutualFundAmcs)
			.where(eq(mutualFundAmcs.id, id));
		if (!amc) {
			return res.status(404).json({ success: false, error: "AMC not found" });
		}

		// Build conditions
		const conditions: any[] = [
			eq(mutualFunds.fundHouse, amc.name),
			eq(mutualFunds.planType, "regular"),
		];

		if (published === "true") {
			conditions.push(eq(mutualFunds.isPublished, true));
		} else if (published === "false") {
			conditions.push(eq(mutualFunds.isPublished, false));
		}

		if (search) {
			conditions.push(
				or(
					ilike(mutualFunds.schemeName, `%${search}%`),
					ilike(mutualFunds.schemeCode, `%${search}%`),
					ilike(mutualFunds.category, `%${search}%`),
				),
			);
		}

		const schemes = await db
			.select()
			.from(mutualFunds)
			.where(and(...conditions))
			.orderBy(asc(mutualFunds.schemeName))
			.limit(limitNum)
			.offset(offset);

		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(mutualFunds)
			.where(and(...conditions));

		res.json({
			success: true,
			amc,
			schemes,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total: Number(countResult[0]?.count || 0),
				totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
			},
		});
	} catch (error: any) {
		console.error("[Admin MF] Error fetching AMC schemes:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// Get all Regular schemes with filters (for scheme-level table)
router.get("/regular-schemes", async (req: Request, res: Response) => {
	try {
		const {
			amcId,
			search,
			published,
			category,
			page = "1",
			limit = "50",
		} = req.query;

		const pageNum = Number.parseInt(page as string);
		const limitNum = Number.parseInt(limit as string);
		const offset = (pageNum - 1) * limitNum;

		// Base condition: Regular plans only
		const conditions: any[] = [eq(mutualFunds.planType, "regular")];

		// Filter by AMC
		if (amcId) {
			const [amc] = await db
				.select()
				.from(mutualFundAmcs)
				.where(eq(mutualFundAmcs.id, amcId as string));
			if (amc) {
				conditions.push(eq(mutualFunds.fundHouse, amc.name));
			}
		}

		// Filter by published status
		if (published === "true") {
			conditions.push(eq(mutualFunds.isPublished, true));
		} else if (published === "false") {
			conditions.push(eq(mutualFunds.isPublished, false));
		}

		// Filter by category
		if (category) {
			conditions.push(ilike(mutualFunds.category, `%${category}%`));
		}

		// Search
		if (search) {
			conditions.push(
				or(
					ilike(mutualFunds.schemeName, `%${search}%`),
					ilike(mutualFunds.schemeCode, `%${search}%`),
					ilike(mutualFunds.fundHouse, `%${search}%`),
				),
			);
		}

		const schemes = await db
			.select()
			.from(mutualFunds)
			.where(and(...conditions))
			.orderBy(asc(mutualFunds.schemeName))
			.limit(limitNum)
			.offset(offset);

		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(mutualFunds)
			.where(and(...conditions));

		res.json({
			success: true,
			schemes,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total: Number(countResult[0]?.count || 0),
				totalPages: Math.ceil(Number(countResult[0]?.count || 0) / limitNum),
			},
		});
	} catch (error: any) {
		console.error("[Admin MF] Error fetching regular schemes:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// Publish/Unpublish individual scheme
router.put(
	"/schemes/:schemeCode/publish",
	async (req: Request, res: Response) => {
		try {
			const { schemeCode } = req.params;
			const { isPublished, adminId } = req.body;

			// Get scheme info
			const [scheme] = await db
				.select()
				.from(mutualFunds)
				.where(eq(mutualFunds.schemeCode, schemeCode));

			if (!scheme) {
				return res
					.status(404)
					.json({ success: false, error: "Scheme not found" });
			}

			// Check if AMC toggle is ON (required for individual publish)
			if (isPublished && scheme.fundHouse) {
				const [amc] = await db
					.select()
					.from(mutualFundAmcs)
					.where(eq(mutualFundAmcs.name, scheme.fundHouse));

				if (amc && !amc.regularPlansEnabled) {
					return res.status(400).json({
						success: false,
						error:
							"Cannot publish scheme when AMC toggle is OFF. Enable the AMC first.",
					});
				}
			}

			// Update scheme
			const [updated] = await db
				.update(mutualFunds)
				.set({
					isPublished,
					publishedAt: isPublished ? new Date() : null,
					publishedBy: isPublished ? adminId : null,
				})
				.where(eq(mutualFunds.schemeCode, schemeCode))
				.returning();

			console.log(
				`[Admin MF] Scheme ${schemeCode} ${isPublished ? "PUBLISHED" : "UNPUBLISHED"} by ${adminId}`,
			);

			res.json({
				success: true,
				scheme: updated,
				message: `Scheme ${isPublished ? "published" : "unpublished"} successfully`,
			});
		} catch (error: any) {
			console.error("[Admin MF] Error updating scheme publish status:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// Check for missing AMCs (not yet synced to mutual_fund_amcs)
router.get("/amcs/missing", async (req: Request, res: Response) => {
	try {
		// Get all distinct fund houses from mutual_funds
		const fundHousesInMutualFunds = await db
			.select({
				fundHouse: mutualFunds.fundHouse,
				schemeCount: sql<number>`count(*)`,
			})
			.from(mutualFunds)
			.where(sql`fund_house IS NOT NULL AND fund_house != ''`)
			.groupBy(mutualFunds.fundHouse);

		// Get all AMCs already in mutual_fund_amcs
		const existingAmcs = await db
			.select({ name: mutualFundAmcs.name })
			.from(mutualFundAmcs);
		const existingAmcNames = new Set(existingAmcs.map((a) => a.name));

		// Find missing AMCs
		const missingAmcs = fundHousesInMutualFunds.filter(
			(fh) => fh.fundHouse && !existingAmcNames.has(fh.fundHouse),
		);

		res.json({
			success: true,
			missingCount: missingAmcs.length,
			missingAmcs: missingAmcs.map((a) => ({
				name: a.fundHouse,
				schemeCount: Number(a.schemeCount),
			})),
			totalInDatabase: fundHousesInMutualFunds.length,
			totalSynced: existingAmcs.length,
		});
	} catch (error: any) {
		console.error("[Admin MF] Error checking missing AMCs:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// Sync AMC list from mutual_funds table (admin utility)
router.post("/amcs/sync", async (req: Request, res: Response) => {
	try {
		// Get distinct fund houses from mutual_funds
		const fundHouses = await db
			.select({
				fundHouse: mutualFunds.fundHouse,
				count: sql<number>`count(*)`,
			})
			.from(mutualFunds)
			.where(sql`fund_house IS NOT NULL AND fund_house != ''`)
			.groupBy(mutualFunds.fundHouse);

		let created = 0;
		let updated = 0;
		const newAmcs: string[] = [];

		for (const fh of fundHouses) {
			if (!fh.fundHouse) continue;

			const existing = await db
				.select()
				.from(mutualFundAmcs)
				.where(eq(mutualFundAmcs.name, fh.fundHouse));

			if (existing.length === 0) {
				await db.insert(mutualFundAmcs).values({
					name: fh.fundHouse,
					displayName: fh.fundHouse,
					totalSchemes: Number(fh.count),
				});
				created++;
				newAmcs.push(fh.fundHouse);
			} else {
				await db
					.update(mutualFundAmcs)
					.set({ totalSchemes: Number(fh.count), updatedAt: new Date() })
					.where(eq(mutualFundAmcs.name, fh.fundHouse));
				updated++;
			}
		}

		console.log(
			`[Admin MF] AMC Sync complete: ${created} created, ${updated} updated`,
		);
		if (newAmcs.length > 0) {
			console.log(`[Admin MF] New AMCs added: ${newAmcs.join(", ")}`);
		}

		res.json({
			success: true,
			message: `Synced AMCs: ${created} new, ${updated} updated`,
			total: fundHouses.length,
			created,
			updated,
			newAmcs,
		});
	} catch (error: any) {
		console.error("[Admin MF] Error syncing AMCs:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// AMFI Data Import Endpoints
router.post("/amfi-import", async (req: Request, res: Response) => {
	try {
		const { amfiImportService } = await import(
			"../services/amfi-import-service"
		);

		const currentProgress = amfiImportService.getImportProgress();
		if (
			currentProgress.status === "fetching" ||
			currentProgress.status === "parsing" ||
			currentProgress.status === "importing"
		) {
			return res.status(409).json({
				success: false,
				error: "Import already in progress",
				progress: currentProgress,
			});
		}

		res.json({
			success: true,
			message: "AMFI import started",
		});

		amfiImportService
			.importAmfiData()
			.then((result) => {
				console.log("[Admin MF] AMFI Import completed:", result);
			})
			.catch((error) => {
				console.error("[Admin MF] AMFI Import failed:", error);
			});
	} catch (error: any) {
		console.error("[Admin MF] Error starting AMFI import:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/amfi-import/progress", async (req: Request, res: Response) => {
	try {
		const { amfiImportService } = await import(
			"../services/amfi-import-service"
		);
		const progress = amfiImportService.getImportProgress();
		res.json({ success: true, progress });
	} catch (error: any) {
		console.error("[Admin MF] Error getting import progress:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

// ============ MF Sync Scheduler Endpoints ============

router.get("/sync/status", async (req: Request, res: Response) => {
	try {
		const { mfSyncScheduler } = await import("../services/mf-sync-scheduler");
		const status = await mfSyncScheduler.getStatus();
		res.json({ success: true, ...status });
	} catch (error: any) {
		console.error("[Admin MF] Error getting sync status:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/sync/trigger", async (req: Request, res: Response) => {
	try {
		const { mfSyncScheduler } = await import("../services/mf-sync-scheduler");

		res.json({
			success: true,
			message: "AMFI sync started in background",
		});

		mfSyncScheduler
			.triggerManualSync()
			.then((result) => {
				console.log("[Admin MF] Manual sync completed:", result);
			})
			.catch((error) => {
				console.error("[Admin MF] Manual sync failed:", error);
			});
	} catch (error: any) {
		console.error("[Admin MF] Error triggering sync:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/sync/start", async (req: Request, res: Response) => {
	try {
		const { mfSyncScheduler } = await import("../services/mf-sync-scheduler");
		mfSyncScheduler.start();
		res.json({ success: true, message: "MF Sync scheduler started" });
	} catch (error: any) {
		console.error("[Admin MF] Error starting scheduler:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/sync/stop", async (req: Request, res: Response) => {
	try {
		const { mfSyncScheduler } = await import("../services/mf-sync-scheduler");
		mfSyncScheduler.stop();
		res.json({ success: true, message: "MF Sync scheduler stopped" });
	} catch (error: any) {
		console.error("[Admin MF] Error stopping scheduler:", error);
		res.status(500).json({ success: false, error: error.message });
	}
});

export default router;
