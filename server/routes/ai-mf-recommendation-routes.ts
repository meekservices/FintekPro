import { Router } from "express";
import { aiMFRecommendationService } from "../services/ai-mf-recommendation-service";

const router = Router();

router.get("/api/ai-mf/recommendations", async (req, res) => {
  try {
    const { 
      category, 
      riskLevel, 
      includeGoldSilver, 
      maxFundsPerAMC, 
      minAMCs 
    } = req.query;

    const recommendations = await aiMFRecommendationService.getSmartRecommendations({
      category: category as string,
      riskLevel: riskLevel as string,
      includeGoldSilver: includeGoldSilver !== 'false',
      maxFundsPerAMC: maxFundsPerAMC ? parseInt(maxFundsPerAMC as string) : 2,
      minAMCs: minAMCs ? parseInt(minAMCs as string) : 4,
      onlyTradable: true,
      onlyTopRated: true
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      metadata: {
        filters: { category, riskLevel, includeGoldSilver, maxFundsPerAMC, minAMCs },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Error getting MF recommendations:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate recommendations" 
    });
  }
});

router.get("/api/ai-mf/recommendations/live-nav", async (req, res) => {
  try {
    const { category, riskLevel } = req.query;

    const recommendations = await aiMFRecommendationService.getRecommendationsWithLiveNAV({
      category: category as string,
      riskLevel: riskLevel as string,
      onlyTradable: true,
      onlyTopRated: true
    });

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      metadata: {
        navSource: 'MFAPI',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Error getting MF recommendations with live NAV:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate recommendations" 
    });
  }
});

router.get("/api/ai-mf/exit-recommendations", async (req, res) => {
  try {
    const { holdings } = req.query;
    const userHoldings = holdings ? (holdings as string).split(',') : undefined;

    const recommendations = await aiMFRecommendationService.getExitRecommendations(userHoldings);

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      metadata: {
        type: 'exit',
        reason: 'Underperforming CAGR vs category average',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Error getting exit recommendations:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate exit recommendations" 
    });
  }
});

router.get("/api/ai-mf/commodity-fof", async (req, res) => {
  try {
    const recommendations = await aiMFRecommendationService.getCommodityFOFRecommendations();

    res.json({
      success: true,
      count: recommendations.length,
      recommendations,
      metadata: {
        type: 'commodity_fof',
        includes: ['Gold FOF', 'Silver FOF', 'Commodity Funds'],
        allocationSuggestion: '5-10% of portfolio',
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error("Error getting commodity FOF recommendations:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to generate commodity FOF recommendations" 
    });
  }
});

router.get("/api/ai-mf/nav/:schemeCode", async (req, res) => {
  try {
    const { schemeCode } = req.params;
    const nav = await aiMFRecommendationService.fetchLiveNAV(schemeCode);

    if (nav) {
      res.json({
        success: true,
        schemeCode,
        nav,
        source: 'MFAPI',
        fetchedAt: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: `NAV not found for scheme ${schemeCode}`
      });
    }
  } catch (error: any) {
    console.error("Error fetching NAV:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to fetch NAV" 
    });
  }
});

export function registerAIMFRecommendationRoutes(app: any) {
  app.use(router);
  console.log("✅ AI MF Recommendation routes registered");
}

export default router;
