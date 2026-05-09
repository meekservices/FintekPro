import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  prospectProposals,
  prospectProposalEvents,
  onboardingInvitations,
  users,
  customerCareAgents,
  mutualFunds,
  mutualFundMetrics,
  corporateBonds,
  aifMaster,
  pmsMaster,
  mldMaster,
  listedStocks,
  aiRecommendationTracking
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { aiRecommendationTrackingService } from "../services/ai-recommendation-tracking-service";
import { unifiedAIRecommendationEngine } from "../services/unified-ai-recommendation-engine";
import { riskSuitabilityEngine } from "../services/risk-suitability-engine";
import { returnForecastingEngine } from "../services/return-forecasting-engine";
import {
  resolveAgentName, getStoreEligibleMutualFunds, getStoreEligibleBonds, getStoreEligibleAIFs, getStoreEligiblePMS, getStoreEligibleMLDs, getStoreEligibleStocks, getExitLoadFromMetadata, deriveValuationMetrics, generateAIEnhancedRationale, generateAnalyticalRationale, buildMFRationale, buildStockRationale, buildPMSRationale, buildAIFRationale, buildDefaultRationale, calculateCapitalGainsTax, buildDynamicRecommendations
} from "./prospect-proposals-helpers";

const router = Router();
router.patch("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const updateData: any = { updatedAt: new Date() };
    const {
      prospectName, prospectEmail, prospectMobile, prospectPan,
      proposalTitle, executiveSummary, currentAnalysis,
      recommendations, totalInvestmentAmount, projectedReturns,
      projectedValue, targetAllocation, samplePortfolio, investmentGoals,
    } = req.body;

    if (prospectName !== undefined)        updateData.prospectName        = prospectName;
    if (prospectEmail !== undefined)       updateData.prospectEmail       = prospectEmail;
    if (prospectMobile !== undefined)      updateData.prospectMobile      = prospectMobile;
    if (prospectPan !== undefined)         updateData.prospectPan         = prospectPan;
    if (proposalTitle !== undefined)       updateData.proposalTitle       = proposalTitle;
    if (executiveSummary !== undefined)    updateData.executiveSummary    = executiveSummary;
    if (currentAnalysis !== undefined)     updateData.currentAnalysis     = currentAnalysis;
    if (recommendations !== undefined)    updateData.recommendations     = recommendations;
    if (totalInvestmentAmount !== undefined) updateData.totalInvestmentAmount = totalInvestmentAmount?.toString();
    if (projectedReturns !== undefined)   updateData.projectedReturns    = projectedReturns?.toString();
    if (projectedValue !== undefined)     updateData.projectedValue      = projectedValue?.toString();
    if (targetAllocation !== undefined)   updateData.targetAllocation    = targetAllocation;
    if (samplePortfolio !== undefined)    updateData.samplePortfolio     = samplePortfolio;
    if (investmentGoals !== undefined)    updateData.investmentGoals     = investmentGoals;

    const [updated] = await db.update(prospectProposals)
      .set(updateData)
      .where(eq(prospectProposals.id, req.params.id))
      .returning();

    res.json({ success: true, proposal: updated });
  } catch (error: any) {
    console.error("Update prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to update proposal" });
  }
});

// Share proposal (mark as shared and optionally send notifications)

export default router;
