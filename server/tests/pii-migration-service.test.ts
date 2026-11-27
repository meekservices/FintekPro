import { describe, expect, it } from "vitest";
import { PiiVault } from "../core/security/pii-vault";

describe("PII Migration & Blind Search Indexing (Institutional DPDP Standard)", () => {
	it("generates matching search hashes for normalized PAN lookups", () => {
		const rawPan = "abcde1234f";
		const uppercasePan = "ABCDE1234F";

		const hash1 = PiiVault.hashForSearch(rawPan);
		const hash2 = PiiVault.hashForSearch(uppercasePan);

		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64);
	});

	it("creates complete encrypted, masked, and hashed payloads", () => {
		const payload = PiiVault.encrypt("ABCDE1234F", "PAN");
		expect(payload.masked).toBe("ABCDE****F");
		expect(payload.ciphertext).toBeDefined();
		expect(payload.searchHash).toBe(PiiVault.hashForSearch("ABCDE1234F"));

		const decrypted = PiiVault.decrypt(payload.ciphertext);
		expect(decrypted).toBe("ABCDE1234F");
	});
});
