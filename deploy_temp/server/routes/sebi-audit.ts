import { Router, Request, Response } from "express";
import { z } from "zod";
import { sebiAuditService } from "../services/sebi-audit-service";
import * as schema from "@shared/schema";

const router = Router();

/**
 * GET /api/sebi-audit/proposal/:proposalId
 * Get audit logs for a proposal
 */
router.get("/proposal/:proposalId", async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await sebiAuditService.getLogsByProposal(proposalId, limit);
    res.json({ success: true, data: { logs, count: logs.length } });
  } catch (error: any) {
    console.error("[SEBIAudit] Error fetching proposal logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sebi-audit/advisor/:advisorId
 * Get audit logs for an advisor
 */
router.get("/advisor/:advisorId", async (req: Request, res: Response) => {
  try {
    const { advisorId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;

    const logs = await sebiAuditService.getLogsByAdvisor(advisorId, limit);
    res.json({ success: true, data: { logs, count: logs.length } });
  } catch (error: any) {
    console.error("[SEBIAudit] Error fetching advisor logs:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sebi-audit/summary/:proposalId
 * Get audit summary for a proposal
 */
router.get("/summary/:proposalId", async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const summary = await sebiAuditService.generateAuditSummary(proposalId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error("[SEBIAudit] Error generating summary:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/sebi-audit/export
 * Export audit logs as CSV
 */
router.get("/export", async (req: Request, res: Response) => {
  try {
    const proposalId = req.query.proposalId as string | undefined;
    const advisorId = req.query.advisorId as string | undefined;

    const csv = await sebiAuditService.exportToCSV(proposalId, advisorId);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sebi_audit_${proposalId || advisorId || "all"}_${Date.now()}.csv`
    );
    res.send(csv);
  } catch (error: any) {
    console.error("[SEBIAudit] Error exporting CSV:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sebi-audit/log
 * Manually log an audit entry (for custom actions)
 */
router.post("/log", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      actionType: z.string(),
      actionSummary: z.string(),
      inputData: z.record(z.any()).optional(),
      outputData: z.record(z.any()).optional(),
      rationale: z.string().optional(),
      templateId: z.string().optional(),
      riskDisclosure: z.string().optional(),
      proposalId: z.string().optional(),
      advisorId: z.string().optional(),
      clientId: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const logId = await sebiAuditService.logImmediate(
      {
        actionType: body.actionType as any,
        actionSummary: body.actionSummary,
        inputData: body.inputData,
        outputData: body.outputData,
        rationale: body.rationale,
        templateId: body.templateId,
        riskDisclosure: body.riskDisclosure,
      },
      {
        proposalId: body.proposalId,
        advisorId: body.advisorId,
        clientId: body.clientId,
      }
    );

    res.json({ success: true, data: { logId } });
  } catch (error: any) {
    console.error("[SEBIAudit] Error logging:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
