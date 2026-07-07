import { Router, Request, Response, NextFunction } from "express";
import { requireAdmin } from "../middleware/roleMiddleware";
import { db } from "../db";
import {
	bondFeeProfiles,
	bondFeeOverrides,
	bondCatalog,
	governmentSecurities,
	bondCatalog,
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
router.delete("/catalog/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const userId = (req as any).user?.id;

		const bond = await db
			.select()
			.from(bondCatalog)
			.where(eq(bondCatalog.id, id))
			.limit(1);

		if (bond.length === 0) {
			return res.status(404).json({ error: "Bond not found" });
		}

		// Only allow deleting unlisted/manual bonds in draft status
		if (bond[0].source !== "manual") {
			return res
				.status(400)
				.json({ error: "Cannot delete synced bonds. Use unpublish instead." });
		}

		if (bond[0].status === "published") {
			return res
				.status(400)
				.json({ error: "Cannot delete published bonds. Unpublish first." });
		}

		await db.delete(bondCatalog).where(eq(bondCatalog.id, id));

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "delete_bond",
			entityType: "bond_catalog",
			entityId: id,
			isin: bond[0].isin,
			bondType: bond[0].instrumentType,
			beforeValue: bond[0],
			changeDescription: `Deleted bond: ${bond[0].bondName}`,
			complianceRelated: true,
			riskLevel: "high",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({ message: "Bond deleted successfully" });
	} catch (error: any) {
		console.error("Error deleting bond:", error);
		res.status(500).json({ error: error.message });
	}
});

// Publish bond (with fee validation)
router.post("/catalog/:id/publish", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { feeOverride } = req.body;
		const userId = (req as any).user?.id;

		const bond = await db
			.select()
			.from(bondCatalog)
			.where(eq(bondCatalog.id, id))
			.limit(1);

		if (bond.length === 0) {
			return res.status(404).json({ error: "Bond not found" });
		}

		if (bond[0].status === "published") {
			return res.status(400).json({ error: "Bond is already published" });
		}

		// Validate fees before publishing
		const feeProfile =
			await bondFeeCalibrationService.getProfileByInstrumentType(
				bond[0].instrumentType as InstrumentType,
			);

		if (!feeProfile) {
			return res
				.status(400)
				.json({ error: "No fee profile configured for this instrument type" });
		}

		// Create fee override if provided
		let feeOverrideId = bond[0].feeOverrideId;
		if (feeOverride && (feeOverride.platformFee || feeOverride.brokerage)) {
			const override = await bondFeeCalibrationService.createFeeOverride({
				isin: bond[0].isin,
				platformFeeOverride: feeOverride.platformFee,
				brokerageFeeOverride: feeOverride.brokerage,
				transactionChargesOverride: feeOverride.transactionCharges,
				overrideReason: feeOverride.reason || "Admin override at publish",
				createdBy: userId,
			});
			feeOverrideId = override.id;
		}

		// Calculate net yield
		const transactionAmount = Number.parseFloat(
			bond[0].cleanPrice || bond[0].faceValue || "1000",
		);
		const grossYield = Number.parseFloat(bond[0].yieldToMaturity || "0");

		const feeBreakdown = await bondFeeCalibrationService.calculateFees({
			instrumentType: bond[0].instrumentType as InstrumentType,
			transactionAmount,
			grossYield,
			investorSegment: "retail",
			transactionType: "buy",
			feeProfileId: feeProfile.id,
			feeOverrideId: feeOverrideId || undefined,
		});

		// Validate fees are within regulatory caps
		const instType = bond[0].instrumentType as InstrumentType;
		const regulatoryCap = REGULATORY_FEE_CAPS[instType];
		if (regulatoryCap) {
			const brokerageRate =
				(feeBreakdown.brokerageFee / transactionAmount) * 100;
			if (brokerageRate > regulatoryCap.maxBrokerage) {
				return res.status(400).json({
					error: `Brokerage rate ${brokerageRate.toFixed(4)}% exceeds regulatory cap of ${regulatoryCap.maxBrokerage}% for ${instType}`,
					regulatoryViolation: true,
				});
			}
		}

		// Update bond status to published
		const result = await db
			.update(bondCatalog)
			.set({
				status: "published",
				publishedAt: new Date(),
				publishedBy: userId,
				feeOverrideId,
				netYieldToMaturity: String(feeBreakdown.netYield),
				updatedAt: new Date(),
				updatedBy: userId,
			})
			.where(eq(bondCatalog.id, id))
			.returning();

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "publish_bond",
			entityType: "bond_catalog",
			entityId: id,
			isin: bond[0].isin,
			bondType: bond[0].instrumentType,
			beforeValue: { status: bond[0].status },
			afterValue: { status: "published", feeBreakdown },
			changeDescription: `Published bond: ${bond[0].bondName} with net yield ${feeBreakdown.netYield}%`,
			complianceRelated: true,
			riskLevel: "medium",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({
			bond: result[0],
			feeBreakdown,
		});
	} catch (error: any) {
		console.error("Error publishing bond:", error);
		res.status(500).json({ error: error.message });
	}
});

// Unpublish bond
router.post("/catalog/:id/unpublish", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const { reason } = req.body;
		const userId = (req as any).user?.id;

		const bond = await db
			.select()
			.from(bondCatalog)
			.where(eq(bondCatalog.id, id))
			.limit(1);

		if (bond.length === 0) {
			return res.status(404).json({ error: "Bond not found" });
		}

		if (bond[0].status !== "published") {
			return res.status(400).json({ error: "Bond is not published" });
		}

		const result = await db
			.update(bondCatalog)
			.set({
				status: "unpublished",
				unpublishedAt: new Date(),
				unpublishedBy: userId,
				unpublishReason: reason,
				updatedAt: new Date(),
				updatedBy: userId,
			})
			.where(eq(bondCatalog.id, id))
			.returning();

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "unpublish_bond",
			entityType: "bond_catalog",
			entityId: id,
			isin: bond[0].isin,
			bondType: bond[0].instrumentType,
			beforeValue: { status: "published" },
			afterValue: { status: "unpublished", reason },
			changeDescription: `Unpublished bond: ${bond[0].bondName}. Reason: ${reason || "Not specified"}`,
			complianceRelated: true,
			riskLevel: "medium",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({ bond: result[0] });
	} catch (error: any) {
		console.error("Error unpublishing bond:", error);
		res.status(500).json({ error: error.message });
	}
});

// Bulk publish
router.post("/catalog/bulk-publish", async (req: Request, res: Response) => {
	try {
		const { bondIds } = req.body;
		const userId = (req as any).user?.id;

		if (!bondIds || !Array.isArray(bondIds) || bondIds.length === 0) {
			return res.status(400).json({ error: "Bond IDs array is required" });
		}

		let published = 0;
		let failed = 0;
		const errors: string[] = [];

		for (const id of bondIds) {
			try {
				const bond = await db
					.select()
					.from(bondCatalog)
					.where(eq(bondCatalog.id, id))
					.limit(1);

				if (bond.length === 0 || bond[0].status === "published") {
					continue;
				}

				// Validate fees before publishing
				const instType = bond[0].instrumentType as InstrumentType;
				const feeProfile =
					await bondFeeCalibrationService.getProfileByInstrumentType(instType);

				if (!feeProfile) {
					failed++;
					errors.push(`${bond[0].isin}: No fee profile configured`);
					continue;
				}

				const transactionAmount = Number.parseFloat(
					bond[0].cleanPrice || bond[0].faceValue || "1000",
				);
				const grossYield = Number.parseFloat(bond[0].yieldToMaturity || "0");

				const feeBreakdown = await bondFeeCalibrationService.calculateFees({
					instrumentType: instType,
					transactionAmount,
					grossYield,
					investorSegment: "retail",
					transactionType: "buy",
					feeProfileId: feeProfile.id,
				});

				// Validate regulatory caps
				const regulatoryCap = REGULATORY_FEE_CAPS[instType];
				if (regulatoryCap) {
					const brokerageRate =
						(feeBreakdown.brokerageFee / transactionAmount) * 100;
					if (brokerageRate > regulatoryCap.maxBrokerage) {
						failed++;
						errors.push(
							`${bond[0].isin}: Brokerage ${brokerageRate.toFixed(4)}% exceeds cap ${regulatoryCap.maxBrokerage}%`,
						);
						continue;
					}
				}

				await db
					.update(bondCatalog)
					.set({
						status: "published",
						publishedAt: new Date(),
						publishedBy: userId,
						netYieldToMaturity: String(feeBreakdown.netYield),
						updatedAt: new Date(),
					})
					.where(eq(bondCatalog.id, id));

				published++;
			} catch (err: any) {
				failed++;
				errors.push(`${id}: ${err.message}`);
			}
		}

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "bulk_publish_bonds",
			entityType: "bond_catalog",
			entityId: "bulk",
			afterValue: { published, failed, total: bondIds.length },
			changeDescription: `Bulk published ${published} bonds`,
			complianceRelated: true,
			riskLevel: "medium",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({ published, failed, errors });
	} catch (error: any) {
		console.error("Error bulk publishing:", error);
		res.status(500).json({ error: error.message });
	}
});

// Get catalog stats
router.get("/catalog/stats", async (req: Request, res: Response) => {
	try {
		const stats = await db
			.select({
				status: bondCatalog.status,
				instrumentType: bondCatalog.instrumentType,
				count: sql<number>`count(*)::int`,
			})
			.from(bondCatalog)
			.groupBy(bondCatalog.status, bondCatalog.instrumentType);

		// Aggregate stats
		const byStatus: Record<string, number> = {};
		const byType: Record<string, number> = {};

		for (const row of stats) {
			byStatus[row.status] = (byStatus[row.status] || 0) + row.count;
			byType[row.instrumentType] =
				(byType[row.instrumentType] || 0) + row.count;
		}

		res.json({ byStatus, byType, detailed: stats });
	} catch (error: any) {
		console.error("Error fetching catalog stats:", error);
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// ISIN LOOKUP AND SEED ROUTES
// ============================================

// Lookup bond details by ISIN from NSDL
router.get("/isin-lookup/:isin", async (req: Request, res: Response) => {
	try {
		const { isin } = req.params;

		if (!isin || isin.length < 12) {
			return res
				.status(400)
				.json({ error: "Valid ISIN required (12 characters)" });
		}

		const { nsdlISINService } = await import("../services/nsdl-isin-service");
		const bondData = await nsdlISINService.lookupByISIN(isin);

		if (!bondData) {
			return res.status(404).json({ error: "ISIN not found in NSDL database" });
		}

		// Check if already exists in catalog
		const existing = await db
			.select()
			.from(bondCatalog)
			.where(eq(bondCatalog.isin, bondData.isin.toUpperCase()))
			.limit(1);

		const instrumentType = nsdlISINService.determineInstrumentType(
			bondData.securityDescription,
			bondData.issuerName,
		);

		const maturityDate = nsdlISINService.parseMaturityDate(
			bondData.maturityDate,
		);

		res.json({
			found: true,
			alreadyInCatalog: existing.length > 0,
			existingEntry: existing[0] || null,
			bondData: {
				isin: bondData.isin,
				issuerName: bondData.issuerName,
				securityDescription: bondData.securityDescription,
				currency: bondData.currency,
				interestRate: bondData.interestRate,
				maturityDate: maturityDate
					? maturityDate.toISOString().split("T")[0]
					: null,
				securityType: bondData.securityType,
				instrumentType,
			},
		});
	} catch (error: any) {
		console.error("Error looking up ISIN:", error);
		res.status(500).json({ error: error.message });
	}
});

// Search ISINs by prefix

export default router;
