import { db } from '../db';
import { prospectProposalEvents } from '@shared/schema';
import {
  getStoreEligibleMutualFunds,
  getStoreEligibleBonds,
  getStoreEligibleAIFs,
  getStoreEligiblePMS,
  getStoreEligibleMLDs,
  getStoreEligibleStocks,
  generateAnalyticalRationale,
} from './prospect-proposals-helpers-1';
import { aiRecommendationTrackingService } from '../services/ai-recommendation-tracking-service';

// Build Stock-specific rationale
export function buildStockRationale(recType: string, m: any): string {
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
export function buildPMSRationale(recType: string, m: any, exitLoad: any): string {
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
export function buildAIFRationale(recType: string, m: any, exitLoad: any): string {
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
export function buildDefaultRationale(recType: string, m: any, exitLoad: any): string {
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
export function calculateCapitalGainsTax(
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
export async function buildDynamicRecommendations(options: {
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

export const upload = multer({
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

export function generateShareToken(): string {
  return `PP-${nanoid(12)}`;
}

export function generateReferralCode(): string {
  return `FTP-${nanoid(8).toUpperCase()}`;
}

export async function logProposalEvent(
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

export async function trackProposalRecommendations(
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
        aiModel: 'gemini-1.5-flash',
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
