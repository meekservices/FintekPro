import { db } from "../../db";
import {
	listedStocks,
	instrumentPrices,
	enrichmentJobLog,
	enrichmentRetryQueue,
} from "@shared/schema";
import { eq, and, sql, isNull, lte, or } from "drizzle-orm";
import { getProviderRegistry } from "../screener/data-provider-registry";

interface BackfillResult {
	processed: number;
	skipped: number;
	errors: number;
	retried: number;
	apiCalls: number;
	totalRecords: number;
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
	error: string,
): Promise<void> {
	const existing = await db
		.select()
		.from(enrichmentRetryQueue)
		.where(
			and(
				eq(enrichmentRetryQueue.instrumentId, instrumentId),
				eq(enrichmentRetryQueue.jobType, "HISTORICAL_BACKFILL"),
				isNull(enrichmentRetryQueue.resolvedAt),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		const entry = existing[0];
		if (entry.retryCount >= entry.maxRetries) {
			await logJob(
				"HISTORICAL_BACKFILL",
				instrumentId,
				symbol,
				"MAX_RETRIES_EXCEEDED",
				`Retry cap (${entry.maxRetries}) reached: ${error}`,
			);
			return;
		}
		const backoffMinutes = 2 ** entry.retryCount * 30;
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
			jobType: "HISTORICAL_BACKFILL",
			retryCount: 1,
			lastError: error,
			nextRetryAt: new Date(Date.now() + 30 * 60 * 1000),
		});
	}
}

export async function runHistoricalBackfill(
	batchSize: number = 5,
): Promise<BackfillResult> {
	const result: BackfillResult = {
		processed: 0,
		skipped: 0,
		errors: 0,
		retried: 0,
		apiCalls: 0,
		totalRecords: 0,
	};
	const registry = getProviderRegistry();

	const today = new Date().toISOString().split("T")[0];
	const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000)
		.toISOString()
		.split("T")[0];

	const instruments = await db
		.select({
			id: listedStocks.id,
			symbol: listedStocks.symbol,
			historicalStartDate: listedStocks.historicalStartDate,
			historicalEndDate: listedStocks.historicalEndDate,
			historicalComplete: listedStocks.historicalComplete,
		})
		.from(listedStocks)
		.where(
			and(
				eq(listedStocks.isActive, true),
				or(
					eq(listedStocks.historicalComplete, false),
					isNull(listedStocks.historicalComplete),
				),
			),
		)
		.limit(batchSize);

	console.log(
		`[HistoricalBackfill] Found ${instruments.length} instruments needing backfill`,
	);

	for (const instrument of instruments) {
		try {
			const fromDate = instrument.historicalEndDate || fiveYearsAgo;
			const toDate = today;

			const fmpSymbol = `${instrument.symbol}.NS`;
			const { result: prices } = await registry.getHistoricalPrices(
				fmpSymbol,
				fromDate,
				toDate,
			);
			result.apiCalls++;

			if (!prices || prices.length === 0) {
				result.skipped++;
				await logJob(
					"HISTORICAL_BACKFILL",
					instrument.id,
					instrument.symbol,
					"NO_DATA",
					`No historical data found for ${fromDate} to ${toDate}`,
				);
				continue;
			}

			let insertedCount = 0;
			const BATCH_SIZE = 50;

			for (let i = 0; i < prices.length; i += BATCH_SIZE) {
				const batch = prices.slice(i, i + BATCH_SIZE);

				for (const p of batch) {
					try {
						await db.execute(sql`
              INSERT INTO instrument_prices (instrument_id, price_date, open_price, high_price, low_price, close_price, adj_close, volume, change_percent, source)
              VALUES (
                ${instrument.id},
                ${p.date}::date,
                ${p.open || null},
                ${p.high || null},
                ${p.low || null},
                ${p.close},
                ${p.adjClose || p.close},
                ${p.volume || 0},
                ${p.changePercent || 0},
                'backfill'
              )
              ON CONFLICT (instrument_id, price_date) DO NOTHING
            `);
						insertedCount++;
					} catch (insertErr: any) {
						if (!insertErr.message?.includes("duplicate")) {
							console.error(
								`[HistoricalBackfill] Insert error for ${instrument.symbol} on ${p.date}: ${insertErr.message}`,
							);
						}
					}
				}
			}

			const sortedDates = prices.map((p) => p.date).sort();
			const earliestDate = sortedDates[0];
			const latestDate = sortedDates[sortedDates.length - 1];

			await db
				.update(listedStocks)
				.set({
					historicalStartDate: sql`LEAST(COALESCE(${listedStocks.historicalStartDate}, ${earliestDate}::date), ${earliestDate}::date)`,
					historicalEndDate: sql`GREATEST(COALESCE(${listedStocks.historicalEndDate}, ${latestDate}::date), ${latestDate}::date)`,
					historicalComplete: true,
				})
				.where(eq(listedStocks.id, instrument.id));

			await logJob(
				"HISTORICAL_BACKFILL",
				instrument.id,
				instrument.symbol,
				"SUCCESS",
				`Backfilled ${insertedCount} records from ${earliestDate} to ${latestDate}`,
				insertedCount,
			);

			const retryEntry = await db
				.select()
				.from(enrichmentRetryQueue)
				.where(
					and(
						eq(enrichmentRetryQueue.instrumentId, instrument.id),
						eq(enrichmentRetryQueue.jobType, "HISTORICAL_BACKFILL"),
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
			result.totalRecords += insertedCount;
			console.log(
				`[HistoricalBackfill] ${instrument.symbol}: ${insertedCount} records (${earliestDate} to ${latestDate})`,
			);
		} catch (err: any) {
			result.errors++;
			console.error(
				`[HistoricalBackfill] Error for ${instrument.symbol}: ${err.message}`,
			);
			await logJob(
				"HISTORICAL_BACKFILL",
				instrument.id,
				instrument.symbol,
				"FAILED",
				err.message,
			);
			await pushToRetryQueue(instrument.id, instrument.symbol, err.message);
		}
	}

	await processBackfillRetryQueue(result, registry);

	console.log(
		`[HistoricalBackfill] Complete: ${result.processed} instruments, ${result.totalRecords} records, ${result.errors} errors, ${result.retried} retries`,
	);
	await logJob(
		"HISTORICAL_BACKFILL_BATCH",
		null,
		null,
		"COMPLETE",
		`Processed: ${result.processed}, Records: ${result.totalRecords}, Skipped: ${result.skipped}, Errors: ${result.errors}, Retried: ${result.retried}`,
		result.totalRecords,
	);

	return result;
}

async function processBackfillRetryQueue(
	result: BackfillResult,
	registry: ReturnType<typeof getProviderRegistry>,
): Promise<void> {
	const retryItems = await db
		.select()
		.from(enrichmentRetryQueue)
		.where(
			and(
				eq(enrichmentRetryQueue.jobType, "HISTORICAL_BACKFILL"),
				isNull(enrichmentRetryQueue.resolvedAt),
				lte(enrichmentRetryQueue.nextRetryAt, new Date()),
				sql`${enrichmentRetryQueue.retryCount} < ${enrichmentRetryQueue.maxRetries}`,
			),
		)
		.limit(3);

	const today = new Date().toISOString().split("T")[0];
	const fiveYearsAgo = new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000)
		.toISOString()
		.split("T")[0];

	for (const item of retryItems) {
		try {
			const fmpSymbol = `${item.symbol}.NS`;
			const { result: prices } = await registry.getHistoricalPrices(
				fmpSymbol,
				fiveYearsAgo,
				today,
			);
			result.apiCalls++;

			if (prices && prices.length > 0) {
				let insertedCount = 0;
				for (const p of prices) {
					try {
						await db.execute(sql`
              INSERT INTO instrument_prices (instrument_id, price_date, open_price, high_price, low_price, close_price, adj_close, volume, change_percent, source)
              VALUES (${item.instrumentId}, ${p.date}::date, ${p.open || null}, ${p.high || null}, ${p.low || null}, ${p.close}, ${p.adjClose || p.close}, ${p.volume || 0}, ${p.changePercent || 0}, 'backfill_retry')
              ON CONFLICT (instrument_id, price_date) DO NOTHING
            `);
						insertedCount++;
					} catch (e: any) {
						console.warn(
							"[HistoricalBackfill] Individual row insert failed:",
							e?.message,
						);
					}
				}

				const sortedDates = prices.map((p) => p.date).sort();
				await db
					.update(listedStocks)
					.set({
						historicalStartDate: sql`${sortedDates[0]}::date`,
						historicalEndDate: sql`${sortedDates[sortedDates.length - 1]}::date`,
						historicalComplete: true,
					})
					.where(eq(listedStocks.id, item.instrumentId));

				await db
					.update(enrichmentRetryQueue)
					.set({ resolvedAt: new Date() })
					.where(eq(enrichmentRetryQueue.id, item.id));

				result.retried++;
				result.totalRecords += insertedCount;
				await logJob(
					"HISTORICAL_BACKFILL",
					item.instrumentId,
					item.symbol,
					"RETRY_SUCCESS",
					`Resolved on retry ${item.retryCount}: ${insertedCount} records`,
					insertedCount,
				);
			}
		} catch (err: any) {
			await pushToRetryQueue(item.instrumentId, item.symbol || "", err.message);
		}
	}
}
