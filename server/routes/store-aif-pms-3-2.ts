// @ts-nocheck
import { Router } from "express";
import { db } from "../db";
import {
	aifMaster,
	pmsMaster,
	fundManagers,
	fundPerformanceMonthwise,
	fundPerformanceRolling,
	insertAifMasterSchema,
	insertPmsMasterSchema,
	mutualFunds,
	instrumentMaster,
	clientPortfolioAif,
	clientPortfolioPms,
	clientPortfolioMld,
	mldMaster,
	insertClientPortfolioAifSchema,
	insertClientPortfolioPmsSchema,
	users,
	investmentInquiries,
	insertInvestmentInquirySchema,
} from "@shared/schema";
import {
	eq,
	and,
	desc,
	asc,
	ilike,
	sql,
	gte,
	lte,
	or,
	isNotNull,
} from "drizzle-orm";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/roleMiddleware";
import {
	fetchSebiAifListings,
	SebiAifListing,
	generateComprehensiveAifSeedData,
	AifSeedData,
} from "../services/sebi-aif-scraper";
import {
	fetchSebiPmsListings,
	SebiPmsListing,
	generateComprehensivePmsSeedData,
	PmsSeedData,
} from "../services/sebi-pms-scraper";
import {
	externalRemittanceService,
	RemittanceUploadRequest,
	RemittanceDocumentUpload,
} from "../services/external-remittance-service";
import { aiRecommendationSyncService } from "../services/ai-recommendation-sync-service";

const router = Router();

// ============ AIF ROUTES ============

// GET /store/aif - List published AIF schemes with filters
router.post("/aif/seed/import", requireAdmin, async (req, res) => {
	try {
		const { listings, skipDuplicates = true } = req.body as {
			listings?: AifSeedData[];
			skipDuplicates?: boolean;
		};

		// Use provided listings or generate new ones
		const seedData = listings || generateComprehensiveAifSeedData();

		if (seedData.length === 0) {
			return res.status(400).json({
				success: false,
				error: "No AIF seed data available",
			});
		}

		console.log(`[AIF Seed] Starting import of ${seedData.length} AIFs...`);

		// Get existing registration numbers
		const existingAifs = await db
			.select({ registrationNo: aifMaster.registrationNo })
			.from(aifMaster)
			.where(isNotNull(aifMaster.registrationNo));

		const existingRegNoSet = new Set(
			existingAifs
				.map((a) => a.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		const imported: any[] = [];
		const skipped: string[] = [];
		const errors: string[] = [];

		// Process in batches of 50
		const batchSize = 50;
		for (let i = 0; i < seedData.length; i += batchSize) {
			const batch = seedData.slice(i, i + batchSize);
			const toInsert: any[] = [];

			for (const listing of batch) {
				const normalizedRegNo = listing.registrationNo.trim().toUpperCase();

				if (skipDuplicates && existingRegNoSet.has(normalizedRegNo)) {
					skipped.push(listing.registrationNo);
					continue;
				}

				toInsert.push({
					name: listing.name,
					registrationNo: listing.registrationNo,
					category: listing.category,
					subcategory: listing.subcategory,
					fundHouseName: listing.fundHouseName,
					sponsor: listing.sponsor,
					inceptionDate: listing.inceptionDate,
					minInvestment: listing.minInvestment,
					lockIn: listing.lockIn,
					benchmark: listing.benchmark,
					style: listing.style,
					fundStatus: listing.fundStatus,
					aum: listing.aum,
					latestNav: listing.latestNav,
					return1M: listing.return1M,
					return3M: listing.return3M,
					return6M: listing.return6M,
					return1Y: listing.return1Y,
					return3Y: listing.return3Y,
					return5Y: listing.return5Y,
					returnSinceInception: listing.returnSinceInception,
					riskScore: listing.riskScore,
					volatility: listing.volatility,
					maxDrawdown: listing.maxDrawdown,
					sharpeRatio: listing.sharpeRatio,
					liquidityFrequency: listing.liquidityFrequency,
					navFrequency: listing.navFrequency,
					description: listing.description,
					investmentObjective: listing.investmentObjective,
					isPublished: false,
					createdAt: new Date(),
					updatedAt: new Date(),
				});

				existingRegNoSet.add(normalizedRegNo);
			}

			if (toInsert.length > 0) {
				try {
					const insertedBatch = await db
						.insert(aifMaster)
						.values(toInsert)
						.returning();
					imported.push(...insertedBatch);
				} catch (batchError: any) {
					console.error(`[AIF Seed] Batch insert error:`, batchError.message);
					errors.push(
						`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`,
					);
				}
			}
		}

		console.log(
			`[AIF Seed] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`,
		);

		res.json({
			success: true,
			summary: {
				imported: imported.length,
				skipped: skipped.length,
				errors: errors.length,
			},
			imported: imported.slice(0, 10), // Return first 10 for preview
			skipped: skipped.slice(0, 10),
			errors,
		});
	} catch (error: any) {
		console.error("[AIF Seed] Import error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to import AIF seed data",
			details: error.message,
		});
	}
});

// POST /aif/seed/all - One-click seed all AIFs with comprehensive data
router.post("/aif/seed/all", requireAdmin, async (req, res) => {
	try {
		console.log("[AIF Seed All] Starting comprehensive seeding...");

		const seedData = generateComprehensiveAifSeedData();

		// Get existing registration numbers
		const existingAifs = await db
			.select({ registrationNo: aifMaster.registrationNo })
			.from(aifMaster)
			.where(isNotNull(aifMaster.registrationNo));

		const existingRegNoSet = new Set(
			existingAifs
				.map((a) => a.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		// Filter out duplicates
		const newAifs = seedData.filter(
			(listing) =>
				!existingRegNoSet.has(listing.registrationNo.trim().toUpperCase()),
		);

		if (newAifs.length === 0) {
			return res.json({
				success: true,
				message: "All AIFs already exist in database",
				summary: {
					imported: 0,
					skipped: seedData.length,
					total: seedData.length,
				},
			});
		}

		// Batch insert all new AIFs
		const batchSize = 50;
		const imported: any[] = [];
		const errors: string[] = [];

		for (let i = 0; i < newAifs.length; i += batchSize) {
			const batch = newAifs.slice(i, i + batchSize);

			const toInsert = batch.map((listing) => ({
				name: listing.name,
				registrationNo: listing.registrationNo,
				category: listing.category,
				subcategory: listing.subcategory,
				fundHouseName: listing.fundHouseName,
				sponsor: listing.sponsor,
				inceptionDate: listing.inceptionDate,
				minInvestment: listing.minInvestment,
				lockIn: listing.lockIn,
				benchmark: listing.benchmark,
				style: listing.style,
				fundStatus: listing.fundStatus,
				aum: listing.aum,
				latestNav: listing.latestNav,
				return1M: listing.return1M,
				return3M: listing.return3M,
				return6M: listing.return6M,
				return1Y: listing.return1Y,
				return3Y: listing.return3Y,
				return5Y: listing.return5Y,
				returnSinceInception: listing.returnSinceInception,
				riskScore: listing.riskScore,
				volatility: listing.volatility,
				maxDrawdown: listing.maxDrawdown,
				sharpeRatio: listing.sharpeRatio,
				liquidityFrequency: listing.liquidityFrequency,
				navFrequency: listing.navFrequency,
				description: listing.description,
				investmentObjective: listing.investmentObjective,
				isPublished: true, // Auto-publish for seed all
				createdAt: new Date(),
				updatedAt: new Date(),
			}));

			try {
				const insertedBatch = await db
					.insert(aifMaster)
					.values(toInsert)
					.returning();
				imported.push(...insertedBatch);
			} catch (batchError: any) {
				console.error(`[AIF Seed All] Batch error:`, batchError.message);
				errors.push(
					`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`,
				);
			}
		}

		// Group by category for summary
		const byCategory = {
			"Category I": imported.filter((a: any) => a.category === "Category I")
				.length,
			"Category II": imported.filter((a: any) => a.category === "Category II")
				.length,
			"Category III": imported.filter((a: any) => a.category === "Category III")
				.length,
		};

		console.log(
			`[AIF Seed All] Completed: ${imported.length} AIFs seeded and published`,
		);

		// Auto-sync top performers to recommendation products
		let syncResult = null;
		if (imported.length > 0) {
			try {
				console.log("[AIF Seed All] Triggering AI recommendation sync...");
				syncResult = await aiRecommendationSyncService.executeSync(15, 0);
				console.log(
					`[AIF Seed All] Synced ${syncResult.imported} AIFs to recommendations`,
				);
			} catch (syncError: any) {
				console.error(
					"[AIF Seed All] Recommendation sync failed:",
					syncError.message,
				);
			}
		}

		res.json({
			success: true,
			message: `Successfully seeded ${imported.length} AIFs`,
			summary: {
				imported: imported.length,
				skipped: seedData.length - newAifs.length,
				total: seedData.length,
				byCategory,
				errors: errors.length,
				recommendationSync: syncResult
					? {
							synced: syncResult.imported,
							skipped: syncResult.skipped,
						}
					: null,
			},
		});
	} catch (error: any) {
		console.error("[AIF Seed All] Error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to seed AIFs",
			details: error.message,
		});
	}
});

// ============ PMS COMPREHENSIVE SEEDING ============

// GET /pms/seed/preview - Preview comprehensive PMS seed data
router.get("/pms/seed/preview", requireAdmin, async (req, res) => {
	try {
		console.log("[PMS Seed] Generating comprehensive preview...");

		const seedData = generateComprehensivePmsSeedData();

		// Get existing PMS by registration number for duplicate detection
		const existingPms = await db
			.select({ registrationNo: pmsMaster.registrationNo })
			.from(pmsMaster)
			.where(isNotNull(pmsMaster.registrationNo));

		const existingRegNos = new Set(
			existingPms
				.map((p) => p.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		// Mark duplicates
		const listings = seedData.map((listing) => ({
			...listing,
			isDuplicate: existingRegNos.has(
				listing.registrationNo.trim().toUpperCase(),
			),
		}));

		const newCount = listings.filter((l) => !l.isDuplicate).length;
		const duplicateCount = listings.filter((l) => l.isDuplicate).length;

		// Group by strategy for summary
		const strategies = [
			"Large-cap",
			"Multi-cap",
			"Mid-cap",
			"Small-cap",
			"Flexi-cap",
			"Focused",
			"Value",
			"Thematic",
		];
		const byStrategy: Record<string, number> = {};
		for (const strat of strategies) {
			byStrategy[strat] = listings.filter((l) => l.strategy === strat).length;
		}

		console.log(
			`[PMS Seed] Preview: ${listings.length} total, ${newCount} new, ${duplicateCount} duplicates`,
		);

		res.json({
			success: true,
			listings,
			summary: {
				total: listings.length,
				new: newCount,
				duplicates: duplicateCount,
				byStrategy,
			},
		});
	} catch (error: any) {
		console.error("[PMS Seed] Preview error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to preview PMS seed data",
			details: error.message,
		});
	}
});

// POST /pms/seed/import - Import comprehensive PMS seed data
router.post("/pms/seed/import", requireAdmin, async (req, res) => {
	try {
		const { listings, skipDuplicates = true } = req.body as {
			listings?: PmsSeedData[];
			skipDuplicates?: boolean;
		};

		// Use provided listings or generate new ones
		const seedData = listings || generateComprehensivePmsSeedData();

		if (seedData.length === 0) {
			return res.status(400).json({
				success: false,
				error: "No PMS seed data available",
			});
		}

		console.log(`[PMS Seed] Starting import of ${seedData.length} PMS...`);

		// Get existing registration numbers
		const existingPms = await db
			.select({ registrationNo: pmsMaster.registrationNo })
			.from(pmsMaster)
			.where(isNotNull(pmsMaster.registrationNo));

		const existingRegNoSet = new Set(
			existingPms
				.map((p) => p.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		const imported: any[] = [];
		const skipped: string[] = [];
		const errors: string[] = [];

		// Process in batches of 50
		const batchSize = 50;
		for (let i = 0; i < seedData.length; i += batchSize) {
			const batch = seedData.slice(i, i + batchSize);
			const toInsert: any[] = [];

			for (const listing of batch) {
				const normalizedRegNo = listing.registrationNo.trim().toUpperCase();

				if (skipDuplicates && existingRegNoSet.has(normalizedRegNo)) {
					skipped.push(listing.registrationNo);
					continue;
				}

				toInsert.push({
					name: listing.name,
					registrationNo: listing.registrationNo,
					strategy: listing.strategy,
					style: listing.style,
					fundHouseName: listing.fundHouseName,
					sponsor: listing.sponsor,
					inceptionDate: listing.inceptionDate,
					minInvestment: listing.minInvestment,
					lockIn: listing.lockIn,
					benchmark: listing.benchmark,
					feeStructure: listing.feeStructure,
					managementFee: listing.managementFee,
					performanceFee: listing.performanceFee,
					fundStatus: listing.fundStatus,
					aum: listing.aum,
					latestNav: listing.latestNav,
					lastNavDate: listing.lastNavDate,
					return1Y: listing.return1Y,
					return3Y: listing.return3Y,
					returnSinceInception: listing.returnSinceInception,
					riskScore: listing.riskScore,
					description: listing.description,
					isPublished: false,
					createdAt: new Date(),
					updatedAt: new Date(),
				});

				existingRegNoSet.add(normalizedRegNo);
			}

			if (toInsert.length > 0) {
				try {
					const insertedBatch = await db
						.insert(pmsMaster)
						.values(toInsert)
						.returning();
					imported.push(...insertedBatch);
				} catch (batchError: any) {
					console.error(`[PMS Seed] Batch insert error:`, batchError.message);
					errors.push(
						`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`,
					);
				}
			}
		}

		console.log(
			`[PMS Seed] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`,
		);

		res.json({
			success: true,
			summary: {
				imported: imported.length,
				skipped: skipped.length,
				errors: errors.length,
			},
			imported: imported.slice(0, 10),
			skipped: skipped.slice(0, 10),
			errors,
		});
	} catch (error: any) {
		console.error("[PMS Seed] Import error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to import PMS seed data",
			details: error.message,
		});
	}
});

// POST /pms/seed/all - One-click seed all PMS with comprehensive data
router.post("/pms/seed/all", requireAdmin, async (req, res) => {
	try {
		console.log("[PMS Seed All] Starting comprehensive seeding...");

		const seedData = generateComprehensivePmsSeedData();

		// Get existing registration numbers
		const existingPms = await db
			.select({ registrationNo: pmsMaster.registrationNo })
			.from(pmsMaster)
			.where(isNotNull(pmsMaster.registrationNo));

		const existingRegNoSet = new Set(
			existingPms
				.map((p) => p.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		// Filter out duplicates
		const newPms = seedData.filter(
			(listing) =>
				!existingRegNoSet.has(listing.registrationNo.trim().toUpperCase()),
		);

		if (newPms.length === 0) {
			return res.json({
				success: true,
				message: "All PMS already exist in database",
				summary: {
					imported: 0,
					skipped: seedData.length,
					total: seedData.length,
				},
			});
		}

		// Batch insert all new PMS
		const batchSize = 50;
		const imported: any[] = [];
		const errors: string[] = [];

		for (let i = 0; i < newPms.length; i += batchSize) {
			const batch = newPms.slice(i, i + batchSize);

			const toInsert = batch.map((listing) => ({
				name: listing.name,
				registrationNo: listing.registrationNo,
				strategy: listing.strategy,
				style: listing.style,
				fundHouseName: listing.fundHouseName,
				sponsor: listing.sponsor,
				inceptionDate: listing.inceptionDate,
				minInvestment: listing.minInvestment,
				lockIn: listing.lockIn,
				benchmark: listing.benchmark,
				feeStructure: listing.feeStructure,
				managementFee: listing.managementFee,
				performanceFee: listing.performanceFee,
				fundStatus: listing.fundStatus,
				aum: listing.aum,
				latestNav: listing.latestNav,
				lastNavDate: listing.lastNavDate,
				return1Y: listing.return1Y,
				return3Y: listing.return3Y,
				returnSinceInception: listing.returnSinceInception,
				riskScore: listing.riskScore,
				description: listing.description,
				isPublished: true, // Auto-publish for seed all
				createdAt: new Date(),
				updatedAt: new Date(),
			}));

			try {
				const insertedBatch = await db
					.insert(pmsMaster)
					.values(toInsert)
					.returning();
				imported.push(...insertedBatch);
			} catch (batchError: any) {
				console.error(`[PMS Seed All] Batch error:`, batchError.message);
				errors.push(
					`Batch ${Math.floor(i / batchSize) + 1}: ${batchError.message}`,
				);
			}
		}

		// Group by strategy for summary
		const strategies = [
			"Large-cap",
			"Multi-cap",
			"Mid-cap",
			"Small-cap",
			"Flexi-cap",
			"Focused",
			"Value",
			"Thematic",
		];
		const byStrategy: Record<string, number> = {};
		for (const strat of strategies) {
			byStrategy[strat] = imported.filter(
				(p: any) => p.strategy === strat,
			).length;
		}

		console.log(
			`[PMS Seed All] Completed: ${imported.length} PMS seeded and published`,
		);

		// Auto-sync top performers to recommendation products
		let syncResult = null;
		if (imported.length > 0) {
			try {
				console.log("[PMS Seed All] Triggering AI recommendation sync...");
				syncResult = await aiRecommendationSyncService.executeSync(0, 15);
				console.log(
					`[PMS Seed All] Synced ${syncResult.imported} PMS to recommendations`,
				);
			} catch (syncError: any) {
				console.error(
					"[PMS Seed All] Recommendation sync failed:",
					syncError.message,
				);
			}
		}

		res.json({
			success: true,
			message: `Successfully seeded ${imported.length} PMS`,
			summary: {
				imported: imported.length,
				skipped: seedData.length - newPms.length,
				total: seedData.length,
				byStrategy,
				errors: errors.length,
				recommendationSync: syncResult
					? {
							synced: syncResult.imported,
							skipped: syncResult.skipped,
						}
					: null,
			},
		});
	} catch (error: any) {
		console.error("[PMS Seed All] Error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to seed PMS",
			details: error.message,
		});
	}
});

// ============ PMS SEEDING (IMPORT FROM SEBI) ============

// GET /pms/sebi/preview - Preview SEBI PMS with duplicate detection
router.get("/pms/sebi/preview", requireAdmin, async (req, res) => {
	try {
		console.log("[SEBI PMS Import] Fetching preview...");

		const result = await fetchSebiPmsListings();

		if (!result.success) {
			return res.status(500).json({
				success: false,
				error: "Failed to fetch SEBI PMS listings",
				details: result.errors,
			});
		}

		// Get existing PMS by registration number for duplicate detection
		const existingPms = await db
			.select({ registrationNo: pmsMaster.registrationNo })
			.from(pmsMaster)
			.where(isNotNull(pmsMaster.registrationNo));

		const existingRegNos = new Set(
			existingPms
				.map((p) => p.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		// Mark duplicates
		const listings = result.listings.map((listing) => ({
			...listing,
			isDuplicate: existingRegNos.has(
				listing.registrationNo.trim().toUpperCase(),
			),
		}));

		const newCount = listings.filter((l) => !l.isDuplicate).length;
		const duplicateCount = listings.filter((l) => l.isDuplicate).length;

		console.log(
			`[SEBI PMS Import] Preview: ${listings.length} total, ${newCount} new, ${duplicateCount} duplicates`,
		);

		res.json({
			success: true,
			listings,
			summary: {
				total: listings.length,
				new: newCount,
				duplicates: duplicateCount,
			},
		});
	} catch (error: any) {
		console.error("[SEBI PMS Import] Preview error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to preview SEBI PMS",
			details: error.message,
		});
	}
});

// POST /pms/sebi/import - Import selected PMS from SEBI
router.post("/pms/sebi/import", requireAdmin, async (req, res) => {
	try {
		const { listings } = req.body as { listings: SebiPmsListing[] };

		if (!listings || !Array.isArray(listings) || listings.length === 0) {
			return res.status(400).json({
				success: false,
				error: "No listings provided for import",
			});
		}

		console.log(
			`[SEBI PMS Import] Starting import of ${listings.length} PMS...`,
		);

		// Get existing registration numbers
		const existingPms = await db
			.select({ registrationNo: pmsMaster.registrationNo })
			.from(pmsMaster)
			.where(isNotNull(pmsMaster.registrationNo));

		const existingRegNoSet = new Set(
			existingPms
				.map((p) => p.registrationNo?.trim().toUpperCase())
				.filter(Boolean),
		);

		const imported: any[] = [];
		const skipped: string[] = [];
		const errors: string[] = [];

		for (const listing of listings) {
			const normalizedRegNo = listing.registrationNo.trim().toUpperCase();

			// Skip if already exists
			if (existingRegNoSet.has(normalizedRegNo)) {
				skipped.push(listing.registrationNo);
				continue;
			}

			try {
				const [newPms] = await db
					.insert(pmsMaster)
					.values({
						name: listing.name,
						registrationNo: listing.registrationNo,
						strategy: listing.strategy,
						style: listing.style,
						fundHouseName: listing.fundHouseName,
						sponsor: listing.sponsor,
						inceptionDate: listing.inceptionDate,
						minInvestment: "5000000", // ₹50L default for PMS
						fundStatus: "active",
						isPublished: false, // Requires admin review
						createdAt: new Date(),
						updatedAt: new Date(),
					})
					.returning();

				imported.push(newPms);
				existingRegNoSet.add(normalizedRegNo);
			} catch (itemError: any) {
				console.error(
					`[SEBI PMS Import] Error importing ${listing.registrationNo}:`,
					itemError.message,
				);
				errors.push(`${listing.registrationNo}: ${itemError.message}`);
			}
		}

		console.log(
			`[SEBI PMS Import] Completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`,
		);

		res.json({
			success: true,
			summary: {
				imported: imported.length,
				skipped: skipped.length,
				errors: errors.length,
			},
			imported,
			skipped,
			errors,
		});
	} catch (error: any) {
		console.error("[SEBI PMS Import] Import error:", error);
		res.status(500).json({
			success: false,
			error: "Failed to import SEBI PMS",
			details: error.message,
		});
	}
});

// ============ INVESTMENT INQUIRIES ============

const expressInterestSchema = z.object({
	productType: z.enum(["aif", "pms"]),
	productId: z.string().min(1),
	productName: z.string().min(1),
	name: z.string().min(2, "Name is required"),
	email: z.string().email("Valid email is required"),
	phone: z.string().optional(),
	panNumber: z.string().optional(),
	investmentAmount: z.string().optional(),
	investmentTimeline: z
		.enum(["immediate", "within_1_month", "within_3_months", "exploring"])
		.optional(),
	message: z.string().optional(),
});

// POST /aif/:id/express-interest - Express interest in an AIF

export default router;
