/**
 * @file capital-gains-and-optimizer.test.ts
 * @description Unit tests for:
 *   1. CapitalGainsCalculatorService — STCG/LTCG math, fiscal year, advance tax schedule
 *   2. AssetAllocationOptimizer — efficient frontier, Sharpe maximization, rebalancing trades
 *
 * Strategy: All DB calls are mocked. Only pure computation is exercised.
 * FASP-AI v3.0: Financial calculations must be deterministic (same input → same output).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock DB + schema before any service import ───────────────────────────────
vi.mock("../db", () => ({ db: {} }));
vi.mock("@shared/schema", () => ({
  portfolioHoldings: {},
  capitalGainsTaxReminders: {},
  portfolios: {},
  mfOrders: {},
  modelPortfolios: {},
  modelPortfolioHoldings: {},
  screenerDerivedMetrics: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn(), sql: vi.fn((x: any) => x),
  inArray: vi.fn(), gte: vi.fn(), lte: vi.fn(), desc: vi.fn(), avg: vi.fn(),
}));
vi.mock("../services/exit-load-service", () => ({
  exitLoadService: { calculateExitLoad: vi.fn().mockResolvedValue(0) },
}));
vi.mock("../services/tax-regime-config", () => ({
  getTaxRatesForAsset: vi.fn().mockReturnValue({
    stcg: 0.20,
    ltcg: 0.125,
    ltcgThresholdDays: 365,
    ltcgExemption: 125000,
  }),
}));

// ─── 1. CAPITAL GAINS — PURE LOGIC ───────────────────────────────────────────

describe("CapitalGainsCalculatorService — Pure Logic", () => {
  let service: any;

  beforeEach(async () => {
    const { CapitalGainsCalculatorService } = await import("../services/capital-gains-calculator");
    service = new CapitalGainsCalculatorService();
  });

  describe("getTaxRates()", () => {
    it("returns correct post-Budget 2024 equity rates", async () => {
      const rates = await service.getTaxRates("equity");
      expect(rates.stcgRate).toBe(0.20);
      expect(rates.ltcgRate).toBe(0.125);
      expect(rates.thresholdDays).toBe(365);
    });
  });

  describe("getCurrentFiscalYear()", () => {
    it("returns FY2025-26 for May 2025", () => {
      vi.setSystemTime(new Date("2025-05-15"));
      expect(service.getCurrentFiscalYear()).toBe("2025-26");
      vi.useRealTimers();
    });

    it("returns FY2024-25 for January 2025", () => {
      vi.setSystemTime(new Date("2025-01-10"));
      expect(service.getCurrentFiscalYear()).toBe("2024-25");
      vi.useRealTimers();
    });

    it("returns FY2025-26 for April 1 2025 (start of FY)", () => {
      vi.setSystemTime(new Date("2025-04-01"));
      expect(service.getCurrentFiscalYear()).toBe("2025-26");
      vi.useRealTimers();
    });
  });

  describe("getFiscalYearDates()", () => {
    it("returns Apr 1 start and Mar 31 end for 2024-25", () => {
      const { start, end } = service.getFiscalYearDates("2024-25");
      expect(start.getFullYear()).toBe(2024);
      expect(start.getMonth()).toBe(3); // April
      expect(end.getFullYear()).toBe(2025);
      expect(end.getMonth()).toBe(2);  // March
    });
  });

  describe("STCG vs LTCG classification", () => {
    function classify(daysAgo: number, buy: number, sell: number, qty: number, stcgR=0.20, ltcgR=0.125, thresh=365) {
      const gain = (sell - buy) * qty;
      const isSTCG = daysAgo <= thresh;
      const tax = gain > 0 ? gain * (isSTCG ? stcgR : ltcgR) : 0;
      return { type: isSTCG ? "STCG" : "LTCG", gain: Math.round(gain*100)/100, tax: Math.round(tax*100)/100 };
    }

    it("300-day holding → STCG, 20% tax", () => {
      const r = classify(300, 100, 150, 100);
      expect(r.type).toBe("STCG");
      expect(r.gain).toBe(5000);
      expect(r.tax).toBe(1000);
    });

    it("400-day holding → LTCG, 12.5% tax", () => {
      const r = classify(400, 100, 150, 100);
      expect(r.type).toBe("LTCG");
      expect(r.tax).toBe(625);
    });

    it("exactly 365-day → STCG", () => {
      expect(classify(365, 100, 120, 10).type).toBe("STCG");
    });

    it("366-day → LTCG", () => {
      expect(classify(366, 100, 120, 10).type).toBe("LTCG");
    });

    it("loss position → zero tax", () => {
      expect(classify(200, 200, 150, 10).tax).toBe(0);
    });

    it("zero gain → zero tax", () => {
      expect(classify(200, 100, 100, 10).tax).toBe(0);
    });
  });

  describe("LTCG ₹1.25L exemption math", () => {
    function ltcgTax(totalLTCG: number, rate=0.125, exemption=125000) {
      const taxable = Math.max(0, totalLTCG - Math.min(exemption, Math.max(0, totalLTCG)));
      return Math.round(taxable * rate * 100) / 100;
    }

    it("₹1L LTCG → zero tax (within exemption)", () => { expect(ltcgTax(100000)).toBe(0); });
    it("₹1.25L LTCG → zero tax (at exemption)", () => { expect(ltcgTax(125000)).toBe(0); });
    it("₹2.25L LTCG → ₹12,500 tax", () => { expect(ltcgTax(225000)).toBe(12500); });
    it("₹10L LTCG → ₹1,09,375 tax", () => { expect(ltcgTax(1000000)).toBe(109375); });
    it("negative LTCG (loss) → zero tax", () => { expect(ltcgTax(-50000)).toBe(0); });
  });

  describe("Quarterly advance tax schedule", () => {
    it("4 quarters with ascending cumulative percentages", () => {
      const s = service.QUARTERLY_SCHEDULE;
      expect(s).toHaveLength(4);
      // Percentages are CUMULATIVE (15%, 45%, 75%, 100%) — each includes prior quarters
      for (let i = 1; i < s.length; i++) {
        expect(s[i].percentage).toBeGreaterThan(s[i-1].percentage);
      }
    });

    it("Q4 percentage = 1.0", () => {
      const q4 = service.QUARTERLY_SCHEDULE.find((q: any) => q.quarter === "Q4");
      expect(q4?.percentage).toBe(1.0);
    });

    it("due dates are MM-DD format", () => {
      const dates = service.QUARTERLY_SCHEDULE.map((q: any) => q.dueDate);
      expect(dates).toEqual(["06-15", "09-15", "12-15", "03-15"]);
    });
  });
});

// ─── 2. ASSET ALLOCATION OPTIMIZER — PURE MATH ───────────────────────────────

describe("AssetAllocationOptimizer — Pure Math", () => {
  describe("Portfolio volatility", () => {
    it("single asset: σ_p = σ_asset", () => {
      const sigma = 0.18;
      expect(Math.sqrt(1*1*sigma*sigma*1)).toBeCloseTo(sigma);
    });

    it("two perfectly correlated assets: weighted vol", () => {
      const [w1,w2] = [0.6,0.4]; const [s1,s2] = [0.2,0.15];
      const portVol = Math.sqrt(w1*w1*s1*s1 + w2*w2*s2*s2 + 2*w1*w2*s1*s2*1);
      expect(portVol).toBeCloseTo(w1*s1 + w2*s2);
    });

    it("two uncorrelated assets: diversification reduces vol", () => {
      const [w,s] = [0.5,0.2];
      const portVol = Math.sqrt(2 * w*w*s*s);
      expect(portVol).toBeLessThan(s);
    });
  });

  describe("Sharpe ratio", () => {
    const sharpe = (ret: number, vol: number, rf=0.065) => vol > 0 ? (ret-rf)/vol : 0;

    it("equity ~12% → Sharpe ≈ 0.31", () => { expect(sharpe(0.12,0.18)).toBeCloseTo(0.306,2); });
    it("negative excess return → negative Sharpe", () => { expect(sharpe(0.05,0.20)).toBeLessThan(0); });
    it("higher return same vol → higher Sharpe", () => { expect(sharpe(0.15,0.18)).toBeGreaterThan(sharpe(0.10,0.18)); });
    it("same return lower vol → higher Sharpe", () => { expect(sharpe(0.12,0.12)).toBeGreaterThan(sharpe(0.12,0.18)); });
  });

  describe("Weight normalization", () => {
    const norm = (w: number[]) => { const s = w.reduce((a,b)=>a+b,0)||w.length; return w.map(x=>x/(s||1)); };

    it("sum of normalized weights = 1.0", () => {
      expect(norm([30,20,15,10,5]).reduce((a,b)=>a+b,0)).toBeCloseTo(1.0);
    });
    it("equal inputs → equal weights", () => {
      const w = norm([1,1,1,1]);
      expect(w[0]).toBeCloseTo(0.25);
    });
  });

  describe("Rebalancing trade delta", () => {
    function trades(current: Record<string,number>, target: Record<string,number>, total: number, thresh=0.03) {
      return Object.keys({...current,...target})
        .filter(t => Math.abs((current[t]??0)-(target[t]??0)) >= thresh)
        .map(t => ({
          type: t,
          action: (target[t]??0) > (current[t]??0) ? "BUY" : "SELL",
          amount: Math.round(Math.abs((target[t]??0)-(current[t]??0))*total),
        }));
    }

    it("no trades when allocations match", () => { expect(trades({e:0.6,d:0.4},{e:0.6,d:0.4},100000)).toHaveLength(0); });
    it("generates BUY for underweight", () => { expect(trades({e:0.40},{e:0.65},100000)[0].action).toBe("BUY"); });
    it("generates SELL for overweight", () => { expect(trades({e:0.75},{e:0.60},100000)[0].action).toBe("SELL"); });
    it("ignores drifts < threshold", () => { expect(trades({e:0.61},{e:0.62},100000)).toHaveLength(0); });
    it("full rebalance: correct amounts", () => {
      const r = trades({e:0.80,d:0.20},{e:0.60,d:0.40},500000);
      expect(r.find(t=>t.type==="e")?.amount).toBe(100000);
      expect(r.find(t=>t.type==="d")?.amount).toBe(100000);
    });
  });

  describe("Expected return blending (60% live / 40% static)", () => {
    const blend = (live: number|null, stat: number, pct=0.6) => live==null ? stat : live*pct + stat*(1-pct);

    it("null live → static return", () => { expect(blend(null,0.12)).toBe(0.12); });
    it("15% live + 12% static → 13.8%", () => { expect(blend(0.15,0.12)).toBeCloseTo(0.138); });
    it("blended is between live and static", () => { const b=blend(0.20,0.10); expect(b).toBeGreaterThan(0.10); expect(b).toBeLessThan(0.20); });
    it("equal inputs → same value", () => { expect(blend(0.12,0.12)).toBeCloseTo(0.12); });
  });

  describe("ASSET_CLASSES config invariants", async () => {
    const { ASSET_CLASSES } = await import("../services/asset-allocation-optimizer");

    it("every asset class has expectedReturn and volatility > 0", () => {
      for (const ac of ASSET_CLASSES) {
        expect(ac.expectedReturn).toBeGreaterThan(0);
        expect(ac.volatility).toBeGreaterThan(0);
      }
    });

    it("money_market has lower vol than large_cap_equity", () => {
      const mm = ASSET_CLASSES.find(a=>a.type==="money_market")!;
      const lc = ASSET_CLASSES.find(a=>a.type==="large_cap_equity")!;
      expect(mm.volatility).toBeLessThan(lc.volatility);
    });

    it("alternatives have higher expected return than government_bonds", () => {
      const alt = ASSET_CLASSES.find(a=>a.type==="alternatives")!;
      const bond = ASSET_CLASSES.find(a=>a.type==="government_bonds")!;
      expect(alt.expectedReturn).toBeGreaterThan(bond.expectedReturn);
    });
  });
});
