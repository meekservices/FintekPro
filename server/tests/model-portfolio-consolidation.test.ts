/**
 * @file model-portfolio-consolidation.test.ts
 * @description Vitest regression suite verifying model portfolio consolidation,
 *              100.0% weight normalization, SEBI statutory tiers, and alias resolution.
 *
 * Framework: FASP-AI v3.1 / GCR v1.0
 */

import { describe, it, expect } from "vitest";
import {
  ALL_CANONICAL_PORTFOLIOS,
  PORTFOLIO_ID_ALIASES,
  DEPRECATED_PORTFOLIO_IDS,
  resolveCanonicalPortfolio,
} from "../data/canonical-model-portfolios";
import { SEBI_TIER_CONFIGS } from "../services/model-portfolio-tier-service";

describe("Model Portfolio Consolidation & Strategy Modernization Suite", () => {
  it("maintains exactly 44 non-overlapping canonical model portfolios", () => {
    expect(ALL_CANONICAL_PORTFOLIOS.length).toBe(44);
  });

  it("mathematically verifies that EVERY canonical portfolio sums to exactly 100.00% holding weight", () => {
    for (const p of ALL_CANONICAL_PORTFOLIOS) {
      const sum = p.holdings.reduce((acc, h) => acc + (h.weight || 0), 0);
      expect(Math.abs(sum - 100)).toBeLessThan(0.001);
      expect(p.holdings.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("verifies clean consecutive ranks (1..N) sorted by weight descending in all holdings", () => {
    for (const p of ALL_CANONICAL_PORTFOLIOS) {
      for (let i = 0; i < p.holdings.length; i++) {
        expect(p.holdings[i].rank).toBe(i + 1);
        if (i > 0) {
          expect(p.holdings[i - 1].weight).toBeGreaterThanOrEqual(p.holdings[i].weight);
        }
      }
    }
  });

  it("strictly enforces SEBI statutory tier minimums across all vehicles", () => {
    for (const p of ALL_CANONICAL_PORTFOLIOS) {
      if (p.portfolioTier === "retail_mf") {
        expect(p.statutoryMinInvestment).toBeLessThan(5000000); // Retail strictly < ₹50L PMS floor
        expect(p.vehicleType).toBe("MUTUAL_FUND");
      } else if (p.portfolioTier === "affluent_sif") {
        expect(p.statutoryMinInvestment).toBe(1000000); // ₹10 Lakhs SEBI SIF
        expect(p.vehicleType).toBe("SIF_NEW_ASSET_CLASS");
      } else if (p.portfolioTier === "hni_pms") {
        expect(p.statutoryMinInvestment).toBe(5000000); // ₹50 Lakhs SEBI PMS Reg 23(2)
        expect(p.vehicleType).toBe("PMS_MULTI_ASSET");
      } else if (p.portfolioTier === "uhni_aif") {
        expect(p.statutoryMinInvestment).toBe(10000000); // ₹1 Crore SEBI AIF Reg 10(c)
        expect(p.vehicleType).toBe("AIF_MULTI_ASSET");
      }
    }
  });

  it("verifies unique portfolio codes across all portfolios", () => {
    const codes = ALL_CANONICAL_PORTFOLIOS.map((p) => p.portfolioCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("resolves all legacy duplicate slugs to canonical targets via PORTFOLIO_ID_ALIASES", () => {
    // Goal-based aliases
    expect(resolveCanonicalPortfolio("childrens-education")?.id).toBe("goal-child-education");
    expect(resolveCanonicalPortfolio("emergency-fund")?.id).toBe("goal-emergency-corpus");
    expect(resolveCanonicalPortfolio("retirement-builder")?.id).toBe("goal-retirement");
    expect(resolveCanonicalPortfolio("wedding-milestone")?.id).toBe("goal-wedding-fund");
    expect(resolveCanonicalPortfolio("home-purchase")?.id).toBe("goal-home-downpayment");
    expect(resolveCanonicalPortfolio("senior-citizen-income")?.id).toBe("goal-senior-citizen");
    expect(resolveCanonicalPortfolio("first-time-investor")?.id).toBe("goal-starter-sip");

    // Thematic aliases
    expect(resolveCanonicalPortfolio("banking-bfsi")?.id).toBe("thematic-bfsi");
    expect(resolveCanonicalPortfolio("healthcare-pharma")?.id).toBe("thematic-pharma");
    expect(resolveCanonicalPortfolio("psu-defence-atmanirbhar")?.id).toBe("thematic-defence");
    expect(resolveCanonicalPortfolio("consumption-rural")?.id).toBe("thematic-consumption");
    expect(resolveCanonicalPortfolio("digital-india-tech")?.id).toBe("new-age-digital-mf");

    // Tax saver & Dividend
    expect(resolveCanonicalPortfolio("tax-saver-portfolio")?.id).toBe("tax-saver-elss");
    expect(resolveCanonicalPortfolio("dividend-harvest")?.id).toBe("dividend-yield");

    // Debt & Treasury
    expect(resolveCanonicalPortfolio("corporate-treasury")?.id).toBe("corp-treasury-operational");
    expect(resolveCanonicalPortfolio("pure-debt-portfolio")?.id).toBe("debt-corporate-bond");
    expect(resolveCanonicalPortfolio("debt-ladder")?.id).toBe("debt-short-duration");

    // Equity Cap
    expect(resolveCanonicalPortfolio("passive-index")?.id).toBe("nifty50-index-alpha");
    expect(resolveCanonicalPortfolio("india-growth")?.id).toBe("blue-chip-growth");
    expect(resolveCanonicalPortfolio("small-cap-alpha")?.id).toBe("smallcap-discovery");
    expect(resolveCanonicalPortfolio("emerging-leaders")?.id).toBe("midcap-momentum");

    // HNI & Wealth
    expect(resolveCanonicalPortfolio("hni-wealth-compounder")?.id).toBe("hni-focused-leaders-pms");
    expect(resolveCanonicalPortfolio("family-office")?.id).toBe("uhni-global-opportunities-aif");
  });

  it("verifies all newly added strategies are present in the catalogue", () => {
    const ids = new Set(ALL_CANONICAL_PORTFOLIOS.map((p) => p.id));
    // Retail
    expect(ids.has("thematic-clean-energy")).toBe(true);
    expect(ids.has("thematic-auto-mobility")).toBe(true);
    expect(ids.has("equity-smart-beta-quality")).toBe(true);
    expect(ids.has("debt-target-maturity-2030")).toBe(true);

    // SIF
    expect(ids.has("sif-inverse-hedged-alpha")).toBe(true);

    // HNI PMS
    expect(ids.has("hni-dividend-aristocrats-pms")).toBe(true);
    expect(ids.has("hni-small-mid-compounders-pms")).toBe(true);

    // UHNI AIF
    expect(ids.has("uhni-structured-credit-aif")).toBe(true);
  });

  it("verifies DEPRECATED_PORTFOLIO_IDS contains all mapped legacy slugs", () => {
    expect(DEPRECATED_PORTFOLIO_IDS.length).toBeGreaterThanOrEqual(30);
    for (const legacyId of Object.keys(PORTFOLIO_ID_ALIASES)) {
      expect(DEPRECATED_PORTFOLIO_IDS).toContain(legacyId);
    }
  });
});
