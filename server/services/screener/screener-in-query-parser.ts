/**
 * @file screener-in-query-parser.ts
 * @description Screener.in-compatible natural query parser for FintekPro.
 *
 * Supports queries like:
 *   Market Capitalization > 500 AND Price to Earning < 25 AND ROCE > 15% AND Debt to equity < 1
 *   Promoter holding > 50 AND FII holding > 10 AND Piotroski score >= 7
 *   Return on equity > 20 AND Sales growth 3Years > 15 AND Free Cash Flow > 0
 *
 * @compliance GCR v1.0 — deterministic parsing and sanitized SQL expressions.
 */

import { sql, SQL } from "drizzle-orm";

export interface ParsedClause {
  raw: string;
  field: string;
  dbColumn: string;
  operator: string;
  value: number;
  unit?: string;
}

export interface ParseResult {
  success: boolean;
  sqlCondition?: SQL;
  clauses: ParsedClause[];
  error?: string;
}

// ── Metric Aliases ─────────────────────────────────────────────────────────────

interface FieldDef {
  dbColumn: string;
  name: string;
  type: "number" | "percent" | "cr_currency";
  description: string;
}

const FIELD_MAP: Record<string, FieldDef> = {
  // Market Cap
  marketcapitalization: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },
  marketcap: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },
  marcap: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },
  mcap: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },

  // Valuation
  currentprice: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },
  cmp: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },
  price: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },

  pricetoearning: { dbColumn: "pe_ratio", name: "Price to Earning", type: "number", description: "Price to Earnings (P/E)" },
  pricetoearnings: { dbColumn: "pe_ratio", name: "Price to Earning", type: "number", description: "Price to Earnings (P/E)" },
  stockpe: { dbColumn: "pe_ratio", name: "Stock P/E", type: "number", description: "Price to Earnings (P/E)" },
  peratio: { dbColumn: "pe_ratio", name: "P/E Ratio", type: "number", description: "Price to Earnings (P/E)" },
  pe: { dbColumn: "pe_ratio", name: "P/E", type: "number", description: "Price to Earnings (P/E)" },

  forwardpe: { dbColumn: "forward_pe", name: "Forward P/E", type: "number", description: "1-Year Forward P/E" },
  pegratio: { dbColumn: "peg_ratio", name: "PEG Ratio", type: "number", description: "Price / Earnings to Growth" },
  peg: { dbColumn: "peg_ratio", name: "PEG Ratio", type: "number", description: "Price / Earnings to Growth" },

  pricetobookvalue: { dbColumn: "pb_ratio", name: "Price to Book", type: "number", description: "Price to Book Value (P/B)" },
  pricetobook: { dbColumn: "pb_ratio", name: "Price to Book", type: "number", description: "Price to Book Value (P/B)" },
  pbratio: { dbColumn: "pb_ratio", name: "P/B Ratio", type: "number", description: "Price to Book Value (P/B)" },
  pb: { dbColumn: "pb_ratio", name: "P/B", type: "number", description: "Price to Book Value (P/B)" },

  evebitda: { dbColumn: "ev_to_ebitda", name: "EV / EBITDA", type: "number", description: "Enterprise Value to EBITDA" },
  evtoebitda: { dbColumn: "ev_to_ebitda", name: "EV / EBITDA", type: "number", description: "Enterprise Value to EBITDA" },

  // Profitability & Quality
  returnoncapitalemployed: { dbColumn: "roce", name: "ROCE", type: "percent", description: "Return on Capital Employed (%)" },
  roce: { dbColumn: "roce", name: "ROCE", type: "percent", description: "Return on Capital Employed (%)" },

  returnonequity: { dbColumn: "roe", name: "ROE", type: "percent", description: "Return on Equity (%)" },
  roe: { dbColumn: "roe", name: "ROE", type: "percent", description: "Return on Equity (%)" },

  returnoninvestedcapital: { dbColumn: "roic", name: "ROIC", type: "percent", description: "Return on Invested Capital (%)" },
  roic: { dbColumn: "roic", name: "ROIC", type: "percent", description: "Return on Invested Capital (%)" },

  returnonassets: { dbColumn: "roa", name: "ROA", type: "percent", description: "Return on Assets (%)" },
  roa: { dbColumn: "roa", name: "ROA", type: "percent", description: "Return on Assets (%)" },

  // Solvency & Leverage
  debttoequity: { dbColumn: "debt_to_equity", name: "Debt to Equity", type: "number", description: "Debt to Equity Ratio (x)" },
  debtequity: { dbColumn: "debt_to_equity", name: "Debt to Equity", type: "number", description: "Debt to Equity Ratio (x)" },
  de: { dbColumn: "debt_to_equity", name: "Debt to Equity", type: "number", description: "Debt to Equity Ratio (x)" },

  interestcoverage: { dbColumn: "interest_coverage", name: "Interest Coverage", type: "number", description: "Interest Coverage Ratio (x)" },
  interestcoverageratio: { dbColumn: "interest_coverage", name: "Interest Coverage", type: "number", description: "Interest Coverage Ratio (x)" },
  icr: { dbColumn: "interest_coverage", name: "Interest Coverage", type: "number", description: "Interest Coverage Ratio (x)" },

  currentratio: { dbColumn: "current_ratio", name: "Current Ratio", type: "number", description: "Current Ratio (x)" },

  // Dividends & Per Share
  dividendyield: { dbColumn: "dividend_yield", name: "Dividend Yield", type: "percent", description: "Dividend Yield (%)" },
  divyield: { dbColumn: "dividend_yield", name: "Dividend Yield", type: "percent", description: "Dividend Yield (%)" },

  earningspershare: { dbColumn: "eps", name: "EPS", type: "number", description: "Earnings Per Share (₹)" },
  eps: { dbColumn: "eps", name: "EPS", type: "number", description: "Earnings Per Share (₹)" },

  bookvalue: { dbColumn: "book_value", name: "Book Value", type: "number", description: "Book Value per Share (₹)" },
  bvps: { dbColumn: "book_value", name: "Book Value", type: "number", description: "Book Value per Share (₹)" },
  bv: { dbColumn: "book_value", name: "Book Value", type: "number", description: "Book Value per Share (₹)" },

  // Growth
  salesgrowth3years: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  salesgrowth3yrs: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  salesgrowth: { dbColumn: "revenue_growth", name: "Sales Growth", type: "percent", description: "Sales Growth (%)" },
  revenuegrowth: { dbColumn: "revenue_growth", name: "Sales Growth", type: "percent", description: "Revenue Growth (%)" },

  profitgrowth3years: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profitgrowth3yrs: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profitgrowth: { dbColumn: "earnings_growth", name: "Profit Growth", type: "percent", description: "Profit Growth (%)" },
  earningsgrowth: { dbColumn: "earnings_growth", name: "Profit Growth", type: "percent", description: "Earnings Growth (%)" },
  epsgrowth: { dbColumn: "earnings_growth", name: "EPS Growth", type: "percent", description: "EPS Growth (%)" },

  // Margins
  operatingprofitmargin: { dbColumn: "operating_margin", name: "Operating Margin", type: "percent", description: "Operating Profit Margin (OPM %)" },
  operatingmargin: { dbColumn: "operating_margin", name: "Operating Margin", type: "percent", description: "Operating Profit Margin (OPM %)" },
  opm: { dbColumn: "operating_margin", name: "Operating Margin", type: "percent", description: "Operating Profit Margin (OPM %)" },

  netprofitmargin: { dbColumn: "net_profit_margin", name: "Net Profit Margin", type: "percent", description: "Net Profit Margin (NPM %)" },
  netmargin: { dbColumn: "net_profit_margin", name: "Net Margin", type: "percent", description: "Net Profit Margin (NPM %)" },
  npm: { dbColumn: "net_profit_margin", name: "Net Margin", type: "percent", description: "Net Profit Margin (NPM %)" },

  grossmargin: { dbColumn: "gross_margin", name: "Gross Margin", type: "percent", description: "Gross Profit Margin (%)" },

  // Cash Flow & Quality
  freecashflow: { dbColumn: "free_cash_flow", name: "Free Cash Flow", type: "cr_currency", description: "Free Cash Flow (₹ Cr)" },
  fcf: { dbColumn: "free_cash_flow", name: "Free Cash Flow", type: "cr_currency", description: "Free Cash Flow (₹ Cr)" },
  fcfyield: { dbColumn: "free_cash_flow_yield", name: "FCF Yield", type: "percent", description: "Free Cash Flow Yield (%)" },
  freecashflowyield: { dbColumn: "free_cash_flow_yield", name: "FCF Yield", type: "percent", description: "Free Cash Flow Yield (%)" },
  earningsyield: { dbColumn: "earnings_yield", name: "Earnings Yield", type: "percent", description: "Earnings Yield (%)" },

  // Forensic & Composite Scores
  piotroskiscore: { dbColumn: "piotroski_score", name: "Piotroski Score", type: "number", description: "Piotroski F-Score (0 to 9)" },
  piotroskifscore: { dbColumn: "piotroski_score", name: "Piotroski Score", type: "number", description: "Piotroski F-Score (0 to 9)" },
  piotroski: { dbColumn: "piotroski_score", name: "Piotroski Score", type: "number", description: "Piotroski F-Score (0 to 9)" },

  altmanzscore: { dbColumn: "altman_z_score", name: "Altman Z-Score", type: "number", description: "Altman Z-Score (Financial Health)" },
  altmanz: { dbColumn: "altman_z_score", name: "Altman Z-Score", type: "number", description: "Altman Z-Score (Financial Health)" },

  magicformularank: { dbColumn: "magic_formula_rank", name: "Magic Formula Rank", type: "number", description: "Joel Greenblatt Magic Formula Rank" },
  magicformula: { dbColumn: "magic_formula_rank", name: "Magic Formula Rank", type: "number", description: "Joel Greenblatt Magic Formula Rank" },

  compositescore: { dbColumn: "composite_score", name: "FintekPro Score", type: "number", description: "FintekPro Composite Score (0-100)" },
  fintekscore: { dbColumn: "composite_score", name: "FintekPro Score", type: "number", description: "FintekPro Composite Score (0-100)" },

  // Shareholding
  promoterholding: { dbColumn: "promoter_holding", name: "Promoter Holding", type: "percent", description: "Promoter Shareholding (%)" },
  fiiholding: { dbColumn: "fii_holding", name: "FII Holding", type: "percent", description: "FII Shareholding (%)" },
  diiholding: { dbColumn: "dii_holding", name: "DII Holding", type: "percent", description: "DII Shareholding (%)" },
  pledgedpercentage: { dbColumn: "pledged_shares", name: "Pledged Shares", type: "percent", description: "Pledged Promoter Shares (%)" },
  pledgedshares: { dbColumn: "pledged_shares", name: "Pledged Shares", type: "percent", description: "Pledged Promoter Shares (%)" },

  // Technicals & Momentum
  rsi: { dbColumn: "rsi_14", name: "RSI (14)", type: "number", description: "Relative Strength Index (14)" },
  rsi14: { dbColumn: "rsi_14", name: "RSI (14)", type: "number", description: "Relative Strength Index (14)" },

  return1y: { dbColumn: "return_1y", name: "1Y Return", type: "percent", description: "1-Year Return (%)" },
  return3y: { dbColumn: "return_3y", name: "3Y Return", type: "percent", description: "3-Year Return (%)" },
  pctfrom52whigh: { dbColumn: "pct_from_52w_high", name: "% from 52W High", type: "number", description: "Percentage from 52-Week High (%)" },

  grahamnumber: { dbColumn: "graham_number", name: "Graham Number", type: "number", description: "Benjamin Graham Number (₹)" },
};

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses a Screener.in natural query string.
 * Example:
 *   "Market Capitalization > 500 AND Price to Earning < 25 AND ROCE > 15% AND Debt to equity < 1"
 */
export function parseScreenerQuery(queryText: string): ParseResult {
  if (!queryText || !queryText.trim()) {
    return { success: true, clauses: [] };
  }

  // Split by "AND" or newline
  const rawClauses = queryText
    .split(/\bAND\b|\r?\n/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const clauses: ParsedClause[] = [];
  const sqlParts: SQL[] = [];

  for (const raw of rawClauses) {
    // Match: [field name] [operator: >= | <= | > | < | = | !=] [value]
    const match = raw.match(/^([a-zA-Z0-9_\s/%-]+?)\s*(>=|<=|>|<|!=|=)\s*([0-9.,-]+)\s*(cr|crore|%|x)?$/i);
    if (!match) {
      return {
        success: false,
        clauses: [],
        error: `Could not parse condition: "${raw}". Expected format: [Field] [Operator] [Value], e.g. "P/E < 25"`,
      };
    }

    const [, rawField, op, rawVal, rawUnit] = match;
    const cleanKey = normalizeKey(rawField);
    const fieldDef = FIELD_MAP[cleanKey];

    if (!fieldDef) {
      // Find closest suggestion
      const keys = Object.keys(FIELD_MAP);
      const suggestion = keys.find((k) => k.includes(cleanKey) || cleanKey.includes(k));
      return {
        success: false,
        clauses: [],
        error: `Unknown field "${rawField.trim()}". ${suggestion ? `Did you mean "${FIELD_MAP[suggestion].name}"?` : 'Check supported screener fields.'}`,
      };
    }

    let numVal = parseFloat(rawVal.replace(/,/g, ""));
    if (isNaN(numVal)) {
      return {
        success: false,
        clauses: [],
        error: `Invalid number value "${rawVal}" in condition "${raw}".`,
      };
    }

    const unit = (rawUnit || "").toLowerCase();

    // Adjust value based on field type and input unit:
    if (fieldDef.type === "cr_currency") {
      // In screener.in, "Market Capitalization > 500" means 500 Cr
      // In DB, market_cap_value is in absolute ₹: 500 Cr = 500 * 10,000,000
      if (numVal < 1_000_000 || unit === "cr" || unit === "crore") {
        numVal = numVal * 10_000_000;
      }
    }

    clauses.push({
      raw,
      field: fieldDef.name,
      dbColumn: fieldDef.dbColumn,
      operator: op,
      value: numVal,
      unit: rawUnit || undefined,
    });

    // Build SQL condition for this column on screener_master_snapshots
    const colIdentifier = sql.raw(`screener_master_snapshots.${fieldDef.dbColumn}`);

    const isDecimalPercent = [
      "roe",
      "roce",
      "roic",
      "roa",
      "dividend_yield",
      "revenue_growth",
      "earnings_growth",
      "operating_margin",
      "net_profit_margin",
      "gross_margin",
      "fcf_margin",
      "earnings_yield",
      "free_cash_flow_yield",
    ].includes(fieldDef.dbColumn);

    const isScale100Percent = [
      "promoter_holding",
      "fii_holding",
      "dii_holding",
      "pledged_shares",
      "pct_from_52w_high",
      "pct_from_52w_low",
      "return_1y",
      "return_3y",
    ].includes(fieldDef.dbColumn);

    let clauseSql: SQL;
    if (isDecimalPercent) {
      // In DB stored as 0.15 for 15%
      const targetVal = numVal > 1.0 ? numVal / 100 : numVal;
      clauseSql = sql`${colIdentifier}::numeric ${sql.raw(op)} ${targetVal}`;
    } else if (isScale100Percent) {
      // In DB stored as 60.0 for 60%
      const targetVal = (numVal <= 1.0 && numVal > 0) ? numVal * 100 : numVal;
      clauseSql = sql`${colIdentifier}::numeric ${sql.raw(op)} ${targetVal}`;
    } else {
      clauseSql = sql`${colIdentifier}::numeric ${sql.raw(op)} ${numVal}`;
    }

    sqlParts.push(clauseSql);
  }

  let finalSql: SQL | undefined;
  if (sqlParts.length === 1) {
    finalSql = sqlParts[0];
  } else if (sqlParts.length > 1) {
    finalSql = sql`(${sql.join(sqlParts, sql` AND `)})`;
  }

  return {
    success: true,
    sqlCondition: finalSql,
    clauses,
  };
}

/**
 * Returns dictionary of all supported Screener.in fields with descriptions.
 */
export function getSupportedScreenerFields() {
  const seen = new Set<string>();
  const list: Array<{ name: string; category: string; description: string; sample: string }> = [];

  for (const item of Object.values(FIELD_MAP)) {
    if (seen.has(item.name)) continue;
    seen.add(item.name);

    let category = "Fundamentals";
    if (["Current Price", "Market Cap"].includes(item.name)) category = "General";
    else if (["Price to Earning", "Price to Book", "PEG Ratio", "EV / EBITDA", "Graham Number"].includes(item.name)) category = "Valuation";
    else if (["ROCE", "ROE", "ROIC", "ROA"].includes(item.name)) category = "Quality";
    else if (["Debt to Equity", "Interest Coverage", "Current Ratio"].includes(item.name)) category = "Solvency";
    else if (["Sales Growth 3Y", "Profit Growth 3Y"].includes(item.name)) category = "Growth";
    else if (["Operating Margin", "Net Profit Margin", "Gross Margin"].includes(item.name)) category = "Margins";
    else if (["Promoter Holding", "FII Holding", "DII Holding", "Pledged Shares"].includes(item.name)) category = "Ownership";
    else if (["Piotroski Score", "Altman Z-Score", "Magic Formula Rank", "FintekPro Score"].includes(item.name)) category = "Forensic Scores";
    else if (["RSI (14)", "1Y Return", "% from 52W High"].includes(item.name)) category = "Technicals";

    list.push({
      name: item.name,
      category,
      description: item.description,
      sample: `${item.name} > ${item.type === "percent" ? "15%" : item.type === "cr_currency" ? "500 Cr" : "10"}`,
    });
  }

  return list;
}
