import { Express, Request, Response } from 'express';
import { sandboxTDSService } from '../sandbox-tds-service';

/**
 * Sandbox IT Report APIs (Gap 4)
 * Async Tax P&L and Capital Gains reports — Excel / JSON output.
 *
 * Pattern: POST to submit a job → returns { job_id }
 *          GET ?job_id= to poll → when status==="succeeded", data.report_url is the download link.
 *
 * IT Act sections covered:
 *  - Tax P&L: intraday, F&O, speculative / non-speculative income
 *  - Capital Gains: LTCG (section 112A for equity >₹1L), STCG (section 111A), debt LTCG/STCG (section 112)
 */
export function registerSandboxITReportRoutes(app: Express): void {

  // ============================================================
  // IT REPORT — TAX PROFIT & LOSS (JOB-BASED)
  // ============================================================

  /**
   * POST /api/it/report/tax-profit-loss
   * Submit async Tax P&L report job.
   * Body: { pan, financialYear, outputFormat?, includeIntraday?, includeFno? }
   *   pan           — PAN of the taxpayer
   *   financialYear — e.g. "FY 2024-25"
   *   outputFormat  — "json" (default) | "excel"
   *   includeIntraday — include intraday/speculative P&L (default: true)
   *   includeFno    — include F&O P&L (default: true)
   * Returns: { job_id, status }
   */
  app.post('/api/it/report/tax-profit-loss', async (req: Request, res: Response) => {
    try {
      const { pan, financialYear, outputFormat, includeIntraday, includeFno } = req.body;
      if (!pan || !financialYear) {
        return res.status(400).json({ success: false, message: 'pan and financialYear are required' });
      }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        return res.status(400).json({ success: false, message: 'Invalid PAN format (e.g. ABCDE1234F)' });
      }
      if (outputFormat && !['json', 'excel'].includes(outputFormat)) {
        return res.status(400).json({ success: false, message: 'outputFormat must be "json" or "excel"' });
      }
      const result = await sandboxTDSService.submitTaxPLReportJob({
        pan,
        financialYear,
        outputFormat: outputFormat ?? 'json',
        includeIntraday: includeIntraday !== false,
        includeFno: includeFno !== false,
      });
      return res.json(result);
    } catch (error) {
      console.error('[IT Report Tax P&L] submit job error:', error);
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to submit Tax P&L report job' });
    }
  });

  /**
   * GET /api/it/report/tax-profit-loss?job_id=...
   * Poll Tax P&L report job status.
   * Returns job data; when status==="succeeded" → data.report_url is the download link.
   */
  app.get('/api/it/report/tax-profit-loss', async (req: Request, res: Response) => {
    try {
      const { job_id } = req.query;
      if (!job_id) {
        return res.status(400).json({ success: false, message: 'job_id query param is required' });
      }
      const result = await sandboxTDSService.pollTaxPLReportJob(String(job_id));
      return res.json(result);
    } catch (error) {
      console.error('[IT Report Tax P&L] poll job error:', error);
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to poll Tax P&L report job' });
    }
  });

  // ============================================================
  // IT REPORT — CAPITAL GAINS (JOB-BASED)
  // ============================================================

  /**
   * POST /api/it/report/capital-gains
   * Submit async Capital Gains report job.
   * Body: { pan, financialYear, outputFormat?, assetClasses? }
   *   pan           — PAN of the taxpayer
   *   financialYear — e.g. "FY 2024-25"
   *   outputFormat  — "json" (default) | "excel"
   *   assetClasses  — optional filter e.g. ["equity", "debt", "mutual_fund", "us_stocks", "crypto"]
   *                   omit to include all asset classes
   * Covers:
   *   LTCG equity > ₹1L taxed at 12.5% (section 112A)
   *   STCG equity taxed at 20% (section 111A)
   *   Debt LTCG/STCG per holding period (section 112)
   *   US stocks: taxed as per India-US DTAA
   *   Crypto: 30% flat + 1% TDS (section 115BBH / 194S)
   * Returns: { job_id, status }
   */
  app.post('/api/it/report/capital-gains', async (req: Request, res: Response) => {
    try {
      const { pan, financialYear, outputFormat, assetClasses } = req.body;
      if (!pan || !financialYear) {
        return res.status(400).json({ success: false, message: 'pan and financialYear are required' });
      }
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(pan)) {
        return res.status(400).json({ success: false, message: 'Invalid PAN format (e.g. ABCDE1234F)' });
      }
      if (outputFormat && !['json', 'excel'].includes(outputFormat)) {
        return res.status(400).json({ success: false, message: 'outputFormat must be "json" or "excel"' });
      }
      const result = await sandboxTDSService.submitCapitalGainsReportJob({
        pan,
        financialYear,
        outputFormat: outputFormat ?? 'json',
        ...(Array.isArray(assetClasses) && assetClasses.length > 0 && { assetClasses }),
      });
      return res.json(result);
    } catch (error) {
      console.error('[IT Report Capital Gains] submit job error:', error);
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to submit Capital Gains report job' });
    }
  });

  /**
   * GET /api/it/report/capital-gains?job_id=...
   * Poll Capital Gains report job status.
   * Returns job data; when status==="succeeded" → data.report_url is the download link.
   */
  app.get('/api/it/report/capital-gains', async (req: Request, res: Response) => {
    try {
      const { job_id } = req.query;
      if (!job_id) {
        return res.status(400).json({ success: false, message: 'job_id query param is required' });
      }
      const result = await sandboxTDSService.pollCapitalGainsReportJob(String(job_id));
      return res.json(result);
    } catch (error) {
      console.error('[IT Report Capital Gains] poll job error:', error);
      return res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to poll Capital Gains report job' });
    }
  });

  // ============================================================
  // STATUS — IT REPORT API HEALTH
  // ============================================================

  /**
   * GET /api/it/report/status
   * Returns whether Sandbox IT Report credentials are configured + all endpoint list.
   */
  app.get('/api/it/report/status', (_req: Request, res: Response) => {
    res.json({
      configured: sandboxTDSService.isConfigured(),
      endpoints: {
        tax_pl: [
          'POST /api/it/report/tax-profit-loss',
          'GET  /api/it/report/tax-profit-loss?job_id=',
        ],
        capital_gains: [
          'POST /api/it/report/capital-gains',
          'GET  /api/it/report/capital-gains?job_id=',
        ],
      },
      notes: [
        'outputFormat: "json" (default) or "excel" — Excel returns signed S3 URL',
        'Capital Gains covers: equity (s.112A/111A), debt (s.112), US stocks (DTAA), crypto (s.115BBH)',
        'Tax P&L covers: intraday, F&O speculative / non-speculative business income',
        'Jobs are async — poll every 5-10s until status === "succeeded"',
      ],
    });
  });

  console.log('✅ IT Report routes registered (Tax P&L + Capital Gains async reports)');
}
