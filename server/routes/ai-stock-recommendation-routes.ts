import { Express, Request, Response } from "express";
import {
	aiStockRecommendationService,
	StockRecommendationFilters,
} from "../services/ai-stock-recommendation-service";
import { z } from "zod";
import { db } from "../db";
import { storeCategories, dailyPicks } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import { logger } from "../logger";

// Helper to check if Stocks category is enabled for recommendations
async function isStocksCategoryEnabled(): Promise<boolean> {
	try {
		const categories = await db
			.select()
			.from(storeCategories)
			.where(
				or(
					eq(storeCategories.slug, "stocks"),
					eq(storeCategories.name, "Stocks"),
				),
			)
			.limit(1);

		if (categories.length === 0) return true;
		return categories[0].isEnabled !== false;
	} catch (e) {
		console.warn("[AI Stock] Error checking category status:", e);
		return true;
	}
}

/**
 * Persists buy/strong_buy AI stock recommendations into daily_picks
 * so they appear in the Live Recommendations tracker.
 * Idempotent — uses onConflictDoNothing().
 */
async function persistRecommendationsAsLivePicks(
	recommendations: any[],
	riskLevel: string,
	timeHorizon: string,
): Promise<number> {
	const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
	const todayIST = new Date(Date.now() + IST_OFFSET_MS)
		.toISOString()
		.split("T")[0];

	// Only save buy/strong_buy signals (not hold/sell)
	const toBePersisted = recommendations.filter(
		(r) => r.signal === "buy" || r.signal === "strong_buy",
	);

	let saved = 0;
	for (const r of toBePersisted) {
		try {
			// Expiry: medium_term → 90 days, short_term → 30 days, long_term → 365 days
			const horizonDays =
				timeHorizon === "short_term"
					? 30
					: timeHorizon === "long_term"
						? 365
						: 90;
			const expiryDate = new Date(Date.now() + IST_OFFSET_MS + horizonDays * 86400000)
				.toISOString()
				.split("T")[0];

			const riskMap: Record<string, string> = {
				conservative: "low",
				moderate: "medium",
				aggressive: "high",
				very_aggressive: "very_high",
			};

			await db
				.insert(dailyPicks)
				.values({
					category: "listed_stocks",
					instrumentId: r.id || null,
					instrumentName: r.companyName,
					symbol: r.symbol || null,
					exchange: r.exchange || "NSE",
					recoDate: todayIST,
					recoPrice: (r.entryPrice ?? r.currentPrice).toFixed(4),
					targetPrice: r.targetPrice.toFixed(4),
					stoplossPrice: r.stopLoss.toFixed(4),
					currentPrice: r.currentPrice.toFixed(4),
					status: "live",
					expiryDate,
					rationale: r.rationale || `${r.companyName} – AI ${r.signal} signal`,
					riskLevel: riskMap[riskLevel] || "medium",
					suitableFor: ["Balanced", "Growth"],
					timeHorizon: timeHorizon || "medium_term",
					confidenceScore: Math.round((r.confidence ?? 0.7) * 100),
					sectorCategory: r.sector || null,
					generatedBy: "ai",
					keyMetrics: {
						signal: r.signal,
						fintekproRating: r.fintekproRating,
						riskScore: r.riskScore,
						expectedReturn: r.expectedReturn,
						marketCap: r.marketCap,
						peRatio: r.fundamentals?.peRatio,
						roe: r.fundamentals?.roe,
						rsi: r.technicals?.rsi,
						keyFactors: r.keyFactors,
					},
					updatedAt: new Date(),
				})
				.onConflictDoNothing();
			saved++;
		} catch (err) {
			logger.warn(
				`[AI Stock Persist] Could not save pick for ${r.symbol}: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}

	if (saved > 0) {
		logger.info(
			`[AI Stock Persist] Saved ${saved}/${toBePersisted.length} buy signals to daily_picks for ${todayIST}`,
		);
	}
	return saved;
}

const filtersSchema = z.object({
	sectors: z.array(z.string()).optional(),
	marketCap: z.array(z.string()).optional(),
	riskLevel: z
		.enum(["conservative", "moderate", "aggressive", "very_aggressive"])
		.optional(),
	timeHorizon: z
		.enum(["intraday", "short_term", "medium_term", "long_term"])
		.optional(),
	investmentAmount: z.number().positive().optional(),
	signalTypes: z.array(z.enum(["buy", "sell", "hold"])).optional(),
	minFintekproRating: z.number().min(1).max(5).optional(),
	maxResults: z.number().min(1).max(20).optional(),
	includeAIAnalysis: z.boolean().optional(),
});

export function registerAIStockRecommendationRoutes(app: Express): void {
	app.post(
		"/api/ai-stock-recommendations/generate",
		async (req: Request, res: Response) => {
			try {
				// Check if Stocks category is enabled
				const categoryEnabled = await isStocksCategoryEnabled();
				if (!categoryEnabled) {
					return res.json({
						success: true,
						count: 0,
						recommendations: [],
						categoryStatus: "disabled",
						message: "Stocks category is currently not available",
						generatedAt: new Date().toISOString(),
					});
				}

				const filters = filtersSchema.parse(req.body);
				const recommendations =
					await aiStockRecommendationService.getSmartRecommendations(filters);

				// ── Persist buy/strong_buy picks to daily_picks (Live Recommendations) ──
				// Fire-and-forget: don't block the response if persistence fails
				persistRecommendationsAsLivePicks(
					recommendations,
					filters.riskLevel || "moderate",
					filters.timeHorizon || "medium_term",
				).catch((err) =>
					logger.warn(
						`[AI Stock Persist] Background persist failed: ${err instanceof Error ? err.message : String(err)}`,
					),
				);

				res.json({
					success: true,
					count: recommendations.length,
					generatedAt: new Date().toISOString(),
					filters: {
						sectors: filters.sectors || "All",
						marketCap: filters.marketCap || "All",
						riskLevel: filters.riskLevel || "moderate",
						timeHorizon: filters.timeHorizon || "medium_term",
					},
					recommendations,
				});
			} catch (error: any) {
				console.error("Error generating stock recommendations:", error);
				res.status(500).json({
					success: false,
					error: error.message || "Failed to generate recommendations",
				});
			}
		},
	);

	app.get(
		"/api/ai-stock-recommendations/quick",
		async (_req: Request, res: Response) => {
			try {
				const recommendations =
					await aiStockRecommendationService.getSmartRecommendations({
						maxResults: 5,
						riskLevel: "moderate",
						timeHorizon: "medium_term",
						signalTypes: ["buy"],
					});

				res.json({
					success: true,
					count: recommendations.length,
					recommendations,
				});
			} catch (error: any) {
				console.error("Error fetching quick recommendations:", error);
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/ai-stock-recommendations/stock/:symbol",
		async (req: Request, res: Response) => {
			try {
				const { symbol } = req.params;
				const recommendation = await aiStockRecommendationService.getStockById(
					symbol.toUpperCase(),
				);

				if (!recommendation) {
					return res
						.status(404)
						.json({ success: false, error: "Stock not found" });
				}

				res.json({
					success: true,
					recommendation,
				});
			} catch (error: any) {
				console.error("Error fetching stock recommendation:", error);
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/ai-stock-recommendations/sector/:sector",
		async (req: Request, res: Response) => {
			try {
				const { sector } = req.params;
				const recommendations =
					await aiStockRecommendationService.getSectorRecommendations(sector);

				res.json({
					success: true,
					sector,
					count: recommendations.length,
					recommendations,
				});
			} catch (error: any) {
				console.error("Error fetching sector recommendations:", error);
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	app.get(
		"/api/ai-stock-recommendations/filters",
		async (_req: Request, res: Response) => {
			res.json({
				success: true,
				sectors: [
					"Banking",
					"IT",
					"FMCG",
					"Pharma",
					"Energy",
					"Automobile",
					"Infrastructure",
					"Telecom",
					"Metals",
					"Consumer",
					"Real Estate",
					"Chemicals",
					"Cement",
					"Power",
					"Oil & Gas",
				],
				marketCaps: ["Large Cap", "Mid Cap", "Small Cap"],
				riskLevels: [
					"conservative",
					"moderate",
					"aggressive",
					"very_aggressive",
				],
				timeHorizons: ["intraday", "short_term", "medium_term", "long_term"],
				signalTypes: ["buy", "hold", "sell"],
			});
		},
	);

	app.post(
		"/api/ai-stock-recommendations/clear-cache",
		async (_req: Request, res: Response) => {
			try {
				aiStockRecommendationService.clearCache();
				res.json({ success: true, message: "Cache cleared successfully" });
			} catch (error: any) {
				res.status(500).json({ success: false, error: error.message });
			}
		},
	);

	console.log("✅ AI Stock Recommendation routes registered");
}
