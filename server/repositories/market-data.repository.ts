/**
 * @file market-data.repository.ts
 * @description Foundation Data Access Layer (DAL) for Market Data, Bhavcopy, and MCX Commodity Quotes.
 *
 * Adheres strictly to FintekPro GCR v1.0:
 * - Layered architecture: Encapsulates all Drizzle ORM operations on market data
 * - Strict typing with zero 'any' unless justified
 * - Telemetry tracking on all database queries
 */

import { eq, desc } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
	mcxCommodityQuotes,
	goldenPrices,
	type McxCommodityQuote,
	type InsertMcxCommodityQuote,
	type GoldenPrice,
} from "@shared/schema/pricing";

export class MarketDataRepository extends BaseRepository {
	private static instance: MarketDataRepository;

	public static getInstance(): MarketDataRepository {
		if (!MarketDataRepository.instance) {
			MarketDataRepository.instance = new MarketDataRepository();
		}
		return MarketDataRepository.instance;
	}

	/**
	 * Get the most recent quote for a commodity symbol (e.g. "GOLD", "SILVER", "CRUDE_OIL")
	 */
	async getLatestCommodityQuote(commoditySymbol: string): Promise<McxCommodityQuote | null> {
		return this.withTelemetry("MarketDataRepository.getLatestCommodityQuote", async () => {
			const rows = await this.db
				.select()
				.from(mcxCommodityQuotes)
				.where(eq(mcxCommodityQuotes.commoditySymbol, commoditySymbol.toUpperCase()))
				.orderBy(desc(mcxCommodityQuotes.syncedAt), desc(mcxCommodityQuotes.updatedAt))
				.limit(1);
			return rows[0] || null;
		});
	}

	/**
	 * Upsert a commodity quote deterministically
	 */
	async upsertCommodityQuote(data: InsertMcxCommodityQuote): Promise<McxCommodityQuote> {
		return this.withTelemetry("MarketDataRepository.upsertCommodityQuote", async () => {
			const rows = await this.db
				.insert(mcxCommodityQuotes)
				.values(data)
				.onConflictDoUpdate({
					target: [mcxCommodityQuotes.commoditySymbol, mcxCommodityQuotes.instrumentKey],
					set: {
						price: data.price,
						openPrice: data.openPrice,
						highPrice: data.highPrice,
						lowPrice: data.lowPrice,
						previousClose: data.previousClose,
						volume: data.volume,
						source: data.source,
						updatedAt: new Date(),
					},
				})
				.returning();
			return rows[0];
		});
	}

	/**
	 * Get benchmark indices (e.g. NIFTY 50, SENSEX, BANKNIFTY) from golden prices
	 */
	async getBenchmarkIndices(): Promise<GoldenPrice[]> {
		return this.withTelemetry("MarketDataRepository.getBenchmarkIndices", async () => {
			return this.db
				.select()
				.from(goldenPrices)
				.where(eq(goldenPrices.assetClass, "EQUITY_INDEX"))
				.orderBy(desc(goldenPrices.priceDate));
		});
	}
}
