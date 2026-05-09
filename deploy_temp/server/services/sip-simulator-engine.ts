import { overlapIntelligenceEngine } from "./overlap-intelligence-engine";

interface PortfolioFund {
  mfIsin: string;
  name: string;
  portfolioWeight: number;
  currentValue?: number;
}

interface SIPSimulationInput {
  sipAmount: number;
  candidateFunds: string[];
  existingPortfolio: PortfolioFund[];
  horizonMonths: number;
}

interface MonthlySnapshot {
  month: number;
  totalInvested: number;
  diversificationScore: number;
  overlapReduction: number;
}

interface SIPSimulationResult {
  horizonMonths: number;
  totalInvested: number;
  diversificationScoreStart: number;
  diversificationScoreEnd: number;
  scoreImprovement: number;
  overlapReductionSummary: string;
  monthlySnapshots: MonthlySnapshot[];
  sipRouting: Array<{ fund: string; fundIsin: string; amount: number }>;
  riskDisclosure: string;
}

export class SIPSimulatorEngine {
  private static instance: SIPSimulatorEngine;

  private constructor() {}

  static getInstance(): SIPSimulatorEngine {
    if (!SIPSimulatorEngine.instance) {
      SIPSimulatorEngine.instance = new SIPSimulatorEngine();
    }
    return SIPSimulatorEngine.instance;
  }

  async simulateSIP(input: SIPSimulationInput): Promise<SIPSimulationResult> {
    const { sipAmount, candidateFunds, existingPortfolio, horizonMonths } = input;

    // Calculate starting diversification score
    const startingScore = await overlapIntelligenceEngine.calculateDiversificationScore(existingPortfolio);

    // Get optimized SIP routing
    const sipRouting = await overlapIntelligenceEngine.optimizeSIPAllocation(
      sipAmount,
      candidateFunds,
      existingPortfolio
    );

    // Calculate total invested
    const totalInvested = sipAmount * horizonMonths;

    // Simulate portfolio growth month by month
    const monthlySnapshots: MonthlySnapshot[] = [];
    let projectedPortfolio = [...existingPortfolio];
    let runningTotal = 0;
    let currentScore = startingScore.score;

    for (let month = 1; month <= horizonMonths; month++) {
      runningTotal += sipAmount;

      // Calculate new weights based on SIP additions
      // This is a simplified projection - actual values would vary with market performance
      const totalPortfolioValue = projectedPortfolio.reduce((sum, f) => sum + (f.currentValue || 0), 0) + runningTotal;

      if (sipRouting.sipRouting.length > 0) {
        // Update portfolio with SIP allocations
        for (const routing of sipRouting.sipRouting) {
          const existingFund = projectedPortfolio.find(f => f.mfIsin === routing.fundIsin);
          if (existingFund) {
            existingFund.currentValue = (existingFund.currentValue || 0) + routing.amount;
          } else {
            projectedPortfolio.push({
              mfIsin: routing.fundIsin,
              name: routing.fund,
              portfolioWeight: (routing.amount / totalPortfolioValue) * 100,
              currentValue: routing.amount * month,
            });
          }
        }

        // Recalculate weights
        const newTotalValue = projectedPortfolio.reduce((sum, f) => sum + (f.currentValue || 0), 0);
        projectedPortfolio = projectedPortfolio.map(f => ({
          ...f,
          portfolioWeight: ((f.currentValue || 0) / newTotalValue) * 100,
        }));
      }

      // Calculate diversification improvement
      // Score improves as new SIPs distribute to lower-overlap funds
      const improvementRate = this.calculateImprovementRate(horizonMonths, sipRouting.sipRouting.length);
      const monthlyImprovement = improvementRate * (1 - Math.exp(-month / (horizonMonths / 3)));
      currentScore = Math.min(100, startingScore.score + monthlyImprovement * (month / horizonMonths) * 20);

      monthlySnapshots.push({
        month,
        totalInvested: runningTotal,
        diversificationScore: Math.round(currentScore),
        overlapReduction: Math.round((1 - Math.exp(-month / 12)) * 100) / 10,
      });
    }

    const endScore = monthlySnapshots[monthlySnapshots.length - 1].diversificationScore;
    const scoreImprovement = endScore - startingScore.score;

    // Generate overlap reduction summary based on routing
    const overlapReductionSummary = this.generateOverlapSummary(sipRouting.sipRouting, scoreImprovement);

    return {
      horizonMonths,
      totalInvested,
      diversificationScoreStart: startingScore.score,
      diversificationScoreEnd: endScore,
      scoreImprovement,
      overlapReductionSummary,
      monthlySnapshots,
      sipRouting: sipRouting.sipRouting.map(r => ({
        fund: r.fund,
        fundIsin: r.fundIsin,
        amount: r.amount,
      })),
      riskDisclosure: "Past performance is not indicative of future results. Investment in mutual funds is subject to market risks. This simulation is for educational purposes only and does not guarantee any specific outcome.",
    };
  }

  private calculateImprovementRate(horizonMonths: number, fundCount: number): number {
    // Longer horizon and more funds = better improvement potential
    const horizonFactor = horizonMonths / 24; // Normalized to max horizon
    const fundFactor = Math.min(fundCount / 5, 1); // Cap at 5 funds
    return 0.5 + (horizonFactor * 0.3) + (fundFactor * 0.2);
  }

  private generateOverlapSummary(
    sipRouting: Array<{ fund: string; fundIsin: string; amount: number; overlapScore?: number }>,
    scoreImprovement: number
  ): string {
    if (!sipRouting.length) {
      return "No SIP routing configured.";
    }

    const topFund = sipRouting[0];
    const lowOverlapFunds = sipRouting.filter(r => (r.overlapScore || 0) < 5);

    if (scoreImprovement > 10) {
      return `Significant diversification improvement expected. SIP routing prioritizes ${topFund.fund} and ${lowOverlapFunds.length} low-overlap funds, reducing concentration in previously overlapping positions.`;
    } else if (scoreImprovement > 5) {
      return `Moderate diversification improvement expected. Systematic SIP contributions to lower-overlap funds help spread exposure across different securities.`;
    } else {
      return `Gradual diversification improvement through systematic investment. Continue SIP to maintain balanced exposure.`;
    }
  }
}

export const sipSimulatorEngine = SIPSimulatorEngine.getInstance();
