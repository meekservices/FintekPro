import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { 
  aiProposals, 
  aiProposalItems,
  portfolios,
  portfolioHoldings,
  externalHoldings,
  financialGoals,
  clientRiskProfiles
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth } from '../middleware/roleMiddleware';
import { nanoid } from 'nanoid';

const router = Router();

const DEFAULT_TARGET_ALLOCATION: Record<string, Record<string, number>> = {
  conservative: { Equity: 30, Debt: 40, Gold: 15, Other: 15 },
  moderate:     { Equity: 50, Debt: 30, Gold: 10, Other: 10 },
  aggressive:   { Equity: 70, Debt: 15, Gold: 10, Other: 5 },
};

interface HoldingForRebalance {
  symbol: string;
  assetType: string;
  currentValue: number;
  source: 'FINTEKPRO' | 'CDSL' | 'NSDL' | 'UPLOADED';
}

interface RebalanceRecommendation {
  assetType: string;
  action: 'buy' | 'sell' | 'hold' | 'reduce' | 'increase';
  amount: number;
  currentPercent: number;
  targetPercent: number;
  drift: number;
  holdings: {
    symbol: string;
    source: string;
    suggestedChange: number;
    actionType: 'executable' | 'transfer_suggested' | 'advisory_only';
  }[];
}

async function generateRebalanceRecommendations(
  holdings: HoldingForRebalance[],
  riskProfile?: any
): Promise<RebalanceRecommendation[]> {
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  if (totalValue === 0) return [];

  const profileKey = (riskProfile?.riskCategory || riskProfile?.riskTolerance || 'moderate').toLowerCase();
  const targetAllocation = DEFAULT_TARGET_ALLOCATION[profileKey] || DEFAULT_TARGET_ALLOCATION.moderate;

  const allocationByType: Record<string, { internal: number; external: number; holdings: HoldingForRebalance[] }> = {};
  
  holdings.forEach(h => {
    const type = h.assetType || 'Other';
    if (!allocationByType[type]) {
      allocationByType[type] = { internal: 0, external: 0, holdings: [] };
    }
    if (h.source === 'FINTEKPRO') {
      allocationByType[type].internal += h.currentValue;
    } else {
      allocationByType[type].external += h.currentValue;
    }
    allocationByType[type].holdings.push(h);
  });

  const recommendations: RebalanceRecommendation[] = [];

  const allTypes = new Set([...Object.keys(allocationByType), ...Object.keys(targetAllocation)]);

  allTypes.forEach(assetType => {
    const data = allocationByType[assetType] || { internal: 0, external: 0, holdings: [] };
    const total = data.internal + data.external;
    const currentPercent = (total / totalValue) * 100;
    const targetPercent = targetAllocation[assetType] || 0;
    const drift = currentPercent - targetPercent;
    const amountChange = Math.abs(drift / 100) * totalValue;

    const holdingRecommendations = data.holdings.map(h => {
      const proportion = total > 0 ? h.currentValue / total : 0;
      const suggestedChange = proportion * amountChange;
      
      let actionType: 'executable' | 'transfer_suggested' | 'advisory_only';
      if (h.source === 'FINTEKPRO') {
        actionType = 'executable';
      } else if (drift > 0) {
        actionType = 'transfer_suggested';
      } else {
        actionType = 'advisory_only';
      }
      
      return {
        symbol: h.symbol,
        source: h.source,
        suggestedChange,
        actionType,
      };
    });

    let action: RebalanceRecommendation['action'] = 'hold';
    if (drift > 5) action = 'sell';
    else if (drift > 0 && drift <= 5) action = 'reduce';
    else if (drift < -5) action = 'buy';
    else if (drift < 0 && drift >= -5) action = 'increase';

    recommendations.push({
      assetType,
      action,
      amount: amountChange,
      currentPercent,
      targetPercent,
      drift,
      holdings: holdingRecommendations,
    });
  });

  return recommendations;
}

const generateRebalanceProposalSchema = z.object({
  type: z.literal('rebalancing'),
  includeExternal: z.boolean().default(true),
  portfolioId: z.string().optional(),
  unifiedHoldings: z.array(z.object({
    symbol: z.string(),
    assetType: z.string(),
    currentValue: z.number(),
    source: z.enum(['FINTEKPRO', 'CDSL', 'NSDL', 'UPLOADED']),
  })).optional(),
  requestedAt: z.string().optional(),
});

router.post('/api/ai/generate-rebalance-proposal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { includeExternal, portfolioId, unifiedHoldings } = generateRebalanceProposalSchema.parse(req.body);

    let holdings: HoldingForRebalance[] = [];

    if (unifiedHoldings && unifiedHoldings.length > 0) {
      holdings = unifiedHoldings;
    } else {
      const userPortfolios = await db.select().from(portfolios).where(eq(portfolios.userId, userId));
      
      for (const portfolio of userPortfolios) {
        const portHoldings = await db.select().from(portfolioHoldings).where(eq(portfolioHoldings.portfolioId, portfolio.id));
        for (const h of portHoldings) {
          const avgPrice = parseFloat(h.avgPrice?.toString() || '0');
          const quantity = parseFloat(h.quantity?.toString() || '0');
          const currentValue = avgPrice * quantity * 1.1;
          holdings.push({
            symbol: h.symbol || '',
            assetType: h.assetType || 'Other',
            currentValue,
            source: 'FINTEKPRO',
          });
        }
      }

      if (includeExternal) {
        try {
          const extHoldings = await db.select().from(externalHoldings).where(eq(externalHoldings.userId, userId));
          for (const h of extHoldings) {
            holdings.push({
              symbol: h.symbol || '',
              assetType: h.assetType || 'Other',
              currentValue: parseFloat(h.currentValue?.toString() || '0'),
              source: (h.source as any) || 'CDSL',
            });
          }
        } catch (e) {
          console.log('[Rebalance] No external holdings');
        }
      }
    }

    let riskProfile = null;
    try {
      const [profile] = await db.select().from(clientRiskProfiles).where(eq(clientRiskProfiles.userId, userId)).limit(1);
      riskProfile = profile;
    } catch (e: any) {
      console.warn('[AI Rebalancing] Failed to load risk profile:', e?.message);
    }

    const recommendations = await generateRebalanceRecommendations(holdings, riskProfile);

    const proposalId = nanoid();
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    const executableAmount = recommendations.reduce((sum, r) => {
      const executableHoldings = r.holdings.filter(h => h.actionType === 'executable');
      return sum + executableHoldings.reduce((s, h) => s + Math.abs(h.suggestedChange), 0);
    }, 0);

    const proposalNumber = `RBL-${Date.now().toString(36).toUpperCase()}`;
    const [proposal] = await db.insert(aiProposals).values({
      id: proposalId,
      clientId: userId,
      proposalNumber,
      title: `AI Rebalancing Proposal - ${includeExternal ? 'Unified Portfolio' : 'FintekPro Only'}`,
      description: `Risk profile: ${riskProfile?.riskCategory || 'moderate'}`,
      status: 'pending_review',
      totalInvestmentAmount: totalValue.toString(),
      diagnosticsId: null,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      aiGeneratedAt: new Date(),
      aiEngineVersion: '1.0.0',
    }).returning();

    const proposalItems = [];
    for (const rec of recommendations) {
      for (const holding of rec.holdings) {
        if (Math.abs(holding.suggestedChange) > 100) {
          const [item] = await db.insert(aiProposalItems).values({
            id: nanoid(),
            proposalId,
            recommendationType: rec.action.toUpperCase(),
            assetClass: rec.assetType.toLowerCase(),
            productId: holding.symbol,
            schemeName: `${holding.symbol} (${holding.source})`,
            isin: null,
            amount: Math.abs(holding.suggestedChange).toString(),
            rationale: `${rec.action === 'sell' ? 'Reduce' : 'Increase'} allocation to reach ${rec.targetPercent}% target`,
            problemIdentified: `Asset drift of ${rec.drift.toFixed(1)}% from target allocation`,
            portfolioImpactSummary: `Current: ${rec.currentPercent.toFixed(1)}% → Target: ${rec.targetPercent}%`,
            status: holding.actionType === 'executable' ? 'pending' : 'advisory',
            priority: 1,
          }).returning();
          proposalItems.push(item);
        }
      }
    }

    res.json({
      success: true,
      proposalId,
      proposal,
      items: proposalItems,
      recommendations,
      summary: {
        totalHoldings: holdings.length,
        totalValue,
        executableAmount,
        advisoryAmount: totalValue - executableAmount,
        includeExternal,
      }
    });
  } catch (error: any) {
    console.error('[RebalanceProposal] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

const generateGoalProposalSchema = z.object({
  type: z.literal('goal_planning'),
  goals: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    targetAmount: z.number(),
    currentAmount: z.number().optional(),
    targetDate: z.string(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).optional(),
  })).optional(),
  requestedAt: z.string().optional(),
});

router.post('/api/ai/generate-goal-proposal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { goals: inputGoals } = generateGoalProposalSchema.parse(req.body);

    let goals = inputGoals || [];
    
    if (goals.length === 0) {
      try {
        const userGoals = await db.select().from(financialGoals).where(eq(financialGoals.userId, userId));
        goals = userGoals.map(g => ({
          id: g.id,
          name: g.name,
          targetAmount: parseFloat(g.targetAmount?.toString() || '0'),
          currentAmount: parseFloat(g.currentAmount?.toString() || '0'),
          targetDate: g.targetDate?.toISOString() || new Date().toISOString(),
          priority: (g.priority as any) || 'medium',
          riskProfile: (g.riskProfile as any) || 'moderate',
        }));
      } catch (e) {
        console.log('[GoalProposal] No goals found');
      }
    }

    let riskProfile = null;
    try {
      const [profile] = await db.select().from(clientRiskProfiles).where(eq(clientRiskProfiles.userId, userId)).limit(1);
      riskProfile = profile;
    } catch (e: any) {
      console.warn('[AI Rebalancing] Failed to load risk profile:', e?.message);
    }

    const proposalId = nanoid();
    const totalGoalAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrentAmount = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);
    const gap = totalGoalAmount - totalCurrentAmount;

    const proposalNumber = `GP-${Date.now().toString(36).toUpperCase()}`;
    const [proposal] = await db.insert(aiProposals).values({
      id: proposalId,
      clientId: userId,
      proposalNumber,
      title: `Goal Planning Proposal - ${goals.length} goal(s)`,
      description: `AI-generated investment proposal based on ${goals.length} financial goal(s). Total investment gap: ₹${gap.toLocaleString('en-IN')}`,
      status: 'pending_review',
      totalInvestmentAmount: gap.toString(),
      diagnosticsId: null,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    }).returning();

    const proposalItems = [];
    
    for (const goal of goals) {
      const goalGap = goal.targetAmount - (goal.currentAmount || 0);
      if (goalGap <= 0) continue;

      const yearsToGoal = Math.max(1, (new Date(goal.targetDate).getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000));
      const monthlyRequired = goalGap / (yearsToGoal * 12);

      let recommendations: { type: string; allocation: number; name: string }[] = [];
      
      if (yearsToGoal <= 3 || goal.riskProfile === 'conservative') {
        recommendations = [
          { type: 'debt_fund', allocation: 60, name: 'Short Duration Debt Fund' },
          { type: 'liquid_fund', allocation: 30, name: 'Liquid Fund' },
          { type: 'gold', allocation: 10, name: 'Gold ETF' },
        ];
      } else if (yearsToGoal <= 7 || goal.riskProfile === 'moderate') {
        recommendations = [
          { type: 'equity_large_cap', allocation: 40, name: 'Large Cap Equity Fund' },
          { type: 'debt_fund', allocation: 35, name: 'Medium Duration Debt Fund' },
          { type: 'hybrid_balanced', allocation: 20, name: 'Balanced Advantage Fund' },
          { type: 'gold', allocation: 5, name: 'Gold ETF' },
        ];
      } else {
        recommendations = [
          { type: 'equity_flexi_cap', allocation: 50, name: 'Flexi Cap Fund' },
          { type: 'equity_mid_cap', allocation: 20, name: 'Mid Cap Fund' },
          { type: 'debt_fund', allocation: 20, name: 'Corporate Bond Fund' },
          { type: 'gold', allocation: 10, name: 'Gold ETF' },
        ];
      }

      for (const rec of recommendations) {
        const amount = (goalGap * rec.allocation) / 100;
        if (amount < 1000) continue;

        const [item] = await db.insert(aiProposalItems).values({
          id: nanoid(),
          proposalId,
          recommendationType: 'BUY',
          assetClass: rec.type,
          productId: `${rec.type}_${goal.id || goal.name}`,
          schemeName: rec.name,
          isin: null,
          amount: amount.toString(),
          rationale: `Recommended for "${goal.name}" goal with ${yearsToGoal.toFixed(1)} years horizon`,
          problemIdentified: `Investment gap of ₹${goalGap.toLocaleString('en-IN')} for "${goal.name}"`,
          portfolioImpactSummary: `${rec.allocation}% allocation, monthly SIP ₹${Math.round(monthlyRequired * rec.allocation / 100).toLocaleString('en-IN')}`,
          status: 'pending',
          priority: 1,
        }).returning();
        proposalItems.push(item);
      }
    }

    res.json({
      success: true,
      proposalId,
      proposal,
      items: proposalItems,
      summary: {
        goalsCount: goals.length,
        totalGoalAmount,
        totalCurrentAmount,
        investmentGap: gap,
      }
    });
  } catch (error: any) {
    console.error('[GoalProposal] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

const generateRetirementProposalSchema = z.object({
  type: z.literal('retirement_planning'),
  currentAge: z.number().optional(),
  retirementAge: z.number().optional(),
  currentSavings: z.number().optional(),
  monthlyExpenses: z.number().optional(),
  inflationRate: z.number().optional(),
  expectedReturn: z.number().optional(),
  requestedAt: z.string().optional(),
});

router.post('/api/ai/generate-retirement-proposal', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const input = generateRetirementProposalSchema.parse(req.body);
    
    const currentAge = input.currentAge || 30;
    const retirementAge = input.retirementAge || 60;
    const currentSavings = input.currentSavings || 0;
    const monthlyExpenses = input.monthlyExpenses || 50000;
    const inflationRate = input.inflationRate || 6;
    const expectedReturn = input.expectedReturn || 12;

    const yearsToRetirement = retirementAge - currentAge;
    const futureMonthlyExpenses = monthlyExpenses * Math.pow(1 + inflationRate / 100, yearsToRetirement);
    const requiredCorpus = futureMonthlyExpenses * 12 * 25;
    
    const monthsToRetirement = yearsToRetirement * 12;
    const monthlyRate = expectedReturn / 100 / 12;
    const futureValueOfCurrentSavings = currentSavings * Math.pow(1 + expectedReturn / 100, yearsToRetirement);
    const remainingCorpus = Math.max(0, requiredCorpus - futureValueOfCurrentSavings);
    
    const sipAmount = remainingCorpus / (((Math.pow(1 + monthlyRate, monthsToRetirement) - 1) / monthlyRate) * (1 + monthlyRate));

    let riskProfile = null;
    try {
      const [profile] = await db.select().from(clientRiskProfiles).where(eq(clientRiskProfiles.userId, userId)).limit(1);
      riskProfile = profile;
    } catch (e: any) {
      console.warn('[AI Rebalancing] Failed to load risk profile:', e?.message);
    }

    const proposalId = nanoid();

    const retProposalNumber = `RET-${Date.now().toString(36).toUpperCase()}`;
    const [proposal] = await db.insert(aiProposals).values({
      id: proposalId,
      clientId: userId,
      proposalNumber: retProposalNumber,
      title: `AI Retirement Proposal - Target corpus: ₹${(requiredCorpus / 10000000).toFixed(2)} Cr`,
      description: `Risk profile: ${riskProfile?.riskCategory || 'moderate'}. ${yearsToRetirement} years to retirement.`,
      status: 'pending_review',
      totalInvestmentAmount: remainingCorpus.toString(),
      diagnosticsId: null,
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      aiGeneratedAt: new Date(),
      aiEngineVersion: '1.0.0',
    }).returning();

    let recommendations: { type: string; allocation: number; name: string }[];
    
    if (yearsToRetirement <= 5) {
      recommendations = [
        { type: 'debt_short_duration', allocation: 50, name: 'Short Duration Fund' },
        { type: 'hybrid_conservative', allocation: 30, name: 'Conservative Hybrid Fund' },
        { type: 'gold', allocation: 10, name: 'Gold ETF' },
        { type: 'liquid_fund', allocation: 10, name: 'Liquid Fund' },
      ];
    } else if (yearsToRetirement <= 15) {
      recommendations = [
        { type: 'equity_large_cap', allocation: 40, name: 'Large Cap Fund' },
        { type: 'hybrid_balanced', allocation: 25, name: 'Balanced Advantage Fund' },
        { type: 'debt_medium_duration', allocation: 25, name: 'Medium Duration Fund' },
        { type: 'gold', allocation: 10, name: 'Gold ETF' },
      ];
    } else {
      recommendations = [
        { type: 'equity_flexi_cap', allocation: 45, name: 'Flexi Cap Fund' },
        { type: 'equity_mid_cap', allocation: 20, name: 'Mid Cap Fund' },
        { type: 'nps', allocation: 15, name: 'NPS Tier 1' },
        { type: 'debt_fund', allocation: 15, name: 'Corporate Bond Fund' },
        { type: 'gold', allocation: 5, name: 'Sovereign Gold Bond' },
      ];
    }

    const proposalItems = [];
    for (const rec of recommendations) {
      const lumpsum = (remainingCorpus * rec.allocation) / 100;
      const monthlySip = (sipAmount * rec.allocation) / 100;

      const [item] = await db.insert(aiProposalItems).values({
        id: nanoid(),
        proposalId,
        recommendationType: 'BUY',
        assetClass: rec.type,
        productId: `retirement_${rec.type}`,
        schemeName: rec.name,
        isin: null,
        amount: lumpsum.toString(),
        rationale: `Retirement allocation for ${yearsToRetirement} years horizon`,
        problemIdentified: `Corpus gap of ₹${Math.round(remainingCorpus).toLocaleString('en-IN')} for retirement`,
        portfolioImpactSummary: `${rec.allocation}% allocation, monthly SIP ₹${Math.round(monthlySip).toLocaleString('en-IN')}`,
        status: 'pending',
        priority: 1,
      }).returning();
      proposalItems.push(item);
    }

    res.json({
      success: true,
      proposalId,
      proposal,
      items: proposalItems,
      retirementPlan: {
        currentAge,
        retirementAge,
        yearsToRetirement,
        currentSavings,
        monthlyExpenses,
        futureMonthlyExpenses: Math.round(futureMonthlyExpenses),
        requiredCorpus: Math.round(requiredCorpus),
        existingCorpusFutureValue: Math.round(futureValueOfCurrentSavings),
        additionalCorpusNeeded: Math.round(remainingCorpus),
        monthlySipRequired: Math.round(sipAmount),
      }
    });
  } catch (error: any) {
    console.error('[RetirementProposal] Error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors });
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
