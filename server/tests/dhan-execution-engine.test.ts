/**
 * DhanHQ Partner API & Execution Engine Tests
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates:
 *   1. DhanAdapter instantiation, capabilities, and health check in sandbox mode.
 *   2. Registration in MPAL ProviderRegistry.
 *   3. Sandbox order execution, slicing, and status lifecycle.
 *   4. Dhan Postback Webhook status mapping and payload handling.
 *   5. OAuth Connect and Partner Lead URL generators.
 */

import { describe, it, expect } from "vitest";
import { dhanAdapter, DhanAdapter } from "../services/mpal/adapters/dhanAdapter";
import { providerRegistry } from "../services/mpal/core/providerRegistry";
import { dhanWebhookHandler } from "../services/dhan-webhook-handler";

describe("DhanHQ Partner API Integration Engine", () => {
  describe("1. DhanAdapter Core & Capabilities", () => {
    it("declares brokerId as 'DHAN'", () => {
      expect(dhanAdapter.brokerId).toBe("DHAN");
    });

    it("declares expected capabilities: EQUITY_IN, FNO, COMMODITY", () => {
      expect(dhanAdapter.capabilities).toContain("EQUITY_IN");
      expect(dhanAdapter.capabilities).toContain("FNO");
      expect(dhanAdapter.capabilities).toContain("COMMODITY");
    });

    it("healthCheck completes gracefully in sandbox/unconfigured mode", async () => {
      const health = await dhanAdapter.healthCheck(1000);
      expect(health.brokerId).toBe("DHAN");
      expect(typeof health.configured).toBe("boolean");
      expect(typeof health.healthy).toBe("boolean");
      expect(health.checkedAt).toBeDefined();
    });

    it("rejects fractional/notional cash orders with BrokerCapabilityError", async () => {
      await expect(
        dhanAdapter.placeNotionalOrder("user-1", "RELIANCE.NS", 10000, "buy")
      ).rejects.toThrow();
    });
  });

  describe("2. ProviderRegistry Registration", () => {
    it("registers DHAN in ProviderRegistry", () => {
      // getCapableBrokers should include DHAN if configured, or getBroker throws BrokerNotConfiguredError if missing env
      const hasDhan = (providerRegistry as any).brokers.has("DHAN");
      expect(hasDhan).toBe(true);
    });
  });

  describe("3. Order Placement & Slicing in Sandbox Mode", () => {
    it("places a sandbox order and returns submitted/filled result", async () => {
      const orderResult = await dhanAdapter.placeOrder({
        userId: "test-user-123",
        symbol: "HDFCBANK.NS",
        capability: "EQUITY_IN",
        side: "buy",
        qty: 10,
        type: "limit",
        limitPrice: 1650.5,
        idempotencyKey: `test-dhan-${Date.now()}`,
        meta: {
          productType: "CNC",
          securityId: "1333",
        },
      });

      expect(orderResult.brokerOrderId).toBeDefined();
      expect(["submitted", "filled"]).toContain(orderResult.status);
      expect(orderResult.brokerTimestamp).toBeDefined();
    });

    it("supports native order slicing for large basket orders", async () => {
      const sliceResults = await dhanAdapter.placeSliceOrder({
        userId: "test-user-123",
        symbol: "NIFTY-ETF",
        capability: "EQUITY_IN",
        side: "buy",
        qty: 5000, // Large quantity
        type: "limit",
        limitPrice: 250,
        idempotencyKey: `test-slice-${Date.now()}`,
        meta: {
          securityId: "5001",
        },
      });

      expect(Array.isArray(sliceResults)).toBe(true);
      expect(sliceResults.length).toBeGreaterThan(0);
      expect(sliceResults[0].brokerOrderId).toBeDefined();
    });

    it("throws INVALID_QUANTITY if order quantity is zero or negative", async () => {
      await expect(
        dhanAdapter.placeOrder({
          userId: "test-user-123",
          symbol: "TCS.NS",
          capability: "EQUITY_IN",
          side: "buy",
          qty: 0,
          type: "market",
        })
      ).rejects.toThrow(/quantity/i);
    });
  });

  describe("4. Postback Webhook Handler", () => {
    it("correctly maps Dhan status codes to FintekPro statuses", () => {
      expect(dhanWebhookHandler.mapStatus("TRADED")).toBe("executed");
      expect(dhanWebhookHandler.mapStatus("FILLED")).toBe("executed");
      expect(dhanWebhookHandler.mapStatus("REJECTED")).toBe("failed");
      expect(dhanWebhookHandler.mapStatus("CANCELLED")).toBe("cancelled");
      expect(dhanWebhookHandler.mapStatus("PARTIALLY_TRADED")).toBe("partially_filled");
      expect(dhanWebhookHandler.mapStatus("TRANSIT")).toBe("submitted");
    });

    it("handles postback payload gracefully when order is missing in DB", async () => {
      const res = await dhanWebhookHandler.handlePostback({
        orderId: "NON_EXISTENT_ORDER_9999",
        orderStatus: "TRADED",
        filledQty: 10,
        avgPrice: 1650,
        correlationId: "tag-12345",
      });

      expect(res.processed).toBe(true);
      expect(res.orderId).toBe("NON_EXISTENT_ORDER_9999");
      expect(res.status).toBe("executed");
    });
  });

  describe("5. OAuth & Partner Links", () => {
    it("generates correct partner login dialog URL", () => {
      const url = dhanAdapter.getLoginDialogUrl("MY_CLIENT_ID", "https://fintekpro.com/cb", "my-state");
      expect(url).toContain("https://auth.dhan.co/login/consent-login");
      expect(url).toContain("redirect_uri=");
      expect(url).toContain("state=my-state");
    });

    it("generates partner lead onboarding URL with partner ID parameter", () => {
      const leadUrl = dhanAdapter.getPartnerLeadUrl("PARTNER_XYZ");
      expect(leadUrl).toContain("https://invite.dhan.co/?join=PARTNER_XYZ");
    });
  });
});
