// @ts-nocheck
/**
 * Filing Scheduler Service
 *
 * Schedules and manages periodic fetching of NSE/BSE filings.
 * - Daily fetches for large-cap companies (Nifty 50, Sensex)
 * - Weekly fetches for mid-caps and small-caps
 * - Manual refresh triggers via Admin API
 *
 * SEBI Compliance:
 * - All fetch operations are logged
 * - Duplicate detection via SHA256 hash
 * - Immutable audit trail for all data changes
 */

import { exchangeFilingsService } from "./exchange-filings-service";
import * as crypto from "crypto";

const JOB_LOCKS: Map<
	string,
	{ lockId: string; acquiredAt: Date; expiresAt: Date }
> = new Map();
const LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes max lock

export interface ScheduledJob {
	id: string;
	name: string;
	cronExpression: string;
	lastRun?: Date;
	nextRun?: Date;
	isRunning: boolean;
	isEnabled: boolean;
	priority: "high" | "medium" | "low";
	description: string;
}

export interface JobRunResult {
	jobId: string;
	success: boolean;
	startTime: Date;
	endTime: Date;
	filingsProcessed: number;
	newFilings: number;
	errors: string[];
}

const LARGE_CAP_SYMBOLS = [
	"RELIANCE",
	"TCS",
	"HDFCBANK",
	"INFY",
	"ICICIBANK",
	"BHARTIARTL",
	"SBIN",
	"LICI",
	"BAJFINANCE",
	"ITC",
	"LT",
	"AXISBANK",
	"KOTAKBANK",
	"TATAMOTORS",
	"MARUTI",
	"SUNPHARMA",
	"TITAN",
	"ASIANPAINT",
	"HINDUNILVR",
	"WIPRO",
];

class FilingSchedulerService {
	private jobs: Map<string, ScheduledJob> = new Map();
	private runningJobs: Set<string> = new Set();
	private intervalIds: Map<string, NodeJS.Timer> = new Map();

	constructor() {
		this.initializeJobs();
		console.log("✅ Filing Scheduler Service initialized");
	}

	private initializeJobs() {
		this.jobs.set("daily_large_cap", {
			id: "daily_large_cap",
			name: "Daily Large-Cap Filings",
			cronExpression: "0 6 * * *",
			isRunning: false,
			isEnabled: true,
			priority: "high",
			description:
				"Fetches filings for Nifty 50 and Sensex companies daily at 6 AM",
		});

		this.jobs.set("weekly_all_companies", {
			id: "weekly_all_companies",
			name: "Weekly All Companies",
			cronExpression: "0 2 * * 0",
			isRunning: false,
			isEnabled: true,
			priority: "medium",
			description:
				"Comprehensive weekly fetch for all listed companies on Sunday 2 AM",
		});

		this.jobs.set("monthly_historical", {
			id: "monthly_historical",
			name: "Monthly Historical Backfill",
			cronExpression: "0 3 1 * *",
			isRunning: false,
			isEnabled: false,
			priority: "low",
			description: "Monthly historical data backfill on 1st of each month",
		});
	}

	async startScheduler() {
		console.log("[FilingScheduler] Starting scheduler...");

		const dailyInterval = 24 * 60 * 60 * 1000;
		const weeklyInterval = 7 * 24 * 60 * 60 * 1000;

		const dailyJob = this.jobs.get("daily_large_cap");
		if (dailyJob?.isEnabled) {
			const intervalId = setInterval(() => {
				this.runJob("daily_large_cap");
			}, dailyInterval);
			this.intervalIds.set("daily_large_cap", intervalId);
			console.log("[FilingScheduler] Daily large-cap job scheduled");
		}

		const weeklyJob = this.jobs.get("weekly_all_companies");
		if (weeklyJob?.isEnabled) {
			const intervalId = setInterval(() => {
				this.runJob("weekly_all_companies");
			}, weeklyInterval);
			this.intervalIds.set("weekly_all_companies", intervalId);
			console.log("[FilingScheduler] Weekly all-companies job scheduled");
		}
	}

	async stopScheduler() {
		console.log("[FilingScheduler] Stopping scheduler...");

		for (const [jobId, intervalId] of this.intervalIds.entries()) {
			clearInterval(intervalId);
			console.log(`[FilingScheduler] Stopped job: ${jobId}`);
		}

		this.intervalIds.clear();
	}

	private getAdvisoryLockKey(jobId: string): number {
		let hash = 0;
		const str = `filing_scheduler_${jobId}`;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash) % 2147483647;
	}

	private async acquireLock(jobId: string): Promise<string | null> {
		const existing = JOB_LOCKS.get(jobId);
		const now = new Date();

		if (existing && existing.expiresAt > now) {
			console.log(
				`[FilingScheduler] Job ${jobId} locked in-memory until ${existing.expiresAt}`,
			);
			return null;
		}

		const lockId = crypto.randomUUID();
		const advisoryKey = this.getAdvisoryLockKey(jobId);
		let advisoryLockAcquired = false;

		try {
			const { db } = await import("../db");
			const { sql } = await import("drizzle-orm");

			const result = await db.execute(sql`
        SELECT pg_try_advisory_lock(${advisoryKey}) as acquired
      `);

			const acquired = (result.rows[0] as any)?.acquired;
			if (!acquired) {
				console.log(
					`[FilingScheduler] Job ${jobId} locked by another instance (advisory lock ${advisoryKey})`,
				);
				return null;
			}

			advisoryLockAcquired = true;
			console.log(
				`[FilingScheduler] Acquired advisory lock ${advisoryKey} for job ${jobId}`,
			);
		} catch (error: any) {
			console.log(
				`[FilingScheduler] Advisory lock DB error, denying lock: ${error.message}`,
			);
			return null;
		}

		JOB_LOCKS.set(jobId, {
			lockId,
			acquiredAt: now,
			expiresAt: new Date(now.getTime() + LOCK_TIMEOUT_MS),
		});

		return lockId;
	}

	private async releaseLock(jobId: string, lockId: string): Promise<boolean> {
		const existing = JOB_LOCKS.get(jobId);
		if (existing && existing.lockId === lockId) {
			JOB_LOCKS.delete(jobId);

			const advisoryKey = this.getAdvisoryLockKey(jobId);

			try {
				const { db } = await import("../db");
				const { sql } = await import("drizzle-orm");

				await db.execute(sql`
          SELECT pg_advisory_unlock(${advisoryKey})
        `);

				console.log(
					`[FilingScheduler] Released advisory lock ${advisoryKey} for job ${jobId}`,
				);
			} catch (error: any) {
				console.log(
					`[FilingScheduler] Advisory unlock failed: ${error.message}`,
				);
			}

			return true;
		}
		return false;
	}

	private async logSebiAudit(action: string, details: any): Promise<void> {
		const { db } = await import("../db");
		const { sql } = await import("drizzle-orm");

		try {
			await db.execute(sql`
        INSERT INTO sebi_audit_log (action, details, timestamp)
        VALUES (${action}, ${JSON.stringify(details)}, NOW())
      `);
		} catch (error: any) {
			console.error(
				`[FilingScheduler] SEBI audit log failed: ${error.message}`,
			);
		}
	}

	async runJob(jobId: string): Promise<JobRunResult> {
		const job = this.jobs.get(jobId);
		if (!job) {
			throw new Error(`Job not found: ${jobId}`);
		}

		const lockId = await this.acquireLock(jobId);
		if (!lockId) {
			console.log(
				`[FilingScheduler] Job ${jobId} is already running, skipping`,
			);
			return {
				jobId,
				success: false,
				startTime: new Date(),
				endTime: new Date(),
				filingsProcessed: 0,
				newFilings: 0,
				errors: ["Job already running - concurrent execution prevented"],
			};
		}

		const startTime = new Date();
		this.runningJobs.add(jobId);
		job.isRunning = true;
		job.lastRun = startTime;

		const result: JobRunResult = {
			jobId,
			success: false,
			startTime,
			endTime: startTime,
			filingsProcessed: 0,
			newFilings: 0,
			errors: [],
		};

		try {
			console.log(`[FilingScheduler] Starting job: ${job.name}`);

			let fetchResult;

			switch (jobId) {
				case "daily_large_cap":
					fetchResult = await this.fetchLargeCapFilings();
					break;
				case "weekly_all_companies":
					fetchResult = await this.fetchAllCompanyFilings();
					break;
				case "monthly_historical":
					fetchResult = await this.fetchHistoricalFilings();
					break;
				default:
					throw new Error(`Unknown job type: ${jobId}`);
			}

			result.filingsProcessed = fetchResult.totalFilings;
			result.newFilings = fetchResult.newFilings;
			result.errors = fetchResult.errors;
			result.success = fetchResult.success;

			await this.logJobRun(jobId, result);

			console.log(
				`[FilingScheduler] Job ${job.name} completed: ${result.newFilings} new filings`,
			);
		} catch (error: any) {
			result.errors.push(error.message);
			console.error(
				`[FilingScheduler] Job ${job.name} failed: ${error.message}`,
			);
		} finally {
			result.endTime = new Date();
			this.runningJobs.delete(jobId);
			job.isRunning = false;
			await this.releaseLock(jobId, lockId);
		}

		return result;
	}

	private async fetchLargeCapFilings() {
		const today = new Date();
		const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

		const allFilings: any[] = [];
		const errors: string[] = [];

		for (const symbol of LARGE_CAP_SYMBOLS) {
			try {
				const nseResult = await exchangeFilingsService.fetchNSEFilings({
					symbol,
					fromDate,
					toDate: today,
				});

				allFilings.push(...nseResult.filings);
				errors.push(...nseResult.errors);

				await new Promise((resolve) => setTimeout(resolve, 500));
			} catch (error: any) {
				errors.push(`${symbol}: ${error.message}`);
			}
		}

		const persistResult =
			await exchangeFilingsService.persistFilings(allFilings);

		return {
			success: errors.length === 0,
			totalFilings: allFilings.length,
			newFilings: persistResult.inserted,
			errors: [...errors, ...persistResult.errors],
		};
	}

	private async fetchAllCompanyFilings() {
		const today = new Date();
		const fromDate = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

		const fetchResult = await exchangeFilingsService.fetchAllExchangeFilings({
			fromDate,
			toDate: today,
		});

		const allFilings = [...fetchResult.nse.filings, ...fetchResult.bse.filings];
		const persistResult =
			await exchangeFilingsService.persistFilings(allFilings);

		return {
			success: fetchResult.totalErrors === 0,
			totalFilings: fetchResult.totalFilings,
			newFilings: persistResult.inserted,
			errors: [
				...fetchResult.nse.errors,
				...fetchResult.bse.errors,
				...persistResult.errors,
			],
		};
	}

	private async fetchHistoricalFilings() {
		const today = new Date();
		const fromDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);

		const fetchResult = await exchangeFilingsService.fetchAllExchangeFilings({
			fromDate,
			toDate: today,
		});

		const allFilings = [...fetchResult.nse.filings, ...fetchResult.bse.filings];
		const persistResult =
			await exchangeFilingsService.persistFilings(allFilings);

		return {
			success: fetchResult.totalErrors === 0,
			totalFilings: fetchResult.totalFilings,
			newFilings: persistResult.inserted,
			errors: [
				...fetchResult.nse.errors,
				...fetchResult.bse.errors,
				...persistResult.errors,
			],
		};
	}

	private async logJobRun(jobId: string, result: JobRunResult) {
		const { db } = await import("../db");
		const { sql } = await import("drizzle-orm");

		try {
			await db.execute(sql`
        INSERT INTO cache_refresh_schedule (
          cache_type, refresh_frequency, last_run_at, last_run_status,
          last_run_records_processed, last_run_errors, is_enabled, priority
        ) VALUES (
          ${`filing_fetch_${jobId}`}, 
          ${jobId === "daily_large_cap" ? "daily" : "weekly"},
          ${result.startTime.toISOString()},
          ${result.success ? "success" : "failed"},
          ${result.newFilings},
          ${JSON.stringify(result.errors.slice(0, 10))},
          true,
          ${jobId === "daily_large_cap" ? 1 : 5}
        )
        ON CONFLICT (cache_type) DO UPDATE SET
          last_run_at = EXCLUDED.last_run_at,
          last_run_status = EXCLUDED.last_run_status,
          last_run_records_processed = EXCLUDED.last_run_records_processed,
          last_run_errors = EXCLUDED.last_run_errors,
          updated_at = NOW()
      `);
		} catch (error: any) {
			console.error(
				`[FilingScheduler] Failed to log job run: ${error.message}`,
			);
		}
	}

	async triggerManualFetch(
		options: {
			exchange?: "NSE" | "BSE" | "ALL";
			symbol?: string;
			fromDate?: Date;
			toDate?: Date;
		} = {},
	): Promise<JobRunResult> {
		const startTime = new Date();
		const result: JobRunResult = {
			jobId: "manual_fetch",
			success: false,
			startTime,
			endTime: startTime,
			filingsProcessed: 0,
			newFilings: 0,
			errors: [],
		};

		try {
			console.log("[FilingScheduler] Starting manual fetch...");

			const exchange = options.exchange || "ALL";
			const fromDate =
				options.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
			const toDate = options.toDate || new Date();

			const allFilings: any[] = [];

			if (exchange === "NSE" || exchange === "ALL") {
				const nseResult = await exchangeFilingsService.fetchNSEFilings({
					symbol: options.symbol,
					fromDate,
					toDate,
				});
				allFilings.push(...nseResult.filings);
				result.errors.push(...nseResult.errors);
			}

			if (exchange === "BSE" || exchange === "ALL") {
				const bseResult = await exchangeFilingsService.fetchBSEFilings({
					scripCode: options.symbol,
					fromDate,
					toDate,
				});
				allFilings.push(...bseResult.filings);
				result.errors.push(...bseResult.errors);
			}

			const persistResult =
				await exchangeFilingsService.persistFilings(allFilings);

			result.filingsProcessed = allFilings.length;
			result.newFilings = persistResult.inserted;
			result.errors.push(...persistResult.errors);
			result.success = true;

			console.log(
				`[FilingScheduler] Manual fetch completed: ${result.newFilings} new filings`,
			);
		} catch (error: any) {
			result.errors.push(error.message);
			console.error(`[FilingScheduler] Manual fetch failed: ${error.message}`);
		}

		result.endTime = new Date();
		return result;
	}

	getJobStatus(): ScheduledJob[] {
		return Array.from(this.jobs.values());
	}

	async enableJob(jobId: string): Promise<boolean> {
		const job = this.jobs.get(jobId);
		if (!job) return false;

		job.isEnabled = true;
		await this.startScheduler();
		return true;
	}

	async disableJob(jobId: string): Promise<boolean> {
		const job = this.jobs.get(jobId);
		if (!job) return false;

		job.isEnabled = false;

		const intervalId = this.intervalIds.get(jobId);
		if (intervalId) {
			clearInterval(intervalId);
			this.intervalIds.delete(jobId);
		}

		return true;
	}

	isJobRunning(jobId: string): boolean {
		return this.runningJobs.has(jobId);
	}
}

export const filingSchedulerService = new FilingSchedulerService();
