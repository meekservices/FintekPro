import type { DailyPickData } from './pick-of-the-day-service';
import type { RebalanceRecommendation } from './agent-prospect-wizard-service';

export type OrchestratedAction = 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' | 'REDUCE' | 'INCREASE';

export interface OrchestratedRecommendation {
  action: OrchestratedAction;
  productType: string;
  productName: string;
  currentValue?: number;
  suggestedValue?: number;
  changeAmount: number;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  taxImplications?: string;
  signalSource: 'rebalance_only' | 'potd_only' | 'orchestrated';
  reasoningCode: string;
  potdReference?: {
    instrumentName: string;
    recoPrice: number;
    targetPrice: number;
    confidenceScore?: number;
  };
  originalRebalanceAction?: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH';
}

export interface GovernanceRule {
  id: string;
  potdSignal: 'BUY' | 'NONE';
  rebalanceSignal: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' | 'NONE';
  resolvedAction: OrchestratedAction;
  priority: 'high' | 'medium' | 'low';
  description: string;
  enabled: boolean;
}

export interface SignalAuditEntry {
  timestamp: Date;
  instrumentName: string;
  isin?: string;
  potdSignal?: string;
  rebalanceSignal?: string;
  resolvedAction: OrchestratedAction;
  reasoningCode: string;
  governanceRuleId: string;
  confidenceScore?: number;
}

export interface ToleranceBandConfig {
  holdBandPct: number;
  reduceBandMinPct: number;
  reduceBandMaxPct: number;
  sellBandMinPct: number;
}

const DEFAULT_TOLERANCE_BANDS: ToleranceBandConfig = {
  holdBandPct: 5,
  reduceBandMinPct: 5,
  reduceBandMaxPct: 15,
  sellBandMinPct: 15,
};

const DEFAULT_GOVERNANCE_RULES: GovernanceRule[] = [
  {
    id: 'POTD_BUY_REBAL_SELL',
    potdSignal: 'BUY',
    rebalanceSignal: 'SELL',
    resolvedAction: 'REDUCE',
    priority: 'high',
    description: 'POTD BUY conflicts with Rebalance SELL — partial sell instead of full',
    enabled: true,
  },
  {
    id: 'POTD_BUY_REBAL_BUY',
    potdSignal: 'BUY',
    rebalanceSignal: 'BUY',
    resolvedAction: 'BUY',
    priority: 'high',
    description: 'POTD BUY reinforced by Rebalance BUY — higher priority buy',
    enabled: true,
  },
  {
    id: 'POTD_BUY_REBAL_HOLD',
    potdSignal: 'BUY',
    rebalanceSignal: 'HOLD',
    resolvedAction: 'BUY',
    priority: 'medium',
    description: 'POTD BUY takes precedence over Rebalance HOLD for new positions',
    enabled: true,
  },
  {
    id: 'POTD_BUY_REBAL_SWITCH',
    potdSignal: 'BUY',
    rebalanceSignal: 'SWITCH',
    resolvedAction: 'BUY',
    priority: 'medium',
    description: 'POTD BUY overrides Rebalance SWITCH — buy the POTD pick',
    enabled: true,
  },
  {
    id: 'NONE_REBAL_SELL',
    potdSignal: 'NONE',
    rebalanceSignal: 'SELL',
    resolvedAction: 'SELL',
    priority: 'medium',
    description: 'No POTD conflict — Rebalance SELL proceeds as-is',
    enabled: true,
  },
  {
    id: 'NONE_REBAL_BUY',
    potdSignal: 'NONE',
    rebalanceSignal: 'BUY',
    resolvedAction: 'BUY',
    priority: 'medium',
    description: 'No POTD conflict — Rebalance BUY proceeds as-is',
    enabled: true,
  },
  {
    id: 'NONE_REBAL_HOLD',
    potdSignal: 'NONE',
    rebalanceSignal: 'HOLD',
    resolvedAction: 'HOLD',
    priority: 'low',
    description: 'No POTD conflict — Rebalance HOLD proceeds as-is',
    enabled: true,
  },
  {
    id: 'NONE_REBAL_SWITCH',
    potdSignal: 'NONE',
    rebalanceSignal: 'SWITCH',
    resolvedAction: 'SWITCH',
    priority: 'medium',
    description: 'No POTD conflict — Rebalance SWITCH proceeds as-is',
    enabled: true,
  },
  {
    id: 'POTD_BUY_REBAL_NONE',
    potdSignal: 'BUY',
    rebalanceSignal: 'NONE',
    resolvedAction: 'BUY',
    priority: 'medium',
    description: 'POTD BUY with no Rebalance signal — fresh investment suggestion',
    enabled: true,
  },
];

class SignalOrchestrator {
  private governanceRules: GovernanceRule[];
  private toleranceBands: ToleranceBandConfig;
  private auditLog: SignalAuditEntry[] = [];

  constructor(
    rules?: GovernanceRule[],
    toleranceBands?: ToleranceBandConfig
  ) {
    this.governanceRules = rules
      ? rules.map(r => ({ ...r }))
      : DEFAULT_GOVERNANCE_RULES.map(r => ({ ...r }));
    this.toleranceBands = toleranceBands
      ? { ...toleranceBands }
      : { ...DEFAULT_TOLERANCE_BANDS };
  }

  resolveSignals(
    rebalanceRecs: RebalanceRecommendation[],
    potdPicks: DailyPickData[]
  ): OrchestratedRecommendation[] {
    const results: OrchestratedRecommendation[] = [];
    const matchedRebalanceIndices = new Set<number>();
    const matchedPotdIndices = new Set<number>();

    for (let ri = 0; ri < rebalanceRecs.length; ri++) {
      const rec = rebalanceRecs[ri];
      let matchedPotdIndex = -1;
      let matchedPick: DailyPickData | null = null;

      for (let pi = 0; pi < potdPicks.length; pi++) {
        if (matchedPotdIndices.has(pi)) continue;
        const pick = potdPicks[pi];
        if (this.matchSignals(rec, pick)) {
          matchedPotdIndex = pi;
          matchedPick = pick;
          break;
        }
      }

      if (matchedPick !== null && matchedPotdIndex >= 0) {
        matchedRebalanceIndices.add(ri);
        matchedPotdIndices.add(matchedPotdIndex);

        const rule = this.findRule('BUY', rec.action);
        const resolved = this.buildOrchestratedRecommendation(
          rec,
          matchedPick,
          rule,
          'orchestrated'
        );
        results.push(resolved);

        this.recordAudit(
          rec.productName,
          matchedPick.isin,
          'BUY',
          rec.action,
          resolved.action,
          resolved.reasoningCode,
          rule?.id || 'UNKNOWN',
          matchedPick.confidenceScore
        );
      } else {
        matchedRebalanceIndices.add(ri);

        const rule = this.findRule('NONE', rec.action);
        const resolved = this.buildRebalanceOnly(rec, rule);
        results.push(resolved);

        this.recordAudit(
          rec.productName,
          undefined,
          undefined,
          rec.action,
          resolved.action,
          resolved.reasoningCode,
          rule?.id || 'UNKNOWN',
          undefined
        );
      }
    }

    for (let pi = 0; pi < potdPicks.length; pi++) {
      if (matchedPotdIndices.has(pi)) continue;
      const pick = potdPicks[pi];

      const rule = this.findRule('BUY', 'NONE');
      const resolved = this.buildPotdOnly(pick, rule);
      results.push(resolved);

      this.recordAudit(
        pick.instrumentName,
        pick.isin,
        'BUY',
        undefined,
        resolved.action,
        resolved.reasoningCode,
        rule?.id || 'UNKNOWN',
        pick.confidenceScore
      );
    }

    return results;
  }

  getGovernanceMatrix(): GovernanceRule[] {
    return this.governanceRules.map(r => ({ ...r }));
  }

  updateGovernanceRule(ruleId: string, updates: Partial<GovernanceRule>): void {
    const idx = this.governanceRules.findIndex(r => r.id === ruleId);
    if (idx === -1) {
      throw new Error(`Governance rule not found: ${ruleId}`);
    }
    const existing = this.governanceRules[idx];
    this.governanceRules[idx] = {
      ...existing,
      ...updates,
      id: existing.id,
    };
  }

  getAuditLog(): SignalAuditEntry[] {
    return [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  getToleranceBands(): ToleranceBandConfig {
    return { ...this.toleranceBands };
  }

  updateToleranceBands(updates: Partial<ToleranceBandConfig>): void {
    this.toleranceBands = { ...this.toleranceBands, ...updates };
  }

  classifyDrift(driftPct: number): OrchestratedAction {
    const absDrift = Math.abs(driftPct);
    if (absDrift <= this.toleranceBands.holdBandPct) {
      return 'HOLD';
    }
    if (driftPct > 0) {
      if (absDrift <= this.toleranceBands.reduceBandMaxPct) {
        return 'REDUCE';
      }
      return 'SELL';
    }
    if (absDrift <= this.toleranceBands.reduceBandMaxPct) {
      return 'INCREASE';
    }
    return 'BUY';
  }

  private matchSignals(
    rec: RebalanceRecommendation,
    pick: DailyPickData
  ): boolean {
    if (pick.isin && pick.isin.length > 0) {
      const recNameLower = rec.productName.toLowerCase().trim();
      if (recNameLower.includes(pick.isin.toLowerCase())) {
        return true;
      }
    }

    const recName = rec.productName.toLowerCase().trim();
    const pickName = pick.instrumentName.toLowerCase().trim();
    if (recName === pickName) {
      return true;
    }
    if (recName.length > 3 && pickName.length > 3) {
      if (recName.includes(pickName) || pickName.includes(recName)) {
        return true;
      }
    }

    const pickCategory = this.mapPickCategoryToProductType(pick.category);
    if (pickCategory && rec.productType.toLowerCase().trim() === pickCategory) {
      const recWords = new Set(recName.split(/\s+/));
      const pickWords = new Set(pickName.split(/\s+/));
      let overlap = 0;
      for (const w of pickWords) {
        if (w.length > 2 && recWords.has(w)) overlap++;
      }
      if (overlap >= 2) {
        return true;
      }
    }

    return false;
  }

  private mapPickCategoryToProductType(category: string): string | null {
    const mapping: Record<string, string> = {
      listed_stocks: 'equity',
      mutual_funds: 'mutual_fund',
      bonds: 'bond',
      unlisted: 'equity',
      global_stocks: 'equity',
      etfs: 'etf',
      reits_invits: 'other',
      fixed_deposits: 'fd',
      sgb: 'gold',
      derivatives: 'equity',
    };
    return mapping[category] || null;
  }

  private findRule(
    potdSignal: 'BUY' | 'NONE',
    rebalanceSignal: 'BUY' | 'SELL' | 'HOLD' | 'SWITCH' | 'NONE'
  ): GovernanceRule | null {
    return (
      this.governanceRules.find(
        r =>
          r.enabled &&
          r.potdSignal === potdSignal &&
          r.rebalanceSignal === rebalanceSignal
      ) || null
    );
  }

  private buildOrchestratedRecommendation(
    rec: RebalanceRecommendation,
    pick: DailyPickData,
    rule: GovernanceRule | null,
    source: 'orchestrated'
  ): OrchestratedRecommendation {
    const resolvedAction = rule?.resolvedAction || rec.action as OrchestratedAction;
    const priority = rule?.priority || rec.priority;
    const reasoningCode = `POTD_BUY_REBAL_${rec.action}_${resolvedAction}`;

    let changeAmount = rec.changeAmount;
    if (resolvedAction === 'REDUCE' && rec.action === 'SELL') {
      changeAmount = Math.round(rec.changeAmount * 0.5);
    }

    const rationale = this.buildRationale(resolvedAction, rec, pick, rule);

    return {
      action: resolvedAction,
      productType: rec.productType,
      productName: rec.productName,
      currentValue: rec.currentValue,
      suggestedValue: rec.suggestedValue,
      changeAmount,
      rationale,
      priority,
      taxImplications: rec.taxImplications,
      signalSource: source,
      reasoningCode,
      potdReference: {
        instrumentName: pick.instrumentName,
        recoPrice: pick.recoPrice,
        targetPrice: pick.targetPrice,
        confidenceScore: pick.confidenceScore,
      },
      originalRebalanceAction: rec.action,
    };
  }

  private buildRebalanceOnly(
    rec: RebalanceRecommendation,
    rule: GovernanceRule | null
  ): OrchestratedRecommendation {
    const resolvedAction = rule?.resolvedAction || rec.action as OrchestratedAction;
    const reasoningCode = `REBAL_${rec.action}_${resolvedAction}`;

    return {
      action: resolvedAction,
      productType: rec.productType,
      productName: rec.productName,
      currentValue: rec.currentValue,
      suggestedValue: rec.suggestedValue,
      changeAmount: rec.changeAmount,
      rationale: rec.rationale,
      priority: rule?.priority || rec.priority,
      taxImplications: rec.taxImplications,
      signalSource: 'rebalance_only',
      reasoningCode,
      originalRebalanceAction: rec.action,
    };
  }

  private buildPotdOnly(
    pick: DailyPickData,
    rule: GovernanceRule | null
  ): OrchestratedRecommendation {
    const resolvedAction = rule?.resolvedAction || 'BUY';
    const reasoningCode = 'POTD_BUY_FRESH';
    const changeAmount = pick.recoPrice;

    return {
      action: resolvedAction,
      productType: pick.category,
      productName: pick.instrumentName,
      currentValue: 0,
      suggestedValue: pick.recoPrice,
      changeAmount,
      rationale: `POTD recommendation: ${pick.rationale}`,
      priority: rule?.priority || 'medium',
      signalSource: 'potd_only',
      reasoningCode,
      potdReference: {
        instrumentName: pick.instrumentName,
        recoPrice: pick.recoPrice,
        targetPrice: pick.targetPrice,
        confidenceScore: pick.confidenceScore,
      },
    };
  }

  private buildRationale(
    resolvedAction: OrchestratedAction,
    rec: RebalanceRecommendation,
    pick: DailyPickData,
    rule: GovernanceRule | null
  ): string {
    if (resolvedAction === 'REDUCE') {
      return `Signal conflict: POTD recommends BUY for ${pick.instrumentName} (target ₹${pick.targetPrice}) but rebalancing suggests SELL. Resolved to REDUCE — partial sell to manage overweight while preserving POTD upside potential.`;
    }
    if (resolvedAction === 'BUY' && rec.action === 'BUY') {
      return `Reinforced BUY: Both POTD and rebalancing agree on buying ${rec.productName}. POTD target ₹${pick.targetPrice} with ${pick.confidenceScore || 'N/A'}% confidence.`;
    }
    if (resolvedAction === 'BUY' && rec.action === 'HOLD') {
      return `POTD BUY overrides HOLD for ${rec.productName}. POTD target ₹${pick.targetPrice}, reco price ₹${pick.recoPrice}.`;
    }
    return rule?.description || rec.rationale;
  }

  private recordAudit(
    instrumentName: string,
    isin: string | undefined,
    potdSignal: string | undefined,
    rebalanceSignal: string | undefined,
    resolvedAction: OrchestratedAction,
    reasoningCode: string,
    governanceRuleId: string,
    confidenceScore: number | undefined
  ): void {
    this.auditLog.push({
      timestamp: new Date(),
      instrumentName,
      isin,
      potdSignal,
      rebalanceSignal,
      resolvedAction,
      reasoningCode,
      governanceRuleId,
      confidenceScore,
    });
  }
}

export const signalOrchestrator = new SignalOrchestrator();
