/**
 * biAgent.ts — Analytics BI Agent (Phase 1: Cloud SQL)
 * Phase 1: Queries FintekPro's own Cloud SQL data for daily BI summaries.
 * Phase 2: Will integrate Zoho Analytics API V2.
 *
 * Purpose : Generate daily BI snapshot + answer NL questions about business data.
 * Inputs  : date range + optional NL question
 * Outputs : BiSummary object + NL answer
 */

import { db } from '../../db';
import { aiBiReports } from '@shared/schema/admin-copilot';
import { callGemini } from './geminiService';
import { auditLog, logCopilotEvent } from './auditLogger';
import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';

export interface BiSummary {
  reportDate:           string;
  leads:                number;
  conversions:          number;
  proposalsDrafted:     number;
  proposalsApproved:    number;
  complaintRatio:       number;
  kycPending:           number;
  tasksOpen:            number;
  tasksCritical:        number;
  emailsClassified:     number;
  highUrgencyEmails:    number;
  invoicesDraft:        number;
  invoicesOverdue:      number;
  meetingsScheduled:    number;
  meetingNoShows:       number;
  complianceAlerts:     number;
  dataSource:           string;
}

async function fetchBiDataFromCloudSql(dateStr: string): Promise<BiSummary> {
  // Query ai_* tables for daily snapshot
  const [taskStats] = await db.execute<{ open: string; critical: string }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE status NOT IN ('completed','closed')) AS open,
      COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('completed','closed')) AS critical
    FROM ai_admin_tasks
    WHERE created_at::date = ${dateStr}::date
  `);

  const [emailStats] = await db.execute<{ total: string; high: string }>(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE urgency IN ('critical','high')) AS high
    FROM ai_email_classifications
    WHERE created_at::date = ${dateStr}::date
  `);

  const [proposalStats] = await db.execute<{ drafted: string; approved: string }>(sql`
    SELECT
      COUNT(*) AS drafted,
      COUNT(*) FILTER (WHERE approval_status = 'approved') AS approved
    FROM ai_proposal_drafts
    WHERE created_at::date = ${dateStr}::date
  `);

  const [complianceStats] = await db.execute<{ total: string }>(sql`
    SELECT COUNT(*) AS total FROM ai_compliance_alerts WHERE status = 'open'
  `);

  const [invoiceStats] = await db.execute<{ draft: string; overdue: string }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE approval_status = 'draft') AS draft,
      COUNT(*) FILTER (WHERE due_date < NOW() AND issued_to_zoho_books = false) AS overdue
    FROM ai_invoice_drafts
  `);

  const [meetingStats] = await db.execute<{ scheduled: string; no_shows: string }>(sql`
    SELECT
      COUNT(*) FILTER (WHERE meeting_status = 'completed') AS scheduled,
      COUNT(*) FILTER (WHERE meeting_status = 'no_show') AS no_shows
    FROM ai_meeting_actions
    WHERE scheduled_at::date = ${dateStr}::date
  `);

  return {
    reportDate:        dateStr,
    leads:             0,   // Phase 2: from CRM sync
    conversions:       0,   // Phase 2: from CRM sync
    proposalsDrafted:  Number((proposalStats as any)?.drafted ?? 0),
    proposalsApproved: Number((proposalStats as any)?.approved ?? 0),
    complaintRatio:    0,   // Phase 2: from Desk sync
    kycPending:        0,   // Phase 2: from KYC module
    tasksOpen:         Number((taskStats as any)?.open ?? 0),
    tasksCritical:     Number((taskStats as any)?.critical ?? 0),
    emailsClassified:  Number((emailStats as any)?.total ?? 0),
    highUrgencyEmails: Number((emailStats as any)?.high ?? 0),
    invoicesDraft:     Number((invoiceStats as any)?.draft ?? 0),
    invoicesOverdue:   Number((invoiceStats as any)?.overdue ?? 0),
    meetingsScheduled: Number((meetingStats as any)?.scheduled ?? 0),
    meetingNoShows:    Number((meetingStats as any)?.no_shows ?? 0),
    complianceAlerts:  Number((complianceStats as any)?.total ?? 0),
    dataSource:        'cloud_sql',
  };
}

export async function generateBiSummary(
  adminUserId: string,
  dateStr?:    string,
): Promise<BiSummary> {
  const startMs = Date.now();
  const date    = dateStr ?? new Date().toISOString().split('T')[0];

  const summary = await fetchBiDataFromCloudSql(date);

  // Store to DB
  await db.insert(aiBiReports).values({
    reportDate:  new Date(date),
    reportType:  'daily',
    summary,
    dataSource:  'cloud_sql',
    generatedBy: adminUserId,
    modelVersion: 'gemini-2.0-flash',
    confidenceScore: 0.95,
    auditId: randomUUID(),
    source: 'ai',
  });

  await auditLog({
    userId: adminUserId, agentType: 'bi', agentAction: 'bi_summary_generated',
    outputSummary: `Daily BI for ${date}: ${summary.tasksOpen} open tasks, ${summary.complianceAlerts} compliance alerts`,
    latencyMs: Date.now() - startMs,
  });

  logCopilotEvent('BI_AGENT_SUMMARY', adminUserId, Date.now() - startMs, 'success', { date });

  return summary;
}

const BI_NL_SYSTEM = `
You are a business intelligence assistant for FintekPro.
Given structured BI data and a natural language question, provide a clear, concise answer.
Return JSON: { "answer": "...", "insight": "one line actionable insight", "confidence": 0-1 }
`.trim();

export async function answerBiQuestion(
  question:    string,
  biSummary:   BiSummary,
  adminUserId: string,
): Promise<{ answer: string; insight: string; confidence: number }> {
  const userPrompt = `BI Data: ${JSON.stringify(biSummary)}\n\nQuestion: ${question}`;
  const { data, meta } = await callGemini<{ answer: string; insight: string; confidence: number }>(
    BI_NL_SYSTEM, userPrompt, { parseJson: true },
  );

  await auditLog({
    userId: adminUserId, agentType: 'bi', agentAction: 'bi_nl_question',
    inputContext: { question },
    outputSummary: data.answer?.slice(0, 200),
    confidenceScore: meta.confidence_score,
  });

  return {
    answer:     data.answer ?? 'Unable to answer at this time.',
    insight:    data.insight ?? '',
    confidence: data.confidence ?? meta.confidence_score,
  };
}
