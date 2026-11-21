/**
 * market-data-decision-matrix.test.ts
 *
 * Tests for Market Data Decision Matrix & Upstox V3 WebSocket Streaming Service.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  MarketDataDecisionEngine,
  MARKET_DATA_DECISION_MATRIX,
  type MarketDataUseCase,
} from "../services/market-data-decision-matrix";
import { upstoxWsStreamingService } from "../services/upstox-ws-streaming-service";
import protobuf from "protobufjs";
import path from "path";

describe("Market Data Decision Matrix — Architecture & Rules", () => {
  it("defines all 7 critical FintekPro use cases in the decision matrix", () => {
    const useCases: MarketDataUseCase[] = [
      "DAILY_MARKET_BRIEF_EOD",
      "STOCK_SCREENER_FUNDAMENTALS",
      "TREASURY_BOND_YIELDS",
      "UNLISTED_VALUATION",
      "MODEL_PORTFOLIO_REBALANCING",
      "LIVE_WATCHLIST",
      "LIVE_OPTION_CHAIN",
    ];

    for (const uc of useCases) {
      expect(MARKET_DATA_DECISION_MATRIX[uc]).toBeDefined();
      expect(MARKET_DATA_DECISION_MATRIX[uc].useCase).toBe(uc);
      expect(MARKET_DATA_DECISION_MATRIX[uc].targetLatencyMs).toBeGreaterThan(0);
      expect(MARKET_DATA_DECISION_MATRIX[uc].rationale.length).toBeGreaterThan(10);
    }
  });

  it("assigns REST_BATCH to batch and snapshot use cases", () => {
    expect(MarketDataDecisionEngine.shouldUseWebSocket("DAILY_MARKET_BRIEF_EOD")).toBe(false);
    expect(MarketDataDecisionEngine.shouldUseWebSocket("STOCK_SCREENER_FUNDAMENTALS")).toBe(false);
    expect(MarketDataDecisionEngine.shouldUseWebSocket("TREASURY_BOND_YIELDS")).toBe(false);
    expect(MarketDataDecisionEngine.shouldUseWebSocket("UNLISTED_VALUATION")).toBe(false);
  });

  it("assigns STREAMING_WEBSOCKET to real-time low-latency use cases", () => {
    expect(MarketDataDecisionEngine.shouldUseWebSocket("LIVE_WATCHLIST")).toBe(true);
    expect(MarketDataDecisionEngine.shouldUseWebSocket("LIVE_OPTION_CHAIN")).toBe(true);
    expect(MarketDataDecisionEngine.shouldUseWebSocket("MODEL_PORTFOLIO_REBALANCING")).toBe(true);
  });

  it("provides explainability metadata compliance with FASP-AI and GCR v1.0", () => {
    const meta = MarketDataDecisionEngine.getMetadata();
    expect(meta.engine_version).toContain("market-data-decision-matrix");
    expect(meta.calculation_timestamp).toBeDefined();
    expect(meta.standards).toContain("FASP-AI v1.0");
    expect(meta.standards).toContain("GCR v1.0");
  });
});

describe("Upstox V3 Streaming Service — Subscriptions & Ingestion", () => {
  it("initializes and reports initial streaming service status", () => {
    const status = upstoxWsStreamingService.getStatus();
    expect(status.dataSource).toBe("Upstox V3 Market Data WebSocket");
    expect(status.timestamp).toBeDefined();
    expect(typeof status.connected).toBe("boolean");
    expect(typeof status.subscriptionsCount).toBe("number");
  });

  it("queues subscriptions cleanly and tracks instrument keys", () => {
    const testKeys = ["NSE_INDEX|Nifty 50", "NSE_INDEX|Nifty Bank", "NSE_EQ|INE002A01018"];
    upstoxWsStreamingService.subscribe(testKeys, "ltpc");

    const status = upstoxWsStreamingService.getStatus();
    expect(status.subscriptionsCount).toBeGreaterThanOrEqual(3);

    const keysInStatus = status.subscribedInstruments.map((s) => s.key);
    expect(keysInStatus).toContain("NSE_INDEX|Nifty 50");
    expect(keysInStatus).toContain("NSE_INDEX|Nifty Bank");
    expect(keysInStatus).toContain("NSE_EQ|INE002A01018");

    // Clean up
    upstoxWsStreamingService.unsubscribe(["NSE_EQ|INE002A01018"]);
    const updatedStatus = upstoxWsStreamingService.getStatus();
    const updatedKeys = updatedStatus.subscribedInstruments.map((s) => s.key);
    expect(updatedKeys).not.toContain("NSE_EQ|INE002A01018");
  });

  it("decodes simulated Protobuf FeedResponse buffer and caches ticks", async () => {
    const protoPath = path.resolve(__dirname, "../proto/MarketDataFeedV3.proto");
    const root = await protobuf.load(protoPath);
    const FeedResponseType = root.lookupType(
      "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse"
    );

    const mockFeed = {
      type: 1, // live_feed
      currentTs: Date.now(),
      feeds: {
        "NSE_INDEX|Nifty 50": {
          ltpc: {
            ltp: 24350.75,
            ltt: Date.now(),
            ltq: 50,
            cp: 24200.0,
          },
        },
      },
    };

    const buffer = Buffer.from(FeedResponseType.encode(FeedResponseType.create(mockFeed)).finish());

    let tickEmitted: any = null;
    const tickListener = (t: any) => {
      if (t.instrumentKey === "NSE_INDEX|Nifty 50") {
        tickEmitted = t;
      }
    };

    upstoxWsStreamingService.on("tick", tickListener);
    upstoxWsStreamingService.handleBinaryMessage(buffer);
    upstoxWsStreamingService.off("tick", tickListener);

    expect(tickEmitted).toBeDefined();
    expect(tickEmitted?.instrumentKey).toBe("NSE_INDEX|Nifty 50");
    expect(tickEmitted?.ltp).toBe(24350.75);
    expect(tickEmitted?.change).toBe(150.75);
    expect(tickEmitted?.changePercent).toBeCloseTo(0.62, 1);

    // Verify cache query
    const cached = upstoxWsStreamingService.getLatestTick("NSE_INDEX|Nifty 50");
    expect(cached).toBeDefined();
    expect(cached?.ltp).toBe(24350.75);
  });
});
