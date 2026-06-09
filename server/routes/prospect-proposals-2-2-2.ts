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
interface AuthRequest extends Request {
	user?: {
		id: string;
		email?: string;
	};
}

interface ProposalUpdate {
	status: string;
	updatedAt: Date;
	sharedViaEmail?: boolean;
	emailSentAt?: Date;
	sharedViaWhatsApp?: boolean;
	whatsappSentAt?: Date;
}

router.post(
	"/api/agent/prospect-proposals/:id/share",
	async (req: Request, res: Response): Promise<void> => {
		try {
			const user = (req as AuthRequest).user;
			if (!user) {
				res.status(401).json({ error: "Unauthorized" });
				return;
			}

			const { shareVia } = req.body; // 'email' | 'whatsapp' | 'both'

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
				res.status(404).json({ error: "Proposal not found" });
				return;
			}

			const updateData: ProposalUpdate = {
				status: "shared",
				updatedAt: new Date(),
			};

			if (shareVia === "email" || shareVia === "both") {
				updateData.sharedViaEmail = true;
				updateData.emailSentAt = new Date();
				await logProposalEvent(
					existing.id,
					"shared_email",
					{ prospectEmail: existing.prospectEmail },
					req.ip || "",
					req.headers["user-agent"] as string,
				);
			}

			if (shareVia === "whatsapp" || shareVia === "both") {
				updateData.sharedViaWhatsApp = true;
				updateData.whatsappSentAt = new Date();
				await logProposalEvent(
					existing.id,
					"shared_whatsapp",
					{ prospectMobile: existing.prospectMobile },
					req.ip || "",
					req.headers["user-agent"] as string,
				);
			}

			const [updated] = await db
				.update(prospectProposals)
				.set(updateData)
				.where(eq(prospectProposals.id, req.params.id))
				.returning();

			const baseUrl = process.env.REPLIT_DEV_DOMAIN
				? `https://${process.env.REPLIT_DEV_DOMAIN}`
				: process.env.REPL_SLUG
					? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
					: "";

			res.json({
				success: true,
				proposal: updated,
				shareableLink: `${baseUrl}/proposal/${existing.shareToken}`,
				onboardingLink: `${baseUrl}/onboarding?ref=${existing.referralCode}`,
			});
		} catch (error: unknown) {
			console.error("Share proposal error:", error);
			const msg =
				error instanceof Error ? error.message : "Failed to share proposal";
			res.status(500).json({ error: msg });
		}
	},
);

// Delete proposal

export default router;
