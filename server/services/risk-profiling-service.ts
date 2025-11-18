/**
 * Risk Profiling Service
 * SEBI-compliant investment risk assessment questionnaire
 * Determines investor risk category: Conservative, Moderate, or Aggressive
 */

export interface RiskProfileQuestion {
  id: string;
  category: 'demographic' | 'financial' | 'experience' | 'psychology';
  question: string;
  type: 'single_choice' | 'multi_choice' | 'numeric_range';
  options: Array<{
    value: string;
    label: string;
    score: number;
  }>;
  required: boolean;
  sebiGuideline?: string;
}

export interface RiskProfileAnswer {
  questionId: string;
  answer: string | string[];
  score: number;
}

export interface RiskProfileResult {
  category: 'conservative' | 'moderate' | 'aggressive';
  score: number;
  maxScore: number;
  percentage: number;
  description: string;
  recommendations: string[];
  suitableProducts: string[];
  warnings: string[];
}

/**
 * SEBI-compliant risk profiling questionnaire
 * Based on SEBI guidelines for investor risk assessment
 */
export const RISK_PROFILE_QUESTIONS: RiskProfileQuestion[] = [
  // Q1: Age (Demographic)
  {
    id: 'age_group',
    category: 'demographic',
    question: 'What is your age group?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Age determines investment horizon and risk capacity',
    options: [
      { value: 'below_25', label: 'Below 25 years', score: 10 },
      { value: '25_35', label: '25-35 years', score: 9 },
      { value: '36_45', label: '36-45 years', score: 7 },
      { value: '46_55', label: '46-55 years', score: 5 },
      { value: '56_60', label: '56-60 years', score: 3 },
      { value: 'above_60', label: 'Above 60 years', score: 1 }
    ]
  },

  // Q2: Income Stability (Financial)
  {
    id: 'income_stability',
    category: 'financial',
    question: 'How would you describe your income source?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Income stability affects ability to sustain investments during volatility',
    options: [
      { value: 'stable_salaried', label: 'Stable salaried employment', score: 5 },
      { value: 'business_stable', label: 'Business with stable income', score: 7 },
      { value: 'business_variable', label: 'Business with variable income', score: 9 },
      { value: 'freelance', label: 'Freelance/Contract work', score: 8 },
      { value: 'retired_pension', label: 'Retired with pension', score: 2 },
      { value: 'retired_no_pension', label: 'Retired without regular income', score: 1 }
    ]
  },

  // Q3: Financial Dependents (Financial)
  {
    id: 'dependents',
    category: 'financial',
    question: 'How many people are financially dependent on you?',
    type: 'single_choice',
    required: true,
    options: [
      { value: 'none', label: 'None', score: 10 },
      { value: 'one', label: '1 person', score: 7 },
      { value: 'two', label: '2 people', score: 5 },
      { value: 'three_four', label: '3-4 people', score: 3 },
      { value: 'more_than_four', label: 'More than 4', score: 1 }
    ]
  },

  // Q4: Investment Horizon (Financial)
  {
    id: 'investment_horizon',
    category: 'financial',
    question: 'What is your investment time horizon?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Longer horizon allows for higher risk tolerance',
    options: [
      { value: 'less_1_year', label: 'Less than 1 year', score: 1 },
      { value: '1_3_years', label: '1-3 years', score: 3 },
      { value: '3_5_years', label: '3-5 years', score: 6 },
      { value: '5_10_years', label: '5-10 years', score: 8 },
      { value: 'more_10_years', label: 'More than 10 years', score: 10 }
    ]
  },

  // Q5: Investment Objective (Financial)
  {
    id: 'investment_objective',
    category: 'financial',
    question: 'What is your primary investment objective?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Investment objective determines suitable risk level',
    options: [
      { value: 'capital_preservation', label: 'Capital preservation (safety)', score: 1 },
      { value: 'regular_income', label: 'Regular income generation', score: 3 },
      { value: 'balanced_growth', label: 'Balanced growth and income', score: 5 },
      { value: 'capital_appreciation', label: 'Capital appreciation (growth)', score: 8 },
      { value: 'aggressive_growth', label: 'Aggressive wealth creation', score: 10 }
    ]
  },

  // Q6: Investment Experience (Experience)
  {
    id: 'investment_experience',
    category: 'experience',
    question: 'How long have you been investing in financial markets?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Experience indicates understanding of market risks',
    options: [
      { value: 'no_experience', label: 'No prior experience', score: 1 },
      { value: 'less_2_years', label: 'Less than 2 years', score: 3 },
      { value: '2_5_years', label: '2-5 years', score: 5 },
      { value: '5_10_years', label: '5-10 years', score: 7 },
      { value: 'more_10_years', label: 'More than 10 years', score: 10 }
    ]
  },

  // Q7: Product Familiarity (Experience)
  {
    id: 'product_familiarity',
    category: 'experience',
    question: 'Which investment products are you familiar with?',
    type: 'multi_choice',
    required: true,
    options: [
      { value: 'fd_savings', label: 'Fixed Deposits / Savings Accounts', score: 1 },
      { value: 'debt_funds', label: 'Debt Mutual Funds / Bonds', score: 2 },
      { value: 'equity_funds', label: 'Equity Mutual Funds', score: 3 },
      { value: 'direct_stocks', label: 'Direct Equity Stocks', score: 4 },
      { value: 'derivatives', label: 'Derivatives (F&O)', score: 5 },
      { value: 'alternative', label: 'Alternative Investments (AIF/PMS)', score: 4 }
    ]
  },

  // Q8: Loss Tolerance (Psychology)
  {
    id: 'loss_tolerance',
    category: 'psychology',
    question: 'If your investment portfolio loses 20% of its value in a month, what would you do?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Loss tolerance indicates emotional ability to handle volatility',
    options: [
      { value: 'exit_immediately', label: 'Exit immediately to prevent further losses', score: 1 },
      { value: 'exit_partially', label: 'Exit partially and move to safer options', score: 3 },
      { value: 'hold_wait', label: 'Hold and wait for recovery', score: 6 },
      { value: 'invest_more', label: 'Invest more to average down cost', score: 10 }
    ]
  },

  // Q9: Return Expectations (Psychology)
  {
    id: 'return_expectations',
    category: 'psychology',
    question: 'What annual returns do you expect from your investments?',
    type: 'single_choice',
    required: true,
    options: [
      { value: '6_8_percent', label: '6-8% (Bank FD level)', score: 2 },
      { value: '8_12_percent', label: '8-12% (Moderate growth)', score: 5 },
      { value: '12_18_percent', label: '12-18% (Equity-like returns)', score: 7 },
      { value: 'above_18_percent', label: 'Above 18% (High growth)', score: 10 }
    ]
  },

  // Q10: Risk Appetite Statement (Psychology)
  {
    id: 'risk_appetite',
    category: 'psychology',
    question: 'Which statement best describes your risk appetite?',
    type: 'single_choice',
    required: true,
    sebiGuideline: 'Self-assessment of risk tolerance',
    options: [
      { value: 'avoid_risk', label: 'I prefer to avoid any risk, even if returns are lower', score: 1 },
      { value: 'minimal_risk', label: 'I can take minimal risk for slightly better returns', score: 3 },
      { value: 'moderate_risk', label: 'I can accept moderate risk for reasonable returns', score: 6 },
      { value: 'high_risk', label: 'I can take high risk for potentially high returns', score: 9 },
      { value: 'very_high_risk', label: 'I am comfortable with very high risk for maximum returns', score: 10 }
    ]
  }
];

export class RiskProfilingService {
  /**
   * Calculate risk profile based on questionnaire answers
   */
  calculateRiskProfile(answers: RiskProfileAnswer[]): RiskProfileResult {
    const totalScore = answers.reduce((sum, ans) => sum + ans.score, 0);
    
    // Maximum possible score
    const maxScore = RISK_PROFILE_QUESTIONS.reduce((sum, q) => {
      if (q.type === 'multi_choice') {
        // For multi-choice, max is sum of all option scores
        return sum + q.options.reduce((optSum, opt) => optSum + opt.score, 0);
      }
      // For single choice, max is highest score
      return sum + Math.max(...q.options.map(opt => opt.score));
    }, 0);

    const percentage = (totalScore / maxScore) * 100;

    // Determine risk category based on score percentage
    let category: 'conservative' | 'moderate' | 'aggressive';
    let description: string;
    let recommendations: string[];
    let suitableProducts: string[];
    let warnings: string[];

    if (percentage < 35) {
      category = 'conservative';
      description = 'You have a conservative risk profile. You prioritize capital preservation and stability over high returns.';
      recommendations = [
        'Focus on capital preservation and regular income',
        'Limit equity exposure to 20-30% of portfolio',
        'Prefer debt funds, FDs, and government securities',
        'Consider Monthly Income Plans (MIPs) and conservative hybrid funds'
      ];
      suitableProducts = [
        'Fixed Deposits',
        'Debt Mutual Funds',
        'Government Securities',
        'Conservative Hybrid Funds',
        'Liquid Funds'
      ];
      warnings = [
        'Direct equity investments may not be suitable',
        'Avoid high-volatility products',
        'Be cautious with sector-specific funds'
      ];
    } else if (percentage < 65) {
      category = 'moderate';
      description = 'You have a moderate risk profile. You seek balanced growth with manageable risk.';
      recommendations = [
        'Maintain balanced portfolio with 40-60% equity exposure',
        'Diversify across equity and debt instruments',
        'Consider balanced/hybrid mutual funds',
        'Use SIP for equity exposure to manage volatility'
      ];
      suitableProducts = [
        'Balanced/Hybrid Mutual Funds',
        'Large Cap Equity Funds',
        'Index Funds',
        'Corporate Bonds',
        'Debt Funds with moderate duration'
      ];
      warnings = [
        'Limit exposure to small-cap and sectoral funds',
        'Avoid concentrated positions',
        'Monitor portfolio regularly'
      ];
    } else {
      category = 'aggressive';
      description = 'You have an aggressive risk profile. You are willing to take significant risks for potentially higher returns.';
      recommendations = [
        'Can allocate 70-90% to equity instruments',
        'Explore growth-oriented equity funds',
        'Consider mid-cap and small-cap opportunities',
        'Suitable for alternative investments (AIF/PMS) if eligible'
      ];
      suitableProducts = [
        'Equity Mutual Funds (all categories)',
        'Direct Stocks',
        'Mid-cap and Small-cap Funds',
        'Sectoral/Thematic Funds',
        'Alternative Investment Funds (if eligible)',
        'Portfolio Management Services (if eligible)'
      ];
      warnings = [
        'High volatility is expected - be prepared',
        'Do not invest emergency funds',
        'Maintain long-term perspective (5+ years)',
        'Ensure adequate insurance and emergency corpus'
      ];
    }

    return {
      category,
      score: totalScore,
      maxScore,
      percentage: Math.round(percentage),
      description,
      recommendations,
      suitableProducts,
      warnings
    };
  }

  /**
   * Validate questionnaire answers
   */
  validateAnswers(answers: RiskProfileAnswer[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for duplicate question IDs to prevent score inflation
    const questionIdCounts = new Map<string, number>();
    for (const answer of answers) {
      const count = questionIdCounts.get(answer.questionId) || 0;
      questionIdCounts.set(answer.questionId, count + 1);
    }

    // Convert Map entries to array for iteration compatibility
    for (const [questionId, count] of Array.from(questionIdCounts.entries())) {
      if (count > 1) {
        const question = RISK_PROFILE_QUESTIONS.find(q => q.id === questionId);
        const questionText = question?.question || questionId;
        errors.push(`Question "${questionText}" answered multiple times (${count}). Each question must be answered exactly once.`);
      }
    }

    // Check all required questions are answered
    const requiredQuestions = RISK_PROFILE_QUESTIONS.filter(q => q.required);
    const answeredQuestionIds = new Set(answers.map(a => a.questionId));

    for (const question of requiredQuestions) {
      if (!answeredQuestionIds.has(question.id)) {
        errors.push(`Question "${question.question}" is required`);
      }
    }

    // Validate each answer
    for (const answer of answers) {
      const question = RISK_PROFILE_QUESTIONS.find(q => q.id === answer.questionId);
      
      if (!question) {
        errors.push(`Invalid question ID: ${answer.questionId}`);
        continue;
      }

      // Validate answer format
      if (question.type === 'single_choice') {
        if (typeof answer.answer !== 'string') {
          errors.push(`Question "${question.question}" expects a single answer`);
          continue;
        }

        const validOption = question.options.find(opt => opt.value === answer.answer);
        if (!validOption) {
          errors.push(`Invalid answer for question "${question.question}"`);
        }
      }

      if (question.type === 'multi_choice') {
        if (!Array.isArray(answer.answer)) {
          errors.push(`Question "${question.question}" expects multiple answers`);
          continue;
        }

        // Require at least one selection for required multi-choice questions
        if (question.required && answer.answer.length === 0) {
          errors.push(`Question "${question.question}" requires at least one selection`);
          continue;
        }

        // Check for duplicate selections
        const uniqueValues = new Set(answer.answer);
        if (uniqueValues.size !== answer.answer.length) {
          errors.push(`Question "${question.question}" contains duplicate selections`);
        }

        // Validate each selection
        const validValues = new Set(question.options.map(opt => opt.value));
        for (const val of answer.answer) {
          if (!validValues.has(val)) {
            errors.push(`Invalid answer "${val}" for question "${question.question}"`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Convert raw answers to scored answers
   */
  scoreAnswers(rawAnswers: Array<{ questionId: string; answer: string | string[] }>): RiskProfileAnswer[] {
    const scoredAnswers: RiskProfileAnswer[] = [];

    for (const raw of rawAnswers) {
      const question = RISK_PROFILE_QUESTIONS.find(q => q.id === raw.questionId);
      if (!question) continue;

      let score = 0;

      if (question.type === 'single_choice' && typeof raw.answer === 'string') {
        const option = question.options.find(opt => opt.value === raw.answer);
        score = option?.score || 0;
      }

      if (question.type === 'multi_choice' && Array.isArray(raw.answer)) {
        // Deduplicate answers to prevent score inflation
        const uniqueAnswers = Array.from(new Set(raw.answer));
        
        score = uniqueAnswers.reduce((sum, val) => {
          const option = question.options.find(opt => opt.value === val);
          return sum + (option?.score || 0);
        }, 0);
      }

      scoredAnswers.push({
        questionId: raw.questionId,
        answer: raw.answer,
        score
      });
    }

    return scoredAnswers;
  }

  /**
   * Get all questionnaire questions
   */
  getQuestionnaire(): RiskProfileQuestion[] {
    return RISK_PROFILE_QUESTIONS;
  }
}

export const riskProfilingService = new RiskProfilingService();
