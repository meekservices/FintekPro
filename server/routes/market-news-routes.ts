/**
 * Market News Routes
 *
 * REST API for the ET Markets news aggregator.
 * All routes use GCR standard response: { success, data, meta: { timestamp, version } }
 *
 * Routes:
 *  GET /api/market-news                 — aggregated feed (paginated, 20/page)
 *  GET /api/market-news/headlines       — top 5 ET Markets headlines
 *  GET /api/market-news/nse-announcements?symbol= — NSE corporate actions
 *  GET /api/market-news/summary         — full dashboard summary (headlines + feed + NSE)
 *  POST /api/market-news/refresh        — admin: invalidate cache + re-fetch
 */

import { Express, Request, Response } from "express";
import {
  getAggregatedNews,
  getMarketHeadlines,
  fetchNseAnnouncements,
  getMarketSummary,
  invalidateNewsCache,
  ET_MARKETS_SERVICE_VERSION,
} from "../services/et-markets-service";
import { requireAdmin } from "../middleware/roleMiddleware";
import { logger } from "../logger";

const META = (req: Request) => ({
  timestamp: new Date().toISOString(),
  version: ET_MARKETS_SERVICE_VERSION,
  path: req.path,
});

export function registerMarketNewsRoutes(app: Express): void {

  // ── GET /api/market-news ────────────────────────────────────────────────
  app.get("/api/market-news", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const limit  = Math.min(parseInt(String(req.query.limit ?? "20"), 10), 50);
      const page   = Math.max(parseInt(String(req.query.page ?? "1"), 10), 1);
      const cat    = req.query.category as string | undefined;

      let news = await getAggregatedNews(50);
      if (cat) news = news.filter((n) => n.category?.toLowerCase() === cat.toLowerCase());

      const total   = news.length;
      const start_i = (page - 1) * limit;
      const items   = news.slice(start_i, start_i + limit);

      logger.info("MARKET_NEWS_LIST", {
        event: "MARKET_NEWS_LIST",
        latency_ms: Date.now() - start,
        item_count: items.length,
        status: "success",
      });

      res.json({
        success: true,
        data: items,
        meta: {
          ...META(req),
          total,
          page,
          limit,
          total_pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      logger.error("MARKET_NEWS_LIST", {
        event: "MARKET_NEWS_LIST",
        error: err instanceof Error ? err.message : String(err),
        latency_ms: Date.now() - start,
        status: "error",
      });
      res.status(500).json({
        success: false,
        error: { error_code: "NEWS_FETCH_FAILED", message: "Failed to fetch market news", retryable: true },
        meta: META(req),
      });
    }
  });

  // ── GET /api/market-news/headlines ─────────────────────────────────────
  app.get("/api/market-news/headlines", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const headlines = await getMarketHeadlines();
      logger.info("MARKET_NEWS_HEADLINES", {
        event: "MARKET_NEWS_HEADLINES",
        item_count: headlines.length,
        latency_ms: Date.now() - start,
        status: "success",
      });
      res.json({
        success: true,
        data: headlines,
        meta: { ...META(req), item_count: headlines.length },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { error_code: "HEADLINES_FETCH_FAILED", message: "Failed to fetch headlines", retryable: true },
        meta: META(req),
      });
    }
  });

  // ── GET /api/market-news/nse-announcements ──────────────────────────────
  app.get("/api/market-news/nse-announcements", async (req: Request, res: Response) => {
    const start  = Date.now();
    const symbol = req.query.symbol as string | undefined;
    try {
      const announcements = await fetchNseAnnouncements(symbol);
      logger.info("MARKET_NEWS_NSE", {
        event: "MARKET_NEWS_NSE",
        symbol: symbol ?? "all",
        item_count: announcements.length,
        latency_ms: Date.now() - start,
        status: "success",
      });
      res.json({
        success: true,
        data: announcements,
        meta: { ...META(req), symbol: symbol ?? "all", item_count: announcements.length },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { error_code: "NSE_FETCH_FAILED", message: "Failed to fetch NSE announcements", retryable: true },
        meta: META(req),
      });
    }
  });

  // ── GET /api/market-news/summary ────────────────────────────────────────
  app.get("/api/market-news/summary", async (req: Request, res: Response) => {
    const start = Date.now();
    try {
      const summary = await getMarketSummary();
      logger.info("MARKET_NEWS_SUMMARY", {
        event: "MARKET_NEWS_SUMMARY",
        headlines_count: summary.headlines.length,
        news_count: summary.latestNews.length,
        nse_count: summary.nseAnnouncements.length,
        latency_ms: Date.now() - start,
        status: "success",
      });
      res.json({
        success: true,
        data: summary,
        meta: { ...META(req), cached_at: summary.fetchedAt },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: { error_code: "SUMMARY_FETCH_FAILED", message: "Failed to fetch market summary", retryable: true },
        meta: META(req),
      });
    }
  });

  // ── POST /api/market-news/refresh (admin only) ──────────────────────────
  app.post("/api/market-news/refresh", requireAdmin, async (req: Request, res: Response) => {
    const start = Date.now();
    invalidateNewsCache();
    // Pre-warm cache
    const summary = await getMarketSummary();
    logger.info("MARKET_NEWS_CACHE_REFRESH", {
      event: "MARKET_NEWS_CACHE_REFRESH",
      latency_ms: Date.now() - start,
      status: "success",
    });
    res.json({
      success: true,
      data: { message: "Cache invalidated and re-warmed", item_count: summary.latestNews.length },
      meta: META(req),
    });
  });
}
