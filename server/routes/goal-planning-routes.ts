import { Router, Request, Response } from "express";
import { goalPlanningEngine } from "../services/goal-planning-engine";
import { insertFinancialGoalSchema, insertGoalInvestmentLinkSchema, GOAL_CATEGORIES } from "@shared/schema";
import { z } from "zod";

const router = Router();

router.get("/categories", async (_req: Request, res: Response) => {
  try {
    res.json(GOAL_CATEGORIES);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/calculate-sip", async (req: Request, res: Response) => {
  try {
    const { targetAmount, currentSavings, monthsRemaining, expectedReturnRate, inflationRate } = req.body;
    
    const result = goalPlanningEngine.calculateSIPForGoal(
      parseFloat(targetAmount),
      parseFloat(currentSavings || "0"),
      parseInt(monthsRemaining),
      parseFloat(expectedReturnRate || "12"),
      parseFloat(inflationRate || "6")
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/calculate-lumpsum", async (req: Request, res: Response) => {
  try {
    const { targetAmount, yearsRemaining, expectedReturnRate, inflationRate } = req.body;
    
    const result = goalPlanningEngine.calculateLumpsumForGoal(
      parseFloat(targetAmount),
      parseFloat(yearsRemaining),
      parseFloat(expectedReturnRate || "12"),
      parseFloat(inflationRate || "6")
    );
    
    res.json({ requiredLumpsum: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/suggest-allocation", async (req: Request, res: Response) => {
  try {
    const { yearsRemaining, riskProfile } = req.body;
    
    const result = goalPlanningEngine.suggestAssetAllocation(
      parseFloat(yearsRemaining),
      riskProfile || "moderate"
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post("/calculate-step-up-sip", async (req: Request, res: Response) => {
  try {
    const { targetAmount, currentSavings, monthsRemaining, expectedReturnRate, inflationRate, annualStepUpPercent } = req.body;
    
    const result = goalPlanningEngine.calculateSipWithStepUp(
      parseFloat(targetAmount),
      parseFloat(currentSavings || "0"),
      parseInt(monthsRemaining),
      parseFloat(expectedReturnRate || "12"),
      parseFloat(inflationRate || "6"),
      parseFloat(annualStepUpPercent || "10")
    );
    
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const goals = await goalPlanningEngine.getGoals(req.params.userId);
    res.json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:goalId", async (req: Request, res: Response) => {
  try {
    const details = await goalPlanningEngine.getGoalWithDetails(req.params.goalId);
    if (!details) {
      return res.status(404).json({ error: "Goal not found" });
    }
    res.json(details);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/", async (req: Request, res: Response) => {
  try {
    const validatedData = insertFinancialGoalSchema.parse(req.body);
    const goal = await goalPlanningEngine.createGoal(validatedData);
    res.status(201).json(goal);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:goalId", async (req: Request, res: Response) => {
  try {
    const goal = await goalPlanningEngine.getGoalById(req.params.goalId);
    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    
    const updated = await goalPlanningEngine.updateGoalProgress(req.params.goalId);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:goalId", async (req: Request, res: Response) => {
  try {
    await goalPlanningEngine.deleteGoal(req.params.goalId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:goalId/complete", async (req: Request, res: Response) => {
  try {
    const goal = await goalPlanningEngine.completeGoal(req.params.goalId);
    res.json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:goalId/investments", async (req: Request, res: Response) => {
  try {
    const data = {
      ...req.body,
      goalId: req.params.goalId,
    };
    const validatedData = insertGoalInvestmentLinkSchema.parse(data);
    const link = await goalPlanningEngine.linkInvestmentToGoal(validatedData);
    res.status(201).json(link);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:goalId/investments/:linkId", async (req: Request, res: Response) => {
  try {
    await goalPlanningEngine.unlinkInvestment(req.params.linkId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/:goalId/snapshot", async (req: Request, res: Response) => {
  try {
    await goalPlanningEngine.takeProgressSnapshot(req.params.goalId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
