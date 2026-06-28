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

// ─── In-memory cache: fund name / scheme code → { return1Y, ts } ─────────────
const CACHE_TTL_MS = 6 * 60 * 60 * 1_000; // 6 hours
const _cache = new Map<string, { value: any; ts: number }>();
const cached = <T>(key: string, value: T): T => { _cache.set(key, { value, ts: Date.now() }); return value; };
const fromCache = <T>(key: string): T | null => {
  const e = _cache.get(key);
  return e && Date.now() - e.ts < CACHE_TTL_MS ? e.value : null;
};

// ─── mfapi.in helpers ─────────────────────────────────────────────────────────

/** Search mfapi.in by fund name, return best Direct-Growth schemeCode. */
async function searchScheme(name: string): Promise<number | null> {
  const key = `search:${name.toLowerCase().trim()}`;
  const hit = fromCache<number | null>(key);
  if (hit !== null) return hit;
  try {
    const r = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(name)}`, {
      signal: AbortSignal.timeout(6_000),
    });
    if (!r.ok) return cached(key, null);
    const results = (await r.json()) as { schemeCode: number; schemeName: string }[];
    if (!results?.length) return cached(key, null);
    const direct = results.find(
      (x) => x.schemeName.toUpperCase().includes("DIRECT") && x.schemeName.toUpperCase().includes("GROWTH"),
    );
    return cached(key, (direct ?? results[0])?.schemeCode ?? null);
  } catch {
    return cached(key, null);
  }
}

/** Compute trailing 12M return from mfapi NAV history. Returns % (e.g. 14.2). */
async function get1YReturn(schemeCode: number): Promise<number | null> {
  const key = `nav:${schemeCode}`;
  const hit = fromCache<number | null>(key);
  if (hit !== null) return hit;
  try {
    const r = await fetch(`https://api.mfapi.in/mf/${schemeCode}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return cached(key, null);
    const d = (await r.json()) as { data: { date: string; nav: string }[] };
    const navData = d?.data ?? [];
    if (navData.length < 10) return cached(key, null);

    // mfapi dates are DD-MM-YYYY (descending order — navData[0] = latest)
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
    if (!oldNav || oldNav <= 0) return cached(key, null);

    const ret = Math.round(((latestNav - oldNav) / oldNav) * 10_000) / 100;
    return cached(key, ret);
  } catch {
    return cached(key, null);
  }
}

/** Enriches a single holding with currentReturn from mfapi. Non-throwing. */
async function enrichHolding(h: any): Promise<any> {
  // Already has a valid non-zero return → keep it
  if (typeof h.currentReturn === "number" && h.currentReturn !== 0) return h;
  const name: string = h.name ?? "";
  if (!name) return { ...h, currentReturn: undefined };
  try {
    const schemeCode = await searchScheme(name);
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

    // Enrich all portfolios' holdings with live 1Y returns (parallel per portfolio)
    const enriched = await Promise.all(portfolios.map(enrichPortfolio));

    return res.json({
      success: true,
      data: enriched,
      meta: {
        timestamp: new Date().toISOString(),
        version: ENGINE_VERSION,
        engine_version: ENGINE_VERSION,
        latency_ms: Date.now() - start,
        count: enriched.length,
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
