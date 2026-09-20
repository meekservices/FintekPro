/**
 * @file fasp-advisory-routes.ts
 * @description API Routes for FASP Grounded Research & Advisory Insights.
 *
 * Exposes:
 *   POST /api/advisory/grounded-insights  - Generate grounded thesis & compliance checks
 *   GET  /api/advisory/disclaimers        - Retrieve official SEBI regulatory disclaimers
 *
 * @sebi SEBI/HO/IMD/2023/P/CIR/0188
 */

import { Router, type Request, type Response } from "express";
import { faspGroundingService, SEBI_MANDATORY_DISCLAIMERS } from "../services/fasp-grounding-service";
import { logger } from "../logger";

export const faspAdvisoryRouter = Router();

/**
 * POST /api/advisory/grounded-insights
 * Generates a grounded, SEBI-compliant research thesis for any stock or mutual fund.
 */
faspAdvisoryRouter.post("/grounded-insights", async (req: Request, res: Response) => {
	const t0 = Date.now();
	try {
		const {
			identifier,
			name,
			assetType,
			category,
			userSegment,
			riskProfile,
			investmentHorizon,
			quantitativeFactors,
		} = req.body;

		if (!identifier || !name || !assetType) {
			return res.status(400).json({
				success: false,
				error_code: "INVALID_REQUEST",
				message: "Fields 'identifier', 'name', and 'assetType' are required.",
				retryable: false,
			});
		}

		const result = await faspGroundingService.generateGroundedThesis({
			identifier: String(identifier),
			name: String(name),
			assetType,
			category: category ? String(category) : undefined,
			userSegment: userSegment || "retail",
			riskProfile: riskProfile || "moderate",
			investmentHorizon: investmentHorizon || "long_term",
			quantitativeFactors: typeof quantitativeFactors === "object" && quantitativeFactors !== null ? quantitativeFactors : {},
			userId: (req as any).user?.id ? String((req as any).user.id) : undefined,
		});

		return res.json({
			success: true,
			data: result,
			meta: {
				timestamp: new Date().toISOString(),
				latency_ms: Date.now() - t0,
				version: "FASP-AI-v2.0-GROUNDED",
			},
		});
	} catch (error: any) {
		logger.error("[FaspAdvisoryRouter] Failed to generate grounded insights", {
			error: error?.message,
			latency_ms: Date.now() - t0,
		});

		return res.status(500).json({
			success: false,
			error_code: "ADVISORY_GENERATION_FAILED",
			message: "Failed to generate grounded advisory thesis. Please retry.",
			retryable: true,
		});
	}
});

/**
 * GET /api/advisory/disclaimers
 * Returns the current SEBI regulatory disclaimer catalog.
 */
faspAdvisoryRouter.get("/disclaimers", (_req: Request, res: Response) => {
	return res.json({
		success: true,
		data: {
			disclaimers: SEBI_MANDATORY_DISCLAIMERS,
			framework: "FASP-AI v2.0 (SEBI Decision-Support Only)",
		},
		meta: {
			timestamp: new Date().toISOString(),
			version: "FASP-AI-v2.0",
		},
	});
});
