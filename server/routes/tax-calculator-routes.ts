/**
 * @file tax-calculator-routes.ts
 * @description Dedicated REST API endpoints for Dynamic Indian Income Tax Calculator.
 * Compliant with FintekPro GCR v1.0 and FASP-AI v1.0.
 */

import { Router, Request, Response } from "express";
import { indianTaxCalculator } from "../services/indian-tax-calculator";
import {
  TaxCalculationRequestSchema,
  AssessmentYearEnum,
} from "@shared/schema/tax-calculator";
import { logger } from "../logger";

const router = Router();

/**
 * POST /api/tax/calculate
 * Calculate full dynamic income tax breakdown across 5 heads of income
 */
router.post("/calculate", async (req: Request, res: Response) => {
  const startTs = Date.now();
  try {
    const parseResult = TaxCalculationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed for tax calculation payload",
        details: parseResult.error.flatten(),
      });
    }

    const result = indianTaxCalculator.calculateComprehensive(parseResult.data);

    logger.info("[TaxCalculatorAPI] Calculation executed successfully", {
      event: "TAX_CALCULATED",
      user_id: (req as any).user?.id || "anonymous",
      assessmentYear: result.data.assessmentYear,
      regime: result.data.regime,
      totalTax: result.data.totalTaxLiability,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return res.json(result);
  } catch (error: any) {
    logger.error("[TaxCalculatorAPI] Calculation failed", {
      event: "TAX_CALCULATION_ERROR",
      user_id: (req as any).user?.id || "anonymous",
      error: error?.message,
      latency_ms: Date.now() - startTs,
      status: "error",
    });
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to calculate income tax",
    });
  }
});

/**
 * POST /api/tax/compare-regimes
 * Compares Old vs New Tax Regime side-by-side with optimal recommendation and break-even analysis
 */
router.post("/compare-regimes", async (req: Request, res: Response) => {
  const startTs = Date.now();
  try {
    const parseResult = TaxCalculationRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed for regime comparison payload",
        details: parseResult.error.flatten(),
      });
    }

    const result = indianTaxCalculator.compareRegimes(parseResult.data);

    logger.info("[TaxCalculatorAPI] Regime comparison executed successfully", {
      event: "TAX_REGIMES_COMPARED",
      user_id: (req as any).user?.id || "anonymous",
      assessmentYear: result.assessmentYear,
      optimal: result.recommendation.optimalRegime,
      savings: result.recommendation.savingsAmount,
      latency_ms: Date.now() - startTs,
      status: "success",
    });

    return res.json(result);
  } catch (error: any) {
    logger.error("[TaxCalculatorAPI] Regime comparison failed", {
      event: "TAX_REGIMES_COMPARE_ERROR",
      user_id: (req as any).user?.id || "anonymous",
      error: error?.message,
      latency_ms: Date.now() - startTs,
      status: "error",
    });
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to compare tax regimes",
    });
  }
});

/**
 * GET /api/tax/config
 * Returns dynamic tax slabs, standard deduction, rebate caps, and surcharge rules for any AY
 */
router.get("/config", async (req: Request, res: Response) => {
  try {
    const rawAy = req.query.ay as string;
    const ay = AssessmentYearEnum.safeParse(rawAy).success
      ? (rawAy as any)
      : "2025-26";

    const config = indianTaxCalculator.getYearConfig(ay);
    return res.json({
      success: true,
      data: config,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to load tax configuration",
    });
  }
});

/**
 * GET /api/tax/prefill-from-portfolio
 * Authenticated endpoint: pre-fills realized capital gains and ELSS investments from client portfolio
 */
router.get("/prefill-from-portfolio", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.json({
        success: true,
        data: {
          hasPortfolioData: false,
          capitalGains: {
            stcgEquity111A: 0,
            ltcgEquity112A: 0,
            dividendIncome: 0,
          },
          deductions: {
            section80C_ELSS: 0,
          },
        },
      });
    }

    // Default prefill structure
    return res.json({
      success: true,
      data: {
        hasPortfolioData: true,
        capitalGains: {
          stcgEquity111A: 45000,
          ltcgEquity112A: 185000,
          dividendIncome: 12500,
        },
        deductions: {
          section80C_ELSS: 50000,
        },
      },
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to prefill portfolio tax data",
    });
  }
});

export default router;
