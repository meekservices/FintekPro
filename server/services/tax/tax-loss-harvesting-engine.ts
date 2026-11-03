/**
 * @file tax-loss-harvesting-engine.ts
 * @description Institutional Tax-Loss Harvesting (TLH) & Capital Gains Optimization Engine for FintekPro.
 *              Complies with Indian Income Tax Act (Finance Act / Budget 2024 amendments):
 *              - STCG (<= 12 months) taxed @ 20%
 *              - LTCG (> 12 months) taxed @ 12.5% above ₹1,25,000 annual exemption limit
 *              - STCL can offset both STCG and LTCG
 *              - LTCL can offset LTCG only
 *              - Suggests correlation-conscious proxy replacements to maintain market beta
 *
 * GCR v1.0 & FASP-AI v1.0 Compliance:
 * - Deterministic Output: Same portfolio tax lots ALWAYS yield identical recommendations & savings.
 * - Every payload exposes engine_version, calculation_timestamp, inputs_used, formula_applied, intermediate_steps.
 * - Strict TypeScript typing with zero unverified any.
 * - JSDoc documentation on all exported functions.
 */

export const TLH_ENGINE_VERSION = "1.0.0";

export const INDIAN_TAX_RATES_2024 = {
	stcgRate: 0.20,             // 20% short-term capital gains tax
	ltcgRate: 0.125,            // 12.5% long-term capital gains tax (post-July 2024)
	ltcgExemptionLimit: 125000, // ₹1,25,000 annual exemption on equity LTCG
	equityHoldingMonths: 12,    // 12 months holding period for equity classification
} as const;

export interface TaxLotInput {
	lotId: string;
	symbol: string;
	companyName?: string;
	assetType: "EQUITY" | "EQUITY_MUTUAL_FUND" | "ETF" | "DEBT";
	buyDate: string; // ISO format: YYYY-MM-DD
	buyPrice: number;
	quantity: number;
	currentPrice: number;
	proxyAlternativeSymbol?: string; // Correlated asset to maintain beta without remaining uninvested
}

export interface YearToDateCapitalGains {
	realizedStcg: number; // Realized short term gains in current FY (₹)
	realizedLtcg: number; // Realized long term gains in current FY (₹)
	availableLtcgExemptionUsed?: number; // How much of ₹1.25L exemption is already used
}

export interface HarvestRecommendation {
	lotId: string;
	symbol: string;
	assetType: string;
	holdingPeriodDays: number;
	holdingType: "SHORT_TERM" | "LONG_TERM";
	unrealizedGainLoss: number; // ₹ (negative = loss)
	action: "HARVEST_STCL" | "HARVEST_LTCL" | "REALIZE_EXEMPT_LTCG" | "HOLD";
	priority: "HIGH" | "MEDIUM" | "LOW" | "NONE";
	estimatedTaxSaved: number; // in ₹
	recommendedProxySymbol?: string;
	rationale: string;
}

export interface TlhOptimizationResult {
	engine_version: string;
	calculation_timestamp: string;
	portfolioSummary: {
		totalInvested: number;
		currentValue: number;
		totalUnrealizedGainLoss: number;
		unrealizedStclTotal: number;
		unrealizedLtclTotal: number;
		potentialTaxSavingsTotal: number; // in ₹
	};
	taxPositionCurrentFY: {
		taxLiabilityBeforeHarvesting: number;
		taxLiabilityAfterHarvesting: number;
		netImmediateTaxSaved: number;
	};
	recommendations: HarvestRecommendation[];
	inputs_used: {
		lotsCount: number;
		currentDate: string;
		ytdRealizedStcg: number;
		ytdRealizedLtcg: number;
	};
	formula_applied: string;
	intermediate_steps: {
		stcgTaxOffsetPotential: number;
		ltcgTaxOffsetPotential: number;
		unusedLtcgExemption: number;
	};
	disclaimer: string;
}

/**
 * Standard proxy replacement map for top Indian equities and ETFs
 * Allows RIA clients to harvest tax losses without sitting in cash or missing market rallies.
 */
const SECTOR_PROXY_MAP: Record<string, string> = {
	HDFCBANK: "ICICIBANK",
	ICICIBANK: "KOTAKBANK",
	KOTAKBANK: "AXISBANK",
	AXISBANK: "ICICIBANK",
	TCS: "INFY",
	INFY: "TCS",
	WIPRO: "HCLTECH",
	HCLTECH: "TECHM",
	RELIANCE: "ONGC",
	TATAMOTORS: "M&M",
	"M&M": "MARUTI",
	NIFTYBEES: "SETFNIF50",
	BANKBEES: "SETFNIFBK",
	GOLDBEES: "GOLDSHARE",
};

/**
 * Calculates holding period in calendar days.
 */
function getHoldingDays(buyDateStr: string, asOfDate: Date): number {
	const buyDate = new Date(buyDateStr);
	const diffMs = asOfDate.getTime() - buyDate.getTime();
	return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Executes Tax-Loss Harvesting & Capital Gains optimization for client tax lots.
 *
 * @param taxLots - Individual purchased tax lots with buyDate, buyPrice, currentPrice
 * @param ytdGains - Year-to-date realized STCG and LTCG
 * @param customAsOfDate - Evaluation date (defaults to current date)
 * @returns Fully deterministic tax optimization analysis with lot-by-lot action recommendations
 */
export function optimizeTaxLossHarvesting(
	taxLots: TaxLotInput[],
	ytdGains: YearToDateCapitalGains = { realizedStcg: 0, realizedLtcg: 0 },
	customAsOfDate?: string,
): TlhOptimizationResult {
	const asOfDate = customAsOfDate ? new Date(customAsOfDate) : new Date();
	const timestamp = asOfDate.toISOString();

	let totalInvested = 0;
	let currentValue = 0;
	let unrealizedStclTotal = 0;
	let unrealizedLtclTotal = 0;

	const recommendations: HarvestRecommendation[] = [];

	// 1. Process each tax lot
	for (const lot of taxLots) {
		const cost = lot.buyPrice * lot.quantity;
		const val = lot.currentPrice * lot.quantity;
		const gainLoss = val - cost;

		totalInvested += cost;
		currentValue += val;

		const days = getHoldingDays(lot.buyDate, asOfDate);
		const isLongTerm = days > 365;
		const holdingType: "SHORT_TERM" | "LONG_TERM" = isLongTerm ? "LONG_TERM" : "SHORT_TERM";

		let action: "HARVEST_STCL" | "HARVEST_LTCL" | "REALIZE_EXEMPT_LTCG" | "HOLD" = "HOLD";
		let priority: "HIGH" | "MEDIUM" | "LOW" | "NONE" = "NONE";
		let estimatedTaxSaved = 0;
		let rationale = "";

		const proxy = lot.proxyAlternativeSymbol || SECTOR_PROXY_MAP[lot.symbol.toUpperCase()] || "NIFTYBEES";

		if (gainLoss < -100) {
			const lossAmount = Math.abs(gainLoss);
			if (!isLongTerm) {
				// Short Term Capital Loss (offsets 20% STCG)
				action = "HARVEST_STCL";
				estimatedTaxSaved = +(lossAmount * INDIAN_TAX_RATES_2024.stcgRate).toFixed(2);
				unrealizedStclTotal += lossAmount;

				if (ytdGains.realizedStcg > 0) {
					priority = "HIGH";
					rationale = `Harvest short-term loss of ₹${lossAmount.toLocaleString("en-IN")}. Directly offsets realized STCG, saving ₹${estimatedTaxSaved.toLocaleString("en-IN")} in taxes @ 20%. Reinvest in ${proxy} to maintain sector exposure.`;
				} else {
					priority = "MEDIUM";
					rationale = `Harvest short-term loss of ₹${lossAmount.toLocaleString("en-IN")} to carry forward up to 8 AYs or offset future FY gains. Reinvest in ${proxy}.`;
				}
			} else {
				// Long Term Capital Loss (offsets 12.5% LTCG)
				action = "HARVEST_LTCL";
				estimatedTaxSaved = +(lossAmount * INDIAN_TAX_RATES_2024.ltcgRate).toFixed(2);
				unrealizedLtclTotal += lossAmount;

				if (ytdGains.realizedLtcg > INDIAN_TAX_RATES_2024.ltcgExemptionLimit) {
					priority = "HIGH";
					rationale = `Harvest long-term loss of ₹${lossAmount.toLocaleString("en-IN")}. Offsets taxable LTCG above ₹1.25L threshold, saving ₹${estimatedTaxSaved.toLocaleString("en-IN")} @ 12.5%. Reinvest in ${proxy}.`;
				} else {
					priority = "LOW";
					rationale = `Long-term loss of ₹${lossAmount.toLocaleString("en-IN")}. Set off against future LTCG; carry forward for up to 8 assessment years.`;
				}
			}
		} else if (isLongTerm && gainLoss > 500) {
			// Opportunity: Realize gain tax-free if below remaining ₹1.25L LTCG threshold
			const unusedExemption = Math.max(
				0,
				INDIAN_TAX_RATES_2024.ltcgExemptionLimit - (ytdGains.availableLtcgExemptionUsed ?? ytdGains.realizedLtcg),
			);
			if (gainLoss <= unusedExemption) {
				action = "REALIZE_EXEMPT_LTCG";
				priority = "MEDIUM";
				estimatedTaxSaved = +(gainLoss * INDIAN_TAX_RATES_2024.ltcgRate).toFixed(2);
				rationale = `Tax-Free Gain Opportunity: Realize ₹${gainLoss.toLocaleString("en-IN")} LTCG within the annual ₹1.25L exemption limit at 0% tax, resetting cost basis to ₹${lot.currentPrice}.`;
			} else {
				action = "HOLD";
				priority = "NONE";
				rationale = `Long-term compounder: Unrealized gain of ₹${gainLoss.toLocaleString("en-IN")}. Exceeds exemption limit; defer realization to compound tax-deferred.`;
			}
		} else {
			action = "HOLD";
			priority = "NONE";
			rationale = "Lot within normal variance. No tax harvesting action warranted.";
		}

		recommendations.push({
			lotId: lot.lotId,
			symbol: lot.symbol,
			assetType: lot.assetType,
			holdingPeriodDays: days,
			holdingType,
			unrealizedGainLoss: +gainLoss.toFixed(2),
			action,
			priority,
			estimatedTaxSaved,
			recommendedProxySymbol: action.startsWith("HARVEST") ? proxy : undefined,
			rationale,
		});
	}

	// 2. Compute Net FY Tax Position Before vs. After Harvesting
	const currentStcgTax = Math.max(0, ytdGains.realizedStcg) * INDIAN_TAX_RATES_2024.stcgRate;
	const taxableLtcgBefore = Math.max(0, ytdGains.realizedLtcg - INDIAN_TAX_RATES_2024.ltcgExemptionLimit);
	const currentLtcgTax = taxableLtcgBefore * INDIAN_TAX_RATES_2024.ltcgRate;
	const taxLiabilityBefore = +(currentStcgTax + currentLtcgTax).toFixed(2);

	// After harvesting losses: STCL offsets STCG first, then remaining offsets LTCG
	const netStcgAfter = Math.max(0, ytdGains.realizedStcg - unrealizedStclTotal);
	const remainingStcl = Math.max(0, unrealizedStclTotal - ytdGains.realizedStcg);

	const netLtcgAfter = Math.max(0, taxableLtcgBefore - unrealizedLtclTotal - remainingStcl);
	const taxLiabilityAfter = +(
		netStcgAfter * INDIAN_TAX_RATES_2024.stcgRate +
		netLtcgAfter * INDIAN_TAX_RATES_2024.ltcgRate
	).toFixed(2);

	const netImmediateTaxSaved = +(taxLiabilityBefore - taxLiabilityAfter).toFixed(2);
	const potentialTaxSavingsTotal = +(
		unrealizedStclTotal * INDIAN_TAX_RATES_2024.stcgRate +
		unrealizedLtclTotal * INDIAN_TAX_RATES_2024.ltcgRate
	).toFixed(2);

	// Sort recommendations by priority (HIGH first, then MEDIUM, then LOW)
	const priorityOrder: Record<string, number> = { HIGH: 1, MEDIUM: 2, LOW: 3, NONE: 4 };
	recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

	return {
		engine_version: TLH_ENGINE_VERSION,
		calculation_timestamp: timestamp,
		portfolioSummary: {
			totalInvested: +totalInvested.toFixed(2),
			currentValue: +currentValue.toFixed(2),
			totalUnrealizedGainLoss: +(currentValue - totalInvested).toFixed(2),
			unrealizedStclTotal: +unrealizedStclTotal.toFixed(2),
			unrealizedLtclTotal: +unrealizedLtclTotal.toFixed(2),
			potentialTaxSavingsTotal,
		},
		taxPositionCurrentFY: {
			taxLiabilityBeforeHarvesting: taxLiabilityBefore,
			taxLiabilityAfterHarvesting: taxLiabilityAfter,
			netImmediateTaxSaved,
		},
		recommendations,
		inputs_used: {
			lotsCount: taxLots.length,
			currentDate: asOfDate.toISOString().split("T")[0],
			ytdRealizedStcg: ytdGains.realizedStcg,
			ytdRealizedLtcg: ytdGains.realizedLtcg,
		},
		formula_applied:
			"TLH_INDIA_2024 = STCL * 0.20 + LTCL * 0.125 | STCL_offset(STCG, LTCG) | LTCL_offset(LTCG > 1.25L)",
		intermediate_steps: {
			stcgTaxOffsetPotential: +(unrealizedStclTotal * INDIAN_TAX_RATES_2024.stcgRate).toFixed(2),
			ltcgTaxOffsetPotential: +(unrealizedLtclTotal * INDIAN_TAX_RATES_2024.ltcgRate).toFixed(2),
			unusedLtcgExemption: Math.max(0, INDIAN_TAX_RATES_2024.ltcgExemptionLimit - ytdGains.realizedLtcg),
		},
		disclaimer:
			"FASP-AI v1.0 Tax Advisory Notice: Tax-loss harvesting recommendations are decision support tools for SEBI RIAs and Chartered Accountants. Calculations reflect Finance Act 2024 rates and require client confirmation prior to execution.",
	};
}
