/**
 * Screener Price History Ingestion Service
 *
 * Purpose : Populate `screener_price_history` with 5 years of daily OHLCV
 *           data from Yahoo Finance (free, no API key required).
 *           This is the foundational data layer for:
 *             - Returns (1W / 1M / 3M / 6M / 1Y / 3Y / 5Y / YTD)
 *             - Technical indicators (RSI, MACD, Bollinger, etc.)
 *             - Risk metrics (Beta, Sharpe, Sortino, Max Drawdown)
 *             - Piotroski F-Score
 *
 * Inputs  : screener_stocks (active NSE symbols)
 * Outputs : screener_price_history rows (idempotent — ON CONFLICT DO NOTHING)
 *
 * Endpoints:
 *   POST /api/screener/admin/fetch-price-history  — full backfill batch
 * Cron    : daily at 06:30 IST after market close
 */

import { db } from "../../db";
import { screenerStocks } from "@shared/schema/screener";
import { sql, eq } from "drizzle-orm";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FETCH_TIMEOUT_MS = 20_000;
const INTER_SYMBOL_DELAY_MS = 400; // ~2.5 req/s to stay under Yahoo rate limit
const BATCH_PAUSE_MS = 5_000;      // pause every 50 symbols

interface OHLCVRow {
  date: string; // YYYY-MM-DD
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  adjClose: number | null;
  volume: number | null;
  changePercent: number | null;
}

interface IngestionResult {
  symbol: string;
  status: "ok" | "no_data" | "error";
  rows: number;
  error?: string;
}

export interface PriceHistoryBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  totalRows: number;
  details: IngestionResult[];
}

/**
 * Fetch 5-year daily OHLCV from Yahoo Finance for a single symbol.
 * Tries {symbol}.NS first, falls back to {symbol}.BO.
 */
async function fetchYahooOHLCV(symbol: string): Promise<OHLCVRow[]> {
  const suffixes = [".NS", ".BO"];

  for (const suffix of suffixes) {
    const ticker = `${symbol}${suffix}`;
    const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?range=5y&interval=1d&includeAdjustedClose=true`;

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; FintekPro/1.0; +https://fintekpro.com)",
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!resp.ok) continue;

      const json: any = await resp.json();
      const result = json?.chart?.result?.[0];
      if (!result) continue;

      const timestamps: number[] = result.timestamps ?? result.timestamp ?? [];
      const quote = result.indicators?.quote?.[0] ?? {};
      const adjCloseArr: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];

      if (timestamps.length === 0) continue;

      const rows: OHLCVRow[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const close = quote.close?.[i] ?? null;
        if (close == null || isNaN(close)) continue; // skip null/holiday rows

        const prevClose = i > 0 ? (quote.close?.[i - 1] ?? null) : null;
        const changePercent =
          prevClose != null && prevClose !== 0
            ? Math.round(((close - prevClose) / prevClose) * 100 * 10000) / 10000
            : null;

        const d = new Date(timestamps[i] * 1000);
        const date = d.toISOString().slice(0, 10);

        rows.push({
          date,
          open:   quote.open?.[i]   ?? null,
          high:   quote.high?.[i]   ?? null,
          low:    quote.low?.[i]    ?? null,
          close,
          adjClose:     adjCloseArr[i] ?? close,
          volume:       quote.volume?.[i] ?? null,
          changePercent,
        });
      }

      if (rows.length > 0) return rows;
    } catch (_err) {
      // try next suffix
    }
  }

  return [];
}

/** Sanitise a value for raw SQL interpolation */
function v(x: number | null): string {
  return x == null || isNaN(x) ? "NULL" : String(x);
}

/** Escape single quotes in symbol name */
function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/**
 * Persist OHLCV rows into screener_price_history using raw SQL.
 * Batches 100 rows per INSERT to stay within Postgres limits.
 */
async function persistRows(symbol: string, rows: OHLCVRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const CHUNK = 100;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const valList = chunk
      .map(
        (r) =>
          `(gen_random_uuid(), '${esc(symbol)}', '${r.date}',` +
          ` ${v(r.open)}, ${v(r.high)}, ${v(r.low)},` +
          ` ${v(r.close)}, ${v(r.adjClose)}, ${v(r.volume)}, ${v(r.changePercent)}, NOW())`
      )
      .join(",\n        ");

    await db.execute(sql.raw(`
      INSERT INTO screener_price_history
        (id, symbol, date, open, high, low, close, adj_close, volume, change_percent, created_at)
      VALUES
        ${valList}
      ON CONFLICT (symbol, date) DO NOTHING
    `));
    inserted += chunk.length;
  }

  return inserted;
}

/**
 * Full 5-year backfill for a batch of active screener stocks.
 * Skips symbols already loaded within the last 3 days (unless force=true).
 *
 * @param limit  Max symbols to process per run (default 100)
 * @param force  Re-fetch even recently-loaded symbols
 * @param offset Symbol pagination offset
 */
export async function ingestPriceHistory(
  limit = 100,
  force = false,
  offset = 0,
): Promise<PriceHistoryBatchResult> {
  const result: PriceHistoryBatchResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    totalRows: 0,
    details: [],
  };

  const activeSymbols = await db
    .select({ symbol: screenerStocks.symbol })
    .from(screenerStocks)
    .where(eq(screenerStocks.isActive, true))
    .orderBy(screenerStocks.symbol)
    .limit(limit)
    .offset(offset);

  let symbolsToProcess = activeSymbols.map((s) => s.symbol);

  if (!force) {
    // Skip symbols that already have recent data
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 3);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const recentResult = await db.execute(sql.raw(`
      SELECT DISTINCT symbol FROM screener_price_history WHERE date >= '${cutoffStr}'
    `));
    const recentSet = new Set(
      ((recentResult as any).rows ?? []).map((r: any) => r.symbol as string)
    );
    symbolsToProcess = symbolsToProcess.filter((s) => !recentSet.has(s));
  }

  console.log(
    `[PriceHistory] Processing ${symbolsToProcess.length}/${activeSymbols.length} symbols (offset=${offset}, limit=${limit}, force=${force})`
  );

  for (let idx = 0; idx < symbolsToProcess.length; idx++) {
    const symbol = symbolsToProcess[idx];
    result.processed++;

    try {
      const rows = await fetchYahooOHLCV(symbol);

      if (rows.length === 0) {
        result.details.push({ symbol, status: "no_data", rows: 0 });
        result.failed++;
      } else {
        await persistRows(symbol, rows);
        result.succeeded++;
        result.totalRows += rows.length;
        result.details.push({ symbol, status: "ok", rows: rows.length });

        if (result.succeeded % 10 === 0) {
          console.log(
            `[PriceHistory] Progress: ${result.succeeded} ok / ${result.processed} processed / ${result.totalRows} rows`
          );
        }
      }
    } catch (err: any) {
      const errMsg = err?.message ?? String(err);
      result.failed++;
      result.details.push({ symbol, status: "error", rows: 0, error: errMsg });
      if (result.failed <= 5) {
        console.warn(`[PriceHistory] Error for ${symbol}: ${errMsg}`);
      }
    }

    await new Promise((r) => setTimeout(r, INTER_SYMBOL_DELAY_MS));

    if (idx > 0 && idx % 50 === 0) {
      console.log(`[PriceHistory] Batch pause at ${idx}/${symbolsToProcess.length}...`);
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    }
  }

  console.log(
    `[PriceHistory] Batch done — ok=${result.succeeded} failed=${result.failed} rows=${result.totalRows}`
  );
  return result;
}

/**
 * Ingest only the most recent daily candle for all active symbols.
 * Called by the daily cron job after NSE/BSE market close (~15:30 IST).
 */
export async function ingestDailyPriceUpdate(): Promise<{
  updated: number;
  failed: number;
}> {
  const activeSymbols = await db
    .select({ symbol: screenerStocks.symbol })
    .from(screenerStocks)
    .where(eq(screenerStocks.isActive, true))
    .orderBy(screenerStocks.symbol);

  let updated = 0;
  let failed = 0;

  for (const { symbol } of activeSymbols) {
    try {
      const rows = await fetchYahooOHLCV(symbol);
      if (rows.length > 0) {
        const latest = rows[rows.length - 1];
        await persistRows(symbol, [latest]);
        updated++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, INTER_SYMBOL_DELAY_MS));
  }

  console.log(`[PriceHistory] Daily update: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}
