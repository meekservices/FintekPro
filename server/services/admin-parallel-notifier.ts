/**
 * Admin Parallel Notifier
 *
 * Fire-and-forget dispatcher for admin/agent/compliance tasks.
 * NEVER called with await on the main request path — it always runs in the background.
 *
 * Design principle:
 *  - The client gets their response immediately.
 *  - This service notifies the relevant back-office parties in parallel.
 *  - Tasks are persisted in the DB so they appear on the admin portal task list.
 */

import { db } from "../db";
import * as schema from "@shared/schema";
import { emailService } from "../email-service";
import { whatsappService } from "../whatsapp";
import { logger } from "../logger";
import { sql } from "drizzle-orm";

export type PlatformTaskType =
	| "GATEWAY_NOT_CONFIGURED"
	| "SET_COMMISSION"
	| "HIGH_VALUE_ALERT"
	| "PARTNER_FIRST_ORDER"
	| "KYC_AUTO_REJECTED"
	| "REKYC_LIMIT_REACHED"
	| "PARTNER_KYC_SUBMITTED"
	| "BUSINESS_VERIFICATION_NEEDED"
	| "UNLISTED_REGULATORY_BREACH"
	| "VALUATION_DEVIATION_ALERT";

interface NotifyPayload {
	taskType: PlatformTaskType;
	title: string;
	body: string;
	/** User who triggered the event */
	affectedUserId?: string;
	/** Agent or partner responsible for this user, if any */
	agentId?: string;
	/** Admin email list to notify (defaults to COMPLIANCE_HEAD_EMAIL + COMPLIANCE_MANAGER_EMAIL) */
	adminEmails?: string[];
	/** Extra metadata stored with the task */
	metadata?: Record<string, any>;
	/** Priority: low | medium | high | critical */
	priority?: "low" | "medium" | "high" | "critical";
}

class AdminParallelNotifier {
	private getAdminEmails(extra?: string[]): string[] {
		const defaults = [
			process.env.COMPLIANCE_HEAD_EMAIL,
			process.env.COMPLIANCE_MANAGER_EMAIL,
		].filter(Boolean) as string[];
		return [...new Set([...defaults, ...(extra ?? [])])];
	}

	/**
	 * Dispatch a notification to admin/agent. Fire-and-forget — never await this.
	 */
	dispatch(payload: NotifyPayload): void {
		// setImmediate ensures the caller returns before we do any I/O
		setImmediate(() => {
			this._send(payload).catch((err) => {
				logger.error("[AdminParallelNotifier] dispatch error", {
					taskType: payload.taskType,
					error: err instanceof Error ? err.message : String(err),
				});
			});
		});
	}

	private async _send(payload: NotifyPayload): Promise<void> {
		const {
			taskType,
			title,
			body,
			affectedUserId,
			agentId,
			adminEmails,
			metadata,
			priority = "medium",
		} = payload;

		// ── 1. Persist task to DB (admin portal task list via userNotifications) ──
		try {
			// Find all admin users to notify in-app
			const adminUsers = await db
				.select({ id: schema.users.id })
				.from(schema.users)
				.where(
					sql`${schema.users.roles} @> '["admin"]'::jsonb OR ${schema.users.roles} @> '["superadmin"]'::jsonb OR ${schema.users.roles} @> '["compliance_officer"]'::jsonb`,
				)
				.limit(20);

			for (const admin of adminUsers) {
				await db.insert(schema.userNotifications).values({
					userId: admin.id,
					type:
						priority === "critical" || priority === "high"
							? "alert"
							: "warning",
					title,
					message: body,
					actionUrl: "/admin/tasks",
					priority,
					expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
				});
			}
		} catch (dbErr) {
			// Non-fatal — notifications still fire
			logger.warn(
				"[AdminParallelNotifier] DB insert failed, continuing with email notifications",
				{
					taskType,
					error: dbErr instanceof Error ? dbErr.message : String(dbErr),
				},
			);
		}

		// Also log to platformAuditLogs for compliance tracking
		try {
			await db.insert(schema.platformAuditLogs).values({
				eventType: taskType,
				entityType: "system",
				entityId: affectedUserId ?? "system",
				action: taskType,
				changeDetails: { title, body, priority, metadata },
				severity:
					priority === "critical"
						? "CRITICAL"
						: priority === "high"
							? "HIGH"
							: "INFO",
			});
		} catch {
			/* non-fatal */
		}

		const recipients = this.getAdminEmails(adminEmails);

		// ── 2. Send email to admin ────────────────────────────────────────────────
		for (const email of recipients) {
			try {
				const prefix =
					priority === "critical"
						? "🚨 CRITICAL: "
						: priority === "high"
							? "⚠️ "
							: "";
				await emailService.sendNotificationEmail(
					email,
					`[FintekPro] ${prefix}${title}`,
					`${body}\n\nTask Type: ${taskType}\nPriority: ${priority}\n\nLog in to the admin portal to review and take action: ${process.env.BASE_URL ?? ""}/admin/tasks`,
				);
			} catch (emailErr) {
				logger.warn("[AdminParallelNotifier] Email send failed", {
					email,
					taskType,
				});
			}
		}

		// ── 3. WhatsApp to compliance head (critical only) ────────────────────────
		if (priority === "critical" || priority === "high") {
			const complianceMobile = process.env.COMPLIANCE_HEAD_MOBILE;
			if (complianceMobile) {
				try {
					await whatsappService.sendMessage(
						complianceMobile,
						`*FintekPro Admin Alert*\n*${title}*\n\n${body}\n\n_Priority: ${priority}_`,
					);
				} catch (waErr) {
					logger.warn("[AdminParallelNotifier] WhatsApp send failed", {
						taskType,
					});
				}
			}
		}

		logger.info("[AdminParallelNotifier] Task dispatched", {
			taskType,
			priority,
			recipients: recipients.length,
		});
	}
}

export const adminParallelNotifier = new AdminParallelNotifier();

// ── Convenience factory functions ─────────────────────────────────────────────

export function notifyGatewayNotConfigured(params: {
	instrumentType: string;
	provider: string;
	missingKeys: string[];
	comingSoon: boolean;
	affectedUserId?: string;
	adminNote: string;
}): void {
	adminParallelNotifier.dispatch({
		taskType: "GATEWAY_NOT_CONFIGURED",
		title: params.comingSoon
			? `Coming Soon: ${params.instrumentType} gateway (${params.provider})`
			: `Missing API Keys: ${params.instrumentType} gateway (${params.provider})`,
		body: params.comingSoon
			? `A client attempted to transact in ${params.instrumentType} but this gateway (${params.provider}) is marked as Coming Soon.\n\nAdmin Note: ${params.adminNote}`
			: `A client attempted to transact in ${params.instrumentType} but the gateway is not configured.\n\nMissing env keys: ${params.missingKeys.join(", ")}\n\nAdmin Note: ${params.adminNote}`,
		affectedUserId: params.affectedUserId,
		priority: params.comingSoon ? "low" : "high",
		metadata: {
			instrumentType: params.instrumentType,
			provider: params.provider,
			missingKeys: params.missingKeys,
		},
	});
}

export function notifySetCommission(params: {
	partnerId: string;
	partnerName: string;
	instrumentType: string;
	orderId: string;
}): void {
	adminParallelNotifier.dispatch({
		taskType: "SET_COMMISSION",
		title: `Set commission for ${params.partnerName} — ${params.instrumentType}`,
		body: `Order ${params.orderId} was processed at 0% commission because no commission rate is configured for partner ${params.partnerName} on product ${params.instrumentType}. Please set the commission % before the next payout cycle.`,
		priority: "medium",
		metadata: params,
	});
}

export function notifyHighValueTransaction(params: {
	userId: string;
	orderId: string;
	amount: number;
	instrumentType: string;
	agentId?: string;
}): void {
	adminParallelNotifier.dispatch({
		taskType: "HIGH_VALUE_ALERT",
		title: `High-value transaction: ₹${params.amount.toLocaleString("en-IN")} — ${params.instrumentType}`,
		body: `A transaction exceeding ₹10 Lakh was automatically submitted.\n\nOrder ID: ${params.orderId}\nAmount: ₹${params.amount.toLocaleString("en-IN")}\nInstrument: ${params.instrumentType}\nUser ID: ${params.userId}`,
		affectedUserId: params.userId,
		agentId: params.agentId,
		priority: "high",
		metadata: params,
	});
}

export function notifyKycAutoRejected(params: {
	userId: string;
	role: string;
	reason: string;
	attemptsRemaining: number;
}): void {
	adminParallelNotifier.dispatch({
		taskType: "KYC_AUTO_REJECTED",
		title: `KYC auto-rejected for ${params.role} user`,
		body: `System auto-rejected KYC for user ${params.userId}.\nReason: ${params.reason}\nAttempts remaining: ${params.attemptsRemaining}`,
		affectedUserId: params.userId,
		priority: "medium",
		metadata: params,
	});
}

export function notifyPartnerKycSubmitted(params: {
	userId: string;
	partnerName: string;
	entityType: string;
}): void {
	adminParallelNotifier.dispatch({
		taskType: "PARTNER_KYC_SUBMITTED",
		title: `Partner KYC submitted — ${params.partnerName}`,
		body: `${params.partnerName} (${params.entityType}) has submitted their KYC. The system is auto-verifying. The only admin task remaining is to set their commission percentage once verification completes.`,
		affectedUserId: params.userId,
		priority: "low",
		metadata: params,
	});
}

export function notifyGrievanceSubmitted(params: {
	ticketId: string;
	userId: string;
	category: string;
	subject: string;
	expectedResolutionDate: Date;
}): void {
	adminParallelNotifier.dispatch({
		taskType: "GRIEVANCE_SUBMITTED" as any,
		title: `Grievance submitted: ${params.subject}`,
		body: `A client has submitted a grievance (${params.category}).\\n\\nTicket ID: ${params.ticketId}\\nSubject: ${params.subject}\\nExpected Resolution: ${params.expectedResolutionDate.toLocaleDateString("en-IN")} (T+30 per SEBI mandate).\\n\\nPlease review and respond within 30 calendar days.`,
		affectedUserId: params.userId,
		priority: "medium",
		metadata: params,
	});
}
