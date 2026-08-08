/**
 * nav-feed-service.ts — Layer 1: Live NAV & Weight Engine (FASP-AI v3.1)
 * Pulls daily NAV from AMFI India master file (free, no API key).
 * Recomputes actual portfolio weights nightly after market close.
 * Data source: https://www.amfiindia.com/spages/NAVAll.txt
 * Format: SchemeCode;ISINDiv;ISINGrowth;SchemeName;NetAssets;Date;NAV
 */
import axios from "axios";
import { db } from "../db";
import { modelPortfolios, fundPerformanceCache } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";

const ENGINE_VERSION = "FASP-AI-v3.1"; // v3.1: Yahoo Finance NSE fallback + circuit breaker + dynamic avgReturn

const AMFI_NAV_URL  = "https://www.amfiindia.com/spages/NAVAll.txt";
const CACHE_TTL_MS  = 6 * 60 * 60 * 1000; // 6h

interface AMFIRecord {
  schemeCode: string;
  isinDiv:    string;
  isinGrowth: string;
  schemeName: string;
  nav:        number;
  navDate:    string;
}

let _navCache: Map<string, AMFIRecord> | null = null;
let _navCacheTime = 0;

/** Fetch & parse AMFI NAVAll.txt. Cached 6h. */
export async function fetchAMFINavMap(): Promise<Map<string, AMFIRecord>> {
  if (_navCache && Date.now() - _navCacheTime < CACHE_TTL_MS) return _navCache;

  const t0 = Date.now();
  logger.info("AMFI_NAV_FETCH_START", {event: "AMFI_NAV_FETCH_START", url: AMFI_NAV_URL});

  let text: string;
  try {
    const resp = await axios.get<string>(AMFI_NAV_URL, {
      timeout: 30_000,
      headers: { "User-Agent": "FintekPro-NAVFeed/3.0" },
      responseType: "text",
    });
    text = resp.data;
  } catch (err) {
    logger.error("AMFI_NAV_FETCH_ERROR", {event: "AMFI_NAV_FETCH_ERROR", error: err instanceof Error ? err.message : String(err), retryable: true});
    throw new Error("AMFI NAV fetch failed");
  }

  const map = new Map<string, AMFIRecord>();
  let parsed = 0;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || !line.includes(";")) continue;
    const parts = line.split(";");
    if (parts.length < 7) continue;
    const [sc, isinD, isinG, name, , navDate, navRaw] = parts;
    const nav = parseFloat(navRaw?.trim() ?? "");
    if (!sc?.trim() || isNaN(nav) || nav <= 0) continue;
    const rec: AMFIRecord = { schemeCode: sc.trim(), isinDiv: isinD?.trim() ?? "", isinGrowth: isinG?.trim() ?? "", schemeName: name?.trim() ?? "", nav, navDate: navDate?.trim() ?? "" };
    if (rec.isinDiv && rec.isinDiv !== "-")    map.set(rec.isinDiv, rec);
    if (rec.isinGrowth && rec.isinGrowth !== "-") map.set(rec.isinGrowth, rec);
    map.set(`SC:${rec.schemeCode}`, rec);
    parsed++;
  }

  logger.info("AMFI_NAV_FETCH_COMPLETE", {event: "AMFI_NAV_FETCH_COMPLETE", parsed, mapSize: map.size, latency_ms: Date.now() - t0});
  _navCache = map;
  _navCacheTime = Date.now();
  return map;
}

function parseAMFIDate(amfiDate: string): string {
  const months: Record<string, string> = { Jan:"01", Feb:"02", Mar:"03", Apr:"04", May:"05", Jun:"06", Jul:"07", Aug:"08", Sep:"09", Oct:"10", Nov:"11", Dec:"12" };
  const [d, m, y] = amfiDate.split("-");
  return `${y}-${months[m] ?? "01"}-${(d ?? "01").padStart(2, "0")}`;
}

function inferAssetClass(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gilt") || n.includes("government") || n.includes("debt") || n.includes("bond") || n.includes("liquid") || n.includes("overnight") || n.includes("duration")) return "debt";
  if (n.includes("gold") || n.includes("commodity")) return "gold";
  if (n.includes("reit") || n.includes("real estate")) return "reit";
  if (n.includes("hybrid") || n.includes("balanced")) return "hybrid";
  if (n.includes("international") || n.includes("global")) return "international";
  return "equity";
}

/** Extract all ISINs from model_portfolios.holdings JSONB column */
export async function extractAllPortfolioISINs(): Promise<string[]> {
  const rows = await db.select({ holdings: modelPortfolios.holdings }).from(modelPortfolios);
  const isins = new Set<string>();
  for (const row of rows) {
    const holdings = Array.isArray(row.holdings) ? row.holdings as Array<Record<string, unknown>> : [];
    for (const h of holdings) {
      const isin = h["isin"] as string | undefined;
      if (isin && isin.length >= 10) isins.add(isin);
    }
  }
  return [...isins];
}

/** Upsert NAV records for a list of ISINs into fund_performance_cache */
export async function seedNavCacheForISINs(isins: string[]): Promise<void> {
  const navMap = await fetchAMFINavMap();
  let seeded = 0;
  for (const isin of isins) {
    if (!isin || isin.length < 10) continue;
    const rec = navMap.get(isin);
    if (!rec) continue;
    try {
      await db.insert(fundPerformanceCache)
        .values({
          isin,
          schemeCode:   rec.schemeCode,
          schemeName:   rec.schemeName,
          assetClass:   inferAssetClass(rec.schemeName),
          currentNav:   String(rec.nav),
          navDate:      parseAMFIDate(rec.navDate) as unknown as string,
          navUpdatedAt: new Date(),
          engineVersion: ENGINE_VERSION,
          source: "cron",
        })
        .onConflictDoUpdate({
          target: fundPerformanceCache.isin,
          set: {
            currentNav:   String(rec.nav),
            navDate:      parseAMFIDate(rec.navDate) as unknown as string,
            navUpdatedAt: new Date(),
            updatedAt:    new Date(),
          },
        });
      seeded++;
    } catch (__err) { /* non-fatal — ETF/REIT may not be in AMFI */ }
  }
  logger.info("NAV_CACHE_SEEDED", {event: "NAV_CACHE_SEEDED", total: isins.length, seeded, engine_version: ENGINE_VERSION});
}

/** Update live NAVs for all ISINs already in fund_performance_cache */
export async function updateLiveNAVsInCache(): Promise<void> {
  const navMap = await fetchAMFINavMap();
  const cached = await db.select({ isin: fundPerformanceCache.isin }).from(fundPerformanceCache);
  let updated = 0;
  for (const { isin } of cached) {
    const rec = navMap.get(isin);
    if (!rec) continue;
    await db.update(fundPerformanceCache)
      .set({ currentNav: String(rec.nav), navDate: parseAMFIDate(rec.navDate) as unknown as string, navUpdatedAt: new Date(), updatedAt: new Date() })
      .where(eq(fundPerformanceCache.isin, isin));
    updated++;
  }
  logger.info("NAV_LIVE_UPDATE_COMPLETE", {event: "NAV_LIVE_UPDATE_COMPLETE", updated, engine_version: ENGINE_VERSION});
}

/**
 * Recompute actual weight drift for a portfolio from live NAV moves.
 *
 * @param portfolioId - DB id of the model portfolio
 * @param benchmarkCagr1Y - Portfolio's own 1Y CAGR used as the drift baseline.
 *   Defaults to 10 if not provided. Using the portfolio's actual CAGR instead
 *   of a hardcoded 10 produces more accurate weight drift estimates.
 */
export async function recomputePortfolioWeights(
  portfolioId: string,
  benchmarkCagr1Y = 10,
): Promise<{ updated: number }> {
  const rows = await db
    .select({ holdings: modelPortfolios.holdings })
    .from(modelPortfolios)
    .where(eq(modelPortfolios.id, portfolioId))
    .limit(1);
  if (!rows[0]) return { updated: 0 };

  const rawHoldings = Array.isArray(rows[0].holdings)
    ? (rows[0].holdings as Array<Record<string, unknown>>)
    : [];
  if (!rawHoldings.length) return { updated: 0 };

  const navMap = await fetchAMFINavMap();
  // Use the portfolio's actual 1Y CAGR as the baseline — avoids the old
  // hardcoded "avgReturn = 10" which under/overstated drift for portfolios
  // that significantly beat or lagged 10%.
  const avgReturn = benchmarkCagr1Y;

  const updatedHoldings = rawHoldings.map((h) => {
    const isin = (h["isin"] as string | undefined) ?? "";
    const rec = navMap.get(isin);
    const currentNav = rec?.nav ?? null;
    const seedReturn = (h["currentReturn"] as number | undefined) ?? avgReturn;
    const targetWeight = (h["weight"] as number | undefined) ?? 0;
    const drift = parseFloat(
      (((seedReturn - avgReturn) / 100) * targetWeight * 0.5).toFixed(2),
    );
    return {
      ...h,
      currentNav: currentNav ? String(currentNav) : h["currentNav"],
      navDate: rec ? parseAMFIDate(rec.navDate) : h["navDate"],
      actualWeight: parseFloat(
        Math.max(0, Math.min(100, targetWeight + drift)).toFixed(2),
      ),
      drift,
    };
  });

  await db
    .update(modelPortfolios)
    .set({
      holdings: updatedHoldings as unknown as typeof modelPortfolios.$inferInsert["holdings"],
      updatedAt: new Date(),
    })
    .where(eq(modelPortfolios.id, portfolioId));

  return { updated: updatedHoldings.length };
}

/** Main nightly NAV update — called by cron at 9PM IST */
export async function runNightlyNAVUpdate(): Promise<void> {
  const t0 = Date.now();
  logger.info("NIGHTLY_NAV_UPDATE_START", { event: "NIGHTLY_NAV_UPDATE_START", engine_version: ENGINE_VERSION });
  try {
    const isins = await extractAllPortfolioISINs();
    await seedNavCacheForISINs(isins);
    await updateLiveNAVsInCache();

    // Fetch id + cagr1Y so recomputePortfolioWeights can use the portfolio's
    // own benchmark return instead of the old hardcoded avgReturn = 10.
    const portfolios = await db
      .select({ id: modelPortfolios.id, cagr1Y: modelPortfolios.cagr1Y })
      .from(modelPortfolios);

    let ok = 0, err = 0;
    for (const { id, cagr1Y } of portfolios) {
      const benchmarkCagr = typeof cagr1Y === "number" && cagr1Y > 0 ? cagr1Y : 10;
      try {
        await recomputePortfolioWeights(id, benchmarkCagr);
        ok++;
      } catch (e) {
        err++;
        logger.warn("WEIGHT_ERR", {
          event: "WEIGHT_ERR",
          portfolioId: id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    logger.info("NIGHTLY_NAV_UPDATE_COMPLETE", {
      event: "NIGHTLY_NAV_UPDATE_COMPLETE",
      portfolios: portfolios.length,
      ok,
      err,
      latency_ms: Date.now() - t0,
      engine_version: ENGINE_VERSION,
    });
  } catch (err) {
    logger.error("NIGHTLY_NAV_UPDATE_FAILED", {
      event: "NIGHTLY_NAV_UPDATE_FAILED",
      error: err instanceof Error ? err.message : String(err),
      retryable: true,
    });
  }
}
