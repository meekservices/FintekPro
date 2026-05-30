import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, inArray, or, ilike } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
import multer from "multer";
import ExcelJS from "exceljs";
import { leadRegistryService } from "../services/lead-registry-service";
import {
  dsaLoanApplications,
  dsaLoanDocuments,
  loanRoutingHistory,
  bankConnectors,
  agentLoanActions,
  agentPayoutClaims,
  agentLoanStatusHistory,
  dsaCommissionTracking,
  bankInteractionEvents,
  bankerContacts,
} from "@shared/dsa-loan-schema";
import * as schema from "@shared/schema";
import { users, agentClientMappingRequests } from "@shared/schema";
import {
  OriginationMode,
  RoutingIntent,
  WorkflowOwner,
  AGENT_ASSISTED_DEFAULTS,
  CURRENT_COMMISSION_POLICY_VERSION,
} from "@shared/loan-origination.constants";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const AGENT_ROLES = ["agent", "sub_agent", "master_agent", "associate", "tester"];

async function requireAgentRole(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  
  const userRoles: string[] = user.roles || (user.role ? [user.role] : []);
  const hasAgentRole = userRoles.some((r: string) => AGENT_ROLES.includes(r));
  if (!hasAgentRole) {
    return res.status(403).json({ 
      success: false, 
      error: "Access denied. Agent role required.",
      requiredRoles: AGENT_ROLES,
    });
  }
  
  next();
}

async function validateAgentClientMapping(agentId: string, clientId: string): Promise<boolean> {
  const [client] = await db
    .select({ assignedAgentId: (users as any).assignedAgentId })
    .from(users)
    .where(eq(users.id, clientId))
    .limit(1);
  
  if (client?.assignedAgentId === agentId) {
    return true;
  }
  
  const [mapping] = await db
    .select()
    .from(agentClientMappingRequests)
    .where(
      and(
        eq(agentClientMappingRequests.agentId, agentId),
        eq(agentClientMappingRequests.clientId, clientId),
        eq(agentClientMappingRequests.status, "approved")
      )
    )
    .limit(1);
  
  return !!mapping;
}

router.use(requireAgentRole);

const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["eligibility_check", "withdrawn"],
  eligibility_check: ["routed", "rejected", "withdrawn"],
  routed: ["pending_with_banks", "rejected", "withdrawn"],
  pending_with_banks: ["in_review", "rejected", "withdrawn"],
  in_review: ["approved", "rejected", "withdrawn"],
  approved: ["disbursed", "withdrawn"],
  disbursed: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

function generateClaimNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `CLM${year}${month}${nanoid(6).toUpperCase()}`;
}

function generateApplicationNumber(): string {
  const prefix = "AGT";
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = nanoid(6).toUpperCase();
  return `${prefix}${year}${month}${random}`;
}

async function logAgentAction(params: {
  applicationId: string;
  agentId: string;
  actionType: string;
  actionDescription?: string;
  previousValue?: any;
  newValue?: any;
  affectedFields?: string[];
  bankCode?: string;
  documentId?: string;
  remarks?: string;
  req?: Request;
}) {
  const agent = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
    .from(users)
    .where(eq(users.id, params.agentId))
    .limit(1);

  await db.insert(agentLoanActions).values({
    applicationId: params.applicationId,
    agentId: params.agentId,
    agentName: agent[0] ? `${agent[0].firstName || ""} ${agent[0].lastName || ""}`.trim() : undefined,
    agentEmail: agent[0]?.email,
    actionType: params.actionType,
    actionDescription: params.actionDescription,
    previousValue: params.previousValue,
    newValue: params.newValue,
    affectedFields: params.affectedFields || [],
    bankCode: params.bankCode,
    documentId: params.documentId,
    remarks: params.remarks,
    ipAddress: params.req?.ip,
    userAgent: params.req?.headers["user-agent"],
    sessionId: (params.req as any)?.session?.id,
  });
}

const createAgentApplicationSchema = z.object({
  clientMode: z.enum(["new", "existing"]),
  clientId: z.string().optional(),
  applicantType: z.enum(["individual", "business"]).default("individual"),
  applicantName: z.string().min(1),
  applicantPhone: z.string().regex(/^[6-9]\d{9}$/),
  applicantEmail: z.string().email().optional(),
  applicantPan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).optional(),
  applicantAadhaar: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  employmentType: z.enum(["salaried", "self_employed", "business", "professional"]),
  companyName: z.string().optional(),
  designation: z.string().optional(),
  workExperience: z.number().int().optional(),
  monthlyIncome: z.number().positive(),
  annualIncome: z.number().positive().optional(),
  otherIncome: z.number().optional(),
  loanType: z.enum(["personal", "home", "car", "business", "education", "gold", "lap", "las"]),
  requestedAmount: z.number().positive(),
  requestedTenure: z.number().int().min(6).max(360),
  loanPurpose: z.string().optional(),
  existingLoans: z.number().int().optional(),
  existingEmiAmount: z.number().optional(),
  creditScore: z.number().int().min(300).max(900).optional(),
  processingMode: z.enum(["PLATFORM", "EXTERNAL_FINANCIER"]).default("PLATFORM"),
  financierName: z.string().optional(),
  bankerName: z.string().optional(),
  bankerMobile: z.string().optional(),
  bankerEmail: z.string().email().optional(),
  routingMode: z.enum(["auto", "manual"]).default("auto"),
  targetBanks: z.array(z.string()).optional(),
  dsaCode: z.string().optional(),
  subDsaCode: z.string().optional(),
});

router.get("/clients-for-loan", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const clients = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        mobile: users.mobile,
        pan: (users as any).pan,
      })
      .from(users)
      .where(eq(users.assignedAgentId, agentId))
      .orderBy(users.firstName);

    res.json({
      success: true,
      data: clients.map((c) => ({
        ...c,
        fullName: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/actions/:applicationId", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const actions = await db
      .select()
      .from(agentLoanActions)
      .where(eq(agentLoanActions.applicationId, req.params.applicationId))
      .orderBy(desc(agentLoanActions.createdAt));

    res.json({ success: true, data: actions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/status-history/:applicationId", async (req: Request, res: Response) => {
  try {
    const history = await db
      .select()
      .from(agentLoanStatusHistory)
      .where(eq(agentLoanStatusHistory.applicationId, req.params.applicationId))
      .orderBy(desc(agentLoanStatusHistory.createdAt));

    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const updateDocumentVisibilitySchema = z.object({
  visibleToBank: z.boolean(),
});

router.patch("/documents/:documentId/visibility", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = updateDocumentVisibilitySchema.parse(req.body);

    const [document] = await db
      .select()
      .from(dsaLoanDocuments)
      .where(eq(dsaLoanDocuments.id, req.params.documentId))
      .limit(1);

    if (!document) {
      return res.status(404).json({ success: false, error: "Document not found" });
    }

    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, document.applicationId),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(403).json({ success: false, error: "Not authorized to modify this document" });
    }

    const [updated] = await db
      .update(dsaLoanDocuments)
      .set({
        visibleToBank: parsed.visibleToBank,
        bankVisibilityChangedBy: agentId,
        bankVisibilityChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanDocuments.id, req.params.documentId))
      .returning();

    await logAgentAction({
      applicationId: document.applicationId,
      agentId,
      actionType: "document_visibility_change",
      actionDescription: `Changed document visibility to ${parsed.visibleToBank ? "visible" : "hidden"}`,
      previousValue: { visibleToBank: document.visibleToBank },
      newValue: { visibleToBank: parsed.visibleToBank },
      documentId: req.params.documentId,
      req,
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.post("/documents", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const schema = z.object({
      applicationId: z.string(),
      documentType: z.string(),
      documentName: z.string(),
      fileName: z.string(),
      storageUrl: z.string().url(),
      fileSize: z.number().optional(),
      mimeType: z.string().optional(),
      visibleToBank: z.boolean().default(true),
    });

    const parsed = schema.parse(req.body);

    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, parsed.applicationId),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(403).json({ success: false, error: "Not authorized to add documents to this application" });
    }

    const [document] = await db
      .insert(dsaLoanDocuments)
      .values({
        applicationId: parsed.applicationId,
        documentType: parsed.documentType,
        documentName: parsed.documentName,
        fileName: parsed.fileName,
        storageUrl: parsed.storageUrl,
        fileSize: parsed.fileSize,
        mimeType: parsed.mimeType,
        uploadedBy: "agent" as any,
        uploadedById: agentId,
        visibleToBank: parsed.visibleToBank,
        status: "pending",
      } as any)
      .returning();

    await logAgentAction({
      applicationId: parsed.applicationId,
      agentId,
      actionType: "document_upload",
      actionDescription: `Uploaded document: ${parsed.documentName}`,
      newValue: { documentType: parsed.documentType, fileName: parsed.fileName },
      documentId: document.id,
      req,
    });

    res.status(201).json({ success: true, data: document });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.issues });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.agentId, agentId),
          eq(dsaLoanApplications.assistedByAgent, true)
        )
      );

    const stats = {
      total: applications.length,
      byStatus: {} as Record<string, number>,
      byLoanType: {} as Record<string, number>,
      totalDisbursed: 0,
      pendingPayoutClaims: 0,
    };

    applications.forEach((app) => {
      stats.byStatus[app.status] = (stats.byStatus[app.status] || 0) + 1;
      stats.byLoanType[app.loanType] = (stats.byLoanType[app.loanType] || 0) + 1;
      if (app.status === "disbursed" && app.actualDisbursedAmount) {
        stats.totalDisbursed += Number(app.actualDisbursedAmount);
      }
    });

    const [pendingClaims] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentPayoutClaims)
      .where(
        and(
          eq(agentPayoutClaims.agentId, agentId),
          eq(agentPayoutClaims.status, "pending")
        )
      );

    stats.pendingPayoutClaims = Number(pendingClaims?.count || 0);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/disbursed", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const disbursedLoans = await db
      .select({
        id: dsaLoanApplications.id,
        applicationNumber: dsaLoanApplications.applicationNumber,
        applicantName: dsaLoanApplications.applicantName,
        loanType: dsaLoanApplications.loanType,
        disbursedAmount: (dsaLoanApplications as any).actualDisbursedAmount,
        bankCode: (dsaLoanApplications as any).selectedBankCode,
        disbursedAt: (dsaLoanApplications as any).disbursementDate,
      })
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.agentId, agentId),
          eq(dsaLoanApplications.status, "disbursed")
        )
      )
      .orderBy(desc((dsaLoanApplications as any).disbursementDate));

    const existingClaims = await db
      .select({ applicationId: agentPayoutClaims.applicationId, status: agentPayoutClaims.status })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.agentId, agentId));

    const claimMap = new Map(existingClaims.map(c => [c.applicationId, c.status]));

    const banksData = await db.select().from(bankConnectors);
    const bankMap = new Map(banksData.map(b => [b.bankCode, b.bankName]));

    const result = disbursedLoans.map(loan => ({
      ...loan,
      bankName: bankMap.get(loan.bankCode || "") || loan.bankCode,
      hasClaim: claimMap.has(loan.id),
      claimStatus: claimMap.get(loan.id),
    }));

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/my-payout-claims", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const claimsResult = await db
      .select({
        id: agentPayoutClaims.id,
        claimNumber: agentPayoutClaims.claimNumber,
        applicationId: agentPayoutClaims.applicationId,
        agentId: agentPayoutClaims.agentId,
        claimedAmount: agentPayoutClaims.claimedAmount,
        status: agentPayoutClaims.status,
        invoiceNumber: (agentPayoutClaims as any).invoiceNumber,
        remarks: (agentPayoutClaims as any).remarks,
        adminRemarks: agentPayoutClaims.reviewRemarks,
        zohoInvoiceId: agentPayoutClaims.zohoInvoiceId,
        paymentDate: agentPayoutClaims.paymentDate,
        paymentReference: agentPayoutClaims.paymentReference,
        createdAt: agentPayoutClaims.createdAt,
        updatedAt: agentPayoutClaims.updatedAt,
        applicationNumber: dsaLoanApplications.applicationNumber,
        applicantName: dsaLoanApplications.applicantName,
        loanType: dsaLoanApplications.loanType,
        disbursedAmount: dsaLoanApplications.actualDisbursedAmount,
      })
      .from(agentPayoutClaims)
      .innerJoin(dsaLoanApplications, eq(agentPayoutClaims.applicationId, dsaLoanApplications.id))
      .where(eq(agentPayoutClaims.agentId, agentId))
      .orderBy(desc(agentPayoutClaims.createdAt));

    const claims = claimsResult.map(c => ({
      ...c,
      claimAmount: c.claimedAmount,
    }));

    res.json({ success: true, data: claims });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


export default router;
