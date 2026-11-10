/**
 * @file custody-orchestration-routes.ts
 * @description Dedicated API Routes for Multi-Asset Custody & Execution Orchestration.
 *
 * Exposes:
 * - GET  /api/custody/providers       : Returns profiles and fee benchmarks for Upstox, Orbis, and Bank Custodians
 * - GET  /api/custody/economics       : Real-time economics and fee comparison calculator
 * - POST /api/custody/route/mf        : Route a Mutual Fund order (Upstox MF vs ICCL)
 * - POST /api/custody/route/pms       : Route a PMS order (Upstox Direct Demat vs Hybrid Orbis CP)
 * - POST /api/custody/route/aif       : Route an AIF allocation (Upstox Cat III vs Cat I/II Escrow)
 *
 * @engineVersion SEBI-CUSTODY-ORCHESTRATOR-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.1
 */

import { type Express, type Request, type Response } from "express";
import {
  multiAssetCustodyOrchestrator,
  CUSTODY_PROVIDERS,
  type ProductType,
} from "../services/multi-asset-custody-orchestrator";
import { logger } from "../logger";

export function registerCustodyOrchestrationRoutes(app: Express): void {
  /**
   * GET /api/custody/providers
   * Returns list of supported custody providers, fee schedules, and integration modes.
   */
  app.get("/api/custody/providers", (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      data: Object.values(CUSTODY_PROVIDERS),
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        governingFramework: "SEBI IA / PMS / AIF Custody & Settlement Regulations",
      },
    });
  });

  /**
   * GET /api/custody/economics
   * Compare total annual custody, execution, and settlement fees across providers.
   * Query params: product (MUTUAL_FUND | PMS | AIF), aum, annualTrades
   */
  app.get("/api/custody/economics", (req: Request, res: Response) => {
    try {
      const product = (req.query.product as ProductType) || "PMS";
      const aum = parseFloat(req.query.aum as string) || 10_000_000; // Default ₹1 Cr
      const annualTrades = req.query.annualTrades ? parseInt(req.query.annualTrades as string, 10) : 120;

      if (isNaN(aum) || aum <= 0) {
        return res.status(400).json({
          success: false,
          error: "INVALID_AUM",
          message: "AUM must be a positive number.",
        });
      }

      const comparison = multiAssetCustodyOrchestrator.calculateCustodyAndExecutionEconomics({
        product,
        aum,
        annualTrades,
      });

      return res.status(200).json({
        success: true,
        data: comparison,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[CustodyRoutes] Economics calculation error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "CALCULATION_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * POST /api/custody/route/mf
   * Route a Mutual Fund transaction via Upstox API v2 or ICCL
   */
  app.post("/api/custody/route/mf", async (req: Request, res: Response) => {
    try {
      const { isin, fundName, amount, transactionType, preferredGateway, folioNumber } = req.body;
      const userId = (req as any).user?.id || req.body.userId || "anonymous_user";

      if (!isin || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          error: "INVALID_MF_PAYLOAD",
          message: "ISIN and valid amount are required.",
        });
      }

      const result = await multiAssetCustodyOrchestrator.routeMutualFundOrder({
        userId,
        isin,
        fundName: fundName || isin,
        amount: Number(amount),
        transactionType: transactionType || "BUY",
        preferredGateway,
        folioNumber,
      });

      return res.status(200).json({
        success: result.success,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[CustodyRoutes] MF route error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "MF_ROUTING_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * POST /api/custody/route/pms
   * Route a Portfolio Management Services (PMS) onboarding or order.
   * Enforces SEBI Regulation 23(2) ₹50L minimum floor.
   */
  app.post("/api/custody/route/pms", async (req: Request, res: Response) => {
    try {
      const { pmsName, investmentAmount, executionModel, clientDematAccount, formCAcknowledged } = req.body;
      const userId = (req as any).user?.id || req.body.userId || "anonymous_user";

      if (!investmentAmount || isNaN(Number(investmentAmount))) {
        return res.status(400).json({
          success: false,
          error: "INVALID_INVESTMENT_AMOUNT",
          message: "A valid investment amount is required.",
        });
      }

      const result = await multiAssetCustodyOrchestrator.routePmsOrder({
        userId,
        pmsName: pmsName || "FintekPro Multi-Asset PMS",
        investmentAmount: Number(investmentAmount),
        executionModel: executionModel === "discretionary" ? "discretionary" : "non_discretionary",
        clientDematAccount,
        formCAcknowledged: Boolean(formCAcknowledged),
      });

      const statusCode = result.success ? 200 : 422;
      return res.status(statusCode).json({
        success: result.success,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[CustodyRoutes] PMS route error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "PMS_ROUTING_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * POST /api/custody/route/aif
   * Route an Alternative Investment Fund (AIF) allocation.
   * Enforces SEBI Regulation 10(c) ₹1 Crore commitment floor.
   */
  app.post("/api/custody/route/aif", async (req: Request, res: Response) => {
    try {
      const { aifCategory, fundName, committedCapital, initialDrawdownAmount, isAccreditedInvestor } = req.body;
      const userId = (req as any).user?.id || req.body.userId || "anonymous_user";

      if (!committedCapital || isNaN(Number(committedCapital))) {
        return res.status(400).json({
          success: false,
          error: "INVALID_COMMITTED_CAPITAL",
          message: "Committed capital is required.",
        });
      }

      const result = await multiAssetCustodyOrchestrator.routeAifOrder({
        userId,
        aifCategory: aifCategory || "CAT_III",
        fundName: fundName || "FintekPro Multi-Strategy AIF",
        committedCapital: Number(committedCapital),
        initialDrawdownAmount: Number(initialDrawdownAmount || committedCapital * 0.25),
        isAccreditedInvestor: Boolean(isAccreditedInvestor),
      });

      const statusCode = result.success ? 200 : 422;
      return res.status(statusCode).json({
        success: result.success,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[CustodyRoutes] AIF route error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "AIF_ROUTING_FAILED",
        message: err.message,
      });
    }
  });
}

