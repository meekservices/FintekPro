import { Router, Request, Response, NextFunction } from 'express';
import { createChatGPTService } from '../services/chatgpt-service';
import type { IStorage } from '../storage';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
}

type AuthMiddleware = (req: Request, res: Response, next: NextFunction) => void;

export function setupChatRoutes(router: Router, storage: IStorage, requireAuth: AuthMiddleware) {
  const chatService = createChatGPTService(storage);

  router.get('/api/chat/sessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const sessions = await chatService.getUserSessions(userId.toString());
      res.json(sessions);
    } catch (error: unknown) {
      console.error('[Chat] Get sessions error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to get chat sessions';
      res.status(500).json({ error: msg });
    }
  });

  router.post('/api/chat/sessions', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionType = 'general', portfolioId, contextData } = req.body;
      
      const session = await chatService.startSession({
        userId: userId.toString(),
        sessionType,
        portfolioId,
        contextData
      });
      
      res.json(session);
    } catch (error: unknown) {
      console.error('[Chat] Create session error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to create chat session';
      res.status(500).json({ error: msg });
    }
  });

  router.get('/api/chat/sessions/:sessionId/messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;
      const messages = await chatService.getSessionMessages(sessionId, userId.toString());
      res.json(messages);
    } catch (error: unknown) {
      console.error('[Chat] Get messages error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to get chat messages';
      res.status(500).json({ error: msg });
    }
  });

  router.post('/api/chat/sessions/:sessionId/messages', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;
      const { content, options = {} } = req.body;
      
      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Message content is required' });
        return;
      }

      const result = await chatService.sendMessage(sessionId, userId.toString(), content, options);
      res.json(result);
    } catch (error: unknown) {
      console.error('[Chat] Send message error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to send message';
      res.status(500).json({ error: msg });
    }
  });

  router.post('/api/chat/sessions/:sessionId/end', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { sessionId } = req.params;
      await chatService.endSession(sessionId, userId.toString());
      res.json({ success: true });
    } catch (error: unknown) {
      console.error('[Chat] End session error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to end chat session';
      res.status(500).json({ error: msg });
    }
  });

  router.post('/api/chat/messages/:messageId/rate', requireAuth, async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { messageId } = req.params;
      const { rating, feedback } = req.body;
      
      if (typeof rating !== 'number' || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
        return;
      }

      await chatService.rateMessage(messageId, userId.toString(), rating, feedback);
      res.json({ success: true });
    } catch (error: unknown) {
      console.error('[Chat] Rate message error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to rate message';
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
