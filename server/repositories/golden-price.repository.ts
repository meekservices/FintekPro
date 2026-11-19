/**
 * @file golden-price.repository.ts
 * @description Foundation Data Access Layer (DAL) for the Single Source of Truth (SSOT) Golden Prices table.
 *
 * Adheres strictly to FintekPro GCR v1.0:
 * - Layered architecture: Encapsulates all Drizzle ORM operations on golden_prices
 * - Strict typing with zero 'any' unless justified
 * - Telemetry tracking on all database queries
 * - Safe retries and deterministic errors
 */

import { eq, and, desc, inArray, sql, gte, lte } from "drizzle-orm";
import { BaseRepository } from "./base.repository";
import {
	goldenPrices,
	type GoldenPrice,
	type InsertGoldenPrice,
} from "@shared/schema/pricing";

export class GoldenPriceRepository extends BaseRepository {
	private static instance: GoldenPriceRepository;

	public static getInstance(): GoldenPriceRepository {
		if (!GoldenPriceRepository.instance) {
			GoldenPriceRepository.instance = new GoldenPriceRepository();
		}
		return GoldenPriceRepository.instance;
	}

	/**
	 * Resolves the most recent verified price for a specific ISIN.
	 */
	async getLatestByIsin(isin: string): Promise<GoldenPrice | null> {
		return this.withTelemetry("GoldenPriceRepository.getLatestByIsin", async () => {
			const rows = await this.db
				.select()
				.from(goldenPrices)
				.where(eq(goldenPrices.isin, isin))
				.orderBy(desc(goldenPrices.priceDate), desc(goldenPrices.updatedAt))
				.limit(1);

			return rows[0] || null;
		});
	}

	/**
	 * Resolves the most recent price for a trading symbol (e.g. "NIFTY50", "US10Y", "GOLD").
	 */
	async getLatestBySymbol(symbol: string): Promise<GoldenPrice | null> {
		return this.withTelemetry("GoldenPriceRepository.getLatestBySymbol", async () => {
			const rows = await this.db
				.select()
				.from(goldenPrices)
				.where(eq(goldenPrices.symbol, symbol))
				.orderBy(desc(goldenPrices.priceDate), desc(goldenPrices.updatedAt))
				.limit(1);

			return rows[0] || null;
		});
	}

	/**
	 * Resolves the latest records for a batch of macroeconomic benchmark ISINs.
	 */
	async getMacroBenchmarks(isins: string[]): Promise<GoldenPrice[]> {
		if (!isins || isins.length === 0) return [];

		return this.withTelemetry("GoldenPriceRepository.getMacroBenchmarks", async () => {
			return this.db
				.select()
				.from(goldenPrices)
				.where(inArray(goldenPrices.isin, isins))
				.orderBy(desc(goldenPrices.priceDate));
		});
	}

	/**
	 * Retrieves time-series historical observations for quantitative models.
	 */
	async getTimeSeries(
		isin: string,
		startDate: string,
		endDate: string,
	): Promise<GoldenPrice[]> {
		return this.withTelemetry("GoldenPriceRepository.getTimeSeries", async () => {
			return this.db
				.select()
				.from(goldenPrices)
				.where(
					and(
						eq(goldenPrices.isin, isin),
						gte(goldenPrices.priceDate, startDate),
						lte(goldenPrices.priceDate, endDate),
					),
				)
				.orderBy(desc(goldenPrices.priceDate));
		});
	}

	/**
	 * Upserts a single verified golden price into PostgreSQL using an idempotent ON CONFLICT clause.
	 */
	async upsertPrice(data: InsertGoldenPrice): Promise<void> {
		return this.withTelemetry("GoldenPriceRepository.upsertPrice", async () => {
			await this.db
				.insert(goldenPrices)
				.values(data)
				.onConflictDoUpdate({
					target: [goldenPrices.isin, goldenPrices.priceDate],
					set: {
						price: data.price,
						symbol: data.symbol,
						changePercent: data.changePercent,
						source: data.source,
						confidenceScore: data.confidenceScore ?? 50,
						metadata: data.metadata,
						isStale: false,
						updatedAt: sql`NOW()`,
					},
				});
		});
	}
}

export const goldenPriceRepository = GoldenPriceRepository.getInstance();
