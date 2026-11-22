/**
 * Partner Agreement & Revenue Tracking Service
 *
 * Facilitates agreement upload, versioning, SHA-256 non-repudiation hashing,
 * instrument-category commission schedule extraction, and real-time revenue
 * tracking for Sub-Brokers (Authorized Persons) and Financial Product Distributors.
 *
 * Statutory Alignment:
 * - SEBI (Stock Brokers) Regulations, 1992 (Authorized Person / Sub-Broker Framework)
 * - SEBI (Investment Advisers) Regulations, 2013, Regulation 22 (Segregation)
 * - AMFI Code of Conduct (100% trail-only distribution, zero rebating)
 * - Income Tax Act Section 194H (5% TDS compliance on payouts)
 */

import crypto from "crypto";
import { db } from "../db";
import {
	partners,
	partnerHierarchyAgreements,
	partnerCommissionRules,
	partnerCommissionLedger,
	partnerWallets,
	partnerAuditLogs,
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { logger } from "../logger";

export type AgreementType =
	| "SUB_BROKER"
	| "DISTRIBUTOR"
	| "FRANCHISEE"
	| "CORPORATE_B2B"
	| "REFERRAL_AGENT";

export type AgreementStatus =
	| "DRAFT"
	| "PENDING_APPROVAL"
	| "ACTIVE"
	| "SUSPENDED"
	| "TERMINATED"
	| "EXPIRED";

export interface CommissionSchedule {
	equityDeliveryPct?: number; // e.g. 60%
	equityIntradayPct?: number; // e.g. 60%
	fnoOptionsPct?: number; // e.g. 65%
	fnoFuturesPct?: number; // e.g. 65%
	mutualFundsTrailPct?: number; // e.g. 70%
	bondsPct?: number; // e.g. 50%
	pmsPct?: number; // e.g. 60%
	insurancePct?: number; // e.g. 70%
	corporateFdPct?: number; // e.g. 70%
	defaultAgentPct?: number; // fallback %
}

export interface UploadAgreementInput {
	partnerId: string;
	agreementType: AgreementType;
	documentBase64?: string;
	documentUrl?: string;
	fileName: string;
	fileSize?: number;
	mimeType?: string;
	effectiveFrom?: string | Date;
	effectiveTo?: string | Date;
	commissionSchedule: CommissionSchedule;
	eSignReference?: string;
	notes?: string;
	uploadedBy?: string;
	autoApprove?: boolean;
}

export interface InstrumentRevenueBreakdown {
	productType: string;
	grossVolume: number;
	grossCommission: number;
	partnerEarnings: number;
	platformRetention: number;
	transactionCount: number;
}

export interface AgreementRevenueMetrics {
	agreementId: string;
	partnerId: string;
	agreementType: string;
	agreementStatus: string;
	documentHash: string;
	effectiveFrom: string;
	effectiveTo: string | null;
	totalTransactionVolume: number;
	totalGrossCommission: number;
	totalPartnerEarnings: number;
	totalPlatformRetention: number;
	estimatedTdsDeducted: number; // 5% u/s 194H
	netPayableToPartner: number;
	totalUniqueClients: number;
	totalTransactions: number;
	breakdownByInstrument: InstrumentRevenueBreakdown[];
	commissionSchedule: CommissionSchedule;
	lastUpdated: string;
}

export class PartnerAgreementService {
	private static instance: PartnerAgreementService;

	public static getInstance(): PartnerAgreementService {
		if (!PartnerAgreementService.instance) {
			PartnerAgreementService.instance = new PartnerAgreementService();
		}
		return PartnerAgreementService.instance;
	}

	/**
	 * Computes SHA-256 cryptographic hash of document data for non-repudiation
	 */
	public computeDocumentHash(content: string | Buffer): string {
		return crypto.createHash("sha256").update(content).digest("hex");
	}

	/**
	 * Uploads and records an executed Sub-Broker or Distributor commercial agreement
	 */
	public async uploadAgreement(input: UploadAgreementInput): Promise<{
		success: boolean;
		agreementId?: string;
		documentHash?: string;
		status?: AgreementStatus;
		error?: string;
	}> {
		try {
			// 1. Verify Partner Existence
			const [partner] = await db
				.select()
				.from(partners)
				.where(eq(partners.id, input.partnerId))
				.limit(1);

			if (!partner) {
				return { success: false, error: `Partner with ID ${input.partnerId} not found` };
			}

			// 2. Generate SHA-256 hash for document integrity
			const docContent = input.documentBase64 || input.documentUrl || input.fileName;
			const documentHash = this.computeDocumentHash(docContent);

			// 3. Resolve effective dates
			const effectiveFrom = input.effectiveFrom
				? new Date(input.effectiveFrom)
				: new Date();
			const effectiveTo = input.effectiveTo
				? new Date(input.effectiveTo)
				: null;

			const initialStatus: AgreementStatus = input.autoApprove
				? "ACTIVE"
				: "PENDING_APPROVAL";

			// 4. Construct metadata payload
			const agreementMetadata = {
				fileName: input.fileName,
				fileSize: input.fileSize || 0,
				mimeType: input.mimeType || "application/pdf",
				documentHash,
				eSignReference: input.eSignReference || null,
				commissionSchedule: input.commissionSchedule,
				notes: input.notes || null,
				uploadedBy: input.uploadedBy || "PARTNER_PORTAL",
				uploadedAt: new Date().toISOString(),
			};

			// 5. Insert into partnerHierarchyAgreements
			const [newAgreement] = await db
				.insert(partnerHierarchyAgreements)
				.values({
					partnerId: input.partnerId,
					agreementType: input.agreementType,
					agreementDocument: input.documentUrl || `document_hash://${documentHash}`,
					agreementStatus: initialStatus,
					effectiveFrom,
					effectiveTo,
					approvedBy: input.autoApprove ? input.uploadedBy || "SYSTEM_ADMIN" : null,
					approvedAt: input.autoApprove ? new Date() : null,
					metadata: agreementMetadata,
				})
				.returning();

			// 6. If activated immediately, link as active agreement on partner and configure commission rules
			if (initialStatus === "ACTIVE") {
				await db
					.update(partners)
					.set({
						agreementId: newAgreement.id,
						updatedAt: new Date(),
					})
					.where(eq(partners.id, input.partnerId));

				await this.syncCommissionRules(input.partnerId, input.commissionSchedule);
			}

			// 7. Audit Log
			try {
				await db.insert(partnerAuditLogs).values({
					actorId: input.uploadedBy || input.partnerId,
					action: "AGREEMENT_UPLOADED",
					entityType: "partner_hierarchy_agreements",
					entityId: newAgreement.id,
					metadata: {
						partnerId: input.partnerId,
						actorRole: "PARTNER_ADMIN",
						agreementType: input.agreementType,
						documentHash,
						status: initialStatus,
					},
				});
			} catch (auditErr: any) {
				logger.warn("[PartnerAgreement] Audit log insertion skipped:", auditErr.message);
			}

			return {
				success: true,
				agreementId: newAgreement.id,
				documentHash,
				status: initialStatus,
			};
		} catch (error: any) {
			logger.error("[PartnerAgreement] uploadAgreement error:", error.message);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Synchronizes agreement commission schedule to active partnerCommissionRules
	 */
	private async syncCommissionRules(
		partnerId: string,
		schedule: CommissionSchedule,
	): Promise<void> {
		const instrumentMapping: Array<{ productType: string; agentPct: number }> = [
			{
				productType: "equity_delivery",
				agentPct: schedule.equityDeliveryPct ?? schedule.defaultAgentPct ?? 60,
			},
			{
				productType: "equity_intraday",
				agentPct: schedule.equityIntradayPct ?? schedule.defaultAgentPct ?? 60,
			},
			{
				productType: "fno",
				agentPct: schedule.fnoOptionsPct ?? schedule.defaultAgentPct ?? 60,
			},
			{
				productType: "mutual_funds",
				agentPct: schedule.mutualFundsTrailPct ?? schedule.defaultAgentPct ?? 70,
			},
			{
				productType: "bonds",
				agentPct: schedule.bondsPct ?? schedule.defaultAgentPct ?? 50,
			},
			{
				productType: "pms",
				agentPct: schedule.pmsPct ?? schedule.defaultAgentPct ?? 60,
			},
			{
				productType: "insurance",
				agentPct: schedule.insurancePct ?? schedule.defaultAgentPct ?? 70,
			},
		];

		for (const item of instrumentMapping) {
			const platformPct = Math.max(0, 100 - item.agentPct);
			await db.insert(partnerCommissionRules).values({
				productType: item.productType,
				agentPct: item.agentPct.toFixed(2),
				subPartnerPct: "0.00",
				masterPartnerPct: "0.00",
				platformPct: platformPct.toFixed(2),
				isActive: true,
				createdBy: "AGREEMENT_SYNC",
			});
		}
	}

	/**
	 * Approves an agreement and binds it as active for revenue tracking
	 */
	public async approveAgreement(
		agreementId: string,
		adminId: string,
		notes?: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const [agreement] = await db
				.select()
				.from(partnerHierarchyAgreements)
				.where(eq(partnerHierarchyAgreements.id, agreementId))
				.limit(1);

			if (!agreement) {
				return { success: false, error: "Agreement not found" };
			}

			const currentMetadata = (agreement.metadata as any) || {};
			const updatedMetadata = {
				...currentMetadata,
				approvalNotes: notes || null,
			};

			await db
				.update(partnerHierarchyAgreements)
				.set({
					agreementStatus: "ACTIVE",
					approvedBy: adminId,
					approvedAt: new Date(),
					metadata: updatedMetadata,
					updatedAt: new Date(),
				})
				.where(eq(partnerHierarchyAgreements.id, agreementId));

			// Update partner active agreement ID
			await db
				.update(partners)
				.set({
					agreementId: agreement.id,
					updatedAt: new Date(),
				})
				.where(eq(partners.id, agreement.partnerId));

			if (currentMetadata.commissionSchedule) {
				await this.syncCommissionRules(
					agreement.partnerId,
					currentMetadata.commissionSchedule,
				);
			}

			return { success: true };
		} catch (error: any) {
			return { success: false, error: error.message };
		}
	}

	/**
	 * Lists all agreements associated with a Sub-Broker or Distributor
	 */
	public async getPartnerAgreements(partnerId: string): Promise<any[]> {
		return db
			.select()
			.from(partnerHierarchyAgreements)
			.where(eq(partnerHierarchyAgreements.partnerId, partnerId))
			.orderBy(desc(partnerHierarchyAgreements.createdAt));
	}

	/**
	 * Tracks real-time cumulative revenue, commission pool, and instrument breakdown
	 * attributed to a specific executed agreement
	 */
	public async trackAgreementRevenue(
		agreementId: string,
	): Promise<{ success: boolean; data?: AgreementRevenueMetrics; error?: string }> {
		try {
			const [agreement] = await db
				.select()
				.from(partnerHierarchyAgreements)
				.where(eq(partnerHierarchyAgreements.id, agreementId))
				.limit(1);

			if (!agreement) {
				return { success: false, error: "Agreement not found" };
			}

			const partnerId = agreement.partnerId;
			const effectiveFrom = agreement.effectiveFrom || new Date(0);
			const effectiveTo = agreement.effectiveTo;
			const metadata = (agreement.metadata as any) || {};

			// Query all transactions logged in partnerCommissionLedger during this agreement's active window
			const ledgerEntries = await db
				.select()
				.from(partnerCommissionLedger)
				.where(
					and(
						eq(partnerCommissionLedger.partnerId, partnerId),
						gte(partnerCommissionLedger.createdAt, effectiveFrom),
						effectiveTo ? lte(partnerCommissionLedger.createdAt, effectiveTo) : sql`TRUE`,
					),
				);

			let totalTransactionVolume = 0;
			let totalGrossCommission = 0;
			let totalPartnerEarnings = 0;
			const uniqueClients = new Set<string>();

			const instrumentMap: Record<
				string,
				{
					grossVolume: number;
					grossCommission: number;
					partnerEarnings: number;
					platformRetention: number;
					transactionCount: number;
				}
			> = {};

			for (const entry of ledgerEntries) {
				const txAmount = Number.parseFloat(entry.transactionAmount?.toString() || "0");
				const commAmount = Number.parseFloat(entry.commissionAmount?.toString() || "0");

				totalTransactionVolume += txAmount;
				totalPartnerEarnings += commAmount;

				// Metadata check for gross commission vs split
				const entryMeta = (entry.metadata as any) || {};
				const grossComm = entryMeta.grossCommission
					? Number.parseFloat(entryMeta.grossCommission)
					: commAmount * 1.4; // fallback estimate
				totalGrossCommission += grossComm;

				if (entry.orderId) uniqueClients.add(entry.orderId);

				const pType = entry.productType || "general";
				if (!instrumentMap[pType]) {
					instrumentMap[pType] = {
						grossVolume: 0,
						grossCommission: 0,
						partnerEarnings: 0,
						platformRetention: 0,
						transactionCount: 0,
					};
				}
				instrumentMap[pType].grossVolume += txAmount;
				instrumentMap[pType].grossCommission += grossComm;
				instrumentMap[pType].partnerEarnings += commAmount;
				instrumentMap[pType].platformRetention += Math.max(0, grossComm - commAmount);
				instrumentMap[pType].transactionCount++;
			}

			const totalPlatformRetention = Math.max(
				0,
				totalGrossCommission - totalPartnerEarnings,
			);
			const estimatedTdsDeducted = Math.round(totalPartnerEarnings * 0.05 * 100) / 100; // 5% TDS u/s 194H
			const netPayableToPartner =
				Math.round((totalPartnerEarnings - estimatedTdsDeducted) * 100) / 100;

			const breakdownByInstrument: InstrumentRevenueBreakdown[] = Object.keys(
				instrumentMap,
			).map((pType) => ({
				productType: pType,
				grossVolume: Math.round(instrumentMap[pType].grossVolume * 100) / 100,
				grossCommission: Math.round(instrumentMap[pType].grossCommission * 100) / 100,
				partnerEarnings: Math.round(instrumentMap[pType].partnerEarnings * 100) / 100,
				platformRetention: Math.round(instrumentMap[pType].platformRetention * 100) / 100,
				transactionCount: instrumentMap[pType].transactionCount,
			}));

			const metrics: AgreementRevenueMetrics = {
				agreementId: agreement.id,
				partnerId: agreement.partnerId,
				agreementType: agreement.agreementType,
				agreementStatus: agreement.agreementStatus || "DRAFT",
				documentHash: metadata.documentHash || "NOT_COMPUTED",
				effectiveFrom: effectiveFrom.toISOString(),
				effectiveTo: effectiveTo ? effectiveTo.toISOString() : null,
				totalTransactionVolume: Math.round(totalTransactionVolume * 100) / 100,
				totalGrossCommission: Math.round(totalGrossCommission * 100) / 100,
				totalPartnerEarnings: Math.round(totalPartnerEarnings * 100) / 100,
				totalPlatformRetention: Math.round(totalPlatformRetention * 100) / 100,
				estimatedTdsDeducted,
				netPayableToPartner,
				totalUniqueClients: uniqueClients.size,
				totalTransactions: ledgerEntries.length,
				breakdownByInstrument,
				commissionSchedule: metadata.commissionSchedule || {},
				lastUpdated: new Date().toISOString(),
			};

			return { success: true, data: metrics };
		} catch (error: any) {
			logger.error("[PartnerAgreement] trackAgreementRevenue error:", error.message);
			return { success: false, error: error.message };
		}
	}
}

export const partnerAgreementService = PartnerAgreementService.getInstance();
