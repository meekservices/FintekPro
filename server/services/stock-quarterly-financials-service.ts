/**
 * Stock Quarterly Financials Service (FASP-AI v1.0 & GCR v1.0)
 * 
 * Ingests, normalizes, and maintains point-in-time quarterly financial results 
 * for Indian listed equities (NSE & BSE) into `stock_quarterly_financials`.
 * 
 * Key Capabilities:
 * 1. Multi-source ingestion:
 *    - IndianAPI `stats: "quarter_results"` (live licensed filings)
 *    - `screener_financials.quarterly_history` (unpacks historical JSONB cached tables)
 * 2. Point-in-time filing date and statement nature ('CONSOLIDATED' | 'STANDALONE')
 * 3. QoQ and YoY PAT growth calculation:
 *    - YoY growth compares Q(T) against Q(T-4) (same seasonal quarter 1 year ago)
 *    - QoQ compares Q(T) against Q(T-1)
 * 4. Turnaround Detection:
 *    - Flags `is_loss_to_profit_turnaround` when previous year's quarter was in net loss (< 0)
 *      and current quarter reports net profit (> 0).
 * 5. Powers Pro-Thematic Screener categories:
 *    - 'turnaround'
 *    - 'profit-blasters'
 */

import { db } from "../db";
import { logger } from "../logger";
import { stockQuarterlyFinancials, listedStocks } from "@shared/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { indianApiService, IndianAPIQuarterlyResult } from "./indian-api-service";

export interface NormalizedQuarterlyFinancial {
  symbol: string;
  isin?: string | null;
  quarterEnd: string; // YYYY-MM-DD
  quarterLabel: string; // e.g., 'Q3 FY26' or 'Dec 2025'
  statementNature: "CONSOLIDATED" | "STANDALONE";
  revenueCr?: number | null;
  ebitdaCr?: number | null;
  ebitdaMarginPercent?: number | null;
  netProfitCr?: number | null;
  netMarginPercent?: number | null;
  previousQuarterNetProfitCr?: number | null;
  previousYearNetProfitCr?: number | null;
  patGrowthYoyPercent?: number | null;
  isLossToProfitTurnaround: boolean;
  filingDate?: Date | null;
  source: string;
}

export class StockQuarterlyFinancialsService {
  private static instance: StockQuarterlyFinancialsService;

  public static getInstance(): StockQuarterlyFinancialsService {
    if (!StockQuarterlyFinancialsService.instance) {
      StockQuarterlyFinancialsService.instance = new StockQuarterlyFinancialsService();
    }
    return StockQuarterlyFinancialsService.instance;
  }

  /**
   * Parse quarter string into normalized date (YYYY-MM-DD) and standard label.
   */
  public parseQuarterToDate(quarterStr: string): { quarterEnd: string; quarterLabel: string } | null {
    if (!quarterStr) return null;
    const clean = quarterStr.trim();

    // 1. Check if already ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const parts = clean.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const qLabel = this.getMonthYearToLabel(month, year);
      return { quarterEnd: clean, quarterLabel: qLabel };
    }

    // 2. Check "Mon YYYY" (e.g., "Jun 2024", "Dec 2023", "Mar 2025", "Sep 2024")
    const monYearMatch = clean.match(/^([A-Za-z]{3})\s*(\d{4})$/);
    if (monYearMatch) {
      const mon = monYearMatch[1].toLowerCase();
      const year = parseInt(monYearMatch[2], 10);
      const monthMap: Record<string, { month: number; lastDay: number; label: string }> = {
        mar: { month: 3, lastDay: 31, label: `Q4 FY${(year % 100).toString().padStart(2, "0")}` },
        jun: { month: 6, lastDay: 30, label: `Q1 FY${((year + 1) % 100).toString().padStart(2, "0")}` },
        sep: { month: 9, lastDay: 30, label: `Q2 FY${((year + 1) % 100).toString().padStart(2, "0")}` },
        dec: { month: 12, lastDay: 31, label: `Q3 FY${((year + 1) % 100).toString().padStart(2, "0")}` },
      };

      const m = monthMap[mon];
      if (m) {
        const qEnd = `${year}-${m.month.toString().padStart(2, "0")}-${m.lastDay}`;
        return { quarterEnd: qEnd, quarterLabel: `${monYearMatch[1]} ${year}` };
      }
    }

    // 3. Check "Q1 FY25", "Q2 FY2025"
    const qFyMatch = clean.match(/^Q([1-4])\s*(?:FY)?(\d{2,4})$/i);
    if (qFyMatch) {
      const qNum = parseInt(qFyMatch[1], 10);
      let fyYear = parseInt(qFyMatch[2], 10);
      if (fyYear < 100) fyYear += 2000;

      // In Indian FY (April - March):
      // Q1 ends Jun 30 of fyYear - 1
      // Q2 ends Sep 30 of fyYear - 1
      // Q3 ends Dec 31 of fyYear - 1
      // Q4 ends Mar 31 of fyYear
      let calYear = fyYear - 1;
      let month = 6;
      let day = 30;
      let monName = "Jun";

      if (qNum === 1) { month = 6; day = 30; monName = "Jun"; }
      else if (qNum === 2) { month = 9; day = 30; monName = "Sep"; }
      else if (qNum === 3) { month = 12; day = 31; monName = "Dec"; }
      else if (qNum === 4) { calYear = fyYear; month = 3; day = 31; monName = "Mar"; }

      const qEnd = `${calYear}-${month.toString().padStart(2, "0")}-${day}`;
      return { quarterEnd: qEnd, quarterLabel: `Q${qNum} FY${fyYear % 100}` };
    }

    return null;
  }

  private getMonthYearToLabel(month: number, year: number): string {
    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[month] || "M"} ${year}`;
  }

  /**
   * Ingest and sync quarterly results for a single stock from IndianAPI.
   */
  public async syncStockFromIndianAPI(symbol: string, isin?: string | null): Promise<number> {
    const sym = symbol.toUpperCase().trim();
    try {
      const res = await indianApiService.getQuarterlyResults(sym, 12);
      if (!res.success || !res.data || res.data.length === 0) {
        return 0;
      }

      const rows: IndianAPIQuarterlyResult[] = res.data;
      const parsedQuarters: Array<{
        dateStr: string;
        label: string;
        rev: number;
        ebitda: number;
        pat: number;
        eps?: number;
      }> = [];

      for (const row of rows) {
        const parsed = this.parseQuarterToDate(row.quarter_end || row.quarter);
        if (!parsed) continue;

        const rev = Number(row.revenue) || 0;
        const ebitda = Number(row.ebitda ?? row.operating_profit) || 0;
        const pat = Number(row.pat) || 0;
        const eps = row.eps !== undefined ? Number(row.eps) : undefined;

        parsedQuarters.push({
          dateStr: parsed.quarterEnd,
          label: parsed.quarterLabel,
          rev,
          ebitda,
          pat,
          eps,
        });
      }

      if (parsedQuarters.length === 0) return 0;

      // Sort chronological ascending (oldest first)
      parsedQuarters.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      let upsertCount = 0;
      for (let i = 0; i < parsedQuarters.length; i++) {
        const curr = parsedQuarters[i];
        const prevQtr = i > 0 ? parsedQuarters[i - 1] : null;
        // Find quarter 4 periods prior (YoY matching quarter)
        const prevYearQtr = i >= 4 ? parsedQuarters[i - 4] : null;

        const prevPat = prevYearQtr ? prevYearQtr.pat : null;
        const prevQtrPat = prevQtr ? prevQtr.pat : null;

        // YoY PAT Growth %
        let patGrowthYoy: number | null = null;
        if (prevPat !== null && prevPat !== 0) {
          patGrowthYoy = ((curr.pat - prevPat) / Math.abs(prevPat)) * 100;
        }

        // Turnaround: was negative in same quarter last year, now positive
        const isTurnaround = prevPat !== null && prevPat < 0 && curr.pat > 0;

        const ebitdaMargin = curr.rev > 0 ? (curr.ebitda / curr.rev) * 100 : null;
        const netMargin = curr.rev > 0 ? (curr.pat / curr.rev) * 100 : null;

        await this.upsertQuarterlyRecord({
          symbol: sym,
          isin: isin || null,
          quarterEnd: curr.dateStr,
          quarterLabel: curr.label,
          statementNature: "CONSOLIDATED",
          revenueCr: curr.rev,
          ebitdaCr: curr.ebitda,
          ebitdaMarginPercent: ebitdaMargin,
          netProfitCr: curr.pat,
          netMarginPercent: netMargin,
          previousQuarterNetProfitCr: prevQtrPat,
          previousYearNetProfitCr: prevPat,
          patGrowthYoyPercent: patGrowthYoy,
          isLossToProfitTurnaround: isTurnaround,
          source: "indian_api",
        });

        upsertCount++;
      }

      return upsertCount;
    } catch (err: any) {
      logger.warn(`[StockQuarterlyFinancials] Error syncing ${sym} from IndianAPI: ${err.message}`);
      return 0;
    }
  }

  /**
   * Unpack historical quarterly results from `screener_financials.quarterly_history` JSONB.
   * Screener format:
   * {
   *   headers: ["Dec 2022", "Mar 2023", "Jun 2023", ...],
   *   rows: [
   *     { label: "Sales", values: [1000, 1100, 1200] },
   *     { label: "Operating Profit", values: [200, 220, 250] },
   *     { label: "Net Profit", values: [-50, 10, 80] },
   *     ...
   *   ]
   * }
   */
  public async unpackScreenerQuarterlyHistory(symbol: string, isin?: string | null): Promise<number> {
    const sym = symbol.toUpperCase().trim();
    try {
      const screenerRowResult = await db.execute<{
        symbol: string;
        quarterly_history: any;
      }>(sql`
        SELECT symbol, quarterly_history
        FROM screener_financials
        WHERE symbol = ${sym}
          AND quarterly_history IS NOT NULL
        LIMIT 1
      `);

      const row = screenerRowResult.rows?.[0];
      if (!row || !row.quarterly_history) {
        return 0;
      }

      let qHist = row.quarterly_history;
      if (typeof qHist === "string") {
        try {
          qHist = JSON.parse(qHist);
        } catch {
          return 0;
        }
      }

      const headers: string[] = Array.isArray(qHist?.headers) ? qHist.headers : [];
      const dataRows: Array<{ label: string; values: any[] }> = Array.isArray(qHist?.rows) ? qHist.rows : [];

      if (headers.length === 0 || dataRows.length === 0) {
        return 0;
      }

      // Map rows by normalized label
      const rowMap = new Map<string, any[]>();
      for (const r of dataRows) {
        if (!r.label) continue;
        const normKey = r.label.toLowerCase().replace(/[^a-z0-9]/g, "");
        rowMap.set(normKey, r.values || []);
      }

      const salesVals = rowMap.get("sales") || rowMap.get("revenue") || [];
      const opVals = rowMap.get("operatingprofit") || rowMap.get("ebitda") || [];
      const opmVals = rowMap.get("opm") || [];
      const netProfitVals = rowMap.get("netprofit") || rowMap.get("pat") || [];

      const parsedQuarters: Array<{
        dateStr: string;
        label: string;
        rev: number;
        ebitda: number;
        pat: number;
        opm?: number;
      }> = [];

      for (let idx = 0; idx < headers.length; idx++) {
        const h = headers[idx];
        const parsed = this.parseQuarterToDate(h);
        if (!parsed) continue;

        const rev = Number(salesVals[idx]) || 0;
        const ebitda = Number(opVals[idx]) || 0;
        const pat = Number(netProfitVals[idx]) || 0;
        const opm = opmVals[idx] != null ? Number(opmVals[idx]) : undefined;

        parsedQuarters.push({
          dateStr: parsed.quarterEnd,
          label: parsed.quarterLabel,
          rev,
          ebitda,
          pat,
          opm,
        });
      }

      if (parsedQuarters.length === 0) return 0;

      // Sort chronological ascending
      parsedQuarters.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

      let upsertCount = 0;
      for (let i = 0; i < parsedQuarters.length; i++) {
        const curr = parsedQuarters[i];
        const prevQtr = i > 0 ? parsedQuarters[i - 1] : null;
        const prevYearQtr = i >= 4 ? parsedQuarters[i - 4] : null;

        const prevPat = prevYearQtr ? prevYearQtr.pat : null;
        const prevQtrPat = prevQtr ? prevQtr.pat : null;

        // YoY PAT Growth %
        let patGrowthYoy: number | null = null;
        if (prevPat !== null && prevPat !== 0) {
          patGrowthYoy = ((curr.pat - prevPat) / Math.abs(prevPat)) * 100;
        }

        const isTurnaround = prevPat !== null && prevPat < 0 && curr.pat > 0;
        const ebitdaMargin = curr.opm !== undefined ? curr.opm : (curr.rev > 0 ? (curr.ebitda / curr.rev) * 100 : null);
        const netMargin = curr.rev > 0 ? (curr.pat / curr.rev) * 100 : null;

        await this.upsertQuarterlyRecord({
          symbol: sym,
          isin: isin || null,
          quarterEnd: curr.dateStr,
          quarterLabel: curr.label,
          statementNature: "CONSOLIDATED",
          revenueCr: curr.rev,
          ebitdaCr: curr.ebitda,
          ebitdaMarginPercent: ebitdaMargin,
          netProfitCr: curr.pat,
          netMarginPercent: netMargin,
          previousQuarterNetProfitCr: prevQtrPat,
          previousYearNetProfitCr: prevPat,
          patGrowthYoyPercent: patGrowthYoy,
          isLossToProfitTurnaround: isTurnaround,
          source: "screener_unpack",
        });

        upsertCount++;
      }

      return upsertCount;
    } catch (err: any) {
      logger.warn(`[StockQuarterlyFinancials] Error unpacking screener for ${sym}: ${err.message}`);
      return 0;
    }
  }

  /**
   * Upsert a single quarterly record with conflict resolution on (symbol, quarter_end, statement_nature).
   */
  public async upsertQuarterlyRecord(rec: NormalizedQuarterlyFinancial): Promise<void> {
    const revStr = rec.revenueCr != null ? rec.revenueCr.toFixed(2) : null;
    const ebitdaStr = rec.ebitdaCr != null ? rec.ebitdaCr.toFixed(2) : null;
    const ebitdaMarginStr = rec.ebitdaMarginPercent != null ? rec.ebitdaMarginPercent.toFixed(2) : null;
    const patStr = rec.netProfitCr != null ? rec.netProfitCr.toFixed(2) : null;
    const netMarginStr = rec.netMarginPercent != null ? rec.netMarginPercent.toFixed(2) : null;
    const prevQtrPatStr = rec.previousQuarterNetProfitCr != null ? rec.previousQuarterNetProfitCr.toFixed(2) : null;
    const prevYearPatStr = rec.previousYearNetProfitCr != null ? rec.previousYearNetProfitCr.toFixed(2) : null;
    const patGrowthStr = rec.patGrowthYoyPercent != null ? rec.patGrowthYoyPercent.toFixed(2) : null;

    await db.execute(sql`
      INSERT INTO stock_quarterly_financials (
        symbol,
        isin,
        quarter_end,
        quarter_label,
        statement_nature,
        revenue_cr,
        ebitda_cr,
        ebitda_margin_percent,
        net_profit_cr,
        net_margin_percent,
        prev_quarter_pat_cr,
        prev_year_pat_cr,
        pat_growth_yoy_percent,
        is_loss_to_profit_turnaround,
        source
      ) VALUES (
        ${rec.symbol},
        ${rec.isin},
        ${rec.quarterEnd}::date,
        ${rec.quarterLabel},
        ${rec.statementNature},
        ${revStr}::numeric,
        ${ebitdaStr}::numeric,
        ${ebitdaMarginStr}::numeric,
        ${patStr}::numeric,
        ${netMarginStr}::numeric,
        ${prevQtrPatStr}::numeric,
        ${prevYearPatStr}::numeric,
        ${patGrowthStr}::numeric,
        ${rec.isLossToProfitTurnaround},
        ${rec.source}
      )
      ON CONFLICT (symbol, quarter_end, statement_nature)
      DO UPDATE SET
        isin = COALESCE(EXCLUDED.isin, stock_quarterly_financials.isin),
        quarter_label = EXCLUDED.quarter_label,
        revenue_cr = COALESCE(EXCLUDED.revenue_cr, stock_quarterly_financials.revenue_cr),
        ebitda_cr = COALESCE(EXCLUDED.ebitda_cr, stock_quarterly_financials.ebitda_cr),
        ebitda_margin_percent = COALESCE(EXCLUDED.ebitda_margin_percent, stock_quarterly_financials.ebitda_margin_percent),
        net_profit_cr = COALESCE(EXCLUDED.net_profit_cr, stock_quarterly_financials.net_profit_cr),
        net_margin_percent = COALESCE(EXCLUDED.net_margin_percent, stock_quarterly_financials.net_margin_percent),
        prev_quarter_pat_cr = COALESCE(EXCLUDED.prev_quarter_pat_cr, stock_quarterly_financials.prev_quarter_pat_cr),
        prev_year_pat_cr = COALESCE(EXCLUDED.prev_year_pat_cr, stock_quarterly_financials.prev_year_pat_cr),
        pat_growth_yoy_percent = COALESCE(EXCLUDED.pat_growth_yoy_percent, stock_quarterly_financials.pat_growth_yoy_percent),
        is_loss_to_profit_turnaround = EXCLUDED.is_loss_to_profit_turnaround,
        source = EXCLUDED.source
    `);
  }

  /**
   * Seed/sync all active stocks by unpacking screener_financials table.
   * This is very fast (local DB queries) and immediately populates the table.
   */
  public async syncAllFromScreener(limit = 1000): Promise<{ processed: number; totalRecords: number }> {
    logger.info(`[StockQuarterlyFinancials] Starting bulk screener unpack (limit: ${limit})...`);
    const stocks = await db.execute<{ symbol: string; isin: string }>(sql`
      SELECT ls.symbol, ls.isin
      FROM listed_stocks ls
      INNER JOIN screener_financials sf ON sf.symbol = ls.symbol
      WHERE sf.quarterly_history IS NOT NULL
        AND ls.is_active = true
      ORDER BY ls.market_cap_value DESC NULLS LAST
      LIMIT ${limit}
    `);

    let processed = 0;
    let totalRecords = 0;

    for (const s of stocks.rows || []) {
      const count = await this.unpackScreenerQuarterlyHistory(s.symbol, s.isin);
      if (count > 0) {
        processed++;
        totalRecords += count;
      }
    }

    logger.info(`[StockQuarterlyFinancials] Screener unpack completed: ${processed} stocks, ${totalRecords} quarters populated.`);
    return { processed, totalRecords };
  }

  /**
   * Refresh quarterly filings for a specific stock (tries local DB unpack first, falls back to IndianAPI).
   */
  public async refreshStockQuarterly(symbol: string, isin?: string | null): Promise<number> {
    // 1. Unpack fresh local DB screener_financials first (0ms, zero external API cost)
    const localCount = await this.unpackScreenerQuarterlyHistory(symbol, isin);
    if (localCount > 0) {
      return localCount;
    }
    // 2. Fall back to IndianAPI only when local DB has no quarterly history
    return this.syncStockFromIndianAPI(symbol, isin);
  }
}

export const stockQuarterlyFinancialsService = StockQuarterlyFinancialsService.getInstance();
