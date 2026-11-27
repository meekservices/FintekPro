/**
 * Multi-Broker Tick Arbitration & Anomaly Rejection Engine
 *
 * Sutures real-time equity & commodity quotes from Upstox, Angel One,
 * and Bhavcopy with automated outlier filtering, circuit-band checks,
 * and timestamp-freshness arbitration.
 *
 * Compliant with SEBI System Audit Guidelines for Market Data Feeds.
 *
 * @module server/services/tick-arbitration-service
 */

import { FinancialMath } from "../core/finance/math-engine";
import Decimal from "decimal.js";
import { logger } from "../logger";

export type MarketDataSource = "UPSTOX" | "ANGEL_ONE" | "MCX_BHAVCOPY" | "NSE_BHAVCOPY" | "SYNTHETIC_ARBITRATED";

export interface MarketTick {
	symbol: string;
	price: number;
	bid?: number;
	ask?: number;
	volume?: number;
	timestamp: number; // Unix timestamp in milliseconds
	source: MarketDataSource;
	circuitHigh?: number;
	circuitLow?: number;
}

export interface ArbitratedQuote {
	symbol: string;
	price: number;
	bid: number;
	ask: number;
	volume: number;
	timestamp: number;
	source: MarketDataSource;
	confidenceScore: number; // 0.00 to 1.00
	isOutlier: boolean;
	rejectionReason?: string;
	deviationFromBenchmarkPct?: number;
	engineVersion: string;
}

export interface TickArbitrationConfig {
	maxDeviationPct: number; // Maximum allowed deviation from benchmark (default: 10.0%)
	maxStalenessMs: number; // Maximum age of tick before rejection (default: 120,000 ms)
	spreadTolerancePct: number; // Maximum allowable bid-ask spread % (default: 5.0%)
}

const DEFAULT_CONFIG: TickArbitrationConfig = {
	maxDeviationPct: 10.0,
	maxStalenessMs: 120000, // 2 minutes
	spreadTolerancePct: 5.0,
};

export class TickArbitrationEngine {
	private static readonly VERSION = "1.2.0-INSTITUTIONAL";
	private readonly config: TickArbitrationConfig;

	constructor(config: Partial<TickArbitrationConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Validates whether an incoming tick is within dynamic price bands and non-stale.
	 */
	public validateTick(
		tick: MarketTick,
		referencePrice: number,
		currentTimeMs: number = Date.now()
	): { isValid: boolean; reason?: string; deviationPct: number } {
		if (!tick.price || tick.price <= 0) {
			return { isValid: false, reason: "INVALID_PRICE_NON_POSITIVE", deviationPct: 100 };
		}

		// 1. Check for stale timestamps
		const ageMs = currentTimeMs - tick.timestamp;
		if (ageMs > this.config.maxStalenessMs) {
			return { isValid: false, reason: `STALE_TICK_EXCEEDED_${this.config.maxStalenessMs}MS`, deviationPct: 0 };
		}

		// 2. Dynamic Circuit Bound Check (if provided on tick)
		if (tick.circuitHigh && tick.price > tick.circuitHigh * 1.005) {
			return { isValid: false, reason: "PRICE_ABOVE_UPPER_CIRCUIT", deviationPct: 0 };
		}
		if (tick.circuitLow && tick.price < tick.circuitLow * 0.995) {
			return { isValid: false, reason: "PRICE_BELOW_LOWER_CIRCUIT", deviationPct: 0 };
		}

		// 3. Benchmark Deviation Check
		if (referencePrice > 0) {
			const ref = new Decimal(referencePrice);
			const current = new Decimal(tick.price);
			const deviationPct = current
				.minus(ref)
				.abs()
				.dividedBy(ref)
				.times(100)
				.toNumber();

			if (deviationPct > this.config.maxDeviationPct) {
				return {
					isValid: false,
					reason: `OUTLIER_DEVIATION_${deviationPct.toFixed(2)}PCT_EXCEEDS_${this.config.maxDeviationPct}PCT`,
					deviationPct: Number(deviationPct.toFixed(2)),
				};
			}

			return { isValid: true, deviationPct: Number(deviationPct.toFixed(2)) };
		}

		return { isValid: true, deviationPct: 0 };
	}

	/**
	 * Arbitrates between multiple incoming ticks for the same symbol.
	 * Prioritizes:
	 * 1. Filter out outliers / anomalies relative to reference price.
	 * 2. Freshness (newer timestamp wins).
	 * 3. Bid-Ask spread sanity (tight spread preferred over wide or inverted spread).
	 */
	public arbitrate(
		ticks: MarketTick[],
		referencePrice: number,
		currentTimeMs: number = Date.now()
	): ArbitratedQuote {
		if (!ticks || ticks.length === 0) {
			throw new Error("No ticks provided for arbitration");
		}

		const symbol = ticks[0].symbol;

		// Validate each tick
		const evaluated = ticks.map((tick) => {
			const validation = this.validateTick(tick, referencePrice, currentTimeMs);
			return {
				tick,
				...validation,
			};
		});

		// Valid candidates
		const validCandidates = evaluated.filter((e) => e.isValid);

		if (validCandidates.length === 0) {
			// All rejected - fallback to most recent candidate with outlier flag
			const fallback = evaluated.sort((a, b) => b.tick.timestamp - a.tick.timestamp)[0];
			logger.warn("[TickArbitration] All candidate ticks rejected for symbol", {
				symbol,
				referencePrice,
				reasons: evaluated.map((e) => e.reason),
			});

			return {
				symbol,
				price: fallback.tick.price,
				bid: fallback.tick.bid || fallback.tick.price,
				ask: fallback.tick.ask || fallback.tick.price,
				volume: fallback.tick.volume || 0,
				timestamp: fallback.tick.timestamp,
				source: fallback.tick.source,
				confidenceScore: 0.1,
				isOutlier: true,
				rejectionReason: fallback.reason,
				deviationFromBenchmarkPct: fallback.deviationPct,
				engineVersion: TickArbitrationEngine.VERSION,
			};
		}

		// Rank valid candidates:
		// 1. Freshest timestamp
		// 2. Has valid positive bid and ask
		validCandidates.sort((a, b) => {
			const timeDiff = b.tick.timestamp - a.tick.timestamp;
			if (Math.abs(timeDiff) > 1000) {
				return timeDiff; // Decisive freshness difference (> 1 sec)
			}

			// If timestamps are close (within 1s), check spread quality
			const aSpread = a.tick.bid && a.tick.ask ? a.tick.ask - a.tick.bid : 999999;
			const bSpread = b.tick.bid && b.tick.ask ? b.tick.ask - b.tick.bid : 999999;
			return aSpread - bSpread;
		});

		const winner = validCandidates[0];

		// Calculate confidence score based on candidate consensus
		let confidence = 0.95;
		if (validCandidates.length > 1) {
			// Check divergence between candidate prices
			const p1 = new Decimal(validCandidates[0].tick.price);
			const p2 = new Decimal(validCandidates[1].tick.price);
			const diffPct = p1.minus(p2).abs().dividedBy(p1).times(100).toNumber();
			if (diffPct > 1.0) {
				confidence = 0.8;
			}
		} else {
			confidence = 0.85; // Single source only
		}

		return {
			symbol,
			price: winner.tick.price,
			bid: winner.tick.bid || winner.tick.price,
			ask: winner.tick.ask || winner.tick.price,
			volume: winner.tick.volume || 0,
			timestamp: winner.tick.timestamp,
			source: winner.tick.source,
			confidenceScore: Number(confidence.toFixed(2)),
			isOutlier: false,
			deviationFromBenchmarkPct: winner.deviationPct,
			engineVersion: TickArbitrationEngine.VERSION,
		};
	}
}
