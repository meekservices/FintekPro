/**
 * Intrinsic Value API Routes
 *
 * Provides endpoints for calculating intrinsic value of stocks using multiple methods:
 * - DCF (Discounted Cash Flow)
 * - Graham's Intrinsic Value Formula
 * - Relative Valuation (Sector Comparables)
 * - Book Value Approach
 *
 * Returns full audit trails for regulatory compliance.
 */

import { Router, Request, Response } from "express";
import { intrinsicValueCalculator } from "../services/intrinsic-value-calculator";

const router = Router();

/**
 * GET /api/stocks/:symbol/intrinsic-value
 *
 * Calculate intrinsic value for a listed stock
 * Returns all valuation methods with confidence scores and audit trail
 */
router.get(
	"/stocks/:symbol/intrinsic-value",
	async (req: Request, res: Response) => {
		try {
			const { symbol } = req.params;

			if (!symbol || typeof symbol !== "string") {
				return res.status(400).json({
					success: false,
					error: "Stock symbol is required",
				});
			}

			console.log(
				`[IntrinsicValue API] Calculating for listed stock: ${symbol}`,
			);

			const result = await intrinsicValueCalculator.calculateListedStockValue(
				symbol.toUpperCase(),
			);

			return res.json({
				success: true,
				data: result,
				meta: {
					requestedAt: new Date().toISOString(),
					symbol: symbol.toUpperCase(),
					stockType: "listed",
				},
			});
		} catch (error) {
			console.error("[IntrinsicValue API] Error:", error);
			return res.status(500).json({
				success: false,
				error: "Failed to calculate intrinsic value",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},
);

/**
 * GET /api/unlisted/:companyId/intrinsic-value
 *
 * Calculate intrinsic value for an unlisted company using MCA data
 * Returns all valuation methods with confidence scores and audit trail
 */
router.get(
	"/unlisted/:companyId/intrinsic-value",
	async (req: Request, res: Response) => {
		try {
			const { companyId } = req.params;

			if (!companyId || typeof companyId !== "string") {
				return res.status(400).json({
					success: false,
					error: "Company ID is required",
				});
			}

			console.log(
				`[IntrinsicValue API] Calculating for unlisted company: ${companyId}`,
			);

			const result =
				await intrinsicValueCalculator.calculateUnlistedStockValue(companyId);

			return res.json({
				success: true,
				data: result,
				meta: {
					requestedAt: new Date().toISOString(),
					companyId,
					stockType: "unlisted",
				},
			});
		} catch (error) {
			console.error("[IntrinsicValue API] Error:", error);
			return res.status(500).json({
				success: false,
				error: "Failed to calculate intrinsic value",
				details: error instanceof Error ? error.message : "Unknown error",
			});
		}
	},
);

/**
 * GET /api/intrinsic-value/methods
 *
 * Returns documentation about available valuation methods and their formulas
 */
router.get("/intrinsic-value/methods", (_req: Request, res: Response) => {
	return res.json({
		success: true,
		methods: [
			{
				id: "dcf",
				name: "Discounted Cash Flow (DCF)",
				description:
					"Projects future free cash flows and discounts them to present value using WACC",
				formula: "EV = Σ(FCF_t / (1 + WACC)^t) + TV / (1 + WACC)^n",
				inputs: [
					"Free Cash Flow history",
					"WACC components (beta, risk-free rate, equity risk premium)",
					"Terminal growth rate",
				],
				bestFor: "Companies with stable, positive cash flows",
				limitations:
					"Sensitive to growth rate and WACC assumptions; not suitable for negative FCF companies",
			},
			{
				id: "graham",
				name: "Graham's Intrinsic Value Formula",
				description:
					"Benjamin Graham's formula relating earnings, growth, and bond yields",
				formula: "V = EPS × (8.5 + 2g) × (4.4/Y)",
				inputs: [
					"EPS (Earnings Per Share)",
					"Expected growth rate (g)",
					"AAA bond yield (Y)",
				],
				bestFor: "Value investing approach for stable companies",
				limitations:
					"Assumes linear relationship between growth and value; may overvalue high-growth stocks",
			},
			{
				id: "relative",
				name: "Relative Valuation",
				description: "Compares company valuation multiples to sector averages",
				formula: "Fair Value = Metric × Sector Average Multiple",
				inputs: ["EPS or BVPS", "Sector average P/E, P/B, EV/EBITDA"],
				bestFor: "Quick comparisons within similar companies",
				limitations:
					"Assumes sector is correctly valued; ignores company-specific factors",
			},
			{
				id: "book_value",
				name: "Book Value / NAV Approach",
				description: "Values company based on net assets with margin of safety",
				formula:
					"Intrinsic = (Assets - Liabilities - Intangibles) / Shares × (1 - MoS)",
				inputs: [
					"Total Assets",
					"Total Liabilities",
					"Intangible Assets",
					"Shares Outstanding",
				],
				bestFor:
					"Asset-heavy companies, financial institutions, liquidation value",
				limitations:
					"Ignores earning power and growth potential; book values may not reflect market values",
			},
		],
		constants: {
			riskFreeRate: "7.10% (10Y G-Sec yield proxy)",
			equityRiskPremium: "5.5% (India equity risk premium)",
			terminalGrowthRate: "3.0% (perpetual growth assumption)",
			aaaBondYield: "7.5% (AAA corporate bond yield)",
			grahamNoGrowthPE: 8.5,
			defaultMarginOfSafety: "25%",
		},
	});
});

/**
 * POST /api/intrinsic-value/batch
 *
 * Calculate intrinsic values for multiple stocks at once
 */
router.post("/intrinsic-value/batch", async (req: Request, res: Response) => {
	try {
		const { stocks } = req.body;

		if (!Array.isArray(stocks) || stocks.length === 0) {
			return res.status(400).json({
				success: false,
				error: "Array of stocks is required",
			});
		}

		if (stocks.length > 20) {
			return res.status(400).json({
				success: false,
				error: "Maximum 20 stocks per batch request",
			});
		}

		const results = await Promise.all(
			stocks.map(
				async (stock: {
					symbol?: string;
					companyId?: string;
					type: "listed" | "unlisted";
				}) => {
					try {
						if (stock.type === "unlisted" && stock.companyId) {
							return await intrinsicValueCalculator.calculateUnlistedStockValue(
								stock.companyId,
							);
						}
						if (stock.symbol) {
							return await intrinsicValueCalculator.calculateListedStockValue(
								stock.symbol.toUpperCase(),
							);
						}
						return null;
					} catch (error) {
						console.error(
							`[IntrinsicValue Batch] Error for ${stock.symbol || stock.companyId}:`,
							error,
						);
						return null;
					}
				},
			),
		);

		const validResults = results.filter((r) => r !== null);

		return res.json({
			success: true,
			data: validResults,
			meta: {
				requested: stocks.length,
				successful: validResults.length,
				failed: stocks.length - validResults.length,
			},
		});
	} catch (error) {
		console.error("[IntrinsicValue Batch API] Error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to process batch request",
			details: error instanceof Error ? error.message : "Unknown error",
		});
	}
});

export default router;
