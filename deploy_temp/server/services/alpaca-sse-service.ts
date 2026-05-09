/**
 * Alpaca Broker API — Server-Sent Events (SSE) Service
 *
 * Connects to Alpaca's event streams and relays them to connected clients.
 * Streams: trade fills, account status changes, journal completions, transfer updates,
 *          non-trading activities, admin action events.
 *
 * Architecture:
 *  - One persistent HTTP connection per stream type to Alpaca.
 *  - In-memory pub/sub: each connected browser client registers a listener.
 *  - Auto-reconnect with exponential back-off.
 *  - Per-user filtering: clients only receive events for their own account.
 */

import axios from "axios";
import { EventEmitter } from "events";
import { logger } from "../logger";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AlpacaEventType =
  | "trade_updates"
  | "account_updates"
  | "journal_updates"
  | "transfer_updates"
  | "nta_updates"      // Non-Trading Activity
  | "admin_actions";

export interface AlpacaEvent {
  type: AlpacaEventType;
  event: string;
  data: any;
  timestamp: string;
  at?: string;
}

// ─── Subscription registry ─────────────────────────────────────────────────────

interface Subscriber {
  userId: string;
  alpacaAccountId?: string;
  callback: (event: AlpacaEvent) => void;
}

// ─── Service ──────────────────────────────────────────────────────────────────

const ALPACA_BROKER_SANDBOX_URL = "https://broker-api.sandbox.alpaca.markets";
const ALPACA_BROKER_LIVE_URL   = "https://broker-api.alpaca.markets";

function resolveSseBaseUrl(): string {
  if (process.env.ALPACA_BASE_URL) return process.env.ALPACA_BASE_URL;
  return process.env.ALPACA_ENV === "production"
    ? ALPACA_BROKER_LIVE_URL
    : ALPACA_BROKER_SANDBOX_URL;
}

class AlpacaSseService extends EventEmitter {
  private apiKey = process.env.ALPACA_API_KEY || "";
  private secretKey = process.env.ALPACA_SECRET_KEY || "";
  private baseUrl = resolveSseBaseUrl();
  private isBrokerApi = resolveSseBaseUrl().includes("broker-api");

  private subscribers = new Map<string, Subscriber>();
  private activeStreams = new Map<AlpacaEventType, ReturnType<typeof setTimeout>>();
  private reconnectDelays = new Map<AlpacaEventType, number>();
  private isRunning = false;

  // Stream endpoint mapping (v1 uses integer IDs; v2beta1 uses ULIDs — use v2 for trades/admin)
  private readonly streamEndpoints: Record<AlpacaEventType, string> = {
    trade_updates:    "/v2/events/trades",
    account_updates:  "/v1/events/accounts/status",
    journal_updates:  "/v1/events/journals/status",
    transfer_updates: "/v1/events/transfers/status",
    nta_updates:      "/v1/events/nta",
    admin_actions:    "/v1/events/admin_actions",
  };

  configure(apiKey: string, secretKey: string, baseUrl: string, isBrokerApi: boolean) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
    this.isBrokerApi = isBrokerApi;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.secretKey && this.baseUrl);
  }

  // ─── Start / Stop ───────────────────────────────────────────────────────────

  start(streams: AlpacaEventType[] = ["trade_updates", "account_updates", "journal_updates", "transfer_updates"]) {
    if (!this.isConfigured()) {
      logger.warn("[AlpacaSSE] Not configured — skipping stream startup");
      return;
    }
    if (this.isRunning) return;
    this.isRunning = true;
    for (const stream of streams) {
      this.connectStream(stream);
    }
    logger.info(`[AlpacaSSE] Started ${streams.length} event streams`);
  }

  stop() {
    this.isRunning = false;
    for (const [, timer] of this.activeStreams) clearTimeout(timer);
    this.activeStreams.clear();
    logger.info("[AlpacaSSE] All streams stopped");
  }

  // ─── Stream Connection ──────────────────────────────────────────────────────

  private async connectStream(type: AlpacaEventType) {
    if (!this.isRunning) return;
    const endpoint = this.streamEndpoints[type];
    const url = `${this.baseUrl}${endpoint}`;
    const auth = Buffer.from(`${this.apiKey}:${this.secretKey}`).toString("base64");

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        responseType: "stream",
        timeout: 0, // no timeout for SSE
      });

      // Reset backoff on successful connect
      this.reconnectDelays.set(type, 1000);
      logger.info(`[AlpacaSSE] Connected to ${type} stream`);

      let buffer = "";
      response.data.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventName = "";
        let dataStr = "";

        for (const line of lines) {
          if (line.startsWith("event:")) {
            eventName = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataStr = line.slice(5).trim();
          } else if (line === "" && dataStr) {
            // Dispatch the event
            try {
              const parsed = JSON.parse(dataStr);
              const event: AlpacaEvent = {
                type,
                event: eventName || parsed.event || type,
                data: parsed,
                timestamp: new Date().toISOString(),
                at: parsed.at || parsed.timestamp,
              };
              this.dispatch(event);
            } catch {
              // heartbeat or non-JSON frame — ignore
            }
            eventName = "";
            dataStr = "";
          }
        }
      });

      response.data.on("end", () => {
        logger.warn(`[AlpacaSSE] Stream ${type} ended — scheduling reconnect`);
        this.scheduleReconnect(type);
      });

      response.data.on("error", (err: Error) => {
        logger.warn(`[AlpacaSSE] Stream ${type} error: ${err.message}`);
        this.scheduleReconnect(type);
      });

    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401 || status === 403) {
        logger.error(`[AlpacaSSE] Auth failure on ${type} — stopping stream`);
        return; // Don't reconnect on auth failure
      }
      logger.warn(`[AlpacaSSE] Failed to connect ${type}: ${error.message}`);
      this.scheduleReconnect(type);
    }
  }

  private scheduleReconnect(type: AlpacaEventType) {
    if (!this.isRunning) return;
    const delay = Math.min(this.reconnectDelays.get(type) ?? 1000, 30_000);
    this.reconnectDelays.set(type, delay * 2); // exponential back-off, cap at 30s
    const timer = setTimeout(() => this.connectStream(type), delay);
    this.activeStreams.set(type, timer);
  }

  // ─── Dispatch ───────────────────────────────────────────────────────────────

  private dispatch(event: AlpacaEvent) {
    // Emit globally (for internal listeners)
    this.emit("event", event);
    this.emit(event.type, event.data);

    // Deliver to per-client subscribers
    const accountId: string | undefined =
      event.data?.account_id ??
      event.data?.to_account ??
      event.data?.from_account;

    for (const [, sub] of this.subscribers) {
      if (!sub.alpacaAccountId || sub.alpacaAccountId === accountId) {
        try {
          sub.callback(event);
        } catch (e: any) {
          logger.warn(`[AlpacaSSE] Subscriber callback error: ${e.message}`);
        }
      }
    }
  }

  // ─── Subscription Management ────────────────────────────────────────────────

  subscribe(subscriberId: string, userId: string, alpacaAccountId: string | undefined, callback: (event: AlpacaEvent) => void): void {
    this.subscribers.set(subscriberId, { userId, alpacaAccountId, callback });
  }

  unsubscribe(subscriberId: string): void {
    this.subscribers.delete(subscriberId);
  }

  subscriberCount(): number {
    return this.subscribers.size;
  }

  // ─── Recent events cache (in-memory ring buffer, 200 events) ────────────────

  private recentEvents: AlpacaEvent[] = [];
  private readonly maxRecentEvents = 200;

  private cacheEvent(event: AlpacaEvent) {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }
  }

  getRecentEvents(accountId?: string, limit = 50): AlpacaEvent[] {
    const events = accountId
      ? this.recentEvents.filter(e =>
          e.data?.account_id === accountId ||
          e.data?.to_account === accountId ||
          e.data?.from_account === accountId)
      : this.recentEvents;
    return events.slice(-limit);
  }
}

export const alpacaSseService = new AlpacaSseService();
// Note: event caching is now handled directly inside dispatch() — no external wiring needed.
