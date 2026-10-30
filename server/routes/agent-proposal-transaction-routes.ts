/**
 * @file agent-proposal-transaction-routes.ts
 * @module routes/agent-proposal-transaction-routes
 * @description REST API endpoints for the complete Agent Proposal Transaction Lifecycle.
 *
 * Exposes:
 *   - POST /api/agent/proposals/:proposalId/consent
 *   - POST /api/agent/proposals/:proposalId/initiate-transaction
 *   - POST /api/agent/proposals/:proposalId/complete-transaction
 *   - POST /api/transactions/:orderId/dispatch-copies
 *   - GET  /api/agent/proposals/:proposalId/transaction-lifecycle
 *
 * Conforms to FintekPro GCR v1.0 + FASP-AI v1.0.
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { agentProposalTransactionLifecycle } from "../services/agent-proposal-transaction-lifecycle";
import { requireAuth } from "../middleware/auth";
import { logger } from "../logger";

const router = Router();
const API_VERSION = "v1.0";

// Input validation schemas
const proposalConsentSchema = z.object({
	disclosureAcknowledged: z.boolean().default(true),
	riskAcknowledged: z.boolean().default(true),
	executionConsent: z.boolean().default(true),
	signatureType: z.string().optional().default("otp"),
	signatureData: z.unknown().optional(),
	clientNotes: z.string().optional(),
});

const initiateTransactionSchema = z.object({
	orderType: z.enum(["LUMPSUM", "SIP", "MARKET", "LIMIT"]).optional().default("LUMPSUM"),
	paymentGateway: z.enum(["bse_star", "upstox", "cashfree", "escrow", "iris"]).optional().default("bse_star"),
	notes: z.string().optional(),
});

const completeTransactionSchema = z.object({
	orderId: z.string().min(1, "orderId is required"),
	externalOrderId: z.string().optional(),
	paymentTransactionId: z.string().optional(),
	executionStatus: z.enum(["completed", "failed"]).default("completed"),
	executionPrice: z.string().optional(),
	executedQuantity: z.string().optional(),
	settlementReference: z.string().optional(),
	failureReason: z.string().optional(),
	dispatchToExternalApis: z.boolean().optional().default(true),
});

const dispatchCopiesSchema = z.object({
	destinations: z.array(z.enum(["zoho", "sebi", "webhook"])).optional().default(["zoho", "sebi"]),
});

/**
 * POST /api/agent/proposals/:proposalId/consent
 * Record client consent, risk disclosure acknowledgement, and execution approval.
 */
router.post(
	"/api/agent/proposals/:proposalId/consent",
	requireAuth,
	async (req: Request, res: Response) => {
		const startTime = Date.now();
		try {
			const { proposalId } = req.params;
			const validated = proposalConsentSchema.parse(req.body);
			const clientId = (req.user as any)?.id;

			const result = await agentProposalTransactionLifecycle.recordProposalConsent({
				proposalId,
				clientId,
				disclosureAcknowledged: validated.disclosureAcknowledged,
				riskAcknowledged: validated.riskAcknowledged,
				executionConsent: validated.executionConsent,
				signatureType: validated.signatureType,
				signatureData: validated.signatureData,
				clientNotes: validated.clientNotes,
				ipAddress: req.ip || (req.headers["x-forwarded-for"] as string),
				userAgent: req.get("User-Agent"),
			});

			return res.status(200).json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: API_VERSION,
					latencyMs: Date.now() - startTime,
				},
			});
		} catch (error: any) {
			logger.error("[ProposalTransactionRoutes] Consent recording error:", error);
			return res.status(400).json({
				success: false,
				error_code: "CONSENT_RECORDING_FAILED",
				message: error.message || "Failed to record proposal consent",
				retryable: false,
			});
		}
	},
);

/**
 * POST /api/agent/proposals/:proposalId/initiate-transaction
 * Initiates the formal financial order from an approved proposal.
 */
router.post(
	"/api/agent/proposals/:proposalId/initiate-transaction",
	requireAuth,
	async (req: Request, res: Response) => {
		const startTime = Date.now();
		try {
			const { proposalId } = req.params;
			const validated = initiateTransactionSchema.parse(req.body);
			const userId = (req.user as any)?.id;
			const userRoles = (req.user as any)?.roles || [];
			const isAgent = userRoles.includes("agent") || userRoles.includes("partner");

			const result = await agentProposalTransactionLifecycle.initiateTransactionFromProposal({
				proposalId,
				clientId: isAgent ? (req.body.clientId || userId) : userId,
				agentId: isAgent ? userId : req.body.agentId,
				orderType: validated.orderType,
				paymentGateway: validated.paymentGateway,
				clientIp: req.ip || (req.headers["x-forwarded-for"] as string),
				userAgent: req.get("User-Agent"),
				notes: validated.notes,
			});

			return res.status(201).json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: API_VERSION,
					latencyMs: Date.now() - startTime,
				},
			});
		} catch (error: any) {
			logger.error("[ProposalTransactionRoutes] Initiation error:", error);
			return res.status(400).json({
				success: false,
				error_code: "TRANSACTION_INITIATION_FAILED",
				message: error.message || "Failed to initiate transaction from proposal",
				retryable: true,
			});
		}
	},
);

/**
 * POST /api/agent/proposals/:proposalId/complete-transaction
 * Records final execution and triggers copy dispatch to Zoho and SEBI.
 */
router.post(
	"/api/agent/proposals/:proposalId/complete-transaction",
	requireAuth,
	async (req: Request, res: Response) => {
		const startTime = Date.now();
		try {
			const validated = completeTransactionSchema.parse(req.body);

			const result = await agentProposalTransactionLifecycle.completeTransaction({
				orderId: validated.orderId,
				externalOrderId: validated.externalOrderId,
				paymentTransactionId: validated.paymentTransactionId,
				executionStatus: validated.executionStatus,
				executionPrice: validated.executionPrice,
				executedQuantity: validated.executedQuantity,
				settlementReference: validated.settlementReference,
				failureReason: validated.failureReason,
				dispatchToExternalApis: validated.dispatchToExternalApis,
			});

			return res.status(200).json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: API_VERSION,
					latencyMs: Date.now() - startTime,
				},
			});
		} catch (error: any) {
			logger.error("[ProposalTransactionRoutes] Completion error:", error);
			return res.status(400).json({
				success: false,
				error_code: "TRANSACTION_COMPLETION_FAILED",
				message: error.message || "Failed to complete transaction",
				retryable: true,
			});
		}
	},
);

/**
 * POST /api/transactions/:orderId/dispatch-copies
 * On-demand dispatch of transaction record to external systems (Zoho, SEBI, Webhooks).
 */
router.post(
	"/api/transactions/:orderId/dispatch-copies",
	requireAuth,
	async (req: Request, res: Response) => {
		const startTime = Date.now();
		try {
			const { orderId } = req.params;
			const validated = dispatchCopiesSchema.parse(req.body);

			const result = await agentProposalTransactionLifecycle.dispatchTransactionCopies({
				orderId,
				destinations: validated.destinations,
			});

			return res.status(200).json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: API_VERSION,
					latencyMs: Date.now() - startTime,
				},
			});
		} catch (error: any) {
			logger.error("[ProposalTransactionRoutes] Dispatch error:", error);
			return res.status(400).json({
				success: false,
				error_code: "DISPATCH_FAILED",
				message: error.message || "Failed to dispatch transaction copies",
				retryable: true,
			});
		}
	},
);

/**
 * GET /api/agent/proposals/:proposalId/transaction-lifecycle
 * Returns full provenance and audit timeline of the proposal transaction path.
 */
router.get(
	"/api/agent/proposals/:proposalId/transaction-lifecycle",
	requireAuth,
	async (req: Request, res: Response) => {
		const startTime = Date.now();
		try {
			const { proposalId } = req.params;
			const result = await agentProposalTransactionLifecycle.getProposalTransactionLifecycle(proposalId);

			return res.status(200).json({
				success: true,
				data: result,
				meta: {
					timestamp: new Date().toISOString(),
					version: API_VERSION,
					latencyMs: Date.now() - startTime,
				},
			});
		} catch (error: any) {
			logger.error("[ProposalTransactionRoutes] Lifecycle fetch error:", error);
			return res.status(500).json({
				success: false,
				error_code: "LIFECYCLE_FETCH_FAILED",
				message: error.message || "Failed to retrieve transaction lifecycle",
				retryable: false,
			});
		}
	},
);

export default router;

