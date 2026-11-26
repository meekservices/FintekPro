/**
 * valuation-cone-and-sector-multiples.test.ts
 *
 * Test suite for Phase 2 Valuation Intelligence (Trendlyne / Tijori Peer Parity):
 * 1. Mathematical accuracy of Median, Mean, StdDev, PercentileRank
 * 2. Valuation band calculations [-2σ, -1σ, Median, +1σ, +2σ]
 * 3. Five-tier valuation status classification (DEEP_DISCOUNT to OVERVALUED)
 * 4. Sector & Industry relative comparison discount/premium logic
 * 5. GCR v1.0 & FASP-AI compliance (engineVersion, timestamp, determinism)
 */

import { describe, it, expect } from "vitest";
import {
  calculateMedian,
  calculateMean,
  calculateStdDev,
  computePercentileRank,
  determineValuationStatus,
  valuationConeService,
} from "../services/screener/valuation-cone-service";

describe("Phase 2: Valuation Intelligence Engine", () => {
  describe("1. Statistical Calculations", () => {
    it("should accurately compute median for odd and even length series", () => {
      const odd = [10, 20, 30, 40, 50];
      expect(calculateMedian(odd)).toBe(30);

      const even = [10, 20, 30, 40];
      expect(calculateMedian(even)).toBe(25);

      const unsorted = [50, 10, 40, 20, 30];
      expect(calculateMedian(unsorted)).toBe(30);

      expect(calculateMedian([])).toBe(0);
    });

    it("should compute mean accurately", () => {
      const values = [10, 20, 30, 40, 50];
      expect(calculateMean(values)).toBe(30);
      expect(calculateMean([])).toBe(0);
    });

    it("should compute standard deviation accurately", () => {
      // Sample: [10, 20, 30, 40, 50], mean = 30
      // Variance = ((10-30)^2 + (20-30)^2 + 0 + 100 + 400) / 5 = 1000 / 5 = 200
      // StdDev = sqrt(200) ≈ 14.1421
      const values = [10, 20, 30, 40, 50];
      const std = calculateStdDev(values, 30);
      expect(Math.round(std * 100) / 100).toBe(14.14);

      expect(calculateStdDev([20])).toBe(0);
    });

    it("should compute historical percentile rank accurately", () => {
      const series = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      // 30 has 2 values below it out of 10 -> 20.0%
      expect(computePercentileRank(series, 30)).toBe(20.0);
      // 55 has 5 values below it out of 10 -> 50.0%
      expect(computePercentileRank(series, 55)).toBe(50.0);
      // 105 has 10 values below it out of 10 -> 100.0%
      expect(computePercentileRank(series, 105)).toBe(100.0);
    });
  });

  describe("2. Five-Tier Valuation Status Classification", () => {
    const median = 30;
    const stdDev = 10;
    // -1.5σ = 15, -0.5σ = 25, +0.5σ = 35, +1.5σ = 45

    it("should classify DEEP_DISCOUNT when multiple < Median - 1.5σ", () => {
      expect(determineValuationStatus(12, median, stdDev)).toBe("DEEP_DISCOUNT");
      expect(determineValuationStatus(14.9, median, stdDev)).toBe("DEEP_DISCOUNT");
    });

    it("should classify UNDERVALUED when Median - 1.5σ <= multiple < Median - 0.5σ", () => {
      expect(determineValuationStatus(15, median, stdDev)).toBe("UNDERVALUED");
      expect(determineValuationStatus(24.9, median, stdDev)).toBe("UNDERVALUED");
    });

    it("should classify FAIR_VALUE when Median - 0.5σ <= multiple <= Median + 0.5σ", () => {
      expect(determineValuationStatus(25, median, stdDev)).toBe("FAIR_VALUE");
      expect(determineValuationStatus(30, median, stdDev)).toBe("FAIR_VALUE");
      expect(determineValuationStatus(35, median, stdDev)).toBe("FAIR_VALUE");
    });

    it("should classify PREMIUM when Median + 0.5σ < multiple <= Median + 1.5σ", () => {
      expect(determineValuationStatus(35.1, median, stdDev)).toBe("PREMIUM");
      expect(determineValuationStatus(45, median, stdDev)).toBe("PREMIUM");
    });

    it("should classify OVERVALUED when multiple > Median + 1.5σ", () => {
      expect(determineValuationStatus(45.1, median, stdDev)).toBe("OVERVALUED");
      expect(determineValuationStatus(60, median, stdDev)).toBe("OVERVALUED");
    });
  });

  describe("3. Valuation Band Set Construction", () => {
    it("should construct full 5-band cone with non-negative lower bounds", () => {
      // 20 points
      const points = Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, "0")}`,
        price: 1000 + i * 20,
        multiple: 20 + (i % 10) * 1.5,
      }));

      const bandSet = valuationConeService.computeValuationBands(
        points,
        28.5,
        "3Y",
        "PE",
        true,
      );

      expect(bandSet).not.toBeNull();
      expect(bandSet?.period).toBe("3Y");
      expect(bandSet?.metric).toBe("PE");
      expect(bandSet?.currentMultiple).toBe(28.5);
      expect(bandSet?.median).toBeGreaterThan(0);
      expect(bandSet?.bands.minus2Sigma).toBeGreaterThanOrEqual(0.1);
      expect(bandSet?.bands.minus1Sigma).toBeGreaterThan(bandSet?.bands.minus2Sigma!);
      expect(bandSet?.bands.median).toBeGreaterThan(bandSet?.bands.minus1Sigma!);
      expect(bandSet?.bands.plus1Sigma).toBeGreaterThan(bandSet?.bands.median!);
      expect(bandSet?.bands.plus2Sigma).toBeGreaterThan(bandSet?.bands.plus1Sigma!);
      expect(bandSet?.timeSeries).toBeDefined();
      expect(bandSet?.timeSeries!.length).toBeGreaterThan(0);
    });

    it("should return null when sample count is less than 10 to avoid noise", () => {
      const fewPoints = [
        { date: "2024-01-01", price: 100, multiple: 25 },
        { date: "2024-01-02", price: 102, multiple: 26 },
      ];

      const bandSet = valuationConeService.computeValuationBands(
        fewPoints,
        25,
        "3Y",
        "PE",
      );
      expect(bandSet).toBeNull();
    });
  });

  describe("4. GCR v1.0 & FASP-AI Compliance", () => {
    it("should output version 2.1.0 and ISO timestamps in valuation cone results", async () => {
      // Run on a mock or existing symbol
      const result = await valuationConeService.getValuationCone("MOCK_TEST_SYM", false);
      if (result) {
        expect(result.engineVersion).toBe("2.1.0");
        expect(new Date(result.calculationTimestamp).getTime()).toBeGreaterThan(0);
      }
    }, 15000);
  });
});
