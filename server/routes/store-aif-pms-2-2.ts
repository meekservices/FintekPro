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
import { checkSuspiciousValues } from "../utils/compliance-utils";
import { complianceMonitor } from "../compliance-monitor";

const router = Router();

// ============ AIF ROUTES ============

// GET /store/aif - List published AIF schemes with filters
router.get("/portfolio/aif", requireAuth, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		const { clientId } = req.query;

		// Agent can view specific client, otherwise user views their own
		const targetClientId = clientId ? String(clientId) : userId;

		const holdings = await db
			.select({
				holding: clientPortfolioAif,
				aif: aifMaster,
				addedBy: users,
			})
			.from(clientPortfolioAif)
			.leftJoin(aifMaster, eq(clientPortfolioAif.aifId, aifMaster.id))
			.leftJoin(users, eq(clientPortfolioAif.addedByUserId, users.id))
			.where(eq(clientPortfolioAif.clientId, targetClientId))
			.orderBy(desc(clientPortfolioAif.createdAt));

		// Calculate summary
		const summaryData = holdings.reduce(
			(acc, h) => {
				const value = Number.parseFloat(h.holding.currentValue || "0");
				const invested = Number.parseFloat(h.holding.capitalCalled || "0");
				acc.totalCurrentValue += value;
				acc.totalInvested += invested;
				acc.totalCommitment += Number.parseFloat(
					h.holding.commitmentAmount || "0",
				);
				acc.holdings += 1;
				return acc;
			},
			{
				totalCurrentValue: 0,
				totalInvested: 0,
				totalCommitment: 0,
				holdings: 0,
			},
		);

		const totalGainLoss =
			summaryData.totalCurrentValue - summaryData.totalInvested;
		const summary = {
			...summaryData,
			totalGainLoss,
			totalGainLossPercent:
				summaryData.totalInvested > 0
					? (totalGainLoss / summaryData.totalInvested) * 100
					: 0,
		};

		res.json({
			holdings: holdings.map((h) => ({
				...h.holding,
				aifDetails: h.aif,
				addedByUser: h.addedBy
					? {
							id: h.addedBy.id,
							name: `${h.addedBy.firstName || ""} ${h.addedBy.lastName || ""}`.trim(),
						}
					: null,
			})),
			summary,
		});
	} catch (error: any) {
		console.error("Error fetching AIF portfolio:", error);
		res.status(500).json({ error: "Failed to fetch AIF portfolio" });
	}
});

// POST /portfolio/aif - Add AIF holding
router.post("/portfolio/aif", requireAuth, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		const data = req.body;

		// Validate required fields
		if (
			!data.aifName ||
			!data.commitmentAmount ||
			!data.capitalCalled ||
			!data.investedDate
		) {
			return res
				.status(400)
				.json({
					error:
						"Missing required fields: aifName, commitmentAmount, capitalCalled, investedDate",
				});
		}

		// Set client and added by
		const clientId = data.clientId || userId;

		// Regulatory Compliance Check
		const suspiciousCheck = checkSuspiciousValues(
			data.commitmentAmount,
			`AIF-Commitment-${data.aifName}`,
			clientId,
		);
		if (suspiciousCheck.isSuspicious) {
			await complianceMonitor.logSuspiciousActivity({
				userId: clientId,
				activityType: "SUSPICIOUS_AIF_COMMITMENT",
				details:
					suspiciousCheck.reason || "Commitment near regulatory threshold",
				severity: "medium",
				metadata: { amount: data.commitmentAmount, aifName: data.aifName },
			});
		}

		// Calculate uncalled capital
		const capitalUncalled =
			Number.parseFloat(data.commitmentAmount) -
			Number.parseFloat(data.capitalCalled);

		// If aifId provided, fetch latest NAV
		let latestNav = data.latestNav;
		let lastNavDate = data.lastNavDate;
		if (data.aifId) {
			const [aif] = await db
				.select()
				.from(aifMaster)
				.where(eq(aifMaster.id, data.aifId))
				.limit(1);
			if (aif) {
				latestNav = latestNav || aif.latestNav;
				lastNavDate = lastNavDate || aif.lastNavDate;
			}
		}

		// Calculate current value if units and NAV available
		let currentValue = data.currentValue;
		if (!currentValue && data.currentUnits && latestNav) {
			currentValue =
				Number.parseFloat(data.currentUnits) * Number.parseFloat(latestNav);
		}

		// Calculate unrealized gain/loss
		const costOfInvestment = data.costOfInvestment || data.capitalCalled;
		let unrealizedGainLoss = null;
		let unrealizedGainLossPercent = null;
		if (currentValue && costOfInvestment) {
			unrealizedGainLoss =
				Number.parseFloat(currentValue) - Number.parseFloat(costOfInvestment);
			unrealizedGainLossPercent =
				(unrealizedGainLoss / Number.parseFloat(costOfInvestment)) * 100;
		}

		const [holding] = await db
			.insert(clientPortfolioAif)
			.values({
				clientId,
				addedByUserId: userId,
				aifId: data.aifId || null,
				aifName: data.aifName,
				registrationNo: data.registrationNo,
				category: data.category,
				subcategory: data.subcategory,
				commitmentAmount: data.commitmentAmount,
				capitalCalled: data.capitalCalled,
				capitalUncalled: String(capitalUncalled),
				investedDate: data.investedDate,
				lockinEndDate: data.lockinEndDate,
				currentUnits: data.currentUnits,
				entryNav: data.entryNav,
				latestNav,
				lastNavDate,
				costOfInvestment,
				currentValue: currentValue ? String(currentValue) : null,
				unrealizedGainLoss: unrealizedGainLoss
					? String(unrealizedGainLoss)
					: null,
				unrealizedGainLossPercent: unrealizedGainLossPercent
					? String(unrealizedGainLossPercent)
					: null,
				documents: data.documents || [],
				notes: data.notes,
				entryStatus: "pending",
			})
			.returning();

		res.status(201).json(holding);
	} catch (error: any) {
		console.error("Error adding AIF holding:", error);
		res.status(500).json({ error: "Failed to add AIF holding" });
	}
});

// PUT /portfolio/aif/:id - Update AIF holding
router.put("/portfolio/aif/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const userId = (req as any).user?.id;
		const data = req.body;

		// Verify ownership or admin
		const [existing] = await db
			.select()
			.from(clientPortfolioAif)
			.where(eq(clientPortfolioAif.id, id))
			.limit(1);
		if (!existing) {
			return res.status(404).json({ error: "AIF holding not found" });
		}

		// Calculate uncalled capital if commitment or called amounts changed
		let capitalUncalled = existing.capitalUncalled;
		if (data.commitmentAmount || data.capitalCalled) {
			const commitment = Number.parseFloat(
				data.commitmentAmount || existing.commitmentAmount,
			);
			const called = Number.parseFloat(
				data.capitalCalled || existing.capitalCalled,
			);
			capitalUncalled = String(commitment - called);
		}

		// Calculate current value if units or NAV changed
		let currentValue = data.currentValue;
		const units = data.currentUnits || existing.currentUnits;
		const nav = data.latestNav || existing.latestNav;
		if (!currentValue && units && nav) {
			currentValue = Number.parseFloat(units) * Number.parseFloat(nav);
		}

		// Calculate unrealized gain/loss
		const costOfInvestment =
			data.costOfInvestment ||
			existing.costOfInvestment ||
			existing.capitalCalled;
		let unrealizedGainLoss = null;
		let unrealizedGainLossPercent = null;
		if (currentValue && costOfInvestment) {
			unrealizedGainLoss =
				Number.parseFloat(currentValue) - Number.parseFloat(costOfInvestment);
			unrealizedGainLossPercent =
				(unrealizedGainLoss / Number.parseFloat(costOfInvestment)) * 100;
		}

		const [updated] = await db
			.update(clientPortfolioAif)
			.set({
				...data,
				capitalUncalled,
				currentValue: currentValue
					? String(currentValue)
					: existing.currentValue,
				unrealizedGainLoss: unrealizedGainLoss
					? String(unrealizedGainLoss)
					: existing.unrealizedGainLoss,
				unrealizedGainLossPercent: unrealizedGainLossPercent
					? String(unrealizedGainLossPercent)
					: existing.unrealizedGainLossPercent,
				updatedAt: new Date(),
			})
			.where(eq(clientPortfolioAif.id, id))
			.returning();

		res.json(updated);
	} catch (error: any) {
		console.error("Error updating AIF holding:", error);
		res.status(500).json({ error: "Failed to update AIF holding" });
	}
});

// DELETE /portfolio/aif/:id - Delete AIF holding
router.delete("/portfolio/aif/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;

		const [deleted] = await db
			.delete(clientPortfolioAif)
			.where(eq(clientPortfolioAif.id, id))
			.returning();

		if (!deleted) {
			return res.status(404).json({ error: "AIF holding not found" });
		}

		res.json({ success: true, deleted });
	} catch (error: any) {
		console.error("Error deleting AIF holding:", error);
		res.status(500).json({ error: "Failed to delete AIF holding" });
	}
});

// ============ CLIENT PORTFOLIO - PMS HOLDINGS ============

// GET /portfolio/pms - Get client's PMS holdings
router.get("/portfolio/pms", requireAuth, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		const { clientId } = req.query;

		const targetClientId = clientId ? String(clientId) : userId;

		const holdings = await db
			.select({
				holding: clientPortfolioPms,
				pms: pmsMaster,
				addedBy: users,
			})
			.from(clientPortfolioPms)
			.leftJoin(pmsMaster, eq(clientPortfolioPms.pmsId, pmsMaster.id))
			.leftJoin(users, eq(clientPortfolioPms.addedByUserId, users.id))
			.where(eq(clientPortfolioPms.clientId, targetClientId))
			.orderBy(desc(clientPortfolioPms.createdAt));

		// Calculate summary
		const summaryData = holdings.reduce(
			(acc, h) => {
				const value = Number.parseFloat(
					h.holding.currentValue || h.holding.corpusValue || "0",
				);
				const invested = Number.parseFloat(
					h.holding.totalInvested || h.holding.investedAmount || "0",
				);
				acc.totalCurrentValue += value;
				acc.totalInvested += invested;
				acc.holdings += 1;
				return acc;
			},
			{ totalCurrentValue: 0, totalInvested: 0, holdings: 0 },
		);

		const totalGainLoss =
			summaryData.totalCurrentValue - summaryData.totalInvested;
		const summary = {
			...summaryData,
			totalGainLoss,
			totalGainLossPercent:
				summaryData.totalInvested > 0
					? (totalGainLoss / summaryData.totalInvested) * 100
					: 0,
		};

		res.json({
			holdings: holdings.map((h) => ({
				...h.holding,
				pmsDetails: h.pms,
				addedByUser: h.addedBy
					? {
							id: h.addedBy.id,
							name: `${h.addedBy.firstName || ""} ${h.addedBy.lastName || ""}`.trim(),
						}
					: null,
			})),
			summary,
		});
	} catch (error: any) {
		console.error("Error fetching PMS portfolio:", error);
		res.status(500).json({ error: "Failed to fetch PMS portfolio" });
	}
});

// POST /portfolio/pms - Add PMS holding
router.post("/portfolio/pms", requireAuth, async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		const data = req.body;

		// Validate required fields
		if (!data.pmsName || !data.investedAmount || !data.startDate) {
			return res
				.status(400)
				.json({
					error: "Missing required fields: pmsName, investedAmount, startDate",
				});
		}

		const clientId = data.clientId || userId;

		// Regulatory Compliance Check
		const suspiciousCheck = checkSuspiciousValues(
			data.investedAmount,
			`PMS-Investment-${data.pmsName}`,
			clientId,
		);
		if (suspiciousCheck.isSuspicious) {
			await complianceMonitor.logSuspiciousActivity({
				userId: clientId,
				activityType: "SUSPICIOUS_PMS_INVESTMENT",
				details:
					suspiciousCheck.reason || "Investment near regulatory threshold",
				severity: "medium",
				metadata: { amount: data.investedAmount, pmsName: data.pmsName },
			});
		}

		// Calculate total invested
		const totalInvested =
			Number.parseFloat(data.investedAmount) +
			Number.parseFloat(data.additionalInfusions || "0");

		// If pmsId provided, fetch latest NAV
		let latestNav = data.latestNav;
		let lastNavDate = data.lastNavDate;
		if (data.pmsId) {
			const [pms] = await db
				.select()
				.from(pmsMaster)
				.where(eq(pmsMaster.id, data.pmsId))
				.limit(1);
			if (pms) {
				latestNav = latestNav || pms.latestNav;
				lastNavDate = lastNavDate || pms.lastNavDate;
			}
		}

		// Calculate unrealized gain/loss
		const currentValue = data.currentValue || data.corpusValue;
		let unrealizedGainLoss = null;
		let unrealizedGainLossPercent = null;
		if (currentValue && totalInvested) {
			unrealizedGainLoss = Number.parseFloat(currentValue) - totalInvested;
			unrealizedGainLossPercent = (unrealizedGainLoss / totalInvested) * 100;
		}

		// Calculate CAGR
		let cagr = null;
		if (currentValue && data.investedAmount && data.startDate) {
			const startDate = new Date(data.startDate);
			const now = new Date();
			const years =
				(now.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
			if (years > 0) {
				cagr =
					((Number.parseFloat(currentValue) /
						Number.parseFloat(data.investedAmount)) **
						(1 / years) -
						1) *
					100;
			}
		}

		const [holding] = await db
			.insert(clientPortfolioPms)
			.values({
				clientId,
				addedByUserId: userId,
				pmsId: data.pmsId || null,
				pmsName: data.pmsName,
				registrationNo: data.registrationNo,
				strategy: data.strategy,
				investedAmount: data.investedAmount,
				additionalInfusions: data.additionalInfusions || "0",
				totalInvested: String(totalInvested),
				startDate: data.startDate,
				lastInfusionDate: data.lastInfusionDate,
				corpusValue: data.corpusValue,
				latestNav,
				lastNavDate,
				currentValue,
				unrealizedGainLoss: unrealizedGainLoss
					? String(unrealizedGainLoss)
					: null,
				unrealizedGainLossPercent: unrealizedGainLossPercent
					? String(unrealizedGainLossPercent)
					: null,
				cagr: cagr ? String(cagr) : null,
				documents: data.documents || [],
				notes: data.notes,
				entryStatus: "pending",
			})
			.returning();

		res.status(201).json(holding);
	} catch (error: any) {
		console.error("Error adding PMS holding:", error);
		res.status(500).json({ error: "Failed to add PMS holding" });
	}
});

// PUT /portfolio/pms/:id - Update PMS holding
router.put("/portfolio/pms/:id", requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const data = req.body;

		const [existing] = await db
			.select()
			.from(clientPortfolioPms)
			.where(eq(clientPortfolioPms.id, id))
			.limit(1);
		if (!existing) {
			return res.status(404).json({ error: "PMS holding not found" });
		}

		// Calculate total invested
		const investedAmount = data.investedAmount || existing.investedAmount;
		const additionalInfusions =
			data.additionalInfusions || existing.additionalInfusions || "0";
		const totalInvested =
			Number.parseFloat(investedAmount) +
			Number.parseFloat(additionalInfusions);

		// Calculate unrealized gain/loss
		const currentValue =
			data.currentValue ||
			data.corpusValue ||
			existing.currentValue ||
			existing.corpusValue;
		let unrealizedGainLoss = null;
		let unrealizedGainLossPercent = null;
		if (currentValue && totalInvested) {
			unrealizedGainLoss = Number.parseFloat(currentValue) - totalInvested;
			unrealizedGainLossPercent = (unrealizedGainLoss / totalInvested) * 100;
		}

		// Calculate CAGR
		let cagr = null;
		const startDate = data.startDate || existing.startDate;
		if (currentValue && investedAmount && startDate) {
			const start = new Date(startDate);
			const now = new Date();
			const years =
				(now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
			if (years > 0) {
				cagr =
					((Number.parseFloat(currentValue) /
						Number.parseFloat(investedAmount)) **
						(1 / years) -
						1) *
					100;
			}
		}

		const [updated] = await db
			.update(clientPortfolioPms)
			.set({
				...data,
				totalInvested: String(totalInvested),
				unrealizedGainLoss: unrealizedGainLoss
					? String(unrealizedGainLoss)
					: existing.unrealizedGainLoss,
				unrealizedGainLossPercent: unrealizedGainLossPercent
					? String(unrealizedGainLossPercent)
					: existing.unrealizedGainLossPercent,
				cagr: cagr ? String(cagr) : existing.cagr,
				updatedAt: new Date(),
			})
			.where(eq(clientPortfolioPms.id, id))
			.returning();

		res.json(updated);
	} catch (error: any) {
		console.error("Error updating PMS holding:", error);
		res.status(500).json({ error: "Failed to update PMS holding" });
	}
});

// DELETE /portfolio/pms/:id - Delete PMS holding

export default router;
