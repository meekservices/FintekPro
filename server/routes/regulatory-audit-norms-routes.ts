import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { regulatoryAuditNormsService } from '../services/regulatory-audit-norms-service';

const router = Router();

router.use(requireAuth);

/**
 * GET /api/admin/regulatory-audit/norms
 * Returns the full list of regulatory norms with metadata.
 */
router.get('/norms', async (_req: Request, res: Response) => {
  try {
    const norms = regulatoryAuditNormsService.getNorms();
    res.json({ success: true, data: norms, total: norms.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/regulatory-audit/readiness
 * Runs all automated checks and returns the full audit readiness report.
 * Results are cached for 5 minutes.  Use ?force=1 to bypass cache.
 */
router.get('/readiness', async (req: Request, res: Response) => {
  try {
    const force = req.query.force === '1';
    const report = await regulatoryAuditNormsService.runAllChecks(force);
    res.json({ success: true, data: report });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/admin/regulatory-audit/check/:normId
 * Runs a single norm check on demand (always live, no cache).
 */
router.post('/check/:normId', async (req: Request, res: Response) => {
  try {
    const { normId } = req.params;
    const result = await regulatoryAuditNormsService.runSingleCheck(normId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const code = err.message.includes('not found') ? 404 : 500;
    res.status(code).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/regulatory-audit/norm/:normId
 * Returns metadata for a single norm.
 */
router.get('/norm/:normId', async (req: Request, res: Response) => {
  try {
    const norm = regulatoryAuditNormsService.getNorm(req.params.normId);
    if (!norm) return res.status(404).json({ success: false, error: 'Norm not found' });
    res.json({ success: true, data: norm });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
