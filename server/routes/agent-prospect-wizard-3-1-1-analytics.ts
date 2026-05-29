type NormalizedHolding = any;
import { schemeGovernanceService } from "../services/scheme-governance-service";
import { portfolioAnalyticsDataService } from "../services/portfolio-analytics-data-service";
import { isSipRestricted } from "../services/agent-prospect-wizard-service";

export function calculateCapitalGains(holdings: NormalizedHolding[]) {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const grandfatherDate = new Date('2018-01-31');
  
  let stcg = { count: 0, totalValue: 0, taxableGain: 0, estimatedTax: 0 };
  let ltcg = { count: 0, totalValue: 0, taxableGain: 0, estimatedTax: 0, exemptionUsed: 0 };
  let grandfathered = { count: 0, benefit: 0 };
  
  const holdingsWithTax: any[] = [];
  
  for (const h of holdings) {
    const purchaseDate = h.purchaseDate ? new Date(h.purchaseDate) : oneYearAgo;
    const holdingPeriodDays = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const isLongTerm = holdingPeriodDays >= 365;
    const purchaseValue = h.investedValue || (h.quantity * h.averagePrice);
    const currentValue = h.currentValue || 0;
    const gain = currentValue - purchaseValue;
    
    const isGrandfathered = purchaseDate <= grandfatherDate && isLongTerm;
    let taxableGain = gain;
    let grandfatherBenefit = 0;
    
    if (isGrandfathered && gain > 0) {
      const grandfatherMultiplier = 1.15;
      const adjustedCost = purchaseValue * grandfatherMultiplier;
      grandfatherBenefit = Math.min(gain, adjustedCost - purchaseValue);
      taxableGain = Math.max(0, gain - grandfatherBenefit);
      grandfathered.count++;
      grandfathered.benefit += grandfatherBenefit;
    }
    
    let estimatedTax = 0;
    if (isLongTerm) {
      ltcg.count++;
      ltcg.totalValue += currentValue;
      ltcg.taxableGain += Math.max(0, taxableGain);
      estimatedTax = Math.max(0, taxableGain) * 0.125;
      ltcg.estimatedTax += estimatedTax;
    } else {
      stcg.count++;
      stcg.totalValue += currentValue;
      stcg.taxableGain += Math.max(0, gain);
      estimatedTax = Math.max(0, gain) * 0.20;
      stcg.estimatedTax += estimatedTax;
    }
    
    holdingsWithTax.push({
      name: h.name,
      isin: h.isin,
      holdingPeriod: holdingPeriodDays,
      isLongTerm,
      purchaseValue,
      currentValue,
      gain,
      taxType: isLongTerm ? 'LTCG' : 'STCG',
      estimatedTax,
      isGrandfathered
    });
  }
  
  const ltcgExemption = 125000;
  if (ltcg.taxableGain > 0) {
    ltcg.exemptionUsed = Math.min(ltcgExemption, ltcg.taxableGain);
    ltcg.taxableGain = Math.max(0, ltcg.taxableGain - ltcgExemption);
    ltcg.estimatedTax = ltcg.taxableGain * 0.125;
  }
  
  return {
    stcg,
    ltcg,
    grandfathered,
    totalTaxLiability: stcg.estimatedTax + ltcg.estimatedTax,
    holdings: holdingsWithTax.sort((a, b) => b.gain - a.gain).slice(0, 10)
  };
}

export function calculatePortfolioHealthScore(holdings: NormalizedHolding[], riskProfile: any) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  if (totalValue === 0) return null;
  
  const assetTypes = new Map<string, number>();
  const amcs = new Map<string, number>();
  
  for (const h of holdings) {
    const assetType = h.assetType || 'mutual_fund';
    assetTypes.set(assetType, (assetTypes.get(assetType) || 0) + (h.currentValue || 0));
    const amc = h.name?.split(' ')[0] || 'Unknown';
    amcs.set(amc, (amcs.get(amc) || 0) + (h.currentValue || 0));
  }
  
  const maxAssetConcentration = Math.max(...Array.from(assetTypes.values())) / totalValue * 100;
  const diversificationScore = Math.max(0, 100 - maxAssetConcentration);
  
  const riskAlignment = riskProfile ? 80 : 60;
  
  const avgTER = holdings.reduce((sum, h) => {
    const ter = (h as any).expenseRatio || 0.5;
    return sum + ter * ((h.currentValue || 0) / totalValue);
  }, 0);
  const costEfficiency = Math.max(0, 100 - avgTER * 50);
  
  const qualityScore = 75;
  const liquidityScore = 85;
  
  const overallScore = Math.round(
    diversificationScore * 0.25 +
    riskAlignment * 0.25 +
    costEfficiency * 0.20 +
    qualityScore * 0.15 +
    liquidityScore * 0.15
  );
  
  const recommendations: string[] = [];
  if (diversificationScore < 60) recommendations.push("Consider diversifying across more asset classes");
  if (costEfficiency < 70) recommendations.push("Look for lower-cost fund alternatives to reduce expenses");
  if (amcs.size < 3) recommendations.push("Consider spreading investments across more AMCs");
  
  return {
    overallScore,
    components: {
      diversification: Math.round(diversificationScore),
      riskAlignment: Math.round(riskAlignment),
      costEfficiency: Math.round(costEfficiency),
      qualityScore,
      liquidityScore
    },
    recommendations
  };
}

export async function calculateExpenseRatioAnalysis(holdings: NormalizedHolding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  if (totalValue === 0) return null;
  
  // Helper to create stable lookup key matching the service
  const getKey = (h: NormalizedHolding) => (h as any).isin || (h as any).schemeCode || h.name || '';
  
  // Helper to check if holding is a stock/equity
  const isEquity = (h: NormalizedHolding) => h.assetType === 'equity' || h.assetType === 'stock';
  
  // Helper to check if holding is a mutual fund (strict - only MFs have expense ratios)
  const isMutualFund = (h: NormalizedHolding) => h.assetType === 'mutual_fund' || h.assetType === 'etf';
  
  // Batch fetch expense ratios for mutual funds only (not bonds, gold, FDs, etc.)
  const mfHoldings = holdings.filter(isMutualFund);
  const terMap = await portfolioAnalyticsDataService.batchGetExpenseRatios(
    mfHoldings.map(h => ({
      name: h.name || '',
      schemeCode: (h as any).schemeCode,
      isin: (h as any).isin,
    }))
  );
  
  const holdingsWithTER: any[] = [];
  let weightedTER = 0;
  let totalAnnualCost = 0;
  let dbSourceCount = 0;
  let categoryDefaultCount = 0;
  let fallbackCount = 0;
  
  for (const h of holdings) {
    const value = h.currentValue || 0;
    let ter = 0;
    let dataSource = 'fallback';
    
    if (isEquity(h) || !isMutualFund(h)) {
      // Stocks and non-MF assets (bonds, gold, FDs) don't have TER
      ter = 0;
      dataSource = 'not_applicable';
    } else {
      const key = getKey(h);
      const terLookup = terMap.get(key);
      if (terLookup) {
        ter = terLookup.value;
        dataSource = terLookup.source;
        
        if (terLookup.source === 'database') dbSourceCount++;
        else if (terLookup.source === 'category_default') categoryDefaultCount++;
        else fallbackCount++;
      }
    }
    
    const annualCost = value * (ter / 100);
    weightedTER += ter * (value / totalValue);
    totalAnnualCost += annualCost;
    
    const isRegularPlan = !h.name?.toLowerCase().includes('direct');
    
    holdingsWithTER.push({
      name: h.name,
      ter: Math.round(ter * 100) / 100,
      value,
      annualCost: Math.round(annualCost),
      dataSource,
      suggestedAlternative: (ter > 1.0 && isRegularPlan) ? {
        name: `${h.name?.split(' ')[0]} Direct Plan`,
        ter: Math.max(0.1, ter - 0.8),
        savings: Math.round(annualCost * 0.6)
      } : undefined
    });
  }
  
  const potentialSavings = holdingsWithTER
    .filter(h => h.suggestedAlternative)
    .reduce((sum, h) => sum + h.suggestedAlternative.savings, 0);
  
  return {
    weightedAvgTER: Math.round(weightedTER * 100) / 100,
    totalAnnualCost: Math.round(totalAnnualCost),
    potentialSavings: Math.round(potentialSavings),
    holdings: holdingsWithTER.sort((a, b) => b.ter - a.ter).slice(0, 10),
    dataSources: {
      database: dbSourceCount,
      categoryDefault: categoryDefaultCount,
      fallback: fallbackCount
    }
  };
}

export function isGrowthPlan(name: string): boolean {
  const nameLower = name.toLowerCase();
  const growthPatterns = [
    'growth',
    'gr option',
    'gr plan',
    '- gr',
    '-gr',
    'accumulation'
  ];
  const dividendPatterns = [
    'idcw',
    'dividend',
    'div option',
    'div plan',
    'income distribution',
    'payout'
  ];
  
  const hasGrowthIndicator = growthPatterns.some(p => nameLower.includes(p));
  const hasDividendIndicator = dividendPatterns.some(p => nameLower.includes(p));
  
  if (hasDividendIndicator) return false;
  if (hasGrowthIndicator) return true;
  
  return false;
}

export async function calculateDividendProjection(holdings: NormalizedHolding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  if (totalValue === 0) return null;
  
  // Helper to create stable lookup key matching the service
  const getStockKey = (h: NormalizedHolding) => (h as any).isin || h.name || '';
  
  // Helper to check if holding is a stock/equity
  const isEquity = (h: NormalizedHolding) => h.assetType === 'equity' || h.assetType === 'stock';
  
  // Helper to check if holding is a mutual fund/ETF (strict - no fallback for missing assetType)
  const isMutualFund = (h: NormalizedHolding) => h.assetType === 'mutual_fund' || h.assetType === 'etf';
  
  // Batch fetch stock/equity dividend yields in a single query
  const stockHoldings = holdings.filter(isEquity);
  const stockYieldMap = await portfolioAnalyticsDataService.batchGetStockDividendYields(
    stockHoldings.map(h => ({
      name: h.name || '',
      isin: (h as any).isin,
      sector: (h as any).sector,
    }))
  );
  
  const holdingsWithDividend: any[] = [];
  let totalAnnualDividend = 0;
  let growthOnlyCount = 0;
  let dbSourceCount = 0;
  let sectorDefaultCount = 0;
  let categoryDefaultCount = 0;
  let fallbackCount = 0;
  
  for (const h of holdings) {
    const value = h.currentValue || 0;
    let dividendYield = 0;
    let dataSource = 'fallback';
    const name = h.name || '';
    const nameLower = name.toLowerCase();
    
    if (isEquity(h)) {
      const key = getStockKey(h);
      const yieldLookup = stockYieldMap.get(key);
      if (yieldLookup) {
        dividendYield = yieldLookup.value;
        dataSource = yieldLookup.source;
        
        if (yieldLookup.source === 'database') dbSourceCount++;
        else if (yieldLookup.source === 'sector_default') sectorDefaultCount++;
        else fallbackCount++;
      }
    } else if (isMutualFund(h)) {
      if (isGrowthPlan(name)) {
        growthOnlyCount++;
        continue;
      }
      
      if (nameLower.includes('idcw') || nameLower.includes('dividend') || 
          nameLower.includes('payout') || nameLower.includes('income distribution')) {
        // MF dividend yields use category defaults (synchronous - no DB lookup)
        const yieldLookup = portfolioAnalyticsDataService.getMFDividendYield(
          name,
          (h as any).schemeCode,
          (h as any).category
        );
        dividendYield = yieldLookup.value;
        dataSource = yieldLookup.source;
        
        if (yieldLookup.source === 'category_default') categoryDefaultCount++;
        else fallbackCount++;
      } else {
        continue;
      }
    } else {
      continue;
    }
    
    const annualDividend = value * (dividendYield / 100);
    totalAnnualDividend += annualDividend;
    
    if (dividendYield > 0.5) {
      holdingsWithDividend.push({
        name: h.name,
        value,
        dividendYield: Math.round(dividendYield * 100) / 100,
        estimatedAnnualDividend: Math.round(annualDividend),
        dataSource
      });
    }
  }
  
  const dividendPayingValue = holdingsWithDividend.reduce((sum, h) => sum + h.value, 0);
  
  if (holdingsWithDividend.length === 0) {
    return {
      estimatedAnnualIncome: 0,
      monthlyIncome: 0,
      yieldPercent: 0,
      holdings: [],
      message: growthOnlyCount > 0 
        ? `Your portfolio has ${growthOnlyCount} Growth plan(s). Growth plans reinvest dividends and do not pay out income. Consider IDCW plans if you need regular income.`
        : 'No dividend-paying holdings found in your portfolio.',
      hasNoDividendHoldings: true,
      dataSources: { database: 0, sectorDefault: 0, categoryDefault: 0, fallback: 0 }
    };
  }
  
  const totalNonDbCount = sectorDefaultCount + categoryDefaultCount + fallbackCount;
  const totalCount = dbSourceCount + totalNonDbCount;
  const estimatedRatio = totalCount > 0 ? totalNonDbCount / totalCount : 0;
  const disclaimer = estimatedRatio > 0.5
    ? `Note: ${Math.round(estimatedRatio * 100)}% of dividend yields are estimated using sector/category averages due to limited real-time data. Actual payouts may vary significantly.`
    : estimatedRatio > 0
    ? `Note: Some dividend yields (${totalNonDbCount} of ${totalCount}) are estimated using sector/category averages.`
    : undefined;

  return {
    estimatedAnnualIncome: Math.round(totalAnnualDividend),
    monthlyIncome: Math.round(totalAnnualDividend / 12),
    yieldPercent: dividendPayingValue > 0 
      ? Math.round((totalAnnualDividend / dividendPayingValue) * 10000) / 100
      : 0,
    holdings: holdingsWithDividend.sort((a, b) => b.estimatedAnnualDividend - a.estimatedAnnualDividend).slice(0, 10),
    hasNoDividendHoldings: false,
    disclaimer,
    dataSources: {
      database: dbSourceCount,
      sectorDefault: sectorDefaultCount,
      categoryDefault: categoryDefaultCount,
      fallback: fallbackCount
    }
  };
}

export function calculateRiskHeatmap(holdings: NormalizedHolding[], totalValue: number) {
  if (totalValue === 0) return null;
  
  const sectorMap = new Map<string, number>();
  const assetMap = new Map<string, number>();
  const amcMap = new Map<string, number>();
  const stockMap = new Map<string, number>();
  
  for (const h of holdings) {
    const value = h.currentValue || 0;
    const sector = (h as any).sector || guessSector(h.name || '');
    const assetType = h.assetType || 'mutual_fund';
    const amc = h.name?.split(' ')[0] || 'Unknown';
    
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    assetMap.set(assetType, (assetMap.get(assetType) || 0) + value);
    amcMap.set(amc, (amcMap.get(amc) || 0) + value);
    if (assetType === 'stock' || assetType === 'equity') {
      stockMap.set(h.name || 'Unknown', value);
    }
  }
  
  const concentrationWarnings: any[] = [];
  const thresholds = { sector: 40, asset: 50, stock: 15, amc: 35 };
  
  for (const [sector, value] of sectorMap) {
    const pct = (value / totalValue) * 100;
    if (pct > thresholds.sector) {
      concentrationWarnings.push({
        type: 'sector',
        name: sector,
        percentage: Math.round(pct * 10) / 10,
        threshold: thresholds.sector,
        severity: pct > 60 ? 'critical' : 'warning'
      });
    }
  }
  
  for (const [amc, value] of amcMap) {
    const pct = (value / totalValue) * 100;
    if (pct > thresholds.amc) {
      concentrationWarnings.push({
        type: 'amc',
        name: amc,
        percentage: Math.round(pct * 10) / 10,
        threshold: thresholds.amc,
        severity: pct > 50 ? 'critical' : 'warning'
      });
    }
  }
  
  for (const [stock, value] of stockMap) {
    const pct = (value / totalValue) * 100;
    if (pct > thresholds.stock) {
      concentrationWarnings.push({
        type: 'stock',
        name: stock,
        percentage: Math.round(pct * 10) / 10,
        threshold: thresholds.stock,
        severity: pct > 25 ? 'critical' : 'warning'
      });
    }
  }
  
  const sectorAllocation = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      percentage: Math.round((value / totalValue) * 1000) / 10,
      value: Math.round(value)
    }))
    .sort((a, b) => b.percentage - a.percentage);
  
  let overallRisk: 'low' | 'medium' | 'high' | 'very_high' = 'low';
  const criticalCount = concentrationWarnings.filter(w => w.severity === 'critical').length;
  const warningCount = concentrationWarnings.filter(w => w.severity === 'warning').length;
  
  if (criticalCount >= 2) overallRisk = 'very_high';
  else if (criticalCount >= 1) overallRisk = 'high';
  else if (warningCount >= 2) overallRisk = 'medium';
  
  return {
    overallRisk,
    concentrationWarnings,
    sectorAllocation: sectorAllocation.slice(0, 8)
  };
}

export function guessSector(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('bank') || lower.includes('financial') || lower.includes('hdfc') || lower.includes('icici')) return 'Banking & Finance';
  if (lower.includes('tech') || lower.includes('it') || lower.includes('infosys') || lower.includes('tcs')) return 'Technology';
  if (lower.includes('pharma') || lower.includes('health') || lower.includes('sun') || lower.includes('cipla')) return 'Healthcare';
  if (lower.includes('auto') || lower.includes('maruti') || lower.includes('tata motors')) return 'Automobile';
  if (lower.includes('energy') || lower.includes('reliance') || lower.includes('power')) return 'Energy';
  if (lower.includes('fmcg') || lower.includes('consumer') || lower.includes('hindustan') || lower.includes('itc')) return 'FMCG';
  if (lower.includes('metal') || lower.includes('steel') || lower.includes('tata steel')) return 'Metals';
  if (lower.includes('real') || lower.includes('infra')) return 'Real Estate & Infra';
  if (lower.includes('small') || lower.includes('mid')) return 'Small & Mid Cap';
  if (lower.includes('large') || lower.includes('bluechip') || lower.includes('index') || lower.includes('nifty')) return 'Large Cap';
  if (lower.includes('debt') || lower.includes('bond') || lower.includes('liquid') || lower.includes('gilt')) return 'Debt';
  if (lower.includes('hybrid') || lower.includes('balanced')) return 'Hybrid';
  return 'Diversified';
}

export function calculateBenchmarkComparison(holdings: NormalizedHolding[], analysis: any) {
  const portfolioReturn = analysis?.weightedReturn || 12;
  
  // Helper to check if holding is a stock/equity
  const isEquity = (h: NormalizedHolding) => h.assetType === 'equity' || h.assetType === 'stock';
  
  // Beta is only meaningful for stocks/equities, not mutual funds
  // Calculate weighted beta based on stock holdings only
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const stockHoldings = holdings.filter(isEquity);
  const stockValue = stockHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  
  let weightedBeta = 0;
  let sectorDefaultCount = 0;
  let fallbackCount = 0;
  
  // Only calculate beta for stock portion of portfolio
  if (stockValue > 0) {
    for (const h of stockHoldings) {
      const value = h.currentValue || 0;
      const weight = value / stockValue;
      const sector = (h as any).sector || guessSector(h.name || '');
      
      const betaLookup = portfolioAnalyticsDataService.getBetaForSector(sector);
      weightedBeta += betaLookup.value * weight;
      
      if (betaLookup.source === 'sector_default') sectorDefaultCount++;
      else fallbackCount++;
    }
  } else {
    // If no stocks, use MF-weighted beta approximation (MFs typically have beta ~0.9-1.1)
    weightedBeta = 1.0;
    fallbackCount = holdings.length;
  }
  
  // Adjust for stock vs MF mix (MFs generally have dampened beta)
  const stockWeight = totalValue > 0 ? stockValue / totalValue : 0;
  const adjustedBeta = stockWeight * weightedBeta + (1 - stockWeight) * 0.95; // MFs assumed beta ~0.95
  
  return {
    portfolioReturn: {
      oneYear: Math.round(portfolioReturn * 10) / 10,
      threeYear: Math.round((portfolioReturn * 0.9) * 10) / 10,
      fiveYear: Math.round((portfolioReturn * 0.85) * 10) / 10
    },
    benchmarks: [
      { name: 'Nifty 50', returns: { oneYear: 14.2, threeYear: 12.8, fiveYear: 11.5 } },
      { name: 'Sensex', returns: { oneYear: 13.8, threeYear: 12.5, fiveYear: 11.2 } },
      { name: 'Nifty Midcap 100', returns: { oneYear: 22.5, threeYear: 18.2, fiveYear: 15.8 } },
      { name: 'Category Average', returns: { oneYear: 11.5, threeYear: 10.2, fiveYear: 9.8 } }
    ],
    alpha: Math.round((portfolioReturn - 11.5) * 10) / 10,
    beta: Math.round(adjustedBeta * 100) / 100,
    dataSources: {
      sectorDefault: sectorDefaultCount,
      fallback: fallbackCount,
      note: stockValue === 0 ? 'No direct stock holdings - using MF beta approximation' : undefined
    }
  };
}

export function calculateWhatIfScenarios(totalValue: number) {
  return {
    scenarios: [
      { name: 'Market Crash (-20%)', marketChange: -20, portfolioImpact: -18, newValue: Math.round(totalValue * 0.82) },
      { name: 'Correction (-10%)', marketChange: -10, portfolioImpact: -9, newValue: Math.round(totalValue * 0.91) },
      { name: 'Bull Run (+20%)', marketChange: 20, portfolioImpact: 18, newValue: Math.round(totalValue * 1.18) },
      { name: 'Strong Rally (+30%)', marketChange: 30, portfolioImpact: 27, newValue: Math.round(totalValue * 1.27) }
    ],
    stressTestResult: {
      worstCase: Math.round(totalValue * 0.70),
      recovery: '12-18 months (historical average)'
    }
  };
}

export function generatePriorityRecommendations(holdings: NormalizedHolding[], riskProfile: any, capitalGains: any, riskHeatmap: any) {
  const recommendations: Array<{ priority: number; action: string; reason: string; impact: string }> = [];
  
  if (riskHeatmap?.concentrationWarnings?.some((w: any) => w.severity === 'critical')) {
    recommendations.push({
      priority: 1,
      action: 'Reduce concentration risk',
      reason: 'Portfolio has critical concentration in single sector/stock',
      impact: 'Reduces portfolio volatility by up to 15%'
    });
  }
  
  const stcgHoldings = capitalGains?.holdings?.filter((h: any) => h.taxType === 'STCG' && h.gain > 0) || [];
  if (stcgHoldings.length > 0) {
    recommendations.push({
      priority: 2,
      action: 'Consider tax-loss harvesting',
      reason: `${stcgHoldings.length} holdings have short-term gains`,
      impact: `Potential tax savings: ₹${Math.round(capitalGains.stcg.estimatedTax * 0.3).toLocaleString('en-IN')}`
    });
  }
  
  const highTERHoldings = holdings.filter(h => ((h as any).expenseRatio || 0) > 1.5);
  if (highTERHoldings.length > 0) {
    recommendations.push({
      priority: 3,
      action: 'Switch to direct plans',
      reason: `${highTERHoldings.length} funds have high expense ratios (>1.5%)`,
      impact: 'Save ₹5,000-15,000 annually in fees'
    });
  }
  
  if (!riskProfile || !riskProfile.riskTolerance) {
    recommendations.push({
      priority: 4,
      action: 'Complete risk profiling',
      reason: 'Risk profile incomplete for optimal allocation',
      impact: 'Better alignment with investment goals'
    });
  }
  
  recommendations.push({
    priority: 5,
    action: 'Set up SIP for regular investing',
    reason: 'Systematic investing reduces timing risk',
    impact: 'Average returns improve by 2-3% over lumpsum'
  });
  
  return recommendations.sort((a, b) => a.priority - b.priority);
}

export async function generateSipRecommendations(
  riskProfile: any,
  analysis: any,
  goals: Array<{ monthlyContribution?: number; targetAmount?: number; description?: string }> = [],
  selectedCategories?: string[]
) {
  const tolerance = riskProfile?.riskTolerance || 'moderate';

  // Lumpsum-only product categories — SIP is not applicable for these
  const LUMPSUM_ONLY_CATEGORIES = new Set([
    'listed_stocks', 'reit', 'invit', 'unlisted_stocks',
    'bonds', 'ncd', 'sgb', 'pms', 'aif', 'mld', 'structured_products'
  ]);
  if (
    selectedCategories &&
    selectedCategories.length > 0 &&
    selectedCategories.every(c => LUMPSUM_ONLY_CATEGORIES.has(c))
  ) {
    console.log('[SIP] All selected categories are lumpsum-only — skipping SIP recommendations');
    return [];
  }

  // GAP 1 FIX: Distinguish between "goals explicitly set to 0" vs "no goals provided"
  // If goals were explicitly provided but all have monthlyContribution = 0, the agent
  // intends no SIP (lumpsum-only). Return empty list — do NOT fall back to a default.
  const goalsProvided = goals.length > 0;
  const totalGoalSip = goals.reduce((sum, g) => sum + (Number(g.monthlyContribution) || 0), 0);
  if (goalsProvided && totalGoalSip === 0) {
    console.log('[SIP] Goals provided with zero monthly contribution — agent intends no SIP');
    return [];
  }

  // Use goal-derived SIP if goals had values; otherwise derive from portfolio or use safe default
  const monthlyAmount = totalGoalSip > 0
    ? totalGoalSip
    : analysis?.totalValue ? Math.round(analysis.totalValue * 0.05 / 12) : 10000;
  
  const fundsByRisk: Record<string, Array<{ fundName: string; category: string; suggestedAmount: number; expectedReturn: number; riskLevel: string; rationale: string }>> = {
    conservative: [
      { fundName: 'HDFC Short Term Debt Fund', category: 'Debt - Short Duration', suggestedAmount: Math.round(monthlyAmount * 0.4), expectedReturn: 7.5, riskLevel: 'Low', rationale: 'Stable returns with capital preservation' },
      { fundName: 'ICICI Prudential Balanced Advantage', category: 'Hybrid - Dynamic Asset Allocation', suggestedAmount: Math.round(monthlyAmount * 0.35), expectedReturn: 10, riskLevel: 'Moderate', rationale: 'Dynamic equity-debt mix for stability' },
      { fundName: 'Axis Bluechip Fund', category: 'Equity - Large Cap', suggestedAmount: Math.round(monthlyAmount * 0.25), expectedReturn: 12, riskLevel: 'Moderate', rationale: 'Quality large caps for growth' }
    ],
    moderate: [
      { fundName: 'Parag Parikh Flexi Cap', category: 'Equity - Flexi Cap', suggestedAmount: Math.round(monthlyAmount * 0.35), expectedReturn: 14, riskLevel: 'Moderate', rationale: 'Diversified equity with global exposure' },
      { fundName: 'Mirae Asset Large Cap', category: 'Equity - Large Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 13, riskLevel: 'Moderate', rationale: 'Consistent large cap performer' },
      { fundName: 'Kotak Emerging Equity', category: 'Equity - Mid Cap', suggestedAmount: Math.round(monthlyAmount * 0.20), expectedReturn: 16, riskLevel: 'High', rationale: 'Mid cap growth potential' },
      { fundName: 'HDFC Corporate Bond', category: 'Debt - Corporate Bond', suggestedAmount: Math.round(monthlyAmount * 0.15), expectedReturn: 8, riskLevel: 'Low', rationale: 'Portfolio stability component' }
    ],
    aggressive: [
      { fundName: 'Nippon India Small Cap', category: 'Equity - Small Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 18, riskLevel: 'Very High', rationale: 'High growth small cap exposure' },
      { fundName: 'Axis Midcap Fund', category: 'Equity - Mid Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 16, riskLevel: 'High', rationale: 'Quality mid caps for alpha' },
      { fundName: 'Quant Multi Cap Fund', category: 'Equity - Multi Cap', suggestedAmount: Math.round(monthlyAmount * 0.25), expectedReturn: 17, riskLevel: 'High', rationale: 'Momentum-based multi cap strategy' },
      { fundName: 'UTI Nifty 50 Index', category: 'Equity - Index', suggestedAmount: Math.round(monthlyAmount * 0.15), expectedReturn: 12, riskLevel: 'Moderate', rationale: 'Low-cost market returns' }
    ],
    very_aggressive: [
      { fundName: 'Quant Small Cap', category: 'Equity - Small Cap', suggestedAmount: Math.round(monthlyAmount * 0.35), expectedReturn: 20, riskLevel: 'Very High', rationale: 'Aggressive small cap exposure' },
      { fundName: 'Nippon India Small Cap', category: 'Equity - Small Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 18, riskLevel: 'Very High', rationale: 'High growth potential' },
      { fundName: 'Kotak Emerging Equity', category: 'Equity - Mid Cap', suggestedAmount: Math.round(monthlyAmount * 0.20), expectedReturn: 16, riskLevel: 'High', rationale: 'Quality mid cap allocation' },
      { fundName: 'Parag Parikh Flexi Cap', category: 'Equity - Flexi Cap', suggestedAmount: Math.round(monthlyAmount * 0.15), expectedReturn: 14, riskLevel: 'Moderate', rationale: 'Diversification anchor' }
    ]
  };
  
  const recommendations = fundsByRisk[tolerance] || fundsByRisk.moderate;
  
  // Filter out SIP-restricted funds using DB-driven checks with hardcoded fallback
  const eligible: typeof recommendations = [];
  for (const fund of recommendations) {
    let restricted = false;
    let reason = '';
    try {
      const dbResult = await schemeGovernanceService.checkEligibility(fund.fundName, "name");
      if (!dbResult.sipAllowed) {
        restricted = true;
        reason = dbResult.restrictionReason || 'SIP not allowed per AMC rules';
      }
    } catch {
      const hardcoded = isSipRestricted(fund.fundName);
      restricted = hardcoded.restricted;
      reason = hardcoded.reason || '';
    }
    if (restricted) {
      console.log(`[SIP] Excluding ${fund.fundName} from SIP recommendations: ${reason}`);
    } else {
      eligible.push(fund);
    }
  }
  
  // Redistribute excluded fund amounts proportionally among remaining funds
  if (eligible.length > 0 && eligible.length < recommendations.length) {
    const totalOriginal = recommendations.reduce((sum, f) => sum + f.suggestedAmount, 0);
    const totalEligible = eligible.reduce((sum, f) => sum + f.suggestedAmount, 0);
    if (totalEligible > 0) {
      const redistributionFactor = totalOriginal / totalEligible;
      eligible.forEach(fund => {
        fund.suggestedAmount = Math.round(fund.suggestedAmount * redistributionFactor);
      });
      const redistributedTotal = eligible.reduce((sum, f) => sum + f.suggestedAmount, 0);
      const drift = totalOriginal - redistributedTotal;
      if (drift !== 0 && eligible.length > 0) {
        eligible[eligible.length - 1].suggestedAmount += drift;
      }
    }
  }
  
  return eligible.length > 0 ? eligible : recommendations;
}



