/**
 * PortfolioAggregator — Multi-Broker Portfolio Aggregation
 *
 * Purpose : Fetches positions from ALL configured brokers via the MPAL
 *           ProviderRegistry, normalises them to a common shape, converts
 *           all values to INR, and returns a unified holding list.
 *
 * Design:
 *   - Calls all configured brokers in parallel (Promise.allSettled — never crashes on one failure)
 *   - Resolves USD→INR using ValuationEngine
 *   - Groups holdings by country (IN / US / OTHER) and asset class for AI context
 *   - "Adding a new broker" = zero changes here — adapters self-declare capabilities
 *
 * Edge cases:
 *   - Broker throws / times out → included in `staleBrokers`, partial results returned
 *   - No brokers configured → empty holdings, zeroed summary
 *   - USD positions → converted to INR for totals, raw USD preserved
 */

import { logger } from "../../logger";
import { providerRegistry } from "../mpal/core/providerRegistry";
import {
	NormalizedPosition,
	BrokerCapability,
} from "../mpal/interfaces/IBroker";
import { valuationEngine } from "./valuationEngine";

// ─── Output types ─────────────────────────────────────────────────────────────

export interface NormalizedHolding extends NormalizedPosition {
	/** ISO 3166-1 alpha-2 country where the asset is domiciled */
	country: "IN" | "US" | "OTHER";
	/** Value in INR (all positions normalised) */
	currentValueInr: number;
	/** Original cost in INR (if available from broker) */
	costInr?: number;
	unrealizedPnlInr?: number;
	unrealizedPnlPct?: number;
	/** Asset class group for allocation charts */
	allocationGroup: string;
	/** FintekPro broker that supplied this holding */
	brokerId: string;
}

export interface BrokerFetchResult {
	brokerId: string;
	configured: boolean;
	success: boolean;
	positions: NormalizedPosition[];
	latencyMs: number;
	errorMessage?: string;
}

export interface UnifiedPortfolioResult {
	holdings: NormalizedHolding[];
	brokerResults: BrokerFetchResult[];
	staleBrokers: string[];
	summary: {
		totalValueInr: number;
		totalCostInr: number;
		unrealizedPnlInr: number;
		unrealizedPnlPct: number;
		totalValueUsd: number;
		fxRateUsdInr: number;
		/** Weight of each assetClass in the portfolio (sums to ~100) */
		assetClassWeights: Record<string, number>;
		/** Country allocation weights */
		countryWeights: { IN: number; US: number; OTHER: number };
		/** Per-broker value totals */
		brokerBreakdown: {
			brokerId: string;
			count: number;
			valueInr: number;
			configured: boolean;
		}[];
	};
	fetchedAt: string;
}

// ─── Asset class → allocation group mapping ───────────────────────────────────
/**
 * Maps each BrokerCapability to a rebalancer-friendly allocation group.
 * New instrument types must be added here + in COUNTRY_MAP to avoid
 * falling through to "OTHER" (which makes them invisible to the rebalancer).
 */
const CAPABILITY_TO_GROUP: Record<BrokerCapability, string> = {
	EQUITY_IN:      "EQUITY_IN",
	EQUITY_US:      "EQUITY_US",
	FNO:            "DERIVATIVES",
	MF:             "MUTUAL_FUND",
	NFO:            "MUTUAL_FUND",
	FD:             "FIXED_INCOME",
	BOND:           "FIXED_INCOME",
	PMS:            "ALTERNATIVES",
	AIF:            "ALTERNATIVES",
	CRYPTO:         "CRYPTO",
	// ── New instrument types (Fix 1) ──────────────────────────────────────────
	SGB:            "gold",          // Sovereign Gold Bond → gold allocation bucket
	REIT:           "real_estate",   // REIT → real estate allocation bucket
	INVIT:          "real_estate",   // InvIT → real estate allocation bucket
	GOLD_ETF:       "gold",          // Gold ETF → gold allocation bucket
	COMMODITY:      "commodity",     // MCX commodity → commodity bucket
	NPS:            "pension",       // NPS Tier I/II → pension bucket
	NOTIONAL_ORDER: "OTHER",
};

const COUNTRY_MAP: Record<string, "IN" | "US" | "OTHER"> = {
	EQUITY_IN:      "IN",
	FNO:            "IN",
	MF:             "IN",
	NFO:            "IN",
	FD:             "IN",
	BOND:           "IN",
	PMS:            "IN",
	AIF:            "IN",
	// New instrument types (Fix 1) — all India-domiciled
	SGB:            "IN",
	REIT:           "IN",
	INVIT:          "IN",
	GOLD_ETF:       "IN",
	COMMODITY:      "IN",
	NPS:            "IN",
	EQUITY_US:      "US",
	CRYPTO:         "OTHER",
	NOTIONAL_ORDER: "OTHER",
};

// ─── PortfolioAggregator ──────────────────────────────────────────────────────

export class PortfolioAggregator {
	/**
	 * Fetches positions from ALL configured brokers in parallel.
	 *
	 * Inputs  : userId — FintekPro user ID (each adapter resolves its own account ID)
	 *           preferCapabilities — if set, only poll brokers with those capabilities
	 * Outputs : UnifiedPortfolioResult with full holding list + summary
	 * Edge cases: partial broker failures → staleBrokers list, no crash
	 */
	async getUnifiedPortfolio(
		userId: string,
		_legacyPan?: string, // kept for backward compat, ignored
		_legacyAlpacaId?: string,
		preferCapabilities?: BrokerCapability[],
	): Promise<UnifiedPortfolioResult> {
		const startAt = Date.now();
		logger.info(
			`[PortfolioAggregator] Building multi-broker unified portfolio`,
			{
				event: "PORTFOLIO_AGGREGATE_START",
				user_id: userId,
			},
		);

		// 1. Collect brokers to poll
		const allBrokers = providerRegistry
			.getAllBrokers()
			.filter((b) => b.isConfigured());
		const brokersToQuery = preferCapabilities
			? allBrokers.filter((b) =>
					preferCapabilities.some((cap) => b.capabilities.includes(cap)),
				)
			: allBrokers;

		if (brokersToQuery.length === 0) {
			logger.warn(
				`[PortfolioAggregator] No brokers configured — returning empty portfolio`,
			);
			return this.emptyResult();
		}

		// 2. Fetch all brokers in parallel (allSettled = never crashes)
		const fetchResults = await Promise.allSettled(
			brokersToQuery.map((broker) =>
				this.fetchFromBroker(broker.brokerId, userId),
			),
		);

		const brokerResults: BrokerFetchResult[] = fetchResults.map((r, i) => {
			if (r.status === "fulfilled") return r.value;
			return {
				brokerId: brokersToQuery[i].brokerId,
				configured: true,
				success: false,
				positions: [],
				latencyMs: 0,
				errorMessage: (r.reason as any)?.message ?? "Unknown error",
			};
		});

		const staleBrokers = brokerResults
			.filter((r) => !r.success)
			.map((r) => r.brokerId);

		// 3. Get FX rate once for all USD conversions
		const fxRateUsdInr = await valuationEngine
			.getExchangeRate("USD", "INR")
			.catch(() => 84); // fallback

		// 4. Normalize + enrich all positions
		const holdings: NormalizedHolding[] = [];
		for (const result of brokerResults) {
			for (const pos of result.positions) {
				const valueInr =
					pos.currency === "USD"
						? (pos.currentPrice ?? 0) * pos.quantity * fxRateUsdInr
						: pos.currentPrice
							? pos.currentPrice * pos.quantity
							: (pos as any).currentValue ?? 0;

				const costInr = pos.averageCost
					? pos.currency === "USD"
						? pos.averageCost * pos.quantity * fxRateUsdInr
						: pos.averageCost * pos.quantity
					: undefined;

				const unrealizedPnlInr =
					costInr !== undefined && valueInr ? valueInr - costInr : undefined;
				const unrealizedPnlPct =
					costInr && costInr > 0 && unrealizedPnlInr !== undefined
						? (unrealizedPnlInr / costInr) * 100
						: undefined;

				const group = CAPABILITY_TO_GROUP[pos.assetClass] ?? "OTHER";
				const country = COUNTRY_MAP[pos.assetClass] ?? "OTHER";

				holdings.push({
					...pos,
					brokerId: result.brokerId,
					currentValueInr: valueInr,
					costInr,
					unrealizedPnlInr,
					unrealizedPnlPct,
					allocationGroup: group,
					country,
				});
			}
		}

		// 5. Compute summary
		const totalValueInr = holdings.reduce((s, h) => s + h.currentValueInr, 0);
		const totalCostInr = holdings.reduce((s, h) => s + (h.costInr ?? 0), 0);
		const totalValueUsd = holdings
			.filter((h) => h.currency === "USD")
			.reduce((s, h) => s + (h.currentPrice ?? 0) * h.quantity, 0);
		const unrealizedPnlInr = totalValueInr - totalCostInr;
		const unrealizedPnlPct =
			totalCostInr > 0 ? (unrealizedPnlInr / totalCostInr) * 100 : 0;

		// Asset class weights
		const assetClassWeights: Record<string, number> = {};
		for (const h of holdings) {
			assetClassWeights[h.allocationGroup] =
				(assetClassWeights[h.allocationGroup] ?? 0) + h.currentValueInr;
		}
		if (totalValueInr > 0) {
			for (const k of Object.keys(assetClassWeights)) {
				assetClassWeights[k] = Number.parseFloat(
					((assetClassWeights[k] / totalValueInr) * 100).toFixed(2),
				);
			}
		}

		// Country weights
		const countryTotals = { IN: 0, US: 0, OTHER: 0 };
		for (const h of holdings) countryTotals[h.country] += h.currentValueInr;
		const countryWeights = {
			IN:
				totalValueInr > 0
					? Number.parseFloat(
							((countryTotals.IN / totalValueInr) * 100).toFixed(2),
						)
					: 0,
			US:
				totalValueInr > 0
					? Number.parseFloat(
							((countryTotals.US / totalValueInr) * 100).toFixed(2),
						)
					: 0,
			OTHER:
				totalValueInr > 0
					? Number.parseFloat(
							((countryTotals.OTHER / totalValueInr) * 100).toFixed(2),
						)
					: 0,
		};

		// Per-broker breakdown
		const brokerBreakdown = brokersToQuery.map((b) => {
			const bHoldings = holdings.filter((h) => h.brokerId === b.brokerId);
			return {
				brokerId: b.brokerId,
				count: bHoldings.length,
				valueInr: bHoldings.reduce((s, h) => s + h.currentValueInr, 0),
				configured: b.isConfigured(),
			};
		});

		logger.info(`[PortfolioAggregator] Unified portfolio built`, {
			event: "PORTFOLIO_AGGREGATE_DONE",
			user_id: userId,
			totalHoldings: holdings.length,
			totalValueInr: Math.round(totalValueInr),
			staleBrokers,
			latency_ms: Date.now() - startAt,
			status: staleBrokers.length > 0 ? "partial" : "success",
		});

		return {
			holdings,
			brokerResults,
			staleBrokers,
			summary: {
				totalValueInr,
				totalCostInr,
				unrealizedPnlInr,
				unrealizedPnlPct: Number.parseFloat(unrealizedPnlPct.toFixed(2)),
				totalValueUsd,
				fxRateUsdInr,
				assetClassWeights,
				countryWeights,
				brokerBreakdown,
			},
			fetchedAt: new Date().toISOString(),
		};
	}

	// ─── Helpers ────────────────────────────────────────────────────────────────

	private async fetchFromBroker(
		brokerId: string,
		userId: string,
	): Promise<BrokerFetchResult> {
		const start = Date.now();
		try {
			const broker = providerRegistry.getBroker(brokerId);
			const positions = await broker.getPositions(userId);
			return {
				brokerId,
				configured: true,
				success: true,
				positions,
				latencyMs: Date.now() - start,
			};
		} catch (err: any) {
			logger.warn(`[PortfolioAggregator] Broker ${brokerId} fetch failed`, {
				event: "BROKER_FETCH_FAILED",
				brokerId,
				user_id: userId,
				error_code: err?.error_code ?? "UNKNOWN",
				message: err?.message,
				retryable: err?.retryable ?? false,
				latency_ms: Date.now() - start,
				status: "error",
			});
			return {
				brokerId,
				configured: true,
				success: false,
				positions: [],
				latencyMs: Date.now() - start,
				errorMessage: err?.message,
			};
		}
	}

	private emptyResult(): UnifiedPortfolioResult {
		return {
			holdings: [],
			brokerResults: [],
			staleBrokers: [],
			summary: {
				totalValueInr: 0,
				totalCostInr: 0,
				unrealizedPnlInr: 0,
				unrealizedPnlPct: 0,
				totalValueUsd: 0,
				fxRateUsdInr: 84,
				assetClassWeights: {},
				countryWeights: { IN: 0, US: 0, OTHER: 0 },
				brokerBreakdown: [],
			},
			fetchedAt: new Date().toISOString(),
		};
	}
}

export const portfolioAggregator = new PortfolioAggregator();
