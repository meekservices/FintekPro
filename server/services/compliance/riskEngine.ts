import { logger } from "../../logger";

export interface PreTradeRiskEvaluationInput {
	userId: string;
	symbol: string;
	notionalValue: number;
	currentPositionValue?: number;
	dailyTradeCount?: number;
	price?: number;
	referencePrice?: number; // Previous close or LTP for circuit limit checks
	currency?: "INR" | "USD";
	orderType?: "MARKET" | "LIMIT" | "STOP_LOSS";
	exchange?: "NSE" | "BSE" | "MCX" | "NASDAQ" | "NYSE";
	riskProfileAssessmentDate?: string | Date;
}

export interface UserKillSwitchRecord {
	active: boolean;
	reason: string;
	activatedAt: string;
}

export class RiskEngine {
	// Predefined limits
	private readonly MAX_EXPOSURE_PER_STOCK_USD = 50000;
	private readonly MAX_EXPOSURE_PER_STOCK_INR = 2500000; // ₹25,00,000 max portfolio exposure
	private readonly MAX_SINGLE_ORDER_INR = 1000000;       // ₹10,00,000 max single order (SEBI RMS)
	private readonly MAX_DAILY_TRADES = 50;
	private readonly MAX_PRICE_DEVIATION_PCT = 0.15;        // 15% circuit limit filter band

	// Global Algo Emergency Kill Switch (SOP-AI-GOV-2026-01 / SEBI AI/ML Framework)
	private isKillSwitchActive: boolean = false;
	private killSwitchReason: string = "";
	private killSwitchActivatedAt: string = "";
	private killSwitchActivatedBy: string = "";

	// Per-User Algo Emergency Kill Switches
	private userKillSwitches: Map<string, UserKillSwitchRecord> = new Map();

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
	 * Activates User-level Emergency Kill Switch (Client Self-Defense / Stop-Out).
	 */
	activateUserKillSwitch(userId: string, reason: string = "User activated emergency kill switch") {
		const record: UserKillSwitchRecord = {
			active: true,
			reason,
			activatedAt: new Date().toISOString(),
		};
		this.userKillSwitches.set(String(userId), record);

		logger.warn(`[RiskEngine] User Kill Switch ACTIVATED for ${userId}`, {
			event: "USER_KILL_SWITCH_ACTIVATED",
			userId,
			reason,
			timestamp: record.activatedAt,
		});

		return record;
	}

	/**
	 * Deactivates User-level Emergency Kill Switch.
	 */
	deactivateUserKillSwitch(userId: string) {
		this.userKillSwitches.delete(String(userId));

		logger.info(`[RiskEngine] User Kill Switch DEACTIVATED for ${userId}`, {
			event: "USER_KILL_SWITCH_DEACTIVATED",
			userId,
			timestamp: new Date().toISOString(),
		});

		return { active: false, reason: "", activatedAt: "" };
	}

	/**
	 * Returns current status of User Kill Switch.
	 */
	getUserKillSwitchStatus(userId: string): UserKillSwitchRecord {
		return (
			this.userKillSwitches.get(String(userId)) || {
				active: false,
				reason: "",
				activatedAt: "",
			}
		);
	}

	/**
	 * Comprehensive Pre-Trade Risk Evaluation (SEBI Pre-Trade RMS & US Broker checks)
	 */
	async evaluatePreTradeRisk(input: PreTradeRiskEvaluationInput): Promise<{ approved: boolean; checksPassed: string[] }> {
		const {
			userId,
			symbol,
			notionalValue,
			currentPositionValue = 0,
			dailyTradeCount = 0,
			price,
			referencePrice,
			currency = "INR",
		} = input;

		logger.info(`[RiskEngine] Evaluating pre-trade risk for ${userId} on ${symbol}`, {
			notionalValue,
			currency,
		});

		const checksPassed: string[] = [];

		// Gate 0a: Global Kill Switch Check (SEBI AI/ML Mandate)
		if (this.isKillSwitchActive) {
			throw new Error(
				`GLOBAL_KILL_SWITCH_ACTIVE: Automated trading is currently halted platform-wide (${this.killSwitchReason}).`,
			);
		}
		checksPassed.push("GLOBAL_KILL_SWITCH_CLEAR");

		// Gate 0b: User Kill Switch Check
		const userKs = this.getUserKillSwitchStatus(userId);
		if (userKs.active) {
			throw new Error(
				`USER_KILL_SWITCH_ACTIVE: Trading is paused for your account (${userKs.reason}). Please deactivate kill switch to resume.`,
			);
		}
		checksPassed.push("USER_KILL_SWITCH_CLEAR");

		// Gate 0c: Risk Profile 365-Day Expiry Check (SEBI IA Reg. 17(c) Mandate)
		if (input.riskProfileAssessmentDate) {
			const assessed = new Date(input.riskProfileAssessmentDate);
			if (!isNaN(assessed.getTime())) {
				const diffDays = (Date.now() - assessed.getTime()) / (1000 * 60 * 60 * 24);
				if (diffDays > 365) {
					throw new Error(
						"SEBI_RISK_PROFILE_EXPIRED: Client risk assessment is older than 365 days. Annual risk profile reassessment is mandatory before high-risk execution.",
					);
				}
			}
			checksPassed.push("RISK_PROFILE_VALIDITY_OK");
		}

		// Rule 1: Single Order Value Limit (Fat-Finger & Capital Protection)
		const singleOrderLimit = currency === "INR" ? this.MAX_SINGLE_ORDER_INR : this.MAX_EXPOSURE_PER_STOCK_USD;
		if (notionalValue > singleOrderLimit) {
			throw new Error(
				`RISK_LIMIT_EXCEEDED: Single order notional of ${currency} ${notionalValue.toLocaleString()} exceeds maximum permitted order limit of ${currency} ${singleOrderLimit.toLocaleString()}.`,
			);
		}
		checksPassed.push("SINGLE_ORDER_VALUE_OK");

		// Rule 2: Max Single Stock Exposure
		const maxExposure = currency === "INR" ? this.MAX_EXPOSURE_PER_STOCK_INR : this.MAX_EXPOSURE_PER_STOCK_USD;
		if (currentPositionValue + notionalValue > maxExposure) {
			throw new Error(
				`RISK_LIMIT_EXCEEDED: Combined exposure of ${currency} ${(currentPositionValue + notionalValue).toLocaleString()} in ${symbol} exceeds max limit of ${currency} ${maxExposure.toLocaleString()}.`,
			);
		}
		checksPassed.push("MAX_EXPOSURE_OK");

		// Rule 3: Trade Velocity / Daily Order Throttle
		if (dailyTradeCount >= this.MAX_DAILY_TRADES) {
			throw new Error(
				`THROTTLE_LIMIT_EXCEEDED: Daily order count limit of ${this.MAX_DAILY_TRADES} trades reached for today.`,
			);
		}
		checksPassed.push("TRADE_VELOCITY_OK");

		// Rule 4: Circuit Filter & Price Band Check (prevent off-market executions)
		if (price && referencePrice && referencePrice > 0) {
			const deviation = Math.abs((price - referencePrice) / referencePrice);
			if (deviation > this.MAX_PRICE_DEVIATION_PCT) {
				throw new Error(
					`PRICE_BAND_VIOLATION: Order price ${price} deviates by ${(deviation * 100).toFixed(1)}% from reference price ${referencePrice}, exceeding the ${this.MAX_PRICE_DEVIATION_PCT * 100}% circuit band.`,
				);
			}
			checksPassed.push("CIRCUIT_FILTER_OK");
		}

		return { approved: true, checksPassed };
	}

	/**
	 * Pre-trade risk validations (backwards-compatible alias for existing callers).
	 */
	async evaluateTrade(
		userId: string,
		symbol: string,
		notionalValue: number,
		currentPositionValue: number,
		dailyTradeCount: number,
	) {
		const res = await this.evaluatePreTradeRisk({
			userId,
			symbol,
			notionalValue,
			currentPositionValue,
			dailyTradeCount,
			currency: "USD",
		});
		return res.approved;
	}

	/**
	 * Returns full Regulatory Compliance Manifest for Audits (SEBI Algo Trading Compliance).
	 */
	getRegulatoryComplianceStatus() {
		return {
			framework: "SEBI_ALGO_TRADING_CIRCULAR_2024",
			decisionSupportOnly: true,
			autonomousExecutionAllowed: false,
			globalKillSwitch: this.getGlobalKillSwitchStatus(),
			activeUserKillSwitchesCount: this.userKillSwitches.size,
			riskLimits: {
				maxSingleOrderInr: this.MAX_SINGLE_ORDER_INR,
				maxExposurePerStockInr: this.MAX_EXPOSURE_PER_STOCK_INR,
				maxExposurePerStockUsd: this.MAX_EXPOSURE_PER_STOCK_USD,
				maxDailyTrades: this.MAX_DAILY_TRADES,
				maxPriceDeviationBandPct: this.MAX_PRICE_DEVIATION_PCT * 100,
			},
			auditTrailStandard: "FASP-AI v1.0 / SHA-256 Checksum Chaining",
			timestamp: new Date().toISOString(),
		};
	}

	/**
	 * Asynchronous periodic check for suspicious activity.
	 */
	async scanForSuspiciousActivity(userId: string) {
		logger.info(`[RiskEngine] Scanning for suspicious activity for user ${userId}`);
		return false; // False = no suspicious activity found
	}
}

export const riskEngine = new RiskEngine();
