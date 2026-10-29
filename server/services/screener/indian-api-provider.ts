/**
 * @file indian-api-provider.ts
 * @description IndianAPI.in data provider implementation for FintekPro's stock screener engine.
 *
 * Implements IDataProvider using the India-native IndianAPI gateway (analyst.indianapi.in).
 * Provides multi-year financial statements (P&L, Balance Sheet, Cash Flow), valuation ratios,
 * and company profiles across 2,000+ NSE/BSE listed equities.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 * Architecture: Tier 1 Fundamental & Corporate Intelligence Provider
 */

import { indianApiService, cleanIndianTicker } from "../indian-api-service";
import { logger } from "../../logger";
import type {
	IDataProvider,
	CompanyProfile,
	FinancialRatios,
	FinancialStatement,
	HistoricalPrice,
	StockScreenerResult,
} from "./data-provider";

export class IndianApiDataProvider implements IDataProvider {
	public readonly name = "INDIAN_API";

	/**
	 * Fetches company profile and classification metadata for an Indian equity.
	 *
	 * @param symbol Stock ticker (e.g., "RELIANCE", "TCS")
	 */
	async getCompanyProfile(symbol: string): Promise<CompanyProfile | null> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getCompanyProfile(cleanSymbol);
			if (!res.success || !res.data) {
				return null;
			}

			const p = res.data;
			return {
				symbol: p.symbol || cleanSymbol,
				companyName: p.company_name || cleanSymbol,
				exchange: p.exchange || "NSE",
				sector: p.sector || "Unknown",
				industry: p.industry || "Unknown",
				marketCap: p.market_cap || 0,
				price: 0,
				currency: "INR",
				country: "IN",
				isin: p.isin,
				description: p.description,
			};
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getCompanyProfile failed for ${symbol}: ${error.message}`);
			return null;
		}
	}

	/**
	 * Fetches key financial valuation ratios (P/E, P/B, ROE, ROCE, Debt/Equity).
	 *
	 * @param symbol Stock ticker
	 */
	async getRatios(symbol: string): Promise<FinancialRatios | null> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getRatios(cleanSymbol);
			if (!res.success || !res.data) {
				return null;
			}

			const r = res.data;
			return {
				symbol: cleanSymbol,
				period: "FY",
				date: new Date().toISOString().split("T")[0],
				peRatio: r.pe_ratio,
				pegRatio: r.peg_ratio,
				pbRatio: r.pb_ratio,
				roe: r.roe,
				roce: r.roce,
				roa: r.roa,
				debtToEquity: r.debt_equity,
				currentRatio: r.current_ratio,
				quickRatio: r.quick_ratio,
				interestCoverage: r.interest_coverage,
				dividendYield: r.dividend_yield,
			};
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getRatios failed for ${symbol}: ${error.message}`);
			return null;
		}
	}

	/**
	 * Fetches multi-year Income Statement (Profit & Loss).
	 *
	 * @param symbol Stock ticker
	 * @param period "annual" or "quarterly"
	 */
	async getIncomeStatement(
		symbol: string,
		period = "annual",
	): Promise<FinancialStatement[]> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getProfitLoss(cleanSymbol, 5);
			if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
				return [];
			}

			return res.data.map((row) => ({
				symbol: cleanSymbol,
				date: row.year || "FY",
				period,
				revenue: row.revenue,
				netIncome: row.pat,
				grossProfit: row.gross_profit,
				operatingIncome: row.ebit ?? row.ebitda,
			}));
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getIncomeStatement failed for ${symbol}: ${error.message}`);
			return [];
		}
	}

	/**
	 * Fetches multi-year Balance Sheet statement.
	 *
	 * @param symbol Stock ticker
	 * @param period "annual" or "quarterly"
	 */
	async getBalanceSheet(
		symbol: string,
		period = "annual",
	): Promise<FinancialStatement[]> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getBalanceSheet(cleanSymbol, 5);
			if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
				return [];
			}

			return res.data.map((row) => ({
				symbol: cleanSymbol,
				date: row.year || "FY",
				period,
				totalDebt: row.total_debt,
				totalEquity: row.networth,
				totalAssets: row.total_assets,
				currentLiabilities: row.current_liabilities,
			}));
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getBalanceSheet failed for ${symbol}: ${error.message}`);
			return [];
		}
	}

	/**
	 * Fetches multi-year Cash Flow statement.
	 *
	 * @param symbol Stock ticker
	 * @param period "annual" or "quarterly"
	 */
	async getCashFlow(
		symbol: string,
		period = "annual",
	): Promise<FinancialStatement[]> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getCashFlow(cleanSymbol, 5);
			if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
				return [];
			}

			return res.data.map((row) => ({
				symbol: cleanSymbol,
				date: row.year || "FY",
				period,
				operatingCashFlow: row.operating_cash_flow,
				freeCashFlow: row.free_cash_flow,
				capitalExpenditure: row.capex,
			}));
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getCashFlow failed for ${symbol}: ${error.message}`);
			return [];
		}
	}

	/**
	 * Fetches historical price bars for an Indian stock.
	 *
	 * @param symbol Stock ticker
	 * @param from   Optional start date (YYYY-MM-DD)
	 * @param to     Optional end date (YYYY-MM-DD)
	 */
	async getHistoricalPrices(
		symbol: string,
		from?: string,
		to?: string,
	): Promise<HistoricalPrice[]> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getHistoricalData(cleanSymbol, "1y");
			if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
				return [];
			}

			const fromTs = from ? new Date(from).getTime() : 0;
			const toTs = to ? new Date(to).getTime() : Number.MAX_SAFE_INTEGER;

			return res.data
				.filter((p: any) => {
					if (!p.date) return false;
					const ts = new Date(p.date).getTime();
					return ts >= fromTs && ts <= toTs;
				})
				.map((p: any) => {
					const close = Number(p.close ?? p.price ?? 0);
					return {
						symbol: cleanSymbol,
						date: String(p.date),
						open: Number(p.open ?? close),
						high: Number(p.high ?? close),
						low: Number(p.low ?? close),
						close,
						adjClose: close,
						volume: Number(p.volume ?? 0),
						changePercent: Number(p.changePercent ?? 0),
					};
				});
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getHistoricalPrices failed for ${symbol}: ${error.message}`);
			return [];
		}
	}

	/**
	 * Fetches stock screener candidates via market activity/trending lists.
	 */
	async getStockScreener(
		_marketCapMin?: number,
		exchange: "NSE" | "BSE" = "NSE",
		limit = 50,
	): Promise<StockScreenerResult[]> {
		try {
			const res = await indianApiService.getTrending(exchange);
			if (!res.success || !Array.isArray(res.data)) {
				return [];
			}

			return res.data.slice(0, limit).map((s) => ({
				symbol: s.ticker,
				companyName: s.company,
				marketCap: 0,
				price: s.price,
				sector: "General",
				industry: "General",
				exchange,
				country: "IN",
			}));
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getStockScreener failed: ${error.message}`);
			return [];
		}
	}

	/**
	 * Fetches real-time stock quote as a fallback when Upstox is cooling down or missing.
	 *
	 * @param symbol Stock ticker
	 */
	async getQuote(
		symbol: string,
	): Promise<{
		price: number;
		change: number;
		changePercent: number;
		volume: number;
	} | null> {
		try {
			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await indianApiService.getStockQuote(cleanSymbol, "NSE");
			if (!res.success || !res.data || !res.data.current_price) {
				return null;
			}

			const q = res.data;
			return {
				price: q.current_price,
				change: q.change ?? 0,
				changePercent: q.change_percent ?? 0,
				volume: q.volume ?? 0,
			};
		} catch (error: any) {
			logger.warn(`[IndianApiProvider] getQuote failed for ${symbol}: ${error.message}`);
			return null;
		}
	}
}

let indianApiProviderInstance: IndianApiDataProvider | null = null;

export function getIndianApiDataProvider(): IndianApiDataProvider {
	if (!indianApiProviderInstance) {
		indianApiProviderInstance = new IndianApiDataProvider();
	}
	return indianApiProviderInstance;
}

