import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { reportOrchestratorService } from '../services/reports/report-orchestrator';
import { generatePortfolioReportPDF } from '../services/reports/pdf-renderer';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { reportConfigSchema } from '@shared/schema';
import * as crypto from 'crypto';

const router = Router();

router.get('/api/portfolio-reports/clients-portfolios', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { db } = await import('../db');
    const { users, portfolios } = await import('@shared/schema');
    const { eq, desc } = await import('drizzle-orm');

    const clients = await db.select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
    }).from(users).orderBy(desc(users.createdAt)).limit(100);

    const clientPortfolios = await Promise.all(
      clients.map(async (client) => {
        const clientPortfolios = await db.select()
          .from(portfolios)
          .where(eq(portfolios.userId, client.id));
        return {
          ...client,
          portfolios: clientPortfolios,
        };
      })
    );

    res.json({ success: true, clients: clientPortfolios });
  } catch (error) {
    console.error('[Portfolio Reports] Error fetching clients:', error);
    res.status(500).json({ error: 'Failed to fetch clients and portfolios' });
  }
});

router.post('/api/portfolio-reports/validate', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const config = reportConfigSchema.parse(req.body);
    const validation = await reportOrchestratorService.runPreFlightValidation(config);
    res.json({ success: true, validation });
  } catch (error) {
    console.error('[Portfolio Reports] Validation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid configuration', details: error.errors });
    }
    res.status(500).json({ error: 'Validation failed' });
  }
});

router.post('/api/portfolio-reports/generate', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { config, clientId, reportName, templateId } = req.body;
    const parsedConfig = reportConfigSchema.parse(config);

    const validation = await reportOrchestratorService.runPreFlightValidation(parsedConfig);
    if (!validation.success && validation.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Pre-flight validation failed', 
        validation 
      });
    }

    const report = await reportOrchestratorService.createGeneratedReport(
      parsedConfig,
      userId,
      clientId,
      { templateId, reportName }
    );

    await reportOrchestratorService.updateReportStatus(report.id, 'generating');

    try {
      const portfolioData = await reportOrchestratorService.getPortfolioData(parsedConfig.portfolioId);
      if (!portfolioData) {
        throw new Error('Portfolio not found');
      }

      const pdfBuffer = await generatePortfolioReportPDF(parsedConfig, portfolioData);
      const checksum = crypto.createHash('sha256').update(pdfBuffer).digest('hex');

      const base64Pdf = pdfBuffer.toString('base64');
      const dataUrl = `data:application/pdf;base64,${base64Pdf}`;

      await reportOrchestratorService.updateReportStatus(report.id, 'generated', {
        fileUrl: dataUrl,
        fileSize: pdfBuffer.length,
        hashChecksum: checksum,
      });

      await reportOrchestratorService.logAudit(report.id, 'generated', userId, {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      });

      res.json({
        success: true,
        report: {
          ...report,
          status: 'generated',
          fileUrl: dataUrl,
          fileSize: pdfBuffer.length,
          hashChecksum: checksum,
        },
      });
    } catch (genError) {
      console.error('[Portfolio Reports] Generation error:', genError);
      await reportOrchestratorService.updateReportStatus(report.id, 'failed', {
        errorMessage: (genError as Error).message,
      });
      throw genError;
    }
  } catch (error) {
    console.error('[Portfolio Reports] Error generating report:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid configuration', details: error.errors });
    }
    res.status(500).json({ error: 'Report generation failed' });
  }
});

router.get('/api/portfolio-reports/generated', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const reports = await reportOrchestratorService.getGeneratedReports(userId);
    res.json({ success: true, reports });
  } catch (error) {
    console.error('[Portfolio Reports] Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.get('/api/portfolio-reports/generated/:id', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const report = await reportOrchestratorService.getGeneratedReport(req.params.id);
    
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    await reportOrchestratorService.logAudit(report.id, 'downloaded', userId, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ success: true, report });
  } catch (error) {
    console.error('[Portfolio Reports] Error fetching report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

router.post('/api/portfolio-reports/templates', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, config, description, isDefault, isPublic, category } = req.body;
    
    if (!name || !config) {
      return res.status(400).json({ error: 'Name and config are required' });
    }

    const parsedConfig = reportConfigSchema.parse(config);

    const template = await reportOrchestratorService.saveTemplate(
      name,
      parsedConfig,
      userId,
      { description, isDefault, isPublic, category }
    );

    res.json({ success: true, template });
  } catch (error) {
    console.error('[Portfolio Reports] Error saving template:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid configuration', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to save template' });
  }
});

router.get('/api/portfolio-reports/templates', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const templates = await reportOrchestratorService.getTemplates(userId);
    res.json({ success: true, templates });
  } catch (error) {
    console.error('[Portfolio Reports] Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

router.get('/api/portfolio-reports/templates/:id', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const template = await reportOrchestratorService.getTemplate(req.params.id);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true, template });
  } catch (error) {
    console.error('[Portfolio Reports] Error fetching template:', error);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
});

router.delete('/api/portfolio-reports/templates/:id', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await reportOrchestratorService.deleteTemplate(req.params.id, userId);
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    console.error('[Portfolio Reports] Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

router.get('/api/portfolio-reports/:id/audit', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const logs = await reportOrchestratorService.getAuditLogs(req.params.id);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('[Portfolio Reports] Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

router.post('/api/portfolio-reports/:id/attach-proposal', requireAuth, requireRole('agent', 'partner', 'admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { proposalId } = req.body;
    if (!proposalId) {
      return res.status(400).json({ error: 'Proposal ID is required' });
    }

    await reportOrchestratorService.attachToProposal(req.params.id, proposalId, userId);
    res.json({ success: true, message: 'Report attached to proposal' });
  } catch (error) {
    console.error('[Portfolio Reports] Error attaching to proposal:', error);
    res.status(500).json({ error: 'Failed to attach report to proposal' });
  }
});

router.get('/api/portfolio-reports/benchmarks', requireAuth, async (req: Request, res: Response) => {
  const benchmarks = [
    { id: 'nifty50', name: 'NIFTY 50', type: 'index' },
    { id: 'sensex', name: 'BSE SENSEX', type: 'index' },
    { id: 'nifty100', name: 'NIFTY 100', type: 'index' },
    { id: 'bse100', name: 'BSE 100', type: 'index' },
    { id: 'nifty_midcap', name: 'NIFTY Midcap 100', type: 'index' },
    { id: 'nifty_smallcap', name: 'NIFTY Smallcap 100', type: 'index' },
    { id: 'nifty_bank', name: 'NIFTY Bank', type: 'index' },
    { id: 'nifty_it', name: 'NIFTY IT', type: 'index' },
  ];
  res.json({ success: true, benchmarks });
});

export default router;
