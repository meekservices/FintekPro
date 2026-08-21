/**
 * Agent Lead Inbox Routes v1.0
 *
 * Provides agents with a prioritised, quota-tracked daily work queue.
 * Replaces the flat unstructured prospect list with actionable lead cards.
 *
 * Endpoints:
 *   GET  /api/agent/lead-inbox           - prioritised lead list for today
 *   GET  /api/agent/lead-inbox/stats     - quota progress + conversion metrics
 *   GET  /api/agent/lead-inbox/stale     - leads needing urgent attention
 *   POST /api/agent/lead-inbox/:id/action - log a contact attempt or outcome
 *
 * Architecture: /routes layer — business logic delegated to /services.
 * All responses follow: { success, data, meta: { timestamp, version } }
 * All lists support pagination: page, limit, total
 */

import { Router, Response } from "express";
import { db } from "../db";
import {
  prospectLeads,
  leadActivities,
  users,
} from "@shared/schema";
import { eq, and, sql, desc, count, isNotNull } from "drizzle-orm";
import { requireAgent } from "../middleware/roleMiddleware";
import { getAgentStaleSummary } from "../services/lead-leakage-monitor";
import { z } from "zod";
import { logger } from "../logger";

const router = Router();

const DEFAULT_DAILY_QUOTA = 10;
const META = { timestamp: () => new Date().toISOString(), version: "1.0" };

// ── Schema ────────────────────────────────────────────────────────────────────

const actionSchema = z.object({
  activityType: z.enum(["call", "email", "whatsapp", "meeting", "note"]),
  outcome: z
    .enum(["successful", "no_response", "callback_requested", "not_interested"])
    .optional(),
  notes: z.string().optional(),
  nextFollowUpDays: z.number().int().min(1).max(90).optional(),
  convertedToClient: z.boolean().optional(),
});

// ── GET /api/agent/lead-inbox ─────────────────────────────────────────────────

/**
 * Returns the agent's prioritised lead queue.
 * Sorted: hot > warm > cold, then by lead_score DESC.
 * Supports filtering by status and search.
 */
router.get("/", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId: string = req.user.id;
    const {
      status,
      quality,
      page = "1",
      limit = "20",
      search,
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, parseInt(limit) || 20);
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(prospectLeads.assignedTo, agentId)];

    if (status && status !== "all") conditions.push(eq(prospectLeads.status, status));
    if (quality && quality !== "all") conditions.push(eq(prospectLeads.leadQuality, quality));
    if (search) {
      conditions.push(
        sql`(${prospectLeads.companyName} ILIKE ${`%${search}%`} OR ${prospectLeads.primaryEmail} ILIKE ${`%${search}%`} OR ${prospectLeads.city} ILIKE ${`%${search}%`})`,
      );
    }

    const leads = await db
      .select({
        id: prospectLeads.id,
        companyName: prospectLeads.companyName,
        cin: prospectLeads.cin,
        city: prospectLeads.city,
        state: prospectLeads.state,
        industrySegment: prospectLeads.industrySegment,
        leadQuality: prospectLeads.leadQuality,
        leadScore: prospectLeads.leadScore,
        compositeScore: prospectLeads.compositeScore,
        status: prospectLeads.status,
        primaryEmail: prospectLeads.primaryEmail,
        primaryMobile: prospectLeads.primaryMobile,
        website: prospectLeads.website,
        annualRevenue: prospectLeads.annualRevenue,
        employeeCount: prospectLeads.employeeCount,
        lastContactedAt: prospectLeads.lastContactedAt,
        nextFollowUpAt: prospectLeads.nextFollowUpAt,
        notes: prospectLeads.notes,
        source: prospectLeads.source,
        enrichmentData: prospectLeads.enrichmentData,
        createdAt: prospectLeads.createdAt,
      })
      .from(prospectLeads)
      .where(and(...conditions))
      .orderBy(
        sql`CASE lead_quality WHEN 'hot' THEN 1 WHEN 'warm' THEN 2 ELSE 3 END`,
        desc(prospectLeads.leadScore),
        desc(prospectLeads.createdAt),
      )
      .limit(limitNum)
      .offset(offset);

    const [totalRow] = await db
      .select({ total: count() })
      .from(prospectLeads)
      .where(and(...conditions));

    res.json({
      success: true,
      data: leads,
      meta: {
        ...META,
        timestamp: META.timestamp(),
        version: META.version,
        page: pageNum,
        limit: limitNum,
        total: Number(totalRow?.total ?? 0),
        pages: Math.ceil(Number(totalRow?.total ?? 0) / limitNum),
      },
    });
  } catch (err: any) {
    logger.error("[LeadInbox]", { event: "LEAD_INBOX_ERROR", user_id: req.user?.id, error: err.message, status: "error" });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

// ── GET /api/agent/lead-inbox/stats ──────────────────────────────────────────

/**
 * Returns agent's daily quota progress and pipeline health metrics.
 */
router.get("/stats", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId: string = req.user.id;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Total leads assigned
    const [totalLeads] = await db
      .select({ total: count() })
      .from(prospectLeads)
      .where(eq(prospectLeads.assignedTo, agentId));

    // By quality
    const qualityBreakdown = await db
      .select({
        quality: prospectLeads.leadQuality,
        cnt: count(),
      })
      .from(prospectLeads)
      .where(
        and(
          eq(prospectLeads.assignedTo, agentId),
          sql`${prospectLeads.status} NOT IN ('converted', 'rejected')`,
        ),
      )
      .groupBy(prospectLeads.leadQuality);

    const hot = qualityBreakdown.find((q) => q.quality === "hot")?.cnt ?? 0;
    const warm = qualityBreakdown.find((q) => q.quality === "warm")?.cnt ?? 0;
    const cold = qualityBreakdown.find((q) => q.quality === "cold")?.cnt ?? 0;

    // By status
    const statusBreakdown = await db
      .select({
        status: prospectLeads.status,
        cnt: count(),
      })
      .from(prospectLeads)
      .where(eq(prospectLeads.assignedTo, agentId))
      .groupBy(prospectLeads.status);

    const converted = statusBreakdown.find((s) => s.status === "converted")?.cnt ?? 0;
    const contacted = statusBreakdown.find((s) => s.status === "contacted")?.cnt ?? 0;
    const newLeads = statusBreakdown.find((s) => s.status === "new")?.cnt ?? 0;

    // Today's activity count
    const [todayActivity] = await db
      .select({ cnt: count() })
      .from(leadActivities)
      .where(
        and(
          eq(leadActivities.performedBy, agentId),
          sql`${leadActivities.createdAt} >= ${todayStart}`,
        ),
      );

    // Stale leads count
    const stale = await getAgentStaleSummary(agentId);

    res.json({
      success: true,
      data: {
        quota: {
          daily: DEFAULT_DAILY_QUOTA,
          openLeads: Number(hot) + Number(warm) + Number(cold),
          remaining: Math.max(0, DEFAULT_DAILY_QUOTA - Number(hot) - Number(warm) - Number(cold)),
        },
        pipeline: {
          total: Number(totalLeads?.total ?? 0),
          hot: Number(hot),
          warm: Number(warm),
          cold: Number(cold),
          new: Number(newLeads),
          contacted: Number(contacted),
          converted: Number(converted),
        },
        today: {
          actions_taken: Number(todayActivity?.cnt ?? 0),
        },
        alerts: {
          stale_leads: stale.length,
          stale_hot: stale.filter((s) => s.staleness === "stale_hot").length,
        },
      },
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (err: any) {
    logger.error("[LeadInbox]", { event: "LEAD_INBOX_STATS_ERROR", user_id: req.user?.id, error: err.message, status: "error" });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

// ── GET /api/agent/lead-inbox/stale ──────────────────────────────────────────

/**
 * Returns leads with no activity beyond stale thresholds.
 * Sorted by urgency: stale_hot first.
 */
router.get("/stale", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId: string = req.user.id;
    const stale = await getAgentStaleSummary(agentId);

    // Sort: stale_hot first, then by days_since_contact DESC
    const sorted = stale.sort((a, b) => {
      const orderMap: Record<string, number> = { stale_hot: 0, stale_warm: 1, stale_cold: 2 };
      const diff = (orderMap[a.staleness] ?? 3) - (orderMap[b.staleness] ?? 3);
      if (diff !== 0) return diff;
      return b.daysSinceContact - a.daysSinceContact;
    });

    res.json({
      success: true,
      data: sorted,
      meta: { timestamp: META.timestamp(), version: META.version, total: sorted.length },
    });
  } catch (err: any) {
    logger.error("[LeadInbox]", { event: "LEAD_STALE_ERROR", user_id: req.user?.id, error: err.message, status: "error" });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

// ── POST /api/agent/lead-inbox/:id/action ────────────────────────────────────

/**
 * Log a contact attempt or outcome on a lead.
 * Updates lastContactedAt, status, and nextFollowUpAt accordingly.
 * If convertedToClient=true, transitions lead status to 'converted'.
 */
router.post("/:id/action", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId: string = req.user.id;
    const { id: leadId } = req.params;

    const parsed = actionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        data: { errors: parsed.error.flatten() },
        meta: { timestamp: META.timestamp(), version: META.version },
      });
    }

    const { activityType, outcome, notes, nextFollowUpDays, convertedToClient } = parsed.data;

    // Verify ownership
    const [lead] = await db
      .select({ id: prospectLeads.id, assignedTo: prospectLeads.assignedTo })
      .from(prospectLeads)
      .where(and(eq(prospectLeads.id, leadId), eq(prospectLeads.assignedTo, agentId)));

    if (!lead) {
      return res.status(404).json({ success: false, data: { error: "Lead not found or not assigned to you" }, meta: { timestamp: META.timestamp(), version: META.version } });
    }

    const now = new Date();
    const nextFollowUp = nextFollowUpDays
      ? new Date(Date.now() + nextFollowUpDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Update lead fields
    const updateData: Record<string, any> = {
      lastContactedAt: now,
      updatedAt: now,
      status: "contacted",
    };
    if (nextFollowUp) updateData.nextFollowUpAt = nextFollowUp;
    if (convertedToClient) {
      updateData.status = "converted";
      updateData.convertedAt = now;
      updateData.convertedToUserId = agentId;
    }

    await db.update(prospectLeads).set(updateData).where(eq(prospectLeads.id, leadId));

    // Insert activity
    const [activity] = await db
      .insert(leadActivities)
      .values({
        leadId,
        activityType,
        subject: `${activityType.charAt(0).toUpperCase() + activityType.slice(1)} logged`,
        description: notes ?? `${activityType} activity recorded`,
        outcome: outcome ?? "successful",
        nextActionDate: nextFollowUp,
        performedBy: agentId,
        metadata: { convertedToClient, nextFollowUpDays },
      } as any)
      .returning();

    logger.info("[LeadInbox]", {
      event: "LEAD_ACTION_LOGGED",
      user_id: agentId,
      lead_id: leadId,
      activity_type: activityType,
      outcome,
      status: "success",
    });

    res.json({
      success: true,
      data: { activity, leadStatus: updateData.status },
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (err: any) {
    logger.error("[LeadInbox]", { event: "LEAD_ACTION_ERROR", user_id: req.user?.id, error: err.message, status: "error" });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

export { router as agentLeadInboxRouter };
