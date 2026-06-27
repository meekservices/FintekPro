/**
 * Unit Tests: stamp-duty-service.ts — v2.0.0-FA2019
 *
 * Validates all stamp duty calculations against Indian Stamp Act 1899
 * (Finance Act 2019 amendment, effective July 1, 2020).
 *
 * DB and logger are mocked so tests run fully offline and don't
 * depend on a Neon/PostgreSQL connection.
 *
 * GCR Compliance:
 *  - Determinism: same input → same output verified for every function
 *  - engine_version present on all outputs
 *  - calculation_timestamp present on all outputs
 */

import { describe, it, expect, vi } from "vitest";

// ── Mock DB and logger before importing the module ──────────────────────────
vi.mock("../db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logCronJob: vi.fn(),
}));

vi.mock("@shared/schema", () => ({
  stampDutyConfig: {},
  stampDutyAuditLog: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  lte: vi.fn(),
  or: vi.fn(),
  gte: vi.fn(),
}));

import {
  STAMP_DUTY_RATES,
  STAMP_DUTY_ENGINE_VERSION,
  stampDutyService,
  type ProductType,
} from "../stamp-duty-service";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Rate Table Completeness
// ─────────────────────────────────────────────────────────────────────────────
describe("STAMP_DUTY_RATES — Finance Act 2019 completeness", () => {
  const REQUIRED_PRODUCTS = [
    "unlisted_shares",
    "equity_delivery",
    "equity_non_delivery",
    "corporate_bond",
    "ncd",
    "tax_free_bond",
    "infrastructure_bond",
    "futures",
    "options",
    "currency_interest_rate_derivatives",
    "mf_units",
    "debenture_issue",
    "g_sec",
    "t_bill",
    "sdl",
    "sgb",
    "bonus_shares",
    "gift_transfer",
  ];

  for (const product of REQUIRED_PRODUCTS) {
    it(`has entry for ${product}`, () => {
      expect(STAMP_DUTY_RATES).toHaveProperty(product);
    });
  }

  it("equity_delivery rate is 1.5 bps (0.015%)", () => {
    expect(STAMP_DUTY_RATES.equity_delivery.rate).toBe(1.5);
  });

  it("equity_non_delivery rate is 0.3 bps (0.003%)", () => {
    expect(STAMP_DUTY_RATES.equity_non_delivery.rate).toBe(0.3);
  });

  it("corporate_bond payer is buyer (FA2019 change)", () => {
    expect(STAMP_DUTY_RATES.corporate_bond.payerSide).toBe("buyer");
  });

  it("ncd payer is buyer (FA2019 change)", () => {
    expect(STAMP_DUTY_RATES.ncd.payerSide).toBe("buyer");
  });

  it("futures rate is 0.2 bps (0.002%)", () => {
    expect(STAMP_DUTY_RATES.futures.rate).toBe(0.2);
  });

  it("options rate is 0.3 bps (0.003%)", () => {
    expect(STAMP_DUTY_RATES.options.rate).toBe(0.3);
  });

  it("bonus_shares is exempt", () => {
    expect(STAMP_DUTY_RATES.bonus_shares.isExempt).toBe(true);
  });

  it("gift_transfer is exempt", () => {
    expect(STAMP_DUTY_RATES.gift_transfer.isExempt).toBe(true);
  });

  it("STAMP_DUTY_ENGINE_VERSION is set", () => {
    expect(STAMP_DUTY_ENGINE_VERSION).toBeTruthy();
    expect(STAMP_DUTY_ENGINE_VERSION).toContain("FA2019");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. calculateStampDuty — Core accuracy
// ─────────────────────────────────────────────────────────────────────────────
describe("calculateStampDuty — core calculations", () => {
  it("unlisted_shares: ₹1,00,000 → ₹15 duty (1.5 bps)", () => {
    const result = stampDutyService.calculateStampDuty("unlisted_shares", 100000);
    expect(result.stampDutyAmount).toBeCloseTo(15, 2);
    expect(result.stampDutyRate).toBe(1.5);
    expect(result.isExempt).toBe(false);
    expect(result.payerSide).toBe("seller");
  });

  it("equity_delivery: ₹1,00,000 → ₹15 duty (1.5 bps), buyer pays", () => {
    const result = stampDutyService.calculateStampDuty("equity_delivery", 100000);
    expect(result.stampDutyAmount).toBeCloseTo(15, 2);
    expect(result.payerSide).toBe("buyer");
  });

  it("equity_non_delivery: ₹1,00,000 → ₹3 duty (0.3 bps)", () => {
    const result = stampDutyService.calculateStampDuty("equity_non_delivery", 100000);
    expect(result.stampDutyAmount).toBeCloseTo(3, 2);
    expect(result.stampDutyRate).toBe(0.3);
  });

  it("corporate_bond: ₹10,00,000 → ₹1 duty (0.01 bps)", () => {
    const result = stampDutyService.calculateStampDuty("corporate_bond", 1_000_000);
    expect(result.stampDutyAmount).toBeCloseTo(1, 2);
    expect(result.payerSide).toBe("buyer");
  });

  it("futures: ₹10,00,000 → ₹20 duty (0.2 bps)", () => {
    const result = stampDutyService.calculateStampDuty("futures", 1_000_000);
    expect(result.stampDutyAmount).toBeCloseTo(20, 2);
    expect(result.stampDutyRate).toBe(0.2);
  });

  it("options: ₹50,000 premium → ₹15 duty (0.3 bps on premium)", () => {
    const result = stampDutyService.calculateStampDuty("options", 50000);
    expect(result.stampDutyAmount).toBeCloseTo(1.5, 2);
    expect(result.stampDutyRate).toBe(0.3);
  });

  it("debenture_issue: ₹5,00,000 → ₹25 duty (0.5 bps)", () => {
    const result = stampDutyService.calculateStampDuty("debenture_issue", 500000, "issue");
    expect(result.stampDutyAmount).toBeCloseTo(25, 2);
    expect(result.stampDutyRate).toBe(0.5);
  });

  it("mf_units: ₹1,00,000 → ₹5 duty (0.5 bps)", () => {
    const result = stampDutyService.calculateStampDuty("mf_units", 100000);
    expect(result.stampDutyAmount).toBeCloseTo(5, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Exempt products — all return ₹0
// ─────────────────────────────────────────────────────────────────────────────
describe("calculateStampDuty — exempt products return ₹0", () => {
  const EXEMPT_PRODUCTS: ProductType[] = [
    "g_sec", "t_bill", "sdl", "sgb", "bonus_shares", "gift_transfer",
  ];

  for (const product of EXEMPT_PRODUCTS) {
    it(`${product} → stampDutyAmount = 0, isExempt = true`, () => {
      const result = stampDutyService.calculateStampDuty(product, 1_000_000);
      expect(result.stampDutyAmount).toBe(0);
      expect(result.isExempt).toBe(true);
      expect(result.exemptionReason).toBeTruthy();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. GCR compliance — every output has engine_version + calculation_timestamp
// ─────────────────────────────────────────────────────────────────────────────
describe("GCR compliance — engine_version + calculation_timestamp", () => {
  const SAMPLE_PRODUCTS: ProductType[] = [
    "unlisted_shares", "corporate_bond", "g_sec", "equity_delivery", "futures",
  ];

  for (const product of SAMPLE_PRODUCTS) {
    it(`${product}: has engine_version`, () => {
      const result = stampDutyService.calculateStampDuty(product, 100000);
      expect(result.engine_version).toBe(STAMP_DUTY_ENGINE_VERSION);
    });

    it(`${product}: has calculation_timestamp (ISO format)`, () => {
      const result = stampDutyService.calculateStampDuty(product, 100000);
      expect(result.calculation_timestamp).toBeTruthy();
      expect(new Date(result.calculation_timestamp).toISOString()).toBe(
        result.calculation_timestamp,
      );
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. GCR determinism — same input → same output
// ─────────────────────────────────────────────────────────────────────────────
describe("GCR determinism — same input → same stampDutyAmount", () => {
  const TEST_CASES: Array<[ProductType, number]> = [
    ["unlisted_shares", 250000],
    ["corporate_bond", 500000],
    ["equity_delivery", 150000],
    ["futures", 1000000],
    ["g_sec", 999999],
  ];

  for (const [product, amount] of TEST_CASES) {
    it(`${product} @ ₹${amount.toLocaleString()} is deterministic`, () => {
      const r1 = stampDutyService.calculateStampDuty(product, amount);
      const r2 = stampDutyService.calculateStampDuty(product, amount);
      expect(r1.stampDutyAmount).toBe(r2.stampDutyAmount);
      expect(r1.stampDutyRate).toBe(r2.stampDutyRate);
      expect(r1.isExempt).toBe(r2.isExempt);
      expect(r1.engine_version).toBe(r2.engine_version);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Error handling — unknown product type
// ─────────────────────────────────────────────────────────────────────────────
describe("calculateStampDuty — error handling", () => {
  it("throws for unknown product type", () => {
    expect(() =>
      stampDutyService.calculateStampDuty("unknown_product" as ProductType, 100000),
    ).toThrow("[StampDutyService] Unknown product type: unknown_product");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. calculateWithExplainability — GCR explainability layer
// ─────────────────────────────────────────────────────────────────────────────
describe("calculateWithExplainability — GCR explainability", () => {
  it("returns formula string", () => {
    const result = stampDutyService.calculateWithExplainability("corporate_bond", 1_000_000);
    expect(result.explainability.formula).toContain("rateBps / 10000");
  });

  it("returns inputs with transactionAmount and rateBps", () => {
    const result = stampDutyService.calculateWithExplainability("equity_delivery", 500000);
    expect(result.explainability.inputs.transactionAmount).toBe(500000);
    expect(result.explainability.inputs.rateBps).toBe(1.5);
    expect(result.explainability.inputs.ratePercent).toBe("0.0150%");
  });

  it("returns step-by-step reasoning array", () => {
    const result = stampDutyService.calculateWithExplainability("unlisted_shares", 200000);
    expect(Array.isArray(result.explainability.steps)).toBe(true);
    expect(result.explainability.steps.length).toBeGreaterThan(0);
  });

  it("exempt products return exemption in steps", () => {
    const result = stampDutyService.calculateWithExplainability("g_sec", 1_000_000);
    expect(result.explainability.steps.join(" ")).toContain("exempt");
  });

  it("returns regulatoryBasis including effective date", () => {
    const result = stampDutyService.calculateWithExplainability("ncd", 100000);
    expect(result.explainability.regulatoryBasis).toContain("2020-07-01");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. getStampDutyBreakdown
// ─────────────────────────────────────────────────────────────────────────────
describe("getStampDutyBreakdown", () => {
  it("returns total = principal + stampDuty for non-exempt", () => {
    const result = stampDutyService.getStampDutyBreakdown("unlisted_shares", 100000);
    expect(result.total).toBe(result.principal + result.stampDuty);
    expect(result.total).toBeCloseTo(100015, 1);
  });

  it("returns Exempt string for rate when product is exempt", () => {
    const result = stampDutyService.getStampDutyBreakdown("g_sec", 1_000_000);
    expect(result.stampDutyRate).toBe("Exempt");
    expect(result.isExempt).toBe(true);
    expect(result.total).toBe(1_000_000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. isExempt / getPayerSide helpers
// ─────────────────────────────────────────────────────────────────────────────
describe("helper methods", () => {
  it("isExempt returns true for g_sec", () => {
    expect(stampDutyService.isExempt("g_sec")).toBe(true);
  });

  it("isExempt returns false for equity_delivery", () => {
    expect(stampDutyService.isExempt("equity_delivery")).toBe(false);
  });

  it("getPayerSide returns seller for unlisted_shares", () => {
    expect(stampDutyService.getPayerSide("unlisted_shares")).toBe("seller");
  });

  it("getPayerSide returns buyer for corporate_bond (FA2019 fix)", () => {
    expect(stampDutyService.getPayerSide("corporate_bond")).toBe("buyer");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. getAllRates — includes engine_version
// ─────────────────────────────────────────────────────────────────────────────
describe("getAllRates", () => {
  it("returns an array with all products", () => {
    const rates = stampDutyService.getAllRates();
    expect(Array.isArray(rates)).toBe(true);
    expect(rates.length).toBe(Object.keys(STAMP_DUTY_RATES).length);
  });

  it("each entry includes engine_version", () => {
    const rates = stampDutyService.getAllRates();
    for (const entry of rates) {
      expect(entry.engine_version).toBe(STAMP_DUTY_ENGINE_VERSION);
    }
  });
});
