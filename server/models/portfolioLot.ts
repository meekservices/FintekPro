/**
 * AUTHORITATIVE FIX: PortfolioLot is a FIRST-CLASS ENTITY
 *
 * Golden Rule: Holdings are DERIVED from lots — never the other way around.
 * Each purchase/SIP/switch-in = one legally distinct tax lot.
 *
 * The CAS is LOT-NATIVE. Example (DSP Healthcare):
 * - 07-Oct-2024: 4,974.876 units @ ₹40.20 = Lot 1
 * - 29-Oct-2024: 4,966.475 units @ ₹40.27 = Lot 2
 *
 * These are two legally distinct tax lots with different holding periods.
 */
export interface PortfolioLot {
	id: string;
	isin: string;
	schemeName: string;
	amc: string;
	folio: string;

	transactionDate: Date; // 🔴 MANDATORY - determines tax treatment
	transactionDateStr: string; // Original string format (DD-Mon-YYYY)
	transactionType: "PURCHASE" | "SIP" | "SWITCH_IN" | "BONUS" | "REINVESTMENT";

	units: number;
	nav: number;
	amount: number;

	stampDuty?: number;
	description?: string;
	source: "CAS";
}

/**
 * Derive holdings FROM LOTS (NOT vice-versa)
 * AUTHORITATIVE: This is the only valid way to aggregate holdings
 */
export interface DerivedHolding {
	isin: string;
	schemeName: string;
	amc: string;
	folio: string;
	lots: PortfolioLot[];

	// Derived from lots
	totalUnits: number;
	totalAmount: number;
	avgCostPerUnit: number;
	lotCount: number;
	lotSummary: string;

	// First lot date (for reference, NOT for tax calculation)
	firstPurchaseDate: Date | null;
}
