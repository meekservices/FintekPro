import { Router, Request, Response } from "express";
import { z } from "zod";
import { assetAllocationOptimizer } from "../services/asset-allocation-optimizer";
import { rebalancingEngine, RebalanceInput } from "../services/rebalancing-engine";

const router = Router();

const optimizationInputSchema = z.object({
  riskScore: z.number().min(0).max(100),
  segment: z.enum(['retail', 'hni', 'shni', 'bhni', 'corporate']),
  investableAmount: z.number().positive().optional(),
  investmentHorizon: z.number().min(1).max(50),
  goalType: z.enum(['growth', 'income', 'preservation', 'balanced']).optional(),
  liquidityNeeds: z.enum(['low', 'medium', 'high']).optional(),
  taxBracket: z.enum(['low', 'medium', 'high']).optional(),
  existingAllocations: z.record(z.string(), z.number()).optional()
});

const rebalanceInputSchema = z.object({
  currentAllocations: z.record(z.string(), z.number()),
  targetAllocations: z.record(z.string(), z.number()),
  totalValue: z.number().positive(),
  threshold: z.number().min(0).max(100).optional()
});

router.post("/optimize", async (req: Request, res: Response) => {
  try {
    const input = optimizationInputSchema.parse(req.body);
    const result = assetAllocationOptimizer.optimize(input);
    res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors
      });
    }
    console.error("Optimization error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Optimization failed"
    });
  }
});

router.get("/asset-classes", async (req: Request, res: Response) => {
  try {
    const segment = (req.query.segment as string) || 'retail';
    const assetClasses = assetAllocationOptimizer.getAvailableAssetClasses(segment);
    res.json({ success: true, data: assetClasses });
  } catch (error) {
    console.error("Error fetching asset classes:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch asset classes"
    });
  }
});

router.get("/constraints/:riskScore/:segment", async (req: Request, res: Response) => {
  try {
    const riskScore = parseInt(req.params.riskScore);
    const segment = req.params.segment;
    
    if (isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
      return res.status(400).json({
        success: false,
        error: "Risk score must be between 0 and 100"
      });
    }
    
    const constraints = assetAllocationOptimizer.getConstraints(riskScore, segment);
    const riskProfile = assetAllocationOptimizer.getRiskProfile(riskScore);
    
    res.json({
      success: true,
      data: {
        riskScore,
        riskProfile,
        segment,
        constraints
      }
    });
  } catch (error) {
    console.error("Error fetching constraints:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch constraints"
    });
  }
});

router.post("/efficient-frontier", async (req: Request, res: Response) => {
  try {
    const input = optimizationInputSchema.parse(req.body);
    const points = typeof req.query.points === 'string' ? parseInt(req.query.points) : 10;
    const frontier = assetAllocationOptimizer.generateEfficientFrontier(input, points);
    res.json({ success: true, data: frontier });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors
      });
    }
    console.error("Efficient frontier error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate efficient frontier"
    });
  }
});

router.post("/rebalance", async (req: Request, res: Response) => {
  try {
    const input = rebalanceInputSchema.parse(req.body);
    const trades = assetAllocationOptimizer.calculateRebalancingTrades(
      input.currentAllocations,
      input.targetAllocations,
      input.totalValue,
      input.threshold
    );
    
    const totalBuys = trades.filter(t => t.action === 'buy').reduce((sum, t) => sum + t.amount, 0);
    const totalSells = trades.filter(t => t.action === 'sell').reduce((sum, t) => sum + t.amount, 0);
    
    res.json({
      success: true,
      data: {
        trades,
        summary: {
          totalBuys,
          totalSells,
          netCashFlow: totalSells - totalBuys,
          tradesRequired: trades.filter(t => t.action !== 'hold').length
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors
      });
    }
    console.error("Rebalancing error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Rebalancing calculation failed"
    });
  }
});

router.get("/risk-profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = [
      { name: 'very_conservative', label: 'Very Conservative', scoreRange: [0, 25], description: 'Capital preservation with minimal risk' },
      { name: 'conservative', label: 'Conservative', scoreRange: [26, 40], description: 'Low risk with focus on stability' },
      { name: 'moderate', label: 'Moderate', scoreRange: [41, 55], description: 'Balanced approach to risk and return' },
      { name: 'moderately_aggressive', label: 'Moderately Aggressive', scoreRange: [56, 70], description: 'Higher growth with managed risk' },
      { name: 'aggressive', label: 'Aggressive', scoreRange: [71, 85], description: 'High growth potential with higher volatility' },
      { name: 'very_aggressive', label: 'Very Aggressive', scoreRange: [86, 100], description: 'Maximum growth with highest risk tolerance' }
    ];
    res.json({ success: true, data: profiles });
  } catch (error) {
    console.error("Error fetching risk profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch risk profiles"
    });
  }
});

const comprehensiveRebalanceSchema = z.object({
  currentAllocations: z.record(z.string(), z.number()),
  currentValues: z.record(z.string(), z.number()).optional(),
  totalPortfolioValue: z.number().positive(),
  riskScore: z.number().min(0).max(100),
  segment: z.enum(['retail', 'hni', 'shni', 'bhni', 'corporate']),
  investmentHorizon: z.number().min(1).max(50),
  goalType: z.enum(['growth', 'income', 'preservation', 'balanced']).optional(),
  driftThreshold: z.number().min(0).max(50).optional(),
  taxBracket: z.number().min(0).max(40).optional(),
  holdingPeriods: z.record(z.string(), z.number()).optional(),
  cashInflow: z.number().min(0).optional(),
  cashOutflow: z.number().min(0).optional(),
  rebalanceReason: z.enum([
    'DRIFT_THRESHOLD_EXCEEDED', 'RISK_PROFILE_CHANGED', 'GOAL_TIMELINE_CHANGED',
    'MARKET_CONDITIONS_SHIFT', 'TAX_LOSS_HARVESTING', 'CASH_INFLOW', 'CASH_OUTFLOW',
    'REBALANCE_SCHEDULE', 'CONSTRAINT_VIOLATION', 'CONCENTRATION_RISK'
  ]).optional(),
  targetAllocations: z.record(z.string(), z.number()).optional()
});

router.post("/rebalance/analyze", async (req: Request, res: Response) => {
  try {
    const input = comprehensiveRebalanceSchema.parse(req.body);
    
    const rebalanceInput: RebalanceInput = {
      ...input,
      currentValues: input.currentValues ?? Object.fromEntries(
        Object.entries(input.currentAllocations).map(([type, alloc]) => 
          [type, input.totalPortfolioValue * alloc / 100]
        )
      )
    };
    
    const analysis = rebalancingEngine.analyzeAndRebalance(rebalanceInput);
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors
      });
    }
    console.error("Rebalancing analysis error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Rebalancing analysis failed"
    });
  }
});

router.post("/rebalance/simulate", async (req: Request, res: Response) => {
  try {
    const input = comprehensiveRebalanceSchema.parse(req.body);
    
    const rebalanceInput: RebalanceInput = {
      ...input,
      currentValues: input.currentValues ?? Object.fromEntries(
        Object.entries(input.currentAllocations).map(([type, alloc]) => 
          [type, input.totalPortfolioValue * alloc / 100]
        )
      )
    };
    
    const simulation = rebalancingEngine.simulateRebalance(rebalanceInput);
    
    res.json({
      success: true,
      data: simulation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors
      });
    }
    console.error("Rebalancing simulation error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Rebalancing simulation failed"
    });
  }
});

router.get("/rebalance/reason-codes", async (_req: Request, res: Response) => {
  try {
    const reasonCodes = [
      { code: 'DRIFT_THRESHOLD_EXCEEDED', label: 'Drift Threshold Exceeded', description: 'Allocation has drifted beyond acceptable threshold' },
      { code: 'RISK_PROFILE_CHANGED', label: 'Risk Profile Changed', description: 'Your risk profile has changed' },
      { code: 'GOAL_TIMELINE_CHANGED', label: 'Goal Timeline Changed', description: 'Your investment timeline has changed' },
      { code: 'MARKET_CONDITIONS_SHIFT', label: 'Market Conditions Shift', description: 'Market conditions warrant adjustment' },
      { code: 'TAX_LOSS_HARVESTING', label: 'Tax Loss Harvesting', description: 'Opportunity for tax-loss harvesting' },
      { code: 'CASH_INFLOW', label: 'Cash Inflow', description: 'New cash available for investment' },
      { code: 'CASH_OUTFLOW', label: 'Cash Outflow', description: 'Cash withdrawal required' },
      { code: 'REBALANCE_SCHEDULE', label: 'Scheduled Rebalance', description: 'Scheduled periodic rebalancing' },
      { code: 'CONSTRAINT_VIOLATION', label: 'Constraint Violation', description: 'Portfolio constraints are violated' },
      { code: 'CONCENTRATION_RISK', label: 'Concentration Risk', description: 'Position exceeds concentration limits' }
    ];
    res.json({ success: true, data: reasonCodes });
  } catch (error) {
    console.error("Error fetching reason codes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reason codes"
    });
  }
});

export default router;
