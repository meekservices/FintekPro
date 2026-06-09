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
router.post(
	"/api/public/proposal/:shareToken/onboarding-click",
	async (req: Request, res: Response) => {
		try {
			const [proposal] = await db
				.select()
				.from(prospectProposals)
				.where(eq(prospectProposals.shareToken, req.params.shareToken));

			if (!proposal) {
				return res.status(404).json({ error: "Proposal not found" });
			}

			await logProposalEvent(
				proposal.id,
				"onboarding_started",
				{},
				req.ip,
				req.headers["user-agent"] as string,
				req.headers.referer as string,
			);

			// Update invitation status
			if (proposal.invitationId) {
				await db
					.update(onboardingInvitations)
					.set({
						status: "started",
						onboardingStartedAt: new Date(),
						lastActivityAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(onboardingInvitations.id, proposal.invitationId));
			}

			res.json({ success: true });
		} catch (error: any) {
			console.error("Track onboarding click error:", error);
			res.status(500).json({ error: error.message || "Failed to track click" });
		}
	},
);

// ============ AI PROPOSAL GENERATION ============

// Generate AI analysis for existing portfolio holdings
async function generateExistingPortfolioAnalysis(
	prospectPan?: string,
	prospectEmail?: string,
	samplePortfolio?: any,
): Promise<{
	holdings: any[];
	summary: {
		totalValue: number;
		totalHoldings: number;
		buyCount: number;
		holdCount: number;
		sellCount: number;
		switchCount: number;
	};
	analysisNote: string;
} | null> {
	try {
		let existingHoldings: any[] = [];
		let dataSource = "none";

		// Use sample portfolio holdings if provided
		if (samplePortfolio?.holdings?.length > 0) {
			existingHoldings = samplePortfolio.holdings.map(
				(h: any, idx: number) => ({
					id: `sample-${idx}`,
					name: h.name || `Holding ${idx + 1}`,
					type: h.type || "mutual_fund",
					currentValue: h.currentValue || 0,
					investedAmount: h.investedAmount || h.currentValue * 0.9,
					returns1Y: h.returns1Y || h.returns1y || 10,
					returns3Y: h.returns3Y || h.returns3y || 8,
					category: h.category,
					holdingDays: h.holdingDays || 365,
					quantity: h.quantity,
					currentPrice: h.currentPrice,
				}),
			);
			dataSource = "sample_portfolio";
		}

		if (existingHoldings.length === 0) {
			return null;
		}

		// Generate AI recommendations for each holding
		const analyzedHoldings = existingHoldings.map((holding) => {
			const returns1Y = holding.returns1Y || 0;
			const returns3Y = holding.returns3Y || returns1Y * 0.9;
			const investedAmount = holding.investedAmount || holding.currentValue;
			const currentValue = holding.currentValue;
			const gainLoss = currentValue - investedAmount;
			const gainLossPercent =
				investedAmount > 0
					? ((currentValue - investedAmount) / investedAmount) * 100
					: 0;

			// Derive recommendation type based on performance metrics
			let recommendationType: "BUY" | "SELL" | "HOLD" | "SWITCH" = "HOLD";

			// Benchmark returns by product type
			const benchmarkReturn =
				holding.type === "bond" || holding.type === "debt"
					? 7
					: holding.type === "stock"
						? 12
						: 10;

			const outperforming = returns1Y > benchmarkReturn + 2;
			const underperforming = returns1Y < benchmarkReturn - 5;
			const significantLoss = gainLossPercent < -15;
			const moderateLoss = gainLossPercent < -5 && gainLossPercent >= -15;
			const strongGain = gainLossPercent > 25;

			const isMutualFund =
				holding.type === "mutual_fund" || holding.type === "mf";

			if (underperforming && significantLoss) {
				recommendationType = "SELL";
			} else if (underperforming && moderateLoss) {
				recommendationType = isMutualFund ? "SWITCH" : "SELL";
			} else if (outperforming && strongGain) {
				recommendationType = "BUY";
			} else if (outperforming) {
				recommendationType = "HOLD";
			} else if (returns1Y >= benchmarkReturn - 2) {
				recommendationType = "HOLD";
			} else {
				recommendationType = isMutualFund ? "SWITCH" : "SELL";
			}

			// Create a product-like object for generateAnalyticalRationale
			const product = {
				schemeName: holding.name,
				name: holding.name,
				category: holding.category,
				returns1y: returns1Y,
				returns3y: returns3Y,
				standardDeviation: 15,
				ter: 1.5,
				categoryRank: holding.categoryRank,
				exitLoad: holding.exitLoad,
			};

			// Generate analytical data using existing function with correct recommendation type
			const analyticalData = generateAnalyticalRationale(
				product,
				holding.type,
				recommendationType,
			);

			return {
				...holding,
				gainLoss,
				gainLossPercent,
				recommendationType,
				...analyticalData,
			};
		});

		// Calculate summary
		const summary = {
			totalValue: analyzedHoldings.reduce((sum, h) => sum + h.currentValue, 0),
			totalHoldings: analyzedHoldings.length,
			buyCount: analyzedHoldings.filter((h) => h.recommendationType === "BUY")
				.length,
			holdCount: analyzedHoldings.filter((h) => h.recommendationType === "HOLD")
				.length,
			sellCount: analyzedHoldings.filter((h) => h.recommendationType === "SELL")
				.length,
			switchCount: analyzedHoldings.filter(
				(h) => h.recommendationType === "SWITCH",
			).length,
		};

		const analysisNote = `AI analysis of ${analyzedHoldings.length} existing holdings with BUY/HOLD/SELL/SWITCH recommendations.`;

		return {
			holdings: analyzedHoldings,
			summary,
			analysisNote,
		};
	} catch (error) {
		console.error("Error generating existing portfolio analysis:", error);
		return null;
	}
}

// Generate AI recommendations based on input

export default router;
