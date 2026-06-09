import { Router, Request, Response } from "express";
import {
	aiCommodityRecommendationService,
	CommodityRecommendationParams,
} from "../services/ai-commodity-recommendation-service";
import { db } from "../db";
import { storeCategories } from "@shared/schema";
import { eq, or } from "drizzle-orm";

const router = Router();

async function isCommoditiesCategoryEnabled(): Promise<boolean> {
	try {
		const categories = await db
			.select()
			.from(storeCategories)
			.where(
				or(
					eq(storeCategories.slug, "commodities"),
					eq(storeCategories.name, "Commodities"),
				),
			)
			.limit(1);

		if (categories.length === 0) return true;
		return categories[0].isEnabled !== false;
	} catch (e) {
		console.warn("[AI Commodity] Error checking category status:", e);
		return true;
	}
}

router.post("/generate", async (req: Request, res: Response) => {
	try {
		const categoryEnabled = await isCommoditiesCategoryEnabled();
		if (!categoryEnabled) {
			return res.json({
				success: true,
				data: {
					commodities: [],
					allocation: [],
					summary: "Commodities category is currently not available",
				},
				categoryStatus: "disabled",
				generatedAt: new Date().toISOString(),
			});
		}

		const params: CommodityRecommendationParams = {
			investmentAmount: req.body.investmentAmount || 100000,
			investmentHorizon: req.body.investmentHorizon || "medium",
			riskTolerance: req.body.riskTolerance || "moderate",
			preferredCommodityTypes: req.body.preferredCommodityTypes || [
				"precious_metal",
				"energy",
			],
			investmentVehicle: req.body.investmentVehicle || "any",
			inflationProtection: req.body.inflationProtection ?? true,
			safeHavenAllocation: req.body.safeHavenAllocation ?? false,
			portfolioDiversification: req.body.portfolioDiversification ?? true,
			clientId: req.body.clientId,
		};

		if (params.investmentAmount < 1000) {
			return res.status(400).json({
				error:
					"Minimum investment amount for commodity recommendations is ₹1,000",
			});
		}

		const recommendations =
			await aiCommodityRecommendationService.generateRecommendations(params);

		res.json({
			success: true,
			data: recommendations,
			generatedAt: new Date().toISOString(),
			parameters: params,
		});
	} catch (error: any) {
		console.error("Error generating commodity recommendations:", error);
		res.status(500).json({
			error: "Failed to generate commodity recommendations",
			message: error.message,
		});
	}
});

router.get("/parameters", (req: Request, res: Response) => {
	res.json({
		investmentHorizon: [
			{
				value: "short",
				label: "Short Term (< 1 year)",
				description: "Higher volatility, tactical allocation",
			},
			{
				value: "medium",
				label: "Medium Term (1-3 years)",
				description: "Balanced approach",
			},
			{
				value: "long",
				label: "Long Term (> 3 years)",
				description: "Strategic allocation, wealth preservation",
			},
		],
		riskTolerance: [
			{
				value: "conservative",
				label: "Conservative",
				description: "Focus on precious metals and low volatility",
			},
			{
				value: "moderately_conservative",
				label: "Moderately Conservative",
				description: "Precious metals with some diversification",
			},
			{
				value: "moderate",
				label: "Moderate",
				description: "Balanced commodity exposure",
			},
			{
				value: "moderately_aggressive",
				label: "Moderately Aggressive",
				description: "Higher energy and industrial exposure",
			},
			{
				value: "aggressive",
				label: "Aggressive",
				description: "Maximum diversification including futures",
			},
		],
		commodityTypes: [
			{
				value: "precious_metal",
				label: "Precious Metals",
				description: "Gold, Silver, Platinum, Palladium",
			},
			{
				value: "energy",
				label: "Energy",
				description: "Crude Oil, Natural Gas",
			},
			{
				value: "industrial_metal",
				label: "Industrial Metals",
				description: "Copper, Aluminum, Zinc",
			},
			{
				value: "agricultural",
				label: "Agricultural",
				description: "Wheat, Cotton, Soybeans",
			},
		],
		investmentVehicles: [
			{
				value: "any",
				label: "Any Available",
				description: "Best suited vehicle for each commodity",
			},
			{
				value: "etf",
				label: "ETFs",
				description: "Exchange traded funds for easy liquidity",
			},
			{
				value: "sgb",
				label: "Sovereign Gold Bonds",
				description: "Government-backed gold investment with interest",
			},
			{
				value: "physical",
				label: "Physical",
				description: "Physical ownership of commodity",
			},
			{
				value: "futures",
				label: "Futures",
				description: "Derivative contracts for advanced investors",
			},
		],
		minimumInvestment: 1000,
		currency: "INR",
	});
});

router.get("/client/:clientId", async (req: Request, res: Response) => {
	try {
		const { clientId } = req.params;
		const profile =
			await aiCommodityRecommendationService.getClientCommodityProfile(
				clientId,
			);

		if (!profile) {
			return res.status(404).json({ error: "Client profile not found" });
		}

		const recommendations =
			await aiCommodityRecommendationService.generateRecommendations(profile);

		res.json({
			success: true,
			data: recommendations,
			clientId,
			generatedAt: new Date().toISOString(),
		});
	} catch (error: any) {
		console.error("Error generating client commodity recommendations:", error);
		res.status(500).json({
			error: "Failed to generate commodity recommendations",
			message: error.message,
		});
	}
});

export default router;
