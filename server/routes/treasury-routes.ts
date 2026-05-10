import { Router, Request, Response } from "express";
import { z } from "zod";
import { corporateTreasuryEngine } from "../services/corporate-treasury-engine";

const router = Router();

const treasuryInputSchema = z.object({
  totalCorpus: z.number().positive(),
  objectives: z.object({
    capitalPreservation: z.boolean().default(true),
    liquidityManagement: z.boolean().default(true),
    yieldOptimization: z.boolean().default(false),
    riskMitigation: z.boolean().default(true),
    regulatoryCompliance: z.boolean().default(true),
    cashFlowMatching: z.boolean().default(false),
    taxEfficiency: z.boolean().default(false)
  }),
  cashFlowSchedule: z.array(z.object({
    month: z.string(),
    inflows: z.number().min(0),
    outflows: z.number().min(0)
  })).optional(),
  investmentHorizon: z.number().min(1).max(60).default(12),
  riskTolerance: z.enum(['conservative', 'moderate', 'balanced']).default('moderate'),
  minimumLiquidity: z.number().min(0),
  regulatoryRequirements: z.array(z.string()).optional(),
  existingAllocations: z.record(z.string(), z.number()).optional(),
  preferredProducts: z.array(z.string()).optional(),
  excludedProducts: z.array(z.string()).optional(),
  maxSingleExposure: z.number().min(5).max(50).optional(),
  minCreditRating: z.string().optional()
});

router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const input = treasuryInputSchema.parse(req.body);
    const analysis = corporateTreasuryEngine.analyzeTreasury(input);
    
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
    console.error("Treasury analysis error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Treasury analysis failed"
    });
  }
});

router.get("/buckets", async (_req: Request, res: Response) => {
  try {
    const buckets = corporateTreasuryEngine.getBucketDefinitions();
    res.json({
      success: true,
      data: buckets
    });
  } catch (error) {
    console.error("Error fetching buckets:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch bucket definitions"
    });
  }
});

router.get("/products", async (_req: Request, res: Response) => {
  try {
    const products = corporateTreasuryEngine.getProductDetails();
    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch product details"
    });
  }
});

router.get("/objectives", async (_req: Request, res: Response) => {
  try {
    const objectives = [
      { key: 'capitalPreservation', label: 'Capital Preservation', description: 'Protect principal amount with minimal risk' },
      { key: 'liquidityManagement', label: 'Liquidity Management', description: 'Maintain readily available funds for operations' },
      { key: 'yieldOptimization', label: 'Yield Optimization', description: 'Maximize returns on surplus funds' },
      { key: 'riskMitigation', label: 'Risk Mitigation', description: 'Minimize exposure to market and credit risks' },
      { key: 'regulatoryCompliance', label: 'Regulatory Compliance', description: 'Adhere to treasury policy and regulations' },
      { key: 'cashFlowMatching', label: 'Cash Flow Matching', description: 'Align investments with expected cash requirements' },
      { key: 'taxEfficiency', label: 'Tax Efficiency', description: 'Optimize after-tax returns' }
    ];
    
    res.json({
      success: true,
      data: objectives
    });
  } catch (error) {
    console.error("Error fetching objectives:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch treasury objectives"
    });
  }
});

router.get("/risk-tolerance-profiles", async (_req: Request, res: Response) => {
  try {
    const profiles = [
      {
        value: 'conservative',
        label: 'Conservative',
        description: 'Focus on capital preservation with minimal risk. Higher allocation to liquid and short-term instruments.',
        characteristics: ['Lower returns', 'Highest liquidity', 'Minimal volatility', 'Best for uncertain cash flows']
      },
      {
        value: 'moderate',
        label: 'Moderate',
        description: 'Balanced approach between safety and yield. Diversified across all buckets.',
        characteristics: ['Moderate returns', 'Good liquidity', 'Low volatility', 'Suitable for stable operations']
      },
      {
        value: 'balanced',
        label: 'Balanced',
        description: 'Higher emphasis on yield optimization. Larger allocation to medium and strategic buckets.',
        characteristics: ['Higher returns', 'Medium liquidity', 'Some volatility', 'Best for surplus deployment']
      }
    ];
    
    res.json({
      success: true,
      data: profiles
    });
  } catch (error) {
    console.error("Error fetching risk profiles:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch risk tolerance profiles"
    });
  }
});

export default router;
