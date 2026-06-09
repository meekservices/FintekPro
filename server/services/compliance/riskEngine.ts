import { logger } from "../../../logger";

export class RiskEngine {
	// Example predefined limits (in USD)
	private readonly MAX_EXPOSURE_PER_STOCK = 50000;
	private readonly MAX_DAILY_TRADES = 50;

	/**
	 * Pre-trade risk validations.
	 * Throws an error if the trade violates risk boundaries.
	 */
	async evaluateTrade(
		userId: string,
		symbol: string,
		notionalValue: number,
		currentPositionValue: number,
		dailyTradeCount: number,
	) {
		logger.info(`[RiskEngine] Evaluating trade for ${userId} on ${symbol}`);

		// Rule 1: Max Exposure
		if (currentPositionValue + notionalValue > this.MAX_EXPOSURE_PER_STOCK) {
			throw new Error(
				`Risk Violation: Max exposure of $${this.MAX_EXPOSURE_PER_STOCK} per stock exceeded for ${symbol}.`,
			);
		}

		// Rule 2: Trade Velocity (Pattern Day Trading proxy/throttle)
		if (dailyTradeCount >= this.MAX_DAILY_TRADES) {
			throw new Error(
				`Risk Violation: Max daily trade count of ${this.MAX_DAILY_TRADES} exceeded.`,
			);
		}

		// Pass
		return true;
	}

	/**
	 * Asynchronous periodic check for suspicious activity.
	 */
	async scanForSuspiciousActivity(userId: string) {
		// E.g. Check for wash trading or rapid flip attempts
		// This is typically called by a cron job
		logger.info(
			`[RiskEngine] Scanning for suspicious activity for user ${userId}`,
		);
		return false; // False = no suspicious activity found
	}
}

export const riskEngine = new RiskEngine();
