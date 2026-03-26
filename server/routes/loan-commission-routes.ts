import { Router, Request, Response, NextFunction } from "express";
import { loanCommissionService, COMMISSION_RATE_CONFIG, LoanProductType } from "../services/loan-commission-service";
import { payloadTransformerFactory, applicationToCanonical, validateCanonicalPayload } from "../services/bank-connectors";
import { dsaLoanService } from "../services/dsa-loan-service";

const router = Router();

const ADMIN_ROLES = ["admin", "superadmin", "master_agent"];

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }
  const userRole = user.role || user.roles?.[0];
  if (!userRole || !ADMIN_ROLES.includes(userRole)) {
    return res.status(403).json({ success: false, error: "Admin role required to access commission data" });
  }
  next();
}

// All commission ledger and webhook routes require admin auth
router.use(requireAdminAuth);

router.get("/rates", async (req: Request, res: Response) => {
  try {
    const rates = loanCommissionService.getAllCommissionRates();
    res.json({
      success: true,
      data: rates,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/rates/:productType", async (req: Request, res: Response) => {
  try {
    const { productType } = req.params;
    const config = loanCommissionService.getCommissionRateConfig(productType as LoanProductType);
    res.json({
      success: true,
      data: config,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/calculate", async (req: Request, res: Response) => {
  try {
    const { loanAmount, productType, customRate, customShares } = req.body;
    
    if (!loanAmount || !productType) {
      return res.status(400).json({
        success: false,
        error: "loanAmount and productType are required",
      });
    }

    const result = loanCommissionService.calculateCommission(
      parseFloat(loanAmount),
      productType as LoanProductType,
      customRate ? parseFloat(customRate) : undefined,
      customShares
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ledger", async (req: Request, res: Response) => {
  try {
    const { status, providerId, startDate, endDate, partnerId, agentId } = req.query;

    const filters: any = {};
    if (status) filters.status = status as string;
    if (providerId) filters.providerId = providerId as string;
    if (partnerId) filters.partnerId = partnerId as string;
    if (agentId) filters.agentId = agentId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const entries = await loanCommissionService.getCommissionLedger(filters);

    res.json({
      success: true,
      data: entries,
      count: entries.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/ledger/summary", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, providerId } = req.query;

    const filters: any = {};
    if (providerId) filters.providerId = providerId as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const summary = await loanCommissionService.getCommissionSummary(filters);

    res.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/ledger", async (req: Request, res: Response) => {
  try {
    const {
      applicationId,
      providerId,
      productType,
      loanAmount,
      disbursementDate,
      partnerId,
      agentId,
      customRate,
    } = req.body;

    if (!applicationId || !providerId || !productType || !loanAmount) {
      return res.status(400).json({
        success: false,
        error: "applicationId, providerId, productType, and loanAmount are required",
      });
    }

    const entry = await loanCommissionService.createCommissionEntry(
      applicationId,
      providerId,
      productType as LoanProductType,
      parseFloat(loanAmount),
      disbursementDate ? new Date(disbursementDate) : undefined,
      partnerId,
      agentId,
      customRate ? parseFloat(customRate) : undefined
    );

    if (!entry) {
      return res.status(500).json({
        success: false,
        error: "Failed to create commission entry",
      });
    }

    res.json({
      success: true,
      data: entry,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/ledger/:id/status", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, invoiceNumber, paymentDueDate } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: "status is required",
      });
    }

    await loanCommissionService.updateCommissionStatus(
      id,
      status,
      invoiceNumber,
      paymentDueDate ? new Date(paymentDueDate) : undefined
    );

    res.json({
      success: true,
      message: "Commission status updated",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/webhook/sanction", async (req: Request, res: Response) => {
  try {
    const {
      applicationId,
      sanctionedAmount,
      bankCode,
      productType,
      disbursementDate,
      partnerId,
      agentId,
    } = req.body;

    if (!applicationId || !sanctionedAmount || !bankCode || !productType) {
      return res.status(400).json({
        success: false,
        error: "applicationId, sanctionedAmount, bankCode, and productType are required",
      });
    }

    const entry = await loanCommissionService.onLoanSanctioned(
      applicationId,
      parseFloat(sanctionedAmount),
      bankCode,
      productType as LoanProductType,
      disbursementDate ? new Date(disbursementDate) : undefined,
      partnerId,
      agentId
    );

    res.json({
      success: true,
      data: entry,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/webhook/disbursement", async (req: Request, res: Response) => {
  try {
    const { applicationId, disbursedAmount, disbursementDate } = req.body;

    if (!applicationId || !disbursedAmount || !disbursementDate) {
      return res.status(400).json({
        success: false,
        error: "applicationId, disbursedAmount, and disbursementDate are required",
      });
    }

    await loanCommissionService.onLoanDisbursed(
      applicationId,
      parseFloat(disbursedAmount),
      new Date(disbursementDate)
    );

    res.json({
      success: true,
      message: "Commission updated for disbursement",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/transformers/banks", async (req: Request, res: Response) => {
  try {
    const banks = payloadTransformerFactory.getSupportedBanks();
    res.json({
      success: true,
      data: banks,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/transformers/preview", async (req: Request, res: Response) => {
  try {
    const { applicationId, bankCode } = req.body;

    if (!applicationId || !bankCode) {
      return res.status(400).json({
        success: false,
        error: "applicationId and bankCode are required",
      });
    }

    const application = await dsaLoanService.getApplication(applicationId);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: "Application not found",
      });
    }

    const canonical = applicationToCanonical(application);
    const validation = validateCanonicalPayload(canonical);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: "Invalid application data",
        validationErrors: validation.errors,
      });
    }

    const transformed = payloadTransformerFactory.transform(bankCode, canonical);

    res.json({
      success: true,
      data: {
        canonical,
        transformed,
        validation,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export function registerLoanCommissionRoutes(app: any) {
  app.use("/api/loan-commission", router);
  console.log("✅ Loan Commission routes registered");
}

export default router;
