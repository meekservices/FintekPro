import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface ExpenseCategorizationResult {
  category: string;
  subcategory?: string;
  confidence: number;
  reasoning: string;
  alternativeCategories: Array<{
    category: string;
    subcategory?: string;
    confidence: number;
  }>;
}

interface BudgetSuggestion {
  category: string;
  suggestedAmount: number;
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
  tips: string[];
}

interface SpendingInsight {
  insightType: 'spending_pattern' | 'anomaly' | 'budget_suggestion' | 'saving_opportunity' | 'trend_analysis';
  title: string;
  description: string;
  category?: string;
  recommendations: string[];
  potentialSavings?: number;
  priority: 'high' | 'medium' | 'low';
  aiAnalysis: any;
}

/**
 * AI-powered expense categorization
 * Analyzes expense description and automatically categorizes it
 */
export async function categorizeExpense(
  description: string,
  amount: number,
  merchantName?: string,
  date?: Date
): Promise<ExpenseCategorizationResult> {
  const prompt = `You are an expert financial advisor specializing in expense categorization.

Analyze this expense transaction and categorize it accurately:

Description: ${description}
Amount: ₹${amount}
${merchantName ? `Merchant: ${merchantName}` : ''}
${date ? `Date: ${date.toISOString()}` : ''}

Available categories (use exactly one):
- housing (rent, mortgage, property tax, home maintenance)
- food (groceries, restaurants, food delivery)
- transportation (fuel, public transport, vehicle maintenance, taxi/uber)
- utilities (electricity, water, gas, internet, phone)
- entertainment (movies, subscriptions, hobbies, games)
- healthcare (medical, pharmacy, insurance, fitness)
- education (tuition, courses, books, training)
- shopping (clothing, electronics, personal items)
- travel (flights, hotels, vacation expenses)
- insurance (life, health, vehicle, property insurance)
- investment (SIP, stocks, mutual funds)
- other (miscellaneous expenses)

Provide a primary category with confidence score (0-100), subcategory (optional), reasoning, and 2-3 alternative categorizations.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            category: { type: "string" },
            subcategory: { type: "string" },
            confidence: { type: "number" },
            reasoning: { type: "string" },
            alternativeCategories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  subcategory: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["category", "confidence"]
              }
            }
          },
          required: ["category", "confidence", "reasoning", "alternativeCategories"]
        }
      },
      contents: prompt,
    });

    const result = JSON.parse(response.text || '{}');
    return result as ExpenseCategorizationResult;
  } catch (error) {
    console.error("AI categorization error:", error);
    // Fallback categorization
    return {
      category: "other",
      confidence: 0,
      reasoning: "AI categorization failed, defaulting to 'other'",
      alternativeCategories: []
    };
  }
}

/**
 * Generate personalized budget suggestions based on spending history
 */
export async function generateBudgetSuggestions(
  monthlyIncome: number,
  spendingHistory: Array<{ category: string; totalAmount: number; transactionCount: number }>,
  currentBudgets?: Array<{ category: string; amount: number }>
): Promise<BudgetSuggestion[]> {
  const prompt = `You are a certified financial planner. Analyze the user's spending patterns and suggest optimal budgets.

User Profile:
Monthly Income: ₹${monthlyIncome}

Current Spending (Last 3 months average):
${spendingHistory.map(s => `- ${s.category}: ₹${s.totalAmount} (${s.transactionCount} transactions)`).join('\n')}

${currentBudgets ? `Current Budgets:\n${currentBudgets.map(b => `- ${b.category}: ₹${b.amount}`).join('\n')}` : 'No budgets set'}

Provide budget suggestions following the 50/30/20 rule (50% needs, 30% wants, 20% savings/investments):
1. Suggest realistic monthly budget amounts for each spending category
2. Prioritize essential categories (housing, food, utilities)
3. Identify areas to reduce spending
4. Include practical tips for each category
5. Consider Indian financial norms and cost of living`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            budgetSuggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  suggestedAmount: { type: "number" },
                  reasoning: { type: "string" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  tips: { type: "array", items: { type: "string" } }
                },
                required: ["category", "suggestedAmount", "reasoning", "priority", "tips"]
              }
            }
          },
          required: ["budgetSuggestions"]
        }
      },
      contents: prompt,
    });

    const result = JSON.parse(response.text || '{"budgetSuggestions":[]}');
    return result.budgetSuggestions as BudgetSuggestion[];
  } catch (error) {
    console.error("Budget suggestion error:", error);
    return [];
  }
}

/**
 * Analyze spending patterns and generate actionable insights
 */
export async function analyzeSpendingPatterns(
  expenses: Array<{
    category: string;
    amount: number;
    date: Date;
    description: string;
  }>,
  budgets?: Array<{
    category: string;
    budgetAmount: number;
    currentSpend: number;
  }>
): Promise<SpendingInsight[]> {
  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalSpending = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);

  const prompt = `You are a financial analyst. Analyze this spending data and provide actionable insights.

Total Spending: ₹${totalSpending}
Number of Transactions: ${expenses.length}

Spending by Category:
${Object.entries(categoryTotals).map(([cat, amt]) => `- ${cat}: ₹${amt} (${((amt/totalSpending)*100).toFixed(1)}%)`).join('\n')}

${budgets ? `Budget Status:\n${budgets.map(b => `- ${b.category}: ₹${b.currentSpend}/₹${b.budgetAmount} (${((b.currentSpend/b.budgetAmount)*100).toFixed(1)}%)`).join('\n')}` : ''}

Recent Transactions:
${expenses.slice(-5).map(e => `- ${e.date.toLocaleDateString()}: ${e.description} - ₹${e.amount} (${e.category})`).join('\n')}

Provide 3-5 key insights including:
1. Spending patterns and trends
2. Unusual or anomalous transactions
3. Budget optimization opportunities
4. Potential savings recommendations
5. Category-specific advice

Each insight should have a clear title, description, actionable recommendations, and estimated savings potential.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  insightType: { 
                    type: "string", 
                    enum: ["spending_pattern", "anomaly", "budget_suggestion", "saving_opportunity", "trend_analysis"] 
                  },
                  title: { type: "string" },
                  description: { type: "string" },
                  category: { type: "string" },
                  recommendations: { type: "array", items: { type: "string" } },
                  potentialSavings: { type: "number" },
                  priority: { type: "string", enum: ["high", "medium", "low"] },
                  aiAnalysis: { type: "object" }
                },
                required: ["insightType", "title", "description", "recommendations", "priority"]
              }
            }
          },
          required: ["insights"]
        }
      },
      contents: prompt,
    });

    const result = JSON.parse(response.text || '{"insights":[]}');
    return result.insights as SpendingInsight[];
  } catch (error) {
    console.error("Spending analysis error:", error);
    return [];
  }
}

/**
 * Detect spending anomalies using AI
 */
export async function detectSpendingAnomalies(
  recentExpenses: Array<{ category: string; amount: number; description: string; date: Date }>,
  historicalAverage: Record<string, number>
): Promise<Array<{ expense: any; anomalyReason: string; severity: 'high' | 'medium' | 'low' }>> {
  const anomalies: Array<{ expense: any; anomalyReason: string; severity: 'high' | 'medium' | 'low' }> = [];

  for (const expense of recentExpenses) {
    const avgForCategory = historicalAverage[expense.category] || 0;
    
    // Flag if expense is 2x or more than average
    if (avgForCategory > 0 && expense.amount >= avgForCategory * 2) {
      const prompt = `Is this expense unusual? 
      
Expense: ${expense.description} - ₹${expense.amount} in ${expense.category}
Historical Average for ${expense.category}: ₹${avgForCategory}

Determine if this is a genuine anomaly or a normal expense (like annual payments, emergency expenses, etc.)`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                isAnomaly: { type: "boolean" },
                reason: { type: "string" },
                severity: { type: "string", enum: ["high", "medium", "low"] }
              },
              required: ["isAnomaly", "reason", "severity"]
            }
          },
          contents: prompt,
        });

        const result = JSON.parse(response.text || '{"isAnomaly":false,"reason":"","severity":"low"}');
        if (result.isAnomaly) {
          anomalies.push({
            expense,
            anomalyReason: result.reason,
            severity: result.severity
          });
        }
      } catch (error) {
        console.error("Anomaly detection error:", error);
      }
    }
  }

  return anomalies;
}
