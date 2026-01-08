import { db } from "../db";
import { 
  prospectClients, 
  prospectProposals,
  prospectProposalEvents,
  InsertProspectClient,
  users,
  onboardingInvitations
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { aiInvestmentOrchestrator } from "./ai-investment-orchestrator";

// Real mutual fund recommendations based on risk profile - Using Regular plans for agent advisory
// Organized by asset class for flexible category-based filtering
const FUND_RECOMMENDATIONS_BY_CATEGORY = {
  equity: {
    conservative: [
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '14.5', returns3Y: '15.8', returns5Y: '15.2', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: '17.2', returns3Y: '18.8', returns5Y: '18.5', risk: 'Moderately High' },
      { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '14.5', returns3Y: '15.8', returns5Y: '15.2', risk: 'Moderate' },
      { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: '21.2', returns3Y: '22.8', returns5Y: '20.5', risk: 'High' },
    ],
    aggressive: [
      { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: '27.2', returns3Y: '33.5', returns5Y: '30.8', risk: 'Very High' },
      { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: '25.5', returns3Y: '31.2', returns5Y: '27.5', risk: 'Very High' },
      { name: 'Axis Midcap Fund - Regular (G)', amc: 'Axis', category: 'Equity - Mid Cap', returns1Y: '19.2', returns3Y: '21.5', returns5Y: '20.2', risk: 'High' },
      { name: 'HDFC Flexi Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Flexi Cap', returns1Y: '15.8', returns3Y: '17.2', returns5Y: '16.1', risk: 'Moderately High' },
    ],
    very_aggressive: [
      { name: 'Quant Active Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: '31.2', returns3Y: '36.5', returns5Y: '34.2', risk: 'Very High' },
      { name: 'Tata Small Cap Fund - Regular (G)', amc: 'Tata', category: 'Equity - Small Cap', returns1Y: '28.8', returns3Y: '34.8', returns5Y: '31.5', risk: 'Very High' },
      { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: '27.5', returns3Y: '32.8', returns5Y: '29.2', risk: 'Very High' },
      { name: 'Motilal Oswal Midcap Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Equity - Mid Cap', returns1Y: '23.2', returns3Y: '27.5', returns5Y: '24.0', risk: 'High' },
      { name: 'ICICI Pru Technology Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Sectoral - Technology', returns1Y: '21.2', returns3Y: '24.8', returns5Y: '23.5', risk: 'Very High' },
    ]
  },
  debt: {
    conservative: [
      { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Corporate Bond', returns1Y: '7.2', returns3Y: '7.6', returns5Y: '7.9', risk: 'Low' },
      { name: 'SBI Magnum Medium Duration Fund - Regular (G)', amc: 'SBI', category: 'Debt - Medium Duration', returns1Y: '6.8', returns3Y: '7.2', returns5Y: '7.5', risk: 'Low' },
      { name: 'Axis Banking & PSU Debt Fund - Regular (G)', amc: 'Axis', category: 'Debt - Banking & PSU', returns1Y: '7.0', returns3Y: '7.4', returns5Y: '7.5', risk: 'Low' },
    ],
    moderate: [
      { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Corporate Bond', returns1Y: '7.1', returns3Y: '7.5', returns5Y: '7.8', risk: 'Low' },
      { name: 'HDFC Short Term Debt Fund - Regular (G)', amc: 'HDFC', category: 'Debt - Short Duration', returns1Y: '6.9', returns3Y: '7.3', returns5Y: '7.4', risk: 'Low' },
    ],
    aggressive: [
      { name: 'ICICI Pru Credit Risk Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt - Credit Risk', returns1Y: '7.5', returns3Y: '7.8', returns5Y: '8.0', risk: 'Moderate' },
    ],
    very_aggressive: [
      { name: 'SBI Dynamic Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt - Dynamic Bond', returns1Y: '7.3', returns3Y: '7.7', returns5Y: '7.9', risk: 'Moderate' },
    ]
  },
  hybrid: {
    conservative: [
      { name: 'HDFC Balanced Advantage Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid - Balanced Advantage', returns1Y: '11.8', returns3Y: '13.5', returns5Y: '13.1', risk: 'Moderate' },
      { name: 'ICICI Pru Equity & Debt Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Hybrid - Aggressive', returns1Y: '12.5', returns3Y: '14.2', returns5Y: '13.8', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'HDFC Hybrid Equity Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid - Aggressive', returns1Y: '14.0', returns3Y: '14.8', returns5Y: '13.5', risk: 'Moderate' },
      { name: 'Kotak Equity Hybrid Fund - Regular (G)', amc: 'Kotak', category: 'Hybrid - Aggressive', returns1Y: '13.5', returns3Y: '14.5', returns5Y: '13.2', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'ICICI Pru Multi Asset Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Hybrid - Multi Asset', returns1Y: '15.2', returns3Y: '15.8', returns5Y: '14.5', risk: 'Moderately High' },
    ],
    very_aggressive: [
      { name: 'Quant Multi Asset Fund - Regular (G)', amc: 'Quant', category: 'Hybrid - Multi Asset', returns1Y: '18.5', returns3Y: '19.2', returns5Y: '17.8', risk: 'Moderately High' },
    ]
  },
  gold_fof: {
    conservative: [
      { name: 'SBI Gold Fund - Regular (G)', amc: 'SBI', category: 'FOF - Gold', returns1Y: '14.2', returns3Y: '12.8', returns5Y: '11.5', risk: 'Moderate' },
      { name: 'HDFC Gold Fund - Regular (G)', amc: 'HDFC', category: 'FOF - Gold', returns1Y: '13.8', returns3Y: '12.5', returns5Y: '11.2', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'Nippon India Gold Savings Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Gold', returns1Y: '14.0', returns3Y: '12.6', returns5Y: '11.3', risk: 'Moderate' },
      { name: 'Axis Gold Fund - Regular (G)', amc: 'Axis', category: 'FOF - Gold', returns1Y: '13.9', returns3Y: '12.4', returns5Y: '11.1', risk: 'Moderate' },
    ],
    aggressive: [
      { name: 'Kotak Gold Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Gold', returns1Y: '14.1', returns3Y: '12.7', returns5Y: '11.4', risk: 'Moderate' },
    ],
    very_aggressive: [
      { name: 'ICICI Pru Regular Gold Savings Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Gold', returns1Y: '13.7', returns3Y: '12.3', returns5Y: '11.0', risk: 'Moderate' },
    ]
  },
  silver_fof: {
    conservative: [
      { name: 'ICICI Pru Silver ETF FOF - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Silver', returns1Y: '18.5', returns3Y: '15.2', returns5Y: '12.8', risk: 'High' },
    ],
    moderate: [
      { name: 'Nippon India Silver ETF FOF - Regular (G)', amc: 'Nippon India', category: 'FOF - Silver', returns1Y: '18.2', returns3Y: '15.0', returns5Y: '12.5', risk: 'High' },
    ],
    aggressive: [
      { name: 'Aditya Birla Sun Life Silver ETF FOF - Regular (G)', amc: 'Aditya Birla', category: 'FOF - Silver', returns1Y: '18.8', returns3Y: '15.5', returns5Y: '13.0', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Kotak Silver ETF FOF - Regular (G)', amc: 'Kotak', category: 'FOF - Silver', returns1Y: '19.0', returns3Y: '15.8', returns5Y: '13.2', risk: 'High' },
    ]
  },
  index_fund: {
    conservative: [
      { name: 'UTI Nifty 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund - Large Cap', returns1Y: '13.5', returns3Y: '14.8', returns5Y: '13.8', risk: 'Moderate' },
    ],
    moderate: [
      { name: 'HDFC Index Fund - Nifty 50 Plan - Regular (G)', amc: 'HDFC', category: 'Index Fund - Large Cap', returns1Y: '13.4', returns3Y: '14.7', returns5Y: '13.7', risk: 'Moderate' },
      { name: 'UTI Nifty Next 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund - Large & Mid Cap', returns1Y: '22.5', returns3Y: '18.2', returns5Y: '15.8', risk: 'High' },
    ],
    aggressive: [
      { name: 'Motilal Oswal Nifty Midcap 150 Index Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Index Fund - Mid Cap', returns1Y: '28.5', returns3Y: '22.8', returns5Y: '18.5', risk: 'High' },
    ],
    very_aggressive: [
      { name: 'Nippon India Nifty Smallcap 250 Index Fund - Regular (G)', amc: 'Nippon India', category: 'Index Fund - Small Cap', returns1Y: '32.5', returns3Y: '26.8', returns5Y: '21.5', risk: 'Very High' },
    ]
  }
};

// Legacy format for backward compatibility
const REAL_FUND_RECOMMENDATIONS = {
  conservative: [
    { name: 'HDFC Balanced Advantage Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid', returns1Y: '11.8', returns3Y: '13.5', returns5Y: '13.1', risk: 'Moderate' },
    { name: 'ICICI Pru Corporate Bond Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Debt', returns1Y: '7.2', returns3Y: '7.6', returns5Y: '7.9', risk: 'Low' },
    { name: 'SBI Magnum Medium Duration Fund - Regular (G)', amc: 'SBI', category: 'Debt', returns1Y: '6.8', returns3Y: '7.2', returns5Y: '7.5', risk: 'Low' },
    { name: 'Axis Banking & PSU Debt Fund - Regular (G)', amc: 'Axis', category: 'Debt', returns1Y: '7.0', returns3Y: '7.4', returns5Y: '7.5', risk: 'Low' },
    { name: 'SBI Gold Fund - Regular (G)', amc: 'SBI', category: 'FOF - Gold', returns1Y: '14.2', returns3Y: '12.8', returns5Y: '11.5', risk: 'Moderate' },
  ],
  moderate: [
    { name: 'Parag Parikh Flexi Cap Fund - Regular (G)', amc: 'PPFAS', category: 'Equity - Flexi Cap', returns1Y: '17.2', returns3Y: '18.8', returns5Y: '18.5', risk: 'Moderately High' },
    { name: 'Mirae Asset Large Cap Fund - Regular (G)', amc: 'Mirae Asset', category: 'Equity - Large Cap', returns1Y: '14.5', returns3Y: '15.8', returns5Y: '15.2', risk: 'Moderate' },
    { name: 'Kotak Emerging Equity Fund - Regular (G)', amc: 'Kotak', category: 'Equity - Mid Cap', returns1Y: '21.2', returns3Y: '22.8', returns5Y: '20.5', risk: 'High' },
    { name: 'HDFC Hybrid Equity Fund - Regular (G)', amc: 'HDFC', category: 'Hybrid', returns1Y: '14.0', returns3Y: '14.8', returns5Y: '13.5', risk: 'Moderate' },
    { name: 'SBI Corporate Bond Fund - Regular (G)', amc: 'SBI', category: 'Debt', returns1Y: '7.1', returns3Y: '7.5', returns5Y: '7.8', risk: 'Low' },
    { name: 'Nippon India Gold Savings Fund - Regular (G)', amc: 'Nippon India', category: 'FOF - Gold', returns1Y: '14.0', returns3Y: '12.6', returns5Y: '11.3', risk: 'Moderate' },
  ],
  aggressive: [
    { name: 'Quant Small Cap Fund - Regular (G)', amc: 'Quant', category: 'Equity - Small Cap', returns1Y: '27.2', returns3Y: '33.5', returns5Y: '30.8', risk: 'Very High' },
    { name: 'Nippon India Small Cap Fund - Regular (G)', amc: 'Nippon India', category: 'Equity - Small Cap', returns1Y: '25.5', returns3Y: '31.2', returns5Y: '27.5', risk: 'Very High' },
    { name: 'Axis Midcap Fund - Regular (G)', amc: 'Axis', category: 'Equity - Mid Cap', returns1Y: '19.2', returns3Y: '21.5', returns5Y: '20.2', risk: 'High' },
    { name: 'HDFC Flexi Cap Fund - Regular (G)', amc: 'HDFC', category: 'Equity - Flexi Cap', returns1Y: '15.8', returns3Y: '17.2', returns5Y: '16.1', risk: 'Moderately High' },
    { name: 'UTI Nifty 50 Index Fund - Regular (G)', amc: 'UTI', category: 'Index Fund', returns1Y: '13.5', returns3Y: '14.8', returns5Y: '13.8', risk: 'Moderate' },
    { name: 'Kotak Gold Fund - Regular (G)', amc: 'Kotak', category: 'FOF - Gold', returns1Y: '14.1', returns3Y: '12.7', returns5Y: '11.4', risk: 'Moderate' },
  ],
  very_aggressive: [
    { name: 'Quant Active Fund - Regular (G)', amc: 'Quant', category: 'Equity - Multi Cap', returns1Y: '31.2', returns3Y: '36.5', returns5Y: '34.2', risk: 'Very High' },
    { name: 'Tata Small Cap Fund - Regular (G)', amc: 'Tata', category: 'Equity - Small Cap', returns1Y: '28.8', returns3Y: '34.8', returns5Y: '31.5', risk: 'Very High' },
    { name: 'SBI Small Cap Fund - Regular (G)', amc: 'SBI', category: 'Equity - Small Cap', returns1Y: '27.5', returns3Y: '32.8', returns5Y: '29.2', risk: 'Very High' },
    { name: 'Motilal Oswal Midcap Fund - Regular (G)', amc: 'Motilal Oswal', category: 'Equity - Mid Cap', returns1Y: '23.2', returns3Y: '27.5', returns5Y: '24.0', risk: 'High' },
    { name: 'ICICI Pru Technology Fund - Regular (G)', amc: 'ICICI Prudential', category: 'Sectoral - Technology', returns1Y: '21.2', returns3Y: '24.8', returns5Y: '23.5', risk: 'Very High' },
    { name: 'ICICI Pru Regular Gold Savings Fund - Regular (G)', amc: 'ICICI Prudential', category: 'FOF - Gold', returns1Y: '13.7', returns3Y: '12.3', returns5Y: '11.0', risk: 'Moderate' },
  ]
};

// Product categories available for agent selection
export const PRODUCT_CATEGORIES = [
  { id: 'equity', label: 'Equity Mutual Funds', description: 'Large cap, mid cap, small cap, flexi cap funds' },
  { id: 'debt', label: 'Debt Mutual Funds', description: 'Corporate bonds, government securities, short duration' },
  { id: 'hybrid', label: 'Hybrid Funds', description: 'Balanced advantage, aggressive hybrid, multi-asset' },
  { id: 'gold_fof', label: 'Gold FOF', description: 'Gold Fund of Funds for portfolio hedging' },
  { id: 'silver_fof', label: 'Silver FOF', description: 'Silver ETF Fund of Funds' },
  { id: 'index_fund', label: 'Index Funds', description: 'Passive funds tracking Nifty, Sensex indices' },
];

// Export for API access
export { FUND_RECOMMENDATIONS_BY_CATEGORY };

// Target allocations by risk profile
const TARGET_ALLOCATIONS = {
  conservative: { equity: 30, debt: 50, hybrid: 15, gold: 5 },
  moderate: { equity: 50, debt: 30, hybrid: 15, gold: 5 },
  aggressive: { equity: 70, debt: 15, hybrid: 10, gold: 5 },
  very_aggressive: { equity: 85, debt: 5, hybrid: 5, gold: 5 }
};

export interface ProspectPortfolioHolding {
  productType: string;
  productName: string;
  quantity: number;
  currentValue: number;
  purchasePrice?: number;
  purchaseDate?: string;
  isin?: string;
  category?: string;
}

export interface ProspectRiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive' | 'very_aggressive';
  investmentHorizon: 'short_term' | 'medium_term' | 'long_term';
  primaryGoal: string;
  monthlyIncome?: number;
  existingInvestments?: number;
  liquidityNeeds?: 'low' | 'medium' | 'high';
}

export interface PortfolioAnalysis {
  totalValue: number;
  assetAllocation: Record<string, { value: number; percentage: number }>;
  riskScore: number;
  diversificationScore: number;
  recommendations: {
    type: 'warning' | 'suggestion' | 'opportunity';
    message: string;
    action?: string;
  }[];
  topPerformers: ProspectPortfolioHolding[];
  underperformers: ProspectPortfolioHolding[];
}

export interface RebalanceRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
  productType: string;
  productName: string;
  currentValue?: number;
  suggestedValue?: number;
  changeAmount: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  taxImplications?: string;
}

export interface FreshInvestmentSuggestion {
  productType: string;
  productName: string;
  productId?: string;
  suggestedAmount: number;
  expectedReturn: string;
  riskLevel: string;
  matchScore: number;
  rationale: string;
  highlights: string[];
}

export interface CombinedProposal {
  prospectId: string;
  proposalId: string;
  shareToken: string;
  analysis: PortfolioAnalysis;
  rebalancing: RebalanceRecommendation[];
  freshInvestments: FreshInvestmentSuggestion[];
  totalSellAmount: number;
  totalBuyAmount: number;
  netInvestmentRequired: number;
  projectedValue: number;
  projectedReturn: string;
  executiveSummary: string;
}

class AgentProspectWizardService {
  async createProspect(agentId: string, data: Omit<InsertProspectClient, 'agentId'>): Promise<string> {
    const [prospect] = await db.insert(prospectClients).values({
      ...data,
      agentId,
      state: 'prospect',
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning({ id: prospectClients.id });
    
    return prospect.id;
  }

  async getProspect(prospectId: string) {
    const [prospect] = await db.select()
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);
    return prospect;
  }

  async getAgentProspects(agentId: string) {
    return db.select()
      .from(prospectClients)
      .where(eq(prospectClients.agentId, agentId))
      .orderBy(desc(prospectClients.createdAt));
  }

  async updateProspectPortfolio(prospectId: string, holdings: ProspectPortfolioHolding[]) {
    await db.update(prospectClients)
      .set({ 
        currentPortfolio: holdings,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));
  }

  async updateProspectRiskProfile(prospectId: string, riskProfile: ProspectRiskProfile) {
    await db.update(prospectClients)
      .set({ 
        indicativeRiskProfile: riskProfile.riskTolerance,
        investmentHorizon: riskProfile.investmentHorizon,
        investmentGoals: riskProfile.primaryGoal,
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));
  }

  analyzePortfolio(holdings: ProspectPortfolioHolding[], riskProfile: ProspectRiskProfile): PortfolioAnalysis {
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    
    const assetAllocation: Record<string, { value: number; percentage: number }> = {};
    holdings.forEach(h => {
      if (!assetAllocation[h.productType]) {
        assetAllocation[h.productType] = { value: 0, percentage: 0 };
      }
      assetAllocation[h.productType].value += h.currentValue;
    });
    Object.keys(assetAllocation).forEach(key => {
      assetAllocation[key].percentage = totalValue > 0 
        ? Math.round((assetAllocation[key].value / totalValue) * 100) 
        : 0;
    });

    const numAssetClasses = Object.keys(assetAllocation).length;
    const diversificationScore = Math.min(100, numAssetClasses * 15 + 25);
    
    let riskScore = 50;
    const equityWeight = (assetAllocation['equity']?.percentage || 0) + 
                        (assetAllocation['mutual_fund']?.percentage || 0) * 0.6;
    riskScore = Math.min(100, Math.max(0, 30 + equityWeight));

    const recommendations: PortfolioAnalysis['recommendations'] = [];
    
    if (numAssetClasses < 3) {
      recommendations.push({
        type: 'warning',
        message: 'Portfolio is under-diversified. Consider adding more asset classes.',
        action: 'Diversify'
      });
    }
    
    if (equityWeight > 80 && riskProfile.riskTolerance === 'conservative') {
      recommendations.push({
        type: 'warning',
        message: 'Equity exposure is too high for your risk profile.',
        action: 'Reduce equity allocation'
      });
    }
    
    if (!assetAllocation['bond'] && !assetAllocation['fd']) {
      recommendations.push({
        type: 'suggestion',
        message: 'Consider adding fixed-income instruments for stability.',
        action: 'Add bonds/FDs'
      });
    }

    const sortedByValue = [...holdings].sort((a, b) => b.currentValue - a.currentValue);
    
    return {
      totalValue,
      assetAllocation,
      riskScore,
      diversificationScore,
      recommendations,
      topPerformers: sortedByValue.slice(0, 3),
      underperformers: sortedByValue.slice(-3).reverse()
    };
  }

  generateRebalancingRecommendations(
    holdings: ProspectPortfolioHolding[], 
    riskProfile: ProspectRiskProfile,
    analysis: PortfolioAnalysis
  ): RebalanceRecommendation[] {
    const recommendations: RebalanceRecommendation[] = [];
    const totalValue = analysis.totalValue;
    
    const targetAllocations: Record<string, number> = {
      conservative: { equity: 30, debt: 50, gold: 10, cash: 10 },
      moderate: { equity: 50, debt: 35, gold: 10, cash: 5 },
      aggressive: { equity: 70, debt: 20, gold: 5, cash: 5 },
      very_aggressive: { equity: 85, debt: 10, gold: 5, cash: 0 }
    }[riskProfile.riskTolerance] as any || { equity: 50, debt: 35, gold: 10, cash: 5 };

    const currentEquity = (analysis.assetAllocation['equity']?.percentage || 0) +
                         (analysis.assetAllocation['mutual_fund']?.percentage || 0) * 0.7;
    const targetEquity = targetAllocations.equity;
    
    if (currentEquity > targetEquity + 10) {
      const excessPercent = currentEquity - targetEquity;
      const excessValue = (excessPercent / 100) * totalValue;
      
      const equityHoldings = holdings.filter(h => 
        h.productType === 'equity' || h.productType === 'mutual_fund'
      ).sort((a, b) => b.currentValue - a.currentValue);
      
      if (equityHoldings.length > 0) {
        recommendations.push({
          action: 'SELL',
          productType: equityHoldings[0].productType,
          productName: equityHoldings[0].productName,
          currentValue: equityHoldings[0].currentValue,
          suggestedValue: equityHoldings[0].currentValue - excessValue,
          changeAmount: -excessValue,
          rationale: `Reduce equity exposure from ${currentEquity.toFixed(0)}% to target ${targetEquity}% to align with ${riskProfile.riskTolerance} risk profile`,
          priority: 'high',
          taxImplications: 'LTCG may apply if held > 1 year'
        });
      }
    } else if (currentEquity < targetEquity - 10) {
      const deficitPercent = targetEquity - currentEquity;
      const deficitValue = (deficitPercent / 100) * totalValue;
      
      recommendations.push({
        action: 'BUY',
        productType: 'mutual_fund',
        productName: 'Diversified Equity Fund',
        changeAmount: deficitValue,
        rationale: `Increase equity allocation from ${currentEquity.toFixed(0)}% to target ${targetEquity}% for better growth potential`,
        priority: 'medium'
      });
    }

    holdings.forEach(h => {
      if (!['equity', 'mutual_fund', 'bond', 'fd', 'gold', 'etf'].includes(h.productType)) {
        recommendations.push({
          action: 'SELL',
          productType: h.productType,
          productName: h.productName,
          currentValue: h.currentValue,
          changeAmount: -h.currentValue,
          rationale: 'Non-standard asset. Consider switching to regulated products for better liquidity and transparency.',
          priority: 'low'
        });
      }
    });

    return recommendations;
  }

  async generateFreshInvestmentSuggestions(
    riskProfile: ProspectRiskProfile,
    investmentAmount: number,
    existingHoldings: ProspectPortfolioHolding[],
    customAllocations?: { equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number },
    selectedCategories?: string[]
  ): Promise<FreshInvestmentSuggestion[]> {
    const suggestions: FreshInvestmentSuggestion[] = [];
    
    // Default allocations based on risk profile
    const defaultAllocations: Record<string, { equity: number; debt: number; hybrid: number; gold: number; silver: number; index: number }> = {
      conservative: { equity: 25, debt: 45, hybrid: 15, gold: 10, silver: 0, index: 5 },
      moderate: { equity: 40, debt: 25, hybrid: 15, gold: 10, silver: 0, index: 10 },
      aggressive: { equity: 55, debt: 10, hybrid: 10, gold: 10, silver: 5, index: 10 },
      very_aggressive: { equity: 65, debt: 5, hybrid: 5, gold: 10, silver: 5, index: 10 }
    };
    
    // Use custom allocations if provided and has non-zero values, otherwise use defaults
    const hasValidCustomAllocations = customAllocations && 
      (customAllocations.equity > 0 || customAllocations.debt > 0 || customAllocations.hybrid > 0 || 
       customAllocations.gold > 0 || (customAllocations.silver || 0) > 0 || (customAllocations.index || 0) > 0);
    
    const allocations = hasValidCustomAllocations 
      ? { ...defaultAllocations.moderate, ...customAllocations }
      : defaultAllocations[riskProfile.riskTolerance] || defaultAllocations.moderate;
    
    console.log('[Agent Wizard] Using allocations:', JSON.stringify(allocations), 'Custom:', hasValidCustomAllocations);
    
    // Use selected categories if provided with items, otherwise default to main categories
    const hasValidCategories = selectedCategories && selectedCategories.length > 0;
    const categories = hasValidCategories 
      ? selectedCategories 
      : ['equity', 'debt', 'hybrid', 'gold_fof', 'index_fund'];
    
    console.log('[Agent Wizard] Using categories:', categories, 'Custom:', hasValidCategories);
    
    // Map allocation keys to category keys
    const allocationToCategory: Record<string, string> = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      gold: 'gold_fof',
      silver: 'silver_fof',
      index: 'index_fund'
    };
    
    const categoryToAllocation: Record<string, string> = {
      equity: 'equity',
      debt: 'debt',
      hybrid: 'hybrid',
      gold_fof: 'gold',
      silver_fof: 'silver',
      index_fund: 'index'
    };
    
    // Filter allocations to only include selected categories
    let filteredAllocations: { category: string; allocation: number }[] = [];
    let totalAllocation = 0;
    
    for (const category of categories) {
      const allocationKey = categoryToAllocation[category] || category;
      const allocation = (allocations as any)[allocationKey] || 0;
      if (allocation > 0) {
        filteredAllocations.push({ category, allocation });
        totalAllocation += allocation;
      }
    }
    
    // Normalize allocations to sum to 100% if needed
    if (totalAllocation > 0 && totalAllocation !== 100) {
      const scaleFactor = 100 / totalAllocation;
      filteredAllocations = filteredAllocations.map(a => ({
        ...a,
        allocation: Math.round(a.allocation * scaleFactor)
      }));
    }
    
    // Generate suggestions for each category based on allocations
    let matchScoreCounter = 95;
    
    for (const { category, allocation } of filteredAllocations) {
      if (allocation === 0) continue;
      
      const categoryFunds = (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.[riskProfile.riskTolerance] || 
                            (FUND_RECOMMENDATIONS_BY_CATEGORY as any)[category]?.moderate || [];
      
      if (categoryFunds.length === 0) continue;
      
      // Calculate amount for this category
      const categoryAmount = Math.round((allocation / 100) * investmentAmount);
      
      // Distribute among funds in this category
      const fundsToUse = categoryFunds.slice(0, 2); // Max 2 funds per category
      const amountPerFund = Math.round(categoryAmount / fundsToUse.length);
      
      fundsToUse.forEach((fund: any, index: number) => {
        const fundAmount = index === fundsToUse.length - 1 
          ? categoryAmount - (amountPerFund * index) // Last fund gets remainder
          : amountPerFund;
        
        if (fundAmount <= 0) return;
        
        suggestions.push({
          productType: 'mutual_fund',
          productName: fund.name,
          suggestedAmount: fundAmount,
          expectedReturn: `${fund.returns3Y}%`,
          riskLevel: fund.risk.toLowerCase(),
          matchScore: matchScoreCounter--,
          rationale: `Recommended ${fund.category} fund from ${fund.amc} with strong ${fund.returns3Y}% 3-year returns. Suitable for ${riskProfile.investmentHorizon.replace('_', ' ')} horizon.`,
          highlights: [
            `AMC: ${fund.amc}`,
            `Category: ${fund.category}`,
            `1Y Returns: ${fund.returns1Y}%`,
            `3Y Returns: ${fund.returns3Y}%`,
            `5Y Returns: ${fund.returns5Y}%`,
            `Risk: ${fund.risk}`
          ],
          amc: fund.amc,
          category: fund.category,
          returns1Y: fund.returns1Y,
          returns3Y: fund.returns3Y,
          returns5Y: fund.returns5Y,
          riskRating: fund.risk,
          allocationPercentage: Math.round((fundAmount / investmentAmount) * 100),
          recommendedAmount: fundAmount,
          selectionReason: `Selected based on ${riskProfile.riskTolerance} risk profile, ${allocation}% ${category} allocation, and ${fund.returns3Y}% historical 3-year CAGR performance.`
        } as any);
      });
    }
    
    // Fallback to legacy recommendations if no suggestions generated
    if (suggestions.length === 0) {
      const realFunds = REAL_FUND_RECOMMENDATIONS[riskProfile.riskTolerance] || REAL_FUND_RECOMMENDATIONS.moderate;
      const allocationPerFund = Math.floor(100 / realFunds.length);
      const remainder = 100 - (allocationPerFund * realFunds.length);

      realFunds.forEach((fund, index) => {
        const allocation = index === 0 ? allocationPerFund + remainder : allocationPerFund;
        const amount = Math.round((allocation / 100) * investmentAmount);
        
        suggestions.push({
          productType: 'mutual_fund',
          productName: fund.name,
          suggestedAmount: amount,
          expectedReturn: `${fund.returns3Y}%`,
          riskLevel: fund.risk.toLowerCase(),
          matchScore: 95 - (index * 3),
          rationale: `Recommended ${fund.category} fund from ${fund.amc} with strong ${fund.returns3Y}% 3-year returns. Suitable for ${riskProfile.investmentHorizon.replace('_', ' ')} horizon.`,
          highlights: [
            `AMC: ${fund.amc}`,
            `Category: ${fund.category}`,
            `1Y Returns: ${fund.returns1Y}%`,
            `3Y Returns: ${fund.returns3Y}%`,
            `5Y Returns: ${fund.returns5Y}%`,
            `Risk: ${fund.risk}`
          ],
          amc: fund.amc,
          category: fund.category,
          returns1Y: fund.returns1Y,
          returns3Y: fund.returns3Y,
          returns5Y: fund.returns5Y,
          riskRating: fund.risk,
          allocationPercentage: allocation,
          recommendedAmount: amount,
          selectionReason: `Selected based on ${riskProfile.riskTolerance} risk profile and ${fund.returns3Y}% historical 3-year CAGR performance.`
        } as any);
      });
    }

    return suggestions;
  }

  private calculateWeightedReturn(freshInvestments: FreshInvestmentSuggestion[], riskProfile: ProspectRiskProfile): number {
    // Base returns by risk profile
    const baseReturns: Record<string, number> = {
      conservative: 8,
      moderate: 12,
      aggressive: 15,
      very_aggressive: 18
    };
    
    if (freshInvestments.length === 0) {
      return baseReturns[riskProfile.riskTolerance] || 12;
    }

    // Calculate weighted average from fresh investment expected returns
    let totalWeight = 0;
    let weightedSum = 0;
    
    freshInvestments.forEach((inv: any) => {
      const returnStr = inv.expectedReturn || inv.returns3Y || '12';
      const returnVal = parseFloat(returnStr.replace('%', '')) || 12;
      const weight = inv.suggestedAmount || 1;
      
      weightedSum += returnVal * weight;
      totalWeight += weight;
    });

    if (totalWeight === 0) {
      return baseReturns[riskProfile.riskTolerance] || 12;
    }

    return Math.round((weightedSum / totalWeight) * 10) / 10;
  }

  async createCombinedProposal(
    agentId: string,
    prospectId: string,
    prospectData: { name: string; email?: string; mobile?: string; pan?: string },
    holdings: ProspectPortfolioHolding[],
    riskProfile: ProspectRiskProfile,
    freshInvestmentAmount: number,
    customAllocations?: { equity: number; debt: number; hybrid: number; gold: number; silver?: number; index?: number },
    selectedCategories?: string[]
  ): Promise<CombinedProposal> {
    const analysis = this.analyzePortfolio(holdings, riskProfile);
    const rebalancing = this.generateRebalancingRecommendations(holdings, riskProfile, analysis);
    const freshInvestments = await this.generateFreshInvestmentSuggestions(
      riskProfile, 
      freshInvestmentAmount, 
      holdings,
      customAllocations,
      selectedCategories
    );

    // Fetch agent details
    const [agent] = await db.select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      mobile: users.mobile
    }).from(users).where(eq(users.id, agentId)).limit(1);

    const agentName = agent ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim() : null;
    const agentEmail = agent?.email || null;
    const agentMobile = agent?.mobile || null;

    // Generate referral code for onboarding link
    const referralCode = `REF${nanoid(8).toUpperCase()}`;

    const totalSellAmount = rebalancing
      .filter(r => r.action === 'SELL')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);
    
    const totalBuyAmount = freshInvestments.reduce((sum, s) => sum + s.suggestedAmount, 0) +
      rebalancing.filter(r => r.action === 'BUY').reduce((sum, r) => sum + r.changeAmount, 0);
    
    const netInvestmentRequired = totalBuyAmount - totalSellAmount;
    
    // Calculate weighted average return based on recommendations
    const avgReturn = this.calculateWeightedReturn(freshInvestments, riskProfile);
    const years = riskProfile.investmentHorizon === 'short_term' ? 3 : 
                  riskProfile.investmentHorizon === 'medium_term' ? 5 : 10;
    const projectedValue = (analysis.totalValue + netInvestmentRequired) * Math.pow(1 + avgReturn/100, years);

    const shareToken = nanoid(12);
    
    // Get target allocation based on risk profile
    const targetAllocation = TARGET_ALLOCATIONS[riskProfile.riskTolerance] || TARGET_ALLOCATIONS.moderate;
    
    const [proposal] = await db.insert(prospectProposals).values({
      shareToken,
      agentId,
      prospectName: prospectData.name,
      prospectEmail: prospectData.email,
      prospectMobile: prospectData.mobile,
      prospectPan: prospectData.pan,
      proposalType: 'sample_portfolio',
      proposalTitle: `Investment Proposal for ${prospectData.name}`,
      clientType: 'individual',
      samplePortfolio: holdings,
      currentAnalysis: JSON.stringify(analysis),
      recommendations: [...rebalancing, ...freshInvestments],
      totalInvestmentAmount: String(netInvestmentRequired),
      projectedValue: String(Math.round(projectedValue)),
      projectedReturns: String(avgReturn),
      riskProfile: riskProfile.riskTolerance,
      investmentGoals: { goal: riskProfile.primaryGoal, horizon: riskProfile.investmentHorizon },
      targetAllocation,
      agentName,
      agentEmail,
      agentMobile,
      referralCode,
      executiveSummary: this.generateExecutiveSummary(analysis, rebalancing, freshInvestments, riskProfile),
      status: 'draft',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      viewCount: 0
    }).returning();

    await db.insert(prospectProposalEvents).values({
      proposalId: proposal.id,
      eventType: 'created',
      eventData: { prospectId, agentId }
    });

    return {
      prospectId,
      proposalId: proposal.id,
      shareToken,
      analysis,
      rebalancing,
      freshInvestments,
      totalSellAmount,
      totalBuyAmount,
      netInvestmentRequired,
      projectedValue: Math.round(projectedValue),
      projectedReturn: `${avgReturn}% p.a.`,
      executiveSummary: this.generateExecutiveSummary(analysis, rebalancing, freshInvestments, riskProfile)
    };
  }

  private generateExecutiveSummary(
    analysis: PortfolioAnalysis,
    rebalancing: RebalanceRecommendation[],
    freshInvestments: FreshInvestmentSuggestion[],
    riskProfile: ProspectRiskProfile
  ): string {
    const sellCount = rebalancing.filter(r => r.action === 'SELL').length;
    const buyCount = rebalancing.filter(r => r.action === 'BUY').length;
    
    return `Based on your ${riskProfile.riskTolerance} risk profile and ${riskProfile.investmentHorizon.replace('_', ' ')} investment horizon, ` +
      `we have analyzed your portfolio worth ₹${(analysis.totalValue / 100000).toFixed(1)}L. ` +
      `Your current diversification score is ${analysis.diversificationScore}/100 with a risk score of ${analysis.riskScore}/100. ` +
      `We recommend ${sellCount > 0 ? `rebalancing ${sellCount} positions` : 'no immediate rebalancing'} ` +
      `and ${freshInvestments.length} fresh investment opportunities aligned with your ${riskProfile.primaryGoal} goal.`;
  }

  async shareProposal(proposalId: string, channel: 'email' | 'whatsapp' | 'sms', agentId: string) {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(eq(prospectProposals.id, proposalId), eq(prospectProposals.agentId, agentId)))
      .limit(1);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const shareUrl = `${process.env.BASE_URL || 'https://fintekpro.replit.app'}/proposal/${proposal.shareToken}`;

    await db.update(prospectProposals)
      .set({
        status: 'shared',
        ...(channel === 'email' ? { sharedViaEmail: true } : {}),
        ...(channel === 'whatsapp' ? { sharedViaWhatsApp: true } : {}),
        updatedAt: new Date()
      })
      .where(eq(prospectProposals.id, proposalId));

    await db.insert(prospectProposalEvents).values({
      proposalId,
      eventType: `shared_${channel}`,
      eventData: { channel, shareUrl }
    });

    return { shareUrl, shareToken: proposal.shareToken };
  }

  async getProposalByToken(shareToken: string) {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(eq(prospectProposals.shareToken, shareToken))
      .limit(1);

    if (proposal) {
      await db.update(prospectProposals)
        .set({
          viewCount: (proposal.viewCount || 0) + 1,
          status: proposal.status === 'shared' ? 'viewed' : proposal.status,
          firstViewedAt: proposal.firstViewedAt || new Date(),
          lastViewedAt: new Date()
        })
        .where(eq(prospectProposals.id, proposal.id));

      await db.insert(prospectProposalEvents).values({
        proposalId: proposal.id,
        eventType: 'viewed'
      });
    }

    return proposal;
  }
}

export const agentProspectWizardService = new AgentProspectWizardService();
