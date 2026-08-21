/**
 * Explorium Webhook Receiver Routes v1.0
 *
 * Receives real-time business event push notifications from Explorium.
 * Maps signals to FintekPro lead pipeline actions:
 *
 *   funding_round      → upgrade lead to HOT, WhatsApp agent alert
 *   cost_cutting       → flag risk indicators, agent caution note
 *   legal_proceedings  → risk level = high + suit count +1
 *   executive_hire     → create CRM outreach task
 *   m_and_a            → re-notify agent
 *   office_closing     → downgrade lead quality
 *   workforce_decrease → risk signal flag
 *
 * Security: HMAC-SHA256 signature verification on every request.
 *           Reject all unverified payloads with 401.
 *
 * Architecture: /routes layer — event handling via DB + services.
 * FASP-AI: All signal-driven actions logged with full audit trail.
 * Self-Healing: Non-fatal per-signal errors do not crash the handler.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
  prospectLeads,
  leadActivities,
  users,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { verifyWebhookSignature, ExploriumSignalType } from "../services/explorium-service";
import { whatsappService } from "../whatsapp";
import { logger } from "../logger";

const router = Router();

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExploriumWebhookPayload {
  event_id: string;
  enrollment_key: string; // Our internal lead ID
  business_id: string;
  signal_type: ExploriumSignalType;
  detected_at: string;
  summary?: string;
  metadata?: Record<string, unknown>;
}

// ── Raw body parser (needed for HMAC verification) ────────────────────────────

function rawBodyMiddleware(req: any, res: Response, next: any) {
  let rawBody = "";
  req.on("data", (chunk: Buffer) => { rawBody += chunk.toString(); });
  req.on("end", () => {
    req.rawBody = rawBody;
    try { req.body = JSON.parse(rawBody); } catch { req.body = {}; }
    next();
  });
}

// ── Webhook Receiver ──────────────────────────────────────────────────────────

/**
 * POST / (mounted at /api/webhooks/explorium)
 * Receives real-time business signals from Explorium.
 */
router.post("/", rawBodyMiddleware, async (req: any, res: Response) => {
  const signature = req.headers["x-explorium-signature"] as string ?? "";

  if (!verifyWebhookSignature(req.rawBody ?? "", signature)) {
    logger.warn("[Explorium webhook] Invalid signature — rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  const payload: ExploriumWebhookPayload = req.body;
  const { event_id, enrollment_key, business_id, signal_type, detected_at, summary = "", metadata = {} } = payload;

  logger.info("[Explorium webhook] Signal received", {
    event: "EXPLORIUM_SIGNAL_RECEIVED",
    event_id,
    lead_id: enrollment_key,
    signal_type,
    status: "received",
  });

  // Acknowledge immediately — Explorium requires fast 200
  res.status(200).json({ received: true, event_id });

  // Process asynchronously
  processSignal(enrollment_key, signal_type, summary, metadata, event_id).catch(
    (err: Error) => logger.error("[Explorium webhook] Signal processing error", { event: "EXPLORIUM_SIGNAL_PROCESS_ERROR", event_id, error: err.message, retryable: true }),
  );
});

// ── Signal Dispatcher ─────────────────────────────────────────────────────────

async function processSignal(
  leadId: string,
  signalType: ExploriumSignalType,
  summary: string,
  metadata: Record<string, unknown>,
  eventId: string,
): Promise<void> {
  const [lead] = await db
    .select({
      id: prospectLeads.id,
      companyName: prospectLeads.companyName,
      assignedTo: prospectLeads.assignedTo,
      leadQuality: prospectLeads.leadQuality,
    })
    .from(prospectLeads)
    .where(eq(prospectLeads.id, leadId));

  if (!lead) {
    logger.warn(`[Explorium webhook] Lead ${leadId} not found for signal ${signalType}`);
    return;
  }

  switch (signalType) {
    case "funding_round":
      await handleFundingRound(lead, summary, eventId);
      break;
    case "cost_cutting":
    case "workforce_decrease":
      await handleRiskSignal(lead, signalType, summary, eventId);
      break;
    case "legal_proceedings":
      await handleLegalProceedings(lead, summary, eventId);
      break;
    case "executive_hire":
      await handleExecutiveHire(lead, summary, eventId);
      break;
    case "m_and_a":
      await handleMAndA(lead, summary, eventId);
      break;
    case "office_closing":
      await handleOfficeClosure(lead, summary, eventId);
      break;
    default:
      await logSignalActivity(lead.id, signalType, summary, eventId);
  }
}

// ── Signal Action Handlers ────────────────────────────────────────────────────

async function handleFundingRound(lead: any, summary: string, eventId: string) {
  if (lead.leadQuality !== "hot") {
    await db.update(prospectLeads)
      .set({ leadQuality: "hot", leadScore: 85, updatedAt: new Date() })
      .where(eq(prospectLeads.id, lead.id));
  }

  await logSignalActivity(lead.id, "funding_round", summary, eventId, { leadQualityUpgraded: lead.leadQuality !== "hot" });

  if (lead.assignedTo) {
    await notifyAgent(lead.assignedTo, buildFundingAlert(lead.companyName, summary));
  }

  logger.info("[Explorium] Funding signal processed", {
    event: "EXPLORIUM_FUNDING_SIGNAL",
    lead_id: lead.id,
    company: lead.companyName,
    new_quality: "hot",
    status: "success",
  });
}

async function handleRiskSignal(lead: any, signalType: string, summary: string, eventId: string) {
  await db.update(prospectLeads)
    .set({
      riskIndicators: sql`COALESCE(risk_indicators, '[]'::jsonb) || ${JSON.stringify([{ type: signalType, summary, detectedAt: new Date().toISOString() }])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(prospectLeads.id, lead.id));

  await logSignalActivity(lead.id, signalType as ExploriumSignalType, summary, eventId, { riskFlagged: true });

  if (lead.assignedTo) {
    await notifyAgent(lead.assignedTo, buildRiskAlert(lead.companyName, signalType, summary));
  }

  logger.warn("[Explorium] Risk signal processed", { event: "EXPLORIUM_RISK_SIGNAL", lead_id: lead.id, signal_type: signalType, status: "warning" });
}

async function handleLegalProceedings(lead: any, summary: string, eventId: string) {
  await db.update(prospectLeads)
    .set({
      riskLevel: "high",
      suitFiledCasesCount: sql`COALESCE(suit_filed_cases_count, 0) + 1`,
      updatedAt: new Date(),
    })
    .where(eq(prospectLeads.id, lead.id));

  await logSignalActivity(lead.id, "legal_proceedings", summary, eventId, { amlFlagged: true });

  logger.warn("[Explorium] Legal proceedings signal", { event: "EXPLORIUM_LEGAL_SIGNAL", lead_id: lead.id, aml_flagged: true, status: "warning" });
}

async function handleExecutiveHire(lead: any, summary: string, eventId: string) {
  await logSignalActivity(lead.id, "executive_hire", summary, eventId);

  // WhatsApp the agent about the new relationship opportunity
  if (lead.assignedTo) {
    await notifyAgent(
      lead.assignedTo,
      `👔 *FintekPro: Relationship Opportunity*\n\n*${lead.companyName}* just hired a new executive.\n\n📋 ${summary}\n\nReach out for a wealth planning introduction. Login to FintekPro → Lead Inbox.`,
    );
  }

  logger.info("[Explorium] Executive hire signal", { event: "EXPLORIUM_EXEC_HIRE_SIGNAL", lead_id: lead.id, status: "success" });
}

async function handleMAndA(lead: any, summary: string, eventId: string) {
  await logSignalActivity(lead.id, "m_and_a", summary, eventId);
  if (lead.assignedTo) {
    await notifyAgent(lead.assignedTo, buildMAndAAlert(lead.companyName, summary));
  }
}

async function handleOfficeClosure(lead: any, summary: string, eventId: string) {
  const downgradeMap: Record<string, string> = { hot: "warm", warm: "cold" };
  const newQuality = downgradeMap[lead.leadQuality ?? "cold"];

  if (newQuality) {
    await db.update(prospectLeads)
      .set({ leadQuality: newQuality, updatedAt: new Date() })
      .where(eq(prospectLeads.id, lead.id));
  }

  await logSignalActivity(lead.id, "office_closing", summary, eventId, { qualityDowngraded: !!newQuality });
}

// ── Activity Logger ───────────────────────────────────────────────────────────

async function logSignalActivity(
  leadId: string,
  signalType: ExploriumSignalType | string,
  summary: string,
  eventId: string,
  extra: Record<string, unknown> = {},
) {
  await db.insert(leadActivities).values({
    leadId,
    activityType: "note",
    subject: `Explorium signal: ${signalType.replace(/_/g, " ")}`,
    description: summary || `${signalType} signal detected by Explorium`,
    performedBy: "system:explorium-webhook",
    outcome: "successful",
    metadata: { signal_type: signalType, event_id: eventId, source: "explorium", ...extra },
  } as any);
}

// ── Agent Notification ────────────────────────────────────────────────────────

async function notifyAgent(agentId: string, message: string) {
  try {
    const [agent] = await db
      .select({ mobile: users.mobile })
      .from(users)
      .where(eq(users.id, agentId));

    if (agent?.mobile) {
      await whatsappService.sendMessage(agent.mobile, message);
    }
  } catch {
    // Non-fatal
  }
}

// ── Message Templates ─────────────────────────────────────────────────────────

function buildFundingAlert(company: string, summary: string): string {
  return (
    `🚀 *FintekPro: Hot Lead Alert!*\n\n` +
    `*${company}* just received new funding!\n\n` +
    `📣 ${summary}\n\n` +
    `🔥 This lead has been upgraded to HOT. Reach out now for wealth planning opportunities.\n\n` +
    `Login to FintekPro → Lead Inbox for details.`
  );
}

function buildRiskAlert(company: string, signalType: string, summary: string): string {
  return (
    `⚠️ *FintekPro: Risk Signal Detected*\n\n` +
    `*${company}* — ${signalType.replace(/_/g, " ")}\n\n` +
    `📋 ${summary}\n\n` +
    `Please review this lead before your next contact.`
  );
}

function buildMAndAAlert(company: string, summary: string): string {
  return (
    `🏦 *FintekPro: M&A Activity Detected*\n\n` +
    `*${company}* has M&A activity:\n\n` +
    `📋 ${summary}\n\n` +
    `This may create liquidity events. Review in FintekPro → Lead Inbox.`
  );
}

export { router as exploriumWebhookRouter };
