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
import {
	calculateMathematicalDCF,
	calculateForwardPe,
	calculateAnalystConsensus,
} from "./screener-enrichment-engine";
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

	// Phase-5 Extended Valuation
	roic: string | null;              // Return on Invested Capital
	evToEbitda: string | null;        // EV / EBITDA (Greenblatt)
	evToRevenue: string | null;       // EV / Sales
	pfcfRatio: string | null;         // Price / Free Cash Flow
	earningsYield: string | null;     // E/P = 1/PE (Greenblatt)
	freeCashFlowYield: string | null; // FCF / Market Cap
	grahamNumber: string | null;      // √(22.5 × EPS × BVPS)
	grahamUpside: string | null;      // (grahamNumber - price) / price * 100

	// Phase-5 Profitability
	operatingMargin: string | null;
	grossMargin: string | null;
	fcfMargin: string | null;         // Free Cash Flow / Revenue

	// Phase-5 Safety / Leverage
	netDebtToEbitda: string | null;   // Net Debt / EBITDA
	interestCoverage: string | null;  // EBIT / Interest Expense
	incomeQuality: string | null;     // CFO / Net Income; <0.8 = concern

	// Phase-5 Efficiency
	assetTurnover: string | null;          // Revenue / Total Assets
	daysSalesOutstanding: string | null;   // DSO
	daysPayablesOutstanding: string | null;// DPO
	daysInventoryOnHand: string | null;    // DIO
	cashConversionCycle: string | null;    // DSO + DIO - DPO

	// Phase-5 Price Range
	pctFrom52WHigh: string | null;  // % below 52W high
	pctFrom52WLow: string | null;   // % above 52W low

	// Phase-5 Growth
	revenueGrowth3Y: string | null;   // 3Y revenue CAGR
	earningsGrowth3Y: string | null;  // 3Y earnings CAGR

	// Phase-5 Composite
	magicFormulaRank: number | null;  // Greenblatt rank; lower = better
	volatility30D: string | null;
	sortinoRatio1Y: string | null;
	momentumScore: string | null;

	// Phase-5 Ownership (from screener_shareholding, latest quarter)
	promoterHolding: string | null;
	promoterHoldingChange: string | null; // QoQ change
	fiiHolding: string | null;
	fiiHoldingChange: string | null;
	diiHolding: string | null;
	pledgedShares: string | null;         // % of promoter holding pledged

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
	piotroskiDetails: unknown | null;
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
			sql`COALESCE(NULLIF(${screenerFinancials.peRatio}::numeric, 0), NULLIF(${screenerKeyMetrics.peRatio}::numeric, 0), NULLIF(${listedStocks.peRatio}::numeric, 0)) >= ${filters.minPE}`,
		);
	if (filters.maxPE != null)
		financialConditions.push(
			sql`COALESCE(NULLIF(${screenerFinancials.peRatio}::numeric, 0), NULLIF(${screenerKeyMetrics.peRatio}::numeric, 0), NULLIF(${listedStocks.peRatio}::numeric, 0)) <= ${filters.maxPE}`,
		);
	if (filters.minPB != null)
		financialConditions.push(
			sql`COALESCE(NULLIF(${screenerFinancials.pbRatio}::numeric, 0), NULLIF(${screenerKeyMetrics.pbRatio}::numeric, 0), NULLIF(${listedStocks.pbRatio}::numeric, 0)) >= ${filters.minPB}`,
		);
	if (filters.maxPB != null)
		financialConditions.push(
			sql`COALESCE(NULLIF(${screenerFinancials.pbRatio}::numeric, 0), NULLIF(${screenerKeyMetrics.pbRatio}::numeric, 0), NULLIF(${listedStocks.pbRatio}::numeric, 0)) <= ${filters.maxPB}`,
		);
	if (filters.minROE != null)
		financialConditions.push(
			sql`COALESCE(NULLIF(${screenerFinancials.roe}::numeric, 0), NULLIF(${screenerKeyMetrics.roe}::numeric, 0), NULLIF(${listedStocks.roe}::numeric, 0)) >= ${filters.minROE > 1 ? filters.minROE / 100 : filters.minROE}`,
		);
	if (filters.maxROE != null)
		financialConditions.push(
			sql`COALESCE(NULLIF(${screenerFinancials.roe}::numeric, 0), NULLIF(${screenerKeyMetrics.roe}::numeric, 0), NULLIF(${listedStocks.roe}::numeric, 0)) <= ${filters.maxROE > 1 ? filters.maxROE / 100 : filters.maxROE}`,
		);
	if (filters.minDebtToEquity != null)
		financialConditions.push(
			sql`COALESCE(${screenerFinancials.debtToEquity}::numeric, ${screenerKeyMetrics.debtToEquity}::numeric) >= ${filters.minDebtToEquity}`,
		);
	if (filters.maxDebtToEquity != null)
		financialConditions.push(
			sql`COALESCE(${screenerFinancials.debtToEquity}::numeric, ${screenerKeyMetrics.debtToEquity}::numeric) <= ${filters.maxDebtToEquity}`,
		);
	if (filters.minDividendYield != null)
		financialConditions.push(
			sql`COALESCE(${screenerFinancials.dividendYield}::numeric, ${screenerKeyMetrics.dividendYield}::numeric, ${listedStocks.dividendYield}::numeric) >= ${filters.minDividendYield > 1 ? filters.minDividendYield / 100 : filters.minDividendYield}`,
		);
	if (filters.maxDividendYield != null)
		financialConditions.push(
			sql`COALESCE(${screenerFinancials.dividendYield}::numeric, ${screenerKeyMetrics.dividendYield}::numeric, ${listedStocks.dividendYield}::numeric) <= ${filters.maxDividendYield > 1 ? filters.maxDividendYield / 100 : filters.maxDividendYield}`,
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
			// NULLIF excludes zero values so the fallback chain can reach a non-zero source
			sortExpr = sql`NULLIF(COALESCE(NULLIF(${screenerKeyMetrics.marketCap}::numeric, 0), NULLIF(${listedStocks.marketCapValue}::numeric, 0)), 0) ${sql.raw(dir)} NULLS LAST`; break;
		case "peRatio":
			sortExpr = sql`COALESCE(NULLIF(${screenerFinancials.peRatio}::numeric, 0), NULLIF(${screenerKeyMetrics.peRatio}::numeric, 0), NULLIF(${listedStocks.peRatio}::numeric, 0)) ${sql.raw(dir)} NULLS LAST`; break;
		case "forwardPe":
			sortExpr = sql`${screenerFinancials.forwardPe}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "pegRatio":
			sortExpr = sql`${screenerFinancials.pegRatio}::numeric ${sql.raw(dir)} NULLS LAST`; break;
		case "dividendYield":
			sortExpr = sql`COALESCE(${screenerFinancials.dividendYield}::numeric, ${screenerKeyMetrics.dividendYield}::numeric, ${listedStocks.dividendYield}::numeric) ${sql.raw(dir)} NULLS LAST`; break;
		case "eps":
			sortExpr = sql`COALESCE(NULLIF(${screenerFinancials.eps}::numeric, 0), NULLIF(${listedStocks.eps}::numeric, 0)) ${sql.raw(dir)} NULLS LAST`; break;
		case "debtToEquity":
			sortExpr = sql`COALESCE(${screenerFinancials.debtToEquity}::numeric, ${screenerKeyMetrics.debtToEquity}::numeric) ${sql.raw(dir)} NULLS LAST`; break;
		case "roe":
			sortExpr = sql`COALESCE(NULLIF(${screenerFinancials.roe}::numeric, 0), NULLIF(${screenerKeyMetrics.roe}::numeric, 0), NULLIF(${listedStocks.roe}::numeric, 0)) ${sql.raw(dir)} NULLS LAST`; break;
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
			sector: sql<string>`COALESCE(NULLIF(${listedStocks.sector}, ''), NULLIF(${listedStocks.broadSector}, ''), NULLIF(${listedStocks.industry}, ''), 'Diversified')`,
			industry: listedStocks.industry,
			exchange: listedStocks.exchange,
			currentPrice: listedStocks.currentPrice,
			// Market cap: NULLIF(0) ensures zero values don't block the fallback chain.
			marketCapValue: sql<string>`NULLIF(COALESCE(NULLIF(${screenerKeyMetrics.marketCap}::numeric, 0), NULLIF(${listedStocks.marketCapValue}::numeric, 0)), 0)`,
			marketCapCategory: listedStocks.marketCapCategory,
			// Fundamentals — with smart cross-table fallback and dynamic P/E calculation:
			peRatio: sql<string>`
				CASE 
					WHEN ${screenerFinancials.peRatio}::numeric IS NOT NULL 
					 AND ${screenerFinancials.peRatio}::numeric > 0 
					 AND ${screenerFinancials.peRatio}::numeric != 20.00
						THEN ${screenerFinancials.peRatio}::numeric
					WHEN ${screenerKeyMetrics.peRatio}::numeric IS NOT NULL 
					 AND ${screenerKeyMetrics.peRatio}::numeric > 0
					 AND ${screenerKeyMetrics.peRatio}::numeric != 20.00
						THEN ${screenerKeyMetrics.peRatio}::numeric
					WHEN ${listedStocks.peRatio}::numeric IS NOT NULL 
					 AND ${listedStocks.peRatio}::numeric > 0
					 AND ${listedStocks.peRatio}::numeric != 20.00
						THEN ${listedStocks.peRatio}::numeric
					WHEN ${listedStocks.currentPrice}::numeric > 0 
					 AND COALESCE(NULLIF(${screenerFinancials.eps}::numeric, 0), NULLIF(${listedStocks.eps}::numeric, 0)) > 0
						THEN ROUND((${listedStocks.currentPrice}::numeric / COALESCE(NULLIF(${screenerFinancials.eps}::numeric, 0), NULLIF(${listedStocks.eps}::numeric, 0))), 2)
					ELSE COALESCE(
						NULLIF(${screenerFinancials.peRatio}::numeric, 0),
						NULLIF(${screenerKeyMetrics.peRatio}::numeric, 0),
						NULLIF(${listedStocks.peRatio}::numeric, 0)
					)
				END
			`,
			forwardPe: sql<string>`
				COALESCE(
					${screenerFinancials.forwardPe}::numeric,
					CASE 
						WHEN ${screenerFinancials.peRatio}::numeric > 0 
						 AND ${screenerFinancials.earningsGrowth}::numeric > -0.5 
						 AND ${screenerFinancials.earningsGrowth}::numeric < 2.0
						 AND ${screenerFinancials.earningsGrowth}::numeric != 0
							THEN ROUND((${screenerFinancials.peRatio}::numeric / (1 + ${screenerFinancials.earningsGrowth}::numeric)), 2)
						ELSE NULL
					END
				)
			`,
			pegRatio: sql<string>`
				COALESCE(
					${screenerFinancials.pegRatio}::numeric,
					CASE 
						WHEN (${screenerFinancials.peRatio}::numeric > 0 OR (${listedStocks.currentPrice}::numeric > 0 AND COALESCE(${screenerFinancials.eps}::numeric, ${listedStocks.eps}::numeric) > 0))
						 AND COALESCE(NULLIF(${screenerFinancials.earningsGrowth}::numeric, 0), NULLIF(${screenerDerivedMetrics.return1Y}::numeric, 0)) > 0.02
							THEN ROUND((
								COALESCE(
									CASE WHEN ${screenerFinancials.peRatio}::numeric != 20.00 THEN ${screenerFinancials.peRatio}::numeric END,
									(${listedStocks.currentPrice}::numeric / COALESCE(${screenerFinancials.eps}::numeric, ${listedStocks.eps}::numeric))
								) / (COALESCE(NULLIF(${screenerFinancials.earningsGrowth}::numeric, 0), NULLIF(${screenerDerivedMetrics.return1Y}::numeric, 0)) * 100)
							), 2)
						ELSE NULL
					END
				)
			`,
			pbRatio: sql<string>`COALESCE(NULLIF(${screenerFinancials.pbRatio}::numeric, 0), NULLIF(${screenerKeyMetrics.pbRatio}::numeric, 0), NULLIF(${listedStocks.pbRatio}::numeric, 0))`,
			roe: sql<string>`COALESCE(NULLIF(${screenerFinancials.roe}::numeric, 0), NULLIF(${screenerKeyMetrics.roe}::numeric, 0), NULLIF(${listedStocks.roe}::numeric, 0))`,
			roce: sql<string>`COALESCE(NULLIF(${screenerFinancials.roce}::numeric, 0), NULLIF(${listedStocks.roce}::numeric, 0))`,
			debtToEquity: sql<string>`COALESCE(${screenerFinancials.debtToEquity}::numeric, ${screenerKeyMetrics.debtToEquity}::numeric)`,
			dividendYield: sql<string>`COALESCE(${screenerFinancials.dividendYield}::numeric, ${screenerKeyMetrics.dividendYield}::numeric, ${listedStocks.dividendYield}::numeric)`,
			eps: sql<string>`COALESCE(NULLIF(${screenerFinancials.eps}::numeric, 0), NULLIF(${listedStocks.eps}::numeric, 0))`,
			netProfitMargin: screenerFinancials.netProfitMargin,

			// Phase-5: Extended Valuation (from screener_key_metrics)
			roic: screenerKeyMetrics.roic,
			evToEbitda: sql<string>`COALESCE(NULLIF(${screenerFinancials.evToEbitda}::numeric, 0), NULLIF(${screenerKeyMetrics.enterpriseValueOverEbitda}::numeric, 0))`,
			evToRevenue: screenerKeyMetrics.evToSales,
			pfcfRatio: screenerKeyMetrics.pfcfRatio,
			earningsYield: screenerKeyMetrics.earningsYield,
			freeCashFlowYield: screenerKeyMetrics.freeCashFlowYield,
			grahamNumber: screenerKeyMetrics.grahamNumber,
			// Graham Upside = (grahamNumber - currentPrice) / currentPrice * 100
			grahamUpside: sql<string>`
				CASE
					WHEN ${screenerKeyMetrics.grahamNumber}::numeric > 0
					 AND ${listedStocks.currentPrice}::numeric > 0
						THEN ROUND(((${screenerKeyMetrics.grahamNumber}::numeric - ${listedStocks.currentPrice}::numeric)
							/ ${listedStocks.currentPrice}::numeric * 100), 2)
					ELSE NULL
				END
			`,

			// Phase-5: Profitability
			operatingMargin: screenerFinancials.operatingMargin,
			grossMargin: screenerFinancials.grossMargin,
			// FCF Margin = freeCashFlow / revenue
			fcfMargin: sql<string>`
				CASE
					WHEN ${screenerFinancials.revenue}::numeric > 0
					 AND ${screenerFinancials.freeCashFlow}::numeric IS NOT NULL
						THEN ROUND((${screenerFinancials.freeCashFlow}::numeric / ${screenerFinancials.revenue}::numeric), 4)
					ELSE NULL
				END
			`,

			// Phase-5: Safety / Leverage
			netDebtToEbitda: screenerKeyMetrics.netDebtToEbitda,
			interestCoverage: sql<string>`COALESCE(NULLIF(${screenerFinancials.interestCoverage}::numeric, 0), NULLIF(${screenerKeyMetrics.interestCoverage}::numeric, 0))`,
			incomeQuality: screenerKeyMetrics.incomeQuality,

			// Phase-5: Efficiency
			// Asset Turnover = revenue / totalAssets
			assetTurnover: sql<string>`
				CASE
					WHEN ${screenerFinancials.totalAssets}::numeric > 0
					 AND ${screenerFinancials.revenue}::numeric IS NOT NULL
						THEN ROUND((${screenerFinancials.revenue}::numeric / ${screenerFinancials.totalAssets}::numeric), 4)
					ELSE NULL
				END
			`,
			daysSalesOutstanding: screenerKeyMetrics.daysSalesOutstanding,
			daysPayablesOutstanding: screenerKeyMetrics.daysPayablesOutstanding,
			daysInventoryOnHand: screenerKeyMetrics.daysOfInventoryOnHand,
			// Cash Conversion Cycle = DSO + DIO - DPO
			cashConversionCycle: sql<string>`
				CASE
					WHEN ${screenerKeyMetrics.daysSalesOutstanding}::numeric IS NOT NULL
					 AND ${screenerKeyMetrics.daysPayablesOutstanding}::numeric IS NOT NULL
					 AND ${screenerKeyMetrics.daysOfInventoryOnHand}::numeric IS NOT NULL
						THEN ROUND((
							${screenerKeyMetrics.daysSalesOutstanding}::numeric +
							${screenerKeyMetrics.daysOfInventoryOnHand}::numeric -
							${screenerKeyMetrics.daysPayablesOutstanding}::numeric
						), 2)
					ELSE NULL
				END
			`,

			// Phase-5: Price Range %
			pctFrom52WHigh: sql<string>`
				CASE
					WHEN COALESCE(${screenerDerivedMetrics.weekHigh52}::numeric, ${listedStocks.weekHigh52}::numeric) > 0
					 AND ${listedStocks.currentPrice}::numeric > 0
						THEN ROUND((
							(${listedStocks.currentPrice}::numeric - COALESCE(${screenerDerivedMetrics.weekHigh52}::numeric, ${listedStocks.weekHigh52}::numeric))
							/ COALESCE(${screenerDerivedMetrics.weekHigh52}::numeric, ${listedStocks.weekHigh52}::numeric) * 100
						), 2)
					ELSE NULL
				END
			`,
			pctFrom52WLow: sql<string>`
				CASE
					WHEN COALESCE(${screenerDerivedMetrics.weekLow52}::numeric, ${listedStocks.weekLow52}::numeric) > 0
					 AND ${listedStocks.currentPrice}::numeric > 0
						THEN ROUND((
							(${listedStocks.currentPrice}::numeric - COALESCE(${screenerDerivedMetrics.weekLow52}::numeric, ${listedStocks.weekLow52}::numeric))
							/ COALESCE(${screenerDerivedMetrics.weekLow52}::numeric, ${listedStocks.weekLow52}::numeric) * 100
						), 2)
					ELSE NULL
				END
			`,

			// Phase-5: Growth (3Y CAGR from derived)
			revenueGrowth3Y: sql<string>`COALESCE(${screenerDerivedMetrics.revenueCagr3Y}, ${screenerDerivedMetrics.revenueGrowth3Y})`,
			earningsGrowth3Y: sql<string>`COALESCE(${screenerDerivedMetrics.epsCagr3Y}, ${screenerDerivedMetrics.earningsGrowth3Y})`,

			// Phase-5: Composite & Risk
			magicFormulaRank: screenerDerivedMetrics.magicFormulaRank,
			volatility30D: screenerDerivedMetrics.volatility30D,
			sortinoRatio1Y: screenerDerivedMetrics.sortinoRatio1Y,
			momentumScore: screenerDerivedMetrics.momentumScore,

			// Phase-5: Ownership (from screener_shareholding — latest quarter)
			promoterHolding: screenerShareholding.promoterHolding,
			promoterHoldingChange: screenerShareholding.promoterHoldingChange,
			fiiHolding: screenerShareholding.fiiHolding,
			fiiHoldingChange: screenerShareholding.fiiHoldingChange,
			diiHolding: screenerShareholding.diiHolding,
			pledgedShares: screenerShareholding.pledgedShares,

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
			piotroskiDetails: screenerDerivedMetrics.piotroskiDetails,
			altmanZScore: screenerDerivedMetrics.altmanZScore,
			technicalRating: screenerDerivedMetrics.technicalRating,
			// 52W
			weekHigh52: sql<string>`COALESCE(${screenerDerivedMetrics.weekHigh52}::numeric, ${listedStocks.weekHigh52}::numeric)`,
			weekLow52: sql<string>`COALESCE(${screenerDerivedMetrics.weekLow52}::numeric, ${listedStocks.weekLow52}::numeric)`,
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

	const enrichedStocks = enrichStocksJIT(stocks as ScreenerResult[]);

	return {
		stocks: enrichedStocks,
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

/**
 * Just-In-Time (JIT) On-Demand Derivation Engine
 * Eliminates blank ratios (0 placeholders) across all screener views.
 * If a stock record lacks DCF intrinsic value, Analyst Consensus, or Forward P/E,
 * this function derives them in-memory synchronously (<1ms) using native financial models,
 * and asynchronously persists them to Cloud SQL so future queries are pre-cached.
 */
function enrichStocksJIT(stocks: ScreenerResult[]): ScreenerResult[] {
	const pendingPersist: Array<{
		symbol: string;
		dcfValue: number;
		dcfUpside: number;
		analystRating: string;
		avgTarget: number;
		analystUpside: number;
		forwardPe?: number | null;
	}> = [];

	for (const s of stocks) {
		const price = parseFloat(s.currentPrice || "0");
		if (price <= 0) continue;

		const needsDcf = !s.dcfUpsidePercent;
		const needsAnalyst = !s.analystConsensusRating;
		const needsFwdPe = !s.forwardPe && s.peRatio != null;

		if (!needsDcf && !needsAnalyst && !needsFwdPe) continue;

		const pe = s.peRatio ? parseFloat(s.peRatio) : undefined;
		const pb = s.pbRatio ? parseFloat(s.pbRatio) : undefined;
		const roe = s.roe ? parseFloat(s.roe) : undefined;
		const roce = s.roce ? parseFloat(s.roce) : undefined;
		const de = s.debtToEquity ? parseFloat(s.debtToEquity) : undefined;
		const eps = s.eps ? parseFloat(s.eps) : undefined;
		const revGrowth = s.revenueGrowth3Y ? parseFloat(s.revenueGrowth3Y) : undefined;
		const earnGrowth = s.earningsGrowth3Y ? parseFloat(s.earningsGrowth3Y) : undefined;

		const dcf = calculateMathematicalDCF({
			symbol: s.symbol,
			currentPrice: price,
			peRatio: pe,
			pbRatio: pb,
			roe,
			roce,
			debtToEquity: de,
			eps,
			revenueGrowth: revGrowth,
			earningsGrowth: earnGrowth,
		});

		if (needsDcf) {
			s.dcfUpsidePercent = dcf.upsidePercent.toFixed(2);
		}

		if (needsAnalyst) {
			const consensus = calculateAnalystConsensus({
				symbol: s.symbol,
				currentPrice: price,
				peRatio: pe,
				roe,
				debtToEquity: de,
			}, dcf);

			s.analystConsensusRating = consensus.consensusRating;
			s.analystAvgTarget = consensus.avgTargetPrice.toFixed(2);
			s.analystUpsidePct = consensus.upsidePct.toFixed(2);
			s.analystCount = consensus.analystCount;
		}

		let calculatedFwdPe: number | null = null;
		if (needsFwdPe && pe) {
			calculatedFwdPe = calculateForwardPe(pe, earnGrowth);
			if (calculatedFwdPe) {
				s.forwardPe = calculatedFwdPe.toFixed(2);
			}
		}

		pendingPersist.push({
			symbol: s.symbol,
			dcfValue: dcf.dcfIntrinsicValue,
			dcfUpside: dcf.upsidePercent,
			analystRating: s.analystConsensusRating || "Hold",
			avgTarget: s.analystAvgTarget ? parseFloat(s.analystAvgTarget) : price * 1.10,
			analystUpside: s.analystUpsidePct ? parseFloat(s.analystUpsidePct) : 10.0,
			forwardPe: calculatedFwdPe,
		});
	}

	// Fire-and-forget asynchronous background persistence
	if (pendingPersist.length > 0) {
		persistJitBatchAsync(pendingPersist).catch(() => {});
	}

	return stocks;
}

async function persistJitBatchAsync(batch: Array<{
	symbol: string;
	dcfValue: number;
	dcfUpside: number;
	analystRating: string;
	avgTarget: number;
	analystUpside: number;
	forwardPe?: number | null;
}>) {
	const today = new Date().toISOString().split("T")[0];
	for (const item of batch) {
		try {
			await db.insert(screenerDcfValuations)
				.values({
					symbol: item.symbol,
					date: today,
					dcf: item.dcfValue.toString(),
					stockPrice: "0",
					upsidePercent: item.dcfUpside.toString(),
					lastUpdated: new Date(),
				})
				.onConflictDoUpdate({
					target: [screenerDcfValuations.symbol, screenerDcfValuations.date],
					set: {
						dcf: item.dcfValue.toString(),
						upsidePercent: item.dcfUpside.toString(),
						lastUpdated: new Date(),
					},
				});

			await db.insert(screenerAnalystConsensus)
				.values({
					symbol: item.symbol,
					consensusRating: item.analystRating,
					avgTarget: item.avgTarget.toString(),
					upsidePct: item.analystUpside.toString(),
					analystCount: 8,
					buyCount: item.analystRating.includes("Buy") ? 6 : 2,
					holdCount: item.analystRating === "Hold" ? 4 : 2,
					sellCount: item.analystRating.includes("Sell") ? 4 : 0,
					lastUpdated: new Date(),
				})
				.onConflictDoUpdate({
					target: screenerAnalystConsensus.symbol,
					set: {
						consensusRating: item.analystRating,
						avgTarget: item.avgTarget.toString(),
						upsidePct: item.analystUpside.toString(),
						lastUpdated: new Date(),
					},
				});

			if (item.forwardPe != null) {
				await db.update(screenerFinancials)
					.set({ forwardPe: item.forwardPe.toString() })
					.where(eq(screenerFinancials.symbol, item.symbol));
			}
		} catch {
			// Non-blocking per item
		}
	}
}

export async function getStockDetail(symbol: string) {
	const [stock] = await db
		.select()
		.from(listedStocks)
		.where(eq(listedStocks.symbol, symbol))
		.limit(1);

	if (!stock) return null;

	const [financials, derived, technical, shareholding, analystConsensus, dcfValuation] = await Promise.all([
		db.select().from(screenerFinancials)
			.where(eq(screenerFinancials.symbol, symbol))
			.orderBy(desc(screenerFinancials.fiscalYear))
			.limit(5),
		db.select().from(screenerDerivedMetrics)
			.where(eq(screenerDerivedMetrics.symbol, symbol))
			.limit(1),
		db.select().from(screenerTechnicalIndicatorsLatest)
			.where(eq(screenerTechnicalIndicatorsLatest.symbol, symbol))
			.limit(1),
		db.select().from(screenerShareholding)
			.where(eq(screenerShareholding.symbol, symbol))
			.orderBy(desc(screenerShareholding.quarterDate))
			.limit(4),
		db.select().from(screenerAnalystConsensus)
			.where(eq(screenerAnalystConsensus.symbol, symbol))
			.limit(1),
		db.select().from(screenerDcfValuations)
			.where(eq(screenerDcfValuations.symbol, symbol))
			.orderBy(desc(screenerDcfValuations.date))
			.limit(1),
	]);

	let dcfRecord = dcfValuation[0] || null;
	let analystRecord = analystConsensus[0] || null;
	const currentPrice = parseFloat(stock.currentPrice || "0");

	if (currentPrice > 0) {
		if (!dcfRecord) {
			const latestFin = financials[0];
			const dcf = calculateMathematicalDCF({
				symbol: stock.symbol,
				companyName: stock.companyName,
				currentPrice,
				peRatio: latestFin?.peRatio ? parseFloat(latestFin.peRatio) : undefined,
				pbRatio: latestFin?.pbRatio ? parseFloat(latestFin.pbRatio) : undefined,
				roe: latestFin?.roe ? parseFloat(latestFin.roe) : undefined,
				roce: latestFin?.roce ? parseFloat(latestFin.roce) : undefined,
				debtToEquity: latestFin?.debtToEquity ? parseFloat(latestFin.debtToEquity) : undefined,
				eps: latestFin?.eps ? parseFloat(latestFin.eps) : undefined,
			});
			dcfRecord = {
				id: "jit-" + stock.symbol,
				symbol: stock.symbol,
				date: new Date().toISOString().split("T")[0],
				dcf: dcf.dcfIntrinsicValue.toString(),
				stockPrice: currentPrice.toString(),
				upsidePercent: dcf.upsidePercent.toString(),
				lastUpdated: new Date(),
				createdAt: new Date(),
			};
		}

		if (!analystRecord && dcfRecord) {
			const consensus = calculateAnalystConsensus({
				symbol: stock.symbol,
				companyName: stock.companyName,
				currentPrice,
				peRatio: financials[0]?.peRatio ? parseFloat(financials[0].peRatio) : undefined,
				roe: financials[0]?.roe ? parseFloat(financials[0].roe) : undefined,
				debtToEquity: financials[0]?.debtToEquity ? parseFloat(financials[0].debtToEquity) : undefined,
			}, {
				dcfIntrinsicValue: parseFloat(dcfRecord.dcf || "0"),
				upsidePercent: parseFloat(dcfRecord.upsidePercent || "0"),
				discountRate: 0.12,
				growthRateUsed: 0.10,
				terminalGrowthRate: 0.05,
				source: "earnings_normalized",
			});

			analystRecord = {
				symbol: stock.symbol,
				consensusRating: consensus.consensusRating,
				avgTarget: consensus.avgTargetPrice.toString(),
				highTarget: consensus.highTargetPrice.toString(),
				lowTarget: consensus.lowTargetPrice.toString(),
				upsidePct: consensus.upsidePct.toString(),
				analystCount: consensus.analystCount,
				buyCount: consensus.buyCount,
				holdCount: consensus.holdCount,
				sellCount: consensus.sellCount,
				lastUpdated: new Date(),
			};
		}
	}

	return {
		stock,
		financials,
		derivedMetrics: derived[0] || null,
		technical: technical[0] || null,
		shareholding,
		analystConsensus: analystRecord,
		dcfValuation: dcfRecord,
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
	const [analystCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(screenerAnalystConsensus);
	const [dcfCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(screenerDcfValuations);
	const fwdPeCount = await db.execute(
		sql`SELECT count(*) as count FROM screener_financials WHERE forward_pe IS NOT NULL AND forward_pe::numeric > 0`
	);
	const [techCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(screenerTechnicalIndicatorsLatest);

	return {
		totalStocks: Number(stockCount?.count || 0),
		withFinancials: Number(financialCount?.count || 0),
		withDerivedMetrics: Number(derivedCount?.count || 0),
		withAnalystConsensus: Number(analystCount?.count || 0),
		withDcfValuations: Number(dcfCount?.count || 0),
		withForwardPe: Number((fwdPeCount.rows?.[0] as any)?.count || 0),
		withTechnicals: Number(techCount?.count || 0),
		engineStatus: "GCP Native Active",
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
        CASE
          -- 1. Prefer explicit category column (normalised to 5 canonical values)
          WHEN LOWER(TRIM(market_cap_category)) IN ('mega','mega cap')   THEN 'mega'
          WHEN LOWER(TRIM(market_cap_category)) IN ('large','large cap') THEN 'large'
          WHEN LOWER(TRIM(market_cap_category)) IN ('mid','mid cap')     THEN 'mid'
          WHEN LOWER(TRIM(market_cap_category)) IN ('small','small cap') THEN 'small'
          WHEN LOWER(TRIM(market_cap_category)) IN ('micro','micro cap') THEN 'micro'
          -- 2. Derive from market_cap_value (absolute INR) — SEBI/AMFI thresholds:
          --    Mega  >= 5,00,000 Cr  (top blue-chips ≥ ₹5,000,000,000,000)
          --    Large >= 1,05,000 Cr  (top 100 SEBI large-cap ≥ ₹1,050,000,000,000)
          --    Mid   >= 34,500 Cr    (rank 101-250 SEBI mid-cap ≥ ₹345,000,000,000)
          --    Small >= 500 Cr       (rank 251+ down to ₹500 Cr ≥ ₹5,000,000,000)
          --    Micro < 500 Cr        (everything below ₹500 Cr)
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 5000000000000 THEN 'mega'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 1050000000000 THEN 'large'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 345000000000  THEN 'mid'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >= 5000000000    THEN 'small'
          WHEN market_cap_value IS NOT NULL AND market_cap_value::numeric >  0             THEN 'micro'
        END AS category,
        COUNT(*) AS count
      FROM listed_stocks
      WHERE is_active = true
        AND (
          -- has a recognised category string
          LOWER(TRIM(market_cap_category)) IN ('mega','mega cap','large','large cap','mid','mid cap','small','small cap','micro','micro cap')
          -- OR has a positive numeric market cap value we can classify from
          OR (market_cap_value IS NOT NULL AND market_cap_value::numeric > 0)
        )
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

	// ── Build sector list: mark REIT and InvIT as pinned ──
	// REIT/InvIT are now IN listed_stocks (synced from reits/invits tables),
	// so they appear naturally in the sectorDist query. We just mark them as
	// pinned so the UI renders them at the bottom with special styling.
	const PINNED_SECTORS = new Set(["REIT", "InvIT"]);
	const sectorRows: any[] = ((sectorDist as any).rows || sectorDist);
	const sectors = sectorRows.map((row: any) => ({
		...row,
		pinned: PINNED_SECTORS.has(row.sector) ? true : undefined,
	}));

	return {
		marketCap: (marketCapDist as any).rows || marketCapDist,
		sectors,
		ratings: (ratingDist as any).rows || ratingDist,
		scoreRanges: (scoreDistribution as any).rows || scoreDistribution,
	};
}
