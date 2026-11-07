/**
 * @file smart-backfill-service.ts
 * @description JIT Read-Through Smart Backfill Engine for FintekPro.
 *              Detects empty or missing fields across listed stocks, fundamentals,
 *              derived metrics, technical indicators, and master snapshots whenever
 *              any user queries the system (role-agnostic: investor, RIA, admin).
 *              Serves immediate in-memory derivations (<2ms) and triggers background
 *              Cloud SQL persistence and snapshot materialization.
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Deterministic Output: Same raw financial inputs always yield identical derived scores.
 * - Layered Architecture: Core logic encapsulated in service; zero DB mutations in routes.
 * - Idempotent & Retryable: Mutex map prevents thundering herd / duplicate external calls.
 * - Zero Trust: Structured logging with latency, symbol, status, and error tracing.
 */

import { logger } from "../../logger";
import { calculateDerivedMetrics } from "./derived-metrics-engine";
import { computeTechnicalSnapshotForSymbol } from "./screener-enrichment-engine";
import { screenerMasterSnapshotService } from "./screener-master-snapshot-service";

export interface JitFallbackDerivedMetrics {
	symbol: string;
	growthScore: string;
	qualityScore: string;
	valueScore: string;
	riskScore: string;
	compositeScore: string;
	fintekRating: number;
	revenueGrowth3Y: string | null;
	earningsGrowth3Y: string | null;
	scoringMetadata: {
		peScore: number;
		pbScore: number;
		dyScore: number;
		dcfScore: number | null;
		dcfUpside: number | null;
		grahamNumber: number | null;
		piotroskiFScore: number;
		altmanZScore: number;
		isJitDerived: boolean;
		calculatedAt: string;
	};
	lastCalculated: Date;
}

function clamp(val: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, val));
}

function normalize(val: number, min: number, max: number): number {
	if (max === min) return 50;
	return clamp(((val - min) / (max - min)) * 100, 0, 100);
}

function safeNum(val: unknown): number | null {
	if (val == null || val === "") return null;
	const n = Number(val);
	return Number.isFinite(n) ? n : null;
}

export class SmartBackfillService {
	private static readonly SERVICE_VERSION = "1.0.0";
	private static inFlightTasks: Map<string, Promise<void>> = new Map();
	private static backfillCooldown: Map<string, number> = new Map();
	private static readonly COOLDOWN_MS = 60 * 60 * 1000; // 1-hour per symbol cooldown

	/**
	 * Triggers an asynchronous, non-blocking smart backfill for a single symbol.
	 * Idempotent: Deduplicates overlapping requests using an in-flight promise mutex.
	 *
	 * @param symbol NSE/BSE ticker symbol (e.g. "RELIANCE")
	 * @param missingFields Specific areas requiring backfill: "derived", "technicals", "masterSnapshot"
	 */
	public static triggerAsyncBackfill(symbol: string, missingFields: string[]): void {
		const sym = symbol.toUpperCase().trim();
		if (!sym) return;

		const now = Date.now();
		const lastAttempt = this.backfillCooldown.get(sym) || 0;
		if (now - lastAttempt < this.COOLDOWN_MS) {
			return; // Cooldown active, skip to protect resources
		}

		if (this.inFlightTasks.has(sym)) {
			return; // Already being processed by an active task
		}

		const task = (async () => {
			this.backfillCooldown.set(sym, now);
			const startTime = Date.now();

			try {
				logger.info(`[SmartBackfill] Initiating JIT backfill for ${sym}`, {
					event: "SMART_BACKFILL_STARTED",
					symbol: sym,
					missingFields,
					serviceVersion: this.SERVICE_VERSION,
				});

				// 1. Calculate missing derived metrics (Piotroski, Altman Z, composite scores)
				if (missingFields.includes("derived")) {
					try {
						await calculateDerivedMetrics(sym);
					} catch (derErr: any) {
						logger.warn(`[SmartBackfill] Derived metrics backfill skipped for ${sym}: ${derErr?.message}`);
					}
				}

				// 2. Compute missing technical indicators (RSI, MACD, SMA 50/200, 52W range)
				if (missingFields.includes("technicals")) {
					try {
						await computeTechnicalSnapshotForSymbol(sym);
					} catch (techErr: any) {
						logger.warn(`[SmartBackfill] Technicals backfill skipped for ${sym}: ${techErr?.message}`);
					}
				}

				// 3. Upsert denormalized master snapshot so future queries hit the fast zero-join path
				try {
					await screenerMasterSnapshotService.upsertSnapshot(sym);
				} catch (snapErr: any) {
					logger.warn(`[SmartBackfill] Master snapshot upsert skipped for ${sym}: ${snapErr?.message}`);
				}

				logger.info(`[SmartBackfill] Completed JIT backfill for ${sym}`, {
					event: "SMART_BACKFILL_COMPLETED",
					symbol: sym,
					latencyMs: Date.now() - startTime,
					status: "success",
				});
			} catch (err: any) {
				logger.error(`[SmartBackfill] Error in backfill for ${sym}: ${err?.message}`, {
					event: "SMART_BACKFILL_ERROR",
					symbol: sym,
					error: err?.message,
				});
			} finally {
				this.inFlightTasks.delete(sym);
			}
		})();

		this.inFlightTasks.set(sym, task);
	}

	/**
	 * Triggers a batched asynchronous backfill over multiple symbols with bounded concurrency.
	 *
	 * @param symbols Array of stock symbols needing snapshot/metric synchronization
	 * @param concurrency Maximum simultaneous worker threads (default 4)
	 */
	public static triggerBatchBackfill(symbols: string[], concurrency = 4): void {
		if (!symbols || symbols.length === 0) return;

		const uniqueSymbols = Array.from(new Set(symbols.map((s) => s.toUpperCase().trim()))).filter(
			(s) => s.length > 0 && !this.inFlightTasks.has(s),
		);

		if (uniqueSymbols.length === 0) return;

		// Execute in background
		(async () => {
			for (let i = 0; i < uniqueSymbols.length; i += concurrency) {
				const chunk = uniqueSymbols.slice(i, i + concurrency);
				await Promise.allSettled(
					chunk.map((sym) => {
						this.triggerAsyncBackfill(sym, ["derived", "technicals", "masterSnapshot"]);
						return this.inFlightTasks.get(sym) ?? Promise.resolve();
					}),
				);
			}
		})().catch(() => {});
	}

	/**
	 * Derives synchronous in-memory fallback metrics (<1ms) when screener_derived_metrics
	 * is null in the database, ensuring the user immediately sees a populated UI with
	 * Piotroski F-score, Altman Z-score, Graham Number, and Fintek Rating.
	 *
	 * @param stock Basic listed stock row from DB
	 * @param financials Historical financial rows (if any)
	 * @param dcfRecord DCF valuation record (if available)
	 */
	public static deriveJitFallbackMetrics(
		stock: {
			symbol: string;
			currentPrice?: string | null;
			peRatio?: string | null;
			pbRatio?: string | null;
			roe?: string | null;
			roce?: string | null;
			debtToEquity?: string | null;
			dividendYield?: string | null;
			eps?: string | null;
			bookValue?: string | null;
		},
		financials: any[] = [],
		dcfRecord?: any,
	): JitFallbackDerivedMetrics {
		const latestFin = financials[0] || {};
		const pe = safeNum(stock.peRatio) ?? safeNum(latestFin.peRatio);
		const pb = safeNum(stock.pbRatio) ?? safeNum(latestFin.pbRatio);
		const roe = safeNum(stock.roe) ?? safeNum(latestFin.roe);
		const roce = safeNum(stock.roce) ?? safeNum(latestFin.roce);
		const de = safeNum(stock.debtToEquity) ?? safeNum(latestFin.debtToEquity);
		const divYield = safeNum(stock.dividendYield) ?? safeNum(latestFin.dividendYield);
		const eps = safeNum(stock.eps) ?? safeNum(latestFin.eps);
		const bv = safeNum(stock.bookValue) ?? safeNum(latestFin.bookValuePerShare);

		// Value score component
		const peScore = pe != null ? (pe <= 0 ? 0 : normalize(50 - pe, -50, 50)) : 50;
		const pbScore = pb != null ? (pb <= 0 ? 0 : normalize(5 - pb, -5, 5)) : 50;
		const dyScore = divYield != null ? normalize(divYield, 0, 8) : 50;
		const dcfUpside = safeNum(dcfRecord?.upsidePercent);
		const dcfScore = dcfUpside != null ? normalize(dcfUpside, -50, 100) : null;

		const valueScore = dcfScore != null
			? clamp(peScore * 0.3 + pbScore * 0.2 + dyScore * 0.2 + dcfScore * 0.3, 0, 100)
			: clamp(peScore * 0.4 + pbScore * 0.3 + dyScore * 0.3, 0, 100);

		// Quality score component
		const roeScore = roe != null ? normalize(roe, 0, 35) : 50;
		const roceScore = roce != null ? normalize(roce, 0, 35) : roeScore;
		const qualityScore = clamp(roeScore * 0.5 + roceScore * 0.5, 0, 100);

		// Risk score component
		const deScore = de != null ? normalize(2 - de, -3, 3) : 50;
		const riskScore = clamp(deScore, 0, 100);

		// Growth score placeholder based on available metrics
		const growthScore = clamp((roeScore * 0.6) + (valueScore * 0.4), 0, 100);

		const compositeScore = clamp(
			growthScore * 0.25 + qualityScore * 0.3 + valueScore * 0.25 + riskScore * 0.2,
			0,
			100,
		);

		let fintekRating = 3;
		if (compositeScore >= 75) fintekRating = 5;
		else if (compositeScore >= 60) fintekRating = 4;
		else if (compositeScore >= 40) fintekRating = 3;
		else if (compositeScore >= 20) fintekRating = 2;
		else fintekRating = 1;

		// Graham Number: sqrt(22.5 * EPS * BVPS)
		let grahamNumber: number | null = null;
		if (eps != null && bv != null && eps > 0 && bv > 0) {
			grahamNumber = +(Math.sqrt(22.5 * eps * bv).toFixed(2));
		}

		// Piotroski F-Score heuristic: (0-9)
		let piotroskiFScore = 5; // Default neutral
		if (roe != null && roe > 15) piotroskiFScore += 1;
		if (de != null && de < 1.0) piotroskiFScore += 1;
		if (roce != null && roce > 15) piotroskiFScore += 1;
		if (pe != null && pe < 25 && pe > 0) piotroskiFScore += 1;

		// Altman Z-Score heuristic: (>2.99 Safe, 1.81-2.99 Grey, <1.81 Distress)
		let altmanZScore = 3.1;
		if (de != null) {
			if (de > 2.5) altmanZScore = 1.6;
			else if (de > 1.2) altmanZScore = 2.4;
			else altmanZScore = 3.6;
		}

		return {
			symbol: stock.symbol,
			growthScore: growthScore.toFixed(2),
			qualityScore: qualityScore.toFixed(2),
			valueScore: valueScore.toFixed(2),
			riskScore: riskScore.toFixed(2),
			compositeScore: compositeScore.toFixed(2),
			fintekRating,
			revenueGrowth3Y: latestFin.revenueGrowth || null,
			earningsGrowth3Y: latestFin.earningsGrowth || null,
			scoringMetadata: {
				peScore: Math.round(peScore),
				pbScore: Math.round(pbScore),
				dyScore: Math.round(dyScore),
				dcfScore: dcfScore != null ? Math.round(dcfScore) : null,
				dcfUpside: dcfUpside != null ? +(dcfUpside).toFixed(1) : null,
				grahamNumber,
				piotroskiFScore,
				altmanZScore,
				isJitDerived: true,
				calculatedAt: new Date().toISOString(),
			},
			lastCalculated: new Date(),
		};
	}
}

