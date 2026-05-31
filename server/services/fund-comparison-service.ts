// @ts-nocheck
import axios from 'axios';
import { MultiSourceMFService } from './multisource-mf-service';
import type { InsertFundComparison } from '@shared/schema';
import type { IStorage } from '../storage';

// Types for fund comparison data
export interface FundMetrics {
  schemeCode: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  currentNAV: number;
  
  // Performance metrics
  returns: {
    '1M': number | null;
    '3M': number | null;
    '6M': number | null;
    '1Y': number | null;
    '3Y': number | null;
    '5Y': number | null;
  };
  
  // Risk metrics
  volatility: number | null;
  sharpeRatio: number | null;
  alpha: number | null;
  beta: number | null;
  maxDrawdown: number | null;
  
  // Fund characteristics
  expenseRatio: number | null;
  aum: number | null;
  minInvestment: number | null;
  exitLoad: number | null;
  
  // Rankings and ratings
  categoryRank: number | null;
  totalFundsInCategory: number | null;
  smartRating: number | null;
  morningstarRating: number | null;
}

export interface ComparisonResult {
  funds: FundMetrics[];
  bestPerformer: {
    returns: string;
    riskAdjusted: string;
    expense: string;
  };
  summary: {
    averageReturns: Record<string, number>;
    riskRange: { min: number; max: number };
    expenseRange: { min: number; max: number };
  };
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export class FundComparisonService {
  private mfService: MultiSourceMFService;
  private readonly MFAPI_BASE = 'https://api.mfapi.in';
  private readonly BENCHMARK_INDEX = 'NIFTY_50'; // Default benchmark

  constructor(storage: IStorage) {
    this.mfService = new MultiSourceMFService(storage);
  }

  /**
   * Compare multiple funds and return detailed analysis
   */
  async compareFunds(
    fundCodes: string[], 
    timePeriod: string = '1Y',
    comparisonType: string = 'detailed'
  ): Promise<ComparisonResult> {
    try {
      console.log(`Starting fund comparison for codes: ${fundCodes.join(', ')}`);
      
      // Fetch fund data for all schemes
      const fundMetrics = await this.getFundMetrics(fundCodes, timePeriod);
      
      // Calculate comparative metrics
      const bestPerformer = this.determineBestPerformer(fundMetrics);
      const summary = this.calculateSummaryMetrics(fundMetrics);
      const recommendation = this.generateRecommendation(fundMetrics, bestPerformer);
      const riskLevel = this.assessOverallRisk(fundMetrics);

      return {
        funds: fundMetrics,
        bestPerformer,
        summary,
        recommendation,
        riskLevel
      };
    } catch (error) {
      console.error('Fund comparison failed:', error);
      throw new Error(`Fund comparison failed: ${error.message}`);
    }
  }

  /**
   * Get comprehensive metrics for a list of funds
   */
  private async getFundMetrics(fundCodes: string[], timePeriod: string): Promise<FundMetrics[]> {
    const metricsPromises = fundCodes.map(code => this.calculateFundMetrics(code, timePeriod));
    return Promise.all(metricsPromises);
  }

  /**
   * Calculate comprehensive metrics for a single fund
   */
  private async calculateFundMetrics(schemeCode: string, timePeriod: string): Promise<FundMetrics> {
    try {
      // Get fund details from multisource service
      const fundData = await this.mfService.getFund(schemeCode);
      if (!fundData) {
        throw new Error(`Fund data not available for scheme ${schemeCode}`);
      }

      // Get historical NAV data
      const historicalData = await this.fetchHistoricalNAV(schemeCode);
      
      // Calculate performance metrics
      const returns = this.calculateReturns(historicalData, timePeriod);
      const riskMetrics = this.calculateRiskMetrics(historicalData);
      const performanceMetrics = this.calculatePerformanceMetrics(historicalData, returns);

      return {
        schemeCode,
        schemeName: fundData.schemeName || 'Unknown Fund',
        fundHouse: fundData.fundHouse || 'Unknown AMC',
        category: fundData.category || 'Unknown Category',
        currentNAV: parseFloat(fundData.currentNav || '0'),
        
        returns,
        
        volatility: riskMetrics.volatility,
        sharpeRatio: performanceMetrics.sharpeRatio,
        alpha: performanceMetrics.alpha,
        beta: performanceMetrics.beta,
        maxDrawdown: riskMetrics.maxDrawdown,
        
        expenseRatio: fundData.expenseRatio ? parseFloat(fundData.expenseRatio.toString()) : null,
        aum: fundData.aum ? parseFloat(fundData.aum.toString()) : null,
        minInvestment: null, // minimumInvestment not available in FundExtended interface
        exitLoad: null, // Would need additional data source
        
        categoryRank: null, // Would need category comparison
        totalFundsInCategory: null,
        smartRating: fundData.crisilRating || null,
        morningstarRating: null // Would need Morningstar integration
      };
    } catch (error) {
      console.error(`Error calculating metrics for fund ${schemeCode}:`, error);
      throw error as Error;
    }
  }

  /**
   * Fetch historical NAV data from MFAPI
   */
  private async fetchHistoricalNAV(schemeCode: string): Promise<Array<{date: string, nav: string}>> {
    try {
      const response = await axios.get(`${this.MFAPI_BASE}/mf/${schemeCode}`, {
        timeout: 10000
      });
      return response.data.data || [];
    } catch (error) {
      console.error(`Error fetching historical data for ${schemeCode}:`, error);
      return [];
    }
  }

  /**
   * Calculate returns for different time periods
   */
  private calculateReturns(
    historicalData: Array<{date: string, nav: string}>, 
    timePeriod: string
  ): FundMetrics['returns'] {
    if (!historicalData || historicalData.length < 2) {
      return {
        '1M': null, '3M': null, '6M': null, 
        '1Y': null, '3Y': null, '5Y': null
      };
    }

    // Sort data by date (newest first)
    const sortedData = historicalData.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    const currentNAV = parseFloat(sortedData[0].nav);
    const today = new Date();

    const returns = {
      '1M': this.getReturnForPeriod(sortedData, currentNAV, 30),
      '3M': this.getReturnForPeriod(sortedData, currentNAV, 90),
      '6M': this.getReturnForPeriod(sortedData, currentNAV, 180),
      '1Y': this.getReturnForPeriod(sortedData, currentNAV, 365),
      '3Y': this.getAnnualizedReturn(sortedData, currentNAV, 3 * 365),
      '5Y': this.getAnnualizedReturn(sortedData, currentNAV, 5 * 365)
    };

    return returns;
  }

  /**
   * Get return for a specific period
   */
  private getReturnForPeriod(
    data: Array<{date: string, nav: string}>, 
    currentNAV: number, 
    days: number
  ): number | null {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);

    // Find the closest NAV data to the target date
    let closestData = null;
    let minDiff = Infinity;

    for (const record of data) {
      const recordDate = new Date(record.date);
      const diff = Math.abs(recordDate.getTime() - targetDate.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestData = record;
      }
    }

    if (!closestData) return null;

    const pastNAV = parseFloat(closestData.nav);
    return ((currentNAV - pastNAV) / pastNAV) * 100;
  }

  /**
   * Get annualized return for multi-year periods
   */
  private getAnnualizedReturn(
    data: Array<{date: string, nav: string}>, 
    currentNAV: number, 
    days: number
  ): number | null {
    const simpleReturn = this.getReturnForPeriod(data, currentNAV, days);
    if (simpleReturn === null) return null;
    
    const years = days / 365;
    return (Math.pow(1 + simpleReturn / 100, 1 / years) - 1) * 100;
  }

  /**
   * Calculate risk metrics (volatility, max drawdown)
   */
  private calculateRiskMetrics(
    historicalData: Array<{date: string, nav: string}>
  ): { volatility: number | null; maxDrawdown: number | null } {
    if (!historicalData || historicalData.length < 30) {
      return { volatility: null, maxDrawdown: null };
    }

    // Calculate daily returns
    const sortedData = historicalData.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const dailyReturns: number[] = [];
    for (let i = 1; i < sortedData.length; i++) {
      const prevNAV = parseFloat(sortedData[i - 1].nav);
      const currentNAV = parseFloat(sortedData[i].nav);
      const dailyReturn = (currentNAV - prevNAV) / prevNAV;
      dailyReturns.push(dailyReturn);
    }

    // Calculate volatility (annualized standard deviation)
    const mean = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / dailyReturns.length;
    const volatility = Math.sqrt(variance * 252) * 100; // Annualized

    // Calculate max drawdown
    const navValues = sortedData.map(d => parseFloat(d.nav));
    let maxDrawdown = 0;
    let peak = navValues[0];

    for (const nav of navValues) {
      if (nav > peak) {
        peak = nav;
      } else {
        const drawdown = (peak - nav) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return {
      volatility: volatility,
      maxDrawdown: maxDrawdown * 100
    };
  }

  /**
   * Calculate performance metrics (Sharpe ratio, alpha, beta)
   */
  private calculatePerformanceMetrics(
    historicalData: Array<{date: string, nav: string}>,
    returns: FundMetrics['returns']
  ): { sharpeRatio: number | null; alpha: number | null; beta: number | null } {
    // Simplified implementation - would need risk-free rate and benchmark data for accurate calculation
    const riskFreeRate = 6.5; // Approximate risk-free rate for India (10-year G-Sec)
    
    let sharpeRatio = null;
    if (returns['1Y'] !== null) {
      const riskMetrics = this.calculateRiskMetrics(historicalData);
      if (riskMetrics.volatility !== null) {
        sharpeRatio = (returns['1Y'] - riskFreeRate) / riskMetrics.volatility;
      }
    }

    // Alpha and Beta would require benchmark comparison - simplified for now
    const alpha = null;
    const beta = null;

    return { sharpeRatio, alpha, beta };
  }

  /**
   * Determine the best performing fund across different metrics
   */
  private determineBestPerformer(funds: FundMetrics[]): ComparisonResult['bestPerformer'] {
    const bestReturns = funds.reduce((best, fund) => 
      (fund.returns['1Y'] || 0) > (best.returns['1Y'] || 0) ? fund : best
    );

    const bestRiskAdjusted = funds.reduce((best, fund) => 
      (fund.sharpeRatio || 0) > (best.sharpeRatio || 0) ? fund : best
    );

    const bestExpense = funds.reduce((best, fund) => 
      (fund.expenseRatio || Infinity) < (best.expenseRatio || Infinity) ? fund : best
    );

    return {
      returns: bestReturns.schemeCode,
      riskAdjusted: bestRiskAdjusted.schemeCode,
      expense: bestExpense.schemeCode
    };
  }

  /**
   * Calculate summary metrics across all funds
   */
  private calculateSummaryMetrics(funds: FundMetrics[]): ComparisonResult['summary'] {
    const validReturns1Y = funds.map(f => f.returns['1Y']).filter(r => r !== null) as number[];
    const validVolatility = funds.map(f => f.volatility).filter(v => v !== null) as number[];
    const validExpense = funds.map(f => f.expenseRatio).filter(e => e !== null) as number[];

    const averageReturns = {
      '1Y': validReturns1Y.length > 0 ? validReturns1Y.reduce((sum, r) => sum + r, 0) / validReturns1Y.length : 0
    };

    const riskRange = validVolatility.length > 0 ? {
      min: Math.min(...validVolatility),
      max: Math.max(...validVolatility)
    } : { min: 0, max: 0 };

    const expenseRange = validExpense.length > 0 ? {
      min: Math.min(...validExpense),
      max: Math.max(...validExpense)
    } : { min: 0, max: 0 };

    return { averageReturns, riskRange, expenseRange };
  }

  /**
   * Generate AI-powered recommendation
   */
  private generateRecommendation(funds: FundMetrics[], bestPerformer: ComparisonResult['bestPerformer']): string {
    const fundCount = funds.length;
    const avgReturn = funds.reduce((sum, f) => sum + (f.returns['1Y'] || 0), 0) / fundCount;
    const avgExpense = funds.reduce((sum, f) => sum + (f.expenseRatio || 0), 0) / fundCount;

    let recommendation = `Comparison of ${fundCount} funds shows: `;

    if (avgReturn > 15) {
      recommendation += "Strong performance with above-average returns. ";
    } else if (avgReturn > 10) {
      recommendation += "Moderate performance with decent returns. ";
    } else {
      recommendation += "Below-average performance requires careful consideration. ";
    }

    if (avgExpense < 1.0) {
      recommendation += "Low expense ratios make these cost-efficient choices. ";
    } else if (avgExpense < 2.0) {
      recommendation += "Moderate expense ratios are acceptable for the category. ";
    } else {
      recommendation += "High expense ratios may impact long-term returns. ";
    }

    recommendation += `Best performer by returns: Fund ${bestPerformer.returns}. Consider your risk tolerance and investment horizon when choosing.`;

    return recommendation;
  }

  /**
   * Assess overall risk level of the fund portfolio
   */
  private assessOverallRisk(funds: FundMetrics[]): 'low' | 'medium' | 'high' {
    const avgVolatility = funds.reduce((sum, f) => sum + (f.volatility || 0), 0) / funds.length;
    
    if (avgVolatility < 15) return 'low';
    if (avgVolatility < 25) return 'medium';
    return 'high';
  }
}

// Create and export a singleton instance
export const fundComparisonService = new FundComparisonService();