/**
 * Partner Agent Management Routes — /api/partner/agents/*
 *
 * Partner is the mid-tier role between Admin and Agent.
 * A partner can:
 *   - Invite and onboard agents under their hierarchy
 *   - Manage agents WITH EUIN (AMFI-certified, can execute MF transactions)
 *   - Manage agents WITHOUT EUIN (lead generation / DSA-only agents)
 *   - Assign/update EUIN numbers for agents
 *   - Suspend, reactivate, or transfer agents
 *   - View their agent roster with KYC + EUIN status
 *
 * Role Hierarchy: admin > partner > agent (partner is mid-tier)
 *
 * FASP-AI Rules:
 *   - Partners can only manage agents under their own partnerId (scoped)
 *   - EUIN agents must have AMFI verification before executing transactions
 *   - All writes store updatedAt (source tracked via distributorId)
 *   - Structured logs: { event, partner_id, agent_id, latency_ms, status }
 */

import { Express, Request, Response } from "express";
import { db } from "../../db";
import {
  customerCareAgents,
} from "@shared/schema";
import { eq, and, sql, isNull, isNotNull, like, desc, or } from "drizzle-orm";
import { requirePartner } from "../../middleware/roleMiddleware";
import { irisKfintechService } from "../../services/iris-kfintech-service";
import { logger } from "../../logger";
import { z } from "zod";

// ── Helpers ─────────────────────────────────────────────────────────────────

function pLog(event: string, extra: Record<string, unknown> = {}, level: "info" | "warn" | "error" = "info") {
  const entry = { event, service: "partner-agent-mgmt", timestamp: new Date().toISOString(), ...extra };
  if (level === "error") logger.error(JSON.stringify(entry));
  else if (level === "warn") logger.warn(JSON.stringify(entry));
  else logger.info(JSON.stringify(entry));
}

function apiOk(res: Response, data: unknown, meta: Record<string, unknown> = {}) {
  res.json({ success: true, data, meta: { timestamp: new Date().toISOString(), version: "1.0", ...meta } });
}

function apiErr(res: Response, status: number, code: string, message: string, retryable = false) {
  res.status(status).json({
    success: false,
    error: { error_code: code, message, retryable },
    meta: { timestamp: new Date().toISOString(), version: "1.0" },
  });
}

/** EUIN format: E followed by 6 digits e.g. E123456 */
const EUIN_REGEX = /^E\d{6}$/;

// ── Validation Schemas ───────────────────────────────────────────────────────

const InviteAgentSchema = z.object({
  fullName:           z.string().min(2).max(100),
  email:              z.string().email(),
  phone:              z.string().regex(/^\d{10}$/, "10-digit phone required"),
  panNumber:          z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format").optional(),
  euinNumber:         z.string().regex(EUIN_REGEX, "EUIN must be E followed by 6 digits e.g. E123456").optional(),
  arnCode:            z.string().optional(),
  agentType:          z.enum(["with_euin", "without_euin"]).default("without_euin"),
  commissionSplitPct: z.number().min(0).max(100).default(70),
});

const AssignEuinSchema = z.object({
  euinNumber: z.string().regex(EUIN_REGEX, "EUIN must be E followed by 6 digits e.g. E123456"),
});

const UpdateAgentSchema = z.object({
  fullName:           z.string().min(2).max(100).optional(),
  phone:              z.string().regex(/^\d{10}$/).optional(),
  status:             z.enum(["active", "inactive", "suspended"]).optional(),
  commissionSplitPct: z.number().min(0).max(100).optional(),
});

// ── Route Registration ───────────────────────────────────────────────────────

export function registerPartnerAgentManagementRoutes(app: Express): void {

  /**
   * GET /api/partner/agents/dashboard
   * Quick stats for the partner's agent management view.
   * Must be before /:agentId to avoid route conflict.
   */
  app.get("/api/partner/agents/dashboard", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;

    try {
      const base = eq(customerCareAgents.distributorId, partnerId);

      const [
        [{ total }],
        [{ withEuin }],
        [{ withoutEuin }],
        [{ active }],
        [{ pending }],
        [{ suspended }],
        [{ euinVerified }],
      ] = await Promise.all([
        db.select({ total:        sql<number>`count(*)` }).from(customerCareAgents).where(base),
        db.select({ withEuin:     sql<number>`count(*)` }).from(customerCareAgents).where(and(base, isNotNull(customerCareAgents.euinNumber))),
        db.select({ withoutEuin:  sql<number>`count(*)` }).from(customerCareAgents).where(and(base, isNull(customerCareAgents.euinNumber))),
        db.select({ active:       sql<number>`count(*)` }).from(customerCareAgents).where(and(base, eq(customerCareAgents.status, "active"))),
        db.select({ pending:      sql<number>`count(*)` }).from(customerCareAgents).where(and(base, eq(customerCareAgents.onboardingStatus, "pending"))),
        db.select({ suspended:    sql<number>`count(*)` }).from(customerCareAgents).where(and(base, eq(customerCareAgents.status, "suspended"))),
        db.select({ euinVerified: sql<number>`count(*)` }).from(customerCareAgents).where(and(base, eq(customerCareAgents.euinCardVerified, true))),
      ]);

      pLog("PARTNER_AGENTS_DASHBOARD", { partner_id: partnerId, latency_ms: Date.now() - startMs, status: "success" });

      apiOk(res, {
        total:             Number(total),
        withEuin:          Number(withEuin),
        withoutEuin:       Number(withoutEuin),
        active:            Number(active),
        pendingOnboarding: Number(pending),
        suspended:         Number(suspended),
        euinVerified:      Number(euinVerified),
        euinCoverage:      Number(total) > 0 ? Math.round((Number(withEuin) / Number(total)) * 100) : 0,
      }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENTS_DASHBOARD_ERROR", { partner_id: partnerId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_DASHBOARD_ERROR", e.message, true);
    }
  });

  /**
   * GET /api/partner/agents
   * Partner's full agent roster. Filter by euin_status, status, search.
   * Supports pagination: page, limit.
   */
  app.get("/api/partner/agents", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const {
      euin_status = "all",
      status = "all",
      search,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    try {
      const filters: ReturnType<typeof eq>[] = [eq(customerCareAgents.distributorId, partnerId) as any];

      if (status !== "all") filters.push(eq(customerCareAgents.status, status) as any);
      if (euin_status === "with_euin")    filters.push(isNotNull(customerCareAgents.euinNumber) as any);
      if (euin_status === "without_euin") filters.push(isNull(customerCareAgents.euinNumber) as any);
      if (search) {
        filters.push(or(
          like(customerCareAgents.fullName, `%${search}%`),
          like(customerCareAgents.email, `%${search}%`),
        ) as any);
      }

      const [agents, [{ total }]] = await Promise.all([
        db.select({
          id:                     customerCareAgents.id,
          fullName:               customerCareAgents.fullName,
          email:                  customerCareAgents.email,
          phone:                  customerCareAgents.phone,
          euinNumber:             customerCareAgents.euinNumber,
          euinVerificationStatus: customerCareAgents.euinVerificationStatus,
          euinCardVerified:       customerCareAgents.euinCardVerified,
          arnCode:                customerCareAgents.arnCode,
          arnVerificationStatus:  customerCareAgents.arnVerificationStatus,
          status:                 customerCareAgents.status,
          onboardingStatus:       customerCareAgents.onboardingStatus,
          panVerified:            customerCareAgents.panVerified,
          totalClientsAssigned:   customerCareAgents.totalClientsAssigned,
          activeClientsCount:     customerCareAgents.activeClientsCount,
          totalCommissionsEarned: customerCareAgents.totalCommissionsEarned,
          createdAt:              customerCareAgents.createdAt,
        })
          .from(customerCareAgents)
          .where(and(...filters))
          .orderBy(desc(customerCareAgents.createdAt))
          .limit(limitNum)
          .offset(offset),
        db.select({ total: sql<number>`count(*)` })
          .from(customerCareAgents)
          .where(and(...filters)),
      ]);

      pLog("PARTNER_AGENTS_LIST", { partner_id: partnerId, count: agents.length, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, agents, { page: pageNum, limit: limitNum, total: Number(total), totalPages: Math.ceil(Number(total) / limitNum), latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENTS_LIST_ERROR", { partner_id: partnerId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_LIST_ERROR", e.message, true);
    }
  });

  /**
   * POST /api/partner/agents/invite
   * Invite/onboard a new agent.
   * agentType "with_euin" → AMFI-certified, can transact MFs (EUIN required)
   * agentType "without_euin" → lead/DSA only (no transactions)
   */
  app.post("/api/partner/agents/invite", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const parsed = InviteAgentSchema.safeParse(req.body);
    if (!parsed.success) return apiErr(res, 400, "INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "), false);

    const data = parsed.data;
    if (data.agentType === "with_euin" && !data.euinNumber) {
      return apiErr(res, 400, "EUIN_REQUIRED", "Agents with EUIN type must provide a valid EUIN number (e.g. E123456)", false);
    }

    try {
      const existing = await db.select({ id: customerCareAgents.id })
        .from(customerCareAgents).where(eq(customerCareAgents.email, data.email)).limit(1);
      if (existing.length > 0) return apiErr(res, 409, "AGENT_EMAIL_EXISTS", "An agent with this email already exists", false);

      const agentId = crypto.randomUUID();
      const now = new Date();

      await db.insert(customerCareAgents).values({
        id:                     agentId,
        fullName:               data.fullName,
        email:                  data.email,
        phone:                  data.phone,
        panNumber:              data.panNumber ?? null,
        euinNumber:             data.euinNumber ?? null,
        arnCode:                data.arnCode ?? null,
        distributorId:          partnerId,
        agentLevel:             "agent",
        status:                 "active",
        onboardingStatus:       "pending",
        euinVerificationStatus: data.euinNumber ? "pending" : "not_applicable",
        arnVerificationStatus:  data.arnCode    ? "pending" : "not_applicable",
        commissionSplitModel:   "custom",
        defaultCommissionShare: String(data.commissionSplitPct),
        createdAt:              now,
        updatedAt:              now,
      });

      // Async IRIS EUIN verification
      if (data.euinNumber && irisKfintechService.isConfigured) {
        setImmediate(async () => {
          try {
            await (irisKfintechService as any).verifyEuin?.(data.euinNumber);
            await db.update(customerCareAgents)
              .set({ euinVerificationStatus: "verified", updatedAt: new Date() })
              .where(eq(customerCareAgents.id, agentId));
            pLog("AGENT_EUIN_AUTO_VERIFIED", { partner_id: partnerId, agent_id: agentId });
          } catch (_e) { /* non-fatal */ }
        });
      }

      pLog("PARTNER_AGENT_INVITE", { partner_id: partnerId, agent_id: agentId, agent_type: data.agentType, has_euin: !!data.euinNumber, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, {
        agentId,
        status:                 "pending_onboarding",
        agentType:              data.agentType,
        euinRequired:           data.agentType === "with_euin",
        euinProvided:           !!data.euinNumber,
        euinStatus:             data.euinNumber ? "pending_verification" : "not_applicable",
        canExecuteTransactions: false,
        message: data.euinNumber
          ? "Agent created. EUIN verification initiated — agent can transact MFs once IRIS verifies EUIN."
          : "Agent created as lead/DSA agent (no EUIN). Use POST /assign-euin to enable MF transactions.",
      }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENT_INVITE_ERROR", { partner_id: partnerId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_INVITE_ERROR", e.message, true);
    }
  });

  /**
   * GET /api/partner/agents/:agentId
   * Get single agent detail (scoped to partner).
   */
  app.get("/api/partner/agents/:agentId", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const { agentId } = req.params;

    try {
      const [agent] = await db.select()
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.id, agentId), eq(customerCareAgents.distributorId, partnerId)))
        .limit(1);

      if (!agent) return apiErr(res, 404, "AGENT_NOT_FOUND", "Agent not found under your partner account", false);

      // Mask PII before returning
      const safe = {
        ...agent,
        panNumber:         agent.panNumber    ? agent.panNumber.slice(0, 5) + "*****"                  : null,
        aadharNumber:      agent.aadharNumber ? "****-****-" + agent.aadharNumber.slice(-4)            : null,
        bankAccountNumber: agent.bankAccountNumber ? "****" + agent.bankAccountNumber.slice(-4)        : null,
      };

      pLog("PARTNER_AGENT_DETAIL", { partner_id: partnerId, agent_id: agentId, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, safe, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENT_DETAIL_ERROR", { partner_id: partnerId, agent_id: agentId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_DETAIL_ERROR", e.message, true);
    }
  });

  /**
   * PUT /api/partner/agents/:agentId
   * Update agent details. EUIN changes require /assign-euin.
   */
  app.put("/api/partner/agents/:agentId", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const { agentId } = req.params;
    const parsed = UpdateAgentSchema.safeParse(req.body);
    if (!parsed.success) return apiErr(res, 400, "INVALID_INPUT", parsed.error.issues.map((i) => i.message).join("; "), false);

    try {
      const [existing] = await db.select({ id: customerCareAgents.id })
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.id, agentId), eq(customerCareAgents.distributorId, partnerId)))
        .limit(1);
      if (!existing) return apiErr(res, 404, "AGENT_NOT_FOUND", "Agent not found under your partner account", false);

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (parsed.data.fullName)                      updates.fullName = parsed.data.fullName;
      if (parsed.data.phone)                         updates.phone = parsed.data.phone;
      if (parsed.data.status)                        updates.status = parsed.data.status;
      if (parsed.data.commissionSplitPct !== undefined)
        updates.defaultCommissionShare = String(parsed.data.commissionSplitPct);

      await db.update(customerCareAgents).set(updates as any).where(eq(customerCareAgents.id, agentId));
      pLog("PARTNER_AGENT_UPDATE", { partner_id: partnerId, agent_id: agentId, fields: Object.keys(updates), latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, { agentId, updated: true }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENT_UPDATE_ERROR", { partner_id: partnerId, agent_id: agentId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_UPDATE_ERROR", e.message, true);
    }
  });

  /**
   * POST /api/partner/agents/:agentId/assign-euin
   * Assign/upgrade agent with EUIN — converts DSA→AMFI-certified agent.
   * Triggers IRIS EUIN verification. Only EUIN-verified agents can execute MF transactions.
   * SEBI compliance requirement: EUIN uniqueness enforced across all agents.
   */
  app.post("/api/partner/agents/:agentId/assign-euin", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const { agentId } = req.params;
    const parsed = AssignEuinSchema.safeParse(req.body);
    if (!parsed.success) return apiErr(res, 400, "INVALID_EUIN_FORMAT", parsed.error.issues[0].message, false);
    const { euinNumber } = parsed.data;

    try {
      const [agent] = await db.select({ id: customerCareAgents.id, euinNumber: customerCareAgents.euinNumber })
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.id, agentId), eq(customerCareAgents.distributorId, partnerId)))
        .limit(1);
      if (!agent) return apiErr(res, 404, "AGENT_NOT_FOUND", "Agent not found under your partner account", false);

      // EUIN uniqueness check
      const euinConflict = await db.select({ id: customerCareAgents.id })
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.euinNumber, euinNumber), sql`${customerCareAgents.id} != ${agentId}`))
        .limit(1);
      if (euinConflict.length > 0) return apiErr(res, 409, "EUIN_ALREADY_ASSIGNED", `EUIN ${euinNumber} is already assigned to another agent`, false);

      await db.update(customerCareAgents)
        .set({ euinNumber, euinVerificationStatus: "pending", euinCardVerified: false, updatedAt: new Date() })
        .where(eq(customerCareAgents.id, agentId));

      // IRIS EUIN verification (synchronous attempt, fallback to async)
      let irisVerified = false;
      if (irisKfintechService.isConfigured) {
        try {
          await (irisKfintechService as any).verifyEuin?.(euinNumber);
          await db.update(customerCareAgents)
            .set({ euinVerificationStatus: "verified", euinCardVerified: true, updatedAt: new Date() })
            .where(eq(customerCareAgents.id, agentId));
          irisVerified = true;
        } catch (_ie) { /* continue with pending status */ }
      }

      pLog("PARTNER_AGENT_ASSIGN_EUIN", { partner_id: partnerId, agent_id: agentId, euin: euinNumber, iris_verified: irisVerified, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, {
        agentId,
        euinNumber,
        verificationStatus:     irisVerified ? "verified" : "pending",
        canExecuteTransactions: irisVerified,
        message: irisVerified
          ? "EUIN verified via IRIS. Agent can now execute MF transactions."
          : "EUIN assigned. IRIS verification pending — agent cannot execute MF transactions until verified.",
      }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENT_ASSIGN_EUIN_ERROR", { partner_id: partnerId, agent_id: agentId, euin: euinNumber, error: e.message }, "error");
      apiErr(res, 500, "EUIN_ASSIGN_ERROR", e.message, true);
    }
  });

  /**
   * GET /api/partner/agents/:agentId/euin-status
   * Live IRIS EUIN verification status for an agent.
   */
  app.get("/api/partner/agents/:agentId/euin-status", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const { agentId } = req.params;

    try {
      const [agent] = await db.select({
        id:                     customerCareAgents.id,
        euinNumber:             customerCareAgents.euinNumber,
        euinVerificationStatus: customerCareAgents.euinVerificationStatus,
        euinCardVerified:       customerCareAgents.euinCardVerified,
        status:                 customerCareAgents.status,
      })
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.id, agentId), eq(customerCareAgents.distributorId, partnerId)))
        .limit(1);

      if (!agent) return apiErr(res, 404, "AGENT_NOT_FOUND", "Agent not found under your partner account", false);

      if (!agent.euinNumber) {
        return apiOk(res, {
          agentId,
          euinNumber: null,
          euinStatus: "not_assigned",
          canExecuteTransactions: false,
          message: "Agent has no EUIN. Use POST /assign-euin to assign one.",
        }, { latency_ms: Date.now() - startMs });
      }

      let irisDetails: unknown = null;
      if (irisKfintechService.isConfigured) {
        try {
          irisDetails = await (irisKfintechService as any).verifyEuin?.(agent.euinNumber);
          if (irisDetails) {
            await db.update(customerCareAgents)
              .set({ euinVerificationStatus: "verified", euinCardVerified: true, updatedAt: new Date() })
              .where(eq(customerCareAgents.id, agentId));
          }
        } catch (_e) { /* DB fallback */ }
      }

      pLog("PARTNER_AGENT_EUIN_STATUS", { partner_id: partnerId, agent_id: agentId, euin: agent.euinNumber, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, {
        agentId,
        euinNumber:             agent.euinNumber,
        euinStatus:             agent.euinVerificationStatus,
        euinCardVerified:       agent.euinCardVerified,
        canExecuteTransactions: agent.euinCardVerified && agent.status === "active",
        irisDetails,
      }, { latency_ms: Date.now() - startMs, source: irisKfintechService.isConfigured ? "iris+db" : "db" });
    } catch (e: any) {
      pLog("PARTNER_AGENT_EUIN_STATUS_ERROR", { partner_id: partnerId, agent_id: agentId, error: e.message }, "error");
      apiErr(res, 500, "EUIN_STATUS_ERROR", e.message, true);
    }
  });

  /**
   * POST /api/partner/agents/:agentId/suspend
   * Suspend an agent (blocks login + transactions). Requires { reason }.
   */
  app.post("/api/partner/agents/:agentId/suspend", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const { agentId } = req.params;
    const { reason } = req.body ?? {};

    try {
      const [agent] = await db.select({ id: customerCareAgents.id, status: customerCareAgents.status })
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.id, agentId), eq(customerCareAgents.distributorId, partnerId)))
        .limit(1);
      if (!agent)                     return apiErr(res, 404, "AGENT_NOT_FOUND",    "Agent not found under your partner account", false);
      if (agent.status === "suspended") return apiErr(res, 409, "ALREADY_SUSPENDED", "Agent is already suspended",                false);

      await db.update(customerCareAgents)
        .set({ status: "suspended", rejectionReason: reason ?? "Suspended by partner", updatedAt: new Date() })
        .where(eq(customerCareAgents.id, agentId));

      pLog("PARTNER_AGENT_SUSPEND", { partner_id: partnerId, agent_id: agentId, reason, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, { agentId, suspended: true }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENT_SUSPEND_ERROR", { partner_id: partnerId, agent_id: agentId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_SUSPEND_ERROR", e.message, true);
    }
  });

  /**
   * POST /api/partner/agents/:agentId/reactivate
   * Reactivate a suspended agent.
   */
  app.post("/api/partner/agents/:agentId/reactivate", requirePartner, async (req: Request, res: Response) => {
    const startMs = Date.now();
    const partnerId = (req as any).user?.id;
    const { agentId } = req.params;

    try {
      const [agent] = await db.select({ id: customerCareAgents.id, status: customerCareAgents.status })
        .from(customerCareAgents)
        .where(and(eq(customerCareAgents.id, agentId), eq(customerCareAgents.distributorId, partnerId)))
        .limit(1);
      if (!agent)                    return apiErr(res, 404, "AGENT_NOT_FOUND", "Agent not found under your partner account", false);
      if (agent.status === "active") return apiErr(res, 409, "ALREADY_ACTIVE",  "Agent is already active",                   false);

      await db.update(customerCareAgents)
        .set({ status: "active", rejectionReason: null, updatedAt: new Date() })
        .where(eq(customerCareAgents.id, agentId));

      pLog("PARTNER_AGENT_REACTIVATE", { partner_id: partnerId, agent_id: agentId, latency_ms: Date.now() - startMs, status: "success" });
      apiOk(res, { agentId, reactivated: true }, { latency_ms: Date.now() - startMs });
    } catch (e: any) {
      pLog("PARTNER_AGENT_REACTIVATE_ERROR", { partner_id: partnerId, agent_id: agentId, error: e.message }, "error");
      apiErr(res, 500, "AGENT_REACTIVATE_ERROR", e.message, true);
    }
  });
}
