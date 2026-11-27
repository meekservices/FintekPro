import type { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export const CROSS_ASSET_AGENT_VERSION = "1.1.0";
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

// Regex to identify AMC / Sponsor brands in India for funds and ETFs
const AMC_BRAND_REGEX =
	/\b(sbi|hdfc|icici\s+prudential|icici\s+pru|icici|kotak\s+mahindra|kotak|axis|nippon\s+india|nippon|aditya\s+birla(\s+sun\s+life)?|absl|uti|mirae\s+asset|mirae|dsp|tata|edelweiss|motilal\s+oswal|bandhan|franklin(\s+templeton)?|sundaram|hsbc|canara\s+robeco|baroda\s+bnp\s+paribas|invesco|quant|pgim\s+india|union|mahindra\s+manulife|groww|zerodha|navi)\b/gi;

// Patterns order matters:
// 1. Explicit sector indices must match before broad_index (e.g. banknifty, nifty it)
// 2. Broad market index (Sensex, Nifty 50, Nifty 100, Midcap, Smallcap, Large Cap)
// 3. Broad sector themes
const THEME_PATTERNS: ReadonlyArray<{ theme: string; pattern: RegExp }> = [
	// Explicit sector indices must match before broad_index
	{ theme: "banking_financials", pattern: /\b(banknifty|bankbees|nifty\s*bank|psu\s*bank|private\s*bank)\b/i },
	{ theme: "it_technology", pattern: /\b(nifty\s*it|itbees|nasdaq|tech\s*etf)\b/i },
	{ theme: "precious_metals", pattern: /\b(gold|silver|sgb|goldbees|silverbees)\b/i },

	// Broad market index (Sensex, Nifty 50, Nifty 100, Midcap, Smallcap, Large Cap, etc.)
	{
		theme: "broad_index",
		pattern:
			/\b(sensex|bse\s*sensex|nifty\s*50|nifty\s*100|nifty\s*200|nifty\s*500|nifty\s*next\s*50|nifty\s*total\s*market|niftybees|bse\s*100|bse\s*500|large\s*cap|large\s*&\s*mid\s*cap|large\s*and\s*mid\s*cap|midcap|smallcap|flexi\s*cap|multi\s*cap|broad\s*market)\b/i,
	},

	// Broad sector themes
	{ theme: "banking_financials", pattern: /\b(bank|banking|financial|financials|nbfc|hdfc\s*bank|icici\s*bank|axis\s*bank|kotak\s*bank|state\s*bank)\b/i },
	{ theme: "it_technology", pattern: /\b(it|tech|technology|software|infy|tcs|wipro|hcl|semiconductor|ai)\b/i },
	{ theme: "energy_oil_gas", pattern: /\b(energy|oil|gas|crude|natural gas|ongc|reliance|bpcl|power)\b/i },
	{ theme: "pharma_healthcare", pattern: /\b(pharma|health|healthcare|sunpharma|cipla|drreddy|sequent|hospital)\b/i },
	{ theme: "auto_ev", pattern: /\b(auto|ev|automobile|motors|maruti|tata motors|mahindra|bajaj auto)\b/i },
	{ theme: "metals_mining", pattern: /\b(metal|steel|copper|aluminium|zinc|tata steel|hindalco|jsw)\b/i },
];

/**
 * Normalizes a pick's sector, symbol, and instrument name into a canonical cross-asset theme.
 *
 * Purpose: Map heterogeneous category labels into shared exposure buckets.
 * Inputs: Pick candidate (`DailyPickData`).
 * Outputs: Canonical theme key string.
 * Edge cases:
 *  - Strips AMC sponsor prefixes for ETFs & Mutual Funds so index/asset theme is evaluated.
 *  - Market-neutral / delta-neutral option selling strategies map to "derivatives_market_neutral".
 *  - Falls back to normalized `sectorCategory` or `category` when no keyword matches.
 */
export function resolveCrossAssetTheme(
	pick: Pick<DailyPickData, "category" | "instrumentName" | "symbol" | "sectorCategory" | "keyMetrics">,
): string {
	// 1. Detect delta-neutral / market-neutral derivative strategies
	if (pick.category === "derivatives") {
		const km = pick.keyMetrics as Record<string, unknown> | undefined;
		const strategyName = String(km?.strategy || pick.instrumentName || "");
		const outlook = String(km?.outlook || "");
		const strategyType = String(km?.strategyType || "");
		const isMarketNeutral =
			outlook.toLowerCase() === "neutral" ||
			strategyType.toUpperCase() === "SELLER" ||
			/\b(iron\s+butterfly|iron\s+condor|short\s+straddle|short\s+strangle|long\s+straddle|long\s+strangle|calendar\s+spread|market\s+neutral)\b/i.test(
				strategyName,
			);

		if (isMarketNeutral) {
			return "derivatives_market_neutral";
		}
	}

	// 2. Prepare haystack with AMC branding stripped for funds/ETFs
	let cleanInstrument = pick.instrumentName ?? "";
	let cleanSymbol = pick.symbol ?? "";

	if (pick.category === "etfs" || pick.category === "mutual_funds") {
		cleanInstrument = cleanInstrument.replace(AMC_BRAND_REGEX, " ").trim();
		cleanSymbol = cleanSymbol.replace(/^(sbi|hdfc|icici|kotak|axis|nippon|uti)/i, "");
	}

	const haystack = [
		pick.sectorCategory ?? "",
		(pick.keyMetrics as Record<string, unknown> | undefined)?.broadSectorLabel ?? "",
		cleanSymbol,
		cleanInstrument,
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
	const isMarketNeutral = normalizedTheme === "derivatives_market_neutral";

	const matchingPicks = acceptedPicks.filter((p) => {
		if (exemptCategories.has(p.category as PickCategory)) return false;
		return resolveCrossAssetTheme(p) === normalizedTheme;
	});

	const matchingInstruments = matchingPicks.map((p) => `${p.instrumentName} (${p.category})`);
	const existingThemeCount = matchingPicks.length;

	// Never allow more than `maxThemeExposure` picks on the same directional theme
	// (except broad_index and derivatives_market_neutral which allow higher diversity).
	const effectiveCap =
		normalizedTheme === "broad_index" || isMarketNeutral
			? maxThemeExposure + 1
			: maxThemeExposure;
	const isExempt = exemptCategories.has(candidate.category as PickCategory) || isMarketNeutral;

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
