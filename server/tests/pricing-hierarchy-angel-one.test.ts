import { describe, it, expect, vi } from "vitest";
import {
  SEBI_AUDIT_GRADE_SOURCES,
  SOURCE_CONFIDENCE,
} from "../services/golden-pricing/GoldenPricingEngine";
import { angelOneAdapter } from "../services/adapters/angel-one-adapter";
import { unifiedStockPriceService } from "../services/unified-stock-price-service";
import { multiVendorInstrumentResolver } from "../services/instruments/multi-vendor-resolver";
import { stockQuarterlyFinancialsService } from "../services/stock-quarterly-financials-service";

describe("Pricing Hierarchy & Provider Order (Upstox -> Angel One -> IndianAPI)", () => {
  it("includes ANGEL_ONE in SEBI_AUDIT_GRADE_SOURCES", () => {
    expect(SEBI_AUDIT_GRADE_SOURCES.has("UPSTOX")).toBe(true);
    expect(SEBI_AUDIT_GRADE_SOURCES.has("ANGEL_ONE")).toBe(true);
    expect(SEBI_AUDIT_GRADE_SOURCES.has("INDIAN_API")).toBe(true);
  });

  it("enforces strict confidence ordering: UPSTOX > ANGEL_ONE > INDIAN_API", () => {
    expect(SOURCE_CONFIDENCE.UPSTOX).toBe(96);
    expect(SOURCE_CONFIDENCE.ANGEL_ONE).toBe(95);
    expect(SOURCE_CONFIDENCE.INDIAN_API).toBe(93);

    expect(SOURCE_CONFIDENCE.UPSTOX).toBeGreaterThan(SOURCE_CONFIDENCE.ANGEL_ONE);
    expect(SOURCE_CONFIDENCE.ANGEL_ONE).toBeGreaterThan(SOURCE_CONFIDENCE.INDIAN_API);
  });

  it("exposes Angel One equity and index quote resolution methods", () => {
    expect(typeof angelOneAdapter.isReady).toBe("function");
    expect(typeof angelOneAdapter.getEquityQuote).toBe("function");
    expect(typeof angelOneAdapter.getIndexQuote).toBe("function");
    expect(typeof angelOneAdapter.getIndices).toBe("function");
  });

  it("enforces multiVendorResolver equity priority: upstox (1) -> angelone (2) -> indianapi (3)", () => {
    const matrix = (multiVendorInstrumentResolver as any).routingMatrix?.equity;
    expect(matrix).toBeDefined();

    const upstox = matrix.find((m: any) => m.vendor === "upstox");
    const angelone = matrix.find((m: any) => m.vendor === "angelone");
    const indianapi = matrix.find((m: any) => m.vendor === "indianapi");

    expect(upstox).toBeDefined();
    expect(angelone).toBeDefined();
    expect(indianapi).toBeDefined();

    expect(upstox.priority).toBe(1);
    expect(angelone.priority).toBe(2);
    expect(indianapi.priority).toBe(3);
  });

  it("tracks angel_one in UnifiedStockPriceService provider health and tier ordering", () => {
    const health = unifiedStockPriceService.getProviderHealth();
    const providers = health.map((h) => h.provider);

    expect(providers).toContain("upstox");
    expect(providers).toContain("angel_one");
    expect(providers).toContain("indianapi");

    const upstoxIdx = providers.indexOf("upstox");
    const angelIdx = providers.indexOf("angel_one");
    const indianIdx = providers.indexOf("indianapi");

    expect(upstoxIdx).toBeLessThan(angelIdx);
    expect(angelIdx).toBeLessThan(indianIdx);
  });

  it("prioritizes local DB screener unpack before IndianAPI in stockQuarterlyFinancialsService", async () => {
    const unpackSpy = vi
      .spyOn(stockQuarterlyFinancialsService, "unpackScreenerQuarterlyHistory")
      .mockResolvedValueOnce(8);
    const syncApiSpy = vi
      .spyOn(stockQuarterlyFinancialsService, "syncStockFromIndianAPI")
      .mockResolvedValueOnce(8);

    const count = await stockQuarterlyFinancialsService.refreshStockQuarterly("RELIANCE");
    expect(count).toBe(8);
    expect(unpackSpy).toHaveBeenCalledWith("RELIANCE", undefined);
    expect(syncApiSpy).not.toHaveBeenCalled();
  });
});
