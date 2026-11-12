import { describe, it, expect } from "vitest";

/**
 * Unit test for Mutual Fund Screener search query tokenization,
 * alias expansion, and SEBI IDCW/Dividend resolution.
 */

// Mirroring the MF search alias dictionary and tokenizer from instrument-screener-routes
const MF_SEARCH_ALIASES: Record<string, string[]> = {
  pru: ["pru", "prudential"],
  prudential: ["prudential", "pru"],
  icici: ["icici"],
  sbi: ["sbi", "state bank"],
  hdfc: ["hdfc"],
  absl: ["absl", "aditya birla", "birla"],
  birla: ["birla", "aditya birla", "absl"],
  aditya: ["aditya birla", "absl"],
  nippon: ["nippon", "reliance"],
  parag: ["parag", "ppfas", "parikh"],
  parikh: ["parag", "ppfas", "parikh"],
  ppfas: ["ppfas", "parag", "parikh"],
  motilal: ["motilal", "mosl", "oswal"],
  mosl: ["mosl", "motilal", "oswal"],
  oswal: ["oswal", "motilal", "mosl"],
  divid: ["dividend", "idcw", "divid"],
  dividend: ["dividend", "idcw", "divid"],
  idcw: ["idcw", "dividend", "divid"],
  div: ["dividend", "idcw", "div"],
  growth: ["growth", "gr"],
  gr: ["growth", "gr"],
  direct: ["direct", "dir"],
  dir: ["direct", "dir"],
  flexi: ["flexi", "flexicap"],
  flexicap: ["flexi", "flexicap"],
  small: ["small", "smallcap"],
  smallcap: ["small", "smallcap"],
};

function getQueryTokensWithVariants(query: string): Array<{ token: string; variants: string[] }> {
  const sanitized = query.replace(/[()\[\],;:\-_/\\]+/g, " ").trim();
  const rawTokens = sanitized.split(/\s+/).filter((t) => t.length > 0).slice(0, 8);
  return rawTokens.map((rawToken) => {
    const tokenLower = rawToken.toLowerCase();
    const aliasMatches = MF_SEARCH_ALIASES[tokenLower] || [];
    const variants = Array.from(new Set([rawToken, tokenLower, ...aliasMatches]));
    return { token: rawToken, variants };
  });
}

function matchesFund(
  fund: { schemeName: string; fundHouse: string; category?: string },
  query: string
): boolean {
  const tokenGroups = getQueryTokensWithVariants(query);
  if (tokenGroups.length === 0) return true;

  const searchableText = `${fund.schemeName} ${fund.fundHouse} ${fund.category || ""}`.toLowerCase();

  return tokenGroups.every(({ variants }) =>
    variants.some((v) => searchableText.includes(v.toLowerCase()))
  );
}

describe("Mutual Fund Screener Tokenized Search Engine", () => {
  const sampleFunds = [
    {
      schemeName: "ICICI Prudential Value Fund - Series 15 - Direct Plan - Dividend Option",
      fundHouse: "ICICI Prudential Mutual Fund",
      category: "Equity Scheme - Value Fund",
    },
    {
      schemeName: "ICICI Prudential Overnight Fund - Annual IDCW",
      fundHouse: "ICICI Prudential Mutual Fund",
      category: "Debt Scheme - Overnight Fund",
    },
    {
      schemeName: "ICICI Prudential Bluechip Fund - Direct Plan - Growth",
      fundHouse: "ICICI Prudential Mutual Fund",
      category: "Equity Scheme - Large Cap Fund",
    },
    {
      schemeName: "HDFC Flexi Cap Fund - Direct Plan - Growth",
      fundHouse: "HDFC Mutual Fund",
      category: "Equity Scheme - Flexi Cap Fund",
    },
    {
      schemeName: "SBI Small Cap Fund - Regular Plan - Growth",
      fundHouse: "SBI Funds Management Ltd",
      category: "Equity Scheme - Small Cap Fund",
    },
    {
      schemeName: "Parag Parikh Flexi Cap Fund - Direct Plan - Growth",
      fundHouse: "PPFAS Mutual Fund",
      category: "Equity Scheme - Flexi Cap Fund",
    },
  ];

  it("successfully resolves 'ICICI Pru Divid' to both Dividend and IDCW options", () => {
    const results = sampleFunds.filter((f) => matchesFund(f, "ICICI Pru Divid"));
    expect(results.length).toBe(2);
    expect(results.map((r) => r.schemeName)).toContain(
      "ICICI Prudential Value Fund - Series 15 - Direct Plan - Dividend Option"
    );
    expect(results.map((r) => r.schemeName)).toContain(
      "ICICI Prudential Overnight Fund - Annual IDCW"
    );
    // Should NOT match Growth funds
    expect(results.map((r) => r.schemeName)).not.toContain(
      "ICICI Prudential Bluechip Fund - Direct Plan - Growth"
    );
  });

  it("resolves SEBI 'IDCW' when user searches for 'Dividend'", () => {
    const results = sampleFunds.filter((f) => matchesFund(f, "ICICI Dividend"));
    expect(results.length).toBe(2);
    expect(results.some((r) => r.schemeName.includes("Overnight Fund - Annual IDCW"))).toBe(true);
  });

  it("resolves multi-word queries with abbreviations like 'HDFC Flexi'", () => {
    const results = sampleFunds.filter((f) => matchesFund(f, "HDFC Flexi"));
    expect(results.length).toBe(1);
    expect(results[0].schemeName).toBe("HDFC Flexi Cap Fund - Direct Plan - Growth");
  });

  it("resolves 'SBI Small' to SBI Small Cap Fund", () => {
    const results = sampleFunds.filter((f) => matchesFund(f, "SBI Small"));
    expect(results.length).toBe(1);
    expect(results[0].schemeName).toBe("SBI Small Cap Fund - Regular Plan - Growth");
  });

  it("resolves 'PPFAS Flexi' to Parag Parikh Flexi Cap Fund via AMC alias", () => {
    const results = sampleFunds.filter((f) => matchesFund(f, "PPFAS Flexi"));
    expect(results.length).toBe(1);
    expect(results[0].schemeName).toBe("Parag Parikh Flexi Cap Fund - Direct Plan - Growth");
  });
});
