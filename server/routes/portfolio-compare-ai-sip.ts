// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { z } from 'zod';
import { requireAuth } from '../middleware/roleMiddleware';
import { PortfolioComparisonService } from '../services/portfolio-comparison-service';

export function registerPortfolioCompareAISIPRoutes(app: Express): void {
app.post("/api/portfolios/compare", async (req: any, res) => {
  try {
    const { portfolioIds, timePeriod = "1Y", benchmarkIndex = "NIFTY_50", comparisonType = "comprehensive" } = req.body;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!portfolioIds || !Array.isArray(portfolioIds) || portfolioIds.length < 2) {
      return res.status(400).json({ 
        status: "error",
        error: "At least 2 portfolio IDs are required for comparison" 
      });
    }

    if (portfolioIds.length > 5) {
      return res.status(400).json({ 
        status: "error",
        error: "Maximum 5 portfolios can be compared at once" 
      });
    }

    const portfolioComparisonService = new PortfolioComparisonService(storage as any);
    const result = await portfolioComparisonService.comparePortfolios(
      portfolioIds, 
      userId, 
      timePeriod, 
      benchmarkIndex, 
      comparisonType
    );

    // Save comparison result
    const comparisonId = await portfolioComparisonService.saveComparison(
      userId,
      portfolioIds,
      result,
      timePeriod,
      benchmarkIndex,
      comparisonType
    );

    res.json({
      status: "success",
      data: {
        comparisonId,
        ...result
      }
    });
  } catch (error) {
    console.error("Portfolio comparison error:", error);
    res.status(500).json({ 
      status: "error",
      error: "Failed to compare portfolios. Please try again." 
    });
  }
});

app.get("/api/portfolios/compare/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const portfolioComparisonService = new PortfolioComparisonService(storage as any);
    const comparison = await portfolioComparisonService.getComparison(id);

    if (!comparison) {
      return res.status(404).json({ 
        status: "error",
        error: "Comparison not found" 
      });
    }

    res.json({
      status: "success",
      data: comparison
    });
  } catch (error) {
    console.error("Error fetching portfolio comparison:", error);
    res.status(500).json({ 
      status: "error",
      error: "Failed to fetch comparison" 
    });
  }
});

app.get("/api/users/:userId/portfolio-comparisons", async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    const portfolioComparisonService = new PortfolioComparisonService(storage as any);
    const comparisons = await portfolioComparisonService.getUserComparisons(userId);

    res.json({
      status: "success",
      data: comparisons.slice(Number(offset), Number(offset) + Number(limit)),
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: comparisons.length
      }
    });
  } catch (error) {
    console.error("Error fetching user portfolio comparisons:", error);
    res.status(500).json({ 
      status: "error",
      error: "Failed to fetch comparisons" 
    });
  }
});

// AMFI SIP calculator endpoint
app.get("/api/amfi/sip-calculator", async (req, res) => {
  try {
    const { monthly_investment, tenure_years, expected_return } = req.query;
    
    const monthlyAmt = parseFloat(String(monthly_investment)) || 5000;
    const tenureYears = parseInt(String(tenure_years)) || 10;
    const annualReturn = parseFloat(String(expected_return)) || 12;
    
    const monthlyReturn = annualReturn / 12 / 100;
    const totalMonths = tenureYears * 12;
    
    // SIP Future Value calculation
    const futureValue = monthlyAmt * (((Math.pow(1 + monthlyReturn, totalMonths) - 1) / monthlyReturn) * (1 + monthlyReturn));
    const totalInvested = monthlyAmt * totalMonths;
    const totalReturns = futureValue - totalInvested;
    
    const calculation = {
      monthlyInvestment: monthlyAmt,
      tenureYears: tenureYears,
      totalMonths: totalMonths,
      expectedAnnualReturn: annualReturn + "%",
      totalInvested: Math.round(totalInvested),
      totalReturns: Math.round(totalReturns),
      maturityAmount: Math.round(futureValue),
      returnMultiple: (futureValue / totalInvested).toFixed(2) + "x"
    };

    // Year-wise breakdown
    const yearlyBreakdown = [];
    for (let year = 1; year <= tenureYears; year++) {
      const months = year * 12;
      const yearlyValue = monthlyAmt * (((Math.pow(1 + monthlyReturn, months) - 1) / monthlyReturn) * (1 + monthlyReturn));
      const yearlyInvested = monthlyAmt * months;
      yearlyBreakdown.push({
        year: year,
        invested: Math.round(yearlyInvested),
        value: Math.round(yearlyValue),
        returns: Math.round(yearlyValue - yearlyInvested)
      });
    }

    res.json({
      status: "success",
      calculation,
      yearlyBreakdown,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error calculating SIP:", error);
    res.status(500).json({
      status: "error",
      error: "Failed to calculate SIP returns"
    });
  }
});

app.get("/api/ai/portfolios/:portfolioId/rebalancing-recommendations", requireAuth, async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Get portfolio data and verify ownership
    const portfolio = await storage.getPortfolio(portfolioId);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    // Verify portfolio ownership
    if (portfolio.userId !== userId) {
      return res.status(403).json({ error: "Access denied: Portfolio not owned by user" });
    }
    
    const holdings = await storage.getPortfolioHoldings(portfolioId);
    const assetAllocation = await storage.getAssetAllocation(portfolioId);
    const performance = await storage.getPortfolioPerformance(portfolioId);

    // Get user profile for personalized recommendations
    const userProfile = await storage.getUserProfile(userId) || {
      age: 35,
      riskTolerance: 'moderate',
      investmentGoals: ['wealth_creation', 'retirement_planning'],
      timeHorizon: 10,
      monthlyIncome: 100000
    };

    // Build portfolio data for AI analysis
    const portfolioData = {
      id: portfolioId,
      totalValue: parseFloat(portfolio.totalValue || "0"),
      holdings: holdings.map(h => ({
        symbol: h.symbol,
        quantity: parseFloat(h.quantity),
        currentPrice: parseFloat(h.avgPrice), // Using avg price as current price for now
        currentValue: parseFloat(h.quantity) * parseFloat(h.avgPrice),
        investedValue: parseFloat(h.quantity) * parseFloat(h.avgPrice),
        gainLoss: 0, // Would need market data for accurate calculation
        gainLossPercent: 0,
        assetType: h.assetType || 'equity',
        sector: h.sector || undefined,
        exchange: (h as any).exchange || 'NSE'
      })),
      assetAllocation: assetAllocation?.map(a => ({
        assetType: a.assetType,
        percentage: parseFloat(a.currentPercentage || "0"),
        currentValue: parseFloat(a.currentValue || "0")
      })) || [],
      performance: {
        totalGainLoss: parseFloat(performance?.totalGainLoss || "0"),
        totalGainLossPercent: parseFloat(performance?.totalGainLossPercent || "0"),
        dayChange: parseFloat(performance?.dayChange || "0"),
        dayChangePercent: parseFloat(performance?.dayChangePercent || "0")
      }
    };

    const aiRecommendations = await aiPortfolioService.generatePortfolioRebalancingRecommendations(
      portfolioData,
      userProfile as any
    );

    // Check if OpenAI returned empty recommendations due to errors
    if (!aiRecommendations || aiRecommendations.length === 0) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate AI recommendations",
        message: "AI service returned empty recommendations. Please check OpenAI API configuration."
      });
    }

    res.json({
      success: true,
      data: aiRecommendations,
      portfolioSummary: {
        totalValue: portfolioData.totalValue,
        holdingsCount: portfolioData.holdings.length,
        performance: portfolioData.performance
      }
    });
  } catch (error) {
    console.error("Error generating AI rebalancing recommendations:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to generate AI rebalancing recommendations",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// AI-Powered Investment Proposal Generation
app.post("/api/ai/portfolios/:portfolioId/investment-proposal", requireAuth, async (req, res) => {
  try {
    const { portfolioId } = req.params;
    const { additionalCapital = 0 } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    // Validate request body
    const bodySchema = z.object({
      additionalCapital: z.number().min(0).optional().default(0)
    });
    
    const validatedBody = bodySchema.parse(req.body);
    const validatedAdditionalCapital = validatedBody.additionalCapital;
    
    // Get portfolio data and verify ownership
    const portfolio = await storage.getPortfolio(portfolioId);
    if (!portfolio) {
      return res.status(404).json({ error: "Portfolio not found" });
    }
    
    // Verify portfolio ownership
    if (portfolio.userId !== userId) {
      return res.status(403).json({ error: "Access denied: Portfolio not owned by user" });
    }
    
    const holdings = await storage.getPortfolioHoldings(portfolioId);
    const assetAllocation = await storage.getAssetAllocation(portfolioId);
    const performance = await storage.getPortfolioPerformance(portfolioId);

    // Get user profile and financial goals
    const userProfile = await storage.getUserProfile(userId) || {
      age: 35,
      riskTolerance: 'moderate',
      investmentGoals: ['wealth_creation', 'retirement_planning'],
      timeHorizon: 10,
      monthlyIncome: 100000
    };

    const financialGoals = await storage.getFinancialGoals(userId) || [];
    if (financialGoals && financialGoals.length > 0) {
      (userProfile as any).financialGoals = financialGoals.map(goal => ({
        goal: goal.description,
        targetAmount: parseFloat(goal.targetAmount),
        timeframe: goal.targetDate ? Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000)) : 5
      }));
    }

    // Build portfolio data for AI analysis
    const portfolioData = {
      id: portfolioId,
      totalValue: parseFloat(portfolio.totalValue || "0"),
      holdings: holdings.map(h => ({
        symbol: h.symbol,
        quantity: parseFloat(h.quantity),
        currentPrice: parseFloat(h.avgPrice),
        currentValue: parseFloat(h.quantity) * parseFloat(h.avgPrice),
        investedValue: parseFloat(h.quantity) * parseFloat(h.avgPrice),
        gainLoss: 0,
        gainLossPercent: 0,
        assetType: h.assetType || 'equity',
        sector: h.sector || undefined,
        exchange: (h as any).exchange || 'NSE'
      })),
      assetAllocation: assetAllocation?.map(a => ({
        assetType: a.assetType,
        percentage: parseFloat(a.currentPercentage || "0"),
        currentValue: parseFloat(a.currentValue || "0")
      })) || [],
      performance: {
        totalGainLoss: parseFloat(performance?.totalGainLoss || "0"),
        totalGainLossPercent: parseFloat(performance?.totalGainLossPercent || "0"),
        dayChange: parseFloat(performance?.dayChange || "0"),
        dayChangePercent: parseFloat(performance?.dayChangePercent || "0")
      }
    };

    const aiProposal = await aiPortfolioService.generateInvestmentProposal(
      portfolioData,
      userProfile as any,
      validatedAdditionalCapital
    );

    // Check if OpenAI returned a valid proposal
    if (!aiProposal) {
      return res.status(500).json({
        success: false,
        error: "Failed to generate investment proposal",
        message: "AI service returned empty proposal. Please check OpenAI API configuration."
      });
    }

    res.json({
      success: true,
      data: aiProposal,
      portfolioSummary: {
        totalValue: portfolioData.totalValue,
        holdingsCount: portfolioData.holdings.length,
        performance: portfolioData.performance
      }
    });
  } catch (error) {
    console.error("Error generating AI investment proposal:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to generate AI investment proposal",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.get('/api/ai/portfolio-insights', async (req, res) => {
  try {
    res.json({
      insights: [
        { type: 'rebalancing', title: 'Portfolio Rebalancing Needed', description: 'Your equity allocation has drifted 5% above target', priority: 'medium', actionable: true },
        { type: 'opportunity', title: 'Tax Harvesting Opportunity', description: 'Potential tax savings of ₹15,000 identified', priority: 'high', actionable: true },
        { type: 'risk', title: 'Sector Concentration', description: 'IT sector comprises 40% of your portfolio', priority: 'low', actionable: false }
      ],
      portfolioScore: 78,
      lastAnalyzed: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch portfolio insights' });
  }
});

// Analytics Portfolio
app.get('/api/analytics/portfolio', async (req, res) => {
  try {
    res.json({
      totalValue: 2500000,
      dayChange: 12500,
      dayChangePercent: 0.5,
      overallGain: 350000,
      overallGainPercent: 16.28,
      xirr: 14.5,
      assetAllocation: [
        { asset: 'Equity', value: 1500000, percentage: 60 },
        { asset: 'Debt', value: 750000, percentage: 30 },
        { asset: 'Gold', value: 250000, percentage: 10 }
      ]
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch portfolio analytics' });
  }
});

// Portfolio Stress Test Holdings
app.get('/api/portfolio/stress-test-holdings', async (req, res) => {
  try {
    res.json({
      holdings: [
        { symbol: 'RELIANCE', name: 'Reliance Industries', quantity: 50, currentValue: 145000, stressedValue: 116000, impact: -20 },
        { symbol: 'HDFCBANK', name: 'HDFC Bank', quantity: 100, currentValue: 160000, stressedValue: 136000, impact: -15 },
        { symbol: 'TCS', name: 'Tata Consultancy', quantity: 30, currentValue: 120000, stressedValue: 102000, impact: -15 }
      ],
      scenarios: ['Market Crash -20%', 'Sector Rotation', 'Interest Rate Hike']
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch stress test holdings' });
  }
});

// ============ END CLIENT PORTAL ENDPOINTS ============
}
