/**
 * @file pms-fee-routes.ts
 * @description Dedicated API Routes for PMS Multi-Option Fee Structures, High Water Mark
 *              Calculations, and Redemption / Exit Load Quotes.
 *
 * Exposes:
 * - GET  /api/pms/fee-structures    : Returns details of the 4 statutory PMS fee models
 * - POST /api/pms/simulate-fees     : Simulates net returns across all options given capital & expected return
 * - POST /api/pms/calculate-hwm-fee : Computes High Water Mark performance fee crystallization
 * - POST /api/pms/redemption/quote  : Generates redemption quote with SEBI exit load & ₹50L residual check
 *
 * @engineVersion SEBI-PMS-FEE-v1.0
 * @compliance GCR v1.0 / FASP-AI v3.1
 */

import { type Express, type Request, type Response } from "express";
import {
  pmsFeeAndRedemptionEngine,
  type HwmCalculationInput,
  type FeeSimulationInput,
  type RedemptionQuoteInput,
} from "../services/pms-fee-and-redemption-engine";
import { logger } from "../logger";

export function registerPmsFeeRoutes(app: Express): void {
  /**
   * GET /api/pms/fee-structures
   * Returns details of the 4 statutory PMS fee models
   */
  app.get("/api/pms/fee-structures", (_req: Request, res: Response) => {
    return res.status(200).json({
      success: true,
      data: pmsFeeAndRedemptionEngine.getFeeOptions(),
      meta: {
        timestamp: new Date().toISOString(),
        version: "1.0",
        governingRegulation: "SEBI (Portfolio Managers) Regulations, 2020",
      },
    });
  });

  /**
   * POST /api/pms/simulate-fees
   * Simulates net returns across all 4 options for a given portfolio amount and expected gross return.
   */
  app.post("/api/pms/simulate-fees", (req: Request, res: Response) => {
    try {
      const { portfolioAmount, expectedGrossReturnPct, holdingPeriodDays, annualTrades } = req.body;

      if (!portfolioAmount || isNaN(Number(portfolioAmount)) || Number(portfolioAmount) <= 0) {
        return res.status(400).json({
          success: false,
          error: "INVALID_PORTFOLIO_AMOUNT",
          message: "A valid positive portfolio amount is required.",
        });
      }

      const input: FeeSimulationInput = {
        portfolioAmount: Number(portfolioAmount),
        expectedGrossReturnPct: Number(expectedGrossReturnPct ?? 15),
        holdingPeriodDays: holdingPeriodDays ? Number(holdingPeriodDays) : 365,
        annualTrades: annualTrades ? Number(annualTrades) : 60,
      };

      const simulation = pmsFeeAndRedemptionEngine.simulateFeeOptions(input);

      return res.status(200).json({
        success: true,
        data: simulation,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[PmsFeeRoutes] simulate-fees error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "SIMULATION_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * POST /api/pms/calculate-hwm-fee
   * Calculates High Water Mark performance fee crystallization
   */
  app.post("/api/pms/calculate-hwm-fee", (req: Request, res: Response) => {
    try {
      const {
        startingNav,
        currentNav,
        highWaterMarkNav,
        hurdleRatePct,
        performanceFeePct,
        holdingPeriodDays,
        portfolioAmount,
      } = req.body;

      if (!startingNav || !currentNav || !highWaterMarkNav || !portfolioAmount) {
        return res.status(400).json({
          success: false,
          error: "MISSING_REQUIRED_NAV_FIELDS",
          message: "startingNav, currentNav, highWaterMarkNav, and portfolioAmount are required.",
        });
      }

      const input: HwmCalculationInput = {
        startingNav: Number(startingNav),
        currentNav: Number(currentNav),
        highWaterMarkNav: Number(highWaterMarkNav),
        hurdleRatePct: Number(hurdleRatePct ?? 10),
        performanceFeePct: Number(performanceFeePct ?? 15),
        holdingPeriodDays: Number(holdingPeriodDays ?? 365),
        portfolioAmount: Number(portfolioAmount),
      };

      const result = pmsFeeAndRedemptionEngine.calculateHwmPerformanceFee(input);

      return res.status(200).json({
        success: true,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[PmsFeeRoutes] calculate-hwm-fee error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "HWM_CALCULATION_FAILED",
        message: err.message,
      });
    }
  });

  /**
   * POST /api/pms/redemption/quote
   * Generates a redemption quote, applies SEBI exit load tiers, and verifies the ₹50L residual floor.
   */
  app.post("/api/pms/redemption/quote", (req: Request, res: Response) => {
    try {
      const {
        currentPortfolioValue,
        requestedWithdrawalAmount,
        holdingPeriodDays,
        settlementMode,
        pendingPerformanceFee,
        pendingManagementFee,
      } = req.body;

      if (!currentPortfolioValue || !requestedWithdrawalAmount) {
        return res.status(400).json({
          success: false,
          error: "MISSING_REDEMPTION_FIELDS",
          message: "currentPortfolioValue and requestedWithdrawalAmount are required.",
        });
      }

      const input: RedemptionQuoteInput = {
        currentPortfolioValue: Number(currentPortfolioValue),
        requestedWithdrawalAmount: Number(requestedWithdrawalAmount),
        holdingPeriodDays: Number(holdingPeriodDays ?? 365),
        settlementMode: settlementMode === "IN_SPECIE_DEMAT_TRANSFER" ? "IN_SPECIE_DEMAT_TRANSFER" : "CASH_LIQUIDATION",
        pendingPerformanceFee: pendingPerformanceFee ? Number(pendingPerformanceFee) : 0,
        pendingManagementFee: pendingManagementFee ? Number(pendingManagementFee) : 0,
      };

      const result = pmsFeeAndRedemptionEngine.calculateRedemptionQuote(input);
      const statusCode = result.isPermitted ? 200 : 422;

      return res.status(statusCode).json({
        success: result.isPermitted,
        data: result,
        meta: {
          timestamp: new Date().toISOString(),
          version: "1.0",
        },
      });
    } catch (err: any) {
      logger.error(`[PmsFeeRoutes] redemption/quote error: ${err.message}`);
      return res.status(500).json({
        success: false,
        error: "REDEMPTION_QUOTE_FAILED",
        message: err.message,
      });
    }
  });
}

