/**
 * Background Job Queue
 * Handles async operations for polling-heavy APIs (EPFO, NPS, etc.)
 *
 * Features:
 * - In-memory job queue with status tracking
 * - Automatic retry with exponential backoff
 * - Job completion callbacks/webhooks
 * - Configurable concurrency limits
 */

import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";

// Job types for government scheme data fetching
type JobType =
	| "epf_passbook_download"
	| "nps_statement_fetch"
	| "ppf_statement_fetch"
	| "apy_statement_fetch"
	| "epf_service_history"
	| "insurance_policy_fetch"
	| "bulk_data_refresh";

type JobStatus =
	| "pending"
	| "processing"
	| "completed"
	| "failed"
	| "cancelled";

interface JobPayload {
	userId: string;
	schemeType?: string;
	panNumber?: string;
	consentId?: string;
	[key: string]: any;
}

interface Job {
	id: string;
	type: JobType;
	payload: JobPayload;
	status: JobStatus;
	priority: number;
	retryCount: number;
	maxRetries: number;
	result?: any;
	error?: string;
	createdAt: Date;
	startedAt?: Date;
	completedAt?: Date;
	nextRetryAt?: Date;
	webhookUrl?: string;
	callbackFn?: (result: any) => void;
}

interface JobQueueConfig {
	maxConcurrency: number;
	defaultMaxRetries: number;
	retryDelayMs: number;
	maxRetryDelayMs: number;
	jobTimeoutMs: number;
}

const DEFAULT_CONFIG: JobQueueConfig = {
	maxConcurrency: 3,
	defaultMaxRetries: 3,
	retryDelayMs: 5000, // 5 seconds
	maxRetryDelayMs: 60000, // 1 minute max
	jobTimeoutMs: 120000, // 2 minutes
};

class BackgroundJobQueue extends EventEmitter {
	private jobs: Map<string, Job> = new Map();
	private processingCount = 0;
	private config: JobQueueConfig;
	private isProcessing = false;
	private handlers: Map<JobType, (payload: JobPayload) => Promise<any>> =
		new Map();

	constructor(config: Partial<JobQueueConfig> = {}) {
		super();
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Register a handler for a specific job type
	 */
	registerHandler(
		type: JobType,
		handler: (payload: JobPayload) => Promise<any>,
	): void {
		this.handlers.set(type, handler);
		console.log(`📋 [JOB_QUEUE] Registered handler for job type: ${type}`);
	}

	/**
	 * Add a new job to the queue
	 */
	async addJob(
		type: JobType,
		payload: JobPayload,
		options: {
			priority?: number;
			maxRetries?: number;
			webhookUrl?: string;
			callbackFn?: (result: any) => void;
		} = {},
	): Promise<string> {
		const jobId = `job_${nanoid()}`;

		const job: Job = {
			id: jobId,
			type,
			payload,
			status: "pending",
			priority: options.priority ?? 5,
			retryCount: 0,
			maxRetries: options.maxRetries ?? this.config.defaultMaxRetries,
			createdAt: new Date(),
			webhookUrl: options.webhookUrl,
			callbackFn: options.callbackFn,
		};

		this.jobs.set(jobId, job);
		console.log(
			`📥 [JOB_QUEUE] Added job ${jobId} (${type}) for user ${payload.userId}`,
		);

		this.emit("jobAdded", job);
		this.processQueue();

		return jobId;
	}

	/**
	 * Get job status and details
	 */
	getJob(jobId: string): Job | undefined {
		return this.jobs.get(jobId);
	}

	/**
	 * Get all jobs for a user
	 */
	getJobsByUser(userId: string): Job[] {
		return Array.from(this.jobs.values())
			.filter((job) => job.payload.userId === userId)
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	/**
	 * Cancel a pending job
	 */
	cancelJob(jobId: string): boolean {
		const job = this.jobs.get(jobId);
		if (!job || job.status !== "pending") {
			return false;
		}

		job.status = "cancelled";
		job.completedAt = new Date();
		console.log(`🚫 [JOB_QUEUE] Cancelled job ${jobId}`);
		this.emit("jobCancelled", job);

		return true;
	}

	/**
	 * Process the job queue
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessing) return;
		this.isProcessing = true;

		try {
			while (this.processingCount < this.config.maxConcurrency) {
				// Get next pending job (sorted by priority, then creation time)
				const nextJob = this.getNextPendingJob();
				if (!nextJob) break;

				this.processingCount++;
				this.processJob(nextJob).finally(() => {
					this.processingCount--;
					// Continue processing remaining jobs
					setImmediate(() => this.processQueue());
				});
			}
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Get the next pending job to process
	 */
	private getNextPendingJob(): Job | undefined {
		const pendingJobs = Array.from(this.jobs.values())
			.filter((job) => {
				if (job.status !== "pending") return false;
				// Check if job is ready for retry
				if (job.nextRetryAt && new Date() < job.nextRetryAt) return false;
				return true;
			})
			.sort((a, b) => {
				// Higher priority first
				if (a.priority !== b.priority) return b.priority - a.priority;
				// Earlier jobs first
				return a.createdAt.getTime() - b.createdAt.getTime();
			});

		return pendingJobs[0];
	}

	/**
	 * Process a single job
	 */
	private async processJob(job: Job): Promise<void> {
		const handler = this.handlers.get(job.type);
		if (!handler) {
			job.status = "failed";
			job.error = `No handler registered for job type: ${job.type}`;
			job.completedAt = new Date();
			console.error(`❌ [JOB_QUEUE] ${job.error}`);
			return;
		}

		job.status = "processing";
		job.startedAt = new Date();
		console.log(`⚙️ [JOB_QUEUE] Processing job ${job.id} (${job.type})`);
		this.emit("jobStarted", job);

		try {
			// Add timeout
			const result = await Promise.race([
				handler(job.payload),
				new Promise((_, reject) =>
					setTimeout(
						() => reject(new Error("Job timeout")),
						this.config.jobTimeoutMs,
					),
				),
			]);

			job.status = "completed";
			job.result = result;
			job.completedAt = new Date();

			const duration = job.completedAt.getTime() - job.startedAt.getTime();
			console.log(`✅ [JOB_QUEUE] Job ${job.id} completed in ${duration}ms`);

			this.emit("jobCompleted", job);

			// Execute callback if provided
			if (job.callbackFn) {
				try {
					job.callbackFn(result);
				} catch (callbackError) {
					console.error(
						`[JOB_QUEUE] Callback error for job ${job.id}:`,
						callbackError,
					);
				}
			}

			// Send webhook if configured
			if (job.webhookUrl) {
				this.sendWebhook(job).catch((err) =>
					console.error(`[JOB_QUEUE] Webhook failed for job ${job.id}:`, err),
				);
			}
		} catch (error: any) {
			job.retryCount++;
			job.error = error.message;

			if (job.retryCount < job.maxRetries) {
				// Schedule retry with exponential backoff
				const delay = Math.min(
					this.config.retryDelayMs * 2 ** (job.retryCount - 1),
					this.config.maxRetryDelayMs,
				);
				job.status = "pending";
				job.nextRetryAt = new Date(Date.now() + delay);

				console.log(
					`🔄 [JOB_QUEUE] Job ${job.id} failed, retry ${job.retryCount}/${job.maxRetries} in ${delay}ms`,
				);
				this.emit("jobRetrying", job);

				// Schedule retry
				setTimeout(() => this.processQueue(), delay);
			} else {
				job.status = "failed";
				job.completedAt = new Date();
				console.error(
					`❌ [JOB_QUEUE] Job ${job.id} failed after ${job.maxRetries} retries: ${error.message}`,
				);
				this.emit("jobFailed", job);
			}
		}
	}

	/**
	 * Send webhook notification for completed job
	 */
	private async sendWebhook(job: Job): Promise<void> {
		if (!job.webhookUrl) return;

		try {
			const response = await fetchWithTimeout(job.webhookUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Job-Id": job.id,
					"X-Job-Type": job.type,
				},
				body: JSON.stringify({
					jobId: job.id,
					type: job.type,
					status: job.status,
					result: job.result,
					error: job.error,
					completedAt: job.completedAt,
				}),
				timeoutMs: 10_000,
			});

			if (!response.ok) {
				throw new Error(`Webhook returned ${response.status}`);
			}

			console.log(`📤 [JOB_QUEUE] Webhook sent for job ${job.id}`);
		} catch (error: any) {
			console.error(
				`[JOB_QUEUE] Webhook failed for job ${job.id}: ${error.message}`,
			);
		}
	}

	/**
	 * Get queue statistics
	 */
	getStats(): {
		total: number;
		pending: number;
		processing: number;
		completed: number;
		failed: number;
		cancelled: number;
	} {
		const jobs = Array.from(this.jobs.values());
		return {
			total: jobs.length,
			pending: jobs.filter((j) => j.status === "pending").length,
			processing: jobs.filter((j) => j.status === "processing").length,
			completed: jobs.filter((j) => j.status === "completed").length,
			failed: jobs.filter((j) => j.status === "failed").length,
			cancelled: jobs.filter((j) => j.status === "cancelled").length,
		};
	}

	/**
	 * Cleanup old completed/failed jobs
	 */
	cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
		const cutoff = new Date(Date.now() - maxAgeMs);
		let cleaned = 0;

		const entries = Array.from(this.jobs.entries());
		for (const entry of entries) {
			const [id, job] = entry;
			if (
				(job.status === "completed" ||
					job.status === "failed" ||
					job.status === "cancelled") &&
				job.completedAt &&
				job.completedAt < cutoff
			) {
				this.jobs.delete(id);
				cleaned++;
			}
		}

		if (cleaned > 0) {
			console.log(`🧹 [JOB_QUEUE] Cleaned up ${cleaned} old jobs`);
		}

		return cleaned;
	}
}

// Create singleton instance
export const jobQueue = new BackgroundJobQueue();

// Export types
export type { Job, JobType, JobPayload, JobStatus };
