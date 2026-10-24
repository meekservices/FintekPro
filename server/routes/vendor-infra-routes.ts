/**
 * Multi-Vendor Infrastructure Routes
 *
 * Exposes endpoints for monitoring and testing FintekPro's multi-vendor infrastructure:
 *   - IRIS (Mutual Funds & Fixed Deposits)
 *   - Upstox (Indian Equities & F&O)
 *   - Alpaca (US Equities & Fractional Shares)
 */

import { Router, Request, Response } from "express";
import { multiVendorInfraService } from "../services/multi-vendor-infra-service";
import { logger } from "../logger";

const router = Router();

/**
 * GET /api/infra/vendors
 * Returns comprehensive multi-vendor diagnostics
 */
router.get("/vendors", async (_req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const report = await multiVendorInfraService.getDiagnostics();
    const statusCode = report.overallStatus === "ALL_OPERATIONAL" ? 200 : 207;

    return res.status(statusCode).json({
      success: true,
      data: report,
      meta: {
        timestamp: new Date().toISOString(),
        latency_ms: Date.now() - t0,
        version: multiVendorInfraService.engineVersion,
      },
    });
  } catch (error: any) {
    logger.error("MULTI_VENDOR_INFRA_ROUTE_ERROR", {
      event: "MULTI_VENDOR_INFRA_ROUTE_ERROR",
      error: error.message,
      latency_ms: Date.now() - t0,
    });
    return res.status(500).json({
      success: false,
      error_code: "INFRA_DIAGNOSTICS_FAILED",
      message: "Failed to collect multi-vendor infrastructure status",
      retryable: true,
    });
  }
});

/**
 * POST /api/infra/vendors/probe
 * Probe an individual vendor on-demand
 */
router.post("/vendors/probe", async (req: Request, res: Response) => {
  const { vendor } = req.body;
  const t0 = Date.now();

  try {
    let result;
    if (vendor === "iris") {
      result = await multiVendorInfraService.probeIris();
    } else if (vendor === "upstox") {
      result = await multiVendorInfraService.probeUpstox();
    } else if (vendor === "alpaca") {
      result = await multiVendorInfraService.probeAlpaca();
    } else {
      const fullReport = await multiVendorInfraService.getDiagnostics();
      return res.json({
        success: true,
        data: fullReport,
        meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
      });
    }

    return res.json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), latency_ms: Date.now() - t0 },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error_code: "VENDOR_PROBE_ERROR",
      message: error.message,
    });
  }
});

export const vendorInfraRoutes = router;
