// @ts-nocheck
/**
 * AMFI NAV Scheduler
 *
 * Automatically syncs NAV data from AMFI official source daily at 11:30 PM IST
 * This ensures all mutual fund NAVs are updated with SEBI-compliant data
 */

import cron from "node-cron";
import { amfiOfficialNavService } from "./amfi-official-nav-service";

class AmfiNavScheduler {
	private static instance: AmfiNavScheduler;
	private isInitialized = false;
	private cronJob: cron.ScheduledTask | null = null;

	static getInstance(): AmfiNavScheduler {
		if (!AmfiNavScheduler.instance) {
			AmfiNavScheduler.instance = new AmfiNavScheduler();
		}
		return AmfiNavScheduler.instance;
	}

	/**
	 * Initialize the scheduler
	 * Runs daily at 11:30 PM IST (18:00 UTC)
	 * AMFI publishes NAV data around 11 PM IST, so we sync 30 minutes after
	 */
	initialize(): void {
		if (this.isInitialized) {
			console.log("[AMFI NAV Scheduler] Already initialized");
			return;
		}

		// Schedule: 11:30 PM IST = 18:00 UTC
		// Cron expression: minute hour day-of-month month day-of-week
		// "0 18 * * *" = At 18:00 UTC every day = 11:30 PM IST
		this.cronJob = cron.schedule(
			"0 18 * * *",
			async () => {
				console.log("[AMFI NAV Scheduler] Starting scheduled NAV sync...");
				try {
					const result = await amfiOfficialNavService.syncNavToDatabase();
					console.log(
						`[AMFI NAV Scheduler] Scheduled sync completed: ${result.updatedFunds} funds updated`,
					);
				} catch (error: any) {
					console.error(
						"[AMFI NAV Scheduler] Scheduled sync failed:",
						error.message,
					);
				}
			},
			{
				timezone: "UTC",
			},
		);

		this.isInitialized = true;

		// Calculate next run time for logging
		const now = new Date();
		const nextRun = new Date();
		nextRun.setUTCHours(18, 0, 0, 0);
		if (nextRun <= now) {
			nextRun.setDate(nextRun.getDate() + 1);
		}

		console.log(
			`[AMFI NAV Scheduler] Initialized - daily sync at 11:30 PM IST`,
		);
		console.log(
			`[AMFI NAV Scheduler] Next scheduled run: ${nextRun.toISOString()}`,
		);
	}

	/**
	 * Stop the scheduler
	 */
	stop(): void {
		if (this.cronJob) {
			this.cronJob.stop();
			this.cronJob = null;
		}
		this.isInitialized = false;
		console.log("[AMFI NAV Scheduler] Stopped");
	}

	/**
	 * Check if scheduler is running
	 */
	isRunning(): boolean {
		return this.isInitialized;
	}

	/**
	 * Get scheduler status
	 */
	getStatus(): {
		isRunning: boolean;
		nextRunTime: string | null;
		lastSyncResult: any;
	} {
		let nextRunTime: string | null = null;

		if (this.isInitialized) {
			const now = new Date();
			const nextRun = new Date();
			nextRun.setUTCHours(18, 0, 0, 0);
			if (nextRun <= now) {
				nextRun.setDate(nextRun.getDate() + 1);
			}
			nextRunTime = nextRun.toISOString();
		}

		return {
			isRunning: this.isInitialized,
			nextRunTime,
			lastSyncResult: amfiOfficialNavService.getLastSyncResult(),
		};
	}

	/**
	 * Trigger manual sync
	 */
	async triggerManualSync(): Promise<any> {
		console.log("[AMFI NAV Scheduler] Manual sync triggered");
		return amfiOfficialNavService.syncNavToDatabase();
	}
}

export const amfiNavScheduler = AmfiNavScheduler.getInstance();
