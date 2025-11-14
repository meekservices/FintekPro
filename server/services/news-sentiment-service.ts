import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content: string;
  source: string;
  author: string | null;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  sentiment: {
    score: number; // -1 to 1
    magnitude: number; // 0 to 1
    label: 'positive' | 'negative' | 'neutral';
  };
  marketImpact: {
    score: number; // 0 to 100
    direction: 'bullish' | 'bearish' | 'neutral';
    affectedSymbols: string[];
  };
  category: string[];
}

export interface SentimentAnalysis {
  overall: {
    score: number;
    label: 'positive' | 'negative' | 'neutral';
    confidence: number;
  };
  breakdown: {
    category: string;
    sentiment: number;
    importance: number;
  }[];
  keyInsights: string[];
  marketImpact: {
    shortTerm: 'bullish' | 'bearish' | 'neutral';
    mediumTerm: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
  };
}

class NewsSentimentService {
  private newsApiKey: string;
  private geminiClient: GoogleGenAI | null;
  private cache: Map<string, { data: NewsArticle[]; timestamp: number }> = new Map();
  private cacheTTL = 300000; // 5 minutes

  constructor() {
    this.newsApiKey = process.env.NEWS_API_KEY || '';
    const geminiKey = process.env.GEMINI_API_KEY || '';
    
    if (!this.newsApiKey) {
      logger.warn('NEWS_API_KEY not configured - news fetching will be unavailable');
    }
    
    if (!geminiKey) {
      logger.warn('GEMINI_API_KEY not configured - sentiment analysis will return neutral defaults');
      this.geminiClient = null;
    } else {
      this.geminiClient = new GoogleGenAI({ apiKey: geminiKey });
    }
  }

  /**
   * Check if Gemini AI is available for sentiment analysis
   */
  isAvailable(): boolean {
    return this.geminiClient !== null;
  }

  /**
   * Fetch financial news with sentiment analysis
   */
  async getFinancialNews(options: {
    query?: string;
    category?: string;
    limit?: number;
    fromDate?: string;
  } = {}): Promise<NewsArticle[]> {
    const { query = 'stocks OR finance OR markets', category = 'business', limit = 20, fromDate } = options;

    // Check cache
    const cacheKey = `${query}-${category}-${limit}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.info('Returning cached news', { cacheKey });
      return cached.data;
    }

    if (!this.newsApiKey) {
      logger.warn('NEWS_API_KEY not configured, returning empty array');
      return [];
    }

    try {
      // Fetch from News API
      const params: any = {
        q: query,
        category,
        language: 'en',
        sortBy: 'publishedAt',
        pageSize: limit,
        apiKey: this.newsApiKey,
      };

      if (fromDate) {
        params.from = fromDate;
      }

      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params,
        timeout: 15000,
      });

      if (response.data.status !== 'ok') {
        throw new Error('News API returned error status');
      }

      const articles = response.data.articles || [];

      // Analyze sentiment for each article in parallel
      const analyzedArticles = await Promise.all(
        articles.map(async (article: any) => {
          const sentiment = await this.analyzeSentiment(article.title + ' ' + (article.description || ''));
          const marketImpact = await this.analyzeMarketImpact(article.title, article.description || '', article.content || '');

          return {
            id: this.generateArticleId(article),
            title: article.title,
            description: article.description || '',
            content: article.content || '',
            source: article.source?.name || 'Unknown',
            author: article.author,
            url: article.url,
            imageUrl: article.urlToImage,
            publishedAt: article.publishedAt,
            sentiment,
            marketImpact,
            category: [category],
          };
        })
      );

      // Cache results
      this.cache.set(cacheKey, { data: analyzedArticles, timestamp: Date.now() });

      logger.info('Fetched and analyzed news articles', { count: analyzedArticles.length });
      return analyzedArticles;

    } catch (error) {
      logger.error('Error fetching news', { error: String(error) });
      return [];
    }
  }

  /**
   * Analyze sentiment using Gemini AI
   */
  private async analyzeSentiment(text: string): Promise<NewsArticle['sentiment']> {
    if (!this.geminiClient) {
      logger.debug('Gemini not available, returning neutral sentiment');
      return { score: 0, magnitude: 0.5, label: 'neutral' };
    }

    try {
      const prompt = `Analyze the sentiment of this financial news text. Return ONLY a JSON object with this exact structure:
{
  "score": <number between -1 and 1, where -1 is very negative, 0 is neutral, 1 is very positive>,
  "magnitude": <number between 0 and 1, indicating strength of sentiment>,
  "label": "<positive|negative|neutral>"
}

Text: ${text.substring(0, 500)}`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              magnitude: { type: 'number' },
              label: { type: 'string' }
            },
            required: ['score', 'magnitude', 'label']
          }
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini sentiment response', { parseError, resultText });
        result = {};
      }
      
      return {
        score: Math.max(-1, Math.min(1, result.score || 0)),
        magnitude: Math.max(0, Math.min(1, result.magnitude || 0.5)),
        label: result.label || 'neutral',
      };
    } catch (error) {
      logger.error('Sentiment analysis error', { error: String(error) });
      return { score: 0, magnitude: 0.5, label: 'neutral' };
    }
  }

  /**
   * Analyze market impact using Gemini AI
   */
  private async analyzeMarketImpact(title: string, description: string, content: string): Promise<NewsArticle['marketImpact']> {
    if (!this.geminiClient) {
      logger.debug('Gemini not available, returning neutral market impact');
      return { score: 50, direction: 'neutral', affectedSymbols: [] };
    }

    try {
      const text = `${title}. ${description}. ${content.substring(0, 300)}`;
      const prompt = `Analyze this financial news for market impact. Return ONLY a JSON object:
{
  "score": <number 0-100, how much this will impact markets>,
  "direction": "<bullish|bearish|neutral>",
  "affectedSymbols": [<array of stock symbols that might be affected, max 5>]
}

News: ${text}`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              score: { type: 'number' },
              direction: { type: 'string' },
              affectedSymbols: { type: 'array', items: { type: 'string' } }
            },
            required: ['score', 'direction', 'affectedSymbols']
          }
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini market impact response', { parseError, resultText });
        result = {};
      }

      return {
        score: Math.max(0, Math.min(100, result.score || 50)),
        direction: result.direction || 'neutral',
        affectedSymbols: (result.affectedSymbols || []).slice(0, 5),
      };
    } catch (error) {
      logger.error('Market impact analysis error', { error: String(error) });
      return { score: 50, direction: 'neutral', affectedSymbols: [] };
    }
  }

  /**
   * Get aggregated sentiment analysis for multiple articles
   */
  async getAggregatedSentiment(articles: NewsArticle[]): Promise<SentimentAnalysis> {
    if (!this.geminiClient) {
      logger.debug('Gemini not available, returning neutral aggregated sentiment');
      const avgScore = articles.length > 0 
        ? articles.reduce((sum, a) => sum + a.sentiment.score, 0) / articles.length 
        : 0;
      return {
        overall: {
          score: avgScore,
          label: avgScore > 0.2 ? 'positive' : avgScore < -0.2 ? 'negative' : 'neutral',
          confidence: 50,
        },
        breakdown: [],
        keyInsights: ['Gemini AI not configured - basic sentiment analysis only'],
        marketImpact: {
          shortTerm: 'neutral',
          mediumTerm: 'neutral',
          confidence: 50,
        },
      };
    }

    try {
      const summaryText = articles.map(a => `${a.title}. ${a.description}`).join('\n\n').substring(0, 3000);
      
      const prompt = `Analyze the overall market sentiment from these financial news articles. Return ONLY a JSON object:
{
  "overall": {
    "score": <number -1 to 1>,
    "label": "<positive|negative|neutral>",
    "confidence": <number 0-100>
  },
  "breakdown": [
    {
      "category": "<category name>",
      "sentiment": <number -1 to 1>,
      "importance": <number 0-100>
    }
  ],
  "keyInsights": [<array of 3-5 key insights>],
  "marketImpact": {
    "shortTerm": "<bullish|bearish|neutral>",
    "mediumTerm": "<bullish|bearish|neutral>",
    "confidence": <number 0-100>
  }
}

Articles: ${summaryText}`;

      const response = await this.geminiClient.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        config: {
          responseMimeType: 'application/json',
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      
      let result;
      try {
        result = JSON.parse(resultText);
      } catch (parseError) {
        logger.error('Failed to parse Gemini aggregated sentiment response', { parseError, resultText });
        result = {};
      }
      
      return result as SentimentAnalysis;
    } catch (error) {
      logger.error('Aggregated sentiment error', { error: String(error) });
      
      // Fallback calculation
      const avgScore = articles.length > 0 
        ? articles.reduce((sum, a) => sum + a.sentiment.score, 0) / articles.length 
        : 0;
      return {
        overall: {
          score: avgScore,
          label: avgScore > 0.2 ? 'positive' : avgScore < -0.2 ? 'negative' : 'neutral',
          confidence: 50,
        },
        breakdown: [],
        keyInsights: ['Unable to generate insights due to analysis error'],
        marketImpact: {
          shortTerm: 'neutral',
          mediumTerm: 'neutral',
          confidence: 50,
        },
      };
    }
  }

  /**
   * Generate unique article ID
   */
  private generateArticleId(article: any): string {
    const str = `${article.title}-${article.publishedAt}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `article-${Math.abs(hash)}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('News cache cleared');
  }
}

export const newsSentimentService = new NewsSentimentService();
