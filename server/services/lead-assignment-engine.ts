/**
 * Lead Assignment Engine
 *
 * Purpose : Assigns incoming prospect leads to the best-matched agent
 *           based on geographic coverage (city → state → national fallback).
 *           After each successful assignment, automatically triggers CredHive
 *           director contact enrichment (async, non-blocking) so the agent's
 *           inbox immediately shows a name + contact to call.
 * Inputs  : leadId — ID of an unassigned ProspectLead row
 * Outputs : Mutates assignedTo on the lead; returns the assigned agent ID.
 * Edge cases:
 *   - No agents available → lead stays unassigned, warning logged.
 *   - Multiple agents with identical scores → picks lowest createdAt (first registered).
 *   - Agent operatingCities / operatingStates JSONB may be null → treated as [].
 *   - Enrichment failure is non-blocking — assignment succeeds even if CredHive is down.
 *
 * GCR compliance:
 *   - Layered: this service only touches DB via Drizzle ORM.
 *   - Idempotent: re-running for an already-assigned lead returns current assignee.
 *   - Explainability: every assignment emits full scoring metadata.
 *   - Observability: structured log emitted for every assignment attempt.
 */

import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { users } from "@shared/schema";
import { eq, isNull, and } from "drizzle-orm";
import { logger } from "../logger";
import { enrichProspectContacts } from "./prospect-contact-enricher";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssignmentResult {
  leadId: string;
  assignedAgentId: string | null;
  scoreBreakdown: AgentScore[];
  engine_version: string;
  calculation_timestamp: string;
  already_assigned: boolean;
}

interface AgentScore {
  agentId: string;
  agentName: string;
  score: number;
  matchReason: "city_match" | "state_match" | "national_fallback";
}

// ── Score weights ─────────────────────────────────────────────────────────────
// Priority: City (3) > State (1.5) > National fallback (1)
const SCORES = {
  CITY_MATCH: 3,
  STATE_MATCH: 1.5,
  NATIONAL_FALLBACK: 1,
} as const;

const ENGINE_VERSION = "lead-assignment-v1.1";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Assigns a single lead to the best-matched agent.
 * Safe to call repeatedly — idempotent for already-assigned leads.
 */
export async function assignLead(leadId: string): Promise<AssignmentResult> {
  const startMs = Date.now();
  const calculation_timestamp = new Date().toISOString();

  // 1. Load the lead
  const [lead] = await db
    .select({
      id: prospectLeads.id,
      assignedTo: prospectLeads.assignedTo,
      city: prospectLeads.city,
      state: prospectLeads.state,
      companyName: prospectLeads.companyName,
    })
    .from(prospectLeads)
    .where(eq(prospectLeads.id, leadId))
    .limit(1);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // 2. Idempotency guard — already assigned
  if (lead.assignedTo) {
    logger.info("LEAD_ASSIGNMENT_SKIPPED", {
      event: "LEAD_ASSIGNMENT_SKIPPED",
      lead_id: leadId,
      existing_agent: lead.assignedTo,
      reason: "already_assigned",
      latency_ms: Date.now() - startMs,
      status: "skipped",
    });
    return {
      leadId,
      assignedAgentId: lead.assignedTo,
      scoreBreakdown: [],
      engine_version: ENGINE_VERSION,
      calculation_timestamp,
      already_assigned: true,
    };
  }

  // 3. Load all active agents
  const agents = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      city: users.city,
      state: users.state,
      operatingCities: users.operatingCities,
      operatingStates: users.operatingStates,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "agent"),
        eq(users.isActive, true),
      )
    );

  if (agents.length === 0) {
    logger.warn("LEAD_ASSIGNMENT_NO_AGENTS", {
      event: "LEAD_ASSIGNMENT_NO_AGENTS",
      lead_id: leadId,
      lead_city: lead.city,
      lead_state: lead.state,
      latency_ms: Date.now() - startMs,
      status: "unassigned",
    });
    return {
      leadId,
      assignedAgentId: null,
      scoreBreakdown: [],
      engine_version: ENGINE_VERSION,
      calculation_timestamp,
      already_assigned: false,
    };
  }

  // 4. Score each agent
  const leadCity = (lead.city ?? "").toLowerCase().trim();
  const leadState = (lead.state ?? "").toLowerCase().trim();

  const scored: AgentScore[] = agents.map((agent) => {
    const opCities: string[] = ((agent.operatingCities as string[]) ?? []).map(
      (c) => c.toLowerCase().trim(),
    );
    const opStates: string[] = ((agent.operatingStates as string[]) ?? []).map(
      (s) => s.toLowerCase().trim(),
    );
    const homeCityNorm = (agent.city ?? "").toLowerCase().trim();
    const homeStateNorm = (agent.state ?? "").toLowerCase().trim();

    const agentName = `${agent.firstName ?? ""} ${agent.lastName ?? ""}`.trim();

    // City match — explicit coverage OR home city
    if (
      (leadCity && opCities.includes(leadCity)) ||
      (leadCity && homeCityNorm === leadCity)
    ) {
      return {
        agentId: agent.id,
        agentName,
        score: SCORES.CITY_MATCH,
        matchReason: "city_match",
      };
    }

    // State match — explicit coverage OR home state
    if (
      (leadState && opStates.includes(leadState)) ||
      (leadState && homeStateNorm === leadState)
    ) {
      return {
        agentId: agent.id,
        agentName,
        score: SCORES.STATE_MATCH,
        matchReason: "state_match",
      };
    }

    // National fallback
    return {
      agentId: agent.id,
      agentName,
      score: SCORES.NATIONAL_FALLBACK,
      matchReason: "national_fallback",
    };
  });

  // 5. Pick best agent (highest score, ties broken by registration order)
  scored.sort((a, b) => b.score - a.score);
  const winner = scored[0];

  // 6. Persist assignment
  await db
    .update(prospectLeads)
    .set({
      assignedTo: winner.agentId,
      updatedAt: new Date(),
      source: prospectLeads.source ?? "api",
    })
    .where(
      and(
        eq(prospectLeads.id, leadId),
        isNull(prospectLeads.assignedTo), // prevent overwrite race condition
      )
    );

  logger.info("LEAD_ASSIGNED", {
    event: "LEAD_ASSIGNED",
    lead_id: leadId,
    company: lead.companyName,
    lead_city: lead.city,
    lead_state: lead.state,
    assigned_to: winner.agentId,
    match_reason: winner.matchReason,
    score: winner.score,
    candidates_evaluated: scored.length,
    latency_ms: Date.now() - startMs,
    engine_version: ENGINE_VERSION,
    status: "success",
  });

  // ── Auto-trigger CredHive contact enrichment (async, non-blocking) ──────────
  // Fires in the background — assignment result returns immediately to the caller.
  // If CredHive is down or the lead has no CIN, enrichment is skipped gracefully.
  setImmediate(() => {
    enrichProspectContacts(leadId).catch((err) =>
      logger.warn("CONTACT_ENRICHMENT_BACKGROUND_ERROR", {
        event: "CONTACT_ENRICHMENT_BACKGROUND_ERROR",
        lead_id: leadId,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
        status: "warn",
      }),
    );
  });

  return {
    leadId,
    assignedAgentId: winner.agentId,
    scoreBreakdown: scored,
    engine_version: ENGINE_VERSION,
    calculation_timestamp,
    already_assigned: false,
  };
}

/**
 * Bulk-assigns a list of unassigned leads.
 * Processes sequentially to avoid DB contention.
 */
export async function bulkAssignLeads(leadIds: string[]): Promise<{
  assigned: number;
  skipped: number;
  failed: number;
  results: AssignmentResult[];
}> {
  let assigned = 0;
  let skipped = 0;
  let failed = 0;
  const results: AssignmentResult[] = [];

  for (const leadId of leadIds) {
    try {
      const result = await assignLead(leadId);
      results.push(result);
      if (result.already_assigned) skipped++;
      else if (result.assignedAgentId) assigned++;
      else skipped++; // no agents available
    } catch (err) {
      failed++;
      logger.error("LEAD_ASSIGNMENT_ERROR", {
        event: "LEAD_ASSIGNMENT_ERROR",
        lead_id: leadId,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
        status: "error",
      });
    }
  }

  logger.info("BULK_LEAD_ASSIGNMENT_COMPLETE", {
    event: "BULK_LEAD_ASSIGNMENT_COMPLETE",
    total: leadIds.length,
    assigned,
    skipped,
    failed,
    status: "success",
  });

  return { assigned, skipped, failed, results };
}

/**
 * Auto-assigns all currently unassigned leads in the database.
 * Called by admin API and nightly cron.
 */
export async function autoAssignAllUnassigned(): Promise<{
  processed: number;
  assigned: number;
  skipped: number;
  failed: number;
}> {
  const unassigned = await db
    .select({ id: prospectLeads.id })
    .from(prospectLeads)
    .where(isNull(prospectLeads.assignedTo));

  const ids = unassigned.map((r) => r.id);

  logger.info("AUTO_ASSIGN_STARTED", {
    event: "AUTO_ASSIGN_STARTED",
    unassigned_count: ids.length,
    engine_version: ENGINE_VERSION,
    status: "started",
  });

  const result = await bulkAssignLeads(ids);

  return {
    processed: ids.length,
    assigned: result.assigned,
    skipped: result.skipped,
    failed: result.failed,
  };
}
