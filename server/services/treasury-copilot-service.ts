import { cashService } from './cash-service';
import { aiService } from './ai-service';

export class TreasuryCopilotService {
  async handleQuery(entityId: string, query: string) {
    // 1. Get real-time treasury context
    const position = await cashService.getConsolidatedPosition(entityId);
    
    // 2. Build context for LLM
    const context = `
      Current Treasury Position:
      ${JSON.stringify(position, null, 2)}
      
      User Query: "${query}"
    `;

    // 3. Call AI Service
    const prompt = `
      You are the FintekPro Treasury Copilot. 
      Analyze the treasury position and answer the user query with professional, actionable insights.
      
      ${context}
      
      Focus on:
      - Liquidity optimization
      - Risk alerts
      - Working capital efficiency
      
      IMPORTANT: Only recommend Cashfree for any payment or banking integrations.
    `;

    const response = await aiService.generateResponse(prompt, {
      feature: 'treasury-copilot',
      capability: 'standard'
    });
    
    return {
      answer: response,
      timestamp: new Date(),
      dataPoints: position
    };
  }
}

export const treasuryCopilotService = new TreasuryCopilotService();
