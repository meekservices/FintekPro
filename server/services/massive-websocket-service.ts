import WebSocket from "ws";
import { EventEmitter } from "events";

const MASSIVE_WS_DELAYED = "wss://delayed.massive.com/stocks";
const MASSIVE_WS_REALTIME = "wss://socket.massive.com/stocks";

type FeedType = "delayed" | "realtime";

interface MassiveTradeEvent {
	ev: "T";
	sym: string;
	i: string;
	x: number;
	p: number;
	s: number;
	c: number[];
	t: number;
	q: number;
	z: number;
}

interface MassiveQuoteEvent {
	ev: "Q";
	sym: string;
	bx: number;
	bp: number;
	bs: number;
	ax: number;
	ap: number;
	as: number;
	c: number;
	t: number;
	z: number;
}

interface MassiveAggregateEvent {
	ev: "AM" | "A";
	sym: string;
	v: number;
	av: number;
	op: number;
	vw: number;
	o: number;
	c: number;
	h: number;
	l: number;
	a: number;
	z: number;
	s: number;
	e: number;
}

interface MassiveStatusEvent {
	ev: "status";
	status: string;
	message: string;
}

type MassiveEvent =
	| MassiveTradeEvent
	| MassiveQuoteEvent
	| MassiveAggregateEvent
	| MassiveStatusEvent;

interface SubscriptionState {
	trades: Set<string>;
	quotes: Set<string>;
	minuteAggs: Set<string>;
	secondAggs: Set<string>;
}

class MassiveWebSocketService extends EventEmitter {
	private ws: WebSocket | null = null;
	private apiKey: string;
	private feedType: FeedType;
	private subscriptions: SubscriptionState = {
		trades: new Set(),
		quotes: new Set(),
		minuteAggs: new Set(),
		secondAggs: new Set(),
	};
	private authenticated: boolean = false;
	private connected: boolean = false;
	private reconnectAttempts: number = 0;
	private maxReconnectAttempts: number = 10;
	private reconnectDelay: number = 1000;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private heartbeatTimer: NodeJS.Timeout | null = null;
	private latestQuotes: Map<string, MassiveQuoteEvent> = new Map();
	private latestTrades: Map<string, MassiveTradeEvent> = new Map();
	private latestAggs: Map<string, MassiveAggregateEvent> = new Map();

	constructor() {
		super();
		this.apiKey = process.env.POLYGON_API_KEY || "";
		this.feedType = (process.env.MASSIVE_WS_FEED as FeedType) || "delayed";
	}

	isConfigured(): boolean {
		return !!this.apiKey;
	}

	isConnected(): boolean {
		return this.connected && this.authenticated;
	}

	getStatus(): {
		configured: boolean;
		connected: boolean;
		authenticated: boolean;
		feedType: FeedType;
		subscriptions: {
			trades: string[];
			quotes: string[];
			minuteAggs: string[];
			secondAggs: string[];
		};
		reconnectAttempts: number;
		cachedQuotes: number;
		cachedTrades: number;
		cachedAggs: number;
	} {
		return {
			configured: this.isConfigured(),
			connected: this.connected,
			authenticated: this.authenticated,
			feedType: this.feedType,
			subscriptions: {
				trades: Array.from(this.subscriptions.trades),
				quotes: Array.from(this.subscriptions.quotes),
				minuteAggs: Array.from(this.subscriptions.minuteAggs),
				secondAggs: Array.from(this.subscriptions.secondAggs),
			},
			reconnectAttempts: this.reconnectAttempts,
			cachedQuotes: this.latestQuotes.size,
			cachedTrades: this.latestTrades.size,
			cachedAggs: this.latestAggs.size,
		};
	}

	connect(feed?: FeedType): void {
		if (!this.isConfigured()) {
			console.warn(
				"⚠️ Massive WebSocket: API key not configured (POLYGON_API_KEY)",
			);
			return;
		}

		if (this.ws) {
			this.disconnect();
		}

		if (feed) {
			this.feedType = feed;
		}

		const wsUrl =
			this.feedType === "realtime" ? MASSIVE_WS_REALTIME : MASSIVE_WS_DELAYED;
		console.log(
			`🔌 [Massive WS] Connecting to ${this.feedType} feed: ${wsUrl}`,
		);

		this.ws = new WebSocket(wsUrl);

		this.ws.on("open", () => {
			this.connected = true;
			this.reconnectAttempts = 0;
			console.log(`✅ [Massive WS] Connected to ${this.feedType} feed`);
			this.authenticate();
		});

		this.ws.on("message", (data: WebSocket.Data) => {
			try {
				const messages: MassiveEvent[] = JSON.parse(data.toString());
				this.handleMessages(messages);
			} catch (error) {
				console.error("[Massive WS] Failed to parse message:", error);
			}
		});

		this.ws.on("close", (code: number, reason: Buffer) => {
			this.connected = false;
			this.authenticated = false;
			this.clearHeartbeat();
			console.log(
				`🔌 [Massive WS] Disconnected (code: ${code}, reason: ${reason.toString()})`,
			);
			this.emit("disconnected", { code, reason: reason.toString() });
			this.attemptReconnect();
		});

		this.ws.on("error", (error: Error) => {
			console.error("[Massive WS] Error:", error.message);
			this.emit("error", error);
		});
	}

	private authenticate(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		this.ws.send(
			JSON.stringify({
				action: "auth",
				params: this.apiKey,
			}),
		);
	}

	private handleMessages(messages: MassiveEvent[]): void {
		for (const msg of messages) {
			switch (msg.ev) {
				case "status":
					this.handleStatus(msg);
					break;
				case "T":
					this.latestTrades.set(msg.sym, msg);
					this.emit("trade", msg);
					break;
				case "Q":
					this.latestQuotes.set(msg.sym, msg);
					this.emit("quote", msg);
					break;
				case "AM":
					this.latestAggs.set(msg.sym, msg);
					this.emit("minuteAgg", msg);
					break;
				case "A":
					this.latestAggs.set(msg.sym, msg);
					this.emit("secondAgg", msg);
					break;
				default:
					this.emit("unknown", msg);
			}
		}
	}

	private handleStatus(msg: MassiveStatusEvent): void {
		console.log(`📡 [Massive WS] Status: ${msg.status} - ${msg.message}`);

		if (msg.status === "auth_success") {
			this.authenticated = true;
			console.log("✅ [Massive WS] Authentication successful");
			this.emit("authenticated");
			this.startHeartbeat();
			this.resubscribeAll();
		} else if (msg.status === "auth_failed") {
			this.authenticated = false;
			console.error("❌ [Massive WS] Authentication failed:", msg.message);
			console.log(
				"ℹ️ [Massive WS] WebSocket access requires a paid Massive plan. REST API and Flat Files remain available.",
			);
			this.emit("authFailed", msg.message);
			this.disconnect();
			return;
		} else if (msg.status === "connected") {
			console.log("✅ [Massive WS] Server acknowledged connection");
		} else if (msg.status === "success") {
			this.emit("subscriptionSuccess", msg.message);
		}
	}

	private resubscribeAll(): void {
		const allSubs: string[] = [];

		for (const sym of this.subscriptions.trades) {
			allSubs.push(`T.${sym}`);
		}
		for (const sym of this.subscriptions.quotes) {
			allSubs.push(`Q.${sym}`);
		}
		for (const sym of this.subscriptions.minuteAggs) {
			allSubs.push(`AM.${sym}`);
		}
		for (const sym of this.subscriptions.secondAggs) {
			allSubs.push(`A.${sym}`);
		}

		if (allSubs.length > 0) {
			this.sendSubscribe(allSubs);
			console.log(`🔄 [Massive WS] Resubscribed to ${allSubs.length} channels`);
		}
	}

	private sendSubscribe(params: string[]): void {
		if (
			!this.ws ||
			this.ws.readyState !== WebSocket.OPEN ||
			!this.authenticated
		)
			return;

		this.ws.send(
			JSON.stringify({
				action: "subscribe",
				params: params.join(","),
			}),
		);
	}

	private sendUnsubscribe(params: string[]): void {
		if (
			!this.ws ||
			this.ws.readyState !== WebSocket.OPEN ||
			!this.authenticated
		)
			return;

		this.ws.send(
			JSON.stringify({
				action: "unsubscribe",
				params: params.join(","),
			}),
		);
	}

	subscribeTrades(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.trades.add(s);
			channels.push(`T.${s}`);
		}
		this.sendSubscribe(channels);
		console.log(`📊 [Massive WS] Subscribed to trades: ${symbols.join(", ")}`);
	}

	subscribeQuotes(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.quotes.add(s);
			channels.push(`Q.${s}`);
		}
		this.sendSubscribe(channels);
		console.log(`📊 [Massive WS] Subscribed to quotes: ${symbols.join(", ")}`);
	}

	subscribeMinuteAggs(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.minuteAggs.add(s);
			channels.push(`AM.${s}`);
		}
		this.sendSubscribe(channels);
		console.log(
			`📊 [Massive WS] Subscribed to minute aggregates: ${symbols.join(", ")}`,
		);
	}

	subscribeSecondAggs(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.secondAggs.add(s);
			channels.push(`A.${s}`);
		}
		this.sendSubscribe(channels);
		console.log(
			`📊 [Massive WS] Subscribed to second aggregates: ${symbols.join(", ")}`,
		);
	}

	subscribeAll(symbols: string[]): void {
		this.subscribeTrades(symbols);
		this.subscribeQuotes(symbols);
		this.subscribeMinuteAggs(symbols);
	}

	unsubscribeTrades(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.trades.delete(s);
			channels.push(`T.${s}`);
		}
		this.sendUnsubscribe(channels);
	}

	unsubscribeQuotes(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.quotes.delete(s);
			channels.push(`Q.${s}`);
		}
		this.sendUnsubscribe(channels);
	}

	unsubscribeMinuteAggs(symbols: string[]): void {
		const channels: string[] = [];
		for (const sym of symbols) {
			const s = sym.toUpperCase();
			this.subscriptions.minuteAggs.delete(s);
			channels.push(`AM.${s}`);
		}
		this.sendUnsubscribe(channels);
	}

	unsubscribeAll(symbols: string[]): void {
		this.unsubscribeTrades(symbols);
		this.unsubscribeQuotes(symbols);
		this.unsubscribeMinuteAggs(symbols);
	}

	getLatestQuote(symbol: string): MassiveQuoteEvent | undefined {
		return this.latestQuotes.get(symbol.toUpperCase());
	}

	getLatestTrade(symbol: string): MassiveTradeEvent | undefined {
		return this.latestTrades.get(symbol.toUpperCase());
	}

	getLatestAgg(symbol: string): MassiveAggregateEvent | undefined {
		return this.latestAggs.get(symbol.toUpperCase());
	}

	getAllLatestQuotes(): Record<string, MassiveQuoteEvent> {
		const result: Record<string, MassiveQuoteEvent> = {};
		this.latestQuotes.forEach((v, k) => {
			result[k] = v;
		});
		return result;
	}

	getAllLatestTrades(): Record<string, MassiveTradeEvent> {
		const result: Record<string, MassiveTradeEvent> = {};
		this.latestTrades.forEach((v, k) => {
			result[k] = v;
		});
		return result;
	}

	private startHeartbeat(): void {
		this.clearHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			if (this.ws && this.ws.readyState === WebSocket.OPEN) {
				this.ws.ping();
			}
		}, 30000);
	}

	private clearHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			console.error(
				`❌ [Massive WS] Max reconnect attempts (${this.maxReconnectAttempts}) reached`,
			);
			this.emit("maxReconnectReached");
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(
			this.reconnectDelay * 2 ** (this.reconnectAttempts - 1),
			30000,
		);
		console.log(
			`🔄 [Massive WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
		);

		this.reconnectTimer = setTimeout(() => {
			this.connect();
		}, delay);
	}

	disconnect(): void {
		this.clearHeartbeat();

		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}

		if (this.ws) {
			this.ws.removeAllListeners();
			if (
				this.ws.readyState === WebSocket.OPEN ||
				this.ws.readyState === WebSocket.CONNECTING
			) {
				this.ws.close(1000, "Client disconnect");
			}
			this.ws = null;
		}

		this.connected = false;
		this.authenticated = false;
		this.reconnectAttempts = 0;
		console.log("🔌 [Massive WS] Disconnected");
	}

	clearCache(): void {
		this.latestQuotes.clear();
		this.latestTrades.clear();
		this.latestAggs.clear();
	}
}

export const massiveWebSocketService = new MassiveWebSocketService();
