/**
 * Prospect Contact Enricher
 *
 * Purpose : Enriches a prospect_lead with director contact details from CredHive
 *           immediately after the lead is geo-assigned to an agent.
 *           Extracts the best reachable contact (phone + email) from the directors
 *           list so the agent has an actionable call target the moment they open
 *           their lead inbox.
 *
 * Trigger : Called by lead-assignment-engine.ts after every successful assignment.
 *           Also callable standalone for batch re-enrichment.
 *
 * Data written back to prospect_leads:
 *   - primaryEmail  — first director email found
 *   - primaryMobile — first director mobile/phone found
 *   - directors     — full enriched director array (JSONB)
 *   - enrichedAt    — timestamp of this enrichment run
 *   - enrichmentSources — appended with "credhive_directors"
 *
 * GCR compliance:
 *   - Layered: only Drizzle ORM writes, no raw SQL mutations.
 *   - Idempotent: enrichment is re-runnable; existing contacts only overwritten
 *     if new data is more complete.
 *   - Explainability: full enrichment metadata on every result.
 *   - Observability: structured logs for every enrichment attempt.
 *   - Self-healing: max 3 retries with exponential backoff on CredHive 429/5xx.
 *   - PAN/contact masking: mobile/email masked in logs per FASP-AI §Security.
 */

import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { credhiveService, CredhiveDirector } from "./credhive-service";
import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedDirectorContact {
  din: string;
  name: string;
  designation: string;
  is_active: boolean;
  date_of_appointment?: string;
  /** Phone / mobile — from CredHive DIN lookup or company profile */
  phone?: string;
  /** Professional email — from CredHive company profile */
  email?: string;
}

export interface ContactEnrichmentResult {
  leadId: string;
  cin: string | null;
  enriched: boolean;
  // Primary contact
  primaryEmail: string | null;
  primaryMobile: string | null;
  primaryContactName: string | null;
  primaryContactDesignation: string | null;
  primaryContactDin: string | null;
  // Secondary contact
  secondaryEmail: string | null;
  secondaryMobile: string | null;
  secondaryContactName: string | null;
  secondaryContactDesignation: string | null;
  secondaryContactDin: string | null;
  // Tertiary contact
  tertiaryEmail: string | null;
  tertiaryMobile: string | null;
  tertiaryContactName: string | null;
  tertiaryContactDesignation: string | null;
  tertiaryContactDin: string | null;
  // Metadata
  directorsFound: number;
  contactableDirectors: number;
  enrichmentSource: string;
  engine_version: string;
  calculation_timestamp: string;
  skipped_reason?: string;
}

const ENGINE_VERSION = "contact-enricher-v1.1";
const MAX_RETRIES = 3;

// ── Masking helpers (FASP-AI Security §) ─────────────────────────────────────

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.charAt(0)}***@${domain}`;
}

function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, "*");
}

// ── Retry wrapper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastErr = err;
      const retryable =
        err?.response?.status === 429 ||
        (err?.response?.status ?? 0) >= 500;
      if (!retryable || attempt === MAX_RETRIES) break;
      const backoff = attempt * 1000;
      logger.warn(`${label}_RETRY`, {
        event: `${label}_RETRY`,
        attempt,
        backoff_ms: backoff,
        status: "retrying",
      });
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

// ── Core enrichment logic ─────────────────────────────────────────────────────

/**
 * Enriches a single prospect lead with CredHive director contacts.
 * Safe to call multiple times — idempotent (won't overwrite richer data with null).
 */
export async function enrichProspectContacts(
  leadId: string,
): Promise<ContactEnrichmentResult> {
  const startMs = Date.now();
  const calculation_timestamp = new Date().toISOString();

  // 1. Load the lead
  const [lead] = await db
    .select({
      id: prospectLeads.id,
      cin: prospectLeads.cin,
      companyName: prospectLeads.companyName,
      assignedTo: prospectLeads.assignedTo,
      // Primary
      primaryEmail: prospectLeads.primaryEmail,
      primaryMobile: prospectLeads.primaryMobile,
      primaryContactName: prospectLeads.primaryContactName,
      // Secondary
      secondaryEmail: prospectLeads.secondaryEmail,
      secondaryMobile: prospectLeads.secondaryMobile,
      // Tertiary
      tertiaryEmail: prospectLeads.tertiaryEmail,
      tertiaryMobile: prospectLeads.tertiaryMobile,
      // Meta
      directors: prospectLeads.directors,
      enrichmentSources: prospectLeads.enrichmentSources,
      enrichedAt: prospectLeads.enrichedAt,
    })
    .from(prospectLeads)
    .where(eq(prospectLeads.id, leadId))
    .limit(1);

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // 2. Skip if no CIN — CredHive requires CIN to look up directors
  if (!lead.cin) {
    logger.info("CONTACT_ENRICHMENT_SKIPPED", {
      event: "CONTACT_ENRICHMENT_SKIPPED",
      lead_id: leadId,
      company: lead.companyName,
      reason: "no_cin",
      latency_ms: Date.now() - startMs,
      status: "skipped",
    });
    return {
      leadId,
      cin: null,
      enriched: false,
      primaryEmail: lead.primaryEmail ?? null,
      primaryMobile: lead.primaryMobile ?? null,
      primaryContactName: lead.primaryContactName ?? null,
      primaryContactDesignation: null,
      primaryContactDin: null,
      secondaryEmail: lead.secondaryEmail ?? null,
      secondaryMobile: lead.secondaryMobile ?? null,
      secondaryContactName: null,
      secondaryContactDesignation: null,
      secondaryContactDin: null,
      tertiaryEmail: lead.tertiaryEmail ?? null,
      tertiaryMobile: lead.tertiaryMobile ?? null,
      tertiaryContactName: null,
      tertiaryContactDesignation: null,
      tertiaryContactDin: null,
      directorsFound: 0,
      contactableDirectors: 0,
      enrichmentSource: "none",
      engine_version: ENGINE_VERSION,
      calculation_timestamp,
      skipped_reason: "no_cin",
    };
  }

  // 3. Skip if all 3 tiers already fully populated (idempotency)
  const allTiersPopulated =
    lead.primaryEmail && lead.primaryContactName &&
    lead.secondaryEmail && lead.secondaryContactName &&
    lead.tertiaryEmail && lead.tertiaryContactName &&
    lead.enrichedAt;

  if (allTiersPopulated) {
    logger.info("CONTACT_ENRICHMENT_SKIPPED", {
      event: "CONTACT_ENRICHMENT_SKIPPED",
      lead_id: leadId,
      company: lead.companyName,
      reason: "already_enriched",
      latency_ms: Date.now() - startMs,
      status: "skipped",
    });
    return {
      leadId,
      cin: lead.cin,
      enriched: false,
      primaryEmail: lead.primaryEmail ?? null,
      primaryMobile: lead.primaryMobile ?? null,
      primaryContactName: lead.primaryContactName ?? null,
      primaryContactDesignation: null,
      primaryContactDin: null,
      secondaryEmail: lead.secondaryEmail ?? null,
      secondaryMobile: lead.secondaryMobile ?? null,
      secondaryContactName: null,
      secondaryContactDesignation: null,
      secondaryContactDin: null,
      tertiaryEmail: lead.tertiaryEmail ?? null,
      tertiaryMobile: lead.tertiaryMobile ?? null,
      tertiaryContactName: null,
      tertiaryContactDesignation: null,
      tertiaryContactDin: null,
      directorsFound: (lead.directors as EnrichedDirectorContact[])?.length ?? 0,
      contactableDirectors: 0,
      enrichmentSource: "cache",
      engine_version: ENGINE_VERSION,
      calculation_timestamp,
      skipped_reason: "already_enriched",
    };
  }

  // 4. Fetch directors from CredHive (with retry)
  let rawDirectors: CredhiveDirector[] = [];
  try {
    const result = await withRetry(
      () => credhiveService.getDirectors(lead.cin!),
      "CREDHIVE_DIRECTORS",
    );
    if (result.success && result.data) {
      rawDirectors = result.data;
    }
  } catch (err) {
    logger.error("CREDHIVE_DIRECTORS_FAILED", {
      event: "CREDHIVE_DIRECTORS_FAILED",
      lead_id: leadId,
      cin: lead.cin,
      error: err instanceof Error ? err.message : String(err),
      retryable: false,
      status: "error",
    });
    // Return partial result — don't crash the pipeline
    return {
      leadId,
      cin: lead.cin,
      enriched: false,
      primaryEmail: lead.primaryEmail ?? null,
      primaryMobile: lead.primaryMobile ?? null,
      directorsFound: 0,
      contactableDirectors: 0,
      enrichmentSource: "credhive_directors",
      engine_version: ENGINE_VERSION,
      calculation_timestamp,
      skipped_reason: "credhive_error",
    };
  }

  // 5. Fetch company profile for email contacts
  let profileEmail: string | null = null;
  try {
    const profile = await withRetry(
      () => credhiveService.getCompanyProfile(lead.cin!),
      "CREDHIVE_PROFILE",
    );
    if (profile.success && profile.data?.email) {
      profileEmail = profile.data.email;
    }
  } catch {
    // Non-fatal — directors may still have contact info
  }

  // 6. Financial-grade director classification
  //
  //    For a SEBI-regulated wealth advisory, the right contact is the person
  //    who controls investable surplus — NOT governance/compliance directors.
  //
  //    TIER PRIORITY (lower = contact first):
  //      1 → Promoter / Founder / MD / CMD     — wealth decision-maker
  //      2 → CFO / Finance Director / Treasurer — controls investable surplus
  //      3 → CEO / ED / JMD / President         — decision influencer
  //      4 → Chairman / WTD / Additional MD     — operational authority
  //      5 → Director (generic)                 — fallback
  //      9 → Independent / Nominee / Govt       — deprioritized (no financial authority)
  //
  //    Within the same tier, earlier appointment date = more senior.

  interface DirectorWithPriority extends EnrichedDirectorContact {
    priorityTier: number;
    roleCategory: "promoter" | "finance" | "executive" | "operational" | "director" | "governance";
  }

  function classifyDirector(designation: string): { tier: number; category: DirectorWithPriority["roleCategory"] } {
    const d = designation.toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();

    // Tier 1: Promoter / Owner / CMD / MD
    if (/\b(promoter|founder|proprietor|managing director|managing partner|chairman and managing|cmd)\b/.test(d) || d === "md") {
      return { tier: 1, category: "promoter" };
    }

    // Tier 2: CFO / Finance — controls investable surplus
    if (/\b(chief financial|cfo|finance director|vp finance|head finance|director finance|group cfo|treasurer|financial controller|chief finance)\b/.test(d)) {
      return { tier: 2, category: "finance" };
    }

    // Tier 3: CEO / Executive Director
    if (/\b(chief executive|ceo|executive director|joint managing|jmd|deputy managing|dmd|president)\b/.test(d) || d === "ceo" || d === "ed") {
      return { tier: 3, category: "executive" };
    }

    // Tier 4: Chairman / Whole Time Director
    if (/\b(chairman|whole time|wtd|additional managing)\b/.test(d)) {
      return { tier: 4, category: "operational" };
    }

    // Tier 9: Independent / Nominee / Govt — no financial authority, deprioritize
    if (/\b(independent|nominee|alternate|government|institutional|woman director|additional independent)\b/.test(d)) {
      return { tier: 9, category: "governance" };
    }

    // Tier 5: Generic director
    return { tier: 5, category: "director" };
  }

  const enrichedDirectors: DirectorWithPriority[] = rawDirectors
    .filter((d) => d.is_active)
    .map((d) => {
      const { tier, category } = classifyDirector(d.designation);
      return {
        din: d.din,
        name: d.name,
        designation: d.designation,
        is_active: d.is_active,
        date_of_appointment: d.date_of_appointment,
        email: profileEmail ?? undefined,
        phone: undefined, // DIN-level phone requires CredHive premium endpoint
        priorityTier: tier,
        roleCategory: category,
      };
    })
    .sort((a, b) => {
      if (a.priorityTier !== b.priorityTier) return a.priorityTier - b.priorityTier;
      // Within same tier: earlier appointment = more senior
      const dateA = a.date_of_appointment ? new Date(a.date_of_appointment).getTime() : Infinity;
      const dateB = b.date_of_appointment ? new Date(b.date_of_appointment).getTime() : Infinity;
      return dateA - dateB;
    });

  // 7. Map top-3 active directors to the 3 contact tiers
  //    Each director gets: name, designation, DIN, email (shared from profile),
  //    phone (null until CredHive premium DIN-level endpoint is subscribed).
  const [primaryDir, secondaryDir, tertiaryDir] = enrichedDirectors;

  const emailForDirector = profileEmail ?? undefined; // shared profile email for all tiers

  // Preserve existing richer data — never overwrite with null
  const primaryEmail   = lead.primaryEmail   ?? primaryDir?.email   ?? emailForDirector ?? null;
  const primaryMobile  = lead.primaryMobile  ?? primaryDir?.phone   ?? null;
  const secondaryEmail = lead.secondaryEmail ?? secondaryDir?.email ?? emailForDirector ?? null;
  const secondaryMobile= lead.secondaryMobile ?? secondaryDir?.phone ?? null;
  const tertiaryEmail  = lead.tertiaryEmail  ?? tertiaryDir?.email  ?? emailForDirector ?? null;
  const tertiaryMobile = lead.tertiaryMobile ?? tertiaryDir?.phone  ?? null;

  // 8. Build enrichment sources list
  const existingSources: string[] =
    (lead.enrichmentSources as string[]) ?? [];
  if (!existingSources.includes("credhive_directors")) {
    existingSources.push("credhive_directors");
  }

  // 9. Persist all 3 tiers back to the lead
  const contactableCount = enrichedDirectors.filter(
    (d) => d.email || d.phone,
  ).length;

  await db
    .update(prospectLeads)
    .set({
      directors: enrichedDirectors,
      // Primary
      primaryEmail,
      primaryMobile,
      primaryContactName: primaryDir?.name ?? null,
      primaryContactDesignation: primaryDir?.designation ?? null,
      primaryContactDin: primaryDir?.din ?? null,
      // Secondary
      secondaryEmail,
      secondaryMobile,
      secondaryContactName: secondaryDir?.name ?? null,
      secondaryContactDesignation: secondaryDir?.designation ?? null,
      secondaryContactDin: secondaryDir?.din ?? null,
      // Tertiary
      tertiaryEmail,
      tertiaryMobile,
      tertiaryContactName: tertiaryDir?.name ?? null,
      tertiaryContactDesignation: tertiaryDir?.designation ?? null,
      tertiaryContactDin: tertiaryDir?.din ?? null,
      // Meta
      enrichmentSources: existingSources,
      enrichedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(prospectLeads.id, leadId));

  logger.info("CONTACT_ENRICHMENT_COMPLETE", {
    event: "CONTACT_ENRICHMENT_COMPLETE",
    lead_id: leadId,
    cin: lead.cin,
    company: lead.companyName,
    assigned_to: lead.assignedTo,
    directors_found: rawDirectors.length,
    active_directors: enrichedDirectors.length,
    contactable: contactableCount,
    tiers_populated: [primaryDir, secondaryDir, tertiaryDir].filter(Boolean).length,
    email_found: !!primaryEmail,
    email_masked: primaryEmail ? maskEmail(primaryEmail) : null,
    mobile_found: !!primaryMobile,
    mobile_masked: primaryMobile ? maskPhone(primaryMobile) : null,
    latency_ms: Date.now() - startMs,
    engine_version: ENGINE_VERSION,
    status: "success",
  });

  return {
    leadId,
    cin: lead.cin,
    enriched: true,
    // Primary
    primaryEmail,
    primaryMobile,
    primaryContactName: primaryDir?.name ?? null,
    primaryContactDesignation: primaryDir?.designation ?? null,
    primaryContactDin: primaryDir?.din ?? null,
    // Secondary
    secondaryEmail,
    secondaryMobile,
    secondaryContactName: secondaryDir?.name ?? null,
    secondaryContactDesignation: secondaryDir?.designation ?? null,
    secondaryContactDin: secondaryDir?.din ?? null,
    // Tertiary
    tertiaryEmail,
    tertiaryMobile,
    tertiaryContactName: tertiaryDir?.name ?? null,
    tertiaryContactDesignation: tertiaryDir?.designation ?? null,
    tertiaryContactDin: tertiaryDir?.din ?? null,
    // Meta
    directorsFound: rawDirectors.length,
    contactableDirectors: contactableCount,
    enrichmentSource: "credhive_directors",
    engine_version: ENGINE_VERSION,
    calculation_timestamp,
  };
}

// ── Batch enrichment ──────────────────────────────────────────────────────────

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
  const { sql, isNull, isNotNull, or } = await import("drizzle-orm");

  const leadsNeedingEnrichment = await db
    .select({ id: prospectLeads.id, cin: prospectLeads.cin })
    .from(prospectLeads)
    .where(
      // Has a CIN but missing email or mobile or never enriched
      // @ts-ignore — isNotNull on cin for dynamic query
      sql`cin IS NOT NULL AND (
        primary_email IS NULL OR
        primary_mobile IS NULL OR
        enriched_at IS NULL
      )`,
    )
    .limit(500); // Safety cap per batch run

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
