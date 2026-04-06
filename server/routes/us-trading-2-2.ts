import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, kycVault } from "@shared/schema";
import { usTradingService } from "../services/us-trading-service";
import { alpacaMarketDataService } from "../services/alpaca-market-data-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
import { alpacaSseService } from "../services/alpaca-sse-service";
import { massiveWebSocketService } from "../services/massive-websocket-service";
import { usOrderNotificationService } from "../services/us-order-notification-service";
import { usRebalancingEngine } from "../services/us-rebalancing-engine";
import { orderAuditHook } from "../services/order-audit-hook";
import { kycEncryptionService } from "../services/kyc-encryption-service";
import crypto from "crypto";

const router = Router();

const orderSchema = z.object({
  symbol: z.string().min(1).max(10),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit", "stop", "stop_limit"]).default("market"),
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
    const riskProfile = req.query.riskProfile as string || "moderate";
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    
    const stockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "JPM", "V", "JNJ"];
    const quotes = await alpacaMarketDataService.getMultipleQuotes(stockSymbols);
    
    const recommendations = stockSymbols.map(symbol => {
      const quote = quotes.get(symbol);
      if (!quote) return null;
      
      const changeScore = quote.changePercent > 0 ? Math.min(quote.changePercent * 10, 30) : Math.max(quote.changePercent * 5, -20);
      const baseScore = 50 + changeScore + (Math.random() * 20);
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
      
      const isCompatible = riskCompatibility[riskProfile]?.includes(risk) ?? true;
      
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
    }).filter(Boolean).sort((a: any, b: any) => b.score - a.score);
    
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

function generateRationale(symbol: string, signal: string, score: number): string {
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
  
  return rationales[symbol]?.[signal] || 
    `Based on current market analysis and ${score}% confidence score, the recommendation is to ${signal} this stock.`;
}

router.get("/notifications", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const notifications = await usOrderNotificationService.getNotifications(userId, limit);
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
      return res.status(401).json({ success: false, error: "Authentication required" });
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
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const analysis = await usRebalancingEngine.analyzePortfolio(userId);
    if (!analysis) {
      return res.status(400).json({ 
        success: false, 
        error: "Risk profile required for rebalancing analysis" 
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
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const analysis = await usRebalancingEngine.analyzePortfolio(userId);
    if (!analysis) {
      return res.status(400).json({ success: false, error: "Unable to analyze portfolio" });
    }

    const suggestionId = await usRebalancingEngine.saveSuggestion(userId, analysis);
    res.json({ success: true, suggestionId });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/rebalancing/suggestion", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const suggestion = await usRebalancingEngine.getSuggestion(userId);
    res.json({ success: true, suggestion });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ws/status", async (req, res) => {
  try {
    const status = massiveWebSocketService.getStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ws/connect", async (req, res) => {
  try {
    const { feed } = req.body || {};
    if (!massiveWebSocketService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: "Massive WebSocket API key not configured. Set POLYGON_API_KEY.",
      });
    }
    massiveWebSocketService.connect(feed || "delayed");
    res.json({
      success: true,
      message: `Connecting to ${feed || "delayed"} feed...`,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ws/disconnect", async (req, res) => {
  try {
    massiveWebSocketService.disconnect();
    res.json({ success: true, message: "Disconnected from Massive WebSocket" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const validWsChannels = ["trades", "quotes", "minuteAggs", "secondAggs", "all"] as const;

const wsSubscribeSchema = z.object({
  symbols: z.array(z.string().min(1).max(10)).min(1).max(50),
  channels: z.array(z.enum(validWsChannels)).optional(),
});

router.post("/ws/subscribe", async (req, res) => {
  try {
    const parsed = wsSubscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { symbols, channels } = parsed.data;

    if (!massiveWebSocketService.isConnected()) {
      return res.status(400).json({
        success: false,
        error: "WebSocket not connected. Call POST /ws/connect first.",
      });
    }

    const channelList = channels || ["trades", "quotes", "minuteAggs"];

    if (channelList.includes("trades")) massiveWebSocketService.subscribeTrades(symbols);
    if (channelList.includes("quotes")) massiveWebSocketService.subscribeQuotes(symbols);
    if (channelList.includes("minuteAggs")) massiveWebSocketService.subscribeMinuteAggs(symbols);
    if (channelList.includes("secondAggs")) massiveWebSocketService.subscribeSecondAggs(symbols);
    if (channelList.includes("all")) massiveWebSocketService.subscribeAll(symbols);

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
      return res.status(400).json({ success: false, error: parsed.error.errors[0].message });
    }

    const { symbols, channels } = parsed.data;
    const channelList = channels || ["trades", "quotes", "minuteAggs"];

    if (channelList.includes("trades")) massiveWebSocketService.unsubscribeTrades(symbols);
    if (channelList.includes("quotes")) massiveWebSocketService.unsubscribeQuotes(symbols);
    if (channelList.includes("minuteAggs")) massiveWebSocketService.unsubscribeMinuteAggs(symbols);
    if (channelList.includes("all")) massiveWebSocketService.unsubscribeAll(symbols);

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
    const quote = massiveWebSocketService.getLatestQuote(symbol);
    const trade = massiveWebSocketService.getLatestTrade(symbol);
    const agg = massiveWebSocketService.getLatestAgg(symbol);

    res.json({
      success: true,
      symbol,
      quote: quote || null,
      trade: trade || null,
      aggregate: agg || null,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ws/latest", async (req, res) => {
  try {
    res.json({
      success: true,
      quotes: massiveWebSocketService.getAllLatestQuotes(),
      trades: massiveWebSocketService.getAllLatestTrades(),
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
    const maxKeys = parseInt(req.query.maxKeys as string) || 50;
    const files = await alpacaMarketDataService.listFlatFiles(prefix, maxKeys);
    res.json({ success: true, files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/flatfiles/day-aggs/:date", async (req, res) => {
  try {
    const data = await alpacaMarketDataService.getHistoricalDayAggs(req.params.date);
    res.json({
      success: true,
      date: req.params.date,
      count: data.length,
      data: data.slice(0, parseInt(req.query.limit as string) || 100),
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
