/* eslint-disable no-console */
import { db } from "../db";
import { riskAssessmentQuestions } from "../../shared/schema";
import { eq } from "drizzle-orm";

export interface SeedQuestion {
  id: string;
  category: "risk_tolerance" | "investment_goals" | "financial_situation";
  question: string;
  questionType: "multiple_choice";
  weightage: number;
  options: Array<{
    value: string;
    label: string;
    score: number;
  }>;
  isActive: boolean;
}

export const SEBI_RISK_QUESTIONS: SeedQuestion[] = [
  {
    id: "rq_market_drop_reaction",
    category: "risk_tolerance",
    question: "If your equity/mutual fund portfolio drops 20% in a market correction, what action would you take?",
    questionType: "multiple_choice",
    weightage: 3,
    options: [
      { value: "panic_sell", label: "Sell all holdings immediately to prevent further loss", score: 10 },
      { value: "cut_losses", label: "Sell a portion (30-50%) to reduce risk exposure", score: 30 },
      { value: "hold_steady", label: "Hold investments and wait for the market to recover", score: 60 },
      { value: "buy_more", label: "Treat it as an opportunity and invest additional capital", score: 95 },
    ],
    isActive: true,
  },
  {
    id: "rq_return_expectation",
    category: "risk_tolerance",
    question: "Which statement best describes your risk-return preference?",
    questionType: "multiple_choice",
    weightage: 3,
    options: [
      { value: "safety_first", label: "Guaranteed principal safety with modest returns (Fixed Deposit / Liquid)", score: 15 },
      { value: "conservative", label: "Low volatility with returns slightly beating inflation (Debt / Conservative Hybrid)", score: 35 },
      { value: "balanced", label: "Moderate volatility with balanced equity-debt growth (Balanced Advantage / Hybrid)", score: 55 },
      { value: "growth", label: "High growth potential accepting moderate-to-high volatility (Diversified Equity)", score: 80 },
      { value: "aggressive", label: "Maximum capital appreciation accepting severe market swings (Mid & Small Cap / Thematic)", score: 100 },
    ],
    isActive: true,
  },
  {
    id: "rq_volatility_comfort",
    category: "risk_tolerance",
    question: "How do you feel when viewing daily value fluctuations in your investment portfolio?",
    questionType: "multiple_choice",
    weightage: 2,
    options: [
      { value: "very_anxious", label: "Extremely stressed; daily negative returns keep me up at night", score: 10 },
      { value: "uncomfortable", label: "Somewhat uncomfortable, but I tolerate small movements", score: 35 },
      { value: "neutral", label: "Comfortable; I understand volatility is part of investing", score: 65 },
      { value: "indifferent", label: "Completely relaxed; I only look at long-term 3-5 year trends", score: 90 },
    ],
    isActive: true,
  },
  {
    id: "rq_investment_horizon",
    category: "investment_goals",
    question: "What is your primary planned investment horizon before needing to withdraw this capital?",
    questionType: "multiple_choice",
    weightage: 3,
    options: [
      { value: "less_than_1yr", label: "Less than 1 year (Short-term parking / liquidity)", score: 15 },
      { value: "1_to_3yrs", label: "1 to 3 years (Medium-term goal)", score: 40 },
      { value: "3_to_5yrs", label: "3 to 5 years (Medium to long-term wealth)", score: 65 },
      { value: "5_to_10yrs", label: "5 to 10 years (Long-term compounding)", score: 85 },
      { value: "more_than_10yrs", label: "10+ years (Retirement / Multi-generational wealth)", score: 100 },
    ],
    isActive: true,
  },
  {
    id: "rq_primary_goal",
    category: "investment_goals",
    question: "What is the single most important objective for your portfolio?",
    questionType: "multiple_choice",
    weightage: 2,
    options: [
      { value: "capital_preservation", label: "Protect capital; zero tolerance for loss", score: 10 },
      { value: "regular_income", label: "Generate regular predictable cash flow/dividends", score: 35 },
      { value: "wealth_building", label: "Balanced growth and retirement corpus accumulation", score: 65 },
      { value: "aggressive_wealth", label: "Rapid wealth generation and multi-bagger alpha", score: 95 },
    ],
    isActive: true,
  },
  {
    id: "rq_emergency_fund",
    category: "financial_situation",
    question: "Do you have an adequate emergency fund held outside this investment?",
    questionType: "multiple_choice",
    weightage: 2,
    options: [
      { value: "none", label: "No separate emergency savings", score: 15 },
      { value: "1_3_months", label: "1 to 3 months of living expenses saved", score: 40 },
      { value: "3_6_months", label: "3 to 6 months of living expenses saved in liquid funds", score: 70 },
      { value: "6_plus_months", label: "6+ months of living expenses readily accessible", score: 95 },
    ],
    isActive: true,
  },
  {
    id: "rq_income_stability",
    category: "financial_situation",
    question: "How predictable and stable is your personal / household income over the next 3 years?",
    questionType: "multiple_choice",
    weightage: 2,
    options: [
      { value: "irregular", label: "Irregular or uncertain cash flows (commission/project-based)", score: 25 },
      { value: "variable", label: "Moderate stability with cyclical bonuses or business earnings", score: 50 },
      { value: "stable", label: "Stable salaried income or established professional practice", score: 75 },
      { value: "highly_secure", label: "Highly secure government/PSU/senior corporate or substantial rental/pension", score: 95 },
    ],
    isActive: true,
  },
  {
    id: "rq_investing_experience",
    category: "financial_situation",
    question: "What is your level of prior experience in capital market investing?",
    questionType: "multiple_choice",
    weightage: 2,
    options: [
      { value: "beginner", label: "Beginner: Mostly FDs, PPF, or gold; little or no mutual fund/stock experience", score: 20 },
      { value: "intermediate", label: "Intermediate: Have invested in mutual funds or SIPs for 2-5 years", score: 50 },
      { value: "experienced", label: "Experienced: Actively invest in stocks, ETFs, and mutual funds for 5+ years", score: 75 },
      { value: "expert", label: "Advanced: Experienced with multi-asset classes, F&O, bonds, and structured products", score: 95 },
    ],
    isActive: true,
  },
  {
    id: "rq_net_worth_allocation",
    category: "financial_situation",
    question: "What portion of your total liquid net worth does this investment represent?",
    questionType: "multiple_choice",
    weightage: 2,
    options: [
      { value: "majority", label: "More than 75% of my investable wealth", score: 20 },
      { value: "substantial", label: "50% to 75% of my investable wealth", score: 45 },
      { value: "moderate", label: "25% to 50% of my investable wealth", score: 70 },
      { value: "small", label: "Less than 25% of my investable wealth", score: 95 },
    ],
    isActive: true,
  },
  {
    id: "rq_dependents",
    category: "financial_situation",
    question: "How many financial dependents (children, non-earning spouse, elderly parents) rely on you?",
    questionType: "multiple_choice",
    weightage: 1,
    options: [
      { value: "three_plus", label: "3 or more dependents", score: 30 },
      { value: "two", label: "2 dependents", score: 55 },
      { value: "one", label: "1 dependent", score: 75 },
      { value: "none", label: "0 dependents (self-supporting only)", score: 95 },
    ],
    isActive: true,
  },
];

export async function seedRiskAssessmentQuestions(): Promise<void> {
  console.log("🌱 Seeding SEBI Risk Assessment Questions...");
  let count = 0;
  for (const q of SEBI_RISK_QUESTIONS) {
    await db
      .insert(riskAssessmentQuestions)
      .values({
        id: q.id,
        category: q.category,
        question: q.question,
        questionType: q.questionType,
        options: q.options,
        weightage: q.weightage,
        isActive: q.isActive,
      })
      .onConflictDoUpdate({
        target: riskAssessmentQuestions.id,
        set: {
          category: q.category,
          question: q.question,
          options: q.options,
          weightage: q.weightage,
          isActive: q.isActive,
        },
      });
    count++;
  }
  console.log(`✅ Seeded ${count} SEBI Risk Assessment Questions successfully!`);
}

