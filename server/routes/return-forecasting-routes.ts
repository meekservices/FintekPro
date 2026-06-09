/**
 * Return Forecasting Engine API Routes
 *
 * Provides endpoints for:
 * - CAGR calculation
 * - IRR/XIRR calculation
 * - Stress testing
 * - Drawdown analysis
 * - Forward projections
 * - Comprehensive returns analysis
 */

import { Router } from "express";
import {
	returnForecastingEngine,
	AssetReturns,
	CashFlow,
} from "../services/return-forecasting-engine";
import { z } from "zod";

const router = Router();

// Input validation schemas
const assetReturnsSchema = z.object({
	assetId: z.string(),
	assetType: z.enum([
		"equity",
		"mutual_fund",
		"bond",
		"fd",
		"etf",
		"real_estate",
		"gold",
		"alternative",
	]),
	assetName: z.string(),
	currentValue: z.number().positive(),
	investedAmount: z.number().positive(),
	inceptionDate: z.string().transform((s) => new Date(s)),
	historicalReturns: z.array(z.number()).optional(),
	dividendYield: z.number().optional(),
	couponRate: z.number().optional(),
});

const cashFlowSchema = z.object({
	date: z.string().transform((s) => new Date(s)),
	amount: z.number(),
});

const cagrInputSchema = z.object({
	beginningValue: z.number().positive(),
	endingValue: z.number().positive(),
	years: z.number().positive(),
});

const irrInputSchema = z.object({
	cashFlows: z.array(cashFlowSchema),
	finalValue: z.number().positive(),
});

const portfolioInputSchema = z.object({
	assets: z.array(assetReturnsSchema),
});

// GET /api/returns/calculate-cagr - Calculate CAGR
router.post("/calculate-cagr", async (req, res) => {
	try {
		const input = cagrInputSchema.parse(req.body);
		const cagr = returnForecastingEngine.calculateCAGR(
			input.beginningValue,
			input.endingValue,
			input.years,
		);

		res.json({
			success: true,
			data: {
				cagr,
				beginningValue: input.beginningValue,
				endingValue: input.endingValue,
				years: input.years,
				totalGain: input.endingValue - input.beginningValue,
				absoluteReturn:
					((input.endingValue - input.beginningValue) / input.beginningValue) *
					100,
			},
		});
	} catch (error) {
		console.error("CAGR calculation error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/calculate-irr - Calculate IRR/XIRR
router.post("/calculate-irr", async (req, res) => {
	try {
		const input = irrInputSchema.parse(req.body);
		const irrResult = await returnForecastingEngine.calculateIRR(
			input.cashFlows as CashFlow[],
			input.finalValue,
		);

		res.json({
			success: true,
			data: irrResult,
		});
	} catch (error) {
		console.error("IRR calculation error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/asset-metrics - Get comprehensive return metrics for an asset
router.post("/asset-metrics", async (req, res) => {
	try {
		const asset = assetReturnsSchema.parse(req.body);
		const returnMetrics = returnForecastingEngine.calculateReturnMetrics(
			asset as AssetReturns,
		);
		const yieldMetrics = returnForecastingEngine.calculateYieldMetrics(
			asset as AssetReturns,
		);
		const riskAdjusted = returnForecastingEngine.calculateRiskAdjustedReturns(
			asset as AssetReturns,
		);

		res.json({
			success: true,
			data: {
				asset: {
					id: asset.assetId,
					name: asset.assetName,
					type: asset.assetType,
				},
				returnMetrics,
				yieldMetrics,
				riskAdjustedReturns: riskAdjusted,
			},
		});
	} catch (error) {
		console.error("Asset metrics error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/stress-test - Run stress tests on an asset
router.post("/stress-test", async (req, res) => {
	try {
		const asset = assetReturnsSchema.parse(req.body);
		const stressTests = returnForecastingEngine.runStressTests(
			asset as AssetReturns,
		);

		res.json({
			success: true,
			data: {
				asset: {
					id: asset.assetId,
					name: asset.assetName,
					type: asset.assetType,
					currentValue: asset.currentValue,
				},
				stressTests,
				worstCase: stressTests.reduce((min, s) =>
					s.projectedReturn < min.projectedReturn ? s : min,
				),
				bestCase: stressTests.reduce((max, s) =>
					s.projectedReturn > max.projectedReturn ? s : max,
				),
			},
		});
	} catch (error) {
		console.error("Stress test error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/drawdown - Calculate drawdown metrics
router.post("/drawdown", async (req, res) => {
	try {
		const { historicalReturns } = z
			.object({
				historicalReturns: z.array(z.number()),
			})
			.parse(req.body);

		const drawdownMetrics =
			returnForecastingEngine.calculateDrawdownMetrics(historicalReturns);

		res.json({
			success: true,
			data: drawdownMetrics,
		});
	} catch (error) {
		console.error("Drawdown calculation error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/projections - Generate forward projections
router.post("/projections", async (req, res) => {
	try {
		const input = z
			.object({
				asset: assetReturnsSchema,
				horizons: z.array(z.number().positive()).optional(),
			})
			.parse(req.body);

		const projections = await returnForecastingEngine.generateProjections(
			input.asset as AssetReturns,
			input.horizons,
		);

		res.json({
			success: true,
			data: {
				asset: {
					id: input.asset.assetId,
					name: input.asset.assetName,
					currentValue: input.asset.currentValue,
				},
				projections,
			},
		});
	} catch (error) {
		console.error("Projections error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/comprehensive - Get comprehensive analysis
router.post("/comprehensive", async (req, res) => {
	try {
		const input = z
			.object({
				asset: assetReturnsSchema,
				cashFlows: z.array(cashFlowSchema).optional(),
			})
			.parse(req.body);

		const comprehensive = returnForecastingEngine.getComprehensiveReturns(
			input.asset as AssetReturns,
			input.cashFlows as CashFlow[] | undefined,
		);

		res.json({
			success: true,
			data: comprehensive,
		});
	} catch (error) {
		console.error("Comprehensive analysis error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// POST /api/returns/portfolio - Calculate portfolio-level returns
router.post("/portfolio", async (req, res) => {
	try {
		const input = portfolioInputSchema.parse(req.body);
		const portfolioReturns = returnForecastingEngine.calculatePortfolioReturns(
			input.assets as AssetReturns[],
		);

		// Get individual asset metrics
		const assetMetrics = input.assets.map((asset) => ({
			id: asset.assetId,
			name: asset.assetName,
			type: asset.assetType,
			weight: (asset.currentValue / portfolioReturns.currentValue) * 100,
			metrics: returnForecastingEngine.calculateReturnMetrics(
				asset as AssetReturns,
			),
		}));

		res.json({
			success: true,
			data: {
				portfolio: portfolioReturns,
				assets: assetMetrics,
			},
		});
	} catch (error) {
		console.error("Portfolio analysis error:", error);
		res.status(400).json({
			success: false,
			error: error instanceof z.ZodError ? error.issues : "Invalid input",
		});
	}
});

// GET /api/returns/asset-classes - Get asset class parameters
router.get("/asset-classes", async (_req, res) => {
	try {
		const assetClasses = [
			{
				type: "equity",
				name: "Equity/Stocks",
				expectedReturn: 12.0,
				volatility: 18.0,
				riskLevel: "high",
			},
			{
				type: "mutual_fund",
				name: "Mutual Funds",
				expectedReturn: 10.0,
				volatility: 14.0,
				riskLevel: "medium-high",
			},
			{
				type: "bond",
				name: "Bonds",
				expectedReturn: 7.0,
				volatility: 4.0,
				riskLevel: "low",
			},
			{
				type: "fd",
				name: "Fixed Deposits",
				expectedReturn: 6.5,
				volatility: 0.5,
				riskLevel: "very-low",
			},
			{
				type: "etf",
				name: "ETFs",
				expectedReturn: 11.0,
				volatility: 16.0,
				riskLevel: "medium-high",
			},
			{
				type: "real_estate",
				name: "Real Estate",
				expectedReturn: 8.0,
				volatility: 10.0,
				riskLevel: "medium",
			},
			{
				type: "gold",
				name: "Gold",
				expectedReturn: 6.0,
				volatility: 12.0,
				riskLevel: "medium",
			},
			{
				type: "alternative",
				name: "Alternatives",
				expectedReturn: 15.0,
				volatility: 25.0,
				riskLevel: "very-high",
			},
		];

		res.json({
			success: true,
			data: assetClasses,
		});
	} catch (error) {
		console.error("Asset classes error:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch asset classes" });
	}
});

// GET /api/returns/stress-scenarios - Get available stress test scenarios
router.get("/stress-scenarios", async (_req, res) => {
	try {
		const scenarios = [
			{
				name: "market_crash",
				description: "Severe market crash similar to 2008 financial crisis",
				probability: 0.05,
				severity: "extreme",
			},
			{
				name: "moderate_correction",
				description: "Moderate market correction (10-20% decline)",
				probability: 0.15,
				severity: "moderate",
			},
			{
				name: "stagflation",
				description: "High inflation with low growth environment",
				probability: 0.1,
				severity: "high",
			},
			{
				name: "deflation",
				description: "Deflationary environment with declining prices",
				probability: 0.05,
				severity: "high",
			},
			{
				name: "bull_market",
				description: "Strong bull market with sustained growth",
				probability: 0.2,
				severity: "positive",
			},
		];

		res.json({
			success: true,
			data: scenarios,
		});
	} catch (error) {
		console.error("Stress scenarios error:", error);
		res
			.status(500)
			.json({ success: false, error: "Failed to fetch stress scenarios" });
	}
});

export default router;
