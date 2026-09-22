/**
 * @file ipo-gmp-refresh-service.ts
 * @description Live IPO GMP (Grey Market Premium) — multi-source fetch with cross-validation.
 *
 * DATA SOURCES (priority order):
 *   1. IndianAPI /ipo/v2        — authenticated, structured JSON, most reliable
 *   2. investorgain.com         — HTML scrape, primary fallback
 *   3. ipowatch.in              — HTML scrape, secondary fallback
 *
 * CROSS-VALIDATION:
 *   - Values from all available sources are collected per company.
 *   - If sources agree within GMP_CONSENSUS_TOLERANCE_PCT (15%), weighted average is used.
 *   - If sources diverge, the most conservative (lower absolute GMP) is used + confidence="low".
 *   - A minimum of 1 source is required to emit an entry; 2+ sources = "high" confidence.
 *
 * SCHEDULE: Runs on boot + every 4 hours.
 *
 * PERSISTENCE:
 *   1. In-memory Map<normalisedName, GmpCacheEntry> — for zero-latency route reads
 *   2. pre_ipo_companies.expected_returns — DB persistence for warm restarts
 *
 * FASP-AI Compliance:
 *   - GMP is market data, not advisory — no SEBI disclaimer on the sync job itself
 *   - Every cache entry includes sourceCount, confidence, lastUpdatedAt for auditability
 */

import { logger } from "../logger";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { indianApiService } from "./indian-api-service";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const SCRAPE_TIMEOUT_MS        = 12_000;
const FOUR_HOURS_MS            = 4 * 60 * 60 * 1000;
const GMP_CONSENSUS_TOLERANCE  = 0.15;   // 15% max divergence for "high" confidence
const USER_AGENT               = "Mozilla/5.0 (compatible; FintekPro-GMP-Bot/1.0; +https://fintekpro.in)";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** A single GMP reading from one source */
interface RawGmpReading {
  source: "indian_api" | "investorgain" | "ipowatch";
  rawName: string;
  issuePrice: number;
  gmpAbsolute: number;
  gmpPercent: number;
  estimatedListingPrice: number;
  status: string;
}

export interface GmpCacheEntry {
  /** Normalised company name (lowercase, alphanumeric only) */
  normalisedName: string;
  /** Best display name across sources */
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
  /** Number of independent sources that contributed to this entry */
  sourceCount: number;
  /** "high" = 2+ agreeing sources; "medium" = 1 structured source; "low" = sources diverged */
  confidence: "high" | "medium" | "low";
  /** Which sources contributed */
  sources: string[];
  /** ISO timestamp of last successful refresh */
  lastUpdatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY CACHE
// ─────────────────────────────────────────────────────────────────────────────

const gmpCache = new Map<string, GmpCacheEntry>();
let lastRefreshAt: string | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// NORMALISATION
// ─────────────────────────────────────────────────────────────────────────────

function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|pvt|private|inc|corp|corporation|llp|ipo)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function parseRupees(raw: string): number {
  const n = parseFloat(raw.replace(/[₹,\s]/g, "").trim());
  return isNaN(n) ? 0 : n;
}

function parsePercent(raw: string): number {
  const n = parseFloat(raw.replace(/[%\s]/g, "").trim());
  return isNaN(n) ? 0 : n;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 1 — IndianAPI /ipo/v2  (authenticated JSON — most reliable)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchFromIndianApi(): Promise<RawGmpReading[]> {
  if (!indianApiService.isReady()) {
    logger.warn("[IpoGmpRefresh] IndianAPI not configured — skipping source 1");
    return [];
  }
  try {
    // Fetch both open and upcoming IPOs
    const [openRes, upcomingRes] = await Promise.all([
      indianApiService.getIPOv2("open"),
      indianApiService.getIPOv2("upcoming"),
    ]);

    const readings: RawGmpReading[] = [];
    const ipos = [
      ...(openRes.success && Array.isArray(openRes.data) ? openRes.data : []),
      ...(upcomingRes.success && Array.isArray(upcomingRes.data) ? upcomingRes.data : []),
    ];

    for (const ipo of ipos) {
      if (!ipo.gmp || !ipo.company_name) continue;
      const issuePrice = ipo.cut_off_price ?? ipo.price_band_max ?? ipo.issue_price ?? 0;
      const gmpAbs = Number(ipo.gmp);
      const gmpPct = issuePrice > 0 ? parseFloat(((gmpAbs / issuePrice) * 100).toFixed(2)) : 0;
      readings.push({
        source: "indian_api",
        rawName: ipo.company_name,
        issuePrice: Number(issuePrice),
        gmpAbsolute: gmpAbs,
        gmpPercent: gmpPct,
        estimatedListingPrice: Number(issuePrice) + gmpAbs,
        status: ipo.status ?? "open",
      });
    }
    logger.info(`[IpoGmpRefresh] Source 1 (IndianAPI): ${readings.length} entries`, {
      event: "IPO_GMP_SOURCE_INDIANAPI", latency_ms: 0, status: "ok", user_id: "system",
    });
    return readings;
  } catch (err: any) {
    logger.warn(`[IpoGmpRefresh] IndianAPI error: ${err?.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 2 — investorgain.com  (HTML scrape)
// ─────────────────────────────────────────────────────────────────────────────

const INVESTORGAIN_URL = "https://investorgain.com/report/live-ipo-gmp/673/";

function parseInvestorGainHtml(html: string): RawGmpReading[] {
  const rows: RawGmpReading[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").trim();
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const localTd = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = localTd.exec(trMatch[1])) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }
    if (cells.length < 5) continue;

    const rawName = cells[0]?.replace(/\bipo\b/gi, "").trim();
    if (!rawName || rawName.length < 3) continue;

    const estListing  = parseRupees(cells[1] ?? "");
    const issuePrice  = parseRupees(cells[2] ?? "");
    const gmpAbsolute = parseRupees(cells[3] ?? "");
    const gmpPercent  = parsePercent(cells[4] ?? "");
    const status      = cells[cells.length - 1]?.trim() || "Open";

    if (issuePrice <= 0 && estListing <= 0) continue;

    const effIssue   = issuePrice > 0 ? issuePrice : estListing - gmpAbsolute;
    const effListing = estListing  > 0 ? estListing : effIssue + gmpAbsolute;
    const effGmpPct  = gmpPercent !== 0 ? gmpPercent
      : effIssue > 0 ? parseFloat(((gmpAbsolute / effIssue) * 100).toFixed(2)) : 0;

    rows.push({
      source: "investorgain",
      rawName,
      issuePrice: effIssue,
      gmpAbsolute,
      gmpPercent: effGmpPct,
      estimatedListingPrice: effListing,
      status,
    });
  }
  return rows;
}

async function fetchFromInvestorGain(): Promise<RawGmpReading[]> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const res = await fetch(INVESTORGAIN_URL, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html", "Accept-Language": "en-IN,en;q=0.9" },
    });
    clearTimeout(tid);
    if (!res.ok) {
      logger.warn(`[IpoGmpRefresh] investorgain.com HTTP ${res.status}`);
      return [];
    }
    const rows = parseInvestorGainHtml(await res.text());
    logger.info(`[IpoGmpRefresh] Source 2 (InvestorGain): ${rows.length} entries`, {
      event: "IPO_GMP_SOURCE_INVESTORGAIN", latency_ms: 0, status: "ok", user_id: "system",
    });
    return rows;
  } catch (err: any) {
    clearTimeout(tid);
    logger.warn(`[IpoGmpRefresh] investorgain.com error: ${err?.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE 3 — ipowatch.in  (HTML scrape, secondary fallback)
// ─────────────────────────────────────────────────────────────────────────────

const IPOWATCH_URL = "https://www.ipowatch.in/ipo-gmp/";

function parseIpoWatchHtml(html: string): RawGmpReading[] {
  const rows: RawGmpReading[] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const localTd = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = localTd.exec(trMatch[1])) !== null) {
      cells.push(stripTags(tdMatch[1]));
    }
    // ipowatch columns: IPO Name | Price | GMP | Est Listing | %Gain | Status
    if (cells.length < 4) continue;

    const rawName = cells[0]?.replace(/\bipo\b/gi, "").trim();
    if (!rawName || rawName.length < 3) continue;

    const issuePrice  = parseRupees(cells[1] ?? "");
    const gmpAbsolute = parseRupees(cells[2] ?? "");
    const estListing  = parseRupees(cells[3] ?? "");
    const gmpPercent  = parsePercent(cells[4] ?? "");
    const status      = cells[5]?.trim() || "Open";

    if (issuePrice <= 0 && estListing <= 0) continue;

    const effIssue   = issuePrice > 0 ? issuePrice : estListing - gmpAbsolute;
    const effListing = estListing  > 0 ? estListing : effIssue + gmpAbsolute;
    const effGmpPct  = gmpPercent !== 0 ? gmpPercent
      : effIssue > 0 ? parseFloat(((gmpAbsolute / effIssue) * 100).toFixed(2)) : 0;

    rows.push({
      source: "ipowatch",
      rawName,
      issuePrice: effIssue,
      gmpAbsolute,
      gmpPercent: effGmpPct,
      estimatedListingPrice: effListing,
      status,
    });
  }
  return rows;
}

async function fetchFromIpoWatch(): Promise<RawGmpReading[]> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const res = await fetch(IPOWATCH_URL, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT, "Accept": "text/html", "Accept-Language": "en-IN,en;q=0.9" },
    });
    clearTimeout(tid);
    if (!res.ok) {
      logger.warn(`[IpoGmpRefresh] ipowatch.in HTTP ${res.status}`);
      return [];
    }
    const rows = parseIpoWatchHtml(await res.text());
    logger.info(`[IpoGmpRefresh] Source 3 (IpoWatch): ${rows.length} entries`, {
      event: "IPO_GMP_SOURCE_IPOWATCH", latency_ms: 0, status: "ok", user_id: "system",
    });
    return rows;
  } catch (err: any) {
    clearTimeout(tid);
    logger.warn(`[IpoGmpRefresh] ipowatch.in error: ${err?.message}`);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CROSS-VALIDATION & MERGE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Merges readings from all sources into a single deduplicated, validated entry per IPO.
 *
 * Strategy:
 *   - Group readings by normalised company name (fuzzy match within group)
 *   - If 2+ sources agree within GMP_CONSENSUS_TOLERANCE → weighted avg, confidence=high
 *   - If sources diverge → use conservative (lower |gmp|), confidence=low
 *   - Single source → confidence=medium (unless it is IndianAPI, which gets "medium" too)
 */
function mergeAndValidate(allReadings: RawGmpReading[]): GmpCacheEntry[] {
  // Group by normalised name — use a Map of normKey → RawGmpReading[]
  const grouped = new Map<string, { readings: RawGmpReading[]; bestRawName: string }>();

  for (const r of allReadings) {
    const key = normaliseName(r.rawName);
    if (!key || key.length < 3) continue;

    // Try to merge into an existing group if names are very similar (substring match)
    let matched = false;
    for (const [gKey, group] of grouped.entries()) {
      if (key === gKey || key.includes(gKey) || gKey.includes(key)) {
        group.readings.push(r);
        // Prefer the longer / more complete name (usually from IndianAPI)
        if (r.rawName.length > group.bestRawName.length) group.bestRawName = r.rawName;
        matched = true;
        break;
      }
    }
    if (!matched) {
      grouped.set(key, { readings: [r], bestRawName: r.rawName });
    }
  }

  const result: GmpCacheEntry[] = [];
  const now = new Date().toISOString();

  for (const [normKey, { readings, bestRawName }] of grouped.entries()) {
    if (readings.length === 0) continue;

    const sources = [...new Set(readings.map((r) => r.source))];

    if (readings.length === 1) {
      // Single source — use as-is, confidence = "medium"
      const r = readings[0];
      result.push({
        normalisedName: normKey,
        rawName: bestRawName,
        issuePrice: r.issuePrice,
        gmpAbsolute: r.gmpAbsolute,
        gmpPercent: r.gmpPercent,
        estimatedListingPrice: r.estimatedListingPrice,
        status: r.status,
        sourceCount: 1,
        confidence: "medium",
        sources,
        lastUpdatedAt: now,
      });
      continue;
    }

    // Multiple sources — cross-validate
    const gmps = readings.map((r) => r.gmpAbsolute);
    const minGmp = Math.min(...gmps);
    const maxGmp = Math.max(...gmps);
    const avgGmp = gmps.reduce((a, b) => a + b, 0) / gmps.length;
    const referenceIssuePrice = readings.find((r) => r.issuePrice > 0)?.issuePrice ?? 0;

    // Check if sources agree within tolerance
    const divergence = referenceIssuePrice > 0
      ? Math.abs(maxGmp - minGmp) / referenceIssuePrice
      : (maxGmp - minGmp) / (Math.abs(avgGmp) || 1);

    let finalGmp: number;
    let confidence: "high" | "medium" | "low";

    if (divergence <= GMP_CONSENSUS_TOLERANCE) {
      // Sources agree — use weighted average (IndianAPI gets 2x weight)
      let weightedSum = 0;
      let totalWeight = 0;
      for (const r of readings) {
        const weight = r.source === "indian_api" ? 2 : 1;
        weightedSum += r.gmpAbsolute * weight;
        totalWeight += weight;
      }
      finalGmp = parseFloat((weightedSum / totalWeight).toFixed(2));
      confidence = "high";
    } else {
      // Sources diverge — use conservative (lower absolute GMP) to avoid misleading users
      finalGmp = readings.reduce((best, r) =>
        Math.abs(r.gmpAbsolute) < Math.abs(best.gmpAbsolute) ? r : best
      ).gmpAbsolute;
      confidence = "low";
      logger.warn(
        `[IpoGmpRefresh] GMP divergence for "${bestRawName}": min=${minGmp} max=${maxGmp} divergence=${(divergence * 100).toFixed(1)}% → using conservative=${finalGmp}`,
        { event: "IPO_GMP_DIVERGENCE", latency_ms: 0, status: "warn", user_id: "system" }
      );
    }

    // Use issue price from IndianAPI preferentially, then any other source
    const issuePrice = readings.find((r) => r.source === "indian_api")?.issuePrice
      ?? readings.find((r) => r.issuePrice > 0)?.issuePrice ?? 0;
    const gmpPct = issuePrice > 0
      ? parseFloat(((finalGmp / issuePrice) * 100).toFixed(2))
      : readings.find((r) => r.gmpPercent !== 0)?.gmpPercent ?? 0;
    const estListing = issuePrice + finalGmp;
    const status = readings.find((r) => r.source === "indian_api")?.status
      ?? readings[0].status;

    result.push({
      normalisedName: normKey,
      rawName: bestRawName,
      issuePrice,
      gmpAbsolute: finalGmp,
      gmpPercent: gmpPct,
      estimatedListingPrice: estListing,
      status,
      sourceCount: sources.length,
      confidence,
      sources,
      lastUpdatedAt: now,
    });
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// DB PERSIST
// ─────────────────────────────────────────────────────────────────────────────

async function persistGmpToDb(entries: GmpCacheEntry[]): Promise<number> {
  let updated = 0;
  for (const e of entries) {
    try {
      const result = await db.execute(sql`
        UPDATE pre_ipo_companies
        SET
          expected_returns = ${e.gmpPercent},
          updated_at       = NOW()
        WHERE
          ipo_status NOT IN ('listed', 'withdrawn')
          AND LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]', '', 'g'))
              LIKE ${'%' + e.normalisedName + '%'}
      `);
      updated += (result as any).rowCount ?? 0;
    } catch (err: any) {
      logger.warn(`[IpoGmpRefresh] DB update error for "${e.rawName}": ${err?.message}`);
    }
  }
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Looks up live GMP for a company by name.
 * Tries exact → substring match. Returns undefined if cache is empty or no match.
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
 * Returns the full cache snapshot — useful for admin/debug endpoints.
 */
export function getGmpCacheSnapshot(): { entries: GmpCacheEntry[]; lastRefreshAt: string | null } {
  return { entries: Array.from(gmpCache.values()), lastRefreshAt };
}

/**
 * Runs one full GMP refresh cycle:
 *   1. Fetch from all 3 sources in parallel (with independent timeouts)
 *   2. Cross-validate and merge
 *   3. Populate in-memory cache
 *   4. Persist to DB (best-effort)
 */
export async function runGmpRefresh(): Promise<{ scraped: number; dbUpdated: number; cached: number; sources: Record<string, number> }> {
  const t0 = Date.now();
  logger.info("[IpoGmpRefresh] Starting multi-source GMP refresh", {
    event: "IPO_GMP_REFRESH_START", latency_ms: 0, status: "starting", user_id: "system",
  });

  // Fetch all sources in parallel — each is independently fault-tolerant
  const [s1, s2, s3] = await Promise.all([
    fetchFromIndianApi(),
    fetchFromInvestorGain(),
    fetchFromIpoWatch(),
  ]);

  const sourceCounts = { indian_api: s1.length, investorgain: s2.length, ipowatch: s3.length };
  const allReadings = [...s1, ...s2, ...s3];

  if (allReadings.length === 0) {
    logger.warn("[IpoGmpRefresh] All sources returned 0 entries — skipping update", {
      event: "IPO_GMP_REFRESH_ALL_EMPTY", latency_ms: Date.now() - t0, status: "empty", user_id: "system",
    });
    return { scraped: 0, dbUpdated: 0, cached: gmpCache.size, sources: sourceCounts };
  }

  // Cross-validate and merge
  const merged = mergeAndValidate(allReadings);

  // Populate cache
  for (const entry of merged) {
    gmpCache.set(entry.normalisedName, entry);
  }
  lastRefreshAt = new Date().toISOString();

  const highConf = merged.filter((e) => e.confidence === "high").length;
  const lowConf  = merged.filter((e) => e.confidence === "low").length;

  // Persist to DB (best-effort)
  let dbUpdated = 0;
  try { dbUpdated = await persistGmpToDb(merged); } catch (err: any) {
    logger.warn(`[IpoGmpRefresh] DB persist error (non-fatal): ${err?.message}`);
  }

  logger.info(
    `[IpoGmpRefresh] Done: raw=${allReadings.length} merged=${merged.length} high=${highConf} low=${lowConf} dbUpdated=${dbUpdated} latency=${Date.now() - t0}ms`,
    { event: "IPO_GMP_REFRESH_DONE", latency_ms: Date.now() - t0, status: "ok", user_id: "system" }
  );

  return { scraped: allReadings.length, dbUpdated, cached: gmpCache.size, sources: sourceCounts };
}

/**
 * Starts the recurring GMP refresh scheduler (every 4 hours).
 * Call once from background-schedulers.ts.
 */
export function startIpoGmpRefreshScheduler(): void {
  runGmpRefresh().catch((err) => logger.warn(`[IpoGmpRefresh] Initial run error: ${err?.message}`));

  setInterval(() => {
    runGmpRefresh().catch((err) => logger.warn(`[IpoGmpRefresh] Periodic run error: ${err?.message}`));
  }, FOUR_HOURS_MS);

  logger.info("[IpoGmpRefresh] Multi-source scheduler started — refreshes every 4h (IndianAPI + InvestorGain + IpoWatch)", {
    event: "IPO_GMP_SCHEDULER_START", latency_ms: 0, status: "ok", user_id: "system",
  });
}
