import { GoogleGenAI } from "@google/genai";

// Initialize Gemini AI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeSystemErrors(errorData: string): Promise<any> {
  const prompt = `You are a senior software engineer and system architect. Analyze the following system errors and provide actionable technical recommendations.

Focus on:
1. Root cause analysis of each error type
2. Priority classification (Critical/High/Medium/Low)
3. Specific technical solutions and code fixes
4. Prevention strategies to avoid future occurrences
5. Performance impact assessment

System Error Data:
${errorData}

Provide a structured JSON response with:
- summary: Brief overview of findings
- recommendations: Array of specific actionable items
- priority: Overall priority level
- category: Main problem category
- detailedAnalysis: Deeper technical insights`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            recommendations: { 
              type: "array",
              items: { type: "string" }
            },
            priority: { type: "string" },
            category: { type: "string" },
            detailedAnalysis: {
              type: "object",
              properties: {
                errorPatterns: { type: "array", items: { type: "string" } },
                rootCauses: { type: "array", items: { type: "string" } },
                technicalSolutions: { type: "array", items: { type: "string" } },
                preventionStrategies: { type: "array", items: { type: "string" } }
              }
            }
          },
          required: ["summary", "recommendations", "priority", "category"]
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

export async function analyzeApiPerformance(performanceData: string): Promise<any> {
  const prompt = `You are a performance optimization expert. Analyze the following API performance data and provide optimization recommendations.

Focus on:
1. Response time bottlenecks and solutions
2. Reliability issues and fixes
3. Scalability concerns and improvements
4. Infrastructure optimization recommendations
5. Monitoring and alerting suggestions

API Performance Data:
${performanceData}

Provide a structured JSON response with optimization strategies.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            recommendations: { 
              type: "array",
              items: { type: "string" }
            },
            priority: { type: "string" },
            category: { type: "string" },
            performanceMetrics: {
              type: "object",
              properties: {
                bottlenecks: { type: "array", items: { type: "string" } },
                optimizations: { type: "array", items: { type: "string" } },
                infrastructureNeeds: { type: "array", items: { type: "string" } }
              }
            }
          },
          required: ["summary", "recommendations", "priority", "category"]
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

export async function generateReplitAgentInstructions(currentErrors: string, appState: string): Promise<any> {
  const prompt = `You are an expert software architect working with Replit Agent to create perfect applications.

Generate comprehensive development instructions for Replit Agent to fix all errors and optimize the FintekPro financial services platform.

Current Application State:
${appState}

Current Errors and Issues:
${currentErrors}

Generate specific, actionable instructions that Replit Agent can execute to:
1. Fix all TypeScript/JavaScript errors
2. Optimize API performance and reliability 
3. Ensure 100% live data integration
4. Implement proper error handling
5. Add comprehensive monitoring and logging
6. Optimize database queries and caching
7. Enhance security and authentication
8. Improve user experience and performance

Provide detailed step-by-step instructions in JSON format.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            priority: { type: "string" },
            totalTasks: { type: "number" },
            estimatedTime: { type: "string" },
            instructions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  taskId: { type: "number" },
                  category: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  priority: { type: "string" },
                  estimatedTime: { type: "string" },
                  dependencies: { type: "array", items: { type: "number" } },
                  commands: { type: "array", items: { type: "string" } },
                  files: { type: "array", items: { type: "string" } },
                  expectedOutcome: { type: "string" },
                  verification: { type: "string" }
                }
              }
            },
            monitoring: {
              type: "object", 
              properties: {
                healthChecks: { type: "array", items: { type: "string" } },
                performanceMetrics: { type: "array", items: { type: "string" } },
                errorTracking: { type: "array", items: { type: "string" } }
              }
            }
          },
          required: ["summary", "priority", "instructions"]
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

export async function analyzeCodeErrors(codeErrors: string, filePath: string): Promise<any> {
  const prompt = `You are a senior TypeScript/JavaScript developer. Analyze the following code errors and provide specific fixes.

File: ${filePath}
Errors:
${codeErrors}

For each error, provide:
1. Root cause explanation
2. Exact code fix with proper TypeScript types
3. Prevention strategy
4. Performance impact if any

Focus on creating production-ready, type-safe code with proper error handling.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            totalErrors: { type: "number" },
            severity: { type: "string" },
            fixes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  errorLine: { type: "number" },
                  errorType: { type: "string" },
                  description: { type: "string" },
                  rootCause: { type: "string" },
                  fix: { type: "string" },
                  codeExample: { type: "string" },
                  prevention: { type: "string" }
                }
              }
            },
            overallRecommendations: { type: "array", items: { type: "string" } }
          },
          required: ["summary", "totalErrors", "fixes"]
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}

export async function analyzeSecurityVulnerabilities(securityData: string): Promise<any> {
  const prompt = `You are a cybersecurity expert. Analyze the following system data for security vulnerabilities and compliance issues.

Focus on:
1. Authentication and authorization weaknesses
2. Data protection and privacy gaps
3. API security vulnerabilities
4. Access control improvements
5. Compliance recommendations (GDPR, SOC2, etc.)

Security Data:
${securityData}

Provide a structured JSON response with security recommendations.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            recommendations: { 
              type: "array",
              items: { type: "string" }
            },
            priority: { type: "string" },
            category: { type: "string" },
            securityAssessment: {
              type: "object",
              properties: {
                vulnerabilities: { type: "array", items: { type: "string" } },
                mitigations: { type: "array", items: { type: "string" } },
                complianceGaps: { type: "array", items: { type: "string" } }
              }
            }
          },
          required: ["summary", "recommendations", "priority", "category"]
        }
      },
      contents: prompt,
    });

    const rawJson = response.text;
    if (rawJson) {
      return JSON.parse(rawJson);
    } else {
      throw new Error("Empty response from Gemini API");
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw error;
  }
}
export async function generateChatResponse(
  systemPrompt: string,
  conversationHistory: Array<{role: 'user' | 'assistant' | 'system'; content: string}>,
  functionSchemas?: any[]
): Promise<{ text?: string; functionCall?: { name: string; args: any } }> {
  try {
    // Build messages for Gemini
    const messages = [
      { role: 'user' as const, content: systemPrompt },
      ...conversationHistory.map(m => ({
        role: m.role === 'system' ? 'user' as const : m.role as 'user' | 'assistant',
        content: m.content
      }))
    ];

    const lastUserMessage = messages[messages.length - 1].content;

    const config: any = {
      temperature: 0.7,
      maxOutputTokens: 2048,
    };

    // Add function declarations if provided
    if (functionSchemas && functionSchemas.length > 0) {
      config.tools = [{
        functionDeclarations: functionSchemas
      }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config,
      contents: lastUserMessage,
    });

    // Check for function calls in response
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const firstCall = functionCalls[0];
      if (firstCall.name) {
        return {
          functionCall: {
            name: firstCall.name,
            args: firstCall.args || {}
          }
        };
      }
    }

    // Return text response
    return {
      text: response.text || 'I apologize, but I couldn\'t generate a response. Please try again.'
    };
  } catch (error) {
    console.error("Gemini chat error:", error);
    throw error;
  }
}

export async function generateFinancialChatResponse(
  userMessage: string,
  conversationHistory: Array<{role: 'user' | 'assistant'; content: string}>,
  context?: { userId?: string; portfolioId?: string }
): Promise<{ text?: string; functionCall?: { name: string; args: any } }> {
  const systemPrompt = `You are an expert AI financial advisor for FintekPro, a comprehensive Indian investment platform. 

Your expertise includes:
- Portfolio analysis and optimization
- Investment recommendations across equities, mutual funds, bonds, IPOs, and alternative investments
- Market insights and trends
- Financial planning and goal setting
- Tax planning strategies
- Risk assessment and management
- Retirement planning
- KYC and regulatory compliance guidance

Guidelines:
1. Provide accurate, actionable financial advice
2. Be conversational but professional
3. Explain complex concepts in simple terms
4. Always consider Indian market context and regulations (SEBI, RBI, PMLA)
5. Suggest specific actions when appropriate
6. Ask clarifying questions when needed
7. Warn about risks and compliance requirements
8. Never guarantee returns or market predictions
9. Encourage diversification and long-term thinking

Current context: ${context?.portfolioId ? `User has portfolio ID: ${context.portfolioId}` : 'General financial consultation'}

Respond to the user's query helpfully and professionally.`;

  return generateChatResponse(systemPrompt, conversationHistory);
}

// ─────────────────────────────────────────────────────────────────────────────
// FASP-AI v1.0 — Structured Copilot Inference (absorbed from geminiService.ts)
// ─────────────────────────────────────────────────────────────────────────────

const COPILOT_MODEL_VERSION = 'gemini-2.0-flash';
const MAX_RETRIES = 3;

/** FASP-AI v1.0 — mandatory metadata on every AI output */
export interface FaspAiMeta {
  confidence_score: number;      // 0-1
  model_version: string;
  calculation_timestamp: string;
  engine_version: string;
}

export interface GeminiResponse<T = Record<string, unknown>> {
  data: T;
  meta: FaspAiMeta;
  success: boolean;
}

export class CopilotAIError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly errorCode: string = 'AI_INFERENCE_ERROR',
  ) {
    super(message);
    this.name = 'CopilotAIError';
  }
}

/** Exponential backoff: 200ms → 400ms → 800ms */
async function copilotSleep(attempt: number): Promise<void> {
  return new Promise(r => setTimeout(r, 200 * Math.pow(2, attempt)));
}

function estimateConfidence(text: string): number {
  const len = text.length;
  if (len > 2000) return 0.88;
  if (len > 800)  return 0.78;
  if (len > 200)  return 0.65;
  return 0.50;
}

/**
 * Single AI inference entry-point for all admin copilot agents.
 * Implements retry logic (max 3, exponential backoff) and FASP-AI v1.0 compliance.
 *
 * @purpose  Structured JSON generation for copilot agents
 * @inputs   systemPrompt, userPrompt, options (parseJson, temperature, maxOutputTokens)
 * @outputs  GeminiResponse<T> with FaspAiMeta appended
 * @edge     Network failures → retry 3x; model errors → throw CopilotAIError
 */
export async function callGemini<T = Record<string, unknown>>(
  systemPrompt: string,
  userPrompt: string,
  options: {
    parseJson?: boolean;
    temperature?: number;
    maxOutputTokens?: number;
  } = {},
): Promise<GeminiResponse<T>> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new CopilotAIError(
      'GEMINI_API_KEY not configured — set env var GEMINI_API_KEY or GOOGLE_AI_API_KEY',
      false,
      'MISSING_API_KEY',
    );
  }

  const copilotAi = new GoogleGenAI({ apiKey });
  const { parseJson = true, temperature = 0.3, maxOutputTokens = 4096 } = options;
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await copilotAi.models.generateContent({
        model: COPILOT_MODEL_VERSION,
        contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
        config: {
          temperature,
          maxOutputTokens,
          ...(parseJson ? { responseMimeType: 'application/json' } : {}),
        },
      });

      const rawText = response.text ?? '';
      let parsed: T;

      if (parseJson) {
        try {
          const clean = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          parsed = JSON.parse(clean) as T;
        } catch {
          throw new CopilotAIError(
            `Gemini returned invalid JSON: ${rawText.slice(0, 200)}`,
            true,
            'INVALID_JSON_RESPONSE',
          );
        }
      } else {
        parsed = rawText as unknown as T;
      }

      const meta: FaspAiMeta = {
        confidence_score: estimateConfidence(rawText),
        model_version: COPILOT_MODEL_VERSION,
        calculation_timestamp: new Date().toISOString(),
        engine_version: 'admin-copilot-v1.0',
      };

      return { data: parsed, meta, success: true };

    } catch (err: unknown) {
      lastError = err as Error;
      const errObj = err as { retryable?: boolean; status?: number; code?: string };
      const isRetryable = err instanceof CopilotAIError
        ? err.retryable
        : (errObj.status === 429 || errObj.status === 503 || errObj.code === 'ECONNRESET');

      if (!isRetryable || attempt === MAX_RETRIES - 1) break;

      console.warn(
        `[CopilotAI] Attempt ${attempt + 1} failed — retrying in ${200 * Math.pow(2, attempt)}ms`,
        lastError.message,
      );
      await copilotSleep(attempt);
    }
  }

  throw new CopilotAIError(
    lastError?.message ?? 'Unknown AI inference error',
    false,
    'MAX_RETRIES_EXCEEDED',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Market / Portfolio intelligence (absorbed from gemini.ts)
// ─────────────────────────────────────────────────────────────────────────────

import { aiService, AICapability } from './services/ai-service';

/**
 * Generate a market insight summary from raw market data.
 *
 * @purpose  Produce a conversational market commentary for retail investors
 * @inputs   marketData — any JSON-serialisable market data object
 * @outputs  Plain-text summary string (≤200 words)
 * @edge     Falls back to a static message if AI is unavailable
 */
export async function generateMarketInsight(marketData: unknown): Promise<string> {
  const prompt = `Based on the following market data, provide a concise market insight and analysis:\n\n${JSON.stringify(marketData, null, 2)}\n\nPlease provide:\n1. Key market trends\n2. Notable price movements\n3. Investment implications\n4. Risk factors to consider\n\nKeep the response conversational and under 200 words.`;

  return (
    (await aiService.generateResponse(prompt, {
      capability: AICapability.STANDARD,
      promptName: 'market_insight',
      feature: 'market_analysis',
    })) ?? 'Market analysis unavailable at the moment.'
  );
}

/**
 * Analyse a portfolio and return structured recommendations.
 *
 * @purpose  SEBI-compliant portfolio analysis with AI-generated advisory
 * @inputs   portfolioData — holdings array + totalValue + gainLossPercent
 * @outputs  { analysis, recommendations, riskScore }
 * @edge     Falls back to rule-based recommendations if AI call fails
 */
export async function analyzePortfolio(portfolioData: {
  holdings?: Array<{ name?: string; weight?: number; value?: number; assetType?: string; type?: string }>;
  assets?: Array<{ name?: string; weight?: number; value?: number; assetType?: string; type?: string }>;
  totalValue?: number;
  total?: number;
  gainLossPercent?: number;
  gainLoss?: number;
}): Promise<{ analysis: string; recommendations: string[]; riskScore: number }> {
  const holdings = portfolioData.holdings ?? portfolioData.assets ?? [];
  const totalValue = portfolioData.totalValue ?? portfolioData.total ?? 0;
  const gainLossPct = portfolioData.gainLossPercent ?? portfolioData.gainLoss ?? 0;

  let equityWeight = 0, debtWeight = 0, cashWeight = 0;
  for (const h of holdings) {
    const w = h.weight ?? (totalValue > 0 ? ((h.value ?? 0) / totalValue) * 100 : 0);
    const t = (h.assetType ?? h.type ?? '').toLowerCase();
    if (t.includes('equity') || t.includes('stock') || t.includes('mf') || t.includes('mutual')) equityWeight += w;
    else if (t.includes('debt') || t.includes('bond') || t.includes('fd') || t.includes('fixed')) debtWeight += w;
    else if (t.includes('cash') || t.includes('liquid') || t.includes('wallet')) cashWeight += w;
  }

  const riskScore = Math.max(1, Math.min(10, Math.round(equityWeight / 10)));
  const riskLabel = riskScore >= 7 ? 'Aggressive' : riskScore >= 4 ? 'Moderate' : 'Conservative';
  const gainStr = gainLossPct >= 0 ? `+${gainLossPct.toFixed(2)}%` : `${gainLossPct.toFixed(2)}%`;
  const holdingCount = holdings.length;
  const localAnalysis = `Portfolio contains ${holdingCount} holding${holdingCount !== 1 ? 's' : ''} with ${equityWeight.toFixed(0)}% equity, ${debtWeight.toFixed(0)}% debt, and ${cashWeight.toFixed(0)}% liquid exposure. Current returns are ${gainStr}. Risk profile: ${riskLabel} (${riskScore}/10).`;

  try {
    const prompt = `Act as a senior SEBI-registered Investment Adviser. Analyze the following portfolio (Indian market context).\n\nPortfolio:\n- Total Value: ₹${totalValue.toLocaleString('en-IN')}\n- Returns: ${gainStr}\n- Asset Mix: ${equityWeight.toFixed(1)}% Equity, ${debtWeight.toFixed(1)}% Debt, ${cashWeight.toFixed(1)}% Cash\n- Top Holdings: ${holdings.slice(0, 5).map(h => `${h.name} (${h.weight?.toFixed(1)}%)`).join(', ')}\n\nReturn JSON: { "analysis": "string", "recommendations": ["string"], "riskScore": number }`;

    const response = await aiService.chat(
      [
        { role: 'system', content: 'You are a senior portfolio strategist specialising in technical analysis and regulatory compliance.' },
        { role: 'user', content: prompt },
      ],
      { capability: AICapability.SUPERIOR, json: true, promptName: 'portfolio_analysis', feature: 'portfolio_management' },
    );

    const result = JSON.parse(response.content) as { analysis?: string; recommendations?: string[]; riskScore?: number };
    return {
      analysis: result.analysis ?? localAnalysis,
      recommendations: result.recommendations ?? [],
      riskScore: result.riskScore ?? riskScore,
    };
  } catch (error) {
    console.error('[GeminiService] Portfolio analysis AI call failed — falling back to local calculation:', error);
    const recommendations: string[] = [];
    if (equityWeight > 80) recommendations.push('Equity > 80% — rebalance into debt/liquid instruments.');
    if (equityWeight < 20 && equityWeight > 0) recommendations.push('Conservative equity — consider index fund SIPs for long-term growth.');
    if (debtWeight < 15) recommendations.push('Low debt — add quality debt/liquid funds as portfolio cushion.');
    if (gainLossPct < -15) recommendations.push('Significant drawdown — review fundamental quality of core holdings.');
    if (holdingCount < 5 && holdingCount > 0) recommendations.push('Concentrated portfolio — diversify across sectors and asset classes.');
    if (cashWeight > 30) recommendations.push('High cash — stagger deployment into equity or debt based on valuations.');
    while (recommendations.length < 3) {
      recommendations.push('Maintain strategic allocation; review performance quarterly.');
    }
    return { analysis: localAnalysis + ' [Fallback]', recommendations: recommendations.slice(0, 5), riskScore };
  }
}

/**
 * Generate a compelling investment story narrative for a stock.
 *
 * @purpose  Engaging data-driven narrative for retail investors
 * @inputs   stockSymbol, priceData
 * @outputs  Plain-text narrative string (≤150 words)
 * @edge     Returns a static fallback if AI call fails
 */
export async function generateInvestmentStory(stockSymbol: string, priceData: unknown): Promise<string> {
  const prompt = `Create an engaging investment story for ${stockSymbol}.\n\nContext:\n${JSON.stringify(priceData, null, 2)}\n\nGuidelines: data-driven narrative, professional yet engaging, under 150 words.`;
  return (
    (await aiService.generateResponse(prompt, {
      capability: AICapability.STANDARD,
      promptName: 'investment_story',
    })) ?? `${stockSymbol} is showing interesting market movement. Check back later for detailed analysis.`
  );
}

/**
 * Explain a financial concept in plain English for retail investors.
 *
 * @purpose  Financial literacy — jargon-free concept explainer
 * @inputs   concept — the financial term/concept to explain
 * @outputs  Plain-text explanation (≤200 words)
 * @edge     Returns a static fallback if AI call fails
 */
export async function explainFinancialConcept(concept: string): Promise<string> {
  const prompt = `Explain "${concept}" for a retail investor:\n1. Core Definition\n2. Investor Value\n3. Practical Example\n4. Pro Tip\n\nTone: educational, jargon-free, under 200 words.`;
  return (
    (await aiService.generateResponse(prompt, {
      capability: AICapability.STANDARD,
      promptName: 'concept_explainer',
    })) ?? 'Financial concept explanation unavailable at the moment.'
  );
}
