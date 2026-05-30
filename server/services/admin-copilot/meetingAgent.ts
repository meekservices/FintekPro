/**
 * meetingAgent.ts — Zoho Meeting Agent (Phase 2 — LIVE)
 *
 * @purpose  Schedule meetings, generate AI agendas, send post-meeting summaries,
 *           extract follow-up tasks, track no-shows.
 * @inputs   connectionId (zoho_connections.id), adminUserId (users.id)
 * @outputs  ai_meeting_actions, ai_meeting_notes, ai_meeting_followups, ai_admin_tasks
 *
 * FASP-AI v1.0 GUARDRAILS:
 *  - AI NEVER sends meeting invites to clients without Admin approval.
 *  - AI NEVER shares meeting notes externally without Admin approval.
 *  - All outputs logged to ai_audit_logs (append-only).
 */

import { db }                      from '../../db';
import {
  aiMeetingActions,
  aiMeetingNotes,
  aiMeetingFollowups,
}                                  from '@shared/schema/admin-copilot';
import { eq }                      from 'drizzle-orm';
import { createZohoMeetingService } from '../../zoho/services/meeting';
import { callGemini }              from './geminiService';
import { auditLog }                from './auditLogger';
import { createTaskFromSource }    from './taskAgent';

// ── Factory ───────────────────────────────────────────────────────────────────
function buildMeetingService(connectionId: string) {
  const dataCenter = process.env.ZOHO_DATA_CENTER || 'in';
  return createZohoMeetingService(connectionId, dataCenter);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Schedule Meeting (creates DRAFT — no invite sent until Admin approves)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates a meeting draft with an AI-generated agenda.
 * GUARDRAIL: Invite is NOT sent until Admin runs sendMeetingInvite().
 */
export async function scheduleMeeting(
  params: {
    meetingType:       string;
    title:             string;
    description?:      string;
    scheduledAt:       Date;
    durationMin?:      number;
    timezone?:         string;
    hostEmail?:        string;
    attendees?:        { name: string; email: string; role?: string }[];
    linkedCrmLeadId?:  string;
    linkedTicketId?:   string;
    linkedProposalId?: string;
  },
  connectionId: string,
  adminUserId:  string,
): Promise<{ meetingId: string; agenda: string; confidenceScore: number }> {
  const start = Date.now();

  const systemPrompt = `You are a professional meeting agenda AI for a SEBI-regulated Indian financial advisory firm.
Generate concise, structured meeting agendas. Respond with agenda text only. No JSON. No markdown.`;

  const userPrompt = `Create a ${params.durationMin || 60}-minute agenda for:
Type: ${params.meetingType}
Title: ${params.title}
Description: ${params.description || 'Not provided'}
Attendees: ${params.attendees?.map((a) => `${a.name} (${a.role || 'attendee'})`).join(', ') || 'TBD'}

Format: numbered list with time estimates. Include welcome, 2-4 main items, action items, Q&A. Max 150 words.`;

  const { data: agendaData, meta } = await callGemini<string>(systemPrompt, userPrompt, { parseJson: false });
  const agenda = typeof agendaData === 'string' ? agendaData : JSON.stringify(agendaData);

  const [meeting] = await db.insert(aiMeetingActions).values({
    connectionId,
    meetingType:      params.meetingType,
    title:            params.title,
    description:      agenda,
    scheduledAt:      params.scheduledAt,
    durationMin:      params.durationMin || 60,
    timezone:         params.timezone || 'Asia/Kolkata',
    hostEmail:        params.hostEmail,
    attendees:        params.attendees || [],
    linkedCrmLeadId:  params.linkedCrmLeadId,
    linkedTicketId:   params.linkedTicketId,
    linkedProposalId: params.linkedProposalId,
    meetingStatus:    'draft',
    confidenceScore:  meta.confidence_score,
    modelVersion:     meta.model_version,
    approvalStatus:   'draft',
    requestedBy:      adminUserId,
    source:           'ai',
  }).returning();

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'meeting', agentAction: 'schedule_meeting',
    entityId: meeting.id, entityType: 'ai_meeting_actions',
    outputSummary: `Meeting draft: "${params.title}" on ${params.scheduledAt.toISOString()}`,
    confidenceScore: meta.confidence_score, modelVersion: meta.model_version,
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'draft',
  });

  return { meetingId: meeting.id, agenda, confidenceScore: meta.confidence_score };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Send Meeting Invite (Admin-approved only)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Creates the meeting in Zoho Meeting and sends invites to attendees.
 * GUARDRAIL: Only called by processApproval() after Admin 2-step confirmation.
 */
export async function sendMeetingInvite(
  meetingActionId: string,
  connectionId:    string,
  adminUserId:     string,
): Promise<{ zohoMeetingId: string; joiningLink: string }> {
  const start = Date.now();

  const [record] = await db.select().from(aiMeetingActions)
    .where(eq(aiMeetingActions.id, meetingActionId)).limit(1);
  if (!record)                         throw new Error('Meeting action not found');
  if (record.zohoMeetingId)            throw new Error('Invite already sent');
  if (record.approvalStatus !== 'approved') throw new Error('Meeting invite not yet approved');

  const svc       = buildMeetingService(connectionId);
  const attendees = (record.attendees as { name: string; email: string }[] | null) || [];

  const zohoMeeting = await svc.createMeeting({
    topic:        record.title,
    agenda:       record.description || '',
    startTime:    record.scheduledAt ? new Date(record.scheduledAt) : new Date(),
    duration:     record.durationMin || 60,
    timezone:     record.timezone || 'Asia/Kolkata',
    participants: attendees.map((a) => ({ email: a.email, name: a.name })),
  });

  const meetingKey  = zohoMeeting.meeting_key || '';
  const joiningLink = zohoMeeting.join_url    || '';

  await db.update(aiMeetingActions)
    .set({
      zohoMeetingId: meetingKey,
      meetingStatus: 'invite_sent',
      joiningLink,
      inviteSentAt:  new Date(),
      updatedAt:     new Date(),
    })
    .where(eq(aiMeetingActions.id, meetingActionId));

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'meeting', agentAction: 'send_invite',
    entityId: meetingActionId, entityType: 'ai_meeting_actions',
    outputSummary: `Invite sent to ${attendees.length} attendees. Link: ${joiningLink.substring(0, 50)}`,
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'approved',
    externalApiCalled: true, externalService: 'zoho_meeting',
    externalCallStatus: 'success', externalCallMs: Date.now() - start,
  });

  return { zohoMeetingId: meetingKey, joiningLink };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Generate Post-Meeting Summary
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GUARDRAIL: Notes are DRAFT until Admin approves sharing.
 */
interface PostMeetingAI {
  summary:               string;
  keyDecisions:          string[];
  actionItems:           { task: string; owner: string; dueDate?: string }[];
  nextSteps:             string;
  complianceNote?:       string;
  isComplianceSensitive: boolean;
}

export async function generatePostMeetingSummary(
  meetingActionId: string,
  transcript:      string,
  attendeeInfo: {
    present?: { name: string; email?: string }[];
    absent?:  { name: string; email?: string }[];
    actualDurationMin?: number;
  },
  adminUserId: string,
): Promise<{ notesId: string; summary: string; confidenceScore: number }> {
  const start = Date.now();

  const [meeting] = await db.select().from(aiMeetingActions)
    .where(eq(aiMeetingActions.id, meetingActionId)).limit(1);
  if (!meeting) throw new Error('Meeting action not found');

  const systemPrompt = `You are a professional meeting minutes AI for a SEBI-regulated Indian financial services firm.
Summarise meetings accurately. Return valid JSON only. No markdown.`;

  const userPrompt = `Meeting: ${meeting.title} (${meeting.meetingType})
Attendees present: ${attendeeInfo.present?.map((a) => a.name).join(', ') || 'Not specified'}
Duration: ${attendeeInfo.actualDurationMin || meeting.durationMin} minutes

Transcript:
${transcript.substring(0, 3000)}

Return:
{
  "summary": "<3-4 sentence executive summary>",
  "keyDecisions": ["<decision>"],
  "actionItems": [{"task": "string", "owner": "string", "dueDate": "YYYY-MM-DD or null"}],
  "nextSteps": "<2-3 sentences>",
  "complianceNote": "string or null",
  "isComplianceSensitive": boolean
}`;

  const { data: parsed, meta } = await callGemini<PostMeetingAI>(systemPrompt, userPrompt, { parseJson: true });

  const noShowCount = attendeeInfo.absent?.length || 0;

  const [notes] = await db.insert(aiMeetingNotes).values({
    meetingActionId,
    zohoMeetingId:         meeting.zohoMeetingId,
    attendeesPresent:      attendeeInfo.present || [],
    attendeesAbsent:       attendeeInfo.absent  || [],
    noShowCount,
    actualDurationMin:     attendeeInfo.actualDurationMin || meeting.durationMin,
    summary:               parsed.summary,
    keyDecisions:          parsed.keyDecisions,
    actionItems:           parsed.actionItems,
    nextSteps:             parsed.nextSteps,
    complianceNote:        parsed.complianceNote || null,
    isComplianceSensitive: parsed.isComplianceSensitive || false,
    confidenceScore:       meta.confidence_score,
    modelVersion:          meta.model_version,
    approvalStatus:        'draft',
    source:                'ai',
  }).returning();

  await db.update(aiMeetingActions)
    .set({ meetingStatus: 'completed', updatedAt: new Date() })
    .where(eq(aiMeetingActions.id, meetingActionId));

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'meeting', agentAction: 'post_meeting_summary',
    entityId: notes.id, entityType: 'ai_meeting_notes',
    outputSummary: parsed.summary.substring(0, 150),
    confidenceScore: meta.confidence_score, modelVersion: meta.model_version,
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'draft',
  });

  return { notesId: notes.id, summary: parsed.summary, confidenceScore: meta.confidence_score };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Extract Follow-up Tasks from Meeting Notes
// ─────────────────────────────────────────────────────────────────────────────
export async function extractFollowupTasks(
  meetingNotesId: string,
  adminUserId:    string,
): Promise<{ followupIds: string[]; tasksCreated: number }> {
  const start = Date.now();

  const [notes] = await db.select().from(aiMeetingNotes)
    .where(eq(aiMeetingNotes.id, meetingNotesId)).limit(1);
  if (!notes) throw new Error('Meeting notes not found');

  const actionItems = (notes.actionItems as { task: string; owner: string; dueDate?: string }[]) || [];
  const followupIds: string[] = [];

  for (const item of actionItems) {
    const dueDate = item.dueDate ? new Date(item.dueDate) : undefined;

    const [followup] = await db.insert(aiMeetingFollowups).values({
      meetingNotesId,
      meetingActionId: notes.meetingActionId,
      taskTitle:       item.task,
      taskDescription: `From meeting notes: ${notes.summary?.substring(0, 100)}`,
      assignedToRole:  item.owner?.toLowerCase().includes('admin') ? 'admin' : 'agent',
      dueDate,
      priority:        dueDate && dueDate < new Date(Date.now() + 3 * 24 * 3600000) ? 'high' : 'medium',
      confidenceScore: notes.confidenceScore,
      modelVersion:    notes.modelVersion,
      approvalStatus:  'draft',
      source:          'ai',
    }).returning();

    followupIds.push(followup.id);
  }

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'meeting', agentAction: 'extract_followups',
    entityId: meetingNotesId, entityType: 'ai_meeting_notes',
    outputSummary: `Extracted ${actionItems.length} follow-up tasks from meeting notes`,
    latencyMs: Date.now() - start, status: 'success', approvalStatus: 'draft',
  });

  return { followupIds, tasksCreated: followupIds.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Track No-Shows
// ─────────────────────────────────────────────────────────────────────────────
export async function trackNoShows(
  connectionId: string,
  adminUserId:  string,
): Promise<number> {
  const start = Date.now();

  const noShowMeetings = await db.select().from(aiMeetingActions)
    .where(eq(aiMeetingActions.meetingStatus, 'no_show'))
    .limit(50);

  for (const meeting of noShowMeetings) {
    await createTaskFromSource({
      source:          'meeting',
      sourceId:        meeting.id,
      adminUserId,
      adminPrompt:     `Follow-up required: No-show for meeting "${meeting.title}" scheduled for ${meeting.scheduledAt?.toISOString()}. Meeting type: ${meeting.meetingType}. Re-schedule or follow up with attendees.`,
      linkedMeetingId: meeting.id,
    });
  }

  await auditLog({
    userId: adminUserId, userRole: 'admin',
    agentType: 'meeting', agentAction: 'track_no_shows',
    outputSummary: `Created ${noShowMeetings.length} follow-up tasks for no-show meetings`,
    latencyMs: Date.now() - start, status: 'success',
  });

  return noShowMeetings.length;
}
