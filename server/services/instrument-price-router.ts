/**
 * instrument-price-router.ts
 *
 * Single-point-of-truth price update gateway for ALL instrument types.
 *
 * Purpose:  Any service that fetches a live price MUST call updateInstrumentPrice()
 *           instead of writing directly to individual asset tables.
 *
 * Inputs:   InstrumentPriceUpdate — see type below
 * Outputs:  { success, rowsAffected, latency_ms }
 *
 * Edge cases:
 *   - Unknown instrumentType → logged + skipped (never throws)
 *   - DB error → structured error response { success: false, error_code, retryable }
 *   - Price = 0 or NaN → rejected (financial data integrity rule)
 *
 * Observability:
 *   Every call emits: { event: "PRICE_UPDATED", instrument_type, identifier, price, source, latency_ms, status }
 *
 * @module instrument-price-router
 * @version 1.0.0
 * @since Phase 5 — DB consolidation plan
 */

import { db } from "../db";
import {
  mutualFunds,
  bondCatalog,
  listedStocks,
  aifMaster,
} from "@shared/schema";
import { eq } from "drizzle-orm";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InstrumentType =
  | "mutual_fund"    // AMFI → mutual_funds.currentNav
  | "equity"         // NSE/BSE/FMP → listed_stocks.currentPrice
  | "bond"           // BSE/SEBI → bond_catalog.currentPrice
  | "aif"            // IRIS → aif_master.nav
  | "pms"            // PMS nav → aif_master (pms_master as fallback)
  | "etf"            // NSE ETF → listed_stocks.currentPrice
  | "global_equity"; // NYSE/NASDAQ → listed_stocks.currentPrice

export interface InstrumentPriceUpdate {
  /** The canonical instrument type */
  instrumentType: InstrumentType;

  /**
   * Canonical identifier:
   *  - mutual_fund: AMFI schemeCode  (e.g. "120503")
   *  - equity/etf/global_equity: NSE/BSE symbol (e.g. "RELIANCE", "AAPL")
   *  - bond: ISIN (e.g. "INE001A01036")
   *  - aif/pms: aif_master.id (UUID)
   */
  identifier: string;

  /** New live price / NAV — MUST be a valid positive number */
  price: number;

  /** ISO 8601 date of the price (e.g. "2026-07-07") */
  priceDate?: string;

  /**
   * Data source for audit trail.
   * One of: "amfi" | "nse" | "bse" | "fmp" | "iris" | "manual" | "exchange"
   */
  source: string;

  /** Optional: previous close for auto-calculating day change */
  previousClose?: number;

  /** Optional: day change percent (pre-calculated by provider) */
  dayChangePercent?: number;
}

export interface PriceUpdateResult {
  success: boolean;
  rowsAffected: number;
  latency_ms: number;
  error_code?: string;
  message?: string;
  retryable?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidPrice(price: number): boolean {
  return typeof price === "number" && !Number.isNaN(price) && price > 0;
}

function structuredLog(
  status: "success" | "error" | "skipped",
  update: InstrumentPriceUpdate,
  latency_ms: number,
  extra?: Record<string, unknown>,
): void {
  // Structured JSON consumed by Cloud Logging — intentional console.info
  // eslint-disable-next-line no-console
  console.info(JSON.stringify({
    event: "PRICE_UPDATED",
    instrument_type: update.instrumentType,
    identifier: update.identifier,
    price: update.price,
    price_date: update.priceDate,
    source: update.source,
    latency_ms,
    status,
    ...extra,
  }));
}

// ── Core router ───────────────────────────────────────────────────────────────

/**
 * updateInstrumentPrice — the single gateway for all instrument price writes.
 *
 * All price-writing services MUST use this instead of direct DB writes:
 *   - amfi-official-nav-service.ts  → mutual_fund
 *   - indian-api-service.ts         → equity
 *   - bond-catalog-service.ts       → bond
 *   - aif-nav-sync-scheduler.ts     → aif
 *   - daily-price-updater.ts        → equity / etf / global_equity
 *
 * @param update - Price update payload
 * @returns PriceUpdateResult with success, rowsAffected, latency_ms
 */
export async function updateInstrumentPrice(
  update: InstrumentPriceUpdate,
): Promise<PriceUpdateResult> {
  const t0 = Date.now();

  // Guard: reject zero / NaN prices (financial data integrity)
  if (!isValidPrice(update.price)) {
    const latency_ms = Date.now() - t0;
    structuredLog("skipped", update, latency_ms, {
      reason: "invalid_price",
      price: update.price,
    });
    return {
      success: false,
      rowsAffected: 0,
      latency_ms,
      error_code: "INVALID_PRICE",
      message: `Price ${update.price} is not a valid positive number`,
      retryable: false,
    };
  }

  try {
    let rowsAffected = 0;
    const priceStr = update.price.toString();
    const now = new Date();

    switch (update.instrumentType) {
      // ── Mutual Funds (AMFI) ──────────────────────────────────────────────
      case "mutual_fund": {
        const result = await db
          .update(mutualFunds)
          .set({
            currentNav: priceStr,
            navDate: update.priceDate ?? now.toISOString().split("T")[0],
            lastUpdated: now,
          })
          .where(eq(mutualFunds.schemeCode, update.identifier))
          .returning({ id: mutualFunds.id });
        rowsAffected = result.length;
        break;
      }

      // ── Equities: domestic + ETF + global ────────────────────────────────
      case "equity":
      case "etf":
      case "global_equity": {
        const setPayload: Record<string, unknown> = {
          currentPrice: priceStr,
          lastUpdated: now,
          dataSource: update.source,
        };
        if (update.previousClose != null) {
          setPayload.previousClose = update.previousClose.toString();
          const dayChange = update.price - update.previousClose;
          setPayload.dayChange = dayChange.toFixed(2);
          setPayload.dayChangePercent = (
            (dayChange / update.previousClose) * 100
          ).toFixed(4);
        }
        if (update.dayChangePercent != null) {
          setPayload.dayChangePercent = update.dayChangePercent.toFixed(4);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const eqResult = await db
          .update(listedStocks)
          .set(setPayload as any)
          .where(eq(listedStocks.symbol, update.identifier))
          .returning({ id: listedStocks.id });
        rowsAffected = eqResult.length;
        break;
      }

      // ── Bonds (BSE / SEBI bond catalog) ──────────────────────────────────
      case "bond": {
        const result = await db
          .update(bondCatalog)
          .set({
            currentPrice: priceStr,
            updatedAt: now,
            source: update.source,
          })
          .where(eq(bondCatalog.isin, update.identifier))
          .returning({ id: bondCatalog.id });
        rowsAffected = result.length;
        break;
      }

      // ── AIF / PMS (IRIS API is authoritative) ────────────────────────────
      case "aif":
      case "pms": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await db
          .update(aifMaster)
          .set({ nav: priceStr, updatedAt: now } as any)
          .where(eq(aifMaster.id, update.identifier))
          .returning({ id: aifMaster.id });
        rowsAffected = result.length;
        break;
      }

      default: {
        const latency_ms = Date.now() - t0;
        structuredLog("skipped", update, latency_ms, { reason: "unknown_instrument_type" });
        return {
          success: false,
          rowsAffected: 0,
          latency_ms,
          error_code: "UNKNOWN_INSTRUMENT_TYPE",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          message: `Instrument type '${(update as any).instrumentType}' not handled`,
          retryable: false,
        };
      }
    }

    const latency_ms = Date.now() - t0;
    structuredLog("success", update, latency_ms, { rowsAffected });
    return { success: true, rowsAffected, latency_ms };

  } catch (err: unknown) {
    const latency_ms = Date.now() - t0;
    const e = err as { message?: string; code?: string };
    const isTransient =
      e.message?.includes("connection") ||
      e.message?.includes("timeout") ||
      e.code === "ECONNRESET";

    structuredLog("error", update, latency_ms, {
      error: e.message,
      retryable: isTransient,
    });

    return {
      success: false,
      rowsAffected: 0,
      latency_ms,
      error_code: "DB_WRITE_ERROR",
      message: e.message,
      retryable: isTransient,
    };
  }
}

/**
 * batchUpdateInstrumentPrices — bulk price update with per-item error isolation.
 *
 * Each update is independent — one failure never blocks the others.
 *
 * @param updates - Array of InstrumentPriceUpdate (max 500 per call recommended)
 */
export async function batchUpdateInstrumentPrices(
  updates: InstrumentPriceUpdate[],
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: PriceUpdateResult[];
}> {
  const settled = await Promise.allSettled(
    updates.map((u) => updateInstrumentPrice(u)),
  );

  const results: PriceUpdateResult[] = settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          success: false,
          rowsAffected: 0,
          latency_ms: 0,
          error_code: "PROMISE_REJECTION",
          retryable: true,
        },
  );

  const succeeded = results.filter((r) => r.success).length;
  return { total: updates.length, succeeded, failed: updates.length - succeeded, results };
}
