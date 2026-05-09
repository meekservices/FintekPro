import { Injectable, Logger } from '@nestjs/common';
import { CashService } from '../cash/cash.service';
import { AIService } from '../../server/services/ai-service'; // Assuming existing AI service

@Injectable()
export class TreasuryCopilotService {
  private readonly logger = new Logger(TreasuryCopilotService.name);

  constructor(
    private readonly cashService: CashService,
    private readonly aiService: AIService
  ) {}

  async handleQuery(entityId: string, query: string) {
    // 1. Get real-time treasury context
    const position = await this.cashService.getConsolidatedPosition(entityId);
    
    // 2. Build context for LLM
    const context = `
      Current Treasury Position:
      ${JSON.stringify(position, null, 2)}
      
      User Query: "${query}"
    `;

    // 3. Call AI Service (RAG / Tool calling)
    const prompt = `
      You are the FintekPro Treasury Copilot. 
      Analyze the treasury position and answer the user query with professional, actionable insights.
      
      ${context}
      
      Focus on:
      - Liquidity optimization
      - Risk alerts
      - Working capital efficiency
    `;

    const response = await this.aiService.generateResponse(prompt);
    
    return {
      answer: response,
      timestamp: new Date(),
      dataPoints: position
    };
  }
}
