/**
 * Investor Authorization + Acting-As Session Routes
 *
 * POST /api/kyc/acting-as/start       — Agent starts an acting-as session
 * POST /api/kyc/acting-as/end         — Agent ends acting-as session
 * GET  /api/kyc/acting-as/status      — Current acting-as context for caller
 * POST /api/kyc/investor-authorize/request  — Agent requests investor OTP
 * POST /api/kyc/investor-authorize/confirm  — Investor confirms OTP
 *
 * These routes implement the SEBI-required prepared-vs-authorized split:
 * agents can prepare and diff, but broker-facing submissions require the
 * investor's explicit out-of-band OTP confirmation.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { logger } from "../logger";
import { createAuthorizationRequest, confirmAuthorization } from "../services/investor-authorization-service";
import type { ActingAsContext } from "../middleware/acting-as-context";
import { db } from "../db";
import { kycVault } from "@shared/schema";
import { eq } from "drizzle-orm";

export const investorAuthRouter = Router();

function requireAuth(req: Request, res: Response, next: Function) {
  if (!(req as any).user?.id) {
    return res.status(401).json({
      success: false,
      error: { error_code: "UNAUTHORIZED", message: "Authentication required", retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
  return next();
}

// ── Acting-As Session Management ─────────────────────────────────────────────

const startActingAsSchema = z.object({
  onBehalfOfUserId: z.string().min(1),
  scope: z.enum(["kyc_diff", "kyc_submit", "kyc_view", "full"]),
  /** Session duration in minutes (max 60) */
  durationMinutes: z.number().min(5).max(60).default(30),
  consentedFields: z.array(z.string()).optional(),
});

/**
 * POST /api/kyc/acting-as/start
 *
 * Agent starts a delegated session on behalf of an investor.
 * The agent must be in the AGENT or PARTNER role.
 * No broker submissions can be made until the investor authorizes via OTP.
 */
investorAuthRouter.post("/acting-as/start", requireAuth, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const callerUser = (req as any).user;
  const session = (req as any).session;

  const parse = startActingAsSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { onBehalfOfUserId, scope, durationMinutes, consentedFields } = parse.data;

  // Validate caller has agent/partner role (role is on req.user from auth setup)
  const callerRole = callerUser.role ?? callerUser.userType ?? "";
  if (!["agent", "partner", "admin"].includes(callerRole?.toLowerCase())) {
    return res.status(403).json({
      success: false,
      error: {
        error_code: "INSUFFICIENT_ROLE",
        message: "Only agents, partners, and admins can start acting-as sessions.",
        retryable: false,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const ctx: ActingAsContext = {
    agentId: callerUser.id,
    onBehalfOfUserId,
    startedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    scope,
    consentedFields,
  };

  // Store in session
  session.actingAs = ctx;

  logger.info("[ActingAs] Session started", {
    event: "ACTING_AS_SESSION_START",
    agent_id: callerUser.id,
    on_behalf_of_user_id: onBehalfOfUserId,
    scope,
    expires_at: expiresAt.toISOString(),
    latency_ms: Date.now() - startTs,
  });

  return res.json({
    success: true,
    data: {
      agentId: ctx.agentId,
      onBehalfOfUserId: ctx.onBehalfOfUserId,
      scope: ctx.scope,
      startedAt: ctx.startedAt,
      expiresAt: ctx.expiresAt,
    },
    meta: { timestamp: new Date().toISOString(), version: "1.0" },
  });
});

/**
 * POST /api/kyc/acting-as/end
 *
 * Explicitly end an acting-as session.
 */
investorAuthRouter.post("/acting-as/end", requireAuth, async (req: Request, res: Response) => {
  const callerUser = (req as any).user;
  const session = (req as any).session;
  const ctx = session?.actingAs as ActingAsContext | undefined;

  if (!ctx) {
    return res.json({
      success: true,
      message: "No active acting-as session to end.",
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  logger.info("[ActingAs] Session ended", {
    event: "ACTING_AS_SESSION_END",
    agent_id: callerUser.id,
    on_behalf_of_user_id: ctx.onBehalfOfUserId,
    scope: ctx.scope,
  });

  session.actingAs = undefined;

  return res.json({
    success: true,
    message: "Acting-as session ended.",
    meta: { timestamp: new Date().toISOString(), version: "1.0" },
  });
});

/**
 * GET /api/kyc/acting-as/status
 *
 * Returns current acting-as context for the authenticated caller.
 */
investorAuthRouter.get("/acting-as/status", requireAuth, (req: Request, res: Response) => {
  const actingAs = (req as any).actingAs as ActingAsContext | null;

  return res.json({
    success: true,
    data: {
      active: !!actingAs,
      context: actingAs
        ? {
            agentId: actingAs.agentId,
            onBehalfOfUserId: actingAs.onBehalfOfUserId,
            scope: actingAs.scope,
            startedAt: actingAs.startedAt,
            expiresAt: actingAs.expiresAt,
          }
        : null,
    },
    meta: { timestamp: new Date().toISOString(), version: "1.0" },
  });
});

// ── Investor Authorization Flow ───────────────────────────────────────────────

const authRequestSchema = z.object({
  investorUserId: z.string().min(1),
  scope: z.string().min(1),
});

/**
 * POST /api/kyc/investor-authorize/request
 *
 * Agent requests an OTP to be sent to the investor's registered mobile.
 * The mobile number is fetched from the investor's KYC vault — the agent
 * cannot supply or override it.
 */
investorAuthRouter.post(
  "/investor-authorize/request",
  requireAuth,
  async (req: Request, res: Response) => {
    const startTs = Date.now();
    const callerUser = (req as any).user;

    const parse = authRequestSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }

    const { investorUserId, scope } = parse.data;

    // Fetch investor's registered mobile from their KYC vault
    // (encrypted — we need the decryption service, but mobile is also on the user profile)
    // For now, fetch from the user table via session — in Phase 4 use kyc-vault-decryption-service
    let investorMobile: string | null = null;
    try {
      const { users } = await import("@shared/schema");
      const rows = await db.select({ mobile: (users as any).mobile }).from(users as any)
        .where(eq((users as any).id, investorUserId)).limit(1);
      investorMobile = rows[0]?.mobile ?? null;
    } catch (err: any) {
      logger.error("[InvestorAuth] Failed to fetch investor mobile", { user_id: investorUserId, message: err.message });
    }

    if (!investorMobile) {
      return res.status(400).json({
        success: false,
        error: {
          error_code: "INVESTOR_MOBILE_NOT_FOUND",
          message: "Could not find a registered mobile number for this investor. Ensure their profile is complete.",
          retryable: false,
        },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }

    try {
      const result = await createAuthorizationRequest(
        callerUser.id,
        investorUserId,
        scope,
        req.ip ?? "unknown",
        investorMobile,
      );

      return res.json({
        success: true,
        data: {
          requestId: result.requestId,
          otpSentTo: result.otpSentTo,
          message: "OTP sent to investor's registered mobile. The investor must call /investor-authorize/confirm to complete authorization.",
          expiresInMinutes: 15,
        },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: { error_code: error.error_code ?? "OTP_SEND_FAILED", message: error.message, retryable: !!error.retryable },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }
  },
);

const authConfirmSchema = z.object({
  requestId: z.string().min(1),
  otp: z.string().length(6),
});

/**
 * POST /api/kyc/investor-authorize/confirm
 *
 * Called by the INVESTOR (not the agent) to confirm their OTP.
 * Returns an investorAuthorizationEventId to be passed to /api/orchestrator/submit.
 *
 * The investor must be authenticated (their own session, not the agent's).
 */
investorAuthRouter.post(
  "/investor-authorize/confirm",
  requireAuth,
  async (req: Request, res: Response) => {
    const callerUser = (req as any).user;

    const parse = authConfirmSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }

    const { requestId, otp } = parse.data;

    try {
      const result = await confirmAuthorization(
        callerUser.id,
        requestId,
        otp,
        req.ip ?? "unknown",
      );

      return res.json({
        success: true,
        data: {
          investorAuthorizationEventId: result.investorAuthorizationEventId,
          scope: result.scope,
          message: "Authorization confirmed. Share the investorAuthorizationEventId with your advisor to proceed with KYC submission.",
          validForMinutes: 15,
        },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    } catch (error: any) {
      const statusCode = error.retryable === false ? 400 : 500;
      return res.status(statusCode).json({
        success: false,
        error: { error_code: error.error_code ?? "AUTH_CONFIRM_FAILED", message: error.message, retryable: !!error.retryable },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }
  },
);
