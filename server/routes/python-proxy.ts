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
 *   GET  /api/python/quant/rolling-returns?isin=INF...&periods=1Y,3Y,5Y
 *   POST /api/python/quant/mvo           body: {assets, config, transition}
 *   POST /api/python/quant/black-litterman body: {mvoResult, views, config}
 *   POST /api/python/quant/backtest      body: {weights, monthlyReturns, benchmarkWeights}
 *   POST /api/python/quant/drift-predict body: {driftMetrics, toleranceBandPct}
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

export default router;
