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
router.get("/companies", async (req: Request, res: Response) => {
	try {
		const { status, sector } = req.query;

		const filters: {
			status?: string;
			sector?: string;
			storePublishedOnly?: boolean;
		} = {};
		if (status && typeof status === "string") filters.status = status;
		if (sector && typeof sector === "string") filters.sector = sector;

		// Only return active companies for public browsing
		if (!filters.status) {
			filters.status = "active";
		}

		// Client browse should ONLY see store-published companies
		filters.storePublishedOnly = true;

		const companies = await storage.getAllUnlistedCompanies(filters);
		return apiResponse.success(res, companies);
	} catch (error: any) {
		console.error("Error fetching unlisted companies:", error);
		return apiResponse.serverError(res, "Failed to fetch companies");
	}
});

/**
 * GET /api/unlisted/companies/:id
 * Get detailed information about a specific company (public - no KYC required for browsing)
 * Trading and financials still require Level 2 KYC as per SEBI regulations
 */
router.get("/companies/:id", async (req: Request, res: Response) => {
	try {
		const { id } = req.params;

		const company = await storage.getUnlistedCompanyById(id);
		if (!company) {
			return apiResponse.notFound(res, "Company not found");
		}

		return apiResponse.success(res, company);
	} catch (error: any) {
		console.error("Error fetching company:", error);
		return apiResponse.serverError(res, "Failed to fetch company details");
	}
});

/**
 * GET /api/unlisted/companies/:id/data-quality
 * Get data quality information for a company (public)
 * Returns sources used, fallback status, and quality score
 */
router.get(
	"/companies/:id/data-quality",
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;

			const company = await storage.getUnlistedCompanyById(id);
			if (!company) {
				return apiResponse.notFound(res, "Company not found");
			}

			const unifiedData = await unifiedCompanyDataService.getCompanyData(id);

			if (!unifiedData) {
				return apiResponse.success(res, {
					fallbackUsed: false,
					fallbackReason: null,
					warnings: ["No data available"],
					primarySourceFailed: true,
					sourcesUsed: [],
					overallScore: 0,
				});
			}

			return apiResponse.success(res, unifiedData.dataQuality);
		} catch (error: any) {
			console.error("Error fetching data quality:", error);
			return apiResponse.serverError(res, "Failed to fetch data quality");
		}
	},
);

router.post("/companies", requireAdmin, async (req: Request, res: Response) => {
	try {
		const validatedData = insertUnlistedCompanySchema.parse(req.body);

		// Check if company with same CIN already exists
		if (validatedData.cin) {
			const existing = await storage.getUnlistedCompanyByCIN(validatedData.cin);
			if (existing) {
				return apiResponse.badRequest(
					res,
					"Company with this CIN already exists",
				);
			}
		}

		const company = await storage.createUnlistedCompany({
			...validatedData,
			createdBy: req.user.id,
		});

		return apiResponse.created(res, company, "Company created successfully");
	} catch (error: any) {
		console.error("Error creating company:", error);

		if (error instanceof z.ZodError) {
			return apiResponse.badRequest(res, "Invalid input data", error.issues);
		}

		return apiResponse.serverError(res, "Failed to create company");
	}
});

router.patch(
	"/companies/:id",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;

			// Verify company exists
			const existing = await storage.getUnlistedCompanyById(id);
			if (!existing) {
				return apiResponse.notFound(res, "Company not found");
			}

			const validatedData = insertUnlistedCompanySchema
				.partial()
				.parse(req.body);
			const updated = await storage.updateUnlistedCompany(id, validatedData);

			return apiResponse.success(res, updated, "Company updated successfully");
		} catch (error: any) {
			console.error("Error updating company:", error);

			if (error instanceof z.ZodError) {
				return apiResponse.badRequest(res, "Invalid input data", error.issues);
			}

			return apiResponse.serverError(res, "Failed to update company");
		}
	},
);

router.delete(
	"/companies/:id",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;

			const existing = await storage.getUnlistedCompanyById(id);
			if (!existing) {
				return apiResponse.notFound(res, "Company not found");
			}

			await storage.deleteUnlistedCompany(id);

			return apiResponse.success(
				res,
				{ deleted: true },
				`Company "${existing.name}" deleted successfully`,
			);
		} catch (error: any) {
			console.error("Error deleting company:", error);
			return apiResponse.serverError(res, "Failed to delete company");
		}
	},
);

// ===================================================================
// CREDHIVE INTEGRATION ROUTES
// ===================================================================

router.get(
	"/credhive/status",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const available = credhiveService.isAvailable();
			let healthy = false;
			let healthMessage = "API key not configured";
			if (available) {
				try {
					const test = await credhiveService.searchCompanies("test");
					healthy = test.success;
					healthMessage = test.success
						? "Healthy"
						: test.error || "API returned error";
				} catch (e: any) {
					healthMessage = e.message;
				}
			}
			return apiResponse.success(res, {
				provider: "credhive",
				configured: available,
				healthy,
				healthMessage,
			});
		} catch (error: any) {
			console.error("Error checking Credhive status:", error);
			return apiResponse.serverError(res, "Failed to check Credhive status");
		}
	},
);

/**
 * GET /api/unlisted/credhive/search
 * Search for companies via Credhive
 */

export default router;
