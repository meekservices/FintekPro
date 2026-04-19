import { Router, Request, Response } from "express";
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

interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

// Get user positions (live from Alpaca when configured, graceful fallback otherwise)
router.get("/market/stocks", async (req: Request, res: Response): Promise<void> => {
  try {
    const stocks = await alpacaMarketDataService.getPopularStocks();
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, stocks, fxRate });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/market/etfs", async (req: Request, res: Response): Promise<void> => {
  try {
    const etfs = await alpacaMarketDataService.getPopularETFs();
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, etfs, fxRate });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/market/sp500", async (req: Request, res: Response): Promise<void> => {
  try {
    const constituents = await alpacaMarketDataService.getSP500Constituents();
    res.json({ success: true, constituents });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/market/fx-rate", async (req: Request, res: Response): Promise<void> => {
  try {
    const rate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, usdInr: rate });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Alpaca Market Data — Snapshot (full: trade + quote + daily bar) ──────────
router.get("/market/snapshot/:symbol", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const snapshot = await alpacaMarketDataService.getSnapshot(symbol.toUpperCase());
    if (!snapshot) {
      res.status(404).json({ success: false, error: "Symbol not found or no data available" });
      return;
    }
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    res.json({ success: true, snapshot, fxRate });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// Batch snapshots: GET /market/snapshots?symbols=AAPL,MSFT,TSLA
router.get("/market/snapshots", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      res.status(400).json({ success: false, error: "symbols query param required" });
      return;
    }

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    if (symbolList.length > 100) {
      res.status(400).json({ success: false, error: "Max 100 symbols per request" });
      return;
    }

    const [snapshotMap, fxRate] = await Promise.all([
      alpacaMarketDataService.getSnapshots(symbolList),
      alpacaMarketDataService.getUsdInrRate(),
    ]);

    const snapshots: Record<string, any> = {};
    snapshotMap.forEach((snap, sym) => { snapshots[sym] = snap; });

    res.json({ success: true, snapshots, fxRate, feed: process.env.ALPACA_DATA_FEED || "iex" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// ── Alpaca Market Data — Historical Bars ─────────────────────────────────────

// GET /market/bars/latest?symbols=AAPL,MSFT  (MUST be before /:symbol)
router.get("/market/bars/latest", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      res.status(400).json({ success: false, error: "symbols query param required" });
      return;
    }

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const barsMap    = await alpacaMarketDataService.getLatestBars(symbolList);

    const bars: Record<string, any> = {};
    barsMap.forEach((bar, sym) => { bars[sym] = bar; });

    res.json({ success: true, bars });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /market/bars/:symbol?timeframe=1Day&start=2024-01-01&end=2024-12-31&limit=365
router.get("/market/bars/:symbol", async (req: Request, res: Response): Promise<void> => {
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
      res.status(400).json({ success: false, error: `Invalid timeframe. Use one of: ${validTimeframes.join(", ")}` });
      return;
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /market/quotes/latest?symbols=AAPL,MSFT  — bid/ask spread
router.get("/market/quotes/latest", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      res.status(400).json({ success: false, error: "symbols query param required" });
      return;
    }

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const quotesMap  = await alpacaMarketDataService.getLatestQuotes(symbolList);

    const quotes: Record<string, any> = {};
    quotesMap.forEach((q, sym) => { quotes[sym] = q; });

    res.json({ success: true, quotes });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /market/status — connection test for Alpaca Market Data
router.get("/market/status", async (req: Request, res: Response): Promise<void> => {
  const status = alpacaMarketDataService.testConnection();
  res.json({ success: true, marketData: status });
});

// GET /market/clock — live market open/close from Alpaca /v1/clock
router.get("/market/clock", async (req: Request, res: Response): Promise<void> => {
  try {
    // Try live Alpaca clock first
    if (alpacaBrokerService.isConfigured()) {
      try {
        const clock = await alpacaBrokerService.getMarketClock();
        if (clock) {
          res.json({
            success: true,
            source: "alpaca",
            is_open: clock.is_open,
            next_open: clock.next_open,
            next_close: clock.next_close,
            timestamp: clock.timestamp,
          });
          return;
        }
      } catch {}
    }
    // Fallback to calculated status
    const calc = alpacaMarketDataService.getMarketStatus();
    res.json({
      success:    true,
      source:     "calculated",
      is_open:    calc.isOpen,
      next_open:  calc.nextOpen,
      next_close: calc.nextClose,
      timestamp:  calc.timestamp,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

// GET /market/trades/latest?symbols=AAPL,MSFT — latest trade ticks
router.get("/market/trades/latest", async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      res.status(400).json({ success: false, error: "symbols query param required" });
      return;
    }
    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase()).filter(Boolean);
    const tradesMap  = await alpacaMarketDataService.getLatestTrades(symbolList);
    const trades: Record<string, any> = {};
    tradesMap.forEach((t, sym) => { trades[sym] = t; });
    res.json({ success: true, trades });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/orders", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const data = orderSchema.parse(req.body);

    if (!data.consent || !data.lrsDeclaration) {
      res.status(400).json({ 
        success: false, 
        error: "Both trade consent and LRS declaration must be acknowledged before placing order" 
      });
      return;
    }

    if (!data.quantity && !data.notionalUsd) {
      res.status(400).json({ 
        success: false, 
        error: "Either quantity or notional amount is required" 
      });
      return;
    }

    const compliance = await usTradingService.checkCompliance(userId);
    if (!compliance.eligible) {
      res.status(403).json({ 
        success: false, 
        error: "Compliance check failed",
        blockers: compliance.blockers,
      });
      return;
    }

    // ── PDT Check ─────────────────────────────────────────────────────────────
    // If the account is flagged as a Pattern Day Trader and has < $25,000 equity,
    // Alpaca will reject the order with HTTP 403. Surface this before submission.
    if (alpacaBrokerService.isConfigured()) {
      try {
        const accountInfo = await alpacaBrokerService.getAccount();
        if (accountInfo?.pattern_day_trader) {
          const equity = parseFloat(accountInfo.equity || "0");
          if (equity < 25_000) {
            res.status(403).json({
              success: false,
              error: "Pattern Day Trader (PDT) restriction: your account equity is below $25,000. " +
                "You cannot place day trades until your equity is restored. " +
                "This is a FINRA requirement. Consider using GTC orders or waiting until the next trading day.",
              pdt_flagged: true,
            });
            return;
          }
        }
      } catch {} // Non-fatal — let Alpaca handle it server-side if this check fails
    }

    // ── Fractionability Check ──────────────────────────────────────────────────
    // If the order is fractional (qty < 1) or notional, the asset must be fractionable.
    const isFractional = (data.quantity !== undefined && data.quantity < 1) || data.notionalUsd !== undefined;
    if (isFractional && alpacaBrokerService.isConfigured()) {
      try {
        const asset = await alpacaBrokerService.getAsset(data.symbol.toUpperCase());
        if (asset && !asset.fractionable) {
          res.status(400).json({
            success: false,
            error: `${data.symbol.toUpperCase()} is not eligible for fractional trading. ` +
              "Use a whole-share quantity instead, or choose a fractionable security.",
            fractionable: false,
            symbol: data.symbol.toUpperCase(),
          });
          return;
        }
      } catch {} // Non-fatal — let Alpaca handle rejection if asset check fails
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
      ipAddress: req.ip || '',
      userAgent: req.headers["user-agent"],
    });

    await usTradingService.recordConsent({
      clientId: userId,
      orderId: order.id,
      consentType: "trade_approval",
      consentHash,
      consentData,
      ipAddress: req.ip || '',
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
    } catch (brokerError: unknown) {
      const msg = brokerError instanceof Error ? brokerError.message : String(brokerError);
      await usTradingService.updateOrderStatus(order.id, "rejected");
      res.status(400).json({ 
        success: false, 
        error: msg,
        order,
      });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Invalid order data", details: error.errors });
      return;
    }
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/orders", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const { limit } = req.query;
    const orders = await usTradingService.getOrders(userId, parseInt(limit as string) || 50);
    res.json({ success: true, orders });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/orders/:orderId", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const order = await usTradingService.getOrderById(req.params.orderId);
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }

    if (order.clientId !== userId) {
      res.status(403).json({ success: false, error: "Access denied" });
      return;
    }

    res.json({ success: true, order });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/holdings", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/watchlist", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
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
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.post("/watchlist", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    const { symbol, notes } = req.body;
    if (!symbol) {
      res.status(400).json({ success: false, error: "Symbol required" });
      return;
    }

    const item = await usTradingService.addToWatchlist({ 
      clientId: userId, 
      symbol: symbol.toUpperCase(),
      notes,
    });
    res.json({ success: true, item });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});

router.delete("/watchlist/:symbol", async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: "Authentication required" });
      return;
    }

    await usTradingService.removeFromWatchlist(userId, req.params.symbol.toUpperCase());
    res.json({ success: true, message: "Removed from watchlist" });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: msg });
  }
});



export default router;
