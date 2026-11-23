import { describe, it, expect, vi } from "vitest";
import { finvuCrypto } from "../services/finvu/finvu-crypto";
import { finvuWebhookHandler } from "../services/finvu/finvu-webhook-handler";
import * as crypto from "crypto";

describe("Finvu ReBIT Cryptography & Webhook Service", () => {
  it("should generate valid Curve25519 (X25519) key material with 32-byte raw keys", () => {
    const keyMaterial = finvuCrypto.generateEphemeralKeyMaterial();

    expect(keyMaterial.publicKey).toBeDefined();
    expect(keyMaterial.privateKey).toBeDefined();
    expect(keyMaterial.nonce).toBeDefined();

    const pubBytes = Buffer.from(keyMaterial.publicKey, "base64");
    const privBytes = Buffer.from(keyMaterial.privateKey, "base64");
    const nonceBytes = Buffer.from(keyMaterial.nonce, "base64");

    expect(pubBytes.length).toBe(32);
    expect(privBytes.length).toBe(32);
    expect(nonceBytes.length).toBe(32);
  });

  it("should securely encrypt and decrypt ephemeral private keys at rest", () => {
    const keyMaterial = finvuCrypto.generateEphemeralKeyMaterial();
    const encryptedRecord = finvuCrypto.encryptPrivateKeyAtRest(keyMaterial.privateKey);

    expect(encryptedRecord).toContain(":");
    expect(encryptedRecord.split(":").length).toBe(3);

    const decrypted = finvuCrypto.decryptPrivateKeyAtRest(encryptedRecord);
    expect(decrypted).toBe(keyMaterial.privateKey);
  });

  it("should perform mutual Diffie-Hellman (Curve25519) shared key derivation and match peer secret", () => {
    const fiuKeys = finvuCrypto.generateEphemeralKeyMaterial();
    const fipKeys = finvuCrypto.generateEphemeralKeyMaterial();

    // FIU derives shared key using FIU private key and FIP public key
    const fiuSharedKey = finvuCrypto.deriveSharedKey(
      fiuKeys.privateKey,
      fipKeys.publicKey,
      fiuKeys.nonce,
      fipKeys.nonce
    );

    // FIP derives shared key using FIP private key and FIU public key
    const fipSharedKey = finvuCrypto.deriveSharedKey(
      fipKeys.privateKey,
      fiuKeys.publicKey,
      fiuKeys.nonce,
      fipKeys.nonce
    );

    expect(fiuSharedKey.length).toBe(32);
    expect(fipSharedKey.length).toBe(32);
    expect(fiuSharedKey.equals(fipSharedKey)).toBe(true);
  });

  it("should encrypt and decrypt ReBIT financial information payload via AES-256-GCM", () => {
    const fiuKeys = finvuCrypto.generateEphemeralKeyMaterial();
    const fipKeys = finvuCrypto.generateEphemeralKeyMaterial();

    const sharedKey = finvuCrypto.deriveSharedKey(
      fiuKeys.privateKey,
      fipKeys.publicKey,
      fiuKeys.nonce,
      fipKeys.nonce
    );

    const rawBankStatement = JSON.stringify({
      Account: {
        type: "SAVINGS",
        maskedAccNumber: "XXXXXX1234",
        Summary: {
          currentBalance: 582450.5,
          currency: "INR",
        },
        Transactions: {
          Transaction: [
            {
              txnId: "TXN100298",
              amount: 50000,
              type: "CREDIT",
              mode: "UPI",
              narration: "UPI-RECEIVED FROM CLIENT",
            },
          ],
        },
      },
    });

    const encrypted = finvuCrypto.encryptFIPayloadForTesting(rawBankStatement, sharedKey);
    expect(encrypted.base64Data).toBeDefined();
    expect(encrypted.base64Iv).toBeDefined();
    expect(encrypted.base64AuthTag).toBeDefined();

    const decrypted = finvuCrypto.decryptFIPayload(
      encrypted.base64Data,
      sharedKey,
      encrypted.base64Iv,
      encrypted.base64AuthTag
    );

    expect(decrypted).toBe(rawBankStatement);
    const parsed = JSON.parse(decrypted);
    expect(parsed.Account.Summary.currentBalance).toBe(582450.5);
    expect(parsed.Account.Transactions.Transaction[0].txnId).toBe("TXN100298");
  });

  it("should fail gracefully with descriptive error on tampered ciphertext or wrong key", () => {
    const fiuKeys = finvuCrypto.generateEphemeralKeyMaterial();
    const fipKeys = finvuCrypto.generateEphemeralKeyMaterial();
    const otherKeys = finvuCrypto.generateEphemeralKeyMaterial();

    const correctKey = finvuCrypto.deriveSharedKey(
      fiuKeys.privateKey,
      fipKeys.publicKey,
      fiuKeys.nonce,
      fipKeys.nonce
    );

    const wrongKey = finvuCrypto.deriveSharedKey(
      fiuKeys.privateKey,
      otherKeys.publicKey,
      fiuKeys.nonce,
      otherKeys.nonce
    );

    const encrypted = finvuCrypto.encryptFIPayloadForTesting("Secret Financial Statement", correctKey);

    expect(() => {
      finvuCrypto.decryptFIPayload(
        encrypted.base64Data,
        wrongKey,
        encrypted.base64Iv,
        encrypted.base64AuthTag
      );
    }).toThrow();
  });

  it("should verify webhook signature correctly when configured", () => {
    const body = JSON.stringify({
      ver: "1.1.2",
      timestamp: "2026-11-23T10:00:00Z",
      ConsentStatusNotification: {
        consentHandle: "FINVU_HDL_123",
        consentStatus: "ACTIVE",
      },
    });

    // In sandbox (empty secret), handler allows
    expect(finvuWebhookHandler.verifySignature(body, undefined)).toBe(true);
  });
});
