import { analyzePortfolio, generateInvestmentStory, generateMarketInsight } from "./gemini";
import { whatsappService } from "./whatsapp";
import { storage } from "./storage";
import { aiMFRecommendationService } from "./services/ai-mf-recommendation-service";

export class PortfolioIntelligenceService {
  // AI-powered portfolio optimization
  async optimizePortfolio(userId: string): Promise<{
    analysis: any;
    recommendations: string[];
    riskScore: number;
    optimizationSuggestions: string[];
  }> {
    try {
      const portfolios = await storage.getPortfoliosByUserId(userId);
      if (!portfolios.length) {
        throw new Error("No portfolios found for user");
      }

      const portfolio = portfolios[0];
      const holdings = await storage.getPortfolioHoldings(portfolio.id);
      
      // Get AI analysis
      const portfolioData = {
        totalValue: portfolio.totalValue || 0,
        holdings: holdings.map(h => ({
          symbol: h.symbol,
          quantity: parseFloat(h.quantity ?? "0"),
          currentPrice: parseFloat(h.avgPrice ?? "0"), // Using avgPrice as currentPrice placeholder
          totalValue: parseFloat(h.quantity ?? "0") * parseFloat(h.avgPrice ?? "0"),
          sector: 'Unknown' // Will be enhanced later
        }))
      };

      const analysis = await analyzePortfolio(portfolioData);
      
      // Generate optimization suggestions
      const optimizationSuggestions = await this.generateOptimizationSuggestions(portfolioData);
      
      return {
        ...analysis,
        optimizationSuggestions
      };
      
    } catch (error) {
      console.error("Portfolio optimization error:", error);
      return {
        analysis: "Unable to analyze portfolio at the moment.",
        recommendations: ["Consider diversifying your holdings"],
        riskScore: 5,
        optimizationSuggestions: ["Review your asset allocation"]
      };
    }
  }

  // Automated portfolio reports with AI insights
  async generatePortfolioReport(userId: string): Promise<string> {
    const optimization = await this.optimizePortfolio(userId);
    
    const report = `📊 *Portfolio Intelligence Report*

🎯 **Risk Score:** ${optimization.riskScore}/10

📈 **Key Analysis:**
${optimization.analysis}

💡 **AI Recommendations:**
${optimization.recommendations.map(r => `• ${r}`).join('\n')}

🔧 **Optimization Suggestions:**
${optimization.optimizationSuggestions.map(s => `• ${s}`).join('\n')}

🤖 *Powered by FinanceHub AI*`;

    return report;
  }

  // Send automated portfolio updates via WhatsApp
  async sendPortfolioUpdates(userId: string, phoneNumber: string): Promise<void> {
    try {
      const report = await this.generatePortfolioReport(userId);
      await whatsappService.sendMessage(phoneNumber, report);
    } catch (error) {
      console.error("Error sending portfolio update:", error);
    }
  }

  // AI-driven investment opportunities
  async findInvestmentOpportunities(userId: string): Promise<{
    opportunities: string[];
    marketInsights: string;
  }> {
    const portfolios = await storage.getPortfoliosByUserId(userId);
    const userProfile = await storage.getUserProfile(userId);
    
    // Analyze market conditions
    const marketData = await this.getCurrentMarketData();
    const marketInsights = await generateMarketInsight(marketData);
    
    // Generate personalized opportunities based on risk tolerance
    const riskLevel = userProfile?.riskTolerance || 'moderate';
    const opportunities = this.generateOpportunitiesForRisk(riskLevel, marketInsights);
    
    return {
      opportunities,
      marketInsights
    };
  }

  // Smart rebalancing recommendations
  async getRebalancingRecommendations(userId: string): Promise<{
    currentAllocation: any[];
    targetAllocation: any[];
    actions: string[];
  }> {
    const portfolios = await storage.getPortfoliosByUserId(userId);
    const holdings = await storage.getPortfolioHoldings(portfolios[0]?.id || '');
    
    // Calculate current allocation
    const totalValue = holdings.reduce((sum, h) => sum + (parseFloat(h.quantity ?? "0") * parseFloat(h.avgPrice ?? "0")), 0);
    const currentAllocation = this.calculateAllocation(holdings, totalValue);
    
    // AI-suggested target allocation based on user profile
    const userProfile = await storage.getUserProfile(userId);
    const targetAllocation = this.getTargetAllocation(userProfile?.riskTolerance || 'moderate');
    
    // Generate rebalancing actions
    const actions = this.generateRebalancingActions(currentAllocation, targetAllocation);
    
    return {
      currentAllocation,
      targetAllocation,
      actions
    };
  }

  // Automated daily market insights
  async sendDailyMarketInsights(subscribers: string[]): Promise<void> {
    try {
      const marketData = await this.getCurrentMarketData();
      const insight = await generateMarketInsight(marketData);
      
      const message = `🌅 *Daily Market Insight*\n\n${insight}\n\n📱 Visit FinanceHub for detailed analysis and portfolio recommendations!`;
      
      for (const phoneNumber of subscribers) {
        await whatsappService.sendMessage(phoneNumber, message);
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error("Error sending daily insights:", error);
    }
  }

  private async generateOptimizationSuggestions(portfolioData: any): Promise<string[]> {
    const suggestions = [];
    
    // Diversification analysis
    const sectors = Array.from(new Set(portfolioData.holdings.map((h: any) => h.sector)));
    if (sectors.length < 3) {
      suggestions.push("Consider diversifying across more sectors");
    }
    
    // Concentration risk
    const topHolding = portfolioData.holdings.reduce((max: any, h: any) => 
      h.totalValue > (max?.totalValue || 0) ? h : max, null);
    
    if (topHolding && topHolding.totalValue > portfolioData.totalValue * 0.3) {
      suggestions.push(`Reduce concentration risk in ${topHolding.symbol}`);
    }
    
    // Risk-based suggestions
    suggestions.push("Consider adding defensive stocks for stability");
    suggestions.push("Evaluate rebalancing frequency for optimal returns");
    
    return suggestions;
  }

  private generateOpportunitiesForRisk(riskLevel: string, marketInsights: string): string[] {
    const opportunities = [];
    
    switch (riskLevel) {
      case 'conservative':
        opportunities.push("Government bonds offering stable returns");
        opportunities.push("Blue-chip dividend stocks for income");
        opportunities.push("Fixed deposits with attractive rates");
        break;
      case 'moderate':
        opportunities.push("Index funds for diversified market exposure");
        opportunities.push("Large-cap stocks with growth potential");
        opportunities.push("Balanced mutual funds");
        break;
      case 'aggressive':
        opportunities.push("Growth stocks in emerging sectors");
        opportunities.push("Small-cap stocks with high potential");
        opportunities.push("Sector-specific ETFs");
        break;
    }
    
    return opportunities;
  }

  private calculateAllocation(holdings: any[], totalValue: number): any[] {
    return holdings.map(h => ({
      symbol: h.symbol,
      sector: 'Unknown',
      percentage: ((parseFloat(h.quantity ?? "0") * parseFloat(h.avgPrice ?? "0")) / totalValue * 100).toFixed(1)
    }));
  }

  private getTargetAllocation(riskTolerance: string): any[] {
    const allocations = {
      conservative: [
        { type: "Bonds", percentage: "50%" },
        { type: "Large Cap", percentage: "30%" },
        { type: "Cash", percentage: "20%" }
      ],
      moderate: [
        { type: "Large Cap", percentage: "40%" },
        { type: "Mid Cap", percentage: "25%" },
        { type: "Bonds", percentage: "25%" },
        { type: "International", percentage: "10%" }
      ],
      aggressive: [
        { type: "Large Cap", percentage: "30%" },
        { type: "Mid Cap", percentage: "30%" },
        { type: "Small Cap", percentage: "25%" },
        { type: "International", percentage: "15%" }
      ]
    };
    
    return allocations[riskTolerance as keyof typeof allocations] || allocations.moderate;
  }

  private generateRebalancingActions(current: any[], target: any[]): string[] {
    return [
      "Consider reducing overweight positions",
      "Add to underweight asset classes",
      "Review quarterly for optimal timing",
      "Use SIP for gradual rebalancing"
    ];
  }

  private async getCurrentMarketData(): Promise<any> {
    // Mock market data - replace with actual API calls
    return {
      nifty: { price: 24500, change: 1.5 },
      sensex: { price: 81000, change: 2.1 },
      topMovers: [
        { symbol: "RELIANCE", change: 3.2 },
        { symbol: "TCS", change: 2.8 }
      ]
    };
  }

  /**
   * AI-powered mutual fund analysis for existing holdings
   * Uses the FintekPro AI MF Recommendation Service for deep analysis
   */
  async getAIMFAnalysis(userId: string): Promise<{
    holdingsAnalysis: any[];
    exitCandidates: any[];
    improvementSuggestions: any[];
    commodityAllocation: any[];
    portfolioHealthScore: number;
    aiSummary: string;
  }> {
    try {
      const portfolios = await storage.getPortfoliosByUserId(userId);
      if (!portfolios.length) {
        return {
          holdingsAnalysis: [],
          exitCandidates: [],
          improvementSuggestions: await aiMFRecommendationService.getSmartRecommendations({}),
          commodityAllocation: await aiMFRecommendationService.getCommodityFOFRecommendations(),
          portfolioHealthScore: 50,
          aiSummary: "No portfolio found. Here are top-rated mutual funds to get started."
        };
      }

      const holdings = await storage.getPortfolioHoldings(portfolios[0].id);
      
      // Transform to the format expected by AI MF service
      const holdingsData = holdings.map(h => ({
        schemeCode: undefined,
        schemeName: h.symbol || 'Unknown',
        currentValue: parseFloat(h.quantity ?? "0") * parseFloat(h.avgPrice ?? "0"),
        units: parseFloat(h.quantity ?? "0"),
        category: undefined,
        fundHouse: undefined
      }));

      // Use AI MF service for analysis
      const analysis = await aiMFRecommendationService.analyzePortfolioHoldings(holdingsData);
      
      return analysis;
    } catch (error) {
      console.error("AI MF Analysis error:", error);
      return {
        holdingsAnalysis: [],
        exitCandidates: [],
        improvementSuggestions: [],
        commodityAllocation: [],
        portfolioHealthScore: 50,
        aiSummary: "Unable to analyze portfolio at this time."
      };
    }
  }

  /**
   * Get smart fund recommendations for new investments
   */
  async getSmartFundRecommendations(params: {
    riskCategory?: 'conservative' | 'moderate' | 'aggressive';
    category?: string;
    investmentAmount?: number;
  }): Promise<any> {
    try {
      const { riskCategory = 'moderate', category, investmentAmount = 100000 } = params;
      
      if (category) {
        // Get recommendations for specific category
        return aiMFRecommendationService.getSmartRecommendations({ category });
      }
      
      // Get full proposal recommendations
      return aiMFRecommendationService.getProposalRecommendations({
        riskCategory,
        investmentAmount
      });
    } catch (error) {
      console.error("Smart fund recommendations error:", error);
      return { equityFunds: [], debtFunds: [], hybridFunds: [], commodityFunds: [] };
    }
  }
}

export const portfolioIntelligence = new PortfolioIntelligenceService();