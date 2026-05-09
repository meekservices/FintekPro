import { db } from "../db";
import {
  financialGoals,
  goalMilestones,
  goalInvestmentLinks,
  goalProgressSnapshots,
  GOAL_CATEGORIES,
  type FinancialGoal,
  type GoalMilestone,
  type GoalInvestmentLink,
  type InsertFinancialGoal,
  type InsertGoalMilestone,
  type InsertGoalInvestmentLink,
} from "@shared/schema";
import { eq, and, desc, asc, sql } from "drizzle-orm";

interface SIPCalculationResult {
  requiredSipAmount: number;
  totalInvestment: number;
  expectedCorpus: number;
  inflationAdjustedTarget: number;
  monthsRemaining: number;
  yearsRemaining: number;
}

interface AssetAllocationSuggestion {
  equity: number;
  debt: number;
  gold: number;
  cash: number;
  reasoning: string;
}

interface GoalProjection {
  currentValue: number;
  projectedValue: number;
  targetAmount: number;
  progressPercentage: number;
  onTrackStatus: "on_track" | "ahead" | "behind" | "at_risk";
  shortfall: number;
  additionalSipNeeded: number;
}

export class GoalPlanningEngine {
  
  calculateInflationAdjustedAmount(
    currentAmount: number,
    inflationRate: number,
    years: number
  ): number {
    return currentAmount * Math.pow(1 + inflationRate / 100, years);
  }

  calculateSIPForGoal(
    targetAmount: number,
    currentSavings: number,
    monthsRemaining: number,
    expectedReturnRate: number,
    inflationRate: number = 6
  ): SIPCalculationResult {
    const yearsRemaining = monthsRemaining / 12;
    const inflationAdjustedTarget = this.calculateInflationAdjustedAmount(
      targetAmount,
      inflationRate,
      yearsRemaining
    );

    const monthlyRate = expectedReturnRate / 100 / 12;
    const futureValueOfCurrentSavings = currentSavings * Math.pow(1 + monthlyRate, monthsRemaining);
    const remainingTarget = Math.max(0, inflationAdjustedTarget - futureValueOfCurrentSavings);

    let requiredSipAmount = 0;
    if (remainingTarget > 0 && monthsRemaining > 0) {
      if (monthlyRate === 0) {
        requiredSipAmount = remainingTarget / monthsRemaining;
      } else {
        requiredSipAmount = remainingTarget * monthlyRate / (Math.pow(1 + monthlyRate, monthsRemaining) - 1);
      }
    }

    const totalInvestment = currentSavings + requiredSipAmount * monthsRemaining;
    const sipFV = monthlyRate === 0
      ? requiredSipAmount * monthsRemaining
      : requiredSipAmount * (Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate;
    const expectedCorpus = futureValueOfCurrentSavings + sipFV;

    return {
      requiredSipAmount: Math.ceil(requiredSipAmount),
      totalInvestment: Math.round(totalInvestment),
      expectedCorpus: Math.round(expectedCorpus),
      inflationAdjustedTarget: Math.round(inflationAdjustedTarget),
      monthsRemaining,
      yearsRemaining: Math.round(yearsRemaining * 10) / 10,
    };
  }

  calculateLumpsumForGoal(
    targetAmount: number,
    yearsRemaining: number,
    expectedReturnRate: number,
    inflationRate: number = 6
  ): number {
    const inflationAdjustedTarget = this.calculateInflationAdjustedAmount(
      targetAmount,
      inflationRate,
      yearsRemaining
    );
    const requiredLumpsum = inflationAdjustedTarget / Math.pow(1 + expectedReturnRate / 100, yearsRemaining);
    return Math.ceil(requiredLumpsum);
  }

  suggestAssetAllocation(
    yearsRemaining: number,
    riskProfile: "conservative" | "moderate" | "aggressive"
  ): AssetAllocationSuggestion {
    let equity = 0, debt = 0, gold = 0, cash = 0;
    let reasoning = "";

    if (yearsRemaining <= 1) {
      equity = 0;
      debt = 40;
      gold = 10;
      cash = 50;
      reasoning = "Very short-term goal: Focus on capital preservation with liquid instruments.";
    } else if (yearsRemaining <= 3) {
      if (riskProfile === "conservative") {
        equity = 15; debt = 60; gold = 15; cash = 10;
      } else if (riskProfile === "moderate") {
        equity = 25; debt = 50; gold = 15; cash = 10;
      } else {
        equity = 35; debt = 45; gold = 10; cash = 10;
      }
      reasoning = "Short-term goal (1-3 years): Conservative allocation with limited equity exposure.";
    } else if (yearsRemaining <= 5) {
      if (riskProfile === "conservative") {
        equity = 30; debt = 50; gold = 15; cash = 5;
      } else if (riskProfile === "moderate") {
        equity = 45; debt = 40; gold = 10; cash = 5;
      } else {
        equity = 55; debt = 30; gold = 10; cash = 5;
      }
      reasoning = "Medium-term goal (3-5 years): Balanced allocation with moderate equity.";
    } else if (yearsRemaining <= 10) {
      if (riskProfile === "conservative") {
        equity = 45; debt = 40; gold = 10; cash = 5;
      } else if (riskProfile === "moderate") {
        equity = 60; debt = 30; gold = 7; cash = 3;
      } else {
        equity = 70; debt = 20; gold = 7; cash = 3;
      }
      reasoning = "Long-term goal (5-10 years): Growth-focused with significant equity allocation.";
    } else {
      if (riskProfile === "conservative") {
        equity = 55; debt = 35; gold = 7; cash = 3;
      } else if (riskProfile === "moderate") {
        equity = 70; debt = 22; gold = 5; cash = 3;
      } else {
        equity = 80; debt = 15; gold = 3; cash = 2;
      }
      reasoning = "Very long-term goal (10+ years): Maximum growth with high equity for wealth creation.";
    }

    return { equity, debt, gold, cash, reasoning };
  }

  calculateGoalProjection(
    currentAmount: number,
    targetAmount: number,
    monthlyContribution: number,
    monthsRemaining: number,
    expectedReturnRate: number,
    inflationRate: number
  ): GoalProjection {
    const yearsRemaining = monthsRemaining / 12;
    const monthlyRate = expectedReturnRate / 100 / 12;
    
    const inflationAdjustedTarget = this.calculateInflationAdjustedAmount(
      targetAmount,
      inflationRate,
      yearsRemaining
    );

    const futureValueOfCurrent = currentAmount * Math.pow(1 + monthlyRate, monthsRemaining);
    
    let sipFutureValue = 0;
    if (monthlyRate > 0 && monthsRemaining > 0) {
      sipFutureValue = monthlyContribution * (Math.pow(1 + monthlyRate, monthsRemaining) - 1) / monthlyRate;
    } else {
      sipFutureValue = monthlyContribution * monthsRemaining;
    }

    const projectedValue = futureValueOfCurrent + sipFutureValue;
    const progressPercentage = Math.min(100, (currentAmount / targetAmount) * 100);
    
    const projectedPercentage = (projectedValue / inflationAdjustedTarget) * 100;
    
    let onTrackStatus: "on_track" | "ahead" | "behind" | "at_risk";
    if (projectedPercentage >= 110) {
      onTrackStatus = "ahead";
    } else if (projectedPercentage >= 95) {
      onTrackStatus = "on_track";
    } else if (projectedPercentage >= 70) {
      onTrackStatus = "behind";
    } else {
      onTrackStatus = "at_risk";
    }

    const shortfall = Math.max(0, inflationAdjustedTarget - projectedValue);
    
    let additionalSipNeeded = 0;
    if (shortfall > 0 && monthsRemaining > 0) {
      if (monthlyRate > 0) {
        additionalSipNeeded = shortfall * monthlyRate / (Math.pow(1 + monthlyRate, monthsRemaining) - 1);
      } else {
        additionalSipNeeded = shortfall / monthsRemaining;
      }
    }

    return {
      currentValue: currentAmount,
      projectedValue: Math.round(projectedValue),
      targetAmount: Math.round(inflationAdjustedTarget),
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      onTrackStatus,
      shortfall: Math.round(shortfall),
      additionalSipNeeded: Math.ceil(additionalSipNeeded),
    };
  }

  generateDefaultMilestones(
    goalId: string,
    targetAmount: number,
    startDate: Date,
    targetDate: Date
  ): InsertGoalMilestone[] {
    const milestones: InsertGoalMilestone[] = [];
    const totalDuration = targetDate.getTime() - startDate.getTime();
    const percentages = [25, 50, 75, 100];
    
    percentages.forEach((pct, index) => {
      const milestoneDate = new Date(startDate.getTime() + (totalDuration * pct / 100));
      milestones.push({
        goalId,
        name: pct === 100 ? "Goal Achieved!" : `${pct}% Complete`,
        description: pct === 100 
          ? "Congratulations! You've reached your goal!"
          : `You're ${pct}% of the way to your goal.`,
        targetPercentage: pct.toString(),
        targetAmount: Math.round(targetAmount * pct / 100).toString(),
        targetDate: milestoneDate,
        isAchieved: false,
        notifyOnAchieve: true,
        celebrationType: pct === 100 ? "confetti" : "badge",
        sortOrder: index,
      });
    });

    return milestones;
  }

  async createGoal(data: InsertFinancialGoal): Promise<FinancialGoal> {
    const categoryDefaults = GOAL_CATEGORIES[data.category as keyof typeof GOAL_CATEGORIES] || GOAL_CATEGORIES.custom;
    
    const targetDate = new Date(data.targetDate);
    const startDate = data.startDate ? new Date(data.startDate) : new Date();
    const monthsRemaining = Math.max(1, Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    const yearsRemaining = monthsRemaining / 12;
    
    const targetAmount = parseFloat(data.targetAmount?.toString() || "0");
    const currentAmount = parseFloat(data.currentAmount?.toString() || "0");
    const inflationRate = parseFloat(data.inflationRate?.toString() || categoryDefaults.defaultInflation.toString());
    const expectedReturnRate = parseFloat(data.expectedReturnRate?.toString() || categoryDefaults.defaultReturn.toString());
    
    const sipCalc = this.calculateSIPForGoal(
      targetAmount,
      currentAmount,
      monthsRemaining,
      expectedReturnRate,
      inflationRate
    );
    
    const lumpsumNeeded = this.calculateLumpsumForGoal(
      targetAmount,
      yearsRemaining,
      expectedReturnRate,
      inflationRate
    );
    
    const riskProfile = (data.riskProfile as "conservative" | "moderate" | "aggressive") || "moderate";
    const allocation = this.suggestAssetAllocation(yearsRemaining, riskProfile);
    
    const projection = this.calculateGoalProjection(
      currentAmount,
      targetAmount,
      parseFloat(data.monthlyContribution?.toString() || sipCalc.requiredSipAmount.toString()),
      monthsRemaining,
      expectedReturnRate,
      inflationRate
    );

    const goalData = {
      ...data,
      icon: data.icon || categoryDefaults.icon,
      color: data.color || categoryDefaults.color,
      inflationRate: inflationRate.toString(),
      inflationAdjustedTarget: sipCalc.inflationAdjustedTarget.toString(),
      suggestedSipAmount: sipCalc.requiredSipAmount.toString(),
      suggestedLumpsum: lumpsumNeeded.toString(),
      expectedReturnRate: expectedReturnRate.toString(),
      suggestedAllocation: { equity: allocation.equity, debt: allocation.debt, gold: allocation.gold, cash: allocation.cash },
      projectedValue: projection.projectedValue.toString(),
      onTrackStatus: projection.onTrackStatus,
      currentProgress: projection.progressPercentage.toString(),
    };

    const [goal] = await db.insert(financialGoals).values(goalData as any).returning();
    
    const milestones = this.generateDefaultMilestones(goal.id, targetAmount, startDate, targetDate);
    if (milestones.length > 0) {
      await db.insert(goalMilestones).values(milestones as any);
    }

    return goal;
  }

  async getGoals(userId: string): Promise<FinancialGoal[]> {
    return db.select().from(financialGoals)
      .where(and(eq(financialGoals.userId, userId), eq(financialGoals.isActive, true)))
      .orderBy(desc(financialGoals.priority), asc(financialGoals.targetDate));
  }

  async getGoalById(goalId: string): Promise<FinancialGoal | null> {
    const [goal] = await db.select().from(financialGoals).where(eq(financialGoals.id, goalId)).limit(1);
    return goal || null;
  }

  async getGoalWithDetails(goalId: string): Promise<{
    goal: FinancialGoal;
    milestones: GoalMilestone[];
    investments: GoalInvestmentLink[];
    projection: GoalProjection;
  } | null> {
    const goal = await this.getGoalById(goalId);
    if (!goal) return null;

    const milestones = await db.select().from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId))
      .orderBy(asc(goalMilestones.sortOrder));

    const investments = await db.select().from(goalInvestmentLinks)
      .where(and(eq(goalInvestmentLinks.goalId, goalId), eq(goalInvestmentLinks.isActive, true)));

    const targetDate = new Date(goal.targetDate);
    const now = new Date();
    const monthsRemaining = Math.max(1, Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30)));

    const projection = this.calculateGoalProjection(
      parseFloat(goal.currentAmount?.toString() || "0"),
      parseFloat(goal.targetAmount?.toString() || "0"),
      parseFloat(goal.monthlyContribution?.toString() || "0"),
      monthsRemaining,
      parseFloat(goal.expectedReturnRate?.toString() || "12"),
      parseFloat(goal.inflationRate?.toString() || "6")
    );

    return { goal, milestones, investments, projection };
  }

  async updateGoalProgress(goalId: string): Promise<FinancialGoal> {
    const goalDetails = await this.getGoalWithDetails(goalId);
    if (!goalDetails) throw new Error("Goal not found");

    const { goal, investments, projection } = goalDetails;
    
    let totalCurrentValue = parseFloat(goal.currentAmount?.toString() || "0");
    for (const inv of investments) {
      totalCurrentValue += parseFloat(inv.currentValue?.toString() || "0");
    }

    const [updated] = await db.update(financialGoals).set({
      currentAmount: totalCurrentValue.toString(),
      currentProgress: projection.progressPercentage.toString(),
      projectedValue: projection.projectedValue.toString(),
      onTrackStatus: projection.onTrackStatus,
      updatedAt: new Date(),
    }).where(eq(financialGoals.id, goalId)).returning();

    await this.checkAndUpdateMilestones(goalId, projection.progressPercentage);

    return updated;
  }

  async checkAndUpdateMilestones(goalId: string, currentProgress: number): Promise<GoalMilestone[]> {
    const milestones = await db.select().from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId))
      .orderBy(asc(goalMilestones.sortOrder));

    const updatedMilestones: GoalMilestone[] = [];

    for (const milestone of milestones) {
      const targetPct = parseFloat(milestone.targetPercentage?.toString() || "0");
      if (!milestone.isAchieved && currentProgress >= targetPct) {
        const [updated] = await db.update(goalMilestones).set({
          isAchieved: true,
          achievedAt: new Date(),
        }).where(eq(goalMilestones.id, milestone.id)).returning();
        updatedMilestones.push(updated);
      }
    }

    return updatedMilestones;
  }

  async linkInvestmentToGoal(data: InsertGoalInvestmentLink): Promise<GoalInvestmentLink> {
    const [link] = await db.insert(goalInvestmentLinks).values(data as any).returning();
    await this.updateGoalProgress(data.goalId);
    return link;
  }

  async unlinkInvestment(linkId: string): Promise<void> {
    const [link] = await db.select().from(goalInvestmentLinks).where(eq(goalInvestmentLinks.id, linkId)).limit(1);
    if (link) {
      await db.update(goalInvestmentLinks).set({ isActive: false, updatedAt: new Date() })
        .where(eq(goalInvestmentLinks.id, linkId));
      await this.updateGoalProgress(link.goalId);
    }
  }

  async deleteGoal(goalId: string): Promise<void> {
    await db.update(financialGoals).set({ isActive: false, updatedAt: new Date() })
      .where(eq(financialGoals.id, goalId));
  }

  async completeGoal(goalId: string): Promise<FinancialGoal> {
    const [updated] = await db.update(financialGoals).set({
      isCompleted: true,
      completedAt: new Date(),
      onTrackStatus: "on_track",
      currentProgress: "100",
      updatedAt: new Date(),
    }).where(eq(financialGoals.id, goalId)).returning();
    return updated;
  }

  async takeProgressSnapshot(goalId: string): Promise<void> {
    const details = await this.getGoalWithDetails(goalId);
    if (!details) return;

    const { goal, investments, projection } = details;
    
    const investmentsValue = investments.map(inv => ({
      investmentId: inv.id,
      value: parseFloat(inv.currentValue?.toString() || "0"),
    }));

    await db.insert(goalProgressSnapshots).values({
      goalId,
      currentAmount: goal.currentAmount?.toString() || "0",
      targetAmount: goal.targetAmount?.toString() || "0",
      progressPercentage: projection.progressPercentage.toString(),
      projectedValue: projection.projectedValue.toString(),
      onTrackStatus: projection.onTrackStatus,
      investmentsValue,
    } as any);
  }

  calculateSipWithStepUp(
    targetAmount: number,
    currentSavings: number,
    monthsRemaining: number,
    expectedReturnRate: number,
    inflationRate: number,
    annualStepUpPercent: number
  ): { initialSip: number; finalSip: number; totalInvestment: number } {
    const yearsRemaining = monthsRemaining / 12;
    const inflationAdjustedTarget = this.calculateInflationAdjustedAmount(
      targetAmount,
      inflationRate,
      yearsRemaining
    );

    const monthlyRate = expectedReturnRate / 100 / 12;
    const futureValueOfCurrent = currentSavings * Math.pow(1 + monthlyRate, monthsRemaining);
    const remainingTarget = Math.max(0, inflationAdjustedTarget - futureValueOfCurrent);

    let low = 0, high = remainingTarget / monthsRemaining * 2;
    
    const calculateFV = (initialSip: number) => {
      let fv = 0;
      let currentSip = initialSip;
      for (let month = 1; month <= monthsRemaining; month++) {
        if (month > 1 && month % 12 === 1) {
          currentSip *= (1 + annualStepUpPercent / 100);
        }
        fv = (fv + currentSip) * (1 + monthlyRate);
      }
      return fv;
    };

    while (high - low > 1) {
      const mid = (low + high) / 2;
      if (calculateFV(mid) < remainingTarget) {
        low = mid;
      } else {
        high = mid;
      }
    }

    const initialSip = Math.ceil(high);
    let finalSip = initialSip;
    let totalInvestment = 0;
    let currentSip = initialSip;
    
    for (let month = 1; month <= monthsRemaining; month++) {
      if (month > 1 && month % 12 === 1) {
        currentSip *= (1 + annualStepUpPercent / 100);
      }
      totalInvestment += currentSip;
      finalSip = currentSip;
    }

    return {
      initialSip,
      finalSip: Math.ceil(finalSip),
      totalInvestment: Math.round(totalInvestment),
    };
  }
}

export const goalPlanningEngine = new GoalPlanningEngine();
