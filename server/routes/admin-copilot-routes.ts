/**
 * admin-copilot-routes.ts — FintekPro Admin Copilot API Router
 * ALL routes require role = 'admin' | 'superadmin' (RBAC enforced by requireAdminOrSuperadmin).
 * All responses follow: { success, data, meta: { timestamp, version } }
 * All list endpoints support: page, limit, total pagination.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../db';
import {
  aiEmailClassifications,
  aiAdminTasks,
  aiProposalDrafts,
  aiBiReports,
  aiComplianceAlerts,
  aiAuditLogs,
  aiInvoiceDrafts,
  aiPayoutSuggestions,
  aiRevenueReconciliation,
  aiMeetingActions,
  aiMeetingNotes,
  aiMeetingFollowups,
} from '@shared/schema/admin-copilot';
import { desc, eq, and, or, sql } from 'drizzle-orm';
import { syncAndClassifyEmails, redraftReply } from '../services/admin-copilot/mailAgent';
import { createTaskFromSource, updateTaskStatus } from '../services/admin-copilot/taskAgent';
import { generateProposalDraft }                  from '../services/admin-copilot/proposalAgent';
import { generateBiSummary, answerBiQuestion }    from '../services/admin-copilot/biAgent';
import { processApproval }                        from '../services/admin-copilot/approvalService';
import { auditLog }                               from '../services/admin-copilot/auditLogger';

export const adminCopilotRouter = Router();

const API_VERSION = '1.0';

function successResponse(data: unknown, meta?: Record<string, unknown>) {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: API_VERSION, ...meta },
  };
}

function errorResponse(message: string, errorCode = 'INTERNAL_ERROR', retryable = false) {
  return {
    success: false,
    error: { error_code: errorCode, message, retryable },
    meta: { timestamp: new Date().toISOString(), version: API_VERSION },
  };
}

/** RBAC guard: admin and superadmin only */
function requireAdminOrSuperadmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return res.status(403).json(errorResponse('Admin or Superadmin role required', 'FORBIDDEN'));
  }
  next();
}

adminCopilotRouter.use(requireAdminOrSuperadmin);

// ── Helper: pagination ────────────────────────────────────────────────────────
function getPagination(query: Record<string, any>) {
  const page  = Math.max(1, parseInt(query.page ?? '1', 10));
  const limit = Math.min(100, parseInt(query.limit ?? '20', 10));
  return { page, limit, offset: (page - 1) * limit };
}

// ─────────────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get('/health', async (_req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json(successResponse({ status: 'ok', agents: ['mail','task','proposal','bi','approval','audit'] }));
  } catch {
    res.status(503).json(errorResponse('Database unavailable', 'DB_UNAVAILABLE', true));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// MAIL AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/mail/sync', async (req: Request, res: Response) => {
  try {
    const { connectionId, accountId, limit = 50 } = req.body as {
      connectionId: string; accountId: string; limit?: number;
    };
    if (!connectionId || !accountId) {
      return res.status(400).json(errorResponse('connectionId and accountId are required', 'VALIDATION_ERROR'));
    }
    const adminId = (req as any).user.id;
    const result = await syncAndClassifyEmails(connectionId, accountId, adminId, limit);
    res.json(successResponse(result));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'MAIL_SYNC_ERROR', true));
  }
});

adminCopilotRouter.get('/mail/inbox', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const { category, urgency } = req.query as { category?: string; urgency?: string };

    const conditions = [];
    if (category) conditions.push(eq(aiEmailClassifications.category, category));
    if (urgency)  conditions.push(eq(aiEmailClassifications.urgency, urgency));

    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiEmailClassifications)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(aiEmailClassifications.receivedAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiEmailClassifications)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

adminCopilotRouter.post('/mail/draft-reply', async (req: Request, res: Response) => {
  try {
    const { classificationId, extraContext } = req.body as {
      classificationId: string; extraContext?: string;
    };
    const adminId = (req as any).user.id;
    const draft   = await redraftReply(classificationId, adminId, extraContext);
    res.json(successResponse({ draftReply: draft, approvalStatus: 'draft' }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'DRAFT_REPLY_ERROR'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/tasks/create', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const task    = await createTaskFromSource({ ...req.body, adminUserId: adminId });
    res.status(201).json(successResponse(task));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'TASK_CREATE_ERROR'));
  }
});

adminCopilotRouter.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const { status, priority, source } = req.query as {
      status?: string; priority?: string; source?: string;
    };

    const conditions = [];
    if (status)   conditions.push(eq(aiAdminTasks.status, status));
    if (priority) conditions.push(eq(aiAdminTasks.priority, priority));
    if (source)   conditions.push(eq(aiAdminTasks.source, source));

    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiAdminTasks)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(aiAdminTasks.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiAdminTasks)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

adminCopilotRouter.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { id }     = req.params;
    const { status, notes } = req.body as { status: string; notes?: string };
    const adminId    = (req as any).user.id;
    await updateTaskStatus(id, status as any, adminId, notes);
    res.json(successResponse({ id, status }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRM AGENT (Phase 2 stub)
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/crm/sync', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'CRM Agent available in Phase 2' }));
});
adminCopilotRouter.get('/crm/leads', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'CRM Agent available in Phase 2' }));
});

// ─────────────────────────────────────────────────────────────────────────────
// DESK AGENT (Phase 2 stub)
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/desk/sync', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'Desk Agent available in Phase 2' }));
});
adminCopilotRouter.get('/desk/tickets', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'Desk Agent available in Phase 2' }));
});

// ─────────────────────────────────────────────────────────────────────────────
// PROPOSAL AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/proposals/generate', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const result  = await generateProposalDraft(req.body, adminId);
    res.status(201).json(successResponse(result));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'PROPOSAL_GENERATE_ERROR'));
  }
});

adminCopilotRouter.get('/proposals', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const { approvalStatus, productType } = req.query as {
      approvalStatus?: string; productType?: string;
    };

    const conditions = [];
    if (approvalStatus) conditions.push(eq(aiProposalDrafts.approvalStatus, approvalStatus));
    if (productType)    conditions.push(eq(aiProposalDrafts.productType, productType));

    const [items, [{ count }]] = await Promise.all([
      db.select({
        id: aiProposalDrafts.id,
        investorName: aiProposalDrafts.investorName,
        productType:  aiProposalDrafts.productType,
        amount:       aiProposalDrafts.amount,
        riskProfile:  aiProposalDrafts.riskProfile,
        approvalStatus: aiProposalDrafts.approvalStatus,
        confidenceScore: aiProposalDrafts.confidenceScore,
        createdAt:    aiProposalDrafts.createdAt,
      }).from(aiProposalDrafts)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(aiProposalDrafts.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiProposalDrafts)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

adminCopilotRouter.get('/proposals/:id', async (req: Request, res: Response) => {
  try {
    const [proposal] = await db.select().from(aiProposalDrafts)
      .where(eq(aiProposalDrafts.id, req.params.id)).limit(1);
    if (!proposal) return res.status(404).json(errorResponse('Proposal not found', 'NOT_FOUND'));
    res.json(successResponse(proposal));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BI AGENT
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get('/bi/summary', async (req: Request, res: Response) => {
  try {
    const adminId = (req as any).user.id;
    const date    = req.query.date as string | undefined;
    const summary = await generateBiSummary(adminId, date);
    res.json(successResponse(summary));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'BI_SUMMARY_ERROR'));
  }
});

adminCopilotRouter.post('/bi/ask', async (req: Request, res: Response) => {
  try {
    const { question, biSummary } = req.body as { question: string; biSummary: any };
    if (!question) return res.status(400).json(errorResponse('question is required', 'VALIDATION_ERROR'));
    const adminId = (req as any).user.id;
    const answer  = await answerBiQuestion(question, biSummary, adminId);
    res.json(successResponse(answer));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'BI_ASK_ERROR'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BOOKS FINANCE AGENT (Phase 2 stubs)
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/books/sync', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'Books Agent available in Phase 2. Set ZOHO_BOOKS_ORG_ID env var.' }));
});
adminCopilotRouter.get('/books/invoices', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiInvoiceDrafts).orderBy(desc(aiInvoiceDrafts.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiInvoiceDrafts),
    ]);
    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.get('/books/invoices/overdue', async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(aiInvoiceDrafts)
      .where(and(
        eq(aiInvoiceDrafts.issuedToZohoBooks, false),
        sql`due_date < NOW()`,
      ))
      .orderBy(desc(aiInvoiceDrafts.dueDate));
    res.json(successResponse(items));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.post('/books/invoices/draft', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'Invoice drafting from Zoho CRM available in Phase 2' }));
});
adminCopilotRouter.get('/books/payouts', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiPayoutSuggestions).orderBy(desc(aiPayoutSuggestions.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiPayoutSuggestions),
    ]);
    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.get('/books/reconciliation', async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(aiRevenueReconciliation)
      .orderBy(desc(aiRevenueReconciliation.periodEnd)).limit(12);
    res.json(successResponse(items));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.get('/books/gst-summary', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'GST summary requires Zoho Books sync (Phase 2)' }));
});

// ─────────────────────────────────────────────────────────────────────────────
// MEETING AGENT (Phase 2 stubs + DB reads live)
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/meetings/schedule', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'Meeting scheduling via Zoho Meeting available in Phase 2' }));
});
adminCopilotRouter.get('/meetings', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiMeetingActions).orderBy(desc(aiMeetingActions.scheduledAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiMeetingActions),
    ]);
    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.get('/meetings/:id', async (req: Request, res: Response) => {
  try {
    const [meeting] = await db.select().from(aiMeetingActions)
      .where(eq(aiMeetingActions.id, req.params.id)).limit(1);
    if (!meeting) return res.status(404).json(errorResponse('Meeting not found', 'NOT_FOUND'));
    res.json(successResponse(meeting));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.get('/meetings/:id/agenda', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'AI agenda generation available in Phase 2' }));
});
adminCopilotRouter.post('/meetings/:id/summary', (_req, res) => {
  res.status(501).json(successResponse({ phase: 2, message: 'Post-meeting AI summary available in Phase 2' }));
});
adminCopilotRouter.get('/meetings/:id/followups', async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(aiMeetingFollowups)
      .where(eq(aiMeetingFollowups.meetingActionId, req.params.id))
      .orderBy(desc(aiMeetingFollowups.createdAt));
    res.json(successResponse(items));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
adminCopilotRouter.get('/meetings/no-shows', async (req: Request, res: Response) => {
  try {
    const items = await db.select().from(aiMeetingActions)
      .where(eq(aiMeetingActions.meetingStatus, 'no_show'))
      .orderBy(desc(aiMeetingActions.scheduledAt));
    res.json(successResponse(items));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// COMPLIANCE ALERTS
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get('/compliance/alerts', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const { severity, status } = req.query as { severity?: string; status?: string };

    const conditions = [];
    if (severity) conditions.push(eq(aiComplianceAlerts.severity, severity));
    if (status)   conditions.push(eq(aiComplianceAlerts.status, status));
    else conditions.push(eq(aiComplianceAlerts.status, 'open'));

    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiComplianceAlerts)
        .where(and(...conditions))
        .orderBy(desc(aiComplianceAlerts.createdAt))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiComplianceAlerts)
        .where(and(...conditions)),
    ]);

    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL APPROVAL
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.post('/approve', async (req: Request, res: Response) => {
  try {
    const user   = (req as any).user;
    const result = await processApproval({
      ...req.body,
      adminId:   user.id,
      adminRole: user.role,
    });
    res.json(successResponse(result));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message, 'APPROVAL_ERROR'));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────────────────────
adminCopilotRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { page, limit, offset } = getPagination(req.query as any);
    const { agentType, agentAction, status, userId } = req.query as {
      agentType?: string; agentAction?: string; status?: string; userId?: string;
    };

    const conditions = [];
    if (agentType)   conditions.push(eq(aiAuditLogs.agentType, agentType));
    if (agentAction) conditions.push(eq(aiAuditLogs.agentAction, agentAction));
    if (status)      conditions.push(eq(aiAuditLogs.status, status));
    if (userId)      conditions.push(eq(aiAuditLogs.userId, userId));

    const [items, [{ count }]] = await Promise.all([
      db.select().from(aiAuditLogs)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(aiAuditLogs.timestamp))
        .limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)` }).from(aiAuditLogs)
        .where(conditions.length ? and(...conditions) : undefined),
    ]);

    res.json(successResponse(items, { page, limit, total: Number(count) }));
  } catch (err: any) {
    res.status(500).json(errorResponse(err.message));
  }
});
