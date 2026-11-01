/**
 * AssetReturnsBackfillService
 *
 * Purpose:
 *   Nightly job (22:30 IST) that pre-computes daily log-returns per ISIN from
 *   golden_prices and MF NAV history tables, storing them in asset_returns_history.
 *   This gives the MVO engine a proper 3-year time series (252+ trading days)
 *   for covariance estimation, replacing the limited 14-day golden_prices scan.
 *
 * Inputs:
 *   - golden_prices (equity, commodity, gold — all asset classes)
 *   - mf_nav_history / historical_nav_data (MF NAVs mapped via isin_registry)
 *
 * Outputs:
 *   - asset_returns_history rows upserted (ISIN × date unique constraint)
 *
 * Edge cases:
 *   - If golden_prices has < 2 rows for an ISIN, no return is computed (need prev price).
 *   - MF NAV rows without a valid ISIN in isin_registry are skipped.
 *   - Consecutive zero / null prices are skipped (ln(0) is -Infinity).
 *   - Transient DB failures: logs warning, retries up to 3 times with exponential backoff.
 *
 * GCR v1.0 compliance:
 *   - Structured log: { event, latency_ms, status, rows_processed }
 *   - Error format: { error_code, message, retryable }
 *   - No raw SQL mutations — Drizzle ORM upsert via onConflictDoUpdate
 *   - Idempotent: ON CONFLICT (isin, return_date) DO UPDATE — safe to re-run.
 */

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db";
import {
  assetReturnsHistory,
  goldenPrices,
  type InsertAssetReturnsHistory,
} from "../../shared/schema";
import { logger } from "../logger";

const ENGINE_VERSION = "backfill-v1.0";
const LOOKBACK_DAYS = 1100; // ~3 years of trading days buffer
const BATCH_UPSERT_SIZE = 500;
const MAX_RETRIES = 3;

/**
 * Sleeps for a given number of milliseconds (exponential backoff helper).
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries an async operation up to maxRetries times with exponential backoff.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = MAX_RETRIES,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const delay = 500 * 2 ** (attempt - 1);
      logger.warn(`[Backfill] RETRY label=${label} attempt=${attempt} delay=${delay}ms`, { error: (err as any)?.message, retryable: true });
      await sleep(delay);
    }
  }
  throw lastErr;
}

/**
 * Computes daily returns from a sorted price series and returns InsertAssetReturnsHistory rows.
 * Uses simple arithmetic return: (curr - prev) / prev
 * (Log-return: Math.log(curr / prev) — available as a comment for future upgrade).
 */
function computeReturns(
  rows: Array<{ isin: string; symbol: string | null; assetClass: string; price: string; priceDate: string; source: string }>,
): InsertAssetReturnsHistory[] {
  const results: InsertAssetReturnsHistory[] = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = Number.parseFloat(rows[i - 1].price);
    const curr = Number.parseFloat(rows[i].price);
    if (prev <= 0 || curr <= 0 || !Number.isFinite(prev) || !Number.isFinite(curr)) continue;

    // Arithmetic daily return — compatible with MVO covariance computation
    // Future: switch to log-return: Math.log(curr / prev)
    const dailyReturn = (curr - prev) / prev;

    results.push({
      isin: rows[i].isin,
      symbol: rows[i].symbol,
      assetClass: rows[i].assetClass,
      returnDate: rows[i].priceDate,
      dailyReturn: String(dailyReturn),
      price: String(curr),
      previousPrice: String(prev),
      source: rows[i].source ?? "golden_prices",
    });
  }
  return results;
}

/**
 * Upserts a batch of return rows into asset_returns_history.
 * Idempotent: ON CONFLICT (isin, return_date) DO UPDATE.
 */
async function upsertBatch(batch: InsertAssetReturnsHistory[]): Promise<void> {
  if (batch.length === 0) return;
  await db
    .insert(assetReturnsHistory)
    .values(batch)
    .onConflictDoUpdate({
      target: [assetReturnsHistory.isin, assetReturnsHistory.returnDate],
      set: {
        dailyReturn: sql`EXCLUDED.daily_return`,
        price: sql`EXCLUDED.price`,
        previousPrice: sql`EXCLUDED.previous_price`,
        source: sql`EXCLUDED.source`,
      },
    });
}

/**
 * Backfills asset_returns_history from golden_prices for all asset classes.
 * Processes one ISIN at a time (ordered by ISIN for determinism).
 */
async function backfillFromGoldenPrices(): Promise<number> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
    .toISOString()
    .split("T")[0];

  // Get distinct ISINs available in golden_prices
  const isins = await db
    .selectDistinct({
      isin: goldenPrices.isin,
      symbol: goldenPrices.symbol,
      assetClass: goldenPrices.assetClass,
    })
    .from(goldenPrices)
    .where(gte(goldenPrices.priceDate, cutoff));

  let totalRows = 0;
  for (const { isin, symbol, assetClass } of isins) {
    if (!isin) continue;
    try {
      const priceRows = await withRetry(
        () =>
          db
            .select({
              isin: goldenPrices.isin,
              symbol: goldenPrices.symbol,
              assetClass: goldenPrices.assetClass,
              price: goldenPrices.price,
              priceDate: goldenPrices.priceDate,
              source: sql<string>`'golden_prices'`,
            })
            .from(goldenPrices)
            .where(and(eq(goldenPrices.isin, isin), gte(goldenPrices.priceDate, cutoff)))
            .orderBy(asc(goldenPrices.priceDate)),
        `golden_prices:${isin}`,
      );

      if (priceRows.length < 2) continue;

      // Cast source to string (Drizzle sql<> returns unknown)
      const typedRows = priceRows.map((r) => ({
        isin: r.isin,
        symbol: r.symbol ?? symbol ?? null,
        assetClass: r.assetClass ?? assetClass ?? "unknown",
        price: r.price,
        priceDate: r.priceDate as string,
        source: (r.source as unknown as string) ?? "golden_prices",
      }));

      const returnRows = computeReturns(typedRows);

      // Upsert in batches
      for (let b = 0; b < returnRows.length; b += BATCH_UPSERT_SIZE) {
        const batch = returnRows.slice(b, b + BATCH_UPSERT_SIZE);
        await withRetry(() => upsertBatch(batch), `upsert:${isin}:batch${b}`);
      }

      totalRows += returnRows.length;
    } catch (err: any) {
      logger.warn('[Backfill] ISIN skip isin=' + isin, { error: err?.message, retryable: false, error_code: 'BACKFILL_ISIN_FAIL' });
    }
  }
  return totalRows;
}

/**
 * Backfills asset_returns_history from mf_nav_history table.
 * Maps scheme codes to ISINs via isin_registry.
 */
async function backfillFromMfNavHistory(): Promise<number> {
  let totalRows = 0;
  try {
    const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
      .toISOString()
      .split("T")[0];

    // Query mf_nav_history joined with isin_registry to get ISIN
    // Raw SQL is acceptable here as a READ-ONLY join across two unrelated tables
    const navRows = await db.execute(sql`
      SELECT
        ir.isin,
        ir.nse_symbol AS symbol,
        'debt' AS asset_class,
        mnh.nav::text AS price,
        mnh.nav_date::text AS price_date,
        'mf_nav_history' AS source
      FROM mf_nav_history mnh
      INNER JOIN isin_registry ir ON ir.amfi_code::text = mnh.scheme_code::text
      WHERE mnh.nav_date >= ${cutoff}
        AND mnh.nav IS NOT NULL
        AND ir.isin IS NOT NULL
      ORDER BY ir.isin, mnh.nav_date ASC
    `);

    // Group by ISIN
    const byIsin = new Map<string, Array<{ isin: string; symbol: string | null; assetClass: string; price: string; priceDate: string; source: string }>>();
    for (const row of navRows.rows as any[]) {
      if (!row.isin || !row.price || !row.price_date) continue;
      const existing = byIsin.get(row.isin) ?? [];
      existing.push({
        isin: row.isin,
        symbol: row.symbol ?? null,
        assetClass: row.asset_class ?? "debt",
        price: String(row.price),
        priceDate: String(row.price_date),
        source: "mf_nav_history",
      });
      byIsin.set(row.isin, existing);
    }

    for (const [isin, rows] of byIsin) {
      if (rows.length < 2) continue;
      try {
        const returnRows = computeReturns(rows);
        for (let b = 0; b < returnRows.length; b += BATCH_UPSERT_SIZE) {
          const batch = returnRows.slice(b, b + BATCH_UPSERT_SIZE);
          await withRetry(() => upsertBatch(batch), `upsert_mf:${isin}:batch${b}`);
        }
        totalRows += returnRows.length;
      } catch (err: any) {
        logger.warn('[Backfill] MF ISIN skip isin=' + isin, { error: err?.message });
      }
    }
  } catch (err: any) {
    logger.warn('[Backfill] MF NAV history skip', { error: err?.message, retryable: false, error_code: 'BACKFILL_MF_FAIL' });
  }
  return totalRows;
}

/**
 * Main entry point — called nightly at 22:30 IST by the scheduler.
 *
 * @returns Summary of the backfill run
 */
export async function runAssetReturnsBackfill(): Promise<{
  success: boolean;
  rowsFromGoldenPrices: number;
  rowsFromMfNav: number;
  latencyMs: number;
  engineVersion: string;
}> {
  const startTime = Date.now();
  logger.info('[Backfill] START', { engine_version: ENGINE_VERSION });

  let rowsFromGoldenPrices = 0;
  let rowsFromMfNav = 0;

  try {
    rowsFromGoldenPrices = await backfillFromGoldenPrices();
    rowsFromMfNav = await backfillFromMfNavHistory();

    const latencyMs = Date.now() - startTime;
    logger.info('[Backfill] COMPLETE', { engine_version: ENGINE_VERSION, rows_from_golden_prices: rowsFromGoldenPrices, rows_from_mf_nav: rowsFromMfNav, latency_ms: latencyMs, status: 'success' });

    return {
      success: true,
      rowsFromGoldenPrices,
      rowsFromMfNav,
      latencyMs,
      engineVersion: ENGINE_VERSION,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    logger.error('[Backfill] FAILED', undefined, err instanceof Error ? err : new Error(String(err?.message)));
    return {
      success: false,
      rowsFromGoldenPrices,
      rowsFromMfNav,
      latencyMs,
      engineVersion: ENGINE_VERSION,
    };
  }
}
