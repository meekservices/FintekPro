import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

// Follow these instructions when using this blueprint:
// 1. Note that the newest OpenAI model is "gpt-5", not "gpt-4o" or "gpt-4". gpt-5 was released August 7, 2025 after your knowledge cutoff. Always prefer using gpt-5 as it is the latest model. When copying code from this blueprint, ensure you also mention this information verbatim as a comment so that you don't revert it to older models: `// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user`

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access without requiring your own OpenAI API key.
// Supports up to gpt-5.1 models
const openaiIntegrations = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

// Direct OpenAI client for GPT-5.2 models (requires user's own API key)
// GPT-5.2 was released December 11, 2025 with enhanced reasoning for complex financial analysis
const openaiDirect = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
}) : null;

// Fallback to Gemini if configured
const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

export type AIProvider = 'openai' | 'openai-direct' | 'gemini';
export type AIModel = 
  | 'gpt-5' | 'gpt-5.1' | 'gpt-5-mini' | 'gpt-4.1' | 'gpt-4o' 
  | 'gpt-5.2-instant' | 'gpt-5.2-thinking' | 'gpt-5.2-pro'
  | 'gemini-2.5-flash';

// GPT-5.2 models require direct OpenAI API (not Replit AI Integrations)
const GPT52_MODELS = ['gpt-5.2-instant', 'gpt-5.2-thinking', 'gpt-5.2-pro'];
const isGpt52Model = (model: string) => GPT52_MODELS.includes(model);

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// GPT-5.2 reasoning effort levels
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

interface AIServiceOptions {
  provider?: AIProvider;
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  reasoningEffort?: ReasoningEffort; // For GPT-5.2 models
}

export interface AIUsageMetrics {
  provider: AIProvider;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestId: string;
  timestamp: Date;
}

class AIService {
  private usageMetrics: AIUsageMetrics[] = [];

  /**
   * Chat completion with automatic fallback
   * the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
   * GPT-5.2 models (gpt-5.2-instant, gpt-5.2-thinking, gpt-5.2-pro) require user's own OPENAI_API_KEY
   */
  async chat(
    messages: ChatMessage[],
    options: AIServiceOptions = {}
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    const {
      provider = 'gemini',
      model = 'gemini-2.5-flash',
      temperature = 0.7,
      maxTokens = 8192,
      stream = false,
      reasoningEffort = 'high'
    } = options;

    try {
      // GPT-5.2 models use direct OpenAI API
      if (isGpt52Model(model)) {
        if (!openaiDirect) {
          throw new Error('GPT-5.2 models require OPENAI_API_KEY environment variable');
        }
        return await this.chatWithOpenAI52(messages, model as AIModel, temperature, maxTokens, reasoningEffort);
      }
      
      if (provider === 'openai' || provider === 'openai-direct') {
        return await this.chatWithOpenAI(messages, model as AIModel, temperature, maxTokens, stream);
      } else if (provider === 'gemini' && gemini) {
        return await this.chatWithGemini(messages, model as AIModel, temperature, maxTokens);
      } else {
        throw new Error(`Provider ${provider} not available`);
      }
    } catch (error: any) {
      console.error(`AI Service Error (${provider}):`, error.message);
      
      if (provider === 'gemini') {
        console.log('[AI Fallback] Gemini failed, falling back to OpenAI...');
        return await this.chatWithOpenAI(messages, 'gpt-5', temperature, maxTokens, stream);
      }
      
      if ((provider === 'openai' || provider === 'openai-direct') && gemini) {
        console.log('[AI Fallback] OpenAI failed, falling back to Gemini...');
        return await this.chatWithGemini(messages, 'gemini-2.5-flash', temperature, maxTokens);
      }
      
      throw error;
    }
  }

  /**
   * Streaming chat completion
   * the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
   */
  async streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options: AIServiceOptions = {}
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    const {
      provider = 'gemini',
      model = 'gemini-2.5-flash',
      temperature = 0.7,
      maxTokens = 8192
    } = options;

    try {
      if (provider === 'openai') {
        return await this.streamOpenAI(messages, model as AIModel, temperature, maxTokens, onChunk);
      } else if (provider === 'gemini' && gemini) {
        return await this.streamGemini(messages, model as AIModel, temperature, maxTokens, onChunk);
      } else {
        throw new Error(`Provider ${provider} not available`);
      }
    } catch (error: any) {
      console.error(`AI Streaming Error (${provider}):`, error.message);
      
      if (provider === 'gemini') {
        console.log('[AI Fallback] Gemini streaming failed, falling back to OpenAI...');
        return await this.streamOpenAI(messages, 'gpt-5', temperature, maxTokens, onChunk);
      }
      
      if ((provider === 'openai' || provider === 'openai-direct') && gemini) {
        console.log('[AI Fallback] OpenAI streaming failed, falling back to Gemini...');
        return await this.streamGemini(messages, 'gemini-2.5-flash', temperature, maxTokens, onChunk);
      }
      
      throw error;
    }
  }

  /**
   * OpenAI chat completion (via Replit AI Integrations - up to gpt-5.1)
   */
  private async chatWithOpenAI(
    messages: ChatMessage[],
    model: AIModel,
    temperature: number,
    maxTokens: number,
    stream: boolean
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    const isGpt5 = model.startsWith('gpt-5');
    const response = await openaiIntegrations.chat.completions.create({
      model,
      messages,
      temperature: isGpt5 ? undefined : temperature, // gpt-5+ doesn't support temperature
      max_completion_tokens: isGpt5 ? maxTokens : undefined, // gpt-5+ uses max_completion_tokens
      max_tokens: !isGpt5 ? maxTokens : undefined,
      stream: false
    });

    // Ensure content is always a string
    let content = response.choices[0]?.message?.content || '';
    if (typeof content !== 'string') {
      console.warn('[AI Service] OpenAI returned non-string content, converting to JSON:', typeof content);
      content = JSON.stringify(content);
    }
    const usage: AIUsageMetrics = {
      provider: 'openai',
      model,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      requestId: response.id,
      timestamp: new Date()
    };

    this.usageMetrics.push(usage);
    return { content, usage };
  }

  /**
   * GPT-5.2 chat completion (via direct OpenAI API)
   * Requires OPENAI_API_KEY environment variable
   * GPT-5.2 was released December 11, 2025 with enhanced reasoning for complex tasks
   */
  private async chatWithOpenAI52(
    messages: ChatMessage[],
    model: AIModel,
    temperature: number,
    maxTokens: number,
    reasoningEffort: ReasoningEffort = 'high'
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    if (!openaiDirect) {
      throw new Error('GPT-5.2 requires OPENAI_API_KEY environment variable');
    }

    const response = await openaiDirect.chat.completions.create({
      model,
      messages,
      max_completion_tokens: maxTokens,
      // GPT-5.2 uses reasoning_effort instead of temperature
      ...(model.includes('thinking') || model.includes('pro') ? { 
        reasoning_effort: reasoningEffort 
      } : {})
    } as any);

    // Ensure content is always a string
    let content = response.choices[0]?.message?.content || '';
    if (typeof content !== 'string') {
      console.warn('[AI Service] OpenAI-Direct returned non-string content, converting to JSON:', typeof content);
      content = JSON.stringify(content);
    }
    const usage: AIUsageMetrics = {
      provider: 'openai-direct',
      model,
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
      requestId: response.id,
      timestamp: new Date()
    };

    this.usageMetrics.push(usage);
    return { content, usage };
  }

  /**
   * OpenAI streaming chat (via Replit AI Integrations)
   */
  private async streamOpenAI(
    messages: ChatMessage[],
    model: AIModel,
    temperature: number,
    maxTokens: number,
    onChunk: (chunk: string) => void
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    const isGpt5 = model.startsWith('gpt-5');
    const stream = await openaiIntegrations.chat.completions.create({
      model,
      messages,
      temperature: isGpt5 ? undefined : temperature,
      max_completion_tokens: isGpt5 ? maxTokens : undefined,
      max_tokens: !isGpt5 ? maxTokens : undefined,
      stream: true
    });

    let fullContent = '';
    let requestId = '';

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        onChunk(content);
      }
      if (!requestId && chunk.id) {
        requestId = chunk.id;
      }
    }

    const usage: AIUsageMetrics = {
      provider: 'openai',
      model,
      promptTokens: 0, // Not available in streaming
      completionTokens: 0,
      totalTokens: 0,
      requestId,
      timestamp: new Date()
    };

    this.usageMetrics.push(usage);
    return { content: fullContent, usage };
  }

  /**
   * Gemini chat completion
   */
  private async chatWithGemini(
    messages: ChatMessage[],
    model: AIModel,
    temperature: number,
    maxTokens: number
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    if (!gemini) {
      throw new Error('Gemini API key not configured');
    }

    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');
    const prompt = userMessages.map(m => m.content).join('\n\n');
    const fullPrompt = systemMessage ? `${systemMessage}\n\n${prompt}` : prompt;

    const response = await gemini.models.generateContent({
      model: model.includes('gemini') ? model : 'gemini-2.5-flash',
      config: {
        temperature,
        maxOutputTokens: maxTokens,
      },
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    // Ensure content is always a string - handle edge cases where response.text might be an object
    let content = response.text || '';
    if (typeof content !== 'string') {
      console.warn('[AI Service] Gemini returned non-string content, converting to JSON:', typeof content);
      content = JSON.stringify(content);
    }
    const usage: AIUsageMetrics = {
      provider: 'gemini',
      model: model.includes('gemini') ? model : 'gemini-2.5-flash',
      promptTokens: response.usageMetadata?.promptTokenCount || 0,
      completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: response.usageMetadata?.totalTokenCount || 0,
      requestId: `gemini-${Date.now()}`,
      timestamp: new Date()
    };

    this.usageMetrics.push(usage);
    return { content, usage };
  }

  /**
   * Gemini streaming chat
   */
  private async streamGemini(
    messages: ChatMessage[],
    model: AIModel,
    temperature: number,
    maxTokens: number,
    onChunk: (chunk: string) => void
  ): Promise<{ content: string; usage: AIUsageMetrics }> {
    if (!gemini) {
      throw new Error('Gemini API key not configured');
    }

    // Convert messages to Gemini format
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');
    const prompt = userMessages.map(m => m.content).join('\n\n');
    const fullPrompt = systemMessage ? `${systemMessage}\n\n${prompt}` : prompt;

    const stream = await gemini.models.generateContentStream({
      model: model.includes('gemini') ? model : 'gemini-2.5-flash',
      config: {
        temperature,
        maxOutputTokens: maxTokens,
      },
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
    });

    let fullContent = '';
    let finalResponse: any = null;
    
    for await (const chunk of stream) {
      const chunkText = chunk.text || '';
      fullContent += chunkText;
      onChunk(chunkText);
      finalResponse = chunk;
    }
    const usage: AIUsageMetrics = {
      provider: 'gemini',
      model: model.includes('gemini') ? model : 'gemini-2.5-flash',
      promptTokens: finalResponse?.usageMetadata?.promptTokenCount || 0,
      completionTokens: finalResponse?.usageMetadata?.candidatesTokenCount || 0,
      totalTokens: finalResponse?.usageMetadata?.totalTokenCount || 0,
      requestId: `gemini-stream-${Date.now()}`,
      timestamp: new Date()
    };

    this.usageMetrics.push(usage);
    return { content: fullContent, usage };
  }

  /**
   * Get usage statistics
   */
  getUsageMetrics(): AIUsageMetrics[] {
    return this.usageMetrics;
  }

  /**
   * Get total cost estimate (rough approximation)
   */
  getTotalCost(): { openai: number; gemini: number; total: number } {
    let openaiCost = 0;
    let geminiCost = 0;

    this.usageMetrics.forEach(metric => {
      if (metric.provider === 'openai') {
        // Rough estimate: $0.01 per 1K tokens
        openaiCost += (metric.totalTokens / 1000) * 0.01;
      } else if (metric.provider === 'gemini') {
        // Rough estimate: $0.0005 per 1K tokens
        geminiCost += (metric.totalTokens / 1000) * 0.0005;
      }
    });

    return {
      openai: openaiCost,
      gemini: geminiCost,
      total: openaiCost + geminiCost
    };
  }

  /**
   * Clear usage metrics
   */
  clearMetrics(): void {
    this.usageMetrics = [];
  }

  /**
   * Check if GPT-5.2 is available (requires user's own OPENAI_API_KEY)
   */
  isGpt52Available(): boolean {
    return openaiDirect !== null;
  }

  /**
   * Get recommended model for complex financial analysis
   * Uses GPT-5.2 Thinking if available, falls back to Gemini
   */
  getComplexAnalysisModel(): { provider: AIProvider; model: AIModel } {
    if (this.isGpt52Available()) {
      return { provider: 'openai-direct', model: 'gpt-5.2-thinking' };
    }
    return { provider: 'gemini', model: 'gemini-2.5-flash' };
  }
}

export const aiService = new AIService();

// Export helper for checking GPT-5.2 availability
export const isGpt52Available = () => aiService.isGpt52Available();
export const getComplexAnalysisModel = () => aiService.getComplexAnalysisModel();
