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
	bondCatalog,
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
} from "./prospect-proposals-helpers";

const router = Router();
router.get(
	"/api/agent/prospect-proposals/:id",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const [proposal] = await db
				.select()
				.from(prospectProposals)
				.where(
					and(
						eq(prospectProposals.id, req.params.id),
						eq(prospectProposals.agentId, user.id),
					),
				);

			if (!proposal) {
				return res.status(404).json({ error: "Proposal not found" });
			}

			// Get events
			const events = await db
				.select()
				.from(prospectProposalEvents)
				.where(eq(prospectProposalEvents.proposalId, proposal.id))
				.orderBy(desc(prospectProposalEvents.timestamp));

			const baseUrl = process.env.REPLIT_DEV_DOMAIN
				? `https://${process.env.REPLIT_DEV_DOMAIN}`
				: process.env.REPL_SLUG
					? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
					: "";

			res.json({
				proposal,
				events,
				shareableLink: `${baseUrl}/proposal/${proposal.shareToken}`,
				onboardingLink: `${baseUrl}/onboarding?ref=${proposal.referralCode}`,
			});
		} catch (error: any) {
			console.error("Get prospect proposal error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to get proposal" });
		}
	},
);

// Update proposal

export default router;
