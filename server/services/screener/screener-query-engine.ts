import { db } from "../../db";
import {
	screenerStocks,
	screenerFinancials,
	screenerDerivedMetrics,
	screenerTechnicalIndicators,
	screenerShareholding,
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

	const conditions: any[] = [eq(screenerStocks.isActive, true)];

	if (filters.sector)
		conditions.push(eq(screenerStocks.sector, filters.sector));
	if (filters.industry)
		conditions.push(eq(screenerStocks.industry, filters.industry));
	if (filters.marketCapCategory)
		conditions.push(
			eq(screenerStocks.marketCapCategory, filters.marketCapCategory),
		);
	if (filters.exchange)
		conditions.push(eq(screenerStocks.exchange, filters.exchange));

	if (filters.search) {
		conditions.push(
			or(
				ilike(screenerStocks.symbol, `%${filters.search}%`),
				ilike(screenerStocks.companyName, `%${filters.search}%`),
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

	// Technical indicator conditions
	const technicalConditions: any[] = [];
	if (filters.minRSI != null) technicalConditions.push(gte(screenerTechnicalIndicators.rsi14, filters.minRSI.toString()));
	if (filters.maxRSI != null) technicalConditions.push(lte(screenerTechnicalIndicators.rsi14, filters.maxRSI.toString()));

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

	let sortColumn: any = screenerStocks.symbol;
	let sortDir: any = asc;
	if (filters.sortOrder === "desc") sortDir = desc;

	switch (filters.sortBy) {
		case "companyName": sortColumn = screenerStocks.companyName; break;
		case "currentPrice": sortColumn = screenerStocks.currentPrice; break;
		case "marketCap": sortColumn = screenerStocks.marketCapValue; break;
		case "peRatio": sortColumn = screenerFinancials.peRatio; break;
		case "roe": sortColumn = screenerFinancials.roe; break;
		case "compositeScore": sortColumn = screenerDerivedMetrics.compositeScore; break;
		case "fintekRating": sortColumn = screenerDerivedMetrics.fintekRating; break;
		case "return1Y": sortColumn = screenerDerivedMetrics.return1Y; break;
		case "return1M": sortColumn = screenerDerivedMetrics.return1M; break;
		case "return3M": sortColumn = screenerDerivedMetrics.return3M; break;
		case "beta": sortColumn = screenerDerivedMetrics.beta; break;
		case "sharpe": sortColumn = screenerDerivedMetrics.sharpeRatio1Y; break;
		case "piotroski": sortColumn = screenerDerivedMetrics.piotroskiScore; break;
		case "rsi": sortColumn = screenerTechnicalIndicators.rsi14; break;
		case "promoterHolding": sortColumn = screenerShareholding.promoterHolding; break;
		default: sortColumn = screenerStocks.symbol;
	}

	const baseQuery = db
		.select({
			// Core
			symbol: screenerStocks.symbol,
			companyName: screenerStocks.companyName,
			sector: screenerStocks.sector,
			industry: screenerStocks.industry,
			exchange: screenerStocks.exchange,
			currentPrice: screenerStocks.currentPrice,
			marketCapValue: screenerStocks.marketCapValue,
			marketCapCategory: screenerStocks.marketCapCategory,
			// Fundamentals
			peRatio: screenerFinancials.peRatio,
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
		.from(screenerStocks)
		.leftJoin(screenerFinancials, eq(screenerStocks.symbol, screenerFinancials.symbol))
		.leftJoin(screenerDerivedMetrics, eq(screenerStocks.symbol, screenerDerivedMetrics.symbol))
		.leftJoin(screenerTechnicalIndicators, eq(screenerStocks.symbol, screenerTechnicalIndicators.symbol))
		.leftJoin(screenerShareholding, eq(screenerStocks.symbol, screenerShareholding.symbol))
		.where(
			and(
				...conditions,
				...(hasFinancialFilters ? financialConditions : []),
				...(hasDerivedFilters ? derivedConditions : []),
				...(hasTechnicalFilters ? technicalConditions : []),
				...(hasShareholdingFilters ? shareholdingConditions : []),
			),
		)
		.orderBy(sortDir(sortColumn))
		.limit(limit)
		.offset(offset);

	const countQuery = db
		.select({ count: sql<number>`count(DISTINCT ${screenerStocks.symbol})` })
		.from(screenerStocks)
		.leftJoin(screenerFinancials, eq(screenerStocks.symbol, screenerFinancials.symbol))
		.leftJoin(screenerDerivedMetrics, eq(screenerStocks.symbol, screenerDerivedMetrics.symbol))
		.leftJoin(screenerTechnicalIndicators, eq(screenerStocks.symbol, screenerTechnicalIndicators.symbol))
		.leftJoin(screenerShareholding, eq(screenerStocks.symbol, screenerShareholding.symbol))
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
			.selectDistinct({ value: screenerStocks.sector })
			.from(screenerStocks)
			.where(
				and(
					eq(screenerStocks.isActive, true),
					isNotNull(screenerStocks.sector),
				),
			),
		db
			.selectDistinct({ value: screenerStocks.industry })
			.from(screenerStocks)
			.where(
				and(
					eq(screenerStocks.isActive, true),
					isNotNull(screenerStocks.industry),
				),
			),
		db
			.selectDistinct({ value: screenerStocks.marketCapCategory })
			.from(screenerStocks)
			.where(
				and(
					eq(screenerStocks.isActive, true),
					isNotNull(screenerStocks.marketCapCategory),
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
		.from(screenerStocks)
		.where(eq(screenerStocks.symbol, symbol))
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
		db.select().from(screenerTechnicalIndicators)
			.where(eq(screenerTechnicalIndicators.symbol, symbol))
			.orderBy(desc(screenerTechnicalIndicators.date))
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
		.from(screenerStocks)
		.where(eq(screenerStocks.isActive, true));
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
	const marketCapDist = await db.execute(sql`
    SELECT market_cap_category as category, COUNT(*) as count 
    FROM screener_stocks WHERE is_active = true AND market_cap_category IS NOT NULL 
    GROUP BY market_cap_category ORDER BY count DESC
  `);

	const sectorDist = await db.execute(sql`
    SELECT sector, COUNT(*) as count 
    FROM screener_stocks WHERE is_active = true AND sector IS NOT NULL 
    GROUP BY sector ORDER BY count DESC LIMIT 20
  `);

	const ratingDist = await db.execute(sql`
    SELECT fintek_rating as rating, COUNT(*) as count 
    FROM screener_derived_metrics dm 
    INNER JOIN screener_stocks ss ON ss.symbol = dm.symbol AND ss.is_active = true
    GROUP BY fintek_rating ORDER BY fintek_rating DESC
  `);

	const scoreDistribution = await db.execute(sql`
    SELECT 
      CASE 
        WHEN composite_score::numeric >= 80 THEN '80-100'
        WHEN composite_score::numeric >= 60 THEN '60-80'
        WHEN composite_score::numeric >= 40 THEN '40-60'
        WHEN composite_score::numeric >= 20 THEN '20-40'
        ELSE '0-20'
      END as range,
      COUNT(*) as count
    FROM screener_derived_metrics dm
    INNER JOIN screener_stocks ss ON ss.symbol = dm.symbol AND ss.is_active = true
    GROUP BY range ORDER BY range
  `);

	return {
		marketCap: (marketCapDist as any).rows || marketCapDist,
		sectors: (sectorDist as any).rows || sectorDist,
		ratings: (ratingDist as any).rows || ratingDist,
		scoreRanges: (scoreDistribution as any).rows || scoreDistribution,
	};
}
