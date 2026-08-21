/**
 * Agent Geo Coverage Routes v1.0
 *
 * Allows agents to declare their geographical area of operation.
 * This feeds directly into the Lead Assignment Engine for geo-priority routing.
 *
 * Endpoints:
 *   GET  /api/agent/geo-coverage            - get own coverage area
 *   PUT  /api/agent/geo-coverage            - update cities/states
 *   GET  /api/admin/agent-coverage          - admin view of all agent coverage maps
 *   PUT  /api/admin/agent-coverage/:agentId - admin updates agent coverage
 *
 * Architecture: /routes layer — Drizzle ORM only, no raw SQL mutations.
 * Security: Agents can only update their own coverage.
 *           Admins can update any agent's coverage.
 */

import { Router, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, or, sql } from "drizzle-orm";
import { requireAgent, requireAdmin } from "../middleware/roleMiddleware";
import { z } from "zod";
import { logger } from "../logger";

const router = Router();

const META = { timestamp: () => new Date().toISOString(), version: "1.0" };

// ── Validation ────────────────────────────────────────────────────────────────

const geoCoverageSchema = z.object({
  operatingCities: z
    .array(z.string().min(1).max(100))
    .max(50, "Maximum 50 cities allowed")
    .optional(),
  operatingStates: z
    .array(z.string().min(1).max(100))
    .max(35, "Maximum 35 states/UTs allowed")
    .optional(),
});

// Popular Indian cities — used as autocomplete reference for the frontend
const INDIAN_CITIES_HINT = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai",
  "Kolkata", "Surat", "Pune", "Jaipur", "Lucknow", "Kanpur", "Nagpur",
  "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna",
  "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad",
  "Meerut", "Rajkot", "Varanasi", "Srinagar", "Aurangabad", "Amritsar",
  "Allahabad", "Howrah", "Ranchi", "Coimbatore", "Jabalpur", "Gwalior",
  "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Chandigarh",
  "Guwahati", "Solapur", "Hubli-Dharwad", "Mysuru", "Tiruchirappalli",
  "Bareilly", "Aligarh",
];

const INDIAN_STATES_HINT = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
  "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir",
  "Ladakh", "Lakshadweep", "Puducherry",
];

// ── GET /api/agent/geo-coverage ───────────────────────────────────────────────

/**
 * Get the authenticated agent's declared coverage area.
 * Also returns reference lists for the UI autocomplete.
 */
router.get("/agent/geo-coverage", requireAgent, async (req: any, res: Response) => {
  try {
    const [agent] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        city: users.city,
        state: users.state,
        operatingCities: users.operatingCities,
        operatingStates: users.operatingStates,
      })
      .from(users)
      .where(eq(users.id, req.user.id));

    if (!agent) {
      return res.status(404).json({ success: false, data: { error: "Agent not found" }, meta: { timestamp: META.timestamp(), version: META.version } });
    }

    res.json({
      success: true,
      data: {
        homeCity: agent.city,
        homeState: agent.state,
        operatingCities: (agent.operatingCities as string[]) ?? [],
        operatingStates: (agent.operatingStates as string[]) ?? [],
        reference: {
          cities: INDIAN_CITIES_HINT,
          states: INDIAN_STATES_HINT,
        },
      },
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (err: any) {
    logger.error("[GeoCoverage] Fetch error", { event: "GEO_COVERAGE_FETCH_ERROR", user_id: req.user?.id, error: err.message });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

// ── PUT /api/agent/geo-coverage ───────────────────────────────────────────────

/**
 * Update the authenticated agent's coverage area.
 * Lead Assignment Engine immediately uses the updated list on the next assignment run.
 *
 * Body: { operatingCities: string[], operatingStates: string[] }
 */
router.put("/agent/geo-coverage", requireAgent, async (req: any, res: Response) => {
  try {
    const parsed = geoCoverageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        data: { errors: parsed.error.flatten() },
        meta: { timestamp: META.timestamp(), version: META.version },
      });
    }

    const { operatingCities, operatingStates } = parsed.data;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (operatingCities !== undefined) updateData.operatingCities = operatingCities;
    if (operatingStates !== undefined) updateData.operatingStates = operatingStates;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.user.id))
      .returning({
        id: users.id,
        operatingCities: users.operatingCities,
        operatingStates: users.operatingStates,
      });

    logger.info("[GeoCoverage] Coverage updated", {
      event: "GEO_COVERAGE_UPDATED",
      user_id: req.user.id,
      cities_count: (operatingCities ?? []).length,
      states_count: (operatingStates ?? []).length,
      status: "success",
    });

    res.json({
      success: true,
      data: {
        operatingCities: (updated.operatingCities as string[]) ?? [],
        operatingStates: (updated.operatingStates as string[]) ?? [],
      },
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (err: any) {
    logger.error("[GeoCoverage] Update error", { event: "GEO_COVERAGE_UPDATE_ERROR", user_id: req.user?.id, error: err.message });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

// ── GET /api/admin/agent-coverage ────────────────────────────────────────────

/**
 * Admin view: shows all agent coverage areas and gaps.
 * Returns agents sorted by number of cities covered (descending).
 */
router.get("/admin/agent-coverage", requireAdmin, async (req: any, res: Response) => {
  try {
    const agents = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        city: users.city,
        state: users.state,
        operatingCities: users.operatingCities,
        operatingStates: users.operatingStates,
        roles: users.roles,
        isActive: users.isActive,
      })
      .from(users)
      .where(
        or(
          sql`'agent' = ANY(${users.roles})`,
          sql`'partner' = ANY(${users.roles})`,
          sql`'sub_agent' = ANY(${users.roles})`,
        ),
      );

    const agentData = agents.map((a) => ({
      agentId: a.id,
      fullName: `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim(),
      homeCity: a.city,
      homeState: a.state,
      operatingCities: (a.operatingCities as string[]) ?? [],
      operatingStates: (a.operatingStates as string[]) ?? [],
      isActive: a.isActive,
      coverageScore: ((a.operatingCities as string[])?.length ?? 0) + ((a.operatingStates as string[])?.length ?? 0) * 5,
    }));

    agentData.sort((a, b) => b.coverageScore - a.coverageScore);

    // Find uncovered major cities
    const coveredCities = new Set(
      agentData.flatMap((a) => [...a.operatingCities, ...(a.homeCity ? [a.homeCity] : [])].map((c) => c.toLowerCase())),
    );
    const coverageGaps = INDIAN_CITIES_HINT.filter((c) => !coveredCities.has(c.toLowerCase()));

    res.json({
      success: true,
      data: {
        agents: agentData,
        summary: {
          total: agentData.length,
          activeAgents: agentData.filter((a) => a.isActive).length,
          agentsWithNoCoverage: agentData.filter((a) => a.operatingCities.length === 0 && !a.homeCity).length,
          uncoveredMajorCities: coverageGaps.slice(0, 20),
        },
      },
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (err: any) {
    logger.error("[GeoCoverage] Admin fetch error", { event: "GEO_COVERAGE_ADMIN_ERROR", error: err.message });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

// ── PUT /api/admin/agent-coverage/:agentId ───────────────────────────────────

/**
 * Admin override: update any agent's coverage area.
 */
router.put("/admin/agent-coverage/:agentId", requireAdmin, async (req: any, res: Response) => {
  try {
    const { agentId } = req.params;

    const parsed = geoCoverageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, data: { errors: parsed.error.flatten() }, meta: { timestamp: META.timestamp(), version: META.version } });
    }

    const { operatingCities, operatingStates } = parsed.data;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (operatingCities !== undefined) updateData.operatingCities = operatingCities;
    if (operatingStates !== undefined) updateData.operatingStates = operatingStates;

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, agentId))
      .returning({ id: users.id, operatingCities: users.operatingCities, operatingStates: users.operatingStates });

    if (!updated) {
      return res.status(404).json({ success: false, data: { error: "Agent not found" }, meta: { timestamp: META.timestamp(), version: META.version } });
    }

    logger.info("[GeoCoverage] Admin updated agent coverage", {
      event: "GEO_COVERAGE_ADMIN_UPDATED",
      agent_id: agentId,
      actor_id: req.user.id,
      status: "success",
    });

    res.json({
      success: true,
      data: { agentId, operatingCities: updated.operatingCities, operatingStates: updated.operatingStates },
      meta: { timestamp: META.timestamp(), version: META.version },
    });
  } catch (err: any) {
    logger.error("[GeoCoverage] Admin update error", { event: "GEO_COVERAGE_ADMIN_UPDATE_ERROR", error: err.message });
    res.status(500).json({ success: false, data: null, meta: { timestamp: META.timestamp(), version: META.version } });
  }
});

export { router as agentGeoCoverageRouter };
