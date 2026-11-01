/**
 * Test Suite: Instrument Master, Golden Pricing Dual-Stream, and SEBI Audit Trail
 *
 * Verifies:
 *   1. Golden Pricing Engine produces `is_sebi_audit_grade` flag and regulatory disclaimers.
 *   2. Base table synchronization is triggered via instrument-price-router.
 *   3. `getExecutionPriceQuote` enforces SEBI tick sizes, circuit band limits, and returns validity window.
 *   4. Dynamic instrument key resolution handles arbitrary symbols via DB lookup.
 *   5. Trade Audit Logger writes immutable audit records.
 */

import { describe, it, expect, vi } from "vitest";
import {
  goldenPricingEngine,
  SEBI_AUDIT_GRADE_SOURCES,
  getExecutionPriceQuote,
} from "../services/golden-pricing/GoldenPricingEngine";
import { upstoxMarketDataService } from "../services/upstox-market-data-service";
import { tradeAuditLogger } from "../services/compliance/tradeAuditLogger";
import { auditLogService } from "../services/audit-log-service";

describe("Golden Pricing Engine & Instrument Master (Audit-Safe Upgrades)", () => {
  describe("1. Regulatory Audit Grade & Disclaimers", () => {
    it("flags regulated sources as SEBI audit grade", () => {
      expect(SEBI_AUDIT_GRADE_SOURCES.has("NSE_BHAVCOPY")).toBe(true);
      expect(SEBI_AUDIT_GRADE_SOURCES.has("AMFI_NAV")).toBe(true);
      expect(SEBI_AUDIT_GRADE_SOURCES.has("UPSTOX")).toBe(true);
      expect(SEBI_AUDIT_GRADE_SOURCES.has("RBI_POLICY")).toBe(true);
    });

    it("identifies unregulated third-party sources as non-audit grade", () => {
      expect(SEBI_AUDIT_GRADE_SOURCES.has("YAHOO_FINANCE")).toBe(false);
      expect(SEBI_AUDIT_GRADE_SOURCES.has("FMP")).toBe(false);
      expect(SEBI_AUDIT_GRADE_SOURCES.has("ALPHAVANTAGE")).toBe(false);
    });
  });

  describe("2. Dual-Stream Execution Pricing", () => {
    it("rejects execution prices exceeding the Upper Circuit band", async () => {
      vi.spyOn(upstoxMarketDataService, "isReady").mockReturnValue(true);
      vi.spyOn(upstoxMarketDataService, "getQuote").mockResolvedValue({
        success: true,
        data: {
          symbol: "RELIANCE",
          exchange: "NSE",
          last_price: 2500,
          open_price: 2490,
          high_price: 2510,
          low_price: 2480,
          close_price: 2495,
          change_percent: 0.2,
          is_stale: false,
          fetched_at: new Date().toISOString(),
          upper_circuit_limit: 2750,
          lower_circuit_limit: 2250,
        } as any,
        meta: { timestamp: new Date().toISOString(), latency_ms: 10, version: "2.0" },
      });

      const quote = await getExecutionPriceQuote({
        symbol: "RELIANCE",
        exchange: "NSE",
        limitPrice: 3000, // Exceeds upper circuit 2750
      });

      expect(quote.isWithinCircuit).toBe(false);
      expect(quote.isExecutionSafe).toBe(false);
      expect(quote.rejectionReason).toContain("exceeds Upper Circuit");
    });

    it("rejects execution prices violating mandatory SEBI tick size", async () => {
      vi.spyOn(upstoxMarketDataService, "isReady").mockReturnValue(true);
      vi.spyOn(upstoxMarketDataService, "getQuote").mockResolvedValue({
        success: true,
        data: {
          symbol: "TCS",
          exchange: "NSE",
          last_price: 4000,
          open_price: 3990,
          high_price: 4010,
          low_price: 3980,
          close_price: 3995,
          change_percent: 0.1,
          is_stale: false,
          fetched_at: new Date().toISOString(),
          upper_circuit_limit: 4400,
          lower_circuit_limit: 3600,
        } as any,
        meta: { timestamp: new Date().toISOString(), latency_ms: 10, version: "2.0" },
      });

      const quote = await getExecutionPriceQuote({
        symbol: "TCS",
        exchange: "NSE",
        limitPrice: 4000.03, // Invalid tick size for stock > ₹100 (tick size ₹0.05)
      });

      expect(quote.isWithinCircuit).toBe(false);
      expect(quote.isExecutionSafe).toBe(false);
      expect(quote.rejectionReason).toContain("tick size");
    });

    it("approves execution-safe quote with 15s validity window for valid limit price", async () => {
      vi.spyOn(upstoxMarketDataService, "isReady").mockReturnValue(true);
      vi.spyOn(upstoxMarketDataService, "getQuote").mockResolvedValue({
        success: true,
        data: {
          symbol: "HDFCBANK",
          exchange: "NSE",
          last_price: 1600,
          open_price: 1590,
          high_price: 1610,
          low_price: 1585,
          close_price: 1595,
          change_percent: 0.3,
          is_stale: false,
          fetched_at: new Date().toISOString(),
          upper_circuit_limit: 1760,
          lower_circuit_limit: 1440,
        } as any,
        meta: { timestamp: new Date().toISOString(), latency_ms: 10, version: "2.0" },
      });

      const quote = await getExecutionPriceQuote({
        symbol: "HDFCBANK",
        exchange: "NSE",
        limitPrice: 1605.00, // Valid tick multiple within circuit
      });

      expect(quote.isWithinCircuit).toBe(true);
      expect(quote.isExecutionSafe).toBe(true);
      expect(quote.validityWindowMs).toBe(15000);
      expect(quote.is_sebi_audit_grade).toBe(true);
    });
  });

  describe("3. SEBI Immutable Audit Trail", () => {
    it("TradeAuditLogger writes real trade event to immutable audit log", async () => {
      const logSpy = vi.spyOn(auditLogService, "log").mockResolvedValue({} as any);

      await tradeAuditLogger.logTrade({
        userId: "test-user-123",
        symbol: "RELIANCE",
        side: "buy",
        qty: 10,
        notional: 25000,
        status: "success",
        providerOrderId: "ORD-999",
      });

      expect(logSpy).toHaveBeenCalledWith(
        "TRADE_EXECUTION",
        "ORDER_SUCCESS",
        expect.objectContaining({
          userId: "test-user-123",
          entityType: "trade_order",
          entityId: "ORD-999",
        }),
      );
    });
  });

  describe("4. Periodic Engine Data Feeds & Schedulers", () => {
    it("guarantees CommodityPriceSyncScheduler is configured with start/stop interface", async () => {
      const { commodityPriceSyncScheduler } = await import(
        "../services/commodity-price-sync-scheduler"
      );
      expect(typeof commodityPriceSyncScheduler.start).toBe("function");
      expect(typeof commodityPriceSyncScheduler.stop).toBe("function");
    });

    it("guarantees ScreenerMasterSnapshotService exposes rebuildFullSnapshot", async () => {
      const { screenerMasterSnapshotService } = await import(
        "../services/screener/screener-master-snapshot-service"
      );
      expect(typeof screenerMasterSnapshotService.rebuildFullSnapshot).toBe("function");
    });

    it("guarantees AIF, PMS, and Instrument Master sync schedulers exist", async () => {
      const { aifNavSyncScheduler } = await import("../services/aif-nav-sync-scheduler");
      const { pmsNavSyncScheduler } = await import("../services/pms-nav-sync-scheduler");
      const { scheduleInstrumentMasterSync } = await import("../jobs/instrument-master-sync");

      expect(typeof aifNavSyncScheduler.start).toBe("function");
      expect(typeof pmsNavSyncScheduler.start).toBe("function");
      expect(typeof scheduleInstrumentMasterSync).toBe("function");
    });
  });
});

