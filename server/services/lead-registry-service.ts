import { db } from "../db";
import { leadRegistry, leadAuditLogs, LeadRegistry } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";

const STATUS_ORDER = [
	"REGISTERED",
	"LOGGED_IN",
	"APPROVED",
	"DISBURSED",
] as const;

export class LeadRegistryService {
	private static instance: LeadRegistryService;

	static getInstance(): LeadRegistryService {
		if (!LeadRegistryService.instance)
			LeadRegistryService.instance = new LeadRegistryService();
		return LeadRegistryService.instance;
	}

	async registerLead(data: {
		pan: string;
		mobile: string;
		customerName: string;
		loanType: string;
		approxAmount?: string;
		agentId: string;
		partnerId: string;
		partnerHierarchySnapshot?: any;
		ipAddress?: string;
	}): Promise<{ success: true; lead: LeadRegistry; isExisting: boolean }> {
		const existing = await db
			.select()
			.from(leadRegistry)
			.where(
				and(
					eq(leadRegistry.pan, data.pan),
					eq(leadRegistry.mobile, data.mobile),
				),
			);

		if (existing.length > 0) {
			return { success: true, lead: existing[0], isExisting: true };
		}

		const [lead] = await db
			.insert(leadRegistry)
			.values({
				pan: data.pan,
				mobile: data.mobile,
				customerName: data.customerName,
				loanType: data.loanType,
				approxAmount: data.approxAmount,
				firstAgentId: data.agentId,
				firstPartnerId: data.partnerId,
				partnerHierarchySnapshot: data.partnerHierarchySnapshot || {},
				status: "REGISTERED",
				statusHistory: [
					{
						status: "REGISTERED",
						timestamp: new Date(),
						actorId: data.agentId,
					},
				],
			})
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId: lead.leadId,
			actorId: data.agentId,
			actorRole: "AGENT",
			action: "LEAD_REGISTERED",
			details: { pan: data.pan, mobile: data.mobile, loanType: data.loanType },
			ipAddress: data.ipAddress,
		});

		return { success: true, lead, isExisting: false };
	}

	async setProcessingMode(
		leadId: string,
		mode: string,
		actorId: string,
		ipAddress?: string,
	): Promise<{ success: boolean; lead?: LeadRegistry; error?: string }> {
		const [lead] = await db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.leadId, leadId));

		if (!lead) {
			return { success: false, error: "Lead not found" };
		}

		if (lead.processingMode) {
			return {
				success: false,
				error: "Processing mode already set and cannot be changed",
			};
		}

		const [updated] = await db
			.update(leadRegistry)
			.set({
				processingMode: mode as any,
				processingModeSetAt: new Date(),
			})
			.where(eq(leadRegistry.leadId, leadId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId,
			actorId,
			actorRole: "AGENT",
			action: "PROCESSING_MODE_SET",
			details: { mode },
			ipAddress,
		});

		return { success: true, lead: updated };
	}

	async setFinancierDetails(
		leadId: string,
		data: {
			financierName: string;
			bankerName: string;
			bankerMobile: string;
			bankerEmail: string;
		},
		actorId: string,
		ipAddress?: string,
	): Promise<{ success: boolean; lead?: LeadRegistry; error?: string }> {
		const [lead] = await db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.leadId, leadId));

		if (!lead) {
			return { success: false, error: "Lead not found" };
		}

		if (lead.processingMode !== "EXTERNAL_FINANCIER") {
			return {
				success: false,
				error: "Financier details only applicable for external processing",
			};
		}

		const [updated] = await db
			.update(leadRegistry)
			.set({
				financierName: data.financierName,
				bankerName: data.bankerName,
				bankerMobile: data.bankerMobile,
				bankerEmail: data.bankerEmail,
				financierSetAt: new Date(),
			})
			.where(eq(leadRegistry.leadId, leadId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId,
			actorId,
			actorRole: "AGENT",
			action: "FINANCIER_SET",
			details: {
				financierName: data.financierName,
				bankerName: data.bankerName,
			},
			ipAddress,
		});

		return { success: true, lead: updated };
	}

	async updateStatus(
		leadId: string,
		newStatus: string,
		actorId: string,
		actorRole: string,
		ipAddress?: string,
	): Promise<{ success: boolean; lead?: LeadRegistry; error?: string }> {
		const [lead] = await db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.leadId, leadId));

		if (!lead) {
			return { success: false, error: "Lead not found" };
		}

		if (!lead.processingMode) {
			return {
				success: false,
				error: "Processing mode must be set before updating status",
			};
		}

		const currentIndex = STATUS_ORDER.indexOf(lead.status as any);
		const newIndex = STATUS_ORDER.indexOf(newStatus as any);

		if (newIndex === -1) {
			return { success: false, error: `Invalid status: ${newStatus}` };
		}

		if (newIndex <= currentIndex) {
			return {
				success: false,
				error: `Cannot transition from ${lead.status} to ${newStatus}. Only forward transitions are allowed.`,
			};
		}

		const existingHistory = Array.isArray(lead.statusHistory)
			? lead.statusHistory
			: [];
		const updatedHistory = [
			...existingHistory,
			{ status: newStatus, timestamp: new Date(), actorId, actorRole },
		];

		const [updated] = await db
			.update(leadRegistry)
			.set({
				status: newStatus as any,
				statusHistory: updatedHistory,
			})
			.where(eq(leadRegistry.leadId, leadId))
			.returning();

		await db.insert(leadAuditLogs).values({
			leadId,
			actorId,
			actorRole,
			action: "STATUS_UPDATED",
			details: { previousStatus: lead.status, newStatus },
			ipAddress,
		});

		return { success: true, lead: updated };
	}

	async getLeadById(leadId: string): Promise<LeadRegistry | null> {
		const [lead] = await db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.leadId, leadId));
		return lead || null;
	}

	async getLeadsByAgent(agentId: string): Promise<LeadRegistry[]> {
		return db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.firstAgentId, agentId))
			.orderBy(desc(leadRegistry.createdAt));
	}

	async getLeadsByPartner(partnerId: string): Promise<LeadRegistry[]> {
		return db
			.select()
			.from(leadRegistry)
			.where(eq(leadRegistry.firstPartnerId, partnerId))
			.orderBy(desc(leadRegistry.createdAt));
	}
}

export const leadRegistryService = LeadRegistryService.getInstance();
