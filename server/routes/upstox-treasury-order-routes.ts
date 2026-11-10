/**
 * upstox-treasury-order-routes.ts
 *
 * REST API Routes for Secondary Market Debt & Treasury Execution via Upstox API v3.
 *
 * Endpoints:
 *  - POST /api/treasury/secondary-market/orders/preview  (Pre-trade clean/dirty price, accrued interest, statutory charges)
 *  - POST /api/treasury/secondary-market/orders/place    (Automated Limit/Market order placement with Delivery "D")
 *  - GET  /api/treasury/secondary-market/orders/:orderNumber/status (Live order tracking & status reconciliation)
 *
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 *
 * @module upstox-treasury-order-routes
 * @version 3.0.0-TREASURY-EXEC
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { logger } from "../logger";
import {
  upstoxTreasuryExecutionService,
  TREASURY_EXEC_ENGINE_VERSION,
} from "../services/execution/upstox-treasury-execution-service";

export const upstoxTreasuryOrderRouter = Router();

// ── Validation Schemas ───────────────────────────────────────────────────────

const debtOrderPreviewSchema = z.object({
  isin: z.string().min(10).max(12),
  symbol: z.string().optional(),
  bondType: z.enum(["g_sec", "t_bill", "sdl", "sgb", "corporate"]),
  bondName: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  orderType: z.enum(["LIMIT", "MARKET"]),
  quantity: z.number().int().positive(),
  cleanPrice: z.number().positive(),
  faceValue: z.number().positive().optional().default(100),
  couponRate: z.number().nonnegative().optional().default(0),
  lastCouponDate: z.string().optional(),
  settlementDate: z.string().optional(),
  brokerageBps: z.number().nonnegative().optional().default(5),
});

const placeDebtOrderSchema = z.object({
  userId: z.string().optional(),
  isin: z.string().min(10).max(12),
  symbol: z.string().optional(),
  bondType: z.enum(["g_sec", "t_bill", "sdl", "sgb", "corporate"]),
  bondName: z.string().min(1),
  side: z.enum(["BUY", "SELL"]),
  orderType: z.enum(["LIMIT", "MARKET"]),
  quantity: z.number().int().positive(),
  limitPrice: z.number().positive().optional(),
  faceValue: z.number().positive().optional().default(100),
  couponRate: z.number().nonnegative().optional().default(0),
  lastCouponDate: z.string().optional(),
  exchange: z.enum(["NSE", "BSE"]).optional().default("NSE"),
  validity: z.enum(["DAY", "IOC"]).optional().default("DAY"),
  idempotencyKey: z.string().optional(),
  slice: z.boolean().optional().default(false),
  remarks: z.string().optional(),
}).refine(
  (data) => data.orderType !== "LIMIT" || (data.limitPrice !== undefined && data.limitPrice > 0),
  { message: "limitPrice is mandatory and must be > 0 for LIMIT orders", path: ["limitPrice"] }
);

// ── Endpoints ────────────────────────────────────────────────────────────────

/**
 * POST /api/treasury/secondary-market/orders/preview
 * Pre-trade clean vs. dirty price, accrued interest, statutory charges, and net settlement calculation.
 */
upstoxTreasuryOrderRouter.post("/preview", (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const parseResult = debtOrderPreviewSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error_code: "INVALID_ORDER_PREVIEW_INPUT",
        message: parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        retryable: false,
      });
    }

    const preview = upstoxTreasuryExecutionService.previewDebtOrder(parseResult.data);

    return res.json({
      success: true,
      data: preview,
      meta: {
        timestamp: new Date().toISOString(),
        version: TREASURY_EXEC_ENGINE_VERSION,
        latency_ms: Date.now() - t0,
      },
    });
  } catch (err: any) {
    logger.error("[UpstoxTreasuryRoutes] Preview error", { error: err.message });
    return res.status(500).json({
      success: false,
      error_code: "PREVIEW_CALCULATION_ERROR",
      message: err.message || "Failed to calculate debt order preview",
      retryable: true,
    });
  }
});

/**
 * POST /api/treasury/secondary-market/orders/place
 * Dispatches an automated limit or market order for G-Secs or T-Bills to Upstox API v3 using product "D".
 */
upstoxTreasuryOrderRouter.post("/place", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const parseResult = placeDebtOrderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error_code: "INVALID_DEBT_ORDER_INPUT",
        message: parseResult.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        retryable: false,
      });
    }

    const userId = (req as any).user?.id?.toString() || parseResult.data.userId || "system";

    const executionResult = await upstoxTreasuryExecutionService.placeDebtOrder({
      ...parseResult.data,
      userId,
    });

    return res.status(200).json({
      success: true,
      data: executionResult,
      meta: {
        timestamp: new Date().toISOString(),
        version: TREASURY_EXEC_ENGINE_VERSION,
        latency_ms: Date.now() - t0,
      },
    });
  } catch (err: any) {
    logger.error("[UpstoxTreasuryRoutes] Order placement error", { error: err.message });
    return res.status(500).json({
      success: false,
      error_code: "ORDER_EXECUTION_ERROR",
      message: err.message || "Upstox debt order execution failed",
      retryable: false,
    });
  }
});

/**
 * GET /api/treasury/secondary-market/orders/:orderNumber/status
 * Fetches current execution status from Upstox and synchronizes with bond_orders table.
 */
upstoxTreasuryOrderRouter.get("/:orderNumber/status", async (req: Request, res: Response) => {
  const t0 = Date.now();
  try {
    const { orderNumber } = req.params;
    const userId = (req as any).user?.id?.toString();

    const statusResult = await upstoxTreasuryExecutionService.getDebtOrderStatus(orderNumber, userId);

    return res.json({
      success: true,
      data: statusResult,
      meta: {
        timestamp: new Date().toISOString(),
        version: TREASURY_EXEC_ENGINE_VERSION,
        latency_ms: Date.now() - t0,
      },
    });
  } catch (err: any) {
    logger.error("[UpstoxTreasuryRoutes] Status polling error", { error: err.message });
    return res.status(404).json({
      success: false,
      error_code: "ORDER_NOT_FOUND",
      message: err.message || "Failed to retrieve debt order status",
      retryable: false,
    });
  }
});
