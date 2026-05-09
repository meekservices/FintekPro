import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../server/db';
import { cashFlows, liquiditySnapshots } from '../../shared/schema/treasury';
import { eq, sql, gte } from 'drizzle-orm';

@Injectable()
export class ForecastingService {
  private readonly logger = new Logger(ForecastingService.name);

  async generateLiquidityForecast(entityId: string, days: number = 30) {
    // 1. Fetch historical cash flows for context
    const historicalFlows = await db.select().from(cashFlows)
      .where(and(
        eq(cashFlows.entityId, entityId),
        gte(cashFlows.transactionDate, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
      ));

    // 2. Simple Seasonal Analysis (Mock)
    const dailyAvgInflow = this.calculateAverage(historicalFlows.filter(f => f.type === 'inflow'));
    const dailyAvgOutflow = this.calculateAverage(historicalFlows.filter(f => f.type === 'outflow'));

    // 3. Project forward
    const projections = [];
    const latestSnapshot = await db.select().from(liquiditySnapshots)
      .where(eq(liquiditySnapshots.entityId, entityId))
      .orderBy(sql`created_at DESC`)
      .limit(1);

    let currentLiquidity = latestSnapshot.length > 0 ? parseFloat(latestSnapshot[0].totalLiquidity) : 0;

    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      
      // Add randomness or use AI service here
      const inflow = dailyAvgInflow * (1 + (Math.random() * 0.2 - 0.1));
      const outflow = dailyAvgOutflow * (1 + (Math.random() * 0.2 - 0.1));
      
      currentLiquidity += (inflow - outflow);

      projections.push({
        date: date.toISOString().split('T')[0],
        projectedLiquidity: currentLiquidity.toFixed(2),
        expectedInflow: inflow.toFixed(2),
        expectedOutflow: outflow.toFixed(2)
      });
    }

    return projections;
  }

  async generateAIAnalysis(entityId: string, projections: any[]) {
    const { aiService } = await import('../../server/services/ai-service');
    const { treasuryPrompts } = await import('../../server/ai/prompts/treasury');
    
    const dataString = JSON.stringify(projections.slice(0, 15), null, 2); // Send first 15 days for context
    const prompt = treasuryPrompts['liquidity-forecasting'].userPrompt(dataString);
    const system = treasuryPrompts['liquidity-forecasting'].systemPrompt;

    const response = await aiService.chat([
      { role: 'system', content: system },
      { role: 'user', content: prompt }
    ], {
      feature: 'treasury-forecasting',
      userId: entityId
    });

    return response.content;
  }

  private calculateAverage(flows: any[]) {

    if (flows.length === 0) return 0;
    const total = flows.reduce((sum, f) => sum + parseFloat(f.amount), 0);
    return total / 90; // Avg over 90 days
  }
}
