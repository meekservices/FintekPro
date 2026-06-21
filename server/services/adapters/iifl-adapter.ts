/**
 * IIFLAdapter — IIFL Securities KYC Broker Adapter
 *
 * IMPORTANT — API VERSION BLOCKER:
 * IIFL has migrated between XTS API (api.iifl.com/XTS.Trades.WebAPI/) and the
 * newer ONT API (api.iiflmarkets.com). The field names and endpoints below are
 * STUBS marked with [STUB] that must be updated once the sandbox key type is
 * confirmed. The adapter structure, idempotency guard, and error handling are
 * fully implemented and will work once field mappings are finalized.
 *
 * To activate: update IIFL_API_KEY and IIFL_API_SECRET in .env, then
 * update the FIELD_MAP below with confirmed field names and update
 * BASE_URL with the confirmed endpoint.
 *
 * References:
 *  - XTS API: https://symphonyfintech.com/xts-trading-front-end-api/
 *  - ONT API: Confirm with IIFL partner team
 */

import axios, { AxiosInstance } from "axios";
import type {
  BrokerAdapter,
  BrokerStatusResult,
  BrokerSubmitResult,
  CanonicalKycProfile,
} from "./broker-adapter.interface";
import { logger } from "../../logger";

// ─── Field mapping config (canonical field → IIFL payload field) ─────────────
// [STUB] Update these names once IIFL API version (XTS vs ONT) is confirmed.
// Keeping mapping separate from request-building logic per spec requirement.
const IIFL_FIELD_MAP: Record<string, string> = {
  fullLegalName:        "clientName",          // [STUB]
  dateOfBirth:          "dateOfBirth",         // [STUB] format TBD (DD/MM/YYYY vs ISO)
  panNumber:            "panNo",               // [STUB]
  mobileNumber:         "mobileNo",            // [STUB]
  email:                "emailId",             // [STUB]
  bankAccountNumber:    "bankAccountNo",        // [STUB]
  ifscCode:             "ifscCode",            // [STUB]
  occupation:           "occupation",          // [STUB]
  annualIncomeBand:     "annualIncome",        // [STUB]
  netWorthBand:         "netWorth",            // [STUB]
  riskProfileCategory:  "riskCategory",        // [STUB]
};

// [STUB] — Replace with confirmed IIFL API base URL
const BASE_URL = process.env.IIFL_API_BASE_URL || "https://api.iiflmarkets.com"; // [STUB]
const AUTH_ENDPOINT = "/auth/token";           // [STUB] — confirm endpoint
const KYC_SUBMIT_ENDPOINT = "/kyc/create";     // [STUB] — confirm endpoint
const KYC_STATUS_ENDPOINT = "/kyc/status";     // [STUB] — confirm endpoint

export class IIFLAdapter implements BrokerAdapter {
  readonly brokerId = "iifl";
  readonly brokerName = "IIFL Securities";

  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey    = process.env.IIFL_API_KEY    || "";
    this.apiSecret = process.env.IIFL_API_SECRET || "";

    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Submit KYC to IIFL.
   * NOTE: All [STUB] comments below indicate fields that need confirmation.
   * The idempotency key must be checked by the caller (kyc-idempotency-guard)
   * before invoking this method.
   */
  async submitKyc(
    profile: CanonicalKycProfile,
    brokerDelta: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<BrokerSubmitResult> {
    const startTs = Date.now();

    if (!this.apiKey || !this.apiSecret) {
      throw Object.assign(
        new Error("IIFL_API_KEY / IIFL_API_SECRET not configured"),
        { retryable: false, error_code: "MISSING_CREDENTIALS" }
      );
    }

    logger.info("BROKER_KYC_SUBMIT", {
      broker_id: this.brokerId,
      user_id: profile.userId,
      idempotency_key: idempotencyKey,
      // PAN is doc_id — not logged in full
      doc_id: profile.panNumber ? `${profile.panNumber.slice(0, 5)}****` : "none",
});

    try {
      // [STUB] Authenticate — replace with correct IIFL auth mechanism
      const authToken = await this.authenticate();

      // Build payload using field map (field name lookup, not hardcoded strings)
      const payload = this.buildPayload(profile, brokerDelta);

      // [STUB] POST to confirmed KYC endpoint
      const response = await this.client.post(KYC_SUBMIT_ENDPOINT, payload, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-Idempotency-Key": idempotencyKey,          // [STUB] confirm header name
        },
      });

      const rawResponseRef = `iifl/submissions/${idempotencyKey}`;

      logger.info("BROKER_KYC_SUBMIT_SUCCESS", {
        broker_id: this.brokerId,
        user_id: profile.userId,
        broker_client_id: response.data?.clientId,     // [STUB] confirm field name
        status: response.data?.status,                  // [STUB] confirm field name
        latency_ms: Date.now() - startTs,
        status_log: "success",
});

      return {
        brokerClientId: response.data?.clientId ?? idempotencyKey, // [STUB]
        status: response.data?.status ?? "submitted",               // [STUB]
        rawResponseRef,
        canonicalWriteBack: await this.mapToCanonical(response.data),
      };
    } catch (error: any) {
      const isNetworkError = !error.response;
      logger.error("BROKER_KYC_SUBMIT_ERROR", {
        broker_id: this.brokerId,
        user_id: profile.userId,
        error_code: error.response?.data?.errorCode ?? "NETWORK_ERROR",
        message: error.response?.data?.message ?? error.message,
        latency_ms: Date.now() - startTs,
        status: "error",
        retryable: isNetworkError,
});
      throw Object.assign(
        new Error(`IIFL KYC submission failed: ${error.response?.data?.message ?? error.message}`),
        {
          retryable: isNetworkError,
          error_code: error.response?.data?.errorCode ?? "NETWORK_ERROR",
        }
      );
    }
  }

  async getStatus(brokerClientId: string): Promise<BrokerStatusResult> {
    const startTs = Date.now();
    try {
      const authToken = await this.authenticate();
      // [STUB] Confirm endpoint and query param name with IIFL
      const response = await this.client.get(`${KYC_STATUS_ENDPOINT}/${brokerClientId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      logger.info("BROKER_KYC_STATUS_CHECK", {
        broker_id: this.brokerId,
        broker_client_id: brokerClientId,
        status: response.data?.status,
        latency_ms: Date.now() - startTs,
        status_log: "success",
});
      return {
        status: response.data?.status ?? "unknown", // [STUB]
        details: response.data,
        lastUpdatedAt: response.data?.updatedAt,    // [STUB]
      };
    } catch (error: any) {
      throw Object.assign(
        new Error(`IIFL status check failed: ${error.message}`),
        { retryable: !error.response, error_code: "STATUS_CHECK_ERROR" }
      );
    }
  }

  async mapToCanonical(brokerResponse: unknown): Promise<Partial<CanonicalKycProfile>> {
    if (!brokerResponse || typeof brokerResponse !== "object") return {};
    const r = brokerResponse as Record<string, unknown>;
    // [STUB] Map IIFL-specific response fields back to canonical.
    // Update field names once IIFL API response spec is confirmed.
    return {
      ...(r.verifiedBankAccount ? {
        bankAccountNumber: r.verifiedBankAccount as string, // [STUB]
      } : {}),
    };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async authenticate(): Promise<string> {
    // [STUB] Replace with correct IIFL auth mechanism (API key + secret → token)
    const response = await this.client.post(AUTH_ENDPOINT, {
      appKey:    this.apiKey,     // [STUB] confirm param name
      secretKey: this.apiSecret,  // [STUB] confirm param name
    });
    return response.data?.token ?? response.data?.accessToken; // [STUB]
  }

  /**
   * Builds the IIFL payload from canonical profile using IIFL_FIELD_MAP.
   * Field map is the single source of truth — this function never has
   * hardcoded broker field names; they come from the map config.
   */
  private buildPayload(
    profile: CanonicalKycProfile,
    brokerDelta: Record<string, unknown>
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [canonicalKey, iiflKey] of Object.entries(IIFL_FIELD_MAP)) {
      const value = (profile as unknown as Record<string, unknown>)[canonicalKey];
      if (value !== undefined && value !== null) {
        payload[iiflKey] = value;
      }
    }

    // Merge broker-specific delta fields (passed as-is)
    Object.assign(payload, brokerDelta);

    return payload;
  }
}

export const iiflAdapter = new IIFLAdapter();
