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

// ── Analytics ────────────────────────────────────────────────────────────
router.get('/api/python/analytics/portfolio-summary', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/portfolio-summary');
});

router.get('/api/python/analytics/capital-gains', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/capital-gains');
});

router.get('/api/python/analytics/amc-breakdown', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/analytics/amc-breakdown');
});

// ── Quant ────────────────────────────────────────────────────────────────
router.post('/api/python/quant/xirr', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/xirr');
});

router.get('/api/python/quant/portfolio-xirr', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/portfolio-xirr');
});

router.get('/api/python/quant/rolling-returns', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/rolling-returns');
});

router.post('/api/python/quant/mvo', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/mvo');
});

router.post('/api/python/quant/black-litterman', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/black-litterman');
});

router.post('/api/python/quant/backtest', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/backtest');
});

router.post('/api/python/quant/drift-predict', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/quant/drift-predict');
});

// ── MF Analytics (py-mf-analytics-v2) ───────────────────────────────────
router.post('/api/python/mf/compute-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/compute-metrics');
});

router.get('/api/python/mf/scheme-analytics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/scheme-analytics');
});

router.post('/api/python/mf/monthly-series', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/monthly-series');
});

router.post('/api/python/mf/bulk-compute-db', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/bulk-compute-db');
});

router.post('/api/python/mf/cross-sectional-rank', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/cross-sectional-rank');
});

router.post('/api/python/mf/risk-from-monthly', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/risk-from-monthly');
});

router.post('/api/python/mf/sync-change-pct', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/sync-change-pct');
});

router.post('/api/python/mf/derived-metrics', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/derived-metrics');
});

router.post('/api/python/mf/nav-backfill', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/nav-backfill');
});

router.post('/api/python/mf/amfi-enrich', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/amfi-enrich');
});

router.post('/api/python/mf/monthly-pipeline', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/mf/monthly-pipeline');
});

// ── Forecasting (py-return-forecast-v1 / py-sip-v1) ─────────────────────
router.post('/api/python/forecasting/return-forecast', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/forecasting/return-forecast');
});

router.post('/api/python/forecasting/sip-simulate', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/forecasting/sip-simulate');
});

// ── Portfolio Operations (py-overlap-v1 / py-rebalance-v1) ───────────────
router.post('/api/python/portfolio/overlap-analysis', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/portfolio/overlap-analysis');
});

router.post('/api/python/portfolio/rebalance', requireAuth, async (req, res) => {
  return proxyToPython(req, res, '/api/portfolio/rebalance');
});

export default router;
