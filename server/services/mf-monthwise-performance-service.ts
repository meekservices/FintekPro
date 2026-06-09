import { db } from "../db";
import {
	mfMonthwisePerformance,
	historicalNavData,
	mutualFunds,
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sql } from "drizzle-orm";

interface MonthlyReturn {
	monthYear: string;
	navStart: number | null;
	navEnd: number | null;
	returnPercent: number | null;
	benchmarkReturn: number | null;
	excessReturn: number | null;
	isPartial: boolean;
}

interface CalculationResult {
	success: boolean;
	schemeCode: string;
	monthsCalculated: number;
	dateRange: {
		start: string | null;
		end: string | null;
	};
	error?: string;
}

const NIFTY_MONTHLY_RETURNS: Record<string, number> = {
	"2025-01": -0.8,
	"2024-12": -2.0,
	"2024-11": 1.5,
	"2024-10": -6.2,
	"2024-09": 2.3,
	"2024-08": 1.1,
	"2024-07": 4.1,
	"2024-06": 3.5,
	"2024-05": -0.3,
	"2024-04": 1.2,
	"2024-03": 1.6,
	"2024-02": 1.0,
	"2024-01": -0.2,
	"2023-12": 7.9,
	"2023-11": 5.5,
};

export class MfMonthwisePerformanceService {
	private static instance: MfMonthwisePerformanceService;

	static getInstance(): MfMonthwisePerformanceService {
		if (!MfMonthwisePerformanceService.instance) {
			MfMonthwisePerformanceService.instance =
				new MfMonthwisePerformanceService();
		}
		return MfMonthwisePerformanceService.instance;
	}

	async calculateAndStoreMonthlyReturns(
		schemeCode: string,
	): Promise<CalculationResult> {
		try {
			console.log(
				`[MFMonthwise] Calculating monthly returns for scheme ${schemeCode}...`,
			);

			const navData = await db
				.select({
					date: historicalNavData.date,
					nav: historicalNavData.nav,
				})
				.from(historicalNavData)
				.where(
					and(
						eq(historicalNavData.identifier, schemeCode),
						eq(historicalNavData.identifierType, "mutual_fund"),
					),
				)
				.orderBy(asc(historicalNavData.date));

			if (navData.length === 0) {
				return {
					success: false,
					schemeCode,
					monthsCalculated: 0,
					dateRange: { start: null, end: null },
					error: "No historical NAV data found for this scheme",
				};
			}

			const monthlyData = this.groupByMonth(navData);
			const monthlyReturns = this.calculateMonthlyReturns(monthlyData);

			let insertedCount = 0;
			for (const monthReturn of monthlyReturns) {
				try {
					await db
						.insert(mfMonthwisePerformance)
						.values({
							schemeCode,
							monthYear: monthReturn.monthYear,
							navStart: monthReturn.navStart?.toString() || null,
							navEnd: monthReturn.navEnd?.toString() || null,
							returnPercent: monthReturn.returnPercent?.toString() || null,
							benchmarkReturn: monthReturn.benchmarkReturn?.toString() || null,
							excessReturn: monthReturn.excessReturn?.toString() || null,
							isPartial: monthReturn.isPartial,
						})
						.onConflictDoUpdate({
							target: [
								mfMonthwisePerformance.schemeCode,
								mfMonthwisePerformance.monthYear,
							],
							set: {
								navStart: monthReturn.navStart?.toString() || null,
								navEnd: monthReturn.navEnd?.toString() || null,
								returnPercent: monthReturn.returnPercent?.toString() || null,
								benchmarkReturn:
									monthReturn.benchmarkReturn?.toString() || null,
								excessReturn: monthReturn.excessReturn?.toString() || null,
								isPartial: monthReturn.isPartial,
								updatedAt: sql`NOW()`,
							},
						});
					insertedCount++;
				} catch (err) {
					console.error(
						`[MFMonthwise] Error inserting month ${monthReturn.monthYear}:`,
						err,
					);
				}
			}

			const months = monthlyReturns.map((r) => r.monthYear).sort();

			console.log(
				`[MFMonthwise] Stored ${insertedCount} monthly records for scheme ${schemeCode}`,
			);

			return {
				success: true,
				schemeCode,
				monthsCalculated: insertedCount,
				dateRange: {
					start: months[0] || null,
					end: months[months.length - 1] || null,
				},
			};
		} catch (error) {
			console.error(`[MFMonthwise] Error calculating monthly returns:`, error);
			return {
				success: false,
				schemeCode,
				monthsCalculated: 0,
				dateRange: { start: null, end: null },
				error: error instanceof Error ? error.message : "Unknown error",
			};
		}
	}

	private groupByMonth(
		navData: Array<{ date: string; nav: string }>,
	): Map<string, Array<{ date: string; nav: number }>> {
		const monthlyData = new Map<string, Array<{ date: string; nav: number }>>();

		for (const point of navData) {
			const date = new Date(point.date);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

			if (!monthlyData.has(monthKey)) {
				monthlyData.set(monthKey, []);
			}
			monthlyData.get(monthKey)!.push({
				date: point.date,
				nav: Number.parseFloat(point.nav),
			});
		}

		for (const [, data] of monthlyData) {
			data.sort((a, b) => a.date.localeCompare(b.date));
		}

		return monthlyData;
	}

	private calculateMonthlyReturns(
		monthlyData: Map<string, Array<{ date: string; nav: number }>>,
	): MonthlyReturn[] {
		const returns: MonthlyReturn[] = [];
		const sortedMonths = Array.from(monthlyData.keys()).sort();

		for (const monthKey of sortedMonths) {
			const monthData = monthlyData.get(monthKey)!;

			if (monthData.length === 0) continue;

			const navStart = monthData[0].nav;
			const navEnd = monthData[monthData.length - 1].nav;

			const returnPercent =
				navStart > 0 ? ((navEnd - navStart) / navStart) * 100 : null;

			const benchmarkReturn = NIFTY_MONTHLY_RETURNS[monthKey] || null;

			const excessReturn =
				returnPercent !== null && benchmarkReturn !== null
					? returnPercent - benchmarkReturn
					: null;

			const lastDayOfMonth = new Date(
				Number.parseInt(monthKey.split("-")[0]),
				Number.parseInt(monthKey.split("-")[1]),
				0,
			).getDate();
			const lastDataDate = new Date(monthData[monthData.length - 1].date);
			const isPartial = lastDataDate.getDate() < lastDayOfMonth - 2;

			returns.push({
				monthYear: `${monthKey}-01`,
				navStart,
				navEnd,
				returnPercent:
					returnPercent !== null ? Math.round(returnPercent * 100) / 100 : null,
				benchmarkReturn,
				excessReturn:
					excessReturn !== null ? Math.round(excessReturn * 100) / 100 : null,
				isPartial,
			});
		}

		return returns;
	}

	async getMonthwisePerformance(
		schemeCode: string,
		months: number = 24,
	): Promise<MonthlyReturn[]> {
		try {
			const results = await db
				.select({
					monthYear: mfMonthwisePerformance.monthYear,
					navStart: mfMonthwisePerformance.navStart,
					navEnd: mfMonthwisePerformance.navEnd,
					returnPercent: mfMonthwisePerformance.returnPercent,
					benchmarkReturn: mfMonthwisePerformance.benchmarkReturn,
					excessReturn: mfMonthwisePerformance.excessReturn,
					isPartial: mfMonthwisePerformance.isPartial,
				})
				.from(mfMonthwisePerformance)
				.where(eq(mfMonthwisePerformance.schemeCode, schemeCode))
				.orderBy(desc(mfMonthwisePerformance.monthYear))
				.limit(months);

			return results.map((r) => ({
				monthYear: r.monthYear,
				navStart: r.navStart ? Number.parseFloat(r.navStart) : null,
				navEnd: r.navEnd ? Number.parseFloat(r.navEnd) : null,
				returnPercent: r.returnPercent
					? Number.parseFloat(r.returnPercent)
					: null,
				benchmarkReturn: r.benchmarkReturn
					? Number.parseFloat(r.benchmarkReturn)
					: null,
				excessReturn: r.excessReturn ? Number.parseFloat(r.excessReturn) : null,
				isPartial: r.isPartial || false,
			}));
		} catch (error) {
			console.error(`[MFMonthwise] Error fetching monthly performance:`, error);
			return [];
		}
	}

	async refreshAllFundsMonthlyPerformance(limit: number = 100): Promise<{
		processed: number;
		successful: number;
		failed: number;
	}> {
		try {
			const funds = await db
				.select({ schemeCode: mutualFunds.schemeCode })
				.from(mutualFunds)
				.limit(limit);

			let successful = 0;
			let failed = 0;

			for (const fund of funds) {
				const result = await this.calculateAndStoreMonthlyReturns(
					fund.schemeCode,
				);
				if (result.success && result.monthsCalculated > 0) {
					successful++;
				} else {
					failed++;
				}
			}

			return {
				processed: funds.length,
				successful,
				failed,
			};
		} catch (error) {
			console.error(`[MFMonthwise] Error refreshing all funds:`, error);
			return { processed: 0, successful: 0, failed: 0 };
		}
	}
}

export const mfMonthwisePerformanceService =
	MfMonthwisePerformanceService.getInstance();
