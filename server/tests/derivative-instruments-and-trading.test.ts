import { describe, it, expect } from "vitest";
import {
  derivativesService,
  SEBI_FNO_FRAMEWORK_2026,
  validateWeeklyExpiryEligibility,
} from "../services/derivatives-service";
import { upstoxMarketDataService, DERIVATIVE_UNDERLYING_MAP } from "../services/upstox-market-data-service";
import { instrumentSearchService } from "../services/instrument-search-service";

describe("FintekPro Derivative Instruments & F&O Trading Engine (GCR v1.0 + SEBI 2026)", () => {
  describe("1. SEBI Index Derivatives Framework 2026 (Circular 132)", () => {
    it("permits weekly expiry contracts strictly for NIFTY 50 and SENSEX", () => {
      const niftyCheck = validateWeeklyExpiryEligibility("NIFTY", true);
      expect(niftyCheck.allowed).toBe(true);

      const sensexCheck = validateWeeklyExpiryEligibility("SENSEX", true);
      expect(sensexCheck.allowed).toBe(true);
    });

    it("disallows weekly expiry contracts for BANKNIFTY, FINNIFTY, and MIDCPNIFTY per SEBI mandate", () => {
      const bankniftyCheck = validateWeeklyExpiryEligibility("BANKNIFTY", true);
      expect(bankniftyCheck.allowed).toBe(false);
      expect(bankniftyCheck.error).toBe("WEEKLY_EXPIRY_DISCONTINUED");

      const finniftyCheck = validateWeeklyExpiryEligibility("FINNIFTY", true);
      expect(finniftyCheck.allowed).toBe(false);

      const midcpCheck = validateWeeklyExpiryEligibility("MIDCPNIFTY", true);
      expect(midcpCheck.allowed).toBe(false);
    });

    it("allows monthly expiry contracts for all indices including BANKNIFTY and FINNIFTY", () => {
      const bankniftyMonthly = validateWeeklyExpiryEligibility("BANKNIFTY", false);
      expect(bankniftyMonthly.allowed).toBe(true);

      const finniftyMonthly = validateWeeklyExpiryEligibility("FINNIFTY", false);
      expect(finniftyMonthly.allowed).toBe(true);
    });

    it("verifies SEBI cash margin requirement floor is at least 50%", () => {
      expect(SEBI_FNO_FRAMEWORK_2026.CASH_MARGIN_MIN_PCT).toBeGreaterThanOrEqual(50);
      expect(SEBI_FNO_FRAMEWORK_2026.EXPIRY_DAY_ELM_SURCHARGE_PCT).toBe(2);
    });
  });

  describe("2. Upstox F&O Instrument Key Resolution", () => {
    it("correctly maps underlying index names to official Upstox index instrument keys", async () => {
      expect(DERIVATIVE_UNDERLYING_MAP["NIFTY"]).toBe("NSE_INDEX|Nifty 50");
      expect(DERIVATIVE_UNDERLYING_MAP["BANKNIFTY"]).toBe("NSE_INDEX|Nifty Bank");
      expect(DERIVATIVE_UNDERLYING_MAP["SENSEX"]).toBe("BSE_INDEX|SENSEX");

      const niftyKey = await upstoxMarketDataService.resolveInstrumentKey("NIFTY");
      expect(niftyKey).toBe("NSE_INDEX|Nifty 50");

      const sensexKey = await upstoxMarketDataService.resolveInstrumentKey("SENSEX");
      expect(sensexKey).toBe("BSE_INDEX|SENSEX");
    });

    it("preserves explicit NSE_FO and BSE_FO derivative instrument keys", async () => {
      const foKey = "NSE_FO|52433";
      const resolved = await upstoxMarketDataService.resolveInstrumentKey(foKey);
      expect(resolved).toBe(foKey);
    });
  });

  describe("3. Derivatives Service Available Symbols & Lot Sizes", () => {
    it("returns available symbols including NIFTY, BANKNIFTY, and equity underlyings", async () => {
      const { symbols, lotSizes } = await derivativesService.getAvailableSymbols();

      expect(symbols).toContain("NIFTY");
      expect(symbols).toContain("BANKNIFTY");
      expect(symbols).toContain("RELIANCE");
      expect(symbols).toContain("TCS");

      expect(lotSizes["NIFTY"]).toBeGreaterThanOrEqual(65);
      expect(lotSizes["BANKNIFTY"]).toBeGreaterThanOrEqual(30);
      expect(lotSizes["RELIANCE"]).toBeGreaterThanOrEqual(250);
    });

    it("calculates Black-Scholes Greeks with valid delta and positive IV", () => {
      const greeks = derivativesService.calculateGreeks(
        24000, // spot
        24000, // strike (ATM)
        7,     // 7 days to expiry
        0.15,  // 15% IV
        0.065, // risk free rate 6.5%
        "call"
      );

      expect(greeks.delta).toBeGreaterThan(0.4);
      expect(greeks.delta).toBeLessThan(0.6);
      expect(greeks.gamma).toBeGreaterThan(0);
      expect(greeks.impliedVolatility).toBe(15);
    });
  });

  describe("4. Instrument Search Service DERIVATIVE Asset Type", () => {
    it("supports DERIVATIVE in search result assetType definition", async () => {
      const sampleItem = {
        id: "test-id",
        name: "NIFTY26MAR24000CE (OPTIDX)",
        symbol: "NIFTY26MAR24000CE",
        isin: "NSE_FO|52433",
        assetType: "DERIVATIVE" as const,
        matchScore: 95,
        matchField: "symbol" as const,
      };

      expect(sampleItem.assetType).toBe("DERIVATIVE");
      expect(sampleItem.symbol).toContain("CE");

      // Verify instrumentSearchService executes search without throwing
      const results = await instrumentSearchService.search("NIFTY", 5);
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe("5. Multi-Expiry Term Structure Comparison (CE & PE)", () => {
    it("computes 3-month ATM Call option term structure with next-month recommendation", async () => {
      const result = await derivativesService.getMultiExpiryCalls("NIFTY", "CE");

      expect(result.symbol).toBe("NIFTY");
      expect(result.optionType).toBe("CE");
      expect(result.calls.length).toBe(3);
      expect(result.recommendedTenure).toBe("next_month");
      expect(result.calls[1].isRecommended).toBe(true);
      expect(result.calls[1].thetaReductionPct).toBeGreaterThan(0);
      expect(result.calls[0].tenure).toBe("near_month");
      expect(result.calls[1].tenure).toBe("next_month");
      expect(result.calls[2].tenure).toBe("far_month");

      for (const call of result.calls) {
        expect(call.optionType).toBe("CE");
        expect(call.breakeven).toBeGreaterThan(call.strikePrice);
        expect(call.delta).toBeGreaterThan(0);
        expect(call.dailyThetaCostPerLot).toBeGreaterThan(0);
        expect(call.pop).toBeGreaterThan(0);
      }
    }, 15000);

    it("computes 3-month ATM Put option term structure for downside hedging", async () => {
      const result = await derivativesService.getMultiExpiryCalls("NIFTY", "PE");

      expect(result.symbol).toBe("NIFTY");
      expect(result.optionType).toBe("PE");
      expect(result.calls.length).toBe(3);
      expect(result.strategicSummary).toContain("put buyers and portfolio hedgers");

      for (const put of result.calls) {
        expect(put.optionType).toBe("PE");
        expect(put.breakeven).toBeLessThan(put.strikePrice);
        expect(put.delta).toBeLessThan(0);
        expect(put.dailyThetaCostPerLot).toBeGreaterThan(0);
      }
    }, 15000);
  });
});

