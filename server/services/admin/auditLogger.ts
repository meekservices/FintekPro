import { logger } from "../../logger";

export enum AuditEventType {
	USER_LOGIN = "USER_LOGIN",
	KYC_SUBMITTED = "KYC_SUBMITTED",
	TRADE_EXECUTED = "TRADE_EXECUTED",
	PORTFOLIO_SYNC = "PORTFOLIO_SYNC",
	RISK_PROFILE_UPDATED = "RISK_PROFILE_UPDATED",
	ADMIN_ACTION = "ADMIN_ACTION",
}

export class AuditLogger {
	/**
	 * Logs an immutable audit record for compliance and regulatory reporting
	 */
	async logEvent(
		eventType: AuditEventType,
		userId: string,
		metadata: Record<string, any>,
		ipAddress?: string,
	) {
		try {
			const auditPayload = {
				timestamp: new Date().toISOString(),
				eventType,
				userId,
				ipAddress: ipAddress || "SYSTEM",
				metadata: JSON.stringify(metadata),
			};

			// In production, this goes to an append-only datastore or BigQuery
			// await db.insert(auditLogs).values(auditPayload);

			logger.info(`[AUDIT] ${eventType} by ${userId}`, auditPayload);
		} catch (error: any) {
			// Never fail the main process due to audit logging failure, but alert heavily
			logger.error(`[AUDIT_FAILURE] Critical failure writing to audit log`, {
				error: error.message,
				eventType,
				userId,
			});
		}
	}
}

export const auditLogger = new AuditLogger();
