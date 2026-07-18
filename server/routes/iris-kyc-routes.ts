import { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { db } from "../db";
import { users, kycVault } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  writeIrisKycToVault,
} from "../services/kyc/iris-kyc-vault-writeback-service";
import { logger } from "../logger";


/**
 * IRIS KYC Unified Surface — /api/iris/kyc/*
 *
 * This module wires IRIS as the base KYC provider for the portal onboarding flow.
 * All routes require agent-level auth and emit structured logs for SEBI audit.
 *
 * Routes:
 *   POST /api/iris/kyc/:pan/initiate         — send eKYC OTP link via IRIS
 *   GET  /api/iris/kyc/:pan/status           — eKYC + CKYC combined status
 *   POST /api/iris/kyc/:pan/fatca            — submit FATCA declaration
 *   GET  /api/iris/kyc/:pan/documents        — list KYC documents from IRIS
 *   POST /api/iris/kyc/:pan/send-link        — resend eKYC link
 *   GET  /api/iris/kyc/:pan/investor-profile — full investor profile from IRIS
 *   GET  /api/iris/kyc/:pan/details          — KYC details object
 */

function kycLog(
  event: string,
  extra: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
) {
  const entry = {
    event,
    service: "iris-kyc",
    timestamp: new Date().toISOString(),
    ...extra,
  };
  if (level === "error") logger.error(JSON.stringify(entry));
  else if (level === "warn") logger.warn(JSON.stringify(entry));
  else logger.info(JSON.stringify(entry));
}

function maskPan(pan: string): string {
  return pan ? pan.slice(0, 5) + "*****" : "UNKNOWN";
}

function wrapKyc(
  res: any,
  fn: () => Promise<any>,
  event: string,
  pan: string,
  userId?: string,
): Promise<void> {
  const startMs = Date.now();
  return fn()
    .then((data) => {
      kycLog(event, {
        pan_masked: maskPan(pan),
        user_id: userId,
        latency_ms: Date.now() - startMs,
        status: "success",
      });
      res.json({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          version: "iris-kyc-v1",
          engine_version: "iris_kfintech",
          pan_masked: maskPan(pan),
        },
      });
    })
    .catch((err: any) => {
      kycLog(
        event + "_ERROR",
        {
          pan_masked: maskPan(pan),
          user_id: userId,
          latency_ms: Date.now() - startMs,
          error: err.message,
          status: "error",
        },
        "error",
      );
      res.status(err.status ?? 502).json({
        success: false,
        error: {
          error_code: "IRIS_KYC_ERROR",
          message: err.message,
          retryable: true,
        },
        meta: { timestamp: new Date().toISOString(), version: "iris-kyc-v1" },
      });
    });
}

export function registerIrisKycRoutes(app: Express): void {
  /**
   * POST /api/iris/kyc/:pan/initiate
   * Initiates eKYC for the investor via IRIS (sends OTP/link to registered mobile).
   * Used by agent during new client onboarding.
   */
  app.post(
    "/api/iris/kyc/:pan/initiate",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      kycLog("IRIS_KYC_INITIATE", { pan_masked: maskPan(pan), user_id: userId });
      return wrapKyc(
        res,
        () => irisKfintechService.sendEkycMail(pan),
        "IRIS_KYC_INITIATE",
        pan,
        userId,
      );
    },
  );

  /**
   * GET /api/iris/kyc/:pan/status
   * Returns combined eKYC + CKYC status for a PAN from IRIS.
   * Used by portal to show onboarding progress bar.
   */
  app.get(
    "/api/iris/kyc/:pan/status",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      return wrapKyc(
        res,
        async () => {
          const [ekycStatus, kycDetails] = await Promise.allSettled([
            irisKfintechService.getEkycStatus(pan),
            irisKfintechService.getInvestorKycDetails(pan),
          ]);
          return {
            ekyc: ekycStatus.status === "fulfilled" ? ekycStatus.value : null,
            kyc: kycDetails.status === "fulfilled" ? kycDetails.value : null,
            ekycError: ekycStatus.status === "rejected" ? ekycStatus.reason?.message : null,
            kycError: kycDetails.status === "rejected" ? kycDetails.reason?.message : null,
          };
        },
        "IRIS_KYC_STATUS",
        pan,
        userId,
      );
    },
  );

  /**
   * POST /api/iris/kyc/:pan/fatca
   * Submit FATCA declaration for investor.
   * Required for NPS contributions and certain MF transactions.
   */
  app.post(
    "/api/iris/kyc/:pan/fatca",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      const body = req.body;
      if (!body || !body.taxResidencyCountry) {
        return res.status(400).json({
          success: false,
          error: {
            error_code: "FATCA_MISSING_FIELDS",
            message: "taxResidencyCountry is required in body",
            retryable: false,
          },
        });
      }
      kycLog("IRIS_KYC_FATCA", { pan_masked: maskPan(pan), user_id: userId });
      return wrapKyc(
        res,
        () => irisKfintechService.call(`/non-financial/${pan}/fatca`, "POST", body),
        "IRIS_KYC_FATCA",
        pan,
        userId,
      );
    },
  );

  /**
   * GET /api/iris/kyc/:pan/documents
   * List uploaded KYC documents for investor from IRIS document vault.
   */
  app.get(
    "/api/iris/kyc/:pan/documents",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      return wrapKyc(
        res,
        () => irisKfintechService.call(`/user/investors/${pan}/documents`),
        "IRIS_KYC_DOCUMENTS",
        pan,
        userId,
      );
    },
  );

  /**
   * POST /api/iris/kyc/:pan/send-link
   * Re-send eKYC link to investor's registered mobile/email.
   * Agent can trigger this if client hasn't completed eKYC.
   */
  app.post(
    "/api/iris/kyc/:pan/send-link",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      return wrapKyc(
        res,
        () => irisKfintechService.sendEkycMail(pan),
        "IRIS_KYC_SEND_LINK",
        pan,
        userId,
      );
    },
  );

  /**
   * GET /api/iris/kyc/:pan/investor-profile
   * Full investor profile from IRIS — identity, KYC level, bank, demat.
   * Used as the single source of truth for onboarded investors.
   */
  app.get(
    "/api/iris/kyc/:pan/investor-profile",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      return wrapKyc(
        res,
        async () => {
          const [profile, kyc, demat] = await Promise.allSettled([
            irisKfintechService.getInvestorDetails(pan),
            irisKfintechService.getInvestorKycDetails(pan),
            irisKfintechService.call(`/user/investors/${pan}/demat-accounts`),
          ]);
          return {
            profile: profile.status === "fulfilled" ? profile.value : null,
            kyc: kyc.status === "fulfilled" ? kyc.value : null,
            demat: demat.status === "fulfilled" ? demat.value : null,
          };
        },
        "IRIS_KYC_INVESTOR_PROFILE",
        pan,
        userId,
      );
    },
  );

  /**
   * GET /api/iris/kyc/:pan/details
   * Raw KYC details object — for deep inspection by admin/compliance.
   */
  app.get(
    "/api/iris/kyc/:pan/details",
    requireAuth,
    async (req, res) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      return wrapKyc(
        res,
        () => irisKfintechService.getInvestorKycDetails(pan),
        "IRIS_KYC_DETAILS",
        pan,
        userId,
      );
    },
  );

  /**
   * POST /api/iris/kyc/:pan/write-to-vault
   *
   * *** CORE MULTI-BROKER KYC REUSE ENDPOINT ***
   *
   * After a client completes KYC via IRIS, call this to write the verified
   * identity data into the canonical KYC Vault. Once written:
   *
   *   - ALL other brokers (IIFL, JM Financial, Alpaca, BSE Star, etc.)
   *     read from the vault via the diff engine and prefill their KYC forms.
   *   - Client is NEVER asked to re-enter name, DOB, address, bank, etc.
   *   - Each broker only sees a delta form for broker-specific fields
   *     (e.g. segment activation, broker T&C consent).
   *
   * Body (optional):
   *   { forceRefresh: boolean } — force re-write even if vault is current
   *
   * Response:
   *   { success, fieldsWritten, isReusable, alreadyCurrent }
   */
  app.post(
    "/api/iris/kyc/:pan/write-to-vault",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const agentId = (req as any).user?.id;
      const startMs = Date.now();
      const panMasked = maskPan(pan);
      const forceRefresh = req.body?.forceRefresh === true;

      kycLog("IRIS_KYC_WRITE_TO_VAULT", { pan_masked: panMasked, agent_id: agentId, force_refresh: forceRefresh });

      // Resolve userId from PAN (look up user by pan field)
      let userId: string | null = null;
      try {
        const [userRow] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.panNumber, pan.toUpperCase()))
          .limit(1);
        userId = userRow?.id ?? null;
      } catch { /* PAN lookup failed */ }

      // If user not found by PAN, use the requesting agent's ID as a fallback
      // (allows agents to pre-populate vault for prospects they manage)
      if (!userId) {
        userId = agentId;
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: { error_code: "USER_NOT_FOUND", message: "Could not resolve user from PAN. Ensure the client has a FintekPro account.", retryable: false },
          meta: { timestamp: new Date().toISOString(), version: "iris-kyc-v1" },
        });
      }

      const result = await writeIrisKycToVault(userId, pan, { agentId, forceRefresh });

      kycLog("IRIS_KYC_WRITE_TO_VAULT_RESULT", {
        pan_masked: panMasked,
        agent_id: agentId,
        user_id: userId,
        success: result.success,
        fields_count: result.fieldsWritten.length,
        is_reusable: result.isReusable,
        already_current: result.alreadyCurrent,
        latency_ms: Date.now() - startMs,
        status: result.success ? "success" : "error",
      });

      if (!result.success) {
        return res.status(502).json({
          success: false,
          error: { error_code: "VAULT_WRITEBACK_FAILED", message: result.error, retryable: true },
          meta: { timestamp: new Date().toISOString(), version: "iris-kyc-v1" },
        });
      }

      res.json({
        success: true,
        data: {
          fieldsWritten: result.fieldsWritten,
          fieldsCount:   result.fieldsWritten.length,
          isReusable:    result.isReusable,
          alreadyCurrent: result.alreadyCurrent ?? false,
          vaultUpdated:  !result.alreadyCurrent,
          message: result.alreadyCurrent
            ? "Vault already current — no update needed"
            : `${result.fieldsWritten.length} fields written to canonical vault. All broker adapters will now prefill from IRIS KYC.`,
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: "iris-kyc-v1",
          pan_masked: panMasked,
          latency_ms: Date.now() - startMs,
        },
      });
    },
  );

  /**
   * GET /api/iris/kyc/:pan/vault-status
   *
   * Returns the current state of the canonical KYC vault for this PAN/user.
   * Shows which fields are populated, their provenance (source), and whether
   * the vault is reusable by other brokers.
   *
   * Used by the agent portal to show "KYC Reuse Ready" status before
   * initiating broker onboarding.
   */
  app.get(
    "/api/iris/kyc/:pan/vault-status",
    requireAuth,
    async (req: Request, res: Response) => {
      const { pan } = req.params;
      const userId = (req as any).user?.id;
      const startMs = Date.now();
      const panMasked = maskPan(pan);

      try {
        // Try to find user by PAN first
        let targetUserId = userId;
        try {
          const [userRow] = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.panNumber, pan.toUpperCase()))
            .limit(1);
          if (userRow?.id) targetUserId = userRow.id;
        } catch { /* use requesting user id */ }

        const [vault] = await db
          .select({
            kycStatus:          kycVault.kycStatus,
            ckycStatus:         kycVault.ckycStatus,
            isReusable:         kycVault.isReusable,
            source:             kycVault.source,
            verificationMethod: kycVault.verificationMethod,
            kycVerifiedAt:      kycVault.kycVerifiedAt,
            kycExpiryDate:      kycVault.kycExpiryDate,
            provenanceMetadata: kycVault.provenanceMetadata,
            segmentActivations: kycVault.segmentActivations,
            aadhaarLast4:       kycVault.aadhaarLast4,
            // Presence checks (not decrypted values)
            hasName:    kycVault.encryptedFullName,
            hasDob:     kycVault.encryptedDateOfBirth,
            hasAddress: kycVault.encryptedAddress,
            hasMobile:  kycVault.encryptedMobile,
            hasEmail:   kycVault.encryptedEmail,
            hasBankAcc: kycVault.encryptedBankAccountNumber,
          })
          .from(kycVault)
          .where(eq(kycVault.userId, targetUserId))
          .limit(1);

        kycLog("IRIS_KYC_VAULT_STATUS", { pan_masked: panMasked, user_id: targetUserId, found: !!vault, latency_ms: Date.now() - startMs, status: "success" });

        if (!vault) {
          return res.json({
            success: true,
            data: {
              vaultExists: false,
              isReusable: false,
              fieldsPopulated: [],
              irisKycFields: [],
              message: "No vault record found. Run POST /api/iris/kyc/:pan/write-to-vault to populate from IRIS.",
            },
            meta: { timestamp: new Date().toISOString(), version: "iris-kyc-v1", pan_masked: panMasked },
          });
        }

        // Summarize provenance — which fields came from iris_kra
        const prov = (vault.provenanceMetadata ?? {}) as Record<string, { source?: string; verified_at?: string; expiry_date?: string }>;
        const irisKycFields = Object.entries(prov)
          .filter(([, p]) => p?.source === "iris_kra")
          .map(([field, p]) => ({ field, verifiedAt: p.verified_at, expiresAt: p.expiry_date }));

        const fieldsPopulated = [
          vault.hasName && "fullName",
          vault.hasDob && "dateOfBirth",
          vault.hasAddress && "address",
          vault.hasMobile && "mobile",
          vault.hasEmail && "email",
          vault.hasBankAcc && "bankAccount",
        ].filter(Boolean);

        res.json({
          success: true,
          data: {
            vaultExists:        true,
            kycStatus:          vault.kycStatus,
            ckycStatus:         vault.ckycStatus,
            isReusable:         vault.isReusable,
            source:             vault.source,
            verificationMethod: vault.verificationMethod,
            kycVerifiedAt:      vault.kycVerifiedAt,
            kycExpiryDate:      vault.kycExpiryDate,
            fieldsPopulated,
            irisKycFields,
            irisKycFieldCount:  irisKycFields.length,
            segmentActivations: vault.segmentActivations,
            aadhaarLast4:       vault.aadhaarLast4,
            brokerReuseReady:   vault.isReusable && irisKycFields.length >= 5,
            message: vault.isReusable
              ? `✅ KYC vault is reusable — ${irisKycFields.length} fields from IRIS. Other brokers will prefill automatically.`
              : `⚠️  KYC not yet reusable. Status: ${vault.kycStatus}. Complete IRIS eKYC first.`,
          },
          meta: { timestamp: new Date().toISOString(), version: "iris-kyc-v1", pan_masked: panMasked, latency_ms: Date.now() - startMs },
        });
      } catch (err: any) {
        kycLog("IRIS_KYC_VAULT_STATUS_ERROR", { pan_masked: panMasked, error: err.message }, "error" as any);
        res.status(500).json({
          success: false,
          error: { error_code: "VAULT_STATUS_ERROR", message: err.message, retryable: true },
          meta: { timestamp: new Date().toISOString(), version: "iris-kyc-v1" },
        });
      }
    },
  );
}

