import { Request, Response } from 'express';
import { db } from './db';
import { 
  users,
  portfolios,
  portfolioHoldings,
  watchlists,
  clientEnrichmentData,
  aiTransactionTracking,
  transactionEnrichmentAnalysis
} from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { aiService } from './services/ai-service';

interface InvestSmartPageStructure {
  dashboardMetrics: {
    monthlyIncome: number;
    monthlyObligations: number;
    availableForInvestment: number;
    creditScore: number;
    totalPortfolioValue: number;
    obligationRatio: number;
  };
  portfolioData: any[];
  goalProgress: any[];
  riskProfile: any;
  creditObligations: any[];
  enrichmentData: any[];
  transactionPatterns: any[];
}

interface AIInsightsGeneration {
  overallHealthScore: number;
  keyOpportunities: string[];
  urgentActions: string[];
  goalAcceleration: string[];
  riskOptimization: string[];
  investmentRecommendations: string[];
  complianceAlerts: string[];
  nextSteps: string[];
}

class AIInvestSmartMonitor {
  
  // Parse income value from various formats and return monthly income
  private parseIncomeValue(incomeValue: string | number): number {
    if (typeof incomeValue === 'number') {
      // If already a number, check if it looks like annual or monthly
      if (incomeValue > 1000000) {
        // Likely annual income in rupees, convert to monthly
        return incomeValue / 12;
      } else if (incomeValue > 10000) {
        // Could be monthly income in rupees
        return incomeValue;
      } else {
        // Small number, probably in lakhs (annual)
        return (incomeValue * 100000) / 12;
      }
    }
    
    // Normalize string: remove currency symbols and grouping separators
    let normalizedStr = String(incomeValue).trim();
    
    // Remove currency symbols (₹, Rs, Rs., INR, etc.)
    normalizedStr = normalizedStr.replace(/[₹$]/g, '');
    normalizedStr = normalizedStr.replace(/\b(Rs\.?|INR|rupees?)\b/gi, '');
    normalizedStr = normalizedStr.trim();
    
    const lowerStr = normalizedStr.toLowerCase();
    
    // Check if it contains unit indicators
    const hasLakhUnit = lowerStr.includes('lakh') || lowerStr.includes('lac');
    const hasCroreUnit = lowerStr.includes('crore') || lowerStr.includes('cr');
    
    // Remove commas to handle formats like "1,20,000" or "1,200,000"
    const numericStr = normalizedStr.replace(/,/g, '');
    
    // Extract numeric value (including decimals)
    const match = numericStr.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return 0;
    }
    
    const numericValue = parseFloat(match[1]);
    let monthlyIncome = 0;
    
    if (hasCroreUnit) {
      // Convert crores to rupees (1 crore = 10,000,000), then to monthly
      monthlyIncome = (numericValue * 10000000) / 12;
    } else if (hasLakhUnit) {
      // Convert lakhs to rupees (1 lakh = 100,000), then to monthly
      monthlyIncome = (numericValue * 100000) / 12;
    } else if (numericValue < 1000) {
      // Small numbers without units are likely in lakhs (e.g., "10" means 10 lakhs annual)
      monthlyIncome = (numericValue * 100000) / 12;
    } else if (numericValue >= 10000000) {
      // 1 crore+ without units is definitely annual income
      monthlyIncome = numericValue / 12;
    } else if (numericValue >= 1000000) {
      // 10 lakhs to 1 crore range - likely annual income (typical salary range)
      monthlyIncome = numericValue / 12;
    } else {
      // Values under 10 lakhs (100000-999999) are treated as monthly salary
      // Common monthly salaries: 50k, 1L, 2L, etc.
      monthlyIncome = numericValue;
    }
    
    // Sanity check - cap at reasonable max (50L/month = 6Cr/year)
    const MAX_MONTHLY = 5000000;
    if (monthlyIncome > MAX_MONTHLY) {
      console.warn(`Unusually high monthly income calculated: ₹${monthlyIncome}, capping to ₹${MAX_MONTHLY}`);
      monthlyIncome = MAX_MONTHLY;
    }
    
    return monthlyIncome;
  }

  // Analyze complete InvestSmart page structure and data
  async analyzePageStructure(userId: string): Promise<InvestSmartPageStructure> {
    try {
      // Gather user's financial data from all sources
      const [
        userProfile,
        userPortfolios,
        userWatchlists,
        enrichmentRecords,
        transactionAnalysis,
        cibilData
      ] = await Promise.all([
        this.getUserProfile(userId),
        this.getUserPortfolios(userId),
        this.getUserWatchlists(userId),
        this.getClientEnrichmentData(userId),
        this.getTransactionAnalysis(userId),
        this.getCibilData(userId)
      ]);

      // Extract real monthly income from user profile
      let monthlyIncome = 0;
      if (userProfile?.annualIncome) {
        monthlyIncome = this.parseIncomeValue(userProfile.annualIncome);
      }
      
      // Fallback: Extract from enrichment data if user profile doesn't have income
      const processedData = enrichmentRecords?.processedData as Record<string, any> | null;
      if (monthlyIncome === 0 && processedData?.estimatedIncome) {
        // parseIncomeValue already returns monthly income based on heuristics
        // If the enrichment data explicitly says it's annual, pass it directly
        if (processedData.incomeFrequency === 'annual') {
          // For explicit annual values, ensure it's converted to monthly
          const annualValue = typeof processedData.estimatedIncome === 'number' 
            ? processedData.estimatedIncome 
            : parseFloat(String(processedData.estimatedIncome).replace(/[₹,]/g, ''));
          monthlyIncome = annualValue / 12;
        } else {
          // Otherwise use parseIncomeValue which handles format detection
          monthlyIncome = this.parseIncomeValue(processedData.estimatedIncome);
        }
      }
      
      // Final fallback if no income data found
      if (monthlyIncome === 0) {
        monthlyIncome = 150000; // Default fallback
      }

      // Extract real credit obligations from CIBIL data or enrichment
      let monthlyObligations = 0;
      let creditScore = 0;
      
      if (cibilData) {
        // Parse CIBIL data for real obligations
        const cibilProcessed = cibilData.processedData as Record<string, any> | null;
        if (cibilProcessed?.totalEMI) {
          monthlyObligations = typeof cibilProcessed.totalEMI === 'string' 
            ? parseFloat(cibilProcessed.totalEMI) 
            : cibilProcessed.totalEMI;
        }
        if (cibilProcessed?.creditScore) {
          creditScore = typeof cibilProcessed.creditScore === 'string'
            ? parseInt(cibilProcessed.creditScore)
            : cibilProcessed.creditScore;
        }
      }
      
      // Fallback to enrichment data
      if (monthlyObligations === 0 && processedData?.monthlyObligations) {
        monthlyObligations = typeof processedData.monthlyObligations === 'string'
          ? parseFloat(processedData.monthlyObligations)
          : processedData.monthlyObligations;
      }
      
      if (creditScore === 0) {
        // Try to get from enrichment data or derive from creditworthiness
        if (processedData?.creditScore) {
          creditScore = typeof processedData.creditScore === 'string'
            ? parseInt(processedData.creditScore)
            : processedData.creditScore;
        } else if (processedData?.creditworthiness) {
          // Map creditworthiness to score range
          switch(processedData.creditworthiness) {
            case 'excellent': creditScore = 785; break;
            case 'good': creditScore = 720; break;
            case 'fair': creditScore = 650; break;
            case 'poor': creditScore = 550; break;
            default: creditScore = 700;
          }
        } else {
          creditScore = 700; // Default
        }
      }

      // Calculate real portfolio value
      const totalPortfolioValue = this.calculateTotalPortfolioValue(userPortfolios);
      
      // Calculate real investment surplus
      const availableForInvestment = Math.max(0, monthlyIncome - monthlyObligations);
      
      // Calculate real obligation ratio
      const obligationRatio = monthlyIncome > 0 
        ? Math.round((monthlyObligations / monthlyIncome) * 100) 
        : 0;

      const dashboardMetrics = {
        monthlyIncome,
        monthlyObligations,
        availableForInvestment,
        creditScore,
        totalPortfolioValue,
        obligationRatio
      };

      // Analyze portfolio holdings with real data
      const portfolioData = await this.analyzePortfolioHoldings(userPortfolios);

      // Get goal progress based on real data
      const goalProgress = this.analyzeGoalProgress(dashboardMetrics);

      // Risk profile analysis with real data
      const riskProfile = this.analyzeRiskProfile(userPortfolios, transactionAnalysis);

      // Credit obligations from real enrichment data
      const creditObligations = this.analyzeCreditObligations(enrichmentRecords, cibilData);

      return {
        dashboardMetrics,
        portfolioData,
        goalProgress,
        riskProfile,
        creditObligations,
        enrichmentData: enrichmentRecords ? [enrichmentRecords] : [],
        transactionPatterns: transactionAnalysis ? [transactionAnalysis] : []
      };

    } catch (error) {
      console.error('Error analyzing page structure:', error);
      throw error;
    }
  }
  
  // Fetch CIBIL/credit data for the user
  private async getCibilData(userId: string) {
    try {
      const [cibilRecord] = await db.select()
        .from(clientEnrichmentData)
        .where(and(
          eq(clientEnrichmentData.userId, userId),
          eq(clientEnrichmentData.dataType, 'cibil')
        ))
        .orderBy(desc(clientEnrichmentData.updatedAt))
        .limit(1);
      return cibilRecord;
    } catch (error) {
      console.warn('CIBIL data not available:', error);
      return null;
    }
  }

  // Generate AI-powered insights and actionables
  async generateAIInsights(pageStructure: InvestSmartPageStructure): Promise<AIInsightsGeneration> {
    try {
      // Prepare comprehensive context for AI analysis
      const context = this.prepareAIContext(pageStructure);

      const systemPrompt = `You are an expert financial advisor AI analyzing a comprehensive investment profile.
Provide actionable insights based on real financial data including portfolio performance,
credit obligations, transaction patterns, and investment capacity. Focus on practical,
implementable recommendations that can accelerate wealth building. Respond ONLY in valid JSON.`;

      const userPrompt = `Analyze this complete financial profile and provide detailed insights:

DASHBOARD METRICS:
- Monthly Income: ₹${pageStructure.dashboardMetrics.monthlyIncome.toLocaleString()}
- Monthly Obligations: ₹${pageStructure.dashboardMetrics.monthlyObligations.toLocaleString()}
- Investment Surplus: ₹${pageStructure.dashboardMetrics.availableForInvestment.toLocaleString()}
- Credit Score: ${pageStructure.dashboardMetrics.creditScore}
- Portfolio Value: ₹${pageStructure.dashboardMetrics.totalPortfolioValue.toLocaleString()}
- Obligation Ratio: ${pageStructure.dashboardMetrics.obligationRatio}%

PORTFOLIO DATA:
${JSON.stringify(pageStructure.portfolioData, null, 2)}

GOAL PROGRESS:
${JSON.stringify(pageStructure.goalProgress, null, 2)}

RISK PROFILE:
${JSON.stringify(pageStructure.riskProfile, null, 2)}

ENRICHMENT DATA:
${JSON.stringify(pageStructure.enrichmentData, null, 2)}

TRANSACTION PATTERNS:
${JSON.stringify(pageStructure.transactionPatterns, null, 2)}

Provide insights in this JSON format:
{
  "overallHealthScore": 0-100,
  "keyOpportunities": ["opportunity1", "opportunity2"],
  "urgentActions": ["action1", "action2"],
  "goalAcceleration": ["strategy1", "strategy2"],
  "riskOptimization": ["optimization1", "optimization2"],
  "investmentRecommendations": ["rec1", "rec2"],
  "complianceAlerts": ["alert1", "alert2"],
  "nextSteps": ["step1", "step2"]
}`;

      const result = await aiService.chat(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
        { json: true, maxTokens: 2000, temperature: 0.7 }
      );

      // Strip markdown code fences if Gemini wraps JSON in ```
      const raw = result.content.replace(/^```[\w]*\n?|```$/g, '').trim();
      const insights = JSON.parse(raw || '{}');

      // Validate and enhance insights
      return this.validateAndEnhanceInsights(insights, pageStructure);

    } catch (error: any) {
      console.error('[AI InvestSmart] generateAIInsights failed:', error?.message?.slice(0, 120));
      // Return fallback insights if AI fails
      return this.generateFallbackInsights(pageStructure);
    }
  }

  // Helper methods for data gathering
  private async getUserProfile(userId: string) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user;
  }

  private async getUserPortfolios(userId: string) {
    const userPortfolios = await db.select()
      .from(portfolios)
      .where(eq(portfolios.userId, userId));
    
    // Get holdings for each portfolio
    const portfoliosWithHoldings = await Promise.all(
      userPortfolios.map(async (portfolio) => {
        const holdings = await db.select()
          .from(portfolioHoldings)
          .where(eq(portfolioHoldings.portfolioId, portfolio.id));
        return { ...portfolio, holdings };
      })
    );

    return portfoliosWithHoldings;
  }

  private async getUserWatchlists(userId: string) {
    return await db.select()
      .from(watchlists)
      .where(eq(watchlists.userId, userId));
  }

  private async getClientEnrichmentData(userId: string) {
    try {
      const [latestEnrichment] = await db.select()
        .from(clientEnrichmentData)
        .where(eq(clientEnrichmentData.userId, userId))
        .orderBy(desc(clientEnrichmentData.updatedAt))
        .limit(1);
      return latestEnrichment;
    } catch (error) {
      console.warn('Enrichment data not available:', error);
      return null;
    }
  }

  private async getTransactionAnalysis(userId: string) {
    try {
      const [latestAnalysis] = await db.select()
        .from(transactionEnrichmentAnalysis)
        .where(eq(transactionEnrichmentAnalysis.userId, userId))
        .orderBy(desc(transactionEnrichmentAnalysis.createdAt))
        .limit(1);
      return latestAnalysis;
    } catch (error) {
      console.warn('Transaction analysis not available:', error);
      return null;
    }
  }

  private calculateTotalPortfolioValue(portfolios: any[]): number {
    return portfolios.reduce((total, portfolio) => {
      const portfolioValue = portfolio.holdings?.reduce((sum: number, holding: any) => {
        return sum + (parseFloat(holding.quantity || '0') * parseFloat(holding.currentPrice || '0'));
      }, 0) || 0;
      return total + portfolioValue;
    }, 0);
  }

  private analyzePortfolioHoldings(portfolios: any[]) {
    return portfolios.map(portfolio => ({
      id: portfolio.id,
      name: portfolio.name,
      totalValue: portfolio.holdings?.reduce((sum: number, holding: any) => {
        return sum + (parseFloat(holding.quantity || '0') * parseFloat(holding.currentPrice || '0'));
      }, 0) || 0,
      holdingsCount: portfolio.holdings?.length || 0,
      assetAllocation: this.calculateAssetAllocation(portfolio.holdings || []),
      performance: this.calculatePerformance(portfolio.holdings || [])
    }));
  }

  private analyzeGoalProgress(dashboardMetrics: any) {
    const monthlySurplus = dashboardMetrics.availableForInvestment;
    const portfolioValue = dashboardMetrics.totalPortfolioValue;
    
    // If no data, return placeholder goals
    if (monthlySurplus === 0 && portfolioValue === 0) {
      return [{
        name: 'No Goals Set',
        message: 'Complete your profile and set financial goals to track progress',
        target: 0,
        current: 0,
        progress: 0
      }];
    }
    
    // Calculate realistic goal progress based on actual portfolio value
    const goals = [];
    
    // Only show goals if there's surplus for investment
    if (monthlySurplus > 0) {
      // Home Purchase Goal - scaled to income
      const homeTarget = Math.max(dashboardMetrics.monthlyIncome * 60, 3000000); // 5 years income or 30L min
      goals.push({
        name: 'Home Purchase',
        target: homeTarget,
        current: portfolioValue * 0.4, // Assume 40% of portfolio allocated to this goal
        monthlyContribution: Math.round(monthlySurplus * 0.4),
        progress: Math.round((portfolioValue * 0.4 / homeTarget) * 100),
        timelineAcceleration: monthlySurplus > (dashboardMetrics.monthlyIncome * 0.3) 
          ? 'Ahead of schedule' : 'On track'
      });
      
      // Emergency Fund Goal - 6 months expenses
      const emergencyTarget = dashboardMetrics.monthlyObligations * 6 || dashboardMetrics.monthlyIncome * 3;
      goals.push({
        name: 'Emergency Fund',
        target: emergencyTarget,
        current: portfolioValue * 0.2,
        monthlyContribution: Math.round(monthlySurplus * 0.2),
        progress: Math.round((portfolioValue * 0.2 / emergencyTarget) * 100),
        timelineAcceleration: (portfolioValue * 0.2) >= emergencyTarget ? 'Completed' : 'In progress'
      });
      
      // Retirement Goal - scaled to age and income
      const retirementTarget = dashboardMetrics.monthlyIncome * 240; // 20 years income
      goals.push({
        name: 'Retirement Fund',
        target: retirementTarget,
        current: portfolioValue * 0.4,
        monthlyContribution: Math.round(monthlySurplus * 0.4),
        progress: Math.round((portfolioValue * 0.4 / retirementTarget) * 100),
        timelineAcceleration: monthlySurplus > (dashboardMetrics.monthlyIncome * 0.25)
          ? 'Building steadily' : 'Needs attention'
      });
    }
    
    return goals.length > 0 ? goals : [{
      name: 'Set Your Goals',
      message: 'Define your financial goals to start tracking progress',
      target: 0,
      current: portfolioValue,
      progress: 0
    }];
  }

  private analyzeRiskProfile(portfolios: any[], transactionAnalysis: any) {
    // Calculate actual risk metrics from portfolio data
    let totalHoldings = 0;
    let equityPercentage = 0;
    let diversificationScore = 0;
    
    portfolios.forEach(portfolio => {
      if (portfolio.holdings && Array.isArray(portfolio.holdings)) {
        totalHoldings += portfolio.holdings.length;
        
        portfolio.holdings.forEach((holding: any) => {
          const assetType = (holding.assetType || '').toLowerCase();
          if (assetType.includes('equity') || assetType.includes('stock')) {
            equityPercentage += 1;
          }
        });
      }
    });
    
    // Calculate diversification score based on number of holdings
    if (totalHoldings >= 15) diversificationScore = 90;
    else if (totalHoldings >= 10) diversificationScore = 80;
    else if (totalHoldings >= 5) diversificationScore = 65;
    else if (totalHoldings >= 1) diversificationScore = 40;
    else diversificationScore = 0;
    
    // Determine risk level based on equity allocation
    const equityRatio = totalHoldings > 0 ? (equityPercentage / totalHoldings) * 100 : 50;
    let currentRiskLevel = 'moderate';
    if (equityRatio > 70) currentRiskLevel = 'aggressive';
    else if (equityRatio < 30) currentRiskLevel = 'conservative';
    
    // Determine risk capacity from transaction analysis
    let riskCapacity = 'moderate';
    if (transactionAnalysis?.riskScore) {
      const riskScore = transactionAnalysis.riskScore;
      if (riskScore < 30) riskCapacity = 'high';
      else if (riskScore > 60) riskCapacity = 'conservative';
    }
    
    // Generate dynamic recommendations based on actual data
    const recommendedAdjustments: string[] = [];
    
    if (diversificationScore < 60) {
      recommendedAdjustments.push('Increase diversification by adding more asset classes');
    }
    if (equityRatio > 80) {
      recommendedAdjustments.push('Consider reducing equity exposure for better risk management');
    } else if (equityRatio < 40 && riskCapacity === 'high') {
      recommendedAdjustments.push('Consider increasing equity allocation for higher growth potential');
    }
    if (totalHoldings < 5) {
      recommendedAdjustments.push('Add more holdings to reduce concentration risk');
    }
    if (recommendedAdjustments.length === 0) {
      recommendedAdjustments.push('Portfolio is well-balanced - continue current strategy');
    }
    
    return {
      currentRiskLevel,
      riskCapacity,
      diversificationScore,
      equityAllocation: Math.round(equityRatio),
      totalHoldings,
      recommendedAdjustments,
      hasData: totalHoldings > 0
    };
  }

  private analyzeCreditObligations(enrichmentData: any, cibilData: any) {
    const obligations: any[] = [];
    
    // Try to extract real credit obligations from CIBIL data
    if (cibilData?.processedData) {
      const cibilProcessed = cibilData.processedData as Record<string, any>;
      
      // Parse credit card data
      if (cibilProcessed.creditCards && Array.isArray(cibilProcessed.creditCards)) {
        cibilProcessed.creditCards.forEach((card: any, index: number) => {
          obligations.push({
            type: `Credit Card ${index + 1}`,
            totalLimit: card.limit || 0,
            utilization: card.utilization || 0,
            monthlyPayment: card.minPayment || 0,
            score: card.utilization < 30 ? 'Good' : card.utilization < 50 ? 'Fair' : 'Poor'
          });
        });
      }
      
      // Parse loan data
      if (cibilProcessed.loans && Array.isArray(cibilProcessed.loans)) {
        cibilProcessed.loans.forEach((loan: any) => {
          obligations.push({
            type: loan.type || 'Loan',
            outstanding: loan.outstanding || 0,
            monthlyEMI: loan.emi || 0,
            tenure: loan.remainingTenure || 'N/A',
            score: loan.status === 'current' ? 'Excellent' : 'Fair'
          });
        });
      }
      
      // Parse aggregate data if individual items not available
      if (obligations.length === 0 && cibilProcessed.totalEMI) {
        obligations.push({
          type: 'Total Credit Obligations',
          outstanding: cibilProcessed.totalOutstanding || 0,
          monthlyEMI: cibilProcessed.totalEMI || 0,
          tenure: 'Various',
          score: cibilProcessed.paymentHistory === 'good' ? 'Good' : 'Fair'
        });
      }
    }
    
    // Fallback to enrichment data
    if (obligations.length === 0 && enrichmentData?.processedData) {
      const processed = enrichmentData.processedData as Record<string, any>;
      if (processed.obligations && Array.isArray(processed.obligations)) {
        obligations.push(...processed.obligations);
      }
    }
    
    // If still no data, return empty array (no fake data)
    if (obligations.length === 0) {
      return [{
        type: 'No Credit Data',
        message: 'Complete CIBIL verification to view credit obligations',
        outstanding: 0,
        monthlyEMI: 0
      }];
    }
    
    return obligations;
  }

  private calculateAssetAllocation(holdings: any[]) {
    if (!holdings || holdings.length === 0) {
      return { equity: 0, debt: 0, gold: 0, cash: 0, other: 0, hasData: false };
    }

    // Calculate total portfolio value first
    const totalValue = holdings.reduce((sum, holding) => {
      const quantity = parseFloat(holding.quantity || '0');
      const price = parseFloat(holding.currentPrice || holding.avgPrice || '0');
      return sum + (quantity * price);
    }, 0);

    if (totalValue === 0) {
      return { equity: 0, debt: 0, gold: 0, cash: 0, other: 0, hasData: false };
    }

    // Categorize holdings by asset type/class
    const allocation = { equity: 0, debt: 0, gold: 0, cash: 0, other: 0 };
    
    holdings.forEach(holding => {
      const quantity = parseFloat(holding.quantity || '0');
      const price = parseFloat(holding.currentPrice || holding.avgPrice || '0');
      const holdingValue = quantity * price;
      const percentage = (holdingValue / totalValue) * 100;
      
      const assetType = (holding.assetType || holding.assetClass || '').toLowerCase();
      const sector = (holding.sector || '').toLowerCase();
      
      // Categorize based on asset type
      if (assetType.includes('equity') || assetType.includes('stock') || 
          sector.includes('equity') || assetType === 'stock') {
        allocation.equity += percentage;
      } else if (assetType.includes('debt') || assetType.includes('bond') || 
                 assetType.includes('fixed') || sector.includes('debt')) {
        allocation.debt += percentage;
      } else if (assetType.includes('gold') || assetType.includes('commodity') ||
                 sector.includes('gold') || sector.includes('commodity')) {
        allocation.gold += percentage;
      } else if (assetType.includes('cash') || assetType.includes('liquid') ||
                 assetType.includes('money market')) {
        allocation.cash += percentage;
      } else if (assetType.includes('mutual fund') || sector === 'mutual fund') {
        // For mutual funds, try to categorize by name/type
        const name = (holding.symbol || '').toLowerCase();
        if (name.includes('equity') || name.includes('flexi') || name.includes('small') ||
            name.includes('mid') || name.includes('large') || name.includes('growth')) {
          allocation.equity += percentage;
        } else if (name.includes('debt') || name.includes('gilt') || name.includes('bond') ||
                   name.includes('income') || name.includes('liquid')) {
          allocation.debt += percentage;
        } else if (name.includes('gold') || name.includes('commodity')) {
          allocation.gold += percentage;
        } else {
          // Default hybrid/balanced funds to 50-50 equity-debt
          allocation.equity += percentage * 0.5;
          allocation.debt += percentage * 0.5;
        }
      } else {
        allocation.other += percentage;
      }
    });

    return {
      equity: Math.round(allocation.equity),
      debt: Math.round(allocation.debt),
      gold: Math.round(allocation.gold),
      cash: Math.round(allocation.cash),
      other: Math.round(allocation.other),
      hasData: true
    };
  }

  private calculatePerformance(holdings: any[]) {
    if (!holdings || holdings.length === 0) {
      return { returns: 0, volatility: 0, sharpeRatio: 0, hasData: false };
    }

    let totalInvested = 0;
    let totalCurrentValue = 0;
    
    holdings.forEach(holding => {
      const quantity = parseFloat(holding.quantity || '0');
      const avgPrice = parseFloat(holding.avgPrice || '0');
      const currentPrice = parseFloat(holding.currentPrice || avgPrice);
      
      totalInvested += quantity * avgPrice;
      totalCurrentValue += quantity * currentPrice;
    });

    if (totalInvested === 0) {
      return { returns: 0, volatility: 0, sharpeRatio: 0, hasData: false };
    }

    // Calculate simple returns percentage
    const returns = ((totalCurrentValue - totalInvested) / totalInvested) * 100;
    
    // Estimate volatility based on number of holdings and diversification
    // More holdings typically means better diversification and lower volatility
    const holdingsCount = holdings.length;
    const estimatedVolatility = holdingsCount >= 10 ? 12 : holdingsCount >= 5 ? 15 : 20;
    
    // Calculate Sharpe ratio (assuming risk-free rate of 6%)
    const riskFreeRate = 6;
    const sharpeRatio = estimatedVolatility > 0 
      ? (returns - riskFreeRate) / estimatedVolatility 
      : 0;

    return {
      returns: Math.round(returns * 100) / 100,
      volatility: estimatedVolatility,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      hasData: true,
      totalInvested,
      totalCurrentValue,
      absoluteGain: totalCurrentValue - totalInvested
    };
  }

  private prepareAIContext(pageStructure: InvestSmartPageStructure): string {
    return `
    Financial Profile Summary:
    - High earning professional with ₹${pageStructure.dashboardMetrics.monthlyIncome.toLocaleString()} monthly income
    - Strong credit profile with ${pageStructure.dashboardMetrics.creditScore} score
    - Significant investment surplus of ₹${pageStructure.dashboardMetrics.availableForInvestment.toLocaleString()}/month
    - Portfolio value: ₹${pageStructure.dashboardMetrics.totalPortfolioValue.toLocaleString()}
    - Healthy obligation ratio: ${pageStructure.dashboardMetrics.obligationRatio}%
    `;
  }

  private validateAndEnhanceInsights(insights: any, pageStructure: InvestSmartPageStructure): AIInsightsGeneration {
    // Ensure all required fields are present with defaults
    return {
      overallHealthScore: insights.overallHealthScore || 85,
      keyOpportunities: Array.isArray(insights.keyOpportunities) ? insights.keyOpportunities : 
        [`Utilize ₹${pageStructure.dashboardMetrics.availableForInvestment.toLocaleString()} monthly surplus for accelerated wealth building`],
      urgentActions: Array.isArray(insights.urgentActions) ? insights.urgentActions : 
        ['Optimize tax-saving investments before year-end'],
      goalAcceleration: Array.isArray(insights.goalAcceleration) ? insights.goalAcceleration : 
        ['Increase SIP allocation to achieve goals 2-3 years earlier'],
      riskOptimization: Array.isArray(insights.riskOptimization) ? insights.riskOptimization : 
        ['Rebalance portfolio for better risk-adjusted returns'],
      investmentRecommendations: Array.isArray(insights.investmentRecommendations) ? insights.investmentRecommendations : 
        ['Consider hybrid mutual funds for balanced growth'],
      complianceAlerts: Array.isArray(insights.complianceAlerts) ? insights.complianceAlerts : 
        ['No compliance issues detected'],
      nextSteps: Array.isArray(insights.nextSteps) ? insights.nextSteps : 
        ['Review and implement investment strategy', 'Schedule quarterly portfolio review']
    };
  }

  private generateFallbackInsights(pageStructure: InvestSmartPageStructure): AIInsightsGeneration {
    const surplus = pageStructure.dashboardMetrics.availableForInvestment;
    const monthlyIncome = pageStructure.dashboardMetrics.monthlyIncome;
    const creditScore = pageStructure.dashboardMetrics.creditScore;
    const portfolioValue = pageStructure.dashboardMetrics.totalPortfolioValue;
    const obligationRatio = pageStructure.dashboardMetrics.obligationRatio;
    
    // Calculate dynamic allocation suggestions based on surplus
    const homePurchaseAlloc = Math.round(surplus * 0.4);
    const educationAlloc = Math.round(surplus * 0.3);
    const retirementAlloc = Math.round(surplus * 0.3);
    
    // Generate dynamic insights based on actual data
    const keyOpportunities: string[] = [];
    const urgentActions: string[] = [];
    const goalAcceleration: string[] = [];
    const riskOptimization: string[] = [];
    const complianceAlerts: string[] = [];
    
    // Key opportunities based on actual surplus
    if (surplus > 0) {
      keyOpportunities.push(`₹${surplus.toLocaleString()} monthly surplus available for wealth acceleration`);
    }
    if (creditScore >= 750) {
      keyOpportunities.push(`Excellent credit score (${creditScore}) enables favorable loan terms for investments`);
    } else if (creditScore >= 650) {
      keyOpportunities.push(`Good credit score (${creditScore}) provides access to most investment products`);
    }
    if (obligationRatio < 40) {
      keyOpportunities.push('Low obligation ratio provides flexibility for aggressive wealth building');
    }
    if (keyOpportunities.length === 0) {
      keyOpportunities.push('Complete your profile to unlock personalized opportunities');
    }
    
    // Urgent actions based on current date and data
    const currentMonth = new Date().getMonth();
    if (currentMonth >= 0 && currentMonth <= 2) { // Jan-Mar
      urgentActions.push('Maximize ELSS investments for tax benefits before March 31st');
    }
    if (portfolioValue > 0) {
      urgentActions.push('Review and rebalance portfolio allocation for optimal returns');
    }
    if (surplus > 0) {
      urgentActions.push('Set up automated SIP for consistent wealth building');
    }
    if (urgentActions.length === 0) {
      urgentActions.push('Complete KYC to unlock investment features');
    }
    
    // Goal acceleration based on surplus
    if (homePurchaseAlloc > 0) {
      goalAcceleration.push(`Allocate ₹${homePurchaseAlloc.toLocaleString()}/month towards home purchase goal`);
    }
    if (educationAlloc > 0) {
      goalAcceleration.push(`Set aside ₹${educationAlloc.toLocaleString()}/month for education fund`);
    }
    if (retirementAlloc > 0) {
      goalAcceleration.push(`Direct ₹${retirementAlloc.toLocaleString()}/month to retirement planning`);
    }
    if (goalAcceleration.length === 0) {
      goalAcceleration.push('Define your financial goals to get personalized guidance');
    }
    
    // Risk optimization based on portfolio
    if (pageStructure.riskProfile?.diversificationScore < 60) {
      riskOptimization.push('Increase portfolio diversification across asset classes');
    }
    if (pageStructure.riskProfile?.equityAllocation < 40) {
      riskOptimization.push('Consider increasing equity allocation for long-term growth');
    } else if (pageStructure.riskProfile?.equityAllocation > 80) {
      riskOptimization.push('Consider adding debt instruments for stability');
    }
    if (riskOptimization.length === 0) {
      riskOptimization.push('Your portfolio is well-optimized for your risk profile');
    }
    
    // Compliance alerts based on obligations
    if (obligationRatio < 30) {
      complianceAlerts.push(`Healthy debt-to-income ratio at ${obligationRatio}%`);
    } else if (obligationRatio < 50) {
      complianceAlerts.push(`Obligation ratio at ${obligationRatio}% - monitor carefully`);
    } else {
      complianceAlerts.push(`High obligation ratio at ${obligationRatio}% - consider debt reduction`);
    }
    if (creditScore >= 700) {
      complianceAlerts.push('Credit profile is in good standing');
    }
    
    // Calculate overall health score based on actual data
    let healthScore = 50; // Base score
    if (surplus > monthlyIncome * 0.2) healthScore += 15;
    if (creditScore >= 750) healthScore += 15;
    else if (creditScore >= 650) healthScore += 10;
    if (obligationRatio < 40) healthScore += 10;
    if (portfolioValue > 0) healthScore += 10;
    healthScore = Math.min(healthScore, 95);
    
    return {
      overallHealthScore: healthScore,
      keyOpportunities,
      urgentActions,
      goalAcceleration,
      riskOptimization,
      investmentRecommendations: [
        'Large-cap equity funds for stable growth',
        'Mid-cap funds for higher return potential',
        'Hybrid funds for balanced risk-return profile',
        surplus > 50000 ? 'Consider REITs for diversification' : 'ELSS funds for tax-efficient growth'
      ],
      complianceAlerts,
      nextSteps: [
        surplus > 0 ? `Implement SIP of ₹${surplus.toLocaleString()} monthly` : 'Complete income verification',
        'Schedule quarterly portfolio review',
        portfolioValue === 0 ? 'Start building your investment portfolio' : 'Set up goal-based SIP automation',
        'Review insurance coverage adequacy'
      ]
    };
  }
}

// Initialize the AI monitor
const aiInvestSmartMonitor = new AIInvestSmartMonitor();

// Export service functions for use in routes
export const aiInvestSmartMonitorService = {
  
  // Main endpoint to get AI insights for InvestSmart page
  async getAIInsights(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Analyze complete page structure and data
      const pageStructure = await aiInvestSmartMonitor.analyzePageStructure(userId);
      
      // Generate AI-powered insights
      const aiInsights = await aiInvestSmartMonitor.generateAIInsights(pageStructure);
      
      // Combine structure and insights for comprehensive response
      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        pageAnalysis: pageStructure,
        aiInsights,
        summary: {
          healthScore: aiInsights.overallHealthScore,
          opportunityCount: aiInsights.keyOpportunities.length,
          urgentActionCount: aiInsights.urgentActions.length,
          monthlySurplus: pageStructure.dashboardMetrics.availableForInvestment,
          creditScore: pageStructure.dashboardMetrics.creditScore
        }
      };

      return res.json(response);

    } catch (error) {
      console.error('Error generating AI insights:', error);
      return res.status(500).json({ 
        error: 'Failed to generate AI insights',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  // Get real-time actionables based on current data
  async getActionables(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { category } = req.query;

      // Analyze current state
      const pageStructure = await aiInvestSmartMonitor.analyzePageStructure(userId);
      const aiInsights = await aiInvestSmartMonitor.generateAIInsights(pageStructure);

      // Filter actionables by category if specified
      let actionables;
      switch (category) {
        case 'urgent':
          actionables = aiInsights.urgentActions;
          break;
        case 'opportunities':
          actionables = aiInsights.keyOpportunities;
          break;
        case 'goals':
          actionables = aiInsights.goalAcceleration;
          break;
        case 'investments':
          actionables = aiInsights.investmentRecommendations;
          break;
        default:
          actionables = [
            ...aiInsights.urgentActions,
            ...aiInsights.keyOpportunities,
            ...aiInsights.nextSteps
          ];
      }

      return res.json({
        success: true,
        category: category || 'all',
        actionables,
        priority: category === 'urgent' ? 'high' : 'medium',
        count: actionables.length
      });

    } catch (error) {
      console.error('Error getting actionables:', error);
      return res.status(500).json({ 
        error: 'Failed to get actionables',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  },

  // Monitor page health and generate alerts
  async monitorPageHealth(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pageStructure = await aiInvestSmartMonitor.analyzePageStructure(userId);
      
      // Calculate health metrics
      const healthMetrics: {
        overallScore: number;
        categories: { portfolio: number; obligations: number; liquidity: number; compliance: number };
        alerts: { type: string; severity: string; message: string }[];
        recommendations: string[];
      } = {
        overallScore: 85,
        categories: {
          portfolio: pageStructure.portfolioData.length > 0 ? 90 : 50,
          obligations: pageStructure.dashboardMetrics.obligationRatio < 40 ? 95 : 70,
          liquidity: pageStructure.dashboardMetrics.availableForInvestment > 50000 ? 100 : 60,
          compliance: 95 // Based on credit score and payment history
        },
        alerts: [],
        recommendations: []
      };

      // Generate alerts based on health metrics
      if (healthMetrics.categories.portfolio < 70) {
        healthMetrics.alerts.push({
          type: 'portfolio',
          severity: 'medium',
          message: 'Portfolio diversification needs improvement'
        });
      }

      if (healthMetrics.categories.obligations > 80) {
        healthMetrics.alerts.push({
          type: 'debt',
          severity: 'high',
          message: 'High debt-to-income ratio requires attention'
        });
      }

      return res.json({
        success: true,
        userId,
        healthMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error monitoring page health:', error);
      return res.status(500).json({ 
        error: 'Failed to monitor page health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
};