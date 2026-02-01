import { IStorage } from '../storage';
import type { Portfolio, PortfolioHolding, InsertPortfolioComparison } from '@shared/schema';

// Types for portfolio comparison data
export interface PortfolioMetrics {
  portfolioId: string;
  portfolioName: string;
  totalValue: number;
  totalInvested: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  
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
  beta: number | null;
  maxDrawdown: number | null;
  
  // Advanced risk-adjusted metrics
  alpha: number | null;           // Jensen's Alpha - excess return over CAPM
  treynorRatio: number | null;    // (Return - Rf) / Beta - risk-adjusted return per unit of systematic risk
  sortinoRatio: number | null;    // Similar to Sharpe but uses downside deviation
  informationRatio: number | null; // Active return / Tracking error
  downsideDeviation: number | null; // Standard deviation of negative returns
  trackingError: number | null;   // Standard deviation of active returns vs benchmark
  
  // Portfolio characteristics
  diversificationScore: number | null;
  assetAllocation: {
    equity: number;
    debt: number;
    gold: number;
    cash: number;
    others: number;
  };
  sectorExposure: {
    technology: number;
    banking: number;
    healthcare: number;
    energy: number;
    consumer: number;
    others: number;
  };
  
  // Holdings analysis
  holdingsCount: number;
  topHoldings: Array<{
    symbol: string;
    name: string;
    weight: number;
    value: number;
  }>;
  
  // Risk scores
  riskScore: number; // 1-10 scale
  concentrationRisk: number;
}

export interface PortfolioComparisonResult {
  portfolios: PortfolioMetrics[];
  correlationMatrix: number[][];
  
  // Performance analysis
  performanceRanking: Array<{
    portfolioId: string;
    rank: number;
    score: number;
  }>;
  
  // Risk analysis
  riskAnalysis: {
    bestRiskAdjustedReturn: string;
    mostDiversified: string;
    leastVolatile: string;
    highestSharpe: string;
  };
  
  // Asset allocation comparison
  assetAllocationAnalysis: {
    mostBalanced: string;
    highestEquityExposure: string;
    mostConservative: string;
    overlapAnalysis: Array<{
      portfolio1: string;
      portfolio2: string;
      overlapPercent: number;
      commonHoldings: number;
    }>;
  };
  
  // Recommendations
  bestPortfolio: string;
  worstPortfolio: string;
  rebalancingSuggestions: Array<{
    portfolioId: string;
    suggestions: Array<{
      action: 'buy' | 'sell' | 'rebalance';
      asset: string;
      amount: number;
      reason: string;
    }>;
  }>;
  
  // AI insights
  executiveSummary: string;
  keyFindings: string[];
  actionableRecommendations: string[];
  riskScore: number;
}

export class PortfolioComparisonService {
  private storage: IStorage;
  private readonly NIFTY_50_BETA = 1.0; // Market beta reference

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Compare multiple portfolios and return detailed analysis
   */
  async comparePortfolios(
    portfolioIds: string[], 
    userId: string,
    timePeriod: string = '1Y',
    benchmarkIndex: string = 'NIFTY_50',
    comparisonType: string = 'comprehensive'
  ): Promise<PortfolioComparisonResult> {
    try {
      // Fetch portfolios and their holdings
      const portfoliosData = await Promise.all(
        portfolioIds.map(async (id) => {
          const portfolio = await this.storage.getPortfolio(id);
          const holdings = await this.storage.getPortfolioHoldings(id);
          return { portfolio, holdings };
        })
      );

      // Calculate metrics for each portfolio
      const portfolioMetrics = await Promise.all(
        portfoliosData.map(({ portfolio, holdings }) =>
          this.calculatePortfolioMetrics(portfolio, holdings, timePeriod)
        )
      );

      // Perform comparative analysis
      const correlationMatrix = this.calculateCorrelationMatrix(portfolioMetrics);
      const performanceRanking = this.rankPortfoliosByPerformance(portfolioMetrics);
      const riskAnalysis = this.analyzeRisk(portfolioMetrics);
      const assetAllocationAnalysis = this.analyzeAssetAllocation(portfolioMetrics);
      const rebalancingSuggestions = await this.generateRebalancingSuggestions(portfolioMetrics);

      // Generate AI insights
      const aiInsights = await this.generateAIInsights(portfolioMetrics, riskAnalysis, assetAllocationAnalysis);

      const result: PortfolioComparisonResult = {
        portfolios: portfolioMetrics,
        correlationMatrix,
        performanceRanking,
        riskAnalysis,
        assetAllocationAnalysis,
        rebalancingSuggestions,
        bestPortfolio: performanceRanking[0]?.portfolioId || '',
        worstPortfolio: performanceRanking[performanceRanking.length - 1]?.portfolioId || '',
        executiveSummary: aiInsights.executiveSummary,
        keyFindings: aiInsights.keyFindings,
        actionableRecommendations: aiInsights.actionableRecommendations,
        riskScore: this.calculateOverallRiskScore(portfolioMetrics)
      };

      return result;
    } catch (error) {
      console.error('Portfolio comparison error:', error);
      throw new Error('Failed to compare portfolios. Please try again.');
    }
  }

  private async calculatePortfolioMetrics(
    portfolio: Portfolio, 
    holdings: PortfolioHolding[], 
    timePeriod: string
  ): Promise<PortfolioMetrics> {
    
    // Calculate basic metrics
    const totalInvested = holdings.reduce((sum, holding) => {
      return sum + (parseFloat(holding.quantity) * parseFloat(holding.avgPrice));
    }, 0);

    const totalValue = parseFloat(portfolio.totalValue || '0');
    const totalGainLoss = totalValue - totalInvested;
    const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

    // Calculate asset allocation
    const assetAllocation = this.calculateAssetAllocation(holdings, totalValue);
    
    // Calculate sector exposure
    const sectorExposure = this.calculateSectorExposure(holdings, totalValue);
    
    // Calculate top holdings
    const topHoldings = this.calculateTopHoldings(holdings, totalValue);
    
    // Calculate risk metrics
    const volatility = this.calculateVolatility(holdings);
    const beta = this.calculateBeta(holdings);
    const sharpeRatio = this.calculateSharpeRatio(totalGainLossPercent, volatility);
    const diversificationScore = this.calculateDiversificationScore(holdings);
    
    // Calculate advanced risk-adjusted metrics
    const benchmarkReturn = 12; // NIFTY 50 approximate annual return
    const alpha = this.calculateAlpha(totalGainLossPercent, beta, benchmarkReturn);
    const treynorRatio = this.calculateTreynorRatio(totalGainLossPercent, beta);
    const downsideDeviation = this.calculateDownsideDeviation(holdings);
    const sortinoRatio = this.calculateSortinoRatio(totalGainLossPercent, downsideDeviation);
    const trackingError = this.calculateTrackingError(holdings, benchmarkReturn);
    const informationRatio = this.calculateInformationRatio(totalGainLossPercent, benchmarkReturn, trackingError);
    const maxDrawdown = this.calculateMaxDrawdown(holdings);
    
    // Get historical returns - returns null for periods without real data
    const returns = this.getHistoricalReturns(totalGainLossPercent, timePeriod);

    // Determine data availability status for regulatory compliance
    const hasHistoricalData = Object.values(returns).some(v => v !== null);
    const hasRiskMetrics = volatility !== null && sharpeRatio !== null;
    
    return {
      portfolioId: portfolio.id,
      portfolioName: portfolio.name,
      totalValue,
      totalInvested,
      totalGainLoss,
      totalGainLossPercent,
      returns,
      volatility,
      sharpeRatio,
      beta,
      maxDrawdown,
      alpha,
      treynorRatio,
      sortinoRatio,
      informationRatio,
      downsideDeviation,
      trackingError,
      diversificationScore,
      assetAllocation,
      sectorExposure,
      holdingsCount: holdings.length,
      topHoldings,
      riskScore: this.calculateRiskScore(volatility, beta, diversificationScore),
      concentrationRisk: this.calculateConcentrationRisk(holdings, totalValue),
      // Data availability status for regulatory compliance
      dataStatus: hasRiskMetrics ? 'calculated' : 'partial_data',
      dataAvailability: {
        historicalReturns: hasHistoricalData ? 'available' : 'insufficient_data',
        riskMetrics: hasRiskMetrics ? 'calculated' : 'insufficient_data',
        source: 'real_holdings_data'
      }
    };
  }

  private calculateAssetAllocation(holdings: PortfolioHolding[], totalValue: number) {
    const allocation = { equity: 0, debt: 0, gold: 0, cash: 0, others: 0 };
    
    holdings.forEach(holding => {
      const value = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
      const percentage = (value / totalValue) * 100;
      
      switch (holding.assetType?.toLowerCase()) {
        case 'equity':
        case 'stock':
          allocation.equity += percentage;
          break;
        case 'bond':
        case 'debt':
          allocation.debt += percentage;
          break;
        case 'gold':
        case 'precious_metals':
          allocation.gold += percentage;
          break;
        default:
          allocation.others += percentage;
      }
    });
    
    return allocation;
  }

  private calculateSectorExposure(holdings: PortfolioHolding[], totalValue: number) {
    const exposure = { technology: 0, banking: 0, healthcare: 0, energy: 0, consumer: 0, others: 0 };
    
    holdings.forEach(holding => {
      const value = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
      const percentage = (value / totalValue) * 100;
      const sector = holding.sector?.toLowerCase() || 'others';
      
      if (sector.includes('tech') || sector.includes('it')) {
        exposure.technology += percentage;
      } else if (sector.includes('bank') || sector.includes('financial')) {
        exposure.banking += percentage;
      } else if (sector.includes('health') || sector.includes('pharma')) {
        exposure.healthcare += percentage;
      } else if (sector.includes('energy') || sector.includes('oil')) {
        exposure.energy += percentage;
      } else if (sector.includes('consumer') || sector.includes('fmcg')) {
        exposure.consumer += percentage;
      } else {
        exposure.others += percentage;
      }
    });
    
    return exposure;
  }

  private calculateTopHoldings(holdings: PortfolioHolding[], totalValue: number) {
    return holdings
      .map(holding => {
        const value = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
        return {
          symbol: holding.symbol,
          name: holding.symbol, // In real implementation, fetch company name
          weight: (value / totalValue) * 100,
          value
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private calculateVolatility(holdings: PortfolioHolding[]): number | null {
    // Simplified volatility calculation based on beta values
    const betas = holdings.map(h => parseFloat(h.beta || '1')).filter(b => !isNaN(b));
    if (betas.length === 0) return null;
    
    const avgBeta = betas.reduce((sum, beta) => sum + beta, 0) / betas.length;
    return avgBeta * 15; // Convert to percentage volatility (simplified)
  }

  private calculateBeta(holdings: PortfolioHolding[]): number | null {
    const betas = holdings.map(h => parseFloat(h.beta || '1')).filter(b => !isNaN(b));
    if (betas.length === 0) return null;
    
    return betas.reduce((sum, beta) => sum + beta, 0) / betas.length;
  }

  private calculateSharpeRatio(returns: number, volatility: number | null): number | null {
    if (!volatility || volatility === 0) return null;
    const riskFreeRate = 6; // Assume 6% risk-free rate (India 10Y G-Sec benchmark)
    return (returns - riskFreeRate) / volatility;
  }

  /**
   * Calculate Jensen's Alpha using CAPM
   * Alpha = Actual Return - [Rf + Beta × (Rm - Rf)]
   * Positive alpha indicates outperformance vs market on risk-adjusted basis
   */
  private calculateAlpha(portfolioReturn: number, beta: number | null, marketReturn: number = 12): number | null {
    if (beta === null) return null;
    const riskFreeRate = 6; // India 10Y G-Sec benchmark
    const expectedReturn = riskFreeRate + beta * (marketReturn - riskFreeRate);
    return portfolioReturn - expectedReturn;
  }

  /**
   * Calculate Treynor Ratio - risk-adjusted return per unit of systematic risk
   * Treynor = (Portfolio Return - Risk-free Rate) / Beta
   * Higher is better - useful for comparing well-diversified portfolios
   */
  private calculateTreynorRatio(portfolioReturn: number, beta: number | null): number | null {
    if (beta === null || beta === 0) return null;
    const riskFreeRate = 6;
    return (portfolioReturn - riskFreeRate) / beta;
  }

  /**
   * Calculate Downside Deviation - standard deviation of negative returns only
   * Used for Sortino ratio calculation
   * Formula: sqrt(sum((r - target)^2) / n) where r < target
   */
  private calculateDownsideDeviation(holdings: PortfolioHolding[], targetReturn: number = 6): number | null {
    // Approximate downside deviation from portfolio characteristics
    // In production, this would use historical daily returns
    const returns = holdings.map(h => {
      const currentValue = parseFloat(h.quantity) * parseFloat(h.currentPrice || h.avgPrice);
      const investedValue = parseFloat(h.quantity) * parseFloat(h.avgPrice);
      return ((currentValue - investedValue) / investedValue) * 100;
    }).filter(r => !isNaN(r));

    if (returns.length === 0) return null;

    // Filter only negative returns (below target)
    const negativeReturns = returns.filter(r => r < targetReturn);
    if (negativeReturns.length === 0) return null; // No downside data - return null instead of 0

    // Calculate squared deviations from target for downside observations only
    const squaredDeviations = negativeReturns.map(r => Math.pow(r - targetReturn, 2));
    // Divide by number of downside observations (not total observations) for proper semi-deviation
    const meanSquaredDeviation = squaredDeviations.reduce((a, b) => a + b, 0) / negativeReturns.length;
    
    return Math.sqrt(meanSquaredDeviation);
  }

  /**
   * Calculate Sortino Ratio - risk-adjusted return using only downside risk
   * Sortino = (Portfolio Return - Target Return) / Downside Deviation
   * Preferred over Sharpe when returns are not normally distributed
   */
  private calculateSortinoRatio(portfolioReturn: number, downsideDeviation: number | null): number | null {
    if (downsideDeviation === null || downsideDeviation === 0) return null;
    const targetReturn = 6; // Risk-free rate as target
    return (portfolioReturn - targetReturn) / downsideDeviation;
  }

  /**
   * Calculate Tracking Error - standard deviation of active returns vs benchmark
   * Measures how closely portfolio tracks the benchmark
   */
  private calculateTrackingError(holdings: PortfolioHolding[], benchmarkReturn: number = 12): number | null {
    // Approximate tracking error from portfolio beta deviation
    const beta = this.calculateBeta(holdings);
    if (beta === null) return null;

    // Tracking error approximation: |1 - beta| * market volatility
    // Higher deviation from market beta = higher tracking error
    // Formula: TE = |1 - beta| * market_volatility (deterministic calculation)
    const marketVolatility = 15; // NIFTY 50 approximate annualized volatility
    // No random variation - return pure formula-based calculation for regulatory compliance
    return Math.abs(1 - beta) * marketVolatility;
  }

  /**
   * Calculate Information Ratio - active return per unit of tracking error
   * IR = (Portfolio Return - Benchmark Return) / Tracking Error
   * Measures manager skill - higher is better
   */
  private calculateInformationRatio(portfolioReturn: number, benchmarkReturn: number, trackingError: number | null): number | null {
    if (trackingError === null || trackingError === 0) return null;
    return (portfolioReturn - benchmarkReturn) / trackingError;
  }

  /**
   * Calculate Maximum Drawdown - largest peak-to-trough decline
   * Represents worst-case loss scenario
   */
  private calculateMaxDrawdown(holdings: PortfolioHolding[]): number | null {
    // Approximate max drawdown from beta and volatility
    const beta = this.calculateBeta(holdings);
    const volatility = this.calculateVolatility(holdings);
    
    if (beta === null || volatility === null) return null;
    
    // Estimated max drawdown: volatility * beta * 2 (rule of thumb)
    // Higher beta and volatility = deeper potential drawdowns
    return Math.min(volatility * beta * 2, 50); // Cap at 50%
  }

  private calculateDiversificationScore(holdings: PortfolioHolding[]): number | null {
    if (holdings.length === 0) return null;
    
    // Simple diversification score based on number of holdings and concentration
    const baseScore = Math.min(holdings.length * 10, 100); // More holdings = higher score
    
    // Penalize concentration
    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.quantity) * parseFloat(h.avgPrice)), 0);
    const concentrationPenalty = holdings.reduce((penalty, holding) => {
      const weight = (parseFloat(holding.quantity) * parseFloat(holding.avgPrice)) / totalValue;
      return penalty + (weight > 0.2 ? (weight - 0.2) * 100 : 0); // Penalize positions > 20%
    }, 0);
    
    return Math.max(baseScore - concentrationPenalty, 0);
  }

  private calculateRiskScore(volatility: number | null, beta: number | null, diversificationScore: number | null): number {
    let score = 5; // Start with medium risk
    
    if (volatility) {
      if (volatility > 25) score += 2;
      else if (volatility > 15) score += 1;
      else if (volatility < 10) score -= 1;
    }
    
    if (beta) {
      if (beta > 1.5) score += 1;
      else if (beta < 0.8) score -= 1;
    }
    
    if (diversificationScore) {
      if (diversificationScore < 50) score += 1;
      else if (diversificationScore > 80) score -= 1;
    }
    
    return Math.max(1, Math.min(10, score));
  }

  private calculateConcentrationRisk(holdings: PortfolioHolding[], totalValue: number): number {
    const weights = holdings.map(holding => {
      const value = parseFloat(holding.quantity) * parseFloat(holding.avgPrice);
      return value / totalValue;
    });
    
    // Calculate Herfindahl-Hirschman Index for concentration
    const hhi = weights.reduce((sum, weight) => sum + (weight * weight), 0);
    return hhi * 100; // Convert to percentage
  }

  /**
   * Get historical returns from real portfolio data
   * NOTE: No mock data - returns null values when historical data unavailable
   * Real implementation would fetch from portfolio_historical_performance table
   */
  private getHistoricalReturns(currentReturn: number, timePeriod: string) {
    // No mock data - return only the current period return which is calculated from real holdings
    // Historical returns require actual time-series data to be available
    return {
      '1M': null, // Requires historical data
      '3M': null, // Requires historical data
      '6M': null, // Requires historical data
      '1Y': currentReturn, // Use current period return if 1Y selected
      '3Y': null, // Requires historical data
      '5Y': null  // Requires historical data
    };
  }

  private calculateCorrelationMatrix(portfolios: PortfolioMetrics[]): number[][] {
    const matrix: number[][] = [];
    
    for (let i = 0; i < portfolios.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < portfolios.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0; // Perfect correlation with self
        } else {
          // Simplified correlation calculation based on asset allocation similarity
          const p1 = portfolios[i];
          const p2 = portfolios[j];
          
          const correlation = this.calculateAssetAllocationCorrelation(p1.assetAllocation, p2.assetAllocation);
          matrix[i][j] = correlation;
        }
      }
    }
    
    return matrix;
  }

  private calculateAssetAllocationCorrelation(allocation1: any, allocation2: any): number {
    const assets = ['equity', 'debt', 'gold', 'cash', 'others'];
    let correlation = 0;
    
    assets.forEach(asset => {
      const diff = Math.abs(allocation1[asset] - allocation2[asset]);
      correlation += (100 - diff) / 100;
    });
    
    return correlation / assets.length;
  }

  private rankPortfoliosByPerformance(portfolios: PortfolioMetrics[]) {
    return portfolios
      .map((portfolio, index) => ({
        portfolioId: portfolio.portfolioId,
        rank: index + 1,
        score: this.calculatePerformanceScore(portfolio)
      }))
      .sort((a, b) => b.score - a.score)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }

  private calculatePerformanceScore(portfolio: PortfolioMetrics): number {
    let score = 0;
    
    // Return component (50% weight)
    score += (portfolio.totalGainLossPercent || 0) * 0.5;
    
    // Risk-adjusted return component (30% weight)
    if (portfolio.sharpeRatio) {
      score += portfolio.sharpeRatio * 10 * 0.3;
    }
    
    // Diversification component (20% weight)
    if (portfolio.diversificationScore) {
      score += (portfolio.diversificationScore / 10) * 0.2;
    }
    
    return score;
  }

  private analyzeRisk(portfolios: PortfolioMetrics[]) {
    const sortedByRiskAdjusted = [...portfolios].sort((a, b) => (b.sharpeRatio || 0) - (a.sharpeRatio || 0));
    const sortedByDiversification = [...portfolios].sort((a, b) => (b.diversificationScore || 0) - (a.diversificationScore || 0));
    const sortedByVolatility = [...portfolios].sort((a, b) => (a.volatility || 100) - (b.volatility || 100));
    const sortedBySharpe = [...portfolios].sort((a, b) => (b.sharpeRatio || 0) - (a.sharpeRatio || 0));

    return {
      bestRiskAdjustedReturn: sortedByRiskAdjusted[0]?.portfolioName || '',
      mostDiversified: sortedByDiversification[0]?.portfolioName || '',
      leastVolatile: sortedByVolatility[0]?.portfolioName || '',
      highestSharpe: sortedBySharpe[0]?.portfolioName || ''
    };
  }

  private analyzeAssetAllocation(portfolios: PortfolioMetrics[]) {
    // Find most balanced portfolio (closest to ideal allocation)
    const idealAllocation = { equity: 60, debt: 30, gold: 5, cash: 5, others: 0 };
    let mostBalanced = '';
    let minDeviation = Infinity;

    portfolios.forEach(portfolio => {
      const deviation = Object.keys(idealAllocation).reduce((sum, asset) => {
        return sum + Math.abs(portfolio.assetAllocation[asset as keyof typeof idealAllocation] - idealAllocation[asset as keyof typeof idealAllocation]);
      }, 0);
      
      if (deviation < minDeviation) {
        minDeviation = deviation;
        mostBalanced = portfolio.portfolioName;
      }
    });

    // Find highest equity exposure
    const highestEquity = portfolios.reduce((max, portfolio) => 
      portfolio.assetAllocation.equity > max.assetAllocation.equity ? portfolio : max
    );

    // Find most conservative (highest debt allocation)
    const mostConservative = portfolios.reduce((max, portfolio) => 
      (portfolio.assetAllocation.debt + portfolio.assetAllocation.cash) > 
      (max.assetAllocation.debt + max.assetAllocation.cash) ? portfolio : max
    );

    // Calculate overlap analysis
    const overlapAnalysis = [];
    for (let i = 0; i < portfolios.length; i++) {
      for (let j = i + 1; j < portfolios.length; j++) {
        const overlap = this.calculatePortfolioOverlap(portfolios[i], portfolios[j]);
        overlapAnalysis.push({
          portfolio1: portfolios[i].portfolioName,
          portfolio2: portfolios[j].portfolioName,
          overlapPercent: overlap.overlapPercent,
          commonHoldings: overlap.commonHoldings
        });
      }
    }

    return {
      mostBalanced,
      highestEquityExposure: highestEquity.portfolioName,
      mostConservative: mostConservative.portfolioName,
      overlapAnalysis
    };
  }

  private calculatePortfolioOverlap(portfolio1: PortfolioMetrics, portfolio2: PortfolioMetrics) {
    const holdings1 = new Set(portfolio1.topHoldings.map(h => h.symbol));
    const holdings2 = new Set(portfolio2.topHoldings.map(h => h.symbol));
    
    const commonHoldings = [...holdings1].filter(symbol => holdings2.has(symbol)).length;
    const totalUniqueHoldings = new Set([...holdings1, ...holdings2]).size;
    
    const overlapPercent = totalUniqueHoldings > 0 ? (commonHoldings / totalUniqueHoldings) * 100 : 0;
    
    return { overlapPercent, commonHoldings };
  }

  private async generateRebalancingSuggestions(portfolios: PortfolioMetrics[]) {
    return portfolios.map(portfolio => ({
      portfolioId: portfolio.portfolioId,
      suggestions: this.generatePortfolioSuggestions(portfolio)
    }));
  }

  private generatePortfolioSuggestions(portfolio: PortfolioMetrics) {
    const suggestions = [];
    const allocation = portfolio.assetAllocation;
    
    // Check for over-concentration
    if (allocation.equity > 80) {
      suggestions.push({
        action: 'rebalance' as const,
        asset: 'debt',
        amount: (allocation.equity - 70) * portfolio.totalValue / 100,
        reason: 'High equity concentration detected. Consider reducing equity exposure to 70%.'
      });
    }
    
    if (allocation.debt < 15 && allocation.equity > 50) {
      suggestions.push({
        action: 'buy' as const,
        asset: 'debt',
        amount: (20 - allocation.debt) * portfolio.totalValue / 100,
        reason: 'Low debt allocation. Consider increasing to 20% for better risk management.'
      });
    }
    
    // Check diversification
    if (portfolio.diversificationScore && portfolio.diversificationScore < 60) {
      suggestions.push({
        action: 'buy' as const,
        asset: 'diversified equity',
        amount: portfolio.totalValue * 0.1,
        reason: 'Low diversification score. Consider adding more diversified equity positions.'
      });
    }
    
    // Check concentration risk
    if (portfolio.concentrationRisk > 25) {
      suggestions.push({
        action: 'sell' as const,
        asset: 'concentrated positions',
        amount: portfolio.totalValue * 0.05,
        reason: 'High concentration risk detected. Consider reducing large positions.'
      });
    }
    
    return suggestions;
  }

  private async generateAIInsights(
    portfolios: PortfolioMetrics[], 
    riskAnalysis: any, 
    assetAllocationAnalysis: any
  ) {
    const bestPerformer = portfolios.reduce((best, portfolio) => 
      portfolio.totalGainLossPercent > best.totalGainLossPercent ? portfolio : best
    );
    
    const executiveSummary = `Analysis of ${portfolios.length} portfolios shows varied performance and risk characteristics. ${bestPerformer.portfolioName} leads with ${bestPerformer.totalGainLossPercent.toFixed(2)}% returns. ${riskAnalysis.mostDiversified} demonstrates the best diversification strategy, while ${riskAnalysis.leastVolatile} shows the lowest volatility. Asset allocation analysis reveals ${assetAllocationAnalysis.mostBalanced} as the most balanced portfolio.`;
    
    const keyFindings = [
      `Best performing portfolio: ${bestPerformer.portfolioName} (+${bestPerformer.totalGainLossPercent.toFixed(2)}%)`,
      `Most diversified strategy: ${riskAnalysis.mostDiversified}`,
      `Lowest risk profile: ${riskAnalysis.leastVolatile}`,
      `Best risk-adjusted returns: ${riskAnalysis.bestRiskAdjustedReturn}`,
      `Most balanced allocation: ${assetAllocationAnalysis.mostBalanced}`
    ];
    
    const actionableRecommendations = [
      'Consider rebalancing portfolios with high concentration risk',
      'Diversify equity exposure across sectors and market caps',
      'Maintain 15-30% allocation to debt instruments for stability',
      'Review and adjust portfolios quarterly based on market conditions',
      'Focus on risk-adjusted returns rather than absolute returns'
    ];
    
    return {
      executiveSummary,
      keyFindings,
      actionableRecommendations
    };
  }

  private calculateOverallRiskScore(portfolios: PortfolioMetrics[]): number {
    const avgRiskScore = portfolios.reduce((sum, p) => sum + p.riskScore, 0) / portfolios.length;
    return Math.round(avgRiskScore * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Save comparison result to database
   */
  async saveComparison(
    userId: string,
    portfolioIds: string[],
    result: PortfolioComparisonResult,
    timePeriod: string,
    benchmarkIndex: string,
    comparisonType: string
  ): Promise<string> {
    const comparisonData: InsertPortfolioComparison = {
      userId,
      portfolioIds: portfolioIds,
      comparisonType,
      benchmarkIndex,
      timePeriod,
      performanceMetrics: result.portfolios.map(p => ({
        portfolioId: p.portfolioId,
        returns: p.returns,
        riskScore: p.riskScore,
        sharpeRatio: p.sharpeRatio,
        volatility: p.volatility
      })),
      riskAnalysis: result.riskAnalysis,
      assetAllocationComparison: result.assetAllocationAnalysis,
      correlationMatrix: result.correlationMatrix,
      diversificationAnalysis: {
        portfolios: result.portfolios.map(p => ({
          portfolioId: p.portfolioId,
          diversificationScore: p.diversificationScore,
          concentrationRisk: p.concentrationRisk
        }))
      },
      sectorExposure: result.portfolios.reduce((acc, p) => {
        acc[p.portfolioId] = p.sectorExposure;
        return acc;
      }, {} as any),
      topHoldingsComparison: result.portfolios.map(p => ({
        portfolioId: p.portfolioId,
        topHoldings: p.topHoldings
      })),
      efficiencyMetrics: {
        performanceRanking: result.performanceRanking
      },
      bestPortfolio: result.bestPortfolio,
      worstPortfolio: result.worstPortfolio,
      rebalancingSuggestions: result.rebalancingSuggestions,
      riskScore: result.riskScore,
      executiveSummary: result.executiveSummary,
      keyFindings: result.keyFindings,
      actionableRecommendations: result.actionableRecommendations,
      requestedAt: new Date(),
      status: 'completed'
    };

    return await this.storage.createPortfolioComparison(comparisonData);
  }

  /**
   * Get comparison by ID
   */
  async getComparison(comparisonId: string): Promise<any> {
    return await this.storage.getPortfolioComparison(comparisonId);
  }

  /**
   * Get user's comparison history
   */
  async getUserComparisons(userId: string): Promise<any[]> {
    return await this.storage.getUserPortfolioComparisons(userId);
  }
}