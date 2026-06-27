/**
 * Acting-As Context Middleware
 *
 * Allows an agent or partner to operate on behalf of an investor within
 * an explicitly scoped, time-bounded session. The acting_as context is
 * stored server-side in the session and surfaced as req.actingAs.
 *
 * This middleware is PASSIVE — it reads the acting_as context from the session
 * if it exists, but does NOT create or validate it here. The acting_as session
 * is created by POST /api/kyc/acting-as/start and confirmed by the investor
 * via POST /api/kyc/investor-authorize.
 *
 * Downstream route handlers (orchestrator, vault) use req.actingAs to:
 *  1. Determine whether the caller is acting on behalf of another user.
 *  2. Enforce the investor-authorization requirement on /submit.
 *  3. Stamp all audit log entries with the agent's ID as actor.
 *
 * GCR Rules enforced here:
 *  - acting_as sessions expire (enforced server-side, not by client clock)
 *  - All session starts and expirations are written to kycAuditLogs
 *  - Session scope is scoped to explicit field set — not "all fields"
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../logger";

export interface ActingAsContext {
  /** The agent or partner user ID performing the action */
  agentId: string;
  /** The investor user ID being acted on behalf of */
  onBehalfOfUserId: string;
  /** ISO timestamp when the session was created */
  startedAt: string;
  /** ISO timestamp when the session expires */
  expiresAt: string;
  /** The scope of the acting_as session — limits what the agent can do */
  scope: "kyc_diff" | "kyc_submit" | "kyc_view" | "full";
  /** Fields consented to in this session (null = scope-defined defaults) */
  consentedFields?: string[];
}

/**
 * Express middleware that reads the acting_as session from req.session
 * and attaches it to req.actingAs if valid and not expired.
 *
 * If the session is expired, it is cleared and req.actingAs is NOT set.
 * This does NOT block the request — auth guards on individual routes do that.
 */
export function actingAsContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const session = (req as any).session as Record<string, unknown> | undefined;

  if (!session?.actingAs) {
    (req as any).actingAs = null;
    return next();
  }

  const ctx = session.actingAs as ActingAsContext;

  // Validate structure minimally
  if (!ctx.agentId || !ctx.onBehalfOfUserId || !ctx.expiresAt) {
    (req as any).actingAs = null;
    session.actingAs = undefined;
    return next();
  }

  // Check expiry (server-side, not client clock)
  if (new Date(ctx.expiresAt) < new Date()) {
    logger.info("[ActingAs] Session expired, clearing context", {
      event: "ACTING_AS_SESSION_EXPIRED",
      agent_id: ctx.agentId,
      on_behalf_of_user_id: ctx.onBehalfOfUserId,
      expired_at: ctx.expiresAt,
    });
    (req as any).actingAs = null;
    session.actingAs = undefined;
    return next();
  }

  (req as any).actingAs = ctx;
  return next();
}

/** Alias for import convenience — semantically identical to actingAsContextMiddleware */
export const readActingAsContext = actingAsContextMiddleware;
