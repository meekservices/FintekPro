import { aiService } from "./services/ai-service";

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  high?: number;
  low?: number;
  open?: number;
}

export interface MarketStory {
  id: string;
  title: string;
  content: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  keyPoints: string[];
  marketData: MarketData[];
  generatedAt: Date;
}

export class MarketStoryService {
  async generateStory(marketData: MarketData[]): Promise<MarketStory> {
    try {
      const prompt = this.buildStoryPrompt(marketData);
      
      const systemPrompt = `You are an expert financial analyst and storyteller. Create compelling, insightful narratives about market movements. 
            
Your response must be valid JSON with this exact structure:
{
  "title": "engaging headline about the market trend",
  "content": "detailed narrative story (HTML formatted with <p>, <h3>, <ul>, <li> tags)",
  "summary": "brief 2-3 sentence summary",
  "sentiment": "bullish/bearish/neutral",
  "confidence": 0.85,
  "keyPoints": ["point 1", "point 2", "point 3"]
}

Guidelines:
- Write engaging, professional financial journalism
- Use storytelling techniques to make data compelling
- Include specific numbers and percentages
- Explain what the movements mean for investors
- Be objective but engaging
- Format content with proper HTML tags for readability

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.`;

      const response = await aiService.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ], {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxTokens: 1500
      });

      const aiResponse = JSON.parse(response.content || '{}');
      
      const story: MarketStory = {
        id: `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: aiResponse.title || 'Market Analysis',
        content: aiResponse.content || 'Market analysis content not available.',
        summary: aiResponse.summary || 'Brief market summary.',
        sentiment: this.validateSentiment(aiResponse.sentiment),
        confidence: Math.max(0, Math.min(1, aiResponse.confidence || 0.5)),
        keyPoints: Array.isArray(aiResponse.keyPoints) ? aiResponse.keyPoints.slice(0, 5) : [],
        marketData,
        generatedAt: new Date()
      };

      return story;
    } catch (error) {
      console.error('Error generating market story:', error);
      
      // Fallback story if AI fails
      return this.generateFallbackStory(marketData);
    }
  }

  private buildStoryPrompt(marketData: MarketData[]): string {
    const dataDescription = marketData.map(data => {
      const changeDirection = data.change >= 0 ? 'up' : 'down';
      const absChange = Math.abs(data.changePercent);
      
      return `${data.symbol}: $${data.price.toFixed(2)} (${changeDirection} ${absChange.toFixed(2)}%)${
        data.volume ? `, Volume: ${data.volume.toLocaleString()}` : ''
      }${
        data.marketCap ? `, Market Cap: $${(data.marketCap / 1e9).toFixed(1)}B` : ''
      }`;
    }).join('\n');

    return `Analyze these current market movements and create an engaging financial story:

${dataDescription}

Create a compelling narrative that:
1. Explains what's driving these market movements
2. Provides context for the price changes
3. Discusses potential implications for investors
4. Uses storytelling techniques to make the data engaging
5. Maintains professional financial journalism standards

Focus on trends, patterns, and what these movements signal about market sentiment and future direction.`;
  }

  private validateSentiment(sentiment: any): 'bullish' | 'bearish' | 'neutral' {
    const validSentiments = ['bullish', 'bearish', 'neutral'];
    return validSentiments.includes(sentiment) ? sentiment : 'neutral';
  }

  private generateFallbackStory(marketData: MarketData[]): MarketStory {
    const totalChange = marketData.reduce((sum, data) => sum + data.changePercent, 0);
    const avgChange = totalChange / marketData.length;
    
    const sentiment: 'bullish' | 'bearish' | 'neutral' = 
      avgChange > 1 ? 'bullish' : avgChange < -1 ? 'bearish' : 'neutral';

    const title = avgChange > 0 
      ? 'Markets Show Positive Momentum'
      : avgChange < 0 
      ? 'Markets Face Downward Pressure'
      : 'Markets Trade in Mixed Territory';

    const content = `<p>Market analysis shows ${sentiment === 'bullish' ? 'positive' : sentiment === 'bearish' ? 'negative' : 'mixed'} sentiment across major indices.</p>
      <h3>Key Movements</h3>
      <ul>
        ${marketData.slice(0, 3).map(data => 
          `<li><strong>${data.symbol}:</strong> $${data.price.toFixed(2)} (${data.change >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)</li>`
        ).join('')}
      </ul>
      <p>Investors should monitor these trends as market conditions continue to evolve.</p>`;

    return {
      id: `fallback-${Date.now()}`,
      title,
      content,
      summary: `Markets are showing ${sentiment} trends with an average change of ${avgChange.toFixed(2)}%.`,
      sentiment,
      confidence: 0.6,
      keyPoints: [
        'Market sentiment reflects current economic conditions',
        'Price movements indicate investor confidence levels',
        'Continued monitoring recommended for trend confirmation'
      ],
      marketData,
      generatedAt: new Date()
    };
  }

  async analyzeSentiment(text: string): Promise<{ sentiment: string; confidence: number }> {
    try {
      const systemPrompt = `Analyze the sentiment of financial text. Respond with JSON: { "sentiment": "bullish/bearish/neutral", "confidence": 0.85 }

IMPORTANT: Return ONLY valid JSON, no markdown code blocks or extra text.`;

      const response = await aiService.chat([
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ], {
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.3
      });

      const result = JSON.parse(response.content || '{}');
      return {
        sentiment: this.validateSentiment(result.sentiment),
        confidence: Math.max(0, Math.min(1, result.confidence || 0.5))
      };
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return { sentiment: 'neutral', confidence: 0.5 };
    }
  }
}

export const marketStoryService = new MarketStoryService();