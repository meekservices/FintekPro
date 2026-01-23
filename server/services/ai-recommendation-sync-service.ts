import { GoogleGenAI } from "@google/genai";
import { db } from "../db";
import { aifMaster, pmsMaster, recommendationProducts } from "@shared/schema";
import { eq, and, desc, isNotNull, or, ilike } from "drizzle-orm";
import { 
  unifiedAIRecommendationEngine, 
  type ProductData, 
  type ProductCategory 
} from "./unified-ai-recommendation-engine";

interface AifPmsData {
  id: string;
  name: string;
  type: "aif" | "pms";
  category?: string;
  strategy?: string;
  style?: string;
  fundHouseName?: string;
  minInvestment?: string;
  return1Y?: string;
  return3Y?: string;
  return5Y?: string;
  riskScore?: number;
  sharpeRatio?: string;
  volatility?: string;
  maxDrawdown?: string;
  aum?: string;
  description?: string;
}

interface AIAnalysisResult {
  riskProfile: "conservative" | "moderate" | "aggressive" | "very_aggressive";
  suitabilityScore: number;
  selectionRationale: string;
  investmentThesis: string;
  sector: string;
}

interface SyncResult {
  product: AifPmsData;
  analysis: AIAnalysisResult;
  synced: boolean;
  skipped?: string;
}

class AIRecommendationSyncService {
  private genAI: GoogleGenAI | null = null;
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({ apiKey });
      this.isInitialized = true;
      console.log("✅ AI Recommendation Sync Service initialized with Gemini");
    } else {
      console.log("⚠️ AI Recommendation Sync Service: No API key, will use rule-based fallback");
    }
  }

  async getTopPerformingAifs(limit: number = 20): Promise<AifPmsData[]> {
    const aifs = await db
      .select()
      .from(aifMaster)
      .where(
        and(
          eq(aifMaster.isPublished, true),
          eq(aifMaster.fundStatus, "active"),
          isNotNull(aifMaster.return1Y)
        )
      )
      .orderBy(desc(aifMaster.return1Y))
      .limit(limit);

    return aifs.map(a => ({
      id: a.id,
      name: a.name,
      type: "aif" as const,
      category: a.category || undefined,
      strategy: a.subcategory || undefined,
      style: a.style || undefined,
      fundHouseName: a.fundHouseName || undefined,
      minInvestment: a.minInvestment || undefined,
      return1Y: a.return1Y || undefined,
      return3Y: a.return3Y || undefined,
      return5Y: a.return5Y || undefined,
      riskScore: a.riskScore || undefined,
      sharpeRatio: a.sharpeRatio || undefined,
      volatility: a.volatility || undefined,
      maxDrawdown: a.maxDrawdown || undefined,
      aum: a.aum || undefined,
      description: a.description || undefined,
    }));
  }

  async getTopPerformingPms(limit: number = 20): Promise<AifPmsData[]> {
    const pms = await db
      .select()
      .from(pmsMaster)
      .where(
        and(
          eq(pmsMaster.isPublished, true),
          eq(pmsMaster.fundStatus, "active"),
          isNotNull(pmsMaster.return1Y)
        )
      )
      .orderBy(desc(pmsMaster.return1Y))
      .limit(limit);

    return pms.map(p => ({
      id: p.id,
      name: p.name,
      type: "pms" as const,
      category: p.strategy || undefined,
      strategy: p.strategy || undefined,
      style: p.style || undefined,
      fundHouseName: p.fundHouseName || undefined,
      minInvestment: p.minInvestment || undefined,
      return1Y: p.return1Y || undefined,
      return3Y: p.return3Y || undefined,
      return5Y: p.return5Y || undefined,
      riskScore: p.riskScore || undefined,
      sharpeRatio: p.sharpeRatio || undefined,
      volatility: p.volatility || undefined,
      maxDrawdown: p.maxDrawdown || undefined,
      aum: p.aum || undefined,
      description: p.description || undefined,
    }));
  }

  private getRuleBasedAnalysis(product: AifPmsData): AIAnalysisResult {
    const return1Y = parseFloat(product.return1Y || "0");
    const riskScore = product.riskScore || 5;
    const volatility = parseFloat(product.volatility || "15");

    let riskProfile: AIAnalysisResult["riskProfile"] = "moderate";
    if (riskScore <= 3 && volatility < 12) {
      riskProfile = "conservative";
    } else if (riskScore <= 5 && volatility < 18) {
      riskProfile = "moderate";
    } else if (riskScore <= 7) {
      riskProfile = "aggressive";
    } else {
      riskProfile = "very_aggressive";
    }

    const suitabilityScore = Math.min(10, Math.max(1, 
      (return1Y > 15 ? 3 : return1Y > 10 ? 2 : 1) +
      (riskScore <= 5 ? 3 : riskScore <= 7 ? 2 : 1) +
      (parseFloat(product.sharpeRatio || "0") > 1 ? 2 : 1) +
      (parseFloat(product.aum || "0") > 100000000 ? 2 : 1)
    ));

    const sector = this.inferSector(product);

    return {
      riskProfile,
      suitabilityScore,
      selectionRationale: `${product.name} offers ${return1Y.toFixed(1)}% 1Y returns with a risk score of ${riskScore}/10. Suitable for ${riskProfile} investors seeking exposure to ${product.type.toUpperCase()} investments.`,
      investmentThesis: `This ${product.style || "diversified"} strategy from ${product.fundHouseName || "a reputed fund house"} provides ${product.category || product.strategy || "multi-asset"} exposure with proven track record.`,
      sector,
    };
  }

  private inferSector(product: AifPmsData): string {
    const name = (product.name + " " + (product.category || "") + " " + (product.strategy || "")).toLowerCase();
    
    if (name.includes("tech") || name.includes("it") || name.includes("digital")) return "Technology";
    if (name.includes("pharma") || name.includes("health")) return "Healthcare";
    if (name.includes("bank") || name.includes("financ")) return "Financial Services";
    if (name.includes("infra")) return "Infrastructure";
    if (name.includes("consum")) return "Consumer";
    if (name.includes("real estate") || name.includes("reit")) return "Real Estate";
    if (name.includes("small") || name.includes("micro")) return "Small Cap";
    if (name.includes("mid")) return "Mid Cap";
    if (name.includes("large") || name.includes("blue")) return "Large Cap";
    if (name.includes("value")) return "Value";
    if (name.includes("growth")) return "Growth";
    if (name.includes("multi")) return "Multi Cap";
    
    return "Diversified";
  }

  async analyzeWithAI(products: AifPmsData[]): Promise<Map<string, AIAnalysisResult>> {
    const results = new Map<string, AIAnalysisResult>();

    if (products.length === 0) {
      return results;
    }

    // Convert AifPmsData to ProductData format for unified engine
    const productDataList: ProductData[] = products.map(p => ({
      id: p.id,
      name: p.name,
      category: (p.type === 'aif' ? 'aif' : 'pms') as ProductCategory,
      fundHouse: p.fundHouseName,
      sector: this.inferSector(p),
      returns1Y: parseFloat(p.return1Y || '0'),
      returns3Y: parseFloat(p.return3Y || '0'),
      returns5Y: parseFloat(p.return5Y || '0'),
      volatility: parseFloat(p.volatility || '15'),
      sharpeRatio: parseFloat(p.sharpeRatio || '0'),
      maxDrawdown: parseFloat(p.maxDrawdown || '0'),
      aum: parseFloat(p.aum || '0'),
      minInvestment: parseFloat(p.minInvestment || '0'),
      kycRequirement: p.type === 'aif' ? 'accredited' : 'enhanced',
      rawData: p,
    }));

    // Use unified AI recommendation engine for analysis (includes caching, tracking, compliance)
    const batchSize = 5;
    for (let i = 0; i < productDataList.length; i += batchSize) {
      const batch = productDataList.slice(i, i + batchSize);
      
      for (const productData of batch) {
        try {
          const analysis = await unifiedAIRecommendationEngine.analyzeProduct(productData);
          
          // Convert unified engine result to AIAnalysisResult format
          results.set(productData.id, {
            riskProfile: analysis.riskProfile,
            suitabilityScore: Math.round(analysis.suitabilityScore / 10), // Convert 0-100 to 1-10
            selectionRationale: analysis.selectionRationale,
            investmentThesis: analysis.investmentThesis,
            sector: productData.sector || 'Diversified',
          });
          
          console.log(`[AI Sync] Analyzed ${productData.name} via unified engine (cache: ${analysis.cacheHit}, model: ${analysis.modelUsed})`);
        } catch (error) {
          console.error(`[AI Sync] Unified engine analysis failed for ${productData.name}:`, error);
          // Fallback to rule-based analysis
          const originalProduct = products.find(p => p.id === productData.id);
          if (originalProduct) {
            results.set(productData.id, this.getRuleBasedAnalysis(originalProduct));
          }
        }
      }

      // Rate limiting between batches
      if (i + batchSize < productDataList.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return results;
  }

  private buildAnalysisPrompt(products: AifPmsData[]): string {
    const productsList = products.map((p, idx) => `
${idx + 1}. ID: ${p.id}
   Name: ${p.name}
   Type: ${p.type.toUpperCase()}
   Category: ${p.category || p.strategy || "General"}
   Style: ${p.style || "Blend"}
   Fund House: ${p.fundHouseName || "Unknown"}
   Min Investment: ₹${parseFloat(p.minInvestment || "0").toLocaleString("en-IN")}
   1Y Return: ${p.return1Y || "N/A"}%
   3Y Return: ${p.return3Y || "N/A"}%
   Risk Score: ${p.riskScore || "N/A"}/10
   Sharpe Ratio: ${p.sharpeRatio || "N/A"}
   Volatility: ${p.volatility || "N/A"}%
   Max Drawdown: ${p.maxDrawdown || "N/A"}%
   AUM: ₹${parseFloat(p.aum || "0").toLocaleString("en-IN")}
`).join("\n");

    return `You are a SEBI-registered investment advisor analyzing Alternative Investment Funds (AIFs) and Portfolio Management Services (PMS) for investor recommendations.

Analyze each fund below and provide structured recommendations:

${productsList}

For EACH fund, provide analysis in this EXACT JSON format (array of objects):
[
  {
    "id": "fund_id_here",
    "riskProfile": "conservative|moderate|aggressive|very_aggressive",
    "suitabilityScore": 1-10,
    "selectionRationale": "2-3 sentence explanation of why this fund is selected and for whom",
    "investmentThesis": "Key investment thesis and strengths in 2 sentences",
    "sector": "Primary sector focus (e.g., Technology, Healthcare, Multi Cap, Value, Growth)"
  }
]

Guidelines:
- Conservative: Low volatility (<12%), stable returns, large-cap focus, risk score 1-3
- Moderate: Balanced risk-return, multi-cap, risk score 4-5
- Aggressive: Higher volatility, mid/small cap focus, risk score 6-7
- Very Aggressive: High risk, concentrated bets, emerging sectors, risk score 8-10

Respond ONLY with the JSON array, no other text.`;
  }

  private parseAIResponse(response: string, products: AifPmsData[]): Map<string, AIAnalysisResult> {
    const results = new Map<string, AIAnalysisResult>();

    try {
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in response");
      }

      const analyses = JSON.parse(jsonMatch[0]);
      
      for (const analysis of analyses) {
        if (analysis.id && analysis.riskProfile) {
          results.set(analysis.id, {
            riskProfile: analysis.riskProfile as AIAnalysisResult["riskProfile"],
            suitabilityScore: Math.min(10, Math.max(1, analysis.suitabilityScore || 5)),
            selectionRationale: analysis.selectionRationale || "",
            investmentThesis: analysis.investmentThesis || "",
            sector: analysis.sector || "Diversified",
          });
        }
      }
    } catch (error) {
      console.error("[AI Sync] Failed to parse AI response:", error);
    }

    for (const product of products) {
      if (!results.has(product.id)) {
        results.set(product.id, this.getRuleBasedAnalysis(product));
      }
    }

    return results;
  }

  async previewSync(aifLimit: number = 15, pmsLimit: number = 15): Promise<{
    aifs: SyncResult[];
    pms: SyncResult[];
    summary: {
      totalAifs: number;
      totalPms: number;
      newAifs: number;
      newPms: number;
      existingAifs: number;
      existingPms: number;
    };
  }> {
    console.log(`[AI Sync] Starting preview: ${aifLimit} AIFs, ${pmsLimit} PMS`);

    const [topAifs, topPms] = await Promise.all([
      this.getTopPerformingAifs(aifLimit),
      this.getTopPerformingPms(pmsLimit),
    ]);

    const existing = await db
      .select({ productId: recommendationProducts.productId, productType: recommendationProducts.productType })
      .from(recommendationProducts)
      .where(
        or(
          eq(recommendationProducts.productType, "aif"),
          eq(recommendationProducts.productType, "pms")
        )
      );

    const existingIds = new Set(existing.map(e => `${e.productType}:${e.productId}`));

    const allProducts = [...topAifs, ...topPms];
    const analyses = await this.analyzeWithAI(allProducts);

    const aifResults: SyncResult[] = topAifs.map(aif => {
      const isDuplicate = existingIds.has(`aif:${aif.id}`);
      return {
        product: aif,
        analysis: analyses.get(aif.id) || this.getRuleBasedAnalysis(aif),
        synced: false,
        skipped: isDuplicate ? "Already exists in recommendations" : undefined,
      };
    });

    const pmsResults: SyncResult[] = topPms.map(pms => {
      const isDuplicate = existingIds.has(`pms:${pms.id}`);
      return {
        product: pms,
        analysis: analyses.get(pms.id) || this.getRuleBasedAnalysis(pms),
        synced: false,
        skipped: isDuplicate ? "Already exists in recommendations" : undefined,
      };
    });

    const newAifs = aifResults.filter(r => !r.skipped).length;
    const newPms = pmsResults.filter(r => !r.skipped).length;

    console.log(`[AI Sync] Preview complete: ${newAifs} new AIFs, ${newPms} new PMS`);

    return {
      aifs: aifResults,
      pms: pmsResults,
      summary: {
        totalAifs: topAifs.length,
        totalPms: topPms.length,
        newAifs,
        newPms,
        existingAifs: aifResults.filter(r => r.skipped).length,
        existingPms: pmsResults.filter(r => r.skipped).length,
      },
    };
  }

  async executeSync(aifLimit: number = 15, pmsLimit: number = 15): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
    results: SyncResult[];
  }> {
    console.log(`[AI Sync] Starting sync: ${aifLimit} AIFs, ${pmsLimit} PMS`);

    const preview = await this.previewSync(aifLimit, pmsLimit);
    const allResults = [...preview.aifs, ...preview.pms];
    const toSync = allResults.filter(r => !r.skipped);

    if (toSync.length === 0) {
      console.log("[AI Sync] No new products to sync");
      return {
        imported: 0,
        skipped: allResults.filter(r => r.skipped).length,
        errors: [],
        results: allResults,
      };
    }

    const errors: string[] = [];
    let imported = 0;

    for (const item of toSync) {
      try {
        await db.insert(recommendationProducts).values({
          productType: item.product.type,
          productId: item.product.id,
          name: item.product.name,
          amc: item.product.fundHouseName || null,
          category: item.product.category || item.product.strategy || null,
          sector: item.analysis.sector,
          riskProfile: item.analysis.riskProfile,
          returns1Y: item.product.return1Y || null,
          returns3Y: item.product.return3Y || null,
          returns5Y: item.product.return5Y || null,
          riskLevel: item.product.riskScore ? 
            (item.product.riskScore <= 3 ? "Low" : item.product.riskScore <= 6 ? "Moderate" : "High") : "Moderate",
          minimumInvestment: item.product.minInvestment || null,
          requiresEnhancedKYC: true,
          selectionRationale: item.analysis.selectionRationale,
          investmentThesis: item.analysis.investmentThesis,
          priority: item.analysis.suitabilityScore,
          isActive: true,
        });
        
        item.synced = true;
        imported++;
      } catch (error: any) {
        console.error(`[AI Sync] Failed to sync ${item.product.name}:`, error.message);
        errors.push(`${item.product.name}: ${error.message}`);
        item.skipped = `Sync failed: ${error.message}`;
      }
    }

    console.log(`[AI Sync] Completed: ${imported} imported, ${preview.summary.existingAifs + preview.summary.existingPms} skipped, ${errors.length} errors`);

    return {
      imported,
      skipped: allResults.filter(r => r.skipped).length,
      errors,
      results: allResults,
    };
  }
}

export const aiRecommendationSyncService = new AIRecommendationSyncService();
