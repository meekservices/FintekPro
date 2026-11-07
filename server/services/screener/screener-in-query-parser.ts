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
  type: "number" | "percent" | "percent_scale100" | "percent_raw" | "cr_currency" | "cr_raw";
  description: string;
  customSql?: (colIdentifier: SQL, op: string, numVal: number, unit?: string) => SQL;
}

const FIELD_MAP: Record<string, FieldDef> = {
  // Market Cap
  marketcapitalization: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },
  marketcap: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },
  marcap: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },
  mcap: { dbColumn: "market_cap_value", name: "Market Cap", type: "cr_currency", description: "Market Capitalization (₹ Cr)" },

  // Valuation & Price
  currentprice: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },
  cmp: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },
  price: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },
  ltp: { dbColumn: "current_price", name: "Current Price", type: "number", description: "Current Market Price (₹)" },

  weekhigh52: { dbColumn: "week_high_52", name: "52W High", type: "number", description: "52-Week High (₹)" },
  "52whigh": { dbColumn: "week_high_52", name: "52W High", type: "number", description: "52-Week High (₹)" },
  "52weekhigh": { dbColumn: "week_high_52", name: "52W High", type: "number", description: "52-Week High (₹)" },

  weeklow52: { dbColumn: "week_low_52", name: "52W Low", type: "number", description: "52-Week Low (₹)" },
  "52wlow": { dbColumn: "week_low_52", name: "52W Low", type: "number", description: "52-Week Low (₹)" },
  "52weeklow": { dbColumn: "week_low_52", name: "52W Low", type: "number", description: "52-Week Low (₹)" },

  // Dynamic 52W Range Percentage (calculated from current_price & week_high/low_52)
  from52whigh: {
    dbColumn: "pct_from_52w_high",
    name: "% from 52W High",
    type: "percent_raw",
    description: "Percentage from 52-Week High (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_high_52::numeric) / NULLIF(screener_master_snapshots.week_high_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },
  pctfrom52whigh: {
    dbColumn: "pct_from_52w_high",
    name: "% from 52W High",
    type: "percent_raw",
    description: "Percentage from 52-Week High (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_high_52::numeric) / NULLIF(screener_master_snapshots.week_high_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },
  percentfrom52whigh: {
    dbColumn: "pct_from_52w_high",
    name: "% from 52W High",
    type: "percent_raw",
    description: "Percentage from 52-Week High (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_high_52::numeric) / NULLIF(screener_master_snapshots.week_high_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },
  pctbelow52whigh: {
    dbColumn: "pct_from_52w_high",
    name: "% from 52W High",
    type: "percent_raw",
    description: "Percentage from 52-Week High (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_high_52::numeric) / NULLIF(screener_master_snapshots.week_high_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },

  from52wlow: {
    dbColumn: "pct_from_52w_low",
    name: "% from 52W Low",
    type: "percent_raw",
    description: "Percentage from 52-Week Low (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_low_52::numeric) / NULLIF(screener_master_snapshots.week_low_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },
  pctfrom52wlow: {
    dbColumn: "pct_from_52w_low",
    name: "% from 52W Low",
    type: "percent_raw",
    description: "Percentage from 52-Week Low (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_low_52::numeric) / NULLIF(screener_master_snapshots.week_low_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },
  percentfrom52wlow: {
    dbColumn: "pct_from_52w_low",
    name: "% from 52W Low",
    type: "percent_raw",
    description: "Percentage from 52-Week Low (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_low_52::numeric) / NULLIF(screener_master_snapshots.week_low_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },
  pctabove52wlow: {
    dbColumn: "pct_from_52w_low",
    name: "% from 52W Low",
    type: "percent_raw",
    description: "Percentage from 52-Week Low (%)",
    customSql: (_col, op, numVal) => sql`(((screener_master_snapshots.current_price::numeric - screener_master_snapshots.week_low_52::numeric) / NULLIF(screener_master_snapshots.week_low_52::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`,
  },

  // Valuation multiples
  pricetoearning: { dbColumn: "pe_ratio", name: "Price to Earning", type: "number", description: "Price to Earnings (P/E)" },
  pricetoearnings: { dbColumn: "pe_ratio", name: "Price to Earning", type: "number", description: "Price to Earnings (P/E)" },
  stockpe: { dbColumn: "pe_ratio", name: "Stock P/E", type: "number", description: "Price to Earnings (P/E)" },
  peratio: { dbColumn: "pe_ratio", name: "P/E Ratio", type: "number", description: "Price to Earnings (P/E)" },
  pe: { dbColumn: "pe_ratio", name: "P/E", type: "number", description: "Price to Earnings (P/E)" },

  forwardpe: { dbColumn: "forward_pe", name: "Forward P/E", type: "number", description: "1-Year Forward P/E" },
  fwdpe: { dbColumn: "forward_pe", name: "Forward P/E", type: "number", description: "1-Year Forward P/E" },
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
  debttoeq: { dbColumn: "debt_to_equity", name: "Debt to Equity", type: "number", description: "Debt to Equity Ratio (x)" },
  debteq: { dbColumn: "debt_to_equity", name: "Debt to Equity", type: "number", description: "Debt to Equity Ratio (x)" },
  de: { dbColumn: "debt_to_equity", name: "Debt to Equity", type: "number", description: "Debt to Equity Ratio (x)" },

  interestcoverage: { dbColumn: "interest_coverage", name: "Interest Coverage", type: "number", description: "Interest Coverage Ratio (x)" },
  interestcoverageratio: { dbColumn: "interest_coverage", name: "Interest Coverage", type: "number", description: "Interest Coverage Ratio (x)" },
  icr: { dbColumn: "interest_coverage", name: "Interest Coverage", type: "number", description: "Interest Coverage Ratio (x)" },

  currentratio: { dbColumn: "current_ratio", name: "Current Ratio", type: "number", description: "Current Ratio (x)" },
  netdebttoebitda: { dbColumn: "net_debt_to_ebitda", name: "Net Debt to EBITDA", type: "number", description: "Net Debt to EBITDA (x)" },

  // Dividends & Per Share
  dividendyield: { dbColumn: "dividend_yield", name: "Dividend Yield", type: "percent", description: "Dividend Yield (%)" },
  divyield: { dbColumn: "dividend_yield", name: "Dividend Yield", type: "percent", description: "Dividend Yield (%)" },

  earningspershare: { dbColumn: "eps", name: "EPS", type: "number", description: "Earnings Per Share (₹)" },
  eps: { dbColumn: "eps", name: "EPS", type: "number", description: "Earnings Per Share (₹)" },

  bookvalue: { dbColumn: "book_value", name: "Book Value", type: "number", description: "Book Value per Share (₹)" },
  bvps: { dbColumn: "book_value", name: "Book Value", type: "number", description: "Book Value per Share (₹)" },
  bv: { dbColumn: "book_value", name: "Book Value", type: "number", description: "Book Value per Share (₹)" },

  // Growth (Sales / Revenue)
  salesgrowth3years: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  salesgrowth3yrs: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  salesgrowth3y: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  sales3y: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  sales3years: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  salesgrowth: { dbColumn: "revenue_growth", name: "Sales Growth", type: "percent", description: "Sales Growth (%)" },
  revenuegrowth: { dbColumn: "revenue_growth", name: "Sales Growth", type: "percent", description: "Revenue Growth (%)" },
  revenuegrowth3y: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },
  revenuegrowth3years: { dbColumn: "revenue_growth", name: "Sales Growth 3Y", type: "percent", description: "3-Year Sales Growth CAGR (%)" },

  // Growth (Profit / Earnings)
  profitgrowth3years: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profitgrowth3yrs: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profitgrowth3y: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profit3y: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profit3years: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  profitgrowth: { dbColumn: "earnings_growth", name: "Profit Growth", type: "percent", description: "Profit Growth (%)" },
  earningsgrowth: { dbColumn: "earnings_growth", name: "Profit Growth", type: "percent", description: "Earnings Growth (%)" },
  earningsgrowth3y: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  earningsgrowth3years: { dbColumn: "earnings_growth", name: "Profit Growth 3Y", type: "percent", description: "3-Year Profit Growth CAGR (%)" },
  epsgrowth: { dbColumn: "earnings_growth", name: "EPS Growth", type: "percent", description: "EPS Growth (%)" },

  // Margins
  operatingprofitmargin: { dbColumn: "operating_margin", name: "Operating Margin", type: "percent", description: "Operating Profit Margin (OPM %)" },
  operatingmargin: { dbColumn: "operating_margin", name: "Operating Margin", type: "percent", description: "Operating Profit Margin (OPM %)" },
  opm: { dbColumn: "operating_margin", name: "Operating Margin", type: "percent", description: "Operating Profit Margin (OPM %)" },

  netprofitmargin: { dbColumn: "net_profit_margin", name: "Net Profit Margin", type: "percent", description: "Net Profit Margin (NPM %)" },
  netmargin: { dbColumn: "net_profit_margin", name: "Net Margin", type: "percent", description: "Net Profit Margin (NPM %)" },
  npm: { dbColumn: "net_profit_margin", name: "Net Margin", type: "percent", description: "Net Profit Margin (NPM %)" },

  grossmargin: { dbColumn: "gross_margin", name: "Gross Margin", type: "percent", description: "Gross Profit Margin (%)" },
  grossprofitmargin: { dbColumn: "gross_margin", name: "Gross Margin", type: "percent", description: "Gross Profit Margin (%)" },
  gpm: { dbColumn: "gross_margin", name: "Gross Margin", type: "percent", description: "Gross Profit Margin (%)" },

  // Cash Flow & Quality
  freecashflow: { dbColumn: "free_cash_flow", name: "Free Cash Flow", type: "cr_raw", description: "Free Cash Flow (₹ Cr)" },
  fcf: { dbColumn: "free_cash_flow", name: "Free Cash Flow", type: "cr_raw", description: "Free Cash Flow (₹ Cr)" },
  fcfyield: { dbColumn: "free_cash_flow_yield", name: "FCF Yield", type: "percent", description: "Free Cash Flow Yield (%)" },
  freecashflowyield: { dbColumn: "free_cash_flow_yield", name: "FCF Yield", type: "percent", description: "Free Cash Flow Yield (%)" },
  earningsyield: { dbColumn: "earnings_yield", name: "Earnings Yield", type: "percent", description: "Earnings Yield (%)" },

  // Forensic & Composite Scores
  piotroskiscore: { dbColumn: "piotroski_score", name: "Piotroski Score", type: "number", description: "Piotroski F-Score (0 to 9)" },
  piotroskifscore: { dbColumn: "piotroski_score", name: "Piotroski Score", type: "number", description: "Piotroski F-Score (0 to 9)" },
  piotroski: { dbColumn: "piotroski_score", name: "Piotroski Score", type: "number", description: "Piotroski F-Score (0 to 9)" },

  altmanzscore: { dbColumn: "altman_z_score", name: "Altman Z-Score", type: "number", description: "Altman Z-Score (Financial Health)" },
  altmanz: { dbColumn: "altman_z_score", name: "Altman Z-Score", type: "number", description: "Altman Z-Score (Financial Health)" },
  altman: { dbColumn: "altman_z_score", name: "Altman Z-Score", type: "number", description: "Altman Z-Score (Financial Health)" },

  magicformularank: { dbColumn: "magic_formula_rank", name: "Magic Formula Rank", type: "number", description: "Joel Greenblatt Magic Formula Rank" },
  magicformula: { dbColumn: "magic_formula_rank", name: "Magic Formula Rank", type: "number", description: "Joel Greenblatt Magic Formula Rank" },
  magicrank: { dbColumn: "magic_formula_rank", name: "Magic Formula Rank", type: "number", description: "Joel Greenblatt Magic Formula Rank" },

  compositescore: { dbColumn: "composite_score", name: "FintekPro Score", type: "number", description: "FintekPro Composite Score (0-100)" },
  fintekscore: { dbColumn: "composite_score", name: "FintekPro Score", type: "number", description: "FintekPro Composite Score (0-100)" },
  fintekproscore: { dbColumn: "composite_score", name: "FintekPro Score", type: "number", description: "FintekPro Composite Score (0-100)" },
  fintekpro: { dbColumn: "composite_score", name: "FintekPro Score", type: "number", description: "FintekPro Composite Score (0-100)" },

  fintekrating: { dbColumn: "fintek_rating", name: "Fintek Rating", type: "number", description: "FintekPro Rating (1 to 5 Stars)" },

  // Shareholding
  promoterholding: { dbColumn: "promoter_holding", name: "Promoter Holding", type: "percent_scale100", description: "Promoter Shareholding (%)" },
  promoter: { dbColumn: "promoter_holding", name: "Promoter Holding", type: "percent_scale100", description: "Promoter Shareholding (%)" },
  promotershareholding: { dbColumn: "promoter_holding", name: "Promoter Holding", type: "percent_scale100", description: "Promoter Shareholding (%)" },

  fiiholding: { dbColumn: "fii_holding", name: "FII Holding", type: "percent_scale100", description: "FII Shareholding (%)" },
  fii: { dbColumn: "fii_holding", name: "FII Holding", type: "percent_scale100", description: "FII Shareholding (%)" },

  diiholding: { dbColumn: "dii_holding", name: "DII Holding", type: "percent_scale100", description: "DII Shareholding (%)" },
  dii: { dbColumn: "dii_holding", name: "DII Holding", type: "percent_scale100", description: "DII Shareholding (%)" },

  pledgedpercentage: { dbColumn: "pledged_shares", name: "Pledged Shares", type: "percent_scale100", description: "Pledged Promoter Shares (%)" },
  pledgedshares: { dbColumn: "pledged_shares", name: "Pledged Shares", type: "percent_scale100", description: "Pledged Promoter Shares (%)" },
  pledged: { dbColumn: "pledged_shares", name: "Pledged Shares", type: "percent_scale100", description: "Pledged Promoter Shares (%)" },

  // Technicals & Momentum
  rsi: { dbColumn: "rsi_14", name: "RSI (14)", type: "number", description: "Relative Strength Index (14)" },
  rsi14: { dbColumn: "rsi_14", name: "RSI (14)", type: "number", description: "Relative Strength Index (14)" },

  return1w: { dbColumn: "return_1w", name: "1W Return", type: "percent", description: "1-Week Return (%)" },
  "1wreturn": { dbColumn: "return_1w", name: "1W Return", type: "percent", description: "1-Week Return (%)" },

  return1m: { dbColumn: "return_1m", name: "1M Return", type: "percent", description: "1-Month Return (%)" },
  "1mreturn": { dbColumn: "return_1m", name: "1M Return", type: "percent", description: "1-Month Return (%)" },

  return3m: { dbColumn: "return_3m", name: "3M Return", type: "percent", description: "3-Month Return (%)" },
  "3mreturn": { dbColumn: "return_3m", name: "3M Return", type: "percent", description: "3-Month Return (%)" },

  return6m: { dbColumn: "return_6m", name: "6M Return", type: "percent", description: "6-Month Return (%)" },
  "6mreturn": { dbColumn: "return_6m", name: "6M Return", type: "percent", description: "6-Month Return (%)" },

  return1y: { dbColumn: "return_1y", name: "1Y Return", type: "percent", description: "1-Year Return (%)" },
  "1yreturn": { dbColumn: "return_1y", name: "1Y Return", type: "percent", description: "1-Year Return (%)" },
  return1year: { dbColumn: "return_1y", name: "1Y Return", type: "percent", description: "1-Year Return (%)" },
  "1yearreturn": { dbColumn: "return_1y", name: "1Y Return", type: "percent", description: "1-Year Return (%)" },

  return3y: { dbColumn: "return_3y", name: "3Y Return", type: "percent", description: "3-Year Return (%)" },
  "3yreturn": { dbColumn: "return_3y", name: "3Y Return", type: "percent", description: "3-Year Return (%)" },
  return3year: { dbColumn: "return_3y", name: "3Y Return", type: "percent", description: "3-Year Return (%)" },
  "3yearreturn": { dbColumn: "return_3y", name: "3Y Return", type: "percent", description: "3-Year Return (%)" },

  returnytd: { dbColumn: "return_ytd", name: "YTD Return", type: "percent", description: "Year-to-Date Return (%)" },
  ytdreturn: { dbColumn: "return_ytd", name: "YTD Return", type: "percent", description: "Year-to-Date Return (%)" },

  beta: { dbColumn: "beta", name: "Beta", type: "number", description: "Beta vs Nifty 50" },
  sharpe: { dbColumn: "sharpe_ratio_1y", name: "Sharpe Ratio", type: "number", description: "1-Year Sharpe Ratio" },
  sharperatio: { dbColumn: "sharpe_ratio_1y", name: "Sharpe Ratio", type: "number", description: "1-Year Sharpe Ratio" },

  grahamnumber: { dbColumn: "graham_number", name: "Graham Number", type: "number", description: "Benjamin Graham Number (₹)" },
  graham: { dbColumn: "graham_number", name: "Graham Number", type: "number", description: "Benjamin Graham Number (₹)" },
  grahamvalue: { dbColumn: "graham_number", name: "Graham Number", type: "number", description: "Benjamin Graham Number (₹)" },
};

const MULTIJOIN_TABLE_MAP: Record<string, string> = {
  market_cap_value: "listed_stocks",
  current_price: "listed_stocks",
  week_high_52: "listed_stocks",
  week_low_52: "listed_stocks",
  pe_ratio: "screener_financials",
  forward_pe: "screener_financials",
  peg_ratio: "screener_financials",
  pb_ratio: "screener_financials",
  ev_to_ebitda: "screener_financials",
  roe: "screener_financials",
  roce: "screener_financials",
  roa: "screener_financials",
  debt_to_equity: "screener_financials",
  interest_coverage: "screener_financials",
  current_ratio: "screener_financials",
  dividend_yield: "screener_financials",
  eps: "screener_financials",
  book_value: "screener_financials",
  revenue_growth: "screener_financials",
  earnings_growth: "screener_financials",
  operating_margin: "screener_financials",
  net_profit_margin: "screener_financials",
  gross_margin: "screener_financials",
  free_cash_flow: "screener_financials",
  free_cash_flow_yield: "screener_key_metrics",
  earnings_yield: "screener_key_metrics",
  roic: "screener_key_metrics",
  net_debt_to_ebitda: "screener_key_metrics",
  graham_number: "screener_key_metrics",
  piotroski_score: "screener_derived_metrics",
  altman_z_score: "screener_derived_metrics",
  magic_formula_rank: "screener_derived_metrics",
  composite_score: "screener_derived_metrics",
  fintek_rating: "screener_derived_metrics",
  return_1w: "screener_derived_metrics",
  return_1m: "screener_derived_metrics",
  return_3m: "screener_derived_metrics",
  return_6m: "screener_derived_metrics",
  return_1y: "screener_derived_metrics",
  return_2y: "screener_derived_metrics",
  return_3y: "screener_derived_metrics",
  return_5y: "screener_derived_metrics",
  return_ytd: "screener_derived_metrics",
  beta: "screener_derived_metrics",
  sharpe_ratio_1y: "screener_derived_metrics",
  rsi_14: "screener_technical_indicators_latest",
  promoter_holding: "screener_shareholding",
  fii_holding: "screener_shareholding",
  dii_holding: "screener_shareholding",
  pledged_shares: "screener_shareholding",
};

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parses a Screener.in natural query string.
 * Example:
 *   "Market Capitalization > 500 AND Price to Earning < 25 AND ROCE > 15% AND Debt to equity < 1"
 *
 * @param queryText   Screener query string
 * @param targetMode  "snapshot" targets screener_master_snapshots (default);
 *                    "multijoin" targets individual joined tables (fallback).
 */
export function parseScreenerQuery(
  queryText: string,
  targetMode: "snapshot" | "multijoin" = "snapshot"
): ParseResult {
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
    // Match: [field name] [operator: >= | <= | > | < | = | != | ≥ | ≤] [value]
    const match = raw.match(/^([a-zA-Z0-9_\s/%-]+?)\s*(>=|<=|>|<|!=|=|≥|≤)\s*([0-9.,-]+)\s*(cr|crore|%|x)?$/i);
    if (!match) {
      return {
        success: false,
        clauses: [],
        error: `Could not parse condition: "${raw}". Expected format: [Field] [Operator] [Value], e.g. "P/E < 25"`,
      };
    }

    const [, rawField, rawOp, rawVal, rawUnit] = match;
    let op = rawOp;
    if (op === "≥") op = ">=";
    if (op === "≤") op = "<=";

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

    // Build SQL condition for target table
    const tablePrefix = targetMode === "multijoin"
      ? (MULTIJOIN_TABLE_MAP[fieldDef.dbColumn] || "listed_stocks")
      : "screener_master_snapshots";

    const colIdentifier = sql.raw(`"${tablePrefix}"."${fieldDef.dbColumn}"`);

    let clauseSql: SQL;
    if (fieldDef.customSql && targetMode === "snapshot") {
      clauseSql = fieldDef.customSql(colIdentifier, op, numVal, unit);
    } else if (fieldDef.customSql && targetMode === "multijoin") {
      if (fieldDef.dbColumn === "pct_from_52w_high") {
        clauseSql = sql`((("listed_stocks"."current_price"::numeric - "listed_stocks"."week_high_52"::numeric) / NULLIF("listed_stocks"."week_high_52"::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`;
      } else if (fieldDef.dbColumn === "pct_from_52w_low") {
        clauseSql = sql`((("listed_stocks"."current_price"::numeric - "listed_stocks"."week_low_52"::numeric) / NULLIF("listed_stocks"."week_low_52"::numeric, 0)) * 100) ${sql.raw(op)} ${numVal}`;
      } else {
        clauseSql = sql`${colIdentifier}::numeric ${sql.raw(op)} ${numVal}`;
      }
    } else if (fieldDef.type === "percent") {
      // In DB stored as decimal e.g. 0.15 for 15% (or -0.10 for -10%)
      const targetVal = (Math.abs(numVal) > 1.0 || unit === "%") ? numVal / 100 : numVal;
      clauseSql = sql`${colIdentifier}::numeric ${sql.raw(op)} ${targetVal}`;
    } else if (fieldDef.type === "percent_scale100") {
      // In DB stored as 0-100 scale e.g. 60.0 for 60%
      const targetVal = (Math.abs(numVal) <= 1.0 && numVal !== 0 && unit !== "%") ? numVal * 100 : numVal;
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
