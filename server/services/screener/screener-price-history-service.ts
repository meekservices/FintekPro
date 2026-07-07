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
import { listedStocks } from "@shared/schema/screener";
import { sql } from "drizzle-orm";

const YAHOO_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const FETCH_TIMEOUT_MS = 8_000;       // 8s — fast failure on GCP IP throttles
const CONCURRENCY = 8;                // symbols fetched in parallel per chunk
const INTER_CHUNK_DELAY_MS = 300;     // ms between chunks (~26.6 chunks/batch, ~2.5 req/s net)
const BATCH_PAUSE_MS = 2_000;         // pause every 50 symbols

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
 * Fetch 5-year daily OHLCV for an index/benchmark ticker (no .NS/.BO suffix).
 * Used for ^NSEI (Nifty50), ^BSESN (Sensex), ^NSEBANK (Bank Nifty).
 */
async function fetchYahooBenchmark(ticker: string): Promise<OHLCVRow[]> {
  const url = `${YAHOO_BASE}/${encodeURIComponent(ticker)}?range=5y&interval=1d&includeAdjustedClose=true`;
  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; FintekPro/1.0; +https://fintekpro.com)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resp.ok) return [];

    const json: any = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamps ?? result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const adjCloseArr: number[] = result.indicators?.adjclose?.[0]?.adjclose ?? [];

    if (timestamps.length === 0) return [];

    const rows: OHLCVRow[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = quote.close?.[i] ?? null;
      if (close == null || isNaN(close)) continue;

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
    return rows;
  } catch {
    return [];
  }
}

/**
 * Fetch and persist benchmark index OHLCV (Nifty50, Sensex, Bank Nifty).
 * Stores with exact symbol name (e.g. "^NSEI") for use in beta computation.
 *
 * @param tickers  Yahoo Finance tickers to fetch (e.g. ["^NSEI", "^BSESN"])
 */
export async function ingestBenchmarkSymbols(
  tickers: string[] = ["^NSEI", "^BSESN", "^NSEBANK"],
): Promise<{ symbol: string; rows: number; status: string }[]> {
  const results = [];
  for (const ticker of tickers) {
    try {
      const rows = await fetchYahooBenchmark(ticker);
      if (rows.length === 0) {
        results.push({ symbol: ticker, rows: 0, status: "no_data" });
        continue;
      }
      const inserted = await persistRows(ticker, rows);
      console.log(`[PriceHistory] Benchmark ${ticker}: ${rows.length} rows fetched, ${inserted} persisted`);
      results.push({ symbol: ticker, rows: rows.length, status: "ok" });
    } catch (err: any) {
      results.push({ symbol: ticker, rows: 0, status: `error: ${err?.message}` });
    }
  }
  return results;
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

  // Use screener_derived_metrics as the authoritative symbol list (avoids
  // potential column-missing errors on screener_stocks.is_active in live DB)
  const symbolResult = await db.execute(sql.raw(`
    SELECT symbol FROM screener_derived_metrics
    ORDER BY symbol
    LIMIT ${limit} OFFSET ${offset}
  `));
  const activeSymbols = ((symbolResult as any).rows ?? []) as { symbol: string }[];

  let symbolsToProcess = activeSymbols.map((s) => s.symbol as string);

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

  // Process in concurrent chunks of CONCURRENCY to keep total time within 300s
  for (let chunkStart = 0; chunkStart < symbolsToProcess.length; chunkStart += CONCURRENCY) {
    const chunk = symbolsToProcess.slice(chunkStart, chunkStart + CONCURRENCY);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (symbol) => {
        const rows = await fetchYahooOHLCV(symbol);
        if (rows.length === 0) return { symbol, status: "no_data" as const, rows: 0 };
        await persistRows(symbol, rows);
        return { symbol, status: "ok" as const, rows: rows.length };
      })
    );

    for (const r of chunkResults) {
      result.processed++;
      if (r.status === "fulfilled") {
        if (r.value.status === "ok") {
          result.succeeded++;
          result.totalRows += r.value.rows;
          result.details.push(r.value as IngestionResult);
        } else {
          result.failed++;
          result.details.push(r.value as IngestionResult);
        }
      } else {
        result.failed++;
        const sym = chunk[chunkResults.indexOf(r)];
        const errMsg = r.reason?.message ?? String(r.reason);
        result.details.push({ symbol: sym, status: "error", rows: 0, error: errMsg });
        if (result.failed <= 5) {
          console.warn(`[PriceHistory] Error for ${sym}: ${errMsg}`);
        }
      }
    }

    if (result.processed % 40 === 0 || result.processed === symbolsToProcess.length) {
      console.log(
        `[PriceHistory] Progress: ${result.succeeded} ok / ${result.processed} processed / ${result.totalRows} rows`
      );
    }

    // Pause between chunks; longer pause every 50 symbols
    if (chunkStart + CONCURRENCY < symbolsToProcess.length) {
      const isPause = Math.floor((chunkStart + CONCURRENCY) / 50) > Math.floor(chunkStart / 50);
      await new Promise((r) => setTimeout(r, isPause ? BATCH_PAUSE_MS : INTER_CHUNK_DELAY_MS));
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
  const symbolResult = await db.execute(sql.raw(`
    SELECT symbol FROM screener_derived_metrics ORDER BY symbol
  `));
  const activeSymbols = ((symbolResult as any).rows ?? []) as { symbol: string }[];

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
    await new Promise((r) => setTimeout(r, INTER_CHUNK_DELAY_MS));
  }

  console.log(`[PriceHistory] Daily update: ${updated} updated, ${failed} failed`);
  return { updated, failed };
}
