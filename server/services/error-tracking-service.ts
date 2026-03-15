import { db } from "../db";
import { errorLedger, ErrorLedgerEntry, users } from "../../shared/schema";
import { eq, desc, and, gte, lte, sql, like, or, count } from "drizzle-orm";
import crypto from "crypto";
import { emailService } from "../email-service";
import { errorSpikeDetectionService } from "./error-spike-detection-service";
import { aiService } from "./ai-service";
import { fetchWithTimeout } from "../utils/fetch-with-timeout";

// Replit deployment context for error tracking
interface ReplitDeploymentContext {
  replId: string | null;
  replSlug: string | null;
  replOwner: string | null;
  deploymentId: string | null;
  deploymentUrl: string | null;
  replitUrl: string | null;
}

function getReplitContext(): ReplitDeploymentContext {
  return {
    replId: process.env.REPL_ID || null,
    replSlug: process.env.REPL_SLUG || null,
    replOwner: process.env.REPL_OWNER || null,
    deploymentId: process.env.REPLIT_DEPLOYMENT_ID || null,
    deploymentUrl: process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
        : null,
    replitUrl: process.env.REPL_ID && process.env.REPL_OWNER
      ? `https://replit.com/@${process.env.REPL_OWNER}/${process.env.REPL_SLUG}`
      : null
  };
}

interface AIErrorAnalysis {
  rootCause: string;
  suggestedFix: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  impactAssessment: string;
  preventionTips: string[];
  relatedErrors: string[];
  confidence: number;
}

function maskPan(pan: string | undefined | null): string | null {
  if (!pan) return null;
  const cleaned = pan.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (cleaned.length < 4) return 'XXXX';
  return `${cleaned.slice(0, 2)}XXXXXX${cleaned.slice(-2)}`;
}

function generateStackHash(stack: string | undefined): string | null {
  if (!stack) return null;
  return crypto.createHash('sha256').update(stack).digest('hex').substring(0, 64);
}

interface ErrorIngestionPayload {
  source: string;
  severity: string;
  errorCode: string;
  message: string;
  stack?: string;
  context: {
    module: string;
    clientId?: string;
    agentId?: string;
    transactionId?: string;
    pan?: string;
    requestId?: string;
    url?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  };
  sentryEventId?: string;
  buildVersion?: string;
}

interface ErrorFilters {
  severity?: string;
  status?: string;
  module?: string;
  errorCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  clientId?: string;
  agentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface ErrorMetrics {
  totalErrors: number;
  bySeverity: Record<string, number>;
  byModule: Record<string, number>;
  byStatus: Record<string, number>;
  topErrorCodes: Array<{ errorCode: string; count: number }>;
  recentTrend: Array<{ date: string; count: number }>;
  clientImpactScore: number;
}

class ErrorTrackingService {
  async ingestError(payload: ErrorIngestionPayload, ipAddress?: string): Promise<ErrorLedgerEntry> {
    const stackHash = generateStackHash(payload.stack);
    const panMasked = maskPan(payload.context.pan);
    
    if (stackHash) {
      const [existingError] = await db.select()
        .from(errorLedger)
        .where(and(
          eq(errorLedger.stackHash, stackHash),
          eq(errorLedger.status, 'open')
        ))
        .limit(1);
      
      if (existingError) {
        const [updated] = await db.update(errorLedger)
          .set({
            occurrenceCount: sql`${errorLedger.occurrenceCount} + 1`,
            lastOccurrence: new Date(),
            updatedAt: new Date()
          })
          .where(eq(errorLedger.id, existingError.id))
          .returning();
        
        this.checkForSpikes(updated);
        return updated;
      }
    }
    
    const [newError] = await db.insert(errorLedger).values({
      errorCode: payload.errorCode,
      severity: payload.severity,
      source: payload.source,
      module: payload.context.module,
      message: payload.message,
      stackHash,
      stackTrace: payload.stack,
      clientId: payload.context.clientId || null,
      agentId: payload.context.agentId || null,
      panMasked,
      transactionId: payload.context.transactionId || null,
      requestId: payload.context.requestId || null,
      userAgent: payload.context.userAgent || null,
      ipAddress: ipAddress || null,
      url: payload.context.url || null,
      sentryEventId: payload.sentryEventId || null,
      buildVersion: payload.buildVersion || null,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
      metadata: payload.context.metadata || null,
      status: 'open',
      occurrenceCount: 1,
    }).returning();
    
    if (payload.severity === 'critical') {
      this.triggerCriticalAlert(newError);
    }
    
    this.checkForSpikes(newError);
    
    return newError;
  }
  
  private async checkForSpikes(error: ErrorLedgerEntry): Promise<void> {
    try {
      await errorSpikeDetectionService.handleErrorIngested({
        id: error.id,
        errorCode: error.errorCode,
        module: error.module,
        severity: error.severity,
        message: error.message,
        environment: error.environment || 'production'
      });
    } catch (err) {
      console.error('[ErrorTracking] Failed to check for spikes:', err);
    }
  }

  async getErrors(filters: ErrorFilters): Promise<{ errors: ErrorLedgerEntry[]; total: number }> {
    const conditions = [];
    
    if (filters.severity) {
      conditions.push(eq(errorLedger.severity, filters.severity));
    }
    if (filters.status) {
      conditions.push(eq(errorLedger.status, filters.status));
    }
    if (filters.module) {
      conditions.push(eq(errorLedger.module, filters.module));
    }
    if (filters.errorCode) {
      conditions.push(eq(errorLedger.errorCode, filters.errorCode));
    }
    if (filters.clientId) {
      conditions.push(eq(errorLedger.clientId, filters.clientId));
    }
    if (filters.agentId) {
      conditions.push(eq(errorLedger.agentId, filters.agentId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(errorLedger.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(errorLedger.createdAt, filters.dateTo));
    }
    if (filters.search) {
      conditions.push(or(
        like(errorLedger.message, `%${filters.search}%`),
        like(errorLedger.errorCode, `%${filters.search}%`)
      ));
    }
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(errorLedger)
      .where(whereClause);
    
    const errors = await db.select()
      .from(errorLedger)
      .where(whereClause)
      .orderBy(desc(errorLedger.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
    
    return {
      errors,
      total: totalResult?.count || 0
    };
  }

  async getErrorById(id: string): Promise<ErrorLedgerEntry | null> {
    const [error] = await db.select()
      .from(errorLedger)
      .where(eq(errorLedger.id, id))
      .limit(1);
    return error || null;
  }

  async updateErrorStatus(
    id: string,
    status: string,
    userId: string,
    resolutionNote?: string
  ): Promise<ErrorLedgerEntry | null> {
    const updates: Partial<ErrorLedgerEntry> = {
      status,
      updatedAt: new Date()
    };
    
    if (status === 'acknowledged') {
      updates.acknowledgedBy = userId;
      updates.acknowledgedAt = new Date();
    } else if (status === 'resolved') {
      updates.resolvedBy = userId;
      updates.resolvedAt = new Date();
      if (resolutionNote) {
        updates.resolutionNote = resolutionNote;
      }
    }
    
    const [updated] = await db.update(errorLedger)
      .set(updates)
      .where(eq(errorLedger.id, id))
      .returning();
    
    return updated || null;
  }

  async getMetrics(dateFrom?: Date, dateTo?: Date): Promise<ErrorMetrics> {
    const conditions = [];
    if (dateFrom) conditions.push(gte(errorLedger.createdAt, dateFrom));
    if (dateTo) conditions.push(lte(errorLedger.createdAt, dateTo));
    
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    const [totalResult] = await db.select({ count: count() })
      .from(errorLedger)
      .where(whereClause);
    
    const bySeverityResult = await db.select({
      severity: errorLedger.severity,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.severity);
    
    const byModuleResult = await db.select({
      module: errorLedger.module,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.module);
    
    const byStatusResult = await db.select({
      status: errorLedger.status,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.status);
    
    const topErrorCodesResult = await db.select({
      errorCode: errorLedger.errorCode,
      count: count()
    })
      .from(errorLedger)
      .where(whereClause)
      .groupBy(errorLedger.errorCode)
      .orderBy(desc(count()))
      .limit(10);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const trendResult = await db.select({
      date: sql<string>`DATE(${errorLedger.createdAt})`,
      count: count()
    })
      .from(errorLedger)
      .where(gte(errorLedger.createdAt, sevenDaysAgo))
      .groupBy(sql`DATE(${errorLedger.createdAt})`)
      .orderBy(sql`DATE(${errorLedger.createdAt})`);
    
    const [impactResult] = await db.select({
      uniqueClients: sql<number>`COUNT(DISTINCT ${errorLedger.clientId})`
    })
      .from(errorLedger)
      .where(and(
        whereClause,
        eq(errorLedger.severity, 'critical')
      ));
    
    const bySeverity: Record<string, number> = {};
    bySeverityResult.forEach(r => { bySeverity[r.severity] = Number(r.count); });
    
    const byModule: Record<string, number> = {};
    byModuleResult.forEach(r => { byModule[r.module] = Number(r.count); });
    
    const byStatus: Record<string, number> = {};
    byStatusResult.forEach(r => { byStatus[r.status || 'unknown'] = Number(r.count); });
    
    return {
      totalErrors: Number(totalResult?.count || 0),
      bySeverity,
      byModule,
      byStatus,
      topErrorCodes: topErrorCodesResult.map(r => ({
        errorCode: r.errorCode,
        count: Number(r.count)
      })),
      recentTrend: trendResult.map(r => ({
        date: r.date,
        count: Number(r.count)
      })),
      clientImpactScore: Number(impactResult?.uniqueClients || 0)
    };
  }

  async getRecentCriticalErrors(limit: number = 10): Promise<ErrorLedgerEntry[]> {
    return db.select()
      .from(errorLedger)
      .where(and(
        eq(errorLedger.severity, 'critical'),
        eq(errorLedger.status, 'open')
      ))
      .orderBy(desc(errorLedger.createdAt))
      .limit(limit);
  }

  /**
   * AI-powered error analysis using GPT-5.1
   * Provides root cause analysis, fix suggestions, and impact assessment
   */
  async analyzeErrorWithAI(errorId: string): Promise<AIErrorAnalysis | null> {
    const error = await this.getErrorById(errorId);
    if (!error) return null;

    try {
      const prompt = `You are an expert software engineer analyzing a production error in a SEBI/RBI-compliant financial platform (FintekPro).

ERROR DETAILS:
- Error Code: ${error.errorCode}
- Module: ${error.module}
- Message: ${error.message}
- Severity: ${error.severity}
- Occurrence Count: ${error.occurrenceCount}
- Environment: ${error.environment}
${error.stackTrace ? `- Stack Trace (first 500 chars): ${error.stackTrace.substring(0, 500)}` : ''}
${error.url ? `- URL: ${error.url}` : ''}
${error.metadata ? `- Metadata: ${JSON.stringify(error.metadata)}` : ''}

Analyze this error and provide:
1. Root cause analysis
2. Suggested fix
3. Correct severity assessment (critical/high/medium/low)
4. Error category (e.g., database, authentication, payment, API, validation, infrastructure)
5. Impact assessment for users/business
6. Prevention tips (3-5 actionable items)
7. Related error patterns to monitor
8. Confidence level (0-100)

IMPORTANT: Consider financial compliance implications (SEBI/RBI regulations).

Respond ONLY in valid JSON format:
{
  "rootCause": "...",
  "suggestedFix": "...",
  "severity": "critical|high|medium|low",
  "category": "...",
  "impactAssessment": "...",
  "preventionTips": ["...", "...", "..."],
  "relatedErrors": ["...", "..."],
  "confidence": 85
}`;

      // Use GPT-5.1 via Replit AI Integrations for analysis
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await aiService.chat(
        [{ role: 'user', content: prompt }],
        { provider: 'openai', model: 'gpt-5.1', temperature: 0.3, maxTokens: 2048 }
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as AIErrorAnalysis;
        console.log(`🤖 AI error analysis completed for ${errorId} using GPT-5.1`);
        return analysis;
      }

      return null;
    } catch (err) {
      console.error(`[ErrorTracking] AI analysis failed for ${errorId}:`, err);
      return null;
    }
  }

  /**
   * Batch analyze multiple errors for patterns
   */
  async analyzeErrorPatterns(errorIds: string[]): Promise<{
    commonPatterns: string[];
    recommendations: string[];
    prioritizedFixes: Array<{ errorId: string; priority: number; fix: string }>;
  }> {
    const errors = await Promise.all(errorIds.map(id => this.getErrorById(id)));
    const validErrors = errors.filter(e => e !== null);

    if (validErrors.length === 0) {
      return { commonPatterns: [], recommendations: [], prioritizedFixes: [] };
    }

    try {
      const errorSummaries = validErrors.map(e => ({
        id: e!.id,
        code: e!.errorCode,
        module: e!.module,
        message: e!.message,
        count: e!.occurrenceCount,
        severity: e!.severity
      }));

      const prompt = `Analyze these production errors from a financial platform for patterns:

ERRORS:
${JSON.stringify(errorSummaries, null, 2)}

Identify:
1. Common patterns across these errors
2. System-wide recommendations to prevent similar errors
3. Prioritized fixes (1=highest priority)

Respond in JSON:
{
  "commonPatterns": ["pattern1", "pattern2"],
  "recommendations": ["rec1", "rec2"],
  "prioritizedFixes": [
    {"errorId": "...", "priority": 1, "fix": "..."},
    {"errorId": "...", "priority": 2, "fix": "..."}
  ]
}`;

      const response = await aiService.chat(
        [{ role: 'user', content: prompt }],
        { provider: 'openai', model: 'gpt-5.1', temperature: 0.2, maxTokens: 2048 }
      );

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (err) {
      console.error('[ErrorTracking] Pattern analysis failed:', err);
    }

    return { commonPatterns: [], recommendations: [], prioritizedFixes: [] };
  }

  private async triggerCriticalAlert(error: ErrorLedgerEntry) {
    console.log(`[CRITICAL ALERT] Error ${error.id}: ${error.message}`);
    
    const alertEmails = process.env.ERROR_ALERT_EMAILS?.split(',') || [];
    const webhookUrl = process.env.ERROR_ALERT_WEBHOOK;
    
    if (alertEmails.length > 0) {
      await this.sendCriticalAlertEmail(error, alertEmails);
    }
    
    if (webhookUrl) {
      await this.sendWebhookAlert(error, webhookUrl);
    }
  }

  private async sendCriticalAlertEmail(error: ErrorLedgerEntry, emails: string[]) {
    const subject = `🚨 CRITICAL ERROR: ${error.errorCode}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background-color: #fef2f2; padding: 20px; border: 1px solid #fecaca; border-top: none; border-radius: 0 0 8px 8px; }
          .field { margin-bottom: 15px; }
          .label { font-weight: bold; color: #991b1b; }
          .value { background-color: white; padding: 10px; border-radius: 4px; margin-top: 5px; word-break: break-all; }
          .action-btn { display: inline-block; background-color: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
          .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚨 Critical Error Alert</h1>
          </div>
          <div class="content">
            <div class="field">
              <div class="label">Error Code</div>
              <div class="value">${error.errorCode}</div>
            </div>
            <div class="field">
              <div class="label">Module</div>
              <div class="value">${error.module}</div>
            </div>
            <div class="field">
              <div class="label">Message</div>
              <div class="value">${error.message}</div>
            </div>
            <div class="field">
              <div class="label">Severity</div>
              <div class="value" style="color: #dc2626; font-weight: bold;">${error.severity.toUpperCase()}</div>
            </div>
            <div class="field">
              <div class="label">Error ID</div>
              <div class="value">${error.id}</div>
            </div>
            ${error.clientId ? `
            <div class="field">
              <div class="label">Client ID</div>
              <div class="value">${error.clientId}</div>
            </div>
            ` : ''}
            ${error.transactionId ? `
            <div class="field">
              <div class="label">Transaction ID</div>
              <div class="value">${error.transactionId}</div>
            </div>
            ` : ''}
            <div class="field">
              <div class="label">Timestamp</div>
              <div class="value">${new Date(error.createdAt).toLocaleString()}</div>
            </div>
            <div class="field">
              <div class="label">Environment</div>
              <div class="value">${error.environment}</div>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.APP_URL || 'https://fintekpro.com'}/admin/error-command-center" class="action-btn">
                View in Error Command Center
              </a>
            </div>
          </div>
          <div class="footer">
            <p>This is an automated alert from FintekPro Error Tracking System</p>
            <p>Error ID: ${error.id}</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    for (const email of emails) {
      try {
        await emailService.sendEmail({
          to: email.trim(),
          subject,
          html,
          text: `CRITICAL ERROR: ${error.errorCode}\nModule: ${error.module}\nMessage: ${error.message}\nError ID: ${error.id}`
        });
        console.log(`[CRITICAL ALERT] Email sent to ${email}`);
      } catch (err) {
        console.error(`[CRITICAL ALERT] Failed to send email to ${email}:`, err);
      }
    }
  }

  private async sendWebhookAlert(error: ErrorLedgerEntry, webhookUrl: string) {
    try {
      const payload = {
        type: 'critical_error',
        timestamp: new Date().toISOString(),
        error: {
          id: error.id,
          code: error.errorCode,
          severity: error.severity,
          module: error.module,
          message: error.message,
          clientId: error.clientId,
          transactionId: error.transactionId,
          environment: error.environment,
          occurrenceCount: error.occurrenceCount,
          url: `${process.env.APP_URL || 'https://fintekpro.com'}/admin/error-command-center`
        }
      };
      
      const response = await fetchWithTimeout(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-FintekPro-Event': 'critical_error'
        },
        body: JSON.stringify(payload),
        timeoutMs: 10_000,
      });
      
      if (response.ok) {
        console.log(`[CRITICAL ALERT] Webhook notification sent successfully`);
      } else {
        console.error(`[CRITICAL ALERT] Webhook failed with status ${response.status}`);
      }
    } catch (err) {
      console.error(`[CRITICAL ALERT] Webhook notification failed:`, err);
    }
  }

  // Get Replit deployment context for error reports
  getReplitContext(): ReplitDeploymentContext {
    return getReplitContext();
  }

  // Generate a formatted support report for an error
  async generateSupportReport(errorId: string): Promise<{
    success: boolean;
    report?: string;
    jsonReport?: object;
    error?: string;
  }> {
    try {
      const errorEntry = await this.getErrorById(errorId);
      if (!errorEntry) {
        return { success: false, error: 'Error not found' };
      }

      const replitContext = getReplitContext();
      const timestamp = new Date().toISOString();

      const jsonReport = {
        reportGeneratedAt: timestamp,
        reportType: 'FintekPro Error Report',
        errorDetails: {
          id: errorEntry.id,
          errorCode: errorEntry.errorCode,
          severity: errorEntry.severity,
          status: errorEntry.status,
          module: errorEntry.module,
          message: errorEntry.message,
          occurrenceCount: errorEntry.occurrenceCount,
          firstOccurrence: errorEntry.firstOccurrence,
          lastOccurrence: errorEntry.lastOccurrence,
          environment: errorEntry.environment,
          buildVersion: errorEntry.buildVersion,
        },
        replitDeployment: {
          replId: replitContext.replId,
          replSlug: replitContext.replSlug,
          replOwner: replitContext.replOwner,
          deploymentId: replitContext.deploymentId,
          deploymentUrl: replitContext.deploymentUrl,
          replitProjectUrl: replitContext.replitUrl,
        },
        context: {
          url: errorEntry.url,
          userAgent: errorEntry.userAgent,
          requestId: errorEntry.requestId,
          transactionId: errorEntry.transactionId,
          clientId: errorEntry.clientId,
          agentId: errorEntry.agentId,
        },
        stackTrace: errorEntry.stackTrace,
        metadata: errorEntry.metadata,
        resolution: {
          status: errorEntry.status,
          acknowledgedBy: errorEntry.acknowledgedBy,
          acknowledgedAt: errorEntry.acknowledgedAt,
          resolvedBy: errorEntry.resolvedBy,
          resolvedAt: errorEntry.resolvedAt,
          resolutionNote: errorEntry.resolutionNote,
        }
      };

      // Generate human-readable text report
      const textReport = `
═══════════════════════════════════════════════════════════════
                    FINTEKPRO ERROR REPORT
═══════════════════════════════════════════════════════════════
Report Generated: ${timestamp}

─────────────────────────────────────────────────────────────
ERROR DETAILS
─────────────────────────────────────────────────────────────
Error ID:        ${errorEntry.id}
Error Code:      ${errorEntry.errorCode}
Severity:        ${errorEntry.severity?.toUpperCase()}
Status:          ${errorEntry.status}
Module:          ${errorEntry.module}
Environment:     ${errorEntry.environment}
Build Version:   ${errorEntry.buildVersion || 'N/A'}

Message:
${errorEntry.message}

Occurrences:     ${errorEntry.occurrenceCount}
First Seen:      ${errorEntry.firstOccurrence ? new Date(errorEntry.firstOccurrence).toLocaleString() : 'N/A'}
Last Seen:       ${errorEntry.lastOccurrence ? new Date(errorEntry.lastOccurrence).toLocaleString() : 'N/A'}

─────────────────────────────────────────────────────────────
REPLIT DEPLOYMENT CONTEXT
─────────────────────────────────────────────────────────────
Repl ID:         ${replitContext.replId || 'N/A'}
Repl Slug:       ${replitContext.replSlug || 'N/A'}
Repl Owner:      ${replitContext.replOwner || 'N/A'}
Deployment ID:   ${replitContext.deploymentId || 'N/A'}
Deployment URL:  ${replitContext.deploymentUrl || 'N/A'}
Project URL:     ${replitContext.replitUrl || 'N/A'}

─────────────────────────────────────────────────────────────
REQUEST CONTEXT
─────────────────────────────────────────────────────────────
URL:             ${errorEntry.url || 'N/A'}
Request ID:      ${errorEntry.requestId || 'N/A'}
Transaction ID:  ${errorEntry.transactionId || 'N/A'}
User Agent:      ${errorEntry.userAgent || 'N/A'}
Client ID:       ${errorEntry.clientId || 'N/A'}
Agent ID:        ${errorEntry.agentId || 'N/A'}

─────────────────────────────────────────────────────────────
STACK TRACE
─────────────────────────────────────────────────────────────
${errorEntry.stackTrace || 'No stack trace available'}

─────────────────────────────────────────────────────────────
RESOLUTION STATUS
─────────────────────────────────────────────────────────────
Current Status:  ${errorEntry.status}
Acknowledged By: ${errorEntry.acknowledgedBy || 'N/A'}
Acknowledged At: ${errorEntry.acknowledgedAt ? new Date(errorEntry.acknowledgedAt).toLocaleString() : 'N/A'}
Resolved By:     ${errorEntry.resolvedBy || 'N/A'}
Resolved At:     ${errorEntry.resolvedAt ? new Date(errorEntry.resolvedAt).toLocaleString() : 'N/A'}
Resolution Note: ${errorEntry.resolutionNote || 'N/A'}

═══════════════════════════════════════════════════════════════
                    END OF REPORT
═══════════════════════════════════════════════════════════════
`.trim();

      return {
        success: true,
        report: textReport,
        jsonReport
      };
    } catch (err) {
      console.error('[ErrorTracking] Failed to generate support report:', err);
      return { success: false, error: 'Failed to generate report' };
    }
  }

  // Generate a batch report for multiple errors
  async generateBatchSupportReport(errorIds: string[]): Promise<{
    success: boolean;
    report?: string;
    errorCount: number;
    errors?: string[];
  }> {
    try {
      const replitContext = getReplitContext();
      const timestamp = new Date().toISOString();
      
      const errors: ErrorLedgerEntry[] = [];
      for (const id of errorIds) {
        const error = await this.getErrorById(id);
        if (error) errors.push(error);
      }

      if (errors.length === 0) {
        return { success: false, errorCount: 0, errors: ['No valid errors found'] };
      }

      let report = `
═══════════════════════════════════════════════════════════════
              FINTEKPRO BATCH ERROR REPORT
═══════════════════════════════════════════════════════════════
Report Generated: ${timestamp}
Total Errors:     ${errors.length}

─────────────────────────────────────────────────────────────
REPLIT DEPLOYMENT CONTEXT
─────────────────────────────────────────────────────────────
Repl ID:         ${replitContext.replId || 'N/A'}
Repl Slug:       ${replitContext.replSlug || 'N/A'}
Deployment URL:  ${replitContext.deploymentUrl || 'N/A'}
Project URL:     ${replitContext.replitUrl || 'N/A'}

`;

      for (const error of errors) {
        report += `
─────────────────────────────────────────────────────────────
ERROR: ${error.errorCode}
─────────────────────────────────────────────────────────────
ID:         ${error.id}
Severity:   ${error.severity?.toUpperCase()}
Module:     ${error.module}
Message:    ${error.message}
Count:      ${error.occurrenceCount}
Status:     ${error.status}
`;
      }

      report += `
═══════════════════════════════════════════════════════════════
                    END OF BATCH REPORT
═══════════════════════════════════════════════════════════════
`;

      return {
        success: true,
        report: report.trim(),
        errorCount: errors.length
      };
    } catch (err) {
      console.error('[ErrorTracking] Failed to generate batch report:', err);
      return { success: false, errorCount: 0, errors: ['Failed to generate batch report'] };
    }
  }
}

export const errorTrackingService = new ErrorTrackingService();

import { Request } from 'express';
import { AppError } from '../utils/errors';

export async function logErrorWithTraceId(
  error: AppError,
  req: Request,
  traceId: string
): Promise<void> {
  const severity = error.status >= 500 ? 'error' : error.status >= 400 ? 'warning' : 'info';
  
  try {
    await errorTrackingService.ingestError({
      source: 'server',
      severity,
      errorCode: error.name,
      message: error.message,
      stack: error.stack,
      context: {
        module: req.path.split('/')[2] || 'api',
        requestId: traceId,
        url: req.originalUrl,
        userAgent: req.get('user-agent'),
        clientId: (req as any).user?.id,
        metadata: {
          traceId,
          method: req.method,
          status: error.status,
          isRetryable: error.isRetryable,
          errorContext: error.context,
        }
      }
    }, req.ip);
  } catch (trackingError) {
    console.error('[ERROR_TRACKING] Failed to log error with trace ID:', traceId, trackingError);
  }
}
