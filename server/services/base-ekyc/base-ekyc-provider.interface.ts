/**
 * BaseEkycProvider — Interface for base eKYC / KRA integration
 *
 * This interface abstracts the KYC Registration Agency (KRA) data access path.
 * Per the compliance blocker in the build spec (Section 3), direct KRA API access
 * requires a SEBI-registered intermediary agreement. Until the access path is
 * confirmed (direct KRA vs. broker-partner routing), this interface is backed by
 * a mock provider.
 *
 * Real providers: set BASE_EKYC_PROVIDER=iris_kra (or similar) in env once confirmed.
 * Mock provider:  BASE_EKYC_PROVIDER=mock (default for all environments until confirmed).
 *
 * FASP-AI GCR Rule: No real PII is passed through this interface in mock mode.
 * Every implementing provider must mask PAN in logs (log doc_id only, not value).
 */

export interface KraKycRecord {
  /** Canonical KIN / CKYC number */
  kraKinNumber: string;
  /** ISO date string */
  dateOfBirth: string;
  fullLegalName: string;
  gender: "M" | "F" | "O";
  /** Last 4 of Aadhaar — never full number */
  aadhaarLast4: string | null;
  /** Whether the KYC is active and not expired */
  kycStatus: "active" | "expired" | "deactivated";
  /** ISO date string */
  kycVerifiedAt: string;
  kycExpiryDate: string | null;
  nationality: string;
  /** Verification method used at source */
  verificationMethod: "ekyc_otp" | "biometric" | "document_upload" | "manual";
}

export interface EkycInput {
  /** PAN number — used for KRA lookup. Must match regex /^[A-Z]{5}[0-9]{4}[A-Z]$/ */
  panNumber: string;
  /** Aadhaar (12 digits) — only used for OTP-based eKYC, never stored in plaintext */
  aadhaarNumber?: string;
}

export interface EkycSession {
  /** Session / reference ID for subsequent OTP verification */
  sessionId: string;
  /** Human-readable step — "otp_sent" | "otp_pending" | "mock_auto_verified" */
  status: string;
  message: string;
  /** Masked Aadhaar for display only, e.g. "XXXX XXXX 1234" */
  maskedAadhaar?: string;
  /** Expiry of this OTP session */
  expiresAt: Date;
}

export interface EkycVerifiedData {
  /** Full verified identity data from the eKYC session */
  fullLegalName: string;
  dateOfBirth: string;
  gender: "M" | "F" | "O";
  /** Last 4 only — never full Aadhaar */
  aadhaarLast4: string;
  fatherName?: string;
  address: {
    houseNumber: string;
    street: string;
    landmark?: string;
    locality: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    country: string;
  };
  mobile?: string;
  email?: string;
  /** URL to photo from eKYC (used for face hash only, not stored) */
  photoUrl?: string;
}

/**
 * BaseEkycProvider — all KRA/eKYC integrations implement this contract.
 *
 * Purpose:  Abstract the KYC Registration Agency (KRA) data access path.
 * Inputs:   PAN, Aadhaar (for OTP flow), session ID
 * Outputs:  KraKycRecord, EkycSession, EkycVerifiedData
 * Edge cases:
 *   - PAN not found in KRA: lookupByPan returns null
 *   - OTP expired: verifyOtp throws with retryable: true
 *   - KYC expired in KRA: kycStatus = "expired", caller must trigger refresh
 */
export interface BaseEkycProvider {
  /** Provider identifier for logs */
  readonly providerId: string;

  /**
   * Look up KRA record by PAN.
   * @param panNumber - verified PAN, uppercase
   * @returns KRA record if found, null if not registered
   */
  lookupByPan(panNumber: string): Promise<KraKycRecord | null>;

  /**
   * Initiate eKYC OTP session (Aadhaar OTP flow).
   * @param input - PAN + Aadhaar for OTP delivery
   * @returns Session object with sessionId for subsequent verifyOtp call
   */
  initiateVerification(input: EkycInput): Promise<EkycSession>;

  /**
   * Verify OTP and retrieve Aadhaar data.
   * @param sessionId - from initiateVerification
   * @param otp - 6-digit OTP sent to Aadhaar-linked mobile
   * @returns Verified identity data
   * @throws Error with { retryable: boolean } if OTP invalid/expired
   */
  verifyOtp(sessionId: string, otp: string): Promise<EkycVerifiedData>;
}
