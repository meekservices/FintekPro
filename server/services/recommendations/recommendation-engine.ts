import { logger } from "../../utils/logger";
import { getRecommendationsByCategory, RecommendationProductData } from "../recommendation-products-service";

// Hardcoded recommendations used as fallback or baseline
// Organized by asset class and risk profile
const FUND_RECOMMENDATIONS_BY_CATEGORY: any = {
  equity: {
    conservative: [
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '0', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: '0', risk: 'Moderately High' },
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '0', risk: 'Moderate' },
      { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: '0', risk: 'High' },
    ],
    aggressive: [
      { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: '0', risk: 'Very High' },
      { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: '0', risk: 'Very High' },
      { name: 'HDFC Small Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Small Cap', returns1Y: '0', risk: 'Very High' },
    ],
    very_aggressive: [
      { name: 'Quant Multi Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: '0', risk: 'Very High' },
      { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: '0', risk: 'Very High' },
    ]
  },
  debt: {
    conservative: [
      { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Corporate Bond', returns1Y: '0', risk: 'Low' },
    ],
    moderate: [
      { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Corporate Bond', returns1Y: '0', risk: 'Low' },
    ]
  }
};

export class RecommendationEngine {
  /**
   * Finds the best investment products for a given category and risk profile.
   * Merges database recommendations with baseline hardcoded ones.
   */
  async getBestProducts(
    category: string,
    riskProfile: string,
    limit: number = 3
  ): Promise<any[]> {
    try {
      // 1. Try to fetch from database first
      const dbProducts = await getRecommendationsByCategory(category, riskProfile);
      
      if (dbProducts.length > 0) {
        return dbProducts.slice(0, limit);
      }

      // 2. Fallback to hardcoded recommendations
      const fallback = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile] ||
                       (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
      
      return fallback.slice(0, limit);
    } catch (error) {
      logger.error(`[RecommendationEngine] Error fetching products for ${category}/${riskProfile}`, error);
      return [];
    }
  }

  /**
   * Look up a fund name across all catalogs to find its metadata.
   */
  findFundInCatalog(name: string): any | null {
    const searchName = name.toLowerCase();
    for (const assetClass of Object.keys(FUND_RECOMMENDATIONS_BY_CATEGORY)) {
      for (const risk of Object.keys(FUND_RECOMMENDATIONS_BY_CATEGORY[assetClass])) {
        const found = FUND_RECOMMENDATIONS_BY_CATEGORY[assetClass][risk].find(
          (f: any) => f.name.toLowerCase().includes(searchName) || searchName.includes(f.name.toLowerCase())
        );
        if (found) return found;
      }
    }
    return null;
  }
}

export const recommendationEngine = new RecommendationEngine();
