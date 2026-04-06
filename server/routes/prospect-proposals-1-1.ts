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
  resolveAgentName, getStoreEligibleMutualFunds, getStoreEligibleBonds, getStoreEligibleAIFs, getStoreEligiblePMS, getStoreEligibleMLDs, getStoreEligibleStocks, getExitLoadFromMetadata, deriveValuationMetrics, generateAIEnhancedRationale, generateAnalyticalRationale, buildMFRationale, buildStockRationale, buildPMSRationale, buildAIFRationale, buildDefaultRationale, calculateCapitalGainsTax, buildDynamicRecommendations,
  generateShareToken, generateReferralCode, logProposalEvent, trackProposalRecommendations
} from "./prospect-proposals-helpers";

const router = Router();
router.post("/api/agent/prospect-proposals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      prospectName,
      prospectEmail,
      prospectMobile,
      prospectPan,
      proposalType,
      clientType,
      samplePortfolio,
      investmentGoals,
      proposalTitle,
      executiveSummary,
      currentAnalysis,
      recommendations,
      totalInvestmentAmount,
      projectedReturns,
      projectedValue,
      targetAllocation,
      validUntil,
    } = req.body;

    if (!prospectName || !proposalType || !proposalTitle) {
      return res.status(400).json({ error: "Prospect name, proposal type, and title are required" });
    }

    if (proposalType === 'sample_portfolio' && !samplePortfolio) {
      return res.status(400).json({ error: "Sample portfolio data is required for portfolio analysis" });
    }

    if (proposalType === 'fresh_investment' && !investmentGoals) {
      return res.status(400).json({ error: "Investment goals are required for fresh investment proposals" });
    }

    const shareToken = generateShareToken();
    const referralCode = generateReferralCode();

    // Create linked onboarding invitation and proposal in a transaction
    const expiresAt = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [invitation] = await tx.insert(onboardingInvitations).values({
        referralCode,
        inviterId: user.id,
        inviterType: "agent",
        inviterName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
        clientEmail: prospectEmail,
        clientMobile: prospectMobile,
        clientName: prospectName,
        suggestedMode: "smart",
        status: "pending",
        expiresAt,
        notes: `Created via prospect proposal: ${proposalTitle}`,
      }).returning();

      const [proposal] = await tx.insert(prospectProposals).values({
        shareToken,
        agentId: user.id,
        agentName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (user.email?.split('@')[0] || user.email || null),
        agentArnCode: user.arnCode || null,
        agentMobile: user.mobile || null,
        agentEmail: user.email || null,
        prospectName,
        prospectEmail,
        prospectMobile,
        prospectPan: prospectPan || null,
        proposalType,
        clientType: clientType || 'individual',
        samplePortfolio: samplePortfolio || null,
        investmentGoals: investmentGoals || null,
        proposalTitle,
        executiveSummary,
        currentAnalysis,
        recommendations: recommendations || [],
        totalInvestmentAmount: totalInvestmentAmount?.toString(),
        projectedReturns: projectedReturns?.toString(),
        projectedValue: projectedValue?.toString(),
        targetAllocation: targetAllocation || null,
        invitationId: invitation.id,
        referralCode,
        status: "draft",
        validUntil: expiresAt,
      }).returning();

      return { invitation, proposal };
    });

    const { invitation, proposal } = result;

    await logProposalEvent(proposal.id, "created", {
      proposalType,
      prospectName,
      prospectEmail,
    }, req.ip, req.headers["user-agent"] as string);

    // Track AI recommendations for analytics
    if (recommendations && Array.isArray(recommendations) && recommendations.length > 0) {
      trackProposalRecommendations(proposal.id, user.id, recommendations, prospectName)
        .catch(err => console.error("[AI Tracking] Background tracking failed:", err));
    }

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      success: true,
      proposal,
      invitation,
      shareableLink: `${baseUrl}/proposal/${shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${referralCode}`,
    });
  } catch (error: any) {
    console.error("Create prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to create proposal" });
  }
});

// List agent's prospect proposals

export default router;
