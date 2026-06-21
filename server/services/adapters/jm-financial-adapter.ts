/**
 * JMFinancialAdapter — JM Financial Services KYC Broker Adapter
 *
 * IMPORTANT — API DOCUMENTATION BLOCKER:
 * JM Financial's partner API is not publicly documented. All field names,
 * endpoints, and auth mechanisms below are STUBS marked with [STUB] pending
 * receipt of JM Financial's sandbox documentation or partner API spec.
 * See implementation_plan.md Open Question 3.
 *
 * To activate: provide JM_FINANCIAL_API_KEY, JM_FINANCIAL_API_SECRET,
 * and optionally JM_FINANCIAL_API_BASE_URL in .env, then update the
 * JM_FIELD_MAP and endpoint constants below.
 */

import axios, { AxiosInstance } from "axios";
import type {
  BrokerAdapter,
  BrokerStatusResult,
  BrokerSubmitResult,
  CanonicalKycProfile,
} from "./broker-adapter.interface";
import { logger } from "../../logger";

// ─── Field mapping config (canonical field → JM Financial payload field) ─────
// [STUB] All field names need confirmation from JM Financial API documentation.
const JM_FIELD_MAP: Record<string, string> = {
  fullLegalName:        "name",           // [STUB]
  dateOfBirth:          "dob",            // [STUB] format TBD
  panNumber:            "pan",            // [STUB]
  mobileNumber:         "mobile",         // [STUB]
  email:                "email",          // [STUB]
  bankAccountNumber:    "bankAccountNumber", // [STUB]
  ifscCode:             "ifsc",           // [STUB]
  occupation:           "occupation",     // [STUB]
  annualIncomeBand:     "incomeRange",    // [STUB]
  netWorthBand:         "netWorth",       // [STUB]
};

// [STUB] — Replace with confirmed JM Financial API base URL
const BASE_URL = process.env.JM_FINANCIAL_API_BASE_URL || "https://api.jmfinancial.in"; // [STUB]
const AUTH_ENDPOINT = "/partner/auth";       // [STUB]
const KYC_SUBMIT_ENDPOINT = "/partner/kyc";  // [STUB]
const KYC_STATUS_ENDPOINT = "/partner/kyc";  // [STUB]

export class JMFinancialAdapter implements BrokerAdapter {
  readonly brokerId = "jm_financial";
  readonly brokerName = "JM Financial Services";

  private client: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.apiKey    = process.env.JM_FINANCIAL_API_KEY    || "";
    this.apiSecret = process.env.JM_FINANCIAL_API_SECRET || "";

    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 30_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  async submitKyc(
    profile: CanonicalKycProfile,
    brokerDelta: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<BrokerSubmitResult> {
    const startTs = Date.now();

    if (!this.apiKey || !this.apiSecret) {
      throw Object.assign(
        new Error("JM_FINANCIAL_API_KEY / JM_FINANCIAL_API_SECRET not configured"),
        { retryable: false, error_code: "MISSING_CREDENTIALS" }
      );
    }

    logger.info("BROKER_KYC_SUBMIT", {
      broker_id: this.brokerId,
      user_id: profile.userId,
      idempotency_key: idempotencyKey,
      doc_id: profile.panNumber ? `${profile.panNumber.slice(0, 5)}****` : "none",
});

    try {
      const authToken = await this.authenticate();
      const payload = this.buildPayload(profile, brokerDelta);

      // [STUB] POST to JM Financial KYC endpoint — confirm endpoint + auth header
      const response = await this.client.post(KYC_SUBMIT_ENDPOINT, payload, {
        headers: {
          Authorization: `Bearer ${authToken}`, // [STUB] confirm auth scheme
          "X-Idempotency-Key": idempotencyKey,  // [STUB] confirm if supported
        },
      });

      const rawResponseRef = `jm_financial/submissions/${idempotencyKey}`;

      logger.info("BROKER_KYC_SUBMIT_SUCCESS", {
        broker_id: this.brokerId,
        user_id: profile.userId,
        broker_client_id: response.data?.clientId, // [STUB]
        latency_ms: Date.now() - startTs,
        status: "success",
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
        new Error(`JM Financial KYC submission failed: ${error.response?.data?.message ?? error.message}`),
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
      // [STUB] Confirm endpoint pattern with JM Financial
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
        new Error(`JM Financial status check failed: ${error.message}`),
        { retryable: !error.response, error_code: "STATUS_CHECK_ERROR" }
      );
    }
  }

  async mapToCanonical(brokerResponse: unknown): Promise<Partial<CanonicalKycProfile>> {
    if (!brokerResponse || typeof brokerResponse !== "object") return {};
    // [STUB] Map JM Financial response fields back to canonical.
    // No fields confirmed yet — will update once API docs received.
    return {};
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async authenticate(): Promise<string> {
    // [STUB] Replace with confirmed JM Financial auth mechanism
    const response = await this.client.post(AUTH_ENDPOINT, {
      apiKey:    this.apiKey,    // [STUB]
      apiSecret: this.apiSecret, // [STUB]
    });
    return response.data?.token ?? response.data?.accessToken; // [STUB]
  }

  private buildPayload(
    profile: CanonicalKycProfile,
    brokerDelta: Record<string, unknown>
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const [canonicalKey, jmKey] of Object.entries(JM_FIELD_MAP)) {
      const value = (profile as unknown as Record<string, unknown>)[canonicalKey];
      if (value !== undefined && value !== null) {
        payload[jmKey] = value;
      }
    }

    Object.assign(payload, brokerDelta);
    return payload;
  }
}

export const jmFinancialAdapter = new JMFinancialAdapter();
