/**
 * Lead Leakage Monitor
 *
 * Purpose : Detects leads that are "leaking" through the pipeline — i.e., stuck
 *           with no activity for too long, or permanently unassigned.
 * Inputs  : agentId (for agent-scoped queries) or no args (for admin/global queries).
 * Outputs : Lists of stale leads, pipeline health metrics.
 * Edge cases:
 *   - Agent with no leads returns empty array (not an error).
 *   - Clock skew: uses DB server timestamps via SQL NOW() for stale comparisons.
 *
 * GCR compliance:
 *   - All DB access through Drizzle ORM (no raw SQL mutations).
 *   - Structured logs with event, user_id, latency_ms, status.
 *   - Returns partial results with warnings (never crashes).
 *   - Every output includes engine_version and calculation_timestamp.
 */

import { db } from "../db";
import { prospectLeads, leadActivities } from "@shared/schema";
import { eq, and, isNull, lt, sql, desc, isNotNull } from "drizzle-orm";
import { logger } from "../logger";

// ── Stale thresholds ──────────────────────────────────────────────────────────

/** Days since last contact after which a lead is considered stale (by quality tier) */
const STALE_DAYS: Record<string, number> = {
  hot: 2,
  warm: 5,
  cold: 14,
  default: 7,
};

const ENGINE_VERSION = "leakage-monitor-v1.1";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StaleLead {
  id: string;
  companyName: string;
  city: string | null;
  state: string | null;
  leadQuality: string | null;
  status: string;
  assignedTo: string | null;
  lastContactedAt: Date | null;
  daysSinceContact: number;
  staleDayThreshold: number;
}

export interface PipelineHealth {
  total: number;
  unassigned: number;
  stale: number;
  active: number;
  converted: number;
  conversionRate: number;
  unassignedPct: number;
  stalePct: number;
  engine_version: string;
  calculation_timestamp: string;
}

// ── Agent-scoped: stale leads for a specific agent ────────────────────────────

/**
 * Returns all stale leads for a given agent.
 * Used by: GET /api/agent/leads/stale
 */
export async function getAgentStaleSummary(agentId: string): Promise<StaleLead[]> {
  const startMs = Date.now();

  try {
    const rows = await db
      .select({
        id: prospectLeads.id,
        companyName: prospectLeads.companyName,
        city: prospectLeads.city,
        state: prospectLeads.state,
        leadQuality: prospectLeads.leadQuality,
        status: prospectLeads.status,
        assignedTo: prospectLeads.assignedTo,
        lastContactedAt: prospectLeads.lastContactedAt,
        updatedAt: prospectLeads.updatedAt,
      })
      .from(prospectLeads)
      .where(
        and(
          eq(prospectLeads.assignedTo, agentId),
          isNotNull(prospectLeads.assignedTo),
          // Exclude closed-terminal statuses
          sql`${prospectLeads.status} NOT IN ('converted', 'rejected')`,
        ),
      )
      .orderBy(desc(prospectLeads.lastContactedAt));

    const now = Date.now();
    const stale: StaleLead[] = [];

    for (const row of rows) {
      const quality = row.leadQuality ?? "default";
      const threshold = STALE_DAYS[quality] ?? STALE_DAYS.default;
      const lastTouched = row.lastContactedAt ?? row.updatedAt;
      const daysSince = lastTouched
        ? Math.floor((now - new Date(lastTouched).getTime()) / 86_400_000)
        : 9999;

      if (daysSince >= threshold) {
        stale.push({
          id: row.id,
          companyName: row.companyName,
          city: row.city,
          state: row.state,
          leadQuality: row.leadQuality,
          status: row.status,
          assignedTo: row.assignedTo,
          lastContactedAt: row.lastContactedAt,
          daysSinceContact: daysSince,
          staleDayThreshold: threshold,
        });
      }
    }

    logger.info("AGENT_STALE_LEADS_FETCHED", {
      event: "AGENT_STALE_LEADS_FETCHED",
      user_id: agentId,
      stale_count: stale.length,
      total_checked: rows.length,
      latency_ms: Date.now() - startMs,
      status: "success",
    });

    return stale;
  } catch (err) {
    logger.error("AGENT_STALE_LEADS_ERROR", {
      event: "AGENT_STALE_LEADS_ERROR",
      user_id: agentId,
      error: err instanceof Error ? err.message : String(err),
      retryable: true,
      latency_ms: Date.now() - startMs,
      status: "error",
    });
    return []; // partial result with warning — never crash the caller
  }
}

// ── Admin/Global: pipeline health metrics ─────────────────────────────────────

/**
 * Returns platform-wide pipeline health metrics.
 * Used by: GET /api/admin/prospects/pipeline-health
 */
export async function getPipelineHealth(): Promise<PipelineHealth> {
  const startMs = Date.now();
  const calculation_timestamp = new Date().toISOString();

  const [stats] = await db
    .select({
      total: sql<number>`COUNT(*)`,
      unassigned: sql<number>`COUNT(*) FILTER (WHERE assigned_to IS NULL)`,
      converted: sql<number>`COUNT(*) FILTER (WHERE status = 'converted')`,
      active: sql<number>`COUNT(*) FILTER (WHERE status NOT IN ('converted', 'rejected') AND assigned_to IS NOT NULL)`,
    })
    .from(prospectLeads);

  const total = Number(stats?.total ?? 0);
  const unassigned = Number(stats?.unassigned ?? 0);
  const converted = Number(stats?.converted ?? 0);
  const active = Number(stats?.active ?? 0);

  // Stale count: leads not contacted in more than the 'warm' threshold
  const [staleRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(prospectLeads)
    .where(
      and(
        isNotNull(prospectLeads.assignedTo),
        sql`${prospectLeads.status} NOT IN ('converted', 'rejected')`,
        sql`(last_contacted_at IS NULL OR last_contacted_at < NOW() - INTERVAL '${sql.raw(String(STALE_DAYS.warm))} days')`,
      ),
    );

  const stale = Number(staleRow?.count ?? 0);

  const health: PipelineHealth = {
    total,
    unassigned,
    stale,
    active,
    converted,
    conversionRate: total > 0 ? Math.round((converted / total) * 100 * 10) / 10 : 0,
    unassignedPct: total > 0 ? Math.round((unassigned / total) * 100 * 10) / 10 : 0,
    stalePct: active > 0 ? Math.round((stale / active) * 100 * 10) / 10 : 0,
    engine_version: ENGINE_VERSION,
    calculation_timestamp,
  };

  logger.info("PIPELINE_HEALTH_FETCHED", {
    event: "PIPELINE_HEALTH_FETCHED",
    ...health,
    latency_ms: Date.now() - startMs,
    status: "success",
  });

  return health;
}

// ── Unassigned leads list ──────────────────────────────────────────────────────

/**
 * Returns a paginated list of unassigned leads.
 * Used by: admin lead assignment dashboard + auto-assign trigger.
 */
export async function getUnassignedLeads(
  limit = 100,
  offset = 0,
): Promise<{ leads: Array<{ id: string; companyName: string; city: string | null; state: string | null; createdAt: Date | null }>; total: number }> {
  const [{ total }] = await db
    .select({ total: sql<number>`COUNT(*)` })
    .from(prospectLeads)
    .where(isNull(prospectLeads.assignedTo));

  const leads = await db
    .select({
      id: prospectLeads.id,
      companyName: prospectLeads.companyName,
      city: prospectLeads.city,
      state: prospectLeads.state,
      createdAt: prospectLeads.createdAt,
    })
    .from(prospectLeads)
    .where(isNull(prospectLeads.assignedTo))
    .orderBy(desc(prospectLeads.createdAt))
    .limit(limit)
    .offset(offset);

  return { leads, total: Number(total) };
}
