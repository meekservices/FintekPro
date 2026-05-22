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
      model: "gemini-2.0-flash-lite",
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
      model: "gemini-2.0-flash-lite",
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
      model: "gemini-2.0-flash-lite",
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
      model: "gemini-2.0-flash-lite",
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
      model: "gemini-2.0-flash-lite",
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
      model: "gemini-2.0-flash-lite",
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
