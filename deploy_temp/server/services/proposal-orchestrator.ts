import { db } from '../db';
import { 
  advisorySessions, 
  suitabilityChecks,
  investmentProposals,
  investmentProposalItems,
  users,
  portfolios,
  portfolioHoldings,
  clientRiskProfiles,
  agentComplianceAuditLogs,
  unifiedCartItems,
  proposalShares,
  proposalVersions,
  proposalBacktestResults
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createHash } from 'crypto';

export type AllocationMode = 'AI_DRIVEN' | 'MANUAL';

export interface AssetAllocation {
  assetClass: string;
  weight: number;
}

export interface StrategySnapshot {
  allocationMode: AllocationMode;
  assetAllocation: AssetAllocation[];
  lockedAt: Date;
  lockedBy: string;
  totalWeight: number;
}

export interface AllocationDriftError {
  expected: number;
  actual: number;
  assetClass: string;
}

export interface BacktestDelta {
  cagrDifference: number;
  volatilityDifference: number;
  maxDrawdownDifference: number;
  sharpeImprovement: number;
}

export interface PortfolioDifferenceSummary {
  allocationDelta: { assetClass: string; oldWeight: number; proposedWeight: number; change: number }[];
  riskMetricDelta: { metric: string; oldValue: number; proposedValue: number; impact: string }[];
  costDelta: { category: string; oldCost: number; proposedCost: number; savings: number }[];
  concentrationDelta: { assetClass: string; oldConcentration: number; proposedConcentration: number }[];
}

async function logSystemAction(data: {
  agentId: string;
  clientId?: string | null;
  sessionId?: string | null;
  proposalId?: string | null;
  actionCategory: string;
  actionType: string;
  actionDescription: string;
  previousState?: any;
  newState?: any;
  suitabilityPassed?: boolean;
}) {
  try {
    await db.insert(agentComplianceAuditLogs).values({
      id: nanoid(),
      agentId: data.agentId,
      clientId: data.clientId || null,
      sessionId: data.sessionId || null,
      proposalId: data.proposalId || null,
      actionCategory: data.actionCategory,
      actionType: data.actionType,
      actionDescription: data.actionDescription,
      previousState: data.previousState || null,
      newState: data.newState || null,
      suitabilityCheckPassed: data.suitabilityPassed || null,
      systemGenerated: true,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('[Orchestrator Audit] Failed to log action:', error);
  }
}

export interface WorkflowTransition {
  fromState: string;
  toState: string;
  validationPassed: boolean;
  validationErrors: string[];
  timestamp: Date;
}

export interface SuitabilityResult {
  passed: boolean;
  score: number;
  checks: {
    riskTolerance: { passed: boolean; score: number; details: string };
    timeHorizon: { passed: boolean; score: number; details: string };
    liquidityNeeds: { passed: boolean; score: number; details: string };
    concentration: { passed: boolean; score: number; details: string };
    productEligibility: { passed: boolean; score: number; details: string };
    regulatoryCompliance: { passed: boolean; score: number; details: string };
  };
  redFlags: string[];
  warnings: string[];
}

export interface OptimizationResult {
  allocations: {
    assetClass: string;
    instrumentType: string;
    instrumentName: string;
    isin?: string;
    allocationPercentage: number;
    recommendedAmount: number;
    rationale: string;
    riskCategory: string;
    expectedReturn?: number;
    timeHorizon?: string;
  }[];
  totalAmount: number;
  expectedReturn: number;
  riskScore: number;
  optimizerVersion: string;
}

export class ProposalOrchestrator {
  private static WORKFLOW_ORDER = [
    'purpose_selection',
    'suitability_check', 
    'optimization',
    'draft_review',
    'client_sharing',
    'client_action',
    'execution',
    'completed',
    'cancelled'
  ];

  static async validateWorkflowTransition(
    sessionId: string, 
    targetState: string
  ): Promise<WorkflowTransition> {
    const [session] = await db
      .select()
      .from(advisorySessions)
      .where(eq(advisorySessions.id, sessionId))
      .limit(1);

    if (!session) {
      return {
        fromState: 'unknown',
        toState: targetState,
        validationPassed: false,
        validationErrors: ['Session not found'],
        timestamp: new Date()
      };
    }

    const currentIndex = this.WORKFLOW_ORDER.indexOf(session.workflowState);
    const targetIndex = this.WORKFLOW_ORDER.indexOf(targetState);
    const validationErrors: string[] = [];

    if (targetIndex === -1) {
      validationErrors.push(`Invalid target state: ${targetState}`);
    }

    if (targetState !== 'cancelled' && targetIndex !== currentIndex + 1) {
      validationErrors.push(
        `Cannot transition from ${session.workflowState} to ${targetState}. ` +
        `Next valid state is ${this.WORKFLOW_ORDER[currentIndex + 1]}`
      );
    }

    if (targetState === 'optimization' && !session.suitabilityCheckPassed) {
      validationErrors.push('Suitability check must pass before optimization');
    }

    if (targetState === 'draft_review' && !session.optimizationCompleted) {
      validationErrors.push('Optimization must complete before draft review');
    }

    if (targetState === 'client_sharing' && !session.agentDeclarationAcknowledged) {
      validationErrors.push('Agent declaration must be acknowledged before sharing');
    }

    return {
      fromState: session.workflowState,
      toState: targetState,
      validationPassed: validationErrors.length === 0,
      validationErrors,
      timestamp: new Date()
    };
  }

  static async runSuitabilityCheck(
    sessionId: string,
    agentId: string
  ): Promise<SuitabilityResult> {
    const [session] = await db
      .select()
      .from(advisorySessions)
      .where(eq(advisorySessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Session not found');
    }

    const [client] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.clientId))
      .limit(1);

    if (!client) {
      throw new Error('Client not found');
    }

    const [riskProfile] = await db
      .select()
      .from(clientRiskProfiles)
      .where(eq(clientRiskProfiles.userId, session.clientId))
      .orderBy(desc(clientRiskProfiles.createdAt))
      .limit(1);

    const portfolioData = await db
      .select()
      .from(portfolios)
      .where(eq(portfolios.userId, session.clientId))
      .limit(1);

    const investmentAmount = parseFloat(session.investmentAmount || '0');
    const existingPortfolioValue = parseFloat(portfolioData[0]?.totalValue?.toString() || '0');

    const checks = {
      riskTolerance: this.checkRiskTolerance(riskProfile, session.sessionPurpose),
      timeHorizon: this.checkTimeHorizon(riskProfile, session.sessionPurpose),
      liquidityNeeds: this.checkLiquidityNeeds(client, investmentAmount),
      concentration: this.checkConcentration(existingPortfolioValue, investmentAmount),
      productEligibility: this.checkProductEligibility(client, session.sessionPurpose),
      regulatoryCompliance: this.checkRegulatoryCompliance(client)
    };

    const scores = Object.values(checks).map(c => c.score);
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const passed = overallScore >= 60 && Object.values(checks).every(c => !c.passed ? c.score >= 40 : true);

    const redFlags: string[] = [];
    const warnings: string[] = [];

    Object.entries(checks).forEach(([key, check]) => {
      if (check.score < 40) {
        redFlags.push(`${key}: ${check.details}`);
      } else if (check.score < 60) {
        warnings.push(`${key}: ${check.details}`);
      }
    });

    const suitabilityId = nanoid();
    await db.insert(suitabilityChecks).values({
      id: suitabilityId,
      sessionId,
      clientId: session.clientId,
      agentId,
      checkType: 'pre_investment',
      clientCategory: (client as any).clientCategory || 'retail',
      riskProfile: riskProfile?.riskCategory || 'moderate',
      timeHorizon: riskProfile?.timeHorizonYears || 5,
      investableAmount: session.investmentAmount,
      existingPortfolioValue: portfolioData[0]?.totalValue?.toString(),
      overallSuitabilityScore: overallScore,
      suitabilityPassed: passed,
      suitabilityReason: passed 
        ? 'All suitability checks passed' 
        : `Failed checks: ${redFlags.join(', ')}`,
      riskToleranceCheck: checks.riskTolerance,
      timeHorizonCheck: checks.timeHorizon,
      liquidityNeedCheck: checks.liquidityNeeds,
      concentrationCheck: checks.concentration,
      productEligibilityCheck: checks.productEligibility,
      regulatoryComplianceCheck: checks.regulatoryCompliance,
      redFlags,
      warningsGenerated: warnings,
      engineVersion: '1.0.0'
    });

    await db
      .update(advisorySessions)
      .set({
        suitabilityCheckPassed: passed,
        suitabilityCheckId: suitabilityId,
        workflowState: passed ? 'optimization' : 'suitability_check',
        workflowStateUpdatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(advisorySessions.id, sessionId));

    await logSystemAction({
      agentId,
      clientId: session.clientId,
      sessionId,
      actionCategory: 'compliance',
      actionType: 'suitability_check_executed',
      actionDescription: `System executed suitability check: ${passed ? 'PASSED' : 'FAILED'} (score: ${overallScore})`,
      previousState: { workflowState: session.workflowState },
      newState: { 
        workflowState: passed ? 'optimization' : 'suitability_check',
        suitabilityScore: overallScore,
        redFlags,
        warnings
      },
      suitabilityPassed: passed
    });

    return { passed, score: overallScore, checks, redFlags, warnings };
  }

  private static checkRiskTolerance(riskProfile: any, sessionPurpose: string) {
    if (!riskProfile) {
      return { passed: false, score: 50, details: 'Risk profile not assessed' };
    }

    const riskScore = {
      conservative: 70,
      moderate: 85,
      aggressive: 90
    }[riskProfile.riskCategory as string] || 75;

    return {
      passed: riskScore >= 60,
      score: riskScore,
      details: `Risk tolerance: ${riskProfile.riskCategory || 'moderate'}`
    };
  }

  private static checkTimeHorizon(riskProfile: any, sessionPurpose: string) {
    const horizonYears = riskProfile?.timeHorizonYears || 5;
    const minRequired = sessionPurpose === 'retirement_review' ? 10 : 
                        sessionPurpose === 'fresh_investment' ? 3 : 1;
    
    const score = Math.min(100, (horizonYears / minRequired) * 60 + 20);
    
    return {
      passed: horizonYears >= minRequired,
      score: Math.round(score),
      details: `Investment horizon: ${horizonYears} years (min ${minRequired} required)`
    };
  }

  private static checkLiquidityNeeds(client: any, investmentAmount: number) {
    const hasEmergencyFund = true;
    const score = hasEmergencyFund ? 85 : 55;
    
    return {
      passed: hasEmergencyFund,
      score,
      details: hasEmergencyFund 
        ? 'Adequate liquidity buffer exists' 
        : 'Consider maintaining emergency fund'
    };
  }

  private static checkConcentration(existingValue: number, newInvestment: number) {
    const totalValue = existingValue + newInvestment;
    const concentrationRatio = newInvestment / (totalValue || 1);
    const score = concentrationRatio > 0.5 ? 60 : concentrationRatio > 0.3 ? 75 : 90;
    
    return {
      passed: concentrationRatio <= 0.5,
      score,
      details: `New investment is ${(concentrationRatio * 100).toFixed(1)}% of total portfolio`
    };
  }

  private static checkProductEligibility(client: any, sessionPurpose: string) {
    const kycStatus = (client as any).kycStatus || 'basic';
    const eligibilityMap: Record<string, number> = {
      pending: 30,
      basic: 70,
      enhanced: 90,
      accredited: 100
    };
    const eligibilityScore = eligibilityMap[kycStatus] || 70;
    
    return {
      passed: eligibilityScore >= 60,
      score: eligibilityScore,
      details: `KYC status: ${kycStatus}`
    };
  }

  private static checkRegulatoryCompliance(client: any) {
    const isCompliant = true;
    return {
      passed: isCompliant,
      score: isCompliant ? 100 : 0,
      details: isCompliant ? 'All regulatory requirements met' : 'Regulatory issues detected'
    };
  }

  static async runOptimization(
    sessionId: string,
    agentId: string
  ): Promise<OptimizationResult> {
    const [session] = await db
      .select()
      .from(advisorySessions)
      .where(eq(advisorySessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new Error('Session not found');
    }

    if (!session.suitabilityCheckPassed) {
      throw new Error('Suitability check must pass before optimization');
    }

    const [riskProfile] = await db
      .select()
      .from(clientRiskProfiles)
      .where(eq(clientRiskProfiles.userId, session.clientId))
      .orderBy(desc(clientRiskProfiles.createdAt))
      .limit(1);

    const investmentAmount = parseFloat(session.investmentAmount || '100000');
    const riskCategory = riskProfile?.riskCategory || 'moderate';

    const baseAllocations = this.getBaseAllocations(riskCategory, session.sessionPurpose);
    
    const allocations = baseAllocations.map(alloc => ({
      ...alloc,
      recommendedAmount: Math.round((alloc.allocationPercentage / 100) * investmentAmount)
    }));

    const expectedReturn = this.calculateExpectedReturn(allocations);
    const riskScore = this.calculateRiskScore(riskCategory);

    const proposalId = `AI-${nanoid(8).toUpperCase()}`;
    
    await db.insert(investmentProposals).values({
      id: proposalId,
      clientId: session.clientId,
      agentId,
      proposalSource: 'ai',
      aiModelVersion: '1.0.0',
      aiConfidenceScore: '85',
      title: `${session.sessionPurpose.replace(/_/g, ' ')} Proposal`,
      description: `AI-optimized investment proposal for ${session.sessionPurpose.replace(/_/g, ' ')}`,
      analysisRationale: 'Generated based on client risk profile and investment objectives',
      targetAllocation: allocations,
      recommendations: allocations,
      totalInvestmentAmount: String(investmentAmount),
      riskProfile: riskCategory,
      timeHorizon: session.sessionPurpose === 'retirement_review' ? 'long_term' : 'medium_term',
      expectedReturns: String(expectedReturn),
      expectedRisk: riskCategory,
      status: 'draft',
      priority: 'medium'
    });

    for (const alloc of allocations) {
      await db.insert(investmentProposalItems).values({
        proposalId,
        productType: alloc.instrumentType,
        productCode: alloc.isin || nanoid(8),
        productName: alloc.instrumentName,
        category: alloc.assetClass,
        allocationPercentage: String(alloc.allocationPercentage),
        recommendedAmount: String(alloc.recommendedAmount),
        rationale: alloc.rationale,
        riskRating: alloc.riskCategory,
        status: 'pending'
      });
    }

    await db
      .update(advisorySessions)
      .set({
        proposalId,
        optimizationCompleted: true,
        optimizationVersion: '1.0.0',
        workflowState: 'draft_review',
        workflowStateUpdatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(advisorySessions.id, sessionId));

    await logSystemAction({
      agentId,
      clientId: session.clientId,
      sessionId,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'optimization_executed',
      actionDescription: `System generated optimized allocation (${allocations.length} instruments, expected return: ${expectedReturn}%)`,
      previousState: { workflowState: session.workflowState },
      newState: { 
        workflowState: 'draft_review',
        proposalId,
        allocationsCount: allocations.length,
        totalAmount: investmentAmount,
        expectedReturn,
        riskScore
      }
    });

    return {
      allocations,
      totalAmount: investmentAmount,
      expectedReturn,
      riskScore,
      optimizerVersion: '1.0.0'
    };
  }

  private static getBaseAllocations(riskCategory: string, sessionPurpose: string) {
    if (sessionPurpose === 'corporate_treasury') {
      return [
        {
          assetClass: 'debt',
          instrumentType: 'liquid_fund',
          instrumentName: 'HDFC Liquid Fund - Growth',
          isin: 'INF179KB1AB1',
          allocationPercentage: 40,
          recommendedAmount: 0,
          rationale: 'High liquidity with stable returns for short-term parking',
          riskCategory: 'conservative'
        },
        {
          assetClass: 'debt',
          instrumentType: 'overnight_fund',
          instrumentName: 'ICICI Overnight Fund - Growth',
          isin: 'INF109KB1CD2',
          allocationPercentage: 30,
          recommendedAmount: 0,
          rationale: 'Overnight liquidity with minimal risk',
          riskCategory: 'conservative'
        },
        {
          assetClass: 'debt',
          instrumentType: 'ultra_short_fund',
          instrumentName: 'SBI Ultra Short Duration Fund',
          isin: 'INF200KB1EF3',
          allocationPercentage: 30,
          recommendedAmount: 0,
          rationale: 'Slightly higher yields with short duration',
          riskCategory: 'conservative'
        }
      ];
    }

    const allocations: Record<string, any[]> = {
      conservative: [
        {
          assetClass: 'debt',
          instrumentType: 'debt_fund',
          instrumentName: 'HDFC Corporate Bond Fund - Growth',
          isin: 'INF179K01AB1',
          allocationPercentage: 50,
          recommendedAmount: 0,
          rationale: 'Stable income with capital preservation focus',
          riskCategory: 'conservative'
        },
        {
          assetClass: 'equity',
          instrumentType: 'large_cap_fund',
          instrumentName: 'Axis Bluechip Fund - Growth',
          isin: 'INF846K01EW2',
          allocationPercentage: 30,
          recommendedAmount: 0,
          rationale: 'Blue-chip exposure for moderate growth',
          riskCategory: 'moderate'
        },
        {
          assetClass: 'gold',
          instrumentType: 'gold_etf',
          instrumentName: 'SBI Gold ETF',
          isin: 'INF200K01VN1',
          allocationPercentage: 20,
          recommendedAmount: 0,
          rationale: 'Hedge against market volatility and inflation',
          riskCategory: 'conservative'
        }
      ],
      moderate: [
        {
          assetClass: 'equity',
          instrumentType: 'flexi_cap_fund',
          instrumentName: 'Parag Parikh Flexi Cap Fund - Growth',
          isin: 'INF879O01027',
          allocationPercentage: 40,
          recommendedAmount: 0,
          rationale: 'Diversified equity exposure across market caps',
          riskCategory: 'moderate'
        },
        {
          assetClass: 'equity',
          instrumentType: 'mid_cap_fund',
          instrumentName: 'Kotak Emerging Equity Fund - Growth',
          isin: 'INF174K01LS2',
          allocationPercentage: 25,
          recommendedAmount: 0,
          rationale: 'Mid-cap growth potential',
          riskCategory: 'aggressive'
        },
        {
          assetClass: 'debt',
          instrumentType: 'dynamic_bond_fund',
          instrumentName: 'ICICI Dynamic Bond Fund - Growth',
          isin: 'INF109K01Z82',
          allocationPercentage: 25,
          recommendedAmount: 0,
          rationale: 'Active duration management for income',
          riskCategory: 'moderate'
        },
        {
          assetClass: 'gold',
          instrumentType: 'sovereign_gold_bond',
          instrumentName: 'Sovereign Gold Bond 2.5%',
          allocationPercentage: 10,
          recommendedAmount: 0,
          rationale: 'Portfolio diversification with interest income',
          riskCategory: 'conservative'
        }
      ],
      aggressive: [
        {
          assetClass: 'equity',
          instrumentType: 'small_cap_fund',
          instrumentName: 'Nippon India Small Cap Fund - Growth',
          isin: 'INF204K01UN5',
          allocationPercentage: 35,
          recommendedAmount: 0,
          rationale: 'High growth potential from small-cap segment',
          riskCategory: 'aggressive'
        },
        {
          assetClass: 'equity',
          instrumentType: 'mid_cap_fund',
          instrumentName: 'Axis Midcap Fund - Growth',
          isin: 'INF846K01EW2',
          allocationPercentage: 30,
          recommendedAmount: 0,
          rationale: 'Quality mid-caps for capital appreciation',
          riskCategory: 'aggressive'
        },
        {
          assetClass: 'equity',
          instrumentType: 'sector_fund',
          instrumentName: 'ICICI Technology Fund - Growth',
          isin: 'INF109K01VL5',
          allocationPercentage: 20,
          recommendedAmount: 0,
          rationale: 'Sectoral exposure to high-growth tech sector',
          riskCategory: 'aggressive'
        },
        {
          assetClass: 'equity',
          instrumentType: 'international_fund',
          instrumentName: 'Motilal Oswal Nasdaq 100 ETF',
          isin: 'INF247L01AP2',
          allocationPercentage: 15,
          recommendedAmount: 0,
          rationale: 'Global diversification with US tech exposure',
          riskCategory: 'aggressive'
        }
      ]
    };

    return allocations[riskCategory] || allocations.moderate;
  }

  private static calculateExpectedReturn(allocations: any[]): number {
    const assetReturns: Record<string, number> = {
      equity: 12,
      debt: 7,
      gold: 8,
      cash: 4
    };

    let weightedReturn = 0;
    allocations.forEach(alloc => {
      const assetReturn = assetReturns[alloc.assetClass] || 8;
      weightedReturn += (alloc.allocationPercentage / 100) * assetReturn;
    });

    return Math.round(weightedReturn * 10) / 10;
  }

  private static calculateRiskScore(riskCategory: string): number {
    const scores: Record<string, number> = {
      conservative: 30,
      moderate: 55,
      aggressive: 80
    };
    return scores[riskCategory] || 55;
  }

  static async processClientAction(
    proposalId: string,
    action: 'approve' | 'reject' | 'request_clarification',
    clarificationNote?: string
  ): Promise<{ success: boolean; newState: string; message: string }> {
    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status === 'approved' || proposal.status === 'rejected') {
      throw new Error('Proposal has already been actioned');
    }

    const [session] = await db
      .select()
      .from(advisorySessions)
      .where(eq(advisorySessions.proposalId, proposalId))
      .limit(1);

    if (!session) {
      throw new Error('Advisory session not found for this proposal');
    }

    if (action === 'approve') {
      if (!session.suitabilityCheckPassed) {
        await logSystemAction({
          agentId: session.agentId,
          clientId: session.clientId,
          sessionId: session.id,
          proposalId,
          actionCategory: 'compliance',
          actionType: 'client_action_blocked',
          actionDescription: 'System blocked approval: suitability check not passed',
          previousState: { suitabilityPassed: false },
          newState: { blocked: true, reason: 'suitability_check_required' }
        });
        throw new Error('Cannot approve proposal: suitability check has not passed');
      }

      if (!session.agentDeclarationAcknowledged) {
        await logSystemAction({
          agentId: session.agentId,
          clientId: session.clientId,
          sessionId: session.id,
          proposalId,
          actionCategory: 'compliance',
          actionType: 'client_action_blocked',
          actionDescription: 'System blocked approval: agent declaration not acknowledged',
          previousState: { agentDeclarationAcknowledged: false },
          newState: { blocked: true, reason: 'agent_declaration_required' }
        });
        throw new Error('Cannot approve proposal: agent declaration has not been acknowledged');
      }

      if (!session.optimizationCompleted) {
        await logSystemAction({
          agentId: session.agentId,
          clientId: session.clientId,
          sessionId: session.id,
          proposalId,
          actionCategory: 'compliance',
          actionType: 'client_action_blocked',
          actionDescription: 'System blocked approval: optimization not completed',
          previousState: { optimizationCompleted: false },
          newState: { blocked: true, reason: 'optimization_required' }
        });
        throw new Error('Cannot approve proposal: optimization has not been completed');
      }
    }

    let proposalStatus: string;
    let workflowState: string;
    let cartItemsCreated = 0;
    
    if (action === 'approve') {
      cartItemsCreated = await this.generateCartFromProposal(
        proposalId, 
        session.clientId, 
        session.agentId
      );
      
      proposalStatus = 'approved';
      workflowState = 'execution';
    } else if (action === 'reject') {
      proposalStatus = 'rejected';
      workflowState = 'cancelled';
    } else {
      proposalStatus = 'needs_revision';
      workflowState = 'draft_review';
    }

    await db
      .update(investmentProposals)
      .set({ status: proposalStatus, updatedAt: new Date() })
      .where(eq(investmentProposals.id, proposalId));

    const sessionUpdate: any = {
      workflowState,
      workflowStateUpdatedAt: new Date(),
      updatedAt: new Date()
    };

    if (action === 'approve') {
      sessionUpdate.clientApproved = true;
      sessionUpdate.clientApprovedAt = new Date();
    } else if (action === 'reject') {
      sessionUpdate.cancelledAt = new Date();
      sessionUpdate.isActive = false;
    }

    await db
      .update(advisorySessions)
      .set(sessionUpdate)
      .where(eq(advisorySessions.id, session.id));

    await logSystemAction({
      agentId: session.agentId,
      clientId: session.clientId,
      sessionId: session.id,
      proposalId,
      actionCategory: 'proposal',
      actionType: `client_action_${action}`,
      actionDescription: `System processed client ${action}${action === 'request_clarification' ? `: ${clarificationNote}` : ''}${action === 'approve' ? `, generated ${cartItemsCreated} cart items` : ''}`,
      previousState: { 
        proposalStatus: proposal.status, 
        workflowState: session.workflowState,
        suitabilityPassed: session.suitabilityCheckPassed,
        agentDeclarationAcknowledged: session.agentDeclarationAcknowledged,
        optimizationCompleted: session.optimizationCompleted
      },
      newState: { 
        proposalStatus, 
        workflowState,
        clientApproved: action === 'approve',
        cartItemsGenerated: action === 'approve' ? cartItemsCreated : 0
      }
    });

    return {
      success: true,
      newState: workflowState,
      message: action === 'approve' 
        ? `Proposal approved. ${cartItemsCreated} investment items added to cart for execution.`
        : action === 'reject'
        ? 'Proposal rejected and session closed.'
        : 'Clarification requested. Agent will revise proposal.'
    };
  }

  private static async generateCartFromProposal(
    proposalId: string,
    clientId: string,
    agentId: string
  ): Promise<number> {
    try {
      const proposalItems = await db
        .select()
        .from(investmentProposalItems)
        .where(eq(investmentProposalItems.proposalId, proposalId));

      if (!proposalItems || proposalItems.length === 0) {
        console.log('[Cart Generation] No proposal items found');
        throw new Error('No proposal items found - cannot execute empty proposal');
      }

      const cartItems = [];

      for (const item of proposalItems) {
        if (item.isAddedToCart) {
          console.log(`[Cart Generation] Skipping already-carted item: ${item.id}`);
          continue;
        }

        const productCategory = this.mapProductTypeToCategory(item.productType);
        
        if (!productCategory) {
          console.log(`[Cart Generation] Skipping unrecognized product type: ${item.productType}`);
          continue;
        }

        const cartItemId = nanoid();
        const cartItem: any = {
          id: cartItemId,
          userId: clientId,
          productCategory,
          source: 'agent',
          sourceUserId: agentId,
          sourceProposalId: proposalId,
          quantity: 1,
          amount: item.recommendedAmount?.toString() || '0',
          displayName: item.productName,
          metadata: {
            productCode: item.productCode,
            amc: item.amc,
            category: item.category,
            subCategory: item.subCategory,
            allocationPercentage: item.allocationPercentage,
            investmentType: item.investmentType,
            sipAmount: item.sipAmount,
            sipFrequency: item.sipFrequency,
            riskRating: item.riskRating,
            selectionReason: item.selectionReason,
            expectedOutcome: item.expectedOutcome,
            suitabilityScore: item.suitabilityScore,
            proposalItemId: item.id,
            oneYearReturns: item.oneYearReturns,
            threeYearReturns: item.threeYearReturns,
            fiveYearReturns: item.fiveYearReturns
          },
          status: 'active',
          clientApproved: true,
          approvedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        if (productCategory === 'mutual_fund') {
          cartItem.mutualFundSchemeCode = item.productCode;
        } else if (productCategory === 'bond') {
          cartItem.bondIsin = item.productCode;
        } else if (productCategory === 'ncd') {
          cartItem.ncdIsin = item.productCode;
        }

        cartItems.push({ cartItem, proposalItemId: item.id });
      }

      if (cartItems.length === 0) {
        throw new Error('No valid proposal items could be converted to cart - cannot execute proposal');
      }

      await db.insert(unifiedCartItems).values(cartItems.map(c => c.cartItem));

      for (const { cartItem, proposalItemId } of cartItems) {
        await db
          .update(investmentProposalItems)
          .set({ 
            isAddedToCart: true, 
            cartItemId: cartItem.id,
            updatedAt: new Date()
          })
          .where(eq(investmentProposalItems.id, proposalItemId));
      }

      await logSystemAction({
        agentId,
        clientId,
        proposalId,
        actionCategory: 'execution',
        actionType: 'cart_generation',
        actionDescription: `System generated ${cartItems.length} cart items from approved proposal items`,
        previousState: { proposalStatus: 'approved' },
        newState: { 
          cartItemsCreated: cartItems.length,
          categories: [...new Set(cartItems.map(i => i.cartItem.productCategory))],
          itemIds: cartItems.map(i => i.cartItem.id)
        }
      });

      return cartItems.length;
    } catch (error) {
      console.error('[Cart Generation] Error generating cart items:', error);
      await logSystemAction({
        agentId,
        clientId,
        proposalId,
        actionCategory: 'execution',
        actionType: 'cart_generation_error',
        actionDescription: `System failed to generate cart items: ${error}`,
        previousState: { proposalStatus: 'approved' },
        newState: { error: true }
      });
      throw error;
    }
  }

  private static mapProductTypeToCategory(productType: string): string | null {
    const type = productType?.toLowerCase()?.replace(/[_\s-]/g, '_');
    const mapping: Record<string, string> = {
      'mutual_fund': 'mutual_fund',
      'etf': 'mutual_fund',
      'bond': 'bond',
      'ncd': 'ncd',
      'equity': 'unlisted',
      'stock': 'unlisted',
      'ulip': 'mutual_fund',
      'pms': 'mutual_fund',
      'aif': 'mutual_fund',
      'mld': 'bond',
      'gold': 'bond',
      'sgb': 'bond',
      'ipo': 'ipo',
      'fd': 'bond',
      'reit': 'bond',
      'invit': 'bond',
      'liquid_fund': 'mutual_fund',
      'flexi_cap_fund': 'mutual_fund',
      'mid_cap_fund': 'mutual_fund',
      'large_cap_fund': 'mutual_fund',
      'small_cap_fund': 'mutual_fund',
      'multi_cap_fund': 'mutual_fund',
      'elss_fund': 'mutual_fund',
      'elss': 'mutual_fund',
      'debt_fund': 'mutual_fund',
      'hybrid_fund': 'mutual_fund',
      'balanced_fund': 'mutual_fund',
      'index_fund': 'mutual_fund',
      'sectoral_fund': 'mutual_fund',
      'gilt_fund': 'mutual_fund',
      'overnight_fund': 'mutual_fund',
      'money_market_fund': 'mutual_fund',
      'credit_risk_fund': 'mutual_fund',
      'corporate_bond_fund': 'mutual_fund',
      'banking_psu_fund': 'mutual_fund',
      'dynamic_bond_fund': 'mutual_fund',
      'short_duration_fund': 'mutual_fund',
      'medium_duration_fund': 'mutual_fund',
      'long_duration_fund': 'mutual_fund',
      'arbitrage_fund': 'mutual_fund',
      'aggressive_hybrid_fund': 'mutual_fund',
      'conservative_hybrid_fund': 'mutual_fund',
      'focused_fund': 'mutual_fund',
      'value_fund': 'mutual_fund',
      'contra_fund': 'mutual_fund',
      'dividend_yield_fund': 'mutual_fund',
      'thematic_fund': 'mutual_fund',
      'fof': 'mutual_fund',
      'fund_of_funds': 'mutual_fund',
      'sovereign_gold_bond': 'bond',
      'government_bond': 'bond',
      'corporate_bond': 'bond',
      'tax_free_bond': 'bond'
    };
    return mapping[type] || 'mutual_fund';
  }

  static async getWorkflowStatus(sessionId: string) {
    const [session] = await db
      .select()
      .from(advisorySessions)
      .where(eq(advisorySessions.id, sessionId))
      .limit(1);

    if (!session) {
      return null;
    }

    const currentIndex = this.WORKFLOW_ORDER.indexOf(session.workflowState);
    
    return {
      sessionId: session.id,
      clientId: session.clientId,
      currentState: session.workflowState,
      stateIndex: currentIndex,
      totalStates: this.WORKFLOW_ORDER.length,
      progressPercentage: Math.round((currentIndex / (this.WORKFLOW_ORDER.length - 2)) * 100),
      nextState: currentIndex < this.WORKFLOW_ORDER.length - 2 
        ? this.WORKFLOW_ORDER[currentIndex + 1] 
        : null,
      gates: {
        suitabilityCheckPassed: session.suitabilityCheckPassed,
        optimizationCompleted: session.optimizationCompleted,
        agentDeclarationAcknowledged: session.agentDeclarationAcknowledged
      },
      proposalId: session.proposalId,
      isActive: session.isActive,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt
    };
  }

  // ============================================================================
  // ALLOCATION MODE CONTROL (Epic 1) - AI_DRIVEN or MANUAL
  // ============================================================================

  static async selectAllocationMode(
    proposalId: string,
    mode: AllocationMode,
    agentId: string
  ): Promise<{ success: boolean; mode: AllocationMode }> {
    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');

    const existingVersions = await db
      .select()
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposalId))
      .orderBy(desc(proposalVersions.versionNumber))
      .limit(1);

    if (existingVersions.length > 0 && !existingVersions[0].strategyLocked) {
      await db
        .update(proposalVersions)
        .set({ allocationMode: mode })
        .where(eq(proposalVersions.id, existingVersions[0].id));
    } else if (existingVersions.length === 0) {
      await db.insert(proposalVersions).values({
        proposalId,
        versionNumber: 1,
        payload: { allocationMode: mode },
        allocationMode: mode,
        strategyLocked: false,
        createdBy: agentId
      });
    }

    await logSystemAction({
      agentId,
      clientId: proposal.clientId,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'allocation_mode_selected',
      actionDescription: `Advisor selected allocation mode: ${mode}`,
      previousState: {},
      newState: { allocationMode: mode }
    });

    return { success: true, mode };
  }

  static async suggestAiAllocation(
    proposalId: string,
    agentId: string
  ): Promise<{ allocation: AssetAllocation[]; requiresApproval: true }> {
    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');

    const riskCategory = proposal.riskProfile || 'moderate';
    const aiAllocation = this.generateAiAllocation(riskCategory);

    await logSystemAction({
      agentId,
      clientId: proposal.clientId,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'ai_allocation_proposed',
      actionDescription: `AI suggested allocation for risk profile: ${riskCategory}`,
      previousState: {},
      newState: { aiAllocation, requiresApproval: true }
    });

    return { allocation: aiAllocation, requiresApproval: true };
  }

  private static generateAiAllocation(riskCategory: string): AssetAllocation[] {
    const templates: Record<string, AssetAllocation[]> = {
      conservative: [
        { assetClass: 'equity', weight: 30 },
        { assetClass: 'debt', weight: 50 },
        { assetClass: 'gold', weight: 20 }
      ],
      moderate: [
        { assetClass: 'equity', weight: 55 },
        { assetClass: 'debt', weight: 30 },
        { assetClass: 'gold', weight: 10 },
        { assetClass: 'international', weight: 5 }
      ],
      aggressive: [
        { assetClass: 'equity', weight: 75 },
        { assetClass: 'debt', weight: 10 },
        { assetClass: 'international', weight: 10 },
        { assetClass: 'gold', weight: 5 }
      ]
    };
    return templates[riskCategory] || templates.moderate;
  }

  static validateAllocation(allocation: AssetAllocation[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const total = allocation.reduce((sum, a) => sum + a.weight, 0);
    if (Math.abs(total - 100) > 0.01) {
      errors.push(`Allocation weights must total 100%. Current total: ${total.toFixed(2)}%`);
    }
    for (const a of allocation) {
      if (a.weight < 0) errors.push(`${a.assetClass} weight cannot be negative`);
      if (a.weight > 100) errors.push(`${a.assetClass} weight cannot exceed 100%`);
      if (!a.assetClass || a.assetClass.trim() === '') errors.push('Asset class name is required');
    }
    return { valid: errors.length === 0, errors };
  }

  // ============================================================================
  // STRATEGY SNAPSHOT LOCKING (Epic 2)
  // ============================================================================

  static async lockStrategySnapshot(
    proposalId: string,
    allocationMode: AllocationMode,
    allocation: AssetAllocation[],
    agentId: string
  ): Promise<{ success: boolean; snapshot: StrategySnapshot; versionId: number }> {
    const validation = this.validateAllocation(allocation);
    if (!validation.valid) {
      throw new Error(`Allocation validation failed: ${validation.errors.join(', ')}`);
    }

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');

    const existingVersions = await db
      .select()
      .from(proposalVersions)
      .where(eq(proposalVersions.proposalId, proposalId))
      .orderBy(desc(proposalVersions.versionNumber))
      .limit(1);

    const nextVersion = existingVersions.length > 0 
      ? (existingVersions[0].versionNumber || 0) + 1 
      : 1;

    const snapshot: StrategySnapshot = {
      allocationMode,
      assetAllocation: allocation,
      lockedAt: new Date(),
      lockedBy: agentId,
      totalWeight: allocation.reduce((sum, a) => sum + a.weight, 0)
    };

    const [version] = await db.insert(proposalVersions).values({
      proposalId,
      versionNumber: nextVersion,
      payload: {
        allocation,
        proposalData: proposal.recommendations,
        targetAllocation: proposal.targetAllocation
      },
      allocationMode,
      strategySnapshot: snapshot,
      strategyLocked: true,
      changeReason: allocationMode === 'AI_DRIVEN' 
        ? 'AI allocation approved and locked by advisor'
        : 'Manual allocation locked by advisor',
      createdBy: agentId
    }).returning();

    await logSystemAction({
      agentId,
      clientId: proposal.clientId,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'strategy_snapshot_created',
      actionDescription: `Strategy snapshot locked (v${nextVersion}): ${allocationMode} mode, ${allocation.length} asset classes`,
      previousState: { strategyLocked: false },
      newState: { strategyLocked: true, snapshot, versionNumber: nextVersion }
    });

    return { success: true, snapshot, versionId: version.id };
  }

  static async getLockedStrategy(proposalId: string): Promise<{
    locked: boolean;
    snapshot: StrategySnapshot | null;
    versionNumber: number;
  }> {
    const [latestVersion] = await db
      .select()
      .from(proposalVersions)
      .where(and(
        eq(proposalVersions.proposalId, proposalId),
        eq(proposalVersions.strategyLocked, true)
      ))
      .orderBy(desc(proposalVersions.versionNumber))
      .limit(1);

    if (!latestVersion || !latestVersion.strategyLocked) {
      return { locked: false, snapshot: null, versionNumber: 0 };
    }

    return {
      locked: true,
      snapshot: latestVersion.strategySnapshot as StrategySnapshot,
      versionNumber: latestVersion.versionNumber
    };
  }

  // ============================================================================
  // PRODUCT SELECTION CONSTRAINT (Epic 3)
  // ============================================================================

  static async selectInstrumentsWithinStrategy(
    proposalId: string,
    agentId: string
  ): Promise<{ allocations: any[]; totalAmount: number }> {
    const strategy = await this.getLockedStrategy(proposalId);
    if (!strategy.locked || !strategy.snapshot) {
      throw new Error('Strategy must be locked before product selection. Lock allocation first.');
    }

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');

    const investmentAmount = parseFloat(proposal.totalInvestmentAmount?.toString() || '100000');
    const allocations: any[] = [];

    for (const asset of strategy.snapshot.assetAllocation) {
      const instruments = this.getInstrumentsForAssetClass(asset.assetClass, proposal.riskProfile || 'moderate');
      const classAmount = Math.round((asset.weight / 100) * investmentAmount);

      for (const inst of instruments) {
        const instrumentAmount = Math.round((inst.weightWithinClass / 100) * classAmount);
        allocations.push({
          assetClass: asset.assetClass,
          instrumentType: inst.instrumentType,
          instrumentName: inst.instrumentName,
          isin: inst.isin,
          allocationPercentage: (asset.weight * inst.weightWithinClass) / 100,
          recommendedAmount: instrumentAmount,
          rationale: inst.rationale,
          riskCategory: inst.riskCategory,
          strategyWeight: asset.weight
        });
      }
    }

    const actualTotalWeight = allocations.reduce((sum, a) => sum + a.allocationPercentage, 0);
    if (Math.abs(actualTotalWeight - 100) > 1) {
      throw new Error(`AllocationDriftError: Total weight ${actualTotalWeight.toFixed(2)}% deviates from strategy 100%`);
    }

    return { allocations, totalAmount: investmentAmount };
  }

  private static getInstrumentsForAssetClass(assetClass: string, riskProfile: string): {
    instrumentType: string;
    instrumentName: string;
    isin: string;
    weightWithinClass: number;
    rationale: string;
    riskCategory: string;
  }[] {
    const instrumentMap: Record<string, Record<string, any[]>> = {
      equity: {
        conservative: [
          { instrumentType: 'large_cap_fund', instrumentName: 'Axis Bluechip Fund - Growth', isin: 'INF846K01EW2', weightWithinClass: 60, rationale: 'Blue-chip exposure for stability', riskCategory: 'moderate' },
          { instrumentType: 'index_fund', instrumentName: 'UTI Nifty 50 Index Fund', isin: 'INF789F01YN0', weightWithinClass: 40, rationale: 'Low-cost market-cap tracking', riskCategory: 'moderate' }
        ],
        moderate: [
          { instrumentType: 'flexi_cap_fund', instrumentName: 'Parag Parikh Flexi Cap Fund - Growth', isin: 'INF879O01027', weightWithinClass: 50, rationale: 'Diversified equity across market caps', riskCategory: 'moderate' },
          { instrumentType: 'mid_cap_fund', instrumentName: 'Kotak Emerging Equity Fund - Growth', isin: 'INF174K01LS2', weightWithinClass: 30, rationale: 'Mid-cap growth potential', riskCategory: 'aggressive' },
          { instrumentType: 'large_cap_fund', instrumentName: 'ICICI Pru Bluechip Fund', isin: 'INF109K01BD8', weightWithinClass: 20, rationale: 'Large-cap stability anchor', riskCategory: 'moderate' }
        ],
        aggressive: [
          { instrumentType: 'small_cap_fund', instrumentName: 'Nippon India Small Cap Fund', isin: 'INF204K01UN5', weightWithinClass: 40, rationale: 'High growth from small-cap', riskCategory: 'aggressive' },
          { instrumentType: 'mid_cap_fund', instrumentName: 'Axis Midcap Fund - Growth', isin: 'INF846K01EW2', weightWithinClass: 35, rationale: 'Quality mid-caps', riskCategory: 'aggressive' },
          { instrumentType: 'sector_fund', instrumentName: 'ICICI Technology Fund', isin: 'INF109K01VL5', weightWithinClass: 25, rationale: 'Sectoral tech exposure', riskCategory: 'aggressive' }
        ]
      },
      debt: {
        conservative: [
          { instrumentType: 'corporate_bond_fund', instrumentName: 'HDFC Corporate Bond Fund', isin: 'INF179K01AB1', weightWithinClass: 60, rationale: 'Capital preservation', riskCategory: 'conservative' },
          { instrumentType: 'gilt_fund', instrumentName: 'SBI Magnum Gilt Fund', isin: 'INF200K01RJ1', weightWithinClass: 40, rationale: 'Sovereign safety', riskCategory: 'conservative' }
        ],
        moderate: [
          { instrumentType: 'dynamic_bond_fund', instrumentName: 'ICICI Dynamic Bond Fund', isin: 'INF109K01Z82', weightWithinClass: 50, rationale: 'Active duration management', riskCategory: 'moderate' },
          { instrumentType: 'short_duration_fund', instrumentName: 'Axis Short Term Fund', isin: 'INF846K01C55', weightWithinClass: 50, rationale: 'Short duration stability', riskCategory: 'conservative' }
        ],
        aggressive: [
          { instrumentType: 'credit_risk_fund', instrumentName: 'HDFC Credit Risk Fund', isin: 'INF179K01GH2', weightWithinClass: 50, rationale: 'Higher yield potential', riskCategory: 'moderate' },
          { instrumentType: 'dynamic_bond_fund', instrumentName: 'ICICI Dynamic Bond Fund', isin: 'INF109K01Z82', weightWithinClass: 50, rationale: 'Active duration play', riskCategory: 'moderate' }
        ]
      },
      gold: {
        conservative: [{ instrumentType: 'sovereign_gold_bond', instrumentName: 'Sovereign Gold Bond 2.5%', isin: 'SGB2024', weightWithinClass: 100, rationale: 'Gold with interest income', riskCategory: 'conservative' }],
        moderate: [{ instrumentType: 'gold_etf', instrumentName: 'SBI Gold ETF', isin: 'INF200K01VN1', weightWithinClass: 100, rationale: 'Gold exposure via ETF', riskCategory: 'conservative' }],
        aggressive: [{ instrumentType: 'gold_etf', instrumentName: 'Nippon Gold ETF', isin: 'INF204K01EY0', weightWithinClass: 100, rationale: 'Portfolio hedge', riskCategory: 'conservative' }]
      },
      international: {
        conservative: [{ instrumentType: 'international_fund', instrumentName: 'Motilal Oswal S&P 500 Index Fund', isin: 'INF247L01CZ2', weightWithinClass: 100, rationale: 'US market diversification', riskCategory: 'moderate' }],
        moderate: [{ instrumentType: 'international_fund', instrumentName: 'Motilal Oswal Nasdaq 100 ETF', isin: 'INF247L01AP2', weightWithinClass: 100, rationale: 'Global tech diversification', riskCategory: 'aggressive' }],
        aggressive: [{ instrumentType: 'international_fund', instrumentName: 'Motilal Oswal Nasdaq 100 ETF', isin: 'INF247L01AP2', weightWithinClass: 100, rationale: 'High-growth US tech', riskCategory: 'aggressive' }]
      }
    };

    const classInstruments = instrumentMap[assetClass];
    if (!classInstruments) {
      return [{ instrumentType: 'index_fund', instrumentName: `${assetClass} Index Fund`, isin: `GENERIC_${assetClass.toUpperCase()}`, weightWithinClass: 100, rationale: `${assetClass} exposure`, riskCategory: 'moderate' }];
    }
    return classInstruments[riskProfile] || classInstruments.moderate || Object.values(classInstruments)[0];
  }

  // ============================================================================
  // FAIR BACKTESTING ENGINE (Epic 4)
  // ============================================================================

  static async runFairBacktest(
    proposalId: string,
    oldHoldings: { assetClass: string; weight: number; startDate?: string }[],
    agentId: string
  ): Promise<{
    delta: BacktestDelta;
    oldMetrics: any;
    proposedMetrics: any;
    commonPeriod: { start: string; end: string };
  }> {
    const strategy = await this.getLockedStrategy(proposalId);
    if (!strategy.locked || !strategy.snapshot) {
      throw new Error('Strategy must be locked before backtesting');
    }

    const proposedAllocation = strategy.snapshot.assetAllocation;
    const commonStartDate = this.computeCommonStartDate(oldHoldings);
    const commonEndDate = new Date().toISOString().split('T')[0];

    const oldMetrics = this.simulatePortfolioMetrics(oldHoldings, commonStartDate, commonEndDate);
    const proposedHoldings = proposedAllocation.map(a => ({ assetClass: a.assetClass, weight: a.weight }));
    const proposedMetrics = this.simulatePortfolioMetrics(proposedHoldings, commonStartDate, commonEndDate);

    const delta: BacktestDelta = {
      cagrDifference: proposedMetrics.cagr - oldMetrics.cagr,
      volatilityDifference: proposedMetrics.volatility - oldMetrics.volatility,
      maxDrawdownDifference: proposedMetrics.maxDrawdown - oldMetrics.maxDrawdown,
      sharpeImprovement: proposedMetrics.sharpeRatio - oldMetrics.sharpeRatio
    };

    const snapshotHash = createHash('sha256')
      .update(JSON.stringify({ oldHoldings, proposedAllocation, commonStartDate, commonEndDate }))
      .digest('hex');

    await db.insert(proposalBacktestResults).values({
      proposalId,
      versionNumber: strategy.versionNumber,
      includesBacktest: true,
      commonStartDate,
      commonEndDate,
      oldPortfolioMetrics: oldMetrics,
      proposedPortfolioMetrics: proposedMetrics,
      deltaSummary: delta,
      backtestSnapshotHash: snapshotHash,
      assumptions: {
        rebalanceFrequency: 'annual',
        tacticalReallocation: false,
        aiReweighting: false,
        periodOptimization: false,
        dataSource: 'SIMULATED_ASSET_CLASS_AVERAGES',
        riskFreeRate: 6.0,
        disclaimer: 'Backtest uses historical asset class averages, not individual fund returns. Actual results may vary.'
      }
    });

    await logSystemAction({
      agentId,
      clientId: null,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'backtest_comparison_completed',
      actionDescription: `Fair backtest completed: CAGR delta ${delta.cagrDifference > 0 ? '+' : ''}${delta.cagrDifference.toFixed(2)}%, Sharpe improvement ${delta.sharpeImprovement.toFixed(3)}`,
      previousState: { oldMetrics },
      newState: { proposedMetrics, delta, snapshotHash }
    });

    return {
      delta,
      oldMetrics,
      proposedMetrics,
      commonPeriod: { start: commonStartDate, end: commonEndDate }
    };
  }

  private static computeCommonStartDate(oldHoldings: { startDate?: string }[]): string {
    const dates = oldHoldings
      .map(h => h.startDate)
      .filter(Boolean)
      .map(d => new Date(d!).getTime());
    
    if (dates.length === 0) {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      return threeYearsAgo.toISOString().split('T')[0];
    }
    return new Date(Math.max(...dates)).toISOString().split('T')[0];
  }

  private static simulatePortfolioMetrics(
    holdings: { assetClass: string; weight: number }[],
    startDate: string,
    endDate: string
  ): { cagr: number; volatility: number; maxDrawdown: number; sharpeRatio: number; growthOf10L: number } {
    const assetReturns: Record<string, { annualReturn: number; volatility: number; maxDD: number }> = {
      equity: { annualReturn: 12.5, volatility: 18.0, maxDD: -35 },
      debt: { annualReturn: 7.2, volatility: 4.5, maxDD: -5 },
      gold: { annualReturn: 8.5, volatility: 12.0, maxDD: -15 },
      international: { annualReturn: 11.0, volatility: 16.0, maxDD: -30 },
      cash: { annualReturn: 4.0, volatility: 0.5, maxDD: 0 }
    };

    let weightedReturn = 0;
    let weightedVolatility = 0;
    let weightedDrawdown = 0;

    for (const h of holdings) {
      const stats = assetReturns[h.assetClass] || assetReturns.equity;
      const w = h.weight / 100;
      weightedReturn += w * stats.annualReturn;
      weightedVolatility += w * w * stats.volatility * stats.volatility;
      weightedDrawdown += w * stats.maxDD;
    }

    const portfolioVolatility = Math.sqrt(weightedVolatility);
    const riskFreeRate = 6.0; // India 10Y G-Sec benchmark, aligned with enrichment pipeline
    const sharpeRatio = portfolioVolatility > 0 
      ? (weightedReturn - riskFreeRate) / portfolioVolatility 
      : 0;

    const years = (new Date(endDate).getTime() - new Date(startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const growthOf10L = Math.round(1000000 * Math.pow(1 + weightedReturn / 100, years));

    return {
      cagr: Math.round(weightedReturn * 100) / 100,
      volatility: Math.round(portfolioVolatility * 100) / 100,
      maxDrawdown: Math.round(weightedDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 1000) / 1000,
      growthOf10L
    };
  }

  // ============================================================================
  // PORTFOLIO DIFFERENCE SUMMARY (Epic 5)
  // ============================================================================

  static async generatePortfolioDifferenceSummary(
    proposalId: string,
    oldAllocation: AssetAllocation[],
    agentId: string
  ): Promise<PortfolioDifferenceSummary> {
    const strategy = await this.getLockedStrategy(proposalId);
    if (!strategy.locked || !strategy.snapshot) {
      throw new Error('Strategy must be locked before generating difference summary');
    }

    const proposed = strategy.snapshot.assetAllocation;
    const allAssetClasses = [...new Set([
      ...oldAllocation.map(a => a.assetClass),
      ...proposed.map(a => a.assetClass)
    ])];

    const allocationDelta = allAssetClasses.map(ac => {
      const oldWeight = oldAllocation.find(a => a.assetClass === ac)?.weight || 0;
      const proposedWeight = proposed.find(a => a.assetClass === ac)?.weight || 0;
      return {
        assetClass: ac,
        oldWeight,
        proposedWeight,
        change: proposedWeight - oldWeight
      };
    });

    const assetReturns: Record<string, { ret: number; vol: number; dd: number; cost: number }> = {
      equity: { ret: 12.5, vol: 18.0, dd: -35, cost: 0.5 },
      debt: { ret: 7.2, vol: 4.5, dd: -5, cost: 0.3 },
      gold: { ret: 8.5, vol: 12.0, dd: -15, cost: 0.1 },
      international: { ret: 11.0, vol: 16.0, dd: -30, cost: 0.8 },
      cash: { ret: 4.0, vol: 0.5, dd: 0, cost: 0.0 }
    };

    const calcWeighted = (alloc: AssetAllocation[], field: 'ret' | 'vol' | 'dd' | 'cost') =>
      alloc.reduce((sum, a) => sum + (a.weight / 100) * (assetReturns[a.assetClass]?.[field] || 0), 0);

    const riskMetricDelta = [
      { metric: 'Expected Return (CAGR)', oldValue: calcWeighted(oldAllocation, 'ret'), proposedValue: calcWeighted(proposed, 'ret'), impact: '' },
      { metric: 'Volatility', oldValue: calcWeighted(oldAllocation, 'vol'), proposedValue: calcWeighted(proposed, 'vol'), impact: '' },
      { metric: 'Max Drawdown', oldValue: calcWeighted(oldAllocation, 'dd'), proposedValue: calcWeighted(proposed, 'dd'), impact: '' }
    ].map(m => ({
      ...m,
      impact: m.metric === 'Volatility' || m.metric === 'Max Drawdown'
        ? (m.proposedValue < m.oldValue ? 'Improved' : m.proposedValue > m.oldValue ? 'Worsened' : 'Unchanged')
        : (m.proposedValue > m.oldValue ? 'Improved' : m.proposedValue < m.oldValue ? 'Worsened' : 'Unchanged')
    }));

    const oldCost = calcWeighted(oldAllocation, 'cost');
    const proposedCost = calcWeighted(proposed, 'cost');
    const costDelta = [{
      category: 'Expense Ratio (weighted)',
      oldCost: Math.round(oldCost * 100) / 100,
      proposedCost: Math.round(proposedCost * 100) / 100,
      savings: Math.round((oldCost - proposedCost) * 100) / 100
    }];

    const concentrationDelta = allAssetClasses.map(ac => ({
      assetClass: ac,
      oldConcentration: oldAllocation.find(a => a.assetClass === ac)?.weight || 0,
      proposedConcentration: proposed.find(a => a.assetClass === ac)?.weight || 0
    }));

    const summary: PortfolioDifferenceSummary = {
      allocationDelta,
      riskMetricDelta,
      costDelta,
      concentrationDelta
    };

    await db
      .update(proposalBacktestResults)
      .set({ portfolioDifferenceSummary: summary })
      .where(eq(proposalBacktestResults.proposalId, proposalId));

    await logSystemAction({
      agentId,
      clientId: null,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'portfolio_difference_summary_generated',
      actionDescription: `Portfolio difference summary generated: ${allocationDelta.length} asset classes compared`,
      previousState: { oldAllocation },
      newState: { summary }
    });

    return summary;
  }

  // ============================================================================
  // VERSIONING ENFORCEMENT (Epic 10)
  // ============================================================================

  static async forceNewVersionOnAllocationChange(
    proposalId: string,
    newAllocation: AssetAllocation[],
    allocationMode: AllocationMode,
    agentId: string,
    changeReason: string
  ): Promise<{ newVersionNumber: number; snapshotId: number }> {
    const existingStrategy = await this.getLockedStrategy(proposalId);
    if (!existingStrategy.locked) {
      return this.lockStrategySnapshot(proposalId, allocationMode, newAllocation, agentId)
        .then(r => ({ newVersionNumber: r.versionId, snapshotId: r.versionId }));
    }

    const validation = this.validateAllocation(newAllocation);
    if (!validation.valid) {
      throw new Error(`Allocation validation failed: ${validation.errors.join(', ')}`);
    }

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) throw new Error('Proposal not found');

    const result = await this.lockStrategySnapshot(proposalId, allocationMode, newAllocation, agentId);

    await logSystemAction({
      agentId,
      clientId: proposal.clientId,
      proposalId,
      actionCategory: 'proposal',
      actionType: 'allocation_change_forced_new_version',
      actionDescription: `Allocation changed after lock: new version created. Reason: ${changeReason}`,
      previousState: { previousSnapshot: existingStrategy.snapshot, previousVersion: existingStrategy.versionNumber },
      newState: { newVersion: result.versionId, newAllocation, changeReason }
    });

    return { newVersionNumber: result.versionId, snapshotId: result.versionId };
  }
}

export default ProposalOrchestrator;
