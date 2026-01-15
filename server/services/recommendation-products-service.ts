import { db } from "../db";
import { recommendationProducts } from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";

// Cache for recommendation products
let recommendationCache: Map<string, any[]> = new Map();
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function invalidateRecommendationCache() {
  recommendationCache.clear();
  cacheTimestamp = 0;
}

export interface RecommendationProductData {
  name: string;
  amc: string;
  category: string;
  sector?: string;
  returns1Y: string;
  returns3Y: string;
  returns5Y?: string;
  risk: string;
  productType: string;
  ticker?: string;
  symbol?: string;
  minInvestment?: number;
  requiresEnhancedKYC?: boolean;
  dividendYield?: string;
  currentPrice?: number;
  peRatio?: number;
  selectionRationale?: string;
  investmentThesis?: string;
}

export async function getRecommendationsByCategory(
  productType: string,
  riskProfile: string
): Promise<RecommendationProductData[]> {
  const cacheKey = `${productType}_${riskProfile}`;
  
  // Check cache
  if (Date.now() - cacheTimestamp < CACHE_TTL && recommendationCache.has(cacheKey)) {
    return recommendationCache.get(cacheKey) || [];
  }
  
  try {
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(
        and(
          eq(recommendationProducts.productType, productType),
          eq(recommendationProducts.riskProfile, riskProfile),
          eq(recommendationProducts.isActive, true)
        )
      )
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    // Transform to recommendation format
    const transformed = products.map(p => ({
      name: p.name,
      amc: p.amc || "NSE/BSE",
      category: p.category || `${productType} - ${p.sector || "General"}`,
      sector: p.sector,
      returns1Y: p.returns1Y || "0",
      returns3Y: p.returns3Y || "0",
      returns5Y: p.returns5Y,
      risk: p.riskLevel || "Moderate",
      productType: p.productType,
      ticker: p.symbol,
      symbol: p.symbol,
      minInvestment: p.minimumInvestment ? parseFloat(p.minimumInvestment) : undefined,
      requiresEnhancedKYC: p.requiresEnhancedKYC,
      dividendYield: p.dividendYield,
      currentPrice: p.currentPrice ? parseFloat(p.currentPrice) : undefined,
      peRatio: p.peRatio ? parseFloat(p.peRatio) : undefined,
      selectionRationale: p.selectionRationale,
      investmentThesis: p.investmentThesis,
    }));
    
    // Update cache
    recommendationCache.set(cacheKey, transformed);
    cacheTimestamp = Date.now();
    
    return transformed;
  } catch (error) {
    console.error(`[RecommendationProductsService] Error fetching ${productType}/${riskProfile}:`, error);
    return [];
  }
}

export async function getAllActiveRecommendations(): Promise<Record<string, Record<string, RecommendationProductData[]>>> {
  const cacheKey = "all_active";
  
  // Check cache
  if (Date.now() - cacheTimestamp < CACHE_TTL && recommendationCache.has(cacheKey)) {
    return recommendationCache.get(cacheKey) as any || {};
  }
  
  try {
    const products = await db
      .select()
      .from(recommendationProducts)
      .where(eq(recommendationProducts.isActive, true))
      .orderBy(desc(recommendationProducts.priority), asc(recommendationProducts.name));
    
    // Group by productType and riskProfile
    const grouped: Record<string, Record<string, RecommendationProductData[]>> = {};
    
    products.forEach(p => {
      if (!grouped[p.productType]) {
        grouped[p.productType] = {};
      }
      if (!grouped[p.productType][p.riskProfile]) {
        grouped[p.productType][p.riskProfile] = [];
      }
      
      grouped[p.productType][p.riskProfile].push({
        name: p.name,
        amc: p.amc || "NSE/BSE",
        category: p.category || `${p.productType} - ${p.sector || "General"}`,
        sector: p.sector,
        returns1Y: p.returns1Y || "0",
        returns3Y: p.returns3Y || "0",
        returns5Y: p.returns5Y,
        risk: p.riskLevel || "Moderate",
        productType: p.productType,
        ticker: p.symbol,
        symbol: p.symbol,
        minInvestment: p.minimumInvestment ? parseFloat(p.minimumInvestment) : undefined,
        requiresEnhancedKYC: p.requiresEnhancedKYC,
        dividendYield: p.dividendYield,
        currentPrice: p.currentPrice ? parseFloat(p.currentPrice) : undefined,
        peRatio: p.peRatio ? parseFloat(p.peRatio) : undefined,
        selectionRationale: p.selectionRationale,
        investmentThesis: p.investmentThesis,
      });
    });
    
    // Update cache
    recommendationCache.set(cacheKey, grouped as any);
    cacheTimestamp = Date.now();
    
    return grouped;
  } catch (error) {
    console.error("[RecommendationProductsService] Error fetching all active:", error);
    return {};
  }
}

// Helper to check if database has recommendations for a category
export async function hasRecommendationsInDatabase(
  productType: string,
  riskProfile: string
): Promise<boolean> {
  try {
    const products = await getRecommendationsByCategory(productType, riskProfile);
    return products.length > 0;
  } catch {
    return false;
  }
}

console.log("✅ Recommendation Products Service initialized");
