/**
 * Unlisted Marketplace API Routes
 *
 * Handles all routes related to unlisted share trading marketplace including:
 * - Company management
 * - Credhive integration for financial data
 * - Buy/Sell listings and deal matching
 * - Financials and ratios tracking
 */

import {
	Router,
	type Request,
	type Response,
	type NextFunction,
} from "express";
import { storage } from "../storage";
import { db } from "../db";
import { apiResponse } from "../utils/responses";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { credhiveService } from "../services/credhive-service";
import { credhiveAdapter } from "../services/vendor-adapters/credhive.adapter";
import { enrichUnlistedCompanyWithMCAData } from "../services/mca-enrichment-service";
import { PriceSuggestionService } from "../services/price-suggestion";
import { priceAggregationService } from "../services/price-aggregation";
import { moneyControlReconciliation } from "../services/moneycontrol-reconciliation";
import { mcaService } from "../services/mca-service";
import { unifiedCompanyDataService } from "../services/unified-company-data-service";
import { valuationService } from "../services/valuation-service";
import { unlistedPricingWorkflowService } from "../services/unlisted-pricing-workflow";
import { unlistedEligibilityService } from "../services/unlisted-eligibility";
import {
	unlistedRiskDisclosureService,
	saveRiskAcknowledgment,
	requireRiskDisclosure,
} from "../services/unlisted-risk-disclosures";
import {
	insertUnlistedCompanySchema,
	insertUnlistedPriceHistorySchema,
	insertSellListingSchema,
	insertBuyRequestSchema,
	insertUnlistedDealSchema,
	insertUnlistedCartSchema,
	sellListings,
	buyRequests,
	unlistedDeals,
	unlistedCart,
	userProfiles,
	type UnlistedCompany,
	type SellListing,
	type BuyRequest,
	type UnlistedCartItem,
} from "@shared/schema";
import { requireLevel2 } from "../middleware/kyc-level-gate";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import { orderAuditHook } from "../services/order-audit-hook";
import { dataEnrichmentService } from "../services/data-enrichment-service";
import { unlistedValuationGovernanceService } from "../services/unlisted-valuation-governance-service";
import { unlistedFinancialEnrichmentService } from "../services/unlisted-financial-enrichment-service";
import {
	insertUnlistedEquityValuationHistorySchema,
	clientUnlistedDisclosureLog,
	unlistedEquityValuationHistory,
} from "@shared/schema";
import { regulatoryReportingService } from "../services/regulatory-reporting-service";

// Helper to auto-publish company to store if not already published
async function autoPublishCompanyToStore(company: any) {
	try {
		if (!company.storeProductId) {
			// Mock implementation or call actual service if available
			return true;
		}
		return false;
	} catch (e) {
		return false;
	}
}

const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.get(
	"/admin/regulatory/reports",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { status, reportType, authority, startDate, endDate, userId } =
				req.query;

			const filters: any = {};
			if (status && typeof status === "string") filters.status = status;
			if (reportType && typeof reportType === "string")
				filters.reportType = reportType;
			if (authority && typeof authority === "string")
				filters.authority = authority;
			if (userId && typeof userId === "string") filters.userId = userId;
			if (startDate && typeof startDate === "string")
				filters.startDate = new Date(startDate);
			if (endDate && typeof endDate === "string")
				filters.endDate = new Date(endDate);

			const reports = await regulatoryReportingService.getAllReports(filters);
			return apiResponse.success(res, reports);
		} catch (error: any) {
			console.error("Error fetching regulatory reports:", error);
			return apiResponse.serverError(res, "Failed to fetch reports");
		}
	},
);

/**
 * GET /api/unlisted/admin/regulatory/reports/pending
 * Get reports pending review
 */
router.get(
	"/admin/regulatory/reports/pending",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const reports = await regulatoryReportingService.getPendingReports();
			return apiResponse.success(res, reports);
		} catch (error: any) {
			console.error("Error fetching pending reports:", error);
			return apiResponse.serverError(res, "Failed to fetch pending reports");
		}
	},
);

/**
 * GET /api/unlisted/admin/regulatory/reports/stats
 * Get regulatory report statistics
 */
router.get(
	"/admin/regulatory/reports/stats",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const stats = await regulatoryReportingService.getReportStats();
			return apiResponse.success(res, stats);
		} catch (error: any) {
			console.error("Error fetching report stats:", error);
			return apiResponse.serverError(res, "Failed to fetch stats");
		}
	},
);

/**
 * GET /api/unlisted/admin/regulatory/reports/:reportId
 * Get a specific regulatory report
 */
router.get(
	"/admin/regulatory/reports/:reportId",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { reportId } = req.params;
			const report = await regulatoryReportingService.getReport(reportId);

			if (!report) {
				return apiResponse.notFound(res, "Report not found");
			}

			return apiResponse.success(res, report);
		} catch (error: any) {
			console.error("Error fetching report:", error);
			return apiResponse.serverError(res, "Failed to fetch report");
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/str
 * Create a new Suspicious Transaction Report (STR)
 */
router.post(
	"/admin/regulatory/reports/str",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const {
				userId,
				dealId,
				transactionIds,
				amount,
				currency,
				suspicionIndicators,
				narrative,
				metadata,
			} = req.body;

			if (!userId || !suspicionIndicators || !narrative) {
				return apiResponse.badRequest(
					res,
					"userId, suspicionIndicators, and narrative are required",
				);
			}

			const report = await regulatoryReportingService.createSTR({
				userId,
				dealId,
				transactionIds: transactionIds || [],
				amount: amount || 0,
				currency,
				suspicionIndicators,
				narrative,
				createdBy: user.id,
				metadata,
			});

			return apiResponse.created(res, report, "STR created successfully");
		} catch (error: any) {
			console.error("Error creating STR:", error);
			return apiResponse.serverError(res, "Failed to create STR");
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/ctr
 * Create a new Cash Transaction Report (CTR)
 */
router.post(
	"/admin/regulatory/reports/ctr",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const {
				userId,
				dealId,
				transactionIds,
				amount,
				currency,
				narrative,
				metadata,
			} = req.body;

			if (!userId || !amount || !narrative) {
				return apiResponse.badRequest(
					res,
					"userId, amount, and narrative are required",
				);
			}

			const report = await regulatoryReportingService.createCTR({
				userId,
				dealId,
				transactionIds: transactionIds || [],
				amount,
				currency,
				narrative,
				createdBy: user.id,
				metadata,
			});

			return apiResponse.created(res, report, "CTR created successfully");
		} catch (error: any) {
			console.error("Error creating CTR:", error);
			return apiResponse.serverError(res, "Failed to create CTR");
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/submit-for-review
 * Submit a report for review (draft -> pending_review)
 */
router.post(
	"/admin/regulatory/reports/:reportId/submit-for-review",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const { reportId } = req.params;

			const report = await regulatoryReportingService.submitForReview(
				reportId,
				user.id,
			);
			return apiResponse.success(res, report, "Report submitted for review");
		} catch (error: any) {
			console.error("Error submitting report for review:", error);
			if (error.message.includes("not found")) {
				return apiResponse.notFound(res, error.message);
			}
			return apiResponse.badRequest(res, error.message);
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/approve
 * Approve a report (pending_review -> approved)
 */
router.post(
	"/admin/regulatory/reports/:reportId/approve",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const { reportId } = req.params;
			const { reviewNotes } = req.body;

			const report = await regulatoryReportingService.approveReport(
				reportId,
				user.id,
				reviewNotes,
			);
			return apiResponse.success(res, report, "Report approved");
		} catch (error: any) {
			console.error("Error approving report:", error);
			if (error.message.includes("not found")) {
				return apiResponse.notFound(res, error.message);
			}
			return apiResponse.badRequest(res, error.message);
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/reject
 * Reject a report (pending_review -> rejected)
 */
router.post(
	"/admin/regulatory/reports/:reportId/reject",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const { reportId } = req.params;
			const { reviewNotes } = req.body;

			if (!reviewNotes) {
				return apiResponse.badRequest(
					res,
					"reviewNotes is required when rejecting a report",
				);
			}

			const report = await regulatoryReportingService.rejectReport(
				reportId,
				user.id,
				reviewNotes,
			);
			return apiResponse.success(res, report, "Report rejected");
		} catch (error: any) {
			console.error("Error rejecting report:", error);
			if (error.message.includes("not found")) {
				return apiResponse.notFound(res, error.message);
			}
			return apiResponse.badRequest(res, error.message);
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/submit
 * Submit an approved report to the regulatory authority
 */
router.post(
	"/admin/regulatory/reports/:reportId/submit",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const { reportId } = req.params;

			const report = await regulatoryReportingService.submitToAuthority(
				reportId,
				user.id,
			);
			return apiResponse.success(
				res,
				report,
				`Report submitted to ${report.authority}`,
			);
		} catch (error: any) {
			console.error("Error submitting report to authority:", error);
			if (error.message.includes("not found")) {
				return apiResponse.notFound(res, error.message);
			}
			return apiResponse.badRequest(res, error.message);
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/reports/:reportId/acknowledge
 * Mark a submitted report as acknowledged by authority
 */
router.post(
	"/admin/regulatory/reports/:reportId/acknowledge",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { reportId } = req.params;
			const { referenceNumber } = req.body;

			const report = await regulatoryReportingService.acknowledgeReport(
				reportId,
				referenceNumber,
			);
			return apiResponse.success(res, report, "Report acknowledged");
		} catch (error: any) {
			console.error("Error acknowledging report:", error);
			if (error.message.includes("not found")) {
				return apiResponse.notFound(res, error.message);
			}
			return apiResponse.badRequest(res, error.message);
		}
	},
);

/**
 * POST /api/unlisted/admin/regulatory/events
 * Manually register a reportable event
 */
router.post(
	"/admin/regulatory/events",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			const {
				eventType,
				userId,
				dealId,
				amount,
				currency,
				riskIndicators,
				riskScore,
				metadata,
			} = req.body;

			if (!eventType || !riskIndicators || riskScore === undefined) {
				return apiResponse.badRequest(
					res,
					"eventType, riskIndicators, and riskScore are required",
				);
			}

			const event = await regulatoryReportingService.registerReportableEvent({
				eventType,
				triggeredBy: user.id,
				userId,
				dealId,
				amount,
				currency,
				riskIndicators,
				riskScore,
				metadata,
			});

			return apiResponse.created(
				res,
				event,
				event.requiresReporting
					? `Event registered and auto-generated ${event.reportType} report`
					: "Event registered (does not require reporting)",
			);
		} catch (error: any) {
			console.error("Error registering event:", error);
			return apiResponse.serverError(res, "Failed to register event");
		}
	},
);

/**
 * GET /api/unlisted/admin/regulatory/events
 * Get reportable event queue
 */
router.get(
	"/admin/regulatory/events",
	requireAuth,
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { requiresReporting, processed } = req.query;

			const filters: any = {};
			if (requiresReporting !== undefined)
				filters.requiresReporting = requiresReporting === "true";
			if (processed !== undefined) filters.processed = processed === "true";

			const events = await regulatoryReportingService.getEventQueue(filters);
			return apiResponse.success(res, events);
		} catch (error: any) {
			console.error("Error fetching event queue:", error);
			return apiResponse.serverError(res, "Failed to fetch events");
		}
	},
);

// ===================================================================
// AI RECOMMENDATION ROUTES
// ===================================================================

import {
	aiUnlistedRecommendationService,
	type UnlistedStockAsset,
} from "../services/ai-unlisted-recommendation-service";
import { regulatoryComplianceService } from "../services/unlisted-regulatory-compliance-service";

/**
 * GET /api/unlisted/ai-recommendations
 * Get AI-powered personalized recommendations for unlisted/pre-IPO stocks
 */
router.get("/ai-recommendations", async (req: Request, res: Response) => {
	try {
		const { riskProfile, investmentHorizon, investmentGoal, investmentAmount } =
			req.query;

		// Fetch all active companies — no store-publish gate on AI picks
		const allCompanies = await storage.getAllUnlistedCompanies({
			status: "active",
		});

		// Only exclude suspended instruments; AI can recommend even without a published price
		const companies = (allCompanies as any[]).filter(
			(c: any) => !c.tradingSuspended,
		);

		if (!companies || companies.length === 0) {
			return apiResponse.success(res, {
				recommendations: [],
				summary: {
					totalRecommendations: 0,
					message: "No unlisted companies available for recommendations",
				},
			});
		}

		// Auto-publish any company not yet in the store — fire-and-forget, non-blocking
		setImmediate(async () => {
			try {
				const publishTasks = companies.map((c: any) =>
					autoPublishCompanyToStore(c),
				);
				const results = await Promise.allSettled(publishTasks);
				const published = results.filter(
					(r: any) => r.status === "fulfilled" && (r as any).value,
				).length;
				if (published > 0) {
					console.log(
						`[AutoPublish] Auto-published ${published} unlisted companies to store`,
					);
				}
			} catch (e) {
				/* non-blocking */
			}
		});

		// Pre-fetch MoneyControl prices once (6h cache) to enrich companies missing a price
		const mcPriceByIsin = new Map<string, number>();
		const mcPriceByName = new Map<string, number>();
		try {
			const mcCompanies =
				await moneyControlReconciliation.fetchAndCacheMoneyControlCompanies();
			for (const mc of mcCompanies) {
				if (mc.price > 0) {
					if (mc.isin) mcPriceByIsin.set(mc.isin.toUpperCase(), mc.price);
					mcPriceByName.set(mc.name.toLowerCase().trim(), mc.price);
				}
			}
		} catch (_) {
			/* non-blocking enrichment */
		}

		const resolveMarketPrice = (company: any): string | undefined => {
			const dbPrice =
				company.publishedBuyPrice ||
				company.draftBuyPrice ||
				company.currentPrice;
			if (dbPrice && Number.parseFloat(dbPrice) > 0) return dbPrice.toString();
			if (company.isin) {
				const byIsin = mcPriceByIsin.get(company.isin.toUpperCase());
				if (byIsin) return byIsin.toString();
			}
			const byName = mcPriceByName.get(company.name.toLowerCase().trim());
			if (byName) return byName.toString();
			return undefined;
		};

		const assets: UnlistedStockAsset[] = companies.map((company: any) => ({
			id: company.id,
			name: company.name,
			cin: company.cin,
			sector: company.sector,
			industry: company.industry,
			listingStage: company.listingStage,
			publishedBuyPrice: resolveMarketPrice(company),
			publishedSellPrice: company.publishedSellPrice?.toString(),
			paidUpCapital: company.paidUpCapital?.toString(),
			revenue: company.latestFinancials?.revenue?.toString(),
			pat: company.latestFinancials?.pat?.toString(),
			networth: company.latestFinancials?.networth?.toString(),
			peRatio: company.latestRatios?.peRatio?.toString(),
			pbRatio: company.latestRatios?.pbRatio?.toString(),
			roe: company.latestRatios?.roe?.toString(),
			debtToEquity: company.latestRatios?.debtToEquity?.toString(),
			revenueGrowth: company.latestRatios?.revenueGrowth?.toString(),
			profitGrowth: company.latestRatios?.profitGrowth?.toString(),
			complianceStatus: company.complianceStatus,
			complianceRiskScore: company.complianceRiskScore,
		}));

		const userProfile = {
			riskProfile:
				(riskProfile as "conservative" | "moderate" | "aggressive") ||
				"moderate",
			investmentHorizon: investmentHorizon as
				| "short_term"
				| "medium_term"
				| "long_term"
				| undefined,
			investmentGoal: investmentGoal as
				| "income"
				| "growth"
				| "balanced"
				| "capital_preservation"
				| undefined,
			investmentAmount: investmentAmount
				? Number.parseFloat(investmentAmount as string)
				: undefined,
		};

		const recommendations =
			await aiUnlistedRecommendationService.generatePersonalizedRecommendations(
				assets,
				userProfile,
			);

		const buySignals = recommendations.filter(
			(r: any) => r.aiSignal === "buy",
		).length;
		const safeParseFloat = (val: string | undefined): number => {
			const num = Number.parseFloat(val || "0");
			return Number.isFinite(num) ? num : 0;
		};
		const avgConfidence =
			recommendations.length > 0
				? (
						recommendations.reduce(
							(sum: any, r: any) => sum + safeParseFloat(r.aiConfidence),
							0,
						) / recommendations.length
					).toFixed(1)
				: "0";
		const avgSuitability =
			recommendations.length > 0
				? (
						recommendations.reduce(
							(sum: any, r: any) => sum + (r.suitabilityScore || 0),
							0,
						) / recommendations.length
					).toFixed(0)
				: "0";

		return apiResponse.success(res, {
			recommendations,
			summary: {
				totalRecommendations: recommendations.length,
				buySignals,
				holdSignals: recommendations.filter((r: any) => r.aiSignal === "hold")
					.length,
				avoidSignals: recommendations.filter((r: any) => r.aiSignal === "avoid")
					.length,
				avgConfidence,
				avgSuitability,
				riskProfile: userProfile.riskProfile,
				investmentGoal: userProfile.investmentGoal || "growth",
				disclaimer:
					"Unlisted/pre-IPO investments carry high risk including illiquidity and potential total loss. These recommendations are AI-generated and should not be considered as investment advice. Consult a SEBI-registered advisor.",
			},
		});
	} catch (error: any) {
		console.error("Error fetching AI recommendations:", error);
		return apiResponse.serverError(res, "Failed to fetch AI recommendations");
	}
});

// ==================== REGULATORY COMPLIANCE API ROUTES ====================

/**
 * GET /api/unlisted/admin/compliance/overview
 * Get regulatory compliance overview for admin dashboard
 */
router.get(
	"/admin/compliance/overview",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const overview =
				await regulatoryComplianceService.getComplianceOverview();
			return apiResponse.success(res, {
				message: "Regulatory compliance overview retrieved",
				data: overview,
			});
		} catch (error: any) {
			console.error("[RegCompliance] Error fetching overview:", error);
			return apiResponse.serverError(
				res,
				"Failed to fetch compliance overview",
			);
		}
	},
);

/**
 * GET /api/unlisted/admin/compliance/investor-count/:companyId
 * Get investor count for a specific company
 */
router.get(
	"/admin/compliance/investor-count/:companyId",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;
			const data =
				await regulatoryComplianceService.getInvestorCount(companyId);
			return apiResponse.success(res, {
				message: "Investor count retrieved",
				data,
			});
		} catch (error: any) {
			console.error("[RegCompliance] Error fetching investor count:", error);
			return apiResponse.serverError(res, "Failed to fetch investor count");
		}
	},
);

/**
 * GET /api/unlisted/admin/compliance/audit-trail
 * Get forensic audit trail for admin dashboard
 */
router.get(
	"/admin/compliance/audit-trail",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { unlistedRegulatoryAuditService } = await import(
				"../services/unlisted-regulatory-audit-service"
			);
			const logs = await unlistedRegulatoryAuditService.queryAuditLogs({
				limit: 50,
				complianceRelated: true,
			});

			const formattedLogs = logs.map((log) => ({
				id: log.id,
				timestamp: log.timestamp,
				action: log.action,
				userName: log.userName || "System",
				userEmail: log.userEmail || "N/A",
				companyName: log.companyName || "N/A",
				changeDescription: log.changeDescription,
				riskLevel: log.riskLevel,
				forensicHash: log.forensicHash,
				prevHash: log.prevHash,
			}));

			return apiResponse.success(res, {
				message: "Forensic audit trail retrieved",
				data: formattedLogs,
			});
		} catch (error: any) {
			console.error("[RegCompliance] Error fetching audit trail:", error);
			return apiResponse.serverError(
				res,
				"Failed to fetch forensic audit trail",
			);
		}
	},
);

/**
 * POST /api/unlisted/admin/compliance/check-investor-limit
 * Check if a transaction would exceed the 200 investor limit
 */

export default router;
