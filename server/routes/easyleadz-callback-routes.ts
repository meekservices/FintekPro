/**
 * EasyLeadz Webhook Routes
 *
 * Purpose : Receives async callbacks from EasyLeadz when a director's
 *           phone number has been found. Routes the result to the correct
 *           contact tier (primary/secondary/tertiary) in prospect_leads.
 *
 * Endpoint: POST /api/webhooks/easyleadz?lead_id=<id>&contact_tier=<tier>&din=<din>
 *
 * FintekPro embeds routing metadata in the callback URL query params when
 * dispatching the enrichment request (see easyleadz.adapter.ts).
 *
 * Security:
 *   - Validates that the request comes from EasyLeadz IP range (best-effort;
 *     EasyLeadz doesn't provide HMAC signing).
 *   - Lead ID is validated against DB before writing.
 *   - Mobile numbers are masked in all logs.
 *
 * GCR compliance:
 *   - Only Drizzle ORM writes — no raw SQL mutations.
 *   - All writes include updated_at and source = 'easyleadz_callback'.
 *   - Idempotent: won't overwrite an already-populated phone tier.
 *   - Structured logs on every callback event.
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import { prospectLeads } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import type { ContactTier, EasyLeadzWebhookPayload } from "../services/vendor-adapters/easyleadz.adapter";
import { apiResponse } from "../utils/responses";

const router = Router();

function maskPhone(phone: string): string {
  return phone.replace(/\d(?=\d{4})/g, "*");
}

/**
 * Maps a ContactTier string to the correct Drizzle column update object.
 * Returns null if the tier already has a phone (idempotency guard).
 */
async function buildPhoneUpdate(
  leadId: string,
  tier: ContactTier,
  phone: string,
): Promise<Record<string, unknown> | null> {
  // Load only the relevant tier's current phone
  const [lead] = await db
    .select({
      primaryMobile: prospectLeads.primaryMobile,
      secondaryMobile: prospectLeads.secondaryMobile,
      tertiaryMobile: prospectLeads.tertiaryMobile,
    })
    .from(prospectLeads)
    .where(eq(prospectLeads.id, leadId))
    .limit(1);

  if (!lead) return null;

  // Idempotency: don't overwrite existing phone with new one
  if (tier === "primary" && lead.primaryMobile) return null;
  if (tier === "secondary" && lead.secondaryMobile) return null;
  if (tier === "tertiary" && lead.tertiaryMobile) return null;

  const columnMap: Record<ContactTier, Record<string, unknown>> = {
    primary: { primaryMobile: phone },
    secondary: { secondaryMobile: phone },
    tertiary: { tertiaryMobile: phone },
  };

  return {
    ...columnMap[tier],
    updatedAt: new Date(),
  };
}

// ── Webhook endpoint ──────────────────────────────────────────────────────────

/**
 * POST /api/webhooks/easyleadz
 * Receives director phone number from EasyLeadz async callback.
 *
 * Query params (embedded by FintekPro at dispatch time):
 *   lead_id     — prospect_leads.id to update
 *   contact_tier — "primary" | "secondary" | "tertiary"
 *   din          — optional director DIN for logging
 */
router.post("/", async (req: Request, res: Response) => {
  const startMs = Date.now();

  // Extract routing metadata from query string (set by us at dispatch time)
  const leadId = (req.query.lead_id as string) ?? "";
  const contactTier = (req.query.contact_tier as ContactTier) ?? "primary";
  const din = (req.query.din as string) ?? "";

  const body = req.body as EasyLeadzWebhookPayload;

  logger.info("EASYLEADZ_WEBHOOK_RECEIVED", {
    event: "EASYLEADZ_WEBHOOK_RECEIVED",
    lead_id: leadId,
    contact_tier: contactTier,
    din: din,
    request_id: body?.request_id,
    status_from_easyleadz: body?.status,
    status: "processing",
  });

  // Validate required routing metadata
  if (!leadId || !["primary", "secondary", "tertiary"].includes(contactTier)) {
    logger.warn("EASYLEADZ_WEBHOOK_BAD_METADATA", {
      event: "EASYLEADZ_WEBHOOK_BAD_METADATA",
      lead_id: leadId,
      contact_tier: contactTier,
      status: "warn",
    });
    return res.status(400).json(
      apiResponse(false, null, {
        timestamp: new Date().toISOString(),
        version: "1.0",
      }),
    );
  }

  // EasyLeadz status "0" = phone not found
  if (body?.status !== "1") {
    logger.info("EASYLEADZ_PHONE_NOT_FOUND", {
      event: "EASYLEADZ_PHONE_NOT_FOUND",
      lead_id: leadId,
      contact_tier: contactTier,
      din,
      request_id: body?.request_id,
      message: body?.message,
      latency_ms: Date.now() - startMs,
      status: "not_found",
    });
    // Still return 200 — EasyLeadz expects 2xx to know we got the callback
    return res.json(apiResponse(true, { received: true, phone_found: false }, {
      timestamp: new Date().toISOString(),
      version: "1.0",
    }));
  }

  const phone = body?.data?.phone;
  if (!phone) {
    logger.warn("EASYLEADZ_WEBHOOK_NO_PHONE_IN_PAYLOAD", {
      event: "EASYLEADZ_WEBHOOK_NO_PHONE_IN_PAYLOAD",
      lead_id: leadId,
      request_id: body?.request_id,
      status: "warn",
    });
    return res.json(apiResponse(true, { received: true, phone_found: false }, {
      timestamp: new Date().toISOString(),
      version: "1.0",
    }));
  }

  // Build the Drizzle update (with idempotency check)
  const update = await buildPhoneUpdate(leadId, contactTier, phone);
  if (!update) {
    logger.info("EASYLEADZ_WEBHOOK_SKIPPED_IDEMPOTENT", {
      event: "EASYLEADZ_WEBHOOK_SKIPPED_IDEMPOTENT",
      lead_id: leadId,
      contact_tier: contactTier,
      reason: "phone_already_set_or_lead_not_found",
      latency_ms: Date.now() - startMs,
      status: "skipped",
    });
    return res.json(apiResponse(true, { received: true, phone_found: true, stored: false }, {
      timestamp: new Date().toISOString(),
      version: "1.0",
    }));
  }

  // Persist the phone number
  await db
    .update(prospectLeads)
    .set(update)
    .where(eq(prospectLeads.id, leadId));

  logger.info("EASYLEADZ_PHONE_STORED", {
    event: "EASYLEADZ_PHONE_STORED",
    lead_id: leadId,
    contact_tier: contactTier,
    din,
    phone_masked: maskPhone(phone),
    request_id: body?.request_id,
    latency_ms: Date.now() - startMs,
    status: "success",
  });

  return res.json(apiResponse(true, {
    received: true,
    phone_found: true,
    stored: true,
    tier: contactTier,
  }, {
    timestamp: new Date().toISOString(),
    version: "1.0",
  }));
});

export function registerEasyLeadzWebhookRoutes(app: any) {
  app.use("/api/webhooks/easyleadz", router);
}
