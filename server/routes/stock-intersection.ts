import { Router, Request, Response } from "express";
import { stockIntersectionAnalysisService } from "../services/stock-intersection-analysis-service";
import { mfSchemeHoldingsService } from "../services/mf-scheme-holdings-service";

const router = Router();

router.post("/analyze", async (req: Request, res: Response) => {
	try {
		const { funds, prospectId, userId, portfolioId, saveResult } = req.body;

		if (!funds || !Array.isArray(funds) || funds.length === 0) {
			return res.status(400).json({
				success: false,
				error: "Invalid request: 'funds' array is required",
			});
		}

		if (funds.length > 50) {
			return res.status(400).json({
				success: false,
				error: "Maximum 50 funds allowed per analysis",
			});
		}

		const portfolioFunds = funds.map((f: any) => ({
			mfIsin: f.mfIsin || f.isin,
			name: f.name || f.schemeName || "Unknown Fund",
			portfolioWeight: f.portfolioWeight || f.weight || 0,
			currentValue: f.currentValue || f.value,
		}));

		const totalWeight = portfolioFunds.reduce(
			(sum, f) => sum + f.portfolioWeight,
			0,
		);
		if (totalWeight < 1) {
			const equalWeight = 100 / portfolioFunds.length;
			portfolioFunds.forEach((f) => (f.portfolioWeight = equalWeight));
		}

		const result =
			await stockIntersectionAnalysisService.analyzePortfolio(portfolioFunds);

		let analysisId: string | undefined;
		if (saveResult) {
			analysisId = await stockIntersectionAnalysisService.saveAnalysis(result, {
				prospectId,
				userId,
				portfolioId,
			});
		}

		return res.json({
			success: true,
			data: {
				...result,
				analysisId,
			},
		});
	} catch (error: any) {
		console.error("[StockIntersection] Analysis error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to analyze stock intersection",
			message: error.message,
		});
	}
});

router.get("/latest", async (req: Request, res: Response) => {
	try {
		const { prospectId, userId, portfolioId } = req.query;

		const result = await stockIntersectionAnalysisService.getLatestAnalysis({
			prospectId: prospectId as string,
			userId: userId as string,
			portfolioId: portfolioId as string,
		});

		if (!result) {
			return res.status(404).json({
				success: false,
				error: "No previous analysis found",
			});
		}

		return res.json({
			success: true,
			data: result,
		});
	} catch (error: any) {
		console.error("[StockIntersection] Fetch error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to fetch analysis",
			message: error.message,
		});
	}
});

/**
 * GET /api/stock-intersection/portfolio/:portfolioId
 * Analyzes an existing user portfolio directly by portfolioId
 */
router.get("/portfolio/:portfolioId", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const { portfolioId } = req.params;
		if (!portfolioId) {
			return res.status(400).json({
				success: false,
				error: "portfolioId is required",
			});
		}

		const result =
			await stockIntersectionAnalysisService.analyzeExistingPortfolio(portfolioId);

		console.log(
			JSON.stringify({
				event: "MF_PORTFOLIO_OVERLAP_ANALYZED",
				portfolio_id: portfolioId,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS",
			}),
		);

		return res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		console.error("[StockIntersection] Existing portfolio analysis error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to analyze existing portfolio overlap",
			message: error.message,
		});
	}
});

/**
 * GET /api/stock-intersection/model-portfolio/:id
 * Analyzes a Model Portfolio by ID
 */
router.get("/model-portfolio/:id", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const { id } = req.params;
		if (!id) {
			return res.status(400).json({
				success: false,
				error: "Model portfolio ID is required",
			});
		}

		const result =
			await stockIntersectionAnalysisService.analyzeModelPortfolio(id);

		console.log(
			JSON.stringify({
				event: "MF_MODEL_PORTFOLIO_OVERLAP_ANALYZED",
				model_portfolio_id: id,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS",
			}),
		);

		return res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		console.error("[StockIntersection] Model portfolio analysis error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to analyze model portfolio overlap",
			message: error.message,
		});
	}
});

/**
 * POST /api/stock-intersection/simulate-addition
 * What-if analysis: evaluates the incremental overlap of candidate funds during new portfolio construction
 */
router.post("/simulate-addition", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const { currentFunds, candidateFunds } = req.body;

		if (!Array.isArray(currentFunds) || !Array.isArray(candidateFunds)) {
			return res.status(400).json({
				success: false,
				error: "Both 'currentFunds' and 'candidateFunds' arrays are required",
			});
		}

		const formatFund = (f: any) => ({
			mfIsin: f.mfIsin || f.isin || f.schemeCode || "",
			name: f.name || f.schemeName || "Fund",
			portfolioWeight: Number(f.portfolioWeight || f.weight || 0),
			currentValue: f.currentValue || f.value,
		});

		const formattedCurrent = currentFunds.map(formatFund);
		const formattedCandidates = candidateFunds.map(formatFund);

		const result = await stockIntersectionAnalysisService.simulateAddition(
			formattedCurrent,
			formattedCandidates,
		);

		console.log(
			JSON.stringify({
				event: "MF_OVERLAP_SIMULATION_COMPLETED",
				latency_ms: Date.now() - startTime,
				status: "SUCCESS",
			}),
		);

		return res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		console.error("[StockIntersection] Simulation error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to simulate portfolio addition",
			message: error.message,
		});
	}
});

/**
 * POST /api/stock-intersection/compare-schemes
 * Pairwise comparison between two schemes
 */
router.post("/compare-schemes", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const { schemeA, schemeB } = req.body;

		if (!schemeA || !schemeB) {
			return res.status(400).json({
				success: false,
				error: "'schemeA' and 'schemeB' (ISIN or Scheme Code) are required",
			});
		}

		const result = await stockIntersectionAnalysisService.compareSchemes(
			schemeA,
			schemeB,
		);

		console.log(
			JSON.stringify({
				event: "MF_PAIRWISE_SCHEMES_COMPARED",
				scheme_a: schemeA,
				scheme_b: schemeB,
				overlap_percent: result.overlapPercentage,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS",
			}),
		);

		return res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		console.error("[StockIntersection] Scheme comparison error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to compare schemes",
			message: error.message,
		});
	}
});

router.get("/scheme-holdings/:isin", async (req: Request, res: Response) => {
	try {
		const { isin } = req.params;

		if (!isin) {
			return res.status(400).json({
				success: false,
				error: "ISIN parameter is required",
			});
		}

		const holdings = await mfSchemeHoldingsService.getHoldingsForScheme(isin);

		return res.json({
			success: true,
			data: {
				isin,
				holdingsCount: holdings.length,
				holdings,
			},
		});
	} catch (error: any) {
		console.error("[StockIntersection] Holdings fetch error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to fetch scheme holdings",
			message: error.message,
		});
	}
});

router.get("/coverage", async (_req: Request, res: Response) => {
	try {
		const coverage = await mfSchemeHoldingsService.getSchemesCoverage();

		return res.json({
			success: true,
			data: coverage,
		});
	} catch (error: any) {
		console.error("[StockIntersection] Coverage check error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to check holdings coverage",
			message: error.message,
		});
	}
});

router.post("/seed-sample-holdings", async (_req: Request, res: Response) => {
	try {
		await mfSchemeHoldingsService.seedSampleHoldings();

		return res.json({
			success: true,
			message: "Sample holdings seeded successfully",
		});
	} catch (error: any) {
		console.error("[StockIntersection] Seed error:", error);
		return res.status(500).json({
			success: false,
			error: "Failed to seed sample holdings",
			message: error.message,
		});
	}
});

router.post("/clear-cache", async (_req: Request, res: Response) => {
	try {
		stockIntersectionAnalysisService.clearCache();

		return res.json({
			success: true,
			message: "Analysis cache cleared",
		});
	} catch (error: any) {
		return res.status(500).json({
			success: false,
			error: "Failed to clear cache",
			message: error.message,
		});
	}
});

export default router;
