/**
 * @file global-positions-value-refresh.ts
 * @description P2-B fix: Nightly refresh of global_portfolio_positions.current_value
 *              and current_value_inr using golden_prices as SSOT.
 *
 * Purpose  : global_portfolio_positions stores MTM values (currentValue, currentValueInr,
 *            unrealizedGain, etc.) that go stale when Alpaca or external price feeds are
 *            offline. This service reads golden_prices for each tracked symbol and
 *            recomputes currentValue = quantity × livePrice, persisting via Drizzle upsert.
 *
 * Inputs   : global_portfolio_positions (all rows), golden_prices (by symbol)
 * Outputs  : Updated global_portfolio_positions rows with fresh MTM values
 * Edge cases: If golden_prices has no row for a symbol → skips that position (no stale write).
 *            All writes are idempotent (update by PK). Max 3 retries with exponential backoff.
 *
 * Schedule : Triggered nightly by background-schedulers.ts at 22:45 IST (17:15 UTC).
 *            Also available for on-demand call via /api/admin/refresh-global-positions.
 *
 * @compliance GCR v1.0: structured logs, no raw SQL mutations, idempotent, env-vars only.
 * @version 1.0.0-P2B
 */

import { db } from "../db";
import { globalPortfolioPositions, goldenPrices } from "@shared/schema";
import { eq, desc, inArray, sql } from "drizzle-orm";
import { logger } from "../logger";

const GLOBAL_POSITIONS_REFRESH_VERSION = "1.0.0-P2B";
const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

/**
 * Retry helper with exponential backoff.
 */
async function withRetry<T>(fn: () => Promise<T>, label: string, retries = MAX_RETRIES): Promise<T> {
	let lastErr: unknown;
	for (let attempt = 1; attempt <= retries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt < retries) {
				const delay = 1000 * 2 ** (attempt - 1);
				logger.warn(`[GlobalPositionsRefresh] ${label} attempt ${attempt}/${retries} failed — retrying in ${delay}ms`);
				await new Promise((r) => setTimeout(r, delay));
			}
		}
	}
	throw lastErr;
}

/**
 * Main refresh function.
 * Reads all active global_portfolio_positions, batch-fetches golden_prices
 * for their symbols, recomputes MTM values and upserts back.
 */
export async function runGlobalPositionsValueRefresh(): Promise<void> {
	const startedAt = Date.now();
	logger.info("[GlobalPositionsRefresh] Starting nightly current_value refresh from golden_prices SSOT", {
		event: "GLOBAL_POS_REFRESH_START",
		engine_version: GLOBAL_POSITIONS_REFRESH_VERSION,
		latency_ms: 0,
		status: "starting",
	});

	try {
		// 1. Read all positions
		const positions = await withRetry(
			() => db.select().from(globalPortfolioPositions),
			"fetch positions",
		);

		if (positions.length === 0) {
			logger.info("[GlobalPositionsRefresh] No global_portfolio_positions rows — nothing to refresh", {
				event: "GLOBAL_POS_REFRESH_DONE",
				updated: 0,
				skipped: 0,
				latency_ms: Date.now() - startedAt,
				status: "ok",
			});
			return;
		}

		// 2. Batch-fetch golden_prices for all distinct symbols
		const symbols = [...new Set(positions.map((p) => p.symbol).filter(Boolean))] as string[];
		const gpRows = await withRetry(
			() =>
				db
					.select({ symbol: goldenPrices.symbol, price: goldenPrices.price, updatedAt: goldenPrices.updatedAt })
					.from(goldenPrices)
					.where(inArray(goldenPrices.symbol, symbols))
					.orderBy(desc(goldenPrices.updatedAt)),
			"fetch golden_prices for symbols",
		);

		// Build symbol → price map (keep freshest per symbol)
		const priceMap = new Map<string, { price: number; updatedAt: Date }>();
		for (const r of gpRows) {
			if (!r.symbol || !r.price) continue;
			const price = Number.parseFloat(r.price);
			if (price <= 0) continue;
			const existing = priceMap.get(r.symbol);
			const rowDate = r.updatedAt ? new Date(r.updatedAt) : new Date(0);
			if (!existing || rowDate > existing.updatedAt) {
				priceMap.set(r.symbol, { price, updatedAt: rowDate });
			}
		}

		// 3. Recompute and upsert in batches
		let updated = 0;
		let skipped = 0;

		for (let i = 0; i < positions.length; i += BATCH_SIZE) {
			const batch = positions.slice(i, i + BATCH_SIZE);

			for (const pos of batch) {
				const gpEntry = priceMap.get(pos.symbol);
				if (!gpEntry) {
					skipped++;
					continue; // No golden_prices row for this symbol — skip (don't write stale)
				}

				const livePrice = gpEntry.price;
				const quantity = pos.quantity ? Number.parseFloat(pos.quantity.toString()) : 0;
				if (quantity <= 0) {
					skipped++;
					continue;
				}

				// Derive INR value using golden_prices FX rate for the currency
				let fxRate = 1; // default for INR-denominated positions
				if (pos.currency && pos.currency !== "INR") {
					const fxIsin = `FX_${pos.currency}_INR`;
					const fxRows = await db
						.select({ price: goldenPrices.price })
						.from(goldenPrices)
						.where(eq(goldenPrices.isin, fxIsin))
						.orderBy(desc(goldenPrices.updatedAt))
						.limit(1);
					fxRate = fxRows[0]?.price ? Number.parseFloat(fxRows[0].price) : 84.1; // fallback USDINR
				}

				const currentValue = livePrice * quantity;
				const currentValueInr = currentValue * fxRate;
				const avgCostBasis = pos.avgCostBasis ? Number.parseFloat(pos.avgCostBasis.toString()) : 0;
				const avgCostBasisInr = pos.avgCostBasisInr ? Number.parseFloat(pos.avgCostBasisInr.toString()) : 0;
				const totalCostBasis = avgCostBasis * quantity;
				const totalCostBasisInr = avgCostBasisInr * quantity;
				const unrealizedGain = currentValue - totalCostBasis;
				const unrealizedGainInr = currentValueInr - totalCostBasisInr;
				const unrealizedGainPercent = totalCostBasis > 0 ? (unrealizedGain / totalCostBasis) * 100 : 0;

				await withRetry(
					() =>
						db
							.update(globalPortfolioPositions)
							.set({
								currentValue: currentValue.toFixed(4),
								currentValueInr: currentValueInr.toFixed(2),
								unrealizedGain: unrealizedGain.toFixed(4),
								unrealizedGainInr: unrealizedGainInr.toFixed(2),
								unrealizedGainPercent: unrealizedGainPercent.toFixed(4),
							})
							.where(eq(globalPortfolioPositions.id, pos.id)),
					`update position ${pos.id} symbol=${pos.symbol}`,
				);

				updated++;
			}
		}

		const latencyMs = Date.now() - startedAt;
		logger.info(`[GlobalPositionsRefresh] ✅ Complete — ${updated} updated, ${skipped} skipped`, {
			event: "GLOBAL_POS_REFRESH_DONE",
			engine_version: GLOBAL_POSITIONS_REFRESH_VERSION,
			positions_total: positions.length,
			updated,
			skipped,
			gp_symbols_found: priceMap.size,
			latency_ms: latencyMs,
			status: "ok",
		});
	} catch (err: any) {
		const latencyMs = Date.now() - startedAt;
		logger.warn(`[GlobalPositionsRefresh] ❌ Failed: ${err?.message}`, {
			event: "GLOBAL_POS_REFRESH_ERROR",
			error_message: err?.message,
			latency_ms: latencyMs,
			status: "error",
		});
		// Non-fatal: log and return — don't crash the server
	}
}

