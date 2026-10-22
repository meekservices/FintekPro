import { Router, Request, Response } from "express";
import { monteCarloGoalSimulator } from "../services/monte-carlo-goal-simulator";
import { asyncTaskQueueService } from "../services/async-task-queue-service";
import { logger } from "../logger";

const router = Router();

/**
 * POST /api/goal-planning/monte-carlo-simulate
 * Synchronous 10,000-iteration Monte Carlo simulation
 */
router.post("/monte-carlo-simulate", async (req: Request, res: Response) => {
	const startTime = Date.now();
	try {
		const {
			targetAmount,
			currentSavings,
			monthlySip,
			monthsRemaining,
			expectedReturnRate,
			volatilityRate,
			inflationRate,
			iterations,
		} = req.body;

		if (!targetAmount || monthsRemaining === undefined) {
			return res.status(400).json({
				success: false,
				error_code: "INVALID_SIMULATION_INPUT",
				message: "'targetAmount' and 'monthsRemaining' are required parameters",
				retryable: false,
			});
		}

		const result = monteCarloGoalSimulator.simulateGoal({
			targetAmount: Number(targetAmount),
			currentSavings: Number(currentSavings || 0),
			monthlySip: Number(monthlySip || 0),
			monthsRemaining: Number(monthsRemaining),
			expectedReturnRate: expectedReturnRate !== undefined ? Number(expectedReturnRate) : undefined,
			volatilityRate: volatilityRate !== undefined ? Number(volatilityRate) : undefined,
			inflationRate: inflationRate !== undefined ? Number(inflationRate) : undefined,
			iterations: iterations !== undefined ? Number(iterations) : 10000,
		});

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
		logger.error("[MonteCarloRoute] Simulation error:", error);
		return res.status(500).json({
			success: false,
			error_code: "SIMULATION_FAILED",
			message: error?.message || "Failed to execute Monte Carlo goal simulation",
			retryable: true,
		});
	}
});

/**
 * POST /api/goal-planning/monte-carlo-simulate-async
 * Enqueues a heavy Monte Carlo simulation to the background worker queue
 */
router.post("/monte-carlo-simulate-async", async (req: Request, res: Response) => {
	try {
		const { userId, ...payload } = req.body;

		const job = asyncTaskQueueService.enqueue(
			"MONTE_CARLO_SIMULATION",
			payload,
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
		logger.error("[MonteCarloRoute] Async enqueue error:", error);
		return res.status(500).json({
			success: false,
			error_code: "ASYNC_ENQUEUE_FAILED",
			message: error?.message || "Failed to enqueue Monte Carlo simulation",
			retryable: true,
		});
	}
});

export default router;
