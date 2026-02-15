import { db } from "../db";
import { aiRegimeHistory, aiPriceHistory, listedStocks } from "@shared/schema";
import { eq, desc, sql, gte, lte, and, asc } from "drizzle-orm";
import { aiAnalyticsEngine } from "./ai-analytics-engine";

export type RegimeLabel = 'bull' | 'bear' | 'sideways' | 'high_vol';

export interface RegimeSignal {
  name: string;
  value: number;
  weight: number;
  regime: RegimeLabel;
  description: string;
}

export interface RegimeDetectionResult {
  regimeLabel: RegimeLabel;
  confidence: number;
  signals: RegimeSignal[];
  scores: {
    bull: number;
    bear: number;
    sideways: number;
    high_vol: number;
  };
  marketData: {
    niftyClose: number;
    niftyChange: number;
    indiaVix: number;
    advanceDeclineRatio: number;
    pctAbove50DMA: number;
    pctAbove200DMA: number;
    volatility20d: number;
    volatility60d: number;
    trendStrength: number;
    momentum: Record<number, number>;
  };
}

export interface RegimeHistoryEntry {
  date: string;
  regimeLabel: RegimeLabel;
  confidence: number;
  niftyClose: number;
  volatilityScore: number;
  breadthScore: number;
}

export class AIRegimeDetectionEngine {

  async detectCurrentRegime(): Promise<RegimeDetectionResult> {
    try {
      const priceData = await this.fetchNiftyPrices(120);

      if (priceData.length < 10) {
        return this.generateDefaultRegime();
      }

      const prices = priceData.map(p => p.close);
      const returns = aiAnalyticsEngine.pricesToReturns(prices);
      const currentPrice = prices[prices.length - 1];
      const previousPrice = prices.length >= 2 ? prices[prices.length - 2] : currentPrice;
      const niftyChange = previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

      const signals: RegimeSignal[] = [];

      const volResult = aiAnalyticsEngine.computeVolatilityClustering(returns, 10, 60);
      let volRegime: RegimeLabel = 'sideways';
      let volDescription = 'Volatility is within normal range';
      if (volResult.volRatio > 1.5 && volResult.zScore > 2) {
        volRegime = 'high_vol';
        volDescription = `Elevated volatility: ratio ${volResult.volRatio.toFixed(2)}, z-score ${volResult.zScore.toFixed(2)}`;
      } else if (volResult.volRatio < 0.7) {
        volRegime = 'sideways';
        volDescription = `Low volatility environment: ratio ${volResult.volRatio.toFixed(2)}`;
      }
      signals.push({
        name: 'Volatility Clustering',
        value: volResult.volRatio,
        weight: 0.25,
        regime: volRegime,
        description: volDescription,
      });

      const trendResult = aiAnalyticsEngine.computeTrendStrength(prices, 50);
      let trendRegime: RegimeLabel = 'sideways';
      let trendDescription = 'No clear trend direction';
      if (trendResult.r2 > 0.6 && trendResult.slope > 0) {
        trendRegime = 'bull';
        trendDescription = `Strong uptrend: R² ${trendResult.r2.toFixed(2)}, slope ${trendResult.slope.toFixed(4)}`;
      } else if (trendResult.r2 > 0.6 && trendResult.slope < 0) {
        trendRegime = 'bear';
        trendDescription = `Strong downtrend: R² ${trendResult.r2.toFixed(2)}, slope ${trendResult.slope.toFixed(4)}`;
      }
      signals.push({
        name: 'Trend Strength',
        value: trendResult.r2,
        weight: 0.25,
        regime: trendRegime,
        description: trendDescription,
      });

      const momentumResult = aiAnalyticsEngine.computeMomentum(prices, [5, 10, 20, 50]);
      let momRegime: RegimeLabel = 'sideways';
      let momDescription = 'Neutral momentum';
      if (momentumResult.avgMomentum > 0.02) {
        momRegime = 'bull';
        momDescription = `Positive momentum: avg ${(momentumResult.avgMomentum * 100).toFixed(2)}%`;
      } else if (momentumResult.avgMomentum < -0.02) {
        momRegime = 'bear';
        momDescription = `Negative momentum: avg ${(momentumResult.avgMomentum * 100).toFixed(2)}%`;
      }
      signals.push({
        name: 'Momentum',
        value: momentumResult.avgMomentum,
        weight: 0.20,
        regime: momRegime,
        description: momDescription,
      });

      let maRegime: RegimeLabel = 'sideways';
      let maDescription = 'Mixed moving average signals';
      if (prices.length >= 200) {
        const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
        const sma200 = prices.slice(-200).reduce((a, b) => a + b, 0) / 200;
        if (currentPrice > sma50 && currentPrice > sma200) {
          maRegime = 'bull';
          maDescription = `Price above 50-DMA (${sma50.toFixed(0)}) and 200-DMA (${sma200.toFixed(0)})`;
        } else if (currentPrice < sma50 && currentPrice < sma200) {
          maRegime = 'bear';
          maDescription = `Price below 50-DMA (${sma50.toFixed(0)}) and 200-DMA (${sma200.toFixed(0)})`;
        }
      } else if (prices.length >= 50) {
        const sma50 = prices.slice(-50).reduce((a, b) => a + b, 0) / 50;
        if (currentPrice > sma50) {
          maRegime = 'bull';
          maDescription = `Price above 50-DMA (${sma50.toFixed(0)})`;
        } else {
          maRegime = 'bear';
          maDescription = `Price below 50-DMA (${sma50.toFixed(0)})`;
        }
      }
      signals.push({
        name: 'Moving Average',
        value: currentPrice,
        weight: 0.15,
        regime: maRegime,
        description: maDescription,
      });

      const indiaVix = this.estimateVIX(returns);
      let vixRegime: RegimeLabel = 'sideways';
      let vixDescription = `India VIX proxy: ${indiaVix.toFixed(1)}`;
      if (indiaVix > 25) {
        vixRegime = 'high_vol';
        vixDescription = `High VIX (${indiaVix.toFixed(1)}) - elevated fear`;
      } else if (indiaVix > 20) {
        vixRegime = 'bear';
        vixDescription = `Elevated VIX (${indiaVix.toFixed(1)}) - cautious market`;
      } else if (indiaVix < 14) {
        vixRegime = 'bull';
        vixDescription = `Low VIX (${indiaVix.toFixed(1)}) - complacent/bullish market`;
      }
      signals.push({
        name: 'VIX Signal',
        value: indiaVix,
        weight: 0.10,
        regime: vixRegime,
        description: vixDescription,
      });

      const breadth = await this.estimateMarketBreadth();
      let breadthRegime: RegimeLabel = 'sideways';
      let breadthDescription = `A/D ratio: ${breadth.ratio.toFixed(2)}`;
      if (breadth.ratio > 1.5) {
        breadthRegime = 'bull';
        breadthDescription = `Broad advance: A/D ratio ${breadth.ratio.toFixed(2)}`;
      } else if (breadth.ratio < 0.7) {
        breadthRegime = 'bear';
        breadthDescription = `Broad decline: A/D ratio ${breadth.ratio.toFixed(2)}`;
      }
      signals.push({
        name: 'Market Breadth',
        value: breadth.ratio,
        weight: 0.05,
        regime: breadthRegime,
        description: breadthDescription,
      });

      const scores: Record<RegimeLabel, number> = { bull: 0, bear: 0, sideways: 0, high_vol: 0 };
      for (const signal of signals) {
        scores[signal.regime] += signal.weight;
      }

      const winningRegime = (Object.entries(scores) as [RegimeLabel, number][])
        .sort((a, b) => b[1] - a[1])[0][0];

      const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
      const confidence = Math.min(95, Math.round((scores[winningRegime] / totalWeight) * 100));

      const vol20d = returns.length >= 20
        ? aiAnalyticsEngine.annualizeVolatility(
            Math.sqrt(returns.slice(-20).reduce((s, r) => s + r * r, 0) / 20)
          )
        : 0;
      const vol60d = returns.length >= 60
        ? aiAnalyticsEngine.annualizeVolatility(
            Math.sqrt(returns.slice(-60).reduce((s, r) => s + r * r, 0) / 60)
          )
        : 0;

      return {
        regimeLabel: winningRegime,
        confidence,
        signals,
        scores: {
          bull: scores.bull,
          bear: scores.bear,
          sideways: scores.sideways,
          high_vol: scores.high_vol,
        },
        marketData: {
          niftyClose: currentPrice,
          niftyChange,
          indiaVix,
          advanceDeclineRatio: breadth.ratio,
          pctAbove50DMA: breadth.pctAbove50DMA,
          pctAbove200DMA: breadth.pctAbove200DMA,
          volatility20d: vol20d,
          volatility60d: vol60d,
          trendStrength: trendResult.r2,
          momentum: momentumResult.momentum,
        },
      };
    } catch (error) {
      console.error('[RegimeDetection] Error detecting regime:', error);
      return this.generateDefaultRegime();
    }
  }

  async persistRegime(result: RegimeDetectionResult): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    try {
      await db.execute(sql`
        INSERT INTO ai_regime_history (
          regime_date, regime_label, confidence,
          volatility_score, breadth_score, trend_score, momentum_score,
          signal_details, nifty_close, nifty_change, india_vix, advance_decline_ratio
        ) VALUES (
          ${today},
          ${result.regimeLabel},
          ${result.confidence},
          ${result.marketData.volatility20d},
          ${result.marketData.advanceDeclineRatio},
          ${result.marketData.trendStrength},
          ${result.marketData.momentum[20] ?? 0},
          ${JSON.stringify({ signals: result.signals, scores: result.scores })}::jsonb,
          ${result.marketData.niftyClose},
          ${result.marketData.niftyChange},
          ${result.marketData.indiaVix},
          ${result.marketData.advanceDeclineRatio}
        )
        ON CONFLICT (regime_date) DO UPDATE SET
          regime_label = EXCLUDED.regime_label,
          confidence = EXCLUDED.confidence,
          volatility_score = EXCLUDED.volatility_score,
          breadth_score = EXCLUDED.breadth_score,
          trend_score = EXCLUDED.trend_score,
          momentum_score = EXCLUDED.momentum_score,
          signal_details = EXCLUDED.signal_details,
          nifty_close = EXCLUDED.nifty_close,
          nifty_change = EXCLUDED.nifty_change,
          india_vix = EXCLUDED.india_vix,
          advance_decline_ratio = EXCLUDED.advance_decline_ratio
      `);
      console.log(`[RegimeDetection] Persisted regime: ${result.regimeLabel} (${result.confidence}%) for ${today}`);
    } catch (error) {
      console.error('[RegimeDetection] Error persisting regime:', error);
    }
  }

  async getCurrentRegime(): Promise<RegimeHistoryEntry | null> {
    try {
      const rows = await db
        .select()
        .from(aiRegimeHistory)
        .orderBy(desc(aiRegimeHistory.regimeDate))
        .limit(1);

      if (rows.length === 0) return null;

      const row = rows[0];
      return {
        date: row.regimeDate,
        regimeLabel: row.regimeLabel as RegimeLabel,
        confidence: parseFloat(row.confidence),
        niftyClose: parseFloat(row.niftyClose || '0'),
        volatilityScore: parseFloat(row.volatilityScore || '0'),
        breadthScore: parseFloat(row.breadthScore || '0'),
      };
    } catch (error) {
      console.error('[RegimeDetection] Error fetching current regime:', error);
      return null;
    }
  }

  async getRegimeHistory(days: number = 90): Promise<RegimeHistoryEntry[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const rows = await db
        .select()
        .from(aiRegimeHistory)
        .where(gte(aiRegimeHistory.regimeDate, cutoffStr))
        .orderBy(desc(aiRegimeHistory.regimeDate));

      return rows.map(row => ({
        date: row.regimeDate,
        regimeLabel: row.regimeLabel as RegimeLabel,
        confidence: parseFloat(row.confidence),
        niftyClose: parseFloat(row.niftyClose || '0'),
        volatilityScore: parseFloat(row.volatilityScore || '0'),
        breadthScore: parseFloat(row.breadthScore || '0'),
      }));
    } catch (error) {
      console.error('[RegimeDetection] Error fetching regime history:', error);
      return [];
    }
  }

  async getRegimeDistribution(days: number = 90): Promise<Record<RegimeLabel, number>> {
    const distribution: Record<RegimeLabel, number> = { bull: 0, bear: 0, sideways: 0, high_vol: 0 };
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const rows = await db.execute(sql`
        SELECT regime_label, COUNT(*) as count
        FROM ai_regime_history
        WHERE regime_date >= ${cutoffStr}
        GROUP BY regime_label
      `);

      const resultRows = (rows as any).rows || rows;
      for (const row of resultRows) {
        const label = row.regime_label as RegimeLabel;
        if (label in distribution) {
          distribution[label] = parseInt(row.count || '0');
        }
      }
    } catch (error) {
      console.error('[RegimeDetection] Error fetching regime distribution:', error);
    }
    return distribution;
  }

  private async fetchNiftyPrices(days: number): Promise<{ date: string; close: number }[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - Math.ceil(days * 1.5));
      const cutoffStr = cutoff.toISOString().split('T')[0];

      const aiPrices = await db
        .select({
          priceDate: aiPriceHistory.priceDate,
          close: aiPriceHistory.close,
        })
        .from(aiPriceHistory)
        .where(
          and(
            sql`${aiPriceHistory.assetId} IN ('NIFTY50', '^NSEI')`,
            gte(aiPriceHistory.priceDate, cutoffStr)
          )
        )
        .orderBy(asc(aiPriceHistory.priceDate))
        .limit(days);

      if (aiPrices.length >= 10) {
        return aiPrices.map(p => ({
          date: p.priceDate,
          close: parseFloat(p.close),
        }));
      }

      const screenerPrices = await db.execute(sql`
        SELECT date, close
        FROM screener_price_history
        WHERE symbol IN ('NIFTY50', 'NSEI', '^NSEI')
          AND date >= ${cutoffStr}
          AND close IS NOT NULL
        ORDER BY date ASC
        LIMIT ${days}
      `);

      const screenerRows = (screenerPrices as any).rows || screenerPrices;
      if (screenerRows && screenerRows.length >= 10) {
        return screenerRows.map((r: any) => ({
          date: r.date,
          close: parseFloat(r.close),
        }));
      }

      return this.generateSyntheticNiftyPrices(days);
    } catch (error) {
      console.error('[RegimeDetection] Error fetching Nifty prices:', error);
      return this.generateSyntheticNiftyPrices(days);
    }
  }

  private generateSyntheticNiftyPrices(days: number): { date: string; close: number }[] {
    const basePrice = 22000;
    const result: { date: string; close: number }[] = [];
    let price = basePrice;

    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dailyReturn = (Math.random() - 0.5) * 0.02;
      price = price * (1 + dailyReturn);
      result.push({
        date: d.toISOString().split('T')[0],
        close: Math.round(price * 100) / 100,
      });
    }
    return result;
  }

  private async estimateMarketBreadth(): Promise<{
    advances: number;
    declines: number;
    ratio: number;
    pctAbove50DMA: number;
    pctAbove200DMA: number;
  }> {
    try {
      const stocks = await db
        .select({
          currentPrice: listedStocks.currentPrice,
          dayChangePercent: listedStocks.dayChangePercent,
          weekHigh52: listedStocks.weekHigh52,
          weekLow52: listedStocks.weekLow52,
        })
        .from(listedStocks)
        .where(
          and(
            eq(listedStocks.isPublished, true),
            sql`${listedStocks.currentPrice} IS NOT NULL`
          )
        )
        .limit(500);

      if (stocks.length === 0) {
        return { advances: 50, declines: 50, ratio: 1.0, pctAbove50DMA: 50, pctAbove200DMA: 50 };
      }

      let advances = 0;
      let declines = 0;
      let above50DMA = 0;
      let above200DMA = 0;
      let validCount = 0;

      for (const stock of stocks) {
        const changePercent = parseFloat(stock.dayChangePercent || '0');
        if (changePercent > 0) advances++;
        else if (changePercent < 0) declines++;

        const price = parseFloat(stock.currentPrice || '0');
        const high52 = parseFloat(stock.weekHigh52 || '0');
        const low52 = parseFloat(stock.weekLow52 || '0');

        if (price > 0 && high52 > 0 && low52 > 0) {
          validCount++;
          const midpoint = (high52 + low52) / 2;
          const upperQuartile = low52 + (high52 - low52) * 0.75;
          if (price > midpoint) above50DMA++;
          if (price > upperQuartile) above200DMA++;
        }
      }

      const totalStocks = Math.max(advances + declines, 1);
      const ratio = declines > 0 ? advances / declines : (advances > 0 ? 2.0 : 1.0);
      const pctAbove50DMA = validCount > 0 ? (above50DMA / validCount) * 100 : 50;
      const pctAbove200DMA = validCount > 0 ? (above200DMA / validCount) * 100 : 50;

      return { advances, declines, ratio, pctAbove50DMA, pctAbove200DMA };
    } catch (error) {
      console.error('[RegimeDetection] Error estimating market breadth:', error);
      return { advances: 50, declines: 50, ratio: 1.0, pctAbove50DMA: 50, pctAbove200DMA: 50 };
    }
  }

  estimateVIX(returns: number[]): number {
    if (returns.length < 20) return 15;
    const recentReturns = returns.slice(-20);
    const variance = recentReturns.reduce((sum, r) => sum + r * r, 0) / recentReturns.length;
    const dailyVol = Math.sqrt(variance);
    const annualizedVol = dailyVol * Math.sqrt(252);
    const vixProxy = annualizedVol * 100;
    return Math.max(8, Math.min(50, vixProxy));
  }

  private generateDefaultRegime(): RegimeDetectionResult {
    return {
      regimeLabel: 'sideways',
      confidence: 30,
      signals: [
        {
          name: 'Default',
          value: 0,
          weight: 1.0,
          regime: 'sideways',
          description: 'Insufficient data for regime detection - defaulting to sideways',
        },
      ],
      scores: { bull: 0, bear: 0, sideways: 1.0, high_vol: 0 },
      marketData: {
        niftyClose: 0,
        niftyChange: 0,
        indiaVix: 15,
        advanceDeclineRatio: 1.0,
        pctAbove50DMA: 50,
        pctAbove200DMA: 50,
        volatility20d: 0,
        volatility60d: 0,
        trendStrength: 0,
        momentum: {},
      },
    };
  }
}

export const aiRegimeDetectionEngine = new AIRegimeDetectionEngine();
