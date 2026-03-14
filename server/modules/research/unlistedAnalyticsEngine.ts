/**
 * Unlisted Company Analytics Engine
 * 
 * Computes financial ratios and valuation models for unlisted companies:
 *   1. Ratio Engine – ROE, ROCE, D/E, OPM, NPM, current ratio, etc.
 *   2. EV/EBITDA   – based on last-transaction or admin price × total shares
 *   3. DCF Model   – 5-year FCF projection, 15% WACC, 4% terminal growth
 *   4. Revenue Multiple – sector-based EV/Revenue applied to latest revenue
 *   5. Blended Valuation Range – low/mid/high per share value
 *   6. Investment Thesis & Risk Bullets
 */

import type { CredhiveFinancialStatement, CredhiveComplianceData } from '../../services/credhive-service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnlistedRatios {
  roe: number | null;
  roce: number | null;
  roa: number | null;
  debtToEquity: number | null;
  debtToAssets: number | null;
  interestCoverage: number | null;
  currentRatio: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  ebitdaMargin: number | null;
  assetTurnover: number | null;
  revenueGrowth: number | null;    // YoY %
  patGrowth: number | null;        // YoY %
  revenueCagr3Y: number | null;
  patCagr3Y: number | null;
}

export interface EBITDAValuation {
  ebitda: number;
  sectorMultiple: number;
  enterpriseValue: number;
  debt: number;
  cash: number;
  equityValue: number;
  perShareValue: number | null;
  totalShares: number | null;
}

export interface DCFValuation {
  baseFCF: number;
  projectedGrowthRate: number;
  wacc: number;
  terminalGrowth: number;
  pvFCF: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  debt: number;
  cash: number;
  equityValue: number;
  perShareValue: number | null;
  totalShares: number | null;
}

export interface RevenueMultipleValuation {
  revenue: number;
  sectorMultiple: number;
  enterpriseValue: number;
  debt: number;
  cash: number;
  equityValue: number;
  perShareValue: number | null;
  totalShares: number | null;
}

export interface ValuationRange {
  low: number | null;
  mid: number | null;
  high: number | null;
  currentTransactionPrice: number | null;
  upside: number | null;        // % upside vs current transaction price
  evEbitda: EBITDAValuation | null;
  dcf: DCFValuation | null;
  revenueMultiple: RevenueMultipleValuation | null;
  method: string;
}

export interface UnlistedAnalyticsResult {
  ratios: UnlistedRatios;
  valuation: ValuationRange;
  thesis: string[];
  risks: string[];
  ratingScore: number;
  ratingLabel: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL' | 'REVIEW';
  fhs: number;   // Financial Health Score 0–100
}

// ─── Sector EV/Revenue multiples (India unlisted benchmarks) ─────────────────

const SECTOR_EV_REVENUE: Record<string, number> = {
  'Technology': 4.0,
  'IT Services': 3.5,
  'Financial Services': 3.0,
  'NBFC': 2.5,
  'Healthcare': 3.5,
  'Pharma': 3.0,
  'Consumer': 2.5,
  'FMCG': 2.8,
  'Manufacturing': 1.5,
  'Auto': 1.2,
  'Infrastructure': 1.8,
  'Real Estate': 1.5,
  'Energy': 1.8,
  'Renewable Energy': 3.5,
  'E-Commerce': 3.0,
  'Logistics': 2.0,
  'Agri': 1.0,
  'Education': 4.0,
  'Media': 2.0,
  'Telecom': 2.5,
  'default': 2.0,
};

const SECTOR_EV_EBITDA: Record<string, number> = {
  'Technology': 20,
  'IT Services': 18,
  'Financial Services': 15,
  'NBFC': 12,
  'Healthcare': 18,
  'Pharma': 16,
  'Consumer': 14,
  'FMCG': 18,
  'Manufacturing': 10,
  'Auto': 8,
  'Infrastructure': 12,
  'Real Estate': 10,
  'Energy': 10,
  'Renewable Energy': 20,
  'E-Commerce': 25,
  'Logistics': 12,
  'Agri': 8,
  'Education': 18,
  'Media': 10,
  'Telecom': 12,
  'default': 12,
};

// ─── Helper math ─────────────────────────────────────────────────────────────

function n(v: number | undefined | null): number | null {
  if (v === null || v === undefined) return null;
  return isFinite(v) ? v : null;
}

function safeDivide(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  const r = a / b;
  return isFinite(r) ? r : null;
}

function cagr(end: number, start: number, years: number): number | null {
  if (!start || start <= 0 || !end || years <= 0) return null;
  const r = Math.pow(end / start, 1 / years) - 1;
  return isFinite(r) ? r : null;
}

function pvAnnuity(cashFlows: number[], wacc: number): number {
  return cashFlows.reduce((sum, cf, i) => sum + cf / Math.pow(1 + wacc, i + 1), 0);
}

function getSectorMultipleRevenue(sector: string | null | undefined): number {
  if (!sector) return SECTOR_EV_REVENUE['default'];
  const key = Object.keys(SECTOR_EV_REVENUE).find(k => sector.toLowerCase().includes(k.toLowerCase()));
  return key ? SECTOR_EV_REVENUE[key] : SECTOR_EV_REVENUE['default'];
}

function getSectorMultipleEbitda(sector: string | null | undefined): number {
  if (!sector) return SECTOR_EV_EBITDA['default'];
  const key = Object.keys(SECTOR_EV_EBITDA).find(k => sector.toLowerCase().includes(k.toLowerCase()));
  return key ? SECTOR_EV_EBITDA[key] : SECTOR_EV_EBITDA['default'];
}

// ─── Ratio Engine ─────────────────────────────────────────────────────────────

export function computeRatios(
  statements: CredhiveFinancialStatement[],
): UnlistedRatios {
  // Sort by financial year descending
  const sorted = [...statements].sort((a, b) => (b.financial_year || '').localeCompare(a.financial_year || ''));
  const latest = sorted[0];
  const prev   = sorted[1];
  const three  = sorted[2];

  if (!latest) {
    return {
      roe: null, roce: null, roa: null,
      debtToEquity: null, debtToAssets: null, interestCoverage: null, currentRatio: null,
      operatingMargin: null, netMargin: null, ebitdaMargin: null, assetTurnover: null,
      revenueGrowth: null, patGrowth: null, revenueCagr3Y: null, patCagr3Y: null,
    };
  }

  const revenue  = n(latest.revenue);
  const ebitda   = n(latest.ebitda);
  const pat      = n(latest.pat ?? latest.net_profit);
  const networth = n(latest.networth);
  const assets   = n(latest.total_assets);
  const debt     = n(latest.total_debt);
  const ebit     = n(latest.ebit) ?? (ebitda !== null && revenue !== null ? ebitda * 0.9 : null);

  const roe  = safeDivide(pat, networth);
  const roa  = safeDivide(pat, assets);
  const roce = safeDivide(ebit, assets !== null && debt !== null ? assets - (n(latest.total_liabilities) ?? 0) + debt : assets);

  const debtToEquity  = safeDivide(debt, networth);
  const debtToAssets  = safeDivide(debt, assets);
  // Approximate interest = EBITDA - EBIT; if EBITDA and EBIT both present use the ratio
  const interestEst   = ebitda !== null && ebit !== null ? ebitda - ebit : null;
  const interestCoverage = ebit !== null && interestEst !== null && interestEst > 0
    ? safeDivide(ebit, interestEst)
    : null;

  const operatingMargin = safeDivide(ebit, revenue);
  const netMargin       = safeDivide(pat, revenue);
  const ebitdaMargin    = safeDivide(ebitda, revenue);
  const assetTurnover   = safeDivide(revenue, assets);

  // YoY Growth
  const prevRevenue = n(prev?.revenue);
  const prevPat     = n(prev?.pat ?? prev?.net_profit);
  const revenueGrowth = safeDivide((revenue ?? 0) - (prevRevenue ?? 0), prevRevenue);
  const patGrowth     = safeDivide((pat ?? 0) - (prevPat ?? 0), Math.abs(prevPat ?? 1));

  // 3-Year CAGR
  const threeRevenue = n(three?.revenue);
  const threePat     = n(three?.pat ?? three?.net_profit);
  const revenueCagr3Y = revenue !== null && threeRevenue !== null ? cagr(revenue, threeRevenue, 2) : null;
  const patCagr3Y     = pat !== null && threePat !== null && threePat > 0 ? cagr(pat, threePat, 2) : null;

  return {
    roe, roce, roa,
    debtToEquity, debtToAssets, interestCoverage,
    currentRatio: null,   // requires current assets/liabilities not always available
    operatingMargin, netMargin, ebitdaMargin, assetTurnover,
    revenueGrowth, patGrowth, revenueCagr3Y, patCagr3Y,
  };
}

// ─── EV/EBITDA Valuation ──────────────────────────────────────────────────────

export function computeEVEbitda(
  statements: CredhiveFinancialStatement[],
  totalShares: number | null,
  transactionPrice: number | null,
  sector: string | null | undefined,
): EBITDAValuation | null {
  const sorted = [...statements].sort((a, b) => (b.financial_year || '').localeCompare(a.financial_year || ''));
  const latest = sorted[0];
  if (!latest) return null;

  const ebitda = n(latest.ebitda);
  if (!ebitda || ebitda <= 0) return null;

  const debt = n(latest.total_debt) ?? 0;
  const cash = n(latest.cash_and_equivalents) ?? 0;
  const sectorMultiple = getSectorMultipleEbitda(sector);

  const enterpriseValue = ebitda * sectorMultiple;
  const equityValue = enterpriseValue - debt + cash;
  const perShareValue = totalShares && totalShares > 0 ? equityValue / totalShares : null;

  return {
    ebitda,
    sectorMultiple,
    enterpriseValue,
    debt,
    cash,
    equityValue,
    perShareValue,
    totalShares,
  };
}

// ─── DCF Valuation ────────────────────────────────────────────────────────────

export function computeDCF(
  statements: CredhiveFinancialStatement[],
  totalShares: number | null,
  sector: string | null | undefined,
): DCFValuation | null {
  const sorted = [...statements].sort((a, b) => (b.financial_year || '').localeCompare(a.financial_year || ''));
  const latest = sorted[0];
  if (!latest) return null;

  // Base FCF: use direct FCF or compute from operating CF - capex
  let baseFCF = n(latest.free_cash_flow);
  if (baseFCF === null) {
    const ocf   = n(latest.operating_cash_flow);
    const capex = n(latest.capex) ?? (n(latest.revenue) ? (n(latest.revenue)! * 0.05) : null);
    if (ocf !== null && capex !== null) baseFCF = ocf - capex;
  }
  if (baseFCF === null || baseFCF <= 0) return null;

  // Estimate growth rate from revenue CAGR or use 15% default
  const ratios = computeRatios(statements);
  const rawGrowth = ratios.revenueCagr3Y ?? 0.15;
  const projectedGrowthRate = Math.min(Math.max(rawGrowth, 0.05), 0.40); // cap 5%–40%

  const wacc = 0.15;            // 15% for unlisted high-risk
  const terminalGrowth = 0.04;  // 4% terminal

  // Project 5-year FCFs
  const fcfs: number[] = [];
  let fcf = baseFCF;
  for (let i = 0; i < 5; i++) {
    fcf = fcf * (1 + projectedGrowthRate);
    fcfs.push(fcf);
  }

  const pvFCF = pvAnnuity(fcfs, wacc);
  const terminalFCF = fcfs[4] * (1 + terminalGrowth);
  const terminalValue = terminalFCF / (wacc - terminalGrowth);
  const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);

  const debt = n(latest.total_debt) ?? 0;
  const cash = n(latest.cash_and_equivalents) ?? 0;
  const enterpriseValue = pvFCF + pvTerminalValue;
  const equityValue = enterpriseValue - debt + cash;
  const perShareValue = totalShares && totalShares > 0 ? equityValue / totalShares : null;

  return {
    baseFCF,
    projectedGrowthRate,
    wacc,
    terminalGrowth,
    pvFCF,
    pvTerminalValue,
    enterpriseValue,
    debt,
    cash,
    equityValue,
    perShareValue,
    totalShares,
  };
}

// ─── Revenue Multiple Valuation ───────────────────────────────────────────────

export function computeRevenueMultiple(
  statements: CredhiveFinancialStatement[],
  totalShares: number | null,
  sector: string | null | undefined,
): RevenueMultipleValuation | null {
  const sorted = [...statements].sort((a, b) => (b.financial_year || '').localeCompare(a.financial_year || ''));
  const latest = sorted[0];
  if (!latest) return null;

  const revenue = n(latest.revenue);
  if (!revenue || revenue <= 0) return null;

  const sectorMultiple = getSectorMultipleRevenue(sector);
  const debt = n(latest.total_debt) ?? 0;
  const cash = n(latest.cash_and_equivalents) ?? 0;

  const enterpriseValue = revenue * sectorMultiple;
  const equityValue = enterpriseValue - debt + cash;
  const perShareValue = totalShares && totalShares > 0 ? equityValue / totalShares : null;

  return {
    revenue,
    sectorMultiple,
    enterpriseValue,
    debt,
    cash,
    equityValue,
    perShareValue,
    totalShares,
  };
}

// ─── Blended Valuation Range ──────────────────────────────────────────────────

export function computeValuationRange(
  statements: CredhiveFinancialStatement[],
  totalShares: number | null,
  transactionPrice: number | null,   // last admin published price or deal price
  sector: string | null | undefined,
): ValuationRange {
  const evEbitda      = computeEVEbitda(statements, totalShares, transactionPrice, sector);
  const dcf           = computeDCF(statements, totalShares, sector);
  const revenueMultiple = computeRevenueMultiple(statements, totalShares, sector);

  const values = [
    evEbitda?.perShareValue,
    dcf?.perShareValue,
    revenueMultiple?.perShareValue,
  ].filter((v): v is number => v !== null && v !== undefined && v > 0);

  let low: number | null  = null;
  let mid: number | null  = null;
  let high: number | null = null;

  if (values.length > 0) {
    low  = Math.min(...values) * 0.80;
    high = Math.max(...values) * 1.20;
    mid  = values.reduce((a, b) => a + b, 0) / values.length;
  }

  const upside = mid !== null && transactionPrice && transactionPrice > 0
    ? (mid - transactionPrice) / transactionPrice
    : null;

  const methodParts: string[] = [];
  if (evEbitda) methodParts.push('EV/EBITDA');
  if (dcf) methodParts.push('DCF');
  if (revenueMultiple) methodParts.push('Revenue Multiple');

  return {
    low,
    mid,
    high,
    currentTransactionPrice: transactionPrice,
    upside,
    evEbitda,
    dcf,
    revenueMultiple,
    method: methodParts.length > 0 ? methodParts.join(' + ') : 'Insufficient Data',
  };
}

// ─── Financial Health Score ───────────────────────────────────────────────────

export function computeFHS(ratios: UnlistedRatios): number {
  let score = 50;

  // ROE component (35%)
  if (ratios.roe !== null) {
    if (ratios.roe > 0.20)       score += 35 * 1.0;
    else if (ratios.roe > 0.12)  score += 35 * 0.6;
    else if (ratios.roe > 0.05)  score += 35 * 0.3;
    else if (ratios.roe < 0)     score -= 20;
  }

  // Revenue growth (30%)
  if (ratios.revenueGrowth !== null) {
    if (ratios.revenueGrowth > 0.25)     score += 30 * 1.0;
    else if (ratios.revenueGrowth > 0.10) score += 30 * 0.6;
    else if (ratios.revenueGrowth > 0)   score += 30 * 0.3;
    else if (ratios.revenueGrowth < -0.10) score -= 15;
  }

  // Leverage (35%) — lower is better for unlisted
  if (ratios.debtToEquity !== null) {
    if (ratios.debtToEquity < 0.5)      score += 35 * 1.0;
    else if (ratios.debtToEquity < 1.0) score += 35 * 0.6;
    else if (ratios.debtToEquity < 2.0) score += 35 * 0.2;
    else score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

// ─── Thesis & Risk Bullets ───────────────────────────────────────────────────

export function generateUnlistedThesis(
  companyName: string,
  ratios: UnlistedRatios,
  valuation: ValuationRange,
  compliance: CredhiveComplianceData | null,
  sector: string | null | undefined,
): string[] {
  const bullets: string[] = [];

  if (ratios.roe !== null && ratios.roe > 0.15) {
    bullets.push(`Strong return on equity of ${(ratios.roe * 100).toFixed(1)}%, indicating efficient capital allocation`);
  }
  if (ratios.revenueGrowth !== null && ratios.revenueGrowth > 0.15) {
    bullets.push(`Revenue growing at ${(ratios.revenueGrowth * 100).toFixed(1)}% YoY, well above industry average`);
  }
  if (ratios.revenueCagr3Y !== null && ratios.revenueCagr3Y > 0.12) {
    bullets.push(`3-year revenue CAGR of ${(ratios.revenueCagr3Y * 100).toFixed(1)}% demonstrates consistent business momentum`);
  }
  if (ratios.ebitdaMargin !== null && ratios.ebitdaMargin > 0.18) {
    bullets.push(`Healthy EBITDA margin of ${(ratios.ebitdaMargin * 100).toFixed(1)}% shows strong operating efficiency`);
  }
  if (ratios.debtToEquity !== null && ratios.debtToEquity < 0.5) {
    bullets.push(`Conservative balance sheet with D/E of ${ratios.debtToEquity.toFixed(2)}x — well-positioned for growth capex`);
  }
  if (valuation.upside !== null && valuation.upside > 0.20) {
    bullets.push(`Blended intrinsic value (${valuation.method}) suggests ${(valuation.upside * 100).toFixed(0)}% upside from current transaction price`);
  }
  if (sector) {
    bullets.push(`Exposure to the ${sector} sector offers differentiated diversification beyond listed equities`);
  }
  if (bullets.length < 3) {
    bullets.push(`${companyName} operates as a privately held entity, potentially positioned ahead of a future listing`);
    bullets.push(`Unlisted status may offer entry at a discount to comparable listed peers`);
  }

  return bullets.slice(0, 6);
}

export function generateUnlistedRisks(
  ratios: UnlistedRatios,
  valuation: ValuationRange,
  compliance: CredhiveComplianceData | null,
): string[] {
  const risks: string[] = [];

  risks.push('Liquidity risk: unlisted shares have no active secondary market; exit depends on Offer For Sale (OFS), buyback, or listing event');
  risks.push('Limited public disclosure: financials are MCA-filings based — may lag by 12–18 months; real-time data unavailable');

  if (ratios.debtToEquity !== null && ratios.debtToEquity > 1.5) {
    risks.push(`Elevated leverage (D/E ${ratios.debtToEquity.toFixed(2)}x) increases refinancing risk in a rising interest rate environment`);
  }
  if (ratios.revenueGrowth !== null && ratios.revenueGrowth < 0) {
    risks.push(`Revenue declined ${(Math.abs(ratios.revenueGrowth) * 100).toFixed(1)}% YoY — business contraction or cyclical headwind`);
  }
  if (ratios.netMargin !== null && ratios.netMargin < 0) {
    risks.push('Company is loss-making; path to profitability and cash flow generation needs monitoring');
  }
  if (compliance) {
    if (compliance.overall_risk === 'high' || compliance.overall_risk === 'critical') {
      risks.push(`Elevated compliance risk (${compliance.overall_risk}): ${compliance.signals.slice(0, 2).map(s => s.description).join('; ')}`);
    }
    if (compliance.charges_count && compliance.charges_count > 2) {
      risks.push(`${compliance.charges_count} active charges registered against the company — review lender exposure`);
    }
  }
  if (valuation.upside !== null && valuation.upside < 0) {
    risks.push('Current transaction price appears to be above our blended intrinsic value estimate — downside risk to valuation');
  }

  risks.push('Regulatory risk: SEBI/RBI framework for unlisted securities trading may change; platform-specific compliance requirements apply');

  return risks.slice(0, 6);
}

// ─── Rating ───────────────────────────────────────────────────────────────────

export function computeUnlistedRating(
  ratios: UnlistedRatios,
  valuation: ValuationRange,
  fhs: number,
): { score: number; label: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL' | 'REVIEW' } {
  // Blend: 50% FHS, 30% valuation upside, 20% growth
  let score = fhs * 0.5;

  if (valuation.upside !== null) {
    const upsideScore = Math.min(100, Math.max(0, 50 + valuation.upside * 200));
    score += upsideScore * 0.3;
  } else {
    score += 50 * 0.3;
  }

  const growthScore = ratios.revenueGrowth !== null
    ? Math.min(100, Math.max(0, 50 + ratios.revenueGrowth * 200))
    : 50;
  score += growthScore * 0.2;

  const rounded = Math.round(score);

  let label: 'STRONG BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG SELL' | 'REVIEW';
  if (rounded >= 75)      label = 'STRONG BUY';
  else if (rounded >= 60) label = 'BUY';
  else if (rounded >= 45) label = 'HOLD';
  else if (rounded >= 30) label = 'SELL';
  else if (rounded >= 0)  label = 'STRONG SELL';
  else                    label = 'REVIEW';

  return { score: rounded, label };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function runUnlistedAnalytics(
  companyName: string,
  statements: CredhiveFinancialStatement[],
  totalShares: number | null,
  transactionPrice: number | null,
  sector: string | null | undefined,
  compliance: CredhiveComplianceData | null,
): UnlistedAnalyticsResult {
  const ratios    = computeRatios(statements);
  const valuation = computeValuationRange(statements, totalShares, transactionPrice, sector);
  const fhs       = computeFHS(ratios);
  const { score, label } = computeUnlistedRating(ratios, valuation, fhs);
  const thesis    = generateUnlistedThesis(companyName, ratios, valuation, compliance, sector);
  const risks     = generateUnlistedRisks(ratios, valuation, compliance);

  return { ratios, valuation, thesis, risks, ratingScore: score, ratingLabel: label, fhs };
}
