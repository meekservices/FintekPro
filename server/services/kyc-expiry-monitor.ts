/**
 * GAP 4 FIX: KYC Expiry Monitor
 * Runs on server startup (and daily via setInterval) to check:
 *   - ARN expiry dates on agents and partners
 *   - Flags expired agents: suspends commission flow
 *   - Warns agents expiring within 30 days
 *
 * SEBI/AMFI require: ARN renewal every 3 years; EUIN/NISM renewal annually.
 */

import { db } from "../db";
import { agents, partners } from "@shared/schema";
import { eq, and, lte, gte, isNotNull, sql } from "drizzle-orm";

const WARNING_DAYS = 30; // warn this many days before expiry
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // run daily

interface ExpiryAlert {
	entityId: string;
	entityType: "agent" | "partner";
	name: string;
	email: string;
	arnCode: string | null;
	arnExpiryDate: Date;
	daysUntilExpiry: number;
	severity: "EXPIRED" | "CRITICAL" | "WARNING";
}

export class KycExpiryMonitor {
	private static instance: KycExpiryMonitor;
	private intervalHandle: ReturnType<typeof setInterval> | null = null;

	static getInstance(): KycExpiryMonitor {
		if (!KycExpiryMonitor.instance) {
			KycExpiryMonitor.instance = new KycExpiryMonitor();
		}
		return KycExpiryMonitor.instance;
	}

	/** Start the daily monitor. Call once at server startup. */
	start(): void {
		console.log("[KycExpiryMonitor] Starting daily KYC expiry checks...");
		this.runCheck().catch((e) =>
			console.error("[KycExpiryMonitor] Initial check error:", e),
		);
		this.intervalHandle = setInterval(() => {
			this.runCheck().catch((e) =>
				console.error("[KycExpiryMonitor] Check error:", e),
			);
		}, CHECK_INTERVAL_MS);
	}

	stop(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}

	/** Run a full expiry check across agents and partners. */
	async runCheck(): Promise<ExpiryAlert[]> {
		const now = new Date();
		const warnDate = new Date(
			now.getTime() + WARNING_DAYS * 24 * 60 * 60 * 1000,
		);
		const alerts: ExpiryAlert[] = [];

		// Check agents table
		try {
			const expiredOrSoonAgents = await db.execute(sql`
        SELECT id, full_name, email, arn_code, arn_expiry_date
        FROM agents
        WHERE arn_expiry_date IS NOT NULL
          AND arn_expiry_date <= ${warnDate.toISOString()}::timestamp
          AND is_active = true
      `);
			const agentRows =
				(expiredOrSoonAgents as any).rows || expiredOrSoonAgents;
			for (const row of agentRows) {
				const expiry = new Date(row.arn_expiry_date);
				const daysUntil = Math.floor(
					(expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
				);
				const alert: ExpiryAlert = {
					entityId: row.id,
					entityType: "agent",
					name: row.full_name,
					email: row.email,
					arnCode: row.arn_code,
					arnExpiryDate: expiry,
					daysUntilExpiry: daysUntil,
					severity:
						daysUntil <= 0
							? "EXPIRED"
							: daysUntil <= 7
								? "CRITICAL"
								: "WARNING",
				};
				alerts.push(alert);
				await this.handleAlert(alert);
			}
		} catch (e: any) {
			if (e?.code === "42703") {
				console.warn(
					"[KycExpiryMonitor] Agent table missing arn_expiry_date column — skipping (run migration to enable)",
				);
			} else {
				console.error("[KycExpiryMonitor] Agent check error:", e);
			}
		}

		// Check partners table
		try {
			const expiredOrSoonPartners = await db.execute(sql`
        SELECT id, company_name, contact_email, arn_code, arn_expiry_date
        FROM partners
        WHERE arn_expiry_date IS NOT NULL
          AND arn_expiry_date <= ${warnDate.toISOString()}::timestamp
          AND is_active = true
      `);
			const partnerRows =
				(expiredOrSoonPartners as any).rows || expiredOrSoonPartners;
			for (const row of partnerRows) {
				const expiry = new Date(row.arn_expiry_date);
				const daysUntil = Math.floor(
					(expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
				);
				const alert: ExpiryAlert = {
					entityId: row.id,
					entityType: "partner",
					name: row.company_name,
					email: row.contact_email,
					arnCode: row.arn_code,
					arnExpiryDate: expiry,
					daysUntilExpiry: daysUntil,
					severity:
						daysUntil <= 0
							? "EXPIRED"
							: daysUntil <= 7
								? "CRITICAL"
								: "WARNING",
				};
				alerts.push(alert);
				await this.handleAlert(alert);
			}
		} catch (e: any) {
			if (e?.code === "42703") {
				console.warn(
					"[KycExpiryMonitor] Partner table missing arn_expiry_date column — skipping (run migration to enable)",
				);
			} else {
				console.error("[KycExpiryMonitor] Partner check error:", e);
			}
		}

		if (alerts.length > 0) {
			console.log(
				`[KycExpiryMonitor] Found ${alerts.length} expiry alert(s): ${alerts.filter((a) => a.severity === "EXPIRED").length} expired, ${alerts.filter((a) => a.severity === "CRITICAL").length} critical, ${alerts.filter((a) => a.severity === "WARNING").length} warning`,
			);
		}

		return alerts;
	}

	/** Handle a single alert: suspend if expired, log warning otherwise. */
	private async handleAlert(alert: ExpiryAlert): Promise<void> {
		if (alert.severity === "EXPIRED") {
			// Suspend commission flow by updating KYC status
			try {
				if (alert.entityType === "agent") {
					await db
						.update(agents)
						.set({
							status: "suspended",
							isActive: false,
						})
						.where(eq(agents.id, alert.entityId));
				} else {
					await db
						.update(partners)
						.set({
							kycStatus: "EXPIRED",
							hierarchyStatus: "SUSPENDED",
						})
						.where(eq(partners.id, alert.entityId));
				}
				console.log(
					`[KycExpiryMonitor] SUSPENDED ${alert.entityType} ${alert.name} (${alert.entityId}) — ARN expired ${Math.abs(alert.daysUntilExpiry)} days ago`,
				);
			} catch (e) {
				console.error(
					`[KycExpiryMonitor] Failed to suspend ${alert.entityType} ${alert.entityId}:`,
					e,
				);
			}
		} else {
			console.warn(
				`[KycExpiryMonitor] ${alert.severity}: ${alert.entityType} "${alert.name}" ARN expires in ${alert.daysUntilExpiry} days (${alert.arnExpiryDate.toISOString().split("T")[0]})`,
			);
		}
	}

	/** Get current expiry alerts (for admin dashboard). */
	async getAlerts(): Promise<ExpiryAlert[]> {
		return this.runCheck();
	}
}

export const kycExpiryMonitor = KycExpiryMonitor.getInstance();
