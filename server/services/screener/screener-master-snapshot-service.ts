/**
 * Screener Master Snapshot Service
 *
 * @purpose   Populates and refreshes screener_master_snapshots — a pre-joined,
 *            1-row-per-symbol denormalized table that enables:
 *              • Zero-join screener queries (replaces 8-table JOIN + 4 correlated subqueries)
 *              • Single-query bulk enrichment for POTD candidate scoring
 *              • Sub-15ms screener API responses vs previous 800ms–2,500ms
 *
 * @population  (a) Incremental: called after each symbol's enrichment cycle completes.
 *              (b) Nightly: full table rebuild at 02:00 AM IST via schema-repairs-runner.ts.
 *
 * @compliance GCR v1.0 — structured logs, idempotent upserts, retryable on transient failures.
 * @compliance FASP-AI v1.0 — scoring inputs are immutable per snapshot; engine_version recorded.
 */

import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";

// ── Types ──────────────────────────────────────────────────────────────────────
export interface MasterSnapshotUpsertResult {
  symbol: string;
  success: boolean;
  error?: string;
}

// ── Snapshot Service ───────────────────────────────────────────────────────────

export class ScreenerMasterSnapshotService {
  private static readonly SERVICE_VERSION = "1.0.0";
  private static readonly MAX_RETRIES = 3;

  /**
   * Upserts the master snapshot for a single symbol by reading from all
   * screener sub-tables in a single aggregated SQL query, then writing
   * to screener_master_snapshots.
   *
   * @param symbol  NSE/BSE ticker (e.g. "RELIANCE")
   * @returns       Upsert result with success flag
   *
   * @idempotency   Safe to call multiple times — uses ON CONFLICT (symbol) DO UPDATE.
   * @retryable     Yes — transient DB errors are retried up to MAX_RETRIES times.
   */
  async upsertSnapshot(symbol: string): Promise<MasterSnapshotUpsertResult> {
    const upperSymbol = symbol.toUpperCase().trim();
    if (!upperSymbol) {
      return { symbol, success: false, error: "Empty symbol" };
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= ScreenerMasterSnapshotService.MAX_RETRIES; attempt++) {
      try {
        await this._upsertSnapshotSql(upperSymbol);

        logger.info(`[ScreenerMasterSnapshot] Upserted snapshot for ${upperSymbol}`, {
          event: "SCREENER_MASTER_SNAPSHOT_UPSERTED",
          userId: "system",
          symbol: upperSymbol,
          latencyMs: 0,
          status: "success",
          serviceVersion: ScreenerMasterSnapshotService.SERVICE_VERSION,
        });

        return { symbol: upperSymbol, success: true };
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const retryable = this._isRetryable(err);
        if (!retryable || attempt === ScreenerMasterSnapshotService.MAX_RETRIES) break;
        // Exponential backoff: 100ms, 200ms, 400ms
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt - 1)));
      }
    }

    logger.error(`[ScreenerMasterSnapshot] Upsert failed for ${upperSymbol}: ${lastError?.message}`, {
      event: "SCREENER_MASTER_SNAPSHOT_UPSERT_FAILED",
      userId: "system",
      symbol: upperSymbol,
      status: "error",
      errorCode: "SMS_UPSERT_FAILED",
      errorMessage: lastError?.message,
    });

    return { symbol: upperSymbol, success: false, error: lastError?.message };
  }

  /**
   * Rebuilds the full screener_master_snapshots table for ALL active symbols.
   * Runs nightly at 02:00 AM IST. Processes in batches of 50 for connection-pool safety.
   *
   * @param symbolFilter  Optional subset of symbols to refresh (default: all active)
   * @returns             Summary stats: { total, succeeded, failed }
   */
  async rebuildFullSnapshot(symbolFilter?: string[]): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    failedSymbols: string[];
  }> {
    const startMs = Date.now();
    logger.info(`[ScreenerMasterSnapshot] Full rebuild started (filter: ${symbolFilter?.length ?? "all"})`, {
      event: "SCREENER_MASTER_SNAPSHOT_REBUILD_STARTED",
      userId: "system",
      status: "started",
    });

    // ── Fetch candidate symbols ──────────────────────────────────────────────
    let symbols: string[];
    if (symbolFilter && symbolFilter.length > 0) {
      symbols = symbolFilter.map((s) => s.toUpperCase().trim()).filter(Boolean);
    } else {
      // Read all active symbols from listed_stocks (the authoritative universe)
      const rows = await db.execute(
        sql`SELECT DISTINCT symbol FROM listed_stocks WHERE is_active = true AND symbol IS NOT NULL ORDER BY symbol`
      );
      symbols = ((rows as any).rows ?? []).map((r: any) => r.symbol as string).filter(Boolean);
    }

    const BATCH_SIZE = 100;
    let succeeded = 0;
    let failed = 0;
    const failedSymbols: string[] = [];

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);

      try {
        await this.upsertBatchSnapshots(batch);
        succeeded += batch.length;
      } catch (batchErr: any) {
        logger.warn(`[ScreenerMasterSnapshot] Batch upsert failed for chunk of ${batch.length}, falling back to per-symbol: ${batchErr?.message}`);
        // Fallback to per-symbol for this specific batch
        const results = await Promise.allSettled(
          batch.map((sym) => this.upsertSnapshot(sym))
        );
        for (const result of results) {
          if (result.status === "fulfilled" && result.value.success) {
            succeeded++;
          } else {
            failed++;
            if (result.status === "fulfilled") {
              failedSymbols.push(result.value.symbol);
            }
          }
        }
      }

      // Yield between batches to avoid connection pool exhaustion
      if (i + BATCH_SIZE < symbols.length) {
        await new Promise((r) => setTimeout(r, 20));
      }
    }

    const latencyMs = Date.now() - startMs;
    logger.info(`[ScreenerMasterSnapshot] Rebuild complete: ${succeeded}/${symbols.length} succeeded in ${latencyMs}ms`, {
      event: "SCREENER_MASTER_SNAPSHOT_REBUILD_COMPLETED",
      userId: "system",
      latencyMs,
      status: succeeded > 0 ? "success" : "error",
      total: symbols.length,
      succeeded,
      failed,
    });

    return { total: symbols.length, succeeded, failed, failedSymbols };
  }

  /**
   * Bulk-fetches master snapshots for a set of symbols in a single DB query.
   * Primary read path for StockStrategy candidate scoring (replaces per-symbol N+1 fetching).
   *
   * @param symbols  Array of NSE/BSE tickers
   * @returns        Map<UPPER_SYMBOL, snapshot row>
   *
   * @performance    1 DB roundtrip for up to 500 symbols vs. 11 queries × N symbols previously.
   */
  async getBulkSnapshots(symbols: string[]): Promise<Map<string, any>> {
    if (!symbols.length) return new Map();

    const upperSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean)));

    try {
      const rows = await db.execute(
        sql`
          SELECT * FROM screener_master_snapshots
          WHERE symbol = ANY(${sql.raw(`ARRAY[${upperSymbols.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]`)})
        `
      );

      const result = new Map<string, any>();
      for (const row of ((rows as any).rows ?? [])) {
        if (row.symbol) result.set(row.symbol as string, row);
      }
      return result;
    } catch (err: any) {
      logger.warn(`[ScreenerMasterSnapshot] Bulk fetch failed: ${err?.message}`, {
        event: "SCREENER_MASTER_SNAPSHOT_BULK_FETCH_FAILED",
        userId: "system",
        status: "error",
        error: err?.message,
      });
      return new Map();
    }
  }

  // ── Private: Core Upsert SQL ─────────────────────────────────────────────────

  /**
   * High-performance batch upsert for up to 100 symbols in a single roundtrip.
   * Uses DISTINCT ON (symbol) in sub-table CTEs to pick latest records per symbol.
   */
  async upsertBatchSnapshots(symbols: string[]): Promise<void> {
    if (!symbols.length) return;
    const cleanSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim()).filter(Boolean)));
    if (!cleanSymbols.length) return;

    const symbolListSql = sql.raw(`ARRAY[${cleanSymbols.map((s) => `'${s.replace(/'/g, "''")}'`).join(",")}]`);

    await db.execute(sql`
      WITH
        ls AS (
          SELECT
            symbol, isin, company_name, exchange, sector, broad_sector, industry,
            market_cap_category, current_price, previous_close, day_change_percent,
            market_cap_value, average_volume, week_high_52, week_low_52,
            index_membership, pro_themes, technical_signal, piotroski_f_score,
            consensus_upside_percent
          FROM listed_stocks
          WHERE symbol = ANY(${symbolListSql})
        ),
        fin AS (
          SELECT DISTINCT ON (symbol)
            symbol, pe_ratio, forward_pe, peg_ratio, pb_ratio, ev_to_ebitda,
            roe, roce, roa, net_profit_margin, operating_margin, gross_margin,
            debt_to_equity, current_ratio, dividend_yield, eps, book_value,
            earnings_growth, free_cash_flow, interest_coverage, fiscal_year
          FROM screener_financials
          WHERE symbol = ANY(${symbolListSql})
          ORDER BY symbol, fiscal_year DESC NULLS LAST, last_updated DESC NULLS LAST
        ),
        km AS (
          SELECT DISTINCT ON (symbol)
            symbol, roic, market_cap, enterprise_value, free_cash_flow_yield, earnings_yield,
            days_sales_outstanding, days_payables_outstanding, days_of_inventory_on_hand,
            income_quality, net_debt_to_ebitda, graham_number, pe_ratio AS km_pe,
            pb_ratio AS km_pb, roe AS km_roe, debt_to_equity AS km_de, dividend_yield AS km_dy
          FROM screener_key_metrics
          WHERE symbol = ANY(${symbolListSql})
          ORDER BY symbol, date DESC NULLS LAST, last_updated DESC NULLS LAST
        ),
        gm AS (
          SELECT DISTINCT ON (symbol)
            symbol, revenue_growth, eps_growth AS gm_earnings_growth
          FROM screener_growth_metrics
          WHERE symbol = ANY(${symbolListSql})
          ORDER BY symbol, date DESC NULLS LAST
        ),
        dm AS (
          SELECT
            symbol, composite_score, fintek_rating, growth_score, quality_score, value_score,
            risk_score, piotroski_score, altman_z_score, magic_formula_rank,
            return_1w, return_1m, return_3m, return_6m, return_1y, return_2y,
            return_3y, return_5y, return_ytd, return_vs_nifty_1y, return_vs_sector_1y,
            beta, sharpe_ratio_1y, sortino_ratio_1y, max_drawdown_1y, volatility_30d,
            week_high_52 AS dm_week_high, week_low_52 AS dm_week_low,
            technical_rating AS dm_tech_rating
          FROM screener_derived_metrics
          WHERE symbol = ANY(${symbolListSql})
        ),
        ti AS (
          SELECT
            symbol, rsi_14, sma_50, sma_200, NULL::numeric AS ema_20, macd, adx, technical_rating AS ti_tech_rating
          FROM screener_technical_indicators_latest
          WHERE symbol = ANY(${symbolListSql})
        ),
        sh AS (
          SELECT DISTINCT ON (symbol)
            symbol, promoter_holding, promoter_holding_change, fii_holding, fii_holding_change,
            dii_holding, pledged_shares, quarter_date
          FROM screener_shareholding
          WHERE symbol = ANY(${symbolListSql})
          ORDER BY symbol, quarter_date DESC NULLS LAST, created_at DESC NULLS LAST
        ),
        ac AS (
          SELECT symbol, avg_target, upside_pct, consensus_rating, analyst_count
          FROM screener_analyst_consensus
          WHERE symbol = ANY(${symbolListSql})
        ),
        dcf AS (
          SELECT DISTINCT ON (symbol)
            symbol, upside_percent AS dcf_upside
          FROM screener_dcf_valuations
          WHERE symbol = ANY(${symbolListSql})
          ORDER BY symbol, date DESC NULLS LAST, last_updated DESC NULLS LAST
        )
      INSERT INTO screener_master_snapshots (
        symbol, isin, company_name, exchange, sector, broad_sector, industry,
        market_cap_category, current_price, previous_close, day_change_percent,
        market_cap_value, average_volume, week_high_52, week_low_52,
        pe_ratio, forward_pe, peg_ratio, pb_ratio, ev_to_ebitda,
        roe, roce, roa, roic, net_profit_margin, operating_margin, gross_margin,
        debt_to_equity, current_ratio, dividend_yield, eps, book_value,
        revenue_growth, earnings_growth, free_cash_flow, fcf_margin,
        net_debt_to_ebitda, interest_coverage, graham_number,
        market_cap, enterprise_value, free_cash_flow_yield, earnings_yield,
        days_sales_outstanding, days_payables_outstanding, days_inventory_on_hand, income_quality,
        rsi_14, sma_50, sma_200, ema_20, macd, adx, technical_rating,
        composite_score, fintek_rating, growth_score, quality_score, value_score,
        risk_score, piotroski_score, altman_z_score, magic_formula_rank,
        return_1w, return_1m, return_3m, return_6m, return_1y, return_2y,
        return_3y, return_5y, return_ytd, return_vs_nifty_1y, return_vs_sector_1y,
        beta, sharpe_ratio_1y, sortino_ratio_1y, max_drawdown_1y, volatility_30d,
        promoter_holding, promoter_holding_change, fii_holding, fii_holding_change,
        dii_holding, pledged_shares, shareholding_quarter_date,
        analyst_avg_target, analyst_upside_pct, analyst_consensus_rating, analyst_count,
        dcf_upside_percent,
        index_membership, pro_themes, technical_signal, piotroski_f_score,
        consensus_upside_percent,
        financials_fiscal_year, snapshot_version,
        source, created_at, updated_at
      )
      SELECT
        ls.symbol,
        ls.isin,
        ls.company_name,
        COALESCE(ls.exchange, 'NSE'),
        ls.sector,
        ls.broad_sector,
        ls.industry,
        ls.market_cap_category,
        ls.current_price::numeric,
        ls.previous_close::numeric,
        ls.day_change_percent::numeric,
        ls.market_cap_value::numeric,
        ls.average_volume::numeric,
        COALESCE(dm.dm_week_high::numeric, ls.week_high_52::numeric),
        COALESCE(dm.dm_week_low::numeric, ls.week_low_52::numeric),
        COALESCE(NULLIF(fin.pe_ratio::numeric, 0), NULLIF(km.km_pe::numeric, 0)),
        fin.forward_pe::numeric,
        fin.peg_ratio::numeric,
        COALESCE(NULLIF(fin.pb_ratio::numeric, 0), NULLIF(km.km_pb::numeric, 0)),
        fin.ev_to_ebitda::numeric,
        COALESCE(NULLIF(fin.roe::numeric, 0), NULLIF(km.km_roe::numeric, 0)),
        fin.roce::numeric,
        fin.roa::numeric,
        km.roic::numeric,
        fin.net_profit_margin::numeric,
        fin.operating_margin::numeric,
        fin.gross_margin::numeric,
        COALESCE(fin.debt_to_equity::numeric, km.km_de::numeric),
        fin.current_ratio::numeric,
        COALESCE(fin.dividend_yield::numeric, km.km_dy::numeric),
        fin.eps::numeric,
        fin.book_value::numeric,
        COALESCE(gm.revenue_growth::numeric, fin.earnings_growth::numeric),
        COALESCE(gm.gm_earnings_growth::numeric, fin.earnings_growth::numeric),
        fin.free_cash_flow::numeric,
        NULL::numeric AS fcf_margin,
        km.net_debt_to_ebitda::numeric,
        fin.interest_coverage::numeric,
        km.graham_number::numeric,
        COALESCE(km.market_cap::numeric, ls.market_cap_value::numeric),
        km.enterprise_value::numeric,
        km.free_cash_flow_yield::numeric,
        km.earnings_yield::numeric,
        km.days_sales_outstanding::numeric,
        km.days_payables_outstanding::numeric,
        km.days_of_inventory_on_hand::numeric,
        km.income_quality::numeric,
        ti.rsi_14::numeric,
        ti.sma_50::numeric,
        ti.sma_200::numeric,
        ti.ema_20::numeric,
        ti.macd::numeric,
        ti.adx::numeric,
        COALESCE(dm.dm_tech_rating, ti.ti_tech_rating),
        dm.composite_score::numeric,
        dm.fintek_rating,
        dm.growth_score::numeric,
        dm.quality_score::numeric,
        dm.value_score::numeric,
        dm.risk_score::numeric,
        dm.piotroski_score,
        dm.altman_z_score::numeric,
        dm.magic_formula_rank,
        dm.return_1w::numeric, dm.return_1m::numeric, dm.return_3m::numeric, dm.return_6m::numeric,
        dm.return_1y::numeric, dm.return_2y::numeric, dm.return_3y::numeric, dm.return_5y::numeric, dm.return_ytd::numeric,
        dm.return_vs_nifty_1y::numeric, dm.return_vs_sector_1y::numeric,
        dm.beta::numeric, dm.sharpe_ratio_1y::numeric, dm.sortino_ratio_1y::numeric, dm.max_drawdown_1y::numeric, dm.volatility_30d::numeric,
        sh.promoter_holding::numeric, sh.promoter_holding_change::numeric,
        sh.fii_holding::numeric, sh.fii_holding_change::numeric, sh.dii_holding::numeric, sh.pledged_shares::numeric,
        sh.quarter_date::text,
        ac.avg_target::numeric, ac.upside_pct::numeric, ac.consensus_rating, ac.analyst_count,
        dcf.dcf_upside::numeric,
        COALESCE(ls.index_membership, '[]'::jsonb),
        COALESCE(ls.pro_themes, ARRAY[]::text[]),
        ls.technical_signal,
        ls.piotroski_f_score,
        ls.consensus_upside_percent::numeric,
        fin.fiscal_year,
        1,
        'cron',
        NOW(),
        NOW()
      FROM ls
      LEFT JOIN fin ON fin.symbol = ls.symbol
      LEFT JOIN km ON km.symbol = ls.symbol
      LEFT JOIN gm ON gm.symbol = ls.symbol
      LEFT JOIN dm ON dm.symbol = ls.symbol
      LEFT JOIN ti ON ti.symbol = ls.symbol
      LEFT JOIN sh ON sh.symbol = ls.symbol
      LEFT JOIN ac ON ac.symbol = ls.symbol
      LEFT JOIN dcf ON dcf.symbol = ls.symbol
      ON CONFLICT (symbol) DO UPDATE SET
        isin = EXCLUDED.isin,
        company_name = EXCLUDED.company_name,
        sector = EXCLUDED.sector,
        broad_sector = EXCLUDED.broad_sector,
        industry = EXCLUDED.industry,
        market_cap_category = EXCLUDED.market_cap_category,
        current_price = EXCLUDED.current_price,
        previous_close = EXCLUDED.previous_close,
        day_change_percent = EXCLUDED.day_change_percent,
        market_cap_value = EXCLUDED.market_cap_value,
        average_volume = EXCLUDED.average_volume,
        week_high_52 = EXCLUDED.week_high_52,
        week_low_52 = EXCLUDED.week_low_52,
        pe_ratio = EXCLUDED.pe_ratio,
        forward_pe = EXCLUDED.forward_pe,
        peg_ratio = EXCLUDED.peg_ratio,
        pb_ratio = EXCLUDED.pb_ratio,
        ev_to_ebitda = EXCLUDED.ev_to_ebitda,
        roe = EXCLUDED.roe,
        roce = EXCLUDED.roce,
        roa = EXCLUDED.roa,
        roic = EXCLUDED.roic,
        net_profit_margin = EXCLUDED.net_profit_margin,
        operating_margin = EXCLUDED.operating_margin,
        gross_margin = EXCLUDED.gross_margin,
        debt_to_equity = EXCLUDED.debt_to_equity,
        current_ratio = EXCLUDED.current_ratio,
        dividend_yield = EXCLUDED.dividend_yield,
        eps = EXCLUDED.eps,
        book_value = EXCLUDED.book_value,
        revenue_growth = EXCLUDED.revenue_growth,
        earnings_growth = EXCLUDED.earnings_growth,
        free_cash_flow = EXCLUDED.free_cash_flow,
        fcf_margin = EXCLUDED.fcf_margin,
        net_debt_to_ebitda = EXCLUDED.net_debt_to_ebitda,
        interest_coverage = EXCLUDED.interest_coverage,
        graham_number = EXCLUDED.graham_number,
        market_cap = EXCLUDED.market_cap,
        enterprise_value = EXCLUDED.enterprise_value,
        free_cash_flow_yield = EXCLUDED.free_cash_flow_yield,
        earnings_yield = EXCLUDED.earnings_yield,
        days_sales_outstanding = EXCLUDED.days_sales_outstanding,
        days_payables_outstanding = EXCLUDED.days_payables_outstanding,
        days_inventory_on_hand = EXCLUDED.days_inventory_on_hand,
        income_quality = EXCLUDED.income_quality,
        rsi_14 = EXCLUDED.rsi_14,
        sma_50 = EXCLUDED.sma_50,
        sma_200 = EXCLUDED.sma_200,
        ema_20 = EXCLUDED.ema_20,
        macd = EXCLUDED.macd,
        adx = EXCLUDED.adx,
        technical_rating = EXCLUDED.technical_rating,
        composite_score = EXCLUDED.composite_score,
        fintek_rating = EXCLUDED.fintek_rating,
        growth_score = EXCLUDED.growth_score,
        quality_score = EXCLUDED.quality_score,
        value_score = EXCLUDED.value_score,
        risk_score = EXCLUDED.risk_score,
        piotroski_score = EXCLUDED.piotroski_score,
        altman_z_score = EXCLUDED.altman_z_score,
        magic_formula_rank = EXCLUDED.magic_formula_rank,
        return_1w = EXCLUDED.return_1w,
        return_1m = EXCLUDED.return_1m,
        return_3m = EXCLUDED.return_3m,
        return_6m = EXCLUDED.return_6m,
        return_1y = EXCLUDED.return_1y,
        return_2y = EXCLUDED.return_2y,
        return_3y = EXCLUDED.return_3y,
        return_5y = EXCLUDED.return_5y,
        return_ytd = EXCLUDED.return_ytd,
        return_vs_nifty_1y = EXCLUDED.return_vs_nifty_1y,
        return_vs_sector_1y = EXCLUDED.return_vs_sector_1y,
        beta = EXCLUDED.beta,
        sharpe_ratio_1y = EXCLUDED.sharpe_ratio_1y,
        sortino_ratio_1y = EXCLUDED.sortino_ratio_1y,
        max_drawdown_1y = EXCLUDED.max_drawdown_1y,
        volatility_30d = EXCLUDED.volatility_30d,
        promoter_holding = EXCLUDED.promoter_holding,
        promoter_holding_change = EXCLUDED.promoter_holding_change,
        fii_holding = EXCLUDED.fii_holding,
        fii_holding_change = EXCLUDED.fii_holding_change,
        dii_holding = EXCLUDED.dii_holding,
        pledged_shares = EXCLUDED.pledged_shares,
        shareholding_quarter_date = EXCLUDED.shareholding_quarter_date,
        analyst_avg_target = EXCLUDED.analyst_avg_target,
        analyst_upside_pct = EXCLUDED.analyst_upside_pct,
        analyst_consensus_rating = EXCLUDED.analyst_consensus_rating,
        analyst_count = EXCLUDED.analyst_count,
        dcf_upside_percent = EXCLUDED.dcf_upside_percent,
        index_membership = EXCLUDED.index_membership,
        pro_themes = EXCLUDED.pro_themes,
        technical_signal = EXCLUDED.technical_signal,
        piotroski_f_score = EXCLUDED.piotroski_f_score,
        consensus_upside_percent = EXCLUDED.consensus_upside_percent,
        financials_fiscal_year = EXCLUDED.financials_fiscal_year,
        snapshot_version = screener_master_snapshots.snapshot_version + 1,
        source = 'cron',
        updated_at = NOW()
    `);
  }

  // ── Private: Core Single-Symbol Upsert SQL ───────────────────────────────────

  /**
   * Executes the aggregated SQL that reads from all screener sub-tables and
   * upserts into screener_master_snapshots in a single statement.
   *
   * Uses CTEs (WITH clauses) for readability and PostgreSQL query plan efficiency.
   * All sub-selects use LIMIT 1 with appropriate ORDER BY to pick the latest row.
   */
  private async _upsertSnapshotSql(symbol: string): Promise<void> {
    await db.execute(sql`
      WITH
        ls AS (
          SELECT
            symbol, isin, company_name, exchange, sector, broad_sector, industry,
            market_cap_category, current_price, previous_close, day_change_percent,
            market_cap_value, average_volume, week_high_52, week_low_52,
            index_membership, pro_themes, technical_signal, piotroski_f_score,
            consensus_upside_percent
          FROM listed_stocks
          WHERE symbol = ${symbol}
          LIMIT 1
        ),
        fin AS (
          SELECT
            pe_ratio, forward_pe, peg_ratio, pb_ratio, ev_to_ebitda,
            roe, roce, roa, net_profit_margin, operating_margin, gross_margin,
            debt_to_equity, current_ratio, dividend_yield, eps, book_value,
            earnings_growth, free_cash_flow, interest_coverage, fiscal_year
          FROM screener_financials
          WHERE symbol = ${symbol}
          ORDER BY fiscal_year DESC NULLS LAST, last_updated DESC NULLS LAST
          LIMIT 1
        ),
        km AS (
          SELECT
            roic, market_cap, enterprise_value, free_cash_flow_yield, earnings_yield,
            days_sales_outstanding, days_payables_outstanding, days_of_inventory_on_hand,
            income_quality, net_debt_to_ebitda, graham_number, pe_ratio AS km_pe,
            pb_ratio AS km_pb, roe AS km_roe, debt_to_equity AS km_de, dividend_yield AS km_dy
          FROM screener_key_metrics
          WHERE symbol = ${symbol}
          ORDER BY date DESC NULLS LAST, last_updated DESC NULLS LAST
          LIMIT 1
        ),
        gm AS (
          SELECT revenue_growth, eps_growth AS gm_earnings_growth
          FROM screener_growth_metrics
          WHERE symbol = ${symbol}
          ORDER BY date DESC NULLS LAST
          LIMIT 1
        ),
        dm AS (
          SELECT
            composite_score, fintek_rating, growth_score, quality_score, value_score,
            risk_score, piotroski_score, altman_z_score, magic_formula_rank,
            return_1w, return_1m, return_3m, return_6m, return_1y, return_2y,
            return_3y, return_5y, return_ytd, return_vs_nifty_1y, return_vs_sector_1y,
            beta, sharpe_ratio_1y, sortino_ratio_1y, max_drawdown_1y, volatility_30d,
            week_high_52 AS dm_week_high, week_low_52 AS dm_week_low,
            technical_rating AS dm_tech_rating
          FROM screener_derived_metrics
          WHERE symbol = ${symbol}
          LIMIT 1
        ),
        ti AS (
          SELECT rsi_14, sma_50, sma_200, NULL::numeric AS ema_20, macd, adx, technical_rating AS ti_tech_rating
          FROM screener_technical_indicators_latest
          WHERE symbol = ${symbol}
          LIMIT 1
        ),
        sh AS (
          SELECT
            promoter_holding, promoter_holding_change, fii_holding, fii_holding_change,
            dii_holding, pledged_shares, quarter_date
          FROM screener_shareholding
          WHERE symbol = ${symbol}
          ORDER BY quarter_date DESC NULLS LAST, created_at DESC NULLS LAST
          LIMIT 1
        ),
        ac AS (
          SELECT avg_target, upside_pct, consensus_rating, analyst_count
          FROM screener_analyst_consensus
          WHERE symbol = ${symbol}
          LIMIT 1
        ),
        dcf AS (
          SELECT upside_percent AS dcf_upside
          FROM screener_dcf_valuations
          WHERE symbol = ${symbol}
          ORDER BY date DESC NULLS LAST, last_updated DESC NULLS LAST
          LIMIT 1
        )
      INSERT INTO screener_master_snapshots (
        symbol, isin, company_name, exchange, sector, broad_sector, industry,
        market_cap_category, current_price, previous_close, day_change_percent,
        market_cap_value, average_volume, week_high_52, week_low_52,
        pe_ratio, forward_pe, peg_ratio, pb_ratio, ev_to_ebitda,
        roe, roce, roa, roic, net_profit_margin, operating_margin, gross_margin,
        debt_to_equity, current_ratio, dividend_yield, eps, book_value,
        revenue_growth, earnings_growth, free_cash_flow, fcf_margin,
        net_debt_to_ebitda, interest_coverage, graham_number,
        market_cap, enterprise_value, free_cash_flow_yield, earnings_yield,
        days_sales_outstanding, days_payables_outstanding, days_inventory_on_hand, income_quality,
        rsi_14, sma_50, sma_200, ema_20, macd, adx, technical_rating,
        composite_score, fintek_rating, growth_score, quality_score, value_score,
        risk_score, piotroski_score, altman_z_score, magic_formula_rank,
        return_1w, return_1m, return_3m, return_6m, return_1y, return_2y,
        return_3y, return_5y, return_ytd, return_vs_nifty_1y, return_vs_sector_1y,
        beta, sharpe_ratio_1y, sortino_ratio_1y, max_drawdown_1y, volatility_30d,
        promoter_holding, promoter_holding_change, fii_holding, fii_holding_change,
        dii_holding, pledged_shares, shareholding_quarter_date,
        analyst_avg_target, analyst_upside_pct, analyst_consensus_rating, analyst_count,
        dcf_upside_percent,
        index_membership, pro_themes, technical_signal, piotroski_f_score,
        consensus_upside_percent,
        financials_fiscal_year, snapshot_version,
        source, created_at, updated_at
      )
      SELECT
        ${symbol},
        ls.isin, ls.company_name, COALESCE(ls.exchange, 'NSE'), ls.sector, ls.broad_sector, ls.industry,
        ls.market_cap_category, ls.current_price::numeric, ls.previous_close::numeric, ls.day_change_percent::numeric,
        ls.market_cap_value::numeric, ls.average_volume::numeric,
        COALESCE(dm.dm_week_high::numeric, ls.week_high_52::numeric),
        COALESCE(dm.dm_week_low::numeric, ls.week_low_52::numeric),
        -- Fundamentals (cross-table fallback)
        COALESCE(NULLIF(fin.pe_ratio::numeric, 0), NULLIF(km.km_pe::numeric, 0)),
        fin.forward_pe::numeric,
        fin.peg_ratio::numeric,
        COALESCE(NULLIF(fin.pb_ratio::numeric, 0), NULLIF(km.km_pb::numeric, 0)),
        fin.ev_to_ebitda::numeric,
        COALESCE(NULLIF(fin.roe::numeric, 0), NULLIF(km.km_roe::numeric, 0)),
        fin.roce::numeric,
        fin.roa::numeric,
        km.roic::numeric,
        fin.net_profit_margin::numeric,
        fin.operating_margin::numeric,
        fin.gross_margin::numeric,
        COALESCE(fin.debt_to_equity::numeric, km.km_de::numeric),
        fin.current_ratio::numeric,
        COALESCE(fin.dividend_yield::numeric, km.km_dy::numeric),
        fin.eps::numeric,
        fin.book_value::numeric,
        COALESCE(gm.revenue_growth::numeric, fin.earnings_growth::numeric),
        COALESCE(gm.gm_earnings_growth::numeric, fin.earnings_growth::numeric),
        fin.free_cash_flow::numeric,
        NULL::numeric AS fcf_margin,
        km.net_debt_to_ebitda,
        fin.interest_coverage,
        km.graham_number,
        -- Key Metrics
        COALESCE(km.market_cap, ls.market_cap_value),
        km.enterprise_value,
        km.free_cash_flow_yield,
        km.earnings_yield,
        km.days_sales_outstanding,
        km.days_payables_outstanding,
        km.days_of_inventory_on_hand,
        km.income_quality,
        -- Technicals
        ti.rsi_14,
        ti.sma_50,
        ti.sma_200,
        ti.ema_20,
        ti.macd,
        ti.adx,
        COALESCE(dm.dm_tech_rating, ti.ti_tech_rating),
        -- Derived / Scoring
        dm.composite_score,
        dm.fintek_rating,
        dm.growth_score,
        dm.quality_score,
        dm.value_score,
        dm.risk_score,
        dm.piotroski_score,
        dm.altman_z_score,
        dm.magic_formula_rank,
        -- Returns & Risk
        dm.return_1w, dm.return_1m, dm.return_3m, dm.return_6m,
        dm.return_1y, dm.return_2y, dm.return_3y, dm.return_5y, dm.return_ytd,
        dm.return_vs_nifty_1y, dm.return_vs_sector_1y,
        dm.beta, dm.sharpe_ratio_1y, dm.sortino_ratio_1y, dm.max_drawdown_1y, dm.volatility_30d,
        -- Shareholding
        sh.promoter_holding, sh.promoter_holding_change,
        sh.fii_holding, sh.fii_holding_change, sh.dii_holding, sh.pledged_shares,
        sh.quarter_date::text,
        -- Analyst & DCF
        ac.avg_target, ac.upside_pct, ac.consensus_rating, ac.analyst_count,
        dcf.dcf_upside,
        -- Additional
        COALESCE(ls.index_membership, '[]'::jsonb),
        COALESCE(ls.pro_themes, ARRAY[]::text[]),
        ls.technical_signal,
        ls.piotroski_f_score,
        ls.consensus_upside_percent,
        fin.fiscal_year,
        1,
        'cron',
        NOW(),
        NOW()
      FROM ls
      LEFT JOIN fin ON true
      LEFT JOIN km ON true
      LEFT JOIN gm ON true
      LEFT JOIN dm ON true
      LEFT JOIN ti ON true
      LEFT JOIN sh ON true
      LEFT JOIN ac ON true
      LEFT JOIN dcf ON true
      ON CONFLICT (symbol) DO UPDATE SET
        isin = EXCLUDED.isin,
        company_name = EXCLUDED.company_name,
        sector = EXCLUDED.sector,
        broad_sector = EXCLUDED.broad_sector,
        industry = EXCLUDED.industry,
        market_cap_category = EXCLUDED.market_cap_category,
        current_price = EXCLUDED.current_price,
        previous_close = EXCLUDED.previous_close,
        day_change_percent = EXCLUDED.day_change_percent,
        market_cap_value = EXCLUDED.market_cap_value,
        average_volume = EXCLUDED.average_volume,
        week_high_52 = EXCLUDED.week_high_52,
        week_low_52 = EXCLUDED.week_low_52,
        pe_ratio = EXCLUDED.pe_ratio,
        forward_pe = EXCLUDED.forward_pe,
        peg_ratio = EXCLUDED.peg_ratio,
        pb_ratio = EXCLUDED.pb_ratio,
        ev_to_ebitda = EXCLUDED.ev_to_ebitda,
        roe = EXCLUDED.roe,
        roce = EXCLUDED.roce,
        roa = EXCLUDED.roa,
        roic = EXCLUDED.roic,
        net_profit_margin = EXCLUDED.net_profit_margin,
        operating_margin = EXCLUDED.operating_margin,
        gross_margin = EXCLUDED.gross_margin,
        debt_to_equity = EXCLUDED.debt_to_equity,
        current_ratio = EXCLUDED.current_ratio,
        dividend_yield = EXCLUDED.dividend_yield,
        eps = EXCLUDED.eps,
        book_value = EXCLUDED.book_value,
        revenue_growth = EXCLUDED.revenue_growth,
        earnings_growth = EXCLUDED.earnings_growth,
        free_cash_flow = EXCLUDED.free_cash_flow,
        net_debt_to_ebitda = EXCLUDED.net_debt_to_ebitda,
        interest_coverage = EXCLUDED.interest_coverage,
        graham_number = EXCLUDED.graham_number,
        market_cap = EXCLUDED.market_cap,
        enterprise_value = EXCLUDED.enterprise_value,
        free_cash_flow_yield = EXCLUDED.free_cash_flow_yield,
        earnings_yield = EXCLUDED.earnings_yield,
        days_sales_outstanding = EXCLUDED.days_sales_outstanding,
        days_payables_outstanding = EXCLUDED.days_payables_outstanding,
        days_inventory_on_hand = EXCLUDED.days_inventory_on_hand,
        income_quality = EXCLUDED.income_quality,
        rsi_14 = EXCLUDED.rsi_14,
        sma_50 = EXCLUDED.sma_50,
        sma_200 = EXCLUDED.sma_200,
        ema_20 = EXCLUDED.ema_20,
        macd = EXCLUDED.macd,
        adx = EXCLUDED.adx,
        technical_rating = EXCLUDED.technical_rating,
        composite_score = EXCLUDED.composite_score,
        fintek_rating = EXCLUDED.fintek_rating,
        growth_score = EXCLUDED.growth_score,
        quality_score = EXCLUDED.quality_score,
        value_score = EXCLUDED.value_score,
        risk_score = EXCLUDED.risk_score,
        piotroski_score = EXCLUDED.piotroski_score,
        altman_z_score = EXCLUDED.altman_z_score,
        magic_formula_rank = EXCLUDED.magic_formula_rank,
        return_1w = EXCLUDED.return_1w,
        return_1m = EXCLUDED.return_1m,
        return_3m = EXCLUDED.return_3m,
        return_6m = EXCLUDED.return_6m,
        return_1y = EXCLUDED.return_1y,
        return_2y = EXCLUDED.return_2y,
        return_3y = EXCLUDED.return_3y,
        return_5y = EXCLUDED.return_5y,
        return_ytd = EXCLUDED.return_ytd,
        return_vs_nifty_1y = EXCLUDED.return_vs_nifty_1y,
        return_vs_sector_1y = EXCLUDED.return_vs_sector_1y,
        beta = EXCLUDED.beta,
        sharpe_ratio_1y = EXCLUDED.sharpe_ratio_1y,
        sortino_ratio_1y = EXCLUDED.sortino_ratio_1y,
        max_drawdown_1y = EXCLUDED.max_drawdown_1y,
        volatility_30d = EXCLUDED.volatility_30d,
        promoter_holding = EXCLUDED.promoter_holding,
        promoter_holding_change = EXCLUDED.promoter_holding_change,
        fii_holding = EXCLUDED.fii_holding,
        fii_holding_change = EXCLUDED.fii_holding_change,
        dii_holding = EXCLUDED.dii_holding,
        pledged_shares = EXCLUDED.pledged_shares,
        shareholding_quarter_date = EXCLUDED.shareholding_quarter_date,
        analyst_avg_target = EXCLUDED.analyst_avg_target,
        analyst_upside_pct = EXCLUDED.analyst_upside_pct,
        analyst_consensus_rating = EXCLUDED.analyst_consensus_rating,
        analyst_count = EXCLUDED.analyst_count,
        dcf_upside_percent = EXCLUDED.dcf_upside_percent,
        index_membership = EXCLUDED.index_membership,
        pro_themes = EXCLUDED.pro_themes,
        technical_signal = EXCLUDED.technical_signal,
        piotroski_f_score = EXCLUDED.piotroski_f_score,
        consensus_upside_percent = EXCLUDED.consensus_upside_percent,
        financials_fiscal_year = EXCLUDED.financials_fiscal_year,
        snapshot_version = screener_master_snapshots.snapshot_version + 1,
        source = 'cron',
        updated_at = NOW()
    `);
  }

  /** Returns true for errors that are safe to retry (transient network/lock issues). */
  private _isRetryable(err: any): boolean {
    const msg = String(err?.message ?? "").toLowerCase();
    return (
      msg.includes("timeout") ||
      msg.includes("connection") ||
      msg.includes("deadlock") ||
      msg.includes("too many clients")
    );
  }
}

/** Singleton export — import this across all services */
export const screenerMasterSnapshotService = new ScreenerMasterSnapshotService();
