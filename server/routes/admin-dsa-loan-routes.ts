import { Router, Request, Response } from "express";
import { db } from "../db";
import { eq, and, desc, sql, gte, lte, count as drizzleCount } from "drizzle-orm";
import {
  dsaLoanApplications,
  bankConnectors,
  loanEligibilityRules,
  loanRoutingHistory,
  dsaLoanAuditLogs,
  dsaCommissionTracking,
} from "@shared/schema";
import { dsaLoanService } from "../services/dsa-loan-service";
import { requireAdmin } from "../middleware/roleMiddleware";

const router = Router();
router.use(requireAdmin);

router.get("/dashboard/stats", async (req: Request, res: Response) => {
  try {
    const applications = await db.select().from(dsaLoanApplications);
    const routingHistories = await db.select().from(loanRoutingHistory);
    const banks = await db.select().from(bankConnectors).where(eq(bankConnectors.isActive, true));

    const statusCounts: Record<string, number> = {};
    const loanTypeCounts: Record<string, number> = {};
    let totalAmount = 0;
    let approvedAmount = 0;
    let disbursedAmount = 0;

    for (const app of applications) {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
      loanTypeCounts[app.loanType] = (loanTypeCounts[app.loanType] || 0) + 1;
      totalAmount += parseFloat(app.requestedAmount || '0');
      if (app.status === 'approved' || app.status === 'disbursed') {
        approvedAmount += parseFloat(app.requestedAmount || '0');
      }
      if (app.status === 'disbursed') {
        disbursedAmount += parseFloat(app.requestedAmount || '0');
      }
    }

    const bankStats: Record<string, { submitted: number; approved: number; rejected: number; pending: number }> = {};
    for (const history of routingHistories) {
      if (!bankStats[history.bankCode]) {
        bankStats[history.bankCode] = { submitted: 0, approved: 0, rejected: 0, pending: 0 };
      }
      bankStats[history.bankCode].submitted++;
      if (history.bankStatus === 'approved') bankStats[history.bankCode].approved++;
      else if (history.bankStatus === 'rejected') bankStats[history.bankCode].rejected++;
      else bankStats[history.bankCode].pending++;
    }

    const bankWiseStats = banks.map(bank => ({
      bankCode: bank.bankCode,
      bankName: bank.bankName,
      connectorType: bank.connectorType,
      priority: bank.priority,
      interestRange: `${bank.interestRateMin || 0}% - ${bank.interestRateMax || 0}%`,
      ...bankStats[bank.bankCode] || { submitted: 0, approved: 0, rejected: 0, pending: 0 },
      approvalRate: bankStats[bank.bankCode] 
        ? ((bankStats[bank.bankCode].approved / (bankStats[bank.bankCode].approved + bankStats[bank.bankCode].rejected)) * 100 || 0).toFixed(1)
        : '0',
    }));

    const completedApps = applications.filter(a => ['approved', 'rejected', 'disbursed'].includes(a.status));
    const approvedApps = applications.filter(a => ['approved', 'disbursed'].includes(a.status));

    res.json({
      success: true,
      data: {
        overview: {
          totalApplications: applications.length,
          totalAmount,
          approvedAmount,
          disbursedAmount,
          approvalRate: completedApps.length > 0 ? ((approvedApps.length / completedApps.length) * 100).toFixed(1) : 0,
          activeBanks: banks.length,
        },
        funnel: {
          draft: statusCounts['draft'] || 0,
          submitted: statusCounts['submitted'] || 0,
          eligibilityCheck: statusCounts['eligibility_check'] || 0,
          routed: statusCounts['routed'] || 0,
          pendingWithBanks: statusCounts['pending_with_banks'] || 0,
          inReview: statusCounts['in_review'] || 0,
          approved: statusCounts['approved'] || 0,
          rejected: statusCounts['rejected'] || 0,
          disbursed: statusCounts['disbursed'] || 0,
        },
        byLoanType: loanTypeCounts,
        bankWiseStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/applications", async (req: Request, res: Response) => {
  try {
    const { status, loanType, bankCode, fromDate, toDate, limit, offset, search, originationMode, routingIntent, agentId } = req.query;
    
    let query = db.select().from(dsaLoanApplications);
    const conditions = [];

    if (status) conditions.push(eq(dsaLoanApplications.status as any, status as string));
    if (loanType) conditions.push(eq(dsaLoanApplications.loanType, loanType as string));
    if (fromDate) conditions.push(gte(dsaLoanApplications.createdAt, new Date(fromDate as string)));
    if (toDate) conditions.push(lte(dsaLoanApplications.createdAt, new Date(toDate as string)));
    
    // SUB-DSA GOVERNANCE: Mandatory filters for audit and reporting
    if (originationMode) conditions.push(eq((dsaLoanApplications as any).originationMode, originationMode as string));
    if (routingIntent) conditions.push(eq((dsaLoanApplications as any).routingIntent, routingIntent as string));
    if (agentId) conditions.push(eq(dsaLoanApplications.agentId, agentId as string));
    if (bankCode) conditions.push(sql`${bankCode} = ANY(${dsaLoanApplications.routedBanks})`);

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(dsaLoanApplications)
      .where(whereClause);

    const applications = await db
      .select()
      .from(dsaLoanApplications)
      .where(whereClause)
      .orderBy(desc(dsaLoanApplications.createdAt))
      .limit(parseInt(limit as string) || 50)
      .offset(parseInt(offset as string) || 0);

    res.json({
      success: true,
      data: applications,
      meta: {
        total: Number(countResult?.count || 0),
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/applications/:id", async (req: Request, res: Response) => {
  try {
    const application = await dsaLoanService.getApplication(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Application not found' });
    }

    const routingHistory = await dsaLoanService.getRoutingHistory(req.params.id);
    const documents = await dsaLoanService.getDocuments(req.params.id);
    const auditLogs = await dsaLoanService.getAuditLogs(req.params.id);

    res.json({
      success: true,
      data: {
        application,
        routingHistory,
        documents,
        auditLogs,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/applications/:id/manual-route", async (req: Request, res: Response) => {
  try {
    const { bankCodes, strategy, reason } = req.body;
    const actorId = (req as any).user?.id || 'admin';

    await dsaLoanService.createAuditLog({
      applicationId: req.params.id,
      action: 'manual_routing_override',
      actionCategory: 'admin_override',
      actorId,
      notes: reason,
      newState: { bankCodes, strategy },
    });

    const result = await dsaLoanService.routeToBank(
      req.params.id,
      bankCodes,
      strategy || 'parallel',
      actorId
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post("/applications/:id/update-status", async (req: Request, res: Response) => {
  try {
    const { status, reason } = req.body;
    const actorId = (req as any).user?.id || 'admin';

    const application = await dsaLoanService.updateApplication(
      req.params.id,
      { status },
      actorId
    );

    await dsaLoanService.createAuditLog({
      applicationId: req.params.id,
      action: 'admin_status_update',
      actionCategory: 'admin_override',
      actorId,
      notes: reason,
      newState: { status },
    });

    res.json({ success: true, data: application });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/banks", async (req: Request, res: Response) => {
  try {
    const banks = await db
      .select()
      .from(bankConnectors)
      .orderBy(desc(bankConnectors.priority));

    res.json({ success: true, data: banks });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch("/banks/:bankCode", async (req: Request, res: Response) => {
  try {
    const { bankCode } = req.params;
    const updates = req.body;

    const [updated] = await db
      .update(bankConnectors)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bankConnectors.bankCode, bankCode))
      .returning();

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/eligibility-rules", async (req: Request, res: Response) => {
  try {
    const { bankCode, loanType } = req.query;
    const conditions = [];

    if (bankCode) conditions.push(eq(loanEligibilityRules.bankCode, bankCode as string));
    if (loanType) conditions.push(eq(loanEligibilityRules.loanType, loanType as string));

    const rules = await db
      .select()
      .from(loanEligibilityRules)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(loanEligibilityRules.priority));

    res.json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/eligibility-rules", async (req: Request, res: Response) => {
  try {
    const [rule] = await db
      .insert(loanEligibilityRules)
      .values(req.body)
      .returning();

    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get("/audit-logs", async (req: Request, res: Response) => {
  try {
    const { applicationId, action, fromDate, toDate, limit, offset } = req.query;
    const conditions = [];

    if (applicationId) conditions.push(eq(dsaLoanAuditLogs.applicationId, applicationId as string));
    if (action) conditions.push(eq(dsaLoanAuditLogs.action, action as string));
    if (fromDate) conditions.push(gte(dsaLoanAuditLogs.createdAt, new Date(fromDate as string)));
    if (toDate) conditions.push(lte(dsaLoanAuditLogs.createdAt, new Date(toDate as string)));

    const logs = await db
      .select()
      .from(dsaLoanAuditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(dsaLoanAuditLogs.createdAt))
      .limit(parseInt(limit as string) || 100)
      .offset(parseInt(offset as string) || 0);

    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
