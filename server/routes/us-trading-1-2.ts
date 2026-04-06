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
router.get("/market/stocks", async (req, res) => {
  try {
    const stocks = await alpacaMarketDataService.getPopularStocks();
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, stocks, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/etfs", async (req, res) => {
  try {
    const etfs = await alpacaMarketDataService.getPopularETFs();
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, etfs, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/sp500", async (req, res) => {
  try {
    const constituents = await alpacaMarketDataService.getSP500Constituents();
    res.json({ success: true, constituents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/fx-rate", async (req, res) => {
  try {
    const rate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, usdInr: rate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Alpaca Market Data — Snapshot (full: trade + quote + daily bar) ──────────
router.get("/market/snapshot/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const snapshot = await alpacaMarketDataService.getSnapshot(symbol.toUpperCase());
    if (!snapshot) {
      return res.status(404).json({ success: false, error: "Symbol not found or no data available" });
    }
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, snapshot, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch snapshots: GET /market/snapshots?symbols=AAPL,MSFT,TSLA
router.get("/market/snapshots", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ success: false, error: "symbols query param required" });

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (symbolList.length > 100) return res.status(400).json({ success: false, error: "Max 100 symbols per request" });

    const [snapshotMap, fxRate] = await Promise.all([
      alpacaMarketDataService.getSnapshots(symbolList),
      alpacaMarketDataService.getUsdInrRate(),
    ]);

    const snapshots: Record<string, any> = {};
    snapshotMap.forEach((snap, sym) => { snapshots[sym] = snap; });

    res.json({ success: true, snapshots, fxRate, feed: process.env.ALPACA_DATA_FEED || "iex" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Alpaca Market Data — Historical Bars ─────────────────────────────────────

// GET /market/bars/latest?symbols=AAPL,MSFT  (MUST be before /:symbol)
router.get("/market/bars/latest", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ success: false, error: "symbols query param required" });

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const barsMap    = await alpacaMarketDataService.getLatestBars(symbolList);

    const bars: Record<string, any> = {};
    barsMap.forEach((bar, sym) => { bars[sym] = bar; });

    res.json({ success: true, bars });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /market/bars/:symbol?timeframe=1Day&start=2024-01-01&end=2024-12-31&limit=365
router.get("/market/bars/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const {
      timeframe = "1Day",
      start,
      end,
      limit = "365",
    } = req.query as Record<string, string>;

    const validTimeframes = ["1Min", "5Min", "15Min", "30Min", "1Hour", "4Hour", "1Day", "1Week", "1Month"];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({ success: false, error: `Invalid timeframe. Use one of: ${validTimeframes.join(", ")}` });
    }

    const barsMap = await alpacaMarketDataService.getBars(
      symbol.toUpperCase(),
      timeframe as any,
      start,
      end,
      Math.min(parseInt(limit) || 365, 10000),
    );

    const bars = barsMap.get(symbol.toUpperCase()) || [];
    res.json({ success: true, symbol: symbol.toUpperCase(), timeframe, bars, count: bars.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /market/quotes/latest?symbols=AAPL,MSFT  — bid/ask spread
router.get("/market/quotes/latest", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) return res.status(400).json({ success: false, error: "symbols query param required" });

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const quotesMap  = await alpacaMarketDataService.getLatestQuotes(symbolList);

    const quotes: Record<string, any> = {};
    quotesMap.forEach((q, sym) => { quotes[sym] = q; });

    res.json({ success: true, quotes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /market/status — connection test for Alpaca Market Data
router.get("/market/status", async (req, res) => {
  const status = alpacaMarketDataService.testConnection();
  res.json({ success: true, marketData: status });
});

router.post("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const data = orderSchema.parse(req.body);

    if (!data.consent || !data.lrsDeclaration) {
      return res.status(400).json({ 
        success: false, 
        error: "Both trade consent and LRS declaration must be acknowledged before placing order" 
      });
    }

    if (!data.quantity && !data.notionalUsd) {
      return res.status(400).json({ 
        success: false, 
        error: "Either quantity or notional amount is required" 
      });
    }

    const compliance = await usTradingService.checkCompliance(userId);
    if (!compliance.eligible) {
      return res.status(403).json({ 
        success: false, 
        error: "Compliance check failed",
        blockers: compliance.blockers,
      });
    }

    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    
    const order = await usTradingService.createOrder({
      clientId: userId,
      symbol: data.symbol.toUpperCase(),
      side: data.side,
      orderType: data.orderType,
      timeInForce: data.timeInForce,
      quantity: data.quantity?.toString(),
      notionalUsd: data.notionalUsd?.toString(),
      limitPrice: data.limitPrice?.toString(),
      stopPrice: data.stopPrice?.toString(),
      fxRateUsdInr: fxRate.toString(),
      status: "pending",
    });

    const consentData = {
      orderId: order.id,
      userId,
      symbol: data.symbol,
      side: data.side,
      quantity: data.quantity,
      notionalUsd: data.notionalUsd,
      consent: data.consent,
      lrsDeclaration: data.lrsDeclaration,
      timestamp: new Date().toISOString(),
    };
    const consentHash = usTradingService.generateConsentHash(consentData);
    
    await usTradingService.recordLrsDeclaration({
      clientId: userId,
      orderId: order.id,
      declarationType: "lrs_trade_declaration",
      declarationText: "I declare this transaction is within my LRS limit and complies with FEMA regulations",
      declarationHash: crypto.createHash('sha256').update(JSON.stringify({
        userId,
        orderId: order.id,
        lrsDeclaration: true,
        timestamp: new Date().toISOString(),
      })).digest('hex'),
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    await usTradingService.recordConsent({
      clientId: userId,
      orderId: order.id,
      consentType: "trade_approval",
      consentHash,
      consentData,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Log to immutable SEBI-compliant audit trail
    await orderAuditHook.logUSOrderCreated(
      order.id,
      userId,
      'client',
      {
        symbol: data.symbol.toUpperCase(),
        side: data.side,
        orderType: data.orderType,
        quantity: data.quantity,
        notionalUsd: data.notionalUsd,
        fxRate,
      },
      compliance,
      req
    );

    try {
      const alpacaOrder = await alpacaBrokerService.placeOrder({
        symbol: data.symbol.toUpperCase(),
        qty: data.quantity,
        notional: data.notionalUsd,
        side: data.side,
        type: data.orderType,
        time_in_force: data.timeInForce,
        limit_price: data.limitPrice,
        stop_price: data.stopPrice,
        client_order_id: order.id,
      });

      if (alpacaOrder) {
        await usTradingService.updateOrderStatus(order.id, alpacaOrder.status, {
          alpacaOrderId: alpacaOrder.id,
          alpacaClientOrderId: alpacaOrder.client_order_id,
          submittedAt: new Date(),
          filledQuantity: alpacaOrder.filled_qty,
          avgFillPrice: alpacaOrder.filled_avg_price,
          filledAt: alpacaOrder.filled_at ? new Date(alpacaOrder.filled_at) : undefined,
        });
      }

      res.json({ 
        success: true, 
        order: { ...order, alpacaOrderId: alpacaOrder?.id },
        message: "Order placed successfully",
      });
    } catch (brokerError: any) {
      await usTradingService.updateOrderStatus(order.id, "rejected");
      return res.status(400).json({ 
        success: false, 
        error: brokerError.message,
        order,
      });
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      return res.status(400).json({ success: false, error: "Invalid order data", details: error.errors });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { limit } = req.query;
    const orders = await usTradingService.getOrders(userId, parseInt(limit as string) || 50);
    res.json({ success: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/orders/:orderId", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const order = await usTradingService.getOrderById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    if (order.clientId !== userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    res.json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/holdings", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const holdings = await usTradingService.getHoldings(userId);
    const fxRate = await alpacaMarketDataService.getUsdInrRate();

    const enrichedHoldings = await Promise.all(
      holdings.map(async (holding) => {
        const quote = await alpacaMarketDataService.getQuote(holding.symbol);
        return {
          ...holding,
          currentPriceUsd: quote?.price || holding.currentPriceUsd,
          currentFxRate: fxRate,
          marketValueInr: quote ? parseFloat(holding.quantity) * quote.price * fxRate : null,
        };
      })
    );

    const totalValueUsd = enrichedHoldings.reduce(
      (sum, h) => sum + (h.currentPriceUsd ? parseFloat(h.quantity) * parseFloat(h.currentPriceUsd.toString()) : 0),
      0
    );

    res.json({ 
      success: true, 
      holdings: enrichedHoldings,
      summary: {
        totalValueUsd,
        totalValueInr: totalValueUsd * fxRate,
        fxRate,
        holdingsCount: holdings.length,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/watchlist", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const watchlist = await usTradingService.getWatchlist(userId);
    const fxRate = await alpacaMarketDataService.getUsdInrRate();

    const enriched = await Promise.all(
      watchlist.map(async (item) => {
        const quote = await alpacaMarketDataService.getQuote(item.symbol);
        return { ...item, quote, fxRate };
      })
    );

    res.json({ success: true, watchlist: enriched });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/watchlist", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { symbol, notes } = req.body;
    if (!symbol) {
      return res.status(400).json({ success: false, error: "Symbol required" });
    }

    const item = await usTradingService.addToWatchlist({ 
      clientId: userId, 
      symbol: symbol.toUpperCase(),
      notes,
    });
    res.json({ success: true, item });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/watchlist/:symbol", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    await usTradingService.removeFromWatchlist(userId, req.params.symbol.toUpperCase());
    res.json({ success: true, message: "Removed from watchlist" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});



export default router;
