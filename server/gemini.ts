import { aiService, AICapability } from "./services/ai-service";

export async function generateMarketInsight(marketData: any): Promise<string> {
  const prompt = `Based on the following market data, provide a concise market insight and analysis:
  
${JSON.stringify(marketData, null, 2)}

Please provide:
1. Key market trends
2. Notable price movements
3. Investment implications
4. Risk factors to consider

Keep the response conversational and under 200 words.`;

  return await aiService.generateResponse(prompt, {
    capability: AICapability.STANDARD,
    promptName: 'market_insight',
    feature: 'market_analysis'
  }) || "Market analysis unavailable at the moment.";
}

export async function analyzePortfolio(portfolioData: any): Promise<{
  analysis: string;
  recommendations: string[];
  riskScore: number;
}> {
  // First, do the local lightweight calculation as a fallback and to provide context to the AI
  const holdings: any[] = portfolioData.holdings || portfolioData.assets || [];
  const totalValue: number = portfolioData.totalValue || portfolioData.total || 0;
  const gainLossPct: number = portfolioData.gainLossPercent || portfolioData.gainLoss || 0;

  let equityWeight = 0;
  let debtWeight = 0;
  let cashWeight = 0;
  
  for (const h of holdings) {
    const w = h.weight ?? (totalValue > 0 ? (h.value / totalValue) * 100 : 0);
    const t = (h.assetType || h.type || '').toLowerCase();
    
    if (t.includes('equity') || t.includes('stock') || t.includes('mf') || t.includes('mutual')) {
      equityWeight += w;
    } else if (t.includes('debt') || t.includes('bond') || t.includes('fd') || t.includes('fixed')) {
      debtWeight += w;
    } else if (t.includes('cash') || t.includes('liquid') || t.includes('wallet')) {
      cashWeight += w;
    }
  }

  // Calculate a baseline risk score (1-10) based on equity exposure
  const riskScore = Math.max(1, Math.min(10, Math.round(equityWeight / 10)));
  const riskLabel = riskScore >= 7 ? 'Aggressive' : riskScore >= 4 ? 'Moderate' : 'Conservative';
  const gainStr = gainLossPct >= 0 ? `+${gainLossPct.toFixed(2)}%` : `${gainLossPct.toFixed(2)}%`;
  const holdingCount = holdings.length;

  const localAnalysis = `Portfolio contains ${holdingCount} holding${holdingCount !== 1 ? 's' : ''} with ${equityWeight.toFixed(0)}% equity, ${debtWeight.toFixed(0)}% debt, and ${cashWeight.toFixed(0)}% liquid exposure. Current returns are ${gainStr}. The risk profile is classified as ${riskLabel} (${riskScore}/10).`;

  try {
    const prompt = `Act as a senior SEBI-registered Investment Adviser. Analyze the following investment portfolio within the context of the Indian market (RBI/SEBI regulatory framework).

Portfolio Overview:
- Total Value: ₹${totalValue.toLocaleString('en-IN')}
- Current Returns: ${gainStr}
- Asset Mix: ${equityWeight.toFixed(1)}% Equity, ${debtWeight.toFixed(1)}% Debt, ${cashWeight.toFixed(1)}% Cash/Liquid
- Primary Holdings: ${holdings.slice(0, 5).map(h => `${h.name} (${h.weight?.toFixed(1)}%)`).join(', ')}

Analysis Requirements:
1. Asset Allocation: Evaluate if the current split aligns with a ${riskLabel} risk profile.
2. Risk Concentration: Identify any over-exposure to specific sectors, market caps (Large/Mid/Small), or individual stocks.
3. Market Resilience: How is this portfolio positioned for current interest rate cycles and market volatility?
4. Tactical Advice: Provide 3-5 professional, actionable steps (e.g., rebalancing, SIP adjustments, or diversification).

STRICT OUTPUT FORMAT (JSON):
{
  "analysis": "A professional 2-3 paragraph summary using technical financial terminology (e.g., alpha, beta, drawdown, CAGR).",
  "recommendations": ["Actionable step 1", "Actionable step 2", "Actionable step 3"],
  "riskScore": ${riskScore},
  "marketSentiment": "Neutral/Bullish/Bearish"
}

Important: Ensure the tone is objective, professional, and compliant with standard investment advisory disclosures.`;

    const response = await aiService.chat([
      { role: 'system', content: 'You are a senior portfolio strategist specializing in technical analysis and regulatory compliance.' },
      { role: 'user', content: prompt }
    ], {
      capability: AICapability.SUPERIOR,
      json: true,
      promptName: 'portfolio_analysis',
      feature: 'portfolio_management'
    });

    const result = JSON.parse(response.content);
    return {
      analysis: result.analysis || localAnalysis,
      recommendations: result.recommendations || [],
      riskScore: result.riskScore || riskScore
    };
  } catch (error) {
    console.error('[Gemini] Portfolio analysis AI call failed, falling back to local calculation:', error);
    
    // Fallback professional recommendations if AI fails
    const recommendations: string[] = [];
    if (equityWeight > 80) recommendations.push('Equity exposure exceeds 80% — recommend rebalancing into debt/liquid instruments to mitigate market drawdown risks.');
    if (equityWeight < 20 && equityWeight > 0) recommendations.push('Conservative equity allocation — consider systematic investment in diversified index funds for long-term capital appreciation.');
    if (debtWeight < 15) recommendations.push('Low debt allocation — add high-quality debt instruments or liquid funds to provide a portfolio cushion.');
    if (gainLossPct < -15) recommendations.push('Significant portfolio drawdown detected — conduct a thorough review of fundamental quality across all core holdings.');
    if (holdingCount < 5 && holdingCount > 0) recommendations.push('Highly concentrated portfolio — diversify across additional sectors and asset classes to reduce unsystematic risk.');
    if (cashWeight > 30) recommendations.push('High cash levels are creating a performance drag — consider staggered deployment into equity or debt based on market valuation.');
    
    if (recommendations.length < 3) {
      recommendations.push('Maintain current strategic asset allocation; review fundamental performance quarterly.');
      recommendations.push('Implement a rebalancing trigger if any asset class deviates by more than 5% from its target weight.');
      recommendations.push('Ensure a 6-month emergency liquidity buffer is maintained outside this primary investment portfolio.');
    }

    return { 
      analysis: localAnalysis + " [Fallback Analysis Applied]", 
      recommendations: recommendations.slice(0, 5), 
      riskScore 
    };
  }
}

export async function generateInvestmentStory(stockSymbol: string, priceData: any): Promise<string> {
  const prompt = `Create an engaging, compelling investment story for ${stockSymbol} stock. 
  
Context:
${JSON.stringify(priceData, null, 2)}

Guidelines:
- Explain the narrative behind the numbers (e.g., "The Resilience of ${stockSymbol}", "A Turnaround in the Making").
- Use storytelling to explain price movements.
- Highlight what a wise investor should observe.
- Avoid generic advice; focus on the data-driven narrative.
- Tone: Professional yet engaging, like a high-end financial newsletter.

Keep it under 150 words.`;

  return await aiService.generateResponse(prompt, {
    capability: AICapability.STANDARD,
    promptName: 'investment_story'
  }) || `${stockSymbol} is showing interesting market movement. Check back later for detailed analysis.`;
}

export async function explainFinancialConcept(concept: string): Promise<string> {
  const prompt = `Explain the financial concept "${concept}" with maximum clarity for a retail investor.

Include:
1. Core Definition: What is it in plain English?
2. Investor Value: Why should I care about this?
3. Practical Example: A real-world scenario.
4. Pro Tip: A subtle insight or common pitfall related to this concept.

Tone: Educational, encouraging, and jargon-free. Under 200 words.`;

  return await aiService.generateResponse(prompt, {
    capability: AICapability.STANDARD,
    promptName: 'concept_explainer'
  }) || "Financial concept explanation unavailable at the moment.";
}
