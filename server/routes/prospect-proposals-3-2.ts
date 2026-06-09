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
	aiRecommendationTracking,
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { aiRecommendationTrackingService } from "../services/ai-recommendation-tracking-service";
import { unifiedAIRecommendationEngine } from "../services/unified-ai-recommendation-engine";
import { riskSuitabilityEngine } from "../services/risk-suitability-engine";
import { returnForecastingEngine } from "../services/return-forecasting-engine";
import {
	resolveAgentName,
	getStoreEligibleMutualFunds,
	getStoreEligibleBonds,
	getStoreEligibleAIFs,
	getStoreEligiblePMS,
	getStoreEligibleMLDs,
	getStoreEligibleStocks,
	getExitLoadFromMetadata,
	deriveValuationMetrics,
	generateAIEnhancedRationale,
	generateAnalyticalRationale,
	buildMFRationale,
	buildStockRationale,
	buildPMSRationale,
	buildAIFRationale,
	buildDefaultRationale,
	calculateCapitalGainsTax,
	buildDynamicRecommendations,
	logProposalEvent,
} from "./prospect-proposals-helpers";

const router = Router();
router.get(
	"/api/public/proposal/:shareToken",
	async (req: Request, res: Response) => {
		try {
			const [proposal] = await db
				.select()
				.from(prospectProposals)
				.where(eq(prospectProposals.shareToken, req.params.shareToken));

			if (!proposal) {
				return res.status(404).json({ error: "Proposal not found or expired" });
			}

			// Check if expired
			if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
				return res.status(410).json({ error: "This proposal has expired" });
			}

			// Update view count and status
			const isFirstView = !proposal.firstViewedAt;
			await db
				.update(prospectProposals)
				.set({
					viewCount: (proposal.viewCount || 0) + 1,
					lastViewedAt: new Date(),
					firstViewedAt: isFirstView ? new Date() : proposal.firstViewedAt,
					status: proposal.status === "draft" ? "viewed" : proposal.status,
					updatedAt: new Date(),
				})
				.where(eq(prospectProposals.id, proposal.id));

			await logProposalEvent(
				proposal.id,
				"viewed",
				{ viewCount: (proposal.viewCount || 0) + 1, isFirstView },
				req.ip,
				req.headers["user-agent"] as string,
				req.headers.referer as string,
			);

			const baseUrl = process.env.REPLIT_DEV_DOMAIN
				? `https://${process.env.REPLIT_DEV_DOMAIN}`
				: process.env.REPL_SLUG
					? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
					: "";

			res.json({
				proposal: {
					id: proposal.id,
					proposalType: proposal.proposalType,
					proposalTitle: proposal.proposalTitle,
					executiveSummary: proposal.executiveSummary,
					currentAnalysis: proposal.currentAnalysis,
					recommendations: proposal.recommendations,
					totalInvestmentAmount: proposal.totalInvestmentAmount,
					projectedReturns: proposal.projectedReturns,
					projectedValue: proposal.projectedValue,
					targetAllocation: proposal.targetAllocation,
					samplePortfolio: proposal.samplePortfolio,
					investmentGoals: proposal.investmentGoals,
					agentName:
						proposal.agentName ||
						(await resolveAgentName(proposal.agentId, proposal.agentEmail)),
					agentMobile: proposal.agentMobile,
					agentEmail: proposal.agentEmail,
					validUntil: proposal.validUntil,
					createdAt: proposal.createdAt,
					proposalSections: proposal.proposalSections,
					analyticsData: proposal.analyticsData,
				},
				onboardingLink: `${baseUrl}/onboarding?ref=${proposal.referralCode}`,
			});
		} catch (error: any) {
			console.error("Get public proposal error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to load proposal" });
		}
	},
);

// Track onboarding click from proposal

export default router;
