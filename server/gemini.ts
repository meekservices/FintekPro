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

export function analyzePortfolio(portfolioData: any): Promise<{
  analysis: string;
  recommendations: string[];
  riskScore: number;
}> {
  // Computed locally — no external API call needed. Python sidecar handles
  // deep portfolio analytics; this function provides a lightweight synchronous summary.
  const holdings: any[] = portfolioData.holdings || portfolioData.assets || [];
  const totalValue: number = portfolioData.totalValue || portfolioData.total || 0;
  const gainLossPct: number = portfolioData.gainLossPercent || portfolioData.gainLoss || 0;

  let equityWeight = 0;
  let debtWeight = 0;
  for (const h of holdings) {
    const w = h.weight ?? (totalValue > 0 ? (h.value / totalValue) * 100 : 0);
    const t = (h.assetType || h.type || '').toLowerCase();
    if (t.includes('equity') || t.includes('stock') || t.includes('mf') || t.includes('mutual')) equityWeight += w;
    if (t.includes('debt') || t.includes('bond') || t.includes('fd') || t.includes('fixed')) debtWeight += w;
  }

  const riskScore = Math.max(1, Math.min(10, Math.round(equityWeight / 10)));
  const riskLabel = riskScore >= 7 ? 'aggressive' : riskScore >= 4 ? 'moderate' : 'conservative';
  const gainStr = gainLossPct >= 0 ? `+${gainLossPct.toFixed(2)}%` : `${gainLossPct.toFixed(2)}%`;
  const holdingCount = holdings.length;

  const analysis = `Portfolio contains ${holdingCount} holding${holdingCount !== 1 ? 's' : ''} with ${equityWeight.toFixed(0)}% equity and ${debtWeight.toFixed(0)}% debt exposure. Current return: ${gainStr}. Risk score ${riskScore}/10 — ${riskLabel} profile.`;

  const recommendations: string[] = [];
  if (equityWeight > 80) recommendations.push('Equity concentration is high — consider adding debt instruments to reduce drawdown risk');
  if (equityWeight < 20 && equityWeight >= 0) recommendations.push('Low equity exposure — consider adding index funds for long-term growth');
  if (debtWeight < 15) recommendations.push('Add liquid debt funds (overnight or liquid category) for emergency liquidity buffer');
  if (gainLossPct < -10) recommendations.push('Portfolio is in significant drawdown — review individual holdings for stop-loss opportunities');
  if (holdingCount < 4) recommendations.push('Portfolio is concentrated — diversify across more instruments and asset classes');
  if (recommendations.length < 2) {
    recommendations.push('Maintain current asset allocation aligned with your risk profile');
    recommendations.push('Review portfolio quarterly and rebalance if any asset class drifts beyond ±5% of target');
  }

  return Promise.resolve({ analysis, recommendations, riskScore });
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