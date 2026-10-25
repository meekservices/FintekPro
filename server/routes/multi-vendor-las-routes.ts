/**
 * Multi-Vendor LAS/LAMF Routes — IRIS & Smallcase Gateway
 *
 * REST API surface for comparing, selecting, and processing loans against securities
 * across both IRIS (Mutual Funds direct RTA) and Smallcase (Demat Equities & Shares).
 *
 * Endpoints:
 *   GET  /api/las/providers               → List active LAS vendors & policies
 *   GET  /api/las/compare/:pan            → Comparative quote & combined borrowing cap
 *   POST /api/smallcase/las/eligibility   → Smallcase demat eligibility check
 *   POST /api/smallcase/las/transaction   → Create Smallcase Lending Gateway transaction
 *
 * @module multi-vendor-las-routes
 */

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../auth-setup";
import { multiVendorLasService } from "../services/multi-vendor-las-service";
import { smallcaseLasService } from "../services/smallcase-las-service";
import { logger } from "../logger";

const panSchema = z
	.string()
	.regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format");

export function registerMultiVendorLasRoutes(app: Express): void {
	/**
	 * GET /api/las/providers
	 * List all active LAS providers (IRIS, Smallcase) and their lending parameters.
	 */
	app.get("/api/las/providers", (req: Request, res: Response) => {
		const providers = multiVendorLasService.getProviders();
		res.json({
			success: true,
			data: providers,
			meta: {
				timestamp: new Date().toISOString(),
				version: "multi-las-v2.0",
				totalProviders: providers.length,
			},
		});
	});

	/**
	 * GET /api/las/compare/:pan
	 * Side-by-side quote comparison between IRIS and Smallcase.
	 */
	app.get("/api/las/compare/:pan", isAuthenticated, async (req: Request, res: Response): Promise<void> => {
		const pan = req.params.pan.toUpperCase();
		const parsed = panSchema.safeParse(pan);
		if (!parsed.success) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_PAN",
					message: parsed.error.issues[0]?.message ?? "Invalid PAN format",
					retryable: false,
				},
			});
			return;
		}

		try {
			const folioNos = req.query.folioNos
				? String(req.query.folioNos).split(",")
				: undefined;
			const dpId = req.query.dpId ? String(req.query.dpId) : undefined;
			const smallcaseAuthId = req.query.smallcaseAuthId
				? String(req.query.smallcaseAuthId)
				: undefined;

			const comparison = await multiVendorLasService.getComparativeEligibility(pan, {
				folioNos,
				dpId,
				smallcaseAuthId,
			});

			res.json({
				success: true,
				data: comparison,
				meta: {
					timestamp: new Date().toISOString(),
					version: "multi-las-v2.0",
				},
			});
		} catch (err: any) {
			logger.error("[MultiVendorLAS] Comparison error: " + err.message);
			res.status(500).json({
				success: false,
				error: {
					error_code: "LAS_COMPARISON_FAILED",
					message: err.message || "Failed to generate comparative LAS quotes",
					retryable: true,
				},
			});
		}
	});

	/**
	 * POST /api/smallcase/las/eligibility
	 * Check demat equity eligibility via Smallcase.
	 */
	app.post("/api/smallcase/las/eligibility", isAuthenticated, async (req: Request, res: Response): Promise<void> => {
		const { pan, smallcaseAuthId } = req.body;
		if (!pan) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "MISSING_PAN",
					message: "PAN is required to check Smallcase demat eligibility.",
					retryable: false,
				},
			});
			return;
		}

		try {
			const result = await smallcaseLasService.checkEligibility(pan.toUpperCase(), smallcaseAuthId);
			res.json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: "sc-las-v1.0",
				},
			});
		} catch (err: any) {
			res.status(500).json({
				success: false,
				error: {
					error_code: "SMALLCASE_ELIGIBILITY_ERROR",
					message: err.message,
					retryable: true,
				},
			});
		}
	});

	/**
	 * POST /api/smallcase/las/transaction
	 * Creates a Smallcase Lending Gateway transaction for SDK execution.
	 */
	app.post("/api/smallcase/las/transaction", isAuthenticated, async (req: Request, res: Response): Promise<void> => {
		const userId = (req.user as any)?.id || "guest_investor";
		const { pan, securities, requestedAmount, tenure, bankAccountId } = req.body;

		if (!pan || !Array.isArray(securities) || !requestedAmount || !tenure) {
			res.status(400).json({
				success: false,
				error: {
					error_code: "INVALID_LENDING_PAYLOAD",
					message: "Missing required fields: pan, securities, requestedAmount, or tenure.",
					retryable: false,
				},
			});
			return;
		}

		try {
			const result = await smallcaseLasService.createLendingTransaction({
				userId,
				pan: pan.toUpperCase(),
				securities,
				requestedAmount: Number(requestedAmount),
				tenure: Number(tenure),
				bankAccountId,
			});

			res.json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: "sc-las-v1.0",
				},
			});
		} catch (err: any) {
			res.status(500).json({
				success: false,
				error: {
					error_code: "SMALLCASE_TX_FAILED",
					message: err.message,
					retryable: true,
				},
			});
		}
	});

	logger.info("[MultiVendorLAS] Registered multi-vendor LAS routes", {
		event: "MULTI_VENDOR_LAS_ROUTES_REGISTERED",
		endpoints: 4,
	});
}
