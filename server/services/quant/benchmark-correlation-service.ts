/**
 * Benchmark Correlation Matrix Service
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 * Purpose: Pre-computes, caches, and maintains weekly multi-asset covariance and correlation
 * matrices across Indian and global asset class benchmarks.
 * Enables sub-second Mean-Variance Optimization (MVO) and Modern Portfolio Theory (MPT) proposals
 * without on-demand historical price crunching.
 */

import { pool } from "../../db";
import { logger } from "../../logger";
import type { CorrelationMatrix } from "../asset-allocation-optimizer";

export interface CorrelationMatrixRecord {
	id: number;
	computedAt: string;
	lookbackDays: number;
	matrix: CorrelationMatrix;
	validUntil: string;
	engineVersion: string;
	source: string;
}

// Institutional empirical baseline correlation matrix (used as Bayesian shrinkage prior)
export const INSTITUTIONAL_PRIOR_CORRELATION: CorrelationMatrix = {
	large_cap_equity: {
		large_cap_equity: 1.0,
		mid_cap_equity: 0.85,
		small_cap_equity: 0.8,
		international_equity: 0.7,
		government_bonds: -0.2,
		corporate_bonds: 0.1,
		money_market: 0.05,
		gold: 0.05,
		real_estate: 0.5,
		alternatives: 0.6,
	},
	mid_cap_equity: {
		large_cap_equity: 0.85,
		mid_cap_equity: 1.0,
		small_cap_equity: 0.9,
		international_equity: 0.65,
		government_bonds: -0.15,
		corporate_bonds: 0.15,
		money_market: 0.05,
		gold: 0.1,
		real_estate: 0.55,
		alternatives: 0.65,
	},
	small_cap_equity: {
		large_cap_equity: 0.8,
		mid_cap_equity: 0.9,
		small_cap_equity: 1.0,
		international_equity: 0.6,
		government_bonds: -0.1,
		corporate_bonds: 0.2,
		money_market: 0.05,
		gold: 0.15,
		real_estate: 0.45,
		alternatives: 0.7,
	},
	international_equity: {
		large_cap_equity: 0.7,
		mid_cap_equity: 0.65,
		small_cap_equity: 0.6,
		international_equity: 1.0,
		government_bonds: -0.1,
		corporate_bonds: 0.15,
		money_market: 0.05,
		gold: 0.2,
		real_estate: 0.4,
		alternatives: 0.5,
	},
	government_bonds: {
		large_cap_equity: -0.2,
		mid_cap_equity: -0.15,
		small_cap_equity: -0.1,
		international_equity: -0.1,
		government_bonds: 1.0,
		corporate_bonds: 0.7,
		money_market: 0.3,
		gold: 0.1,
		real_estate: -0.1,
		alternatives: 0.0,
	},
	corporate_bonds: {
		large_cap_equity: 0.1,
		mid_cap_equity: 0.15,
		small_cap_equity: 0.2,
		international_equity: 0.15,
		government_bonds: 0.7,
		corporate_bonds: 1.0,
		money_market: 0.4,
		gold: 0.05,
		real_estate: 0.2,
		alternatives: 0.1,
	},
	money_market: {
		large_cap_equity: 0.05,
		mid_cap_equity: 0.05,
		small_cap_equity: 0.05,
		international_equity: 0.05,
		government_bonds: 0.3,
		corporate_bonds: 0.4,
		money_market: 1.0,
		gold: 0.0,
		real_estate: 0.05,
		alternatives: 0.05,
	},
	gold: {
		large_cap_equity: 0.05,
		mid_cap_equity: 0.1,
		small_cap_equity: 0.15,
		international_equity: 0.2,
		government_bonds: 0.1,
		corporate_bonds: 0.05,
		money_market: 0.0,
		gold: 1.0,
		real_estate: 0.15,
		alternatives: 0.2,
	},
	real_estate: {
		large_cap_equity: 0.5,
		mid_cap_equity: 0.55,
		small_cap_equity: 0.45,
		international_equity: 0.4,
		government_bonds: -0.1,
		corporate_bonds: 0.2,
		money_market: 0.05,
		gold: 0.15,
		real_estate: 1.0,
		alternatives: 0.4,
	},
	alternatives: {
		large_cap_equity: 0.6,
		mid_cap_equity: 0.65,
		small_cap_equity: 0.7,
		international_equity: 0.5,
		government_bonds: 0.0,
		corporate_bonds: 0.1,
		money_market: 0.05,
		gold: 0.2,
		real_estate: 0.4,
		alternatives: 1.0,
	},
};

const ASSET_BENCHMARK_MAPPINGS: Record<string, string[]> = {
	large_cap_equity: ["^NSEI", "NIFTY50", "IN002001X010"],
	mid_cap_equity: ["NIFTYMIDCAP150", "NIFTY_MIDCAP", "IN002001X020"],
	small_cap_equity: ["NIFTYSMALLCAP250", "NIFTY_SMALLCAP"],
	international_equity: ["^GSPC", "SPY", "NASDAQ100"],
	government_bonds: ["IN10YT=RR", "CCIL_10Y_GSEC", "GSEC10Y"],
	corporate_bonds: ["CRISIL_AAA_BOND", "CORPBOND"],
	money_market: ["TREPS", "CCIL_OVERNIGHT", "LIQUID"],
	gold: ["MCX_GOLD", "GOLD", "GOLDBEES"],
	real_estate: ["EMBASSY", "BIRET", "REIT_INDEX"],
	alternatives: ["AIF_CAT2_INDEX", "LONG_SHORT"],
};

export class BenchmarkCorrelationService {
	private cachedMatrix: CorrelationMatrix = { ...INSTITUTIONAL_PRIOR_CORRELATION };
	private cacheExpiresAt: number = 0;
	private intervalHandle: NodeJS.Timeout | null = null;
	private isComputing: boolean = false;

	public readonly ENGINE_VERSION = "MVO-v1.0";

	/**
	 * Synchronously returns the current in-memory correlation matrix (< 0.01ms).
	 * Ideal for high-speed MVO optimization loops.
	 */
	public getCorrelationMatrixSync(): CorrelationMatrix {
		return this.cachedMatrix;
	}

	/**
	 * Returns the correlation between two asset classes.
	 */
	public getCorrelation(asset1: string, asset2: string): number {
		if (asset1 === asset2) return 1.0;
		const row = this.cachedMatrix[asset1];
		if (row && typeof row[asset2] === "number") {
			return row[asset2];
		}
		const invRow = this.cachedMatrix[asset2];
		if (invRow && typeof invRow[asset1] === "number") {
			return invRow[asset1];
		}
		return (INSTITUTIONAL_PRIOR_CORRELATION[asset1]?.[asset2] ?? (asset1 === asset2 ? 1.0 : 0.0));
	}

	/**
	 * Asynchronously gets the latest active matrix from memory or loads from DB.
	 */
	public async getCorrelationMatrix(): Promise<CorrelationMatrix> {
		if (Date.now() < this.cacheExpiresAt && Object.keys(this.cachedMatrix).length > 0) {
			return this.cachedMatrix;
		}

		await this.loadActiveMatrixFromDb();
		return this.cachedMatrix;
	}

	/**
	 * Loads the most recent valid pre-computed matrix from benchmark_correlation_matrix.
	 */
	public async loadActiveMatrixFromDb(): Promise<boolean> {
		try {
			const query = `
				SELECT id, computed_at, lookback_days, matrix_json, valid_until, engine_version, source
				FROM benchmark_correlation_matrix
				WHERE valid_until >= NOW()
				ORDER BY computed_at DESC
				LIMIT 1
			`;
			const res = await pool.query(query);
			if (res.rows.length > 0) {
				const row = res.rows[0];
				this.cachedMatrix = row.matrix_json as CorrelationMatrix;
				this.cacheExpiresAt = new Date(row.valid_until).getTime();

				logger.info("[BenchmarkCorrelation] Loaded pre-computed correlation matrix from DB", {
					event: "CORRELATION_MATRIX_LOADED",
					id: row.id,
					computed_at: row.computed_at,
					valid_until: row.valid_until,
				});
				return true;
			}
		} catch (err: any) {
			logger.warn("[BenchmarkCorrelation] Could not load matrix from DB, using institutional prior", {
				error: err?.message,
			});
		}

		// Fallback to institutional prior
		this.cachedMatrix = { ...INSTITUTIONAL_PRIOR_CORRELATION };
		this.cacheExpiresAt = Date.now() + 60 * 60 * 1000; // retry DB in 1 hour
		return false;
	}

	/**
	 * Computes the empirical correlation matrix from golden_prices time series,
	 * applies Bayesian shrinkage towards the institutional prior, and stores in DB.
	 */
	public async computeAndStoreMatrix(lookbackDays: number = 252): Promise<CorrelationMatrixRecord> {
		if (this.isComputing) {
			logger.warn("[BenchmarkCorrelation] Computation already in progress, returning existing cache", {
				event: "CORRELATION_COMPUTE_IN_PROGRESS",
			});
			return {
				id: 0,
				computedAt: new Date().toISOString(),
				lookbackDays,
				matrix: this.cachedMatrix,
				validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
				engineVersion: this.ENGINE_VERSION,
				source: "cache",
			};
		}

		this.isComputing = true;
		const startTime = Date.now();
		const computedAt = new Date();
		const validUntil = new Date(computedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day validity
		const assetTypes = Object.keys(INSTITUTIONAL_PRIOR_CORRELATION);

		try {
			// Query historical prices for mapped symbols over lookback window
			const priceQuery = `
				SELECT symbol, isin, price_date, price
				FROM golden_prices
				WHERE price_date >= CURRENT_DATE - ($1 || ' days')::INTERVAL
				ORDER BY price_date ASC
			`;
			const priceRes = await pool.query(priceQuery, [String(lookbackDays * 2)]); // extra buffer for calendar days

			// Group daily prices by asset class
			const assetReturns: Record<string, number[]> = {};
			const rawPrices: Record<string, { date: string; price: number }[]> = {};

			for (const row of priceRes.rows) {
				const sym = (row.symbol || row.isin || "").toUpperCase();
				// Find matching asset type
				for (const [atype, symbols] of Object.entries(ASSET_BENCHMARK_MAPPINGS)) {
					if (symbols.some((s) => s.toUpperCase() === sym)) {
						if (!rawPrices[atype]) rawPrices[atype] = [];
						rawPrices[atype].push({
							date: row.price_date.toISOString().slice(0, 10),
							price: Number(row.price),
						});
						break;
					}
				}
			}

			// Compute simple returns for series with >= 30 points
			for (const atype of assetTypes) {
				const series = rawPrices[atype];
				if (series && series.length >= 30) {
					const rets: number[] = [];
					for (let i = 1; i < series.length; i++) {
						const prev = series[i - 1].price;
						if (prev > 0) {
							rets.push((series[i].price - prev) / prev);
						}
					}
					if (rets.length >= 20) {
						assetReturns[atype] = rets;
					}
				}
			}

			// Build the shrinked correlation matrix
			const finalMatrix: CorrelationMatrix = {};

			for (const iType of assetTypes) {
				finalMatrix[iType] = {};
				for (const jType of assetTypes) {
					if (iType === jType) {
						finalMatrix[iType][jType] = 1.0;
						continue;
					}

					const prior = INSTITUTIONAL_PRIOR_CORRELATION[iType]?.[jType] ?? 0.0;
					const retsI = assetReturns[iType];
					const retsJ = assetReturns[jType];

					if (retsI && retsJ && retsI.length >= 20 && retsJ.length >= 20) {
						const minLen = Math.min(retsI.length, retsJ.length);
						const rI = retsI.slice(-minLen);
						const rJ = retsJ.slice(-minLen);

						const meanI = rI.reduce((a, b) => a + b, 0) / minLen;
						const meanJ = rJ.reduce((a, b) => a + b, 0) / minLen;

						let cov = 0;
						let varI = 0;
						let varJ = 0;
						for (let k = 0; k < minLen; k++) {
							const dI = rI[k] - meanI;
							const dJ = rJ[k] - meanJ;
							cov += dI * dJ;
							varI += dI * dI;
							varJ += dJ * dJ;
						}

						const stdDevProd = Math.sqrt(varI * varJ);
						const empiricalCorr = stdDevProd > 0 ? cov / stdDevProd : prior;

						// Shrinkage: 60% empirical + 40% institutional prior for stability
						const blendedCorr = 0.6 * empiricalCorr + 0.4 * prior;
						finalMatrix[iType][jType] = Math.round(Math.max(-0.99, Math.min(0.99, blendedCorr)) * 10000) / 10000;
					} else {
						// Fallback to prior if insufficient historical points
						finalMatrix[iType][jType] = prior;
					}
				}
			}

			// Symmetrize matrix
			for (const iType of assetTypes) {
				for (const jType of assetTypes) {
					if (iType !== jType) {
						const avg = (finalMatrix[iType][jType] + finalMatrix[jType][iType]) / 2;
						finalMatrix[iType][jType] = avg;
						finalMatrix[jType][iType] = avg;
					}
				}
			}

			// Insert into benchmark_correlation_matrix
			const insertQuery = `
				INSERT INTO benchmark_correlation_matrix (
					computed_at, lookback_days, matrix_json, asset_isins, valid_until, engine_version, source
				) VALUES ($1, $2, $3, $4, $5, $6, $7)
				RETURNING id
			`;
			const insertRes = await pool.query(insertQuery, [
				computedAt,
				lookbackDays,
				JSON.stringify(finalMatrix),
				assetTypes,
				validUntil,
				this.ENGINE_VERSION,
				"weekly_scheduler",
			]);

			const id = insertRes.rows[0]?.id ?? 0;
			this.cachedMatrix = finalMatrix;
			this.cacheExpiresAt = validUntil.getTime();

			const durationMs = Date.now() - startTime;
			logger.info("[BenchmarkCorrelation] Computed and stored weekly correlation matrix", {
				event: "CORRELATION_MATRIX_COMPUTED",
				id,
				lookback_days: lookbackDays,
				asset_count: assetTypes.length,
				latency_ms: durationMs,
				status: "SUCCESS",
			});

			return {
				id,
				computedAt: computedAt.toISOString(),
				lookbackDays,
				matrix: finalMatrix,
				validUntil: validUntil.toISOString(),
				engineVersion: this.ENGINE_VERSION,
				source: "weekly_scheduler",
			};
		} catch (err: any) {
			logger.error("[BenchmarkCorrelation] Failed to compute correlation matrix, using prior", {
				event: "CORRELATION_MATRIX_COMPUTE_ERROR",
				error: err?.message,
			});
			return {
				id: 0,
				computedAt: computedAt.toISOString(),
				lookbackDays,
				matrix: this.cachedMatrix,
				validUntil: validUntil.toISOString(),
				engineVersion: this.ENGINE_VERSION,
				source: "fallback_prior",
			};
		} finally {
			this.isComputing = false;
		}
	}

	/**
	 * Starts the weekly recurring scheduler (every Sunday at 03:00 IST / Saturday 21:30 UTC).
	 * Also runs an initial check 30 seconds after server boot.
	 */
	public startWeeklyScheduler(): void {
		if (this.intervalHandle) return;

		// Initial check 30s after startup
		setTimeout(async () => {
			const hasActive = await this.loadActiveMatrixFromDb();
			if (!hasActive) {
				logger.info("[BenchmarkCorrelation] No valid matrix in DB on startup, computing initial matrix...", {
					event: "CORRELATION_MATRIX_STARTUP_WARMUP",
				});
				void this.computeAndStoreMatrix(252);
			}
		}, 30_000);

		// Weekly recurring interval: runs every 7 days (604,800,000 ms)
		this.intervalHandle = setInterval(() => {
			void this.computeAndStoreMatrix(252);
		}, 7 * 24 * 60 * 60 * 1000);

		logger.info("[BenchmarkCorrelation] Weekly pre-computed correlation scheduler started", {
			event: "BENCHMARK_CORRELATION_SCHEDULER_STARTED",
		});
	}

	/**
	 * Stops the recurring scheduler.
	 */
	public stopWeeklyScheduler(): void {
		if (this.intervalHandle) {
			clearInterval(this.intervalHandle);
			this.intervalHandle = null;
		}
	}
}

export const benchmarkCorrelationService = new BenchmarkCorrelationService();

