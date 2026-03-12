import { db } from '../db';
import { proposalWhatIfScenarios, investmentProposals, InsertProposalWhatIfScenario } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { callPython } from '../clients/python-client';

export type WhatIfMode = 'static' | 'interactive';

export interface WhatIfAssumptions {
  returnDelta: number; // +10, -10, -20 percent
  volatility: number; // multiplier, 1.0 = normal
  inflationRate?: number;
}

export interface WhatIfProjection {
  scenarioName: string;
  projectedValue1Y: number;
  projectedValue3Y: number;
  projectedValue5Y: number;
  projectedValue10Y: number;
  maxDrawdown: number;
  probabilityOfLoss: number;
  valueAtRisk95: number;
}

export interface WhatIfResult {
  proposalId: string;
  mode: WhatIfMode;
  baseScenario: WhatIfProjection;
  scenarios: WhatIfProjection[];
  generatedAt: Date;
}

const STATIC_SCENARIOS: { name: string; returnDelta: number; volatilityMult: number }[] = [
  { name: 'base', returnDelta: 0, volatilityMult: 1.0 },
  { name: 'bull_10', returnDelta: 10, volatilityMult: 0.8 },
  { name: 'bear_10', returnDelta: -10, volatilityMult: 1.3 },
  { name: 'bear_20', returnDelta: -20, volatilityMult: 1.5 }
];

export class WhatIfSimulatorEngine {
  static async runSimulation(
    proposalId: string,
    mode: WhatIfMode,
    assumptions?: WhatIfAssumptions
  ): Promise<WhatIfResult> {
    const [proposal] = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, proposalId))
      .limit(1);

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const totalAmount = parseFloat(proposal.totalInvestmentAmount?.toString() || '100000');
    const baseReturn = parseFloat(proposal.expectedReturns?.toString() || '10');
    const riskProfile = proposal.riskProfile || 'moderate';

    let scenarios: WhatIfProjection[] = [];

    if (mode === 'static') {
      scenarios = await this.generateStaticScenarios(proposalId, totalAmount, baseReturn, riskProfile);
    } else {
      if (!assumptions) {
        throw new Error('Assumptions required for interactive mode');
      }
      const customScenario = await this.pythonProjection(
        'custom',
        totalAmount,
        baseReturn + assumptions.returnDelta,
        assumptions.volatility,
        riskProfile
      );
      scenarios = [customScenario];
      
      await this.saveScenario(proposalId, 'interactive', 'custom', assumptions, customScenario);
    }

    const baseScenario = scenarios.find(s => s.scenarioName === 'base') || scenarios[0];

    return {
      proposalId,
      mode,
      baseScenario,
      scenarios,
      generatedAt: new Date()
    };
  }

  private static async generateStaticScenarios(
    proposalId: string,
    totalAmount: number,
    baseReturn: number,
    riskProfile: string
  ): Promise<WhatIfProjection[]> {
    const scenarios: WhatIfProjection[] = [];

    for (const scenario of STATIC_SCENARIOS) {
      const adjustedReturn = baseReturn + scenario.returnDelta;
      const projection = await this.pythonProjection(
        scenario.name,
        totalAmount,
        adjustedReturn,
        scenario.volatilityMult,
        riskProfile
      );
      scenarios.push(projection);

      await this.saveScenario(
        proposalId,
        'static',
        scenario.name,
        { returnDelta: scenario.returnDelta, volatility: scenario.volatilityMult },
        projection
      );
    }

    return scenarios;
  }

  private static calculateProjection(
    scenarioName: string,
    totalAmount: number,
    annualReturn: number,
    volatilityMult: number,
    riskProfile: string
  ): WhatIfProjection {
    const returnRate = annualReturn / 100;
    const baseVolatility = riskProfile === 'aggressive' ? 0.25 : riskProfile === 'moderate' ? 0.18 : 0.12;
    const adjustedVolatility = baseVolatility * volatilityMult;

    const projectedValue1Y = totalAmount * Math.pow(1 + returnRate, 1);
    const projectedValue3Y = totalAmount * Math.pow(1 + returnRate, 3);
    const projectedValue5Y = totalAmount * Math.pow(1 + returnRate, 5);
    const projectedValue10Y = totalAmount * Math.pow(1 + returnRate, 10);

    const maxDrawdown = Math.min(adjustedVolatility * 2.5, 0.6) * 100;
    const probabilityOfLoss = Math.max(0, (0.5 - returnRate / adjustedVolatility * 0.1)) * 100;
    const valueAtRisk95 = totalAmount * (1 - adjustedVolatility * 1.645);

    return {
      scenarioName,
      projectedValue1Y: Math.round(projectedValue1Y),
      projectedValue3Y: Math.round(projectedValue3Y),
      projectedValue5Y: Math.round(projectedValue5Y),
      projectedValue10Y: Math.round(projectedValue10Y),
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      probabilityOfLoss: Math.max(0, Math.round(probabilityOfLoss * 100) / 100),
      valueAtRisk95: Math.round(valueAtRisk95)
    };
  }

  // ── Python SIP simulation (falls back to calculateProjection) ───────────
  private static async pythonProjection(
    scenarioName: string,
    totalAmount: number,
    annualReturn: number,
    volatilityMult: number,
    riskProfile: string
  ): Promise<WhatIfProjection> {
    try {
      const pyResult = await callPython<any>('/api/forecasting/sip-simulate', 'POST', {
        sipAmount: 0,
        horizonMonths: 120,
        expectedReturn: annualReturn,
        inflationRate: 6.0,
        existingCorpus: totalAmount,
        benchmarkReturn: annualReturn - 1.5,
      });

      if (pyResult?.summary && pyResult?.snapshots?.length) {
        const snapAt = (months: number): number => {
          const snap = pyResult.snapshots.find((s: any) => s.month >= months);
          return snap ? Math.round(snap.corpus) : 0;
        };
        const finalCorpus = Math.round(pyResult.summary.finalCorpus ?? totalAmount);
        const xirr = pyResult.summary.xirr ?? annualReturn / 100;
        const baseVol = riskProfile === 'aggressive' ? 0.25 : riskProfile === 'moderate' ? 0.18 : 0.12;
        const adjVol = baseVol * volatilityMult;
        return {
          scenarioName,
          projectedValue1Y:  snapAt(12)  || Math.round(totalAmount * Math.pow(1 + annualReturn / 100, 1)),
          projectedValue3Y:  snapAt(36)  || Math.round(totalAmount * Math.pow(1 + annualReturn / 100, 3)),
          projectedValue5Y:  snapAt(60)  || Math.round(totalAmount * Math.pow(1 + annualReturn / 100, 5)),
          projectedValue10Y: finalCorpus || Math.round(totalAmount * Math.pow(1 + annualReturn / 100, 10)),
          maxDrawdown:       Math.round(Math.min(adjVol * 2.5, 0.6) * 10000) / 100,
          probabilityOfLoss: Math.max(0, Math.round(((0.5 - xirr / adjVol * 0.1) * 100) * 100) / 100),
          valueAtRisk95:     Math.round(totalAmount * (1 - adjVol * 1.645)),
        };
      }
    } catch {
      // sidecar unavailable
    }
    return this.calculateProjection(scenarioName, totalAmount, annualReturn, volatilityMult, riskProfile);
  }
  // ─────────────────────────────────────────────────────────────────────────

  private static async saveScenario(
    proposalId: string,
    mode: WhatIfMode,
    scenarioName: string,
    assumptions: WhatIfAssumptions,
    projection: WhatIfProjection
  ): Promise<void> {
    const existing = await db
      .select()
      .from(proposalWhatIfScenarios)
      .where(
        and(
          eq(proposalWhatIfScenarios.proposalId, proposalId),
          eq(proposalWhatIfScenarios.scenarioName, scenarioName)
        )
      )
      .limit(1);

    const values = {
      proposalId,
      mode,
      scenarioName,
      returnDelta: String(assumptions.returnDelta),
      volatilityMultiplier: String(assumptions.volatility),
      projectedValue1Y: String(projection.projectedValue1Y),
      projectedValue3Y: String(projection.projectedValue3Y),
      projectedValue5Y: String(projection.projectedValue5Y),
      projectedValue10Y: String(projection.projectedValue10Y),
      maxDrawdown: String(projection.maxDrawdown),
      probabilityOfLoss: String(projection.probabilityOfLoss),
      valueAtRisk95: String(projection.valueAtRisk95),
      updatedAt: new Date()
    };

    if (existing.length > 0) {
      await db
        .update(proposalWhatIfScenarios)
        .set(values)
        .where(eq(proposalWhatIfScenarios.id, existing[0].id));
    } else {
      await db.insert(proposalWhatIfScenarios).values(values);
    }
  }

  static async getScenarios(proposalId: string): Promise<WhatIfProjection[]> {
    const scenarios = await db
      .select()
      .from(proposalWhatIfScenarios)
      .where(eq(proposalWhatIfScenarios.proposalId, proposalId));

    return scenarios.map(s => ({
      scenarioName: s.scenarioName,
      projectedValue1Y: parseFloat(s.projectedValue1Y?.toString() || '0'),
      projectedValue3Y: parseFloat(s.projectedValue3Y?.toString() || '0'),
      projectedValue5Y: parseFloat(s.projectedValue5Y?.toString() || '0'),
      projectedValue10Y: parseFloat(s.projectedValue10Y?.toString() || '0'),
      maxDrawdown: parseFloat(s.maxDrawdown?.toString() || '0'),
      probabilityOfLoss: parseFloat(s.probabilityOfLoss?.toString() || '0'),
      valueAtRisk95: parseFloat(s.valueAtRisk95?.toString() || '0')
    }));
  }

  static async toggleReportInclusion(
    proposalId: string,
    scenarioName: string,
    include: boolean
  ): Promise<void> {
    await db
      .update(proposalWhatIfScenarios)
      .set({ includeInReport: include, updatedAt: new Date() })
      .where(
        and(
          eq(proposalWhatIfScenarios.proposalId, proposalId),
          eq(proposalWhatIfScenarios.scenarioName, scenarioName)
        )
      );
  }

  static async getScenariosForReport(proposalId: string): Promise<WhatIfProjection[]> {
    const scenarios = await db
      .select()
      .from(proposalWhatIfScenarios)
      .where(
        and(
          eq(proposalWhatIfScenarios.proposalId, proposalId),
          eq(proposalWhatIfScenarios.includeInReport, true)
        )
      );

    return scenarios.map(s => ({
      scenarioName: s.scenarioName,
      projectedValue1Y: parseFloat(s.projectedValue1Y?.toString() || '0'),
      projectedValue3Y: parseFloat(s.projectedValue3Y?.toString() || '0'),
      projectedValue5Y: parseFloat(s.projectedValue5Y?.toString() || '0'),
      projectedValue10Y: parseFloat(s.projectedValue10Y?.toString() || '0'),
      maxDrawdown: parseFloat(s.maxDrawdown?.toString() || '0'),
      probabilityOfLoss: parseFloat(s.probabilityOfLoss?.toString() || '0'),
      valueAtRisk95: parseFloat(s.valueAtRisk95?.toString() || '0')
    }));
  }
}

console.log('✅ What-If Simulator Engine initialized');
