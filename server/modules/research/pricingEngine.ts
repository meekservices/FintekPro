import type { FinancialData } from "./dataService";

export interface PriceTarget {
	peBased: number | null;
	pbBased: number | null;
	consensusBased?: number | null;
	blended: number | null;
	upside: number | null;
	targetPE: number | null;
	targetPB: number | null;
	bear: number | null;
	base: number | null;
	bull: number | null;
	method: string;
	engine_version?: string;
	calculation_timestamp?: string;
}

export function computePriceTarget(f: FinancialData): PriceTarget {
	const empty: PriceTarget = {
		peBased: null,
		pbBased: null,
		consensusBased: null,
		blended: null,
		upside: null,
		targetPE: null,
		targetPB: null,
		bear: null,
		base: null,
		bull: null,
		method: "N/A",
		engine_version: "v1.2.0",
		calculation_timestamp: new Date().toISOString(),
	};

	const price = f.price;
	if (!price) return empty;

	let peBased: number | null = null;
	let targetPE: number | null = null;

	// Dynamic, growth-aware PE Target
	if (f.eps && f.eps > 0 && f.pe && f.pe > 0) {
		const roe = f.roe ?? 0;
		const growth = f.earningsGrowth ?? f.revenueGrowth ?? null;

		if (f.pe < 15) {
			targetPE = growth && growth > 0.1 ? 20 : 18;
		} else if (f.pe <= 30) {
			// Fair value band
			targetPE = Math.round(f.pe);
		} else {
			// Growth compounders: if ROE > 20% and growth > 15%, support sustainable premium multiple
			if (roe > 0.25 && growth && growth > 0.18) {
				targetPE = Math.min(45, Math.round(f.pe * 0.95));
			} else if (roe > 0.18 && growth && growth > 0.12) {
				targetPE = Math.min(35, Math.round(f.pe * 0.9));
			} else {
				// Reversion towards 28
				targetPE = 28;
			}
		}
		peBased = Math.round(f.eps * targetPE);
	}

	let pbBased: number | null = null;
	let targetPB: number | null = null;
	const bv = (f as any).bookValue as number | null;

	// BVPS Sanity Check: BVPS should not exceed 10x current price unless company is deeply distressed
	// and should not be total net worth (which would be 100x+ CMP)
	if (bv && bv > 0 && bv < price * 10) {
		const roe = f.roe ?? 0;
		if (roe > 0.3) targetPB = 6.0;
		else if (roe > 0.2) targetPB = 4.0;
		else if (roe > 0.15) targetPB = 2.8;
		else if (roe > 0.1) targetPB = 2.0;
		else targetPB = 1.4;
		pbBased = Math.round(bv * targetPB);
	}

	const consensusTarget = f.targetMeanPrice && f.targetMeanPrice > 0 ? f.targetMeanPrice : null;

	let blended: number | null = null;
	let method = "N/A";

	if (peBased !== null && pbBased !== null && consensusTarget !== null) {
		blended = Math.round(peBased * 0.45 + pbBased * 0.25 + consensusTarget * 0.3);
		method = "Blended (45% PE + 25% PB + 30% Consensus)";
	} else if (peBased !== null && pbBased !== null) {
		blended = Math.round(peBased * 0.6 + pbBased * 0.4);
		method = "Blended (60% PE + 40% PB)";
	} else if (peBased !== null && consensusTarget !== null) {
		blended = Math.round(peBased * 0.65 + consensusTarget * 0.35);
		method = "Blended (65% PE + 35% Consensus)";
	} else if (peBased !== null) {
		blended = peBased;
		method = "PE-Based";
	} else if (pbBased !== null) {
		blended = pbBased;
		method = "PB-Based";
	} else if (consensusTarget !== null) {
		blended = Math.round(consensusTarget);
		method = "Consensus Analyst Target";
	}

	if (blended === null) return empty;

	const upside = Math.round(((blended - price) / price) * 100 * 10) / 10;

	return {
		peBased,
		pbBased,
		consensusBased: consensusTarget,
		blended,
		upside,
		targetPE,
		targetPB,
		bear: Math.round(blended * 0.85),
		base: blended,
		bull: Math.round(blended * 1.15),
		method,
		engine_version: "v1.2.0",
		calculation_timestamp: new Date().toISOString(),
	};
}

export function computePEG(
	pe: number | null,
	earningsGrowth: number | null,
): number | null {
	if (!pe || !earningsGrowth || earningsGrowth <= 0) return null;
	const growthPct = earningsGrowth * 100;
	if (growthPct <= 0) return null;
	return Math.round((pe / growthPct) * 100) / 100;
}
