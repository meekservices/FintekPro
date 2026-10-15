/**
 * Exotel Cloud Telephony & Auto-Dialer Routes v1.0
 *
 * Implements endpoints for Click-to-Call, Progressive Queue, Call Dispositions,
 * and Exotel StatusCallback Webhooks.
 *
 * Architecture: /routes layer - all business logic delegated to /services.
 * Response Contract: { success, data, meta: { timestamp, version } }
 * Pagination: page, limit, total
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAgent } from "../middleware/roleMiddleware";
import { exotelDialerService } from "../services/exotel-dialer-service";
import { db } from "../db";
import { outboundCallLogs } from "@shared/schema";
import { eq, desc, sql, count } from "drizzle-orm";
import { logger } from "../logger";

const router = Router();
const META = { timestamp: () => new Date().toISOString(), version: "1.0" };

// ── Input Schemas ─────────────────────────────────────────────────────────────

const initiateCallSchema = z.object({
  prospectLeadId: z.string().optional(),
  prospectClientId: z.string().optional(),
  prospectName: z.string().min(1, "Prospect name is required"),
  prospectPhone: z.string().min(10, "Valid phone number is required"),
  agentPhone: z.string().optional(),
  dialerMode: z.enum(["click_to_call", "progressive_queue", "campaign", "native_sim"]).default("native_sim"),
  overrideCallingHours: z.boolean().optional(),
});

const dispositionSchema = z.object({
  callLogId: z.string().min(1, "Call log ID is required"),
  disposition: z.enum([
    "interested",
    "callback_requested",
    "not_interested",
    "wrong_number",
    "dnd",
    "meeting_fixed",
    "converted",
    "unreachable",
  ]),
  notes: z.string().optional(),
  followUpDate: z.string().optional(),
  leadStage: z.string().optional(),
  duration: z.number().int().optional(),
});

// ── 1. POST /api/dialer/call - Initiate Click-to-Call ─────────────────────────

router.post("/call", requireAgent, async (req: any, res: Response) => {
  const startTime = Date.now();
  try {
    const agent = req.user;
    const body = initiateCallSchema.parse(req.body);

    // Agent's registered phone number fallback
    const agentPhone = body.agentPhone || agent.mobile || agent.phone || "9876543210";

    const result = await exotelDialerService.initiateCall({
      agentId: agent.id,
      agentPhone,
      prospectLeadId: body.prospectLeadId,
      prospectClientId: body.prospectClientId,
      prospectName: body.prospectName,
      prospectPhone: body.prospectPhone,
      dialerMode: body.dialerMode,
      overrideCallingHours: body.overrideCallingHours,
    });

    return res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        timestamp: META.timestamp(),
        version: META.version,
        latency_ms: Date.now() - startTime,
        simulationMode: result.simulationMode,
      },
    });
  } catch (error: any) {
    logger.error("[ExotelDialerRoutes]", {
      event: "INITIATE_CALL_ERROR",
      user_id: req.user?.id,
      error_code: "CALL_ERROR",
      message: error.message,
      retryable: false,
    });

    return res.status(400).json({
      success: false,
      error_code: "DIALER_ERROR",
      message: error.message || "Failed to initiate call",
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  }
});

// ── 2. POST /api/dialer/webhook/exotel - Exotel Status Callback ───────────────

router.post("/webhook/exotel", async (req: Request, res: Response) => {
  try {
    // Exotel sends URL-encoded form data or JSON
    const payload = req.body || {};
    const result = await exotelDialerService.handleExotelWebhook(payload);

    return res.status(200).json({
      success: true,
      data: result,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (error: any) {
    logger.error("[ExotelDialerWebhook]", {
      event: "WEBHOOK_PROCESSING_FAILED",
      message: error.message,
      retryable: true,
    });
    // Return 200 to prevent Exotel webhook retry storms
    return res.status(200).json({ success: false, error: error.message });
  }
});

// ── 3. GET /api/dialer/queue - Progressive Calling Queue ──────────────────────

router.get("/queue", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId = req.user.id;
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    const queue = await exotelDialerService.getProgressiveQueue(agentId, limit);

    return res.json({
      success: true,
      data: queue,
      total: queue.length,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error_code: "QUEUE_FETCH_ERROR",
      message: error.message,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  }
});

// ── 4. POST /api/dialer/disposition - Save Call Outcome & Notes ───────────────

router.post("/disposition", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId = req.user.id;
    const body = dispositionSchema.parse(req.body);

    const result = await exotelDialerService.saveCallDisposition({
      callLogId: body.callLogId,
      agentId,
      disposition: body.disposition,
      notes: body.notes,
      followUpDate: body.followUpDate,
      leadStage: body.leadStage,
      duration: body.duration,
    });

    return res.json({
      success: true,
      data: result.data,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error_code: "DISPOSITION_SAVE_ERROR",
      message: error.message,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  }
});

// ── 5. GET /api/dialer/history - Call Logs History ────────────────────────────

router.get("/history", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId = req.user.id;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Number(req.query.limit) || 15, 50);
    const offset = (page - 1) * limit;

    const [totalRecord] = await db
      .select({ count: count() })
      .from(outboundCallLogs)
      .where(eq(outboundCallLogs.agentId, agentId));

    const total = Number(totalRecord?.count || 0);

    const history = await db
      .select()
      .from(outboundCallLogs)
      .where(eq(outboundCallLogs.agentId, agentId))
      .orderBy(desc(outboundCallLogs.createdAt))
      .limit(limit)
      .offset(offset);

    return res.json({
      success: true,
      data: history,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error_code: "HISTORY_FETCH_ERROR",
      message: error.message,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  }
});

// ── 6. GET /api/dialer/stats - Today's Calling Metrics ────────────────────────

router.get("/stats", requireAgent, async (req: any, res: Response) => {
  try {
    const agentId = req.user.id;
    const stats = await exotelDialerService.getAdvisorCallStats(agentId);

    return res.json({
      success: true,
      data: stats,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error_code: "STATS_FETCH_ERROR",
      message: error.message,
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  }
});

export const dialerRouter = router;
