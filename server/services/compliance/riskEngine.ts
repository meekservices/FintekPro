import { logger } from "../../logger";

export class RiskEngine {
	// Example predefined limits (in USD)
	private readonly MAX_EXPOSURE_PER_STOCK = 50000;
	private readonly MAX_DAILY_TRADES = 50;

	// Global Algo Emergency Kill Switch (SOP-AI-GOV-2026-01 / SEBI AI/ML Framework)
	private isKillSwitchActive: boolean = false;
	private killSwitchReason: string = "";
	private killSwitchActivatedAt: string = "";
	private killSwitchActivatedBy: string = "";

	/**
	 * Activates the Global Emergency Kill Switch across all algo and execution desks.
	 */
	activateGlobalKillSwitch(reason: string, activatedBy: string) {
		this.isKillSwitchActive = true;
		this.killSwitchReason = reason;
		this.killSwitchActivatedAt = new Date().toISOString();
		this.killSwitchActivatedBy = activatedBy;

		logger.error("[RiskEngine] 🚨 GLOBAL KILL SWITCH ACTIVATED 🚨", {
			event: "GLOBAL_KILL_SWITCH_ACTIVATED",
			reason,
			activated_by: activatedBy,
			timestamp: this.killSwitchActivatedAt,
		});

		return this.getGlobalKillSwitchStatus();
	}

	/**
	 * Deactivates the Global Emergency Kill Switch after risk resolution.
	 */
	deactivateGlobalKillSwitch(deactivatedBy: string) {
		this.isKillSwitchActive = false;
		logger.warn("[RiskEngine] Global Kill Switch deactivated", {
			event: "GLOBAL_KILL_SWITCH_DEACTIVATED",
			deactivated_by: deactivatedBy,
			timestamp: new Date().toISOString(),
		});

		return this.getGlobalKillSwitchStatus();
	}

	/**
	 * Returns current status of Global Kill Switch.
	 */
	getGlobalKillSwitchStatus() {
		return {
			active: this.isKillSwitchActive,
			reason: this.killSwitchReason,
			activatedAt: this.killSwitchActivatedAt,
			activatedBy: this.killSwitchActivatedBy,
		};
	}

	/**
	 * Pre-trade risk validations.
	 * Throws an error if the trade violates risk boundaries or kill switch is active.
	 */
	async evaluateTrade(
		userId: string,
		symbol: string,
		notionalValue: number,
		currentPositionValue: number,
		dailyTradeCount: number,
	) {
		logger.info(`[RiskEngine] Evaluating trade for ${userId} on ${symbol}`);

		// Gate 0: Global Kill Switch Check
		if (this.isKillSwitchActive) {
			throw new Error(
				`GLOBAL_KILL_SWITCH_ACTIVE: Automated trading is currently halted (${this.killSwitchReason}).`,
			);
		}

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
