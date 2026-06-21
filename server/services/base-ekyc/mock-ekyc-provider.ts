/**
 * MockEkycProvider — Deterministic mock for base eKYC / KRA integration
 *
 * Active when BASE_EKYC_PROVIDER=mock (default until Section 3 compliance
 * confirmation is resolved). Returns realistic but static test data so the
 * rest of the system (vault, orchestrator, adapters) can be built and tested
 * without blocking on KRA API access.
 *
 * Observability: emits structured logs on every call per FASP-AI GCR rule.
 * PII: PAN is logged as doc_id only (first 5 chars + ****). Aadhaar never logged.
 */

import type {
  BaseEkycProvider,
  EkycInput,
  EkycSession,
  EkycVerifiedData,
  KraKycRecord,
} from "./base-ekyc-provider.interface";
import { logger } from "../../logger";

/** Deterministic mock dataset — keyed by masked PAN prefix for tests */
const MOCK_KRA_RECORDS: Record<string, KraKycRecord> = {
  /** Default happy-path: PAN starts with "ABCDE" */
  ABCDE: {
    kraKinNumber: "MOCK-KIN-0001234",
    dateOfBirth: "1990-01-15",
    fullLegalName: "MOCK USER ONE",
    gender: "M",
    aadhaarLast4: "1234",
    kycStatus: "active",
    kycVerifiedAt: "2024-06-01T10:00:00Z",
    kycExpiryDate: "2026-06-01T10:00:00Z",
    nationality: "Indian",
    verificationMethod: "ekyc_otp",
  },
  /** Expired KYC scenario */
  EXPRD: {
    kraKinNumber: "MOCK-KIN-0001235",
    dateOfBirth: "1985-03-20",
    fullLegalName: "EXPIRED KYC USER",
    gender: "F",
    aadhaarLast4: "5678",
    kycStatus: "expired",
    kycVerifiedAt: "2022-01-01T00:00:00Z",
    kycExpiryDate: "2024-01-01T00:00:00Z",
    nationality: "Indian",
    verificationMethod: "document_upload",
  },
};

/** In-memory OTP session store for mock (keyed by sessionId) */
const MOCK_OTP_SESSIONS = new Map<
  string,
  { pan: string; aadhaar?: string; expiresAt: Date }
>();

/** Mock OTP that always succeeds for testing: "123456" */
const MOCK_OTP = "123456";

export class MockEkycProvider implements BaseEkycProvider {
  readonly providerId = "mock";

  /**
   * Look up a mock KRA record by PAN.
   * Returns null for any PAN not starting with a known prefix (simulates "not found").
   */
  async lookupByPan(panNumber: string): Promise<KraKycRecord | null> {
    const startTs = Date.now();
    const maskedPan = `${panNumber.slice(0, 5)}****`;

    logger.info({
      event: "MOCK_EKYC_KRA_LOOKUP",
      provider: this.providerId,
      doc_id: maskedPan,
    });

    // Simulate network latency
    await this.delay(50);

    const prefix = panNumber.slice(0, 5).toUpperCase();
    const record = MOCK_KRA_RECORDS[prefix] ?? null;

    logger.info({
      event: "MOCK_EKYC_KRA_LOOKUP_RESULT",
      provider: this.providerId,
      doc_id: maskedPan,
      found: !!record,
      kycStatus: record?.kycStatus ?? "not_found",
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return record;
  }

  /**
   * Initiate mock OTP session. Always succeeds, returns static sessionId.
   * OTP to use: "123456". Session expires in 10 minutes.
   */
  async initiateVerification(input: EkycInput): Promise<EkycSession> {
    const startTs = Date.now();
    const maskedPan = `${input.panNumber.slice(0, 5)}****`;

    logger.info({
      event: "MOCK_EKYC_OTP_INITIATE",
      provider: this.providerId,
      doc_id: maskedPan,
      // Aadhaar NEVER logged — not even last 4
    });

    await this.delay(80);

    const sessionId = `mock-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    MOCK_OTP_SESSIONS.set(sessionId, {
      pan: input.panNumber,
      aadhaar: input.aadhaarNumber,
      expiresAt,
    });

    logger.info({
      event: "MOCK_EKYC_OTP_SENT",
      provider: this.providerId,
      session_id: sessionId,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return {
      sessionId,
      status: "otp_sent",
      message: "[MOCK] OTP sent to Aadhaar-linked mobile. Use '123456' in sandbox.",
      maskedAadhaar: input.aadhaarNumber
        ? `XXXX XXXX ${input.aadhaarNumber.slice(-4)}`
        : undefined,
      expiresAt,
    };
  }

  /**
   * Verify mock OTP. Accepts "123456" as valid OTP.
   * Throws for wrong OTP (non-retryable after 3 attempts simulated by caller).
   */
  async verifyOtp(sessionId: string, otp: string): Promise<EkycVerifiedData> {
    const startTs = Date.now();

    logger.info({
      event: "MOCK_EKYC_OTP_VERIFY",
      provider: this.providerId,
      session_id: sessionId,
    });

    await this.delay(100);

    const session = MOCK_OTP_SESSIONS.get(sessionId);
    if (!session) {
      const err = Object.assign(
        new Error("OTP session not found or already used"),
        { retryable: false, error_code: "SESSION_NOT_FOUND" }
      );
      throw err;
    }

    if (new Date() > session.expiresAt) {
      MOCK_OTP_SESSIONS.delete(sessionId);
      const err = Object.assign(
        new Error("OTP session expired — please re-initiate"),
        { retryable: true, error_code: "SESSION_EXPIRED" }
      );
      throw err;
    }

    if (otp !== MOCK_OTP) {
      const err = Object.assign(
        new Error("Invalid OTP — use '123456' in mock mode"),
        { retryable: true, error_code: "OTP_INVALID" }
      );
      throw err;
    }

    MOCK_OTP_SESSIONS.delete(sessionId);

    const verifiedData: EkycVerifiedData = {
      fullLegalName: "MOCK USER ONE",
      dateOfBirth: "1990-01-15",
      gender: "M",
      aadhaarLast4: session.aadhaar?.slice(-4) ?? "1234",
      fatherName: "MOCK FATHER NAME",
      address: {
        houseNumber: "42",
        street: "Mock Street",
        landmark: "Near Mock Building",
        locality: "Mock Locality",
        city: "Mumbai",
        district: "Mumbai City",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
      },
      mobile: "9999999999",
      email: "mock.user@fintekpro.test",
      photoUrl: "https://via.placeholder.com/200x200?text=Mock+Photo",
    };

    logger.info({
      event: "MOCK_EKYC_OTP_VERIFIED",
      provider: this.providerId,
      session_id: sessionId,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return verifiedData;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const mockEkycProvider = new MockEkycProvider();
