/**
 * Consent Management Service for Auto-Population
 *
 * Manages user consent for fetching data from external sources:
 * - Mutual Funds (BSE STAR, CAS)
 * - Demat Holdings (NSDL/CDSL)
 * - Bank Accounts (Account Aggregator)
 * - Loan Liabilities (CIBIL)
 * - Insurance Policies (Turtlefin)
 *
 * Compliance: RBI Account Aggregator Framework, SEBI regulations
 */

import { db } from "../db";
import {
	dataSourceConsents,
	type InsertDataSourceConsent,
	type DataSourceConsent,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export type DataSourceType =
	| "mutual_funds"
	| "demat"
	| "bank"
	| "loans"
	| "insurance"
	| "epf"
	| "nps"
	| "apy";
export type SyncFrequency = "daily" | "weekly" | "monthly" | "manual";

interface ConsentRequest {
	userId: string;
	dataSource: DataSourceType;
	provider?: string;
	consentPurpose: string;
	ipAddress?: string;
	userAgent?: string;
	syncFrequency?: SyncFrequency;
	validityDays?: number; // Default: 90 days
}

interface ConsentStatus {
	hasConsent: boolean;
	consentId?: string;
	expiresAt?: Date;
	lastSyncedAt?: Date | null;
	isExpired: boolean;
}

export class ConsentManagementService {
	/**
	 * Grant consent for a data source
	 */
	async grantConsent(request: ConsentRequest): Promise<DataSourceConsent> {
		const validityDays = request.validityDays || 90; // Default: 90 days per RBI AA guidelines
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + validityDays);

		const consentText = this.getConsentText(
			request.dataSource,
			request.provider,
		);

		const consentRecord: InsertDataSourceConsent = {
			userId: request.userId,
			dataSource: request.dataSource,
			provider: request.provider || this.getDefaultProvider(request.dataSource),
			consentGiven: true,
			consentPurpose: request.consentPurpose,
			consentText,
			ipAddress: request.ipAddress,
			userAgent: request.userAgent,
			expiresAt,
			syncFrequency: request.syncFrequency || "weekly",
			isActive: true,
			regulatoryCompliance: {
				framework: "RBI_AA_2021",
				dataLocalization: true,
				userConsent: true,
				consentTimestamp: new Date().toISOString(),
			},
		};

		const [consent] = await db
			.insert(dataSourceConsents)
			.values(consentRecord)
			.returning();

		console.log(
			`✅ Consent granted for ${request.dataSource} by user ${request.userId}`,
		);

		return consent;
	}

	/**
	 * Grant consents for selected data sources (batch operation)
	 */
	async grantBatchConsents(
		userId: string,
		dataSources: DataSourceType[],
		consentPurpose: string = "auto_populate_holdings",
		ipAddress?: string,
		userAgent?: string,
	): Promise<DataSourceConsent[]> {
		const consents: DataSourceConsent[] = [];

		for (const dataSource of dataSources) {
			const consent = await this.grantConsent({
				userId,
				dataSource,
				consentPurpose,
				ipAddress,
				userAgent,
				syncFrequency: "weekly",
				validityDays: 365, // 1 year validity for auto-population
			});
			consents.push(consent);
		}

		console.log(
			`✅ Batch consents granted for user ${userId} (${consents.length} sources: ${dataSources.join(", ")})`,
		);
		return consents;
	}

	/**
	 * Check if user has valid consent for a data source
	 */
	async checkConsent(
		userId: string,
		dataSource: DataSourceType,
	): Promise<ConsentStatus> {
		const consent = await db
			.select()
			.from(dataSourceConsents)
			.where(
				and(
					eq(dataSourceConsents.userId, userId),
					eq(dataSourceConsents.dataSource, dataSource),
					eq(dataSourceConsents.isActive, true),
				),
			)
			.orderBy(desc(dataSourceConsents.consentedAt))
			.limit(1);

		if (consent.length === 0) {
			return {
				hasConsent: false,
				isExpired: false,
			};
		}

		const consentRecord = consent[0];
		const now = new Date();
		const isExpired =
			consentRecord.expiresAt && new Date(consentRecord.expiresAt) < now;

		// Auto-revoke expired consents
		if (isExpired && consentRecord.isActive) {
			await this.revokeConsent(
				consentRecord.id,
				"Consent expired automatically",
			);
		}

		return {
			hasConsent: !isExpired && consentRecord.consentGiven,
			consentId: consentRecord.id,
			expiresAt: consentRecord.expiresAt
				? new Date(consentRecord.expiresAt)
				: undefined,
			lastSyncedAt: consentRecord.lastSyncedAt
				? new Date(consentRecord.lastSyncedAt)
				: null,
			isExpired,
		};
	}

	/**
	 * Get all active consents for a user
	 */
	async getUserConsents(userId: string): Promise<DataSourceConsent[]> {
		const consents = await db
			.select()
			.from(dataSourceConsents)
			.where(
				and(
					eq(dataSourceConsents.userId, userId),
					eq(dataSourceConsents.isActive, true),
				),
			)
			.orderBy(desc(dataSourceConsents.consentedAt));

		// Filter out expired consents
		const now = new Date();
		return consents.filter((consent) => {
			const isExpired = consent.expiresAt && new Date(consent.expiresAt) < now;
			return !isExpired;
		});
	}

	/**
	 * Revoke consent for a data source
	 */
	async revokeConsent(consentId: string, reason: string): Promise<void> {
		await db
			.update(dataSourceConsents)
			.set({
				isActive: false,
				revokedAt: new Date(),
				revokeReason: reason,
			})
			.where(eq(dataSourceConsents.id, consentId));

		console.log(`❌ Consent revoked: ${consentId} - Reason: ${reason}`);
	}

	/**
	 * Update last synced timestamp after successful data fetch
	 */
	async updateSyncTimestamp(consentId: string): Promise<void> {
		const consent = await db
			.select()
			.from(dataSourceConsents)
			.where(eq(dataSourceConsents.id, consentId))
			.limit(1);

		if (consent.length === 0) return;

		const nextSyncDue = this.calculateNextSyncDue(
			consent[0].syncFrequency as SyncFrequency,
		);

		await db
			.update(dataSourceConsents)
			.set({
				lastSyncedAt: new Date(),
				nextSyncDue,
			})
			.where(eq(dataSourceConsents.id, consentId));
	}

	/**
	 * Get consents that are due for sync
	 */
	async getConsentsDueForSync(): Promise<DataSourceConsent[]> {
		const now = new Date();

		const consents = await db
			.select()
			.from(dataSourceConsents)
			.where(
				and(
					eq(dataSourceConsents.isActive, true),
					eq(dataSourceConsents.consentGiven, true),
				),
			);

		return consents.filter((consent) => {
			if (!consent.nextSyncDue) return false;
			return new Date(consent.nextSyncDue) <= now;
		});
	}

	/**
	 * Generate standardized consent text per data source
	 */
	private getConsentText(
		dataSource: DataSourceType,
		provider?: string,
	): string {
		const baseText = `I hereby grant consent to FintekPro to fetch and store my ${this.getDataSourceLabel(dataSource)} data from ${provider || this.getDefaultProvider(dataSource)} for the purpose of portfolio management and financial planning.`;

		const dataUsage = `\n\nData Usage: The fetched data will be used to provide personalized financial insights, track investments, and generate reports.`;

		const dataProtection = `\n\nData Protection: All data will be encrypted and stored securely. FintekPro will not share this data with third parties without explicit consent.`;

		const revokeRights = `\n\nRevocation Rights: You can revoke this consent at any time through your account settings. Upon revocation, all fetched data will be retained as per regulatory requirements but no new data will be fetched.`;

		const validity = `\n\nValidity: This consent is valid for 90 days and will require renewal thereafter.`;

		return baseText + dataUsage + dataProtection + revokeRights + validity;
	}

	/**
	 * Get human-readable label for data source
	 */
	private getDataSourceLabel(dataSource: DataSourceType): string {
		const labels: Record<DataSourceType, string> = {
			mutual_funds: "Mutual Fund Holdings",
			demat: "Demat Account Holdings",
			bank: "Bank Account Information",
			loans: "Loan Liabilities",
			insurance: "Insurance Policies",
			epf: "EPF/VPF Account Information",
			nps: "National Pension System Accounts",
			apy: "Atal Pension Yojana Benefits",
		};
		return labels[dataSource];
	}

	/**
	 * Get default provider for each data source
	 */
	private getDefaultProvider(dataSource: DataSourceType): string {
		const providers: Record<DataSourceType, string> = {
			mutual_funds: "BSE STAR MFD API",
			demat: "NSDL/CDSL",
			bank: "Account Aggregator",
			loans: "CIBIL Credit Bureau",
			insurance: "Turtlefin Insurance API",
			epf: "EPFO API",
			nps: "NPS CRA (Central Recordkeeping Agency)",
			apy: "Account Aggregator / NSDL",
		};
		return providers[dataSource];
	}

	/**
	 * Calculate next sync due date based on frequency
	 */
	private calculateNextSyncDue(frequency: SyncFrequency): Date {
		const now = new Date();
		const nextSync = new Date(now);

		switch (frequency) {
			case "daily":
				nextSync.setDate(now.getDate() + 1);
				break;
			case "weekly":
				nextSync.setDate(now.getDate() + 7);
				break;
			case "monthly":
				nextSync.setMonth(now.getMonth() + 1);
				break;
			case "manual":
				nextSync.setFullYear(now.getFullYear() + 10); // Far future for manual
				break;
		}

		return nextSync;
	}

	/**
	 * Get consent expiry warnings (consents expiring in next 7 days)
	 */
	async getExpiringConsents(userId: string): Promise<DataSourceConsent[]> {
		const now = new Date();
		const warningThreshold = new Date();
		warningThreshold.setDate(now.getDate() + 7); // 7 days warning

		const consents = await this.getUserConsents(userId);

		return consents.filter((consent) => {
			if (!consent.expiresAt) return false;
			const expiryDate = new Date(consent.expiresAt);
			return expiryDate > now && expiryDate <= warningThreshold;
		});
	}

	/**
	 * Bulk grant consents for all data sources (post-KYC auto-population)
	 */
	async grantAllConsents(
		userId: string,
		ipAddress?: string,
		userAgent?: string,
	): Promise<DataSourceConsent[]> {
		const dataSources: DataSourceType[] = [
			"mutual_funds",
			"demat",
			"bank",
			"loans",
			"insurance",
		];

		const consents: DataSourceConsent[] = [];

		for (const dataSource of dataSources) {
			const consent = await this.grantConsent({
				userId,
				dataSource,
				consentPurpose: "auto_populate_holdings",
				ipAddress,
				userAgent,
				syncFrequency: "weekly",
				validityDays: 90,
			});
			consents.push(consent);
		}

		console.log(
			`✅ All consents granted for user ${userId} (${consents.length} sources)`,
		);
		return consents;
	}
}

// Export singleton instance
export const consentManagementService = new ConsentManagementService();
