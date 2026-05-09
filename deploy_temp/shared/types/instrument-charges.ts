/**
 * Instrument Charge Classification System
 * =========================================
 * Formalizes the taxonomy of exit-like charges across all asset classes in FintekPro.
 * 
 * REGULATORY CONTEXT:
 * - SEBI: Exit load applies ONLY to open-ended mutual fund schemes (Regulation 52(7) of SEBI MF Regulations)
 * - RBI: FD premature withdrawal penalties are NOT exit loads — they are contractual penalties
 * - IRDAI: ULIP surrender charges are separate from exit load concept
 * - AMFI: Exit load data published per scheme via AMFI portal
 * 
 * EXIT LOAD APPLICABILITY MATRIX:
 * ┌─────────────────────┬──────────────┬─────────────────────────────────────────────────┐
 * │ Instrument          │ Charge Type  │ Notes                                           │
 * ├─────────────────────┼──────────────┼─────────────────────────────────────────────────┤
 * │ Mutual Fund (MF)    │ EXIT_LOAD    │ SEBI-regulated. Varies by scheme/category.      │
 * │ ELSS (Tax Saver MF) │ LOCK_IN      │ 3-year mandatory lock-in. No exit load.         │
 * │ Stock / Equity      │ NONE         │ No exit load. STT + brokerage only.             │
 * │ ETF                 │ NONE         │ Exchange-traded. No exit load. Brokerage only.   │
 * │ Bond / NCD          │ NONE         │ No exit load. May have lock-in period.           │
 * │ FD                  │ PREMATURE    │ Premature withdrawal penalty. Not exit load.     │
 * │ SGB (Gold Bond)     │ LOCK_IN      │ 5-year lock-in, early exit after yr 5 at RBI.   │
 * │ Digital Gold        │ NONE         │ No exit load. Spread/premium applies.            │
 * │ PMS                 │ CONTRACTUAL  │ Fund manager-specific exit fees. Not SEBI MF.    │
 * │ AIF                 │ CONTRACTUAL  │ Lock-in per PPM terms. Not standard exit load.   │
 * │ Insurance / ULIP    │ SURRENDER    │ IRDAI surrender charges. Not exit load.          │
 * │ REIT                │ NONE         │ Exchange-traded. No exit load.                   │
 * │ InvIT               │ NONE         │ Exchange-traded. No exit load.                   │
 * │ MLD                 │ LOCK_IN      │ Listed but illiquid. Lock-in per issue terms.    │
 * │ IPO                 │ NONE         │ Post-listing: exchange-traded. No exit load.     │
 * │ Unlisted Equity     │ NONE         │ No exit load. Illiquidity premium applies.       │
 * └─────────────────────┴──────────────┴─────────────────────────────────────────────────┘
 */

export enum ChargeType {
  EXIT_LOAD = 'EXIT_LOAD',
  LOCK_IN = 'LOCK_IN',
  SURRENDER_CHARGE = 'SURRENDER_CHARGE',
  PREMATURE_WITHDRAWAL_PENALTY = 'PREMATURE_WITHDRAWAL_PENALTY',
  CONTRACTUAL_EXIT_FEE = 'CONTRACTUAL_EXIT_FEE',
  NONE = 'NONE'
}

export const INSTRUMENT_CHARGE_MAP: Record<string, ChargeType> = {
  'mutual_fund': ChargeType.EXIT_LOAD,
  'mf': ChargeType.EXIT_LOAD,
  'elss': ChargeType.LOCK_IN,
  'equity': ChargeType.NONE,
  'stock': ChargeType.NONE,
  'etf': ChargeType.NONE,
  'bond': ChargeType.NONE,
  'ncd': ChargeType.NONE,
  'fd': ChargeType.PREMATURE_WITHDRAWAL_PENALTY,
  'gold': ChargeType.NONE,
  'sgb': ChargeType.LOCK_IN,
  'digital_gold': ChargeType.NONE,
  'pms': ChargeType.CONTRACTUAL_EXIT_FEE,
  'aif': ChargeType.CONTRACTUAL_EXIT_FEE,
  'insurance': ChargeType.SURRENDER_CHARGE,
  'ulip': ChargeType.SURRENDER_CHARGE,
  'reit': ChargeType.NONE,
  'invit': ChargeType.NONE,
  'mld': ChargeType.LOCK_IN,
  'ipo': ChargeType.NONE,
  'unlisted': ChargeType.NONE,
  'other': ChargeType.NONE
};

export function getChargeType(productType: string): ChargeType {
  const key = (productType || '').toLowerCase().replace(/[\s-]/g, '_');
  return INSTRUMENT_CHARGE_MAP[key] ?? ChargeType.NONE;
}

export function isExitLoadApplicable(productType: string): boolean {
  return getChargeType(productType) === ChargeType.EXIT_LOAD;
}

export const EXIT_LOAD_ELIGIBLE_TYPES = new Set([
  'mutual_fund', 'mf', 'mutual fund'
]);

export function isMutualFund(productType: string): boolean {
  const pt = (productType || '').toLowerCase().trim();
  return EXIT_LOAD_ELIGIBLE_TYPES.has(pt);
}
