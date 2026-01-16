import { Router, Request, Response } from 'express';
import { createChatGPTService } from '../services/chatgpt-service';
import type { IStorage } from '../storage';

export function setupChatRoutes(router: Router, storage: IStorage, requireAuth: any) {
  const chatService = createChatGPTService(storage);

  router.get('/api/chat/sessions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const sessions = await chatService.getUserSessions(userId.toString());
      res.json(sessions);
    } catch (error: any) {
      console.error('[Chat] Get sessions error:', error);
      res.status(500).json({ error: error.message || 'Failed to get chat sessions' });
    }
  });

  router.post('/api/chat/sessions', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionType = 'general', portfolioId, contextData } = req.body;
      
      const session = await chatService.startSession({
        userId: userId.toString(),
        sessionType,
        portfolioId,
        contextData
      });
      
      res.json(session);
    } catch (error: any) {
      console.error('[Chat] Create session error:', error);
      res.status(500).json({ error: error.message || 'Failed to create chat session' });
    }
  });

  router.get('/api/chat/sessions/:sessionId/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionId } = req.params;
      const messages = await chatService.getSessionMessages(sessionId, userId.toString());
      res.json(messages);
    } catch (error: any) {
      console.error('[Chat] Get messages error:', error);
      res.status(500).json({ error: error.message || 'Failed to get chat messages' });
    }
  });

  router.post('/api/chat/sessions/:sessionId/messages', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionId } = req.params;
      const { content, options = {} } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const result = await chatService.sendMessage(sessionId, userId.toString(), content, options);
      res.json(result);
    } catch (error: any) {
      console.error('[Chat] Send message error:', error);
      res.status(500).json({ error: error.message || 'Failed to send message' });
    }
  });

  router.post('/api/chat/sessions/:sessionId/end', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { sessionId } = req.params;
      await chatService.endSession(sessionId, userId.toString());
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Chat] End session error:', error);
      res.status(500).json({ error: error.message || 'Failed to end chat session' });
    }
  });

  router.post('/api/chat/messages/:messageId/rate', requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { messageId } = req.params;
      const { rating, feedback } = req.body;
      
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
      }

      await chatService.rateMessage(messageId, userId.toString(), rating, feedback);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Chat] Rate message error:', error);
      res.status(500).json({ error: error.message || 'Failed to rate message' });
    }
  });

  return router;
}
