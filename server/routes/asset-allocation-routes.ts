import { Router, Request, Response } from "express";
import { z } from "zod";
import { assetAllocationOptimizer } from "../services/asset-allocation-optimizer";

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

export default router;
