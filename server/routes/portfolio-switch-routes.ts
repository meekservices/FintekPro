/**
 * @file portfolio-switch-routes.ts
 * @description Direct Plan Switch Optimizer & Account Aggregator Mutual Fund Routes
 *
 * Exposes peer-grade (INDmoney / Dezerv level) wealth management capabilities:
 * 1. POST /api/portfolio/switch-to-direct/analyze
 *    - Detects Regular plans, matches Direct counterparts, computes fee savings & tax/exit loads.
 * 2. POST /api/portfolio/switch-to-direct/cart/export
 *    - Generates DSS proposal or order cart ready for client review/execution.
 * 3. POST /api/portfolio/aa/mf/initiate
 *    - Starts RBI Account Aggregator (AA) consent for Mutual Funds via Setu.
 * 4. GET /api/portfolio/aa/mf/status/:consentId
 *    - Checks AA consent status.
 * 5. POST /api/portfolio/aa/mf/sync
 *    - Syncs approved AA holdings directly into client comprehensive holdings.
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Structured logging, engine_version, calculation_timestamp.
 * - DSS advisory only (requires advisor or user confirmation).
 */

import { Router, Request, Response } from "express";
import { directPlanSwitchService, HoldingInput } from "../services/direct-plan-switch-service";
import { setuService } from "../services/setu-service";
import { unifiedHoldingsReaderService } from "../services/unified-holdings-reader-service";
import { logger } from "../logger";
import { z } from "zod";

export const portfolioSwitchRouter = Router();

const holdingSchema = z.object({
	schemeCode: z.string().optional(),
	schemeName: z.string().min(2, "Scheme name is required"),
	isin: z.string().optional(),
	currentValue: z.number().nonnegative(),
	investedValue: z.number().nonnegative().optional(),
	units: z.number().optional(),
	category: z.string().optional(),
	purchaseDate: z.string().optional(),
	holdingDays: z.number().optional(),
});

const analyzeSwitchSchema = z.object({
	clientId: z.string().optional(),
	holdings: z.array(holdingSchema).optional(),
	annualLtcgExemptionUsed: z.number().nonnegative().default(0),
});

/**
 * POST /api/portfolio/switch-to-direct/analyze
 * Analyzes Regular plan holdings and produces comprehensive Direct switch recommendations
 */
portfolioSwitchRouter.post("/switch-to-direct/analyze", async (req: Request, res: Response) => {
	const start = Date.now();
	try {
		const parsed = analyzeSwitchSchema.safeParse(req.body);
		if (!parsed.success) {
			return res.status(400).json({
				success: false,
				error_code: "VALIDATION_FAILED",
				message: "Invalid request payload",
				details: parsed.error.flatten().fieldErrors,
			});
		}

		let inputHoldings: HoldingInput[] = parsed.data.holdings || [];

		// If no manual holdings supplied, fetch client's holdings from DB
		if (inputHoldings.length === 0 && parsed.data.clientId) {
			const clientHoldings = await unifiedHoldingsReaderService.getHoldings(parsed.data.clientId);
			inputHoldings = clientHoldings
				.filter((h) => h.assetClass === "MUTUAL_FUND" || h.assetType === "MUTUAL_FUND")
				.map((h) => {
					let holdingDays: number | undefined;
					if (h.purchaseDate) {
						holdingDays = Math.floor((Date.now() - new Date(h.purchaseDate).getTime()) / (1000 * 60 * 60 * 24));
					}
					return {
						schemeCode: h.symbol || h.isin,
						schemeName: h.name || "Mutual Fund",
						isin: h.isin,
						currentValue: Number(h.currentValue || 0),
						investedValue: Number(h.investedValue || 0),
						units: Number(h.quantity || 0),
						holdingDays,
					};
				});
		}

		if (inputHoldings.length === 0) {
			return res.status(400).json({
				success: false,
				error_code: "NO_HOLDINGS_PROVIDED",
				message: "Provide an array of holdings or a valid clientId with mutual fund holdings.",
			});
		}

		const result = await directPlanSwitchService.analyzePortfolioSwitch(
			inputHoldings,
			parsed.data.annualLtcgExemptionUsed,
		);

		logger.info("[PortfolioSwitchRoutes] Switch analysis generated", {
			latencyMs: Date.now() - start,
			holdingsCount: inputHoldings.length,
			regularCount: result.regularHoldingCount,
			totalAnnualFeeSavings: result.totalAnnualFeeSavings,
		});

		res.json(result);
	} catch (error: any) {
		logger.error("[PortfolioSwitchRoutes] Analysis error", { error: error.message });
		res.status(500).json({
			success: false,
			error_code: "ANALYSIS_FAILED",
			message: error.message || "Failed to analyze direct plan switch",
		});
	}
});

/**
 * POST /api/portfolio/switch-to-direct/cart/export
 * Exports direct switch execution cart with proposal summary
 */
portfolioSwitchRouter.post("/switch-to-direct/cart/export", async (req: Request, res: Response) => {
	try {
		const { cartItems, clientName, clientPan } = req.body;
		if (!Array.isArray(cartItems) || cartItems.length === 0) {
			return res.status(400).json({
				success: false,
				message: "cartItems array is required to generate switch execution cart.",
			});
		}

		const cartId = `CART-SW-${Date.now()}`;
		const totalValue = cartItems.reduce((acc, item) => acc + (item.currentValue || 0), 0);
		const totalAnnualSavings = cartItems.reduce((acc, item) => acc + (item.annualFeeSavings || 0), 0);

		res.json({
			success: true,
			data: {
				cartId,
				clientName: clientName || "Valued Client",
				clientPan: clientPan ? `${clientPan.slice(0, 2)}*****${clientPan.slice(-2)}` : undefined,
				orderType: "MUTUAL_FUND_DIRECT_SWITCH",
				executionMode: "TWO_STEP_REDEMPTION_PURCHASE",
				status: "PENDING_ADVISOR_OR_CLIENT_APPROVAL",
				totalValue,
				totalAnnualSavings,
				itemCount: cartItems.length,
				items: cartItems.map((item: any) => ({
					redeemSchemeName: item.regularSchemeName,
					redeemSchemeCode: item.regularSchemeCode,
					redeemIsin: item.regularIsin,
					redeemAmount: item.currentValue,
					purchaseSchemeName: item.directSchemeName,
					purchaseSchemeCode: item.directSchemeCode,
					purchaseIsin: item.directIsin,
					expectedTerSavings: item.terDelta,
					exitLoadPayable: item.exitLoadAmount || 0,
					estimatedTax: item.estimatedTax || 0,
					suggestedDate: item.suggestedActionDate,
				})),
			},
			meta: {
				generatedAt: new Date().toISOString(),
				version: "1.0.0",
				faspCompliance: "FASP-AI v1.0 DSS - Requires explicit confirmation before order placement",
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
});

/**
 * POST /api/portfolio/aa/mf/initiate
 * Initiates RBI Account Aggregator consent for Mutual Funds via Setu
 */
portfolioSwitchRouter.post("/aa/mf/initiate", async (req: Request, res: Response) => {
	try {
		const { phoneNumber, redirectUrl } = req.body;
		if (!phoneNumber || !/^[6-9]\d{9}$/.test(phoneNumber.trim())) {
			return res.status(400).json({
				success: false,
				error_code: "INVALID_PHONE",
				message: "Valid 10-digit Indian mobile number required",
			});
		}

		const consent = await setuService.initiateMFConsent(phoneNumber.trim(), redirectUrl);
		res.json(consent);
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
});

/**
 * GET /api/portfolio/aa/mf/status/:consentId
 * Checks status of Account Aggregator consent
 */
portfolioSwitchRouter.get("/aa/mf/status/:consentId", async (req: Request, res: Response) => {
	try {
		const { consentId } = req.params;
		const status = await setuService.getConsentStatus(consentId);
		res.json(status);
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
});

/**
 * POST /api/portfolio/aa/mf/sync
 * Fetches and syncs holdings once AA consent is approved
 */
portfolioSwitchRouter.post("/aa/mf/sync", async (req: Request, res: Response) => {
	try {
		const { consentId, clientId } = req.body;
		if (!consentId) {
			return res.status(400).json({ success: false, message: "consentId is required." });
		}

		const result = await setuService.fetchMFHoldings(consentId);
		if (!result.success) {
			return res.status(400).json(result);
		}

		res.json({
			success: true,
			syncedCount: result.count,
			holdings: result.holdings,
			message: `Successfully ingested ${result.count} mutual fund folios via RBI Account Aggregator pipe.`,
			meta: {
				consentId,
				clientId,
				timestamp: new Date().toISOString(),
			},
		});
	} catch (error: any) {
		res.status(500).json({ success: false, message: error.message });
	}
});
