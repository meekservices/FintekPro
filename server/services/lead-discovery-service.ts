/**
 * Lead Discovery Service v1.0
 *
 * Orchestrates nightly B2B lead discovery via Explorium API.
 * Pipeline:
 *   1. Call Explorium with FintekPro ICP filters
 *   2. Deduplicate against existing prospectLeads (by company name + city)
 *   3. Bulk enrich new companies (firmographics, signals)
 *   4. Score using existing prospect-scoring-engine
 *   5. Upsert to prospectLeads table (source: 'explorium')
 *
 * Daily budget: 200 new leads. Paginated in batches of 100 (2 API calls).
 *
 * Architecture: /services layer — Drizzle ORM only, no routes.
 * FASP-AI: { event, latency_ms, status } logged for every run.
 * Self-Healing: Per-company errors are non-fatal; run continues.
 */

import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { sql, or, eq } from "drizzle-orm";
import {
  discoverCompanies,
  bulkEnrichBusinesses,
  buildFintekProICP,
  ExploriumBusiness,
  ExploriumEnrichment,
} from "./explorium-service";
import { logger } from "../logger";

// ── Config ────────────────────────────────────────────────────────────────────

const DAILY_DISCOVERY_TARGET = 200;
const BATCH_SIZE = 100;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DiscoveryRunResult {
  discovered: number;
  ingested: number;
  duplicates: number;
  errors: number;
  latencyMs: number;
}

// ── Scoring Helpers ───────────────────────────────────────────────────────────

function deriveLeadQuality(enrichment: ExploriumEnrichment | null, business: ExploriumBusiness): string {
  if (!enrichment) return "cold";

  const signals = enrichment.signals ?? [];
  const hasFunding = signals.some((s) => s.signal_type === "funding_round");
  const headcountTrend = enrichment.workforce?.headcount_trend;
  const empCount = enrichment.firmographics?.employee_count ?? business.employee_count ?? 0;
  const revenue = enrichment.financials?.revenue ?? 0;

  if (hasFunding || headcountTrend === "growing" || revenue > 50_000_000) return "hot";
  if (empCount >= 100 || revenue > 5_000_000) return "warm";
  return "cold";
}

function deriveLeadScore(quality: string, enrichment: ExploriumEnrichment | null): number {
  const base: Record<string, number> = { hot: 75, warm: 50, cold: 20 };
  let score = base[quality] ?? 20;

  if (!enrichment) return score;

  // Boost for tech signals
  const techs = enrichment.technographics?.technologies ?? [];
  if (techs.length > 5) score += 5;

  // Boost for recent funding
  const signals = enrichment.signals ?? [];
  if (signals.some((s) => s.signal_type === "funding_round")) score += 10;

  return Math.min(100, score);
}

function buildProspectLeadValues(
  business: ExploriumBusiness,
  enrichment: ExploriumEnrichment | null,
) {
  const quality = deriveLeadQuality(enrichment, business);
  const score = deriveLeadScore(quality, enrichment);

  return {
    companyName: business.name,
    website: business.website ?? enrichment?.firmographics ? undefined : undefined,
    city: business.city ?? enrichment?.firmographics?.hq_city,
    state: business.state ?? enrichment?.firmographics?.hq_state,
    industrySegment: business.industry ?? enrichment?.firmographics?.industry,
    companyType: enrichment?.firmographics?.company_type,
    employeeCount: business.employee_count ?? enrichment?.firmographics?.employee_count,
    annualRevenue: enrichment?.financials?.revenue
      ? String(enrichment.financials.revenue)
      : null,
    leadQuality: quality,
    leadScore: score,
    source: "explorium" as const,
    status: "new" as const,
    enrichmentData: enrichment
      ? {
          explorium_business_id: business.business_id,
          firmographics: enrichment.firmographics,
          financials: enrichment.financials,
          technographics: enrichment.technographics,
          signals: enrichment.signals,
          enrichedAt: new Date().toISOString(),
        }
      : { explorium_business_id: business.business_id },
    enrichedAt: new Date(),
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Filter out companies already in prospectLeads.
 * Matches by: company name (case-insensitive) OR Explorium business_id in enrichmentData.
 */
async function deduplicateBusinesses(
  businesses: ExploriumBusiness[],
): Promise<{ newBusinesses: ExploriumBusiness[]; duplicateCount: number }> {
  if (businesses.length === 0) return { newBusinesses: [], duplicateCount: 0 };

  // Check by company names (batch)
  const names = businesses.map((b) => b.name.toLowerCase());

  const existing = await db
    .select({ companyName: prospectLeads.companyName, enrichmentData: prospectLeads.enrichmentData })
    .from(prospectLeads)
    .where(sql`LOWER(company_name) = ANY(${names})`);

  const existingNames = new Set(existing.map((r) => r.companyName?.toLowerCase()));
  const existingIds = new Set(
    existing
      .map((r) => (r.enrichmentData as any)?.explorium_business_id)
      .filter(Boolean),
  );

  const newBusinesses = businesses.filter(
    (b) =>
      !existingNames.has(b.name.toLowerCase()) &&
      !existingIds.has(b.business_id),
  );

  return { newBusinesses, duplicateCount: businesses.length - newBusinesses.length };
}

// ── Main Discovery Run ────────────────────────────────────────────────────────

/**
 * Discover, enrich, deduplicate, and ingest B2B leads for one nightly run.
 * Called by the cron at 2:00 AM IST.
 */
export async function discoverAndIngestLeadsNightly(
  target = DAILY_DISCOVERY_TARGET,
): Promise<DiscoveryRunResult> {
  const startMs = Date.now();
  const result: DiscoveryRunResult = {
    discovered: 0,
    ingested: 0,
    duplicates: 0,
    errors: 0,
    latencyMs: 0,
  };

  const icp = buildFintekProICP();
  let page = 1;
  let totalFetched = 0;

  while (totalFetched < target) {
    try {
      const batch = await discoverCompanies(icp, page, BATCH_SIZE);
      if (batch.businesses.length === 0) break;

      result.discovered += batch.businesses.length;
      totalFetched += batch.businesses.length;

      // Deduplication
      const { newBusinesses, duplicateCount } = await deduplicateBusinesses(batch.businesses);
      result.duplicates += duplicateCount;

      if (newBusinesses.length === 0) {
        page++;
        continue;
      }

      // Bulk enrich (batches of 50)
      const businessIds = newBusinesses.map((b) => b.business_id);
      let enrichments: ExploriumEnrichment[] = [];
      try {
        enrichments = await bulkEnrichBusinesses(businessIds);
      } catch {
        // Non-fatal — ingest without enrichment
        logger.warn("[LeadDiscovery] Bulk enrichment failed for batch — inserting with basic data");
      }

      const enrichmentMap = new Map<string, ExploriumEnrichment>();
      for (const e of enrichments) {
        enrichmentMap.set(e.business_id, e);
      }

      // Upsert to DB
      for (const business of newBusinesses) {
        try {
          const enrichment = enrichmentMap.get(business.business_id) ?? null;
          const values = buildProspectLeadValues(business, enrichment);

          await db
            .insert(prospectLeads)
            .values(values as any)
            .onConflictDoNothing();

          result.ingested++;
        } catch (err: any) {
          result.errors++;
          logger.error("[LeadDiscovery]", {
            event: "LEAD_INGEST_ERROR",
            company: business.name,
            error: err.message,
            retryable: true,
          });
        }
      }

      page++;
      if (batch.businesses.length < BATCH_SIZE) break; // Last page
    } catch (err: any) {
      result.errors++;
      logger.error("[LeadDiscovery]", { event: "LEAD_DISCOVERY_BATCH_ERROR", page, error: err.message, retryable: true });
      break;
    }
  }

  result.latencyMs = Date.now() - startMs;

  logger.info("[LeadDiscovery]", {
    event: "LEAD_DISCOVERY_NIGHTLY_COMPLETE",
    discovered: result.discovered,
    ingested: result.ingested,
    duplicates: result.duplicates,
    errors: result.errors,
    latency_ms: result.latencyMs,
    status: "success",
  });

  return result;
}
