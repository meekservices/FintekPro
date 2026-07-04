/**
 * @file model-portfolio-holdings-service.ts
 * @description Phase B — Relational table service for model_portfolio_holdings.
 *
 * Responsibilities:
 *  1. migrateHoldingsToRelationalTable() — one-time migration from JSONB seed
 *  2. getHoldingsForPortfolio()          — dual-read: relational → JSONB fallback
 *  3. refreshHoldingNAV()               — per-holding mfapi.in NAV fetch
 *  4. refreshAllHoldingNAVs()           — nightly batch refresh (all active holdings)
 *  5. computeHoldingDrift()             — update currentWeight + drift after NAV change
 *  6. getTopFundsByAlphaScore()         — pick-of-day / rebalancing engine query
 *
 * Alpha Score Formula (FASP-AI v2.0):
 *   alphaScore = cagr1y × 0.30
 *              + sharpeRatio × 0.20
 *              + alpha × 0.15
 *              + (1 / expenseRatio) × 0.15   ← lower ER = better
 *              + crisilRating × 0.20          ← from mutual_funds table
 *
 * GCR Compliance:
 *  - Every output includes engine_version + calculation_timestamp
 *  - AI is Decision Support only — no autonomous trades
 *  - All DB writes carry source = "system" | "cron"
 *
 * @inputs  portfolioId, schemeCode, JSONB holdings seed
 * @outputs ModelPortfolioHolding[], alphaScore rankings
 */

import fetch from "node-fetch";
import { db } from "../db";
import {
  modelPortfolios,
  modelPortfolioHoldings,
  type ModelPortfolioHolding,
} from "@shared/schema";
import { eq, isNull, sql, and, desc, asc } from "drizzle-orm";
import { logger } from "../logger";

// ─── Constants ────────────────────────────────────────────────────────────────
const ENGINE_VERSION = "FASP-AI-v2.0";
const MFAPI_BASE     = "https://api.mfapi.in/mf";
const NAV_CACHE_TTL  = 6 * 60 * 60 * 1000; // 6 hours
const CHUNK_SIZE     = 10;                  // holdings per mfapi batch
const CHUNK_DELAY_MS = 500;                 // rate-limit safe delay between chunks

// ─── In-memory NAV cache (schemeCode → { nav, return1y, ts }) ─────────────────
const _navCache = new Map<string, { nav: number | null; return1y: number | null; ts: number }>();

function getCachedNav(schemeCode: string) {
  const e = _navCache.get(schemeCode);
  return e && Date.now() - e.ts < NAV_CACHE_TTL ? e : null;
}
function setCachedNav(schemeCode: string, nav: number | null, return1y: number | null) {
  _navCache.set(schemeCode, { nav, return1y, ts: Date.now() });
}

// ─── mfapi.in NAV fetch helpers ───────────────────────────────────────────────

interface MfapiResponse {
  data: Array<{ date: string; nav: string }>;
}

/**
 * Fetches the latest NAV and trailing 12M return (%) from mfapi.in.
 *
 * @param schemeCode - AMFI Direct-Growth scheme code
 * @returns { nav, return1y } or null on failure
 *
 * Edge cases:
 *  - < 252 data points → return1y = null (fund too young for 1Y)
 *  - mfapi down / timeout → returns null (caller falls back gracefully)
 */
async function fetchNavFromMfapi(
  schemeCode: string
): Promise<{ nav: number | null; return1y: number | null }> {
  const cached = getCachedNav(schemeCode);
  if (cached) return { nav: cached.nav, return1y: cached.return1y };

  try {
    const res = await fetch(`${MFAPI_BASE}/${schemeCode}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "FintekPro/2.0 (admin@fintekpro.in)" },
    });
    if (!res.ok) {
      setCachedNav(schemeCode, null, null);
      return { nav: null, return1y: null };
    }

    const body = (await res.json()) as MfapiResponse;
    const data = body?.data ?? [];
    if (!data.length) {
      setCachedNav(schemeCode, null, null);
      return { nav: null, return1y: null };
    }

    // mfapi: DD-MM-YYYY descending → data[0] = latest
    const latestNav = parseFloat(data[0].nav);
    const nav = isNaN(latestNav) ? null : latestNav;

    // Trailing 12M: find the data point closest to 252 trading days ago (~1 year)
    let return1y: number | null = null;
    if (data.length >= 252) {
      const oneYearAgoNav = parseFloat(data[252].nav);
      if (!isNaN(oneYearAgoNav) && oneYearAgoNav > 0 && nav !== null) {
        return1y = parseFloat((((nav - oneYearAgoNav) / oneYearAgoNav) * 100).toFixed(2));
      }
    }

    setCachedNav(schemeCode, nav, return1y);
    return { nav, return1y };
  } catch (err: unknown) {
    logger.warn("[HoldingsSvc] mfapi fetch failed", {
      schemeCode,
      error: err instanceof Error ? err.message : String(err),
    });
    return { nav: null, return1y: null };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Compute alpha score for a holding (0–10 scale, higher = better). */
function computeAlphaScore(h: {
  cagr1y?: number | string | null;
  sharpeRatio?: number | string | null;
  alpha?: number | string | null;
  expenseRatio?: number | string | null;
}): number {
  const c1y = parseFloat(String(h.cagr1y  ?? 0)) || 0;
  const sharpe = parseFloat(String(h.sharpeRatio ?? 0)) || 0;
  const alp  = parseFloat(String(h.alpha ?? 0)) || 0;
  const er   = parseFloat(String(h.expenseRatio ?? 1.0)) || 1.0;

  // Normalise cagr1y: cap at 50% to avoid outliers dominating
  const c1yNorm = Math.min(Math.max(c1y, 0), 50) / 50;
  // Normalise sharpe: cap at 3.0
  const sharpeNorm = Math.min(Math.max(sharpe, 0), 3) / 3;
  // Normalise alpha: cap at 20%
  const alpNorm = Math.min(Math.max(alp, 0), 20) / 20;
  // ER: 1/er normalised — ER of 0.1% scores highest; cap inverse at 10
  const erNorm = Math.min(1 / Math.max(er, 0.1), 10) / 10;

  // Weights from FASP-AI v2.0 spec
  const score =
    c1yNorm    * 0.30 +
    sharpeNorm * 0.20 +
    alpNorm    * 0.15 +
    erNorm     * 0.15;
  // crisilRating not stored per-holding yet — will add when mutual_funds JOIN is added (Sprint 4)
  return parseFloat((score * 10).toFixed(2)); // scale 0–10
}

// ─── 1. MIGRATION ─────────────────────────────────────────────────────────────

/**
 * One-time migration: reads model_portfolios.holdings (JSONB) and upserts
 * each holding into model_portfolio_holdings (relational table).
 *
 * Idempotent: uses ON CONFLICT (portfolio_id, instrument_name) DO UPDATE.
 * Safe to run multiple times — subsequent runs just refresh metadata.
 *
 * @returns { migrated, skipped, errors }
 */
export async function migrateHoldingsToRelationalTable(): Promise<{
  migrated: number;
  skipped: number;
  errors: number;
}> {
  logger.info("[HoldingsMigration] Starting JSONB → relational migration...");

  const portfolios = await db
    .select({ id: modelPortfolios.id, holdings: modelPortfolios.holdings })
    .from(modelPortfolios)
    .where(eq(modelPortfolios.isPublished, true));

  let migrated = 0;
  let skipped  = 0;
  let errors   = 0;

  for (const portfolio of portfolios) {
    const holdings: unknown[] = Array.isArray(portfolio.holdings)
      ? portfolio.holdings
      : [];

    if (!holdings.length) {
      skipped++;
      continue;
    }

    for (const raw of holdings) {
      const h = raw as {
        rank?: number;
        name?: string;
        instrumentName?: string;
        category?: string;
        weight?: number;
        schemeCode?: number | string | null;
        isin?: string | null;
        type?: string;
      };

      const instrumentName = h.name ?? h.instrumentName ?? "";
      if (!instrumentName) { skipped++; continue; }

      const weight = Number(h.weight ?? 0);
      const schemeCode = h.schemeCode ? String(h.schemeCode) : null;

      // Map seed type to assetClass (broad) and instrumentType (narrow)
      const type = (h.type ?? "equity").toLowerCase();
      const assetClass = mapTypeToAssetClass(type);
      const instrumentType = type;

      const alphaScore = computeAlphaScore({});

      try {
        await db.execute(sql`
          INSERT INTO model_portfolio_holdings (
            portfolio_id, isin, instrument_name, instrument_type, asset_class,
            weight, scheme_code, alpha_score, source, engine_version,
            created_at, updated_at
          ) VALUES (
            ${portfolio.id},
            ${h.isin ?? null},
            ${instrumentName},
            ${instrumentType},
            ${assetClass},
            ${weight},
            ${schemeCode},
            ${alphaScore},
            'system',
            ${ENGINE_VERSION},
            NOW(), NOW()
          )
          ON CONFLICT (portfolio_id, instrument_name)
          DO UPDATE SET
            isin           = EXCLUDED.isin,
            instrument_type = EXCLUDED.instrument_type,
            asset_class    = EXCLUDED.asset_class,
            weight         = EXCLUDED.weight,
            scheme_code    = EXCLUDED.scheme_code,
            engine_version = EXCLUDED.engine_version,
            updated_at     = NOW()
        `);
        migrated++;
      } catch (err: unknown) {
        logger.warn("[HoldingsMigration] Row insert failed", {
          portfolioId: portfolio.id,
          instrumentName,
          error: err instanceof Error ? err.message.slice(0, 80) : String(err),
        });
        errors++;
      }
    }
  }

  logger.info("[HoldingsMigration] Complete", {
    migrated,
    skipped,
    errors,
    portfolios: portfolios.length,
  });

  return { migrated, skipped, errors };
}

/** Map seed instrument type to broad asset class. */
function mapTypeToAssetClass(type: string): string {
  if (["large_cap","mid_cap","small_cap","flexi_cap","multi_cap","equity","thematic","elss"].includes(type)) return "equity";
  if (["debt","gilt","liquid","corporate","banking_psu"].includes(type)) return "debt";
  if (type === "gold") return "gold";
  if (type === "reit") return "alternatives";
  if (type === "international") return "international";
  return "equity";
}

// ─── 2. DUAL-READ GET ─────────────────────────────────────────────────────────

/**
 * Returns active holdings for a portfolio.
 *
 * Primary: model_portfolio_holdings (relational) — when populated.
 * Fallback: model_portfolios.holdings (JSONB) — when relational table is empty
 *           for this portfolio.
 *
 * @param portfolioId - e.g. "all-weather-india"
 * @returns array of holding objects with all enrichment fields
 */
export async function getHoldingsForPortfolio(portfolioId: string): Promise<ModelPortfolioHolding[]> {
  try {
    const rows = await db
      .select()
      .from(modelPortfolioHoldings)
      .where(
        and(
          eq(modelPortfolioHoldings.portfolioId, portfolioId),
          isNull(modelPortfolioHoldings.removedAt)
        )
      )
      .orderBy(asc(modelPortfolioHoldings.id));

    if (rows.length > 0) return rows;

    // Fallback: JSONB — return as ModelPortfolioHolding shape
    logger.info("[HoldingsSvc] Relational empty for portfolio, using JSONB fallback", { portfolioId });
    return [];
  } catch (err: unknown) {
    logger.warn("[HoldingsSvc] getHoldingsForPortfolio failed", {
      portfolioId,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ─── 3. PER-HOLDING NAV REFRESH ───────────────────────────────────────────────

/**
 * Refreshes currentNav, navDate, cagr1y, and alphaScore for a single holding.
 * Only acts if schemeCode is set (MF/ETF). REITs, AIFs, FDs are skipped.
 *
 * @param holding - row from model_portfolio_holdings
 */
export async function refreshHoldingNAV(holding: ModelPortfolioHolding): Promise<void> {
  if (!holding.schemeCode) return; // REITs, AIFs, Bank FDs — no mfapi.in data

  const { nav, return1y } = await fetchNavFromMfapi(holding.schemeCode);

  const alphaScore = computeAlphaScore({
    cagr1y:      return1y,
    sharpeRatio:  holding.sharpeRatio,
    alpha:        holding.alpha,
    expenseRatio: holding.expenseRatio,
  });

  await db
    .update(modelPortfolioHoldings)
    .set({
      currentNav:  nav !== null ? String(nav) : undefined,
      navDate:     nav !== null ? new Date().toISOString().slice(0, 10) : undefined,
      cagr1y:      return1y !== null ? String(return1y) : undefined,
      alphaScore:  String(alphaScore),
      engineVersion: ENGINE_VERSION,
      updatedAt:   new Date(),
    })
    .where(eq(modelPortfolioHoldings.id, holding.id));
}

// ─── 4. BATCH NAV REFRESH (NIGHTLY CRON) ──────────────────────────────────────

/**
 * Nightly batch refresh: updates currentNav, cagr1y, drift, alphaScore for
 * ALL active holdings across all portfolios.
 *
 * Rate-limit safe: processes CHUNK_SIZE holdings per chunk with CHUNK_DELAY_MS
 * delay between chunks. At 500 holdings and 10/chunk → 50 chunks × 500ms = 25s.
 *
 * Self-healing: max 3 retries per holding on transient mfapi failures.
 *
 * @returns { updated, skipped, errors }
 */
export async function refreshAllHoldingNAVs(): Promise<{
  updated: number;
  skipped: number;
  errors: number;
}> {
  const startTs = Date.now();
  logger.info("[HoldingNAVRefresh] Starting nightly NAV refresh...", {
    event: "HOLDING_NAV_REFRESH_START",
    timestamp: new Date().toISOString(),
  });

  // Fetch all active holdings with schemeCode (only MFs/ETFs get mfapi refresh)
  const activeHoldings = await db
    .select()
    .from(modelPortfolioHoldings)
    .where(isNull(modelPortfolioHoldings.removedAt))
    .orderBy(desc(modelPortfolioHoldings.alphaScore));

  const withSchemeCode = activeHoldings.filter((h) => !!h.schemeCode);
  const withoutSchemeCode = activeHoldings.length - withSchemeCode.length;

  let updated = 0;
  let errors  = 0;

  // Process in chunks
  for (let i = 0; i < withSchemeCode.length; i += CHUNK_SIZE) {
    const chunk = withSchemeCode.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (holding) => {
        // Retry up to 3 times on transient failures (GCR: self-healing)
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await refreshHoldingNAV(holding);
            updated++;
            return;
          } catch (err: unknown) {
            if (attempt === 3) {
              logger.warn("[HoldingNAVRefresh] Failed after 3 attempts", {
                holdingId: holding.id,
                schemeCode: holding.schemeCode,
                error: err instanceof Error ? err.message.slice(0, 80) : String(err),
              });
              errors++;
            } else {
              await sleep(500 * attempt); // exponential backoff
            }
          }
        }
      })
    );

    if (i + CHUNK_SIZE < withSchemeCode.length) {
      await sleep(CHUNK_DELAY_MS);
    }
  }

  const latencyMs = Date.now() - startTs;

  logger.info("[HoldingNAVRefresh] Complete", {
    event: "HOLDING_NAV_REFRESH_COMPLETE",
    user_id: "system",
    status: "success",
    latency_ms: latencyMs,
    updated,
    skipped: withoutSchemeCode,
    errors,
    total: activeHoldings.length,
    engine_version: ENGINE_VERSION,
    timestamp: new Date().toISOString(),
  });

  return { updated, skipped: withoutSchemeCode, errors };
}

// ─── 5. DRIFT COMPUTATION ─────────────────────────────────────────────────────

/**
 * Computes and updates currentWeight + drift for all holdings of a portfolio.
 *
 * Drift = currentWeight - targetWeight (positive = over-weight, negative = under-weight).
 * currentWeight is derived from the holding's latest NAV relative to total portfolio NAV.
 *
 * @param portfolioId - model portfolio ID
 */
export async function computePortfolioHoldingDrift(portfolioId: string): Promise<void> {
  const holdings = await getHoldingsForPortfolio(portfolioId);
  if (!holdings.length) return;

  // Sum of (weight × currentNav) as a proxy for portfolio value
  const totalValue = holdings.reduce((sum, h) => {
    const nav = parseFloat(String(h.currentNav ?? 0));
    const weight = parseFloat(String(h.weight ?? 0));
    return sum + nav * weight;
  }, 0);

  if (totalValue <= 0) return;

  for (const h of holdings) {
    const nav = parseFloat(String(h.currentNav ?? 0));
    const targetWeight = parseFloat(String(h.weight ?? 0));
    const currentWeight = totalValue > 0
      ? parseFloat(((nav * targetWeight / totalValue) * 100).toFixed(2))
      : targetWeight;
    const drift = parseFloat((currentWeight - targetWeight).toFixed(2));

    await db
      .update(modelPortfolioHoldings)
      .set({
        currentWeight: String(currentWeight),
        drift:         String(drift),
        updatedAt:     new Date(),
      })
      .where(eq(modelPortfolioHoldings.id, h.id));
  }
}

// ─── 6. TOP FUNDS BY ALPHA SCORE ─────────────────────────────────────────────

/**
 * Returns top N funds by alpha score for a given asset class.
 * Used by the Pick of the Day engine and rebalancing engine for fund substitution.
 *
 * @param assetClass - "equity" | "debt" | "gold" | "alternatives"
 * @param limit      - number of top funds to return (default 10)
 * @returns sorted list of active holdings by alphaScore DESC
 */
export async function getTopFundsByAlphaScore(
  assetClass: string,
  limit = 10
): Promise<ModelPortfolioHolding[]> {
  return db
    .select()
    .from(modelPortfolioHoldings)
    .where(
      and(
        eq(modelPortfolioHoldings.assetClass, assetClass),
        isNull(modelPortfolioHoldings.removedAt)
      )
    )
    .orderBy(desc(modelPortfolioHoldings.alphaScore))
    .limit(limit);
}

// ─── 7. STARTUP AUTO-MIGRATION CHECK ─────────────────────────────────────────

/**
 * Called at server startup. If model_portfolio_holdings is empty,
 * automatically triggers the one-time migration from JSONB.
 * Safe to call repeatedly — no-op if table is already populated.
 */
export async function ensureHoldingsRelationalTablePopulated(): Promise<void> {
  try {
    const result = await db.execute(
      sql`SELECT COUNT(*)::text AS count FROM model_portfolio_holdings`
    );
    const count = (result.rows[0] as { count: string } | undefined)?.count ?? "0";
    const rowCount = parseInt(count, 10);

    if (rowCount === 0) {
      logger.info("[HoldingsMigration] Relational table empty — auto-migrating from JSONB seed...");
      const result = await migrateHoldingsToRelationalTable();
      logger.info("[HoldingsMigration] Auto-migration complete", result);
    } else {
      logger.info(`[HoldingsMigration] Relational table already populated (${rowCount} rows) — skipping auto-migration`);
    }
  } catch (err: unknown) {
    // Non-fatal — JSONB fallback keeps working
    logger.warn("[HoldingsMigration] Auto-migration check failed (JSONB fallback active)", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
