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
router.delete(
	"/api/agent/prospect-proposals/:id",
	async (req: Request, res: Response) => {
		try {
			const user = req.user as any;
			if (!user) {
				return res.status(401).json({ error: "Unauthorized" });
			}

			const [existing] = await db
				.select()
				.from(prospectProposals)
				.where(
					and(
						eq(prospectProposals.id, req.params.id),
						eq(prospectProposals.agentId, user.id),
					),
				);

			if (!existing) {
				return res.status(404).json({ error: "Proposal not found" });
			}

			// Delete events first
			await db
				.delete(prospectProposalEvents)
				.where(eq(prospectProposalEvents.proposalId, existing.id));

			// Delete proposal
			await db
				.delete(prospectProposals)
				.where(eq(prospectProposals.id, existing.id));

			res.json({ success: true });
		} catch (error: any) {
			console.error("Delete proposal error:", error);
			res
				.status(500)
				.json({ error: error.message || "Failed to delete proposal" });
		}
	},
);

// ============ PUBLIC ROUTES (for prospects) ============

// Get proposal by share token (public view)

export default router;
