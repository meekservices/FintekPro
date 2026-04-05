/**
 * Python Analytics Service Routes
 *
 * Proxies /api/python/* to the Python micro-service when PYTHON_SERVICE_URL is set.
 * All routes require authentication. Role-based access enforced per-endpoint.
 *
 * Quant endpoints:
 *   GET  /api/python/health
 *   GET  /api/python/analytics/portfolio-summary[?user_id=X]
 *   GET  /api/python/analytics/capital-gains[?user_id=X&financial_year=2025-26]
 *   GET  /api/python/analytics/amc-breakdown[?agent_id=X]
 *   POST /api/python/quant/xirr          body: [{date, amount}]
 *   GET  /api/python/quant/portfolio-xirr[?user_id=X]
 *   GET  /api/python/quant/rolling-returns?scheme_code=...&periods=1W,1M,3M,6M,1Y,3Y,5Y,10Y
 *   POST /api/python/quant/mvo           body: {assets, config, transition}
 *   POST /api/python/quant/black-litterman body: {mvoResult, views, config}
 *   POST /api/python/quant/backtest      body: {weights, monthlyReturns, benchmarkWeights}
 *   POST /api/python/quant/drift-predict body: {driftMetrics, toleranceBandPct}
 *
 * MF Analytics endpoints (py-mf-analytics-v2):
 *   POST /api/python/mf/compute-metrics    body: {schemeCode, navHistory, benchmarkHistory?}
 *   GET  /api/python/mf/scheme-analytics  ?scheme_code=...
 *   POST /api/python/mf/monthly-series    body: {schemes: [{schemeCode, navHistory}]}
 *   POST /api/python/mf/bulk-compute-db   body: {limit?, minDays?, fiscalYear?} (admin/agent)
 *   POST /api/python/mf/cross-sectional-rank body: {fiscalYear?}  → fills category_rank/percentile_rank
 *   POST /api/python/mf/risk-from-monthly  body: {fiscalYear?, minMonths?} → fills VaR/CVaR/semi-dev
 *   POST /api/python/mf/sync-change-pct    body: {}  → fills mutual_funds.change_percent
 *   POST /api/python/mf/derived-metrics    body: {fiscalYear?} → fills Treynor, Jensen alpha
 *   POST /api/python/mf/nav-backfill       body: {limit?, offset?, minRows?} → historical_nav_data → mf_nav_history
 *   POST /api/python/mf/amfi-enrich        body: {} → fills scheme_sub_category, amc_name, launch_date, change_percent
 *   POST /api/python/mf/monthly-pipeline   body: {fiscalYear?, minDays?, minMonths?, limit?} → full chain
 *
 * Forecasting endpoints (py-return-forecast-v1 / py-sip-v1):
 *   POST /api/python/forecasting/return-forecast  body: {assetType, currentValue, annualReturn, ...}
 *   POST /api/python/forecasting/sip-simulate     body: {sipAmount, horizonMonths, expectedReturn, ...}
 *
 * Portfolio Operations endpoints (py-overlap-v1 / py-rebalance-v1):
 *   POST /api/python/portfolio/overlap-analysis  body: {funds:[{isin, weight, holdings}], candidateFund?}
 *   POST /api/python/portfolio/rebalance         body: {currentAllocations, targetAllocations, totalValue, ...}
 */
import { Router } from 'express';
import { proxyToPython, isPythonServiceConfigured, getPythonHealthState, getPythonBaseUrl } from '../clients/python-client';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/api/python/health', async (req, res) => {
  const state = getPythonHealthState();
  if (!isPythonServiceConfigured()) {
    return res.json({
      status: 'not_configured',
      service: 'fintekpro-python',
      message: 'Set PYTHON_SERVICE_URL to enable the Python analytics service.',
      deploy_path: 'services/python/',
      lastSuccessAt: state.lastSuccessAt,
      consecutiveFailures: state.consecutiveFailures,
      latencyMs: null,
    });
  }
  // Probe the Python service directly so we can measure latency and
  // inject our own tracking fields without mutating res.json.
  const start = Date.now();
  try {
    const upstreamRes = await fetch(`${getPythonBaseUrl()}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    const latencyMs = Date.now() - start;
    const body = await upstreamRes.json().catch(() => ({}));
    const fresh = getPythonHealthState();
    return res.json({
      status: upstreamRes.ok ? (body.status ?? 'ok') : 'degraded',
      ...body,
      latencyMs,
      lastSuccessAt: fresh.lastSuccessAt,
      consecutiveFailures: fresh.consecutiveFailures,
    });
  } catch {
    const latencyMs = Date.now() - start;
    const fresh = getPythonHealthState();
    return res.json({
      status: 'unreachable',
      latencyMs,
      lastSuccessAt: fresh.lastSuccessAt,
      consecutiveFailures: fresh.consecutiveFailures,
    });
  }
});

// ── Analytics ────────────────────────────────────────────────────────────
router.get('/api/python/analytics/portfolio-summary', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/portfolio-summary', 'portfolio-summary');
});

router.get('/api/python/analytics/capital-gains', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/capital-gains', 'capital-gains');
});

router.get('/api/python/analytics/amc-breakdown', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/amc-breakdown', 'amc-breakdown');
});

// ── Quant ────────────────────────────────────────────────────────────────
router.post('/api/python/quant/xirr', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/xirr', 'xirr', { xirr: null, label: 'XIRR unavailable' });
});

router.get('/api/python/quant/portfolio-xirr', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/portfolio-xirr', 'portfolio-xirr', { xirr: null, label: 'Portfolio XIRR unavailable' });
});

router.get('/api/python/quant/rolling-returns', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/rolling-returns', 'rolling-returns', { rollingStats: [] });
});

router.post('/api/python/quant/mvo', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/mvo', 'mvo', { frontier: [], optimalWeights: [] });
});

router.post('/api/python/quant/black-litterman', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/black-litterman', 'black-litterman');
});

router.post('/api/python/quant/backtest', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/backtest', 'backtest');
});

router.post('/api/python/quant/drift-predict', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/drift-predict', 'drift-predict');
});

// ── MF Analytics (py-mf-analytics-v2) ───────────────────────────────────
router.post('/api/python/mf/compute-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/compute-metrics', 'mf-compute-metrics');
});

router.get('/api/python/mf/scheme-analytics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/scheme-analytics', 'mf-scheme-analytics');
});

router.post('/api/python/mf/monthly-series', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/monthly-series', 'mf-monthly-series');
});

router.post('/api/python/mf/bulk-compute-db', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/bulk-compute-db', 'mf-bulk-compute');
});

router.post('/api/python/mf/cross-sectional-rank', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/cross-sectional-rank', 'mf-cross-sectional-rank');
});

router.post('/api/python/mf/risk-from-monthly', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/risk-from-monthly', 'mf-risk-from-monthly');
});

router.post('/api/python/mf/sync-change-pct', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/sync-change-pct', 'mf-sync-change-pct');
});

router.post('/api/python/mf/derived-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/derived-metrics', 'mf-derived-metrics');
});

router.post('/api/python/mf/nav-backfill', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/nav-backfill', 'mf-nav-backfill');
});

router.post('/api/python/mf/amfi-enrich', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/amfi-enrich', 'mf-amfi-enrich');
});

router.post('/api/python/mf/monthly-pipeline', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/monthly-pipeline', 'mf-monthly-pipeline');
});

// ── Forecasting (py-return-forecast-v1 / py-sip-v1) ─────────────────────
router.post('/api/python/forecasting/return-forecast', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/forecasting/return-forecast', 'return-forecast', {
    baseCase: null,
    bearCase: null,
    bullCase: null,
    timeSeries: [],
    label: 'Forecast unavailable — using simple compound return estimate',
  });
});

router.post('/api/python/forecasting/sip-simulate', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/forecasting/sip-simulate', 'sip-simulate', {
    totalInvested: null,
    finalValue: null,
    inflationAdjustedValue: null,
    projection: [],
    label: 'SIP simulation unavailable',
  });
});

// ── Portfolio Operations (py-overlap-v1 / py-rebalance-v1) ───────────────
router.post('/api/python/portfolio/overlap-analysis', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/portfolio/overlap-analysis', 'portfolio-overlap', {
    overlapScore: null,
    commonHoldings: [],
    label: 'Overlap analysis unavailable',
  });
});

router.post('/api/python/portfolio/rebalance', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/portfolio/rebalance', 'portfolio-rebalance');
});

// ── Asset Allocation Optimizer (py-mvo-v2) ───────────────────────────────────
router.post('/api/python/quant/asset-allocation', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/asset-allocation', 'asset-allocation');
});

// ── Batch Financial Metrics (py-metrics-v1) ──────────────────────────────────
router.post('/api/python/analytics/batch-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/batch-metrics', 'batch-metrics');
});

// ── Fixed Income & Corporate Treasury (py-bond-v1 / py-treasury-v1) ─────────
router.post('/api/python/fixed-income/bond-analytics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/fixed-income/bond-analytics', 'bond-analytics');
});

router.post('/api/python/fixed-income/batch-bond-analytics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/fixed-income/batch-bond-analytics', 'batch-bond-analytics');
});

router.post('/api/python/fixed-income/yield-curve', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/fixed-income/yield-curve', 'yield-curve');
});

router.post('/api/python/fixed-income/treasury-optimize', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/fixed-income/treasury-optimize', 'treasury-optimize');
});

// ── Factor Models (py-factor-v1) ─────────────────────────────────────────────
router.post('/api/python/factor/fund-factors', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/factor/fund-factors', 'fund-factors');
});

router.post('/api/python/factor/batch-fund-factors', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/factor/batch-fund-factors', 'batch-fund-factors');
});

router.get('/api/python/factor/market-factors', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/factor/market-factors', 'market-factors');
});

// ── ML Scoring Engine (py-sklearn-v1) ────────────────────────────────────────
router.post('/api/python/ml/train', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/ml/train', 'ml-train');
});

router.post('/api/python/ml/score', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/ml/score', 'ml-score');
});

router.get('/api/python/ml/model-info', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/ml/model-info', 'ml-model-info');
});

router.post('/api/python/ml/cross-validate', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/ml/cross-validate', 'ml-cross-validate');
});

// ── Regime Detection (py-regime-v2) ──────────────────────────────────────────
router.post('/api/python/regime/detect', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/regime/detect', 'regime-detect');
});

router.get('/api/python/regime/history', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/regime/history', 'regime-history');
});

router.post('/api/python/regime/detect-batch', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/regime/detect-batch', 'regime-detect-batch');
});

// ── Point-to-Point Price Returns (golden_prices time-series → Pandas) ─────────
//
//  POST /api/python/price-returns/compute       → compute one ISIN
//  POST /api/python/price-returns/batch         → compute many ISINs
//  POST /api/python/price-returns/daily-run     → run all (background)
//  GET  /api/python/price-returns/:isin         → read stored returns
//  GET  /api/python/price-returns/:isin/history → return history
//
// Corporate Actions:
//  POST /api/python/corporate-actions/sync
//  GET  /api/python/corporate-actions/pending
//  POST /api/python/corporate-actions/apply-adjustments
//  GET  /api/python/corporate-actions/list
//  GET  /api/python/corporate-actions/history/:isin
//
router.post('/api/python/price-returns/compute', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/price-returns/compute', 'price-returns-compute');
});

router.post('/api/python/price-returns/batch', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/price-returns/batch', 'price-returns-batch');
});

router.post('/api/python/price-returns/daily-run', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/price-returns/daily-run', 'price-returns-daily-run');
});

router.get('/api/python/price-returns/:isin/history', requireAuth, async (req, res) => {
  return proxyToPython(req, res, `/api/price-returns/${req.params.isin}/history`, 'price-returns-history');
});

router.get('/api/python/price-returns/:isin', requireAuth, async (req, res) => {
  return proxyToPython(req, res, `/api/price-returns/${req.params.isin}`, 'price-returns');
});

// ── Corporate Actions ────────────────────────────────────────────────────────
router.post('/api/python/corporate-actions/sync', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/corporate-actions/sync', 'corporate-actions-sync');
});

router.get('/api/python/corporate-actions/pending', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/corporate-actions/pending', 'corporate-actions-pending');
});

router.post('/api/python/corporate-actions/apply-adjustments', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/corporate-actions/apply-adjustments', 'corporate-actions-adjustments');
});

router.get('/api/python/corporate-actions/list', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/corporate-actions/list', 'corporate-actions-list');
});

router.get('/api/python/corporate-actions/history/:isin', requireAuth, async (req, res) => {
  return proxyToPython(req, res, `/api/corporate-actions/history/${req.params.isin}`, 'corporate-actions-history');
});

// ── Data Lake ─────────────────────────────────────────────────────────────
router.post('/api/python/data-lake/store-bhavcopy', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/data-lake/store-bhavcopy', 'data-lake-bhavcopy');
});

router.post('/api/python/data-lake/store-amfi-nav', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/data-lake/store-amfi-nav', 'data-lake-amfi-nav');
});

router.get('/api/python/data-lake/list', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/data-lake/list', 'data-lake-list');
});

router.get('/api/python/data-lake/retrieve', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/data-lake/retrieve', 'data-lake-retrieve');
});

export default router;
