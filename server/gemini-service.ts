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
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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
      model: "gemini-2.5-pro",
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