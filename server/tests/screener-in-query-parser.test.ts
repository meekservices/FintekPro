import { describe, it, expect } from "vitest";
import { parseScreenerQuery, getSupportedScreenerFields } from "../services/screener/screener-in-query-parser";

describe("Screener.in Natural Language Query Engine", () => {
  const PRESET_QUERIES = [
    "Market Capitalization > 1000 AND Price to Earning < 30 AND ROCE > 18% AND Sales Growth 3Y > 15%",
    "Price to Earning < 20 AND ROCE > 20% AND Debt to Equity < 0.5 AND Current Price > 50",
    "Debt to Equity < 0.1 AND ROCE > 15% AND Return on Equity > 15% AND Market Capitalization > 500",
    "Piotroski Score >= 7 AND Return on Equity > 12% AND Market Capitalization > 1000",
    "Magic Formula Rank <= 250 AND ROCE > 15% AND Market Capitalization > 1000",
    "Dividend Yield > 3% AND Debt to Equity < 0.8 AND Return on Equity > 12%",
    "Free Cash Flow Yield > 4% AND Price to Book < 3.5 AND Debt to Equity < 0.4",
    "FII Holding > 12% AND DII Holding > 10% AND FintekPro Score > 70 AND Pledged Shares < 5%",
    "% from 52W High > -8 AND RSI > 50 AND ROCE > 15% AND 1Y Return > 15%",
    "Graham Number > 100 AND Price to Book < 2.5 AND Debt to Equity < 0.5 AND Current Ratio > 1.2",
  ];

  it("successfully parses all 10 Screener.in standard presets without error", () => {
    for (const query of PRESET_QUERIES) {
      const result = parseScreenerQuery(query, "snapshot");
      expect(result.success, `Failed query: "${query}" with error: ${result.error}`).toBe(true);
      expect(result.clauses.length).toBeGreaterThanOrEqual(3);
      expect(result.sqlCondition).toBeDefined();
    }
  });

  it("supports Unicode operators (≥, ≤, =)", () => {
    const q = "ROCE ≥ 15% AND Debt to Equity ≤ 0.5 AND Current Ratio >= 1.2";
    const res = parseScreenerQuery(q, "snapshot");
    expect(res.success).toBe(true);
    expect(res.clauses[0].operator).toBe(">=");
    expect(res.clauses[1].operator).toBe("<=");
    expect(res.clauses[2].operator).toBe(">=");
  });

  it("handles negative percentage returns correctly without scaling errors", () => {
    const q = "1Y Return > -10% AND % from 52W High > -8";
    const res = parseScreenerQuery(q, "snapshot");
    expect(res.success).toBe(true);
    expect(res.clauses[0].value).toBe(-10);
    expect(res.clauses[1].value).toBe(-8);
  });

  it("handles free cash flow values without multiplying into billions", () => {
    const q = "Free Cash Flow > 100";
    const res = parseScreenerQuery(q, "snapshot");
    expect(res.success).toBe(true);
    expect(res.clauses[0].value).toBe(100);
  });

  it("supports multi-join fallback target mode", () => {
    const q = "Price to Earning < 25 AND ROCE > 15% AND Promoter Holding > 50%";
    const res = parseScreenerQuery(q, "multijoin");
    expect(res.success).toBe(true);
    expect(res.clauses.length).toBe(3);
    expect(res.sqlCondition).toBeDefined();
  });

  it("returns human-friendly error messages and suggestions for typos", () => {
    const q = "Retrun on Equity > 15%";
    const res = parseScreenerQuery(q, "snapshot");
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });

  it("returns comprehensive catalog of supported screener fields", () => {
    const fields = getSupportedScreenerFields();
    expect(fields.length).toBeGreaterThan(25);
    const names = fields.map((f) => f.name);
    expect(names).toContain("Market Cap");
    expect(names).toContain("Price to Earning");
    expect(names).toContain("ROCE");
    expect(names).toContain("Sales Growth 3Y");
    expect(names).toContain("FintekPro Score");
  });
});

