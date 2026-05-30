/**
 * deskAgent.ts — Zoho Desk Intelligence Agent (Phase 2 — LIVE)
 *
 * @purpose  Sync support tickets from Zoho Desk, AI-classify them, draft responses,
 *           flag SLA breach risk, escalate high-risk tickets.
 * @inputs   connectionId (zoho_connections.id), adminUserId (users.id)
 * @outputs  ai_desk_ticket_actions, ai_compliance_alerts, ai_admin_tasks
 *
 * FASP-AI v1.0 GUARDRAILS:
 *  - AI NEVER closes tickets, sends replies, or escalates without Admin approval.
 *  - Draft responses stored as DRAFT — sent only after 2-step confirmation.
 *  - All outputs logged to ai_audit_logs (append-only).
 */

import { db }               from '../../db';
import {
  aiDeskTicketActions,
  aiComplianceAlerts,
}                           from '@shared/schema/admin-copilot';
import { eq }               from 'drizzle-orm';
import { ZohoDeskService }  from '../../zoho/services/desk';
import { callGemini }       from './geminiService';
import { auditLog }         from './auditLogger';
import { createTaskFromSource } from './taskAgent';

// ── Factory ────────────────────────────────────────────────────────────────
function buildDeskService(connectionId: string): ZohoDeskService {
  const dataCenter = process.env.ZOHO_DATA_CENTER || 'in';
  return new ZohoDeskService(connectionId, dataCenter);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sync Desk Tickets + AI Classify
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetches open tickets from Zoho Desk, AI-classifies each one, and stores
 * results in ai_desk_ticket_actions.
 */
export async function syncDeskTickets(
  connectionId: string,
  adminUserId:  string,
): Promise<{ synced: number; highRisk: number; slaBreachRisk: number }> {
  const start = Date.now();
  const desk  = buildDeskService(connectionId);

  const result = await desk.getTickets({
    status:  'Open',
    limit:   100,
    include: 'contacts,assignee,departments',
  });

  let highRisk      = 0;
  let slaBreachRisk = 0;

  for (const ticket of result.data) {
    const [existing] = await db.select().from(aiDeskTicketActions)
      .where(eq(aiDeskTicketActions.zohoTicketId, ticket.id)).limit(1);

    let classification = {
      category:         'general' as string,
      isComplaint:      false,
      isHighRisk:       false,
      slaBreach:        ticket.isOverDue,
      slaBreachRiskPct: ticket.isOverDue ? 90 : 20,
      draftResponse:    null as string | null,
      confidence:       0.80,
    };

    try {
      classification = await classifyTicket(ticket, adminUserId);
    } catch (err) {
      console.error(`[Desk Agent] Classification failed for ticket ${ticket.id}:`, err);
    }

    if (classification.isHighRisk) highRisk++;
    if (classification.slaBreachRiskPct >= 75) slaBreachRisk++;

    const baseData = {
      zohoTicketId:        ticket.id,
      zohoDepartment:      ticket.department?.name,
      connectionId,
      subject:             ticket.subject,
      contactName:         ticket.contact
        ? [ticket.contact.firstName, ticket.contact.lastName].filter(Boolean).join(' ')
        : undefined,
      contactEmail:        ticket.contact?.email,
      ticketStatus:        ticket.status,
      priority:            ticket.priority,
      createdInZoho:       ticket.createdTime ? new Date(ticket.createdTime) : undefined,
      dueDate:             ticket.dueDate ? new Date(ticket.dueDate) : undefined,
      category:            classification.category,
      isComplaint:         classification.isComplaint,
      isHighRisk:          classification.isHighRisk,
      slaBreach:           classification.slaBreach,
      slaBreachRiskPct:    classification.slaBreachRiskPct,
      draftResponse:       classification.draftResponse,
      confidenceScore:     classification.confidence,
      modelVersion:        'gemini-2.0-flash',
      approvalStatus:      'draft' as const,
      syncedAt:            new Date(),
      source:              'ai' as const,
    };

    if (existing) {
      await db.update(aiDeskTicketActions)
        .set({ ...baseData, updatedAt: new Date() })
        .where(eq(aiDeskTicketActions.id, existing.id));
    } else {
      await db.insert(aiDeskTicketActions).values(baseData);
    }

    if (classification.isHighRisk || classification.slaBreachRiskPct >= 75) {
      await flagTicketAsHighRisk(ticket, classification, connectionId, adminUserId);
    }
  }

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'desk', agentAction: 'sync_desk_tickets',
    outputSummary: `Synced ${result.data.length} tickets. High-risk: ${highRisk}. SLA breach risk: ${slaBreachRisk}.`,
    latencyMs: Date.now() - start, status: 'success',
    externalApiCalled: true, externalService: 'zoho_desk',
    externalCallStatus: 'success', externalCallMs: Date.now() - start,
  });

  return { synced: result.data.length, highRisk, slaBreachRisk };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AI Ticket Classification + Draft Response
// ─────────────────────────────────────────────────────────────────────────────
interface TicketClassificationAI {
  category:           string;
  isComplaint:        boolean;
  isHighRisk:         boolean;
  riskReason:         string | null;
  slaBreachRiskPct:   number;
  draftResponse:      string;
  escalationRequired: boolean;
}

async function classifyTicket(
  ticket: {
    id: string;
    subject?: string;
    description?: string;
    status:   string;
    priority: string;
    isOverDue: boolean;
    isEscalated: boolean;
    dueDate?: string;
    contact?: { firstName?: string; lastName?: string; email?: string };
  },
  adminUserId: string,
): Promise<{
  category: string;
  isComplaint: boolean;
  isHighRisk: boolean;
  slaBreach: boolean;
  slaBreachRiskPct: number;
  draftResponse: string | null;
  confidence: number;
}> {
  const dueMs  = ticket.dueDate ? new Date(ticket.dueDate).getTime() - Date.now() : Infinity;
  const dueHrs = Math.round(dueMs / 3600000);

  const systemPrompt = `You are a support ticket AI for a SEBI-regulated Indian financial services firm.
Classify tickets and draft professional responses. Return valid JSON only. No markdown.`;

  const userPrompt = `Subject: ${ticket.subject || 'No subject'}
Description: ${ticket.description?.substring(0, 500) || 'No description'}
Status: ${ticket.status} | Priority: ${ticket.priority}
Overdue: ${ticket.isOverDue} | Due in: ${isFinite(dueHrs) ? `${dueHrs}h` : 'No due date'}
Contact: ${ticket.contact?.firstName || ''} ${ticket.contact?.lastName || ''}

Return:
{
  "category": "complaint|billing|technical|product_enquiry|kyc|general",
  "isComplaint": boolean,
  "isHighRisk": boolean,
  "riskReason": "string or null",
  "slaBreachRiskPct": 0-100,
  "draftResponse": "Professional 2-3 sentence response",
  "escalationRequired": boolean
}
isHighRisk = true if: complaint, regulatory threat, PII issue, large investment dispute, or media threat.`;

  const { data: parsed, meta } = await callGemini<TicketClassificationAI>(
    systemPrompt, userPrompt, { parseJson: true },
  );

  return {
    category:         parsed.category || 'general',
    isComplaint:      parsed.isComplaint || false,
    isHighRisk:       parsed.isHighRisk || ticket.isEscalated,
    slaBreach:        ticket.isOverDue,
    slaBreachRiskPct: parsed.slaBreachRiskPct ?? (ticket.isOverDue ? 90 : 20),
    draftResponse:    parsed.draftResponse || null,
    confidence:       meta.confidence_score,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Generate Draft Response (on demand)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GUARDRAIL: Response is stored as DRAFT — never sent without Admin approval.
 */
export async function generateDraftResponse(
  deskTicketActionId: string,
  adminUserId:        string,
  extraContext?:      string,
): Promise<{ draftResponse: string; confidenceScore: number }> {
  const start = Date.now();

  const [record] = await db.select().from(aiDeskTicketActions)
    .where(eq(aiDeskTicketActions.id, deskTicketActionId)).limit(1);
  if (!record) throw new Error('Desk ticket action not found');

  const systemPrompt = `You are a support response AI for a SEBI-regulated Indian financial services firm.
Write professional, empathetic support responses. Respond with the response text only. No JSON.`;

  const userPrompt = `Write a 3-4 sentence professional response for:
Subject: ${record.subject || ''}
Category: ${record.category || 'general'}
Contact: ${record.contactName || 'Valued Client'}
${extraContext ? `Context: ${extraContext}` : ''}

Rules: Professional tone, acknowledge issue, state next steps (24h contact), no profit promises, add SEBI disclaimer if investment-related.`;

  const { data: responseText, meta } = await callGemini<string>(
    systemPrompt, userPrompt, { parseJson: false },
  );

  const draftResponse = typeof responseText === 'string' ? responseText : JSON.stringify(responseText);

  await db.update(aiDeskTicketActions)
    .set({
      draftResponse,
      draftResponseStatus: 'draft',
      confidenceScore:     meta.confidence_score,
      modelVersion:        meta.model_version,
      updatedAt:           new Date(),
    })
    .where(eq(aiDeskTicketActions.id, deskTicketActionId));

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'desk', agentAction: 'draft_response',
    entityId: deskTicketActionId, entityType: 'ai_desk_ticket_actions',
    outputSummary: draftResponse.substring(0, 150),
    confidenceScore: meta.confidence_score, modelVersion: meta.model_version,
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'draft',
  });

  return { draftResponse, confidenceScore: meta.confidence_score };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Flag SLA Breach Risk
// ─────────────────────────────────────────────────────────────────────────────
export async function flagSlaBreachRisk(
  connectionId: string,
  adminUserId:  string,
): Promise<number> {
  const start = Date.now();
  const desk  = buildDeskService(connectionId);
  const overdue = await desk.getOverdueTickets();
  let flagged = 0;

  for (const ticket of overdue) {
    await db.insert(aiComplianceAlerts).values({
      alertType:       'sla_breach',
      severity:        ticket.priority === 'Urgent' || ticket.isEscalated ? 'critical' : 'high',
      title:           `SLA breach: Ticket #${ticket.ticketNumber} — ${ticket.subject?.substring(0, 60)}`,
      detail:          `Status: ${ticket.status} | Priority: ${ticket.priority} | Contact: ${ticket.contact?.email || 'Unknown'}`,
      agentType:       'desk',
      entityId:        ticket.id,
      entityType:      'zoho_desk_ticket',
      status:          'open',
      confidenceScore: 0.95,
      modelVersion:    'system-v1',
      source:          'ai',
    });
    flagged++;
  }

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'desk', agentAction: 'flag_sla_breach',
    outputSummary: `Flagged ${flagged} SLA breach tickets as compliance alerts`,
    latencyMs: Date.now() - start, status: 'success',
  });

  return flagged;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Escalate Ticket (Admin-approved only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GUARDRAIL: Only called by processApproval() after Admin confirms.
 */
export async function escalateTicket(
  deskTicketActionId: string,
  reason:             string,
  connectionId:       string,
  adminUserId:        string,
): Promise<void> {
  const start = Date.now();

  const [record] = await db.select().from(aiDeskTicketActions)
    .where(eq(aiDeskTicketActions.id, deskTicketActionId)).limit(1);
  if (!record)              throw new Error('Desk ticket action not found');
  if (!record.zohoTicketId) throw new Error('Ticket has no Zoho Ticket ID');

  const desk = buildDeskService(connectionId);
  await desk.escalateTicket(record.zohoTicketId, reason);

  await db.update(aiDeskTicketActions)
    .set({
      ticketStatus:     'Escalated',
      isHighRisk:       true,
      escalationReason: reason,
      approvalStatus:   'approved',
      approvedBy:       adminUserId,
      approvedAt:       new Date(),
      updatedAt:        new Date(),
    })
    .where(eq(aiDeskTicketActions.id, deskTicketActionId));

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'desk', agentAction: 'escalate_ticket',
    entityId: deskTicketActionId, entityType: 'ai_desk_ticket_actions',
    outputSummary: `Ticket escalated: ${reason.substring(0, 100)}`,
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'approved',
    externalApiCalled: true, externalService: 'zoho_desk',
    externalCallStatus: 'success', externalCallMs: Date.now() - start,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Send Draft Response (Admin-approved only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GUARDRAIL: Only called after processApproval() 2-step confirmation.
 */
export async function sendDraftResponse(
  deskTicketActionId: string,
  connectionId:       string,
  adminUserId:        string,
): Promise<void> {
  const start = Date.now();

  const [record] = await db.select().from(aiDeskTicketActions)
    .where(eq(aiDeskTicketActions.id, deskTicketActionId)).limit(1);
  if (!record)               throw new Error('Desk ticket action not found');
  if (!record.zohoTicketId)  throw new Error('No Zoho Ticket ID on record');
  if (!record.draftResponse) throw new Error('No draft response to send');
  if (record.approvalStatus !== 'approved') throw new Error('Draft response not approved');

  const desk = buildDeskService(connectionId);
  await desk.replyToTicket(record.zohoTicketId, {
    content:  record.draftResponse,
    isPublic: true,
  });

  await db.update(aiDeskTicketActions)
    .set({ draftResponseStatus: 'sent', updatedAt: new Date() })
    .where(eq(aiDeskTicketActions.id, deskTicketActionId));

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'desk', agentAction: 'send_response',
    entityId: deskTicketActionId, entityType: 'ai_desk_ticket_actions',
    outputSummary: 'Draft response sent to Zoho Desk (public reply)',
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'approved',
    externalApiCalled: true, externalService: 'zoho_desk',
    externalCallStatus: 'success', externalCallMs: Date.now() - start,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Internal — Flag High Risk Ticket
// ─────────────────────────────────────────────────────────────────────────────
async function flagTicketAsHighRisk(
  ticket: { id: string; ticketNumber: string; subject?: string; priority: string; contact?: { email?: string } },
  classification: { isHighRisk: boolean; slaBreachRiskPct: number },
  connectionId: string,
  adminUserId:  string,
): Promise<void> {
  await db.insert(aiComplianceAlerts).values({
    alertType:       classification.isHighRisk ? 'complaint_high_risk' : 'sla_breach',
    severity:        classification.isHighRisk ? 'critical' : 'high',
    title:           `${classification.isHighRisk ? '⚠️ High-risk complaint' : '⏰ SLA breach risk'}: #${ticket.ticketNumber}`,
    detail:          `${ticket.subject?.substring(0, 100)} | Contact: ${ticket.contact?.email || 'Unknown'} | SLA risk: ${classification.slaBreachRiskPct}%`,
    agentType:       'desk',
    entityId:        ticket.id,
    entityType:      'zoho_desk_ticket',
    status:          'open',
    confidenceScore: 0.90,
    modelVersion:    'gemini-2.0-flash',
    source:          'ai',
  });

  if (classification.isHighRisk) {
    await createTaskFromSource({
      source:          'desk',
      sourceId:        ticket.id,
      adminUserId,
      adminPrompt:     `URGENT: High-risk complaint — Ticket #${ticket.ticketNumber}: ${ticket.subject || 'Complaint'}. Contact: ${ticket.contact?.email || 'Unknown'}. Immediate admin review required. SLA risk: ${classification.slaBreachRiskPct}%.`,
      linkedTicketId:  ticket.id,
    });
  }
}
