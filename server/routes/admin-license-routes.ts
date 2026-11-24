/**
 * Admin License & Desk Activation Routes — FintekPro Financial Services LLP
 *
 * REST Endpoints for Admin to:
 * - Enter and update statutory licenses (AMFI Corporate ARN, Upstox AP, Alpaca Broker Partner, SEBI RIA)
 * - Toggle global operating mode between TEST_SANDBOX and PRODUCTION_LIVE
 * - Upload and verify partnership contracts and regulatory certificates
 * - Run simulated sandbox orders for end-to-end verification
 *
 * Architecture:
 * - Express Router
 * - Strictly typed with Zod validation
 * - Standard FintekPro API response: { success, data, meta: { timestamp, version } }
 *
 * @engineVersion FINTEK-DESK-ROUTES-v1.0
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { deskGatewayService } from "../services/desk-gateway-service";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../logger";
import { DESK_TYPES, OPERATING_MODES, LICENSE_DOC_TYPES, DOC_VERIFICATION_STATUSES } from "@shared/schema";

export const adminLicenseRouter = Router();
const API_VERSION = "v1.0.0";

// Response Helpers
function ok(res: Response, data: unknown, meta?: Record<string, unknown>) {
  return res.status(200).json({
    success: true,
    data,
    meta: { timestamp: new Date().toISOString(), version: API_VERSION, ...meta },
  });
}

function errResp(res: Response, errorCode: string, message: string, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: { error_code: errorCode, message, retryable: false },
    meta: { timestamp: new Date().toISOString(), version: API_VERSION },
  });
}

// ── GET /api/admin/desks/status ─────────────────────────────────────────────
// Returns full configuration of FintekPro LLP desks, licenses, and document checklist.
adminLicenseRouter.get("/status", async (req: Request, res: Response) => {
  try {
    const summary = await deskGatewayService.getStatusSummary();
    return ok(res, summary);
  } catch (error: any) {
    logger.error("ADMIN_DESKS_STATUS_ERROR", { error: error.message });
    return errResp(res, "DESK_STATUS_ERROR", error.message, 500);
  }
});

// ── POST /api/admin/desks/mode ──────────────────────────────────────────────
// Toggles global operating mode (TEST_SANDBOX | RESTRICTED_PILOT | PRODUCTION_LIVE)
const updateModeSchema = z.object({
  operatingMode: z.enum(OPERATING_MODES),
});

adminLicenseRouter.post("/mode", requireAdmin, async (req: Request, res: Response) => {
  const parsed = updateModeSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const adminId = (req as any).user?.id || "ADMIN_CONSOLE";
  try {
    const newTier = await deskGatewayService.updateOperatingMode(parsed.data.operatingMode, adminId);
    const summary = await deskGatewayService.getStatusSummary();
    return ok(res, {
      operatingMode: parsed.data.operatingMode,
      capabilityTier: newTier,
      summary,
    });
  } catch (error: any) {
    logger.error("ADMIN_DESK_MODE_UPDATE_ERROR", { error: error.message });
    return errResp(res, "MODE_UPDATE_ERROR", error.message, 500);
  }
});

// ── POST /api/admin/desks/licenses ──────────────────────────────────────────
// Upserts license details (e.g. ARN number, Upstox AP ID, Alpaca credentials)
const upsertLicenseSchema = z.object({
  deskType: z.enum(DESK_TYPES),
  licenseNumber: z.string().optional(),
  holderName: z.string().optional(),
  issueDate: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
  partnerCredentials: z.record(z.string(), z.any()).optional(),
  isSandboxed: z.boolean().optional(),
});

adminLicenseRouter.post("/licenses", requireAdmin, async (req: Request, res: Response) => {
  const parsed = upsertLicenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const adminId = (req as any).user?.id || "ADMIN_CONSOLE";
  const { deskType, licenseNumber, holderName, issueDate, validUntil, partnerCredentials, isSandboxed } = parsed.data;

  try {
    await deskGatewayService.upsertLicense({
      deskType,
      licenseNumber,
      holderName,
      issueDate: issueDate ? new Date(issueDate) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      partnerCredentials,
      isSandboxed,
      adminId,
    });

    const summary = await deskGatewayService.getStatusSummary();
    return ok(res, {
      message: `Statutory license for ${deskType} saved successfully.`,
      summary,
    });
  } catch (error: any) {
    logger.error("ADMIN_DESK_LICENSE_UPSERT_ERROR", { error: error.message });
    return errResp(res, "LICENSE_UPSERT_ERROR", error.message, 500);
  }
});

// ── POST /api/admin/desks/licenses/:licenseId/documents ─────────────────────
// Registers an uploaded partnership or regulatory document
const uploadDocSchema = z.object({
  documentType: z.enum(LICENSE_DOC_TYPES),
  fileName: z.string().min(1),
  fileUrl: z.string().min(1),
  fileHashSha256: z.string().min(10),
});

adminLicenseRouter.post(
  "/licenses/:licenseId/documents",
  requireAdmin,
  async (req: Request, res: Response) => {
    const { licenseId } = req.params;
    const parsed = uploadDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return errResp(res, "VALIDATION_ERROR", parsed.error.message);
    }

    const adminId = (req as any).user?.id || "ADMIN_CONSOLE";
    try {
      const docId = await deskGatewayService.recordDocumentUpload({
        licenseId,
        documentType: parsed.data.documentType,
        fileName: parsed.data.fileName,
        fileUrl: parsed.data.fileUrl,
        fileHashSha256: parsed.data.fileHashSha256,
        adminId,
      });

      return ok(res, {
        documentId: docId,
        message: "Document registered under review successfully.",
      });
    } catch (error: any) {
      logger.error("ADMIN_DOC_UPLOAD_ERROR", { error: error.message });
      return errResp(res, "DOC_UPLOAD_ERROR", error.message, 500);
    }
  },
);

// ── POST /api/admin/desks/documents/:documentId/verify ──────────────────────
// Approves/rejects a verification document and auto-recalculates capability tier
const verifyDocSchema = z.object({
  status: z.enum(DOC_VERIFICATION_STATUSES),
  verificationNotes: z.string().optional(),
});

adminLicenseRouter.post(
  "/documents/:documentId/verify",
  requireAdmin,
  async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const parsed = verifyDocSchema.safeParse(req.body);
    if (!parsed.success) {
      return errResp(res, "VALIDATION_ERROR", parsed.error.message);
    }

    const adminId = (req as any).user?.id || "ADMIN_CONSOLE";
    try {
      const result = await deskGatewayService.verifyDocument({
        documentId,
        status: parsed.data.status,
        verificationNotes: parsed.data.verificationNotes,
        adminId,
      });

      return ok(res, {
        documentId,
        status: parsed.data.status,
        newCapabilityTier: result.capabilityTier,
        newLicenseStatus: result.licenseStatus,
      });
    } catch (error: any) {
      logger.error("ADMIN_DOC_VERIFY_ERROR", { error: error.message });
      return errResp(res, "DOC_VERIFY_ERROR", error.message, 500);
    }
  },
);

// ── POST /api/admin/desks/simulate-order ─────────────────────────────────────
// Executes a simulated transaction under sandbox test conditions
const simulateOrderSchema = z.object({
  deskType: z.enum(DESK_TYPES),
  symbolOrScheme: z.string().min(1),
  amount: z.number().positive(),
  action: z.enum(["BUY", "SELL", "SIP", "SCREEN"]),
});

adminLicenseRouter.post("/simulate-order", async (req: Request, res: Response) => {
  const parsed = simulateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  try {
    const result = await deskGatewayService.executeSimulatedOrder(parsed.data);
    return ok(res, result);
  } catch (error: any) {
    logger.error("ADMIN_SIMULATE_ORDER_ERROR", { error: error.message });
    return errResp(res, "SIMULATE_ORDER_ERROR", error.message, 500);
  }
});

// ── GET /api/admin/desks/resolve-mode/:deskType ──────────────────────────────
// Pre-flight execution check for a specific desk
adminLicenseRouter.get("/resolve-mode/:deskType", async (req: Request, res: Response) => {
  const deskType = req.params.deskType as any;
  if (!DESK_TYPES.includes(deskType)) {
    return errResp(res, "INVALID_DESK", `Valid desks: ${DESK_TYPES.join(", ")}`);
  }

  try {
    const resolution = await deskGatewayService.resolveExecutionMode(deskType);
    return ok(res, resolution);
  } catch (error: any) {
    logger.error("ADMIN_RESOLVE_MODE_ERROR", { error: error.message });
    return errResp(res, "RESOLVE_MODE_ERROR", error.message, 500);
  }
});

// ── GET /api/admin/desks/circuits ───────────────────────────────────────────
// Query health and metrics of all partner circuits (Upstox, IRIS, Alpaca, Finvu, Angel One)
adminLicenseRouter.get("/circuits", async (_req: Request, res: Response) => {
  const { partnerCircuitBreaker } = await import("../services/partner-circuit-breaker");
  return ok(res, partnerCircuitBreaker.getCircuitStatuses());
});

// ── POST /api/admin/desks/circuits/:provider/reset ──────────────────────────
// Reset partner circuit manually
adminLicenseRouter.post("/circuits/:provider/reset", requireAdmin, async (req: Request, res: Response) => {
  const provider = req.params.provider.toUpperCase() as any;
  const { partnerCircuitBreaker } = await import("../services/partner-circuit-breaker");
  partnerCircuitBreaker.resetCircuit(provider);
  return ok(res, { message: `Circuit for ${provider} has been reset to CLOSED.` });
});

// ── POST /api/admin/desks/reconciliation/test ───────────────────────────────
// Runs a dual-RTA test parse & reconciliation
adminLicenseRouter.post("/reconciliation/test", async (req: Request, res: Response) => {
  const { dualRtaReconciliationService } = await import("../services/dual-rta-reconciliation-service");
  const sampleWbr2 = req.body.feedContent || `
AMC_HDFC|HDFC101|F1234567|ABCDE1234F|PURCHASE|2026-11-20|50000|500.00|100.00|TX_REF_001
AMC_ICICI|ICICI202|F7654321|BCDEF2345G|SIP|2026-11-20|10000|100.00|100.00|TX_REF_002
  `.trim();

  const records = dualRtaReconciliationService.parseWbr2Feed("CAMS", sampleWbr2);
  const recon = dualRtaReconciliationService.reconcileTransactions(records, [
    { ref: "TX_REF_001", amount: 50000, schemeCode: "HDFC101" },
    { ref: "TX_REF_002", amount: 10000, schemeCode: "ICICI202" },
  ]);

  return ok(res, { records, reconciliation: recon });
});

// ── GET /api/admin/desks/ca-saas/tiers ──────────────────────────────────────
// Returns available CA Practice Cockpit SaaS tiers
adminLicenseRouter.get("/ca-saas/tiers", async (_req: Request, res: Response) => {
  const { caSaasSubscriptionService } = await import("../services/ca-saas-subscription-service");
  return ok(res, caSaasSubscriptionService.getAvailableTiers());
});

// ── POST /api/admin/desks/ca-saas/invoice-preview ───────────────────────────
// Itemized tax invoice preview adhering to CCPA zero-drip pricing
const invoicePreviewSchema = z.object({
  tierKey: z.enum(["CA_STARTER", "CA_PROFESSIONAL", "CA_ENTERPRISE"]),
  billingCycle: z.enum(["MONTHLY", "ANNUAL"]),
  supplierStateCode: z.string().optional(),
  clientStateCode: z.string().optional(),
});

adminLicenseRouter.post("/ca-saas/invoice-preview", async (req: Request, res: Response) => {
  const parsed = invoicePreviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const { caSaasSubscriptionService } = await import("../services/ca-saas-subscription-service");
  try {
    const invoice = caSaasSubscriptionService.calculateInvoice(parsed.data);
    return ok(res, invoice);
  } catch (error: any) {
    return errResp(res, "INVOICE_CALCULATION_ERROR", error.message, 400);
  }
});

// ── GET /api/admin/desks/products/partners ──────────────────────────────────
// Returns all products and their multi-partner configurations
adminLicenseRouter.get("/products/partners", async (_req: Request, res: Response) => {
  const { multiPartnerRouterService } = await import("../services/multi-partner-router-service");
  return ok(res, multiPartnerRouterService.getAllProductPartners());
});

// ── GET /api/admin/desks/products/:product/partners ─────────────────────────
// Returns partners configured for a specific product
adminLicenseRouter.get("/products/:product/partners", async (req: Request, res: Response) => {
  const productType = req.params.product.toUpperCase() as any;
  const { multiPartnerRouterService } = await import("../services/multi-partner-router-service");
  try {
    const partners = multiPartnerRouterService.getPartnersForProduct(productType);
    return ok(res, partners);
  } catch (error: any) {
    return errResp(res, "INVALID_PRODUCT_TYPE", error.message, 400);
  }
});

// ── POST /api/admin/desks/products/:product/route ────────────────────────────
// Resolves best active partner with auto-failover if primary is tripped
const resolveRouteSchema = z.object({
  preferredProviderKey: z.string().optional(),
});

adminLicenseRouter.post("/products/:product/route", async (req: Request, res: Response) => {
  const productType = req.params.product.toUpperCase() as any;
  const parsed = resolveRouteSchema.safeParse(req.body);
  const preferredKey = parsed.success ? (parsed.data.preferredProviderKey as any) : undefined;

  const { multiPartnerRouterService } = await import("../services/multi-partner-router-service");
  try {
    const resolution = multiPartnerRouterService.resolveActivePartner(productType, preferredKey);
    return ok(res, resolution);
  } catch (error: any) {
    return errResp(res, "ROUTING_RESOLUTION_ERROR", error.message, 400);
  }
});

// ── PATCH /api/admin/desks/products/:product/partners/:provider/status ──────
// Updates partner status & priority (Admin toggle)
const updatePartnerStatusSchema = z.object({
  status: z.enum(["ACTIVE_PRIMARY", "ACTIVE_SECONDARY", "STANDBY_FALLBACK", "MAINTENANCE", "DISABLED"]),
  priorityOrder: z.number().int().min(1).max(10).optional(),
});

adminLicenseRouter.patch("/products/:product/partners/:provider/status", requireAdmin, async (req: Request, res: Response) => {
  const productType = req.params.product.toUpperCase() as any;
  const providerKey = req.params.provider.toUpperCase() as any;
  const parsed = updatePartnerStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const { multiPartnerRouterService } = await import("../services/multi-partner-router-service");
  try {
    const updated = multiPartnerRouterService.updatePartnerStatus(
      productType,
      providerKey,
      parsed.data.status,
      parsed.data.priorityOrder
    );
    return ok(res, updated);
  } catch (error: any) {
    return errResp(res, "UPDATE_PARTNER_ERROR", error.message, 400);
  }
});

// ── GET /api/admin/desks/fd/schemes ─────────────────────────────────────────
// Returns available corporate FD schemes (Bajaj, Shriram, Mahindra, Utkarsh)
adminLicenseRouter.get("/fd/schemes", async (_req: Request, res: Response) => {
  const { corporateFdService } = await import("../services/corporate-fd-service");
  return ok(res, corporateFdService.getAvailableSchemes());
});

// ── POST /api/admin/desks/fd/calculate ──────────────────────────────────────
// Calculates corporate FD maturity value, interest payout, and TDS
const calculateFdSchema = z.object({
  schemeKey: z.string(),
  principalAmount: z.number().positive(),
  tenureMonths: z.number().int().positive(),
  isSeniorCitizen: z.boolean().optional(),
  isWomanInvestor: z.boolean().optional(),
  payoutFrequency: z.enum(["CUMULATIVE", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"]).optional(),
});

adminLicenseRouter.post("/fd/calculate", async (req: Request, res: Response) => {
  const parsed = calculateFdSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const { corporateFdService } = await import("../services/corporate-fd-service");
  try {
    const calculation = corporateFdService.calculateMaturity(parsed.data);
    return ok(res, calculation);
  } catch (error: any) {
    return errResp(res, "FD_CALCULATION_ERROR", error.message, 400);
  }
});

// ── POST /api/admin/desks/fd/simulate-booking ───────────────────────────────
// Simulates digital corporate FD booking
const simulateFdBookingSchema = z.object({
  schemeKey: z.string(),
  principalAmount: z.number().positive(),
  tenureMonths: z.number().int().positive(),
  investorPan: z.string().min(10).max(10),
  investorName: z.string().min(2),
  bankAccountNumber: z.string().min(5),
  ifscCode: z.string().min(5),
  nomineeName: z.string().min(2),
  nomineeRelation: z.string().min(2),
  isSeniorCitizen: z.boolean().optional(),
  isWomanInvestor: z.boolean().optional(),
  payoutFrequency: z.enum(["CUMULATIVE", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "ANNUAL"]).optional(),
});

adminLicenseRouter.post("/fd/simulate-booking", async (req: Request, res: Response) => {
  const parsed = simulateFdBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const { corporateFdService } = await import("../services/corporate-fd-service");
  try {
    const result = corporateFdService.simulateBooking(parsed.data);
    return ok(res, result);
  } catch (error: any) {
    return errResp(res, "FD_BOOKING_ERROR", error.message, 400);
  }
});

// ── POST /api/admin/desks/lamf/evaluate ─────────────────────────────────────
// Evaluates portfolio holdings for Loan Against Mutual Funds (LAMF)
const evaluateLamfSchema = z.object({
  holdings: z.array(
    z.object({
      schemeCode: z.string(),
      schemeName: z.string(),
      category: z.enum(["EQUITY", "HYBRID", "DEBT", "LIQUID"]),
      currentNav: z.number(),
      units: z.number(),
      currentValue: z.number().optional().default(0),
      costValue: z.number().optional().default(0),
      folioNumber: z.string().optional().default("FOLIO_DEFAULT"),
      rta: z.enum(["CAMS", "KFINTECH"]).optional().default("CAMS"),
    })
  ),
});

adminLicenseRouter.post("/lamf/evaluate", async (req: Request, res: Response) => {
  const parsed = evaluateLamfSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const { lamfCreditService } = await import("../services/lamf-credit-service");
  try {
    const evaluation = lamfCreditService.evaluatePortfolio(parsed.data.holdings as any);
    return ok(res, evaluation);
  } catch (error: any) {
    return errResp(res, "LAMF_EVALUATION_ERROR", error.message, 400);
  }
});

// ── POST /api/admin/desks/lamf/tax-savings ──────────────────────────────────
// Calculates avoided capital gains tax and retained compounding of LAMF vs Selling
const lamfTaxSavingsSchema = z.object({
  withdrawalAmount: z.number().positive(),
  tenureMonths: z.number().int().positive(),
  assumedAnnualPortfolioReturnPercent: z.number().optional(),
  holdingPeriodIsLongTerm: z.boolean().optional(),
  costBasisRatio: z.number().optional(),
});

adminLicenseRouter.post("/lamf/tax-savings", async (req: Request, res: Response) => {
  const parsed = lamfTaxSavingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return errResp(res, "VALIDATION_ERROR", parsed.error.message);
  }

  const { lamfCreditService } = await import("../services/lamf-credit-service");
  try {
    const comparison = lamfCreditService.calculateTaxSavings(parsed.data);
    return ok(res, comparison);
  } catch (error: any) {
    return errResp(res, "TAX_SAVINGS_CALCULATION_ERROR", error.message, 400);
  }
});
