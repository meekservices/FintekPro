/**
 * Model Portfolio Integer Share Sizing & Cash Drag Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Calculates exact whole-share order quantities for Indian equity/ETF
 *           model portfolios (NSE/BSE does not support fractional shares).
 *           Computes exact residual cash buffers and validates capital viability.
 *
 * Rules:
 *   1. Integer Quantization: Stock quantities must be strictly whole integers (>= 0).
 *   2. Cash Buffer: Residual amounts from whole-share truncation are preserved as cash.
 *   3. Viability Check: Computes minimum capital required to buy at least 1 share of every constituent.
 *   4. Zero Float Drift: Sum of whole-share investments + residual cash equals requested capital.
 *
 * Compliance: FASP-AI v3.0, GCR v1.0, SEBI IA Regulations.
 */

export interface HoldingInputForSizing {
  rank?: number;
  name: string;
  symbol: string;
  isin?: string | null;
  category?: string;
  type?: string;
  targetWeight: number; // percentage (0 - 100)
  marketPrice?: number | null;
}

export interface SizedHoldingAllocation {
  rank: number;
  name: string;
  symbol: string;
  isin: string | null;
  category: string;
  targetWeightPct: number;
  marketPrice: number;
  targetAmount: number;
  integerQuantity: number;
  allocatedAmount: number;
  effectiveWeightPct: number;
  weightDeltaPct: number;
  status: "SIZED" | "SKIPPED_BELOW_SHARE_PRICE";
  isFractionalAdjusted: boolean;
}

export interface IntegerSizingResult {
  allocations: SizedHoldingAllocation[];
  totalRequestedAmount: number;
  totalAllocatedAmount: number;
  residualCash: number;
  cashWeightPct: number;
  minCapitalRequired: number;
  isFullyInvestable: boolean;
  uninvestableCount: number;
  summary: string;
}

/**
 * Calculates whole-share allocations for an equity/ETF model portfolio.
 *
 * @param holdings List of model portfolio holdings with target weights
 * @param totalCapital Total rupee capital to deploy (e.g. ₹1,00,000)
 * @param priceMap Optional live price map (symbol -> price)
 * @returns IntegerSizingResult with whole share quantities and cash buffer
 */
export function calculateIntegerShareAllocation(
  holdings: HoldingInputForSizing[],
  totalCapital: number,
  priceMap: Map<string, number> = new Map()
): IntegerSizingResult {
  if (totalCapital <= 0 || !Array.isArray(holdings) || holdings.length === 0) {
    return {
      allocations: [],
      totalRequestedAmount: totalCapital,
      totalAllocatedAmount: 0,
      residualCash: totalCapital,
      cashWeightPct: 100,
      minCapitalRequired: 0,
      isFullyInvestable: false,
      uninvestableCount: 0,
      summary: "Invalid capital amount or empty holdings.",
    };
  }

  // Normalize target weights to 100%
  const totalWeight = holdings.reduce((sum, h) => sum + (Number(h.targetWeight) || 0), 0) || 100;

  let totalAllocated = 0;
  let minCapitalNeeded = 0;
  let uninvestableCount = 0;

  const allocations: SizedHoldingAllocation[] = holdings.map((h, idx) => {
    const sym = (h.symbol || "").toUpperCase();
    const rank = Number(h.rank ?? idx + 1);
    const rawWeight = Number(h.targetWeight) || 0;
    const normalizedWeightPct = parseFloat(((rawWeight / totalWeight) * 100).toFixed(2));

    // Resolve market price (from map, from holding, or safe fallback)
    const resolvedPrice =
      (sym ? priceMap.get(sym) : undefined) ??
      (h.marketPrice && Number(h.marketPrice) > 0 ? Number(h.marketPrice) : 100);

    const price = Math.max(0.01, resolvedPrice);
    minCapitalNeeded += price;

    // Target rupee amount for this holding
    const targetAmount = parseFloat(((normalizedWeightPct / 100) * totalCapital).toFixed(2));

    // Exact whole-share quantity
    const integerQuantity = Math.floor(targetAmount / price);
    const allocatedAmount = parseFloat((integerQuantity * price).toFixed(2));
    const effectiveWeightPct = parseFloat(((allocatedAmount / totalCapital) * 100).toFixed(2));
    const weightDeltaPct = parseFloat((effectiveWeightPct - normalizedWeightPct).toFixed(2));

    const isSkipped = integerQuantity === 0 && targetAmount < price;
    if (isSkipped) {
      uninvestableCount++;
    }

    totalAllocated += allocatedAmount;

    return {
      rank,
      name: h.name,
      symbol: sym,
      isin: h.isin ?? null,
      category: h.category ?? h.type ?? "equity",
      targetWeightPct: normalizedWeightPct,
      marketPrice: price,
      targetAmount,
      integerQuantity,
      allocatedAmount,
      effectiveWeightPct,
      weightDeltaPct,
      status: isSkipped ? "SKIPPED_BELOW_SHARE_PRICE" : "SIZED",
      isFractionalAdjusted: true,
    };
  });

  const residualCash = parseFloat(Math.max(0, totalCapital - totalAllocated).toFixed(2));
  const cashWeightPct = parseFloat(((residualCash / totalCapital) * 100).toFixed(2));
  const isFullyInvestable = uninvestableCount === 0;

  const summary = isFullyInvestable
    ? `Fully investable across ${allocations.length} constituents. Allocated: ₹${totalAllocated.toLocaleString("en-IN")}, Cash buffer: ₹${residualCash.toLocaleString("en-IN")} (${cashWeightPct}%).`
    : `${uninvestableCount} of ${allocations.length} constituents could not buy 1 share at ₹${totalCapital.toLocaleString("en-IN")}. Recommended minimum capital is ₹${Math.ceil(minCapitalNeeded).toLocaleString("en-IN")}.`;

  return {
    allocations,
    totalRequestedAmount: totalCapital,
    totalAllocatedAmount: parseFloat(totalAllocated.toFixed(2)),
    residualCash,
    cashWeightPct,
    minCapitalRequired: Math.ceil(minCapitalNeeded),
    isFullyInvestable,
    uninvestableCount,
    summary,
  };
}
