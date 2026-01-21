import { Router, Request, Response } from 'express';
import { db } from '../db';
import * as schema from '@shared/schema';
import { eq, and, desc, sql, ilike, inArray } from 'drizzle-orm';
import { financialMetricsRefreshService } from '../services/financial-metrics-refresh-service';
import { financialMetricsCalculator } from '../services/financial-metrics-calculator';

const router = Router();

// Get latest metrics for a stock
router.get('/stocks/:stockId', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    
    const metrics = await financialMetricsRefreshService.getLatestStockMetrics(stockId);
    
    if (!metrics) {
      return res.status(404).json({ error: 'Metrics not found for this stock' });
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching stock metrics:', error);
    res.status(500).json({ error: 'Failed to fetch stock metrics' });
  }
});

// Get multi-year historical metrics for a stock
router.get('/stocks/:stockId/history', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    const years = parseInt(req.query.years as string) || 5;
    
    const metrics = await financialMetricsRefreshService.getStockMetricsHistory(stockId, years);
    
    res.json({
      stockId,
      years,
      metrics,
      count: metrics.length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching stock metrics history:', error);
    res.status(500).json({ error: 'Failed to fetch stock metrics history' });
  }
});

// Get specific metrics trend over time
router.get('/stocks/:stockId/trends', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    const metricsParam = req.query.metrics as string;
    const years = parseInt(req.query.years as string) || 5;
    
    const metricNames = metricsParam 
      ? metricsParam.split(',').map(m => m.trim())
      : ['roe', 'roce', 'netMargin', 'revenueGrowthYoy', 'debtToEquity'];
    
    const trends = await financialMetricsRefreshService.getMetricsTrend(stockId, metricNames, years);
    
    res.json({
      stockId,
      years,
      metrics: metricNames,
      trends,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching metrics trends:', error);
    res.status(500).json({ error: 'Failed to fetch metrics trends' });
  }
});

// Get metrics by stock symbol
router.get('/symbol/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    
    const metrics = await financialMetricsRefreshService.getMetricsBySymbol(symbol.toUpperCase());
    
    if (metrics.length === 0) {
      return res.status(404).json({ error: 'Metrics not found for this symbol' });
    }
    
    res.json({
      symbol: symbol.toUpperCase(),
      latest: metrics[0],
      history: metrics,
      yearsAvailable: metrics.length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching metrics by symbol:', error);
    res.status(500).json({ error: 'Failed to fetch metrics by symbol' });
  }
});

// Compare multiple stocks
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { stockIds, metrics } = req.body;
    
    if (!stockIds || !Array.isArray(stockIds) || stockIds.length === 0) {
      return res.status(400).json({ error: 'stockIds array is required' });
    }
    
    const metricNames = metrics || [
      'trailingPe', 'forwardPe', 'pegRatio', 'priceToBook', 'priceToSales',
      'roe', 'roce', 'netMargin', 'debtToEquity', 'currentRatio',
      'revenueGrowthYoy', 'epsGrowthYoy', 'piotroskiFScore', 'altmanZScore'
    ];
    
    const comparison = await financialMetricsRefreshService.compareStocks(stockIds, metricNames);
    
    res.json({
      comparison,
      metrics: metricNames,
      stockCount: Object.keys(comparison).length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error comparing stocks:', error);
    res.status(500).json({ error: 'Failed to compare stocks' });
  }
});

// Get sector averages
router.get('/sector/:sector/averages', async (req: Request, res: Response) => {
  try {
    const { sector } = req.params;
    
    const averages = await financialMetricsRefreshService.getSectorAverages(sector);
    
    res.json({
      sector,
      averages,
      metricsCount: Object.keys(averages).length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching sector averages:', error);
    res.status(500).json({ error: 'Failed to fetch sector averages' });
  }
});

// Refresh metrics for a specific stock (admin only)
router.post('/refresh/:stockId', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    
    const success = await financialMetricsRefreshService.refreshStockMetrics(stockId);
    
    if (success) {
      const metrics = await financialMetricsRefreshService.getLatestStockMetrics(stockId);
      res.json({ success: true, metrics });
    } else {
      res.status(500).json({ success: false, error: 'Failed to refresh metrics' });
    }
  } catch (error) {
    console.error('[FinancialMetrics] Error refreshing stock metrics:', error);
    res.status(500).json({ error: 'Failed to refresh stock metrics' });
  }
});

// Batch refresh metrics (admin only)
router.post('/refresh/batch', async (req: Request, res: Response) => {
  try {
    const { batchSize = 50 } = req.body;
    
    const result = await financialMetricsRefreshService.refreshAllStockMetrics(batchSize);
    
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error in batch refresh:', error);
    res.status(500).json({ error: 'Failed to perform batch refresh' });
  }
});

// === MUTUAL FUND METRICS ===

router.get('/mutual-funds/:schemeCode', async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    
    const metrics = await db.query.mutualFundMetrics.findFirst({
      where: eq(schema.mutualFundMetrics.schemeCode, schemeCode),
      orderBy: [desc(schema.mutualFundMetrics.fiscalYear)],
    });
    
    if (!metrics) {
      return res.status(404).json({ error: 'Metrics not found for this scheme' });
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching MF metrics:', error);
    res.status(500).json({ error: 'Failed to fetch mutual fund metrics' });
  }
});

router.get('/mutual-funds/:schemeCode/history', async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    const years = parseInt(req.query.years as string) || 5;
    
    const metrics = await db
      .select()
      .from(schema.mutualFundMetrics)
      .where(eq(schema.mutualFundMetrics.schemeCode, schemeCode))
      .orderBy(desc(schema.mutualFundMetrics.fiscalYear))
      .limit(years);
    
    res.json({
      schemeCode,
      years,
      metrics,
      count: metrics.length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching MF metrics history:', error);
    res.status(500).json({ error: 'Failed to fetch mutual fund metrics history' });
  }
});

// === BOND METRICS ===

router.get('/bonds/:isin', async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    
    const metrics = await db.query.bondMetrics.findFirst({
      where: eq(schema.bondMetrics.isin, isin),
      orderBy: [desc(schema.bondMetrics.fiscalYear)],
    });
    
    if (!metrics) {
      return res.status(404).json({ error: 'Metrics not found for this bond' });
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching bond metrics:', error);
    res.status(500).json({ error: 'Failed to fetch bond metrics' });
  }
});

router.get('/bonds/:isin/history', async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    const years = parseInt(req.query.years as string) || 5;
    
    const metrics = await db
      .select()
      .from(schema.bondMetrics)
      .where(eq(schema.bondMetrics.isin, isin))
      .orderBy(desc(schema.bondMetrics.fiscalYear))
      .limit(years);
    
    res.json({
      isin,
      years,
      metrics,
      count: metrics.length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching bond metrics history:', error);
    res.status(500).json({ error: 'Failed to fetch bond metrics history' });
  }
});

// === REIT/InvIT METRICS ===

router.get('/reits/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    
    const metrics = await db.query.reitInvitMetrics.findFirst({
      where: eq(schema.reitInvitMetrics.entityId, entityId),
      orderBy: [desc(schema.reitInvitMetrics.fiscalYear)],
    });
    
    if (!metrics) {
      return res.status(404).json({ error: 'Metrics not found for this REIT/InvIT' });
    }
    
    res.json(metrics);
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching REIT metrics:', error);
    res.status(500).json({ error: 'Failed to fetch REIT/InvIT metrics' });
  }
});

router.get('/reits/:entityId/history', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const years = parseInt(req.query.years as string) || 5;
    
    const metrics = await db
      .select()
      .from(schema.reitInvitMetrics)
      .where(eq(schema.reitInvitMetrics.entityId, entityId))
      .orderBy(desc(schema.reitInvitMetrics.fiscalYear))
      .limit(years);
    
    res.json({
      entityId,
      years,
      metrics,
      count: metrics.length,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching REIT metrics history:', error);
    res.status(500).json({ error: 'Failed to fetch REIT/InvIT metrics history' });
  }
});

// === QUALITY SCORES ===

router.get('/quality-scores/:stockId', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    
    const metrics = await financialMetricsRefreshService.getLatestStockMetrics(stockId);
    
    if (!metrics) {
      return res.status(404).json({ error: 'Metrics not found for this stock' });
    }
    
    const qualityScores = {
      stockId,
      fiscalYear: metrics.fiscalYear,
      piotroskiFScore: metrics.piotroskiFScore,
      piotroskiInterpretation: getPiotroskiInterpretation(metrics.piotroskiFScore),
      altmanZScore: parseFloat(metrics.altmanZScore?.toString() || '0'),
      altmanInterpretation: getAltmanInterpretation(parseFloat(metrics.altmanZScore?.toString() || '0')),
      beneishMScore: parseFloat(metrics.beneishMScore?.toString() || '0'),
      accrualRatio: parseFloat(metrics.accrualRatio?.toString() || '0'),
      earningsQuality: parseFloat(metrics.earningsQuality?.toString() || '0'),
      earningsQualityInterpretation: getEarningsQualityInterpretation(parseFloat(metrics.earningsQuality?.toString() || '0')),
    };
    
    res.json(qualityScores);
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching quality scores:', error);
    res.status(500).json({ error: 'Failed to fetch quality scores' });
  }
});

// Helper functions for interpretations
function getPiotroskiInterpretation(score: number | null): string {
  if (score === null) return 'Not Available';
  if (score >= 8) return 'Strong (High Quality)';
  if (score >= 6) return 'Moderate (Acceptable Quality)';
  if (score >= 4) return 'Weak (Below Average)';
  return 'Poor (Low Quality)';
}

function getAltmanInterpretation(score: number): string {
  if (score > 2.99) return 'Safe Zone (Low Bankruptcy Risk)';
  if (score >= 1.81) return 'Grey Zone (Moderate Risk)';
  return 'Distress Zone (High Bankruptcy Risk)';
}

function getEarningsQualityInterpretation(ratio: number): string {
  if (ratio >= 1.0) return 'High Quality (Cash Backed Earnings)';
  if (ratio >= 0.8) return 'Good Quality';
  if (ratio >= 0.5) return 'Moderate Quality';
  return 'Low Quality (Accrual Heavy)';
}

// === METRICS SUMMARY FOR RECOMMENDATIONS ===

router.get('/recommendation-data/:stockId', async (req: Request, res: Response) => {
  try {
    const { stockId } = req.params;
    
    const metrics = await financialMetricsRefreshService.getLatestStockMetrics(stockId);
    const stock = await db.query.listedStocks.findFirst({
      where: eq(schema.listedStocks.id, stockId),
    });
    
    if (!metrics || !stock) {
      return res.status(404).json({ error: 'Data not found for this stock' });
    }
    
    // Get sector averages for comparison
    const sectorAverages = stock.broadSector 
      ? await financialMetricsRefreshService.getSectorAverages(stock.broadSector)
      : {};
    
    res.json({
      stock: {
        id: stock.id,
        symbol: stock.symbol,
        name: stock.companyName,
        sector: stock.broadSector,
        marketCap: stock.marketCap,
        currentPrice: stock.currentPrice,
      },
      valuation: {
        trailingPe: parseFloat(metrics.trailingPe?.toString() || '0'),
        forwardPe: parseFloat(metrics.forwardPe?.toString() || '0'),
        pegRatio: parseFloat(metrics.pegRatio?.toString() || '0'),
        priceToBook: parseFloat(metrics.priceToBook?.toString() || '0'),
        priceToSales: parseFloat(metrics.priceToSales?.toString() || '0'),
        evToEbitda: parseFloat(metrics.evToEbitda?.toString() || '0'),
      },
      profitability: {
        roe: parseFloat(metrics.roe?.toString() || '0'),
        roce: parseFloat(metrics.roce?.toString() || '0'),
        roic: parseFloat(metrics.roic?.toString() || '0'),
        netMargin: parseFloat(metrics.netMargin?.toString() || '0'),
        operatingMargin: parseFloat(metrics.operatingMargin?.toString() || '0'),
      },
      growth: {
        revenueGrowthYoy: parseFloat(metrics.revenueGrowthYoy?.toString() || '0'),
        epsGrowthYoy: parseFloat(metrics.epsGrowthYoy?.toString() || '0'),
        revenueCagr3y: parseFloat(metrics.revenueCagr3y?.toString() || '0'),
        epsCagr3y: parseFloat(metrics.epsCagr3y?.toString() || '0'),
      },
      financial_health: {
        debtToEquity: parseFloat(metrics.debtToEquity?.toString() || '0'),
        currentRatio: parseFloat(metrics.currentRatio?.toString() || '0'),
        interestCoverage: parseFloat(metrics.interestCoverage?.toString() || '0'),
        netDebtToEbitda: parseFloat(metrics.netDebtToEbitda?.toString() || '0'),
      },
      quality: {
        piotroskiFScore: metrics.piotroskiFScore,
        altmanZScore: parseFloat(metrics.altmanZScore?.toString() || '0'),
        earningsQuality: parseFloat(metrics.earningsQuality?.toString() || '0'),
      },
      dividend: {
        yield: parseFloat(metrics.dividendYield?.toString() || '0'),
        payoutRatio: parseFloat(metrics.dividendPayoutRatio?.toString() || '0'),
        streak: metrics.dividendStreak,
      },
      sectorComparison: sectorAverages,
      fiscalYear: metrics.fiscalYear,
      lastUpdated: metrics.lastUpdated,
    });
  } catch (error) {
    console.error('[FinancialMetrics] Error fetching recommendation data:', error);
    res.status(500).json({ error: 'Failed to fetch recommendation data' });
  }
});

export default router;
