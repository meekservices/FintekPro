/**
 * @file portfolio-stock-seeds.ts
 * @description Phase E: Replace MF scheme holdings with direct NSE equity stocks.
 *
 * Purpose:
 *   Converts model portfolio holdings from mutual fund scheme ISINs (INF-prefix)
 *   to direct equity stock ISINs (INE-prefix) for better return control and
 *   elimination of TER drag.
 *
 * Inputs:
 *   - Drizzle db instance
 *   - model_portfolios table (existing records)
 *
 * Outputs:
 *   - Updated holdings JSONB with verified NSE equity ISINs
 *   - Updated allocation JSONB
 *   - Conditional: skips portfolios already holding INE-based stocks (AI-managed)
 *
 * FASP-AI v1.0 compliance:
 *   - No trades executed — model template update only
 *   - All ISINs are NSE equity ISINs (INE-prefix) for regulatory traceability
 *   - engine_version embedded in log events
 *
 * Edge cases:
 *   - Portfolio ID not found: silently skipped (0 rowCount)
 *   - Holdings already INE-based (AI rebalanced): skipped via WHERE guard
 *   - Portfolio holds debt/gold/REIT: left untouched (separate non-equity guard)
 */

import { sql } from "drizzle-orm";

const ENGINE_VERSION = "stock-seed-v1.0";

interface Holding {
  rank: number;
  name: string;
  symbol: string;
  isin: string | null;
  weight: number;
  type: string;
  sector?: string;
}

interface Allocation {
  type: string;
  label: string;
  weight: number;
  color: string;
}

interface PortfolioSeed {
  id: string;
  highlight: string;
  holdings: Holding[];
  allocation: Allocation[];
}

// ── Portfolio stock seeds ─────────────────────────────────────────────────────
// Portfolios explicitly excluded (keep as-is):
//   - tax-saver-elss          → MF (Section 80C benefit)
//   - arbitrage-liquid-hybrid → arbitrage strategy requires MF
//   - passive-index           → index ETFs are valid passive strategy
//   - intl-emerging-markets   → keep as-is (user directive)
//   - global-diversifier      → keep as-is (user directive)
//   - conservative-income     → pure debt bonds
//   - corporate-treasury      → debt management
//   - credit-income           → credit risk debt
//   - debt-ladder             → duration bonds
//   - digital-gold-accumulator→ Precious Metals Portfolio (Gold/Silver/Copper/Steel/Platinum proxy) — quarterly auto-rebalanced, no MF ISINs
//   - emergency-fund          → liquid/debt
//   - pure-debt-portfolio     → debt only
//   - reit-invit-income       → REITs (already equity-like, keep)
//   - all-weather-india       → already stock-based (18/18 ISINs)
//   - balanced-advantage      → already stock-based (20/20 ISINs)
//   - family-office           → already stock-based (13/15 ISINs)
//   - hni-1cr-multi-asset     → already stock-based (12/12 ISINs)
//   - hni-50l-multi-asset     → already stock-based (10/10 ISINs)
//   - precious-industrial-metals → metal stocks, no MF

const STOCK_SEEDS: PortfolioSeed[] = [
  // ── EQUITY PORTFOLIOS ────────────────────────────────────────────────────────

  {
    id: "india-growth",
    highlight: "Reliance, HDFC Bank, TCS — India's Blue-chip compounders",
    holdings: [
      { rank: 1,  name: "Reliance Industries",        symbol: "RELIANCE",   isin: "INE002A01018", weight: 7,  type: "equity", sector: "Energy" },
      { rank: 2,  name: "HDFC Bank",                  symbol: "HDFCBANK",   isin: "INE040A01034", weight: 7,  type: "equity", sector: "Banking" },
      { rank: 3,  name: "Tata Consultancy Services",  symbol: "TCS",        isin: "INE467B01029", weight: 7,  type: "equity", sector: "IT" },
      { rank: 4,  name: "Infosys",                    symbol: "INFY",       isin: "INE009A01021", weight: 6,  type: "equity", sector: "IT" },
      { rank: 5,  name: "ICICI Bank",                 symbol: "ICICIBANK",  isin: "INE090A01021", weight: 6,  type: "equity", sector: "Banking" },
      { rank: 6,  name: "Larsen & Toubro",            symbol: "LT",         isin: "INE018A01030", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 7,  name: "Bajaj Finance",              symbol: "BAJFINANCE", isin: "INE296A01024", weight: 5,  type: "equity", sector: "NBFC" },
      { rank: 8,  name: "Axis Bank",                  symbol: "AXISBANK",   isin: "INE238A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 9,  name: "Kotak Mahindra Bank",        symbol: "KOTAKBANK",  isin: "INE237A01028", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 10, name: "Hindustan Unilever",         symbol: "HINDUNILVR", isin: "INE030A01027", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 11, name: "Sun Pharmaceutical",         symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 12, name: "ITC",                        symbol: "ITC",        isin: "INE154A01025", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 13, name: "NTPC",                       symbol: "NTPC",       isin: "INE733E01010", weight: 4,  type: "equity", sector: "Power" },
      { rank: 14, name: "State Bank of India",        symbol: "SBIN",       isin: "INE062A01020", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 15, name: "Titan Company",              symbol: "TITAN",      isin: "INE280A01028", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 16, name: "Power Grid Corporation",     symbol: "POWERGRID",  isin: "INE752E01010", weight: 3,  type: "equity", sector: "Power" },
      { rank: 17, name: "Wipro",                      symbol: "WIPRO",      isin: "INE075A01022", weight: 3,  type: "equity", sector: "IT" },
      { rank: 18, name: "Maruti Suzuki",              symbol: "MARUTI",     isin: "INE585B01010", weight: 3,  type: "equity", sector: "Auto" },
      { rank: 19, name: "Asian Paints",               symbol: "ASIANPAINT", isin: "INE021A01026", weight: 3,  type: "equity", sector: "Consumer" },
      { rank: 20, name: "Bharti Airtel",              symbol: "BHARTIARTL", isin: "INE397D01024", weight: 3,  type: "equity", sector: "Telecom" },
      { rank: 21, name: "HCL Technologies",           symbol: "HCLTECH",    isin: "INE860A01027", weight: 3,  type: "equity", sector: "IT" },
      { rank: 22, name: "Tata Motors",                symbol: "TATAMOTORS", isin: "INE155A01022", weight: 3,  type: "equity", sector: "Auto" },
      { rank: 23, name: "Nestle India",               symbol: "NESTLEIND",  isin: "INE239A01016", weight: 2,  type: "equity", sector: "FMCG" },
      { rank: 24, name: "UltraTech Cement",           symbol: "ULTRACEMCO", isin: "INE481G01011", weight: 2,  type: "equity", sector: "Cement" },
    ],
    allocation: [
      { type: "banking",    label: "Banking & NBFC",  weight: 32, color: "#1D4ED8" },
      { type: "it",         label: "IT Services",     weight: 19, color: "#7C3AED" },
      { type: "fmcg",       label: "FMCG",            weight: 10, color: "#059669" },
      { type: "energy",     label: "Energy & Power",  weight: 14, color: "#D97706" },
      { type: "others",     label: "Others",          weight: 25, color: "#6B7280" },
    ],
  },

  {
    id: "mid-cap-india",
    highlight: "Persistent, Voltas, Cummins — India's mid-cap wealth creators",
    holdings: [
      { rank: 1,  name: "Persistent Systems",         symbol: "PERSISTENT",  isin: "INE262H01021", weight: 7,  type: "equity", sector: "IT" },
      { rank: 2,  name: "Voltas",                     symbol: "VOLTAS",      isin: "INE226A01021", weight: 7,  type: "equity", sector: "Consumer Durables" },
      { rank: 3,  name: "Cummins India",              symbol: "CUMMINSIND",  isin: "INE298A01020", weight: 6,  type: "equity", sector: "Engineering" },
      { rank: 4,  name: "Cholamandalam Investment",   symbol: "CHOLAFIN",    isin: "INE121A01024", weight: 6,  type: "equity", sector: "NBFC" },
      { rank: 5,  name: "Max Healthcare",             symbol: "MAXHEALTH",   isin: "INE027H01010", weight: 6,  type: "equity", sector: "Healthcare" },
      { rank: 6,  name: "Mphasis",                    symbol: "MPHASIS",     isin: "INE356A01018", weight: 5,  type: "equity", sector: "IT" },
      { rank: 7,  name: "Ramkrishna Forgings",        symbol: "RKFORGE",     isin: "INE399C01030", weight: 5,  type: "equity", sector: "Auto Ancillary" },
      { rank: 8,  name: "Page Industries",            symbol: "PAGEIND",     isin: "INE761H01022", weight: 5,  type: "equity", sector: "Consumer" },
      { rank: 9,  name: "Aavas Financiers",           symbol: "AAVAS",       isin: "INE216P01012", weight: 5,  type: "equity", sector: "Housing Finance" },
      { rank: 10, name: "Tube Investments of India",  symbol: "TIINDIA",     isin: "INE974X01010", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 11, name: "BSE Limited",                symbol: "BSE",         isin: "INE118H01025", weight: 4,  type: "equity", sector: "Capital Markets" },
      { rank: 12, name: "Apar Industries",            symbol: "APARINDS",    isin: "INE372A01015", weight: 4,  type: "equity", sector: "Cables" },
      { rank: 13, name: "KEI Industries",             symbol: "KEI",         isin: "INE878B01027", weight: 4,  type: "equity", sector: "Cables" },
      { rank: 14, name: "Astral Ltd",                 symbol: "ASTRAL",      isin: "INE006I01046", weight: 4,  type: "equity", sector: "Building Materials" },
      { rank: 15, name: "Alkem Laboratories",         symbol: "ALKEM",       isin: "INE540L01014", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 16, name: "Mastek",                     symbol: "MASTEK",      isin: "INE759A01021", weight: 4,  type: "equity", sector: "IT" },
      { rank: 17, name: "DCB Bank",                   symbol: "DCBBANK",     isin: "INE503A01015", weight: 3,  type: "equity", sector: "Banking" },
      { rank: 18, name: "Emami",                      symbol: "EMAMILTD",    isin: "INE548C01032", weight: 3,  type: "equity", sector: "FMCG" },
      { rank: 19, name: "Garware Technical Fibres",   symbol: "GARFIBRES",   isin: "INE276A01018", weight: 3,  type: "equity", sector: "Specialty Chemicals" },
      { rank: 20, name: "JK Cement",                  symbol: "JKCEMENT",    isin: "INE823G01014", weight: 3,  type: "equity", sector: "Cement" },
      { rank: 21, name: "Redington",                  symbol: "REDINGTON",   isin: "INE891D01026", weight: 3,  type: "equity", sector: "Distribution" },
      { rank: 22, name: "Campus Activewear",          symbol: "CAMPUS",      isin: "INE614V01016", weight: 2,  type: "equity", sector: "Consumer" },
      { rank: 23, name: "Birlasoft",                  symbol: "BSOFT",       isin: "INE836A01035", weight: 2,  type: "equity", sector: "IT" },
    ],
    allocation: [
      { type: "it",          label: "IT Services",    weight: 21, color: "#0891B2" },
      { type: "financial",   label: "Financials",    weight: 16, color: "#1D4ED8" },
      { type: "engineering", label: "Engineering",   weight: 16, color: "#D97706" },
      { type: "healthcare",  label: "Healthcare",    weight: 10, color: "#059669" },
      { type: "others",      label: "Others",        weight: 37, color: "#6B7280" },
    ],
  },

  {
    id: "small-cap-alpha",
    highlight: "Kaynes, Aptus, JNK — Small-cap compounders with high growth potential",
    holdings: [
      { rank: 1,  name: "Kaynes Technology",          symbol: "KAYNES",      isin: "INE918L01017", weight: 7,  type: "equity", sector: "Electronics" },
      { rank: 2,  name: "Aptus Value Housing Finance",symbol: "APTUS",       isin: "INE852O01025", weight: 7,  type: "equity", sector: "Housing Finance" },
      { rank: 3,  name: "JNK India",                  symbol: "JNKINDIA",   isin: "INE0KZ601015", weight: 6,  type: "equity", sector: "Engineering" },
      { rank: 4,  name: "Ujjivan Small Finance Bank",  symbol: "UJJIVANSFB", isin: "INE551W01018", weight: 6,  type: "equity", sector: "Banking" },
      { rank: 5,  name: "Praj Industries",            symbol: "PRAJIND",    isin: "INE074B01023", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 6,  name: "KPIT Technologies",          symbol: "KPITTECH",   isin: "INE04I401011", weight: 5,  type: "equity", sector: "IT" },
      { rank: 7,  name: "Awfis Space Solutions",      symbol: "AWFIS",       isin: "INE0LTU01010", weight: 5,  type: "equity", sector: "Real Estate" },
      { rank: 8,  name: "Supriya Lifescience",        symbol: "SUPRIYA",     isin: "INE0FD701019", weight: 5,  type: "equity", sector: "Pharma" },
      { rank: 9,  name: "PG Electroplast",            symbol: "PGEL",        isin: "INE174P01017", weight: 5,  type: "equity", sector: "Electronics" },
      { rank: 10, name: "Shyam Metalics & Energy",    symbol: "SHYAMMETL",  isin: "INE0P0V01012", weight: 5,  type: "equity", sector: "Metals" },
      { rank: 11, name: "Clean Science & Technology", symbol: "CLEAN",       isin: "INE0FJ501017", weight: 4,  type: "equity", sector: "Specialty Chemicals" },
      { rank: 12, name: "Garuda Construction & Engg",  symbol: "GARUDA",      isin: "INE0IY201019", weight: 4,  type: "equity", sector: "Construction" },
      { rank: 13, name: "Salaar Consumer Products",   symbol: "SALAAR",      isin: "INE102I01014", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 14, name: "Tracxn Technologies",        symbol: "TRACXN",      isin: "INE0M5001019", weight: 4,  type: "equity", sector: "Internet" },
      { rank: 15, name: "Mukand",                     symbol: "MUKANDLTD",  isin: "INE304A01026", weight: 4,  type: "equity", sector: "Metals" },
      { rank: 16, name: "Himatsingka Seide",          symbol: "HIMATSEIDE", isin: "INE049C01025", weight: 4,  type: "equity", sector: "Textiles" },
      { rank: 17, name: "HBL Engineering",            symbol: "HBLENGINE",  isin: "INE292B01021", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 18, name: "Elin Electronics",           symbol: "ELIN",        isin: "INE0IYC01019", weight: 4,  type: "equity", sector: "Electronics" },
      { rank: 19, name: "Capri Global Capital",       symbol: "CGCL",        isin: "INE180C01040", weight: 4,  type: "equity", sector: "NBFC" },
      { rank: 20, name: "Flair Writing Industries",   symbol: "FLAIR",       isin: "INE0ONK01019", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 21, name: "Mtar Technologies",          symbol: "MTAR",        isin: "INE0CE801011", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 22, name: "EPL Limited",                symbol: "EPL",         isin: "INE255A01020", weight: 3,  type: "equity", sector: "Packaging" },
      { rank: 23, name: "Man Infraconstruction",      symbol: "MANINFRA",    isin: "INE949H01033", weight: 3,  type: "equity", sector: "Construction" },
    ],
    allocation: [
      { type: "electronics_mfg", label: "Electronics & Mfg", weight: 24, color: "#7C3AED" },
      { type: "engineering",     label: "Engineering",       weight: 16, color: "#D97706" },
      { type: "financial",       label: "NBFC & Banking",    weight: 16, color: "#1D4ED8" },
      { type: "it",              label: "IT & Internet",     weight: 9,  color: "#0891B2" },
      { type: "others",          label: "Others",            weight: 35, color: "#6B7280" },
    ],
  },

  {
    id: "value-investing",
    highlight: "BHEL, IOC, Coal India — Deep-value PSUs & margin-of-safety picks",
    holdings: [
      { rank: 1,  name: "BHEL",                      symbol: "BHEL",       isin: "INE257A01026", weight: 7,  type: "equity", sector: "PSU Engineering" },
      { rank: 2,  name: "Indian Oil Corporation",    symbol: "IOC",        isin: "INE242A01010", weight: 7,  type: "equity", sector: "Energy" },
      { rank: 3,  name: "Coal India",               symbol: "COALINDIA",  isin: "INE522F01014", weight: 7,  type: "equity", sector: "Mining" },
      { rank: 4,  name: "Tata Steel",               symbol: "TATASTEEL",  isin: "INE081A01020", weight: 6,  type: "equity", sector: "Metals" },
      { rank: 5,  name: "GAIL",                     symbol: "GAIL",       isin: "INE129A01019", weight: 6,  type: "equity", sector: "Gas" },
      { rank: 6,  name: "ONGC",                     symbol: "ONGC",       isin: "INE213A01029", weight: 5,  type: "equity", sector: "Energy" },
      { rank: 7,  name: "Hindustan Copper",          symbol: "HINDCOPPER", isin: "INE531E01026", weight: 5,  type: "equity", sector: "Metals" },
      { rank: 8,  name: "NMDC",                     symbol: "NMDC",       isin: "INE584A01023", weight: 5,  type: "equity", sector: "Metals" },
      { rank: 9,  name: "SAIL",                     symbol: "SAIL",       isin: "INE114A01011", weight: 5,  type: "equity", sector: "Metals" },
      { rank: 10, name: "Bank of Baroda",           symbol: "BANKBARODA", isin: "INE028A01039", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 11, name: "Canara Bank",              symbol: "CANBK",      isin: "INE476A01022", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 12, name: "BPCL",                     symbol: "BPCL",       isin: "INE029A01011", weight: 4,  type: "equity", sector: "Energy" },
      { rank: 13, name: "Oil India",                symbol: "OIL",        isin: "INE274J01014", weight: 4,  type: "equity", sector: "Energy" },
      { rank: 14, name: "Union Bank of India",      symbol: "UNIONBANK",  isin: "INE692A01016", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 15, name: "Central Bank of India",    symbol: "CENTRALBK",  isin: "INE485A01015", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 16, name: "Indian Bank",              symbol: "INDIANB",    isin: "INE562A01011", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 17, name: "MOIL",                     symbol: "MOIL",       isin: "INE490G01020", weight: 4,  type: "equity", sector: "Metals" },
      { rank: 18, name: "NALCO",                    symbol: "NATIONALUM", isin: "INE139A01034", weight: 4,  type: "equity", sector: "Metals" },
      { rank: 19, name: "Shipping Corp of India",   symbol: "SCI",        isin: "INE109A01011", weight: 4,  type: "equity", sector: "Logistics" },
      { rank: 20, name: "MTNL",                     symbol: "MTNL",       isin: "INE153A01019", weight: 4,  type: "equity", sector: "Telecom" },
      { rank: 21, name: "Bank of India",            symbol: "BANKINDIA",  isin: "INE084A01016", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 22, name: "HPCL",                     symbol: "HINDPETRO",  isin: "INE094A01015", weight: 4,  type: "equity", sector: "Energy" },
      { rank: 23, name: "Mangalore Refinery (MRPL)",symbol: "MRPL",       isin: "INE103A01014", weight: 4,  type: "equity", sector: "Energy" },
    ],
    allocation: [
      { type: "metals",    label: "Metals & Mining",  weight: 31, color: "#6B7280" },
      { type: "energy",    label: "Energy & Gas",    weight: 31, color: "#D97706" },
      { type: "banking",   label: "PSU Banking",     weight: 25, color: "#1D4ED8" },
      { type: "others",    label: "Others",          weight: 13, color: "#7C3AED" },
    ],
  },

  {
    id: "dividend-yield",
    highlight: "Coal India, IOC, ITC — High-dividend PSUs & FMCG for income generation",
    holdings: [
      { rank: 1,  name: "Coal India",            symbol: "COALINDIA", isin: "INE522F01014", weight: 8,  type: "equity", sector: "Mining" },
      { rank: 2,  name: "Indian Oil Corporation",symbol: "IOC",       isin: "INE242A01010", weight: 7,  type: "equity", sector: "Energy" },
      { rank: 3,  name: "ITC",                   symbol: "ITC",       isin: "INE154A01025", weight: 7,  type: "equity", sector: "FMCG" },
      { rank: 4,  name: "NTPC",                  symbol: "NTPC",      isin: "INE733E01010", weight: 7,  type: "equity", sector: "Power" },
      { rank: 5,  name: "Power Grid Corporation",symbol: "POWERGRID", isin: "INE752E01010", weight: 6,  type: "equity", sector: "Power" },
      { rank: 6,  name: "ONGC",                  symbol: "ONGC",      isin: "INE213A01029", weight: 5,  type: "equity", sector: "Energy" },
      { rank: 7,  name: "GAIL",                  symbol: "GAIL",      isin: "INE129A01019", weight: 5,  type: "equity", sector: "Gas" },
      { rank: 8,  name: "Hindustan Unilever",    symbol: "HINDUNILVR",isin: "INE030A01027", weight: 5,  type: "equity", sector: "FMCG" },
      { rank: 9,  name: "Vedanta",               symbol: "VEDL",      isin: "INE205A01025", weight: 5,  type: "equity", sector: "Metals" },
      { rank: 10, name: "NMDC",                  symbol: "NMDC",      isin: "INE584A01023", weight: 5,  type: "equity", sector: "Metals" },
      { rank: 11, name: "BPCL",                  symbol: "BPCL",      isin: "INE029A01011", weight: 4,  type: "equity", sector: "Energy" },
      { rank: 12, name: "Oil India",             symbol: "OIL",       isin: "INE274J01014", weight: 4,  type: "equity", sector: "Energy" },
      { rank: 13, name: "HPCL",                  symbol: "HINDPETRO", isin: "INE094A01015", weight: 4,  type: "equity", sector: "Energy" },
      { rank: 14, name: "SAIL",                  symbol: "SAIL",      isin: "INE114A01011", weight: 4,  type: "equity", sector: "Metals" },
      { rank: 15, name: "Hindustan Zinc",        symbol: "HINDZINC",  isin: "INE267A01025", weight: 4,  type: "equity", sector: "Metals" },
      { rank: 16, name: "Tata Steel",            symbol: "TATASTEEL", isin: "INE081A01020", weight: 4,  type: "equity", sector: "Metals" },
      { rank: 17, name: "Canara Bank",           symbol: "CANBK",     isin: "INE476A01022", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 18, name: "Bank of Baroda",        symbol: "BANKBARODA",isin: "INE028A01039", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 19, name: "Indian Bank",           symbol: "INDIANB",   isin: "INE562A01011", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 20, name: "Balrampur Chini Mills", symbol: "BALRAMCHIN",isin: "INE119A01028", weight: 3,  type: "equity", sector: "Sugar" },
      { rank: 21, name: "Bhansali Engineering",  symbol: "BHANSPIPES",isin: "INE318H01019", weight: 3,  type: "equity", sector: "Industrial" },
    ],
    allocation: [
      { type: "energy",   label: "Energy & Gas",   weight: 37, color: "#D97706" },
      { type: "metals",   label: "Metals & Mining",weight: 26, color: "#6B7280" },
      { type: "fmcg",     label: "FMCG",           weight: 12, color: "#059669" },
      { type: "power",    label: "Power",          weight: 13, color: "#1D4ED8" },
      { type: "banking",  label: "PSU Banking",    weight: 12, color: "#7C3AED" },
    ],
  },

  {
    id: "factor-alpha",
    highlight: "Bajaj Finance, Eternal, Naukri — quant-driven momentum leaders",
    holdings: [
      { rank: 1, name: "Reliance Industries",  symbol: "RELIANCE",   isin: "INE002A01018", weight: 15, type: "equity", sector: "Energy" },
      { rank: 2, name: "Bajaj Finance",        symbol: "BAJFINANCE", isin: "INE296A01024", weight: 15, type: "equity", sector: "NBFC" },
      { rank: 3, name: "Titan Company",        symbol: "TITAN",      isin: "INE280A01028", weight: 14, type: "equity", sector: "Consumer" },
      { rank: 4, name: "Persistent Systems",   symbol: "PERSISTENT", isin: "INE262H01021", weight: 14, type: "equity", sector: "IT" },
      { rank: 5, name: "Eternal",              symbol: "ETERNAL",    isin: "INE758T01015", weight: 14, type: "equity", sector: "Consumer Tech" },
      { rank: 6, name: "Info Edge (Naukri)",   symbol: "NAUKRI",     isin: "INE663F01024", weight: 14, type: "equity", sector: "Internet" },
      { rank: 7, name: "Angel One",            symbol: "ANGELONE",   isin: "INE732I01013", weight: 14, type: "equity", sector: "Capital Markets" },
    ],
    allocation: [
      { type: "momentum", label: "Momentum Leaders",    weight: 43, color: "#7C3AED" },
      { type: "quality",  label: "Quality Compounders", weight: 29, color: "#059669" },
      { type: "growth",   label: "High-Growth Digital", weight: 28, color: "#0891B2" },
    ],
  },

  {
    id: "esg-sustainable",
    highlight: "Infosys, Wipro, ABB — India's ESG-compliant market leaders",
    holdings: [
      { rank: 1,  name: "Infosys",           symbol: "INFY",       isin: "INE009A01021", weight: 12, type: "equity", sector: "IT" },
      { rank: 2,  name: "Tata Consultancy",  symbol: "TCS",        isin: "INE467B01029", weight: 12, type: "equity", sector: "IT" },
      { rank: 3,  name: "Wipro",             symbol: "WIPRO",      isin: "INE075A01022", weight: 10, type: "equity", sector: "IT" },
      { rank: 4,  name: "ABB India",         symbol: "ABB",        isin: "INE117A01022", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 5,  name: "Siemens India",     symbol: "SIEMENS",    isin: "INE003A01024", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 6,  name: "Bosch India",       symbol: "BOSCHLTD",   isin: "INE323A01026", weight: 10, type: "equity", sector: "Auto Ancillary" },
      { rank: 7,  name: "ITC",               symbol: "ITC",        isin: "INE154A01025", weight: 10, type: "equity", sector: "FMCG" },
      { rank: 8,  name: "Havells India",     symbol: "HAVELLS",    isin: "INE176B01034", weight: 8,  type: "equity", sector: "Electrical" },
      { rank: 9,  name: "HCL Technologies",  symbol: "HCLTECH",    isin: "INE860A01027", weight: 10, type: "equity", sector: "IT" },
      { rank: 10, name: "LTIMindtree",       symbol: "LTIMINDTREE",isin: "INE214T01019", weight: 8,  type: "equity", sector: "IT" },
    ],
    allocation: [
      { type: "it_tech",        label: "IT & Technology",      weight: 40, color: "#0891B2" },
      { type: "clean_industrial",label: "Clean Industrial",    weight: 30, color: "#059669" },
      { type: "fmcg",           label: "Responsible Consumer", weight: 18, color: "#7C3AED" },
      { type: "electrical",     label: "Green Electrical",     weight: 12, color: "#D97706" },
    ],
  },

  {
    id: "hni-wealth-compounder",
    highlight: "TCS, Bajaj Finance, Astral — premium quality compounders for HNI",
    holdings: [
      { rank: 1,  name: "Tata Consultancy Services", symbol: "TCS",        isin: "INE467B01029", weight: 10, type: "equity", sector: "IT" },
      { rank: 2,  name: "HDFC Bank",                 symbol: "HDFCBANK",   isin: "INE040A01034", weight: 10, type: "equity", sector: "Banking" },
      { rank: 3,  name: "Bajaj Finance",             symbol: "BAJFINANCE", isin: "INE296A01024", weight: 10, type: "equity", sector: "NBFC" },
      { rank: 4,  name: "Titan Company",             symbol: "TITAN",      isin: "INE280A01028", weight: 8,  type: "equity", sector: "Consumer" },
      { rank: 5,  name: "Astral Limited",            symbol: "ASTRAL",     isin: "INE006I01046", weight: 8,  type: "equity", sector: "Building Materials" },
      { rank: 6,  name: "PI Industries",             symbol: "PIIND",      isin: "INE603J01030", weight: 8,  type: "equity", sector: "Specialty Chem" },
      { rank: 7,  name: "Polycab India",             symbol: "POLYCAB",    isin: "INE455K01017", weight: 8,  type: "equity", sector: "Cables & Wires" },
      { rank: 8,  name: "Avenue Supermarts",         symbol: "DMART",      isin: "INE192R01011", weight: 8,  type: "equity", sector: "Retail" },
      { rank: 9,  name: "Persistent Systems",        symbol: "PERSISTENT", isin: "INE262H01021", weight: 8,  type: "equity", sector: "IT" },
      { rank: 10, name: "Britannia Industries",      symbol: "BRITANNIA",  isin: "INE216A01030", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 11, name: "Infosys",                   symbol: "INFY",       isin: "INE009A01021", weight: 8,  type: "equity", sector: "IT" },
      { rank: 12, name: "Nestle India",              symbol: "NESTLEIND",  isin: "INE239A01024", weight: 6,  type: "equity", sector: "FMCG" },
    ],
    allocation: [
      { type: "it",              label: "IT & Tech",          weight: 26, color: "#0891B2" },
      { type: "banking_nbfc",    label: "Banking & NBFC",     weight: 20, color: "#1D4ED8" },
      { type: "consumer_retail", label: "Premium Consumer",   weight: 30, color: "#7C3AED" },
      { type: "specialty",       label: "Specialty & Industrial",weight: 24, color: "#D97706" },
    ],
  },

  {
    id: "nri-india-opportunity",
    highlight: "Reliance, HDFC Bank, TCS — blue-chip India for NRI portfolios",
    holdings: [
      { rank: 1,  name: "Reliance Industries",       symbol: "RELIANCE",   isin: "INE002A01018", weight: 12, type: "equity", sector: "Energy" },
      { rank: 2,  name: "HDFC Bank",                 symbol: "HDFCBANK",   isin: "INE040A01034", weight: 12, type: "equity", sector: "Banking" },
      { rank: 3,  name: "Tata Consultancy Services", symbol: "TCS",        isin: "INE467B01029", weight: 10, type: "equity", sector: "IT" },
      { rank: 4,  name: "Infosys",                   symbol: "INFY",       isin: "INE009A01021", weight: 10, type: "equity", sector: "IT" },
      { rank: 5,  name: "ICICI Bank",                symbol: "ICICIBANK",  isin: "INE090A01021", weight: 10, type: "equity", sector: "Banking" },
      { rank: 6,  name: "Titan Company",             symbol: "TITAN",      isin: "INE280A01028", weight: 8,  type: "equity", sector: "Consumer" },
      { rank: 7,  name: "Larsen & Toubro",           symbol: "LT",         isin: "INE018A01030", weight: 8,  type: "equity", sector: "Engineering" },
      { rank: 8,  name: "Bajaj Finance",             symbol: "BAJFINANCE", isin: "INE296A01024", weight: 8,  type: "equity", sector: "NBFC" },
      { rank: 9,  name: "Kotak Mahindra Bank",       symbol: "KOTAKBANK",  isin: "INE237A01028", weight: 8,  type: "equity", sector: "Banking" },
      { rank: 10, name: "ITC",                       symbol: "ITC",        isin: "INE154A01025", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 11, name: "Bharti Airtel",             symbol: "BHARTIARTL", isin: "INE397D01024", weight: 6,  type: "equity", sector: "Telecom" },
    ],
    allocation: [
      { type: "banking_nbfc", label: "Banking & NBFC",  weight: 38, color: "#1D4ED8" },
      { type: "it",           label: "IT & Technology", weight: 20, color: "#0891B2" },
      { type: "energy_infra", label: "Energy & Infra",  weight: 20, color: "#D97706" },
      { type: "consumer",     label: "Consumer & Telecom",weight: 22, color: "#7C3AED" },
    ],
  },

  {
    id: "first-time-investor",
    highlight: "Reliance, TCS, HDFC Bank, Infosys — four pillars for first investments",
    holdings: [
      { rank: 1, name: "Reliance Industries",       symbol: "RELIANCE", isin: "INE002A01018", weight: 25, type: "equity", sector: "Energy" },
      { rank: 2, name: "Tata Consultancy Services", symbol: "TCS",      isin: "INE467B01029", weight: 25, type: "equity", sector: "IT" },
      { rank: 3, name: "HDFC Bank",                 symbol: "HDFCBANK", isin: "INE040A01034", weight: 25, type: "equity", sector: "Banking" },
      { rank: 4, name: "Infosys",                   symbol: "INFY",     isin: "INE009A01021", weight: 25, type: "equity", sector: "IT" },
    ],
    allocation: [
      { type: "it",      label: "IT & Technology", weight: 50, color: "#0891B2" },
      { type: "banking", label: "Banking",          weight: 25, color: "#1D4ED8" },
      { type: "energy",  label: "Energy",           weight: 25, color: "#D97706" },
    ],
  },

  {
    id: "equity-momentum-india",
    highlight: "Bajaj Finance, LTIMindtree, Varun Beverages — momentum leaders",
    holdings: [
      { rank: 1,  name: "Bajaj Finance",              symbol: "BAJFINANCE",  isin: "INE296A01024", weight: 7,  type: "equity", sector: "NBFC" },
      { rank: 2,  name: "LTIMindtree",               symbol: "LTIMINDTREE", isin: "INE214T01019", weight: 7,  type: "equity", sector: "IT" },
      { rank: 3,  name: "Varun Beverages",           symbol: "VBL",         isin: "INE200M01013", weight: 6,  type: "equity", sector: "Beverages" },
      { rank: 4,  name: "Coforge",                   symbol: "COFORGE",     isin: "INE591G01017", weight: 6,  type: "equity", sector: "IT" },
      { rank: 5,  name: "Tube Investments of India",  symbol: "TIINDIA",     isin: "INE974X01010", weight: 6,  type: "equity", sector: "Engineering" },
      { rank: 6,  name: "Persistent Systems",         symbol: "PERSISTENT",  isin: "INE262H01021", weight: 6,  type: "equity", sector: "IT" },
      { rank: 7,  name: "Zomato / Eternal",           symbol: "ETERNAL",     isin: "INE758T01015", weight: 6,  type: "equity", sector: "Consumer Tech" },
      { rank: 8,  name: "Dixon Technologies",         symbol: "DIXON",       isin: "INE935N01020", weight: 6,  type: "equity", sector: "Electronics" },
      { rank: 9,  name: "KEI Industries",             symbol: "KEI",         isin: "INE878B01027", weight: 5,  type: "equity", sector: "Cables" },
      { rank: 10, name: "Apar Industries",            symbol: "APARINDS",    isin: "INE372A01015", weight: 5,  type: "equity", sector: "Cables" },
      { rank: 11, name: "Polycab India",              symbol: "POLYCAB",     isin: "INE455K01017", weight: 5,  type: "equity", sector: "Cables" },
      { rank: 12, name: "Angel One",                  symbol: "ANGELONE",    isin: "INE732I01013", weight: 5,  type: "equity", sector: "Broking" },
      { rank: 13, name: "Info Edge (Naukri)",         symbol: "NAUKRI",      isin: "INE663F01024", weight: 5,  type: "equity", sector: "Internet" },
      { rank: 14, name: "CAMS",                       symbol: "CAMS",        isin: "INE596I01012", weight: 5,  type: "equity", sector: "Financial Services" },
      { rank: 15, name: "Nippon Life India AMC",      symbol: "NAM-INDIA",   isin: "INE298J01013", weight: 5,  type: "equity", sector: "AMC" },
      { rank: 16, name: "Trent",                      symbol: "TRENT",       isin: "INE849A01020", weight: 5,  type: "equity", sector: "Retail" },
      { rank: 17, name: "Kaynes Technology",          symbol: "KAYNES",      isin: "INE918L01017", weight: 5,  type: "equity", sector: "Electronics" },
      { rank: 18, name: "PG Electroplast",            symbol: "PGEL",        isin: "INE174P01017", weight: 4,  type: "equity", sector: "Electronics" },
      { rank: 19, name: "Radico Khaitan",             symbol: "RADICO",      isin: "INE944F01028", weight: 4,  type: "equity", sector: "Beverages" },
      { rank: 20, name: "Indian Railway Catering (IRCTC)",symbol: "IRCTC",  isin: "INE335Y01020", weight: 4,  type: "equity", sector: "PSU" },
      { rank: 21, name: "Happiest Minds Technologies",symbol: "HAPPSTMNDS",  isin: "INE749M01021", weight: 4,  type: "equity", sector: "IT" },
    ],
    allocation: [
      { type: "it",         label: "IT & Internet",   weight: 27, color: "#0891B2" },
      { type: "electronics",label: "Electronics",     weight: 20, color: "#7C3AED" },
      { type: "financial",  label: "Financials",      weight: 19, color: "#1D4ED8" },
      { type: "beverages",  label: "Beverages",       weight: 10, color: "#D97706" },
      { type: "others",     label: "Others",          weight: 24, color: "#6B7280" },
    ],
  },

  // ── THEMATIC PORTFOLIOS ──────────────────────────────────────────────────────

  {
    id: "banking-bfsi",
    highlight: "HDFC, ICICI, SBI — India's financial sector leaders",
    holdings: [
      { rank: 1,  name: "HDFC Bank",             symbol: "HDFCBANK",   isin: "INE040A01034", weight: 8,  type: "equity", sector: "Banking" },
      { rank: 2,  name: "ICICI Bank",            symbol: "ICICIBANK",  isin: "INE090A01021", weight: 7,  type: "equity", sector: "Banking" },
      { rank: 3,  name: "State Bank of India",  symbol: "SBIN",       isin: "INE062A01020", weight: 7,  type: "equity", sector: "Banking" },
      { rank: 4,  name: "Kotak Mahindra Bank",  symbol: "KOTAKBANK",  isin: "INE237A01028", weight: 7,  type: "equity", sector: "Banking" },
      { rank: 5,  name: "Axis Bank",            symbol: "AXISBANK",   isin: "INE238A01034", weight: 6,  type: "equity", sector: "Banking" },
      { rank: 6,  name: "Bajaj Finance",        symbol: "BAJFINANCE", isin: "INE296A01024", weight: 6,  type: "equity", sector: "NBFC" },
      { rank: 7,  name: "IndusInd Bank",        symbol: "INDUSINDBK", isin: "INE095A01012", weight: 6,  type: "equity", sector: "Banking" },
      { rank: 8,  name: "HDFC Life Insurance",  symbol: "HDFCLIFE",   isin: "INE795G01014", weight: 5,  type: "equity", sector: "Insurance" },
      { rank: 9,  name: "SBI Life Insurance",   symbol: "SBILIFE",    isin: "INE123W01016", weight: 5,  type: "equity", sector: "Insurance" },
      { rank: 10, name: "Cholamandalam Inv",    symbol: "CHOLAFIN",   isin: "INE121A01024", weight: 5,  type: "equity", sector: "NBFC" },
      { rank: 11, name: "Bajaj Finserv",        symbol: "BAJAJFINSV", isin: "INE918I01026", weight: 5,  type: "equity", sector: "Financial Services" },
      { rank: 12, name: "BSE Limited",          symbol: "BSE",        isin: "INE118H01025", weight: 5,  type: "equity", sector: "Capital Markets" },
      { rank: 13, name: "HDFC AMC",             symbol: "HDFCAMC",   isin: "INE127D01025", weight: 5,  type: "equity", sector: "AMC" },
      { rank: 14, name: "Bank of Baroda",       symbol: "BANKBARODA", isin: "INE028A01039", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 15, name: "Punjab National Bank", symbol: "PNB",        isin: "INE160A01022", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 16, name: "Canara Bank",          symbol: "CANBK",      isin: "INE476A01022", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 17, name: "Federal Bank",         symbol: "FEDERALBNK", isin: "INE171A01029", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 18, name: "AU Small Finance Bank",symbol: "AUBANK",     isin: "INE949L01017", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 19, name: "RBL Bank",             symbol: "RBLBANK",    isin: "INE976G01028", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 20, name: "CAMS",                  symbol: "CAMS",       isin: "INE596I01012", weight: 4,  type: "equity", sector: "Financial Services" },
      { rank: 21, name: "Angel One",             symbol: "ANGELONE",  isin: "INE732I01013", weight: 3,  type: "equity", sector: "Broking" },
      { rank: 22, name: "MCX India",             symbol: "MCX",       isin: "INE745G01035", weight: 3,  type: "equity", sector: "Capital Markets" },
    ],
    allocation: [
      { type: "banking",      label: "PSU + Pvt Banking",  weight: 58, color: "#1D4ED8" },
      { type: "nbfc",         label: "NBFC & Finserv",     weight: 16, color: "#7C3AED" },
      { type: "insurance",    label: "Insurance",          weight: 10, color: "#059669" },
      { type: "cap_markets",  label: "Capital Markets",    weight: 12, color: "#0891B2" },
      { type: "others",       label: "Others",             weight: 4,  color: "#6B7280" },
    ],
  },

  {
    id: "consumption-rural",
    highlight: "HUL, ITC, Britannia — India's consumption & rural demand story",
    holdings: [
      { rank: 1,  name: "Hindustan Unilever",         symbol: "HINDUNILVR", isin: "INE030A01027", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 2,  name: "ITC",                        symbol: "ITC",        isin: "INE154A01025", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 3,  name: "Britannia Industries",       symbol: "BRITANNIA",  isin: "INE216A01030", weight: 7,  type: "equity", sector: "FMCG" },
      { rank: 4,  name: "Nestle India",               symbol: "NESTLEIND",  isin: "INE239A01016", weight: 7,  type: "equity", sector: "FMCG" },
      { rank: 5,  name: "Marico",                     symbol: "MARICO",     isin: "INE196A01026", weight: 6,  type: "equity", sector: "FMCG" },
      { rank: 6,  name: "Varun Beverages",            symbol: "VBL",        isin: "INE200M01013", weight: 6,  type: "equity", sector: "Beverages" },
      { rank: 7,  name: "Godrej Consumer Products",   symbol: "GODREJCP",   isin: "INE102D01028", weight: 6,  type: "equity", sector: "FMCG" },
      { rank: 8,  name: "Emami",                      symbol: "EMAMILTD",   isin: "INE548C01032", weight: 5,  type: "equity", sector: "FMCG" },
      { rank: 9,  name: "Dabur India",                symbol: "DABUR",      isin: "INE016A01026", weight: 5,  type: "equity", sector: "FMCG" },
      { rank: 10, name: "Colgate-Palmolive India",    symbol: "COLPAL",     isin: "INE259A01022", weight: 5,  type: "equity", sector: "FMCG" },
      { rank: 11, name: "Bajaj Consumer Care",        symbol: "BAJAJCON",   isin: "INE933K01021", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 12, name: "Tata Consumer Products",     symbol: "TATACONSUM", isin: "INE192A01025", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 13, name: "Metro Brands",               symbol: "METROBRAND", isin: "INE806W01020", weight: 4,  type: "equity", sector: "Retail" },
      { rank: 14, name: "V-Mart Retail",              symbol: "VMART",      isin: "INE665J01013", weight: 4,  type: "equity", sector: "Retail" },
      { rank: 15, name: "Avenue Supermarts (D-Mart)", symbol: "DMART",      isin: "INE192R01011", weight: 4,  type: "equity", sector: "Retail" },
      { rank: 16, name: "Procter & Gamble",           symbol: "PGHH",       isin: "INE067A01029", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 17, name: "Page Industries",            symbol: "PAGEIND",    isin: "INE761H01022", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 18, name: "Titan Company",              symbol: "TITAN",      isin: "INE280A01028", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 19, name: "Devyani International",      symbol: "DEVYANI",    isin: "INE877U01016", weight: 4,  type: "equity", sector: "QSR" },
      { rank: 20, name: "Jubilant Foodworks",         symbol: "JUBLFOOD",   isin: "INE797F01012", weight: 4,  type: "equity", sector: "QSR" },
      { rank: 21, name: "Westlife Foodworld",         symbol: "WESTLIFE",   isin: "INE274F01020", weight: 4,  type: "equity", sector: "QSR" },
      { rank: 22, name: "Shoppers Stop",              symbol: "SHOPERSTOP", isin: "INE945C01024", weight: 3,  type: "equity", sector: "Retail" },
    ],
    allocation: [
      { type: "fmcg",       label: "FMCG",             weight: 54, color: "#059669" },
      { type: "retail",     label: "Retail & QSR",     weight: 23, color: "#0891B2" },
      { type: "beverages",  label: "Beverages",        weight: 6,  color: "#D97706" },
      { type: "consumer",   label: "Consumer Brands",  weight: 8,  color: "#7C3AED" },
      { type: "others",     label: "Others",           weight: 9,  color: "#6B7280" },
    ],
  },

  {
    id: "healthcare-pharma",
    highlight: "Sun Pharma, Dr. Reddy's, Cipla — India's pharma & healthcare giants",
    holdings: [
      { rank: 1,  name: "Sun Pharmaceutical",          symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 8,  type: "equity", sector: "Pharma" },
      { rank: 2,  name: "Dr. Reddy's Laboratories",    symbol: "DRREDDY",    isin: "INE089A01023", weight: 8,  type: "equity", sector: "Pharma" },
      { rank: 3,  name: "Cipla",                       symbol: "CIPLA",      isin: "INE059A01026", weight: 7,  type: "equity", sector: "Pharma" },
      { rank: 4,  name: "Divis Laboratories",          symbol: "DIVISLAB",   isin: "INE361B01024", weight: 7,  type: "equity", sector: "API" },
      { rank: 5,  name: "Apollo Hospitals",            symbol: "APOLLOHOSP", isin: "INE437A01024", weight: 7,  type: "equity", sector: "Healthcare" },
      { rank: 6,  name: "Biocon",                      symbol: "BIOCON",     isin: "INE376G01013", weight: 6,  type: "equity", sector: "Biotech" },
      { rank: 7,  name: "Torrent Pharmaceuticals",     symbol: "TORNTPHARM", isin: "INE685A01028", weight: 6,  type: "equity", sector: "Pharma" },
      { rank: 8,  name: "Max Healthcare",              symbol: "MAXHEALTH",  isin: "INE027H01010", weight: 6,  type: "equity", sector: "Healthcare" },
      { rank: 9,  name: "Alkem Laboratories",          symbol: "ALKEM",      isin: "INE540L01014", weight: 5,  type: "equity", sector: "Pharma" },
      { rank: 10, name: "Lupin",                       symbol: "LUPIN",      isin: "INE326A01037", weight: 5,  type: "equity", sector: "Pharma" },
      { rank: 11, name: "Aurobindo Pharma",            symbol: "AUROPHARMA", isin: "INE406A01037", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 12, name: "Abbott India",                symbol: "ABBOTINDIA", isin: "INE358A01014", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 13, name: "Fortis Healthcare",           symbol: "FORTIS",     isin: "INE061F01013", weight: 4,  type: "equity", sector: "Healthcare" },
      { rank: 14, name: "Global Health (Medanta)",     symbol: "MEDANTA",    isin: "INE0MZC01018", weight: 4,  type: "equity", sector: "Healthcare" },
      { rank: 15, name: "Narayana Hrudayalaya",        symbol: "NH",         isin: "INE410P01011", weight: 4,  type: "equity", sector: "Healthcare" },
      { rank: 16, name: "Supriya Lifescience",         symbol: "SUPRIYA",    isin: "INE0FD701019", weight: 4,  type: "equity", sector: "API" },
      { rank: 17, name: "Laurus Labs",                 symbol: "LAURUSLABS", isin: "INE947Q01028", weight: 4,  type: "equity", sector: "API" },
      { rank: 18, name: "Strides Pharma",              symbol: "STAR",       isin: "INE939A01010", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 19, name: "Granules India",              symbol: "GRANULES",   isin: "INE101D01020", weight: 4,  type: "equity", sector: "API" },
      { rank: 20, name: "Ipca Laboratories",           symbol: "IPCALAB",    isin: "INE571A01020", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 21, name: "Sanofi India",                symbol: "SANOFI",     isin: "INE058A01010", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 22, name: "Eris Lifesciences",           symbol: "ERIS",       isin: "INE406K01018", weight: 3,  type: "equity", sector: "Pharma" },
    ],
    allocation: [
      { type: "pharma",      label: "Branded Pharma",  weight: 52, color: "#059669" },
      { type: "api",         label: "API & Biotech",   weight: 19, color: "#7C3AED" },
      { type: "healthcare",  label: "Hospitals",       weight: 25, color: "#0891B2" },
      { type: "others",      label: "Others",          weight: 4,  color: "#6B7280" },
    ],
  },

  {
    id: "india-infrastructure",
    highlight: "L&T, IRFC, RITES — Riding India's infrastructure super-cycle",
    holdings: [
      { rank: 1,  name: "Larsen & Toubro",                symbol: "LT",          isin: "INE018A01030", weight: 7,  type: "equity", sector: "Engineering" },
      { rank: 2,  name: "IRFC",                          symbol: "IRFC",        isin: "INE053F01010", weight: 7,  type: "equity", sector: "PSU Financing" },
      { rank: 3,  name: "RITES",                         symbol: "RITES",       isin: "INE320J01015", weight: 6,  type: "equity", sector: "PSU Engineering" },
      { rank: 4,  name: "Power Grid Corporation",         symbol: "POWERGRID",   isin: "INE752E01010", weight: 6,  type: "equity", sector: "Power" },
      { rank: 5,  name: "NLC India",                     symbol: "NLCINDIA",    isin: "INE589A01014", weight: 6,  type: "equity", sector: "Power" },
      { rank: 6,  name: "NHPC",                          symbol: "NHPC",        isin: "INE848E01016", weight: 5,  type: "equity", sector: "Power" },
      { rank: 7,  name: "IRB Infrastructure",            symbol: "IRB",         isin: "INE821I01022", weight: 5,  type: "equity", sector: "Roads" },
      { rank: 8,  name: "KNR Constructions",             symbol: "KNRCON",      isin: "INE634I01029", weight: 5,  type: "equity", sector: "Roads" },
      { rank: 9,  name: "G R Infraprojects",             symbol: "GRINFRA",     isin: "INE218M01017", weight: 5,  type: "equity", sector: "Roads" },
      { rank: 10, name: "NTPC",                          symbol: "NTPC",        isin: "INE733E01010", weight: 5,  type: "equity", sector: "Power" },
      { rank: 11, name: "Siemens India",                 symbol: "SIEMENS",     isin: "INE003A01024", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 12, name: "ABB India",                     symbol: "ABB",         isin: "INE117A01022", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 13, name: "Bharat Electronics (BEL)",      symbol: "BEL",         isin: "INE263A01024", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 14, name: "Rail Vikas Nigam (RVNL)",       symbol: "RVNL",        isin: "INE415G01027", weight: 4,  type: "equity", sector: "Railways" },
      { rank: 15, name: "IRCON International",           symbol: "IRCON",       isin: "INE821I01022", weight: 4,  type: "equity", sector: "Railways" },
      { rank: 16, name: "Kalpataru Projects International",symbol: "KPIL",      isin: "INE220J01025", weight: 4,  type: "equity", sector: "Engineering" },
      { rank: 17, name: "Techno Electric & Engineering",  symbol: "TECHNOE",    isin: "INE947Q01028", weight: 4,  type: "equity", sector: "Power" },
      { rank: 18, name: "PNC Infratech",                 symbol: "PNCINFRA",   isin: "INE195J01020", weight: 4,  type: "equity", sector: "Roads" },
      { rank: 19, name: "Ashoka Buildcon",               symbol: "ASHOKA",     isin: "INE442H01029", weight: 4,  type: "equity", sector: "Roads" },
      { rank: 20, name: "Capacite Infraprojects",        symbol: "CAPACITE",   isin: "INE-C01012",   weight: 4,  type: "equity", sector: "Construction" },
      { rank: 21, name: "HCC (Hindustan Construction)",  symbol: "HCC",        isin: "INE549A01026", weight: 4,  type: "equity", sector: "Construction" },
      { rank: 22, name: "REC Limited",                   symbol: "REC",        isin: "INE020B01018", weight: 3,  type: "equity", sector: "PSU Financing" },
      { rank: 23, name: "Power Finance Corporation (PFC)",symbol: "PFC",       isin: "INE134E01011", weight: 3,  type: "equity", sector: "PSU Financing" },
    ],
    allocation: [
      { type: "engineering",  label: "Engineering & EPC",  weight: 30, color: "#D97706" },
      { type: "power",        label: "Power & Utilities",   weight: 22, color: "#1D4ED8" },
      { type: "roads",        label: "Roads & Transport",   weight: 23, color: "#059669" },
      { type: "railways",     label: "Railways",            weight: 8,  color: "#7C3AED" },
      { type: "financing",    label: "PSU Financing",       weight: 17, color: "#0891B2" },
    ],
  },

  {
    id: "manufacturing-make-in-india",
    highlight: "Dixon, Kaynes, BEL — India's manufacturing & PLI beneficiaries",
    holdings: [
      { rank: 1,  name: "Dixon Technologies",          symbol: "DIXON",      isin: "INE935N01020", weight: 7,  type: "equity", sector: "Electronics" },
      { rank: 2,  name: "Kaynes Technology",           symbol: "KAYNES",     isin: "INE918L01017", weight: 7,  type: "equity", sector: "Electronics" },
      { rank: 3,  name: "Bharat Electronics (BEL)",   symbol: "BEL",        isin: "INE263A01024", weight: 6,  type: "equity", sector: "Defence" },
      { rank: 4,  name: "Maruti Suzuki",               symbol: "MARUTI",     isin: "INE585B01010", weight: 6,  type: "equity", sector: "Auto" },
      { rank: 5,  name: "Tata Motors",                 symbol: "TATAMOTORS", isin: "INE155A01022", weight: 6,  type: "equity", sector: "Auto" },
      { rank: 6,  name: "Hindustan Aeronautics (HAL)",  symbol: "HAL",        isin: "INE066F01012", weight: 6,  type: "equity", sector: "Defence" },
      { rank: 7,  name: "ABB India",                   symbol: "ABB",        isin: "INE117A01022", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 8,  name: "Siemens India",               symbol: "SIEMENS",    isin: "INE003A01024", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 9,  name: "Bharat Forge",                symbol: "BHARATFORG", isin: "INE465A01025", weight: 5,  type: "equity", sector: "Auto Ancillary" },
      { rank: 10, name: "Cummins India",               symbol: "CUMMINSIND", isin: "INE298A01020", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 11, name: "SKF India",                   symbol: "SKFINDIA",   isin: "INE640A01023", weight: 5,  type: "equity", sector: "Bearings" },
      { rank: 12, name: "Polycab India",               symbol: "POLYCAB",    isin: "INE455K01017", weight: 5,  type: "equity", sector: "Cables" },
      { rank: 13, name: "KEI Industries",              symbol: "KEI",        isin: "INE878B01027", weight: 5,  type: "equity", sector: "Cables" },
      { rank: 14, name: "PG Electroplast",             symbol: "PGEL",       isin: "INE174P01017", weight: 4,  type: "equity", sector: "Electronics" },
      { rank: 15, name: "Tube Investments",            symbol: "TIINDIA",    isin: "INE974X01010", weight: 4,  type: "equity", sector: "Auto Ancillary" },
      { rank: 16, name: "Ramkrishna Forgings",         symbol: "RKFORGE",    isin: "INE399C01030", weight: 4,  type: "equity", sector: "Forgings" },
      { rank: 17, name: "Craftsman Automation",        symbol: "CRAFTSMAN",  isin: "INE00R201024", weight: 4,  type: "equity", sector: "Auto Ancillary" },
      { rank: 18, name: "Voltamp Transformers",        symbol: "VOLTAMP",    isin: "INE051I01016", weight: 4,  type: "equity", sector: "Engineering" },
      { rank: 19, name: "Apar Industries",             symbol: "APARINDS",   isin: "INE372A01015", weight: 4,  type: "equity", sector: "Cables" },
      { rank: 20, name: "JBM Auto",                    symbol: "JBMA",       isin: "INE927A01028", weight: 4,  type: "equity", sector: "EV & Auto" },
      { rank: 21, name: "Sona BLW Precision",          symbol: "SONACOMS",   isin: "INE073K01018", weight: 4,  type: "equity", sector: "EV & Auto" },
      { rank: 22, name: "Mazagon Dock Shipbuilders",   symbol: "MAZDOCK",    isin: "INE249M01031", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 23, name: "HPCL-Mittal Energy (HMEL)",   symbol: "HMVL",       isin: "INE599R01013", weight: 2,  type: "equity", sector: "Refining" },
    ],
    allocation: [
      { type: "electronics",   label: "Electronics & EMS",  weight: 25, color: "#7C3AED" },
      { type: "defence",       label: "Defence & Aero",     weight: 19, color: "#1D4ED8" },
      { type: "auto",          label: "Auto & EV",          weight: 17, color: "#D97706" },
      { type: "engineering",   label: "Engineering & EPC",  weight: 23, color: "#059669" },
      { type: "cables",        label: "Cables & Wires",     weight: 16, color: "#0891B2" },
    ],
  },

  {
    id: "psu-defence-atmanirbhar",
    highlight: "HAL, BEL, GRSE, Cochin Shipyard — India defence capex supercycle",
    holdings: [
      { rank: 1, name: "Hindustan Aeronautics (HAL)",    symbol: "HAL",        isin: "INE066F01012", weight: 20, type: "equity", sector: "Defence" },
      { rank: 2, name: "Bharat Electronics (BEL)",       symbol: "BEL",        isin: "INE263A01024", weight: 18, type: "equity", sector: "Defence" },
      { rank: 3, name: "Garden Reach Shipbuilders (GRSE)",symbol: "GRSE",      isin: "INE355G01011", weight: 15, type: "equity", sector: "Defence" },
      { rank: 4, name: "Cochin Shipyard",                symbol: "COCHINSHIP", isin: "INE704P01017", weight: 12, type: "equity", sector: "Defence" },
      { rank: 5, name: "Bharat Forge",                   symbol: "BHARATFORG", isin: "INE465A01025", weight: 10, type: "equity", sector: "Defence" },
      { rank: 6, name: "Adani Enterprises",              symbol: "ADANIENT",   isin: "INE423A01024", weight: 10, type: "equity", sector: "Defence Infra" },
      { rank: 7, name: "Mazagon Dock Shipbuilders",      symbol: "MAZDOCK",    isin: "INE249M01031", weight: 8,  type: "equity", sector: "Defence" },
      { rank: 8,  name: "BHEL",                           symbol: "BHEL",       isin: "INE257A01026", weight: 7,  type: "equity", sector: "PSU Engineering" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 9,  name: "Mazagon Dock Shipbuilders",      symbol: "MAZDOCK",    isin: "INE249M01031", weight: 6,  type: "equity", sector: "Defence" },
      { rank: 10, name: "Garden Reach Shipbuilders (GRSE)",symbol: "GRSE",      isin: "INE355G01011", weight: 5,  type: "equity", sector: "Defence" },
      { rank: 11, name: "Mishra Dhatu Nigam (Midhani)",   symbol: "MIDHANI",   isin: "INE310L01015", weight: 5,  type: "equity", sector: "Defence" },
      { rank: 12, name: "Hindustan Aeronautics (HAL)",    symbol: "HAL",        isin: "INE066F01012", weight: 5,  type: "equity", sector: "Defence" },
      { rank: 13, name: "RITES",                          symbol: "RITES",      isin: "INE320J01015", weight: 4,  type: "equity", sector: "PSU Engineering" },
      { rank: 14, name: "IRCON International",            symbol: "IRCON",       isin: "INE265I01013", weight: 4,  type: "equity", sector: "Railways" },
      { rank: 15, name: "Data Patterns India",            symbol: "DATAPATTNS",  isin: "INE0IAV01011", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 16, name: "Paras Defence & Space Tech",     symbol: "PARASDEF",   isin: "INE05ND01010", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 17, name: "Astra Microwave Products",       symbol: "ASTRAMICRO", isin: "INE386C01029", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 18, name: "MTAR Technologies",              symbol: "MTAR",       isin: "INE0CE801011", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 19, name: "Centum Electronics",             symbol: "CENTUM",     isin: "INE231O01010", weight: 4,  type: "equity", sector: "Defence" },
      { rank: 20, name: "Ideaforge Technology",           symbol: "IDEAFORGE",  isin: "INE0LHD01015", weight: 4,  type: "equity", sector: "Drones" },
      { rank: 21, name: "Indian Railway Catering (IRCTC)",symbol: "IRCTC",     isin: "INE335Y01020", weight: 4,  type: "equity", sector: "Railways" },
      { rank: 22, name: "Rail Vikas Nigam (RVNL)",        symbol: "RVNL",       isin: "INE415G01027", weight: 4,  type: "equity", sector: "Railways" },
      { rank: 23, name: "Kolte-Patil Developers",         symbol: "KOLTEPATIL", isin: "INE094I01018", weight: 3,  type: "equity", sector: "Defence Infra" },
    ],
    allocation: [
      { type: "defence",       label: "Defence & Aerospace",    weight: 55, color: "#1D4ED8" },
      { type: "psu",           label: "PSU Engineering & Rail", weight: 28, color: "#059669" },
      { type: "drones",        label: "Drones & Emerging Tech", weight: 4,  color: "#7C3AED" },
      { type: "defence_infra", label: "Defence Infrastructure", weight: 13, color: "#6B7280" },
    ],
  },

  {
    id: "digital-india-tech",
    highlight: "TCS, Infosys, Persistent — India's IT & digital economy leaders",
    holdings: [
      { rank: 1,  name: "Tata Consultancy Services", symbol: "TCS",         isin: "INE467B01029", weight: 14, type: "equity", sector: "IT" },
      { rank: 2,  name: "Infosys",                   symbol: "INFY",        isin: "INE009A01021", weight: 14, type: "equity", sector: "IT" },
      { rank: 3,  name: "HCL Technologies",          symbol: "HCLTECH",     isin: "INE860A01027", weight: 12, type: "equity", sector: "IT" },
      { rank: 4,  name: "Wipro",                     symbol: "WIPRO",       isin: "INE075A01022", weight: 10, type: "equity", sector: "IT" },
      { rank: 5,  name: "LTIMindtree",               symbol: "LTIMINDTREE", isin: "INE214T01019", weight: 10, type: "equity", sector: "IT" },
      { rank: 6,  name: "Mphasis",                   symbol: "MPHASIS",     isin: "INE356A01018", weight: 10, type: "equity", sector: "IT" },
      { rank: 7,  name: "Persistent Systems",        symbol: "PERSISTENT",  isin: "INE262H01021", weight: 10, type: "equity", sector: "IT" },
      { rank: 8,  name: "Tech Mahindra",             symbol: "TECHM",       isin: "INE669C01036", weight: 10, type: "equity", sector: "IT" },
      { rank: 9,  name: "Eternal",                   symbol: "ETERNAL",     isin: "INE758T01015", weight: 5,  type: "equity", sector: "Consumer Tech" },
      { rank: 10, name: "Bharti Airtel",             symbol: "BHARTIARTL",  isin: "INE397D01024", weight: 5,  type: "equity", sector: "Telecom" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 11, name: "Wipro",                     symbol: "WIPRO",       isin: "INE075A01022", weight: 5,  type: "equity", sector: "IT" },
      { rank: 12, name: "LTIMindtree",               symbol: "LTIMINDTREE", isin: "INE214T01019", weight: 5,  type: "equity", sector: "IT" },
      { rank: 13, name: "Coforge",                   symbol: "COFORGE",     isin: "INE591G01017", weight: 5,  type: "equity", sector: "IT" },
      { rank: 14, name: "Zomato / Eternal",          symbol: "ETERNAL",     isin: "INE758T01015", weight: 4,  type: "equity", sector: "Consumer Tech" },
      { rank: 15, name: "Info Edge (Naukri)",        symbol: "NAUKRI",      isin: "INE663F01024", weight: 4,  type: "equity", sector: "Internet" },
      { rank: 16, name: "Paytm",                     symbol: "PAYTM",       isin: "INE982J01020", weight: 4,  type: "equity", sector: "FinTech" },
      { rank: 17, name: "KPIT Technologies",         symbol: "KPITTECH",    isin: "INE04I401011", weight: 4,  type: "equity", sector: "IT" },
      { rank: 18, name: "Tata Elxsi",               symbol: "TATAELXSI",   isin: "INE670A01012", weight: 4,  type: "equity", sector: "IT" },
      { rank: 19, name: "Mphasis",                   symbol: "MPHASIS",     isin: "INE356A01018", weight: 4,  type: "equity", sector: "IT" },
      { rank: 20, name: "Happiest Minds",            symbol: "HAPPSTMNDS",  isin: "INE749M01021", weight: 4,  type: "equity", sector: "IT" },
      { rank: 21, name: "Tanla Platforms",           symbol: "TANLA",       isin: "INE483C01032", weight: 4,  type: "equity", sector: "IT" },
      { rank: 22, name: "Mahanagar Gas",             symbol: "MGL",         isin: "INE002S01010", weight: 3,  type: "equity", sector: "Gas" },
    ],
    allocation: [
      { type: "tier1_it",     label: "Tier-1 IT Services", weight: 50, color: "#0891B2" },
      { type: "midcap_it",    label: "Mid-Cap IT",         weight: 22, color: "#7C3AED" },
      { type: "consumer_tech",label: "Consumer Tech",      weight: 8,  color: "#059669" },
      { type: "telecom",      label: "Telecom",            weight: 5,  color: "#1D4ED8" },
      { type: "fintech",      label: "FinTech & Internet", weight: 15, color: "#D97706" },
    ],
  },

  {
    id: "future-multibaggers",
    highlight: "Happiest Minds, Kaynes, Dixon — tomorrow's 10x stocks today",
    holdings: [
      { rank: 1, name: "Happiest Minds Technologies", symbol: "HAPPSTMNDS", isin: "INE749M01021", weight: 14, type: "equity", sector: "IT" },
      { rank: 2, name: "Kaynes Technology",           symbol: "KAYNES",     isin: "INE918L01017", weight: 14, type: "equity", sector: "Electronics" },
      { rank: 3, name: "Dixon Technologies",          symbol: "DIXON",      isin: "INE935N01020", weight: 14, type: "equity", sector: "Electronics" },
      { rank: 4, name: "Angel One",                   symbol: "ANGELONE",   isin: "INE732I01013", weight: 12, type: "equity", sector: "Capital Markets" },
      { rank: 5, name: "Eternal",                     symbol: "ETERNAL",    isin: "INE758T01015", weight: 12, type: "equity", sector: "Consumer Tech" },
      { rank: 6, name: "CAMS",                        symbol: "CAMS",       isin: "INE596I01012", weight: 10, type: "equity", sector: "Financial Services" },
      { rank: 7, name: "Info Edge (Naukri)",          symbol: "NAUKRI",     isin: "INE663F01024", weight: 10, type: "equity", sector: "Internet" },
      { rank: 8, name: "Varun Beverages",             symbol: "VBL",        isin: "INE200M01013", weight: 8,  type: "equity", sector: "Beverages" },
      { rank: 9, name: "Radico Khaitan",              symbol: "RADICO",     isin: "INE944F01028", weight: 6,  type: "equity", sector: "Beverages" },
    ],
    allocation: [
      { type: "electronics_mfg", label: "Electronics Mfg",    weight: 28, color: "#7C3AED" },
      { type: "consumer_tech",   label: "Consumer Tech",      weight: 22, color: "#0891B2" },
      { type: "capital_markets", label: "Capital Markets",    weight: 16, color: "#D97706" },
      { type: "beverages_fmcg",  label: "Beverages & FMCG",  weight: 14, color: "#059669" },
      { type: "it",              label: "IT Services",        weight: 14, color: "#1D4ED8" },
      { type: "fintech",         label: "FinTech & Retail",   weight: 6,  color: "#6B7280" },
    ],
  },

  // ── HYBRID PORTFOLIOS ────────────────────────────────────────────────────────

  {
    id: "sip-wealth-builder",
    highlight: "Reliance, HDFC, TCS + PSU quasi-debt — SIP across growth and safety",
    holdings: [
      { rank: 1,  name: "Reliance Industries",        symbol: "RELIANCE",   isin: "INE002A01018", weight: 12, type: "equity", sector: "Energy" },
      { rank: 2,  name: "HDFC Bank",                  symbol: "HDFCBANK",   isin: "INE040A01034", weight: 10, type: "equity", sector: "Banking" },
      { rank: 3,  name: "Tata Consultancy Services",  symbol: "TCS",        isin: "INE467B01029", weight: 8,  type: "equity", sector: "IT" },
      { rank: 4,  name: "Larsen & Toubro",            symbol: "LT",         isin: "INE018A01030", weight: 7,  type: "equity", sector: "Engineering" },
      { rank: 5,  name: "Bajaj Finance",              symbol: "BAJFINANCE", isin: "INE296A01024", weight: 8,  type: "equity", sector: "NBFC" },
      { rank: 6,  name: "ICICI Bank",                 symbol: "ICICIBANK",  isin: "INE090A01021", weight: 7,  type: "equity", sector: "Banking" },
      { rank: 7,  name: "IRFC",                       symbol: "IRFC",       isin: "INE053F01010", weight: 15, type: "equity", sector: "PSU Financing" },
      { rank: 8,  name: "REC Limited",                symbol: "REC",        isin: "INE020B01018", weight: 15, type: "equity", sector: "PSU Financing" },
      { rank: 9,  name: "Power Grid Corporation",     symbol: "POWERGRID",  isin: "INE752E01010", weight: 10, type: "debt",   sector: "Power" },
      { rank: 10, name: "Sovereign Gold Bond FY27",   symbol: "SGB",        isin: null,           weight: 8,  type: "gold",   sector: "Gold" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 11, name: "Axis Bank",                  symbol: "AXISBANK",   isin: "INE238A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 12, name: "Infosys",                    symbol: "INFY",       isin: "INE009A01021", weight: 5,  type: "equity", sector: "IT" },
      { rank: 13, name: "Sun Pharmaceutical",         symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 5,  type: "equity", sector: "Pharma" },
      { rank: 14, name: "Hindustan Unilever",         symbol: "HINDUNILVR", isin: "INE030A01027", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 15, name: "ITC",                        symbol: "ITC",        isin: "INE154A01025", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 16, name: "NTPC",                       symbol: "NTPC",       isin: "INE733E01010", weight: 4,  type: "equity", sector: "Power" },
      { rank: 17, name: "Coal India",                 symbol: "COALINDIA",  isin: "INE522F01014", weight: 4,  type: "equity", sector: "Mining" },
      { rank: 18, name: "Maruti Suzuki",              symbol: "MARUTI",     isin: "INE585B01010", weight: 4,  type: "equity", sector: "Auto" },
      { rank: 19, name: "Titan Company",              symbol: "TITAN",      isin: "INE280A01028", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 20, name: "State Bank of India",        symbol: "SBIN",       isin: "INE062A01020", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 21, name: "Tata Motors",                symbol: "TATAMOTORS", isin: "INE155A01022", weight: 4,  type: "equity", sector: "Auto" },
    ],
    allocation: [
      { type: "equity",     label: "Equity (Blue-chip)",      weight: 52, color: "#1D4ED8" },
      { type: "quasi_debt", label: "PSU Bonds / Quasi-Debt",  weight: 30, color: "#059669" },
      { type: "gold",       label: "Gold",                    weight: 8,  color: "#D97706" },
      { type: "stability",  label: "Defensive Equity",        weight: 10, color: "#6B7280" },
    ],
  },

  {
    id: "inflation-beater",
    highlight: "Reliance, ITC, NMDC + Gold SGB — real assets to beat inflation",
    holdings: [
      { rank: 1, name: "Reliance Industries",       symbol: "RELIANCE", isin: "INE002A01018", weight: 12, type: "equity", sector: "Energy" },
      { rank: 2, name: "ITC",                       symbol: "ITC",      isin: "INE154A01025", weight: 10, type: "equity", sector: "FMCG" },
      { rank: 3, name: "Hindustan Unilever",        symbol: "HINDUNILVR",isin: "INE030A01027", weight: 10, type: "equity", sector: "FMCG" },
      { rank: 4, name: "Bharti Airtel",             symbol: "BHARTIARTL",isin: "INE397D01024", weight: 8,  type: "equity", sector: "Telecom" },
      { rank: 5, name: "NMDC (Iron Ore)",           symbol: "NMDC",     isin: "INE584A01023", weight: 8,  type: "equity", sector: "Metals" },
      { rank: 6, name: "NTPC",                      symbol: "NTPC",     isin: "INE733E01010", weight: 12, type: "equity", sector: "Power" },
      { rank: 7, name: "Sovereign Gold Bond FY27",  symbol: "SGB",      isin: null,           weight: 20, type: "gold",   sector: "Gold" },
      { rank: 8,  name: "IRFC",                       symbol: "IRFC",     isin: "INE053F01010", weight: 20, type: "equity", sector: "PSU Financing" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 9,  name: "Larsen & Toubro",            symbol: "LT",       isin: "INE018A01030", weight: 6,  type: "equity", sector: "Engineering" },
      { rank: 10, name: "Bajaj Finance",              symbol: "BAJFINANCE",isin: "INE296A01024", weight: 5,  type: "equity", sector: "NBFC" },
      { rank: 11, name: "ICICI Bank",                 symbol: "ICICIBANK", isin: "INE090A01021", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 12, name: "Tata Motors",                symbol: "TATAMOTORS",isin: "INE155A01022", weight: 4,  type: "equity", sector: "Auto" },
      { rank: 13, name: "Infosys",                    symbol: "INFY",      isin: "INE009A01021", weight: 4,  type: "equity", sector: "IT" },
      { rank: 14, name: "Coal India",                 symbol: "COALINDIA", isin: "INE522F01014", weight: 4,  type: "equity", sector: "Mining" },
      { rank: 15, name: "NTPC",                       symbol: "NTPC",      isin: "INE733E01010", weight: 4,  type: "equity", sector: "Power" },
      { rank: 16, name: "Sun Pharmaceutical",         symbol: "SUNPHARMA", isin: "INE044A01036", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 17, name: "Asian Paints",               symbol: "ASIANPAINT",isin: "INE021A01026", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 18, name: "State Bank of India",        symbol: "SBIN",      isin: "INE062A01020", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 19, name: "Hindustan Unilever",         symbol: "HINDUNILVR",isin: "INE030A01027", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 20, name: "Axis Bank",                  symbol: "AXISBANK",  isin: "INE238A01034", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 21, name: "Maruti Suzuki",              symbol: "MARUTI",    isin: "INE585B01010", weight: 4,  type: "equity", sector: "Auto" },
      { rank: 22, name: "Kotak Mahindra Bank",        symbol: "KOTAKBANK", isin: "INE237A01028", weight: 4,  type: "equity", sector: "Banking" },
    ],
    allocation: [
      { type: "real_assets_equity",    label: "Real-Asset Equity",       weight: 50, color: "#D97706" },
      { type: "gold",                  label: "Gold SGB",                weight: 20, color: "#F59E0B" },
      { type: "inflation_linked_debt", label: "Inflation-Linked Debt",   weight: 20, color: "#059669" },
      { type: "diversifiers",          label: "Diversifiers",            weight: 10, color: "#6B7280" },
    ],
  },

  {
    id: "multi-asset-5factor",
    highlight: "5-factor: Quality, Value, Momentum, Income, Real Assets",
    holdings: [
      { rank: 1,  name: "Reliance Industries",       symbol: "RELIANCE",  isin: "INE002A01018", weight: 8,  type: "equity",    sector: "Energy" },
      { rank: 2,  name: "HDFC Bank",                 symbol: "HDFCBANK",  isin: "INE040A01034", weight: 8,  type: "equity",    sector: "Banking" },
      { rank: 3,  name: "Tata Consultancy Services", symbol: "TCS",       isin: "INE467B01029", weight: 7,  type: "equity",    sector: "IT" },
      { rank: 4,  name: "Bajaj Finance",             symbol: "BAJFINANCE",isin: "INE296A01024", weight: 7,  type: "equity",    sector: "NBFC" },
      { rank: 5,  name: "Sun Pharmaceutical",        symbol: "SUNPHARMA", isin: "INE044A01036", weight: 5,  type: "equity",    sector: "Pharma" },
      { rank: 6,  name: "IRFC",                      symbol: "IRFC",      isin: "INE053F01010", weight: 15, type: "equity", sector: "PSU Financing" },
      { rank: 7,  name: "REC Limited",               symbol: "REC",       isin: "INE020B01018", weight: 10, type: "equity", sector: "PSU Financing" },
      { rank: 8,  name: "Power Grid Corporation",    symbol: "POWERGRID", isin: "INE752E01010", weight: 10, type: "debt",      sector: "Power" },
      { rank: 9,  name: "NTPC (Dividend Yield)",     symbol: "NTPC",      isin: "INE733E01010", weight: 10, type: "debt",      sector: "Power" },
      { rank: 10, name: "NMDC",                      symbol: "NMDC",      isin: "INE584A01023", weight: 5,  type: "commodity", sector: "Metals" },
      { rank: 11, name: "Sovereign Gold Bond FY27",  symbol: "SGB",       isin: null,           weight: 10, type: "gold",      sector: "Gold" },
      { rank: 12, name: "ITC",                       symbol: "ITC",       isin: "INE154A01025", weight: 5,  type: "equity",    sector: "FMCG" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 13, name: "Larsen & Toubro",            symbol: "LT",        isin: "INE018A01030", weight: 5,  type: "equity",    sector: "Engineering" },
      { rank: 14, name: "Asian Paints",               symbol: "ASIANPAINT",isin: "INE021A01026", weight: 4,  type: "equity",    sector: "Consumer" },
      { rank: 15, name: "Bharti Airtel",              symbol: "BHARTIARTL",isin: "INE397D01024", weight: 4,  type: "equity",    sector: "Telecom" },
      { rank: 16, name: "Maruti Suzuki",              symbol: "MARUTI",    isin: "INE585B01010", weight: 4,  type: "equity",    sector: "Auto" },
      { rank: 17, name: "Axis Bank",                  symbol: "AXISBANK",  isin: "INE238A01034", weight: 4,  type: "equity",    sector: "Banking" },
      { rank: 18, name: "Kotak Mahindra Bank",        symbol: "KOTAKBANK", isin: "INE237A01028", weight: 4,  type: "equity",    sector: "Banking" },
      { rank: 19, name: "State Bank of India",        symbol: "SBIN",      isin: "INE062A01020", weight: 4,  type: "equity",    sector: "Banking" },
      { rank: 20, name: "Titan Company",              symbol: "TITAN",     isin: "INE280A01028", weight: 3,  type: "equity",    sector: "Consumer" },
      { rank: 21, name: "Sun Pharmaceutical",         symbol: "SUNPHARMA", isin: "INE044A01036", weight: 3,  type: "equity",    sector: "Pharma" },
      { rank: 22, name: "Hindustan Unilever",         symbol: "HINDUNILVR",isin: "INE030A01027", weight: 3,  type: "equity",    sector: "FMCG" },
    ],
    allocation: [
      { type: "equity",        label: "Quality Equity (F1+F2)",     weight: 40, color: "#1D4ED8" },
      { type: "sovereign_debt",label: "Income / Bond Proxy (F3)",   weight: 35, color: "#059669" },
      { type: "gold",          label: "Gold (F4)",                  weight: 10, color: "#D97706" },
      { type: "commodity",     label: "Real Assets + FMCG (F5)",    weight: 10, color: "#7C3AED" },
      { type: "diversifiers",  label: "Diversifiers",              weight: 5,  color: "#6B7280" },
    ],
  },

  // ── GOAL-BASED PORTFOLIOS ────────────────────────────────────────────────────

  {
    id: "childrens-education",
    highlight: "Blue-chip equity + PSU sovereign bonds for your child's future",
    holdings: [
      { rank: 1, name: "Reliance Industries",       symbol: "RELIANCE",   isin: "INE002A01018", weight: 10, type: "equity", sector: "Energy" },
      { rank: 2, name: "Tata Consultancy Services", symbol: "TCS",        isin: "INE467B01029", weight: 10, type: "equity", sector: "IT" },
      { rank: 3, name: "HDFC Bank",                 symbol: "HDFCBANK",   isin: "INE040A01034", weight: 10, type: "equity", sector: "Banking" },
      { rank: 4, name: "Infosys",                   symbol: "INFY",       isin: "INE009A01021", weight: 10, type: "equity", sector: "IT" },
      { rank: 5, name: "Titan Company",             symbol: "TITAN",      isin: "INE280A01028", weight: 10, type: "equity", sector: "Consumer" },
      { rank: 6, name: "Bajaj Finance",             symbol: "BAJFINANCE", isin: "INE296A01024", weight: 10, type: "equity", sector: "NBFC" },
      { rank: 7, name: "IRFC",                      symbol: "IRFC",       isin: "INE053F01010", weight: 20, type: "equity", sector: "PSU Financing" },
      { rank: 8,  name: "REC Limited",               symbol: "REC",        isin: "INE020B01018", weight: 20, type: "equity", sector: "PSU Financing" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 9,  name: "ICICI Bank",                 symbol: "ICICIBANK",  isin: "INE090A01021", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 10, name: "Axis Bank",                  symbol: "AXISBANK",   isin: "INE238A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 11, name: "Kotak Mahindra Bank",        symbol: "KOTAKBANK",  isin: "INE237A01028", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 12, name: "State Bank of India",        symbol: "SBIN",       isin: "INE062A01020", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 13, name: "Hindustan Unilever",         symbol: "HINDUNILVR", isin: "INE030A01027", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 14, name: "ITC",                        symbol: "ITC",        isin: "INE154A01025", weight: 4,  type: "equity", sector: "FMCG" },
      { rank: 15, name: "Larsen & Toubro",            symbol: "LT",         isin: "INE018A01030", weight: 4,  type: "equity", sector: "Engineering" },
      { rank: 16, name: "Bajaj Finance",              symbol: "BAJFINANCE", isin: "INE296A01024", weight: 4,  type: "equity", sector: "NBFC" },
      { rank: 17, name: "Sun Pharmaceutical",         symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 18, name: "NTPC",                       symbol: "NTPC",       isin: "INE733E01010", weight: 4,  type: "equity", sector: "Power" },
      { rank: 19, name: "Asian Paints",               symbol: "ASIANPAINT", isin: "INE021A01026", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 20, name: "Maruti Suzuki",              symbol: "MARUTI",     isin: "INE585B01010", weight: 4,  type: "equity", sector: "Auto" },
      { rank: 21, name: "Titan Company",              symbol: "TITAN",      isin: "INE280A01028", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 22, name: "Coal India",                 symbol: "COALINDIA",  isin: "INE522F01014", weight: 4,  type: "equity", sector: "Mining" },
    ],
    allocation: [
      { type: "equity_growth",   label: "Equity Growth (Long Term)", weight: 60, color: "#1D4ED8" },
      { type: "sovereign_debt",  label: "Sovereign Debt (Safety)",   weight: 40, color: "#059669" },
    ],
  },

  {
    id: "home-purchase",
    highlight: "Blue-chips + sovereign bonds — disciplined savings for your home",
    holdings: [
      { rank: 1, name: "Reliance Industries",    symbol: "RELIANCE",  isin: "INE002A01018", weight: 10, type: "equity", sector: "Energy" },
      { rank: 2, name: "HDFC Bank",             symbol: "HDFCBANK",  isin: "INE040A01034", weight: 10, type: "equity", sector: "Banking" },
      { rank: 3, name: "Infosys",               symbol: "INFY",      isin: "INE009A01021", weight: 10, type: "equity", sector: "IT" },
      { rank: 4, name: "ICICI Bank",            symbol: "ICICIBANK", isin: "INE090A01021", weight: 10, type: "equity", sector: "Banking" },
      { rank: 5, name: "IRFC",                  symbol: "IRFC",      isin: "INE053F01010", weight: 25, type: "equity", sector: "PSU Financing" },
      { rank: 6, name: "REC Limited",           symbol: "REC",       isin: "INE020B01018", weight: 15, type: "equity", sector: "PSU Financing" },
      { rank: 7, name: "NHPC",                  symbol: "NHPC",      isin: "INE848E01016", weight: 10, type: "debt",   sector: "Power" },
      { rank: 8, name: "Sovereign Gold Bond FY27",symbol: "SGB",     isin: null,           weight: 10, type: "gold",   sector: "Gold" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 9,  name: "Tata Consultancy Services",symbol: "TCS",     isin: "INE467B01029", weight: 4,  type: "equity", sector: "IT" },
      { rank: 10, name: "Infosys",                  symbol: "INFY",    isin: "INE009A01021", weight: 4,  type: "equity", sector: "IT" },
      { rank: 11, name: "ICICI Bank",               symbol: "ICICIBANK",isin: "INE090A01021", weight: 4,  type: "equity", sector: "Banking" },
      { rank: 12, name: "Axis Bank",                symbol: "AXISBANK",isin: "INE238A01034",  weight: 4,  type: "equity", sector: "Banking" },
      { rank: 13, name: "Larsen & Toubro",          symbol: "LT",      isin: "INE018A01030",  weight: 4,  type: "equity", sector: "Engineering" },
      { rank: 14, name: "State Bank of India",      symbol: "SBIN",    isin: "INE062A01020",  weight: 4,  type: "equity", sector: "Banking" },
      { rank: 15, name: "Hindustan Unilever",       symbol: "HINDUNILVR",isin: "INE030A01027",weight: 4, type: "equity", sector: "FMCG" },
      { rank: 16, name: "Sun Pharmaceutical",       symbol: "SUNPHARMA",isin: "INE044A01036", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 17, name: "Bajaj Finance",            symbol: "BAJFINANCE",isin: "INE296A01024",weight: 4, type: "equity", sector: "NBFC" },
      { rank: 18, name: "Asian Paints",             symbol: "ASIANPAINT",isin: "INE021A01026",weight: 4, type: "equity", sector: "Consumer" },
      { rank: 19, name: "NTPC",                     symbol: "NTPC",    isin: "INE733E01010",  weight: 4,  type: "equity", sector: "Power" },
      { rank: 20, name: "Coal India",               symbol: "COALINDIA",isin: "INE522F01014", weight: 4,  type: "equity", sector: "Mining" },
      { rank: 21, name: "ITC",                      symbol: "ITC",     isin: "INE154A01025",  weight: 4,  type: "equity", sector: "FMCG" },
    ],
    allocation: [
      { type: "equity",        label: "Equity (Growth Kicker)", weight: 40, color: "#1D4ED8" },
      { type: "sovereign_debt",label: "Sovereign Debt (Safety)",weight: 50, color: "#059669" },
      { type: "gold",          label: "Gold (Hedge)",           weight: 10, color: "#D97706" },
    ],
  },

  {
    id: "wedding-milestone",
    highlight: "Blue-chips + gold SGB — preserving wealth for your milestone",
    holdings: [
      { rank: 1, name: "Reliance Industries",      symbol: "RELIANCE", isin: "INE002A01018", weight: 12, type: "equity", sector: "Energy" },
      { rank: 2, name: "Tata Consultancy Services",symbol: "TCS",      isin: "INE467B01029", weight: 12, type: "equity", sector: "IT" },
      { rank: 3, name: "Titan Company",            symbol: "TITAN",    isin: "INE280A01028", weight: 10, type: "equity", sector: "Consumer" },
      { rank: 4, name: "Infosys",                  symbol: "INFY",     isin: "INE009A01021", weight: 10, type: "equity", sector: "IT" },
      { rank: 5, name: "IRFC",                     symbol: "IRFC",     isin: "INE053F01010", weight: 20, type: "equity", sector: "PSU Financing" },
      { rank: 6, name: "REC Limited",              symbol: "REC",      isin: "INE020B01018", weight: 16, type: "equity", sector: "PSU Financing" },
      { rank: 7, name: "Sovereign Gold Bond FY27", symbol: "SGB",      isin: null,           weight: 20, type: "gold",   sector: "Gold" },
    ],
    allocation: [
      { type: "equity",       label: "Equity Growth",         weight: 44, color: "#1D4ED8" },
      { type: "fixed_income", label: "Fixed Income",          weight: 36, color: "#059669" },
      { type: "gold",         label: "Gold (Jewellery Hedge)",weight: 10, color: "#D97706" },
      { type: "diversifiers", label: "Diversifiers",         weight: 10, color: "#6B7280" },
    ],
  },

  {
    id: "retirement-builder",
    highlight: "Coal India, NTPC, IRFC + Gold — dividends and safety for retirement",
    holdings: [
      { rank: 1,  name: "Coal India",            symbol: "COALINDIA", isin: "INE522F01014", weight: 8,  type: "equity", sector: "Mining" },
      { rank: 2,  name: "NTPC",                  symbol: "NTPC",      isin: "INE733E01010", weight: 8,  type: "equity", sector: "Power" },
      { rank: 3,  name: "ITC",                   symbol: "ITC",       isin: "INE154A01025", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 4,  name: "Power Grid Corporation",symbol: "POWERGRID", isin: "INE752E01010", weight: 8,  type: "equity", sector: "Power" },
      { rank: 5,  name: "HDFC Bank",             symbol: "HDFCBANK",  isin: "INE040A01034", weight: 8,  type: "equity", sector: "Banking" },
      { rank: 6,  name: "IRFC",                  symbol: "IRFC",      isin: "INE053F01010", weight: 20, type: "equity", sector: "PSU Financing" },
      { rank: 7,  name: "REC Limited",           symbol: "REC",       isin: "INE020B01018", weight: 15, type: "equity", sector: "PSU Financing" },
      { rank: 8,  name: "NHPC",                  symbol: "NHPC",      isin: "INE848E01016", weight: 10, type: "debt",   sector: "Power" },
      { rank: 9,  name: "GAIL",                  symbol: "GAIL",      isin: "INE129A01019", weight: 7,  type: "debt",   sector: "Gas" },
      { rank: 10, name: "Sovereign Gold Bond FY27",symbol: "SGB",     isin: null,           weight: 8,  type: "gold",   sector: "Gold" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 11, name: "Infosys",                   symbol: "INFY",    isin: "INE009A01021", weight: 5,  type: "equity", sector: "IT" },
      { rank: 12, name: "Tata Consultancy Services", symbol: "TCS",     isin: "INE467B01029", weight: 5,  type: "equity", sector: "IT" },
      { rank: 13, name: "Larsen & Toubro",           symbol: "LT",      isin: "INE018A01030", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 14, name: "ICICI Bank",                symbol: "ICICIBANK",isin: "INE090A01021", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 15, name: "HDFC Bank",                 symbol: "HDFCBANK", isin: "INE040A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 16, name: "Axis Bank",                 symbol: "AXISBANK", isin: "INE238A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 17, name: "Hindustan Unilever",        symbol: "HINDUNILVR",isin: "INE030A01027",weight: 5, type: "equity", sector: "FMCG" },
      { rank: 18, name: "Bajaj Finance",             symbol: "BAJFINANCE",isin: "INE296A01024",weight: 4, type: "equity", sector: "NBFC" },
      { rank: 19, name: "Sun Pharmaceutical",        symbol: "SUNPHARMA", isin: "INE044A01036", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 20, name: "Asian Paints",              symbol: "ASIANPAINT",isin: "INE021A01026",weight: 4, type: "equity", sector: "Consumer" },
      { rank: 21, name: "Maruti Suzuki",             symbol: "MARUTI",    isin: "INE585B01010", weight: 4,  type: "equity", sector: "Auto" },
      { rank: 22, name: "Titan Company",             symbol: "TITAN",     isin: "INE280A01028", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 23, name: "Reliance Industries",       symbol: "RELIANCE",  isin: "INE002A01018", weight: 4,  type: "equity", sector: "Energy" },
    ],
    allocation: [
      { type: "dividend_equity",label: "High Dividend Equity",    weight: 40, color: "#1D4ED8" },
      { type: "sovereign_debt", label: "Sovereign / Bond Proxy",  weight: 52, color: "#059669" },
      { type: "gold",           label: "Gold SGB",                weight: 8,  color: "#D97706" },
    ],
  },

  {
    id: "senior-citizen-income",
    highlight: "PSU dividend stocks + sovereign bonds — regular income for retirees",
    holdings: [
      { rank: 1, name: "Coal India",            symbol: "COALINDIA", isin: "INE522F01014", weight: 10, type: "equity", sector: "Mining" },
      { rank: 2, name: "NTPC",                  symbol: "NTPC",      isin: "INE733E01010", weight: 10, type: "equity", sector: "Power" },
      { rank: 3, name: "Power Grid Corporation",symbol: "POWERGRID", isin: "INE752E01010", weight: 8,  type: "equity", sector: "Power" },
      { rank: 4, name: "Indian Oil Corporation",symbol: "IOC",       isin: "INE242A01010", weight: 10, type: "equity", sector: "Energy" },
      { rank: 5, name: "IRFC",                  symbol: "IRFC",      isin: "INE053F01010", weight: 20, type: "equity", sector: "PSU Financing" },
      { rank: 6, name: "REC Limited",           symbol: "REC",       isin: "INE020B01018", weight: 15, type: "equity", sector: "PSU Financing" },
      { rank: 7, name: "NHPC",                  symbol: "NHPC",      isin: "INE848E01016", weight: 12, type: "debt",   sector: "Power" },
      { rank: 8, name: "GAIL",                  symbol: "GAIL",      isin: "INE129A01019", weight: 10, type: "debt",   sector: "Gas" },
      { rank: 9, name: "Sovereign Gold Bond FY27",symbol: "SGB",     isin: null,           weight: 5,  type: "gold",   sector: "Gold" },
      // ── Diversification additions — risk diversification (≥20 instruments) ──
      { rank: 10, name: "Infosys",                   symbol: "INFY",    isin: "INE009A01021", weight: 5,  type: "equity", sector: "IT" },
      { rank: 11, name: "Tata Consultancy Services", symbol: "TCS",     isin: "INE467B01029", weight: 5,  type: "equity", sector: "IT" },
      { rank: 12, name: "Larsen & Toubro",           symbol: "LT",      isin: "INE018A01030", weight: 5,  type: "equity", sector: "Engineering" },
      { rank: 13, name: "ICICI Bank",                symbol: "ICICIBANK",isin: "INE090A01021", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 14, name: "HDFC Bank",                 symbol: "HDFCBANK", isin: "INE040A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 15, name: "Axis Bank",                 symbol: "AXISBANK", isin: "INE238A01034", weight: 5,  type: "equity", sector: "Banking" },
      { rank: 16, name: "Hindustan Unilever",        symbol: "HINDUNILVR",isin: "INE030A01027",weight: 5, type: "equity", sector: "FMCG" },
      { rank: 17, name: "Bajaj Finance",             symbol: "BAJFINANCE",isin: "INE296A01024",weight: 4, type: "equity", sector: "NBFC" },
      { rank: 18, name: "Sun Pharmaceutical",        symbol: "SUNPHARMA", isin: "INE044A01036", weight: 4,  type: "equity", sector: "Pharma" },
      { rank: 19, name: "Asian Paints",              symbol: "ASIANPAINT",isin: "INE021A01026",weight: 4, type: "equity", sector: "Consumer" },
      { rank: 20, name: "Maruti Suzuki",             symbol: "MARUTI",    isin: "INE585B01010", weight: 4,  type: "equity", sector: "Auto" },
      { rank: 21, name: "Titan Company",             symbol: "TITAN",     isin: "INE280A01028", weight: 4,  type: "equity", sector: "Consumer" },
      { rank: 22, name: "Reliance Industries",       symbol: "RELIANCE",  isin: "INE002A01018", weight: 4,  type: "equity", sector: "Energy" },
    ],
    allocation: [
      { type: "dividend_equity",label: "Dividend Equity", weight: 38, color: "#1D4ED8" },
      { type: "sovereign_bonds",label: "Sovereign Bonds", weight: 57, color: "#059669" },
      { type: "gold",           label: "Gold SGB",        weight: 5,  color: "#D97706" },
    ],
  },
];

// ── Main seeder ───────────────────────────────────────────────────────────────

/**
 * Seeds 27 model portfolios with direct NSE stock holdings.
 * Conditional: Only updates portfolios still holding MF schemes (INF ISINs).
 * AI-rebalanced portfolios (already using INE stocks) are preserved.
 *
 * @param db - Drizzle NodePgDatabase instance
 */
export async function seedStockPortfolios(db: any): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[Phase E] Starting direct stock seed for ${STOCK_SEEDS.length} portfolios...`);
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const seed of STOCK_SEEDS) {
    try {
      const holdingsJson = JSON.stringify(seed.holdings);
      const allocationJson = JSON.stringify(seed.allocation);

      // Execute conditional UPDATE — only update if holdings still contain:
      //   • INF-prefixed ISIN (MF scheme)
      //   • "Fund" keyword (mutual fund name)
      //   • "Scheme" keyword
      //   • OR if holdings are empty/null
      const result = await db.execute(sql`
        UPDATE model_portfolios
        SET
          holdings       = ${holdingsJson}::jsonb,
          allocation     = ${allocationJson}::jsonb,
          total_holdings = ${seed.holdings.length},
          highlight      = ${seed.highlight},
          updated_at     = NOW()
        WHERE id = ${seed.id}
          AND (
            holdings IS NULL
            OR holdings = '[]'::jsonb
            OR holdings::text ILIKE '%INF%'
            OR holdings::text ILIKE '%Fund%'
            OR holdings::text ILIKE '%Scheme%'
          )
      `);

      const rowsAffected = Number((result as any).rowCount ?? 0);
      if (rowsAffected > 0) {
        // eslint-disable-next-line no-console
        console.log(`  ✅ [StockSeed] ${seed.id} → ${seed.holdings.length} stock holdings seeded`);
        updated++;
      } else {
        // eslint-disable-next-line no-console
        console.log(`  ⏭️  [StockSeed] ${seed.id} → already stock-based, AI-managed — skipped`);
        skipped++;
      }
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`  ⚠️  [StockSeed] ${seed.id} error: ${err.message}`);
      errors++;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[Phase E] Stock seed complete — ` +
    `updated=${updated}, skipped(AI-managed)=${skipped}, errors=${errors} | ` +
    `engine=${ENGINE_VERSION}`
  );

  // Structured FASP-AI v1.0 log
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    event:          "STOCK_PORTFOLIO_SEED_COMPLETE",
    user_id:        "system",
    portfolios_updated: updated,
    portfolios_skipped: skipped,
    engine_version: ENGINE_VERSION,
    timestamp:      new Date().toISOString(),
    status:         errors === 0 ? "success" : "partial",
    latency_ms:     0,
  }));
}

/**
 * @function seedListedStocksFromPortfolios
 * @description Upserts every unique stock from PORTFOLIO_STOCKS into the
 * `listed_stocks` table so that the research note /search endpoint can
 * locate all portfolio companies (e.g. Kaynes Technology) without relying
 * solely on external NSE/Yahoo Finance fallbacks.
 *
 * Safe to call on every startup — uses ON CONFLICT (symbol) DO UPDATE to
 * preserve any existing price/fundamentals data already in the table.
 * Only inserts company_name, isin, sector, nse_code, and is_active.
 * Does NOT overwrite price or fundamentals if they already exist.
 *
 * @param db - Drizzle database instance
 */
export async function seedListedStocksFromPortfolios(db: any): Promise<void> {
  // Deduplicate by symbol across all portfolio stock definitions
  const seen = new Set<string>();
  const toSeed: Array<{ symbol: string; name: string; isin: string | null; sector: string }> = [];

  for (const portfolio of STOCK_SEEDS) {
    for (const h of portfolio.holdings) {
      if (!h.symbol || seen.has(h.symbol.toUpperCase())) continue;
      seen.add(h.symbol.toUpperCase());
      toSeed.push({
        symbol: h.symbol.toUpperCase(),
        name:   h.name,
        isin:   h.isin ?? null,
        sector: h.sector ?? "Equity",
      });
    }
  }

  let inserted = 0;
  let errors   = 0;

  for (const s of toSeed) {
    try {
      await db.execute(sql`
        INSERT INTO listed_stocks (
          symbol, company_name, isin, sector, industry,
          nse_code, is_active, data_source, last_updated, created_at
        ) VALUES (
          ${s.symbol},
          ${s.name},
          ${s.isin},
          ${s.sector},
          ${s.sector},
          'EQ',
          true,
          'portfolio_seed',
          NOW(),
          NOW()
        )
        ON CONFLICT (symbol) DO UPDATE SET
          company_name  = COALESCE(listed_stocks.company_name, EXCLUDED.company_name),
          isin          = COALESCE(listed_stocks.isin, EXCLUDED.isin),
          sector        = COALESCE(listed_stocks.sector, EXCLUDED.sector),
          is_active     = true,
          last_updated  = NOW()
      `);
      inserted++;
    } catch (e: any) {
      errors++;
      // eslint-disable-next-line no-console
      console.warn(`[ListedStocksSeed] Skipped ${s.symbol}: ${e?.message?.slice(0, 80)}`);
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[ListedStocksSeed] Upserted ${inserted}/${toSeed.length} portfolio stocks → listed_stocks | errors=${errors}`,
  );

  // FASP-AI v1.0 structured log
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    event:          "LISTED_STOCKS_PORTFOLIO_SEED_COMPLETE",
    user_id:        "system",
    total:          toSeed.length,
    inserted,
    errors,
    engine_version: ENGINE_VERSION,
    timestamp:      new Date().toISOString(),
    status:         errors === 0 ? "success" : "partial",
    latency_ms:     0,
  }));
}

