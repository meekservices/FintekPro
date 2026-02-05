import { Router, Request, Response } from "express";
import { z } from "zod";
import { sipSimulatorEngine } from "../services/sip-simulator-engine";
import { advisorTrainingService } from "../services/advisor-training-service";
import { sebiAuditService, SEBI_AUDIT_ACTION_TYPES } from "../services/sebi-audit-service";

const router = Router();

const portfolioFundSchema = z.object({
  mfIsin: z.string(),
  name: z.string(),
  portfolioWeight: z.number(),
  currentValue: z.number().optional(),
});

/**
 * POST /api/sip/simulate
 * BE-20: SIP Simulator Engine (6/12/24 Months)
 */
router.post("/simulate", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      sipAmount: z.number().min(500),
      candidateFunds: z.array(z.string()),
      existingPortfolio: z.array(portfolioFundSchema),
      horizonMonths: z.enum(["6", "12", "24"]).transform(Number) as z.ZodType<6 | 12 | 24>,
    });

    const input = schema.parse(req.body);
    const result = await sipSimulatorEngine.simulateSIP({
      sipAmount: input.sipAmount,
      candidateFunds: input.candidateFunds,
      existingPortfolio: input.existingPortfolio,
      horizonMonths: input.horizonMonths as 6 | 12 | 24,
    });

    // Log to SEBI audit trail
    await sebiAuditService.log(
      {
        actionType: "SIP_SIMULATION",
        actionSummary: `SIP simulation for ${input.horizonMonths} months with ₹${input.sipAmount} monthly`,
        inputData: { sipAmount: input.sipAmount, horizonMonths: input.horizonMonths, fundCount: input.candidateFunds.length },
        outputData: {
          totalInvested: result.totalInvested,
          scoreStart: result.diversificationScoreStart,
          scoreEnd: result.diversificationScoreEnd,
        },
        rationale: result.overlapReductionSummary,
        riskDisclosure: result.riskDisclosure,
      },
      { proposalId: req.body.proposalId, advisorId: req.body.advisorId }
    );

    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("[SIPSimulator] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/sip/training-prompts
 * BE-21: Advisor Training Prompt Generator
 */
router.post("/training-prompts", async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      diversificationScore: z.object({
        score: z.number(),
        grade: z.enum(["EXCELLENT", "GOOD", "FAIR", "POOR"]),
        penalties: z.array(z.any()),
        stockExposures: z.array(z.any()),
        sectorExposures: z.array(z.any()),
      }),
      replaceFundSuggestions: z.array(z.any()).optional(),
      sipRoutingApplied: z.boolean().optional(),
      selectedGoal: z.string().optional(),
    });

    const context = schema.parse(req.body);
    const prompts = advisorTrainingService.generateTrainingPrompts(context);

    res.json({ success: true, data: { prompts, totalPrompts: prompts.length } });
  } catch (error: any) {
    console.error("[AdvisorTraining] Error:", error);
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
