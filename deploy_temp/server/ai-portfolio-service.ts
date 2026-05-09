import { aiService } from "./services/ai-service";
import { DatabaseStorage } from "./storage";

export interface PortfolioData {
  id: string;
  totalValue: number;
  holdings: {
    symbol: string;
    quantity: number;
    currentPrice: number;
    currentValue: number;
    investedValue: number;
    gainLoss: number;
    gainLossPercent: number;
    assetType: string;
    sector?: string;
    exchange: string;
  }[];
  assetAllocation: {
    assetType: string;
    percentage: number;
    currentValue: number;
  }[];
  performance: {
    totalGainLoss: number;
    totalGainLossPercent: number;
    dayChange: number;
    dayChangePercent: number;
  };
}

export interface UserProfile {
  age: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  investmentGoals: string[];
  timeHorizon: number; // years
  monthlyIncome?: number;
  currentInvestments?: number;
  financialGoals?: {
    goal: string;
    targetAmount: number;
    timeframe: number;
  }[];
}

export interface RebalancingRecommendation {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  reasoning: string;
  expectedImpact: string;
  actionRequired: string;
  estimatedCost?: number;
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface InvestmentProposal {
  id: string;
  title: string;
  summary: string;
  totalRecommendedInvestment: number;
  recommendations: {
    assetType: string;
    recommendedAllocation: number;
    currentAllocation: number;
    suggestedInstruments: {
      name: string;
      symbol: string;
      type: string;
      recommendedAmount: number;
      reasoning: string;
      riskLevel: string;
      expectedReturn?: string;
    }[];
    rebalancingActions: RebalancingRecommendation[];
  }[];
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    riskFactors: string[];
    mitigationStrategies: string[];
  };
  expectedOutcomes: {
    shortTerm: string; // 6-12 months
    mediumTerm: string; // 1-3 years
    longTerm: string; // 3+ years
  };
  implementationPlan: {
    phase: number;
    title: string;
    actions: string[];
    timeframe: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  generatedAt: Date;
  validUntil: Date;
}

export class AIPortfolioService {
  constructor(private storage: DatabaseStorage) {}

  async generatePortfolioRebalancingRecommendations(
    portfolioData: PortfolioData, 
    userProfile: UserProfile
  ): Promise<RebalancingRecommendation[]> {
    try {
      const prompt = this.buildRebalancingPrompt(portfolioData, userProfile);
      
      const systemPrompt = `You are a senior portfolio manager and financial advisor with 20+ years of experience. 
Analyze the provided portfolio data and user profile to generate specific, actionable rebalancing recommendations.

Your response must be valid JSON with this exact structure:
{
  "recommendations": [
    {
      "title": "specific recommendation title",
      "priority": "high/medium/low",
      "recommendation": "clear action to take",
      "reasoning": "detailed explanation of why this recommendation is important",
      "expectedImpact": "expected impact on portfolio performance and risk",
      "actionRequired": "specific steps the user needs to take",
      "estimatedCost": 0,
      "timeframe": "immediate/1-3 months/3-6 months",
      "riskLevel": "low/medium/high"
    }
  ]
}

Guidelines:
- Provide 3-7 specific, actionable recommendations
- Consider asset allocation, diversification, risk management, and cost optimization
- Account for user's risk tolerance, age, and investment goals
- Include specific percentages and amounts where appropriate
- Consider tax implications and transaction costs
- Be conservative with high-risk recommendations
- Focus on long-term wealth building aligned with user's profile

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.`;

      const response = await aiService.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ], {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.6,
        maxTokens: 2000
      });

      const aiResponse = JSON.parse(response.content || '{}');
      
      return aiResponse.recommendations?.map((rec: any, index: number) => ({
        id: `rebalance-${Date.now()}-${index}`,
        title: rec.title || 'Portfolio Rebalancing Recommendation',
        priority: rec.priority || 'medium',
        recommendation: rec.recommendation || 'No specific recommendation available',
        reasoning: rec.reasoning || 'Analysis not available',
        expectedImpact: rec.expectedImpact || 'Impact assessment not available',
        actionRequired: rec.actionRequired || 'No action specified',
        estimatedCost: rec.estimatedCost || 0,
        timeframe: rec.timeframe || '1-3 months',
        riskLevel: rec.riskLevel || 'medium'
      })) || [];
    } catch (error) {
      console.error('Error generating rebalancing recommendations:', error);
      return [];
    }
  }

  async generateInvestmentProposal(
    portfolioData: PortfolioData, 
    userProfile: UserProfile,
    additionalCapital: number = 72000,
    clientId?: string
  ): Promise<InvestmentProposal> {
    try {
      const prompt = this.buildInvestmentProposalPrompt(portfolioData, userProfile, additionalCapital);
      
      const systemPrompt = `You are a certified financial planner (CFP) and portfolio strategist with expertise in Indian financial markets. 
Create a comprehensive investment proposal based on the user's current portfolio and profile.

Your response must be valid JSON with this exact structure:
            {
              "title": "comprehensive investment proposal title",
              "summary": "executive summary of the proposal",
              "totalRecommendedInvestment": 100000,
              "recommendations": [
                {
                  "assetType": "Equity/Debt/Gold/Real Estate/etc",
                  "recommendedAllocation": 60,
                  "currentAllocation": 45,
                  "suggestedInstruments": [
                    {
                      "name": "specific fund/stock/bond name",
                      "symbol": "NSE:SYMBOL or mutual fund code",
                      "type": "Large Cap Equity/Debt Fund/etc",
                      "recommendedAmount": 50000,
                      "reasoning": "why this instrument is recommended",
                      "riskLevel": "low/medium/high",
                      "expectedReturn": "8-12% p.a."
                    }
                  ],
                  "rebalancingActions": [
                    {
                      "title": "specific rebalancing action",
                      "priority": "high/medium/low",
                      "recommendation": "clear action",
                      "reasoning": "explanation",
                      "expectedImpact": "impact description",
                      "actionRequired": "steps to take",
                      "timeframe": "immediate/1-3 months/3-6 months",
                      "riskLevel": "low/medium/high"
                    }
                  ]
                }
              ],
              "riskAssessment": {
                "overallRisk": "low/medium/high",
                "riskFactors": ["factor 1", "factor 2"],
                "mitigationStrategies": ["strategy 1", "strategy 2"]
              },
              "expectedOutcomes": {
                "shortTerm": "6-12 month expectations",
                "mediumTerm": "1-3 year expectations", 
                "longTerm": "3+ year expectations"
              },
              "implementationPlan": [
                {
                  "phase": 1,
                  "title": "phase title",
                  "actions": ["action 1", "action 2"],
                  "timeframe": "immediate/1 month/3 months",
                  "priority": "high/medium/low"
                }
              ]
            }
            
            Guidelines:
            - Focus on Indian market instruments (NSE, BSE, Indian mutual funds)
            - Consider Indian tax implications (LTCG, STCG, Section 80C, etc.)
            - Recommend specific, investable instruments
            - Balance growth and stability based on user profile
            - Include emergency fund recommendations if needed
            - Consider inflation impact on goals
            - Account for market volatility and timing risks
            - Provide realistic return expectations
            - Include cost analysis (expense ratios, brokerage, etc.)

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.`;

      const response = await aiService.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ], {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.7,
        maxTokens: 3000
      });

      const aiResponse = JSON.parse(response.content || '{}');
      
      const proposal: InvestmentProposal = {
        id: `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: aiResponse.title || 'Investment Portfolio Proposal',
        summary: aiResponse.summary || 'Comprehensive investment proposal based on your profile and goals.',
        totalRecommendedInvestment: aiResponse.totalRecommendedInvestment || additionalCapital || portfolioData.totalValue * 0.1,
        recommendations: aiResponse.recommendations?.map((rec: any) => ({
          assetType: rec.assetType || 'Mixed Assets',
          recommendedAllocation: rec.recommendedAllocation || 0,
          currentAllocation: rec.currentAllocation || 0,
          suggestedInstruments: rec.suggestedInstruments?.map((inst: any) => ({
            name: inst.name || 'Investment Instrument',
            symbol: inst.symbol || 'N/A',
            type: inst.type || 'Mixed',
            recommendedAmount: inst.recommendedAmount || 0,
            reasoning: inst.reasoning || 'Recommended based on analysis',
            riskLevel: inst.riskLevel || 'medium',
            expectedReturn: inst.expectedReturn || 'Market returns'
          })) || [],
          rebalancingActions: rec.rebalancingActions?.map((action: any, index: number) => ({
            id: `action-${Date.now()}-${index}`,
            title: action.title || 'Rebalancing Action',
            priority: action.priority || 'medium',
            recommendation: action.recommendation || 'Rebalancing recommendation',
            reasoning: action.reasoning || 'Based on portfolio analysis',
            expectedImpact: action.expectedImpact || 'Positive impact expected',
            actionRequired: action.actionRequired || 'Take recommended action',
            timeframe: action.timeframe || '1-3 months',
            riskLevel: action.riskLevel || 'medium'
          })) || []
        })) || [],
        riskAssessment: {
          overallRisk: aiResponse.riskAssessment?.overallRisk || 'medium',
          riskFactors: aiResponse.riskAssessment?.riskFactors || ['Market volatility', 'Economic uncertainty'],
          mitigationStrategies: aiResponse.riskAssessment?.mitigationStrategies || ['Diversification', 'Regular monitoring']
        },
        expectedOutcomes: {
          shortTerm: aiResponse.expectedOutcomes?.shortTerm || 'Portfolio stabilization and risk adjustment',
          mediumTerm: aiResponse.expectedOutcomes?.mediumTerm || 'Steady growth aligned with market performance',
          longTerm: aiResponse.expectedOutcomes?.longTerm || 'Long-term wealth creation and goal achievement'
        },
        implementationPlan: aiResponse.implementationPlan?.map((phase: any) => ({
          phase: phase.phase || 1,
          title: phase.title || 'Implementation Phase',
          actions: phase.actions || ['Execute recommended actions'],
          timeframe: phase.timeframe || '1 month',
          priority: phase.priority || 'medium'
        })) || [],
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Valid for 30 days
      };

      // If clientId is provided, save the proposal to database
      if (clientId) {
        await this.saveAIProposalToDatabase(proposal, clientId, portfolioData.id);
      }

      return proposal;
    } catch (error) {
      console.error('Error generating investment proposal:', error);
      throw new Error('Failed to generate investment proposal');
    }
  }

  /**
   * Generate AI proposal specifically for ₹72,000 monthly surplus allocation
   */
  async generateMonthlySurplusProposal(
    clientId: string,
    portfolioId: string,
    userProfile: UserProfile
  ): Promise<string> {
    try {
      // Get user's current portfolio data
      const portfolio = await this.storage.getPortfolio(portfolioId);
      if (!portfolio) {
        throw new Error('Portfolio not found');
      }

      // Convert portfolio to PortfolioData format
      const portfolioData = await this.convertToPortfolioData(portfolio);

      // Generate AI proposal with ₹72,000 additional capital
      const aiProposal = await this.generateInvestmentProposal(
        portfolioData,
        userProfile,
        72000, // Fixed ₹72,000 monthly surplus
        clientId
      );

      // Save to database as AI-generated proposal
      const dbProposalId = await this.saveAIProposalToDatabase(aiProposal, clientId, portfolioId);
      
      return dbProposalId;
    } catch (error) {
      console.error('Error generating monthly surplus proposal:', error);
      throw new Error('Failed to generate monthly surplus proposal');
    }
  }

  /**
   * Save AI-generated proposal to database
   */
  private async saveAIProposalToDatabase(
    aiProposal: InvestmentProposal,
    clientId: string,
    portfolioId: string
  ): Promise<string> {
    try {
      // Create the main proposal record
      const proposalData = {
        id: aiProposal.id,
        clientId,
        portfolioId,
        proposalSource: 'ai' as const,
        aiModelVersion: 'gemini-2.5-flash',
        aiConfidenceScore: '85.5', // AI confidence score
        title: aiProposal.title,
        description: aiProposal.summary,
        totalInvestmentAmount: aiProposal.totalRecommendedInvestment.toString(),
        riskProfile: aiProposal.riskAssessment.overallRisk,
        timeHorizon: 'medium_term', // Default for monthly surplus
        expectedReturns: '12.0', // Default expected return
        expectedRisk: aiProposal.riskAssessment.overallRisk,
        recommendations: aiProposal.recommendations,
        validUntil: aiProposal.validUntil
      };

      const savedProposal = await this.storage.createInvestmentProposal(proposalData);
      
      // Create proposal items for each recommendation
      for (const recommendation of aiProposal.recommendations) {
        for (const instrument of recommendation.suggestedInstruments) {
          const itemData = {
            proposalId: savedProposal.id,
            productType: this.mapInstrumentTypeToProductType(instrument.type),
            productCode: instrument.symbol,
            productName: instrument.name,
            recommendedAmount: instrument.recommendedAmount.toString(),
            allocationPercentage: ((instrument.recommendedAmount / aiProposal.totalRecommendedInvestment) * 100).toString(),
            investmentType: 'sip', // Default to SIP for monthly surplus
            sipAmount: (instrument.recommendedAmount / 12).toString(), // Monthly SIP amount
            sipFrequency: 'monthly',
            sipDuration: 12, // 1 year duration
            selectionReason: instrument.reasoning,
            expectedOutcome: instrument.expectedReturn || 'Market aligned returns',
            suitabilityScore: 8, // High suitability for AI recommendations
            riskRating: this.mapRiskLevelToRating(instrument.riskLevel)
          };

          await this.storage.createProposalItem(itemData);
        }
      }

      return savedProposal.id;
    } catch (error) {
      console.error('Error saving AI proposal to database:', error);
      throw new Error('Failed to save AI proposal to database');
    }
  }

  /**
   * Convert portfolio data from database format to AI service format
   */
  private async convertToPortfolioData(portfolio: any): Promise<PortfolioData> {
    // This is a simplified conversion - in a real implementation,
    // you would fetch actual holdings and calculate current values
    return {
      id: portfolio.id,
      totalValue: parseFloat(portfolio.totalValue || '100000'),
      holdings: [], // Would be populated from actual holdings
      assetAllocation: [
        { assetType: 'Equity', percentage: 60, currentValue: 60000 },
        { assetType: 'Debt', percentage: 30, currentValue: 30000 },
        { assetType: 'Gold', percentage: 10, currentValue: 10000 }
      ],
      performance: {
        totalGainLoss: 5000,
        totalGainLossPercent: 5.0,
        dayChange: 200,
        dayChangePercent: 0.2
      }
    };
  }

  /**
   * Map instrument type to product type for database
   */
  private mapInstrumentTypeToProductType(instrumentType: string): string {
    const typeMap: {[key: string]: string} = {
      'Large Cap Equity': 'mutual_fund',
      'Mid Cap Equity': 'mutual_fund',
      'Small Cap Equity': 'mutual_fund',
      'Debt Fund': 'mutual_fund',
      'Equity': 'equity',
      'Bond': 'bond',
      'ETF': 'etf',
      'ULIP': 'ulip'
    };
    
    return typeMap[instrumentType] || 'mutual_fund';
  }

  /**
   * Map risk level to database rating
   */
  private mapRiskLevelToRating(riskLevel: string): string {
    const ratingMap: {[key: string]: string} = {
      'low': 'Low',
      'medium': 'Moderate',
      'high': 'High'
    };
    
    return ratingMap[riskLevel] || 'Moderate';
  }

  private buildRebalancingPrompt(portfolioData: PortfolioData, userProfile: UserProfile): string {
    return `
Portfolio Analysis Request:

Current Portfolio (Total Value: ₹${portfolioData.totalValue.toLocaleString('en-IN')}):
Holdings:
${portfolioData.holdings.map(h => `- ${h.symbol}: ${h.quantity} shares @ ₹${h.currentPrice} (Value: ₹${h.currentValue.toLocaleString('en-IN')}, P&L: ${h.gainLossPercent > 0 ? '+' : ''}${h.gainLossPercent.toFixed(2)}%)`).join('\n')}

Current Asset Allocation:
${portfolioData.assetAllocation.map(a => `- ${a.assetType}: ${a.percentage.toFixed(1)}% (₹${a.currentValue.toLocaleString('en-IN')})`).join('\n')}

Portfolio Performance:
- Total P&L: ₹${portfolioData.performance.totalGainLoss.toLocaleString('en-IN')} (${portfolioData.performance.totalGainLossPercent.toFixed(2)}%)
- Day Change: ₹${portfolioData.performance.dayChange.toLocaleString('en-IN')} (${portfolioData.performance.dayChangePercent.toFixed(2)}%)

User Profile:
- Age: ${userProfile.age} years
- Risk Tolerance: ${userProfile.riskTolerance}
- Investment Horizon: ${userProfile.timeHorizon} years
- Monthly Income: ₹${userProfile.monthlyIncome?.toLocaleString('en-IN') || 'Not provided'}
- Investment Goals: ${userProfile.investmentGoals.join(', ')}
${userProfile.financialGoals ? `- Financial Goals: ${userProfile.financialGoals.map(g => `${g.goal} (₹${g.targetAmount.toLocaleString('en-IN')} in ${g.timeframe} years)`).join(', ')}` : ''}

Please analyze this portfolio and provide specific rebalancing recommendations to optimize risk-return profile and alignment with user goals.
    `;
  }

  private buildInvestmentProposalPrompt(
    portfolioData: PortfolioData, 
    userProfile: UserProfile, 
    additionalCapital: number
  ): string {
    return `
Investment Proposal Request:

Current Portfolio Overview:
- Total Value: ₹${portfolioData.totalValue.toLocaleString('en-IN')}
- Number of Holdings: ${portfolioData.holdings.length}
- Overall Performance: ${portfolioData.performance.totalGainLossPercent.toFixed(2)}% P&L

Current Holdings:
${portfolioData.holdings.slice(0, 10).map(h => `- ${h.symbol} (${h.assetType}): ₹${h.currentValue.toLocaleString('en-IN')}`).join('\n')}
${portfolioData.holdings.length > 10 ? `... and ${portfolioData.holdings.length - 10} more holdings` : ''}

Asset Allocation:
${portfolioData.assetAllocation.map(a => `- ${a.assetType}: ${a.percentage.toFixed(1)}%`).join('\n')}

User Profile:
- Age: ${userProfile.age} years (${userProfile.age < 35 ? 'Young investor' : userProfile.age < 50 ? 'Mid-career' : 'Pre-retirement'})
- Risk Profile: ${userProfile.riskTolerance.toUpperCase()}
- Investment Timeline: ${userProfile.timeHorizon} years
- Monthly Income: ₹${userProfile.monthlyIncome?.toLocaleString('en-IN') || 'Not disclosed'}
- Investment Objectives: ${userProfile.investmentGoals.join(', ')}

${additionalCapital > 0 ? `Additional Investment Capital Available: ₹${additionalCapital.toLocaleString('en-IN')}` : ''}

Financial Goals:
${userProfile.financialGoals?.map(g => `- ${g.goal}: Target ₹${g.targetAmount.toLocaleString('en-IN')} in ${g.timeframe} years`).join('\n') || '- No specific goals provided'}

Create a comprehensive investment proposal that includes both optimization of existing holdings and recommendations for new investments. Focus on Indian market opportunities, tax efficiency, and alignment with the user's risk profile and goals.
    `;
  }
}

export default AIPortfolioService;