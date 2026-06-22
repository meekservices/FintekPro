/**
 * AlpacaAdapter — Alpaca Broker API KYC Adapter
 *
 * Thin wrapper around the existing AlpacaBrokerService that implements
 * the BrokerAdapter interface. Key compliance constraint:
 *
 *   SSN/ITIN, W8-BEN/W9, FATCA/CRS, employment status, and suitability
 *   disclosures MUST always be provided as broker delta — NEVER prefilled
 *   from India KRA data. The mapToCanonical method enforces this boundary.
 *
 * Uses the existing alpaca-broker-service.ts (createBrokerAccount, uploadDocument,
 * getCip) — no new Alpaca API calls invented.
 *
 * Auth: ALPACA_API_KEY_ID + ALPACA_API_SECRET_KEY via env → Basic auth
 * Env:  ALPACA_ENV=paper (sandbox) | production
 */

import type {
  BrokerAdapter,
  BrokerStatusResult,
  BrokerSubmitResult,
  CanonicalKycProfile,
} from "./broker-adapter.interface";
import { alpacaBrokerService } from "../alpaca-broker-service";
import { logger } from "../../logger";
import crypto from "crypto";
import { checkLrsEligibility } from "../lrs-pre-submit-check";

// Fields that may ONLY come from broker delta — never auto-filled from vault for Alpaca
const ALPACA_ALWAYS_DELTA_FIELDS = new Set([
  "ssnOrItin",
  "usPersonStatus",
  "w8BenOrW9DocumentRef",
  "fatcaCrsClassification",
  "usEmploymentStatus",
  "brokerDealerAffiliationDisclosure",
  "taxResidencyCountries",
]);

// Fields that ARE prefillable from vault (genuine identity/contact fields)
const ALPACA_PREFILLABLE_FIELDS = new Set([
  "fullLegalName",
  "dateOfBirth",
  "email",
  "mobileNumber",
  "currentAddress",
]);

export class AlpacaAdapter implements BrokerAdapter {
  readonly brokerId = "alpaca";
  readonly brokerName = "Alpaca Broker API";

  /**
   * Submit KYC to Alpaca Broker API.
   *
   * Takes canonical profile (prefillable fields only) + broker delta
   * (SSN/ITIN and all US suitability fields — always required from user).
   *
   * CRITICAL: SSN/ITIN is passed in brokerDelta — it is decrypted by the
   * orchestrator immediately before this call and NEVER stored in plaintext.
   * This method does not log the SSN/ITIN value. It passes it to Alpaca only.
   */
  async submitKyc(
    profile: CanonicalKycProfile,
    brokerDelta: Record<string, unknown>,
    idempotencyKey: string
  ): Promise<BrokerSubmitResult> {
    const startTs = Date.now();

    // ── LRS / FATCA pre-submit HARD BLOCK ────────────────────────────────────
    // Must be the FIRST check — before any field boundary validation or
    // outbound HTTP. The LRS check is a regulatory hard block per RBI LRS
    // Master Directions and SEBI FATCA/CRS circular.
    // Do NOT gate this check on a UI flag — it must fire at the adapter layer.
    const lrsCheck = await checkLrsEligibility(profile.userId, 0);
    if (!lrsCheck.eligible) {
      logger.warn("BROKER_KYC_LRS_BLOCK", {
        event: "LRS_CHECK_BLOCK",
        broker_id: this.brokerId,
        user_id: profile.userId,
        error_code: lrsCheck.error_code,
        reason: lrsCheck.reason,
        ytd_amount_usd: lrsCheck.ytdAmountUsd,
        remaining_allowance_usd: lrsCheck.remainingAllowanceUsd,
        fatca_cert_present: lrsCheck.fatcaCertPresent,
        latency_ms: Date.now() - startTs,
        status: "blocked",
      });
      throw Object.assign(
        new Error(lrsCheck.reason ?? "LRS compliance block: submission not permitted"),
        { retryable: false, error_code: lrsCheck.error_code ?? "LRS_BLOCK" }
      );
    }

    logger.info("BROKER_KYC_SUBMIT", {
      broker_id: this.brokerId,
      user_id: profile.userId,
      idempotency_key: idempotencyKey,
      lrs_ytd_usd: lrsCheck.ytdAmountUsd,
      // SSN/ITIN NEVER logged — not even as doc_id
    });

    // Enforce field boundary: reject any attempt to pass ALWAYS_DELTA fields
    // from the prefilled portion (defensive guard in addition to orchestrator check)
    for (const field of ALPACA_ALWAYS_DELTA_FIELDS) {
      if ((profile as unknown as Record<string, unknown>)[field] !== undefined) {
        const err = Object.assign(
          new Error(
            `AlpacaAdapter: '${field}' must come from broker delta, not canonical profile. ` +
            "This field cannot be prefilled from India KRA data."
          ),
          { retryable: false, error_code: "FIELD_BOUNDARY_VIOLATION" }
        );
        logger.error("BROKER_KYC_FIELD_BOUNDARY_VIOLATION", {
          broker_id: this.brokerId,
          user_id: profile.userId,
          field,
          status: "error",
});
        throw err;
      }
    }

    const delta = brokerDelta as Record<string, unknown>;

    // Parse name into given/family
    const nameParts = (profile.fullLegalName ?? "").trim().split(/\s+/);
    const givenName  = nameParts[0] ?? "";
    const familyName = nameParts.slice(1).join(" ") || givenName;

    // Build agreements (required by Alpaca)
    const now = new Date().toISOString();
    const agreements = [
      { agreement: "customer_agreement", signed_at: now, ip_address: "0.0.0.0" },
      { agreement: "margin_agreement",   signed_at: now, ip_address: "0.0.0.0" },
    ];

    // Map current address to Alpaca contact format
    const addr = profile.currentAddress ?? {};

    // Build create-account payload
    const createPayload = {
      account_type: "trading" as const,
      contact: {
        email_address: profile.email ?? (delta.email as string) ?? "",
        phone_number:  profile.mobileNumber,
        street_address: [addr.line1, addr.line2].filter(Boolean) as string[],
        city:           addr.city ?? "",
        state:          addr.state,
        postal_code:    addr.pincode,
        country:        addr.country ?? "USA",
      },
      identity: {
        given_name:  givenName,
        family_name: familyName,
        date_of_birth: profile.dateOfBirth ?? "",
        // SSN from delta ONLY — never from profile
        tax_id:      delta.ssnOrItin as string,
        tax_id_type: (delta.taxIdType as string) ?? "USA_SSN",
        country_of_citizenship: (delta.countryOfCitizenship as string) ?? "USA",
        country_of_birth:       (delta.countryOfBirth as string) ?? "USA",
        country_of_tax_residence: (delta.countryOfTaxResidence as string) ?? "USA",
        funding_source: (delta.fundingSource as string[]) ?? ["employment_income"],
        annual_income_min: (delta.annualIncomeMin as string),
        annual_income_max: (delta.annualIncomeMax as string),
        liquid_net_worth_min: (delta.liquidNetWorthMin as string),
        liquid_net_worth_max: (delta.liquidNetWorthMax as string),
        total_net_worth_min:  (delta.totalNetWorthMin as string),
        total_net_worth_max:  (delta.totalNetWorthMax as string),
      },
      disclosures: {
        is_control_person:                 Boolean(delta.isControlPerson),
        is_affiliated_exchange_or_finra:   Boolean(delta.brokerDealerAffiliationDisclosure),
        is_politically_exposed:            Boolean(delta.isPoliticallyExposed),
        immediate_family_exposed:          Boolean(delta.immediateFamilyExposed),
      },
      agreements,
      // Documents array is handled separately via uploadDocument
      enabled_assets: ["us_equity"],
    };

    try {
      const account = await alpacaBrokerService.createBrokerAccount(createPayload);
      const rawResponseRef = `alpaca/submissions/${idempotencyKey}`;

      logger.info("BROKER_KYC_SUBMIT_SUCCESS", {
        broker_id: this.brokerId,
        user_id: profile.userId,
        broker_client_id: account.id,
        alpaca_account_number: account.account_number,
        alpaca_status: account.status,
        latency_ms: Date.now() - startTs,
        status: "success",
});

      return {
        brokerClientId: account.id,
        status: account.status,
        rawResponseRef,
        canonicalWriteBack: await this.mapToCanonical(account),
      };
    } catch (error: any) {
      const alpacaMsg = error.response?.data?.message ?? error.message;
      const isNetworkError = !error.response;
      logger.error("BROKER_KYC_SUBMIT_ERROR", {
        broker_id: this.brokerId,
        user_id: profile.userId,
        error_code: error.response?.data?.code ?? "NETWORK_ERROR",
        message: alpacaMsg,
        latency_ms: Date.now() - startTs,
        status: "error",
        retryable: isNetworkError,
});
      throw Object.assign(
        new Error(`Alpaca KYC submission failed: ${alpacaMsg}`),
        {
          retryable: isNetworkError,
          error_code: error.response?.data?.code ?? "NETWORK_ERROR",
        }
      );
    }
  }

  async getStatus(brokerClientId: string): Promise<BrokerStatusResult> {
    const startTs = Date.now();
    try {
      const account = await alpacaBrokerService.getAccount(brokerClientId);
      logger.info("BROKER_KYC_STATUS_CHECK", {
        broker_id: this.brokerId,
        broker_client_id: brokerClientId,
        status: account?.status,
        latency_ms: Date.now() - startTs,
        status_log: "success",
});
      return {
        status: account?.status ?? "unknown",
        details: {
          account_number: account?.account_number,
          kyc_results: account?.kyc_results,
        },
        lastUpdatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      throw Object.assign(
        new Error(`Alpaca status check failed: ${error.message}`),
        { retryable: true, error_code: "STATUS_CHECK_ERROR" }
      );
    }
  }

  /**
   * mapToCanonical — Map Alpaca account response back to canonical vault fields.
   *
   * CRITICAL boundary enforcement: This method will NEVER set India-specific
   * fields from Alpaca's response, and will NEVER set ssnOrItin back into the
   * canonical profile (it must stay in the vault's encrypted column only).
   */
  async mapToCanonical(
    brokerResponse: unknown
  ): Promise<Partial<CanonicalKycProfile>> {
    if (!brokerResponse || typeof brokerResponse !== "object") return {};
    const r = brokerResponse as Record<string, unknown>;

    // Only map genuinely safe, non-sensitive fields
    const canonical: Partial<CanonicalKycProfile> = {};

    // Alpaca may confirm contact details after CIP — safe to write back
    if (r.contact && typeof r.contact === "object") {
      const contact = r.contact as Record<string, unknown>;
      if (contact.email_address) canonical.email = contact.email_address as string;
      if (contact.phone_number)  canonical.mobileNumber = contact.phone_number as string;
    }

    // NEVER write back: tax_id, identity.tax_id, ssnOrItin, or any US-sensitive fields
    // The Alpaca account ID is stored in brokerSubmissions.brokerClientId, not here
    return canonical;
  }
}

export const alpacaAdapter = new AlpacaAdapter();
