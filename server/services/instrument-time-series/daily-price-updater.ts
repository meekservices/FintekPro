import { db } from "../../db";
import {
	listedStocks,
	instrumentPrices,
	enrichmentJobLog,
	enrichmentRetryQueue,
} from "@shared/schema";
import { eq, and, sql, isNull, lte, or } from "drizzle-orm";
import { getProviderRegistry } from "../screener/data-provider-registry";
import { updateInstrumentPrice } from "../instrument-price-router";
import { logger } from "../../logger";

interface DailyUpdateResult {
	processed: number;
	skipped: number;
	errors: number;
	retried: number;
	apiCalls: number;
}

async function logJob(
	jobType: string,
	instrumentId: string | null,
	symbol: string | null,
	status: string,
	message: string | null,
	recordsProcessed: number = 0,
): Promise<void> {
	await db.insert(enrichmentJobLog).values({
		jobType,
		instrumentId,
		symbol,
		status,
		message,
		recordsProcessed,
	});
}

async function pushToRetryQueue(
	instrumentId: string,
	symbol: string,
	jobType: string,
	error: string,
): Promise<void> {
	const existing = await db
		.select()
		.from(enrichmentRetryQueue)
		.where(
			and(
				eq(enrichmentRetryQueue.instrumentId, instrumentId),
				eq(enrichmentRetryQueue.jobType, jobType),
				isNull(enrichmentRetryQueue.resolvedAt),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		const entry = existing[0];
		if (entry.retryCount >= entry.maxRetries) {
			await logJob(
				jobType,
				instrumentId,
				symbol,
				"MAX_RETRIES_EXCEEDED",
				`Retry cap (${entry.maxRetries}) reached: ${error}`,
			);
			return;
		}
		const backoffMinutes = 2 ** entry.retryCount * 15;
		await db
			.update(enrichmentRetryQueue)
			.set({
				retryCount: entry.retryCount + 1,
				lastError: error,
				nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
			})
			.where(eq(enrichmentRetryQueue.id, entry.id));
	} else {
		await db.insert(enrichmentRetryQueue).values({
			instrumentId,
			symbol,
			jobType: jobType,
			retryCount: 1,
			lastError: error,
			nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
		});
	}
}

export async function runDailyPriceUpdate(): Promise<DailyUpdateResult> {
	const result: DailyUpdateResult = {
		processed: 0,
		skipped: 0,
		errors: 0,
		retried: 0,
		apiCalls: 0,
	};
	const registry = getProviderRegistry();

	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	const yesterdayStr = yesterday.toISOString().split("T")[0];

	const instruments = await db
		.select({
			id: listedStocks.id,
			symbol: listedStocks.symbol,
			lastDailyUpdate: listedStocks.lastDailyUpdate,
		})
		.from(listedStocks)
		.where(
			and(
				eq(listedStocks.isActive, true),
				or(
					isNull(listedStocks.lastDailyUpdate),
					sql`${listedStocks.lastDailyUpdate} < ${yesterdayStr}::date`,
				),
			),
		);

	logger.info(
		`[DailyPriceUpdater] Found ${instruments.length} instruments needing update`,
	);

	// Fast batch path via Upstox (up to 200-500 symbols per single HTTP call)
	const { upstoxMarketDataService } = await import("../upstox-market-data-service");
	const isUpstoxReady = upstoxMarketDataService.isReady();

	const BATCH_SIZE = 200;
	for (let i = 0; i < instruments.length; i += BATCH_SIZE) {
		const batch = instruments.slice(i, i + BATCH_SIZE);
		const symbols = batch.map((inst) => inst.symbol).filter(Boolean) as string[];

		let quoteMap = new Map<string, any>();
		if (isUpstoxReady && symbols.length > 0) {
			try {
				const batchRes = await upstoxMarketDataService.getBatchQuotes(symbols, "NSE");
				result.apiCalls++;
				if (batchRes.success && batchRes.data) {
					quoteMap = batchRes.data;
				}
			} catch (err: any) {
				logger.warn("[DailyPriceUpdater] Upstox batch chunk failed, falling back to registry:", { error: err?.message });
			}
		}

		for (const instrument of batch) {
			try {
				if (!instrument.symbol) continue;
				const upperSym = instrument.symbol.toUpperCase();
				let price: number | null = null;
				let volume = 0;
				let change: number | undefined;
				let changePercent: number | undefined;

				const upstoxQuote = quoteMap.get(upperSym);
				if (upstoxQuote && upstoxQuote.last_price) {
					price = upstoxQuote.last_price;
					volume = upstoxQuote.volume || 0;
					change = upstoxQuote.change;
					changePercent = upstoxQuote.change_percent;
				} else {
					// Fallback to registry single quote
					const { result: quote } = await registry.getQuote(`${instrument.symbol}.NS`);
					result.apiCalls++;
					if (quote && quote.price) {
						price = quote.price;
						volume = quote.volume || 0;
						change = quote.change;
						changePercent = quote.changePercent;
					}
				}

				if (!price) {
					result.skipped++;
					continue;
				}

				await db.execute(sql`
					INSERT INTO instrument_prices (instrument_id, price_date, close_price, volume, change_percent, source)
					VALUES (${instrument.id}, ${yesterdayStr}::date, ${price}, ${volume}, ${changePercent || 0}, 'daily')
					ON CONFLICT (instrument_id, price_date) DO NOTHING
				`);

				await db
					.update(listedStocks)
					.set({
						lastDailyUpdate: sql`${yesterdayStr}::date`,
						currentPrice: price.toString(),
						dayChange: change?.toString(),
						dayChangePercent: changePercent?.toString(),
					})
					.where(eq(listedStocks.id, instrument.id));

				// Canonical price router — emits PRICE_UPDATED log for observability
				await updateInstrumentPrice({
					instrumentType: "equity",
					identifier: instrument.symbol,
					price: price,
					priceDate: yesterdayStr,
					source: "exchange",
					dayChangePercent: changePercent,
				});

				await logJob(
					"DAILY_UPDATE",
					instrument.id,
					instrument.symbol,
					"SUCCESS",
					null,
					1,
				);

				const retryEntry = await db
					.select()
					.from(enrichmentRetryQueue)
					.where(
						and(
							eq(enrichmentRetryQueue.instrumentId, instrument.id),
							eq(enrichmentRetryQueue.jobType, "DAILY_UPDATE"),
							isNull(enrichmentRetryQueue.resolvedAt),
						),
					)
					.limit(1);

				if (retryEntry.length > 0) {
					await db
						.update(enrichmentRetryQueue)
						.set({ resolvedAt: new Date() })
						.where(eq(enrichmentRetryQueue.id, retryEntry[0].id));
				}

				result.processed++;
			} catch (err: any) {
				result.errors++;
				await logJob(
					"DAILY_UPDATE",
					instrument.id,
					instrument.symbol,
					"FAILED",
					err.message,
				);
				await pushToRetryQueue(
					instrument.id,
					instrument.symbol || "",
					"DAILY_UPDATE",
					err.message,
				);
			}
		}
	}

	await processRetryQueue("DAILY_UPDATE", result, registry);

	logger.info(
		`[DailyPriceUpdater] Complete: ${result.processed} updated, ${result.skipped} skipped, ${result.errors} errors, ${result.retried} retries`,
	);
	await logJob(
		"DAILY_UPDATE_BATCH",
		null,
		null,
		"COMPLETE",
		`Processed: ${result.processed}, Skipped: ${result.skipped}, Errors: ${result.errors}, Retried: ${result.retried}`,
		result.processed,
	);

	return result;
}

async function processRetryQueue(
	jobType: string,
	result: DailyUpdateResult,
	registry: ReturnType<typeof getProviderRegistry>,
): Promise<void> {
	const retryItems = await db
		.select()
		.from(enrichmentRetryQueue)
		.where(
			and(
				eq(enrichmentRetryQueue.jobType, jobType),
				isNull(enrichmentRetryQueue.resolvedAt),
				lte(enrichmentRetryQueue.nextRetryAt, new Date()),
				sql`${enrichmentRetryQueue.retryCount} < ${enrichmentRetryQueue.maxRetries}`,
			),
		)
		.limit(10);

	for (const item of retryItems) {
		try {
			const { result: quote } = await registry.getQuote(`${item.symbol}.NS`);
			result.apiCalls++;

			if (quote?.price) {
				const yesterday = new Date();
				yesterday.setDate(yesterday.getDate() - 1);
				const yesterdayStr = yesterday.toISOString().split("T")[0];

				await db.execute(sql`
          INSERT INTO instrument_prices (instrument_id, price_date, close_price, volume, change_percent, source)
          VALUES (${item.instrumentId}, ${yesterdayStr}::date, ${quote.price}, ${quote.volume || 0}, ${quote.changePercent || 0}, 'daily_retry')
          ON CONFLICT (instrument_id, price_date) DO NOTHING
        `);

				await db
					.update(listedStocks)
					.set({ lastDailyUpdate: sql`${yesterdayStr}::date` })
					.where(eq(listedStocks.id, item.instrumentId));

				await db
					.update(enrichmentRetryQueue)
					.set({ resolvedAt: new Date() })
					.where(eq(enrichmentRetryQueue.id, item.id));

				result.retried++;
				await logJob(
					jobType,
					item.instrumentId,
					item.symbol,
					"RETRY_SUCCESS",
					`Resolved on retry ${item.retryCount}`,
				);
			}
		} catch (err: any) {
			await pushToRetryQueue(
				item.instrumentId,
				item.symbol || "",
				jobType,
				err.message,
			);
		}
	}
}
