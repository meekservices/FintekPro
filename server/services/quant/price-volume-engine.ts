/**
 * @file price-volume-engine.ts
 * @description Institutional Price Volume Action (PVA) Analysis Engine for FintekPro.
 *              Evaluates Wyckoff-style Volume Price Analysis (VPA), Relative Volume (RVOL / Volume Buzz),
 *              Candle Close Position in Range, Delivery Volume Conviction, and OBV Trends.
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Layered Architecture: Core quant service within /server/services/quant
 * - Deterministic Output: Same inputs ALWAYS yield identical classification & score.
 * - Every payload exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 * - Strict TypeScript typing (zero unverified any).
 * - JSDoc documentation on all exported functions.
 */

export const PVA_ENGINE_VERSION = "1.0.0";

/**
 * Standard OHLCV bar format accepted by the PVA engine.
 * Supports flexible property names (c/close, h/high, l/low, o/open, v/volume).
 */
export interface PvaBarInput {
	open?: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	deliveryVolume?: number;
	deliveryPct?: number;
	timestamp?: string | number;
	// Compact aliases
	o?: number;
	h?: number;
	l?: number;
	c?: number;
	v?: number;
}

export type PvaClassification =
	| "INSTITUTIONAL_ACCUMULATION"
	| "INSTITUTIONAL_DISTRIBUTION"
	| "ABSORPTION_PULLBACK"
	| "EXHAUSTION_RALLY"
	| "VOLUME_CLIMAX_REVERSAL"
	| "VOLUME_CONTRACTION_DRYUP"
	| "NEUTRAL_CONSOLIDATION";

export interface PvaIntermediateSteps {
	currentPrice: number;
	priceChangePct: number;
	currentVolume: number;
	avgVolume20d: number;
	volumeRatio20d: number;
	volumeRatio5d: number;
	candleSpreadPct: number;
	atr20: number;
	spreadRatio: number;
	closeLocationPct: number; // 0% = closed at Low, 100% = closed at High
	obvSlope: number;
	deliveryPct: number | null;
	deliverySurgeRatio: number | null;
	confidenceScore: number; // 0 - 100
	quantBoostFactor: number; // 0.70x to 1.30x
}

export interface PvaAnalysisResult {
	engine_version: string;
	calculation_timestamp: string;
	symbol: string;
	classification: PvaClassification;
	pvaScore: number; // 0 - 100 normalized bullish score
	quantBoostFactor: number; // 0.70 to 1.30 multiplier for strategy allocation/scoring
	conviction: "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "BEARISH_ALERT";
	metrics: {
		volumeRatio20d: number;
		volumeRatio5d: number;
		closeLocationPct: number;
		priceChangePct: number;
		obvTrend: "ACCUMULATION" | "DISTRIBUTION" | "FLAT";
		deliveryConviction: "HIGH_DELIVERY" | "NORMAL" | "SPECULATIVE_INTRADAY" | "DATA_UNAVAILABLE";
	};
	inputs_used: {
		symbol: string;
		barsCount: number;
		latestClose: number;
		latestVolume: number;
	};
	formula_applied: string;
	intermediate_steps: PvaIntermediateSteps;
	explanation: string;
}

/**
 * Normalizes an input bar into standard numbers.
 */
function normalizeBar(b: PvaBarInput): {
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	deliveryVolume?: number;
	deliveryPct?: number;
} {
	const close = b.close ?? b.c ?? 0;
	const high = b.high ?? b.h ?? close;
	const low = b.low ?? b.l ?? close;
	const open = b.open ?? b.o ?? close;
	const volume = b.volume ?? b.v ?? 0;
	return {
		open,
		high,
		low,
		close,
		volume,
		deliveryVolume: b.deliveryVolume,
		deliveryPct: b.deliveryPct,
	};
}

/**
 * Calculates Simple Moving Average of a numeric array.
 */
function calculateSma(values: number[], period: number): number {
	if (values.length === 0 || period <= 0) return 0;
	const slice = values.slice(-period);
	const sum = slice.reduce((acc, v) => acc + v, 0);
	return +(sum / slice.length).toFixed(4);
}

/**
 * Calculates Average True Range (ATR) over a given period.
 */
function calculateAtr(
	bars: Array<{ high: number; low: number; close: number }>,
	period: number,
): number {
	if (bars.length < 2) {
		return bars.length === 1 ? bars[0].high - bars[0].low : 0;
	}
	const trValues: number[] = [];
	for (let i = 1; i < bars.length; i++) {
		const current = bars[i];
		const prevClose = bars[i - 1].close;
		const tr = Math.max(
			current.high - current.low,
			Math.abs(current.high - prevClose),
			Math.abs(current.low - prevClose),
		);
		trValues.push(tr);
	}
	return calculateSma(trValues, period);
}

/**
 * Computes On-Balance Volume (OBV) and simple slope over the last N bars.
 */
function calculateObvSlope(
	bars: Array<{ close: number; volume: number }>,
	lookback: number = 10,
): { slope: number; trend: "ACCUMULATION" | "DISTRIBUTION" | "FLAT" } {
	if (bars.length < 3) {
		return { slope: 0, trend: "FLAT" };
	}
	let currentObv = 0;
	const obvSeries: number[] = [0];

	for (let i = 1; i < bars.length; i++) {
		if (bars[i].close > bars[i - 1].close) {
			currentObv += bars[i].volume;
		} else if (bars[i].close < bars[i - 1].close) {
			currentObv -= bars[i].volume;
		}
		obvSeries.push(currentObv);
	}

	const recent = obvSeries.slice(-lookback);
	const n = recent.length;
	if (n < 2) return { slope: 0, trend: "FLAT" };

	// Simple linear regression slope for OBV
	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;

	for (let i = 0; i < n; i++) {
		sumX += i;
		sumY += recent[i];
		sumXY += i * recent[i];
		sumX2 += i * i;
	}

	const denom = n * sumX2 - sumX * sumX;
	const rawSlope = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
	const avgVol = calculateSma(bars.map((b) => b.volume), lookback) || 1;
	const normalizedSlope = +(rawSlope / avgVol).toFixed(4);

	let trend: "ACCUMULATION" | "DISTRIBUTION" | "FLAT" = "FLAT";
	if (normalizedSlope > 0.15) trend = "ACCUMULATION";
	else if (normalizedSlope < -0.15) trend = "DISTRIBUTION";

	return { slope: normalizedSlope, trend };
}

/**
 * Analyzes Price Volume Action (PVA) for a given symbol and OHLCV history.
 *
 * @param symbol - Ticker / Instrument symbol (e.g. "RELIANCE", "TCS")
 * @param rawBars - Historical OHLCV bars in chronological order (oldest to newest)
 * @param customTimestamp - Optional explicit ISO timestamp for determinism in backtesting
 * @returns Complete PVA analysis with classification, scores, and explainability intermediate steps
 */
export function analyzePriceVolumeAction(
	symbol: string,
	rawBars: PvaBarInput[],
	customTimestamp?: string,
): PvaAnalysisResult {
	const timestamp = customTimestamp || new Date().toISOString();

	// Guard: Minimum 5 bars required for basic estimation; 20+ recommended
	if (!rawBars || rawBars.length < 5) {
		const fallbackClose = rawBars && rawBars.length > 0 ? (rawBars[rawBars.length - 1].close ?? 0) : 0;
		return {
			engine_version: PVA_ENGINE_VERSION,
			calculation_timestamp: timestamp,
			symbol,
			classification: "NEUTRAL_CONSOLIDATION",
			pvaScore: 50,
			quantBoostFactor: 1.0,
			conviction: "LOW",
			metrics: {
				volumeRatio20d: 1.0,
				volumeRatio5d: 1.0,
				closeLocationPct: 50,
				priceChangePct: 0,
				obvTrend: "FLAT",
				deliveryConviction: "DATA_UNAVAILABLE",
			},
			inputs_used: {
				symbol,
				barsCount: rawBars?.length ?? 0,
				latestClose: fallbackClose,
				latestVolume: 0,
			},
			formula_applied: "INSUFFICIENT_BARS_FALLBACK (<5 bars)",
			intermediate_steps: {
				currentPrice: fallbackClose,
				priceChangePct: 0,
				currentVolume: 0,
				avgVolume20d: 0,
				volumeRatio20d: 1.0,
				volumeRatio5d: 1.0,
				candleSpreadPct: 0,
				atr20: 0,
				spreadRatio: 1.0,
				closeLocationPct: 50,
				obvSlope: 0,
				deliveryPct: null,
				deliverySurgeRatio: null,
				confidenceScore: 30,
				quantBoostFactor: 1.0,
			},
			explanation: "Insufficient price/volume history to calculate institutional price-volume action (minimum 5 bars required).",
		};
	}

	const bars = rawBars.map(normalizeBar);
	const latestBar = bars[bars.length - 1];
	const prevBar = bars[bars.length - 2];

	const currentPrice = latestBar.close;
	const prevClose = prevBar.close > 0 ? prevBar.close : latestBar.open;
	const priceChangePct = prevClose > 0 ? +(((currentPrice - prevClose) / prevClose) * 100).toFixed(2) : 0;

	// Volume SMA benchmarks
	const allVolumes = bars.map((b) => b.volume);
	const avgVolume20d = calculateSma(allVolumes, Math.min(20, bars.length));
	const avgVolume5d = calculateSma(allVolumes, Math.min(5, bars.length));

	const volumeRatio20d = avgVolume20d > 0 ? +(latestBar.volume / avgVolume20d).toFixed(2) : 1.0;
	const volumeRatio5d = avgVolume20d > 0 ? +(avgVolume5d / avgVolume20d).toFixed(2) : 1.0;

	// Candle anatomy & Close Location Value (CLV)
	// CLV = ((Close - Low) - (High - Close)) / (High - Low) normalized to 0..100%
	const candleRange = latestBar.high - latestBar.low;
	const candleSpreadPct = currentPrice > 0 ? +((candleRange / currentPrice) * 100).toFixed(2) : 0;
	const closeLocationPct =
		candleRange > 0
			? +(((latestBar.close - latestBar.low) / candleRange) * 100).toFixed(1)
			: 50;

	// ATR comparison
	const atr20 = calculateAtr(bars, Math.min(20, bars.length));
	const spreadRatio = atr20 > 0 ? +(candleRange / atr20).toFixed(2) : 1.0;

	// On-Balance Volume slope
	const { slope: obvSlope, trend: obvTrend } = calculateObvSlope(bars, Math.min(14, bars.length));

	// Delivery Volume calculation (if present in bars)
	let deliveryPct: number | null = null;
	let deliverySurgeRatio: number | null = null;
	let deliveryConviction: "HIGH_DELIVERY" | "NORMAL" | "SPECULATIVE_INTRADAY" | "DATA_UNAVAILABLE" =
		"DATA_UNAVAILABLE";

	if (latestBar.deliveryPct != null && latestBar.deliveryPct > 0) {
		deliveryPct = +(latestBar.deliveryPct).toFixed(1);
	} else if (latestBar.deliveryVolume != null && latestBar.volume > 0) {
		deliveryPct = +((latestBar.deliveryVolume / latestBar.volume) * 100).toFixed(1);
	}

	if (deliveryPct !== null) {
		const historicalDelivery = bars
			.slice(-10)
			.map((b) =>
				b.deliveryPct ?? (b.deliveryVolume && b.volume ? (b.deliveryVolume / b.volume) * 100 : 0),
			)
			.filter((d) => d > 0);

		const avgHistDelivery = historicalDelivery.length > 0 ? calculateSma(historicalDelivery, historicalDelivery.length) : 40;
		deliverySurgeRatio = avgHistDelivery > 0 ? +(deliveryPct / avgHistDelivery).toFixed(2) : 1.0;

		if (deliveryPct >= 55 && deliverySurgeRatio >= 1.25) {
			deliveryConviction = "HIGH_DELIVERY";
		} else if (deliveryPct < 25 && volumeRatio20d > 1.5) {
			deliveryConviction = "SPECULATIVE_INTRADAY";
		} else {
			deliveryConviction = "NORMAL";
		}
	}

	// ─── Classification Logic (Wyckoff / VPA Model) ───────────────────────────
	let classification: PvaClassification = "NEUTRAL_CONSOLIDATION";
	let pvaScore = 50;
	let quantBoostFactor = 1.0;
	let conviction: "VERY_HIGH" | "HIGH" | "MODERATE" | "LOW" | "BEARISH_ALERT" = "MODERATE";
	let explanation = "";

	const isVolumeSurge = volumeRatio20d >= 1.35;
	const isVolumeUltraSurge = volumeRatio20d >= 2.2;
	const isVolumeDrying = volumeRatio20d <= 0.70;
	const isVolumeDryUltra = volumeRatio20d <= 0.45;
	const isClosedNearHigh = closeLocationPct >= 65;
	const isClosedNearLow = closeLocationPct <= 35;

	// 1. Climax Reversal Pattern (Extreme Volume + Rejection Wick)
	if (isVolumeUltraSurge && spreadRatio >= 1.5 && (closeLocationPct < 30 || closeLocationPct > 70)) {
		if (priceChangePct > 0 && isClosedNearLow) {
			// Buying climax: spiked up intraday but closed near lows with massive volume
			classification = "VOLUME_CLIMAX_REVERSAL";
			pvaScore = 25;
			quantBoostFactor = 0.75;
			conviction = "BEARISH_ALERT";
			explanation = `Bearish Volume Climax: ${symbol} surged to highs but faced massive institutional rejection, closing at ${closeLocationPct}% of range on ${volumeRatio20d}x volume.`;
		} else if (priceChangePct < 0 && isClosedNearHigh) {
			// Selling climax: plunged down but bought up aggressively by institutions
			classification = "VOLUME_CLIMAX_REVERSAL";
			pvaScore = 80;
			quantBoostFactor = 1.20;
			conviction = "VERY_HIGH";
			explanation = `Bullish Selling Climax: ${symbol} absorbed intense selling and rebounded to close at ${closeLocationPct}% of range on ${volumeRatio20d}x volume, signaling institutional bottom fishing.`;
		}
	}

	// 2. Institutional Accumulation (Price Up + Surge Volume + Upper Close)
	if (classification === "NEUTRAL_CONSOLIDATION" && priceChangePct > 0.4 && isVolumeSurge && isClosedNearHigh) {
		classification = "INSTITUTIONAL_ACCUMULATION";
		const deliveryBonus = deliveryConviction === "HIGH_DELIVERY" ? 10 : 0;
		pvaScore = Math.min(95, 75 + Math.round((volumeRatio20d - 1) * 8) + deliveryBonus);
		quantBoostFactor = isVolumeUltraSurge ? 1.25 : 1.15;
		conviction = isVolumeUltraSurge || deliveryConviction === "HIGH_DELIVERY" ? "VERY_HIGH" : "HIGH";
		explanation = `Strong Institutional Accumulation: ${symbol} gained +${priceChangePct}% on ${volumeRatio20d}x 20-day average volume, closing strongly near highs (${closeLocationPct}%).` +
			(deliveryConviction === "HIGH_DELIVERY" ? ` High delivery (${deliveryPct}%) confirms genuine long-term institutional buying.` : "");
	}

	// 3. Institutional Distribution (Price Down + Surge Volume + Lower Close)
	else if (classification === "NEUTRAL_CONSOLIDATION" && priceChangePct < -0.4 && isVolumeSurge && isClosedNearLow) {
		classification = "INSTITUTIONAL_DISTRIBUTION";
		pvaScore = Math.max(10, 30 - Math.round((volumeRatio20d - 1) * 8));
		quantBoostFactor = isVolumeUltraSurge ? 0.70 : 0.80;
		conviction = "BEARISH_ALERT";
		explanation = `High Institutional Distribution: ${symbol} declined ${priceChangePct}% on heavy volume (${volumeRatio20d}x average), closing near session lows (${closeLocationPct}%). Caution advised.`;
	}

	// 4. Absorption / Low-Volume Pullback (Price Down/Flat + Volume Drying + Closes reasonable)
	else if (classification === "NEUTRAL_CONSOLIDATION" && priceChangePct >= -2.5 && priceChangePct <= 0.2 && isVolumeDrying) {
		classification = "ABSORPTION_PULLBACK";
		pvaScore = 70;
		quantBoostFactor = 1.10;
		conviction = "HIGH";
		explanation = `Healthy Low-Volume Pullback: ${symbol} softened ${priceChangePct}% on dry volume (${volumeRatio20d}x average). Lack of aggressive selling confirms institutional absorption.`;
	}

	// 5. Exhaustion Rally (Price Up + Drying Volume + Low Demand)
	else if (classification === "NEUTRAL_CONSOLIDATION" && priceChangePct > 0.5 && isVolumeDrying) {
		classification = "EXHAUSTION_RALLY";
		pvaScore = 40;
		quantBoostFactor = 0.88;
		conviction = "LOW";
		explanation = `Weak / Exhaustion Rally: ${symbol} gained +${priceChangePct}% but on deficient volume (${volumeRatio20d}x average), reflecting retail chase without institutional sponsorship.`;
	}

	// 6. Volume Contraction / Dry-Up (Volatility Compression)
	else if (classification === "NEUTRAL_CONSOLIDATION" && isVolumeDryUltra && Math.abs(priceChangePct) < 0.6) {
		classification = "VOLUME_CONTRACTION_DRYUP";
		pvaScore = 65;
		quantBoostFactor = 1.05;
		conviction = "MODERATE";
		explanation = `Volume Dry-Up / Volatility Compression: Trading activity dried up to ${volumeRatio20d}x average with narrow spread (${candleSpreadPct}%). Coiling for an explosive directional move.`;
	}

	// 7. Neutral Consolidation
	else if (classification === "NEUTRAL_CONSOLIDATION") {
		pvaScore = Math.round(50 + priceChangePct * 2);
		pvaScore = Math.min(65, Math.max(35, pvaScore));
		quantBoostFactor = 1.0;
		conviction = "MODERATE";
		explanation = `Balanced Trading: ${symbol} moved ${priceChangePct > 0 ? "+" : ""}${priceChangePct}% with normal volume participation (${volumeRatio20d}x average).`;
	}

	const intermediateSteps: PvaIntermediateSteps = {
		currentPrice,
		priceChangePct,
		currentVolume: latestBar.volume,
		avgVolume20d,
		volumeRatio20d,
		volumeRatio5d,
		candleSpreadPct,
		atr20,
		spreadRatio,
		closeLocationPct,
		obvSlope,
		deliveryPct,
		deliverySurgeRatio,
		confidenceScore: conviction === "VERY_HIGH" ? 95 : conviction === "HIGH" ? 85 : conviction === "MODERATE" ? 65 : 45,
		quantBoostFactor,
	};

	const formulaApplied =
		"PVA_WYCKOFF_VPA_V1 = f(PriceReturn_1d, Volume_to_SMA20, CloseLocationValue, ATR_Spread_Ratio, OBV_Slope, Delivery_Surge)";

	return {
		engine_version: PVA_ENGINE_VERSION,
		calculation_timestamp: timestamp,
		symbol,
		classification,
		pvaScore,
		quantBoostFactor,
		conviction,
		metrics: {
			volumeRatio20d,
			volumeRatio5d,
			closeLocationPct,
			priceChangePct,
			obvTrend,
			deliveryConviction,
		},
		inputs_used: {
			symbol,
			barsCount: bars.length,
			latestClose: currentPrice,
			latestVolume: latestBar.volume,
		},
		formula_applied: formulaApplied,
		intermediate_steps: intermediateSteps,
		explanation,
	};
}

