/**
 * DhanHQ OAuth 2.0 & Partner Lead Routes — FASP-AI-v3.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Manages 3-legged OAuth authentication for client Dhan Demat accounts,
 *           token persistence in indian_broker_accounts, partner e-KYC lead links,
 *           and real-time funds / holdings inspection.
 *
 * Compliance:
 *   - FintekPro GCR v1.0 & SEBI IA/PMS Regulations:
 *     - Multi-tenant client isolation.
 *     - Immutable audit logs.
 *     - Structured error format: { error_code, message, retryable }.
 *
 * @module server/routes/dhan-oauth-routes
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { indianBrokerAccounts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logger } from "../logger";
import { dhanAdapter } from "../services/mpal/adapters/dhanAdapter";

export const dhanOAuthRouter = Router();

const DEFAULT_REDIRECT_URI =
  process.env.DHAN_REDIRECT_URI || "https://fintekpro.com/api/dhan/oauth/callback";

/**
 * GET /api/dhan/oauth/connect
 * Generates the Dhan authorization / consent URL.
 * Query: ?redirect=true|false&userId=...
 */
dhanOAuthRouter.get("/oauth/connect", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const userId = (req as any).user?.id?.toString() || (req.query.userId as string) || "guest";
    const clientId = process.env.DHAN_CLIENT_ID || process.env.DHAN_PARTNER_ID || "FINTEKPRO_SANDBOX";
    const redirectUri = (req.query.redirect_uri as string) || DEFAULT_REDIRECT_URI;

    // Embed state payload: userId and timestamp
    const statePayload = Buffer.from(JSON.stringify({ userId, t: Date.now() })).toString("base64");
    const authUrl = dhanAdapter.getLoginDialogUrl(clientId, redirectUri, statePayload);

    logger.info("[DhanOAuth] Generated authorization dialog URL", {
      event: "DHAN_AUTH_URL_GENERATED",
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
    logger.error("[DhanOAuth] Failed to generate connect URL", { error: err.message });
    return res.status(500).json({
      success: false,
      error_code: "DHAN_AUTH_URL_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * GET /api/dhan/oauth/callback
 * Handles the browser redirect from Dhan with ?code=...&state=... (or consent_id)
 */
dhanOAuthRouter.get("/oauth/callback", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const code = (req.query.code as string) || (req.query.consent_id as string) || (req.query.token as string);
    const state = req.query.state as string;

    if (!code) {
      return res.status(400).json({
        success: false,
        error_code: "MISSING_AUTH_CODE",
        message: "Authorization code or consent ID not returned by Dhan",
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

    const clientId = process.env.DHAN_CLIENT_ID || process.env.DHAN_PARTNER_ID || "FINTEKPRO_SANDBOX";
    const clientSecret = process.env.DHAN_CLIENT_SECRET || "";
    const redirectUri = DEFAULT_REDIRECT_URI;

    // Exchange auth code for access token
    const tokenData = await dhanAdapter.exchangeAuthCode(code, clientId, clientSecret, redirectUri);
    const accessToken = tokenData.access_token;

    // Fetch user profile from Dhan
    let profile: any = null;
    try {
      profile = await dhanAdapter.getProfile(accessToken, tokenData.client_id);
    } catch (profErr: any) {
      logger.warn(`[DhanOAuth] Profile fetch warning: ${profErr.message}`);
    }

    const brokerClientId = profile?.client_id || profile?.dhanClientId || tokenData.client_id || "DHAN_CLIENT";
    const brokerClientName = profile?.user_name || profile?.clientName || tokenData.user_name || "Dhan Investor";
    const exchangesEnabled = profile?.exchanges || ["NSE", "BSE", "MCX"];

    // Upsert into indian_broker_accounts table
    const [existing] = await db
      .select()
      .from(indianBrokerAccounts)
      .where(
        and(
          eq(indianBrokerAccounts.userId, userId),
          eq(indianBrokerAccounts.broker, "DHAN")
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
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(indianBrokerAccounts.id, existing.id));
    } else {
      await db.insert(indianBrokerAccounts).values({
        userId,
        broker: "DHAN",
        brokerClientId,
        brokerClientName,
        accessToken,
        status: "connected",
        exchangesEnabled,
        lastSyncAt: new Date(),
      });
    }

    logger.info("[DhanOAuth] Account linked successfully", {
      event: "DHAN_ACCOUNT_LINKED",
      user_id: userId,
      broker_client_id: brokerClientId,
      latency_ms: Date.now() - t0,
    });

    if (req.query.redirect_on_complete) {
      return res.redirect(req.query.redirect_on_complete as string);
    }

    return res.json({
      success: true,
      message: "Dhan Demat account linked successfully.",
      data: {
        userId,
        broker: "DHAN",
        brokerClientId,
        brokerClientName,
        exchangesEnabled,
        status: "connected",
      },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err: any) {
    logger.error("[DhanOAuth] Callback exchange failed", { error: err.message });
    return res.status(500).json({
      success: false,
      error_code: "DHAN_OAUTH_EXCHANGE_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * GET /api/dhan/oauth/account
 * Returns connected Dhan Demat details for the requesting user.
 */
dhanOAuthRouter.get("/oauth/account", async (req: Request, res: Response) => {
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
          eq(indianBrokerAccounts.broker, "DHAN")
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
 * GET /api/dhan/connected-brokers
 * Returns all active connected broker accounts for the user (Dhan, Upstox, etc.)
 * Used by existing client dropdown / search box for execution broker choice.
 */
dhanOAuthRouter.get("/connected-brokers", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const userId = (req as any).user?.id?.toString() || (req.query.userId as string);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error_code: "USER_REQUIRED",
        message: "User ID is required",
        retryable: false,
      });
    }

    const accounts = await db
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
      .where(eq(indianBrokerAccounts.userId, userId));

    const availableBrokers = [
      {
        brokerId: "DHAN",
        brokerName: "Dhan (DhanHQ Partner)",
        capabilities: ["NSE Equity", "BSE Equity", "NSE F&O", "BSE F&O", "MCX Commodity"],
        features: ["Native Order Slicing", "SuperFast Feeds", "20 Market Depth", "Forever Orders"],
        isConnected: accounts.some((a) => a.broker === "DHAN" && a.status === "connected"),
        account: accounts.find((a) => a.broker === "DHAN") || null,
      },
      {
        brokerId: "UPSTOX",
        brokerName: "Upstox Securities",
        capabilities: ["NSE Equity", "BSE Equity", "NSE F&O", "BSE F&O"],
        features: ["High-speed Orders", "Golden Source Pricing"],
        isConnected: accounts.some((a) => a.broker === "UPSTOX" && a.status === "connected"),
        account: accounts.find((a) => a.broker === "UPSTOX") || null,
      },
    ];

    return res.json({
      success: true,
      data: {
        userId,
        connectedAccounts: accounts,
        availableBrokers,
        hasConnectedBroker: accounts.some((a) => a.status === "connected"),
        defaultBroker: accounts.find((a) => a.status === "connected")?.broker || "DHAN",
      },
      meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "CONNECTED_BROKERS_FETCH_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * DELETE /api/dhan/oauth/disconnect
 * Disconnects the user's Dhan Demat account.
 */
dhanOAuthRouter.delete("/oauth/disconnect", async (req: Request, res: Response) => {
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
          eq(indianBrokerAccounts.broker, "DHAN")
        )
      );

    return res.json({
      success: true,
      message: "Dhan Demat account disconnected successfully.",
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
 * GET /api/dhan/partner/lead-url
 * Returns partner/sub-broker digital onboarding referral link for clients who do not have a Dhan account.
 */
dhanOAuthRouter.get("/partner/lead-url", (_req: Request, res: Response) => {
  const partnerId = process.env.DHAN_PARTNER_ID || "FINTEKPRO";
  const leadUrl = dhanAdapter.getPartnerLeadUrl(partnerId);

  return res.json({
    success: true,
    data: {
      partnerId,
      leadUrl,
      headline: "Open Dhan Demat Account with FintekPro Partner Benefits",
      supportedSegments: ["Equity Delivery", "Mutual Funds", "ETFs", "F&O", "Commodities"],
    },
    meta: {
      timestamp: new Date().toISOString(),
      partnerProgram: "DhanHQ Partner Ecosystem",
    },
  });
});

/**
 * GET /api/dhan/funds
 * Returns cash balance, utilized margin, and collateral limit.
 */
dhanOAuthRouter.get("/funds", async (req: Request, res: Response) => {
  try {
    const customToken = (req.headers["x-dhan-token"] as string) || (req.query.token as string);
    const customClientId = (req.headers["x-dhan-client-id"] as string) || (req.query.clientId as string);

    const limits = await dhanAdapter.getFundLimits(customToken, customClientId);
    return res.json({
      success: true,
      data: limits,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "DHAN_FUNDS_FETCH_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * GET /api/dhan/holdings
 * Returns long-term Demat holdings from Dhan.
 */
dhanOAuthRouter.get("/holdings", async (req: Request, res: Response) => {
  try {
    const customToken = (req.headers["x-dhan-token"] as string) || (req.query.token as string);
    const customClientId = (req.headers["x-dhan-client-id"] as string) || (req.query.clientId as string);

    const holdings = await dhanAdapter.getHoldings(undefined, customToken, customClientId);
    return res.json({
      success: true,
      data: holdings,
      meta: { timestamp: new Date().toISOString(), count: holdings.length },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "DHAN_HOLDINGS_FETCH_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});

/**
 * GET /api/dhan/positions
 * Returns intraday and carry-forward positions from Dhan.
 */
dhanOAuthRouter.get("/positions", async (req: Request, res: Response) => {
  try {
    const customToken = (req.headers["x-dhan-token"] as string) || (req.query.token as string);
    const customClientId = (req.headers["x-dhan-client-id"] as string) || (req.query.clientId as string);

    const positions = await dhanAdapter.getPositions(undefined, customToken, customClientId);
    return res.json({
      success: true,
      data: positions,
      meta: { timestamp: new Date().toISOString(), count: positions.length },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error_code: "DHAN_POSITIONS_FETCH_ERROR",
      message: err.message,
      retryable: true,
    });
  }
});
