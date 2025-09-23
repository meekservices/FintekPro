import OpenAI from "openai";
import { DatabaseStorage } from "./storage";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a senior portfolio manager and financial advisor with 20+ years of experience. 
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
            - Focus on long-term wealth building aligned with user's profile`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
        max_tokens: 2000
      });

      const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
      
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
    additionalCapital: number = 0
  ): Promise<InvestmentProposal> {
    try {
      const prompt = this.buildInvestmentProposalPrompt(portfolioData, userProfile, additionalCapital);
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a certified financial planner (CFP) and portfolio strategist with expertise in Indian financial markets. 
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
            - Include cost analysis (expense ratios, brokerage, etc.)`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 3000
      });

      const aiResponse = JSON.parse(response.choices[0].message.content || '{}');
      
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

      return proposal;
    } catch (error) {
      console.error('Error generating investment proposal:', error);
      throw new Error('Failed to generate investment proposal');
    }
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