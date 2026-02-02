import { db } from '../db';
import { 
  proposalFlowState,
  proposalVerdicts,
  proposalSipRecommendations,
  investmentProposals,
  InsertProposalFlowState
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export type ProposalPhase = 
  | 'risk_profile'
  | 'investment_horizon'
  | 'goal'
  | 'portfolio_input'
  | 'analysis'
  | 'recommendation'
  | 'rebalancing'
  | 'verdict'
  | 'report';

export interface PhaseValidation {
  phase: ProposalPhase;
  isLocked: boolean;
  reason?: string;
  prerequisites: ProposalPhase[];
  missingPrerequisites: ProposalPhase[];
}

export interface ProposalFlowStatus {
  proposalId: string;
  currentPhase: ProposalPhase;
  phases: PhaseValidation[];
  canProgress: boolean;
  blockReason?: string;
}

const PHASE_ORDER: ProposalPhase[] = [
  'risk_profile',
  'investment_horizon',
  'goal',
  'portfolio_input',
  'analysis',
  'recommendation',
  'rebalancing',
  'verdict',
  'report'
];

const PHASE_PREREQUISITES: Record<ProposalPhase, ProposalPhase[]> = {
  risk_profile: [],
  investment_horizon: ['risk_profile'],
  goal: ['risk_profile', 'investment_horizon'],
  portfolio_input: ['goal'],
  analysis: ['portfolio_input'],
  recommendation: ['analysis'],
  rebalancing: ['recommendation'],
  verdict: ['rebalancing'],
  report: ['verdict']
};

const PHASE_DISPLAY_NAMES: Record<ProposalPhase, string> = {
  risk_profile: 'Risk Profile',
  investment_horizon: 'Investment Horizon',
  goal: 'Goal Selection',
  portfolio_input: 'Portfolio Input',
  analysis: 'Portfolio Analysis',
  recommendation: 'AI Recommendations',
  rebalancing: 'Rebalancing',
  verdict: 'Verdict Assignment',
  report: 'Report Generation'
};

export class ProposalFlowGatekeeper {
  static async initializeFlowState(proposalId: string): Promise<void> {
    const existing = await db
      .select()
      .from(proposalFlowState)
      .where(eq(proposalFlowState.proposalId, proposalId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(proposalFlowState).values({
        proposalId,
        currentPhase: 'risk_profile',
        lockedPhases: []
      });
    }
  }

  static async getFlowStatus(proposalId: string): Promise<ProposalFlowStatus> {
    let [state] = await db
      .select()
      .from(proposalFlowState)
      .where(eq(proposalFlowState.proposalId, proposalId))
      .limit(1);

    if (!state) {
      await this.initializeFlowState(proposalId);
      [state] = await db
        .select()
        .from(proposalFlowState)
        .where(eq(proposalFlowState.proposalId, proposalId))
        .limit(1);
    }

    const phases: PhaseValidation[] = PHASE_ORDER.map(phase => {
      const prerequisites = PHASE_PREREQUISITES[phase];
      const missingPrerequisites = prerequisites.filter(prereq => {
        return !this.isPhaseCompleted(state, prereq);
      });

      return {
        phase,
        isLocked: missingPrerequisites.length > 0,
        reason: missingPrerequisites.length > 0
          ? `Complete ${missingPrerequisites.map(p => PHASE_DISPLAY_NAMES[p]).join(', ')} first`
          : undefined,
        prerequisites,
        missingPrerequisites
      };
    });

    const currentPhaseIndex = PHASE_ORDER.indexOf(state.currentPhase as ProposalPhase);
    const nextPhase = PHASE_ORDER[currentPhaseIndex + 1];
    const canProgress = nextPhase
      ? phases.find(p => p.phase === nextPhase)?.isLocked === false
      : false;

    return {
      proposalId,
      currentPhase: state.currentPhase as ProposalPhase,
      phases,
      canProgress,
      blockReason: !canProgress && nextPhase
        ? phases.find(p => p.phase === nextPhase)?.reason
        : undefined
    };
  }

  private static isPhaseCompleted(state: any, phase: ProposalPhase): boolean {
    const phaseMap: Record<ProposalPhase, string> = {
      risk_profile: 'riskProfileCompleted',
      investment_horizon: 'investmentHorizonCompleted',
      goal: 'goalCompleted',
      portfolio_input: 'portfolioInputCompleted',
      analysis: 'analysisCompleted',
      recommendation: 'recommendationCompleted',
      rebalancing: 'rebalancingCompleted',
      verdict: 'verdictCompleted',
      report: 'reportCompleted'
    };
    return state[phaseMap[phase]] === true;
  }

  static async validatePhaseTransition(
    proposalId: string,
    targetPhase: ProposalPhase
  ): Promise<{ valid: boolean; errors: string[] }> {
    const status = await this.getFlowStatus(proposalId);
    const errors: string[] = [];

    const targetPhaseValidation = status.phases.find(p => p.phase === targetPhase);
    if (!targetPhaseValidation) {
      errors.push(`Unknown phase: ${targetPhase}`);
      return { valid: false, errors };
    }

    if (targetPhaseValidation.isLocked) {
      errors.push(targetPhaseValidation.reason || 'Phase is locked');
      targetPhaseValidation.missingPrerequisites.forEach(prereq => {
        errors.push(`Missing prerequisite: ${PHASE_DISPLAY_NAMES[prereq]}`);
      });
    }

    return { valid: errors.length === 0, errors };
  }

  static async completePhase(
    proposalId: string,
    phase: ProposalPhase
  ): Promise<{ success: boolean; nextPhase?: ProposalPhase; error?: string }> {
    const validation = await this.validatePhaseTransition(proposalId, phase);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    const updates: Partial<InsertProposalFlowState> = {};
    const timestamp = new Date();

    switch (phase) {
      case 'risk_profile':
        updates.riskProfileCompleted = true;
        updates.riskProfileCompletedAt = timestamp;
        break;
      case 'investment_horizon':
        updates.investmentHorizonCompleted = true;
        updates.investmentHorizonCompletedAt = timestamp;
        break;
      case 'goal':
        updates.goalCompleted = true;
        updates.goalCompletedAt = timestamp;
        break;
      case 'portfolio_input':
        updates.portfolioInputCompleted = true;
        updates.portfolioInputCompletedAt = timestamp;
        break;
      case 'analysis':
        updates.analysisCompleted = true;
        updates.analysisCompletedAt = timestamp;
        break;
      case 'recommendation':
        updates.recommendationCompleted = true;
        updates.recommendationCompletedAt = timestamp;
        break;
      case 'rebalancing':
        updates.rebalancingCompleted = true;
        updates.rebalancingCompletedAt = timestamp;
        break;
      case 'verdict':
        updates.verdictCompleted = true;
        updates.verdictCompletedAt = timestamp;
        break;
      case 'report':
        updates.reportCompleted = true;
        updates.reportCompletedAt = timestamp;
        break;
    }

    const phaseIndex = PHASE_ORDER.indexOf(phase);
    const nextPhase = PHASE_ORDER[phaseIndex + 1];
    if (nextPhase) {
      updates.currentPhase = nextPhase;
    }

    await db
      .update(proposalFlowState)
      .set({ ...updates, updatedAt: timestamp })
      .where(eq(proposalFlowState.proposalId, proposalId));

    return { success: true, nextPhase };
  }

  static async validatePortfolioAnalysis(proposalId: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      errors.push('Proposal not found');
      return { valid: false, errors };
    }

    const hasHoldings = proposal.currentAllocation !== null;
    const hasFreshAmount = parseFloat(proposal.totalInvestmentAmount?.toString() || '0') > 0;

    if (!hasHoldings && !hasFreshAmount) {
      errors.push('Cannot analyze portfolio without holdings or fresh investment amount');
    }

    return { valid: errors.length === 0, errors };
  }

  static async validateRecommendations(proposalId: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      errors.push('Proposal not found');
      return { valid: false, errors };
    }

    if (!proposal.targetAllocation) {
      errors.push('Cannot generate recommendations without target asset allocation');
    }

    return { valid: errors.length === 0, errors };
  }

  static async validateReportGeneration(proposalId: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const verdicts = await db
      .select()
      .from(proposalVerdicts)
      .where(eq(proposalVerdicts.proposalId, proposalId));

    if (verdicts.length === 0) {
      errors.push('Cannot generate report without instrument verdicts');
    }

    const incompleteVerdicts = verdicts.filter(v => !v.verdict);
    if (incompleteVerdicts.length > 0) {
      errors.push(`${incompleteVerdicts.length} instruments missing verdicts`);
    }

    return { valid: errors.length === 0, errors };
  }
}

export function createPhaseValidationMiddleware(targetPhase: ProposalPhase) {
  return async (req: any, res: any, next: any) => {
    const proposalId = req.params.proposalId || req.body.proposalId;
    
    if (!proposalId) {
      return res.status(400).json({ 
        error: 'PROPOSAL_ID_REQUIRED',
        message: 'Proposal ID is required for this operation'
      });
    }

    const validation = await ProposalFlowGatekeeper.validatePhaseTransition(proposalId, targetPhase);
    
    if (!validation.valid) {
      return res.status(403).json({
        error: 'PHASE_LOCKED',
        message: 'This phase is locked due to incomplete prerequisites',
        phase: targetPhase,
        errors: validation.errors
      });
    }

    next();
  };
}

console.log('✅ Proposal Flow Gatekeeper initialized');
