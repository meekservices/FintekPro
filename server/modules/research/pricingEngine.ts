import type { FinancialData } from "./dataService";

export interface PriceTarget {
  peBased: number | null;
  pbBased: number | null;
  blended: number | null;
  upside: number | null;
  targetPE: number | null;
  targetPB: number | null;
  bear: number | null;
  base: number | null;
  bull: number | null;
  method: string;
}

export function computePriceTarget(f: FinancialData): PriceTarget {
  const empty: PriceTarget = {
    peBased: null, pbBased: null, blended: null, upside: null,
    targetPE: null, targetPB: null, bear: null, base: null, bull: null,
    method: "N/A",
  };

  const price = f.price;
  if (!price) return empty;

  let peBased: number | null = null;
  let targetPE: number | null = null;

  if (f.eps && f.eps > 0 && f.pe && f.pe > 0) {
    if (f.pe < 15) targetPE = 18;
    else if (f.pe <= 25) targetPE = f.pe;
    else targetPE = 25;
    peBased = Math.round(f.eps * targetPE);
  }

  let pbBased: number | null = null;
  let targetPB: number | null = null;
  const bv = (f as any).bookValue as number | null;

  if (bv && bv > 0) {
    const roe = f.roe ?? 0;
    if (roe > 0.20) targetPB = 3.0;
    else if (roe > 0.15) targetPB = 2.5;
    else if (roe > 0.10) targetPB = 2.0;
    else targetPB = 1.5;
    pbBased = Math.round(bv * targetPB);
  }

  let blended: number | null = null;
  let method = "N/A";

  if (peBased !== null && pbBased !== null) {
    blended = Math.round(peBased * 0.6 + pbBased * 0.4);
    method = "Blended (60% PE + 40% PB)";
  } else if (peBased !== null) {
    blended = peBased;
    method = "PE-Based";
  } else if (pbBased !== null) {
    blended = pbBased;
    method = "PB-Based";
  }

  if (blended === null) return empty;

  const upside = Math.round(((blended - price) / price) * 100 * 10) / 10;

  return {
    peBased,
    pbBased,
    blended,
    upside,
    targetPE,
    targetPB,
    bear: Math.round(blended * 0.85),
    base: blended,
    bull: Math.round(blended * 1.15),
    method,
  };
}

export function computePEG(pe: number | null, earningsGrowth: number | null): number | null {
  if (!pe || !earningsGrowth || earningsGrowth <= 0) return null;
  const growthPct = earningsGrowth * 100;
  if (growthPct <= 0) return null;
  return Math.round((pe / growthPct) * 100) / 100;
}
