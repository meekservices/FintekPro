import * as crypto from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { aaConsents, aaFiSessions } from "../../../shared/schema/finvu";
import { finvuFiService } from "./finvu-fi-service";
import { getFinvuWebhookSecret } from "../../utils/finvu-config";
import { logger } from "../../logger";

export interface RebitWebhookPayload {
  ver?: string;
  timestamp?: string;
  txnid?: string;
  ConsentStatusNotification?: {
    consentId?: string;
    consentHandle?: string;
    consentStatus?: string; // "ACTIVE" | "REJECTED" | "REVOKED" | "EXPIRED"
  };
  FIStatusNotification?: {
    sessionId?: string;
    sessionStatus?: string; // "COMPLETED" | "PARTIAL" | "FAILED"
    FIStatusResponse?: any[];
  };
}

export class FinvuWebhookHandler {
  /**
   * Validates inbound webhook signature using HMAC-SHA256
   */
  public verifySignature(rawBody: string, signatureHeader?: string): boolean {
    const secret = getFinvuWebhookSecret();
    if (!secret) {
      // In sandbox mode without configured webhook secret, log and allow
      return true;
    }

    if (!signatureHeader) {
      return false;
    }

    const computed = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    return crypto.timingSafeEqual(
      Buffer.from(computed, "utf-8"),
      Buffer.from(signatureHeader, "utf-8")
    );
  }

  /**
   * Processes ReBIT webhook notification payloads asynchronously
   */
  public async handleNotification(payload: RebitWebhookPayload): Promise<{
    processed: boolean;
    type: "CONSENT" | "FI_DATA" | "UNKNOWN";
    status: string;
  }> {
    // 1. Consent Status Notification
    if (payload.ConsentStatusNotification) {
      const { consentHandle, consentId, consentStatus } =
        payload.ConsentStatusNotification;

      logger.info(
        `[FinvuWebhook] Received Consent notification for handle: ${consentHandle}, status: ${consentStatus}`
      );

      if (consentHandle) {
        const [consent] = await db
          .select()
          .from(aaConsents)
          .where(eq(aaConsents.consentHandle, consentHandle))
          .limit(1);

        if (consent) {
          await db
            .update(aaConsents)
            .set({
              status: consentStatus || consent.status,
              consentId: consentId || consent.consentId,
              updatedAt: new Date(),
            })
            .where(eq(aaConsents.id, consent.id));

          // If consent became ACTIVE, auto-trigger initial FI Data session
          if (consentStatus === "ACTIVE" && consentId) {
            finvuFiService
              .requestFIData(consent.id, consent.userId)
              .catch((err) => {
                logger.error(
                  `[FinvuWebhook] Auto FI request failed for consent ${consent.id}:`,
                  err.message
                );
              });
          }

          return { processed: true, type: "CONSENT", status: consentStatus || "UPDATED" };
        }
      }
      return { processed: false, type: "CONSENT", status: "NOT_FOUND" };
    }

    // 2. Financial Information (FI) Status Notification
    if (payload.FIStatusNotification) {
      const { sessionId, sessionStatus } = payload.FIStatusNotification;

      logger.info(
        `[FinvuWebhook] Received FI Data notification for session: ${sessionId}, status: ${sessionStatus}`
      );

      if (sessionId && (sessionStatus === "COMPLETED" || sessionStatus === "READY")) {
        // Trigger data fetch and decryption
        finvuFiService
          .fetchAndProcessFIData(sessionId)
          .then((res) => {
            logger.info(
              `[FinvuWebhook] Successfully processed FI session ${sessionId}: ${res.accountsCount} accounts ingested.`
            );
          })
          .catch((err) => {
            logger.error(
              `[FinvuWebhook] Error fetching FI data for session ${sessionId}:`,
              err.message
            );
          });

        return { processed: true, type: "FI_DATA", status: sessionStatus };
      }

      return { processed: true, type: "FI_DATA", status: sessionStatus || "PENDING" };
    }

    return { processed: false, type: "UNKNOWN", status: "IGNORED" };
  }
}

export const finvuWebhookHandler = new FinvuWebhookHandler();
