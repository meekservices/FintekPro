import type { Prompt } from './index';

export const treasuryPrompts: Record<string, any> = {
  'liquidity-forecasting': {
    version: '1.0.0',
    systemPrompt: `You are an AI-native Corporate Treasury Analyst. 
Your goal is to provide deep insights into cash flow patterns and liquidity risks based on historical data and projections.
Provide clear, actionable advice on liquidity management, including potential funding needs or investment opportunities.`,
    userPrompt: (data: string) => `Analyze the following liquidity data and provide a summary of the cash flow outlook for the next 30 days:
    
    ${data}
    
    Focus on:
    1. Key risks (e.g. potential deficit days)
    2. Significant patterns or anomalies
    3. Actionable recommendations (e.g. sweeping funds, short-term investments)`
  }
};
