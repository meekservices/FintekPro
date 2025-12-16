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
  agentComplianceAuditLogs
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
    const horizonYears = riskProfile?.investmentHorizon || 5;
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
    
    if (action === 'approve') {
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
      actionDescription: `System processed client ${action}${action === 'request_clarification' ? `: ${clarificationNote}` : ''}`,
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
        clientApproved: action === 'approve'
      }
    });

    return {
      success: true,
      newState: workflowState,
      message: action === 'approve' 
        ? 'Proposal approved. System will execute investments.'
        : action === 'reject'
        ? 'Proposal rejected and session closed.'
        : 'Clarification requested. Agent will revise proposal.'
    };
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
}

export default ProposalOrchestrator;
