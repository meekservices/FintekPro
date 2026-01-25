import { GoogleGenAI } from "@google/genai";

// the newest Gemini model is "gemini-2.5-flash" which was released August 7, 2025. do not change this unless explicitly requested by the user
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateMarketInsight(marketData: any): Promise<string> {
  const prompt = `Based on the following market data, provide a concise market insight and analysis:
  
${JSON.stringify(marketData, null, 2)}

Please provide:
1. Key market trends
2. Notable price movements
3. Investment implications
4. Risk factors to consider

Keep the response conversational and under 200 words.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "Market analysis unavailable at the moment.";
}

export async function analyzePortfolio(portfolioData: any): Promise<{
  analysis: string;
  recommendations: string[];
  riskScore: number;
}> {
  try {
    const systemPrompt = `You are a financial advisor AI. Analyze the portfolio data and provide:
    1. Overall portfolio analysis
    2. 3-5 specific recommendations
    3. Risk score from 1-10 (1=very low risk, 10=very high risk)
    
    Respond with JSON in this format:
    {
      "analysis": "detailed analysis text",
      "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
      "riskScore": number
    }`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            analysis: { type: "string" },
            recommendations: { 
              type: "array",
              items: { type: "string" }
            },
            riskScore: { type: "number" }
          },
          required: ["analysis", "recommendations", "riskScore"]
        }
      },
      contents: JSON.stringify(portfolioData),
    });

    const result = JSON.parse(response.text || "{}");
    return {
      analysis: result.analysis || "Portfolio analysis unavailable",
      recommendations: result.recommendations || [],
      riskScore: Math.max(1, Math.min(10, result.riskScore || 5))
    };
  } catch (error) {
    return {
      analysis: "Unable to analyze portfolio at the moment.",
      recommendations: ["Consider diversifying your holdings", "Review your risk tolerance"],
      riskScore: 5
    };
  }
}

export async function generateInvestmentStory(stockSymbol: string, priceData: any): Promise<string> {
  const prompt = `Create an engaging, story-like explanation of what's happening with ${stockSymbol} stock based on this price data:

${JSON.stringify(priceData, null, 2)}

Write it like you're explaining to a friend what's been happening with this stock. Include:
- What the numbers tell us
- Why it might be moving this way
- What investors should know

Keep it under 150 words and make it interesting to read.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || `${stockSymbol} is showing interesting market movement. Check back later for detailed analysis.`;
}

export async function explainFinancialConcept(concept: string): Promise<string> {
  const prompt = `Explain the financial concept "${concept}" in simple, everyday language that a beginner investor can understand. 

Include:
1. What it means
2. Why it matters for investing
3. A simple example
4. When someone might use it

Keep it under 200 words and avoid jargon.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text || "Financial concept explanation unavailable at the moment.";
}