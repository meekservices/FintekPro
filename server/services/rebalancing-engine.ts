// GCR-compliant: strict typing enforced — @ts-nocheck removed per audit fix #2
import {
	assetAllocationOptimizer,
	ASSET_CLASSES,
	EQUITY_TYPES,
	DEBT_TYPES,
	ALTERNATIVE_TYPES,
	LIQUID_TYPES,
	OptimizationInput,
} from "./asset-allocation-optimizer";
import { callPython } from "../clients/python-client";
import {
	unifiedAIRecommendationEngine,
	type ProductData,
	type ClientProfile,
	type ProductCategory,
} from "./unified-ai-recommendation-engine";
import {
	getEnrichedStockSnapshot,
	getEnrichedStockSnapshots,
} from "./screener/enriched-stock-data";

export type RebalanceReason =
	| "DRIFT_THRESHOLD_EXCEEDED"
	| "RISK_PROFILE_CHANGED"
	| "GOAL_TIMELINE_CHANGED"
	| "MARKET_CONDITIONS_SHIFT"
	| "TAX_LOSS_HARVESTING"
	| "CASH_INFLOW"
	| "CASH_OUTFLOW"
	| "REBALANCE_SCHEDULE"
	| "CONSTRAINT_VIOLATION"
	| "CONCENTRATION_RISK";

export type TradeAction = "buy" | "sell" | "hold";

export interface RebalanceTrade {
	assetType: string;
	assetName: string;
	action: TradeAction;
	currentAllocation: number;
	targetAllocation: number;
	allocationDiff: number;
	currentValue: number;
	targetValue: number;
	tradeValue: number;
	priority: number;
	reasonCodes: RebalanceReason[];
	taxImpact: TaxImpact;
	rationale: string;
}

export interface TaxImpact {
	shortTermGains: number;
	longTermGains: number;
	taxableAmount: number;
	estimatedTax: number;
	taxEfficiency: "high" | "medium" | "low";
}

/** GCR FASP-AI: bump when rebalancing algorithm, drift thresholds, or urgency rules change */
export const REBALANCING_ENGINE_VERSION = "1.0.0-FASP";

export interface RebalanceAnalysis {
	needsRebalance: boolean;
	urgency: "immediate" | "recommended" | "optional" | "none";
	driftAnalysis: DriftAnalysis;
	trades: RebalanceTrade[];
	summary: RebalanceSummary;
	constraints: ConstraintAnalysis;
	recommendations: string[];
	/** GCR FASP-AI Financial Logic Integrity + Advisory traceability */
	engine_version: string;
	calculation_timestamp: string;
}

export interface DriftAnalysis {
	maxDrift: number;
	averageDrift: number;
	assetDrifts: {
		assetType: string;
		drift: number;
		direction: "over" | "under" | "neutral";
	}[];
	equityDrift: number;
	debtDrift: number;
	portfolioRiskDrift: number;
}

export interface RebalanceSummary {
	totalBuyValue: number;
	totalSellValue: number;
	netCashFlow: number;
	numberOfTrades: number;
	estimatedTotalTax: number;
	portfolioTurnover: number;
}

export interface ConstraintAnalysis {
	equityRange: {
		min: number;
		max: number;
		current: number;
		target: number;
		inRange: boolean;
	};
	debtRange: {
		min: number;
		max: number;
		current: number;
		target: number;
		inRange: boolean;
	};
	liquidityRange: {
		min: number;
		max: number;
		current: number;
		target: number;
		inRange: boolean;
	};
	singleAssetLimit: { max: number; violations: string[] };
}

export interface RebalanceInput {
	currentAllocations: { [assetType: string]: number };
	currentValues: { [assetType: string]: number };
	totalPortfolioValue: number;
	riskScore: number;
	segment: string;
	investmentHorizon: number;
	goalType?: string;
	driftThreshold?: number;
	taxBracket?: number;
	holdingPeriods?: { [assetType: string]: number };
	cashInflow?: number;
	cashOutflow?: number;
	rebalanceReason?: RebalanceReason;
	targetAllocations?: { [assetType: string]: number };
}

/**
 * Budget 2024 Tax Rates — Finance Act 2024, effective 23 July 2024
 *
 * Equity:
 *   STCG (held < 12m):  20% flat (s.111A, amended from 15%)
 *   LTCG (held ≥ 12m):  12.5% flat (s.112A, amended from 10%); ₹1.25L exemption p.a.
 *
 * Debt / Others:
 *   STCG (held < 36m):  Slab rate (income-tax bracket)
 *   LTCG (held ≥ 36m):  12.5% flat, no indexation (s.112, amended from 20% + indexation)
 *
 * Gold / REIT / InvIT:
 *   STCG (held < 24m):  Slab rate
 *   LTCG (held ≥ 24m):  12.5% flat, no indexation
 *
 * @see Finance (No.2) Act 2024, Clauses 2, 3 (effective AY 2025-26 onwards)
 */
const EQUITY_STCG_RATE = 0.20;          // 20% (was 15% pre-Jul 2024)
const EQUITY_LTCG_RATE = 0.125;         // 12.5% (was 10% pre-Jul 2024)
const EQUITY_LTCG_EXEMPTION = 125_000;  // ₹1.25L p.a. — applied at portfolio level
const DEBT_LTCG_RATE = 0.125;           // 12.5% no indexation (was 20% + indexation)
const GOLD_REIT_LTCG_RATE = 0.125;      // 12.5% for Gold ETF, REIT, InvIT

/** Slab rate table for debt STCG — keyed by approximate bracket */
const SLAB_RATE: { [bracket: string]: number } = {
	"10": 0.10,
	"20": 0.20,
	"30": 0.30,
	default: 0.30,
};

/** @deprecated pre-Budget-2024 constants — kept for safe fallback only */
const _LEGACY_SHORT_TERM_TAX_RATE = SLAB_RATE;
const _LEGACY_LONG_TERM_TAX_RATE = { equity: EQUITY_LTCG_RATE, debt: DEBT_LTCG_RATE, others: DEBT_LTCG_RATE };

class RebalancingEngine {
	private readonly DEFAULT_DRIFT_THRESHOLD = 5;
	private readonly URGENT_DRIFT_THRESHOLD = 10;
	private readonly CONCENTRATION_THRESHOLD = 30;

	async analyzeAndRebalance(input: RebalanceInput): Promise<RebalanceAnalysis> {
		const driftThreshold = input.driftThreshold ?? this.DEFAULT_DRIFT_THRESHOLD;

		let targetAllocations = input.targetAllocations;
		if (!targetAllocations) {
			// Python MVO primary path (scipy SLSQP — superior to TS gradient descent)
			let pyAllocations: Record<string, number> | null = null;
			try {
				const pyResult = await callPython<any>(
					"/api/quant/asset-allocation",
					"POST",
					{
						riskScore: input.riskScore ?? 50,
						segment: input.segment ?? "retail",
						investableAmount:
							input.totalPortfolioValue +
							(input.cashInflow ?? 0) -
							(input.cashOutflow ?? 0),
						investmentHorizon: input.investmentHorizon ?? 5,
						goalType: input.goalType ?? "balanced",
						liquidityNeeds: "medium",
						taxBracket: "medium",
					},
				);
				if (pyResult?.allocations?.length > 0) {
					pyAllocations = {};
					for (const alloc of pyResult.allocations) {
						pyAllocations[alloc.assetType] = alloc.allocation;
					}
				}
			} catch {
				// sidecar unavailable — fall through to TS optimizer
			}

			if (pyAllocations) {
				targetAllocations = pyAllocations;
			} else {
				const optimizationResult = await assetAllocationOptimizer.optimize({

					riskScore: input.riskScore,
					segment: input.segment as
						| "retail"
						| "hni"
						| "shni"
						| "bhni"
						| "corporate",
					investableAmount:
						input.totalPortfolioValue +
						(input.cashInflow ?? 0) -
						(input.cashOutflow ?? 0),
					investmentHorizon: input.investmentHorizon,
					goalType: input.goalType as
						| "growth"
						| "income"
						| "preservation"
						| "balanced"
						| undefined,
				});
				targetAllocations = {};
				for (const alloc of optimizationResult.allocations) {
					targetAllocations[alloc.assetType] = alloc.allocation;
				}
			}
		}

		const constraints = assetAllocationOptimizer.getConstraints(
			input.riskScore,
			input.segment,
		);
		const driftAnalysis = this.analyzeDrift(
			input.currentAllocations,
			targetAllocations,
			constraints,
		);
		const constraintAnalysis = this.analyzeConstraints(
			input.currentAllocations,
			targetAllocations,
			constraints,
		);
		const needsRebalance = this.determineRebalanceNeed(
			driftAnalysis,
			constraintAnalysis,
			driftThreshold,
		);
		const urgency = this.determineUrgency(driftAnalysis, constraintAnalysis);
		const trades = this.generateTrades(
			input,
			targetAllocations,
			driftAnalysis,
			constraints,
		);
		const summary = this.calculateSummary(trades, input.totalPortfolioValue);
		const recommendations = this.generateRecommendations(
			driftAnalysis,
			constraintAnalysis,
			trades,
			input,
		);

		// ── Alpha Upgrade Check ────────────────────────────────────────────────────
		// After drift fix, check if the instruments within each asset class
		// should be upgraded to better-alpha alternatives using the alpha engine.
		const alphaUpgradeRecs: string[] = [];
		try {
			const { selectTopFundsByAlphaScore } = await import("./model-portfolio-metrics-service");
			// Pull current holdings alpha scores from model_portfolio_holdings if available
			const { db } = await import("../db");
			const { modelPortfolioHoldings } = await import("@shared/schema");
			const { isNull } = await import("drizzle-orm");
			const activeHoldings = await db
				.select()
				.from(modelPortfolioHoldings)
				.where(isNull(modelPortfolioHoldings.removedAt));

			// Check each asset class present in current allocations
			const assetClassesSeen = new Set<string>();
			for (const [assetType, weight] of Object.entries(input.currentAllocations)) {
				if ((weight as number) < 1) continue;
				const ac = assetType.includes("equity") ? "equity"
					: assetType.includes("bond") || assetType.includes("debt") ? "debt"
					: assetType === "gold" ? "gold"
					: assetType.includes("international") ? "international" : null;
				if (!ac || assetClassesSeen.has(ac)) continue;
				assetClassesSeen.add(ac);

				const rp = input.riskScore >= 70 ? "aggressive" : input.riskScore >= 40 ? "moderate" : "conservative";
				const topFunds = await selectTopFundsByAlphaScore(ac, ac, rp, 1);
				if (!topFunds.length) continue;
				const best = topFunds[0];

				// Find the current holding for this asset class (if tracked in model_portfolio_holdings)
				const currentHolding = activeHoldings.find((h) => h.assetClass === ac);
				const currentScore = currentHolding ? Number(currentHolding.alphaScore ?? 0) : 0;
				const bestScore = best.alphaScore ?? 0;

				if (bestScore - currentScore >= 15) {
					alphaUpgradeRecs.push(
						`📈 Alpha Upgrade [${ac}]: ${best.instrumentName} scores ${bestScore.toFixed(1)} ` +
						`vs current ${currentScore.toFixed(1)} (+${(bestScore - currentScore).toFixed(1)} pts). ` +
						`1Y CAGR: ${best.returns1y?.toFixed(1)}%, ER: ${best.expenseRatio?.toFixed(2)}%. ` +
						`ISIN: ${best.isin}. Advisor approval required before switching.`,
					);
				}
			}
		} catch { /* non-fatal — alpha check is best-effort */ }

		const allRecommendations = [
			...recommendations,
			...alphaUpgradeRecs,
		];

		return {
			needsRebalance,
			urgency,
			driftAnalysis,
			trades,
			summary,
			constraints: constraintAnalysis,
			recommendations: allRecommendations,
			engine_version: REBALANCING_ENGINE_VERSION,
			calculation_timestamp: new Date().toISOString(),
		};
	}

	private analyzeDrift(
		current: { [type: string]: number },
		target: { [type: string]: number },
		constraints: {
			minEquity: number;
			maxEquity: number;
			minDebt: number;
			maxDebt: number;
		},
	): DriftAnalysis {
		const allTypes = Array.from(
			new Set([...Object.keys(current), ...Object.keys(target)]),
		);
		const assetDrifts: {
			assetType: string;
			drift: number;
			direction: "over" | "under" | "neutral";
		}[] = [];
		let totalDrift = 0;
		let maxDrift = 0;

		for (const type of allTypes) {
			const currentVal = current[type] ?? 0;
			const targetVal = target[type] ?? 0;
			const drift = currentVal - targetVal;

			assetDrifts.push({
				assetType: type,
				drift: Math.round(drift * 100) / 100,
				direction: drift > 0.5 ? "over" : drift < -0.5 ? "under" : "neutral",
			});

			totalDrift += Math.abs(drift);
			maxDrift = Math.max(maxDrift, Math.abs(drift));
		}

		const currentEquity = this.getGroupSum(current, EQUITY_TYPES);
		const targetEquity = this.getGroupSum(target, EQUITY_TYPES);
		const currentDebt = this.getGroupSum(current, DEBT_TYPES);
		const targetDebt = this.getGroupSum(target, DEBT_TYPES);

		const equityDrift = currentEquity - targetEquity;
		const debtDrift = currentDebt - targetDebt;

		const portfolioRiskDrift = this.calculatePortfolioRiskDrift(
			current,
			target,
		);

		return {
			maxDrift: Math.round(maxDrift * 100) / 100,
			averageDrift: Math.round((totalDrift / allTypes.length) * 100) / 100,
			assetDrifts: assetDrifts.filter((d) => Math.abs(d.drift) > 0.1),
			equityDrift: Math.round(equityDrift * 100) / 100,
			debtDrift: Math.round(debtDrift * 100) / 100,
			portfolioRiskDrift: Math.round(portfolioRiskDrift * 100) / 100,
		};
	}

	private calculatePortfolioRiskDrift(
		current: { [type: string]: number },
		target: { [type: string]: number },
	): number {
		let currentRisk = 0;
		let targetRisk = 0;

		for (const asset of ASSET_CLASSES) {
			const currentWeight = (current[asset.type] ?? 0) / 100;
			const targetWeight = (target[asset.type] ?? 0) / 100;
			currentRisk += currentWeight * asset.volatility;
			targetRisk += targetWeight * asset.volatility;
		}

		return currentRisk - targetRisk;
	}

	private analyzeConstraints(
		current: { [type: string]: number },
		target: { [type: string]: number },
		constraints: {
			minEquity: number;
			maxEquity: number;
			minDebt: number;
			maxDebt: number;
			minLiquidity: number;
			maxSingleAsset: number;
		},
	): ConstraintAnalysis {
		const currentEquity = this.getGroupSum(current, EQUITY_TYPES);
		const targetEquity = this.getGroupSum(target, EQUITY_TYPES);
		const currentDebt = this.getGroupSum(current, DEBT_TYPES);
		const targetDebt = this.getGroupSum(target, DEBT_TYPES);
		const currentLiquidity = this.getGroupSum(current, LIQUID_TYPES);
		const targetLiquidity = this.getGroupSum(target, LIQUID_TYPES);

		const violations: string[] = [];
		for (const [type, allocation] of Object.entries(current)) {
			if (allocation > constraints.maxSingleAsset) {
				violations.push(type);
			}
		}

		return {
			equityRange: {
				min: constraints.minEquity,
				max: constraints.maxEquity,
				current: Math.round(currentEquity * 100) / 100,
				target: Math.round(targetEquity * 100) / 100,
				inRange:
					currentEquity >= constraints.minEquity - 0.5 &&
					currentEquity <= constraints.maxEquity + 0.5,
			},
			debtRange: {
				min: constraints.minDebt,
				max: constraints.maxDebt,
				current: Math.round(currentDebt * 100) / 100,
				target: Math.round(targetDebt * 100) / 100,
				inRange:
					currentDebt >= constraints.minDebt - 0.5 &&
					currentDebt <= constraints.maxDebt + 0.5,
			},
			liquidityRange: {
				min: constraints.minLiquidity,
				max: 100,
				current: Math.round(currentLiquidity * 100) / 100,
				target: Math.round(targetLiquidity * 100) / 100,
				inRange: currentLiquidity >= constraints.minLiquidity - 0.5,
			},
			singleAssetLimit: {
				max: constraints.maxSingleAsset,
				violations,
			},
		};
	}

	private determineRebalanceNeed(
		drift: DriftAnalysis,
		constraints: ConstraintAnalysis,
		threshold: number,
	): boolean {
		if (drift.maxDrift >= threshold) return true;
		if (!constraints.equityRange.inRange) return true;
		if (!constraints.debtRange.inRange) return true;
		if (!constraints.liquidityRange.inRange) return true;
		if (constraints.singleAssetLimit.violations.length > 0) return true;
		if (Math.abs(drift.portfolioRiskDrift) > 2) return true;
		return false;
	}

	private determineUrgency(
		drift: DriftAnalysis,
		constraints: ConstraintAnalysis,
	): "immediate" | "recommended" | "optional" | "none" {
		if (!constraints.equityRange.inRange || !constraints.debtRange.inRange)
			return "immediate";
		if (constraints.singleAssetLimit.violations.length > 0) return "immediate";
		if (drift.maxDrift >= this.URGENT_DRIFT_THRESHOLD) return "immediate";
		if (drift.maxDrift >= this.DEFAULT_DRIFT_THRESHOLD) return "recommended";
		if (drift.maxDrift >= 2) return "optional";
		return "none";
	}

	private generateTrades(
		input: RebalanceInput,
		targetAllocations: { [type: string]: number },
		drift: DriftAnalysis,
		constraints: {
			minEquity: number;
			maxEquity: number;
			minDebt: number;
			maxDebt: number;
			minLiquidity: number;
			maxSingleAsset: number;
		},
	): RebalanceTrade[] {
		const trades: RebalanceTrade[] = [];
		const allTypes = Array.from(
			new Set([
				...Object.keys(input.currentAllocations),
				...Object.keys(targetAllocations),
			]),
		);
		const effectiveValue =
			input.totalPortfolioValue +
			(input.cashInflow ?? 0) -
			(input.cashOutflow ?? 0);

		for (const type of allTypes) {
			const currentAlloc = input.currentAllocations[type] ?? 0;
			const targetAlloc = targetAllocations[type] ?? 0;
			const diff = targetAlloc - currentAlloc;

			if (Math.abs(diff) < 0.5) continue;

			const currentValue =
				input.currentValues[type] ??
				(input.totalPortfolioValue * currentAlloc) / 100;
			const targetValue = (effectiveValue * targetAlloc) / 100;
			const tradeValue = Math.abs(targetValue - currentValue);

			const action: TradeAction = diff > 0 ? "buy" : diff < 0 ? "sell" : "hold";
			const reasonCodes = this.determineReasonCodes(
				type,
				currentAlloc,
				targetAlloc,
				drift,
				constraints,
				input,
			);
			const priority = this.calculateTradePriority(
				type,
				action,
				diff,
				reasonCodes,
				constraints,
			);
			const taxImpact =
				action === "sell"
					? this.calculateTaxImpact(
							type,
							tradeValue,
							input.holdingPeriods?.[type],
							input.taxBracket,
						)
					: {
							shortTermGains: 0,
							longTermGains: 0,
							taxableAmount: 0,
							estimatedTax: 0,
							taxEfficiency: "high" as const,
						};

			const assetInfo = ASSET_CLASSES.find((a) => a.type === type);

			trades.push({
				assetType: type,
				assetName: assetInfo?.name ?? type,
				action,
				currentAllocation: Math.round(currentAlloc * 100) / 100,
				targetAllocation: Math.round(targetAlloc * 100) / 100,
				allocationDiff: Math.round(diff * 100) / 100,
				currentValue: Math.round(currentValue),
				targetValue: Math.round(targetValue),
				tradeValue: Math.round(tradeValue),
				priority,
				reasonCodes,
				taxImpact,
				rationale: this.generateTradeRationale(type, action, diff, reasonCodes),
			});
		}

		return trades.sort((a, b) => b.priority - a.priority);
	}

	private determineReasonCodes(
		assetType: string,
		current: number,
		target: number,
		drift: DriftAnalysis,
		constraints: {
			minEquity: number;
			maxEquity: number;
			minDebt: number;
			maxDebt: number;
			maxSingleAsset: number;
		},
		input: RebalanceInput,
	): RebalanceReason[] {
		const reasons: RebalanceReason[] = [];

		if (
			Math.abs(current - target) >=
			(input.driftThreshold ?? this.DEFAULT_DRIFT_THRESHOLD)
		) {
			reasons.push("DRIFT_THRESHOLD_EXCEEDED");
		}

		if (input.rebalanceReason) {
			reasons.push(input.rebalanceReason);
		}

		if (current > constraints.maxSingleAsset) {
			reasons.push("CONCENTRATION_RISK");
		}

		if (EQUITY_TYPES.includes(assetType)) {
			const currentEquity = this.getGroupSum(
				input.currentAllocations,
				EQUITY_TYPES,
			);
			if (
				currentEquity < constraints.minEquity - 0.5 ||
				currentEquity > constraints.maxEquity + 0.5
			) {
				reasons.push("CONSTRAINT_VIOLATION");
			}
		}

		if (DEBT_TYPES.includes(assetType)) {
			const currentDebt = this.getGroupSum(
				input.currentAllocations,
				DEBT_TYPES,
			);
			if (
				currentDebt < constraints.minDebt - 0.5 ||
				currentDebt > constraints.maxDebt + 0.5
			) {
				reasons.push("CONSTRAINT_VIOLATION");
			}
		}

		if (input.cashInflow && input.cashInflow > 0) {
			reasons.push("CASH_INFLOW");
		}

		if (input.cashOutflow && input.cashOutflow > 0) {
			reasons.push("CASH_OUTFLOW");
		}

		if (reasons.length === 0) {
			reasons.push("REBALANCE_SCHEDULE");
		}

		return reasons;
	}

	private calculateTradePriority(
		assetType: string,
		action: TradeAction,
		diff: number,
		reasons: RebalanceReason[],
		constraints: { maxSingleAsset: number },
	): number {
		let priority = 0;

		priority += Math.abs(diff) * 2;

		if (reasons.includes("CONSTRAINT_VIOLATION")) priority += 30;
		if (reasons.includes("CONCENTRATION_RISK")) priority += 25;
		if (reasons.includes("DRIFT_THRESHOLD_EXCEEDED")) priority += 15;
		if (reasons.includes("TAX_LOSS_HARVESTING")) priority += 10;
		if (reasons.includes("CASH_INFLOW")) priority += 5;
		if (reasons.includes("CASH_OUTFLOW")) priority += 5;

		if (LIQUID_TYPES.includes(assetType) && action === "sell") {
			priority += 10;
		}

		if (ALTERNATIVE_TYPES.includes(assetType) && action === "buy") {
			priority -= 5;
		}

		return Math.round(priority);
	}

	/**
	 * Computes tax impact of a sell trade using Finance Act 2024 rates.
	 *
	 * @param assetType          - Asset class string (from EQUITY_TYPES, DEBT_TYPES, etc.)
	 * @param tradeValue         - Sell value in ₹
	 * @param holdingPeriodMonths - Months held; defaults to 6 (conservative — short-term)
	 * @param taxBracket         - Slab bracket (10/20/30); used for debt STCG only
	 * @returns TaxImpact        - Breakdown per Finance Act 2024
	 *
	 * @version Budget-2024 (effective 23 Jul 2024)
	 */
	private calculateTaxImpact(
		assetType: string,
		tradeValue: number,
		holdingPeriodMonths?: number,
		taxBracket?: number,
	): TaxImpact {
		// Assume 15% embedded gain on sells (conservative average for rebalance guidance)
		const assumedGainPercentage = 0.15;
		const taxableAmount = tradeValue * assumedGainPercentage;

		const isEquity = EQUITY_TYPES.includes(assetType);
		const isGoldOrReit = ["gold", "reit", "invit", "sgb"].includes(assetType.toLowerCase());
		const holdingPeriod = holdingPeriodMonths ?? 6; // default: short-term

		// Holding period thresholds (Finance Act 2024)
		// Equity: 12 months | Debt: 36 months | Gold/REIT: 24 months
		const longTermThreshold = isEquity ? 12 : isGoldOrReit ? 24 : 36;
		const isLongTerm = holdingPeriod >= longTermThreshold;

		let shortTermGains = 0;
		let longTermGains = 0;
		let estimatedTax = 0;

		if (isEquity) {
			if (isLongTerm) {
				// LTCG equity: 12.5% with ₹1.25L exemption (applied at portfolio level — we flag it)
				longTermGains = taxableAmount;
				// ₹1.25L exemption: for a single trade we show gross tax; adviser adjusts for portfolio
				estimatedTax = taxableAmount * EQUITY_LTCG_RATE;
			} else {
				// STCG equity: 20% flat (Finance Act 2024)
				shortTermGains = taxableAmount;
				estimatedTax = taxableAmount * EQUITY_STCG_RATE;
			}
		} else if (isGoldOrReit) {
			if (isLongTerm) {
				longTermGains = taxableAmount;
				estimatedTax = taxableAmount * GOLD_REIT_LTCG_RATE;
			} else {
				// STCG gold/REIT: slab rate
				shortTermGains = taxableAmount;
				const slabRate = SLAB_RATE[String(taxBracket)] ?? SLAB_RATE.default;
				estimatedTax = taxableAmount * slabRate;
			}
		} else {
			// Debt instruments
			if (isLongTerm) {
				// LTCG debt: 12.5% no indexation (Finance Act 2024)
				longTermGains = taxableAmount;
				estimatedTax = taxableAmount * DEBT_LTCG_RATE;
			} else {
				// STCG debt: slab rate
				shortTermGains = taxableAmount;
				const slabRate = SLAB_RATE[String(taxBracket)] ?? SLAB_RATE.default;
				estimatedTax = taxableAmount * slabRate;
			}
		}

		const taxEfficiency: "high" | "medium" | "low" =
			estimatedTax === 0
				? "high"
				: estimatedTax / tradeValue < 0.02
					? "high"
					: estimatedTax / tradeValue < 0.05
						? "medium"
						: "low";

		return {
			shortTermGains: Math.round(shortTermGains),
			longTermGains: Math.round(longTermGains),
			taxableAmount: Math.round(taxableAmount),
			estimatedTax: Math.round(estimatedTax),
			taxEfficiency,
		};
	}

	private generateTradeRationale(
		assetType: string,
		action: TradeAction,
		diff: number,
		reasons: RebalanceReason[],
	): string {
		const assetInfo = ASSET_CLASSES.find((a) => a.type === assetType);
		const assetName = assetInfo?.name ?? assetType;
		const absChange = Math.abs(diff).toFixed(1);

		const reasonDescriptions: { [key in RebalanceReason]: string } = {
			DRIFT_THRESHOLD_EXCEEDED:
				"allocation has drifted beyond acceptable threshold",
			RISK_PROFILE_CHANGED: "your risk profile has changed",
			GOAL_TIMELINE_CHANGED: "your investment timeline has changed",
			MARKET_CONDITIONS_SHIFT: "market conditions warrant adjustment",
			TAX_LOSS_HARVESTING: "opportunity for tax-loss harvesting",
			CASH_INFLOW: "new cash available for investment",
			CASH_OUTFLOW: "cash withdrawal required",
			REBALANCE_SCHEDULE: "scheduled periodic rebalancing",
			CONSTRAINT_VIOLATION: "portfolio constraints are violated",
			CONCENTRATION_RISK: "position exceeds concentration limits",
		};

		const primaryReason = reasons[0];
		const reasonText = reasonDescriptions[primaryReason];

		if (action === "buy") {
			return `Increase ${assetName} by ${absChange}% because ${reasonText}.`;
		}
		if (action === "sell") {
			return `Reduce ${assetName} by ${absChange}% because ${reasonText}.`;
		}
		return `Maintain ${assetName} position.`;
	}

	private calculateSummary(
		trades: RebalanceTrade[],
		totalValue: number,
	): RebalanceSummary {
		let totalBuyValue = 0;
		let totalSellValue = 0;
		let estimatedTotalTax = 0;

		for (const trade of trades) {
			if (trade.action === "buy") {
				totalBuyValue += trade.tradeValue;
			} else if (trade.action === "sell") {
				totalSellValue += trade.tradeValue;
				estimatedTotalTax += trade.taxImpact.estimatedTax;
			}
		}

		const numberOfTrades = trades.filter((t) => t.action !== "hold").length;
		const portfolioTurnover =
			((totalBuyValue + totalSellValue) / 2 / totalValue) * 100;

		return {
			totalBuyValue: Math.round(totalBuyValue),
			totalSellValue: Math.round(totalSellValue),
			netCashFlow: Math.round(totalSellValue - totalBuyValue),
			numberOfTrades,
			estimatedTotalTax: Math.round(estimatedTotalTax),
			portfolioTurnover: Math.round(portfolioTurnover * 100) / 100,
		};
	}

	private generateRecommendations(
		drift: DriftAnalysis,
		constraints: ConstraintAnalysis,
		trades: RebalanceTrade[],
		input: RebalanceInput,
	): string[] {
		const recommendations: string[] = [];

		if (!constraints.equityRange.inRange) {
			if (constraints.equityRange.current < constraints.equityRange.min) {
				recommendations.push(
					`Equity allocation (${constraints.equityRange.current}%) is below minimum (${constraints.equityRange.min}%). Consider increasing equity exposure to match your risk profile.`,
				);
			} else {
				recommendations.push(
					`Equity allocation (${constraints.equityRange.current}%) exceeds maximum (${constraints.equityRange.max}%). Consider reducing equity exposure to manage risk.`,
				);
			}
		}

		if (!constraints.debtRange.inRange) {
			if (constraints.debtRange.current < constraints.debtRange.min) {
				recommendations.push(
					`Debt allocation (${constraints.debtRange.current}%) is below minimum (${constraints.debtRange.min}%). Consider adding fixed income for stability.`,
				);
			} else {
				recommendations.push(
					`Debt allocation (${constraints.debtRange.current}%) exceeds maximum (${constraints.debtRange.max}%). Consider reducing fixed income to improve returns.`,
				);
			}
		}

		if (constraints.singleAssetLimit.violations.length > 0) {
			const violators = constraints.singleAssetLimit.violations.join(", ");
			recommendations.push(
				`Concentration risk detected in: ${violators}. Diversify to reduce single-asset exposure.`,
			);
		}

		if (drift.maxDrift > 10) {
			recommendations.push(
				`Significant portfolio drift detected (max ${drift.maxDrift}%). Immediate rebalancing recommended.`,
			);
		}

		const highTaxTrades = trades.filter(
			(t) => t.taxImpact.taxEfficiency === "low",
		);
		if (highTaxTrades.length > 0) {
			recommendations.push(
				`Some trades have high tax impact. Consider timing trades to minimize tax liability or using tax-advantaged accounts.`,
			);
		}

		if (input.cashInflow && input.cashInflow > 0) {
			recommendations.push(
				`Deploy new cash across underweight positions to minimize selling and associated taxes.`,
			);
		}

		if (recommendations.length === 0) {
			recommendations.push(
				`Portfolio is well-balanced. Continue periodic monitoring.`,
			);
		}

		return recommendations;
	}

	private getGroupSum(
		allocations: { [type: string]: number },
		types: string[],
	): number {
		return types.reduce((sum, type) => sum + (allocations[type] ?? 0), 0);
	}

	async simulateRebalance(
		input: RebalanceInput,
		executeTrades: boolean = false,
	): Promise<{
		beforeMetrics: PortfolioMetrics;
		afterMetrics: PortfolioMetrics;
		improvement: PortfolioMetrics;
	}> {
		const analysis = await this.analyzeAndRebalance(input);

		const beforeMetrics = this.calculatePortfolioMetrics(
			input.currentAllocations,
		);

		const afterAllocations: { [type: string]: number } = {
			...input.currentAllocations,
		};
		for (const trade of analysis.trades) {
			afterAllocations[trade.assetType] = trade.targetAllocation;
		}

		const afterMetrics = this.calculatePortfolioMetrics(afterAllocations);

		return {
			beforeMetrics,
			afterMetrics,
			improvement: {
				expectedReturn:
					afterMetrics.expectedReturn - beforeMetrics.expectedReturn,
				volatility: afterMetrics.volatility - beforeMetrics.volatility,
				sharpeRatio: afterMetrics.sharpeRatio - beforeMetrics.sharpeRatio,
			},
		};
	}

	private calculatePortfolioMetrics(allocations: {
		[type: string]: number;
	}): PortfolioMetrics {
		let expectedReturn = 0;
		let volatility = 0;

		for (const [type, weight] of Object.entries(allocations)) {
			const asset = ASSET_CLASSES.find((a) => a.type === type);
			if (asset) {
				expectedReturn += (weight / 100) * asset.expectedReturn;
				volatility += (weight / 100) * asset.volatility;
			}
		}

		const riskFreeRate = 5;
		const sharpeRatio =
			volatility > 0 ? (expectedReturn - riskFreeRate) / volatility : 0;

		return {
			expectedReturn: Math.round(expectedReturn * 100) / 100,
			volatility: Math.round(volatility * 100) / 100,
			sharpeRatio: Math.round(sharpeRatio * 100) / 100,
		};
	}
}

interface PortfolioMetrics {
	expectedReturn: number;
	volatility: number;
	sharpeRatio: number;
}

// ============================================================================
// AI-ENHANCED REBALANCING INTERFACE
// ============================================================================

export interface AIEnhancedRebalanceResult extends RebalanceAnalysis {
	aiEnhanced: boolean;
	aiRecommendations: {
		assetType: string;
		action: "buy" | "sell" | "hold";
		rationale: string;
		confidence: number;
		suggestedProducts?: {
			productId: string;
			productName: string;
			score: number;
			suitabilityScore: number;
		}[];
	}[];
	marketInsights: string[];
}

/**
 * AI-Enhanced Rebalancing Service
 * Wraps the rule-based rebalancing engine with AI-powered insights
 */
class AIEnhancedRebalancingService {
	/**
	 * Get AI-enhanced rebalancing recommendations
	 * Combines rule-based analysis with AI product recommendations
	 */
	async analyzeWithAI(
		input: RebalanceInput,
		clientProfile?: ClientProfile,
		availableProducts?: ProductData[],
	): Promise<AIEnhancedRebalanceResult> {
		// Start with rule-based analysis
		const baseAnalysis = await rebalancingEngine.analyzeAndRebalance(input);

		const aiRecommendations: AIEnhancedRebalanceResult["aiRecommendations"] =
			[];
		const marketInsights: string[] = [];

		// Get AI insights for each trade
		for (const trade of baseAnalysis.trades) {
			const aiRec: AIEnhancedRebalanceResult["aiRecommendations"][0] = {
				assetType: trade.assetType,
				action: trade.action,
				rationale: trade.rationale,
				confidence: 75,
				suggestedProducts: [],
			};

			// If products are available, find best matches for buy trades
			if (trade.action === "buy" && availableProducts && clientProfile) {
				const categoryMap: Record<string, ProductCategory> = {
					EQUITY_LARGECAP: "stocks",
					EQUITY_MIDCAP: "stocks",
					EQUITY_SMALLCAP: "stocks",
					EQUITY_FLEXI: "mutual_funds",
					DEBT_GOVT: "bonds",
					DEBT_CORP: "bonds",
					DEBT_SHORT: "bonds",
					DEBT_LIQUID: "mutual_funds",
					ALTERNATIVES_GOLD: "commodities",
					ALTERNATIVES_REITS: "reits",
					ALTERNATIVES_AIF: "aif",
					ALTERNATIVES_PMS: "pms",
				};

				const targetCategory = categoryMap[trade.assetType];
				if (targetCategory) {
					const categoryProducts = availableProducts.filter(
						(p) => p.category === targetCategory,
					);

					if (categoryProducts.length > 0) {
						try {
							const ranked = await unifiedAIRecommendationEngine.rankProducts(
								categoryProducts.slice(0, 10),
								clientProfile,
								{ prioritizeReturns: true, limit: 3 },
							);

							aiRec.suggestedProducts = ranked.map((r) => ({
								productId: r.product.id,
								productName: r.product.name,
								score: r.analysis.overallScore,
								suitabilityScore: r.analysis.suitabilityScore,
							}));

							// Update confidence based on AI analysis
							if (ranked.length > 0) {
								aiRec.confidence = Math.round(
									ranked.reduce(
										(sum, r) => sum + r.analysis.confidenceScore,
										0,
									) / ranked.length,
								);
								aiRec.rationale =
									ranked[0]?.analysis.selectionRationale || trade.rationale;
							}
						} catch (error) {
							console.error(
								`[AI Rebalancing] Failed to get AI recommendations for ${trade.assetType}:`,
								error,
							);
						}
					}
				}
			}

			aiRecommendations.push(aiRec);
		}

		// Generate market insights
		if (baseAnalysis.driftAnalysis.maxDrift > 10) {
			marketInsights.push(
				"Significant portfolio drift detected. Market conditions may have shifted substantially.",
			);
		}
		if (baseAnalysis.driftAnalysis.equityDrift > 5) {
			marketInsights.push(
				"Equity allocation has drifted. Consider market timing and valuations before rebalancing.",
			);
		}
		if (baseAnalysis.trades.some((t) => t.taxImpact.taxEfficiency === "low")) {
			marketInsights.push(
				"Some rebalancing trades have high tax implications. Consider tax-loss harvesting opportunities.",
			);
		}

		// Get AI engine status
		const aiStatus = unifiedAIRecommendationEngine.getStatus();

		return {
			...baseAnalysis,
			aiEnhanced: aiStatus.gemini || aiStatus.openai,
			aiRecommendations,
			marketInsights,
		};
	}

	/**
	 * Get product recommendations for a specific asset class
	 */
	async getProductsForAssetClass(
		assetType: string,
		tradeValue: number,
		clientProfile: ClientProfile,
		availableProducts: ProductData[],
	) {
		const categoryMap: Record<string, ProductCategory> = {
			EQUITY_LARGECAP: "stocks",
			EQUITY_MIDCAP: "stocks",
			EQUITY_SMALLCAP: "stocks",
			EQUITY_FLEXI: "mutual_funds",
			DEBT_GOVT: "bonds",
			DEBT_CORP: "bonds",
			DEBT_SHORT: "bonds",
			ALTERNATIVES_AIF: "aif",
			ALTERNATIVES_PMS: "pms",
			ALTERNATIVES_REITS: "reits",
			ALTERNATIVES_GOLD: "commodities",
		};

		const targetCategory = categoryMap[assetType];
		if (!targetCategory) {
			return {
				products: [],
				message: `No product mapping for asset type: ${assetType}`,
			};
		}

		const categoryProducts = availableProducts.filter(
			(p) => p.category === targetCategory,
		);

		if (categoryProducts.length === 0) {
			return {
				products: [],
				message: `No products available for category: ${targetCategory}`,
			};
		}

		const recommendations =
			await unifiedAIRecommendationEngine.generateRecommendation(
				clientProfile,
				categoryProducts,
				{ maxRecommendations: 5, categories: [targetCategory] },
			);

		return {
			products: recommendations.recommendations,
			summary: recommendations.summary,
			trackingId: recommendations.trackingId,
		};
	}
}

export async function getEnrichedRebalanceReasons(
	symbol: string,
): Promise<string[]> {
	const reasons: string[] = [];

	try {
		const snapshot = await getEnrichedStockSnapshot(symbol);
		if (!snapshot) return reasons;

		if (
			snapshot.dcf?.upsidePercent != null &&
			snapshot.dcf.upsidePercent < -20
		) {
			reasons.push(
				`Overvalued - DCF shows ${Math.abs(snapshot.dcf.upsidePercent).toFixed(1)}% downside`,
			);
		}

		if (snapshot.fundamentals?.roic != null && snapshot.fundamentals.roic < 5) {
			reasons.push(
				`Low capital efficiency - ROIC at ${snapshot.fundamentals.roic.toFixed(1)}%`,
			);
		}

		if (snapshot.technicals?.rsi != null && snapshot.technicals.rsi > 70) {
			reasons.push(
				`Technically overbought - RSI at ${snapshot.technicals.rsi.toFixed(1)}`,
			);
		}

		if (snapshot.analystGrades?.latestGrades?.length) {
			const downgrade = snapshot.analystGrades.latestGrades.find(
				(g) =>
					g.action?.toLowerCase() === "downgrade" ||
					g.action?.toLowerCase() === "down",
			);
			if (downgrade) {
				reasons.push(
					`Recent analyst downgrade from ${downgrade.previousGrade || "N/A"} to ${downgrade.newGrade || "N/A"}`,
				);
			}
		}

		if (snapshot.growth?.epsGrowth != null && snapshot.growth.epsGrowth < 0) {
			reasons.push(
				`Declining earnings - EPS growth at ${(snapshot.growth.epsGrowth * 100).toFixed(1)}%`,
			);
		}
	} catch (error: any) {
		console.error(
			`[RebalancingEngine] Error fetching enriched rebalance reasons for ${symbol}:`,
			error.message,
		);
	}

	return reasons;
}

export const aiEnhancedRebalancingService = new AIEnhancedRebalancingService();
export const rebalancingEngine = new RebalancingEngine();
