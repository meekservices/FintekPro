import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { esignAIAnalysisService } from '../services/esign-ai-analysis-service';
import { requireAuth } from '../middleware/roleMiddleware';

const router = Router();

const analyzeDocumentSchema = z.object({
  documentId: z.string().min(1),
  documentContent: z.string().min(10, 'Document content is required'),
  documentName: z.string().min(1),
  documentType: z.string().min(1),
  workflowId: z.number().optional(),
  analysisTypes: z.array(z.enum(['summary', 'correction', 'missing_clause', 'compliance', 'general'])).optional(),
});

const addReplySchema = z.object({
  content: z.string().min(1, 'Reply content is required'),
  authorName: z.string().min(1),
  authorType: z.enum(['agent', 'client', 'system']),
  authorEmail: z.string().email().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['open', 'accepted', 'rejected', 'resolved', 'deferred']),
  rejectionReason: z.string().optional(),
});

const addAnnotationSchema = z.object({
  documentId: z.string().min(1),
  workflowId: z.number().optional(),
  category: z.enum(['summary', 'correction', 'missing_clause', 'compliance', 'general']),
  title: z.string().min(1),
  content: z.string().min(1),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  textExcerpt: z.string().optional(),
  suggestedAction: z.string().optional(),
  suggestedReplacement: z.string().optional(),
  pageNumber: z.number().optional(),
});

router.post('/analyze', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const validated = analyzeDocumentSchema.parse(req.body);
    
    const result = await esignAIAnalysisService.analyzeDocument({
      ...validated,
      requestedById: user?.id,
      requestedByName: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email,
    });
    
    res.json(result);
  } catch (error) {
    console.error('[eSign AI Routes] Analyze error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/annotations/:documentId', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.params;
    const { category, status } = req.query;
    
    const annotations = await esignAIAnalysisService.getAnnotationsForDocument(documentId, {
      category: category as any,
      status: status as any,
    });
    
    res.json({
      success: true,
      documentId,
      annotations,
      total: annotations.length,
    });
  } catch (error) {
    console.error('[eSign AI Routes] Get annotations error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/annotations/detail/:annotationId', async (req: Request, res: Response) => {
  try {
    const annotationId = parseInt(req.params.annotationId, 10);
    
    const result = await esignAIAnalysisService.getAnnotationWithReplies(annotationId);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Annotation not found' });
    }
    
    res.json({ success: true, annotation: result });
  } catch (error) {
    console.error('[eSign AI Routes] Get annotation detail error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/annotations/:annotationId/replies', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const annotationId = parseInt(req.params.annotationId, 10);
    const validated = addReplySchema.parse(req.body);
    
    const reply = await esignAIAnalysisService.addReply(annotationId, {
      ...validated,
      authorId: user?.id,
    });
    
    res.json({ success: true, reply });
  } catch (error) {
    console.error('[eSign AI Routes] Add reply error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.patch('/annotations/:annotationId/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const annotationId = parseInt(req.params.annotationId, 10);
    const validated = updateStatusSchema.parse(req.body);
    
    const result = await esignAIAnalysisService.updateAnnotationStatus(annotationId, {
      status: validated.status,
      rejectionReason: validated.rejectionReason,
      actorId: user?.id,
      actorName: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
      actorType: user?.role === 'client' ? 'client' : 'agent',
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[eSign AI Routes] Update status error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/annotations/:annotationId/audit', async (req: Request, res: Response) => {
  try {
    const annotationId = parseInt(req.params.annotationId, 10);
    
    const auditLog = await esignAIAnalysisService.getAnnotationAuditLog(annotationId);
    
    res.json({ success: true, annotationId, auditLog });
  } catch (error) {
    console.error('[eSign AI Routes] Get audit log error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const { documentId } = req.query;
    
    const sessions = await esignAIAnalysisService.getAnalysisSessions(documentId as string);
    
    res.json({ success: true, sessions, total: sessions.length });
  } catch (error) {
    console.error('[eSign AI Routes] Get sessions error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/annotations/manual', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const validated = addAnnotationSchema.parse(req.body);
    
    const annotation = await esignAIAnalysisService.addManualAnnotation(validated.documentId, {
      ...validated,
      createdById: user?.id,
      createdByName: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
      createdByType: user?.role === 'client' ? 'client' : 'agent',
    });
    
    res.json({ success: true, annotation });
  } catch (error) {
    console.error('[eSign AI Routes] Add manual annotation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: 'Validation failed', details: error.issues });
    }
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/annotations/:annotationId/accept-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const { documentId } = req.body;
    const user = req.user as any;
    
    if (!documentId) {
      return res.status(400).json({ success: false, error: 'documentId is required' });
    }
    
    const annotations = await esignAIAnalysisService.getAnnotationsForDocument(documentId, { status: 'open' });
    
    let acceptedCount = 0;
    for (const annotation of annotations) {
      await esignAIAnalysisService.updateAnnotationStatus(annotation.id, {
        status: 'accepted',
        actorId: user?.id,
        actorName: user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email || 'Unknown',
        actorType: user?.role === 'client' ? 'client' : 'agent',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });
      acceptedCount++;
    }
    
    res.json({ success: true, acceptedCount });
  } catch (error) {
    console.error('[eSign AI Routes] Accept all error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
