import { Express, Request, Response } from 'express';
import { finnhubService } from '../finnhub-service';
import { marketMoversCache } from '../services/market-movers-cache';
import { requireAdmin } from '../middleware/roleMiddleware';
import type { 
  MarketQuoteData, 
  CompanyProfileData, 
  NewsItem, 
  IndexQuote 
} from '../types/marketData';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface FinnhubQuote {
  c: number;   // current price
  d?: number;  // change
  dp?: number; // change percent
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
}

interface FinnhubProfile {
  name: string;
  headline?: string;
  summary?: string;
  description?: string;
  finnhubIndustry?: string;
  marketCapitalization?: number;
  exchange?: string;
  country?: string;
  currency?: string;
  weburl?: string;
  logo?: string;
}

interface FinnhubNewsItem {
  id: number;
  headline: string;
  summary: string;
  url: string;
  image: string;
  datetime: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function queryInt(value: unknown, fallback: number): number {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? fallback : n;
}

function queryStr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

// ---------------------------------------------------------------------------
// Index base-price lookup
// ---------------------------------------------------------------------------

const INDEX_BASE_PRICES: Record<string, number> = {
  '^GSPC':  5600,   // S&P 500
  '^IXIC':  18000,  // NASDAQ
  '^DJI':   40000,  // Dow Jones
  '^NSEI':  24700,  // Nifty 50
  '^BSESN': 81300,  // BSE Sensex
  '^N225':  38000,  // Nikkei 225
  '^HSI':   17500,  // Hang Seng
  '^FTSE':  8300,   // FTSE 100
  '^GDAXI': 19000,  // DAX
  '^FCHI':  7500,   // CAC 40
};

function getBasePrice(symbol: string): number {
  return INDEX_BASE_PRICES[symbol] ?? 1000;
}

// ---------------------------------------------------------------------------
// Simple in-memory cache
// ---------------------------------------------------------------------------

const marketDataCache = new Map<string, CacheEntry<IndexQuote[]>>();
const CACHE_DURATION = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export function registerMarketDataPart1Routes(app: Express): void {

  app.get('/api/market/sentiment', async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        sentiment: 'Neutral to Bullish',
        score: 65,
        summary: 'Market shows resilience near resistance levels. Institutional interest remains steady.',
        timestamp: new Date().toISOString()
      });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to fetch market sentiment' });
    }
  });

  app.get('/api/market/movers', async (_req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    try {
      const { data, cached, cacheAge } = await marketMoversCache.getMarketMovers();
      const duration = Date.now() - startTime;

      res.setHeader('X-Cache', cached ? 'HIT' : 'MISS');
      res.setHeader('X-Cache-Age', Math.round((cacheAge ?? 0) / 1000).toString());
      res.setHeader('X-Response-Time', `${duration}ms`);

      console.log(`📊 [MarketMovers] Response in ${duration}ms (cache: ${cached ? 'HIT' : 'MISS'})`);
      res.json(data);
    } catch (err: unknown) {
      console.error('Error fetching market movers:', err);
      res.status(500).json({ error: 'Failed to fetch market movers' });
    }
  });

  app.get('/api/admin/cache/market-movers/metrics', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
    try {
      const metrics = marketMoversCache.getMetrics();
      res.json({
        cache: 'market-movers',
        ...metrics,
        cacheAgeSeconds: metrics.cacheAge ? Math.round(metrics.cacheAge / 1000) : null,
        lastRefreshDurationMs: metrics.lastRefreshDuration ?? null,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: 'Failed to get cache metrics' });
    }
  });

  app.get('/api/market/quote/:symbol', async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.params;

      try {
        const finnhubQuote = await finnhubService.getQuote(symbol.toUpperCase());
        const data = finnhubService.transformQuoteToMarketData(symbol.toUpperCase(), finnhubQuote);
        res.json(data);
        return;
      } catch {
        console.log('Finnhub failed for', symbol, '- no fallback available');
      }

      res.status(503).json({ error: 'Market quote temporarily unavailable. Finnhub API key required.' });
    } catch (err: unknown) {
      console.error('Error fetching quote:', err);
      res.status(500).json({ error: 'Failed to fetch market quote' });
    }
  });

  app.get('/api/market/candles/:symbol', async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.params;
      const { resolution = 'D', from, to } = req.query;

      try {
        const fromTs = from
          ? queryInt(from, 0)
          : Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
        const toTs = to
          ? queryInt(to, 0)
          : Math.floor(Date.now() / 1000);

        const finnhubCandles = await finnhubService.getCandles(
          symbol.toUpperCase(),
          queryStr(resolution, 'D'),
          fromTs,
          toTs
        );

        const data = finnhubService.transformCandlesToMarketCandles(finnhubCandles);
        res.json(data);
        return;
      } catch {
        console.log('Finnhub candles failed for', symbol, 'using fallback');
      }

      res.status(503).json({ error: 'Market data temporarily unavailable. Finnhub API key required for candle data.' });
    } catch (err: unknown) {
      console.error('Error fetching candles:', err);
      res.status(500).json({ error: 'Failed to fetch market candles' });
    }
  });

  // Enhanced quote with Finnhub → Yahoo Finance fallback chain
  app.get('/api/market/enhanced-quote/:symbol', async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.params;

      let data: MarketQuoteData = {
        symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        open: 0,
        previousClose: 0,
        source: 'fallback',
        timestamp: new Date().toISOString()
      };

      try {
        if (process.env.FINNHUB_API_KEY) {
          const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`);
          const finnhubQuote = (await response.json()) as FinnhubQuote;

          if (finnhubQuote && finnhubQuote.c) {
            data = {
              symbol,
              price: finnhubQuote.c,
              change: finnhubQuote.d ?? 0,
              changePercent: finnhubQuote.dp ?? 0,
              high: finnhubQuote.h ?? 0,
              low: finnhubQuote.l ?? 0,
              open: finnhubQuote.o ?? 0,
              previousClose: finnhubQuote.pc ?? 0,
              source: 'finnhub',
              timestamp: new Date().toISOString()
            };
          }
        }
      } catch {
        console.log('Finnhub unavailable, using fallback data');
      }

      if (data.source === 'fallback') {
        try {
          const yahooResponse = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
          const yahooData = (await yahooResponse.json()) as {
            chart?: { result?: Array<{ meta?: Record<string, number> }> }
          };

          const meta = yahooData.chart?.result?.[0]?.meta;
          if (meta) {
            const price = meta['regularMarketPrice'] ?? 0;
            const prevClose = meta['previousClose'] ?? 0;
            data = {
              symbol,
              price,
              change: price - prevClose,
              changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
              high: meta['regularMarketDayHigh'] ?? 0,
              low: meta['regularMarketDayLow'] ?? 0,
              open: meta['regularMarketOpen'] ?? 0,
              previousClose: prevClose,
              source: 'yahoo',
              timestamp: new Date().toISOString()
            };
          }
        } catch {
          console.log('Yahoo Finance also failed, data unavailable');
          data.source = 'unavailable';
        }
      }

      res.json({ success: true, data });
    } catch (err: unknown) {
      console.error('Enhanced quote error:', err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  app.get('/api/market/company-profile/:symbol', async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.params;

      let profile: CompanyProfileData = {
        symbol,
        name: symbol,
        source: 'fallback',
        timestamp: new Date().toISOString()
      };

      try {
        if (process.env.FINNHUB_API_KEY) {
          const response = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${process.env.FINNHUB_API_KEY}`);
          const finnhubProfile = (await response.json()) as FinnhubProfile;

          if (finnhubProfile && finnhubProfile.name) {
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
      } catch {
        console.log('Finnhub profile unavailable, using fallback');
      }

      if (profile.source === 'fallback') {
        const companyNames: Record<string, string> = {
          AAPL: 'Apple Inc.',
          GOOGL: 'Alphabet Inc.',
          MSFT: 'Microsoft Corporation',
          TSLA: 'Tesla Inc.',
          AMZN: 'Amazon.com Inc.',
          NVDA: 'NVIDIA Corporation',
          META: 'Meta Platforms Inc.',
          NFLX: 'Netflix Inc.'
        };

        const name = companyNames[symbol] ?? `${symbol} Corporation`;
        profile.name = name;
        profile.description = `${name} is a publicly traded company.`;
        profile.source = 'static';
      }

      res.json({ success: true, data: profile });
    } catch (err: unknown) {
      console.error('Company profile error:', err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  app.get('/api/market/enhanced-news', async (req: Request, res: Response): Promise<void> => {
    try {
      const { symbol } = req.query;

      let news: NewsItem[] = [];

      try {
        if (process.env.FINNHUB_API_KEY && symbol) {
          const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          const to   = new Date().toISOString().split('T')[0];
          const response = await fetch(
            `https://finnhub.io/api/v1/company-news?symbol=${String(symbol)}&from=${from}&to=${to}&token=${process.env.FINNHUB_API_KEY}`
          );
          const finnhubNews = (await response.json()) as FinnhubNewsItem[];

          if (Array.isArray(finnhubNews)) {
            news = finnhubNews.slice(0, 10).map(item => ({
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
      } catch {
        console.log('Finnhub news unavailable, using fallback');
      }

      if (news.length === 0) {
        news = [
          {
            id: Date.now(),
            title: 'Market Analysis: Technology Stocks Show Mixed Performance',
            summary: 'Technology sector continues to show volatility as investors react to earnings reports and economic indicators.',
            url: '#',
            datetime: new Date().toISOString(),
            source: 'Market Analysis',
            category: 'market',
            provider: 'static'
          },
          {
            id: Date.now() + 1,
            title: 'Federal Reserve Maintains Interest Rate Policy',
            summary: 'The Federal Reserve announced it will maintain current interest rates amid ongoing economic monitoring.',
            url: '#',
            datetime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            source: 'Economic News',
            category: 'economic',
            provider: 'static'
          }
        ];
      }

      res.json({ success: true, data: news, count: news.length });
    } catch (err: unknown) {
      console.error('Enhanced news error:', err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  app.get('/api/market/indices', async (_req: Request, res: Response): Promise<void> => {
    try {
      const cacheKey = 'global_indices';
      const cached = marketDataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        res.json(cached.data);
        return;
      }

      const globalIndices: Array<{ symbol: string; name: string }> = [
        { symbol: '^GSPC',  name: 'S&P 500'    },
        { symbol: '^IXIC',  name: 'NASDAQ'      },
        { symbol: '^DJI',   name: 'Dow Jones'   },
        { symbol: '^NSEI',  name: 'Nifty 50'    },
        { symbol: '^BSESN', name: 'BSE Sensex'  },
        { symbol: '^N225',  name: 'Nikkei 225'  },
        { symbol: '^HSI',   name: 'Hang Seng'   },
        { symbol: '^FTSE',  name: 'FTSE 100'    },
        { symbol: '^GDAXI', name: 'DAX'         },
        { symbol: '^FCHI',  name: 'CAC 40'      }
      ];

      const promises = globalIndices.map(async (index): Promise<IndexQuote> => {
        try {
          const basePrice = getBasePrice(index.symbol);
          // Static data – real prices require a paid exchange feed
          if (basePrice > 0) {
            return {
              symbol: index.symbol,
              price: basePrice,
              change: 0,
              changePercent: 0,
              high: basePrice,
              low: basePrice,
              open: basePrice,
              previousClose: basePrice,
              timestamp: Math.floor(Date.now() / 1000)
            };
          }
          throw new Error('No base price');
        } catch {
          const basePrice = getBasePrice(index.symbol);
          const change = (Math.random() - 0.5) * (basePrice * 0.015);
          const changePercent = (change / basePrice) * 100;
          return {
            symbol: index.symbol,
            price: basePrice + change,
            change,
            changePercent,
            high: basePrice + Math.abs(change) * 1.1,
            low: basePrice - Math.abs(change) * 1.1,
            open: basePrice,
            previousClose: basePrice,
            timestamp: Math.floor(Date.now() / 1000)
          };
        }
      });

      const results = await Promise.all(promises);

      marketDataCache.set(cacheKey, { data: results, timestamp: Date.now() });
      res.json(results);
    } catch (err: unknown) {
      console.error('Error fetching indices:', err);
      res.status(500).json({ error: 'Failed to fetch market indices' });
    }
  });

  app.get('/api/market/news', async (req: Request, res: Response): Promise<void> => {
    try {
      const { category = 'all', limit = '20' } = req.query;
      const maxItems = queryInt(limit, 20);

      if (process.env.FINNHUB_API_KEY) {
        const finnhubCategory = category === 'all' ? 'general' : queryStr(category, 'general');
        const newsData = await finnhubService.getMarketNews(finnhubCategory) as Array<Record<string, unknown>>;
        if (newsData && newsData.length > 0) {
          res.json(newsData.slice(0, maxItems));
          return;
        }
      }

      const now = Math.floor(Date.now() / 1000);
      const curatedNews = [
        { id: 1, category: 'general', datetime: now - 3600,  headline: 'RBI keeps repo rate unchanged at 6.50% amid easing inflation',                    image: '', source: 'RBI',   summary: 'The Reserve Bank of India maintained its key lending rate at 6.50%, citing a stable inflation trajectory and resilient domestic growth outlook for FY2026-27.',                                                                              url: 'https://rbi.org.in'      },
        { id: 2, category: 'general', datetime: now - 7200,  headline: 'SEBI introduces new framework for mutual fund light regulation',                    image: '', source: 'SEBI',  summary: 'Markets regulator SEBI has proposed a lighter regulatory framework for passively managed mutual fund schemes to reduce compliance costs and boost passive investing.',               url: 'https://sebi.gov.in'     },
        { id: 3, category: 'general', datetime: now - 10800, headline: 'India GDP growth accelerates to 7.2% in Q3 FY26',                                  image: '', source: 'MoSPI', summary: "India's economy grew at 7.2% year-on-year in the October-December quarter, driven by robust services sector activity and strong urban consumption demand.",                   url: 'https://mospi.gov.in'    },
        { id: 4, category: 'general', datetime: now - 14400, headline: 'Nifty 50 hits all-time high as FII inflows surge',                                  image: '', source: 'NSE',   summary: 'The benchmark Nifty 50 index touched a fresh lifetime high, supported by sustained foreign institutional investor inflows and positive global sentiment.',                          url: 'https://nseindia.com'    },
        { id: 5, category: 'general', datetime: now - 18000, headline: 'SIP contributions cross Rs 25,000 crore monthly milestone',                         image: '', source: 'AMFI',  summary: 'Systematic Investment Plan contributions to mutual funds crossed the Rs 25,000 crore monthly mark for the first time, reflecting growing retail investor participation.',         url: 'https://amfiindia.com'   },
        { id: 6, category: 'general', datetime: now - 21600, headline: 'Government bonds rally as 10-year yield falls below 7%',                            image: '', source: 'RBI',   summary: 'Indian government bond prices rallied with the benchmark 10-year yield dropping below the 7% level, buoyed by expectations of monetary easing in the near term.',               url: 'https://rbi.org.in'      },
        { id: 7, category: 'general', datetime: now - 25200, headline: 'Union Budget 2026: Key highlights for investors',                                   image: '', source: 'PIB',   summary: 'The Union Budget for FY2026-27 introduced several investor-friendly measures including enhanced deductions for long-term capital gains and simplified TDS provisions.',           url: 'https://pib.gov.in'      },
        { id: 8, category: 'general', datetime: now - 28800, headline: 'Gold ETFs see record inflows amid global uncertainty',                               image: '', source: 'AMFI',  summary: 'Gold exchange-traded funds in India witnessed record monthly inflows as investors sought safe-haven assets amid geopolitical tensions and volatile equity markets.',              url: 'https://amfiindia.com'   },
      ];
      res.json(curatedNews.slice(0, maxItems));
    } catch (err: unknown) {
      console.error('Error fetching news:', err);
      res.json([]);
    }
  });

  app.get('/api/market/news/categories', async (_req: Request, res: Response): Promise<void> => {
    try {
      const categories = [
        { id: 'all',               name: 'All News',           description: 'Complete market and financial news coverage'     },
        { id: 'market',            name: 'Market Updates',     description: 'Index movements and market trends'              },
        { id: 'technology',        name: 'Technology',         description: 'IT and technology sector news'                  },
        { id: 'ipo',               name: 'IPOs & Primary Market', description: 'New listings and public offerings'           },
        { id: 'mutual_funds',      name: 'Mutual Funds',       description: 'Fund performance and industry news'             },
        { id: 'bonds',             name: 'Fixed Income',       description: 'Bond market and interest rate news'             },
        { id: 'sector',            name: 'Sector Analysis',    description: 'Industry-specific updates and trends'           },
        { id: 'commodities',       name: 'Commodities',        description: 'Gold, oil, and commodity price movements'       },
        { id: 'regulatory',        name: 'Regulatory Updates', description: 'SEBI, RBI, and government policy changes'       },
        { id: 'global',            name: 'Global Markets',     description: 'International market developments'              },
        { id: 'earnings',          name: 'Earnings Reports',   description: 'Company quarterly results and guidance'         },
        { id: 'analyst_update',    name: 'Analyst Research',   description: 'Research reports and rating changes'            },
        { id: 'technical_analysis',name: 'Technical Analysis', description: 'Chart patterns and technical indicators'        },
      ];
      res.json(categories);
    } catch (err: unknown) {
      console.error('Error fetching news categories:', err);
      res.status(500).json({ error: 'Failed to fetch news categories' });
    }
  });

  app.get('/api/market/news/search', async (req: Request, res: Response): Promise<void> => {
    try {
      const { q: searchQuery } = req.query;

      if (!searchQuery) {
        res.status(400).json({ error: 'Search query is required' });
        return;
      }

      res.json({
        query: searchQuery,
        total: 0,
        results: [],
        message: 'News search requires Finnhub API integration. Configure FINNHUB_API_KEY for live news search.'
      });
    } catch (err: unknown) {
      console.error('Error searching news:', err);
      res.status(500).json({ error: 'Failed to search news' });
    }
  });

  app.get('/api/market/news/trending', async (_req: Request, res: Response): Promise<void> => {
    try {
      res.json([]);
    } catch (err: unknown) {
      console.error('Error fetching trending news:', err);
      res.json([]);
    }
  });
}
