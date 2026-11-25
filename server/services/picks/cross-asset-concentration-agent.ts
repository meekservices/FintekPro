import type { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export const CROSS_ASSET_AGENT_VERSION = "1.0.0";
export const MAX_CROSS_ASSET_THEME_EXPOSURE = 2;

export interface CrossAssetCheckResult {
	allowed: boolean;
	normalizedTheme: string;
	existingThemeCount: number;
	matchingInstruments: string[];
	penaltyApplied: number;
	reason?: string;
	engine_version: string;
	calculation_timestamp: string;
}

const THEME_PATTERNS: ReadonlyArray<{ theme: string; pattern: RegExp }> = [
	{ theme: "banking_financials", pattern: /\b(bank|banking|financial|nbfc|psu bank|private bank|hdfc|icici|sbi|axis|kotak|bankbees|banknifty)\b/i },
	{ theme: "it_technology", pattern: /\b(it|tech|technology|software|infy|tcs|wipro|hcl|nasdaq|semiconductor|ai)\b/i },
	{ theme: "precious_metals", pattern: /\b(gold|silver|sgb|goldbees|silverbees)\b/i },
	{ theme: "energy_oil_gas", pattern: /\b(energy|oil|gas|crude|natural gas|ongc|reliance|bpcl|power)\b/i },
	{ theme: "pharma_healthcare", pattern: /\b(pharma|health|healthcare|sunpharma|cipla|drreddy|sequent|hospital)\b/i },
	{ theme: "auto_ev", pattern: /\b(auto|ev|automobile|motors|maruti|tata motors|mahindra|bajaj auto)\b/i },
	{ theme: "metals_mining", pattern: /\b(metal|steel|copper|aluminium|zinc|tata steel|hindalco|jsw)\b/i },
	{ theme: "broad_index", pattern: /\b(nifty|sensex|niftybees|midcap|smallcap|flexi cap|large cap)\b/i },
];

/**
 * Normalizes a pick's sector, symbol, and instrument name into a canonical cross-asset theme.
 *
 * Purpose: Map heterogeneous category labels into shared exposure buckets.
 * Inputs: Pick candidate (`DailyPickData`).
 * Outputs: Canonical theme key string.
 * Edge cases: Falls back to normalized `sectorCategory` or `category` when no keyword matches.
 */
export function resolveCrossAssetTheme(pick: Pick<DailyPickData, "category" | "instrumentName" | "symbol" | "sectorCategory" | "keyMetrics">): string {
	const haystack = [
		pick.sectorCategory ?? "",
		(pick.keyMetrics as Record<string, unknown> | undefined)?.broadSectorLabel ?? "",
		pick.symbol ?? "",
		pick.instrumentName ?? "",
	]
		.join(" ")
		.trim();

	for (const { theme, pattern } of THEME_PATTERNS) {
		if (pattern.test(haystack)) {
			return theme;
		}
	}

	const sector = (pick.sectorCategory || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
	return sector || String(pick.category);
}

/**
 * Cross-Asset Concentration Agent.
 *
 * Purpose: Prevent hidden multi-category concentration (e.g., Banking stock + Bank ETF + BankNifty derivative)
 *          on the same generation date while keeping diversified multi-asset picks intact.
 * Inputs: Candidate pick and list of picks already accepted in the current generation run.
 * Outputs: `CrossAssetCheckResult` with allow/block decision, theme count, and explainability metadata.
 * Edge cases: Fixed income (`bonds`, `fixed_deposits`) and `broad_index` allow higher diversity; exact symbol
 *             duplication across non-fixed-income categories is blocked.
 */
export function evaluateCrossAssetConcentration(
	candidate: DailyPickData,
	acceptedPicks: ReadonlyArray<DailyPickData>,
	maxThemeExposure: number = MAX_CROSS_ASSET_THEME_EXPOSURE,
): CrossAssetCheckResult {
	const calculation_timestamp = new Date().toISOString();
	const normalizedTheme = resolveCrossAssetTheme(candidate);

	const exemptCategories = new Set<PickCategory>(["bonds", "fixed_deposits"]);
	const matchingPicks = acceptedPicks.filter((p) => {
		if (exemptCategories.has(p.category as PickCategory)) return false;
		return resolveCrossAssetTheme(p) === normalizedTheme;
	});

	const matchingInstruments = matchingPicks.map((p) => `${p.instrumentName} (${p.category})`);
	const existingThemeCount = matchingPicks.length;

	// Never allow more than `maxThemeExposure` picks on the same directional theme
	// (except broad_index which can appear in index ETF + Nifty derivative).
	const effectiveCap = normalizedTheme === "broad_index" ? maxThemeExposure + 1 : maxThemeExposure;
	const isExempt = exemptCategories.has(candidate.category as PickCategory);

	if (!isExempt && existingThemeCount >= effectiveCap) {
		return {
			allowed: false,
			normalizedTheme,
			existingThemeCount,
			matchingInstruments,
			penaltyApplied: 0,
			reason: `Cross-asset concentration cap (${effectiveCap}) reached for theme '${normalizedTheme}' across [${matchingInstruments.join(", ")}]`,
			engine_version: CROSS_ASSET_AGENT_VERSION,
			calculation_timestamp,
		};
	}

	const penaltyApplied = !isExempt && existingThemeCount > 0 ? existingThemeCount * 2 : 0;

	return {
		allowed: true,
		normalizedTheme,
		existingThemeCount,
		matchingInstruments,
		penaltyApplied,
		engine_version: CROSS_ASSET_AGENT_VERSION,
		calculation_timestamp,
	};
}
