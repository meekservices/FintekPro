import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import { logger } from "../logger";

export type AsyncTaskType =
	| "TAX_LOSS_HARVEST_SCAN"
	| "MONTE_CARLO_SIMULATION"
	| "PORTFOLIO_OVERLAP_MATRIX"
	| "HISTORICAL_TWRR_BACKFILL"
	| "BATCH_QUOTE_COMPUTE"
	| "CUSTOM_COMPUTE";

export type AsyncTaskStatus =
	| "PENDING"
	| "PROCESSING"
	| "COMPLETED"
	| "FAILED"
	| "CANCELLED";

export interface AsyncTask<T = any, R = any> {
	jobId: string;
	type: AsyncTaskType;
	userId?: string;
	status: AsyncTaskStatus;
	progress: number; // 0 - 100
	payload: T;
	result?: R;
	error?: string;
	retryCount: number;
	maxRetries: number;
	createdAt: string;
	startedAt?: string;
	completedAt?: string;
}

export type AsyncTaskHandler<T = any, R = any> = (
	payload: T,
	updateProgress: (progress: number) => void,
) => Promise<R>;

export class AsyncTaskQueueService extends EventEmitter {
	private static instance: AsyncTaskQueueService;
	private jobs = new Map<string, AsyncTask>();
	private workers = new Map<AsyncTaskType, AsyncTaskHandler>();
	private activeWorkersCount = 0;
	private maxConcurrency = 5;
	private queue: string[] = []; // Array of jobIds

	static getInstance(): AsyncTaskQueueService {
		if (!AsyncTaskQueueService.instance) {
			AsyncTaskQueueService.instance = new AsyncTaskQueueService();
		}
		return AsyncTaskQueueService.instance;
	}

	constructor() {
		super();
		// Periodic cleanup: purge completed jobs older than 1 hour
		setInterval(() => this.cleanupOldJobs(), 15 * 60 * 1000);
	}

	/**
	 * Register an execution handler for a specific task type
	 */
	registerWorker<T = any, R = any>(
		type: AsyncTaskType,
		handler: AsyncTaskHandler<T, R>,
	): void {
		this.workers.set(type, handler);
		logger.info(`[AsyncTaskQueue] Registered worker for task type: ${type}`);
	}

	/**
	 * Enqueue a new async task
	 */
	enqueue<T = any, R = any>(
		type: AsyncTaskType,
		payload: T,
		options: { userId?: string; maxRetries?: number } = {},
	): AsyncTask<T, R> {
		const jobId = `job_${nanoid(12)}`;
		const job: AsyncTask<T, R> = {
			jobId,
			type,
			userId: options.userId,
			status: "PENDING",
			progress: 0,
			payload,
			retryCount: 0,
			maxRetries: options.maxRetries ?? 3,
			createdAt: new Date().toISOString(),
		};

		this.jobs.set(jobId, job);
		this.queue.push(jobId);

		logger.info(
			JSON.stringify({
				event: "ASYNC_JOB_ENQUEUED",
				job_id: jobId,
				job_type: type,
				user_id: options.userId,
				status: "PENDING",
			}),
		);

		// Trigger queue processing
		setImmediate(() => this.processNext());

		return job;
	}

	/**
	 * Retrieve job status and results
	 */
	getJob(jobId: string): AsyncTask | null {
		return this.jobs.get(jobId) || null;
	}

	/**
	 * Retrieve all jobs for a specific user
	 */
	listUserJobs(userId: string): AsyncTask[] {
		const userJobs: AsyncTask[] = [];
		this.jobs.forEach((job) => {
			if (job.userId === userId) userJobs.push(job);
		});
		return userJobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	}

	/**
	 * Cancel a pending or running job
	 */
	cancelJob(jobId: string): boolean {
		const job = this.jobs.get(jobId);
		if (!job) return false;

		if (job.status === "PENDING") {
			job.status = "CANCELLED";
			job.completedAt = new Date().toISOString();
			const idx = this.queue.indexOf(jobId);
			if (idx !== -1) this.queue.splice(idx, 1);
			return true;
		}

		if (job.status === "PROCESSING") {
			job.status = "CANCELLED";
			job.completedAt = new Date().toISOString();
			return true;
		}

		return false;
	}

	/**
	 * Internal worker processor loop with self-healing retry logic
	 */
	private async processNext(): Promise<void> {
		if (this.activeWorkersCount >= this.maxConcurrency) return;
		if (this.queue.length === 0) return;

		const jobId = this.queue.shift();
		if (!jobId) return;

		const job = this.jobs.get(jobId);
		if (!job || job.status === "CANCELLED") {
			return this.processNext();
		}

		const worker = this.workers.get(job.type);
		if (!worker) {
			job.status = "FAILED";
			job.error = `No worker registered for task type: ${job.type}`;
			job.completedAt = new Date().toISOString();
			logger.error(`[AsyncTaskQueue] Missing worker for ${job.type}`);
			return this.processNext();
		}

		this.activeWorkersCount++;
		job.status = "PROCESSING";
		job.startedAt = new Date().toISOString();
		job.progress = 5;

		const startTime = Date.now();

		try {
			const updateProgress = (pct: number) => {
				job.progress = Math.min(100, Math.max(0, Math.round(pct)));
			};

			const result = await worker(job.payload, updateProgress);

			job.status = "COMPLETED";
			job.progress = 100;
			job.result = result;
			job.completedAt = new Date().toISOString();

			logger.info(
				JSON.stringify({
					event: "ASYNC_JOB_COMPLETED",
					job_id: job.jobId,
					job_type: job.type,
					latency_ms: Date.now() - startTime,
					status: "SUCCESS",
				}),
			);
		} catch (error: any) {
			logger.error(`[AsyncTaskQueue] Job ${jobId} failed: ${error?.message}`);

			if (job.retryCount < job.maxRetries) {
				job.retryCount++;
				job.status = "PENDING";
				job.progress = 0;
				// Exponential backoff before re-queueing
				const backoffMs = Math.min(30000, 1000 * Math.pow(2, job.retryCount));
				setTimeout(() => {
					this.queue.push(job.jobId);
					this.processNext();
				}, backoffMs);
			} else {
				job.status = "FAILED";
				job.error = error?.message || "Internal async execution failure";
				job.completedAt = new Date().toISOString();
			}
		} finally {
			this.activeWorkersCount--;
			this.processNext();
		}
	}

	private cleanupOldJobs(): void {
		const oneHourAgo = Date.now() - 60 * 60 * 1000;
		const toDelete: string[] = [];

		this.jobs.forEach((job, id) => {
			if (
				(job.status === "COMPLETED" || job.status === "FAILED" || job.status === "CANCELLED") &&
				job.completedAt &&
				new Date(job.completedAt).getTime() < oneHourAgo
			) {
				toDelete.push(id);
			}
		});

		for (const id of toDelete) {
			this.jobs.delete(id);
		}
	}
}

export const asyncTaskQueueService = AsyncTaskQueueService.getInstance();
