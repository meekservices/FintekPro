import { Router, Request, Response } from "express";
import { requireClientOrHigher, requireAdmin } from "../middleware/auth";
import * as globalAdvisoryService from "../services/global-advisory-service";
import { z } from "zod";

const router = Router();

// ============================================================================
// FEATURE FLAGS
// ============================================================================

router.get(
	"/feature-flags",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const flags =
				await globalAdvisoryService.getAllFeatureFlags("global_advisory");
			res.json({ success: true, flags });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/feature-flags/:flagKey",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { flagKey } = req.params;
			const isEnabled = await globalAdvisoryService.isFeatureEnabled(flagKey);
			const flag = await globalAdvisoryService.getFeatureFlag(flagKey);
			res.json({ success: true, isEnabled, flag });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.patch(
	"/feature-flags/:flagKey",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { flagKey } = req.params;
			const userId = (req.user as any)?.id;
			const flag = await globalAdvisoryService.updateFeatureFlag(
				flagKey,
				req.body,
				userId,
			);
			res.json({ success: true, flag });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/feature-flags/:flagKey/kill",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { flagKey } = req.params;
			const { reason } = req.body;
			const userId = (req.user as any)?.id;

			if (!reason) {
				return res
					.status(400)
					.json({ success: false, error: "Kill switch reason is required" });
			}

			const flag = await globalAdvisoryService.activateKillSwitch(
				flagKey,
				reason,
				userId,
			);
			res.json({ success: true, flag, message: "Kill switch activated" });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// MARKETS
// ============================================================================

router.get(
	"/markets",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { all } = req.query;
			const markets =
				all === "true"
					? await globalAdvisoryService.getAllMarkets()
					: await globalAdvisoryService.getEnabledMarkets();
			res.json({ success: true, markets });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/markets/:marketCode",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { marketCode } = req.params;
			const market = await globalAdvisoryService.getMarketByCode(marketCode);
			if (!market) {
				return res
					.status(404)
					.json({ success: false, error: "Market not found" });
			}
			res.json({ success: true, market });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.patch(
	"/markets/:marketCode",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { marketCode } = req.params;
			const userId = (req.user as any)?.id;
			const market = await globalAdvisoryService.updateMarket(
				marketCode,
				req.body,
				userId,
			);
			res.json({ success: true, market });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/markets/:marketCode/toggle",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { marketCode } = req.params;
			const { isEnabled } = req.body;
			const userId = (req.user as any)?.id;
			const market = await globalAdvisoryService.toggleMarketEnabled(
				marketCode,
				isEnabled,
				userId,
			);
			res.json({ success: true, market });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// MARKET PRODUCTS
// ============================================================================

router.get(
	"/markets/:marketCode/products",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { marketCode } = req.params;
			const products =
				await globalAdvisoryService.getProductsForMarket(marketCode);
			res.json({ success: true, products });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/market-products",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const products = await globalAdvisoryService.getAllMarketProducts();
			res.json({ success: true, products });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.patch(
	"/market-products/:id",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const userId = (req.user as any)?.id;
			const product = await globalAdvisoryService.updateMarketProduct(
				id,
				req.body,
				userId,
			);
			res.json({ success: true, product });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/check-product/:marketCode/:productCategory",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { marketCode, productCategory } = req.params;
			const result = await globalAdvisoryService.isProductAllowedInMarket(
				marketCode,
				productCategory,
			);
			res.json({ success: true, ...result });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// USER MARKET PREFERENCES
// ============================================================================

router.get(
	"/preferences",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const preferences =
				await globalAdvisoryService.getUserMarketPreferences(userId);
			res.json({
				success: true,
				preferences: preferences || {
					selectedMarket: "IN",
					displayCurrency: "INR",
					showGlobalMarkets: false,
				},
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/preferences",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const preferences =
				await globalAdvisoryService.upsertUserMarketPreferences(
					userId,
					req.body,
				);
			res.json({ success: true, preferences });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/select-market",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const { marketCode } = req.body;
			if (!marketCode) {
				return res
					.status(400)
					.json({ success: false, error: "Market code is required" });
			}

			const preferences = await globalAdvisoryService.setSelectedMarket(
				userId,
				marketCode,
			);

			await globalAdvisoryService.logAuditEvent(
				userId,
				"market_selection",
				"change",
				{ marketCode },
				{
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
					requestPath: req.path,
				},
			);

			res.json({ success: true, preferences });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// ACKNOWLEDGMENTS
// ============================================================================

const acknowledgmentSchema = z.object({
	marketCode: z.string().min(2).max(10),
	acknowledgmentType: z.string().min(1),
	disclaimerVersion: z.string().min(1),
	disclaimerText: z.string().min(1),
});

router.get(
	"/acknowledgments",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const acknowledgments =
				await globalAdvisoryService.getUserAcknowledgments(userId);
			res.json({ success: true, acknowledgments });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/acknowledgments/check/:marketCode/:type",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const { marketCode, type } = req.params;
			const hasAcknowledged = await globalAdvisoryService.hasUserAcknowledged(
				userId,
				marketCode,
				type,
			);
			res.json({ success: true, hasAcknowledged });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/acknowledgments",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const result = acknowledgmentSchema.safeParse(req.body);
			if (!result.success) {
				return res
					.status(400)
					.json({
						success: false,
						error: "Invalid acknowledgment data",
						details: result.error.issues,
					});
			}

			const {
				marketCode,
				acknowledgmentType,
				disclaimerVersion,
				disclaimerText,
			} = result.data;

			const acknowledgment = await globalAdvisoryService.recordAcknowledgment(
				userId,
				marketCode,
				acknowledgmentType,
				disclaimerVersion,
				disclaimerText,
				{
					ipAddress: req.ip,
					userAgent: req.get("User-Agent"),
					sessionId: req.sessionID,
				},
			);

			res.json({ success: true, acknowledgment });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// ELIGIBILITY
// ============================================================================

router.get(
	"/eligibility",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const eligibility =
				await globalAdvisoryService.getUserMarketEligibility(userId);
			res.json({ success: true, eligibility });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/eligibility/:marketCode",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const { marketCode } = req.params;

			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}

			const eligibility =
				await globalAdvisoryService.getMarketEligibilityForUser(
					userId,
					marketCode,
				);
			res.json({ success: true, eligibility });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// CURRENCY CONVERSION
// ============================================================================

router.get(
	"/convert",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { amount, from, to } = req.query;

			if (!amount || !from || !to) {
				return res
					.status(400)
					.json({
						success: false,
						error: "Missing required parameters: amount, from, to",
					});
			}

			const result = await globalAdvisoryService.convertCurrency(
				Number.parseFloat(amount as string),
				from as string,
				to as string,
			);
			res.json({ success: true, ...result });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/exchange-rates",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { baseCurrency } = req.query;
			const rates = await globalAdvisoryService.getExchangeRates(
				baseCurrency as string,
			);
			res.json({ success: true, rates });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// EXECUTION GUARD
// ============================================================================

router.get(
	"/can-execute/:marketCode",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { marketCode } = req.params;
			const result = await globalAdvisoryService.canExecuteInMarket(marketCode);
			res.json({ success: true, ...result });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ============================================================================
// AUDIT LOGS (Admin)
// ============================================================================

router.get("/audit-logs", requireAdmin, async (req: Request, res: Response) => {
	try {
		const { userId, marketCode, eventType, startDate, endDate, limit } =
			req.query;

		const logs = await globalAdvisoryService.getAuditLogs({
			userId: userId as string,
			marketCode: marketCode as string,
			eventType: eventType as string,
			startDate: startDate ? new Date(startDate as string) : undefined,
			endDate: endDate ? new Date(endDate as string) : undefined,
			limit: limit ? Number.parseInt(limit as string, 10) : undefined,
		});

		res.json({ success: true, logs });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get(
	"/sebi-export/:userId",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const { userId } = req.params;
			const { startDate, endDate } = req.query;

			if (!startDate || !endDate) {
				return res
					.status(400)
					.json({ success: false, error: "Start and end dates are required" });
			}

			const exportData = await globalAdvisoryService.generateSEBIExport(
				userId,
				new Date(startDate as string),
				new Date(endDate as string),
			);

			res.json({ success: true, ...exportData });
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

export default router;

// ============================================================================
// AI-POWERED GLOBAL INVESTMENT ADVISORY & REBALANCING
// ============================================================================

import { aiGlobalAdvisoryService } from "../services/ai-global-advisory-service";

router.get(
	"/advisory/stocks",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { markets, sectors, marketCap, riskLevel, maxResults } = req.query;

			const recommendations =
				await aiGlobalAdvisoryService.getGlobalStockRecommendations({
					markets: markets ? String(markets).split(",") : undefined,
					sectors: sectors ? String(sectors).split(",") : undefined,
					marketCap: marketCap ? String(marketCap).split(",") : undefined,
					riskLevel:
						(riskLevel as "conservative" | "moderate" | "aggressive") ||
						"moderate",
					maxResults: maxResults ? Number.parseInt(String(maxResults)) : 10,
				});

			res.json({
				success: true,
				data: recommendations,
				meta: {
					count: recommendations.length,
					assetClass: "stock",
					generatedAt: new Date(),
				},
			});
		} catch (error: any) {
			console.error("[GlobalAdvisory] Stocks error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/advisory/etfs",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { categories, riskLevel, maxResults } = req.query;

			const recommendations =
				await aiGlobalAdvisoryService.getGlobalETFRecommendations({
					categories: categories ? String(categories).split(",") : undefined,
					riskLevel:
						(riskLevel as "conservative" | "moderate" | "aggressive") ||
						"moderate",
					maxResults: maxResults ? Number.parseInt(String(maxResults)) : 10,
				});

			res.json({
				success: true,
				data: recommendations,
				meta: {
					count: recommendations.length,
					assetClass: "etf",
					generatedAt: new Date(),
				},
			});
		} catch (error: any) {
			console.error("[GlobalAdvisory] ETFs error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/advisory/bonds",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { bondTypes, duration, riskLevel, maxResults } = req.query;

			const recommendations =
				await aiGlobalAdvisoryService.getGlobalBondRecommendations({
					bondTypes: bondTypes ? String(bondTypes).split(",") : undefined,
					duration: (duration as "short" | "medium" | "long") || "medium",
					riskLevel:
						(riskLevel as "conservative" | "moderate" | "aggressive") ||
						"conservative",
					maxResults: maxResults ? Number.parseInt(String(maxResults)) : 10,
				});

			res.json({
				success: true,
				data: recommendations,
				meta: {
					count: recommendations.length,
					assetClass: "bond",
					generatedAt: new Date(),
				},
			});
		} catch (error: any) {
			console.error("[GlobalAdvisory] Bonds error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/advisory/instrument/:symbol",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { symbol } = req.params;
			const data = await aiGlobalAdvisoryService.fetchGlobalInstrumentData(
				symbol.toUpperCase(),
			);

			if (!data) {
				return res
					.status(404)
					.json({ success: false, error: "Instrument not found" });
			}

			res.json({
				success: true,
				data,
			});
		} catch (error: any) {
			console.error("[GlobalAdvisory] Instrument error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/advisory/filtered",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const {
				globalAdvisorySelections,
				riskLevel,
				maxResultsPerCategory,
				budgetInr,
				priorLrsUtilizationUsd,
			} = req.body;

			if (
				!globalAdvisorySelections ||
				typeof globalAdvisorySelections !== "object"
			) {
				return res.status(400).json({
					success: false,
					error:
						"globalAdvisorySelections object is required with format { market: [instrumentTypes] }",
				});
			}

			const validatedBudget =
				typeof budgetInr === "number" && budgetInr > 0 && budgetInr <= 500000000
					? budgetInr
					: 500000;
			const validatedPriorLrs =
				typeof priorLrsUtilizationUsd === "number" &&
				priorLrsUtilizationUsd >= 0
					? priorLrsUtilizationUsd
					: 0;

			const result =
				await aiGlobalAdvisoryService.getFilteredGlobalRecommendations(
					globalAdvisorySelections,
					riskLevel || "moderate",
					maxResultsPerCategory || 5,
					validatedPriorLrs,
					validatedBudget,
				);

			res.json({
				success: true,
				data: result.recommendations,
				byMarket: result.byMarket,
				byInstrument: result.byInstrument,
				validationWarnings: result.validationWarnings,
				summary: result.summary,
				meta: {
					generatedAt: new Date(),
					lrsAnnualLimit: 250000,
					budgetInr: validatedBudget,
				},
			});
		} catch (error: any) {
			console.error(
				"[GlobalAdvisory] Filtered recommendations error:",
				error.message,
			);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/advisory/options",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const markets = aiGlobalAdvisoryService.getAvailableMarkets();
			const instruments = aiGlobalAdvisoryService.getAvailableInstruments();

			res.json({
				success: true,
				markets,
				instruments,
				compliance: {
					lrsAnnualLimitUsd: 250000,
					enhancedKycRequired: true,
					fatcaRequired: true,
					tcsRate: 20,
					tcsThresholdInr: 700000,
				},
			});
		} catch (error: any) {
			console.error("[GlobalAdvisory] Options error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.post(
	"/rebalancing/preview",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const { positions, targetAllocations, lrsUtilizedYtdUsd } = req.body;

			if (!positions || !Array.isArray(positions)) {
				return res.status(400).json({
					success: false,
					error: "positions array is required",
				});
			}

			const result = await aiGlobalAdvisoryService.generatePortfolioRebalancing(
				userId || "anonymous",
				positions,
				targetAllocations || { stocks: 60, etfs: 20, bonds: 15, cash: 5 },
				lrsUtilizedYtdUsd || 0,
			);

			res.json({
				success: true,
				data: result,
			});
		} catch (error: any) {
			console.error(
				"[GlobalAdvisory] Rebalancing preview error:",
				error.message,
			);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/lrs/status",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			if (!userId) {
				return res
					.status(401)
					.json({ success: false, error: "User not authenticated" });
			}
			const currentFY = getCurrentFinancialYear();

			const lrsStatus = {
				userId,
				financialYear: currentFY,
				lrsLimitUsd: 250000,
				totalRemittedUsd: 0,
				remainingLimitUsd: 250000,
				transactionCount: 0,
				fatcaStatus: "pending",
				w8benStatus: "not_filed",
				taxImplications: {
					tcsRate: 20,
					tcsThreshold: 700000,
					note: "TCS of 20% applicable on remittances exceeding ₹7 lakhs per FY",
				},
				lastUpdated: new Date(),
			};

			res.json({
				success: true,
				data: lrsStatus,
			});
		} catch (error: any) {
			console.error("[GlobalAdvisory] LRS status error:", error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/advisory/markets",
	requireClientOrHigher,
	async (_req: Request, res: Response) => {
		try {
			const markets = [
				{
					code: "US",
					name: "United States",
					exchanges: ["NYSE", "NASDAQ"],
					currency: "USD",
					isEnabled: true,
					dtaaRate: 15,
				},
				{
					code: "UK",
					name: "United Kingdom",
					exchanges: ["LSE"],
					currency: "GBP",
					isEnabled: true,
					dtaaRate: 15,
				},
				{
					code: "EU",
					name: "European Union",
					exchanges: ["XETRA", "EURONEXT"],
					currency: "EUR",
					isEnabled: true,
					dtaaRate: 15,
				},
				{
					code: "JP",
					name: "Japan",
					exchanges: ["TSE"],
					currency: "JPY",
					isEnabled: true,
					dtaaRate: 10,
				},
				{
					code: "HK",
					name: "Hong Kong",
					exchanges: ["HKEX"],
					currency: "HKD",
					isEnabled: true,
					dtaaRate: 0,
				},
				{
					code: "SG",
					name: "Singapore",
					exchanges: ["SGX"],
					currency: "SGD",
					isEnabled: true,
					dtaaRate: 15,
				},
			];

			res.json({
				success: true,
				data: markets,
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

router.get(
	"/advisory/tax-implications/:market",
	requireClientOrHigher,
	async (req: Request, res: Response) => {
		try {
			const { market } = req.params;

			const taxInfo: Record<string, any> = {
				US: {
					market: "US",
					dividendWithholding: 25,
					dtaaRate: 15,
					ltcgRate: 20,
					stcgRate: 30,
					holdingPeriodMonths: 24,
					forms: ["W-8BEN"],
					notes:
						"File Form 67 with ITR to claim foreign tax credit in India. W-8BEN reduces US withholding from 30% to 15%.",
				},
				UK: {
					market: "UK",
					dividendWithholding: 0,
					dtaaRate: 15,
					ltcgRate: 20,
					stcgRate: 30,
					holdingPeriodMonths: 24,
					forms: [],
					notes:
						"UK has no withholding tax on dividends for non-residents. Capital gains taxed only in India.",
				},
				SG: {
					market: "SG",
					dividendWithholding: 0,
					dtaaRate: 15,
					ltcgRate: 20,
					stcgRate: 30,
					holdingPeriodMonths: 24,
					forms: [],
					notes:
						"Singapore has no dividend tax. Favorable for dividend-focused portfolios.",
				},
				HK: {
					market: "HK",
					dividendWithholding: 0,
					dtaaRate: 0,
					ltcgRate: 20,
					stcgRate: 30,
					holdingPeriodMonths: 24,
					forms: [],
					notes:
						"Hong Kong has no capital gains tax and no dividend withholding.",
				},
				JP: {
					market: "JP",
					dividendWithholding: 15,
					dtaaRate: 10,
					ltcgRate: 20,
					stcgRate: 30,
					holdingPeriodMonths: 24,
					forms: [],
					notes:
						"Japan-India DTAA allows reduced 10% withholding on dividends.",
				},
			};

			const info = taxInfo[market.toUpperCase()] || {
				market: market.toUpperCase(),
				dividendWithholding: 25,
				dtaaRate: 25,
				ltcgRate: 20,
				stcgRate: 30,
				holdingPeriodMonths: 24,
				notes: "Check specific DTAA treaty for applicable rates",
			};

			res.json({
				success: true,
				data: info,
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

function getCurrentFinancialYear(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;

	if (month >= 4) {
		return `${year}-${(year + 1).toString().slice(-2)}`;
	}
	return `${year - 1}-${year.toString().slice(-2)}`;
}
