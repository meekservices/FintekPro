import { db } from "../db";
import {
	mutualFunds,
	mutualFundMetrics,
	mfNavHistory,
	marketIndexNav,
	marketIndices,
	mfBenchmarkMap,
} from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { mfBenchmarkMappingService } from "./mf-benchmark-mapping-service";

function getCurrentFiscalYear(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const startYear = month >= 4 ? year : year - 1;
	return `FY${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

interface AlignedTimeSeries {
	fundReturns: number[];
	benchmarkReturns: number[];
	dates: Date[];
}

interface RelativeMetrics {
	alpha: number | null;
	beta: number | null;
	treynorRatio: number | null;
	informationRatio: number | null;
	trackingError: number | null;
}

const RISK_FREE_RATE = 0.06;
const MIN_DATA_POINTS = 252;
const TRADING_DAYS_PER_YEAR = 252;
const MIN_BENCHMARK_CONFIDENCE = 0.7;

class MfRelativeMetricsEngine {
	private static instance: MfRelativeMetricsEngine;

	static getInstance(): MfRelativeMetricsEngine {
		if (!MfRelativeMetricsEngine.instance) {
			MfRelativeMetricsEngine.instance = new MfRelativeMetricsEngine();
		}
		return MfRelativeMetricsEngine.instance;
	}

	async alignTimeSeries(
		schemeCode: string,
		indexCode: string,
		years: number = 3,
	): Promise<AlignedTimeSeries | null> {
		const endDate = new Date();
		const startDate = new Date();
		startDate.setFullYear(startDate.getFullYear() - years);

		const startDateStr = startDate.toISOString().split("T")[0];
		const endDateStr = endDate.toISOString().split("T")[0];

		const fundNavData = await db
			.select({
				navDate: mfNavHistory.navDate,
				nav: mfNavHistory.nav,
			})
			.from(mfNavHistory)
			.where(
				and(
					eq(mfNavHistory.schemeCode, schemeCode),
					gte(mfNavHistory.navDate, startDateStr),
					lte(mfNavHistory.navDate, endDateStr),
				),
			)
			.orderBy(mfNavHistory.navDate);

		if (fundNavData.length < MIN_DATA_POINTS) {
			console.log(
				`[RelativeMetrics] Insufficient fund data for ${schemeCode}: ${fundNavData.length} points`,
			);
			return null;
		}

		const [marketIndex] = await db
			.select()
			.from(marketIndices)
			.where(eq(marketIndices.indexCode, indexCode))
			.limit(1);

		if (!marketIndex) {
			console.log(`[RelativeMetrics] Benchmark ${indexCode} not found`);
			return null;
		}

		const benchmarkNavData = await db
			.select({
				navDate: marketIndexNav.navDate,
				closeValue: marketIndexNav.closeValue,
			})
			.from(marketIndexNav)
			.where(
				and(
					eq(marketIndexNav.indexId, marketIndex.id),
					gte(marketIndexNav.navDate, startDateStr),
					lte(marketIndexNav.navDate, endDateStr),
				),
			)
			.orderBy(marketIndexNav.navDate);

		if (benchmarkNavData.length < MIN_DATA_POINTS) {
			console.log(
				`[RelativeMetrics] Insufficient benchmark data for ${indexCode}: ${benchmarkNavData.length} points`,
			);
			return null;
		}

		const benchmarkByDate = new Map<string, number>();
		for (const b of benchmarkNavData) {
			if (b.navDate && b.closeValue) {
				benchmarkByDate.set(String(b.navDate), Number.parseFloat(b.closeValue));
			}
		}

		const alignedFundNavs: number[] = [];
		const alignedBenchmarkNavs: number[] = [];
		const alignedDates: Date[] = [];

		for (const f of fundNavData) {
			if (!f.navDate || !f.nav) continue;
			const dateStr = String(f.navDate);
			const benchmarkValue = benchmarkByDate.get(dateStr);

			if (benchmarkValue !== undefined) {
				alignedFundNavs.push(Number.parseFloat(f.nav));
				alignedBenchmarkNavs.push(benchmarkValue);
				alignedDates.push(new Date(dateStr));
			}
		}

		if (alignedFundNavs.length < MIN_DATA_POINTS) {
			console.log(
				`[RelativeMetrics] Insufficient aligned data: ${alignedFundNavs.length} points`,
			);
			return null;
		}

		const fundReturns: number[] = [];
		const benchmarkReturns: number[] = [];
		const dates: Date[] = [];

		for (let i = 1; i < alignedFundNavs.length; i++) {
			const fundReturn =
				(alignedFundNavs[i] - alignedFundNavs[i - 1]) / alignedFundNavs[i - 1];
			const benchmarkReturn =
				(alignedBenchmarkNavs[i] - alignedBenchmarkNavs[i - 1]) /
				alignedBenchmarkNavs[i - 1];

			if (Number.isFinite(fundReturn) && Number.isFinite(benchmarkReturn)) {
				fundReturns.push(fundReturn);
				benchmarkReturns.push(benchmarkReturn);
				dates.push(alignedDates[i]);
			}
		}

		if (fundReturns.length < MIN_DATA_POINTS - 1) {
			console.log(
				`[RelativeMetrics] Insufficient return data: ${fundReturns.length} points`,
			);
			return null;
		}

		return { fundReturns, benchmarkReturns, dates };
	}

	calculateRelativeMetrics(alignedData: AlignedTimeSeries): RelativeMetrics {
		const { fundReturns, benchmarkReturns } = alignedData;
		const n = fundReturns.length;

		const meanFund = fundReturns.reduce((a, b) => a + b, 0) / n;
		const meanBenchmark = benchmarkReturns.reduce((a, b) => a + b, 0) / n;

		let covarianceSum = 0;
		let varianceBenchmarkSum = 0;
		let varianceFundSum = 0;

		for (let i = 0; i < n; i++) {
			const fundDev = fundReturns[i] - meanFund;
			const benchmarkDev = benchmarkReturns[i] - meanBenchmark;
			covarianceSum += fundDev * benchmarkDev;
			varianceBenchmarkSum += benchmarkDev * benchmarkDev;
			varianceFundSum += fundDev * fundDev;
		}

		const covariance = covarianceSum / (n - 1);
		const varianceBenchmark = varianceBenchmarkSum / (n - 1);
		const varianceFund = varianceFundSum / (n - 1);

		const beta = varianceBenchmark > 0 ? covariance / varianceBenchmark : null;

		const annualizedFundReturn = meanFund * TRADING_DAYS_PER_YEAR;
		const annualizedBenchmarkReturn = meanBenchmark * TRADING_DAYS_PER_YEAR;
		const dailyRiskFreeRate = RISK_FREE_RATE / TRADING_DAYS_PER_YEAR;

		let alpha: number | null = null;
		if (beta !== null) {
			const expectedReturn =
				dailyRiskFreeRate * TRADING_DAYS_PER_YEAR +
				beta * (annualizedBenchmarkReturn - RISK_FREE_RATE);
			alpha = annualizedFundReturn - expectedReturn;
		}

		let treynorRatio: number | null = null;
		if (beta !== null && beta > 0) {
			treynorRatio = (annualizedFundReturn - RISK_FREE_RATE) / beta;
		}

		const excessReturns: number[] = [];
		for (let i = 0; i < n; i++) {
			excessReturns.push(fundReturns[i] - benchmarkReturns[i]);
		}

		const meanExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / n;
		let trackingErrorSum = 0;
		for (const er of excessReturns) {
			trackingErrorSum += (er - meanExcessReturn) ** 2;
		}
		const trackingError =
			Math.sqrt(trackingErrorSum / (n - 1)) * Math.sqrt(TRADING_DAYS_PER_YEAR);

		let informationRatio: number | null = null;
		if (trackingError > 0) {
			const annualizedExcessReturn = meanExcessReturn * TRADING_DAYS_PER_YEAR;
			informationRatio = annualizedExcessReturn / trackingError;
		}

		return {
			alpha: alpha !== null ? Math.round(alpha * 10000) / 10000 : null,
			beta: beta !== null ? Math.round(beta * 10000) / 10000 : null,
			treynorRatio:
				treynorRatio !== null ? Math.round(treynorRatio * 10000) / 10000 : null,
			informationRatio:
				informationRatio !== null
					? Math.round(informationRatio * 10000) / 10000
					: null,
			trackingError:
				trackingError > 0 ? Math.round(trackingError * 10000) / 10000 : null,
		};
	}

	async computeAndStoreMetrics(
		schemeCode: string,
		isin: string,
	): Promise<boolean> {
		const benchmarkMapping =
			await mfBenchmarkMappingService.getBenchmarkMapping(isin);

		if (!benchmarkMapping) {
			console.log(`[RelativeMetrics] No benchmark mapping for ${isin}`);
			return false;
		}

		if (benchmarkMapping.confidenceScore < MIN_BENCHMARK_CONFIDENCE) {
			console.log(
				`[RelativeMetrics] Low confidence mapping for ${isin}: ${benchmarkMapping.confidenceScore}`,
			);
			return false;
		}

		const alignedData = await this.alignTimeSeries(
			schemeCode,
			benchmarkMapping.indexCode,
		);

		if (!alignedData) {
			return false;
		}

		const metrics = this.calculateRelativeMetrics(alignedData);
		const fiscalYear = getCurrentFiscalYear();

		await db.execute(sql`
      INSERT INTO mutual_fund_metrics (scheme_code, fiscal_year,
        alpha, beta, treynor_ratio, information_ratio, last_updated)
      VALUES (
        ${schemeCode}, ${fiscalYear},
        ${metrics.alpha?.toString() ?? null},
        ${metrics.beta?.toString() ?? null},
        ${metrics.treynorRatio?.toString() ?? null},
        ${metrics.informationRatio?.toString() ?? null},
        NOW()
      )
      ON CONFLICT (scheme_code, fiscal_year)
      DO UPDATE SET
        alpha = COALESCE(EXCLUDED.alpha, mutual_fund_metrics.alpha),
        beta = COALESCE(EXCLUDED.beta, mutual_fund_metrics.beta),
        treynor_ratio = COALESCE(EXCLUDED.treynor_ratio, mutual_fund_metrics.treynor_ratio),
        information_ratio = COALESCE(EXCLUDED.information_ratio, mutual_fund_metrics.information_ratio),
        last_updated = NOW()
    `);

		await db
			.update(mutualFunds)
			.set({
				benchmarkIndexCode: benchmarkMapping.indexCode,
				benchmarkConfidenceScore: benchmarkMapping.confidenceScore.toString(),
				lastUpdated: new Date(),
			})
			.where(eq(mutualFunds.schemeCode, schemeCode));

		console.log(
			`[RelativeMetrics] Computed metrics for ${schemeCode}: alpha=${metrics.alpha}, beta=${metrics.beta}`,
		);
		return true;
	}

	async recomputeAllMetrics(
		batchSize: number = 100,
	): Promise<{ processed: number; success: number; failed: number }> {
		console.log("[RelativeMetrics] Starting batch recomputation...");

		const fundsWithBenchmark = await db
			.select({
				schemeCode: mutualFunds.schemeCode,
				isin: mutualFunds.isin,
			})
			.from(mutualFunds)
			.innerJoin(mfBenchmarkMap, eq(mutualFunds.isin, mfBenchmarkMap.mfIsin))
			.where(
				sql`${mfBenchmarkMap.confidenceScore} >= ${MIN_BENCHMARK_CONFIDENCE}`,
			)
			.limit(batchSize);

		let processed = 0;
		let success = 0;
		let failed = 0;

		for (const fund of fundsWithBenchmark) {
			if (!fund.schemeCode || !fund.isin) continue;

			try {
				const result = await this.computeAndStoreMetrics(
					fund.schemeCode,
					fund.isin,
				);
				processed++;
				if (result) success++;
				else failed++;
			} catch (error) {
				console.error(
					`[RelativeMetrics] Error processing ${fund.schemeCode}:`,
					error,
				);
				failed++;
				processed++;
			}

			if (processed % 10 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(
			`[RelativeMetrics] Batch complete: processed=${processed}, success=${success}, failed=${failed}`,
		);
		return { processed, success, failed };
	}
}

export const mfRelativeMetricsEngine = MfRelativeMetricsEngine.getInstance();
