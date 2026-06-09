import { db } from "../db";
import { partnerAuditLogs } from "@shared/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";

export class PartnerAuditService {
	private static instance: PartnerAuditService;

	static getInstance(): PartnerAuditService {
		if (!PartnerAuditService.instance) {
			PartnerAuditService.instance = new PartnerAuditService();
		}
		return PartnerAuditService.instance;
	}

	// TICKET 8: Log a partner action (immutable)
	async log(data: {
		actorId: string;
		action: string;
		entityType: string;
		entityId: string;
		metadata?: Record<string, any>;
		ipAddress?: string;
	}): Promise<void> {
		await db.insert(partnerAuditLogs).values({
			actorId: data.actorId,
			action: data.action,
			entityType: data.entityType,
			entityId: data.entityId,
			metadata: data.metadata || {},
			ipAddress: data.ipAddress || null,
		});
	}

	// Pre-defined log helpers for common actions
	async logPartnerCreation(
		actorId: string,
		partnerId: string,
		partnerData: any,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "PARTNER_CREATED",
			entityType: "partner",
			entityId: partnerId,
			metadata: {
				companyName: partnerData.companyName,
				partnerLevel: partnerData.partnerLevel,
				parentPartnerId: partnerData.parentPartnerId,
				hierarchyPartnerType: partnerData.hierarchyPartnerType,
			},
			ipAddress,
		});
	}

	async logPartnerApproval(
		actorId: string,
		partnerId: string,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "PARTNER_APPROVED",
			entityType: "partner",
			entityId: partnerId,
			metadata: { approvedBy: actorId },
			ipAddress,
		});
	}

	async logPartnerRejection(
		actorId: string,
		partnerId: string,
		reason?: string,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "PARTNER_REJECTED",
			entityType: "partner",
			entityId: partnerId,
			metadata: { rejectedBy: actorId, reason },
			ipAddress,
		});
	}

	async logClientReassignment(
		actorId: string,
		clientId: string,
		oldOwnerId: string,
		newOwnerId: string,
		reason: string,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "CLIENT_REASSIGNED",
			entityType: "client_ownership",
			entityId: clientId,
			metadata: { oldOwnerId, newOwnerId, reason },
			ipAddress,
		});
	}

	async logCommissionOverride(
		actorId: string,
		ruleId: string,
		changes: any,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "COMMISSION_OVERRIDE",
			entityType: "commission_rule",
			entityId: ruleId,
			metadata: changes,
			ipAddress,
		});
	}

	async logManualPayout(
		actorId: string,
		partnerId: string,
		amount: number,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "MANUAL_PAYOUT",
			entityType: "partner_wallet",
			entityId: partnerId,
			metadata: { amount },
			ipAddress,
		});
	}

	async logPartnerSuspension(
		actorId: string,
		partnerId: string,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "PARTNER_SUSPENDED",
			entityType: "partner",
			entityId: partnerId,
			metadata: { suspendedBy: actorId },
			ipAddress,
		});
	}

	async logPartnerTermination(
		actorId: string,
		partnerId: string,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "PARTNER_TERMINATED",
			entityType: "partner",
			entityId: partnerId,
			metadata: { terminatedBy: actorId },
			ipAddress,
		});
	}

	async logKycUpdate(
		actorId: string,
		partnerId: string,
		oldStatus: string,
		newStatus: string,
		ipAddress?: string,
	): Promise<void> {
		await this.log({
			actorId,
			action: "KYC_STATUS_UPDATED",
			entityType: "partner",
			entityId: partnerId,
			metadata: { oldStatus, newStatus },
			ipAddress,
		});
	}

	// Query audit logs
	async getAuditLogs(filters: {
		entityType?: string;
		entityId?: string;
		actorId?: string;
		action?: string;
		fromDate?: Date;
		toDate?: Date;
		limit?: number;
		offset?: number;
	}): Promise<{ logs: any[]; total: number }> {
		const conditions: any[] = [];

		if (filters.entityType)
			conditions.push(eq(partnerAuditLogs.entityType, filters.entityType));
		if (filters.entityId)
			conditions.push(eq(partnerAuditLogs.entityId, filters.entityId));
		if (filters.actorId)
			conditions.push(eq(partnerAuditLogs.actorId, filters.actorId));
		if (filters.action)
			conditions.push(eq(partnerAuditLogs.action, filters.action));
		if (filters.fromDate)
			conditions.push(gte(partnerAuditLogs.createdAt, filters.fromDate));
		if (filters.toDate)
			conditions.push(lte(partnerAuditLogs.createdAt, filters.toDate));

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const logs = await db
			.select()
			.from(partnerAuditLogs)
			.where(whereClause)
			.orderBy(desc(partnerAuditLogs.createdAt))
			.limit(filters.limit || 50)
			.offset(filters.offset || 0);

		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(partnerAuditLogs)
			.where(whereClause);

		return {
			logs,
			total: Number(countResult[0]?.count || 0),
		};
	}

	// Get audit trail for a specific entity
	async getEntityAuditTrail(
		entityType: string,
		entityId: string,
	): Promise<any[]> {
		return db
			.select()
			.from(partnerAuditLogs)
			.where(
				and(
					eq(partnerAuditLogs.entityType, entityType),
					eq(partnerAuditLogs.entityId, entityId),
				),
			)
			.orderBy(desc(partnerAuditLogs.createdAt));
	}
}

export const partnerAuditService = PartnerAuditService.getInstance();
