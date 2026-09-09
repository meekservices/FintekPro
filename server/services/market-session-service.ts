/**
 * Market Session Service
 *
 * Authoritative source for NSE/BSE trading session windows.
 * Implements the Closing Auction Session (CAS) introduced August 3, 2026
 * for F&O-eligible equity stocks in the cash segment.
 *
 * Exchange Circulars:
 *   NSE: NSE/COMP/2026/XXXX (August 2026)
 *   BSE: BSE Notice No. 20260803-XX (August 2026)
 *
 * GCR-compliant: structured logs, engine_version, no autonomous trade execution.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

export const MARKET_SESSION_VERSION = "market-session-v2.0-CAS-Aug2026-PreOpen-Sep2026";


// ---------------------------------------------------------------------------
// Session timing constants (all times in IST, 24-hour)
// ---------------------------------------------------------------------------

/**
 * NSE/BSE market session boundaries effective August 3, 2026.
 *
 * For F&O-ELIGIBLE stocks:
 *   Pre-open:          09:00 – 09:15
 *   Continuous (CTS):  09:15 – 15:15  ← CTS end moved from 15:30 to 15:15
 *   CAS Transition:    15:15 – 15:20  (reference price calc, no orders)
 *   CAS Order Entry:   15:20 – 15:25  (limit + market orders)
 *   CAS Limit-Only:    15:25 – 15:30  (limit orders only; random close in last 2 min)
 *   CAS Matching:      15:30 – 15:35  (matching & confirmation)
 *   F&O Extended:      15:35 – 15:40  (F&O derivatives only)
 *   Closed:            after 15:40
 *
 * For NON-F&O stocks (unchanged):
 *   Continuous (CTS):  09:15 – 15:30
 *   VWAP Close:        15:30 (based on last 30-min VWAP)
 *   Closed:            after 15:30
 *
 * CAS Price Band: ±3% from reference price (VWAP of 15:00–15:15 trades).
 * Orders outside ±3% are rejected by the exchange.
 * Stop-loss, IOC, and disclosed-quantity orders are NOT permitted in CAS.
 */
export const MARKET_SESSIONS = {
	PRE_OPEN: { startHHMM: "09:00", endHHMM: "09:15" },

	// For F&O stocks
	CONTINUOUS_FNO: { startHHMM: "09:15", endHHMM: "15:15" },
	CAS_TRANSITION: { startHHMM: "15:15", endHHMM: "15:20" },  // No order entry
	CAS_ORDER_ENTRY: { startHHMM: "15:20", endHHMM: "15:25" }, // Limit + market
	CAS_LIMIT_ONLY: { startHHMM: "15:25", endHHMM: "15:30" },  // Limit only
	CAS_MATCHING: { startHHMM: "15:30", endHHMM: "15:35" },    // Matching phase
	FNO_EXTENDED: { startHHMM: "15:35", endHHMM: "15:40" },    // F&O derivatives only

	// For non-F&O stocks (unchanged)
	CONTINUOUS_NON_FNO: { startHHMM: "09:15", endHHMM: "15:30" },

	/**
	 * CAS effective date — do not apply CAS logic for dates before this.
	 */
	CAS_EFFECTIVE_DATE: new Date("2026-08-03T00:00:00+05:30"),

	/**
	 * CAS price band: ±3% from reference VWAP (15:00–15:15)
	 */
	CAS_PRICE_BAND_PCT: 3,

	/**
	 * Order types NOT permitted during CAS window
	 */
	CAS_PROHIBITED_ORDER_TYPES: ["stop_loss", "ioc", "disclosed_quantity"] as const,
} as const;

// ---------------------------------------------------------------------------
// Pre-open Call Auction Session Phases (effective September 7, 2026)
// ---------------------------------------------------------------------------
// Per NSE Circular (Sep 2026) — two-phase restructure to reduce price distortion
// from late-arriving market orders.
//
// Phase 1: 09:00–09:05 — Market AND limit orders accepted
// Phase 2: 09:05–09:10 — Limit orders ONLY
// Matching:  09:10–09:15 — Matching & price determination (no new orders)
//
// ALSO new (Sep 7, 2026): Gold & Silver ETFs now participate in pre-open
// call auction (SEBI/HO/47/11/11(1)2026-MRD-POD3/I/13804/2026)
// ---------------------------------------------------------------------------

export const PRE_OPEN_SESSIONS = {
	PHASE_1: { startHHMM: "09:00", endHHMM: "09:05", ordersAllowed: ["market", "limit"] as const },
	PHASE_2: { startHHMM: "09:05", endHHMM: "09:10", ordersAllowed: ["limit"] as const },
	MATCHING: { startHHMM: "09:10", endHHMM: "09:15", ordersAllowed: [] as const },
	/** Effective date of pre-open two-phase restructure */
	EFFECTIVE_DATE: new Date("2026-09-07T00:00:00+05:30"),
} as const;

export type PreOpenPhase = "phase1" | "phase2" | "matching" | null;


export type MarketSession =
	| "pre_open"
	| "continuous"
	| "cas_transition"
	| "cas_order_entry"
	| "cas_limit_only"
	| "cas_matching"
	| "fno_extended"
	| "closed";


// ---------------------------------------------------------------------------
// Time helper: convert HH:MM string to minutes-since-midnight
// ---------------------------------------------------------------------------
function toMinutes(hhmm: string): number {
	const [hh, mm] = hhmm.split(":").map(Number);
	return hh * 60 + mm;
}

function nowISTMinutes(): number {
	const now = new Date();
	// IST = UTC + 5:30 = UTC + 330 minutes
	const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
	return (utcMinutes + 330) % (24 * 60);
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Determine the current NSE/BSE market session for a given stock.
 *
 * @param isFnoEligible - Whether the stock has active F&O contracts
 * @param nowIST        - Optional: override current time (for testing)
 * @returns MarketSession
 *
 * GCR: This function is purely informational — it NEVER executes trades.
 */
export function getMarketSession(
	isFnoEligible: boolean,
	nowIST?: Date,
): MarketSession {
	const now = nowIST ?? new Date();

	// CAS session rules only apply after August 3, 2026
	const casActive = now >= MARKET_SESSIONS.CAS_EFFECTIVE_DATE;

	const mins = nowIST
		? nowIST.getHours() * 60 + nowIST.getMinutes()
		: nowISTMinutes();

	const PRE_OPEN_START = toMinutes(MARKET_SESSIONS.PRE_OPEN.startHHMM);
	const PRE_OPEN_END = toMinutes(MARKET_SESSIONS.PRE_OPEN.endHHMM);
	const CTS_START = PRE_OPEN_END; // 09:15

	if (mins < PRE_OPEN_START || mins >= toMinutes("15:40")) {
		return "closed";
	}
	if (mins < PRE_OPEN_END) return "pre_open";

	if (!isFnoEligible || !casActive) {
		// Non-F&O stocks: continuous until 15:30, then closed
		return mins < toMinutes("15:30") ? "continuous" : "closed";
	}

	// F&O stocks with CAS active
	if (mins < toMinutes("15:15")) return "continuous";
	if (mins < toMinutes("15:20")) return "cas_transition";
	if (mins < toMinutes("15:25")) return "cas_order_entry";
	if (mins < toMinutes("15:30")) return "cas_limit_only";
	if (mins < toMinutes("15:35")) return "cas_matching";
	if (mins < toMinutes("15:40")) return "fno_extended";
	return "closed";
}

/**
 * Returns true if the current time falls within any phase of the CAS window
 * (transition, order entry, limit-only, or matching) for F&O stocks.
 *
 * Use this to apply caution flags on signals/picks for F&O-eligible stocks.
 */
export function isClosingAuctionWindow(nowIST?: Date): boolean {
	const session = getMarketSession(true, nowIST);
	return (
		session === "cas_transition" ||
		session === "cas_order_entry" ||
		session === "cas_limit_only" ||
		session === "cas_matching"
	);
}

/**
 * Check whether a stock is eligible for the Closing Auction Session
 * by looking up the `has_fno_contract` flag in the `listed_stocks` table.
 *
 * Caches per request — no global in-memory cache (Cloud Run stateless).
 *
 * @param symbol - NSE/BSE stock symbol
 */
export async function isStockCASEligible(symbol: string): Promise<boolean> {
	try {
		const rows = await db.execute(
			sql`SELECT has_fno_contract FROM listed_stocks WHERE symbol = ${symbol} AND is_active = true LIMIT 1`,
		);
		// Cast through unknown first to satisfy TS strict overlap check (TS2352)
		const row = (rows as unknown as { rows: { has_fno_contract: boolean }[] }).rows?.[0];
		return row?.has_fno_contract === true;
	} catch (err: unknown) {
		// Non-fatal: default to false (conservative — don't block anything)
		logger.warn("[MarketSessionService] Failed to check has_fno_contract", {
			symbol,
			error: err instanceof Error ? err.message : String(err),
		});
		return false;
	}
}

/**
 * Returns a human-readable description of the current market session
 * for display in UI/adviser dashboards.
 */
export function describeMarketSession(session: MarketSession): string {
	const descriptions: Record<MarketSession, string> = {
		pre_open: "Pre-open session (09:00–09:15 IST)",
		continuous: "Continuous trading session",
		cas_transition:
			"Closing Auction transition (15:15–15:20 IST) — reference price calculation, no orders",
		cas_order_entry:
			"Closing Auction — order entry open (15:20–15:25 IST), limit & market orders allowed",
		cas_limit_only:
			"Closing Auction — limit orders only (15:25–15:30 IST), random system closure",
		cas_matching:
			"Closing Auction — order matching & confirmation (15:30–15:35 IST)",
		fno_extended:
			"F&O extended session (15:35–15:40 IST) — derivatives only",
		closed: "Market closed",
	};
	return descriptions[session];
}

/**
 * CAS caution disclaimer for signals/picks generated during the auction window.
 * Must be surfaced to advisers and investors per FASP-AI v1.0 disclosure rules.
 */
export const CAS_WINDOW_DISCLAIMER =
	"⚠️ This stock is in the NSE/BSE Closing Auction Session (3:15–3:35 PM IST). " +
	"The final closing price is being determined via competitive auction and may differ " +
	"significantly from the current last traded price. " +
	"Stop-loss, IOC, and disclosed-quantity orders are not permitted during this window. " +
	"(NSE/BSE Circular, effective August 3, 2026)";

// ---------------------------------------------------------------------------
// Pre-Open Phase API (Sep 7, 2026 two-phase restructure)
// ---------------------------------------------------------------------------

/**
 * Returns the current pre-open session phase for NSE/BSE.
 *
 * Phases (effective Sep 7, 2026):
 *   phase1  — 09:00–09:05 IST: market + limit orders accepted
 *   phase2  — 09:05–09:10 IST: limit orders only
 *   matching — 09:10–09:15 IST: matching & price determination, no new orders
 *   null    — not in pre-open window (or framework not yet effective)
 *
 * @param nowIST - Optional time override for testing
 * GCR: Informational only — never executes orders.
 */
export function getPreOpenPhase(nowIST?: Date): PreOpenPhase {
	const now = nowIST ?? new Date();

	// Only apply two-phase structure from Sep 7, 2026 onwards
	if (now < PRE_OPEN_SESSIONS.EFFECTIVE_DATE) return null;

	const mins = nowIST
		? nowIST.getHours() * 60 + nowIST.getMinutes()
		: nowISTMinutes();

	const PHASE1_START = toMinutes(PRE_OPEN_SESSIONS.PHASE_1.startHHMM); // 540 (09:00)
	const PHASE1_END   = toMinutes(PRE_OPEN_SESSIONS.PHASE_1.endHHMM);   // 545 (09:05)
	const PHASE2_END   = toMinutes(PRE_OPEN_SESSIONS.PHASE_2.endHHMM);   // 550 (09:10)
	const MATCH_END    = toMinutes(PRE_OPEN_SESSIONS.MATCHING.endHHMM);  // 555 (09:15)

	if (mins < PHASE1_START || mins >= MATCH_END) return null;
	if (mins < PHASE1_END)  return "phase1";
	if (mins < PHASE2_END)  return "phase2";
	return "matching";
}

/**
 * Human-readable description of the current pre-open phase.
 * Returns null when not in pre-open.
 */
export function describePreOpenPhase(phase: PreOpenPhase): string | null {
	if (!phase) return null;
	const descriptions: Record<NonNullable<PreOpenPhase>, string> = {
		phase1:   "Pre-open Phase 1 (09:00–09:05 IST) — Market & limit orders accepted",
		phase2:   "Pre-open Phase 2 (09:05–09:10 IST) — Limit orders only",
		matching: "Pre-open Matching (09:10–09:15 IST) — Price determination, no new orders",
	};
	return descriptions[phase];
}

export const PRE_OPEN_PHASE_DISCLAIMER =
	"ℹ️ The pre-open session is now two-phase (NSE/BSE, effective Sep 7, 2026): " +
	"Phase 1 (09:00–09:05): market + limit orders. " +
	"Phase 2 (09:05–09:10): limit orders only. " +
	"Matching (09:10–09:15): price determination — no new orders accepted.";

