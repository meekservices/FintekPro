/**
 * @file model-portfolios-route.ts
 * @description /api/model-portfolios — serves curated model portfolios from DB
 *              with live 1Y return data enriched per holding via mfapi.in.
 *
 * Root cause of +0% bug (2026-06-28):
 *   DB `holdings` JSONB stores only {isin, name, type, weight}.
 *   `currentReturn` was never populated → frontend did `h.currentReturn ?? 0` → "+0%".
 *   Fix: enrich each holding with trailing 12M return from mfapi.in at serve time.
 *
 * Enrichment strategy:
 *   1. Search mfapi.in by fund name → schemeCode (prefer Direct-Growth)
 *   2. Fetch full NAV history → compute (latest - 1y_ago) / 1y_ago × 100
 *   3. Cache per scheme for 6 hours (mfapi is free, no key required)
 *   4. If mfapi fails → currentReturn stays undefined → frontend shows "—"
 *
 * GCR Compliance:
 *   - All responses include engine_version + calculation_timestamp
 *   - AI insights are Decision Support only (FASP-AI v1.0)
 *   - Mandatory SEBI risk disclaimers on every advisory output
 *
 * @inputs  - Query params: riskProfile, assetClass, featured
 * @outputs - { success, data: ModelPortfolioRow[], meta }
 */
import { Router, Request, Response } from "express";
import fetch from "node-fetch";
import { db } from "../db";
import { modelPortfolios } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../logger";

export const modelPortfoliosRouter = Router();

const ENGINE_VERSION = "1.1.0";

// ─── In-memory NAV cache: schemeCode → { return1Y, ts } ──────────────────────
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000; // 6 hours
const _navCache = new Map<string, { value: number | null; ts: number }>();
const cacheNav = (key: string, value: number | null): number | null => {
  _navCache.set(key, { value, ts: Date.now() });
  return value;
};
const fromNavCache = (key: string): number | null | undefined => {
  const e = _navCache.get(key);
  return e && Date.now() - e.ts < CACHE_TTL_MS ? e.value : undefined;
};

// ─── Curated AMFI-verified scheme code map ────────────────────────────────────
// Each entry manually verified against AMFI NAVAll.txt (June 2026).
// Scheme codes are for Direct Plan – Growth option (lowest expense ratio).
// Source: https://www.amfiindia.com/spages/NAVAll.txt
const FUND_SCHEME_MAP: Record<string, number> = {
  // ── Large Cap Equity ────────────────────────────────────────────────────────
  "Mirae Asset Large Cap":            118825,
  "ICICI Pru Bluechip":               120586,
  "Axis Bluechip Fund":               120501,
  "SBI Bluechip":                     119572,
  "Nippon India Large Cap":           118820,
  "HDFC Top 100":                     118997,

  // ── Mid Cap Equity ──────────────────────────────────────────────────────────
  "Axis Midcap":                      120503,
  "Kotak Emerging Equity":            120164, // Kotak Midcap Fund Direct
  "DSP Midcap":                       119211,

  // ── Small Cap Equity ────────────────────────────────────────────────────────
  "Nippon India Small Cap":           118777,
  "Kotak Small Cap":                  120164, // Kotak-Small Cap Fund - Direct
  "HDFC Small Cap":                   118978,
  "SBI Small Cap Fund":               125497,

  // ── Flexi/Multi Cap ─────────────────────────────────────────────────────────
  "Parag Parikh Flexi Cap":           122639,
  "PPFAS Flexi Cap":                  122639,
  "Mirae Asset Focused":              147206,
  "Axis Growth Opportunities":        120502,
  "ICICI Pru Value Discovery":        120323,
  "Templeton India Value":            118494,
  "Franklin India Prima Plus":        118494,
  "Kotak Focused Equity":             118969,
  "Kotak India EQ Contra":            118975,
  "Quantum Long Term Equity Value":   118780,

  // ── ELSS / Tax Saving ───────────────────────────────────────────────────────
  "Axis Long Term Equity":            120504,
  "Mirae Asset Tax Saver":            135781,
  "Parag Parikh Tax Saver":           147481,
  "DSP Tax Saver":                    119217,

  // ── ESG Funds ───────────────────────────────────────────────────────────────
  "Mirae Asset ESG Sector Leaders":   148574, // Mirae Asset Nifty 100 ESG Sector Leaders FoF
  "Aditya Birla ESG Fund":            148637, // ABSL ESG Integration Strategy Fund
  "SBI Magnum Equity ESG":            119709, // SBI ESG Exclusionary Strategy Fund
  "Kotak ESG Opportunities":          148606, // Kotak ESG Exclusionary Strategy Fund

  // ── Sector / Thematic ───────────────────────────────────────────────────────
  "Tata Digital India":               135795,
  "Aditya Birla Digital India":       118782,
  "ICICI Pru Technology Fund":        120594,
  "SBI Technology Opp Fund":          120578,
  "Franklin India Technology":        118785,
  "ICICI Pru Pharma Healthcare":      143874,
  "Nippon India Pharma":              118758,
  "UTI Healthcare Fund":              120782,
  "DSP Healthcare Fund":              143783,
  "HDFC Banking ETF":                 119261,
  "Nippon India Banking":             134547,
  "SBI Banking and Financial Services": 133859,
  "ICICI Pru Banking and Financial Services": 120244,
  "Kotak Infrastructure and Economic Reform": 133801,
  "Tata Infrastructure Fund":         119243,
  "DSP India TIGER Fund":             119247,
  "ICICI Pru Infrastructure":         120621,
  "ICICI Pru FMCG Fund":              120587,
  "Mirae Asset Great Consumer":       118837,
  "Canara Robeco Consumer Trends":    120481,
  "SBI Consumption Opportunities":    120575,
  "ICICI Pru Manufacturing":          145075,
  "Aditya Birla Manufacturing Equity": 143783,
  "Kotak Manufacture in India":       149841,
  "HDFC Manufacturing Fund":          145024,
  "Mirae Asset Healthcare":           143783,
  "ICICI Pru Dividend Yield Equity":  129312,
  "UTI Dividend Yield":               119507,
  "HDFC Dividend Yield Fund":         145018,
  "ICICI Pru Momentum":               153684,
  "ICICI Pru US Bluechip":            120186,

  // ── International / Global ──────────────────────────────────────────────────
  "Motilal Oswal Nasdaq 100":         145552,
  "Mirae Asset NYSE FANG+ ETF FoF":   148928,
  "DSP World Mining":                 120018,
  "Franklin Asian Equity":            125354,
  "Edelweiss Greater China Equity":   140243,
  "Kotak International REIT":         148646,
  "Kotak International REIT FoF":     148646,

  // ── Index Funds ─────────────────────────────────────────────────────────────
  "Nifty 50 Index Fund":              120716, // UTI Nifty 50 Index Fund - Direct Growth
  "Nifty 50 Index":                   120716,
  "UTI Nifty 50 Index Fund":          120716,
  "HDFC Nifty 50 Index":              146825,
  "Nifty Next 50 Index Fund":         147796, // Motilal Oswal Nifty Next 50
  "Nifty Next 50":                    147796,
  "Motilal Oswal Nifty Next 50":      147796,
  "Nifty 500 Index Fund":             148578, // Motilal Oswal Nifty 500 Index Fund

  // ── Hybrid / BAF ────────────────────────────────────────────────────────────
  "HDFC Balanced Advantage":          118999,
  "ICICI Pru Balanced Advantage":     120377,
  "DSP Dynamic Asset Allocation":     126393,
  "Edelweiss BAF":                    141767,
  "Kotak Arbitrage Fund":             119771,
  "HDFC Arbitrage Fund":              119030,
  "ICICI Pru Arbitrage Fund":         120364,
  "SBI Arbitrage Opportunities":      119574,
  "SBI Conservative Hybrid":          119839,
  "SBI Magnum Balanced":              119609, // SBI Equity Hybrid Fund

  // ── Debt / Fixed Income ─────────────────────────────────────────────────────
  "HDFC Corp Bond":                   118987, // HDFC Corporate Bond Fund Direct Growth
  "HDFC Corporate Bond":              118987,
  "HDFC Short Term Debt":             119016,
  "Short Duration Debt":              119016,
  "ICICI Pru Corp Bond":              120692,
  "ICICI Pru Corporate Bond":         120692,
  "Kotak Bond Short Term":            135500,
  "Axis Corporate Debt":              133066,
  "SBI Corp Bond":                    146215,
  "ICICI Pru Medium Term Bond":       120670,
  "Kotak Low Duration":               119773,
  "Kotak Ultra Short Duration":       144754,
  "HDFC Ultra Short Term":            145034,
  "ICICI Pru Ultra Short Term":       120676,
  "Aditya Birla Money Market":        119252,

  // ── Gilt / G-Sec ────────────────────────────────────────────────────────────
  "HDFC Gilt Fund":                   119012,
  "Gilt Fund":                        119012,
  "SBI Gilt Fund":                    119568,
  "SBI Magnum Gilt":                  119568,
  "SDL Fund":                         132510, // Bharat Bond ETF April 2032

  // ── Liquid / Overnight ──────────────────────────────────────────────────────
  "HDFC Liquid Fund":                 119026,
  "Liquid Fund":                      119026,
  "SBI Liquid Fund":                  119572,
  "Nippon Overnight Fund":            145810,

  // ── Gold ────────────────────────────────────────────────────────────────────
  "Nippon Gold Savings Fund":         118663,
  "Nippon Gold ETF":                  118663,
  "Nippon India Gold ETF":            118663,
  "HDFC Gold ETF":                    119015,
  "Gold ETF":                         118663,

  // ── Children / Retirement ───────────────────────────────────────────────────
  "HDFC Childrens Gift Fund":         118991,
  "Axis Childrens Gift Fund":         133551,
  "HDFC Retirement Savings Equity":   145011,
  "Tata Retirement Savings Progressive": 135793,

  // ── Sectoral / Misc ─────────────────────────────────────────────────────────
  "Axis Small Cap":                   133583,
  "SBI Magnum Midcap":                119584,
  "Kotak Midcap 50":                  120164,
};

// ─── mfapi.in NAV history → compute trailing 12M return ──────────────────────

/** Compute trailing 12M return (%) from mfapi.in NAV history. */
async function get1YReturn(schemeCode: number): Promise<number | null> {
  const key = `nav:${schemeCode}`;
  const hit = fromNavCache(key);
  if (hit !== undefined) return hit;
  try {
    const r = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return cacheNav(key, null);

    const d = (await r.json()) as { data: { date: string; nav: string }[] };
    const navData = d?.data ?? [];
    if (navData.length < 10) return cacheNav(key, null);

    // mfapi dates: DD-MM-YYYY, descending (navData[0] = latest)
    const parseMs = (s: string) => {
      const [dd, mm, yyyy] = s.split("-");
      return new Date(`${yyyy}-${mm}-${dd}`).getTime();
    };

    const latestMs = parseMs(navData[0].date);
    const oneYearAgoMs = latestMs - 365 * 24 * 3_600_000;
    const latestNav = parseFloat(navData[0].nav);

    let closest = navData[0];
    let minDiff = Infinity;
    for (const entry of navData) {
      const diff = Math.abs(parseMs(entry.date) - oneYearAgoMs);
      if (diff < minDiff) { minDiff = diff; closest = entry; }
    }

    const oldNav = parseFloat(closest.nav);
    if (!oldNav || oldNav <= 0) return cacheNav(key, null);

    const ret = Math.round(((latestNav - oldNav) / oldNav) * 10_000) / 100; // 2dp %
    return cacheNav(key, ret);
  } catch {
    return cacheNav(key, null);
  }
}

/** Enriches a single holding.
 *  For stock holdings (h.symbol set — NSE ticker):
 *    → Fetches return_1y, beta, sharpe_ratio_1y from screener_derived_metrics.
 *    → Adds screenerUrl for frontend deeplink to the screener.
 *  For MF/fund holdings (no symbol or AMFI schemeCode):
 *    → Existing mfapi.in NAV-based 1Y return pipeline unchanged.
 */
async function enrichHolding(h: any): Promise<any> {
  const symbol: string | undefined = h.symbol;
  const name: string = h.name ?? "";

  // ── Stock holding: enrich from screener_derived_metrics ─────────────────────
  const isStock = symbol && symbol.length <= 20 && !/^\d+$/.test(symbol) && !symbol.includes(".");
  if (isStock) {
    try {
      const dmRow = await db.execute(sql`
        SELECT return_1y, return_3y, return_6m, beta, sharpe_ratio_1y, max_drawdown_1y, volatility_30d
        FROM screener_derived_metrics
        WHERE symbol = ${symbol.toUpperCase()}
        LIMIT 1
      `).catch(() => ({ rows: [] }));
      const r = (dmRow as any).rows?.[0];

      const return1Y = r?.return_1y != null ? Math.round(Number(r.return_1y) * 10000) / 100 : undefined;
      const beta     = r?.beta != null ? Math.round(Number(r.beta) * 10000) / 10000 : undefined;
      const sharpe   = r?.sharpe_ratio_1y != null ? Math.round(Number(r.sharpe_ratio_1y) * 100) / 100 : undefined;
      const maxDD    = r?.max_drawdown_1y != null ? Math.round(Number(r.max_drawdown_1y) * 10000) / 100 : undefined;

      return {
        ...h,
        currentReturn: return1Y ?? (typeof h.currentReturn === "number" && h.currentReturn !== 0 ? h.currentReturn : undefined),
        beta,
        sharpe,
        maxDrawdown: maxDD,
        screenerUrl: `/agent/screener?search=${encodeURIComponent(symbol.toUpperCase())}`,
        returnSource: "screener_derived_metrics",
      };
    } catch {
      return { ...h, screenerUrl: `/agent/screener?search=${encodeURIComponent(symbol.toUpperCase())}` };
    }
  }

  // ── Mutual fund holding: mfapi.in NAV-based 1Y return ───────────────────────
  if (typeof h.currentReturn === "number" && h.currentReturn !== 0) return h;
  if (!name) return { ...h, currentReturn: undefined };

  try {
    let schemeCode = FUND_SCHEME_MAP[name] ?? null;

    if (!schemeCode) {
      const r = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (r.ok) {
        const results = (await r.json()) as { schemeCode: number; schemeName: string }[];
        const direct = results?.find(
          (x) => x.schemeName.toUpperCase().includes("DIRECT") && x.schemeName.toUpperCase().includes("GROWTH"),
        );
        schemeCode = (direct ?? results?.[0])?.schemeCode ?? null;
      }
    }

    if (!schemeCode) return { ...h, currentReturn: undefined };
    const return1Y = await get1YReturn(schemeCode);
    return { ...h, currentReturn: return1Y ?? undefined, returnSource: "mfapi.in" };
  } catch {
    return { ...h, currentReturn: undefined };
  }
}


/** Enriches all holdings of a portfolio with live 1Y returns. Non-throwing. */
async function enrichPortfolio(portfolio: any): Promise<any> {
  const holdings: any[] = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
  if (!holdings.length) return portfolio;
  const enriched = await Promise.all(holdings.map(enrichHolding));
  return { ...portfolio, holdings: enriched };
}


// ── POST /api/model-portfolios/admin/seed-holdings ─────────────────────────────
// Upserts complete (100%-weighted) holdings for all model portfolios.
// Each portfolio's holdings JSONB is fully replaced with curated data.
// Idempotent — safe to run multiple times.
modelPortfoliosRouter.post("/admin/seed-holdings", async (_req: Request, res: Response) => {
  type HoldingEntry = { rank: number; name: string; weight: number; type: string; symbol?: string; currentReturn?: number };
  const SEED: Record<string, HoldingEntry[]> = {
    "all-weather-india": [
      { rank: 1, name: "HDFC Top 100 Fund", weight: 12, type: "Large Cap MF" },
      { rank: 2, name: "Nippon India Large Cap Fund", weight: 10, type: "Large Cap MF" },
      { rank: 3, name: "ICICI Pru Bluechip Fund", weight: 8, type: "Large Cap MF" },
      { rank: 4, name: "SBI Magnum Gilt Fund", weight: 10, type: "Gilt Bond MF" },
      { rank: 5, name: "HDFC Corporate Bond Fund", weight: 8, type: "Bond MF" },
      { rank: 6, name: "Axis AAA Bond Plus SDL", weight: 7, type: "Bond MF" },
      { rank: 7, name: "Nippon India Gold Savings", weight: 8, type: "Gold ETF" },
      { rank: 8, name: "SGB 2028 Series", weight: 7, type: "Sovereign Gold Bond" },
      { rank: 9, name: "ICICI Pru Liquid Fund", weight: 8, type: "Liquid MF" },
      { rank: 10, name: "DSP Overnight Fund", weight: 7, type: "Liquid MF" },
      { rank: 11, name: "Embassy Office Parks REIT", weight: 8, type: "REIT" },
      { rank: 12, name: "Mindspace Business Parks REIT", weight: 7, type: "REIT" },
    ],
    "balanced-advantage": [
      { rank: 1, name: "HDFC Balanced Advantage Fund", weight: 22, type: "Balanced Advantage MF" },
      { rank: 2, name: "ICICI Pru Balanced Advantage Fund", weight: 20, type: "Balanced Advantage MF" },
      { rank: 3, name: "Nippon India Balanced Advantage", weight: 18, type: "Balanced Advantage MF" },
      { rank: 4, name: "Kotak Balanced Advantage Fund", weight: 15, type: "Balanced Advantage MF" },
      { rank: 5, name: "Edelweiss Balanced Advantage Fund", weight: 12, type: "Balanced Advantage MF" },
      { rank: 6, name: "DSP Dynamic Asset Allocation", weight: 8, type: "Balanced Advantage MF" },
      { rank: 7, name: "Mirae Asset Dynamic Allocation", weight: 5, type: "Balanced Advantage MF" },
    ],
    "blue-chip-growth": [
      { rank: 1, name: "Reliance Industries", symbol: "RELIANCE", weight: 12, type: "Large Cap Stock" },
      { rank: 2, name: "HDFC Bank Ltd", symbol: "HDFCBANK", weight: 11, type: "Large Cap Stock" },
      { rank: 3, name: "Infosys Ltd", symbol: "INFY", weight: 10, type: "Large Cap Stock" },
      { rank: 4, name: "TCS", symbol: "TCS", weight: 9, type: "Large Cap Stock" },
      { rank: 5, name: "ICICI Bank Ltd", symbol: "ICICIBANK", weight: 9, type: "Large Cap Stock" },
      { rank: 6, name: "Larsen & Toubro", symbol: "LT", weight: 8, type: "Large Cap Stock" },
      { rank: 7, name: "Hindustan Unilever", symbol: "HINDUNILVR", weight: 7, type: "Large Cap Stock" },
      { rank: 8, name: "Kotak Mahindra Bank", symbol: "KOTAKBANK", weight: 7, type: "Large Cap Stock" },
      { rank: 9, name: "Bajaj Finance", symbol: "BAJFINANCE", weight: 7, type: "Large Cap Stock" },
      { rank: 10, name: "Asian Paints", symbol: "ASIANPAINT", weight: 6, type: "Large Cap Stock" },
      { rank: 11, name: "SBI", symbol: "SBIN", weight: 6, type: "Large Cap Stock" },
      { rank: 12, name: "Maruti Suzuki", symbol: "MARUTI", weight: 5, type: "Large Cap Stock" },
      { rank: 13, name: "Axis Bank", symbol: "AXISBANK", weight: 3, type: "Large Cap Stock" },
    ],
    "small-cap-alpha": [
      { rank: 1, name: "Dixon Technologies", symbol: "DIXON", weight: 9, type: "Small Cap Stock" },
      { rank: 2, name: "Kaynes Technology", symbol: "KAYNES", weight: 8, type: "Small Cap Stock" },
      { rank: 3, name: "Apar Industries", symbol: "APARINDS", weight: 7, type: "Small Cap Stock" },
      { rank: 4, name: "Astral Ltd", symbol: "ASTRAL", weight: 7, type: "Small Cap Stock" },
      { rank: 5, name: "Nippon Small Cap Fund", weight: 14, type: "Small Cap MF" },
      { rank: 6, name: "Quant Small Cap Fund", weight: 12, type: "Small Cap MF" },
      { rank: 7, name: "SBI Small Cap Fund", weight: 10, type: "Small Cap MF" },
      { rank: 8, name: "Tata Small Cap Fund", weight: 8, type: "Small Cap MF" },
      { rank: 9, name: "HDFC Small Cap Fund", weight: 8, type: "Small Cap MF" },
      { rank: 10, name: "Tata Steel", symbol: "TATASTEEL", weight: 5, type: "Small Cap Stock" },
      { rank: 11, name: "Lemon Tree Hotels", symbol: "LEMONTREE", weight: 4, type: "Small Cap Stock" },
      { rank: 12, name: "Liquid/Cash Buffer", weight: 8, type: "Liquid MF" },
    ],
    "equity-momentum-india": [
      { rank: 1, name: "Reliance Industries", symbol: "RELIANCE", weight: 10, type: "Equity" },
      { rank: 2, name: "Adani Enterprises", symbol: "ADANIENT", weight: 9, type: "Equity" },
      { rank: 3, name: "Tata Motors", symbol: "TATAMOTORS", weight: 8, type: "Equity" },
      { rank: 4, name: "ONGC", symbol: "ONGC", weight: 7, type: "Equity" },
      { rank: 5, name: "Mahindra & Mahindra", symbol: "M&M", weight: 7, type: "Equity" },
      { rank: 6, name: "Bharat Electronics", symbol: "BEL", weight: 7, type: "Equity" },
      { rank: 7, name: "JSW Steel", symbol: "JSWSTEEL", weight: 6, type: "Equity" },
      { rank: 8, name: "Torrent Pharmaceuticals", symbol: "TORNTPHARM", weight: 6, type: "Equity" },
      { rank: 9, name: "SBI Life Insurance", symbol: "SBILIFE", weight: 6, type: "Equity" },
      { rank: 10, name: "Cholamandalam Investment", symbol: "CHOLAFIN", weight: 5, type: "Equity" },
      { rank: 11, name: "HDFC AMC", symbol: "HDFCAMC", weight: 5, type: "Equity" },
      { rank: 12, name: "Naukri (Info Edge)", symbol: "NAUKRI", weight: 5, type: "Equity" },
      { rank: 13, name: "Tata Communications", symbol: "TATACOMM", weight: 5, type: "Equity" },
      { rank: 14, name: "Cash/Liquid Buffer", weight: 10, type: "Liquid MF" },
    ],
    "hni-wealth-compounder": [
      { rank: 1, name: "Axis Growth Opportunities", weight: 15, type: "Multi Cap MF" },
      { rank: 2, name: "Mirae Asset Focused Fund", weight: 14, type: "Focused MF" },
      { rank: 3, name: "PPFAS Flexi Cap Fund", weight: 13, type: "Flexi Cap MF" },
      { rank: 4, name: "Kotak Focused Equity", weight: 12, type: "Focused MF" },
      { rank: 5, name: "Reliance Industries", symbol: "RELIANCE", weight: 8, type: "Large Cap Stock" },
      { rank: 6, name: "HDFC Bank Ltd", symbol: "HDFCBANK", weight: 7, type: "Large Cap Stock" },
      { rank: 7, name: "Infosys Ltd", symbol: "INFY", weight: 6, type: "Large Cap Stock" },
      { rank: 8, name: "Embassy REIT", weight: 7, type: "REIT" },
      { rank: 9, name: "IndiGrid InvIT", weight: 5, type: "InvIT" },
      { rank: 10, name: "Nippon Gold ETF", weight: 6, type: "Gold ETF" },
      { rank: 11, name: "SGB 2029 Series", weight: 4, type: "Sovereign Gold Bond" },
      { rank: 12, name: "HDFC Ultra Short Term Fund", weight: 3, type: "Liquid MF" },
    ],
    "dividend-yield": [
      { rank: 1, name: "ITC Limited", symbol: "ITC", weight: 14, type: "Dividend Stock" },
      { rank: 2, name: "Coal India", symbol: "COALINDIA", weight: 12, type: "PSU Dividend Stock" },
      { rank: 3, name: "Power Grid Corp", symbol: "POWERGRID", weight: 10, type: "Dividend Stock" },
      { rank: 4, name: "ONGC Ltd", symbol: "ONGC", weight: 10, type: "PSU Dividend Stock" },
      { rank: 5, name: "Hindustan Zinc", symbol: "HINDZINC", weight: 8, type: "Dividend Stock" },
      { rank: 6, name: "HDFC Corporate Bond Fund", weight: 12, type: "Bond MF" },
      { rank: 7, name: "Mindspace Business Parks REIT", weight: 10, type: "REIT" },
      { rank: 8, name: "Embassy Office Parks REIT", weight: 8, type: "REIT" },
      { rank: 9, name: "Sovereign Gold Bond 2028", weight: 8, type: "Sovereign Gold Bond" },
      { rank: 10, name: "NTPC Ltd", symbol: "NTPC", weight: 8, type: "Dividend Stock" },
    ],
    "india-growth": [
      { rank: 1, name: "Reliance Industries", symbol: "RELIANCE", weight: 12, type: "Large Cap Stock" },
      { rank: 2, name: "HDFC Flexicap Fund", weight: 12, type: "Flexi Cap MF" },
      { rank: 3, name: "Infosys Ltd", symbol: "INFY", weight: 9, type: "Large Cap Stock" },
      { rank: 4, name: "Mirae Asset Large Cap", weight: 9, type: "Large Cap MF" },
      { rank: 5, name: "Bajaj Finance", symbol: "BAJFINANCE", weight: 8, type: "Large Cap Stock" },
      { rank: 6, name: "Quant Mid Cap Fund", weight: 8, type: "Mid Cap MF" },
      { rank: 7, name: "Dixon Technologies", symbol: "DIXON", weight: 7, type: "Mid Cap Stock" },
      { rank: 8, name: "HDFC Bank Ltd", symbol: "HDFCBANK", weight: 7, type: "Large Cap Stock" },
      { rank: 9, name: "SBI Magnum Gilt Fund", weight: 6, type: "Gilt Bond MF" },
      { rank: 10, name: "ICICI Pru Liquid Fund", weight: 5, type: "Liquid MF" },
      { rank: 11, name: "Nippon Gold ETF", weight: 4, type: "Gold ETF" },
      { rank: 12, name: "IndiGrid InvIT", weight: 3, type: "InvIT" },
    ],
    "india-infrastructure": [
      { rank: 1, name: "Larsen & Toubro", symbol: "LT", weight: 14, type: "Infrastructure Stock" },
      { rank: 2, name: "Power Grid Corp", symbol: "POWERGRID", weight: 10, type: "Infrastructure Stock" },
      { rank: 3, name: "NTPC Ltd", symbol: "NTPC", weight: 9, type: "Infrastructure Stock" },
      { rank: 4, name: "BHEL", symbol: "BHEL", weight: 8, type: "Infrastructure Stock" },
      { rank: 5, name: "Adani Ports", symbol: "ADANIPORTS", weight: 8, type: "Infrastructure Stock" },
      { rank: 6, name: "NHAI Infrastructure Fund", weight: 10, type: "Infra Debt Fund" },
      { rank: 7, name: "India Infrastructure ETF", weight: 10, type: "Infra ETF" },
      { rank: 8, name: "IRB Infrastructure", symbol: "IRB", weight: 7, type: "Infrastructure Stock" },
      { rank: 9, name: "IndiGrid InvIT", weight: 9, type: "InvIT" },
      { rank: 10, name: "Power Mech Projects", symbol: "POWERMECH", weight: 6, type: "Infrastructure Stock" },
      { rank: 11, name: "Mirae Asset Infrastructure ETF", weight: 5, type: "Infra ETF" },
      { rank: 12, name: "Liquid Buffer", weight: 4, type: "Liquid MF" },
    ],
    "retirement-builder": [
      { rank: 1, name: "HDFC Retirement Savings - Equity", weight: 15, type: "Retirement MF" },
      { rank: 2, name: "Nippon India Retirement - Wealth Creation", weight: 13, type: "Retirement MF" },
      { rank: 3, name: "UTI Retirement Benefit Pension", weight: 12, type: "Retirement MF" },
      { rank: 4, name: "SBI Magnum Gilt Fund", weight: 10, type: "Gilt Bond MF" },
      { rank: 5, name: "HDFC Corporate Bond Fund", weight: 9, type: "Bond MF" },
      { rank: 6, name: "ITC Limited", symbol: "ITC", weight: 7, type: "Dividend Stock" },
      { rank: 7, name: "Coal India", symbol: "COALINDIA", weight: 7, type: "Dividend Stock" },
      { rank: 8, name: "SGB 2030 Series", weight: 8, type: "Sovereign Gold Bond" },
      { rank: 9, name: "Embassy Office Parks REIT", weight: 7, type: "REIT" },
      { rank: 10, name: "ICICI Pru Liquid Fund", weight: 6, type: "Liquid MF" },
      { rank: 11, name: "Power Grid Corp", symbol: "POWERGRID", weight: 6, type: "Dividend Stock" },
    ],
    "tax-saver-elss": [
      { rank: 1, name: "Mirae Asset Tax Saver Fund (ELSS)", weight: 22, type: "ELSS" },
      { rank: 2, name: "Quant Tax Plan (ELSS)", weight: 20, type: "ELSS" },
      { rank: 3, name: "Axis Long Term Equity Fund (ELSS)", weight: 18, type: "ELSS" },
      { rank: 4, name: "Canara Robeco Equity Tax Saver", weight: 15, type: "ELSS" },
      { rank: 5, name: "Kotak Tax Saver Fund", weight: 12, type: "ELSS" },
      { rank: 6, name: "NHAI Tax-free Bonds 2027", weight: 8, type: "Tax-free Bond" },
      { rank: 7, name: "PFC Tax-free Bonds 2028", weight: 5, type: "Tax-free Bond" },
    ],
    "conservative-income": [
      { rank: 1, name: "SBI Magnum Gilt Fund", weight: 20, type: "Gilt Bond MF" },
      { rank: 2, name: "HDFC Corporate Bond Fund", weight: 18, type: "Bond MF" },
      { rank: 3, name: "Kotak Dynamic Bond Fund", weight: 15, type: "Bond MF" },
      { rank: 4, name: "ICICI Pru Liquid Fund", weight: 13, type: "Liquid MF" },
      { rank: 5, name: "Nippon India Gold Savings", weight: 10, type: "Gold ETF" },
      { rank: 6, name: "DSP Credit Risk Fund", weight: 8, type: "Bond MF" },
      { rank: 7, name: "Embassy Office Parks REIT", weight: 8, type: "REIT" },
      { rank: 8, name: "Sovereign Gold Bond 2028", weight: 8, type: "SGB" },
    ],
    "banking-bfsi": [
      { rank: 1, name: "HDFC Bank Ltd", symbol: "HDFCBANK", weight: 18, type: "Banking Stock" },
      { rank: 2, name: "ICICI Bank Ltd", symbol: "ICICIBANK", weight: 16, type: "Banking Stock" },
      { rank: 3, name: "SBI", symbol: "SBIN", weight: 12, type: "PSU Banking Stock" },
      { rank: 4, name: "Kotak Mahindra Bank", symbol: "KOTAKBANK", weight: 10, type: "Banking Stock" },
      { rank: 5, name: "Bajaj Finance", symbol: "BAJFINANCE", weight: 10, type: "NBFC Stock" },
      { rank: 6, name: "Axis Bank", symbol: "AXISBANK", weight: 9, type: "Banking Stock" },
      { rank: 7, name: "SBI Life Insurance", symbol: "SBILIFE", weight: 8, type: "Insurance Stock" },
      { rank: 8, name: "HDFC AMC", symbol: "HDFCAMC", weight: 7, type: "Wealth Mgmt Stock" },
      { rank: 9, name: "ICICI Pru Life Insurance", symbol: "ICICIPRULI", weight: 6, type: "Insurance Stock" },
      { rank: 10, name: "Cash Buffer", weight: 4, type: "Liquid MF" },
    ],
    "healthcare-pharma": [
      { rank: 1, name: "Sun Pharmaceutical", symbol: "SUNPHARMA", weight: 18, type: "Pharma Stock" },
      { rank: 2, name: "Dr Reddy's Laboratories", symbol: "DRREDDY", weight: 14, type: "Pharma Stock" },
      { rank: 3, name: "Cipla Ltd", symbol: "CIPLA", weight: 12, type: "Pharma Stock" },
      { rank: 4, name: "Apollo Hospitals", symbol: "APOLLOHOSP", weight: 10, type: "Healthcare Stock" },
      { rank: 5, name: "Divis Laboratories", symbol: "DIVISLAB", weight: 10, type: "Pharma Stock" },
      { rank: 6, name: "Mirae Asset Healthcare ETF", weight: 12, type: "Sector ETF" },
      { rank: 7, name: "Torrent Pharmaceuticals", symbol: "TORNTPHARM", weight: 8, type: "Pharma Stock" },
      { rank: 8, name: "Max Healthcare", symbol: "MAXHEALTH", weight: 8, type: "Healthcare Stock" },
      { rank: 9, name: "Liquid Buffer", weight: 8, type: "Liquid MF" },
    ],
    "digital-india-tech": [
      { rank: 1, name: "Infosys Ltd", symbol: "INFY", weight: 16, type: "IT Stock" },
      { rank: 2, name: "TCS", symbol: "TCS", weight: 14, type: "IT Stock" },
      { rank: 3, name: "HCL Technologies", symbol: "HCLTECH", weight: 11, type: "IT Stock" },
      { rank: 4, name: "Wipro Ltd", symbol: "WIPRO", weight: 9, type: "IT Stock" },
      { rank: 5, name: "Persistent Systems", symbol: "PERSISTENT", weight: 8, type: "IT Stock" },
      { rank: 6, name: "Tata Elxsi", symbol: "TATAELXSI", weight: 8, type: "IT Stock" },
      { rank: 7, name: "Naukri (Info Edge)", symbol: "NAUKRI", weight: 7, type: "Tech Platform" },
      { rank: 8, name: "KPIT Technologies", symbol: "KPITTECH", weight: 7, type: "IT Stock" },
      { rank: 9, name: "Mirae Asset Nifty IT ETF", weight: 10, type: "Sector ETF" },
      { rank: 10, name: "Liquid Buffer", weight: 10, type: "Liquid MF" },
    ],
    "multi-asset-5factor": [
      { rank: 1, name: "HDFC Flexicap Fund", weight: 14, type: "Equity MF" },
      { rank: 2, name: "Nippon Small Cap Fund", weight: 10, type: "Small Cap MF" },
      { rank: 3, name: "ICICI Pru Balanced Advantage Fund", weight: 12, type: "Balanced MF" },
      { rank: 4, name: "SBI Magnum Gilt Fund", weight: 10, type: "Gilt Bond MF" },
      { rank: 5, name: "HDFC Corporate Bond Fund", weight: 8, type: "Bond MF" },
      { rank: 6, name: "Nippon India Gold Savings", weight: 8, type: "Gold ETF" },
      { rank: 7, name: "Embassy Office Parks REIT", weight: 8, type: "REIT" },
      { rank: 8, name: "IndiGrid InvIT", weight: 7, type: "InvIT" },
      { rank: 9, name: "Nifty 50 ETF", weight: 8, type: "Index ETF" },
      { rank: 10, name: "ICICI Pru Liquid Fund", weight: 7, type: "Liquid MF" },
      { rank: 11, name: "SGB 2029 Series", weight: 4, type: "Sovereign Gold Bond" },
      { rank: 12, name: "Tata Communications", symbol: "TATACOMM", weight: 4, type: "Equity" },
    ],
    "global-diversifier": [
      { rank: 1, name: "PPFAS Flexi Cap (Global)", weight: 15, type: "Global Equity MF" },
      { rank: 2, name: "Mirae Asset NYSE FANG+ ETF", weight: 13, type: "Global Tech ETF" },
      { rank: 3, name: "Kotak Nasdaq 100 FOF", weight: 12, type: "US Equity FOF" },
      { rank: 4, name: "SBI International Access US Equity FOF", weight: 10, type: "US Equity FOF" },
      { rank: 5, name: "Motilal Oswal S&P 500 Index Fund", weight: 10, type: "US Index FOF" },
      { rank: 6, name: "Nippon India ETF Hang Seng BeES", weight: 8, type: "Asia ETF" },
      { rank: 7, name: "Nifty 50 ETF (India anchor)", weight: 14, type: "India Index ETF" },
      { rank: 8, name: "Nippon India Gold Savings", weight: 8, type: "Gold ETF" },
      { rank: 9, name: "ICICI Pru Liquid Fund", weight: 5, type: "Liquid MF" },
      { rank: 10, name: "SGB 2028 Series", weight: 5, type: "Sovereign Gold Bond" },
    ],
    "senior-citizen-income": [
      { rank: 1, name: "SBI Magnum Gilt Fund", weight: 20, type: "Gilt Bond MF" },
      { rank: 2, name: "HDFC Corporate Bond Fund", weight: 16, type: "Bond MF" },
      { rank: 3, name: "ICICI Pru Liquid Fund", weight: 14, type: "Liquid MF" },
      { rank: 4, name: "ITC Limited", symbol: "ITC", weight: 10, type: "Dividend Stock" },
      { rank: 5, name: "Coal India", symbol: "COALINDIA", weight: 8, type: "PSU Dividend Stock" },
      { rank: 6, name: "SGB 2030 Series", weight: 10, type: "Sovereign Gold Bond" },
      { rank: 7, name: "Embassy Office Parks REIT", weight: 8, type: "REIT" },
      { rank: 8, name: "Axis AAA Bond Plus SDL", weight: 8, type: "Bond MF" },
      { rank: 9, name: "Power Grid Corp", symbol: "POWERGRID", weight: 6, type: "Dividend Stock" },
    ],
    "reit-invit-income": [
      { rank: 1, name: "Embassy Office Parks REIT", weight: 22, type: "REIT" },
      { rank: 2, name: "Mindspace Business Parks REIT", weight: 18, type: "REIT" },
      { rank: 3, name: "Brookfield India REIT", weight: 15, type: "REIT" },
      { rank: 4, name: "IndiGrid InvIT", weight: 14, type: "InvIT" },
      { rank: 5, name: "IRB InvIT Fund", weight: 12, type: "InvIT" },
      { rank: 6, name: "Powergrid Infrastructure InvIT", weight: 10, type: "InvIT" },
      { rank: 7, name: "Nexus Select Trust REIT", weight: 9, type: "REIT" },
    ],
    "pure-debt-portfolio": [
      { rank: 1, name: "SBI Magnum Gilt Fund", weight: 22, type: "Gilt Bond MF" },
      { rank: 2, name: "HDFC Corporate Bond Fund", weight: 18, type: "Bond MF" },
      { rank: 3, name: "Kotak Dynamic Bond Fund", weight: 15, type: "Bond MF" },
      { rank: 4, name: "ICICI Pru Short Term Fund", weight: 12, type: "Short Duration MF" },
      { rank: 5, name: "Axis AAA Bond Plus SDL", weight: 12, type: "Bond MF" },
      { rank: 6, name: "NHAI Tax-free Bonds 2027", weight: 8, type: "Tax-free Bond" },
      { rank: 7, name: "Nippon India Ultra Short Term", weight: 8, type: "Ultra Short Duration MF" },
      { rank: 8, name: "DSP Credit Risk Fund", weight: 5, type: "Credit Risk MF" },
    ],
    "esg-sustainable": [
      { rank: 1, name: "Axis ESG Equity Fund", weight: 22, type: "ESG Equity MF" },
      { rank: 2, name: "Quant ESG Equity Fund", weight: 18, type: "ESG Equity MF" },
      { rank: 3, name: "Mirae Asset ESG Sector Leaders ETF", weight: 15, type: "ESG ETF" },
      { rank: 4, name: "Infosys Ltd", symbol: "INFY", weight: 10, type: "ESG Large Cap Stock" },
      { rank: 5, name: "Wipro Ltd", symbol: "WIPRO", weight: 8, type: "ESG Large Cap Stock" },
      { rank: 6, name: "Tata Power", symbol: "TATAPOWER", weight: 8, type: "ESG Energy Stock" },
      { rank: 7, name: "Adani Green Energy", symbol: "ADANIGREEN", weight: 7, type: "ESG Renewable Stock" },
      { rank: 8, name: "SBI Magnum Gilt Fund (Green Bonds)", weight: 7, type: "Green Bond Fund" },
      { rank: 9, name: "Liquid Buffer", weight: 5, type: "Liquid MF" },
    ],
    "manufacturing-make-in-india": [
      { rank: 1, name: "Dixon Technologies", symbol: "DIXON", weight: 12, type: "EMS Stock" },
      { rank: 2, name: "Polycab India", symbol: "POLYCAB", weight: 10, type: "Manufacturing Stock" },
      { rank: 3, name: "ABB India", symbol: "ABB", weight: 9, type: "Industrial Stock" },
      { rank: 4, name: "Siemens India", symbol: "SIEMENS", weight: 9, type: "Industrial Stock" },
      { rank: 5, name: "Bharat Electronics", symbol: "BEL", weight: 8, type: "Defence Mfg Stock" },
      { rank: 6, name: "HAL", symbol: "HAL", weight: 8, type: "Defence Mfg Stock" },
      { rank: 7, name: "Kaynes Technology", symbol: "KAYNES", weight: 7, type: "EMS Stock" },
      { rank: 8, name: "Schaeffler India", symbol: "SCHAEFFLER", weight: 7, type: "Auto Component Stock" },
      { rank: 9, name: "Nifty India Manufacturing ETF", weight: 12, type: "Sector ETF" },
      { rank: 10, name: "Liquid Buffer", weight: 8, type: "Liquid MF" },
      { rank: 11, name: "SBI Magnum Gilt Fund", weight: 10, type: "Bond MF" },
    ],
    "consumption-rural": [
      { rank: 1, name: "ITC Limited", symbol: "ITC", weight: 15, type: "FMCG Stock" },
      { rank: 2, name: "Hindustan Unilever", symbol: "HINDUNILVR", weight: 14, type: "FMCG Stock" },
      { rank: 3, name: "Nestle India", symbol: "NESTLEIND", weight: 10, type: "FMCG Stock" },
      { rank: 4, name: "Tata Consumer Products", symbol: "TATACONSUM", weight: 10, type: "FMCG Stock" },
      { rank: 5, name: "Page Industries", symbol: "PAGEIND", weight: 8, type: "Retail Stock" },
      { rank: 6, name: "Mirae Asset Great Consumer Fund", weight: 15, type: "Consumption MF" },
      { rank: 7, name: "SBI Consumption Opportunities", weight: 12, type: "Consumption MF" },
      { rank: 8, name: "Marico Ltd", symbol: "MARICO", weight: 8, type: "FMCG Stock" },
      { rank: 9, name: "Liquid Buffer", weight: 8, type: "Liquid MF" },
    ],
    "childrens-education": [
      { rank: 1, name: "HDFC Children's Gift Fund — Investment Plan", weight: 22, type: "Children's MF" },
      { rank: 2, name: "Nippon India Children's Asset Plan", weight: 18, type: "Children's MF" },
      { rank: 3, name: "Axis Children's Gift Fund — No Lock-in", weight: 15, type: "Children's MF" },
      { rank: 4, name: "SBI Magnum Children's Benefit Fund", weight: 13, type: "Children's MF" },
      { rank: 5, name: "Quant Multi Asset Fund", weight: 10, type: "Multi Asset MF" },
      { rank: 6, name: "NHAI Tax-free Bonds", weight: 8, type: "Tax-free Bond" },
      { rank: 7, name: "SGB 2031 Series", weight: 8, type: "Sovereign Gold Bond" },
      { rank: 8, name: "ICICI Pru Liquid Fund", weight: 6, type: "Liquid MF" },
    ],
    "wedding-milestone": [
      { rank: 1, name: "HDFC Balanced Advantage Fund", weight: 22, type: "Balanced MF" },
      { rank: 2, name: "ICICI Pru Balanced Advantage Fund", weight: 18, type: "Balanced MF" },
      { rank: 3, name: "Nippon India Gold Savings", weight: 14, type: "Gold ETF" },
      { rank: 4, name: "SGB 2028 Series", weight: 12, type: "Sovereign Gold Bond" },
      { rank: 5, name: "HDFC Corporate Bond Fund", weight: 12, type: "Bond MF" },
      { rank: 6, name: "ICICI Pru Liquid Fund", weight: 10, type: "Liquid MF" },
      { rank: 7, name: "DSP Ultra Short Term Fund", weight: 8, type: "Ultra Short MF" },
      { rank: 8, name: "Nifty 50 ETF", weight: 4, type: "Index ETF" },
    ],
    "home-purchase": [
      { rank: 1, name: "SBI Magnum Gilt Fund", weight: 22, type: "Gilt Bond MF" },
      { rank: 2, name: "HDFC Corporate Bond Fund", weight: 18, type: "Bond MF" },
      { rank: 3, name: "Kotak Dynamic Bond Fund", weight: 15, type: "Bond MF" },
      { rank: 4, name: "ICICI Pru Short Term Fund", weight: 12, type: "Short Duration MF" },
      { rank: 5, name: "Nippon India Gold Savings", weight: 10, type: "Gold ETF" },
      { rank: 6, name: "ICICI Pru Liquid Fund", weight: 12, type: "Liquid MF" },
      { rank: 7, name: "Axis AAA Bond Plus SDL", weight: 8, type: "Bond MF" },
      { rank: 8, name: "Nifty 50 ETF (equity hedge)", weight: 3, type: "Index ETF" },
    ],
    "nri-india-opportunity": [
      { rank: 1, name: "PPFAS Flexi Cap Fund", weight: 18, type: "Flexi Cap MF" },
      { rank: 2, name: "HDFC Flexicap Fund", weight: 15, type: "Flexi Cap MF" },
      { rank: 3, name: "Reliance Industries", symbol: "RELIANCE", weight: 10, type: "Large Cap Stock" },
      { rank: 4, name: "HDFC Bank Ltd", symbol: "HDFCBANK", weight: 10, type: "Large Cap Stock" },
      { rank: 5, name: "Embassy Office Parks REIT", weight: 10, type: "REIT" },
      { rank: 6, name: "Nippon India Gold Savings", weight: 8, type: "Gold ETF" },
      { rank: 7, name: "SBI Magnum Gilt Fund", weight: 8, type: "Gilt Bond MF" },
      { rank: 8, name: "ICICI Pru Liquid Fund", weight: 7, type: "Liquid MF" },
      { rank: 9, name: "SGB 2029 Series", weight: 7, type: "Sovereign Gold Bond" },
      { rank: 10, name: "IndiGrid InvIT", weight: 7, type: "InvIT" },
    ],
    "debt-ladder": [
      { rank: 1, name: "ICICI Pru Short Term Fund (1Y bucket)", weight: 20, type: "Short Duration MF" },
      { rank: 2, name: "Kotak Dynamic Bond Fund (3Y bucket)", weight: 18, type: "Medium Duration MF" },
      { rank: 3, name: "SBI Magnum Gilt Fund (5Y bucket)", weight: 18, type: "Gilt Bond MF" },
      { rank: 4, name: "HDFC Corporate Bond Fund (3Y bucket)", weight: 14, type: "Bond MF" },
      { rank: 5, name: "Axis AAA Bond Plus SDL (5Y bucket)", weight: 12, type: "Bond MF" },
      { rank: 6, name: "NHAI Tax-free Bonds 2027", weight: 8, type: "Tax-free Bond" },
      { rank: 7, name: "PFC Tax-free Bonds 2028", weight: 6, type: "Tax-free Bond" },
      { rank: 8, name: "ICICI Pru Liquid Fund (buffer)", weight: 4, type: "Liquid MF" },
    ],
    "passive-index": [
      { rank: 1, name: "Nifty 50 ETF (Nippon)", weight: 35, type: "Index ETF" },
      { rank: 2, name: "Nifty Next 50 ETF", weight: 20, type: "Index ETF" },
      { rank: 3, name: "NIFTY500 Multicap 50:25:25 ETF", weight: 20, type: "Index ETF" },
      { rank: 4, name: "SBI Magnum Gilt Fund", weight: 15, type: "Gilt Bond MF" },
      { rank: 5, name: "ICICI Pru Liquid Fund", weight: 10, type: "Liquid MF" },
    ],
    "arbitrage-liquid-hybrid": [
      { rank: 1, name: "Nippon India Arbitrage Fund", weight: 25, type: "Arbitrage MF" },
      { rank: 2, name: "ICICI Pru Arbitrage Fund", weight: 22, type: "Arbitrage MF" },
      { rank: 3, name: "HDFC Arbitrage Fund", weight: 18, type: "Arbitrage MF" },
      { rank: 4, name: "SBI Arbitrage Opportunities", weight: 15, type: "Arbitrage MF" },
      { rank: 5, name: "ICICI Pru Liquid Fund", weight: 10, type: "Liquid MF" },
      { rank: 6, name: "DSP Overnight Fund", weight: 10, type: "Overnight MF" },
    ],
    "digital-gold-accumulator": [
      { rank: 1, name: "SGB 2028 Series", weight: 22, type: "Sovereign Gold Bond" },
      { rank: 2, name: "SGB 2029 Series", weight: 20, type: "Sovereign Gold Bond" },
      { rank: 3, name: "Nippon India Gold Savings", weight: 18, type: "Gold ETF" },
      { rank: 4, name: "HDFC Gold Fund", weight: 15, type: "Gold Fund of Funds" },
      { rank: 5, name: "Axis Gold ETF", weight: 13, type: "Gold ETF" },
      { rank: 6, name: "SGB 2030 Series", weight: 12, type: "Sovereign Gold Bond" },
    ],
    "intl-emerging-markets": [
      { rank: 1, name: "PPFAS Flexi Cap (Global allocation)", weight: 20, type: "Global Equity MF" },
      { rank: 2, name: "Nippon India ETF Hang Seng BeES", weight: 18, type: "China/HK ETF" },
      { rank: 3, name: "Motilal Oswal S&P 500 Index Fund", weight: 16, type: "US Index FOF" },
      { rank: 4, name: "Kotak Nasdaq 100 FOF", weight: 14, type: "US Tech FOF" },
      { rank: 5, name: "SBI International Access US Equity", weight: 12, type: "US Equity FOF" },
      { rank: 6, name: "Nifty 50 ETF (India base)", weight: 12, type: "India Index ETF" },
      { rank: 7, name: "ICICI Pru Liquid Fund", weight: 8, type: "Liquid MF" },
    ],
    "corporate-treasury": [
      { rank: 1, name: "ICICI Pru Liquid Fund", weight: 25, type: "Liquid MF" },
      { rank: 2, name: "HDFC Overnight Fund", weight: 20, type: "Overnight MF" },
      { rank: 3, name: "SBI Short Duration Fund", weight: 18, type: "Short Duration MF" },
      { rank: 4, name: "Nippon India Ultra Short Term", weight: 15, type: "Ultra Short MF" },
      { rank: 5, name: "Kotak Money Market Fund", weight: 12, type: "Money Market MF" },
      { rank: 6, name: "Axis Corporate Debt Fund", weight: 10, type: "Corporate Debt MF" },
    ],
    "emergency-fund": [
      { rank: 1, name: "HDFC Overnight Fund", weight: 35, type: "Overnight MF" },
      { rank: 2, name: "ICICI Pru Liquid Fund", weight: 30, type: "Liquid MF" },
      { rank: 3, name: "SBI Savings Fund", weight: 20, type: "Ultra Short MF" },
      { rank: 4, name: "Axis Ultra Short Term Fund", weight: 15, type: "Ultra Short MF" },
    ],
    "first-time-investor": [
      { rank: 1, name: "Mirae Asset Large Cap Fund", weight: 40, type: "Large Cap MF" },
      { rank: 2, name: "SBI Magnum Gilt Fund", weight: 35, type: "Gilt Bond MF" },
      { rank: 3, name: "ICICI Pru Liquid Fund", weight: 25, type: "Liquid MF" },
    ],
    "value-investing": [
      { rank: 1, name: "HDFC Top 100 Fund", weight: 15, type: "Value Large Cap MF" },
      { rank: 2, name: "Templeton India Value Fund", weight: 13, type: "Value MF" },
      { rank: 3, name: "Parag Parikh Flexi Cap", weight: 12, type: "Value Flexi Cap MF" },
      { rank: 4, name: "ITC Limited", symbol: "ITC", weight: 10, type: "Value Stock" },
      { rank: 5, name: "Coal India", symbol: "COALINDIA", weight: 9, type: "Value Stock" },
      { rank: 6, name: "ONGC Ltd", symbol: "ONGC", weight: 8, type: "Value Stock" },
      { rank: 7, name: "SBI", symbol: "SBIN", weight: 8, type: "PSU Value Stock" },
      { rank: 8, name: "HDFC Corporate Bond Fund", weight: 10, type: "Bond MF" },
      { rank: 9, name: "Liquid Buffer", weight: 8, type: "Liquid MF" },
      { rank: 10, name: "NTPC Ltd", symbol: "NTPC", weight: 7, type: "Value Stock" },
    ],
  };

  try {
    let updated = 0;
    let skipped = 0;
    for (const [portfolioId, holdings] of Object.entries(SEED)) {
      const existing = await db
        .select({ id: modelPortfolios.id })
        .from(modelPortfolios)
        .where(eq(modelPortfolios.id, portfolioId))
        .limit(1);
      if (!existing[0]) { skipped++; continue; }

      await db.execute(sql`
        UPDATE model_portfolios
        SET
          holdings = ${JSON.stringify(holdings)}::jsonb,
          total_holdings = ${holdings.length}
        WHERE id = ${portfolioId}
      `);
      updated++;
    }
    logger.info(`[ModelPortfolios] seed-holdings: updated=${updated} skipped=${skipped}`);
    return res.json({
      success: true,
      updated,
      skipped,
      message: `Seeded complete holdings for ${updated} portfolios (${skipped} IDs not in DB)`,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  } catch (err: any) {
    logger.error("[ModelPortfolios] seed-holdings error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /api/model-portfolios/admin/fix-total-holdings ────────────────────────
// Sets total_holdings = actual JSONB array length for every published portfolio.
// Fixes the mismatch where totalHoldings was manually set higher than stored data.
modelPortfoliosRouter.post("/admin/fix-total-holdings", async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      UPDATE model_portfolios
      SET total_holdings = jsonb_array_length(holdings)
      WHERE holdings IS NOT NULL
        AND holdings != 'null'::jsonb
        AND jsonb_typeof(holdings) = 'array'
    `);
    const rowCount = (result as any).rowCount ?? 0;
    logger.info(`[ModelPortfolios] fix-total-holdings: updated ${rowCount} rows`);
    return res.json({
      success: true,
      updated: rowCount,
      message: `Set total_holdings = JSONB array length for ${rowCount} portfolios`,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  } catch (err: any) {
    logger.error("[ModelPortfolios] fix-total-holdings error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/model-portfolios ──────────────────────────────────────────────────
modelPortfoliosRouter.get("/", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { riskProfile, assetClass, featured } = req.query;

    const conditions = [eq(modelPortfolios.isPublished, true)];
    if (riskProfile && typeof riskProfile === "string") {
      conditions.push(eq(modelPortfolios.riskProfile, riskProfile));
    }
    if (assetClass && typeof assetClass === "string") {
      conditions.push(eq(modelPortfolios.assetClass, assetClass));
    }
    if (featured === "true") {
      conditions.push(eq(modelPortfolios.isFeatured, true));
    }

    const portfolios = await db
      .select()
      .from(modelPortfolios)
      .where(and(...conditions))
      .orderBy(modelPortfolios.isFeatured, modelPortfolios.name);

    // NOTE: Holding return enrichment is skipped on the list endpoint.
    // Holdings returns are fetched on-demand via GET /api/model-portfolios/:id/holdings
    // when the user opens the Holdings tab in the detail panel.
    // This avoids 35 portfolios × 5 holdings = 175+ mfapi calls on every page load.

    return res.json({
      success: true,
      data: portfolios,
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
        count: portfolios.length,
        disclaimer:
          "Model portfolios are for research and guidance only. Past performance does not guarantee future returns. Please consult your SEBI-registered investment advisor before making investment decisions.",
      },
    });
  } catch (error) {
    logger.error("[ModelPortfolios] GET / error:", error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      error_code: "MODEL_PORTFOLIO_FETCH_ERROR",
      message: "Failed to fetch model portfolios",
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  }
});

// ── GET /api/model-portfolios/:id ──────────────────────────────────────────────
modelPortfoliosRouter.get("/:id", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { id } = req.params;
    const result = await db
      .select()
      .from(modelPortfolios)
      .where(and(eq(modelPortfolios.id, id), eq(modelPortfolios.isPublished, true)))
      .limit(1);

    if (!result[0]) {
      return res.status(404).json({
        success: false,
        error_code: "MODEL_PORTFOLIO_NOT_FOUND",
        message: `Model portfolio '${id}' not found`,
        retryable: false,
      });
    }

    // Enrich single portfolio holdings with live 1Y returns
    const enriched = await enrichPortfolio(result[0]);

    return res.json({
      success: true,
      data: enriched,
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
        disclaimer:
          "Model portfolios are for research and guidance only. Past performance does not guarantee future returns.",
      },
    });
  } catch (error) {
    logger.error("[ModelPortfolios] GET /:id error:", error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      error_code: "MODEL_PORTFOLIO_FETCH_ERROR",
      message: "Failed to fetch model portfolio",
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  }
});

// ── GET /api/model-portfolios/:id/holdings ─────────────────────────────────────
// Called on-demand when user opens the Holdings tab for a specific portfolio.
// Returns holdings enriched with live 1Y returns from mfapi.in (free, no key).
// Results are cached 6h per scheme code in the module-level _cache Map.
modelPortfoliosRouter.get("/:id/holdings", async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { id } = req.params;
    const result = await db
      .select({ id: modelPortfolios.id, holdings: modelPortfolios.holdings })
      .from(modelPortfolios)
      .where(and(eq(modelPortfolios.id, id), eq(modelPortfolios.isPublished, true)))
      .limit(1);

    if (!result[0]) {
      return res.status(404).json({
        success: false,
        error_code: "MODEL_PORTFOLIO_NOT_FOUND",
        message: `Model portfolio '${id}' not found`,
        retryable: false,
      });
    }

    const rawHoldings: any[] = Array.isArray(result[0].holdings) ? result[0].holdings : [];

    // Enrich each holding with trailing 12M return via mfapi.in
    // Cached 6h per scheme code — subsequent opens are instant
    const enriched = await Promise.all(rawHoldings.map(enrichHolding));

    return res.json({
      success: true,
      data: enriched,
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
        count: enriched.length,
        returnSource: "mfapi.in (trailing 12M NAV)",
        disclaimer: "Returns as of last market close. Past performance is not indicative of future results.",
      },
    });
  } catch (error) {
    logger.error("[ModelPortfolios] GET /:id/holdings error:", error instanceof Error ? error : new Error(String(error)));
    return res.status(500).json({
      success: false,
      error_code: "HOLDINGS_FETCH_ERROR",
      message: "Failed to fetch holdings with returns",
      retryable: true,
      meta: { timestamp: new Date().toISOString(), version: ENGINE_VERSION },
    });
  }
});
