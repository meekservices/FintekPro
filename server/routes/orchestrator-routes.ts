/**
 * Orchestrator Routes
 *
 * POST /api/orchestrator/diff    — Compute vault-vs-broker field diff
 * POST /api/orchestrator/submit  — Submit KYC to broker with guardrails
 * GET  /api/orchestrator/status/:brokerId/:brokerClientId — Poll broker status
 *
 * All routes require authentication (req.user must exist).
 * /submit additionally requires a valid investorAuthorizationEventId —
 * agents can prepare/diff freely, but CANNOT fire a broker-facing submission
 * without the investor's own OTP-confirmed authorization event.
 *
 * Input validation with Zod before any business logic.
 * Response shape: { success, data, meta: { timestamp, version } }
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { kycBrokerOrchestrator } from "../services/kyc-broker-orchestrator";
import { alpacaAdapter } from "../services/adapters/alpaca-adapter";
import { iiflAdapter } from "../services/adapters/iifl-adapter";
import { jmFinancialAdapter } from "../services/adapters/jm-financial-adapter";
import { logger } from "../logger";

export const orchestratorRouter = Router();

const VALID_BROKERS = ["iifl", "jm_financial", "alpaca"] as const;

// ── Auth guard — all orchestrator routes require a logged-in user ─────────────
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user?.id) {
    return res.status(401).json({
      success: false,
      error: { error_code: "UNAUTHORIZED", message: "Authentication required", retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
  return next();
}

const diffRequestSchema = z.object({
  userId:   z.string().min(1),
  brokerId: z.enum(VALID_BROKERS),
  segment:  z.string().min(1),
});

const submitRequestSchema = z.object({
  userId:                        z.string().min(1),
  brokerId:                      z.enum(VALID_BROKERS),
  segment:                       z.string().min(1),
  brokerDelta:                   z.record(z.string(), z.unknown()).default({}),
  /**
   * investorAuthorizationEventId — required when the caller is an agent/partner
   * acting on behalf of a user. The value is produced by
   * POST /api/kyc/investor-authorize after the investor completes their OTP.
   *
   * If the caller IS the investor (req.user.id === userId and no actingAs),
   * this may be omitted — the caller's own session constitutes authorization.
   *
   * This enforces the SEBI requirement: agents can prepare, investors must authorize.
   */
  investorAuthorizationEventId:  z.string().optional(),
});

/**
 * POST /api/orchestrator/diff
 *
 * Compute the diff between a user's vault profile and broker requirements.
 * Returns prefilled fields, required delta fields, stale fields, and a
 * delta_form_spec for the frontend to render.
 *
 * Body: { userId, brokerId, segment }
 * Response: BrokerDiffResult with engine_version + calculationTimestamp
 */
orchestratorRouter.post("/diff", requireAuth, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const callerUser = (req as any).user;
  const actingAs = (req as any).actingAs; // set by acting-as-context middleware if agent

  const parse = diffRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { userId, brokerId, segment } = parse.data;
  const ipAddress = req.ip ?? req.socket.remoteAddress;

  try {
    const result = await kycBrokerOrchestrator.diff({
      userId,
      brokerId,
      segment,
      ipAddress,
    });

    logger.info("ORCHESTRATOR_DIFF_API", {
      event: "ORCHESTRATOR_DIFF",
      user_id: userId,
      caller_id: callerUser.id,
      acting_as: actingAs ? { agent_id: actingAs.agentId, scope: actingAs.scope } : null,
      broker_id: brokerId,
      segment,
      prefilled_count: result.prefilledFields?.length ?? 0,
      delta_count: result.requiredDeltaFields?.length ?? 0,
      stale_count: result.staleFields?.length ?? 0,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return res.json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  } catch (error: any) {
    logger.error("ORCHESTRATOR_DIFF_ERROR", {
      event: "ORCHESTRATOR_DIFF_ERROR",
      user_id: userId,
      broker_id: brokerId,
      message: error.message,
      error_code: error.error_code,
      latency_ms: Date.now() - startTs,
      status: "error",
    });
    return res.status(500).json({
      success: false,
      error: {
        error_code: error.error_code ?? "INTERNAL_ERROR",
        message: error.message,
        retryable: !!error.retryable,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

/**
 * POST /api/orchestrator/submit
 *
 * Submit KYC to a broker. Enforces:
 *  1. Authentication (requireAuth guard above)
 *  2. Investor authorization — if caller is an agent (actingAs set), body MUST
 *     include a valid investorAuthorizationEventId from the investor's OTP confirmation.
 *  3. Consent written before any broker call (enforced inside kycBrokerOrchestrator)
 *  4. Idempotency key checked before any outbound HTTP (enforced in each adapter)
 *
 * Body: { userId, brokerId, segment, brokerDelta, investorAuthorizationEventId? }
 * Response: { brokerClientId, status, cached }
 */
orchestratorRouter.post("/submit", requireAuth, async (req: Request, res: Response) => {
  const startTs = Date.now();
  const callerUser = (req as any).user;
  const actingAs = (req as any).actingAs;

  const parse = submitRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { userId, brokerId, segment, brokerDelta, investorAuthorizationEventId } = parse.data;
  const ipAddress = req.ip ?? req.socket.remoteAddress;

  // ── SEBI agent-authorization guard ───────────────────────────────────────────
  // If an agent is acting on behalf of an investor, the investor MUST have
  // separately authorized this action via their own OTP before the broker call fires.
  const isAgentActingOnBehalfOf = actingAs && actingAs.onBehalfOfUserId === userId;
  const callerIsInvestor = callerUser.id === userId;

  if (isAgentActingOnBehalfOf && !investorAuthorizationEventId) {
    logger.warn("ORCHESTRATOR_SUBMIT_BLOCKED_NO_INVESTOR_AUTH", {
      event: "ORCHESTRATOR_SUBMIT_BLOCKED",
      agent_id: callerUser.id,
      user_id: userId,
      broker_id: brokerId,
      reason: "agent_submit_requires_investor_authorization_event",
      latency_ms: Date.now() - startTs,
      status: "blocked",
    });
    return res.status(403).json({
      success: false,
      error: {
        error_code: "INVESTOR_AUTHORIZATION_REQUIRED",
        message: "An agent cannot submit KYC on behalf of an investor without a valid investorAuthorizationEventId. The investor must complete their OTP confirmation first.",
        retryable: false,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  try {
    const result = await kycBrokerOrchestrator.submit({
      userId,
      brokerId,
      segment,
      brokerDelta,
      ipAddress,
      actorId: callerUser.id,
      investorAuthorizationEventId,
    });

    logger.info("ORCHESTRATOR_SUBMIT_API", {
      event: "ORCHESTRATOR_SUBMIT",
      user_id: userId,
      caller_id: callerUser.id,
      acting_as: actingAs ? { agent_id: actingAs.agentId } : null,
      broker_id: brokerId,
      broker_client_id: result.brokerClientId,
      cached: result.cached,
      investor_auth_event_id: investorAuthorizationEventId ?? null,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return res.json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  } catch (error: any) {
    logger.error("ORCHESTRATOR_SUBMIT_ERROR", {
      event: "ORCHESTRATOR_SUBMIT_ERROR",
      user_id: userId,
      broker_id: brokerId,
      message: error.message,
      error_code: error.error_code,
      latency_ms: Date.now() - startTs,
      status: "error",
    });
    const statusCode = error.retryable === false ? 400 : 500;
    return res.status(statusCode).json({
      success: false,
      error: {
        error_code: error.error_code ?? "SUBMISSION_FAILED",
        message: error.message,
        retryable: !!error.retryable,
      },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

/**
 * GET /api/orchestrator/status/:brokerId/:brokerClientId
 *
 * Poll the broker for current KYC submission status.
 *
 * Params: brokerId, brokerClientId
 * Response: { status, details, lastUpdatedAt }
 */
orchestratorRouter.get(
  "/status/:brokerId/:brokerClientId",
  requireAuth,
  async (req: Request, res: Response) => {
    const startTs = Date.now();
    const { brokerId, brokerClientId } = req.params;

    if (!VALID_BROKERS.includes(brokerId as (typeof VALID_BROKERS)[number])) {
      return res.status(400).json({
        success: false,
        error: { error_code: "INVALID_BROKER", message: `Unknown broker: ${brokerId}`, retryable: false },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }

    const adapters: Record<string, { getStatus: (id: string) => Promise<unknown> }> = {
      iifl:         iiflAdapter,
      jm_financial: jmFinancialAdapter,
      alpaca:       alpacaAdapter,
    };

    try {
      const statusResult = await adapters[brokerId].getStatus(brokerClientId);

      logger.info("ORCHESTRATOR_STATUS_API", {
        event: "ORCHESTRATOR_STATUS",
        broker_id: brokerId,
        broker_client_id: brokerClientId,
        latency_ms: Date.now() - startTs,
        status: "success",
      });

      return res.json({
        success: true,
        data: statusResult,
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: {
          error_code: error.error_code ?? "STATUS_CHECK_FAILED",
          message: error.message,
          retryable: !!error.retryable,
        },
        meta: { timestamp: new Date().toISOString(), version: "1.0" },
      });
    }
  }
);

