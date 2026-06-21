/**
 * Orchestrator Routes
 *
 * POST /api/orchestrator/diff    — Compute vault-vs-broker field diff
 * POST /api/orchestrator/submit  — Submit KYC to broker with guardrails
 * GET  /api/orchestrator/status/:brokerId/:brokerClientId — Poll broker status
 *
 * All routes require authentication (req.user must exist).
 * Input validation with Zod before any business logic.
 * Response shape: { success, data, meta: { timestamp, version } }
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { kycBrokerOrchestrator } from "../services/kyc-broker-orchestrator";
import { alpacaAdapter } from "../services/adapters/alpaca-adapter";
import { iiflAdapter } from "../services/adapters/iifl-adapter";
import { jmFinancialAdapter } from "../services/adapters/jm-financial-adapter";
import { logger } from "../logger";

export const orchestratorRouter = Router();

const VALID_BROKERS = ["iifl", "jm_financial", "alpaca"] as const;

const diffRequestSchema = z.object({
  userId:   z.string().min(1),
  brokerId: z.enum(VALID_BROKERS),
  segment:  z.string().min(1),
});

const submitRequestSchema = z.object({
  userId:      z.string().min(1),
  brokerId:    z.enum(VALID_BROKERS),
  segment:     z.string().min(1),
  brokerDelta: z.record(z.string(), z.unknown()).default({}),
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
orchestratorRouter.post("/diff", async (req: Request, res: Response) => {
  const startTs = Date.now();

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
      user_id: userId,
      broker_id: brokerId,
      segment,
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
 * Submit KYC to a broker. Consent and idempotency are enforced internally.
 *
 * Body: { userId, brokerId, segment, brokerDelta }
 * Response: { brokerClientId, status, cached }
 */
orchestratorRouter.post("/submit", async (req: Request, res: Response) => {
  const startTs = Date.now();

  const parse = submitRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({
      success: false,
      error: { error_code: "VALIDATION_ERROR", message: parse.error.flatten(), retryable: false },
      meta: { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  const { userId, brokerId, segment, brokerDelta } = parse.data;
  const ipAddress = req.ip ?? req.socket.remoteAddress;

  try {
    const result = await kycBrokerOrchestrator.submit({
      userId,
      brokerId,
      segment,
      brokerDelta,
      ipAddress,
    });

    logger.info("ORCHESTRATOR_SUBMIT_API", {
      user_id: userId,
      broker_id: brokerId,
      broker_client_id: result.brokerClientId,
      cached: result.cached,
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
