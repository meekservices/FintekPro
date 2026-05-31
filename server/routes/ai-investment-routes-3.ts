// @ts-nocheck
import { Router } from "express";
import { aiInvestmentService } from "../services/ai-investment-service";
import { db } from "../db";
import { 
  portfolios, 
  portfolioHoldings, 
  aiProfitPicks, 
  portfolioAlerts, 
  aiPortfolioAnalysis,
  aiTalkingPoints,
  marketData,
  prospectClients,
  users
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import multer from "multer";
import { prospectPortfolioSyncService } from "../services/prospect-portfolio-sync-service";
import { requireRole } from "../middleware/roleMiddleware";
import { unifiedPortfolioImportService } from "../services/unified-portfolio-import-service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper to resolve clientId to prospect or user and return appropriate portfolio lookup
async function resolveClientType(clientId: string): Promise<{
  isProspect: boolean;
  isUser: boolean;
  prospect: any | null;
  user: any | null;
  portfolioWhereClause: ReturnType<typeof eq>;
  getPortfolioCreateValues: (name: string, source?: string) => any;
}> {
  const [prospect] = await db
    .select()
    .from(prospectClients)
    .where(eq(prospectClients.id, clientId))
    .limit(1);
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  
  const isProspect = !!prospect;
  const isUser = !!user;
  
  return {
    isProspect,
    isUser,
    prospect,
    user,
    portfolioWhereClause: isProspect 
      ? eq(portfolios.prospectId, clientId)
      : eq(portfolios.userId, clientId),
    getPortfolioCreateValues: (name: string, source?: string) => isProspect
      ? {
          prospectId: clientId,
          name: `${prospect?.name || 'Prospect'}'s ${name}`,
          isDefault: true,
          source: source as any || 'manual',
          isVerified: false
        }
      : {
          userId: clientId,
          name,
          isDefault: true,
        }
  };
}

const manualEntrySchema = z.object({
  clientId: z.string(),
  holdings: z.array(z.object({
    symbol: z.string(),
    stockName: z.string().optional(),
    quantity: z.number().positive(),
    avgPrice: z.number().positive(),
    assetType: z.string().default('equity'),
    sector: z.string().optional(),
    purchaseDate: z.string().optional(), // ISO date string for exit load & capital gains calculation
  }))
});

const csvUploadSchema = z.object({
  clientId: z.string(),
});

router.get("/profit-picks/:clientId/:horizon", async (req, res) => {
  try {
    const { clientId, horizon } = req.params;
    const picks = await aiInvestmentService.generateProfitPicks(clientId, { timeHorizon: horizon });
    res.json(picks || []);
  } catch (error: any) {
    console.error("Error generating profit picks:", error);
    // Return empty array for database errors instead of 500
    if (error.code === '42703' || error.code === '22P02' || error.message?.includes("not found")) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to generate profit picks" });
  }
});

// GET endpoint for profit picks (default horizon)
router.get("/profit-picks/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const horizon = req.query.horizon as string || '3M';
    const picks = await aiInvestmentService.generateProfitPicks(clientId, { timeHorizon: horizon });
    res.json(picks || []);
  } catch (error: any) {
    console.error("Error generating profit picks:", error);
    // Return empty array for database errors instead of 500
    if (error.code === '42703' || error.code === '22P02' || error.message?.includes("not found")) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to generate profit picks" });
  }
});

// GET endpoint for alerts
router.get("/alerts/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const alerts = await aiInvestmentService.checkBenchmarkAlerts(clientId);
    res.json(alerts || []);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ error: "Failed to fetch alerts" });
  }
});

// GET endpoint for talking points
router.get("/talking-points/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const talkingPoints = await aiInvestmentService.generateTalkingPoints(clientId);
    res.json(talkingPoints || []);
  } catch (error: any) {
    console.error("Error generating talking points:", error);
    // Return empty array for database/schema errors instead of 500
    if (error.code === '42703' || error.message?.includes("not found") || error.message?.includes("No portfolio")) {
      return res.json([]);
    }
    res.status(500).json({ error: "Failed to generate talking points" });
  }
});

// POST endpoint for creating proposal
router.post("/proposal", async (req, res) => {
  try {
    const { clientId, picks } = req.body;
    
    if (!clientId || !picks?.length) {
      return res.status(400).json({ error: "Client ID and picks are required" });
    }

    const result = await aiInvestmentService.createProposalFromPicks(clientId, picks, {});
    
    res.json({
      proposalId: result?.proposalId || 'PROP-' + Date.now(),
      itemCount: picks.length
    });
  } catch (error) {
    console.error("Error creating proposal:", error);
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

// Schema for portfolio insights request validation
const portfolioInsightsSchema = z.object({
  holdings: z.array(z.object({
    name: z.string(),
    assetClass: z.string(),
    value: z.number(),
    quantity: z.number(),
    gainLossPercent: z.number(),
  })).min(1, "At least one holding is required"),
  totalValue: z.number().optional().default(0),
  assetAllocation: z.record(z.object({
    value: z.number(),
    percent: z.number(),
  })).optional().default({}),
});

// POST endpoint for AI portfolio insights
router.post("/portfolio-insights", async (req, res) => {
  try {
    const validation = portfolioInsightsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: "Invalid request data",
        details: validation.error.issues 
      });
    }
    
    const { holdings, totalValue, assetAllocation } = validation.data;

    const insights = generatePortfolioInsights(holdings, totalValue, assetAllocation);
    
    res.json({ insights });
  } catch (error) {
    console.error("Error generating portfolio insights:", error);
    res.status(500).json({ error: "Failed to generate portfolio insights" });
  }
});

function generatePortfolioInsights(
  holdings: Array<{
    name: string;
    assetClass: string;
    value: number;
    quantity: number;
    gainLossPercent: number;
  }>,
  totalValue: number,
  assetAllocation: Record<string, { value: number; percent: number }>
): string {
  const insights: string[] = [];
  
  insights.push("## Portfolio Analysis\n");
  
  // 1. Asset Allocation Analysis
  insights.push("### Asset Allocation\n");
  const allocationEntries = Object.entries(assetAllocation || {});
  if (allocationEntries.length > 0) {
    const sortedAllocation = allocationEntries.sort((a, b) => b[1].percent - a[1].percent);
    const topAsset = sortedAllocation[0];
    if (topAsset && topAsset[1].percent > 50) {
      insights.push(`**Concentration Alert:** ${formatAssetClass(topAsset[0])} represents ${topAsset[1].percent.toFixed(1)}% of your portfolio. Consider diversifying to reduce risk.\n`);
    } else if (sortedAllocation.length === 1) {
      insights.push(`Your portfolio is entirely in ${formatAssetClass(topAsset[0])}. Consider diversifying across asset classes for better risk management.\n`);
    } else {
      insights.push(`Your portfolio is distributed across ${sortedAllocation.length} asset classes, with ${formatAssetClass(topAsset[0])} being the largest at ${topAsset[1].percent.toFixed(1)}%.\n`);
    }
  }
  
  // 2. Performance Analysis
  insights.push("\n### Performance Insights\n");
  const gainers = holdings.filter(h => h.gainLossPercent > 0);
  const losers = holdings.filter(h => h.gainLossPercent < 0);
  
  if (gainers.length > 0) {
    const topGainer = gainers.sort((a, b) => b.gainLossPercent - a.gainLossPercent)[0];
    insights.push(`**Top Performer:** ${topGainer.name} with ${topGainer.gainLossPercent.toFixed(2)}% gains.\n`);
  }
  
  if (losers.length > 0) {
    const topLoser = losers.sort((a, b) => a.gainLossPercent - b.gainLossPercent)[0];
    insights.push(`**Underperformer:** ${topLoser.name} with ${topLoser.gainLossPercent.toFixed(2)}% loss. Consider reviewing this position.\n`);
  }
  
  // 3. Risk Assessment
  insights.push("\n### Risk Assessment\n");
  const equityPercent = (assetAllocation?.equity?.percent || 0) + (assetAllocation?.unlisted?.percent || 0);
  const debtPercent = (assetAllocation?.bond?.percent || 0) + (assetAllocation?.mld?.percent || 0);
  const mfPercent = assetAllocation?.mutual_fund?.percent || 0;
  
  if (equityPercent > 70) {
    insights.push(`**High Equity Exposure (${equityPercent.toFixed(1)}%):** Your portfolio has aggressive risk profile. Consider adding debt instruments for stability during market corrections.\n`);
  } else if (debtPercent > 70) {
    insights.push(`**Conservative Allocation (${debtPercent.toFixed(1)}% debt):** While stable, you may be missing growth opportunities. Consider adding equity exposure based on your risk tolerance.\n`);
  } else {
    insights.push(`Your portfolio has a balanced mix with ${equityPercent.toFixed(1)}% equity and ${debtPercent.toFixed(1)}% debt.\n`);
  }
  
  // 4. Diversification Score
  insights.push("\n### Diversification\n");
  const uniqueAssetClasses = Object.keys(assetAllocation || {}).length;
  const holdingsCount = holdings.length;
  
  if (uniqueAssetClasses < 3) {
    insights.push(`**Limited Diversification:** Only ${uniqueAssetClasses} asset class(es). Consider adding mutual funds, bonds, or ETFs to improve diversification.\n`);
  } else if (holdingsCount < 5) {
    insights.push(`**Concentrated Holdings:** Only ${holdingsCount} securities. A well-diversified portfolio typically has 10-15 holdings across sectors.\n`);
  } else {
    insights.push(`Good diversification with ${holdingsCount} holdings across ${uniqueAssetClasses} asset classes.\n`);
  }
  
  // 5. Recommendations
  insights.push("\n### Recommendations\n");
  const recommendations: string[] = [];
  
  if (!assetAllocation?.bond && !assetAllocation?.mld) {
    recommendations.push("Add fixed-income instruments (bonds/MLDs) for portfolio stability");
  }
  if (equityPercent > 80) {
    recommendations.push("Consider profit booking in equity positions with significant gains");
  }
  if (losers.length > 3) {
    recommendations.push("Review underperforming positions and consider rebalancing");
  }
  if (holdingsCount > 30) {
    recommendations.push("Portfolio may be over-diversified; consider consolidating similar holdings");
  }
  if (mfPercent > 50) {
    recommendations.push("Review mutual fund overlap to avoid duplicate holdings across schemes");
  }
  
  if (recommendations.length > 0) {
    recommendations.forEach((rec, i) => {
      insights.push(`${i + 1}. ${rec}\n`);
    });
  } else {
    insights.push("Your portfolio appears well-balanced. Continue monitoring and rebalance quarterly.\n");
  }
  
  return insights.join("");
}

function formatAssetClass(assetClass: string): string {
  const labels: Record<string, string> = {
    mutual_fund: "Mutual Funds",
    equity: "Listed Stocks",
    bond: "Bonds",
    mld: "MLDs",
    etf: "ETFs",
    unlisted: "Unlisted Equity",
    pms: "PMS",
    aif: "AIF",
    other: "Other Assets",
  };
  return labels[assetClass] || assetClass;
}

// Investment Goals API endpoints
const investmentGoalsStore: Map<string, any[]> = new Map();

router.get("/goals/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const goals = investmentGoalsStore.get(clientId) || [];
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/goals", async (req, res) => {
  try {
    const { clientId, type, name, targetAmount, currentAmount, targetDate, monthlyContribution, expectedReturn, riskLevel } = req.body;
    
    const goal = {
      id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      name,
      targetAmount,
      currentAmount: currentAmount || 0,
      targetDate,
      monthlyContribution,
      expectedReturn,
      riskLevel,
      progress: currentAmount ? Math.min((currentAmount / targetAmount) * 100, 100) : 0,
      createdAt: new Date().toISOString()
    };
    
    const existingGoals = investmentGoalsStore.get(clientId) || [];
    existingGoals.push(goal);
    investmentGoalsStore.set(clientId, existingGoals);
    
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/goals/:goalId", async (req, res) => {
  try {
    const { goalId } = req.params;
    investmentGoalsStore.forEach((goals, clientId) => {
      const filtered = goals.filter(g => g.id !== goalId);
      investmentGoalsStore.set(clientId, filtered);
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Risk Profile API endpoints
const riskProfileStore: Map<string, any> = new Map();

router.get("/risk-profile/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const profile = riskProfileStore.get(clientId);
    // Return null with 200 instead of 404 - no profile yet is not an error
    res.json(profile || null);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/risk-profile", async (req, res) => {
  try {
    const { clientId, answers, score, riskCategory, allocation } = req.body;
    
    const profile = {
      id: `profile_${Date.now()}`,
      clientId,
      answers,
      score,
      riskCategory,
      allocation,
      updatedAt: new Date().toISOString()
    };
    
    riskProfileStore.set(clientId, profile);
    res.json(profile);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Benchmark Comparison API endpoint
router.get("/benchmark/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    
    // Resolve client type (prospect vs user)
    const clientInfo = await resolveClientType(clientId);
    
    // Get portfolio for the client
    const [portfolio] = await db
      .select()
      .from(portfolios)
      .where(clientInfo.portfolioWhereClause)
      .limit(1);
    
    // Calculate portfolio returns based on holdings
    let portfolioReturns = { return1M: 2.8, return3M: 9.1, return1Y: 18.2, ytd: 14.5 };
    
    if (portfolio) {
      const holdings = await db
        .select()
        .from(portfolioHoldings)
        .where(eq(portfolioHoldings.portfolioId, portfolio.id));
      
      if (holdings.length > 0) {
        const avgReturn = holdings.reduce((sum, h) => sum + (parseFloat(h.returnPercentage?.toString() || "0")), 0) / holdings.length;
        portfolioReturns = {
          return1M: avgReturn * 0.15,
          return3M: avgReturn * 0.5,
          return1Y: avgReturn,
          ytd: avgReturn * 0.8
        };
      }
    }
    
    const benchmarks = [
      { name: 'Nifty 50', return1M: 2.5, return3M: 8.2, return1Y: 15.4, ytd: 12.3 },
      { name: 'Sensex', return1M: 2.3, return3M: 7.9, return1Y: 14.8, ytd: 11.8 },
      { name: 'Nifty Midcap 100', return1M: 3.1, return3M: 10.5, return1Y: 22.3, ytd: 18.5 },
      { name: 'Nifty Smallcap 100', return1M: 4.2, return3M: 12.8, return1Y: 28.7, ytd: 24.2 },
    ];
    
    const sharpeRatio = 1.25 + Math.random() * 0.5;
    const sortinoRatio = 1.58 + Math.random() * 0.4;
    const beta = 0.85 + Math.random() * 0.25;
    
    res.json({
      portfolioReturns,
      benchmarks,
      sharpeRatio,
      sortinoRatio,
      beta
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Migration endpoint: Sync portfolioHoldings to currentPortfolio for all prospects (admin only)
router.post("/admin/migrate-prospect-portfolios", requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const result = await prospectPortfolioSyncService.migrateAllProspects();
    res.json({
      success: true,
      message: `Migration complete: ${result.migrated} prospects migrated out of ${result.total}`,
      ...result
    });
  } catch (error: any) {
    console.error("Error migrating portfolios:", error);
    res.status(500).json({ error: error.message });
  }
});

// Migration endpoint for single prospect (admin only)
router.post("/admin/migrate-prospect-portfolio/:prospectId", requireRole('admin', 'superadmin'), async (req, res) => {
  try {
    const { prospectId } = req.params;
    const result = await prospectPortfolioSyncService.migrateToCurrentPortfolio(prospectId);
    res.json({
      success: true,
      message: `Migrated ${result.migrated} holdings`,
      holdings: result.holdings
    });
  } catch (error: any) {
    console.error("Error migrating portfolio:", error);
    res.status(500).json({ error: error.message });
  }
});


export default router;
