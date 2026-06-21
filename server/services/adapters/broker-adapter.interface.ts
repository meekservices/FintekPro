/**
 * BrokerAdapter — Interface for all broker KYC submission adapters
 *
 * Every broker adapter (IIFL, JM Financial, Alpaca) implements this contract.
 * Separates field-mapping config from HTTP/auth logic — a broker renaming a
 * field requires only a JSON config update, not code changes.
 *
 * FASP-AI GCR Rules enforced here:
 *  - idempotencyKey MUST be checked before any outbound call
 *  - Consent MUST be recorded before this interface is invoked (enforced at orchestrator)
 *  - SSN/ITIN MUST never appear in logs (log doc_id, not value)
 *  - Every call emits structured { event, user_id, latency_ms, status }
 */

export interface CanonicalKycProfile {
  userId: string;
  // Identity
  fullLegalName?: string;
  dateOfBirth?: string;
  gender?: "M" | "F" | "O";
  nationality?: string;
  taxResidencyCountries?: string[];
  // Government ID
  panNumber?: string;        // de-tokenized from vault when needed
  aadhaarLast4?: string;     // display only
  govtIdType?: string;
  govtIdDocumentRef?: string;
  photoDocumentRef?: string;
  signatureDocumentRef?: string;
  // Contact
  mobileNumber?: string;
  email?: string;
  currentAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  permanentAddress?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    country?: string;
  };
  // Financial profile
  occupation?: string;
  annualIncomeBand?: string;
  netWorthBand?: string;
  sourceOfFunds?: string;
  tradingExperienceYears?: number;
  riskProfileCategory?: string;
  investmentObjective?: string;
  // India-specific
  bankAccountNumber?: string;  // decrypted on demand
  ifscCode?: string;
  dematAccountLinked?: boolean;
  segmentActivations?: Record<string, string[]>;
  nomineeDetails?: Record<string, unknown>;
  // US-specific (Alpaca) — NEVER log SSN/ITIN
  ssnOrItin?: string;          // decrypted, passed to adapter ONLY, never logged
  usPersonStatus?: string;
  w8BenOrW9DocumentRef?: string;
  fatcaCrsClassification?: string;
  usEmploymentStatus?: string;
  brokerDealerAffiliationDisclosure?: boolean;
  // Provenance (read-only for adapters)
  provenanceMetadata?: Record<string, FieldProvenance>;
}

export interface FieldProvenance {
  source: string;           // "iris_kra" | "broker:{id}" | "user_entered"
  verified_at?: string;
  verification_method?: string;
  confidence_score?: number;
  expiry_date?: string;
  last_synced_at?: string;
}

export interface BrokerSubmitResult {
  /** Broker-assigned account/client ID */
  brokerClientId: string;
  /** Current status from broker: "pending" | "approved" | "rejected" | "action_required" */
  status: string;
  /** Key for retrieving raw response from object storage */
  rawResponseRef: string;
  /** Any canonical fields the broker verified (for write-back) */
  canonicalWriteBack?: Partial<CanonicalKycProfile>;
}

export interface BrokerStatusResult {
  status: string;
  details?: Record<string, unknown>;
  /** ISO timestamp of last status update from broker */
  lastUpdatedAt?: string;
}

/**
 * BrokerAdapter — all broker integrations implement this.
 *
 * Purpose: Submit KYC to a broker, get status, and write broker-verified data back.
 * Inputs: Canonical KYC profile + broker-specific delta + idempotency key
 * Outputs: BrokerSubmitResult, BrokerStatusResult, partial canonical profile
 *
 * Edge cases:
 *  - Duplicate call with same idempotency key → caller returns cached response (enforced at guard layer)
 *  - Broker API down → throw with { retryable: true }
 *  - Field validation failure from broker → throw with { retryable: false, error_code }
 */
export interface BrokerAdapter {
  /** Broker identifier matching broker-schemas JSON file names */
  readonly brokerId: string;
  readonly brokerName: string;

  /**
   * Submit KYC to broker.
   *
   * @param canonicalProfile - Full canonical vault profile (relevant fields only)
   * @param brokerDelta - Broker-specific fields not in canonical profile
   * @param idempotencyKey - sha256(userId + brokerId + payloadVersion) — checked by caller
   * @returns BrokerSubmitResult with brokerClientId and status
   * @throws Error with { retryable: boolean, error_code: string }
   */
  submitKyc(
    canonicalProfile: CanonicalKycProfile,
    brokerDelta: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<BrokerSubmitResult>;

  /**
   * Poll submission status from broker.
   *
   * @param brokerClientId - returned by submitKyc
   * @returns Current status and details
   */
  getStatus(brokerClientId: string): Promise<BrokerStatusResult>;

  /**
   * Map broker response fields back to canonical vault format.
   * Used for write-back when broker performs additional verifications
   * (e.g. bank account verification, address CIBIL check).
   *
   * @param brokerResponse - Raw broker API response
   * @returns Partial canonical fields to update in vault
   */
  mapToCanonical(
    brokerResponse: unknown
  ): Promise<Partial<CanonicalKycProfile>>;
}
