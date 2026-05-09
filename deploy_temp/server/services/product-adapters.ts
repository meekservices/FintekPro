import { 
  InvestmentProduct, 
  UnifiedProductType, 
  RiskLevel, 
  LiquidityLevel, 
  InvestmentHorizon,
  TaxTreatment,
  ProductAdapter 
} from "@shared/unified-investment-product";
import type { ListedStock } from "@shared/schema";

function parseDecimal(value: any): number {
  if (value === null || value === undefined) return 0;
  const parsed = parseFloat(String(value));
  return isNaN(parsed) ? 0 : parsed;
}

export class StockAdapter implements ProductAdapter<ListedStock> {
  productType: UnifiedProductType = 'STOCK';

  normalize(stock: ListedStock): InvestmentProduct {
    return {
      product_id: stock.id,
      product_type: 'STOCK',
      name: stock.companyName,
      issuer: stock.companyName,
      risk_level: this.getRiskLevel(stock),
      liquidity: this.getLiquidity(stock),
      investment_horizon: this.getHorizon(stock),
      expected_return_band: this.getExpectedReturn(stock),
      volatility_proxy: this.getVolatility(stock),
      tax_treatment: 'equity',
      lock_in_period: null,
      min_investment: parseDecimal(stock.currentPrice) || 100,
      regulatory_tags: ['SEBI_REGULATED', 'EXCHANGE_TRADED'],
      source: 'exchange',
      current_price: parseDecimal(stock.currentPrice),
      yield_or_return: parseDecimal(stock.returns1Y),
      rating: stock.analystRating || undefined,
      sector: stock.sector || undefined,
      raw_data: stock,
      last_updated: stock.lastUpdated || new Date(),
    };
  }

  getRiskLevel(stock: ListedStock): RiskLevel {
    const riskLevel = stock.riskLevel?.toLowerCase();
    if (riskLevel === 'low') return 'conservative';
    if (riskLevel === 'moderate' || riskLevel === 'medium') return 'moderate';
    if (riskLevel === 'high') return 'aggressive';
    if (riskLevel === 'very high') return 'very_aggressive';
    
    const marketCap = stock.marketCap?.toLowerCase();
    if (marketCap?.includes('large')) return 'moderate';
    if (marketCap?.includes('mid')) return 'aggressive';
    return 'very_aggressive';
  }

  getLiquidity(stock: ListedStock): LiquidityLevel {
    const marketCap = stock.marketCap?.toLowerCase();
    if (marketCap?.includes('large')) return 'high';
    if (marketCap?.includes('mid')) return 'medium';
    return 'low';
  }

  getHorizon(stock: ListedStock): InvestmentHorizon {
    const marketCap = stock.marketCap?.toLowerCase();
    if (marketCap?.includes('large')) return 'medium';
    if (marketCap?.includes('mid')) return 'long';
    return 'very_long';
  }

  getExpectedReturn(stock: ListedStock): { min: number; max: number } {
    const returns1Y = parseDecimal(stock.returns1Y);
    const returns3Y = parseDecimal(stock.returns3Y);
    const avgReturn = returns3Y || returns1Y || 12;
    return {
      min: Math.max(avgReturn - 15, -10),
      max: avgReturn + 25,
    };
  }

  getVolatility(stock: ListedStock): number {
    const volatility = parseDecimal(stock.volatility);
    if (volatility > 0) return volatility;
    const beta = parseDecimal(stock.beta);
    return beta > 0 ? beta * 15 : 20;
  }
}

export class MFAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'MF';

  normalize(fund: any): InvestmentProduct {
    const category = fund.category?.toLowerCase() || '';
    return {
      product_id: fund.id || fund.schemeCode,
      product_type: 'MF',
      name: fund.schemeName,
      issuer: fund.fundHouse || 'Unknown AMC',
      risk_level: this.getRiskLevel(fund),
      liquidity: this.getLiquidity(fund),
      investment_horizon: this.getHorizon(fund),
      expected_return_band: this.getExpectedReturn(fund),
      volatility_proxy: this.getVolatility(fund),
      tax_treatment: this.getTaxTreatment(category),
      lock_in_period: category.includes('elss') ? 36 : null,
      min_investment: 500,
      regulatory_tags: ['SEBI_REGULATED', 'AMFI_REGISTERED'],
      source: 'store',
      current_price: parseDecimal(fund.nav),
      yield_or_return: parseDecimal(fund.returns1y),
      rating: fund.crisilRating ? `${fund.crisilRating}-Star FintekPro Rating` : undefined,
      sector: fund.category || undefined,
      raw_data: fund,
      last_updated: fund.lastUpdated || new Date(),
    };
  }

  private getTaxTreatment(category: string): TaxTreatment {
    if (category.includes('equity') || category.includes('elss')) return 'equity';
    if (category.includes('debt') || category.includes('liquid') || category.includes('money market')) return 'debt';
    if (category.includes('hybrid') || category.includes('balanced')) return 'hybrid';
    return 'hybrid';
  }

  getRiskLevel(fund: any): RiskLevel {
    const riskLevel = fund.riskLevel?.toLowerCase();
    if (riskLevel?.includes('low')) return 'conservative';
    if (riskLevel?.includes('moderate') || riskLevel?.includes('medium')) return 'moderate';
    if (riskLevel?.includes('high') || riskLevel?.includes('very high')) return 'aggressive';
    
    const category = fund.category?.toLowerCase() || '';
    if (category.includes('liquid') || category.includes('overnight')) return 'conservative';
    if (category.includes('debt') || category.includes('money market')) return 'conservative';
    if (category.includes('hybrid') || category.includes('balanced')) return 'moderate';
    if (category.includes('small cap') || category.includes('sectoral')) return 'very_aggressive';
    return 'aggressive';
  }

  getLiquidity(fund: any): LiquidityLevel {
    const category = fund.category?.toLowerCase() || '';
    if (category.includes('liquid') || category.includes('overnight')) return 'high';
    if (category.includes('elss')) return 'very_low';
    return 'high';
  }

  getHorizon(fund: any): InvestmentHorizon {
    const category = fund.category?.toLowerCase() || '';
    if (category.includes('liquid') || category.includes('overnight')) return 'ultra_short';
    if (category.includes('short') || category.includes('money market')) return 'short';
    if (category.includes('debt') || category.includes('hybrid')) return 'medium';
    if (category.includes('elss') || category.includes('small cap')) return 'long';
    return 'medium';
  }

  getExpectedReturn(fund: any): { min: number; max: number } {
    const returns1Y = parseDecimal(fund.returns1y);
    const returns3Y = parseDecimal(fund.returns3y);
    const avgReturn = returns3Y || returns1Y || 10;
    return {
      min: Math.max(avgReturn - 8, 0),
      max: avgReturn + 15,
    };
  }

  getVolatility(fund: any): number {
    const category = fund.category?.toLowerCase() || '';
    if (category.includes('liquid') || category.includes('overnight')) return 1;
    if (category.includes('debt') || category.includes('money market')) return 3;
    if (category.includes('hybrid')) return 10;
    if (category.includes('large cap')) return 15;
    if (category.includes('small cap')) return 30;
    return 18;
  }
}

export class BondAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'BOND';

  normalize(bond: any): InvestmentProduct {
    const isGovSec = bond.securityType !== undefined;
    return {
      product_id: bond.id || bond.isin,
      product_type: 'BOND',
      name: bond.securityName || bond.issuerName || bond.name,
      issuer: isGovSec ? 'Government of India' : (bond.issuerName || 'Corporate'),
      risk_level: this.getRiskLevel(bond),
      liquidity: this.getLiquidity(bond),
      investment_horizon: this.getHorizon(bond),
      expected_return_band: this.getExpectedReturn(bond),
      volatility_proxy: this.getVolatility(bond),
      tax_treatment: this.getTaxTreatment(bond),
      lock_in_period: null,
      min_investment: parseDecimal(bond.faceValue) || 10000,
      regulatory_tags: isGovSec ? ['RBI_REGULATED', 'SOVEREIGN'] : ['SEBI_REGULATED'],
      source: 'store',
      current_price: parseDecimal(bond.lastTradedPrice) || parseDecimal(bond.faceValue),
      yield_or_return: parseDecimal(bond.yieldToMaturity) || parseDecimal(bond.couponRate),
      rating: bond.creditRating || (isGovSec ? 'Sovereign' : undefined),
      sector: isGovSec ? 'Government Securities' : 'Corporate Bonds',
      raw_data: bond,
      last_updated: bond.lastUpdated || new Date(),
    };
  }

  private getTaxTreatment(bond: any): TaxTreatment {
    const type = bond.securityType?.toLowerCase() || '';
    if (type.includes('tax_free') || type.includes('tax-free')) return 'tax_free';
    if (type.includes('sgb')) return 'indexed';
    return 'debt';
  }

  getRiskLevel(bond: any): RiskLevel {
    const isGovSec = bond.securityType !== undefined;
    if (isGovSec) return 'conservative';
    
    const rating = bond.creditRating?.toUpperCase() || '';
    if (rating.startsWith('AAA') || rating.startsWith('AA')) return 'conservative';
    if (rating.startsWith('A') || rating.startsWith('BBB')) return 'moderate';
    return 'aggressive';
  }

  getLiquidity(bond: any): LiquidityLevel {
    const isGovSec = bond.securityType !== undefined;
    if (isGovSec) return 'medium';
    return 'low';
  }

  getHorizon(bond: any): InvestmentHorizon {
    const maturityDate = bond.maturityDate ? new Date(bond.maturityDate) : null;
    if (!maturityDate) return 'medium';
    
    const yearsToMaturity = (maturityDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000);
    if (yearsToMaturity <= 1) return 'short';
    if (yearsToMaturity <= 3) return 'medium';
    if (yearsToMaturity <= 7) return 'long';
    return 'very_long';
  }

  getExpectedReturn(bond: any): { min: number; max: number } {
    const ytm = parseDecimal(bond.yieldToMaturity) || parseDecimal(bond.couponRate) || 7;
    return {
      min: ytm - 0.5,
      max: ytm + 0.5,
    };
  }

  getVolatility(bond: any): number {
    const duration = parseDecimal(bond.modifiedDuration);
    if (duration > 0) return duration * 1.5;
    return 5;
  }
}

export class REITAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'REIT';

  normalize(reit: any): InvestmentProduct {
    return {
      product_id: reit.id,
      product_type: 'REIT',
      name: reit.name,
      issuer: reit.sponsor || reit.manager || 'REIT Manager',
      risk_level: this.getRiskLevel(reit),
      liquidity: this.getLiquidity(reit),
      investment_horizon: this.getHorizon(reit),
      expected_return_band: this.getExpectedReturn(reit),
      volatility_proxy: this.getVolatility(reit),
      tax_treatment: 'hybrid',
      lock_in_period: null,
      min_investment: parseDecimal(reit.lotSize) * parseDecimal(reit.currentPrice) || 50000,
      regulatory_tags: ['SEBI_REGULATED', 'EXCHANGE_TRADED'],
      source: 'exchange',
      current_price: parseDecimal(reit.currentPrice),
      yield_or_return: parseDecimal(reit.distributionYield),
      sector: reit.propertyType || 'Real Estate',
      raw_data: reit,
      last_updated: reit.lastUpdated || new Date(),
    };
  }

  getRiskLevel(reit: any): RiskLevel {
    return 'moderate';
  }

  getLiquidity(reit: any): LiquidityLevel {
    return 'medium';
  }

  getHorizon(reit: any): InvestmentHorizon {
    return 'long';
  }

  getExpectedReturn(reit: any): { min: number; max: number } {
    const yield_ = parseDecimal(reit.distributionYield) || 6;
    return {
      min: yield_ - 2,
      max: yield_ + 8,
    };
  }

  getVolatility(reit: any): number {
    return 15;
  }
}

export class InvITAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'INVIT';

  normalize(invit: any): InvestmentProduct {
    return {
      product_id: invit.id,
      product_type: 'INVIT',
      name: invit.name,
      issuer: invit.sponsor || invit.manager || 'InvIT Manager',
      risk_level: this.getRiskLevel(invit),
      liquidity: this.getLiquidity(invit),
      investment_horizon: this.getHorizon(invit),
      expected_return_band: this.getExpectedReturn(invit),
      volatility_proxy: this.getVolatility(invit),
      tax_treatment: 'hybrid',
      lock_in_period: null,
      min_investment: parseDecimal(invit.lotSize) * parseDecimal(invit.currentPrice) || 100000,
      regulatory_tags: ['SEBI_REGULATED', 'EXCHANGE_TRADED'],
      source: 'exchange',
      current_price: parseDecimal(invit.currentPrice),
      yield_or_return: parseDecimal(invit.distributionYield),
      sector: invit.assetType || 'Infrastructure',
      raw_data: invit,
      last_updated: invit.lastUpdated || new Date(),
    };
  }

  getRiskLevel(invit: any): RiskLevel {
    return 'moderate';
  }

  getLiquidity(invit: any): LiquidityLevel {
    return 'medium';
  }

  getHorizon(invit: any): InvestmentHorizon {
    return 'long';
  }

  getExpectedReturn(invit: any): { min: number; max: number } {
    const yield_ = parseDecimal(invit.distributionYield) || 8;
    return {
      min: yield_ - 2,
      max: yield_ + 6,
    };
  }

  getVolatility(invit: any): number {
    return 12;
  }
}

export class IPOAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'IPO';

  normalize(ipo: any): InvestmentProduct {
    return {
      product_id: ipo.id,
      product_type: 'IPO',
      name: ipo.companyName,
      issuer: ipo.companyName,
      risk_level: this.getRiskLevel(ipo),
      liquidity: this.getLiquidity(ipo),
      investment_horizon: this.getHorizon(ipo),
      expected_return_band: this.getExpectedReturn(ipo),
      volatility_proxy: this.getVolatility(ipo),
      tax_treatment: 'equity',
      lock_in_period: null,
      min_investment: parseDecimal(ipo.priceBandMax) * (ipo.lotSize || 1) || 15000,
      regulatory_tags: ['SEBI_REGULATED', 'NEW_LISTING'],
      source: 'issuer',
      current_price: parseDecimal(ipo.priceBandMax),
      sector: ipo.sector || undefined,
      raw_data: ipo,
      last_updated: ipo.lastUpdated || new Date(),
    };
  }

  getRiskLevel(ipo: any): RiskLevel {
    const ipoType = ipo.ipoType?.toLowerCase();
    if (ipoType === 'sme') return 'very_aggressive';
    return 'aggressive';
  }

  getLiquidity(ipo: any): LiquidityLevel {
    return 'very_low';
  }

  getHorizon(ipo: any): InvestmentHorizon {
    return 'medium';
  }

  getExpectedReturn(ipo: any): { min: number; max: number } {
    return {
      min: -20,
      max: 50,
    };
  }

  getVolatility(ipo: any): number {
    return 40;
  }
}

export class UnlistedEquityAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'UNLISTED';

  normalize(company: any): InvestmentProduct {
    return {
      product_id: company.id,
      product_type: 'UNLISTED',
      name: company.companyName,
      issuer: company.companyName,
      risk_level: this.getRiskLevel(company),
      liquidity: this.getLiquidity(company),
      investment_horizon: this.getHorizon(company),
      expected_return_band: this.getExpectedReturn(company),
      volatility_proxy: this.getVolatility(company),
      tax_treatment: 'equity',
      lock_in_period: company.lockInPeriod || 12,
      min_investment: parseDecimal(company.minimumInvestment) || 100000,
      regulatory_tags: ['UNLISTED', 'HIGH_RISK', 'HNI_ONLY'],
      source: 'store',
      current_price: parseDecimal(company.currentValuation),
      yield_or_return: parseDecimal(company.expectedReturns),
      sector: company.sector || undefined,
      raw_data: company,
      last_updated: company.lastUpdated || new Date(),
    };
  }

  getRiskLevel(company: any): RiskLevel {
    return 'very_aggressive';
  }

  getLiquidity(company: any): LiquidityLevel {
    return 'very_low';
  }

  getHorizon(company: any): InvestmentHorizon {
    return 'very_long';
  }

  getExpectedReturn(company: any): { min: number; max: number } {
    const expected = parseDecimal(company.expectedReturns) || 25;
    return {
      min: -30,
      max: expected + 50,
    };
  }

  getVolatility(company: any): number {
    return 50;
  }
}

export class AIFAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'AIF';

  normalize(aif: any): InvestmentProduct {
    return {
      product_id: aif.id,
      product_type: 'AIF',
      name: aif.name,
      issuer: aif.fundManager || aif.amcName || 'AIF Manager',
      risk_level: this.getRiskLevel(aif),
      liquidity: this.getLiquidity(aif),
      investment_horizon: this.getHorizon(aif),
      expected_return_band: this.getExpectedReturn(aif),
      volatility_proxy: this.getVolatility(aif),
      tax_treatment: 'special',
      lock_in_period: parseDecimal(aif.lockInPeriod) || 36,
      min_investment: parseDecimal(aif.minInvestment) || 10000000,
      regulatory_tags: ['SEBI_REGULATED', 'ACCREDITED_ONLY', `CAT_${aif.category || 'II'}`],
      source: 'store',
      yield_or_return: parseDecimal(aif.targetReturn),
      sector: aif.strategy || 'Alternative',
      raw_data: aif,
      last_updated: aif.lastUpdated || new Date(),
    };
  }

  getRiskLevel(aif: any): RiskLevel {
    const category = aif.category?.toUpperCase();
    if (category === 'III') return 'very_aggressive';
    return 'aggressive';
  }

  getLiquidity(aif: any): LiquidityLevel {
    return 'very_low';
  }

  getHorizon(aif: any): InvestmentHorizon {
    return 'very_long';
  }

  getExpectedReturn(aif: any): { min: number; max: number } {
    const target = parseDecimal(aif.targetReturn) || 18;
    return {
      min: target - 10,
      max: target + 15,
    };
  }

  getVolatility(aif: any): number {
    return 30;
  }
}

export class PMSAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'PMS';

  normalize(pms: any): InvestmentProduct {
    return {
      product_id: pms.id,
      product_type: 'PMS',
      name: pms.name || pms.schemeName,
      issuer: pms.portfolioManager || pms.amcName || 'PMS Manager',
      risk_level: this.getRiskLevel(pms),
      liquidity: this.getLiquidity(pms),
      investment_horizon: this.getHorizon(pms),
      expected_return_band: this.getExpectedReturn(pms),
      volatility_proxy: this.getVolatility(pms),
      tax_treatment: 'equity',
      lock_in_period: null,
      min_investment: parseDecimal(pms.minInvestment) || 5000000,
      regulatory_tags: ['SEBI_REGULATED', 'SHNI_ONLY'],
      source: 'store',
      yield_or_return: parseDecimal(pms.returns1Y),
      sector: pms.strategy || 'Discretionary',
      raw_data: pms,
      last_updated: pms.lastUpdated || new Date(),
    };
  }

  getRiskLevel(pms: any): RiskLevel {
    return 'aggressive';
  }

  getLiquidity(pms: any): LiquidityLevel {
    return 'low';
  }

  getHorizon(pms: any): InvestmentHorizon {
    return 'long';
  }

  getExpectedReturn(pms: any): { min: number; max: number } {
    const returns = parseDecimal(pms.returns1Y) || 15;
    return {
      min: returns - 10,
      max: returns + 20,
    };
  }

  getVolatility(pms: any): number {
    return 25;
  }
}

export class MLDAdapter implements ProductAdapter<any> {
  productType: UnifiedProductType = 'MLD';

  normalize(mld: any): InvestmentProduct {
    return {
      product_id: mld.id,
      product_type: 'MLD',
      name: mld.name || mld.productName,
      issuer: mld.issuer || 'MLD Issuer',
      risk_level: this.getRiskLevel(mld),
      liquidity: this.getLiquidity(mld),
      investment_horizon: this.getHorizon(mld),
      expected_return_band: this.getExpectedReturn(mld),
      volatility_proxy: this.getVolatility(mld),
      tax_treatment: 'debt',
      lock_in_period: parseDecimal(mld.tenure) || 36,
      min_investment: parseDecimal(mld.minInvestment) || 1000000,
      regulatory_tags: ['SEBI_REGULATED', 'CAPITAL_AT_RISK', 'HNI_ONLY'],
      source: 'store',
      yield_or_return: parseDecimal(mld.indicativeYield),
      rating: mld.creditRating || undefined,
      raw_data: mld,
      last_updated: mld.lastUpdated || new Date(),
    };
  }

  getRiskLevel(mld: any): RiskLevel {
    return 'aggressive';
  }

  getLiquidity(mld: any): LiquidityLevel {
    return 'very_low';
  }

  getHorizon(mld: any): InvestmentHorizon {
    return 'medium';
  }

  getExpectedReturn(mld: any): { min: number; max: number } {
    const indicative = parseDecimal(mld.indicativeYield) || 10;
    return {
      min: 0,
      max: indicative + 5,
    };
  }

  getVolatility(mld: any): number {
    return 20;
  }
}

export const productAdapters: Record<UnifiedProductType, ProductAdapter<any>> = {
  STOCK: new StockAdapter(),
  MF: new MFAdapter(),
  BOND: new BondAdapter(),
  REIT: new REITAdapter(),
  INVIT: new InvITAdapter(),
  IPO: new IPOAdapter(),
  UNLISTED: new UnlistedEquityAdapter(),
  AIF: new AIFAdapter(),
  PMS: new PMSAdapter(),
  MLD: new MLDAdapter(),
};

export function normalizeProduct(raw: any, productType: UnifiedProductType): InvestmentProduct {
  const adapter = productAdapters[productType];
  if (!adapter) {
    throw new Error(`No adapter found for product type: ${productType}`);
  }
  return adapter.normalize(raw);
}

export function normalizeProducts(products: any[], productType: UnifiedProductType): InvestmentProduct[] {
  return products.map(p => normalizeProduct(p, productType));
}
