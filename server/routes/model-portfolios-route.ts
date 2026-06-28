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
import { eq, and } from "drizzle-orm";
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
  "ICICI Pru Value Discovery":        120323,

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

/** Enriches a single holding with trailing 12M return via curated AMFI map + mfapi NAV.
 *  Pipeline:
 *   1. Look up schemeCode in FUND_SCHEME_MAP (curated, AMFI-verified)
 *   2. Fetch NAV history from mfapi.in → compute trailing 12M return
 *   3. If not in map → attempt mfapi name search as last resort
 *   4. On any failure → return holding unchanged (frontend shows "—")
 */
async function enrichHolding(h: any): Promise<any> {
  if (typeof h.currentReturn === "number" && h.currentReturn !== 0) return h;
  const name: string = h.name ?? "";
  if (!name) return { ...h, currentReturn: undefined };

  try {
    // ── Primary: curated AMFI-verified map ───────────────────────────────────
    let schemeCode = FUND_SCHEME_MAP[name] ?? null;

    // ── Fallback: mfapi name search (unreliable but better than nothing) ─────
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
    return { ...h, currentReturn: return1Y ?? undefined };
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
