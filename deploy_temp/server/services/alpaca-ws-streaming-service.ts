/**
 * Alpaca Data WebSocket Streaming Service
 * ─────────────────────────────────────────
 * Connects to wss://stream.data.alpaca.markets/v2/{feed} for real-time
 * stock trades, quotes, and minute bars.
 *
 * Sandbox: wss://stream.data.sandbox.alpaca.markets/v2/iex
 * Live:    wss://stream.data.alpaca.markets/v2/sip
 *
 * Auth: { "action": "auth", "key": "KEY", "secret": "SECRET" }
 * Sub:  { "action": "subscribe", "trades": ["AAPL"], "quotes": ["AAPL"], "bars": ["*"] }
 *
 * Replaces the legacy Polygon massive-websocket-service.
 * Exposes the same interface so all routes continue to work unchanged.
 */

import WebSocket from "ws";
import { EventEmitter } from "events";
import { logger } from "../logger";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface LiveTrade {
  symbol: string;
  price: number;
  size: number;
  timestamp: string;
  exchange: string;
  conditions: string[];
  tape: string;
}

export interface LiveQuote {
  symbol: string;
  askPrice: number;
  askSize: number;
  bidPrice: number;
  bidSize: number;
  timestamp: string;
  conditions: string[];
  tape: string;
}

export interface LiveBar {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  tradeCount: number;
  timestamp: string;
}

// ─── Alpaca WS Feed URLs ────────────────────────────────────────────────────────

const ALPACA_DATA_WS_LIVE    = "wss://stream.data.alpaca.markets";
const ALPACA_DATA_WS_SANDBOX = "wss://stream.data.sandbox.alpaca.markets";

// ─── Service ──────────────────────────────────────────────────────────────────

class AlpacaWsStreamingService extends EventEmitter {
  private ws: WebSocket | null = null;
  private authenticated = false;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnects = 10;
  private reconnectDelay = 2_000;

  private subscribedTrades  = new Set<string>();
  private subscribedQuotes  = new Set<string>();
  private subscribedBars    = new Set<string>();

  private latestTrades = new Map<string, LiveTrade>();
  private latestQuotes = new Map<string, LiveQuote>();
  private latestBars   = new Map<string, LiveBar>();

  // ─── Credentials / Config ──────────────────────────────────────────────────

  private get apiKey():    string { return process.env.ALPACA_API_KEY    || ""; }
  private get secretKey(): string { return process.env.ALPACA_SECRET_KEY || ""; }

  private get isSandbox(): boolean {
    const base = process.env.ALPACA_BASE_URL || "";
    return base.includes("sandbox") || !base.includes("broker-api.alpaca.markets");
  }

  private get feed(): "iex" | "sip" {
    return this.isSandbox ? "iex" : "sip";
  }

  private get wsUrl(): string {
    const base = this.isSandbox ? ALPACA_DATA_WS_SANDBOX : ALPACA_DATA_WS_LIVE;
    return `${base}/v2/${this.feed}`;
  }

  isConfigured(): boolean {
    return !!(this.apiKey && this.secretKey);
  }

  isConnected(): boolean {
    return this.connected && this.authenticated;
  }

  getStatus() {
    return {
      configured:         this.isConfigured(),
      connected:          this.connected,
      authenticated:      this.authenticated,
      feed:               this.feed,
      wsUrl:              this.wsUrl,
      reconnectAttempts:  this.reconnectAttempts,
      subscribedTrades:   [...this.subscribedTrades],
      subscribedQuotes:   [...this.subscribedQuotes],
      subscribedBars:     [...this.subscribedBars],
      dataSource:         "Alpaca Data WebSocket",
    };
  }

  // ─── Connect / Disconnect ──────────────────────────────────────────────────

  connect(_feed?: string): void {
    if (!this.isConfigured()) {
      logger.warn("[AlpacaWS] Not configured — set ALPACA_API_KEY / ALPACA_SECRET_KEY");
      return;
    }
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      logger.info("[AlpacaWS] Already connected");
      return;
    }

    logger.info(`[AlpacaWS] Connecting to ${this.wsUrl}`);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.on("open", () => {
      this.connected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 2_000;
      logger.info("[AlpacaWS] Connection opened — authenticating...");
      this.ws!.send(JSON.stringify({ action: "auth", key: this.apiKey, secret: this.secretKey }));
    });

    this.ws.on("message", (raw: Buffer) => {
      try {
        const messages: any[] = JSON.parse(raw.toString());
        for (const msg of messages) {
          this.handleMessage(msg);
        }
      } catch (err: any) {
        logger.warn(`[AlpacaWS] Failed to parse message: ${err.message}`);
      }
    });

    this.ws.on("close", (code, reason) => {
      this.connected = false;
      this.authenticated = false;
      logger.info(`[AlpacaWS] Disconnected (code: ${code})`);
      this.emit("disconnected", { code });
      this.scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      logger.error(`[AlpacaWS] Error: ${err.message}`);
      this.emit("error", err);
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.connected = false;
    this.authenticated = false;
    this.reconnectAttempts = 0;
    logger.info("[AlpacaWS] Disconnected (manual)");
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnects) {
      logger.warn("[AlpacaWS] Max reconnects reached — giving up");
      return;
    }
    const delay = Math.min(this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    logger.info(`[AlpacaWS] Reconnecting in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  // ─── Message Handling ──────────────────────────────────────────────────────

  private handleMessage(msg: any): void {
    const T = msg.T;

    if (T === "success") {
      if (msg.msg === "authenticated") {
        this.authenticated = true;
        logger.info("[AlpacaWS] Authenticated — resubscribing...");
        this.emit("authenticated");
        this.resubscribeAll();
      } else if (msg.msg === "connected") {
        logger.info("[AlpacaWS] Connected to Alpaca stream");
      }
      return;
    }

    if (T === "error") {
      logger.error(`[AlpacaWS] Stream error: ${msg.msg} (code: ${msg.code})`);
      this.emit("streamError", msg);
      return;
    }

    if (T === "subscription") {
      logger.info(`[AlpacaWS] Subscription confirmed: trades=${msg.trades?.length || 0} quotes=${msg.quotes?.length || 0} bars=${msg.bars?.length || 0}`);
      return;
    }

    if (T === "t") {
      const trade: LiveTrade = {
        symbol:     msg.S,
        price:      msg.p,
        size:       msg.s,
        timestamp:  msg.t,
        exchange:   msg.x || "",
        conditions: msg.c || [],
        tape:       msg.z || "",
      };
      this.latestTrades.set(msg.S, trade);
      this.emit("trade", trade);
      return;
    }

    if (T === "q") {
      const quote: LiveQuote = {
        symbol:     msg.S,
        askPrice:   msg.ap,
        askSize:    msg.as,
        bidPrice:   msg.bp,
        bidSize:    msg.bs,
        timestamp:  msg.t,
        conditions: msg.c || [],
        tape:       msg.z || "",
      };
      this.latestQuotes.set(msg.S, quote);
      this.emit("quote", quote);
      return;
    }

    if (T === "b" || T === "d" || T === "u") {
      const bar: LiveBar = {
        symbol:     msg.S,
        open:       msg.o,
        high:       msg.h,
        low:        msg.l,
        close:      msg.c,
        volume:     msg.v,
        vwap:       msg.vw,
        tradeCount: msg.n,
        timestamp:  msg.t,
      };
      this.latestBars.set(msg.S, bar);
      this.emit("bar", bar);
      return;
    }
  }

  // ─── Subscriptions ─────────────────────────────────────────────────────────

  private send(payload: object): void {
    if (this.ws && this.authenticated && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private resubscribeAll(): void {
    if (this.subscribedTrades.size === 0 && this.subscribedQuotes.size === 0 && this.subscribedBars.size === 0) return;
    this.send({
      action: "subscribe",
      trades: [...this.subscribedTrades],
      quotes: [...this.subscribedQuotes],
      bars:   [...this.subscribedBars],
    });
  }

  subscribeTrades(symbols: string[]): void {
    symbols.forEach(s => this.subscribedTrades.add(s.toUpperCase()));
    this.send({ action: "subscribe", trades: symbols.map(s => s.toUpperCase()) });
  }

  subscribeQuotes(symbols: string[]): void {
    symbols.forEach(s => this.subscribedQuotes.add(s.toUpperCase()));
    this.send({ action: "subscribe", quotes: symbols.map(s => s.toUpperCase()) });
  }

  subscribeMinuteAggs(symbols: string[]): void {
    symbols.forEach(s => this.subscribedBars.add(s.toUpperCase()));
    this.send({ action: "subscribe", bars: symbols.map(s => s.toUpperCase()) });
  }

  subscribeSecondAggs(symbols: string[]): void {
    this.subscribeMinuteAggs(symbols);
  }

  subscribeAll(symbols: string[]): void {
    this.subscribeTrades(symbols);
    this.subscribeQuotes(symbols);
    this.subscribeMinuteAggs(symbols);
  }

  unsubscribeTrades(symbols: string[]): void {
    symbols.forEach(s => this.subscribedTrades.delete(s.toUpperCase()));
    this.send({ action: "unsubscribe", trades: symbols.map(s => s.toUpperCase()) });
  }

  unsubscribeQuotes(symbols: string[]): void {
    symbols.forEach(s => this.subscribedQuotes.delete(s.toUpperCase()));
    this.send({ action: "unsubscribe", quotes: symbols.map(s => s.toUpperCase()) });
  }

  unsubscribeMinuteAggs(symbols: string[]): void {
    symbols.forEach(s => this.subscribedBars.delete(s.toUpperCase()));
    this.send({ action: "unsubscribe", bars: symbols.map(s => s.toUpperCase()) });
  }

  unsubscribeAll(symbols: string[]): void {
    this.unsubscribeTrades(symbols);
    this.unsubscribeQuotes(symbols);
    this.unsubscribeMinuteAggs(symbols);
  }

  // ─── Latest Data Accessors ─────────────────────────────────────────────────

  getLatestTrade(symbol: string): LiveTrade | null {
    return this.latestTrades.get(symbol.toUpperCase()) ?? null;
  }

  getLatestQuote(symbol: string): LiveQuote | null {
    return this.latestQuotes.get(symbol.toUpperCase()) ?? null;
  }

  getLatestAgg(symbol: string): LiveBar | null {
    return this.latestBars.get(symbol.toUpperCase()) ?? null;
  }

  getAllLatestTrades(): Record<string, LiveTrade> {
    return Object.fromEntries(this.latestTrades);
  }

  getAllLatestQuotes(): Record<string, LiveQuote> {
    return Object.fromEntries(this.latestQuotes);
  }

  getAllLatestBars(): Record<string, LiveBar> {
    return Object.fromEntries(this.latestBars);
  }
}

export const alpacaWsStreamingService = new AlpacaWsStreamingService();
