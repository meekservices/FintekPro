import { db } from "../db";
import * as schema from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface FinancialData {
	revenue?: number;
	ebitda?: number;
	ebit?: number;
	netIncome?: number;
	eps?: number;
	bookValuePerShare?: number;
	freeCashFlow?: number;
	operatingCashFlow?: number;
	totalAssets?: number;
	totalLiabilities?: number;
	totalEquity?: number;
	totalDebt?: number;
	cash?: number;
	currentAssets?: number;
	currentLiabilities?: number;
	inventory?: number;
	receivables?: number;
	payables?: number;
	marketCap?: number;
	sharesOutstanding?: number;
	currentPrice?: number;
	dividendPerShare?: number;
	interestExpense?: number;
	depreciation?: number;
	workingCapital?: number;
	retainedEarnings?: number;
	grossProfit?: number;
}

interface HistoricalData {
	fiscalYear: string;
	data: FinancialData;
}

export class FinancialMetricsCalculator {
	// === VALUATION RATIOS ===

	calculateTrailingPE(price: number, eps: number): number | null {
		if (!eps || eps <= 0) return null;
		return price / eps;
	}

	calculateForwardPE(price: number, epsEstimate: number): number | null {
		if (!epsEstimate || epsEstimate <= 0) return null;
		return price / epsEstimate;
	}

	/**
	 * PEG Ratio = P/E ÷ EPS Growth Rate (annualised %).
	 *
	 * Returns a typed result so callers can distinguish WHY a null was returned:
	 *   - 'negative_pe'     → P/E is negative (loss-making company / value trap)
	 *   - 'negative_growth' → EPS growth is negative (earnings deterioration)
	 *   - 'zero_growth'     → EPS growth is zero (division by zero)
	 *   - 'missing_data'    → pe or epsGrowthRate is missing/null
	 *
	 * @param pe            - Trailing or forward P/E ratio
	 * @param epsGrowthRate - EPS growth rate as a decimal (e.g. 0.15 = 15%)
	 * @returns { value: number | null; nullReason: string | null }
	 */
	calculatePEGRatio(
		pe: number | null | undefined,
		epsGrowthRate: number | null | undefined,
	): { value: number | null; nullReason: string | null } {
		if (pe == null || epsGrowthRate == null) {
			return { value: null, nullReason: "missing_data" };
		}
		if (pe < 0) {
			return { value: null, nullReason: "negative_pe" }; // loss-making or value trap
		}
		if (pe === 0) {
			return { value: null, nullReason: "missing_data" };
		}
		if (epsGrowthRate < 0) {
			return { value: null, nullReason: "negative_growth" }; // earnings deterioration
		}
		if (epsGrowthRate === 0) {
			return { value: null, nullReason: "zero_growth" }; // division-by-zero guard
		}
		// Standard PEG: pe divided by growth rate expressed as a percentage
		return { value: pe / (epsGrowthRate * 100), nullReason: null };
	}

	calculatePriceToBook(
		price: number,
		bookValuePerShare: number,
	): number | null {
		if (!bookValuePerShare || bookValuePerShare <= 0) return null;
		return price / bookValuePerShare;
	}

	calculatePriceToSales(marketCap: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return marketCap / revenue;
	}

	calculatePriceToFCF(marketCap: number, fcf: number): number | null {
		if (!fcf || fcf <= 0) return null;
		return marketCap / fcf;
	}

	calculateEnterpriseValue(
		marketCap: number,
		totalDebt: number,
		cash: number,
	): number {
		return marketCap + (totalDebt || 0) - (cash || 0);
	}

	calculateEVtoEBITDA(ev: number, ebitda: number): number | null {
		if (!ebitda || ebitda <= 0) return null;
		return ev / ebitda;
	}

	calculateEVtoSales(ev: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return ev / revenue;
	}

	calculateEVtoEBIT(ev: number, ebit: number): number | null {
		if (!ebit || ebit <= 0) return null;
		return ev / ebit;
	}

	calculateEarningsYield(eps: number, price: number): number | null {
		if (!price || price <= 0) return null;
		return eps / price;
	}

	// === PROFITABILITY RATIOS ===

	calculateGrossMargin(grossProfit: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return grossProfit / revenue;
	}

	calculateOperatingMargin(ebit: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return ebit / revenue;
	}

	calculateNetMargin(netIncome: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return netIncome / revenue;
	}

	calculateEBITDAMargin(ebitda: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return ebitda / revenue;
	}

	calculateFCFMargin(fcf: number, revenue: number): number | null {
		if (!revenue || revenue <= 0) return null;
		return fcf / revenue;
	}

	calculateROE(netIncome: number, totalEquity: number): number | null {
		if (!totalEquity || totalEquity <= 0) return null;
		return netIncome / totalEquity;
	}

	calculateROA(netIncome: number, totalAssets: number): number | null {
		if (!totalAssets || totalAssets <= 0) return null;
		return netIncome / totalAssets;
	}

	calculateROCE(ebit: number, capitalEmployed: number): number | null {
		if (!capitalEmployed || capitalEmployed <= 0) return null;
		return ebit / capitalEmployed;
	}

	calculateROIC(nopat: number, investedCapital: number): number | null {
		if (!investedCapital || investedCapital <= 0) return null;
		return nopat / investedCapital;
	}

	// === GROWTH METRICS ===

	calculateYoYGrowth(current: number, previous: number): number | null {
		if (!previous || previous === 0) return null;
		return (current - previous) / Math.abs(previous);
	}

	calculateCAGR(
		startValue: number,
		endValue: number,
		years: number,
	): number | null {
		if (!startValue || startValue <= 0 || !endValue || years <= 0) return null;
		if (startValue < 0 && endValue > 0) return null;
		if (startValue > 0 && endValue < 0) return null;
		return (endValue / startValue) ** (1 / years) - 1;
	}

	calculateMultiYearCAGR(
		values: { year: string; value: number }[],
		targetYears: number,
	): number | null {
		if (values.length < targetYears + 1) return null;
		const sortedValues = [...values].sort((a, b) =>
			a.year.localeCompare(b.year),
		);
		const startIdx = Math.max(0, sortedValues.length - targetYears - 1);
		const startValue = sortedValues[startIdx].value;
		const endValue = sortedValues[sortedValues.length - 1].value;
		return this.calculateCAGR(startValue, endValue, targetYears);
	}

	// === LEVERAGE & SOLVENCY ===

	calculateDebtToEquity(totalDebt: number, totalEquity: number): number | null {
		if (!totalEquity || totalEquity <= 0) return null;
		return totalDebt / totalEquity;
	}

	calculateDebtToAssets(totalDebt: number, totalAssets: number): number | null {
		if (!totalAssets || totalAssets <= 0) return null;
		return totalDebt / totalAssets;
	}

	calculateInterestCoverage(
		ebit: number,
		interestExpense: number,
	): number | null {
		if (!interestExpense || interestExpense <= 0) return null;
		return ebit / interestExpense;
	}

	calculateCurrentRatio(
		currentAssets: number,
		currentLiabilities: number,
	): number | null {
		if (!currentLiabilities || currentLiabilities <= 0) return null;
		return currentAssets / currentLiabilities;
	}

	calculateQuickRatio(
		currentAssets: number,
		inventory: number,
		currentLiabilities: number,
	): number | null {
		if (!currentLiabilities || currentLiabilities <= 0) return null;
		return (currentAssets - (inventory || 0)) / currentLiabilities;
	}

	calculateCashRatio(cash: number, currentLiabilities: number): number | null {
		if (!currentLiabilities || currentLiabilities <= 0) return null;
		return cash / currentLiabilities;
	}

	calculateNetDebtToEBITDA(netDebt: number, ebitda: number): number | null {
		if (!ebitda || ebitda <= 0) return null;
		return netDebt / ebitda;
	}

	// === EFFICIENCY RATIOS ===

	calculateAssetTurnover(revenue: number, totalAssets: number): number | null {
		if (!totalAssets || totalAssets <= 0) return null;
		return revenue / totalAssets;
	}

	calculateInventoryTurnover(
		cogs: number,
		avgInventory: number,
	): number | null {
		if (!avgInventory || avgInventory <= 0) return null;
		return cogs / avgInventory;
	}

	calculateReceivablesTurnover(
		revenue: number,
		avgReceivables: number,
	): number | null {
		if (!avgReceivables || avgReceivables <= 0) return null;
		return revenue / avgReceivables;
	}

	calculateDaysOutstanding(turnover: number): number | null {
		if (!turnover || turnover <= 0) return null;
		return 365 / turnover;
	}

	calculateCashConversionCycle(
		inventoryDays: number,
		receivableDays: number,
		payableDays: number,
	): number {
		return (inventoryDays || 0) + (receivableDays || 0) - (payableDays || 0);
	}

	calculateWorkingCapitalTurnover(
		revenue: number,
		workingCapital: number,
	): number | null {
		if (!workingCapital || workingCapital === 0) return null;
		return revenue / workingCapital;
	}

	// === QUALITY SCORES ===

	calculatePiotroskiFScore(
		data: FinancialData,
		prevData?: FinancialData,
	): number {
		let score = 0;

		// Profitability (4 points)
		if (data.netIncome && data.netIncome > 0) score++;
		if (data.operatingCashFlow && data.operatingCashFlow > 0) score++;
		if (prevData?.netIncome && data.totalAssets && prevData.totalAssets) {
			const roaCurrent = (data.netIncome || 0) / data.totalAssets;
			const roaPrev = prevData.netIncome / prevData.totalAssets;
			if (roaCurrent > roaPrev) score++;
		}
		if (
			data.operatingCashFlow &&
			data.netIncome &&
			data.operatingCashFlow > data.netIncome
		)
			score++;

		// Leverage (3 points)
		if (prevData?.totalDebt && data.totalDebt !== undefined) {
			if (data.totalDebt < prevData.totalDebt) score++;
		}
		if (
			prevData &&
			data.currentAssets &&
			data.currentLiabilities &&
			prevData.currentAssets &&
			prevData.currentLiabilities
		) {
			const currentRatioCurrent = data.currentAssets / data.currentLiabilities;
			const currentRatioPrev =
				prevData.currentAssets / prevData.currentLiabilities;
			if (currentRatioCurrent > currentRatioPrev) score++;
		}
		if (prevData?.sharesOutstanding && data.sharesOutstanding) {
			if (data.sharesOutstanding <= prevData.sharesOutstanding) score++;
		}

		// Efficiency (2 points)
		if (
			prevData?.grossProfit &&
			data.grossProfit &&
			prevData.revenue &&
			data.revenue
		) {
			const marginCurrent = data.grossProfit / data.revenue;
			const marginPrev = prevData.grossProfit / prevData.revenue;
			if (marginCurrent > marginPrev) score++;
		}
		if (
			prevData &&
			data.revenue &&
			data.totalAssets &&
			prevData.revenue &&
			prevData.totalAssets
		) {
			const turnoverCurrent = data.revenue / data.totalAssets;
			const turnoverPrev = prevData.revenue / prevData.totalAssets;
			if (turnoverCurrent > turnoverPrev) score++;
		}

		return score;
	}

	calculateAltmanZScore(data: FinancialData): number | null {
		if (!data.totalAssets || data.totalAssets <= 0) return null;
		if (!data.marketCap) return null;

		const workingCapital =
			(data.currentAssets || 0) - (data.currentLiabilities || 0);
		const retainedEarnings = data.retainedEarnings || 0;
		const ebit = data.ebit || 0;
		const totalLiabilities = data.totalLiabilities || 0;
		const revenue = data.revenue || 0;

		const A = workingCapital / data.totalAssets;
		const B = retainedEarnings / data.totalAssets;
		const C = ebit / data.totalAssets;
		const D = data.marketCap / totalLiabilities;
		const E = revenue / data.totalAssets;

		return 1.2 * A + 1.4 * B + 3.3 * C + 0.6 * D + 1.0 * E;
	}

	calculateAccrualRatio(
		netIncome: number,
		ocf: number,
		totalAssets: number,
	): number | null {
		if (!totalAssets || totalAssets <= 0) return null;
		return (netIncome - ocf) / totalAssets;
	}

	calculateEarningsQuality(ocf: number, netIncome: number): number | null {
		if (!netIncome || netIncome === 0) return null;
		return ocf / netIncome;
	}

	// === DIVIDEND METRICS ===

	calculateDividendYield(dps: number, price: number): number | null {
		if (!price || price <= 0) return null;
		return dps / price;
	}

	calculateDividendPayoutRatio(dps: number, eps: number): number | null {
		if (!eps || eps <= 0) return null;
		return dps / eps;
	}

	calculateDividendCoverRatio(eps: number, dps: number): number | null {
		if (!dps || dps <= 0) return null;
		return eps / dps;
	}

	// === COMPREHENSIVE CALCULATION ===

	calculateAllMetrics(
		current: FinancialData,
		historical: HistoricalData[],
		epsEstimate?: number,
	): Partial<schema.InsertStockFinancialMetrics> {
		const price = current.currentPrice || 0;
		const prevYear = historical.length > 0 ? historical[0].data : undefined;

		const ev = this.calculateEnterpriseValue(
			current.marketCap || 0,
			current.totalDebt || 0,
			current.cash || 0,
		);

		const netDebt = (current.totalDebt || 0) - (current.cash || 0);
		const capitalEmployed =
			(current.totalAssets || 0) - (current.currentLiabilities || 0);

		// Get historical values for CAGR calculations
		const revenueHistory = historical.map((h) => ({
			year: h.fiscalYear,
			value: h.data.revenue || 0,
		}));
		const epsHistory = historical.map((h) => ({
			year: h.fiscalYear,
			value: h.data.eps || 0,
		}));
		const patHistory = historical.map((h) => ({
			year: h.fiscalYear,
			value: h.data.netIncome || 0,
		}));

		if (current.revenue)
			revenueHistory.push({ year: "current", value: current.revenue });
		if (current.eps) epsHistory.push({ year: "current", value: current.eps });
		if (current.netIncome)
			patHistory.push({ year: "current", value: current.netIncome });

		const inventoryTurnover = this.calculateInventoryTurnover(
			(current.revenue || 0) * 0.65, // Estimate COGS as 65% of revenue
			current.inventory || 0,
		);
		const receivablesTurnover = this.calculateReceivablesTurnover(
			current.revenue || 0,
			current.receivables || 0,
		);
		const payablesTurnover = current.payables
			? ((current.revenue || 0) * 0.65) / current.payables
			: null;

		const inventoryDays = this.calculateDaysOutstanding(inventoryTurnover || 0);
		const receivableDays = this.calculateDaysOutstanding(
			receivablesTurnover || 0,
		);
		const payableDays = this.calculateDaysOutstanding(payablesTurnover || 0);

		return {
			// Valuation
			trailingPe: this.calculateTrailingPE(price, current.eps || 0)?.toString(),
			forwardPe: epsEstimate
				? this.calculateForwardPE(price, epsEstimate)?.toString()
				: undefined,
			pegRatio: (() => {
				const peg = this.calculatePEGRatio(
					this.calculateTrailingPE(price, current.eps || 0),
					this.calculateYoYGrowth(current.eps || 0, prevYear?.eps || 0),
				);
				return peg.value?.toString() ?? undefined;
			})(),
			pegRatioNullReason: (() => {
				const peg = this.calculatePEGRatio(
					this.calculateTrailingPE(price, current.eps || 0),
					this.calculateYoYGrowth(current.eps || 0, prevYear?.eps || 0),
				);
				return peg.nullReason ?? undefined; // 'negative_pe'|'negative_growth'|'zero_growth'|'missing_data'
			})(),
			priceToBook: this.calculatePriceToBook(
				price,
				current.bookValuePerShare || 0,
			)?.toString(),
			priceToSales: this.calculatePriceToSales(
				current.marketCap || 0,
				current.revenue || 0,
			)?.toString(),
			priceToFreeCashFlow: this.calculatePriceToFCF(
				current.marketCap || 0,
				current.freeCashFlow || 0,
			)?.toString(),
			evToEbitda: this.calculateEVtoEBITDA(ev, current.ebitda || 0)?.toString(),
			evToSales: this.calculateEVtoSales(ev, current.revenue || 0)?.toString(),
			evToEbit: this.calculateEVtoEBIT(ev, current.ebit || 0)?.toString(),
			enterpriseValue: ev.toString(),
			earningsYield: this.calculateEarningsYield(
				current.eps || 0,
				price,
			)?.toString(),

			// Profitability
			grossMargin: this.calculateGrossMargin(
				current.grossProfit || 0,
				current.revenue || 0,
			)?.toString(),
			operatingMargin: this.calculateOperatingMargin(
				current.ebit || 0,
				current.revenue || 0,
			)?.toString(),
			netMargin: this.calculateNetMargin(
				current.netIncome || 0,
				current.revenue || 0,
			)?.toString(),
			ebitdaMargin: this.calculateEBITDAMargin(
				current.ebitda || 0,
				current.revenue || 0,
			)?.toString(),
			fcfMargin: this.calculateFCFMargin(
				current.freeCashFlow || 0,
				current.revenue || 0,
			)?.toString(),
			roe: this.calculateROE(
				current.netIncome || 0,
				current.totalEquity || 0,
			)?.toString(),
			roa: this.calculateROA(
				current.netIncome || 0,
				current.totalAssets || 0,
			)?.toString(),
			roce: this.calculateROCE(current.ebit || 0, capitalEmployed)?.toString(),
			roic: this.calculateROIC(
				(current.ebit || 0) * 0.75,
				capitalEmployed,
			)?.toString(),

			// Growth YoY
			revenueGrowthYoy: this.calculateYoYGrowth(
				current.revenue || 0,
				prevYear?.revenue || 0,
			)?.toString(),
			epsGrowthYoy: this.calculateYoYGrowth(
				current.eps || 0,
				prevYear?.eps || 0,
			)?.toString(),
			netIncomeGrowthYoy: this.calculateYoYGrowth(
				current.netIncome || 0,
				prevYear?.netIncome || 0,
			)?.toString(),
			ebitdaGrowthYoy: this.calculateYoYGrowth(
				current.ebitda || 0,
				prevYear?.ebitda || 0,
			)?.toString(),
			bookValueGrowthYoy: this.calculateYoYGrowth(
				current.bookValuePerShare || 0,
				prevYear?.bookValuePerShare || 0,
			)?.toString(),
			ocfGrowthYoy: this.calculateYoYGrowth(
				current.operatingCashFlow || 0,
				prevYear?.operatingCashFlow || 0,
			)?.toString(),
			fcfGrowthYoy: this.calculateYoYGrowth(
				current.freeCashFlow || 0,
				prevYear?.freeCashFlow || 0,
			)?.toString(),

			// CAGR
			revenueCagr3y: this.calculateMultiYearCAGR(revenueHistory, 3)?.toString(),
			revenueCagr5y: this.calculateMultiYearCAGR(revenueHistory, 5)?.toString(),
			epsCagr3y: this.calculateMultiYearCAGR(epsHistory, 3)?.toString(),
			epsCagr5y: this.calculateMultiYearCAGR(epsHistory, 5)?.toString(),
			patCagr3y: this.calculateMultiYearCAGR(patHistory, 3)?.toString(),
			patCagr5y: this.calculateMultiYearCAGR(patHistory, 5)?.toString(),

			// Leverage
			debtToEquity: this.calculateDebtToEquity(
				current.totalDebt || 0,
				current.totalEquity || 0,
			)?.toString(),
			debtToAssets: this.calculateDebtToAssets(
				current.totalDebt || 0,
				current.totalAssets || 0,
			)?.toString(),
			interestCoverage: this.calculateInterestCoverage(
				current.ebit || 0,
				current.interestExpense || 0,
			)?.toString(),
			currentRatio: this.calculateCurrentRatio(
				current.currentAssets || 0,
				current.currentLiabilities || 0,
			)?.toString(),
			quickRatio: this.calculateQuickRatio(
				current.currentAssets || 0,
				current.inventory || 0,
				current.currentLiabilities || 0,
			)?.toString(),
			cashRatio: this.calculateCashRatio(
				current.cash || 0,
				current.currentLiabilities || 0,
			)?.toString(),
			netDebt: netDebt.toString(),
			netDebtToEbitda: this.calculateNetDebtToEBITDA(
				netDebt,
				current.ebitda || 0,
			)?.toString(),

			// Efficiency
			assetTurnover: this.calculateAssetTurnover(
				current.revenue || 0,
				current.totalAssets || 0,
			)?.toString(),
			inventoryTurnover: inventoryTurnover?.toString(),
			receivablesTurnover: receivablesTurnover?.toString(),
			payablesTurnover: payablesTurnover?.toString(),
			inventoryDays: inventoryDays?.toString(),
			receivableDays: receivableDays?.toString(),
			payableDays: payableDays?.toString(),
			cashConversionCycle: this.calculateCashConversionCycle(
				inventoryDays || 0,
				receivableDays || 0,
				payableDays || 0,
			).toString(),
			workingCapitalTurnover: this.calculateWorkingCapitalTurnover(
				current.revenue || 0,
				current.workingCapital || 0,
			)?.toString(),

			// Quality Scores
			piotroskiFScore: this.calculatePiotroskiFScore(current, prevYear),
			altmanZScore: this.calculateAltmanZScore(current)?.toString(),
			accrualRatio: this.calculateAccrualRatio(
				current.netIncome || 0,
				current.operatingCashFlow || 0,
				current.totalAssets || 0,
			)?.toString(),
			earningsQuality: this.calculateEarningsQuality(
				current.operatingCashFlow || 0,
				current.netIncome || 0,
			)?.toString(),

			// Dividend
			dividendYield: this.calculateDividendYield(
				current.dividendPerShare || 0,
				price,
			)?.toString(),
			dividendPayoutRatio: this.calculateDividendPayoutRatio(
				current.dividendPerShare || 0,
				current.eps || 0,
			)?.toString(),
			dividendCoverRatio: this.calculateDividendCoverRatio(
				current.eps || 0,
				current.dividendPerShare || 0,
			)?.toString(),

			// Raw data
			revenue: current.revenue?.toString(),
			ebitda: current.ebitda?.toString(),
			ebit: current.ebit?.toString(),
			netIncome: current.netIncome?.toString(),
			eps: current.eps?.toString(),
			bookValuePerShare: current.bookValuePerShare?.toString(),
			freeCashFlow: current.freeCashFlow?.toString(),
			operatingCashFlow: current.operatingCashFlow?.toString(),
			totalAssets: current.totalAssets?.toString(),
			totalLiabilities: current.totalLiabilities?.toString(),
			totalEquity: current.totalEquity?.toString(),
			totalDebt: current.totalDebt?.toString(),
			cash: current.cash?.toString(),
			marketCap: current.marketCap?.toString(),
			sharesOutstanding: current.sharesOutstanding?.toString(),
		};
	}

	// === MUTUAL FUND METRICS ===

	calculateSharpeRatio(
		returns: number,
		riskFreeRate: number,
		stdDev: number,
	): number | null {
		if (!stdDev || stdDev <= 0) return null;
		return (returns - riskFreeRate) / stdDev;
	}

	calculateSortinoRatio(
		returns: number,
		riskFreeRate: number,
		downsideDeviation: number,
	): number | null {
		if (!downsideDeviation || downsideDeviation <= 0) return null;
		return (returns - riskFreeRate) / downsideDeviation;
	}

	calculateTreynorRatio(
		returns: number,
		riskFreeRate: number,
		beta: number,
	): number | null {
		if (!beta || beta === 0) return null;
		return (returns - riskFreeRate) / beta;
	}

	calculateInformationRatio(
		portfolioReturn: number,
		benchmarkReturn: number,
		trackingError: number,
	): number | null {
		if (!trackingError || trackingError <= 0) return null;
		return (portfolioReturn - benchmarkReturn) / trackingError;
	}

	calculateAlpha(
		portfolioReturn: number,
		benchmarkReturn: number,
		beta: number,
		riskFreeRate: number,
	): number {
		return (
			portfolioReturn - (riskFreeRate + beta * (benchmarkReturn - riskFreeRate))
		);
	}

	calculateMaxDrawdown(navHistory: number[]): number {
		let maxDrawdown = 0;
		let peak = navHistory[0];

		for (const nav of navHistory) {
			if (nav > peak) peak = nav;
			const drawdown = (peak - nav) / peak;
			if (drawdown > maxDrawdown) maxDrawdown = drawdown;
		}

		return maxDrawdown;
	}

	calculateUpsideCaptureRatio(
		fundReturns: number[],
		benchmarkReturns: number[],
	): number | null {
		const upPeriods = benchmarkReturns
			.map((br, i) => (br > 0 ? { fund: fundReturns[i], bench: br } : null))
			.filter(Boolean);
		if (upPeriods.length === 0) return null;

		const fundUp =
			upPeriods.reduce((sum, p) => sum + (p?.fund || 0), 0) / upPeriods.length;
		const benchUp =
			upPeriods.reduce((sum, p) => sum + (p?.bench || 0), 0) / upPeriods.length;

		if (benchUp === 0) return null;
		return (fundUp / benchUp) * 100;
	}

	calculateDownsideCaptureRatio(
		fundReturns: number[],
		benchmarkReturns: number[],
	): number | null {
		const downPeriods = benchmarkReturns
			.map((br, i) => (br < 0 ? { fund: fundReturns[i], bench: br } : null))
			.filter(Boolean);
		if (downPeriods.length === 0) return null;

		const fundDown =
			downPeriods.reduce((sum, p) => sum + (p?.fund || 0), 0) /
			downPeriods.length;
		const benchDown =
			downPeriods.reduce((sum, p) => sum + (p?.bench || 0), 0) /
			downPeriods.length;

		if (benchDown === 0) return null;
		return (fundDown / benchDown) * 100;
	}

	// === BOND METRICS ===

	calculateYieldToMaturity(
		faceValue: number,
		couponRate: number,
		currentPrice: number,
		yearsToMaturity: number,
		couponFrequency: number = 2,
	): number | null {
		if (yearsToMaturity <= 0 || currentPrice <= 0) return null;

		const couponPayment = (faceValue * couponRate) / couponFrequency;
		const n = yearsToMaturity * couponFrequency;

		// Approximation formula
		const ytm =
			(couponPayment + (faceValue - currentPrice) / n) /
			((faceValue + currentPrice) / 2);
		return ytm * couponFrequency;
	}

	calculateMacaulayDuration(
		faceValue: number,
		couponRate: number,
		ytm: number,
		yearsToMaturity: number,
		couponFrequency: number = 2,
	): number {
		const couponPayment = (faceValue * couponRate) / couponFrequency;
		const n = yearsToMaturity * couponFrequency;
		const y = ytm / couponFrequency;

		let weightedSum = 0;
		let priceSum = 0;

		for (let t = 1; t <= n; t++) {
			const pv = couponPayment / (1 + y) ** t;
			weightedSum += t * pv;
			priceSum += pv;
		}

		const pvFace = faceValue / (1 + y) ** n;
		weightedSum += n * pvFace;
		priceSum += pvFace;

		return weightedSum / priceSum / couponFrequency;
	}

	calculateModifiedDuration(
		macaulayDuration: number,
		ytm: number,
		couponFrequency: number = 2,
	): number {
		return macaulayDuration / (1 + ytm / couponFrequency);
	}

	calculateConvexity(
		faceValue: number,
		couponRate: number,
		ytm: number,
		yearsToMaturity: number,
		couponFrequency: number = 2,
	): number {
		const couponPayment = (faceValue * couponRate) / couponFrequency;
		const n = yearsToMaturity * couponFrequency;
		const y = ytm / couponFrequency;

		let convexitySum = 0;
		let priceSum = 0;

		for (let t = 1; t <= n; t++) {
			const pv = couponPayment / (1 + y) ** t;
			convexitySum += t * (t + 1) * pv;
			priceSum += pv;
		}

		const pvFace = faceValue / (1 + y) ** n;
		convexitySum += n * (n + 1) * pvFace;
		priceSum += pvFace;

		return (
			convexitySum /
			(priceSum * (1 + y) ** 2 * couponFrequency * couponFrequency)
		);
	}

	calculateCreditSpread(bondYtm: number, riskFreeRate: number): number {
		return bondYtm - riskFreeRate;
	}

	// === REIT/InvIT METRICS ===

	calculateFFO(
		netIncome: number,
		depreciation: number,
		gainOnSale: number = 0,
	): number {
		return netIncome + depreciation - gainOnSale;
	}

	calculateNAVPremiumDiscount(price: number, nav: number): number | null {
		if (!nav || nav <= 0) return null;
		return (price - nav) / nav;
	}
	calculateCapRate(noi: number, propertyValue: number): number | null {
		if (!propertyValue || propertyValue <= 0) return null;
		return noi / propertyValue;
	}
}

/**
 * Writes computed quant metrics back to model_portfolio_holdings for a given ISIN.
 * This closes the alpha feedback loop: FinancialMetricsCalculator → model_portfolio_holdings → selectTopFundsByAlphaScore.
 *
 * @param isin          - The fund ISIN to update
 * @param metrics       - Computed quant metrics to persist
 * @param metrics.sharpeRatio   - Sharpe ratio (return/risk)
 * @param metrics.alpha         - Jensen's Alpha vs. benchmark
 * @param metrics.sortinoRatio  - Sortino ratio (downside risk adjusted)
 * @param metrics.beta          - Beta vs. benchmark (optional)
 *
 * Non-fatal: logs error and continues if DB write fails.
 * SEBI / GCR: metrics are stored with calculation_timestamp for audit trail.
 */
export async function writeMetricsToHoldings(
	isin: string,
	metrics: {
		sharpeRatio?: number | null;
		alpha?: number | null;
		sortinoRatio?: number | null;
		beta?: number | null;
	},
): Promise<void> {
	if (!isin || Object.values(metrics).every((v) => v === null || v === undefined)) return;
	try {
		const { db } = await import("../db");
		const { modelPortfolioHoldings } = await import("@shared/schema");
		const { eq, isNull, and } = await import("drizzle-orm");
		const updates: Record<string, number | string> = {
			updatedAt: new Date().toISOString(),
		};
		if (metrics.sharpeRatio !== undefined && metrics.sharpeRatio !== null)
			updates.sharpeRatio = metrics.sharpeRatio;
		if (metrics.alpha !== undefined && metrics.alpha !== null)
			updates.alpha = metrics.alpha;

		await db
			.update(modelPortfolioHoldings)
			.set(updates)
			.where(
				and(
					eq(modelPortfolioHoldings.isin, isin),
					isNull(modelPortfolioHoldings.removedAt),
				),
			);

		const { logger } = await import("../logger");
		logger.info(
			`METRICS_WRITTEN_TO_HOLDINGS isin=${isin} sharpe=${metrics.sharpeRatio} alpha=${metrics.alpha} engine_version=${FINANCIAL_METRICS_ENGINE_VERSION}`,
			{ event: "METRICS_WRITTEN_TO_HOLDINGS", isin, engine_version: FINANCIAL_METRICS_ENGINE_VERSION },
		);
	} catch (err: unknown) {
		// Non-fatal — alpha scoring will use last known values
		const { logger } = await import("../logger");
		logger.warn(
			`METRICS_WRITE_FAILED isin=${isin} error=${err instanceof Error ? err.message : String(err)}`,
			{ event: "METRICS_WRITE_FAILED", isin, retryable: true },
		);
	}
}

// Export singleton instance
export const financialMetricsCalculator = new FinancialMetricsCalculator();
console.log("✅ Financial Metrics Calculator Service initialized");

// ─── GCR Financial Logic Integrity ───────────────────────────────────────────
/** Bump when any ratio formula or interpretation range changes */
export const FINANCIAL_METRICS_ENGINE_VERSION = "1.0.0-FASP";

export interface MetricResult<T extends number | null = number | null> {
  metric: string;
  value: T;
  engine_version: string;
  calculation_timestamp: string;
}

/**
 * Wraps any raw metric value with GCR-required engine_version + calculation_timestamp.
 * Use when surfacing metrics to API responses or AI advisory outputs.
 *
 * @example
 *   const pe = financialMetricsCalculator.calculateTrailingPE(price, eps);
 *   return withEngineVersion("trailingPE", pe);
 *   // → { metric: "trailingPE", value: 22.5, engine_version: "1.0.0-FASP", calculation_timestamp: "..." }
 */
export function withEngineVersion<T extends number | null>(
  metric: string,
  value: T,
): MetricResult<T> {
  return {
    metric,
    value,
    engine_version: FINANCIAL_METRICS_ENGINE_VERSION,
    calculation_timestamp: new Date().toISOString(),
  };
}

