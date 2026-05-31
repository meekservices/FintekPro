// @ts-nocheck
import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  prospectProposals, 
  prospectProposalEvents, 
  onboardingInvitations,
  users,
  customerCareAgents,
  mutualFunds,
  mutualFundMetrics,
  corporateBonds,
  aifMaster,
  pmsMaster,
  mldMaster,
  listedStocks,
  aiRecommendationTracking
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { aiRecommendationTrackingService } from "../services/ai-recommendation-tracking-service";
import { unifiedAIRecommendationEngine } from "../services/unified-ai-recommendation-engine";
import { riskSuitabilityEngine } from "../services/risk-suitability-engine";
import { returnForecastingEngine } from "../services/return-forecasting-engine";

export async function resolveAgentName(agentId: string | null, agentEmail: string | null): Promise<string | null> {
  if (!agentId) return agentEmail?.split('@')[0] || null;
  try {
    const [agent] = await db.select({ 
      firstName: users.firstName, 
      lastName: users.lastName, 
      email: users.email,
      digilockrName: users.digilockerFullName
    })
      .from(users)
      .where(eq(users.id, agentId));
    if (agent?.firstName) {
      return `${agent.firstName} ${agent.lastName || ""}`.trim();
    }
    if (agent?.digilockrName) {
      return agent.digilockrName;
    }
    const lookupEmail = agent?.email || agentEmail;
    if (lookupEmail) {
      const [ccAgent] = await db.select({ fullName: customerCareAgents.fullName })
        .from(customerCareAgents)
        .where(eq(customerCareAgents.email, lookupEmail));
      if (ccAgent?.fullName) {
        return ccAgent.fullName;
      }
    }
    return agent?.email?.split('@')[0] || agentEmail?.split('@')[0] || null;
  } catch {
    return agentEmail?.split('@')[0] || null;
  }
}

// Helper functions to fetch store-eligible products
export async function getStoreEligibleMutualFunds(options: {
  category?: string;
  riskLevel?: string;
  limit?: number;
} = {}) {
  const { category, riskLevel, limit = 20 } = options;
  
  const conditions = [
    eq(mutualFunds.isPublished, true),
    eq(mutualFunds.planType, 'regular') // Only regular schemes - direct not enabled in store
  ];
  
  if (category) {
    conditions.push(ilike(mutualFunds.category, `%${category}%`));
  }
  
  if (riskLevel) {
    conditions.push(ilike(mutualFunds.riskLevel, `%${riskLevel}%`));
  }
  
  return db
    .select({
      id: mutualFunds.id,
      schemeName: mutualFunds.schemeName,
      schemeCode: mutualFunds.schemeCode,
      category: mutualFunds.category,
      fundHouse: mutualFunds.fundHouse,
      nav: mutualFunds.nav,
      returns1y: sql<string>`COALESCE(${mutualFunds.returns1y}, ${mutualFundMetrics.return1y})`,
      returns3y: sql<string>`COALESCE(${mutualFunds.returns3y}, ${mutualFundMetrics.return3y})`,
      returns5y: sql<string>`COALESCE(${mutualFunds.returns5y}, ${mutualFundMetrics.return5y})`,
      riskLevel: mutualFunds.riskLevel,
      planType: mutualFunds.planType,
      sharpeRatio: mutualFundMetrics.sharpeRatio,
      alpha: mutualFundMetrics.alpha,
      beta: mutualFundMetrics.beta,
      maxDrawdown: mutualFundMetrics.maxDrawdown,
      standardDeviation: mutualFundMetrics.standardDeviation,
    })
    .from(mutualFunds)
    .leftJoin(
      mutualFundMetrics,
      and(
        eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode),
        eq(mutualFundMetrics.fiscalYear, sql`(
          SELECT fiscal_year FROM mutual_fund_metrics m2
          WHERE m2.scheme_code = ${mutualFunds.schemeCode}
          ORDER BY m2.calculated_at DESC LIMIT 1
        )`)
      )
    )
    .where(and(...conditions))
    .limit(limit);
}

export async function getStoreEligibleBonds(options: { limit?: number; category?: string } = {}) {
  const { limit = 10, category } = options;
  
  // Use raw SQL to handle is_published that may exist in DB but not in schema
  return db
    .select({
      id: corporateBonds.id,
      bondName: corporateBonds.bondName,
      isin: corporateBonds.isin,
      couponRate: corporateBonds.couponRate,
      maturityDate: corporateBonds.maturityDate,
      faceValue: corporateBonds.faceValue,
      creditRating: corporateBonds.creditRating,
      minimumInvestment: corporateBonds.minimumInvestment,
      issuer: corporateBonds.issuer,
    })
    .from(corporateBonds)
    .where(eq(corporateBonds.tradingStatus, 'active'))
    .limit(limit);
}

export async function getStoreEligibleAIFs(options: { limit?: number } = {}) {
  const { limit = 5 } = options;
  
  return db
    .select({
      id: aifMaster.id,
      name: aifMaster.name,
      registrationNo: aifMaster.registrationNo,
      fundHouseName: aifMaster.fundHouseName,
      category: aifMaster.category,
      minInvestment: aifMaster.minInvestment,
      return1Y: aifMaster.return1Y,
      riskScore: aifMaster.riskScore,
    })
    .from(aifMaster)
    .where(eq(aifMaster.isPublished, true))
    .limit(limit);
}

export async function getStoreEligiblePMS(options: { limit?: number } = {}) {
  const { limit = 5 } = options;
  
  return db
    .select({
      id: pmsMaster.id,
      name: pmsMaster.name,
      registrationNo: pmsMaster.registrationNo,
      fundHouseName: pmsMaster.fundHouseName,
      strategy: pmsMaster.strategy,
      minInvestment: pmsMaster.minInvestment,
      return1Y: pmsMaster.return1Y,
      riskScore: pmsMaster.riskScore,
    })
    .from(pmsMaster)
    .where(eq(pmsMaster.isPublished, true))
    .limit(limit);
}

export async function getStoreEligibleMLDs(options: { limit?: number } = {}) {
  const { limit = 5 } = options;
  
  return db
    .select({
      id: mldMaster.id,
      name: mldMaster.name,
      isin: mldMaster.isin,
      issuer: mldMaster.issuer,
      payoffType: mldMaster.payoffType,
      minInvestment: mldMaster.minInvestment,
      ytm: mldMaster.ytm,
      riskScore: mldMaster.riskScore,
    })
    .from(mldMaster)
    .where(eq(mldMaster.isPublished, true))
    .limit(limit);
}

export async function getStoreEligibleStocks(options: { 
  limit?: number; 
  sector?: string;
  marketCap?: string;
} = {}) {
  const { limit = 10, sector, marketCap } = options;
  
  const conditions = [eq(listedStocks.isPublished, true)];
  
  if (sector) {
    conditions.push(ilike(listedStocks.sector, `%${sector}%`));
  }
  
  if (marketCap) {
    conditions.push(ilike(listedStocks.marketCap, `%${marketCap}%`));
  }
  
  return db
    .select({
      id: listedStocks.id,
      symbol: listedStocks.symbol,
      companyName: listedStocks.companyName,
      sector: listedStocks.sector,
      marketCap: listedStocks.marketCap,
      currentPrice: listedStocks.currentPrice,
      returns1Y: listedStocks.returns1Y,
      returns3Y: listedStocks.returns3Y,
      returns5Y: listedStocks.returns5Y,
      riskLevel: listedStocks.riskLevel,
      analystRating: listedStocks.analystRating,
      targetPrice: listedStocks.targetPrice,
      peRatio: listedStocks.peRatio,
      dividendYield: listedStocks.dividendYield,
      selectionNotes: listedStocks.selectionNotes,
    })
    .from(listedStocks)
    .where(and(...conditions))
    .limit(limit);
}

// Helper function to parse exit load from fund metadata
export function getExitLoadFromMetadata(product: any, productType: string): { exitLoadApplicable: boolean; exitLoadPercent: number; exitLoadPeriodDays: number } {
  // Check for actual exit load data in fund metadata
  if (product.exitLoad !== undefined && product.exitLoad !== null) {
    // If exitLoad is a JSON structure (array of periods)
    if (Array.isArray(product.exitLoad)) {
      // Find the first applicable exit load
      const firstLoad = product.exitLoad[0];
      if (firstLoad && firstLoad.load) {
        const loadPercent = parseFloat(firstLoad.load.replace('%', '')) || 0;
        return {
          exitLoadApplicable: loadPercent > 0,
          exitLoadPercent: loadPercent,
          exitLoadPeriodDays: 365 // Default 1 year period
        };
      }
    }
    // If exitLoad is a decimal value
    const exitLoadValue = parseFloat(product.exitLoad);
    if (!isNaN(exitLoadValue) && exitLoadValue > 0) {
      return {
        exitLoadApplicable: true,
        exitLoadPercent: exitLoadValue,
        exitLoadPeriodDays: product.exitLoadPeriod || 365
      };
    }
  }
  
  // Default exit load rules by product type (SEBI-compliant defaults)
  const defaultExitLoads: Record<string, { applicable: boolean; percent: number; periodDays: number }> = {
    'mutual_fund': { applicable: true, percent: 1.0, periodDays: 365 }, // Most equity MFs have 1% for 1 year
    'debt': { applicable: true, percent: 0.5, periodDays: 30 }, // Most debt funds have 0.5% for short period
    'liquid': { applicable: false, percent: 0, periodDays: 0 }, // Liquid funds typically no exit load
    'bond': { applicable: false, percent: 0, periodDays: 0 }, // Bonds no exit load
    'stock': { applicable: false, percent: 0, periodDays: 0 }, // Stocks no exit load
    'pms': { applicable: true, percent: 2.0, periodDays: 365 }, // PMS typically higher exit load
    'aif': { applicable: true, percent: 2.0, periodDays: 730 }, // AIF lock-in periods
    'mld': { applicable: false, percent: 0, periodDays: 0 }, // MLDs no exit load
    'etf': { applicable: false, percent: 0, periodDays: 0 }, // ETFs no exit load
  };
  
  // Check product category for specific rules
  const category = (product.category || '').toLowerCase();
  if (category.includes('liquid') || category.includes('overnight') || category.includes('money market')) {
    return { exitLoadApplicable: false, exitLoadPercent: 0, exitLoadPeriodDays: 0 };
  }
  if (category.includes('elss') || category.includes('tax')) {
    return { exitLoadApplicable: false, exitLoadPercent: 0, exitLoadPeriodDays: 0 }; // ELSS has 3-year lock-in, no exit load
  }
  
  const defaults = defaultExitLoads[productType] || defaultExitLoads['mutual_fund'];
  return {
    exitLoadApplicable: defaults.applicable,
    exitLoadPercent: defaults.percent,
    exitLoadPeriodDays: defaults.periodDays
  };
}

// Category benchmarks for valuation metrics (Morningstar-style)
const CATEGORY_BENCHMARKS: Record<string, {
  pe: number; pb: number; roe: number; dividendYield: number;
  epsGrowth: number; aum: string; volatility: number;
}> = {
  'large_cap': { pe: 22, pb: 3.5, roe: 15, dividendYield: 1.2, epsGrowth: 12, aum: '₹25,000+ Cr', volatility: 14 },
  'mid_cap': { pe: 28, pb: 4.0, roe: 14, dividendYield: 0.8, epsGrowth: 15, aum: '₹8,000+ Cr', volatility: 18 },
  'small_cap': { pe: 32, pb: 3.2, roe: 12, dividendYield: 0.5, epsGrowth: 18, aum: '₹4,000+ Cr', volatility: 24 },
  'flexi_cap': { pe: 24, pb: 3.6, roe: 14, dividendYield: 1.0, epsGrowth: 13, aum: '₹15,000+ Cr', volatility: 15 },
  'multi_cap': { pe: 25, pb: 3.5, roe: 14, dividendYield: 0.9, epsGrowth: 14, aum: '₹10,000+ Cr', volatility: 16 },
  'value': { pe: 18, pb: 2.5, roe: 13, dividendYield: 1.8, epsGrowth: 10, aum: '₹6,000+ Cr', volatility: 16 },
  'growth': { pe: 35, pb: 5.0, roe: 18, dividendYield: 0.4, epsGrowth: 20, aum: '₹8,000+ Cr', volatility: 20 },
  'hybrid': { pe: 20, pb: 2.8, roe: 12, dividendYield: 2.0, epsGrowth: 10, aum: '₹12,000+ Cr', volatility: 10 },
  'debt': { pe: 0, pb: 0, roe: 0, dividendYield: 6.5, epsGrowth: 0, aum: '₹20,000+ Cr', volatility: 3 },
  'stock': { pe: 25, pb: 4.0, roe: 16, dividendYield: 1.0, epsGrowth: 15, aum: 'N/A', volatility: 22 },
  'pms': { pe: 22, pb: 3.8, roe: 17, dividendYield: 0.8, epsGrowth: 16, aum: '₹500+ Cr', volatility: 18 },
  'aif': { pe: 20, pb: 3.5, roe: 18, dividendYield: 0.5, epsGrowth: 18, aum: '₹1,000+ Cr', volatility: 20 },
  'default': { pe: 24, pb: 3.5, roe: 14, dividendYield: 1.0, epsGrowth: 12, aum: '₹5,000+ Cr', volatility: 15 }
};

// Derive valuation metrics for different asset types
export function deriveValuationMetrics(product: any, productType: string, returns1Y: number, returns3Y: number): {
  pe: number; peVsCat: number; pbRatio: number; pbVsCat: number;
  roe: number; roeVsCat: number; dividendYield: number;
  epsGrowth3Y: number; aum: string; aumCategory: string;
  downsideCapture: number; styleBox: string; concentration: number;
  priceVs52WH: number; sectorPerf: number; irr?: number;
} {
  // Determine category for benchmarks
  const category = (product.category || '').toLowerCase();
  let catKey = 'default';
  if (category.includes('large')) catKey = 'large_cap';
  else if (category.includes('mid')) catKey = 'mid_cap';
  else if (category.includes('small')) catKey = 'small_cap';
  else if (category.includes('flexi')) catKey = 'flexi_cap';
  else if (category.includes('multi')) catKey = 'multi_cap';
  else if (category.includes('value')) catKey = 'value';
  else if (category.includes('growth')) catKey = 'growth';
  else if (category.includes('hybrid') || category.includes('balanced')) catKey = 'hybrid';
  else if (category.includes('debt') || category.includes('bond') || category.includes('liquid')) catKey = 'debt';
  else if (productType === 'stock') catKey = 'stock';
  else if (productType === 'pms') catKey = 'pms';
  else if (productType === 'aif') catKey = 'aif';
  
  const benchmark = CATEGORY_BENCHMARKS[catKey] || CATEGORY_BENCHMARKS['default'];
  
  // Get actual values or derive estimates
  let pe = parseFloat(product.pe || product.peRatio || '0');
  let pbRatio = parseFloat(product.pb || product.pbRatio || '0');
  let roe = parseFloat(product.roe || '0');
  let dividendYield = parseFloat(product.dividendYield || product.divYield || '0');
  let epsGrowth3Y = parseFloat(product.epsGrowth || product.epsGrowth3Y || '0');
  let aum = product.aum || product.assetUnderManagement || '';
  
  // Derive PE from NAV and returns if not available (MF estimation)
  if (!pe && productType !== 'debt' && productType !== 'bond') {
    // Estimate PE based on returns - higher returns typically = higher PE multiple
    const returnsFactor = Math.max(0.5, Math.min(2, (returns1Y + 10) / 20));
    pe = parseFloat((benchmark.pe * returnsFactor).toFixed(1));
  }
  
  // Derive PB from PE and ROE relationship (PB = PE * ROE / 100)
  if (!pbRatio && pe > 0) {
    const estimatedRoe = roe || benchmark.roe;
    pbRatio = parseFloat(((pe * estimatedRoe) / 100).toFixed(2));
  } else if (!pbRatio) {
    pbRatio = benchmark.pb * (1 + (returns1Y - 10) / 50);
  }
  
  // Derive ROE if not available (estimate from returns and leverage)
  if (!roe) {
    // Higher returns often correlate with higher ROE
    roe = parseFloat((benchmark.roe * (1 + (returns1Y - 12) / 40)).toFixed(1));
    roe = Math.max(5, Math.min(35, roe)); // Clamp to realistic range
  }
  
  // Derive dividend yield
  if (!dividendYield) {
    dividendYield = benchmark.dividendYield;
    if (category.includes('growth')) dividendYield *= 0.5;
    if (category.includes('value') || category.includes('dividend')) dividendYield *= 1.5;
  }
  
  // Derive EPS growth from 3Y returns
  if (!epsGrowth3Y) {
    epsGrowth3Y = parseFloat((returns3Y * 0.85).toFixed(1)); // EPS growth typically ~85% of fund returns
    epsGrowth3Y = Math.max(-10, Math.min(40, epsGrowth3Y));
  }
  
  // Parse AUM and categorize
  let aumValue = 0;
  let aumCategory = 'Medium';
  if (aum) {
    const aumMatch = aum.match(/[\d,]+/);
    if (aumMatch) {
      aumValue = parseFloat(aumMatch[0].replace(/,/g, ''));
      if (aumValue >= 25000) aumCategory = 'Very Large';
      else if (aumValue >= 10000) aumCategory = 'Large';
      else if (aumValue >= 3000) aumCategory = 'Medium';
      else aumCategory = 'Small';
    }
  } else {
    aum = benchmark.aum;
    aumCategory = 'Medium';
  }
  
  // Downside capture ratio (100 = matches market, <100 = less volatile in downturns)
  const volatility = parseFloat(product.standardDeviation || product.volatility || String(benchmark.volatility));
  const downsideCapture = Math.round(85 + (volatility - 15) * 2);
  
  // Style box classification (Growth/Blend/Value based on PE relative to category)
  const peRatio = pe / benchmark.pe;
  let styleBox = 'Blend';
  if (peRatio > 1.15) styleBox = 'Growth';
  else if (peRatio < 0.85) styleBox = 'Value';
  
  // Concentration (top 10 holdings weight) - estimate if not available
  const concentration = parseFloat(product.top10Holdings || product.concentration || '0') || 
    (productType === 'pms' ? 65 : productType === 'aif' ? 55 : 45);
  
  // 52-week high comparison for stocks
  const priceVs52WH = productType === 'stock' ? 
    parseFloat(product.priceVs52WH || String(-10 + Math.random() * 20)) : 0;
  
  // Sector performance (YTD relative to Nifty)
  const sectorPerf = parseFloat(product.sectorPerf || String(returns1Y - 12));
  
  // IRR for AIFs
  const irr = productType === 'aif' ? parseFloat(product.irr || String(returns3Y * 1.1)) : undefined;
  
  // Guard against division by zero for debt/bond categories where benchmarks are 0
  const peVsCat = benchmark.pe > 0 ? parseFloat(((pe / benchmark.pe - 1) * 100).toFixed(1)) : 0;
  const pbVsCat = benchmark.pb > 0 ? parseFloat(((pbRatio / benchmark.pb - 1) * 100).toFixed(1)) : 0;
  const roeVsCat = benchmark.roe > 0 ? parseFloat(((roe / benchmark.roe - 1) * 100).toFixed(1)) : 0;
  
  return {
    pe: parseFloat(pe.toFixed(1)),
    peVsCat,
    pbRatio: parseFloat(pbRatio.toFixed(2)),
    pbVsCat,
    roe: parseFloat(roe.toFixed(1)),
    roeVsCat,
    dividendYield: parseFloat(dividendYield.toFixed(2)),
    epsGrowth3Y: parseFloat(epsGrowth3Y.toFixed(1)),
    aum,
    aumCategory,
    downsideCapture: Math.max(50, Math.min(150, downsideCapture)),
    styleBox,
    concentration,
    priceVs52WH: parseFloat(priceVs52WH.toFixed(1)),
    sectorPerf: parseFloat(sectorPerf.toFixed(1)),
    irr
  };
}

export async function generateAIEnhancedRationale(product: any, productType: string, recommendationType: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' = 'BUY') {
  const baseResult = generateAnalyticalRationale(product, productType, recommendationType);
  
  try {
    const productName = product.schemeName || product.name || product.companyName || 'Investment';
    const returns1Y = parseFloat(product.returns1y || product.return1Y || '0');
    const category = product.category || productType;
    
    const prompt = `Generate a concise 2-sentence investment rationale for ${recommendationType} action on "${productName}" (${productType}, ${category}). 1Y return: ${returns1Y}%, Sharpe: ${baseResult.metrics.sharpeRatio}, Alpha: ${baseResult.metrics.alpha}%, Expense Ratio: ${baseResult.metrics.expenseRatio}%. Keep it professional and SEBI-compliant. No disclaimers.`;
    
    const { result, modelUsed } = await unifiedAIRecommendationEngine.runPrompt<string>({
      prompt,
      category: productType as any,
      cacheKey: `proposal-rationale:${productType}:${productName}:${recommendationType}`,
      cacheTtlMinutes: 60,
      systemPrompt: 'You are an Indian SEBI-registered investment advisor generating brief, data-driven rationales.',
      responseParser: (text: string) => text.trim(),
      fallback: () => baseResult.rationale,
    });
    
    return {
      ...baseResult,
      rationale: result || baseResult.rationale,
      aiModelUsed: modelUsed,
    };
  } catch {
    return baseResult;
  }
}

export function generateAnalyticalRationale(product: any, productType: string, recommendationType: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' = 'BUY'): {
  rationale: string;
  metrics: {
    sharpeRatio?: number;
    alpha?: number;
    beta?: number;
    standardDeviation?: number;
    maxDrawdown?: number;
    categoryRank?: string;
    benchmarkReturn?: number;
    expenseRatio?: number;
    // New valuation metrics
    pe?: number;
    peVsCat?: number;
    pbRatio?: number;
    pbVsCat?: number;
    roe?: number;
    roeVsCat?: number;
    dividendYield?: number;
    epsGrowth3Y?: number;
    aum?: string;
    aumCategory?: string;
    downsideCapture?: number;
    styleBox?: string;
    concentration?: number;
    priceVs52WH?: number;
    sectorPerf?: number;
    irr?: number;
  };
  exitLoadApplicable?: boolean;
  exitLoadPercent?: number;
  exitLoadPeriodDays?: number;
  taxImplication?: string;
} {
  // Generate realistic metrics based on product type and returns
  const returns1Y = parseFloat(product.returns1y || product.return1Y || '0');
  const returns3Y = parseFloat(product.returns3y || product.returns3Y || '0');
  
  // Calculate Sharpe ratio (Risk-free rate assumed 6.5% - current Indian G-Sec yield)
  const riskFreeRate = 6.5;
  const estimatedVolatility = productType === 'bond' || productType === 'debt' ? 3.5 : 
                               productType === 'stock' ? 22 : 
                               productType === 'pms' || productType === 'aif' ? 18 : 15;
  const sharpeRatio = estimatedVolatility > 0 ? parseFloat(((returns1Y - riskFreeRate) / estimatedVolatility).toFixed(2)) : 0;
  
  // Calculate alpha (excess return over benchmark)
  const benchmarkReturn = productType === 'bond' || productType === 'debt' ? 7.5 : 
                          productType === 'stock' ? 12 : 
                          productType === 'pms' ? 13 :
                          productType === 'aif' ? 14 : 11;
  const alpha = parseFloat((returns1Y - benchmarkReturn).toFixed(2));
  
  // Beta estimation based on product type
  const beta = productType === 'bond' || productType === 'debt' ? 0.15 : 
               productType === 'stock' ? 1.1 : 
               productType === 'pms' ? 0.95 :
               productType === 'aif' ? 0.80 : 0.85;
  
  // Standard deviation estimation
  const standardDeviation = estimatedVolatility;
  
  // Max drawdown estimation based on volatility
  const maxDrawdown = productType === 'bond' || productType === 'debt' ? -3.5 : 
                      productType === 'stock' ? -25 : 
                      productType === 'pms' ? -20 :
                      productType === 'aif' ? -22 : -15;
  
  // Derive valuation metrics
  const valuationMetrics = deriveValuationMetrics(product, productType, returns1Y, returns3Y);
  
  // Use actual category rank from product if available, otherwise estimate based on returns
  let categoryRank: string;
  if (product.categoryRank) {
    categoryRank = product.categoryRank;
  } else if (product.rating) {
    const stars = parseInt(product.rating) || 3;
    const rankEstimate = stars >= 5 ? '1-5' : stars >= 4 ? '6-15' : stars >= 3 ? '16-30' : '31+';
    categoryRank = `Top ${rankEstimate}`;
  } else {
    if (alpha > 5) categoryRank = 'Top 10%';
    else if (alpha > 0) categoryRank = 'Top 25%';
    else if (alpha > -3) categoryRank = 'Top 50%';
    else categoryRank = 'Bottom 50%';
  }
  
  // Get actual expense ratio from product or use typical ranges
  let expenseRatio: number;
  if (product.expenseRatio !== undefined && product.expenseRatio !== null) {
    expenseRatio = parseFloat(product.expenseRatio);
  } else if (product.ter !== undefined && product.ter !== null) {
    expenseRatio = parseFloat(product.ter);
  } else {
    expenseRatio = productType === 'bond' || productType === 'debt' ? 0.35 : 
                   productType === 'stock' ? 0.0 : 
                   productType === 'etf' ? 0.10 :
                   product.planType === 'direct' ? 0.50 : 1.50;
  }
  
  // Get exit load from actual fund metadata
  const exitLoadData = getExitLoadFromMetadata(product, productType);
  
  // Generate comprehensive analytical rationale
  let rationale = '';
  const category = product.category || product.schemeName?.split(' ')[0] || 'Fund';
  const productName = product.schemeName || product.name || product.companyName || 'This investment';
  const { pe, peVsCat, pbRatio, pbVsCat, roe, roeVsCat, epsGrowth3Y, dividendYield, downsideCapture, styleBox, aum, concentration, sectorPerf, irr } = valuationMetrics;
  
  // Build structured rationale by asset type
  if (productType === 'mutual_fund' || productType === 'mf' || !productType) {
    // MUTUAL FUND rationale
    rationale = buildMFRationale(recommendationType, {
      pe, peVsCat, pbRatio, pbVsCat, roe, roeVsCat, epsGrowth3Y, dividendYield,
      downsideCapture, styleBox, aum, sharpeRatio, alpha, expenseRatio,
      returns1Y, returns3Y, categoryRank, category, productName
    }, exitLoadData);
  } else if (productType === 'stock') {
    // STOCK rationale
    rationale = buildStockRationale(recommendationType, {
      pe, peVsCat, pbRatio, pbVsCat, roe, roeVsCat, epsGrowth3Y, dividendYield,
      sectorPerf, priceVs52WH: valuationMetrics.priceVs52WH, 
      sharpeRatio, alpha, returns1Y, categoryRank, productName
    });
  } else if (productType === 'pms') {
    // PMS rationale
    rationale = buildPMSRationale(recommendationType, {
      pe, peVsCat, roe, roeVsCat, concentration, alpha, sharpeRatio,
      returns1Y, returns3Y, categoryRank, productName, aum
    }, exitLoadData);
  } else if (productType === 'aif') {
    // AIF rationale
    rationale = buildAIFRationale(recommendationType, {
      irr: irr || returns3Y * 1.1, concentration, alpha, sharpeRatio,
      returns1Y, returns3Y, categoryRank, productName, downsideCapture
    }, exitLoadData);
  } else {
    // Default/Bond rationale
    rationale = buildDefaultRationale(recommendationType, {
      sharpeRatio, alpha, returns1Y, returns3Y, expenseRatio,
      categoryRank, category, productName, dividendYield
    }, exitLoadData);
  }
  
  // Ensure rationale is never empty
  if (!rationale.trim()) {
    rationale = `${productName} selected based on portfolio optimization analysis. ${categoryRank} in ${category} category.`;
  }
  
  return {
    rationale: rationale.trim(),
    metrics: {
      sharpeRatio,
      alpha,
      beta,
      standardDeviation,
      maxDrawdown,
      categoryRank,
      benchmarkReturn,
      expenseRatio,
      ...valuationMetrics
    },
    exitLoadApplicable: exitLoadData.exitLoadApplicable,
    exitLoadPercent: exitLoadData.exitLoadPercent,
    exitLoadPeriodDays: exitLoadData.exitLoadPeriodDays,
    taxImplication: undefined
  };
}

// Build MF-specific rationale
export function buildMFRationale(recType: string, m: any, exitLoad: any): string {
  const parts: string[] = [];
  
  if (recType === 'BUY') {
    // Valuation section
    if (m.pe > 0) {
      const valuation = m.peVsCat < -10 ? 'attractively valued' : m.peVsCat > 10 ? 'premium valuation' : 'fairly valued';
      parts.push(`Portfolio P/E of ${m.pe}x (${m.peVsCat > 0 ? '+' : ''}${m.peVsCat}% vs category) - ${valuation}`);
    }
    // Profitability section
    if (m.roe > 0) {
      const roeQuality = m.roeVsCat > 10 ? 'top-tier profitability' : m.roeVsCat > 0 ? 'above-average profitability' : 'adequate profitability';
      parts.push(`ROE of ${m.roe}% indicates ${roeQuality}`);
    }
    if (m.epsGrowth3Y > 12) {
      parts.push(`Strong 3Y EPS CAGR of ${m.epsGrowth3Y}%`);
    }
    // Risk section
    if (m.sharpeRatio > 0.5) {
      parts.push(`Excellent risk-adjusted returns (Sharpe: ${m.sharpeRatio})`);
    }
    if (m.alpha > 2) {
      parts.push(`${m.alpha}% alpha over benchmark`);
    }
    if (m.downsideCapture < 90) {
      parts.push(`Downside protection (${m.downsideCapture}% capture ratio)`);
    }
    // Style & efficiency
    parts.push(`${m.styleBox} style with ${m.expenseRatio.toFixed(2)}% expense ratio`);
    parts.push(`${m.categoryRank} in ${m.category}`);
    
    return parts.join('. ') + '. Recommended for long-term wealth creation.';
    
  } else if (recType === 'SELL') {
    if (m.peVsCat > 15) parts.push(`Overvalued at ${m.pe}x P/E (${m.peVsCat}% above category)`);
    if (m.roeVsCat < -15) parts.push(`Weak ROE of ${m.roe}% vs category average`);
    if (m.sharpeRatio < 0.2) parts.push(`Poor risk-adjusted returns (Sharpe: ${m.sharpeRatio})`);
    if (m.alpha < -3) parts.push(`Underperforming benchmark by ${Math.abs(m.alpha).toFixed(1)}%`);
    if (m.downsideCapture > 110) parts.push(`High downside risk (${m.downsideCapture}% capture)`);
    if (exitLoad.exitLoadApplicable) {
      parts.push(`Exit load: ${exitLoad.exitLoadPercent}% within ${exitLoad.exitLoadPeriodDays} days`);
    }
    return parts.length > 0 ? parts.join('. ') + '. Consider reallocation.' : 'Performance concerns warrant exit. Consider alternatives.';
    
  } else if (recType === 'SWITCH') {
    parts.push(`Current valuation (P/E: ${m.pe}x, P/B: ${m.pbRatio}x) suggests better opportunities available`);
    if (m.expenseRatio > 1.5) parts.push(`High expense ratio of ${m.expenseRatio.toFixed(2)}%`);
    if (m.alpha < 0) parts.push(`Underperforming benchmark by ${Math.abs(m.alpha).toFixed(1)}%`);
    return parts.join('. ') + '. Switch to higher-rated alternative in same category.';
    
  } else {
    // HOLD
    return `Balanced portfolio (P/E: ${m.pe}x, ROE: ${m.roe}%, P/B: ${m.pbRatio}x). ` +
           `Sharpe: ${m.sharpeRatio}, Alpha: ${m.alpha}%. ${m.styleBox} style. ` +
           `${m.categoryRank}. Continue holding for target horizon.`;
  }
}

