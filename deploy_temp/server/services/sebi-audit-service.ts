import { db } from "../db";
import { sebiAuditLogs, SEBI_AUDIT_ACTION_TYPES, InsertSebiAuditLog } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

interface AuditContext {
  proposalId?: string;
  advisorId?: string;
  clientId?: string;
  prospectId?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface AuditLogEntry {
  actionType: keyof typeof SEBI_AUDIT_ACTION_TYPES;
  actionSummary: string;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  rationale?: string;
  templateId?: string;
  riskDisclosure?: string;
  complianceFlags?: Record<string, any>;
}

export class SEBIAuditService {
  private static instance: SEBIAuditService;
  private pendingLogs: InsertSebiAuditLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Flush every 2 s — reduces max data loss window from 5 s to 2 s on autoscale instance kill
    this.flushInterval = setInterval(() => this.flushPendingLogs(), 2000);

    // Graceful shutdown: flush before the process exits so in-flight logs aren't lost
    const gracefulFlush = () => {
      this.flushPendingLogs().catch((err) =>
        console.error("[SEBIAuditService] Graceful flush failed:", err)
      );
    };
    process.once("SIGTERM", gracefulFlush);
    process.once("SIGINT", gracefulFlush);
  }

  static getInstance(): SEBIAuditService {
    if (!SEBIAuditService.instance) {
      SEBIAuditService.instance = new SEBIAuditService();
    }
    return SEBIAuditService.instance;
  }

  async log(entry: AuditLogEntry, context: AuditContext = {}): Promise<void> {
    try {
      const logEntry: InsertSebiAuditLog = {
        proposalId: context.proposalId,
        advisorId: context.advisorId,
        clientId: context.clientId,
        prospectId: context.prospectId,
        actionType: entry.actionType,
        actionSummary: entry.actionSummary,
        inputData: entry.inputData,
        outputData: entry.outputData,
        rationale: entry.rationale,
        templateId: entry.templateId,
        riskDisclosure: entry.riskDisclosure,
        complianceFlags: entry.complianceFlags,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      };

      // Add to pending logs for batch insert
      this.pendingLogs.push(logEntry);

      // Flush immediately if batch is large
      if (this.pendingLogs.length >= 10) {
        await this.flushPendingLogs();
      }
    } catch (error) {
      // Logging should never block the main flow
      console.error("[SEBIAuditService] Failed to queue log:", error);
    }
  }

  private async flushPendingLogs(): Promise<void> {
    if (this.pendingLogs.length === 0) return;

    const logsToInsert = [...this.pendingLogs];
    this.pendingLogs = [];

    try {
      await db.insert(sebiAuditLogs).values(logsToInsert);
      console.log(`[SEBIAuditService] Flushed ${logsToInsert.length} audit logs`);
    } catch (error) {
      console.error("[SEBIAuditService] Failed to flush logs:", error);
      // Re-queue failed logs for retry
      this.pendingLogs.unshift(...logsToInsert);
    }
  }

  // Synchronous log for critical actions
  async logImmediate(entry: AuditLogEntry, context: AuditContext = {}): Promise<string | null> {
    try {
      const logEntry: InsertSebiAuditLog = {
        proposalId: context.proposalId,
        advisorId: context.advisorId,
        clientId: context.clientId,
        prospectId: context.prospectId,
        actionType: entry.actionType,
        actionSummary: entry.actionSummary,
        inputData: entry.inputData,
        outputData: entry.outputData,
        rationale: entry.rationale,
        templateId: entry.templateId,
        riskDisclosure: entry.riskDisclosure,
        complianceFlags: entry.complianceFlags,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId,
      };

      const [result] = await db.insert(sebiAuditLogs).values(logEntry).returning({ id: sebiAuditLogs.id });
      return result?.id || null;
    } catch (error) {
      console.error("[SEBIAuditService] Failed to log immediately:", error);
      return null;
    }
  }

  // Query logs for export
  async getLogsByProposal(proposalId: string, limit: number = 100): Promise<any[]> {
    return await db
      .select()
      .from(sebiAuditLogs)
      .where(eq(sebiAuditLogs.proposalId, proposalId))
      .orderBy(desc(sebiAuditLogs.createdAt))
      .limit(limit);
  }

  async getLogsByAdvisor(advisorId: string, limit: number = 100): Promise<any[]> {
    return await db
      .select()
      .from(sebiAuditLogs)
      .where(eq(sebiAuditLogs.advisorId, advisorId))
      .orderBy(desc(sebiAuditLogs.createdAt))
      .limit(limit);
  }

  async getLogsByDateRange(startDate: Date, endDate: Date, limit: number = 1000): Promise<any[]> {
    return await db
      .select()
      .from(sebiAuditLogs)
      .where(
        and(
          sql`${sebiAuditLogs.createdAt} >= ${startDate}`,
          sql`${sebiAuditLogs.createdAt} <= ${endDate}`
        )
      )
      .orderBy(desc(sebiAuditLogs.createdAt))
      .limit(limit);
  }

  // Export to CSV format
  async exportToCSV(proposalId?: string, advisorId?: string): Promise<string> {
    let logs: any[];

    if (proposalId) {
      logs = await this.getLogsByProposal(proposalId, 5000);
    } else if (advisorId) {
      logs = await this.getLogsByAdvisor(advisorId, 5000);
    } else {
      logs = await this.getLogsByDateRange(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        new Date(),
        5000
      );
    }

    const headers = [
      "ID",
      "Timestamp",
      "Proposal ID",
      "Advisor ID",
      "Action Type",
      "Action Summary",
      "Rationale",
      "Template ID",
      "Risk Disclosure",
    ];

    const rows = logs.map(log => [
      log.id,
      log.createdAt?.toISOString() || "",
      log.proposalId || "",
      log.advisorId || "",
      log.actionType,
      `"${(log.actionSummary || "").replace(/"/g, '""')}"`,
      `"${(log.rationale || "").replace(/"/g, '""')}"`,
      log.templateId || "",
      `"${(log.riskDisclosure || "").replace(/"/g, '""')}"`,
    ]);

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  }

  // Generate audit summary for PDF export
  async generateAuditSummary(proposalId: string): Promise<{
    totalActions: number;
    actionBreakdown: Record<string, number>;
    complianceStatus: "COMPLIANT" | "FLAGGED" | "PENDING_REVIEW";
    riskDisclosuresPresent: boolean;
    logs: any[];
  }> {
    const logs = await this.getLogsByProposal(proposalId);

    const actionBreakdown: Record<string, number> = {};
    let hasRiskDisclosures = false;
    let hasFlaggedItems = false;

    for (const log of logs) {
      actionBreakdown[log.actionType] = (actionBreakdown[log.actionType] || 0) + 1;
      if (log.riskDisclosure) hasRiskDisclosures = true;
      if (log.complianceFlags && Object.keys(log.complianceFlags).length > 0) {
        hasFlaggedItems = true;
      }
    }

    return {
      totalActions: logs.length,
      actionBreakdown,
      complianceStatus: hasFlaggedItems ? "FLAGGED" : hasRiskDisclosures ? "COMPLIANT" : "PENDING_REVIEW",
      riskDisclosuresPresent: hasRiskDisclosures,
      logs,
    };
  }
}

export const sebiAuditService = SEBIAuditService.getInstance();

// Audit logging hooks for automatic integration
export function createAuditHook(actionType: keyof typeof SEBI_AUDIT_ACTION_TYPES) {
  return async function auditHook<T>(
    fn: () => Promise<T>,
    context: AuditContext,
    inputData?: Record<string, any>
  ): Promise<T> {
    const startTime = Date.now();
    let result: T;
    let error: Error | null = null;

    try {
      result = await fn();
    } catch (e) {
      error = e as Error;
      throw e;
    } finally {
      // Log regardless of success/failure
      await sebiAuditService.log(
        {
          actionType,
          actionSummary: error
            ? `${actionType} failed: ${error.message}`
            : `${actionType} completed successfully`,
          inputData,
          outputData: error ? { error: error.message } : { success: true, duration: Date.now() - startTime },
          rationale: error ? "Operation failed" : "Operation completed as expected",
          riskDisclosure: "Mutual fund investments are subject to market risks.",
        },
        context
      );
    }

    return result!;
  };
}
