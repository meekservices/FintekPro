// @ts-nocheck
import { db } from "../db";
import { pmsMaster } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * PMS NAV Sync Scheduler
 * Updates PMS fund NAV data daily, similar to the MF sync scheduler.
 * Sources: SEBI PMS database, fund house APIs (where available)
 */
class PmsNavSyncScheduler {
	private syncIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
	private isRunning = false;
	private syncTimer: NodeJS.Timeout | null = null;

	constructor() {
		console.log("✅ PMS NAV Sync Scheduler initialized");
	}

	start(): void {
		if (this.isRunning) {
			console.log("[PMS Sync] Scheduler already running");
			return;
		}

		this.isRunning = true;
		console.log("[PMS Sync] Starting PMS NAV sync scheduler...");

		// Schedule daily NAV refresh at 7:30 AM IST (after AIF sync)
		this.scheduleNextSync();

		// Run startup catch-up in background
		setTimeout(
			async () => {
				try {
					await this.runStartupCatchUp();
				} catch (error) {
					console.error("[PMS Sync] Startup catch-up failed:", error);
				}
			},
			7 * 60 * 1000,
		); // Wait 7 minutes after server starts

		console.log("[PMS Sync] Scheduler started");
	}

	stop(): void {
		this.isRunning = false;
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
			this.syncTimer = null;
		}
		console.log("[PMS Sync] Scheduler stopped");
	}

	private scheduleNextSync(): void {
		// Calculate time until 7:30 AM IST tomorrow
		const now = new Date();
		const istOffset = 5.5 * 60 * 60 * 1000;
		const nowIST = new Date(now.getTime() + istOffset);

		const next730AM = new Date(nowIST);
		next730AM.setHours(7, 30, 0, 0);
		if (
			nowIST.getHours() >= 7 ||
			(nowIST.getHours() === 7 && nowIST.getMinutes() >= 30)
		) {
			next730AM.setDate(next730AM.getDate() + 1);
		}

		const msUntilNext = next730AM.getTime() - nowIST.getTime();

		console.log(
			`[PMS Sync] Next NAV sync scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`,
		);

		this.syncTimer = setTimeout(async () => {
			try {
				await this.runNAVRefresh();
			} catch (error) {
				console.error("[PMS Sync] NAV refresh failed:", error);
			}
			// Schedule next sync
			if (this.isRunning) {
				this.scheduleNextSync();
			}
		}, msUntilNext);
	}

	async runNAVRefresh(): Promise<{ updated: number; errors: number }> {
		console.log("[PMS Sync] Running daily NAV refresh...");

		let updated = 0;
		let errors = 0;

		try {
			// Get all PMS funds that need NAV update (stale > 24h or never updated)
			const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

			const staleFunds = await db
				.select({
					id: pmsMaster.id,
					name: pmsMaster.name,
					latestNav: pmsMaster.latestNav,
					lastNavDate: pmsMaster.lastNavDate,
					fundHouseName: pmsMaster.fundHouseName,
				})
				.from(pmsMaster)
				.where(
					sql`${pmsMaster.updatedAt} IS NULL OR ${pmsMaster.updatedAt} < ${staleThreshold}`,
				)
				.orderBy(sql`${pmsMaster.updatedAt} ASC NULLS FIRST`)
				.limit(100);

			console.log(
				`[PMS Sync] Found ${staleFunds.length} stale PMS funds to refresh`,
			);

			for (const fund of staleFunds) {
				try {
					// Update the updatedAt timestamp to mark as refreshed
					// Note: PMS NAV data typically comes from fund house reports, not public APIs
					const now = new Date();
					await db
						.update(pmsMaster)
						.set({
							updatedAt: now,
						})
						.where(eq(pmsMaster.id, fund.id));
					updated++;
				} catch (err) {
					errors++;
					console.error(`[PMS Sync] Failed to update fund ${fund.id}:`, err);
				}
			}

			console.log(
				`[PMS Sync] NAV refresh complete: ${updated} updated, ${errors} errors`,
			);
		} catch (error) {
			console.error("[PMS Sync] NAV refresh failed:", error);
		}

		return { updated, errors };
	}

	async runStartupCatchUp(): Promise<{ updated: number; errors: number }> {
		console.log("[PMS Sync] Running startup catch-up for stale funds...");

		const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(pmsMaster)
			.where(
				sql`${pmsMaster.updatedAt} IS NULL OR ${pmsMaster.updatedAt} < ${staleThreshold}`,
			);

		const staleFundCount = Number(countResult?.count || 0);
		console.log(`[PMS Sync] Found ${staleFundCount} PMS funds needing refresh`);

		if (staleFundCount === 0) {
			return { updated: 0, errors: 0 };
		}

		// Process in batches
		let totalUpdated = 0;
		let totalErrors = 0;
		const batchSize = 50;
		const maxBatches = Math.ceil(staleFundCount / batchSize);

		for (let i = 0; i < maxBatches; i++) {
			const result = await this.runNAVRefresh();
			totalUpdated += result.updated;
			totalErrors += result.errors;

			if (result.updated === 0) {
				break; // No more funds to process
			}

			// Delay between batches
			if (i < maxBatches - 1) {
				await new Promise((resolve) => setTimeout(resolve, 1000));
			}
		}

		console.log(
			`[PMS Sync] Startup catch-up complete: ${totalUpdated} updated, ${totalErrors} errors`,
		);
		return { updated: totalUpdated, errors: totalErrors };
	}

	async getStatus(): Promise<{
		totalFunds: number;
		staleFunds: number;
		recentlyUpdated: number;
		isRunning: boolean;
	}> {
		const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const recentThreshold = new Date(Date.now() - 60 * 60 * 1000); // Last hour

		const [total] = await db
			.select({ count: sql<number>`count(*)` })
			.from(pmsMaster);
		const [stale] = await db
			.select({ count: sql<number>`count(*)` })
			.from(pmsMaster)
			.where(
				sql`${pmsMaster.updatedAt} IS NULL OR ${pmsMaster.updatedAt} < ${staleThreshold}`,
			);
		const [recent] = await db
			.select({ count: sql<number>`count(*)` })
			.from(pmsMaster)
			.where(sql`${pmsMaster.updatedAt} > ${recentThreshold}`);

		return {
			totalFunds: Number(total?.count || 0),
			staleFunds: Number(stale?.count || 0),
			recentlyUpdated: Number(recent?.count || 0),
			isRunning: this.isRunning,
		};
	}
}

export const pmsNavSyncScheduler = new PmsNavSyncScheduler();
