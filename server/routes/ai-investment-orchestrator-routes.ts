import { Express, Request, Response } from "express";
import { aiInvestmentOrchestrator } from "../services/ai-investment-orchestrator-service";
import { investmentDataCache } from "../services/investment-data-cache";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import {
	ClientProfile,
	UnifiedProductType,
	RiskLevel,
} from "@shared/unified-investment-product";

export function registerAIInvestmentOrchestratorRoutes(app: Express) {
	app.post(
		"/api/ai-recommendations/basket",
		async (req: Request, res: Response) => {
			try {
				const { clientProfile, investmentAmount, productTypes, marketContext } =
					req.body;

				if (!clientProfile || !investmentAmount) {
					return res.status(400).json({
						error: "clientProfile and investmentAmount are required",
					});
				}

				const basket =
					await aiInvestmentOrchestrator.generateRecommendationBasket(
						clientProfile as ClientProfile,
						investmentAmount,
						productTypes as UnifiedProductType[] | undefined,
						marketContext,
					);

				res.json({
					success: true,
					basket,
					meta: {
						generated_at: new Date().toISOString(),
						product_count: basket.products.length,
						total_investment: investmentAmount,
					},
				});
			} catch (error: any) {
				console.error("Error generating recommendation basket:", error);
				res.status(500).json({
					error: "Failed to generate recommendation basket",
					message: error.message,
				});
			}
		},
	);

	app.get(
		"/api/ai-recommendations/quick",
		async (req: Request, res: Response) => {
			try {
				const { riskLevel = "moderate", productTypes, limit = "5" } = req.query;

				const types = productTypes
					? ((productTypes as string).split(",") as UnifiedProductType[])
					: undefined;

				const recommendations =
					await aiInvestmentOrchestrator.getQuickRecommendations(
						riskLevel as RiskLevel,
						types,
						Number.parseInt(limit as string),
					);

				res.json({
					success: true,
					recommendations,
					meta: {
						risk_level: riskLevel,
						count: recommendations.length,
					},
				});
			} catch (error: any) {
				console.error("Error fetching quick recommendations:", error);
				res.status(500).json({
					error: "Failed to fetch recommendations",
					message: error.message,
				});
			}
		},
	);

	app.get(
		"/api/ai-recommendations/cache/metrics",
		async (req: Request, res: Response) => {
			try {
				const orchestratorMetrics = aiInvestmentOrchestrator.getCacheMetrics();
				const dataCacheMetrics = investmentDataCache.getMetrics();
				res.json({
					success: true,
					orchestrator: orchestratorMetrics,
					dataCache: dataCacheMetrics,
				});
			} catch (error: any) {
				res.status(500).json({ error: "Failed to get cache metrics" });
			}
		},
	);

	app.post(
		"/api/ai-recommendations/cache/clear",
		async (req: Request, res: Response) => {
			try {
				aiInvestmentOrchestrator.clearCache();
				investmentDataCache.invalidate();
				res.json({
					success: true,
					message: "All caches cleared successfully",
				});
			} catch (error: any) {
				res.status(500).json({ error: "Failed to clear cache" });
			}
		},
	);

	app.get(
		"/api/admin/ai-recommendations/dashboard",
		requireAuth,
		requireRole(["admin"]),
		async (req: Request, res: Response) => {
			try {
				const orchestratorMetrics = aiInvestmentOrchestrator.getCacheMetrics();
				const dataCacheMetrics = investmentDataCache.getMetrics();

				const dashboard = {
					status: "operational",
					timestamp: new Date().toISOString(),
					cache: {
						orchestrator: orchestratorMetrics,
						dataCache: dataCacheMetrics,
					},
					health: {
						cacheHitRate: dataCacheMetrics.hitRate,
						totalProducts: dataCacheMetrics.totalProducts,
						errorCount: dataCacheMetrics.errors,
						lastRefreshTimes: dataCacheMetrics.lastRefreshTime,
					},
					features: {
						aiRationaleEnabled: true,
						cachingEnabled: true,
						backgroundRefreshEnabled: true,
					},
				};

				res.json({
					success: true,
					dashboard,
				});
			} catch (error: any) {
				res.status(500).json({ error: "Failed to get dashboard metrics" });
			}
		},
	);

	const isProduction =
		process.env.NODE_ENV === "production" ||
		process.env.REPLIT_DEPLOYMENT === "1";
	if (isProduction) {
		investmentDataCache.initialize().catch((err) => {
			console.error("❌ Failed to initialize investment data cache:", err);
		});
	} else {
		console.log(
			"⏭️ [InvestmentDataCache] Initialization skipped (development mode - production only)",
		);
	}

	console.log("✅ AI Investment Orchestrator routes registered");
}
