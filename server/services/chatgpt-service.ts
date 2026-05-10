import { aiService, AIProvider, AIModel } from './ai-service';
import type { IStorage } from '../storage';
import type { InsertChatMessage, InsertChatSession, ChatSession, ChatMessage } from '../../shared/schema';

/**
 * Safely parse JSON content - handles both string and already-parsed object cases
 * Prevents "[object Object]" is not valid JSON errors in production
 */
function safeJsonParse(content: any): any {
  if (typeof content === 'object' && content !== null) {
    // Already an object, return as-is
    return content;
  }
  if (typeof content === 'string') {
    try {
      return JSON.parse(content);
    } catch (e) {
      // If parsing fails, return a wrapper object with the raw content
      console.warn('[Chat] JSON parse failed, returning raw content wrapper');
      return { rawContent: content, parseError: true };
    }
  }
  // For undefined, null, or other types, return empty object
  console.warn('[Chat] Unexpected content type:', typeof content);
  return {};
}

interface ChatContext {
  userId: string;
  sessionId?: string;
  sessionType?: string;
  portfolioId?: string;
  contextData?: any;
}

interface StreamChatOptions {
  provider?: AIProvider;
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export class ChatGPTService {
  constructor(private storage: IStorage) {}

  /**
   * Start or resume a chat session
   */
  async startSession(context: ChatContext): Promise<ChatSession> {
    const { userId, sessionId, sessionType = 'general', portfolioId, contextData } = context;

    // Resume existing session if provided
    if (sessionId) {
      const existing = await this.storage.getChatSession(sessionId);
      if (existing && existing.userId === userId) {
        return existing;
      }
    }

    // Create new session
    const newSession: InsertChatSession = {
      userId,
      title: this.generateSessionTitle(sessionType),
      sessionType,
      portfolioId: portfolioId || undefined,
      contextData: contextData || undefined,
      isActive: true,
    };

    return await this.storage.createChatSession(newSession);
  }

  /**
   * Send a message and get AI response
   */
  async sendMessage(
    sessionId: string,
    userId: string,
    content: string,
    options: StreamChatOptions = {}
  ): Promise<{ userMessage: ChatMessage; aiMessage: ChatMessage; session: ChatSession }> {
    // Get session
    const session = await this.storage.getChatSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    // Get conversation history
    const history = await this.storage.getChatMessages(sessionId);
    
    // Create user message
    const userMessage: InsertChatMessage = {
      sessionId,
      role: 'user',
      content,
      metadata: { timestamp: new Date().toISOString() },
    };
    const savedUserMessage = await this.storage.createChatMessage(userMessage);

    // Build messages for AI
    const messages = this.buildMessagesFromHistory(history, session, options.systemPrompt);
    messages.push({ role: 'user', content });

    // Get AI response
    // the newest OpenAI model is "gpt-4o" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const { provider = 'openai', model = 'gpt-4o' } = options;
    const result = await aiService.chat(messages, { provider, model, ...options });

    // Save AI message
    const aiMessage: InsertChatMessage = {
      sessionId,
      role: 'assistant',
      content: result.content,
      model: result.usage.model,
      tokens: result.usage.totalTokens,
      metadata: {
        provider: result.usage.provider,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        requestId: result.usage.requestId,
      },
    };
    const savedAIMessage = await this.storage.createChatMessage(aiMessage);

    // Update session
    await this.storage.updateChatSession(sessionId, {
      lastMessageAt: new Date(),
      messageCount: history.length + 2,
      updatedAt: new Date(),
    });

    return {
      userMessage: savedUserMessage,
      aiMessage: savedAIMessage,
      session: await this.storage.getChatSession(sessionId) as ChatSession,
    };
  }

  /**
   * Stream a chat response
   */
  async streamMessage(
    sessionId: string,
    userId: string,
    content: string,
    onChunk: (chunk: string) => void,
    options: StreamChatOptions = {}
  ): Promise<{ userMessage: ChatMessage; aiMessage: ChatMessage; session: ChatSession }> {
    // Get session
    const session = await this.storage.getChatSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    // Get conversation history
    const history = await this.storage.getChatMessages(sessionId);
    
    // Create user message
    const userMessage: InsertChatMessage = {
      sessionId,
      role: 'user',
      content,
      metadata: { timestamp: new Date().toISOString() },
    };
    const savedUserMessage = await this.storage.createChatMessage(userMessage);

    // Build messages for AI
    const messages = this.buildMessagesFromHistory(history, session, options.systemPrompt);
    messages.push({ role: 'user', content });

    // Get AI response with streaming
    const { provider = 'openai', model = 'gpt-4o' } = options;
    const result = await aiService.streamChat(messages, onChunk, { provider, model, ...options });

    // Save AI message
    const aiMessage: InsertChatMessage = {
      sessionId,
      role: 'assistant',
      content: result.content,
      model: result.usage.model,
      tokens: result.usage.totalTokens,
      metadata: {
        provider: result.usage.provider,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        requestId: result.usage.requestId,
      },
    };
    const savedAIMessage = await this.storage.createChatMessage(aiMessage);

    // Update session
    await this.storage.updateChatSession(sessionId, {
      lastMessageAt: new Date(),
      messageCount: history.length + 2,
      updatedAt: new Date(),
    });

    return {
      userMessage: savedUserMessage,
      aiMessage: savedAIMessage,
      session: await this.storage.getChatSession(sessionId) as ChatSession,
    };
  }

  /**
   * Get portfolio analysis using AI
   */
  async analyzePortfolio(
    userId: string,
    portfolioData: any,
    analysisType: 'overview' | 'risk' | 'optimization' | 'tax' = 'overview'
  ): Promise<{ analysis: string; recommendations: string[]; riskScore?: number }> {
    const systemPrompts = {
      overview: `You are a financial advisor analyzing an investment portfolio. Provide a comprehensive analysis including:
- Overall portfolio health and diversification
- Asset allocation assessment
- Performance trends
- Key strengths and weaknesses
Respond in a clear, professional manner.`,
      
      risk: `You are a risk management expert analyzing an investment portfolio. Provide:
- Detailed risk assessment (score 1-10, where 1=very low risk, 10=very high risk)
- Volatility analysis
- Concentration risks
- Market risk factors
- Specific risk mitigation recommendations
Respond with actionable insights.`,
      
      optimization: `You are a portfolio optimization specialist. Analyze the portfolio and provide:
- Rebalancing recommendations
- Asset allocation improvements
- Tax-loss harvesting opportunities
- Cost reduction strategies
- Specific actionable steps to optimize returns
Provide concrete, implementable suggestions.`,
      
      tax: `You are a tax planning expert for investments. Provide:
- Tax efficiency analysis
- Capital gains optimization strategies
- Tax-loss harvesting opportunities
- Tax-advantaged investment suggestions
- Compliance considerations
Focus on India's tax regulations.`
    };

    const systemPrompt = systemPrompts[analysisType];
    const prompt = `Analyze this portfolio data and provide insights:

${JSON.stringify(portfolioData, null, 2)}

Respond in JSON format with the following structure:
{
  "analysis": "detailed analysis text (2-3 paragraphs)",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "riskScore": number (1-10, only for risk analysis)
}`;

    const result = await aiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
    });

    try {
      // Try to parse JSON response - use safeJsonParse to handle both string and object responses
      const parsed = safeJsonParse(result.content);
      return {
        analysis: parsed.analysis || (typeof result.content === 'string' ? result.content : JSON.stringify(result.content)),
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        riskScore: analysisType === 'risk' ? (parsed.riskScore || 5) : undefined,
      };
    } catch {
      // Fallback if not JSON
      const contentStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      return {
        analysis: contentStr,
        recommendations: [],
        riskScore: analysisType === 'risk' ? 5 : undefined,
      };
    }
  }

  /**
   * Get personalized product recommendations
   */
  async getProductRecommendations(
    userId: string,
    userProfile: any,
    productType: 'mutual_funds' | 'bonds' | 'ipos' | 'insurance' | 'loans',
    criteria?: any
  ): Promise<{ recommendations: any[]; reasoning: string }> {
    const systemPrompt = `You are a financial product recommendation expert. Analyze the user's profile and suggest suitable ${productType} based on their:
- Risk profile and investment goals
- Current portfolio composition
- Financial situation
- Investment horizon
Provide personalized, suitable recommendations with clear reasoning.`;

    const prompt = `User Profile:
${JSON.stringify(userProfile, null, 2)}

${criteria ? `Additional Criteria:\n${JSON.stringify(criteria, null, 2)}\n\n` : ''}

Recommend the top 5 ${productType} for this user. Respond in JSON format:
{
  "recommendations": [
    {
      "name": "Product Name",
      "type": "Product Type",
      "suitabilityScore": 85,
      "keyFeatures": ["feature1", "feature2"],
      "whyRecommended": "Brief explanation"
    }
  ],
  "reasoning": "Overall reasoning for these recommendations"
}`;

    const result = await aiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.6,
    });

    try {
      const parsed = safeJsonParse(result.content);
      return {
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        reasoning: parsed.reasoning || 'No specific reasoning provided',
      };
    } catch {
      const contentStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      return {
        recommendations: [],
        reasoning: contentStr,
      };
    }
  }

  /**
   * Generate financial report
   */
  async generateReport(
    reportType: 'portfolio_summary' | 'tax_report' | 'performance_review' | 'compliance',
    data: any,
    format: 'narrative' | 'structured' = 'narrative'
  ): Promise<string> {
    const systemPrompts = {
      portfolio_summary: 'You are a financial report writer. Create a comprehensive portfolio summary report with clear sections and professional language.',
      tax_report: 'You are a tax reporting expert. Generate a detailed tax report covering capital gains, dividends, and tax-saving recommendations for India.',
      performance_review: 'You are an investment performance analyst. Create a detailed performance review with metrics, comparisons, and insights.',
      compliance: 'You are a regulatory compliance expert. Generate a compliance report covering KYC, SEBI regulations, and investor protection guidelines.',
    };

    const prompt = format === 'narrative' 
      ? `Generate a professional ${reportType.replace('_', ' ')} based on this data:\n\n${JSON.stringify(data, null, 2)}\n\nUse clear headings, bullet points, and professional language. Make it comprehensive yet easy to understand.`
      : `Generate a structured ${reportType.replace('_', ' ')} in JSON format based on this data:\n\n${JSON.stringify(data, null, 2)}\n\nProvide sections with titles and content.`;

    const result = await aiService.chat([
      { role: 'system', content: systemPrompts[reportType] },
      { role: 'user', content: prompt }
    ], {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.5,
      maxTokens: 8192,
    });

    return result.content;
  }

  /**
   * Smart onboarding conversation
   */
  async conductOnboarding(
    userId: string,
    currentStep: string,
    userResponse?: string,
    contextData?: any
  ): Promise<{ nextQuestion: string; suggestedAnswers?: string[]; isComplete: boolean; extractedData?: any }> {
    const systemPrompt = `You are a friendly financial onboarding assistant. Your job is to:
1. Ask personalized questions to understand the user's financial goals, risk tolerance, and investment preferences
2. Keep questions conversational and easy to understand
3. Extract structured data from user responses
4. Adapt follow-up questions based on previous answers

Be warm, professional, and helpful. Explain financial terms when needed.`;

    const prompt = `Current onboarding step: ${currentStep}
${userResponse ? `User's response: ${userResponse}` : 'Start the conversation'}
${contextData ? `Context data: ${JSON.stringify(contextData)}` : ''}

Respond in JSON format:
{
  "nextQuestion": "The question to ask the user",
  "suggestedAnswers": ["option1", "option2", "option3"] (optional, for multiple choice),
  "isComplete": false,
  "extractedData": { "key": "value" } (data extracted from user response)
}`;

    const result = await aiService.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ], {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
    });

    try {
      return safeJsonParse(result.content);
    } catch {
      const contentStr = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
      return {
        nextQuestion: contentStr,
        isComplete: false,
      };
    }
  }

  /**
   * Build message history for AI context
   */
  private buildMessagesFromHistory(
    history: ChatMessage[],
    session: ChatSession,
    customSystemPrompt?: string
  ): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const systemPrompt = customSystemPrompt || this.getDefaultSystemPrompt(session.sessionType);
    
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add context from session
    if (session.contextData) {
      messages.push({
        role: 'system',
        content: `Context information: ${JSON.stringify(session.contextData)}`
      });
    }

    // Add conversation history (last 20 messages to stay within token limits)
    const recentHistory = history.slice(-20);
    for (const msg of recentHistory) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    return messages;
  }

  /**
   * Get default system prompt based on session type
   */
  private getDefaultSystemPrompt(sessionType: string | null | undefined): string {
    if (!sessionType) sessionType = 'general';
    const prompts: Record<string, string> = {
      general: `You are a knowledgeable financial assistant for FintekPro, an Indian investment platform. Help users with:
- Investment queries and portfolio management
- Market insights and analysis
- Product information (mutual funds, stocks, bonds, IPOs)
- Financial planning and goal setting

Be professional, accurate, and helpful. Always mention when you're unsure and suggest consulting a financial advisor for personalized advice.`,

      transaction: `You are a transaction assistant for FintekPro. Help users:
- Execute investment transactions
- Review order details before confirmation
- Understand fees and charges
- Track transaction status

Always confirm transaction details before execution. Be clear about risks and costs.`,

      portfolio_analysis: `You are a portfolio analysis expert. Provide:
- Detailed portfolio performance analysis
- Asset allocation recommendations
- Risk assessment and management
- Rebalancing suggestions

Use data-driven insights and explain your reasoning clearly.`,

      tax_advice: `You are a tax planning advisor for Indian investors. Help with:
- Tax-efficient investment strategies
- Capital gains optimization
- Tax-loss harvesting
- Section 80C, 80D, and other deductions
- LTCG and STCG implications

Always mention that this is general guidance and users should consult a tax professional for personalized advice.`,
    };

    return prompts[sessionType] || prompts.general;
  }

  /**
   * Generate session title based on type
   */
  private generateSessionTitle(sessionType: string): string {
    const titles: Record<string, string> = {
      general: 'Financial Consultation',
      transaction: 'Transaction Assistance',
      portfolio_analysis: 'Portfolio Review',
      tax_advice: 'Tax Planning Session',
    };

    return titles[sessionType] || 'Chat Session';
  }

  /**
   * Get user's chat sessions
   */
  async getUserSessions(userId: string, limit: number = 20): Promise<ChatSession[]> {
    return await this.storage.getUserChatSessions(userId);
  }

  /**
   * Get chat history for a session
   */
  async getSessionMessages(sessionId: string, userId: string): Promise<ChatMessage[]> {
    const session = await this.storage.getChatSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }
    
    return await this.storage.getChatMessages(sessionId);
  }

  /**
   * End a chat session
   */
  async endSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.storage.getChatSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    await this.storage.updateChatSession(sessionId, {
      isActive: false,
      updatedAt: new Date(),
    });
  }

  /**
   * Rate an AI message
   */
  async rateMessage(
    messageId: string,
    userId: string,
    rating: number,
    feedback?: string
  ): Promise<void> {
    await this.storage.updateChatMessage(messageId, {
      userRating: Math.max(1, Math.min(5, rating)),
      feedbackText: feedback || undefined,
    });
  }
}

export function createChatGPTService(storage: IStorage): ChatGPTService {
  return new ChatGPTService(storage);
}
