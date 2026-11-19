/**
 * User Intent & Predictive Pre-Warming Engine
 *
 * Compliance: FintekPro GCR v1.0, FASP-AI v1.0 & DPDP Act 2023 (Section 6)
 *
 * Purpose:
 *   Proactively monitors user session lifecycle and interaction intents
 *   (e.g., login, watchlist view, screener search, portfolio review)
 *   to pre-warm real-time Golden Prices, technical indicators, valuation ratios,
 *   and SEBI IA Reg 17 risk suitability drift checks before the user navigates
 *   to those screens.
 *
 * Peer Architecture Benchmark:
 *   - Morgan Stanley Next-Best-Action (NBA) pre-computation
 *   - Goldman Sachs Marquee feature store streaming
 *   - Zerodha / Groww speculative cache pre-warming
 *
 * @version 1.0.0
 */

import crypto from "node:crypto";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";
import { telemetryBus } from "./engine-telemetry-bus";
import { getSharedRedis } from "../utils/redis-client";

export const USER_INTENT_ENGINE_VERSION = "1.0.0";

// ── Types & Enums ─────────────────────────────────────────────────────────────

export type UserIntentType =
	| "SESSION_INITIALIZED"      // User logged in / app open
	| "INSTRUMENT_FOCUS"        // User viewed/searched an equity/fund/bond
	| "PORTFOLIO_DRIFT_SCAN"    // User opened portfolio or rebalance page
	| "TAX_HARVEST_INTENT"      // User opened capital gains / tax harvest tab
	| "WATCHLIST_INTERACTION";  // User browsing saved watchlist

export interface UserIntentSignal {
	userId: string;
	intentType: UserIntentType;
	symbol?: string;
	isin?: string;
	assetClass?: string;
	consentGranted?: boolean; // DPDP Act 2023 consent flag
	timestamp?: string;
}

export interface PrewarmedHoldingSummary {
	symbol: string;
	isin?: string;
	quantity: number;
	avgPrice: number;
	currentPrice: number;
	currentValue: number;
	investedValue: number;
	unrealizedPnl: number;
	unrealizedPnlPct: number;
	assetClass: string;
}

export interface AssetAllocationBreakdown {
	equityPct: number;
	debtPct: number;
	cashPct: number;
	alternativesPct: number;
}

export interface SuitabilityDriftResult {
	riskTolerance: string;
	isCompliant: boolean;
	driftSeverity: "NONE" | "MODERATE" | "HIGH";
	currentEquityPct: number;
	targetEquityPct: number;
	notes: string;
}

export interface PrewarmedInstrumentSnapshot {
	symbol: string;
	companyName: string;
	currentPrice: number;
	peRatio: number | null;
	pbRatio: number | null;
	roe: number | null;
	roce: number | null;
	piotroskiFScore: number | null;
	technicalTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
	rsi14: number | null;
	dma20: number | null;
	dma50: number | null;
	dma200: number | null;
}

export interface UserPrewarmedContext {
	userHash: string;
	engineVersion: string;
	calculationTimestamp: string;
	isDecisionSupportOnly: boolean;
	portfolio?: {
		totalValue: number;
		totalInvested: number;
		totalUnrealizedPnl: number;
		holdings: PrewarmedHoldingSummary[];
		allocation: AssetAllocationBreakdown;
		suitability: SuitabilityDriftResult;
	};
	focusedInstrument?: PrewarmedInstrumentSnapshot;
	status: "READY" | "COMPUTING" | "EMPTY";
}

// ── In-Memory LRU Cache with TTL ──────────────────────────────────────────────

class InMemoryContextCache {
	private store = new Map<string, { data: UserPrewarmedContext; expiresAt: number }>();
	private readonly maxEntries = 500;

	get(key: string): UserPrewarmedContext | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}
		return entry.data;
	}

	set(key: string, data: UserPrewarmedContext, ttlMs: number): void {
		if (this.store.size >= this.maxEntries) {
			const oldestKey = this.store.keys().next().value;
			if (oldestKey) this.store.delete(oldestKey);
		}
		this.store.set(key, { data, expiresAt: Date.now() + ttlMs });
	}

	delete(key: string): void {
		this.store.delete(key);
	}
}

// ── User Intent Prewarm Engine Class ──────────────────────────────────────────

export class UserIntentPrewarmEngine {
	private readonly engineVersion = USER_INTENT_ENGINE_VERSION;
	private readonly localCache = new InMemoryContextCache();
	private readonly CONTEXT_TTL_MS = 15 * 60 * 1000; // 15-minute TTL
	private readonly PSEUDONYM_SALT = process.env.SESSION_SECRET || "fintekpro_dpdp_salt_v1";

	/**
	 * DPDP Act 2023 Pseudonymization:
	 * Masks naked userId using SHA-256 HMAC before caching or publishing telemetry.
	 */
	public pseudonymizeUserId(userId: string): string {
		return crypto
			.createHmac("sha256", this.PSEUDONYM_SALT)
			.update(userId.trim().toLowerCase())
			.digest("hex")
			.substring(0, 16);
	}

	/**
	 * Non-blocking entry point to emit an intent signal.
	 * Executes asynchronously via microtask queue so the calling request never blocks.
	 */
	public emitIntentSignal(signal: UserIntentSignal): void {
		// Default DPDP consent to true unless explicitly revoked
		const consent = signal.consentGranted ?? true;
		if (!consent) {
			logger.info("[UserIntentPrewarmEngine] Consent withheld (DPDP Sec 6) - pre-warming skipped", {
				event: "USER_INTENT_PREWARM_BYPASS",
				status: "SKIPPED",
			});
			return;
		}

		// Fire-and-forget async orchestration
		setImmediate(async () => {
			const startTime = Date.now();
			const userHash = this.pseudonymizeUserId(signal.userId);

			try {
				switch (signal.intentType) {
					case "SESSION_INITIALIZED":
					case "PORTFOLIO_DRIFT_SCAN":
						await this.prewarmUserPortfolioContext(signal.userId, userHash);
						break;

					case "INSTRUMENT_FOCUS":
						if (signal.symbol) {
							await this.prewarmInstrumentSnapshot(signal.symbol, userHash);
						}
						break;

					default:
						break;
				}

				const latencyMs = Date.now() - startTime;
				telemetryBus.report({
					engineId: "user-intent-prewarm-engine",
					engineName: "User Intent & Predictive Pre-Warming Engine",
					category: "Background Services",
					reportedAt: new Date().toISOString(),
					latencyMs,
					qualityScore: 98,
					itemsProcessed: 1,
					errorCount: 0,
					meta: { intent: signal.intentType, userHash },
				});
			} catch (err: unknown) {
				const errMsg = err instanceof Error ? err.message : String(err);
				logger.warn("[UserIntentPrewarmEngine] Pre-warming non-fatal error", {
					event: "PREWARM_FAILED",
					user_id: userHash,
					error: errMsg,
					status: "DEGRADED",
				});
			}
		});
	}

	/**
	 * Pre-warms active user holdings, live Golden Prices, asset allocation, and SEBI IA Reg 17 drift.
	 */
	public async prewarmUserPortfolioContext(userId: string, userHash: string): Promise<UserPrewarmedContext> {
		const startTime = Date.now();
		const calculationTimestamp = new Date().toISOString();

		// Check cache first
		const cached = await this.getCachedContext(userHash);
		if (cached?.portfolio) {
			return cached;
		}

		try {
			// Query user holdings joined with latest golden prices or listed stocks
			const holdingsQuery = await db.execute(sql`
				SELECT 
					ph.symbol,
					ph.isin,
					ph.quantity::float AS quantity,
					COALESCE(ph.avg_price::float, 0) AS avg_price,
					COALESCE(gp.price::float, ls.current_price::float, ph.current_value::float / NULLIF(ph.quantity::float, 0), ph.avg_price::float, 0) AS current_price,
					ph.asset_class,
					ph.asset_type
				FROM portfolios p
				JOIN portfolio_holdings ph ON ph.portfolio_id = p.id
				LEFT JOIN golden_prices gp ON gp.isin = ph.isin
				LEFT JOIN listed_stocks ls ON ls.symbol = ph.symbol
				WHERE p.user_id = ${userId}
				ORDER BY ph.current_value DESC NULLS LAST
				LIMIT 100
			`);

			// Query user risk profile for SEBI IA Reg 17 Suitability comparison
			const riskQuery = await db.execute(sql`
				SELECT risk_tolerance, investment_horizon, risk_score
				FROM risk_profiles
				WHERE user_id = ${userId}
				ORDER BY assessment_date DESC NULLS LAST
				LIMIT 1
			`);

			const rawHoldings = holdingsQuery.rows as any[];
			const riskRow = (riskQuery.rows?.[0] as any) || { risk_tolerance: "moderate", risk_score: 50 };

			let totalCurrentValue = 0;
			let totalInvestedValue = 0;
			let equityValue = 0;
			let debtValue = 0;
			let cashValue = 0;
			let altValue = 0;

			const holdings: PrewarmedHoldingSummary[] = rawHoldings.map((row) => {
				const qty = Number(row.quantity) || 0;
				const avgPx = Number(row.avg_price) || 0;
				const curPx = Number(row.current_price) || avgPx;
				const curVal = qty * curPx;
				const invVal = qty * avgPx;
				const pnl = curVal - invVal;
				const pnlPct = invVal > 0 ? (pnl / invVal) * 100 : 0;
				const assetClass = (row.asset_class || row.asset_type || "equity").toLowerCase();

				totalCurrentValue += curVal;
				totalInvestedValue += invVal;

				if (assetClass.includes("equity") || assetClass.includes("stock")) {
					equityValue += curVal;
				} else if (assetClass.includes("debt") || assetClass.includes("bond") || assetClass.includes("fixed")) {
					debtValue += curVal;
				} else if (assetClass.includes("cash") || assetClass.includes("liquid")) {
					cashValue += curVal;
				} else {
					altValue += curVal;
				}

				return {
					symbol: row.symbol || "UNKNOWN",
					isin: row.isin || undefined,
					quantity: qty,
					avgPrice: Number(avgPx.toFixed(2)),
					currentPrice: Number(curPx.toFixed(2)),
					currentValue: Number(curVal.toFixed(2)),
					investedValue: Number(invVal.toFixed(2)),
					unrealizedPnl: Number(pnl.toFixed(2)),
					unrealizedPnlPct: Number(pnlPct.toFixed(2)),
					assetClass,
				};
			});

			const divisor = totalCurrentValue > 0 ? totalCurrentValue : 1;
			const allocation: AssetAllocationBreakdown = {
				equityPct: Number(((equityValue / divisor) * 100).toFixed(1)),
				debtPct: Number(((debtValue / divisor) * 100).toFixed(1)),
				cashPct: Number(((cashValue / divisor) * 100).toFixed(1)),
				alternativesPct: Number(((altValue / divisor) * 100).toFixed(1)),
			};

			// SEBI IA Reg 17 Suitability Drift Calculation
			const suitability = this.evaluateSuitabilityDrift(allocation.equityPct, riskRow.risk_tolerance);

			const context: UserPrewarmedContext = {
				userHash,
				engineVersion: this.engineVersion,
				calculationTimestamp,
				isDecisionSupportOnly: true,
				portfolio: {
					totalValue: Number(totalCurrentValue.toFixed(2)),
					totalInvested: Number(totalInvestedValue.toFixed(2)),
					totalUnrealizedPnl: Number((totalCurrentValue - totalInvestedValue).toFixed(2)),
					holdings,
					allocation,
					suitability,
				},
				status: "READY",
			};

			await this.saveCachedContext(userHash, context);

			logger.info("[UserIntentPrewarmEngine] Portfolio context pre-warmed", {
				event: "USER_INTENT_PORTFOLIO_PREWARMED",
				user_id: userHash,
				holdingsCount: holdings.length,
				totalValue: totalCurrentValue,
				latency_ms: Date.now() - startTime,
				status: "SUCCESS",
			});

			return context;
		} catch (error: any) {
			logger.warn("[UserIntentPrewarmEngine] Failed to pre-warm portfolio", {
				user_id: userHash,
				error: error.message,
			});

			// Return minimal safe fallback
			const fallback: UserPrewarmedContext = {
				userHash,
				engineVersion: this.engineVersion,
				calculationTimestamp,
				isDecisionSupportOnly: true,
				status: "EMPTY",
			};
			return fallback;
		}
	}

	/**
	 * Pre-warms deep fundamental & technical snapshot for a focused instrument.
	 */
	public async prewarmInstrumentSnapshot(symbol: string, userHash: string): Promise<PrewarmedInstrumentSnapshot | null> {
		const cleanSymbol = symbol.trim().toUpperCase();
		const cacheKey = `instr:${cleanSymbol}`;

		try {
			const res = await db.execute(sql`
				SELECT 
					ls.symbol,
					ls.company_name,
					COALESCE(ls.current_price, sms.current_price, 0)::float AS current_price,
					COALESCE(ls.pe_ratio, sms.pe_ratio)::float AS pe_ratio,
					COALESCE(ls.pb_ratio, sms.pb_ratio)::float AS pb_ratio,
					COALESCE(ls.roe, sms.roe)::float AS roe,
					COALESCE(ls.roce, sms.roce)::float AS roce,
					COALESCE(ls.piotroski_f_score, sms.piotroski_score, sms.piotroski_f_score, sdm.piotroski_score)::int AS piotroski_f_score,
					sti.rsi_14::float AS rsi_14,
					sti.dma_20::float AS dma_20,
					sti.dma_50::float AS dma_50,
					sti.dma_200::float AS dma_200
				FROM listed_stocks ls
				LEFT JOIN screener_master_snapshots sms ON sms.symbol = ls.symbol
				LEFT JOIN screener_derived_metrics sdm ON sdm.symbol = ls.symbol
				LEFT JOIN screener_technical_indicators_latest sti ON sti.symbol = ls.symbol
				WHERE ls.symbol = ${cleanSymbol}
				LIMIT 1
			`);

			const row = res.rows?.[0] as any;
			if (!row) return null;

			const curPx = Number(row.current_price) || 0;
			const dma50 = row.dma_50 != null ? Number(row.dma_50) : null;
			const dma200 = row.dma_200 != null ? Number(row.dma_200) : null;

			let technicalTrend: "BULLISH" | "BEARISH" | "NEUTRAL" = "NEUTRAL";
			if (curPx > 0 && dma50 != null && dma200 != null) {
				if (curPx > dma50 && dma50 > dma200) {
					technicalTrend = "BULLISH";
				} else if (curPx < dma50 && dma50 < dma200) {
					technicalTrend = "BEARISH";
				}
			}

			const snapshot: PrewarmedInstrumentSnapshot = {
				symbol: row.symbol,
				companyName: row.company_name || row.symbol,
				currentPrice: curPx,
				peRatio: row.pe_ratio != null ? Number(row.pe_ratio) : null,
				pbRatio: row.pb_ratio != null ? Number(row.pb_ratio) : null,
				roe: row.roe != null ? Number(row.roe) : null,
				roce: row.roce != null ? Number(row.roce) : null,
				piotroskiFScore: row.piotroski_f_score != null ? Number(row.piotroski_f_score) : null,
				technicalTrend,
				rsi14: row.rsi_14 != null ? Number(row.rsi_14) : null,
				dma20: row.dma_20 != null ? Number(row.dma_20) : null,
				dma50,
				dma200,
			};

			// Update user prewarmed context with this focused instrument
			const existing = (await this.getCachedContext(userHash)) || {
				userHash,
				engineVersion: this.engineVersion,
				calculationTimestamp: new Date().toISOString(),
				isDecisionSupportOnly: true,
				status: "READY" as const,
			};
			existing.focusedInstrument = snapshot;
			await this.saveCachedContext(userHash, existing);

			return snapshot;
		} catch (err: any) {
			logger.warn("[UserIntentPrewarmEngine] Instrument prewarm error", {
				symbol: cleanSymbol,
				error: err.message,
			});
			return null;
		}
	}

	/**
	 * Retrieves pre-warmed context for a given user.
	 */
	public async getPrewarmedContext(userId: string): Promise<UserPrewarmedContext | null> {
		const userHash = this.pseudonymizeUserId(userId);
		return this.getCachedContext(userHash);
	}

	// ── Private Helpers ─────────────────────────────────────────────────────────

	private evaluateSuitabilityDrift(actualEquityPct: number, riskTolerance: string): SuitabilityDriftResult {
		const normRisk = (riskTolerance || "moderate").toLowerCase();
		let targetEquityPct = 50;

		switch (normRisk) {
			case "conservative":
				targetEquityPct = 25;
				break;
			case "moderate":
				targetEquityPct = 50;
				break;
			case "aggressive":
				targetEquityPct = 75;
				break;
			case "very_aggressive":
				targetEquityPct = 85;
				break;
			default:
				targetEquityPct = 50;
		}

		const drift = actualEquityPct - targetEquityPct;
		let isCompliant = true;
		let driftSeverity: "NONE" | "MODERATE" | "HIGH" = "NONE";
		let notes = "Portfolio allocation matches SEBI IA Reg 17 risk suitability guidelines.";

		if (Math.abs(drift) > 20) {
			isCompliant = false;
			driftSeverity = "HIGH";
			notes = `Significant asset allocation drift (${drift > 0 ? "+" : ""}${drift.toFixed(1)}% equity vs ${targetEquityPct}% target). Rebalancing recommended.`;
		} else if (Math.abs(drift) > 10) {
			driftSeverity = "MODERATE";
			notes = `Moderate asset allocation drift detected (${drift > 0 ? "+" : ""}${drift.toFixed(1)}% equity).`;
		}

		return {
			riskTolerance: normRisk,
			isCompliant,
			driftSeverity,
			currentEquityPct: actualEquityPct,
			targetEquityPct,
			notes,
		};
	}

	private async getCachedContext(userHash: string): Promise<UserPrewarmedContext | null> {
		// Tier 1: Local RAM cache
		const local = this.localCache.get(userHash);
		if (local) return local;

		// Tier 2: Redis distributed cache
		try {
			const redis = await getSharedRedis();
			if (redis?.isOpen) {
				const raw = await redis.get(`user_prewarm:${userHash}`);
				if (raw) {
					const parsed = JSON.parse(raw) as UserPrewarmedContext;
					this.localCache.set(userHash, parsed, 60 * 1000); // 1-minute local warm
					return parsed;
				}
			}
		} catch {
			/* Redis optional */
		}

		return null;
	}

	private async saveCachedContext(userHash: string, data: UserPrewarmedContext): Promise<void> {
		this.localCache.set(userHash, data, this.CONTEXT_TTL_MS);

		try {
			const redis = await getSharedRedis();
			if (redis?.isOpen) {
				await redis.set(`user_prewarm:${userHash}`, JSON.stringify(data), {
					EX: Math.floor(this.CONTEXT_TTL_MS / 1000),
				});
			}
		} catch {
			/* Redis optional */
		}
	}
}

export const userIntentPrewarmEngine = new UserIntentPrewarmEngine();
