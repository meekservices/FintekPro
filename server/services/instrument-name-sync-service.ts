/**
 * @file instrument-name-sync-service.ts
 * @description Syncs listed stock names and symbols against NSE's official
 *   equity master CSV (EQUITY_L.csv). Detects company renames and symbol
 *   changes, persists them to company_rename_log, updates listed_stocks,
 *   and rotates symbol_mapping entries.
 *
 * @data_source
 *   Primary:  NSE EQUITY_L.csv (https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv)
 *   Fallback: Admin-uploaded CSV (same format) via multipart POST
 *
 * @compliance SEBI requires an audit trail for all corporate events.
 *   company_rename_log satisfies this requirement for name/symbol changes.
 *
 * @retry   3 attempts with exponential backoff on NSE fetch failures.
 * @inputs  None (fetches live) or optional pre-parsed rows for testing.
 * @outputs InstrumentNameSyncResult — counts of renames, symbol changes, errors.
 */

import axios from "axios";
import { db } from "../db";
import { listedStocks, companyRenameLog } from "@shared/schema";
import { eq, sql, isNotNull } from "drizzle-orm";
import { symbolMappingService } from "./symbol-mapping-service";
import { upsertISINRecord, invalidateISINCache } from "./isin-registry-service";
import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NSEEquityRow {
  symbol: string;
  name: string;
  series: string;
  isin: string;
}

export interface InstrumentNameSyncResult {
  /** Total NSE CSV rows parsed */
  total: number;
  /** Rows matched to listed_stocks by ISIN */
  matched: number;
  /** Name changes detected and applied */
  nameChanges: number;
  /** Symbol changes detected and applied */
  symbolChanges: number;
  /** ISIN rows in NSE CSV not found in listed_stocks (delisted / not seeded) */
  notFound: number;
  /** Rows that errored during DB update */
  errors: number;
  /** Detailed diff list (max 200 entries) */
  diffs: Array<{
    isin: string;
    oldSymbol?: string;
    newSymbol?: string;
    oldName?: string;
    newName?: string;
    changeType: "name" | "symbol" | "both";
  }>;
}

// ── NSE CSV fetch ─────────────────────────────────────────────────────────────

const NSE_EQUITY_CSV_URL =
  "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";

/**
 * Fetch and parse NSE EQUITY_L.csv.
 * Retries up to 3 times with exponential backoff.
 *
 * @returns Parsed rows (EQ series only — ignores BE/IL/SM etc.)
 */
export async function fetchNSEEquityMaster(
  rawCsv?: string,
): Promise<NSEEquityRow[]> {
  let csv = rawCsv;

  if (!csv) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await axios.get(NSE_EQUITY_CSV_URL, {
          timeout: 30_000,
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Referer: "https://www.nseindia.com/",
            Accept: "text/html,application/xhtml+xml,*/*",
          },
          responseType: "text",
        });
        csv = res.data;
        break;
      } catch (err: any) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, attempt * 2_000));
      }
    }
  }

  if (!csv) throw new Error("[NameSync] NSE CSV fetch returned empty body");

  const rows: NSEEquityRow[] = [];
  const lines = csv.split("\n");

  // Header: SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    if (cols.length < 7) continue;

    const symbol = cols[0]?.trim();
    const name   = cols[1]?.trim();
    const series = cols[2]?.trim();
    const isin   = cols[6]?.trim();

    if (!symbol || !name || !isin || isin.length < 12) continue;
    // Only process EQ (normal equity) series — skip BE, IL, SM, etc.
    if (series !== "EQ") continue;

    rows.push({ symbol, name, series, isin });
  }

  return rows;
}

// ── Main sync service ─────────────────────────────────────────────────────────

class InstrumentNameSyncService {
  /**
   * syncFromNSEMaster() — Full sync against NSE EQUITY_L.csv.
   *
   * @param rawCsv  Optional pre-fetched CSV string (for admin file upload fallback)
   * @param dryRun  If true, detect diffs but do NOT write to DB (report only)
   */
  async syncFromNSEMaster(
    rawCsv?: string,
    dryRun = false,
  ): Promise<InstrumentNameSyncResult> {
    const startTs = Date.now();
    logger.info("[NameSync] Starting NSE equity master sync", {
      event: "NAME_SYNC_START", user_id: "SYSTEM", latency_ms: 0, status: "start",
    });

    const result: InstrumentNameSyncResult = {
      total: 0,
      matched: 0,
      nameChanges: 0,
      symbolChanges: 0,
      notFound: 0,
      errors: 0,
      diffs: [],
    };

    // 1. Fetch + parse NSE CSV
    let nseRows: NSEEquityRow[];
    try {
      nseRows = await fetchNSEEquityMaster(rawCsv);
    } catch (err: any) {
      logger.error("[NameSync] Failed to fetch NSE CSV", err);
      throw new Error(`NSE CSV fetch failed: ${err.message}`);
    }

    result.total = nseRows.length;

    // 2. Load all listed_stocks that have an ISIN into memory
    const dbStocks = await db
      .select({
        id: listedStocks.id,
        isin: listedStocks.isin,
        symbol: listedStocks.symbol,
        companyName: listedStocks.companyName,
      })
      .from(listedStocks)
      .where(isNotNull(listedStocks.isin));

    // ISIN → DB row (fast lookup)
    const dbByIsin = new Map(dbStocks.map((s) => [s.isin!, s]));

    // 3. Diff NSE master vs DB
    for (const nseRow of nseRows) {
      const dbStock = dbByIsin.get(nseRow.isin);

      if (!dbStock) {
        result.notFound++;
        continue;
      }

      result.matched++;

      const nameChanged =
        dbStock.companyName.trim().toLowerCase() !==
        nseRow.name.trim().toLowerCase();

      const symbolChanged =
        dbStock.symbol.trim().toUpperCase() !==
        nseRow.symbol.trim().toUpperCase();

      if (!nameChanged && !symbolChanged) continue;

      const changeType: "name" | "symbol" | "both" =
        nameChanged && symbolChanged ? "both" : nameChanged ? "name" : "symbol";

      if (result.diffs.length < 200) {
        result.diffs.push({
          isin: nseRow.isin,
          oldName: nameChanged ? dbStock.companyName : undefined,
          newName: nameChanged ? nseRow.name : undefined,
          oldSymbol: symbolChanged ? dbStock.symbol : undefined,
          newSymbol: symbolChanged ? nseRow.symbol : undefined,
          changeType,
        });
      }

      if (dryRun) {
        if (nameChanged) result.nameChanges++;
        if (symbolChanged) result.symbolChanges++;
        continue;
      }

      // 4. Persist changes
      try {
        // 4a. Log to company_rename_log
        await db.insert(companyRenameLog).values({
          isin: nseRow.isin,
          oldSymbol: dbStock.symbol,
          newSymbol: symbolChanged ? nseRow.symbol : dbStock.symbol,
          oldName: dbStock.companyName,
          newName: nseRow.name,
          exchange: "NSE",
          effectiveDate: new Date().toISOString().split("T")[0],
          source: "nse_master",
        });

        // 4b. Update listed_stocks
        await db
          .update(listedStocks)
          .set({
            ...(nameChanged   ? { companyName: nseRow.name }  : {}),
            ...(symbolChanged ? { symbol: nseRow.symbol }     : {}),
          })
          .where(eq(listedStocks.isin, nseRow.isin));

        // 4c. Rotate symbol_mapping if the NSE ticker changed
        if (symbolChanged) {
          await symbolMappingService.rotateSymbol(
            nseRow.isin,
            "NSE",
            nseRow.symbol,
            nseRow.name,
          );
        }

        // 4d. Update isin_registry canonical name + NSE symbol
        await upsertISINRecord({
          isin: nseRow.isin,
          canonicalName: nseRow.name,
          instrumentType: "equity",
          nseSymbol: symbolChanged ? nseRow.symbol : dbStock.symbol,
          source: "nse_master",
        });
        invalidateISINCache();

        if (nameChanged)   result.nameChanges++;
        if (symbolChanged) result.symbolChanges++;
      } catch (err: any) {
        result.errors++;
        logger.error("[NameSync] Error updating instrument", {
          event: "NAME_SYNC_ERROR", user_id: "SYSTEM",
          latency_ms: 0, status: "error",
          isin: nseRow.isin, error: err.message,
        });
      }
    }

    const latency = Date.now() - startTs;
    logger.info("[NameSync] NSE equity master sync complete", {
      event: "NAME_SYNC_COMPLETE", user_id: "SYSTEM", latency_ms: latency, status: "ok",
      total: result.total, matched: result.matched,
      nameChanges: result.nameChanges, symbolChanges: result.symbolChanges,
      notFound: result.notFound, errors: result.errors, dryRun,
    });

    return result;
  }

  /**
   * manualRename() — Admin-logged rename for BSE-only stocks or corrections.
   *
   * @param params.isin         ISO 6166 identifier
   * @param params.oldSymbol    Previous exchange ticker
   * @param params.newSymbol    New exchange ticker
   * @param params.oldName      Previous company name
   * @param params.newName      New company name
   * @param params.exchange     NSE | BSE (default: NSE)
   * @param params.effectiveDate Date the change took effect (YYYY-MM-DD)
   */
  async manualRename(params: {
    isin: string;
    oldSymbol?: string;
    newSymbol?: string;
    oldName: string;
    newName: string;
    exchange?: string;
    effectiveDate?: string;
  }): Promise<void> {
    const {
      isin, oldSymbol, newSymbol, oldName, newName,
      exchange = "NSE", effectiveDate,
    } = params;

    await db.insert(companyRenameLog).values({
      isin,
      oldSymbol: oldSymbol ?? null,
      newSymbol: newSymbol ?? null,
      oldName,
      newName,
      exchange,
      effectiveDate: effectiveDate ?? new Date().toISOString().split("T")[0],
      source: "admin",
    });

    // Update listed_stocks
    const updates: Record<string, string> = {};
    if (newName)   updates["companyName"] = newName;
    if (newSymbol) updates["symbol"]      = newSymbol;

    if (Object.keys(updates).length > 0) {
      await db
        .update(listedStocks)
        .set(updates)
        .where(eq(listedStocks.isin, isin));
    }

    // Rotate symbol_mapping if symbol changed
    if (newSymbol) {
      await symbolMappingService.rotateSymbol(isin, exchange, newSymbol, newName);
      invalidateISINCache();
    }
  }

  /**
   * getRecentRenames() — Returns recent company_rename_log entries.
   *
   * @param limit Max rows (default 50)
   */
  async getRecentRenames(limit = 50): Promise<typeof companyRenameLog.$inferSelect[]> {
    return db
      .select()
      .from(companyRenameLog)
      .orderBy(sql`${companyRenameLog.detectedAt} DESC`)
      .limit(limit);
  }
}

export const instrumentNameSyncService = new InstrumentNameSyncService();
