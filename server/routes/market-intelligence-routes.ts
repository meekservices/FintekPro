/**
 * Market Intelligence Routes
 *
 * Exposes IndianAPI.in Growth Plan (31 endpoints) to the FintekPro agent portal.
 * All routes are authenticated and return standard FintekPro API responses.
 *
 * ── Market Intelligence ─────────────────────────────────────────────────────
 *   GET /api/market/most-active?exchange=NSE
 *   GET /api/market/trending?exchange=NSE
 *   GET /api/market/price-shockers
 *   GET /api/market/52-week
 *   GET /api/market/news?page=1&size=20
 *   GET /api/market/ai-news?category=market
 *   GET /api/market/commodities
 *
 * ── Stock Research ──────────────────────────────────────────────────────────
 *   GET /api/stocks/:symbol/corporate-actions
 *   GET /api/stocks/:symbol/dividends
 *   GET /api/stocks/:symbol/target-price
 *   GET /api/stocks/:symbol/credit-ratings
 *   GET /api/stocks/:symbol/concalls
 *   GET /api/stocks/:symbol/announcements
 *   GET /api/stocks/:symbol/annual-reports
 *   GET /api/stocks/:symbol/documents
 *   GET /api/stocks/:symbol/logo
 *   GET /api/stocks/:symbol/news
 *   GET /api/stocks/:symbol/history?period=1y
 *   GET /api/stocks/:symbol/enriched
 *
 * ── Mutual Funds ────────────────────────────────────────────────────────────
 *   GET /api/mutual-funds/search?q=hdfc
 *   GET /api/mutual-funds/all
 *   GET /api/mutual-funds/:slug/details
 *   GET /api/mutual-funds/:id/holdings
 *   GET /api/mutual-funds/:id/nav-history
 *
 * ── IPO ─────────────────────────────────────────────────────────────────────
 *   GET /api/ipo/v2?status=upcoming&issue_type=mainboard
 *   GET /api/ipo/:id/details
 *
 * @module market-intelligence-routes
 */

import { Router } from "express";
import { indianApiService } from "../services/indian-api-service";
import { logger } from "../logger";

const router = Router();

// ── Middleware: auth guard ───────────────────────────────────────────────────

function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  next();
}

// ── Standard response wrapper ────────────────────────────────────────────────

function apiOk(res: any, data: any, meta?: Record<string, any>) {
  return res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "2.0.0",
      source: "indian_api",
      ...meta,
    },
  });
}

function apiError(res: any, message: string, status = 500) {
  return res.status(status).json({
    success: false,
    error: { error_code: "INDIAN_API_ERROR", message, retryable: true },
    meta: { timestamp: new Date().toISOString(), version: "2.0.0" },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════

router.get("/api/market/most-active", requireAuth, async (req, res) => {
  const exchange = (req.query.exchange as "NSE" | "BSE") ?? "NSE";
  try {
    const result = await indianApiService.getMostActive(exchange);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { exchange });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /most-active error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/market/trending", requireAuth, async (req, res) => {
  const exchange = (req.query.exchange as "NSE" | "BSE") ?? "NSE";
  try {
    const result = await indianApiService.getTrending(exchange);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { exchange });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /trending error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/market/price-shockers", requireAuth, async (req, res) => {
  try {
    const result = await indianApiService.getPriceShockers();
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data);
  } catch (err: any) {
    logger.error(`[MarketRoutes] /price-shockers error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/market/52-week", requireAuth, async (req, res) => {
  try {
    const result = await indianApiService.get52WeekHighLow();
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data);
  } catch (err: any) {
    logger.error(`[MarketRoutes] /52-week error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/market/news", requireAuth, async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const size = Math.min(parseInt(req.query.size as string) || 20, 50);
  try {
    const result = await indianApiService.getMarketNews(page, size);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { page, size });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /news error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/market/ai-news", requireAuth, async (req, res) => {
  const category = (req.query.category as string) ?? "market";
  try {
    const result = await indianApiService.getAINews(category);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { category });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /ai-news error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/market/commodities", requireAuth, async (req, res) => {
  try {
    const result = await indianApiService.getCommodities();
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data);
  } catch (err: any) {
    logger.error(`[MarketRoutes] /commodities error: ${err.message}`);
    return apiError(res, err.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STOCK RESEARCH
// ═══════════════════════════════════════════════════════════════════════════

router.get("/api/stocks/:symbol/corporate-actions", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getCorporateActions(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /corporate-actions(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/dividends", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getCorporateActions(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data?.dividends ?? [], {
      symbol,
      disclaimer: "Dividend amounts extracted from BSE/NSE corporate action disclosures",
    });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /dividends(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/target-price", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getAnalystTargetPrice(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, {
      symbol,
      disclaimer: "AI advisory — not investment advice. Past performance does not guarantee future results.",
    });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /target-price(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/credit-ratings", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getCreditRatings(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /credit-ratings(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/concalls", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getConcalls(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /concalls(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/announcements", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getRecentAnnouncements(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /announcements(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/annual-reports", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getAnnualReports(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /annual-reports(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/documents", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getDocuments(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /documents(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/logo", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getCompanyLogo(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /logo(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/news", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getCompanyNews(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /stock-news(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/history", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  const period = (req.query.period as string) ?? "1y";
  const allowed = ["1mo", "3mo", "6mo", "1y", "2y", "5y"];
  if (!allowed.includes(period)) {
    return res.status(400).json({ success: false, error: `Invalid period. Allowed: ${allowed.join(", ")}` });
  }
  try {
    const result = await indianApiService.getHistoricalData(symbol, period);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol, period });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /history(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/stocks/:symbol/enriched", requireAuth, async (req, res) => {
  const symbol = req.params.symbol.toUpperCase();
  try {
    const result = await indianApiService.getEnrichedStockData(symbol);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { symbol });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /enriched(${symbol}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTUAL FUNDS
// ═══════════════════════════════════════════════════════════════════════════

router.get("/api/mutual-funds/search", requireAuth, async (req, res) => {
  const q = (req.query.q as string) ?? "";
  if (!q.trim()) {
    return res.status(400).json({ success: false, error: "Query parameter 'q' is required" });
  }
  try {
    const result = await indianApiService.searchMutualFunds(q);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { query: q, total: (result.data as any[])?.length ?? 0 });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /mf-search error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/mutual-funds/all", requireAuth, async (req, res) => {
  try {
    const result = await indianApiService.getAllMutualFunds();
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { total: (result.data as any[])?.length ?? 0 });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /mf-all error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/mutual-funds/:slug/details", requireAuth, async (req, res) => {
  const slug = req.params.slug;
  try {
    const result = await indianApiService.getMutualFundDetails(slug);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { scheme: slug });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /mf-details(${slug}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/mutual-funds/:id/holdings", requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await indianApiService.getMFHoldings(id);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { scheme_id: id });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /mf-holdings(${id}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/mutual-funds/:id/nav-history", requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await indianApiService.getMFNavHistory(id);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { scheme_id: id });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /mf-nav-history(${id}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// IPO
// ═══════════════════════════════════════════════════════════════════════════

router.get("/api/ipo/v2", requireAuth, async (req, res) => {
  const status = req.query.status as string | undefined;
  const issueType = req.query.issue_type as string | undefined;
  try {
    const result = await indianApiService.getIPOv2(status, issueType);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { status, issue_type: issueType, total: (result.data as any[])?.length ?? 0 });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /ipo/v2 error: ${err.message}`);
    return apiError(res, err.message);
  }
});

router.get("/api/ipo/:id/details", requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    const result = await indianApiService.getIPOById(id);
    if (!result.success) return apiError(res, result.error ?? "Failed");
    return apiOk(res, result.data, { ipo_id: id });
  } catch (err: any) {
    logger.error(`[MarketRoutes] /ipo-details(${id}) error: ${err.message}`);
    return apiError(res, err.message);
  }
});

export default router;
