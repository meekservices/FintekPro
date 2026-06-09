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
