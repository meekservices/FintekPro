import axios from "axios";
import { db } from "../db";
import {
	mfNavHistory,
	mfMonthwisePerformance,
	mfSchemeExitLoads,
	mutualFunds,
} from "@shared/schema";
import { eq, sql, and, desc, asc, gte, lte } from "drizzle-orm";

interface NavDataPoint {
	date: string;
	nav: string;
}

interface MFApiResponse {
	meta: {
		fund_house: string;
		scheme_type: string;
		scheme_category: string;
		scheme_code: number;
		scheme_name: string;
	};
	data: NavDataPoint[];
	status: string;
}

interface CaptnemoResponse {
	isin: string;
	name: string;
	nav: number;
	date: string;
	exit_load?: string;
	expense_ratio?: number;
	lock_in_period?: number;
}

class MFDataSyncService {
	private readonly MFAPI_BASE_URL = "https://api.mfapi.in/mf";
	private readonly CAPTNEMO_BASE_URL = "https://mf.captnemo.in";

	private parseDate(dateStr: string): Date {
		const parts = dateStr.split("-");
		return new Date(
			Number.parseInt(parts[2]),
			Number.parseInt(parts[1]) - 1,
			Number.parseInt(parts[0]),
		);
	}

	private formatDateForDB(date: Date): string {
		return date.toISOString().split("T")[0];
	}

	async syncNavHistoryForScheme(
		schemeCode: string,
		maxDays: number = 1825,
	): Promise<number> {
		try {
			const response = await axios.get<MFApiResponse>(
				`${this.MFAPI_BASE_URL}/${schemeCode}`,
				{
					timeout: 60000,
				},
			);

			if (response.data?.status !== "SUCCESS" || !response.data?.data?.length) {
				console.warn(`[MFSync] No data for scheme ${schemeCode}`);
				return 0;
			}

			const navData = response.data.data.slice(0, maxDays);
			let inserted = 0;

			const existingDates = await db
				.select({ navDate: mfNavHistory.navDate })
				.from(mfNavHistory)
				.where(eq(mfNavHistory.schemeCode, schemeCode));

			const existingDateSet = new Set(existingDates.map((d) => d.navDate));

			const newRecords = navData
				.filter((point) => {
					const dateStr = this.formatDateForDB(this.parseDate(point.date));
					return !existingDateSet.has(dateStr);
				})
				.map((point) => ({
					schemeCode,
					navDate: this.formatDateForDB(this.parseDate(point.date)),
					nav: point.nav,
				}));

			if (newRecords.length > 0) {
				const batchSize = 500;
				for (let i = 0; i < newRecords.length; i += batchSize) {
					const batch = newRecords.slice(i, i + batchSize);
					await db.insert(mfNavHistory).values(batch);
					inserted += batch.length;
				}
			}

			console.log(
				`[MFSync] Synced ${inserted} NAV records for scheme ${schemeCode}`,
			);
			return inserted;
		} catch (error: any) {
			console.error(
				`[MFSync] Error syncing NAV for ${schemeCode}:`,
				error.message,
			);
			return 0;
		}
	}

	async syncNavHistoryForAllFunds(
		limit: number = 100,
	): Promise<{ total: number; synced: number }> {
		const funds = await db
			.select({ schemeCode: mutualFunds.schemeCode })
			.from(mutualFunds)
			.limit(limit);

		let synced = 0;
		for (const fund of funds) {
			const count = await this.syncNavHistoryForScheme(fund.schemeCode);
			if (count > 0) synced++;
			await new Promise((resolve) => setTimeout(resolve, 300));
		}

		console.log(
			`[MFSync] Synced NAV history for ${synced}/${funds.length} funds`,
		);
		return { total: funds.length, synced };
	}

	async calculateMonthlyReturnsForScheme(schemeCode: string): Promise<number> {
		try {
			const navData = await db
				.select({ navDate: mfNavHistory.navDate, nav: mfNavHistory.nav })
				.from(mfNavHistory)
				.where(eq(mfNavHistory.schemeCode, schemeCode))
				.orderBy(asc(mfNavHistory.navDate));

			if (navData.length < 20) return 0;

			const monthlyData = new Map<
				string,
				{
					first: { date: string; nav: number };
					last: { date: string; nav: number };
				}
			>();

			for (const record of navData) {
				const date = new Date(record.navDate);
				const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
				const nav = Number.parseFloat(record.nav);

				if (!monthlyData.has(monthYear)) {
					monthlyData.set(monthYear, {
						first: { date: record.navDate, nav },
						last: { date: record.navDate, nav },
					});
				} else {
					const existing = monthlyData.get(monthYear)!;
					if (record.navDate < existing.first.date) {
						existing.first = { date: record.navDate, nav };
					}
					if (record.navDate > existing.last.date) {
						existing.last = { date: record.navDate, nav };
					}
				}
			}

			let inserted = 0;
			for (const [monthYear, data] of monthlyData) {
				const returnPercent =
					((data.last.nav - data.first.nav) / data.first.nav) * 100;

				await db
					.insert(mfMonthwisePerformance)
					.values({
						schemeCode,
						monthYear,
						returnPercent: returnPercent.toFixed(4),
						navStart: data.first.nav.toString(),
						navEnd: data.last.nav.toString(),
						startDate: data.first.date,
						endDate: data.last.date,
					})
					.onConflictDoUpdate({
						target: [mfMonthwisePerformance.schemeCode, mfMonthwisePerformance.monthYear],
						set: {
							returnPercent: returnPercent.toFixed(4),
							navStart: data.first.nav.toString(),
							navEnd: data.last.nav.toString(),
							startDate: data.first.date,
							endDate: data.last.date,
							updatedAt: sql`NOW()`,
						},
					});
				inserted++;
			}

			return inserted;
		} catch (error: any) {
			console.error(
				`[MFSync] Error calculating monthly returns for ${schemeCode}:`,
				error.message,
			);
			return 0;
		}
	}

	async calculateReturnsFromLocalHistory(schemeCode: string): Promise<{
		returns1y: number;
		returns3y: number;
		returns5y: number;
	} | null> {
		try {
			const latestNav = await db
				.select({ navDate: mfNavHistory.navDate, nav: mfNavHistory.nav })
				.from(mfNavHistory)
				.where(eq(mfNavHistory.schemeCode, schemeCode))
				.orderBy(desc(mfNavHistory.navDate))
				.limit(1);

			if (!latestNav.length) return null;

			const currentNav = Number.parseFloat(latestNav[0].nav);
			const currentDate = new Date(latestNav[0].navDate);

			const date1yAgo = new Date(currentDate);
			date1yAgo.setFullYear(date1yAgo.getFullYear() - 1);

			const date3yAgo = new Date(currentDate);
			date3yAgo.setFullYear(date3yAgo.getFullYear() - 3);

			const date5yAgo = new Date(currentDate);
			date5yAgo.setFullYear(date5yAgo.getFullYear() - 5);

			const getNavNearDate = async (
				targetDate: Date,
			): Promise<number | null> => {
				const minDate = new Date(targetDate);
				minDate.setDate(minDate.getDate() - 7);
				const maxDate = new Date(targetDate);
				maxDate.setDate(maxDate.getDate() + 7);

				const result = await db
					.select({ nav: mfNavHistory.nav })
					.from(mfNavHistory)
					.where(
						and(
							eq(mfNavHistory.schemeCode, schemeCode),
							gte(mfNavHistory.navDate, this.formatDateForDB(minDate)),
							lte(mfNavHistory.navDate, this.formatDateForDB(maxDate)),
						),
					)
					.orderBy(
						sql`ABS(nav_date - ${this.formatDateForDB(targetDate)}::date)`,
					)
					.limit(1);

				return result.length ? Number.parseFloat(result[0].nav) : null;
			};

			const [nav1yAgo, nav3yAgo, nav5yAgo] = await Promise.all([
				getNavNearDate(date1yAgo),
				getNavNearDate(date3yAgo),
				getNavNearDate(date5yAgo),
			]);

			const returns1y = nav1yAgo ? (currentNav / nav1yAgo - 1) * 100 : 0;
			const returns3y = nav3yAgo
				? ((currentNav / nav3yAgo) ** (1 / 3) - 1) * 100
				: 0;
			const returns5y = nav5yAgo
				? ((currentNav / nav5yAgo) ** (1 / 5) - 1) * 100
				: 0;

			return {
				returns1y: Math.round(returns1y * 100) / 100,
				returns3y: Math.round(returns3y * 100) / 100,
				returns5y: Math.round(returns5y * 100) / 100,
			};
		} catch (error: any) {
			console.error(
				`[MFSync] Error calculating returns for ${schemeCode}:`,
				error.message,
			);
			return null;
		}
	}

	async updateMutualFundReturns(schemeCode: string): Promise<boolean> {
		const returns = await this.calculateReturnsFromLocalHistory(schemeCode);
		if (!returns) return false;

		try {
			await db
				.update(mutualFunds)
				.set({
					returns1y: returns.returns1y.toString(),
					returns3y: returns.returns3y.toString(),
					returns5y: returns.returns5y.toString(),
					lastUpdated: sql`NOW()`,
				})
				.where(eq(mutualFunds.schemeCode, schemeCode));

			return true;
		} catch (error: any) {
			console.error(
				`[MFSync] Error updating returns for ${schemeCode}:`,
				error.message,
			);
			return false;
		}
	}

	async batchUpdateAllReturns(
		limit: number = 500,
	): Promise<{ updated: number; failed: number }> {
		const funds = await db
			.select({ schemeCode: mutualFunds.schemeCode })
			.from(mutualFunds)
			.limit(limit);

		let updated = 0;
		let failed = 0;

		for (const fund of funds) {
			const success = await this.updateMutualFundReturns(fund.schemeCode);
			if (success) updated++;
			else failed++;
		}

		console.log(
			`[MFSync] Updated returns: ${updated} success, ${failed} failed`,
		);
		return { updated, failed };
	}

	async fetchExitLoadFromCaptnemo(isin: string): Promise<{
		exitLoadPercent: number;
		exitLoadDays: number;
		description: string;
	} | null> {
		try {
			const response = await axios.get<CaptnemoResponse>(
				`${this.CAPTNEMO_BASE_URL}/${isin}.json`,
				{
					timeout: 10000,
				},
			);

			if (response.data?.exit_load) {
				const exitLoadStr = response.data.exit_load;
				const percentMatch = exitLoadStr.match(/(\d+(?:\.\d+)?)\s*%/);
				const daysMatch = exitLoadStr.match(
					/(\d+)\s*(?:days?|months?|years?)/i,
				);

				let days = 0;
				if (daysMatch) {
					const value = Number.parseInt(daysMatch[1]);
					if (exitLoadStr.toLowerCase().includes("year")) days = value * 365;
					else if (exitLoadStr.toLowerCase().includes("month"))
						days = value * 30;
					else days = value;
				}

				return {
					exitLoadPercent: percentMatch
						? Number.parseFloat(percentMatch[1])
						: 0,
					exitLoadDays: days,
					description: exitLoadStr,
				};
			}

			return null;
		} catch (error: any) {
			console.error(
				`[MFSync] Error fetching exit load for ${isin}:`,
				error.message,
			);
			return null;
		}
	}

	async syncExitLoadForScheme(
		schemeCode: string,
		isin: string,
	): Promise<boolean> {
		const exitLoadData = await this.fetchExitLoadFromCaptnemo(isin);
		if (!exitLoadData) return false;

		try {
			await db
				.insert(mfSchemeExitLoads)
				.values({
					schemeCode,
					isin,
					tier: 1,
					minDays: 0,
					maxDays: exitLoadData.exitLoadDays || 365,
					exitLoadPercent: exitLoadData.exitLoadPercent.toString(),
					description: exitLoadData.description,
					lastVerified: sql`NOW()`,
				})
				.onConflictDoNothing();

			if (exitLoadData.exitLoadDays > 0) {
				await db
					.insert(mfSchemeExitLoads)
					.values({
						schemeCode,
						isin,
						tier: 2,
						minDays: exitLoadData.exitLoadDays + 1,
						maxDays: null,
						exitLoadPercent: "0",
						description: "No exit load after holding period",
						lastVerified: sql`NOW()`,
					})
					.onConflictDoNothing();
			}

			return true;
		} catch (error: any) {
			console.error(
				`[MFSync] Error saving exit load for ${schemeCode}:`,
				error.message,
			);
			return false;
		}
	}

	async getExitSignals(schemeCode: string): Promise<{
		signal: "exit" | "caution" | "hold";
		reason: string;
		consecutiveNegativeMonths: number;
		trailing6MReturn: number;
	} | null> {
		try {
			const recentReturns = await db
				.select({
					monthYear: mfMonthwisePerformance.monthYear,
					returnPercent: mfMonthwisePerformance.returnPercent,
				})
				.from(mfMonthwisePerformance)
				.where(eq(mfMonthwisePerformance.schemeCode, schemeCode))
				.orderBy(desc(mfMonthwisePerformance.monthYear))
				.limit(6);

			if (recentReturns.length < 3) return null;

			let consecutiveNegative = 0;
			for (const r of recentReturns) {
				if (Number.parseFloat(r.returnPercent || "0") < 0)
					consecutiveNegative++;
				else break;
			}

			const trailing6M = recentReturns.reduce(
				(sum, r) => sum + Number.parseFloat(r.returnPercent || "0"),
				0,
			);

			let signal: "exit" | "caution" | "hold" = "hold";
			let reason = "Fund performing within normal range";

			if (consecutiveNegative >= 3) {
				signal = "exit";
				reason = `${consecutiveNegative} consecutive months of negative returns`;
			} else if (trailing6M < -10) {
				signal = "exit";
				reason = `Trailing 6-month return is ${trailing6M.toFixed(1)}%`;
			} else if (consecutiveNegative >= 2 || trailing6M < -5) {
				signal = "caution";
				reason = `Recent underperformance: ${consecutiveNegative} negative months, 6M return ${trailing6M.toFixed(1)}%`;
			}

			return {
				signal,
				reason,
				consecutiveNegativeMonths: consecutiveNegative,
				trailing6MReturn: Math.round(trailing6M * 100) / 100,
			};
		} catch (error: any) {
			console.error(
				`[MFSync] Error getting exit signals for ${schemeCode}:`,
				error.message,
			);
			return null;
		}
	}

	async runDailySync(): Promise<void> {
		console.log("[MFSync] Starting daily sync...");

		const fundsToSync = await db
			.select({ schemeCode: mutualFunds.schemeCode })
			.from(mutualFunds)
			.where(eq(mutualFunds.isPublished, true))
			.limit(100);

		for (const fund of fundsToSync) {
			await this.syncNavHistoryForScheme(fund.schemeCode, 30);
			await this.calculateMonthlyReturnsForScheme(fund.schemeCode);
			await this.updateMutualFundReturns(fund.schemeCode);
			await new Promise((resolve) => setTimeout(resolve, 500));
		}

		console.log("[MFSync] Daily sync complete");
	}
}

export const mfDataSyncService = new MFDataSyncService();
