/**
 * pro-stock-lists-router.ts
 *
 * REST API Endpoints for Moneycontrol-format PRO Stock Lists in FintekPro.
 * Powered by Upstox Market Data with IndianAPI as backup.
 *
 * Layer: Controller / Route (delegates business logic to proStockListsService)
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 */

import { Router, type Request, type Response } from "express";
import {
  proStockListsService,
  type ProListSlug,
} from "../services/pro-stock-lists-service";
import { logger } from "../logger";
import { db } from "../db";
import { toNseKey, upstoxMarketDataService } from "../services/upstox-market-data-service";
import { researchLists, researchListItems, agents } from "@shared/schema";
import { eq } from "drizzle-orm";

export const proStockListsRouter = Router();

// ── GET /api/research-lists/pro-stock-lists/categories ─────────────────────────
// Returns list of all 12 Moneycontrol format categories
proStockListsRouter.get("/categories", async (_req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const categories = proStockListsService.getAllCategoriesSummary();
    res.json({
      success: true,
      data: categories,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        count: categories.length,
        latency_ms: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.error("[ProStockListsRouter] Failed to fetch categories", {
      event: "PRO_STOCK_CATEGORIES_ERROR",
      error: error?.message || String(error),
    });
    res.status(500).json({
      success: false,
      error: {
        error_code: "INTERNAL_ERROR",
        message: "Failed to load PRO stock list categories",
        retryable: true,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

// ── GET /api/research-lists/pro-stock-lists/:slug ─────────────────────────────
// Returns live stocks for a specific category
proStockListsRouter.get("/:slug", async (req: Request, res: Response) => {
  const t0 = Date.now();
  const slug = req.params.slug as ProListSlug;
  const marketCapFilter = (req.query.marketCap as string) || "all";
  const searchQuery = (req.query.search as string) || "";
  const forceRefresh = req.query.refresh === "true";
  const onlyFresh = req.query.onlyFresh !== "false"; // Enforce fresh live quotes by default

  try {
    const listData = await proStockListsService.getProStockList(slug, {
      marketCapFilter,
      searchQuery,
      forceRefresh,
      onlyFresh,
    });

    res.json({
      success: true,
      data: listData,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        provider: listData.metrics.activeProvider,
        isMarketOpen: listData.metrics.isMarketOpen,
        marketSession: listData.metrics.marketSession,
        freshnessScorePercent: listData.metrics.freshnessScorePercent,
        latency_ms: Date.now() - t0,
        disclaimer:
          "SEBI Disclaimer: Stock lists, fundamental metrics, and technical indicators are provided for decision support and analysis only. This does not constitute an offer, solicitation, or recommendation to buy or sell securities.",
      },
    });
  } catch (error: any) {
    logger.error("[ProStockListsRouter] Failed to fetch PRO stock list", {
      event: "PRO_STOCK_LIST_FETCH_ERROR",
      slug,
      error: error?.message || String(error),
    });
    res.status(500).json({
      success: false,
      error: {
        error_code: "FETCH_FAILED",
        message: "Failed to retrieve live PRO stock list data",
        retryable: true,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

// ── POST /api/research-lists/pro-stock-lists/:slug/save-to-research-list ───────
// Saves this curated PRO list directly into the advisor's personal research lists
proStockListsRouter.post("/:slug/save-to-research-list", async (req: Request, res: Response) => {
  const slug = req.params.slug as ProListSlug;
  const customName = (req.body.name as string) || "";

  try {
    const user = (req as any).user;
    let agentId = user?.agentId || user?.id;
    if (!agentId) {
      const [firstAgent] = await db.select({ id: agents.id }).from(agents).limit(1);
      agentId = firstAgent?.id;
    }

    if (!agentId) {
      return res.status(401).json({
        success: false,
        error: {
          error_code: "UNAUTHORIZED",
          message: "Please sign in to save custom research lists",
          retryable: false,
        },
      });
    }

    const listData = await proStockListsService.getProStockList(slug);
    const listName = customName.trim() || `PRO: ${listData.category.name}`;

    // 1. Create Research List with all upgraded columns
    const [createdList] = await db
      .insert(researchLists)
      .values({
        name: listName,
        description: `Curated from Moneycontrol PRO-format (${listData.category.name}). Live pricing powered by Upstox.`,
        universeType: "STOCK",
        visibility: "private",
        isEditable: true,
        listType: "system_pro",
        categorySlug: slug,
        isSystemCurated: false,
        benchmarkIndex: "NIFTY 500",
        refreshFrequency: "realtime",
        primaryProvider: listData.metrics.activeProvider,
        lastSyncedAt: new Date(),
        tags: ["PRO_LIST", slug.toUpperCase(), "UPSTOX_POWERED"],
        createdByAgentId: agentId,
        cachedMetrics: {
          itemCount: listData.stocks.length,
          avg1YReturn: listData.metrics.avg1YReturn,
          provider: listData.metrics.activeProvider,
          gainersCount: listData.metrics.gainersCount,
          losersCount: listData.metrics.losersCount,
        },
      })
      .returning();

    // 2. Insert items with all relational and analytical columns
    if (createdList && listData.stocks.length > 0) {
      const itemsToInsert = listData.stocks.map((stock, idx) => ({
        researchListId: createdList.id,
        instrumentId: stock.isin || stock.symbol,
        instrumentType: "stock",
        instrumentName: stock.companyName,
        instrumentSymbol: stock.symbol,
        instrumentIsin: stock.isin || null,
        upstoxInstrumentKey: stock.isin ? toNseKey(stock.isin) : toNseKey(stock.symbol),
        displayOrder: idx,
        primaryMetricLabel: stock.primaryMetricLabel,
        primaryMetricValue: stock.primaryMetricValue,
        targetPrice: stock.targetPrice != null ? String(stock.targetPrice) : null,
        upsidePercent: stock.upsidePercent != null ? String(stock.upsidePercent) : null,
        fScore: stock.fScore ?? null,
        themeBadge: stock.themeBadge ?? null,
        lastQuoteAt: stock.quoteTimestamp ? new Date(stock.quoteTimestamp) : new Date(),
        isQuoteFresh: stock.isFresh ?? true,
        addedSource: "pro_stock_list",
        notes: `${stock.primaryMetricLabel}: ${stock.primaryMetricValue}`,
        snapshotMetrics: {
          ltp: stock.ltp,
          priceChange: stock.priceChange,
          pricePercentChange: stock.pricePercentChange,
          primaryMetricLabel: stock.primaryMetricLabel,
          primaryMetricValue: stock.primaryMetricValue,
          sector: stock.sector,
          themeBadge: stock.themeBadge,
        },
      }));

      await db.insert(researchListItems).values(itemsToInsert);
    }

    res.status(201).json({
      success: true,
      data: {
        id: createdList.id,
        name: createdList.name,
        itemCount: listData.stocks.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
    });
  } catch (error: any) {
    logger.error("[ProStockListsRouter] Failed to save PRO list to research lists", {
      event: "PRO_STOCK_LIST_SAVE_ERROR",
      slug,
      error: error?.message || String(error),
    });
    res.status(500).json({
      success: false,
      error: {
        error_code: "SAVE_FAILED",
        message: "Failed to save PRO stock list to personal research lists",
        retryable: false,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

// ── GET /api/research-lists/pro-stock-lists/time-series/:symbol ────────────────
// Returns daily OHLCV candles & normalized sparkline points for dynamic plotting
proStockListsRouter.get("/time-series/:symbol", async (req: Request, res: Response) => {
  const t0 = Date.now();
  const rawSymbol = req.params.symbol.trim().toUpperCase();
  const days = Math.min(Math.max(Number.parseInt(req.query.days as string, 10) || 30, 5), 365);
  const toDate = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  try {
    let candles: Array<{ timestamp: string; open: number; high: number; low: number; close: number; volume: number }> = [];

    if (upstoxMarketDataService.isReady()) {
      const result = await upstoxMarketDataService.getHistoricalData(rawSymbol, "day", fromDate, toDate, "NSE");
      if (result.success && result.data && result.data.length > 0) {
        candles = result.data;
      }
    }

    // Normalized sparkline data points
    const sparkline = candles.map((c) => ({
      date: c.timestamp.split("T")[0],
      close: c.close,
    }));

    const startPrice = candles.length > 0 ? candles[0].close : 0;
    const endPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
    const returnPercent = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;

    res.json({
      success: true,
      data: {
        symbol: rawSymbol,
        days,
        candles,
        sparkline,
        summary: {
          startPrice,
          endPrice,
          returnPercent: Math.round(returnPercent * 100) / 100,
          candlesCount: candles.length,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        provider: candles.length > 0 ? "UPSTOX" : "UNAVAILABLE",
        latency_ms: Date.now() - t0,
      },
    });
  } catch (error: any) {
    logger.warn("[ProStockListsRouter] Failed to fetch time-series for plotting", {
      symbol: rawSymbol,
      error: error?.message || String(error),
    });
    res.status(500).json({
      success: false,
      error: {
        error_code: "PLOT_DATA_FAILED",
        message: `Failed to retrieve plotting time-series for ${rawSymbol}`,
        retryable: true,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0.0" },
    });
  }
});

