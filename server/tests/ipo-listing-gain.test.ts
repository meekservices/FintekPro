/**
 * @file ipo-listing-gain.test.ts
 * @description Unit tests for calculateIpoListingGain engine:
 *   - Mathematical precision of listing price & gain %
 *   - SEBI SME 90% listing day cap enforcement
 *   - Institutional QIB subscription elasticity multiplier
 *   - Mega-issue float overhang vs small-issue float scarcity
 *   - Post-tax net gains (Finance Act 2024 20% STCG)
 *   - Lottery allotment odds and Expected Monetary Value (EMV)
 *   - Determinism and edge-case handling (zero GMP, invalid inputs)
 */

import { describe, it, expect } from "vitest";
import { calculateIpoListingGain } from "../../shared/calculations";

describe("calculateIpoListingGain (FASP-IPO-v1.0)", () => {
  it("calculates basic mainboard listing gain accurately with neutral conditions", () => {
    const res = calculateIpoListingGain({
      issuePrice: 500,
      gmp: 100,
      lotSize: 30,
      issueSizeCrores: 1000,
      totalSubscription: 10,
      issueType: "mainboard",
    });

    expect(res.engineVersion).toBe("FASP-IPO-v1.0");
    expect(res.issuePrice).toBe(500);
    expect(res.rawGmp).toBe(100);
    expect(res.rawGmpPercent).toBe(20.0);
    expect(res.lotSize).toBe(30);
    expect(res.totalLotInvestment).toBe(15000);

    // Expected listing price should be ~600 (500 + 100) with minor size/subscription neutrality
    expect(res.expectedListingPrice).toBeGreaterThanOrEqual(590);
    expect(res.expectedListingPrice).toBeLessThanOrEqual(610);
    expect(res.expectedGrossGainPerLot).toBe(Math.round((res.expectedListingPrice - 500) * 30));

    // Net post-tax gain must reflect ~79.5% retention (20% STCG + charges)
    expect(res.expectedNetPostTaxGainPerLot).toBe(Math.round(res.expectedGrossGainPerLot * 0.795));

    // Bounds must encompass the base price
    expect(res.priceRange.bearishPrice).toBeLessThan(res.priceRange.basePrice);
    expect(res.priceRange.bullishPrice).toBeGreaterThan(res.priceRange.basePrice);
  });

  it("strictly enforces SEBI +90% listing cap on SME IPOs with extreme GMP", () => {
    // SME IPO with 150% raw GMP (issuePrice: 100, GMP: 150)
    const res = calculateIpoListingGain({
      issuePrice: 100,
      gmp: 150,
      lotSize: 1200,
      issueSizeCrores: 50,
      issueType: "sme",
      totalSubscription: 150,
    });

    // Should NOT allow +150% gain; must be capped at +90.0%
    expect(res.expectedListingGainPercent).toBe(90.0);
    expect(res.expectedListingPrice).toBe(190.0);
    expect(res.adjustments.regulatoryCapApplied).toBe(true);
    expect(res.priceRange.bullishPrice).toBeLessThanOrEqual(190.0);
  });

  it("expands expected listing gain when QIB subscription is euphoric (>50x)", () => {
    const neutralRes = calculateIpoListingGain({
      issuePrice: 400,
      gmp: 80, // 20% raw
      lotSize: 35,
      issueSizeCrores: 1000,
      qibSubscription: 10,
    });

    const highQibRes = calculateIpoListingGain({
      issuePrice: 400,
      gmp: 80, // 20% raw
      lotSize: 35,
      issueSizeCrores: 1000,
      qibSubscription: 95, // 95x institutional demand
    });

    expect(highQibRes.adjustments.qibMultiplier).toBeGreaterThan(neutralRes.adjustments.qibMultiplier);
    expect(highQibRes.expectedListingGainPercent).toBeGreaterThan(neutralRes.expectedListingGainPercent);
    expect(highQibRes.expectedListingPrice).toBeGreaterThan(neutralRes.expectedListingPrice);
  });

  it("penalizes listing gain when QIB subscription is poor (<2x) despite retail GMP", () => {
    const weakQibRes = calculateIpoListingGain({
      issuePrice: 400,
      gmp: 80, // 20% raw
      lotSize: 35,
      issueSizeCrores: 1000,
      qibSubscription: 0.8, // Institutional undersubscription
    });

    expect(weakQibRes.adjustments.qibMultiplier).toBeLessThan(1.0);
    expect(weakQibRes.expectedListingGainPercent).toBeLessThan(20.0);
  });

  it("applies float scarcity bonus to micro issues vs overhang discount to mega issues", () => {
    const microRes = calculateIpoListingGain({
      issuePrice: 200,
      gmp: 40,
      lotSize: 75,
      issueSizeCrores: 80, // Small issue
    });

    const megaRes = calculateIpoListingGain({
      issuePrice: 200,
      gmp: 40,
      lotSize: 75,
      issueSizeCrores: 15000, // Mega issue (e.g. LIC / Hyundai)
    });

    expect(microRes.adjustments.issueSizeFactor).toBeGreaterThan(megaRes.adjustments.issueSizeFactor);
    expect(microRes.expectedListingGainPercent).toBeGreaterThan(megaRes.expectedListingGainPercent);
  });

  it("calculates retail allotment probability and Expected Monetary Value (EMV) correctly", () => {
    const res = calculateIpoListingGain({
      issuePrice: 300,
      gmp: 60,
      lotSize: 50,
      retailSubscription: 25, // 25x in retail
    });

    expect(res.applicationEconomics.retailAllotmentProbability).toBe(0.04); // 1 / 25 = 4%
    expect(res.applicationEconomics.expectedMonetaryValuePerApplication).toBe(
      Math.round(0.04 * res.expectedNetPostTaxGainPerLot)
    );
  });

  it("handles zero or negative GMP safely without NaN or crashes", () => {
    const zeroGmp = calculateIpoListingGain({
      issuePrice: 250,
      gmp: 0,
      lotSize: 60,
    });

    expect(zeroGmp.rawGmpPercent).toBe(0);
    expect(zeroGmp.expectedGrossGainPerLot).toBe(0);
    expect(zeroGmp.expectedNetPostTaxGainPerLot).toBe(0);
    expect(zeroGmp.expectedListingPrice).toBe(250);
  });

  it("is fully deterministic (same input produces identical output every time)", () => {
    const input = {
      issuePrice: 750,
      gmp: 120,
      lotSize: 20,
      issueSizeCrores: 3500,
      qibSubscription: 42,
      retailSubscription: 18,
      issueType: "mainboard" as const,
    };

    const run1 = calculateIpoListingGain(input);
    const run2 = calculateIpoListingGain(input);

    expect(run1.expectedListingPrice).toBe(run2.expectedListingPrice);
    expect(run1.expectedListingGainPercent).toBe(run2.expectedListingGainPercent);
    expect(run1.expectedGrossGainPerLot).toBe(run2.expectedGrossGainPerLot);
    expect(run1.expectedNetPostTaxGainPerLot).toBe(run2.expectedNetPostTaxGainPerLot);
    expect(run1.priceRange).toEqual(run2.priceRange);
  });
});
