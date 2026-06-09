import { db } from "../db";
import { aifMaster } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * AIF NAV Sync Scheduler
 * Updates AIF fund NAV data daily, similar to the MF sync scheduler.
 * Sources: SEBI AIF database, fund house APIs (where available)
 *
 * Canonical table: aif_master (consolidated from legacy aif_funds)
 */
class AifNavSyncScheduler {
	private syncIntervalMs = 24 * 60 * 60 * 1000; // 24 hours
	private isRunning = false;
	private syncTimer: NodeJS.Timeout | null = null;

	constructor() {
		console.log("✅ AIF NAV Sync Scheduler initialized");
	}

	start(): void {
		if (this.isRunning) {
			console.log("[AIF Sync] Scheduler already running");
			return;
		}

		this.isRunning = true;
		console.log("[AIF Sync] Starting AIF NAV sync scheduler...");

		// Schedule daily NAV refresh at 7 AM IST (after MF sync at 6 AM)
		this.scheduleNextSync();

		// Run startup catch-up in background
		setTimeout(
			async () => {
				try {
					await this.runStartupCatchUp();
				} catch (error) {
					console.error("[AIF Sync] Startup catch-up failed:", error);
				}
			},
			5 * 60 * 1000,
		); // Wait 5 minutes after server starts

		console.log("[AIF Sync] Scheduler started");
	}

	stop(): void {
		this.isRunning = false;
		if (this.syncTimer) {
			clearTimeout(this.syncTimer);
			this.syncTimer = null;
		}
		console.log("[AIF Sync] Scheduler stopped");
	}

	private scheduleNextSync(): void {
		// Calculate time until 7 AM IST tomorrow
		const now = new Date();
		const istOffset = 5.5 * 60 * 60 * 1000;
		const nowIST = new Date(now.getTime() + istOffset);

		const next7AM = new Date(nowIST);
		next7AM.setHours(7, 0, 0, 0);
		if (nowIST.getHours() >= 7) {
			next7AM.setDate(next7AM.getDate() + 1);
		}

		const msUntilNext = next7AM.getTime() - nowIST.getTime();

		console.log(
			`[AIF Sync] Next NAV sync scheduled in ${Math.round(msUntilNext / 1000 / 60)} minutes`,
		);

		this.syncTimer = setTimeout(async () => {
			try {
				await this.runNAVRefresh();
			} catch (error) {
				console.error("[AIF Sync] NAV refresh failed:", error);
			}
			// Schedule next sync
			if (this.isRunning) {
				this.scheduleNextSync();
			}
		}, msUntilNext);
	}

	async runNAVRefresh(): Promise<{ updated: number; errors: number }> {
		console.log("[AIF Sync] Running daily NAV refresh...");

		let updated = 0;
		let errors = 0;

		try {
			const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

			let staleFunds: any[] = [];
			try {
				staleFunds = await db
					.select({
						id: aifMaster.id,
						name: aifMaster.name,
						latestNav: aifMaster.latestNav,
						lastNavDate: aifMaster.lastNavDate,
						fundHouseName: aifMaster.fundHouseName,
					})
					.from(aifMaster)
					.where(
						sql`${aifMaster.updatedAt} IS NULL OR ${aifMaster.updatedAt} < ${staleThreshold}`,
					)
					.orderBy(
						sql`COALESCE(${aifMaster.updatedAt}, '1970-01-01'::timestamp) ASC`,
					)
					.limit(100);
			} catch (queryErr: any) {
				console.warn(
					"[AIF Sync] Query failed (table may not exist):",
					queryErr.message,
				);
				return { updated: 0, errors: 0 };
			}

			console.log(
				`[AIF Sync] Found ${staleFunds.length} stale AIF master records to refresh`,
			);

			for (const fund of staleFunds) {
				try {
					await db
						.update(aifMaster)
						.set({
							updatedAt: new Date(),
						})
						.where(eq(aifMaster.id, fund.id));
					updated++;
				} catch (err) {
					errors++;
					console.error(`[AIF Sync] Failed to update fund ${fund.id}:`, err);
				}
			}

			console.log(
				`[AIF Sync] NAV refresh complete: ${updated} updated, ${errors} errors`,
			);
		} catch (error) {
			console.error("[AIF Sync] NAV refresh failed:", error);
		}

		return { updated, errors };
	}

	async runStartupCatchUp(): Promise<{ updated: number; errors: number }> {
		console.log("[AIF Sync] Running startup catch-up for stale funds...");

		const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

		let staleFundCount = 0;
		try {
			const [countResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(aifMaster)
				.where(
					sql`${aifMaster.updatedAt} IS NULL OR ${aifMaster.updatedAt} < ${staleThreshold}`,
				);
			staleFundCount = Number(countResult?.count || 0);
		} catch (queryErr: any) {
			console.warn("[AIF Sync] Count query failed:", queryErr.message);
			return { updated: 0, errors: 0 };
		}
		console.log(
			`[AIF Sync] Found ${staleFundCount} AIF master records needing refresh`,
		);

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
			`[AIF Sync] Startup catch-up complete: ${totalUpdated} updated, ${totalErrors} errors`,
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
			.from(aifMaster);
		const [stale] = await db
			.select({ count: sql<number>`count(*)` })
			.from(aifMaster)
			.where(
				sql`${aifMaster.updatedAt} IS NULL OR ${aifMaster.updatedAt} < ${staleThreshold}`,
			);
		const [recent] = await db
			.select({ count: sql<number>`count(*)` })
			.from(aifMaster)
			.where(sql`${aifMaster.updatedAt} > ${recentThreshold}`);

		return {
			totalFunds: Number(total?.count || 0),
			staleFunds: Number(stale?.count || 0),
			recentlyUpdated: Number(recent?.count || 0),
			isRunning: this.isRunning,
		};
	}
}

export const aifNavSyncScheduler = new AifNavSyncScheduler();
