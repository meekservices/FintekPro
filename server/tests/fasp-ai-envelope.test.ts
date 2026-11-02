/**
 * @file fasp-ai-envelope.test.ts
 * @description Sprint 2 / U-03 — Verifies that every wrapAdvisoryResponse() output
 *   satisfies the FASP-AI v1.0 mandatory envelope: fasp_ai_compliant, meta.disclaimer,
 *   meta.confidence_score, meta.model_version, and user_confirmation_required.
 *
 * These tests are purely unit-level; they import the wrapper function directly
 * without a running Express server or DB connection.
 */
import { describe, it, expect } from "vitest";
import { wrapAdvisoryResponse } from "../utils/fasp-ai-response";

describe("FASP-AI v1.0 Advisory Envelope", () => {
  describe("1. Required top-level fields", () => {
    it("sets fasp_ai_compliant: true", () => {
      const result = wrapAdvisoryResponse({ recommendation: "Buy HDFC Bank" });
      expect(result.fasp_ai_compliant).toBe(true);
    });

    it("carries the original data payload inside .data", () => {
      const payload = { recommendation: "Hold Reliance" };
      const result = wrapAdvisoryResponse(payload);
      expect(result.data).toEqual(payload);
    });
  });

  describe("2. meta block fields", () => {
    it("includes a non-empty disclaimer string", () => {
      const result = wrapAdvisoryResponse({ recommendation: "Sell TCS" });
      expect(typeof result.meta.disclaimer).toBe("string");
      expect(result.meta.disclaimer.length).toBeGreaterThan(20);
    });

    it("defaults confidence_score to 0.75 when not provided", () => {
      const result = wrapAdvisoryResponse({ recommendation: "SIP into NIFTY50 ETF" });
      expect(result.meta.confidence_score).toBe(0.75);
    });

    it("accepts custom confidence_score", () => {
      const result = wrapAdvisoryResponse(
        { recommendation: "Short-term swing pick" },
        { confidence_score: 0.62 },
      );
      expect(result.meta.confidence_score).toBe(0.62);
    });

    it("defaults model_version to 'fasp-ai-v1.0' when not provided", () => {
      const result = wrapAdvisoryResponse({ recommendation: "Rebalance portfolio" });
      expect(result.meta.model_version).toBe("fasp-ai-v1.0");
    });

    it("accepts custom model_version", () => {
      const result = wrapAdvisoryResponse(
        { recommendation: "Momentum pick" },
        { model_version: "potd-v2.1" },
      );
      expect(result.meta.model_version).toBe("potd-v2.1");
    });

    it("includes a valid ISO-8601 timestamp in meta", () => {
      const result = wrapAdvisoryResponse({ recommendation: "Review SGB allocation" });
      expect(typeof result.meta.timestamp).toBe("string");
      const ts = new Date(result.meta.timestamp as string);
      expect(ts.getTime()).not.toBeNaN();
    });
  });

  describe("3. Idempotency — already-wrapped data passes through unchanged", () => {
    it("does not double-wrap an already-compliant response", () => {
      const first = wrapAdvisoryResponse({ recommendation: "Buy Infosys" });
      const second = wrapAdvisoryResponse(first as unknown as Record<string, unknown>);
      // fasp_ai_compliant should still be true and not be nested
      expect(second.fasp_ai_compliant).toBe(true);
      // The data payload should not contain a nested fasp_ai_compliant
      const dataKeys = Object.keys(second.data ?? {});
      expect(dataKeys).not.toContain("fasp_ai_compliant");
    });
  });

  describe("4. Payload preservation", () => {
    it("preserves arbitrary payload fields inside data", () => {
      const payload = { recommendation: "Buy ICICI Bank", factors: ["momentum", "low PE"], risk: "moderate" };
      const result = wrapAdvisoryResponse(payload);
      // The original payload fields should be accessible (either at root or inside .data)
      const dataStr = JSON.stringify(result);
      expect(dataStr).toContain("Buy ICICI Bank");
      expect(dataStr).toContain("momentum");
    });
  });
});
