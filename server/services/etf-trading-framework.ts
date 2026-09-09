/**
 * ETF Revised Trading Framework — FintekPro
 *
 * Implements SEBI Circular: SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026
 * Effective Date: September 7, 2026
 * (Original circular dated June 15, 2026; implementation extended from Sep 1 → Sep 7)
 *
 * Key Changes vs. pre-Sep-7 framework:
 *  1. Base price: T-2 NAV replaced by previous-day last-30-min VWAP (with LTP / NAV fallbacks)
 *  2. Price bands: Uniform ±20% replaced by category-specific dynamic bands
 *  3. Pre-open call auction: Gold & Silver ETFs now participate (9:00–9:15 AM IST)
 *  4. Close-out procedure: Category-specific (higher of highest market price or +5% of auction-day settlement)
 *  5. Future transition: T-1 closing NAV as base price anchor from April 1, 2027
 *
 * GCR: structured logs, engine_version, no autonomous trade execution.
 */

import { logger } from "../logger";

// ── Version ──────────────────────────────────────────────────────────────────

export const ETF_FRAMEWORK_VERSION = "etf-framework-v2.0-SEBI-Sep2026";
export const ETF_FRAMEWORK_CIRCULAR = "SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026";
export const ETF_FRAMEWORK_EFFECTIVE = new Date("2026-09-07T00:00:00+05:30");

// ── ETF Category Classification ───────────────────────────────────────────────

/**
 * ETF categories as defined by SEBI 2026 trading framework.
 * Determines price band, pre-open participation, and close-out rules.
 */
export type ETFPriceCategory =
	| "equity_debt"   // Equity & Debt ETFs
	| "commodity"     // Gold & Silver (Commodity) ETFs
	| "liquid"        // Liquid & Overnight ETFs
	| "unknown";

// ── Price Band Configuration ──────────────────────────────────────────────────

export interface ETFPriceBandConfig {
	/** Initial dynamic price band percentage (±%) */
	initialBandPct: number;
	/** Step size for band expansion (%) */
	expansionStepPct: number;
	/** Maximum band percentage — null = no cap */
	maxBandPct: number | null;
	/** Whether a cooling-off period applies before expansion */
	coolingOffMinutes: number | null;
	/** Whether band is fixed (no expansion) */
	isFixed: boolean;
	/** Human-readable description of the band rule */
	description: string;
}

/**
 * Category-wise ETF price bands effective September 7, 2026.
 * Replaces the former uniform ±20% band for all ETFs.
 *
 * Source: SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026
 */
export const ETF_PRICE_BANDS: Record<ETFPriceCategory, ETFPriceBandConfig> = {
	equity_debt: {
		initialBandPct:    10,
		expansionStepPct:  5,
		maxBandPct:        20,
		coolingOffMinutes: 15,   // 15-min cooling-off pause before band widens
		isFixed:           false,
		description:
			"Equity & Debt ETFs: initial ±10% band, expands in 5% steps up to ±20% with 15-min cooling-off. " +
			"(SEBI Sep 2026 ETF Framework)",
	},
	commodity: {
		initialBandPct:    6,
		expansionStepPct:  3,
		maxBandPct:        null,  // No upper cap for extreme commodity moves
		coolingOffMinutes: null,
		isFixed:           false,
		description:
			"Gold & Silver ETFs: initial ±6% band, expands in 3% steps — no upper cap. " +
			"(SEBI Sep 2026 ETF Framework)",
	},
	liquid: {
		initialBandPct:    5,
		expansionStepPct:  0,
		maxBandPct:        5,
		coolingOffMinutes: null,
		isFixed:           true,
		description:
			"Liquid & Overnight ETFs: fixed ±5% band (no expansion). " +
			"(SEBI Sep 2026 ETF Framework)",
	},
	unknown: {
		initialBandPct:    10,    // Default to equity_debt rules when category unclear
		expansionStepPct:  5,
		maxBandPct:        20,
		coolingOffMinutes: 15,
		isFixed:           false,
		description:
			"ETF category unknown — applying equity/debt band rules as a conservative default.",
	},
};

// ── Base Price Methodology ────────────────────────────────────────────────────

/**
 * ETF base price determination priority order (Sep 7, 2026).
 * Replaces the former T-2 NAV anchor.
 *
 * Priority:
 *  1. PRIMARY  — Previous trading day's last-30-min VWAP
 *  2. SECONDARY — Previous trading day's Last Traded Price (LTP) — if no last-30-min trades
 *  3. TERTIARY  — Latest available closing NAV — if no trades on previous day
 *
 * Future: From April 1, 2027, transitions to T-1 closing NAV as primary anchor.
 */
export type BasePriceSource = "vwap_30min" | "ltp" | "nav" | "unknown";

export interface ETFBasePrice {
	price: number;
	source: BasePriceSource;
	/** ISO date string of the reference trading day */
	referenceDate: string;
	/** Explanatory note for audit/display */
	note: string;
}

/**
 * Resolves the base price for an ETF from available data sources.
 * Implements the SEBI Sep 2026 priority order.
 *
 * @param prevDayVwap30Min  - VWAP of last 30 min of previous trading day (null if unavailable)
 * @param prevDayLtp        - Last Traded Price on previous trading day (null if no trades)
 * @param latestNav         - Latest available closing NAV
 * @param referenceDate     - ISO date string of the reference (previous) trading day
 */
export function resolveETFBasePrice(
	prevDayVwap30Min: number | null,
	prevDayLtp: number | null,
	latestNav: number | null,
	referenceDate: string,
): ETFBasePrice {
	if (prevDayVwap30Min != null && prevDayVwap30Min > 0) {
		return {
			price: prevDayVwap30Min,
			source: "vwap_30min",
			referenceDate,
			note: `Base price: prev-day last-30-min VWAP (SEBI Sep 2026 framework, primary anchor). ` +
				`Effective from Sep 7, 2026; transitions to T-1 NAV on Apr 1, 2027.`,
		};
	}
	if (prevDayLtp != null && prevDayLtp > 0) {
		logger.warn("[ETFFramework] Using LTP fallback for base price — no last-30-min VWAP data", {
			referenceDate,
			event: "ETF_BASE_PRICE_FALLBACK_LTP",
		});
		return {
			price: prevDayLtp,
			source: "ltp",
			referenceDate,
			note: "Base price: prev-day LTP fallback (no last-30-min trades). SEBI Sep 2026 framework.",
		};
	}
	if (latestNav != null && latestNav > 0) {
		logger.warn("[ETFFramework] Using NAV fallback for base price — no prev-day trades", {
			referenceDate,
			event: "ETF_BASE_PRICE_FALLBACK_NAV",
		});
		return {
			price: latestNav,
			source: "nav",
			referenceDate,
			note: "Base price: latest NAV fallback (no prev-day trades). SEBI Sep 2026 framework.",
		};
	}

	// Shouldn't reach here in normal ops — log and return 0 for upstream handling
	logger.error("[ETFFramework] All base price sources unavailable for ETF", {
		referenceDate,
		event: "ETF_BASE_PRICE_UNAVAILABLE",
		error_code: "ETF_PRICE_ANCHOR_MISSING",
		retryable: true,
	});
	return {
		price: 0,
		source: "unknown",
		referenceDate,
		note: "Base price unavailable — all SEBI-prescribed sources returned no data.",
	};
}

// ── ETF Category Detection ────────────────────────────────────────────────────

/**
 * Classify an ETF into a SEBI 2026 price category from its name.
 * Used to determine the applicable price band and pre-open rules.
 *
 * @param name - ETF instrument name
 */
export function classifyETFPriceCategory(name: string): ETFPriceCategory {
	if (!name) return "unknown";
	const lower = name.toLowerCase();

	// Commodity: Gold and Silver ETFs
	if (lower.includes("gold") || lower.includes("silver")) return "commodity";

	// Liquid: Liquid and Overnight ETFs
	if (
		lower.includes("liquid") ||
		lower.includes("overnight") ||
		lower.includes("money market")
	)
		return "liquid";

	// All other ETFs (Equity, Debt, Hybrid, Index, Sectoral, International, etc.)
	return "equity_debt";
}

// ── Pre-Open Call Auction ─────────────────────────────────────────────────────

/**
 * Returns whether an ETF category participates in the pre-open call auction
 * (9:00–9:15 AM IST) under the Sep 7, 2026 framework.
 *
 * NEW (Sep 2026): Commodity ETFs (Gold/Silver) now participate.
 * Unchanged: Equity/Debt ETFs always participated; Liquid ETFs do NOT participate.
 */
export function participatesInPreOpenAuction(category: ETFPriceCategory): boolean {
	switch (category) {
		case "equity_debt":
			return true;   // Equity/Debt — always participated, unchanged
		case "commodity":
			return true;   // NEW as of Sep 7, 2026
		case "liquid":
			return false;  // Liquid/Overnight — not in pre-open auction
		default:
			return true;   // Default to equity_debt rules
	}
}

// ── Close-out Pricing ─────────────────────────────────────────────────────────

/**
 * Compute the ETF close-out price per SEBI Sep 2026 framework.
 * Used when trade obligations cannot be met (settlement failure).
 *
 * Close-out price = HIGHER of:
 *   (a) Highest market price of the ETF on the auction day
 *   (b) 5% above the auction-day settlement price
 *
 * @param highestMarketPrice    - Highest traded price on auction day
 * @param auctionSettlementPrice - Settlement price on auction day
 */
export function computeETFCloseoutPrice(
	highestMarketPrice: number,
	auctionSettlementPrice: number,
): { closeoutPrice: number; basis: "highest_market" | "settlement_plus_5pct" } {
	const settlementPlus5 = auctionSettlementPrice * 1.05;
	if (highestMarketPrice >= settlementPlus5) {
		return { closeoutPrice: highestMarketPrice, basis: "highest_market" };
	}
	return { closeoutPrice: settlementPlus5, basis: "settlement_plus_5pct" };
}

// ── Advisory Disclaimers ──────────────────────────────────────────────────────

/**
 * Category-specific regulatory disclaimers for ETF picks/signals.
 * Must be surfaced to advisers and investors per FASP-AI v1.0 disclosure rules.
 */
export const ETF_FRAMEWORK_DISCLAIMERS: Record<ETFPriceCategory, string> = {
	equity_debt:
		"ℹ️ Price band: ±10% from previous day's 30-min VWAP (expandable to ±20%). " +
		"Reference price is based on VWAP, not T-2 NAV. " +
		"(SEBI ETF Framework, effective Sep 7, 2026 — Circular SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026)",

	commodity:
		"⚠️ Gold/Silver ETF — price band: ±6% from previous day's 30-min VWAP (expandable in 3% steps, no upper cap). " +
		"Participates in pre-open call auction (9:00–9:15 AM IST). " +
		"(SEBI ETF Framework, effective Sep 7, 2026 — Circular SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026)",

	liquid:
		"ℹ️ Liquid/Overnight ETF — fixed price band: ±5%. " +
		"Does NOT participate in pre-open call auction. " +
		"(SEBI ETF Framework, effective Sep 7, 2026 — Circular SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026)",

	unknown:
		"ℹ️ ETF price band: ±10% from previous day's 30-min VWAP (default equity/debt band applied). " +
		"(SEBI ETF Framework, effective Sep 7, 2026 — Circular SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026)",
};

/**
 * Generic ETF framework notice — use when a specific category is not yet determined.
 */
export const ETF_FRAMEWORK_GENERAL_DISCLAIMER =
	"ℹ️ SEBI revised ETF trading framework effective Sep 7, 2026: " +
	"price bands are now category-specific (Equity/Debt ±10%, Gold/Silver ±6%, Liquid ±5%). " +
	"Base price = previous day's last-30-min VWAP (not T-2 NAV). " +
	"Circular: SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026";

// ── Framework Active Check ────────────────────────────────────────────────────

/**
 * Returns true if the new SEBI ETF trading framework is active.
 * (Effective Sep 7, 2026 — safe to call from any code path.)
 */
export function isETFFrameworkActive(): boolean {
	return new Date() >= ETF_FRAMEWORK_EFFECTIVE;
}

// ── Aggregate Pick Metadata ───────────────────────────────────────────────────

/**
 * Build the regulatory metadata block to attach to an ETF pick's keyMetrics.
 * Designed for direct spread into the DailyPickData.keyMetrics object.
 *
 * @param etfName  - ETF instrument name (used for category detection)
 * @param basePriceSource - Source used for base price resolution (if known)
 */
export function buildETFRegulatoryMeta(
	etfName: string,
	basePriceSource?: BasePriceSource,
): {
	etfPriceCategory:          ETFPriceCategory;
	etfInitialBandPct:         number;
	etfMaxBandPct:             number | null;
	etfPreOpenAuction:         boolean;
	etfBasePriceMethod:        string;
	etfPriceBandNote:          string;
	etfFrameworkVersion:       string;
	etfCircularRef:            string;
	etfFrameworkEffective:     string;
} {
	const category = classifyETFPriceCategory(etfName);
	const band = ETF_PRICE_BANDS[category];

	const basePriceMethod = basePriceSource === "vwap_30min"
		? "prev-day last-30-min VWAP (primary)"
		: basePriceSource === "ltp"
			? "prev-day LTP (fallback — no 30-min trades)"
			: basePriceSource === "nav"
				? "latest closing NAV (fallback — no prev-day trades)"
				: "prev-day last-30-min VWAP (expected primary)";

	return {
		etfPriceCategory:      category,
		etfInitialBandPct:     band.initialBandPct,
		etfMaxBandPct:         band.maxBandPct,
		etfPreOpenAuction:     participatesInPreOpenAuction(category),
		etfBasePriceMethod:    basePriceMethod,
		etfPriceBandNote:      ETF_FRAMEWORK_DISCLAIMERS[category],
		etfFrameworkVersion:   ETF_FRAMEWORK_VERSION,
		etfCircularRef:        ETF_FRAMEWORK_CIRCULAR,
		etfFrameworkEffective: ETF_FRAMEWORK_EFFECTIVE.toISOString(),
	};
}
