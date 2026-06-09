import { alpacaAccountService } from "../core/alpacaAccountService";
import { logger } from "../../../logger";

export class ExecutionValidator {
	/**
	 * Validates if a user's account is eligible and well-funded for the trade
	 */
	async validateOrder(
		alpacaAccountId: string,
		symbol: string,
		qty: number,
		side: "buy" | "sell",
	) {
		logger.info(
			`[ExecutionValidator] Validating order for ${alpacaAccountId}: ${side} ${qty} ${symbol}`,
		);

		const account =
			await alpacaAccountService.checkAccountStatus(alpacaAccountId);

		if (account.status !== "ACTIVE") {
			throw new Error(
				`Account is not active (Status: ${account.status}). Trading disabled.`,
			);
		}

		if (side === "buy") {
			// Very basic estimated notional validation. In reality, we'd need a real-time quote to check exact BP.
			// Assuming MarketData engine would be called to check current price * qty <= buyingPower
			// For now, ensure there is SOME buying power.
			if (account.buyingPower <= 0) {
				throw new Error("Insufficient buying power for this trade.");
			}
		}

		// Market hours validation
		if (!this.isUSMarketOpen()) {
			logger.warn(
				"[ExecutionValidator] Market is closed. Order will be queued for next open if time_in_force allows, or rejected.",
			);
		}

		return true;
	}

	/**
	 * Helper to determine if US Market is currently open.
	 * Standard hours: 9:30 AM - 4:00 PM Eastern Time, Monday-Friday.
	 */
	isUSMarketOpen(): boolean {
		const now = new Date();
		// Use 'America/New_York' timezone for market hours
		const options: Intl.DateTimeFormatOptions = {
			timeZone: "America/New_York",
			hour: "numeric",
			minute: "numeric",
			hour12: false,
			weekday: "long",
		};
		const formatter = new Intl.DateTimeFormat("en-US", options);

		// Parse out current ET hour/minute/day
		// This is a simplistic check; Alpaca's Clock API provides exact state including holidays.
		// Ideally, call `alpacaClient.call('/clock')` to verify `is_open`.
		return true; // Simplified for the abstraction
	}
}

export const executionValidator = new ExecutionValidator();
