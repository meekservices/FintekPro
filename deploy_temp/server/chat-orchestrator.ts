import { storage } from "./storage";
import { generateChatResponse } from "./gemini-service";
import { functionRegistry } from "./chat-function-registry";
import type { User, ChatSession, ChatMessage, InsertChatMessage, InsertChatAction } from "@shared/schema";

interface ChatContext {
  user: User;
  session: ChatSession;
  portfolio?: any;
  userProfile?: any;
}

export class ChatOrchestrator {
  private buildSystemPrompt(context: ChatContext): string {
    const { user, portfolio, userProfile } = context;
    
    let prompt = `You are FintekPro AI, an expert financial advisor assistant helping users manage their investments and finances. You are knowledgeable, professional, and focused on providing accurate financial guidance.

User Context:
- Name: ${user.firstName || 'User'} ${user.lastName || ''}
- Email: ${user.email}
`;

    if (userProfile) {
      prompt += `- PAN: ${userProfile.panNumber || 'Not provided'}
- City: ${userProfile.city || 'Not provided'}
`;
    }

    if (portfolio) {
      prompt += `
Portfolio Summary:
- Total Value: ₹${portfolio.totalValue || '0'}
- Cash Balance: ₹${portfolio.cash || '0'}
`;
    }

    prompt += `
Available Functions:
You have access to various functions to help users. You can:
1. View portfolio holdings and performance
2. Get recent transaction history
3. Search for stocks and mutual funds
4. View market snapshots
5. Calculate SIP returns and tax implications
6. Get user profile and financial goals
7. Create mutual fund orders (requires confirmation)
8. Suggest portfolio rebalancing (requires confirmation)

Important Guidelines:
- Always be professional and courteous
- Provide accurate financial information
- For transactional actions (buying/selling), clearly explain what will happen and wait for user confirmation
- Never make assumptions about user's risk tolerance or investment goals without asking
- Always cite sources when providing market data or financial advice
- Be transparent about limitations and suggest consulting with a certified financial advisor for complex decisions
- Flag inappropriate requests or compliance concerns
- For transactions, clearly state: amount, asset name, fees, and risks

Compliance Rules:
- Do not provide personalized tax advice (suggest consulting a tax professional)
- Do not guarantee investment returns
- Always disclose risks associated with investments
- Verify user identity for transactions
- Log all transaction requests for audit trail
`;

    return prompt;
  }

  async startSession(userId: string, sessionType: string = 'general', portfolioId?: string): Promise<ChatSession> {
    // Load user and context
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    let portfolio;
    if (portfolioId) {
      portfolio = await storage.getPortfolio(portfolioId);
    } else {
      const portfolios = await storage.getPortfoliosByUserId(userId);
      portfolio = portfolios[0];
    }

    const userProfile = await storage.getUserProfile(userId);

    // Create session with context
    const contextData = {
      portfolioSnapshot: portfolio ? {
        id: portfolio.id,
        name: portfolio.name,
        totalValue: portfolio.totalValue,
        cash: portfolio.cash,
      } : null,
      userProfile: userProfile ? {
        panNumber: userProfile.panNumber,
        city: userProfile.city,
        state: userProfile.state,
      } : null,
    };

    const session = await storage.createChatSession({
      userId,
      title: `Chat - ${new Date().toLocaleString()}`,
      sessionType,
      contextData,
      portfolioId: portfolio?.id,
      isActive: true,
      lastMessageAt: new Date(),
      messageCount: 0,
    });

    // Create welcome message
    const welcomeMessage = await this.createAssistantMessage(
      session.id,
      `Hello! I'm your FintekPro AI assistant. I can help you with:

• Viewing your portfolio and holdings
• Analyzing market trends
• Calculating investment returns
• Managing transactions
• Planning your financial goals

How can I assist you today?`
    );

    return session;
  }

  async sendMessage(sessionId: string, userMessage: string, userId: string): Promise<ChatMessage> {
    // Get session and context
    const session = await storage.getChatSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Save user message
    const userMsg = await storage.createChatMessage({
      sessionId,
      role: 'user',
      content: userMessage,
    });

    // Build context
    const portfolio = session.portfolioId ? await storage.getPortfolio(session.portfolioId) : null;
    const userProfile = await storage.getUserProfile(userId);

    const context: ChatContext = {
      user,
      session,
      portfolio,
      userProfile,
    };

    // Get conversation history
    const messages = await storage.getChatMessages(sessionId);
    const conversationHistory = messages.map(m => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context);

    // Get available functions
    const functions = functionRegistry.getFunctions();
    const functionSchemas = functions.map(f => functionRegistry.getFunctionSchema(f.name)).filter(Boolean);

    try {
      // Call Gemini with function calling
      const response = await generateChatResponse(
        systemPrompt,
        conversationHistory,
        functionSchemas as any[]
      );

      // Check if function call is requested
      if (response.functionCall) {
        return await this.handleFunctionCall(
          session,
          user,
          response.functionCall,
          userMsg.id
        );
      }

      // Save assistant message
      const assistantMsg = await this.createAssistantMessage(
        sessionId,
        response.text || 'I apologize, but I encountered an error. Please try again.'
      );

      return assistantMsg;
    } catch (error) {
      console.error('Chat error:', error);
      const errorMsg = await this.createAssistantMessage(
        sessionId,
        'I apologize, but I encountered an error processing your request. Please try again or rephrase your question.'
      );
      return errorMsg;
    }
  }

  private async handleFunctionCall(
    session: ChatSession,
    user: User,
    functionCall: { name: string; args: any },
    userMessageId: string
  ): Promise<ChatMessage> {
    const func = functionRegistry.getFunction(functionCall.name);
    if (!func) {
      return await this.createAssistantMessage(
        session.id,
        `I tried to call a function that doesn't exist: ${functionCall.name}. Please try again.`
      );
    }

    // Save function call message
    const functionCallMsg = await storage.createChatMessage({
      sessionId: session.id,
      role: 'assistant',
      content: `Calling function: ${func.displayName}`,
      functionCall: functionCall,
    });

    // Check if confirmation is required
    if (func.requiresConfirmation) {
      // Create pending action
      const action = await storage.createChatAction({
        sessionId: session.id,
        messageId: functionCallMsg.id,
        userId: user.id,
        actionType: 'transaction',
        functionName: functionCall.name,
        status: 'pending_confirmation',
        actionParams: functionCall.args,
      });

      // Return confirmation request
      const confirmationMsg = await this.createAssistantMessage(
        session.id,
        this.buildConfirmationMessage(func, functionCall.args, action.id)
      );

      return confirmationMsg;
    }

    // Execute function directly for non-transactional operations
    try {
      const result = await functionRegistry.executeFunction(
        functionCall.name,
        functionCall.args,
        user
      );

      // Update function usage
      await storage.updateChatFunctionUsage(functionCall.name, true);

      // Save function response
      await storage.updateChatMessage(functionCallMsg.id, {
        functionResponse: result,
      });

      // Generate natural language response from the result
      const responseText = this.formatFunctionResult(func.displayName, result);
      const assistantMsg = await this.createAssistantMessage(session.id, responseText);

      return assistantMsg;
    } catch (error) {
      // Update function usage (failure)
      await storage.updateChatFunctionUsage(functionCall.name, false);

      const errorMsg = await this.createAssistantMessage(
        session.id,
        `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`
      );

      return errorMsg;
    }
  }

  async confirmAction(actionId: string, userId: string, confirmed: boolean): Promise<ChatMessage> {
    const action = await storage.getChatAction(actionId);
    if (!action || action.userId !== userId) {
      throw new Error('Action not found or unauthorized');
    }

    if (action.status !== 'pending_confirmation') {
      throw new Error('Action is not pending confirmation');
    }

    if (!confirmed) {
      // User rejected
      await storage.updateChatAction(actionId, {
        status: 'rejected',
      });

      return await this.createAssistantMessage(
        action.sessionId,
        'Understood. I\'ve cancelled that action. Is there anything else I can help you with?'
      );
    }

    // User confirmed - execute function
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    try {
      await storage.updateChatAction(actionId, {
        status: 'confirmed',
        userConfirmedAt: new Date(),
      });

      const result = await functionRegistry.executeFunction(
        action.functionName,
        action.actionParams,
        user
      );

      // Update action with result
      await storage.updateChatAction(actionId, {
        status: 'executed',
        executedAt: new Date(),
        actionResult: result,
      });

      // Update function usage
      await storage.updateChatFunctionUsage(action.functionName, true);

      const responseText = `✅ Action completed successfully!\n\n${this.formatFunctionResult(action.functionName, result)}`;
      return await this.createAssistantMessage(action.sessionId, responseText);
    } catch (error) {
      // Update action with error
      await storage.updateChatAction(actionId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update function usage (failure)
      await storage.updateChatFunctionUsage(action.functionName, false);

      return await this.createAssistantMessage(
        action.sessionId,
        `❌ Action failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again or contact support.`
      );
    }
  }

  private buildConfirmationMessage(func: any, params: any, actionId: string): string {
    let message = `⚠️ **Confirmation Required**\n\n`;
    message += `I'm about to **${func.displayName}** with the following details:\n\n`;

    for (const [key, value] of Object.entries(params)) {
      message += `• ${key}: ${JSON.stringify(value)}\n`;
    }

    message += `\nPlease review carefully and confirm if you'd like to proceed.\n`;
    message += `\n*Action ID: ${actionId}*`;

    return message;
  }

  private formatFunctionResult(functionName: string, result: any): string {
    // Format result based on function type
    if (typeof result === 'string') {
      return result;
    }

    if (result.message) {
      return result.message;
    }

    // Format as JSON with nice formatting
    return `Here's what I found:\n\n${JSON.stringify(result, null, 2)}`;
  }

  private async createAssistantMessage(sessionId: string, content: string): Promise<ChatMessage> {
    return await storage.createChatMessage({
      sessionId,
      role: 'assistant',
      content,
    });
  }

  async getSessionHistory(sessionId: string, userId: string, limit?: number): Promise<ChatMessage[]> {
    const session = await storage.getChatSession(sessionId);
    if (!session || session.userId !== userId) {
      throw new Error('Session not found or unauthorized');
    }

    return await storage.getChatMessages(sessionId, limit);
  }

  async getUserSessions(userId: string): Promise<ChatSession[]> {
    return await storage.getUserChatSessions(userId);
  }
}

export const chatOrchestrator = new ChatOrchestrator();
