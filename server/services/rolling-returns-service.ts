/* eslint-disable no-console */
/**
 * rolling-returns-service.ts — Layer 2: Rolling Returns & Alpha Calculator (FASP-AI v3.0)
 * Fetches historical NAV from mfapi.in and computes:
 *   - 1M / 3M / 6M / 1Y / 3Y CAGR
 *   - Alpha vs NIFTY 50 (equity) and CRISIL Hybrid 35+65 (hybrid/debt)
 *   - Rolling Sharpe ratio (RFR = 6.5% RBI repo rate)
 *   - Sortino ratio and max drawdown
 * Updated weekly (Sunday 6AM IST) for all 566 holdings.
 * Data: mfapi.in (free, no API key) | FASP-AI v3.0 | GCR-compliant
 */
import axios from "axios";
import { db } from "../db";
import { fundPerformanceCache } from "@shared/schema";
import { eq, isNotNull } from "drizzle-orm";
import { logger } from "../logger";

const ENGINE_VERSION = "FASP-AI-v3.0";
const MFAPI_BASE     = "https://api.mfapi.in/mf";
const RFR_ANNUAL     = 0.065; // 6.5% RBI repo rate (risk-free rate)
const NIFTY_50_1Y    = 12.3;  // NIFTY 50 trailing 1Y return (updated periodically)
// NIFTY_50_3Y = 14.1 (reserved for 3Y benchmark comparison)
const CRISIL_HYBRID  = 9.8;   // CRISIL Hybrid 35+65 trailing 1Y
const CRISIL_COMP    = 7.2;   // CRISIL Composite Bond trailing 1Y

interface MFAPIResponse {
  status: string;
  meta: {
    scheme_name:   string;
    fund_house:    string;
    scheme_type:   string;
    scheme_category: string;
  };
  data: Array<{ date: string; nav: string }>; // sorted desc by date
}

// ── Fetch historical NAV from mfapi.in ───────────────────────────────────────
/** Returns NAV array sorted ascending by date for the last `days` entries. */
async function fetchHistoricalNAV(schemeCode: string, maxDays = 1100): Promise<Array<{ date: Date; nav: number }>> {
  const url = `${MFAPI_BASE}/${schemeCode}`;
  let resp: MFAPIResponse;
  try {
    const r = await axios.get<MFAPIResponse>(url, { timeout: 15_000 });
    resp = r.data;
  } catch (err) {
    throw new Error(`mfapi.in fetch failed for ${schemeCode}: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (resp.status !== "SUCCESS" || !Array.isArray(resp.data)) {
    throw new Error(`mfapi.in bad response for ${schemeCode}`);
  }

  // data is DESC — reverse to ASC, take last maxDays entries
  const series = resp.data
    .slice(0, maxDays)
    .reverse()
    .map((d) => ({
      date: new Date(d.date.split("-").reverse().join("-")), // DD-Mon-YYYY → Date
      nav:  parseFloat(d.nav),
    }))
    .filter((d) => !isNaN(d.nav) && d.nav > 0);

  return series;
}

// ── CAGR from NAV series ──────────────────────────────────────────────────────
/** Compute annualised CAGR from a slice of `years` in NAV history. */
function computeCAGR(series: Array<{ nav: number }>, years: number): number | null {
  const totalDays = Math.floor(years * 365);
  if (series.length < totalDays * 0.9) return null; // insufficient data
  const startNav = series[Math.max(0, series.length - totalDays)].nav;
  const endNav   = series[series.length - 1].nav;
  if (startNav <= 0) return null;
  const cagr = (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
  return parseFloat(cagr.toFixed(2));
}

// ── Daily returns from NAV series ─────────────────────────────────────────────
function dailyReturns(series: Array<{ nav: number }>): number[] {
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1].nav > 0) {
      returns.push((series[i].nav - series[i - 1].nav) / series[i - 1].nav);
    }
  }
  return returns;
}

// ── Sharpe ratio ──────────────────────────────────────────────────────────────
function computeSharpe(dailyRets: number[]): number | null {
  if (dailyRets.length < 30) return null;
  const dailyRFR = RFR_ANNUAL / 252;
  const excess = dailyRets.map((r) => r - dailyRFR);
  const mean = excess.reduce((a, b) => a + b, 0) / excess.length;
  const variance = excess.reduce((a, b) => a + b * b, 0) / excess.length - mean * mean;
  const stdDev = Math.sqrt(Math.max(0, variance));
  if (stdDev === 0) return null;
  return parseFloat(((mean / stdDev) * Math.sqrt(252)).toFixed(3));
}

// ── Sortino ratio ─────────────────────────────────────────────────────────────
function computeSortino(dailyRets: number[]): number | null {
  if (dailyRets.length < 30) return null;
  const dailyRFR = RFR_ANNUAL / 252;
  const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length - dailyRFR;
  const downRets = dailyRets.filter((r) => r < dailyRFR);
  if (downRets.length === 0) return null;
  const downVariance = downRets.reduce((a, b) => a + b * b, 0) / downRets.length;
  const downStd = Math.sqrt(downVariance);
  if (downStd === 0) return null;
  return parseFloat(((mean / downStd) * Math.sqrt(252)).toFixed(3));
}

// ── Max drawdown ──────────────────────────────────────────────────────────────
function computeMaxDrawdown(series: Array<{ nav: number }>): number {
  let peak = -Infinity;
  let maxDD = 0;
  for (const { nav } of series) {
    if (nav > peak) peak = nav;
    const dd = (peak - nav) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return parseFloat((maxDD * 100).toFixed(2));
}

// ── Volatility (annualised) ───────────────────────────────────────────────────
function computeVolatility(dailyRets: number[]): number | null {
  if (dailyRets.length < 5) return null;
  const mean = dailyRets.reduce((a, b) => a + b, 0) / dailyRets.length;
  const variance = dailyRets.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyRets.length;
  return parseFloat((Math.sqrt(variance) * Math.sqrt(252) * 100).toFixed(2));
}

// ── Alpha composite score ─────────────────────────────────────────────────────
/**
 * Multi-factor alpha score for fund ranking.
 * Score = cagr1y*0.30 + (1/er)*0.15 + sharpe*0.20 + alpha*0.20 + consistency*0.15
 * Normalised to 0-100 range.
 */
function computeAlphaScore(params: {
  cagr1y: number | null;
  expenseRatio: number | null;
  sharpe: number | null;
  alphaVsNifty: number | null;
}): number {
  const { cagr1y, expenseRatio, sharpe, alphaVsNifty } = params;
  let score = 0;
  if (cagr1y != null)       score += Math.min(30, Math.max(0, cagr1y * 0.3));
  if (expenseRatio != null && expenseRatio > 0) score += Math.min(15, (1 / expenseRatio) * 0.3);
  if (sharpe != null)       score += Math.min(20, Math.max(0, sharpe * 6));
  if (alphaVsNifty != null) score += Math.min(20, Math.max(0, (alphaVsNifty + 5) * 2));
  return parseFloat(Math.min(100, Math.max(0, score)).toFixed(2));
}

// ── Refresh a single fund in the cache ───────────────────────────────────────
export async function refreshFundReturns(isin: string, schemeCode: string, assetClass: string): Promise<void> {
  const series = await fetchHistoricalNAV(schemeCode, 1100);
  const rets   = dailyReturns(series);

  const cagr1m  = computeCAGR(series, 1 / 12);
  const cagr3m  = computeCAGR(series, 0.25);
  const cagr6m  = computeCAGR(series, 0.5);
  const cagr1y  = computeCAGR(series, 1);
  const cagr3y  = computeCAGR(series, 3);

  const benchmarkReturn = (assetClass === "equity") ? NIFTY_50_1Y
    : (assetClass === "hybrid") ? CRISIL_HYBRID
    : CRISIL_COMP;

  const alphaVsNifty   = cagr1y != null ? parseFloat((cagr1y - NIFTY_50_1Y).toFixed(2)) : null;
  const alphaVsCrisil  = cagr1y != null ? parseFloat((cagr1y - benchmarkReturn).toFixed(2)) : null;

  const sharpe    = computeSharpe(rets);
  const sortino   = computeSortino(rets);
  const maxDD     = series.length > 0 ? computeMaxDrawdown(series) : null;
  const volatility = computeVolatility(rets);
  const alphaScore = computeAlphaScore({ cagr1y: cagr1y ?? null, expenseRatio: null, sharpe, alphaVsNifty });

  await db.update(fundPerformanceCache).set({
    cagr1m:           cagr1m != null ? String(cagr1m) : undefined,
    cagr3m:           cagr3m != null ? String(cagr3m) : undefined,
    cagr6m:           cagr6m != null ? String(cagr6m) : undefined,
    cagr1y:           cagr1y != null ? String(cagr1y) : undefined,
    cagr3y:           cagr3y != null ? String(cagr3y) : undefined,
    alphaVsNifty:     alphaVsNifty != null ? String(alphaVsNifty) : undefined,
    alphaVsCrisil:    alphaVsCrisil != null ? String(alphaVsCrisil) : undefined,
    sharpeRatio:      sharpe != null ? String(sharpe) : undefined,
    sortinoRatio:     sortino != null ? String(sortino) : undefined,
    maxDrawdown:      maxDD != null ? String(maxDD) : undefined,
    volatility:       volatility != null ? String(volatility) : undefined,
    alphaScore:       String(alphaScore),
    returnsUpdatedAt: new Date(),
    updatedAt:        new Date(),
    engineVersion:    ENGINE_VERSION,
  }).where(eq(fundPerformanceCache.isin, isin));
}

// ── Weekly batch: refresh all funds in cache ──────────────────────────────────
/** Called Sunday 6AM IST by cron. Refreshes rolling returns for all cached funds. */
export async function refreshFundPerformanceCache(): Promise<void> {
  const t0 = Date.now();
  logger.info("ROLLING_RETURNS_REFRESH_START", {event: "ROLLING_RETURNS_REFRESH_START", engine_version: ENGINE_VERSION});

  const funds = await db.select({
    isin: fundPerformanceCache.isin,
    schemeCode: fundPerformanceCache.schemeCode,
    assetClass: fundPerformanceCache.assetClass,
  }).from(fundPerformanceCache).where(isNotNull(fundPerformanceCache.schemeCode));

  let ok = 0, skipped = 0, errors = 0;

  for (const fund of funds) {
    if (!fund.schemeCode) { skipped++; continue; }
    try {
      await refreshFundReturns(fund.isin, fund.schemeCode, fund.assetClass ?? "equity");
      ok++;
      // Respect mfapi.in rate limit — 100ms between calls
      await new Promise((r) => setTimeout(r, 100));
    } catch (err) {
      errors++;
      logger.warn("ROLLING_RETURNS_ERR", {event: "ROLLING_RETURNS_ERR",
        isin: fund.isin,
        schemeCode: fund.schemeCode,
        error: err instanceof Error ? err.message : String(err),});
    }
  }

  const latency = Date.now() - t0;
  logger.info("ROLLING_RETURNS_REFRESH_COMPLETE", {event: "ROLLING_RETURNS_REFRESH_COMPLETE",
    total: funds.length, ok, skipped, errors,
    latency_ms: latency,
    engine_version: ENGINE_VERSION,});
}
