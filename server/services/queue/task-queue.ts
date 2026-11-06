/**
 * @file task-queue.ts
 * @description Asynchronous Job Queue & Worker Engine for Compute-Heavy Financial Operations.
 *
 * Implements FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Offloads heavy matrix calculations & Monte Carlo loops from HTTP event loop
 * - Idempotency key deduplication
 * - Redis cluster state sharing with in-memory resilient fallback
 * - Structured telemetry { event, job_id, task_type, latency_ms, status }
 */

import { randomUUID } from "crypto";
import { logger } from "../../logger";
import { getSharedRedis } from "../../utils/redis-client";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job<TPayload = any, TResult = any> {
	id: string;
	taskType: string;
	payload: TPayload;
	status: JobStatus;
	progress: number; // 0 to 100
	result?: TResult;
	error?: string;
	idempotencyKey?: string;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
}

export type JobHandler<TPayload = any, TResult = any> = (
	job: Job<TPayload, TResult>,
	updateProgress: (progress: number) => Promise<void>,
) => Promise<TResult>;

class TaskQueueEngine {
	private handlers = new Map<string, JobHandler>();
	private localJobs = new Map<string, Job>();
	private idempotencyMap = new Map<string, string>(); // idempotencyKey -> jobId

	/**
	 * Register a task processor for a given task type
	 */
	registerHandler<TPayload = any, TResult = any>(
		taskType: string,
		handler: JobHandler<TPayload, TResult>,
	) {
		this.handlers.set(taskType, handler);
		logger.info(`[TaskQueue] Registered worker handler for '${taskType}'`);
	}

	/**
	 * Enqueue a heavy compute job
	 */
	async enqueue<TPayload = any, TResult = any>(
		taskType: string,
		payload: TPayload,
		options?: { idempotencyKey?: string },
	): Promise<Job<TPayload, TResult>> {
		// Idempotency check
		if (options?.idempotencyKey) {
			const existingJobId = this.idempotencyMap.get(options.idempotencyKey);
			if (existingJobId) {
				const existing = await this.getJob<TPayload, TResult>(existingJobId);
				if (existing) {
					logger.info("[TaskQueue] Idempotency hit — returning existing job", {
						event: "ASYNC_JOB_IDEMPOTENT_REPLAY",
						job_id: existing.id,
						idempotency_key: options.idempotencyKey,
					});
					return existing;
				}
			}
		}

		const jobId = `job-${randomUUID()}`;
		const job: Job<TPayload, TResult> = {
			id: jobId,
			taskType,
			payload,
			status: "pending",
			progress: 0,
			idempotencyKey: options?.idempotencyKey,
			createdAt: new Date().toISOString(),
		};

		if (options?.idempotencyKey) {
			this.idempotencyMap.set(options.idempotencyKey, jobId);
		}

		await this.persistJob(job);

		logger.info("[TaskQueue] Job enqueued", {
			event: "ASYNC_JOB_ENQUEUED",
			job_id: jobId,
			task_type: taskType,
			status: "pending",
		});

		// Trigger background processing asynchronously without blocking caller
		setImmediate(() => {
			void this.processJob(jobId);
		});

		return job;
	}

	/**
	 * Retrieve job state and results by Job ID
	 */
	async getJob<TPayload = any, TResult = any>(
		jobId: string,
	): Promise<Job<TPayload, TResult> | null> {
		try {
			const redis = await getSharedRedis();
			if (redis?.isOpen) {
				const raw = await redis.get(`fintekpro:job:${jobId}`);
				if (raw) return JSON.parse(raw);
			}
		} catch (err: any) {
			logger.warn("[TaskQueue] Redis read error, using local fallback", {
				error: err.message,
			});
		}

		return (this.localJobs.get(jobId) as Job<TPayload, TResult>) || null;
	}

	/**
	 * Execute task handler
	 */
	private async processJob(jobId: string) {
		const job = await this.getJob(jobId);
		if (!job) return;

		const handler = this.handlers.get(job.taskType);
		if (!handler) {
			job.status = "failed";
			job.error = `No handler registered for task type '${job.taskType}'`;
			job.completedAt = new Date().toISOString();
			await this.persistJob(job);
			return;
		}

		const startTime = Date.now();
		job.status = "processing";
		job.startedAt = new Date().toISOString();
		await this.persistJob(job);

		logger.info("[TaskQueue] Job started", {
			event: "ASYNC_JOB_STARTED",
			job_id: jobId,
			task_type: job.taskType,
		});

		try {
			const result = await handler(job, async (progress: number) => {
				job.progress = Math.min(100, Math.max(0, progress));
				await this.persistJob(job);
			});

			job.status = "completed";
			job.progress = 100;
			job.result = result;
			job.completedAt = new Date().toISOString();
			await this.persistJob(job);

			const latencyMs = Date.now() - startTime;
			logger.info("[TaskQueue] Job completed successfully", {
				event: "ASYNC_JOB_COMPLETED",
				job_id: jobId,
				task_type: job.taskType,
				latency_ms: latencyMs,
				status: "SUCCESS",
			});
		} catch (err: any) {
			const latencyMs = Date.now() - startTime;
			job.status = "failed";
			job.error = err.message || "Unknown execution error";
			job.completedAt = new Date().toISOString();
			await this.persistJob(job);

			logger.error("[TaskQueue] Job execution failed", {
				event: "ASYNC_JOB_FAILED",
				job_id: jobId,
				task_type: job.taskType,
				error: job.error,
				latency_ms: latencyMs,
				status: "FAILED",
			});
		}
	}

	/**
	 * Save job state to Redis and local memory
	 */
	private async persistJob(job: Job) {
		this.localJobs.set(job.id, job);

		try {
			const redis = await getSharedRedis();
			if (redis?.isOpen) {
				// Retain job in cluster cache for 24 hours
				await redis.setEx(
					`fintekpro:job:${job.id}`,
					86400,
					JSON.stringify(job),
				);
			}
		} catch {
			// Failover gracefully to local memory
		}
	}
}

export const taskQueueEngine = new TaskQueueEngine();

