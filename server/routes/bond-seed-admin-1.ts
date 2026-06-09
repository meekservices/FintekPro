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
router.get("/fee-profiles", async (req: Request, res: Response) => {
	try {
		// Initialize default profiles if not exist
		await bondFeeCalibrationService.initializeDefaultProfiles();

		const profiles = await bondFeeCalibrationService.getAllProfiles();
		const regulatoryCaps = bondFeeCalibrationService.getRegulatoryCaps();

		res.json({
			profiles,
			regulatoryCaps,
			gstRate: 18, // Standard GST rate
		});
	} catch (error: any) {
		console.error("Error fetching fee profiles:", error);
		res.status(500).json({ error: error.message });
	}
});

// Update fee profile
router.put("/fee-profiles/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const updates = req.body;
		const userId = (req as any).user?.id;

		const updated = await bondFeeCalibrationService.updateProfile(
			id,
			updates,
			userId,
		);

		if (!updated) {
			return res.status(404).json({ error: "Fee profile not found" });
		}

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "update_fee_profile",
			entityType: "fee_profile",
			entityId: id,
			afterValue: updates,
			changeDescription: `Updated fee profile for ${updated.instrumentType}`,
			complianceRelated: true,
			riskLevel: "medium",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000), // 7 years
		});

		res.json({ profile: updated });
	} catch (error: any) {
		console.error("Error updating fee profile:", error);
		res.status(400).json({ error: error.message });
	}
});

// Calculate fees for preview
router.post("/calculate-fees", async (req: Request, res: Response) => {
	try {
		const {
			instrumentType,
			transactionAmount,
			grossYield,
			investorSegment,
			transactionType,
			feeProfileId,
			feeOverrideId,
		} = req.body;

		const breakdown = await bondFeeCalibrationService.calculateFees({
			instrumentType,
			transactionAmount: Number.parseFloat(transactionAmount),
			grossYield: Number.parseFloat(grossYield),
			investorSegment: investorSegment || "retail",
			transactionType: transactionType || "buy",
			feeProfileId,
			feeOverrideId,
		});

		res.json(breakdown);
	} catch (error: any) {
		console.error("Error calculating fees:", error);
		res.status(400).json({ error: error.message });
	}
});

// Calculate net yield with detailed breakdown
router.post("/calculate-net-yield", async (req: Request, res: Response) => {
	try {
		const {
			instrumentType,
			grossYield,
			transactionAmount,
			holdingPeriodYears,
			investorSegment,
			taxBracket,
			feeProfileId,
			feeOverrideId,
		} = req.body;

		const result = await bondFeeCalibrationService.calculateNetYield({
			instrumentType,
			grossYield: Number.parseFloat(grossYield),
			transactionAmount: Number.parseFloat(transactionAmount || "100000"),
			holdingPeriodYears: Number.parseFloat(holdingPeriodYears || "1"),
			investorSegment: investorSegment || "retail",
			taxBracket: Number.parseFloat(taxBracket || "30"),
			feeProfileId,
			feeOverrideId,
		});

		res.json(result);
	} catch (error: any) {
		console.error("Error calculating net yield:", error);
		res.status(400).json({ error: error.message });
	}
});

// Calculate net yield for a specific bond in catalog
router.get(
	"/catalog/:bondId/net-yield",
	async (req: Request, res: Response) => {
		try {
			const { bondId } = req.params;
			const { investorSegment } = req.query;

			const result = await bondFeeCalibrationService.calculateNetYieldForBond(
				bondId,
				(investorSegment as "retail" | "hni" | "institutional") || "retail",
			);

			if (!result) {
				return res.status(404).json({ error: "Bond not found" });
			}

			res.json(result);
		} catch (error: any) {
			console.error("Error calculating net yield for bond:", error);
			res.status(400).json({ error: error.message });
		}
	},
);

// Batch calculate net yields for multiple bonds
router.post("/catalog/batch-net-yield", async (req: Request, res: Response) => {
	try {
		const { bondIds, investorSegment } = req.body;

		if (!Array.isArray(bondIds) || bondIds.length === 0) {
			return res
				.status(400)
				.json({ error: "bondIds must be a non-empty array" });
		}

		const results: Record<string, any> = {};

		for (const bondId of bondIds) {
			const result = await bondFeeCalibrationService.calculateNetYieldForBond(
				bondId,
				investorSegment || "retail",
			);
			if (result) {
				results[bondId] = result;
			}
		}

		res.json({ netYields: results });
	} catch (error: any) {
		console.error("Error batch calculating net yields:", error);
		res.status(400).json({ error: error.message });
	}
});

// ============================================
// FEE OVERRIDES API
// ============================================

// Preview net yield with temporary override values (before saving)
router.post(
	"/preview-override-net-yield",
	async (req: Request, res: Response) => {
		try {
			const {
				instrumentType,
				grossYield,
				transactionAmount,
				holdingPeriodYears,
				investorSegment,
				platformFeeOverride,
				brokerageFeeOverride,
				transactionChargesOverride,
			} = req.body;

			// Get base fee profile
			const profile =
				await bondFeeCalibrationService.getProfileByInstrumentType(
					instrumentType,
				);
			const caps = REGULATORY_FEE_CAPS[instrumentType as InstrumentType];
			const violations: string[] = [];

			// Use override values if provided, otherwise use profile defaults
			let platformFeeRate =
				platformFeeOverride !== null && platformFeeOverride !== ""
					? Number.parseFloat(platformFeeOverride)
					: profile
						? Number.parseFloat(profile.platformFeeValue || "0")
						: caps.maxPlatformFee * 0.5;

			let brokerageRate =
				brokerageFeeOverride !== null && brokerageFeeOverride !== ""
					? Number.parseFloat(brokerageFeeOverride)
					: profile
						? Number.parseFloat(profile.brokerageFeeValue || "0")
						: caps.maxBrokerage * 0.5;

			const transactionChargesRate =
				transactionChargesOverride !== null && transactionChargesOverride !== ""
					? Number.parseFloat(transactionChargesOverride)
					: profile
						? Number.parseFloat(profile.transactionCharges || "0")
						: 0;

			// Apply investor segment multiplier (only to defaults, not overrides)
			let segmentMultiplier = 1.0;
			if (
				profile &&
				(platformFeeOverride === null || platformFeeOverride === "") &&
				(brokerageFeeOverride === null || brokerageFeeOverride === "")
			) {
				switch (investorSegment) {
					case "retail":
						segmentMultiplier = Number.parseFloat(
							profile.retailMultiplier || "1.00",
						);
						break;
					case "hni":
						segmentMultiplier = Number.parseFloat(
							profile.hniMultiplier || "1.00",
						);
						break;
					case "institutional":
						segmentMultiplier = Number.parseFloat(
							profile.institutionalMultiplier || "0.50",
						);
						break;
				}
				platformFeeRate *= segmentMultiplier;
				brokerageRate *= segmentMultiplier;
			}

			// Validate against regulatory caps
			if (brokerageRate > caps.maxBrokerage) {
				violations.push(
					`Brokerage ${brokerageRate.toFixed(4)}% exceeds regulatory cap of ${caps.maxBrokerage}%`,
				);
				brokerageRate = caps.maxBrokerage;
			}
			if (platformFeeRate > caps.maxPlatformFee) {
				violations.push(
					`Platform fee ${platformFeeRate.toFixed(4)}% exceeds regulatory cap of ${caps.maxPlatformFee}%`,
				);
				platformFeeRate = caps.maxPlatformFee;
			}

			// Calculate fees
			const gstRate = profile ? Number.parseFloat(profile.gstRate || "18") : 18;
			const gstOnBrokeragePercent = (brokerageRate * gstRate) / 100;
			const gstOnPlatformFeePercent = (platformFeeRate * gstRate) / 100;
			const totalGstPercent = gstOnBrokeragePercent + gstOnPlatformFeePercent;

			let stampDutyPercent = 0;
			if (caps.stampDuty) {
				const stampDutyRate = profile
					? Number.parseFloat(profile.stampDutyRate || "0")
					: (caps as any).stampDutyRate || 0;
				stampDutyPercent = stampDutyRate * 100;
			}

			const totalOneTimeFees =
				platformFeeRate +
				brokerageRate +
				transactionChargesRate +
				totalGstPercent +
				stampDutyPercent;
			const holdingYears = Number.parseFloat(holdingPeriodYears || "1") || 1;
			const annualizedFeePercentage =
				holdingYears > 0 ? totalOneTimeFees / holdingYears : totalOneTimeFees;

			const grossYieldNum = Number.parseFloat(grossYield || "0");
			const netYield = grossYieldNum - annualizedFeePercentage;

			const isTaxFree =
				instrumentType === "tax_free_bond" || instrumentType === "sgb";
			const taxBracket = 30;
			const effectiveTaxRate = isTaxFree ? 0 : taxBracket;
			const taxImpact = (netYield * effectiveTaxRate) / 100;
			const netYieldAfterTax = netYield - taxImpact;

			const feeImpactBps = Math.round(annualizedFeePercentage * 100);
			const taxImpactBps = Math.round(taxImpact * 100);

			const breakdown = {
				platformFeeAnnualized:
					Math.round((platformFeeRate / holdingYears) * 10000) / 10000,
				brokerageFeeAnnualized:
					Math.round((brokerageRate / holdingYears) * 10000) / 10000,
				transactionChargesAnnualized:
					Math.round((transactionChargesRate / holdingYears) * 10000) / 10000,
				gstAnnualized:
					Math.round((totalGstPercent / holdingYears) * 10000) / 10000,
				stampDutyAnnualized:
					Math.round((stampDutyPercent / holdingYears) * 10000) / 10000,
			};

			res.json({
				grossYield: Math.round(grossYieldNum * 10000) / 10000,
				netYield: Math.round(netYield * 10000) / 10000,
				netYieldAfterTax: Math.round(netYieldAfterTax * 10000) / 10000,
				feeImpactBps,
				taxImpactBps,
				totalImpactBps: feeImpactBps + taxImpactBps,
				annualizedFeePercentage:
					Math.round(annualizedFeePercentage * 10000) / 10000,
				breakdown,
				regulatoryCompliant: violations.length === 0,
				violations,
			});
		} catch (error: any) {
			console.error("Error previewing override net yield:", error);
			res.status(400).json({ error: error.message });
		}
	},
);

// Create fee override for a specific bond
router.post("/fee-overrides", async (req: Request, res: Response) => {
	try {
		const {
			isin,
			catalogId,
			platformFeeOverride,
			brokerageFeeOverride,
			transactionChargesOverride,
			overrideReason,
		} = req.body;
		const userId = (req as any).user?.id;

		if (!overrideReason) {
			return res.status(400).json({ error: "Override reason is required" });
		}

		// Create the override
		const override = await bondFeeCalibrationService.createFeeOverride({
			isin,
			platformFeeOverride: platformFeeOverride
				? Number.parseFloat(platformFeeOverride)
				: undefined,
			brokerageFeeOverride: brokerageFeeOverride
				? Number.parseFloat(brokerageFeeOverride)
				: undefined,
			transactionChargesOverride: transactionChargesOverride
				? Number.parseFloat(transactionChargesOverride)
				: undefined,
			overrideReason,
			createdBy: userId,
		});

		// Update the bond catalog entry with the override ID
		if (catalogId && override) {
			await db
				.update(bondCatalog)
				.set({ feeOverrideId: override.id, updatedAt: new Date() })
				.where(eq(bondCatalog.id, catalogId));
		}

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "create_fee_override",
			entityType: "fee_override",
			entityId: override?.id,
			afterValue: {
				isin,
				catalogId,
				platformFeeOverride,
				brokerageFeeOverride,
				transactionChargesOverride,
				overrideReason,
			},
			changeDescription: `Created fee override for ${isin}`,
			complianceRelated: true,
			riskLevel: "high",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({ override });
	} catch (error: any) {
		console.error("Error creating fee override:", error);
		res.status(400).json({ error: error.message });
	}
});

// Get fee overrides for a bond
router.get("/fee-overrides/:isin", async (req: Request, res: Response) => {
	try {
		const { isin } = req.params;

		const overrides = await db
			.select()
			.from(bondFeeOverrides)
			.where(eq(bondFeeOverrides.isin, isin))
			.orderBy(desc(bondFeeOverrides.createdAt));

		res.json({ overrides });
	} catch (error: any) {
		console.error("Error fetching fee overrides:", error);
		res.status(500).json({ error: error.message });
	}
});

// Delete fee override
router.delete("/fee-overrides/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;
		const userId = (req as any).user?.id;

		// Get existing override for audit
		const existing = await db
			.select()
			.from(bondFeeOverrides)
			.where(eq(bondFeeOverrides.id, id))
			.limit(1);

		if (!existing[0]) {
			return res.status(404).json({ error: "Override not found" });
		}

		// Delete the override
		await db.delete(bondFeeOverrides).where(eq(bondFeeOverrides.id, id));

		// Remove override reference from catalog
		await db
			.update(bondCatalog)
			.set({ feeOverrideId: null, updatedAt: new Date() })
			.where(eq(bondCatalog.feeOverrideId, id));

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "delete_fee_override",
			entityType: "fee_override",
			entityId: id,
			beforeValue: existing[0],
			changeDescription: `Deleted fee override for ${existing[0].isin}`,
			complianceRelated: true,
			riskLevel: "high",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({ success: true });
	} catch (error: any) {
		console.error("Error deleting fee override:", error);
		res.status(500).json({ error: error.message });
	}
});

// ============================================
// BOND CATALOG API (Draft/Publish Workflow)
// ============================================

// Get all bonds in catalog (with filters)
router.get("/catalog", async (req: Request, res: Response) => {
	try {
		const { status, instrumentType, source, isListed } = req.query;

		const query = db.select().from(bondCatalog);

		// Build where conditions
		const conditions = [];
		if (status) conditions.push(eq(bondCatalog.status, status as string));
		if (instrumentType)
			conditions.push(eq(bondCatalog.instrumentType, instrumentType as string));
		if (source) conditions.push(eq(bondCatalog.source, source as string));
		if (isListed !== undefined)
			conditions.push(eq(bondCatalog.isListed, isListed === "true"));

		const results =
			conditions.length > 0
				? await query
						.where(and(...conditions))
						.orderBy(desc(bondCatalog.createdAt))
				: await query.orderBy(desc(bondCatalog.createdAt));

		res.json({ bonds: results });
	} catch (error: any) {
		console.error("Error fetching bond catalog:", error);
		res.status(500).json({ error: error.message });
	}
});

// Sync bonds from NSE
router.post("/sync/nse", async (req: Request, res: Response) => {
	try {
		const userId = (req as any).user?.id;

		// Fetch existing government securities from our database
		const gsecs = await db.select().from(governmentSecurities);

		let synced = 0;
		let updated = 0;

		for (const gsec of gsecs) {
			// Check if already in catalog
			const existing = await db
				.select()
				.from(bondCatalog)
				.where(eq(bondCatalog.isin, gsec.isin))
				.limit(1);

			const instrumentType = determineGSecType(gsec);
			const feeProfile =
				await bondFeeCalibrationService.getProfileByInstrumentType(
					instrumentType,
				);

			if (existing.length === 0) {
				// Insert new
				await db.insert(bondCatalog).values({
					source: "nse",
					sourceId: gsec.id,
					isin: gsec.isin,
					bondName: gsec.securityName,
					issuerName: gsec.issuer || "Government of India",
					instrumentType,
					isListed: true,
					exchange: "NSE",
					faceValue: gsec.faceValue,
					couponRate: gsec.couponRate,
					couponFrequency: "semi_annual",
					issueDate: gsec.issueDate,
					maturityDate: gsec.maturityDate,
					cleanPrice: gsec.currentPrice,
					yieldToMaturity: gsec.yieldToMaturity,
					creditRating: "SOV", // Sovereign rating
					ratingAgency: "Sovereign",
					minInvestment: gsec.minimumInvestment,
					lotSize: 1,
					taxCategory: "taxable",
					tdsApplicable: true,
					tdsRate: "10",
					feeProfileId: feeProfile?.id,
					status: "draft",
					regulatoryTier: "basic",
					kycTierRequired: "basic",
					lastSyncAt: new Date(),
					createdBy: userId,
				});
				synced++;
			} else {
				// Update existing
				await db
					.update(bondCatalog)
					.set({
						cleanPrice: gsec.currentPrice,
						yieldToMaturity: gsec.yieldToMaturity,
						lastSyncAt: new Date(),
						updatedBy: userId,
						updatedAt: new Date(),
					})
					.where(eq(bondCatalog.id, existing[0].id));
				updated++;
			}
		}

		// Audit log
		await db.insert(bondMarketplaceAuditLogs).values({
			userId,
			userEmail: (req as any).user?.email,
			userRole: "admin",
			action: "sync_nse_bonds",
			entityType: "bond_catalog",
			entityId: "bulk",
			afterValue: { synced, updated, total: gsecs.length },
			changeDescription: `Synced ${synced} new bonds, updated ${updated} existing from NSE`,
			complianceRelated: false,
			riskLevel: "low",
			ipAddress: req.ip,
			retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
		});

		res.json({
			message: `NSE sync complete`,
			synced,
			updated,
			total: gsecs.length,
		});
	} catch (error: any) {
		console.error("Error syncing NSE bonds:", error);
		res.status(500).json({ error: error.message });
	}
});

// Sync bonds from BSE

export default router;
