/**
 * @file enrichment-service.ts
 * @description Screener data enrichment pipeline — fetches and persists stock profiles,
 *              financial ratios, key metrics, and price history from data providers (FMP/NSE).
 *
 * UPGRADE (Audit #1): Removed @ts-nocheck. All raw SQL row results are now typed
 * via explicit interfaces. `(rows as any).rows` patterns are typed as RawSqlRows<T>.
 */
import { db } from "../../db";
import {
	listedStocks,
	screenerFinancials,
	screenerPriceHistory,
	screenerDerivedMetrics,
} from "@shared/schema";
import { eq, and, sql, lt, isNull, asc } from "drizzle-orm";
import { getDataProvider } from "./fmp-provider";
import { getProviderRegistry } from "./data-provider-registry";
import { fmpUsageMonitor } from "./fmp-usage-monitor";
import { calculateDerivedMetrics } from "./derived-metrics-engine";

// ── Typed raw-SQL result helper ───────────────────────────────────────────────
// Drizzle's db.execute() returns a result object whose shape varies between drivers.
// This union captures both pg (rows array) and Drizzle's native wrapper.
interface RawSqlResult<T = Record<string, unknown>> {
  rows?: T[];
  [key: number]: T;
  length?: number;
}

/** Safely extracts the rows array from a raw SQL execution result. */
function extractRows<T = Record<string, unknown>>(result: RawSqlResult<T>): T[] {
  return (result as any).rows ?? Array.from({ length: (result as any).length ?? 0 }, (_, i) => (result as any)[i]);
}

// ── Typed stock row shapes (from raw SQL SELECT) ──────────────────────────────
interface StockRow {
  id: string;
  symbol: string;
  fmp_symbol: string | null;
  data_source: string | null;
}


export interface EnrichmentResult {
	task: string;
	processed: number;
	errors: number;
	skipped: number;
	apiCallsUsed: number;
	remaining: number;
	details?: any;
	providerBreakdown?: Record<string, number>;
}

export async function enrichStockProfiles(
	batchSize = 10,
): Promise<EnrichmentResult> {
	const registry = getProviderRegistry();
	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	const providerBreakdown: Record<string, number> = {};

	const staleCutoff = new Date(
		Date.now() - 30 * 24 * 60 * 60 * 1000,
	).toISOString();
	const stocks = await db
		.select()
		.from(listedStocks)
		.where(
			sql`${listedStocks.lastFmpSync} IS NULL OR ${listedStocks.lastFmpSync} < ${staleCutoff}::timestamp`,
		)
		.orderBy(asc(listedStocks.lastFmpSync))
		.limit(batchSize);

	for (const stock of stocks) {
		try {
			const fmpSymbol = stock.fmpSymbol || `${stock.symbol}.NS`;
			const { result: profile, provider: providerName } =
				await registry.getCompanyProfile(fmpSymbol);
			apiCalls++;

			if (profile) {
				providerBreakdown[providerName] =
					(providerBreakdown[providerName] || 0) + 1;
				await db
					.update(listedStocks)
					.set({
						companyName: profile.companyName || stock.companyName,
						sector: profile.sector || stock.sector,
						industry: profile.industry || stock.industry,
						currentPrice: profile.price?.toString(),
						marketCapValue: profile.marketCap?.toString(),
						marketCapCategory: categorizeMarketCap(profile.marketCap),
						marketCap: categorizeMarketCap(profile.marketCap),  // listed_stocks canonical column
						lastFmpSync: new Date(),
						lastEnrichedAt: new Date(),
						enrichmentSource: providerName.toLowerCase(),
						dataSource: providerName.toLowerCase(),
						lastUpdated: new Date(),
					})
					.where(eq(listedStocks.id, stock.id));
				processed++;
			} else {
				skipped++;
			}
		} catch (err: any) {
			console.error(
				`[Enrichment] Profile error for ${stock.symbol}: ${err.message}`,
			);
			errors++;
		}
	}

	const stats = await fmpUsageMonitor.getDailyStats();
	return {
		task: "stock_profiles",
		processed,
		errors,
		skipped,
		apiCallsUsed: apiCalls,
		remaining: stats.remaining,
		providerBreakdown,
	};
}

export async function enrichFinancialRatios(
	batchSize = 5,
): Promise<EnrichmentResult> {
	const registry = getProviderRegistry();
	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	const errorDetails: string[] = [];
	const providerBreakdown: Record<string, number> = {};

	const stocks = await db.execute(sql`
    SELECT ss.id, ss.symbol, ss.fmp_symbol, ss.data_source
    FROM listed_stocks ss
    LEFT JOIN screener_financials sf ON sf.symbol = ss.symbol
    WHERE ss.is_active = true
      AND (
        sf.roe IS NULL 
        OR sf.pb_ratio IS NULL 
        OR sf.debt_to_equity IS NULL 
        OR sf.dividend_yield IS NULL
        OR sf.operating_margin IS NULL
        OR sf.net_profit_margin IS NULL
      )
    ORDER BY 
      CASE WHEN sf.last_updated IS NULL THEN 0 ELSE 1 END,
      sf.last_updated ASC NULLS FIRST
    LIMIT ${batchSize}
  `);

	const stockRows = extractRows<StockRow>(stocks as unknown as RawSqlResult<StockRow>);

	for (const stock of stockRows) {
		try {
			const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
			const { result: ratios, provider: providerName } =
				await registry.getRatios(fmpSymbol);
			apiCalls++;

			if (ratios) {
				providerBreakdown[providerName] =
					(providerBreakdown[providerName] || 0) + 1;
				const values: Record<string, any> = {
					symbol: stock.symbol,
					period: ratios.period || "annual",
					fiscalYear: ratios.date
						? Number.parseInt(ratios.date.split("-")[0])
						: new Date().getFullYear(),
					fiscalDate: ratios.date,
					lastUpdated: new Date(),
				};

				if (ratios.peRatio != null) values.peRatio = ratios.peRatio.toString();
				if (ratios.pbRatio != null) values.pbRatio = ratios.pbRatio.toString();
				if (ratios.evToEbitda != null)
					values.evToEbitda = ratios.evToEbitda.toString();
				if (ratios.priceToSales != null)
					values.priceToSales = ratios.priceToSales.toString();
				if (ratios.roe != null) values.roe = ratios.roe.toString();
				if (ratios.roa != null) values.roa = ratios.roa.toString();
				if (ratios.netProfitMargin != null)
					values.netProfitMargin = ratios.netProfitMargin.toString();
				if (ratios.operatingMargin != null)
					values.operatingMargin = ratios.operatingMargin.toString();
				if (ratios.grossMargin != null)
					values.grossMargin = ratios.grossMargin.toString();
				if (ratios.debtToEquity != null)
					values.debtToEquity = ratios.debtToEquity.toString();
				if (ratios.currentRatio != null)
					values.currentRatio = ratios.currentRatio.toString();
				if (ratios.quickRatio != null)
					values.quickRatio = ratios.quickRatio.toString();
				if (ratios.interestCoverage != null)
					values.interestCoverage = ratios.interestCoverage.toString();
				if (ratios.eps != null) values.eps = ratios.eps.toString();
				if (ratios.bookValue != null)
					values.bookValue = ratios.bookValue.toString();
				if (ratios.dividendYield != null)
					values.dividendYield = ratios.dividendYield.toString();
				if (ratios.dividendPayout != null)
					values.dividendPayout = ratios.dividendPayout.toString();
				if (ratios.freeCashFlowPerShare != null)
					values.freeCashFlowPerShare = ratios.freeCashFlowPerShare.toString();
				if (ratios.revenueGrowth != null)
					values.revenueGrowth = ratios.revenueGrowth.toString();
				if (ratios.earningsGrowth != null)
					values.earningsGrowth = ratios.earningsGrowth.toString();
				// Forward PE and PEG — new fields, written when available from FMP /ratios/
				if (ratios.forwardPe != null)
					values.forwardPe = ratios.forwardPe.toString();
				if (ratios.pegRatio != null)
					values.pegRatio = ratios.pegRatio.toString();

				// Phase 2e: True ROCE = EBIT / Capital Employed
				// Capital Employed = Total Assets − Current Liabilities (FMP: totalCurrentLiabilities)
				// EBIT = operatingIncome from income statement
				// Fallback: proxy ROCE = operatingMargin × 1.1 if balance sheet unavailable
				try {
					const provider = getDataProvider();
					const [incomeStmts, balanceSheets] = await Promise.all([
						provider.getIncomeStatement(fmpSymbol, "annual"),
						provider.getBalanceSheet(fmpSymbol, "annual"),
					]);
					apiCalls += 2;

					if (incomeStmts.length > 0 && balanceSheets.length > 0) {
						const income = incomeStmts[0];
						const balance = balanceSheets[0];
						const ebit = income.operatingIncome;
						const capitalEmployed =
							balance.totalAssets != null && balance.currentLiabilities != null
								? balance.totalAssets - balance.currentLiabilities
								: null;

						if (ebit != null && capitalEmployed != null && capitalEmployed > 0) {
							const trueRoce = +(ebit / capitalEmployed).toFixed(6);
							values.roce = trueRoce.toString();
							console.log(
								`[Enrichment] ROCE computed: ${stock.symbol} EBIT=${ebit} CE=${capitalEmployed} ROCE=${(trueRoce * 100).toFixed(2)}%`,
							);
						} else if (ratios.operatingMargin != null) {
							// Partial data — use proxy fallback
							values.roce = +(ratios.operatingMargin * 1.1).toFixed(6) + "";
						}
					} else if (ratios.operatingMargin != null) {
						// No statement data — proxy fallback
						values.roce = +(ratios.operatingMargin * 1.1).toFixed(6) + "";
					}
				} catch (roceErr: any) {
					// Non-fatal — proxy fallback if IS/BS fetch fails
					if (ratios.operatingMargin != null) {
						values.roce = +(ratios.operatingMargin * 1.1).toFixed(6) + "";
					}
					console.warn(`[Enrichment] ROCE fetch failed for ${stock.symbol}: ${roceErr.message?.slice(0, 80)}`);
				}

				const [existing] = await db
					.select({ id: screenerFinancials.id })
					.from(screenerFinancials)
					.where(eq(screenerFinancials.symbol, stock.symbol))
					.limit(1);

				if (existing) {
					await db
						.update(screenerFinancials)
						.set(values)
						.where(eq(screenerFinancials.id, existing.id));
				} else {
					await db.insert(screenerFinancials).values(values as any);
				}

				await db
					.update(listedStocks)
					.set({
						lastFmpSync: new Date(),
						lastFinancialsSync: new Date(), // Phase 2f: track per-table freshness
						updatedAt: new Date(),
					})
					.where(eq(listedStocks.symbol, stock.symbol));

				await calculateDerivedMetrics(stock.symbol);
				processed++;
				console.log(
					`[Enrichment] Ratios enriched: ${stock.symbol} (PB=${ratios.pbRatio}, ROE=${ratios.roe}, D/E=${ratios.debtToEquity})`,
				);
			} else {
				skipped++;
				errorDetails.push(
					`${stock.symbol}: No data returned from any provider`,
				);
			}
		} catch (err: any) {
			errors++;
			errorDetails.push(`${stock.symbol}: ${err.message}`);
			console.error(
				`[Enrichment] Ratio error for ${stock.symbol}: ${err.message}`,
			);
		}
	}

	const stats = await fmpUsageMonitor.getDailyStats();
	return {
		task: "financial_ratios",
		processed,
		errors,
		skipped,
		apiCallsUsed: apiCalls,
		remaining: stats.remaining,
		details: { errors: errorDetails },
		providerBreakdown,
	};
}

/**
 * Fetch and store FMP key metrics for all active stocks missing coverage.
 *
 * Purpose: Ensures 100% key_metrics coverage by running independently of Tier 1
 *          budget-cap. Each call processes `batchSize` stocks ordered by market cap
 *          (largest first) so the most important symbols are covered first.
 *
 * Inputs:  batchSize — max stocks per run (default 10)
 * Outputs: EnrichmentResult with processed/errors/skipped counts
 * Edge cases:
 *   - ON CONFLICT DO NOTHING — idempotent; safe to re-run
 *   - lastKeyMetricsSync written only on successful INSERT
 *   - Non-fatal: single-stock errors do not abort the batch
 */
export async function enrichKeyMetrics(
	batchSize = 10,
): Promise<EnrichmentResult> {
	const provider = getDataProvider();
	let processed = 0, errors = 0, skipped = 0, apiCalls = 0;
	const errorDetails: string[] = [];

	if (!(await fmpUsageMonitor.canMakeCall())) {
		const stats = await fmpUsageMonitor.getDailyStats();
		return { task: "key_metrics", processed: 0, errors: 0, skipped: 0, apiCallsUsed: 0, remaining: stats.remaining };
	}

	// Select stocks missing key_metrics, ordered by market cap
	const stocks = extractRows<StockRow>(await db.execute(sql`
    SELECT ss.symbol, ss.fmp_symbol
    FROM listed_stocks ss
    LEFT JOIN screener_key_metrics skm ON skm.symbol = ss.symbol
    WHERE ss.is_active = true AND skm.id IS NULL
    ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
    LIMIT ${batchSize}
  `) as unknown as RawSqlResult<StockRow>);

	for (const stock of stocks) {
		if (!(await fmpUsageMonitor.canMakeCall())) break;
		try {
			const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
		const data = await (provider as any).getKeyMetrics(fmpSymbol, 1) as any[];
			apiCalls++;

			if (data.length > 0) {
				const k = data[0];
				await db.execute(sql`
          INSERT INTO screener_key_metrics (symbol, date, period,
            revenue_per_share, net_income_per_share, operating_cash_flow_per_share,
            free_cash_flow_per_share, cash_per_share, book_value_per_share,
            tangible_book_value_per_share, market_cap, enterprise_value,
            pe_ratio, price_to_sales_ratio, pb_ratio, ev_to_sales,
            enterprise_value_over_ebitda, earnings_yield, free_cash_flow_yield,
            debt_to_equity, debt_to_assets, net_debt_to_ebitda, current_ratio,
            interest_coverage, income_quality, dividend_yield, payout_ratio,
            graham_number, roic, return_on_tangible_assets, working_capital,
            invested_capital, days_sales_outstanding, days_payables_outstanding,
            days_of_inventory_on_hand, roe, capex_per_share)
          VALUES (${stock.symbol}, ${k.date || null}, ${k.period || "annual"},
            ${k.revenuePerShare}, ${k.netIncomePerShare}, ${k.operatingCashFlowPerShare},
            ${k.freeCashFlowPerShare}, ${k.cashPerShare}, ${k.bookValuePerShare},
            ${k.tangibleBookValuePerShare}, ${k.marketCap}, ${k.enterpriseValue},
            ${k.peRatio}, ${k.priceToSalesRatio}, ${k.pbRatio}, ${k.evToSales},
            ${k.enterpriseValueOverEBITDA}, ${k.earningsYield}, ${k.freeCashFlowYield},
            ${k.debtToEquity}, ${k.debtToAssets}, ${k.netDebtToEBITDA},
            ${k.currentRatio}, ${k.interestCoverage}, ${k.incomeQuality},
            ${k.dividendYield}, ${k.payoutRatio}, ${k.grahamNumber}, ${k.roic},
            ${k.returnOnTangibleAssets}, ${k.workingCapital}, ${k.investedCapital},
            ${k.daysSalesOutstanding}, ${k.daysPayablesOutstanding}, ${k.daysOfInventoryOnHand},
            ${k.roe}, ${k.capexPerShare})
          ON CONFLICT DO NOTHING
        `);
				// Phase 2f: write freshness timestamp
				await db.execute(sql`
          UPDATE listed_stocks SET last_key_metrics_sync = NOW(), updated_at = NOW()
          WHERE symbol = ${stock.symbol}
        `);
				console.log(`[Enrichment] KeyMetrics: ${stock.symbol} ROIC=${k.roic} Graham=${k.grahamNumber}`);
				processed++;
			} else {
				skipped++;
			}
		} catch (err: any) {
			errors++;
			errorDetails.push(`${stock.symbol}: ${err.message?.slice(0, 80)}`);
			console.error(`[Enrichment] KeyMetrics error ${stock.symbol}: ${err.message}`);
		}
	}

	const stats = await fmpUsageMonitor.getDailyStats();
	return {
		task: "key_metrics",
		processed,
		errors,
		skipped,
		apiCallsUsed: apiCalls,
		remaining: stats.remaining,
		details: { errors: errorDetails },
	};
}


export async function enrichPriceHistory(
	batchSize = 3,
): Promise<EnrichmentResult> {
	const registry = getProviderRegistry();
	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	const providerBreakdown: Record<string, number> = {};

	const stockRows = extractRows<StockRow>(await db.execute(sql`
    SELECT ss.id, ss.symbol, ss.fmp_symbol, ss.data_source
    FROM listed_stocks ss
    LEFT JOIN screener_financials sf ON sf.symbol = ss.symbol
    WHERE ss.is_active = true
      AND sf.return_1y IS NULL
    ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
    LIMIT ${batchSize}
  `) as unknown as RawSqlResult<StockRow>);
	const today = new Date().toISOString().split("T")[0];
	const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000)
		.toISOString()
		.split("T")[0];

	for (const stock of stockRows) {
		try {
			const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
			const { result: prices, provider: providerName } =
				await registry.getHistoricalPrices(fmpSymbol, fiveYearsAgo, today);
			apiCalls++;
			if (prices.length > 0)
				providerBreakdown[providerName] =
					(providerBreakdown[providerName] || 0) + 1;

			if (prices.length > 0) {
				await db
					.delete(screenerPriceHistory)
					.where(eq(screenerPriceHistory.symbol, stock.symbol));

				const batchInserts = prices.map((p) => ({
					symbol: stock.symbol,
					date: p.date,
					open: p.open?.toString(),
					high: p.high?.toString(),
					low: p.low?.toString(),
					close: p.close?.toString(),
					adjClose: p.adjClose?.toString(),
					volume: p.volume?.toString(),
					changePercent: p.changePercent?.toString(),
				}));

				for (let i = 0; i < batchInserts.length; i += 50) {
					await db
						.insert(screenerPriceHistory)
						.values(batchInserts.slice(i, i + 50));
				}

				await calculateReturnsFromPriceHistory(stock.symbol, prices);
				processed++;
				console.log(
					`[Enrichment] Price history stored: ${stock.symbol} (${prices.length} records, ${fiveYearsAgo} to ${today})`,
				);
			} else {
				skipped++;
			}
		} catch (err: any) {
			errors++;
			console.error(
				`[Enrichment] Price history error for ${stock.symbol}: ${err.message}`,
			);
		}
	}

	const stats = await fmpUsageMonitor.getDailyStats();
	return {
		task: "price_history",
		processed,
		errors,
		skipped,
		apiCallsUsed: apiCalls,
		remaining: stats.remaining,
		providerBreakdown,
	};
}

export async function calculateReturnsFromPriceHistory(
	symbol: string,
	prices?: { date: string; close: number; adjClose: number }[],
): Promise<{
	return1y?: number;
	return2y?: number;
	return3y?: number;
	return5y?: number;
} | null> {
	let priceData = prices;
	if (!priceData) {
		const dbPrices = await db
			.select({
				date: screenerPriceHistory.date,
				close: screenerPriceHistory.close,
				adjClose: screenerPriceHistory.adjClose,
			})
			.from(screenerPriceHistory)
			.where(eq(screenerPriceHistory.symbol, symbol))
			.orderBy(sql`${screenerPriceHistory.date} DESC`);

		if (dbPrices.length === 0) return null;
		priceData = dbPrices.map((p) => ({
			date: p.date,
			close: Number.parseFloat(p.close || "0"),
			adjClose: Number.parseFloat(p.adjClose || p.close || "0"),
		}));
	}

	const sortedPrices = [...priceData].sort((a, b) =>
		b.date.localeCompare(a.date),
	);
	if (sortedPrices.length === 0) return null;

	const latestPrice = sortedPrices[0].adjClose || sortedPrices[0].close;
	if (!latestPrice || latestPrice <= 0) return null;

	function findPriceNearDate(targetDate: string): number | null {
		const target = new Date(targetDate).getTime();
		let closest: { price: number; diff: number } | null = null;
		for (const p of sortedPrices) {
			const diff = Math.abs(new Date(p.date).getTime() - target);
			const price = p.adjClose || p.close;
			if (price > 0 && (closest === null || diff < closest.diff)) {
				closest = { price, diff };
			}
			if (diff > 30 * 24 * 60 * 60 * 1000 && closest) break;
		}
		if (closest && closest.diff <= 15 * 24 * 60 * 60 * 1000)
			return closest.price;
		return null;
	}

	const now = new Date();
	const returns: {
		return1y?: number;
		return2y?: number;
		return3y?: number;
		return5y?: number;
	} = {};

	const price1yAgo = findPriceNearDate(
		new Date(now.getTime() - 365.25 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0],
	);
	if (price1yAgo) returns.return1y = (latestPrice - price1yAgo) / price1yAgo;

	const price2yAgo = findPriceNearDate(
		new Date(now.getTime() - 2 * 365.25 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0],
	);
	if (price2yAgo) returns.return2y = (latestPrice - price2yAgo) / price2yAgo;

	const price3yAgo = findPriceNearDate(
		new Date(now.getTime() - 3 * 365.25 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0],
	);
	if (price3yAgo) returns.return3y = (latestPrice - price3yAgo) / price3yAgo;

	const price5yAgo = findPriceNearDate(
		new Date(now.getTime() - 5 * 365.25 * 24 * 60 * 60 * 1000)
			.toISOString()
			.split("T")[0],
	);
	if (price5yAgo) returns.return5y = (latestPrice - price5yAgo) / price5yAgo;

	const updateValues: Record<string, any> = { lastUpdated: new Date() };
	if (returns.return1y != null)
		updateValues.return1y = returns.return1y.toFixed(4);
	if (returns.return2y != null)
		updateValues.return2y = returns.return2y.toFixed(4);
	if (returns.return3y != null)
		updateValues.return3y = returns.return3y.toFixed(4);
	if (returns.return5y != null)
		updateValues.return5y = returns.return5y.toFixed(4);

	if (Object.keys(updateValues).length > 1) {
		const [existing] = await db
			.select({ id: screenerFinancials.id })
			.from(screenerFinancials)
			.where(eq(screenerFinancials.symbol, symbol))
			.limit(1);

		if (existing) {
			await db
				.update(screenerFinancials)
				.set(updateValues)
				.where(eq(screenerFinancials.id, existing.id));
		} else {
			await db.insert(screenerFinancials).values({
				symbol,
				period: "annual",
				fiscalYear: new Date().getFullYear(),
				...updateValues,
			});
		}

		console.log(
			`[Returns] ${symbol}: 1Y=${returns.return1y != null ? (returns.return1y * 100).toFixed(1) + "%" : "N/A"}, 2Y=${returns.return2y != null ? (returns.return2y * 100).toFixed(1) + "%" : "N/A"}, 3Y=${returns.return3y != null ? (returns.return3y * 100).toFixed(1) + "%" : "N/A"}, 5Y=${returns.return5y != null ? (returns.return5y * 100).toFixed(1) + "%" : "N/A"}`,
		);
	}

	return returns;
}

export async function runDailyEnrichmentBatch(options?: {
	ratiosBatchSize?: number;
	pricesBatchSize?: number;
	maxApiCalls?: number;
}): Promise<{
	ratios: EnrichmentResult;
	prices: EnrichmentResult;
	totalApiCalls: number;
	remaining: number;
}> {
	const ratiosBatch = options?.ratiosBatchSize || 120;
	const pricesBatch = options?.pricesBatchSize || 80;
	const maxCalls = options?.maxApiCalls || 240;

	console.log(
		`[DailyEnrichment] Starting daily batch: ratios=${ratiosBatch}, prices=${pricesBatch}, maxCalls=${maxCalls}`,
	);

	const initialStats = await fmpUsageMonitor.getDailyStats();
	const availableCalls = Math.min(maxCalls, initialStats.remaining);

	const ratiosAllocation = Math.floor(availableCalls * 0.6);
	const pricesAllocation = availableCalls - ratiosAllocation;

	const actualRatiosBatch = Math.min(ratiosBatch, ratiosAllocation);
	const actualPricesBatch = Math.min(pricesBatch, pricesAllocation);

	console.log(
		`[DailyEnrichment] Available: ${availableCalls} calls. Ratios: ${actualRatiosBatch}, Prices: ${actualPricesBatch}`,
	);

	const ratiosResult = await enrichFinancialRatios(actualRatiosBatch);
	const pricesResult = await enrichPriceHistory(actualPricesBatch);

	const totalApiCalls = ratiosResult.apiCallsUsed + pricesResult.apiCallsUsed;
	const finalStats = await fmpUsageMonitor.getDailyStats();

	console.log(
		`[DailyEnrichment] Complete: ${totalApiCalls} API calls used. Ratios: ${ratiosResult.processed} enriched, Prices: ${pricesResult.processed} enriched. Remaining: ${finalStats.remaining}`,
	);

	return {
		ratios: ratiosResult,
		prices: pricesResult,
		totalApiCalls,
		remaining: finalStats.remaining,
	};
}

export async function getEnrichmentProgress(): Promise<{
	total: number;
	withRatios: number;
	withReturns: number;
	missingRatios: number;
	missingReturns: number;
	enrichmentPercent: number;
	estimatedDaysRemaining: number;
	// Phase 2f / 4d: per-table freshness coverage (stocks synced in last 30d)
	freshness: {
		financials: { synced: number; stale: number; coveragePct: number };
		keyMetrics: { synced: number; stale: number; coveragePct: number };
		technicals: { synced: number; stale: number; coveragePct: number };
		shareholding: { synced: number; stale: number; coveragePct: number };
	};
}> {
	const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true) as total,
      (SELECT COUNT(*) FROM screener_financials WHERE roe IS NOT NULL OR pb_ratio IS NOT NULL OR debt_to_equity IS NOT NULL) as with_ratios,
      (SELECT COUNT(*) FROM screener_financials WHERE return_1y IS NOT NULL) as with_returns,
      (SELECT COUNT(*) FROM listed_stocks ss 
       LEFT JOIN screener_financials sf ON sf.symbol = ss.symbol
       WHERE ss.is_active = true AND (sf.roe IS NULL AND sf.pb_ratio IS NULL AND sf.debt_to_equity IS NULL)) as missing_ratios,
      (SELECT COUNT(*) FROM listed_stocks ss 
       LEFT JOIN screener_financials sf ON sf.symbol = ss.symbol
       WHERE ss.is_active = true AND sf.return_1y IS NULL) as missing_returns,
      -- Phase 2f: per-table freshness (synced within 30 days)
      (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_financials_sync  > NOW() - INTERVAL '30 days') as fin_synced,
      (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_key_metrics_sync > NOW() - INTERVAL '30 days') as km_synced,
      (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_technicals_sync  > NOW() - INTERVAL '30 days') as tech_synced,
      (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_shareholding_sync > NOW() - INTERVAL '30 days') as sh_synced
  `);

	const row = extractRows<Record<string, unknown>>(result as unknown as RawSqlResult)[0];
	const total = Number(row.total);
	const withRatios = Number(row.with_ratios);
	const withReturns = Number(row.with_returns);
	const missingRatios = Number(row.missing_ratios);
	const missingReturns = Number(row.missing_returns);
	const totalMissing = missingRatios + missingReturns;
	const enriched = withRatios + withReturns;
	const enrichmentPercent =
		total > 0 ? Math.round((enriched / (total * 2)) * 100) : 0;
	const callsPerDay = 240;
	const estimatedDaysRemaining =
		totalMissing > 0 ? Math.ceil(totalMissing / callsPerDay) : 0;

	// Per-table freshness
	const finSynced = Number(row.fin_synced);
	const kmSynced = Number(row.km_synced);
	const techSynced = Number(row.tech_synced);
	const shSynced = Number(row.sh_synced);
	const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

	return {
		total,
		withRatios,
		withReturns,
		missingRatios,
		missingReturns,
		enrichmentPercent,
		estimatedDaysRemaining,
		freshness: {
			financials:   { synced: finSynced,  stale: total - finSynced,  coveragePct: pct(finSynced)  },
			keyMetrics:   { synced: kmSynced,   stale: total - kmSynced,   coveragePct: pct(kmSynced)   },
			technicals:   { synced: techSynced, stale: total - techSynced, coveragePct: pct(techSynced) },
			shareholding: { synced: shSynced,   stale: total - shSynced,   coveragePct: pct(shSynced)   },
		},
	};
}

export async function seedScreenerFromFmp(
	exchange = "NSE",
	limit = 50,
): Promise<EnrichmentResult> {
	const provider = getDataProvider();
	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 1;

	if (!(await fmpUsageMonitor.canMakeCall())) {
		return {
			task: "seed_screener",
			processed: 0,
			errors: 0,
			skipped: 0,
			apiCallsUsed: 0,
			remaining: 0,
		};
	}

	const results = await provider.getStockScreener(0, exchange, limit);

	for (const stock of results) {
		try {
			const [existing] = await db
				.select({ id: listedStocks.id })
				.from(listedStocks)
				.where(
					eq(
						listedStocks.symbol,
						stock.symbol.replace(".NS", "").replace(".BO", ""),
					),
				)
				.limit(1);

			if (existing) {
				skipped++;
				continue;
			}

			await db.insert(listedStocks).values({
				symbol: stock.symbol.replace(".NS", "").replace(".BO", ""),
				companyName: stock.companyName,
				exchange: stock.exchange || exchange,    // NSE | BSE | NYSE | NASDAQ
				country: stock.country || "IN",          // ISO country code
				currency: "INR",                         // default INR; global stocks override later
				sector: stock.sector,
				industry: stock.industry,
				marketCapValue: stock.marketCap?.toString(),
				marketCapCategory: categorizeMarketCap(stock.marketCap),
				marketCap: categorizeMarketCap(stock.marketCap),
				currentPrice: stock.price?.toString(),
				fmpSymbol: stock.symbol,
				dataSource: "fmp",
				isActive: true,
				enrichmentStatus: "pending",
			} as any);
			processed++;
		} catch (err: any) {
			errors++;
		}
	}

	const stats = await fmpUsageMonitor.getDailyStats();
	return {
		task: "seed_screener",
		processed,
		errors,
		skipped,
		apiCallsUsed: apiCalls,
		remaining: stats.remaining,
	};
}

export async function seedFromListedStocks(
	limit = 50,
): Promise<EnrichmentResult> {
	let processed = 0,
		errors = 0,
		skipped = 0;

	try {
		const result = await db.execute(sql`
      INSERT INTO listed_stocks (symbol, company_name, exchange, isin, sector, industry, market_cap_category, country, currency, is_active, current_price, market_cap_value, data_source, created_at, updated_at)
      SELECT 
        ls.symbol,
        ls.company_name,
        COALESCE(CASE WHEN ls.nse_code IS NOT NULL AND ls.nse_code != '' THEN 'NSE' ELSE 'BSE' END, 'NSE'),
        ls.isin,
        ls.sector,
        ls.industry,
        ls.market_cap,
        COALESCE(ls.country, 'IN'),
        COALESCE(ls.currency, 'INR'),
        true,
        ls.current_price::numeric,
        ls.market_cap_value::numeric,
        'listed_stocks',
        NOW(),
        NOW()
      FROM listed_stocks ls
      WHERE ls.is_published = true
        AND ls.symbol IS NOT NULL
        AND ls.symbol != ''
        AND NOT EXISTS (SELECT 1 FROM listed_stocks ss WHERE ss.symbol = ls.symbol)
      LIMIT ${limit}
    `);
		processed = (result as unknown as { rowCount?: number })?.rowCount ?? 0;

		const finResult = await db.execute(sql`
      INSERT INTO screener_financials (symbol, period, fiscal_year, pe_ratio, pb_ratio, dividend_yield, eps, book_value, roe, roce, last_updated, created_at)
      SELECT 
        ls.symbol,
        'annual',
        2025,
        ls.pe_ratio::numeric,
        ls.pb_ratio::numeric,
        ls.dividend_yield::numeric,
        ls.eps::numeric,
        ls.book_value::numeric,
        ls.roe::numeric,
        ls.roce::numeric,
        NOW(),
        NOW()
      FROM listed_stocks ls
      INNER JOIN screener_stocks ss ON ss.symbol = ls.symbol
      WHERE ls.is_published = true
        AND (ls.pe_ratio IS NOT NULL OR ls.pb_ratio IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM screener_financials sf WHERE sf.symbol = ls.symbol)
    `);
		const financialsAdded = (finResult as unknown as { rowCount?: number })?.rowCount ?? 0;


		// ── Auto-normalize market_cap_category after seeding ──────────────────────
		// listed_stocks seeds title-case labels ('Micro Cap', 'Large Cap', etc.)
		// while FMP enrichment uses lowercase codes ('micro', 'large').
		// Normalise immediately so screener filters always work correctly.
		await db.execute(sql`
      UPDATE listed_stocks SET market_cap_category =
        CASE
          WHEN LOWER(market_cap_category) IN ('mega cap','mega')    THEN 'mega'
          WHEN LOWER(market_cap_category) IN ('large cap','large')  THEN 'large'
          WHEN LOWER(market_cap_category) IN ('mid cap','mid')      THEN 'mid'
          WHEN LOWER(market_cap_category) IN ('small cap','small')  THEN 'small'
          WHEN LOWER(market_cap_category) IN ('micro cap','micro')  THEN 'micro'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 1000000000000 THEN 'mega'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 200000000000  THEN 'large'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 50000000000   THEN 'mid'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 5000000000    THEN 'small'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >  0             THEN 'micro'
          ELSE market_cap_category
        END
      WHERE is_active = true
        AND (
          market_cap_category ~ '[A-Z ]'
          OR (market_cap_category IS NULL AND market_cap_value IS NOT NULL)
        )
    `);
		console.log(
			`[Screener Seed] Seeded ${processed} stocks, ${financialsAdded} financials from listed_stocks`,
		);
	} catch (err: any) {
		console.error("[Screener Seed] Error:", err.message);
		errors++;
	}

	return {
		task: "seed_from_listed_stocks",
		processed,
		errors,
		skipped,
		apiCallsUsed: 0,
		remaining: 0,
	};
}

export async function seedUnlistedToScreener(
	limit = 50,
): Promise<EnrichmentResult> {
	let processed = 0,
		errors = 0,
		skipped = 0;

	try {
		const result = await db.execute(sql`
      INSERT INTO listed_stocks (symbol, company_name, exchange, isin, sector, industry, market_cap_category, country, currency, is_active, current_price, data_source, created_at, updated_at)
      SELECT 
        COALESCE(uc.cin, uc.id::text),
        uc.name,
        'UNLISTED',
        uc.isin,
        uc.sector,
        uc.industry,
        'Small Cap',
        COALESCE(uc.country, 'IN'),
        COALESCE(uc.currency, 'INR'),
        true,
        uc.published_buy_price::numeric,
        'unlisted',
        NOW(),
        NOW()
      FROM unlisted_companies uc
      WHERE uc.name IS NOT NULL
        AND uc.name != ''
        AND uc.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM listed_stocks ss 
          WHERE ss.symbol = COALESCE(uc.cin, uc.id::text)
        )
      LIMIT ${limit}
    `);
		processed = (result as unknown as { rowCount?: number })?.rowCount ?? 0;

		if (processed > 0) {
			const finResult = await db.execute(sql`
        INSERT INTO screener_financials (symbol, period, fiscal_year, pe_ratio, last_updated, created_at)
        SELECT 
          ss.symbol,
          'annual',
          2025,
          cr.pe_ratio::numeric,
          NOW(),
          NOW()
        FROM listed_stocks ss
        INNER JOIN unlisted_companies uc ON COALESCE(uc.cin, uc.id::text) = ss.symbol
        LEFT JOIN company_ratios cr ON cr.company_id = uc.id
        WHERE ss.data_source = 'unlisted'
          AND NOT EXISTS (SELECT 1 FROM screener_financials sf WHERE sf.symbol = ss.symbol)
      `);
			const financialsAdded = (finResult as unknown as { rowCount?: number })?.rowCount ?? 0;
			console.log(
				`[Screener Seed] Seeded ${processed} unlisted stocks, ${financialsAdded} financials`,
			);
		}
	} catch (err: any) {
		console.error("[Screener Seed] Unlisted seed error:", err.message);
		errors++;
	}

	return {
		task: "seed_unlisted",
		processed,
		errors,
		skipped,
		apiCallsUsed: 0,
		remaining: 0,
	};
}

export function isProductionEnrichmentAllowed(): boolean {
	const env = process.env.NODE_ENV || "development";
	if (env === "production") return true;
	console.log(
		"[Enrichment] Bulk FMP enrichment skipped (development mode - production only)",
	);
	return false;
}

function categorizeMarketCap(cap: number): string {
	if (!cap || cap <= 0) return "unknown";
	const crores = cap / 10000000;
	if (crores >= 100000) return "mega";
	if (crores >= 20000) return "large";
	if (crores >= 5000) return "mid";
	if (crores >= 500) return "small";
	return "micro";
}
