/**
 * Truecaller Business Routes
 *
 * Purpose : Exposes the pre-call setup endpoint that agents (via the FintekPro
 *           UI) call before placing an outbound call to a prospect. This endpoint
 *           fires the Truecaller Call Personalization API so the prospect sees
 *           FintekPro's verified brand + call reason when their phone rings.
 *
 * Endpoints:
 *   POST /api/calling/pre-call-setup          — Set call personalization before dialing
 *   POST /api/calling/register-agent-number   — Register an agent's number as verified
 *   GET  /api/calling/truecaller-status       — Check Truecaller integration health
 *
 * GCR compliance:
 *   - Authentication: all routes require a logged-in agent/admin session.
 *   - Truecaller failure is NON-BLOCKING — call proceeds regardless.
 *   - Structured logs on every request.
 *   - API response schema via apiResponse utility.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { apiResponse } from "../utils/responses";
import { truecallerBusinessAdapter } from "../services/vendor-adapters/truecaller-business.adapter";
import { requireAuth } from "../middleware/roleMiddleware";

const router = Router();

// ── Pre-call setup ────────────────────────────────────────────────────────────

/**
 * POST /api/calling/pre-call-setup
 *
 * Called by the FintekPro UI immediately BEFORE an agent places an outbound
 * call to a prospect. Sets Truecaller call personalization so the prospect
 * sees FintekPro branding + call reason when their phone rings.
 *
 * If Truecaller is not configured or returns an error, the endpoint still
 * returns 200 with { truecaller_verified: false } — the call proceeds normally.
 *
 * Body:
 *   callerNumber  — Agent's outbound number (E.164 e.g. +919876543210)
 *   calleeNumber  — Prospect's phone number (E.164)
 *   callReason    — Optional override (default: "Investment Advisory Call")
 *   fintekCallId  — Optional call ID from your telephony system (Exotel/Ozonetel)
 *   leadId        — Optional lead ID for logging
 */
router.post(
  "/pre-call-setup",
  requireAuth,
  async (req: any, res: Response) => {
    const startMs = Date.now();
    const { callerNumber, calleeNumber, callReason, fintekCallId, leadId } =
      req.body;

    if (!callerNumber || !calleeNumber) {
      return apiResponse.badRequest(
        res,
        "callerNumber and calleeNumber are required",
      );
    }

    const agentId = req.user?.id;

    // Fetch agent's display name for Truecaller
    let agentName: string | undefined;
    try {
      const [agent] = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, agentId))
        .limit(1);
      if (agent) {
        agentName = [agent.firstName, agent.lastName].filter(Boolean).join(" ") || undefined;
      }
    } catch {
      // Non-fatal — Truecaller will use brand name as fallback
    }

    const truecallerResult =
      await truecallerBusinessAdapter.setCallPersonalization({
        callerNumber,
        calleeNumber,
        callReason: callReason ?? "Investment Advisory Call",
        agentName,
        fintekCallId,
      });

    logger.info("PRE_CALL_SETUP_COMPLETE", {
      event: "PRE_CALL_SETUP_COMPLETE",
      agent_id: agentId,
      agent_name: agentName,
      lead_id: leadId,
      call_id: fintekCallId,
      truecaller_verified: truecallerResult.success,
      call_reason: truecallerResult.callReason,
      latency_ms: Date.now() - startMs,
      status: "success",
    });

    return apiResponse.success(res, {
      truecaller_verified: truecallerResult.success,
      truecaller_record_id: truecallerResult.truecallerRecordId,
      call_reason: truecallerResult.callReason,
      caller_number: callerNumber,
      callee_number: calleeNumber,
      brand_name: "FintekPro",
      // Always tell the UI to proceed — Truecaller is enhancement only
      proceed_with_call: true,
    });
  },
);

// ── Register agent number ─────────────────────────────────────────────────────

/**
 * POST /api/calling/register-agent-number
 * Admin-only. Registers an agent's phone number as a verified FintekPro
 * business number in Truecaller's system.
 *
 * Body:
 *   agentId      — User ID of the agent
 *   phoneNumber  — Agent's outbound calling number (E.164)
 *   featureSetId — Truecaller feature set ID (from Business Console)
 */
router.post(
  "/register-agent-number",
  requireAuth,
  async (req: any, res: Response) => {
    const { agentId, phoneNumber, featureSetId } = req.body;

    if (!agentId || !phoneNumber || !featureSetId) {
      return apiResponse.badRequest(
        res,
        "agentId, phoneNumber, featureSetId are required",
      );
    }

    const result = await truecallerBusinessAdapter.registerBusinessNumber(
      phoneNumber,
      featureSetId,
    );

    if (result.success) {
      // Mark agent as Truecaller-registered in DB
      // truecaller_registered column is added by Phase I schema migration
      try {
        await db
          .update(users)
          .set({ truecallerRegistered: true, updatedAt: new Date() })
          .where(eq(users.id, agentId));
      } catch (err: any) {
        // Column may not exist yet if migration hasn't run — non-fatal
        logger.warn("TRUECALLER_DB_FLAG_SKIPPED", {
          event: "TRUECALLER_DB_FLAG_SKIPPED",
          reason: err?.message?.slice(0, 80),
          status: "warn",
        });
      }
    }

    return apiResponse.success(res, result);
  },
);

// ── Status check ──────────────────────────────────────────────────────────────

/**
 * GET /api/calling/truecaller-status
 * Returns Truecaller integration configuration status.
 */
router.get("/truecaller-status", requireAuth, async (_req: Request, res: Response) => {
  return apiResponse.success(res, {
    configured: truecallerBusinessAdapter.available,
    features: {
      verified_caller_id: truecallerBusinessAdapter.available,
      call_reason: truecallerBusinessAdapter.available,
      video_caller_id: false,
    },
    brand_name: "FintekPro",
    default_call_reason: "Investment Advisory Call",
  });
});

export function registerTruecallerBusinessRoutes(app: any) {
  app.use("/api/calling", router);
}
