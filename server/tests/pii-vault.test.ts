import { describe, expect, it } from "vitest";
import { PiiVault } from "../core/security/pii-vault";

describe("PiiVault Cryptographic Privacy Engine (Institutional Grade)", () => {
	it("encrypts and decrypts PAN numbers with AES-256-GCM envelope encryption", () => {
		const originalPan = "ABCDE1234F";
		const payload = PiiVault.encrypt(originalPan, "PAN");

		expect(payload.ciphertext).toBeDefined();
		expect(payload.ciphertext).toContain(":");
		expect(payload.ciphertext).not.toContain(originalPan);

		expect(payload.masked).toBe("ABCDE****F");
		expect(payload.searchHash).toBeDefined();

		const decrypted = PiiVault.decrypt(payload.ciphertext);
		expect(decrypted).toBe(originalPan);
	});

	it("produces deterministic blinded search hashes for indexed queries", () => {
		const pan1 = "ABCDE1234F";
		const pan2 = "abcde1234f "; // whitespace and case difference

		const hash1 = PiiVault.hashForSearch(pan1);
		const hash2 = PiiVault.hashForSearch(pan2);

		expect(hash1).toBe(hash2);
		expect(hash1.length).toBe(64); // SHA-256 hex string
	});

	it("masks Aadhaar numbers per UIDAI guidelines (first 8 digits masked)", () => {
		expect(PiiVault.maskAadhaar("123456789012")).toBe("********9012");
		expect(PiiVault.maskAadhaar("1234 5678 9012")).toBe("********9012");
	});

	it("masks bank account numbers and mobile numbers", () => {
		expect(PiiVault.maskBankAccount("50100234567890")).toBe("**********7890");
		expect(PiiVault.maskMobile("9876543210")).toBe("******3210");
	});

	it("detects ciphertext tampering and fails decryption", () => {
		const payload = PiiVault.encrypt("CONFIDENTIAL_BANK_DATA");
		const parts = payload.ciphertext.split(":");
		// Alter the ciphertext part
		const corrupted = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -4)}AAAA`;

		expect(() => PiiVault.decrypt(corrupted)).toThrow();
	});
});
