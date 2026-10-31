/**
 * FintekPro Staff Multi-Vendor Portal Product Governance Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Exposes API endpoints for managing staff access to multi-vendor portal products
 * (Mutual Funds, Upstox Equities & F&O, Alpaca Global, Lending, Insurance, Bonds, AIF/PMS)
 * strictly gated by regulatory parameters (SEBI, RBI, IRDAI, PFRDA):
 *
 *   GET  /api/staff-product-governance/matrix
 *   POST /api/staff-product-governance/evaluate
 *   GET  /api/staff-product-governance/staff/:staffId/eligibility
 *   GET  /api/staff-product-governance/staff/:staffId/authorizations
 *   POST /api/staff-product-governance/staff/:staffId/allocate
 *   POST /api/staff-product-governance/staff/:staffId/check-action
 *
 * FASP-AI GCR v1.0 Compliance:
 * - Structured logging: { event, staff_id, latency_ms, status }
 * - Error format: { error_code, message, retryable }
 * - Response format: { success, data, meta: { timestamp, version, latency_ms } }
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requirePartnerPortal } from "../middleware/roleMiddleware";
import {
  staffProductEligibilityService,
  StaffCredentialsProfile,
  VendorProductCode,
  PRODUCT_GOVERNANCE_ENGINE_VERSION,
} from "../services/staff-product-eligibility-service";
import { logger } from "../logger";

// ── Validation Schemas ───────────────────────────────────────────────────────

const StaffProfileSchema = z.object({
  staffId: z.string().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  role: z.string().default("agent"),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format"),
  panVerified: z.boolean().default(false),
  kycStatus: z.enum(["PENDING", "VERIFIED", "REJECTED"]).default("PENDING"),
  euinNumber: z.string().regex(/^E\d{6}$/).optional(),
  euinVerified: z.boolean().optional(),
  euinValidTo: z.string().optional(),
  pospCertificateNumber: z.string().optional(),
  pospVerified: z.boolean().optional(),
  dsaCode: z.string().optional(),
  dsaVerified: z.boolean().optional(),
  arnCode: z.string().optional(),
  sebiRegNo: z.string().optional(),
  certifications: z
    .array(
      z.object({
        code: z.string().min(2),
        certificateNumber: z.string().optional(),
        validUntil: z.string().optional(),
        isVerified: z.boolean().optional(),
      })
    )
    .optional(),
  yearsOfExperience: z.number().min(0).max(50).default(0),
});

const AllocateProductsSchema = z.object({
  requestedProductCodes: z.array(
    z.enum([
      "mutual_funds",
      "sif",
      "equity_cash",
      "equity_derivatives",
      "currency_commodity",
      "global_equities",
      "lending_loans",
      "insurance",
      "fixed_income_bonds",
      "aif_pms",
      "nps",
    ])
  ).min(1, "At least one product code must be requested"),
  staffProfile: StaffProfileSchema,
});

const CheckActionSchema = z.object({
  productCategory: z.enum([
    "mutual_funds",
    "sif",
    "equity_cash",
    "equity_derivatives",
    "currency_commodity",
    "global_equities",
    "lending_loans",
    "insurance",
    "fixed_income_bonds",
    "aif_pms",
    "nps",
  ]),
  action: z.enum(["READ", "EXECUTE"]).default("EXECUTE"),
});

// ── Response Helpers ────────────────────────────────────────────────────────

function sendOk(res: Response, data: unknown, startMs: number, meta: Record<string, unknown> = {}) {
  res.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: "fintekpro-multivendor-gov-v1",
      engine_version: PRODUCT_GOVERNANCE_ENGINE_VERSION,
      latency_ms: Date.now() - startMs,
      ...meta,
    },
  });
}

function sendErr(
  res: Response,
  status: number,
  errorCode: string,
  message: string,
  startMs: number,
  retryable = false,
  extra: Record<string, unknown> = {}
) {
  res.status(status).json({
    success: false,
    error: {
      error_code: errorCode,
      message,
      retryable,
      ...extra,
    },
    meta: {
      timestamp: new Date().toISOString(),
      version: "fintekpro-multivendor-gov-v1",
      latency_ms: Date.now() - startMs,
    },
  });
}

// ── Route Registration ───────────────────────────────────────────────────────

export function registerStaffProductEligibilityRoutes(app: Express): void {
  const requireUser = requireAuth;
  const requirePartnerOrAdmin = requirePartnerPortal;

  /**
   * GET /api/staff-product-governance/matrix
   * Multi-vendor product catalog with regulatory authorities and statutory requirements.
   */
  app.get("/api/staff-product-governance/matrix", requireUser, (req: Request, res: Response) => {
    const t = Date.now();
    const matrix = staffProductEligibilityService.getVendorProductMatrix();
    sendOk(res, matrix, t, { totalProducts: matrix.length });
  });

  /**
   * POST /api/staff-product-governance/evaluate
   * Evaluate a candidate/staff profile across all multi-vendor products.
   */
  app.post("/api/staff-product-governance/evaluate", requireUser, (req: Request, res: Response) => {
    const t = Date.now();
    const parsed = StaffProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendErr(
        res,
        400,
        "INVALID_PROFILE_DATA",
        parsed.error.issues.map((i) => i.message).join("; "),
        t,
        false
      );
    }

    try {
      const report = staffProductEligibilityService.evaluateStaffProductEligibility(
        parsed.data as StaffCredentialsProfile
      );
      sendOk(res, report, t, {
        authorizedCount: report.summary.authorizedCount,
        readOnlyCount: report.summary.readOnlyCount,
        blockedCount: report.summary.blockedCount,
      });
    } catch (err: any) {
      sendErr(res, 500, "EVALUATION_FAILED", err.message, t, true);
    }
  });

  /**
   * GET /api/staff-product-governance/staff/:staffId/authorizations
   * Get active allocated vendor products for a staff member.
   */
  app.get(
    "/api/staff-product-governance/staff/:staffId/authorizations",
    requirePartnerOrAdmin,
    async (req: Request, res: Response) => {
      const t = Date.now();
      const { staffId } = req.params;

      try {
        const auths = await staffProductEligibilityService.getStaffAuthorizedProducts(staffId);
        sendOk(res, auths, t, { count: auths.length });
      } catch (err: any) {
        sendErr(res, 500, "FETCH_AUTHORIZATIONS_FAILED", err.message, t, true);
      }
    }
  );

  /**
   * POST /api/staff-product-governance/staff/:staffId/allocate
   * Allocate multi-vendor products to a staff member with regulatory gate checks.
   */
  app.post(
    "/api/staff-product-governance/staff/:staffId/allocate",
    requirePartnerOrAdmin,
    async (req: Request, res: Response) => {
      const t = Date.now();
      const uid = (req as any).user?.id ?? "system";
      const { staffId } = req.params;
      const parsed = AllocateProductsSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendErr(
          res,
          400,
          "INVALID_ALLOCATION_INPUT",
          parsed.error.issues.map((i) => i.message).join("; "),
          t,
          false
        );
      }

      try {
        const { requestedProductCodes, staffProfile } = parsed.data;
        const result = await staffProductEligibilityService.allocateStaffProducts(
          staffId,
          requestedProductCodes as VendorProductCode[],
          { ...staffProfile, staffId } as StaffCredentialsProfile,
          uid
        );

        if (result.allocatedProducts.length === 0 && result.rejectedProducts.length > 0) {
          return sendErr(
            res,
            422,
            "ALL_PRODUCTS_REJECTED",
            "None of the requested products could be allocated due to regulatory ineligibility.",
            t,
            false,
            { rejectedProducts: result.rejectedProducts }
          );
        }

        sendOk(res, result, t, {
          grantedCount: result.summary.granted,
          rejectedCount: result.summary.rejected,
        });
      } catch (err: any) {
        sendErr(res, 500, "ALLOCATION_FAILED", err.message, t, true);
      }
    }
  );

  /**
   * POST /api/staff-product-governance/staff/:staffId/check-action
   * Fast runtime execution check for a staff member against a product category.
   */
  app.post(
    "/api/staff-product-governance/staff/:staffId/check-action",
    requireUser,
    async (req: Request, res: Response) => {
      const t = Date.now();
      const { staffId } = req.params;
      const parsed = CheckActionSchema.safeParse(req.body);

      if (!parsed.success) {
        return sendErr(res, 400, "INVALID_CHECK_INPUT", parsed.error.issues[0].message, t);
      }

      try {
        const { productCategory, action } = parsed.data;
        const check = await staffProductEligibilityService.canStaffManageProduct(
          staffId,
          productCategory as VendorProductCode,
          action
        );

        sendOk(res, check, t, { staffId, productCategory, action });
      } catch (err: any) {
        sendErr(res, 500, "CHECK_FAILED", err.message, t, true);
      }
    }
  );
}

