import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mcaFinancialBackfillService, FinancialDataInput } from '../services/mca-financial-backfill-service';
import { mcaFinancialRefreshScheduler } from '../services/mca-financial-refresh-scheduler';

const router = Router();

const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const user = (req as any).user;
  if (user?.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
};

router.use(requireAdmin);

const financialDataSchema = z.object({
  cin: z.string().length(21),
  financialYear: z.string().min(4).max(10),
  revenue: z.number().optional(),
  profitBeforeTax: z.number().optional(),
  profitAfterTax: z.number().optional(),
  netWorth: z.number().optional(),
  totalAssets: z.number().optional(),
  totalLiabilities: z.number().optional(),
  shareCapital: z.number().optional(),
  reserves: z.number().optional(),
  longTermBorrowing: z.number().optional(),
  shortTermBorrowing: z.number().optional(),
  ebitda: z.number().optional(),
  operatingCashFlow: z.number().optional(),
});

router.get('/coverage/stats', async (req: Request, res: Response) => {
  try {
    const stats = await mcaFinancialBackfillService.getCoverageStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/coverage/fields', async (req: Request, res: Response) => {
  try {
    const fieldStats = await mcaFinancialBackfillService.getFieldCoverageStats();
    res.json({ success: true, ...fieldStats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/coverage/needs-backfill', async (req: Request, res: Response) => {
  try {
    const companies = await mcaFinancialBackfillService.getCompaniesNeedingBackfill();
    res.json({ success: true, companies, count: companies.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/company/:cin', async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const summary = await mcaFinancialBackfillService.getFinancialSummaryByCIN(cin);
    res.json({ success: true, ...summary });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/backfill/:cin', async (req: Request, res: Response) => {
  try {
    const { cin } = req.params;
    const user = (req as any).user;
    
    const result = await mcaFinancialBackfillService.backfillFromCompanyFinancials(
      cin,
      user?.email || 'admin'
    );
    
    res.json({
      success: result.yearsUpdated > 0,
      result,
      message: result.yearsUpdated > 0 
        ? `Backfilled ${result.yearsUpdated} years for ${result.companyName || cin}`
        : 'No data was backfilled',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/backfill-bulk', async (req: Request, res: Response) => {
  try {
    const { cins } = req.body;
    
    if (!Array.isArray(cins) || cins.length === 0) {
      return res.status(400).json({ success: false, error: 'cins array is required' });
    }
    
    if (cins.length > 50) {
      return res.status(400).json({ success: false, error: 'Maximum 50 CINs per request' });
    }
    
    const user = (req as any).user;
    const result = await mcaFinancialBackfillService.backfillBulk(cins, user?.email || 'admin');
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/update', async (req: Request, res: Response) => {
  try {
    const parsed = financialDataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parsed.error.errors,
      });
    }
    
    const user = (req as any).user;
    const result = await mcaFinancialBackfillService.updateFinancialSnapshot(
      parsed.data,
      user?.email || 'admin'
    );
    
    res.json({
      success: result.success,
      isNew: result.isNew,
      completeness: result.completeness,
      error: result.error,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/import-bulk', async (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ success: false, error: 'data array is required' });
    }
    
    if (data.length > 500) {
      return res.status(400).json({ success: false, error: 'Maximum 500 records per import' });
    }
    
    const validatedData: FinancialDataInput[] = [];
    const validationErrors: Array<{ row: number; error: string }> = [];
    
    for (let i = 0; i < data.length; i++) {
      const parsed = financialDataSchema.safeParse(data[i]);
      if (parsed.success) {
        validatedData.push(parsed.data);
      } else {
        validationErrors.push({ row: i + 1, error: parsed.error.errors[0]?.message || 'Validation error' });
      }
    }
    
    if (validatedData.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid records found',
        validationErrors,
      });
    }
    
    const user = (req as any).user;
    const result = await mcaFinancialBackfillService.importBulkFinancials(
      validatedData,
      user?.email || 'admin'
    );
    
    res.json({
      success: true,
      ...result,
      validationErrors,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scheduler/status', async (req: Request, res: Response) => {
  try {
    const status = await mcaFinancialRefreshScheduler.getSchedulerStatus();
    res.json({ success: true, ...status });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scheduler/start', async (req: Request, res: Response) => {
  try {
    mcaFinancialRefreshScheduler.start();
    res.json({ success: true, message: 'Scheduler started' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scheduler/stop', async (req: Request, res: Response) => {
  try {
    mcaFinancialRefreshScheduler.stop();
    res.json({ success: true, message: 'Scheduler stopped' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scheduler/trigger', async (req: Request, res: Response) => {
  try {
    const { cins } = req.body;
    const result = await mcaFinancialRefreshScheduler.triggerManualRefresh(cins);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
