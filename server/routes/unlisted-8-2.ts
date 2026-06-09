// @ts-nocheck
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

const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.post(
	"/companies/:companyId/publish-prices",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;
			const userId = (req.user as any)?.id;
			const ipAddress = req.ip || req.socket.remoteAddress;
			const userAgent = req.get("User-Agent");

			const result = await unlistedPricingWorkflowService.publishPrices(
				companyId,
				userId,
				ipAddress,
				userAgent,
			);

			if (!result.success) {
				return apiResponse.badRequest(res, result.message);
			}

			return apiResponse.success(res, result, "Prices published successfully");
		} catch (error: any) {
			console.error("Error publishing prices:", error);
			return apiResponse.serverError(res, "Failed to publish prices");
		}
	},
);

/**
 * POST /api/unlisted/companies/:companyId/check-compliance
 * Run compliance check and update company status (Admin only)
 */
router.post(
	"/companies/:companyId/check-compliance",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;

			const result =
				await unlistedPricingWorkflowService.checkComplianceAndUpdate(
					companyId,
				);
			return apiResponse.success(res, result, "Compliance check completed");
		} catch (error: any) {
			console.error("Error checking compliance:", error);
			return apiResponse.serverError(res, "Failed to check compliance");
		}
	},
);

/**
 * POST /api/unlisted/companies/:companyId/suspend-trading
 * Suspend trading for a company (Admin only)
 */
router.post(
	"/companies/:companyId/suspend-trading",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;
			const { reason } = req.body;
			const userId = (req.user as any)?.id;
			const ipAddress = req.ip || req.socket.remoteAddress;
			const userAgent = req.get("User-Agent");

			if (!reason || typeof reason !== "string") {
				return apiResponse.badRequest(res, "reason is required");
			}

			const result = await unlistedPricingWorkflowService.suspendTrading(
				companyId,
				reason,
				userId,
				ipAddress,
				userAgent,
			);

			if (!result.success) {
				return apiResponse.badRequest(res, result.message);
			}

			return apiResponse.success(res, result, "Trading suspended successfully");
		} catch (error: any) {
			console.error("Error suspending trading:", error);
			return apiResponse.serverError(res, "Failed to suspend trading");
		}
	},
);

/**
 * POST /api/unlisted/companies/:companyId/resume-trading
 * Resume trading for a company (Admin only)
 */
router.post(
	"/companies/:companyId/resume-trading",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;
			const userId = (req.user as any)?.id;
			const ipAddress = req.ip || req.socket.remoteAddress;
			const userAgent = req.get("User-Agent");

			const result = await unlistedPricingWorkflowService.resumeTrading(
				companyId,
				userId,
				ipAddress,
				userAgent,
			);

			if (!result.success) {
				return apiResponse.badRequest(res, result.message);
			}

			return apiResponse.success(res, result, "Trading resumed successfully");
		} catch (error: any) {
			console.error("Error resuming trading:", error);
			return apiResponse.serverError(res, "Failed to resume trading");
		}
	},
);

/**
 * GET /api/unlisted/companies/:companyId/audit-log
 * Get audit log for a company (Admin only)
 */
router.get(
	"/companies/:companyId/audit-log",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;
			const limit = Number(req.query.limit) || 50;

			const logs = await unlistedPricingWorkflowService.getAuditLog(
				companyId,
				limit,
			);
			return apiResponse.success(res, logs);
		} catch (error: any) {
			console.error("Error fetching audit log:", error);
			return apiResponse.serverError(res, "Failed to fetch audit log");
		}
	},
);

// ===================================================================
// RISK DISCLOSURE ROUTES
// ===================================================================

/**
 * GET /api/unlisted/risk-disclosures
 * Get all risk disclosures for display to user
 */
router.get("/risk-disclosures", async (req: Request, res: Response) => {
	try {
		const disclosures =
			unlistedRiskDisclosureService.formatDisclosuresForDisplay();
		return apiResponse.success(res, disclosures);
	} catch (error: any) {
		console.error("Error fetching risk disclosures:", error);
		return apiResponse.serverError(res, "Failed to fetch risk disclosures");
	}
});

/**
 * GET /api/unlisted/risk-disclosures/:companyId
 * Get risk disclosures with company-specific risks
 */
router.get(
	"/risk-disclosures/:companyId",
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;

			const company = await storage.getUnlistedCompanyById(companyId);
			if (!company) {
				return apiResponse.notFound(res, "Company not found");
			}

			const financialsList = await storage.getCompanyFinancials(companyId);
			const financials =
				financialsList && financialsList.length > 0 ? financialsList[0] : null;

			const disclosures =
				unlistedRiskDisclosureService.formatDisclosuresForDisplay();
			const companySpecificRisks =
				unlistedRiskDisclosureService.getCompanySpecificRisks({
					netWorth: financials?.netWorth
						? Number.parseFloat(financials.netWorth)
						: undefined,
					debtEquityRatio: financials?.debtEquityRatio
						? Number.parseFloat(financials.debtEquityRatio)
						: undefined,
					profitMargin: financials?.profitMargin
						? Number.parseFloat(financials.profitMargin)
						: undefined,
				});

			return apiResponse.success(res, {
				...disclosures,
				companySpecificRisks,
				company: { id: company.id, name: company.name },
			});
		} catch (error: any) {
			console.error("Error fetching company risk disclosures:", error);
			return apiResponse.serverError(res, "Failed to fetch risk disclosures");
		}
	},
);

/**
 * POST /api/unlisted/risk-disclosures/acknowledge
 * Submit risk disclosure acknowledgment
 * Regulatory: Required before any unlisted securities trade
 */
router.post(
	"/risk-disclosures/acknowledge",
	requireAuth,
	requireLevel2,
	async (req: Request, res: Response) => {
		try {
			const userId = req.user?.id;
			if (!userId) {
				return apiResponse.unauthorized(res, "Authentication required");
			}

			const {
				companyId,
				tradeType,
				acknowledgedDisclosureIds,
				companySpecificRisksAcknowledged,
			} = req.body;

			if (!companyId || !tradeType || !acknowledgedDisclosureIds) {
				return apiResponse.badRequest(
					res,
					"companyId, tradeType, and acknowledgedDisclosureIds are required",
				);
			}

			if (!["buy", "sell"].includes(tradeType)) {
				return apiResponse.badRequest(res, 'tradeType must be "buy" or "sell"');
			}

			const result = await saveRiskAcknowledgment({
				userId,
				companyId,
				tradeType,
				acknowledgedDisclosureIds,
				companySpecificRisksAcknowledged,
				ipAddress: req.ip || req.socket.remoteAddress,
				userAgent: req.headers["user-agent"],
			});

			if (!result.success) {
				return apiResponse.badRequest(
					res,
					result.error || "Failed to save acknowledgment",
				);
			}

			return apiResponse.success(res, {
				acknowledged: true,
				record: result.record,
				message:
					"Risk disclosures acknowledged successfully. You may now proceed with your order.",
			});
		} catch (error: any) {
			console.error("Error saving risk disclosure acknowledgment:", error);
			return apiResponse.serverError(res, "Failed to save acknowledgment");
		}
	},
);

// ===================================================================
// ESCROW PAYMENT ROUTES
// ===================================================================

import { unlistedEscrowService } from "../services/unlisted-escrow-service";
import { ObjectStorageService } from "../objectStorage";

const objectStorage = new ObjectStorageService();

/**
 * POST /api/unlisted/deals/:dealId/initiate-payment
 * Buyer initiates escrow payment for a confirmed deal
 * Regulatory: Requires KYC Level 2 as per SEBI regulations for unlisted securities
 */

export default router;
