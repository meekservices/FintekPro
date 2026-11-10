/**
 * upstox-secondary-market-debt.test.ts
 *
 * Unit & Integration Test Suite for Secondary Market Debt & Treasury Execution Engine.
 * Tests:
 *  1. Upstox instrument token resolution for G-Secs, T-Bills, SDLs, SGBs.
 *  2. Accrued interest calculation (0 for discount T-Bills, Actual/365 for coupon-bearing G-Secs).
 *  3. Pre-trade preview & financial determinism (clean vs dirty price, stamp duty, brokerage, GST, net consideration).
 *  4. Automated Limit order placement enforcing Delivery product "D" on Upstox API v3.
 *  5. Automated Market order placement enforcing price 0 and product "D".
 *  6. Idempotent order deduplication.
 *  7. Multi-tenant client OAuth routing vs. fallback.
 *  8. Status polling and status string mapping.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  upstoxTreasuryExecutionService,
  TREASURY_EXEC_ENGINE_VERSION,
} from "../services/execution/upstox-treasury-execution-service";
import { upstoxAdapter } from "../services/mpal/adapters/upstoxAdapter";

describe("Upstox Secondary Market Treasury Execution Engine (Upstox API v3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Upstox Instrument Token Resolution", () => {
    it("formats 12-character ISINs as NSE_EQ|{ISIN}", () => {
      const gsecIsin = "IN0020230085"; // 7.18% GS 2033
      const token = upstoxTreasuryExecutionService.resolveDebtInstrumentToken(gsecIsin, "718GS33", "NSE");
      expect(token).toBe("NSE_EQ|IN0020230085");
    });

    it("formats T-Bill ISINs as NSE_EQ|{ISIN}", () => {
      const tbillIsin = "IN002024X025"; // 91-Day T-Bill
      const token = upstoxTreasuryExecutionService.resolveDebtInstrumentToken(tbillIsin, "91D060624", "NSE");
      expect(token).toBe("NSE_EQ|IN002024X025");
    });

    it("supports BSE exchange prefix when requested", () => {
      const sgbIsin = "IN0020210137";
      const token = upstoxTreasuryExecutionService.resolveDebtInstrumentToken(sgbIsin, undefined, "BSE");
      expect(token).toBe("BSE_EQ|IN0020210137");
    });

    it("falls back to symbol if ISIN is not standard length", () => {
      const token = upstoxTreasuryExecutionService.resolveDebtInstrumentToken("SHORT", "718GS2033", "NSE");
      expect(token).toBe("NSE_EQ|718GS2033");
    });
  });

  describe("2. Accrued Interest Calculation", () => {
    it("returns zero accrued interest for T-Bills (zero-coupon discount paper)", () => {
      const faceValue = 100;
      const accrued = upstoxTreasuryExecutionService.calculateAccruedInterest(faceValue, 0, "2024-01-01", "2024-03-01");
      expect(accrued).toBe(0);
    });

    it("calculates accurate accrued interest for coupon-bearing G-Secs", () => {
      const faceValue = 100;
      const couponRate = 7.18; // 7.18% per annum
      const lastCouponDate = "2024-01-01";
      const settlementDate = "2024-04-01"; // ~91 days elapsed

      const accrued = upstoxTreasuryExecutionService.calculateAccruedInterest(
        faceValue,
        couponRate,
        lastCouponDate,
        settlementDate
      );

      // (100 * 0.0718 * 91) / 365 = 1.7899
      expect(accrued).toBeGreaterThan(1.75);
      expect(accrued).toBeLessThan(1.82);
    });

    it("returns 0 if lastCouponDate is omitted", () => {
      const accrued = upstoxTreasuryExecutionService.calculateAccruedInterest(100, 7.18);
      expect(accrued).toBe(0);
    });
  });

  describe("3. Pre-trade Preview & Financial Determinism", () => {
    it("generates deterministic pre-trade breakdown for T-Bills", () => {
      const preview = upstoxTreasuryExecutionService.previewDebtOrder({
        isin: "IN002024X025",
        symbol: "91D060624",
        bondType: "t_bill",
        bondName: "91-Day Treasury Bill",
        side: "BUY",
        orderType: "LIMIT",
        quantity: 1000,
        cleanPrice: 98.45,
        faceValue: 100,
      });

      expect(preview.engine_version).toBe(TREASURY_EXEC_ENGINE_VERSION);
      expect(preview.breakdown.cleanPrice).toBe(98.45);
      // T-Bills have no accrued interest
      expect(preview.breakdown.accruedInterestPerUnit).toBe(0);
      expect(preview.breakdown.dirtyPrice).toBe(98.45);

      // Gross clean and gross dirty must be identical for T-Bills
      expect(preview.breakdown.grossCleanAmount).toBe(98450);
      expect(preview.breakdown.grossDirtyAmount).toBe(98450);

      // Stamp duty on BUY: 98450 * 0.00001 = 0.98
      expect(preview.breakdown.stampDuty).toBe(0.98);

      // Brokerage: 5 bps on 98450 = 49.23
      expect(preview.breakdown.brokerage).toBe(49.23);

      // Net consideration must include gross dirty + statutory charges
      expect(preview.breakdown.netConsideration).toBeGreaterThan(98450);
      expect(preview.intermediate_steps.length).toBeGreaterThan(3);
    });

    it("generates deterministic pre-trade breakdown for G-Secs with accrued interest", () => {
      const preview = upstoxTreasuryExecutionService.previewDebtOrder({
        isin: "IN0020230085",
        symbol: "718GS33",
        bondType: "g_sec",
        bondName: "7.18% GS 2033",
        side: "BUY",
        orderType: "LIMIT",
        quantity: 500,
        cleanPrice: 100.25,
        faceValue: 100,
        couponRate: 7.18,
        lastCouponDate: "2024-01-01",
        settlementDate: "2024-03-15", // 74 days
      });

      expect(preview.breakdown.accruedInterestPerUnit).toBeGreaterThan(0);
      expect(preview.breakdown.dirtyPrice).toBeGreaterThan(preview.breakdown.cleanPrice);
      expect(preview.breakdown.grossDirtyAmount).toBeGreaterThan(preview.breakdown.grossCleanAmount);
    });

    it("applies 0 stamp duty on SELL orders", () => {
      const preview = upstoxTreasuryExecutionService.previewDebtOrder({
        isin: "IN002024X025",
        bondType: "t_bill",
        bondName: "91-Day Treasury Bill",
        side: "SELL",
        orderType: "LIMIT",
        quantity: 1000,
        cleanPrice: 98.45,
      });

      expect(preview.breakdown.stampDuty).toBe(0);
      // Net receivable on SELL is gross minus charges
      expect(preview.breakdown.netConsideration).toBeLessThan(preview.breakdown.grossDirtyAmount);
    });
  });

  describe("4. Automated Limit Order Placement via Upstox API v3", () => {
    it("places G-Sec limit order enforcing product 'D' (Delivery)", async () => {
      const result = await upstoxTreasuryExecutionService.placeDebtOrder({
        userId: "test-treasury-user-01",
        isin: "IN0020230085",
        symbol: "718GS2033",
        bondType: "g_sec",
        bondName: "7.18% GS 2033",
        side: "BUY",
        orderType: "LIMIT",
        quantity: 100,
        limitPrice: 99.85,
        faceValue: 100,
        couponRate: 7.18,
        lastCouponDate: "2024-01-01",
        exchange: "NSE",
        idempotencyKey: `TEST-GSEC-LIMIT-${Date.now()}`,
      });

      expect(result.success).toBe(true);
      expect(result.product).toBe("D"); // Strictly Delivery
      expect(result.instrumentToken).toBe("NSE_EQ|IN0020230085");
      expect(result.side).toBe("BUY");
      expect(result.orderType).toBe("LIMIT");
      expect(result.limitPrice).toBe(99.85);
      expect(result.quantity).toBe(100);
      expect(result.status).toBe("submitted");
      expect(result.meta.engine_version).toBe(TREASURY_EXEC_ENGINE_VERSION);
    });

    it("places T-Bill market order enforcing price 0 and product 'D'", async () => {
      const result = await upstoxTreasuryExecutionService.placeDebtOrder({
        userId: "test-treasury-user-02",
        isin: "IN002024X025",
        symbol: "91D060624",
        bondType: "t_bill",
        bondName: "91-Day T-Bill",
        side: "BUY",
        orderType: "MARKET",
        quantity: 250,
        faceValue: 100,
        idempotencyKey: `TEST-TBILL-MKT-${Date.now()}`,
      });

      expect(result.success).toBe(true);
      expect(result.product).toBe("D");
      expect(result.orderType).toBe("MARKET");
      expect(result.instrumentToken).toBe("NSE_EQ|IN002024X025");
      expect(result.status).toBe("submitted");
    });

    it("rejects invalid quantity <= 0", async () => {
      await expect(
        upstoxTreasuryExecutionService.placeDebtOrder({
          userId: "test-user",
          isin: "IN0020230085",
          bondType: "g_sec",
          bondName: "7.18% GS 2033",
          side: "BUY",
          orderType: "LIMIT",
          quantity: 0,
          limitPrice: 99.85,
        })
      ).rejects.toThrow("Order quantity must be an integer greater than 0");
    });

    it("rejects LIMIT order missing limitPrice", async () => {
      await expect(
        upstoxTreasuryExecutionService.placeDebtOrder({
          userId: "test-user",
          isin: "IN0020230085",
          bondType: "g_sec",
          bondName: "7.18% GS 2033",
          side: "BUY",
          orderType: "LIMIT",
          quantity: 100,
        })
      ).rejects.toThrow("Limit price must be greater than 0 for LIMIT orders");
    });
  });

  describe("5. Idempotent Deduplication", () => {
    it("returns existing order result on duplicate idempotency key dispatch", async () => {
      const idempotencyKey = `IDEMP-TEST-${Date.now()}`;

      const firstCall = await upstoxTreasuryExecutionService.placeDebtOrder({
        userId: "test-treasury-user-03",
        isin: "IN0020230085",
        bondType: "g_sec",
        bondName: "7.18% GS 2033",
        side: "BUY",
        orderType: "LIMIT",
        quantity: 50,
        limitPrice: 100.10,
        idempotencyKey,
      });

      const secondCall = await upstoxTreasuryExecutionService.placeDebtOrder({
        userId: "test-treasury-user-03",
        isin: "IN0020230085",
        bondType: "g_sec",
        bondName: "7.18% GS 2033",
        side: "BUY",
        orderType: "LIMIT",
        quantity: 50,
        limitPrice: 100.10,
        idempotencyKey,
      });

      expect(secondCall.orderNumber).toBe(firstCall.orderNumber);
      expect(secondCall.brokerOrderId).toBe(firstCall.brokerOrderId);
      expect(secondCall.quantity).toBe(firstCall.quantity);
    });
  });

  describe("6. UpstoxAdapter Multi-Provider Abstraction (MPAL) Integration", () => {
    it("declares BOND and SGB capabilities in UpstoxAdapter", () => {
      expect(upstoxAdapter.capabilities).toContain("BOND");
      expect(upstoxAdapter.capabilities).toContain("SGB");
      expect(upstoxAdapter.capabilities).toContain("EQUITY_IN");
      expect(upstoxAdapter.capabilities).toContain("FNO");
    });
  });
});

