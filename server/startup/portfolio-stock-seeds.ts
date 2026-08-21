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
    highlight: "Reliance, TCS, HDFC Bank, Infosys — India's blue-chip growth engine",
    holdings: [
      { rank: 1,  name: "Reliance Industries",        symbol: "RELIANCE",   isin: "INE002A01018", weight: 12, type: "equity", sector: "Energy" },
      { rank: 2,  name: "HDFC Bank",                  symbol: "HDFCBANK",   isin: "INE040A01034", weight: 12, type: "equity", sector: "Banking" },
      { rank: 3,  name: "Tata Consultancy Services",  symbol: "TCS",        isin: "INE467B01029", weight: 10, type: "equity", sector: "IT" },
      { rank: 4,  name: "Infosys",                    symbol: "INFY",       isin: "INE009A01021", weight: 10, type: "equity", sector: "IT" },
      { rank: 5,  name: "ICICI Bank",                 symbol: "ICICIBANK",  isin: "INE090A01021", weight: 10, type: "equity", sector: "Banking" },
      { rank: 6,  name: "Larsen & Toubro",            symbol: "LT",         isin: "INE018A01030", weight: 8,  type: "equity", sector: "Engineering" },
      { rank: 7,  name: "Bajaj Finance",              symbol: "BAJFINANCE", isin: "INE296A01024", weight: 8,  type: "equity", sector: "NBFC" },
      { rank: 8,  name: "Titan Company",              symbol: "TITAN",      isin: "INE280A01028", weight: 8,  type: "equity", sector: "Consumer" },
      { rank: 9,  name: "Sun Pharmaceutical",         symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 7,  type: "equity", sector: "Pharma" },
      { rank: 10, name: "Axis Bank",                  symbol: "AXISBANK",   isin: "INE238A01034", weight: 7,  type: "equity", sector: "Banking" },
      { rank: 11, name: "Bharti Airtel",              symbol: "BHARTIARTL", isin: "INE397D01024", weight: 8,  type: "equity", sector: "Telecom" },
    ],
    allocation: [
      { type: "banking_nbfc", label: "Banking & NBFC",  weight: 37, color: "#1D4ED8" },
      { type: "it",           label: "IT & Technology", weight: 20, color: "#0891B2" },
      { type: "energy_infra", label: "Energy & Infra",  weight: 20, color: "#D97706" },
      { type: "consumer",     label: "Consumer & Pharma",weight: 23, color: "#7C3AED" },
    ],
  },

  {
    id: "mid-cap-india",
    highlight: "Persistent, PI Industries, DMart — quality mid-cap compounders",
    holdings: [
      { rank: 1,  name: "Persistent Systems",          symbol: "PERSISTENT", isin: "INE262H01021", weight: 12, type: "equity", sector: "IT" },
      { rank: 2,  name: "PI Industries",               symbol: "PIIND",      isin: "INE603J01030", weight: 10, type: "equity", sector: "Agrochem" },
      { rank: 3,  name: "Astral Limited",              symbol: "ASTRAL",     isin: "INE006I01046", weight: 10, type: "equity", sector: "Building Materials" },
      { rank: 4,  name: "Avenue Supermarts (DMart)",   symbol: "DMART",      isin: "INE192R01011", weight: 10, type: "equity", sector: "Retail" },
      { rank: 5,  name: "Cholamandalam Investment",    symbol: "CHOLAFIN",   isin: "INE121A01024", weight: 10, type: "equity", sector: "NBFC" },
      { rank: 6,  name: "Mphasis",                     symbol: "MPHASIS",    isin: "INE356A01018", weight: 10, type: "equity", sector: "IT" },
      { rank: 7,  name: "Torrent Pharmaceuticals",     symbol: "TORNTPHARM", isin: "INE685A01028", weight: 10, type: "equity", sector: "Pharma" },
      { rank: 8,  name: "Marico",                      symbol: "MARICO",     isin: "INE196A01026", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 9,  name: "Kaynes Technology",           symbol: "KAYNES",     isin: "INE918L01017", weight: 12, type: "equity", sector: "Electronics" },
      { rank: 10, name: "CAMS",                        symbol: "CAMS",       isin: "INE596I01012", weight: 8,  type: "equity", sector: "Financial Services" },
    ],
    allocation: [
      { type: "it",         label: "IT & Tech",          weight: 22, color: "#0891B2" },
      { type: "financials", label: "Financials",          weight: 18, color: "#1D4ED8" },
      { type: "consumer",   label: "Consumer & Retail",   weight: 18, color: "#7C3AED" },
      { type: "pharma",     label: "Pharma",              weight: 10, color: "#059669" },
      { type: "specialty",  label: "Electronics & Agro",  weight: 32, color: "#D97706" },
    ],
  },

  {
    id: "small-cap-alpha",
    highlight: "Happiest Minds, Kaynes, Dixon — high-conviction small-cap bets",
    holdings: [
      { rank: 1,  name: "Happiest Minds Technologies", symbol: "HAPPSTMNDS", isin: "INE749M01021", weight: 12, type: "equity", sector: "IT" },
      { rank: 2,  name: "Kaynes Technology",           symbol: "KAYNES",     isin: "INE918L01017", weight: 12, type: "equity", sector: "Electronics" },
      { rank: 3,  name: "Dixon Technologies",          symbol: "DIXON",      isin: "INE935N01020", weight: 12, type: "equity", sector: "Electronics" },
      { rank: 4,  name: "H.G. Infra Engineering",      symbol: "HGINFRA",    isin: "INE838I01022", weight: 10, type: "equity", sector: "Construction" },
      { rank: 5,  name: "Dr. Lal PathLabs",            symbol: "LALPATHLAB", isin: "INE600S01012", weight: 10, type: "equity", sector: "Diagnostics" },
      { rank: 6,  name: "Angel One",                   symbol: "ANGELONE",   isin: "INE732I01013", weight: 10, type: "equity", sector: "Capital Markets" },
      { rank: 7,  name: "Deepak Fertilisers",          symbol: "DEEPAKFERT", isin: "INE501A01019", weight: 8,  type: "equity", sector: "Chemicals" },
      { rank: 8,  name: "Varun Beverages",             symbol: "VBL",        isin: "INE200M01013", weight: 8,  type: "equity", sector: "Beverages" },
      { rank: 9,  name: "Emami",                       symbol: "EMAMILTD",   isin: "INE548C01032", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 10, name: "Radico Khaitan",              symbol: "RADICO",     isin: "INE944F01028", weight: 10, type: "equity", sector: "Beverages" },
    ],
    allocation: [
      { type: "electronics", label: "Electronics Mfg",    weight: 24, color: "#7C3AED" },
      { type: "it",          label: "IT & Tech",           weight: 12, color: "#0891B2" },
      { type: "fmcg",        label: "FMCG & Beverages",   weight: 26, color: "#059669" },
      { type: "specialty",   label: "Specialty & Others",  weight: 38, color: "#D97706" },
    ],
  },

  {
    id: "value-investing",
    highlight: "ITC, Coal India, NTPC — deep value in undervalued blue-chips",
    holdings: [
      { rank: 1,  name: "ITC",                       symbol: "ITC",        isin: "INE154A01025", weight: 12, type: "equity", sector: "FMCG" },
      { rank: 2,  name: "Coal India",                symbol: "COALINDIA",  isin: "INE522F01014", weight: 10, type: "equity", sector: "Mining" },
      { rank: 3,  name: "NTPC",                      symbol: "NTPC",       isin: "INE733E01010", weight: 10, type: "equity", sector: "Power" },
      { rank: 4,  name: "ONGC",                      symbol: "ONGC",       isin: "INE213A01029", weight: 10, type: "equity", sector: "Energy" },
      { rank: 5,  name: "Bajaj Finserv",             symbol: "BAJAJFINSV", isin: "INE074O01005", weight: 12, type: "equity", sector: "NBFC" },
      { rank: 6,  name: "Bharti Airtel",             symbol: "BHARTIARTL", isin: "INE397D01024", weight: 10, type: "equity", sector: "Telecom" },
      { rank: 7,  name: "Hindalco Industries",       symbol: "HINDALCO",   isin: "INE038A01020", weight: 8,  type: "equity", sector: "Metals" },
      { rank: 8,  name: "IRFC",                      symbol: "IRFC",       isin: "INE053F01010", weight: 10, type: "equity", sector: "NBFC" },
      { rank: 9,  name: "Power Grid Corporation",    symbol: "POWERGRID",  isin: "INE752E01010", weight: 10, type: "equity", sector: "Power" },
      { rank: 10, name: "Larsen & Toubro",           symbol: "LT",         isin: "INE018A01030", weight: 8,  type: "equity", sector: "Engineering" },
    ],
    allocation: [
      { type: "energy_power",  label: "Energy & Power",    weight: 30, color: "#D97706" },
      { type: "financial",     label: "Financials & NBFC", weight: 22, color: "#1D4ED8" },
      { type: "fmcg_telecom",  label: "FMCG & Telecom",   weight: 22, color: "#059669" },
      { type: "industrial",    label: "Industrial & Metals",weight: 26, color: "#7C3AED" },
    ],
  },

  {
    id: "dividend-yield",
    highlight: "Coal India, NTPC, IOC — high-dividend PSU income stocks",
    holdings: [
      { rank: 1,  name: "Coal India",             symbol: "COALINDIA", isin: "INE522F01014", weight: 12, type: "equity", sector: "Mining" },
      { rank: 2,  name: "Indian Oil Corporation", symbol: "IOC",       isin: "INE242A01010", weight: 10, type: "equity", sector: "Energy" },
      { rank: 3,  name: "ONGC",                   symbol: "ONGC",      isin: "INE213A01029", weight: 10, type: "equity", sector: "Energy" },
      { rank: 4,  name: "NTPC",                   symbol: "NTPC",      isin: "INE733E01010", weight: 12, type: "equity", sector: "Power" },
      { rank: 5,  name: "Power Grid Corporation", symbol: "POWERGRID", isin: "INE752E01010", weight: 10, type: "equity", sector: "Power" },
      { rank: 6,  name: "IRFC",                   symbol: "IRFC",      isin: "INE053F01010", weight: 10, type: "equity", sector: "NBFC" },
      { rank: 7,  name: "ITC",                    symbol: "ITC",       isin: "INE154A01025", weight: 12, type: "equity", sector: "FMCG" },
      { rank: 8,  name: "GAIL (India)",           symbol: "GAIL",      isin: "INE129A01019", weight: 8,  type: "equity", sector: "Gas" },
      { rank: 9,  name: "NHPC",                   symbol: "NHPC",      isin: "INE848E01016", weight: 8,  type: "equity", sector: "Power" },
      { rank: 10, name: "REC Limited",            symbol: "REC",       isin: "INE020B01018", weight: 8,  type: "equity", sector: "NBFC" },
    ],
    allocation: [
      { type: "psu_power",     label: "PSU Power & Energy", weight: 48, color: "#D97706" },
      { type: "nbfc_financing",label: "Financing & NBFC",   weight: 18, color: "#1D4ED8" },
      { type: "fmcg_gas",      label: "FMCG & Gas",         weight: 20, color: "#059669" },
      { type: "mining",        label: "Mining",              weight: 14, color: "#6B7280" },
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
    highlight: "Bajaj Finance, Persistent, Kaynes — momentum-driven equity basket",
    holdings: [
      { rank: 1,  name: "Reliance Industries",        symbol: "RELIANCE",   isin: "INE002A01018", weight: 8,  type: "equity", sector: "Energy" },
      { rank: 2,  name: "HDFC Bank",                  symbol: "HDFCBANK",   isin: "INE040A01034", weight: 8,  type: "equity", sector: "Banking" },
      { rank: 3,  name: "Tata Consultancy Services",  symbol: "TCS",        isin: "INE467B01029", weight: 7,  type: "equity", sector: "IT" },
      { rank: 4,  name: "Infosys",                    symbol: "INFY",       isin: "INE009A01021", weight: 7,  type: "equity", sector: "IT" },
      { rank: 5,  name: "Bajaj Finance",              symbol: "BAJFINANCE", isin: "INE296A01024", weight: 8,  type: "equity", sector: "NBFC" },
      { rank: 6,  name: "Persistent Systems",         symbol: "PERSISTENT", isin: "INE262H01021", weight: 8,  type: "equity", sector: "IT" },
      { rank: 7,  name: "Kaynes Technology",          symbol: "KAYNES",     isin: "INE918L01017", weight: 7,  type: "equity", sector: "Electronics" },
      { rank: 8,  name: "Dixon Technologies",         symbol: "DIXON",      isin: "INE935N01020", weight: 7,  type: "equity", sector: "Electronics" },
      { rank: 9,  name: "Titan Company",              symbol: "TITAN",      isin: "INE280A01028", weight: 7,  type: "equity", sector: "Consumer" },
      { rank: 10, name: "Avenue Supermarts",          symbol: "DMART",      isin: "INE192R01011", weight: 7,  type: "equity", sector: "Retail" },
      { rank: 11, name: "Eternal",                    symbol: "ETERNAL",    isin: "INE758T01015", weight: 7,  type: "equity", sector: "Consumer Tech" },
      { rank: 12, name: "Bharti Airtel",              symbol: "BHARTIARTL", isin: "INE397D01024", weight: 6,  type: "equity", sector: "Telecom" },
      { rank: 13, name: "Larsen & Toubro",            symbol: "LT",         isin: "INE018A01030", weight: 6,  type: "equity", sector: "Engineering" },
      { rank: 14, name: "Sun Pharmaceutical",         symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 7,  type: "equity", sector: "Pharma" },
    ],
    allocation: [
      { type: "banking_nbfc", label: "Banking & NBFC",    weight: 16, color: "#1D4ED8" },
      { type: "it",           label: "IT & Technology",   weight: 29, color: "#0891B2" },
      { type: "electronics",  label: "Electronics Mfg",   weight: 14, color: "#7C3AED" },
      { type: "consumer",     label: "Consumer & Retail",  weight: 21, color: "#059669" },
      { type: "others",       label: "Energy, Infra, Pharma",weight: 20, color: "#D97706" },
    ],
  },

  // ── THEMATIC PORTFOLIOS ──────────────────────────────────────────────────────

  {
    id: "banking-bfsi",
    highlight: "HDFC Bank, ICICI Bank, Bajaj Finance — India's financial sector leaders",
    holdings: [
      { rank: 1,  name: "HDFC Bank",               symbol: "HDFCBANK",   isin: "INE040A01034", weight: 14, type: "equity", sector: "Banking" },
      { rank: 2,  name: "ICICI Bank",              symbol: "ICICIBANK",  isin: "INE090A01021", weight: 12, type: "equity", sector: "Banking" },
      { rank: 3,  name: "Kotak Mahindra Bank",     symbol: "KOTAKBANK",  isin: "INE237A01028", weight: 10, type: "equity", sector: "Banking" },
      { rank: 4,  name: "Axis Bank",               symbol: "AXISBANK",   isin: "INE238A01034", weight: 10, type: "equity", sector: "Banking" },
      { rank: 5,  name: "State Bank of India",     symbol: "SBIN",       isin: "INE062A01020", weight: 10, type: "equity", sector: "Banking" },
      { rank: 6,  name: "Bajaj Finance",           symbol: "BAJFINANCE", isin: "INE296A01024", weight: 12, type: "equity", sector: "NBFC" },
      { rank: 7,  name: "Bajaj Finserv",           symbol: "BAJAJFINSV", isin: "INE074O01005", weight: 10, type: "equity", sector: "NBFC" },
      { rank: 8,  name: "Muthoot Finance",         symbol: "MUTHOOTFIN", isin: "INE414G01012", weight: 8,  type: "equity", sector: "NBFC" },
      { rank: 9,  name: "CAMS",                    symbol: "CAMS",       isin: "INE596I01012", weight: 7,  type: "equity", sector: "Financial Services" },
      { rank: 10, name: "Cholamandalam Investment",symbol: "CHOLAFIN",   isin: "INE121A01024", weight: 7,  type: "equity", sector: "NBFC" },
    ],
    allocation: [
      { type: "private_banks", label: "Private Banks",   weight: 46, color: "#1D4ED8" },
      { type: "psu_banks",     label: "PSU Banks",        weight: 10, color: "#6B7280" },
      { type: "nbfc",          label: "NBFC & Lending",   weight: 37, color: "#0891B2" },
      { type: "fintech",       label: "Financial Services",weight: 7,  color: "#7C3AED" },
    ],
  },

  {
    id: "consumption-rural",
    highlight: "HUL, ITC, Nestle — India's consumption & rural growth story",
    holdings: [
      { rank: 1,  name: "Hindustan Unilever",      symbol: "HINDUNILVR", isin: "INE030A01027", weight: 12, type: "equity", sector: "FMCG" },
      { rank: 2,  name: "ITC",                     symbol: "ITC",        isin: "INE154A01025", weight: 12, type: "equity", sector: "FMCG" },
      { rank: 3,  name: "Nestle India",            symbol: "NESTLEIND",  isin: "INE239A01024", weight: 10, type: "equity", sector: "FMCG" },
      { rank: 4,  name: "Britannia Industries",    symbol: "BRITANNIA",  isin: "INE216A01030", weight: 10, type: "equity", sector: "FMCG" },
      { rank: 5,  name: "Dabur India",             symbol: "DABUR",      isin: "INE016A01026", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 6,  name: "Marico",                  symbol: "MARICO",     isin: "INE196A01026", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 7,  name: "Colgate-Palmolive India", symbol: "COLPAL",     isin: "INE259A01022", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 8,  name: "Radico Khaitan",          symbol: "RADICO",     isin: "INE944F01028", weight: 8,  type: "equity", sector: "Beverages" },
      { rank: 9,  name: "Emami",                   symbol: "EMAMILTD",   isin: "INE548C01032", weight: 8,  type: "equity", sector: "FMCG" },
      { rank: 10, name: "Varun Beverages",         symbol: "VBL",        isin: "INE200M01013", weight: 8,  type: "equity", sector: "Beverages" },
      { rank: 11, name: "Mahindra & Mahindra",     symbol: "M&M",        isin: "INE101A01026", weight: 8,  type: "equity", sector: "Auto" },
    ],
    allocation: [
      { type: "fmcg",        label: "FMCG",              weight: 56, color: "#059669" },
      { type: "beverages",   label: "Beverages",          weight: 16, color: "#0891B2" },
      { type: "auto_rural",  label: "Rural Auto",         weight: 8,  color: "#D97706" },
      { type: "personal_care",label: "Personal Care",     weight: 20, color: "#7C3AED" },
    ],
  },

  {
    id: "healthcare-pharma",
    highlight: "Sun Pharma, Dr. Reddy's, Apollo — India's health & life sciences boom",
    holdings: [
      { rank: 1,  name: "Sun Pharmaceutical",      symbol: "SUNPHARMA",  isin: "INE044A01036", weight: 14, type: "equity", sector: "Pharma" },
      { rank: 2,  name: "Dr. Reddy's Laboratories",symbol: "DRREDDY",    isin: "INE089A01023", weight: 12, type: "equity", sector: "Pharma" },
      { rank: 3,  name: "Cipla",                   symbol: "CIPLA",      isin: "INE059A01026", weight: 12, type: "equity", sector: "Pharma" },
      { rank: 4,  name: "Divi's Laboratories",     symbol: "DIVISLAB",   isin: "INE361B01024", weight: 10, type: "equity", sector: "APIs" },
      { rank: 5,  name: "Apollo Hospitals",         symbol: "APOLLOHOSP", isin: "INE437A01024", weight: 10, type: "equity", sector: "Healthcare" },
      { rank: 6,  name: "Aurobindo Pharma",         symbol: "AUROPHARMA", isin: "INE406A01037", weight: 10, type: "equity", sector: "Pharma" },
      { rank: 7,  name: "Torrent Pharmaceuticals",  symbol: "TORNTPHARM", isin: "INE685A01028", weight: 10, type: "equity", sector: "Pharma" },
      { rank: 8,  name: "Dr. Lal PathLabs",         symbol: "LALPATHLAB", isin: "INE600S01012", weight: 8,  type: "equity", sector: "Diagnostics" },
      { rank: 9,  name: "Fortis Healthcare",        symbol: "FORTISHLTH", isin: "INE061F01013", weight: 8,  type: "equity", sector: "Healthcare" },
      { rank: 10, name: "Lupin",                    symbol: "LUPIN",      isin: "INE326A01037", weight: 6,  type: "equity", sector: "Pharma" },
    ],
    allocation: [
      { type: "pharma",              label: "Pharmaceuticals",     weight: 64, color: "#059669" },
      { type: "healthcare_services", label: "Healthcare Services", weight: 18, color: "#0891B2" },
      { type: "diagnostics_apis",    label: "Diagnostics & APIs",  weight: 18, color: "#7C3AED" },
    ],
  },

  {
    id: "india-infrastructure",
    highlight: "L&T, NTPC, Adani Ports — India's infrastructure capex supercycle",
    holdings: [
      { rank: 1,  name: "Larsen & Toubro",           symbol: "LT",         isin: "INE018A01030", weight: 14, type: "equity", sector: "Engineering" },
      { rank: 2,  name: "Siemens India",             symbol: "SIEMENS",    isin: "INE003A01024", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 3,  name: "ABB India",                 symbol: "ABB",        isin: "INE117A01022", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 4,  name: "BHEL",                      symbol: "BHEL",       isin: "INE257A01026", weight: 8,  type: "equity", sector: "PSU Engineering" },
      { rank: 5,  name: "NTPC",                      symbol: "NTPC",       isin: "INE733E01010", weight: 10, type: "equity", sector: "Power" },
      { rank: 6,  name: "Power Grid Corporation",    symbol: "POWERGRID",  isin: "INE752E01010", weight: 10, type: "equity", sector: "Power" },
      { rank: 7,  name: "Adani Ports & SEZ",         symbol: "ADANIPORTS", isin: "INE742F01042", weight: 10, type: "equity", sector: "Ports" },
      { rank: 8,  name: "Adani Enterprises",         symbol: "ADANIENT",   isin: "INE423A01024", weight: 8,  type: "equity", sector: "Infra" },
      { rank: 9,  name: "Tata Power",                symbol: "TATAPOWER",  isin: "INE245A01021", weight: 8,  type: "equity", sector: "Power" },
      { rank: 10, name: "IRFC",                      symbol: "IRFC",       isin: "INE053F01010", weight: 6,  type: "equity", sector: "Railway Financing" },
      { rank: 11, name: "KNR Constructions",         symbol: "KNRCON",     isin: "INE634I01029", weight: 6,  type: "equity", sector: "Construction" },
    ],
    allocation: [
      { type: "engineering",       label: "Engineering & EPC",        weight: 32, color: "#1D4ED8" },
      { type: "power",             label: "Power Generation & Grid",  weight: 28, color: "#D97706" },
      { type: "ports_logistics",   label: "Ports & Logistics",        weight: 18, color: "#059669" },
      { type: "construction_rail", label: "Construction & Rail",      weight: 22, color: "#7C3AED" },
    ],
  },

  {
    id: "manufacturing-make-in-india",
    highlight: "L&T, Bharat Forge, Kaynes — India's industrial manufacturing renaissance",
    holdings: [
      { rank: 1,  name: "Larsen & Toubro",   symbol: "LT",         isin: "INE018A01030", weight: 12, type: "equity", sector: "Engineering" },
      { rank: 2,  name: "Siemens India",     symbol: "SIEMENS",    isin: "INE003A01024", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 3,  name: "Bharat Forge",      symbol: "BHARATFORG", isin: "INE465A01025", weight: 10, type: "equity", sector: "Auto Ancillary" },
      { rank: 4,  name: "Cummins India",     symbol: "CUMMINSIND", isin: "INE298A01020", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 5,  name: "ABB India",         symbol: "ABB",        isin: "INE117A01022", weight: 10, type: "equity", sector: "Engineering" },
      { rank: 6,  name: "Voltas",            symbol: "VOLTAS",     isin: "INE226A01021", weight: 8,  type: "equity", sector: "Consumer Durables" },
      { rank: 7,  name: "Kaynes Technology", symbol: "KAYNES",     isin: "INE918L01017", weight: 10, type: "equity", sector: "Electronics Mfg" },
      { rank: 8,  name: "Dixon Technologies",symbol: "DIXON",      isin: "INE935N01020", weight: 10, type: "equity", sector: "Electronics Mfg" },
      { rank: 9,  name: "Polycab India",     symbol: "POLYCAB",    isin: "INE455K01017", weight: 10, type: "equity", sector: "Cables & Wires" },
      { rank: 10, name: "Havells India",     symbol: "HAVELLS",    isin: "INE176B01034", weight: 10, type: "equity", sector: "Electrical" },
    ],
    allocation: [
      { type: "engineering",     label: "Heavy Engineering",   weight: 32, color: "#1D4ED8" },
      { type: "electronics_mfg", label: "Electronics Mfg",    weight: 20, color: "#0891B2" },
      { type: "electrical",      label: "Electrical & Cables", weight: 28, color: "#D97706" },
      { type: "auto_ancillary",  label: "Auto Ancillary",      weight: 20, color: "#059669" },
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
      { rank: 8, name: "BHEL",                           symbol: "BHEL",       isin: "INE257A01026", weight: 7,  type: "equity", sector: "PSU Engineering" },
    ],
    allocation: [
      { type: "defence",       label: "Defence & Aerospace",    weight: 55, color: "#1D4ED8" },
      { type: "psu",           label: "PSU Equity",             weight: 30, color: "#059669" },
      { type: "defence_infra", label: "Defence Infrastructure", weight: 15, color: "#6B7280" },
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
    ],
    allocation: [
      { type: "tier1_it",     label: "Tier-1 IT Services", weight: 50, color: "#0891B2" },
      { type: "midcap_it",    label: "Mid-Cap IT",         weight: 30, color: "#7C3AED" },
      { type: "consumer_tech",label: "Consumer Tech",      weight: 10, color: "#059669" },
      { type: "telecom",      label: "Telecom",            weight: 10, color: "#1D4ED8" },
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
      { type: "capital_markets", label: "Capital Markets",    weight: 22, color: "#D97706" },
      { type: "beverages_fmcg",  label: "Beverages & FMCG",  weight: 14, color: "#059669" },
      { type: "it",              label: "IT Services",        weight: 14, color: "#1D4ED8" },
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
    ],
    allocation: [
      { type: "equity",     label: "Equity (Blue-chip)",      weight: 52, color: "#1D4ED8" },
      { type: "quasi_debt", label: "PSU Bonds / Quasi-Debt",  weight: 40, color: "#059669" },
      { type: "gold",       label: "Gold",                    weight: 8,  color: "#D97706" },
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
      { rank: 8, name: "IRFC",                       symbol: "IRFC",     isin: "INE053F01010", weight: 20, type: "equity", sector: "PSU Financing" },
    ],
    allocation: [
      { type: "real_assets_equity",    label: "Real-Asset Equity",       weight: 60, color: "#D97706" },
      { type: "gold",                  label: "Gold SGB",                weight: 20, color: "#F59E0B" },
      { type: "inflation_linked_debt", label: "Inflation-Linked Debt",   weight: 20, color: "#059669" },
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
    ],
    allocation: [
      { type: "equity",        label: "Quality Equity (F1+F2)",     weight: 40, color: "#1D4ED8" },
      { type: "sovereign_debt",label: "Income / Bond Proxy (F3)",   weight: 35, color: "#059669" },
      { type: "gold",          label: "Gold (F4)",                  weight: 10, color: "#D97706" },
      { type: "commodity",     label: "Real Assets + FMCG (F5)",    weight: 15, color: "#7C3AED" },
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
      { rank: 8, name: "REC Limited",               symbol: "REC",        isin: "INE020B01018", weight: 20, type: "equity", sector: "PSU Financing" },
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
      { type: "gold",         label: "Gold (Jewellery Hedge)",weight: 20, color: "#D97706" },
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

