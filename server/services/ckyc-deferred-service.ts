// @ts-nocheck
/**
 * CKYC Deferred Case Management Service
 *
 * Manages deferred CKYC cases when all providers are exhausted.
 * Implements SEBI-compliant SLA tracking and escalation.
 *
 * Key Features:
 * - Transaction blocking for deferred users
 * - SLA monitoring with automatic escalation
 * - Admin case management workflow
 * - Audit trail for inspection
 */

import { db } from "../db";
import {
	ckycDeferredCases,
	users,
	type CkycDeferredCase,
	type InsertCkycDeferredCase,
} from "@shared/schema";
import { eq, and, desc, lt, gte, sql, count, isNull } from "drizzle-orm";
import { ckycEnvironmentService } from "./ckyc-environment-service";
import { ckycAuditService } from "./ckyc-audit-service";

export interface DeferredCaseAgingBuckets {
	lessThan24h: number;
	between24And72h: number;
	moreThan72h: number;
	total: number;
	breached: number;
}

export interface DeferredCaseSummary {
	id: string;
	userId: string;
	panNumber: string;
	status: string;
	deferralCode: string;
	deferralMessage: string | null;
	lastProviderAttempted: string | null;
	slaStartedAt: Date;
	slaDeadline: Date;
	slaBreach: boolean;
	agingBucket: "<24h" | "24-72h" | ">72h";
	assignedToAdmin: string | null;
	createdAt: Date;
}

export interface DeferredCaseDetail extends DeferredCaseSummary {
	fallbackAttempts: Array<{
		provider: string;
		reason: string;
		timestamp: string;
	}>;
	adminAction: string | null;
	adminActionReason: string | null;
	adminActionAt: Date | null;
	resolvedAt: Date | null;
	resolutionMethod: string | null;
	resolutionNotes: string | null;
	escalationLevel: number;
	escalatedAt: Date | null;
	escalatedTo: string | null;
	user?: {
		firstName: string | null;
		lastName: string | null;
		email: string | null;
		mobile: string | null;
	};
}

export interface AdminAction {
	action: "manual_kyc_initiated" | "vkyc_scheduled" | "rejected" | "resolved";
	reason: string;
	adminId: string;
}

class CkycDeferredService {
	private static instance: CkycDeferredService;

	private constructor() {}

	static getInstance(): CkycDeferredService {
		if (!CkycDeferredService.instance) {
			CkycDeferredService.instance = new CkycDeferredService();
		}
		return CkycDeferredService.instance;
	}

	async createDeferredCase(
		data: Omit<InsertCkycDeferredCase, "slaDeadline"> & { slaHours?: number },
	): Promise<CkycDeferredCase> {
		const slaHours = data.slaHours || 72;
		const slaDeadline = ckycEnvironmentService.calculateSlaDeadline(slaHours);

		const [created] = await db
			.insert(ckycDeferredCases)
			.values({
				...data,
				slaDeadline,
			})
			.returning();

		console.log(
			`[CKYC Deferred] Created case for user ${data.userId}, SLA deadline: ${slaDeadline.toISOString()}`,
		);

		return created;
	}

	async getDeferredCaseByUserId(
		userId: string,
	): Promise<CkycDeferredCase | null> {
		const [result] = await db
			.select()
			.from(ckycDeferredCases)
			.where(
				and(
					eq(ckycDeferredCases.userId, userId),
					eq(ckycDeferredCases.status, "ckyc_deferred"),
				),
			)
			.limit(1);

		return result || null;
	}

	async getAgingBuckets(): Promise<DeferredCaseAgingBuckets> {
		const now = new Date();
		const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
		const seventyTwoHoursAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

		const allCases = await db
			.select()
			.from(ckycDeferredCases)
			.where(eq(ckycDeferredCases.status, "ckyc_deferred"));

		let lessThan24h = 0;
		let between24And72h = 0;
		let moreThan72h = 0;
		let breached = 0;

		for (const c of allCases) {
			const slaStarted = new Date(c.slaStartedAt);

			if (slaStarted > twentyFourHoursAgo) {
				lessThan24h++;
			} else if (slaStarted > seventyTwoHoursAgo) {
				between24And72h++;
			} else {
				moreThan72h++;
			}

			if (c.slaBreach) {
				breached++;
			}
		}

		return {
			lessThan24h,
			between24And72h,
			moreThan72h,
			total: allCases.length,
			breached,
		};
	}

	async getAllDeferredCases(filters?: {
		status?: string;
		assignedTo?: string;
		breachedOnly?: boolean;
		limit?: number;
		offset?: number;
	}): Promise<{ cases: DeferredCaseSummary[]; total: number }> {
		let query = db
			.select()
			.from(ckycDeferredCases)
			.orderBy(desc(ckycDeferredCases.createdAt));

		const conditions = [];

		if (filters?.status) {
			conditions.push(eq(ckycDeferredCases.status, filters.status));
		}

		if (filters?.assignedTo) {
			conditions.push(
				eq(ckycDeferredCases.assignedToAdmin, filters.assignedTo),
			);
		}

		if (filters?.breachedOnly) {
			conditions.push(eq(ckycDeferredCases.slaBreach, true));
		}

		if (conditions.length > 0) {
			query = query.where(and(...conditions)) as any;
		}

		if (filters?.limit) {
			query = query.limit(filters.limit) as any;
		}

		if (filters?.offset) {
			query = query.offset(filters.offset) as any;
		}

		const results = await query;

		const countResult = await db
			.select({ count: count() })
			.from(ckycDeferredCases)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		return {
			cases: results.map((c) => this.toCaseSummary(c)),
			total: Number(countResult[0]?.count || 0),
		};
	}

	async getDeferredCaseById(
		caseId: string,
	): Promise<DeferredCaseDetail | null> {
		const [result] = await db
			.select()
			.from(ckycDeferredCases)
			.leftJoin(users, eq(ckycDeferredCases.userId, users.id))
			.where(eq(ckycDeferredCases.id, caseId))
			.limit(1);

		if (!result) return null;

		const caseData = result.ckyc_deferred_cases;
		const userData = result.users;

		return {
			...this.toCaseSummary(caseData),
			fallbackAttempts: (caseData.fallbackAttempts as any[]) || [],
			adminAction: caseData.adminAction,
			adminActionReason: caseData.adminActionReason,
			adminActionAt: caseData.adminActionAt,
			resolvedAt: caseData.resolvedAt,
			resolutionMethod: caseData.resolutionMethod,
			resolutionNotes: caseData.resolutionNotes,
			escalationLevel: caseData.escalationLevel || 0,
			escalatedAt: caseData.escalatedAt,
			escalatedTo: caseData.escalatedTo,
			user: userData
				? {
						firstName: userData.firstName,
						lastName: userData.lastName,
						email: userData.email,
						mobile: userData.mobile,
					}
				: undefined,
		};
	}

	async takeAdminAction(
		caseId: string,
		action: AdminAction,
	): Promise<CkycDeferredCase> {
		const now = new Date();

		// Get current case state for audit logging
		const [currentCase] = await db
			.select()
			.from(ckycDeferredCases)
			.where(eq(ckycDeferredCases.id, caseId))
			.limit(1);

		const previousStatus = currentCase?.status || "unknown";

		let newStatus = "ckyc_deferred";
		let resolvedAt: Date | null = null;

		if (
			action.action === "manual_kyc_initiated" ||
			action.action === "vkyc_scheduled"
		) {
			newStatus = "manual_review_in_progress";
		} else if (action.action === "resolved") {
			newStatus = "resolved";
			resolvedAt = now;
		} else if (action.action === "rejected") {
			newStatus = "rejected";
			resolvedAt = now;
		}

		const [updated] = await db
			.update(ckycDeferredCases)
			.set({
				status: newStatus,
				adminAction: action.action,
				adminActionReason: action.reason,
				adminActionAt: now,
				assignedToAdmin: action.adminId,
				resolvedAt,
				resolutionMethod:
					action.action === "resolved" ? "admin_override" : null,
				updatedAt: now,
			})
			.where(eq(ckycDeferredCases.id, caseId))
			.returning();

		// Log to audit trail
		await ckycAuditService.logAdminAction(
			caseId,
			updated.userId,
			updated.panNumber,
			action.action,
			action.reason,
			action.adminId,
			"Admin User", // Would need to fetch admin name from users table
		);

		// If status changed, log status change
		if (previousStatus !== newStatus) {
			await ckycAuditService.logStatusChange(
				caseId,
				updated.userId,
				updated.panNumber,
				previousStatus,
				newStatus,
				action.adminId,
				"Admin User",
				action.reason,
			);
		}

		// If resolved, log resolution
		if (newStatus === "resolved" || newStatus === "rejected") {
			await ckycAuditService.logResolution(
				caseId,
				updated.userId,
				updated.panNumber,
				newStatus === "resolved" ? "admin_override" : "rejected",
				action.reason,
				action.adminId,
				"Admin User",
			);
		}

		console.log(
			`[CKYC Deferred] Admin action ${action.action} on case ${caseId} by ${action.adminId}`,
		);

		return updated;
	}

	async checkAndEscalateSLABreaches(): Promise<number> {
		const now = new Date();

		const breachedCases = await db
			.select()
			.from(ckycDeferredCases)
			.where(
				and(
					eq(ckycDeferredCases.status, "ckyc_deferred"),
					eq(ckycDeferredCases.slaBreach, false),
					lt(ckycDeferredCases.slaDeadline, now),
				),
			);

		for (const c of breachedCases) {
			await db
				.update(ckycDeferredCases)
				.set({
					slaBreach: true,
					slaBreachedAt: now,
					escalationLevel: 1,
					escalatedAt: now,
					updatedAt: now,
				})
				.where(eq(ckycDeferredCases.id, c.id));

			console.warn(
				`[CKYC Deferred] SLA breach for case ${c.id}, escalating to compliance head`,
			);
		}

		return breachedCases.length;
	}

	isUserDeferred(userId: string): Promise<boolean> {
		return this.getDeferredCaseByUserId(userId).then((c) => !!c);
	}

	async blockTransactionForDeferredUser(
		userId: string,
	): Promise<{ blocked: boolean; message?: string }> {
		const deferredCase = await this.getDeferredCaseByUserId(userId);

		if (deferredCase) {
			return {
				blocked: true,
				message:
					"Your CKYC verification is pending. Some transactions are restricted until verification is complete. Our team is working on your case.",
			};
		}

		return { blocked: false };
	}

	private toCaseSummary(c: CkycDeferredCase): DeferredCaseSummary {
		const agingBucket = ckycEnvironmentService.getSlaAgingBucket(
			new Date(c.slaStartedAt),
		);

		return {
			id: c.id,
			userId: c.userId,
			panNumber: c.panNumber,
			status: c.status,
			deferralCode: c.deferralCode,
			deferralMessage: c.deferralMessage,
			lastProviderAttempted: c.lastProviderAttempted,
			slaStartedAt: c.slaStartedAt,
			slaDeadline: c.slaDeadline,
			slaBreach: c.slaBreach || false,
			agingBucket,
			assignedToAdmin: c.assignedToAdmin,
			createdAt: c.createdAt,
		};
	}
}

export const ckycDeferredService = CkycDeferredService.getInstance();
