import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  agentPayoutClaims,
  dsaLoanApplications,
  agentLoanActions,
} from "@shared/dsa-loan-schema";
import { users } from "@shared/schema";

const router = Router();

const ADMIN_ROLES = ["admin", "superadmin", "master_agent"];

async function requireAdminRole(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  
  const userRole = user.role || user.roles?.[0];
  if (!userRole || !ADMIN_ROLES.includes(userRole)) {
    return res.status(403).json({ 
      success: false, 
      error: "Access denied. Admin role required.",
    });
  }
  
  next();
}

router.use(requireAdminRole);

router.get("/payout-claims", async (req: Request, res: Response) => {
  try {
    const { status, agentId, fromDate, toDate, limit = "50", offset = "0" } = req.query;

    const conditions = [];

    if (status && status !== "all") {
      conditions.push(eq(agentPayoutClaims.status, status as any));
    }
    if (agentId) {
      conditions.push(eq(agentPayoutClaims.agentId, agentId as string));
    }
    if (fromDate) {
      conditions.push(gte(agentPayoutClaims.createdAt, new Date(fromDate as string)));
    }
    if (toDate) {
      conditions.push(lte(agentPayoutClaims.createdAt, new Date(toDate as string)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const claims = await db
      .select({
        claim: agentPayoutClaims,
        agent: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        application: {
          applicationNumber: dsaLoanApplications.applicationNumber,
          applicantName: dsaLoanApplications.applicantName,
          loanType: dsaLoanApplications.loanType,
          disbursedAmount: dsaLoanApplications.actualDisbursedAmount,
        },
      })
      .from(agentPayoutClaims)
      .leftJoin(users, eq(agentPayoutClaims.agentId, users.id))
      .leftJoin(dsaLoanApplications, eq(agentPayoutClaims.applicationId, dsaLoanApplications.id))
      .where(whereClause)
      .orderBy(desc(agentPayoutClaims.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentPayoutClaims)
      .where(whereClause);

    const formattedClaims = claims.map((c) => ({
      ...c.claim,
      claimAmount: c.claim.claimedAmount,
      agentName: c.agent ? `${c.agent.firstName || ""} ${c.agent.lastName || ""}`.trim() : "Unknown",
      agentEmail: c.agent?.email,
      applicationNumber: c.application?.applicationNumber,
      applicantName: c.application?.applicantName,
      loanType: c.application?.loanType,
      disbursedAmount: c.application?.disbursedAmount,
    }));

    res.json({
      success: true,
      data: formattedClaims,
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

router.get("/payout-claims/:id", async (req: Request, res: Response) => {
  try {
    const [claim] = await db
      .select({
        claim: agentPayoutClaims,
        agent: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
        application: dsaLoanApplications,
      })
      .from(agentPayoutClaims)
      .leftJoin(users, eq(agentPayoutClaims.agentId, users.id))
      .leftJoin(dsaLoanApplications, eq(agentPayoutClaims.applicationId, dsaLoanApplications.id))
      .where(eq(agentPayoutClaims.id, req.params.id))
      .limit(1);

    if (!claim) {
      return res.status(404).json({ success: false, error: "Claim not found" });
    }

    res.json({
      success: true,
      data: {
        ...claim.claim,
        agentName: claim.agent ? `${claim.agent.firstName || ""} ${claim.agent.lastName || ""}`.trim() : "Unknown",
        agentEmail: claim.agent?.email,
        application: claim.application,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const reviewClaimSchema = z.object({
  action: z.enum(["approve", "reject"]),
  approvedAmount: z.number().positive().optional(),
  reviewRemarks: z.string().optional(),
  rejectionReason: z.string().optional(),
});

router.post("/payout-claims/:id/review", async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = reviewClaimSchema.parse(req.body);

    if (parsed.action === "reject" && !parsed.rejectionReason) {
      return res.status(400).json({
        success: false,
        error: "Rejection reason is required when rejecting a claim",
      });
    }

    const [claim] = await db
      .select()
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.id, req.params.id))
      .limit(1);

    if (!claim) {
      return res.status(404).json({ success: false, error: "Claim not found" });
    }

    if (claim.status !== "pending" && claim.status !== "under_review") {
      return res.status(400).json({
        success: false,
        error: `Cannot review claim with status '${claim.status}'`,
      });
    }

    const newStatus = parsed.action === "approve" ? "approved" : "rejected";

    const [updated] = await db
      .update(agentPayoutClaims)
      .set({
        status: newStatus as any,
        approvedAmount: parsed.action === "approve" 
          ? (parsed.approvedAmount?.toString() || claim.claimedAmount) 
          : undefined,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        reviewRemarks: parsed.reviewRemarks,
        rejectionReason: parsed.action === "reject" ? parsed.rejectionReason : undefined,
        updatedAt: new Date(),
      })
      .where(eq(agentPayoutClaims.id, req.params.id))
      .returning();

    await db.insert(agentLoanActions).values({
      applicationId: claim.applicationId,
      agentId: adminId,
      actionType: `payout_${parsed.action}`,
      actionDescription: `Payout claim ${parsed.action}ed by admin`,
      previousValue: { status: claim.status },
      newValue: { 
        status: newStatus, 
        approvedAmount: parsed.approvedAmount,
        rejectionReason: parsed.rejectionReason,
      },
    });

    res.json({
      success: true,
      data: updated,
      message: `Payout claim ${parsed.action}ed successfully`,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

const markPaidSchema = z.object({
  paymentReference: z.string().min(1),
  paymentDate: z.string(),
  paymentMode: z.enum(["bank_transfer", "upi", "cheque"]),
  zohoInvoiceId: z.string().optional(),
  zohoPaymentId: z.string().optional(),
});

router.post("/payout-claims/:id/mark-paid", async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const parsed = markPaidSchema.parse(req.body);

    const [claim] = await db
      .select()
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.id, req.params.id))
      .limit(1);

    if (!claim) {
      return res.status(404).json({ success: false, error: "Claim not found" });
    }

    if (claim.status !== "approved") {
      return res.status(400).json({
        success: false,
        error: "Only approved claims can be marked as paid",
      });
    }

    const [updated] = await db
      .update(agentPayoutClaims)
      .set({
        status: "paid" as any,
        paymentReference: parsed.paymentReference,
        paymentDate: parsed.paymentDate,
        paymentMode: parsed.paymentMode,
        zohoInvoiceId: parsed.zohoInvoiceId,
        zohoPaymentId: parsed.zohoPaymentId,
        updatedAt: new Date(),
      })
      .where(eq(agentPayoutClaims.id, req.params.id))
      .returning();

    res.json({
      success: true,
      data: updated,
      message: "Payout marked as paid",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, error: "Validation failed", details: error.errors });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

router.get("/payout-summary", async (req: Request, res: Response) => {
  try {
    const [pending] = await db
      .select({ 
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(claimed_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "pending"));

    const [underReview] = await db
      .select({ 
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(claimed_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "under_review"));

    const [approved] = await db
      .select({ 
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(approved_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "approved"));

    const [paid] = await db
      .select({ 
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(approved_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "paid"));

    const [rejected] = await db
      .select({ 
        count: sql<number>`count(*)`,
        total: sql<number>`COALESCE(SUM(claimed_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "rejected"));

    res.json({
      success: true,
      data: {
        pending: { count: Number(pending?.count || 0), amount: Number(pending?.total || 0) },
        underReview: { count: Number(underReview?.count || 0), amount: Number(underReview?.total || 0) },
        approved: { count: Number(approved?.count || 0), amount: Number(approved?.total || 0) },
        paid: { count: Number(paid?.count || 0), amount: Number(paid?.total || 0) },
        rejected: { count: Number(rejected?.count || 0), amount: Number(rejected?.total || 0) },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/agent-loan-actions", async (req: Request, res: Response) => {
  try {
    const { agentId, applicationId, actionType, limit = "100", offset = "0" } = req.query;

    const conditions = [];

    if (agentId) {
      conditions.push(eq(agentLoanActions.agentId, agentId as string));
    }
    if (applicationId) {
      conditions.push(eq(agentLoanActions.applicationId, applicationId as string));
    }
    if (actionType) {
      conditions.push(eq(agentLoanActions.actionType, actionType as string));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const actions = await db
      .select()
      .from(agentLoanActions)
      .where(whereClause)
      .orderBy(desc(agentLoanActions.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(agentLoanActions)
      .where(whereClause);

    res.json({
      success: true,
      data: actions,
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

router.get("/agent-assisted-loans", async (req: Request, res: Response) => {
  try {
    const { status, agentId, limit = "50", offset = "0" } = req.query;

    const conditions = [eq(dsaLoanApplications.assistedByAgent, true)];

    if (status && status !== "all") {
      conditions.push(eq(dsaLoanApplications.status, status as any));
    }
    if (agentId) {
      conditions.push(eq(dsaLoanApplications.agentId, agentId as string));
    }

    const applications = await db
      .select({
        application: dsaLoanApplications,
        agent: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(dsaLoanApplications)
      .leftJoin(users, eq(dsaLoanApplications.agentId, users.id))
      .where(and(...conditions))
      .orderBy(desc(dsaLoanApplications.createdAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dsaLoanApplications)
      .where(and(...conditions));

    const formattedApps = applications.map((a) => ({
      ...a.application,
      agentName: a.agent ? `${a.agent.firstName || ""} ${a.agent.lastName || ""}`.trim() : "Unknown",
      agentEmail: a.agent?.email,
    }));

    res.json({
      success: true,
      data: formattedApps,
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

router.get("/reporting/user-vs-agent", async (req: Request, res: Response) => {
  try {
    const [userLoans] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(requested_amount::numeric), 0)`,
        disbursedCount: sql<number>`count(*) FILTER (WHERE status = 'disbursed')`,
        disbursedAmount: sql<number>`COALESCE(SUM(actual_disbursed_amount::numeric) FILTER (WHERE status = 'disbursed'), 0)`,
      })
      .from(dsaLoanApplications)
      .where(eq(dsaLoanApplications.assistedByAgent, false));

    const [agentLoans] = await db
      .select({
        count: sql<number>`count(*)`,
        totalAmount: sql<number>`COALESCE(SUM(requested_amount::numeric), 0)`,
        disbursedCount: sql<number>`count(*) FILTER (WHERE status = 'disbursed')`,
        disbursedAmount: sql<number>`COALESCE(SUM(actual_disbursed_amount::numeric) FILTER (WHERE status = 'disbursed'), 0)`,
      })
      .from(dsaLoanApplications)
      .where(eq(dsaLoanApplications.assistedByAgent, true));

    res.json({
      success: true,
      data: {
        userSelfService: {
          applications: Number(userLoans?.count || 0),
          requestedAmount: Number(userLoans?.totalAmount || 0),
          disbursedCount: Number(userLoans?.disbursedCount || 0),
          disbursedAmount: Number(userLoans?.disbursedAmount || 0),
        },
        agentAssisted: {
          applications: Number(agentLoans?.count || 0),
          requestedAmount: Number(agentLoans?.totalAmount || 0),
          disbursedCount: Number(agentLoans?.disbursedCount || 0),
          disbursedAmount: Number(agentLoans?.disbursedAmount || 0),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const [pendingStats] = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`COALESCE(SUM(claim_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "pending"));

    const [approvedStats] = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`COALESCE(SUM(claim_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "approved"));

    const [paidStats] = await db
      .select({
        count: sql<number>`count(*)`,
        amount: sql<number>`COALESCE(SUM(claim_amount::numeric), 0)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "paid"));

    const [rejectedStats] = await db
      .select({
        count: sql<number>`count(*)`,
      })
      .from(agentPayoutClaims)
      .where(eq(agentPayoutClaims.status, "rejected"));

    res.json({
      success: true,
      data: {
        totalPending: Number(pendingStats?.count || 0),
        pendingAmount: (Number(pendingStats?.amount || 0)).toFixed(2),
        totalApproved: Number(approvedStats?.count || 0),
        approvedAmount: (Number(approvedStats?.amount || 0)).toFixed(2),
        totalPaid: Number(paidStats?.count || 0),
        paidAmount: (Number(paidStats?.amount || 0)).toFixed(2),
        totalRejected: Number(rejectedStats?.count || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
