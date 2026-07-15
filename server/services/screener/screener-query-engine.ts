import { db } from "../../db";
import {
	listedStocks,
	screenerFinancials,
	screenerDerivedMetrics,
	screenerKeyMetrics,
	screenerTechnicalIndicatorsLatest,
	screenerShareholding,
	screenerAnalystConsensus,
	screenerDcfValuations,
} from "@shared/schema";
import {
	eq,
	and,
	gte,
	lte,
	sql,
	desc,
	asc,
	or,
	ilike,
	isNotNull,
} from "drizzle-orm";

export interface ScreenerFilters {
	// ── Universe filters ────────────────────────────────────────────────────────
	sector?: string;
	industry?: string;
	marketCapCategory?: string;
	exchange?: string;
	index?: string;            // 'NIFTY50' | 'NIFTY100' | 'NIFTY500' | 'SENSEX'
	search?: string;

	// ── Fundamental filters (from screener_financials) ────────────────────────
	minPE?: number;
	maxPE?: number;
	minPB?: number;
	maxPB?: number;
	minROE?: number;
	maxROE?: number;
	minROCE?: number;
	maxROCE?: number;
	minDebtToEquity?: number;
	maxDebtToEquity?: number;
	minDividendYield?: number;
	maxDividendYield?: number;
	minCurrentRatio?: number;
	maxCurrentRatio?: number;
	minEPS?: number;

	// ── Scoring filters (from screener_derived_metrics) ───────────────────────
	minCompositeScore?: number;
	maxCompositeScore?: number;
	minFintekRating?: number;
	minPiotroski?: number;     // 0-9; e.g. minPiotroski=7 → quality stocks
	maxPiotroski?: number;
	technicalRating?: string;  // 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell'

	// ── Return filters (computed nightly from OHLCV history) ──────────────────
	minReturn1W?: number;      // decimal (0.05 = +5%)
	maxReturn1W?: number;
	minReturn1M?: number;
	maxReturn1M?: number;
	minReturn3M?: number;
	maxReturn3M?: number;
	minReturn6M?: number;
	maxReturn6M?: number;
	minReturn1Y?: number;
	maxReturn1Y?: number;
	minReturnYTD?: number;
	maxReturnYTD?: number;

	// ── Risk filters (from screener_derived_metrics) ──────────────────────────
	minBeta?: number;
	maxBeta?: number;
	minSharpe?: number;
	maxDrawdown?: number;      // e.g. maxDrawdown=-0.20 → max 20% drawdown in 1Y

	// ── Technical filters (from screener_technical_indicators) ───────────────
	minRSI?: number;           // e.g. minRSI=30 maxRSI=50 → RSI in buy zone
	maxRSI?: number;

	// ── Shareholding filters (from screener_shareholding) ────────────────────
	minPromoterHolding?: number;  // % e.g. 50 = 50%
	maxPromoterHolding?: number;
	minFIIHolding?: number;
	maxFIIHolding?: number;
	minDIIHolding?: number;
	maxPledged?: number;          // max pledged % of promoter shares

	// ── Pagination & sort ────────────────────────────────────────────────────
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	page?: number;
	limit?: number;
}

export interface ScreenerResult {
	// Core
	symbol: string;
	companyName: string;
	sector: string | null;
	industry: string | null;
	exchange: string | null;
	currentPrice: string | null;
	marketCapValue: string | null;
	marketCapCategory: string | null;

	// Fundamentals
	peRatio: string | null;
	forwardPe: string | null;
	pegRatio: string | null;
	pbRatio: string | null;
	roe: string | null;
	roce: string | null;
	debtToEquity: string | null;
	dividendYield: string | null;
	eps: string | null;
	netProfitMargin: string | null;

	// Returns (from derived metrics — computed from OHLCV)
	return1W: string | null;
	return1M: string | null;
	return3M: string | null;
	return6M: string | null;
	return1Y: string | null;
	return2Y: string | null;
	return3Y: string | null;
	return5Y: string | null;
	returnYTD: string | null;

	// Risk
	beta: string | null;
	sharpeRatio1Y: string | null;
	maxDrawdown1Y: string | null;

	// Alpha (vs benchmark)
	returnVsNifty1Y: string | null;   // Stock 1Y return minus Nifty 1Y return
	returnVsSector1Y: string | null;  // Stock 1Y return minus sector index 1Y return

	// Analyst Consensus (from screener_analyst_consensus)
	analystAvgTarget: string | null;
	analystUpsidePct: string | null;
	analystConsensusRating: string | null;
	analystCount: number | null;

	// DCF
	dcfUpsidePercent: string | null;  // (dcf - price) / price * 100

	// Scoring
	compositeScore: string | null;
	fintekRating: number | null;
	growthScore: string | null;
	qualityScore: string | null;
	valueScore: string | null;
	riskScore: string | null;
	piotroskiScore: number | null;
	altmanZScore: string | null;
	technicalRating: string | null;

	// 52W Range
	weekHigh52: string | null;
	weekLow52: string | null;
}

export interface ScreenerResponse {
	stocks: ScreenerResult[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
	filters: {
		sectors: string[];
		industries: string[];
		marketCapCategories: string[];
		technicalRatings: string[];
	};
}

export async function queryScreener(
	filters: ScreenerFilters,
): Promise<ScreenerResponse> {
	const page = filters.page || 1;
	const limit = Math.min(filters.limit || 25, 100);
	const offset = (page - 1) * limit;

	const conditions: any[] = [eq(listedStocks.isActive, true)];

	if (filters.sector)
		conditions.push(eq(listedStocks.sector, filters.sector));
	if (filters.industry)
		conditions.push(eq(listedStocks.industry, filters.industry));
	if (filters.marketCapCategory)
		conditions.push(
			eq(listedStocks.marketCapCategory, filters.marketCapCategory),
		);
	if (filters.exchange)
		conditions.push(eq(listedStocks.exchange, filters.exchange));

	if (filters.search) {
		conditions.push(
			or(
				ilike(listedStocks.symbol, `%${filters.search}%`),
				ilike(listedStocks.companyName, `%${filters.search}%`),
			),
		);
	}

	const financialConditions: any[] = [];
	if (filters.minPE != null)
		financialConditions.push(
			gte(screenerFinancials.peRatio, filters.minPE.toString()),
		);
	if (filters.maxPE != null)
		financialConditions.push(
			lte(screenerFinancials.peRatio, filters.maxPE.toString()),
		);
	if (filters.minPB != null)
		financialConditions.push(
			gte(screenerFinancials.pbRatio, filters.minPB.toString()),
		);
	if (filters.maxPB != null)
		financialConditions.push(
			lte(screenerFinancials.pbRatio, filters.maxPB.toString()),
		);
	if (filters.minROE != null)
		financialConditions.push(
			gte(screenerFinancials.roe, filters.minROE.toString()),
		);
	if (filters.maxROE != null)
		financialConditions.push(
			lte(screenerFinancials.roe, filters.maxROE.toString()),
		);
	if (filters.minDebtToEquity != null)
		financialConditions.push(
			gte(screenerFinancials.debtToEquity, filters.minDebtToEquity.toString()),
		);
	if (filters.maxDebtToEquity != null)
		financialConditions.push(
			lte(screenerFinancials.debtToEquity, filters.maxDebtToEquity.toString()),
		);
	if (filters.minDividendYield != null)
		financialConditions.push(
			gte(
				screenerFinancials.dividendYield,
				filters.minDividendYield.toString(),
			),
		);
	if (filters.maxDividendYield != null)
		financialConditions.push(
			lte(
				screenerFinancials.dividendYield,
				filters.maxDividendYield.toString(),
			),
		);

	// Derived metric conditions (returns, risk, quality scores)
	const derivedConditions: any[] = [];
	if (filters.minCompositeScore != null)
		derivedConditions.push(gte(screenerDerivedMetrics.compositeScore, filters.minCompositeScore.toString()));
	if (filters.maxCompositeScore != null)
		derivedConditions.push(lte(screenerDerivedMetrics.compositeScore, filters.maxCompositeScore.toString()));
	if (filters.minFintekRating != null)
		derivedConditions.push(gte(screenerDerivedMetrics.fintekRating, filters.minFintekRating));
	if (filters.minPiotroski != null)
		derivedConditions.push(gte(screenerDerivedMetrics.piotroskiScore, filters.minPiotroski));
	if (filters.maxPiotroski != null)
		derivedConditions.push(lte(screenerDerivedMetrics.piotroskiScore, filters.maxPiotroski));
	if (filters.technicalRating)
		derivedConditions.push(eq(screenerDerivedMetrics.technicalRating, filters.technicalRating));
	// Return filters — all from derived_metrics, recalculated nightly
	if (filters.minReturn1W != null) derivedConditions.push(gte(screenerDerivedMetrics.return1W, filters.minReturn1W.toString()));
	if (filters.maxReturn1W != null) derivedConditions.push(lte(screenerDerivedMetrics.return1W, filters.maxReturn1W.toString()));
	if (filters.minReturn1M != null) derivedConditions.push(gte(screenerDerivedMetrics.return1M, filters.minReturn1M.toString()));
	if (filters.maxReturn1M != null) derivedConditions.push(lte(screenerDerivedMetrics.return1M, filters.maxReturn1M.toString()));
	if (filters.minReturn3M != null) derivedConditions.push(gte(screenerDerivedMetrics.return3M, filters.minReturn3M.toString()));
	if (filters.maxReturn3M != null) derivedConditions.push(lte(screenerDerivedMetrics.return3M, filters.maxReturn3M.toString()));
	if (filters.minReturn6M != null) derivedConditions.push(gte(screenerDerivedMetrics.return6M, filters.minReturn6M.toString()));
	if (filters.maxReturn6M != null) derivedConditions.push(lte(screenerDerivedMetrics.return6M, filters.maxReturn6M.toString()));
	if (filters.minReturn1Y != null) derivedConditions.push(gte(screenerDerivedMetrics.return1Y, filters.minReturn1Y.toString()));
	if (filters.maxReturn1Y != null) derivedConditions.push(lte(screenerDerivedMetrics.return1Y, filters.maxReturn1Y.toString()));
	if (filters.minReturnYTD != null) derivedConditions.push(gte(screenerDerivedMetrics.returnYTD, filters.minReturnYTD.toString()));
	// Risk filters
	if (filters.minBeta != null) derivedConditions.push(gte(screenerDerivedMetrics.beta, filters.minBeta.toString()));
	if (filters.maxBeta != null) derivedConditions.push(lte(screenerDerivedMetrics.beta, filters.maxBeta.toString()));
	if (filters.minSharpe != null) derivedConditions.push(gte(screenerDerivedMetrics.sharpeRatio1Y, filters.minSharpe.toString()));
	if (filters.maxDrawdown != null) derivedConditions.push(gte(screenerDerivedMetrics.maxDrawdown1Y, filters.maxDrawdown.toString()));

	// Technical indicator conditions (query engine reads from hot table)
	const technicalConditions: any[] = [];
	if (filters.minRSI != null) technicalConditions.push(gte(screenerTechnicalIndicatorsLatest.rsi14, filters.minRSI.toString()));
	if (filters.maxRSI != null) technicalConditions.push(lte(screenerTechnicalIndicatorsLatest.rsi14, filters.maxRSI.toString()));

	// Shareholding conditions
	const shareholdingConditions: any[] = [];
	if (filters.minPromoterHolding != null) shareholdingConditions.push(gte(screenerShareholding.promoterHolding, filters.minPromoterHolding.toString()));
	if (filters.maxPromoterHolding != null) shareholdingConditions.push(lte(screenerShareholding.promoterHolding, filters.maxPromoterHolding.toString()));
	if (filters.minFIIHolding != null) shareholdingConditions.push(gte(screenerShareholding.fiiHolding, filters.minFIIHolding.toString()));
	if (filters.maxFIIHolding != null) shareholdingConditions.push(lte(screenerShareholding.fiiHolding, filters.maxFIIHolding.toString()));
	if (filters.minDIIHolding != null) shareholdingConditions.push(gte(screenerShareholding.diiHolding, filters.minDIIHolding.toString()));
	if (filters.maxPledged != null) shareholdingConditions.push(lte(screenerShareholding.pledgedShares, filters.maxPledged.toString()));

	const hasFinancialFilters = financialConditions.length > 0;
	const hasDerivedFilters = derivedConditions.length > 0;
	const hasTechnicalFilters = technicalConditions.length > 0;
	const hasShareholdingFilters = shareholdingConditions.length > 0;

	// ── Sort ─────────────────────────────────────────────────────────────────
	// Default: compositeScore DESC NULLS LAST — enriched stocks surface first.
	// Using raw sql() for all columns so we can enforce NULLS LAST (PostgreSQL
	// defaults to NULLS FIRST on DESC, which pushes unenriched stocks to top).
	type SortDir = "ASC" | "DESC";
	const dir: SortDir = filters.sortOrder === "asc" ? "ASC" : "DESC";

	let sortExpr: ReturnType<typeof sql>;

	switch (filters.sortBy) {
		case "companyName":
			sortExpr = sql`${listedStocks.companyName} ${sql.raw(dir)} NULLS LAST`; break;
		case "currentPrice":
			sortExpr = sql`${listedStocks.currentPrice}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "marketCap":
			// Prefer nightly-enriched key-metrics market cap; fall back to listed_stocks value
			sortExpr = sql`COALESCE(${screenerKeyMetrics.marketCap}, ${listedStocks.marketCapValue})::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "peRatio":
			sortExpr = sql`${screenerFinancials.peRatio}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "forwardPe":
			sortExpr = sql`${screenerFinancials.forwardPe}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "pegRatio":
			sortExpr = sql`${screenerFinancials.pegRatio}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "roe":
			sortExpr = sql`${screenerFinancials.roe}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "fintekRating":
			sortExpr = sql`${screenerDerivedMetrics.fintekRating} ${sql.raw(dir)} NULLS LAST`; break;
		case "return1Y":
			sortExpr = sql`${screenerDerivedMetrics.return1Y}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "return1M":
			sortExpr = sql`${screenerDerivedMetrics.return1M}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "return3M":
			sortExpr = sql`${screenerDerivedMetrics.return3M}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "returnVsNifty1Y":
			sortExpr = sql`${screenerDerivedMetrics.returnVsNifty1Y}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "analystUpside":
			sortExpr = sql`${screenerAnalystConsensus.upsidePct}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "dcfUpside":
			sortExpr = sql`${screenerDcfValuations.upsidePercent}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "beta":
			sortExpr = sql`${screenerDerivedMetrics.beta}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "sharpe":
			sortExpr = sql`${screenerDerivedMetrics.sharpeRatio1Y}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "piotroski":
			sortExpr = sql`${screenerDerivedMetrics.piotroskiScore} ${sql.raw(dir)} NULLS LAST`; break;
		case "rsi":
			sortExpr = sql`${screenerTechnicalIndicatorsLatest.rsi14}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "promoterHolding":
			sortExpr = sql`${screenerShareholding.promoterHolding}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		default:
			// Default: richest data first — compositeScore DESC NULLS LAST
			sortExpr = sql`${screenerDerivedMetrics.compositeScore}::numeric DESC NULLS LAST`;
	}

	const baseQuery = db
		.select({
			// Core
			symbol: listedStocks.symbol,
			companyName: listedStocks.companyName,
			sector: listedStocks.sector,
			industry: listedStocks.industry,
			exchange: listedStocks.exchange,
			currentPrice: listedStocks.currentPrice,
			// Market cap: prefer nightly-enriched key-metrics value; fall back to listed_stocks (set on INSERT only)
			marketCapValue: sql<string>`COALESCE(${screenerKeyMetrics.marketCap}, ${listedStocks.marketCapValue})`,
			marketCapCategory: listedStocks.marketCapCategory,
			// Fundamentals
			peRatio: screenerFinancials.peRatio,
			forwardPe: screenerFinancials.forwardPe,
			pegRatio: screenerFinancials.pegRatio,
			pbRatio: screenerFinancials.pbRatio,
			roe: screenerFinancials.roe,
			roce: screenerFinancials.roce,
			debtToEquity: screenerFinancials.debtToEquity,
			dividendYield: screenerFinancials.dividendYield,
			eps: screenerFinancials.eps,
			netProfitMargin: screenerFinancials.netProfitMargin,
			// Returns (from derived metrics — computed from OHLCV)
			return1W: screenerDerivedMetrics.return1W,
			return1M: screenerDerivedMetrics.return1M,
			return3M: screenerDerivedMetrics.return3M,
			return6M: screenerDerivedMetrics.return6M,
			return1Y: screenerDerivedMetrics.return1Y,
			return2Y: screenerDerivedMetrics.return2Y,
			return3Y: screenerDerivedMetrics.return3Y,
			return5Y: screenerDerivedMetrics.return5Y,
			returnYTD: screenerDerivedMetrics.returnYTD,
			// Risk
			beta: screenerDerivedMetrics.beta,
			sharpeRatio1Y: screenerDerivedMetrics.sharpeRatio1Y,
			maxDrawdown1Y: screenerDerivedMetrics.maxDrawdown1Y,
			// Alpha vs benchmarks (Phase 4a)
			returnVsNifty1Y: screenerDerivedMetrics.returnVsNifty1Y,
			returnVsSector1Y: screenerDerivedMetrics.returnVsSector1Y,
			// Analyst Consensus (Phase 4b)
			analystAvgTarget: screenerAnalystConsensus.avgTarget,
			analystUpsidePct: screenerAnalystConsensus.upsidePct,
			analystConsensusRating: screenerAnalystConsensus.consensusRating,
			analystCount: screenerAnalystConsensus.analystCount,
			// DCF Upside (Phase 4c)
			dcfUpsidePercent: screenerDcfValuations.upsidePercent,
			// Scoring
			compositeScore: screenerDerivedMetrics.compositeScore,
			fintekRating: screenerDerivedMetrics.fintekRating,
			growthScore: screenerDerivedMetrics.growthScore,
			qualityScore: screenerDerivedMetrics.qualityScore,
			valueScore: screenerDerivedMetrics.valueScore,
			riskScore: screenerDerivedMetrics.riskScore,
			piotroskiScore: screenerDerivedMetrics.piotroskiScore,
			altmanZScore: screenerDerivedMetrics.altmanZScore,
			technicalRating: screenerDerivedMetrics.technicalRating,
			// 52W
			weekHigh52: screenerDerivedMetrics.weekHigh52,
			weekLow52: screenerDerivedMetrics.weekLow52,
		})
		.from(listedStocks)
		.leftJoin(screenerFinancials, eq(listedStocks.symbol, screenerFinancials.symbol))
		.leftJoin(screenerDerivedMetrics, eq(listedStocks.symbol, screenerDerivedMetrics.symbol))
		.leftJoin(screenerKeyMetrics, eq(listedStocks.symbol, screenerKeyMetrics.symbol))
		.leftJoin(screenerTechnicalIndicatorsLatest, eq(listedStocks.symbol, screenerTechnicalIndicatorsLatest.symbol))  // hot table: one row/symbol, no date-sort needed
		.leftJoin(screenerShareholding, eq(listedStocks.symbol, screenerShareholding.symbol))
		.leftJoin(screenerAnalystConsensus, eq(listedStocks.symbol, screenerAnalystConsensus.symbol))
		.leftJoin(screenerDcfValuations, eq(listedStocks.symbol, screenerDcfValuations.symbol))
		.where(
			and(
				...conditions,
				...(hasFinancialFilters ? financialConditions : []),
				...(hasDerivedFilters ? derivedConditions : []),
				...(hasTechnicalFilters ? technicalConditions : []),
				...(hasShareholdingFilters ? shareholdingConditions : []),
			),
		)
		.orderBy(sortExpr)
		.limit(limit)
		.offset(offset);

	const countQuery = db
		.select({ count: sql<number>`count(DISTINCT ${listedStocks.symbol})` })
		.from(listedStocks)
		.leftJoin(screenerFinancials, eq(listedStocks.symbol, screenerFinancials.symbol))
		.leftJoin(screenerDerivedMetrics, eq(listedStocks.symbol, screenerDerivedMetrics.symbol))
		.leftJoin(screenerKeyMetrics, eq(listedStocks.symbol, screenerKeyMetrics.symbol))
		.leftJoin(screenerTechnicalIndicatorsLatest, eq(listedStocks.symbol, screenerTechnicalIndicatorsLatest.symbol))
		.leftJoin(screenerShareholding, eq(listedStocks.symbol, screenerShareholding.symbol))
		.where(
			and(
				...conditions,
				...(hasFinancialFilters ? financialConditions : []),
				...(hasDerivedFilters ? derivedConditions : []),
				...(hasTechnicalFilters ? technicalConditions : []),
				...(hasShareholdingFilters ? shareholdingConditions : []),
			),
		);

	const [stocks, [countResult]] = await Promise.all([baseQuery, countQuery]);

	const total = Number(countResult?.count || 0);

	const [sectors, industries, marketCaps] = await Promise.all([
		db
			.selectDistinct({ value: listedStocks.sector })
			.from(listedStocks)
			.where(
				and(
					eq(listedStocks.isActive, true),
					isNotNull(listedStocks.sector),
				),
			),
		db
			.selectDistinct({ value: listedStocks.industry })
			.from(listedStocks)
			.where(
				and(
					eq(listedStocks.isActive, true),
					isNotNull(listedStocks.industry),
				),
			),
		db
			.selectDistinct({ value: listedStocks.marketCapCategory })
			.from(listedStocks)
			.where(
				and(
					eq(listedStocks.isActive, true),
					isNotNull(listedStocks.marketCapCategory),
				),
			),
	]);

	return {
		stocks: stocks as ScreenerResult[],
		total,
		page,
		limit,
		totalPages: Math.ceil(total / limit),
		filters: {
			sectors: sectors.map((s) => s.value).filter(Boolean) as string[],
			industries: industries.map((i) => i.value).filter(Boolean) as string[],
			marketCapCategories: marketCaps.map((m) => m.value).filter(Boolean) as string[],
			technicalRatings: ['Strong Buy', 'Buy', 'Neutral', 'Sell', 'Strong Sell'],
		},
	};
}

export async function getStockDetail(symbol: string) {
	const [stock] = await db
		.select()
		.from(listedStocks)
		.where(eq(listedStocks.symbol, symbol))
		.limit(1);

	if (!stock) return null;

	const [financials, derived, technical, shareholding] = await Promise.all([
		db.select().from(screenerFinancials)
			.where(eq(screenerFinancials.symbol, symbol))
			.orderBy(desc(screenerFinancials.fiscalYear))
			.limit(5),
		db.select().from(screenerDerivedMetrics)
			.where(eq(screenerDerivedMetrics.symbol, symbol))
			.limit(1),
		// Use _latest table (symbol PK) — the full screener_technical_indicators
		// historical table is not populated in production; _latest has everything
		// needed for the stock detail view (current snapshot).
		db.select().from(screenerTechnicalIndicatorsLatest)
			.where(eq(screenerTechnicalIndicatorsLatest.symbol, symbol))
			.limit(1),
		db.select().from(screenerShareholding)
			.where(eq(screenerShareholding.symbol, symbol))
			.orderBy(desc(screenerShareholding.quarterDate))
			.limit(4), // Last 4 quarters for trend
	]);

	return {
		stock,
		financials,
		derivedMetrics: derived[0] || null,
		technical: technical[0] || null,
		shareholding,
	};
}

export async function getScreenerStats() {
	const [stockCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(listedStocks)
		.where(eq(listedStocks.isActive, true));
	const [financialCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(screenerFinancials);
	const [derivedCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(screenerDerivedMetrics);

	return {
		totalStocks: Number(stockCount?.count || 0),
		withFinancials: Number(financialCount?.count || 0),
		withDerivedMetrics: Number(derivedCount?.count || 0),
	};
}

export async function getScreenerDistribution() {
	// Always emit all 5 market cap buckets — even when count = 0.
	// Uses the same LEFT JOIN pattern as rating/score distributions so the UI
	// never silently hides a segment just because no stocks are classified yet.
	const marketCapDist = await db.execute(sql`
    SELECT
      b.category,
      b.sort_order,
      COALESCE(d.count, 0) AS count
    FROM (
      VALUES
        ('mega',  1),
        ('large', 2),
        ('mid',   3),
        ('small', 4),
        ('micro', 5)
    ) AS b(category, sort_order)
    LEFT JOIN (
      SELECT
        LOWER(TRIM(
          CASE
            WHEN LOWER(market_cap_category) IN ('mega cap','mega')   THEN 'mega'
            WHEN LOWER(market_cap_category) IN ('large cap','large') THEN 'large'
            WHEN LOWER(market_cap_category) IN ('mid cap','mid')     THEN 'mid'
            WHEN LOWER(market_cap_category) IN ('small cap','small') THEN 'small'
            WHEN LOWER(market_cap_category) IN ('micro cap','micro') THEN 'micro'
            ELSE market_cap_category
          END
        )) AS category,
        COUNT(*) AS count
      FROM listed_stocks
      WHERE is_active = true
        AND market_cap_category IS NOT NULL
        AND LOWER(TRIM(market_cap_category)) IN ('mega','mega cap','large','large cap','mid','mid cap','small','small cap','micro','micro cap')
      GROUP BY 1
    ) d ON d.category = b.category
    ORDER BY b.sort_order
  `);

	const sectorDist = await db.execute(sql`
    SELECT sector, COUNT(*) as count 
    FROM listed_stocks
    WHERE is_active = true
      AND sector IS NOT NULL
      AND TRIM(sector) != ''
    GROUP BY sector
    ORDER BY count DESC
  `);

	// ── Pinned: REIT & InvIT (live in separate tables, not screener_stocks) ──
	const reitCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM reits WHERE is_active = true
  `);
	const invitCount = await db.execute(sql`
    SELECT COUNT(*) as count FROM invits WHERE is_active = true
  `);

	// Always show all 5 star buckets (1-5) even when count = 0
	const ratingDist = await db.execute(sql`
    SELECT
      s.rating,
      COALESCE(r.count, 0) AS count
    FROM (SELECT generate_series(1,5) AS rating) s
    LEFT JOIN (
      SELECT fintek_rating AS rating, COUNT(*) AS count
      FROM screener_derived_metrics dm
      INNER JOIN screener_stocks ss ON ss.symbol = dm.symbol AND ss.is_active = true
      GROUP BY fintek_rating
    ) r ON r.rating = s.rating
    ORDER BY s.rating DESC
  `);

	// Always show all 5 score buckets — aligned with FintekRating thresholds:
	// 5-star = ≥75, 4-star = ≥60, 3-star = ≥40, 2-star = ≥20, 1-star = <20
	const scoreDistribution = await db.execute(sql`
    SELECT
      r.range,
      r.sort_order,
      COALESCE(d.count, 0) AS count
    FROM (
      VALUES
        ('0-20',   1),
        ('20-40',  2),
        ('40-60',  3),
        ('60-75',  4),
        ('75-100', 5)
    ) AS r(range, sort_order)
    LEFT JOIN (
      SELECT
        CASE
          WHEN composite_score::numeric >= 75 THEN '75-100'
          WHEN composite_score::numeric >= 60 THEN '60-75'
          WHEN composite_score::numeric >= 40 THEN '40-60'
          WHEN composite_score::numeric >= 20 THEN '20-40'
          ELSE '0-20'
        END AS range,
        COUNT(*) AS count
      FROM screener_derived_metrics dm
      INNER JOIN screener_stocks ss ON ss.symbol = dm.symbol AND ss.is_active = true
      GROUP BY range
    ) d ON d.range = r.range
    ORDER BY r.sort_order
  `);

	return {
		marketCap: (marketCapDist as any).rows || marketCapDist,
		sectors: [
			...((sectorDist as any).rows || sectorDist),
			// Always include REIT and InvIT — pinned regardless of stock count
			{ sector: "REIT",  count: Number(((reitCount  as any).rows?.[0] || {}).count ?? 0), pinned: true },
			{ sector: "InvIT", count: Number(((invitCount as any).rows?.[0] || {}).count ?? 0), pinned: true },
		],
		ratings: (ratingDist as any).rows || ratingDist,
		scoreRanges: (scoreDistribution as any).rows || scoreDistribution,
	};
}
