import { db } from "../db";
import { 
  prospectClients, 
  prospectProposals,
  prospectProposalEvents,
  InsertProspectClient
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { aiInvestmentOrchestrator } from "./ai-investment-orchestrator";

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
    existingHoldings: ProspectPortfolioHolding[]
  ): Promise<FreshInvestmentSuggestion[]> {
    const suggestions: FreshInvestmentSuggestion[] = [];
    
    const existingTypes = new Set(existingHoldings.map(h => h.productType));
    
    const allocationByRisk: Record<string, { type: string; name: string; allocation: number; return: string; risk: string }[]> = {
      conservative: [
        { type: 'bond', name: 'Government Securities (G-Secs)', allocation: 40, return: '7-8%', risk: 'low' },
        { type: 'fd', name: 'Bank Fixed Deposit', allocation: 30, return: '6-7%', risk: 'low' },
        { type: 'mutual_fund', name: 'Debt Mutual Fund - Short Duration', allocation: 20, return: '6-8%', risk: 'low' },
        { type: 'gold', name: 'Sovereign Gold Bond', allocation: 10, return: '6-8%', risk: 'medium' }
      ],
      moderate: [
        { type: 'mutual_fund', name: 'Flexi-cap Equity Fund', allocation: 35, return: '12-15%', risk: 'medium' },
        { type: 'bond', name: 'Corporate Bonds - AAA rated', allocation: 25, return: '8-9%', risk: 'low' },
        { type: 'mutual_fund', name: 'Hybrid Aggressive Fund', allocation: 20, return: '10-12%', risk: 'medium' },
        { type: 'etf', name: 'Nifty 50 ETF', allocation: 15, return: '12-14%', risk: 'medium' },
        { type: 'gold', name: 'Gold ETF', allocation: 5, return: '6-8%', risk: 'medium' }
      ],
      aggressive: [
        { type: 'mutual_fund', name: 'Small Cap Fund', allocation: 30, return: '15-20%', risk: 'high' },
        { type: 'mutual_fund', name: 'Mid Cap Fund', allocation: 25, return: '14-18%', risk: 'high' },
        { type: 'equity', name: 'Direct Equity - Large Cap', allocation: 25, return: '12-15%', risk: 'high' },
        { type: 'mutual_fund', name: 'Sectoral/Thematic Fund', allocation: 15, return: '15-25%', risk: 'very_high' },
        { type: 'gold', name: 'Sovereign Gold Bond', allocation: 5, return: '6-8%', risk: 'medium' }
      ],
      very_aggressive: [
        { type: 'equity', name: 'Direct Equity - Mid/Small Cap', allocation: 40, return: '18-25%', risk: 'very_high' },
        { type: 'mutual_fund', name: 'Small Cap Fund', allocation: 25, return: '15-22%', risk: 'very_high' },
        { type: 'pms', name: 'Portfolio Management Service', allocation: 20, return: '15-20%', risk: 'high' },
        { type: 'aif', name: 'Category III AIF', allocation: 15, return: '18-30%', risk: 'very_high' }
      ]
    };

    const allocations = allocationByRisk[riskProfile.riskTolerance] || allocationByRisk.moderate;

    allocations.forEach((alloc, index) => {
      const amount = Math.round((alloc.allocation / 100) * investmentAmount);
      const isNew = !existingTypes.has(alloc.type);
      
      suggestions.push({
        productType: alloc.type,
        productName: alloc.name,
        suggestedAmount: amount,
        expectedReturn: alloc.return,
        riskLevel: alloc.risk,
        matchScore: 95 - (index * 5),
        rationale: isNew 
          ? `Add ${alloc.type} exposure for diversification. Allocate ${alloc.allocation}% based on ${riskProfile.riskTolerance} profile.`
          : `Increase ${alloc.type} allocation to optimize returns. Target ${alloc.allocation}% weight.`,
        highlights: [
          `Expected returns: ${alloc.return} p.a.`,
          `Risk level: ${alloc.risk}`,
          isNew ? 'New asset class for your portfolio' : 'Strengthens existing position',
          riskProfile.investmentHorizon === 'long_term' ? 'Suitable for long-term goals' : ''
        ].filter(Boolean)
      });
    });

    return suggestions;
  }

  async createCombinedProposal(
    agentId: string,
    prospectId: string,
    prospectData: { name: string; email?: string; mobile?: string; pan?: string },
    holdings: ProspectPortfolioHolding[],
    riskProfile: ProspectRiskProfile,
    freshInvestmentAmount: number
  ): Promise<CombinedProposal> {
    const analysis = this.analyzePortfolio(holdings, riskProfile);
    const rebalancing = this.generateRebalancingRecommendations(holdings, riskProfile, analysis);
    const freshInvestments = await this.generateFreshInvestmentSuggestions(
      riskProfile, 
      freshInvestmentAmount, 
      holdings
    );

    const totalSellAmount = rebalancing
      .filter(r => r.action === 'SELL')
      .reduce((sum, r) => sum + Math.abs(r.changeAmount), 0);
    
    const totalBuyAmount = freshInvestments.reduce((sum, s) => sum + s.suggestedAmount, 0) +
      rebalancing.filter(r => r.action === 'BUY').reduce((sum, r) => sum + r.changeAmount, 0);
    
    const netInvestmentRequired = totalBuyAmount - totalSellAmount;
    
    const avgReturn = 12;
    const years = riskProfile.investmentHorizon === 'short_term' ? 3 : 
                  riskProfile.investmentHorizon === 'medium_term' ? 5 : 10;
    const projectedValue = (analysis.totalValue + netInvestmentRequired) * Math.pow(1 + avgReturn/100, years);

    const shareToken = nanoid(12);
    
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
