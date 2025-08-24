import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPortfolioSchema, insertPortfolioHoldingSchema, insertWatchlistSchema, insertMutualFundSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Finnhub API integration
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || "demo";
  const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
  
  // MF API integration
  const MF_API_BASE = "https://api.mfapi.in";
  
  // Popular mutual fund scheme codes
  const POPULAR_MF_SCHEMES = [
    { code: '120503', name: 'SBI Bluechip Fund - Direct Growth' },
    { code: '119551', name: 'ICICI Prudential Bluechip Fund - Direct Growth' },
    { code: '118989', name: 'Axis Bluechip Fund - Direct Growth' },
    { code: '120716', name: 'Mirae Asset Large Cap Fund - Direct Growth' },
    { code: '146802', name: 'Parag Parikh Long Term Equity Fund - Direct Growth' },
    { code: '119226', name: 'Kotak Small Cap Fund - Direct Growth' },
    { code: '118834', name: 'DSP Tax Saver Fund - Direct Growth' },
    { code: '119785', name: 'Axis Long Term Equity Fund - Direct Growth' },
    { code: '118525', name: 'SBI Long Term Equity Fund - Direct Growth' }
  ];

  // Helper function to fetch from Finnhub
  async function fetchFinnhub(endpoint: string) {
    const url = `${FINNHUB_BASE_URL}${endpoint}&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Helper function to fetch from MF API
  async function fetchMFAPI(endpoint: string) {
    const url = `${MF_API_BASE}${endpoint}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`MFAPI error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  // Market data endpoints
  app.get("/api/market/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const data = await fetchFinnhub(`/quote?symbol=${symbol.toUpperCase()}`);
      
      // Store in local cache
      await storage.upsertMarketData(symbol, {
        symbol: symbol.toUpperCase(),
        price: data.c?.toString(),
        change: data.d?.toString(),
        changePercent: data.dp?.toString(),
        data: data
      });
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ error: "Failed to fetch market quote" });
    }
  });

  app.get("/api/market/candles/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { resolution = "D", from, to } = req.query;
      
      const data = await fetchFinnhub(`/stock/candle?symbol=${symbol.toUpperCase()}&resolution=${resolution}&from=${from}&to=${to}`);
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching candles:", error);
      res.status(500).json({ error: "Failed to fetch market candles" });
    }
  });

  app.get("/api/market/indices", async (req, res) => {
    try {
      const indices = [
        "^GSPC", // S&P 500
        "^IXIC", // NASDAQ
        "^DJI",  // Dow Jones
        "^NSEI", // Nifty 50
        "^BSESN", // BSE Sensex
        "^N225", // Nikkei
        "^HSI",  // Hang Seng
        "^FTSE", // FTSE 100
        "^GDAXI", // DAX
        "^FCHI"  // CAC 40
      ];

      const promises = indices.map(async (symbol) => {
        try {
          const data = await fetchFinnhub(`/quote?symbol=${symbol}`);
          return {
            symbol,
            price: data.c,
            change: data.d,
            changePercent: data.dp,
            ...data
          };
        } catch (error) {
          console.error(`Error fetching ${symbol}:`, error);
          return {
            symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            error: "Failed to fetch"
          };
        }
      });

      const results = await Promise.all(promises);
      res.json(results);
    } catch (error) {
      console.error("Error fetching indices:", error);
      res.status(500).json({ error: "Failed to fetch market indices" });
    }
  });

  app.get("/api/market/news", async (req, res) => {
    try {
      const { category = "general" } = req.query;
      const data = await fetchFinnhub(`/news?category=${category}`);
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching news:", error);
      res.status(500).json({ error: "Failed to fetch market news" });
    }
  });

  app.get("/api/market/company/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const data = await fetchFinnhub(`/stock/profile2?symbol=${symbol.toUpperCase()}`);
      
      res.json(data);
    } catch (error) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ error: "Failed to fetch company profile" });
    }
  });

  // Portfolio endpoints
  app.get("/api/portfolios/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const portfolios = await storage.getPortfoliosByUserId(userId);
      res.json(portfolios);
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      res.status(500).json({ error: "Failed to fetch portfolios" });
    }
  });

  app.post("/api/portfolios", async (req, res) => {
    try {
      const validatedData = insertPortfolioSchema.parse(req.body);
      const portfolio = await storage.createPortfolio(validatedData);
      res.json(portfolio);
    } catch (error) {
      console.error("Error creating portfolio:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid portfolio data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create portfolio" });
      }
    }
  });

  app.get("/api/portfolios/:portfolioId/holdings", async (req, res) => {
    try {
      const { portfolioId } = req.params;
      const holdings = await storage.getPortfolioHoldings(portfolioId);
      res.json(holdings);
    } catch (error) {
      console.error("Error fetching holdings:", error);
      res.status(500).json({ error: "Failed to fetch portfolio holdings" });
    }
  });

  app.post("/api/portfolios/:portfolioId/holdings", async (req, res) => {
    try {
      const { portfolioId } = req.params;
      const validatedData = insertPortfolioHoldingSchema.parse({
        ...req.body,
        portfolioId
      });
      const holding = await storage.createPortfolioHolding(validatedData);
      res.json(holding);
    } catch (error) {
      console.error("Error creating holding:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid holding data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create holding" });
      }
    }
  });

  // Asset allocation endpoints
  app.get("/api/portfolios/:portfolioId/allocation", async (req, res) => {
    try {
      const { portfolioId } = req.params;
      const allocation = await storage.getAssetAllocation(portfolioId);
      res.json(allocation);
    } catch (error) {
      console.error("Error fetching asset allocation:", error);
      res.status(500).json({ error: "Failed to fetch asset allocation" });
    }
  });

  app.post("/api/portfolios/:portfolioId/rebalance", async (req, res) => {
    try {
      const { portfolioId } = req.params;
      const { targetAllocations } = req.body;
      
      // Calculate rebalancing requirements
      const holdings = await storage.getPortfolioHoldings(portfolioId);
      const portfolio = await storage.getPortfolio(portfolioId);
      
      if (!portfolio) {
        return res.status(404).json({ error: "Portfolio not found" });
      }

      // Calculate current allocation and rebalance amounts
      const totalValue = parseFloat(portfolio.totalValue || "0");
      const rebalanceCalculations = [];

      for (const target of targetAllocations) {
        const targetValue = totalValue * (parseFloat(target.percentage) / 100);
        const currentHoldings = holdings.filter(h => h.assetType === target.assetType);
        const currentValue = currentHoldings.reduce((sum, h) => {
          return sum + (parseFloat(h.quantity) * parseFloat(h.avgPrice));
        }, 0);
        
        const rebalanceAmount = targetValue - currentValue;
        
        rebalanceCalculations.push({
          assetType: target.assetType,
          targetValue,
          currentValue,
          rebalanceAmount,
          action: rebalanceAmount > 0 ? "BUY" : "SELL"
        });

        // Store allocation data
        await storage.upsertAssetAllocation({
          portfolioId,
          assetType: target.assetType,
          targetPercentage: target.percentage,
          currentPercentage: ((currentValue / totalValue) * 100).toString(),
          targetValue: targetValue.toString(),
          currentValue: currentValue.toString(),
          rebalanceAmount: rebalanceAmount.toString()
        });
      }

      res.json({ rebalanceCalculations });
    } catch (error) {
      console.error("Error calculating rebalance:", error);
      res.status(500).json({ error: "Failed to calculate rebalance" });
    }
  });

  // Watchlist endpoints
  app.get("/api/watchlists/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const watchlists = await storage.getWatchlistsByUserId(userId);
      res.json(watchlists);
    } catch (error) {
      console.error("Error fetching watchlists:", error);
      res.status(500).json({ error: "Failed to fetch watchlists" });
    }
  });

  app.post("/api/watchlists", async (req, res) => {
    try {
      const validatedData = insertWatchlistSchema.parse(req.body);
      const watchlist = await storage.createWatchlist(validatedData);
      res.json(watchlist);
    } catch (error) {
      console.error("Error creating watchlist:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid watchlist data", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create watchlist" });
      }
    }
  });

  // Mutual Fund API endpoints
  app.get("/api/mutual-funds", async (req, res) => {
    try {
      // Check if we have cached data
      const cachedFunds = await storage.getAllMutualFunds();
      if (cachedFunds.length > 0) {
        return res.json(cachedFunds);
      }

      // If no cached data, fetch popular funds
      const fundPromises = POPULAR_MF_SCHEMES.map(async (scheme) => {
        try {
          const data = await fetchMFAPI(`/mf/${scheme.code}`);
          const fundData = {
            schemeCode: scheme.code,
            schemeName: data.meta?.scheme_name || scheme.name,
            category: data.meta?.scheme_category || "Equity",
            fundHouse: data.meta?.fund_house || "Unknown AMC",
            nav: data.data?.[0]?.nav || "0",
            lastUpdated: new Date()
          };
          
          // Store in database
          await storage.upsertMutualFund(fundData);
          return fundData;
        } catch (error) {
          console.error(`Error fetching MF ${scheme.code}:`, error);
          return {
            schemeCode: scheme.code,
            schemeName: scheme.name,
            category: "Equity",
            fundHouse: "Unknown AMC",
            nav: "0"
          };
        }
      });

      const funds = await Promise.all(fundPromises);
      res.json(funds);
    } catch (error) {
      console.error("Error fetching mutual funds:", error);
      res.status(500).json({ error: "Failed to fetch mutual funds" });
    }
  });

  app.get("/api/mutual-funds/:schemeCode", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      const data = await fetchMFAPI(`/mf/${schemeCode}`);
      
      const fundData = {
        schemeCode,
        schemeName: data.meta?.scheme_name || "Unknown Fund",
        category: data.meta?.scheme_category || "Unknown Category",
        fundHouse: data.meta?.fund_house || "Unknown AMC",
        nav: data.data?.[0]?.nav || "0",
        date: data.data?.[0]?.date || new Date().toISOString().split('T')[0],
        historicalData: data.data || []
      };

      // Store/update in database
      await storage.upsertMutualFund(fundData);
      
      res.json(fundData);
    } catch (error) {
      console.error(`Error fetching mutual fund ${req.params.schemeCode}:`, error);
      res.status(500).json({ error: "Failed to fetch mutual fund details" });
    }
  });

  app.get("/api/mutual-funds/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      const funds = await storage.searchMutualFunds(query);
      res.json(funds);
    } catch (error) {
      console.error("Error searching mutual funds:", error);
      res.status(500).json({ error: "Failed to search mutual funds" });
    }
  });

  app.get("/api/mutual-funds/popular", async (req, res) => {
    try {
      const popularFunds = await Promise.all(
        POPULAR_MF_SCHEMES.slice(0, 6).map(async (scheme) => {
          const existing = await storage.getMutualFund(scheme.code);
          if (existing) return existing;
          
          try {
            const data = await fetchMFAPI(`/mf/${scheme.code}`);
            const fundData = {
              schemeCode: scheme.code,
              schemeName: data.meta?.scheme_name || scheme.name,
              category: data.meta?.scheme_category || "Equity",
              fundHouse: data.meta?.fund_house || "Unknown AMC",
              nav: data.data?.[0]?.nav || "0"
            };
            
            return await storage.upsertMutualFund(fundData);
          } catch (error) {
            console.error(`Error fetching popular MF ${scheme.code}:`, error);
            return {
              schemeCode: scheme.code,
              schemeName: scheme.name,
              nav: "0"
            };
          }
        })
      );

      res.json(popularFunds);
    } catch (error) {
      console.error("Error fetching popular mutual funds:", error);
      res.status(500).json({ error: "Failed to fetch popular mutual funds" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
