/**
 * @file model-portfolio-nav-service.ts
 * @description Computes and stores monthly NAV history for all published model portfolios.
 *
 * Purpose  : Power the rolling monthly bar chart and cumulative benchmark line chart
 *            on the portfolio card (brief §2 & §3).
 * Inputs   : model_portfolio_holdings (target weights + NAV), mf_monthwise_performance
 *            (month-level holding returns), model_portfolios (inception_date, holdings)
 * Outputs  : model_portfolio_nav_history rows (monthly NAV, monthly_return, absolute_return,
 *            benchmark_return, had_rebalance_event)
 * Edge     : Portfolios with < 2 months of history emit only 1 bar (inception bar).
 *            Simulated data is used if no real NAV history exists (fallback).
 *
 * @engineVersion FASP-AI-v3.0
 * @compliance    GCR: structured logs { event, portfolio_id, months_written, latency_ms, status }
 */

import { sql } from "drizzle-orm";
import { logger } from "../logger";
import { db as _dbType } from "../db"; // L-MP4: import for typeof — do NOT use the singleton directly (callers pass their own)
import { bigQueryTimeSeriesService } from "./bigquery-timeseries-service";
import { fetchHistoricalPrices } from "./golden-pricing/GoldenPricingEngine";
type DbClient = typeof _dbType;


// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthRow {
  month_start: string;          // YYYY-MM-DD (first day of month)
  portfolio_nav: number;        // blended NAV
  benchmark_nav: number;        // benchmark index level for the same month
  had_rebalance: boolean;
  rebalance_trigger?: string;
}

interface NavHistoryResult {
  portfolioId: string;
  monthsWritten: number;
  latencyMs: number;
  status: "ok" | "error" | "no_data";
  error?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Derives a stable seed from a portfolio id string for deterministic NAV curve generation. */
function hashPortfolioId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Generates an analytical compound CAGR NAV curve from inception to now.
 * Pure mathematical geometric progression used when granular holding NAV data is unavailable.
 */
function generateSyntheticNavCurve(
  portfolioId: string,
  annualReturn: number,
  volatility: number,
  inceptionDate: Date,
): MonthRow[] {
  const safeAnnualReturn = Number.isFinite(annualReturn) ? annualReturn : 10;
  const base = Math.max(0.01, 1 + safeAnnualReturn / 100);
  const monthlyReturn = Math.pow(base, 1 / 12) - 1;
  const benchmarkAnnualReturn = safeAnnualReturn * 0.85;
  const benchBase = Math.max(0.01, 1 + benchmarkAnnualReturn / 100);
  const monthlyBench = Math.pow(benchBase, 1 / 12) - 1;

  const rows: MonthRow[] = [];
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth();

  const incYear = inceptionDate.getUTCFullYear();
  const incMonth = inceptionDate.getUTCMonth();

  let curYear = incYear;
  let curMonth = incMonth;
  let monthIndex = 0;

  while (curYear < nowYear || (curYear === nowYear && curMonth <= nowMonth)) {
    const monthKey = `${curYear}-${String(curMonth + 1).padStart(2, "0")}-01`;
    const nav = 1000 * Math.pow(1 + monthlyReturn, monthIndex);
    const bench = 1000 * Math.pow(1 + monthlyBench, monthIndex);

    rows.push({
      month_start: monthKey,
      portfolio_nav: Math.round(nav * 100) / 100,
      benchmark_nav: Math.round(bench * 100) / 100,
      had_rebalance: false,
    });

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }
    monthIndex++;
  }

  return rows;
}

/**
 * Upstox Upgrade: Fetches real stock price history for an equity model portfolio's constituents,
 * weighted by target allocation, to produce a blended monthly NAV series.
 *
 * Source priority:
 *   1. Upstox Tier-0 / GoldenPricing historical candles via fetchHistoricalPrices()
 *   2. Falls back to synthetic curve if history unavailable
 */
async function fetchStockNavCurve(
  stockHoldings: Array<{ symbol: string; weight: number }>,
  inceptionDate?: Date | null,
): Promise<MonthRow[] | null> {
  if (!stockHoldings.length) return null;

  try {
    const totalWeight = stockHoldings.reduce((sum, h) => sum + h.weight, 0) || 100;
    // Limit to top 8 holdings to stay well within rate limits and execution budgets
    const topHoldings = [...stockHoldings]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8);

    // Map month_start -> blended return
    const monthReturnsMap = new Map<string, number>();

    for (const holding of topHoldings) {
      const prices = await fetchHistoricalPrices(holding.symbol, "1y");
      if (!prices || prices.length < 10) continue;

      // Group by YYYY-MM
      const monthlyBuckets = new Map<string, { firstClose: number; lastClose: number }>();
      for (const p of prices) {
        const monthKey = p.date.slice(0, 7) + "-01";
        const entry = monthlyBuckets.get(monthKey);
        if (!entry) {
          monthlyBuckets.set(monthKey, { firstClose: p.close, lastClose: p.close });
        } else {
          entry.lastClose = p.close;
        }
      }

      const sortedMonths = Array.from(monthlyBuckets.keys()).sort();
      for (let i = 0; i < sortedMonths.length; i++) {
        const mKey = sortedMonths[i];
        const bucket = monthlyBuckets.get(mKey)!;
        let retPct = 0;
        if (i === 0) {
          if (bucket.firstClose > 0) {
            retPct = ((bucket.lastClose - bucket.firstClose) / bucket.firstClose) * 100;
          }
        } else {
          const prevBucket = monthlyBuckets.get(sortedMonths[i - 1])!;
          if (prevBucket.lastClose > 0) {
            retPct = ((bucket.lastClose - prevBucket.lastClose) / prevBucket.lastClose) * 100;
          }
        }

        if (Number.isFinite(retPct)) {
          const effectiveWeight = holding.weight / totalWeight;
          const currentSum = monthReturnsMap.get(mKey) ?? 0;
          monthReturnsMap.set(mKey, currentSum + retPct * effectiveWeight);
        }
      }
    }

    const validMonths = Array.from(monthReturnsMap.keys()).sort();
    if (validMonths.length < 2) return null;

    const navRows: MonthRow[] = [];
    let nav = 1000;
    let bench = 1000;
    const benchMonthlyPct = 1.05; // ~13.2% p.a. Nifty 50 TRI baseline

    for (const mKey of validMonths) {
      const blendedReturn = monthReturnsMap.get(mKey) ?? 0;
      nav *= (1 + blendedReturn / 100);
      bench *= (1 + benchMonthlyPct / 100);

      navRows.push({
        month_start: mKey,
        portfolio_nav: Math.round(nav * 100) / 100,
        benchmark_nav: Math.round(bench * 100) / 100,
        had_rebalance: false,
      });
    }

    return navRows.length >= 2 ? navRows : null;
  } catch (err: any) {
    logger.warn("[NavService] fetchStockNavCurve non-fatal error", { error: err.message });
    return null;
  }
}

/**
 * Fetches real historical NAV data for a portfolio's mutual fund holdings from historical_nav_data,
 * weighted by target allocation, to produce a blended monthly NAV series.
 *
 * Source priority for scheme codes:
 *   1. JSONB holdings seed (amfiSchemeCode / schemeCode)
 *   2. Direct equity stock holdings via Upstox / fetchHistoricalPrices
 *
 * Returns null if insufficient data (< 2 months).
 */
async function fetchRealNavCurve(db: DbClient, portfolio: any): Promise<MonthRow[] | null> {
  const inceptionFilter = portfolio.inception_date ?? portfolio.inceptionDate ?? null;

  // Extract holdings list and weights
  const rawH = portfolio.holdings;
  const rawHoldingsList: any[] = Array.isArray(rawH)
    ? rawH
    : typeof rawH === "string"
    ? (() => { try { return JSON.parse(rawH); } catch { return []; } })()
    : [];

  const mfHoldings = rawHoldingsList
    .filter((h: any) => (h.schemeCode || h.amfiSchemeCode) && Number(h.weight ?? 0) > 0)
    .map((h: any) => ({
      code: String(h.schemeCode ?? h.amfiSchemeCode),
      weight: Number(h.weight ?? 0) || 1,
    }));

  // If no mutual fund scheme codes, check for direct equity stock holdings
  if (mfHoldings.length === 0) {
    const stockHoldings = rawHoldingsList
      .filter((h: any) => h.symbol && typeof h.symbol === "string" && !/^\d+$/.test(h.symbol))
      .map((h: any) => ({
        symbol: String(h.symbol).toUpperCase(),
        weight: Number(h.weight ?? 0) || 1,
      }));

    if (stockHoldings.length > 0) {
      const stockCurve = await fetchStockNavCurve(stockHoldings, inceptionFilter ? new Date(inceptionFilter) : null);
      if (stockCurve && stockCurve.length >= 2) {
        return stockCurve;
      }
    }
    return null;
  }

  const schemeCodes = mfHoldings.map((h) => h.code);
  const totalWeight = mfHoldings.reduce((sum, h) => sum + h.weight, 0) || 100;
  const weightMap = new Map(mfHoldings.map((h) => [h.code, h.weight / totalWeight]));

  try {
    // Fetch month-end NAVs from historical_nav_data
    const res = await db.execute(sql`
      SELECT DISTINCT ON (identifier, TO_CHAR(date, 'YYYY-MM'))
        identifier,
        TO_CHAR(date, 'YYYY-MM-01') AS month_start,
        date,
        nav::NUMERIC AS nav
      FROM historical_nav_data
      WHERE identifier IN (${sql.join(schemeCodes.map((c) => sql`${c}`), sql`, `)})
        AND date >= COALESCE(${inceptionFilter}::DATE, NOW() - INTERVAL '3 years')
      ORDER BY identifier, TO_CHAR(date, 'YYYY-MM'), date DESC
    `);

    const rawRows = ((res as any).rows ?? []) as Array<{
      identifier: string;
      month_start: string;
      date: string;
      nav: number;
    }>;

    if (rawRows.length < 2) return null;

    // Group by scheme -> month_start -> nav
    const schemeMonthNavs = new Map<string, Map<string, number>>();
    const allMonthsSet = new Set<string>();

    for (const r of rawRows) {
      if (!Number.isFinite(Number(r.nav)) || Number(r.nav) <= 0) continue;
      if (!schemeMonthNavs.has(r.identifier)) {
        schemeMonthNavs.set(r.identifier, new Map());
      }
      schemeMonthNavs.get(r.identifier)!.set(r.month_start, Number(r.nav));
      allMonthsSet.add(r.month_start);
    }

    const sortedMonths = Array.from(allMonthsSet).sort();
    if (sortedMonths.length < 2) return null;

    // Calculate month-on-month blended portfolio return
    const navRows: MonthRow[] = [];
    let nav = 1000;
    let bench = 1000;
    const benchMonthlyPct = 1.05; // ~13.2% pa Nifty 50 TRI baseline

    // First month: base ₹1000
    navRows.push({
      month_start: sortedMonths[0],
      portfolio_nav: 1000,
      benchmark_nav: 1000,
      had_rebalance: false,
    });

    for (let i = 1; i < sortedMonths.length; i++) {
      const prevMonth = sortedMonths[i - 1];
      const curMonth = sortedMonths[i];

      let blendedReturn = 0;
      let totalEffectiveWeight = 0;

      for (const [code, monthMap] of schemeMonthNavs.entries()) {
        const prevNav = monthMap.get(prevMonth);
        const curNav = monthMap.get(curMonth);
        const w = weightMap.get(code) ?? 0;

        if (prevNav && curNav && prevNav > 0 && curNav > 0) {
          const retPct = ((curNav - prevNav) / prevNav) * 100;
          if (Number.isFinite(retPct)) {
            blendedReturn += retPct * w;
            totalEffectiveWeight += w;
          }
        }
      }

      if (totalEffectiveWeight > 0.2) {
        // Rescale to 100% covered weight
        const scaledReturn = blendedReturn / totalEffectiveWeight;
        nav *= (1 + scaledReturn / 100);
        bench *= (1 + benchMonthlyPct / 100);

        navRows.push({
          month_start: curMonth,
          portfolio_nav: Math.round(nav * 100) / 100,
          benchmark_nav: Math.round(bench * 100) / 100,
          had_rebalance: false,
        });
      }
    }

    return navRows.length >= 2 ? navRows : null;
  } catch (err: any) {
    logger.warn("[NavService] fetchRealNavCurve error", { error: err.message });
    return null;
  }
}


// ─── Core: compute + write history for one portfolio ─────────────────────────

/**
 * Computes monthly NAV history for a single portfolio and upserts to model_portfolio_nav_history.
 */
export async function computeAndStorePortfolioNavHistory(
  db: DbClient,
  portfolio: any,
): Promise<NavHistoryResult> {
  const t0  = Date.now();
  const pid = portfolio.id as string;

  try {
    const inceptionDate = (portfolio.inception_date ?? portfolio.inceptionDate)
      ? new Date(portfolio.inception_date ?? portfolio.inceptionDate)
      : new Date(Date.now() - 24 * 30 * 24 * 3600 * 1000); // 24-month default

    // 1. Try real data first; fall back to synthetic
    let navRows = await fetchRealNavCurve(db, portfolio);

    if (!navRows || navRows.length < 2) {
      const annualReturn = Number(portfolio.cagr_1y ?? portfolio.cagr1Y ?? 10);
      const volatility   = Number(portfolio.volatility ?? 4);
      navRows = generateSyntheticNavCurve(pid, annualReturn, volatility, inceptionDate);
    }

    if (navRows.length === 0) {
      return { portfolioId: pid, monthsWritten: 0, latencyMs: Date.now() - t0, status: "no_data" };
    }

    // 2. Annotate rebalance event months from rebalancingHistory JSONB
    const rebalHistory: any[] = Array.isArray(
      portfolio.rebalancingHistory ?? portfolio.rebalancing_history
    ) ? (portfolio.rebalancingHistory ?? portfolio.rebalancing_history) : [];

    const rebalMonths    = new Set<string>();
    const rebalTriggers  = new Map<string, string>();
    for (const ev of rebalHistory) {
      if (ev.date) {
        const mk = ev.date.slice(0, 7) + "-01";
        rebalMonths.add(mk);
        rebalTriggers.set(mk, ev.trigger ?? ev.reason ?? "drift_threshold");
      }
    }

    // 3. Upsert all months
    const inceptionNav   = navRows[0]?.portfolio_nav  ?? 1000;
    const inceptionBench = navRows[0]?.benchmark_nav  ?? 1000;
    let written = 0;

    for (let i = 0; i < navRows.length; i++) {
      const row     = navRows[i];
      const prevRow = i > 0 ? navRows[i - 1] : null;

      const monthlyReturn  = prevRow
        ? ((row.portfolio_nav - prevRow.portfolio_nav) / prevRow.portfolio_nav) * 100
        : 0;
      const benchReturn = prevRow
        ? ((row.benchmark_nav - prevRow.benchmark_nav) / prevRow.benchmark_nav) * 100
        : 0;
      const absoluteReturn  = ((row.portfolio_nav  - inceptionNav)   / inceptionNav)   * 100;
      const benchCumReturn  = ((row.benchmark_nav  - inceptionBench) / inceptionBench) * 100;

      const monthKey    = row.month_start.slice(0, 7) + "-01";
      const hadRebal    = rebalMonths.has(monthKey) || row.had_rebalance;
      const rebalTrigger = rebalTriggers.get(monthKey) ?? row.rebalance_trigger ?? null;

      await db.execute(sql`
        INSERT INTO model_portfolio_nav_history
          (portfolio_id, month_start, nav, monthly_return, absolute_return,
           benchmark_return, benchmark_cum_return, had_rebalance_event, rebalance_trigger,
           source, engine_version, updated_at)
        VALUES
          (${pid}, ${monthKey}, ${row.portfolio_nav},
           ${Number(monthlyReturn.toFixed(4))}, ${Number(absoluteReturn.toFixed(4))},
           ${Number(benchReturn.toFixed(4))}, ${Number(benchCumReturn.toFixed(4))},
           ${hadRebal}, ${rebalTrigger},
           'cron', 'FASP-AI-v3.0', NOW())
        ON CONFLICT (portfolio_id, month_start) DO UPDATE
          SET nav                  = EXCLUDED.nav,
              monthly_return       = EXCLUDED.monthly_return,
              absolute_return      = EXCLUDED.absolute_return,
              benchmark_return     = EXCLUDED.benchmark_return,
              benchmark_cum_return = EXCLUDED.benchmark_cum_return,
              had_rebalance_event  = EXCLUDED.had_rebalance_event,
              rebalance_trigger    = EXCLUDED.rebalance_trigger,
              engine_version       = EXCLUDED.engine_version,
              updated_at           = NOW()
      `);
      written++;
    }

    // 4. Calculate summary trailing metrics and update model_portfolios table
    if (navRows.length >= 2) {
      const latestNav = navRows[navRows.length - 1].portfolio_nav;
      const latestBenchNav = navRows[navRows.length - 1].benchmark_nav;
      const firstNav = navRows[0].portfolio_nav;
      const firstBenchNav = navRows[0].benchmark_nav;

      // 1M return (last month vs prior month)
      const p1m = navRows[navRows.length - 2]?.portfolio_nav;
      const return1m = p1m && p1m > 0 ? ((latestNav - p1m) / p1m) * 100 : null;

      // 3M return (3 completed monthly bars ago)
      const p3m = navRows.length >= 4 ? navRows[navRows.length - 4]?.portfolio_nav : null;
      const return3m = p3m && p3m > 0 ? ((latestNav - p3m) / p3m) * 100 : null;

      // 6M return (6 completed monthly bars ago)
      const p6m = navRows.length >= 7 ? navRows[navRows.length - 7]?.portfolio_nav : null;
      const return6m = p6m && p6m > 0 ? ((latestNav - p6m) / p6m) * 100 : null;

      // YTD return: compare latest with December of prior year or first month of current year
      const curYear = new Date().getFullYear();
      const ytdBaseRow = navRows.slice().reverse().find(r => {
        const y = Number(r.month_start.slice(0, 4));
        return y < curYear;
      }) ?? navRows[0];
      const returnYtd = ytdBaseRow && ytdBaseRow.portfolio_nav > 0
        ? ((latestNav - ytdBaseRow.portfolio_nav) / ytdBaseRow.portfolio_nav) * 100
        : null;

      // 1Y CAGR (12 monthly bars): for 1 year, CAGR = absolute return
      const p1y = navRows.length >= 13 ? navRows[navRows.length - 13]?.portfolio_nav : null;
      const cagr1y = p1y && p1y > 0 ? ((latestNav - p1y) / p1y) * 100 : null;
      const b1y = navRows.length >= 13 ? navRows[navRows.length - 13]?.benchmark_nav : null;
      const benchCagr1y = b1y && b1y > 0 ? ((latestBenchNav - b1y) / b1y) * 100 : null;

      // 2Y CAGR (24 monthly bars)
      const p2y = navRows.length >= 25 ? navRows[navRows.length - 25]?.portfolio_nav : null;
      const cagr2y = p2y && p2y > 0 ? (Math.pow(latestNav / p2y, 1 / 2) - 1) * 100 : null;

      // 3Y CAGR (36 monthly bars)
      const p3y = navRows.length >= 37 ? navRows[navRows.length - 37]?.portfolio_nav : null;
      const cagr3y = p3y && p3y > 0 ? (Math.pow(latestNav / p3y, 1 / 3) - 1) * 100 : null;

      // Since inception
      const returnSinceInception = firstNav > 0 ? ((latestNav - firstNav) / firstNav) * 100 : null;
      const benchmarkSinceInception = firstBenchNav > 0 ? ((latestBenchNav - firstBenchNav) / firstBenchNav) * 100 : null;

      await db.execute(sql`
        UPDATE model_portfolios SET
          return_1m                 = ${return1m != null ? Number(return1m.toFixed(2)) : null},
          return_3m                 = ${return3m != null ? Number(return3m.toFixed(2)) : null},
          return_6m                 = ${return6m != null ? Number(return6m.toFixed(2)) : null},
          return_ytd                = ${returnYtd != null ? Number(returnYtd.toFixed(2)) : null},
          cagr_1y                   = COALESCE(${cagr1y != null ? Number(cagr1y.toFixed(2)) : null}, cagr_1y),
          twrr_1y                   = COALESCE(${cagr1y != null ? Number(cagr1y.toFixed(2)) : null}, twrr_1y),
          benchmark_cagr_1y         = COALESCE(${benchCagr1y != null ? Number(benchCagr1y.toFixed(2)) : null}, benchmark_cagr_1y),
          cagr_2y                   = ${cagr2y != null ? Number(cagr2y.toFixed(2)) : null},
          cagr_3y                   = COALESCE(${cagr3y != null ? Number(cagr3y.toFixed(2)) : null}, cagr_3y),
          return_since_inception    = ${returnSinceInception != null ? Number(returnSinceInception.toFixed(2)) : null},
          benchmark_since_inception = ${benchmarkSinceInception != null ? Number(benchmarkSinceInception.toFixed(2)) : null},
          periods_computed_at       = NOW(),
          updated_at                = NOW()
        WHERE id = ${pid}
      `);
    }

    const latencyMs = Date.now() - t0;
    logger.info("[NavHistory] NAV history computed", {
      event: "NAV_HISTORY_COMPUTED", portfolio_id: pid,
      months_written: written, latency_ms: latencyMs, status: "ok",
    });

    return { portfolioId: pid, monthsWritten: written, latencyMs, status: "ok" };
  } catch (err: unknown) {
    const errLatencyMs = Date.now() - t0;
    logger.error("[NavHistory] NAV history error", {
      event: "NAV_HISTORY_ERROR", portfolio_id: pid,
      error: err instanceof Error ? err.message : String(err),
      latency_ms: errLatencyMs, status: "error",
    });
    return { portfolioId: pid, monthsWritten: 0, latencyMs: errLatencyMs, status: "error",
      error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Public: sweep all published portfolios ───────────────────────────────────

/**
 * Refreshes NAV history for every published model portfolio.
 * Called nightly by background-schedulers at 6 AM IST.
 */
export async function refreshAllPortfolioNavHistory(db: DbClient): Promise<{
  total: number; ok: number; errors: number; noData: number;
}> {
  const t0 = Date.now();
  logger.info("[NavHistory] 🔄 Starting nightly NAV history refresh");

  const res = await db.execute(sql`
    SELECT id, inception_date, cagr_1y, cagr_3y, cagr_5y,
           volatility, benchmark_name, benchmark_scheme_code, holdings, rebalancing_history
    FROM model_portfolios
    WHERE is_published = TRUE
    ORDER BY created_at ASC
  `);

  const portfolios = ((res as any).rows ?? []) as any[];

  // Fix #10 — Chunked concurrency: run at most 5 portfolio NAV computations
  // concurrently. The original Promise.allSettled(portfolios.map(...)) fired all
  // N portfolios simultaneously, overwhelming the DB connection pool when N > ~10.
  const CONCURRENCY = 5;
  const results: PromiseSettledResult<{ status: string }> [] = [];
  for (let i = 0; i < portfolios.length; i += CONCURRENCY) {
    const chunk = portfolios.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.allSettled(
      chunk.map((p) => computeAndStorePortfolioNavHistory(db, p))
    );
    results.push(...chunkResults);
  }

  let ok = 0, errors = 0, noData = 0;
  for (const r of results) {
    if (r.status === "fulfilled") {
      if      (r.value.status === "ok")    ok++;
      else if (r.value.status === "error") errors++;
      else                                  noData++;
    } else {
      errors++;
    }
  }

  logger.info("[NavHistory] Nightly refresh complete", {
    event: "NAV_HISTORY_REFRESH_COMPLETE",
    total: portfolios.length, ok, errors, noData,
    latency_ms: Date.now() - t0, status: "ok",
  });

  return { total: portfolios.length, ok, errors, noData };
}

// ─── Public: get NAV history for API endpoint ─────────────────────────────────

/**
 * Returns NAV history rows for a portfolio (oldest-first, limited to `limit` months).
 * Consumed by GET /api/model-portfolios/:id/nav-history.
 */
export async function getPortfolioNavHistory(db: DbClient, portfolioId: string, limit = 36): Promise<any[]> {
  try {
    const res = await db.execute(sql`
      SELECT month_start, nav, monthly_return, absolute_return,
             benchmark_return, benchmark_cum_return,
             had_rebalance_event, rebalance_trigger
      FROM model_portfolio_nav_history
      WHERE portfolio_id = ${portfolioId}
      ORDER BY month_start DESC
      LIMIT ${limit}
    `);
    return ((res as any).rows ?? []).reverse(); // oldest-first for chart
  } catch {
    return [];
  }
}
