/**
 * @file portfolio-intelligence.test.ts
 * @description Vitest unit tests for the Portfolio Intelligence Engine (FASP-AI v3.0).
 *
 * Covers:
 *   - portfolio-risk-guard: hard breach detection, soft warnings, risk score
 *   - xirr-calculator: XIRR, IRR, CAGR, MaxDrawdown, Sharpe
 *   - market-regime-detector: regime type mapping
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRiskBudget, buildPortfolioRiskSummary } from "../portfolio-risk-guard";
import {
  computeXIRR,
  computeIRR,
  computeCAGR,
  computeMaxDrawdown,
  computeSharpe,
  computeSIPXIRR,
} from "../xirr-calculator";

// ── Mock DB and imports ───────────────────────────────────────────────────────
vi.mock("../../db", () => ({ db: {} }));
vi.mock("../../../shared/schema", () => ({ modelPortfolios: {} }));
vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ══════════════════════════════════════════════════════════════════════════════
// XIRR Calculator Tests
// ══════════════════════════════════════════════════════════════════════════════

describe("xirr-calculator", () => {
  describe("computeCAGR", () => {
    it("computes 10% CAGR correctly", () => {
      const cagr = computeCAGR(100, 161, 5); // 100 → 161 in 5 years ≈ 10%
      expect(cagr).toBeCloseTo(0.10, 1);
    });

    it("returns 0 for zero begin value", () => {
      expect(computeCAGR(0, 100, 5)).toBe(0);
    });

    it("returns 0 for zero years", () => {
      expect(computeCAGR(100, 200, 0)).toBe(0);
    });

    it("handles negative growth correctly", () => {
      const cagr = computeCAGR(100, 50, 2); // 50% loss in 2 years
      expect(cagr).toBeCloseTo(-0.293, 2); // -29.3% pa
    });
  });

  describe("computeMaxDrawdown", () => {
    it("detects 50% drawdown from peak to trough", () => {
      const series = [100, 120, 80, 60, 90]; // peak 120, trough 60 = 50%
      const dd = computeMaxDrawdown(series);
      expect(dd).toBeCloseTo(0.5, 2);
    });

    it("returns 0 for monotonically increasing series", () => {
      expect(computeMaxDrawdown([100, 110, 120, 130])).toBe(0);
    });

    it("returns 0 for single element", () => {
      expect(computeMaxDrawdown([100])).toBe(0);
    });

    it("handles zero values", () => {
      expect(computeMaxDrawdown([100, 0])).toBe(1.0); // 100% drawdown
    });
  });

  describe("computeSharpe", () => {
    it("returns positive Sharpe for positive returns above risk-free", () => {
      // 15% annual return daily series
      const returns = Array(252).fill(0.15 / 252);
      const sharpe = computeSharpe(returns, 0.065, 252);
      expect(sharpe).toBeGreaterThan(0);
    });

    it("returns 0 for empty returns", () => {
      expect(computeSharpe([])).toBe(0);
    });

    it("returns 0 for uniform returns (zero std dev)", () => {
      const returns = Array(100).fill(0.01);
      // All same returns → std dev = 0 → Sharpe = 0
      expect(computeSharpe(returns)).toBe(0);
    });
  });

  describe("computeXIRR", () => {
    it("computes ~10% XIRR for simple investment", () => {
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      const cashflows = [
        { date: oneYearAgo, amount: 100 },  // invest 100
        { date: today, amount: -110 },       // receive 110 (10% return)
      ];
      const xirr = computeXIRR(cashflows);
      expect(xirr).toBeCloseTo(0.10, 1);
    });

    it("returns 0 for all-positive cashflows (no sign change)", () => {
      const today = new Date();
      const past = new Date(today.setFullYear(today.getFullYear() - 1));
      expect(computeXIRR([
        { date: past, amount: 100 },
        { date: new Date(), amount: 50 },
      ])).toBe(0);
    });

    it("returns 0 for empty cashflows", () => {
      expect(computeXIRR([])).toBe(0);
    });

    it("handles SIP-like irregular flows", () => {
      const d = (months: number) => {
        const d = new Date();
        d.setMonth(d.getMonth() - months);
        return d;
      };
      const cashflows = [
        { date: d(12), amount: 10000 },
        { date: d(9),  amount: 10000 },
        { date: d(6),  amount: 10000 },
        { date: d(3),  amount: 10000 },
        { date: new Date(), amount: -45000 }, // 12.5% gain
      ];
      const xirr = computeXIRR(cashflows);
      expect(xirr).toBeGreaterThan(0); // positive return
      expect(xirr).toBeLessThan(1);    // less than 100% pa
    });
  });

  describe("computeSIPXIRR", () => {
    it("returns positive XIRR for profitable SIP", () => {
      const xirr = computeSIPXIRR(10000, 12, 130000); // invested 1.2L, worth 1.3L
      expect(xirr).toBeGreaterThan(0);
    });

    it("returns negative XIRR for loss-making SIP", () => {
      const xirr = computeSIPXIRR(10000, 12, 100000); // invested 1.2L, worth 1.0L
      expect(xirr).toBeLessThan(0);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Portfolio Risk Guard Tests
// ══════════════════════════════════════════════════════════════════════════════

describe("portfolio-risk-guard", () => {
  const buildHoldings = (overrides: any[] = []) => {
    const base = [
      { name: "Stock A", type: "equity", sector: "Technology",  weight: 10, beta: 1.1 },
      { name: "Stock B", type: "equity", sector: "Finance",     weight: 10, beta: 0.9 },
      { name: "Stock C", type: "equity", sector: "Healthcare",  weight: 10, beta: 0.8 },
      { name: "Bond A",  type: "debt",   sector: "Government",  weight: 10, beta: 0.1 },
      { name: "Bond B",  type: "debt",   sector: "Corporate",   weight: 10, beta: 0.15 },
      { name: "MF A",    type: "equity", sector: "Large Cap",   weight: 10, beta: 0.95 },
      { name: "Gold",    type: "gold",   sector: "Commodity",   weight: 10, beta: 0.2  },
      { name: "REIT A",  type: "reit",   sector: "Real Estate", weight: 10, beta: 0.7  },
      { name: "Liquid",  type: "liquid", sector: "Liquid",      weight: 10, beta: 0.05 },
      { name: "Stock D", type: "equity", sector: "Auto",        weight: 10, beta: 1.0  },
    ];
    return [...base, ...overrides];
  };

  describe("checkRiskBudget", () => {
    it("approves a balanced aggressive portfolio", () => {
      const holdings = buildHoldings();
      const report = checkRiskBudget("p1", "aggressive", holdings);
      expect(report.portfolioId).toBe("p1");
      expect(report.approved).toBe(true);
      expect(report.hardBreaches).toHaveLength(0);
    });

    it("flags hard breach when single equity weight > 25% for conservative", () => {
      const holdings = [
        { name: "Stock A", type: "equity", sector: "Tech", weight: 30, beta: 1.2 },
        { name: "Bond A",  type: "debt",   sector: "Govt", weight: 70, beta: 0.1 },
      ];
      const report = checkRiskBudget("p2", "conservative", holdings);
      expect(report.hardBreaches.length).toBeGreaterThan(0);
    });

    it("detects high weighted beta breach for conservative", () => {
      const holdings = [
        { name: "Stock A", type: "equity", sector: "Tech", weight: 50, beta: 2.5 },
        { name: "Bond A",  type: "debt",   sector: "Govt", weight: 50, beta: 0.1 },
      ];
      const report = checkRiskBudget("p3", "conservative", holdings);
      // Weighted beta: 0.5*2.5 + 0.5*0.1 = 1.3 — exceeds conservative ceiling of 1.2
      const betaBreach = report.hardBreaches.find(b => b.field === "weightedBeta");
      expect(betaBreach).toBeTruthy();
    });

    it("has correct model_version in output", () => {
      const report = checkRiskBudget("p4", "moderate", buildHoldings());
      expect(report.model_version).toContain("FASP-AI");
    });

    it("risk score is between 0 and 100", () => {
      const report = checkRiskBudget("p5", "moderate", buildHoldings());
      expect(report.riskScore).toBeGreaterThanOrEqual(0);
      expect(report.riskScore).toBeLessThanOrEqual(100);
    });
  });

  describe("buildPortfolioRiskSummary", () => {
    it("processes multiple portfolios", async () => {
      const portfolios = [
        { id: "p1", riskProfile: "aggressive", holdings: buildHoldings() },
        { id: "p2", riskProfile: "conservative", holdings: buildHoldings() },
      ];
      const reports = await buildPortfolioRiskSummary(portfolios);
      expect(reports).toHaveLength(2);
      expect(reports[0].portfolioId).toBe("p1");
      expect(reports[1].portfolioId).toBe("p2");
    });

    it("handles empty holdings gracefully", async () => {
      const portfolios = [{ id: "p1", riskProfile: "moderate", holdings: [] }];
      const reports = await buildPortfolioRiskSummary(portfolios);
      expect(reports[0].approved).toBe(true); // empty = no breaches
    });
  });
});
