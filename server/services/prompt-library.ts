/**
 * Centralized AI Prompt Library
 * P3 — Versioned prompt templates for all AI-powered features.
 *
 * Benefits:
 * - Single source of truth for all prompts (easier A/B testing, version history)
 * - Consistent regulatory disclaimers across all AI outputs
 * - Structured interpolation reduces prompt injection risk
 * - Metrics tagging lets the AI logging system attribute costs to features
 */

export type PromptId =
  | 'investment_proposal'
  | 'portfolio_review'
  | 'risk_profile_assessment'
  | 'market_commentary'
  | 'tax_summary'
  | 'loan_eligibility'
  | 'client_onboarding_summary'
  | 'mf_recommendation'
  | 'bond_recommendation'
  | 'stock_analysis'
  | 'sip_health_check'
  | 'family_portfolio_summary'
  | 'kyc_document_extract'
  | 'capital_gains_narration'
  | 'insurance_recommendation';

export interface PromptTemplate {
  id: PromptId;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  maxTokens: number;
  temperature: number;
  model: 'gpt-4o' | 'gpt-4o-mini' | 'gemini-3.1-flash-lite';
  requiredVars: string[];
  regulatoryDisclaimer?: string;
}

const SEBI_DISCLAIMER =
  'This is an AI-generated analysis for informational purposes only and does not constitute SEBI-registered investment advice. Past performance is not indicative of future results. Please consult a qualified SEBI-registered advisor before making investment decisions.';

const IRDAI_DISCLAIMER =
  'This is an AI-generated summary. Insurance products involve risk; please read all documents carefully and consult an IRDAI-licensed advisor.';

const PROMPTS: Record<PromptId, PromptTemplate> = {
  investment_proposal: {
    id: 'investment_proposal',
    version: '1.2',
    model: 'gpt-4o',
    maxTokens: 2000,
    temperature: 0.3,
    requiredVars: ['clientName', 'riskProfile', 'investmentAmount', 'horizon', 'goals'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a SEBI-registered investment advisor assistant. Generate professional investment proposals that comply with SEBI IA Regulations 2013. Always include risk disclosures. Present balanced information including both opportunities and risks.`,
    userPromptTemplate: `Generate a structured investment proposal for:
Client: {{clientName}}
Risk Profile: {{riskProfile}}
Investment Amount: ₹{{investmentAmount}}
Investment Horizon: {{horizon}}
Financial Goals: {{goals}}

Include: executive summary, recommended asset allocation, specific product recommendations with rationale, risk disclosure, expected returns (with caveats), and next steps.`,
  },

  portfolio_review: {
    id: 'portfolio_review',
    version: '1.1',
    model: 'gpt-4o',
    maxTokens: 1500,
    temperature: 0.2,
    requiredVars: ['clientName', 'portfolioSummary', 'benchmarkReturns'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a portfolio analyst. Review portfolios objectively, highlight underperformers, and suggest rebalancing opportunities aligned with the client's stated risk profile.`,
    userPromptTemplate: `Review the following portfolio for {{clientName}}:

Portfolio Summary:
{{portfolioSummary}}

Benchmark Returns: {{benchmarkReturns}}

Provide: performance attribution, concentration risk analysis, rebalancing recommendations, and actionable next steps.`,
  },

  risk_profile_assessment: {
    id: 'risk_profile_assessment',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.1,
    requiredVars: ['questionnaireResponses', 'ageGroup', 'incomeRange'],
    systemPrompt: `You are a risk profiling expert. Based on questionnaire responses, classify the investor into: Conservative, Moderate-Conservative, Moderate, Moderate-Aggressive, or Aggressive. Provide clear reasoning.`,
    userPromptTemplate: `Based on the following investor questionnaire responses, determine the risk profile:

Age Group: {{ageGroup}}
Income Range: {{incomeRange}}
Responses: {{questionnaireResponses}}

Output: Risk Category, Reasoning (2-3 sentences), Recommended Asset Allocation (% equity / debt / alternatives).`,
  },

  market_commentary: {
    id: 'market_commentary',
    version: '1.0',
    model: 'gemini-3.1-flash-lite',
    maxTokens: 600,
    temperature: 0.4,
    requiredVars: ['marketData', 'sectorPerformance', 'date'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a financial market commentator. Write concise, factual daily market summaries suitable for retail investors.`,
    userPromptTemplate: `Write a brief market commentary for {{date}}:

Market Data: {{marketData}}
Sector Performance: {{sectorPerformance}}

Keep it under 150 words. Include key index moves, top/bottom sectors, and one forward-looking observation.`,
  },

  tax_summary: {
    id: 'tax_summary',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 1200,
    temperature: 0.1,
    requiredVars: ['capitalGainsData', 'assessmentYear', 'clientName'],
    systemPrompt: `You are a tax assistant specializing in Indian capital gains taxation. Explain tax implications clearly and accurately per the Income Tax Act.`,
    userPromptTemplate: `Generate a tax summary for {{clientName}} for AY {{assessmentYear}}:

Capital Gains Data:
{{capitalGainsData}}

Include: STCG/LTCG breakdown, applicable tax rates (including surcharge if applicable), estimated tax liability, and tax-saving suggestions (harvesting, ELSS, etc.).`,
  },

  loan_eligibility: {
    id: 'loan_eligibility',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.2,
    requiredVars: ['applicantProfile', 'loanType', 'requestedAmount'],
    systemPrompt: `You are a loan eligibility advisor. Assess applications based on standard lending criteria (CIBIL score, income, existing EMIs, LTV ratio) and provide clear recommendations.`,
    userPromptTemplate: `Assess loan eligibility for:

Applicant Profile: {{applicantProfile}}
Loan Type: {{loanType}}
Requested Amount: ₹{{requestedAmount}}

Provide: eligibility verdict, estimated eligible amount, key concerns, and recommended next steps.`,
  },

  client_onboarding_summary: {
    id: 'client_onboarding_summary',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 600,
    temperature: 0.2,
    requiredVars: ['clientData', 'kycStatus', 'completedSteps'],
    systemPrompt: `You are an onboarding assistant. Summarize client onboarding status clearly for agents.`,
    userPromptTemplate: `Summarize the onboarding status for this client:

Client Data: {{clientData}}
KYC Status: {{kycStatus}}
Completed Steps: {{completedSteps}}

Output: progress percentage, pending steps with priority, any blockers, estimated completion time.`,
  },

  mf_recommendation: {
    id: 'mf_recommendation',
    version: '1.1',
    model: 'gpt-4o-mini',
    maxTokens: 1000,
    temperature: 0.2,
    requiredVars: ['riskProfile', 'investmentAmount', 'horizon', 'fundOptions'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are an AMFI-registered mutual fund distributor assistant. Recommend appropriate mutual fund schemes based on client profile. Always mention relevant risks.`,
    userPromptTemplate: `Recommend mutual funds for:

Risk Profile: {{riskProfile}}
Investment Amount: ₹{{investmentAmount}}
Horizon: {{horizon}}

Available fund options with performance data:
{{fundOptions}}

Output: Top 3 recommendations with rationale, expense ratio commentary, and portfolio fit analysis.`,
  },

  bond_recommendation: {
    id: 'bond_recommendation',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.2,
    requiredVars: ['riskProfile', 'yieldRequirement', 'bondOptions'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a fixed income specialist. Recommend bonds and debentures appropriate for the client's risk profile and yield requirements.`,
    userPromptTemplate: `Recommend bonds for a {{riskProfile}} investor with {{yieldRequirement}}% yield requirement.

Available bonds:
{{bondOptions}}

Output: Top 3 recommendations with credit rating, yield-to-maturity, liquidity assessment, and default risk commentary.`,
  },

  stock_analysis: {
    id: 'stock_analysis',
    version: '1.0',
    model: 'gpt-4o',
    maxTokens: 1200,
    temperature: 0.3,
    requiredVars: ['ticker', 'fundamentalData', 'technicalData'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a SEBI-registered research analyst assistant. Provide balanced equity research analysis covering both fundamental and technical perspectives.`,
    userPromptTemplate: `Analyze {{ticker}}:

Fundamental Data: {{fundamentalData}}
Technical Data: {{technicalData}}

Provide: valuation summary (P/E vs peers, DCF outlook), technical trend, key risks, and a balanced view (not a buy/sell recommendation).`,
  },

  sip_health_check: {
    id: 'sip_health_check',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 600,
    temperature: 0.2,
    requiredVars: ['sipPortfolio', 'clientGoals'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a SIP health advisor. Review SIP portfolios for alignment with goals, adequate diversification, and SIP step-up opportunities.`,
    userPromptTemplate: `Review the following SIP portfolio:

SIP Portfolio: {{sipPortfolio}}
Client Goals: {{clientGoals}}

Output: goal alignment score (0-100), diversification assessment, underperforming SIPs to review, and step-up recommendation.`,
  },

  family_portfolio_summary: {
    id: 'family_portfolio_summary',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.2,
    requiredVars: ['familyMembers', 'combinedPortfolio'],
    regulatoryDisclaimer: SEBI_DISCLAIMER,
    systemPrompt: `You are a family wealth advisor. Provide consolidated family portfolio analysis with inter-member overlap detection and joint tax efficiency suggestions.`,
    userPromptTemplate: `Analyze consolidated family portfolio:

Family Members: {{familyMembers}}
Combined Portfolio:
{{combinedPortfolio}}

Output: total wealth summary, asset allocation across family, overlap/concentration risk, tax efficiency opportunities, and succession planning observations.`,
  },

  kyc_document_extract: {
    id: 'kyc_document_extract',
    version: '1.0',
    model: 'gpt-4o',
    maxTokens: 500,
    temperature: 0.0,
    requiredVars: ['documentType', 'extractedText'],
    systemPrompt: `You are a KYC document parser. Extract structured data from OCR text accurately. Return only valid JSON with no commentary.`,
    userPromptTemplate: `Extract structured data from this {{documentType}} document:

OCR Text:
{{extractedText}}

Return JSON with relevant fields (name, dob, id_number, address, etc.) and a confidence score (0-1) for each field.`,
  },

  capital_gains_narration: {
    id: 'capital_gains_narration',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 600,
    temperature: 0.2,
    requiredVars: ['gainsData', 'financialYear'],
    systemPrompt: `You are a capital gains report writer. Generate clear, client-friendly narrations of capital gains activity.`,
    userPromptTemplate: `Write a capital gains narration for FY {{financialYear}}:

Gains Data: {{gainsData}}

Produce a 3-4 sentence plain-English summary suitable for including in a client report, mentioning total realized gains, applicable tax category, and one notable transaction.`,
  },

  insurance_recommendation: {
    id: 'insurance_recommendation',
    version: '1.0',
    model: 'gpt-4o-mini',
    maxTokens: 800,
    temperature: 0.3,
    requiredVars: ['clientProfile', 'existingCoverage', 'insuranceOptions'],
    regulatoryDisclaimer: IRDAI_DISCLAIMER,
    systemPrompt: `You are an IRDAI-licensed insurance advisor assistant. Recommend appropriate insurance products based on client life stage, dependents, and coverage gaps.`,
    userPromptTemplate: `Recommend insurance for:

Client Profile: {{clientProfile}}
Existing Coverage: {{existingCoverage}}

Available products: {{insuranceOptions}}

Output: coverage gap analysis, top 2-3 product recommendations with premium estimates, and priority order with reasoning.`,
  },
};

/**
 * Get a prompt template by ID.
 */
export function getPrompt(id: PromptId): PromptTemplate {
  const template = PROMPTS[id];
  if (!template) throw new Error(`Unknown prompt ID: ${id}`);
  return template;
}

/**
 * Interpolate a prompt template with variables.
 * Throws if any required variable is missing.
 */
export function buildPrompt(
  id: PromptId,
  vars: Record<string, string | number>,
): { systemPrompt: string; userPrompt: string; metadata: Pick<PromptTemplate, 'model' | 'maxTokens' | 'temperature' | 'version' | 'regulatoryDisclaimer'> } {
  const template = getPrompt(id);

  const missing = template.requiredVars.filter((v) => !(v in vars));
  if (missing.length > 0) {
    throw new Error(`Missing required variables for prompt "${id}": ${missing.join(', ')}`);
  }

  let userPrompt = template.userPromptTemplate;
  for (const [key, value] of Object.entries(vars)) {
    userPrompt = userPrompt.replaceAll(`{{${key}}}`, String(value));
  }

  if (template.regulatoryDisclaimer) {
    userPrompt += `\n\n---\n${template.regulatoryDisclaimer}`;
  }

  return {
    systemPrompt: template.systemPrompt,
    userPrompt,
    metadata: {
      model: template.model,
      maxTokens: template.maxTokens,
      temperature: template.temperature,
      version: template.version,
      regulatoryDisclaimer: template.regulatoryDisclaimer,
    },
  };
}

/**
 * List all available prompt templates (for admin UI).
 */
export function listPrompts(): Omit<PromptTemplate, 'systemPrompt' | 'userPromptTemplate'>[] {
  return Object.values(PROMPTS).map(({ systemPrompt: _s, userPromptTemplate: _u, ...rest }) => rest);
}
