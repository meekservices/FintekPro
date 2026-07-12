import { db } from "../../db";
import { sql } from "drizzle-orm";
import { fmpUsageMonitor } from "./fmp-usage-monitor";
import { getExtendedProvider } from "./fmp-provider";
import {
	enrichFinancialRatios,
	enrichPriceHistory,
	type EnrichmentResult,
} from "./enrichment-service";
import { calculateDerivedMetrics } from "./derived-metrics-engine";

export interface TierBudget {
	tier1: number;
	tier2: number;
	tier3: number;
	tier4: number;
}

export interface TierResult {
	tier: string;
	tasks: Record<string, EnrichmentResult>;
	totalApiCalls: number;
}

export interface PriorityBatchResult {
	tiers: TierResult[];
	totalApiCalls: number;
	remaining: number;
	budgetAllocation: TierBudget;
}

const DEFAULT_BUDGET_SPLIT: TierBudget = {
	tier1: 0.4,
	tier2: 0.3,
	tier3: 0.2,
	tier4: 0.1,
};

function makeResult(
	task: string,
	processed = 0,
	errors = 0,
	skipped = 0,
	apiCallsUsed = 0,
	remaining = 0,
): EnrichmentResult {
	return { task, processed, errors, skipped, apiCallsUsed, remaining };
}

async function canContinue(): Promise<boolean> {
	return fmpUsageMonitor.canMakeCall();
}

export async function enrichTier1(budget: number): Promise<TierResult> {
	const provider = getExtendedProvider();
	const tasks: Record<string, EnrichmentResult> = {};
	let totalApiCalls = 0;

	const ratiosBudget = Math.floor(budget * 0.3);
	const growthBudget = Math.floor(budget * 0.2);
	const keyMetricsBudget = Math.floor(budget * 0.2);
	const dcfBudget = Math.floor(budget * 0.15);
	const ratingBudget =
		budget - ratiosBudget - growthBudget - keyMetricsBudget - dcfBudget;

	tasks.ratios = await enrichFinancialRatios(ratiosBudget);
	totalApiCalls += tasks.ratios.apiCallsUsed;

	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_growth_metrics sgm ON sgm.symbol = ss.symbol
      WHERE ss.is_active = true AND sgm.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${growthBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getFinancialGrowth(fmpSymbol, 1);
				apiCalls++;
				if (data.length > 0) {
					const g = data[0];
					await db.execute(sql`
            INSERT INTO screener_growth_metrics (symbol, date, period, revenue_growth, net_income_growth, eps_growth, eps_diluted_growth,
              gross_profit_growth, operating_income_growth, free_cash_flow_growth, asset_growth, debt_growth, dividend_growth,
              book_value_growth, operating_cash_flow_growth, receivables_growth, inventory_growth,
              ten_y_revenue_growth_per_share, five_y_revenue_growth_per_share, three_y_revenue_growth_per_share,
              ten_y_net_income_growth_per_share, five_y_net_income_growth_per_share, three_y_net_income_growth_per_share)
            VALUES (${stock.symbol}, ${g.date || null}, ${g.period || "annual"},
              ${g.revenueGrowth}, ${g.netIncomeGrowth}, ${g.epsgrowth}, ${g.epsdilutedGrowth},
              ${g.grossProfitGrowth}, ${g.operatingIncomeGrowth}, ${g.freeCashFlowGrowth},
              ${g.assetGrowth}, ${g.debtGrowth}, ${g.dividendsperShareGrowth},
              ${g.bookValueperShareGrowth}, ${g.operatingCashFlowGrowth},
              ${g.receivablesGrowth}, ${g.inventoryGrowth},
              ${g.tenYRevenueGrowthPerShare}, ${g.fiveYRevenueGrowthPerShare}, ${g.threeYRevenueGrowthPerShare},
              ${g.tenYNetIncomeGrowthPerShare}, ${g.fiveYNetIncomeGrowthPerShare}, ${g.threeYNetIncomeGrowthPerShare})
            ON CONFLICT DO NOTHING
          `);
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
				console.error(`[Tier1:Growth] ${stock.symbol}: ${err.message}`);
			}
		}
	}
	tasks.growth = makeResult(
		"financial_growth",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_key_metrics skm ON skm.symbol = ss.symbol
      WHERE ss.is_active = true AND skm.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${keyMetricsBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getKeyMetrics(fmpSymbol, 1);
				apiCalls++;
				if (data.length > 0) {
					const k = data[0];
					await db.execute(sql`
            INSERT INTO screener_key_metrics (symbol, date, period, revenue_per_share, net_income_per_share,
              operating_cash_flow_per_share, free_cash_flow_per_share, cash_per_share, book_value_per_share,
              tangible_book_value_per_share, market_cap, enterprise_value, pe_ratio, price_to_sales_ratio,
              pb_ratio, ev_to_sales, enterprise_value_over_ebitda, earnings_yield, free_cash_flow_yield,
              debt_to_equity, debt_to_assets, net_debt_to_ebitda, current_ratio, interest_coverage,
              income_quality, dividend_yield, payout_ratio, graham_number, roic,
              return_on_tangible_assets, working_capital, invested_capital,
              days_sales_outstanding, days_payables_outstanding, days_of_inventory_on_hand, roe, capex_per_share)
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
					// Phase 2f: write per-table freshness timestamp
					await db.execute(sql`
              UPDATE listed_stocks
              SET last_key_metrics_sync = NOW(), updated_at = NOW()
              WHERE symbol = ${stock.symbol}
            `);
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
				console.error(`[Tier1:KeyMetrics] ${stock.symbol}: ${err.message}`);
			}
		}
	}
	tasks.keyMetrics = makeResult(
		"key_metrics",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_dcf_valuations sdv ON sdv.symbol = ss.symbol
      WHERE ss.is_active = true AND sdv.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${dcfBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getDCF(fmpSymbol);
				apiCalls++;
				if (data) {
					// Phase 2c: Compute and store upside_percent = (dcf - price) / price * 100
					const upsidePct = data.dcf != null && data.stockPrice != null && Number(data.stockPrice) > 0
						? +((Number(data.dcf) - Number(data.stockPrice)) / Number(data.stockPrice) * 100).toFixed(2)
						: null;
					await db.execute(sql`
            INSERT INTO screener_dcf_valuations (symbol, date, dcf, stock_price, upside_percent)
            VALUES (${stock.symbol}, ${data.date}, ${data.dcf}, ${data.stockPrice}, ${upsidePct})
            ON CONFLICT (symbol, date) DO UPDATE SET
              dcf = EXCLUDED.dcf, stock_price = EXCLUDED.stock_price,
              upside_percent = EXCLUDED.upside_percent, last_updated = NOW()
          `);
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
				console.error(`[Tier1:DCF] ${stock.symbol}: ${err.message}`);
			}
		}
	}
	tasks.dcf = makeResult(
		"dcf_valuations",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_company_ratings scr ON scr.symbol = ss.symbol
      WHERE ss.is_active = true AND scr.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${ratingBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getRating(fmpSymbol);
				apiCalls++;
				if (data) {
					await db.execute(sql`
            INSERT INTO screener_company_ratings (symbol, date, rating, rating_score, rating_recommendation,
              rating_details_dcf_score, rating_details_dcf_recommendation,
              rating_details_roe_score, rating_details_roe_recommendation,
              rating_details_roa_score, rating_details_roa_recommendation,
              rating_details_de_score, rating_details_de_recommendation,
              rating_details_pe_score, rating_details_pe_recommendation,
              rating_details_pb_score, rating_details_pb_recommendation)
            VALUES (${stock.symbol}, ${data.date}, ${data.rating}, ${data.ratingScore}, ${data.ratingRecommendation},
              ${data.ratingDetailsDCFScore}, ${data.ratingDetailsDCFRecommendation},
              ${data.ratingDetailsROEScore}, ${data.ratingDetailsROERecommendation},
              ${data.ratingDetailsROAScore}, ${data.ratingDetailsROARecommendation},
              ${data.ratingDetailsDEScore}, ${data.ratingDetailsDERecommendation},
              ${data.ratingDetailsPEScore}, ${data.ratingDetailsPERecommendation},
              ${data.ratingDetailsPBScore}, ${data.ratingDetailsPBRecommendation})
            ON CONFLICT DO NOTHING
          `);
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
				console.error(`[Tier1:Rating] ${stock.symbol}: ${err.message}`);
			}
		}
	}
	tasks.ratings = makeResult(
		"company_ratings",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	return { tier: "tier1", tasks, totalApiCalls };
}

export async function enrichTier2(budget: number): Promise<TierResult> {
	const provider = getExtendedProvider();
	const tasks: Record<string, EnrichmentResult> = {};
	let totalApiCalls = 0;

	const targetsBudget = Math.floor(budget * 0.25);
	const gradesBudget = Math.floor(budget * 0.2);
	const earningsBudget = Math.floor(budget * 0.15);
	const dividendBudget = Math.floor(budget * 0.1);
	const splitBudget = Math.floor(budget * 0.05);
	const ipoBudget = Math.floor(budget * 0.1);
	const econBudget =
		budget -
		targetsBudget -
		gradesBudget -
		earningsBudget -
		dividendBudget -
		splitBudget -
		ipoBudget;

	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_analyst_targets sat ON sat.symbol = ss.symbol
      WHERE ss.is_active = true AND sat.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${targetsBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getPriceTarget(fmpSymbol);
				apiCalls++;
				if (data.length > 0) {
					for (const t of data.slice(0, 5)) {
						await db.execute(sql`
              INSERT INTO screener_analyst_targets (symbol, published_date, analyst_name, analyst_company,
                price_target, adj_price_target, price_when_posted, news_url, news_title, news_publisher)
              VALUES (${stock.symbol}, ${t.publishedDate}, ${t.analystName}, ${t.analystCompany},
                ${t.priceTarget}, ${t.adjPriceTarget}, ${t.priceWhenPosted},
                ${t.newsURL || t.newsUrl}, ${t.newsTitle}, ${t.newsPublisher})
              ON CONFLICT DO NOTHING
            `);
					}
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
			}
		}
	}
	tasks.analystTargets = makeResult(
		"analyst_targets",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	// Phase 2d: Rebuild analyst_consensus materialized table for all processed symbols
	try {
		await db.execute(sql`
      INSERT INTO screener_analyst_consensus
        (symbol, avg_target, high_target, low_target, analyst_count,
         buy_count, hold_count, sell_count, consensus_rating, upside_pct, last_updated)
      SELECT
        sat.symbol,
        ROUND(AVG(sat.price_target::numeric), 2)   AS avg_target,
        ROUND(MAX(sat.price_target::numeric), 2)   AS high_target,
        ROUND(MIN(sat.price_target::numeric), 2)   AS low_target,
        COUNT(*)                                   AS analyst_count,
        COUNT(*) FILTER (WHERE LOWER(sat.analyst_company) LIKE '%buy%' OR LOWER(sat.news_title) LIKE '%buy%')  AS buy_count,
        COUNT(*) FILTER (WHERE LOWER(sat.news_title) LIKE '%hold%' OR LOWER(sat.news_title) LIKE '%neutral%')  AS hold_count,
        COUNT(*) FILTER (WHERE LOWER(sat.news_title) LIKE '%sell%' OR LOWER(sat.news_title) LIKE '%underper%') AS sell_count,
        CASE
          WHEN AVG(sat.price_target::numeric) > MAX(ss.current_price::numeric) * 1.20 THEN 'Strong Buy'
          WHEN AVG(sat.price_target::numeric) > MAX(ss.current_price::numeric) * 1.05 THEN 'Buy'
          WHEN AVG(sat.price_target::numeric) > MAX(ss.current_price::numeric) * 0.95 THEN 'Hold'
          ELSE 'Sell'
        END AS consensus_rating,
        ROUND(
          (AVG(sat.price_target::numeric) - MAX(ss.current_price::numeric))
          / NULLIF(MAX(ss.current_price::numeric), 0) * 100,
          2
        ) AS upside_pct,
        NOW() AS last_updated
      FROM screener_analyst_targets sat
      INNER JOIN screener_stocks ss ON ss.symbol = sat.symbol
      WHERE sat.price_target IS NOT NULL AND sat.price_target::numeric > 0
      GROUP BY sat.symbol
      ON CONFLICT (symbol) DO UPDATE SET
        avg_target      = EXCLUDED.avg_target,
        high_target     = EXCLUDED.high_target,
        low_target      = EXCLUDED.low_target,
        analyst_count   = EXCLUDED.analyst_count,
        buy_count       = EXCLUDED.buy_count,
        hold_count      = EXCLUDED.hold_count,
        sell_count      = EXCLUDED.sell_count,
        consensus_rating = EXCLUDED.consensus_rating,
        upside_pct      = EXCLUDED.upside_pct,
        last_updated    = NOW()
    `);
		console.log("[Tier2] Analyst consensus materialized table rebuilt");
	} catch (consensusErr: any) {
		console.warn("[Tier2] Analyst consensus rebuild failed (non-fatal):", consensusErr?.message?.slice(0, 100));
	}

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_analyst_grades sag ON sag.symbol = ss.symbol
      WHERE ss.is_active = true AND sag.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${gradesBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getUpgradesDowngrades(fmpSymbol);
				apiCalls++;
				if (data.length > 0) {
					for (const g of data.slice(0, 10)) {
						await db.execute(sql`
              INSERT INTO screener_analyst_grades (symbol, published_date, grading_company, previous_grade, new_grade, action, price_when_posted)
              VALUES (${stock.symbol}, ${g.publishedDate}, ${g.gradingCompany}, ${g.previousGrade}, ${g.newGrade}, ${g.action}, ${g.priceWhenPosted})
              ON CONFLICT DO NOTHING
            `);
					}
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
			}
		}
	}
	tasks.analystGrades = makeResult(
		"analyst_grades",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if ((await canContinue()) && earningsBudget > 0) {
		try {
			const today = new Date().toISOString().split("T")[0];
			const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			const data = await provider.getEarningsCalendar(today, threeMonthsLater);
			apiCalls++;
			for (const e of data) {
				await db.execute(sql`
          INSERT INTO screener_earnings_calendar (symbol, date, eps_estimated, eps_actual, revenue_estimated, revenue_actual, fiscal_date_ending)
          VALUES (${e.symbol}, ${e.date}, ${e.epsEstimated}, ${e.epsActual}, ${e.revenueEstimated}, ${e.revenueActual}, ${e.fiscalDateEnding})
          ON CONFLICT DO NOTHING
        `);
				processed++;
			}
		} catch (err: any) {
			errors++;
		}
	}
	tasks.earningsCalendar = makeResult(
		"earnings_calendar",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if ((await canContinue()) && dividendBudget > 0) {
		try {
			const today = new Date().toISOString().split("T")[0];
			const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			const data = await provider.getDividendCalendar(today, threeMonthsLater);
			apiCalls++;
			for (const d of data) {
				await db.execute(sql`
          INSERT INTO screener_dividend_calendar (symbol, date, label, adj_dividend, dividend, record_date, payment_date, declaration_date)
          VALUES (${d.symbol}, ${d.date}, ${d.label}, ${d.adjDividend}, ${d.dividend}, ${d.recordDate}, ${d.paymentDate}, ${d.declarationDate})
          ON CONFLICT DO NOTHING
        `);
				processed++;
			}
		} catch (err: any) {
			errors++;
		}
	}
	tasks.dividendCalendar = makeResult(
		"dividend_calendar",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if ((await canContinue()) && splitBudget > 0) {
		try {
			const today = new Date().toISOString().split("T")[0];
			const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			const data = await provider.getSplitCalendar(today, threeMonthsLater);
			apiCalls++;
			for (const s of data) {
				await db.execute(sql`
          INSERT INTO screener_split_calendar (symbol, date, label, numerator, denominator)
          VALUES (${s.symbol}, ${s.date}, ${s.label}, ${s.numerator}, ${s.denominator})
          ON CONFLICT DO NOTHING
        `);
				processed++;
			}
		} catch (err: any) {
			errors++;
		}
	}
	tasks.splitCalendar = makeResult(
		"split_calendar",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if ((await canContinue()) && ipoBudget > 0) {
		try {
			const today = new Date().toISOString().split("T")[0];
			const threeMonthsLater = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			const data = await provider.getIPOCalendar(today, threeMonthsLater);
			apiCalls++;
			for (const i of data) {
				await db.execute(sql`
          INSERT INTO screener_ipo_calendar (symbol, company, exchange, date, price_range, shares, market_cap, actions)
          VALUES (${i.symbol}, ${i.company}, ${i.exchange}, ${i.date}, ${i.priceRange}, ${i.shares}, ${i.marketCap}, ${i.actions})
          ON CONFLICT DO NOTHING
        `);
				processed++;
			}
		} catch (err: any) {
			errors++;
		}
	}
	tasks.ipoCalendar = makeResult(
		"ipo_calendar",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if ((await canContinue()) && econBudget > 0) {
		try {
			const today = new Date().toISOString().split("T")[0];
			const oneMonthLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split("T")[0];
			const data = await provider.getEconomicCalendar(today, oneMonthLater);
			apiCalls++;
			for (const e of data) {
				// Phase 3b: Only store High-impact events for key markets (IN, US, GB)
				if (!e.impact || e.impact !== 'High') continue;
				if (!['IN', 'US', 'GB', 'EU'].includes(e.country || '')) continue;
				await db.execute(sql`
          INSERT INTO screener_economic_calendar (event, date, country, actual, previous, change, change_percentage, estimate, impact)
          VALUES (${e.event}, ${e.date}, ${e.country}, ${e.actual}, ${e.previous}, ${e.change}, ${e.changePercentage}, ${e.estimate}, ${e.impact})
          ON CONFLICT DO NOTHING
        `);
				processed++;
			}
		} catch (err: any) {
			errors++;
		}
	}
	tasks.economicCalendar = makeResult(
		"economic_calendar",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	return { tier: "tier2", tasks, totalApiCalls };
}

export async function enrichTier3(budget: number): Promise<TierResult> {
	const provider = getExtendedProvider();
	const tasks: Record<string, EnrichmentResult> = {};
	let totalApiCalls = 0;

	const institutionalBudget = Math.floor(budget * 0.25);
	const insiderBudget = Math.floor(budget * 0.2);
	const newsBudget = Math.floor(budget * 0.2);
	const sectorBudget = Math.max(1, Math.floor(budget * 0.05));
	const technicalBudget =
		budget - institutionalBudget - insiderBudget - newsBudget - sectorBudget;

	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_institutional_holders sih ON sih.symbol = ss.symbol
      WHERE ss.is_active = true AND sih.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${institutionalBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getInstitutionalHolders(fmpSymbol);
				apiCalls++;
				if (data.length > 0) {
					for (const h of data.slice(0, 10)) {
						await db.execute(sql`
              INSERT INTO screener_institutional_holders (symbol, holder, shares, date_reported, change, weight_percent)
              VALUES (${stock.symbol}, ${h.holder}, ${h.shares}, ${h.dateReported}, ${h.change}, ${h.weightPercent})
              ON CONFLICT DO NOTHING
            `);
					}
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
			}
		}
	}
	tasks.institutionalHolders = makeResult(
		"institutional_holders",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_insider_trades sit ON sit.symbol = ss.symbol
      WHERE ss.is_active = true AND sit.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${insiderBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getInsiderTrading(fmpSymbol, 20);
				apiCalls++;
				if (data.length > 0) {
					for (const t of data.slice(0, 10)) {
						await db.execute(sql`
              INSERT INTO screener_insider_trades (symbol, filing_date, transaction_date, reporting_name, transaction_type,
                securities_owned, securities_transacted, price, form_type, link)
              VALUES (${stock.symbol}, ${t.filingDate}, ${t.transactionDate}, ${t.reportingName || t.reportingCik},
                ${t.transactionType}, ${t.securitiesOwned}, ${t.securitiesTransacted}, ${t.price}, ${t.formType}, ${t.link})
              ON CONFLICT DO NOTHING
            `);
					}
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
			}
		}
	}
	tasks.insiderTrades = makeResult(
		"insider_trades",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_stock_news ssn ON ssn.symbol = ss.symbol
      WHERE ss.is_active = true AND ssn.id IS NULL
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${newsBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const data = await provider.getStockNews(fmpSymbol, 5);
				apiCalls++;
				if (data.length > 0) {
					for (const n of data.slice(0, 5)) {
						await db.execute(sql`
              INSERT INTO screener_stock_news (symbol, published_date, title, image, site, text, url)
              VALUES (${stock.symbol}, ${n.publishedDate}, ${n.title}, ${n.image}, ${n.site}, ${n.text}, ${n.url})
              ON CONFLICT DO NOTHING
            `);
					}
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
			}
		}
	}
	tasks.stockNews = makeResult(
		"stock_news",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		try {
			const data = await provider.getSectorPerformance();
			apiCalls++;
			const today = new Date().toISOString().split("T")[0];
			await db.execute(
				sql`DELETE FROM screener_sector_performance WHERE date = ${today}`,
			);
			for (const s of data) {
				await db.execute(sql`
          INSERT INTO screener_sector_performance (sector, changes_percentage, date)
          VALUES (${s.sector}, ${s.changesPercentage}, ${today})
          ON CONFLICT DO NOTHING
        `);
				processed++;
			}
		} catch (err: any) {
			errors++;
		}
	}
	tasks.sectorPerformance = makeResult(
		"sector_performance",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	processed = 0;
	errors = 0;
	skipped = 0;
	apiCalls = 0;
	if (await canContinue()) {
		const stocks = await db.execute(sql`
      SELECT ss.symbol, ss.fmp_symbol FROM listed_stocks ss
      LEFT JOIN screener_technical_indicators sti ON sti.symbol = ss.symbol
      WHERE ss.is_active = true AND sti.id IS NULL AND ss.exchange != 'UNLISTED'
      ORDER BY ss.market_cap_value::numeric DESC NULLS LAST
      LIMIT ${technicalBudget}
    `);
		const rows = (stocks as any).rows || stocks;
		for (const stock of rows) {
			if (!(await canContinue())) break;
			try {
				const fmpSymbol = stock.fmp_symbol || `${stock.symbol}.NS`;
				const rsiData = await provider.getTechnicalIndicator(
					fmpSymbol,
					"daily",
					"rsi",
					14,
				);
				apiCalls++;
				if (rsiData.length > 0) {
					const latest = rsiData[0];
					await db.execute(sql`
            INSERT INTO screener_technical_indicators (symbol, date, timeframe, open, high, low, close, volume, rsi_14)
            VALUES (${stock.symbol}, ${latest.date}, 'daily', ${latest.open}, ${latest.high}, ${latest.low}, ${latest.close}, ${latest.volume}, ${latest.rsi})
            ON CONFLICT DO NOTHING
          `);
					// Phase 2f: write per-table freshness timestamp
					await db.execute(sql`
              UPDATE listed_stocks
              SET last_technicals_sync = NOW(), updated_at = NOW()
              WHERE symbol = ${stock.symbol}
            `);
					// Hot-cold split (Phase 5b): keep the latest snapshot in the hot table
					await db.execute(sql`
              INSERT INTO screener_technical_indicators_latest
                (symbol, date, timeframe, open, high, low, close, volume, rsi_14)
              VALUES (${stock.symbol}, ${latest.date}, 'daily',
                ${latest.open}, ${latest.high}, ${latest.low}, ${latest.close}, ${latest.volume}, ${latest.rsi})
              ON CONFLICT (symbol) DO UPDATE SET
                date = EXCLUDED.date,
                timeframe = EXCLUDED.timeframe,
                open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
                close = EXCLUDED.close, volume = EXCLUDED.volume,
                rsi_14 = EXCLUDED.rsi_14,
                last_updated = NOW()
            `);
					processed++;
				} else {
					skipped++;
				}
			} catch (err: any) {
				errors++;
			}
		}
	}
	tasks.technicalIndicators = makeResult(
		"technical_indicators",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	return { tier: "tier3", tasks, totalApiCalls };
}

export async function enrichTier4(budget: number): Promise<TierResult> {
	const provider = getExtendedProvider();
	const tasks: Record<string, EnrichmentResult> = {};
	let totalApiCalls = 0;

	const pricesBudget = Math.floor(budget * 0.5);
	const marketDataBudget = budget - pricesBudget;

	tasks.priceHistory = await enrichPriceHistory(pricesBudget);
	totalApiCalls += tasks.priceHistory.apiCallsUsed;

	let processed = 0,
		errors = 0,
		skipped = 0,
		apiCalls = 0;
	if ((await canContinue()) && marketDataBudget > 0) {
		try {
			const data = await provider.getSectorPerformance();
			apiCalls++;
			processed = data.length;
		} catch (err: any) {
			errors++;
		}
	}
	tasks.marketData = makeResult(
		"market_data",
		processed,
		errors,
		skipped,
		apiCalls,
	);
	totalApiCalls += apiCalls;

	return { tier: "tier4", tasks, totalApiCalls };
}

export async function runPriorityEnrichmentBatch(
	budgetSplit: TierBudget = DEFAULT_BUDGET_SPLIT,
	maxApiCalls = 240,
): Promise<PriorityBatchResult> {
	const initialStats = await fmpUsageMonitor.getDailyStats();
	const availableCalls = Math.min(maxApiCalls, initialStats.remaining);

	const allocation: TierBudget = {
		tier1: Math.floor(availableCalls * budgetSplit.tier1),
		tier2: Math.floor(availableCalls * budgetSplit.tier2),
		tier3: Math.floor(availableCalls * budgetSplit.tier3),
		tier4:
			availableCalls -
			Math.floor(availableCalls * budgetSplit.tier1) -
			Math.floor(availableCalls * budgetSplit.tier2) -
			Math.floor(availableCalls * budgetSplit.tier3),
	};

	console.log(
		`[PriorityScheduler] Starting with ${availableCalls} calls. T1=${allocation.tier1} T2=${allocation.tier2} T3=${allocation.tier3} T4=${allocation.tier4}`,
	);

	const tiers: TierResult[] = [];

	const t1 = await enrichTier1(allocation.tier1);
	tiers.push(t1);
	console.log(`[PriorityScheduler] Tier1 done: ${t1.totalApiCalls} calls used`);

	if (await canContinue()) {
		const t2 = await enrichTier2(allocation.tier2);
		tiers.push(t2);
		console.log(
			`[PriorityScheduler] Tier2 done: ${t2.totalApiCalls} calls used`,
		);
	}

	if (await canContinue()) {
		const t3 = await enrichTier3(allocation.tier3);
		tiers.push(t3);
		console.log(
			`[PriorityScheduler] Tier3 done: ${t3.totalApiCalls} calls used`,
		);
	}

	if (await canContinue()) {
		const t4 = await enrichTier4(allocation.tier4);
		tiers.push(t4);
		console.log(
			`[PriorityScheduler] Tier4 done: ${t4.totalApiCalls} calls used`,
		);
	}

	const totalApiCalls = tiers.reduce((sum, t) => sum + t.totalApiCalls, 0);
	const finalStats = await fmpUsageMonitor.getDailyStats();

	console.log(
		`[PriorityScheduler] Complete: ${totalApiCalls} total API calls. Remaining: ${finalStats.remaining}`,
	);

	return {
		tiers,
		totalApiCalls,
		remaining: finalStats.remaining,
		budgetAllocation: allocation,
	};
}

export async function getExtendedEnrichmentProgress(): Promise<{
	progress: {
		total: number;
		withRatios: number;
		withReturns: number;
		withGrowth: number;
		withKeyMetrics: number;
		withDCF: number;
		withRatings: number;
		withAnalystTargets: number;
		withAnalystGrades: number;
		withInstitutionalHolders: number;
		withInsiderTrades: number;
		withNews: number;
		withTechnicals: number;
		enrichmentPercent: number;
		estimatedDaysRemaining: number;
	};
	calendars: {
		earningsCount: number;
		dividendCount: number;
		splitCount: number;
		ipoCount: number;
		economicCount: number;
	};
	tiers: {
		tier1Percent: number;
		tier2Percent: number;
		tier3Percent: number;
		tier4Percent: number;
	};
	// Phase 2f/4d: per-table freshness coverage (synced within 30 days)
	freshness: {
		financials:   { synced: number; stale: number; coveragePct: number };
		keyMetrics:   { synced: number; stale: number; coveragePct: number };
		technicals:   { synced: number; stale: number; coveragePct: number };
		shareholding: { synced: number; stale: number; coveragePct: number };
	};
}> {
	const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true) as total,
      (SELECT COUNT(DISTINCT symbol) FROM screener_financials WHERE roe IS NOT NULL OR pb_ratio IS NOT NULL) as with_ratios,
      (SELECT COUNT(DISTINCT symbol) FROM screener_financials WHERE return_1y IS NOT NULL) as with_returns,
      (SELECT COUNT(DISTINCT symbol) FROM screener_growth_metrics) as with_growth,
      (SELECT COUNT(DISTINCT symbol) FROM screener_key_metrics) as with_key_metrics,
      (SELECT COUNT(DISTINCT symbol) FROM screener_dcf_valuations) as with_dcf,
      (SELECT COUNT(DISTINCT symbol) FROM screener_company_ratings) as with_ratings,
      (SELECT COUNT(DISTINCT symbol) FROM screener_analyst_targets) as with_analyst_targets,
      (SELECT COUNT(DISTINCT symbol) FROM screener_analyst_grades) as with_analyst_grades,
      (SELECT COUNT(DISTINCT symbol) FROM screener_institutional_holders) as with_institutional,
      (SELECT COUNT(DISTINCT symbol) FROM screener_insider_trades) as with_insider,
      (SELECT COUNT(DISTINCT symbol) FROM screener_stock_news) as with_news,
      (SELECT COUNT(DISTINCT symbol) FROM screener_technical_indicators) as with_technicals,
      (SELECT COUNT(*) FROM screener_earnings_calendar) as earnings_count,
      (SELECT COUNT(*) FROM screener_dividend_calendar) as dividend_count,
      (SELECT COUNT(*) FROM screener_split_calendar) as split_count,
      (SELECT COUNT(*) FROM screener_ipo_calendar) as ipo_count,
      (SELECT COUNT(*) FROM screener_economic_calendar) as economic_count,
      -- Phase 2f/4d: per-table freshness
      -- Use last_*_sync timestamps when available; fall back to satellite table row counts
      -- (last_*_sync is NULL for stocks seeded via NSE/BSE before FMP enrichment ran)
      GREATEST(
        (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_financials_sync > NOW() - INTERVAL '30 days'),
        (SELECT COUNT(DISTINCT symbol) FROM screener_financials)
      ) as fin_synced,
      GREATEST(
        (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_key_metrics_sync > NOW() - INTERVAL '30 days'),
        (SELECT COUNT(DISTINCT symbol) FROM screener_key_metrics)
      ) as km_synced,
      GREATEST(
        (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_technicals_sync > NOW() - INTERVAL '30 days'),
        (SELECT COUNT(DISTINCT symbol) FROM screener_technical_indicators)
      ) as tech_synced,
      GREATEST(
        (SELECT COUNT(*) FROM listed_stocks WHERE is_active = true AND last_shareholding_sync > NOW() - INTERVAL '30 days'),
        (SELECT COUNT(DISTINCT symbol) FROM screener_institutional_holders)
      ) as sh_synced
  `);

	const row = ((result as any).rows || result)[0];
	const total = Number(row.total) || 1;

	const withRatios = Number(row.with_ratios);
	const withReturns = Number(row.with_returns);
	const withGrowth = Number(row.with_growth);
	const withKeyMetrics = Number(row.with_key_metrics);
	const withDCF = Number(row.with_dcf);
	const withRatings = Number(row.with_ratings);
	const withAnalystTargets = Number(row.with_analyst_targets);
	const withAnalystGrades = Number(row.with_analyst_grades);
	const withInstitutional = Number(row.with_institutional);
	const withInsider = Number(row.with_insider);
	const withNews = Number(row.with_news);
	const withTechnicals = Number(row.with_technicals);

	const tier1Metrics = [
		withRatios,
		withReturns,
		withGrowth,
		withKeyMetrics,
		withDCF,
		withRatings,
	];
	const tier1Percent = Math.round(
		(tier1Metrics.reduce((a, b) => a + b, 0) / (total * tier1Metrics.length)) *
			100,
	);

	const tier2Percent = Math.round(
		((withAnalystTargets + withAnalystGrades) / (total * 2)) * 100,
	);
	const tier3Percent = Math.round(
		((withInstitutional + withInsider + withNews + withTechnicals) /
			(total * 4)) *
			100,
	);
	const tier4Percent = Math.round((withReturns / total) * 100);

	const overallPercent = Math.round(
		tier1Percent * 0.4 +
			tier2Percent * 0.3 +
			tier3Percent * 0.2 +
			tier4Percent * 0.1,
	);
	const totalMissing =
		total * 6 -
		tier1Metrics.reduce((a, b) => a + b, 0) +
		(total * 2 - withAnalystTargets - withAnalystGrades) +
		(total * 4 - withInstitutional - withInsider - withNews - withTechnicals);
	const estimatedDaysRemaining = Math.ceil(totalMissing / 240);

	return {
		progress: {
			total,
			withRatios,
			withReturns,
			withGrowth,
			withKeyMetrics,
			withDCF,
			withRatings,
			withAnalystTargets,
			withAnalystGrades,
			withInstitutionalHolders: withInstitutional,
			withInsiderTrades: withInsider,
			withNews,
			withTechnicals,
			enrichmentPercent: overallPercent,
			estimatedDaysRemaining,
		},
		calendars: {
			earningsCount: Number(row.earnings_count),
			dividendCount: Number(row.dividend_count),
			splitCount: Number(row.split_count),
			ipoCount: Number(row.ipo_count),
			economicCount: Number(row.economic_count),
		},
		tiers: {
			tier1Percent,
			tier2Percent,
			tier3Percent,
			tier4Percent,
		},
		freshness: {
			financials:   { synced: Number(row.fin_synced),  stale: total - Number(row.fin_synced),  coveragePct: Math.round((Number(row.fin_synced)  / total) * 100) },
			keyMetrics:   { synced: Number(row.km_synced),   stale: total - Number(row.km_synced),   coveragePct: Math.round((Number(row.km_synced)   / total) * 100) },
			technicals:   { synced: Number(row.tech_synced), stale: total - Number(row.tech_synced), coveragePct: Math.round((Number(row.tech_synced) / total) * 100) },
			shareholding: { synced: Number(row.sh_synced),   stale: total - Number(row.sh_synced),   coveragePct: Math.round((Number(row.sh_synced)   / total) * 100) },
		},
	};
}

export async function enrichSingleTier(
	tierNumber: 1 | 2 | 3 | 4,
	budget = 50,
): Promise<TierResult> {
	switch (tierNumber) {
		case 1:
			return enrichTier1(budget);
		case 2:
			return enrichTier2(budget);
		case 3:
			return enrichTier3(budget);
		case 4:
			return enrichTier4(budget);
		default:
			throw new Error(`Invalid tier: ${tierNumber}`);
	}
}
