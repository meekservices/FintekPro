import { db } from "../db";
import { 
  portfolioDiagnostics, 
  aiProposals, 
  aiProposalItems, 
  aiAuditLogs,
  clientRiskProfiles,
  mfHoldings,
  mfFolios,
  mutualFunds,
  mutualFundMetrics,
  userProfiles,
  users,
  unifiedCartItems,
  clientPortfolioMld,
  type PortfolioDiagnostics,
  type AiProposal,
  type AiProposalItem,
  type ClientRiskProfile,
  type InsertPortfolioDiagnostics,
  type InsertAiProposal,
  type InsertAiProposalItem,
  type InsertAiAuditLog,
  type InsertUnifiedCartItem,
} from "@shared/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { aiMFRecommendationService } from "./ai-mf-recommendation-service";
// GoogleGenerativeAI imported from gemini service if needed

const SEBI_DISCLAIMER = `This investment proposal is generated using an AI-assisted analytical system based on information provided by the client and available market data. The recommendations are not investment advice, do not assure returns, and are subject to market risks. Final investment decisions shall be taken by the client after independent evaluation.`;

const RISK_RATINGS: Record<string, number> = {
  "equity_large_cap": 6,
  "equity_mid_cap": 8,
  "equity_small_cap": 9,
  "equity_multi_cap": 7,
  "equity_flexi_cap": 7,
  "equity_focused": 8,
  "equity_elss": 7,
  "equity_sectoral": 9,
  "debt_overnight": 1,
  "debt_liquid": 2,
  "debt_ultra_short": 2,
  "debt_low_duration": 3,
  "debt_short_duration": 3,
  "debt_medium_duration": 4,
  "debt_long_duration": 5,
  "debt_gilt": 4,
  "debt_credit_risk": 6,
  "debt_corporate": 4,
  "hybrid_aggressive": 6,
  "hybrid_balanced": 5,
  "hybrid_conservative": 4,
  "mld": 7,
  "mld_digital": 6,
  "mld_barrier": 7,
  "mld_sharkfin": 7,
  "mld_range": 6,
  "mld_participation": 7,
  "mld_autocall": 8,
  "mld_snowball": 8,
  "reit": 6,
  "invit": 6,
  "aif_cat_1": 7,
  "aif_cat_2": 8,
  "aif_cat_3": 9,
  "pms": 8,
  "fd": 2,
  "gold": 5,
  "cash": 1,
};

const IDEAL_ALLOCATIONS: Record<string, { min: number; max: number; target: number }> = {
  conservative: {
    equity: { min: 10, max: 30, target: 20 },
    debt: { min: 50, max: 70, target: 60 },
    alternatives: { min: 0, max: 10, target: 5 },
    cash: { min: 5, max: 15, target: 10 },
    gold: { min: 0, max: 10, target: 5 },
  } as any,
  moderate: {
    equity: { min: 40, max: 60, target: 50 },
    debt: { min: 25, max: 45, target: 35 },
    alternatives: { min: 0, max: 15, target: 5 },
    cash: { min: 5, max: 10, target: 5 },
    gold: { min: 0, max: 10, target: 5 },
  } as any,
  aggressive: {
    equity: { min: 60, max: 85, target: 70 },
    debt: { min: 10, max: 25, target: 15 },
    alternatives: { min: 0, max: 20, target: 10 },
    cash: { min: 0, max: 5, target: 2 },
    gold: { min: 0, max: 5, target: 3 },
  } as any,
};

interface PortfolioHolding {
  assetType: string;
  assetSubType?: string;
  isin?: string;
  schemeName: string;
  currentValue: number;
  weightPercent: number;
  riskScore: number;
  lockIn?: boolean;
  amcName?: string;
  benchmark?: string;
  returns1Y?: number;
  benchmarkReturns1Y?: number;
}

interface ConcentrationIssue {
  type: "single_stock" | "single_amc" | "sector" | "issuer";
  name: string;
  currentPercent: number;
  limitPercent: number;
  severity: "warning" | "critical";
}

interface OverlapDetail {
  scheme1: string;
  scheme2: string;
  overlapPercent: number;
  commonStocks: string[];
}

interface RecommendationInput {
  type: "BUY" | "SELL" | "SWITCH" | "HOLD";
  assetClass: string;
  productId?: string;
  isin?: string;
  schemeName: string;
  amcName?: string;
  amount?: number;
  units?: number;
  currentValue?: number;
  switchFromIsin?: string;
  switchFromSchemeName?: string;
  rationale: string;
  problemIdentified?: string;
  riskInvolved?: string;
  portfolioImpactSummary?: string;
  riskImpactPercent?: string;
  productDisclaimer?: string;
  priority?: number;
}

export class AIProposalEngine {
  constructor() {
    // AI engine initialization
  }

  async getOrCreateRiskProfile(userId: string): Promise<ClientRiskProfile | null> {
    const existing = await db.select().from(clientRiskProfiles).where(eq(clientRiskProfiles.userId, userId)).limit(1);
    if (existing.length > 0) return existing[0];

    const userProfile = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
    if (userProfile.length === 0) return null;

    const profile = userProfile[0];
    const riskCategory = this.mapRiskTolerance(profile.riskTolerance || "moderate");

    const [created] = await db.insert(clientRiskProfiles).values({
      userId,
      riskCategory,
      riskScore: riskCategory === "conservative" ? 3 : riskCategory === "moderate" ? 5 : 8,
      timeHorizonYears: 5,
      liquidityNeed: "medium",
      investmentObjectives: ["growth"],
    }).returning();

    return created;
  }

  private mapRiskTolerance(tolerance: string): "conservative" | "moderate" | "aggressive" {
    const lower = tolerance.toLowerCase();
    if (lower.includes("low") || lower.includes("conservative")) return "conservative";
    if (lower.includes("high") || lower.includes("aggressive")) return "aggressive";
    return "moderate";
  }

  async getPortfolioHoldings(userId: string): Promise<PortfolioHolding[]> {
    const holdings: PortfolioHolding[] = [];

    // Fetch Mutual Fund holdings
    const mfData = await db
      .select()
      .from(mfHoldings)
      .innerJoin(mfFolios, eq(mfHoldings.folioId, mfFolios.id))
      .where(eq(mfHoldings.userId, userId));

    let totalValue = 0;
    for (const h of mfData) {
      const value = parseFloat(h.mf_holdings.currentValue?.toString() || "0");
      totalValue += value;
    }

    // Fetch approved MLD holdings
    const mldData = await db
      .select()
      .from(clientPortfolioMld)
      .where(and(
        eq(clientPortfolioMld.clientId, userId),
        eq(clientPortfolioMld.entryStatus, "approved")
      ));

    for (const mld of mldData) {
      const value = parseFloat(mld.currentValue || mld.totalInvested || "0");
      totalValue += value;
    }

    // Add MF holdings
    for (const h of mfData) {
      const value = parseFloat(h.mf_holdings.currentValue?.toString() || "0");
      const assetSubType = this.classifyMFScheme(h.mf_holdings.schemeName || "");
      
      holdings.push({
        assetType: "mutual_fund",
        assetSubType,
        isin: h.mf_holdings.isin || undefined,
        schemeName: h.mf_holdings.schemeName || "Unknown Scheme",
        currentValue: value,
        weightPercent: totalValue > 0 ? (value / totalValue) * 100 : 0,
        riskScore: RISK_RATINGS[assetSubType] || 5,
        lockIn: h.mf_holdings.lockInEndDate ? new Date(h.mf_holdings.lockInEndDate) > new Date() : false,
        amcName: h.mf_folios.amcName || undefined,
      });
    }

    // Add MLD holdings (only approved ones for AI analysis)
    for (const mld of mldData) {
      const value = parseFloat(mld.currentValue || mld.totalInvested || "0");
      const payoffType = (mld.payoffType || "digital").toLowerCase();
      const riskKey = `mld_${payoffType}`;
      // Use payoff-type specific risk rating, fallback to generic MLD rating, then to stored riskScore
      const riskScore = RISK_RATINGS[riskKey] || RISK_RATINGS["mld"] || mld.riskScore || 7;
      
      holdings.push({
        assetType: "mld",
        assetSubType: riskKey,
        isin: mld.isin || undefined,
        schemeName: mld.mldName || "Unknown MLD",
        currentValue: value,
        weightPercent: totalValue > 0 ? (value / totalValue) * 100 : 0,
        riskScore: riskScore,
        lockIn: mld.maturityDate ? new Date(mld.maturityDate) > new Date() : true,
        amcName: mld.issuer || undefined,
      });
    }

    return holdings;
  }

  private classifyMFScheme(schemeName: string): string {
    const name = schemeName.toLowerCase();
    if (name.includes("liquid")) return "debt_liquid";
    if (name.includes("overnight")) return "debt_overnight";
    if (name.includes("ultra short")) return "debt_ultra_short";
    if (name.includes("gilt")) return "debt_gilt";
    if (name.includes("credit risk")) return "debt_credit_risk";
    if (name.includes("corporate bond")) return "debt_corporate";
    if (name.includes("elss") || name.includes("tax saver")) return "equity_elss";
    if (name.includes("large cap") || name.includes("largecap")) return "equity_large_cap";
    if (name.includes("mid cap") || name.includes("midcap")) return "equity_mid_cap";
    if (name.includes("small cap") || name.includes("smallcap")) return "equity_small_cap";
    if (name.includes("flexi cap") || name.includes("flexicap")) return "equity_flexi_cap";
    if (name.includes("multi cap") || name.includes("multicap")) return "equity_multi_cap";
    if (name.includes("focused")) return "equity_focused";
    if (name.includes("sectoral") || name.includes("thematic")) return "equity_sectoral";
    if (name.includes("aggressive hybrid")) return "hybrid_aggressive";
    if (name.includes("balanced") || name.includes("hybrid")) return "hybrid_balanced";
    if (name.includes("conservative hybrid")) return "hybrid_conservative";
    if (name.includes("debt") || name.includes("income")) return "debt_short_duration";
    if (name.includes("equity")) return "equity_multi_cap";
    return "equity_multi_cap";
  }

  calculatePortfolioRiskScore(holdings: PortfolioHolding[]): number {
    if (holdings.length === 0) return 0;
    
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
    if (totalValue === 0) return 0;

    let weightedRisk = 0;
    for (const h of holdings) {
      const weight = h.currentValue / totalValue;
      weightedRisk += weight * h.riskScore;
    }

    return Math.round(weightedRisk * 100) / 100;
  }

  calculateAssetAllocation(holdings: PortfolioHolding[]): Record<string, { value: number; percentage: number }> {
    const allocation: Record<string, { value: number; percentage: number }> = {
      equity: { value: 0, percentage: 0 },
      debt: { value: 0, percentage: 0 },
      alternatives: { value: 0, percentage: 0 },
      cash: { value: 0, percentage: 0 },
      gold: { value: 0, percentage: 0 },
    };

    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    for (const h of holdings) {
      const assetType = h.assetType.toLowerCase();
      const subType = (h.assetSubType || "").toLowerCase();

      if (assetType === "cash" || subType.includes("liquid") || subType.includes("overnight")) {
        allocation.cash.value += h.currentValue;
      } else if (subType.includes("gold") || assetType === "gold") {
        allocation.gold.value += h.currentValue;
      } else if (subType.includes("equity") || subType.includes("elss")) {
        allocation.equity.value += h.currentValue;
      } else if (subType.includes("debt") || subType.includes("gilt") || subType.includes("corporate") || subType.includes("credit")) {
        allocation.debt.value += h.currentValue;
      } else if (assetType === "reit" || assetType === "invit" || assetType === "aif" || assetType === "pms" || assetType === "mld") {
        allocation.alternatives.value += h.currentValue;
      } else if (subType.includes("hybrid")) {
        const equityRatio = subType.includes("aggressive") ? 0.65 : subType.includes("conservative") ? 0.25 : 0.5;
        allocation.equity.value += h.currentValue * equityRatio;
        allocation.debt.value += h.currentValue * (1 - equityRatio);
      } else {
        allocation.equity.value += h.currentValue;
      }
    }

    for (const key of Object.keys(allocation)) {
      allocation[key].percentage = totalValue > 0 ? (allocation[key].value / totalValue) * 100 : 0;
    }

    return allocation;
  }

  analyzeConcentration(holdings: PortfolioHolding[], maxSingleStock = 15, maxSingleAmc = 25): ConcentrationIssue[] {
    const issues: ConcentrationIssue[] = [];
    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    for (const h of holdings) {
      if (h.weightPercent > maxSingleStock) {
        issues.push({
          type: "single_stock",
          name: h.schemeName,
          currentPercent: h.weightPercent,
          limitPercent: maxSingleStock,
          severity: h.weightPercent > maxSingleStock * 1.5 ? "critical" : "warning",
        });
      }
    }

    const amcConcentration: Record<string, number> = {};
    for (const h of holdings) {
      const amc = h.amcName || "Unknown";
      amcConcentration[amc] = (amcConcentration[amc] || 0) + h.currentValue;
    }

    for (const [amc, value] of Object.entries(amcConcentration)) {
      const percent = totalValue > 0 ? (value / totalValue) * 100 : 0;
      if (percent > maxSingleAmc) {
        issues.push({
          type: "single_amc",
          name: amc,
          currentPercent: percent,
          limitPercent: maxSingleAmc,
          severity: percent > maxSingleAmc * 1.5 ? "critical" : "warning",
        });
      }
    }

    return issues;
  }

  analyzeMFOverlap(holdings: PortfolioHolding[]): { overlapPercent: number; details: OverlapDetail[] } {
    const mfHoldings = holdings.filter(h => h.assetType === "mutual_fund");
    
    if (mfHoldings.length < 2) {
      return { overlapPercent: 0, details: [] };
    }

    const details: OverlapDetail[] = [];
    let totalOverlap = 0;

    for (let i = 0; i < mfHoldings.length; i++) {
      for (let j = i + 1; j < mfHoldings.length; j++) {
        const scheme1 = mfHoldings[i];
        const scheme2 = mfHoldings[j];

        const subType1 = scheme1.assetSubType || "";
        const subType2 = scheme2.assetSubType || "";

        let estimatedOverlap = 0;
        if (subType1 === subType2) {
          estimatedOverlap = 40;
        } else if (
          (subType1.includes("large") && subType2.includes("large")) ||
          (subType1.includes("mid") && subType2.includes("mid")) ||
          (subType1.includes("small") && subType2.includes("small"))
        ) {
          estimatedOverlap = 30;
        } else if (
          (subType1.includes("equity") && subType2.includes("equity")) ||
          (subType1.includes("flexi") || subType2.includes("flexi") || subType1.includes("multi") || subType2.includes("multi"))
        ) {
          estimatedOverlap = 20;
        }

        if (estimatedOverlap > 20) {
          details.push({
            scheme1: scheme1.schemeName,
            scheme2: scheme2.schemeName,
            overlapPercent: estimatedOverlap,
            commonStocks: [],
          });
          totalOverlap += estimatedOverlap;
        }
      }
    }

    const avgOverlap = details.length > 0 ? totalOverlap / details.length : 0;
    return { overlapPercent: Math.round(avgOverlap), details };
  }

  analyzeAllocationDeviation(
    currentAllocation: Record<string, { value: number; percentage: number }>,
    riskCategory: "conservative" | "moderate" | "aggressive"
  ): Record<string, { current: number; target: number; deviation: number }> {
    const ideal = IDEAL_ALLOCATIONS[riskCategory] as Record<string, { min: number; max: number; target: number }>;
    const deviation: Record<string, { current: number; target: number; deviation: number }> = {};

    for (const [assetClass, targets] of Object.entries(ideal)) {
      const current = currentAllocation[assetClass]?.percentage || 0;
      deviation[assetClass] = {
        current: Math.round(current * 100) / 100,
        target: targets.target,
        deviation: Math.round((current - targets.target) * 100) / 100,
      };
    }

    return deviation;
  }

  calculateHealthScore(
    riskMismatch: number,
    concentrationIssues: ConcentrationIssue[],
    overlapPercent: number,
    allocationDeviation: Record<string, { current: number; target: number; deviation: number }>
  ): number {
    let score = 100;

    const riskPenalty = Math.min(Math.abs(riskMismatch) * 5, 20);
    score -= riskPenalty;

    for (const issue of concentrationIssues) {
      score -= issue.severity === "critical" ? 10 : 5;
    }

    if (overlapPercent > 30) score -= 15;
    else if (overlapPercent > 20) score -= 10;
    else if (overlapPercent > 10) score -= 5;

    for (const dev of Object.values(allocationDeviation)) {
      if (Math.abs(dev.deviation) > 20) score -= 5;
      else if (Math.abs(dev.deviation) > 10) score -= 3;
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  async runPortfolioDiagnostics(userId: string): Promise<PortfolioDiagnostics> {
    const riskProfile = await this.getOrCreateRiskProfile(userId);
    if (!riskProfile) {
      throw new Error("Could not get or create risk profile for user");
    }

    const holdings = await this.getPortfolioHoldings(userId);
    const portfolioRiskScore = this.calculatePortfolioRiskScore(holdings);
    const assetAllocation = this.calculateAssetAllocation(holdings);
    const concentrationIssues = this.analyzeConcentration(
      holdings,
      riskProfile.maxSingleStockExposure || 15,
      riskProfile.maxSingleAmcExposure || 25
    );
    const { overlapPercent, details: mfOverlapDetails } = this.analyzeMFOverlap(holdings);
    const allocationDeviation = this.analyzeAllocationDeviation(
      assetAllocation,
      riskProfile.riskCategory as "conservative" | "moderate" | "aggressive"
    );

    const idealRiskScore = riskProfile.riskCategory === "conservative" ? 3 : riskProfile.riskCategory === "aggressive" ? 7 : 5;
    const riskMismatch = portfolioRiskScore - idealRiskScore;

    const healthScore = this.calculateHealthScore(riskMismatch, concentrationIssues, overlapPercent, allocationDeviation);

    const issueCount = {
      critical: concentrationIssues.filter(i => i.severity === "critical").length,
      warning: concentrationIssues.filter(i => i.severity === "warning").length + (overlapPercent > 30 ? 1 : 0),
      info: 0,
    };

    const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

    const diagnosticsData = {
      userId,
      portfolioSnapshot: {
        totalValue,
        assetAllocation,
        holdings: holdings.map(h => ({
          assetType: h.assetType,
          isin: h.isin,
          schemeName: h.schemeName,
          currentValue: h.currentValue,
          weightPercent: h.weightPercent,
          riskScore: h.riskScore,
          lockIn: h.lockIn,
        })),
      },
      portfolioRiskScore: portfolioRiskScore.toString(),
      clientRiskTolerance: riskProfile.riskCategory,
      riskMismatchPercent: riskMismatch.toString(),
      idealAllocation: IDEAL_ALLOCATIONS[riskProfile.riskCategory as keyof typeof IDEAL_ALLOCATIONS] as any,
      allocationDeviation: allocationDeviation as any,
      concentrationIssues: concentrationIssues as any,
      mfOverlapPercent: overlapPercent.toString(),
      mfOverlapDetails: mfOverlapDetails as any,
      healthScore,
      healthSummary: this.generateHealthSummary(healthScore, concentrationIssues, overlapPercent, riskMismatch),
      issueCount: issueCount as any,
    };

    const [created] = await db.insert(portfolioDiagnostics).values(diagnosticsData as any).returning();

    await this.logAuditEntry({
      diagnosticsId: created.id,
      actorId: userId,
      actorRole: "system",
      action: "diagnostics_generated",
      actionCategory: "diagnostics",
      newState: { healthScore, issueCount },
    });

    return created;
  }

  private generateHealthSummary(
    healthScore: number,
    concentrationIssues: ConcentrationIssue[],
    overlapPercent: number,
    riskMismatch: number
  ): string {
    const parts: string[] = [];

    if (healthScore >= 80) {
      parts.push("Your portfolio is in good health overall.");
    } else if (healthScore >= 60) {
      parts.push("Your portfolio needs some attention in a few areas.");
    } else {
      parts.push("Your portfolio requires significant rebalancing.");
    }

    if (concentrationIssues.length > 0) {
      const criticalCount = concentrationIssues.filter(i => i.severity === "critical").length;
      if (criticalCount > 0) {
        parts.push(`There are ${criticalCount} critical concentration issues that need immediate attention.`);
      } else {
        parts.push(`There are ${concentrationIssues.length} concentration warnings to review.`);
      }
    }

    if (overlapPercent > 30) {
      parts.push("High overlap detected between your mutual fund holdings. Consider consolidating similar schemes.");
    } else if (overlapPercent > 20) {
      parts.push("Moderate overlap exists between some mutual fund schemes.");
    }

    if (Math.abs(riskMismatch) > 2) {
      if (riskMismatch > 0) {
        parts.push("Your portfolio carries more risk than your stated risk tolerance.");
      } else {
        parts.push("Your portfolio is more conservative than your risk tolerance suggests.");
      }
    }

    return parts.join(" ");
  }

  async generateRecommendations(
    userId: string, 
    diagnosticsId: string
  ): Promise<RecommendationInput[]> {
    const diagnostics = await db.select().from(portfolioDiagnostics).where(eq(portfolioDiagnostics.id, diagnosticsId)).limit(1);
    if (diagnostics.length === 0) {
      throw new Error("Diagnostics not found");
    }

    const diag = diagnostics[0];
    const recommendations: RecommendationInput[] = [];

    const snapshot = diag.portfolioSnapshot as any;
    const concentrationIssues = (diag.concentrationIssues as ConcentrationIssue[]) || [];
    const allocationDeviation = diag.allocationDeviation as Record<string, { current: number; target: number; deviation: number }>;
    const mfOverlapPercent = parseFloat(diag.mfOverlapPercent?.toString() || "0");
    const riskMismatch = parseFloat(diag.riskMismatchPercent?.toString() || "0");

    for (const issue of concentrationIssues) {
      if (issue.type === "single_stock" && issue.severity === "critical") {
        const holding = (snapshot.holdings as any[]).find((h: any) => h.schemeName === issue.name);
        if (holding) {
          const sellAmount = holding.currentValue * (1 - issue.limitPercent / issue.currentPercent);

          // T008: FIFO-based tax estimate
          const taxInfo = await this.computeTaxEstimate(userId, holding.isin, sellAmount);

          recommendations.push({
            type: "SELL",
            assetClass: holding.assetType || "mutual_fund",
            isin: holding.isin,
            schemeName: issue.name,
            amount: Math.round(sellAmount),
            currentValue: holding.currentValue,
            rationale: `Reduce exposure from ${issue.currentPercent.toFixed(1)}% to ${issue.limitPercent}% to maintain diversification. ${taxInfo.rationaleNote}`,
            problemIdentified: `Single holding concentration at ${issue.currentPercent.toFixed(1)}% exceeds the ${issue.limitPercent}% limit.`,
            riskInvolved: `Selling may trigger capital gains tax. ${taxInfo.taxType}: estimated tax ≈ ₹${taxInfo.estimatedTax.toLocaleString('en-IN')} at ${taxInfo.taxRate}% on gains.`,
            portfolioImpactSummary: `Reduces concentration risk and improves portfolio diversification.`,
            riskImpactPercent: "-" + Math.round((issue.currentPercent - issue.limitPercent) / 2) + "%",
            priority: 1,
          });
        }
      }
    }

    if (mfOverlapPercent > 30) {
      const mfSnapshotHoldings = (snapshot.holdings as any[]).filter((h: any) => h.assetType === "mutual_fund");
      if (mfSnapshotHoldings.length >= 2) {
        const smallerHolding = mfSnapshotHoldings.sort((a: any, b: any) => a.currentValue - b.currentValue)[0];

        // T006: DB-backed SWITCH target fund — same category, different AMC
        let switchTargetName = "Diversified Equity Fund";
        let switchTargetIsin: string | undefined;
        let switchTargetSchemeCode: string | undefined;
        let switchTargetAmc: string | undefined;
        try {
          // Fetch the source fund's category + AMC
          const [sourceFund] = await db
            .select({ category: mutualFunds.category, fundHouse: mutualFunds.fundHouse })
            .from(mutualFunds)
            .where(eq(mutualFunds.isinGrowth, smallerHolding.isin || ''))
            .limit(1);

          if (sourceFund?.category) {
            // Find a replacement: same category, different AMC, active
            const [targetFund] = await db
              .select({
                schemeCode: mutualFunds.schemeCode,
                schemeName: mutualFunds.schemeName,
                isinGrowth: mutualFunds.isinGrowth,
                fundHouse: mutualFunds.fundHouse,
              })
              .from(mutualFunds)
              .leftJoin(mutualFundMetrics, eq(mutualFunds.schemeCode, mutualFundMetrics.schemeCode))
              .where(
                and(
                  eq(mutualFunds.category, sourceFund.category),
                  eq(mutualFunds.schemeStatus, 'active'),
                  ne(mutualFunds.fundHouse, sourceFund.fundHouse || ''),
                )
              )
              .orderBy(desc(mutualFundMetrics.sharpeRatio))
              .limit(1);

            if (targetFund) {
              switchTargetName = targetFund.schemeName;
              switchTargetIsin = targetFund.isinGrowth || undefined;
              switchTargetSchemeCode = targetFund.schemeCode;
              switchTargetAmc = targetFund.fundHouse || undefined;
            }
          }
        } catch (e) {
          console.warn('[ProposalEngine] SWITCH target fund DB lookup failed:', e);
        }

        recommendations.push({
          type: "SWITCH",
          assetClass: "mutual_fund",
          isin: switchTargetIsin,
          schemeName: switchTargetName,
          amcName: switchTargetAmc,
          switchFromIsin: smallerHolding.isin,
          switchFromSchemeName: smallerHolding.schemeName,
          amount: smallerHolding.currentValue,
          currentValue: smallerHolding.currentValue,
          rationale: `Switch from ${smallerHolding.schemeName} to ${switchTargetName} (${switchTargetAmc || 'different AMC'}) to reduce overlap from ${mfOverlapPercent}%.`,
          problemIdentified: `Mutual fund overlap at ${mfOverlapPercent}% is higher than the 30% threshold.`,
          riskInvolved: "Switching may incur exit loads and tax implications. Verify exit load period before executing.",
          portfolioImpactSummary: `Reduces holding overlap and improves diversification. Target fund: ${switchTargetName}${switchTargetAmc ? ` by ${switchTargetAmc}` : ''}.`,
          riskImpactPercent: "-5%",
          priority: 2,
        });
      }
    }

    if (allocationDeviation) {
      for (const [assetClass, dev] of Object.entries(allocationDeviation)) {
        if (dev.deviation > 15) {
          recommendations.push({
            type: "SELL",
            assetClass: assetClass === "equity" ? "mutual_fund" : assetClass,
            schemeName: `${assetClass.charAt(0).toUpperCase() + assetClass.slice(1)} Holdings`,
            rationale: `Reduce ${assetClass} allocation from ${dev.current.toFixed(1)}% to target of ${dev.target}%.`,
            problemIdentified: `${assetClass.charAt(0).toUpperCase() + assetClass.slice(1)} allocation exceeds target by ${dev.deviation.toFixed(1)}%.`,
            riskInvolved: "Rebalancing may trigger tax events.",
            portfolioImpactSummary: `Brings ${assetClass} allocation closer to ideal range for your risk profile.`,
            riskImpactPercent: "-" + Math.round(Math.abs(dev.deviation) / 3) + "%",
            priority: 3,
          });
        } else if (dev.deviation < -15) {
          recommendations.push({
            type: "BUY",
            assetClass: assetClass === "equity" ? "mutual_fund" : assetClass,
            schemeName: `${assetClass.charAt(0).toUpperCase() + assetClass.slice(1)} Fund`,
            rationale: `Increase ${assetClass} allocation from ${dev.current.toFixed(1)}% to target of ${dev.target}%.`,
            problemIdentified: `${assetClass.charAt(0).toUpperCase() + assetClass.slice(1)} allocation is ${Math.abs(dev.deviation).toFixed(1)}% below target.`,
            riskInvolved: `${assetClass === "equity" ? "Equity investments are subject to market volatility." : "Investment value may fluctuate."}`,
            portfolioImpactSummary: `Improves alignment with your ${diag.clientRiskTolerance} risk profile.`,
            riskImpactPercent: "+" + Math.round(Math.abs(dev.deviation) / 4) + "%",
            priority: 3,
          });
        }
      }
    }

    if (riskMismatch > 2) {
      recommendations.push({
        type: "SELL",
        assetClass: "equity",
        schemeName: "High Risk Equity Holdings",
        rationale: "Reduce overall portfolio risk by decreasing equity exposure.",
        problemIdentified: `Portfolio risk score exceeds your risk tolerance by ${riskMismatch.toFixed(1)} points.`,
        riskInvolved: "Reducing equity may limit upside potential.",
        portfolioImpactSummary: "Aligns portfolio risk with your stated risk tolerance.",
        riskImpactPercent: `-${Math.round(riskMismatch * 3)}%`,
        priority: 2,
      });
    }

    const cashPercent = snapshot.assetAllocation?.cash?.percentage || 0;
    if (cashPercent > 10) {
      recommendations.push({
        type: "BUY",
        assetClass: "mutual_fund",
        schemeName: "Balanced Advantage Fund",
        amount: Math.round(snapshot.totalValue * (cashPercent - 5) / 100),
        rationale: "Deploy excess cash into a balanced fund for better returns while maintaining flexibility.",
        problemIdentified: `Cash allocation at ${cashPercent.toFixed(1)}% exceeds optimal 5-10% range.`,
        riskInvolved: "Market conditions may affect entry timing.",
        portfolioImpactSummary: "Improves capital deployment and potential returns.",
        riskImpactPercent: "+2%",
        priority: 4,
      });
    }

    return recommendations.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  }

  async createProposal(
    clientId: string,
    agentId: string | null,
    diagnosticsId: string,
    recommendations: RecommendationInput[],
    title?: string
  ): Promise<{ proposal: AiProposal; items: AiProposalItem[] }> {
    const diagnostics = await db.select().from(portfolioDiagnostics).where(eq(portfolioDiagnostics.id, diagnosticsId)).limit(1);
    if (diagnostics.length === 0) {
      throw new Error("Diagnostics not found");
    }

    const diag = diagnostics[0];
    const snapshot = diag.portfolioSnapshot as any;

    const proposalNumber = `PROP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // T007: Real beforeAllocation from snapshot
    const beforeAllocation: Record<string, number> = {};
    for (const [key, value] of Object.entries(snapshot.assetAllocation || {})) {
      beforeAllocation[key] = (value as any).percentage || 0;
    }

    let totalInvestment = 0;
    let totalRedemption = 0;

    for (const rec of recommendations) {
      if (rec.type === "BUY" && rec.amount) {
        totalInvestment += rec.amount;
      } else if ((rec.type === "SELL" || rec.type === "SWITCH") && rec.amount) {
        totalRedemption += rec.amount;
      }
    }

    // T007: Compute afterAllocation by applying deltas to each bucket
    const totalValue = snapshot.totalValue || 0;
    const newTotalValue = Math.max(1, totalValue + totalInvestment - totalRedemption);

    // Map rec assetClass → allocation key
    const assetClassToKey = (ac: string | undefined): string => {
      if (!ac) return 'equity';
      const lc = ac.toLowerCase();
      if (lc.includes('debt') || lc.includes('bond') || lc.includes('liquid') || lc.includes('overnight') || lc.includes('gilt')) return 'debt';
      if (lc.includes('gold')) return 'gold';
      if (lc.includes('cash')) return 'cash';
      if (lc.includes('real_estate') || lc.includes('reit') || lc.includes('invit')) return 'real_estate';
      return 'equity'; // default: equity, MF
    };

    // Convert before-pct → absolute amounts
    const buckets: Record<string, number> = {};
    for (const [key, pct] of Object.entries(beforeAllocation)) {
      buckets[key] = (pct / 100) * totalValue;
    }

    for (const rec of recommendations) {
      const key = assetClassToKey(rec.assetClass);
      if (!(key in buckets)) buckets[key] = 0;

      if (rec.type === "BUY" && rec.amount) {
        buckets[key] = (buckets[key] || 0) + rec.amount;
      } else if (rec.type === "SELL" && rec.amount) {
        buckets[key] = Math.max(0, (buckets[key] || 0) - rec.amount);
      } else if (rec.type === "SWITCH" && rec.amount) {
        // Subtract from source bucket (same as the holding being switched out)
        buckets[key] = Math.max(0, (buckets[key] || 0) - rec.amount);
        // Add to the same key (same category) — net allocation stays same; overlap benefit is diversification
        buckets[key] = (buckets[key] || 0) + rec.amount;
      }
    }

    // Renormalize to percentages
    const afterAllocation: Record<string, number> = {};
    for (const [key, absValue] of Object.entries(buckets)) {
      afterAllocation[key] = Math.round((absValue / newTotalValue) * 10000) / 100; // 2dp %
    }

    // T007: aiModelUsed reflects actual engine
    const aiModelUsed = process.env.PYTHON_SERVICE_URL ? 'python-sidecar-v3.0.0' : 'rule-based-v2.0.0';

    const proposalData: InsertAiProposal = {
      clientId,
      agentId,
      diagnosticsId,
      proposalNumber,
      title: title || `Investment Proposal - ${new Date().toLocaleDateString()}`,
      description: `AI-generated investment proposal based on portfolio analysis. Health Score: ${diag.healthScore}/100`,
      status: "draft",
      validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      beforeAllocation,
      afterAllocation,
      riskScoreBefore: diag.portfolioRiskScore,
      riskScoreAfter: diag.portfolioRiskScore,
      totalInvestmentAmount: totalInvestment.toString(),
      totalRedemptionAmount: totalRedemption.toString(),
      netCashFlow: (totalRedemption - totalInvestment).toString(),
      aiEngineVersion: "3.0.0",
      aiModelUsed,
      aiGeneratedAt: new Date(),
      sebiDisclaimer: SEBI_DISCLAIMER,
    };

    const [proposal] = await db.insert(aiProposals).values(proposalData as any).returning();

    const items: AiProposalItem[] = [];
    for (const rec of recommendations) {
      const itemData: InsertAiProposalItem = {
        proposalId: proposal.id,
        recommendationType: rec.type,
        assetClass: rec.assetClass,
        productId: rec.productId,
        isin: rec.isin,
        schemeName: rec.schemeName,
        amcName: rec.amcName,
        switchFromProductId: rec.switchFromIsin ? undefined : undefined,
        switchFromIsin: rec.switchFromIsin,
        switchFromSchemeName: rec.switchFromSchemeName,
        amount: rec.amount?.toString(),
        units: rec.units?.toString(),
        currentValue: rec.currentValue?.toString(),
        rationale: rec.rationale,
        problemIdentified: rec.problemIdentified,
        riskInvolved: rec.riskInvolved,
        portfolioImpactSummary: rec.portfolioImpactSummary,
        riskImpactPercent: rec.riskImpactPercent,
        productDisclaimer: rec.productDisclaimer,
        priority: rec.priority || 1,
        status: "pending",
      };

      const [item] = await db.insert(aiProposalItems).values(itemData).returning();
      items.push(item);
    }

    await this.logAuditEntry({
      proposalId: proposal.id,
      diagnosticsId,
      actorId: agentId || clientId,
      actorRole: agentId ? "agent" : "system",
      action: "proposal_created",
      actionCategory: "proposal",
      newState: {
        proposalNumber,
        itemCount: items.length,
        totalInvestment,
        totalRedemption,
      },
    });

    return { proposal, items };
  }

  async getProposal(proposalId: string): Promise<{ proposal: AiProposal; items: AiProposalItem[] } | null> {
    const proposals = await db.select().from(aiProposals).where(eq(aiProposals.id, proposalId)).limit(1);
    if (proposals.length === 0) return null;

    const items = await db.select().from(aiProposalItems).where(eq(aiProposalItems.proposalId, proposalId)).orderBy(aiProposalItems.priority);

    return { proposal: proposals[0], items };
  }

  async getClientProposals(clientId: string): Promise<AiProposal[]> {
    return db.select().from(aiProposals).where(eq(aiProposals.clientId, clientId)).orderBy(desc(aiProposals.createdAt));
  }

  async getAgentProposals(agentId: string): Promise<AiProposal[]> {
    return db.select().from(aiProposals).where(eq(aiProposals.agentId, agentId)).orderBy(desc(aiProposals.createdAt));
  }

  async updateProposalStatus(
    proposalId: string,
    status: string,
    actorId: string,
    actorRole: string,
    notes?: string
  ): Promise<AiProposal> {
    const [current] = await db.select().from(aiProposals).where(eq(aiProposals.id, proposalId)).limit(1);
    if (!current) throw new Error("Proposal not found");

    const updateData: Partial<AiProposal> = {
      status,
      updatedAt: new Date(),
    };

    if (actorRole === "agent") {
      updateData.agentNotes = notes;
      updateData.agentModifiedAt = new Date();
    } else if (actorRole === "client") {
      updateData.clientDecision = status === "approved" ? "approved" : status === "rejected" ? "rejected" : "partial";
      updateData.clientDecisionAt = new Date();
      updateData.clientNotes = notes;
    }

    const [updated] = await db.update(aiProposals).set(updateData).where(eq(aiProposals.id, proposalId)).returning();

    await this.logAuditEntry({
      proposalId,
      actorId,
      actorRole,
      action: "status_changed",
      actionCategory: "proposal",
      previousState: { status: current.status },
      newState: { status },
      changeDetails: { field: "status", oldValue: current.status, newValue: status, reason: notes },
    });

    return updated;
  }

  async updateProposalItem(
    itemId: string,
    updates: { amount?: number; status?: string; agentModificationReason?: string },
    actorId: string,
    actorRole: string
  ): Promise<AiProposalItem> {
    const [current] = await db.select().from(aiProposalItems).where(eq(aiProposalItems.id, itemId)).limit(1);
    if (!current) throw new Error("Proposal item not found");

    const updateData: Partial<AiProposalItem> = {
      updatedAt: new Date(),
    };

    if (updates.amount !== undefined) {
      if (!current.agentModified) {
        updateData.originalAmount = current.amount;
        updateData.originalRationale = current.rationale;
      }
      updateData.amount = updates.amount.toString();
      updateData.agentModified = true;
      updateData.agentModificationReason = updates.agentModificationReason;
    }

    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === "approved" || updates.status === "rejected") {
        updateData.clientDecision = updates.status;
        updateData.clientDecisionAt = new Date();
      }
    }

    const [updated] = await db.update(aiProposalItems).set(updateData).where(eq(aiProposalItems.id, itemId)).returning();

    await this.logAuditEntry({
      proposalId: current.proposalId,
      proposalItemId: itemId,
      actorId,
      actorRole,
      action: actorRole === "agent" ? "item_modified" : "item_decision",
      actionCategory: "item",
      previousState: { amount: current.amount, status: current.status },
      newState: { amount: updated.amount, status: updated.status },
      changeDetails: updates as any,
    });

    return updated;
  }

  async submitProposalToClient(proposalId: string, agentId: string): Promise<AiProposal> {
    return this.updateProposalStatus(proposalId, "pending_review", agentId, "agent", "Submitted for client review");
  }

  async clientApproveItem(itemId: string, clientId: string): Promise<AiProposalItem> {
    return this.updateProposalItem(itemId, { status: "approved" }, clientId, "client");
  }

  async clientRejectItem(itemId: string, clientId: string, reason?: string): Promise<AiProposalItem> {
    const [current] = await db.select().from(aiProposalItems).where(eq(aiProposalItems.id, itemId)).limit(1);
    if (!current) throw new Error("Item not found");

    const [updated] = await db.update(aiProposalItems).set({
      status: "rejected",
      clientDecision: "rejected",
      clientDecisionAt: new Date(),
      clientRejectionReason: reason,
      updatedAt: new Date(),
    }).where(eq(aiProposalItems.id, itemId)).returning();

    await this.logAuditEntry({
      proposalId: current.proposalId,
      proposalItemId: itemId,
      actorId: clientId,
      actorRole: "client",
      action: "item_rejected",
      actionCategory: "item",
      changeDetails: { reason },
    });

    return updated;
  }

  private async addItemToCart(
    item: AiProposalItem,
    clientId: string,
    proposalId: string,
    skipStatusUpdate: boolean = false
  ): Promise<{ success: boolean; cartItemId?: string; error?: string }> {
    try {
      let productCategory = "mutual_fund";
      if (item.assetClass?.toLowerCase().includes("bond")) {
        productCategory = "bond";
      } else if (item.assetClass?.toLowerCase().includes("ncd")) {
        productCategory = "ncd";
      } else if (item.assetClass?.toLowerCase().includes("unlisted")) {
        productCategory = "unlisted";
      }

      const cartItemData: any = {
        userId: clientId,
        productCategory,
        source: "ai",
        sourceProposalId: proposalId,
        amount: item.amount || undefined,
        displayName: item.schemeName,
        metadata: {
          proposalItemId: item.id,
          recommendationType: item.recommendationType,
          isin: item.isin,
          amcName: item.amcName,
          rationale: item.rationale,
        },
        status: "active",
      };

      if (productCategory === "mutual_fund" && item.isin) {
        cartItemData.mutualFundSchemeCode = item.isin;
      } else if (productCategory === "bond" && item.isin) {
        cartItemData.bondIsin = item.isin;
      }

      const [cartItem] = await db.insert(unifiedCartItems).values(cartItemData).returning();

      if (!skipStatusUpdate) {
        await db.update(aiProposalItems).set({
          status: "executed",
          executedAt: new Date(),
          cartItemId: cartItem.id,
          updatedAt: new Date(),
        }).where(eq(aiProposalItems.id, item.id));
      }

      return { success: true, cartItemId: cartItem.id };
    } catch (error: any) {
      console.error(`Failed to add proposal item ${item.id} to cart:`, error);
      return { success: false, error: error.message };
    }
  }

  private async markItemExecuted(
    itemId: string,
    cartItemIds: string[]
  ): Promise<void> {
    await db.update(aiProposalItems).set({
      status: "executed",
      executedAt: new Date(),
      cartItemId: cartItemIds.join(","),
      updatedAt: new Date(),
    }).where(eq(aiProposalItems.id, itemId));
  }

  private async rollbackCartItem(cartItemId: string): Promise<void> {
    try {
      await db.delete(unifiedCartItems).where(eq(unifiedCartItems.id, cartItemId));
    } catch (error) {
      console.error(`Failed to rollback cart item ${cartItemId}:`, error);
    }
  }

  private async addSwitchSellToCart(
    item: AiProposalItem,
    clientId: string,
    proposalId: string
  ): Promise<{ success: boolean; cartItemId?: string; error?: string }> {
    try {
      const cartItemData: any = {
        userId: clientId,
        productCategory: "mutual_fund",
        source: "ai",
        sourceProposalId: proposalId,
        amount: item.currentValue || item.amount || undefined,
        displayName: `SELL: ${item.switchFromSchemeName || "Switch Source Fund"}`,
        mutualFundSchemeCode: item.switchFromIsin || undefined,
        metadata: {
          proposalItemId: item.id,
          recommendationType: "SELL",
          isin: item.switchFromIsin,
          originalRecommendationType: "SWITCH",
          switchToSchemeName: item.schemeName,
          rationale: `Sell leg of switch recommendation: ${item.rationale}`,
        },
        status: "active",
      };

      const [cartItem] = await db.insert(unifiedCartItems).values(cartItemData).returning();
      return { success: true, cartItemId: cartItem.id };
    } catch (error: any) {
      console.error(`Failed to add switch sell leg for item ${item.id}:`, error);
      return { success: false, error: error.message };
    }
  }

  async finalizeProposalApproval(proposalId: string, clientId: string): Promise<AiProposal> {
    const items = await db.select().from(aiProposalItems).where(eq(aiProposalItems.proposalId, proposalId));
    
    const approvedItems = items.filter(i => i.status === "approved");
    const approvedCount = approvedItems.length;
    const rejectedCount = items.filter(i => i.status === "rejected").length;
    const totalCount = items.length;

    let finalStatus: string;
    if (approvedCount === totalCount) {
      finalStatus = "approved";
    } else if (rejectedCount === totalCount) {
      finalStatus = "rejected";
    } else if (approvedCount > 0) {
      finalStatus = "partially_approved";
    } else {
      finalStatus = "rejected";
    }

    const [proposal] = await db.select().from(aiProposals).where(eq(aiProposals.id, proposalId)).limit(1);
    
    // Add approved items to the unified cart with proper audit logging
    const cartItemsAdded: string[] = [];
    const failedItems: string[] = [];

    for (const item of approvedItems) {
      // Handle BUY items - add purchase to cart
      if (item.recommendationType === "BUY") {
        const result = await this.addItemToCart(item, clientId, proposalId);
        if (result.success && result.cartItemId) {
          cartItemsAdded.push(result.cartItemId);
        } else {
          failedItems.push(item.id);
        }
      }
      // Handle SWITCH items - add both sell (old fund) and buy (new fund) atomically
      else if (item.recommendationType === "SWITCH") {
        // Add BUY for the new fund (skip status update until both legs succeed)
        const buyResult = await this.addItemToCart(item, clientId, proposalId, true);
        if (!buyResult.success || !buyResult.cartItemId) {
          failedItems.push(item.id);
          continue;
        }

        // Add SELL for the switch-from fund (if specified)
        if (item.switchFromIsin || item.switchFromSchemeName) {
          const sellResult = await this.addSwitchSellToCart(item, clientId, proposalId);
          if (!sellResult.success || !sellResult.cartItemId) {
            // Rollback the BUY leg since SELL failed - atomic operation
            await this.rollbackCartItem(buyResult.cartItemId);
            failedItems.push(item.id);
            continue;
          }
          // Both legs succeeded - mark item as executed with both cart IDs
          await this.markItemExecuted(item.id, [buyResult.cartItemId, sellResult.cartItemId]);
          cartItemsAdded.push(buyResult.cartItemId, sellResult.cartItemId);
        } else {
          // No switch-from specified, just mark the BUY as executed
          await this.markItemExecuted(item.id, [buyResult.cartItemId]);
          cartItemsAdded.push(buyResult.cartItemId);
        }
      }
      // Handle SELL items
      else if (item.recommendationType === "SELL") {
        const result = await this.addItemToCart(item, clientId, proposalId);
        if (result.success && result.cartItemId) {
          cartItemsAdded.push(result.cartItemId);
        } else {
          failedItems.push(item.id);
        }
      }
    }

    // Log cart additions
    if (cartItemsAdded.length > 0) {
      await this.logAuditEntry({
        proposalId,
        actorId: clientId,
        actorRole: "client",
        action: "items_added_to_cart",
        actionCategory: "execution",
        newState: {
          cartItemIds: cartItemsAdded,
          itemCount: cartItemsAdded.length,
          failedCount: failedItems.length,
        },
      });
    }
    
    const [updated] = await db.update(aiProposals).set({
      status: finalStatus,
      clientDecision: finalStatus,
      clientDecisionAt: new Date(),
      disclaimerAcknowledged: true,
      disclaimerAcknowledgedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(aiProposals.id, proposalId)).returning();

    await this.logAuditEntry({
      proposalId,
      actorId: clientId,
      actorRole: "client",
      action: "proposal_finalized",
      actionCategory: "proposal",
      newState: { 
        status: finalStatus,
        approvedItems: approvedCount,
        rejectedItems: rejectedCount,
        cartItemsAdded: cartItemsAdded.length,
        cartItemIds: cartItemsAdded,
      },
    });

    return updated;
  }

  // T008: FIFO-based tax estimate using first_purchase_date from mf_holdings
  private async computeTaxEstimate(
    userId: string,
    isin: string | undefined,
    sellAmount: number,
  ): Promise<{ estimatedTax: number; taxType: string; taxRate: number; rationaleNote: string }> {
    const fallback = { estimatedTax: 0, taxType: 'No tax info', taxRate: 0, rationaleNote: '' };
    if (!isin || !sellAmount) return fallback;

    try {
      const [holding] = await db
        .select({
          firstPurchaseDate: mfHoldings.firstPurchaseDate,
          investedValue: mfHoldings.investedValue,
          currentValue: mfHoldings.currentValue,
          schemeCode: mfHoldings.schemeCode,
        })
        .from(mfHoldings)
        .where(and(eq(mfHoldings.userId, userId), eq(mfHoldings.isin, isin)))
        .limit(1);

      if (!holding?.firstPurchaseDate) return fallback;

      const purchaseDate = new Date(holding.firstPurchaseDate);
      const today = new Date();
      const daysHeld = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));

      // Determine if fund is equity or debt by looking up category
      let isEquity = true;
      try {
        const [fundInfo] = await db
          .select({ category: mutualFunds.category })
          .from(mutualFunds)
          .where(eq(mutualFunds.schemeCode, holding.schemeCode))
          .limit(1);
        if (fundInfo?.category) {
          isEquity = !fundInfo.category.toLowerCase().includes('debt') &&
                     !fundInfo.category.toLowerCase().includes('liquid') &&
                     !fundInfo.category.toLowerCase().includes('overnight') &&
                     !fundInfo.category.toLowerCase().includes('gilt');
        }
      } catch { /* keep default isEquity = true */ }

      const invested = parseFloat(holding.investedValue?.toString() || '0');
      const current = parseFloat(holding.currentValue?.toString() || '0');
      const gainPercent = invested > 0 ? (current - invested) / invested : 0;
      const estimatedGain = sellAmount * gainPercent;

      let taxRate = 0;
      let taxType = '';
      let rationaleNote = '';

      if (isEquity) {
        if (daysHeld > 365) {
          taxRate = 10; // LTCG — 10% above ₹1L
          taxType = 'LTCG (Equity)';
          rationaleNote = `Held ${Math.floor(daysHeld / 365)}y ${daysHeld % 365}d — qualifies for LTCG at 10% (above ₹1L exemption).`;
        } else {
          taxRate = 15; // STCG — 15%
          taxType = 'STCG (Equity)';
          rationaleNote = `Held only ${daysHeld} days — STCG at 15% applies. Consider waiting for LTCG threshold (${365 - daysHeld} more days).`;
        }
      } else {
        if (daysHeld > 365) {
          taxRate = 20; // LTCG — 20% with indexation (simplified)
          taxType = 'LTCG (Debt, with indexation)';
          rationaleNote = `Held ${Math.floor(daysHeld / 365)}y ${daysHeld % 365}d — LTCG at 20% with indexation benefit.`;
        } else {
          taxRate = 30; // STCG — added to slab income
          taxType = 'STCG (Debt, slab rate)';
          rationaleNote = `Held only ${daysHeld} days — STCG at income slab rate (~30%). Consider holding beyond 1 year for indexation benefit.`;
        }
      }

      const estimatedTax = Math.max(0, Math.round(estimatedGain * taxRate / 100));

      return { estimatedTax, taxType, taxRate, rationaleNote };
    } catch (err) {
      console.warn('[ProposalEngine] Tax estimate calculation failed:', err);
      return fallback;
    }
  }

  private async logAuditEntry(entry: Omit<InsertAiAuditLog, "timestamp">): Promise<void> {
    try {
      await db.insert(aiAuditLogs).values({
        ...entry,
        isRegulatorAuditable: true,
      } as any);
    } catch (error) {
      console.error("Failed to log audit entry:", error);
    }
  }

  async getAuditLogs(proposalId: string): Promise<any[]> {
    return db.select().from(aiAuditLogs).where(eq(aiAuditLogs.proposalId, proposalId)).orderBy(desc(aiAuditLogs.timestamp));
  }

  async getDiagnostics(diagnosticsId: string): Promise<PortfolioDiagnostics | null> {
    const [result] = await db.select().from(portfolioDiagnostics).where(eq(portfolioDiagnostics.id, diagnosticsId)).limit(1);
    return result || null;
  }

  async getLatestDiagnostics(userId: string): Promise<PortfolioDiagnostics | null> {
    const [result] = await db.select().from(portfolioDiagnostics).where(eq(portfolioDiagnostics.userId, userId)).orderBy(desc(portfolioDiagnostics.analysisDate)).limit(1);
    return result || null;
  }

  /**
   * Generate smart MF recommendations for proposals using AI MF service
   * This leverages the profit-maximization algorithm for fund selection
   */
  async getSmartMFRecommendationsForProposal(
    userId: string,
    investmentAmount: number
  ): Promise<RecommendationInput[]> {
    const riskProfile = await this.getOrCreateRiskProfile(userId);
    if (!riskProfile) return [];

    const riskCategory = riskProfile.riskCategory as 'conservative' | 'moderate' | 'aggressive';

    // Get AI-powered fund recommendations
    const aiRecommendations = await aiMFRecommendationService.getProposalRecommendations({
      riskCategory,
      investmentAmount
    });

    const allocations = {
      conservative: { equity: 0.20, debt: 0.60, hybrid: 0.15, commodity: 0.05 },
      moderate: { equity: 0.50, debt: 0.30, hybrid: 0.15, commodity: 0.05 },
      aggressive: { equity: 0.70, debt: 0.15, hybrid: 0.10, commodity: 0.05 }
    };
    const allocation = allocations[riskCategory];

    const recommendations: RecommendationInput[] = [];

    // Add equity fund recommendations
    for (const fund of aiRecommendations.equityFunds.slice(0, 3)) {
      const amount = Math.round(investmentAmount * allocation.equity / aiRecommendations.equityFunds.length);
      recommendations.push({
        type: "BUY",
        assetClass: "mutual_fund",
        productId: fund.schemeCode,
        schemeName: fund.schemeName,
        amcName: fund.fundHouse,
        amount,
        rationale: fund.rationale,
        problemIdentified: `Equity allocation at ${(allocation.equity * 100).toFixed(0)}% to achieve ${riskCategory} risk profile.`,
        riskInvolved: "Equity investments are subject to market volatility.",
        portfolioImpactSummary: `FintekPro Rating: ${'★'.repeat(fund.metrics.fintekproRating || 3)}. ${fund.metrics.cagr1Y ? `1Y Return: ${fund.metrics.cagr1Y.toFixed(1)}%` : ''}`,
        riskImpactPercent: `+${Math.round(fund.metrics.cagr1Y || 12)}%`,
        priority: 1
      });
    }

    // Add debt fund recommendations
    for (const fund of aiRecommendations.debtFunds.slice(0, 2)) {
      const amount = Math.round(investmentAmount * allocation.debt / aiRecommendations.debtFunds.length);
      recommendations.push({
        type: "BUY",
        assetClass: "mutual_fund",
        productId: fund.schemeCode,
        schemeName: fund.schemeName,
        amcName: fund.fundHouse,
        amount,
        rationale: fund.rationale,
        problemIdentified: `Debt allocation for capital preservation and stability.`,
        riskInvolved: "Debt funds carry interest rate and credit risk.",
        portfolioImpactSummary: `Low risk debt fund for portfolio balance.`,
        riskImpactPercent: `+${Math.round(fund.metrics.cagr1Y || 7)}%`,
        priority: 2
      });
    }

    // Add hybrid fund recommendations
    if (aiRecommendations.hybridFunds.length > 0) {
      const fund = aiRecommendations.hybridFunds[0];
      const amount = Math.round(investmentAmount * allocation.hybrid);
      recommendations.push({
        type: "BUY",
        assetClass: "mutual_fund",
        productId: fund.schemeCode,
        schemeName: fund.schemeName,
        amcName: fund.fundHouse,
        amount,
        rationale: fund.rationale,
        problemIdentified: `Hybrid allocation for balanced risk-return profile.`,
        riskInvolved: "Moderate risk with equity-debt mix.",
        portfolioImpactSummary: `Balanced fund for smoother returns.`,
        riskImpactPercent: `+${Math.round(fund.metrics.cagr1Y || 10)}%`,
        priority: 3
      });
    }

    // Add commodity (gold) fund for downside protection
    if (aiRecommendations.commodityFunds.length > 0) {
      const fund = aiRecommendations.commodityFunds[0];
      const amount = Math.round(investmentAmount * allocation.commodity);
      recommendations.push({
        type: "BUY",
        assetClass: "mutual_fund",
        productId: fund.schemeCode,
        schemeName: fund.schemeName,
        amcName: fund.fundHouse,
        amount,
        rationale: fund.rationale + " Provides downside protection during market volatility.",
        problemIdentified: `Gold/commodity allocation for portfolio protection.`,
        riskInvolved: "Commodity prices can be volatile.",
        portfolioImpactSummary: `5-10% allocation recommended for diversification.`,
        riskImpactPercent: `+${Math.round(fund.metrics.cagr1Y || 8)}%`,
        priority: 4
      });
    }

    return recommendations;
  }

  /**
   * Analyze user's MF portfolio using AI service
   */
  async analyzeUserMFPortfolio(userId: string) {
    // Get user's MF holdings
    const userHoldings = await db
      .select()
      .from(mfHoldings)
      .where(eq(mfHoldings.userId, userId));

    if (userHoldings.length === 0) {
      return {
        success: true,
        hasHoldings: false,
        message: "No mutual fund holdings found for analysis.",
        recommendations: await aiMFRecommendationService.getSmartRecommendations({})
      };
    }

    // Transform holdings for analysis
    const holdingsData = userHoldings.map(h => ({
      schemeCode: h.schemeCode || undefined,
      schemeName: h.schemeName || 'Unknown Fund',
      currentValue: parseFloat(h.currentValue?.toString() || '0'),
      units: parseFloat(h.units?.toString() || '0'),
      category: undefined,
      fundHouse: undefined
    }));

    // Run AI analysis
    const analysis = await aiMFRecommendationService.analyzePortfolioHoldings(holdingsData);

    return {
      success: true,
      hasHoldings: true,
      ...analysis
    };
  }
}

export const aiProposalEngine = new AIProposalEngine();
