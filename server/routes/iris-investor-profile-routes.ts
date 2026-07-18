/**
 * IRIS Investor Profile Management Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes investor profile update endpoints via IRIS KFintech API under:
 *
 *   /api/iris/investors/:pan/email          — Update email address
 *   /api/iris/investors/:pan/mobile         — Update mobile number
 *   /api/iris/investors/:pan/nominee        — Update nominee details
 *   /api/iris/investors/:pan/bank           — Update bank account
 *   /api/iris/investors/:pan/fatca          — Update FATCA declaration
 *   /api/iris/investors/:pan/idcw           — Update IDCW preference
 *   /api/iris/investors/:pan/demat          — Get demat accounts
 *   /api/iris/investors/:pan/goals          — Financial goals CRUD
 *   /api/iris/investors/:pan/portal-link    — Investor portal link management
 *   /api/iris/investors/:pan/bank-mandate   — Bank mandate management
 *   /api/iris/investors/:pan/nominee-details — Get current nominee details
 *   /api/iris/investors/:pan/bank-details   — Get current bank details
 *   /api/iris/investors/:pan/fatca-details  — Get current FATCA details
 *
 * Security:
 *   - All routes require auth
 *   - PAN is masked in all logs
 *   - Non-financial updates only — no order placement here
 *
 * FASP-AI GCR:
 *   - Responses: { success, data, meta: { timestamp, version } }
 *   - Errors: { error_code, message, retryable }
 *   - Structured logs: { event, user_id, pan_masked, latency_ms, status }
 */

import { Express, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { irisKfintechService } from "../services/iris-kfintech-service";
import { logger } from "../logger";


// ── Helpers ────────────────────────────────────────────────────────────────

function maskPan(pan: string): string {
  return pan ? pan.slice(0, 5) + "*****" : "UNKNOWN";
}

function profileLog(
  event: string,
  extra: Record<string, unknown> = {},
  level: "info" | "warn" | "error" = "info",
) {
  const entry = JSON.stringify({
    event,
    service: "iris-investor-profile",
    timestamp: new Date().toISOString(),
    ...extra,
  });
  if (level === "error") logger.error(entry);
  else if (level === "warn") logger.warn(entry);
  else logger.info(entry);

}

function ok(res: Response, data: unknown, startMs: number, extra: Record<string, unknown> = {}) {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "iris-investor-profile-v1",
      engine_version: "iris-kfintech@2025",
      latency_ms: Date.now() - startMs,
      ...extra,
    },
  });
}

function irisErr(res: Response, err: any, startMs: number, errorCode: string) {
  res.status(err?.status ?? 502).json({
    success: false,
    error: {
      error_code: errorCode,
      message: err?.message ?? "IRIS request failed",
      retryable: (err?.status ?? 500) >= 500,
    },
    meta: { timestamp: new Date().toISOString(), version: "iris-investor-profile-v1", latency_ms: Date.now() - startMs },
  });
}

async function wrap(
  res: Response,
  fn: () => Promise<unknown>,
  event: string,
  userId: string,
  panMasked: string,
  startMs: number,
  errorCode: string,
) {
  try {
    const data = await fn();
    profileLog(event, { user_id: userId, pan_masked: panMasked, latency_ms: Date.now() - startMs, status: "success" });
    return ok(res, data, startMs);
  } catch (err: any) {
    profileLog(event + "_ERROR", { user_id: userId, pan_masked: panMasked, error: err.message, latency_ms: Date.now() - startMs, status: "error" }, "error");
    return irisErr(res, err, startMs, errorCode);
  }
}

// ── Route registration ────────────────────────────────────────────────────

export function registerIrisInvestorProfileRoutes(app: Express): void {

  function configured(res: Response): boolean {
    if (!irisKfintechService.isConfigured) {
      res.status(503).json({
        success: false,
        error: { error_code: "IRIS_NOT_CONFIGURED", message: "IRIS KFintech credentials not set.", retryable: false },
        meta: { timestamp: new Date().toISOString(), version: "iris-investor-profile-v1" },
      });
      return false;
    }
    return true;
  }

  // ── Read: profile sub-resources ─────────────────────────────────────────

  /**
   * GET /api/iris/investors/:pan/bank-details
   * Get current bank account details for an investor.
   * Returns list of bank accounts — primary marked separately.
   */
  app.get("/api/iris/investors/:pan/bank-details", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getBankDetails(pan), "IRIS_INVESTOR_BANK_GET", uid, maskPan(pan), t, "IRIS_BANK_DETAILS_FAILED");
  });

  /**
   * GET /api/iris/investors/:pan/nominee-details
   * Get current nominee details for an investor.
   */
  app.get("/api/iris/investors/:pan/nominee-details", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getNomineeDetails(pan), "IRIS_INVESTOR_NOMINEE_GET", uid, maskPan(pan), t, "IRIS_NOMINEE_DETAILS_FAILED");
  });

  /**
   * GET /api/iris/investors/:pan/fatca-details
   * Get current FATCA / tax residency declaration.
   */
  app.get("/api/iris/investors/:pan/fatca-details", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getFatcaDetails(pan), "IRIS_INVESTOR_FATCA_GET", uid, maskPan(pan), t, "IRIS_FATCA_DETAILS_FAILED");
  });

  /**
   * GET /api/iris/investors/:pan/demat
   * Get all demat accounts linked to an investor.
   * Returns: DP name, DP ID, client ID, account type, status.
   */
  app.get("/api/iris/investors/:pan/demat", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getDematAccounts(pan), "IRIS_INVESTOR_DEMAT_GET", uid, maskPan(pan), t, "IRIS_DEMAT_FAILED");
  });

  // ── Write: contact / regulatory updates ─────────────────────────────────

  /**
   * PUT /api/iris/investors/:pan/email
   * Update investor's registered email address in IRIS.
   *
   * Body: { email: string, otp?: string }
   * SEBI note: email change may require OTP confirmation via IRIS eKYC flow.
   */
  app.put("/api/iris/investors/:pan/email", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_EMAIL_UPDATE", { user_id: uid, pan_masked: maskPan(pan) });
    return wrap(res, () => irisKfintechService.updateEmail(pan, req.body), "IRIS_INVESTOR_EMAIL_UPDATE", uid, maskPan(pan), t, "IRIS_EMAIL_UPDATE_FAILED");
  });

  /**
   * PUT /api/iris/investors/:pan/mobile
   * Update investor's registered mobile number in IRIS.
   *
   * Body: { mobile: string, otp?: string }
   * Mobile change typically triggers SEBI-mandated OTP validation via IRIS.
   */
  app.put("/api/iris/investors/:pan/mobile", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_MOBILE_UPDATE", { user_id: uid, pan_masked: maskPan(pan) });
    return wrap(res, () => irisKfintechService.updateMobile(pan, req.body), "IRIS_INVESTOR_MOBILE_UPDATE", uid, maskPan(pan), t, "IRIS_MOBILE_UPDATE_FAILED");
  });

  /**
   * PUT /api/iris/investors/:pan/nominee
   * Update nominee details for an investor.
   *
   * Body: { nomineeName, nomineeRelation, nomineeDob, nomineeShare, guardianName? }
   * SEBI allows up to 3 nominees with share percentages summing to 100%.
   */
  app.put("/api/iris/investors/:pan/nominee", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_NOMINEE_UPDATE", { user_id: uid, pan_masked: maskPan(pan) });
    return wrap(res, () => irisKfintechService.updateNominee(pan, req.body), "IRIS_INVESTOR_NOMINEE_UPDATE", uid, maskPan(pan), t, "IRIS_NOMINEE_UPDATE_FAILED");
  });

  /**
   * PUT /api/iris/investors/:pan/bank
   * Update bank account details for an investor.
   *
   * Body: { bankAccountNo, ifscCode, bankName, accountType, isPrimary }
   * Note: Bank change requires penny drop verification via IRIS.
   */
  app.put("/api/iris/investors/:pan/bank", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_BANK_UPDATE", { user_id: uid, pan_masked: maskPan(pan) });
    return wrap(res, () => irisKfintechService.updateBankDetails(pan, req.body), "IRIS_INVESTOR_BANK_UPDATE", uid, maskPan(pan), t, "IRIS_BANK_UPDATE_FAILED");
  });

  /**
   * POST /api/iris/investors/:pan/bank-mandate
   * Register or manage a bank mandate (NACH/eNACH) for an investor.
   *
   * Body: { mandateType, bankAccountNo, ifscCode, maxAmount, startDate, endDate }
   */
  app.post("/api/iris/investors/:pan/bank-mandate", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_BANK_MANDATE", { user_id: uid, pan_masked: maskPan(pan), mandate_type: req.body?.mandateType });
    return wrap(res, () => irisKfintechService.manageBankMandate(pan, req.body), "IRIS_INVESTOR_BANK_MANDATE", uid, maskPan(pan), t, "IRIS_BANK_MANDATE_FAILED");
  });

  /**
   * POST /api/iris/investors/:pan/fatca
   * Submit or update FATCA / tax residency declaration for an investor.
   *
   * Body: { taxCountry, taxIdType, taxIdNumber, placeOfBirth, countryOfBirth }
   * SEBI requirement: FATCA must be submitted for NRI/PIO investors.
   */
  app.post("/api/iris/investors/:pan/fatca", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_FATCA_UPDATE", { user_id: uid, pan_masked: maskPan(pan) });
    return wrap(res, () => irisKfintechService.updateFatca(pan, req.body), "IRIS_INVESTOR_FATCA_UPDATE", uid, maskPan(pan), t, "IRIS_FATCA_UPDATE_FAILED");
  });

  /**
   * POST /api/iris/investors/:pan/idcw
   * Update IDCW (Income Distribution cum Capital Withdrawal) preference.
   *
   * Body: { folioNo, schemeCode, idcwOption (payout/reinvest/growth) }
   */
  app.post("/api/iris/investors/:pan/idcw", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.updateIdcw(pan, req.body), "IRIS_INVESTOR_IDCW_UPDATE", uid, maskPan(pan), t, "IRIS_IDCW_UPDATE_FAILED");
  });

  // ── Financial Goals ──────────────────────────────────────────────────────

  /**
   * GET /api/iris/investors/:pan/goals
   * Get all financial goals set by an investor.
   * Returns: goalName, targetAmount, targetDate, currentValue, progress%.
   */
  app.get("/api/iris/investors/:pan/goals", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getGoals(pan), "IRIS_INVESTOR_GOALS_LIST", uid, maskPan(pan), t, "IRIS_GOALS_FAILED");
  });

  /**
   * POST /api/iris/investors/:pan/goals
   * Create a new financial goal for an investor.
   *
   * Body: { goalName, targetAmount, targetDate, category (retirement/education/home/wealth) }
   *
   * FASP-AI advisory note: Goal recommendations must include confidence_score,
   * risk_profile, and investment_horizon. This endpoint stores the goal only
   * — AI recommendations are separate (advisory layer).
   */
  app.post("/api/iris/investors/:pan/goals", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_GOAL_CREATE", { user_id: uid, pan_masked: maskPan(pan), category: req.body?.category });
    return wrap(res, () => irisKfintechService.createGoal(pan, req.body), "IRIS_INVESTOR_GOAL_CREATE", uid, maskPan(pan), t, "IRIS_GOAL_CREATE_FAILED");
  });

  /**
   * PUT /api/iris/investors/:pan/goals/:goalId
   * Update a specific financial goal.
   * Body: { goalName?, targetAmount?, targetDate?, category? }
   */
  app.put("/api/iris/investors/:pan/goals/:goalId", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan, goalId } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.updateGoal(pan, goalId, req.body), "IRIS_INVESTOR_GOAL_UPDATE", uid, maskPan(pan), t, "IRIS_GOAL_UPDATE_FAILED");
  });

  /**
   * DELETE /api/iris/investors/:pan/goals/:goalId
   * Delete a financial goal.
   */
  app.delete("/api/iris/investors/:pan/goals/:goalId", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan, goalId } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_GOAL_DELETE", { user_id: uid, pan_masked: maskPan(pan), goal_id: goalId }, "warn");
    return wrap(res, () => irisKfintechService.deleteGoal(pan, goalId), "IRIS_INVESTOR_GOAL_DELETE", uid, maskPan(pan), t, "IRIS_GOAL_DELETE_FAILED");
  });

  // ── Investor Portal Link ─────────────────────────────────────────────────

  /**
   * GET /api/iris/investors/:pan/portal-link
   * Get the magic-link URL for an investor to access the IRIS investor portal.
   * The link is short-lived (typically 24 hours).
   */
  app.get("/api/iris/investors/:pan/portal-link", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    return wrap(res, () => irisKfintechService.getInvestorPortalLink(pan), "IRIS_INVESTOR_PORTAL_LINK_GET", uid, maskPan(pan), t, "IRIS_PORTAL_LINK_FAILED");
  });

  /**
   * POST /api/iris/investors/:pan/portal-link/send
   * Send the investor portal access link via SMS/email to the investor.
   * Body: { channel: "sms" | "email" | "both" }
   */
  app.post("/api/iris/investors/:pan/portal-link/send", requireAuth, async (req: Request, res: Response) => {
    if (!configured(res)) return;
    const t = Date.now();
    const { pan } = req.params;
    const uid = (req as any).user?.id ?? "system";
    profileLog("IRIS_INVESTOR_PORTAL_LINK_SEND", { user_id: uid, pan_masked: maskPan(pan), channel: req.body?.channel });
    return wrap(res, () => irisKfintechService.sendPortalLinkToInvestor(pan, req.body), "IRIS_INVESTOR_PORTAL_LINK_SEND", uid, maskPan(pan), t, "IRIS_PORTAL_LINK_SEND_FAILED");
  });
}
