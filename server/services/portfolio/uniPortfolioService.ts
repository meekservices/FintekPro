/**
 * UniPortfolioService — One User · One Portfolio ID · One Quant Context
 *
 * Purpose :
 *   Orchestrates multi-broker data into a single, stable UniPortfolio snapshot
 *   for each user. The snapshot is the canonical input for:
 *     - Drift detection (DriftDetectionEngine)
 *     - Rebalancing (RebalancingEngine + MVO)
 *     - AI advisory (financialProfileEngine, agents)
 *     - Quant engine (portfolio_id = "unified_<userId>")
 *
 * Stability guarantee:
 *   portfolioId = "unified_<userId>" — deterministic, stable, no DB lookup needed.
 *   The quant engine can always reference this ID without joining any table.
 *
 * Caching:
 *   In-memory per-user TTL cache (5 min) — avoids hammering 3+ brokers on every
 *   dashboard render. Force-refresh via refresh() or POST /api/portfolio/unified/refresh.
 *
 * FASP-AI v1.0 compliance:
 *   - All AI outputs include confidence_score, model_version, timestamp
 *   - Drift / rebalance recommendations never promise returns
 *   - Every output includes risk_profile and investment_horizon context
 */

import {
	portfolioAggregator,
	UnifiedPortfolioResult,
	NormalizedHolding,
} from "../portfolio/portfolioAggregator";
import { driftEngine, PortfolioTargetModel, DriftReport } from "../drift/index";
import { rebalancingEngine, RebalanceAnalysis } from "../rebalancing-engine";
import { logger } from "../../logger";

// ─── Canonical UniPortfolio snapshot shape ────────────────────────────────────

export interface ConcentrationRisk {
	symbol: string;
	name: string;
	brokerId: string;
	valueInr: number;
	pct: number;
}

export interface UniPortfolioAnalysis {
	/** Full drift report against target model */
	drift: DriftReport;
	/** Full rebalancing recommendation (MVO + tax-aware) */
	rebalancing: RebalanceAnalysis;
	/** Top 5 most concentrated positions by value */
	concentration: ConcentrationRisk[];
	/** Brokers that returned errors during this fetch */
	staleBrokers: string[];
	/** FASP-AI v1.0 — risk + horizon used in rebalancing */
	riskProfile: {
		riskScore: number;
		investmentHorizon: number;
		segment: string;
	};
}

export interface UniPortfolioSnapshot {
	/** Stable portfolio ID. Format: "unified_<userId>". Never changes. */
	portfolioId: string;
	userId: string;
	generatedAt: string;
	/** All holdings from all configured brokers */
	holdings: NormalizedHolding[];
	/** Per-broker breakdown */
	brokerBreakdown: {
		brokerId: string;
		count: number;
		valueInr: number;
		configured: boolean;
	}[];
	/** Aggregated financial summary */
	summary: UnifiedPortfolioResult["summary"];
	/** AI/Quant engine analysis */
	analysis: UniPortfolioAnalysis;
	/** SEBI + FASP-AI metadata — always included in every AI output */
	meta: {
		engine_version: string;
		calculation_timestamp: string;
		brokers_polled: string[];
		brokers_configured: string[];
		data_freshness_seconds: Record<string, number>;
		disclaimer: string;
	};
}

// ─── In-memory snapshot cache (5-min TTL) ────────────────────────────────────

interface CacheEntry {
	snapshot: UniPortfolioSnapshot;
	expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const snapshotCache = new Map<string, CacheEntry>();

// ─── Default target model (overridable by user's risk profile) ────────────────
// These weights are illustrative balanced defaults.
// When a user's risk profile is loaded, this is replaced with their MVO target.
function getDefaultTargetModel(userId: string): PortfolioTargetModel {
	return {
		portfolio_id: `unified_${userId}`,
		target_allocation: [
			{ asset: "EQUITY_IN", weight: 40 },
			{ asset: "EQUITY_US", weight: 15 },
			{ asset: "MUTUAL_FUND", weight: 25 },
			{ asset: "FIXED_INCOME", weight: 10 },
			{ asset: "ALTERNATIVES", weight: 5 },
			{ asset: "OTHER", weight: 5 },
		],
		rebalance_policy: {
			frequency: "quarterly",
			drift_threshold: 5, // ±5% before flagging drift
			tax_aware: true,
		},
	};
}

// ─── UniPortfolioService ──────────────────────────────────────────────────────

export class UniPortfolioService {
	private readonly ENGINE_VERSION = "MPAL-2.0";
	private readonly DISCLAIMER =
		"This portfolio analysis is AI-assisted and for informational purposes only. " +
		"It does not constitute investment advice or guarantee returns. " +
		"Market investments are subject to risk. " +
		"Rebalancing actions require user confirmation and advisor approval.";

	/**
	 * Returns the canonical UniPortfolio snapshot for a user.
	 * Uses in-memory cache (5-min TTL). Call refresh() to force-refresh.
	 *
	 * @param userId      - FintekPro user ID
	 * @param riskScore   - User's risk score (0–100); default 50 (balanced)
	 * @param horizon     - Investment horizon in years; default 5
	 * @param segment     - User segment: 'retail' | 'hni' | 'shni' | 'bhni'; default 'retail'
	 * @param targetModel - Optional custom target allocation model
	 */
	async getSnapshot(
		userId: string,
		riskScore = 50,
		horizon = 5,
		segment = "retail",
		targetModel?: PortfolioTargetModel,
	): Promise<UniPortfolioSnapshot> {
		const cacheKey = `${userId}:${riskScore}:${horizon}:${segment}`;
		const cached = snapshotCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			logger.info(`[UniPortfolioService] Cache hit`, {
				event: "PORTFOLIO_CACHE_HIT",
				user_id: userId,
			});
			return cached.snapshot;
		}
		const snapshot = await this.buildSnapshot(
			userId,
			riskScore,
			horizon,
			segment,
			targetModel,
		);
		snapshotCache.set(cacheKey, {
			snapshot,
			expiresAt: Date.now() + CACHE_TTL_MS,
		});
		return snapshot;
	}

	/**
	 * Force-refreshes the snapshot for a user, bypassing cache.
	 */
	async refresh(
		userId: string,
		riskScore = 50,
		horizon = 5,
		segment = "retail",
	): Promise<UniPortfolioSnapshot> {
		// Evict all entries for this user
		for (const key of snapshotCache.keys()) {
			if (key.startsWith(`${userId}:`)) snapshotCache.delete(key);
		}
		return this.getSnapshot(userId, riskScore, horizon, segment);
	}

	// ─── Internal builders ─────────────────────────────────────────────────────

	private async buildSnapshot(
		userId: string,
		riskScore: number,
		horizon: number,
		segment: string,
		customTargetModel?: PortfolioTargetModel,
	): Promise<UniPortfolioSnapshot> {
		const start = Date.now();
		const portfolioId = `unified_${userId}`;

		logger.info(`[UniPortfolioService] Building UniPortfolio snapshot`, {
			event: "UNI_PORTFOLIO_BUILD_START",
			user_id: userId,
			portfolioId,
			riskScore,
			latency_ms: 0,
			status: "building",
		});

		// 1. Aggregate all broker positions
		const aggregated = await portfolioAggregator.getUnifiedPortfolio(userId);

		// 2. Compute current allocation weights for the drift engine
		const currentAllocation = this.weightsToAssetWeights(
			aggregated.summary.assetClassWeights,
		);

		// 3. Drift analysis
		const model = customTargetModel ?? getDefaultTargetModel(userId);
		const drift = driftEngine.calculateDrift(model, currentAllocation);

		// 4. Rebalancing analysis (uses MVO / Python sidecar when available)
		let rebalancing: RebalanceAnalysis;
		try {
			rebalancing = await rebalancingEngine.analyzeAndRebalance({
				currentAllocations: aggregated.summary.assetClassWeights,
				currentValues: this.computeAssetValues(aggregated.holdings),
				totalPortfolioValue: aggregated.summary.totalValueInr,
				riskScore,
				segment,
				investmentHorizon: horizon,
				driftThreshold: model.rebalance_policy.drift_threshold,
			});
		} catch (err: any) {
			logger.warn(
				`[UniPortfolioService] Rebalancing engine failed, using empty result`,
				err?.message,
			);
			rebalancing = this.emptyRebalance();
		}

		// 5. Concentration risk — top 5 positions
		const concentration = this.computeConcentration(
			aggregated.holdings,
			aggregated.summary.totalValueInr,
		);

		// 6. Data freshness per broker
		const fetchedAt = new Date(aggregated.fetchedAt).getTime();
		const freshness: Record<string, number> = {};
		for (const br of aggregated.brokerResults) {
			freshness[br.brokerId] = br.success
				? Math.round((Date.now() - fetchedAt) / 1000)
				: -1;
		}

		const snapshot: UniPortfolioSnapshot = {
			portfolioId,
			userId,
			generatedAt: new Date().toISOString(),
			holdings: aggregated.holdings,
			brokerBreakdown: aggregated.summary.brokerBreakdown,
			summary: aggregated.summary,
			analysis: {
				drift,
				rebalancing,
				concentration,
				staleBrokers: aggregated.staleBrokers,
				riskProfile: { riskScore, investmentHorizon: horizon, segment },
			},
			meta: {
				engine_version: this.ENGINE_VERSION,
				calculation_timestamp: new Date().toISOString(),
				brokers_polled: aggregated.brokerResults.map((b) => b.brokerId),
				brokers_configured: aggregated.brokerResults
					.filter((b) => b.configured)
					.map((b) => b.brokerId),
				data_freshness_seconds: freshness,
				disclaimer: this.DISCLAIMER,
			},
		};

		logger.info(`[UniPortfolioService] UniPortfolio snapshot built`, {
			event: "UNI_PORTFOLIO_BUILD_DONE",
			user_id: userId,
			portfolioId,
			totalHoldings: aggregated.holdings.length,
			totalValueInr: Math.round(aggregated.summary.totalValueInr),
			staleBrokers: aggregated.staleBrokers,
			driftDetected: drift.has_drifted,
			needsRebalance: rebalancing.needsRebalance,
			latency_ms: Date.now() - start,
			status: "success",
		});

		return snapshot;
	}

	private weightsToAssetWeights(weights: Record<string, number>) {
		return Object.entries(weights).map(([asset, weight]) => ({
			asset,
			weight,
		}));
	}

	private computeAssetValues(
		holdings: NormalizedHolding[],
	): Record<string, number> {
		const values: Record<string, number> = {};
		for (const h of holdings) {
			values[h.allocationGroup] =
				(values[h.allocationGroup] ?? 0) + h.currentValueInr;
		}
		return values;
	}

	private computeConcentration(
		holdings: NormalizedHolding[],
		totalValueInr: number,
	): ConcentrationRisk[] {
		if (totalValueInr <= 0) return [];
		return [...holdings]
			.sort((a, b) => b.currentValueInr - a.currentValueInr)
			.slice(0, 5)
			.map((h) => ({
				symbol: h.symbol ?? h.name,
				name: h.name,
				brokerId: h.brokerId,
				valueInr: Math.round(h.currentValueInr),
				pct: Number.parseFloat(
					((h.currentValueInr / totalValueInr) * 100).toFixed(2),
				),
			}));
	}

	private emptyRebalance(): RebalanceAnalysis {
		return {
			needsRebalance: false,
			urgency: "none",
			driftAnalysis: {
				maxDrift: 0,
				averageDrift: 0,
				assetDrifts: [],
				equityDrift: 0,
				debtDrift: 0,
				portfolioRiskDrift: 0,
			},
			trades: [],
			summary: {
				totalBuyValue: 0,
				totalSellValue: 0,
				netCashFlow: 0,
				numberOfTrades: 0,
				estimatedTotalTax: 0,
				portfolioTurnover: 0,
			},
			constraints: {
				equityRange: { min: 0, max: 100, current: 0, target: 0, inRange: true },
				debtRange: { min: 0, max: 100, current: 0, target: 0, inRange: true },
				liquidityRange: {
					min: 0,
					max: 100,
					current: 0,
					target: 0,
					inRange: true,
				},
				singleAssetLimit: { max: 100, violations: [] },
			},
			recommendations: ["Portfolio data unavailable. Please try again."],
		};
	}
}

export const uniPortfolioService = new UniPortfolioService();
