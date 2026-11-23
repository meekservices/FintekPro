import * as crypto from "crypto";
import { logger } from "../../logger";
import { getFinvuMasterKey } from "../../utils/finvu-config";

export interface EphemeralKeyMaterial {
  publicKey: string; // Base64 raw 32-byte public key
  privateKey: string; // Base64 raw 32-byte private key
  nonce: string; // Base64 32-byte random nonce
}

export interface RebitEncryptedPayload {
  base64Data: string; // Ciphertext
  base64Iv: string; // Initialization Vector (12 bytes for GCM)
  base64AuthTag: string; // 16-byte authentication tag
}

export class FinvuCryptoService {
  /**
   * Generates a fresh ephemeral Curve25519 (X25519) keypair and random nonce
   * for each Financial Information (FI) Data Session
   */
  public generateEphemeralKeyMaterial(): EphemeralKeyMaterial {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");

    // Export raw 32-byte keys
    const pubBuffer = publicKey.export({ type: "spki", format: "der" });
    // In SPKI DER format for X25519, the last 32 bytes contain the raw public key
    const rawPublicKey = pubBuffer.subarray(pubBuffer.length - 32);

    const privBuffer = privateKey.export({ type: "pkcs8", format: "der" });
    // In PKCS8 DER format for X25519, the last 32 bytes contain the raw private key
    const rawPrivateKey = privBuffer.subarray(privBuffer.length - 32);

    const nonce = crypto.randomBytes(32);

    return {
      publicKey: rawPublicKey.toString("base64"),
      privateKey: rawPrivateKey.toString("base64"),
      nonce: nonce.toString("base64"),
    };
  }

  /**
   * Encrypts the ephemeral private key for secure storage at rest in the database
   */
  public encryptPrivateKeyAtRest(privateKeyBase64: string): string {
    const masterKey = Buffer.from(getFinvuMasterKey(), "utf-8");
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", masterKey, iv);
    
    let encrypted = cipher.update(privateKeyBase64, "utf-8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts the ephemeral private key from its encrypted-at-rest representation
   */
  public decryptPrivateKeyAtRest(encryptedRecord: string): string {
    const masterKey = Buffer.from(getFinvuMasterKey(), "utf-8");
    const parts = encryptedRecord.split(":");
    if (parts.length !== 3) {
      throw new Error("[FinvuCrypto] Malformed encrypted private key record");
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      masterKey,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    let decrypted = decipher.update(encryptedHex, "hex", "utf-8");
    decrypted += decipher.final("utf-8");
    return decrypted;
  }

  /**
   * Derives the 32-byte AES-256-GCM shared key using Diffie-Hellman (Curve25519) + HKDF-SHA256
   * in strict compliance with the ReBIT AA specifications
   */
  public deriveSharedKey(
    fiuPrivateKeyBase64: string,
    fipPublicKeyBase64: string,
    fiuNonceBase64: string,
    fipNonceBase64: string
  ): Buffer {
    try {
      const fiuPrivRaw = Buffer.from(fiuPrivateKeyBase64, "base64");
      const fipPubRaw = Buffer.from(fipPublicKeyBase64, "base64");

      // Wrap raw 32-byte keys into DER format for node:crypto
      const privDer = Buffer.concat([
        Buffer.from("302e020100300506032b656e04220420", "hex"),
        fiuPrivRaw,
      ]);
      const pubDer = Buffer.concat([
        Buffer.from("302a300506032b656e032100", "hex"),
        fipPubRaw,
      ]);

      const privateKey = crypto.createPrivateKey({
        key: privDer,
        format: "der",
        type: "pkcs8",
      });

      const publicKey = crypto.createPublicKey({
        key: pubDer,
        format: "der",
        type: "spki",
      });

      // Diffie-Hellman X25519 Shared Secret
      const sharedSecret = crypto.diffieHellman({
        privateKey,
        publicKey,
      });

      // Nonces used as HKDF salt as mandated by ReBIT
      const fiuNonce = Buffer.from(fiuNonceBase64, "base64");
      const fipNonce = Buffer.from(fipNonceBase64, "base64");
      const salt = Buffer.concat([fiuNonce, fipNonce]);

      // ReBIT HKDF Info parameter
      const info = Buffer.from("ReBIT-AA-HKDF", "utf-8");

      // Derive 32-byte key for AES-256-GCM
      const derivedKey = crypto.hkdfSync("sha256", sharedSecret, salt, info, 32);
      return Buffer.from(derivedKey);
    } catch (error: any) {
      logger.error("[FinvuCrypto] Key derivation failed:", error.message);
      throw new Error(`[FinvuCrypto] Shared key derivation error: ${error.message}`);
    }
  }

  /**
   * Decrypts an encrypted ReBIT Financial Information (FI) payload
   */
  public decryptFIPayload(
    encryptedBase64Data: string,
    derivedKey: Buffer,
    base64Iv: string,
    base64AuthTag: string
  ): string {
    try {
      const iv = Buffer.from(base64Iv, "base64");
      const authTag = Buffer.from(base64AuthTag, "base64");
      const ciphertext = Buffer.from(encryptedBase64Data, "base64");

      const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, undefined, "utf-8");
      decrypted += decipher.final("utf-8");
      return decrypted;
    } catch (error: any) {
      logger.error("[FinvuCrypto] Payload decryption failed:", error.message);
      throw new Error(`[FinvuCrypto] Decryption error: ${error.message}`);
    }
  }

  /**
   * Encrypts plain JSON string for testing / sandbox verification
   */
  public encryptFIPayloadForTesting(
    plainText: string,
    derivedKey: Buffer
  ): RebitEncryptedPayload {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);

    let encrypted = cipher.update(plainText, "utf-8", "base64");
    encrypted += cipher.final("base64");
    const authTag = cipher.getAuthTag();

    return {
      base64Data: encrypted,
      base64Iv: iv.toString("base64"),
      base64AuthTag: authTag.toString("base64"),
    };
  }
}

export const finvuCrypto = new FinvuCryptoService();
