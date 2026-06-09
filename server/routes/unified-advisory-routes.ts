/**
 * Unified AI Advisory Engine API Routes
 *
 * Agent Portal routes for multi-product advisory
 */

import { Router, Request, Response } from "express";
import { unifiedAdvisoryService } from "../services/unified-advisory-service";
import { ProductType } from "@shared/unified-advisory-types";

const router = Router();

router.get("/eligibility/:clientId", async (req: Request, res: Response) => {
	try {
		const { clientId } = req.params;

		const validation =
			await unifiedAdvisoryService.validateTriggerConditions(clientId);

		// Short-circuit if client not found
		if (validation.missingConditions.includes("Client not found")) {
			return res.status(404).json({
				success: false,
				error: "Client not found",
				canProceed: false,
				missingConditions: validation.missingConditions,
				blockerReasons: validation.blockerReasons,
			});
		}
		const eligibility =
			await unifiedAdvisoryService.getEligibleProducts(clientId);
		const profile = await unifiedAdvisoryService.getClientProfile(clientId);

		res.json({
			success: true,
			canProceed: validation.canProceed,
			missingConditions: validation.missingConditions,
			blockerReasons: validation.blockerReasons,
			eligibleProducts: eligibility.eligible,
			ineligibleProducts: eligibility.ineligible,
			clientProfile: profile
				? {
						riskCategory: profile.riskCategory,
						clientCategory: profile.clientCategory,
						investmentHorizon: profile.investmentHorizon,
						netWorth: profile.netWorth,
					}
				: null,
		});
	} catch (error: any) {
		console.error("[Unified Advisory] Eligibility check failed:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to check eligibility",
		});
	}
});

router.get("/portfolio/:clientId", async (req: Request, res: Response) => {
	try {
		const { clientId } = req.params;
		const portfolio =
			await unifiedAdvisoryService.getPortfolioSummary(clientId);

		if (!portfolio) {
			return res.json({
				success: true,
				portfolio: null,
				message: "No portfolio found for this client",
			});
		}

		res.json({
			success: true,
			portfolio,
		});
	} catch (error: any) {
		console.error("[Unified Advisory] Portfolio fetch failed:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch portfolio",
		});
	}
});

router.post(
	"/recommendations/:clientId",
	async (req: Request, res: Response) => {
		try {
			const { clientId } = req.params;
			const { productTypes, count, agentId } = req.body;

			if (
				!productTypes ||
				!Array.isArray(productTypes) ||
				productTypes.length === 0
			) {
				return res.status(400).json({
					success: false,
					error: "productTypes array is required",
				});
			}

			const validProductTypes = productTypes.filter((p): p is ProductType =>
				[
					"STOCK",
					"MF",
					"BOND",
					"UNLISTED",
					"MLD",
					"PMS",
					"AIF",
					"CFD",
					"TREASURY",
				].includes(p),
			);

			if (validProductTypes.length === 0) {
				return res.status(400).json({
					success: false,
					error: "No valid product types provided",
				});
			}

			const recommendations =
				await unifiedAdvisoryService.generateRecommendations(
					clientId,
					validProductTypes,
					{ count: count || 5, agentId: agentId || "system" },
				);

			res.json({
				success: true,
				recommendations,
				count: recommendations.length,
				generatedAt: new Date().toISOString(),
			});
		} catch (error: any) {
			console.error(
				"[Unified Advisory] Recommendation generation failed:",
				error,
			);
			res.status(500).json({
				success: false,
				error: error.message || "Failed to generate recommendations",
			});
		}
	},
);

router.get("/disclosures/:productType", async (req: Request, res: Response) => {
	try {
		const { productType } = req.params;

		const validTypes: ProductType[] = [
			"STOCK",
			"MF",
			"BOND",
			"UNLISTED",
			"MLD",
			"PMS",
			"AIF",
			"CFD",
			"TREASURY",
		];

		if (!validTypes.includes(productType as ProductType)) {
			return res.status(400).json({
				success: false,
				error: "Invalid product type",
			});
		}

		const disclosures = unifiedAdvisoryService.getDisclosuresForProduct(
			productType as ProductType,
		);
		const executionChannel = unifiedAdvisoryService.getExecutionChannel(
			productType as ProductType,
		);

		res.json({
			success: true,
			productType,
			disclosures,
			executionChannel,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch disclosures",
		});
	}
});

router.post("/approve/:decisionId", async (req: Request, res: Response) => {
	try {
		const { decisionId } = req.params;
		const { clientId, agentId } = req.body;

		if (!clientId || !agentId) {
			return res.status(400).json({
				success: false,
				error: "clientId and agentId are required",
			});
		}

		const result = await unifiedAdvisoryService.approveRecommendation(
			decisionId,
			clientId,
			agentId,
		);

		res.json({
			success: result,
			message: result ? "Recommendation approved" : "Approval failed",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || "Failed to approve recommendation",
		});
	}
});

router.post("/reject/:decisionId", async (req: Request, res: Response) => {
	try {
		const { decisionId } = req.params;
		const { clientId, agentId, reason } = req.body;

		if (!clientId || !agentId) {
			return res.status(400).json({
				success: false,
				error: "clientId and agentId are required",
			});
		}

		const result = await unifiedAdvisoryService.rejectRecommendation(
			decisionId,
			clientId,
			reason || "Client declined",
			agentId,
		);

		res.json({
			success: result,
			message: result ? "Recommendation rejected" : "Rejection failed",
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || "Failed to reject recommendation",
		});
	}
});

router.post("/create-proposal", async (req: Request, res: Response) => {
	try {
		const { clientId, agentId, decisions } = req.body;

		if (!clientId || !agentId || !decisions || !Array.isArray(decisions)) {
			return res.status(400).json({
				success: false,
				error: "clientId, agentId, and decisions array are required",
			});
		}

		const result =
			await unifiedAdvisoryService.createProposalFromRecommendations(
				clientId,
				agentId,
				decisions,
			);

		res.json({
			success: result.success,
			proposalId: result.proposalId,
			message: "Investment proposal created successfully",
		});
	} catch (error: any) {
		console.error("[Unified Advisory] Proposal creation failed:", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to create proposal",
		});
	}
});

router.get("/audit-trail/:clientId", async (req: Request, res: Response) => {
	try {
		const { clientId } = req.params;
		const limit = Number.parseInt(req.query.limit as string) || 50;

		const auditTrail = await unifiedAdvisoryService.getAuditTrail(
			clientId,
			limit,
		);

		res.json({
			success: true,
			auditTrail,
			count: auditTrail.length,
		});
	} catch (error: any) {
		res.status(500).json({
			success: false,
			error: error.message || "Failed to fetch audit trail",
		});
	}
});

router.get(
	"/execution-channel/:productType",
	async (req: Request, res: Response) => {
		try {
			const { productType } = req.params;

			const validTypes: ProductType[] = [
				"STOCK",
				"MF",
				"BOND",
				"UNLISTED",
				"MLD",
				"PMS",
				"AIF",
				"CFD",
				"TREASURY",
			];

			if (!validTypes.includes(productType as ProductType)) {
				return res.status(400).json({
					success: false,
					error: "Invalid product type",
				});
			}

			const channel = unifiedAdvisoryService.getExecutionChannel(
				productType as ProductType,
			);

			const channelInfo = {
				API: {
					name: "Direct Execution",
					description: "Order executed directly via trading APIs",
					automated: true,
				},
				WORKFLOW: {
					name: "Application Workflow",
					description: "Application submitted for processing",
					automated: false,
				},
				ESCROW: {
					name: "Escrow/Partner",
					description: "Manual escrow arrangement via partner",
					automated: false,
				},
				REDIRECT: {
					name: "Offshore Broker",
					description: "Redirected to offshore broker platform",
					automated: false,
				},
			};

			res.json({
				success: true,
				productType,
				channel,
				channelDetails: channelInfo[channel],
			});
		} catch (error: any) {
			res.status(500).json({
				success: false,
				error: error.message || "Failed to get execution channel",
			});
		}
	},
);

export default router;
