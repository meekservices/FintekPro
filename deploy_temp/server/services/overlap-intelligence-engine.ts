import { db } from "../db";
import { mfSchemeStockHoldings, mutualFunds } from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

interface PortfolioFund {
  mfIsin: string;
  name: string;
  portfolioWeight: number;
  currentValue?: number;
  category?: string;
  expenseRatio?: number;
  sharpeRatio?: number;
}

interface StockExposure {
  stock: string;
  stockIsin?: string;
  sector: string;
  totalExposure: number;
  fundCount: number;
  funds: Array<{
    isin: string;
    name: string;
    contribution: number;
  }>;
}

interface SectorExposure {
  sector: string;
  exposure: number;
  stockCount: number;
}

interface DiversificationPenalty {
  type: "STOCK_OVERLAP" | "SECTOR_CONCENTRATION" | "FUND_CROWDING";
  entity: string;
  exposure?: number;
  fundCount?: number;
  impact: number;
  description: string;
}

interface DiversificationScore {
  score: number;
  grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  penalties: DiversificationPenalty[];
  stockExposures: StockExposure[];
  sectorExposures: SectorExposure[];
}

interface ReplaceFundSuggestion {
  fundToReplace: string;
  fundIsin: string;
  reason: string;
  overlapWith: string;
  overlapPercentage: number;
  metricsComparison: string;
  suggestedAction: "SWITCH" | "REDUCE" | "REVIEW";
  alternatives: AlternativeFund[];
}

interface AlternativeFund {
  isin: string;
  name: string;
  category: string;
  overlapReduction: number;
  diversificationGain: number;
  expenseRatio?: number;
  sharpeRatio?: number;
}

interface DiversificationImpact {
  currentScore: number;
  projectedScore: number;
  netImprovement: number;
  changesApplied: string[];
}

interface AdvisorTalkingPoint {
  type: "OVERLAP_RISK" | "REPLACE_FUND" | "DIVERSIFICATION" | "SECTOR_CONCENTRATION";
  priority: "HIGH" | "MEDIUM" | "LOW";
  text: string;
  data?: Record<string, any>;
}

interface OverlapIntelligenceResult {
  diversificationScore: DiversificationScore;
  replaceFundSuggestions: ReplaceFundSuggestion[];
  advisorTalkingPoints: AdvisorTalkingPoint[];
  overlapSafeRecommendations?: any[];
}

export class OverlapIntelligenceEngine {
  private static instance: OverlapIntelligenceEngine;
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  static getInstance(): OverlapIntelligenceEngine {
    if (!OverlapIntelligenceEngine.instance) {
      OverlapIntelligenceEngine.instance = new OverlapIntelligenceEngine();
    }
    return OverlapIntelligenceEngine.instance;
  }

  /**
   * BE-10: Diversification Scoring Engine
   * Calculates a numeric diversification score with penalties for overlap
   */
  async calculateDiversificationScore(funds: PortfolioFund[]): Promise<DiversificationScore> {
    if (!funds.length) {
      return {
        score: 100,
        grade: "EXCELLENT",
        penalties: [],
        stockExposures: [],
        sectorExposures: [],
      };
    }

    // Get holdings for all funds
    const fundIsins = funds.map(f => f.mfIsin).filter(Boolean);
    if (!fundIsins.length) {
      return {
        score: 100,
        grade: "EXCELLENT",
        penalties: [],
        stockExposures: [],
        sectorExposures: [],
      };
    }

    const holdings = await db
      .select()
      .from(mfSchemeStockHoldings)
      .where(inArray(mfSchemeStockHoldings.mfIsin, fundIsins));

    // Calculate stock exposures with look-through analysis
    const stockExposures = this.calculateStockExposures(holdings, funds);
    const sectorExposures = this.calculateSectorExposures(stockExposures);

    // Calculate penalties
    const penalties: DiversificationPenalty[] = [];
    let baseScore = 100;

    // Penalty: Stock overlap >10%
    for (const stock of stockExposures) {
      if (stock.totalExposure > 10) {
        const penalty = -15;
        penalties.push({
          type: "STOCK_OVERLAP",
          entity: stock.stock,
          exposure: stock.totalExposure,
          impact: penalty,
          description: `${stock.stock} has ${stock.totalExposure.toFixed(1)}% exposure (>10% threshold)`,
        });
        baseScore += penalty;
      } else if (stock.totalExposure >= 5 && stock.totalExposure <= 10) {
        const penalty = -8;
        penalties.push({
          type: "STOCK_OVERLAP",
          entity: stock.stock,
          exposure: stock.totalExposure,
          impact: penalty,
          description: `${stock.stock} has ${stock.totalExposure.toFixed(1)}% exposure (5-10% range)`,
        });
        baseScore += penalty;
      }
    }

    // Penalty: Sector exposure >30%
    for (const sector of sectorExposures) {
      if (sector.exposure > 30) {
        const penalty = -10;
        penalties.push({
          type: "SECTOR_CONCENTRATION",
          entity: sector.sector,
          exposure: sector.exposure,
          impact: penalty,
          description: `${sector.sector} sector has ${sector.exposure.toFixed(1)}% concentration (>30% threshold)`,
        });
        baseScore += penalty;
      }
    }

    // Penalty: >3 funds holding same stock
    for (const stock of stockExposures) {
      if (stock.fundCount > 3) {
        const extraFunds = stock.fundCount - 3;
        const penalty = -5 * extraFunds;
        penalties.push({
          type: "FUND_CROWDING",
          entity: stock.stock,
          fundCount: stock.fundCount,
          impact: penalty,
          description: `${stock.stock} is held by ${stock.fundCount} funds (crowding penalty)`,
        });
        baseScore += penalty;
      }
    }

    // Clamp score to 0-100
    const finalScore = Math.max(0, Math.min(100, baseScore));

    // Determine grade
    let grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    if (finalScore >= 75) grade = "EXCELLENT";
    else if (finalScore >= 60) grade = "GOOD";
    else if (finalScore >= 40) grade = "FAIR";
    else grade = "POOR";

    return {
      score: finalScore,
      grade,
      penalties,
      stockExposures,
      sectorExposures,
    };
  }

  private calculateStockExposures(
    holdings: any[],
    funds: PortfolioFund[]
  ): StockExposure[] {
    const fundWeightMap = new Map(funds.map(f => [f.mfIsin, f.portfolioWeight]));
    const fundNameMap = new Map(funds.map(f => [f.mfIsin, f.name]));
    const stockMap = new Map<string, StockExposure>();

    for (const holding of holdings) {
      const fundWeight = fundWeightMap.get(holding.mfIsin) || 0;
      const holdingPct = parseFloat(holding.holdingPercentage) || 0;
      const contribution = (fundWeight * holdingPct) / 100;

      if (!stockMap.has(holding.stockSymbol)) {
        stockMap.set(holding.stockSymbol, {
          stock: holding.stockSymbol,
          stockIsin: holding.stockIsin,
          sector: holding.sector || "Unknown",
          totalExposure: 0,
          fundCount: 0,
          funds: [],
        });
      }

      const stockData = stockMap.get(holding.stockSymbol)!;
      stockData.totalExposure += contribution;
      stockData.fundCount++;
      stockData.funds.push({
        isin: holding.mfIsin,
        name: fundNameMap.get(holding.mfIsin) || "Unknown Fund",
        contribution,
      });
    }

    return Array.from(stockMap.values())
      .filter(s => s.fundCount >= 2) // Only overlapping stocks
      .sort((a, b) => b.totalExposure - a.totalExposure);
  }

  private calculateSectorExposures(stockExposures: StockExposure[]): SectorExposure[] {
    const sectorMap = new Map<string, SectorExposure>();

    for (const stock of stockExposures) {
      if (!sectorMap.has(stock.sector)) {
        sectorMap.set(stock.sector, {
          sector: stock.sector,
          exposure: 0,
          stockCount: 0,
        });
      }
      const sectorData = sectorMap.get(stock.sector)!;
      sectorData.exposure += stock.totalExposure;
      sectorData.stockCount++;
    }

    return Array.from(sectorMap.values())
      .sort((a, b) => b.exposure - a.exposure);
  }

  /**
   * BE-11: Overlap-Aware Fund Suitability Filter
   * Calculates overlap risk score for candidate funds
   */
  async calculateOverlapRiskScore(
    candidateFundIsin: string,
    existingPortfolio: PortfolioFund[]
  ): Promise<{ score: number; action: "EXCLUDE" | "RANK_LOWER" | "ALLOWED"; details: string }> {
    if (!existingPortfolio.length) {
      return { score: 0, action: "ALLOWED", details: "Empty portfolio - no overlap risk" };
    }

    // Get candidate fund holdings
    const candidateHoldings = await db
      .select()
      .from(mfSchemeStockHoldings)
      .where(eq(mfSchemeStockHoldings.mfIsin, candidateFundIsin));

    if (!candidateHoldings.length) {
      return { score: 0, action: "ALLOWED", details: "No holdings data for candidate fund" };
    }

    // Get existing portfolio holdings
    const existingIsins = existingPortfolio.map(f => f.mfIsin).filter(Boolean);
    const existingHoldings = await db
      .select()
      .from(mfSchemeStockHoldings)
      .where(inArray(mfSchemeStockHoldings.mfIsin, existingIsins));

    // Calculate existing stock exposures
    const existingExposures = new Map<string, number>();
    for (const holding of existingHoldings) {
      const fund = existingPortfolio.find(f => f.mfIsin === holding.mfIsin);
      if (!fund) continue;
      const contribution = (fund.portfolioWeight * parseFloat(holding.holdingPercentage)) / 100;
      existingExposures.set(
        holding.stockSymbol,
        (existingExposures.get(holding.stockSymbol) || 0) + contribution
      );
    }

    // Calculate overlap risk score
    let overlapRiskScore = 0;
    for (const candidateHolding of candidateHoldings) {
      const candidateWeight = parseFloat(candidateHolding.holdingPercentage) || 0;
      const existingExposure = existingExposures.get(candidateHolding.stockSymbol) || 0;
      overlapRiskScore += (candidateWeight / 100) * existingExposure;
    }

    // Determine action based on threshold
    let action: "EXCLUDE" | "RANK_LOWER" | "ALLOWED";
    let details: string;

    if (overlapRiskScore > 8) {
      action = "EXCLUDE";
      details = `High overlap risk (${overlapRiskScore.toFixed(1)}%) - would increase concentration`;
    } else if (overlapRiskScore >= 4) {
      action = "RANK_LOWER";
      details = `Moderate overlap risk (${overlapRiskScore.toFixed(1)}%) - consider alternatives`;
    } else {
      action = "ALLOWED";
      details = `Low overlap risk (${overlapRiskScore.toFixed(1)}%) - safe to add`;
    }

    return { score: overlapRiskScore, action, details };
  }

  /**
   * BE-12: Replace Fund Detection Engine
   * Identifies redundant funds due to high overlap
   */
  async detectReplacementCandidates(funds: PortfolioFund[]): Promise<ReplaceFundSuggestion[]> {
    if (funds.length < 2) return [];

    const suggestions: ReplaceFundSuggestion[] = [];
    const fundIsins = funds.map(f => f.mfIsin).filter(Boolean);

    // Get all holdings
    const allHoldings = await db
      .select()
      .from(mfSchemeStockHoldings)
      .where(inArray(mfSchemeStockHoldings.mfIsin, fundIsins));

    // Group holdings by fund
    const holdingsByFund = new Map<string, Set<string>>();
    for (const holding of allHoldings) {
      if (!holdingsByFund.has(holding.mfIsin)) {
        holdingsByFund.set(holding.mfIsin, new Set());
      }
      holdingsByFund.get(holding.mfIsin)!.add(holding.stockSymbol);
    }

    // Compare each pair of funds
    for (let i = 0; i < funds.length; i++) {
      for (let j = i + 1; j < funds.length; j++) {
        const fundA = funds[i];
        const fundB = funds[j];

        const holdingsA = holdingsByFund.get(fundA.mfIsin) || new Set();
        const holdingsB = holdingsByFund.get(fundB.mfIsin) || new Set();

        if (holdingsA.size === 0 || holdingsB.size === 0) continue;

        // Calculate overlap
        const intersection = new Set([...holdingsA].filter(x => holdingsB.has(x)));
        const overlapPctA = (intersection.size / holdingsA.size) * 100;
        const overlapPctB = (intersection.size / holdingsB.size) * 100;
        const maxOverlap = Math.max(overlapPctA, overlapPctB);

        // If overlap >= 40%, suggest replacement
        if (maxOverlap >= 40) {
          // Determine which fund to replace based on metrics
          const fundToReplace = this.determineFundToReplace(fundA, fundB);
          const keepFund = fundToReplace === fundA ? fundB : fundA;

          suggestions.push({
            fundToReplace: fundToReplace.name,
            fundIsin: fundToReplace.mfIsin,
            reason: `High overlap with ${keepFund.name} (${maxOverlap.toFixed(0)}%)`,
            overlapWith: keepFund.name,
            overlapPercentage: maxOverlap,
            metricsComparison: this.generateMetricsComparison(fundToReplace, keepFund),
            suggestedAction: "SWITCH",
            alternatives: [], // Will be filled by BE-13
          });
        }
      }
    }

    return suggestions;
  }

  private determineFundToReplace(fundA: PortfolioFund, fundB: PortfolioFund): PortfolioFund {
    // Prefer replacing fund with lower Sharpe ratio
    if (fundA.sharpeRatio && fundB.sharpeRatio) {
      return fundA.sharpeRatio < fundB.sharpeRatio ? fundA : fundB;
    }
    // Or higher expense ratio
    if (fundA.expenseRatio && fundB.expenseRatio) {
      return fundA.expenseRatio > fundB.expenseRatio ? fundA : fundB;
    }
    // Or lower portfolio weight (smaller position)
    return fundA.portfolioWeight < fundB.portfolioWeight ? fundA : fundB;
  }

  private generateMetricsComparison(replace: PortfolioFund, keep: PortfolioFund): string {
    const parts: string[] = [];
    if (replace.expenseRatio && keep.expenseRatio) {
      parts.push(`TER: ${replace.expenseRatio}% vs ${keep.expenseRatio}%`);
    }
    if (replace.sharpeRatio && keep.sharpeRatio) {
      parts.push(`Sharpe: ${replace.sharpeRatio.toFixed(2)} vs ${keep.sharpeRatio.toFixed(2)}`);
    }
    return parts.join(", ") || "Lower portfolio weight";
  }

  /**
   * BE-13: Alternative Fund Selector
   * Suggests lower-overlap alternatives for replaceable funds
   */
  async findAlternatives(
    fundToReplace: PortfolioFund,
    existingPortfolio: PortfolioFund[],
    limit: number = 3
  ): Promise<AlternativeFund[]> {
    // Get candidate funds in the same category
    const [fundDetails] = await db
      .select()
      .from(mutualFunds)
      .where(eq(mutualFunds.isin, fundToReplace.mfIsin))
      .limit(1);

    if (!fundDetails) return [];

    const category = fundDetails.category || fundDetails.subCategory;
    if (!category) return [];

    // Get funds in same category
    const candidates = await db
      .select()
      .from(mutualFunds)
      .where(eq(mutualFunds.category, category))
      .limit(20);

    const alternatives: AlternativeFund[] = [];
    const portfolioWithoutTarget = existingPortfolio.filter(
      f => f.mfIsin !== fundToReplace.mfIsin
    );

    for (const candidate of candidates) {
      if (candidate.isin === fundToReplace.mfIsin) continue;
      if (existingPortfolio.some(f => f.mfIsin === candidate.isin)) continue;

      const overlapCheck = await this.calculateOverlapRiskScore(
        candidate.isin,
        portfolioWithoutTarget
      );

      if (overlapCheck.action === "ALLOWED") {
        // Calculate diversification gain
        const currentScore = await this.calculateDiversificationScore(existingPortfolio);
        const newPortfolio = [
          ...portfolioWithoutTarget,
          { ...fundToReplace, mfIsin: candidate.isin, name: candidate.schemeName || "" },
        ];
        const projectedScore = await this.calculateDiversificationScore(newPortfolio);

        alternatives.push({
          isin: candidate.isin,
          name: candidate.schemeName || "Unknown",
          category: category,
          overlapReduction: Math.max(0, 100 - overlapCheck.score * 10),
          diversificationGain: projectedScore.score - currentScore.score,
          expenseRatio: candidate.expenseRatio ? parseFloat(candidate.expenseRatio) : undefined,
        });
      }

      if (alternatives.length >= limit) break;
    }

    return alternatives.sort((a, b) => b.diversificationGain - a.diversificationGain);
  }

  /**
   * BE-14: Diversification Impact Simulator
   * Simulates before vs after diversification score
   */
  async simulateDiversificationImpact(
    currentPortfolio: PortfolioFund[],
    changes: {
      action: "ADD" | "REMOVE" | "REPLACE";
      fundIsin: string;
      replacementIsin?: string;
      newWeight?: number;
    }[]
  ): Promise<DiversificationImpact> {
    const currentScore = await this.calculateDiversificationScore(currentPortfolio);
    let newPortfolio = [...currentPortfolio];
    const changesApplied: string[] = [];

    for (const change of changes) {
      switch (change.action) {
        case "ADD":
          const addFund = await db
            .select()
            .from(mutualFunds)
            .where(eq(mutualFunds.isin, change.fundIsin))
            .limit(1);
          if (addFund.length) {
            newPortfolio.push({
              mfIsin: change.fundIsin,
              name: addFund[0].schemeName || "New Fund",
              portfolioWeight: change.newWeight || 10,
            });
            changesApplied.push(`Added ${addFund[0].schemeName}`);
          }
          break;

        case "REMOVE":
          const removedFund = newPortfolio.find(f => f.mfIsin === change.fundIsin);
          newPortfolio = newPortfolio.filter(f => f.mfIsin !== change.fundIsin);
          if (removedFund) {
            changesApplied.push(`Removed ${removedFund.name}`);
          }
          break;

        case "REPLACE":
          if (change.replacementIsin) {
            const idx = newPortfolio.findIndex(f => f.mfIsin === change.fundIsin);
            if (idx >= 0) {
              const replacementFund = await db
                .select()
                .from(mutualFunds)
                .where(eq(mutualFunds.isin, change.replacementIsin))
                .limit(1);
              if (replacementFund.length) {
                const oldName = newPortfolio[idx].name;
                newPortfolio[idx] = {
                  ...newPortfolio[idx],
                  mfIsin: change.replacementIsin,
                  name: replacementFund[0].schemeName || "Replacement Fund",
                };
                changesApplied.push(`Replaced ${oldName} with ${replacementFund[0].schemeName}`);
              }
            }
          }
          break;
      }
    }

    // Normalize weights
    const totalWeight = newPortfolio.reduce((sum, f) => sum + f.portfolioWeight, 0);
    if (totalWeight > 0 && totalWeight !== 100) {
      newPortfolio = newPortfolio.map(f => ({
        ...f,
        portfolioWeight: (f.portfolioWeight / totalWeight) * 100,
      }));
    }

    const projectedScore = await this.calculateDiversificationScore(newPortfolio);

    return {
      currentScore: currentScore.score,
      projectedScore: projectedScore.score,
      netImprovement: projectedScore.score - currentScore.score,
      changesApplied,
    };
  }

  /**
   * BE-15: Advisor Talking Points Generator
   * Generates deterministic, regulator-safe explanations
   */
  generateAdvisorTalkingPoints(
    diversificationScore: DiversificationScore,
    replaceSuggestions: ReplaceFundSuggestion[],
    impactSimulation?: DiversificationImpact
  ): AdvisorTalkingPoint[] {
    const talkingPoints: AdvisorTalkingPoint[] = [];

    // Stock overlap talking points
    const highOverlapStocks = diversificationScore.stockExposures.filter(
      s => s.totalExposure > 10
    );
    for (const stock of highOverlapStocks.slice(0, 3)) {
      talkingPoints.push({
        type: "OVERLAP_RISK",
        priority: "HIGH",
        text: `Your portfolio has a concentrated exposure to ${stock.stock} across ${stock.fundCount} funds, resulting in ${stock.totalExposure.toFixed(1)}% overall exposure. This increases single-stock risk.`,
        data: { stock: stock.stock, exposure: stock.totalExposure, fundCount: stock.fundCount },
      });
    }

    // Sector concentration talking points
    const highSectorExposure = diversificationScore.sectorExposures.filter(
      s => s.exposure > 30
    );
    for (const sector of highSectorExposure) {
      talkingPoints.push({
        type: "SECTOR_CONCENTRATION",
        priority: "MEDIUM",
        text: `The ${sector.sector} sector represents ${sector.exposure.toFixed(1)}% of your portfolio through overlapping holdings. Consider diversifying into other sectors.`,
        data: { sector: sector.sector, exposure: sector.exposure },
      });
    }

    // Replace fund talking points
    for (const suggestion of replaceSuggestions.slice(0, 2)) {
      talkingPoints.push({
        type: "REPLACE_FUND",
        priority: "HIGH",
        text: `${suggestion.fundToReplace} significantly overlaps with ${suggestion.overlapWith} (${suggestion.overlapPercentage.toFixed(0)}% common holdings). Replacing it could improve diversification without changing your investment strategy.`,
        data: {
          fund: suggestion.fundToReplace,
          overlapWith: suggestion.overlapWith,
          overlap: suggestion.overlapPercentage,
        },
      });
    }

    // Diversification improvement talking point
    if (impactSimulation && impactSimulation.netImprovement > 0) {
      talkingPoints.push({
        type: "DIVERSIFICATION",
        priority: "MEDIUM",
        text: `The proposed changes improve your diversification score from ${impactSimulation.currentScore} to ${impactSimulation.projectedScore} without increasing risk.`,
        data: {
          currentScore: impactSimulation.currentScore,
          projectedScore: impactSimulation.projectedScore,
          improvement: impactSimulation.netImprovement,
        },
      });
    }

    // Overall score talking point
    if (diversificationScore.score < 60) {
      talkingPoints.push({
        type: "DIVERSIFICATION",
        priority: "HIGH",
        text: `Your portfolio diversification score is ${diversificationScore.score}/100. Reducing overlapping positions could help manage concentration risk.`,
        data: { score: diversificationScore.score, grade: diversificationScore.grade },
      });
    }

    return talkingPoints.sort((a, b) => {
      const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * BE-16: Full Portfolio Intelligence Analysis
   * Unified endpoint combining all intelligence features
   */
  async analyzePortfolioIntelligence(
    funds: PortfolioFund[]
  ): Promise<OverlapIntelligenceResult> {
    const cacheKey = funds.map(f => `${f.mfIsin}:${f.portfolioWeight}`).sort().join("|");
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Calculate diversification score
    const diversificationScore = await this.calculateDiversificationScore(funds);

    // Detect replacement candidates
    const replaceSuggestions = await this.detectReplacementCandidates(funds);

    // Find alternatives for each replacement suggestion
    for (const suggestion of replaceSuggestions) {
      const fundToReplace = funds.find(f => f.mfIsin === suggestion.fundIsin);
      if (fundToReplace) {
        suggestion.alternatives = await this.findAlternatives(fundToReplace, funds, 3);
      }
    }

    // Generate advisor talking points
    const advisorTalkingPoints = this.generateAdvisorTalkingPoints(
      diversificationScore,
      replaceSuggestions
    );

    const result: OverlapIntelligenceResult = {
      diversificationScore,
      replaceFundSuggestions: replaceSuggestions,
      advisorTalkingPoints,
    };

    this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  /**
   * BE-17: SIP Allocation Optimizer
   * Routes SIP amounts dynamically to minimize incremental stock overlap
   */
  async optimizeSIPAllocation(
    sipAmount: number,
    candidateFunds: string[],
    existingPortfolio: PortfolioFund[]
  ): Promise<{
    sipRouting: Array<{ fund: string; fundIsin: string; amount: number; overlapScore: number }>;
    explanation: string;
    totalAllocated: number;
  }> {
    if (!candidateFunds.length || sipAmount <= 0) {
      return { sipRouting: [], explanation: "No valid candidates for SIP allocation", totalAllocated: 0 };
    }

    // Get fund details and calculate overlap scores
    const fundScores: Array<{
      isin: string;
      name: string;
      overlapScore: number;
      expectedReturn: number;
    }> = [];

    for (const fundIsin of candidateFunds) {
      const [fundDetails] = await db
        .select()
        .from(mutualFunds)
        .where(eq(mutualFunds.isin, fundIsin))
        .limit(1);

      if (!fundDetails) continue;

      const overlapRisk = await this.calculateOverlapRiskScore(fundIsin, existingPortfolio);
      
      // Higher overlap = higher penalty = lower score
      const overlapPenalty = overlapRisk.score * 2; // Scale up penalty
      const baseReturnScore = 50; // Neutral base
      const effectiveScore = baseReturnScore - overlapPenalty;

      fundScores.push({
        isin: fundIsin,
        name: fundDetails.schemeName || "Unknown Fund",
        overlapScore: overlapRisk.score,
        expectedReturn: effectiveScore,
      });
    }

    if (!fundScores.length) {
      return { sipRouting: [], explanation: "No fund details found", totalAllocated: 0 };
    }

    // Sort by effective score (lowest overlap first)
    fundScores.sort((a, b) => a.overlapScore - b.overlapScore);

    // Allocate SIP proportionally - lower overlap gets more allocation
    const totalInverseOverlap = fundScores.reduce((sum, f) => sum + (100 - f.overlapScore), 0);
    const sipRouting = fundScores.map(f => {
      const proportion = (100 - f.overlapScore) / totalInverseOverlap;
      const amount = Math.round(sipAmount * proportion);
      return {
        fund: f.name,
        fundIsin: f.isin,
        amount,
        overlapScore: f.overlapScore,
      };
    });

    // Ensure total equals sipAmount (adjust rounding)
    const allocatedTotal = sipRouting.reduce((sum, r) => sum + r.amount, 0);
    if (allocatedTotal !== sipAmount && sipRouting.length > 0) {
      sipRouting[0].amount += sipAmount - allocatedTotal;
    }

    // Generate explanation
    const topFund = sipRouting[0];
    const explanation = `Allocation prioritizes ${topFund.fund} with lowest overlap score (${topFund.overlapScore.toFixed(1)}%). This reduces exposure to stocks already concentrated in your portfolio.`;

    return {
      sipRouting,
      explanation,
      totalAllocated: sipAmount,
    };
  }

  /**
   * BE-18: Goal-Specific Diversification Model
   * Adjusts diversification scoring based on investment goal
   */
  async calculateGoalBasedDiversificationScore(
    funds: PortfolioFund[],
    goal: "WEALTH_CREATION" | "RETIREMENT" | "CHILD_EDUCATION" | "INCOME"
  ): Promise<{
    score: number;
    grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    goal: string;
    riskAlignment: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    penalties: DiversificationPenalty[];
    goalAdjustments: { stockOverlapMultiplier: number; sectorPenaltyMultiplier: number };
  }> {
    // Goal-specific penalty multipliers
    const goalWeights = {
      WEALTH_CREATION: { stockOverlapMultiplier: 1.0, sectorPenaltyMultiplier: 0.7 },
      RETIREMENT: { stockOverlapMultiplier: 1.5, sectorPenaltyMultiplier: 1.5 },
      CHILD_EDUCATION: { stockOverlapMultiplier: 1.3, sectorPenaltyMultiplier: 1.2 },
      INCOME: { stockOverlapMultiplier: 1.0, sectorPenaltyMultiplier: 1.4 },
    };

    const weights = goalWeights[goal];
    
    // Get base diversification data
    const baseResult = await this.calculateDiversificationScore(funds);
    
    // Recalculate with goal-adjusted penalties
    let adjustedScore = 100;
    const adjustedPenalties: DiversificationPenalty[] = [];

    for (const penalty of baseResult.penalties) {
      let adjustedImpact = penalty.impact;
      
      if (penalty.type === "STOCK_OVERLAP") {
        adjustedImpact = Math.round(penalty.impact * weights.stockOverlapMultiplier);
      } else if (penalty.type === "SECTOR_CONCENTRATION") {
        adjustedImpact = Math.round(penalty.impact * weights.sectorPenaltyMultiplier);
      }
      
      adjustedPenalties.push({
        ...penalty,
        impact: adjustedImpact,
        description: `${penalty.description} (adjusted for ${goal.toLowerCase().replace(/_/g, " ")} goal)`,
      });
      
      adjustedScore += adjustedImpact;
    }

    // Clamp score
    adjustedScore = Math.max(0, Math.min(100, adjustedScore));

    // Determine grade
    let grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    if (adjustedScore >= 75) grade = "EXCELLENT";
    else if (adjustedScore >= 60) grade = "GOOD";
    else if (adjustedScore >= 40) grade = "FAIR";
    else grade = "POOR";

    // Risk alignment based on goal requirements
    let riskAlignment: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    if (goal === "RETIREMENT" || goal === "CHILD_EDUCATION") {
      // These goals need higher diversification
      riskAlignment = adjustedScore >= 70 ? "EXCELLENT" : adjustedScore >= 55 ? "GOOD" : adjustedScore >= 40 ? "FAIR" : "POOR";
    } else {
      riskAlignment = grade;
    }

    return {
      score: adjustedScore,
      grade,
      goal: goal.replace(/_/g, " "),
      riskAlignment,
      penalties: adjustedPenalties,
      goalAdjustments: weights,
    };
  }

  /**
   * BE-19: SEBI-Compliant Narrative Template Engine
   * Pre-approved templates for regulatory compliance
   */
  generateSEBICompliantNarratives(
    context: {
      type: "OVERLAP_RISK" | "SIP_ROUTING" | "REPLACE_FUND" | "DIVERSIFICATION_SCORE" | "GOAL_ALIGNMENT";
      data: Record<string, any>;
    }
  ): {
    narrative: string;
    disclaimer: string;
    isLocked: boolean;
    templateId: string;
  } {
    const disclaimers = {
      general: "Mutual fund investments are subject to market risks. Read all scheme related documents carefully before investing.",
      past_performance: "Past performance is not indicative of future results.",
      advice: "This information is for educational purposes only and does not constitute investment advice.",
    };

    const templates: Record<string, { text: string; disclaimer: string; id: string }> = {
      OVERLAP_RISK: {
        text: "Multiple schemes in the portfolio invest in the same underlying stocks. This may increase concentration risk and reduce the benefits of diversification.",
        disclaimer: disclaimers.general,
        id: "SEBI-TPL-001",
      },
      SIP_ROUTING: {
        text: "SIP allocations are structured to improve diversification based on current portfolio holdings. The suggested allocation aims to balance exposure across different securities.",
        disclaimer: disclaimers.general,
        id: "SEBI-TPL-002",
      },
      REPLACE_FUND: {
        text: "The suggested change aims to reduce overlap and align the portfolio with the stated investment objective. This recommendation is based on current holdings analysis.",
        disclaimer: disclaimers.general + " " + disclaimers.past_performance,
        id: "SEBI-TPL-003",
      },
      DIVERSIFICATION_SCORE: {
        text: "The diversification score reflects how spread the investments are across different stocks and sectors. A higher score indicates broader distribution of holdings.",
        disclaimer: disclaimers.advice,
        id: "SEBI-TPL-004",
      },
      GOAL_ALIGNMENT: {
        text: "The portfolio has been evaluated against the selected financial goal. Risk tolerance and investment horizon are key factors in determining goal alignment.",
        disclaimer: disclaimers.general + " " + disclaimers.advice,
        id: "SEBI-TPL-005",
      },
    };

    const template = templates[context.type];
    if (!template) {
      return {
        narrative: "Portfolio analysis completed.",
        disclaimer: disclaimers.general,
        isLocked: true,
        templateId: "SEBI-TPL-000",
      };
    }

    // Personalize template with data while keeping SEBI-compliant language
    let narrative = template.text;
    
    if (context.type === "OVERLAP_RISK" && context.data.stockCount) {
      narrative = `${context.data.stockCount} stocks appear in multiple schemes within the portfolio. ${template.text}`;
    } else if (context.type === "DIVERSIFICATION_SCORE" && context.data.score !== undefined) {
      narrative = `Current diversification score: ${context.data.score}/100. ${template.text}`;
    } else if (context.type === "GOAL_ALIGNMENT" && context.data.goal) {
      narrative = `For ${context.data.goal} goal: ${template.text}`;
    }

    return {
      narrative,
      disclaimer: template.disclaimer,
      isLocked: true,
      templateId: template.id,
    };
  }

  /**
   * Get all SEBI-compliant narratives for a portfolio analysis
   */
  generateAllSEBINarratives(
    diversificationScore: DiversificationScore,
    goal?: string
  ): Array<{
    type: string;
    narrative: string;
    disclaimer: string;
    isLocked: boolean;
    templateId: string;
  }> {
    const narratives = [];

    // Overlap risk narrative
    const overlappingStocks = diversificationScore.stockExposures.filter(s => s.fundCount >= 2);
    narratives.push({
      type: "OVERLAP_RISK",
      ...this.generateSEBICompliantNarratives({
        type: "OVERLAP_RISK",
        data: { stockCount: overlappingStocks.length },
      }),
    });

    // Diversification score narrative
    narratives.push({
      type: "DIVERSIFICATION_SCORE",
      ...this.generateSEBICompliantNarratives({
        type: "DIVERSIFICATION_SCORE",
        data: { score: diversificationScore.score },
      }),
    });

    // Goal alignment if provided
    if (goal) {
      narratives.push({
        type: "GOAL_ALIGNMENT",
        ...this.generateSEBICompliantNarratives({
          type: "GOAL_ALIGNMENT",
          data: { goal },
        }),
      });
    }

    return narratives;
  }
}

export const overlapIntelligenceEngine = OverlapIntelligenceEngine.getInstance();
