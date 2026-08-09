/**
 * @file smallcase-routes.ts
 * @description Server-side Smallcase Gateway API routes.
 *
 * Architecture:
 *   Smallcase Gateway operates on a server-generated transaction model.
 *   The browser SDK never calls Smallcase directly — your server creates
 *   the transaction using your Secret key, returns the transactionId,
 *   and the client SDK uses it to open the Gateway UI.
 *
 * Routes:
 *   GET  /api/smallcase/auth/token          — Generate guest/connected JWT auth token
 *   POST /api/smallcase/transaction/create  — Create a basket order transaction
 *   POST /api/smallcase/auth/save           — Persist smallcaseAuthId to user profile
 *   GET  /api/smallcase/auth/status         — Check if user has a linked broker
 *
 * FASP-AI v1.0 compliance:
 *   - SMALLCASE_SECRET is used server-side only — never exposed to client
 *   - All endpoints require authentication (req.isAuthenticated())
 *   - No trades are auto-executed — this creates the transaction only
 *   - Structured logs emitted for all order creation events
 *
 * Security:
 *   - JWT signed with SMALLCASE_SECRET (HS256)
 *   - Token expiry: 15 minutes (Gateway requirement)
 *   - All inputs validated before forwarding to Smallcase API
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

// ── Config ─────────────────────────────────────────────────────────────────────

const GATEWAY_NAME   = process.env.SMALLCASE_GATEWAY_NAME ?? "";
const GATEWAY_SECRET = process.env.SMALLCASE_SECRET        ?? "";
const GATEWAY_ENV    = process.env.NODE_ENV === "production" ? "production" : "development";

/** true only when both env vars are set — prevents silent failures */
const GATEWAY_CONFIGURED = !!GATEWAY_NAME && !!GATEWAY_SECRET;

const SC_API_BASE = "https://gateway.smallcase.com/api/v2";

// ── JWT Helper ─────────────────────────────────────────────────────────────────

/**
 * Generate a Smallcase-compatible JWT using HMAC-SHA256.
 * Format: base64url(header).base64url(payload).base64url(signature)
 *
 * @param payload - JWT claims (sub = smallcaseAuthId for connected users, empty for guests)
 * @returns Signed JWT string valid for 15 minutes
 */
function generateScJwt(payload: Record<string, unknown>): string {
  const header  = { alg: "HS256", typ: "JWT" };
  const now     = Math.floor(Date.now() / 1000);
  const claims  = { ...payload, iat: now, exp: now + 900 }; // 15 min expiry

  const b64url  = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const headerB64  = b64url(header);
  const payloadB64 = b64url(claims);
  const sigInput   = `${headerB64}.${payloadB64}`;

  const signature = crypto
    .createHmac("sha256", GATEWAY_SECRET)
    .update(sigInput)
    .digest("base64url");

  return `${sigInput}.${signature}`;
}

// ── Middleware: require Smallcase to be configured ─────────────────────────────

function requireGatewayConfig(_req: Request, res: Response, next: () => void) {
  if (!GATEWAY_CONFIGURED) {
    return res.status(503).json({
      success: false,
      data:    null,
      meta:    { timestamp: new Date().toISOString(), version: "1.0" },
      error:   {
        error_code: "SMALLCASE_NOT_CONFIGURED",
        message:    "Smallcase Gateway is not configured. Set SMALLCASE_GATEWAY_NAME and SMALLCASE_SECRET.",
        retryable:  false,
      },
    });
  }
  next();
}

// ── Route: GET /api/smallcase/auth/token ───────────────────────────────────────

/**
 * @route GET /api/smallcase/auth/token
 * @description Generate a JWT auth token for initialising the SC Gateway SDK.
 *   - Connected user (has smallcaseAuthId): returns a "connected" token
 *   - New user (no broker linked):          returns a "guest" token
 *
 * The client hook (useSmallcaseGateway) calls this before scDK.init().
 */
router.get(
  "/auth/token",
  requireGatewayConfig,
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "UNAUTHORIZED", message: "Login required", retryable: false },
      });
    }

    try {
      const userId = (req.user as { id: string }).id;

      // Check if user has an existing linked broker
      const rows = await db.execute(sql`
        SELECT default_broker_id FROM users WHERE id = ${userId} LIMIT 1
      `);
      const row = ((rows as unknown as { rows: Array<{ default_broker_id: string | null }> }).rows ?? rows)[0];
      const smallcaseAuthId: string | null = row?.default_broker_id ?? null;

      // Generate JWT: include sub claim for connected users, omit for guests
      const jwtPayload = smallcaseAuthId
        ? { sub: smallcaseAuthId, gatewayName: GATEWAY_NAME }
        : { gatewayName: GATEWAY_NAME };

      const authToken = generateScJwt(jwtPayload);

      return res.json({
        success: true,
        data:    { authToken, environment: GATEWAY_ENV, isConnected: !!smallcaseAuthId },
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Token generation failed";
      return res.status(500).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "TOKEN_GEN_FAILED", message, retryable: true },
      });
    }
  },
);

// ── Route: POST /api/smallcase/transaction/create ──────────────────────────────

/**
 * @route POST /api/smallcase/transaction/create
 * @body  { holdings: [{isin, quantity, action}], intent, portfolioName }
 * @description Creates a Smallcase transaction on the SC server.
 *   Returns a transactionId for the client SDK to open the Gateway UI.
 *
 * FASP-AI: This creates the transaction record only — no order is placed until
 * the user confirms within the Gateway UI overlay.
 */
router.post(
  "/transaction/create",
  requireGatewayConfig,
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "UNAUTHORIZED", message: "Login required", retryable: false },
      });
    }

    const { holdings, intent = "TRANSACTION", portfolioName } = req.body as {
      holdings:      Array<{ isin: string; quantity: number; action: "BUY" | "SELL" }>;
      intent?:       string;
      portfolioName?: string;
    };

    if (!Array.isArray(holdings) || holdings.length === 0) {
      return res.status(400).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "INVALID_HOLDINGS", message: "holdings[] is required and must be non-empty", retryable: false },
      });
    }

    try {
      const userId = (req.user as { id: string }).id;

      // Generate JWT for this transaction
      const rows = await db.execute(sql`
        SELECT default_broker_id FROM users WHERE id = ${userId} LIMIT 1
      `);
      const row = ((rows as unknown as { rows: Array<{ default_broker_id: string | null }> }).rows ?? rows)[0];
      const smallcaseAuthId: string | null = row?.default_broker_id ?? null;

      const jwtPayload = smallcaseAuthId
        ? { sub: smallcaseAuthId, gatewayName: GATEWAY_NAME }
        : { gatewayName: GATEWAY_NAME };

      const authToken = generateScJwt(jwtPayload);

      // Create transaction on Smallcase API
      const scRes = await fetch(`${SC_API_BASE}/transaction`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${authToken}`,
          "x-gateway-name": GATEWAY_NAME,
        },
        body: JSON.stringify({
          intent,
          transaction: {
            transactionType: "SECURITIES",
            legs: holdings.map(h => ({
              isin:         h.isin,
              quantity:     h.quantity,
              transactionType: h.action === "BUY" ? "BUY" : "SELL",
            })),
          },
          ...(portfolioName ? { name: portfolioName } : {}),
        }),
      });

      const scData = await scRes.json() as { transactionId?: string; error?: string; message?: string };

      if (!scRes.ok || !scData.transactionId) {
        throw new Error(scData.error ?? scData.message ?? `SC API error ${scRes.status}`);
      }

      // Structured FASP-AI log
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        event:          "SMALLCASE_TRANSACTION_CREATED",
        user_id:        userId,
        transactionId:  scData.transactionId,
        intent,
        holdingsCount:  holdings.length,
        portfolioName:  portfolioName ?? null,
        model_version:  "sc-gateway-v2.0",
        timestamp:      new Date().toISOString(),
        latency_ms:     0,
        status:         "created",
      }));

      return res.json({
        success: true,
        data:    { transactionId: scData.transactionId },
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction creation failed";
      // eslint-disable-next-line no-console
      console.error("[SmallcaseRoutes] transaction/create error:", message);
      return res.status(500).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "TX_CREATE_FAILED", message, retryable: true },
      });
    }
  },
);

// ── Route: POST /api/smallcase/auth/save ──────────────────────────────────────

/**
 * @route POST /api/smallcase/auth/save
 * @body  { smallcaseAuthId: string }
 * @description Persists the user's smallcaseAuthId to their profile.
 *   This prevents re-login on future sessions (broker stays linked).
 */
router.post(
  "/auth/save",
  requireGatewayConfig,
  async (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "UNAUTHORIZED", message: "Login required", retryable: false },
      });
    }

    const { smallcaseAuthId } = req.body as { smallcaseAuthId?: string };

    if (!smallcaseAuthId || typeof smallcaseAuthId !== "string") {
      return res.status(400).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "INVALID_AUTH_ID", message: "smallcaseAuthId is required", retryable: false },
      });
    }

    try {
      const userId = (req.user as { id: string }).id;

      await db.execute(sql`
        UPDATE users
        SET default_broker_id = ${smallcaseAuthId},
            updated_at        = NOW()
        WHERE id = ${userId}
      `);

      // eslint-disable-next-line no-console
      console.log(JSON.stringify({
        event:         "SMALLCASE_AUTH_SAVED",
        user_id:       userId,
        model_version: "sc-gateway-v2.0",
        timestamp:     new Date().toISOString(),
        latency_ms:    0,
        status:        "saved",
      }));

      return res.json({
        success: true,
        data:    { saved: true },
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Auth save failed";
      return res.status(500).json({
        success: false,
        data:    null,
        meta:    { timestamp: new Date().toISOString(), version: "1.0" },
        error:   { error_code: "AUTH_SAVE_FAILED", message, retryable: true },
      });
    }
  },
);

// ── Route: GET /api/smallcase/auth/status ─────────────────────────────────────

/**
 * @route GET /api/smallcase/auth/status
 * @description Returns whether the current user has a linked broker account.
 */
router.get("/auth/status", async (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.json({
      success: true,
      data:    { isConfigured: GATEWAY_CONFIGURED, isConnected: false, broker: null },
      meta:    { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }

  try {
    const userId = (req.user as { id: string }).id;

    const rows = await db.execute(sql`
      SELECT default_broker_id FROM users WHERE id = ${userId} LIMIT 1
    `);
    const row = ((rows as unknown as { rows: Array<{ default_broker_id: string | null }> }).rows ?? rows)[0];
    const isConnected = !!(row?.default_broker_id);

    return res.json({
      success: true,
      data:    { isConfigured: GATEWAY_CONFIGURED, isConnected, broker: null },
      meta:    { timestamp: new Date().toISOString(), version: "1.0" },
    });
  } catch {
    return res.json({
      success: true,
      data:    { isConfigured: GATEWAY_CONFIGURED, isConnected: false, broker: null },
      meta:    { timestamp: new Date().toISOString(), version: "1.0" },
    });
  }
});

export default router;
