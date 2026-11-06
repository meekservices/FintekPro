/**
 * @file task-queue-routes.ts
 * @description API Routes for Asynchronous Job Submission & Status Polling.
 *
 * Implements FintekPro GCR v1.0:
 * - 202 Accepted pattern for compute-heavy quant tasks
 * - Idempotency key tracking
 * - Structured audit responses
 */

import { Router } from "express";
import { taskQueueEngine } from "../services/queue/task-queue";

export const taskQueueRouter = Router();

/**
 * GET /api/queue/jobs/:jobId
 * Check status, progress, and result of an async task.
 */
taskQueueRouter.get("/jobs/:jobId", async (req, res) => {
	try {
		const { jobId } = req.params;
		const job = await taskQueueEngine.getJob(jobId);

		if (!job) {
			return res.status(404).json({
				success: false,
				error: {
					error_code: "JOB_NOT_FOUND",
					message: `Task with ID '${jobId}' was not found.`,
					retryable: false,
				},
			});
		}

		return res.json({
			success: true,
			data: {
				id: job.id,
				taskType: job.taskType,
				status: job.status,
				progress: job.progress,
				result: job.result,
				error: job.error,
				createdAt: job.createdAt,
				startedAt: job.startedAt,
				completedAt: job.completedAt,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error: any) {
		return res.status(500).json({
			success: false,
			error: {
				error_code: "QUEUE_FETCH_ERROR",
				message: error.message || "Failed to inspect job status",
				retryable: true,
			},
		});
	}
});

/**
 * POST /api/queue/simulate-quant
 * Enqueues a heavy quantitative simulation asynchronously.
 */
taskQueueRouter.post("/simulate-quant", async (req, res) => {
	try {
		const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
		const payload = req.body || {};

		const job = await taskQueueEngine.enqueue(
			"monte-carlo-simulation",
			payload,
			{ idempotencyKey },
		);

		return res.status(202).json({
			success: true,
			data: {
				jobId: job.id,
				status: job.status,
				message: "Quantitative computation enqueued in background.",
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: "1.0",
			},
		});
	} catch (error: any) {
		return res.status(500).json({
			success: false,
			error: {
				error_code: "QUEUE_ENQUEUE_ERROR",
				message: error.message || "Failed to enqueue task",
				retryable: true,
			},
		});
	}
});
