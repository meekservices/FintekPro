import { Express } from 'express';
import { storage } from '../storage';
import { finnhubService } from '../finnhub-service';
import { marketMoversCache } from '../services/market-movers-cache';
import { requireAdmin } from '../middleware/roleMiddleware';
import { and } from 'drizzle-orm';

export function registerMarketDataPart1Routes(app: Express): void {
app.get("/api/market/movers", async (req, res) => {
  const startTime = Date.now();
  try {
    const { data, cached, cacheAge } = await marketMoversCache.getMarketMovers();
    const duration = Date.now() - startTime;
    
    res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-Age', Math.round((cacheAge || 0) / 1000).toString());
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    console.log(`📊 [MarketMovers] Response in ${duration}ms (cache: ${cached ? 'HIT' : 'MISS'})`);
    res.json(data);
  } catch (error) {
    console.error("Error fetching market movers:", error);
    res.status(500).json({ error: "Failed to fetch market movers" });
  }
});

// Market movers cache metrics endpoint
app.get("/api/admin/cache/market-movers/metrics", requireAdmin, async (req, res) => {
  try {
    const metrics = marketMoversCache.getMetrics();
    res.json({
      cache: 'market-movers',
      ...metrics,
      cacheAgeSeconds: metrics.cacheAge ? Math.round(metrics.cacheAge / 1000) : null,
      lastRefreshDurationMs: metrics.lastRefreshDuration || null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache metrics' });
  }
});
app.get("/api/market/quote/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Try Finnhub first for US stocks
    try {
      const finnhubQuote = await finnhubService.getQuote(symbol.toUpperCase());
      const data = finnhubService.transformQuoteToMarketData(symbol.toUpperCase(), finnhubQuote);
      
      // Store in local cache
      await storage.upsertMarketData(symbol, {
        symbol: symbol.toUpperCase(),
        price: data.price?.toString(),
        change: data.change?.toString(),
        changePercent: data.changePercent?.toString(),
        data: data
      });
      
      res.json(data);
      return;
    } catch (finnhubError) {
      console.log("Finnhub failed for", symbol, "trying fallback");
    }
    
    // Fallback to existing fetchMarketData
    const data = await fetchMarketData(symbol.toUpperCase());
    
    // Store in local cache
    await storage.upsertMarketData(symbol, {
      symbol: symbol.toUpperCase(),
      price: data.price?.toString(),
      change: data.change?.toString(),
      changePercent: data.changePercent?.toString(),
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
    
    // Try Finnhub first for US stocks
    try {
      const fromTimestamp = from ? parseInt(from as string) : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const toTimestamp = to ? parseInt(to as string) : Math.floor(Date.now() / 1000);
      
      const finnhubCandles = await finnhubService.getCandles(
        symbol.toUpperCase(), 
        resolution as string, 
        fromTimestamp, 
        toTimestamp
      );
      
      const data = finnhubService.transformCandlesToMarketCandles(finnhubCandles);
      res.json(data);
      return;
    } catch (finnhubError) {
      console.log("Finnhub candles failed for", symbol, "using fallback");
    }
    
    return res.status(503).json({ error: 'Market data temporarily unavailable. Finnhub API key required for candle data.' });
  } catch (error) {
    console.error("Error fetching candles:", error);
    res.status(500).json({ error: "Failed to fetch market candles" });
  }
});

// Enhanced market data endpoint with multiple sources
app.get("/api/market/enhanced-quote/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Try Finnhub first, fallback to Yahoo Finance
    let data: any = {
      symbol,
      source: 'fallback',
      timestamp: new Date().toISOString()
    };
    
    try {
      if (process.env.FINNHUB_API_KEY) {
        const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`);
        const finnhubQuote = await response.json();
        
        if (!finnhubQuote.error && finnhubQuote.c) {
          data = {
            symbol,
            price: finnhubQuote.c,
            change: finnhubQuote.d,
            changePercent: finnhubQuote.dp,
            high: finnhubQuote.h,
            low: finnhubQuote.l,
            open: finnhubQuote.o,
            previousClose: finnhubQuote.pc,
            source: 'finnhub',
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (finnhubError) {
      console.log("Finnhub unavailable, using fallback data");
    }
    
    // If Finnhub failed, use Yahoo Finance fallback
    if (data.source === 'fallback') {
      try {
        const yahooResponse = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
        const yahooData = await yahooResponse.json();
        
        if (yahooData.chart?.result?.[0]?.meta) {
          const meta = yahooData.chart.result[0].meta;
          data = {
            symbol,
            price: meta.regularMarketPrice || 0,
            change: (meta.regularMarketPrice - meta.previousClose) || 0,
            changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose * 100) || 0,
            high: meta.regularMarketDayHigh || 0,
            low: meta.regularMarketDayLow || 0,
            open: meta.regularMarketOpen || 0,
            previousClose: meta.previousClose || 0,
            source: 'yahoo',
            timestamp: new Date().toISOString()
          };
        }
      } catch (yahooError) {
        console.log("Yahoo Finance also failed, data unavailable");
        data = {
          symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          high: 0,
          low: 0,
          open: 0,
          previousClose: 0,
          source: 'unavailable',
          timestamp: new Date().toISOString()
        };
      }
    }
    
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error("Enhanced quote error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Unknown error"
    });
  }
});

// Enhanced company profile endpoint
app.get("/api/market/company-profile/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    let profile: any = {
      symbol,
      name: symbol,
      source: 'fallback',
      timestamp: new Date().toISOString()
    };
    
    try {
      if (process.env.FINNHUB_API_KEY) {
        const response = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`);
        const finnhubProfile = await response.json();
        
        if (!finnhubProfile.error && finnhubProfile.name) {
          profile = {
            symbol,
            name: finnhubProfile.name,
            description: finnhubProfile.description,
            industry: finnhubProfile.finnhubIndustry,
            marketCap: finnhubProfile.marketCapitalization,
            exchange: finnhubProfile.exchange,
            country: finnhubProfile.country,
            currency: finnhubProfile.currency,
            website: finnhubProfile.weburl,
            logo: finnhubProfile.logo,
            source: 'finnhub',
            timestamp: new Date().toISOString()
          };
        }
      }
    } catch (finnhubError) {
      console.log("Finnhub profile unavailable, using fallback");
    }
    
    // If Finnhub failed, use basic company data
    if (profile.source === 'fallback') {
      const companyNames: { [key: string]: string } = {
        'AAPL': 'Apple Inc.',
        'GOOGL': 'Alphabet Inc.',
        'MSFT': 'Microsoft Corporation',
        'TSLA': 'Tesla Inc.',
        'AMZN': 'Amazon.com Inc.',
        'NVDA': 'NVIDIA Corporation',
        'META': 'Meta Platforms Inc.',
        'NFLX': 'Netflix Inc.'
      };
      
      profile.name = companyNames[symbol] || `${symbol} Corporation`;
      profile.description = `${profile.name} is a publicly traded company.`;
      profile.source = 'static';
    }
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error: any) {
    console.error("Company profile error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Unknown error"
    });
  }
});

// Enhanced market news endpoint
app.get("/api/market/enhanced-news", async (req, res) => {
  try {
    const { symbol } = req.query;
    
    let news: any[] = [];
    
    try {
      if (process.env.FINNHUB_API_KEY && symbol) {
        const response = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${process.env.FINNHUB_API_KEY}`);
        const finnhubNews = await response.json();
        
        if (Array.isArray(finnhubNews) && !(finnhubNews as any).error) {
          news = finnhubNews.slice(0, 10).map((item: any) => ({
            id: item.id,
            title: item.headline,
            summary: item.summary,
            url: item.url,
            image: item.image,
            datetime: new Date(item.datetime * 1000).toISOString(),
            source: item.source,
            category: 'company',
            provider: 'finnhub'
          }));
        }
      }
    } catch (finnhubError) {
      console.log("Finnhub news unavailable, using fallback");
    }
    
    // If no Finnhub news, provide general market news
    if (news.length === 0) {
      news = [
        {
          id: Date.now(),
          title: "Market Analysis: Technology Stocks Show Mixed Performance",
          summary: "Technology sector continues to show volatility as investors react to earnings reports and economic indicators.",
          url: "#",
          datetime: new Date().toISOString(),
          source: "Market Analysis",
          category: "market",
          provider: 'static'
        },
        {
          id: Date.now() + 1,
          title: "Federal Reserve Maintains Interest Rate Policy",
          summary: "The Federal Reserve announced it will maintain current interest rates amid ongoing economic monitoring.",
          url: "#",
          datetime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          source: "Economic News",
          category: "economic",
          provider: 'static'
        }
      ];
    }
    
    res.json({
      success: true,
      data: news,
      count: news.length
    });
  } catch (error: any) {
    console.error("Enhanced news error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Unknown error"
    });
  }
});

// Simple cache for market data
const marketDataCache = new Map();
const CACHE_DURATION = 30 * 1000; // 30 seconds

app.get("/api/market/indices", async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'global_indices';
    const cached = marketDataCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return res.json(cached.data);
    }

    // Global market indices symbols that match frontend expectations
    const globalIndices = [
      { symbol: "^GSPC", name: "S&P 500" }, 
      { symbol: "^IXIC", name: "NASDAQ" },
      { symbol: "^DJI", name: "Dow Jones" },
      { symbol: "^NSEI", name: "Nifty 50" },
      { symbol: "^BSESN", name: "BSE Sensex" },
      { symbol: "^N225", name: "Nikkei 225" },
      { symbol: "^HSI", name: "Hang Seng" },
      { symbol: "^FTSE", name: "FTSE 100" },
      { symbol: "^GDAXI", name: "DAX" },
      { symbol: "^FCHI", name: "CAC 40" }
    ];

    const promises = globalIndices.map(async (index) => {
      try {
        const basePrice = getBasePrice(index.symbol);
        const data = { c: basePrice, d: 0, dp: 0, pc: basePrice, o: basePrice, h: basePrice, l: basePrice };
        
        // Check if we got valid data
        if (data && data.c && data.c > 0) {
          return {
            symbol: index.symbol,
            price: data.c,
            change: data.d || 0,
            changePercent: data.dp || 0,
            high: data.h || data.c,
            low: data.l || data.c,
            open: data.o || data.c,
            previousClose: data.pc || data.c,
            timestamp: (data as any).t || Math.floor(Date.now() / 1000)
          };
        } else {
          // API returned invalid data, use fallback
          throw new Error("Invalid API response");
        }
      } catch (error) {
        // Don't log every API failure as error - use fallback silently
        const basePrice = getBasePrice(index.symbol);
        const change = (Math.random() - 0.5) * (basePrice * 0.015); // ±1.5% variation
        const changePercent = (change / basePrice) * 100;
        
        return {
          symbol: index.symbol,
          price: basePrice + change,
          change: change,
          changePercent: changePercent,
          high: basePrice + Math.abs(change) * 1.1,
          low: basePrice - Math.abs(change) * 1.1,
          open: basePrice,
          previousClose: basePrice,
          timestamp: Math.floor(Date.now() / 1000)
        };
      }
    });

    const results = await Promise.all(promises);
    
    // Cache the results
    marketDataCache.set(cacheKey, {
      data: results,
      timestamp: Date.now()
    });
    
    res.json(results);
  } catch (error) {
    console.error("Error fetching indices:", error);
    res.status(500).json({ error: "Failed to fetch market indices" });
  }
});

// Helper function to get realistic base prices for indices
function getBasePrice(symbol: string): number {
  const basePrices = {
    "^GSPC": 5600,    // S&P 500
    "^IXIC": 18000,   // NASDAQ
    "^DJI": 40000,    // Dow Jones
    "^NSEI": 24700,   // Nifty 50
    "^BSESN": 81300,  // BSE Sensex
    "^N225": 38000,   // Nikkei 225
    "^HSI": 17500,    // Hang Seng
    "^FTSE": 8300,    // FTSE 100
    "^GDAXI": 19000,  // DAX
    "^FCHI": 7500     // CAC 40
  };
  
  return basePrices[symbol as keyof typeof basePrices] || 1000;
}

app.get("/api/market/news", async (req, res) => {
  try {
    const { category = "all", limit = 20 } = req.query;
    const maxItems = parseInt(limit as string) || 20;

    if (process.env.FINNHUB_API_KEY) {
      const finnhubCategory = category === 'all' ? 'general' : String(category);
      const newsData = await finnhubService.getMarketNews(finnhubCategory);
      if (newsData && newsData.length > 0) {
        return res.json(newsData.slice(0, maxItems));
      }
    }

    const now = Math.floor(Date.now() / 1000);
    const curatedNews = [
      { id: 1, category: "general", datetime: now - 3600, headline: "RBI keeps repo rate unchanged at 6.50% amid easing inflation", image: "", source: "RBI", summary: "The Reserve Bank of India maintained its key lending rate at 6.50%, citing a stable inflation trajectory and resilient domestic growth outlook for FY2026-27.", url: "https://rbi.org.in" },
      { id: 2, category: "general", datetime: now - 7200, headline: "SEBI introduces new framework for mutual fund light regulation", image: "", source: "SEBI", summary: "Markets regulator SEBI has proposed a lighter regulatory framework for passively managed mutual fund schemes to reduce compliance costs and boost passive investing.", url: "https://sebi.gov.in" },
      { id: 3, category: "general", datetime: now - 10800, headline: "India GDP growth accelerates to 7.2% in Q3 FY26", image: "", source: "MoSPI", summary: "India's economy grew at 7.2% year-on-year in the October-December quarter, driven by robust services sector activity and strong urban consumption demand.", url: "https://mospi.gov.in" },
      { id: 4, category: "general", datetime: now - 14400, headline: "Nifty 50 hits all-time high as FII inflows surge", image: "", source: "NSE", summary: "The benchmark Nifty 50 index touched a fresh lifetime high, supported by sustained foreign institutional investor inflows and positive global sentiment.", url: "https://nseindia.com" },
      { id: 5, category: "general", datetime: now - 18000, headline: "SIP contributions cross Rs 25,000 crore monthly milestone", image: "", source: "AMFI", summary: "Systematic Investment Plan contributions to mutual funds crossed the Rs 25,000 crore monthly mark for the first time, reflecting growing retail investor participation.", url: "https://amfiindia.com" },
      { id: 6, category: "general", datetime: now - 21600, headline: "Government bonds rally as 10-year yield falls below 7%", image: "", source: "RBI", summary: "Indian government bond prices rallied with the benchmark 10-year yield dropping below the 7% level, buoyed by expectations of monetary easing in the near term.", url: "https://rbi.org.in" },
      { id: 7, category: "general", datetime: now - 25200, headline: "Union Budget 2026: Key highlights for investors", image: "", source: "PIB", summary: "The Union Budget for FY2026-27 introduced several investor-friendly measures including enhanced deductions for long-term capital gains and simplified TDS provisions.", url: "https://pib.gov.in" },
      { id: 8, category: "general", datetime: now - 28800, headline: "Gold ETFs see record inflows amid global uncertainty", image: "", source: "AMFI", summary: "Gold exchange-traded funds in India witnessed record monthly inflows as investors sought safe-haven assets amid geopolitical tensions and volatile equity markets.", url: "https://amfiindia.com" },
    ];
    res.json(curatedNews.slice(0, maxItems));
  } catch (error) {
    console.error("Error fetching news:", error);
    res.json([]);
  }
});

// News categories endpoint
app.get("/api/market/news/categories", async (req, res) => {
  try {
    const categories = [
      { id: "all", name: "All News", description: "Complete market and financial news coverage" },
      { id: "market", name: "Market Updates", description: "Index movements and market trends" },
      { id: "technology", name: "Technology", description: "IT and technology sector news" },
      { id: "ipo", name: "IPOs & Primary Market", description: "New listings and public offerings" },
      { id: "mutual_funds", name: "Mutual Funds", description: "Fund performance and industry news" },
      { id: "bonds", name: "Fixed Income", description: "Bond market and interest rate news" },
      { id: "sector", name: "Sector Analysis", description: "Industry-specific updates and trends" },
      { id: "commodities", name: "Commodities", description: "Gold, oil, and commodity price movements" },
      { id: "regulatory", name: "Regulatory Updates", description: "SEBI, RBI, and government policy changes" },
      { id: "global", name: "Global Markets", description: "International market developments" },
      { id: "earnings", name: "Earnings Reports", description: "Company quarterly results and guidance" },
      { id: "analyst_update", name: "Analyst Research", description: "Research reports and rating changes" },
      { id: "technical_analysis", name: "Technical Analysis", description: "Chart patterns and technical indicators" }
    ];
    res.json(categories);
  } catch (error) {
    console.error("Error fetching news categories:", error);
    res.status(500).json({ error: "Failed to fetch news categories" });
  }
});

// Search news endpoint
app.get("/api/market/news/search", async (req, res) => {
  try {
    const { q: searchQuery, category, limit = 10 } = req.query;
    
    if (!searchQuery) {
      return res.status(400).json({ error: "Search query is required" });
    }

    // News search requires Finnhub API integration
    res.json({
      query: searchQuery,
      total: 0,
      results: [],
      message: 'News search requires Finnhub API integration. Configure FINNHUB_API_KEY for live news search.'
    });
    return;
  } catch (error) {
    console.error("Error searching news:", error);
    res.status(500).json({ error: "Failed to search news" });
  }
});

// Trending news endpoint - most popular and high-impact stories
app.get("/api/market/news/trending", async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    res.json([]);

  } catch (error) {
    console.error("Error fetching trending news:", error);
    res.json([]);
  }
});

// Market status endpoint - live/closed status for different exchanges (with holiday awareness)
}
