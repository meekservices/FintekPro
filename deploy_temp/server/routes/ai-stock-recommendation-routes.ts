import { Express, Request, Response } from "express";
import { aiStockRecommendationService, StockRecommendationFilters } from "../services/ai-stock-recommendation-service";
import { z } from "zod";
import { db } from "../db";
import { storeCategories } from "@shared/schema";
import { eq, or } from "drizzle-orm";

// Helper to check if Stocks category is enabled for recommendations
async function isStocksCategoryEnabled(): Promise<boolean> {
  try {
    const categories = await db.select()
      .from(storeCategories)
      .where(
        or(
          eq(storeCategories.slug, 'stocks'),
          eq(storeCategories.name, 'Stocks')
        )
      )
      .limit(1);
    
    if (categories.length === 0) return true;
    return categories[0].isEnabled !== false;
  } catch (e) {
    console.warn('[AI Stock] Error checking category status:', e);
    return true;
  }
}

const filtersSchema = z.object({
  sectors: z.array(z.string()).optional(),
  marketCap: z.array(z.string()).optional(),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']).optional(),
  timeHorizon: z.enum(['intraday', 'short_term', 'medium_term', 'long_term']).optional(),
  investmentAmount: z.number().positive().optional(),
  signalTypes: z.array(z.enum(['buy', 'sell', 'hold'])).optional(),
  minFintekproRating: z.number().min(1).max(5).optional(),
  maxResults: z.number().min(1).max(20).optional(),
  includeAIAnalysis: z.boolean().optional()
});

export function registerAIStockRecommendationRoutes(app: Express): void {
  app.post("/api/ai-stock-recommendations/generate", async (req: Request, res: Response) => {
    try {
      // Check if Stocks category is enabled
      const categoryEnabled = await isStocksCategoryEnabled();
      if (!categoryEnabled) {
        return res.json({
          success: true,
          count: 0,
          recommendations: [],
          categoryStatus: 'disabled',
          message: 'Stocks category is currently not available',
          generatedAt: new Date().toISOString()
        });
      }

      const filters = filtersSchema.parse(req.body);
      const recommendations = await aiStockRecommendationService.getSmartRecommendations(filters);
      
      res.json({
        success: true,
        count: recommendations.length,
        generatedAt: new Date().toISOString(),
        filters: {
          sectors: filters.sectors || 'All',
          marketCap: filters.marketCap || 'All',
          riskLevel: filters.riskLevel || 'moderate',
          timeHorizon: filters.timeHorizon || 'medium_term'
        },
        recommendations
      });
    } catch (error: any) {
      console.error('Error generating stock recommendations:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to generate recommendations' 
      });
    }
  });

  app.get("/api/ai-stock-recommendations/quick", async (_req: Request, res: Response) => {
    try {
      const recommendations = await aiStockRecommendationService.getSmartRecommendations({
        maxResults: 5,
        riskLevel: 'moderate',
        timeHorizon: 'medium_term',
        signalTypes: ['buy']
      });
      
      res.json({
        success: true,
        count: recommendations.length,
        recommendations
      });
    } catch (error: any) {
      console.error('Error fetching quick recommendations:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/ai-stock-recommendations/stock/:symbol", async (req: Request, res: Response) => {
    try {
      const { symbol } = req.params;
      const recommendation = await aiStockRecommendationService.getStockById(symbol.toUpperCase());
      
      if (!recommendation) {
        return res.status(404).json({ success: false, error: 'Stock not found' });
      }
      
      res.json({
        success: true,
        recommendation
      });
    } catch (error: any) {
      console.error('Error fetching stock recommendation:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/ai-stock-recommendations/sector/:sector", async (req: Request, res: Response) => {
    try {
      const { sector } = req.params;
      const recommendations = await aiStockRecommendationService.getSectorRecommendations(sector);
      
      res.json({
        success: true,
        sector,
        count: recommendations.length,
        recommendations
      });
    } catch (error: any) {
      console.error('Error fetching sector recommendations:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/ai-stock-recommendations/filters", async (_req: Request, res: Response) => {
    res.json({
      success: true,
      sectors: [
        'Banking', 'IT', 'FMCG', 'Pharma', 'Energy', 'Automobile', 
        'Infrastructure', 'Telecom', 'Metals', 'Consumer', 'Real Estate',
        'Chemicals', 'Cement', 'Power', 'Oil & Gas'
      ],
      marketCaps: ['Large Cap', 'Mid Cap', 'Small Cap'],
      riskLevels: ['conservative', 'moderate', 'aggressive', 'very_aggressive'],
      timeHorizons: ['intraday', 'short_term', 'medium_term', 'long_term'],
      signalTypes: ['buy', 'hold', 'sell']
    });
  });

  app.post("/api/ai-stock-recommendations/clear-cache", async (_req: Request, res: Response) => {
    try {
      aiStockRecommendationService.clearCache();
      res.json({ success: true, message: 'Cache cleared successfully' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log("✅ AI Stock Recommendation routes registered");
}
