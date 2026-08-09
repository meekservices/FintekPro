/**
 * @file isin-registry-service.ts
 * @description ISIN Equalizer — DB-level instrument identity resolution.
 *
 * Maps ISIN (ISO 6166) → all API-specific identifiers needed for enrichment:
 *   - amfiCode     → mfapi.in NAV fetch (Indian MF/ETF)
 *   - nseSymbol    → screener_derived_metrics (Indian stocks/ETFs)
 *   - cusip        → Alpha Vantage / Yahoo Finance (US instruments)
 *   - bloombergTicker → future Bloomberg/Refinitiv
 *
 * @compliance SEBI Reg 24 / ARN:
 *   amfiCode MUST be Regular Plan–Growth scheme codes.
 *   amfiCodeDirect is reference only; never used for NAV fetch.
 *
 * @caching In-memory LRU (max 1000, TTL 60 min).
 *
 * @inputs  ISIN string, AMFI code, or NSE symbol
 * @outputs ISINRecord or null if not found/inactive
 */

import { db } from "../db";
import { isinRegistry } from "../../shared/schema";
import type { ISINRegistryRecord } from "../../shared/schema";
import { eq, ilike, and } from "drizzle-orm";
import { logger } from "../logger";

// ── In-memory LRU cache ───────────────────────────────────────────────────────
interface CacheEntry { record: ISINRegistryRecord | null; expiresAt: number; }
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX    = 1_000;

function cacheGet(key: string): ISINRegistryRecord | null | undefined {
  const entry = _cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { _cache.delete(key); return undefined; }
  return entry.record;
}

function cacheSet(key: string, record: ISINRegistryRecord | null): void {
  if (_cache.size >= CACHE_MAX) {
    const firstKey = _cache.keys().next().value;
    if (firstKey) _cache.delete(firstKey);
  }
  _cache.set(key, { record, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateISINCache(): void {
  _cache.clear();
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up an instrument by ISIN.
 * Returns null if not found or inactive.
 *
 * @param isin ISO 6166 identifier (e.g. INF174K01RZ6, US46090E1038)
 * @returns ISINRegistryRecord or null
 * @edge_cases ISIN < 12 chars returns null immediately (invalid format)
 */
export async function lookupByISIN(isin: string): Promise<ISINRegistryRecord | null> {
  if (!isin || isin.length < 12) return null;
  const key = `isin:${isin.toUpperCase()}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const rows = await db
      .select()
      .from(isinRegistry)
      .where(and(eq(isinRegistry.isin, isin.toUpperCase()), eq(isinRegistry.isActive, true)))
      .limit(1);
    const record = rows[0] ?? null;
    cacheSet(key, record);
    return record;
  } catch (err) {
    logger.warn("[ISINRegistry] lookupByISIN failed", {
      event: "ISIN_LOOKUP_ERROR", user_id: "SYSTEM", latency_ms: 0, status: "warn",
      isin, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Look up an instrument by AMFI scheme code.
 * Useful for reverse-lookup (scheme code → ISIN → canonical name).
 *
 * @param amfiCode AMFI Regular Plan–Growth scheme code
 * @returns ISINRegistryRecord or null
 */
export async function lookupByAMFICode(amfiCode: number): Promise<ISINRegistryRecord | null> {
  if (!amfiCode) return null;
  const key = `amfi:${amfiCode}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const rows = await db
      .select()
      .from(isinRegistry)
      .where(and(eq(isinRegistry.amfiCode, amfiCode), eq(isinRegistry.isActive, true)))
      .limit(1);
    const record = rows[0] ?? null;
    cacheSet(key, record);
    return record;
  } catch (err) {
    logger.warn("[ISINRegistry] lookupByAMFICode failed", {
      event: "ISIN_AMFI_LOOKUP_ERROR", user_id: "SYSTEM", latency_ms: 0, status: "warn",
      amfiCode, error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Look up an instrument by NSE symbol.
 *
 * @param symbol NSE ticker (e.g. RELIANCE, NIFTYBEES)
 * @returns ISINRegistryRecord or null
 */
export async function lookupByNSESymbol(symbol: string): Promise<ISINRegistryRecord | null> {
  if (!symbol) return null;
  const key = `nse:${symbol.toUpperCase()}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  try {
    const rows = await db
      .select()
      .from(isinRegistry)
      .where(and(eq(isinRegistry.nseSymbol, symbol.toUpperCase()), eq(isinRegistry.isActive, true)))
      .limit(1);
    const record = rows[0] ?? null;
    cacheSet(key, record);
    return record;
  } catch {
    return null;
  }
}

/**
 * Search instruments by canonical name (case-insensitive partial match).
 * Used for admin UI, coverage reports, and autocomplete.
 *
 * @param query Partial name string (min 2 chars)
 * @param limit Max results (default 20)
 */
export async function searchByName(query: string, limit = 20): Promise<ISINRegistryRecord[]> {
  if (!query || query.length < 2) return [];
  try {
    return await db
      .select()
      .from(isinRegistry)
      .where(and(
        ilike(isinRegistry.canonicalName, `%${query}%`),
        eq(isinRegistry.isActive, true),
      ))
      .limit(limit);
  } catch {
    return [];
  }
}

/**
 * Upsert a single ISIN record (insert or update on conflict).
 * Use from admin API to add/fix instruments at runtime without redeploying.
 * Automatically invalidates all cache entries.
 *
 * @compliance Ensure amfiCode is Regular Plan–Growth before calling.
 * @param record Instrument record to upsert
 */
export async function upsertISINRecord(record: {
  isin: string;
  canonicalName: string;
  instrumentType: string;
  country?: string;
  currency?: string;
  amc?: string | null;
  amfiCode?: number | null;
  amfiCodeDirect?: number | null;
  nseSymbol?: string | null;
  bseCode?: number | null;
  cusip?: string | null;
  bloombergTicker?: string | null;
  planType?: string;
  sebiCategory?: string | null;
  expenseRatio?: number | null;
  isProxy?: boolean;
  proxyNote?: string | null;
  source?: string;
  notes?: string | null;
}): Promise<void> {
  const isin = record.isin.toUpperCase();
  const values = {
    isin,
    canonicalName:   record.canonicalName,
    instrumentType:  record.instrumentType,
    country:         record.country  ?? "IN",
    currency:        record.currency ?? "INR",
    amc:             record.amc            ?? null,
    amfiCode:        record.amfiCode       ?? null,
    amfiCodeDirect:  record.amfiCodeDirect ?? null,
    nseSymbol:       record.nseSymbol?.toUpperCase() ?? null,
    bseCode:         record.bseCode        ?? null,
    cusip:           record.cusip          ?? null,
    bloombergTicker: record.bloombergTicker ?? null,
    planType:        record.planType ?? "regular",
    sebiCategory:    record.sebiCategory   ?? null,
    expenseRatio:    record.expenseRatio != null ? String(record.expenseRatio) : null,
    isProxy:         record.isProxy  ?? false,
    proxyNote:       record.proxyNote ?? null,
    source:          record.source   ?? "manual",
    notes:           record.notes    ?? null,
    isActive:        true,
    updatedAt:       new Date(),
  };

  await db
    .insert(isinRegistry)
    .values(values)
    .onConflictDoUpdate({ target: isinRegistry.isin, set: { ...values } });

  invalidateISINCache();
  logger.info("[ISINRegistry] upsertISINRecord", {
    event: "ISIN_UPSERT", user_id: "SYSTEM", latency_ms: 0, status: "ok", isin,
  });
}

/**
 * Coverage report: aggregate stats on the isin_registry table.
 * Used by /api/instruments/stats admin endpoint.
 */
export async function getRegistryCoverage(): Promise<{
  total: number;
  active: number;
  withAmfiCode: number;
  withNseSymbol: number;
  withCusip: number;
  byCountry: Record<string, number>;
  byType:    Record<string, number>;
}> {
  try {
    const all    = await db.select().from(isinRegistry);
    const active = all.filter(r => r.isActive);
    const byCountry: Record<string, number> = {};
    const byType:    Record<string, number> = {};
    for (const r of active) {
      byCountry[r.country] = (byCountry[r.country] ?? 0) + 1;
      byType[r.instrumentType] = (byType[r.instrumentType] ?? 0) + 1;
    }
    return {
      total:         all.length,
      active:        active.length,
      withAmfiCode:  active.filter(r => r.amfiCode != null).length,
      withNseSymbol: active.filter(r => r.nseSymbol != null).length,
      withCusip:     active.filter(r => r.cusip != null).length,
      byCountry,
      byType,
    };
  } catch {
    return { total: 0, active: 0, withAmfiCode: 0, withNseSymbol: 0, withCusip: 0, byCountry: {}, byType: {} };
  }
}
