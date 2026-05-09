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

// Rationale Template Engine - generates contextual rationales for recommendations
export interface RecommendationRationale {
  summary: string;
  whyRecommended: string;
  riskConsideration: string;
  suitabilityNote: string;
}

const PRODUCT_TYPE_DESCRIPTIONS: Record<string, string> = {
  listed_stock: "Listed equity",
  unlisted_stock: "Pre-IPO/Unlisted equity",
  reit: "Real Estate Investment Trust",
  invit: "Infrastructure Investment Trust",
};

const RISK_PROFILE_DESCRIPTIONS: Record<string, string> = {
  conservative: "stability-focused with capital preservation priority",
  moderate: "balanced growth with controlled risk exposure",
  aggressive: "high-growth oriented with higher risk tolerance",
  very_aggressive: "maximum growth seeking with significant risk appetite",
};

export function generateRecommendationRationale(
  product: RecommendationProductData,
  clientRiskProfile: string
): RecommendationRationale {
  const productTypeDesc = PRODUCT_TYPE_DESCRIPTIONS[product.productType] || product.productType;
  const riskDesc = RISK_PROFILE_DESCRIPTIONS[clientRiskProfile] || "balanced";
  
  // Use stored rationale if available
  const summary = product.selectionRationale || 
    `${product.name} is a ${productTypeDesc} offering with ${product.returns1Y}% expected 1Y returns.`;
  
  const whyRecommended = product.investmentThesis ||
    `Selected for ${clientRiskProfile} investors based on risk-adjusted return potential. ` +
    `This ${productTypeDesc.toLowerCase()} aligns with your investment goals and time horizon.`;
  
  // Generate risk consideration based on product type
  let riskConsideration: string;
  switch (product.productType) {
    case "listed_stock":
      riskConsideration = "Subject to market volatility and company-specific risks. Diversification recommended.";
      break;
    case "unlisted_stock":
      riskConsideration = "Pre-IPO investments have limited liquidity and longer lock-in periods. Suitable for patient capital.";
      break;
    case "reit":
      riskConsideration = "Real estate market exposure with potential interest rate sensitivity. Dividend distributions may vary.";
      break;
    case "invit":
      riskConsideration = "Infrastructure assets with regulatory oversight. Returns linked to underlying project performance.";
      break;
    default:
      riskConsideration = "Standard market risks apply. Please review the product documentation.";
  }
  
  // Suitability note based on alignment
  const suitabilityNote = product.requiresEnhancedKYC
    ? `Requires Enhanced KYC verification. This ${productTypeDesc.toLowerCase()} is suited for ${riskDesc} investors.`
    : `Suitable for investors seeking ${riskDesc} exposure through ${productTypeDesc.toLowerCase()}.`;
  
  return {
    summary,
    whyRecommended,
    riskConsideration,
    suitabilityNote,
  };
}

// Format full rationale for display
export function formatRecommendationRationale(
  product: RecommendationProductData,
  clientRiskProfile: string
): string {
  const rationale = generateRecommendationRationale(product, clientRiskProfile);
  
  return [
    `**Why ${product.name}?**`,
    rationale.summary,
    "",
    `**Investment Thesis:**`,
    rationale.whyRecommended,
    "",
    `**Risk Considerations:**`,
    rationale.riskConsideration,
    "",
    `**Suitability:**`,
    rationale.suitabilityNote,
  ].join("\n");
}

console.log("✅ Recommendation Products Service initialized");
