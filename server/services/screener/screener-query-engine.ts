import { db } from "../../db";
import {
	screenerStocks,
	screenerFinancials,
	screenerDerivedMetrics,
} from "@shared/schema";
import {
	eq,
	and,
	gte,
	lte,
	sql,
	desc,
	asc,
	like,
	or,
	ilike,
	inArray,
	isNotNull,
} from "drizzle-orm";

export interface ScreenerFilters {
	sector?: string;
	industry?: string;
	marketCapCategory?: string;
	exchange?: string;
	minPE?: number;
	maxPE?: number;
	minPB?: number;
	maxPB?: number;
	minROE?: number;
	maxROE?: number;
	minDebtToEquity?: number;
	maxDebtToEquity?: number;
	minDividendYield?: number;
	maxDividendYield?: number;
	minCompositeScore?: number;
	maxCompositeScore?: number;
	minFintekRating?: number;
	search?: string;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
	page?: number;
	limit?: number;
}

export interface ScreenerResult {
	symbol: string;
	companyName: string;
	sector: string | null;
	industry: string | null;
	exchange: string | null;
	currentPrice: string | null;
	marketCapValue: string | null;
	marketCapCategory: string | null;
	peRatio: string | null;
	pbRatio: string | null;
	roe: string | null;
	debtToEquity: string | null;
	dividendYield: string | null;
	eps: string | null;
	netProfitMargin: string | null;
	return1y: string | null;
	return2y: string | null;
	return3y: string | null;
	return5y: string | null;
	compositeScore: string | null;
	fintekRating: number | null;
	growthScore: string | null;
	qualityScore: string | null;
	valueScore: string | null;
	riskScore: string | null;
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

	const derivedConditions: any[] = [];
	if (filters.minCompositeScore != null)
		derivedConditions.push(
			gte(
				screenerDerivedMetrics.compositeScore,
				filters.minCompositeScore.toString(),
			),
		);
	if (filters.maxCompositeScore != null)
		derivedConditions.push(
			lte(
				screenerDerivedMetrics.compositeScore,
				filters.maxCompositeScore.toString(),
			),
		);
	if (filters.minFintekRating != null)
		derivedConditions.push(
			gte(screenerDerivedMetrics.fintekRating, filters.minFintekRating),
		);

	const hasFinancialFilters = financialConditions.length > 0;
	const hasDerivedFilters = derivedConditions.length > 0;

	let sortColumn: any = screenerStocks.symbol;
	let sortDir: any = asc;

	if (filters.sortOrder === "desc") sortDir = desc;

	switch (filters.sortBy) {
		case "companyName":
			sortColumn = screenerStocks.companyName;
			break;
		case "currentPrice":
			sortColumn = screenerStocks.currentPrice;
			break;
		case "marketCap":
			sortColumn = screenerStocks.marketCapValue;
			break;
		case "peRatio":
			sortColumn = screenerFinancials.peRatio;
			break;
		case "roe":
			sortColumn = screenerFinancials.roe;
			break;
		case "compositeScore":
			sortColumn = screenerDerivedMetrics.compositeScore;
			break;
		case "fintekRating":
			sortColumn = screenerDerivedMetrics.fintekRating;
			break;
		default:
			sortColumn = screenerStocks.symbol;
	}

	const baseQuery = db
		.select({
			symbol: screenerStocks.symbol,
			companyName: screenerStocks.companyName,
			sector: screenerStocks.sector,
			industry: screenerStocks.industry,
			exchange: screenerStocks.exchange,
			currentPrice: screenerStocks.currentPrice,
			marketCapValue: screenerStocks.marketCapValue,
			marketCapCategory: screenerStocks.marketCapCategory,
			peRatio: screenerFinancials.peRatio,
			pbRatio: screenerFinancials.pbRatio,
			roe: screenerFinancials.roe,
			debtToEquity: screenerFinancials.debtToEquity,
			dividendYield: screenerFinancials.dividendYield,
			eps: screenerFinancials.eps,
			netProfitMargin: screenerFinancials.netProfitMargin,
			return1y: screenerFinancials.return1y,
			return2y: screenerFinancials.return2y,
			return3y: screenerFinancials.return3y,
			return5y: screenerFinancials.return5y,
			compositeScore: screenerDerivedMetrics.compositeScore,
			fintekRating: screenerDerivedMetrics.fintekRating,
			growthScore: screenerDerivedMetrics.growthScore,
			qualityScore: screenerDerivedMetrics.qualityScore,
			valueScore: screenerDerivedMetrics.valueScore,
			riskScore: screenerDerivedMetrics.riskScore,
		})
		.from(screenerStocks)
		.leftJoin(
			screenerFinancials,
			eq(screenerStocks.symbol, screenerFinancials.symbol),
		)
		.leftJoin(
			screenerDerivedMetrics,
			eq(screenerStocks.symbol, screenerDerivedMetrics.symbol),
		)
		.where(
			and(
				...conditions,
				...(hasFinancialFilters ? financialConditions : []),
				...(hasDerivedFilters ? derivedConditions : []),
			),
		)
		.orderBy(sortDir(sortColumn))
		.limit(limit)
		.offset(offset);

	const countQuery = db
		.select({ count: sql<number>`count(DISTINCT ${screenerStocks.symbol})` })
		.from(screenerStocks)
		.leftJoin(
			screenerFinancials,
			eq(screenerStocks.symbol, screenerFinancials.symbol),
		)
		.leftJoin(
			screenerDerivedMetrics,
			eq(screenerStocks.symbol, screenerDerivedMetrics.symbol),
		)
		.where(
			and(
				...conditions,
				...(hasFinancialFilters ? financialConditions : []),
				...(hasDerivedFilters ? derivedConditions : []),
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
			marketCapCategories: marketCaps
				.map((m) => m.value)
				.filter(Boolean) as string[],
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

	const [financials, derived] = await Promise.all([
		db
			.select()
			.from(screenerFinancials)
			.where(eq(screenerFinancials.symbol, symbol))
			.orderBy(desc(screenerFinancials.fiscalYear))
			.limit(5),
		db
			.select()
			.from(screenerDerivedMetrics)
			.where(eq(screenerDerivedMetrics.symbol, symbol))
			.limit(1),
	]);

	return {
		stock,
		financials,
		derivedMetrics: derived[0] || null,
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
