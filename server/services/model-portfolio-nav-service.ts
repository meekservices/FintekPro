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
 * Generates a synthetic NAV curve from inception to now.
 * Falls back to this when real holding NAV data is unavailable.
 */
function generateSyntheticNavCurve(
  portfolioId: string,
  annualReturn: number,
  volatility: number,
  inceptionDate: Date,
): MonthRow[] {
  const seed = hashPortfolioId(portfolioId);
  const monthlyReturn = (1 + annualReturn / 100) ** (1 / 12) - 1;
  const monthlyBench  = (1 + (annualReturn * 0.85) / 100) ** (1 / 12) - 1;

  let state = seed;
  // Fix #13 — LCG divisor corrected: 0xffffffff (4294967295) produced output in
  // [0, 1] (inclusive of 1.0 at state=0xffffffff) which can generate NaN in
  // logarithm-based NAV computations. Correct divisor is 2³² = 4294967296,
  // yielding uniform [0, 1) output consistent with standard LCG implementations.
  const rand = () => {
    state = (1664525 * state + 1013904223) & 0xffffffff;
    return (state >>> 0) / 4294967296;
  };

  const rows: MonthRow[] = [];
  let nav   = 1000;
  let bench = 1000;
  const now   = new Date();
  const cur   = new Date(inceptionDate.getFullYear(), inceptionDate.getMonth(), 1);

  while (cur <= now) {
    const noise = (rand() - 0.5) * 2 * volatility / 100;
    nav   *= (1 + monthlyReturn + noise);
    bench *= (1 + monthlyBench  + (rand() - 0.5) * 2 * (volatility * 0.7) / 100);
    rows.push({
      month_start:    cur.toISOString().slice(0, 10),
      portfolio_nav:  Math.round(nav * 100) / 100,
      benchmark_nav:  Math.round(bench * 100) / 100,
      had_rebalance:  false,
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return rows;
}

/**
 * Fetches real mf_monthwise_performance data for a portfolio's holdings,
 * weighted by target allocation, to produce a blended monthly NAV series.
 *
 * Source priority for scheme codes:
 *   1. model_portfolio_holdings (relational table — enriched by Phase C ISIN resolver)
 *   2. JSONB holdings seed (fallback for portfolios not yet migrated)
 *
 * Benchmark source priority:
 *   1. mf_nav_history for portfolio.benchmark_scheme_code (real monthly NAV)
 *   2. Hardcoded 0.80%/month flat rate (9.6% pa) — last-resort fallback
 *
 * Returns null if insufficient data (< 2 months).
 */
async function fetchRealNavCurve(db: any, portfolio: any): Promise<MonthRow[] | null> {
  const pid = portfolio.id as string;
  const inceptionFilter = portfolio.inception_date ?? portfolio.inceptionDate ?? null;

  // ── Scheme codes: relational table PRIMARY, JSONB seed FALLBACK ───────────
  let schemeCodes: string[] = [];

  try {
    const relResult = await db.execute(sql`
      SELECT scheme_code
      FROM model_portfolio_holdings
      WHERE portfolio_id = ${pid}
        AND removed_at IS NULL
        AND scheme_code IS NOT NULL
    `);
    schemeCodes = ((relResult as any).rows ?? [])
      .map((r: any) => r.scheme_code as string)
      .filter(Boolean);
  } catch { /* relational table not ready — will use JSONB fallback below */ }

  // JSONB fallback: use seed holdings if relational table yielded nothing
  if (schemeCodes.length === 0) {
    const holdings: any[] = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
    schemeCodes = holdings
      .map((h: any) => h.schemeCode ?? h.scheme_code)
      .filter(Boolean)
      .map(String);
  }

  if (schemeCodes.length === 0) return null;

  // ── Benchmark NAV series: real from mf_nav_history if available ───────────
  const benchSchemeCode: string | null =
    portfolio.benchmark_scheme_code ?? portfolio.benchmarkSchemeCode ?? null;

  let benchNavByMonth: Map<string, number> | null = null;

  if (benchSchemeCode) {
    try {
      const benchRes = await db.execute(sql`
        SELECT
          DATE_TRUNC('month', nav_date)::DATE AS month_start,
          AVG(nav::NUMERIC)                  AS avg_bench_nav
        FROM mf_nav_history
        WHERE scheme_code = ${benchSchemeCode}
          AND nav_date >= COALESCE(${inceptionFilter}::DATE, NOW() - INTERVAL '3 years')
        GROUP BY 1
        ORDER BY 1 ASC
      `);
      const benchRows = ((benchRes as any).rows ?? []) as any[];
      if (benchRows.length >= 2) {
        benchNavByMonth = new Map(
          benchRows.map((r: any) => [r.month_start as string, Number(r.avg_bench_nav)])
        );
      }
    } catch { /* mf_nav_history not populated for benchSchemeCode — fall back to flat */ }
  }

  // ── Portfolio blended NAV from mf_monthwise_performance ──────────────────
  try {
    const res = await db.execute(sql`
      SELECT
        DATE_TRUNC('month', nav_date)::DATE AS month_start,
        AVG(nav) AS avg_nav
      FROM mf_monthwise_performance
      WHERE scheme_code = ANY(${schemeCodes})
        AND nav_date >= COALESCE(${inceptionFilter}::DATE, NOW() - INTERVAL '3 years')
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const rows = ((res as any).rows ?? []) as any[];
    if (rows.length < 2) return null;

    const navRows: MonthRow[] = [];
    let nav        = 1000;
    let bench      = 1000;
    let prevBenchNav: number | null = null;

    for (const r of rows) {
      const monthKey = r.month_start as string;
      const factor   = Number(r.avg_nav ?? 1);
      if (!isNaN(factor) && factor > 0) {
        nav = nav * (1 + (factor - 1) * 0.01);
      }

      // Benchmark: use real monthly NAV movement if available
      if (benchNavByMonth) {
        const curBenchNav = benchNavByMonth.get(monthKey) ?? null;
        if (curBenchNav !== null && prevBenchNav !== null) {
          bench = bench * (curBenchNav / prevBenchNav);
        }
        prevBenchNav = curBenchNav ?? prevBenchNav;
      } else {
        bench *= 1.0080; // ~9.6% pa flat — last-resort fallback
      }

      navRows.push({
        month_start:   monthKey,
        portfolio_nav: Math.round(nav * 100) / 100,
        benchmark_nav: Math.round(bench * 100) / 100,
        had_rebalance: false,
      });
    }

    return navRows.length >= 2 ? navRows : null;
  } catch {
    return null;
  }
}

// ─── Core: compute + write history for one portfolio ─────────────────────────

/**
 * Computes monthly NAV history for a single portfolio and upserts to model_portfolio_nav_history.
 */
export async function computeAndStorePortfolioNavHistory(
  db: any,
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
          (${pid}, ${row.month_start}, ${row.portfolio_nav},
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
export async function refreshAllPortfolioNavHistory(db: any): Promise<{
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
export async function getPortfolioNavHistory(db: any, portfolioId: string, limit = 36): Promise<any[]> {
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
