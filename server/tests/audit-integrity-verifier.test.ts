import { describe, it, expect } from "vitest";
import {
	AuditIntegrityVerifier,
	ChainRecord,
} from "../services/audit-integrity-verifier";

describe("AuditIntegrityVerifier (Cryptographic WORM Audit Chains)", () => {
	const secret = "test_sebi_audit_secret_key_12345";
	const now = new Date("2026-04-01T10:00:00.000Z");

	it("creates and verifies a valid cryptographic hash chain", () => {
		const records: ChainRecord[] = [];

		// Genesis record (index 0)
		const r0 = AuditIntegrityVerifier.createChainedRecord(
			0,
			"SEBI_COMPLIANCE",
			"SIP_ROUTING",
			{ clientId: "cli_1", fundCode: "120503", amount: 5000 },
			AuditIntegrityVerifier.GENESIS_HASH,
			secret,
			now
		);
		records.push(r0);

		// Record 1 (chains from r0)
		const r1 = AuditIntegrityVerifier.createChainedRecord(
			1,
			"SEBI_COMPLIANCE",
			"RECOMMENDATION",
			{ clientId: "cli_1", status: "SUITABLE", riskScore: 78 },
			r0.recordHash,
			secret,
			new Date(now.getTime() + 60000)
		);
		records.push(r1);

		// Record 2 (chains from r1)
		const r2 = AuditIntegrityVerifier.createChainedRecord(
			2,
			"AI_ADVISORY",
			"PROPOSAL_GENERATED",
			{ proposalId: "prop_99", aumPaisa: 50000000 },
			r1.recordHash,
			secret,
			new Date(now.getTime() + 120000)
		);
		records.push(r2);

		const result = AuditIntegrityVerifier.verifyChain(records, secret);
		expect(result.isValid).toBe(true);
		expect(result.totalRecords).toBe(3);
		expect(result.brokenIndex).toBeUndefined();
	});

	it("detects tampering when payload content is modified", () => {
		const records: ChainRecord[] = [];

		const r0 = AuditIntegrityVerifier.createChainedRecord(
			0,
			"SEBI_COMPLIANCE",
			"ADVICE",
			{ recommendation: "BUY" },
			AuditIntegrityVerifier.GENESIS_HASH,
			secret,
			now
		);
		records.push(r0);

		// Malicious tamper: change BUY to SELL without valid re-signing
		records[0].payload = { recommendation: "SELL" };

		const result = AuditIntegrityVerifier.verifyChain(records, secret);
		expect(result.isValid).toBe(false);
		expect(result.brokenIndex).toBe(0);
		expect(result.failureReason).toContain("Record signature mismatch");
	});

	it("detects broken chain when a middle record is deleted", () => {
		const r0 = AuditIntegrityVerifier.createChainedRecord(
			0,
			"TEST",
			"ACTION_0",
			{ d: 0 },
			AuditIntegrityVerifier.GENESIS_HASH,
			secret,
			now
		);
		const r1 = AuditIntegrityVerifier.createChainedRecord(
			1,
			"TEST",
			"ACTION_1",
			{ d: 1 },
			r0.recordHash,
			secret,
			new Date(now.getTime() + 1000)
		);
		const r2 = AuditIntegrityVerifier.createChainedRecord(
			2,
			"TEST",
			"ACTION_2",
			{ d: 2 },
			r1.recordHash,
			secret,
			new Date(now.getTime() + 2000)
		);

		// Omit r1: simulate an attacker dropping a row
		const tamperedRecords = [r0, r2];

		const result = AuditIntegrityVerifier.verifyChain(tamperedRecords, secret);
		expect(result.isValid).toBe(false);
		expect(result.brokenIndex).toBe(2);
	});
});
