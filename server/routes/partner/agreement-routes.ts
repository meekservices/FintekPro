/**
 * Partner Agreement & Revenue Tracking Routes
 *
 * Exposes endpoints for Sub-Brokers and Distributors to upload commercial agreements,
 * inspect commission schedules, and track live revenue/earnings.
 */

import { Router, Request, Response, Express } from "express";
import { z } from "zod";
import multer from "multer";
import { partnerAgreementService } from "../../services/partner-agreement-service";
import { logger } from "../../logger";

const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
});

const uploadAgreementJsonSchema = z.object({
	partnerId: z.string().min(1, "Partner ID is required"),
	agreementType: z.enum([
		"SUB_BROKER",
		"DISTRIBUTOR",
		"FRANCHISEE",
		"CORPORATE_B2B",
		"REFERRAL_AGENT",
	]),
	fileName: z.string().min(1, "File name is required"),
	fileSize: z.number().optional(),
	mimeType: z.string().optional(),
	documentBase64: z.string().optional(),
	documentUrl: z.string().optional(),
	effectiveFrom: z.string().optional(),
	effectiveTo: z.string().optional(),
	commissionSchedule: z
		.object({
			equityDeliveryPct: z.number().min(0).max(100).optional(),
			equityIntradayPct: z.number().min(0).max(100).optional(),
			fnoOptionsPct: z.number().min(0).max(100).optional(),
			fnoFuturesPct: z.number().min(0).max(100).optional(),
			mutualFundsTrailPct: z.number().min(0).max(100).optional(),
			bondsPct: z.number().min(0).max(100).optional(),
			pmsPct: z.number().min(0).max(100).optional(),
			insurancePct: z.number().min(0).max(100).optional(),
			corporateFdPct: z.number().min(0).max(100).optional(),
			defaultAgentPct: z.number().min(0).max(100).optional(),
		})
		.default({}),
	eSignReference: z.string().optional(),
	notes: z.string().optional(),
	autoApprove: z.boolean().optional(),
});

export function registerPartnerAgreementRoutes(app: Express): void {
	const router = Router();

	/**
	 * POST /api/partner/agreements/upload
	 * Upload an agreement document with commission schedule
	 */
	router.post(
		"/upload",
		upload.single("agreementFile"),
		async (req: Request, res: Response): Promise<void> => {
			try {
				let payload = req.body;

				// If commissionSchedule is passed as string in multipart form, parse it
				if (typeof payload.commissionSchedule === "string") {
					try {
						payload.commissionSchedule = JSON.parse(payload.commissionSchedule);
					} catch {
						payload.commissionSchedule = {};
					}
				}

				// If physical file was uploaded via multer, extract metadata
				if (req.file) {
					payload.fileName = payload.fileName || req.file.originalname;
					payload.fileSize = req.file.size;
					payload.mimeType = req.file.mimetype;
					payload.documentBase64 = req.file.buffer.toString("base64");
				}

				const validation = uploadAgreementJsonSchema.safeParse(payload);
				if (!validation.success) {
					res.status(400).json({
						success: false,
						error: "Validation failed",
						details: validation.error.flatten(),
					});
					return;
				}

				const result = await partnerAgreementService.uploadAgreement(
					validation.data,
				);
				if (!result.success) {
					res.status(422).json({ success: false, error: result.error });
					return;
				}

				res.status(201).json({
					success: true,
					data: result,
					message: "Agreement successfully uploaded and queued for audit",
				});
			} catch (err: any) {
				logger.error("[PartnerAgreementRoutes] /upload error:", err.message);
				res.status(500).json({ success: false, error: "Internal server error" });
			}
		},
	);

	/**
	 * GET /api/partner/agreements/partner/:partnerId
	 * List all agreements for a given Sub-Broker or Distributor
	 */
	router.get(
		"/partner/:partnerId",
		async (req: Request, res: Response): Promise<void> => {
			try {
				const { partnerId } = req.params;
				const agreements =
					await partnerAgreementService.getPartnerAgreements(partnerId);
				res.json({ success: true, data: agreements, count: agreements.length });
			} catch (err: any) {
				res.status(500).json({ success: false, error: err.message });
			}
		},
	);

	/**
	 * GET /api/partner/agreements/:agreementId/revenue
	 * Real-time revenue, gross volume, and commission tracking for an agreement
	 */
	router.get(
		"/:agreementId/revenue",
		async (req: Request, res: Response): Promise<void> => {
			try {
				const { agreementId } = req.params;
				const result =
					await partnerAgreementService.trackAgreementRevenue(agreementId);
				if (!result.success) {
					res.status(404).json({ success: false, error: result.error });
					return;
				}
				res.json({ success: true, data: result.data });
			} catch (err: any) {
				res.status(500).json({ success: false, error: err.message });
			}
		},
	);

	/**
	 * POST /api/partner/agreements/:agreementId/approve
	 * Approve and activate an agreement
	 */
	router.post(
		"/:agreementId/approve",
		async (req: Request, res: Response): Promise<void> => {
			try {
				const { agreementId } = req.params;
				const { adminId = "ADMIN", notes } = req.body;
				const result = await partnerAgreementService.approveAgreement(
					agreementId,
					adminId,
					notes,
				);
				if (!result.success) {
					res.status(422).json({ success: false, error: result.error });
					return;
				}
				res.json({
					success: true,
					message: "Agreement approved and commission schedule activated",
				});
			} catch (err: any) {
				res.status(500).json({ success: false, error: err.message });
			}
		},
	);

	app.use("/api/partner/agreements", router);
}
