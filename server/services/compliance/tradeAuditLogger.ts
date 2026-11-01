import { logger } from "../../logger";
import { auditLogService } from "../audit-log-service";

export class TradeAuditLogger {
	/**
	 * Logs an immutable record of every trade attempt (success or failure)
	 * Ensures SEC/FINRA/SEBI compliance mirroring with cryptographic hash chain in immutable_audit_logs.
	 */
	async logTrade(payload: {
		userId: string;
		alpacaAccountId?: string;
		symbol: string;
		side: "buy" | "sell";
		qty: number;
		notional?: number;
		status: "success" | "failed" | "rejected" | "queued";
		providerOrderId?: string;
		errorMessage?: string;
		broker?: string;
	}) {
		logger.info(
			`[TradeAuditLogger] Logging trade event for ${payload.userId}: ${payload.status}`,
			{
				event: "TRADE_AUDIT_LOG",
				user_id: payload.userId,
				symbol: payload.symbol,
				status: payload.status,
			},
		);

		try {
			await auditLogService.log(
				"TRADE_EXECUTION",
				`ORDER_${payload.status.toUpperCase()}`,
				{
					userId: payload.userId,
					userRole: "client",
					entityType: "trade_order",
					entityId: payload.providerOrderId || `${payload.symbol}-${Date.now()}`,
					newState: {
						symbol: payload.symbol,
						side: payload.side,
						quantity: payload.qty,
						notional: payload.notional,
						status: payload.status,
						providerOrderId: payload.providerOrderId,
						errorMessage: payload.errorMessage,
					},
					metadata: {
						networkState: payload.broker || (payload.alpacaAccountId ? "ALPACA" : "UPSTOX"),
						idempotencyKey: payload.providerOrderId,
					},
				},
			);
		} catch (error) {
			logger.error(
				`[TradeAuditLogger] CRITICAL: Failed to write to immutable audit log!`,
				error,
			);
		}
	}

	async logAdminOverride(
		adminId: string,
		targetUserId: string,
		action: string,
		reason: string,
	) {
		logger.warn(
			`[TradeAuditLogger] ADMIN OVERRIDE by ${adminId} on ${targetUserId}. Action: ${action}. Reason: ${reason}`,
		);
		try {
			await auditLogService.log(
				"ADMIN_OVERRIDE",
				action,
				{
					userId: adminId,
					userRole: "admin",
					entityType: "user_account",
					entityId: targetUserId,
					metadata: {
						requestPath: reason,
					},
				},
			);
		} catch (error) {
			logger.error(`[TradeAuditLogger] Failed to log admin override!`, error);
		}
	}
}

export const tradeAuditLogger = new TradeAuditLogger();
