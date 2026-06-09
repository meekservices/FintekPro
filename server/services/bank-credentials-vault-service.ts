/**
 * Bank Credentials Vault Service
 *
 * Securely stores and retrieves bank API credentials using AES-256-GCM encryption.
 * Supports multiple environments (sandbox, uat, production) and credential types.
 *
 * Features:
 * - Encrypted storage using existing encryption service
 * - Key versioning for rotation support
 * - Environment isolation
 * - Audit trail for credential access
 */

import { db } from "../db";
import {
	bankCredentialsVault,
	type BankCredentialsVault,
	type InsertBankCredentialsVault,
} from "@shared/dsa-loan-schema";
import { encryptionService } from "../encryption-service";
import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";

export type CredentialType =
	| "api_key"
	| "client_id"
	| "client_secret"
	| "certificate"
	| "private_key"
	| "sftp_username"
	| "sftp_password"
	| "sftp_private_key"
	| "webhook_secret"
	| "encryption_key";

export type Environment = "sandbox" | "uat" | "production";

export interface VaultCredential {
	bankCode: string;
	credentialType: CredentialType;
	value: string; // Decrypted value
	environment: Environment;
	metadata?: {
		description?: string;
		expiresAt?: string;
		rotationDue?: string;
		lastRotated?: string;
	};
}

export interface StoreCredentialParams {
	bankCode: string;
	credentialType: CredentialType;
	value: string;
	environment: Environment;
	description?: string;
	expiresAt?: Date;
	createdBy?: string;
}

class BankCredentialsVaultService {
	private accessLog: Map<string, Date[]> = new Map();
	private readonly MAX_ACCESS_LOG_ENTRIES = 100;

	/**
	 * Store a new credential in the vault
	 */
	async storeCredential(
		params: StoreCredentialParams,
	): Promise<{ success: boolean; credentialId?: string; error?: string }> {
		try {
			const {
				bankCode,
				credentialType,
				value,
				environment,
				description,
				expiresAt,
				createdBy,
			} = params;

			// Encrypt the credential value
			const encryptedValue = encryptionService.encrypt(value);
			if (!encryptedValue) {
				return { success: false, error: "Failed to encrypt credential" };
			}

			// Check if credential already exists (update instead of insert)
			const existing = await db
				.select()
				.from(bankCredentialsVault)
				.where(
					and(
						eq(bankCredentialsVault.bankCode, bankCode),
						eq(bankCredentialsVault.credentialType, credentialType),
						eq(bankCredentialsVault.environment, environment),
						eq(bankCredentialsVault.isActive, true),
					),
				)
				.limit(1);

			if (existing.length > 0) {
				// Deactivate old credential and insert new one (for audit trail)
				await db
					.update(bankCredentialsVault)
					.set({
						isActive: false,
						updatedAt: new Date(),
						metadata: {
							...existing[0].metadata,
							lastRotated: new Date().toISOString(),
						},
					})
					.where(eq(bankCredentialsVault.id, existing[0].id));
			}

			// Insert new credential
			const [inserted] = await db
				.insert(bankCredentialsVault)
				.values({
					bankCode,
					credentialType,
					encryptedValue,
					environment,
					keyVersion:
						existing.length > 0 ? (existing[0].keyVersion || 1) + 1 : 1,
					metadata: {
						description,
						expiresAt: expiresAt?.toISOString(),
						lastRotated: new Date().toISOString(),
					},
					isActive: true,
					createdBy,
				})
				.returning();

			console.log(
				`[Vault] Stored credential: ${bankCode}/${credentialType}/${environment}`,
			);

			return { success: true, credentialId: inserted.id };
		} catch (error: any) {
			console.error("[Vault] Error storing credential:", error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Retrieve a credential from the vault
	 */
	async getCredential(
		bankCode: string,
		credentialType: CredentialType,
		environment: Environment,
	): Promise<VaultCredential | null> {
		try {
			const [credential] = await db
				.select()
				.from(bankCredentialsVault)
				.where(
					and(
						eq(bankCredentialsVault.bankCode, bankCode),
						eq(bankCredentialsVault.credentialType, credentialType),
						eq(bankCredentialsVault.environment, environment),
						eq(bankCredentialsVault.isActive, true),
					),
				)
				.orderBy(desc(bankCredentialsVault.keyVersion))
				.limit(1);

			if (!credential) {
				return null;
			}

			// Decrypt the value
			const decryptedValue = encryptionService.decrypt(
				credential.encryptedValue,
			);
			if (!decryptedValue) {
				console.error(
					`[Vault] Failed to decrypt credential: ${bankCode}/${credentialType}`,
				);
				return null;
			}

			// Log access
			this.logAccess(bankCode, credentialType, environment);

			return {
				bankCode: credential.bankCode,
				credentialType: credential.credentialType as CredentialType,
				value: decryptedValue,
				environment: credential.environment as Environment,
				metadata: credential.metadata as VaultCredential["metadata"],
			};
		} catch (error: any) {
			console.error("[Vault] Error retrieving credential:", error.message);
			return null;
		}
	}

	/**
	 * Get all credentials for a bank (returns types only, not values)
	 */
	async listBankCredentials(
		bankCode: string,
		environment?: Environment,
	): Promise<
		Array<{
			credentialType: string;
			environment: string;
			keyVersion: number;
			hasExpiry: boolean;
			isExpired: boolean;
			createdAt: Date | null;
		}>
	> {
		try {
			const query = db
				.select({
					credentialType: bankCredentialsVault.credentialType,
					environment: bankCredentialsVault.environment,
					keyVersion: bankCredentialsVault.keyVersion,
					metadata: bankCredentialsVault.metadata,
					createdAt: bankCredentialsVault.createdAt,
				})
				.from(bankCredentialsVault)
				.where(
					and(
						eq(bankCredentialsVault.bankCode, bankCode),
						eq(bankCredentialsVault.isActive, true),
						environment
							? eq(bankCredentialsVault.environment, environment)
							: undefined,
					),
				);

			const credentials = await query;

			return credentials.map((cred) => {
				const metadata = cred.metadata as VaultCredential["metadata"];
				const expiresAt = metadata?.expiresAt
					? new Date(metadata.expiresAt)
					: null;

				return {
					credentialType: cred.credentialType,
					environment: cred.environment,
					keyVersion: cred.keyVersion || 1,
					hasExpiry: !!expiresAt,
					isExpired: expiresAt ? expiresAt < new Date() : false,
					createdAt: cred.createdAt,
				};
			});
		} catch (error: any) {
			console.error("[Vault] Error listing credentials:", error.message);
			return [];
		}
	}

	/**
	 * Get multiple credentials at once for a bank
	 */
	async getBankCredentials(
		bankCode: string,
		credentialTypes: CredentialType[],
		environment: Environment,
	): Promise<Map<CredentialType, string>> {
		const result = new Map<CredentialType, string>();

		for (const type of credentialTypes) {
			const cred = await this.getCredential(bankCode, type, environment);
			if (cred) {
				result.set(type, cred.value);
			}
		}

		return result;
	}

	/**
	 * Revoke/delete a credential
	 */
	async revokeCredential(
		bankCode: string,
		credentialType: CredentialType,
		environment: Environment,
	): Promise<boolean> {
		try {
			await db
				.update(bankCredentialsVault)
				.set({ isActive: false, updatedAt: new Date() })
				.where(
					and(
						eq(bankCredentialsVault.bankCode, bankCode),
						eq(bankCredentialsVault.credentialType, credentialType),
						eq(bankCredentialsVault.environment, environment),
						eq(bankCredentialsVault.isActive, true),
					),
				);

			console.log(
				`[Vault] Revoked credential: ${bankCode}/${credentialType}/${environment}`,
			);
			return true;
		} catch (error: any) {
			console.error("[Vault] Error revoking credential:", error.message);
			return false;
		}
	}

	/**
	 * Check if all required credentials exist for a bank
	 */
	async validateBankCredentials(
		bankCode: string,
		requiredTypes: CredentialType[],
		environment: Environment,
	): Promise<{ valid: boolean; missing: CredentialType[] }> {
		const missing: CredentialType[] = [];

		for (const type of requiredTypes) {
			const cred = await this.getCredential(bankCode, type, environment);
			if (!cred) {
				missing.push(type);
			}
		}

		return {
			valid: missing.length === 0,
			missing,
		};
	}

	/**
	 * Get expiring credentials (within days threshold)
	 */
	async getExpiringCredentials(daysThreshold: number = 30): Promise<
		Array<{
			bankCode: string;
			credentialType: string;
			environment: string;
			expiresAt: Date;
			daysRemaining: number;
		}>
	> {
		try {
			const credentials = await db
				.select()
				.from(bankCredentialsVault)
				.where(eq(bankCredentialsVault.isActive, true));

			const now = new Date();
			const thresholdDate = new Date(
				now.getTime() + daysThreshold * 24 * 60 * 60 * 1000,
			);
			const expiring: Array<{
				bankCode: string;
				credentialType: string;
				environment: string;
				expiresAt: Date;
				daysRemaining: number;
			}> = [];

			for (const cred of credentials) {
				const metadata = cred.metadata as VaultCredential["metadata"];
				if (metadata?.expiresAt) {
					const expiresAt = new Date(metadata.expiresAt);
					if (expiresAt <= thresholdDate) {
						const daysRemaining = Math.floor(
							(expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
						);
						expiring.push({
							bankCode: cred.bankCode,
							credentialType: cred.credentialType,
							environment: cred.environment,
							expiresAt,
							daysRemaining,
						});
					}
				}
			}

			return expiring.sort((a, b) => a.daysRemaining - b.daysRemaining);
		} catch (error: any) {
			console.error(
				"[Vault] Error checking expiring credentials:",
				error.message,
			);
			return [];
		}
	}

	/**
	 * Log credential access for audit
	 */
	private logAccess(
		bankCode: string,
		credentialType: string,
		environment: string,
	) {
		const key = `${bankCode}:${credentialType}:${environment}`;
		const accesses = this.accessLog.get(key) || [];
		accesses.push(new Date());

		// Keep only last N entries
		if (accesses.length > this.MAX_ACCESS_LOG_ENTRIES) {
			accesses.shift();
		}

		this.accessLog.set(key, accesses);
	}

	/**
	 * Get access statistics for a credential
	 */
	getAccessStats(
		bankCode: string,
		credentialType: string,
		environment: string,
	): {
		totalAccesses: number;
		lastAccess: Date | null;
		accessesLast24h: number;
	} {
		const key = `${bankCode}:${credentialType}:${environment}`;
		const accesses = this.accessLog.get(key) || [];
		const now = new Date();
		const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

		return {
			totalAccesses: accesses.length,
			lastAccess: accesses.length > 0 ? accesses[accesses.length - 1] : null,
			accessesLast24h: accesses.filter((a) => a > dayAgo).length,
		};
	}
}

export const bankCredentialsVaultService = new BankCredentialsVaultService();
