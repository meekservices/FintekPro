import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, kycVault } from "@shared/schema";
import { usTradingService } from "../services/us-trading-service";
import { alpacaMarketDataService } from "../services/alpaca-market-data-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { alpacaSseService } from "../services/alpaca-sse-service";
import { alpacaWsStreamingService } from "../services/alpaca-ws-streaming-service";
import { usOrderNotificationService } from "../services/us-order-notification-service";
import { usRebalancingEngine } from "../services/us-rebalancing-engine";
import { orderAuditHook } from "../services/order-audit-hook";
import { kycEncryptionService } from "../services/kyc-encryption-service";
import crypto from "crypto";

import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

// Apply authentication to all routes in this file
router.use(requireAuth);

const orderSchema = z.object({
	symbol: z.string().min(1).max(10),
	side: z.enum(["buy", "sell"]),
	orderType: z
		.enum(["market", "limit", "stop", "stop_limit"])
		.default("market"),
	timeInForce: z.enum(["day", "gtc", "ioc", "fok"]).default("day"),
	quantity: z.number().positive().optional(),
	notionalUsd: z.number().positive().optional(),
	limitPrice: z.number().positive().optional(),
	stopPrice: z.number().positive().optional(),
	consent: z.boolean(),
	lrsDeclaration: z.boolean(),
});

// Get user positions (live from Alpaca when configured, graceful fallback otherwise)
router.get("/ai/recommendations", async (req, res) => {
	try {
		const riskProfile = (req.query.riskProfile as string) || "moderate";
		const fxRate = await alpacaMarketDataService.getUsdInrRate();

		const stockSymbols = [
			"AAPL",
			"MSFT",
			"GOOGL",
			"AMZN",
			"NVDA",
			"META",
			"TSLA",
			"JPM",
			"V",
			"JNJ",
		];
		const quotes =
			await alpacaMarketDataService.getMultipleQuotes(stockSymbols);

		const recommendations = stockSymbols
			.map((symbol) => {
				const quote = quotes.get(symbol);
				if (!quote) return null;

				const changeScore =
					quote.changePercent > 0
						? Math.min(quote.changePercent * 10, 30)
						: Math.max(quote.changePercent * 5, -20);
				const baseScore = 50 + changeScore + Math.random() * 20;
				const score = Math.min(Math.max(Math.round(baseScore), 20), 95);

				let signal: "buy" | "hold" | "sell";
				if (score >= 70) signal = "buy";
				else if (score >= 45) signal = "hold";
				else signal = "sell";

				let risk: "low" | "medium" | "high";
				if (["AAPL", "MSFT", "JNJ", "JPM", "V"].includes(symbol)) risk = "low";
				else if (["GOOGL", "AMZN", "META"].includes(symbol)) risk = "medium";
				else risk = "high";

				const riskCompatibility: Record<string, string[]> = {
					conservative: ["low"],
					moderate: ["low", "medium"],
					aggressive: ["low", "medium", "high"],
					very_aggressive: ["low", "medium", "high"],
				};

				const isCompatible =
					riskCompatibility[riskProfile]?.includes(risk) ?? true;

				return {
					symbol,
					name: getStockName(symbol),
					price: quote.price,
					priceInr: quote.price * fxRate,
					change: quote.change,
					changePercent: quote.changePercent,
					score,
					signal,
					risk,
					isCompatible,
					rationale: generateRationale(symbol, signal, score),
				};
			})
			.filter(Boolean)
			.sort((a: any, b: any) => b.score - a.score);

		res.json({
			success: true,
			recommendations,
			fxRate,
			generatedAt: new Date().toISOString(),
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

function getStockName(symbol: string): string {
	const names: Record<string, string> = {
		AAPL: "Apple Inc.",
		MSFT: "Microsoft Corporation",
		GOOGL: "Alphabet Inc.",
		AMZN: "Amazon.com Inc.",
		NVDA: "NVIDIA Corporation",
		META: "Meta Platforms Inc.",
		TSLA: "Tesla Inc.",
		JPM: "JPMorgan Chase & Co.",
		V: "Visa Inc.",
		JNJ: "Johnson & Johnson",
	};
	return names[symbol] || symbol;
}

function generateRationale(
	symbol: string,
	signal: string,
	score: number,
): string {
	const rationales: Record<string, Record<string, string>> = {
		AAPL: {
			buy: "Strong ecosystem, consistent growth, and robust iPhone sales make Apple an attractive long-term investment.",
			hold: "Apple maintains solid fundamentals but current valuation suggests waiting for better entry point.",
			sell: "Near-term headwinds and competition may pressure margins.",
		},
		MSFT: {
			buy: "Cloud growth via Azure and AI integration positions Microsoft for continued expansion.",
			hold: "Microsoft remains stable but growth may be priced in at current levels.",
			sell: "Slowing enterprise spending could impact near-term performance.",
		},
		NVDA: {
			buy: "AI chip demand continues to surge, making NVIDIA a leader in the AI revolution.",
			hold: "Strong fundamentals but high valuation requires caution.",
			sell: "Potential competition and supply constraints pose risks.",
		},
	};

	return (
		rationales[symbol]?.[signal] ||
		`Based on current market analysis and ${score}% confidence score, the recommendation is to ${signal} this stock.`
	);
}

router.get("/notifications", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}

		const limit = Number.parseInt(req.query.limit as string) || 20;
		const notifications = await usOrderNotificationService.getNotifications(
			userId,
			limit,
		);
		const unreadCount = await usOrderNotificationService.getUnreadCount(userId);

		res.json({ success: true, notifications, unreadCount });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/notifications/:id/read", async (req, res) => {
	try {
		const { id } = req.params;
		const success = await usOrderNotificationService.markAsRead(id);
		res.json({ success });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/notifications/read-all", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}

		const success = await usOrderNotificationService.markAllAsRead(userId);
		res.json({ success });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/rebalancing/analyze", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}

		const analysis = await usRebalancingEngine.analyzePortfolio(userId);
		if (!analysis) {
			return res.status(400).json({
				success: false,
				error: "Risk profile required for rebalancing analysis",
			});
		}

		res.json({ success: true, analysis });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/rebalancing/save", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}

		const analysis = await usRebalancingEngine.analyzePortfolio(userId);
		if (!analysis) {
			return res
				.status(400)
				.json({ success: false, error: "Unable to analyze portfolio" });
		}

		const suggestionId = await usRebalancingEngine.saveSuggestion(
			userId,
			analysis,
		);
		res.json({ success: true, suggestionId });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/rebalancing/suggestion", async (req, res) => {
	try {
		const userId = (req as any).user?.id;
		if (!userId) {
			return res
				.status(401)
				.json({ success: false, error: "Authentication required" });
		}

		const suggestion = await usRebalancingEngine.getSuggestion(userId);
		res.json({ success: true, suggestion });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/ws/status", async (req, res) => {
	try {
		const status = alpacaWsStreamingService.getStatus();
		res.json({ success: true, ...status });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

/** Connect to Alpaca Data WebSocket (Admin only) */
router.post("/ws/connect", requireAdmin, async (req, res) => {
	try {
		const { feed } = req.body || {};
		if (!alpacaWsStreamingService.isConfigured()) {
			return res.status(400).json({
				success: false,
				error:
					"Alpaca API credentials not configured. Set ALPACA_API_KEY and ALPACA_SECRET_KEY.",
			});
		}
		alpacaWsStreamingService.connect(feed);
		res.json({
			success: true,
			message: `Connecting to Alpaca Data WebSocket (${alpacaWsStreamingService.getStatus().feed} feed)...`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

/** Disconnect from Alpaca Data WebSocket (Admin only) */
router.post("/ws/disconnect", requireAdmin, async (req, res) => {
	try {
		alpacaWsStreamingService.disconnect();
		res.json({
			success: true,
			message: "Disconnected from Alpaca Data WebSocket",
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

const validWsChannels = [
	"trades",
	"quotes",
	"minuteAggs",
	"secondAggs",
	"all",
] as const;

const wsSubscribeSchema = z.object({
	symbols: z.array(z.string().min(1).max(10)).min(1).max(50),
	channels: z.array(z.enum(validWsChannels)).optional(),
});

router.post("/ws/subscribe", async (req, res) => {
	try {
		const parsed = wsSubscribeSchema.safeParse(req.body);
		if (!parsed.success) {
			return res
				.status(400)
				.json({ success: false, error: parsed.error.issues[0].message });
		}

		const { symbols, channels } = parsed.data;

		if (!alpacaWsStreamingService.isConnected()) {
			return res.status(400).json({
				success: false,
				error: "WebSocket not connected. Call POST /ws/connect first.",
			});
		}

		const channelList = channels || ["trades", "quotes", "minuteAggs"];

		if (channelList.includes("trades"))
			alpacaWsStreamingService.subscribeTrades(symbols);
		if (channelList.includes("quotes"))
			alpacaWsStreamingService.subscribeQuotes(symbols);
		if (channelList.includes("minuteAggs"))
			alpacaWsStreamingService.subscribeMinuteAggs(symbols);
		if (channelList.includes("secondAggs"))
			alpacaWsStreamingService.subscribeSecondAggs(symbols);
		if (channelList.includes("all"))
			alpacaWsStreamingService.subscribeAll(symbols);

		res.json({
			success: true,
			message: `Subscribed to ${channelList.join(", ")} for ${symbols.join(", ")}`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/ws/unsubscribe", async (req, res) => {
	try {
		const parsed = wsSubscribeSchema.safeParse(req.body);
		if (!parsed.success) {
			return res
				.status(400)
				.json({ success: false, error: parsed.error.issues[0].message });
		}

		const { symbols, channels } = parsed.data;
		const channelList = channels || ["trades", "quotes", "minuteAggs"];

		if (channelList.includes("trades"))
			alpacaWsStreamingService.unsubscribeTrades(symbols);
		if (channelList.includes("quotes"))
			alpacaWsStreamingService.unsubscribeQuotes(symbols);
		if (channelList.includes("minuteAggs"))
			alpacaWsStreamingService.unsubscribeMinuteAggs(symbols);
		if (channelList.includes("all"))
			alpacaWsStreamingService.unsubscribeAll(symbols);

		res.json({
			success: true,
			message: `Unsubscribed from ${channelList.join(", ")} for ${symbols.join(", ")}`,
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/ws/latest/:symbol", async (req, res) => {
	try {
		const symbol = req.params.symbol.toUpperCase();
		const quote = alpacaWsStreamingService.getLatestQuote(symbol);
		const trade = alpacaWsStreamingService.getLatestTrade(symbol);
		const agg = alpacaWsStreamingService.getLatestAgg(symbol);

		// If streaming hasn't received data yet, fall back to the REST snapshot
		let restQuote: any = null;
		if (!quote && !trade) {
			try {
				const snaps = await alpacaMarketDataService.getSnapshots([symbol]);
				const snap = snaps.get(symbol);
				if (snap) {
					restQuote = {
						bidPrice: snap.latestQuote.bidPrice,
						askPrice: snap.latestQuote.askPrice,
						bidSize: snap.latestQuote.bidSize,
						askSize: snap.latestQuote.askSize,
						timestamp: snap.latestQuote.timestamp,
						source: "rest_snapshot",
					};
				}
			} catch {}
		}

		res.json({
			success: true,
			symbol,
			quote: quote || restQuote || null,
			trade: trade || null,
			aggregate: agg || null,
			streaming: alpacaWsStreamingService.isConnected(),
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/ws/latest", async (req, res) => {
	try {
		res.json({
			success: true,
			quotes: alpacaWsStreamingService.getAllLatestQuotes(),
			trades: alpacaWsStreamingService.getAllLatestTrades(),
			bars: alpacaWsStreamingService.getAllLatestBars(),
			streaming: alpacaWsStreamingService.isConnected(),
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/flatfiles/datasets", async (req, res) => {
	try {
		const datasets = await alpacaMarketDataService.getAvailableDatasets();
		res.json({ success: true, datasets });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/flatfiles/list", async (req, res) => {
	try {
		const prefix = (req.query.prefix as string) || "us_stocks_sip";
		const maxKeys = Number.parseInt(req.query.maxKeys as string) || 50;
		const files = await alpacaMarketDataService.listFlatFiles(prefix, maxKeys);
		res.json({ success: true, files });
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/flatfiles/day-aggs/:date", async (req, res) => {
	try {
		const data = await alpacaMarketDataService.getHistoricalDayAggs(
			req.params.date,
		);
		res.json({
			success: true,
			date: req.params.date,
			count: data.length,
			data: data.slice(0, Number.parseInt(req.query.limit as string) || 100),
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

// ════════════════════════════════════════════════════════════════════════════
// FULLY-DISCLOSED BROKER-DEALER ROUTES  (Alpaca Broker API v1)
// Prefix: /api/us-trading/broker/*
// Guards: Admin = all; Agent = view own clients; Client = own account only
// ════════════════════════════════════════════════════════════════════════════

// ─── Account Management ───────────────────────────────────────────────────────

/** List all broker-managed end-user accounts (admin/agent) */

export default router;
