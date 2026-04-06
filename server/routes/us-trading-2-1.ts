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
router.get("/broker/test-connection", async (req, res) => {
  try {
    const alpacaResult = await alpacaBrokerService.testConnection();
    const polygonResult = alpacaMarketDataService.testConnection();
    const wsStatus = massiveWebSocketService.getStatus();

    res.json({
      success: true,
      alpaca: alpacaResult,
      polygon: polygonResult,
      massiveWebSocket: {
        configured: wsStatus.configured,
        connected: wsStatus.connected,
        authenticated: wsStatus.authenticated,
        feedType: wsStatus.feedType,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Alpaca Account Dashboard Routes ──────────────────────────────────────────

router.post("/alpaca/credentials", async (req, res) => {
  try {
    const { apiKey, secretKey, baseUrl } = req.body;
    if (!apiKey || !secretKey) {
      return res.status(400).json({ success: false, error: "apiKey and secretKey are required" });
    }
    alpacaBrokerService.configure(apiKey.trim(), secretKey.trim(), baseUrl?.trim() || undefined);
    const test = await alpacaBrokerService.testConnection();
    if (!test.success) {
      return res.status(400).json({ success: false, error: test.message });
    }
    res.json({
      success: true,
      message: `Connected to Alpaca (${alpacaBrokerService.isPaperTrading() ? "Sandbox" : "Live"})`,
      isPaper: alpacaBrokerService.isPaperTrading(),
      baseUrl: alpacaBrokerService.getBaseUrl(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/config", async (req, res) => {
  const configured = alpacaBrokerService.isConfigured();
  let authOk = false;
  let authError: string | undefined;
  if (configured) {
    try {
      const test = await alpacaBrokerService.testConnection();
      authOk = test.success;
      if (!test.success) authError = test.message;
    } catch (e: any) {
      authError = e.message;
    }
  }
  res.json({
    configured,
    authOk,
    authError,
    isPaper: alpacaBrokerService.isPaperTrading(),
    baseUrl: alpacaBrokerService.getBaseUrl(),
    defaultBaseUrl: "https://broker-api.sandbox.alpaca.markets",
    isBrokerApi: alpacaBrokerService.isBrokerApi(),
  });
});

// Activate all US trading feature flags at once (admin convenience)
router.post("/activate-us-trading", async (req, res) => {
  try {
    const test = await alpacaBrokerService.testConnection();
    if (!test.success) {
      return res.status(400).json({
        success: false,
        error: `Alpaca auth failed — update ALPACA_SECRET_KEY: ${test.message}`,
        authOk: false,
      });
    }
    await usTradingService.initializeFeatureFlags();
    const flags = ["US_TRADING_ENABLED", "US_TRADING_ALPACA", "US_FRACTIONAL_TRADING"];
    for (const flag of flags) {
      await usTradingService.setFeatureFlag(flag, true);
    }
    const allFlags = await usTradingService.getFeatureFlags();
    res.json({ success: true, message: "US Trading activated", flags: allFlags, authOk: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all broker-managed accounts (broker API only)
router.get("/alpaca/broker/accounts", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, accounts: [] });
    }
    const accounts = await alpacaBrokerService.listBrokerAccounts();
    res.json({ configured: true, accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/account", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, isPaper: true });
    }
    const accountId = req.query.accountId as string | undefined;
    const account = await alpacaBrokerService.getAccount(accountId);
    res.json({ configured: true, isPaper: alpacaBrokerService.isPaperTrading(), account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/market-clock", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false });
    }
    const clock = await alpacaBrokerService.getMarketClock();
    res.json({ configured: true, clock });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/portfolio/history", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false });
    }
    const period = (req.query.period as string) || "1M";
    const timeframe = (req.query.timeframe as string) || "1D";
    const accountId = req.query.accountId as string | undefined;
    const history = await alpacaBrokerService.getPortfolioHistory(period, timeframe, accountId);
    res.json({ configured: true, history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/alpaca/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.json({ configured: false, orders: [] });
    }
    const status = (req.query.status as string) || "all";
    const limit = parseInt((req.query.limit as string) || "50");
    const accountId = req.query.accountId as string | undefined;
    const orders = await alpacaBrokerService.getOrders(status, limit, accountId);
    res.json({ configured: true, orders });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alpaca/orders", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca API not configured" });
    }
    const accountId = req.query.accountId as string | undefined;
    const cancelled = await alpacaBrokerService.cancelAllOrders(accountId);
    res.json({ success: true, cancelled });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alpaca/orders/:orderId", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca API not configured" });
    }
    const accountId = req.query.accountId as string | undefined;
    const ok = await alpacaBrokerService.cancelOrder(req.params.orderId, accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/alpaca/positions/:symbol", async (req, res) => {
  try {
    if (!alpacaBrokerService.isConfigured()) {
      return res.status(400).json({ success: false, error: "Alpaca API not configured" });
    }
    const accountId = req.query.accountId as string | undefined;
    const ok = await alpacaBrokerService.closePosition(req.params.symbol.toUpperCase(), accountId);
    res.json({ success: ok });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market-data", async (req, res) => {
  try {
    // All symbols fetched in one batch snapshot call — much faster than individual quotes
    const allSymbols = [
      "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "JNJ", // popular stocks
      "SPY", "QQQ", "VTI", "VOO", "IWM", "VUG",                                    // ETFs
      "DIA",                                                                          // Dow proxy
    ];

    const [snapshotMap, exchangeRate, clock] = await Promise.all([
      alpacaMarketDataService.getSnapshots(allSymbols),
      alpacaMarketDataService.getUsdInrRate(),
      alpacaBrokerService.getMarketClock().catch(() => null),
    ]);

    const toQuote = (sym: string) => {
      const snap = snapshotMap.get(sym);
      if (!snap) return null;
      const price     = snap.latestTrade.price || snap.dailyBar.close;
      const prevClose = snap.prevDailyBar.close || snap.dailyBar.open || price;
      const change    = price - prevClose;
      const pct       = prevClose > 0 ? (change / prevClose) * 100 : 0;
      return { symbol: sym, price, change, changePercent: pct, open: snap.dailyBar.open, high: snap.dailyBar.high, low: snap.dailyBar.low, close: snap.dailyBar.close, volume: snap.dailyBar.volume, vwap: snap.dailyBar.vwap };
    };

    // ETF-based index proxies (Alpaca does not provide index feeds)
    const spySnap = snapshotMap.get("SPY");
    const qqqSnap = snapshotMap.get("QQQ");
    const diaSnap = snapshotMap.get("DIA");

    const makeIndexProxy = (sym: string, name: string, snap: typeof spySnap) => {
      if (!snap) return { symbol: sym, name, price: 0, change: 0, changePercent: 0, source: "ETF proxy" };
      const price     = snap.latestTrade.price || snap.dailyBar.close;
      const prevClose = snap.prevDailyBar.close || snap.dailyBar.open || price;
      const change    = price - prevClose;
      const pct       = prevClose > 0 ? (change / prevClose) * 100 : 0;
      return { symbol: sym, name, price, change, changePercent: pct, etfProxy: sym, source: "Alpaca IEX" };
    };

    const marketStatus = clock ? (clock.is_open ? "open" : "closed") : (() => {
      const now    = new Date();
      const nyHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
      return (now.getDay() !== 0 && now.getDay() !== 6 && nyHour >= 9 && nyHour < 16) ? "open" : "closed";
    })();

    const stockSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "JNJ"];
    const etfSymbols   = ["SPY", "QQQ", "VTI", "VOO", "IWM", "VUG"];

    res.json({
      indices: [
        makeIndexProxy("^GSPC", "S&P 500 (via SPY)", spySnap),
        makeIndexProxy("^IXIC", "NASDAQ 100 (via QQQ)", qqqSnap),
        makeIndexProxy("^DJI",  "Dow Jones (via DIA)", diaSnap),
      ],
      stocks:       stockSymbols.map(toQuote).filter(Boolean),
      etfs:         etfSymbols.map(toQuote).filter(Boolean),
      exchangeRate: { rate: exchangeRate, currency: "INR" },
      marketStatus,
      dataSource:   "Alpaca Market Data (IEX feed)",
      lastUpdated:  new Date().toISOString(),
      nextOpen:     clock?.next_open,
      nextClose:    clock?.next_close,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/holdings", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({
        holdings: [],
        totalValue: 0,
        totalValueINR: 0,
        totalProfitLoss: 0,
        totalProfitLossPercent: 0,
      });
    }

    const holdings = await usTradingService.getHoldings(userId);
    const fxRate = await alpacaMarketDataService.getUsdInrRate();
    
    let totalValue = 0;
    let totalCost = 0;
    
    const formattedHoldings = holdings.map((h: any) => {
      const currentPrice = parseFloat(h.currentPriceUsd) || 0;
      const avgPrice = parseFloat(h.avgPriceUsd) || 0;
      const qty = parseFloat(h.quantity) || 0;
      const value = currentPrice * qty;
      const cost = avgPrice * qty;
      const pl = value - cost;
      const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
      
      totalValue += value;
      totalCost += cost;
      
      return {
        id: h.id,
        symbol: h.symbol,
        companyName: h.companyName || h.symbol,
        quantity: qty,
        avgPrice,
        currentPrice,
        totalValue: value,
        profitLoss: pl,
        profitLossPercent: plPercent,
        priceInINR: value * fxRate,
      };
    });
    
    const totalPL = totalValue - totalCost;
    const totalPLPercent = totalCost > 0 ? (totalPL / totalCost) * 100 : 0;
    
    res.json({
      holdings: formattedHoldings,
      totalValue,
      totalValueINR: totalValue * fxRate,
      totalProfitLoss: totalPL,
      totalProfitLossPercent: totalPLPercent,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/watchlist", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({ items: [] });
    }

    const items = await usTradingService.getWatchlist(userId);
    res.json({ items: items.map((i: any) => ({ symbol: i.symbol, addedAt: i.addedAt })) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({ orders: [] });
    }

    const orders = await usTradingService.getOrders(userId);
    res.json({ 
      orders: orders.map((o: any) => ({
        id: o.id,
        symbol: o.symbol,
        side: o.side,
        quantity: parseFloat(o.quantity) || 0,
        price: parseFloat(o.filledAvgPrice || o.limitPrice || "0"),
        status: o.status,
        createdAt: o.createdAt,
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/holdings/sync", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const positions = await alpacaBrokerService.getPositions();
    const fxRate = await alpacaMarketDataService.getUsdInrRate();

    for (const position of positions) {
      await usTradingService.upsertHolding(userId, position.symbol, {
        quantity: position.qty,
        avgPriceUsd: position.avg_entry_price,
        currentPriceUsd: position.current_price,
        marketValueUsd: position.market_value,
        unrealizedPlUsd: position.unrealized_pl,
        unrealizedPlPercent: position.unrealized_plpc,
        currentFxRate: fxRate.toString(),
        marketValueInr: (parseFloat(position.market_value) * fxRate).toString(),
        lastSyncAt: new Date(),
        assetType: "stock",
      });
    }

    res.json({ 
      success: true, 
      message: `Synced ${positions.length} positions`,
      syncedAt: new Date(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


export default router;
