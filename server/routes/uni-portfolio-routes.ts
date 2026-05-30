/**
 * UniPortfolio API Routes
 *
 * Prefix: /api/portfolio (registered in server/index.ts)
 *
 * All routes consume the UniPortfolioService and return the canonical
 * UniPortfolioSnapshot shape. The quant engine, AI advisory service,
 * and client dashboard all use these routes.
 *
 * Endpoints:
 *   GET  /api/portfolio/unified            → Full UniPortfolioSnapshot (cached 5min)
 *   GET  /api/portfolio/unified/summary    → Summary + broker breakdown (lightweight)
 *   GET  /api/portfolio/unified/drift      → Drift report only
 *   GET  /api/portfolio/unified/rebalance  → Rebalancing recommendations
 *   POST /api/portfolio/unified/refresh    → Force-refresh (clears per-user cache)
 *   GET  /api/portfolio/unified/id         → Returns stable portfolioId for this user
 *
 * Query params (all GET routes):
 *   ?riskScore=50         → User risk score 0-100 (default: 50)
 *   ?horizon=5            → Investment horizon in years (default: 5)
 *   ?segment=retail       → User segment: retail|hni|shni|bhni (default: retail)
 */

import { Router } from 'express';
import { uniPortfolioService } from '../services/portfolio/uniPortfolioService';
import { logger } from '../logger';

export const uniPortfolioRouter = Router();

// ─── Helper: extract query params ─────────────────────────────────────────────
function extractParams(req: any) {
  return {
    riskScore: parseInt(req.query.riskScore as string) || 50,
    horizon: parseInt(req.query.horizon as string) || 5,
    segment: (req.query.segment as string) || 'retail',
  };
}

// ─── Auth guard helper ─────────────────────────────────────────────────────────
function requireAuth(req: any, res: any): boolean {
  if (!req.user) {
    res.status(401).json({ success: false, error_code: 'UNAUTHORIZED', message: 'Authentication required.' });
    return false;
  }
  return true;
}

// ─── Standard meta wrapper ─────────────────────────────────────────────────────
function meta() {
  return { timestamp: new Date().toISOString(), version: '1.0', engine_version: 'MPAL-2.0' };
}

// ==========================================
// GET /api/portfolio/unified/id
// Stable portfolio ID — no broker calls needed.
// The quant engine uses this as the canonical portfolio reference.
// ==========================================
uniPortfolioRouter.get('/unified/id', (req, res) => {
  if (!requireAuth(req, res)) return;
  const portfolioId = `unified_${req.user!.id}`;
  res.json({
    success: true,
    data: { portfolioId, userId: req.user!.id },
    meta: meta(),
  });
});

// ==========================================
// GET /api/portfolio/unified
// Full snapshot — all brokers, drift, rebalancing, concentration.
// Used by: AI advisory agents, full portfolio page, quant engine.
// ==========================================
uniPortfolioRouter.get('/unified', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { riskScore, horizon, segment } = extractParams(req);
  const start = Date.now();
  try {
    const snapshot = await uniPortfolioService.getSnapshot(req.user!.id, riskScore, horizon, segment);
    logger.info(`[UniPortfolio API] Snapshot served`, {
      event: 'UNI_PORTFOLIO_API_SERVED',
      user_id: req.user!.id,
      portfolioId: snapshot.portfolioId,
      latency_ms: Date.now() - start,
      status: 'success',
    });
    res.json({ success: true, data: snapshot, meta: meta() });
  } catch (err: any) {
    logger.error(`[UniPortfolio API] Snapshot failed`, { event: 'UNI_PORTFOLIO_API_ERROR', user_id: req.user!.id, error: err?.message });
    res.status(500).json({ success: false, error_code: 'SNAPSHOT_FAILED', message: err?.message, meta: meta() });
  }
});

// ==========================================
// GET /api/portfolio/unified/summary
// Lightweight — summary + broker breakdown only. No drift/rebalance computation.
// Used by: dashboard header, net worth widget.
// ==========================================
uniPortfolioRouter.get('/unified/summary', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { riskScore, horizon, segment } = extractParams(req);
  try {
    const snapshot = await uniPortfolioService.getSnapshot(req.user!.id, riskScore, horizon, segment);
    res.json({
      success: true,
      data: {
        portfolioId: snapshot.portfolioId,
        userId: snapshot.userId,
        generatedAt: snapshot.generatedAt,
        summary: snapshot.summary,
        brokerBreakdown: snapshot.brokerBreakdown,
        staleBrokers: snapshot.analysis.staleBrokers,
        meta: snapshot.meta,
      },
      meta: meta(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error_code: 'SUMMARY_FAILED', message: err?.message, meta: meta() });
  }
});

// ==========================================
// GET /api/portfolio/unified/drift
// Drift report only — fast, cached.
// Used by: drift alert banner, quant engine, AI advisory.
// ==========================================
uniPortfolioRouter.get('/unified/drift', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { riskScore, horizon, segment } = extractParams(req);
  try {
    const snapshot = await uniPortfolioService.getSnapshot(req.user!.id, riskScore, horizon, segment);
    res.json({
      success: true,
      data: {
        portfolioId: snapshot.portfolioId,
        drift: snapshot.analysis.drift,
        assetClassWeights: snapshot.summary.assetClassWeights,
        countryWeights: snapshot.summary.countryWeights,
        staleBrokers: snapshot.analysis.staleBrokers,
        generatedAt: snapshot.generatedAt,
      },
      meta: meta(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error_code: 'DRIFT_FAILED', message: err?.message, meta: meta() });
  }
});

// ==========================================
// GET /api/portfolio/unified/rebalance
// Full rebalancing plan — MVO-backed, tax-aware, prioritised trades.
// FASP-AI: output includes disclaimer, confidence_score, model_version.
// ==========================================
uniPortfolioRouter.get('/unified/rebalance', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { riskScore, horizon, segment } = extractParams(req);
  try {
    const snapshot = await uniPortfolioService.getSnapshot(req.user!.id, riskScore, horizon, segment);
    res.json({
      success: true,
      data: {
        portfolioId: snapshot.portfolioId,
        rebalancing: snapshot.analysis.rebalancing,
        concentration: snapshot.analysis.concentration,
        riskProfile: snapshot.analysis.riskProfile,
        // FASP-AI v1.0 mandatory fields
        confidence_score: snapshot.analysis.rebalancing.needsRebalance ? 85 : 70,
        model_version: snapshot.meta.engine_version,
        timestamp: snapshot.meta.calculation_timestamp,
        disclaimer: snapshot.meta.disclaimer,
        factors_considered: ['current_allocations', 'drift_threshold', 'tax_impact', 'concentration_risk'],
      },
      meta: meta(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error_code: 'REBALANCE_FAILED', message: err?.message, meta: meta() });
  }
});

// ==========================================
// POST /api/portfolio/unified/refresh
// Force-evicts cache and rebuilds from all brokers.
// Used by: pull-to-refresh on mobile, sync after trade execution.
// ==========================================
uniPortfolioRouter.post('/unified/refresh', async (req, res) => {
  if (!requireAuth(req, res)) return;
  const { riskScore, horizon, segment } = extractParams(req);
  try {
    const snapshot = await uniPortfolioService.refresh(req.user!.id, riskScore, horizon, segment);
    logger.info(`[UniPortfolio API] Cache refreshed`, {
      event: 'UNI_PORTFOLIO_CACHE_REFRESHED',
      user_id: req.user!.id,
      portfolioId: snapshot.portfolioId,
      status: 'success',
    });
    res.json({
      success: true,
      data: { portfolioId: snapshot.portfolioId, generatedAt: snapshot.generatedAt, summary: snapshot.summary },
      meta: meta(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error_code: 'REFRESH_FAILED', message: err?.message, meta: meta() });
  }
});
