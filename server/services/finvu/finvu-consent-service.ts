import { eq } from "drizzle-orm";
import { db } from "../../db";
import { aaConsents, type AaConsent } from "../../../shared/schema/finvu";
import { finvuClient } from "./finvu-client";
import { getFinvuFiuEntityId, getFinvuRedirectUrl, isFinvuConfigured } from "../../utils/finvu-config";
import { logger } from "../../logger";

export interface InitiateConsentParams {
  userId: string;
  phoneNumber: string;
  fiTypes?: string[];
  consentMode?: "STORE" | "VIEW";
  fetchType?: "ONETIME" | "PERIODIC";
  dateRangeFrom?: Date;
  dateRangeTo?: Date;
  expiryMonths?: number;
}

export interface ConsentInitiationResult {
  success: boolean;
  consentHandle: string;
  redirectUrl?: string;
  status: string;
  message?: string;
}

export class FinvuConsentService {
  /**
   * Initiates a consent request according to ReBIT AA specifications
   */
  public async initiateConsent(params: InitiateConsentParams): Promise<ConsentInitiationResult> {
    const fiTypes = params.fiTypes || ["DEPOSIT", "TERM_DEPOSIT", "MUTUAL_FUNDS", "EQUITIES"];
    const now = new Date();
    const dateRangeFrom = params.dateRangeFrom || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year past
    const dateRangeTo = params.dateRangeTo || now;
    const expiryMonths = params.expiryMonths || 12;
    const consentExpiry = new Date(now.getTime() + expiryMonths * 30 * 24 * 60 * 60 * 1000);
    const consentMode = params.consentMode || "STORE";
    const fetchType = params.fetchType || "PERIODIC";

    // Clean Indian mobile number format (e.g., "9876543210@finvu" for Customer ID or ReBIT identifier)
    const cleanPhone = params.phoneNumber.replace(/\D/g, "").slice(-10);
    const customerIdentifier = `${cleanPhone}@finvu`;

    // ReBIT Consent Detail payload
    const consentDetail = {
      consentMode,
      fetchType,
      consentTypes: ["PROFILE", "SUMMARY", "TRANSACTIONS"],
      fiTypes,
      DataConsumer: { id: getFinvuFiuEntityId() },
      Customer: { id: customerIdentifier },
      Purpose: {
        code: "101",
        refUri: "https://api.rebit.org.in/aa/purpose/101.xml",
        text: "Wealth Management & Financial Portfolio Advisory",
        Category: { type: "Portfolio Advisory" },
      },
      FIDataRange: {
        from: dateRangeFrom.toISOString(),
        to: dateRangeTo.toISOString(),
      },
      ConsentDateTime: now.toISOString(),
      ConsentExpiry: consentExpiry.toISOString(),
      Frequency: {
        unit: "MONTH",
        value: 1,
      },
      DataFilter: [
        {
          type: "TRANSACTIONAMOUNT",
          operator: ">=",
          value: "0",
        },
      ],
      DataLife: {
        unit: "MONTH",
        value: 24,
      },
    };

    let consentHandle = `FINVU_HDL_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    let redirectUrl = `${getFinvuRedirectUrl()}&handle=${consentHandle}`;

    if (isFinvuConfigured()) {
      const response = await finvuClient.request({
        url: "/Consent",
        method: "POST",
        data: {
          ver: "1.1.2",
          timestamp: now.toISOString(),
          txnid: `FINVU_TXN_${Date.now()}`,
          ConsentDetail: consentDetail,
        },
      });

      if (!response.success || !response.data?.ConsentHandle) {
        logger.error("[FinvuConsentService] Finvu consent initiation failed:", response.error);
        return {
          success: false,
          consentHandle: "",
          status: "FAILED",
          message: response.error || "Failed to initiate consent with Finvu",
        };
      }

      consentHandle = response.data.ConsentHandle;
      if (response.data.redirectUrl) {
        redirectUrl = response.data.redirectUrl;
      }
    } else {
      logger.info("[FinvuConsentService] Finvu live credentials not present; running in sandbox mode.");
    }

    // Persist to Drizzle ORM
    const [inserted] = await db
      .insert(aaConsents)
      .values({
        userId: params.userId,
        consentHandle,
        provider: "finvu",
        status: "PENDING",
        consentMode,
        fetchType,
        fiTypes,
        dateRangeFrom,
        dateRangeTo,
        consentExpiry,
        redirectUrl,
      })
      .returning();

    return {
      success: true,
      consentHandle: inserted.consentHandle,
      redirectUrl,
      status: inserted.status,
    };
  }

  /**
   * Polls or checks consent handle status with Finvu and updates database state
   */
  public async getConsentStatus(consentHandle: string): Promise<{
    success: boolean;
    status: string;
    consentId?: string | null;
    artefact?: any;
  }> {
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(eq(aaConsents.consentHandle, consentHandle))
      .limit(1);

    if (!consent) {
      return { success: false, status: "NOT_FOUND" };
    }

    if (consent.status === "ACTIVE" && consent.consentId) {
      return {
        success: true,
        status: "ACTIVE",
        consentId: consent.consentId,
        artefact: consent.consentArtefact,
      };
    }

    if (isFinvuConfigured()) {
      const response = await finvuClient.request({
        url: `/Consent/handle/${consentHandle}`,
        method: "GET",
      });

      if (response.success && response.data) {
        const remoteStatus = response.data.ConsentStatus?.status || consent.status;
        const consentId = response.data.ConsentStatus?.id || consent.consentId;

        if (remoteStatus !== consent.status || consentId !== consent.consentId) {
          await db
            .update(aaConsents)
            .set({
              status: remoteStatus,
              consentId: consentId || null,
              consentArtefact: response.data.ConsentArtefact || consent.consentArtefact,
              updatedAt: new Date(),
            })
            .where(eq(aaConsents.id, consent.id));
        }

        return {
          success: true,
          status: remoteStatus,
          consentId,
          artefact: response.data.ConsentArtefact,
        };
      }
    }

    return {
      success: true,
      status: consent.status,
      consentId: consent.consentId,
      artefact: consent.consentArtefact,
    };
  }

  /**
   * Revokes an active consent with Finvu and updates local record
   */
  public async revokeConsent(consentId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(eq(aaConsents.consentId, consentId))
      .limit(1);

    if (!consent || consent.userId !== userId) {
      return { success: false, message: "Consent record not found or access denied" };
    }

    if (isFinvuConfigured()) {
      await finvuClient.request({
        url: `/Consent/${consentId}`,
        method: "DELETE",
      });
    }

    await db
      .update(aaConsents)
      .set({
        status: "REVOKED",
        updatedAt: new Date(),
      })
      .where(eq(aaConsents.id, consent.id));

    return { success: true, message: "Consent successfully revoked" };
  }
}

export const finvuConsentService = new FinvuConsentService();
