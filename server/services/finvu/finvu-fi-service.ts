import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import {
  aaConsents,
  aaFiSessions,
  aaFinancialProfiles,
  aaTransactions,
  type AaFiSession,
} from "../../../shared/schema/finvu";
import { finvuClient } from "./finvu-client";
import { finvuCrypto } from "./finvu-crypto";
import { isFinvuConfigured } from "../../utils/finvu-config";
import { logger } from "../../logger";

export class FinvuFiService {
  /**
   * Initiates a Financial Information (FI) Data Request to Finvu for an active consent
   */
  public async requestFIData(consentDbId: string, userId: string): Promise<{
    success: boolean;
    sessionId?: string;
    sessionDbId?: string;
    message?: string;
  }> {
    const [consent] = await db
      .select()
      .from(aaConsents)
      .where(and(eq(aaConsents.id, consentDbId), eq(aaConsents.userId, userId)))
      .limit(1);

    if (!consent) {
      return { success: false, message: "Consent record not found" };
    }

    if (consent.status !== "ACTIVE" || !consent.consentId) {
      return {
        success: false,
        message: `Consent is not active (current status: ${consent.status})`,
      };
    }

    // Generate ephemeral Curve25519 keypair and nonce
    const keyMaterial = finvuCrypto.generateEphemeralKeyMaterial();
    const encryptedPrivateKey = finvuCrypto.encryptPrivateKeyAtRest(keyMaterial.privateKey);

    let finvuSessionId = `FINVU_SES_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    if (isFinvuConfigured()) {
      const response = await finvuClient.request({
        url: "/FI/request",
        method: "POST",
        data: {
          ver: "1.1.2",
          timestamp: new Date().toISOString(),
          txnid: `FINVU_FITXN_${Date.now()}`,
          FIDataRange: {
            from: consent.dateRangeFrom.toISOString(),
            to: consent.dateRangeTo.toISOString(),
          },
          Consent: {
            id: consent.consentId,
            digitalSignature: (consent.consentArtefact as any)?.signature || "",
          },
          KeyMaterial: {
            cryptoAlg: "ECDH",
            curve: "Curve25519",
            params: "",
            DHE: {
              PublicKey: {
                KeyValue: keyMaterial.publicKey,
              },
            },
            Nonce: keyMaterial.nonce,
          },
        },
      });

      if (!response.success || !response.data?.sessionId) {
        logger.error("[FinvuFiService] FI request failed:", response.error);
        return {
          success: false,
          message: response.error || "Failed to initiate FI data session with Finvu",
        };
      }

      finvuSessionId = response.data.sessionId;
    }

    // Persist FI session
    const [insertedSession] = await db
      .insert(aaFiSessions)
      .values({
        consentId: consent.id,
        userId: consent.userId,
        sessionId: finvuSessionId,
        status: "REQUESTED",
        fiuPublicKey: keyMaterial.publicKey,
        fiuPrivateKeyEncrypted: encryptedPrivateKey,
        fiuNonce: keyMaterial.nonce,
      })
      .returning();

    return {
      success: true,
      sessionId: finvuSessionId,
      sessionDbId: insertedSession.id,
    };
  }

  /**
   * Fetches, decrypts, and ingests Financial Information (FI) data for a session
   */
  public async fetchAndProcessFIData(sessionIdentifier: string): Promise<{
    success: boolean;
    accountsCount: number;
    transactionsCount: number;
    message?: string;
  }> {
    // Find session by sessionId or db id
    const [session] = await db
      .select()
      .from(aaFiSessions)
      .where(eq(aaFiSessions.sessionId, sessionIdentifier))
      .limit(1);

    if (!session) {
      return { success: false, accountsCount: 0, transactionsCount: 0, message: "FI session not found" };
    }

    // Decrypt the ephemeral private key stored at rest
    const fiuPrivateKey = finvuCrypto.decryptPrivateKeyAtRest(session.fiuPrivateKeyEncrypted);

    let accountsCount = 0;
    let transactionsCount = 0;

    if (isFinvuConfigured()) {
      const response = await finvuClient.request({
        url: `/FI/fetch/${session.sessionId}`,
        method: "GET",
      });

      if (!response.success || !response.data?.FI) {
        return {
          success: false,
          accountsCount: 0,
          transactionsCount: 0,
          message: response.error || "Failed to fetch FI data from Finvu",
        };
      }

      const fipKeyMaterial = response.data.KeyMaterial;
      const fipPublicKey = fipKeyMaterial?.DHE?.PublicKey?.KeyValue;
      const fipNonce = fipKeyMaterial?.Nonce;

      if (!fipPublicKey || !fipNonce) {
        return {
          success: false,
          accountsCount: 0,
          transactionsCount: 0,
          message: "Missing FIP cryptographic key material in Finvu response",
        };
      }

      // ReBIT ECDH Key Derivation
      const derivedKey = finvuCrypto.deriveSharedKey(
        fiuPrivateKey,
        fipPublicKey,
        session.fiuNonce,
        fipNonce
      );

      // Process each FIP account block
      for (const fiBlock of response.data.FI) {
        try {
          const decryptedJson = finvuCrypto.decryptFIPayload(
            fiBlock.data,
            derivedKey,
            fiBlock.iv,
            fiBlock.authTag
          );

          const parsedData = JSON.parse(decryptedJson);
          const fipId = fiBlock.fipId || "UNKNOWN-FIP";

          // Process and persist Account
          const account = parsedData.Account;
          if (account) {
            const maskedNumber = account.maskedAccNumber || "******XXXX";
            const linkRefNumber = account.linkRefNumber || `LNK_${Date.now()}`;
            const balance = account.Summary?.currentBalance || "0";
            const accountType = account.type || "SAVINGS";

            const [profile] = await db
              .insert(aaFinancialProfiles)
              .values({
                userId: session.userId,
                consentId: session.consentId,
                fipId,
                fipName: account.fipName || fipId,
                accountType,
                maskedAccountNumber: maskedNumber,
                linkRefNumber,
                currentBalance: balance.toString(),
                holdingSummary: account.Holdings || account.Summary,
                lastSyncedAt: new Date(),
              })
              .returning();

            accountsCount++;

            // Process transactions if present
            const txns = account.Transactions?.Transaction || [];
            if (Array.isArray(txns)) {
              for (const t of txns) {
                await db.insert(aaTransactions).values({
                  profileId: profile.id,
                  userId: session.userId,
                  txnId: t.txnId || `TXN_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  amount: t.amount?.toString() || "0",
                  type: t.type === "DEBIT" ? "DEBIT" : "CREDIT",
                  mode: t.mode || "OTHERS",
                  narration: t.narration || "",
                  balanceAfterTxn: t.currentBalance?.toString() || null,
                  txnDate: t.transactionTimestamp ? new Date(t.transactionTimestamp) : new Date(),
                  category: t.category || "General",
                });
                transactionsCount++;
              }
            }
          }
        } catch (decryptErr: any) {
          logger.error("[FinvuFiService] Failed to decrypt block:", decryptErr.message);
        }
      }
    } else {
      // Sandbox synthetic ingestion for testing without live FIP connectivity
      const [profile] = await db
        .insert(aaFinancialProfiles)
        .values({
          userId: session.userId,
          consentId: session.consentId,
          fipId: "HDFC-FIP",
          fipName: "HDFC Bank Ltd",
          accountType: "SAVINGS",
          maskedAccountNumber: "******8891",
          linkRefNumber: `LNK_HDFC_${Date.now()}`,
          currentBalance: "485250.75",
          holdingSummary: {
            availableBalance: 485250.75,
            branch: "Bandra Kurla Complex, Mumbai",
            ifsc: "HDFC0000240",
          },
          lastSyncedAt: new Date(),
        })
        .returning();

      accountsCount = 1;

      await db.insert(aaTransactions).values({
        profileId: profile.id,
        userId: session.userId,
        txnId: `TXN_${Date.now()}_SALARY`,
        amount: "250000.00",
        type: "CREDIT",
        mode: "NEFT",
        narration: "NEFT-SALARY CREDIT FOR NOV 2026",
        balanceAfterTxn: "485250.75",
        txnDate: new Date(),
        category: "Salary",
      });
      transactionsCount = 1;
    }

    // Mark session completed
    await db
      .update(aaFiSessions)
      .set({
        status: "COMPLETED",
        recordsFetched: accountsCount,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aaFiSessions.id, session.id));

    return {
      success: true,
      accountsCount,
      transactionsCount,
    };
  }
}

export const finvuFiService = new FinvuFiService();
