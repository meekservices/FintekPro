import { Router, Request, Response } from "express";
import { overlapIntelligenceEngine } from "../services/overlap-intelligence-engine";
import { z } from "zod";

const router = Router();

const portfolioFundSchema = z.object({
  mfIsin: z.string(),
  name: z.string(),
  portfolioWeight: z.number(),
  currentValue: z.number().optional(),
  category: z.string().optional(),
  expenseRatio: z.number().optional(),
  sharpeRatio: z.number().optional(),
});

const portfolioSchema = z.object({
  funds: z.array(portfolioFundSchema),
});

const changeSchema = z.object({
  action: z.enum(["ADD", "REMOVE", "REPLACE"]),
  fundIsin: z.string(),
  replacementIsin: z.string().optional(),
  newWeight: z.number().optional(),
});

/**
 * POST /api/portfolio/intelligence
 * Full portfolio intelligence analysis
 */
router.post("/intelligence", async (req: Request, res: Response) => {
  try {
    const { funds } = portfolioSchema.parse(req.body);
    const result = await overlapIntelligenceEngine.analyzePortfolioIntelligence(funds);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[OverlapIntelligence] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio/diversification-score
 * Calculate diversification score with penalties
 */
router.post("/diversification-score", async (req: Request, res: Response) => {
  try {
    const { funds } = portfolioSchema.parse(req.body);
    const result = await overlapIntelligenceEngine.calculateDiversificationScore(funds);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[DiversificationScore] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio/overlap-risk
 * Check overlap risk for a candidate fund
 */
router.post("/overlap-risk", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      candidateFundIsin: z.string(),
      existingPortfolio: z.array(portfolioFundSchema),
    });
    const { candidateFundIsin, existingPortfolio } = schema.parse(req.body);
    const result = await overlapIntelligenceEngine.calculateOverlapRiskScore(
      candidateFundIsin,
      existingPortfolio
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[OverlapRisk] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio/replace-suggestions
 * Get replacement suggestions for redundant funds
 */
router.post("/replace-suggestions", async (req: Request, res: Response) => {
  try {
    const { funds } = portfolioSchema.parse(req.body);
    const result = await overlapIntelligenceEngine.detectReplacementCandidates(funds);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[ReplaceSuggestions] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio/find-alternatives
 * Find low-overlap alternatives for a fund
 */
router.post("/find-alternatives", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      fundToReplace: portfolioFundSchema,
      existingPortfolio: z.array(portfolioFundSchema),
      limit: z.number().optional().default(3),
    });
    const { fundToReplace, existingPortfolio, limit } = schema.parse(req.body);
    const result = await overlapIntelligenceEngine.findAlternatives(
      fundToReplace,
      existingPortfolio,
      limit
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[FindAlternatives] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio/simulate-impact
 * Simulate diversification impact of changes
 */
router.post("/simulate-impact", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      currentPortfolio: z.array(portfolioFundSchema),
      changes: z.array(changeSchema),
    });
    const { currentPortfolio, changes } = schema.parse(req.body);
    const result = await overlapIntelligenceEngine.simulateDiversificationImpact(
      currentPortfolio,
      changes
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[SimulateImpact] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/portfolio/recommend
 * Extended recommendation endpoint with overlap-aware intelligence
 */
router.post("/recommend", async (req: Request, res: Response) => {
  try {
    const { funds } = portfolioSchema.parse(req.body);
    
    // Get full intelligence analysis
    const intelligence = await overlapIntelligenceEngine.analyzePortfolioIntelligence(funds);
    
    // Format response as per BE-16 spec
    res.json({
      success: true,
      data: {
        replace_suggestions: intelligence.replaceFundSuggestions,
        overlap_safe_recommendations: intelligence.overlapSafeRecommendations || [],
        diversification_impact: {
          current_score: intelligence.diversificationScore.score,
          grade: intelligence.diversificationScore.grade,
          penalties: intelligence.diversificationScore.penalties,
        },
        advisor_talking_points: intelligence.advisorTalkingPoints,
      },
    });
  } catch (error: any) {
    console.error("[PortfolioRecommend] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
