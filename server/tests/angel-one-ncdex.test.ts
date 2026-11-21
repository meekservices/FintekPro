/**
 * angel-one-ncdex.test.ts
 *
 * Tests for Angel One SmartAPI Adapter & NCDEX Agricultural Commodity Integration.
 */

import { describe, it, expect } from "vitest";
import {
  base32Decode,
  generateTOTP,
  angelOneAdapter,
  ANGEL_NCDEX_BENCHMARK_TOKENS,
} from "../services/adapters/angel-one-adapter";
import { ncdexMarketService, NCDEX_BASELINE_COMMODITIES } from "../services/ncdex-market-service";
import { MarketDataDecisionEngine } from "../services/market-data-decision-matrix";

describe("Angel One SmartAPI Adapter — RFC 6238 TOTP & Config", () => {
  it("decodes Base32 string into correct byte buffer", () => {
    // "JBSWY3DPEHPK3PXP" is the standard RFC test key for "Hello!\xde\xad\xbe\xef"
    const decoded = base32Decode("JBSWY3DPEHPK3PXP");
    expect(decoded).toBeInstanceOf(Buffer);
    expect(decoded.length).toBe(10);
    expect(decoded.toString("utf8", 0, 6)).toBe("Hello!");
  });

  it("generates deterministic 6-digit RFC 6238 TOTP codes", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const t0 = 1700000000; // Fixed timestamp
    const totp1 = generateTOTP(secret, t0);
    const totp2 = generateTOTP(secret, t0);

    expect(totp1).toBe(totp2);
    expect(totp1.length).toBe(6);
    expect(/^\d{6}$/.test(totp1)).toBe(true);

    // After 30 seconds, code should rotate
    const totp3 = generateTOTP(secret, t0 + 30);
    expect(totp3.length).toBe(6);
  });

  it("reports NCDEX exchange segment support and adapter status", () => {
    const status = angelOneAdapter.getStatus();
    expect(status.ncdexSupported).toBe(true);
    expect(status.exchangeSegment).toBe("ncx_fo");
    expect(typeof status.configured).toBe("boolean");
  });

  it("defines benchmark contract tokens for all major NCDEX commodities", () => {
    const requiredCommodities = [
      "JEERA",
      "TURMERIC",
      "GUARSEED",
      "COCUDAKL",
      "DHANIYA",
      "CASTORSEED",
      "CHANA",
    ];

    for (const key of requiredCommodities) {
      expect(ANGEL_NCDEX_BENCHMARK_TOKENS[key]).toBeDefined();
      expect(ANGEL_NCDEX_BENCHMARK_TOKENS[key].symbolToken).toBeDefined();
      expect(ANGEL_NCDEX_BENCHMARK_TOKENS[key].lotSize).toBeGreaterThan(0);
    }
  });
});

describe("Market Data Decision Matrix — NCDEX Routing", () => {
  it("routes NCDEX_AGRI_COMMODITIES to ANGEL_ONE provider", () => {
    const decision = MarketDataDecisionEngine.evaluate("NCDEX_AGRI_COMMODITIES");
    expect(decision.recommendedProvider).toBe("ANGEL_ONE");
    expect(decision.protocol).toBe("REST_BATCH");
    expect(decision.targetLatencyMs).toBeLessThanOrEqual(2000);
    expect(decision.rationale).toContain("Upstox does not cover NCDEX");
  });
});

describe("NCDEX Market Service — Agri Benchmarks & Self-Healing Fallback", () => {
  it("returns institutional benchmarks for all 7 agri commodities", async () => {
    const res = await ncdexMarketService.getAgriculturalBenchmarks({ persistToDb: false });
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.commodities.length).toBe(7);

    const ids = res.data?.commodities.map((c) => c.id);
    expect(ids).toContain("JEERA");
    expect(ids).toContain("TURMERIC");
    expect(ids).toContain("GUARSEED");
    expect(ids).toContain("COCUDAKL");
    expect(ids).toContain("DHANIYA");
    expect(ids).toContain("CASTORSEED");
    expect(ids).toContain("CHANA");

    // Agri inflation index calculated
    expect(res.data?.agriInflationIndex).toBeDefined();
    expect(["Deflationary", "Benign", "Elevated"]).toContain(res.data?.agriInflationIndex.status);
  });
});
