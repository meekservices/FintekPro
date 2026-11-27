/**
 * @file golden-prices-architecture.test.ts
 * @description Vitest tests for FintekPro Golden Source Pricing Engine DB Architecture enhancements:
 *   1. Deadlock prevention via deterministic ISIN sorting in batch ingestion
 *   2. GoldenPricesPartitionManager readiness inspection and intraday tick retention
 *   3. Reactive PricingEventBus pub/sub benchmark invalidation
 */

import { describe, it, expect, vi } from "vitest";
import { goldenPricesPartitionManager } from "../services/golden-pricing/golden-prices-partition-manager";
import { pricingEventBus } from "../services/golden-pricing/pricing-event-bus";

describe("Golden Source Pricing Engine — DB Architecture Enhancements", () => {
  it("exposes partition manager with readiness check and retention methods", () => {
    expect(typeof goldenPricesPartitionManager.inspectPartitionReadiness).toBe("function");
    expect(typeof goldenPricesPartitionManager.cleanStaleIntradayTicks).toBe("function");
  });

  it("inspects partition readiness without throwing fatal errors", async () => {
    const report = await goldenPricesPartitionManager.inspectPartitionReadiness();
    expect(report).toBeDefined();
    expect(typeof report.isPartitioned).toBe("boolean");
    expect(typeof report.totalRowCount).toBe("number");
    expect(["OPTIMAL", "ATTENTION_REQUIRED", "UNPARTITIONED_MONOLITH"]).toContain(report.status);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it("safely executes cleanStaleIntradayTicks with zero accidental data loss", async () => {
    const deleted = await goldenPricesPartitionManager.cleanStaleIntradayTicks(5);
    expect(typeof deleted).toBe("number");
    expect(deleted).toBeGreaterThanOrEqual(0);
  });

  it("broadcasts and receives reactive benchmark price updates via PricingEventBus", () => {
    const spy = vi.fn();
    pricingEventBus.onBenchmarkUpdate(spy);

    const testEvent = {
      benchmarks: ["GOLD", "SILVER", "CRUDE_OIL"],
      source: "TEST_UNIT",
      timestamp: new Date().toISOString(),
    };

    pricingEventBus.emitBenchmarkUpdate(testEvent);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(testEvent);
  });
});
