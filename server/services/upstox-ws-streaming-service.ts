/**
 * upstox-ws-streaming-service.ts
 *
 * Upstox Market Data V3 WebSocket Streaming Service — FASP-AI & GCR v1.0.
 *
 * Purpose:
 *   Connects to Upstox V3 Market Data Feed (wss://api.upstox.com/v3/feed/market-data-feed)
 *   using Google Protocol Buffers (MarketDataFeedV3.proto) for sub-100ms real-time ticks,
 *   market depth, and live Option Greeks (Delta, Theta, Gamma, Vega, Rho, IV).
 *
 * Architecture:
 *   1. Auth: Uses Upstox V3 Authorize endpoint or Bearer token
 *   2. Ingestion: Binary Protobuf decoding using protobufjs
 *   3. Hot Cache: In-memory Map for O(1) instantaneous quote lookups
 *   4. Golden Tick Layer: Writes latest ticks to shared Redis (if configured)
 *   5. Fan-out: Emits events for SSE and internal execution engines
 *
 * @module upstox-ws-streaming-service
 * @version 1.0.0
 */

import WebSocket from "ws";
import { EventEmitter } from "events";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import protobuf from "protobufjs";
import { logger } from "../logger";
import { upstoxAdapter } from "./mpal/adapters/upstoxAdapter";
import { getSharedRedis } from "../utils/redis-client";

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface UpstoxLiveTick {
  instrumentKey: string;
  ltp: number;
  cp?: number;
  change?: number;
  changePercent?: number;
  ltt?: number; // Last traded timestamp
  ltq?: number; // Last traded quantity
  timestamp: string;
  dataSource: "UPSTOX_WS_V3";
}

export interface UpstoxLiveDepthQuote {
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
}

export interface UpstoxLiveOptionGreeks {
  instrumentKey: string;
  delta: number;
  theta: number;
  gamma: number;
  vega: number;
  rho: number;
  iv?: number;
  oi?: number;
  vtt?: number; // volume traded today
  timestamp: string;
}

export interface UpstoxLiveFullQuote extends UpstoxLiveTick {
  atp?: number; // average traded price
  vtt?: number; // volume traded today
  oi?: number;  // open interest
  iv?: number;  // implied volatility
  tbq?: number; // total buy quantity
  tsq?: number; // total sell quantity
  depth?: UpstoxLiveDepthQuote[];
  greeks?: UpstoxLiveOptionGreeks;
}

export type UpstoxFeedMode = "ltpc" | "full" | "option_greeks";

// ─── Service ───────────────────────────────────────────────────────────────────

class UpstoxWsStreamingService extends EventEmitter {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnects = 10;
  private reconnectDelay = 2000;

  private protobufRoot: protobuf.Root | null = null;
  private feedResponseType: protobuf.Type | null = null;

  private subscribedInstruments = new Map<string, UpstoxFeedMode>();
  private latestTicks = new Map<string, UpstoxLiveTick>();
  private latestQuotes = new Map<string, UpstoxLiveFullQuote>();
  private latestGreeks = new Map<string, UpstoxLiveOptionGreeks>();

  constructor() {
    super();
    this.initProtobuf();
  }

  // ─── Protobuf Initialization ────────────────────────────────────────────────

  private async initProtobuf(): Promise<void> {
    try {
      const possiblePaths = [
        path.resolve(process.cwd(), "server/proto/MarketDataFeedV3.proto"),
        path.resolve(process.cwd(), "dist/proto/MarketDataFeedV3.proto"),
        path.resolve(process.cwd(), "proto/MarketDataFeedV3.proto"),
      ];
      try {
        if (typeof import.meta !== "undefined" && import.meta.url) {
          const currentFile = fileURLToPath(import.meta.url);
          possiblePaths.unshift(path.resolve(path.dirname(currentFile), "../proto/MarketDataFeedV3.proto"));
          possiblePaths.unshift(path.resolve(path.dirname(currentFile), "./proto/MarketDataFeedV3.proto"));
        }
      } catch {
        /* ignore import.meta fallback */
      }
      const protoPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];
      const root = await protobuf.load(protoPath);
      this.protobufRoot = root;
      this.feedResponseType = root.lookupType(
        "com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse"
      );
      logger.info("[UpstoxWS] Protobuf definitions loaded successfully", { protoPath });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[UpstoxWS] Failed to load Protobuf schema: ${msg}`);
    }
  }

  // ─── Status & Config ────────────────────────────────────────────────────────

  isConfigured(): boolean {
    return !!(
      process.env.UPSTOX_ACCESS_TOKEN ||
      process.env.UPSTOX_API_KEY ||
      upstoxAdapter.isConfigured()
    );
  }

  isConnected(): boolean {
    return this.connected && (this.ws !== null && this.ws.readyState === WebSocket.OPEN);
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      connected: this.isConnected(),
      authenticated: this.authenticated,
      reconnectAttempts: this.reconnectAttempts,
      subscriptionsCount: this.subscribedInstruments.size,
      cachedTicksCount: this.latestTicks.size,
      cachedGreeksCount: this.latestGreeks.size,
      subscribedInstruments: Array.from(this.subscribedInstruments.entries()).map(
        ([key, mode]) => ({ key, mode })
      ),
      dataSource: "Upstox V3 Market Data WebSocket",
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Connect / Disconnect ──────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn("[UpstoxWS] Not configured — UPSTOX_ACCESS_TOKEN or API key missing");
      return;
    }

    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING)
    ) {
      logger.info("[UpstoxWS] Already connected or connecting");
      return;
    }

    try {
      let wsUrl = "wss://api.upstox.com/v3/feed/market-data-feed";
      const token = process.env.UPSTOX_ACCESS_TOKEN || "";

      // Attempt official authorized redirect URI if token is present
      try {
        const authRes = await upstoxAdapter.getMarketDataWsAuth();
        if (authRes?.authorizedRedirectUri) {
          wsUrl = authRes.authorizedRedirectUri;
          logger.info("[UpstoxWS] Obtained signed authorized WebSocket URI");
        }
      } catch (authErr: unknown) {
        logger.warn("[UpstoxWS] Authorized URI lookup failed, falling back to direct endpoint with Bearer auth");
      }

      logger.info(`[UpstoxWS] Connecting to WebSocket stream...`);
      this.ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        followRedirects: true,
      });

      this.ws.on("open", () => {
        this.connected = true;
        this.authenticated = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 2000;
        logger.info("[UpstoxWS] Connection established — resubscribing instruments...");
        this.emit("connected");
        this.resubscribeAll();
      });

      this.ws.on("message", (raw: Buffer) => {
        this.handleBinaryMessage(raw);
      });

      this.ws.on("close", (code: number, reason: Buffer) => {
        this.connected = false;
        this.authenticated = false;
        logger.info(`[UpstoxWS] Disconnected (code: ${code}, reason: ${reason?.toString() || "none"})`);
        this.emit("disconnected", { code, reason: reason?.toString() });
        this.scheduleReconnect();
      });

      this.ws.on("error", (err: Error) => {
        logger.error(`[UpstoxWS] Socket error: ${err.message}`);
        this.emit("error", err);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[UpstoxWS] Failed to initiate connection: ${msg}`);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, "Normal termination");
      this.ws = null;
    }
    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    logger.info("[UpstoxWS] Disconnected cleanly");
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnects) {
      logger.warn("[UpstoxWS] Max reconnect attempts reached — pausing backoff");
      return;
    }
    const delay = Math.min(this.reconnectDelay * 1.5 ** this.reconnectAttempts, 30000);
    this.reconnectAttempts++;
    logger.info(`[UpstoxWS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // ─── Subscriptions ──────────────────────────────────────────────────────────

  subscribe(instrumentKeys: string[], mode: UpstoxFeedMode = "ltpc"): void {
    if (!instrumentKeys || instrumentKeys.length === 0) return;

    for (const key of instrumentKeys) {
      this.subscribedInstruments.set(key, mode);
    }

    if (!this.isConnected()) {
      logger.info(`[UpstoxWS] Queued ${instrumentKeys.length} subscriptions (socket not connected yet)`);
      return;
    }

    const payload = {
      guid: `sub-${Date.now()}`,
      method: "sub",
      data: {
        mode,
        instrumentKeys,
      },
    };

    try {
      this.ws!.send(Buffer.from(JSON.stringify(payload)));
      logger.info(`[UpstoxWS] Subscribed ${instrumentKeys.length} instruments (mode: ${mode})`);
    } catch (err: unknown) {
      logger.error(`[UpstoxWS] Error sending subscription request: ${err}`);
    }
  }

  unsubscribe(instrumentKeys: string[]): void {
    if (!instrumentKeys || instrumentKeys.length === 0) return;

    for (const key of instrumentKeys) {
      this.subscribedInstruments.delete(key);
    }

    if (!this.isConnected()) return;

    const payload = {
      guid: `unsub-${Date.now()}`,
      method: "unsub",
      data: {
        instrumentKeys,
      },
    };

    try {
      this.ws!.send(Buffer.from(JSON.stringify(payload)));
      logger.info(`[UpstoxWS] Unsubscribed ${instrumentKeys.length} instruments`);
    } catch (err: unknown) {
      logger.error(`[UpstoxWS] Error sending unsubscription: ${err}`);
    }
  }

  private resubscribeAll(): void {
    if (this.subscribedInstruments.size === 0) return;

    const byMode: Record<UpstoxFeedMode, string[]> = {
      ltpc: [],
      full: [],
      option_greeks: [],
    };

    for (const [key, mode] of this.subscribedInstruments.entries()) {
      byMode[mode].push(key);
    }

    for (const mode of Object.keys(byMode) as UpstoxFeedMode[]) {
      if (byMode[mode].length > 0) {
        this.subscribe(byMode[mode], mode);
      }
    }
  }

  // ─── Protobuf Message Parsing ───────────────────────────────────────────────

  public handleBinaryMessage(buffer: Buffer): void {
    if (!this.feedResponseType) {
      logger.warn("[UpstoxWS] Protobuf schema not ready — dropping binary packet");
      return;
    }

    try {
      const decoded: any = this.feedResponseType.decode(buffer);
      const feeds = decoded.feeds || {};
      const timestamp = new Date().toISOString();

      for (const [instrumentKey, feedData] of Object.entries<any>(feeds)) {
        this.processFeedItem(instrumentKey, feedData, timestamp);
      }
    } catch (err: unknown) {
      logger.warn(`[UpstoxWS] Failed to decode Protobuf binary feed: ${err}`);
    }
  }

  private processFeedItem(instrumentKey: string, feed: any, timestamp: string): void {
    let ltp = 0;
    let cp = 0;
    let ltt = 0;
    let ltq = 0;

    // 1. Direct LTPC Feed
    if (feed.ltpc) {
      ltp = feed.ltpc.ltp || 0;
      cp = feed.ltpc.cp || 0;
      ltt = feed.ltpc.ltt || 0;
      ltq = feed.ltpc.ltq || 0;
    }

    // 2. Full Feed (Market or Index)
    let fullQuote: UpstoxLiveFullQuote | null = null;
    if (feed.fullFeed) {
      const mff = feed.fullFeed.marketFF || feed.fullFeed.indexFF;
      if (mff?.ltpc) {
        ltp = mff.ltpc.ltp || ltp;
        cp = mff.ltpc.cp || cp;
        ltt = mff.ltpc.ltt || ltt;
        ltq = mff.ltpc.ltq || ltq;
      }

      fullQuote = {
        instrumentKey,
        ltp,
        cp,
        change: cp > 0 ? Number((ltp - cp).toFixed(2)) : undefined,
        changePercent: cp > 0 ? Number((((ltp - cp) / cp) * 100).toFixed(2)) : undefined,
        ltt,
        ltq,
        timestamp,
        dataSource: "UPSTOX_WS_V3",
        atp: mff?.atp,
        vtt: mff?.vtt,
        oi: mff?.oi,
        iv: mff?.iv,
        tbq: mff?.tbq,
        tsq: mff?.tsq,
      };

      if (mff?.marketLevel?.bidAskQuote) {
        fullQuote.depth = mff.marketLevel.bidAskQuote.map((q: any) => ({
          bidPrice: q.bidP || 0,
          bidQty: q.bidQ || 0,
          askPrice: q.askP || 0,
          askQty: q.askQ || 0,
        }));
      }

      if (mff?.optionGreeks) {
        const og: UpstoxLiveOptionGreeks = {
          instrumentKey,
          delta: mff.optionGreeks.delta || 0,
          theta: mff.optionGreeks.theta || 0,
          gamma: mff.optionGreeks.gamma || 0,
          vega: mff.optionGreeks.vega || 0,
          rho: mff.optionGreeks.rho || 0,
          iv: mff.iv,
          oi: mff.oi,
          vtt: mff.vtt,
          timestamp,
        };
        this.latestGreeks.set(instrumentKey, og);
        fullQuote.greeks = og;
        this.emit("greeks", og);
      }

      this.latestQuotes.set(instrumentKey, fullQuote);
      this.emit("quote", fullQuote);
    }

    // 3. First Level with Greeks
    if (feed.firstLevelWithGreeks) {
      const fl = feed.firstLevelWithGreeks;
      if (fl.ltpc) {
        ltp = fl.ltpc.ltp || ltp;
        cp = fl.ltpc.cp || cp;
        ltt = fl.ltpc.ltt || ltt;
      }
      if (fl.optionGreeks) {
        const og: UpstoxLiveOptionGreeks = {
          instrumentKey,
          delta: fl.optionGreeks.delta || 0,
          theta: fl.optionGreeks.theta || 0,
          gamma: fl.optionGreeks.gamma || 0,
          vega: fl.optionGreeks.vega || 0,
          rho: fl.optionGreeks.rho || 0,
          iv: fl.iv,
          oi: fl.oi,
          vtt: fl.vtt,
          timestamp,
        };
        this.latestGreeks.set(instrumentKey, og);
        this.emit("greeks", og);
      }
    }

    if (ltp > 0) {
      const tick: UpstoxLiveTick = {
        instrumentKey,
        ltp,
        cp,
        change: cp > 0 ? Number((ltp - cp).toFixed(2)) : undefined,
        changePercent: cp > 0 ? Number((((ltp - cp) / cp) * 100).toFixed(2)) : undefined,
        ltt,
        ltq,
        timestamp,
        dataSource: "UPSTOX_WS_V3",
      };

      this.latestTicks.set(instrumentKey, tick);
      this.emit("tick", tick);

      // Async write to Redis golden tick layer (fire-and-forget)
      this.publishToRedis(tick);
    }
  }

  private async publishToRedis(tick: UpstoxLiveTick): Promise<void> {
    try {
      const redis = await getSharedRedis();
      if (!redis) return;
      const key = `market:upstox:ltp:${tick.instrumentKey}`;
      await redis.set(key, JSON.stringify(tick), { EX: 10 }); // 10s TTL
    } catch {
      // Non-blocking
    }
  }

  // ─── Query Accessors ────────────────────────────────────────────────────────

  /**
   * Look up tick by symbol (e.g. "RELIANCE") or full instrument key (e.g. "NSE_EQ|INE002A01018")
   */
  getTick(symbolOrKey: string): UpstoxLiveTick | undefined {
    if (!symbolOrKey) return undefined;
    const clean = symbolOrKey.trim().toUpperCase();

    // 1. Direct match on instrumentKey
    const direct = this.latestTicks.get(clean);
    if (direct) return direct;

    // 2. Prefixed match (NSE_EQ / BSE_EQ / NSE_INDEX)
    const nseEq = this.latestTicks.get(`NSE_EQ|${clean}`);
    if (nseEq) return nseEq;
    const bseEq = this.latestTicks.get(`BSE_EQ|${clean}`);
    if (bseEq) return bseEq;
    const nseIndex = this.latestTicks.get(`NSE_INDEX|${clean}`);
    if (nseIndex) return nseIndex;

    // 3. Match keys ending with |${clean}
    for (const [key, tick] of this.latestTicks.entries()) {
      if (key.endsWith(`|${clean}`)) {
        return tick;
      }
    }

    return undefined;
  }

  getLatestTick(instrumentKey: string): UpstoxLiveTick | undefined {
    return this.latestTicks.get(instrumentKey);
  }

  getLatestQuote(instrumentKey: string): UpstoxLiveFullQuote | undefined {
    return this.latestQuotes.get(instrumentKey);
  }

  getLatestGreeks(instrumentKey: string): UpstoxLiveOptionGreeks | undefined {
    return this.latestGreeks.get(instrumentKey);
  }

  getAllLatestTicks(): UpstoxLiveTick[] {
    return Array.from(this.latestTicks.values());
  }
}

export const upstoxWsStreamingService = new UpstoxWsStreamingService();
