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

async function resolveAgentName(agentId: string | null, agentEmail: string | null): Promise<string | null> {
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
async function getStoreEligibleMutualFunds(options: {
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

async function getStoreEligibleBonds(options: { limit?: number; category?: string } = {}) {
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

async function getStoreEligibleAIFs(options: { limit?: number } = {}) {
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

async function getStoreEligiblePMS(options: { limit?: number } = {}) {
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

async function getStoreEligibleMLDs(options: { limit?: number } = {}) {
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

async function getStoreEligibleStocks(options: { 
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
function getExitLoadFromMetadata(product: any, productType: string): { exitLoadApplicable: boolean; exitLoadPercent: number; exitLoadPeriodDays: number } {
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
function deriveValuationMetrics(product: any, productType: string, returns1Y: number, returns3Y: number): {
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

async function generateAIEnhancedRationale(product: any, productType: string, recommendationType: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' = 'BUY') {
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

function generateAnalyticalRationale(product: any, productType: string, recommendationType: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' = 'BUY'): {
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
function buildMFRationale(recType: string, m: any, exitLoad: any): string {
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

// Build Stock-specific rationale
function buildStockRationale(recType: string, m: any): string {
  const parts: string[] = [];
  
  if (recType === 'BUY') {
    if (m.pe > 0) {
      const valuation = m.peVsCat < -15 ? 'undervalued' : m.peVsCat > 15 ? 'growth premium' : 'fair value';
      parts.push(`Trading at ${m.pe}x P/E (${valuation} vs sector)`);
    }
    if (m.pbRatio > 0) parts.push(`P/B: ${m.pbRatio}x`);
    if (m.roe > 15) parts.push(`Strong ROE of ${m.roe}%`);
    if (m.epsGrowth3Y > 15) parts.push(`EPS growing at ${m.epsGrowth3Y}% CAGR`);
    if (m.dividendYield > 1.5) parts.push(`Dividend yield: ${m.dividendYield}%`);
    if (m.sectorPerf > 0) parts.push(`Sector outperforming Nifty by ${m.sectorPerf}%`);
    if (m.priceVs52WH < -15) parts.push(`${Math.abs(m.priceVs52WH)}% below 52-week high - buying opportunity`);
    return parts.join('. ') + '. Accumulate on dips.';
    
  } else if (recType === 'SELL') {
    if (m.peVsCat > 20) parts.push(`Expensive at ${m.pe}x P/E`);
    if (m.roe < 10) parts.push(`Weak ROE of ${m.roe}%`);
    if (m.epsGrowth3Y < 5) parts.push(`Slowing EPS growth (${m.epsGrowth3Y}%)`);
    if (m.priceVs52WH > -5) parts.push(`Near 52-week high - limited upside`);
    return parts.length > 0 ? parts.join('. ') + '. Book profits.' : 'Valuation stretched. Consider profit booking.';
    
  } else if (recType === 'SWITCH') {
    return `Current metrics (P/E: ${m.pe}x, ROE: ${m.roe}%, P/B: ${m.pbRatio}x) suggest rotation to better-valued peers. Sector alpha: ${m.sectorPerf}%.`;
    
  } else {
    return `Fair valuation (P/E: ${m.pe}x, P/B: ${m.pbRatio}x). ROE: ${m.roe}%, Div Yield: ${m.dividendYield}%. ${m.categoryRank}. Hold with trailing stop-loss.`;
  }
}

// Build PMS-specific rationale
function buildPMSRationale(recType: string, m: any, exitLoad: any): string {
  if (recType === 'BUY') {
    return `Portfolio P/E: ${m.pe}x (${m.peVsCat > 0 ? '+' : ''}${m.peVsCat}% vs PMS avg). ` +
           `Portfolio ROE: ${m.roe}% (${m.roeVsCat > 0 ? 'above' : 'near'} category). ` +
           `Concentration: Top 10 holdings ${m.concentration}%. ` +
           `Alpha generation: ${m.alpha}%, Sharpe: ${m.sharpeRatio}. ` +
           `AUM: ${m.aum}. Strategy suitable for sophisticated investors.`;
  } else if (recType === 'SELL') {
    let r = `Portfolio underperforming (Alpha: ${m.alpha}%). `;
    if (m.concentration > 70) r += `High concentration risk (${m.concentration}%). `;
    if (exitLoad.exitLoadApplicable) r += `Exit load: ${exitLoad.exitLoadPercent}%. `;
    return r + 'Consider redemption.';
  } else if (recType === 'SWITCH') {
    return `Current portfolio (P/E: ${m.pe}x, ROE: ${m.roe}%) showing slippage. ${m.alpha < 0 ? 'Negative alpha vs benchmark. ' : ''}Switch to higher-conviction strategy.`;
  } else {
    return `Portfolio metrics (P/E: ${m.pe}x, ROE: ${m.roe}%, Top10: ${m.concentration}%) aligned with mandate. Alpha: ${m.alpha}%. Continue for wealth compounding.`;
  }
}

// Build AIF-specific rationale
function buildAIFRationale(recType: string, m: any, exitLoad: any): string {
  if (recType === 'BUY') {
    return `Targeted IRR: ${m.irr?.toFixed(1) || m.returns3Y}%. ` +
           `Portfolio diversification: ${m.concentration}% in top sectors. ` +
           `Downside capture: ${m.downsideCapture}%. ` +
           `Strategy alpha: ${m.alpha}%, Sharpe: ${m.sharpeRatio}. ` +
           `Suitable for accredited investors with ${exitLoad.exitLoadPeriodDays / 365}+ year horizon.`;
  } else if (recType === 'SELL') {
    let r = `Returns lagging IRR targets (${m.irr?.toFixed(1) || m.returns3Y}% vs projected). `;
    if (m.alpha < 0) r += `Negative alpha of ${m.alpha}%. `;
    return r + 'Exit at next liquidity window.';
  } else if (recType === 'SWITCH') {
    return `Current strategy underdelivering. IRR: ${m.irr?.toFixed(1) || m.returns3Y}%, Alpha: ${m.alpha}%. Rotate to outperforming vintage.`;
  } else {
    return `Strategy on track. IRR: ${m.irr?.toFixed(1) || m.returns3Y}%, Drawdown ratio: ${m.downsideCapture}%. ${m.categoryRank}. Hold through commitment period.`;
  }
}

// Build default/debt rationale
function buildDefaultRationale(recType: string, m: any, exitLoad: any): string {
  if (recType === 'BUY') {
    const parts = [];
    if (m.sharpeRatio > 0.3) parts.push(`Sharpe: ${m.sharpeRatio}`);
    if (m.alpha > 0) parts.push(`Alpha: ${m.alpha}%`);
    if (m.returns3Y > 0) parts.push(`3Y CAGR: ${m.returns3Y.toFixed(1)}%`);
    if (m.dividendYield > 5) parts.push(`Yield: ${m.dividendYield}%`);
    if (m.expenseRatio < 0.5) parts.push(`Low cost: ${m.expenseRatio.toFixed(2)}%`);
    return parts.join('. ') + `. ${m.categoryRank} in ${m.category}. Recommended for stable income.`;
  } else if (recType === 'SELL') {
    return `Performance concerns (Alpha: ${m.alpha}%). ${exitLoad.exitLoadApplicable ? `Exit load: ${exitLoad.exitLoadPercent}%. ` : ''}Consider reallocation.`;
  } else if (recType === 'SWITCH') {
    return `Better yield opportunities available. Current: ${m.returns1Y.toFixed(1)}%, Expense: ${m.expenseRatio.toFixed(2)}%. Switch to optimize.`;
  } else {
    return `Stable performer. Yield: ${m.dividendYield || m.returns1Y}%, Sharpe: ${m.sharpeRatio}. ${m.categoryRank}. Continue holding.`;
  }
}

// Capital gains tax calculator based on holding period and purchase date
// Implements Indian capital gains tax rules including July 2024 changes
function calculateCapitalGainsTax(
  purchaseDate: Date,
  currentDate: Date = new Date(),
  gainAmount: number,
  productType: string,
  isEquity: boolean = true
): { taxType: 'STCG' | 'LTCG'; taxRate: number; estimatedTax: number; holdingPeriodDays: number; taxImplication: string; exemptionApplied?: number } {
  const holdingPeriodDays = Math.floor((currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
  const holdingPeriodYears = holdingPeriodDays / 365;
  
  // Rules changed July 2024 - new tax rates and exemptions apply
  const taxRulesChangeDate = new Date('2024-07-23');
  const useNewRules = currentDate >= taxRulesChangeDate;
  
  let taxType: 'STCG' | 'LTCG';
  let taxRate: number;
  let taxableGain = gainAmount;
  let exemptionApplied = 0;
  
  const isEquityOriented = isEquity || productType === 'mutual_fund' || productType === 'stock' || productType === 'etf';
  
  if (isEquityOriented) {
    // Equity-oriented: LTCG if held > 1 year (12 months)
    if (holdingPeriodYears >= 1) {
      taxType = 'LTCG';
      // New rules (July 2024+): LTCG @ 12.5% with ₹1.25L exemption per financial year
      // Old rules (before July 2024): LTCG @ 10% with ₹1L exemption
      if (useNewRules) {
        taxRate = 12.5;
        const exemptionLimit = 125000; // ₹1.25L exemption under new rules
        if (gainAmount <= exemptionLimit) {
          taxableGain = 0;
          exemptionApplied = gainAmount;
        } else {
          taxableGain = gainAmount - exemptionLimit;
          exemptionApplied = exemptionLimit;
        }
      } else {
        taxRate = 10;
        const exemptionLimit = 100000; // ₹1L exemption under old rules
        if (gainAmount <= exemptionLimit) {
          taxableGain = 0;
          exemptionApplied = gainAmount;
        } else {
          taxableGain = gainAmount - exemptionLimit;
          exemptionApplied = exemptionLimit;
        }
      }
    } else {
      taxType = 'STCG';
      // New rules (July 2024+): STCG @ 20%
      // Old rules (before July 2024): STCG @ 15%
      taxRate = useNewRules ? 20 : 15;
      taxableGain = gainAmount; // No exemption for STCG
    }
  } else {
    // Debt-oriented funds and bonds
    const debtTaxChangeDate = new Date('2023-04-01');
    
    if (purchaseDate >= debtTaxChangeDate) {
      // Post April 2023: Debt funds taxed as per income slab (no indexation)
      // Treated as STCG regardless of holding period
      taxType = 'STCG';
      taxRate = 30; // Assuming highest slab for conservative estimate
      taxableGain = gainAmount;
    } else {
      // Pre-April 2023: LTCG if held > 3 years with indexation benefit
      if (holdingPeriodYears >= 3) {
        taxType = 'LTCG';
        taxRate = 20; // With indexation benefit (indexation calculation not included here)
      } else {
        taxType = 'STCG';
        taxRate = 30; // As per income slab
      }
      taxableGain = gainAmount;
    }
  }
  
  const estimatedTax = Math.round(taxableGain * taxRate / 100);
  
  let taxImplication = `${taxType} @ ${taxRate}%`;
  if (taxType === 'LTCG' && isEquityOriented && exemptionApplied > 0) {
    taxImplication += ` (₹${(exemptionApplied / 1000).toFixed(0)}K exemption applied)`;
  } else if (taxType === 'LTCG' && isEquityOriented) {
    taxImplication += useNewRules ? ' (₹1.25L exemption limit)' : ' (₹1L exemption limit)';
  }
  
  return { taxType, taxRate, estimatedTax, holdingPeriodDays, taxImplication, exemptionApplied };
}

// Build dynamic recommendations from actual store products
async function buildDynamicRecommendations(options: {
  totalAmount: number;
  clientType: string;
  riskTolerance?: string;
  includeEquity?: boolean;
  includeDebt?: boolean;
  includePremium?: boolean;
  includeStocks?: boolean;
  selectedCategories?: string[];
  allocations: Record<string, number>;
  monthlyInvestment?: number;
}): Promise<any[]> {
  const { totalAmount, clientType, riskTolerance = 'moderate', includePremium = false, includeStocks = true, selectedCategories, allocations, monthlyInvestment } = options;
  const hasSIP = typeof monthlyInvestment === 'number' && monthlyInvestment > 0;
  
  // Filter allocations based on selected categories if provided
  const categoryMapping: Record<string, string[]> = {
    'mutual_fund': ['Large Cap', 'Mid Cap', 'Flexi Cap', 'Debt', 'Liquid', 'ELSS'],
    'bond': ['Bonds', 'Corporate Bonds'],
    'pms': ['PMS'],
    'aif': ['AIF'],
    'mld': ['Alternatives', 'MLDs'],
    'etf': ['ETFs'],
    'stock': ['Stocks'],
    'fd': ['Fixed Deposits'],
    'gold': ['Gold', 'Sovereign Gold Bonds'],
    'insurance': ['Insurance']
  };
  
  let filteredAllocations = { ...allocations };
  if (selectedCategories && selectedCategories.length > 0) {
    const allowedKeys = new Set<string>();
    selectedCategories.forEach(cat => {
      const keys = categoryMapping[cat] || [];
      keys.forEach(k => allowedKeys.add(k));
    });
    
    // Filter allocations to only include allowed categories
    filteredAllocations = {};
    Object.entries(allocations).forEach(([key, value]) => {
      if (allowedKeys.has(key)) {
        filteredAllocations[key] = value;
      }
    });
    
    // If all allocations were filtered out, use the original
    if (Object.keys(filteredAllocations).length === 0) {
      filteredAllocations = allocations;
    }
  }
  const recommendations: any[] = [];
  
  // Fetch actual store products including stocks
  const [largeCaps, midCaps, flexiCaps, debtFunds, liquidFunds, bonds, stocks, aiFs, pmsProducts, mlds] = await Promise.all([
    getStoreEligibleMutualFunds({ category: 'Large Cap', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Mid Cap', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Flexi', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Debt', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Liquid', limit: 5 }),
    getStoreEligibleBonds({ limit: 5 }),
    includeStocks ? getStoreEligibleStocks({ limit: 10, marketCap: 'Large' }) : Promise.resolve([]),
    includePremium ? getStoreEligibleAIFs({ limit: 3 }) : Promise.resolve([]),
    includePremium ? getStoreEligiblePMS({ limit: 3 }) : Promise.resolve([]),
    includePremium ? getStoreEligibleMLDs({ limit: 3 }) : Promise.resolve([])
  ]);
  
  // Build mutual fund recommendations from actual store products
  let usedAllocation = 0;
  
  // Large Cap allocation
  if (filteredAllocations['Large Cap'] && largeCaps.length > 0) {
    const fund = largeCaps[0];
    const analyticalData = generateAnalyticalRationale(fund, 'mutual_fund', 'BUY');
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * filteredAllocations['Large Cap'] / 100),
      allocationPercentage: filteredAllocations['Large Cap'],
      investmentType: 'lumpsum',
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'Moderately High',
      planType: fund.planType, // Will be 'regular' since we filter for it
      selectionReason: `Store-eligible ${fund.category} fund with consistent performance. Regular plan for commission-eligible investment.`,
      recommendationType: 'BUY',
      ...analyticalData
    });
    usedAllocation += filteredAllocations['Large Cap'];
  }
  
  // Mid Cap allocation
  if (filteredAllocations['Mid Cap'] && midCaps.length > 0) {
    const fund = midCaps[0];
    const analyticalData = generateAnalyticalRationale(fund, 'mutual_fund', 'BUY');
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * filteredAllocations['Mid Cap'] / 100),
      allocationPercentage: filteredAllocations['Mid Cap'],
      investmentType: hasSIP ? 'sip' : 'lumpsum',
      ...(hasSIP ? { sipAmount: Math.round(monthlyInvestment! * filteredAllocations['Mid Cap'] / 100) } : {}),
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'High',
      planType: fund.planType,
      selectionReason: `Store-eligible ${fund.category} fund for growth. SIP recommended for volatility averaging.`,
      recommendationType: 'BUY',
      ...analyticalData
    });
    usedAllocation += filteredAllocations['Mid Cap'];
  }
  
  // Flexi Cap allocation
  if (filteredAllocations['Flexi Cap'] && flexiCaps.length > 0) {
    const fund = flexiCaps[0];
    const analyticalData = generateAnalyticalRationale(fund, 'mutual_fund', 'BUY');
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * filteredAllocations['Flexi Cap'] / 100),
      allocationPercentage: filteredAllocations['Flexi Cap'],
      investmentType: hasSIP ? 'sip' : 'lumpsum',
      ...(hasSIP ? { sipAmount: Math.round(monthlyInvestment! * filteredAllocations['Flexi Cap'] / 100) } : {}),
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'Moderately High',
      planType: fund.planType,
      selectionReason: `Store-eligible ${fund.category} fund offering flexibility across market caps.`,
      recommendationType: 'BUY',
      ...analyticalData
    });
    usedAllocation += filteredAllocations['Flexi Cap'];
  }
  
  // Debt/Corporate Bond allocation
  if ((filteredAllocations['Debt'] || filteredAllocations['Corporate Bond']) && debtFunds.length > 0) {
    const allocation = filteredAllocations['Debt'] || filteredAllocations['Corporate Bond'];
    const fund = debtFunds[0];
    const analyticalData = generateAnalyticalRationale(fund, 'debt', 'BUY');
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * allocation / 100),
      allocationPercentage: allocation,
      investmentType: 'lumpsum',
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'Moderate',
      planType: fund.planType,
      selectionReason: `Store-eligible debt fund for portfolio stability and regular income generation.`,
      recommendationType: 'BUY',
      ...analyticalData
    });
    usedAllocation += allocation;
  }
  
  // Liquid Fund allocation
  if (filteredAllocations['Liquid'] && liquidFunds.length > 0) {
    const fund = liquidFunds[0];
    const analyticalData = generateAnalyticalRationale(fund, 'debt', 'BUY');
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * filteredAllocations['Liquid'] / 100),
      allocationPercentage: filteredAllocations['Liquid'],
      investmentType: 'lumpsum',
      returns1Y: parseFloat(fund.returns1y || '0'),
      riskRating: fund.riskLevel || 'Low',
      planType: fund.planType,
      selectionReason: `Store-eligible liquid fund for emergency liquidity and T+0 redemption facility.`,
      recommendationType: 'BUY',
      ...analyticalData
    });
    usedAllocation += filteredAllocations['Liquid'];
  }
  
  // Bond allocation (for corporate/institutional clients)
  if (filteredAllocations['Bonds'] && bonds.length > 0) {
    const bond = bonds[0];
    const analyticalData = generateAnalyticalRationale(bond, 'bond', 'BUY');
    recommendations.push({
      productType: 'bond',
      productName: `${bond.issuer} - ${bond.couponRate}%`,
      productCode: bond.isin,
      amc: bond.issuer,
      category: 'Corporate NCD',
      recommendedAmount: Math.round(totalAmount * filteredAllocations['Bonds'] / 100),
      allocationPercentage: filteredAllocations['Bonds'],
      investmentType: 'lumpsum',
      returns1Y: parseFloat(bond.couponRate || '0'),
      riskRating: bond.creditRating || 'Moderate',
      selectionReason: `${bond.creditRating}-rated bond for stable income and capital preservation.`,
      recommendationType: 'BUY',
      ...analyticalData
    });
    usedAllocation += filteredAllocations['Bonds'];
  }
  
  // Listed Stocks allocation
  if (filteredAllocations['Stocks'] && stocks.length > 0) {
    const stocksToInclude = stocks.slice(0, Math.min(3, stocks.length));
    const perStockAllocation = filteredAllocations['Stocks'] / stocksToInclude.length;
    
    for (const stock of stocksToInclude) {
      const analyticalData = generateAnalyticalRationale(stock, 'stock', 'BUY');
      recommendations.push({
        productType: 'stock',
        productName: stock.companyName,
        productCode: stock.symbol,
        amc: stock.sector || 'Listed Equity',
        category: `${stock.marketCap || 'Large Cap'} Stock`,
        recommendedAmount: Math.round(totalAmount * perStockAllocation / 100),
        allocationPercentage: Math.round(perStockAllocation * 10) / 10,
        investmentType: 'lumpsum',
        returns1Y: parseFloat(stock.returns1Y || '0'),
        returns3Y: parseFloat(stock.returns3Y || '0'),
        returns5Y: parseFloat(stock.returns5Y || '0'),
        riskRating: stock.riskLevel || 'High',
        targetPrice: stock.targetPrice,
        analystRating: stock.analystRating,
        peRatio: stock.peRatio,
        dividendYield: stock.dividendYield,
        selectionReason: stock.selectionNotes || `Quality ${stock.marketCap || 'large cap'} stock in ${stock.sector || 'diversified'} sector for long-term wealth creation.`,
        recommendationType: 'BUY',
        ...analyticalData
      });
    }
    usedAllocation += filteredAllocations['Stocks'];
  }
  
  // Premium products for HNI/Ultra HNI
  if (includePremium) {
    // PMS allocation
    if (filteredAllocations['PMS'] && pmsProducts.length > 0) {
      const pms = pmsProducts[0];
      const analyticalData = generateAnalyticalRationale(pms, 'pms', 'BUY');
      recommendations.push({
        productType: 'pms',
        productName: pms.name,
        productCode: pms.registrationNo,
        amc: pms.fundHouseName,
        category: pms.strategy || 'PMS',
        recommendedAmount: Math.round(totalAmount * filteredAllocations['PMS'] / 100),
        allocationPercentage: filteredAllocations['PMS'],
        investmentType: 'lumpsum',
        minInvestment: parseFloat(pms.minInvestment || '5000000'),
        returns1Y: parseFloat(pms.return1Y || '0'),
        riskRating: pms.riskScore ? `Risk Score: ${pms.riskScore}` : 'Moderately High',
        selectionReason: `Premium PMS for alpha generation with professional portfolio management.`,
        recommendationType: 'BUY',
        ...analyticalData
      });
      usedAllocation += filteredAllocations['PMS'];
    }
    
    // AIF allocation
    if (filteredAllocations['AIF'] && aiFs.length > 0) {
      const aif = aiFs[0];
      const analyticalData = generateAnalyticalRationale(aif, 'aif', 'BUY');
      recommendations.push({
        productType: 'aif',
        productName: aif.name,
        productCode: aif.registrationNo,
        amc: aif.fundHouseName,
        category: aif.category || 'AIF',
        recommendedAmount: Math.round(totalAmount * filteredAllocations['AIF'] / 100),
        allocationPercentage: filteredAllocations['AIF'],
        investmentType: 'lumpsum',
        minInvestment: parseFloat(aif.minInvestment || '10000000'),
        returns1Y: parseFloat(aif.return1Y || '0'),
        riskRating: aif.riskScore ? `Risk Score: ${aif.riskScore}` : 'High',
        selectionReason: `Alternative investment fund for concentrated high-conviction exposure.`,
        recommendationType: 'BUY',
        ...analyticalData
      });
      usedAllocation += filteredAllocations['AIF'];
    }
    
    // MLD allocation
    if (filteredAllocations['Alternatives'] && mlds.length > 0) {
      const mld = mlds[0];
      const analyticalData = generateAnalyticalRationale(mld, 'mld', 'BUY');
      recommendations.push({
        productType: 'mld',
        productName: mld.name,
        productCode: mld.isin,
        amc: mld.issuer,
        category: mld.payoffType || 'Market Linked Debenture',
        recommendedAmount: Math.round(totalAmount * filteredAllocations['Alternatives'] / 100),
        allocationPercentage: filteredAllocations['Alternatives'],
        investmentType: 'lumpsum',
        minInvestment: parseFloat(mld.minInvestment || '1000000'),
        returns1Y: parseFloat(mld.ytm || '0'),
        riskRating: mld.riskScore ? `Risk Score: ${mld.riskScore}` : 'Moderately High',
        selectionReason: `Market-linked structured product for tax-efficient equity-linked returns.`,
        recommendationType: 'BUY',
        ...analyticalData
      });
      usedAllocation += filteredAllocations['Alternatives'];
    }
  }
  
  // If no store products found, provide informative fallback
  if (recommendations.length === 0) {
    recommendations.push({
      productType: 'mutual_fund',
      productName: 'Store products pending configuration',
      productCode: 'PENDING',
      amc: 'Configure Store',
      category: 'Awaiting Setup',
      recommendedAmount: totalAmount,
      allocationPercentage: 100,
      investmentType: 'lumpsum',
      riskRating: 'N/A',
      selectionReason: 'Please configure store-eligible mutual funds (Regular plan) to generate personalized recommendations.'
    });
  }
  
  return recommendations;
}
import { nanoid } from "nanoid";
import multer from "multer";
import { unifiedPDFParser } from "../services/unified-pdf-parser";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

const router = Router();

function generateShareToken(): string {
  return `PP-${nanoid(12)}`;
}

function generateReferralCode(): string {
  return `FTP-${nanoid(8).toUpperCase()}`;
}

async function logProposalEvent(
  proposalId: string,
  eventType: string,
  eventData?: any,
  ipAddress?: string,
  userAgent?: string,
  referrer?: string
) {
  await db.insert(prospectProposalEvents).values({
    proposalId,
    eventType,
    eventData: eventData || {},
    ipAddress,
    userAgent,
    referrer,
  });
}

async function trackProposalRecommendations(
  proposalId: string,
  agentId: string,
  recommendations: any[],
  prospectName: string
) {
  if (!recommendations || !Array.isArray(recommendations)) return;
  
  const trackableRecs = recommendations.filter(rec => 
    rec.action === 'BUY' || 
    rec.recommendedAmount || 
    rec.suggestedAmount ||
    (rec.productName && rec.matchScore)
  );
  
  for (const rec of trackableRecs) {
    try {
      const productName = rec.productName || rec.name || 'Unknown';
      const productType = rec.productType || 'mutual_fund';
      const category = rec.category || rec.fundMetrics?.category || 'Other';
      const amount = rec.recommendedAmount || rec.suggestedAmount || rec.changeAmount || 0;
      const returns3Y = rec.returns3Y || rec.fundMetrics?.returns3Y || '0';
      const confidence = rec.matchScore || rec.confidenceScore || 85;
      
      const expectedReturn = parseFloat(returns3Y) || 0;
      const targetPrice = amount * (1 + expectedReturn / 100);
      
      await aiRecommendationTrackingService.recordRecommendation({
        symbol: productName.substring(0, 50),
        assetName: productName,
        assetType: productType,
        sector: category,
        recommendationType: 'buy',
        entryPrice: amount.toString(),
        targetPrice: targetPrice.toFixed(2),
        confidenceScore: confidence.toString(),
        timeframeInDays: 365,
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        aiModel: 'gemini-2.5-flash',
        reasoning: `[Proposal: ${proposalId}] ${rec.rationale || rec.selectionReason || `AI recommendation for ${prospectName}`}`,
        source: 'prospect_proposal',
        agentId: agentId,
      });
      
      console.log(`[AI Tracking] Recorded recommendation: ${productName} for proposal ${proposalId}`);
    } catch (error) {
      console.error(`[AI Tracking] Failed to record recommendation:`, error);
    }
  }
}

// ============ AGENT ROUTES ============

// Create prospect proposal
router.post("/api/agent/prospect-proposals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      prospectName,
      prospectEmail,
      prospectMobile,
      prospectPan,
      proposalType,
      clientType,
      samplePortfolio,
      investmentGoals,
      proposalTitle,
      executiveSummary,
      currentAnalysis,
      recommendations,
      totalInvestmentAmount,
      projectedReturns,
      projectedValue,
      targetAllocation,
      validUntil,
    } = req.body;

    if (!prospectName || !proposalType || !proposalTitle) {
      return res.status(400).json({ error: "Prospect name, proposal type, and title are required" });
    }

    if (proposalType === 'sample_portfolio' && !samplePortfolio) {
      return res.status(400).json({ error: "Sample portfolio data is required for portfolio analysis" });
    }

    if (proposalType === 'fresh_investment' && !investmentGoals) {
      return res.status(400).json({ error: "Investment goals are required for fresh investment proposals" });
    }

    const shareToken = generateShareToken();
    const referralCode = generateReferralCode();

    // Create linked onboarding invitation and proposal in a transaction
    const expiresAt = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [invitation] = await tx.insert(onboardingInvitations).values({
        referralCode,
        inviterId: user.id,
        inviterType: "agent",
        inviterName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
        clientEmail: prospectEmail,
        clientMobile: prospectMobile,
        clientName: prospectName,
        suggestedMode: "smart",
        status: "pending",
        expiresAt,
        notes: `Created via prospect proposal: ${proposalTitle}`,
      }).returning();

      const [proposal] = await tx.insert(prospectProposals).values({
        shareToken,
        agentId: user.id,
        agentName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (user.email?.split('@')[0] || user.email || null),
        agentArnCode: user.arnCode || null,
        agentMobile: user.mobile || null,
        agentEmail: user.email || null,
        prospectName,
        prospectEmail,
        prospectMobile,
        prospectPan: prospectPan || null,
        proposalType,
        clientType: clientType || 'individual',
        samplePortfolio: samplePortfolio || null,
        investmentGoals: investmentGoals || null,
        proposalTitle,
        executiveSummary,
        currentAnalysis,
        recommendations: recommendations || [],
        totalInvestmentAmount: totalInvestmentAmount?.toString(),
        projectedReturns: projectedReturns?.toString(),
        projectedValue: projectedValue?.toString(),
        targetAllocation: targetAllocation || null,
        invitationId: invitation.id,
        referralCode,
        status: "draft",
        validUntil: expiresAt,
      }).returning();

      return { invitation, proposal };
    });

    const { invitation, proposal } = result;

    await logProposalEvent(proposal.id, "created", {
      proposalType,
      prospectName,
      prospectEmail,
    }, req.ip, req.headers["user-agent"] as string);

    // Track AI recommendations for analytics
    if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
      trackProposalRecommendations(proposal.id, user.id, recommendations, prospectName)
        .catch(err => console.error("[AI Tracking] Background tracking failed:", err));
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      success: true,
      proposal,
      invitation,
      shareableLink: `${baseUrl}/proposal/${shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${referralCode}`,
    });
  } catch (error: any) {
    console.error("Create prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to create proposal" });
  }
});

// List agent's prospect proposals
router.get("/api/agent/prospect-proposals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, search } = req.query;

    let whereConditions = [eq(prospectProposals.agentId, user.id)];
    
    if (status && status !== 'all') {
      whereConditions.push(eq(prospectProposals.status, status as string));
    }

    const proposals = await db.select()
      .from(prospectProposals)
      .where(and(...whereConditions))
      .orderBy(desc(prospectProposals.createdAt));

    // Filter by search if provided
    let filteredProposals = proposals;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredProposals = proposals.filter(p => 
        p.prospectName?.toLowerCase().includes(searchLower) ||
        p.prospectEmail?.toLowerCase().includes(searchLower) ||
        p.proposalTitle?.toLowerCase().includes(searchLower)
      );
    }

    // Get stats
    const stats = {
      total: proposals.length,
      draft: proposals.filter(p => p.status === 'draft').length,
      shared: proposals.filter(p => p.status === 'shared').length,
      viewed: proposals.filter(p => p.status === 'viewed').length,
      converted: proposals.filter(p => p.status === 'converted').length,
      totalViews: proposals.reduce((sum, p) => sum + (p.viewCount || 0), 0),
    };

    res.json({ proposals: filteredProposals, stats });
  } catch (error: any) {
    console.error("List prospect proposals error:", error);
    res.status(500).json({ error: error.message || "Failed to list proposals" });
  }
});

// Get single proposal (agent view)
router.get("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Get events
    const events = await db.select()
      .from(prospectProposalEvents)
      .where(eq(prospectProposalEvents.proposalId, proposal.id))
      .orderBy(desc(prospectProposalEvents.timestamp));

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      proposal,
      events,
      shareableLink: `${baseUrl}/proposal/${proposal.shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${proposal.referralCode}`,
    });
  } catch (error: any) {
    console.error("Get prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to get proposal" });
  }
});

// Update proposal
router.patch("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const updateData: any = { updatedAt: new Date() };
    const allowedFields = [
      'prospectName', 'prospectEmail', 'prospectMobile', 'prospectPan',
      'proposalTitle', 'executiveSummary', 'currentAnalysis',
      'recommendations', 'totalInvestmentAmount', 'projectedReturns',
      'projectedValue', 'targetAllocation', 'samplePortfolio', 'investmentGoals'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (['totalInvestmentAmount', 'projectedReturns', 'projectedValue'].includes(field)) {
          updateData[field] = req.body[field]?.toString();
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const [updated] = await db.update(prospectProposals)
      .set(updateData)
      .where(eq(prospectProposals.id, req.params.id))
      .returning();

    res.json({ success: true, proposal: updated });
  } catch (error: any) {
    console.error("Update prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to update proposal" });
  }
});

// Share proposal (mark as shared and optionally send notifications)
router.post("/api/agent/prospect-proposals/:id/share", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { shareVia } = req.body; // 'email' | 'whatsapp' | 'both'

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const updateData: any = {
      status: 'shared',
      updatedAt: new Date(),
    };

    if (shareVia === 'email' || shareVia === 'both') {
      updateData.sharedViaEmail = true;
      updateData.emailSentAt = new Date();
      await logProposalEvent(existing.id, "shared_email", { prospectEmail: existing.prospectEmail }, req.ip, req.headers["user-agent"] as string);
    }

    if (shareVia === 'whatsapp' || shareVia === 'both') {
      updateData.sharedViaWhatsApp = true;
      updateData.whatsappSentAt = new Date();
      await logProposalEvent(existing.id, "shared_whatsapp", { prospectMobile: existing.prospectMobile }, req.ip, req.headers["user-agent"] as string);
    }

    const [updated] = await db.update(prospectProposals)
      .set(updateData)
      .where(eq(prospectProposals.id, req.params.id))
      .returning();

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      success: true,
      proposal: updated,
      shareableLink: `${baseUrl}/proposal/${existing.shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${existing.referralCode}`,
    });
  } catch (error: any) {
    console.error("Share proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to share proposal" });
  }
});

// Delete proposal
router.delete("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Delete events first
    await db.delete(prospectProposalEvents)
      .where(eq(prospectProposalEvents.proposalId, existing.id));

    // Delete proposal
    await db.delete(prospectProposals)
      .where(eq(prospectProposals.id, existing.id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to delete proposal" });
  }
});

// ============ PUBLIC ROUTES (for prospects) ============

// Get proposal by share token (public view)
router.get("/api/public/proposal/:shareToken", async (req: Request, res: Response) => {
  try {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(eq(prospectProposals.shareToken, req.params.shareToken));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found or expired" });
    }

    // Check if expired
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      return res.status(410).json({ error: "This proposal has expired" });
    }

    // Update view count and status
    const isFirstView = !proposal.firstViewedAt;
    await db.update(prospectProposals)
      .set({
        viewCount: (proposal.viewCount || 0) + 1,
        lastViewedAt: new Date(),
        firstViewedAt: isFirstView ? new Date() : proposal.firstViewedAt,
        status: proposal.status === 'draft' ? 'viewed' : proposal.status,
        updatedAt: new Date(),
      })
      .where(eq(prospectProposals.id, proposal.id));

    await logProposalEvent(
      proposal.id,
      "viewed",
      { viewCount: (proposal.viewCount || 0) + 1, isFirstView },
      req.ip,
      req.headers["user-agent"] as string,
      req.headers.referer as string
    );

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      proposal: {
        id: proposal.id,
        proposalType: proposal.proposalType,
        proposalTitle: proposal.proposalTitle,
        executiveSummary: proposal.executiveSummary,
        currentAnalysis: proposal.currentAnalysis,
        recommendations: proposal.recommendations,
        totalInvestmentAmount: proposal.totalInvestmentAmount,
        projectedReturns: proposal.projectedReturns,
        projectedValue: proposal.projectedValue,
        targetAllocation: proposal.targetAllocation,
        samplePortfolio: proposal.samplePortfolio,
        investmentGoals: proposal.investmentGoals,
        agentName: proposal.agentName || await resolveAgentName(proposal.agentId, proposal.agentEmail),
        agentMobile: proposal.agentMobile,
        agentEmail: proposal.agentEmail,
        validUntil: proposal.validUntil,
        createdAt: proposal.createdAt,
        proposalSections: proposal.proposalSections,
        analyticsData: proposal.analyticsData,
      },
      onboardingLink: `${baseUrl}/onboarding?ref=${proposal.referralCode}`,
    });
  } catch (error: any) {
    console.error("Get public proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to load proposal" });
  }
});

// Track onboarding click from proposal
router.post("/api/public/proposal/:shareToken/onboarding-click", async (req: Request, res: Response) => {
  try {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(eq(prospectProposals.shareToken, req.params.shareToken));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    await logProposalEvent(
      proposal.id,
      "onboarding_started",
      {},
      req.ip,
      req.headers["user-agent"] as string,
      req.headers.referer as string
    );

    // Update invitation status
    if (proposal.invitationId) {
      await db.update(onboardingInvitations)
        .set({
          status: "started",
          onboardingStartedAt: new Date(),
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(onboardingInvitations.id, proposal.invitationId));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Track onboarding click error:", error);
    res.status(500).json({ error: error.message || "Failed to track click" });
  }
});

// ============ AI PROPOSAL GENERATION ============

// Generate AI analysis for existing portfolio holdings
async function generateExistingPortfolioAnalysis(
  prospectPan?: string,
  prospectEmail?: string,
  samplePortfolio?: any
): Promise<{
  holdings: any[];
  summary: {
    totalValue: number;
    totalHoldings: number;
    buyCount: number;
    holdCount: number;
    sellCount: number;
    switchCount: number;
  };
  analysisNote: string;
} | null> {
  try {
    let existingHoldings: any[] = [];
    let dataSource = 'none';

    // Use sample portfolio holdings if provided
    if (samplePortfolio?.holdings?.length > 0) {
      existingHoldings = samplePortfolio.holdings.map((h: any, idx: number) => ({
        id: `sample-${idx}`,
        name: h.name || `Holding ${idx + 1}`,
        type: h.type || 'mutual_fund',
        currentValue: h.currentValue || 0,
        investedAmount: h.investedAmount || h.currentValue * 0.9,
        returns1Y: h.returns1Y || h.returns1y || 10,
        returns3Y: h.returns3Y || h.returns3y || 8,
        category: h.category,
        holdingDays: h.holdingDays || 365,
        quantity: h.quantity,
        currentPrice: h.currentPrice,
      }));
      dataSource = 'sample_portfolio';
    }

    if (existingHoldings.length === 0) {
      return null;
    }

    // Generate AI recommendations for each holding
    const analyzedHoldings = existingHoldings.map(holding => {
      const returns1Y = holding.returns1Y || 0;
      const returns3Y = holding.returns3Y || returns1Y * 0.9;
      const investedAmount = holding.investedAmount || holding.currentValue;
      const currentValue = holding.currentValue;
      const gainLoss = currentValue - investedAmount;
      const gainLossPercent = investedAmount > 0 ? ((currentValue - investedAmount) / investedAmount) * 100 : 0;
      
      // Derive recommendation type based on performance metrics
      let recommendationType: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' = 'HOLD';
      
      // Benchmark returns by product type
      const benchmarkReturn = holding.type === 'bond' || holding.type === 'debt' ? 7 :
                              holding.type === 'stock' ? 12 : 10;
      
      const outperforming = returns1Y > benchmarkReturn + 2;
      const underperforming = returns1Y < benchmarkReturn - 5;
      const significantLoss = gainLossPercent < -15;
      const moderateLoss = gainLossPercent < -5 && gainLossPercent >= -15;
      const strongGain = gainLossPercent > 25;
      
      const isMutualFund = holding.type === 'mutual_fund' || holding.type === 'mf';
      
      if (underperforming && significantLoss) {
        recommendationType = 'SELL';
      } else if (underperforming && moderateLoss) {
        recommendationType = isMutualFund ? 'SWITCH' : 'SELL';
      } else if (outperforming && strongGain) {
        recommendationType = 'BUY';
      } else if (outperforming) {
        recommendationType = 'HOLD';
      } else if (returns1Y >= benchmarkReturn - 2) {
        recommendationType = 'HOLD';
      } else {
        recommendationType = isMutualFund ? 'SWITCH' : 'SELL';
      }
      
      // Create a product-like object for generateAnalyticalRationale
      const product = {
        schemeName: holding.name,
        name: holding.name,
        category: holding.category,
        returns1y: returns1Y,
        returns3y: returns3Y,
        standardDeviation: 15,
        ter: 1.5,
        categoryRank: holding.categoryRank,
        exitLoad: holding.exitLoad,
      };
      
      // Generate analytical data using existing function with correct recommendation type
      const analyticalData = generateAnalyticalRationale(
        product,
        holding.type,
        recommendationType
      );
      
      return {
        ...holding,
        gainLoss,
        gainLossPercent,
        recommendationType,
        ...analyticalData,
      };
    });

    // Calculate summary
    const summary = {
      totalValue: analyzedHoldings.reduce((sum, h) => sum + h.currentValue, 0),
      totalHoldings: analyzedHoldings.length,
      buyCount: analyzedHoldings.filter(h => h.recommendationType === 'BUY').length,
      holdCount: analyzedHoldings.filter(h => h.recommendationType === 'HOLD').length,
      sellCount: analyzedHoldings.filter(h => h.recommendationType === 'SELL').length,
      switchCount: analyzedHoldings.filter(h => h.recommendationType === 'SWITCH').length,
    };

    const analysisNote = `AI analysis of ${analyzedHoldings.length} existing holdings with BUY/HOLD/SELL/SWITCH recommendations.`;

    return {
      holdings: analyzedHoldings,
      summary,
      analysisNote,
    };
  } catch (error) {
    console.error('Error generating existing portfolio analysis:', error);
    return null;
  }
}

// Generate AI recommendations based on input
router.post("/api/agent/prospect-proposals/generate", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { 
      proposalType, 
      clientType = 'individual', 
      samplePortfolio, 
      investmentGoals, 
      selectedCategories,
      includeExistingPortfolio = false,
      prospectPan,
      prospectEmail
    } = req.body;

    // Client type configurations for tailored recommendations
    const clientTypeConfig: Record<string, {
      minInvestment: number;
      eligibleProducts: string[];
      riskModifier: number;
      toneSuffix: string;
      premiumProducts: boolean;
    }> = {
      individual: { minInvestment: 5000, eligibleProducts: ['mutual_fund'], riskModifier: 1.0, toneSuffix: 'for your personal financial goals', premiumProducts: false },
      hni: { minInvestment: 5000000, eligibleProducts: ['mutual_fund', 'pms', 'aif'], riskModifier: 1.1, toneSuffix: 'for your sophisticated investment requirements', premiumProducts: true },
      ultra_hni: { minInvestment: 50000000, eligibleProducts: ['mutual_fund', 'pms', 'aif', 'private_equity', 'structured_products'], riskModifier: 1.15, toneSuffix: 'for your ultra-high-net-worth portfolio', premiumProducts: true },
      corporate: { minInvestment: 10000000, eligibleProducts: ['mutual_fund', 'bonds', 'fixed_deposits'], riskModifier: 0.85, toneSuffix: 'for your corporate treasury requirements', premiumProducts: false },
      nri: { minInvestment: 10000, eligibleProducts: ['mutual_fund', 'bonds', 'nri_fd'], riskModifier: 0.95, toneSuffix: 'considering NRE/NRO account regulations', premiumProducts: false },
      trust: { minInvestment: 25000000, eligibleProducts: ['mutual_fund', 'pms', 'aif', 'bonds'], riskModifier: 0.9, toneSuffix: 'for your family office/trust requirements', premiumProducts: true },
      institutional: { minInvestment: 100000000, eligibleProducts: ['mutual_fund', 'pms', 'aif', 'bonds', 'structured_products'], riskModifier: 0.8, toneSuffix: 'for your institutional investment mandate', premiumProducts: true },
    };

    const config = clientTypeConfig[clientType] || clientTypeConfig.individual;

    // Generate recommendations based on proposal type
    let recommendations: any[] = [];
    let executiveSummary = "";
    let currentAnalysis = "";
    let targetAllocation: Record<string, number> = {};
    let projectedReturns = 12;
    let projectedValue = 0;

    if (proposalType === 'sample_portfolio' && samplePortfolio) {
      // Analyze sample portfolio and suggest improvements
      const totalValue = Math.max(samplePortfolio.totalValue || 0, config.minInvestment);
      const holdings = samplePortfolio.holdings || [];
      
      currentAnalysis = `Based on your current portfolio worth ₹${totalValue.toLocaleString('en-IN')}, we've analyzed ${holdings.length} holdings and identified opportunities for optimization ${config.toneSuffix}.`;
      
      executiveSummary = `Your portfolio shows potential for improved diversification and returns. We recommend rebalancing to achieve better risk-adjusted returns ${config.toneSuffix}.${config.premiumProducts ? ' As a qualified investor, you have access to exclusive PMS and AIF products with higher return potential.' : ''}`;

      // Generate client-type specific recommendations for sample portfolio
      if (config.premiumProducts && (clientType === 'hni' || clientType === 'ultra_hni' || clientType === 'trust' || clientType === 'institutional')) {
        // Premium rebalancing for HNI/Ultra HNI/Trust/Institutional - use actual store products
        targetAllocation = clientType === 'ultra_hni' 
          ? { 'PMS': 35, 'AIF': 25, 'Large Cap': 20, 'Debt': 15, 'Alternatives': 5 }
          : { 'PMS': 30, 'Large Cap': 30, 'AIF': 15, 'Debt': 20, 'Bonds': 5 };
        
        // Fetch recommendations from store with premium products
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'aggressive',
          includePremium: true,
          selectedCategories,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(16.5 * config.riskModifier * 10) / 10;
      } else if (clientType === 'corporate') {
        // Conservative treasury rebalancing for corporate - use actual store products
        targetAllocation = { 'Liquid': 30, 'Debt': 45, 'Bonds': 25 };
        
        // Fetch recommendations from store - Regular plan with treasury focus
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'conservative',
          includePremium: false,
          selectedCategories,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(7.5 * config.riskModifier * 10) / 10;
      } else if (clientType === 'nri') {
        // NRI-compliant rebalancing - use actual store products
        targetAllocation = { 'Flexi Cap': 40, 'Debt': 25, 'Large Cap': 25, 'Bonds': 10 };
        
        // Fetch recommendations from store - Regular plan NRI-eligible
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'moderate',
          includePremium: false,
          selectedCategories,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(12.5 * config.riskModifier * 10) / 10;
      } else {
        // Standard retail investor rebalancing - use actual store-eligible products (Regular plan only)
        // Now includes listed stocks for diversified equity exposure
        targetAllocation = {
          'Large Cap': 20,
          'Mid Cap': 15,
          'Flexi Cap': 10,
          'Stocks': 15,  // Direct equity exposure via listed stocks
          'Debt': 25,
          'Bonds': 15
        };

        // Fetch recommendations from store - Regular plan mutual funds + stocks
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'moderate',
          includePremium: false,
          includeStocks: true,
          selectedCategories,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(13.5 * config.riskModifier * 10) / 10;
      }
      
      const portfolioAsset = { assetId: 'portfolio', assetType: 'mutual_fund' as const, assetName: 'Portfolio', currentValue: totalValue, investedAmount: totalValue, inceptionDate: new Date() };
      const projections = await returnForecastingEngine.generateProjections(portfolioAsset, [5]);
      projectedValue = projections[0]?.projectedValue || Math.round(totalValue * Math.pow(1 + projectedReturns/100, 5));

    } else if (proposalType === 'fresh_investment' && investmentGoals) {
      // Generate recommendations for fresh investment
      const { goalType, targetAmount, timeHorizon, monthlyInvestment, lumpsum, riskTolerance } = investmentGoals;
      const calculatedAmount = (lumpsum || 0) + (monthlyInvestment || 0) * 12;
      const totalAmount = Math.max(calculatedAmount, config.minInvestment);

      const goalLabels: Record<string, string> = {
        retirement: 'Retirement Planning',
        child_education: 'Child Education',
        wealth_creation: 'Wealth Creation',
        home_purchase: 'Home Purchase',
        emergency_fund: 'Emergency Fund',
        tax_saving: 'Tax Saving',
        regular_income: 'Regular Income',
        custom: 'Custom Goal'
      };

      executiveSummary = `Based on your ${goalLabels[goalType] || goalType} goal with a ${timeHorizon} investment horizon and ${riskTolerance} risk tolerance, we've curated a personalized investment portfolio ${config.toneSuffix}.${config.premiumProducts ? ' Your profile qualifies you for premium investment products including PMS and AIFs.' : ''}`;

      currentAnalysis = `For ${targetAmount ? `a target of ₹${targetAmount.toLocaleString('en-IN')}` : 'your investment goal'}, we recommend a ${riskTolerance === 'aggressive' ? 'growth-oriented' : riskTolerance === 'conservative' ? 'stability-focused' : 'balanced'} approach ${config.toneSuffix}. ${monthlyInvestment ? `Your monthly SIP of ₹${monthlyInvestment.toLocaleString('en-IN')} combined with ` : ''}${lumpsum ? `a lumpsum of ₹${lumpsum.toLocaleString('en-IN')}` : ''} positions you well for long-term wealth creation.`;

      const adjustedReturns = config.riskModifier;
      const riskScoreMap: Record<string, number> = { conservative: 20, moderate: 45, aggressive: 65, very_aggressive: 85 };
      const prospectRiskScore = riskScoreMap[riskTolerance || 'moderate'] || 45;
      
      const allocationByRisk = riskSuitabilityEngine.getAssetAllocationForRiskScore(prospectRiskScore);
      
      if (allocationByRisk) {
        targetAllocation = allocationByRisk;
        projectedReturns = Math.round((riskTolerance === 'aggressive' ? 14 : riskTolerance === 'conservative' ? 9 : 11.5) * adjustedReturns * 10) / 10;
      } else if (riskTolerance === 'aggressive') {
        targetAllocation = { 'Equity': 80, 'Debt': 15, 'Gold': 5 };
        projectedReturns = Math.round(14 * adjustedReturns * 10) / 10;
      } else if (riskTolerance === 'conservative') {
        targetAllocation = { 'Equity': 40, 'Debt': 50, 'Gold': 10 };
        projectedReturns = Math.round(9 * adjustedReturns * 10) / 10;
      } else {
        targetAllocation = { 'Equity': 60, 'Debt': 30, 'Gold': 10 };
        projectedReturns = Math.round(11.5 * adjustedReturns * 10) / 10;
      }

      // Generate client-type specific recommendations - use actual store products
      if (config.premiumProducts && (clientType === 'hni' || clientType === 'ultra_hni' || clientType === 'trust' || clientType === 'institutional')) {
        // Premium products for HNI/Ultra HNI/Trust/Institutional clients
        targetAllocation = clientType === 'ultra_hni' 
          ? { 'PMS': 35, 'AIF': 25, 'Large Cap': 20, 'Debt': 15, 'Alternatives': 5 }
          : { 'PMS': 30, 'Large Cap': 30, 'AIF': 15, 'Debt': 20, 'Bonds': 5 };
        
        // Fetch recommendations from store with premium products
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: 'aggressive',
          includePremium: true,
          selectedCategories,
          allocations: targetAllocation,
          monthlyInvestment
        });
        projectedReturns = Math.round(16.5 * adjustedReturns * 10) / 10;
      } else if (clientType === 'corporate') {
        // Conservative treasury-focused products for corporate clients
        targetAllocation = { 'Liquid': 30, 'Debt': 45, 'Bonds': 25 };
        
        // Fetch recommendations from store - Regular plan treasury focus
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: 'conservative',
          includePremium: false,
          selectedCategories,
          allocations: targetAllocation,
          monthlyInvestment
        });
        projectedReturns = Math.round(7.5 * adjustedReturns * 10) / 10;
      } else if (clientType === 'nri') {
        // NRI-compliant products
        targetAllocation = { 'Flexi Cap': 40, 'Debt': 25, 'Large Cap': 25, 'Bonds': 10 };
        
        // Fetch recommendations from store - Regular plan NRI-eligible
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: 'moderate',
          includePremium: false,
          selectedCategories,
          allocations: targetAllocation,
          monthlyInvestment
        });
        projectedReturns = Math.round(12.5 * adjustedReturns * 10) / 10;
      } else {
        // Standard retail investor recommendations - use actual store products (Regular plan only)
        // Now includes listed stocks for enhanced equity exposure
        targetAllocation = riskTolerance === 'aggressive' 
          ? { 'Large Cap': 30, 'Mid Cap': 20, 'Flexi Cap': 15, 'Stocks': 20, 'Debt': 10, 'Bonds': 5 }
          : riskTolerance === 'conservative'
            ? { 'Large Cap': 15, 'Debt': 40, 'Bonds': 30, 'Flexi Cap': 10, 'Stocks': 5 }
            : { 'Large Cap': 25, 'Mid Cap': 15, 'Flexi Cap': 10, 'Stocks': 15, 'Debt': 25, 'Bonds': 10 };
        
        // Fetch recommendations from store - Regular plan mutual funds + listed stocks
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: riskTolerance || 'moderate',
          includePremium: false,
          includeStocks: true,
          selectedCategories,
          allocations: targetAllocation,
          monthlyInvestment
        });
        projectedReturns = Math.round((riskTolerance === 'aggressive' ? 14 : riskTolerance === 'conservative' ? 9 : 11.5) * adjustedReturns * 10) / 10;
      }

      const yearsMap: Record<string, number> = { short_term: 3, medium_term: 5, long_term: 10 };
      const years = yearsMap[timeHorizon] || 5;
      const assetType = riskTolerance === 'aggressive' ? 'equity' as const : riskTolerance === 'conservative' ? 'bond' as const : 'mutual_fund' as const;
      const freshAsset = { assetId: 'fresh', assetType, assetName: 'Investment', currentValue: totalAmount, investedAmount: totalAmount, inceptionDate: new Date() };
      const freshProjections = await returnForecastingEngine.generateProjections(freshAsset, [years]);
      projectedValue = freshProjections[0]?.projectedValue || Math.round(totalAmount * Math.pow(1 + projectedReturns/100, years));
    }

    // Generate existing portfolio analysis if requested
    let existingPortfolioAnalysis: any = null;
    if (includeExistingPortfolio) {
      existingPortfolioAnalysis = await generateExistingPortfolioAnalysis(prospectPan, prospectEmail, samplePortfolio);
    }

    try {
      const enriched = await Promise.all(
        recommendations.slice(0, 5).map(async (rec: any) => {
          const enhanced = await generateAIEnhancedRationale(
            { schemeName: rec.productName, name: rec.productName, category: rec.category, returns1y: rec.returns1Y, returns3y: rec.returns3Y, ter: rec.expenseRatio },
            rec.productType,
            rec.recommendationType || 'BUY'
          );
          return { ...rec, rationale: enhanced.rationale, aiModelUsed: enhanced.aiModelUsed };
        })
      );
      recommendations = [...enriched, ...recommendations.slice(5)];
    } catch {}

    res.json({
      success: true,
      generated: {
        executiveSummary,
        currentAnalysis,
        recommendations,
        targetAllocation,
        projectedReturns,
        projectedValue,
        totalInvestmentAmount: recommendations.reduce((sum, r) => sum + r.recommendedAmount, 0),
        existingPortfolioAnalysis,
      }
    });
  } catch (error: any) {
    console.error("Generate proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to generate proposal" });
  }
});

// ============ PDF HOLDING REPORT PARSING ============

interface ParsedHolding {
  fundName: string;
  investedAmount: number;
  currentValue: number;
  units: number;
  nav: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  xirr: number;
  holdingDays?: number;
  purchaseDate?: string;
  assetClass: string;
  category?: string;
}

interface ParsedClientInfo {
  name: string;
  crn?: string;
  pan?: string;
}

interface ParsedHoldingReport {
  clientInfo: ParsedClientInfo;
  summary: {
    totalInvested: number;
    currentValue: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    xirr: number;
  };
  holdings: ParsedHolding[];
  reportDate?: string;
}

function parseAmountFromText(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parsePercentFromText(text: string): number {
  const match = text.match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
}

function parseHoldingReportPdf(text: string): ParsedHoldingReport {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Extract client info
  const clientInfo: ParsedClientInfo = { name: '' };
  
  // Look for client name and PAN
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // PAN pattern: AAAAA0000A
    const panMatch = line.match(/PAN:\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
    if (panMatch) {
      clientInfo.pan = panMatch[1].toUpperCase();
    }
    
    // CRN pattern
    const crnMatch = line.match(/CRN:\s*(\w+)/i);
    if (crnMatch) {
      clientInfo.crn = crnMatch[1];
    }
    
    // Look for name before CRN/PAN
    if (line.includes('Hello!')) {
      // Name is usually in the lines after Hello
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nameLine = lines[j];
        if (nameLine.match(/^[A-Z\s]+,?$/) && !nameLine.includes('CRN') && !nameLine.includes('PAN')) {
          clientInfo.name = nameLine.replace(/,/g, '').trim();
          break;
        }
      }
    }
  }
  
  // Extract summary - look for "Total Invested", "Current Value", etc.
  let totalInvested = 0;
  let currentValue = 0;
  let totalUnrealizedGain = 0;
  let totalXirr = 0;
  
  const summaryPattern = /Total Invested.*?₹([\d,]+).*?Current Value.*?₹([\d,]+).*?Unrealised Gain.*?₹([\d,]+).*?\(([\d.-]+)%\).*?XIRR.*?([\d.-]+)%/is;
  const summaryMatch = text.match(summaryPattern);
  if (summaryMatch) {
    totalInvested = parseAmountFromText(summaryMatch[1]);
    currentValue = parseAmountFromText(summaryMatch[2]);
    totalUnrealizedGain = parseAmountFromText(summaryMatch[3]);
    totalXirr = parseFloat(summaryMatch[5]) || 0;
  } else {
    // Alternative parsing - look for key-value pairs
    const investedMatch = text.match(/Total Invested\s*₹([\d,]+)/i);
    const valueMatch = text.match(/Current Value\s*₹([\d,]+)/i);
    const gainMatch = text.match(/Unrealised Gain\s*₹([\d,]+)/i);
    const xirrMatch = text.match(/XIRR\s*([\d.-]+)%/i);
    
    if (investedMatch) totalInvested = parseAmountFromText(investedMatch[1]);
    if (valueMatch) currentValue = parseAmountFromText(valueMatch[1]);
    if (gainMatch) totalUnrealizedGain = parseAmountFromText(gainMatch[1]);
    if (xirrMatch) totalXirr = parseFloat(xirrMatch[1]) || 0;
  }
  
  // Extract individual holdings
  const holdings: ParsedHolding[] = [];
  
  // Pattern for mutual fund holdings: Fund Name (G) followed by amounts
  // Look for patterns like: "Invesco India Large & Mid Cap Fund (G)     ₹1,00,000           ₹1,12,521"
  const fundPatterns = [
    /([A-Za-z\s&]+Fund\s*\([GD]\))\s*₹([\d,]+)\s*₹([\d,]+)\s*₹?([\d,-]+)\s*\(([\d.-]+)%\)\s*([\d.-]+)%\s*([\d.]+)%/gi,
    /([A-Za-z\s&]+Fund\s*\([GD]\))\s*₹([\d,]+)\s*₹([\d,]+)\s*[₹\-]?([\d,]+)\s*\(?([+-]?[\d.]+)%?\)?\s*([+-]?[\d.]+)%/gi
  ];
  
  // Also try to find the table section with fund details
  const tableSection = text.match(/Equity Mutual Fund.*?Total\s*₹[\d,]+/is);
  if (tableSection) {
    const tableText = tableSection[0];
    
    // Match each fund entry with its details
    const fundRegex = /([A-Za-z][A-Za-z\s&]+(?:Fund|Cap Fund|Flexicap Fund)[^₹]*)\s*₹([\d,]+)\s*₹([\d,]+)\s*[₹]?([-\d,]+)\s*\(?([+-]?[\d.]+)%?\)?\s*([+-]?[\d.]+)%?\s*([\d.]+)%/gi;
    let match;
    
    while ((match = fundRegex.exec(tableText)) !== null) {
      const fundName = match[1].replace(/\s+/g, ' ').trim();
      const invested = parseAmountFromText(match[2]);
      const current = parseAmountFromText(match[3]);
      const gainAmount = parseAmountFromText(match[4]);
      const gainPercent = parsePercentFromText(match[5]);
      const xirr = parsePercentFromText(match[6]);
      
      if (fundName && invested > 0) {
        holdings.push({
          fundName,
          investedAmount: invested,
          currentValue: current,
          units: 0,
          nav: 0,
          unrealizedGain: gainAmount,
          unrealizedGainPercent: gainPercent,
          xirr,
          assetClass: 'Equity',
          category: 'Mutual Fund'
        });
      }
    }
  }
  
  // If regex didn't work, try line-by-line parsing for known fund names
  if (holdings.length === 0) {
    const knownFundPatterns = [
      /Invesco India.*Fund/i,
      /Nippon India.*Fund/i,
      /Sundaram.*Fund/i,
      /JM.*Fund/i,
      /HDFC.*Fund/i,
      /ICICI.*Fund/i,
      /SBI.*Fund/i,
      /Axis.*Fund/i,
      /Kotak.*Fund/i
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of knownFundPatterns) {
        if (pattern.test(line)) {
          // Found a fund name, look for amounts in nearby lines
          const combinedText = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
          const amountMatch = combinedText.match(/₹([\d,]+).*?₹([\d,]+)/);
          const percentMatch = combinedText.match(/\(([\d.-]+)%\)/);
          const xirrMatch = combinedText.match(/([\d.-]+)%\s+[\d.]+%/);
          
          if (amountMatch) {
            const fundName = line.match(/([A-Za-z][A-Za-z\s&]+(?:Fund|Cap Fund)[^₹]*)/)?.[1]?.trim() || line;
            
            holdings.push({
              fundName: fundName.replace(/\s+/g, ' ').trim(),
              investedAmount: parseAmountFromText(amountMatch[1]),
              currentValue: parseAmountFromText(amountMatch[2]),
              units: 0,
              nav: 0,
              unrealizedGain: 0,
              unrealizedGainPercent: percentMatch ? parseFloat(percentMatch[1]) : 0,
              xirr: xirrMatch ? parseFloat(xirrMatch[1]) : 0,
              assetClass: 'Equity',
              category: 'Mutual Fund'
            });
          }
          break;
        }
      }
    }
  }
  
  // Parse detailed holdings section to get units and NAV
  const detailPatterns = /Detailed Holdings Statement for ([^₹]+)\s+.*?Total\s+Invested.*?₹([\d,]+).*?Current.*?Value.*?₹([\d,]+).*?XIRR.*?([\d.-]+)%.*?Units:\s*([\d,.]+).*?NAV:\s*([\d,.]+)/gis;
  let detailMatch;
  while ((detailMatch = detailPatterns.exec(text)) !== null) {
    const fundName = detailMatch[1].replace(/\s+/g, ' ').trim();
    const units = parseFloat(detailMatch[5].replace(/,/g, '')) || 0;
    const nav = parseFloat(detailMatch[6].replace(/,/g, '')) || 0;
    
    // Update existing holding with units and NAV
    const holding = holdings.find(h => 
      h.fundName.toLowerCase().includes(fundName.toLowerCase().split(' ')[0]) ||
      fundName.toLowerCase().includes(h.fundName.toLowerCase().split(' ')[0])
    );
    if (holding) {
      holding.units = units;
      holding.nav = nav;
    }
  }
  
  // Extract report date
  const dateMatch = text.match(/(\d{1,2}[-\/]?[A-Za-z]{3}[-\/]?\d{2,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
  const reportDate = dateMatch ? dateMatch[1] : undefined;
  
  return {
    clientInfo,
    summary: {
      totalInvested,
      currentValue,
      unrealizedGain: totalUnrealizedGain,
      unrealizedGainPercent: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
      xirr: totalXirr
    },
    holdings,
    reportDate
  };
}

// Parse holding report PDF
router.post("/api/agent/parse-holding-report", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    // Parse PDF using centralized PDF parser service
    const parseResult = await unifiedPDFParser.extractTextSafe(file.buffer);
    if (!parseResult.success || !parseResult.result) {
      return res.status(400).json({ 
        error: parseResult.error || "Failed to parse PDF file" 
      });
    }
    const text = parseResult.result.text;
    
    console.log("[PDF Parse] Extracted text length:", text.length);
    
    // Parse the holding report
    const parsedReport = parseHoldingReportPdf(text);
    
    console.log("[PDF Parse] Parsed holdings:", parsedReport.holdings.length);
    console.log("[PDF Parse] Client info:", parsedReport.clientInfo);
    
    res.json({
      success: true,
      fileName: file.originalname,
      parsedData: parsedReport,
      rawTextLength: text.length
    });
  } catch (error: any) {
    console.error("Parse holding report error:", error);
    res.status(500).json({ error: error.message || "Failed to parse holding report" });
  }
});

export default router;
