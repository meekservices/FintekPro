/**
 * Upstox OAuth 2.0 & Partner Lead Routes — FASP-AI-v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Manages 3-legged OAuth authentication for client Upstox Demat accounts,
 *           token persistence in indian_broker_accounts, partner e-KYC lead links,
 *           and CDSL EDIS pre-trade authorization checks.
 *
 * Compliance:
 *   - FintekPro GCR v1.0 & SEBI IA/PMS Regulations:
 *     - Multi-tenant client isolation.
 *     - Immutable audit logs.
 *     - Structured error format: { error_code, message, retryable }.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { indianBrokerAccounts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger";
import { upstoxAdapter } from "../services/mpal/adapters/upstoxAdapter";

export const upstoxOAuthRouter = Router();

const DEFAULT_REDIRECT_URI =
  process.env.UPSTOX_REDIRECT_URI || "https://fintekpro.com/api/upstox/oauth/callback";

/**
 * GET /api/upstox/oauth/connect
 * Generates the Upstox OAuth authorization dialog URL.
 * Query: ?redirect=true|false
 */
upstoxOAuthRouter.get("/oauth/connect", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const userId = (req as any).user?.id?.toString() || (req.query.userId as string) || "guest";
    const clientId = process.env.UPSTOX_CLIENT_ID || process.env.UPSTOX_API_KEY || "";
    const redirectUri = (req.query.redirect_uri as string) || DEFAULT_REDIRECT_URI;

    if (!clientId) {
      return res.status(500).json({
        success: false,
        error_code: "UPSTOX_CONFIG_MISSING",
        message: "UPSTOX_CLIENT_ID / UPSTOX_API_KEY is not configured on the server",
        retryable: false,
      });
    }

    // Embed state payload: userId and timestamp
    const statePayload = Buffer.from(JSON.stringify({ userId, t: Date.now() })).toString("base64");
    const authUrl = upstoxAdapter.getLoginDialogUrl(clientId, redirectUri, statePayload);

    logger.info("[UpstoxOAuth] Generated authorization dialog URL", {
      event: "UPSTOX_AUTH_URL_GENERATED",
      user_id: userId,
      latency_ms: Date.now() - t0,
    });

    if (req.query.redirect === "true") {
      return res.redirect(authUrl);
    }

    return res.json({
      success: true,
      data: {
        authorizationUrl: authUrl,
        redirectUri,
        state: statePayload,
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err: any) {
    logger.error("[UpstoxOAuth] Failed to generate connect URL", { error: err.message });
    return res.status(500).json({
      success: false,
      error_code: "AUTH_URL_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * GET /api/upstox/oauth/callback
 * Handles the browser redirect from Upstox with ?code=...&state=...
 */
upstoxOAuthRouter.get("/oauth/callback", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code) {
      return res.status(400).json({
        success: false,
        error_code: "MISSING_AUTH_CODE",
        message: "Authorization code not returned by Upstox",
        retryable: false,
      });
    }

    let userId = "guest";
    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
        if (decoded.userId) userId = decoded.userId;
      } catch {
        /* fallback to guest */
      }
    }

    const clientId = process.env.UPSTOX_CLIENT_ID || process.env.UPSTOX_API_KEY || "";
    const clientSecret = process.env.UPSTOX_CLIENT_SECRET || process.env.UPSTOX_API_SECRET || "";
    const redirectUri = DEFAULT_REDIRECT_URI;

    // Exchange auth code for access token
    const tokenData = await upstoxAdapter.exchangeAuthCode(code, clientId, clientSecret, redirectUri);
    const accessToken = tokenData.access_token;

    // Fetch user profile from Upstox to capture UCC and client name
    let profile: any = null;
    try {
      profile = await upstoxAdapter.getProfile(accessToken);
    } catch (profErr: any) {
      logger.warn(`[UpstoxOAuth] Profile fetch warning: ${profErr.message}`);
    }

    const brokerClientId = profile?.client_id || profile?.user_id || tokenData.user_id || "UPSTOX_CLIENT";
    const brokerClientName = profile?.user_name || tokenData.user_name || "Upstox Investor";
    const exchangesEnabled = profile?.exchanges || ["NSE", "BSE"];

    // Upsert into indian_broker_accounts table
    const [existing] = await db
      .select()
      .from(indianBrokerAccounts)
      .where(
        and(
          eq(indianBrokerAccounts.userId, userId),
          eq(indianBrokerAccounts.broker, "UPSTOX")
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(indianBrokerAccounts)
        .set({
          brokerClientId,
          brokerClientName,
          accessToken,
          status: "connected",
          exchangesEnabled,
          metadata: { profile, connectedAt: new Date().toISOString() },
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(indianBrokerAccounts.id, existing.id));
    } else {
      await db.insert(indianBrokerAccounts).values({
        userId,
        broker: "UPSTOX",
        brokerClientId,
        brokerClientName,
        accessToken,
        status: "connected",
        exchangesEnabled,
        metadata: { profile, connectedAt: new Date().toISOString() },
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    logger.info("[UpstoxOAuth] Upstox Demat account linked successfully", {
      event: "UPSTOX_ACCOUNT_LINKED",
      user_id: userId,
      broker_client_id: brokerClientId,
      latency_ms: Date.now() - t0,
    });

    return res.json({
      success: true,
      message: "Upstox Demat account connected successfully.",
      data: {
        userId,
        broker: "UPSTOX",
        brokerClientId,
        brokerClientName,
        exchangesEnabled,
        status: "connected",
      },
      meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
    });
  } catch (err: any) {
    logger.error("[UpstoxOAuth] Token exchange error", { error: err.message });
    return res.status(500).json({
      success: false,
      error_code: "TOKEN_EXCHANGE_FAILED",
      message: err.message || "Failed to exchange Upstox authorization code for access token",
      retryable: true,
    });
  }
});

/**
 * GET /api/upstox/oauth/account
 * Returns connected Upstox Demat details for the current user.
 */
upstoxOAuthRouter.get("/oauth/account", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const userId = (req as any).user?.id?.toString() || (req.query.userId as string);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error_code: "USER_REQUIRED",
        message: "User ID is required to fetch connected Demat account",
        retryable: false,
      });
    }

    const [account] = await db
      .select({
        id: indianBrokerAccounts.id,
        broker: indianBrokerAccounts.broker,
        brokerClientId: indianBrokerAccounts.brokerClientId,
        brokerClientName: indianBrokerAccounts.brokerClientName,
        status: indianBrokerAccounts.status,
        edisAuthorized: indianBrokerAccounts.edisAuthorized,
        exchangesEnabled: indianBrokerAccounts.exchangesEnabled,
        lastSyncAt: indianBrokerAccounts.lastSyncAt,
      })
      .from(indianBrokerAccounts)
      .where(
        and(
          eq(indianBrokerAccounts.userId, userId),
          eq(indianBrokerAccounts.broker, "UPSTOX")
        )
      )
      .limit(1);

    return res.json({
      success: true,
      data: account || null,
      meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "ACCOUNT_FETCH_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * DELETE /api/upstox/oauth/disconnect
 * Disconnects the user's Upstox Demat account.
 */
upstoxOAuthRouter.delete("/oauth/disconnect", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id?.toString() || (req.body?.userId as string);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error_code: "USER_REQUIRED",
        message: "User ID is required",
        retryable: false,
      });
    }

    await db
      .update(indianBrokerAccounts)
      .set({
        status: "disconnected",
        accessToken: null,
        refreshToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(indianBrokerAccounts.userId, userId),
          eq(indianBrokerAccounts.broker, "UPSTOX")
        )
      );

    return res.json({
      success: true,
      message: "Upstox Demat account disconnected successfully.",
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "DISCONNECT_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * GET /api/upstox/partner/lead-url
 * Returns partner/sub-broker digital onboarding referral link for clients who do not have an Upstox Demat account.
 */
upstoxOAuthRouter.get("/partner/lead-url", (_req: Request, res: Response) => {
  const partnerCode = process.env.UPSTOX_PARTNER_CODE || process.env.UPSTOX_AP_CODE || "FINTEKPRO";
  const leadUrl = `https://upstox.com/open-account/?f=${encodeURIComponent(partnerCode)}`;

  return res.json({
    success: true,
    data: {
      partnerCode,
      leadUrl,
      headline: "Open Upstox 3-in-1 Demat Account with FintekPro Partner Benefits",
      supportedSegments: ["Equity Delivery", "Mutual Funds", "ETFs", "F&O"],
    },
    meta: {
      timestamp: new Date().toISOString(),
      partnerProgram: "Upstox Authorized Partner / FinTech Ecosystem",
    },
  });
});

/**
 * GET /api/upstox/edis/status
 * Queries active CDSL EDIS holding authorization details for selling shares.
 */
upstoxOAuthRouter.get("/edis/status", async (req: Request, res: Response) => {
  try {
    const customToken =
      (req.headers["x-upstox-token"] as string) || (req.query.token as string) || undefined;
    const details = await upstoxAdapter.getEdisDetails(customToken);

    return res.json({
      success: true,
      data: details || { authorized: false, message: "No active EDIS authorization found." },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "EDIS_CHECK_FAILED",
      message: err.message,
      retryable: true,
    });
  }
});
