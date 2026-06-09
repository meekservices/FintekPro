import { Router, Request, Response } from "express";
import { z } from "zod";
import { assetAllocationOptimizer } from "../services/asset-allocation-optimizer";
import {
	rebalancingEngine,
	RebalanceInput,
} from "../services/rebalancing-engine";
import {
	getCachedRebalanceSummary,
	cacheRebalanceSummary,
} from "../services/investment-cache-service";

const router = Router();

const optimizationInputSchema = z.object({
	riskScore: z.number().min(0).max(100),
	segment: z.enum(["retail", "hni", "shni", "bhni", "corporate"]),
	investableAmount: z.number().positive().optional(),
	investmentHorizon: z.number().min(1).max(50),
	goalType: z.enum(["growth", "income", "preservation", "balanced"]).optional(),
	liquidityNeeds: z.enum(["low", "medium", "high"]).optional(),
	taxBracket: z.enum(["low", "medium", "high"]).optional(),
	existingAllocations: z.record(z.string(), z.number()).optional(),
});

const rebalanceInputSchema = z.object({
	currentAllocations: z.record(z.string(), z.number()),
	targetAllocations: z.record(z.string(), z.number()),
	totalValue: z.number().positive(),
	threshold: z.number().min(0).max(100).optional(),
});

router.post("/optimize", async (req: Request, res: Response) => {
	try {
		const input = optimizationInputSchema.parse(req.body);
		const result = assetAllocationOptimizer.optimize(input);
		res.json({ success: true, data: result });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: error.issues,
			});
		}
		console.error("Optimization error:", error);
		res.status(500).json({
			success: false,
			error: error instanceof Error ? error.message : "Optimization failed",
		});
	}
});

router.get("/asset-classes", async (req: Request, res: Response) => {
	try {
		const segment = (req.query.segment as string) || "retail";
		const assetClasses =
			assetAllocationOptimizer.getAvailableAssetClasses(segment);
		res.json({ success: true, data: assetClasses });
	} catch (error) {
		console.error("Error fetching asset classes:", error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to fetch asset classes",
		});
	}
});

router.get(
	"/constraints/:riskScore/:segment",
	async (req: Request, res: Response) => {
		try {
			const riskScore = Number.parseInt(req.params.riskScore);
			const segment = req.params.segment;

			if (Number.isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
				return res.status(400).json({
					success: false,
					error: "Risk score must be between 0 and 100",
				});
			}

			const constraints = assetAllocationOptimizer.getConstraints(
				riskScore,
				segment,
			);
			const riskProfile = assetAllocationOptimizer.getRiskProfile(riskScore);

			res.json({
				success: true,
				data: {
					riskScore,
					riskProfile,
					segment,
					constraints,
				},
			});
		} catch (error) {
			console.error("Error fetching constraints:", error);
			res.status(500).json({
				success: false,
				error:
					error instanceof Error
						? error.message
						: "Failed to fetch constraints",
			});
		}
	},
);

router.post("/efficient-frontier", async (req: Request, res: Response) => {
	try {
		const input = optimizationInputSchema.parse(req.body);
		const points =
			typeof req.query.points === "string"
				? Number.parseInt(req.query.points)
				: 10;
		const frontier = assetAllocationOptimizer.generateEfficientFrontier(
			input,
			points,
		);
		res.json({ success: true, data: frontier });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: error.issues,
			});
		}
		console.error("Efficient frontier error:", error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Failed to generate efficient frontier",
		});
	}
});

router.post("/rebalance", async (req: Request, res: Response) => {
	try {
		const input = rebalanceInputSchema.parse(req.body);
		const trades = assetAllocationOptimizer.calculateRebalancingTrades(
			input.currentAllocations,
			input.targetAllocations,
			input.totalValue,
			input.threshold,
		);

		const totalBuys = trades
			.filter((t) => t.action === "buy")
			.reduce((sum, t) => sum + t.amount, 0);
		const totalSells = trades
			.filter((t) => t.action === "sell")
			.reduce((sum, t) => sum + t.amount, 0);

		res.json({
			success: true,
			data: {
				trades,
				summary: {
					totalBuys,
					totalSells,
					netCashFlow: totalSells - totalBuys,
					tradesRequired: trades.filter((t) => t.action !== "hold").length,
				},
			},
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: error.issues,
			});
		}
		console.error("Rebalancing error:", error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Rebalancing calculation failed",
		});
	}
});

router.get("/risk-profiles", async (_req: Request, res: Response) => {
	try {
		const profiles = [
			{
				name: "very_conservative",
				label: "Very Conservative",
				scoreRange: [0, 25],
				description: "Capital preservation with minimal risk",
			},
			{
				name: "conservative",
				label: "Conservative",
				scoreRange: [26, 40],
				description: "Low risk with focus on stability",
			},
			{
				name: "moderate",
				label: "Moderate",
				scoreRange: [41, 55],
				description: "Balanced approach to risk and return",
			},
			{
				name: "moderately_aggressive",
				label: "Moderately Aggressive",
				scoreRange: [56, 70],
				description: "Higher growth with managed risk",
			},
			{
				name: "aggressive",
				label: "Aggressive",
				scoreRange: [71, 85],
				description: "High growth potential with higher volatility",
			},
			{
				name: "very_aggressive",
				label: "Very Aggressive",
				scoreRange: [86, 100],
				description: "Maximum growth with highest risk tolerance",
			},
		];
		res.json({ success: true, data: profiles });
	} catch (error) {
		console.error("Error fetching risk profiles:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch risk profiles",
		});
	}
});

const comprehensiveRebalanceSchema = z.object({
	currentAllocations: z.record(z.string(), z.number()),
	currentValues: z.record(z.string(), z.number()).optional(),
	totalPortfolioValue: z.number().positive(),
	riskScore: z.number().min(0).max(100),
	segment: z.enum(["retail", "hni", "shni", "bhni", "corporate"]),
	investmentHorizon: z.number().min(1).max(50),
	goalType: z.enum(["growth", "income", "preservation", "balanced"]).optional(),
	driftThreshold: z.number().min(0).max(50).optional(),
	taxBracket: z.number().min(0).max(40).optional(),
	holdingPeriods: z.record(z.string(), z.number()).optional(),
	cashInflow: z.number().min(0).optional(),
	cashOutflow: z.number().min(0).optional(),
	rebalanceReason: z
		.enum([
			"DRIFT_THRESHOLD_EXCEEDED",
			"RISK_PROFILE_CHANGED",
			"GOAL_TIMELINE_CHANGED",
			"MARKET_CONDITIONS_SHIFT",
			"TAX_LOSS_HARVESTING",
			"CASH_INFLOW",
			"CASH_OUTFLOW",
			"REBALANCE_SCHEDULE",
			"CONSTRAINT_VIOLATION",
			"CONCENTRATION_RISK",
		])
		.optional(),
	targetAllocations: z.record(z.string(), z.number()).optional(),
});

router.post("/rebalance/analyze", async (req: Request, res: Response) => {
	try {
		const input = comprehensiveRebalanceSchema.parse(req.body);
		const userId = (req as any).user?.id;
		const portfolioId = req.body.portfolioId;

		// Check cache for pre-computed rebalance summary
		if (userId && portfolioId) {
			try {
				const cached = await getCachedRebalanceSummary(userId, portfolioId);
				if (cached && cached.status === "pending") {
					console.log(
						`📦 Cache HIT for rebalance analysis (user: ${userId}, portfolio: ${portfolioId})`,
					);
					// Reconstruct analysis from cached data
					const cachedAnalysis = {
						needsRebalance: cached.exceedsDriftThreshold || false,
						urgency: (cached.exceedsDriftThreshold ? "recommended" : "none") as
							| "immediate"
							| "recommended"
							| "optional"
							| "none",
						driftAnalysis: {
							maxDrift: Number.parseFloat(cached.totalDrift || "0"),
							equityDrift: 0,
							debtDrift: 0,
							portfolioRiskDrift: 0,
							averageDrift: Number.parseFloat(cached.totalDrift || "0"),
							assetDrifts: [],
						},
						trades: [
							...((cached.suggestedBuys as any[]) || []),
							...((cached.suggestedSells as any[]) || []),
						],
						summary: {
							totalBuyValue: 0,
							totalSellValue: 0,
							netCashFlow: 0,
							numberOfTrades: 0,
							estimatedTotalTax: 0,
							portfolioTurnover: 0,
						},
						constraints: {
							equityRange: {
								min: 0,
								max: 100,
								current: Number.parseFloat(cached.currentEquity || "0"),
								target: Number.parseFloat(cached.targetEquity || "0"),
								inRange: true,
							},
							debtRange: {
								min: 0,
								max: 100,
								current: Number.parseFloat(cached.currentDebt || "0"),
								target: Number.parseFloat(cached.targetDebt || "0"),
								inRange: true,
							},
							liquidityRange: {
								min: 0,
								max: 100,
								current: 0,
								target: 0,
								inRange: true,
							},
							singleAssetLimit: { max: 30, violations: [] },
						},
						recommendations: [],
					};
					res.json({
						success: true,
						data: cachedAnalysis,
						cached: true,
						cachedAt: cached.computedAt,
					});
					return;
				}
			} catch (cacheError) {
				console.warn("Rebalance cache lookup failed:", cacheError);
			}
		}

		const rebalanceInput: RebalanceInput = {
			...input,
			currentValues:
				input.currentValues ??
				Object.fromEntries(
					Object.entries(input.currentAllocations).map(([type, alloc]) => [
						type,
						(input.totalPortfolioValue * alloc) / 100,
					]),
				),
		};

		const analysis =
			await rebalancingEngine.analyzeAndRebalance(rebalanceInput);

		// Cache the result for future use
		if (userId && portfolioId) {
			const targetAllocations = analysis.trades.reduce(
				(acc, t) => {
					acc[t.assetType] = t.targetAllocation;
					return acc;
				},
				{} as Record<string, number>,
			);

			cacheRebalanceSummary(
				{
					userId,
					portfolioId,
					targetEquity: (targetAllocations.equity || 0).toString(),
					targetDebt: (targetAllocations.debt || 0).toString(),
					targetGold: (targetAllocations.gold || 0).toString(),
					targetCash: (targetAllocations.cash || 0).toString(),
					targetAlternatives: (targetAllocations.alternatives || 0).toString(),
					currentEquity: (input.currentAllocations.equity || 0).toString(),
					currentDebt: (input.currentAllocations.debt || 0).toString(),
					currentGold: (input.currentAllocations.gold || 0).toString(),
					currentCash: (input.currentAllocations.cash || 0).toString(),
					currentAlternatives: (
						input.currentAllocations.alternatives || 0
					).toString(),
					totalDrift: analysis.driftAnalysis.maxDrift.toString(),
					driftThreshold: (input.driftThreshold || 5).toString(),
					exceedsDriftThreshold:
						analysis.driftAnalysis.maxDrift > (input.driftThreshold || 5),
					suggestedBuys: analysis.trades.filter((t) => t.action === "buy"),
					suggestedSells: analysis.trades.filter((t) => t.action === "sell"),
					status: "pending",
				},
				4, // 4-hour TTL
			).catch((err) =>
				console.warn("Failed to cache rebalance analysis:", err),
			);
		}

		res.json({
			success: true,
			data: analysis,
			cached: false,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: error.issues,
			});
		}
		console.error("Rebalancing analysis error:", error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error ? error.message : "Rebalancing analysis failed",
		});
	}
});

router.post("/rebalance/simulate", async (req: Request, res: Response) => {
	try {
		const input = comprehensiveRebalanceSchema.parse(req.body);

		const rebalanceInput: RebalanceInput = {
			...input,
			currentValues:
				input.currentValues ??
				Object.fromEntries(
					Object.entries(input.currentAllocations).map(([type, alloc]) => [
						type,
						(input.totalPortfolioValue * alloc) / 100,
					]),
				),
		};

		const simulation = rebalancingEngine.simulateRebalance(rebalanceInput);

		res.json({
			success: true,
			data: simulation,
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return res.status(400).json({
				success: false,
				error: "Validation failed",
				details: error.issues,
			});
		}
		console.error("Rebalancing simulation error:", error);
		res.status(500).json({
			success: false,
			error:
				error instanceof Error
					? error.message
					: "Rebalancing simulation failed",
		});
	}
});

router.get("/rebalance/reason-codes", async (_req: Request, res: Response) => {
	try {
		const reasonCodes = [
			{
				code: "DRIFT_THRESHOLD_EXCEEDED",
				label: "Drift Threshold Exceeded",
				description: "Allocation has drifted beyond acceptable threshold",
			},
			{
				code: "RISK_PROFILE_CHANGED",
				label: "Risk Profile Changed",
				description: "Your risk profile has changed",
			},
			{
				code: "GOAL_TIMELINE_CHANGED",
				label: "Goal Timeline Changed",
				description: "Your investment timeline has changed",
			},
			{
				code: "MARKET_CONDITIONS_SHIFT",
				label: "Market Conditions Shift",
				description: "Market conditions warrant adjustment",
			},
			{
				code: "TAX_LOSS_HARVESTING",
				label: "Tax Loss Harvesting",
				description: "Opportunity for tax-loss harvesting",
			},
			{
				code: "CASH_INFLOW",
				label: "Cash Inflow",
				description: "New cash available for investment",
			},
			{
				code: "CASH_OUTFLOW",
				label: "Cash Outflow",
				description: "Cash withdrawal required",
			},
			{
				code: "REBALANCE_SCHEDULE",
				label: "Scheduled Rebalance",
				description: "Scheduled periodic rebalancing",
			},
			{
				code: "CONSTRAINT_VIOLATION",
				label: "Constraint Violation",
				description: "Portfolio constraints are violated",
			},
			{
				code: "CONCENTRATION_RISK",
				label: "Concentration Risk",
				description: "Position exceeds concentration limits",
			},
		];
		res.json({ success: true, data: reasonCodes });
	} catch (error) {
		console.error("Error fetching reason codes:", error);
		res.status(500).json({
			success: false,
			error: "Failed to fetch reason codes",
		});
	}
});

export default router;
