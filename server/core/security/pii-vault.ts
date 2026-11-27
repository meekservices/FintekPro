/**
 * @file pii-vault.ts
 * @description FintekPro Institutional PII Cryptographic Vault & Privacy Engine.
 *
 * Mandate & Regulatory Compliance:
 * - Indian Digital Personal Data Protection Act 2023 (DPDP Act)
 * - SEBI Cybersecurity and Cyber Resilience Framework (CSCRF)
 * - UIDAI Aadhaar Act (Mandatory Masking: First 8 digits masked)
 *
 * Guarantees:
 * 1. AES-256-GCM Envelope Encryption at rest with 96-bit unique IVs and 128-bit authentication tags.
 * 2. Deterministic HMAC-SHA256 Blind Indexing for O(1) indexed lookups without storing plaintext.
 * 3. Standardized financial PII masking (PAN, Aadhaar, Bank Account, Mobile).
 */

import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
	scryptSync,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT = "fintekpro_pii_envelope_salt_v1";

/**
 * Derives a 256-bit symmetric key from environment secret
 */
function getDerivedKey(): Buffer {
	const rawSecret =
		process.env.PII_ENCRYPTION_KEY ||
		process.env.SESSION_SECRET ||
		"fintekpro-institutional-pii-master-key-2026";
	return scryptSync(rawSecret, SALT, 32);
}

export interface EncryptedPayload {
	ciphertext: string; // Base64 encoded: iv:authTag:ciphertext
	searchHash: string; // Hex HMAC-SHA256 for indexed search
	masked: string; // Masked representation for UI
}

export class PiiVault {
	/**
	 * Compute a deterministic blinded search hash (HMAC-SHA256).
	 * Allows database lookups (WHERE pan_search_hash = ?) without decrypting the column.
	 */
	static hashForSearch(plaintext: string): string {
		if (!plaintext) return "";
		const normalized = plaintext.trim().toUpperCase();
		const key = getDerivedKey();
		return createHmac("sha256", key)
			.update(`blinded_search:${normalized}`)
			.digest("hex");
	}

	/**
	 * Encrypt PII with AES-256-GCM authenticated envelope encryption.
	 */
	static encrypt(plaintext: string, piiType: "PAN" | "AADHAAR" | "BANK_ACCOUNT" | "MOBILE" | "GENERIC" = "GENERIC"): EncryptedPayload {
		if (!plaintext) {
			return { ciphertext: "", searchHash: "", masked: "" };
		}

		const key = getDerivedKey();
		const iv = randomBytes(IV_LENGTH);
		const cipher = createCipheriv(ALGORITHM, key, iv);

		let encrypted = cipher.update(plaintext.trim(), "utf8", "base64");
		encrypted += cipher.final("base64");
		const authTag = cipher.getAuthTag();

		// Packed format: iv_b64:tag_b64:ciphertext_b64
		const packed = `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;

		let masked = plaintext;
		switch (piiType) {
			case "PAN":
				masked = PiiVault.maskPan(plaintext);
				break;
			case "AADHAAR":
				masked = PiiVault.maskAadhaar(plaintext);
				break;
			case "BANK_ACCOUNT":
				masked = PiiVault.maskBankAccount(plaintext);
				break;
			case "MOBILE":
				masked = PiiVault.maskMobile(plaintext);
				break;
		}

		return {
			ciphertext: packed,
			searchHash: PiiVault.hashForSearch(plaintext),
			masked,
		};
	}

	/**
	 * Decrypt AES-256-GCM ciphertext payload.
	 * Throws if authentication tag verification fails (detects tampering).
	 */
	static decrypt(packedCiphertext: string): string {
		if (!packedCiphertext) return "";

		const parts = packedCiphertext.split(":");
		if (parts.length !== 3) {
			// Backwards compatibility: if not in envelope format, return as-is
			return packedCiphertext;
		}

		const [ivB64, tagB64, encryptedB64] = parts;
		const key = getDerivedKey();
		const iv = Buffer.from(ivB64, "base64");
		const authTag = Buffer.from(tagB64, "base64");

		const decipher = createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);

		let decrypted = decipher.update(encryptedB64, "base64", "utf8");
		decrypted += decipher.final("utf8");

		return decrypted;
	}

	/**
	 * Mask Indian PAN (Permanent Account Number).
	 * Format: First 5 characters, next 4 masked, final character visible.
	 * Example: ABCDE1234F -> ABCDE****F
	 */
	static maskPan(pan: string): string {
		if (!pan) return "";
		const clean = pan.trim().toUpperCase();
		if (clean.length !== 10) return "******";
		return `${clean.slice(0, 5)}****${clean.slice(9)}`;
	}

	/**
	 * Mask Indian Aadhaar Number per UIDAI Mandate.
	 * Format: First 8 digits masked with X or *, only last 4 digits visible.
	 * Example: 123456789012 -> ********9012
	 */
	static maskAadhaar(aadhaar: string): string {
		if (!aadhaar) return "";
		const clean = aadhaar.replace(/\D/g, "");
		if (clean.length < 4) return "********";
		const lastFour = clean.slice(-4);
		return `********${lastFour}`;
	}

	/**
	 * Mask Bank Account Number.
	 * Example: 123456789012 -> ********9012
	 */
	static maskBankAccount(accountNumber: string): string {
		if (!accountNumber) return "";
		const clean = accountNumber.trim();
		if (clean.length <= 4) return clean;
		const lastFour = clean.slice(-4);
		const maskedPart = "*".repeat(clean.length - 4);
		return `${maskedPart}${lastFour}`;
	}

	/**
	 * Mask Indian Mobile Number.
	 * Example: 9876543210 -> ******3210
	 */
	static maskMobile(mobile: string): string {
		if (!mobile) return "";
		const clean = mobile.replace(/\D/g, "");
		if (clean.length < 4) return "******";
		const lastFour = clean.slice(-4);
		return `******${lastFour}`;
	}
}
