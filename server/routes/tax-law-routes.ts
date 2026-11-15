import { Router, Request, Response } from "express";
import { z } from "zod";
import { taxLawEngine } from "../services/tax-law-engine";
import { logger } from "../logger";

const router = Router();

const valuationSchema = z.object({
  bookValueOfAssets: z.number().positive(),
  bookValueOfLiabilities: z.number().min(0),
  paidUpEquityCapital: z.number().positive(),
  faceValueOfShare: z.number().positive(),
  sharesToBeValued: z.number().positive().optional(),
  unlistedCompanyName: z.string().min(1),
  cinOrPan: z.string().optional(),
  valuationDate: z.string().min(1),
});

const auditScanSchema = z.object({
  transactions: z.array(
    z.object({
      id: z.string(),
      date: z.string(),
      partyName: z.string(),
      partyPan: z.string().optional(),
      amount: z.number().positive(),
      paymentMode: z.enum(["cash", "neft", "rtgs", "cheque", "upi", "journal"]),
      type: z.enum(["expense", "loan_taken", "loan_repaid", "statutory_due", "msme_vendor"]),
      dueDate: z.string().optional(),
      paymentDate: z.string().optional(),
      isMsmeRegistered: z.boolean().optional(),
    })
  ).min(1),
});

const noticeAdvisorSchema = z.object({
  noticeSection: z.string().min(1),
  assessmentYear: z.string().min(4),
  dinNumber: z.string().optional(),
  allegationSummary: z.string().min(3),
  totalAdditionProposed: z.number().optional(),
  clientType: z.enum(["individual", "corporate", "llp", "firm"]).default("individual"),
});

/**
 * GET /api/tax-law/sections
 * Search and filter Income Tax statutory sections
 */
router.get("/sections", async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const profession = typeof req.query.profession === "string" && ["ca", "cs", "both"].includes(req.query.profession)
      ? (req.query.profession as "ca" | "cs" | "both")
      : undefined;
    const chapter = typeof req.query.chapter === "string" ? req.query.chapter : undefined;
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "20"), 10)));

    const result = await taxLawEngine.getSections(query, profession, chapter, page, limit);

    return res.json({
      success: true,
      data: result.sections,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    });
  } catch (error: any) {
    logger.error(`Error in GET /api/tax-law/sections: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve statutory sections",
        retryable: true,
      },
    });
  }
});

/**
 * GET /api/tax-law/sections/:sectionNumber
 * Get specific section with linked rules, circulars, precedents, 3CD clauses, and CS modules
 */
router.get("/sections/:sectionNumber", async (req: Request, res: Response) => {
  try {
    const { sectionNumber } = req.params;
    const result = await taxLawEngine.getSectionInterlinks(sectionNumber);

    if (!result.section) {
      return res.status(404).json({
        success: false,
        error: {
          error_code: "SECTION_NOT_FOUND",
          message: `Statutory Section ${sectionNumber} was not found in the legal library.`,
          retryable: false,
        },
      });
    }

    return res.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    });
  } catch (error: any) {
    logger.error(`Error in GET /api/tax-law/sections/${req.params.sectionNumber}: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve section interlinks",
        retryable: true,
      },
    });
  }
});

/**
 * GET /api/tax-law/corporate-modules
 * Get all corporate law & financial regulatory modules (Companies Act, SEBI, PMLA, DPDP, CERT-In, GST)
 */
router.get("/corporate-modules", async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const result = await taxLawEngine.getCorporateModules(query);

    return res.json({
      success: true,
      data: result.modules,
      meta: {
        total: result.total,
        timestamp: new Date().toISOString(),
        version: "1.0",
      },
    });
  } catch (error: any) {
    logger.error(`Error in GET /api/tax-law/corporate-modules: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "INTERNAL_SERVER_ERROR",
        message: "Failed to retrieve corporate governance modules",
        retryable: true,
      },
    });
  }
});

/**
 * POST /api/tax-law/cs-valuation-11ua
 * Calculate Fair Market Value (FMV) under Rule 11UA for CS & Corporate Compliance
 */
router.post("/cs-valuation-11ua", async (req: Request, res: Response) => {
  try {
    const parsed = valuationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          error_code: "VALIDATION_ERROR",
          message: "Invalid valuation parameters provided",
          details: parsed.error.format(),
          retryable: false,
        },
      });
    }

    const output = taxLawEngine.calculateRule11UAValuation(parsed.data);

    return res.json({
      success: true,
      data: output,
      meta: {
        timestamp: output.calculation_timestamp,
        version: output.engine_version,
      },
    });
  } catch (error: any) {
    logger.error(`Error in POST /api/tax-law/cs-valuation-11ua: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "CALCULATION_ERROR",
        message: error.message || "Failed to execute Rule 11UA valuation",
        retryable: false,
      },
    });
  }
});

/**
 * POST /api/tax-law/audit-scan
 * Run automated Form 3CD clause compliance scan on financial records
 */
router.post("/audit-scan", async (req: Request, res: Response) => {
  try {
    const parsed = auditScanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          error_code: "VALIDATION_ERROR",
          message: "Invalid transaction payload for audit scan",
          details: parsed.error.format(),
          retryable: false,
        },
      });
    }

    const scanResult = taxLawEngine.runForm3cdAuditScan(parsed.data.transactions);

    return res.json({
      success: true,
      data: scanResult,
      meta: {
        timestamp: scanResult.calculation_timestamp,
        version: scanResult.engine_version,
      },
    });
  } catch (error: any) {
    logger.error(`Error in POST /api/tax-law/audit-scan: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "AUDIT_SCAN_ERROR",
        message: error.message || "Failed to complete Form 3CD audit scan",
        retryable: true,
      },
    });
  }
});

/**
 * POST /api/tax-law/notice-advisor
 * FASP-AI Decision Support for drafting Income Tax Notice responses
 */
router.post("/notice-advisor", async (req: Request, res: Response) => {
  try {
    const parsed = noticeAdvisorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          error_code: "VALIDATION_ERROR",
          message: "Invalid notice advisor request data",
          details: parsed.error.format(),
          retryable: false,
        },
      });
    }

    const output = taxLawEngine.generateNoticeDefense(parsed.data);

    return res.json({
      success: true,
      data: output,
      meta: {
        timestamp: output.timestamp,
        version: output.model_version,
      },
    });
  } catch (error: any) {
    logger.error(`Error in POST /api/tax-law/notice-advisor: ${error.message}`);
    return res.status(500).json({
      success: false,
      error: {
        error_code: "NOTICE_ADVISORY_ERROR",
        message: error.message || "Failed to generate notice defense",
        retryable: true,
      },
    });
  }
});

export default router;
