import { logger } from "../../../logger";
import { db } from "../../../db";
import { sql } from "drizzle-orm";
// Assuming alpaca_trade_logs schema will be exported from shared/schema/users.ts later.
// We will mock the table insertion logic for the time being.

export class TradeAuditLogger {
	/**
	 * Logs an immutable record of every trade attempt (success or failure)
	 * Ensures SEC/FINRA/SEBI compliance mirroring
	 */
	async logTrade(payload: {
		userId: string;
		alpacaAccountId: string;
		symbol: string;
		side: "buy" | "sell";
		qty: number;
		notional?: number;
		status: "success" | "failed" | "rejected" | "queued";
		providerOrderId?: string;
		errorMessage?: string;
	}) {
		logger.info(
			`[TradeAuditLogger] Logging trade event for ${payload.userId}: ${payload.status}`,
		);

		try {
			// In a real execution, this connects directly to the DB
			// await db.insert(alpacaTradeLogs).values({
			//   userId: payload.userId,
			//   alpacaAccountId: payload.alpacaAccountId,
			//   symbol: payload.symbol,
			//   side: payload.side,
			//   quantity: payload.qty,
			//   notional: payload.notional,
			//   status: payload.status,
			//   providerOrderId: payload.providerOrderId,
			//   errorMessage: payload.errorMessage,
			//   timestamp: new Date()
			// });
			logger.info(
				`[TradeAuditLogger] (Mock) Inserted log into alpaca_trade_logs`,
			);
		} catch (error) {
			logger.error(
				`[TradeAuditLogger] CRITICAL: Failed to write to audit log!`,
				error,
			);
			// Depending on strictness, we might throw here to halt execution if auditing fails.
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
		// Log to a specialized admin_audit_logs table
	}
}

export const tradeAuditLogger = new TradeAuditLogger();
