/**
 * Unified Stock Price Service
 *
 * DB-first pattern:
 * - After every successful API fetch, write price to listed_stocks (async, non-blocking)
 * - If all providers fail, serve last-known price from listed_stocks (stale-serve)
 *
 * Load-sharing strategy (confirmed working from datacenter):
 *   NSE library  → PRIMARY for all NSE-listed stocks (exchange-direct, best quality)
 *   Google Finance HTML → SECONDARY for NSE stocks + PRIMARY for BSE stocks
 *   Yahoo Finance → LAST RESORT only — rate-limited (429) from datacenter; 30-min cooldown after first failure
 *   BSE API direct → REMOVED — 301-redirect blocked from datacenter
 *   FMP → Available if FMP_API_KEY is set (optional)
 */

import { requestDedupeService } from "./request-deduplication-service";
import { NseIndia } from "stock-nse-india";
import yahooFinance from "yahoo-finance2";
import axios from "axios";
import { fetchGFQuote } from "./google-finance-service";
import { db } from "../db";
import { sql } from "drizzle-orm";

yahooFinance.suppressNotices(["yahooSurvey"]);

interface StockPrice {
	symbol: string;
	price: number;
	previousClose?: number;
	change?: number;
	changePercent?: number;
	high?: number;
	low?: number;
	open?: number;
	volume?: number;
	timestamp: number;
	source:
		| "NSE"
		| "BSE"
		| "YAHOO"
		| "FMP"
		| "GOOGLE_FINANCE"
		| "CACHE"
		| "DB_STALE";
}

interface ProviderHealth {
	consecutiveFailures: number;
	lastFailure: number;
	cooldownUntil: number;
}

interface CacheEntry {
	data: StockPrice;
	expiresAt: number;
}

interface BatchResult {
	prices: Map<string, StockPrice>;
	errors: Map<string, string>;
	fromCache: number;
	fromApi: number;
}

const CACHE_TTL = {
	REALTIME: 15 * 1000, // 15 seconds for real-time quotes
	INTRADAY: 60 * 1000, // 1 minute for intraday
	EOD: 6 * 60 * 60 * 1000, // 6 hours for end-of-day
};

class UnifiedStockPriceService {
	private cache: Map<string, CacheEntry> = new Map();
	private nseClient: NseIndia;
	private providerHealth: Map<string, ProviderHealth> = new Map();
	private cleanupIntervalId: NodeJS.Timeout | null = null;
	private metrics = {
		cacheHits: 0,
		cacheMisses: 0,
		apiCalls: 0,
		errors: 0,
		batchRequests: 0,
		dbStaleServes: 0,
		dbWritebacks: 0,
	};

	constructor() {
		this.nseClient = new NseIndia();
		this.startCleanupInterval();
		console.log("✅ Unified Stock Price Service initialized");
	}

	private startCleanupInterval(): void {
		if (this.cleanupIntervalId) return;

		this.cleanupIntervalId = setInterval(() => {
			const now = Date.now();
			let cleaned = 0;
			for (const [key, entry] of this.cache.entries()) {
				if (entry.expiresAt < now) {
					this.cache.delete(key);
					cleaned++;
				}
			}
			if (cleaned > 0) {
				console.log(`[StockPriceCache] Cleaned ${cleaned} expired entries`);
			}
		}, 60 * 1000);
	}

	stop(): void {
		if (this.cleanupIntervalId) {
			clearInterval(this.cleanupIntervalId);
			this.cleanupIntervalId = null;
		}
	}

	private getCacheKey(symbol: string, exchange?: string): string {
		return `${symbol.toUpperCase()}:${exchange || "ANY"}`;
	}

	private getFromCache(symbol: string, exchange?: string): StockPrice | null {
		const key = this.getCacheKey(symbol, exchange);
		const entry = this.cache.get(key);

		if (entry && entry.expiresAt > Date.now()) {
			this.metrics.cacheHits++;
			return { ...entry.data, source: "CACHE" };
		}

		if (entry) {
			this.cache.delete(key);
		}

		this.metrics.cacheMisses++;
		return null;
	}

	private setCache(
		symbol: string,
		price: StockPrice,
		ttl: number = CACHE_TTL.REALTIME,
		exchange?: string,
	): void {
		const key = this.getCacheKey(symbol, exchange);
		this.cache.set(key, {
			data: price,
			expiresAt: Date.now() + ttl,
		});
	}

	/**
	 * Write price data back to listed_stocks for stale-serve fallback.
	 * Non-blocking — fires and forgets.
	 */
	private writeToDb(price: StockPrice): void {
		const sym = price.symbol.toUpperCase();
		db.execute(sql`
      UPDATE listed_stocks
      SET
        current_price     = ${price.price},
        previous_close    = COALESCE(${price.previousClose ?? null}, previous_close),
        day_change_percent= COALESCE(${price.changePercent ?? null}, day_change_percent),
        last_updated      = NOW()
      WHERE symbol = ${sym}
    `)
			.then(() => {
				this.metrics.dbWritebacks++;
			})
			.catch((e: any) => {
				// Non-critical — just log quietly
				console.debug(
					`[StockPrice] DB write-back skipped for ${sym}: ${e?.message?.slice(0, 50)}`,
				);
			});
	}

	/**
	 * Last-resort: fetch most recent known price from listed_stocks when all live providers fail.
	 */
	private async fetchStaleFromDb(symbol: string): Promise<StockPrice | null> {
		try {
			const rows = await db.execute(sql`
        SELECT current_price, previous_close, day_change_percent, last_updated
        FROM listed_stocks
        WHERE symbol = ${symbol.toUpperCase()} AND current_price IS NOT NULL
        LIMIT 1
      `);
			const r = ((rows as any).rows ?? rows)[0] as any;
			if (!r || !r.current_price) return null;

			const price = Number.parseFloat(r.current_price);
			const prevClose = r.previous_close
				? Number.parseFloat(r.previous_close)
				: undefined;
			const chgPct = r.day_change_percent
				? Number.parseFloat(r.day_change_percent)
				: undefined;
			const lastUpdated = r.last_updated ? new Date(r.last_updated) : null;

			console.warn(
				`[StockPrice] All providers failed for ${symbol} — serving stale DB price ₹${price} (last updated: ${lastUpdated?.toISOString() ?? "unknown"})`,
			);
			this.metrics.dbStaleServes++;

			return {
				symbol,
				price,
				previousClose: prevClose,
				changePercent: chgPct,
				timestamp: lastUpdated?.getTime() ?? Date.now(),
				source: "DB_STALE",
			};
		} catch {
			return null;
		}
	}

	/**
	 * Get stock price for a single symbol
	 */
	async getPrice(
		symbol: string,
		exchange?: "NSE" | "BSE",
	): Promise<StockPrice | null> {
		const cached = this.getFromCache(symbol, exchange);
		if (cached) {
			return cached;
		}

		const dedupeKey = `stock_price:${symbol}:${exchange || "ANY"}`;

		return requestDedupeService.dedupe(dedupeKey, async () => {
			this.metrics.apiCalls++;

			try {
				const price = await this.fetchFromSource(symbol, exchange);
				if (price) {
					this.setCache(symbol, price, CACHE_TTL.REALTIME, exchange);
					// Write-back to DB for stale-serve fallback
					this.writeToDb(price);
					return price;
				}

				// All live providers failed — try stale DB as last resort
				const stalePrice = await this.fetchStaleFromDb(symbol);
				if (stalePrice) {
					this.setCache(symbol, stalePrice, CACHE_TTL.INTRADAY, exchange);
					return stalePrice;
				}

				return null;
			} catch (error: any) {
				this.metrics.errors++;
				console.error(
					`[StockPrice] Failed to fetch ${symbol}: ${error.message}`,
				);
				// Try stale DB on exception too
				return this.fetchStaleFromDb(symbol);
			}
		});
	}

	/**
	 * Batch fetch prices for multiple symbols
	 */
	async getBatchPrices(
		symbols: string[],
		exchange?: "NSE" | "BSE",
	): Promise<BatchResult> {
		this.metrics.batchRequests++;

		const result: BatchResult = {
			prices: new Map(),
			errors: new Map(),
			fromCache: 0,
			fromApi: 0,
		};

		const toFetch: string[] = [];

		for (const symbol of symbols) {
			const cached = this.getFromCache(symbol, exchange);
			if (cached) {
				result.prices.set(symbol, cached);
				result.fromCache++;
			} else {
				toFetch.push(symbol);
			}
		}

		if (toFetch.length === 0) {
			return result;
		}

		console.log(
			`[StockPrice] Batch fetching ${toFetch.length} symbols (${result.fromCache} from cache)`,
		);

		const batchSize = 5;
		for (let i = 0; i < toFetch.length; i += batchSize) {
			const batch = toFetch.slice(i, i + batchSize);

			const promises = batch.map(async (symbol) => {
				try {
					const price = await this.getPrice(symbol, exchange);
					if (price) {
						result.prices.set(symbol, price);
						result.fromApi++;
					} else {
						result.errors.set(symbol, "No data available");
					}
				} catch (error: any) {
					result.errors.set(symbol, error.message);
				}
			});

			await Promise.all(promises);

			if (i + batchSize < toFetch.length) {
				await new Promise((resolve) => setTimeout(resolve, 2000));
			}
		}

		return result;
	}

	private isProviderCoolingDown(provider: string): boolean {
		const health = this.providerHealth.get(provider);
		if (!health) return false;
		return Date.now() < health.cooldownUntil;
	}

	private recordSuccess(provider: string): void {
		this.providerHealth.set(provider, {
			consecutiveFailures: 0,
			lastFailure: 0,
			cooldownUntil: 0,
		});
	}

	private recordFailure(provider: string, isRateLimit: boolean = false): void {
		const health = this.providerHealth.get(provider) || {
			consecutiveFailures: 0,
			lastFailure: 0,
			cooldownUntil: 0,
		};
		health.consecutiveFailures++;
		health.lastFailure = Date.now();
		const threshold = isRateLimit ? 1 : 3;
		if (health.consecutiveFailures >= threshold) {
			const cooldownMs = isRateLimit ? 15 * 60 * 1000 : 10 * 60 * 1000;
			health.cooldownUntil = Date.now() + cooldownMs;
			console.warn(
				`[StockPrice] Provider ${provider} put on ${cooldownMs / 60000}-minute cooldown after ${health.consecutiveFailures} consecutive failures${isRateLimit ? " (rate limited)" : ""}`,
			);
		}
		this.providerHealth.set(provider, health);
	}

	private isRateLimitError(error: any): boolean {
		const msg = String(error?.message || "").toLowerCase();
		return (
			msg.includes("too many requests") ||
			msg.includes("429") ||
			msg.includes("rate limit")
		);
	}

	private async fetchFromGoogleFinance(
		symbol: string,
		exchange: "NSE" | "BSE" = "NSE",
	): Promise<StockPrice | null> {
		try {
			const gfQuote = await fetchGFQuote(symbol, exchange);
			if (gfQuote?.price) {
				return {
					symbol,
					price: gfQuote.price,
					previousClose: gfQuote.previousClose ?? undefined,
					change: gfQuote.change ?? undefined,
					changePercent: gfQuote.changePercent ?? undefined,
					// Use exchange-recorded timestamp if available, else now
					timestamp: gfQuote.marketTimestampUnix
						? gfQuote.marketTimestampUnix * 1000
						: Date.now(),
					source: "GOOGLE_FINANCE" as const,
				};
			}
		} catch (error: any) {
			console.warn(
				`[StockPrice] Google Finance fetch failed for ${symbol}: ${error.message}`,
			);
		}
		return null;
	}

	private async fetchFromYahoo(symbol: string): Promise<StockPrice | null> {
		try {
			const yahooSymbol = `${symbol}.NS`;
			const quote = await yahooFinance.quote(yahooSymbol);
			if (quote?.regularMarketPrice) {
				return {
					symbol,
					price: quote.regularMarketPrice,
					previousClose: quote.regularMarketPreviousClose,
					change: quote.regularMarketChange,
					changePercent: quote.regularMarketChangePercent,
					high: quote.regularMarketDayHigh,
					low: quote.regularMarketDayLow,
					open: quote.regularMarketOpen,
					volume: quote.regularMarketVolume,
					timestamp: Date.now(),
					source: "YAHOO" as const,
				};
			}
		} catch (error: any) {
			if (this.isRateLimitError(error)) {
				// Yahoo is confirmed rate-limited (429) from datacenter — 30-min cooldown
				const health = this.providerHealth.get("yahoo") || {
					consecutiveFailures: 0,
					lastFailure: 0,
					cooldownUntil: 0,
				};
				health.consecutiveFailures++;
				health.lastFailure = Date.now();
				health.cooldownUntil = Date.now() + 30 * 60 * 1000;
				this.providerHealth.set("yahoo", health);
				console.warn(
					`[StockPrice] Yahoo rate-limited (429) — 30-min cooldown applied`,
				);
				throw new Error("RATE_LIMITED:yahoo");
			}
			console.warn(
				`[StockPrice] Yahoo fetch failed for ${symbol}: ${error.message}`,
			);
		}
		return null;
	}

	private async fetchFromFMP(symbol: string): Promise<StockPrice | null> {
		const apiKey = process.env.FMP_API_KEY;
		if (!apiKey) return null;
		try {
			const fmpSymbol = `${symbol}.NS`;
			const response = await axios.get(
				`https://financialmodelingprep.com/stable/profile`,
				{
					params: { symbol: fmpSymbol, apikey: apiKey },
					timeout: 10000,
				},
			);
			const data = response.data?.[0];
			if (data?.price) {
				return {
					symbol,
					price: data.price,
					previousClose: undefined,
					change: data.change,
					changePercent: data.changePercentage,
					high: undefined,
					low: undefined,
					open: undefined,
					volume: data.volume,
					timestamp: Date.now(),
					source: "FMP" as const,
				};
			}
		} catch (error: any) {
			console.warn(
				`[StockPrice] FMP fetch failed for ${symbol}: ${error.message}`,
			);
		}
		return null;
	}

	/**
	 * Fetch from available sources with priority-based fallback.
	 *
	 * Confirmed working from datacenter:
	 *   1. NSE library   — exchange-direct, best data quality
	 *   2. FMP           — optional, requires FMP_API_KEY
	 *   3. Google Finance HTML — works for NSE and BSE stocks
	 *
	 * Last resort (rate-limited from datacenter):
	 *   4. Yahoo Finance — 429 Too Many Requests; 30-min cooldown after first failure
	 *
	 * Removed:
	 *   BSE API direct — 301-redirect blocked from datacenter
	 */
	private async fetchFromSource(
		symbol: string,
		exchange?: "NSE" | "BSE",
	): Promise<StockPrice | null> {
		// 1. NSE library (exchange-direct, highest quality)
		if (
			(exchange === "NSE" || !exchange) &&
			!this.isProviderCoolingDown("nse")
		) {
			const nsePrice = await this.fetchFromNSE(symbol);
			if (nsePrice) {
				this.recordSuccess("nse");
				return nsePrice;
			}
			this.recordFailure("nse");
		}

		// 2. FMP (optional, if API key configured)
		if (!this.isProviderCoolingDown("fmp")) {
			const fmpPrice = await this.fetchFromFMP(symbol);
			if (fmpPrice) {
				this.recordSuccess("fmp");
				return fmpPrice;
			}
			this.recordFailure("fmp");
		}

		// 3. Google Finance HTML (works from datacenter — primary for BSE, secondary for NSE)
		if (!this.isProviderCoolingDown("google_finance")) {
			const gfExchange = exchange || "NSE";
			const gfPrice = await this.fetchFromGoogleFinance(symbol, gfExchange);
			if (gfPrice) {
				this.recordSuccess("google_finance");
				return gfPrice;
			}
			this.recordFailure("google_finance");
		}

		// 4. Yahoo Finance (LAST RESORT — rate-limited from datacenter, 30-min cooldown)
		if (!this.isProviderCoolingDown("yahoo")) {
			try {
				const yahooPrice = await this.fetchFromYahoo(symbol);
				if (yahooPrice) {
					this.recordSuccess("yahoo");
					return yahooPrice;
				}
				this.recordFailure("yahoo");
			} catch (err: any) {
				if (!String(err?.message).startsWith("RATE_LIMITED:")) {
					this.recordFailure("yahoo");
				}
			}
		}

		return null;
	}

	private async fetchFromNSE(symbol: string): Promise<StockPrice | null> {
		try {
			const quote = await this.nseClient.getEquityDetails(symbol);
			if (quote?.priceInfo) {
				return {
					symbol,
					price: quote.priceInfo.lastPrice || 0,
					previousClose: quote.priceInfo.previousClose,
					change: quote.priceInfo.change,
					changePercent: quote.priceInfo.pChange,
					high: quote.priceInfo.intraDayHighLow?.max,
					low: quote.priceInfo.intraDayHighLow?.min,
					open: quote.priceInfo.open,
					timestamp: Date.now(),
					source: "NSE",
				};
			}
		} catch (error: any) {
			console.warn(
				`[StockPrice] NSE fetch failed for ${symbol}: ${error.message}`,
			);
		}
		return null;
	}

	async prefetchWatchlist(symbols: string[]): Promise<void> {
		console.log(`[StockPrice] Prefetching ${symbols.length} symbols...`);
		await this.getBatchPrices(symbols);
	}

	async warmCache(
		popularSymbols: string[] = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICIBANK"],
	): Promise<void> {
		console.log(
			`[StockPrice] Warming cache with ${popularSymbols.length} popular symbols...`,
		);
		await this.getBatchPrices(popularSymbols);
	}

	getMetrics() {
		const hitRate =
			this.metrics.cacheHits + this.metrics.cacheMisses > 0
				? (
						(this.metrics.cacheHits /
							(this.metrics.cacheHits + this.metrics.cacheMisses)) *
						100
					).toFixed(2)
				: "0.00";

		return {
			...this.metrics,
			cacheSize: this.cache.size,
			hitRate: `${hitRate}%`,
		};
	}

	resetMetrics(): void {
		this.metrics = {
			cacheHits: 0,
			cacheMisses: 0,
			apiCalls: 0,
			errors: 0,
			batchRequests: 0,
			dbStaleServes: 0,
			dbWritebacks: 0,
		};
	}
}

export const unifiedStockPriceService = new UnifiedStockPriceService();
