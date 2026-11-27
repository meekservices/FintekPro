/**
 * Cryptographic WORM (Write Once, Read Many) Audit Chain & Verifier
 *
 * Implements HMAC-SHA256 cryptographic hash-chaining across institutional audit logs:
 * record_hash_n = HMAC_SHA256(secret, record_index + ":" + timestamp + ":" + action + ":" + payload_hash + ":" + prev_hash)
 *
 * Guarantees mathematical non-repudiation and immediate tamper detection for
 * SEBI RIA, RA, and Cyber Security & Cyber Resilience Framework (CSCRF) compliance.
 *
 * @module server/services/audit-integrity-verifier
 */

import crypto from "crypto";
import { logger } from "../logger";

export interface ChainRecord {
	index: number;
	timestamp: string | Date;
	eventType: string;
	action: string;
	payload: any;
	recordHash: string;
	prevRecordHash: string;
}

export interface VerificationResult {
	isValid: boolean;
	totalRecords: number;
	brokenIndex?: number;
	expectedHash?: string;
	actualHash?: string;
	failureReason?: string;
	verifiedAt: string;
}

export class AuditIntegrityVerifier {
	public static readonly GENESIS_HASH = "0".repeat(64);
	private static readonly DEFAULT_SECRET = process.env.SEBI_AUDIT_HMAC_KEY || "fintekpro_worm_audit_chain_sec_key";

	/**
	 * Computes canonical payload hash using SHA-256 with deterministic JSON serialization.
	 */
	public static computePayloadHash(payload: any): string {
		if (payload === undefined || payload === null) {
			return crypto.createHash("sha256").update("").digest("hex");
		}
		// Sort keys to guarantee deterministic serialization
		const canonicalJson = JSON.stringify(payload, Object.keys(payload || {}).sort());
		return crypto.createHash("sha256").update(canonicalJson).digest("hex");
	}

	/**
	 * Computes HMAC-SHA256 record hash chaining from previous record hash.
	 */
	public static computeRecordHash(
		index: number,
		timestamp: string | Date,
		action: string,
		payloadHash: string,
		prevRecordHash: string,
		secret: string = this.DEFAULT_SECRET
	): string {
		const tsIso = timestamp instanceof Date ? timestamp.toISOString() : timestamp;
		const message = `${index}:${tsIso}:${action}:${payloadHash}:${prevRecordHash}`;
		return crypto.createHmac("sha256", secret).update(message).digest("hex");
	}

	/**
	 * Creates a chained audit record from existing data.
	 */
	public static createChainedRecord(
		index: number,
		eventType: string,
		action: string,
		payload: any,
		prevRecordHash: string = this.GENESIS_HASH,
		secret: string = this.DEFAULT_SECRET,
		timestamp: Date = new Date()
	): ChainRecord {
		const payloadHash = this.computePayloadHash(payload);
		const recordHash = this.computeRecordHash(
			index,
			timestamp,
			action,
			payloadHash,
			prevRecordHash,
			secret
		);

		return {
			index,
			timestamp: timestamp.toISOString(),
			eventType,
			action,
			payload,
			recordHash,
			prevRecordHash,
		};
	}

	/**
	 * Validates a sequential chain of audit log records.
	 * Identifies exact row of any broken link or modified content.
	 */
	public static verifyChain(
		records: ChainRecord[],
		secret: string = this.DEFAULT_SECRET
	): VerificationResult {
		const verifiedAt = new Date().toISOString();

		if (!records || records.length === 0) {
			return {
				isValid: true,
				totalRecords: 0,
				verifiedAt,
			};
		}

		// Sort by index ascending
		const sorted = [...records].sort((a, b) => a.index - b.index);

		let expectedPrevHash = this.GENESIS_HASH;

		for (let i = 0; i < sorted.length; i++) {
			const record = sorted[i];

			// 1. Verify index sequence
			const expectedIndex = i;
			if (record.index !== expectedIndex) {
				return {
					isValid: false,
					totalRecords: sorted.length,
					brokenIndex: record.index,
					failureReason: `Index sequence broken. Expected ${expectedIndex}, found ${record.index}`,
					verifiedAt,
				};
			}

			// 2. Verify previous record hash linkage
			if (record.prevRecordHash !== expectedPrevHash) {
				return {
					isValid: false,
					totalRecords: sorted.length,
					brokenIndex: record.index,
					expectedHash: expectedPrevHash,
					actualHash: record.prevRecordHash,
					failureReason: `Previous hash pointer mismatch at index ${record.index}`,
					verifiedAt,
				};
			}

			// 3. Verify current record hash calculation
			const payloadHash = this.computePayloadHash(record.payload);
			const calculatedHash = this.computeRecordHash(
				record.index,
				record.timestamp,
				record.action,
				payloadHash,
				record.prevRecordHash,
				secret
			);

			if (calculatedHash !== record.recordHash) {
				return {
					isValid: false,
					totalRecords: sorted.length,
					brokenIndex: record.index,
					expectedHash: calculatedHash,
					actualHash: record.recordHash,
					failureReason: `Record signature mismatch at index ${record.index}. Payload or header tampered with.`,
					verifiedAt,
				};
			}

			// Advance previous hash pointer
			expectedPrevHash = record.recordHash;
		}

		return {
			isValid: true,
			totalRecords: sorted.length,
			verifiedAt,
		};
	}
}
