/**
 * Truecaller Business Adapter
 *
 * Purpose : Integrates Truecaller for Business to brand FintekPro's outbound
 *           agent calls with a Verified Caller ID — showing the company name,
 *           logo, and a call reason so prospects recognise and trust the call.
 *
 * What the prospect sees on their phone when an agent calls:
 *   ┌──────────────────────────────────┐
 *   │  📞 Incoming Call                │
 *   │  ✅ FintekPro                    │
 *   │  Investment & Wealth Advisory    │
 *   │  📝 "Investment Advisory Call"   │
 *   └──────────────────────────────────┘
 *
 * API Pattern (Truecaller Business v3):
 *   1. POST /clients/{accountId}/token → Bearer token (60-min TTL, cached)
 *   2. POST /v3/clients/{accountId}/dynamic_call_record → sets call metadata
 *      (called BEFORE the agent dials — typically from our pre-call-setup API)
 *
 * GCR compliance:
 *   - Bearer token cached in memory with TTL-aware refresh (never expired tokens sent).
 *   - Structured logs on every token fetch + personalization event.
 *   - All credentials via env vars — never hardcoded.
 *   - Idempotent: repeated pre-call-setup for same call is safe.
 *   - Agent number registration is tracked in DB (truecaller_registered flag).
 */

import axios, { AxiosInstance } from "axios";
import { logger } from "../../logger";

// ── Config ────────────────────────────────────────────────────────────────────

const TRUECALLER_BASE_URL =
  process.env.TRUECALLER_BASE_URL ??
  "https://enterprise-portal-noneu.truecaller.com";
const TRUECALLER_ACCOUNT_ID = process.env.TRUECALLER_CLIENT_ACCOUNT_ID ?? "";
const TRUECALLER_KEY_ID = process.env.TRUECALLER_KEY_ID ?? "";
const TRUECALLER_SECRET = process.env.TRUECALLER_SECRET_API_KEY ?? "";

// Brand info sent with every call
const BRAND_NAME = "FintekPro";
const BRAND_CATEGORY = "Financial Services";
const DEFAULT_CALL_REASON = "Investment Advisory Call";

const ENGINE_VERSION = "truecaller-adapter-v1.0";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CallPersonalizationParams {
  /** Agent's outbound phone number (in E.164 format e.g. +919876543210) */
  callerNumber: string;
  /** Prospect's phone number (E.164) */
  calleeNumber: string;
  /** Reason shown to the prospect before they answer */
  callReason?: string;
  /** Agent's display name (optional, shown alongside brand) */
  agentName?: string;
  /** Unique call ID from FintekPro's telephony system */
  fintekCallId?: string;
}

export interface CallPersonalizationResult {
  success: boolean;
  truecallerRecordId?: string;
  callerNumber: string;
  calleeNumber: string;
  callReason: string;
  engine_version: string;
  timestamp: string;
  error?: string;
}

interface TokenCache {
  token: string;
  expiresAt: number; // Unix ms
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export class TruecallerBusinessAdapter {
  readonly available: boolean;
  private tokenCache: TokenCache | null = null;
  private client: AxiosInstance;

  constructor() {
    this.available =
      !!TRUECALLER_ACCOUNT_ID && !!TRUECALLER_KEY_ID && !!TRUECALLER_SECRET;

    this.client = axios.create({
      baseURL: TRUECALLER_BASE_URL,
      timeout: 8_000,
      headers: { "Content-Type": "application/json" },
    });

    if (!this.available) {
      logger.warn("TRUECALLER_NOT_CONFIGURED", {
        event: "TRUECALLER_NOT_CONFIGURED",
        message:
          "TRUECALLER_CLIENT_ACCOUNT_ID / TRUECALLER_KEY_ID / TRUECALLER_SECRET_API_KEY not set",
        status: "warn",
      });
    }
  }

  // ── Token management ─────────────────────────────────────────────────────

  /**
   * Fetches a Bearer token from Truecaller Business, caching it until
   * 5 minutes before expiry (tokens last 60 minutes).
   */
  private async getToken(): Promise<string> {
    const now = Date.now();
    // Return cached token if still valid (with 5-min buffer)
    if (this.tokenCache && this.tokenCache.expiresAt - now > 5 * 60_000) {
      return this.tokenCache.token;
    }

    const response = await this.client.post(
      `/clients/${TRUECALLER_ACCOUNT_ID}/token`,
      {
        keyId: TRUECALLER_KEY_ID,
        secretApiKey: TRUECALLER_SECRET,
      },
      {
        headers: { "X-Public-Access": "allow" },
      },
    );

    const token: string =
      response.data?.accessToken ?? response.data?.token;
    if (!token) throw new Error("Truecaller token response missing accessToken");

    // Cache for 55 minutes (tokens last 60 min)
    this.tokenCache = {
      token,
      expiresAt: now + 55 * 60_000,
    };

    logger.info("TRUECALLER_TOKEN_REFRESHED", {
      event: "TRUECALLER_TOKEN_REFRESHED",
      expires_in_min: 55,
      status: "success",
    });

    return token;
  }

  // ── Call personalization ──────────────────────────────────────────────────

  /**
   * Sets Truecaller call personalization data BEFORE the agent dials.
   * Truecaller uses this to show FintekPro's brand + call reason on the
   * prospect's screen when the call comes in.
   *
   * Call this endpoint from /api/calling/pre-call-setup before the agent
   * connects the outbound call via the telephony system.
   *
   * @param params - Caller, callee, and call context
   * @returns Success/failure result with Truecaller's record ID
   */
  async setCallPersonalization(
    params: CallPersonalizationParams,
  ): Promise<CallPersonalizationResult> {
    const startMs = Date.now();
    const timestamp = new Date().toISOString();
    const callReason = params.callReason ?? DEFAULT_CALL_REASON;

    if (!this.available) {
      return {
        success: false,
        callerNumber: params.callerNumber,
        calleeNumber: params.calleeNumber,
        callReason,
        engine_version: ENGINE_VERSION,
        timestamp,
        error: "Truecaller Business not configured",
      };
    }

    try {
      const token = await this.getToken();

      // Real-time v3 call personalization
      // Sends FintekPro brand data tied to this specific caller→callee pair
      const response = await this.client.post(
        `/v3/clients/${TRUECALLER_ACCOUNT_ID}/dynamic_call_record`,
        {
          callerNumber: params.callerNumber,     // agent's number
          calleeNumber: params.calleeNumber,     // prospect's number
          brandName: BRAND_NAME,
          businessCategory: BRAND_CATEGORY,
          callReason,
          agentName: params.agentName,
          referenceId: params.fintekCallId,      // for Truecaller analytics
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const recordId: string =
        response.data?.id ??
        response.data?.recordId ??
        response.data?.callRecordId;

      logger.info("TRUECALLER_CALL_PERSONALIZED", {
        event: "TRUECALLER_CALL_PERSONALIZED",
        caller: params.callerNumber,
        call_reason: callReason,
        agent: params.agentName,
        truecaller_record_id: recordId,
        latency_ms: Date.now() - startMs,
        engine_version: ENGINE_VERSION,
        status: "success",
      });

      return {
        success: true,
        truecallerRecordId: recordId,
        callerNumber: params.callerNumber,
        calleeNumber: params.calleeNumber,
        callReason,
        engine_version: ENGINE_VERSION,
        timestamp,
      };
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message ?? err?.message ?? String(err);

      logger.error("TRUECALLER_PERSONALIZATION_FAILED", {
        event: "TRUECALLER_PERSONALIZATION_FAILED",
        caller: params.callerNumber,
        error: errorMsg,
        http_status: err?.response?.status,
        retryable: false,
        latency_ms: Date.now() - startMs,
        status: "error",
      });

      // Non-blocking — call can still proceed without branding
      return {
        success: false,
        callerNumber: params.callerNumber,
        calleeNumber: params.calleeNumber,
        callReason,
        engine_version: ENGINE_VERSION,
        timestamp,
        error: errorMsg,
      };
    }
  }

  /**
   * Registers an agent's phone number as a verified FintekPro business number.
   * Should be called once when a new agent is onboarded and their calling number is set.
   * Tracked via users.truecaller_registered in DB.
   *
   * @param phoneNumber - Agent's outbound number in E.164 format
   * @param featureSetId - Truecaller feature set ID (from Business Console)
   */
  async registerBusinessNumber(
    phoneNumber: string,
    featureSetId: string,
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.available) {
      return { success: false, error: "Truecaller Business not configured" };
    }

    try {
      const token = await this.getToken();

      await this.client.post(
        `/clients/${TRUECALLER_ACCOUNT_ID}/number_management/feature_sets/${featureSetId}/numbers/publish`,
        { numbers: [phoneNumber] },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      logger.info("TRUECALLER_NUMBER_REGISTERED", {
        event: "TRUECALLER_NUMBER_REGISTERED",
        phone_last4: phoneNumber.slice(-4),
        feature_set_id: featureSetId,
        status: "success",
      });

      return { success: true };
    } catch (err: any) {
      logger.error("TRUECALLER_NUMBER_REGISTRATION_FAILED", {
        event: "TRUECALLER_NUMBER_REGISTRATION_FAILED",
        phone_last4: phoneNumber.slice(-4),
        error: err?.message,
        retryable: false,
        status: "error",
      });
      return { success: false, error: err?.message };
    }
  }
}

export const truecallerBusinessAdapter = new TruecallerBusinessAdapter();
