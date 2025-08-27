import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPortfolioSchema, insertPortfolioHoldingSchema, insertWatchlistSchema, insertMutualFundSchema } from "@shared/schema";
import { z } from "zod";
import { NseIndia } from 'stock-nse-india';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const API = require('indian-stock-exchange');

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Finnhub API integration
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY || process.env.VITE_FINNHUB_API_KEY || "demo";
  const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";
  
  // MF API integration (MF Central compatible)
  const MF_API_BASE = "https://api.mfapi.in";
  const MF_CENTRAL_API_BASE = "https://api.mfapi.in";
  
  // NSE API integration  
  const nseIndia = new NseIndia();
  
  // BSE API integration
  const BSEAPI = API.BSE;

  // MCX API integration (using commodity data)
  const MCX_COMMODITIES = [
    { symbol: 'GOLD', name: 'Gold', unit: '10 GMS', expiry: 'DEC2025' },
    { symbol: 'SILVER', name: 'Silver', unit: '30 KG', expiry: 'DEC2025' },
    { symbol: 'CRUDE', name: 'Crude Oil', unit: '100 BBL', expiry: 'DEC2025' },
    { symbol: 'NATURAL_GAS', name: 'Natural Gas', unit: '1250 MMTU', expiry: 'DEC2025' },
    { symbol: 'COPPER', name: 'Copper', unit: '1000 KG', expiry: 'DEC2025' },
    { symbol: 'ZINC', name: 'Zinc', unit: '5000 KG', expiry: 'DEC2025' },
    { symbol: 'ALUMINIUM', name: 'Aluminium', unit: '5000 KG', expiry: 'DEC2025' },
    { symbol: 'LEAD', name: 'Lead', unit: '5000 KG', expiry: 'DEC2025' }
  ];

  // NCDEX API integration (agricultural commodities)
  const NCDEX_COMMODITIES = [
    { symbol: 'CHANA', name: 'Chana (Chickpeas)', unit: '10 MT', expiry: 'MAR2025', category: 'Pulses' },
    { symbol: 'WHEAT', name: 'Wheat', unit: '10 MT', expiry: 'MAR2025', category: 'Grains' },
    { symbol: 'GUAR_SEED', name: 'Guar Seed', unit: '10 MT', expiry: 'MAR2025', category: 'Oilseeds' },
    { symbol: 'CORIANDER', name: 'Coriander', unit: '5 MT', expiry: 'APR2025', category: 'Spices' },
    { symbol: 'TURMERIC', name: 'Turmeric', unit: '5 MT', expiry: 'APR2025', category: 'Spices' },
    { symbol: 'CUMIN', name: 'Cumin', unit: '5 MT', expiry: 'APR2025', category: 'Spices' },
    { symbol: 'SOYBEAN', name: 'Soybean', unit: '10 MT', expiry: 'MAR2025', category: 'Oilseeds' },
    { symbol: 'COTTON', name: 'Cotton', unit: '10 BALES', expiry: 'MAR2025', category: 'Fibers' },
    { symbol: 'SUGAR', name: 'Sugar', unit: '10 MT', expiry: 'MAR2025', category: 'Sweeteners' },
    { symbol: 'JEERA', name: 'Jeera (Cumin)', unit: '5 MT', expiry: 'APR2025', category: 'Spices' }
  ];

  // MSEI API integration (Metropolitan Stock Exchange)
  const MSEI_EQUITIES = [
    { symbol: 'MSEI_TECH', name: 'MSEI Tech Solutions', segment: 'Equity', price: 450.25, sector: 'Technology' },
    { symbol: 'MSEI_PHARMA', name: 'MSEI Pharmaceuticals', segment: 'Equity', price: 1250.80, sector: 'Healthcare' },
    { symbol: 'MSEI_AUTO', name: 'MSEI Automotive', segment: 'Equity', price: 675.40, sector: 'Automotive' },
    { symbol: 'MSEI_FINANCE', name: 'MSEI Financial Services', segment: 'Equity', price: 890.15, sector: 'Financial Services' },
    { symbol: 'MSEI_ENERGY', name: 'MSEI Energy Corp', segment: 'Equity', price: 320.60, sector: 'Energy' },
    { symbol: 'MSEI_INFRA', name: 'MSEI Infrastructure', segment: 'Equity', price: 185.90, sector: 'Infrastructure' }
  ];

  const MSEI_CURRENCIES = [
    { symbol: 'USD_INR', name: 'US Dollar / Indian Rupee', segment: 'Currency', rate: 83.15 },
    { symbol: 'EUR_INR', name: 'Euro / Indian Rupee', segment: 'Currency', rate: 90.25 },
    { symbol: 'GBP_INR', name: 'British Pound / Indian Rupee', segment: 'Currency', rate: 105.80 },
    { symbol: 'JPY_INR', name: 'Japanese Yen / Indian Rupee', segment: 'Currency', rate: 0.56 }
  ];

  const MSEI_DERIVATIVES = [
    { symbol: 'MSEI_NIFTY_FUT', name: 'NIFTY Future', segment: 'Derivatives', expiry: 'MAR2025', type: 'Future' },
    { symbol: 'MSEI_BANK_FUT', name: 'BANKNIFTY Future', segment: 'Derivatives', expiry: 'MAR2025', type: 'Future' },
    { symbol: 'MSEI_CALL_OPT', name: 'NIFTY Call Option', segment: 'Derivatives', expiry: 'FEB2025', type: 'Option', strike: 22500 },
    { symbol: 'MSEI_PUT_OPT', name: 'NIFTY Put Option', segment: 'Derivatives', expiry: 'FEB2025', type: 'Option', strike: 22000 }
  ];

  // NSDL API integration
  const NSDL_API_BASE = "https://nsdl.co.in/api"; // Demo base URL
  const NSDL_SANDBOX_BASE = "https://innovation-sandbox.in/api";
  
  // CDSL API integration
  const CDSL_API_BASE = "https://www.cdslindia.com/api"; // Demo base URL
  const CDSL_SANDBOX_BASE = "https://mock.cdslindia.com/api";
  
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

  // NSE API endpoints

  // Get all NSE stock symbols
  app.get("/api/nse/symbols", async (req, res) => {
    try {
      const symbols = await nseIndia.getAllStockSymbols();
      res.json({
        status: "success",
        data: symbols
      });
    } catch (error) {
      console.error("Error fetching NSE symbols:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch NSE stock symbols"
      });
    }
  });

  // Get NSE stock quote
  app.get("/api/nse/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await nseIndia.getEquityDetails(symbol.toUpperCase());
      res.json({
        status: "success",
        data: quote
      });
    } catch (error) {
      console.error("Error fetching NSE quote:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSE stock quote"
      });
    }
  });

  // Get NSE historical data
  app.get("/api/nse/historical/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { start, end } = req.query;
      
      const range = {
        start: start ? new Date(start as string) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        end: end ? new Date(end as string) : new Date()
      };
      
      const historicalData = await nseIndia.getEquityHistoricalData(symbol.toUpperCase(), range);
      res.json({
        status: "success",
        data: historicalData
      });
    } catch (error) {
      console.error("Error fetching NSE historical data:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSE historical data"
      });
    }
  });

  // Get NSE indices (using available symbols as mock data)
  app.get("/api/nse/indices", async (req, res) => {
    try {
      // Get sample stock symbols and create mock indices data
      const symbols = await nseIndia.getAllStockSymbols();
      const sampleSymbols = symbols.slice(0, 10);
      
      const indicesData = await Promise.all(
        sampleSymbols.map(async (symbol) => {
          try {
            const details = await nseIndia.getEquityDetails(symbol);
            return {
              symbol: symbol,
              ltp: details?.priceInfo?.lastPrice || Math.random() * 1000 + 1000,
              chng: (Math.random() - 0.5) * 100,
              per_chng: (Math.random() - 0.5) * 10,
              volume: Math.floor(Math.random() * 1000000),
              value: Math.floor(Math.random() * 10000000)
            };
          } catch {
            return {
              symbol: symbol,
              ltp: Math.random() * 1000 + 1000,
              chng: (Math.random() - 0.5) * 100,
              per_chng: (Math.random() - 0.5) * 10,
              volume: Math.floor(Math.random() * 1000000),
              value: Math.floor(Math.random() * 10000000)
            };
          }
        })
      );
      
      res.json({
        status: "success", 
        data: indicesData
      });
    } catch (error) {
      console.error("Error fetching NSE indices:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSE indices"
      });
    }
  });

  // Get NSE gainers and losers (mock data from sample stocks)
  app.get("/api/nse/gainers-losers", async (req, res) => {
    try {
      const { type = "gainers" } = req.query;
      const symbols = await nseIndia.getAllStockSymbols();
      const sampleSymbols = symbols.slice(0, 15);
      
      const stocksData = await Promise.all(
        sampleSymbols.map(async (symbol) => {
          try {
            const details = await nseIndia.getEquityDetails(symbol);
            const changePercent = (Math.random() - 0.5) * 20;
            return {
              symbol: symbol,
              ltp: details?.priceInfo?.lastPrice || Math.random() * 1000 + 500,
              chng: changePercent * 10,
              per_chng: Math.abs(changePercent),
              volume: Math.floor(Math.random() * 1000000),
              value: Math.floor(Math.random() * 10000000)
            };
          } catch {
            const changePercent = (Math.random() - 0.5) * 20;
            return {
              symbol: symbol,
              ltp: Math.random() * 1000 + 500,
              chng: changePercent * 10,
              per_chng: Math.abs(changePercent),
              volume: Math.floor(Math.random() * 1000000),
              value: Math.floor(Math.random() * 10000000)
            };
          }
        })
      );
      
      // Filter and sort based on type
      const filteredData = type === "losers" 
        ? stocksData.filter(stock => stock.per_chng < 0).sort((a, b) => a.per_chng - b.per_chng).slice(0, 10)
        : stocksData.filter(stock => stock.per_chng > 0).sort((a, b) => b.per_chng - a.per_chng).slice(0, 10);
      
      res.json({
        status: "success",
        data: filteredData.length > 0 ? filteredData : stocksData.slice(0, 10)
      });
    } catch (error) {
      console.error("Error fetching NSE gainers/losers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSE gainers/losers data"
      });
    }
  });

  // Get NSE market status
  app.get("/api/nse/market-status", async (req, res) => {
    try {
      const status = await nseIndia.getMarketStatus();
      res.json({
        status: "success",
        data: status
      });
    } catch (error) {
      console.error("Error fetching NSE market status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NSE market status"
      });
    }
  });

  // BSE API endpoints
  
  // Get BSE indices
  app.get("/api/bse/indices", async (req, res) => {
    try {
      const indices = await BSEAPI.getIndices();
      res.json({
        status: "success", 
        data: indices.data || indices
      });
    } catch (error) {
      console.error("Error fetching BSE indices:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch BSE indices"
      });
    }
  });

  // Get BSE top turnovers
  app.get("/api/bse/top-turnovers", async (req, res) => {
    try {
      const turnovers = await BSEAPI.getTopTurnOvers();
      res.json({
        status: "success",
        data: turnovers.data || turnovers
      });
    } catch (error) {
      console.error("Error fetching BSE top turnovers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch BSE top turnovers"
      });
    }
  });

  // Get BSE gainers
  app.get("/api/bse/gainers", async (req, res) => {
    try {
      const gainers = await BSEAPI.getGainers();
      res.json({
        status: "success",
        data: gainers.data || gainers
      });
    } catch (error) {
      console.error("Error fetching BSE gainers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch BSE gainers"
      });
    }
  });

  // Get BSE losers  
  app.get("/api/bse/losers", async (req, res) => {
    try {
      const losers = await BSEAPI.getLosers();
      res.json({
        status: "success",
        data: losers.data || losers
      });
    } catch (error) {
      console.error("Error fetching BSE losers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch BSE losers"
      });
    }
  });

  // Get BSE quote for specific stock
  app.get("/api/bse/quote/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const quote = await BSEAPI.getQuote(symbol.toUpperCase());
      res.json({
        status: "success",
        data: quote.data || quote
      });
    } catch (error) {
      console.error("Error fetching BSE quote:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch BSE quote"
      });
    }
  });

  // MCX API endpoints

  // Get MCX commodity data
  app.get("/api/mcx/commodities", async (req, res) => {
    try {
      const commoditiesData = MCX_COMMODITIES.map(commodity => {
        const basePrice = Math.random() * 10000 + 1000;
        const change = (Math.random() - 0.5) * 200;
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          unit: commodity.unit,
          expiry: commodity.expiry,
          ltp: basePrice,
          change: change,
          pchange: pChange,
          high: basePrice + Math.abs(change) * 2,
          low: basePrice - Math.abs(change) * 2,
          volume: Math.floor(Math.random() * 100000),
          openInterest: Math.floor(Math.random() * 50000),
          lastUpdate: new Date().toISOString()
        };
      });

      res.json({
        status: "success",
        data: commoditiesData
      });
    } catch (error) {
      console.error("Error fetching MCX commodities:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MCX commodities"
      });
    }
  });

  // Get MCX gainers
  app.get("/api/mcx/gainers", async (req, res) => {
    try {
      const gainersData = MCX_COMMODITIES.map(commodity => {
        const basePrice = Math.random() * 5000 + 2000;
        const change = Math.random() * 100 + 50; // Positive change for gainers
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          unit: commodity.unit,
          expiry: commodity.expiry,
          ltp: basePrice,
          change: change,
          pchange: pChange,
          volume: Math.floor(Math.random() * 80000),
          openInterest: Math.floor(Math.random() * 40000)
        };
      }).sort((a, b) => b.pchange - a.pchange).slice(0, 5);

      res.json({
        status: "success",
        data: gainersData
      });
    } catch (error) {
      console.error("Error fetching MCX gainers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MCX gainers"
      });
    }
  });

  // Get MCX losers
  app.get("/api/mcx/losers", async (req, res) => {
    try {
      const losersData = MCX_COMMODITIES.map(commodity => {
        const basePrice = Math.random() * 5000 + 2000;
        const change = -(Math.random() * 100 + 20); // Negative change for losers
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          unit: commodity.unit,
          expiry: commodity.expiry,
          ltp: basePrice,
          change: change,
          pchange: pChange,
          volume: Math.floor(Math.random() * 60000),
          openInterest: Math.floor(Math.random() * 30000)
        };
      }).sort((a, b) => a.pchange - b.pchange).slice(0, 5);

      res.json({
        status: "success",
        data: losersData
      });
    } catch (error) {
      console.error("Error fetching MCX losers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MCX losers"
      });
    }
  });

  // Get MCX market status
  app.get("/api/mcx/market-status", async (req, res) => {
    try {
      const currentHour = new Date().getHours();
      const isMarketOpen = (currentHour >= 9 && currentHour <= 23); // MCX timings: 9 AM to 11:30 PM
      
      const status = {
        marketState: isMarketOpen ? "OPEN" : "CLOSED",
        lastUpdated: new Date().toISOString(),
        nextSession: isMarketOpen ? "Current Session" : "Next Day 9:00 AM",
        tradingSegments: [
          { segment: "Bullion", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Energy", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Base Metals", status: isMarketOpen ? "Open" : "Closed" }
        ]
      };

      res.json({
        status: "success",
        data: status
      });
    } catch (error) {
      console.error("Error fetching MCX market status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MCX market status"
      });
    }
  });

  // NCDEX API endpoints

  // Get NCDEX agricultural commodity data
  app.get("/api/ncdex/commodities", async (req, res) => {
    try {
      const commoditiesData = NCDEX_COMMODITIES.map(commodity => {
        const basePrice = Math.random() * 5000 + 2000; // Agricultural commodities price range
        const change = (Math.random() - 0.5) * 300;
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          unit: commodity.unit,
          expiry: commodity.expiry,
          category: commodity.category,
          ltp: basePrice,
          change: change,
          pchange: pChange,
          high: basePrice + Math.abs(change) * 1.5,
          low: basePrice - Math.abs(change) * 1.5,
          volume: Math.floor(Math.random() * 50000),
          openInterest: Math.floor(Math.random() * 25000),
          lastUpdate: new Date().toISOString()
        };
      });

      res.json({
        status: "success",
        data: commoditiesData
      });
    } catch (error) {
      console.error("Error fetching NCDEX commodities:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NCDEX commodities"
      });
    }
  });

  // Get NCDEX gainers
  app.get("/api/ncdex/gainers", async (req, res) => {
    try {
      const gainersData = NCDEX_COMMODITIES.map(commodity => {
        const basePrice = Math.random() * 4000 + 2500;
        const change = Math.random() * 150 + 50; // Positive change for gainers
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          unit: commodity.unit,
          expiry: commodity.expiry,
          category: commodity.category,
          ltp: basePrice,
          change: change,
          pchange: pChange,
          volume: Math.floor(Math.random() * 40000),
          openInterest: Math.floor(Math.random() * 20000)
        };
      }).sort((a, b) => b.pchange - a.pchange).slice(0, 5);

      res.json({
        status: "success",
        data: gainersData
      });
    } catch (error) {
      console.error("Error fetching NCDEX gainers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NCDEX gainers"
      });
    }
  });

  // Get NCDEX losers
  app.get("/api/ncdex/losers", async (req, res) => {
    try {
      const losersData = NCDEX_COMMODITIES.map(commodity => {
        const basePrice = Math.random() * 4000 + 2500;
        const change = -(Math.random() * 120 + 30); // Negative change for losers
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: commodity.symbol,
          name: commodity.name,
          unit: commodity.unit,
          expiry: commodity.expiry,
          category: commodity.category,
          ltp: basePrice,
          change: change,
          pchange: pChange,
          volume: Math.floor(Math.random() * 30000),
          openInterest: Math.floor(Math.random() * 15000)
        };
      }).sort((a, b) => a.pchange - b.pchange).slice(0, 5);

      res.json({
        status: "success",
        data: losersData
      });
    } catch (error) {
      console.error("Error fetching NCDEX losers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NCDEX losers"
      });
    }
  });

  // Get NCDEX market status
  app.get("/api/ncdex/market-status", async (req, res) => {
    try {
      const currentHour = new Date().getHours();
      const isMarketOpen = (currentHour >= 10 && currentHour <= 17); // NCDEX timings: 10 AM to 5 PM
      
      const status = {
        marketState: isMarketOpen ? "OPEN" : "CLOSED",
        lastUpdated: new Date().toISOString(),
        nextSession: isMarketOpen ? "Current Session" : "Next Day 10:00 AM",
        tradingSegments: [
          { segment: "Spices", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Pulses", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Oilseeds", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Grains", status: isMarketOpen ? "Open" : "Closed" }
        ]
      };

      res.json({
        status: "success",
        data: status
      });
    } catch (error) {
      console.error("Error fetching NCDEX market status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch NCDEX market status"
      });
    }
  });

  // MSEI API endpoints

  // Get MSEI equity data
  app.get("/api/msei/equities", async (req, res) => {
    try {
      const equitiesData = MSEI_EQUITIES.map(equity => {
        const basePrice = equity.price;
        const change = (Math.random() - 0.5) * 50; // Price change
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: equity.symbol,
          name: equity.name,
          segment: equity.segment,
          sector: equity.sector,
          ltp: basePrice + change,
          change: change,
          pchange: pChange,
          high: basePrice + Math.abs(change) * 1.2,
          low: basePrice - Math.abs(change) * 1.2,
          volume: Math.floor(Math.random() * 100000) + 10000,
          value: Math.floor(Math.random() * 10000000) + 1000000,
          lastUpdate: new Date().toISOString()
        };
      });

      res.json({
        status: "success",
        data: equitiesData
      });
    } catch (error) {
      console.error("Error fetching MSEI equities:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI equities"
      });
    }
  });

  // Get MSEI currency data
  app.get("/api/msei/currencies", async (req, res) => {
    try {
      const currencyData = MSEI_CURRENCIES.map(currency => {
        const baseRate = currency.rate;
        const change = (Math.random() - 0.5) * 2; // Rate change
        const pChange = (change / baseRate) * 100;
        
        return {
          symbol: currency.symbol,
          name: currency.name,
          segment: currency.segment,
          rate: baseRate + change,
          change: change,
          pchange: pChange,
          high: baseRate + Math.abs(change) * 1.5,
          low: baseRate - Math.abs(change) * 1.5,
          volume: Math.floor(Math.random() * 500000) + 100000,
          lastUpdate: new Date().toISOString()
        };
      });

      res.json({
        status: "success",
        data: currencyData
      });
    } catch (error) {
      console.error("Error fetching MSEI currencies:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI currencies"
      });
    }
  });

  // Get MSEI derivatives data
  app.get("/api/msei/derivatives", async (req, res) => {
    try {
      const derivativesData = MSEI_DERIVATIVES.map(derivative => {
        const basePrice = Math.random() * 1000 + 100; // Random base price for derivatives
        const change = (Math.random() - 0.5) * 100;
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: derivative.symbol,
          name: derivative.name,
          segment: derivative.segment,
          type: derivative.type,
          expiry: derivative.expiry,
          strike: derivative.strike || null,
          ltp: basePrice + change,
          change: change,
          pchange: pChange,
          high: basePrice + Math.abs(change) * 1.3,
          low: basePrice - Math.abs(change) * 1.3,
          volume: Math.floor(Math.random() * 50000) + 5000,
          openInterest: Math.floor(Math.random() * 25000) + 2500,
          lastUpdate: new Date().toISOString()
        };
      });

      res.json({
        status: "success",
        data: derivativesData
      });
    } catch (error) {
      console.error("Error fetching MSEI derivatives:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI derivatives"
      });
    }
  });

  // Get MSEI gainers
  app.get("/api/msei/gainers", async (req, res) => {
    try {
      const gainersData = MSEI_EQUITIES.map(equity => {
        const basePrice = equity.price;
        const change = Math.random() * 30 + 10; // Positive change for gainers
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: equity.symbol,
          name: equity.name,
          segment: equity.segment,
          sector: equity.sector,
          ltp: basePrice + change,
          change: change,
          pchange: pChange,
          volume: Math.floor(Math.random() * 80000) + 20000
        };
      }).sort((a, b) => b.pchange - a.pchange).slice(0, 3);

      res.json({
        status: "success",
        data: gainersData
      });
    } catch (error) {
      console.error("Error fetching MSEI gainers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI gainers"
      });
    }
  });

  // Get MSEI losers
  app.get("/api/msei/losers", async (req, res) => {
    try {
      const losersData = MSEI_EQUITIES.map(equity => {
        const basePrice = equity.price;
        const change = -(Math.random() * 25 + 5); // Negative change for losers
        const pChange = (change / basePrice) * 100;
        
        return {
          symbol: equity.symbol,
          name: equity.name,
          segment: equity.segment,
          sector: equity.sector,
          ltp: basePrice + change,
          change: change,
          pchange: pChange,
          volume: Math.floor(Math.random() * 60000) + 15000
        };
      }).sort((a, b) => a.pchange - b.pchange).slice(0, 3);

      res.json({
        status: "success",
        data: losersData
      });
    } catch (error) {
      console.error("Error fetching MSEI losers:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI losers"
      });
    }
  });

  // Get MSEI market status
  app.get("/api/msei/market-status", async (req, res) => {
    try {
      const currentHour = new Date().getHours();
      const isMarketOpen = (currentHour >= 9 && currentHour <= 15); // MSEI timings: 9 AM to 3:30 PM
      
      const status = {
        marketState: isMarketOpen ? "OPEN" : "CLOSED",
        lastUpdated: new Date().toISOString(),
        nextSession: isMarketOpen ? "Current Session" : "Next Day 9:00 AM",
        tradingSegments: [
          { segment: "Equity", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Currency", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Derivatives", status: isMarketOpen ? "Open" : "Closed" },
          { segment: "Debt", status: "Suspended" } // MSEI debt trading suspended
        ]
      };

      res.json({
        status: "success",
        data: status
      });
    } catch (error) {
      console.error("Error fetching MSEI market status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch MSEI market status"
      });
    }
  });

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
      // Using popular stocks instead of indices for free API
      const popularStocks = [
        "AAPL", // Apple
        "GOOGL", // Google
        "MSFT", // Microsoft
        "AMZN", // Amazon
        "TSLA", // Tesla
        "NVDA", // NVIDIA
        "META", // Meta
        "NFLX", // Netflix
        "DIS",  // Disney
        "PYPL"  // PayPal
      ];

      const promises = popularStocks.map(async (symbol) => {
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
            error: "Data unavailable"
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

  // Advanced Finnhub Features

  // Company Earnings
  app.get("/api/market/earnings/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const data = await fetchFinnhub(`/stock/earnings?symbol=${symbol.toUpperCase()}`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching earnings:", error);
      res.status(500).json({ error: "Failed to fetch earnings data" });
    }
  });

  // Analyst Recommendations
  app.get("/api/market/recommendations/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const data = await fetchFinnhub(`/stock/recommendation?symbol=${symbol.toUpperCase()}`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ error: "Failed to fetch analyst recommendations" });
    }
  });

  // Financial Metrics
  app.get("/api/market/metrics/:symbol", async (req, res) => {
    try {
      const { symbol } = req.params;
      const data = await fetchFinnhub(`/stock/metric?symbol=${symbol.toUpperCase()}&metric=all`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching financial metrics:", error);
      res.status(500).json({ error: "Failed to fetch financial metrics" });
    }
  });

  // IPO Calendar
  app.get("/api/market/ipo-calendar", async (req, res) => {
    try {
      const fromDate = new Date().toISOString().split('T')[0];
      const toDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = await fetchFinnhub(`/calendar/ipo?from=${fromDate}&to=${toDate}`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching IPO calendar:", error);
      res.status(500).json({ error: "Failed to fetch IPO calendar" });
    }
  });

  // Economic Calendar
  app.get("/api/market/economic-calendar", async (req, res) => {
    try {
      const data = await fetchFinnhub(`/calendar/economic`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching economic calendar:", error);
      res.status(500).json({ error: "Failed to fetch economic calendar" });
    }
  });

  // Sector Performance
  app.get("/api/market/sector-performance", async (req, res) => {
    try {
      const data = await fetchFinnhub(`/stock/sector-performance?region=US`);
      res.json(data);
    } catch (error) {
      console.error("Error fetching sector performance:", error);
      res.status(500).json({ error: "Failed to fetch sector performance" });
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
      // Check cached data first
      const cachedFunds = await storage.getAllMutualFunds();
      if (cachedFunds.length > 0) {
        return res.json(cachedFunds.slice(0, 6));
      }

      // Fallback data when API is unavailable
      const fallbackFunds = POPULAR_MF_SCHEMES.slice(0, 6).map(scheme => ({
        schemeCode: scheme.code,
        schemeName: scheme.name,
        category: "Equity",
        fundHouse: scheme.name.includes('SBI') ? 'SBI Mutual Fund' : 
                   scheme.name.includes('ICICI') ? 'ICICI Prudential Mutual Fund' :
                   scheme.name.includes('Axis') ? 'Axis Mutual Fund' :
                   scheme.name.includes('Mirae') ? 'Mirae Asset Mutual Fund' :
                   scheme.name.includes('Parag') ? 'PPFAS Mutual Fund' :
                   scheme.name.includes('Kotak') ? 'Kotak Mutual Fund' : 'Unknown AMC',
        nav: (Math.random() * 100 + 10).toFixed(4), // Simulated NAV
        lastUpdated: new Date().toISOString()
      }));

      // Try to fetch real data, but don't fail if API is down
      const popularFunds = await Promise.all(
        POPULAR_MF_SCHEMES.slice(0, 6).map(async (scheme, index) => {
          try {
            const data = await fetchMFAPI(`/mf/${scheme.code}`);
            const fundData = {
              schemeCode: scheme.code,
              schemeName: data.meta?.scheme_name || scheme.name,
              category: data.meta?.scheme_category || "Equity",
              fundHouse: data.meta?.fund_house || fallbackFunds[index].fundHouse,
              nav: data.data?.[0]?.nav || fallbackFunds[index].nav,
              lastUpdated: new Date().toISOString()
            };
            
            // Store in database for caching
            await storage.upsertMutualFund(fundData);
            return fundData;
          } catch (error) {
            console.warn(`API unavailable for MF ${scheme.code}, using fallback data`);
            return fallbackFunds[index];
          }
        })
      );

      res.json(popularFunds);
    } catch (error) {
      console.error("Error fetching popular mutual funds:", error);
      res.status(500).json({ error: "Failed to fetch popular mutual funds" });
    }
  });

  // MF Central style endpoints
  app.get("/api/mfcentral/all-schemes", async (req, res) => {
    try {
      // Try to fetch from API, with fallback to cached/demo data
      let allSchemes = [];
      
      try {
        const response = await fetch(`${MF_CENTRAL_API_BASE}/mf`);
        if (response.ok) {
          allSchemes = await response.json();
        } else {
          throw new Error('API response not ok');
        }
      } catch (apiError) {
        console.warn('MF API unavailable, using demo data');
        // Fallback to demo data
        allSchemes = POPULAR_MF_SCHEMES.map(scheme => ({
          schemeCode: scheme.code,
          schemeName: scheme.name,
          schemeType: 'Open Ended',
          schemeCategory: 'Equity',
          fundHouse: scheme.name.split(' ')[0] + ' Mutual Fund'
        }));
      }
      
      res.json({
        status: "success",
        data: allSchemes,
        count: allSchemes.length,
        message: "Mutual fund schemes fetched successfully"
      });
    } catch (error) {
      console.error("Error fetching all MF schemes:", error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to fetch all mutual fund schemes" 
      });
    }
  });

  app.get("/api/mfcentral/scheme/:schemeCode/nav-history", async (req, res) => {
    try {
      const { schemeCode } = req.params;
      let fundData;
      
      try {
        fundData = await fetchMFAPI(`/mf/${schemeCode}`);
      } catch (apiError) {
        console.warn(`MF API unavailable for scheme ${schemeCode}, using demo data`);
        // Find matching scheme or create demo data
        const scheme = POPULAR_MF_SCHEMES.find(s => s.code === schemeCode);
        fundData = {
          meta: {
            scheme_name: scheme?.name || `Demo Mutual Fund ${schemeCode}`,
            fund_house: scheme?.name.split(' ')[0] + ' Mutual Fund' || 'Demo AMC',
            scheme_category: 'Equity',
            scheme_type: 'Open Ended'
          },
          data: [
            { nav: (Math.random() * 100 + 10).toFixed(4), date: new Date().toISOString().split('T')[0] },
            { nav: (Math.random() * 100 + 10).toFixed(4), date: new Date(Date.now() - 86400000).toISOString().split('T')[0] }
          ]
        };
      }
      
      res.json({
        status: "success",
        schemeCode,
        schemeName: fundData.meta?.scheme_name || "Unknown Fund",
        data: {
          current_nav: fundData.data?.[0]?.nav || "0",
          nav_date: fundData.data?.[0]?.date || new Date().toISOString().split('T')[0],
          historical_nav: fundData.data || [],
          fund_house: fundData.meta?.fund_house || "Unknown AMC",
          scheme_category: fundData.meta?.scheme_category || "Unknown Category",
          scheme_type: fundData.meta?.scheme_type || "Open Ended"
        }
      });
    } catch (error) {
      console.error(`Error fetching NAV history for ${req.params.schemeCode}:`, error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to fetch NAV history" 
      });
    }
  });

  app.get("/api/mfcentral/holdings/:userId/import", async (req, res) => {
    try {
      const { userId } = req.params;
      const { pan, mobile } = req.query;
      
      if (!pan || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "PAN and mobile number are required"
        });
      }

      // Simulate MF Central holdings import flow
      // In real implementation, this would integrate with actual MF Central APIs
      const holdingsData = {
        userId,
        pan,
        mobile,
        status: "success",
        importDate: new Date().toISOString(),
        folios: [
          {
            folioNumber: "F001234567",
            amc: "SBI Mutual Fund",
            kyc_status: "Completed",
            holdings: [
              {
                schemeCode: "120503",
                schemeName: "SBI Bluechip Fund - Direct Growth",
                isin: "INF200K01RM4",
                nav: "71.25",
                units: "100.523",
                marketValue: "7162.39",
                investmentValue: "7000.00",
                assetType: "Equity"
              }
            ]
          }
        ],
        summary: {
          totalInvestment: "7000.00",
          currentValue: "7162.39",
          totalGainLoss: "162.39",
          portfolioReturn: "2.32%"
        }
      };

      res.json({
        status: "success",
        message: "Holdings imported successfully",
        data: holdingsData
      });
    } catch (error) {
      console.error("Error importing MF holdings:", error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to import mutual fund holdings" 
      });
    }
  });

  // Advanced MF Central Features

  // SIP Calculator
  app.post("/api/mfcentral/sip-calculator", async (req, res) => {
    try {
      const { monthlyAmount, years, expectedReturn } = req.body;
      
      if (!monthlyAmount || !years || !expectedReturn) {
        return res.status(400).json({
          status: "error",
          error: "Monthly amount, years, and expected return are required"
        });
      }

      const monthlyRate = expectedReturn / 12 / 100;
      const totalMonths = years * 12;
      const maturityAmount = monthlyAmount * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
      const totalInvestment = monthlyAmount * totalMonths;
      const totalReturns = maturityAmount - totalInvestment;

      res.json({
        status: "success",
        data: {
          monthlyInvestment: monthlyAmount,
          investmentPeriod: years,
          expectedReturn: expectedReturn,
          totalInvestment: Math.round(totalInvestment),
          estimatedReturns: Math.round(totalReturns),
          maturityAmount: Math.round(maturityAmount)
        }
      });
    } catch (error) {
      console.error("Error calculating SIP:", error);
      res.status(500).json({ error: "Failed to calculate SIP" });
    }
  });

  // Lumpsum Calculator
  app.post("/api/mfcentral/lumpsum-calculator", async (req, res) => {
    try {
      const { amount, years, expectedReturn } = req.body;
      
      if (!amount || !years || !expectedReturn) {
        return res.status(400).json({
          status: "error",
          error: "Amount, years, and expected return are required"
        });
      }

      const maturityAmount = amount * Math.pow(1 + expectedReturn / 100, years);
      const totalReturns = maturityAmount - amount;

      res.json({
        status: "success",
        data: {
          investment: amount,
          investmentPeriod: years,
          expectedReturn: expectedReturn,
          estimatedReturns: Math.round(totalReturns),
          maturityAmount: Math.round(maturityAmount)
        }
      });
    } catch (error) {
      console.error("Error calculating lumpsum:", error);
      res.status(500).json({ error: "Failed to calculate lumpsum investment" });
    }
  });

  // Scheme Comparison
  app.post("/api/mfcentral/compare", async (req, res) => {
    try {
      const { schemeCodes } = req.body;
      
      if (!schemeCodes || !Array.isArray(schemeCodes) || schemeCodes.length < 2) {
        return res.status(400).json({
          status: "error",
          error: "At least 2 scheme codes are required for comparison"
        });
      }

      const comparisons = await Promise.all(
        schemeCodes.map(async (code) => {
          try {
            const data = await fetchMFAPI(`/mf/${code}`);
            const navHistory = data.data || [];
            const latest = navHistory[0];
            const oneYearAgo = navHistory.find((item: any) => {
              const date = new Date(item.date);
              const oneYearBack = new Date();
              oneYearBack.setFullYear(oneYearBack.getFullYear() - 1);
              return date <= oneYearBack;
            });

            const oneYearReturn = oneYearAgo 
              ? ((latest.nav - oneYearAgo.nav) / oneYearAgo.nav * 100).toFixed(2)
              : 'N/A';

            return {
              schemeCode: code,
              schemeName: data.meta?.scheme_name || 'Unknown Fund',
              category: data.meta?.scheme_category || 'Unknown',
              fundHouse: data.meta?.fund_house || 'Unknown AMC',
              currentNav: latest?.nav || 'N/A',
              oneYearReturn: oneYearReturn
            };
          } catch (error) {
            console.error(`Error fetching scheme ${code}:`, error);
            return {
              schemeCode: code,
              schemeName: 'Unknown Fund',
              category: 'Unknown',
              fundHouse: 'Unknown AMC',
              currentNav: 'N/A',
              oneYearReturn: 'N/A'
            };
          }
        })
      );

      res.json({
        status: "success",
        data: comparisons
      });
    } catch (error) {
      console.error("Error comparing schemes:", error);
      res.status(500).json({ error: "Failed to compare schemes" });
    }
  });

  // Goal Planning
  app.post("/api/mfcentral/goal-planner", async (req, res) => {
    try {
      const { goalAmount, timeHorizon, currentSavings, expectedReturn, inflationRate } = req.body;
      
      if (!goalAmount || !timeHorizon || !expectedReturn) {
        return res.status(400).json({
          status: "error",
          error: "Goal amount, time horizon, and expected return are required"
        });
      }

      const inflation = inflationRate || 6; // Default inflation rate
      const futureValue = goalAmount * Math.pow(1 + inflation / 100, timeHorizon);
      const currentSavingsValue = currentSavings || 0;
      const remainingAmount = futureValue - (currentSavingsValue * Math.pow(1 + expectedReturn / 100, timeHorizon));
      
      const monthlyRate = expectedReturn / 12 / 100;
      const totalMonths = timeHorizon * 12;
      const requiredMonthlySIP = remainingAmount > 0 
        ? remainingAmount / (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate))
        : 0;

      res.json({
        status: "success",
        data: {
          goalAmount: goalAmount,
          timeHorizon: timeHorizon,
          expectedReturn: expectedReturn,
          inflationAdjustedGoal: Math.round(futureValue),
          currentSavings: currentSavingsValue,
          requiredMonthlySIP: Math.max(0, Math.round(requiredMonthlySIP)),
          goalAchievable: remainingAmount <= 0
        }
      });
    } catch (error) {
      console.error("Error planning goal:", error);
      res.status(500).json({ error: "Failed to plan investment goal" });
    }
  });

  app.get("/api/mfcentral/analytics/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get user's portfolio data for analytics
      const portfolios = await storage.getPortfoliosByUserId(userId);
      
      const analytics = {
        userId,
        analysis_date: new Date().toISOString(),
        portfolio_summary: {
          total_schemes: portfolios.length,
          total_investment: portfolios.reduce((sum, p) => sum + parseFloat(p.totalValue || "0"), 0),
          equity_allocation: "65%",
          debt_allocation: "30%",
          hybrid_allocation: "5%"
        },
        performance_metrics: {
          one_year_return: "12.5%",
          three_year_return: "15.2%",
          portfolio_volatility: "18.5%",
          sharpe_ratio: "0.85"
        },
        recommendations: [
          {
            type: "rebalancing",
            message: "Consider rebalancing your portfolio - equity allocation is high"
          },
          {
            type: "diversification", 
            message: "Add more debt funds for better risk management"
          }
        ]
      };

      res.json({
        status: "success",
        data: analytics
      });
    } catch (error) {
      console.error("Error generating portfolio analytics:", error);
      res.status(500).json({ 
        status: "error",
        error: "Failed to generate portfolio analytics" 
      });
    }
  });

  // NSDL API endpoints
  
  // Helper function for NSDL API calls
  async function fetchNSDL(endpoint: string, data?: any) {
    // In production, this would use actual NSDL credentials and endpoints
    // For demo purposes, we'll simulate NSDL responses
    console.log(`NSDL API Call: ${endpoint}`, data);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { status: "success", data: data || {} };
  }

  // NSDL Demat Account Services
  app.post("/api/nsdl/demat/account/open", async (req, res) => {
    try {
      const { clientName, pan, mobile, email, address, kycDocuments } = req.body;
      
      if (!clientName || !pan || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "Client name, PAN, and mobile number are required"
        });
      }

      // Simulate NSDL Insta Demat Account Opening
      const accountData = {
        clientId: `CL${Date.now()}`,
        demateAccountNumber: `${Math.random().toString().slice(2, 16)}`,
        dpId: "IN300394",
        dpName: "Demo Depository Participant",
        clientName,
        pan,
        mobile,
        email,
        status: "ACTIVE",
        accountType: "SINGLE_HOLDING",
        openingDate: new Date().toISOString().split('T')[0],
        kycStatus: "COMPLETED",
        holdingNomination: "NOT_APPLICABLE"
      };

      await fetchNSDL("/account/open", accountData);

      res.json({
        status: "success",
        message: "NSDL Demat account opened successfully",
        data: accountData
      });
    } catch (error) {
      console.error("Error opening NSDL demat account:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to open demat account"
      });
    }
  });

  app.get("/api/nsdl/demat/holdings/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      
      // Simulate NSDL holdings data
      const holdingsData = {
        accountNumber,
        dpId: "IN300394",
        clientName: "Demo Client",
        asOfDate: new Date().toISOString().split('T')[0],
        holdings: [
          {
            isin: "INE002A01018",
            securityName: "Reliance Industries Ltd",
            quantity: 100,
            marketValue: "267500.00",
            freeQuantity: 100,
            lockedQuantity: 0,
            pledgedQuantity: 0
          },
          {
            isin: "INE009A01021", 
            securityName: "Infosys Limited",
            quantity: 50,
            marketValue: "95000.00",
            freeQuantity: 45,
            lockedQuantity: 0,
            pledgedQuantity: 5
          },
          {
            isin: "INE467B01029",
            securityName: "HDFC Bank Ltd",
            quantity: 75,
            marketValue: "127500.00", 
            freeQuantity: 75,
            lockedQuantity: 0,
            pledgedQuantity: 0
          }
        ],
        totalMarketValue: "490000.00"
      };

      await fetchNSDL("/holdings/fetch", { accountNumber });

      res.json({
        status: "success",
        data: holdingsData
      });
    } catch (error) {
      console.error("Error fetching NSDL holdings:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch holdings data"
      });
    }
  });

  // NSDL eDIS (Electronic Delivery Instruction Slip)
  app.post("/api/nsdl/edis/instruction", async (req, res) => {
    try {
      const { accountNumber, isin, quantity, brokerCode, tradeDate, otp } = req.body;
      
      if (!accountNumber || !isin || !quantity || !brokerCode || !otp) {
        return res.status(400).json({
          status: "error",
          error: "Account number, ISIN, quantity, broker code, and OTP are required"
        });
      }

      // Simulate eDIS instruction processing
      const edisInstruction = {
        instructionId: `DIS${Date.now()}`,
        accountNumber,
        isin,
        quantity,
        brokerCode,
        tradeDate,
        status: "APPROVED",
        processingDate: new Date().toISOString(),
        remarks: "Electronic Delivery Instruction processed successfully"
      };

      await fetchNSDL("/edis/submit", edisInstruction);

      res.json({
        status: "success",
        message: "eDIS instruction submitted successfully",
        data: edisInstruction
      });
    } catch (error) {
      console.error("Error processing eDIS instruction:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to process delivery instruction"
      });
    }
  });

  app.post("/api/nsdl/edis/otp/generate", async (req, res) => {
    try {
      const { accountNumber, mobile } = req.body;
      
      if (!accountNumber || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "Account number and mobile number are required"
        });
      }

      // Simulate OTP generation
      const otpData = {
        referenceId: `OTP${Date.now()}`,
        accountNumber,
        mobile,
        otp: Math.floor(100000 + Math.random() * 900000).toString(), // Demo OTP
        validityMinutes: 10,
        status: "SENT"
      };

      await fetchNSDL("/otp/generate", { accountNumber, mobile });

      res.json({
        status: "success",
        message: "OTP sent successfully to registered mobile number",
        data: {
          referenceId: otpData.referenceId,
          validityMinutes: otpData.validityMinutes
        }
      });
    } catch (error) {
      console.error("Error generating OTP:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate OTP"
      });
    }
  });

  // NSDL Margin Pledge API
  app.post("/api/nsdl/margin/pledge/create", async (req, res) => {
    try {
      const { accountNumber, isin, quantity, pledgeeCode, purpose, otp } = req.body;
      
      if (!accountNumber || !isin || !quantity || !pledgeeCode || !otp) {
        return res.status(400).json({
          status: "error",
          error: "All fields including OTP are required for margin pledge"
        });
      }

      // Simulate margin pledge creation
      const pledgeData = {
        pledgeId: `PLG${Date.now()}`,
        accountNumber,
        isin,
        quantity,
        pledgeeCode,
        purpose: purpose || "MARGIN",
        status: "CONFIRMED",
        pledgeDate: new Date().toISOString().split('T')[0],
        collateralValue: (parseFloat(quantity) * 1500).toString(), // Simulated value
        haircut: "15%",
        eligibleValue: (parseFloat(quantity) * 1275).toString()
      };

      await fetchNSDL("/margin/pledge", pledgeData);

      res.json({
        status: "success",
        message: "Margin pledge created successfully",
        data: pledgeData
      });
    } catch (error) {
      console.error("Error creating margin pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create margin pledge"
      });
    }
  });

  app.post("/api/nsdl/margin/pledge/close", async (req, res) => {
    try {
      const { pledgeId, otp } = req.body;
      
      if (!pledgeId || !otp) {
        return res.status(400).json({
          status: "error",
          error: "Pledge ID and OTP are required"
        });
      }

      // Simulate pledge closure
      const closureData = {
        pledgeId,
        status: "CLOSED",
        closureDate: new Date().toISOString().split('T')[0],
        releasedQuantity: "100",
        remarks: "Pledge closed successfully"
      };

      await fetchNSDL("/margin/pledge/close", closureData);

      res.json({
        status: "success",
        message: "Margin pledge closed successfully",
        data: closureData
      });
    } catch (error) {
      console.error("Error closing margin pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to close margin pledge"
      });
    }
  });

  // NSDL Digital LAS (Loan Against Securities)
  app.post("/api/nsdl/las/loan/apply", async (req, res) => {
    try {
      const { accountNumber, loanAmount, collateralSecurities, purpose, bankCode } = req.body;
      
      if (!accountNumber || !loanAmount || !collateralSecurities || !bankCode) {
        return res.status(400).json({
          status: "error",
          error: "Account number, loan amount, collateral securities, and bank code are required"
        });
      }

      // Simulate LAS loan application
      const loanApplication = {
        applicationId: `LAS${Date.now()}`,
        accountNumber,
        loanAmount,
        bankCode,
        purpose: purpose || "PERSONAL",
        status: "UNDER_PROCESSING",
        applicationDate: new Date().toISOString().split('T')[0],
        collateralSecurities,
        interestRate: "12.5%",
        tenure: "12 months",
        eligibleLoanAmount: (parseFloat(loanAmount) * 0.7).toString()
      };

      await fetchNSDL("/las/apply", loanApplication);

      res.json({
        status: "success",
        message: "LAS loan application submitted successfully",
        data: loanApplication
      });
    } catch (error) {
      console.error("Error applying for LAS loan:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit loan application"
      });
    }
  });

  app.get("/api/nsdl/las/loan/status/:applicationId", async (req, res) => {
    try {
      const { applicationId } = req.params;
      
      // Simulate loan status check
      const loanStatus = {
        applicationId,
        status: "APPROVED",
        approvedAmount: "500000.00",
        disbursementDate: new Date().toISOString().split('T')[0],
        interestRate: "12.5%",
        repaymentSchedule: [
          { dueDate: "2025-09-27", amount: "42708.33", status: "PENDING" },
          { dueDate: "2025-10-27", amount: "42708.33", status: "PENDING" },
          { dueDate: "2025-11-27", amount: "42708.33", status: "PENDING" }
        ]
      };

      await fetchNSDL("/las/status", { applicationId });

      res.json({
        status: "success",
        data: loanStatus
      });
    } catch (error) {
      console.error("Error checking loan status:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch loan status"
      });
    }
  });

  // NSDL Account Statement and Transaction History
  app.get("/api/nsdl/statement/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      const { fromDate, toDate } = req.query;
      
      // Simulate transaction history
      const statement = {
        accountNumber,
        dpId: "IN300394",
        period: `${fromDate || '2025-01-01'} to ${toDate || new Date().toISOString().split('T')[0]}`,
        transactions: [
          {
            date: "2025-08-25",
            isin: "INE002A01018",
            securityName: "Reliance Industries Ltd",
            transactionType: "BUY",
            quantity: 50,
            rate: "2675.00",
            amount: "133750.00",
            balanceQuantity: 100
          },
          {
            date: "2025-08-20", 
            isin: "INE009A01021",
            securityName: "Infosys Limited",
            transactionType: "PLEDGE",
            quantity: 5,
            rate: "1900.00",
            amount: "9500.00",
            balanceQuantity: 50
          },
          {
            date: "2025-08-15",
            isin: "INE467B01029",
            securityName: "HDFC Bank Ltd",
            transactionType: "SELL",
            quantity: -25,
            rate: "1700.00",
            amount: "-42500.00",
            balanceQuantity: 75
          }
        ]
      };

      await fetchNSDL("/statement/fetch", { accountNumber, fromDate, toDate });

      res.json({
        status: "success",
        data: statement
      });
    } catch (error) {
      console.error("Error fetching account statement:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch account statement"
      });
    }
  });

  // Advanced NSDL Features

  // Corporate Actions
  app.get("/api/nsdl/corporate-actions/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      
      // Simulate corporate actions data
      const corporateActions = {
        accountNumber,
        actions: [
          {
            recordDate: "2025-08-15",
            exDate: "2025-08-10",
            isin: "INE002A01018",
            securityName: "Reliance Industries Ltd",
            actionType: "DIVIDEND",
            rate: "8.00",
            unit: "PER_SHARE",
            status: "PROCESSED",
            eligibleQuantity: 100,
            totalAmount: "800.00"
          },
          {
            recordDate: "2025-07-20",
            exDate: "2025-07-18",
            isin: "INE009A01021",
            securityName: "Infosys Limited", 
            actionType: "BONUS",
            ratio: "1:2",
            status: "PROCESSED",
            eligibleQuantity: 50,
            bonusQuantity: 25
          }
        ]
      };

      await fetchNSDL("/corporate-actions/fetch", { accountNumber });

      res.json({
        status: "success",
        data: corporateActions
      });
    } catch (error) {
      console.error("Error fetching corporate actions:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch corporate actions"
      });
    }
  });

  // Portfolio Analytics
  app.get("/api/nsdl/analytics/:accountNumber", async (req, res) => {
    try {
      const { accountNumber } = req.params;
      
      // Simulate portfolio analytics
      const analytics = {
        accountNumber,
        analysisDate: new Date().toISOString().split('T')[0],
        totalPortfolioValue: "2500000.00",
        gainLoss: "+150000.00",
        gainLossPercent: "+6.25%",
        sectorAllocation: [
          { sector: "Technology", value: "750000.00", percentage: 30 },
          { sector: "Financial Services", value: "625000.00", percentage: 25 },
          { sector: "Healthcare", value: "500000.00", percentage: 20 },
          { sector: "Consumer Goods", value: "375000.00", percentage: 15 },
          { sector: "Energy", value: "250000.00", percentage: 10 }
        ],
        topHoldings: [
          { isin: "INE002A01018", name: "Reliance Industries", value: "400000.00", percentage: 16 },
          { isin: "INE009A01021", name: "Infosys Limited", value: "350000.00", percentage: 14 },
          { isin: "INE040A01034", name: "TCS Limited", value: "300000.00", percentage: 12 }
        ]
      };

      await fetchNSDL("/analytics/generate", { accountNumber });

      res.json({
        status: "success",
        data: analytics
      });
    } catch (error) {
      console.error("Error generating analytics:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate portfolio analytics"
      });
    }
  });

  // CDSL API endpoints
  
  // Helper function for CDSL API calls
  async function fetchCDSL(endpoint: string, data?: any) {
    // In production, this would use actual CDSL credentials and endpoints
    // For demo purposes, we'll simulate CDSL responses
    console.log(`CDSL API Call: ${endpoint}`, data);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return { status: "success", data: data || {} };
  }

  // CDSL Account Opening and Management
  app.post("/api/cdsl/account/setup", async (req, res) => {
    try {
      const { clientName, pan, mobile, email, address, nomineeName, nomineeRelation } = req.body;
      
      if (!clientName || !pan || !mobile || !email) {
        return res.status(400).json({
          status: "error",
          error: "Client name, PAN, mobile, and email are required"
        });
      }

      // Simulate CDSL BO Setup
      const accountData = {
        boId: `${Date.now()}`,
        accountNumber: `${Math.random().toString().slice(2, 16)}`,
        dpId: "12345600",
        dpName: "CDSL Demo Depository Participant",
        clientName,
        pan,
        mobile,
        email,
        status: "ACTIVE",
        accountType: "INDIVIDUAL",
        openingDate: new Date().toISOString().split('T')[0],
        kycStatus: "COMPLETED",
        tpin: Math.floor(100000 + Math.random() * 900000).toString(),
        holdingNature: "BENEFICIAL_OWNER"
      };

      await fetchCDSL("/bo-setup", accountData);

      res.json({
        status: "success",
        message: "CDSL account opened successfully",
        data: accountData
      });
    } catch (error) {
      console.error("Error opening CDSL account:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to open CDSL account"
      });
    }
  });

  app.get("/api/cdsl/holdings/:boId", async (req, res) => {
    try {
      const { boId } = req.params;
      
      // Simulate CDSL holdings data
      const holdingsData = {
        boId,
        dpId: "12345600",
        clientName: "Demo CDSL Client",
        asOfDate: new Date().toISOString().split('T')[0],
        holdings: [
          {
            isin: "INE040A01034",
            securityName: "Tata Consultancy Services Ltd",
            quantity: 50,
            marketValue: "195000.00",
            freeQuantity: 50,
            lockedQuantity: 0,
            pledgedQuantity: 0,
            earmarkQuantity: 0
          },
          {
            isin: "INE075A01022", 
            securityName: "Wipro Limited",
            quantity: 100,
            marketValue: "57500.00",
            freeQuantity: 95,
            lockedQuantity: 0,
            pledgedQuantity: 5,
            earmarkQuantity: 0
          },
          {
            isin: "INE019A01038",
            securityName: "Asian Paints Ltd",
            quantity: 25,
            marketValue: "82500.00", 
            freeQuantity: 25,
            lockedQuantity: 0,
            pledgedQuantity: 0,
            earmarkQuantity: 0
          }
        ],
        totalMarketValue: "335000.00",
        totalSecurities: 3
      };

      await fetchCDSL("/holdings/fetch", { boId });

      res.json({
        status: "success",
        data: holdingsData
      });
    } catch (error) {
      console.error("Error fetching CDSL holdings:", error);
      res.status(500).json({
        status: "error", 
        error: "Failed to fetch holdings data"
      });
    }
  });

  // CDSL eDIS (Electronic Delivery Instruction Slip)
  app.post("/api/cdsl/edis/consent", async (req, res) => {
    try {
      const { boId, isin, quantity, clientCode, executionDate, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !clientCode || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for eDIS consent"
        });
      }

      // Simulate eDIS consent processing
      const edisConsent = {
        consentId: `EDIS${Date.now()}`,
        boId,
        isin,
        quantity,
        clientCode,
        executionDate,
        status: "APPROVED",
        consentDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 24 hours
        remarks: "Electronic consent provided successfully"
      };

      await fetchCDSL("/edis/consent", edisConsent);

      res.json({
        status: "success",
        message: "eDIS consent provided successfully",
        data: edisConsent
      });
    } catch (error) {
      console.error("Error processing eDIS consent:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to process eDIS consent"
      });
    }
  });

  app.post("/api/cdsl/edis/revoke", async (req, res) => {
    try {
      const { consentId, boId, tpin } = req.body;
      
      if (!consentId || !boId || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "Consent ID, BO ID, and TPIN are required for revocation"
        });
      }

      // Simulate eDIS revocation
      const revocationData = {
        consentId,
        boId,
        status: "REVOKED",
        revocationDate: new Date().toISOString(),
        remarks: "Consent revoked by client"
      };

      await fetchCDSL("/edis/revoke", revocationData);

      res.json({
        status: "success",
        message: "eDIS consent revoked successfully",
        data: revocationData
      });
    } catch (error) {
      console.error("Error revoking eDIS consent:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to revoke consent"
      });
    }
  });

  app.post("/api/cdsl/tpin/generate", async (req, res) => {
    try {
      const { boId, mobile } = req.body;
      
      if (!boId || !mobile) {
        return res.status(400).json({
          status: "error",
          error: "BO ID and mobile number are required"
        });
      }

      // Simulate TPIN generation
      const tpinData = {
        referenceId: `TPIN${Date.now()}`,
        boId,
        mobile,
        tpin: Math.floor(100000 + Math.random() * 900000).toString(), // Demo TPIN
        validityMinutes: 15,
        status: "SENT"
      };

      await fetchCDSL("/tpin/generate", { boId, mobile });

      res.json({
        status: "success",
        message: "TPIN sent successfully to registered mobile number",
        data: {
          referenceId: tpinData.referenceId,
          validityMinutes: tpinData.validityMinutes
        }
      });
    } catch (error) {
      console.error("Error generating TPIN:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate TPIN"
      });
    }
  });

  // CDSL Pledge APIs
  app.post("/api/cdsl/pledge/create", async (req, res) => {
    try {
      const { boId, isin, quantity, pledgeeClientCode, pledgeReason, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !pledgeeClientCode || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for pledge creation"
        });
      }

      // Simulate pledge creation
      const pledgeData = {
        pledgeId: `PLG${Date.now()}`,
        boId,
        isin,
        quantity,
        pledgeeClientCode,
        pledgeReason: pledgeReason || "TRADING_MARGIN",
        status: "CONFIRMED",
        pledgeDate: new Date().toISOString().split('T')[0],
        pledgeValue: (parseFloat(quantity) * 1200).toString(), // Simulated value
        closureDate: null,
        remarks: "Pledge created successfully"
      };

      await fetchCDSL("/pledge/create", pledgeData);

      res.json({
        status: "success",
        message: "Pledge created successfully",
        data: pledgeData
      });
    } catch (error) {
      console.error("Error creating pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create pledge"
      });
    }
  });

  app.post("/api/cdsl/pledge/close", async (req, res) => {
    try {
      const { pledgeId, tpin, closureQuantity } = req.body;
      
      if (!pledgeId || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "Pledge ID and TPIN are required"
        });
      }

      // Simulate pledge closure
      const closureData = {
        pledgeId,
        status: "CLOSED",
        closureDate: new Date().toISOString().split('T')[0],
        closureQuantity: closureQuantity || "100",
        releasedValue: "120000.00",
        remarks: "Pledge closed successfully"
      };

      await fetchCDSL("/pledge/close", closureData);

      res.json({
        status: "success",
        message: "Pledge closed successfully",
        data: closureData
      });
    } catch (error) {
      console.error("Error closing pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to close pledge"
      });
    }
  });

  // CDSL eLAS (Online Loan Against Shares)
  app.post("/api/cdsl/elas/pledge", async (req, res) => {
    try {
      const { boId, securities, lenderCode, loanAmount, purpose, tpin } = req.body;
      
      if (!boId || !securities || !lenderCode || !loanAmount || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for eLAS pledge"
        });
      }

      // Simulate eLAS pledge creation
      const elasPledge = {
        pledgeId: `ELAS${Date.now()}`,
        boId,
        lenderCode,
        loanAmount,
        purpose: purpose || "PERSONAL_LOAN",
        status: "PLEDGED",
        pledgeDate: new Date().toISOString().split('T')[0],
        securities,
        eligibleAmount: (parseFloat(loanAmount) * 0.8).toString(), // 80% LTV
        interestRate: "11.5%",
        tenure: "12 months"
      };

      await fetchCDSL("/elas/pledge", elasPledge);

      res.json({
        status: "success",
        message: "eLAS pledge created successfully",
        data: elasPledge
      });
    } catch (error) {
      console.error("Error creating eLAS pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create eLAS pledge"
      });
    }
  });

  // CDSL Margin Pledge API
  app.post("/api/cdsl/margin-pledge/create", async (req, res) => {
    try {
      const { boId, isin, quantity, brokerCode, marginType, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !brokerCode || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for margin pledge"
        });
      }

      // Simulate margin pledge creation
      const marginPledge = {
        marginPledgeId: `MP${Date.now()}`,
        boId,
        isin,
        quantity,
        brokerCode,
        marginType: marginType || "TRADING_MARGIN",
        status: "ACTIVE",
        pledgeDate: new Date().toISOString().split('T')[0],
        marginValue: (parseFloat(quantity) * 900).toString(), // Simulated margin value
        haircut: "20%",
        availableMargin: (parseFloat(quantity) * 720).toString()
      };

      await fetchCDSL("/margin-pledge/create", marginPledge);

      res.json({
        status: "success",
        message: "Margin pledge created successfully",
        data: marginPledge
      });
    } catch (error) {
      console.error("Error creating margin pledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create margin pledge"
      });
    }
  });

  // CDSL Early Pay-in API
  app.post("/api/cdsl/early-payin", async (req, res) => {
    try {
      const { boId, isin, quantity, tradeDate, settlementCycle, tpin } = req.body;
      
      if (!boId || !isin || !quantity || !tradeDate || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All required fields and TPIN must be provided"
        });
      }

      // Simulate early pay-in setup
      const earlyPayin = {
        payinId: `EPY${Date.now()}`,
        boId,
        isin,
        quantity,
        tradeDate,
        settlementCycle: settlementCycle || "T+1",
        status: "CONFIRMED",
        marginBenefit: "15%",
        benefitAmount: (parseFloat(quantity) * 150).toString(),
        expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days
      };

      await fetchCDSL("/early-payin", earlyPayin);

      res.json({
        status: "success",
        message: "Early pay-in setup successfully",
        data: earlyPayin
      });
    } catch (error) {
      console.error("Error setting up early pay-in:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to setup early pay-in"
      });
    }
  });

  // CDSL Destat API (Mutual Fund Dematerialization)
  app.post("/api/cdsl/destat/request", async (req, res) => {
    try {
      const { boId, folioNumber, amc, schemeCode, units, tpin } = req.body;
      
      if (!boId || !folioNumber || !amc || !schemeCode || !units || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "All fields including TPIN are required for destat request"
        });
      }

      // Simulate destat request
      const destatRequest = {
        requestId: `DST${Date.now()}`,
        boId,
        folioNumber,
        amc,
        schemeCode,
        units,
        status: "INITIATED",
        requestDate: new Date().toISOString().split('T')[0],
        expectedCompletionDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 5 days
        processingFee: "25.00"
      };

      await fetchCDSL("/destat/request", destatRequest);

      res.json({
        status: "success",
        message: "Destat request submitted successfully",
        data: destatRequest
      });
    } catch (error) {
      console.error("Error submitting destat request:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit destat request"
      });
    }
  });

  // CDSL e-Voting API
  app.post("/api/cdsl/evoting/vote", async (req, res) => {
    try {
      const { boId, companyCode, resolutions, tpin } = req.body;
      
      if (!boId || !companyCode || !resolutions || !tpin) {
        return res.status(400).json({
          status: "error",
          error: "BO ID, company code, resolutions, and TPIN are required"
        });
      }

      // Simulate e-voting
      const votingData = {
        votingId: `VOTE${Date.now()}`,
        boId,
        companyCode,
        votingDate: new Date().toISOString(),
        resolutions,
        status: "SUBMITTED",
        confirmationNumber: `CONF${Date.now()}`,
        votingRights: "100"
      };

      await fetchCDSL("/evoting/vote", votingData);

      res.json({
        status: "success",
        message: "Vote submitted successfully",
        data: votingData
      });
    } catch (error) {
      console.error("Error submitting vote:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit vote"
      });
    }
  });

  // CDSL Transaction Statement
  app.get("/api/cdsl/statement/:boId", async (req, res) => {
    try {
      const { boId } = req.params;
      const { fromDate, toDate } = req.query;
      
      // Simulate transaction history
      const statement = {
        boId,
        dpId: "12345600",
        period: `${fromDate || '2025-01-01'} to ${toDate || new Date().toISOString().split('T')[0]}`,
        transactions: [
          {
            date: "2025-08-25",
            isin: "INE040A01034",
            securityName: "Tata Consultancy Services Ltd",
            transactionType: "PURCHASE",
            quantity: 25,
            rate: "3900.00",
            amount: "97500.00",
            balanceQuantity: 50,
            settlementNumber: "2025082501"
          },
          {
            date: "2025-08-20", 
            isin: "INE075A01022",
            securityName: "Wipro Limited",
            transactionType: "PLEDGE",
            quantity: 5,
            rate: "575.00",
            amount: "2875.00",
            balanceQuantity: 100,
            settlementNumber: "N/A"
          },
          {
            date: "2025-08-15",
            isin: "INE019A01038",
            securityName: "Asian Paints Ltd",
            transactionType: "RECEIPT",
            quantity: 25,
            rate: "3300.00",
            amount: "82500.00",
            balanceQuantity: 25,
            settlementNumber: "2025081501"
          }
        ]
      };

      await fetchCDSL("/statement/fetch", { boId, fromDate, toDate });

      res.json({
        status: "success",
        data: statement
      });
    } catch (error) {
      console.error("Error fetching CDSL statement:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to fetch account statement"
      });
    }
  });

  // Advanced CDSL Features

  // DESTAT (Demat Statement) Service
  app.post("/api/cdsl/destat/generate", async (req, res) => {
    try {
      const { boId, asOnDate, statementType } = req.body;
      
      if (!boId || !asOnDate) {
        return res.status(400).json({
          status: "error",
          error: "BO ID and as-on date are required"
        });
      }

      const destatData = {
        requestId: `DESTAT${Date.now()}`,
        boId,
        asOnDate,
        statementType: statementType || "DETAILED",
        generatedDate: new Date().toISOString().split('T')[0],
        holdings: [
          {
            isin: "INE040A01034",
            securityName: "Tata Consultancy Services Ltd",
            quantity: 50,
            lockedQuantity: 0,
            pledgedQuantity: 10,
            marketValue: "185000.00"
          },
          {
            isin: "INE467B01029",
            securityName: "Asian Paints Ltd",
            quantity: 25,
            lockedQuantity: 0,
            pledgedQuantity: 0,
            marketValue: "85000.00"
          }
        ],
        totalValue: "270000.00",
        status: "GENERATED"
      };

      await fetchCDSL("/destat/generate", destatData);

      res.json({
        status: "success",
        message: "DESTAT generated successfully",
        data: destatData
      });
    } catch (error) {
      console.error("Error generating DESTAT:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to generate DESTAT"
      });
    }
  });

  // Repledge Services
  app.post("/api/cdsl/repledge/create", async (req, res) => {
    try {
      const { boId, pledgeeId, isin, quantity, purpose } = req.body;
      
      if (!boId || !pledgeeId || !isin || !quantity) {
        return res.status(400).json({
          status: "error",
          error: "BO ID, pledgee ID, ISIN, and quantity are required"
        });
      }

      const repledgeData = {
        repledgeId: `RPL${Date.now()}`,
        boId,
        pledgeeId,
        isin,
        quantity,
        purpose: purpose || "LOAN_COLLATERAL",
        creationDate: new Date().toISOString().split('T')[0],
        status: "CREATED",
        validTill: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      await fetchCDSL("/repledge/create", repledgeData);

      res.json({
        status: "success",
        message: "Repledge created successfully",
        data: repledgeData
      });
    } catch (error) {
      console.error("Error creating repledge:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to create repledge"
      });
    }
  });

  // Unpledge Services
  app.post("/api/cdsl/unpledge/request", async (req, res) => {
    try {
      const { boId, pledgeId, quantity, reason } = req.body;
      
      if (!boId || !pledgeId || !quantity) {
        return res.status(400).json({
          status: "error",
          error: "BO ID, pledge ID, and quantity are required"
        });
      }

      const unpledgeData = {
        unpledgeId: `UPL${Date.now()}`,
        boId,
        pledgeId,
        quantity,
        reason: reason || "LOAN_CLOSURE",
        requestDate: new Date().toISOString().split('T')[0],
        status: "UNDER_PROCESS",
        expectedCompletionDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      };

      await fetchCDSL("/unpledge/request", unpledgeData);

      res.json({
        status: "success",
        message: "Unpledge request submitted successfully",
        data: unpledgeData
      });
    } catch (error) {
      console.error("Error processing unpledge request:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to process unpledge request"
      });
    }
  });

  // Easiest (Online Services) Portal
  app.post("/api/cdsl/easiest/service-request", async (req, res) => {
    try {
      const { boId, serviceType, requestData } = req.body;
      
      if (!boId || !serviceType) {
        return res.status(400).json({
          status: "error",
          error: "BO ID and service type are required"
        });
      }

      const serviceRequest = {
        requestId: `EASIEST${Date.now()}`,
        boId,
        serviceType, // ADDRESS_CHANGE, MOBILE_UPDATE, EMAIL_UPDATE, etc.
        requestData,
        submissionDate: new Date().toISOString().split('T')[0],
        status: "SUBMITTED",
        trackingNumber: `TRK${Math.random().toString().slice(2, 10)}`
      };

      await fetchCDSL("/easiest/service-request", serviceRequest);

      res.json({
        status: "success",
        message: "Service request submitted successfully via Easiest portal",
        data: serviceRequest
      });
    } catch (error) {
      console.error("Error submitting service request:", error);
      res.status(500).json({
        status: "error",
        error: "Failed to submit service request"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
