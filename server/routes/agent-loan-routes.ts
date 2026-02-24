import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { z } from "zod";
import { nanoid } from "nanoid";
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
import { users, agentClientMappingRequests } from "@shared/schema";
import {
  OriginationMode,
  RoutingIntent,
  WorkflowOwner,
  AGENT_ASSISTED_DEFAULTS,
  CURRENT_COMMISSION_POLICY_VERSION,
} from "@shared/loan-origination.constants";

const router = Router();

const AGENT_ROLES = ["agent", "sub_agent", "master_agent", "associate", "tester"];

async function requireAgentRole(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  
  const userRole = user.role || user.roles?.[0];
  if (!userRole || !AGENT_ROLES.includes(userRole)) {
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
    .select({ assignedAgentId: users.assignedAgentId })
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

router.post("/applications", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = createAgentApplicationSchema.parse(req.body);

    if (parsed.clientMode === "existing" && !parsed.clientId) {
      return res.status(400).json({
        success: false,
        error: "clientId is required when clientMode is 'existing'",
      });
    }

    if (parsed.clientMode === "existing" && parsed.clientId) {
      const isValidMapping = await validateAgentClientMapping(agentId, parsed.clientId);
      if (!isValidMapping) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to create applications for this client. Please request mapping approval from admin.",
        });
      }
    }

    if (parsed.routingMode === "manual" && (!parsed.targetBanks || parsed.targetBanks.length === 0)) {
      return res.status(400).json({
        success: false,
        error: "At least one bank must be selected when using manual routing mode.",
      });
    }

    const applicationNumber = generateApplicationNumber();

    let leadRegistryId: string | undefined;
    try {
      if (parsed.applicantPan && parsed.applicantPhone) {
        const loanTypeMap: Record<string, string> = {
          personal: "Personal Loan", home: "Home Loan", car: "Car Loan",
          business: "Business Loan", education: "Education Loan",
          gold: "Gold Loan", lap: "Loan Against Property", las: "Loan Against Securities",
        };
        const leadResult = await leadRegistryService.registerLead({
          pan: parsed.applicantPan,
          mobile: parsed.applicantPhone,
          customerName: parsed.applicantName,
          loanType: loanTypeMap[parsed.loanType] || parsed.loanType,
          approxAmount: parsed.requestedAmount.toString(),
          agentId,
          partnerId: agentId,
          ipAddress: req.ip,
        });
        if (leadResult.success) {
          leadRegistryId = leadResult.lead.leadId;
          if (!leadResult.lead.processingMode) {
            await leadRegistryService.setProcessingMode(
              leadResult.lead.leadId,
              parsed.processingMode,
              agentId,
              req.ip,
            );
          }
          if (parsed.processingMode === "EXTERNAL_FINANCIER" && parsed.financierName) {
            try {
              await leadRegistryService.setFinancierDetails(
                leadResult.lead.leadId,
                {
                  financierName: parsed.financierName,
                  bankerName: parsed.bankerName || "",
                  bankerMobile: parsed.bankerMobile || "",
                  bankerEmail: parsed.bankerEmail || "",
                },
                agentId,
                req.ip,
              );
            } catch (_) {}
          }
        }
      }
    } catch (_) {}

    const [application] = await db
      .insert(dsaLoanApplications)
      .values({
        applicationNumber,
        applicantType: parsed.applicantType,
        applicantName: parsed.applicantName,
        applicantPhone: parsed.applicantPhone,
        applicantEmail: parsed.applicantEmail,
        applicantPan: parsed.applicantPan,
        applicantAadhaar: parsed.applicantAadhaar,
        dateOfBirth: parsed.dateOfBirth,
        gender: parsed.gender,
        addressLine1: parsed.addressLine1,
        addressLine2: parsed.addressLine2,
        city: parsed.city,
        state: parsed.state,
        pincode: parsed.pincode,
        employmentType: parsed.employmentType,
        companyName: parsed.companyName,
        designation: parsed.designation,
        workExperience: parsed.workExperience,
        monthlyIncome: parsed.monthlyIncome.toString(),
        annualIncome: parsed.annualIncome?.toString(),
        otherIncome: parsed.otherIncome?.toString(),
        loanType: parsed.loanType,
        requestedAmount: parsed.requestedAmount.toString(),
        requestedTenure: parsed.requestedTenure,
        loanPurpose: parsed.loanPurpose,
        existingLoans: parsed.existingLoans,
        existingEmiAmount: parsed.existingEmiAmount?.toString(),
        creditScore: parsed.creditScore,
        status: "draft",
        currentStage: "application",
        agentId,
        assistedByAgent: true,
        clientMode: parsed.clientMode as any,
        clientId: parsed.clientId,
        processingMode: parsed.processingMode,
        financierName: parsed.financierName,
        bankerName: parsed.bankerName,
        bankerMobile: parsed.bankerMobile,
        bankerEmail: parsed.bankerEmail,
        leadRegistryId,
        routingMode: parsed.processingMode === "PLATFORM" ? (parsed.routingMode as any) : undefined,
        targetBanks: parsed.processingMode === "PLATFORM" ? (parsed.targetBanks || []) : [],
        dsaCode: parsed.dsaCode,
        subDsaCode: parsed.subDsaCode,
        originationMode: AGENT_ASSISTED_DEFAULTS.originationMode,
        routingIntent: AGENT_ASSISTED_DEFAULTS.routingIntent,
        workflowOwner: AGENT_ASSISTED_DEFAULTS.workflowOwner,
        commissionPolicyVersion: CURRENT_COMMISSION_POLICY_VERSION,
      } as any)
      .returning();

    await logAgentAction({
      applicationId: application.id,
      agentId,
      actionType: "create",
      actionDescription: `Created loan application for ${parsed.applicantName} (${parsed.processingMode})`,
      newValue: { loanType: parsed.loanType, amount: parsed.requestedAmount, clientMode: parsed.clientMode, processingMode: parsed.processingMode },
      req,
    });

    if (parsed.processingMode === "EXTERNAL_FINANCIER" && parsed.financierName) {
      try {
        if (parsed.bankerMobile) {
          await db.insert(bankerContacts).values({
            agentId,
            financierName: parsed.financierName,
            bankerName: parsed.bankerName || "",
            bankerMobile: parsed.bankerMobile,
            bankerEmail: parsed.bankerEmail || undefined,
          }).onConflictDoUpdate({
            target: [bankerContacts.agentId, bankerContacts.financierName, bankerContacts.bankerMobile],
            set: {
              bankerName: parsed.bankerName || "",
              bankerEmail: parsed.bankerEmail || undefined,
              usageCount: sql`${bankerContacts.usageCount} + 1`,
              lastUsedAt: new Date(),
              updatedAt: new Date(),
            },
          });
        } else {
          await db.insert(bankerContacts).values({
            agentId,
            financierName: parsed.financierName,
            bankerName: parsed.bankerName || "",
            bankerEmail: parsed.bankerEmail || undefined,
          });
        }
      } catch (_) {}
    }

    let zohoLeadId: string | null = null;
    try {
      const { ZohoConnectionResolver } = await import("../zoho/connection-resolver");
      const { ZohoCRMService } = await import("../zoho/services/crm");
      const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
      if (connection) {
        const crmService = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
        const masterZohoAccountId = await ZohoConnectionResolver.getMasterAgentZohoAccountId(connection.connectionId);
        zohoLeadId = await crmService.syncLoanLeadToCRM({
          applicationId: application.id,
          applicationNumber,
          applicantName: parsed.applicantName,
          applicantEmail: parsed.applicantEmail,
          applicantPhone: parsed.applicantPhone,
          loanType: parsed.loanType,
          requestedAmount: parsed.requestedAmount.toString(),
          requestedTenure: parsed.requestedTenure,
          loanPurpose: parsed.loanPurpose,
          processingMode: parsed.processingMode,
          financierName: parsed.financierName,
          bankerName: parsed.bankerName,
          bankerMobile: parsed.bankerMobile,
          bankerEmail: parsed.bankerEmail,
          agentId,
          masterAgentZohoAccountId: masterZohoAccountId || undefined,
        });
        console.log(`[Zoho CRM] Loan lead ${applicationNumber} synced to Zoho Lead ${zohoLeadId}`);
      }
    } catch (zohoError: any) {
      console.warn("[Zoho CRM] Loan lead sync failed (non-blocking):", zohoError?.message);
    }

    res.status(201).json({
      success: true,
      data: application,
      leadRegistryId,
      zohoLeadId,
      message: `Loan lead ${parsed.processingMode === "EXTERNAL_FINANCIER" ? "(bank-processed)" : "(agent-processed)"} created successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/applications", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { status, loanType, limit = "50", offset = "0" } = req.query;

    const conditions = [
      eq(dsaLoanApplications.agentId, agentId),
      eq(dsaLoanApplications.assistedByAgent, true),
    ];

    if (status) {
      conditions.push(eq(dsaLoanApplications.status, status as any));
    }
    if (loanType) {
      conditions.push(eq(dsaLoanApplications.loanType, loanType as string));
    }

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(and(...conditions))
      .orderBy(desc(dsaLoanApplications.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dsaLoanApplications)
      .where(and(...conditions));

    res.json({
      success: true,
      data: applications,
      meta: {
        total: Number(countResult?.count || 0),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/applications/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, req.params.id),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    res.json({ success: true, data: application });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const updateStatusSchema = z.object({
  status: z.enum([
    "draft", "submitted", "eligibility_check", "routed", "pending_with_banks",
    "in_review", "approved", "rejected", "disbursed", "withdrawn", "expired"
  ]),
  remarks: z.string().min(1, "Remarks are required for status updates"),
  bankCode: z.string().optional(),
  bankReference: z.string().optional(),
});

router.post("/applications/:id/status", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = updateStatusSchema.parse(req.body);

    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, req.params.id),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    const currentStatus = application.status;
    const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(parsed.status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status transition from '${currentStatus}' to '${parsed.status}'`,
        allowedTransitions,
      });
    }

    const [updated] = await db
      .update(dsaLoanApplications)
      .set({
        status: parsed.status as any,
        statusRemarks: parsed.remarks,
        lastStatusUpdateBy: agentId,
        lastStatusUpdateAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanApplications.id, req.params.id))
      .returning();

    await db.insert(agentLoanStatusHistory).values({
      applicationId: req.params.id,
      previousStatus: currentStatus,
      newStatus: parsed.status,
      changedBy: agentId,
      changedByType: "agent",
      remarks: parsed.remarks,
      bankCode: parsed.bankCode,
      bankReference: parsed.bankReference,
    });

    await logAgentAction({
      applicationId: req.params.id,
      agentId,
      actionType: "status_update",
      actionDescription: `Status changed from ${currentStatus} to ${parsed.status}`,
      previousValue: { status: currentStatus },
      newValue: { status: parsed.status, remarks: parsed.remarks },
      affectedFields: ["status", "statusRemarks"],
      bankCode: parsed.bankCode,
      remarks: parsed.remarks,
      req,
    });

    res.json({
      success: true,
      data: updated,
      message: `Status updated to ${parsed.status}`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.post("/applications/:id/submit-to-bank", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { bankCodes, submissionReference, lenderDisclaimerAccepted } = req.body;

    if (!bankCodes || !Array.isArray(bankCodes) || bankCodes.length === 0) {
      return res.status(400).json({ success: false, error: "bankCodes array is required" });
    }

    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, req.params.id),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    // SUB-DSA GOVERNANCE: Enforce lender disclaimer before first bank submission
    if (!(application as any).lenderDisclaimerAt) {
      if (!lenderDisclaimerAccepted) {
        return res.status(400).json({
          success: false,
          error: "Lender disclaimer must be accepted before first bank submission",
          disclaimerRequired: true,
          disclaimerText: "FintekPro acts as a Sub-DSA / facilitation platform. Final credit decision rests with the lender.",
        });
      }
      // Record disclaimer acceptance
      await db
        .update(dsaLoanApplications)
        .set({ lenderDisclaimerAt: new Date() } as any)
        .where(eq(dsaLoanApplications.id, req.params.id));
    }

    const banks = await db
      .select()
      .from(bankConnectors)
      .where(inArray(bankConnectors.bankCode, bankCodes));

    if (banks.length === 0) {
      return res.status(400).json({ success: false, error: "No valid banks found" });
    }

    const routingHistoryIds: string[] = [];
    for (let i = 0; i < banks.length; i++) {
      const bank = banks[i];
      const [routing] = await db
        .insert(loanRoutingHistory)
        .values({
          applicationId: req.params.id,
          bankCode: bank.bankCode,
          routingStrategy: "manual",
          routingMode: "manual" as any,
          routingPriority: i + 1,
          submissionMethod: "agent_manual",
          submissionReference,
          submittedByAgentId: agentId,
          bankStatus: "pending",
        } as any)
        .returning();
      routingHistoryIds.push(routing.id);
    }

    await db
      .update(dsaLoanApplications)
      .set({
        status: "routed",
        routingMode: "manual" as any,
        routedBanks: bankCodes,
        targetBanks: bankCodes,
        routedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanApplications.id, req.params.id));

    await logAgentAction({
      applicationId: req.params.id,
      agentId,
      actionType: "manual_route",
      actionDescription: `Manually submitted to banks: ${bankCodes.join(", ")}`,
      newValue: { bankCodes, routingMode: "manual" },
      affectedFields: ["routedBanks", "routingMode", "status"],
      req,
    });

    // SUB-DSA GOVERNANCE: Log bank interaction events for audit trail
    for (const bankCode of bankCodes) {
      await db.insert(bankInteractionEvents).values({
        loanId: req.params.id,
        bankCode,
        eventType: "RECEIVED" as any,
        reportedBy: "AGENT" as any,
        reportedById: agentId,
        referenceId: submissionReference,
        remarks: `Application submitted to ${bankCode} via agent manual routing`,
      } as any);
    }

    res.json({
      success: true,
      data: {
        applicationId: req.params.id,
        routedBanks: bankCodes,
        routingHistoryIds,
        routingMode: "manual",
      },
      message: "Application manually submitted to selected banks",
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const recordDisbursementSchema = z.object({
  disbursedAmount: z.number().positive(),
  disbursementDate: z.string(),
  bankConfirmationNumber: z.string().min(1),
  disbursementProofUrl: z.string().url().optional(),
  bankCode: z.string(),
});

router.post("/applications/:id/record-disbursement", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = recordDisbursementSchema.parse(req.body);

    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, req.params.id),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    if (application.status !== "approved") {
      return res.status(400).json({
        success: false,
        error: "Only approved loans can have disbursement recorded",
      });
    }

    const [updated] = await db
      .update(dsaLoanApplications)
      .set({
        status: "disbursed",
        actualDisbursedAmount: parsed.disbursedAmount.toString(),
        actualDisbursementDate: parsed.disbursementDate,
        bankConfirmationNumber: parsed.bankConfirmationNumber,
        disbursementProofUrl: parsed.disbursementProofUrl,
        updatedAt: new Date(),
      })
      .where(eq(dsaLoanApplications.id, req.params.id))
      .returning();

    await db
      .update(loanRoutingHistory)
      .set({
        disbursedAmount: parsed.disbursedAmount.toString(),
        disbursedAt: new Date(parsed.disbursementDate),
        disbursementReference: parsed.bankConfirmationNumber,
        bankStatus: "disbursed",
      })
      .where(
        and(
          eq(loanRoutingHistory.applicationId, req.params.id),
          eq(loanRoutingHistory.bankCode, parsed.bankCode)
        )
      );

    await logAgentAction({
      applicationId: req.params.id,
      agentId,
      actionType: "disbursement_record",
      actionDescription: `Recorded disbursement of ₹${parsed.disbursedAmount}`,
      newValue: parsed,
      affectedFields: ["status", "actualDisbursedAmount", "actualDisbursementDate"],
      bankCode: parsed.bankCode,
      req,
    });

    res.json({
      success: true,
      data: updated,
      message: "Disbursement recorded successfully",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

const claimPayoutSchema = z.object({
  claimedAmount: z.number().positive(),
  disbursementProofUrl: z.string().url().optional(),
});

router.post("/applications/:id/claim-payout", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = claimPayoutSchema.parse(req.body);

    const [application] = await db
      .select()
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.id, req.params.id),
          eq(dsaLoanApplications.agentId, agentId)
        )
      )
      .limit(1);

    if (!application) {
      return res.status(404).json({ success: false, error: "Application not found" });
    }

    if (application.status !== "disbursed") {
      return res.status(400).json({
        success: false,
        error: "Payout can only be claimed for disbursed loans",
      });
    }

    const existingClaim = await db
      .select()
      .from(agentPayoutClaims)
      .where(
        and(
          eq(agentPayoutClaims.applicationId, req.params.id),
          eq(agentPayoutClaims.agentId, agentId)
        )
      )
      .limit(1);

    if (existingClaim.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Payout claim already exists for this application",
        existingClaim: existingClaim[0],
      });
    }

    const claimNumber = generateClaimNumber();

    const [claim] = await db
      .insert(agentPayoutClaims)
      .values({
        claimNumber,
        applicationId: req.params.id,
        agentId,
        claimedAmount: parsed.claimedAmount.toString(),
        disbursedAmount: application.actualDisbursedAmount || "0",
        disbursementDate: application.actualDisbursementDate || new Date().toISOString().split("T")[0],
        bankConfirmationNumber: application.bankConfirmationNumber,
        disbursementProofUrl: parsed.disbursementProofUrl || application.disbursementProofUrl,
        status: "pending",
      } as any)
      .returning();

    await logAgentAction({
      applicationId: req.params.id,
      agentId,
      actionType: "payout_claim",
      actionDescription: `Claimed payout of ₹${parsed.claimedAmount}`,
      newValue: { claimNumber, claimedAmount: parsed.claimedAmount },
      req,
    });

    res.status(201).json({
      success: true,
      data: claim,
      message: "Payout claim submitted successfully",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/payout-claims", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const { status } = req.query;

    const conditions = [eq(agentPayoutClaims.agentId, agentId)];
    if (status) {
      conditions.push(eq(agentPayoutClaims.status, status as any));
    }

    const claims = await db
      .select()
      .from(agentPayoutClaims)
      .where(and(...conditions))
      .orderBy(desc(agentPayoutClaims.createdAt));

    res.json({ success: true, data: claims });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
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
        pan: users.pan,
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
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
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
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
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
        disbursedAmount: dsaLoanApplications.actualDisbursedAmount,
        bankCode: dsaLoanApplications.selectedBankCode,
        disbursedAt: dsaLoanApplications.disbursementDate,
      })
      .from(dsaLoanApplications)
      .where(
        and(
          eq(dsaLoanApplications.agentId, agentId),
          eq(dsaLoanApplications.status, "disbursed")
        )
      )
      .orderBy(desc(dsaLoanApplications.disbursementDate));

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
        invoiceNumber: agentPayoutClaims.invoiceNumber,
        remarks: agentPayoutClaims.remarks,
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

router.get("/my-applications", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(eq(dsaLoanApplications.agentId, agentId))
      .orderBy(desc(dsaLoanApplications.createdAt));

    res.json({ success: true, data: applications });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/banker-contacts", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const search = (req.query.search as string) || "";
    const contacts = await db
      .select()
      .from(bankerContacts)
      .where(
        and(
          eq(bankerContacts.agentId, agentId),
          eq(bankerContacts.isActive, true)
        )
      )
      .orderBy(desc(bankerContacts.lastUsedAt));

    const filtered = search
      ? contacts.filter(c =>
          c.financierName.toLowerCase().includes(search.toLowerCase()) ||
          c.bankerName.toLowerCase().includes(search.toLowerCase())
        )
      : contacts;

    res.json({ success: true, data: filtered });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/banker-contacts", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const schema = z.object({
      financierName: z.string().min(1),
      bankerName: z.string().min(1),
      bankerMobile: z.string().optional(),
      bankerEmail: z.string().email().optional().or(z.literal("")),
      designation: z.string().optional(),
      branch: z.string().optional(),
      supportedLoanTypes: z.array(z.string()).optional(),
      notes: z.string().optional(),
    });
    const parsed = schema.parse(req.body);

    const [contact] = await db.insert(bankerContacts).values({
      agentId,
      ...parsed,
      bankerEmail: parsed.bankerEmail || undefined,
    }).onConflictDoUpdate({
      target: [bankerContacts.agentId, bankerContacts.financierName, bankerContacts.bankerMobile],
      set: {
        bankerName: parsed.bankerName,
        bankerEmail: parsed.bankerEmail || undefined,
        designation: parsed.designation,
        branch: parsed.branch,
        notes: parsed.notes,
        updatedAt: new Date(),
      },
    }).returning();

    res.status(201).json({ success: true, data: contact });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.put("/banker-contacts/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const schema = z.object({
      financierName: z.string().min(1).optional(),
      bankerName: z.string().min(1).optional(),
      bankerMobile: z.string().optional(),
      bankerEmail: z.string().email().optional().or(z.literal("")),
      designation: z.string().optional(),
      branch: z.string().optional(),
      supportedLoanTypes: z.array(z.string()).optional(),
      notes: z.string().optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    const [updated] = await db
      .update(bankerContacts)
      .set({ ...parsed, updatedAt: new Date() })
      .where(and(eq(bankerContacts.id, req.params.id), eq(bankerContacts.agentId, agentId)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: "Contact not found" });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/banker-contacts/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) return res.status(401).json({ success: false, error: "Unauthorized" });

    const [updated] = await db
      .update(bankerContacts)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(bankerContacts.id, req.params.id), eq(bankerContacts.agentId, agentId)))
      .returning();

    if (!updated) return res.status(404).json({ success: false, error: "Contact not found" });
    res.json({ success: true, message: "Contact removed" });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
