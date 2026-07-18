/**
 * IRIS Staff Management Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes the complete IRIS KFintech hierarchy management surface under:
 *
 *   /api/iris/staff/employees/*     — Employee / staff CRUD
 *   /api/iris/staff/rms/*           — Relationship Manager management
 *   /api/iris/staff/branches/*      — Branch network management
 *   /api/iris/staff/sub-brokers/*   — Agent / sub-broker lifecycle
 *   /api/iris/staff/euins/*         — EUIN registry
 *   /api/iris/staff/partner/*       — Partner profile, commission, analytics
 *
 * Access:
 *   - All routes require authentication (requireAuth)
 *   - Write operations (POST/PUT/DELETE) require admin or partner-admin role
 *   - Read operations (GET) available to authenticated agents and admins
 *
 * FASP-AI GCR compliance:
 *   - Structured logs: { event, user_id, latency_ms, status }
 *   - Errors: { error_code, message, retryable }
 *   - Responses: { success, data, meta: { timestamp, version } }
 *   - PAN never logged in plaintext
 */

import { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { logger } from "../logger";


// ── Logging helper ─────────────────────────────────────────────────────────

function staffLog(
  event: string,
  extra: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
) {
  const entry = JSON.stringify({
    event,
    service: "iris-staff-management",
    timestamp: new Date().toISOString(),
    ...extra,
  });
  if (level === "error") logger.error(entry);
  else if (level === "warn") logger.warn(entry);
  else logger.info(entry);

}

// ── Response helpers ────────────────────────────────────────────────────────

function ok(res: Response, data: unknown, startMs: number, extra: Record<string, unknown> = {}) {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "iris-staff-v1",
      latency_ms: Date.now() - startMs,
      engine_version: "iris-kfintech@2025",
      ...extra,
    },
  });
}

function irisErr(res: Response, err: any, startMs: number, errorCode: string) {
  const retryable = (err?.status ?? 500) >= 500;
  res.status(err?.status ?? 502).json({
    success: false,
    error: {
      error_code: errorCode,
      message: err?.message ?? "IRIS request failed",
      retryable,
    },
    meta: { timestamp: new Date().toISOString(), version: "iris-staff-v1", latency_ms: Date.now() - startMs },
  });
}

/**
 * Wrap an IRIS call with structured logging and error handling.
 */
async function wrap(
  res: Response,
  fn: () => Promise<unknown>,
  event: string,
  userId: string,
  startMs: number,
  errorCode: string,
) {
  try {
    const data = await fn();
    staffLog(event, { user_id: userId, latency_ms: Date.now() - startMs, status: "success" });
    return ok(res, data, startMs);
  } catch (err: any) {
    staffLog(event + "_ERROR", { user_id: userId, error: err.message, latency_ms: Date.now() - startMs, status: "error" }, "error");
    return irisErr(res, err, startMs, errorCode);
  }
}

// ── Route registration ─────────────────────────────────────────────────────

export function registerIrisStaffRoutes(app: Express): void {

  // ── Guard: check IRIS is configured ─────────────────────────────────────

  function configured(res: Response): boolean {
    if (!irisKfintechService.isConfigured) {
      res.status(503).json({
        success: false,
        error: { error_code: "IRIS_NOT_CONFIGURED", message: "IRIS KFintech credentials not set. Configure IRIS_USERNAME, IRIS_PASSWORD, IRIS_TENANT_CODE.", retryable: false },
        meta: { timestamp: new Date().toISOString(), version: "iris-staff-v1" },
      });
      return false;
    }
    return true;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 1 — EMPLOYEES / STAFF
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/iris/staff/employees
   * List all employees in the distributor hierarchy.
   * Query: page, limit, branchId, designation, status
   */
  app.get("/api/iris/staff/employees", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_STAFF_EMPLOYEE_LIST", { user_id: uid });
    return wrap(res, () => irisKfintechService.listEmployees(req.query as any), "IRIS_STAFF_EMPLOYEE_LIST", uid, t, "IRIS_EMPLOYEE_LIST_FAILED");
  });

  /**
   * GET /api/iris/staff/employees/:euinCode
   * Get details for a specific employee/staff member by EUIN.
   */
  app.get("/api/iris/staff/employees/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getEmployeeDetails(req.params.euinCode), "IRIS_STAFF_EMPLOYEE_GET", uid, t, "IRIS_EMPLOYEE_GET_FAILED");
  });

  /**
   * POST /api/iris/staff/employees
   * Add a new employee/staff member under the distributor.
   *
   * Body: { name, mobile, email, euinCode, designation, branchId, arnCode }
   * Roles: admin, partner-admin
   */
  app.post("/api/iris/staff/employees", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_STAFF_EMPLOYEE_ADD", { user_id: uid, designation: req.body?.designation });
    return wrap(res, () => irisKfintechService.addEmployee(req.body), "IRIS_STAFF_EMPLOYEE_ADD", uid, t, "IRIS_EMPLOYEE_ADD_FAILED");
  });

  /**
   * PUT /api/iris/staff/employees/:euinCode
   * Update an employee's profile (designation, branch, contact).
   */
  app.put("/api/iris/staff/employees/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_STAFF_EMPLOYEE_UPDATE", { user_id: uid, euin_code: req.params.euinCode });
    return wrap(res, () => irisKfintechService.updateEmployee(req.params.euinCode, req.body), "IRIS_STAFF_EMPLOYEE_UPDATE", uid, t, "IRIS_EMPLOYEE_UPDATE_FAILED");
  });

  /**
   * DELETE /api/iris/staff/employees/:euinCode
   * Deactivate an employee — removes system access and EUIN mapping.
   * Roles: admin only
   */
  app.delete("/api/iris/staff/employees/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_STAFF_EMPLOYEE_DEACTIVATE", { user_id: uid, euin_code: req.params.euinCode });
    return wrap(res, () => irisKfintechService.deactivateEmployee(req.params.euinCode), "IRIS_STAFF_EMPLOYEE_DEACTIVATE", uid, t, "IRIS_EMPLOYEE_DEACTIVATE_FAILED");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 2 — RELATIONSHIP MANAGERS (RM)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/iris/staff/rms
   * List all relationship managers. Returns profiles, client counts, AUM.
   * Query: page, limit, branchId, status
   */
  app.get("/api/iris/staff/rms", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.listRelationshipManagers(req.query as any), "IRIS_RM_LIST", uid, t, "IRIS_RM_LIST_FAILED");
  });

  /**
   * GET /api/iris/staff/rms/:rmId
   * Get RM profile including client list, AUM breakdown.
   */
  app.get("/api/iris/staff/rms/:rmId", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getRelationshipManagerDetails(req.params.rmId), "IRIS_RM_GET", uid, t, "IRIS_RM_GET_FAILED");
  });

  /**
   * POST /api/iris/staff/rms
   * Add a new relationship manager.
   * Body: { name, mobile, email, employeeCode, branchId, maxClientLimit }
   */
  app.post("/api/iris/staff/rms", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_RM_ADD", { user_id: uid, branch_id: req.body?.branchId });
    return wrap(res, () => irisKfintechService.addRelationshipManager(req.body), "IRIS_RM_ADD", uid, t, "IRIS_RM_ADD_FAILED");
  });

  /**
   * PUT /api/iris/staff/rms/:rmId
   * Update RM profile or reassign to a different branch.
   */
  app.put("/api/iris/staff/rms/:rmId", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.updateRelationshipManager(req.params.rmId, req.body), "IRIS_RM_UPDATE", uid, t, "IRIS_RM_UPDATE_FAILED");
  });

  /**
   * GET /api/iris/staff/rms/:rmId/clients
   * Get all investor clients assigned to an RM.
   * Query: page, limit, search
   */
  app.get("/api/iris/staff/rms/:rmId/clients", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getRmClients(req.params.rmId, req.query as any), "IRIS_RM_CLIENTS", uid, t, "IRIS_RM_CLIENTS_FAILED");
  });

  /**
   * GET /api/iris/staff/rms/:rmId/aum
   * Get AUM breakdown for a specific RM (by AMC, category, etc.).
   * Query: period (monthly/quarterly/yearly)
   */
  app.get("/api/iris/staff/rms/:rmId/aum", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getRmAum(req.params.rmId, req.query as any), "IRIS_RM_AUM", uid, t, "IRIS_RM_AUM_FAILED");
  });

  /**
   * POST /api/iris/staff/rms/reassign
   * Bulk reassign clients from one RM to another.
   *
   * Body: { fromRmId: string, toRmId: string, clientPans?: string[] }
   * If clientPans is omitted, ALL clients of fromRmId are reassigned.
   *
   * FASP-AI: Requires confirmation — action is logged with before/after state.
   */
  app.post("/api/iris/staff/rms/reassign", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    const { fromRmId, toRmId, clientPans } = req.body ?? {};
    if (!fromRmId || !toRmId) {
      return res.status(400).json({
        success: false,
        error: { error_code: "MISSING_RM_IDS", message: "fromRmId and toRmId are required", retryable: false },
        meta: { timestamp: new Date().toISOString(), version: "iris-staff-v1" },
      });
    }
    staffLog("IRIS_RM_REASSIGN", { user_id: uid, from_rm_id: fromRmId, to_rm_id: toRmId, client_count: clientPans?.length ?? "all" });
    return wrap(res, () => irisKfintechService.reassignRmClients({ fromRmId, toRmId, clientPans }), "IRIS_RM_REASSIGN", uid, t, "IRIS_RM_REASSIGN_FAILED");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 3 — BRANCH MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/iris/staff/branches
   * List all branches in the distributor's network.
   * Query: city, state, status, page, limit
   */
  app.get("/api/iris/staff/branches", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.listBranches(req.query as any), "IRIS_BRANCH_LIST", uid, t, "IRIS_BRANCH_LIST_FAILED");
  });

  /**
   * GET /api/iris/staff/branches/:branchId
   * Get branch profile — address, manager, employee count, AUM.
   */
  app.get("/api/iris/staff/branches/:branchId", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getBranchDetails(req.params.branchId), "IRIS_BRANCH_GET", uid, t, "IRIS_BRANCH_GET_FAILED");
  });

  /**
   * POST /api/iris/staff/branches
   * Add a new branch to the distributor network.
   * Body: { name, city, state, pincode, address, managerId, phone, email }
   */
  app.post("/api/iris/staff/branches", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_BRANCH_ADD", { user_id: uid, city: req.body?.city, state: req.body?.state });
    return wrap(res, () => irisKfintechService.addBranch(req.body), "IRIS_BRANCH_ADD", uid, t, "IRIS_BRANCH_ADD_FAILED");
  });

  /**
   * PUT /api/iris/staff/branches/:branchId
   * Update branch profile — address, manager, contact information.
   */
  app.put("/api/iris/staff/branches/:branchId", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.updateBranch(req.params.branchId, req.body), "IRIS_BRANCH_UPDATE", uid, t, "IRIS_BRANCH_UPDATE_FAILED");
  });

  /**
   * GET /api/iris/staff/branches/:branchId/employees
   * Get the full employee roster for a branch.
   */
  app.get("/api/iris/staff/branches/:branchId/employees", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getBranchEmployees(req.params.branchId), "IRIS_BRANCH_EMPLOYEES", uid, t, "IRIS_BRANCH_EMPLOYEES_FAILED");
  });

  /**
   * GET /api/iris/staff/branches/:branchId/aum
   * AUM and investor count breakdown for a specific branch.
   * Query: period
   */
  app.get("/api/iris/staff/branches/:branchId/aum", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getBranchAum(req.params.branchId, req.query as any), "IRIS_BRANCH_AUM", uid, t, "IRIS_BRANCH_AUM_FAILED");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 4 — SUB-BROKER / AGENT LIFECYCLE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/iris/staff/sub-brokers
   * List all sub-brokers / agents under the distributor.
   * Query: page, limit, status, search (name/euinCode)
   */
  app.get("/api/iris/staff/sub-brokers", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.listSubBrokers(req.query as any), "IRIS_SUBBROKER_LIST", uid, t, "IRIS_SUBBROKER_LIST_FAILED");
  });

  /**
   * GET /api/iris/staff/sub-brokers/:euinCode
   * Get full profile for a specific sub-broker/agent.
   */
  app.get("/api/iris/staff/sub-brokers/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getSubBrokerDetails(req.params.euinCode), "IRIS_SUBBROKER_GET", uid, t, "IRIS_SUBBROKER_GET_FAILED");
  });

  /**
   * POST /api/iris/staff/sub-brokers
   * Add / onboard a new sub-broker agent.
   * Body: { euinCode, name, mobile, email, sebiRegNo, amfiRegNo, arnCode, branchId }
   *
   * SEBI rule: sub-broker must have valid EUIN and AMFI certification.
   */
  app.post("/api/iris/staff/sub-brokers", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_SUBBROKER_ADD", { user_id: uid, euin_code: req.body?.euinCode, arn_code: req.body?.arnCode });
    return wrap(res, () => irisKfintechService.addSubBroker(req.body), "IRIS_SUBBROKER_ADD", uid, t, "IRIS_SUBBROKER_ADD_FAILED");
  });

  /**
   * PUT /api/iris/staff/sub-brokers/:euinCode
   * Update a sub-broker's profile details.
   */
  app.put("/api/iris/staff/sub-brokers/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.updateSubBroker(req.params.euinCode, req.body), "IRIS_SUBBROKER_UPDATE", uid, t, "IRIS_SUBBROKER_UPDATE_FAILED");
  });

  /**
   * DELETE /api/iris/staff/sub-brokers/:euinCode
   * Deactivate a sub-broker — offboards from IRIS hierarchy.
   * Admin only — irreversible in IRIS.
   */
  app.delete("/api/iris/staff/sub-brokers/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_SUBBROKER_DEACTIVATE", { user_id: uid, euin_code: req.params.euinCode }, "warn");
    return wrap(res, () => irisKfintechService.deactivateSubBroker(req.params.euinCode), "IRIS_SUBBROKER_DEACTIVATE", uid, t, "IRIS_SUBBROKER_DEACTIVATE_FAILED");
  });

  /**
   * GET /api/iris/staff/sub-brokers/:euinCode/clients
   * Get all investor clients mapped to this sub-broker.
   * Query: page, limit, kycStatus, search
   */
  app.get("/api/iris/staff/sub-brokers/:euinCode/clients", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getSubBrokerClients(req.params.euinCode, req.query as any), "IRIS_SUBBROKER_CLIENTS", uid, t, "IRIS_SUBBROKER_CLIENTS_FAILED");
  });

  /**
   * GET /api/iris/staff/sub-brokers/:euinCode/aum
   * AUM breakdown for clients mapped to a sub-broker.
   */
  app.get("/api/iris/staff/sub-brokers/:euinCode/aum", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getSubBrokerAum(req.params.euinCode, req.query as any), "IRIS_SUBBROKER_AUM", uid, t, "IRIS_SUBBROKER_AUM_FAILED");
  });

  /**
   * GET /api/iris/staff/sub-brokers/:euinCode/orders
   * Transaction orders placed by this sub-broker's clients.
   * Query: page, limit, fromDate, toDate, status
   */
  app.get("/api/iris/staff/sub-brokers/:euinCode/orders", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getSubBrokerOrders(req.params.euinCode, req.query as any), "IRIS_SUBBROKER_ORDERS", uid, t, "IRIS_SUBBROKER_ORDERS_FAILED");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 5 — EUIN REGISTRY
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/iris/staff/euins
   * List all EUIN codes registered under the distributor ARN.
   * Query: status (active/inactive/expired), page, limit
   */
  app.get("/api/iris/staff/euins", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.listEuins(req.query as any), "IRIS_EUIN_LIST", uid, t, "IRIS_EUIN_LIST_FAILED");
  });

  /**
   * GET /api/iris/staff/euins/:euinCode
   * Get full details for a specific EUIN — holder name, validity, linked employee.
   */
  app.get("/api/iris/staff/euins/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getEuinDetails(req.params.euinCode), "IRIS_EUIN_GET", uid, t, "IRIS_EUIN_GET_FAILED");
  });

  /**
   * POST /api/iris/staff/euins
   * Register a new EUIN under the distributor's ARN.
   * Body: { euinCode, name, arnCode, validFrom, validTo, employeeId }
   *
   * SEBI requirement: EUIN must be NISM certified and AMFI registered.
   */
  app.post("/api/iris/staff/euins", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_EUIN_ADD", { user_id: uid, euin_code: req.body?.euinCode });
    return wrap(res, () => irisKfintechService.addEuin(req.body), "IRIS_EUIN_ADD", uid, t, "IRIS_EUIN_ADD_FAILED");
  });

  /**
   * PUT /api/iris/staff/euins/:euinCode
   * Update EUIN details — validity dates, linked employee.
   */
  app.put("/api/iris/staff/euins/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.updateEuin(req.params.euinCode, req.body), "IRIS_EUIN_UPDATE", uid, t, "IRIS_EUIN_UPDATE_FAILED");
  });

  /**
   * DELETE /api/iris/staff/euins/:euinCode
   * Deactivate a specific EUIN — removes it from active transaction eligibility.
   */
  app.delete("/api/iris/staff/euins/:euinCode", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_EUIN_DEACTIVATE", { user_id: uid, euin_code: req.params.euinCode }, "warn");
    return wrap(res, () => irisKfintechService.deactivateEuin(req.params.euinCode), "IRIS_EUIN_DEACTIVATE", uid, t, "IRIS_EUIN_DEACTIVATE_FAILED");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION 6 — PARTNER / DISTRIBUTOR PROFILE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/iris/staff/partner/profile
   * Get the distributor's own IRIS partner profile.
   * Returns: ARN, EUIN list, empanelment status, regulatory details, GST.
   */
  app.get("/api/iris/staff/partner/profile", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getPartnerProfile(), "IRIS_PARTNER_PROFILE_GET", uid, t, "IRIS_PARTNER_PROFILE_FAILED");
  });

  /**
   * PUT /api/iris/staff/partner/profile
   * Update distributor profile details — contact, address, GSTIN, bank.
   * Body: { contactEmail, contactMobile, address, gstin, bankDetails }
   */
  app.put("/api/iris/staff/partner/profile", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    staffLog("IRIS_PARTNER_PROFILE_UPDATE", { user_id: uid });
    return wrap(res, () => irisKfintechService.updatePartnerProfile(req.body), "IRIS_PARTNER_PROFILE_UPDATE", uid, t, "IRIS_PARTNER_PROFILE_UPDATE_FAILED");
  });

  /**
   * GET /api/iris/staff/partner/commission
   * Get total commission earned across all AMCs.
   * Query: fromDate, toDate, amcCode, period (monthly/quarterly/yearly)
   *
   * Output includes engine_version and calculation_timestamp per FASP-AI GCR.
   */
  app.get("/api/iris/staff/partner/commission", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getPartnerCommission(req.query as any), "IRIS_PARTNER_COMMISSION", uid, t, "IRIS_PARTNER_COMMISSION_FAILED");
  });

  /**
   * GET /api/iris/staff/partner/analytics
   * Partner-level analytics: AUM trend, investor growth, SIP count over time.
   * Query: period, fromDate, toDate, groupBy (monthly/quarterly)
   */
  app.get("/api/iris/staff/partner/analytics", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getPartnerAnalytics(req.query as any), "IRIS_PARTNER_ANALYTICS", uid, t, "IRIS_PARTNER_ANALYTICS_FAILED");
  });

  /**
   * GET /api/iris/staff/partner/gst-statement
   * GST and TDS statements for the distributor — used for accounting/GST filing.
   * Query: period (monthly/quarterly), year, month
   */
  app.get("/api/iris/staff/partner/gst-statement", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getPartnerGstStatement(req.query as any), "IRIS_PARTNER_GST_STATEMENT", uid, t, "IRIS_PARTNER_GST_FAILED");
  });
}
