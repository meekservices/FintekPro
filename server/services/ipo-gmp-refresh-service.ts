/**
 * @file ipo-gmp-refresh-service.ts
 * @description Fetches live IPO GMP (Grey Market Premium) data from investorgain.com
 *              every 4 hours and persists it to:
 *                1. `pre_ipo_companies` DB table (expectedReturns)
 *                2. An in-memory cache keyed by normalised company name
 *
 *              The pre-ipo route reads from this cache to overlay dynamic GMP on
 *              both CURATED_PRE_IPOS and DB records — replacing hardcoded values.
 *
 * Source: https://investorgain.com/report/live-ipo-gmp/673/
 *         (public page, no API key required)
 *
 * FASP-AI Compliance:
 *   - GMP is market data, not advisory — no SEBI disclaimer required on the sync job
 *   - All outputs include `gmpLastUpdated` timestamp so UI can show data freshness
 */

import { logger } from "../logger";
import { db } from "../db";
import { sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface GmpCacheEntry {
  /** Normalised company name (lowercase, alphanumeric only) */
  normalisedName: string;
  /** Original name as scraped */
  rawName: string;
  /** IPO issue price (upper band / cut-off) in ₹ */
  issuePrice: number;
  /** GMP absolute value in ₹ (can be negative = discount) */
  gmpAbsolute: number;
  /** GMP as a % of issue price */
  gmpPercent: number;
  /** Expected listing price = issuePrice + gmpAbsolute */
  estimatedListingPrice: number;
  /** Subscription status text e.g. "Open", "Closed", "Listed" */
  status: string;
  /** ISO timestamp of last successful scrape */
  lastUpdatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────

const gmpCache = new Map<string, GmpCacheEntry>();
let lastRefreshAt: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|pvt|private|inc|corp|corporation|llp|ipo)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function parseRupees(raw: string): number {
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parsePercent(raw: string): number {
  const cleaned = raw.replace(/[%\s]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCRAPER
// ─────────────────────────────────────────────────────────────────────────────

const INVESTORGAIN_GMP_URL = "https://investorgain.com/report/live-ipo-gmp/673/";
const SCRAPE_TIMEOUT_MS = 15_000;
const USER_AGENT = "Mozilla/5.0 (compatible; FintekPro-GMP-Bot/1.0; +https://fintekpro.in)";

interface ScrapedGmpRow {
  rawName: string;
  issuePrice: number;
  gmpAbsolute: number;
  gmpPercent: number;
  estimatedListingPrice: number;
  status: string;
}

function parseGmpHtml(html: string): ScrapedGmpRow[] {
  const rows: ScrapedGmpRow[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();

  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1];
    const cells: string[] = [];
    const localTd = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = localTd.exec(rowHtml)) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }

    // Need at least 5 columns: Name, EstListing, Price, GMP, %GMP
    if (cells.length < 5) continue;

    const rawName = cells[0]?.replace(/\bipo\b/gi, "").trim();
    if (!rawName || rawName.length < 2) continue;

    const estListing  = parseRupees(cells[1] ?? "");
    const issuePrice  = parseRupees(cells[2] ?? "");
    const gmpAbsolute = parseRupees(cells[3] ?? "");
    const gmpPercent  = parsePercent(cells[4] ?? "");
    const status      = cells[cells.length - 1]?.trim() || "Open";

    if (issuePrice <= 0 && estListing <= 0) continue;

    const effectiveIssue   = issuePrice > 0 ? issuePrice : estListing - gmpAbsolute;
    const effectiveListing = estListing  > 0 ? estListing : effectiveIssue + gmpAbsolute;
    const effectiveGmpPct  = gmpPercent !== 0 ? gmpPercent
      : effectiveIssue > 0 ? parseFloat(((gmpAbsolute / effectiveIssue) * 100).toFixed(2)) : 0;

    rows.push({
      rawName,
      issuePrice: effectiveIssue,
      gmpAbsolute,
      gmpPercent: effectiveGmpPct,
      estimatedListingPrice: effectiveListing,
      status,
    });
  }

  return rows;
}

async function scrapeInvestorGain(): Promise<ScrapedGmpRow[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const res = await fetch(INVESTORGAIN_GMP_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      logger.warn(`[IpoGmpRefresh] HTTP ${res.status} from investorgain.com`);
      return [];
    }
    return parseGmpHtml(await res.text());
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.warn(`[IpoGmpRefresh] Scrape error: ${err?.message ?? String(err)}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DB PERSIST
// ─────────────────────────────────────────────────────────────────────────────

async function persistGmpToDb(rows: ScrapedGmpRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  let updated = 0;
  for (const row of rows) {
    try {
      const normKey = normaliseName(row.rawName);
      if (!normKey) continue;
      const result = await db.execute(sql`
        UPDATE pre_ipo_companies
        SET
          expected_returns = ${row.gmpPercent},
          updated_at       = NOW()
        WHERE
          ipo_status NOT IN ('listed', 'withdrawn')
          AND LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]', '', 'g'))
              LIKE ${'%' + normKey + '%'}
      `);
      updated += (result as any).rowCount ?? 0;
    } catch (err: any) {
      logger.warn(`[IpoGmpRefresh] DB update error for "${row.rawName}": ${err?.message}`);
    }
  }
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up real-time GMP for any IPO by company name.
 * Uses progressive matching — exact → substring.
 */
export function lookupGmp(companyName: string): GmpCacheEntry | undefined {
  const key = normaliseName(companyName);
  if (!key) return undefined;
  if (gmpCache.has(key)) return gmpCache.get(key);
  for (const [cacheKey, entry] of gmpCache.entries()) {
    if (key.includes(cacheKey) || cacheKey.includes(key)) return entry;
  }
  return undefined;
}

/**
 * Returns the full GMP cache for admin/debug endpoints.
 */
export function getGmpCacheSnapshot(): { entries: GmpCacheEntry[]; lastRefreshAt: string | null } {
  return { entries: Array.from(gmpCache.values()), lastRefreshAt };
}

/**
 * Runs one full GMP refresh cycle: scrape → cache → DB.
 */
export async function runGmpRefresh(): Promise<{ scraped: number; dbUpdated: number; cached: number }> {
  const t0 = Date.now();
  logger.info("[IpoGmpRefresh] Starting GMP scrape", { event: "IPO_GMP_REFRESH_START", latency_ms: 0, status: "starting", user_id: "system" });

  const rows = await scrapeInvestorGain();
  if (rows.length === 0) {
    logger.warn("[IpoGmpRefresh] No rows scraped", { event: "IPO_GMP_REFRESH_EMPTY", latency_ms: Date.now() - t0, status: "empty", user_id: "system" });
    return { scraped: 0, dbUpdated: 0, cached: gmpCache.size };
  }

  // Populate in-memory cache
  const now = new Date().toISOString();
  for (const row of rows) {
    const key = normaliseName(row.rawName);
    if (!key) continue;
    gmpCache.set(key, { normalisedName: key, rawName: row.rawName, issuePrice: row.issuePrice, gmpAbsolute: row.gmpAbsolute, gmpPercent: row.gmpPercent, estimatedListingPrice: row.estimatedListingPrice, status: row.status, lastUpdatedAt: now });
  }
  lastRefreshAt = now;

  // Persist to DB (best-effort)
  let dbUpdated = 0;
  try { dbUpdated = await persistGmpToDb(rows); } catch (err: any) {
    logger.warn(`[IpoGmpRefresh] DB persist error (non-fatal): ${err?.message}`);
  }

  logger.info(`[IpoGmpRefresh] Done: scraped=${rows.length} cached=${gmpCache.size} dbUpdated=${dbUpdated} latency=${Date.now() - t0}ms`, {
    event: "IPO_GMP_REFRESH_DONE", latency_ms: Date.now() - t0, status: "ok", user_id: "system",
  });

  return { scraped: rows.length, dbUpdated, cached: gmpCache.size };
}

const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

/**
 * Starts the recurring GMP refresh scheduler (every 4 hours).
 * Call once from background-schedulers.ts.
 */
export function startIpoGmpRefreshScheduler(): void {
  // Run immediately on boot
  runGmpRefresh().catch((err) => logger.warn(`[IpoGmpRefresh] Initial run error: ${err?.message}`));

  setInterval(() => {
    runGmpRefresh().catch((err) => logger.warn(`[IpoGmpRefresh] Periodic run error: ${err?.message}`));
  }, FOUR_HOURS_MS);

  logger.info("[IpoGmpRefresh] Scheduler started — next refresh in 4h", {
    event: "IPO_GMP_SCHEDULER_START", latency_ms: 0, status: "ok", user_id: "system",
  });
}
