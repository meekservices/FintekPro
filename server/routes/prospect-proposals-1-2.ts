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
router.get("/api/agent/prospect-proposals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, search } = req.query;

    let whereConditions = [eq(prospectProposals.agentId, user.id)];
    
    if (status && status !== 'all') {
      whereConditions.push(eq(prospectProposals.status, status as string));
    }

    const proposals = await db.select()
      .from(prospectProposals)
      .where(and(...whereConditions))
      .orderBy(desc(prospectProposals.createdAt));

    // Filter by search if provided
    let filteredProposals = proposals;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredProposals = proposals.filter(p => 
        p.prospectName?.toLowerCase().includes(searchLower) ||
        p.prospectEmail?.toLowerCase().includes(searchLower) ||
        p.proposalTitle?.toLowerCase().includes(searchLower)
      );
    }

    // Get stats
    const stats = {
      total: proposals.length,
      draft: proposals.filter(p => p.status === 'draft').length,
      shared: proposals.filter(p => p.status === 'shared').length,
      viewed: proposals.filter(p => p.status === 'viewed').length,
      converted: proposals.filter(p => p.status === 'converted').length,
      totalViews: proposals.reduce((sum, p) => sum + (p.viewCount || 0), 0),
    };

    res.json({ proposals: filteredProposals, stats });
  } catch (error: any) {
    console.error("List prospect proposals error:", error);
    res.status(500).json({ error: error.message || "Failed to list proposals" });
  }
});

// Get single proposal (agent view)


export default router;
