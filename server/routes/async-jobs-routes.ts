import { Router, Request, Response } from "express";
import { asyncTaskQueueService } from "../services/async-task-queue-service";
import { taxLossHarvestingScanner } from "../services/tax-loss-harvesting-scanner";
import { monteCarloGoalSimulator } from "../services/monte-carlo-goal-simulator";
import { stockIntersectionAnalysisService } from "../services/stock-intersection-analysis-service";
import { twoTierCacheService } from "../services/two-tier-cache-service";
import { nightlyCacheMaterializer } from "../services/nightly-cache-materializer";
import { logger } from "../logger";

const router = Router();

// Register the default workers upon route initialization
asyncTaskQueueService.registerWorker("TAX_LOSS_HARVEST_SCAN", async (payload, updateProgress) => {
	updateProgress(15);
	const result = await taxLossHarvestingScanner.scanPortfolio(payload.portfolioId);
	updateProgress(90);
	return result;
});

asyncTaskQueueService.registerWorker("MONTE_CARLO_SIMULATION", async (payload, updateProgress) => {
	updateProgress(20);
	const result = monteCarloGoalSimulator.simulateGoal(payload);
	updateProgress(90);
	return result;
});

asyncTaskQueueService.registerWorker("PORTFOLIO_OVERLAP_MATRIX", async (payload, updateProgress) => {
	updateProgress(20);
	const result = await stockIntersectionAnalysisService.analyzePortfolio(payload.funds);
	updateProgress(90);
	return result;
});

/**
 * GET /api/async-jobs/:jobId
 * Check the real-time status and retrieve results of an async background task
 */
router.get("/:jobId", async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const job = asyncTaskQueueService.getJob(jobId);

		if (!job) {
			return res.status(404).json({
				success: false,
				error_code: "JOB_NOT_FOUND",
				message: `No async task found with ID: ${jobId}`,
				retryable: false,
			});
		}

		return res.json({
			success: true,
			data: job,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		logger.error("[AsyncJobRoute] Get job error:", error);
		return res.status(500).json({
			success: false,
			error_code: "FETCH_JOB_FAILED",
			message: error?.message || "Failed to fetch async job status",
			retryable: true,
		});
	}
});

/**
 * POST /api/async-jobs/:jobId/cancel
 * Cancel a pending or running async background task
 */
router.post("/:jobId/cancel", async (req: Request, res: Response) => {
	try {
		const { jobId } = req.params;
		const cancelled = asyncTaskQueueService.cancelJob(jobId);

		return res.json({
			success: cancelled,
			message: cancelled ? "Job successfully cancelled" : "Job could not be cancelled (already completed or invalid ID)",
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		logger.error("[AsyncJobRoute] Cancel job error:", error);
		return res.status(500).json({
			success: false,
			error_code: "CANCEL_JOB_FAILED",
			message: error?.message || "Failed to cancel async job",
			retryable: false,
		});
	}
});

/**
 * GET /api/async-jobs/user/:userId
 * List all async jobs for a user
 */
router.get("/user/:userId", async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		const jobs = asyncTaskQueueService.listUserJobs(userId);

		return res.json({
			success: true,
			data: jobs,
			meta: {
				total: jobs.length,
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		logger.error("[AsyncJobRoute] List user jobs error:", error);
		return res.status(500).json({
			success: false,
			error_code: "LIST_JOBS_FAILED",
			message: error?.message || "Failed to list user async jobs",
			retryable: true,
		});
	}
});

/**
 * GET /api/async-jobs/cache/stats
 * Real-time performance metrics for the Two-Tier (L1 RAM + L2 DB) Cache
 */
router.get("/cache/stats", async (_req: Request, res: Response) => {
	const stats = twoTierCacheService.getStats();
	return res.json({
		success: true,
		data: stats,
		meta: {
			timestamp: new Date().toISOString(),
			version: "FASP-AI-v1.0",
		},
	});
});

/**
 * POST /api/async-jobs/cache/materialize-nightly
 * Triggers pre-computation and materialization of model portfolios and SEBI overlaps
 */
router.post("/cache/materialize-nightly", async (_req: Request, res: Response) => {
	try {
		const summary = await nightlyCacheMaterializer.runNightlyMaterialization();
		return res.json({
			success: true,
			data: summary,
			meta: {
				timestamp: new Date().toISOString(),
				version: "FASP-AI-v1.0",
			},
		});
	} catch (error: any) {
		logger.error("[AsyncJobRoute] Materialization trigger error:", error);
		return res.status(500).json({
			success: false,
			error_code: "MATERIALIZATION_FAILED",
			message: error?.message || "Failed to run cache materialization",
		});
	}
});

export default router;
