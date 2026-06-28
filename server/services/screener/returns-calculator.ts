/**
 * @file returns-calculator.ts
 * @description Computes all price-based return & risk metrics for the MoneyControl
 *              Performance tab from raw OHLCV stored in screener_price_history.
 *
 * Computes:
 *   Returns    : 1W, 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, YTD (trailing, price-based)
 *   Risk       : Beta (vs NIFTY 50), Sharpe Ratio, Sortino Ratio, Max Drawdown (1Y), Volatility (30D)
 *   Relative   : Alpha vs NIFTY 50 (1Y), Alpha vs sector index (1Y)
 *   Quality    : Piotroski F-Score (0-9), Altman Z-Score
 *
 * Design:
 *   - Returns are NEVER copied from any static source — always computed from price_history
 *   - Risk-free rate = 6.5% p.a. (RBI repo rate, June 2026)
 *   - All percentage returns stored as decimals (0.12 = 12%)
 *   - Recalculated nightly by the derived-metrics engine
 *
 * @inputs  Close price arrays (oldest first). benchmarkCloses = NIFTY 50 daily closes.
 */

export interface ReturnSeries {
  return1W: number | null;   // 5 trading days
  return1M: number | null;   // 21 trading days
  return3M: number | null;   // 63 trading days
  return6M: number | null;   // 126 trading days
  return1Y: number | null;   // 252 trading days
  return2Y: number | null;   // 504 trading days
  return3Y: number | null;   // 756 trading days
  return5Y: number | null;   // 1260 trading days
  returnYTD: number | null;  // Jan 1 of current year to today
}

export interface RiskMetrics {
  beta: number | null;
  sharpeRatio1Y: number | null;
  sortinoRatio1Y: number | null;
  maxDrawdown1Y: number | null;
  volatility30D: number | null;   // Annualised
  returnVsNifty1Y: number | null; // Alpha vs NIFTY 50
  returnVsSector1Y: number | null;
}

export interface PiotroskiResult {
  score: number;  // 0–9
  details: {
    // Profitability (4 signals)
    roa: 1 | 0;          // ROA > 0 this year
    ocf: 1 | 0;          // Operating Cash Flow > 0
    roaChange: 1 | 0;    // ROA improved vs last year
    accrual: 1 | 0;      // OCF > Net Income (quality of earnings)
    // Leverage (3 signals)
    debtChange: 1 | 0;   // Long-term debt ratio decreased
    currentRatioChange: 1 | 0; // Current ratio improved
    noNewShares: 1 | 0;  // No new shares issued (dilution)
    // Operating Efficiency (2 signals)
    grossMarginChange: 1 | 0; // Gross margin improved
    assetTurnoverChange: 1 | 0; // Asset turnover improved
  };
}

export interface AltmanZResult {
  score: number;
  zone: 'safe' | 'grey' | 'distress';  // >2.99=safe, 1.81-2.99=grey, <1.81=distress
}

const RISK_FREE_RATE = 0.065; // 6.5% p.a. (RBI repo, June 2026)
const TRADING_DAYS_PER_YEAR = 252;

// ─── Helper: compute period return from close array ──────────────────────────

/**
 * Computes trailing return over `tradingDays` from closes (oldest first).
 * Returns null if not enough data.
 */
function trailingReturn(closes: number[], tradingDays: number): number | null {
  if (closes.length < tradingDays + 1) return null;
  const endPrice = closes[closes.length - 1];
  const startPrice = closes[closes.length - 1 - tradingDays];
  if (startPrice <= 0) return null;
  return (endPrice - startPrice) / startPrice;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

// ─── Return Series ────────────────────────────────────────────────────────────

/**
 * Computes all return horizons from an array of daily close prices.
 * Closes must be sorted oldest→newest.
 * Handles YTD by finding Jan 1's closest trading day.
 *
 * @param closes  Daily close prices, oldest first
 * @param dates   Corresponding date strings 'YYYY-MM-DD', same length as closes
 */
export function computeReturnSeries(closes: number[], dates: string[]): ReturnSeries {
  const r = (days: number) => {
    const val = trailingReturn(closes, days);
    return val !== null ? round4(val) : null;
  };

  // YTD: find the last trading day of the previous year
  const ytdReturn = computeYTD(closes, dates);

  return {
    return1W: r(5),
    return1M: r(21),
    return3M: r(63),
    return6M: r(126),
    return1Y: r(252),
    return2Y: r(504),
    return3Y: r(756),
    return5Y: r(1260),
    returnYTD: ytdReturn,
  };
}

function computeYTD(closes: number[], dates: string[]): number | null {
  if (!dates.length) return null;
  const currentYear = new Date().getFullYear().toString();
  // Find the last date of the previous year in our data (ES2020 compatible)
  let prevYearEndIdx = -1;
  for (let i = dates.length - 1; i >= 0; i--) {
    if (dates[i].startsWith(`${parseInt(currentYear) - 1}`)) {
      prevYearEndIdx = i;
      break;
    }
  }
  if (prevYearEndIdx < 0 || prevYearEndIdx >= closes.length - 1) return null;
  const startPrice = closes[prevYearEndIdx];
  const endPrice = closes[closes.length - 1];
  if (startPrice <= 0) return null;
  return round4((endPrice - startPrice) / startPrice);
}

// ─── Daily Returns Array ──────────────────────────────────────────────────────

function dailyReturns(closes: number[]): number[] {
  return closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
}

// ─── Beta (vs benchmark) ─────────────────────────────────────────────────────

/**
 * Computes Beta of stock vs benchmark (e.g. NIFTY 50) using 1Y daily returns.
 * Beta = Cov(stock, bench) / Var(bench)
 */
export function computeBeta(
  stockCloses: number[],
  benchCloses: number[],
  period = 252,
): number | null {
  const sCloses = stockCloses.slice(-period - 1);
  const bCloses = benchCloses.slice(-period - 1);
  if (sCloses.length < 20 || bCloses.length < 20) return null;

  const len = Math.min(sCloses.length, bCloses.length);
  const sReturns = dailyReturns(sCloses.slice(-len));
  const bReturns = dailyReturns(bCloses.slice(-len));
  const minLen = Math.min(sReturns.length, bReturns.length);

  const sMean = sReturns.slice(0, minLen).reduce((a, b) => a + b, 0) / minLen;
  const bMean = bReturns.slice(0, minLen).reduce((a, b) => a + b, 0) / minLen;

  let cov = 0, bVar = 0;
  for (let i = 0; i < minLen; i++) {
    cov += (sReturns[i] - sMean) * (bReturns[i] - bMean);
    bVar += (bReturns[i] - bMean) ** 2;
  }
  if (bVar === 0) return null;
  return round4(cov / bVar);
}

// ─── Sharpe Ratio ─────────────────────────────────────────────────────────────

/**
 * Annualised Sharpe Ratio using 1Y daily returns.
 * Sharpe = (annualReturn - riskFreeRate) / (dailyVol * sqrt(252))
 */
export function computeSharpeRatio(closes: number[], riskFreeRate = RISK_FREE_RATE): number | null {
  const c = closes.slice(-253);
  if (c.length < 21) return null;
  const returns = dailyReturns(c);
  const annualReturn = (c[c.length - 1] - c[0]) / c[0];
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  const annualVol = Math.sqrt(variance * TRADING_DAYS_PER_YEAR);
  if (annualVol === 0) return null;
  return round4((annualReturn - riskFreeRate) / annualVol);
}

// ─── Sortino Ratio ────────────────────────────────────────────────────────────

/**
 * Sortino Ratio — like Sharpe but only penalises downside volatility.
 */
export function computeSortinoRatio(closes: number[], riskFreeRate = RISK_FREE_RATE): number | null {
  const c = closes.slice(-253);
  if (c.length < 21) return null;
  const returns = dailyReturns(c);
  const annualReturn = (c[c.length - 1] - c[0]) / c[0];
  const downsideReturns = returns.filter(r => r < 0);
  if (!downsideReturns.length) return null;
  const downsideVariance = downsideReturns.reduce((a, b) => a + b ** 2, 0) / downsideReturns.length;
  const downsideVol = Math.sqrt(downsideVariance * TRADING_DAYS_PER_YEAR);
  if (downsideVol === 0) return null;
  return round4((annualReturn - riskFreeRate) / downsideVol);
}

// ─── Max Drawdown ─────────────────────────────────────────────────────────────

/**
 * Maximum peak-to-trough drawdown over the last 1Y of closes.
 * Returns as a negative decimal (e.g. -0.28 = -28% drawdown).
 */
export function computeMaxDrawdown(closes: number[]): number | null {
  const c = closes.slice(-252);
  if (c.length < 2) return null;
  let peak = c[0];
  let maxDD = 0;
  for (const price of c) {
    if (price > peak) peak = price;
    const dd = (price - peak) / peak;
    if (dd < maxDD) maxDD = dd;
  }
  return round4(maxDD);
}

// ─── Volatility (30-day annualised) ──────────────────────────────────────────

export function computeVolatility30D(closes: number[]): number | null {
  const c = closes.slice(-31);
  if (c.length < 10) return null;
  const returns = dailyReturns(c);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return round4(Math.sqrt(variance * TRADING_DAYS_PER_YEAR));
}

// ─── All Risk Metrics combined ────────────────────────────────────────────────

export function computeRiskMetrics(
  stockCloses: number[],
  niftyCloses: number[],
  sectorCloses?: number[],
): RiskMetrics {
  const stockReturn1Y = trailingReturn(stockCloses, 252);
  const niftyReturn1Y = trailingReturn(niftyCloses, 252);
  const sectorReturn1Y = sectorCloses ? trailingReturn(sectorCloses, 252) : null;

  return {
    beta: computeBeta(stockCloses, niftyCloses),
    sharpeRatio1Y: computeSharpeRatio(stockCloses),
    sortinoRatio1Y: computeSortinoRatio(stockCloses),
    maxDrawdown1Y: computeMaxDrawdown(stockCloses),
    volatility30D: computeVolatility30D(stockCloses),
    returnVsNifty1Y: stockReturn1Y !== null && niftyReturn1Y !== null
      ? round4(stockReturn1Y - niftyReturn1Y)
      : null,
    returnVsSector1Y: stockReturn1Y !== null && sectorReturn1Y !== null
      ? round4(stockReturn1Y - sectorReturn1Y)
      : null,
  };
}

// ─── Piotroski F-Score (0-9) ──────────────────────────────────────────────────

/**
 * Piotroski F-Score: 9 binary signals across Profitability, Leverage, Efficiency.
 * Uses 2 years of annual financial data (current year vs prior year).
 *
 * @param curr  Current year financials
 * @param prev  Prior year financials
 */
export function computePiotroski(
  curr: {
    roa: number | null;          // Net Income / Total Assets
    operatingCashFlow: number | null;
    netIncome: number | null;
    totalDebt: number | null;
    totalAssets: number | null;
    currentRatio: number | null;
    grossMargin: number | null;
    revenue: number | null;
    shares?: number | null;      // Total shares outstanding
  },
  prev: {
    roa: number | null;
    totalDebt: number | null;
    totalAssets: number | null;
    currentRatio: number | null;
    grossMargin: number | null;
    revenue: number | null;
    shares?: number | null;
  },
): PiotroskiResult {
  const s = (condition: boolean): 1 | 0 => (condition ? 1 : 0);

  // Profitability
  const roa = s((curr.roa ?? 0) > 0);
  const ocf = s((curr.operatingCashFlow ?? 0) > 0);
  const roaChange = s(
    curr.roa !== null && prev.roa !== null && curr.roa > prev.roa,
  );
  const accrual = s(
    curr.operatingCashFlow !== null &&
    curr.netIncome !== null &&
    curr.totalAssets !== null &&
    curr.totalAssets > 0 &&
    curr.operatingCashFlow / curr.totalAssets > (curr.netIncome / curr.totalAssets),
  );

  // Leverage
  const currDebtRatio = curr.totalDebt !== null && curr.totalAssets !== null && curr.totalAssets > 0
    ? curr.totalDebt / curr.totalAssets : null;
  const prevDebtRatio = prev.totalDebt !== null && prev.totalAssets !== null && prev.totalAssets > 0
    ? prev.totalDebt / prev.totalAssets : null;
  const debtChange = s(currDebtRatio !== null && prevDebtRatio !== null && currDebtRatio < prevDebtRatio);
  const currentRatioChange = s(
    curr.currentRatio !== null && prev.currentRatio !== null && curr.currentRatio > prev.currentRatio,
  );
  const noNewShares = s(
    curr.shares == null || prev.shares == null || curr.shares <= prev.shares,
  );

  // Efficiency
  const currGrossMargin = curr.grossMargin;
  const prevGrossMargin = prev.grossMargin;
  const grossMarginChange = s(
    currGrossMargin !== null && prevGrossMargin !== null && currGrossMargin > prevGrossMargin,
  );
  const currAssetTurnover = curr.revenue !== null && curr.totalAssets !== null && curr.totalAssets > 0
    ? curr.revenue / curr.totalAssets : null;
  const prevAssetTurnover = prev.revenue !== null && prev.totalAssets !== null && prev.totalAssets > 0
    ? prev.revenue / prev.totalAssets : null;
  const assetTurnoverChange = s(
    currAssetTurnover !== null && prevAssetTurnover !== null && currAssetTurnover > prevAssetTurnover,
  );

  const total = roa + ocf + roaChange + accrual + debtChange + currentRatioChange + noNewShares +
    grossMarginChange + assetTurnoverChange;

  return {
    score: total,
    details: {
      roa, ocf, roaChange, accrual,
      debtChange, currentRatioChange, noNewShares,
      grossMarginChange, assetTurnoverChange,
    },
  };
}

// ─── Altman Z-Score ───────────────────────────────────────────────────────────

/**
 * Altman Z-Score (original 1968 model, adapted for Indian public companies).
 * Z = 1.2*X1 + 1.4*X2 + 3.3*X3 + 0.6*X4 + 1.0*X5
 *
 * X1 = Working Capital / Total Assets
 * X2 = Retained Earnings / Total Assets
 * X3 = EBIT / Total Assets
 * X4 = Market Cap / Total Liabilities
 * X5 = Revenue / Total Assets
 *
 * Score interpretation:
 *   > 2.99  → Safe Zone
 *   1.81–2.99 → Grey Zone (caution)
 *   < 1.81  → Distress Zone (potential bankruptcy risk)
 */
export function computeAltmanZ(data: {
  workingCapital: number | null;
  totalAssets: number | null;
  retainedEarnings: number | null;
  ebit: number | null;               // Operating income (EBIT)
  marketCap: number | null;
  totalLiabilities: number | null;
  revenue: number | null;
}): AltmanZResult | null {
  const { workingCapital, totalAssets, retainedEarnings, ebit, marketCap, totalLiabilities, revenue } = data;

  if (!totalAssets || totalAssets === 0) return null;

  const X1 = workingCapital !== null ? workingCapital / totalAssets : 0;
  const X2 = retainedEarnings !== null ? retainedEarnings / totalAssets : 0;
  const X3 = ebit !== null ? ebit / totalAssets : 0;
  const X4 = marketCap !== null && totalLiabilities !== null && totalLiabilities > 0
    ? marketCap / totalLiabilities : 0;
  const X5 = revenue !== null ? revenue / totalAssets : 0;

  const z = 1.2 * X1 + 1.4 * X2 + 3.3 * X3 + 0.6 * X4 + 1.0 * X5;
  const score = round4(z);

  let zone: 'safe' | 'grey' | 'distress';
  if (score > 2.99) zone = 'safe';
  else if (score >= 1.81) zone = 'grey';
  else zone = 'distress';

  return { score, zone };
}
