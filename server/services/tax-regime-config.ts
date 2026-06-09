// @ts-nocheck
/**
 * Centralized Tax Regime Configuration
 *
 * SINGLE SOURCE OF TRUTH for all capital gains tax rates, thresholds,
 * exemptions, and surcharge rules across the platform.
 *
 * All services (capital-gains-calculator, lot-tax-calculator, proposal-capital-gains)
 * MUST import tax rules from this module. No hardcoded rates elsewhere.
 *
 * Finance Act 2024 (enacted July 23, 2024): Debt fund rates (STCG slab rate,
 * LTCG 12.5%, 730-day threshold) are now enacted law — no longer provisional.
 * Budget 2025-26: New regime slabs revised for AY 2026-27, 87A rebate ₹60,000.
 */

export const TAX_REGIME_VERSION = "2025-02-01-v1";

export const BUDGET_2024_EFFECTIVE_DATE = new Date("2024-07-23");

export const GRANDFATHERING_DATE = new Date("2018-01-31");

export const INDEXATION_CUTOFF_DATE = new Date("2023-04-01");

export const CESS_RATE = 0.04;

export const GRANDFATHERING_FMV_APPRECIATION_ESTIMATE = 0.4;

export type TaxAssetClass =
	| "equity"
	| "debt"
	| "hybrid_equity"
	| "hybrid_debt"
	| "gold"
	| "international"
	| "liquid"
	| "overnight"
	| "elss"
	| "index"
	| "sectoral"
	| "unknown";

export interface TaxRateRule {
	stcg: number;
	ltcg: number;
	ltcgExemption: number;
	ltcgThresholdDays: number;
	isProvisional: boolean;
	provisionalNote?: string;
}

export const POST_BUDGET_2024_RATES: Record<TaxAssetClass, TaxRateRule> = {
	equity: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 125000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	hybrid_equity: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 125000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	elss: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 125000,
		ltcgThresholdDays: 1095,
		isProvisional: false,
	},
	index: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 125000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	sectoral: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 125000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	debt: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 0,
		ltcgThresholdDays: 730,
		isProvisional: false,
	},
	hybrid_debt: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 0,
		ltcgThresholdDays: 730,
		isProvisional: false,
	},
	liquid: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 0,
		ltcgThresholdDays: 730,
		isProvisional: false,
	},
	overnight: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 0,
		ltcgThresholdDays: 730,
		isProvisional: false,
	},
	gold: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 0,
		ltcgThresholdDays: 730,
		isProvisional: false,
	},
	international: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 0,
		ltcgThresholdDays: 730,
		isProvisional: false,
	},
	unknown: {
		stcg: 0.2,
		ltcg: 0.125,
		ltcgExemption: 125000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
};

export const PRE_BUDGET_2024_RATES: Record<string, TaxRateRule> = {
	equity: {
		stcg: 0.15,
		ltcg: 0.1,
		ltcgExemption: 100000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	hybrid_equity: {
		stcg: 0.15,
		ltcg: 0.1,
		ltcgExemption: 100000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	elss: {
		stcg: 0.15,
		ltcg: 0.1,
		ltcgExemption: 100000,
		ltcgThresholdDays: 1095,
		isProvisional: false,
	},
	index: {
		stcg: 0.15,
		ltcg: 0.1,
		ltcgExemption: 100000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	sectoral: {
		stcg: 0.15,
		ltcg: 0.1,
		ltcgExemption: 100000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
	debt: {
		stcg: 0.3,
		ltcg: 0.3,
		ltcgExemption: 0,
		ltcgThresholdDays: Number.POSITIVE_INFINITY,
		isProvisional: false,
	},
	hybrid_debt: {
		stcg: 0.3,
		ltcg: 0.3,
		ltcgExemption: 0,
		ltcgThresholdDays: Number.POSITIVE_INFINITY,
		isProvisional: false,
	},
	liquid: {
		stcg: 0.3,
		ltcg: 0.3,
		ltcgExemption: 0,
		ltcgThresholdDays: Number.POSITIVE_INFINITY,
		isProvisional: false,
	},
	overnight: {
		stcg: 0.3,
		ltcg: 0.3,
		ltcgExemption: 0,
		ltcgThresholdDays: Number.POSITIVE_INFINITY,
		isProvisional: false,
	},
	gold: {
		stcg: 0.3,
		ltcg: 0.2,
		ltcgExemption: 0,
		ltcgThresholdDays: 1095,
		isProvisional: false,
	},
	international: {
		stcg: 0.3,
		ltcg: 0.3,
		ltcgExemption: 0,
		ltcgThresholdDays: Number.POSITIVE_INFINITY,
		isProvisional: false,
	},
	unknown: {
		stcg: 0.15,
		ltcg: 0.1,
		ltcgExemption: 100000,
		ltcgThresholdDays: 365,
		isProvisional: false,
	},
};

export const SURCHARGE_SLABS = [
	{ min: 0, max: 5000000, rate: 0 },
	{ min: 5000000, max: 10000000, rate: 0.1 },
	{ min: 10000000, max: 20000000, rate: 0.15 },
	{ min: 20000000, max: 50000000, rate: 0.25 },
	{ min: 50000000, max: Number.POSITIVE_INFINITY, rate: 0.37 },
];

export const COST_INFLATION_INDEX: Record<string, number> = {
	"2001-02": 100,
	"2002-03": 105,
	"2003-04": 109,
	"2004-05": 113,
	"2005-06": 117,
	"2006-07": 122,
	"2007-08": 129,
	"2008-09": 137,
	"2009-10": 148,
	"2010-11": 167,
	"2011-12": 184,
	"2012-13": 200,
	"2013-14": 220,
	"2014-15": 240,
	"2015-16": 254,
	"2016-17": 264,
	"2017-18": 272,
	"2018-19": 280,
	"2019-20": 289,
	"2020-21": 301,
	"2021-22": 317,
	"2022-23": 331,
	"2023-24": 348,
	"2024-25": 363,
	"2025-26": 377,
};

export function getTaxRegime(
	transactionDate: Date = new Date(),
): "PRE_BUDGET_2024" | "POST_BUDGET_2024" {
	return transactionDate >= BUDGET_2024_EFFECTIVE_DATE
		? "POST_BUDGET_2024"
		: "PRE_BUDGET_2024";
}

export function getTaxRatesForAsset(
	assetClass: TaxAssetClass,
	transactionDate: Date = new Date(),
): TaxRateRule {
	const regime = getTaxRegime(transactionDate);
	const rates =
		regime === "POST_BUDGET_2024"
			? POST_BUDGET_2024_RATES
			: PRE_BUDGET_2024_RATES;
	return rates[assetClass] || rates.unknown;
}

export function isSlabBased(
	assetClass: TaxAssetClass,
	transactionDate: Date = new Date(),
): boolean {
	const regime = getTaxRegime(transactionDate);
	if (regime === "PRE_BUDGET_2024") {
		return [
			"debt",
			"hybrid_debt",
			"liquid",
			"overnight",
			"international",
		].includes(assetClass);
	}
	return false;
}

export function calculateSurcharge(
	taxAmount: number,
	totalGains: number,
): number {
	const applicableSlab = SURCHARGE_SLABS.find(
		(slab) => totalGains >= slab.min && totalGains < slab.max,
	);
	if (!applicableSlab || applicableSlab.rate === 0) return 0;
	const effectiveRate = Math.min(applicableSlab.rate, 0.15);
	return taxAmount * effectiveRate;
}

export function getProvisionalDisclaimer(
	assetClasses: TaxAssetClass[],
): string | null {
	const provisionalClasses = assetClasses.filter((ac) => {
		const rule = POST_BUDGET_2024_RATES[ac];
		return rule?.isProvisional;
	});
	if (provisionalClasses.length === 0) return null;
	return DEBT_PROVISIONAL_NOTE;
}

export function getFiscalYear(date: Date): string {
	const month = date.getMonth();
	const year = date.getFullYear();
	if (month >= 3) {
		return `${year}-${(year + 1).toString().slice(-2)}`;
	}
	return `${year - 1}-${year.toString().slice(-2)}`;
}

export function getCII(fiscalYear: string): number {
	return COST_INFLATION_INDEX[fiscalYear] || COST_INFLATION_INDEX["2025-26"];
}
