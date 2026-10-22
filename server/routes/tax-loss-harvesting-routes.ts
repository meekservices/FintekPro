import { Router, Request, Response } from "express";
import { taxLossHarvestingScanner } from "../services/tax-loss-harvesting-scanner";
import { asyncTaskQueueService } from "../services/async-task-queue-service";
import { logger } from "../logger";

const router = Router();

/**
 * GET /api/tax-loss-harvesting/portfolio/:portfolioId
 * Scans an existing user portfolio for tax-loss harvesting lots & replacement suggestions
 */
router.get("/portfolio/:portfolioId", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const { portfolioId } = req.params;
		if (!portfolioId) {
			return res.status(400).json({
				success: false,
				error_code: "INVALID_PORTFOLIO_ID",
				message: "portfolioId parameter is required",
				retryable: false,
			});
		}

		const result = await taxLossHarvestingScanner.scanPortfolio(portfolioId);

		return res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
				latency_ms: Date.now() - startTime,
			},
		});
	} catch (error: any) {
		logger.error("[TaxLossHarvestRoute] Scan error:", error);
		return res.status(500).json({
			success: false,
			error_code: "TAX_LOSS_SCAN_FAILED",
			message: error?.message || "Failed to scan portfolio for tax-loss harvesting",
			retryable: true,
		});
	}
});

/**
 * POST /api/tax-loss-harvesting/scan-async
 * Enqueues a background tax loss harvest scan job via the async task queue
 */
router.post("/scan-async", async (req: Request, res: Response) => {
	try {
		const { portfolioId, userId } = req.body;
		if (!portfolioId) {
			return res.status(400).json({
				success: false,
				error_code: "MISSING_PAYLOAD",
				message: "portfolioId is required for async scan",
				retryable: false,
			});
		}

		const job = asyncTaskQueueService.enqueue(
			"TAX_LOSS_HARVEST_SCAN",
			{ portfolioId },
			{ userId },
		);

		return res.json({
			success: true,
			data: {
				jobId: job.jobId,
				status: job.status,
				checkStatusUrl: `/api/async-jobs/${job.jobId}`,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		logger.error("[TaxLossHarvestRoute] Async enqueue error:", error);
		return res.status(500).json({
			success: false,
			error_code: "ASYNC_ENQUEUE_FAILED",
			message: error?.message || "Failed to enqueue tax loss harvesting job",
			retryable: true,
		});
	}
});

export default router;
