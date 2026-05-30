/**
 * MPAL API Routes
 *
 * Prefix: /api/mpal (registered in server/routes/index.ts)
 *
 * Endpoints:
 *   Financial Profile
 *     GET  /financial-profile
 *
 *   Broker Registry & Health
 *     GET  /brokers              → list all brokers + configured status + capabilities
 *     GET  /brokers/health       → live health check all configured brokers
 *     GET  /brokers/:id          → single broker status
 *
 *   Investment / Orders
 *     GET  /broker/:assetClass/quotes
 *     GET  /broker/:assetClass/positions
 *     POST /broker/:assetClass/orders    (idempotency-key aware)
 *     GET  /orders               → paginated broker_orders log
 *     GET  /orders/:id           → single order with live broker refresh option
 *
 *   Credit
 *     GET  /credit/products
 *     GET  /credit/eligibility
 *     POST /credit/applications
 *     GET  /credit/applications
 */

import { Router } from "express";
import { investmentRouter } from "../services/mpal/core/investmentRouter";
import { creditRouter } from "../services/mpal/core/creditRouter";
import { providerRegistry } from "../services/mpal/core/providerRegistry";
import { financialProfileEngine } from "../services/profile/financialProfileEngine";
import { BrokerUnavailableError, BrokerNotConfiguredError, BrokerError } from "../services/mpal/interfaces/IBroker";
import { logger } from "../logger";

export const mpalRouter = Router();

// ─── Helper: map BrokerError → HTTP response ──────────────────────────────────
function brokerErrorResponse(res: any, err: any) {
  if (err instanceof BrokerUnavailableError || err instanceof BrokerNotConfiguredError) {
    return res.status(503).json({
      success: false,
      error_code: err.error_code,
      message: err.message,
      retryable: err.retryable,
      meta: { timestamp: new Date().toISOString(), version: '1.0' },
    });
  }
  if (err instanceof BrokerError) {
    return res.status(502).json({
      success: false,
      error_code: err.error_code,
      message: err.message,
      retryable: err.retryable,
      meta: { timestamp: new Date().toISOString(), version: '1.0' },
    });
  }
  return res.status(500).json({
    success: false,
    error_code: 'INTERNAL_ERROR',
    message: err?.message ?? 'Internal Server Error',
    retryable: false,
    meta: { timestamp: new Date().toISOString(), version: '1.0' },
  });
}

// ==========================================
// MPAL: Financial Profile
// ==========================================
mpalRouter.get("/financial-profile", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const profile = await financialProfileEngine.buildProfile(req.user!.id);
    res.json({
      success: true,
      data: {
        ...profile,
        id: `prof_${req.user!.id}`,
        riskScore: "750",
        lastUpdated: new Date().toISOString(),
      },
      meta: { timestamp: new Date().toISOString(), version: '1.0' },
    });
  } catch (error) {
    logger.error("Error fetching financial profile", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ==========================================
// MPAL: Broker Registry & Health
// ==========================================

/**
 * GET /api/mpal/brokers
 * Lists all registered brokers with their configured status and capabilities.
 * Does NOT require auth — safe for internal dashboards.
 */
mpalRouter.get("/brokers", (_req, res) => {
  const brokers = providerRegistry.getAllBrokers().map(b => ({
    id: b.brokerId,
    configured: b.isConfigured(),
    capabilities: b.capabilities,
  }));
  res.json({
    success: true,
    data: brokers,
    meta: { timestamp: new Date().toISOString(), version: '1.0', total: brokers.length },
  });
});

/**
 * GET /api/mpal/brokers/health
 * Runs healthCheck() on every registered broker (in parallel).
 * Timeout: 5s per broker. Returns partial results if some fail.
 */
mpalRouter.get("/brokers/health", async (_req, res) => {
  const brokers = providerRegistry.getAllBrokers();
  const results = await Promise.allSettled(
    brokers.map(b => b.healthCheck(5000))
  );
  const health = results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      brokerId: brokers[i].brokerId,
      configured: brokers[i].isConfigured(),
      healthy: false,
      message: (r.reason as any)?.message ?? 'Health check threw an exception',
      checkedAt: new Date().toISOString(),
    };
  });
  const allHealthy = health.every(h => !h.configured || h.healthy);
  res.status(allHealthy ? 200 : 207).json({
    success: allHealthy,
    data: health,
    meta: { timestamp: new Date().toISOString(), version: '1.0' },
  });
});

/**
 * GET /api/mpal/brokers/:id
 * Single broker status + live health check.
 */
mpalRouter.get("/brokers/:id", async (req, res) => {
  const broker = providerRegistry.getAllBrokers().find(b => b.brokerId === req.params.id.toUpperCase());
  if (!broker) {
    return res.status(404).json({ success: false, error_code: 'BROKER_NOT_FOUND', message: `Broker '${req.params.id}' not registered.` });
  }
  const health = await broker.healthCheck(5000).catch(err => ({
    brokerId: broker.brokerId, configured: broker.isConfigured(), healthy: false, message: err?.message, checkedAt: new Date().toISOString(),
  }));
  res.json({
    success: true,
    data: { id: broker.brokerId, capabilities: broker.capabilities, ...health },
    meta: { timestamp: new Date().toISOString(), version: '1.0' },
  });
});

// ==========================================
// MPAL: Broker / Investments
// ==========================================

mpalRouter.get("/broker/:assetClass/quotes", async (req, res) => {
  try {
    const { assetClass } = req.params;
    const quotes = await investmentRouter.getQuote(assetClass, req.query.symbol as string || "AAPL");
    res.json({ success: true, data: [quotes], meta: { timestamp: new Date().toISOString(), version: '1.0' } });
  } catch (error: any) {
    logger.error(`Error fetching quotes for ${req.params.assetClass}`, error);
    return brokerErrorResponse(res, error);
  }
});

mpalRouter.get("/broker/:assetClass/positions", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { assetClass } = req.params;
    const preferred = req.query.broker as string | undefined;
    const positions = await investmentRouter.getPositions(assetClass, req.user, preferred);
    res.json({ success: true, data: positions, meta: { timestamp: new Date().toISOString(), version: '1.0', total: positions.length } });
  } catch (error: any) {
    logger.error(`Error fetching positions for ${req.params.assetClass}`, error);
    return brokerErrorResponse(res, error);
  }
});

/**
 * POST /api/mpal/broker/:assetClass/orders
 *
 * Idempotency: pass x-idempotency-key header to make the request safe to retry.
 * Optional: pass ?broker=IIFL to prefer a specific broker.
 */
mpalRouter.post("/broker/:assetClass/orders", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { assetClass } = req.params;
    const preferred = req.query.broker as string | undefined;
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
    const order = await investmentRouter.executeOrder(
      assetClass,
      { ...req.body, idempotencyKey },
      req.user,
      preferred,
    );
    res.json({ success: true, data: order, meta: { timestamp: new Date().toISOString(), version: '1.0' } });
  } catch (error: any) {
    logger.error(`Error executing order for ${req.params.assetClass}`, error);
    return brokerErrorResponse(res, error);
  }
});

// ==========================================
// MPAL: Broker Orders Log
// ==========================================

/**
 * GET /api/mpal/orders
 * Paginated broker_orders table — supports ?page=1&limit=20&brokerId=IIFL&status=filled
 */
mpalRouter.get("/orders", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;
    const { db } = await import("../db");
    const { brokerOrders } = await import("../../shared/schema/mpal");
    const { eq, and, desc } = await import("drizzle-orm");

    const conditions: any[] = [eq(brokerOrders.userId, req.user!.id)];
    if (req.query.brokerId) conditions.push(eq(brokerOrders.brokerId, req.query.brokerId as string));
    if (req.query.status) conditions.push(eq(brokerOrders.status, req.query.status as string));

    const [orders, total] = await Promise.all([
      db.select().from(brokerOrders).where(and(...conditions)).orderBy(desc(brokerOrders.createdAt)).limit(limit).offset(offset),
      db.select({ count: brokerOrders.id }).from(brokerOrders).where(and(...conditions)).then(r => r.length),
    ]);

    res.json({
      success: true,
      data: orders,
      meta: { timestamp: new Date().toISOString(), version: '1.0', page, limit, total },
    });
  } catch (err: any) {
    logger.error("Error fetching broker orders", err);
    res.status(500).json({ success: false, error_code: 'FETCH_FAILED', message: err?.message });
  }
});

/**
 * GET /api/mpal/orders/:id
 * Single order. Pass ?refresh=true to poll live status from broker.
 */
mpalRouter.get("/orders/:id", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { db } = await import("../db");
    const { brokerOrders } = await import("../../shared/schema/mpal");
    const { eq, and } = await import("drizzle-orm");

    const rows = await db.select().from(brokerOrders).where(
      and(eq(brokerOrders.id, req.params.id), eq(brokerOrders.userId, req.user!.id))
    );
    if (!rows.length) return res.status(404).json({ success: false, error_code: 'ORDER_NOT_FOUND' });

    let order: any = rows[0];

    // Live refresh from broker if requested and order is still open
    if (req.query.refresh === 'true' && order.brokerOrderId && ['pending','submitted','partially_filled'].includes(order.status)) {
      try {
        const broker = providerRegistry.getBroker(order.brokerId);
        const live = await broker.getOrderStatus(order.brokerOrderId);
        // Update DB
        await db.update(brokerOrders).set({
          status: live.status,
          filledQty: live.filledQty?.toString(),
          filledPrice: live.filledPrice?.toString(),
          updatedAt: new Date(),
        }).where(eq(brokerOrders.id, order.id));
        order = { ...order, ...live };
      } catch (e: any) {
        logger.warn(`[MPAL] Live order refresh failed for ${order.id}`, e?.message);
      }
    }

    res.json({ success: true, data: order, meta: { timestamp: new Date().toISOString(), version: '1.0' } });
  } catch (err: any) {
    logger.error("Error fetching broker order", err);
    res.status(500).json({ success: false, error_code: 'FETCH_FAILED', message: err?.message });
  }
});

// ==========================================
// MPAL: Credit / Borrowing
// ==========================================
mpalRouter.get("/credit/products", async (_req, res) => {
  try {
    const products = [
      {
        id: "prod_1", providerId: "M2P_LENDING", productType: "PERSONAL_LOAN",
        name: "Portfolio-Backed Express Loan",
        description: "Instant liquidity against your mutual fund portfolio.",
        interestRate: 10.5, minAmount: 10000, maxAmount: 500000, maxTenureMonths: 36, isActive: true,
      },
      {
        id: "prod_2", providerId: "SETU_AGGREGATOR", productType: "CREDIT_CARD",
        name: "FintekPro Premium Card",
        description: "High rewards credit card based on your net worth.",
        interestRate: 18.0, minAmount: 50000, maxAmount: 1000000, maxTenureMonths: 0, isActive: true,
      },
    ];
    res.json({ success: true, data: products, meta: { timestamp: new Date().toISOString(), version: '1.0' } });
  } catch (error) {
    logger.error("Error fetching credit products", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.get("/credit/eligibility", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const { creditScoringEngine } = await import("../services/mpal/core/creditRouter");
    const scoring = await (creditScoringEngine as any)?.scoreUser?.(req.user!.id) ?? { eligible: false, message: "Scoring engine not configured" };
    res.json({ success: true, data: scoring, meta: { timestamp: new Date().toISOString(), version: '1.0' } });
  } catch (error) {
    logger.error("Error evaluating credit eligibility", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.post("/credit/applications", async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    const application = { ...req.body, userId: req.user!.id };
    const result = await creditRouter.routeApplication(application);
    res.json({ success: true, data: result, meta: { timestamp: new Date().toISOString(), version: '1.0' } });
  } catch (error) {
    logger.error("Error submitting credit application", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

mpalRouter.get("/credit/applications", async (_req, res) => {
  res.json({ success: true, data: [], meta: { timestamp: new Date().toISOString(), version: '1.0', total: 0 } });
});
