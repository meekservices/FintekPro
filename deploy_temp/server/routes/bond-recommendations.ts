import { Router, Request, Response } from "express";
import { aiBondRecommendationService, BondRecommendationParams } from "../services/ai-bond-recommendation-service";
import { db } from "../db";
import { storeCategories } from "@shared/schema";
import { eq, or } from "drizzle-orm";

const router = Router();

// Helper to check if Bonds category is enabled for recommendations
async function isBondsCategoryEnabled(): Promise<boolean> {
  try {
    const categories = await db.select()
      .from(storeCategories)
      .where(
        or(
          eq(storeCategories.slug, 'bonds'),
          eq(storeCategories.name, 'Bonds')
        )
      )
      .limit(1);
    
    if (categories.length === 0) return true;
    return categories[0].isEnabled !== false;
  } catch (e) {
    console.warn('[AI Bond] Error checking category status:', e);
    return true;
  }
}

router.post("/generate", async (req: Request, res: Response) => {
  try {
    // Check if Bonds category is enabled
    const categoryEnabled = await isBondsCategoryEnabled();
    if (!categoryEnabled) {
      return res.json({
        success: true,
        data: { bonds: [], allocation: [], summary: 'Bonds category is currently not available' },
        categoryStatus: 'disabled',
        generatedAt: new Date().toISOString()
      });
    }

    const params: BondRecommendationParams = {
      investmentAmount: req.body.investmentAmount || 500000,
      investmentHorizon: req.body.investmentHorizon || 'medium',
      riskTolerance: req.body.riskTolerance || 'moderate',
      taxBracket: req.body.taxBracket || '30',
      preferredBondTypes: req.body.preferredBondTypes || ['g_sec', 'corporate_bond', 'ncd', 'tax_free_bond'],
      minimumRating: req.body.minimumRating || 'AA',
      yieldPreference: req.body.yieldPreference || 'balanced',
      liquidityNeeds: req.body.liquidityNeeds || 'medium',
      taxOptimization: req.body.taxOptimization ?? true,
      inflationProtection: req.body.inflationProtection ?? false,
      monthlyIncomeNeeded: req.body.monthlyIncomeNeeded ?? false,
      clientId: req.body.clientId
    };

    if (params.investmentAmount < 10000) {
      return res.status(400).json({ 
        error: "Minimum investment amount for bond recommendations is ₹10,000" 
      });
    }

    const recommendations = await aiBondRecommendationService.generateRecommendations(params);
    
    res.json({
      success: true,
      data: recommendations,
      generatedAt: new Date().toISOString(),
      parameters: params
    });
  } catch (error: any) {
    console.error("Error generating bond recommendations:", error);
    res.status(500).json({ 
      error: "Failed to generate bond recommendations",
      message: error.message 
    });
  }
});

router.get("/parameters", (req: Request, res: Response) => {
  res.json({
    investmentHorizon: [
      { value: 'short', label: 'Short Term (< 3 years)', description: 'Lower duration, higher liquidity' },
      { value: 'medium', label: 'Medium Term (3-7 years)', description: 'Balanced approach' },
      { value: 'long', label: 'Long Term (> 7 years)', description: 'Higher yields, more duration risk' }
    ],
    riskTolerance: [
      { value: 'conservative', label: 'Conservative', description: 'Focus on capital preservation' },
      { value: 'moderately_conservative', label: 'Moderately Conservative', description: 'Stability with some growth' },
      { value: 'moderate', label: 'Moderate', description: 'Balanced risk-return' },
      { value: 'moderately_aggressive', label: 'Moderately Aggressive', description: 'Growth oriented' },
      { value: 'aggressive', label: 'Aggressive', description: 'Maximum yield focus' }
    ],
    taxBrackets: [
      { value: '0', label: 'No Tax (0%)' },
      { value: '5', label: '5% Tax Bracket' },
      { value: '10', label: '10% Tax Bracket' },
      { value: '15', label: '15% Tax Bracket' },
      { value: '20', label: '20% Tax Bracket' },
      { value: '25', label: '25% Tax Bracket' },
      { value: '30', label: '30% Tax Bracket' }
    ],
    bondTypes: [
      { value: 'g_sec', label: 'Government Securities', description: 'Sovereign backed, safest' },
      { value: 'sdl', label: 'State Development Loans', description: 'State government bonds' },
      { value: 't_bill', label: 'Treasury Bills', description: 'Short-term govt securities' },
      { value: 'sgb', label: 'Sovereign Gold Bonds', description: 'Gold + fixed coupon' },
      { value: 'corporate_bond', label: 'Corporate Bonds', description: 'Company issued bonds' },
      { value: 'ncd', label: 'NCDs', description: 'Non-convertible debentures' },
      { value: 'tax_free_bond', label: 'Tax-Free Bonds', description: 'Tax-exempt interest' },
      { value: 'infrastructure_bond', label: 'Infrastructure Bonds', description: 'Infra project financing' }
    ],
    minimumRatings: [
      { value: 'AAA', label: 'AAA Only', description: 'Highest quality' },
      { value: 'AA+', label: 'AA+ and above' },
      { value: 'AA', label: 'AA and above' },
      { value: 'AA-', label: 'AA- and above' },
      { value: 'A+', label: 'A+ and above' },
      { value: 'A', label: 'A and above' },
      { value: 'BBB', label: 'Investment Grade (BBB+)' },
      { value: 'any', label: 'Any Rating', description: 'Including high yield' }
    ],
    yieldPreference: [
      { value: 'safety_first', label: 'Safety First', description: 'Prioritize credit quality' },
      { value: 'balanced', label: 'Balanced', description: 'Balance yield and safety' },
      { value: 'high_yield', label: 'High Yield', description: 'Maximum income focus' }
    ],
    liquidityNeeds: [
      { value: 'high', label: 'High Liquidity', description: 'May need quick access' },
      { value: 'medium', label: 'Medium Liquidity', description: 'Some flexibility needed' },
      { value: 'low', label: 'Low Liquidity', description: 'Can hold to maturity' }
    ]
  });
});

router.get("/quick-picks", async (req: Request, res: Response) => {
  try {
    const profile = (req.query.profile as string) || 'balanced';
    
    let params: BondRecommendationParams;
    
    switch (profile) {
      case 'conservative':
        params = {
          investmentAmount: 500000,
          investmentHorizon: 'short',
          riskTolerance: 'conservative',
          taxBracket: '30',
          preferredBondTypes: ['g_sec', 'tax_free_bond', 'sgb'],
          minimumRating: 'AAA',
          yieldPreference: 'safety_first',
          liquidityNeeds: 'high',
          taxOptimization: true,
          inflationProtection: true,
          monthlyIncomeNeeded: false
        };
        break;
      case 'income':
        params = {
          investmentAmount: 500000,
          investmentHorizon: 'medium',
          riskTolerance: 'moderate',
          taxBracket: '30',
          preferredBondTypes: ['corporate_bond', 'ncd', 'infrastructure_bond'],
          minimumRating: 'AA',
          yieldPreference: 'high_yield',
          liquidityNeeds: 'medium',
          taxOptimization: false,
          inflationProtection: false,
          monthlyIncomeNeeded: true
        };
        break;
      case 'tax_saver':
        params = {
          investmentAmount: 500000,
          investmentHorizon: 'long',
          riskTolerance: 'moderately_conservative',
          taxBracket: '30',
          preferredBondTypes: ['tax_free_bond', 'sgb', 'infrastructure_bond'],
          minimumRating: 'AA+',
          yieldPreference: 'balanced',
          liquidityNeeds: 'low',
          taxOptimization: true,
          inflationProtection: true,
          monthlyIncomeNeeded: false
        };
        break;
      default: // balanced
        params = {
          investmentAmount: 500000,
          investmentHorizon: 'medium',
          riskTolerance: 'moderate',
          taxBracket: '30',
          preferredBondTypes: ['g_sec', 'corporate_bond', 'ncd', 'tax_free_bond'],
          minimumRating: 'AA',
          yieldPreference: 'balanced',
          liquidityNeeds: 'medium',
          taxOptimization: true,
          inflationProtection: false,
          monthlyIncomeNeeded: false
        };
    }
    
    const recommendations = await aiBondRecommendationService.generateRecommendations(params);
    
    res.json({
      success: true,
      profile,
      data: recommendations,
      generatedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("Error generating quick picks:", error);
    res.status(500).json({ 
      error: "Failed to generate quick picks",
      message: error.message 
    });
  }
});

export default router;
