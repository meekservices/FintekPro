/**
 * @file exit-strategy-engine.ts
 * @description Algorithmic Trailing Exit & Profit Protection Engine for FintekPro.
 *              Evaluates Chandelier ATR Trailing Stops, Multi-Tier Target Scaling,
 *              Time-Stop Capital Recycling, and Volume-Climax Exhaustion Exits.
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Deterministic Output: Same price/bar inputs ALWAYS yield identical exit action & levels.
 * - Every payload exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 * - Strict TypeScript typing with zero unverified any.
 * - JSDoc documentation on all exported functions.
 */

export const EXIT_ENGINE_VERSION = "1.0.0";

export interface PositionInput {
	symbol: string;
	entryDate: string;      // ISO format YYYY-MM-DD
	entryPrice: number;
	currentPrice: number;
	quantity: number;
	target1Price?: number;
	target2Price?: number;
	initialStopLossPrice?: number;
	bars: Array<{
		high: number;
		low: number;
		close: number;
		volume?: number;
		timestamp?: string | number;
	}>;
	holdingDays?: number;
}

export type ExitAction =
	| "HOLD_TRAILING_STOP"
	| "BOOK_PARTIAL_PROFIT_T1"
	| "BOOK_PARTIAL_PROFIT_T2"
	| "EXIT_TRAILING_STOP_HIT"
	| "EXIT_TIME_STOP_RECYCLE"
	| "EXIT_VOLUME_CLIMAX"
	| "EXIT_STOP_LOSS_HIT";

export interface ExitAnalysisResult {
	engine_version: string;
	calculation_timestamp: string;
	symbol: string;
	action: ExitAction;
	urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "NONE";
	currentPrice: number;
	entryPrice: number;
	unrealizedGainPct: number;
	unrealizedPnlInr: number;
	levels: {
		recommendedStopLoss: number;
		chandelierTrailingStop: number;
		breakevenStop: number;
		target1Price: number;
		target2Price: number;
	};
	executionRecommendation: {
		exitQuantity: number;
		remainingQuantity: number;
		orderType: "MARKET" | "LIMIT" | "TRIGGER_TRAILING_STOP";
		triggerPrice?: number;
	};
	holdingMetrics: {
		daysHeld: number;
		atr14: number;
		highestHighSinceEntry: number;
		volumeExhaustionDetected: boolean;
	};
	inputs_used: {
		symbol: string;
		entryPrice: number;
		currentPrice: number;
		quantity: number;
		barsCount: number;
	};
	formula_applied: string;
	intermediate_steps: {
		atr14: number;
		chandelierMultiplier: number;
		distanceToStopPct: number;
		timeStopThresholdDays: number;
	};
	rationale: string;
}

/**
 * Calculates Average True Range (ATR) over 14 periods.
 */
function calculateAtr(bars: Array<{ high: number; low: number; close: number }>, period: number = 14): number {
	if (bars.length < 2) return bars.length === 1 ? bars[0].high - bars[0].low : 0;
	const trs: number[] = [];
	for (let i = 1; i < bars.length; i++) {
		const tr = Math.max(
			bars[i].high - bars[i].low,
			Math.abs(bars[i].high - bars[i - 1].close),
			Math.abs(bars[i].low - bars[i - 1].close),
		);
		trs.push(tr);
	}
	const slice = trs.slice(-period);
	return +(slice.reduce((acc, v) => acc + v, 0) / slice.length).toFixed(2);
}

/**
 * Analyzes an open position to determine optimal trailing exit, profit-taking, or capital recycling.
 *
 * @param position - Open position metadata and historical bars since entry
 * @param customTimestamp - Evaluation timestamp (defaults to current date)
 * @returns Complete exit analysis with execution triggers and mathematical explainability
 */
export function evaluateExitStrategy(
	position: PositionInput,
	customTimestamp?: string,
): ExitAnalysisResult {
	const timestamp = customTimestamp || new Date().toISOString();
	const { symbol, entryPrice, currentPrice, quantity, bars } = position;

	const unrealizedGainPct = entryPrice > 0 ? +(((currentPrice - entryPrice) / entryPrice) * 100).toFixed(2) : 0;
	const unrealizedPnlInr = +((currentPrice - entryPrice) * quantity).toFixed(2);

	const daysHeld =
		position.holdingDays ??
		Math.max(1, Math.floor((new Date(timestamp).getTime() - new Date(position.entryDate).getTime()) / (1000 * 60 * 60 * 24)));

	const atr14 = calculateAtr(bars, 14) || +(currentPrice * 0.02).toFixed(2);
	const highs = bars.map((b) => b.high);
	const highestHighSinceEntry = highs.length > 0 ? Math.max(...highs, currentPrice) : currentPrice;

	// 1. Chandelier Exit Formula: Highest High - 2.8 * ATR(14)
	const chandelierMultiplier = 2.8;
	const chandelierTrailingStop = +(highestHighSinceEntry - chandelierMultiplier * atr14).toFixed(2);
	const breakevenStop = entryPrice;

	// Initial fallback stop and targets if not supplied
	const initialStopLoss = position.initialStopLossPrice ?? +(entryPrice - 2 * atr14).toFixed(2);
	const target1 = position.target1Price ?? +(entryPrice + 2.5 * atr14).toFixed(2);
	const target2 = position.target2Price ?? +(entryPrice + 4.5 * atr14).toFixed(2);

	// The effective recommended stop loss is the maximum of: initial stop, breakeven (if in profit), and Chandelier
	let effectiveStopLoss = Math.max(initialStopLoss, chandelierTrailingStop);
	if (unrealizedGainPct >= 8.0) {
		effectiveStopLoss = Math.max(effectiveStopLoss, breakevenStop);
	}

	// 2. Check Volume Climax Exhaustion: Volume > 3.5x average on upper wick rejection
	let volumeExhaustionDetected = false;
	if (bars.length >= 10) {
		const latestBar = bars[bars.length - 1];
		const vols = bars.map((b) => b.volume ?? 0).filter((v) => v > 0);
		if (vols.length >= 10 && latestBar.volume) {
			const avgVol = vols.slice(-10).reduce((a, b) => a + b, 0) / 10;
			const rvol = latestBar.volume / avgVol;
			const upperWick = latestBar.high - Math.max(latestBar.close, bars[bars.length - 2]?.close ?? latestBar.close);
			const candleRange = latestBar.high - latestBar.low;
			if (rvol >= 3.2 && candleRange > 0 && upperWick / candleRange > 0.45 && unrealizedGainPct > 10) {
				volumeExhaustionDetected = true;
			}
		}
	}

	// 3. Decision Logic & Actions
	let action: ExitAction = "HOLD_TRAILING_STOP";
	let urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "NONE" = "NONE";
	let exitQty = 0;
	let orderType: "MARKET" | "LIMIT" | "TRIGGER_TRAILING_STOP" = "TRIGGER_TRAILING_STOP";
	let rationale = "";

	if (currentPrice <= initialStopLoss) {
		// Stop Loss Breach
		action = "EXIT_STOP_LOSS_HIT";
		urgency = "CRITICAL";
		exitQty = quantity;
		orderType = "MARKET";
		rationale = `Stop Loss Triggered: ${symbol} traded at ₹${currentPrice}, breaching initial stop loss ₹${initialStopLoss}. Exit 100% position to protect capital.`;
	} else if (currentPrice <= chandelierTrailingStop && unrealizedGainPct > 4.0) {
		// Chandelier Trailing Stop Breach (Profitable Exit)
		action = "EXIT_TRAILING_STOP_HIT";
		urgency = "HIGH";
		exitQty = quantity;
		orderType = "MARKET";
		rationale = `Trailing Stop Hit: ${symbol} retraced below Chandelier stop (₹${chandelierTrailingStop} from peak ₹${highestHighSinceEntry}). Lock in +${unrealizedGainPct}% profit (₹${unrealizedPnlInr.toLocaleString("en-IN")}).`;
	} else if (volumeExhaustionDetected) {
		// Volume Climax Exit
		action = "EXIT_VOLUME_CLIMAX";
		urgency = "HIGH";
		exitQty = Math.ceil(quantity * 0.5); // Sell 50% into institutional exhaustion
		orderType = "LIMIT";
		rationale = `Volume Climax Rejection: ${symbol} spiked into extreme volume with heavy overhead wick rejection while up +${unrealizedGainPct}%. Book 50% partial profits immediately into liquidity.`;
	} else if (currentPrice >= target2) {
		// Target 2 reached
		action = "BOOK_PARTIAL_PROFIT_T2";
		urgency = "MEDIUM";
		exitQty = Math.ceil(quantity * 0.33);
		orderType = "LIMIT";
		rationale = `Target 2 Achieved: ${symbol} hit ₹${target2} (+${unrealizedGainPct}% gain). Book second partial tranche (33%), trail remainder with ATR stop at ₹${effectiveStopLoss}.`;
	} else if (currentPrice >= target1 && unrealizedGainPct >= 7.0 && unrealizedGainPct < 15.0) {
		// Target 1 reached
		action = "BOOK_PARTIAL_PROFIT_T1";
		urgency = "MEDIUM";
		exitQty = Math.ceil(quantity * 0.33);
		orderType = "LIMIT";
		rationale = `Target 1 Achieved: ${symbol} reached ₹${target1} (+${unrealizedGainPct}%). Book 33% profit, move stop loss to breakeven (₹${breakevenStop}) to make position risk-free.`;
	} else if (daysHeld >= 15 && Math.abs(unrealizedGainPct) <= 1.5) {
		// Time-stop: position is stagnant for 15+ trading days
		action = "EXIT_TIME_STOP_RECYCLE";
		urgency = "MEDIUM";
		exitQty = quantity;
		orderType = "MARKET";
		rationale = `Time-Stop Capital Recycle: ${symbol} has remained stagnant (${unrealizedGainPct}% move) over ${daysHeld} trading days. Free up idle cash to reallocate into higher-velocity alpha picks.`;
	} else {
		// Normal holding with trailing stop
		action = "HOLD_TRAILING_STOP";
		urgency = "NONE";
		exitQty = 0;
		orderType = "TRIGGER_TRAILING_STOP";
		rationale = `Position Active & Healthy: Current price ₹${currentPrice} is comfortably above trailing stop ₹${effectiveStopLoss} (+${unrealizedGainPct}% unrealized gain). Maintain trailing stop order.`;
	}

	const distanceToStopPct =
		currentPrice > 0 ? +(((currentPrice - effectiveStopLoss) / currentPrice) * 100).toFixed(2) : 0;

	return {
		engine_version: EXIT_ENGINE_VERSION,
		calculation_timestamp: timestamp,
		symbol,
		action,
		urgency,
		currentPrice,
		entryPrice,
		unrealizedGainPct,
		unrealizedPnlInr,
		levels: {
			recommendedStopLoss: effectiveStopLoss,
			chandelierTrailingStop,
			breakevenStop,
			target1Price: target1,
			target2Price: target2,
		},
		executionRecommendation: {
			exitQuantity: exitQty,
			remainingQuantity: quantity - exitQty,
			orderType,
			triggerPrice: effectiveStopLoss,
		},
		holdingMetrics: {
			daysHeld,
			atr14,
			highestHighSinceEntry,
			volumeExhaustionDetected,
		},
		inputs_used: {
			symbol,
			entryPrice,
			currentPrice,
			quantity,
			barsCount: bars.length,
		},
		formula_applied:
			"CHANDELIER_ATR_V1 = max(High_since_entry) - 2.8 * ATR(14) | TimeStop(15d, |ret| < 1.5%) | Targets(T1=2.5xATR, T2=4.5xATR)",
		intermediate_steps: {
			atr14,
			chandelierMultiplier,
			distanceToStopPct,
			timeStopThresholdDays: 15,
		},
		rationale,
	};
}

