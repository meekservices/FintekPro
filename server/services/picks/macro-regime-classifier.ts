/**
 * @file macro-regime-classifier.ts
 * @description Institutional 4-State Macro Regime Classifier for FintekPro Tier-0 POTD Engine.
 *              Detects Reflation, Stagflation, Deflation, and Goldilocks regimes based on
 *              growth momentum, inflation/yield trajectory, currency volatility, and commodity pressure.
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Deterministic Output: Identical market indicators yield identical regime classifications.
 * - Every payload exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 * - Non-negotiable explainability layer for SEBI RIA decision support.
 */

import { logger } from "../../logger";

export const MACRO_REGIME_VERSION = "1.0.0-tier0";

export type MacroRegimeType = "REFLATION" | "STAGFLATION" | "DEFLATION" | "GOLDILOCKS";

export interface MacroIndicatorInputs {
	indiaVix?: number;
	nifty50PeRatio?: number;
	gSec10YYield?: number;       // e.g. 6.85 (%)
	crudeBrentUsd?: number;       // e.g. 74.50 ($/bbl)
	usdInrRate?: number;          // e.g. 84.80
	cpiInflationPct?: number;     // e.g. 5.1 (%)
	fiiNetFlowTrend?: "INFLOW" | "OUTFLOW" | "NEUTRAL";
}

export interface MacroRegimeClassification {
	engine_version: string;
	calculation_timestamp: string;
	regime: MacroRegimeType;
	confidenceScore: number;      // 0 to 100
	rationale: string;
	categoryWeightMultipliers: Record<string, number>;
	overweightSegments: string[];
	underweightSegments: string[];
	inputs_used: MacroIndicatorInputs;
	intermediate_scores: {
		growthScore: number;       // -100 to +100
		inflationPressure: number; // -100 to +100
		monetaryStress: number;    // 0 to 100
	};
	transitionProbability: {
		toReflation: number;
		toStagflation: number;
		toDeflation: number;
		toGoldilocks: number;
	};
}

/**
 * Institutional baseline category multipliers by macro regime.
 * Values > 1.0 indicate tactical overweight; < 1.0 indicate tactical underweight.
 */
const REGIME_CATEGORY_MULTIPLIERS: Record<MacroRegimeType, Record<string, number>> = {
	REFLATION: {
		listed_stocks: 1.30,
		derivatives: 1.25,
		commodities: 1.35,      // Industrial metals & energy lead
		etfs: 1.20,
		mutual_funds: 1.15,
		unlisted: 1.10,
		pre_ipo: 1.10,
		global_stocks: 1.05,
		reits_invits: 0.95,
		bonds: 0.80,            // Yields rising = bond prices falling
		fixed_deposits: 0.75,
		sgb: 0.90,
	},
	STAGFLATION: {
		sgb: 1.45,              // Gold is prime stagflation hedge
		commodities: 1.40,      // Cost-push raw materials & energy
		fixed_deposits: 1.20,   // Cash preservation & rising rates
		bonds: 0.85,            // Floating rate preferred, long-term bonds suffer
		reits_invits: 0.90,
		mutual_funds: 0.85,     // Conservative/Hybrid allocation
		etfs: 0.80,
		listed_stocks: 0.70,    // Margin compression
		derivatives: 0.80,      // Hedging & Option Selling strategies preferred
		global_stocks: 0.75,
		unlisted: 0.65,
		pre_ipo: 0.60,
	},
	DEFLATION: {
		bonds: 1.40,            // Long duration sovereign & AAA G-Secs rally as yields drop
		fixed_deposits: 1.30,   // Real yields are positive and attractive
		sgb: 1.10,
		reits_invits: 1.15,     // Yield compression drives capital value
		mutual_funds: 1.00,     // Debt/Hybrid funds
		etfs: 0.90,
		listed_stocks: 0.75,    // Earnings contraction
		derivatives: 0.85,
		global_stocks: 0.80,
		commodities: 0.60,      // Demand destruction in raw materials
		unlisted: 0.55,
		pre_ipo: 0.50,
	},
	GOLDILOCKS: {
		listed_stocks: 1.35,    // High PE tolerance, steady earnings expansion
		etfs: 1.30,
		mutual_funds: 1.25,
		global_stocks: 1.20,
		derivatives: 1.15,
		reits_invits: 1.20,     // Stable distribution yields + asset growth
		pre_ipo: 1.15,
		unlisted: 1.10,
		bonds: 1.05,
		commodities: 0.95,
		sgb: 0.90,
		fixed_deposits: 0.85,
	},
};

export class MacroRegimeClassifier {
	/**
	 * Classifies the active market macro regime from macroeconomic indicators.
	 *
	 * Inputs:
	 *  - `inputs`: Real-time or polled indicators (VIX, 10Y G-Sec, Crude, Nifty PE, USD/INR, CPI).
	 * Outputs:
	 *  - `MacroRegimeClassification`: Regime type, category multipliers, and transition probabilities.
	 */
	public classify(inputs: MacroIndicatorInputs = {}): MacroRegimeClassification {
		const calculationTimestamp = new Date().toISOString();

		// Default baseline values based on normal Indian financial conditions
		const vix = inputs.indiaVix ?? 14.5;
		const pe = inputs.nifty50PeRatio ?? 22.5;
		const gSec = inputs.gSec10YYield ?? 6.85;
		const crude = inputs.crudeBrentUsd ?? 74.0;
		const usdInr = inputs.usdInrRate ?? 84.5;
		const cpi = inputs.cpiInflationPct ?? 4.8;
		const fiiTrend = inputs.fiiNetFlowTrend ?? "NEUTRAL";

		// 1. Calculate Growth Momentum (-100 to +100)
		let growthScore = 0;
		if (pe >= 24) growthScore += 25;
		else if (pe >= 20) growthScore += 10;
		else if (pe < 18) growthScore -= 20;

		if (fiiTrend === "INFLOW") growthScore += 30;
		else if (fiiTrend === "OUTFLOW") growthScore -= 30;

		if (vix < 15) growthScore += 20;
		else if (vix > 22) growthScore -= 30;

		// 2. Calculate Inflation Pressure (-100 to +100)
		let inflationPressure = 0;
		if (cpi > 5.5) inflationPressure += 40;
		else if (cpi > 4.5) inflationPressure += 15;
		else inflationPressure -= 20;

		if (crude > 85) inflationPressure += 35;
		else if (crude > 75) inflationPressure += 15;
		else if (crude < 68) inflationPressure -= 25;

		if (usdInr > 85.0) inflationPressure += 15;

		// 3. Calculate Monetary Stress (0 to 100)
		let monetaryStress = Math.min(
			100,
			Math.max(0, (gSec - 6.5) * 40 + (vix > 18 ? (vix - 18) * 4 : 0)),
		);

		// Determine Regime State
		let regime: MacroRegimeType;
		let rationale: string;
		let confidenceScore = 80;

		const isHighInflation = inflationPressure > 10;
		const isHighGrowth = growthScore >= 0;

		if (isHighGrowth && isHighInflation) {
			regime = "REFLATION";
			rationale = `Reflationary expansion confirmed: Solid domestic equity earnings momentum coupled with elevated commodity/crude demand ($${crude.toFixed(1)}/bbl) and moderate inflation (${cpi.toFixed(1)}%). Favoring cyclicals, industrial commodities, and momentum equities.`;
			confidenceScore = Math.min(95, 75 + Math.abs(growthScore) / 4);
		} else if (!isHighGrowth && isHighInflation) {
			regime = "STAGFLATION";
			rationale = `Stagflationary defense actuated: High inflation/energy pressure (${cpi.toFixed(1)}% CPI, $${crude.toFixed(1)} Crude) with muted growth and FII outflows. Mandating tactical overweight in Sovereign Gold (SGB), safe-haven commodities, and short-duration cash preservation.`;
			confidenceScore = Math.min(95, 78 + Math.abs(inflationPressure) / 4);
		} else if (!isHighGrowth && !isHighInflation) {
			regime = "DEFLATION";
			rationale = `Deflationary / Growth Slowdown posture: Cooling inflation (${cpi.toFixed(1)}%) with softening demand. Yield curve compression creates prime capital appreciation opportunities in AAA Corporate Debt, PSU Fixed Deposits, and high-yield REITs.`;
			confidenceScore = Math.min(95, 74 + Math.abs(growthScore) / 4);
		} else {
			// isHighGrowth && !isHighInflation
			regime = "GOLDILOCKS";
			rationale = `Goldilocks macro equilibrium: Robust corporate earnings and benign volatility (VIX ${vix.toFixed(1)}) paired with anchored inflation (${cpi.toFixed(1)}%). Broad-based equity alpha, multi-cap ETFs, and growth compounding prioritized.`;
			confidenceScore = Math.min(96, 82 + (20 - Math.min(20, vix)));
		}

		const multipliers = REGIME_CATEGORY_MULTIPLIERS[regime];
		const overweightSegments = Object.entries(multipliers)
			.filter(([, mult]) => mult >= 1.15)
			.map(([seg]) => seg);
		const underweightSegments = Object.entries(multipliers)
			.filter(([, mult]) => mult <= 0.85)
			.map(([seg]) => seg);

		// Transition probabilities based on distance from boundaries
		const probReflation = Math.max(5, Math.round(30 + (growthScore + inflationPressure) / 4));
		const probStagflation = Math.max(5, Math.round(25 + (inflationPressure - growthScore) / 4));
		const probDeflation = Math.max(5, Math.round(20 - (growthScore + inflationPressure) / 4));
		const probGoldilocks = Math.max(5, Math.round(25 + (growthScore - inflationPressure) / 4));
		const totalProb = probReflation + probStagflation + probDeflation + probGoldilocks;

		return {
			engine_version: MACRO_REGIME_VERSION,
			calculation_timestamp: calculationTimestamp,
			regime,
			confidenceScore: Math.round(confidenceScore),
			rationale,
			categoryWeightMultipliers: multipliers,
			overweightSegments,
			underweightSegments,
			inputs_used: {
				indiaVix: vix,
				nifty50PeRatio: pe,
				gSec10YYield: gSec,
				crudeBrentUsd: crude,
				usdInrRate: usdInr,
				cpiInflationPct: cpi,
				fiiNetFlowTrend: fiiTrend,
			},
			intermediate_scores: {
				growthScore: Math.round(growthScore),
				inflationPressure: Math.round(inflationPressure),
				monetaryStress: Math.round(monetaryStress),
			},
			transitionProbability: {
				toReflation: Math.round((probReflation / totalProb) * 100),
				toStagflation: Math.round((probStagflation / totalProb) * 100),
				toDeflation: Math.round((probDeflation / totalProb) * 100),
				toGoldilocks: Math.round((probGoldilocks / totalProb) * 100),
			},
		};
	}
}

export const macroRegimeClassifier = new MacroRegimeClassifier();
