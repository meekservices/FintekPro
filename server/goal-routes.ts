import type { Express, Request, Response } from "express";
import { db } from "./db";
import { financialGoals, goalContributions, type InsertGoalContribution } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "./logger";

export function registerGoalRoutes(app: Express) {
  // GET /api/goals - Get all goals for the current user
  app.get("/api/goals", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const goals = await db
        .select()
        .from(financialGoals)
        .where(eq(financialGoals.userId, req.user.id))
        .orderBy(desc(financialGoals.createdAt));

      // Calculate progress percentage for each goal
      const goalsWithProgress = goals.map(goal => {
        const current = parseFloat(goal.currentAmount || "0");
        const target = parseFloat(goal.targetAmount || "1");
        const progress = Math.min((current / target) * 100, 100);
        
        return {
          ...goal,
          currentProgress: progress,
        };
      });

      res.json(goalsWithProgress);
    } catch (error) {
      logger.error('Error fetching goals', { error: String(error), userId: req.user?.id });
      res.status(500).json({ message: "Error fetching goals" });
    }
  });

  // GET /api/goals/:id - Get a specific goal with contributions
  app.get("/api/goals/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const goal = await db
        .select()
        .from(financialGoals)
        .where(and(
          eq(financialGoals.id, req.params.id),
          eq(financialGoals.userId, req.user.id)
        ))
        .limit(1);

      if (!goal || goal.length === 0) {
        return res.status(404).json({ message: "Goal not found" });
      }

      // Get all contributions for this goal
      const contributions = await db
        .select()
        .from(goalContributions)
        .where(eq(goalContributions.goalId, req.params.id))
        .orderBy(desc(goalContributions.contributionDate));

      const current = parseFloat(goal[0].currentAmount || "0");
      const target = parseFloat(goal[0].targetAmount || "1");
      const progress = Math.min((current / target) * 100, 100);

      res.json({
        ...goal[0],
        currentProgress: progress,
        contributions,
      });
    } catch (error) {
      logger.error('Error fetching goal', { error: String(error), goalId: req.params.id });
      res.status(500).json({ message: "Error fetching goal" });
    }
  });

  // POST /api/goals - Create a new goal
  app.post("/api/goals", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, description, category, targetAmount, targetDate, goalType, priority, riskProfile } = req.body;

      if (!name || !targetAmount || !targetDate || !goalType || !category) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Calculate recommended monthly contribution
      const monthsToGoal = calculateMonthsToGoal(targetDate);
      const expectedReturn = 0.12; // 12% annual return assumption
      const monthlyReturn = expectedReturn / 12;
      
      // Future Value = Monthly SIP * [(1 + r)^n - 1] / r * (1 + r)
      // Solving for Monthly SIP
      const n = monthsToGoal;
      const r = monthlyReturn;
      const fv = parseFloat(targetAmount);
      const recommendedMonthlyContribution = fv / (((Math.pow(1 + r, n) - 1) / r) * (1 + r));

      // Get investment recommendations based on goal
      const recommendedInvestments = getInvestmentRecommendations(
        goalType,
        category,
        monthsToGoal,
        riskProfile || 'moderate',
        parseFloat(targetAmount)
      );

      const newGoal = await db.insert(financialGoals).values({
        userId: req.user.id,
        name,
        description,
        category,
        targetAmount,
        targetDate,
        goalType,
        priority: priority || 'medium',
        riskProfile: riskProfile || 'moderate',
        monthlyContribution: recommendedMonthlyContribution.toFixed(2),
        recommendedInvestments,
        currentAmount: "0",
        currentProgress: "0",
        isActive: true,
      }).returning();

      logger.info('Goal created', { goalId: newGoal[0].id, userId: req.user.id });
      res.status(201).json(newGoal[0]);
    } catch (error) {
      logger.error('Error creating goal', { error: String(error), userId: req.user?.id });
      res.status(500).json({ message: "Error creating goal" });
    }
  });

  // PUT /api/goals/:id - Update a goal
  app.put("/api/goals/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { name, description, targetAmount, targetDate, priority, riskProfile, isActive } = req.body;

      const updated = await db.update(financialGoals)
        .set({
          ...(name && { name }),
          ...(description !== undefined && { description }),
          ...(targetAmount && { targetAmount }),
          ...(targetDate && { targetDate }),
          ...(priority && { priority }),
          ...(riskProfile && { riskProfile }),
          ...(isActive !== undefined && { isActive }),
          updatedAt: new Date(),
        })
        .where(and(
          eq(financialGoals.id, req.params.id),
          eq(financialGoals.userId, req.user.id)
        ))
        .returning();

      if (!updated || updated.length === 0) {
        return res.status(404).json({ message: "Goal not found" });
      }

      logger.info('Goal updated', { goalId: req.params.id, userId: req.user.id });
      res.json(updated[0]);
    } catch (error) {
      logger.error('Error updating goal', { error: String(error), goalId: req.params.id });
      res.status(500).json({ message: "Error updating goal" });
    }
  });

  // DELETE /api/goals/:id - Delete a goal
  app.delete("/api/goals/:id", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const deleted = await db.delete(financialGoals)
        .where(and(
          eq(financialGoals.id, req.params.id),
          eq(financialGoals.userId, req.user.id)
        ))
        .returning();

      if (!deleted || deleted.length === 0) {
        return res.status(404).json({ message: "Goal not found" });
      }

      logger.info('Goal deleted', { goalId: req.params.id, userId: req.user.id });
      res.json({ message: "Goal deleted successfully" });
    } catch (error) {
      logger.error('Error deleting goal', { error: String(error), goalId: req.params.id });
      res.status(500).json({ message: "Error deleting goal" });
    }
  });

  // POST /api/goals/:id/contributions - Add a contribution to a goal
  app.post("/api/goals/:id/contributions", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const { amount, contributionDate, contributionType, notes, source } = req.body;

      if (!amount || !contributionDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Verify goal exists and belongs to user
      const goal = await db.select()
        .from(financialGoals)
        .where(and(
          eq(financialGoals.id, req.params.id),
          eq(financialGoals.userId, req.user.id)
        ))
        .limit(1);

      if (!goal || goal.length === 0) {
        return res.status(404).json({ message: "Goal not found" });
      }

      // Add contribution
      const newContribution = await db.insert(goalContributions).values({
        goalId: req.params.id,
        userId: req.user.id,
        amount,
        contributionDate,
        contributionType: contributionType || 'manual',
        notes,
        source,
      }).returning();

      // Update goal's current amount
      const newCurrentAmount = parseFloat(goal[0].currentAmount || "0") + parseFloat(amount);
      const newProgress = Math.min((newCurrentAmount / parseFloat(goal[0].targetAmount || "1")) * 100, 100);

      // Check for milestone achievements (25%, 50%, 75%, 100%)
      const oldProgress = parseFloat(goal[0].currentProgress || "0");
      const milestones = [25, 50, 75, 100];
      const newMilestones = milestones.filter(m => oldProgress < m && newProgress >= m);

      await db.update(financialGoals)
        .set({
          currentAmount: newCurrentAmount.toFixed(2),
          currentProgress: newProgress.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(financialGoals.id, req.params.id));

      logger.info('Contribution added', { 
        contributionId: newContribution[0].id, 
        goalId: req.params.id, 
        amount,
        newMilestones 
      });

      res.status(201).json({
        contribution: newContribution[0],
        newProgress,
        milestonesReached: newMilestones,
      });
    } catch (error) {
      logger.error('Error adding contribution', { error: String(error), goalId: req.params.id });
      res.status(500).json({ message: "Error adding contribution" });
    }
  });

  // GET /api/goals/:id/progress-history - Get progress history for charts
  app.get("/api/goals/:id/progress-history", async (req: Request, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const contributions = await db
        .select()
        .from(goalContributions)
        .where(and(
          eq(goalContributions.goalId, req.params.id),
          eq(goalContributions.userId, req.user.id)
        ))
        .orderBy(goalContributions.contributionDate);

      const goal = await db.select()
        .from(financialGoals)
        .where(eq(financialGoals.id, req.params.id))
        .limit(1);

      if (!goal || goal.length === 0) {
        return res.status(404).json({ message: "Goal not found" });
      }

      // Build cumulative progress history
      let cumulative = 0;
      const history = contributions.map(c => {
        cumulative += parseFloat(c.amount || "0");
        return {
          date: c.contributionDate,
          amount: cumulative,
          progress: Math.min((cumulative / parseFloat(goal[0].targetAmount || "1")) * 100, 100),
        };
      });

      res.json({ history, target: parseFloat(goal[0].targetAmount || "0") });
    } catch (error) {
      logger.error('Error fetching progress history', { error: String(error), goalId: req.params.id });
      res.status(500).json({ message: "Error fetching progress history" });
    }
  });
}

// Helper function to calculate months to goal
function calculateMonthsToGoal(targetDate: string): number {
  const target = new Date(targetDate);
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
  return Math.max(diffMonths, 1);
}

// Helper function to get investment recommendations
function getInvestmentRecommendations(
  goalType: string,
  category: string,
  monthsToGoal: number,
  riskProfile: string,
  targetAmount: number
): string[] {
  // Short-term goals (< 1 year) - Capital preservation focus
  if (monthsToGoal <= 12) {
    return ["Liquid Funds", "Ultra Short Duration Funds", "Premium Corporate Bonds", "Fixed Deposits"];
  } 
  // Medium-term goals (1-3 years) - Stability with modest growth
  else if (monthsToGoal <= 36) {
    return ["Short Duration Funds", "Conservative Hybrid Funds", "High-Grade Corporate Bonds", "REITs (for income)"];
  } 
  // Medium-long term (3-5 years) - Balanced approach
  else if (monthsToGoal <= 60) {
    return ["Balanced Advantage Funds", "Multi Asset Funds", "REITs", "InvITs (for yield)"];
  } 
  // Long-term goals (5+ years) - Include premium investments based on goal type and amount
  else {
    let baseRecommendations: string[] = [];
    let premiumRecommendations: string[] = [];
    
    // Base recommendations by risk profile
    if (riskProfile === "aggressive") {
      baseRecommendations = ["Large Cap Funds", "Flexi Cap Funds", "Mid Cap Funds", "ELSS"];
    } else if (riskProfile === "moderate") {
      baseRecommendations = ["Large Cap Funds", "Balanced Advantage Funds", "REITs", "InvITs"];
    } else {
      baseRecommendations = ["Conservative Hybrid Funds", "High-Grade Corporate Bonds", "PPF", "REITs"];
    }
    
    // Add premium investment recommendations based on goal specifics
    if (targetAmount >= 5000000) { // ₹50L+ goals
      if (category === 'retirement') {
        premiumRecommendations = ["PMS (Conservative)", "REITs Portfolio", "Premium Bonds"];
      } else if (category === 'wealth') {
        premiumRecommendations = ["PMS (Growth)", "AIF Category I/II", "International REITs"];
      } else if (category === 'home_purchase') {
        premiumRecommendations = ["REITs (Real Estate)", "Infrastructure InvITs", "PMS (Real Estate Focus)"];
      } else if (category === 'education') {
        premiumRecommendations = ["Education-focused PMS", "International Funds", "REITs (Stable Income)"];
      }
    } else if (targetAmount >= 1000000) { // ₹10L+ goals
      premiumRecommendations = ["REITs (Diversified)", "InvITs (Infrastructure)", "Premium Corporate Bonds"];
    }
    
    return [...baseRecommendations, ...premiumRecommendations].slice(0, 6); // Limit to 6 recommendations
  }
}
