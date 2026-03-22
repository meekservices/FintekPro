/**
 * FintekPro Prospect Scoring Engine  v1.1
 *
 * Four-component model:
 *   Composite = 0.30 × WealthScore + 0.20 × ActivityScore + 0.30 × RelationshipScore + 0.20 × FinancialHealthScore
 *
 * ── Upgrade 1:  Auto-classify leadQuality (hot/warm/cold) from compositeScore
 * ── Upgrade 3:  Derive investable_surplus = estimatedNetworth × 15%
 * ── Upgrade 4:  DIN-based multi-company director wealth lookup via CredHive
 * ── Upgrade 7:  Append every run to prospect_score_history (audit trail)
 * ── Upgrade 8:  Sector benchmarking helpers exported for the routes layer
 */

import { db } from "../db";
import { prospectLeads, prospectScoreHistory } from "@shared/schema";
import { eq, isNotNull, avg, sql } from "drizzle-orm";
import { credhiveAdapter } from "./vendor-adapters/credhive.adapter";
import { credhiveService } from "./credhive-service";

const SCORING_VERSION = "v1.1";

// ── Wealth Engine ─────────────────────────────────────────────────────────────

export interface DirectorCompany {
  name: string;
  cin?: string | null;
  revenue?: number | null;
  holdingPercent?: number | null;
}

/**
 * Fetch a richer directorship picture for a prospect via CredHive.
 *
 * Strategy (best-effort, non-fatal):
 *  1. Fetch the prospect company's director list (includes DIN).
 *  2. For each director that has associated company CINs embedded in the
 *     enrichment data (group companies / related entities), resolve their
 *     financials via credhiveService.enrichDirectorCompanyData().
 *  3. Fall back to the stored directors JSON if CredHive is unavailable.
 */
async function fetchDirectorCompanies(
  cin: string,
  storedDirectors: any[] | null,
  prospectRevenue: number | null
): Promise<DirectorCompany[]> {
  const companies: DirectorCompany[] = [];

  // Primary: try CredHive director enrichment
  if (cin) {
    try {
      const dirResp = await credhiveService.getDirectors(cin);
      if (dirResp.success && Array.isArray(dirResp.data)) {
        for (const dir of dirResp.data.filter((d) => d.is_active)) {
          // Each director is assumed to hold equity in THIS company
          companies.push({
            name: dir.name,
            cin,
            revenue: prospectRevenue,
            holdingPercent: null, // unknown → will default to 25%
          });

          // If the director record carries other associated CINs, resolve each
          const associatedCins: string[] = Array.isArray(dir.associated_cins)
            ? dir.associated_cins
            : [];
          for (const assocCin of associatedCins.slice(0, 5)) {
            try {
              const enriched = await credhiveService.enrichDirectorCompanyData(assocCin);
              if (enriched?.revenue) {
                companies.push({
                  name: enriched.companyName || assocCin,
                  cin: assocCin,
                  revenue: enriched.revenue,
                  holdingPercent: null,
                });
              }
            } catch {
              // non-fatal
            }
          }
        }
      }
    } catch {
      // CredHive unavailable — fall through to stored directors
    }
  }

  // Fallback: use the stored directors JSON from the prospect_leads row
  if (companies.length === 0 && storedDirectors && storedDirectors.length > 0) {
    for (const d of storedDirectors) {
      companies.push({
        name: d.name ?? "Unknown",
        cin,
        revenue: prospectRevenue,
        holdingPercent: null,
      });
    }
  }

  return companies;
}

/**
 * Calculate estimated net worth for a director across their companies.
 * Uses a conservative 3× revenue multiple (unlisted-company proxy valuation).
 * Falls back to annualRevenue × 3 × 50% when no directorship data is available.
 */
export function calculateWealthFromDirectorships(
  companies: DirectorCompany[],
  fallbackRevenue?: number | null
): number {
  if (!companies || companies.length === 0) {
    if (fallbackRevenue) return fallbackRevenue * 3 * 0.5;
    return 0;
  }
  let totalNetworth = 0;
  for (const c of companies) {
    const revenue = c.revenue ?? 0;
    const holdingPct = c.holdingPercent ?? 25; // conservative default
    totalNetworth += revenue * 3 * (holdingPct / 100);
  }
  return totalNetworth;
}

// ── Lead Quality Classification ───────────────────────────────────────────────

/** Upgrade 1: Derive leadQuality from composite score */
function deriveLeadQuality(compositeScore: number): "hot" | "warm" | "cold" {
  if (compositeScore >= 65) return "hot";
  if (compositeScore >= 35) return "warm";
  return "cold";
}

// ── Scoring Engine ────────────────────────────────────────────────────────────

export interface ProspectScoreInput {
  networth: number;
  directorships: DirectorCompany[];
  relationshipStrength?: number;
  probe42Score?: number | null;
  creditRating?: string | null;
  openChargesCount?: number | null;
  activeLegalCases?: number | null;
}

export interface ProspectScoreResult {
  wealthScore: number;
  activityScore: number;
  relationshipScore: number;
  financialHealthScore: number;
  compositeScore: number;
  estimatedNetworth: number;
  investableSurplus: number;
  leadQuality: "hot" | "warm" | "cold";
  scoringVersion: string;
  breakdown: {
    wealthWeight: number;
    activityWeight: number;
    relationshipWeight: number;
    financialHealthWeight: number;
  };
}

function creditRatingToScore(rating: string | null | undefined): number {
  if (!rating) return 50;
  const r = rating.toUpperCase();
  if (r.startsWith("AAA")) return 95;
  if (r.startsWith("AA+")) return 90;
  if (r.startsWith("AA-")) return 80;
  if (r.startsWith("AA")) return 85;
  if (r.startsWith("A+")) return 75;
  if (r.startsWith("A-")) return 65;
  if (r.startsWith("A")) return 70;
  if (r.startsWith("BBB+")) return 60;
  if (r.startsWith("BBB")) return 55;
  if (r.startsWith("BB")) return 40;
  if (r.startsWith("B")) return 30;
  if (r.startsWith("C") || r.startsWith("D")) return 10;
  return 50;
}

export function scoreProspect(data: ProspectScoreInput): ProspectScoreResult {
  const wealthScore = Math.min(data.networth / 1_000_000_000, 1) * 100;
  const activityScore = Math.min(data.directorships.length * 10, 100);
  const relationshipScore = data.relationshipStrength ?? 50;

  let financialHealthScore = 50;
  if (data.probe42Score != null) {
    financialHealthScore = (data.probe42Score / 5) * 100;
  } else if (data.creditRating) {
    financialHealthScore = creditRatingToScore(data.creditRating);
  }
  if (data.openChargesCount && data.openChargesCount > 5) financialHealthScore -= 10;
  if (data.activeLegalCases && data.activeLegalCases > 0) financialHealthScore -= 15;
  financialHealthScore = Math.max(0, Math.min(100, financialHealthScore));

  const compositeScore = parseFloat(
    Math.min(
      100,
      0.3 * wealthScore + 0.2 * activityScore + 0.3 * relationshipScore + 0.2 * financialHealthScore
    ).toFixed(2)
  );

  const investableSurplus = parseFloat((data.networth * 0.15).toFixed(2)); // Upgrade 3

  return {
    wealthScore: parseFloat(wealthScore.toFixed(2)),
    activityScore: parseFloat(activityScore.toFixed(2)),
    relationshipScore: parseFloat(relationshipScore.toFixed(2)),
    financialHealthScore: parseFloat(financialHealthScore.toFixed(2)),
    compositeScore,
    estimatedNetworth: parseFloat(data.networth.toFixed(2)),
    investableSurplus,
    leadQuality: deriveLeadQuality(compositeScore), // Upgrade 1
    scoringVersion: SCORING_VERSION,
    breakdown: { wealthWeight: 0.3, activityWeight: 0.2, relationshipWeight: 0.3, financialHealthWeight: 0.2 },
  };
}

// ── Prospect Enrichment via CredHive ─────────────────────────────────────────

export async function enrichAndScoreProspect(
  prospectId: string,
  options: { relationshipStrength?: number; triggeredBy?: string } = {}
): Promise<ProspectScoreResult> {
  const rows = await db.select().from(prospectLeads).where(eq(prospectLeads.id, prospectId)).limit(1);
  if (!rows.length) throw new Error(`Prospect ${prospectId} not found`);
  const lead = rows[0];

  const fallbackRevenue = lead.annualRevenue ? parseFloat(String(lead.annualRevenue)) : null;

  // Upgrade 4: DIN-based multi-company lookup
  const directorCompanies = await fetchDirectorCompanies(
    lead.cin ?? "",
    lead.directors as any[] | null,
    fallbackRevenue
  );

  const estimatedNetworth = calculateWealthFromDirectorships(directorCompanies, fallbackRevenue);

  const result = scoreProspect({
    networth: estimatedNetworth,
    directorships: directorCompanies,
    relationshipStrength: options.relationshipStrength,
    probe42Score: lead.probe42Score,
    creditRating: lead.creditRating,
    openChargesCount: lead.openChargesCount,
    activeLegalCases: lead.activeLegalCases,
  });

  const previousQuality = lead.leadQuality;

  // Persist scores + auto-update lead quality + investable surplus (Upgrades 1 & 3)
  await db
    .update(prospectLeads)
    .set({
      estimatedNetworth: String(result.estimatedNetworth),
      wealthScore: String(result.wealthScore),
      activityScore: String(result.activityScore),
      relationshipScore: String(result.relationshipScore),
      compositeScore: String(result.compositeScore),
      scoringVersion: result.scoringVersion,
      scoredAt: new Date(),
      leadQuality: result.leadQuality,              // Upgrade 1
      investableSurplus: String(result.investableSurplus), // Upgrade 3
      updatedAt: new Date(),
    })
    .where(eq(prospectLeads.id, prospectId));

  // Upgrade 7: Append to audit history
  await db.insert(prospectScoreHistory).values({
    prospectId,
    compositeScore: String(result.compositeScore),
    wealthScore: String(result.wealthScore),
    activityScore: String(result.activityScore),
    relationshipScore: String(result.relationshipScore),
    financialHealthScore: String(result.financialHealthScore),
    estimatedNetworth: String(result.estimatedNetworth),
    investableSurplus: String(result.investableSurplus),
    leadQualityBefore: previousQuality,
    leadQualityAfter: result.leadQuality,
    scoringVersion: result.scoringVersion,
    triggeredBy: options.triggeredBy ?? "manual",
  } as any);

  return result;
}

// ── Bulk Scoring ──────────────────────────────────────────────────────────────

export async function bulkScoreProspects(options: {
  limit?: number;
  staleAfterDays?: number;
  relationshipStrength?: number;
  triggeredBy?: string;
} = {}): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
  const { limit = 50, staleAfterDays, relationshipStrength, triggeredBy = "bulk" } = options;
  const { or, isNull, lt: ltDrizzle } = await import("drizzle-orm");

  // Build filter: unscored OR scored more than staleAfterDays ago
  const staleThreshold = staleAfterDays
    ? new Date(Date.now() - staleAfterDays * 24 * 60 * 60 * 1000)
    : null;

  const whereClause = staleThreshold
    ? or(isNull(prospectLeads.scoredAt), ltDrizzle(prospectLeads.scoredAt, staleThreshold))
    : isNull(prospectLeads.scoredAt); // default: only unscored leads

  const leads = await db
    .select({ id: prospectLeads.id, companyName: prospectLeads.companyName })
    .from(prospectLeads)
    .where(whereClause)
    .limit(limit);

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    try {
      await enrichAndScoreProspect(lead.id, { relationshipStrength, triggeredBy });
      succeeded++;
    } catch (err: any) {
      failed++;
      errors.push(`${lead.companyName}: ${err.message}`);
    }
  }

  return { processed: leads.length, succeeded, failed, errors };
}

// ── Upgrade 8: Sector Benchmarking ────────────────────────────────────────────

export interface SectorBenchmark {
  industrySegment: string;
  avgCompositeScore: number;
  avgWealthScore: number;
  avgActivityScore: number;
  avgRelationshipScore: number;
  count: number;
}

// ── Sector benchmark cache (5-minute TTL) ────────────────────────────────────
let _benchmarkCache: { data: SectorBenchmark[]; expiresAt: number } | null = null;
const BENCHMARK_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Compute average scores per industry segment from existing scored leads */
export async function getSectorBenchmarks(): Promise<SectorBenchmark[]> {
  const now = Date.now();
  if (_benchmarkCache && now < _benchmarkCache.expiresAt) {
    return _benchmarkCache.data;
  }

  const rows = await db
    .select({
      industrySegment: prospectLeads.industrySegment,
      avgComposite: avg(prospectLeads.compositeScore),
      avgWealth: avg(prospectLeads.wealthScore),
      avgActivity: avg(prospectLeads.activityScore),
      avgRelationship: avg(prospectLeads.relationshipScore),
      count: sql<number>`COUNT(*)::int`,
    })
    .from(prospectLeads)
    .where(isNotNull(prospectLeads.compositeScore))
    .groupBy(prospectLeads.industrySegment);

  const data = rows
    .filter((r) => r.industrySegment)
    .map((r) => ({
      industrySegment: r.industrySegment!,
      avgCompositeScore: parseFloat(String(r.avgComposite || "0")),
      avgWealthScore: parseFloat(String(r.avgWealth || "0")),
      avgActivityScore: parseFloat(String(r.avgActivity || "0")),
      avgRelationshipScore: parseFloat(String(r.avgRelationship || "0")),
      count: Number(r.count),
    }));

  _benchmarkCache = { data, expiresAt: now + BENCHMARK_CACHE_TTL_MS };
  return data;
}

/** Bust the benchmark cache — call after any bulk scoring run */
export function bustBenchmarkCache(): void {
  _benchmarkCache = null;
}

/** Get the benchmark for a single industry segment */
export async function getBenchmarkForSegment(segment: string): Promise<SectorBenchmark | null> {
  const benchmarks = await getSectorBenchmarks();
  return benchmarks.find((b) => b.industrySegment === segment) ?? null;
}

export { SCORING_VERSION };
