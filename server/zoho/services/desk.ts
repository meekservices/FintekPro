/**
 * Zoho Desk Service — server/zoho/services/desk.ts
 * Provides Zoho Desk API v1 access via ZohoApiClient.
 * Used by deskAgent.ts for ticket intelligence.
 *
 * GUARDRAIL: No tickets are closed, replied to, or escalated without Admin approval.
 *
 * @purpose Zoho Desk REST API v1 wrapper
 * @inputs  connectionId (zoho_connections.id), Zoho Desk data center
 * @outputs Typed Desk entities
 */

import { ZohoApiClient } from "../api-client";
import { db } from "../../db";
import { zohoConnections } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface ZohoDeskTicket {
	id: string;
	ticketNumber: string;
	subject: string;
	status: string; // Open | On Hold | In Progress | Escalated | Closed
	priority: string; // Low | Medium | High | Urgent
	channel: string; // Email | Twitter | Chat | Phone | Web | etc.
	contactId?: string;
	contact?: {
		id: string;
		lastName?: string;
		firstName?: string;
		email?: string;
	};
	departmentId?: string;
	department?: { id: string; name: string };
	assigneeId?: string;
	assignee?: { id: string; name: string; email?: string };
	description?: string;
	createdTime: string;
	modifiedTime: string;
	dueDate?: string;
	closedTime?: string;
	responseDueDate?: string;
	slaId?: string;
	isOverDue: boolean;
	isEscalated: boolean;
	threadCount: number;
	commentCount: number;
	cf?: Record<string, unknown>; // Custom fields
}

export interface ZohoDeskThread {
	id: string;
	content: string;
	isPublic: boolean;
	type: "thread" | "comment";
	direction: "in" | "out";
	fromEmail?: string;
	toEmail?: string;
	createdTime: string;
}

export interface ZohoDeskDepartment {
	id: string;
	name: string;
	description?: string;
	isEnabled: boolean;
	agentCount: number;
}

export interface ZohoDeskAgent {
	id: string;
	name: string;
	email: string;
	status: string;
	role?: string;
}

interface PaginatedResponse<T> {
	data: T[];
	count: number;
	offset: number;
}

export class ZohoDeskService {
	private client: ZohoApiClient;

	constructor(connectionId: string, dataCenter: string = "in") {
		this.client = new ZohoApiClient(connectionId, "Desk", dataCenter);
	}

	// ── Departments ────────────────────────────────────────────────────────────

	async getDepartments(): Promise<ZohoDeskDepartment[]> {
		const response = await this.client.get("/departments", { isEnabled: true });
		return response.data?.data || [];
	}

	// ── Agents ─────────────────────────────────────────────────────────────────

	async getAgents(params?: { limit?: number; from?: number }): Promise<
		ZohoDeskAgent[]
	> {
		const response = await this.client.get("/agents", {
			limit: params?.limit ?? 50,
			from: params?.from ?? 0,
		});
		return response.data?.data || [];
	}

	// ── Tickets ────────────────────────────────────────────────────────────────

	/**
	 * List tickets with filtering.
	 * @param params - Filter and pagination options
	 */
	async getTickets(params?: {
		status?: "Open" | "On Hold" | "In Progress" | "Escalated" | "Closed";
		priority?: "Low" | "Medium" | "High" | "Urgent";
		departmentId?: string;
		assigneeId?: string;
		limit?: number;
		from?: number;
		sortBy?: "createdTime" | "modifiedTime" | "dueDate" | "priority";
		include?: string; // 'contacts,assignee,departments'
	}): Promise<PaginatedResponse<ZohoDeskTicket>> {
		const response = await this.client.get("/tickets", {
			status: params?.status,
			priority: params?.priority,
			departmentId: params?.departmentId,
			assigneeId: params?.assigneeId,
			limit: params?.limit ?? 50,
			from: params?.from ?? 0,
			sortBy: params?.sortBy ?? "createdTime",
			include: params?.include ?? "contacts,assignee,departments",
		});
		return {
			data: response.data?.data || [],
			count: response.data?.count ?? 0,
			offset: params?.from ?? 0,
		};
	}

	/**
	 * Get a single ticket with all details.
	 * @param ticketId - Zoho Desk ticket ID
	 */
	async getTicket(ticketId: string): Promise<ZohoDeskTicket | null> {
		const response = await this.client.get(`/tickets/${ticketId}`, {
			include: "contacts,assignee,departments",
		});
		return response.data?.data || null;
	}

	/**
	 * Get all thread/reply entries for a ticket.
	 * @param ticketId - Zoho Desk ticket ID
	 */
	async getTicketThreads(ticketId: string): Promise<ZohoDeskThread[]> {
		const response = await this.client.get(`/tickets/${ticketId}/threads`, {
			include: "plainText",
		});
		return response.data?.data || [];
	}

	/**
	 * Search tickets by keyword.
	 */
	async searchTickets(
		keyword: string,
		params?: { limit?: number; from?: number },
	): Promise<ZohoDeskTicket[]> {
		const response = await this.client.get("/tickets/search", {
			subject: keyword,
			limit: params?.limit ?? 25,
			from: params?.from ?? 0,
			include: "contacts,assignee",
		});
		return response.data?.data || [];
	}

	/**
	 * Get overdue tickets (dueDate < now AND status != Closed).
	 */
	async getOverdueTickets(departmentId?: string): Promise<ZohoDeskTicket[]> {
		const params: Record<string, unknown> = {
			isOverDue: true,
			limit: 100,
			from: 0,
			include: "contacts,assignee,departments",
		};
		if (departmentId) params.departmentId = departmentId;
		const response = await this.client.get("/tickets", params);
		return (response.data?.data || []).filter(
			(t: ZohoDeskTicket) => t.status !== "Closed",
		);
	}

	/**
	 * Get escalated tickets.
	 */
	async getEscalatedTickets(): Promise<ZohoDeskTicket[]> {
		const response = await this.client.get("/tickets", {
			isEscalated: true,
			limit: 100,
			from: 0,
			include: "contacts,assignee",
		});
		return response.data?.data || [];
	}

	// ── Mutations (all require Admin approval before calling from deskAgent) ───

	/**
	 * Reply to a ticket thread.
	 * GUARDRAIL: This is only called after 2-step Admin confirmation.
	 */
	async replyToTicket(
		ticketId: string,
		data: { content: string; isPublic?: boolean; fromName?: string },
	): Promise<{ id: string }> {
		const response = await this.client.post(`/tickets/${ticketId}/sendReply`, {
			content: data.content,
			isPublic: data.isPublic ?? false,
			fromName: data.fromName,
			channel: "EMAIL",
		});
		return response.data?.data || {};
	}

	/**
	 * Update ticket status/priority/assignee.
	 * GUARDRAIL: Only called after Admin approval.
	 */
	async updateTicket(
		ticketId: string,
		updates: {
			status?: string;
			priority?: string;
			assigneeId?: string;
			resolution?: string;
		},
	): Promise<boolean> {
		await this.client.patch(`/tickets/${ticketId}`, updates);
		return true;
	}

	/**
	 * Escalate a ticket.
	 * GUARDRAIL: Only called after Admin approval.
	 */
	async escalateTicket(ticketId: string, reason?: string): Promise<boolean> {
		await this.client.post(`/tickets/${ticketId}/escalate`, {
			comment: reason,
		});
		return true;
	}

	// ── Summary (for BI/copilot dashboard) ────────────────────────────────────

	async getTicketSummary(): Promise<{
		open: number;
		overdue: number;
		escalated: number;
		highPriority: number;
		unassigned: number;
	}> {
		const [allOpen, overdue, escalated, high] = await Promise.all([
			this.getTickets({ status: "Open", limit: 1 }),
			this.getOverdueTickets(),
			this.getEscalatedTickets(),
			this.getTickets({ priority: "High", limit: 1 }),
		]);
		const unassigned = allOpen.data.filter((t) => !t.assigneeId).length;
		return {
			open: allOpen.count,
			overdue: overdue.length,
			escalated: escalated.length,
			highPriority: high.count,
			unassigned,
		};
	}
}

/**
 * Factory: get a ZohoDeskService from the first active Zoho connection.
 * Desk uses the same Zoho OAuth connection as CRM/Books.
 */
export async function getZohoDeskService(
	dataCenter: string = "in",
): Promise<ZohoDeskService | null> {
	try {
		const [connection] = await db
			.select()
			.from(zohoConnections)
			.where(eq(zohoConnections.status, "active"))
			.limit(1);

		if (!connection) {
			console.warn("[ZohoDeskService] No active Zoho connection found");
			return null;
		}
		return new ZohoDeskService(connection.id, dataCenter);
	} catch (err) {
		console.error("[ZohoDeskService] Init error:", err);
		return null;
	}
}

console.log("✅ Zoho Desk Service initialized");
