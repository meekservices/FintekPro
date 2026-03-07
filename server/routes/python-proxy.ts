/**
 * Python Analytics Service Routes
 *
 * Proxies /api/python/* to the Python micro-service when PYTHON_SERVICE_URL is set.
 * All routes require authentication. Role-based access enforced per-endpoint.
 *
 * Available endpoints (once Python service is deployed):
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
 * MF Analytics endpoints (py-mf-analytics-v1):
 *   POST /api/python/mf/compute-metrics    body: {schemeCode, navHistory, benchmarkHistory?}
 *   GET  /api/python/mf/scheme-analytics  ?scheme_code=...
 *   POST /api/python/mf/monthly-series    body: {schemes: [{schemeCode, navHistory}]}
 *   POST /api/python/mf/bulk-compute-db   body: {limit?, minDays?, fiscalYear?} (admin/agent)
 *   POST /api/python/mf/cross-sectional-rank body: {fiscalYear?}  → fills category_rank/percentile_rank
 *   POST /api/python/mf/risk-from-monthly  body: {fiscalYear?, minMonths?} → fills VaR/CVaR/semi-dev
 *   POST /api/python/mf/sync-change-pct    body: {}  → fills mutual_funds.change_percent
 *   POST /api/python/mf/derived-metrics    body: {fiscalYear?} → fills Treynor, Jensen alpha
 */
import { Router } from 'express';
import { proxyToPython, isPythonServiceConfigured } from '../clients/python-client';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/api/python/health', async (req, res) => {
  if (!isPythonServiceConfigured()) {
    return res.json({
      status: 'not_configured',
      service: 'fintekpro-python',
      message: 'Set PYTHON_SERVICE_URL to enable the Python analytics service.',
      deploy_path: 'services/python/',
    });
  }
  return proxyToPython(req, res, '/health');
});

// Analytics
router.get('/api/python/analytics/portfolio-summary', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/portfolio-summary');
});

router.get('/api/python/analytics/capital-gains', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/capital-gains');
});

router.get('/api/python/analytics/amc-breakdown', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/amc-breakdown');
});

// Quant — existing
router.post('/api/python/quant/xirr', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/xirr');
});

router.get('/api/python/quant/portfolio-xirr', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/portfolio-xirr');
});

router.get('/api/python/quant/rolling-returns', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/rolling-returns');
});

// Quant — new computation endpoints (scipy/numpy/sklearn)
router.post('/api/python/quant/mvo', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/mvo');
});

router.post('/api/python/quant/black-litterman', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/black-litterman');
});

router.post('/api/python/quant/backtest', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/backtest');
});

router.post('/api/python/quant/drift-predict', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/drift-predict');
});

// MF Analytics — py-mf-analytics-v1
// Compute full analytics from supplied NAV + optional benchmark arrays
router.post('/api/python/mf/compute-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/compute-metrics');
});

// Compute analytics directly from DB (mf_nav_history + mf_benchmark_map + market_index_nav)
router.get('/api/python/mf/scheme-analytics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/scheme-analytics');
});

// Compute monthly return series for a batch of schemes
router.post('/api/python/mf/monthly-series', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/monthly-series');
});

// Bulk compute metrics for all schemes in mf_nav_history and upsert into mutual_fund_metrics
router.post('/api/python/mf/bulk-compute-db', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/bulk-compute-db');
});

// Cross-sectional ranking: fills category_rank, category_size, percentile_rank
router.post('/api/python/mf/cross-sectional-rank', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/cross-sectional-rank');
});

// Risk metrics from monthly returns: VaR 95%, CVaR 95%, semi-deviation, consistency, capture ratios
router.post('/api/python/mf/risk-from-monthly', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/risk-from-monthly');
});

// Sync change_percent and change into mutual_funds from mf_nav_history
router.post('/api/python/mf/sync-change-pct', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/sync-change-pct');
});

// Derived metrics: Treynor ratio, Jensen alpha, volatility↔standard_deviation sync
router.post('/api/python/mf/derived-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/derived-metrics');
});

export default router;
