// @ts-nocheck
import { db } from "../db";
import { mfOrders, users, capitalGainsTaxReminders } from "@shared/schema";
import { eq, and, gte, lte, sql, inArray } from "drizzle-orm";
import { proposalCapitalGainsService } from "./proposal-capital-gains-service";

interface FiscalYearGains {
	fiscalYear: string;
	userId: string;

	stcg: {
		equity: number;
		debtPreApr2023: number;
		debtPostApr2023: number;
		others: number;
		total: number;
	};

	ltcg: {
		equity: number;
		equityWithGrandfathering: number;
		debtWithIndexation: number;
		debtWithoutIndexation: number;
		others: number;
		total: number;
	};

	totalRealizedGains: number;
	totalTaxLiability: number;

	trades: {
		orderId: string;
		schemeName: string;
		isin?: string;
		saleDate: string;
		gainType: string;
		realizedGain: number;
		taxableGain: number;
		estimatedTax: number;
	}[];

	quarterlyBreakdown: {
		quarter: string;
		dueDate: string;
		cumulativePercentage: number;
		stcg: number;
		ltcg: number;
		totalGains: number;
		taxDue: number;
		taxPaid: number;
		balance: number;
	}[];
}

interface AdvanceTaxStatus {
	fiscalYear: string;
	userId: string;
	totalEstimatedTax: number;
	totalPaid: number;
	totalDue: number;
	nextDueDate: string | null;
	nextDueAmount: number;
	quarters: {
		quarter: string;
		dueDate: string;
		percentageDue: number;
		amountDue: number;
		amountPaid: number;
		status: "paid" | "partial" | "pending" | "overdue";
	}[];
}

class RealizedGainsAggregationService {
	private readonly STCG_EQUITY_RATE = 0.2; // 20% (Budget 2024)
	private readonly LTCG_EQUITY_RATE = 0.125; // 12.5% (Budget 2024)
	private readonly STCG_DEBT_RATE = 0.3; // Slab rate (assumed 30%)
	private readonly LTCG_DEBT_RATE = 0.2; // 20% with indexation (pre-Apr 2023)

	private readonly QUARTERLY_SCHEDULE = [
		{ quarter: "Q1", dueDate: "06-15", percentage: 0.15 },
		{ quarter: "Q2", dueDate: "09-15", percentage: 0.45 },
		{ quarter: "Q3", dueDate: "12-15", percentage: 0.75 },
		{ quarter: "Q4", dueDate: "03-15", percentage: 1.0 },
	];

	getCurrentFiscalYear(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth() + 1;

		if (month >= 4) {
			return `${year}-${(year + 1).toString().slice(-2)}`;
		}
		return `${year - 1}-${year.toString().slice(-2)}`;
	}

	getFiscalYearDates(fiscalYear: string): { start: Date; end: Date } {
		const [startYear] = fiscalYear.split("-").map(Number);
		return {
			start: new Date(startYear, 3, 1), // April 1
			end: new Date(startYear + 1, 2, 31), // March 31
		};
	}

	async aggregateRealizedGains(
		userId: string,
		fiscalYear?: string,
	): Promise<FiscalYearGains> {
		const fy = fiscalYear || this.getCurrentFiscalYear();
		const { start, end } = this.getFiscalYearDates(fy);

		const settledSellOrders = await db
			.select()
			.from(mfOrders)
			.where(
				and(
					eq(mfOrders.userId, userId),
					inArray(mfOrders.orderType, ["sell", "redeem", "switch"]),
					eq(mfOrders.status, "settled"),
					gte(mfOrders.settledAt, start),
					lte(mfOrders.settledAt, end),
				),
			);

		const result: FiscalYearGains = {
			fiscalYear: fy,
			userId,
			stcg: {
				equity: 0,
				debtPreApr2023: 0,
				debtPostApr2023: 0,
				others: 0,
				total: 0,
			},
			ltcg: {
				equity: 0,
				equityWithGrandfathering: 0,
				debtWithIndexation: 0,
				debtWithoutIndexation: 0,
				others: 0,
				total: 0,
			},
			totalRealizedGains: 0,
			totalTaxLiability: 0,
			trades: [],
			quarterlyBreakdown: [],
		};

		let totalTaxableSTCG = 0;
		let totalTaxableLTCG = 0;

		for (const order of settledSellOrders) {
			const realizedGain = Number.parseFloat(
				order.realizedGain?.toString() || "0",
			);
			const taxableGain = Number.parseFloat(
				order.taxableGain?.toString() || realizedGain.toString(),
			);
			const grandfatheredValue = Number.parseFloat(
				order.grandfatheredValue?.toString() || "0",
			);
			const storedTax = Number.parseFloat(
				order.estimatedTax?.toString() || "0",
			);
			const gainType = order.gainType || "STCG";

			result.totalRealizedGains += realizedGain;

			if (gainType === "STCG") {
				result.stcg.equity += realizedGain;
				result.stcg.total += realizedGain;
				totalTaxableSTCG += Math.max(0, taxableGain);
			} else if (gainType === "LTCG") {
				if (grandfatheredValue > 0) {
					result.ltcg.equityWithGrandfathering += realizedGain;
				} else {
					result.ltcg.equity += realizedGain;
				}
				result.ltcg.total += realizedGain;
				totalTaxableLTCG += Math.max(0, taxableGain);
			}

			result.trades.push({
				orderId: order.id,
				schemeName: order.schemeName,
				isin: order.isin || undefined,
				saleDate: order.settledAt?.toISOString().split("T")[0] || "",
				gainType,
				realizedGain,
				taxableGain,
				estimatedTax: storedTax,
			});
		}

		const stcgTax = totalTaxableSTCG * this.STCG_EQUITY_RATE;
		const ltcgExemption = Math.min(125000, Math.max(0, totalTaxableLTCG));
		const ltcgTaxableAfterExemption = Math.max(
			0,
			totalTaxableLTCG - ltcgExemption,
		);
		const ltcgTax = ltcgTaxableAfterExemption * this.LTCG_EQUITY_RATE;
		result.totalTaxLiability = stcgTax + ltcgTax;

		result.quarterlyBreakdown = await this.calculateQuarterlyBreakdown(
			userId,
			fy,
			result,
		);

		return result;
	}

	private async calculateQuarterlyBreakdown(
		userId: string,
		fiscalYear: string,
		gains: FiscalYearGains,
	): Promise<FiscalYearGains["quarterlyBreakdown"]> {
		const [startYear] = fiscalYear.split("-").map(Number);
		const breakdown: FiscalYearGains["quarterlyBreakdown"] = [];

		const reminders = await db
			.select()
			.from(capitalGainsTaxReminders)
			.where(
				and(
					eq(capitalGainsTaxReminders.userId, userId),
					eq(capitalGainsTaxReminders.financialYear, fiscalYear),
				),
			);

		const reminderMap = new Map(reminders.map((r) => [r.quarter, r]));

		for (const schedule of this.QUARTERLY_SCHEDULE) {
			const isQ4 = schedule.quarter === "Q4";
			const year = isQ4 ? startYear + 1 : startYear;
			const dueDate = `${year}-${schedule.dueDate}`;

			const cumulativeTaxDue = gains.totalTaxLiability * schedule.percentage;
			const previousPercentage =
				this.QUARTERLY_SCHEDULE[this.QUARTERLY_SCHEDULE.indexOf(schedule) - 1]
					?.percentage || 0;
			const quarterTaxDue =
				gains.totalTaxLiability * (schedule.percentage - previousPercentage);

			const reminder = reminderMap.get(schedule.quarter);
			const taxPaid =
				reminder?.status === "paid"
					? Number.parseFloat(reminder.totalTaxLiability?.toString() || "0")
					: 0;

			breakdown.push({
				quarter: schedule.quarter,
				dueDate,
				cumulativePercentage: schedule.percentage * 100,
				stcg: gains.stcg.total * (schedule.percentage - previousPercentage),
				ltcg: gains.ltcg.total * (schedule.percentage - previousPercentage),
				totalGains:
					gains.totalRealizedGains * (schedule.percentage - previousPercentage),
				taxDue: quarterTaxDue,
				taxPaid,
				balance: quarterTaxDue - taxPaid,
			});
		}

		return breakdown;
	}

	async getAdvanceTaxStatus(
		userId: string,
		fiscalYear?: string,
	): Promise<AdvanceTaxStatus> {
		const fy = fiscalYear || this.getCurrentFiscalYear();
		const gains = await this.aggregateRealizedGains(userId, fy);
		const [startYear] = fy.split("-").map(Number);
		const now = new Date();

		const quarters: AdvanceTaxStatus["quarters"] = [];
		let totalPaid = 0;
		let nextDueDate: string | null = null;
		let nextDueAmount = 0;

		for (let i = 0; i < this.QUARTERLY_SCHEDULE.length; i++) {
			const schedule = this.QUARTERLY_SCHEDULE[i];
			const previousPercentage =
				i > 0 ? this.QUARTERLY_SCHEDULE[i - 1].percentage : 0;

			const isQ4 = schedule.quarter === "Q4";
			const year = isQ4 ? startYear + 1 : startYear;
			const dueDate = `${year}-${schedule.dueDate}`;
			const dueDateObj = new Date(dueDate);

			const quarterTax =
				gains.totalTaxLiability * (schedule.percentage - previousPercentage);
			const quarterData = gains.quarterlyBreakdown.find(
				(q) => q.quarter === schedule.quarter,
			);
			const paid = quarterData?.taxPaid || 0;
			totalPaid += paid;

			let status: "paid" | "partial" | "pending" | "overdue";
			if (paid >= quarterTax) {
				status = "paid";
			} else if (paid > 0) {
				status = "partial";
			} else if (now > dueDateObj) {
				status = "overdue";
			} else {
				status = "pending";
			}

			if (!nextDueDate && now <= dueDateObj && paid < quarterTax) {
				nextDueDate = dueDate;
				nextDueAmount = quarterTax - paid;
			}

			quarters.push({
				quarter: schedule.quarter,
				dueDate,
				percentageDue: (schedule.percentage - previousPercentage) * 100,
				amountDue: quarterTax,
				amountPaid: paid,
				status,
			});
		}

		return {
			fiscalYear: fy,
			userId,
			totalEstimatedTax: gains.totalTaxLiability,
			totalPaid,
			totalDue: gains.totalTaxLiability - totalPaid,
			nextDueDate,
			nextDueAmount,
			quarters,
		};
	}

	async calculateAndStoreTradeGains(orderId: string): Promise<void> {
		const [order] = await db
			.select()
			.from(mfOrders)
			.where(eq(mfOrders.id, orderId));

		if (!order || !["sell", "redeem", "switch"].includes(order.orderType)) {
			return;
		}

		const purchaseDate = order.purchaseDate
			? new Date(order.purchaseDate)
			: null;
		const saleDate = order.settledAt || new Date();

		if (!purchaseDate) {
			console.warn(
				`[RealizedGains] No purchase date for order ${orderId}, using today`,
			);
		}

		const actualPurchaseDate = purchaseDate || new Date();
		const holdingPeriodDays = Math.floor(
			(saleDate.getTime() - actualPurchaseDate.getTime()) /
				(1000 * 60 * 60 * 24),
		);

		const purchaseValue = Number.parseFloat(
			order.purchaseValue?.toString() || "0",
		);
		const saleValue = Number.parseFloat(
			order.payoutAmount?.toString() || order.amount?.toString() || "0",
		);
		const realizedGain = saleValue - purchaseValue;

		const isLTCG = holdingPeriodDays >= 365;
		const gainType = isLTCG ? "LTCG" : "STCG";

		let taxableGain = realizedGain;
		let grandfatheredValue = 0;
		const indexedCost = 0;

		if (isLTCG && actualPurchaseDate < new Date("2018-02-01")) {
			const jan312018Nav = await this.getJan312018Nav(
				order.isin || order.schemeCode,
			);
			if (jan312018Nav) {
				const units = Number.parseFloat(order.units?.toString() || "0");
				grandfatheredValue = units * jan312018Nav;
				const adjustedCostBasis = Math.max(purchaseValue, grandfatheredValue);
				taxableGain = Math.max(0, saleValue - adjustedCostBasis);
			}
		}

		const taxRate = isLTCG ? this.LTCG_EQUITY_RATE : this.STCG_EQUITY_RATE;

		const exemption = isLTCG ? Math.min(125000, taxableGain) : 0;
		const taxableAfterExemption = Math.max(0, taxableGain - exemption);
		const estimatedTax = taxableAfterExemption * taxRate;

		const fiscalYear = this.getCurrentFiscalYear();

		await db
			.update(mfOrders)
			.set({
				purchaseDate: actualPurchaseDate.toISOString().split("T")[0],
				purchaseValue: purchaseValue.toString(),
				saleValue: saleValue.toString(),
				realizedGain: realizedGain.toString(),
				gainType,
				holdingPeriodDays,
				grandfatheredValue:
					grandfatheredValue > 0 ? grandfatheredValue.toString() : null,
				indexedCost: indexedCost > 0 ? indexedCost.toString() : null,
				taxableGain: taxableGain.toString(),
				estimatedTax: estimatedTax.toString(),
				fiscalYear,
				updatedAt: new Date(),
			})
			.where(eq(mfOrders.id, orderId));

		console.log(
			`[RealizedGains] Calculated gains for order ${orderId}: ${gainType} gain of ₹${realizedGain.toFixed(2)}, tax ₹${estimatedTax.toFixed(2)}`,
		);
	}

	private async getJan312018Nav(
		isinOrSchemeCode: string,
	): Promise<number | null> {
		try {
			const result = await proposalCapitalGainsService.getHistoricalNAV(
				isinOrSchemeCode,
				new Date("2018-01-31"),
			);
			return result?.nav || null;
		} catch (error) {
			console.warn(
				`[RealizedGains] Could not fetch Jan 31, 2018 NAV for ${isinOrSchemeCode}`,
			);
			return null;
		}
	}

	async recalculateUserReminders(userId: string): Promise<void> {
		const gains = await this.aggregateRealizedGains(userId);
		const fy = this.getCurrentFiscalYear();
		const [startYear] = fy.split("-").map(Number);

		for (let i = 0; i < this.QUARTERLY_SCHEDULE.length; i++) {
			const schedule = this.QUARTERLY_SCHEDULE[i];
			const previousPercentage =
				i > 0 ? this.QUARTERLY_SCHEDULE[i - 1].percentage : 0;

			const isQ4 = schedule.quarter === "Q4";
			const year = isQ4 ? startYear + 1 : startYear;
			const dueDate = `${year}-${schedule.dueDate}`;

			const stcg = gains.stcg.total * schedule.percentage;
			const ltcg = gains.ltcg.total * schedule.percentage;
			const totalTax = gains.totalTaxLiability * schedule.percentage;

			const existing = await db
				.select()
				.from(capitalGainsTaxReminders)
				.where(
					and(
						eq(capitalGainsTaxReminders.userId, userId),
						eq(capitalGainsTaxReminders.financialYear, fy),
						eq(capitalGainsTaxReminders.quarter, schedule.quarter),
					),
				);

			if (existing.length > 0) {
				await db
					.update(capitalGainsTaxReminders)
					.set({
						estimatedSTCG: stcg.toString(),
						estimatedLTCG: ltcg.toString(),
						totalTaxLiability: totalTax.toString(),
						updatedAt: new Date(),
					})
					.where(eq(capitalGainsTaxReminders.id, existing[0].id));
			} else {
				await db.insert(capitalGainsTaxReminders).values({
					userId,
					financialYear: fy,
					quarter: schedule.quarter,
					dueDate,
					estimatedSTCG: stcg.toString(),
					estimatedLTCG: ltcg.toString(),
					totalTaxLiability: totalTax.toString(),
					status: "pending",
				});
			}
		}

		console.log(
			`[RealizedGains] Updated advance tax reminders for user ${userId}, FY ${fy}`,
		);
	}
}

export const realizedGainsAggregationService =
	new RealizedGainsAggregationService();
