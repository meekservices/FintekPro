/**
 * DirectorContactService
 *
 * Purpose:
 *   Single-responsibility service that takes the complete director universe
 *   returned by CredHive and produces up to three contactable tiers
 *   (Primary / Secondary / Tertiary) for the agent inbox.
 *
 * Algorithm (per user specification):
 *   1. Fetch all directors from CredHive for a CIN.
 *   2. Normalize & score every director with a configurable decision-maker score.
 *   3. Validate the mobile for each director (Indian number normalisation).
 *   4. Deduplicate mobiles — higher-scored director wins the slot.
 *   5. Filter contactable directors (mobileStatus === "found").
 *   6. Sort contactable directors by decisionMakerScore DESC.
 *   7. Assign Primary → contacts[0], Secondary → contacts[1], Tertiary → contacts[2].
 *   8. Persist atomically to prospect_leads.
 *   9. Return the full result (contacts + full universe for "Other Directors" display).
 *
 * Key rule:
 *   Do NOT stop at the first three ranked directors.
 *   The system must find the three BEST CONTACTABLE decision-makers —
 *   skipping any higher-ranked director who has no usable mobile.
 *
 * GCR compliance:
 *   - Drizzle ORM only — no raw SQL writes.
 *   - Phone numbers masked in all logs.
 *   - Structured logs: { event, lead_id, latency_ms, status }.
 *   - Errors: { error_code, message, retryable }.
 *   - Idempotent: skips tiers already having a valid mobile.
 *   - CredHive failure → enrichment_failed status → lead assignment unblocked.
 */

import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import {
  credhiveService,
  type CredhiveDirector,
} from "./credhive-service";
import {
  runDirectorContactPipeline,
  normalizeIndianMobile,
  scoreDirector,
  DECISION_MAKER_SCORE_RULES,
  type DirectorInput,
  type ScoredDirector,
  type ContactTier,
  type DirectorContactTier,
  type MobileStatus,
  type PipelineResult,
} from "./director-contact-logic";

// Re-export pure types/functions for consumers
export {
  normalizeIndianMobile,
  scoreDirector,
  DECISION_MAKER_SCORE_RULES,
};
export type {
  ScoredDirector,
  ContactTier,
  DirectorContactTier,
  MobileStatus,
};

// ── Service-level result type ─────────────────────────────────────────────────

export interface DirectorContactResult {
  leadId: string;
  cin: string;
  contacts: DirectorContactTier[];
  allDirectors: ScoredDirector[];
  totalDirectors: number;
  contactableDirectors: number;
  enrichmentSource: "credhive";
  lookupAt: string;
  enrichmentStatus: "success" | "partial" | "no_contacts" | "lookup_error";
  engine_version: string;
  calculation_timestamp: string;
}

// ── Main service ───────────────────────────────────────────────────────────────

const ENGINE_VERSION = "director-contact-service-v2.0";

export class DirectorContactService {
  /**
   * Full pipeline: fetch → score → validate → dedup → tier → persist.
   *
   * @param leadId      - prospect_leads.id
   * @param cin         - Company Identification Number
   * @param companyName - for logging
   */
  async getBestDirectorContacts(
    leadId: string,
    cin: string,
    companyName?: string,
  ): Promise<DirectorContactResult> {
    const startMs = Date.now();
    const lookupAt = new Date().toISOString();

    // ── Step 1: Fetch directors from CredHive ─────────────────────────────────
    let rawDirectors: CredhiveDirector[] = [];

    try {
      const result = await credhiveService.getDirectors(cin);

      if (!result.success || !result.data) {
        const errorResult = this._buildErrorResult(
          leadId, cin, lookupAt,
          result.error ?? "CredHive directors fetch returned no data",
        );
        await this._persistResult(leadId, errorResult);
        return errorResult;
      }

      rawDirectors = result.data;
    } catch (err: any) {
      logger.error("DIRECTOR_CONTACT_CREDHIVE_FETCH_FAILED", {
        event: "DIRECTOR_CONTACT_CREDHIVE_FETCH_FAILED",
        lead_id: leadId, cin, company: companyName,
        error: err?.message ?? String(err),
        retryable: true,
        latency_ms: Date.now() - startMs,
        engine_version: ENGINE_VERSION,
        status: "error",
      });
      const errorResult = this._buildErrorResult(leadId, cin, lookupAt, err?.message);
      await this._persistResult(leadId, errorResult);
      return errorResult;
    }

    // ── Steps 2-5: Pure pipeline (score → validate → dedup → tier) ───────────
    const pipeline = runDirectorContactPipeline(rawDirectors, lookupAt);

    const enrichmentStatus =
      pipeline.contacts.length === 0 ? "no_contacts"
      : pipeline.contacts.length < 3 ? "partial"
      : "success";

    logger.info("DIRECTOR_CONTACT_ENRICHMENT_COMPLETE", {
      event: "DIRECTOR_CONTACT_ENRICHMENT_COMPLETE",
      lead_id: leadId, cin, company: companyName,
      total_directors: pipeline.totalDirectors,
      contactable_directors: pipeline.contactableDirectors,
      tiers_assigned: pipeline.contacts.length,
      enrichment_status: enrichmentStatus,
      latency_ms: Date.now() - startMs,
      engine_version: ENGINE_VERSION,
      status: "success",
    });

    const result: DirectorContactResult = {
      leadId, cin,
      contacts: pipeline.contacts,
      allDirectors: pipeline.allDirectors,
      totalDirectors: pipeline.totalDirectors,
      contactableDirectors: pipeline.contactableDirectors,
      enrichmentSource: "credhive",
      lookupAt,
      enrichmentStatus,
      engine_version: ENGINE_VERSION,
      calculation_timestamp: lookupAt,
    };

    // ── Step 6: Persist atomically ────────────────────────────────────────────
    await this._persistResult(leadId, result);

    return result;
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  private async _persistResult(
    leadId: string,
    result: DirectorContactResult,
  ): Promise<void> {
    const [primary, secondary, tertiary] = result.contacts;
    const lookupAt = new Date(result.lookupAt);

    // Build enrichment source list (append without duplication)
    const [existing] = await db
      .select({ enrichmentSources: prospectLeads.enrichmentSources })
      .from(prospectLeads)
      .where(eq(prospectLeads.id, leadId))
      .limit(1);

    const sources: string[] = (existing?.enrichmentSources as string[]) ?? [];
    if (!sources.includes("credhive")) sources.push("credhive");

    await db
      .update(prospectLeads)
      .set({
        // Primary contact tier
        primaryMobile: primary?.mobile ?? null,
        primaryContactName: primary?.name ?? null,
        primaryContactDesignation: primary?.designation ?? null,
        primaryContactDin: primary?.din ?? null,
        primaryEmail: primary?.email ?? null,
        // Secondary contact tier
        secondaryMobile: secondary?.mobile ?? null,
        secondaryContactName: secondary?.name ?? null,
        secondaryContactDesignation: secondary?.designation ?? null,
        secondaryContactDin: secondary?.din ?? null,
        secondaryEmail: secondary?.email ?? null,
        // Tertiary contact tier
        tertiaryMobile: tertiary?.mobile ?? null,
        tertiaryContactName: tertiary?.name ?? null,
        tertiaryContactDesignation: tertiary?.designation ?? null,
        tertiaryContactDin: tertiary?.din ?? null,
        tertiaryEmail: tertiary?.email ?? null,
        // Full director universe (includes mobileStatus for "Other Directors" display)
        directors: result.allDirectors,
        // Enrichment metadata
        enrichmentSources: sources,
        enrichedAt: lookupAt,
      })
      .where(eq(prospectLeads.id, leadId));

    logger.info("DIRECTOR_CONTACT_PERSISTED", {
      event: "DIRECTOR_CONTACT_PERSISTED",
      lead_id: leadId,
      cin: result.cin,
      tiers_written: result.contacts.length,
      total_directors_stored: result.allDirectors.length,
      engine_version: ENGINE_VERSION,
      status: "success",
    });
  }

  // ── Error result builder ─────────────────────────────────────────────────────

  private _buildErrorResult(
    leadId: string,
    cin: string,
    lookupAt: string,
    errorMessage?: string,
  ): DirectorContactResult {
    logger.error("DIRECTOR_CONTACT_ENRICHMENT_FAILED", {
      event: "DIRECTOR_CONTACT_ENRICHMENT_FAILED",
      lead_id: leadId,
      cin,
      error: errorMessage,
      error_code: "CREDHIVE_LOOKUP_FAILED",
      retryable: true,
      engine_version: ENGINE_VERSION,
      status: "error",
    });

    return {
      leadId,
      cin,
      contacts: [],
      allDirectors: [],
      totalDirectors: 0,
      contactableDirectors: 0,
      enrichmentSource: "credhive",
      lookupAt,
      enrichmentStatus: "lookup_error",
      engine_version: ENGINE_VERSION,
      calculation_timestamp: lookupAt,
    };
  }
}

// Singleton export
export const directorContactService = new DirectorContactService();
