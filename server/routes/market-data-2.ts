import { Express } from 'express';
import { storage } from '../storage';
import { finnhubService } from '../finnhub-service';
import { marketMoversCache } from '../services/market-movers-cache';
import { requireAdmin, requireAuth } from '../middleware/roleMiddleware';
import { and } from 'drizzle-orm';

export function registerMarketDataPart2Routes(app: Express): void {
app.get("/api/market/status", async (req, res) => {
  try {
    const { marketHolidayService } = await import('../services/market-holiday-service');
    
    const now = new Date();
    const istTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const hours = istTime.getHours();
    const minutes = istTime.getMinutes();

    const nseStatus = marketHolidayService.getMarketStatus('NSE');
    const bseStatus = marketHolidayService.getMarketStatus('BSE');
    const mcxStatus = marketHolidayService.getMarketStatus('MCX');
    const ncdexStatus = marketHolidayService.getMarketStatus('NCDEX');

    const marketStatus = {
      timestamp: istTime.toISOString(),
      timezone: 'Asia/Kolkata',
      currentTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} IST`,
      exchanges: {
        nse: {
          name: 'National Stock Exchange',
          status: nseStatus.isOpen ? 'open' : 'closed',
          reason: nseStatus.reason,
          isHoliday: nseStatus.isHoliday,
          holidayName: nseStatus.holidayName,
          isWeekend: nseStatus.isWeekend,
          nextTradingDay: nseStatus.nextTradingDay,
          specialSession: nseStatus.specialSession,
          tradingHours: `${nseStatus.tradingHours?.open} - ${nseStatus.tradingHours?.close} IST`
        },
        bse: {
          name: 'Bombay Stock Exchange',
          status: bseStatus.isOpen ? 'open' : 'closed',
          reason: bseStatus.reason,
          isHoliday: bseStatus.isHoliday,
          holidayName: bseStatus.holidayName,
          isWeekend: bseStatus.isWeekend,
          nextTradingDay: bseStatus.nextTradingDay,
          specialSession: bseStatus.specialSession,
          tradingHours: `${bseStatus.tradingHours?.open} - ${bseStatus.tradingHours?.close} IST`
        },
        mcx: {
          name: 'Multi Commodity Exchange',
          status: mcxStatus.isOpen ? 'open' : 'closed',
          reason: mcxStatus.reason,
          isHoliday: mcxStatus.isHoliday,
          holidayName: mcxStatus.holidayName,
          isWeekend: mcxStatus.isWeekend,
          nextTradingDay: mcxStatus.nextTradingDay,
          specialSession: mcxStatus.specialSession,
          tradingHours: `${mcxStatus.tradingHours?.open} - ${mcxStatus.tradingHours?.close} IST`
        },
        ncdex: {
          name: 'National Commodity & Derivatives Exchange',
          status: ncdexStatus.isOpen ? 'open' : 'closed',
          reason: ncdexStatus.reason,
          isHoliday: ncdexStatus.isHoliday,
          holidayName: ncdexStatus.holidayName,
          isWeekend: ncdexStatus.isWeekend,
          nextTradingDay: ncdexStatus.nextTradingDay,
          specialSession: ncdexStatus.specialSession,
          tradingHours: `${ncdexStatus.tradingHours?.open} - ${ncdexStatus.tradingHours?.close} IST`
        },
        msei: {
          name: 'Metropolitan Stock Exchange',
          status: nseStatus.isOpen ? 'open' : 'closed',
          reason: nseStatus.reason,
          isHoliday: nseStatus.isHoliday,
          holidayName: nseStatus.holidayName,
          isWeekend: nseStatus.isWeekend,
          nextTradingDay: nseStatus.nextTradingDay,
          tradingHours: '09:15 - 15:30 IST'
        },
        global: {
          name: 'Global Markets',
          status: 'open',
          reason: 'Trading Hours',
          isHoliday: false,
          isWeekend: false,
          tradingHours: '24/7 (Various Time Zones)'
        }
      }
    };

    res.json(marketStatus);
  } catch (error) {
    console.error("Error fetching market status:", error);
    res.status(500).json({ error: "Failed to fetch market status" });
  }
});

// Market Holiday Calendar APIs
app.get("/api/market/holidays", async (req, res) => {
  try {
    const { marketHolidayService } = await import('../services/market-holiday-service');
    const { year, exchange } = req.query;
    
    const targetYear = year ? parseInt(year as string) : new Date().getFullYear();
    const targetExchange = (exchange as 'NSE' | 'BSE' | 'MCX' | 'NCDEX') || undefined;
    
    const holidays = marketHolidayService.getHolidaysForYear(targetYear, targetExchange);
    
    res.json({
      success: true,
      year: targetYear,
      exchange: targetExchange || 'ALL',
      holidays,
      count: holidays.length
    });
  } catch (error) {
    console.error("Error fetching market holidays:", error);
    res.status(500).json({ error: "Failed to fetch market holidays" });
  }
});

app.get("/api/market/holidays/upcoming", async (req, res) => {
  try {
    const { marketHolidayService } = await import('../services/market-holiday-service');
    const { count, exchange } = req.query;
    
    const limit = count ? parseInt(count as string) : 10;
    const targetExchange = (exchange as 'NSE' | 'BSE' | 'MCX' | 'NCDEX') || 'NSE';
    
    const holidays = marketHolidayService.getUpcomingHolidays(limit, targetExchange);
    
    res.json({
      success: true,
      exchange: targetExchange,
      holidays,
      count: holidays.length
    });
  } catch (error) {
    console.error("Error fetching upcoming holidays:", error);
    res.status(500).json({ error: "Failed to fetch upcoming holidays" });
  }
});

app.get("/api/market/trading-calendar", async (req, res) => {
  try {
    const { marketHolidayService } = await import('../services/market-holiday-service');
    const { startDate, endDate, exchange } = req.query;
    const { format, addDays } = await import('date-fns');
    
    const start = startDate as string || format(new Date(), 'yyyy-MM-dd');
    const end = endDate as string || format(addDays(new Date(), 30), 'yyyy-MM-dd');
    const targetExchange = (exchange as 'NSE' | 'BSE' | 'MCX' | 'NCDEX') || 'NSE';
    
    const calendar = marketHolidayService.getTradingCalendar(start, end, targetExchange);
    const tradingDaysCount = calendar.filter(d => d.isTrading).length;
    const nonTradingDaysCount = calendar.filter(d => !d.isTrading).length;
    
    res.json({
      success: true,
      exchange: targetExchange,
      startDate: start,
      endDate: end,
      summary: {
        totalDays: calendar.length,
        tradingDays: tradingDaysCount,
        nonTradingDays: nonTradingDaysCount,
        holidays: calendar.filter(d => d.isHoliday && !d.isWeekend).length,
        weekends: calendar.filter(d => d.isWeekend).length
      },
      calendar
    });
  } catch (error) {
    console.error("Error fetching trading calendar:", error);
    res.status(500).json({ error: "Failed to fetch trading calendar" });
  }
});

app.get("/api/market/is-trading-day", async (req, res) => {
  try {
    const { marketHolidayService } = await import('../services/market-holiday-service');
    const { date, exchange } = req.query;
    const { format } = await import('date-fns');
    
    const targetDate = date as string || format(new Date(), 'yyyy-MM-dd');
    const targetExchange = (exchange as 'NSE' | 'BSE' | 'MCX' | 'NCDEX') || 'NSE';
    
    const isTradingDay = marketHolidayService.isTradingDay(targetDate, targetExchange);
    const holiday = marketHolidayService.getHoliday(targetDate, targetExchange);
    const isWeekend = marketHolidayService.isWeekendDay(targetDate);
    const nextTradingDay = marketHolidayService.getNextTradingDay(targetDate, targetExchange);
    
    res.json({
      success: true,
      date: targetDate,
      exchange: targetExchange,
      isTradingDay,
      isWeekend,
      isHoliday: !!holiday,
      holidayDetails: holiday,
      nextTradingDay: format(nextTradingDay, 'yyyy-MM-dd')
    });
  } catch (error) {
    console.error("Error checking trading day:", error);
    res.status(500).json({ error: "Failed to check trading day" });
  }
});

app.get("/api/market/next-trading-day", async (req, res) => {
  try {
    const { marketHolidayService } = await import('../services/market-holiday-service');
    const { date, exchange } = req.query;
    const { format } = await import('date-fns');
    
    const targetDate = date as string || format(new Date(), 'yyyy-MM-dd');
    const targetExchange = (exchange as 'NSE' | 'BSE' | 'MCX' | 'NCDEX') || 'NSE';
    
    const nextTradingDay = marketHolidayService.getNextTradingDay(targetDate, targetExchange);
    
    res.json({
      success: true,
      fromDate: targetDate,
      exchange: targetExchange,
      nextTradingDay: format(nextTradingDay, 'yyyy-MM-dd'),
      dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][nextTradingDay.getDay()]
    });
  } catch (error) {
    console.error("Error getting next trading day:", error);
    res.status(500).json({ error: "Failed to get next trading day" });
  }
});

app.get("/api/market/company/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Attempt to use Finnhub via service if available
    try {
      if (process.env.FINNHUB_API_KEY) {
        const profile = await finnhubService.getCompanyProfile(symbol.toUpperCase());
        return res.json({ success: true, data: profile });
      }
    } catch (e) {
      console.log(`Finnhub profile failed for ${symbol}, using static fallback`);
    }

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

    const name = companyNames[symbol.toUpperCase()] ?? `${symbol.toUpperCase()} Corp`;
    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        name,
        description: `${name} is a leading technology company in its sector.`,
        industry: 'Technology',
        marketCap: 1000000000,
        source: 'static-fallback'
      }
    });
  } catch (error) {
    console.error("Error fetching company profile:", error);
    res.status(500).json({ error: "Failed to fetch company profile" });
  }
});

// Advanced Market Data Features

// Company Earnings
app.get("/api/market/earnings/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Static fallback for demonstration
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      earnings: [
        { period: '2023-Q4', actual: 1.25, estimate: 1.20, surprise: 4.17 },
        { period: '2023-Q3', actual: 1.10, estimate: 1.05, surprise: 4.76 },
        { period: '2023-Q2', actual: 1.02, estimate: 1.00, surprise: 2.00 }
      ],
      source: 'static-fallback'
    });
  } catch (error) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({ error: "Failed to fetch earnings data" });
  }
});

// Analyst Recommendations
app.get("/api/market/recommendations/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      recommendations: {
        buy: 15,
        hold: 5,
        sell: 2,
        strongBuy: 10,
        strongSell: 1,
        consensus: 'Buy'
      },
      source: 'static-fallback'
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: "Failed to fetch analyst recommendations" });
  }
});

// Financial Metrics
app.get("/api/market/metrics/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    res.json({
      success: true,
      symbol: symbol.toUpperCase(),
      metrics: {
        peRatio: 25.4,
        marketCap: 2500000000000,
        dividendYield: 1.2,
        beta: 1.1,
        week52High: 195.20,
        week52Low: 140.50
      },
      source: 'static-fallback'
    });
  } catch (error) {
    console.error("Error fetching financial metrics:", error);
    res.status(500).json({ error: "Failed to fetch financial metrics" });
  }
});

// IPO Calendar
app.get("/api/market/ipo-calendar", async (req, res) => {
  try {
    res.json({
      success: true,
      ipoCalendar: [
        { symbol: 'ARM', name: 'Arm Holdings plc', date: '2023-09-14', price: '$51.00', status: 'Priced' },
        { symbol: 'CART', name: 'Instacart', date: '2023-09-19', price: '$30.00', status: 'Priced' },
        { symbol: 'BIRK', name: 'Birkenstock Holding plc', date: '2023-10-11', price: '$46.00', status: 'Priced' }
      ],
      source: 'static-fallback'
    });
  } catch (error) {
    console.error("Error fetching IPO calendar:", error);
    res.status(500).json({ error: "Failed to fetch IPO calendar" });
  }
});

// Economic Calendar
app.get("/api/market/economic-calendar", async (req, res) => {
  try {
    res.json({
      success: true,
      economicCalendar: [
        { event: 'Fed Interest Rate Decision', date: '2024-05-01', impact: 'High', actual: '5.50%', estimate: '5.50%' },
        { event: 'Non-Farm Payrolls', date: '2024-05-03', impact: 'High', actual: '175K', estimate: '243K' },
        { event: 'CPI (YoY)', date: '2024-05-15', impact: 'High', actual: '3.4%', estimate: '3.4%' }
      ],
      source: 'static-fallback'
    });
  } catch (error) {
    console.error("Error fetching economic calendar:", error);
    res.status(500).json({ error: "Failed to fetch economic calendar" });
  }
});

// Sector Performance
app.get("/api/market/sector-performance", async (req, res) => {
  try {
    res.json({
      success: true,
      sectors: [
        { name: 'Technology', performance: 1.25 },
        { name: 'Healthcare', performance: 0.45 },
        { name: 'Financials', performance: -0.20 },
        { name: 'Energy', performance: 2.10 },
        { name: 'Consumer Staples', performance: 0.15 }
      ],
      source: 'static-fallback'
    });
  } catch (error) {
    console.error("Error fetching sector performance:", error);
    res.status(500).json({ error: "Failed to fetch sector performance" });
  }
});

// Chat Session Routes
}
