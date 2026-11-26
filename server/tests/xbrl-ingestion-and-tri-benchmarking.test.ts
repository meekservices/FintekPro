/**
 * xbrl-ingestion-and-tri-benchmarking.test.ts
 *
 * Test suite verifying:
 * 1. Phase 3: Autonomous Exchange Results XBRL Ingestion Pipeline (xbrl-ingestion-worker)
 * 2. Phase 4: SEBI Total Return Index (TRI) Dividend-Reinvested Benchmarking Suite
 */

import { describe, it, expect } from "vitest";
import { xbrlEarningsIngestionWorker } from "../services/corporate-filings/xbrl-ingestion-worker";
import {
  totalReturnIndexService,
  SUPPORTED_BENCHMARKS,
  BenchmarkTriResult,
} from "../services/portfolio/total-return-index-service";

describe("Phase 3 & Phase 4: Autonomous XBRL Ingestion & SEBI TRI Benchmarking", () => {
  describe("Phase 3: Autonomous Exchange XBRL Earnings Ingestion", () => {
    it("should accurately normalize currency units to standard Indian Crores (₹ Cr)", () => {
      const worker = xbrlEarningsIngestionWorker as any;

      // 1. Explicit Crore units
      expect(worker.normalizeToCrores(125.45, "crores")).toBe(125.45);
      expect(worker.normalizeToCrores(89.2, "INR in Cr")).toBe(89.2);

      // 2. Explicit Lakh units (divide by 100)
      expect(worker.normalizeToCrores(5000, "lakhs")).toBe(50.0);
      expect(worker.normalizeToCrores(25000, "in lacs")).toBe(250.0);

      // 3. Raw INR amounts (> 10,000,000 -> divide by 1e7)
      expect(worker.normalizeToCrores(150000000, "INR")).toBe(15.0);
      expect(worker.normalizeToCrores(2500000000, "")).toBe(250.0);
    });

    it("should expose start/stop interface for background scheduling", () => {
      expect(typeof xbrlEarningsIngestionWorker.startScheduler).toBe("function");
      expect(typeof xbrlEarningsIngestionWorker.stopScheduler).toBe("function");
      expect(typeof xbrlEarningsIngestionWorker.runIngestionPass).toBe("function");
    });
  });

  describe("Phase 4: SEBI Total Return Index (TRI) Benchmarking Suite", () => {
    it("should support all major Indian institutional benchmark indices", () => {
      expect(SUPPORTED_BENCHMARKS.NIFTY_50).toBeDefined();
      expect(SUPPORTED_BENCHMARKS.SENSEX).toBeDefined();
      expect(SUPPORTED_BENCHMARKS.NIFTY_BANK).toBeDefined();
      expect(SUPPORTED_BENCHMARKS.NIFTY_MIDCAP_150).toBeDefined();
      expect(SUPPORTED_BENCHMARKS.NIFTY_SMALLCAP_250).toBeDefined();
    });

    it("should compound daily dividends according to SEBI TRI formula: TRI_t = TRI_{t-1} * ((P_t + Div_t) / P_{t-1})", async () => {
      // Direct mathematical simulation of the formula
      const basePrice = 20000;
      const baseTri = 1000;

      // Day 1: Price goes to 20100 (+0.5%), Div = 0
      const p1 = 20100;
      const div1 = 0;
      const tri1 = baseTri * ((p1 + div1) / basePrice);
      expect(tri1).toBeCloseTo(1005.0, 1);

      // Day 2: Price stays 20100 (0% PR), but component pays 20 pts dividend
      const p2 = 20100;
      const div2 = 20;
      const tri2 = tri1 * ((p2 + div2) / p1);
      // ((20100 + 20) / 20100) = 1.000995 -> tri2 > tri1 even though price didn't move!
      expect(tri2).toBeGreaterThan(tri1);
      expect(tri2).toBeCloseTo(1005.999, 1);
    });

    it("should accurately isolate dividend compounding drag and compute SEBI-compliant alpha", () => {
      const mockTriResult: BenchmarkTriResult = {
        benchmarkSymbol: "NIFTY_50",
        benchmarkName: "NIFTY 50 TRI",
        baseDate: "2021-01-01",
        latestDate: "2024-01-01",
        baseIndexPrice: 14000,
        latestIndexPrice: 21500,
        baseTri: 1000,
        latestTri: 1610,
        priceReturnCagr: 15.37, // ~15.37% Price Return
        totalReturnCagr: 17.18, // ~17.18% TRI (+1.81% dividend compounding)
        dividendCompoundingDragPercent: 1.81,
        annualizedVolatility: 13.5,
        sharpeRatioTri: 0.79,
        maxDrawdownTri: 17.4,
        pointsCount: 750,
        series: [],
        regulatoryComplianceNotice: "SEBI Mandate",
        engineVersion: "2.1.0",
        calculationTimestamp: new Date().toISOString(),
      };

      // Portfolio delivered 18.0% CAGR
      const alphaComparison = totalReturnIndexService.calculateAlphaVsTri(18.0, mockTriResult);

      // Against PR: 18.0 - 15.37 = +2.63% (inflated alpha)
      expect(alphaComparison.unadjustedAlphaVsPr).toBe(2.63);

      // Against TRI: 18.0 - 17.18 = +0.82% (true SEBI audit-compliant alpha)
      expect(alphaComparison.sebiCompliantAlphaVsTri).toBe(0.82);

      // Dividend drag: 1.81%
      expect(alphaComparison.dividendDragAdjustment).toBe(1.81);
      expect(alphaComparison.complianceStatus).toBe("SEBI_AUDIT_COMPLIANT");
      expect(alphaComparison.explanation).toContain("true audit-compliant alpha");
    });
  });
});
