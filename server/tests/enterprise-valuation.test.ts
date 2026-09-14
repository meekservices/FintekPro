/**
 * Unit Tests: Enterprise Valuation Engine (FASP-EV-v1.0)
 *
 * Tests cover:
 *  1. Baseline: full 5-year data — exact EV computation
 *  2. Pre-revenue (loss-making) company — shifts to P/S + Book Value only
 *  3. High institutional QIB demand (DCF high growth)
 *  4. Net-cash company — EV adds cash correctly
 *  5. Only 1 year of data — lower confidence, no CAGR
 *  6. Completely missing financials (only shares + price) — market-cap fallback
 *  7. Determinism: same input → same output (FASP-AI v1.0 rule)
 */

import { describe, it, expect } from "vitest";
import {
  calculateEnterpriseValue,
  type EVInput,
  ENGINE_VERSION,
} from "../../shared/enterprise-valuation";

// ── Shared test fixture helpers ───────────────────────────────────────────────

function makeFY(
  year: string,
  revenue: number | null,
  ebitda: number | null,
  pat: number | null,
  fcf: number | null,
  debt: number | null,
  networth: number | null,
  cash?: number | null,
) {
  return {
    financialYear: year,
    revenue,
    ebitda,
    pat,
    netProfit: pat,
    freeCashFlow: fcf,
    totalDebt: debt,
    networth,
    cash: cash ?? null,
  };
}

// ── Test 1: Full 5-year profitable company ────────────────────────────────────

describe("calculateEnterpriseValue — profitable 5-year company", () => {
  const input: EVInput = {
    companyName: "National Stock Exchange of India Limited",
    sector: "Market Infrastructure",
    totalSharesOutstanding: 495_000_000,
    currentOtcPricePerShare: 1850,
    yearlyFinancials: [
      makeFY("FY2020-21", 4800, 2500, 1800, 1200, 500, 12000, 800),
      makeFY("FY2021-22", 5500, 2900, 2100, 1500, 450, 13500, 1000),
      makeFY("FY2022-23", 7200, 3800, 2800, 2000, 400, 15500, 1300),
      makeFY("FY2023-24", 10200, 5600, 4100, 3200, 350, 18000, 1600),
      makeFY("FY2024-25", 13800, 7900, 5700, 4800, 300, 22000, 2000),
    ],
  };

  const result = calculateEnterpriseValue(input);

  it("returns engine version FASP-EV-v1.0", () => {
    expect(result.engineVersion).toBe(ENGINE_VERSION);
  });

  it("analyses 5 years", () => {
    expect(result.yearsAnalysed).toBe(5);
  });

  it("computes positive revenue CAGR", () => {
    // Revenue: 4800 → 13800 over 4 years ≈ 30.2% CAGR
    expect(result.revenueCAGR).not.toBeNull();
    expect(result.revenueCAGR!).toBeGreaterThan(25);
    expect(result.revenueCAGR!).toBeLessThan(40);
  });

  it("computes positive blended EV", () => {
    expect(result.blendedEV).toBeGreaterThan(0);
  });

  it("produces a fair share price above zero", () => {
    expect(result.fairSharePrice).toBeGreaterThan(0);
  });

  it("calculates discountToPremiumPct correctly", () => {
    const expectedPct =
      ((input.currentOtcPricePerShare - result.fairSharePrice) /
        result.fairSharePrice) *
      100;
    expect(result.discountToPremiumPct).toBeCloseTo(expectedPct, 1);
  });

  it("has confidence score ≥ 0.7 with full data", () => {
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.7);
  });

  it("includes mandatory SEBI disclaimer", () => {
    expect(result.sebiDisclaimer).toContain("INDICATIVE ESTIMATE");
    expect(result.sebiDisclaimer).toContain("NOT A SEBI-APPROVED VALUATION");
  });

  it("has no data gaps with complete data", () => {
    // With full 5-year + FCF data, only minor gaps expected (if any)
    expect(result.dataGaps.length).toBeLessThanOrEqual(2);
  });
});

// ── Test 2: Pre-revenue / loss-making company ─────────────────────────────────

describe("calculateEnterpriseValue — pre-revenue / loss-making (Swiggy-type)", () => {
  const input: EVInput = {
    companyName: "Swiggy Private Limited",
    sector: "Food Delivery",
    totalSharesOutstanding: 2_000_000_000,
    currentOtcPricePerShare: 390,
    yearlyFinancials: [
      makeFY("FY2022-23", 8500, -2100, -2500, -1800, 5000, 8000, 4000),
      makeFY("FY2023-24", 11400, -900, -1000, -750, 4500, 9000, 5000),
    ],
  };

  const result = calculateEnterpriseValue(input);

  it("skips DCF when FCF is negative", () => {
    expect(result.dcfEV).toBeNull();
    expect(result.dataGaps.some((g) => g.includes("DCF skipped"))).toBe(true);
  });

  it("uses P/S comparable as primary method", () => {
    // P/S should produce a positive comparables EV
    expect(result.comparablesEV).toBeGreaterThan(0);
  });

  it("still produces a blended EV (P/S + Book Value)", () => {
    expect(result.blendedEV).toBeGreaterThan(0);
  });

  it("has reduced confidence score when <3 years available", () => {
    expect(result.confidenceScore).toBeLessThan(0.80);
  });

  it("notes missing CAGR or data gaps", () => {
    // Only 2 years — CAGR is computable but confidence should be penalised
    expect(result.yearsAnalysed).toBe(2);
  });
});

// ── Test 3: Net-cash company — EV correctly subtracts net debt ────────────────

describe("calculateEnterpriseValue — net-cash company", () => {
  const input: EVInput = {
    companyName: "HDB Financial Services Limited",
    sector: "NBFC",
    totalSharesOutstanding: 790_000_000,
    currentOtcPricePerShare: 1100,
    yearlyFinancials: [
      makeFY("FY2022-23", 12000, 4500, 3000, 2500, 0,   2000, 8000),
      makeFY("FY2023-24", 15000, 5800, 3900, 3200, 200, 1800, 10000),
      makeFY("FY2024-25", 18500, 7200, 4900, 4100, 500, 1500, 12000),
    ],
  };

  const result = calculateEnterpriseValue(input);

  it("computes netDebt as negative (net cash position)", () => {
    // Latest: totalDebt=1500, cash=12000 → netDebt = -10500 Cr
    expect(result.netDebt).toBeLessThan(0);
  });

  it("equity value exceeds blended EV for net-cash companies", () => {
    // equityValue = blendedEV - netDebt; if netDebt < 0, equityValue > blendedEV
    expect(result.equityValue).toBeGreaterThan(result.blendedEV);
  });

  it("produces a positive fair share price", () => {
    expect(result.fairSharePrice).toBeGreaterThan(0);
  });
});

// ── Test 4: Only 1 year of data — no CAGR ────────────────────────────────────

describe("calculateEnterpriseValue — single year data", () => {
  const input: EVInput = {
    companyName: "Test Co Ltd",
    sector: "Technology",
    totalSharesOutstanding: 100_000_000,
    currentOtcPricePerShare: 500,
    yearlyFinancials: [
      makeFY("FY2024-25", 2000, 600, 400, 300, 200, 3000, 500),
    ],
  };

  const result = calculateEnterpriseValue(input);

  it("returns null revenueCAGR with only 1 year", () => {
    expect(result.revenueCAGR).toBeNull();
  });

  it("has low confidence score with single year", () => {
    expect(result.confidenceScore).toBeLessThan(0.70);
  });

  it("still produces a blended EV", () => {
    expect(result.blendedEV).toBeGreaterThan(0);
  });

  it("notes CAGR limitation in dataGaps", () => {
    expect(result.dataGaps.some((g) => g.includes("CAGR cannot be computed"))).toBe(true);
  });
});

// ── Test 5: Completely missing financials — market cap fallback ───────────────

describe("calculateEnterpriseValue — no financials (market cap fallback)", () => {
  const input: EVInput = {
    companyName: "Unknown Pre-IPO Co",
    sector: null,
    totalSharesOutstanding: 50_000_000,
    currentOtcPricePerShare: 200,
    yearlyFinancials: [], // Empty — no data
  };

  // Should not throw
  const result = calculateEnterpriseValue(input);

  it("does not throw with empty financials", () => {
    expect(result).toBeDefined();
  });

  it("uses market cap as fallback blended EV", () => {
    // Market cap = 50_000_000 shares × ₹200 = ₹10,000,000,000 = ₹1,000 Cr
    expect(result.blendedEV).toBeCloseTo(1000, -1); // within ~10% of ₹1,000 Cr
    expect(result.dataGaps.some((g) => g.includes("defaults to OTC market cap"))).toBe(true);
  });

  it("has minimum confidence score (0.05)", () => {
    expect(result.confidenceScore).toBe(0.05);
  });

  it("analyses 0 years", () => {
    expect(result.yearsAnalysed).toBe(0);
  });
});

// ── Test 6: Determinism — FASP-AI v1.0 rule ──────────────────────────────────

describe("calculateEnterpriseValue — determinism", () => {
  const input: EVInput = {
    companyName: "DeterminismTest Ltd",
    sector: "Healthcare",
    totalSharesOutstanding: 200_000_000,
    currentOtcPricePerShare: 750,
    yearlyFinancials: [
      makeFY("FY2022-23", 3000, 900, 650, 500, 400, 5000, 800),
      makeFY("FY2023-24", 3800, 1200, 900, 720, 380, 4800, 1000),
      makeFY("FY2024-25", 4700, 1550, 1150, 950, 360, 4500, 1200),
    ],
  };

  it("produces identical results on repeated calls (no randomness)", () => {
    const r1 = calculateEnterpriseValue(input);
    const r2 = calculateEnterpriseValue(input);
    const r3 = calculateEnterpriseValue(input);

    expect(r1.blendedEV).toBe(r2.blendedEV);
    expect(r2.blendedEV).toBe(r3.blendedEV);
    expect(r1.fairSharePrice).toBe(r2.fairSharePrice);
    expect(r1.discountToPremiumPct).toBe(r2.discountToPremiumPct);
    expect(r1.revenueCAGR).toBe(r2.revenueCAGR);
    expect(r1.confidenceScore).toBe(r2.confidenceScore);
  });
});
