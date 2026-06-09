// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { requireAdmin } from "../middleware/roleMiddleware";
import { db } from "../db";
import {
	bondFeeProfiles,
	bondFeeOverrides,
	bondCatalog,
	governmentSecurities,
	corporateBonds,
	bondMarketplaceAuditLogs,
} from "@shared/schema";
import {
	bondFeeCalibrationService,
	REGULATORY_FEE_CAPS,
	type InstrumentType,
} from "../services/bond-fee-calibration-service";
import { bondCatalogService } from "../bond-catalog-service";
import { eq, and, desc, sql, or, ilike, count } from "drizzle-orm";

const router = Router();

// Admin authentication middleware

// Apply admin auth to all routes
router.use(requireAdmin);

// ============================================
// FEE PROFILES API
// ============================================

// Get all fee profiles with regulatory caps
router.get("/isin-search", async (req: Request, res: Response) => {
	try {
		const { prefix, limit } = req.query;

		if (!prefix || (prefix as string).length < 4) {
			return res
				.status(400)
				.json({ error: "ISIN prefix must be at least 4 characters" });
		}

		const { nsdlISINService } = await import("../services/nsdl-isin-service");
		const results = await nsdlISINService.searchByISIN(
			prefix as string,
			Number.parseInt(limit as string) || 20,
		);

		res.json({ results, count: results.length });
	} catch (error: any) {
		console.error("Error searching ISINs:", error);
		res.status(500).json({ error: error.message });
	}
});

// Seed bond from ISIN - auto-fetches details from NSDL
router.post("/seed-from-isin", async (req: Request, res: Response) => {
	try {
		const { isin, overrides = {}, publish = false } = req.body;

		if (!isin || isin.length < 12) {
			return res
				.status(400)
				.json({ error: "Valid ISIN required (12 characters)" });
		}

		const userId = (req as any).user?.id;
		const userEmail = (req as any).user?.email;

		// Check if already exists
		const existing = await db
			.select()
			.from(bondCatalog)
			.where(eq(bondCatalog.isin, isin.toUpperCase()))
			.limit(1);

		if (existing.length > 0) {
			return res.status(409).json({
				error: "Bond with this ISIN already exists in catalog",
				existingEntry: existing[0],
			});
		}

		// Lookup from NSDL
		const { nsdlISINService } = await import("../services/nsdl-isin-service");
		const bondData = await nsdlISINService.lookupByISIN(isin);

		if (!bondData) {
			return res.status(404).json({ error: "ISIN not found in NSDL database" });
		}

		const instrumentType =
			overrides.instrumentType ||
			nsdlISINService.determineInstrumentType(
				bondData.securityDescription,
				bondData.issuerName,
			);

		const maturityDate = nsdlISINService.parseMaturityDate(
			bondData.maturityDate,
		);

		// Parse coupon rate from interest rate string
		let couponRate: string | null = null;
		if (bondData.interestRate) {
			const rateMatch = bondData.interestRate.match(/(\d+\.?\d*)/);
			if (rateMatch) {
				couponRate = rateMatch[1];
			}
		}

		// Determine if government or corporate
		const isGovernment = ["gsec", "tbill", "sdl", "sgb"].includes(
			instrumentType,
		);

		// Create catalog entry
		const [newEntry] = await db
			.insert(bondCatalog)
			.values({
				source: "nsdl_isin",
				sourceId: bondData.isin,
				isin: bondData.isin.toUpperCase(),
				bondName: overrides.bondName || bondData.securityDescription,
				issuerName: overrides.issuerName || bondData.issuerName,
				instrumentType: instrumentType as any,
				isListed: overrides.isListed ?? true,
				exchange: overrides.exchange || null,
				faceValue: overrides.faceValue || "1000",
				couponRate: overrides.couponRate || couponRate,
				couponFrequency:
					overrides.couponFrequency ||
					(isGovernment ? "semi_annual" : "annual"),
				maturityDate: maturityDate
					? maturityDate.toISOString().split("T")[0]
					: overrides.maturityDate,
				cleanPrice: overrides.cleanPrice || null,
				yieldToMaturity: overrides.yieldToMaturity || null,
				creditRating:
					overrides.creditRating || (isGovernment ? "Sovereign" : null),
				ratingAgency:
					overrides.ratingAgency || (isGovernment ? "Government" : null),
				minInvestment:
					overrides.minInvestment || (isGovernment ? "10000" : "100000"),
				lotSize: overrides.lotSize || 1,
				taxCategory: isGovernment ? "government" : "corporate",
				tdsApplicable: !isGovernment,
				tdsRate: isGovernment ? null : "10",
				status: publish ? "published" : "draft",
				kycTierRequired: overrides.kycTierRequired || "enhanced",
				publishedAt: publish ? new Date() : null,
			})
			.returning();

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail,
			userRole: "admin",
			action: "seed_from_isin",
			entityType: "bond_catalog",
			entityId: newEntry.id,
			afterValue: { isin, instrumentType, bondName: newEntry.bondName },
			changeDescription: `Seeded bond from ISIN: ${isin} - ${newEntry.bondName}`,
			complianceRelated: true,
			riskLevel: "low",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({
			success: true,
			bond: newEntry,
			message: `Bond seeded successfully from ISIN: ${isin}`,
		});
	} catch (error: any) {
		console.error("Error seeding bond from ISIN:", error);
		res.status(500).json({ error: error.message });
	}
});

// Bulk seed bonds from multiple ISINs
router.post("/bulk-seed-from-isin", async (req: Request, res: Response) => {
	try {
		const { isins, publish = false } = req.body;

		if (!Array.isArray(isins) || isins.length === 0) {
			return res.status(400).json({ error: "Array of ISINs required" });
		}

		if (isins.length > 50) {
			return res.status(400).json({ error: "Maximum 50 ISINs per request" });
		}

		const userId = (req as any).user?.id;
		const userEmail = (req as any).user?.email;
		const { nsdlISINService } = await import("../services/nsdl-isin-service");

		const results = {
			success: [] as any[],
			failed: [] as { isin: string; error: string }[],
			skipped: [] as { isin: string; reason: string }[],
		};

		for (const isin of isins) {
			try {
				// Check if already exists
				const existing = await db
					.select()
					.from(bondCatalog)
					.where(eq(bondCatalog.isin, isin.toUpperCase()))
					.limit(1);

				if (existing.length > 0) {
					results.skipped.push({ isin, reason: "Already exists in catalog" });
					continue;
				}

				// Lookup from NSDL
				const bondData = await nsdlISINService.lookupByISIN(isin);

				if (!bondData) {
					results.failed.push({ isin, error: "Not found in NSDL database" });
					continue;
				}

				const instrumentType = nsdlISINService.determineInstrumentType(
					bondData.securityDescription,
					bondData.issuerName,
				);

				const maturityDate = nsdlISINService.parseMaturityDate(
					bondData.maturityDate,
				);

				let couponRate: string | null = null;
				if (bondData.interestRate) {
					const rateMatch = bondData.interestRate.match(/(\d+\.?\d*)/);
					if (rateMatch) {
						couponRate = rateMatch[1];
					}
				}

				const isGovernment = ["gsec", "tbill", "sdl", "sgb"].includes(
					instrumentType,
				);

				const [newEntry] = await db
					.insert(bondCatalog)
					.values({
						source: "nsdl_isin",
						sourceId: bondData.isin,
						isin: bondData.isin.toUpperCase(),
						bondName: bondData.securityDescription,
						issuerName: bondData.issuerName,
						instrumentType: instrumentType as any,
						isListed: true,
						faceValue: "1000",
						couponRate,
						couponFrequency: isGovernment ? "semi_annual" : "annual",
						maturityDate: maturityDate
							? maturityDate.toISOString().split("T")[0]
							: null,
						creditRating: isGovernment ? "Sovereign" : null,
						ratingAgency: isGovernment ? "Government" : null,
						minInvestment: isGovernment ? "10000" : "100000",
						lotSize: 1,
						taxCategory: isGovernment ? "government" : "corporate",
						tdsApplicable: !isGovernment,
						tdsRate: isGovernment ? null : "10",
						status: publish ? "published" : "draft",
						kycTierRequired: "enhanced",
						publishedAt: publish ? new Date() : null,
					})
					.returning();

				results.success.push(newEntry);
			} catch (err: any) {
				results.failed.push({ isin, error: err.message });
			}
		}

		// Audit log for bulk operation
		if (results.success.length > 0) {
			await db.insert(bondMarketplaceAuditLogs).values({
				userId,
				userEmail,
				userRole: "admin",
				action: "bulk_seed_from_isin",
				entityType: "bond_catalog",
				entityId: "bulk",
				afterValue: {
					totalRequested: isins.length,
					succeeded: results.success.length,
					failed: results.failed.length,
					skipped: results.skipped.length,
				},
				changeDescription: `Bulk seeded ${results.success.length} bonds from ISINs`,
				complianceRelated: true,
				riskLevel: "medium",
				ipAddress: req.ip,
				retentionExpiresAt: new Date(
					Date.now() + 7 * 365 * 24 * 60 * 60 * 1000,
				),
			});
		}

		res.json({
			success: true,
			summary: {
				total: isins.length,
				succeeded: results.success.length,
				failed: results.failed.length,
				skipped: results.skipped.length,
			},
			results,
		});
	} catch (error: any) {
		console.error("Error bulk seeding bonds from ISINs:", error);
		res.status(500).json({ error: error.message });
	}
});

// Refresh NSDL ISIN cache
router.post("/refresh-isin-cache", async (req: Request, res: Response) => {
	try {
		const { nsdlISINService } = await import("../services/nsdl-isin-service");
		const result = await nsdlISINService.refreshCache();

		res.json({
			success: true,
			recordCount: result.recordCount,
			refreshedAt: result.timestamp,
		});
	} catch (error: any) {
		console.error("Error refreshing ISIN cache:", error);
		res.status(500).json({ error: error.message });
	}
});

// Helper functions
function determineGSecType(gsec: any): InstrumentType {
	const secType = gsec.securityType?.toLowerCase() || "";
	const name = gsec.securityName?.toLowerCase() || "";

	if (
		secType === "t_bill" ||
		secType === "tbill" ||
		name.includes("t-bill") ||
		name.includes("treasury bill")
	) {
		return "tbill";
	}
	if (
		secType === "sdl" ||
		name.includes("sdl") ||
		name.includes("state development")
	) {
		return "sdl";
	}
	if (
		secType === "sgb" ||
		name.includes("gold") ||
		name.includes("sovereign gold")
	) {
		return "sgb";
	}
	if (secType === "tax_free_bond" || name.includes("tax free")) {
		return "tax_free_bond";
	}
	if (secType === "infrastructure_bond" || name.includes("infrastructure")) {
		return "infrastructure_bond";
	}
	return "gsec";
}

function determineCorporateBondType(bond: any): InstrumentType {
	const bondType = bond.bondType?.toLowerCase() || "";
	const name = bond.bondName?.toLowerCase() || "";

	if (
		bondType === "ncd" ||
		name.includes("ncd") ||
		name.includes("non-convertible")
	) {
		return "ncd";
	}
	if (bondType === "tax_free_bond" || name.includes("tax free")) {
		return "tax_free_bond";
	}
	if (
		bondType === "infrastructure_bond" ||
		bondType === "infrastructure" ||
		name.includes("infrastructure")
	) {
		return "infrastructure_bond";
	}
	return "corporate_bond";
}

function determineKycTier(
	creditRating: string | null,
): "basic" | "enhanced" | "accredited" {
	if (!creditRating) return "enhanced";

	const rating = creditRating.toUpperCase();

	// Investment grade (AAA to BBB-) = Enhanced KYC
	if (
		[
			"AAA",
			"AA+",
			"AA",
			"AA-",
			"A+",
			"A",
			"A-",
			"BBB+",
			"BBB",
			"BBB-",
		].includes(rating)
	) {
		return "enhanced";
	}

	// Below investment grade = Accredited investor only
	return "accredited";
}

// ============================================
// AUDIT LOGS API
// ============================================

router.get("/audit-logs", async (req: Request, res: Response) => {
	try {
		const { limit = "50", offset = "0", action, entityType } = req.query;

		const conditions = [];
		if (action)
			conditions.push(eq(bondMarketplaceAuditLogs.action, action as string));
		if (entityType)
			conditions.push(
				eq(bondMarketplaceAuditLogs.entityType, entityType as string),
			);

		const logs =
			conditions.length > 0
				? await db
						.select()
						.from(bondMarketplaceAuditLogs)
						.where(and(...conditions))
						.orderBy(desc(bondMarketplaceAuditLogs.timestamp))
						.limit(Number.parseInt(limit as string))
						.offset(Number.parseInt(offset as string))
				: await db
						.select()
						.from(bondMarketplaceAuditLogs)
						.orderBy(desc(bondMarketplaceAuditLogs.timestamp))
						.limit(Number.parseInt(limit as string))
						.offset(Number.parseInt(offset as string));

		const totalResult =
			conditions.length > 0
				? await db
						.select({ count: count() })
						.from(bondMarketplaceAuditLogs)
						.where(and(...conditions))
				: await db.select({ count: count() }).from(bondMarketplaceAuditLogs);

		res.json({
			logs,
			total: totalResult[0]?.count || 0,
			limit: Number.parseInt(limit as string),
			offset: Number.parseInt(offset as string),
		});
	} catch (error: any) {
		console.error("Error fetching audit logs:", error);
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// BULK IMPORT API (for syncing between environments)
// ============================================

// Bulk import bonds from JSON data
router.post("/bulk-import-bonds", async (req: Request, res: Response) => {
	try {
		const { bonds } = req.body;

		if (!bonds || !Array.isArray(bonds)) {
			return res.status(400).json({ error: "bonds array is required" });
		}

		let inserted = 0;
		let skipped = 0;
		const errors: string[] = [];

		for (const bond of bonds) {
			try {
				await db
					.insert(bondCatalog)
					.values({
						id: bond.id,
						source: bond.source,
						sourceId: bond.source_id || bond.sourceId,
						isin: bond.isin,
						bondName: bond.bond_name || bond.bondName,
						issuerName: bond.issuer_name || bond.issuerName,
						instrumentType: bond.instrument_type || bond.instrumentType,
						isListed: bond.is_listed ?? bond.isListed ?? true,
						exchange: bond.exchange,
						faceValue: bond.face_value || bond.faceValue,
						couponRate: bond.coupon_rate || bond.couponRate,
						couponFrequency: bond.coupon_frequency || bond.couponFrequency,
						issueDate: bond.issue_date || bond.issueDate,
						maturityDate: bond.maturity_date || bond.maturityDate,
						cleanPrice: bond.clean_price || bond.cleanPrice,
						dirtyPrice: bond.dirty_price || bond.dirtyPrice,
						accruedInterest: bond.accrued_interest || bond.accruedInterest,
						yieldToMaturity: bond.yield_to_maturity || bond.yieldToMaturity,
						creditRating: bond.credit_rating || bond.creditRating,
						ratingAgency: bond.rating_agency || bond.ratingAgency,
						minInvestment: bond.min_investment || bond.minInvestment,
						lotSize: bond.lot_size || bond.lotSize,
						taxCategory: bond.tax_category || bond.taxCategory,
						tdsApplicable: bond.tds_applicable ?? bond.tdsApplicable ?? true,
						tdsRate: bond.tds_rate || bond.tdsRate,
						netYieldToMaturity:
							bond.net_yield_to_maturity || bond.netYieldToMaturity,
						status: bond.status || "published",
						region: bond.region || "APAC",
						country: bond.country || "IN",
						currency: bond.currency || "INR",
					})
					.onConflictDoNothing();
				inserted++;
			} catch (err: any) {
				if (err.code === "23505") {
					// Duplicate key
					skipped++;
				} else {
					errors.push(`${bond.isin}: ${err.message}`);
				}
			}
		}

		res.json({
			success: true,
			inserted,
			skipped,
			errors: errors.slice(0, 10), // Limit error messages
			total: bonds.length,
		});
	} catch (error: any) {
		console.error("Error bulk importing bonds:", error);
		res.status(500).json({ error: error.message });
	}
});

// Get bond catalog count for sync status
router.get("/bond-count", async (req: Request, res: Response) => {
	try {
		const result = await db.select({ count: count() }).from(bondCatalog);
		res.json({ count: result[0]?.count || 0 });
	} catch (error: any) {
		console.error("Error getting bond count:", error);
		res.status(500).json({ error: error.message });
	}
});

export default router;
