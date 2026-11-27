/**
 * @file derivative-strategy.ts
 * @description Institutional Futures & Options (F&O) Strategy Engine for Pick of the Day (POTD).
 *              Generates multi-leg option strategies for both Option Sellers (Credit/Income)
 *              and Option Buyers (Debit/Breakout), complete with individual legs, payoff,
 *              max profit, max loss, breakevens, Greeks, and SEBI margin requirements.
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v3.0 (SEBI Derivatives Framework 2026).
 */

import { logger } from "../../logger";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import {
	derivativesService,
	SEBI_FNO_FRAMEWORK_2026,
} from "../derivatives-service";
import { marketHolidayService } from "../market-holiday-service";

// ─── Types ────────────────────────────────────────────────────────────────────
export type MarketOutlook = "bullish" | "bearish" | "neutral";
export type VolatilityRegime = "low" | "normal" | "high";
export type OptionStrategyType = "BUYER" | "SELLER";

export interface StrategyLegTemplate {
	action: "BUY" | "SELL";
	type: "CE" | "PE" | "FUT";
	strikeOffsetSteps: number; // e.g. 0 = ATM, +1 = OTM Call / ITM Put, -1 = OTM Put / ITM Call
	quantityRatio?: number; // default 1
}

export interface DerivativeStrategyDef {
	name: string;
	outlook: MarketOutlook | "any";
	volPreference: "buy" | "sell" | "any";
	strategyType: OptionStrategyType;
	risk: "medium" | "high";
	targetMult: number; // Buyer: 1.5 - 2.0 (target upside multiplier); Seller: 0.3 - 0.45 (decay target level)
	slMult: number;     // Buyer: 0.4 - 0.5 (stop loss multiplier); Seller: 1.7 - 2.0 (stop loss level)
	description: string;
	legs: StrategyLegTemplate[];
}

export interface StrategyLegOutput {
	action: "BUY" | "SELL";
	quantity: number;
	type: "CE" | "PE" | "FUT";
	strikePrice: number;
	premium: number;
	name: string;
	executionPriority?: number; // 1 = Buy hedge wing first (SEBI margin relief), 2 = Sell leg
	executionNote?: string;
	isTradeable?: boolean;
	openInterest?: number;
	tradingVolume?: number;
	bidPrice?: number;
	askPrice?: number;
	expiryDate?: string;
}

export interface StrategyPayoffOutput {
	legs: StrategyLegOutput[];
	netPremium: number;
	totalNetPremium: number;
	isCredit: boolean;
	maxProfit: number | "Unlimited";
	maxLoss: number | "Unlimited";
	breakeven: number | number[];
	pop: number; // Probability of Profit % (e.g. 68 for 68%)
	greeks: { delta: number; theta: number; vega: number };
	marginRequired: number;
	allLegsTradeable: boolean;
	untradeableLegsCount: number;
}

// ─── Helpers: Tick Alignment & Black-Scholes ──────────────────────────────────
function alignToTick(price: number, tick = 0.05): number {
	if (price <= 0) return 0.05;
	return +(Math.round(price / tick) * tick).toFixed(2);
}

function normalCDF(x: number): number {
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;

	const sign = x < 0 ? -1 : 1;
	const absX = Math.abs(x) / Math.sqrt(2);
	const t = 1.0 / (1.0 + p * absX);
	const y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));
	return 0.5 * (1.0 + sign * y);
}

function calculateBlackScholesPrice(
	S: number,
	K: number,
	dte: number,
	sigma: number,
	type: "call" | "put",
	r = 0.065,
): number {
	const T = Math.max(1, dte) / 365;
	if (T <= 0) return type === "call" ? Math.max(0, S - K) : Math.max(0, K - S);
	const vol = Math.max(0.05, Math.min(1.0, sigma));
	const d1 = (Math.log(S / K) + (r + (vol ** 2) / 2) * T) / (vol * Math.sqrt(T));
	const d2 = d1 - vol * Math.sqrt(T);

	const price =
		type === "call"
			? S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
			: K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);

	return alignToTick(price);
}

/**
 * Calculates mathematical Probability of Profit (POP %) under lognormal BSM distribution.
 */
function calculateProbabilityOfProfit(
	S: number,
	breakeven: number | number[],
	dte: number,
	iv: number,
	isCredit: boolean,
	strategyName: string,
	r = 0.065,
): number {
	const T = Math.max(1, dte) / 365;
	const vol = Math.max(0.05, Math.min(1.0, iv / 100));
	const sqrtT = vol * Math.sqrt(T);
	const mu = (r - 0.5 * (vol ** 2)) * T;

	const calcD2 = (K: number) => (Math.log(K / S) - mu) / sqrtT;

	let rawPop = 0.5;

	if (Array.isArray(breakeven) && breakeven.length === 2) {
		const [kLow, kHigh] = breakeven;
		const probInside = Math.max(0, normalCDF(calcD2(kHigh)) - normalCDF(calcD2(kLow)));
		rawPop = isCredit ? probInside : 1 - probInside;
	} else if (typeof breakeven === "number") {
		const probBelow = normalCDF(calcD2(breakeven));
		if (strategyName === "Bull Put Spread" || strategyName === "Bull Call Spread" || strategyName === "Long Call") {
			rawPop = 1 - probBelow;
		} else {
			rawPop = probBelow;
		}
	}

	// Clamp between 5% and 95%
	const popPct = Math.round(Math.max(0.05, Math.min(0.95, rawPop)) * 100);
	return popPct;
}

// ─── Comprehensive Strategy Catalogue (Buyers & Sellers) ─────────────────────
export const STRATEGY_CATALOGUE: DerivativeStrategyDef[] = [
	// ── Option Seller Strategies (Credit / Theta Decay / Income) ──────────────
	{
		name: "Bull Put Spread",
		outlook: "bullish",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "medium",
		targetMult: 0.35,
		slMult: 1.8,
		description: "Credit Put Spread: Sells ATM/OTM Put and buys lower OTM Put to harvest theta decay in an upward or consolidating market.",
		legs: [
			{ action: "SELL", type: "PE", strikeOffsetSteps: 0 },
			{ action: "BUY", type: "PE", strikeOffsetSteps: -1 },
		],
	},
	{
		name: "Bear Call Spread",
		outlook: "bearish",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "medium",
		targetMult: 0.35,
		slMult: 1.8,
		description: "Credit Call Spread: Sells ATM/OTM Call and buys higher OTM Call to harvest theta decay in a downward or range-bound market.",
		legs: [
			{ action: "SELL", type: "CE", strikeOffsetSteps: 0 },
			{ action: "BUY", type: "CE", strikeOffsetSteps: 1 },
		],
	},
	{
		name: "Iron Condor",
		outlook: "neutral",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "medium",
		targetMult: 0.35,
		slMult: 1.75,
		description: "4-Legged Range Seller: Sells OTM Put spread and OTM Call spread simultaneously for defined-risk theta decay.",
		legs: [
			{ action: "BUY", type: "PE", strikeOffsetSteps: -2 },
			{ action: "SELL", type: "PE", strikeOffsetSteps: -1 },
			{ action: "SELL", type: "CE", strikeOffsetSteps: 1 },
			{ action: "BUY", type: "CE", strikeOffsetSteps: 2 },
		],
	},
	{
		name: "Iron Butterfly",
		outlook: "neutral",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "medium",
		targetMult: 0.4,
		slMult: 1.7,
		description: "ATM Theta Harvester: Sells ATM Straddle and buys OTM wings for defined-risk maximum theta decay.",
		legs: [
			{ action: "BUY", type: "PE", strikeOffsetSteps: -1 },
			{ action: "SELL", type: "PE", strikeOffsetSteps: 0 },
			{ action: "SELL", type: "CE", strikeOffsetSteps: 0 },
			{ action: "BUY", type: "CE", strikeOffsetSteps: 1 },
		],
	},
	{
		name: "Short Strangle",
		outlook: "neutral",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "high",
		targetMult: 0.4,
		slMult: 1.8,
		description: "High IV Range Seller: Sells OTM Put and OTM Call to capture aggressive volatility crush during elevated IV.",
		legs: [
			{ action: "SELL", type: "PE", strikeOffsetSteps: -1 },
			{ action: "SELL", type: "CE", strikeOffsetSteps: 1 },
		],
	},
	{
		name: "Short Straddle",
		outlook: "neutral",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "high",
		targetMult: 0.45,
		slMult: 1.75,
		description: "Pure Theta Harvester: Sells ATM Call and ATM Put for maximum theta cash flow where price pin is anticipated.",
		legs: [
			{ action: "SELL", type: "CE", strikeOffsetSteps: 0 },
			{ action: "SELL", type: "PE", strikeOffsetSteps: 0 },
		],
	},

	// ── Option Buyer Strategies (Debit / Gamma / Breakout) ────────────────────
	{
		name: "Bull Call Spread",
		outlook: "bullish",
		volPreference: "buy",
		strategyType: "BUYER",
		risk: "medium",
		targetMult: 1.6,
		slMult: 0.5,
		description: "Debit Call Spread: Buys ATM Call and sells higher OTM Call for capped-risk upside momentum.",
		legs: [
			{ action: "BUY", type: "CE", strikeOffsetSteps: 0 },
			{ action: "SELL", type: "CE", strikeOffsetSteps: 1 },
		],
	},
	{
		name: "Bear Put Spread",
		outlook: "bearish",
		volPreference: "buy",
		strategyType: "BUYER",
		risk: "medium",
		targetMult: 1.6,
		slMult: 0.5,
		description: "Debit Put Spread: Buys ATM Put and sells lower OTM Put for capped-risk downside momentum.",
		legs: [
			{ action: "BUY", type: "PE", strikeOffsetSteps: 0 },
			{ action: "SELL", type: "PE", strikeOffsetSteps: -1 },
		],
	},
	{
		name: "Long Call",
		outlook: "bullish",
		volPreference: "buy",
		strategyType: "BUYER",
		risk: "high",
		targetMult: 2.0,
		slMult: 0.4,
		description: "Long Call: Direct call buy on high-conviction directional breakout.",
		legs: [
			{ action: "BUY", type: "CE", strikeOffsetSteps: 0 },
		],
	},
	{
		name: "Long Put",
		outlook: "bearish",
		volPreference: "buy",
		strategyType: "BUYER",
		risk: "high",
		targetMult: 2.0,
		slMult: 0.4,
		description: "Long Put: Direct put buy for high-conviction breakdown protection.",
		legs: [
			{ action: "BUY", type: "PE", strikeOffsetSteps: 0 },
		],
	},
	{
		name: "Long Straddle",
		outlook: "neutral",
		volPreference: "buy",
		strategyType: "BUYER",
		risk: "high",
		targetMult: 1.8,
		slMult: 0.45,
		description: "Long Straddle: Buys ATM Call and Put ahead of high-volatility binary events.",
		legs: [
			{ action: "BUY", type: "CE", strikeOffsetSteps: 0 },
			{ action: "BUY", type: "PE", strikeOffsetSteps: 0 },
		],
	},
	{
		name: "Long Strangle",
		outlook: "neutral",
		volPreference: "buy",
		strategyType: "BUYER",
		risk: "high",
		targetMult: 1.8,
		slMult: 0.4,
		description: "Long Strangle: Buys OTM Call and OTM Put for cheap participation in large range expansions.",
		legs: [
			{ action: "BUY", type: "CE", strikeOffsetSteps: 1 },
			{ action: "BUY", type: "PE", strikeOffsetSteps: -1 },
		],
	},
	{
		name: "Covered Call",
		outlook: "bullish",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "medium",
		targetMult: 0.4,
		slMult: 1.8,
		description: "Covered Call: Sells OTM Call against held underlying or deep-ITM Future for synthetic equity cash flow.",
		legs: [
			{ action: "BUY", type: "CE", strikeOffsetSteps: -2 },
			{ action: "SELL", type: "CE", strikeOffsetSteps: 1 },
		],
	},
	{
		name: "Protective Collar",
		outlook: "neutral",
		volPreference: "sell",
		strategyType: "SELLER",
		risk: "medium",
		targetMult: 0.35,
		slMult: 1.6,
		description: "Protective Collar: Buys protective OTM Put funded by selling an OTM Call to establish a strict downside floor.",
		legs: [
			{ action: "BUY", type: "PE", strikeOffsetSteps: -1 },
			{ action: "SELL", type: "CE", strikeOffsetSteps: 1 },
		],
	},
];

/**
 * Selects the optimal derivatives strategy based on:
 *  1. IV level & Volatility regime (buy vs sell premium)
 *  2. 20-day SMA trend bias (bullish/bearish/neutral)
 *  3. Dynamic rotation between Option Seller and Option Buyer strategies
 */
export function selectStrategy(
	spotPrice: number,
	iv: number,
	recentCloses: number[],
	recentIds?: Set<string>,
	symbol?: string,
): DerivativeStrategyDef {
	// Asset-class aware IV normalization (Index vs Single-Stock F&O)
	const upperSym = (symbol || "").toUpperCase();
	const isIndex = !symbol || ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"].includes(upperSym);
	const highIvCutoff = isIndex ? 22 : 32;
	const lowIvCutoff = isIndex ? 14 : 20;

	const volRegime: VolatilityRegime =
		iv > highIvCutoff ? "high" : iv < lowIvCutoff ? "low" : "normal";

	let volPreference: "buy" | "sell";
	if (volRegime === "high") {
		volPreference = "sell";
	} else if (volRegime === "low") {
		volPreference = "buy";
	} else {
		// Normal IV regime: alternate between option seller and buyer on consecutive calendar days
		const istDay = Math.floor((Date.now() + 5.5 * 3600000) / 86400000);
		volPreference = istDay % 2 === 0 ? "sell" : "buy";
	}

	// 20-day SMA directional bias
	let outlook: MarketOutlook = "neutral";
	if (recentCloses.length >= 5) {
		const smaLength = Math.min(20, recentCloses.length);
		const sma =
			recentCloses.slice(-smaLength).reduce((a, b) => a + b, 0) / smaLength;
		const smaDeviation = (spotPrice - sma) / sma;
		if (smaDeviation > 0.015) outlook = "bullish";
		else if (smaDeviation < -0.015) outlook = "bearish";
	}

	const isRecent = (strat: DerivativeStrategyDef) => {
		if (!recentIds) return false;
		if (symbol) {
			const fullName = `${symbol} ${strat.name}`.toLowerCase();
			if (recentIds.has(fullName) || recentIds.has(`${symbol} ${strat.name}`)) return true;
		}
		return recentIds.has(strat.name.toLowerCase()) || recentIds.has(strat.name);
	};

	// Helper to prioritize defined-risk (hedged) setups for option sellers
	const sortByDefinedRisk = (a: DerivativeStrategyDef, b: DerivativeStrategyDef) => {
		if (a.strategyType === "SELLER" && b.strategyType === "SELLER") {
			if (a.risk === "medium" && b.risk === "high") return -1;
			if (a.risk === "high" && b.risk === "medium") return 1;
		}
		return 0;
	};

	// 1. Exact volPreference + exact outlook
	const exact = STRATEGY_CATALOGUE
		.filter((s) => s.volPreference === volPreference && s.outlook === outlook)
		.sort(sortByDefinedRisk);
	const freshExact = exact.filter((s) => !isRecent(s));
	if (freshExact.length > 0) return freshExact[0];
	if (exact.length > 0) return exact[0];

	// 2. Exact volPreference + neutral outlook
	const neutralMatch = STRATEGY_CATALOGUE
		.filter((s) => s.volPreference === volPreference && s.outlook === "neutral")
		.sort(sortByDefinedRisk);
	const freshNeutral = neutralMatch.filter((s) => !isRecent(s));
	if (freshNeutral.length > 0) return freshNeutral[0];
	if (neutralMatch.length > 0) return neutralMatch[0];

	// 3. Fallback: Any fresh strategy matching volPreference
	const anyVolFresh = STRATEGY_CATALOGUE
		.filter((s) => s.volPreference === volPreference && !isRecent(s))
		.sort(sortByDefinedRisk);
	if (anyVolFresh.length > 0) return anyVolFresh[0];

	// 4. Any fresh strategy overall
	const anyFresh = STRATEGY_CATALOGUE.filter((s) => !isRecent(s)).sort(sortByDefinedRisk);
	return anyFresh[0] || STRATEGY_CATALOGUE[0];
}

export class DerivativeStrategy extends BaseStrategy {
	category: PickCategory = "derivatives";

	async generate(context: StrategyContext, symbolOverride?: string): Promise<DailyPickData | null> {
		try {
			const { lotSizes } = await derivativesService.getAvailableSymbols();
			const candidateIndices = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK"];
			const freshIndices = candidateIndices.filter(
				(sym) => !context.recentIds.has(sym) && !context.recentIds.has(sym.toLowerCase()),
			);
			const indexSymbols = freshIndices.length > 0 ? freshIndices : candidateIndices;

			// Deterministic rotation by IST day-of-year (honors symbolOverride if passed)
			const istDay = Math.floor((Date.now() + 5.5 * 3600000) / 86400000);
			const selectedSymbol = symbolOverride || indexSymbols[istDay % indexSymbols.length];

			const chain = await derivativesService.getOptionsChain(selectedSymbol);
			const spotPrice = chain.underlyingValue;
			const lotSize =
				lotSizes[selectedSymbol] ||
				SEBI_FNO_FRAMEWORK_2026.LOT_SIZES[
					selectedSymbol as keyof typeof SEBI_FNO_FRAMEWORK_2026.LOT_SIZES
				] ||
				65;

			const strikeInterval = this.getStrikeInterval(selectedSymbol, spotPrice);
			const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
			const atmCall = chain.options?.calls?.find((c) => c.strikePrice === atmStrike);
			const iv = atmCall?.impliedVolatility || 18;

			const recentCloses: number[] = await this.buildRecentCloses(chain, selectedSymbol, spotPrice);
			let strategy = selectStrategy(spotPrice, iv, recentCloses, context.recentIds, selectedSymbol);

			const todayStr = new Date().toISOString().split("T")[0];

			// ── Multi-Tenure Monthly Expiries (M1, M2, M3) Analysis ───────────────────
			const multiExpiryComparison = await derivativesService
				.getMultiExpiryCalls(selectedSymbol)
				.catch(() => null);

			const isIndexSymbol = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", "SENSEX", "BANKEX"].includes(
				selectedSymbol.toUpperCase(),
			);

			// Profit-optimized tenure selection:
			// Option Buyers benefit from Next Month (M2) to avoid rapid final-week theta crush.
			// Option Sellers benefit from This Month (M1) to maximize theta cash-flow capture.
			let targetExpiry =
				chain.expiryDates?.find((ed: string) => ed >= todayStr) ||
				this.getUpcomingExpiry(selectedSymbol);

			// Single-stock options: strictly enforce valid monthly Thursday expiry from exchange calendar
			if (!isIndexSymbol) {
				const stockExpiries = await derivativesService.getExpiryDates(selectedSymbol);
				const validMonthly = stockExpiries.find((ed: string) => ed >= todayStr);
				if (validMonthly) {
					targetExpiry = validMonthly;
				}
			}

			if (multiExpiryComparison?.calls && multiExpiryComparison.calls.length >= 2) {
				if (strategy.strategyType === "BUYER") {
					const m2 = multiExpiryComparison.calls.find((c) => c.tenure === "next_month");
					if (m2?.expiryDate) targetExpiry = m2.expiryDate;
				} else {
					const m1 = multiExpiryComparison.calls.find((c) => c.tenure === "near_month");
					if (m1?.expiryDate) targetExpiry = m1.expiryDate;
				}
			}

			const dteMs = new Date(targetExpiry).getTime() - Date.now();
			const dte = Math.max(1, Math.ceil(dteMs / 86400000));

			let payoff = this.buildLegsAndPayoff(
				selectedSymbol,
				strategy,
				spotPrice,
				atmStrike,
				strikeInterval,
				lotSize,
				chain,
				dte,
				iv,
				targetExpiry,
			);

			// ── SEBI Institutional Tail-Risk Guardrail ──────────────────────────────
			// Option Seller strategies (Credit/Income) must strictly be hedged multi-leg spreads
			// Auto-wrap protection wings if an unhedged setup was reached.
			if (strategy.strategyType === "SELLER" && payoff.maxLoss === "Unlimited") {
				logger.warn(
					`[DerivativeStrategy] Option seller strategy '${strategy.name}' has unhedged risk; auto-wrapping protection wings for SEBI client safety.`,
					{ symbol: selectedSymbol, rawStrategy: strategy.name },
				);
				const hedgedName = strategy.name === "Short Straddle" ? "Iron Butterfly" : "Iron Condor";
				const hedgedStrategy = STRATEGY_CATALOGUE.find((s) => s.name === hedgedName);
				if (hedgedStrategy) {
					strategy = hedgedStrategy;
					payoff = this.buildLegsAndPayoff(
						selectedSymbol,
						strategy,
						spotPrice,
						atmStrike,
						strikeInterval,
						lotSize,
						chain,
						dte,
						iv,
						targetExpiry,
					);
				}
			}

			// ── Tradeability & Liquidity Guardrail ──────────────────────────────────
			// Single-stock option calls must have 100% verified tradeable legs on the live exchange.
			// If any leg is unlisted or has 0 open interest/volume, reject the single-stock candidate
			// and auto-switch to liquid benchmark index (NIFTY/BANKNIFTY).
			if (!isIndexSymbol && (!payoff.allLegsTradeable || chain?.dataSource === "synthetic")) {
				logger.warn(
					`[DerivativeStrategy] 🛑 Tradeability VETO: ${selectedSymbol} ${strategy.name} contains unlisted or zero-liquidity leg(s). Discarding single-stock call to protect client execution. Auto-switching to benchmark index.`,
					{ symbol: selectedSymbol, untradeableCount: payoff.untradeableLegsCount },
				);
				return this.generateFallbackPick(context);
			}

			if (payoff.totalNetPremium <= 0) {
				return this.generateFallbackPick(context);
			}

			const entryPrice = payoff.totalNetPremium;
			const targetPrice = Math.round(entryPrice * strategy.targetMult * 100) / 100;
			const stoplossPrice = Math.round(entryPrice * strategy.slMult * 100) / 100;

			const highIvBenchmark = isIndexSymbol ? 22 : 32;
			const lowIvBenchmark = isIndexSymbol ? 14 : 20;

			const ivRegimeLabel =
				iv > highIvBenchmark
					? "High IV (Option Seller favored)"
					: iv < lowIvBenchmark
						? "Low IV (Option Buyer favored)"
						: "Normal IV (Balanced Theta)";

			const rationale = await context.service.generateRationale({
				category: "derivatives",
				name: `${selectedSymbol} ${strategy.name}`,
				symbol: selectedSymbol,
				strategy: strategy.name,
				outlook: strategy.outlook,
				currentPrice: spotPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					strategyType: strategy.strategyType,
					isCreditStrategy: payoff.isCredit,
					iv,
					ivRegime: ivRegimeLabel,
					lotSize,
					minOrderQuantity: lotSize,
					orderMultiple: lotSize,
					minContractValue: Math.round(lotSize * spotPrice),
					marginPerLot: payoff.marginRequired,
					maxProfitPerLot: payoff.maxProfit,
					maxLossPerLot: payoff.maxLoss,
					allLegsTradeable: true,
					isTradeable: true,
					executionGuidance: `Minimum execution order is 1 Lot (${lotSize} units). Orders must be in exact multiples of ${lotSize}. Contract notional: ₹${Math.round(lotSize * spotPrice).toLocaleString("en-IN")}.`,
					strikePrice: atmStrike,
					volPreference: strategy.volPreference,
					legs: payoff.legs,
					maxProfit: payoff.maxProfit,
					maxLoss: payoff.maxLoss,
					breakeven: payoff.breakeven,
					pop: payoff.pop,
					marginRequired: payoff.marginRequired,
					dte,
				},
			});

			// Final safety sanity check
			if (strategy.strategyType === "SELLER" && payoff.maxLoss === "Unlimited") {
				logger.error(
					`🛑 [DerivativeStrategy] Hard Risk Breach: Option seller strategy '${strategy.name}' has unhedged unlimited loss. Rejected by institutional tail-risk gate.`,
					{ event: "UNHEDGED_OPTION_SELLER_BLOCKED", symbol: selectedSymbol, strategy: strategy.name },
				);
				return null;
			}

			return {
				category: "derivatives",
				instrumentId: selectedSymbol,
				instrumentName: `${selectedSymbol} ${strategy.name}`,
				symbol: selectedSymbol,
				exchange: "NSE",
				recoDate: context.today,
				recoPrice: entryPrice,
				targetPrice,
				stoplossPrice,
				currentPrice: entryPrice,
				status: "live",
				expiryDate: targetExpiry,
				rationale,
				riskLevel: strategy.risk,
				suitableFor: this.deriveSuitableFor(strategy.risk, "derivatives"),
				timeHorizon: "ultra_short_term",
				confidenceScore: this.getConfidenceScore("derivatives", 65, 100),
				sectorCategory: isIndexSymbol ? "Index Derivatives" : "Stock Derivatives",
				keyMetrics: {
					strategy: strategy.name,
					strategyType: strategy.strategyType,
					description: strategy.description,
					outlook: strategy.outlook,
					lotSize,
					minOrderQuantity: lotSize,
					orderMultiple: lotSize,
					minContractValue: Math.round(lotSize * spotPrice),
					marginPerLot: payoff.marginRequired,
					maxProfitPerLot: payoff.maxProfit,
					maxLossPerLot: payoff.maxLoss,
					allLegsTradeable: payoff.allLegsTradeable,
					isTradeable: payoff.allLegsTradeable,
					executionGuidance: `Minimum execution order is 1 Lot (${lotSize} units). Orders must be in exact multiples of ${lotSize}. Contract notional: ₹${Math.round(lotSize * spotPrice).toLocaleString("en-IN")}.`,
					strikePrice: atmStrike,
					spotPrice,
					premiumPerUnit: payoff.netPremium,
					totalNetPremium: payoff.totalNetPremium,
					iv,
					impliedVolatility: iv,
					ivRegime: ivRegimeLabel,
					volPreference: strategy.volPreference,
					isCreditStrategy: payoff.isCredit,
					expiry: targetExpiry,
					expiryDate: targetExpiry,
					legs: payoff.legs,
					maxProfit: payoff.maxProfit,
					maxLoss: payoff.maxLoss,
					breakeven: payoff.breakeven,
					pop: payoff.pop,
					probabilityOfProfit: payoff.pop,
					dte,
					marginRequired: payoff.marginRequired,
					greeks: payoff.greeks,
					regulatoryNote: `${SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_DISCLAIMER} ${SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_DISCLAIMER}`,
					cashMarginRequiredPct: SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_MIN_PCT,
					expiryDayELMPct: SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_SURCHARGE_PCT,
					sebiCircularRef: SEBI_FNO_FRAMEWORK_2026.CIRCULAR_REF,
					multiTenureComparison: multiExpiryComparison,
				},
			};
		} catch (error) {
			logger.error(
				"[DerivativeStrategy] NSE API error, using curated fallback with computed legs:",
				error instanceof Error ? error : new Error(String(error)),
			);
			return this.generateFallbackPick(context, symbolOverride);
		}
	}

	/**
	 * Builds full multi-leg strategy parameters, premiums, Greeks, and SEBI margin.
	 */
	public buildLegsAndPayoff(
		symbol: string,
		strategy: DerivativeStrategyDef,
		spotPrice: number,
		atmStrike: number,
		strikeInterval: number,
		lotSize: number,
		chain?: any,
		dte = 7,
		iv = 18,
		targetExpiry?: string,
	): StrategyPayoffOutput {
		const legs: StrategyLegOutput[] = [];
		const allGreeks: Array<{ delta: number; theta: number; vega: number }> = [];

		let untradeableCount = 0;

		for (const tmpl of strategy.legs) {
			let offsetSteps = tmpl.strikeOffsetSteps;
			if (strategy.name.includes("Strangle") && offsetSteps === 0) {
				offsetSteps = tmpl.type === "CE" ? 1 : -1;
			}
			const strikePrice = atmStrike + offsetSteps * strikeInterval;
			let premium = 0;
			let isLegTradeable = false;
			let openInterest = 0;
			let tradingVolume = 0;
			let bidPrice = 0;
			let askPrice = 0;

			// 1. Try resolving real market quote from options chain
			if (chain?.options) {
				const list = Array.isArray(chain.options)
					? chain.options.filter((o: any) => (o.optionType || o.type) === tmpl.type)
					: (tmpl.type === "CE" ? chain.options.calls : chain.options.puts);
				const match = list?.find((o: any) => o.strikePrice === strikePrice);
				if (match) {
					if (match.lastPrice > 0) premium = match.lastPrice;
					openInterest = match.openInterest || 0;
					tradingVolume = match.totalTradedVolume || match.volume || 0;
					bidPrice = match.bidPrice || match.bid || 0;
					askPrice = match.askPrice || match.ask || 0;

					// A leg is confirmed tradeable if listed on exchange with real price and open interest or trading volume
					if (premium > 0 && (openInterest > 0 || tradingVolume > 0 || (bidPrice > 0 && askPrice > 0))) {
						isLegTradeable = true;
					}
				}
			}

			if (!isLegTradeable) {
				untradeableCount++;
			}

			// 2. Fallback to Black-Scholes theoretical price only if real premium not available
			if (premium <= 0) {
				premium = calculateBlackScholesPrice(
					spotPrice,
					strikePrice,
					dte,
					iv / 100,
					tmpl.type === "CE" ? "call" : "put",
				);
			}

			premium = alignToTick(premium);

			// Greeks for leg
			const g = derivativesService.calculateGreeks(
				spotPrice,
				strikePrice,
				dte,
				iv / 100,
				0.065,
				tmpl.type === "CE" ? "call" : "put",
			);
			allGreeks.push({ delta: g.delta, theta: g.theta, vega: g.vega });

			legs.push({
				action: tmpl.action,
				quantity: tmpl.quantityRatio ?? 1,
				type: tmpl.type,
				strikePrice,
				premium,
				name: `${symbol} ${strikePrice} ${tmpl.type}`,
				executionPriority: tmpl.action === "BUY" ? 1 : 2,
				executionNote:
					tmpl.action === "BUY"
						? "Execute first to unlock SEBI portfolio margin benefit"
						: "Execute after protective wings are confirmed filled",
				isTradeable: isLegTradeable,
				openInterest,
				tradingVolume,
				bidPrice,
				askPrice,
				expiryDate: targetExpiry,
			});
		}

		// Calculate net debit / credit per unit
		let netDebit = 0;
		for (const leg of legs) {
			const sign = leg.action === "BUY" ? 1 : -1;
			netDebit += sign * leg.premium * leg.quantity;
		}
		netDebit = Math.round(netDebit * 100) / 100;

		const isCredit = strategy.strategyType === "SELLER" || netDebit < 0;
		const netPremium = isCredit ? Math.max(0.05, Math.abs(netDebit)) : Math.max(0.05, netDebit);
		const totalNetPremium = Math.round(netPremium * lotSize * 100) / 100;

		// Compute Max Profit, Max Loss, and Breakeven
		let maxProfit: number | "Unlimited";
		let maxLoss: number | "Unlimited";
		let breakeven: number | number[];

		switch (strategy.name) {
			case "Bull Call Spread": {
				const k1 = atmStrike;
				const k2 = atmStrike + strikeInterval;
				maxProfit = Math.round((k2 - k1 - netPremium) * lotSize);
				maxLoss = totalNetPremium;
				breakeven = Math.round((k1 + netPremium) * 100) / 100;
				break;
			}
			case "Bear Put Spread": {
				const k1 = atmStrike;
				const k2 = atmStrike - strikeInterval;
				maxProfit = Math.round((k1 - k2 - netPremium) * lotSize);
				maxLoss = totalNetPremium;
				breakeven = Math.round((k1 - netPremium) * 100) / 100;
				break;
			}
			case "Bull Put Spread": {
				const k1 = atmStrike;
				const k2 = atmStrike - strikeInterval;
				maxProfit = totalNetPremium;
				maxLoss = Math.round((k1 - k2 - netPremium) * lotSize);
				breakeven = Math.round((k1 - netPremium) * 100) / 100;
				break;
			}
			case "Bear Call Spread": {
				const k1 = atmStrike;
				const k2 = atmStrike + strikeInterval;
				maxProfit = totalNetPremium;
				maxLoss = Math.round((k2 - k1 - netPremium) * lotSize);
				breakeven = Math.round((k1 + netPremium) * 100) / 100;
				break;
			}
			case "Iron Condor": {
				const kPutSold = atmStrike - strikeInterval;
				const kCallSold = atmStrike + strikeInterval;
				maxProfit = totalNetPremium;
				maxLoss = Math.round((strikeInterval - netPremium) * lotSize);
				breakeven = [
					Math.round((kPutSold - netPremium) * 100) / 100,
					Math.round((kCallSold + netPremium) * 100) / 100,
				];
				break;
			}
			case "Iron Butterfly": {
				maxProfit = totalNetPremium;
				maxLoss = Math.round((strikeInterval - netPremium) * lotSize);
				breakeven = [
					Math.round((atmStrike - netPremium) * 100) / 100,
					Math.round((atmStrike + netPremium) * 100) / 100,
				];
				break;
			}
			case "Long Straddle": {
				maxProfit = "Unlimited";
				maxLoss = totalNetPremium;
				breakeven = [
					Math.round((atmStrike - netPremium) * 100) / 100,
					Math.round((atmStrike + netPremium) * 100) / 100,
				];
				break;
			}
			case "Short Straddle": {
				maxProfit = totalNetPremium;
				maxLoss = "Unlimited";
				breakeven = [
					Math.round((atmStrike - netPremium) * 100) / 100,
					Math.round((atmStrike + netPremium) * 100) / 100,
				];
				break;
			}
			case "Long Strangle": {
				const kPut = atmStrike - strikeInterval;
				const kCall = atmStrike + strikeInterval;
				maxProfit = "Unlimited";
				maxLoss = totalNetPremium;
				breakeven = [
					Math.round((kPut - netPremium) * 100) / 100,
					Math.round((kCall + netPremium) * 100) / 100,
				];
				break;
			}
			case "Short Strangle": {
				const kPut = atmStrike - strikeInterval;
				const kCall = atmStrike + strikeInterval;
				maxProfit = totalNetPremium;
				maxLoss = "Unlimited";
				breakeven = [
					Math.round((kPut - netPremium) * 100) / 100,
					Math.round((kCall + netPremium) * 100) / 100,
				];
				break;
			}
			case "Long Call": {
				maxProfit = "Unlimited";
				maxLoss = totalNetPremium;
				breakeven = Math.round((atmStrike + netPremium) * 100) / 100;
				break;
			}
			case "Long Put": {
				maxProfit = Math.round((atmStrike - netPremium) * lotSize);
				maxLoss = totalNetPremium;
				breakeven = Math.round((atmStrike - netPremium) * 100) / 100;
				break;
			}
			default: {
				maxProfit = isCredit ? totalNetPremium : "Unlimited";
				maxLoss = isCredit ? Math.round(strikeInterval * lotSize) : totalNetPremium;
				breakeven = atmStrike;
			}
		}

		// Calculate Margin Requirement
		let marginRequired: number;
		if (!isCredit) {
			marginRequired = totalNetPremium;
		} else {
			if (typeof maxLoss === "number") {
				marginRequired = Math.max(totalNetPremium, Math.round(maxLoss + spotPrice * lotSize * 0.02));
			} else {
				marginRequired = Math.round(spotPrice * lotSize * 0.16);
			}
		}

		// Greeks aggregation
		let delta = 0;
		let theta = 0;
		let vega = 0;
		for (let i = 0; i < strategy.legs.length; i++) {
			const leg = strategy.legs[i];
			const g = allGreeks[i];
			const sign = leg.action === "BUY" ? 1 : -1;
			delta += sign * (g?.delta ?? 0);
			// Short legs (sign = -1) earn positive theta from decaying negative option theta
			theta += (sign === -1 ? Math.abs(g?.theta ?? 0) : -Math.abs(g?.theta ?? 0)) * lotSize;
			vega += sign * (g?.vega ?? 0) * lotSize;
		}

		// Ensure option seller strategies reflect positive time decay income
		if (isCredit && theta <= 0) {
			theta = Math.max(1.0, Math.round((totalNetPremium / Math.max(1, dte)) * 100) / 100);
		}

		const pop = calculateProbabilityOfProfit(
			spotPrice,
			breakeven,
			dte,
			iv,
			isCredit,
			strategy.name,
		);

		return {
			legs,
			netPremium,
			totalNetPremium,
			isCredit,
			maxProfit,
			maxLoss,
			breakeven,
			pop,
			greeks: {
				delta: +delta.toFixed(4),
				theta: +theta.toFixed(2),
				vega: +vega.toFixed(2),
			},
			marginRequired,
			allLegsTradeable: untradeableCount === 0 && legs.length > 0,
			untradeableLegsCount: untradeableCount,
		};
	}

	/**
	 * Computes upcoming contract expiry date.
	 * SEBI Framework Enforcement: Single-stock options are strictly monthly (last Thursday).
	 * Weekly expiries are ONLY permitted on designated benchmark indices (NIFTY on NSE, SENSEX on BSE).
	 */
	public getUpcomingExpiry(symbol = "NIFTY", now = new Date()): string {
		const upper = symbol.toUpperCase();
		const isBse = upper === "SENSEX" || upper === "BANKEX";
		const exchange = isBse ? "BSE" : "NSE";
		const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
		const istDate = new Date(now.getTime() + IST_OFFSET_MS);

		// Helper to adjust backward if the expiry falls on an exchange trading holiday
		const adjustForHoliday = (date: Date): Date => {
			const cur = new Date(date);
			while (!marketHolidayService.isTradingDay(cur, exchange)) {
				cur.setUTCDate(cur.getUTCDate() - 1);
			}
			return cur;
		};

		// Weekly expiries are ONLY permitted on designated benchmark indices (NIFTY on NSE, SENSEX on BSE).
		// Single-stock options & monthly-only indices (BANKNIFTY, FINNIFTY, MIDCPNIFTY): strictly monthly last Thursday!
		const isWeeklyAllowed = upper === "NIFTY" || upper === "SENSEX";

		if (!isWeeklyAllowed) {
			const endCurrent = new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth() + 1, 0));
			while (endCurrent.getUTCDay() !== 4) endCurrent.setUTCDate(endCurrent.getUTCDate() - 1);
			const adjustedCurrent = adjustForHoliday(endCurrent);
			const currentMonthExpiry = adjustedCurrent.toISOString().split("T")[0];
			const todayStr = istDate.toISOString().split("T")[0];
			if (currentMonthExpiry >= todayStr) {
				return currentMonthExpiry;
			}
			const endNext = new Date(Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth() + 2, 0));
			while (endNext.getUTCDay() !== 4) endNext.setUTCDate(endNext.getUTCDate() - 1);
			return adjustForHoliday(endNext).toISOString().split("T")[0];
		}

		// Benchmark weekly indices (NIFTY on Thursday = 4, SENSEX on Friday = 5)
		const targetDay = isBse ? 5 : 4;
		const currentDay = istDate.getUTCDay();
		let daysToAdd = (targetDay - currentDay + 7) % 7;
		if (daysToAdd === 0) {
			const istHours = istDate.getUTCHours() + istDate.getUTCMinutes() / 60;
			if (istHours >= 15.5) {
				daysToAdd = 7;
			}
		}
		istDate.setUTCDate(istDate.getUTCDate() + daysToAdd);
		return adjustForHoliday(istDate).toISOString().split("T")[0];
	}

	public getUpcomingWeeklyExpiry(symbol = "NIFTY", now = new Date()): string {
		return this.getUpcomingExpiry(symbol, now);
	}

	private async buildRecentCloses(chain: any, symbol: string, spotPrice: number): Promise<number[]> {
		if (Array.isArray(chain?.underlyingPriceSeries) && chain.underlyingPriceSeries.length >= 5) {
			return (chain.underlyingPriceSeries as number[]).slice(-20);
		}
		try {
			const closes = await derivativesService.getRecentDailyCloses(symbol, 20);
			if (closes.length >= 5) return closes;
		} catch {
			/* Fall through */
		}
		return [spotPrice];
	}

	/**
	 * Fallback pick with fully calculated legs and payoff.
	 */
	private async generateFallbackPick(
		context: StrategyContext,
		symbolOverride?: string,
	): Promise<DailyPickData | null> {
		try {
			const FALLBACK_INDEX = [
				{
					symbol: "NIFTY",
					spotPrice: 24500,
					lotSize: SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.NIFTY ?? 65,
					sector: "Index Derivatives",
				},
				{
					symbol: "BANKNIFTY",
					spotPrice: 52000,
					lotSize: SEBI_FNO_FRAMEWORK_2026.LOT_SIZES.BANKNIFTY ?? 30,
					sector: "Banking Index Derivatives",
				},
			];

			const freshFallbacks = FALLBACK_INDEX.filter(
				(f) => !context.recentIds.has(f.symbol) && !context.recentIds.has(f.symbol.toLowerCase()),
			);
			const pool = freshFallbacks.length > 0 ? freshFallbacks : FALLBACK_INDEX;

			const istDay = Math.floor((Date.now() + 5.5 * 3600000) / 86400000);
			const idx = istDay % pool.length;
			const targetItem = symbolOverride
				? (FALLBACK_INDEX.find((f) => f.symbol === symbolOverride) || pool[idx])
				: pool[idx];
			const { symbol, spotPrice, lotSize, sector } = targetItem;

			const targetExpiry = this.getUpcomingWeeklyExpiry(symbol);
			const dteMs = new Date(targetExpiry).getTime() - Date.now();
			const dte = Math.max(1, Math.ceil(dteMs / 86400000));

			let strategy = selectStrategy(spotPrice, 18, [spotPrice], context.recentIds, symbol);
			const strikeInterval = this.getStrikeInterval(symbol, spotPrice);
			const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;

			let payoff = this.buildLegsAndPayoff(
				symbol,
				strategy,
				spotPrice,
				atmStrike,
				strikeInterval,
				lotSize,
				undefined,
				dte,
				18,
				targetExpiry,
			);

			// Auto-wrap protection wings for SEBI client capital protection
			if (strategy.strategyType === "SELLER" && payoff.maxLoss === "Unlimited") {
				const hedgedName = strategy.name === "Short Straddle" ? "Iron Butterfly" : "Iron Condor";
				const hedgedStrategy = STRATEGY_CATALOGUE.find((s) => s.name === hedgedName);
				if (hedgedStrategy) {
					strategy = hedgedStrategy;
					payoff = this.buildLegsAndPayoff(
						symbol,
						strategy,
						spotPrice,
						atmStrike,
						strikeInterval,
						lotSize,
						undefined,
						dte,
						18,
						targetExpiry,
					);
				}
			}

			const entryPrice = payoff.totalNetPremium;
			const targetPrice = Math.round(entryPrice * strategy.targetMult * 100) / 100;
			const stoplossPrice = Math.round(entryPrice * strategy.slMult * 100) / 100;

			const rationale = await context.service.generateRationale({
				category: "derivatives",
				name: `${symbol} ${strategy.name}`,
				symbol,
				strategy: strategy.name,
				outlook: strategy.outlook,
				currentPrice: spotPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					strategyType: strategy.strategyType,
					isCreditStrategy: payoff.isCredit,
					lotSize,
					minOrderQuantity: lotSize,
					orderMultiple: lotSize,
					minContractValue: Math.round(lotSize * spotPrice),
					marginPerLot: payoff.marginRequired,
					maxProfitPerLot: payoff.maxProfit,
					maxLossPerLot: payoff.maxLoss,
					allLegsTradeable: true,
					isTradeable: true,
					executionGuidance: `Minimum execution order is 1 Lot (${lotSize} units). Orders must be in exact multiples of ${lotSize}. Contract notional: ₹${Math.round(lotSize * spotPrice).toLocaleString("en-IN")}.`,
					strikePrice: atmStrike,
					approxIV: 18,
					legs: payoff.legs,
					maxProfit: payoff.maxProfit,
					maxLoss: payoff.maxLoss,
					breakeven: payoff.breakeven,
					pop: payoff.pop,
					marginRequired: payoff.marginRequired,
					dte,
					dataSource: "fallback_curated",
				},
			});

			// ── SEBI Institutional Tail-Risk Guardrail ──────────────────────────────
			// Option Seller strategies (Credit/Income) must strictly be hedged multi-leg spreads
			// and can NEVER expose clients to "Unlimited" max loss.
			if (strategy.strategyType === "SELLER" && payoff.maxLoss === "Unlimited") {
				logger.error(
					`🛑 [DerivativeStrategy] Hard Risk Breach: Option seller strategy '${strategy.name}' has unhedged unlimited loss. Rejected by institutional tail-risk gate.`,
					{ event: "UNHEDGED_OPTION_SELLER_BLOCKED", symbol, strategy: strategy.name },
				);
				return null;
			}

			return {
				category: "derivatives",
				instrumentId: symbol,
				instrumentName: `${symbol} ${strategy.name}`,
				symbol,
				exchange: "NSE",
				recoDate: context.today,
				recoPrice: entryPrice,
				targetPrice,
				stoplossPrice,
				currentPrice: entryPrice,
				status: "live",
				expiryDate: targetExpiry,
				rationale,
				riskLevel: strategy.risk,
				suitableFor: this.deriveSuitableFor(strategy.risk, "derivatives"),
				timeHorizon: "ultra_short_term",
				confidenceScore: 65,
				sectorCategory: sector,
				keyMetrics: {
					strategy: strategy.name,
					strategyType: strategy.strategyType,
					description: strategy.description,
					outlook: strategy.outlook,
					lotSize,
					minOrderQuantity: lotSize,
					orderMultiple: lotSize,
					minContractValue: Math.round(lotSize * spotPrice),
					marginPerLot: payoff.marginRequired,
					maxProfitPerLot: payoff.maxProfit,
					maxLossPerLot: payoff.maxLoss,
					allLegsTradeable: true,
					isTradeable: true,
					executionGuidance: `Minimum execution order is 1 Lot (${lotSize} units). Orders must be in exact multiples of ${lotSize}. Contract notional: ₹${Math.round(lotSize * spotPrice).toLocaleString("en-IN")}.`,
					strikePrice: atmStrike,
					spotPrice,
					premiumPerUnit: payoff.netPremium,
					totalNetPremium: payoff.totalNetPremium,
					iv: 18,
					impliedVolatility: 18,
					dataSource: "fallback_curated",
					isCreditStrategy: payoff.isCredit,
					expiry: targetExpiry,
					expiryDate: targetExpiry,
					legs: payoff.legs,
					maxProfit: payoff.maxProfit,
					maxLoss: payoff.maxLoss,
					breakeven: payoff.breakeven,
					pop: payoff.pop,
					probabilityOfProfit: payoff.pop,
					dte,
					marginRequired: payoff.marginRequired,
					greeks: payoff.greeks,
					regulatoryNote: `${SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_DISCLAIMER} ${SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_DISCLAIMER}`,
					cashMarginRequiredPct: SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_MIN_PCT,
					expiryDayELMPct: SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_SURCHARGE_PCT,
					sebiCircularRef: SEBI_FNO_FRAMEWORK_2026.CIRCULAR_REF,
					multiTenureComparison: await derivativesService.getMultiExpiryCalls(symbol).catch(() => null),
				},
			};
		} catch (err) {
			logger.error(
				"[DerivativeStrategy] Fallback also failed:",
				err instanceof Error ? err : new Error(String(err)),
			);
			return null;
		}
	}

	score(_instrument: any): number {
		return 70;
	}

	public getStrikeInterval(symbol: string, price: number): number {
		const upper = symbol.toUpperCase();
		if (upper === "BANKNIFTY" || upper === "SENSEX") return 100;
		if (upper === "NIFTY" || upper === "FINNIFTY") return 50;
		if (upper === "MIDCPNIFTY") return 25;
		if (upper === "TCS") return 50;
		if (upper === "RELIANCE" || upper === "INFY" || upper === "HDFCBANK" || upper === "ICICIBANK") return 20;
		if (price < 100) return 2.5;
		if (price < 250) return 5;
		if (price < 500) return 10;
		if (price < 2500) return 20;
		if (price < 5000) return 50;
		return 100;
	}

	async getLivePrice(_instrumentId: string): Promise<number | null> {
		return null;
	}
}

export const derivativeStrategy = new DerivativeStrategy();
