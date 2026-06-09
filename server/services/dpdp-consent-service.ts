import { db } from "../db";
import { eq, and, isNull, lt, desc, sql } from "drizzle-orm";
import { consentLogs, type ConsentLog } from "@shared/schema";

const CONSENT_PURPOSES = {
	KYC_DATA_COLLECTION: {
		code: "KYC_DC",
		description:
			"Collection and processing of identity documents for KYC verification as per SEBI/RBI regulations",
		retentionDays: 3650,
		regulatory: "SEBI/RBI/PMLA",
	},
	AADHAAR_VERIFICATION: {
		code: "AADHAAR_V",
		description:
			"Aadhaar number verification via UIDAI for identity confirmation",
		retentionDays: 3650,
		regulatory: "UIDAI/PMLA",
	},
	PAN_VERIFICATION: {
		code: "PAN_V",
		description:
			"PAN card verification via NSDL/CDSL for tax identity confirmation",
		retentionDays: 3650,
		regulatory: "Income Tax Act",
	},
	CREDIT_CHECK: {
		code: "CREDIT_C",
		description: "Credit score and history check via CIBIL/credit bureaus",
		retentionDays: 365,
		regulatory: "RBI Credit Bureau Guidelines",
	},
	BANK_VERIFICATION: {
		code: "BANK_V",
		description:
			"Bank account verification via penny drop/UPI for fund settlement",
		retentionDays: 1825,
		regulatory: "RBI",
	},
	MARKETING: {
		code: "MARKETING",
		description: "Communication about products, offers, and updates",
		retentionDays: 365,
		regulatory: "DPDP Act 2023",
	},
	DATA_SHARING: {
		code: "DATA_SH",
		description:
			"Sharing verified identity data with authorized financial service providers",
		retentionDays: 365,
		regulatory: "DPDP Act 2023",
	},
	CKYC_SUBMISSION: {
		code: "CKYC_S",
		description: "Submission and retrieval of Central KYC records via CERSAI",
		retentionDays: 3650,
		regulatory: "PMLA/SEBI",
	},
} as const;

class DpdpConsentService {
	async captureConsent(params: {
		userId: string;
		consentType: keyof typeof CONSENT_PURPOSES;
		consentGiven: boolean;
		ipAddress?: string;
		userAgent?: string;
		version?: string;
	}): Promise<ConsentLog> {
		const purpose = CONSENT_PURPOSES[params.consentType];
		const now = new Date();
		const retentionExpiresAt = new Date(
			now.getTime() + purpose.retentionDays * 24 * 60 * 60 * 1000,
		);

		console.log(
			`[DPDP-CONSENT] Capturing consent for user ${params.userId}, type: ${params.consentType}, given: ${params.consentGiven}`,
		);

		const [record] = await db
			.insert(consentLogs)
			.values({
				userId: params.userId,
				consentType: params.consentType,
				purposeCode: purpose.code,
				purposeDescription: purpose.description,
				consentGiven: params.consentGiven,
				consentTimestamp: now,
				ipAddress: params.ipAddress,
				userAgent: params.userAgent,
				dataRetentionDays: purpose.retentionDays,
				retentionExpiresAt,
				regulatoryBasis: purpose.regulatory,
				version: params.version || "1.0",
			})
			.returning();

		console.log(
			`[DPDP-CONSENT] Consent recorded with id ${record.id} for user ${params.userId}`,
		);
		return record;
	}

	async withdrawConsent(
		userId: string,
		consentType: string,
		reason: string,
	): Promise<void> {
		console.log(
			`[DPDP-CONSENT] Withdrawing consent for user ${userId}, type: ${consentType}, reason: ${reason}`,
		);

		const [latest] = await db
			.select()
			.from(consentLogs)
			.where(
				and(
					eq(consentLogs.userId, userId),
					eq(consentLogs.consentType, consentType),
					eq(consentLogs.consentGiven, true),
					isNull(consentLogs.withdrawnAt),
				),
			)
			.orderBy(desc(consentLogs.consentTimestamp))
			.limit(1);

		if (!latest) {
			console.log(
				`[DPDP-CONSENT] No active consent found for user ${userId}, type: ${consentType}`,
			);
			return;
		}

		await db
			.update(consentLogs)
			.set({
				withdrawnAt: new Date(),
				withdrawalReason: reason,
			})
			.where(eq(consentLogs.id, latest.id));

		console.log(
			`[DPDP-CONSENT] Consent id ${latest.id} withdrawn for user ${userId}`,
		);
	}

	async getActiveConsents(userId: string): Promise<ConsentLog[]> {
		return db
			.select()
			.from(consentLogs)
			.where(
				and(
					eq(consentLogs.userId, userId),
					eq(consentLogs.consentGiven, true),
					isNull(consentLogs.withdrawnAt),
				),
			);
	}

	async hasActiveConsent(
		userId: string,
		consentType: string,
	): Promise<boolean> {
		const [result] = await db
			.select()
			.from(consentLogs)
			.where(
				and(
					eq(consentLogs.userId, userId),
					eq(consentLogs.consentType, consentType),
					eq(consentLogs.consentGiven, true),
					isNull(consentLogs.withdrawnAt),
				),
			)
			.limit(1);

		return !!result;
	}

	async getConsentHistory(userId: string): Promise<ConsentLog[]> {
		return db
			.select()
			.from(consentLogs)
			.where(eq(consentLogs.userId, userId))
			.orderBy(desc(consentLogs.consentTimestamp));
	}

	async checkRetentionExpiry(): Promise<{
		expired: ConsentLog[];
		expiringSoon: ConsentLog[];
	}> {
		const now = new Date();
		const thirtyDaysFromNow = new Date(
			now.getTime() + 30 * 24 * 60 * 60 * 1000,
		);

		const expired = await db
			.select()
			.from(consentLogs)
			.where(
				and(
					eq(consentLogs.consentGiven, true),
					isNull(consentLogs.withdrawnAt),
					lt(consentLogs.retentionExpiresAt, now),
				),
			);

		const expiringSoon = await db
			.select()
			.from(consentLogs)
			.where(
				and(
					eq(consentLogs.consentGiven, true),
					isNull(consentLogs.withdrawnAt),
					lt(consentLogs.retentionExpiresAt, thirtyDaysFromNow),
					sql`${consentLogs.retentionExpiresAt} >= ${now}`,
				),
			);

		console.log(
			`[DPDP-CONSENT] Retention check: ${expired.length} expired, ${expiringSoon.length} expiring soon`,
		);
		return { expired, expiringSoon };
	}

	getPurposes(): typeof CONSENT_PURPOSES {
		return CONSENT_PURPOSES;
	}
}

export const dpdpConsentService = new DpdpConsentService();
