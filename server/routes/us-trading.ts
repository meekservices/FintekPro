import { Router } from "express";
import { z } from "zod";
import { usTradingService } from "../services/us-trading-service";
import { polygonMarketService } from "../services/polygon-market-service";
import { alpacaBrokerService } from "../services/alpaca-broker-service";
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

router.get("/feature-flags", async (req, res) => {
  try {
    const flags = await usTradingService.getFeatureFlags();
    res.json({ success: true, flags });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/feature-flags/initialize", async (req, res) => {
  try {
    await usTradingService.initializeFeatureFlags();
    const flags = await usTradingService.getFeatureFlags();
    res.json({ success: true, message: "Feature flags initialized", flags });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/feature-flags/:flagName", async (req, res) => {
  try {
    const { flagName } = req.params;
    const { isEnabled } = req.body;
    const userId = (req as any).user?.id;
    
    const success = await usTradingService.setFeatureFlag(flagName, isEnabled, userId);
    if (success) {
      res.json({ success: true, message: `Flag ${flagName} updated` });
    } else {
      res.status(400).json({ success: false, error: "Failed to update flag" });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/compliance/check", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const result = await usTradingService.checkCompliance(userId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/eligibility", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({
        eligible: false,
        reasons: ["Authentication required"],
        lrsUsed: 0,
        lrsLimit: 250000,
        lrsRemaining: 250000,
        riskProfile: "Unknown",
        panVerified: false,
        kycComplete: false,
      });
    }

    const compliance = await usTradingService.checkCompliance(userId);
    const lrsUsage = await usTradingService.getLrsUsage(userId);
    
    res.json({
      eligible: compliance.eligible,
      reasons: compliance.reasons || [],
      lrsUsed: lrsUsage.usedUsd || 0,
      lrsLimit: 250000,
      lrsRemaining: 250000 - (lrsUsage.usedUsd || 0),
      riskProfile: compliance.riskProfile || "Moderate",
      panVerified: compliance.panVerified || false,
      kycComplete: compliance.kycComplete || false,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/lrs/usage", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const { financialYear } = req.query;
    const usage = await usTradingService.getLrsUsage(userId, financialYear as string);
    res.json({ success: true, ...usage, limitUsd: 250000 });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/broker/account", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const account = await usTradingService.getBrokerAccount(userId);
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/broker/account", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const existing = await usTradingService.getBrokerAccount(userId);
    if (existing) {
      return res.json({ success: true, account: existing, message: "Account already exists" });
    }

    const account = await usTradingService.createBrokerAccount({ clientId: userId });
    res.json({ success: true, account });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/quote/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const quote = await polygonMarketService.getQuote(symbol);
    
    if (!quote) {
      return res.status(404).json({ success: false, error: "Quote not found" });
    }

    const fxRate = await polygonMarketService.getUsdInrRate();
    res.json({ 
      success: true, 
      quote,
      priceInr: quote.price * fxRate,
      fxRate,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/quotes", async (req, res) => {
  try {
    const { symbols } = req.query;
    if (!symbols) {
      return res.status(400).json({ success: false, error: "Symbols required" });
    }

    const symbolList = (symbols as string).split(",").map(s => s.trim().toUpperCase());
    const quotes = await polygonMarketService.getMultipleQuotes(symbolList);
    const fxRate = await polygonMarketService.getUsdInrRate();

    const result: any[] = [];
    quotes.forEach((quote, symbol) => {
      result.push({
        ...quote,
        priceInr: quote.price * fxRate,
      });
    });

    res.json({ success: true, quotes: result, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/details/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const details = await polygonMarketService.getStockDetails(symbol);
    const quote = await polygonMarketService.getQuote(symbol);
    
    res.json({ success: true, details, quote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/search", async (req, res) => {
  try {
    const { query, limit } = req.query;
    if (!query) {
      return res.status(400).json({ success: false, error: "Query required" });
    }

    const results = await polygonMarketService.searchSymbols(
      query as string, 
      parseInt(limit as string) || 10
    );
    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/etfs", async (req, res) => {
  try {
    const etfs = await polygonMarketService.getPopularETFs();
    const fxRate = await polygonMarketService.getUsdInrRate();
    res.json({ success: true, etfs, fxRate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/sp500", async (req, res) => {
  try {
    const constituents = await polygonMarketService.getSP500Constituents();
    res.json({ success: true, constituents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market/fx-rate", async (req, res) => {
  try {
    const rate = await polygonMarketService.getUsdInrRate();
    res.json({ success: true, usdInr: rate });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/orders", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const data = orderSchema.parse(req.body);

    if (!data.consentAcknowledged) {
      return res.status(400).json({ 
        success: false, 
        error: "Trade consent must be acknowledged before placing order" 
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

    const fxRate = await polygonMarketService.getUsdInrRate();
    
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
      timestamp: new Date().toISOString(),
    };
    const consentHash = usTradingService.generateConsentHash(consentData);

    await usTradingService.recordConsent({
      clientId: userId,
      orderId: order.id,
      consentType: "trade_approval",
      consentHash,
      consentData,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

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
    const fxRate = await polygonMarketService.getUsdInrRate();

    const enrichedHoldings = await Promise.all(
      holdings.map(async (holding) => {
        const quote = await polygonMarketService.getQuote(holding.symbol);
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
    const fxRate = await polygonMarketService.getUsdInrRate();

    const enriched = await Promise.all(
      watchlist.map(async (item) => {
        const quote = await polygonMarketService.getQuote(item.symbol);
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

router.get("/broker/test-connection", async (req, res) => {
  try {
    const alpacaResult = await alpacaBrokerService.testConnection();
    const polygonResult = polygonMarketService.testConnection();

    res.json({
      success: true,
      alpaca: alpacaResult,
      polygon: polygonResult,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/market-data", async (req, res) => {
  try {
    const popularSymbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "JNJ"];
    const etfSymbols = ["SPY", "QQQ", "VTI", "VOO", "IWM", "VUG"];
    
    const [stockQuotes, etfQuotes, exchangeRate] = await Promise.all([
      Promise.all(popularSymbols.map(async (symbol) => {
        const quote = await polygonMarketService.getQuote(symbol);
        return quote;
      })),
      Promise.all(etfSymbols.map(async (symbol) => {
        const quote = await polygonMarketService.getQuote(symbol);
        return quote;
      })),
      polygonMarketService.getUsdInrRate(),
    ]);
    
    const now = new Date();
    const nyHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hour12: false }));
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    const marketStatus = isWeekend ? "closed" : (nyHour >= 9 && nyHour < 16) ? "open" : "closed";
    
    res.json({
      indices: [
        { symbol: "^GSPC", name: "S&P 500", price: 5998.74, change: 23.45, changePercent: 0.39 },
        { symbol: "^IXIC", name: "NASDAQ", price: 19764.88, change: -45.32, changePercent: -0.23 },
        { symbol: "^DJI", name: "Dow Jones", price: 42992.21, change: 168.53, changePercent: 0.39 },
        { symbol: "^VIX", name: "VIX", price: 14.58, change: -0.87, changePercent: -5.63 },
      ],
      stocks: stockQuotes.filter(Boolean),
      etfs: etfQuotes.filter(Boolean),
      exchangeRate: { rate: exchangeRate, currency: "INR" },
      marketStatus,
      lastUpdated: new Date().toISOString(),
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
    const fxRate = await polygonMarketService.getUsdInrRate();
    
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
    const fxRate = await polygonMarketService.getUsdInrRate();

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
