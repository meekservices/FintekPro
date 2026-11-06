/**
 * @file task-queue.ts
 * @description Zero-Redis Asynchronous Job Queue & Worker Engine for Compute-Heavy Financial Operations.
 *
 * Implements FintekPro GCR v1.0 & FASP-AI v1.0:
 * - Offloads heavy matrix calculations & Monte Carlo loops from HTTP event loop
 * - Cross-pod task persistence via PostgreSQL async_compute_jobs table (Zero-Redis)
 * - Optional Redis acceleration when REDIS_URL is configured
 * - Idempotency key deduplication across all Cloud Run pods
 * - In-memory L1 cache for sub-millisecond local reads
 * - Structured telemetry { event, job_id, task_type, latency_ms, status }
 */

import { randomUUID } from "crypto";
import { logger } from "../../logger";
import { getSharedRedis } from "../../utils/redis-client";
import { pool } from "../../db";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job<TPayload = unknown, TResult = unknown> {
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

export type JobHandler<TPayload = unknown, TResult = unknown> = (
	job: Job<TPayload, TResult>,
	updateProgress: (progress: number) => Promise<void>,
) => Promise<TResult>;

let queueTableEnsured = false;
async function ensureQueueTable(): Promise<void> {
	if (queueTableEnsured) return;
	try {
		await pool.query(`
			CREATE TABLE IF NOT EXISTS async_compute_jobs (
				id VARCHAR(255) PRIMARY KEY,
				task_type VARCHAR(100) NOT NULL,
				status VARCHAR(50) NOT NULL,
				progress INTEGER NOT NULL DEFAULT 0,
				payload JSONB NOT NULL,
				result JSONB,
				error TEXT,
				idempotency_key VARCHAR(255),
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				started_at TIMESTAMPTZ,
				completed_at TIMESTAMPTZ
			);
			CREATE INDEX IF NOT EXISTS idx_async_compute_jobs_idempotency ON async_compute_jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
			CREATE INDEX IF NOT EXISTS idx_async_compute_jobs_status ON async_compute_jobs(status);
		`);
		queueTableEnsured = true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.debug("[TaskQueue] Queue table ensure skipped/failed", { error: msg });
	}
}

class TaskQueueEngine {
	private handlers = new Map<string, JobHandler<any, any>>();
	private localJobs = new Map<string, Job<any, any>>();
	private idempotencyMap = new Map<string, string>(); // idempotencyKey -> jobId

	/**
	 * Register a task processor for a given task type
	 */
	registerHandler<TPayload = unknown, TResult = unknown>(
		taskType: string,
		handler: JobHandler<TPayload, TResult>,
	) {
		this.handlers.set(taskType, handler as JobHandler<any, any>);
		logger.info(`[TaskQueue] Registered worker handler for '${taskType}'`);
	}

	/**
	 * Enqueue a heavy compute job
	 */
	async enqueue<TPayload = unknown, TResult = unknown>(
		taskType: string,
		payload: TPayload,
		options?: { idempotencyKey?: string },
	): Promise<Job<TPayload, TResult>> {
		// 1. In-memory Idempotency check
		if (options?.idempotencyKey) {
			const existingJobId = this.idempotencyMap.get(options.idempotencyKey);
			if (existingJobId) {
				const existing = await this.getJob<TPayload, TResult>(existingJobId);
				if (existing) {
					logger.info("[TaskQueue] Idempotency hit (memory) — returning existing job", {
						event: "ASYNC_JOB_IDEMPOTENT_REPLAY",
						job_id: existing.id,
						idempotency_key: options.idempotencyKey,
					});
					return existing;
				}
			}

			// 2. Cross-Pod Database Idempotency check (Zero-Redis)
			try {
				await ensureQueueTable();
				const dbCheck = await pool.query(
					`SELECT id FROM async_compute_jobs WHERE idempotency_key = $1 ORDER BY created_at DESC LIMIT 1`,
					[options.idempotencyKey],
				);
				if (dbCheck.rows.length > 0) {
					const existingId = dbCheck.rows[0].id as string;
					this.idempotencyMap.set(options.idempotencyKey, existingId);
					const existing = await this.getJob<TPayload, TResult>(existingId);
					if (existing) {
						logger.info("[TaskQueue] Idempotency hit (database) — returning existing job", {
							event: "ASYNC_JOB_IDEMPOTENT_REPLAY",
							job_id: existing.id,
							idempotency_key: options.idempotencyKey,
						});
						return existing;
					}
				}
			} catch {
				// Fall through to enqueue if DB check fails
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
	 * Retrieve job state and results by Job ID (across pods via DB or Redis)
	 */
	async getJob<TPayload = unknown, TResult = unknown>(
		jobId: string,
	): Promise<Job<TPayload, TResult> | null> {
		// Tier 1: Check in-memory L1 cache (sub-millisecond)
		const local = this.localJobs.get(jobId);
		if (local) {
			return local as Job<TPayload, TResult>;
		}

		// Tier 2: Check PostgreSQL async_compute_jobs table (Cross-pod Zero-Redis)
		try {
			await ensureQueueTable();
			const result = await pool.query(
				`SELECT id, task_type as "taskType", status, progress, payload, result, error,
				        idempotency_key as "idempotencyKey", created_at as "createdAt",
				        started_at as "startedAt", completed_at as "completedAt"
				 FROM async_compute_jobs
				 WHERE id = $1`,
				[jobId],
			);

			if (result.rows.length > 0) {
				const row = result.rows[0];
				const job: Job<TPayload, TResult> = {
					id: row.id,
					taskType: row.taskType,
					status: row.status as JobStatus,
					progress: Number(row.progress) || 0,
					payload: row.payload as TPayload,
					result: row.result as TResult,
					error: row.error || undefined,
					idempotencyKey: row.idempotencyKey || undefined,
					createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
					startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : (row.startedAt ? String(row.startedAt) : undefined),
					completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : (row.completedAt ? String(row.completedAt) : undefined),
				};
				this.localJobs.set(jobId, job);
				return job;
			}
		} catch {
			// Fall through to Redis if DB fails
		}

		// Tier 3: Optional Redis fallback
		if (process.env.REDIS_URL) {
			try {
				const redis = await getSharedRedis();
				if (redis?.isOpen) {
					const raw = await redis.get(`fintekpro:job:${jobId}`);
					if (raw) {
						const parsed = JSON.parse(raw);
						this.localJobs.set(jobId, parsed);
						return parsed;
					}
				}
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				logger.warn("[TaskQueue] Redis read error", { error: msg });
			}
		}

		return null;
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
		} catch (err: unknown) {
			const latencyMs = Date.now() - startTime;
			const msg = err instanceof Error ? err.message : "Unknown execution error";
			job.status = "failed";
			job.error = msg;
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
	 * Save job state to local memory and PostgreSQL database (with optional Redis)
	 */
	private async persistJob(job: Job) {
		// 1. In-memory update (instant)
		this.localJobs.set(job.id, job);

		// 2. PostgreSQL persistent upsert (Zero-Redis Multi-Pod Consistency)
		try {
			await ensureQueueTable();
			const query = `
				INSERT INTO async_compute_jobs (
					id, task_type, status, progress, payload, result, error, idempotency_key, created_at, started_at, completed_at
				)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
				ON CONFLICT (id) DO UPDATE SET
					status = EXCLUDED.status,
					progress = EXCLUDED.progress,
					result = EXCLUDED.result,
					error = EXCLUDED.error,
					started_at = EXCLUDED.started_at,
					completed_at = EXCLUDED.completed_at;
			`;

			await pool.query(query, [
				job.id,
				job.taskType,
				job.status,
				job.progress,
				JSON.stringify(job.payload ?? {}),
				job.result !== undefined ? JSON.stringify(job.result) : null,
				job.error ?? null,
				job.idempotencyKey ?? null,
				job.createdAt,
				job.startedAt ?? null,
				job.completedAt ?? null,
			]);
		} catch (dbErr: unknown) {
			const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
			logger.debug("[TaskQueue] DB persist failed — local memory active", { error: msg });
		}

		// 3. Optional Redis cluster cache
		if (process.env.REDIS_URL) {
			try {
				const redis = await getSharedRedis();
				if (redis?.isOpen) {
					await redis.setEx(
						`fintekpro:job:${job.id}`,
						86400,
						JSON.stringify(job),
					);
				}
			} catch {
				// Non-fatal fallback
			}
		}
	}
}

export const taskQueueEngine = new TaskQueueEngine();
