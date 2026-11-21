/**
 * market-stream-routes.ts
 *
 * Real-time Market Data Streaming & Decision Matrix Routes — FintekPro GCR v1.0.
 *
 * Exposes:
 *   - GET  /api/market-stream/decision-matrix  (Formal rules and architecture status)
 *   - GET  /api/market-stream/status           (Upstox & Alpaca streaming statuses)
 *   - POST /api/market-stream/connect          (Admin / manual connect)
 *   - POST /api/market-stream/disconnect       (Admin / manual disconnect)
 *   - POST /api/market-stream/subscribe        (Subscribe instrument keys)
 *   - POST /api/market-stream/unsubscribe      (Unsubscribe instrument keys)
 *   - GET  /api/market-stream/quote/:key       (O(1) memory lookup of live tick)
 *   - GET  /api/market-stream/sse              (Browser SSE client stream)
 *
 * @module market-stream-routes
 * @version 1.0.0
 */

import { Router, Request, Response } from "express";
import {
  MarketDataDecisionEngine,
  type MarketDataUseCase,
} from "../services/market-data-decision-matrix";
import {
  upstoxWsStreamingService,
  type UpstoxFeedMode,
  type UpstoxLiveTick,
} from "../services/upstox-ws-streaming-service";
import { alpacaWsStreamingService } from "../services/alpaca-ws-streaming-service";
import { angelOneAdapter } from "../services/adapters/angel-one-adapter";
import { ncdexMarketService } from "../services/ncdex-market-service";
import { logger } from "../logger";

const router = Router();

// ─── 1. Decision Matrix Rules & Telemetry ─────────────────────────────────────

router.get("/decision-matrix", (_req: Request, res: Response) => {
  const rules = MarketDataDecisionEngine.getAllRules();
  const metadata = MarketDataDecisionEngine.getMetadata();

  res.json({
    success: true,
    data: {
      rules,
      activeFeeds: {
        upstox: upstoxWsStreamingService.getStatus(),
        alpaca: alpacaWsStreamingService.getStatus(),
        angelOne: angelOneAdapter.getStatus(),
      },
    },
    meta: metadata,
  });
});

// ─── 2. Streaming Service Status ──────────────────────────────────────────────

router.get("/status", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      upstox: upstoxWsStreamingService.getStatus(),
      alpaca: alpacaWsStreamingService.getStatus(),
      angelOne: angelOneAdapter.getStatus(),
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "market-stream@1.0.0",
    },
  });
});

// ─── 2b. NCDEX Agricultural Commodities (Angel One / Bhavcopy) ────────────────

router.get("/ncdex", async (_req: Request, res: Response) => {
  try {
    const result = await ncdexMarketService.getAgriculturalBenchmarks({ persistToDb: false });
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({
      success: false,
      error: { error_code: "NCDEX_FETCH_FAILED", message: msg, retryable: true },
    });
  }
});

// ─── 3. Connect / Disconnect ──────────────────────────────────────────────────

router.post("/connect", async (req: Request, res: Response) => {
  try {
    const { provider = "upstox" } = req.body || {};

    if (provider === "alpaca") {
      alpacaWsStreamingService.connect();
    } else {
      await upstoxWsStreamingService.connect();
    }

    res.json({
      success: true,
      message: `Connecting to ${provider.toUpperCase()} streaming feed...`,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`[MarketStream] Connect error: ${msg}`);
    res.status(500).json({
      success: false,
      error: { error_code: "CONNECT_FAILED", message: msg, retryable: true },
    });
  }
});

router.post("/disconnect", (req: Request, res: Response) => {
  const { provider = "upstox" } = req.body || {};

  if (provider === "alpaca") {
    alpacaWsStreamingService.disconnect();
  } else {
    upstoxWsStreamingService.disconnect();
  }

  res.json({
    success: true,
    message: `Disconnected from ${provider.toUpperCase()} streaming feed.`,
    meta: { timestamp: new Date().toISOString() },
  });
});

// ─── 4. Subscribe / Unsubscribe ───────────────────────────────────────────────

router.post("/subscribe", (req: Request, res: Response) => {
  const { instrumentKeys, mode = "ltpc", useCase } = req.body || {};

  if (!Array.isArray(instrumentKeys) || instrumentKeys.length === 0) {
    res.status(400).json({
      success: false,
      error: {
        error_code: "INVALID_INSTRUMENTS",
        message: "instrumentKeys must be a non-empty array of strings",
        retryable: false,
      },
    });
    return;
  }

  // Check decision matrix if useCase is provided
  if (useCase) {
    const decision = MarketDataDecisionEngine.evaluate(useCase as MarketDataUseCase);
    if (decision.protocol !== "STREAMING_WEBSOCKET") {
      logger.info(
        `[MarketStream] Warning: Use case '${useCase}' is designated for '${decision.protocol}'. Subscribing on demand.`
      );
    }
  }

  upstoxWsStreamingService.subscribe(instrumentKeys, mode as UpstoxFeedMode);

  res.json({
    success: true,
    message: `Subscribed to ${instrumentKeys.length} instruments`,
    data: {
      subscribed: instrumentKeys,
      mode,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

router.post("/unsubscribe", (req: Request, res: Response) => {
  const { instrumentKeys } = req.body || {};

  if (!Array.isArray(instrumentKeys) || instrumentKeys.length === 0) {
    res.status(400).json({
      success: false,
      error: {
        error_code: "INVALID_INSTRUMENTS",
        message: "instrumentKeys must be an array of strings",
        retryable: false,
      },
    });
    return;
  }

  upstoxWsStreamingService.unsubscribe(instrumentKeys);

  res.json({
    success: true,
    message: `Unsubscribed from ${instrumentKeys.length} instruments`,
    meta: { timestamp: new Date().toISOString() },
  });
});

// ─── 5. Hot Cache Quote Lookup ────────────────────────────────────────────────

router.get("/quote/:instrumentKey", (req: Request, res: Response) => {
  const key = decodeURIComponent(req.params.instrumentKey);
  const tick = upstoxWsStreamingService.getLatestTick(key);
  const quote = upstoxWsStreamingService.getLatestQuote(key);
  const greeks = upstoxWsStreamingService.getLatestGreeks(key);

  if (!tick && !quote) {
    res.status(404).json({
      success: false,
      error: {
        error_code: "TICK_NOT_CACHED",
        message: `No active streaming tick cached for ${key}. Subscribe first or use REST endpoint.`,
        retryable: true,
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      tick,
      quote,
      greeks,
    },
    meta: {
      timestamp: new Date().toISOString(),
      source: "HOT_MEMORY_STREAM",
    },
  });
});

// ─── 6. Client SSE Stream ─────────────────────────────────────────────────────

router.get("/sse", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const symbolsParam = (req.query.symbols as string) || "";
  const filterSymbols = new Set(
    symbolsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );

  // Send initial connection event
  res.write(
    `data: ${JSON.stringify({
      type: "CONNECTED",
      timestamp: new Date().toISOString(),
      symbols: Array.from(filterSymbols),
    })}\n\n`
  );

  const tickHandler = (tick: UpstoxLiveTick) => {
    if (filterSymbols.size === 0 || filterSymbols.has(tick.instrumentKey)) {
      res.write(`data: ${JSON.stringify({ type: "TICK", data: tick })}\n\n`);
    }
  };

  upstoxWsStreamingService.on("tick", tickHandler);

  // Keep-alive heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat ${Date.now()}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
    upstoxWsStreamingService.off("tick", tickHandler);
    res.end();
  });
});

export default router;
