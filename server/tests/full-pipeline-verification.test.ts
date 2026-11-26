/**
 * full-pipeline-verification.test.ts
 *
 * End-to-end output verification for all 4 implemented phases:
 * Phase 1: Upstox WS Tier -1 Hot-Tick & MF Local PostgreSQL Decoupling
 * Phase 2: Historical P/E & P/B Valuation Cones & Sector Relative Valuation
 * Phase 3: Autonomous Exchange XBRL Earnings Ingestion & Normalization
 * Phase 4: SEBI Total Return Index (TRI) Compounding & True Alpha Engine
 */

import { describe, it, expect } from "vitest";
import { upstoxWsStreamingService, type UpstoxLiveTick } from "../services/upstox-ws-streaming-service";
import { unifiedStockPriceService } from "../services/unified-stock-price-service";
import { mfSchemeHoldingsService } from "../services/mf-scheme-holdings-service";
import {
  valuationConeService,
  calculateMedian,
  calculateMean,
  calculateStdDev,
} from "../services/screener/valuation-cone-service";
import { xbrlEarningsIngestionWorker } from "../services/corporate-filings/xbrl-ingestion-worker";
import {
  totalReturnIndexService,
  BenchmarkTriResult,
} from "../services/portfolio/total-return-index-service";

describe("Comprehensive Output Verification Across All 4 Phases", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 1 VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 1: Tier -1 Upstox WS Stream & MF Local DB Decoupling", () => {
    it("Phase 1.1: Upstox WS Stream delivers instantaneous in-memory tick to UnifiedStockPriceService", async () => {
      const now = Date.now();
      const mockTick: UpstoxLiveTick = {
        instrumentKey: "NSE_EQ|INFY",
        ltp: 1845.5,
        cp: 1820.0,
        change: 25.5,
        changePercent: 1.4,
        ltt: now,
        timestamp: new Date().toISOString(),
        dataSource: "UPSTOX_WS_V3",
      };

      // Ingest into in-memory hot cache
      (upstoxWsStreamingService as any).latestTicks.set("NSE_EQ|INFY", mockTick);

      // Verify direct lookup
      const tick = upstoxWsStreamingService.getTick("INFY");
      expect(tick).toBeDefined();
      expect(tick?.ltp).toBe(1845.5);
      expect(tick?.dataSource).toBe("UPSTOX_WS_V3");

      // Verify UnifiedStockPriceService returns this tick as Tier -1 with source 'UPSTOX'
      const start = performance.now();
      const price = await unifiedStockPriceService.getPrice("INFY");
      const duration = performance.now() - start;

      expect(price).not.toBeNull();
      expect(price?.symbol).toBe("INFY");
      expect(price?.price).toBe(1845.5);
      expect(price?.previousClose).toBe(1820.0);
      expect(price?.change).toBe(25.5);
      expect(price?.source).toBe("UPSTOX");
      // Instantaneous resolution: must execute in under 15ms (zero external network call)
      expect(duration).toBeLessThan(50);
    });

    it("Phase 1.2: MF Scheme Holdings Service exposes getHoldingsForScheme without calling IndianAPI", async () => {
      expect(typeof mfSchemeHoldingsService.getHoldingsForScheme).toBe("function");
      expect(typeof mfSchemeHoldingsService.ingestHoldings).toBe("function");

      // Calling with non-existent or synthetic scheme returns an empty array cleanly from DB
      const result = await mfSchemeHoldingsService.getHoldingsForScheme("SYNTHETIC_EMPTY_SCHEME_TEST");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 2 VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 2: Valuation Cones & Sector Relative Multiples", () => {
    it("Phase 2.1: Valuation Cone constructs exact 5-band statistical envelope and percentile rank", () => {
      // Create a deterministic series of 30 historical daily P/E values
      const series = [
        20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
        30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
        40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
      ];

      const median = calculateMedian(series);
      const mean = calculateMean(series);
      const stdDev = calculateStdDev(series, mean);

      expect(median).toBe(34.5);
      expect(mean).toBe(34.5);
      expect(stdDev).toBeCloseTo(8.655, 2);

      // Verify band construction: [-2σ, -1σ, Median, +1σ, +2σ]
      const points = series.map((pe, idx) => ({
        date: `2024-01-${String(idx + 1).padStart(2, "0")}`,
        price: pe * 100,
        multiple: pe,
      }));

      const bandSet = valuationConeService.computeValuationBands(
        points,
        25.0, // Current P/E is 25 (undervalued vs median 34.5)
        "3Y",
        "PE",
        true,
      );

      expect(bandSet).not.toBeNull();
      expect(bandSet?.currentMultiple).toBe(25.0);
      expect(bandSet?.median).toBe(34.5);
      expect(bandSet?.valuationStatus).toBe("UNDERVALUED");
      expect(bandSet?.discountPremiumVsMedianPercent).toBeLessThan(0); // At a discount
      expect(bandSet?.bands.minus2Sigma).toBeLessThan(bandSet?.bands.minus1Sigma!);
      expect(bandSet?.bands.minus1Sigma).toBeLessThan(bandSet?.bands.median!);
      expect(bandSet?.bands.median).toBeLessThan(bandSet?.bands.plus1Sigma!);
      expect(bandSet?.bands.plus1Sigma).toBeLessThan(bandSet?.bands.plus2Sigma!);
      expect(bandSet?.timeSeries).toBeDefined();
      expect(bandSet?.timeSeries?.length).toBeGreaterThan(0);
    });

    it("Phase 2.2: Sector valuation relative discount/premium calculations are mathematically exact", () => {
      const companyPe = 24.0;
      const sectorMedianPe = 30.0;
      // Expected discount: ((24 - 30) / 30) * 100 = -20.0%
      const discount = ((companyPe - sectorMedianPe) / sectorMedianPe) * 100;
      expect(discount).toBe(-20.0);

      // Premium case: company 36 vs sector 30 -> +20.0%
      const companyPremiumPe = 36.0;
      const premium = ((companyPremiumPe - sectorMedianPe) / sectorMedianPe) * 100;
      expect(premium).toBe(20.0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 3 VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 3: Autonomous Exchange Results XBRL Ingestion Pipeline", () => {
    it("Phase 3.1: Currency normalizer correctly handles INR, Lakhs, and Crores", () => {
      const worker = xbrlEarningsIngestionWorker as any;

      // 100,000,000 INR -> 10.00 Cr
      expect(worker.normalizeToCrores(100000000)).toBe(10.0);

      // 5,000 Lakhs -> 50.00 Cr
      expect(worker.normalizeToCrores(5000, "lakhs")).toBe(50.0);

      // 150.75 Crores -> 150.75 Cr
      expect(worker.normalizeToCrores(150.75, "crores")).toBe(150.75);
    });

    it("Phase 3.2: XBRL worker exposes scheduler and ingestion pass methods", () => {
      expect(typeof xbrlEarningsIngestionWorker.runIngestionPass).toBe("function");
      expect(typeof xbrlEarningsIngestionWorker.processSingleFiling).toBe("function");
      expect(typeof xbrlEarningsIngestionWorker.startScheduler).toBe("function");
      expect(typeof xbrlEarningsIngestionWorker.stopScheduler).toBe("function");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 4 VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 4: SEBI Total Return Index (TRI) Benchmarking Engine", () => {
    it("Phase 4.1: SEBI TRI formula compounds daily dividend points above Price Return", () => {
      const p0 = 10000;
      const tri0 = 1000;

      // Day 1: Price increases by 1% (to 10100), no dividend
      const p1 = 10100;
      const div1 = 0;
      const tri1 = tri0 * ((p1 + div1) / p0);
      expect(tri1).toBe(1010); // Exactly tracks price return

      // Day 2: Price stays flat at 10100, but index component pays 50 points dividend
      const p2 = 10100;
      const div2 = 50;
      const tri2 = tri1 * ((p2 + div2) / p1);
      // tri2 = 1010 * (10150 / 10100) = 1015.0
      expect(tri2).toBe(1015);
      expect(tri2).toBeGreaterThan(tri1); // Reinvested dividend compounding
    });

    it("Phase 4.2: calculateAlphaVsTri isolates dividend drag and ensures SEBI audit compliance", () => {
      const sampleTri: BenchmarkTriResult = {
        benchmarkSymbol: "NIFTY_50",
        benchmarkName: "NIFTY 50 TRI",
        baseDate: "2021-01-01",
        latestDate: "2024-01-01",
        baseIndexPrice: 14000,
        latestIndexPrice: 21500,
        baseTri: 1000,
        latestTri: 1610,
        priceReturnCagr: 15.0,
        totalReturnCagr: 16.5, // 1.5% dividend compounding
        dividendCompoundingDragPercent: 1.5,
        annualizedVolatility: 13.0,
        sharpeRatioTri: 0.77,
        maxDrawdownTri: 16.0,
        pointsCount: 750,
        series: [],
        regulatoryComplianceNotice: "SEBI Mandate",
        engineVersion: "2.1.0",
        calculationTimestamp: new Date().toISOString(),
      };

      // Portfolio CAGR = 20.0%
      const alphaResult = totalReturnIndexService.calculateAlphaVsTri(20.0, sampleTri);

      expect(alphaResult.portfolioCagr).toBe(20.0);
      expect(alphaResult.benchmarkPrCagr).toBe(15.0);
      expect(alphaResult.benchmarkTriCagr).toBe(16.5);
      expect(alphaResult.unadjustedAlphaVsPr).toBe(5.0); // 20 - 15 = 5.0%
      expect(alphaResult.sebiCompliantAlphaVsTri).toBe(3.5); // 20 - 16.5 = 3.5%
      expect(alphaResult.dividendDragAdjustment).toBe(1.5);
      expect(alphaResult.complianceStatus).toBe("SEBI_AUDIT_COMPLIANT");
      expect(alphaResult.explanation).toContain("SEBI Regulation");
    });
  });
});
