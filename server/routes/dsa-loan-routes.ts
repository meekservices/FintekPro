import { Router, Request, Response } from "express";
import { dsaLoanService } from "../services/dsa-loan-service";
import { z } from "zod";

const router = Router();

const createApplicationSchema = z.object({
  applicantType: z.enum(['individual', 'business']).default('individual'),
  applicantName: z.string().min(1),
  applicantPhone: z.string().regex(/^[6-9]\d{9}$/),
  applicantEmail: z.string().email().optional(),
  applicantPan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  applicantAadhaar: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  employmentType: z.enum(['salaried', 'self_employed', 'business', 'professional']),
  companyName: z.string().optional(),
  designation: z.string().optional(),
  workExperience: z.number().int().optional(),
  monthlyIncome: z.number().positive(),
  annualIncome: z.number().positive().optional(),
  otherIncome: z.number().optional(),
  loanType: z.enum(['personal', 'home', 'car', 'business', 'education', 'gold', 'lap']),
  requestedAmount: z.number().positive(),
  requestedTenure: z.number().int().min(6).max(360),
  loanPurpose: z.string().optional(),
  existingLoans: z.number().int().optional(),
  existingEmiAmount: z.number().optional(),
  creditScore: z.number().int().min(300).max(900).optional(),
  routingStrategy: z.enum(['parallel', 'waterfall', 'priority_first']).optional(),
  dsaCode: z.string().optional(),
  subDsaCode: z.string().optional(),
});

router.post("/applications", async (req: Request, res: Response) => {
  try {
    const parsed = createApplicationSchema.parse(req.body);
    const agentId = (req as any).user?.id;
    
    const application = await dsaLoanService.createApplication({
      ...parsed,
      monthlyIncome: parsed.monthlyIncome.toString(),
      annualIncome: parsed.annualIncome?.toString(),
      otherIncome: parsed.otherIncome?.toString(),
      requestedAmount: parsed.requestedAmount.toString(),
      existingEmiAmount: parsed.existingEmiAmount?.toString(),
      agentId,
    } as any, agentId);
    
    res.status(201).json({
      success: true,
      data: application,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

router.get("/applications", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    const { status, loanType, fromDate, toDate, limit, offset } = req.query;
    
    const result = await dsaLoanService.listApplications({
      agentId,
      status: status as any,
      loanType: loanType as string,
      fromDate: fromDate ? new Date(fromDate as string) : undefined,
      toDate: toDate ? new Date(toDate as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    
    res.json({
      success: true,
      data: result.applications,
      meta: {
        total: result.total,
        limit: limit ? parseInt(limit as string) : 50,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/applications/:id", async (req: Request, res: Response) => {
  try {
    const application = await dsaLoanService.getApplication(req.params.id);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      });
    }
    
    res.json({
      success: true,
      data: application,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/applications/number/:applicationNumber", async (req: Request, res: Response) => {
  try {
    const application = await dsaLoanService.getApplicationByNumber(req.params.applicationNumber);
    
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found',
      });
    }
    
    res.json({
      success: true,
      data: application,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.patch("/applications/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    const application = await dsaLoanService.updateApplication(
      req.params.id,
      req.body,
      agentId
    );
    
    res.json({
      success: true,
      data: application,
    });
  } catch (error: any) {
    res.status(error.message === 'Application not found' ? 404 : 500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/applications/:id/submit", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    const application = await dsaLoanService.submitApplication(req.params.id, agentId);
    
    res.json({
      success: true,
      data: application,
      message: 'Application submitted successfully',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/applications/:id/check-eligibility", async (req: Request, res: Response) => {
  try {
    const results = await dsaLoanService.checkEligibility(req.params.id);
    
    const eligible = results.filter(r => r.eligible);
    const ineligible = results.filter(r => !r.eligible);
    
    res.json({
      success: true,
      data: {
        eligible,
        ineligible,
        summary: {
          totalBanks: results.length,
          eligibleCount: eligible.length,
          topMatch: eligible[0] || null,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/applications/:id/route", async (req: Request, res: Response) => {
  try {
    const { bankCodes, strategy } = req.body;
    
    if (!bankCodes || !Array.isArray(bankCodes) || bankCodes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'bankCodes array is required',
      });
    }
    
    const agentId = (req as any).user?.id;
    const result = await dsaLoanService.routeToBank(
      req.params.id,
      bankCodes,
      strategy || 'parallel',
      agentId
    );
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/applications/:id/routing-history", async (req: Request, res: Response) => {
  try {
    const history = await dsaLoanService.getRoutingHistory(req.params.id);
    
    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/applications/:id/documents", async (req: Request, res: Response) => {
  try {
    const documents = await dsaLoanService.getDocuments(req.params.id);
    
    res.json({
      success: true,
      data: documents,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/applications/:id/documents", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      documentType: z.string(),
      documentName: z.string(),
      fileName: z.string(),
      storageUrl: z.string().url(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
    });
    
    const parsed = schema.parse(req.body);
    
    const doc = await dsaLoanService.uploadDocument({
      applicationId: req.params.id,
      ...parsed,
    });
    
    res.status(201).json({
      success: true,
      data: doc,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
});

router.get("/applications/:id/audit-logs", async (req: Request, res: Response) => {
  try {
    const logs = await dsaLoanService.getAuditLogs(req.params.id);
    
    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/banks", async (req: Request, res: Response) => {
  try {
    const banks = await dsaLoanService.getActiveBanks();
    
    res.json({
      success: true,
      data: banks,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    const stats = await dsaLoanService.getDashboardStats(agentId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/webhooks/:bankCode", async (req: Request, res: Response) => {
  try {
    const { bankCode } = req.params;
    const eventType = req.headers['x-event-type'] as string || 'unknown';
    const signature = req.headers['x-signature'] as string;
    
    const result = await dsaLoanService.processWebhook(
      bankCode,
      eventType,
      req.body,
      signature
    );
    
    res.json({
      success: result.processed,
      error: result.error,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post("/routing/:routingId/response", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      bankStatus: z.string(),
      bankReference: z.string().optional(),
      offeredInterestRate: z.number().optional(),
      approvedAmount: z.number().optional(),
      approvedTenure: z.number().optional(),
      processingFee: z.number().optional(),
      rejectionReason: z.string().optional(),
    });
    
    const parsed = schema.parse(req.body);
    const actorId = (req as any).user?.id;
    
    await dsaLoanService.updateBankResponse(req.params.routingId, parsed, actorId);
    
    res.json({
      success: true,
      message: 'Bank response recorded',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors,
      });
    } else {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
});

export default router;
