// @ts-nocheck
import { db } from "../db";
import { prospectClients, type ProspectReadinessStatus } from "@shared/schema";
import { eq } from "drizzle-orm";

type ReadinessStatus = ProspectReadinessStatus;

interface ReadinessTransitionLog {
  fromStatus: ReadinessStatus;
  toStatus: ReadinessStatus;
  reason: string;
  timestamp: Date;
}

interface ReadinessCheckResult {
  isReady: boolean;
  currentStatus: ReadinessStatus;
  missingSteps: string[];
  completedSteps: string[];
}

export class ProspectReadinessService {
  private static instance: ProspectReadinessService;
  private transitionLogs: Map<string, ReadinessTransitionLog[]> = new Map();

  private constructor() {}

  static getInstance(): ProspectReadinessService {
    if (!this.instance) {
      this.instance = new ProspectReadinessService();
    }
    return this.instance;
  }

  private getStatusOrder(): Record<ReadinessStatus, number> {
    return {
      'INITIAL': 0,
      'HOLDINGS_IMPORTED': 1,
      'RISK_PROFILE_COMPLETED': 2,
      'TAX_PROFILE_COMPLETED': 3,
      'READY_FOR_PROPOSAL': 4
    };
  }

  private getStatusLabel(status: ReadinessStatus): string {
    const labels: Record<ReadinessStatus, string> = {
      'INITIAL': 'Initial Registration',
      'HOLDINGS_IMPORTED': 'Holdings Imported',
      'RISK_PROFILE_COMPLETED': 'Risk Profile Completed',
      'TAX_PROFILE_COMPLETED': 'Tax Profile Completed',
      'READY_FOR_PROPOSAL': 'Ready for Proposal'
    };
    return labels[status];
  }

  async getCurrentStatus(prospectId: string): Promise<ReadinessStatus | null> {
    const [prospect] = await db.select({
      readinessStatus: prospectClients.readinessStatus
    })
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    return prospect?.readinessStatus as ReadinessStatus || null;
  }

  async checkReadiness(prospectId: string): Promise<ReadinessCheckResult> {
    const [prospect] = await db.select()
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect) {
      return {
        isReady: false,
        currentStatus: 'INITIAL',
        missingSteps: ['Prospect not found'],
        completedSteps: []
      };
    }

    let status = (prospect.readinessStatus || 'INITIAL') as ReadinessStatus;
    const statusOrder = this.getStatusOrder();

    const hasHoldings = Array.isArray(prospect.currentPortfolio) && (prospect.currentPortfolio as any[]).length > 0;
    if (hasHoldings && status === 'INITIAL') {
      status = 'HOLDINGS_IMPORTED';
      this.advanceOnHoldingsImport(prospectId).catch(() => {});
    }

    const currentOrder = statusOrder[status];

    const completedSteps: string[] = [];
    const missingSteps: string[] = [];

    if (currentOrder >= 1 || hasHoldings) completedSteps.push('Holdings Imported');
    else missingSteps.push('Import holdings (CAS statement or manual entry)');

    if (currentOrder >= 2) completedSteps.push('Risk Profile Completed');
    else missingSteps.push('Complete risk profile questionnaire');

    if (currentOrder >= 3) completedSteps.push('Tax Profile Completed');
    else missingSteps.push('Save tax profile information');

    if (currentOrder >= 4) completedSteps.push('Ready for Proposal');

    return {
      isReady: status === 'READY_FOR_PROPOSAL',
      currentStatus: status,
      missingSteps,
      completedSteps
    };
  }

  async advanceOnHoldingsImport(prospectId: string): Promise<ReadinessStatus> {
    const currentStatus = await this.getCurrentStatus(prospectId);
    
    if (currentStatus === 'INITIAL') {
      return this.transitionStatus(prospectId, 'INITIAL', 'HOLDINGS_IMPORTED', 'Holdings imported from CAS/manual entry');
    }
    
    return currentStatus || 'INITIAL';
  }

  async advanceOnRiskProfileComplete(prospectId: string): Promise<ReadinessStatus> {
    const currentStatus = await this.getCurrentStatus(prospectId);
    
    if (currentStatus === 'HOLDINGS_IMPORTED') {
      return this.transitionStatus(prospectId, 'HOLDINGS_IMPORTED', 'RISK_PROFILE_COMPLETED', 'Risk questionnaire completed');
    }
    
    if (currentStatus === 'INITIAL') {
      return this.transitionStatus(prospectId, 'INITIAL', 'RISK_PROFILE_COMPLETED', 'Risk questionnaire completed (holdings pending)');
    }
    
    return currentStatus || 'INITIAL';
  }

  async advanceOnTaxProfileComplete(prospectId: string): Promise<ReadinessStatus> {
    const currentStatus = await this.getCurrentStatus(prospectId);
    
    if (currentStatus === 'RISK_PROFILE_COMPLETED') {
      return this.transitionStatus(prospectId, 'RISK_PROFILE_COMPLETED', 'TAX_PROFILE_COMPLETED', 'Tax profile saved');
    }
    
    return currentStatus || 'INITIAL';
  }

  async evaluateAndAdvanceToReady(prospectId: string): Promise<ReadinessCheckResult> {
    const [prospect] = await db.select()
      .from(prospectClients)
      .where(eq(prospectClients.id, prospectId))
      .limit(1);

    if (!prospect) {
      return {
        isReady: false,
        currentStatus: 'INITIAL',
        missingSteps: ['Prospect not found'],
        completedSteps: []
      };
    }

    const hasHoldings = prospect.currentPortfolio && 
      Array.isArray(prospect.currentPortfolio) && 
      prospect.currentPortfolio.length > 0;
    
    const hasRiskProfile = !!prospect.indicativeRiskProfile;
    const hasTaxProfile = !!prospect.taxProfile;

    let newStatus: ReadinessStatus = 'INITIAL';

    if (hasHoldings && hasRiskProfile && hasTaxProfile) {
      newStatus = 'READY_FOR_PROPOSAL';
    } else if (hasHoldings && hasRiskProfile) {
      newStatus = 'TAX_PROFILE_COMPLETED';
    } else if (hasHoldings) {
      newStatus = 'RISK_PROFILE_COMPLETED';
    } else if (hasRiskProfile) {
      newStatus = 'HOLDINGS_IMPORTED';
    }

    if (prospect.readinessStatus !== newStatus) {
      await this.transitionStatus(
        prospectId, 
        (prospect.readinessStatus || 'INITIAL') as ReadinessStatus, 
        newStatus, 
        'Status evaluated based on data completeness'
      );
    }

    return this.checkReadiness(prospectId);
  }

  async canGenerateProposal(prospectId: string): Promise<{ 
    allowed: boolean; 
    reason?: string; 
    missingSteps?: string[] 
  }> {
    const readiness = await this.checkReadiness(prospectId);
    
    if (readiness.completedSteps.includes('Holdings Imported')) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Prospect is not ready for proposal generation. Current status: ${this.getStatusLabel(readiness.currentStatus)}`,
      missingSteps: ['Import holdings (CAS statement or manual entry)']
    };
  }

  private async transitionStatus(
    prospectId: string, 
    fromStatus: ReadinessStatus, 
    toStatus: ReadinessStatus, 
    reason: string
  ): Promise<ReadinessStatus> {
    await db.update(prospectClients)
      .set({
        readinessStatus: toStatus,
        readinessStatusUpdatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(prospectClients.id, prospectId));

    const log: ReadinessTransitionLog = {
      fromStatus,
      toStatus,
      reason,
      timestamp: new Date()
    };

    const logs = this.transitionLogs.get(prospectId) || [];
    logs.push(log);
    this.transitionLogs.set(prospectId, logs);

    console.log(`[ProspectReadiness] ${prospectId}: ${fromStatus} -> ${toStatus} | ${reason}`);

    return toStatus;
  }

  getTransitionHistory(prospectId: string): ReadinessTransitionLog[] {
    return this.transitionLogs.get(prospectId) || [];
  }
}

export const prospectReadinessService = ProspectReadinessService.getInstance();
