/**
 * @file pii-migration-service.ts
 * @description Transparent PII Migration & Blind-Indexed Query Service.
 *
 * Adheres strictly to FintekPro Institutional Tier-1 Architecture:
 * - Performs zero-downtime envelope encryption backfills for existing plaintext PII.
 * - Supports O(1) indexed lookups using deterministic HMAC-SHA256 blinded hashes.
 * - Adheres strictly to the Indian Digital Personal Data Protection Act 2023.
 */

import { db } from "../db";
import { customerCareAgents } from "@shared/schema/agents";
import { eq, and, isNotNull, isNull } from "drizzle-orm";
import { PiiVault } from "../core/security/pii-vault";
import { logger } from "../logger";

export class PiiMigrationService {
	/**
	 * Backfills unencrypted customerCareAgents PAN and Aadhaar records with AES-256-GCM envelope encryption.
	 */
	static async backfillAgentPii(batchLimit = 500): Promise<{ processed: number; errors: number }> {
		let processed = 0;
		let errors = 0;

		try {
			// Find records that have plaintext panNumber but missing panEncrypted
			const candidates = await db
				.select({
					id: customerCareAgents.id,
					panNumber: customerCareAgents.panNumber,
					aadharNumber: customerCareAgents.aadharNumber,
					bankAccountNumber: customerCareAgents.bankAccountNumber,
				})
				.from(customerCareAgents)
				.where(
					and(
						isNotNull(customerCareAgents.panNumber),
						isNull(customerCareAgents.panEncrypted),
					),
				)
				.limit(batchLimit);

			for (const agent of candidates) {
				try {
					const updates: any = {};

					if (agent.panNumber) {
						const panPayload = PiiVault.encrypt(agent.panNumber, "PAN");
						updates.panEncrypted = panPayload.ciphertext;
						updates.panSearchHash = panPayload.searchHash;
						updates.panMasked = panPayload.masked;
					}

					if (agent.aadharNumber) {
						const aadharPayload = PiiVault.encrypt(agent.aadharNumber, "AADHAAR");
						updates.aadharEncrypted = aadharPayload.ciphertext;
						updates.aadharSearchHash = aadharPayload.searchHash;
						updates.aadharMasked = aadharPayload.masked;
					}

					if (agent.bankAccountNumber) {
						const bankPayload = PiiVault.encrypt(agent.bankAccountNumber, "BANK_ACCOUNT");
						updates.bankAccountEncrypted = bankPayload.ciphertext;
						updates.bankAccountMasked = bankPayload.masked;
					}

					await db
						.update(customerCareAgents)
						.set(updates)
						.where(eq(customerCareAgents.id, agent.id));

					processed++;
				} catch (err: unknown) {
					errors++;
					const message = err instanceof Error ? err.message : String(err);
					logger.warn("[PiiMigration] Failed to encrypt agent record", {
						agentId: agent.id,
						error: message,
					});
				}
			}

			logger.info("[PiiMigration] Agent PII backfill completed", { processed, errors });
			return { processed, errors };
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error("[PiiMigration] Batch query failed", { error: message });
			return { processed, errors: errors + 1 };
		}
	}

	/**
	 * Resolves an agent by plaintext PAN using blinded search hash.
	 */
	static async findAgentByPan(pan: string): Promise<any | null> {
		if (!pan) return null;
		const searchHash = PiiVault.hashForSearch(pan);

		const rows = await db
			.select()
			.from(customerCareAgents)
			.where(eq(customerCareAgents.panSearchHash, searchHash))
			.limit(1);

		return rows[0] || null;
	}
}
