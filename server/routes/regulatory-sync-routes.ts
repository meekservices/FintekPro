import { Router, Request, Response } from "express";
import { z } from "zod";
import { regulatoryIngestionService } from "../services/regulatory-ingestion-service";
import { logger } from "../logger";

const router = Router();

/**
 * GET /api/regulatory-sync/proposals
 * List staged regulatory amendment proposals with status and regression results
 */
router.get("/proposals", async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const regulator = typeof req.query.regulator === "string" ? req.query.regulator : undefined;

    const result = await regulatoryIngestionService.getProposals(status, regulator);

    return res.json({
      success: true,
      data: result.proposals,
      meta: {
        total: result.total,
        pendingCount: result.pendingCount,
        promotedCount: result.promotedCount,
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    });
  } catch (error: any) {
    logger.error(`Error in GET /api/regulatory-sync/proposals: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve regulatory amendment proposals",
        retryable: true,
      },
    });
  }
});

/**
 * POST /api/regulatory-sync/poll-now
 * Trigger immediate autonomous polling scan across CBDT, SEBI, MCA, IRS, and RBI
 */
router.post("/poll-now", async (_req: Request, res: Response) => {
  try {
    const scanResult = await regulatoryIngestionService.pollAllRegulators();

    return res.json({
      success: true,
      data: scanResult,
      meta: {
        timestamp: scanResult.scanTimestamp,
        version: "1.0",
      },
    });
  } catch (error: any) {
    logger.error(`Error in POST /api/regulatory-sync/poll-now: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "POLL_FAILED",
        message: error.message || "Failed to execute autonomous regulatory poll",
        retryable: true,
      },
    });
  }
});

const approveSchema = z.object({
  approverId: z.string().default("compliance-officer"),
  approverRole: z.string().default("compliance_officer"),
});

/**
 * POST /api/regulatory-sync/proposals/:id/approve
 * Human-in-the-Loop Gate: Approve amendment and promote to active engine
 */
router.post("/proposals/:id/approve", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = approveSchema.safeParse(req.body);
    const approverId = parsed.success ? parsed.data.approverId : "compliance-officer";
    const approverRole = parsed.success ? parsed.data.approverRole : "compliance_officer";

    const result = await regulatoryIngestionService.approveAndPromoteProposal(id, approverId, approverRole);

    return res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        version: result.promotedVersion,
      },
    });
  } catch (error: any) {
    logger.error(`Error in POST /api/regulatory-sync/proposals/${req.params.id}/approve: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "PROMOTION_FAILED",
        message: error.message || "Failed to promote amendment proposal to active engine",
        retryable: false,
      },
    });
  }
});

export default router;
