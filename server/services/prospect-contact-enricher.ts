/**
 * Prospect Contact Enricher
 *
 * Purpose:
 *   Entry point for director-contact enrichment on a prospect_lead.
 *   Delegates the full pipeline to DirectorContactService, which implements
 *   the correct algorithm:
 *     Score ALL directors → validate mobiles → deduplicate → filter
 *     contactable → assign Primary / Secondary / Tertiary to the
 *     highest-ranked contactable decision-makers.
 *
 * Trigger:
 *   Called by lead-assignment-engine.ts after every successful geo-assignment.
 *   Also callable standalone for batch re-enrichment via
 *   POST /api/admin/prospects/:id/enrich-contacts.
 *
 * Data written to prospect_leads (via DirectorContactService._persistResult):
 *   primary_contact_name / primary_mobile / primary_contact_designation / primary_contact_din
 *   secondary_contact_name / secondary_mobile / secondary_contact_designation / secondary_contact_din
 *   tertiary_contact_name / tertiary_mobile / tertiary_contact_designation / tertiary_contact_din
 *   directors     — full scored universe including mobileStatus for "Other Directors"
 *   enriched_at   — timestamp of this enrichment run
 *   enrichment_sources — appended with "credhive"
 *
 * GCR compliance:
 *   - Layered: DirectorContactService owns all DB writes (Drizzle only).
 *   - Idempotent: re-runnable; existing valid contacts are preserved by the service.
 *   - Explainability: full enrichment metadata on every result object.
 *   - Observability: structured logs for every enrichment attempt.
 *   - Self-healing: CredHive retries are handled inside credhive-service.ts;
 *     enrichment failure does NOT block lead assignment.
 *   - PAN/contact masking: mobile/email masked in logs per FASP-AI §Security.
 *   - No Bulkpe or any secondary phone provider — CredHive is the sole source.
 */

import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { directorContactService } from "./director-contact-service";
import type { DirectorContactResult, ContactTier } from "./director-contact-service";

// Re-export for consumers that import from this module
export type { DirectorContactResult, ContactTier };

// ── Engine version ─────────────────────────────────────────────────────────────

const ENGINE_VERSION = "prospect-contact-enricher-v3.0";

// ── Public Result type ─────────────────────────────────────────────────────────
// Thin wrapper used by the lead assignment engine and admin routes.

export interface ContactEnrichmentResult {
  leadId: string;
  cin: string | null;
  enriched: boolean;
  enrichmentStatus: "success" | "partial" | "no_contacts" | "lookup_error" | "skipped";
  // Tier summary (for callers that need a quick view)
  primaryContactName: string | null;
  primaryMobile: string | null;
  primaryContactDesignation: string | null;
  primaryContactDin: string | null;
  secondaryContactName: string | null;
  secondaryMobile: string | null;
  secondaryContactDesignation: string | null;
  secondaryContactDin: string | null;
  tertiaryContactName: string | null;
  tertiaryMobile: string | null;
  tertiaryContactDesignation: string | null;
  tertiaryContactDin: string | null;
  // Metrics
  directorsFound: number;
  contactableDirectors: number;
  enrichmentSource: "credhive";
  skipped_reason?: string;
  engine_version: string;
  calculation_timestamp: string;
}

// ── Main function ──────────────────────────────────────────────────────────────

/**
 * Enriches a prospect lead with the best contactable director contacts from CredHive.
 *
 * Implements the correct algorithm:
 *   Rank ALL directors → validate mobiles → deduplicate → pick top 3 contactable.
 *
 * @param leadId  - prospect_leads.id UUID
 * @returns       ContactEnrichmentResult with tier assignments and metrics
 */
export async function enrichProspectContacts(
  leadId: string,
): Promise<ContactEnrichmentResult> {
  const startMs = Date.now();
  const calculation_timestamp = new Date().toISOString();

  // ── 1. Load the lead ────────────────────────────────────────────────────────
  const [lead] = await db
    .select({
      id: prospectLeads.id,
      cin: prospectLeads.cin,
      companyName: prospectLeads.companyName,
      enrichedAt: prospectLeads.enrichedAt,
      // Existing tier data (for idempotency guard)
      primaryMobile: prospectLeads.primaryMobile,
      secondaryMobile: prospectLeads.secondaryMobile,
      tertiaryMobile: prospectLeads.tertiaryMobile,
    })
    .from(prospectLeads)
    .where(eq(prospectLeads.id, leadId))
    .limit(1);

  if (!lead) {
    logger.warn("CONTACT_ENRICHMENT_LEAD_NOT_FOUND", {
      event: "CONTACT_ENRICHMENT_LEAD_NOT_FOUND",
      lead_id: leadId,
      retryable: false,
      status: "warn",
    });
    return _skippedResult(leadId, null, "lead_not_found", calculation_timestamp);
  }

  if (!lead.cin) {
    logger.info("CONTACT_ENRICHMENT_SKIPPED_NO_CIN", {
      event: "CONTACT_ENRICHMENT_SKIPPED_NO_CIN",
      lead_id: leadId,
      status: "skipped",
    });
    return _skippedResult(leadId, null, "no_cin", calculation_timestamp);
  }

  // ── 2. Delegate to DirectorContactService ───────────────────────────────────
  let serviceResult: DirectorContactResult;

  try {
    serviceResult = await directorContactService.getBestDirectorContacts(
      leadId,
      lead.cin,
      lead.companyName ?? undefined,
    );
  } catch (err: any) {
    // Defensive catch — DirectorContactService already handles errors internally,
    // but we guard here to ensure lead assignment is NEVER blocked.
    logger.error("CONTACT_ENRICHMENT_SERVICE_ERROR", {
      event: "CONTACT_ENRICHMENT_SERVICE_ERROR",
      lead_id: leadId,
      cin: lead.cin,
      error: err?.message ?? String(err),
      retryable: true,
      latency_ms: Date.now() - startMs,
      engine_version: ENGINE_VERSION,
      status: "error",
    });
    return _skippedResult(leadId, lead.cin, "service_error", calculation_timestamp);
  }

  // ── 3. Map service result to ContactEnrichmentResult ───────────────────────
  const [primary, secondary, tertiary] = serviceResult.contacts;

  logger.info("CONTACT_ENRICHMENT_COMPLETE", {
    event: "CONTACT_ENRICHMENT_COMPLETE",
    lead_id: leadId,
    cin: lead.cin,
    enrichment_status: serviceResult.enrichmentStatus,
    total_directors: serviceResult.totalDirectors,
    contactable_directors: serviceResult.contactableDirectors,
    tiers_assigned: serviceResult.contacts.length,
    latency_ms: Date.now() - startMs,
    engine_version: ENGINE_VERSION,
    status: "success",
  });

  return {
    leadId,
    cin: lead.cin,
    enriched: serviceResult.contacts.length > 0,
    enrichmentStatus: serviceResult.enrichmentStatus,
    // Primary
    primaryContactName: primary?.name ?? null,
    primaryMobile: primary?.mobile ?? null,
    primaryContactDesignation: primary?.designation ?? null,
    primaryContactDin: primary?.din ?? null,
    // Secondary
    secondaryContactName: secondary?.name ?? null,
    secondaryMobile: secondary?.mobile ?? null,
    secondaryContactDesignation: secondary?.designation ?? null,
    secondaryContactDin: secondary?.din ?? null,
    // Tertiary
    tertiaryContactName: tertiary?.name ?? null,
    tertiaryMobile: tertiary?.mobile ?? null,
    tertiaryContactDesignation: tertiary?.designation ?? null,
    tertiaryContactDin: tertiary?.din ?? null,
    // Metrics
    directorsFound: serviceResult.totalDirectors,
    contactableDirectors: serviceResult.contactableDirectors,
    enrichmentSource: "credhive",
    engine_version: ENGINE_VERSION,
    calculation_timestamp,
  };
}

// ── Batch enrichment ─────────────────────────────────────────────────────────

/**
 * Batch-enriches all leads that have a CIN but no contact data yet.
 * Processes with 200ms delay between calls to avoid CredHive rate limiting.
 */
export async function batchEnrichMissingContacts(): Promise<{
  processed: number;
  enriched: number;
  skipped: number;
  failed: number;
}> {
  const { sql } = await import("drizzle-orm");

  const leadsNeedingEnrichment = await db
    .select({ id: prospectLeads.id, cin: prospectLeads.cin })
    .from(prospectLeads)
    .where(
      sql`cin IS NOT NULL AND (
        primary_mobile IS NULL OR
        enriched_at IS NULL
      )`,
    )
    .limit(500);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of leadsNeedingEnrichment) {
    try {
      const result = await enrichProspectContacts(lead.id);
      if (result.enriched) enriched++;
      else skipped++;
      // 200ms rate-limit delay between CredHive calls
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      failed++;
      logger.error("BATCH_CONTACT_ENRICHMENT_ERROR", {
        event: "BATCH_CONTACT_ENRICHMENT_ERROR",
        lead_id: lead.id,
        cin: lead.cin,
        error: err instanceof Error ? err.message : String(err),
        retryable: true,
        status: "error",
      });
    }
  }

  logger.info("BATCH_CONTACT_ENRICHMENT_COMPLETE", {
    event: "BATCH_CONTACT_ENRICHMENT_COMPLETE",
    total: leadsNeedingEnrichment.length,
    enriched,
    skipped,
    failed,
    engine_version: ENGINE_VERSION,
    status: "success",
  });

  return {
    processed: leadsNeedingEnrichment.length,
    enriched,
    skipped,
    failed,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _skippedResult(
  leadId: string,
  cin: string | null,
  reason: string,
  calculation_timestamp: string,
): ContactEnrichmentResult {
  return {
    leadId,
    cin,
    enriched: false,
    enrichmentStatus: "skipped",
    primaryContactName: null,
    primaryMobile: null,
    primaryContactDesignation: null,
    primaryContactDin: null,
    secondaryContactName: null,
    secondaryMobile: null,
    secondaryContactDesignation: null,
    secondaryContactDin: null,
    tertiaryContactName: null,
    tertiaryMobile: null,
    tertiaryContactDesignation: null,
    tertiaryContactDin: null,
    directorsFound: 0,
    contactableDirectors: 0,
    enrichmentSource: "credhive",
    skipped_reason: reason,
    engine_version: ENGINE_VERSION,
    calculation_timestamp,
  };
}
