import { Router, Request, Response } from "express";
import { eligibilityMatrixService, ApplicantProfile } from "../services/eligibility-matrix-service";
import { commissionReconciliationService, PaymentStatementRow } from "../services/commission-reconciliation-service";

const router = Router();

router.get("/rules", async (req: Request, res: Response) => {
  try {
    const { productType, bankCode } = req.query;
    
    let rules;
    if (productType) {
      rules = await eligibilityMatrixService.getRulesByProduct(productType as string);
    } else if (bankCode) {
      rules = await eligibilityMatrixService.getRulesByBank(bankCode as string);
    } else {
      rules = await eligibilityMatrixService.getAllRules();
    }

    res.json({
      success: true,
      data: rules,
      count: rules.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/rules", async (req: Request, res: Response) => {
  try {
    const rule = await eligibilityMatrixService.createRule(req.body);
    res.json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put("/rules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rule = await eligibilityMatrixService.updateRule(id, req.body);
    res.json({
      success: true,
      data: rule,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/rules/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await eligibilityMatrixService.deleteRule(id);
    res.json({
      success: true,
      message: "Rule deleted",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/evaluate", async (req: Request, res: Response) => {
  try {
    const { applicant, productType, bankCode } = req.body;

    if (!applicant || !productType) {
      return res.status(400).json({
        success: false,
        error: "applicant profile and productType are required",
      });
    }

    const results = await eligibilityMatrixService.evaluateEligibility(
      applicant as ApplicantProfile,
      productType,
      bankCode
    );

    res.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/routing", async (req: Request, res: Response) => {
  try {
    const { applicant, productType } = req.body;

    if (!applicant || !productType) {
      return res.status(400).json({
        success: false,
        error: "applicant profile and productType are required",
      });
    }

    const recommendation = await eligibilityMatrixService.getRoutingRecommendation(
      applicant as ApplicantProfile,
      productType
    );

    res.json({
      success: true,
      data: recommendation,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/seed", async (req: Request, res: Response) => {
  try {
    await eligibilityMatrixService.seedDefaultRules();
    res.json({
      success: true,
      message: "Default eligibility rules seeded",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const reconciliationRouter = Router();

reconciliationRouter.get("/summary", async (req: Request, res: Response) => {
  try {
    const summary = await commissionReconciliationService.getReconciliationSummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.get("/kpis", async (req: Request, res: Response) => {
  try {
    const kpis = await commissionReconciliationService.getKPIs();
    res.json({
      success: true,
      data: kpis,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.get("/payments", async (req: Request, res: Response) => {
  try {
    const { matchStatus, paidBy, startDate, endDate } = req.query;

    const filters: any = {};
    if (matchStatus) filters.matchStatus = matchStatus as string;
    if (paidBy) filters.paidBy = paidBy as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const payments = await commissionReconciliationService.getPayments(filters);

    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.get("/payments/unmatched", async (req: Request, res: Response) => {
  try {
    const payments = await commissionReconciliationService.getUnmatchedPayments();
    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.get("/payments/disputed", async (req: Request, res: Response) => {
  try {
    const payments = await commissionReconciliationService.getDisputedPayments();
    res.json({
      success: true,
      data: payments,
      count: payments.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.get("/overdue", async (req: Request, res: Response) => {
  try {
    const { days } = req.query;
    const daysOverdue = days ? parseInt(days as string) : 30;
    const overdue = await commissionReconciliationService.getOverdueCommissions(daysOverdue);
    res.json({
      success: true,
      data: overdue,
      count: overdue.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.post("/upload-statement", async (req: Request, res: Response) => {
  try {
    const { rows, sourceType, paidBy, fileName } = req.body;

    if (!rows || !Array.isArray(rows) || !sourceType || !paidBy) {
      return res.status(400).json({
        success: false,
        error: "rows (array), sourceType, and paidBy are required",
      });
    }

    const userId = (req as any).user?.id;
    const result = await commissionReconciliationService.processPaymentStatement(
      rows as PaymentStatementRow[],
      sourceType,
      paidBy,
      fileName || `upload_${Date.now()}.csv`,
      userId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.post("/manual-match", async (req: Request, res: Response) => {
  try {
    const { paymentId, commissionLedgerId } = req.body;

    if (!paymentId || !commissionLedgerId) {
      return res.status(400).json({
        success: false,
        error: "paymentId and commissionLedgerId are required",
      });
    }

    const userId = (req as any).user?.id || 'admin';
    await commissionReconciliationService.manualMatch(paymentId, commissionLedgerId, userId);

    res.json({
      success: true,
      message: "Payment matched successfully",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.post("/raise-dispute", async (req: Request, res: Response) => {
  try {
    const { paymentId, reason } = req.body;

    if (!paymentId || !reason) {
      return res.status(400).json({
        success: false,
        error: "paymentId and reason are required",
      });
    }

    await commissionReconciliationService.raiseDispute(paymentId, reason);

    res.json({
      success: true,
      message: "Dispute raised",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.post("/resolve-dispute", async (req: Request, res: Response) => {
  try {
    const { paymentId, resolution, finalStatus } = req.body;

    if (!paymentId || !resolution || !finalStatus) {
      return res.status(400).json({
        success: false,
        error: "paymentId, resolution, and finalStatus are required",
      });
    }

    await commissionReconciliationService.resolveDispute(paymentId, resolution, finalStatus);

    res.json({
      success: true,
      message: "Dispute resolved",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

reconciliationRouter.get("/batches", async (req: Request, res: Response) => {
  try {
    const batches = await commissionReconciliationService.getBatches();
    res.json({
      success: true,
      data: batches,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerEligibilityMatrixRoutes(app: any) {
  app.use("/api/eligibility-matrix", router);
  app.use("/api/commission-reconciliation", reconciliationRouter);
  console.log("✅ Eligibility Matrix routes registered");
  console.log("✅ Commission Reconciliation routes registered");
}

export default router;
