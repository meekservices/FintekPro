/**
 * @file upstox-provider.ts
 * @description Upstox Developer API v2 data provider for FintekPro's stock screener engine.
 *
 * Implements IDataProvider using the SEBI-licensed Upstox Market Data Feed.
 * Acts as Tier 0 Primary Provider for real-time market quotes and historical OHLCV candles.
 * Explicitly delegates fundamental statements (P&L, Balance Sheet, Ratios) to IndianAPI.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 * Architecture: Tier 0 Real-Time Pricing & Market Data Provider
 */

import { upstoxMarketDataService } from "../upstox-market-data-service";
import { cleanIndianTicker } from "../indian-api-service";
import { logger } from "../../logger";
import type {
	IDataProvider,
	CompanyProfile,
	FinancialRatios,
	FinancialStatement,
	HistoricalPrice,
	StockScreenerResult,
} from "./data-provider";

export class UpstoxDataProvider implements IDataProvider {
	public readonly name = "UPSTOX";

	/**
	 * Real-time quote provider (Tier 0).
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
			if (!upstoxMarketDataService.isReady()) {
				return null;
			}

			const cleanSymbol = cleanIndianTicker(symbol);
			const res = await upstoxMarketDataService.getQuote(cleanSymbol, "NSE");
			if (!res.success || !res.data || !res.data.last_price) {
				return null;
			}

			const q = res.data;
			return {
				price: q.last_price,
				change: q.change ?? 0,
				changePercent: q.change_percent ?? 0,
				volume: q.volume ?? 0,
			};
		} catch (error: any) {
			logger.warn(`[UpstoxProvider] getQuote failed for ${symbol}: ${error.message}`);
			return null;
		}
	}

	/**
	 * Historical daily OHLCV candles provider (Tier 0).
	 */
	async getHistoricalPrices(
		symbol: string,
		from?: string,
		to?: string,
	): Promise<HistoricalPrice[]> {
		try {
			if (!upstoxMarketDataService.isReady()) {
				return [];
			}

			const cleanSymbol = cleanIndianTicker(symbol);
			const toDate = to || new Date().toISOString().split("T")[0];
			let fromDate = from;
			if (!fromDate) {
				const d = new Date();
				d.setFullYear(d.getFullYear() - 1);
				fromDate = d.toISOString().split("T")[0];
			}

			const res = await upstoxMarketDataService.getHistoricalData(
				cleanSymbol,
				"day",
				fromDate,
				toDate,
				"NSE",
			);

			if (!res.success || !Array.isArray(res.data) || res.data.length === 0) {
				return [];
			}

			return res.data.map((c) => {
				const chgPct = c.open > 0 ? ((c.close - c.open) / c.open) * 100 : 0;
				const dateStr = c.timestamp.includes("T") ? c.timestamp.split("T")[0] : c.timestamp;
				return {
					symbol: cleanSymbol,
					date: dateStr,
					open: c.open,
					high: c.high,
					low: c.low,
					close: c.close,
					adjClose: c.close,
					volume: c.volume,
					changePercent: chgPct,
				};
			});
		} catch (error: any) {
			logger.warn(`[UpstoxProvider] getHistoricalPrices failed for ${symbol}: ${error.message}`);
			return [];
		}
	}

	/**
	 * Upstox does not provide fundamental corporate profiles — returns null to trigger fallback to IndianAPI.
	 */
	async getCompanyProfile(_symbol: string): Promise<CompanyProfile | null> {
		return null;
	}

	/**
	 * Upstox does not provide multi-year financial ratios — returns null to trigger fallback to IndianAPI.
	 */
	async getRatios(_symbol: string): Promise<FinancialRatios | null> {
		return null;
	}

	/**
	 * Upstox does not provide income statements — returns [] to trigger fallback to IndianAPI.
	 */
	async getIncomeStatement(
		_symbol: string,
		_period = "annual",
	): Promise<FinancialStatement[]> {
		return [];
	}

	/**
	 * Upstox does not provide balance sheets — returns [] to trigger fallback to IndianAPI.
	 */
	async getBalanceSheet(
		_symbol: string,
		_period = "annual",
	): Promise<FinancialStatement[]> {
		return [];
	}

	/**
	 * Upstox does not provide cash flow statements — returns [] to trigger fallback to IndianAPI.
	 */
	async getCashFlow(
		_symbol: string,
		_period = "annual",
	): Promise<FinancialStatement[]> {
		return [];
	}

	/**
	 * Upstox does not provide an open universe screener endpoint — returns [] to trigger fallback to IndianAPI.
	 */
	async getStockScreener(
		_marketCapMin?: number,
		_exchange?: string,
		_limit = 50,
	): Promise<StockScreenerResult[]> {
		return [];
	}
}

let upstoxProviderInstance: UpstoxDataProvider | null = null;

export function getUpstoxDataProvider(): UpstoxDataProvider {
	if (!upstoxProviderInstance) {
		upstoxProviderInstance = new UpstoxDataProvider();
	}
	return upstoxProviderInstance;
}

