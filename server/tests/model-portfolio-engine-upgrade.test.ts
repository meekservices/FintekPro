/**
 * @file model-portfolio-engine-upgrade.test.ts
 * @description Unit & integration tests verifying error fixes and performance upgrades
 *              in the Model Portfolio Engine (FASP-AI v3.0 / GCR v1.0).
 */

import { describe, it, expect, vi } from "vitest";
import {
  computePortfolioDrift,
  scorePortfolioAlpha,
  checkDrawdownCircuitBreaker,
  computeBlendedBenchmark,
  computeCornishFisherRisk,
  getDriftThreshold,
  type PortfolioQuantInput,
  type QuantHolding,
} from "../services/model-portfolio-quant-service";
import { calculateIntegerShareAllocation } from "../services/model-portfolio-share-sizing";

describe("Model Portfolio Engine Upgrades & Error Fixes", () => {
  describe("1. Quant Engine: Drift & Risk Calculations", () => {
    it("correctly identifies drift threshold based on asset class", () => {
      expect(getDriftThreshold("test-id", "liquid")).toBe(0.02);
      expect(getDriftThreshold("test-id", "debt")).toBe(0.03);
      expect(getDriftThreshold("test-id", "equity")).toBe(0.05);
      expect(getDriftThreshold("test-id", "thematic")).toBe(0.07);
    });

    it("evaluates compound drift accurately and detects need for rebalance", () => {
      const holdings: QuantHolding[] = [
        { rank: 1, name: "Stock A", symbol: "STOCKA", category: "equity", weight: 50, currentReturn: 35, currentWeight: 60 },
        { rank: 2, name: "Stock B", symbol: "STOCKB", category: "equity", weight: 50, currentReturn: -10, currentWeight: 40 },
      ];

      const input: PortfolioQuantInput = {
        id: "growth-equity-1",
        name: "Growth Equity Test",
        assetClass: "equity",
        cagr1Y: 20,
        cagr3Y: 18,
        cagr5Y: 16,
        benchmarkCagr1Y: 12,
        benchmarkName: "Nifty 50 TRI",
        holdings,
      };

      const driftReport = computePortfolioDrift(input);
      expect(driftReport.status).toBe("needs_rebalance");
      expect(driftReport.driftingCount).toBeGreaterThan(0);
      expect(driftReport.holdingsDrift.some(h => h.action === "SELL")).toBe(true);
      expect(driftReport.holdingsDrift.some(h => h.action === "BUY")).toBe(true);
    });

    it("verifies drawdown circuit breaker trip and recovery thresholds", () => {
      // Conservative portfolio with 8% threshold
      const conservativeTripped = checkDrawdownCircuitBreaker(-10.5, "conservative");
      expect(conservativeTripped.tripped).toBe(true);
      expect(conservativeTripped.message).toContain("drawdown protection mode");

      const moderateSafe = checkDrawdownCircuitBreaker(-8.5, "moderate");
      expect(moderateSafe.tripped).toBe(false);
      expect(moderateSafe.message).toContain("within limits");
    });

    it("computes Cornish-Fisher extreme risk with positive tail loss numbers", () => {
      const input: PortfolioQuantInput = {
        id: "thematic-alpha",
        name: "Thematic Alpha",
        assetClass: "thematic",
        cagr1Y: 24,
        cagr3Y: 20,
        cagr5Y: 18,
        benchmarkCagr1Y: 14,
        benchmarkName: "Nifty 500 TRI",
        volatility: 22,
        holdings: [
          { rank: 1, name: "Constituent A", symbol: "CONA", category: "thematic", weight: 100, currentReturn: 24 }
        ],
      };

      const risk = computeCornishFisherRisk(input);
      expect(risk.parametricVar95).toBeGreaterThan(0);
      expect(risk.cornishFisherVar95).toBeGreaterThanOrEqual(risk.parametricVar95);
      expect(risk.cvar95).toBeGreaterThan(risk.cornishFisherVar95);
      expect(risk.skewness).toBeLessThan(0);
      expect(risk.kurtosis).toBeGreaterThan(2);
    });
  });

  describe("2. Integer Share Sizing & Cash Drag Optimization", () => {
    it("allocates whole integers without fractional quantities and computes residual cash", () => {
      const holdings = [
        { rank: 1, name: "Reliance Industries", symbol: "RELIANCE", targetWeight: 60, marketPrice: 2500 },
        { rank: 2, name: "Tata Consultancy", symbol: "TCS", targetWeight: 40, marketPrice: 3500 },
      ];

      const totalCapital = 100000; // ₹1,00,000
      const result = calculateIntegerShareAllocation(holdings, totalCapital);

      expect(result.allocations.length).toBe(2);
      for (const alloc of result.allocations) {
        expect(Number.isInteger(alloc.integerQuantity)).toBe(true);
        expect(alloc.integerQuantity * alloc.marketPrice).toBe(alloc.allocatedAmount);
      }

      expect(result.totalAllocatedAmount + result.residualCash).toBe(totalCapital);
      expect(result.isFullyInvestable).toBe(true);
      expect(result.residualCash).toBeGreaterThanOrEqual(0);
    });

    it("handles capital below share price cleanly without crashing", () => {
      const holdings = [
        { rank: 1, name: "MRF Tyres", symbol: "MRF", targetWeight: 100, marketPrice: 135000 },
      ];

      const totalCapital = 50000; // Not enough for 1 share of MRF
      const result = calculateIntegerShareAllocation(holdings, totalCapital);

      expect(result.allocations[0].integerQuantity).toBe(0);
      expect(result.allocations[0].status).toBe("SKIPPED_BELOW_SHARE_PRICE");
      expect(result.residualCash).toBe(50000);
      expect(result.isFullyInvestable).toBe(false);
      expect(result.uninvestableCount).toBe(1);
    });
  });

  describe("3. Alpha Scoring & Benchmark Blending", () => {
    it("computes weighted blended benchmark correctly across multi-asset allocation", () => {
      const allocation = [
        { type: "equity", weight: 60 },
        { type: "debt", weight: 30 },
        { type: "gold", weight: 10 },
      ];

      const blended = computeBlendedBenchmark(allocation);
      // 0.60 * 11.4 + 0.30 * 7.1 + 0.10 * 7.4 = 6.84 + 2.13 + 0.74 = 9.71%
      expect(blended).toBeCloseTo(9.71, 1);
    });

    it("computes alpha score with bounded confidence", () => {
      const input: PortfolioQuantInput = {
        id: "india-largecap",
        name: "India Large Cap Core",
        assetClass: "large_cap",
        cagr1Y: 16.5,
        cagr3Y: 14.0,
        cagr5Y: 13.0,
        benchmarkCagr1Y: 11.4,
        benchmarkName: "Nifty 50 TRI",
        sharpeRatio: 1.25,
        holdings: Array(10).fill(null).map((_, i) => ({
          rank: i + 1,
          name: `Stock ${i + 1}`,
          category: "large_cap",
          weight: 10,
          currentReturn: 16.5,
        })),
      };

      const score = scorePortfolioAlpha(input);
      expect(score.alpha).toBeCloseTo(5.1, 1);
      expect(score.confidenceScore).toBeLessThanOrEqual(97); // GCR FASP-AI limit
      expect(score.confidenceScore).toBeGreaterThanOrEqual(40);
      expect(score.recommendation).toContain("India Large Cap Core");
    });
  });
});
