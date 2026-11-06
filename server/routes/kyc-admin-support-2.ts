// @ts-nocheck
/* eslint-disable */
import { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, or, desc, gte, lte, sql, count } from "drizzle-orm";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import * as schema from "../../shared/schema";
import {
	advisorySubscriptions,
	storeProductInquiries,
	storeTransactionLogs,
} from "../../shared/schema";
import { complianceMonitor } from "../compliance-monitor";
import { UPSTOX_ETFS_CATALOG } from "../data/upstox-etfs-catalog";
import {
	UPSTOX_COMMODITIES_CATALOG,
	SOVEREIGN_GOLD_BONDS,
} from "../data/upstox-commodities-catalog";
import {
	TOP_INDIAN_EQUITIES,
	TOP_FIXED_INCOME_SECURITIES,
	TOP_NPS_PENSION_SCHEMES,
	TOP_SIF_SCHEMES,
	TOP_CURATED_MUTUAL_FUNDS,
	TOP_FIXED_DEPOSITS,
	TOP_US_EQUITIES,
} from "../data/store-instruments-catalog";

export function registerKYCAdminSupporPart2Routes(app: Express): void {
	app.post(
		"/api/admin/kyc/manual-submissions/:id/review",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { id } = req.params;
				const { status, notes, rejectionReason } = req.body;

				if (
					!["approved", "rejected", "requires_clarification"].includes(status)
				) {
					return res.status(400).json({ message: "Invalid status" });
				}

				const updated = await storage.reviewManualKycSubmission(
					id,
					req.user!.id,
					status,
					notes,
					rejectionReason,
				);

				if (!updated) {
					return res.status(404).json({ message: "Submission not found" });
				}

				// Log compliance event
				complianceMonitor.logEvent({
					userId: req.user!.id,
					eventType: "admin_action" as any,
					category: "kyc_compliance",
					action: `Manual KYC ${status}`,
					resource: `/api/admin/kyc/manual-submissions/${id}/review`,
					status: "success",
					metadata: {
						submissionId: id,
						reviewStatus: status,
						reviewedBy: req.user!.id,
					},
				});

				res.json({
					success: true,
					message: `Submission ${status} successfully`,
					submission: updated,
				});
			} catch (error) {
				console.error("Error reviewing manual KYC submission:", error);
				res.status(500).json({ message: "Failed to review submission" });
			}
		},
	);

	// Batch KYC approval endpoint
	app.post(
		"/api/admin/kyc/batch-approve",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { ids, notes } = req.body;

				if (!ids || !Array.isArray(ids) || ids.length === 0) {
					return res
						.status(400)
						.json({ message: "No submission IDs provided" });
				}

				const results = { success: [] as string[], failed: [] as string[] };

				for (const id of ids) {
					try {
						const updated = await storage.reviewManualKycSubmission(
							id,
							req.user!.id,
							"approved",
							notes || "Batch approved",
							null,
						);
						if (updated) {
							results.success.push(id);
						} else {
							results.failed.push(id);
						}
					} catch (err) {
						results.failed.push(id);
					}
				}

				const logStatus =
					results.failed.length === 0
						? "success"
						: results.success.length === 0
							? "failure"
							: "partial_success";

				complianceMonitor.logEvent({
					userId: req.user!.id,
					eventType: "admin_action" as any,
					category: "kyc_compliance",
					action: "Batch KYC Approval",
					resource: "/api/admin/kyc/batch-approve",
					status: logStatus,
					metadata: {
						approvedCount: results.success.length,
						failedCount: results.failed.length,
						successIds: results.success,
						failedIds: results.failed,
					},
				});

				const allFailed = results.success.length === 0;
				res.status(allFailed ? 400 : 200).json({
					success: !allFailed,
					message: allFailed
						? "All submissions failed to approve"
						: `Batch approved ${results.success.length} submissions${results.failed.length > 0 ? `, ${results.failed.length} failed` : ""}`,
					results,
				});
			} catch (error) {
				console.error("Error batch approving KYC:", error);
				res.status(500).json({ message: "Failed to batch approve" });
			}
		},
	);

	// Batch KYC rejection endpoint
	app.post(
		"/api/admin/kyc/batch-reject",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { ids, reason } = req.body;

				if (!ids || !Array.isArray(ids) || ids.length === 0) {
					return res
						.status(400)
						.json({ message: "No submission IDs provided" });
				}

				if (!reason) {
					return res
						.status(400)
						.json({ message: "Rejection reason is required" });
				}

				const results = { success: [] as string[], failed: [] as string[] };

				for (const id of ids) {
					try {
						const updated = await storage.reviewManualKycSubmission(
							id,
							req.user!.id,
							"rejected",
							null,
							reason,
						);
						if (updated) {
							results.success.push(id);
						} else {
							results.failed.push(id);
						}
					} catch (err) {
						results.failed.push(id);
					}
				}

				const logStatus =
					results.failed.length === 0
						? "success"
						: results.success.length === 0
							? "failure"
							: "partial_success";

				complianceMonitor.logEvent({
					userId: req.user!.id,
					eventType: "admin_action" as any,
					category: "kyc_compliance",
					action: "Batch KYC Rejection",
					resource: "/api/admin/kyc/batch-reject",
					status: logStatus,
					metadata: {
						rejectedCount: results.success.length,
						failedCount: results.failed.length,
						reason,
						successIds: results.success,
						failedIds: results.failed,
					},
				});

				const allFailed = results.success.length === 0;
				res.status(allFailed ? 400 : 200).json({
					success: !allFailed,
					message: allFailed
						? "All submissions failed to reject"
						: `Batch rejected ${results.success.length} submissions${results.failed.length > 0 ? `, ${results.failed.length} failed` : ""}`,
					results,
				});
			} catch (error) {
				console.error("Error batch rejecting KYC:", error);
				res.status(500).json({ message: "Failed to batch reject" });
			}
		},
	);

	// Batch export KYC data
	app.post(
		"/api/admin/kyc/batch-export",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { ids, format = "json" } = req.body;

				if (!ids || !Array.isArray(ids) || ids.length === 0) {
					return res
						.status(400)
						.json({ message: "No submission IDs provided" });
				}

				const submissions = await storage.getManualKycSubmission({
					status: "all",
					limit: 1000,
				});
				const selectedSubmissions = submissions.filter((s: any) =>
					ids.includes(s.id),
				);

				if (format === "csv") {
					const headers = [
						"ID",
						"User",
						"Email",
						"Type",
						"Tier",
						"Status",
						"Submitted At",
					];
					const rows = selectedSubmissions.map((s: any) => [
						s.id,
						s.userName || "N/A",
						s.userEmail || "N/A",
						s.applicantType || "N/A",
						s.tier || "N/A",
						s.status || "N/A",
						s.createdAt || "N/A",
					]);
					const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join(
						"\n",
					);

					res.setHeader("Content-Type", "text/csv");
					res.setHeader(
						"Content-Disposition",
						"attachment; filename=kyc_export.csv",
					);
					return res.send(csv);
				}

				res.json({
					success: true,
					data: selectedSubmissions,
					count: selectedSubmissions.length,
				});
			} catch (error) {
				console.error("Error batch exporting KYC:", error);
				res.status(500).json({ message: "Failed to export" });
			}
		},
	);

	// ===================================================================
	// PUBLIC STORE ROUTES (Client-facing - No Auth Required)
	// ===================================================================

	// Get active store categories for client store page (includes PMS/AIF)
	app.get("/api/store/categories", async (req, res) => {
		try {
			const allCategories = await storage.getAllStoreCategories();
			const allSubcategories = await storage.getAllStoreSubcategories();

			// Add virtual PMS and AIF categories if not already in store categories
			const categoryNames = new Set(
				allCategories.map((c) => c.name.toLowerCase()),
			);
			const virtualCategories: any[] = [];

			if (
				!categoryNames.has("pms") &&
				!categoryNames.has("portfolio management services")
			) {
				virtualCategories.push({
					id: "virtual-pms",
					name: "Portfolio Management Services (PMS)",
					slug: "pms",
					description: "SEBI-registered discretionary portfolio management",
					icon: "Briefcase",
					displayOrder: 100,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					subcategories: [],
				});
			}

			if (
				!categoryNames.has("aif") &&
				!categoryNames.has("alternative investment funds")
			) {
				virtualCategories.push({
					id: "virtual-aif",
					name: "Alternative Investment Funds (AIF)",
					slug: "aif",
					description: "SEBI-regulated alternative investment vehicles",
					icon: "Crown",
					displayOrder: 101,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					subcategories: [],
				});
			}

			// ── Virtual: Exchange Traded Funds (ETFs) (Upstox Live NSE/BSE) ─────────
			if (
				!categoryNames.has("etfs") &&
				!categoryNames.has("exchange traded funds") &&
				!categoryNames.has("exchange traded funds (etfs)")
			) {
				virtualCategories.push({
					id: "virtual-etfs",
					name: "Exchange Traded Funds (ETFs)",
					slug: "etfs",
					description:
						"Live exchange-traded index, sectoral, commodity & debt ETFs via Upstox",
					icon: "Zap",
					displayOrder: 2,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					providerSource: "UPSTOX",
					subcategories: [
						{
							id: "etf-index",
							name: "Index ETFs",
							description: "Nifty 50, Bank Nifty & Next 50 core trackers",
						},
						{
							id: "etf-gold-silver",
							name: "Gold & Silver ETFs",
							description: "Physical bullion backed precious metal funds",
						},
						{
							id: "etf-sectoral",
							name: "Sectoral & Thematic ETFs",
							description: "IT, Pharma, Auto, Infra & CPSE themes",
						},
						{
							id: "etf-global-debt",
							name: "Global & Debt ETFs",
							description: "Nasdaq 100, Liquid BeES & G-Sec debt ETFs",
						},
					],
				});
			}

			// ── Virtual: IRIS Mutual Funds (live KFintech schemes) ──────────────────
			if (
				!categoryNames.has("mutual funds") &&
				!categoryNames.has("iris mutual funds")
			) {
				virtualCategories.push({
					id: "virtual-iris-mf",
					name: "Mutual Funds",
					slug: "mutual-funds",
					description:
						"Live mutual fund schemes via IRIS KFintech & AMFI — top performers & NFOs",
					icon: "TrendingUp",
					displayOrder: 3,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					providerSource: "IRIS",
					subcategories: [
						{
							id: "iris-mf-top",
							name: "Top Performers",
							description: "Highest 1Y & 3Y risk-adjusted returns",
						},
						{
							id: "iris-mf-nfo",
							name: "New Fund Offers",
							description: "Currently open for subscription",
						},
					],
				});
			}

			// ── Virtual: National Pension System (NPS) ───────────────────────────────
			if (
				!categoryNames.has("nps") &&
				!categoryNames.has("national pension system") &&
				!categoryNames.has("national pension system (nps)")
			) {
				virtualCategories.push({
					id: "virtual-nps",
					name: "National Pension System (NPS)",
					slug: "nps",
					description:
						"PFRDA-regulated Tier I & Tier II pension funds with Section 80CCD tax benefits",
					icon: "Award",
					displayOrder: 9,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					providerSource: "IRIS",
					subcategories: [
						{
							id: "nps-tier1",
							name: "Tier I (Retirement)",
							description: "Mandatory pension account with tax exemptions",
						},
						{
							id: "nps-tier2",
							name: "Tier II (Voluntary)",
							description: "Flexible withdrawable investment account",
						},
					],
				});
			}

			// ── Virtual: Specialised Investment Funds (SIF) ──────────────────────────
			if (
				!categoryNames.has("sif") &&
				!categoryNames.has("specialised investment funds") &&
				!categoryNames.has("specialised investment funds (sif)")
			) {
				virtualCategories.push({
					id: "virtual-sif",
					name: "Specialised Investment Funds (SIF)",
					slug: "sif",
					description:
						"SEBI-regulated specialised investment vehicles for infrastructure, defence & credit",
					icon: "Target",
					displayOrder: 10,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					providerSource: "IRIS",
					subcategories: [
						{
							id: "sif-infra",
							name: "Infrastructure SIF",
							description: "National core energy and transport corridors",
						},
						{
							id: "sif-defence",
							name: "Strategic Defence SIF",
							description: "Make-in-India aerospace & precision tech",
						},
						{
							id: "sif-preipo",
							name: "Special Situations & Pre-IPO",
							description: "Late-stage structured growth capital",
						},
					],
				});
			}

			// ── Virtual: Alpaca US Equities & ETFs ───────────────────────────────────
			if (
				!categoryNames.has("us equities") &&
				!categoryNames.has("us equities & etfs")
			) {
				virtualCategories.push({
					id: "virtual-alpaca-us",
					name: "US Equities & ETFs",
					slug: "us-equities",
					description: "US stocks, index ETFs & fractional shares via Alpaca (LRS route)",
					icon: "Globe",
					displayOrder: 50,
					isActive: true,
					isEnabled: true,
					comingSoonMessage: null,
					providerSource: "ALPACA",
					subcategories: [
						{
							id: "alpaca-etf",
							name: "Index ETFs",
							description: "Broad market index funds (S&P 500, Nasdaq-100)",
						},
						{
							id: "alpaca-stock",
							name: "US Stocks",
							description: "Flagship megacap technology & bluechip equities",
						},
					],
				});
			}

			// Combine real and virtual categories
			const combinedCategories = [...allCategories, ...virtualCategories];

			// Build response with Coming Soon info for disabled categories
			const categoriesWithSubs = combinedCategories.map((cat) => ({
				id: cat.id,
				name: cat.name,
				slug: cat.slug,
				description: cat.description,
				icon: cat.icon,
				displayOrder: cat.displayOrder,
				isActive: cat.isActive,
				isEnabled: cat.isEnabled !== false, // Default to enabled
				comingSoonMessage: cat.comingSoonMessage,
				comingSoonExpectedDate: cat.comingSoonExpectedDate,
				subcategories: allSubcategories
					.filter((sub) => sub.categoryId === cat.id && sub.isActive)
					.map((sub) => ({
						id: sub.id,
						name: sub.name,
						description: sub.description,
						icon: sub.icon,
						displayOrder: sub.displayOrder,
					})),
			}));

			// Sort by display order
			categoriesWithSubs.sort(
				(a, b) => (a.displayOrder || 0) - (b.displayOrder || 0),
			);

			res.json({
				success: true,
				categories: categoriesWithSubs,
			});
		} catch (error) {
			console.error("Error fetching public store categories:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch categories" });
		}
	});

	// Get active store products for client store page
	app.get("/api/store/products", async (req: any, res: any) => {
		try {
			const { category, subcategory } = req.query;

			const allProducts = await storage.getAllStoreProducts();
			const allCategories = await storage.getAllStoreCategories();
			const allSubcategories = await storage.getAllStoreSubcategories();

			// Build lookup maps for active status
			const activeCategoryIds = new Set(
				allCategories.filter((c) => c.isActive).map((c) => c.id),
			);
			const activeSubcategoryIds = new Set(
				allSubcategories.filter((s) => s.isActive).map((s) => s.id),
			);

			// Filter to only active products with active parents
			let activeProducts = allProducts.filter((product) => {
				if (!product.isActive) return false;
				if (!activeCategoryIds.has(product.categoryId)) return false;
				if (
					product.subcategoryId &&
					!activeSubcategoryIds.has(product.subcategoryId)
				)
					return false;
				return true;
			});

			// Apply optional filters
			if (category) {
				activeProducts = activeProducts.filter(
					(p) => p.categoryId === category,
				);
			}
			if (subcategory) {
				activeProducts = activeProducts.filter(
					(p) => p.subcategoryId === subcategory,
				);
			}

			// Visibility gating for Direct funds based on advisory subscription
			let hasDirectFundsAccess = false;
			if (req.user?.id) {
				try {
					const userAdvisory = await db
						.select()
						.from(advisorySubscriptions)
						.where(
							and(
								eq(advisorySubscriptions.userId, req.user!.id),
								eq(advisorySubscriptions.status, "active"),
							),
						)
						.limit(1);
					hasDirectFundsAccess =
						userAdvisory.length > 0 && userAdvisory[0]?.directFundsAccess;
				} catch (e: any) {
					console.error("Error checking advisory subscription:", e);
				}
			}

			// Filter out Direct funds for users without advisory subscription
			if (!hasDirectFundsAccess) {
				activeProducts = activeProducts.filter((p) => p.planType !== "direct");
			}

			// Get category and subcategory names for each product
			const categoryMap = Object.fromEntries(
				allCategories.map((c) => [c.id, c.name]),
			);
			const subcategoryMap = Object.fromEntries(
				allSubcategories.map((s) => [s.id, s.name]),
			);

			const productsWithNames = activeProducts.map((product) => ({
				...product,
				categoryName: categoryMap[product.categoryId] || product.categoryId,
				subcategoryName: product.subcategoryId
					? subcategoryMap[product.subcategoryId] || product.subcategoryId
					: null,
			}));

			// Merge AIF and PMS products from master tables
			let mergedProducts = [...productsWithNames];

			// Add AIF products if AIF category is requested or all products
			if (!category || category === "aif" || category === "AIF") {
				try {
					const aifProducts = await db
						.select()
						.from(schema.aifMaster)
						.where(
							and(
								eq(schema.aifMaster.fundStatus, "active"),
								eq(schema.aifMaster.isPublished, true),
							),
						);
					const aifMerged = aifProducts.map((aif) => ({
						id: `aif-${aif.id}`,
						name: aif.name,
						shortDescription: aif.description || aif.investmentObjective || "",
						description: aif.description,
						categoryId: "aif",
						categoryName: "AIF",
						subcategoryId: aif.category?.toLowerCase() || "category-iii",
						subcategoryName: aif.category || "Category III",
						productType: "aif",
						planType: "regular",
						provider: aif.fundHouseName || aif.sponsor || "",
						minimumInvestment:
							Number.parseFloat(aif.minInvestment?.toString() || "0") ||
							10000000,
						expectedReturns: Number.parseFloat(aif.return1Y?.toString() || "0"),
						riskLevel:
							aif.riskScore && aif.riskScore >= 7 ? "high" : "moderate",
						features: [],
						isActive: true,
						isFeatured: false,
						isPremium: true,
						kycProductCode: "ACCREDITED_AIF",
						sourceTable: "aif_master",
						sourceId: aif.id,
					}));
					mergedProducts = [...mergedProducts, ...aifMerged];
				} catch (e) {
					console.warn("[Store Products] Error fetching AIF products:", e);
				}
			}

			// Add PMS products if PMS category is requested or all products
			if (!category || category === "pms" || category === "PMS") {
				try {
					const pmsProducts = await db
						.select()
						.from(schema.pmsMaster)
						.where(
							and(
								eq(schema.pmsMaster.fundStatus, "active"),
								eq(schema.pmsMaster.isPublished, true),
							),
						);
					const pmsMerged = pmsProducts.map((pms) => ({
						id: `pms-${pms.id}`,
						name: pms.name,
						shortDescription: pms.strategy || pms.description || "",
						description: pms.description,
						categoryId: "pms",
						categoryName: "PMS",
						subcategoryId: pms.strategy?.toLowerCase() || "discretionary",
						subcategoryName: pms.strategy || "Discretionary",
						productType: "pms",
						planType: "regular",
						provider: pms.fundHouseName || pms.sponsor || "",
						minimumInvestment:
							Number.parseFloat(pms.minInvestment?.toString() || "0") ||
							5000000,
						expectedReturns: Number.parseFloat(pms.return1Y?.toString() || "0"),
						riskLevel:
							pms.riskScore && pms.riskScore >= 7 ? "high" : "moderate",
						features: [],
						isActive: true,
						isFeatured: false,
						isPremium: true,
						kycProductCode: "ENHANCED_PMS",
						sourceTable: "pms_master",
						sourceId: pms.id,
					}));
					mergedProducts = [...mergedProducts, ...pmsMerged];
				} catch (e) {
					console.warn("[Store Products] Error fetching PMS products:", e);
				}
			}

			// ── IRIS Mutual Funds: Top Performers ────────────────────────────────────
			try {
				const { irisKfintechService } = await import(
					"../services/iris-kfintech-service"
				);
				if (
					irisKfintechService.isConfigured &&
					(!category ||
						[
							"mutual-funds",
							"mutual_funds",
							"Mutual Funds",
							"virtual-iris-mf",
						].includes(category as string))
				) {
					const topSchemes: any = await irisKfintechService
						.getTopPerformingSchemes({ limit: 20 })
						.catch(() => ({ schemes: [] }));
					const schemes: any[] = Array.isArray(topSchemes)
						? topSchemes
						: topSchemes?.schemes ?? [];
					const irisMfProducts = schemes.map((s: any) => ({
						id: `iris-mf-${s.schemeCode ?? s.code ?? s.isin ?? Math.random()}`,
						name: s.schemeName ?? s.name ?? "Mutual Fund Scheme",
						shortDescription:
							`${s.category ?? ""} • ${s.subCategory ?? ""} • ${s.amcName ?? ""}`.replace(
								/^[• ]+|[• ]+$/g,
								"",
							),
						description: s.investmentObjective ?? s.schemeName,
						categoryId: "virtual-iris-mf",
						categoryName: "Mutual Funds",
						subcategoryId: "iris-mf-top",
						subcategoryName: "Top Performers",
						productType: "mutual_fund",
						planType: (s.planType ?? "").toLowerCase().includes("direct")
							? "direct"
							: "regular",
						provider: s.amcName ?? s.fundHouse ?? "KFintech",
						minimumInvestment:
							Number.parseFloat(
								s.minSipAmount ?? s.minPurchaseAmount ?? "500",
							) || 500,
						expectedReturns:
							Number.parseFloat(s.return1Y ?? s.returns1Y ?? "0") || 0,
						riskLevel:
							s.riskometer ??
							(s.riskScore >= 5 ? "high" : s.riskScore >= 3 ? "medium" : "low"),
						features: [s.category, s.subCategory].filter(Boolean),
						isActive: true,
						isFeatured: true,
						isPremium: false,
						isNew: false,
						badge: undefined,
						kycProductCode: "BASIC_MF",
						sourceTable: "iris_live",
						sourceId: s.schemeCode ?? s.code,
						providerSource: "IRIS" as const,
						providerProductId: s.schemeCode ?? s.isin,
					}));
					mergedProducts = [...mergedProducts, ...irisMfProducts];
				}
			} catch (e) {
				console.warn(
					"[Store Products] IRIS top-performing MF fetch failed (non-fatal):",
					e,
				);
			}

			// ── IRIS NFO (New Fund Offers) ────────────────────────────────────────────
			try {
				const { irisKfintechService } = await import(
					"../services/iris-kfintech-service"
				);
				if (
					irisKfintechService.isConfigured &&
					(!category ||
						["mutual-funds", "virtual-iris-mf"].includes(category as string))
				) {
					const nfoData: any = await irisKfintechService
						.getNfoSchemes()
						.catch(() => []);
					const nfoSchemes: any[] = Array.isArray(nfoData)
						? nfoData
						: nfoData?.schemes ?? nfoData?.nfos ?? [];
					const irisNfoProducts = nfoSchemes.map((nfo: any) => ({
						id: `iris-nfo-${nfo.schemeCode ?? nfo.code ?? Math.random()}`,
						name: nfo.schemeName ?? nfo.name ?? "New Fund Offer",
						shortDescription:
							`NFO • ${nfo.amcName ?? ""} • Open: ${nfo.openDate ?? ""} – ${nfo.closeDate ?? ""}`.replace(
								/[•\s]+$/g,
								"",
							),
						categoryId: "virtual-iris-mf",
						categoryName: "Mutual Funds",
						subcategoryId: "iris-mf-nfo",
						subcategoryName: "New Fund Offers",
						productType: "nfo",
						planType: "regular",
						provider: nfo.amcName ?? "KFintech",
						minimumInvestment:
							Number.parseFloat(nfo.minPurchaseAmount ?? "5000") || 5000,
						expectedReturns: 0,
						riskLevel: "medium",
						features: ["New Fund Offer", nfo.category].filter(Boolean),
						isActive: true,
						isFeatured: false,
						isPremium: false,
						isNew: true,
						badge: "NEW",
						kycProductCode: "BASIC_MF",
						sourceTable: "iris_live",
						sourceId: nfo.schemeCode ?? nfo.code,
						providerSource: "IRIS" as const,
						providerProductId: nfo.schemeCode ?? nfo.isin,
					}));
					mergedProducts = [...mergedProducts, ...irisNfoProducts];
				}
			} catch (e) {
				console.warn("[Store Products] IRIS NFO fetch failed (non-fatal):", e);
			}

			// ── IRIS Fixed Deposits ───────────────────────────────────────────────────
			try {
				const { irisKfintechService } = await import(
					"../services/iris-kfintech-service"
				);
				if (
					irisKfintechService.isConfigured &&
					(!category ||
						["fixed-deposits", "fixed_deposits", "Fixed Deposits"].includes(
							category as string,
						))
				) {
					const fdData: any = await irisKfintechService
						.getFixedDepositProducts()
						.catch(() => []);
					const fds: any[] = Array.isArray(fdData)
						? fdData
						: fdData?.products ?? fdData?.data ?? [];
					const irisFdProducts = fds.map((fd: any) => ({
						id: `iris-fd-${fd.productId ?? fd.id ?? Math.random()}`,
						name: fd.productName ?? fd.name ?? "Fixed Deposit",
						shortDescription:
							`${fd.issuerName ?? ""} FD • ${fd.tenure ?? ""} • ${fd.interestRate ?? ""}% p.a.`.replace(
								/^[•\s]+|[•\s]+$/g,
								"",
							),
						categoryId: "fixed-deposits",
						categoryName: "Fixed Deposits",
						subcategoryId: undefined,
						subcategoryName: undefined,
						productType: "fixed_deposit",
						planType: "regular",
						provider: fd.issuerName ?? fd.companyName ?? "KFintech",
						minimumInvestment:
							Number.parseFloat(fd.minimumDeposit ?? fd.minAmount ?? "10000") ||
							10000,
						expectedReturns:
							Number.parseFloat(fd.interestRate ?? fd.rate ?? "0") || 0,
						riskLevel: "low",
						features: [fd.tenure, `${fd.interestRate}% p.a.`, fd.fdType].filter(
							Boolean,
						),
						isActive: true,
						isFeatured: false,
						isPremium: false,
						isNew: false,
						kycProductCode: "BASIC_MF",
						sourceTable: "iris_live",
						sourceId: fd.productId ?? fd.id,
						providerSource: "IRIS" as const,
						providerProductId: fd.productId ?? fd.isin,
					}));
					mergedProducts = [...mergedProducts, ...irisFdProducts];
				}
			} catch (e) {
				console.warn(
					"[Store Products] IRIS Fixed Deposit fetch failed (non-fatal):",
					e,
				);
			}

			// ── Alpaca Curated US Equities & ETFs ─────────────────────────────────────
			// Curated list: flagship index ETFs + large-cap US stocks accessible to
			// Indian investors via the LRS (Liberalised Remittance Scheme) route.
			const ALPACA_CURATED_SYMBOLS = [
				// Index ETFs
				{
					symbol: "SPY",
					name: "SPDR S&P 500 ETF Trust",
					subcategoryId: "alpaca-etf",
					returns: 14.2,
					minUSD: 1,
				},
				{
					symbol: "QQQ",
					name: "Invesco QQQ (NASDAQ-100)",
					subcategoryId: "alpaca-etf",
					returns: 18.5,
					minUSD: 1,
				},
				{
					symbol: "VTI",
					name: "Vanguard Total Stock Market ETF",
					subcategoryId: "alpaca-etf",
					returns: 13.8,
					minUSD: 1,
				},
				{
					symbol: "IVV",
					name: "iShares Core S&P 500 ETF",
					subcategoryId: "alpaca-etf",
					returns: 14.1,
					minUSD: 1,
				},
				{
					symbol: "VOO",
					name: "Vanguard S&P 500 ETF",
					subcategoryId: "alpaca-etf",
					returns: 14.0,
					minUSD: 1,
				},
				{
					symbol: "VEA",
					name: "Vanguard FTSE Developed ETF",
					subcategoryId: "alpaca-etf",
					returns: 9.3,
					minUSD: 1,
				},
				{
					symbol: "GLD",
					name: "SPDR Gold Shares ETF",
					subcategoryId: "alpaca-etf",
					returns: 8.5,
					minUSD: 1,
				},
				{
					symbol: "ARKK",
					name: "ARK Innovation ETF",
					subcategoryId: "alpaca-etf",
					returns: 12.0,
					minUSD: 1,
				},
				// Large-cap US Stocks
				{
					symbol: "AAPL",
					name: "Apple Inc.",
					subcategoryId: "alpaca-stock",
					returns: 22.3,
					minUSD: 1,
				},
				{
					symbol: "MSFT",
					name: "Microsoft Corporation",
					subcategoryId: "alpaca-stock",
					returns: 25.1,
					minUSD: 1,
				},
				{
					symbol: "GOOGL",
					name: "Alphabet Inc. (Google)",
					subcategoryId: "alpaca-stock",
					returns: 19.8,
					minUSD: 1,
				},
				{
					symbol: "AMZN",
					name: "Amazon.com Inc.",
					subcategoryId: "alpaca-stock",
					returns: 21.0,
					minUSD: 1,
				},
				{
					symbol: "NVDA",
					name: "NVIDIA Corporation",
					subcategoryId: "alpaca-stock",
					returns: 65.0,
					minUSD: 1,
				},
				{
					symbol: "META",
					name: "Meta Platforms Inc.",
					subcategoryId: "alpaca-stock",
					returns: 38.0,
					minUSD: 1,
				},
				{
					symbol: "TSLA",
					name: "Tesla Inc.",
					subcategoryId: "alpaca-stock",
					returns: 18.0,
					minUSD: 1,
				},
				{
					symbol: "BRKA",
					name: "Berkshire Hathaway Inc.",
					subcategoryId: "alpaca-stock",
					returns: 12.0,
					minUSD: 1,
				},
			];
			try {
				if (
					!category ||
					[
						"us-equities",
						"US Equities & ETFs",
						"virtual-alpaca-us",
						"cat-global",
						"global-products",
						"Global Products",
					].includes(category as string)
				) {
					// Fallback to ₹84 USD/INR
					const usdInr = 84;

					const alpacaProducts = ALPACA_CURATED_SYMBOLS.map((asset) => ({
						id: `alpaca-${asset.symbol.toLowerCase()}`,
						name: asset.name,
						shortDescription: `${asset.symbol} • Listed on US markets • Fractional shares available via LRS`,
						description: `${asset.name} (${asset.symbol}) listed on US exchanges. Available for fractional share investments via RBI Liberalised Remittance Scheme (LRS).`,
						categoryId: "virtual-alpaca-us",
						categoryName: "US Equities & ETFs",
						subcategoryId: asset.subcategoryId,
						subcategoryName:
							asset.subcategoryId === "alpaca-etf" ? "Index ETFs" : "US Stocks",
						productType:
							asset.subcategoryId === "alpaca-etf" ? "etf" : "us_equity",
						planType: "regular",
						provider: "Alpaca",
						minimumInvestment: Math.ceil(asset.minUSD * usdInr), // ₹84 minimum (fractional)
						expectedReturns: asset.returns,
						riskLevel: "high",
						features: [
							"Fractional shares",
							"US market access",
							"LRS route",
							"Real-time pricing",
						],
						isActive: true,
						isFeatured: ["SPY", "QQQ", "AAPL", "MSFT", "NVDA"].includes(
							asset.symbol,
						),
						isPremium: false,
						isNew: false,
						badge: ["NVDA", "META"].includes(asset.symbol) ? "HOT" : undefined,
						kycProductCode: "ENHANCED_PMS", // US equities require enhanced KYC
						sourceTable: "alpaca_live",
						sourceId: asset.symbol,
						providerSource: "ALPACA" as const,
						providerProductId: asset.symbol,
					}));
					mergedProducts = [...mergedProducts, ...alpacaProducts];
				}
			} catch (e) {
				console.warn(
					"[Store Products] Alpaca product merge failed (non-fatal):",
					e,
				);
			}

			// ── Upstox Exchange Traded Funds (ETFs) ──────────────────────────────
			try {
				if (
					!category ||
					[
						"etfs",
						"virtual-etfs",
						"Exchange Traded Funds (ETFs)",
						"cat-gold",
						"gold",
						"Gold & Commodities",
					].includes(category as string)
				) {
					const etfProducts = UPSTOX_ETFS_CATALOG.map((etf) => {
						const isGoldOrSilver =
							etf.subType === "commodity" ||
							etf.category.toLowerCase().includes("gold") ||
							etf.category.toLowerCase().includes("silver");
						const catName =
							isGoldOrSilver &&
							(category === "cat-gold" ||
								category === "gold" ||
								category === "Gold & Commodities")
								? "Gold & Commodities"
								: "Exchange Traded Funds (ETFs)";
						const catId =
							catName === "Gold & Commodities" ? "cat-gold" : "virtual-etfs";

						return {
							id: `etf-${etf.symbol.toLowerCase()}`,
							name: etf.name,
							shortDescription: `${etf.symbol} • ${etf.category} • TER: ${
								etf.expenseRatio
									? (etf.expenseRatio * 100).toFixed(2) + "%"
									: "0.05%"
							} • Live on ${etf.exchange}`,
							description: `${etf.name} (${etf.symbol}) tracking ${etf.category}. Issued by ${etf.issuer}. Traded on ${etf.exchange} under Upstox key ${etf.upstoxInstrumentKey}.`,
							categoryId: catId,
							categoryName: catName,
							subcategoryId: isGoldOrSilver
								? "etf-gold-silver"
								: etf.subType === "equity_index"
									? "etf-index"
									: "etf-sectoral",
							subcategoryName: isGoldOrSilver
								? "Gold & Silver ETFs"
								: etf.subType === "equity_index"
									? "Index ETFs"
									: "Sectoral ETFs",
							productType: "etf",
							planType: "regular",
							provider: etf.issuer,
							minimumInvestment: Math.ceil(etf.basePrice || 100),
							expectedReturns: isGoldOrSilver ? 13.5 : 15.2,
							riskLevel: isGoldOrSilver ? "medium" : "high",
							features: [
								`Live Quote: ₹${etf.basePrice}`,
								`Expense Ratio: ${
									etf.expenseRatio
										? (etf.expenseRatio * 100).toFixed(2) + "%"
										: "0.05%"
								}`,
								`Exchange: ${etf.exchange}`,
								`ISIN: ${etf.isin}`,
							],
							isActive: true,
							isFeatured: [
								"NIFTYBEES",
								"GOLDBEES",
								"BANKBEES",
								"SILVERBEES",
								"ITBEES",
								"MON100",
							].includes(etf.symbol),
							isPremium: false,
							isNew: false,
							badge: ["NIFTYBEES", "GOLDBEES"].includes(etf.symbol)
								? "POPULAR"
								: undefined,
							kycProductCode: "BASIC_MF",
							sourceTable: "upstox_etfs",
							sourceId: etf.symbol,
							providerSource: "UPSTOX" as const,
							providerProductId: etf.upstoxInstrumentKey,
						};
					});
					mergedProducts = [...mergedProducts, ...etfProducts];
				}
			} catch (e) {
				console.warn("[Store Products] Upstox ETF merge failed:", e);
			}

			// ── MCX Commodities & Sovereign Gold Bonds ───────────────────────────
			try {
				if (
					!category ||
					[
						"cat-gold",
						"gold",
						"Gold & Commodities",
						"cat-fixed-income",
						"fixed-income",
						"Fixed Income",
					].includes(category as string)
				) {
					const commodityProducts = UPSTOX_COMMODITIES_CATALOG.map((c) => ({
						id: `mcx-${c.symbol.toLowerCase()}`,
						name: c.name,
						shortDescription: `${c.shortName} • Lot: ${c.lotSize} ${c.unit} • Traded on ${c.exchange} • Base: ₹${c.basePrice}`,
						description:
							c.description ||
							`${c.name} (${c.tradingSymbol}) on MCX. Lot size: ${c.lotSize} ${c.unit}. Upstox key: ${c.upstoxInstrumentKey}`,
						categoryId: "cat-gold",
						categoryName: "Gold & Commodities",
						subcategoryId: "commodities-mcx",
						subcategoryName: "MCX Bullion & Energy",
						productType: "commodity",
						planType: "regular",
						provider: "MCX / Upstox",
						minimumInvestment: Math.ceil(
							c.basePrice * (c.lotSize > 1 ? Math.min(c.lotSize, 10) : 1),
						),
						expectedReturns:
							c.symbol === "GOLD" ? 14.5 : c.symbol === "SILVER" ? 16.0 : 12.0,
						riskLevel: "high",
						features: [
							`MCX Exchange Lot: ${c.lotSize} ${c.unit}`,
							`Live Pricing: ₹${c.basePrice}/${c.unit}`,
							"SEBI & FMC Regulated",
							`Token: ${c.upstoxInstrumentKey}`,
						],
						isActive: true,
						isFeatured: ["GOLD", "SILVER", "CRUDEOIL"].includes(c.symbol),
						isPremium: true,
						isNew: false,
						badge: c.symbol === "GOLD" ? "HOT" : undefined,
						kycProductCode: "DERIVATIVES_FO",
						sourceTable: "upstox_commodities",
						sourceId: c.symbol,
						providerSource: "UPSTOX" as const,
						providerProductId: c.upstoxInstrumentKey,
					}));

					const sgbProducts = SOVEREIGN_GOLD_BONDS.map((sgb) => ({
						id: `sgb-${sgb.symbol.toLowerCase()}`,
						name: sgb.name,
						shortDescription: `${sgb.symbol} • Coupon: ${sgb.couponRate}% p.a. • Maturity: ${sgb.maturityDate} • Tax-Free Capital Gains`,
						description: `${sgb.name} issued by ${sgb.issuer}. Fixed semi-annual coupon of ${sgb.couponRate}% p.a. plus gold price appreciation, 100% exempt from capital gains tax upon maturity.`,
						categoryId: "cat-gold",
						categoryName: "Gold & Commodities",
						subcategoryId: "sgb",
						subcategoryName: "Sovereign Gold Bonds",
						productType: "sgb",
						planType: "regular",
						provider: sgb.issuer,
						minimumInvestment: sgb.faceValue || 5000,
						expectedReturns: 14.2,
						riskLevel: "low",
						features: [
							"2.50% p.a. Guaranteed Sovereign Coupon",
							"Zero Capital Gains Tax on Redemption",
							"RBI Sovereign Guarantee",
							`Maturity: ${sgb.maturityDate}`,
						],
						isActive: true,
						isFeatured: true,
						isPremium: false,
						isNew: false,
						badge: "TAX-FREE",
						kycProductCode: "BASIC_MF",
						sourceTable: "sovereign_gold_bonds",
						sourceId: sgb.symbol,
						providerSource: "UPSTOX" as const,
						providerProductId: sgb.upstoxInstrumentKey,
					}));

					mergedProducts = [
						...mergedProducts,
						...commodityProducts,
						...sgbProducts,
					];
				}
			} catch (e) {
				console.warn("[Store Products] Commodities & SGB merge failed:", e);
			}

			// ── Top Listed Indian Equities (NIFTY 50 Blue Chips) ───────────────────
			try {
				if (
					!category ||
					[
						"cat-stocks",
						"stocks",
						"Stocks & Equities",
						"cat-equity",
						"equities",
					].includes(category as string)
				) {
					const equityProducts = TOP_INDIAN_EQUITIES.map((eq) => ({
						id: `stock-${eq.symbol.toLowerCase()}`,
						name: eq.name,
						shortDescription: `${eq.symbol} • ${eq.sector} • CMP: ₹${eq.price} • 1Y: +${eq.return1y}%`,
						description: `${eq.name} (${eq.symbol}), India's leading ${eq.sector} enterprise with market cap of ₹${(eq.marketCapCr / 1000).toFixed(0)}k Cr. Listed on ${eq.exchange}.`,
						categoryId: "cat-stocks",
						categoryName: "Stocks & Equities",
						subcategoryId: "large-cap-equities",
						subcategoryName: "Large Cap Blue Chips",
						productType: "stock",
						planType: "regular",
						provider: "Upstox / NSE",
						minimumInvestment: Math.ceil(eq.price),
						expectedReturns: eq.return1y,
						riskLevel: "medium",
						features: [
							`Sector: ${eq.sector}`,
							`Market Cap: ₹${(eq.marketCapCr / 1000).toFixed(0)}k Cr`,
							`CMP: ₹${eq.price}`,
							`ISIN: ${eq.isin}`,
						],
						isActive: true,
						isFeatured: [
							"RELIANCE",
							"TCS",
							"HDFCBANK",
							"INFY",
							"ICICIBANK",
						].includes(eq.symbol),
						isPremium: false,
						isNew: false,
						badge: ["RELIANCE", "HDFCBANK", "INFY"].includes(eq.symbol)
							? "BLUECHIP"
							: undefined,
						kycProductCode: "BASIC_MF",
						sourceTable: "top_indian_equities",
						sourceId: eq.symbol,
						providerSource: "UPSTOX" as const,
						providerProductId: eq.upstoxInstrumentKey,
					}));
					mergedProducts = [...mergedProducts, ...equityProducts];
				}
			} catch (e) {
				console.warn("[Store Products] Equities merge failed:", e);
			}

			// ── Fixed Income (Government Securities & Corporate Bonds) ────────────
			try {
				if (
					!category ||
					[
						"cat-fixed-income",
						"fixed-income",
						"Fixed Income",
					].includes(category as string)
				) {
					const bondProducts = TOP_FIXED_INCOME_SECURITIES.map((bond) => ({
						id: bond.id,
						name: bond.name,
						shortDescription: `${bond.issuer} • Tenor: ${bond.tenor} • Coupon: ${bond.couponRate}% • YTM: ${bond.yieldToMaturity}% • ${bond.creditRating}`,
						description: bond.shortDescription,
						categoryId: "cat-fixed-income",
						categoryName: "Fixed Income",
						subcategoryId: bond.securityType,
						subcategoryName:
							bond.securityType === "gsec"
								? "Government Securities"
								: bond.securityType === "tbill"
									? "Treasury Bills"
									: "Corporate & PSU Bonds",
						productType: "bond",
						planType: "regular",
						provider: bond.issuer,
						minimumInvestment: bond.minimumInvestment,
						expectedReturns: bond.yieldToMaturity,
						riskLevel: bond.riskLevel,
						features: [
							`Yield to Maturity: ${bond.yieldToMaturity}%`,
							`Coupon Rate: ${bond.couponRate}% p.a.`,
							`Credit Rating: ${bond.creditRating}`,
							`Tenor: ${bond.tenor}`,
						],
						isActive: true,
						isFeatured: [
							"gsec-718-2033",
							"bond-rec-754-2034",
							"bond-nhai-735-taxfree",
						].includes(bond.id),
						isPremium: false,
						isNew: false,
						badge:
							bond.securityType === "tax_free"
								? "TAX-FREE"
								: bond.creditRating === "SOVEREIGN"
									? "GOVT"
									: "AAA",
						kycProductCode: "BASIC_MF",
						sourceTable: "fixed_income_catalog",
						sourceId: bond.isin,
						providerSource: "UPSTOX" as const,
						providerProductId: bond.isin,
					}));
					mergedProducts = [...mergedProducts, ...bondProducts];
				}
			} catch (e) {
				console.warn("[Store Products] Fixed income merge failed:", e);
			}

			// ── IRIS National Pension System (NPS) ────────────────────────────────
			try {
				if (
					!category ||
					[
						"virtual-nps",
						"nps",
						"National Pension System (NPS)",
					].includes(category as string)
				) {
					const npsProducts = TOP_NPS_PENSION_SCHEMES.map((nps) => ({
						id: nps.id,
						name: nps.name,
						shortDescription: `${nps.shortName} • ${nps.assetClass} • 1Y: +${nps.return1y}% • 3Y: +${nps.return3y}% • Min: ₹${nps.minInvestment}`,
						description: `${nps.name} managed by ${nps.manager} under PFRDA regulation. Section 80CCD(1B) tax deduction up to ₹50,000.`,
						categoryId: "virtual-nps",
						categoryName: "National Pension System (NPS)",
						subcategoryId: nps.tier === "Tier I" ? "nps-tier1" : "nps-tier2",
						subcategoryName:
							nps.tier === "Tier I"
								? "Tier I (Retirement)"
								: "Tier II (Voluntary)",
						productType: "nps",
						planType: "regular",
						provider: nps.manager,
						minimumInvestment: nps.minInvestment,
						expectedReturns: nps.return1y,
						riskLevel: nps.riskLevel,
						features: [
							`Asset Class: ${nps.assetClass}`,
							`1Y Return: +${nps.return1y}%`,
							`3Y Return: +${nps.return3y}%`,
							"Sec 80CCD(1B) Additional Tax Deduction",
						],
						isActive: true,
						isFeatured: ["nps-sbi-e-tier1", "nps-hdfc-e-tier1"].includes(
							nps.id,
						),
						isPremium: false,
						isNew: false,
						badge: "PFRDA",
						kycProductCode: "BASIC_MF",
						sourceTable: "iris_nps_funds",
						sourceId: nps.pfmCode,
						providerSource: "IRIS" as const,
						providerProductId: nps.pfmCode,
					}));
					mergedProducts = [...mergedProducts, ...npsProducts];
				}
			} catch (e) {
				console.warn("[Store Products] NPS merge failed:", e);
			}

			// ── Specialised Investment Funds (SIF) ────────────────────────────────
			try {
				if (
					!category ||
					[
						"virtual-sif",
						"sif",
						"Specialised Investment Funds (SIF)",
					].includes(category as string)
				) {
					const sifProducts = TOP_SIF_SCHEMES.map((sif) => ({
						id: sif.id,
						name: sif.name,
						shortDescription: `${sif.fundHouse} • ${sif.sebiCategory} • Target: +${sif.expectedReturns}% p.a. • Lock-in: ${sif.lockInMonths}m`,
						description: `${sif.name} by ${sif.fundHouse}. Strategy: ${sif.strategy}. SEBI registered SIF vehicle.`,
						categoryId: "virtual-sif",
						categoryName: "Specialised Investment Funds (SIF)",
						subcategoryId: sif.id.includes("infra")
							? "sif-infra"
							: sif.id.includes("defence")
								? "sif-defence"
								: "sif-preipo",
						subcategoryName: sif.targetSector,
						productType: "sif",
						planType: "regular",
						provider: sif.fundHouse,
						minimumInvestment: sif.minInvestment,
						expectedReturns: sif.expectedReturns,
						riskLevel: sif.riskLevel,
						features: [
							`Target Returns: +${sif.expectedReturns}% p.a.`,
							`Lock-in Period: ${sif.lockInMonths} Months`,
							`Management Fee: ${sif.managementFee}%`,
							"SEBI Regulated SIF Vehicle",
						],
						isActive: true,
						isFeatured: true,
						isPremium: true,
						isNew: true,
						badge: "SIF",
						kycProductCode: "ACCREDITED_AIF",
						sourceTable: "iris_pms_aif_products",
						sourceId: sif.id,
						providerSource: "IRIS" as const,
						providerProductId: sif.id,
					}));
					mergedProducts = [...mergedProducts, ...sifProducts];
				}
			} catch (e) {
				console.warn("[Store Products] SIF merge failed:", e);
			}

			// ── Curated Mutual Funds (AMFI Regulated Schemes) ─────────────────────
			try {
				if (
					!category ||
					[
						"cat-mutual-funds",
						"mf-regular",
						"Mutual Funds - Regular Schemes",
						"cat-mf-direct",
						"mf-direct",
						"Mutual Funds - Direct Schemes",
						"virtual-iris-mf",
						"mutual-funds",
						"Mutual Funds",
					].includes(category as string)
				) {
					const mfProducts = TOP_CURATED_MUTUAL_FUNDS.map((mf) => {
						const isDirect = mf.planType === "direct";
						const catName = isDirect
							? "Mutual Funds - Direct Schemes"
							: "Mutual Funds - Regular Schemes";
						const catId = isDirect ? "cat-mf-direct" : "cat-mutual-funds";

						return {
							id: `mf-${mf.schemeCode}`,
							name: mf.name,
							shortDescription: `${mf.amcName} • ${mf.subCategory} • 1Y: +${mf.return1y}% • Min SIP: ₹${mf.minSip}`,
							description: `${mf.name} managed by ${mf.amcName}. Category: ${mf.category} - ${mf.subCategory}. Plan: ${mf.planType.toUpperCase()}.`,
							categoryId: catId,
							categoryName: catName,
							subcategoryId: isDirect ? "mf-direct-equity" : "mf-regular-equity",
							subcategoryName: mf.subCategory,
							productType: "mutual_fund",
							planType: mf.planType,
							provider: mf.amcName,
							minimumInvestment: mf.minSip,
							expectedReturns: mf.return1y,
							riskLevel: mf.riskLevel,
							features: [
								`1Y Returns: +${mf.return1y}%`,
								`3Y Returns: +${mf.return3y}%`,
								`Min SIP: ₹${mf.minSip}`,
								`ISIN: ${mf.isin}`,
							],
							isActive: true,
							isFeatured: ["125497", "118834", "122639"].includes(
								mf.schemeCode,
							),
							isPremium: false,
							isNew: false,
							badge: isDirect ? "DIRECT" : "TOP-RATED",
							kycProductCode: isDirect ? "MUTUAL_FUNDS_DIRECT" : "BASIC_MF",
							sourceTable: "mutual_funds",
							sourceId: mf.schemeCode,
							providerSource: "IRIS" as const,
							providerProductId: mf.schemeCode,
						};
					});
					mergedProducts = [...mergedProducts, ...mfProducts];
				}
			} catch (e) {
				console.warn("[Store Products] Curated MF merge failed:", e);
			}

			// ── Top Rated Corporate Fixed Deposits ────────────────────────────────
			try {
				if (
					!category ||
					[
						"fixed-deposits",
						"Fixed Deposits",
						"cat-fixed-income",
						"Fixed Income",
					].includes(category as string)
				) {
					const fdProducts = TOP_FIXED_DEPOSITS.map((fd) => ({
						id: fd.id,
						name: `${fd.issuer} FD (${fd.tenure})`,
						shortDescription: `${fd.issuer} • ${fd.tenure} • ${fd.interestRate}% p.a. (Sr. Citizens ${fd.seniorCitizenRate}%) • ${fd.creditRating}`,
						description: `High-yield corporate fixed deposit from ${fd.issuer}. Tenor: ${fd.tenure}. Interest rate: ${fd.interestRate}% p.a. Rated ${fd.creditRating}.`,
						categoryId: "fixed-deposits",
						categoryName: "Fixed Deposits",
						subcategoryId: "corporate-fd",
						subcategoryName: "Corporate FDs",
						productType: "fixed_deposit",
						planType: "regular",
						provider: fd.issuer,
						minimumInvestment: fd.minAmount,
						expectedReturns: fd.interestRate,
						riskLevel: "low",
						features: [
							`Interest Rate: ${fd.interestRate}% p.a.`,
							`Senior Citizen Rate: ${fd.seniorCitizenRate}% p.a.`,
							`Tenor: ${fd.tenure}`,
							`Credit Rating: ${fd.creditRating}`,
						],
						isActive: true,
						isFeatured: fd.id === "fd-shriram-36m",
						isPremium: false,
						isNew: false,
						badge: "AAA",
						kycProductCode: "BASIC_MF",
						sourceTable: "fixed_deposits",
						sourceId: fd.id,
						providerSource: "IRIS" as const,
						providerProductId: fd.id,
					}));
					mergedProducts = [...mergedProducts, ...fdProducts];
				}
			} catch (e) {
				console.warn("[Store Products] Fixed deposit merge failed:", e);
			}

			// ── Curated US Equities & ETFs (Alpaca Broker API) ───────────────────
			try {
				if (
					!category ||
					[
						"cat-global-stocks",
						"global-stocks",
						"us-stocks",
						"us-equities",
						"US Stocks & ETFs",
					].includes(category as string)
				) {
					const usProducts = TOP_US_EQUITIES.map((us) => ({
						id: `us-${us.symbol.toLowerCase()}`,
						name: us.name,
						shortDescription: `${us.symbol} • ${us.category} • Target Return: +${us.expectedReturns}%`,
						description: `${us.name} (${us.symbol}), US listed ${us.category.toLowerCase()}. Powered by Alpaca Broker API under RBI Liberalised Remittance Scheme (LRS).`,
						categoryId: "cat-global-stocks",
						categoryName: "US Stocks & ETFs",
						subcategoryId: us.category === "US ETF" ? "us-etf" : "us-equity",
						subcategoryName: us.category,
						productType: us.category === "US ETF" ? "etf" : "us_equity",
						planType: "regular",
						provider: "Alpaca / US Markets",
						minimumInvestment: us.minUsd,
						expectedReturns: us.expectedReturns,
						riskLevel: us.category === "US ETF" ? "medium" : "high",
						features: [
							`Symbol: ${us.symbol}`,
							`Type: ${us.category}`,
							"Currency: USD (RBI LRS Compliant)",
							"Fractional Shares Supported",
						],
						isActive: true,
						isFeatured: ["SPY", "QQQ", "AAPL", "NVDA"].includes(us.symbol),
						isPremium: false,
						isNew: true,
						badge: us.category === "US ETF" ? "US-ETF" : "ALPACA",
						kycProductCode: "LRS_GLOBAL_EQUITY",
						sourceTable: "top_us_equities",
						sourceId: us.symbol,
						providerSource: "ALPACA" as const,
						providerProductId: us.symbol,
					}));
					mergedProducts = [...mergedProducts, ...usProducts];
				}
			} catch (e) {
				console.warn("[Store Products] US equities merge failed:", e);
			}

			res.json({
				success: true,
				products: mergedProducts,
				count: mergedProducts.length,
			});
		} catch (error) {
			console.error("Error fetching public store products:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch products" });
		}
	});

	// Get featured/popular products for store homepage
	app.get("/api/store/featured", async (req, res) => {
		try {
			// Query store products endpoint internally or synthesize from featured flags
			const response = await fetch(
				`http://127.0.0.1:${process.env.PORT || 5000}/api/store/products`,
			).catch(() => null);

			let allMerged: any[] = [];
			if (response && response.ok) {
				const json = await response.json();
				allMerged = json.products || [];
			}

			const featured = allMerged.filter((p) => p.isFeatured).slice(0, 8);
			const popular = [...allMerged]
				.sort((a, b) => (b.expectedReturns || 0) - (a.expectedReturns || 0))
				.slice(0, 12);

			res.json({
				success: true,
				featured: featured.length > 0 ? featured : allMerged.slice(0, 6),
				popular: popular.length > 0 ? popular : allMerged.slice(0, 10),
				count: allMerged.length,
			});
		} catch (error) {
			console.error("Error fetching featured products:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch featured products" });
		}
	});

	// Submit product/category inquiry (for Coming Soon or disabled products)
	app.post("/api/store/inquiries", async (req: any, res) => {
		try {
			const {
				categoryId,
				productId,
				name,
				email,
				phone,
				message,
				inquiryType,
			} = req.body;

			if (!email || (!categoryId && !productId)) {
				return res
					.status(400)
					.json({
						success: false,
						message: "Email and category/product are required",
					});
			}

			const inquiry = await db
				.insert(storeProductInquiries)
				.values({
					categoryId,
					productId,
					userId: req.user?.id,
					name: name || req.user?.fullName,
					email: email || req.user?.email,
					phone: phone || req.user?.phone,
					message,
					inquiryType: inquiryType || "callback",
					status: "pending",
				} as any)
				.returning();

			// Log transaction for compliance
			const { storeTransactionService } = await import(
				"../services/store-transaction-service"
			);
			await storeTransactionService.logTransaction({
				transactionType: "inquiry",
				userId: req.user?.id,
				userEmail: email,
				userName: name,
				productCategory: categoryId ? "category_inquiry" : "product_inquiry",
				categoryId,
				productId,
				source: "client_direct",
				status: "completed",
				ipAddress: req.ip,
				userAgent: req.headers["user-agent"],
				metadata: { message, inquiryType },
			});

			res.json({ success: true, inquiry: inquiry[0] });
		} catch (error) {
			console.error("Error submitting inquiry:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to submit inquiry" });
		}
	});

	// Get client transaction history (requires auth)
	app.get("/api/client/transactions", requireAuth, async (req: any, res) => {
		try {
			const { category, startDate, endDate, limit, offset } = req.query;

			const { storeTransactionService } = await import(
				"../services/store-transaction-service"
			);
			const result = await storeTransactionService.getTransactionsByUser(
				req.user!.id,
				{
					category: category as string,
					startDate: startDate ? new Date(startDate as string) : undefined,
					endDate: endDate ? new Date(endDate as string) : undefined,
					limit: limit ? Number.parseInt(limit as string) : 50,
					offset: offset ? Number.parseInt(offset as string) : 0,
				},
			);

			res.json({ success: true, ...result });
		} catch (error) {
			console.error("Error fetching transactions:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch transactions" });
		}
	});

	// Get client transaction summary by category
	app.get(
		"/api/client/transactions/summary",
		requireAuth,
		async (req: any, res) => {
			try {
				const { storeTransactionService } = await import(
					"../services/store-transaction-service"
				);
				const summary = await storeTransactionService.getTransactionSummary(
					req.user!.id,
				);
				res.json({ success: true, summary });
			} catch (error) {
				console.error("Error fetching transaction summary:", error);
				res
					.status(500)
					.json({ success: false, message: "Failed to fetch summary" });
			}
		},
	);

	// Admin: Get all inquiries for follow-up
	app.get("/api/admin/store/inquiries", requireAdmin, async (req: any, res) => {
		try {
			const { status, category, limit, offset } = req.query;

			const conditions: any[] = [];
			if (status)
				conditions.push(eq(storeProductInquiries.status, status as string));
			if (category)
				conditions.push(
					eq(storeProductInquiries.categoryId, category as string),
				);

			const inquiries = await db
				.select()
				.from(storeProductInquiries)
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(storeProductInquiries.createdAt))
				.limit(Number.parseInt(limit as string) || 50)
				.offset(Number.parseInt(offset as string) || 0);

			const countResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(storeProductInquiries)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			res.json({
				success: true,
				inquiries,
				total: countResult[0]?.count || 0,
			});
		} catch (error) {
			console.error("Error fetching inquiries:", error);
			res
				.status(500)
				.json({ success: false, message: "Failed to fetch inquiries" });
		}
	});

	// Admin: Update inquiry status
	app.put(
		"/api/admin/store/inquiries/:id",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { id } = req.params;
				const { status, notes, assignedTo } = req.body;

				const updated = await db
					.update(storeProductInquiries)
					.set({
						status,
						notes,
						assignedTo,
						resolvedAt:
							status === "resolved" || status === "closed"
								? new Date()
								: undefined,
					})
					.where(eq(storeProductInquiries.id, id))
					.returning();

				res.json({ success: true, inquiry: updated[0] });
			} catch (error) {
				console.error("Error updating inquiry:", error);
				res
					.status(500)
					.json({ success: false, message: "Failed to update inquiry" });
			}
		},
	);

	// Admin: Get transaction audit logs
	app.get(
		"/api/admin/store/transactions",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { userId, category, status, startDate, endDate, limit, offset } =
					req.query;

				const conditions: any[] = [];
				if (userId)
					conditions.push(eq(storeTransactionLogs.userId, userId as string));
				if (category)
					conditions.push(
						eq(storeTransactionLogs.productCategory, category as string),
					);
				if (status)
					conditions.push(eq(storeTransactionLogs.status, status as string));
				if (startDate)
					conditions.push(
						gte(storeTransactionLogs.createdAt, new Date(startDate as string)),
					);
				if (endDate)
					conditions.push(
						lte(storeTransactionLogs.createdAt, new Date(endDate as string)),
					);

				const transactions = await db
					.select()
					.from(storeTransactionLogs)
					.where(conditions.length > 0 ? and(...conditions) : undefined)
					.orderBy(desc(storeTransactionLogs.createdAt))
					.limit(Number.parseInt(limit as string) || 100)
					.offset(Number.parseInt(offset as string) || 0);

				const countResult = await db
					.select({ count: sql<number>`count(*)` })
					.from(storeTransactionLogs)
					.where(conditions.length > 0 ? and(...conditions) : undefined);

				res.json({
					success: true,
					transactions,
					total: countResult[0]?.count || 0,
				});
			} catch (error) {
				console.error("Error fetching transaction logs:", error);
				res
					.status(500)
					.json({
						success: false,
						message: "Failed to fetch transaction logs",
					});
			}
		},
	);

	// Admin: Get pending Zoho sync transactions
	app.get(
		"/api/admin/store/transactions/pending-sync",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { storeTransactionService } = await import(
					"../services/store-transaction-service"
				);
				const pendingTransactions =
					await storeTransactionService.getPendingZohoSync(100);
				res.json({ success: true, transactions: pendingTransactions });
			} catch (error) {
				console.error("Error fetching pending sync:", error);
				res
					.status(500)
					.json({ success: false, message: "Failed to fetch pending sync" });
			}
		},
	);

	// ===================================================================
	// STORE MANAGEMENT ROUTES (ADMIN)
	// ===================================================================

	// Get all store categories with their subcategories
	app.get(
		"/api/admin/store/categories",
		requireAdmin,
		async (req: any, res) => {
			console.log(
				"[Store Categories] Request received from user:",
				req.user?.id,
				req.user?.email,
			);
			try {
				const categories = await storage.getAllStoreCategories();
				const subcategories = await storage.getAllStoreSubcategories();
				console.log(
					"[Store Categories] Fetched",
					categories.length,
					"categories and",
					subcategories.length,
					"subcategories",
				);

				// Group subcategories by category
				const categoriesWithSubs = categories.map((cat) => ({
					...cat,
					subcategories: subcategories.filter(
						(sub) => sub.categoryId === cat.id,
					),
				}));

				res.json({ categories: categoriesWithSubs });
			} catch (error) {
				console.error("Error fetching store categories:", error);
				res.status(500).json({ message: "Failed to fetch categories" });
			}
		},
	);

	// Get single category by ID
	app.get("/api/admin/store/categories/:id", requireAdmin, async (req, res) => {
		try {
			const category = await storage.getStoreCategoryById(req.params.id);
			if (!category) {
				return res.status(404).json({ message: "Category not found" });
			}
			res.json({ category });
		} catch (error) {
			console.error("Error fetching category:", error);
			res.status(500).json({ message: "Failed to fetch category" });
		}
	});

	// Create store category
	app.post(
		"/api/admin/store/categories",
		requireAdmin,
		async (req: any, res) => {
			try {
				const { name, description, icon, displayOrder } = req.body;

				if (!name) {
					return res.status(400).json({ message: "Category name is required" });
				}

				const category = await storage.createStoreCategory({
					name,
					description,
					icon: icon || "folder",
					displayOrder: displayOrder || 0,
					isActive: true,
				});

				// Log audit
				await storage.createStoreAuditLog({
					adminId: req.user!.id,
					adminEmail: req.user!.email,
					action: "create",
					targetType: "category",
					targetId: category.id,
					targetName: category.name,
					afterValue: category,
				});

				res.json({ success: true, category });
			} catch (error) {
				console.error("Error creating category:", error);
				res.status(500).json({ message: "Failed to create category" });
			}
		},
	);

	// Update store category
}
