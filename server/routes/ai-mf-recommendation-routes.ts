import { Router } from "express";
import { aiMFRecommendationService } from "../services/ai-mf-recommendation-service";
import { liveMFDataService } from "../services/live-mf-data-service";
import { db } from "../db";
import { storeCategories } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// Helper to check if Mutual Funds category is enabled for recommendations
async function isMFCategoryEnabled(): Promise<boolean> {
	try {
		const categories = await db
			.select()
			.from(storeCategories)
			.where(
				or(
					eq(storeCategories.slug, "mutual-funds"),
					eq(storeCategories.name, "Mutual Funds"),
				),
			)
			.limit(1);

		// If no category found or isEnabled is true, allow recommendations
		if (categories.length === 0) return true;
		return categories[0].isEnabled !== false;
	} catch (e) {
		console.warn("[AI MF] Error checking category status:", e);
		return true; // Default to enabled on error
	}
}

router.get("/api/ai-mf/recommendations", async (req, res) => {
	try {
		// Check if MF category is enabled in store management
		const categoryEnabled = await isMFCategoryEnabled();
		if (!categoryEnabled) {
			return res.json({
				success: true,
				count: 0,
				recommendations: [],
				metadata: {
					categoryStatus: "disabled",
					message: "Mutual Funds category is currently not available",
					generatedAt: new Date().toISOString(),
				},
			});
		}

		const { category, riskLevel, includeGoldSilver, maxFundsPerAMC, minAMCs } =
			req.query;

		const recommendations =
			await aiMFRecommendationService.getSmartRecommendations({
				category: category as string,
				riskLevel: riskLevel as string,
				includeGoldSilver: includeGoldSilver !== "false",
				maxFundsPerAMC: maxFundsPerAMC
					? Number.parseInt(maxFundsPerAMC as string)
					: 2,
				minAMCs: minAMCs ? Number.parseInt(minAMCs as string) : 4,
				onlyTradable: true,
				onlyTopRated: true,
			});

		res.json({
			success: true,
			count: recommendations.length,
			recommendations,
			metadata: {
				filters: {
					category,
					riskLevel,
					includeGoldSilver,
					maxFundsPerAMC,
					minAMCs,
				},
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error: any) {
		console.error("Error getting MF recommendations:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate recommendations",
		});
	}
});

router.get("/api/ai-mf/recommendations/live-nav", async (req, res) => {
	try {
		const { category, riskLevel } = req.query;

		const recommendations =
			await aiMFRecommendationService.getRecommendationsWithLiveNAV({
				category: category as string,
				riskLevel: riskLevel as string,
				onlyTradable: true,
				onlyTopRated: true,
			});

		res.json({
			success: true,
			count: recommendations.length,
			recommendations,
			metadata: {
				navSource: "MFAPI",
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error: any) {
		console.error("Error getting MF recommendations with live NAV:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate recommendations",
		});
	}
});

router.get("/api/ai-mf/exit-recommendations", async (req, res) => {
	try {
		const { holdings } = req.query;
		const userHoldings = holdings ? (holdings as string).split(",") : undefined;

		const recommendations =
			await aiMFRecommendationService.getExitRecommendations(userHoldings);

		res.json({
			success: true,
			count: recommendations.length,
			recommendations,
			metadata: {
				type: "exit",
				reason: "Underperforming CAGR vs category average",
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error: any) {
		console.error("Error getting exit recommendations:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate exit recommendations",
		});
	}
});

router.get("/api/ai-mf/commodity-fof", async (req, res) => {
	try {
		const recommendations =
			await aiMFRecommendationService.getCommodityFOFRecommendations();

		res.json({
			success: true,
			count: recommendations.length,
			recommendations,
			metadata: {
				type: "commodity_fof",
				includes: ["Gold FOF", "Silver FOF", "Commodity Funds"],
				allocationSuggestion: "5-10% of portfolio",
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error: any) {
		console.error("Error getting commodity FOF recommendations:", error);
		res.status(500).json({
			success: false,
			error:
				error.message || "Failed to generate commodity FOF recommendations",
		});
	}
});

router.get("/api/ai-mf/nav/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const nav = await aiMFRecommendationService.fetchLiveNAV(schemeCode);

		if (nav) {
			res.json({
				success: true,
				schemeCode,
				nav,
				source: "MFAPI",
				fetchedAt: new Date().toISOString(),
			});
		} else {
			res.status(404).json({
				success: false,
				error: `NAV not found for scheme ${schemeCode}`,
			});
		}
	} catch (error: any) {
		console.error("Error fetching NAV:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch NAV",
		});
	}
});

router.post("/api/ai-mf/analyze-portfolio", async (req, res) => {
	try {
		const { holdings } = req.body;

		if (!holdings || !Array.isArray(holdings)) {
			return res.status(400).json({
				success: false,
				error: "Holdings array is required",
			});
		}

		const analysis =
			await aiMFRecommendationService.analyzePortfolioHoldings(holdings);

		res.json({
			success: true,
			...analysis,
			metadata: {
				analyzedAt: new Date().toISOString(),
				holdingsCount: holdings.length,
			},
		});
	} catch (error: any) {
		console.error("Error analyzing portfolio:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to analyze portfolio",
		});
	}
});

router.get("/api/ai-mf/proposal-recommendations", async (req, res) => {
	try {
		const { riskCategory, investmentAmount } = req.query;

		if (!riskCategory || !investmentAmount) {
			return res.status(400).json({
				success: false,
				error: "riskCategory and investmentAmount are required",
			});
		}

		const validRiskCategories = ["conservative", "moderate", "aggressive"];
		if (!validRiskCategories.includes(riskCategory as string)) {
			return res.status(400).json({
				success: false,
				error:
					"Invalid riskCategory. Must be: conservative, moderate, or aggressive",
			});
		}

		const recommendations =
			await aiMFRecommendationService.getProposalRecommendations({
				riskCategory: riskCategory as
					| "conservative"
					| "moderate"
					| "aggressive",
				investmentAmount: Number.parseFloat(investmentAmount as string),
			});

		res.json({
			success: true,
			recommendations,
			metadata: {
				riskCategory,
				investmentAmount: Number.parseFloat(investmentAmount as string),
				totalFunds:
					recommendations.equityFunds.length +
					recommendations.debtFunds.length +
					recommendations.hybridFunds.length +
					recommendations.commodityFunds.length,
				generatedAt: new Date().toISOString(),
			},
		});
	} catch (error: any) {
		console.error("Error getting proposal recommendations:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate proposal recommendations",
		});
	}
});

// Unified AI recommendation endpoint - combines stocks, mutual funds, and bonds
router.post("/api/ai/unified-recommendations", async (req, res) => {
	try {
		const {
			riskCategory = "moderate",
			investmentAmount = 500000,
			includeStocks = true,
			includeMutualFunds = true,
			includeBonds = true,
			clientId,
		} = req.body;

		const validRiskCategories = ["conservative", "moderate", "aggressive"];
		if (!validRiskCategories.includes(riskCategory)) {
			return res.status(400).json({
				success: false,
				error:
					"Invalid riskCategory. Must be: conservative, moderate, or aggressive",
			});
		}

		// Parallel fetching of all recommendation types
		const [mfRecommendations, commodityRecs, exitRecs] = await Promise.all([
			includeMutualFunds
				? aiMFRecommendationService.getProposalRecommendations({
						riskCategory,
						investmentAmount,
					})
				: Promise.resolve(null),
			includeMutualFunds
				? aiMFRecommendationService.getCommodityFOFRecommendations()
				: Promise.resolve([]),
			includeMutualFunds
				? aiMFRecommendationService.getExitRecommendations()
				: Promise.resolve([]),
		]);

		// Asset allocation based on risk category
		const allocations = {
			conservative: { equity: 30, debt: 50, gold: 10, hybrid: 10 },
			moderate: { equity: 50, debt: 30, gold: 10, hybrid: 10 },
			aggressive: { equity: 70, debt: 15, gold: 5, hybrid: 10 },
		};
		const allocation = allocations[riskCategory as keyof typeof allocations];

		// Calculate amounts per asset class
		const amounts = {
			equity: Math.round((investmentAmount * allocation.equity) / 100),
			debt: Math.round((investmentAmount * allocation.debt) / 100),
			gold: Math.round((investmentAmount * allocation.gold) / 100),
			hybrid: Math.round((investmentAmount * allocation.hybrid) / 100),
		};

		// Build unified response
		const unifiedRecommendations = {
			mutualFunds: mfRecommendations
				? {
						equity: mfRecommendations.equityFunds.slice(0, 5).map((f: any) => ({
							...f,
							suggestedAmount: Math.round(
								amounts.equity /
									Math.min(5, mfRecommendations.equityFunds.length),
							),
						})),
						debt: mfRecommendations.debtFunds.slice(0, 3).map((f: any) => ({
							...f,
							suggestedAmount: Math.round(
								amounts.debt / Math.min(3, mfRecommendations.debtFunds.length),
							),
						})),
						hybrid: mfRecommendations.hybridFunds.slice(0, 2).map((f: any) => ({
							...f,
							suggestedAmount: Math.round(
								amounts.hybrid /
									Math.min(2, mfRecommendations.hybridFunds.length),
							),
						})),
						commodity: (commodityRecs as any[]).slice(0, 2).map((f: any) => ({
							...f,
							suggestedAmount: Math.round(
								amounts.gold / Math.min(2, (commodityRecs as any[]).length),
							),
						})),
					}
				: null,
			exitRecommendations: exitRecs,
			allocation: {
				target: allocation,
				amounts,
				totalInvestment: investmentAmount,
			},
			summary: {
				totalFunds: mfRecommendations
					? mfRecommendations.equityFunds.length +
						mfRecommendations.debtFunds.length +
						mfRecommendations.hybridFunds.length +
						(commodityRecs as any[]).length
					: 0,
				exitCandidates: (exitRecs as any[]).length,
				riskProfile: riskCategory,
				expectedReturns: {
					conservative: "8-10%",
					moderate: "10-14%",
					aggressive: "14-18%",
				}[riskCategory as "conservative" | "moderate" | "aggressive"],
			},
		};

		res.json({
			success: true,
			recommendations: unifiedRecommendations,
			metadata: {
				riskCategory,
				investmentAmount,
				includeStocks,
				includeMutualFunds,
				includeBonds,
				clientId,
				generatedAt: new Date().toISOString(),
				fintekproVersion: "2.0",
				disclaimer:
					"These recommendations are based on AI analysis and historical data. Past performance does not guarantee future results. Please consult a financial advisor before investing.",
			},
		});
	} catch (error: any) {
		console.error("Error getting unified recommendations:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to generate unified recommendations",
		});
	}
});

// Live Data Service Routes
router.get("/api/ai-mf/live-data/status", async (req, res) => {
	try {
		const stats = liveMFDataService.getCacheStats();
		res.json({
			success: true,
			cache: {
				fundsCount: stats.size,
				ageSeconds: stats.age,
				isValid: stats.isValid,
				ttlSeconds: 3600,
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/api/ai-mf/live-data/refresh", async (req, res) => {
	try {
		const success = await liveMFDataService.refreshCache();
		const stats = liveMFDataService.getCacheStats();

		res.json({
			success,
			message: success
				? "Live NAV cache refreshed from AMFI"
				: "Cache refresh failed",
			cache: {
				fundsCount: stats.size,
				ageSeconds: stats.age,
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/api/ai-mf/live-data/nav/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const navData = await liveMFDataService.getLiveNav(schemeCode);

		if (!navData) {
			return res.status(404).json({
				success: false,
				error: "Fund not found or NAV data unavailable",
			});
		}

		const returns = await liveMFDataService.calculateReturns(schemeCode);

		res.json({
			success: true,
			data: {
				...navData,
				returns,
				isLive: true,
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/api/ai-mf/live-data/sync-database", async (req, res) => {
	try {
		const { schemeCodes, limit } = req.body;
		const codesToSync = schemeCodes || undefined;

		const result =
			await liveMFDataService.updateDatabaseWithLiveData(codesToSync);

		res.json({
			success: true,
			result,
			message: `Updated ${result.updated} funds with live data`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/api/ai-mf/live-data/sync-new-funds", async (req, res) => {
	try {
		const added = await liveMFDataService.syncNewFundsFromAmfi();

		res.json({
			success: true,
			fundsAdded: added,
			message: `Added ${added} new funds from AMFI`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/api/ai-mf/live-data/enhanced/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const data = await liveMFDataService.getEnhancedFundData(schemeCode);

		res.json({
			success: true,
			data,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// NAV History Sync routes
router.post("/api/ai-mf/nav-history/sync/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const { maxDays } = req.body;
		const { mfDataSyncService } = await import(
			"../services/mf-data-sync-service"
		);

		const count = await mfDataSyncService.syncNavHistoryForScheme(
			schemeCode,
			maxDays || 1825,
		);

		res.json({
			success: true,
			synced: count,
			message: `Synced ${count} NAV records for scheme ${schemeCode}`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/api/ai-mf/nav-history/sync-all", async (req, res) => {
	try {
		const { limit } = req.body;
		const { mfDataSyncService } = await import(
			"../services/mf-data-sync-service"
		);

		const result = await mfDataSyncService.syncNavHistoryForAllFunds(
			limit || 50,
		);

		res.json({
			success: true,
			...result,
			message: `Synced NAV history for ${result.synced}/${result.total} funds`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/api/ai-mf/monthly-returns/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const { mfDataSyncService } = await import(
			"../services/mf-data-sync-service"
		);

		const count =
			await mfDataSyncService.calculateMonthlyReturnsForScheme(schemeCode);

		res.json({
			success: true,
			monthsCalculated: count,
			message: `Calculated ${count} monthly returns for scheme ${schemeCode}`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/api/ai-mf/exit-signals/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const { mfDataSyncService } = await import(
			"../services/mf-data-sync-service"
		);

		const signals = await mfDataSyncService.getExitSignals(schemeCode);

		if (!signals) {
			return res.status(404).json({
				success: false,
				error: "Insufficient data for exit signal analysis",
			});
		}

		res.json({
			success: true,
			schemeCode,
			...signals,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// Tax calculation routes
router.post("/api/ai-mf/tax/calculate", async (req, res) => {
	try {
		const { gain, holdingDays, category, schemeName, slabRate } = req.body;

		if (gain === undefined || holdingDays === undefined) {
			return res.status(400).json({
				success: false,
				error: "gain and holdingDays are required",
			});
		}

		const { mfTaxService } = await import("../services/mf-tax-service");
		const tax = await mfTaxService.calculateTax(
			gain,
			holdingDays,
			category || "equity",
			schemeName || "",
			slabRate || 30,
		);

		res.json({
			success: true,
			tax,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/api/ai-mf/tax/rules/:fundType", async (req, res) => {
	try {
		const { fundType } = req.params;
		const { mfTaxService } = await import("../services/mf-tax-service");

		const summary = mfTaxService.getTaxSummary(fundType);

		res.json({
			success: true,
			fundType,
			...summary,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/api/ai-mf/exit-load/:schemeCode", async (req, res) => {
	try {
		const { schemeCode } = req.params;
		const { holdingDays } = req.query;
		const { mfTaxService } = await import("../services/mf-tax-service");

		const exitLoad = await mfTaxService.getExitLoadForScheme(
			schemeCode,
			holdingDays ? Number.parseInt(holdingDays as string) : 0,
		);

		const timeline = await mfTaxService.getExitLoadTimeline(schemeCode);

		res.json({
			success: true,
			schemeCode,
			currentHoldingDays: holdingDays
				? Number.parseInt(holdingDays as string)
				: 0,
			exitLoad,
			timeline,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/api/ai-mf/withdrawal-summary", async (req, res) => {
	try {
		const {
			schemeCode,
			investmentAmount,
			currentValue,
			holdingDays,
			category,
			schemeName,
			slabRate,
		} = req.body;

		if (
			!schemeCode ||
			!investmentAmount ||
			!currentValue ||
			holdingDays === undefined
		) {
			return res.status(400).json({
				success: false,
				error:
					"schemeCode, investmentAmount, currentValue, and holdingDays are required",
			});
		}

		const { mfTaxService } = await import("../services/mf-tax-service");
		const summary = await mfTaxService.calculateWithdrawalSummary(
			schemeCode,
			investmentAmount,
			currentValue,
			holdingDays,
			category || "equity",
			schemeName || "",
			slabRate || 30,
		);

		res.json({
			success: true,
			summary,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// Get current overseas investment regulatory status
router.get("/api/ai-mf/regulatory-status", async (req, res) => {
	try {
		const aiMfModule = (await import(
			"../services/ai-mf-recommendation-service"
		)) as any;
		const AIMFRecommendationService = aiMfModule.AIMFRecommendationService;
		const status = AIMFRecommendationService.getOverseasInvestmentStatus();

		res.json({
			success: true,
			regulatoryStatus: {
				overseasInvestment: {
					status: status.investmentFrozen ? "FROZEN" : "OPEN",
					limit: "USD 7 billion",
					frozenSince: status.investmentFrozen ? "2022-02-01" : null,
					reason: status.investmentFrozen
						? "Industry-wide limit reached as per SEBI circular"
						: null,
				},
				overseasETF: {
					status: status.etfFrozen ? "FROZEN" : "OPEN",
					limit: "USD 1 billion",
					frozenSince: status.etfFrozen ? "2024-04-01" : null,
					reason: status.etfFrozen
						? "Overseas ETF limit reached as per SEBI circular"
						: null,
				},
				lastUpdated: new Date().toISOString(),
				source: "SEBI/RBI regulatory framework",
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// Admin endpoint to update regulatory status (for automated scheduler or manual override)
// Protected with admin authentication
router.post(
	"/api/admin/ai-mf/regulatory-status",
	requireAdmin,
	async (req: any, res) => {
		try {
			const { overseasInvestmentFrozen, overseasETFFrozen } = req.body;

			// Validate request body
			if (
				typeof overseasInvestmentFrozen !== "boolean" &&
				typeof overseasETFFrozen !== "boolean"
			) {
				return res.status(400).json({
					success: false,
					error:
						"At least one of overseasInvestmentFrozen or overseasETFFrozen must be provided as boolean",
				});
			}

			const aiMfModule = (await import(
				"../services/ai-mf-recommendation-service"
			)) as any;
			const AIMFRecommendationService = aiMfModule.AIMFRecommendationService;

			if (typeof overseasInvestmentFrozen === "boolean") {
				AIMFRecommendationService.updateOverseasInvestmentStatus(
					overseasInvestmentFrozen,
				);
			}

			if (typeof overseasETFFrozen === "boolean") {
				AIMFRecommendationService.updateOverseasETFStatus(overseasETFFrozen);
			}

			const status = AIMFRecommendationService.getOverseasInvestmentStatus();

			console.log(
				`[Regulatory] Admin ${req.user?.email} updated overseas investment status:`,
				status,
			);

			res.json({
				success: true,
				message: "Regulatory status updated",
				currentStatus: status,
				updatedBy: req.user?.email,
			});
		} catch (error: any) {
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

export function registerAIMFRecommendationRoutes(app: any) {
	app.use(router);
	console.log(
		"✅ AI MF Recommendation routes registered (with live data support)",
	);
}

export default router;
