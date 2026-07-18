/**
 * IrisKycAdapter — IRIS KFintech as the base eKYC / KRA provider
 *
 * Purpose:  Adapts the IRIS KFintech API to the BaseEkycProvider interface,
 *           making IRIS the preferred KYC source for investor onboarding when
 *           IRIS credentials are configured in the environment.
 *
 * Provider code: "iris"
 * Priority:      Above TruthScreen, below direct KRA (when configured)
 *
 * Inputs:   PAN (mandatory), Aadhaar (for OTP initiation, never stored)
 * Outputs:  KraKycRecord, EkycSession, EkycVerifiedData
 * Edge cases:
 *   - IRIS not configured → throws, caller falls through to next adapter
 *   - PAN not found in IRIS → returns null (not registered investor yet)
 *   - IRIS eKYC link triggers email/SMS — OTP is handled externally by IRIS portal
 *
 * FASP-AI GCR: PAN masked in all logs, no Aadhaar stored.
 */

import {
  BaseEkycProvider,
  EkycInput,
  EkycSession,
  EkycVerifiedData,
  KraKycRecord,
} from "../base-ekyc/base-ekyc-provider.interface";
import { irisKfintechService } from "../iris-kfintech-service";
import { logger } from "../../logger";


function maskPan(pan: string): string {
  return pan ? pan.slice(0, 5) + "*****" : "UNKNOWN";
}

function log(
  event: string,
  extra: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
): void {
  const entry = JSON.stringify({
    event,
    service: "IrisKycAdapter",
    timestamp: new Date().toISOString(),
    ...extra,
  });
  if (level === "error") logger.error(entry);
  else if (level === "warn") logger.warn(entry);
  else logger.info(entry);
}

export class IrisKycAdapter implements BaseEkycProvider {
  readonly providerId = "iris";

  /**
   * Look up investor KYC record from IRIS by PAN.
   * Maps IRIS KYC response to canonical KraKycRecord shape.
   *
   * @param panNumber - Verified PAN (uppercase)
   * @returns KraKycRecord if investor exists in IRIS, null if not found
   */
  async lookupByPan(panNumber: string): Promise<KraKycRecord | null> {
    const start = Date.now();
    if (!irisKfintechService.isConfigured) {
      throw new Error("IRIS not configured — cannot use IrisKycAdapter");
    }

    try {
      const kyc = await irisKfintechService.getInvestorKycDetails(panNumber);
      if (!kyc || kyc.error) {
        log("IRIS_KYC_LOOKUP_NOT_FOUND", {
          pan_masked: maskPan(panNumber),
          latency_ms: Date.now() - start,
        }, "warn");
        return null;
      }

      const status = this.mapKycStatus(kyc.kycStatus ?? kyc.status ?? kyc.ekycStatus);

      log("IRIS_KYC_LOOKUP_OK", {
        pan_masked: maskPan(panNumber),
        status,
        latency_ms: Date.now() - start,
      });

      return {
        kraKinNumber:      kyc.kraKinNumber ?? kyc.ckycNumber ?? kyc.kinNumber ?? panNumber,
        dateOfBirth:       kyc.dateOfBirth ?? kyc.dob ?? "",
        fullLegalName:     kyc.fullName ?? kyc.name ?? kyc.investorName ?? "",
        gender:            this.mapGender(kyc.gender),
        aadhaarLast4:      kyc.aadhaarLast4 ?? null,
        kycStatus:         status,
        kycVerifiedAt:     kyc.kycVerifiedAt ?? kyc.kycDate ?? new Date().toISOString(),
        kycExpiryDate:     kyc.kycExpiryDate ?? null,
        nationality:       kyc.nationality ?? "IN",
        verificationMethod: this.mapVerificationMethod(kyc.kycMode ?? kyc.verificationMethod),
      };
    } catch (err: any) {
      // 404-style responses mean investor not found — return null (not a hard error)
      if (err?.response?.status === 404 || err?.status === 404) {
        log("IRIS_KYC_LOOKUP_NOT_FOUND", { pan_masked: maskPan(panNumber), latency_ms: Date.now() - start }, "warn");
        return null;
      }
      log("IRIS_KYC_LOOKUP_ERROR", { pan_masked: maskPan(panNumber), error: err.message, latency_ms: Date.now() - start }, "error");
      throw err;
    }
  }

  /**
   * Initiate eKYC via IRIS — sends an eKYC link to investor's registered mobile/email.
   * IRIS handles the OTP delivery externally (unlike direct Aadhaar OTP flow).
   *
   * @param input - PAN + optional Aadhaar
   * @returns EkycSession with a synthetic sessionId tied to the PAN
   */
  async initiateVerification(input: EkycInput): Promise<EkycSession> {
    const start = Date.now();
    if (!irisKfintechService.isConfigured) {
      throw new Error("IRIS not configured — cannot initiate eKYC");
    }

    log("IRIS_KYC_INITIATE", { pan_masked: maskPan(input.panNumber) });

    const result = await irisKfintechService.sendEkycMail(input.panNumber);

    log("IRIS_KYC_INITIATE_OK", {
      pan_masked: maskPan(input.panNumber),
      latency_ms: Date.now() - start,
    });

    return {
      sessionId:    `iris-ekyc-${input.panNumber}-${Date.now()}`,
      status:       "otp_sent",
      message:      result?.message ?? "eKYC link sent to registered mobile/email via IRIS",
      maskedAadhaar: undefined,
      expiresAt:    new Date(Date.now() + 30 * 60 * 1000), // 30 min
    };
  }

  /**
   * OTP verification is handled externally by the IRIS investor portal.
   * This method returns the current KYC status after investor completes eKYC.
   * Callers should poll getEkycStatus via the /api/iris/kyc/:pan/status route.
   *
   * @param sessionId - from initiateVerification (contains PAN)
   * @param otp - not used directly; IRIS verifies OTP on their end
   */
  async verifyOtp(sessionId: string, _otp: string): Promise<EkycVerifiedData> {
    // Extract PAN from synthetic sessionId
    const panMatch = sessionId.match(/^iris-ekyc-([A-Z0-9]+)-\d+$/);
    if (!panMatch) {
      throw Object.assign(
        new Error("Invalid IRIS eKYC session ID format"),
        { retryable: false },
      );
    }
    const pan = panMatch[1];
    const start = Date.now();

    log("IRIS_KYC_VERIFY_OTP_CHECK", { pan_masked: maskPan(pan) });

    const [ekycStatus, details] = await Promise.allSettled([
      irisKfintechService.getEkycStatus(pan),
      irisKfintechService.getInvestorDetails(pan),
    ]);

    const status = ekycStatus.status === "fulfilled" ? ekycStatus.value : null;
    const profile = details.status === "fulfilled" ? details.value : null;

    if (!status || !this.isEkycComplete(status)) {
      throw Object.assign(
        new Error("IRIS eKYC not yet completed — investor must complete eKYC via the link"),
        { retryable: true },
      );
    }

    log("IRIS_KYC_VERIFY_OTP_OK", { pan_masked: maskPan(pan), latency_ms: Date.now() - start });

    return {
      fullLegalName: profile?.name ?? profile?.fullName ?? profile?.investorName ?? "",
      dateOfBirth:   profile?.dateOfBirth ?? profile?.dob ?? "",
      gender:        this.mapGender(profile?.gender) as "M" | "F" | "O",
      aadhaarLast4:  profile?.aadhaarLast4 ?? "0000",
      fatherName:    profile?.fatherName ?? undefined,
      address: {
        houseNumber: profile?.address?.houseNumber ?? "",
        street:      profile?.address?.street ?? profile?.address?.addressLine1 ?? "",
        landmark:    profile?.address?.landmark ?? undefined,
        locality:    profile?.address?.locality ?? "",
        city:        profile?.address?.city ?? "",
        district:    profile?.address?.district ?? profile?.address?.city ?? "",
        state:       profile?.address?.state ?? "",
        pincode:     profile?.address?.pincode ?? profile?.address?.zipCode ?? "",
        country:     profile?.address?.country ?? "India",
      },
      mobile: profile?.mobile ?? undefined,
      email:  profile?.email ?? undefined,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private mapKycStatus(raw: string | undefined): "active" | "expired" | "deactivated" {
    if (!raw) return "active";
    const s = raw.toLowerCase();
    if (s.includes("active") || s.includes("verified") || s.includes("completed")) return "active";
    if (s.includes("expir")) return "expired";
    return "deactivated";
  }

  private mapGender(raw: string | undefined): "M" | "F" | "O" {
    if (!raw) return "O";
    const g = raw.toUpperCase();
    if (g === "M" || g === "MALE") return "M";
    if (g === "F" || g === "FEMALE") return "F";
    return "O";
  }

  private mapVerificationMethod(raw: string | undefined): KraKycRecord["verificationMethod"] {
    if (!raw) return "manual";
    const m = raw.toLowerCase();
    if (m.includes("ekyc") || m.includes("otp") || m.includes("aadhaar")) return "ekyc_otp";
    if (m.includes("biometric")) return "biometric";
    if (m.includes("document") || m.includes("upload")) return "document_upload";
    return "manual";
  }

  private isEkycComplete(status: any): boolean {
    if (!status) return false;
    const s = typeof status === "string"
      ? status.toLowerCase()
      : JSON.stringify(status).toLowerCase();
    return s.includes("complete") || s.includes("verified") || s.includes("success");
  }
}

/** Singleton — loaded lazily when first requested */
let _instance: IrisKycAdapter | null = null;
export function getIrisKycAdapter(): IrisKycAdapter {
  if (!_instance) _instance = new IrisKycAdapter();
  return _instance;
}
