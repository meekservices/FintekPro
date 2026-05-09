import { DatabaseStorage } from '../storage';
import type { UnlistedCompany, CompanyFinancials, CompanyRatios, UnlistedDeal, SellListing, UnlistedPriceHistory } from '@shared/schema';

export interface PriceSuggestion {
  companyId: string;
  suggestedPrice: number;
  minPrice: number;
  maxPrice: number;
  confidence: 'high' | 'medium' | 'low';
  methodology: string;
  factors: {
    fundamentalValue?: number;
    marketValue?: number;
    dealHistoryValue?: number;
    sellerFeedValue?: number;
  };
  rationale: string[];
  lastUpdated: Date;
}

export interface ValuationFactors {
  fundamentalScore: number;  // Based on ratios
  liquidityScore: number;     // Based on deal volume
  marketSentiment: number;    // Based on listing trends
  confidence: number;         // Overall confidence (0-1)
}

export class PriceSuggestionService {
  private storage: DatabaseStorage;

  constructor(storage: DatabaseStorage) {
    this.storage = storage;
  }

  /**
   * Calculate suggested price for a company using multiple methodologies
   */
  async calculateSuggestedPrice(companyId: string): Promise<PriceSuggestion> {
    const company = await this.storage.getUnlistedCompanyById(companyId);
    if (!company) {
      throw new Error('Company not found');
    }

    const [financials, ratios, dealHistory, sellListings, priceHistory] = await Promise.all([
      this.storage.getCompanyFinancials(companyId),
      this.storage.getCompanyRatios(companyId),
      this.getRecentDeals(companyId),
      this.getActiveSellListings(companyId),
      this.storage.getPriceHistory(companyId, 50),
    ]);

    const latestFinancials = financials[0];
    const latestRatios = ratios[0];

    const factors: PriceSuggestion['factors'] = {};
    const rationale: string[] = [];
    const valuationFactors = this.calculateValuationFactors(latestRatios, dealHistory, sellListings);

    // 1. Fundamental Value (Based on financial ratios)
    if (latestFinancials && latestRatios) {
      const fundamentalValue = this.calculateFundamentalValue(latestFinancials, latestRatios);
      factors.fundamentalValue = fundamentalValue;
      const peRatio = Number(latestRatios.peRatio);
      const pbRatio = Number(latestRatios.pbRatio);
      const roe = Number(latestRatios.roe);
      
      // Add data source attribution for MCA/CredHive enriched data
      const dataSource = (latestFinancials.dataSource || '').toLowerCase().trim();
      const sourceLabel = dataSource.includes('credhive') ? ' (MCA via CredHive)' : 
                          dataSource.includes('mca') ? ' (MCA Registry)' : 
                          dataSource ? ` (${latestFinancials.dataSource})` : '';
      const confidenceScore = parseFloat(String(latestFinancials.confidenceScore || '0'));
      const confidenceNote = confidenceScore >= 0.9 ? ' [High Confidence]' : '';
      
      rationale.push(`Fundamental valuation: ₹${fundamentalValue.toLocaleString('en-IN')} based on P/E ${peRatio?.toFixed(2)}, P/B ${pbRatio?.toFixed(2)}, ROE ${roe?.toFixed(2)}%${sourceLabel}${confidenceNote}`);
    }

    // 2. Deal History Value (Recent transaction prices)
    if (dealHistory.length > 0) {
      const dealHistoryValue = this.calculateDealHistoryValue(dealHistory);
      factors.dealHistoryValue = dealHistoryValue;
      rationale.push(`Recent deals average: ₹${dealHistoryValue.toLocaleString('en-IN')} from ${dealHistory.length} transactions`);
    }

    // 3. Market Value (Current sell listing prices)
    if (sellListings.length > 0) {
      const marketValue = this.calculateMarketValue(sellListings);
      factors.marketValue = marketValue;
      rationale.push(`Market listings average: ₹${marketValue.toLocaleString('en-IN')} from ${sellListings.length} active sellers`);
    }

    // 4. Seller Feed Value (Price history from seller feeds)
    if (priceHistory.length > 0) {
      const sellerFeedValue = this.calculateSellerFeedValue(priceHistory);
      factors.sellerFeedValue = sellerFeedValue;
      rationale.push(`Price history indicates: ₹${sellerFeedValue.toLocaleString('en-IN')} from recent data points`);
    }

    // Weighted average calculation
    let { suggestedPrice, minPrice, maxPrice, confidence, methodology } = this.calculateWeightedPrice(
      factors,
      valuationFactors
    );

    // Apply risk adjustment discount if CredHive data shows high risk
    const riskDiscount = this.calculateRiskDiscount(latestFinancials, latestRatios);
    if (riskDiscount > 0) {
      const discountMultiplier = 1 - riskDiscount;
      suggestedPrice = Math.round(suggestedPrice * discountMultiplier);
      minPrice = Math.round(minPrice * discountMultiplier);
      maxPrice = Math.round(maxPrice * discountMultiplier);
      
      rationale.push(`Risk discount applied: ${(riskDiscount * 100).toFixed(0)}% due to high Debt/Equity or negative Networth`);
    }

    return {
      companyId,
      suggestedPrice,
      minPrice,
      maxPrice,
      confidence,
      methodology,
      factors,
      rationale,
      lastUpdated: new Date(),
    };
  }

  /**
   * Calculate risk discount based on CredHive financial health indicators
   * Returns 0.10 (10%) if Debt/Equity > 2 OR Networth < 0, otherwise 0
   */
  private calculateRiskDiscount(
    financials: CompanyFinancials | undefined,
    ratios: CompanyRatios | undefined
  ): number {
    const RISK_DISCOUNT_RATE = 0.10; // 10% discount

    // Check networth from financials
    if (financials) {
      const networth = Number(financials.networth);
      if (networth < 0) {
        return RISK_DISCOUNT_RATE;
      }
    }

    // Check debt-to-equity ratio
    if (ratios) {
      const debtEquity = Number(ratios.debtEquity);
      if (debtEquity > 2) {
        return RISK_DISCOUNT_RATE;
      }
    }

    return 0; // No risk discount
  }

  /**
   * Calculate fundamental value based on financial metrics
   */
  private calculateFundamentalValue(financials: CompanyFinancials, ratios: CompanyRatios): number {
    // Use P/E ratio and net profit for base valuation
    const netProfit = Number(financials.netProfit) || 0;
    const networth = Number(financials.networth) || 1;
    const peRatio = Number(ratios.peRatio) || 15; // Default industry average
    const pbRatio = Number(ratios.pbRatio) || 2;  // Default industry average

    // Calculate earnings per share (assuming 100 as base)
    const baseEPS = netProfit / 100000; // Simplified
    
    // Calculate book value per share
    const baseBookValue = networth / 100000; // Simplified

    // Weighted average of P/E and P/B based valuations
    const peBasedValue = baseEPS * peRatio;
    const pbBasedValue = baseBookValue * pbRatio;

    // Apply ROE multiplier for quality adjustment
    const roe = Number(ratios.roe);
    const roeMultiplier = roe ? Math.min(1 + (roe / 100), 1.5) : 1;

    return Math.round((peBasedValue * 0.6 + pbBasedValue * 0.4) * roeMultiplier);
  }

  /**
   * Calculate value based on recent deal history
   */
  private calculateDealHistoryValue(deals: UnlistedDeal[]): number {
    if (deals.length === 0) return 0;

    // Weight recent deals more heavily
    const now = new Date().getTime();
    const weightedSum = deals.reduce((sum: number, deal: UnlistedDeal, index: number) => {
      const dealTime = new Date(deal.createdAt || new Date()).getTime();
      const daysSinceDeal = (now - dealTime) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(0.5, 1 - (daysSinceDeal / 180)); // Decay over 180 days
      const volumeWeight = Math.log10(deal.quantity + 1) / 10; // Logarithmic volume weight
      const agreedPrice = Number(deal.agreedPrice);
      
      return sum + (agreedPrice * (recencyWeight + volumeWeight));
    }, 0);

    const totalWeight = deals.reduce((sum: number, deal: UnlistedDeal, index: number) => {
      const dealTime = new Date(deal.createdAt || new Date()).getTime();
      const daysSinceDeal = (now - dealTime) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(0.5, 1 - (daysSinceDeal / 180));
      const volumeWeight = Math.log10(deal.quantity + 1) / 10;
      
      return sum + (recencyWeight + volumeWeight);
    }, 0);

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Calculate value based on active sell listings
   */
  private calculateMarketValue(listings: SellListing[]): number {
    if (listings.length === 0) return 0;

    // Use landing price as primary indicator (where deals typically happen)
    const landingPrices = listings
      .map((l: SellListing) => Number(l.landingPrice))
      .filter((p: number) => p > 0);

    if (landingPrices.length === 0) {
      // Fallback to ask price
      const askPrices = listings
        .map((l: SellListing) => Number(l.askPrice))
        .filter((p: number) => p > 0);
      return askPrices.length > 0 ? Math.round(askPrices.reduce((a: number, b: number) => a + b) / askPrices.length) : 0;
    }

    // Calculate weighted average based on quantity
    const weightedSum = listings.reduce((sum: number, listing: SellListing) => {
      const price = Number(listing.landingPrice);
      const weight = Math.log10(listing.quantity + 1); // Logarithmic weight
      return sum + (price * weight);
    }, 0);

    const totalWeight = listings.reduce((sum: number, listing: SellListing) => {
      return sum + Math.log10(listing.quantity + 1);
    }, 0);

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Calculate value based on price history from seller feeds
   */
  private calculateSellerFeedValue(priceHistory: UnlistedPriceHistory[]): number {
    if (priceHistory.length === 0) return 0;

    // Recent prices are more relevant
    const recentPrices = priceHistory.slice(0, 10);
    
    const weightedSum = recentPrices.reduce((sum: number, record: UnlistedPriceHistory, index: number) => {
      const recencyWeight = 1 - (index / recentPrices.length * 0.5); // Decay from 1.0 to 0.5
      const price = Number(record.price);
      return sum + (price * recencyWeight);
    }, 0);

    const totalWeight = recentPrices.reduce((sum: number, _: UnlistedPriceHistory, index: number) => {
      return sum + (1 - (index / recentPrices.length * 0.5));
    }, 0);

    return Math.round(weightedSum / totalWeight);
  }

  /**
   * Calculate valuation factors for confidence scoring
   */
  private calculateValuationFactors(
    ratios: CompanyRatios | undefined,
    deals: UnlistedDeal[],
    listings: SellListing[]
  ): ValuationFactors {
    let fundamentalScore = 0;
    let liquidityScore = 0;
    let marketSentiment = 0;

    // Fundamental score (based on quality of ratios)
    if (ratios) {
      const roe = Number(ratios.roe);
      const peRatio = Number(ratios.peRatio);
      const debtEquity = Number(ratios.debtEquity);
      const currentRatio = Number(ratios.currentRatio);
      
      if (roe && roe > 15) fundamentalScore += 0.3;
      if (peRatio && peRatio > 0 && peRatio < 30) fundamentalScore += 0.3;
      if (debtEquity && debtEquity < 1) fundamentalScore += 0.2;
      if (currentRatio && currentRatio > 1.5) fundamentalScore += 0.2;
    }

    // Liquidity score (based on deal frequency)
    const recentDeals = deals.filter((d: UnlistedDeal) => {
      const daysSince = (Date.now() - new Date(d.createdAt || new Date()).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince <= 90;
    });
    liquidityScore = Math.min(1, recentDeals.length / 5); // Max at 5 deals in 90 days

    // Market sentiment (based on active listings)
    const activeListings = listings.filter((l: SellListing) => new Date(l.validUntil || new Date()) > new Date());
    marketSentiment = Math.min(1, activeListings.length / 3); // Max at 3 active listings

    const confidence = (fundamentalScore + liquidityScore + marketSentiment) / 3;

    return {
      fundamentalScore,
      liquidityScore,
      marketSentiment,
      confidence,
    };
  }

  /**
   * Calculate weighted price using exact formula:
   * Landing_Price(35%) + Recent_Deal_Price(30%) + Market_Feed_Price(20%) + Intrinsic_Value(15%)
   */
  private calculateWeightedPrice(
    factors: PriceSuggestion['factors'],
    valuationFactors: ValuationFactors
  ): {
    suggestedPrice: number;
    minPrice: number;
    maxPrice: number;
    confidence: 'high' | 'medium' | 'low';
    methodology: string;
  } {
    // Fixed weights as per specification
    const LANDING_PRICE_WEIGHT = 0.35;      // Seller feed (marketValue)
    const RECENT_DEAL_WEIGHT = 0.30;        // Deal history
    const MARKET_FEED_WEIGHT = 0.20;        // Price history (sellerFeedValue)
    const INTRINSIC_VALUE_WEIGHT = 0.15;    // CredHive fundamentals

    let totalWeightedPrice = 0;
    let actualTotalWeight = 0;
    const components: string[] = [];

    // Landing Price (35%) - from active sell listings
    if (factors.marketValue && factors.marketValue > 0) {
      totalWeightedPrice += factors.marketValue * LANDING_PRICE_WEIGHT;
      actualTotalWeight += LANDING_PRICE_WEIGHT;
      components.push(`Landing(35%)`);
    }

    // Recent Deal Price (30%) - from deal history
    if (factors.dealHistoryValue && factors.dealHistoryValue > 0) {
      totalWeightedPrice += factors.dealHistoryValue * RECENT_DEAL_WEIGHT;
      actualTotalWeight += RECENT_DEAL_WEIGHT;
      components.push(`Deals(30%)`);
    }

    // Market Feed Price (20%) - from price history
    if (factors.sellerFeedValue && factors.sellerFeedValue > 0) {
      totalWeightedPrice += factors.sellerFeedValue * MARKET_FEED_WEIGHT;
      actualTotalWeight += MARKET_FEED_WEIGHT;
      components.push(`Feed(20%)`);
    }

    // Intrinsic Value (15%) - from CredHive financials
    if (factors.fundamentalValue && factors.fundamentalValue > 0) {
      totalWeightedPrice += factors.fundamentalValue * INTRINSIC_VALUE_WEIGHT;
      actualTotalWeight += INTRINSIC_VALUE_WEIGHT;
      components.push(`Intrinsic(15%)`);
    }

    if (actualTotalWeight === 0) {
      throw new Error('Insufficient data to calculate price suggestion');
    }

    // Normalize if not all components are available
    const suggestedPrice = Math.round(totalWeightedPrice / actualTotalWeight);

    // Calculate confidence bands based on data availability and quality
    const priceValues = [
      factors.marketValue,
      factors.dealHistoryValue,
      factors.sellerFeedValue,
      factors.fundamentalValue
    ].filter((v): v is number => v !== undefined && v > 0);

    const priceVariance = this.calculateVariance(priceValues);
    const coefficientOfVariation = priceValues.length > 0 ? Math.sqrt(priceVariance) / suggestedPrice : 1;
    const dataCompleteness = actualTotalWeight / 1.0; // How many of the 4 components we have

    let confidence: 'high' | 'medium' | 'low';
    let bandWidth: number;

    if (dataCompleteness >= 0.85 && valuationFactors.confidence > 0.6 && coefficientOfVariation < 0.15) {
      confidence = 'high';
      bandWidth = 0.1; // ±10%
    } else if (dataCompleteness >= 0.6 && valuationFactors.confidence > 0.4 && coefficientOfVariation < 0.3) {
      confidence = 'medium';
      bandWidth = 0.2; // ±20%
    } else {
      confidence = 'low';
      bandWidth = 0.3; // ±30%
    }

    const minPrice = Math.round(suggestedPrice * (1 - bandWidth));
    const maxPrice = Math.round(suggestedPrice * (1 + bandWidth));

    const methodology = components.join(' + ');

    return {
      suggestedPrice,
      minPrice,
      maxPrice,
      confidence,
      methodology,
    };
  }

  /**
   * Calculate statistical variance
   */
  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a: number, b: number) => a + b, 0) / values.length;
    return values.reduce((sum: number, value: number) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }

  /**
   * Get recent deals for a company
   */
  private async getRecentDeals(companyId: string): Promise<UnlistedDeal[]> {
    const allDeals = await this.storage.getUnlistedDealsByCompany(companyId);
    
    // Filter deals from last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return allDeals
      .filter((d: UnlistedDeal) => new Date(d.createdAt || new Date()) >= sixMonthsAgo)
      .sort((a: UnlistedDeal, b: UnlistedDeal) => new Date(b.createdAt || new Date()).getTime() - new Date(a.createdAt || new Date()).getTime());
  }

  /**
   * Get active sell listings for a company
   */
  private async getActiveSellListings(companyId: string): Promise<SellListing[]> {
    const allListings = await this.storage.getSellListingsByCompany(companyId);
    
    const now = new Date();
    return allListings.filter((listing: SellListing) => {
      return listing.status === 'active' && new Date(listing.validUntil || new Date()) > now;
    });
  }

  /**
   * Batch calculate suggestions for multiple companies
   */
  async calculateBatchSuggestions(companyIds: string[]): Promise<PriceSuggestion[]> {
    const suggestions = await Promise.all(
      companyIds.map(async (companyId: string) => {
        try {
          return await this.calculateSuggestedPrice(companyId);
        } catch (error) {
          console.error(`Failed to calculate price for company ${companyId}:`, error);
          return null;
        }
      })
    );

    return suggestions.filter((s: PriceSuggestion | null): s is PriceSuggestion => s !== null);
  }
}
