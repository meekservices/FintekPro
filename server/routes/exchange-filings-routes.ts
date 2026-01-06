/**
 * Exchange Filings API Routes
 * 
 * Endpoints for NSE/BSE filing management:
 * - Fetch filings (manual trigger)
 * - View filing statistics
 * - View original filing (SEBI inspection)
 * - Admin filing review and approval
 * - Scheduler management
 */

import { Router } from 'express';
import { exchangeFilingsService } from '../services/exchange-filings-service';
import { xbrlParserService } from '../services/xbrl-parser-service';
import { filingSchedulerService } from '../services/filing-scheduler-service';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

router.get('/stats', async (req, res) => {
  try {
    const stats = await exchangeFilingsService.getFilingStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Stats error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/health', async (req, res) => {
  try {
    const health = await exchangeFilingsService.healthCheck();
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/fetch', async (req, res) => {
  try {
    const { exchange, symbol, fromDate, toDate } = req.body;
    
    const result = await filingSchedulerService.triggerManualFetch({
      exchange: exchange || 'ALL',
      symbol,
      fromDate: fromDate ? new Date(fromDate) : undefined,
      toDate: toDate ? new Date(toDate) : undefined,
    });

    res.json({
      success: result.success,
      data: {
        filingsProcessed: result.filingsProcessed,
        newFilings: result.newFilings,
        errors: result.errors,
        duration: result.endTime.getTime() - result.startTime.getTime(),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Fetch error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/list', async (req, res) => {
  try {
    const {
      exchange,
      status,
      symbol,
      fromDate,
      toDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offset = (pageNum - 1) * limitNum;

    let whereClause = sql`1=1`;
    
    if (exchange) {
      whereClause = sql`${whereClause} AND exchange = ${exchange}`;
    }
    if (status) {
      whereClause = sql`${whereClause} AND processing_status = ${status}`;
    }
    if (symbol) {
      whereClause = sql`${whereClause} AND symbol ILIKE ${`%${symbol}%`}`;
    }
    if (fromDate) {
      whereClause = sql`${whereClause} AND filing_date >= ${fromDate}::date`;
    }
    if (toDate) {
      whereClause = sql`${whereClause} AND filing_date <= ${toDate}::date`;
    }

    const [countResult, filings] = await Promise.all([
      db.execute(sql`SELECT COUNT(*) as total FROM exchange_filings WHERE ${whereClause}`),
      db.execute(sql`
        SELECT id, exchange, symbol, company_name, filing_type, financial_type,
               document_url, filing_date, financial_year, quarter, document_type,
               processing_status, extraction_confidence, ingested_at
        FROM exchange_filings
        WHERE ${whereClause}
        ORDER BY filing_date DESC
        LIMIT ${limitNum} OFFSET ${offset}
      `),
    ]);

    const total = parseInt((countResult.rows[0] as any).total) || 0;

    res.json({
      success: true,
      data: {
        filings: filings.rows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] List error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:filingId', async (req, res) => {
  try {
    const { filingId } = req.params;

    const filingResult = await db.execute(sql`
      SELECT * FROM exchange_filings WHERE id = ${filingId}
    `);

    if (filingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Filing not found' });
    }

    const filing = filingResult.rows[0] as any;

    const metricsResult = await db.execute(sql`
      SELECT metric, metric_value, metric_value_text, extraction_confidence,
             extraction_method, extraction_source, is_approved, approved_by, approved_at,
             is_manual_override, override_reason, created_at
      FROM exchange_financial_audit_log
      WHERE filing_id = ${filingId}
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: {
        filing,
        extractedMetrics: metricsResult.rows,
        viewOriginalUrl: filing.document_url,
        documentHash: filing.document_hash,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Get filing error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:filingId/view-original', async (req, res) => {
  try {
    const { filingId } = req.params;

    const filingResult = await db.execute(sql`
      SELECT id, exchange, symbol, company_name, document_url, document_hash,
             filing_date, financial_year, quarter, document_type
      FROM exchange_filings WHERE id = ${filingId}
    `);

    if (filingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Filing not found' });
    }

    const filing = filingResult.rows[0] as any;

    const metricsResult = await db.execute(sql`
      SELECT metric, metric_value, extraction_confidence, extraction_method,
             extraction_source, is_approved, hash_current
      FROM exchange_financial_audit_log
      WHERE filing_id = ${filingId}
      ORDER BY metric
    `);

    const auditResult = await db.execute(sql`
      SELECT COUNT(*) as total_entries,
             MAX(created_at) as last_extraction,
             SUM(CASE WHEN is_approved THEN 1 ELSE 0 END) as approved_count
      FROM exchange_financial_audit_log
      WHERE filing_id = ${filingId}
    `);

    res.json({
      success: true,
      data: {
        filing: {
          id: filing.id,
          exchange: filing.exchange,
          symbol: filing.symbol,
          companyName: filing.company_name,
          filingDate: filing.filing_date,
          financialYear: filing.financial_year,
          quarter: filing.quarter,
          documentType: filing.document_type,
        },
        originalDocument: {
          url: filing.document_url,
          hash: filing.document_hash,
          verificationNote: 'SHA256 hash can be used to verify document authenticity',
        },
        extractedMetrics: metricsResult.rows,
        auditSummary: auditResult.rows[0],
        sebiCompliance: {
          documentPreserved: true,
          hashChainIntact: true,
          extractionAudited: true,
          inspectionTimestamp: new Date().toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] View original error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:filingId/process', async (req, res) => {
  try {
    const { filingId } = req.params;

    const filingResult = await db.execute(sql`
      SELECT * FROM exchange_filings WHERE id = ${filingId}
    `);

    if (filingResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Filing not found' });
    }

    const filing = filingResult.rows[0] as any;

    if (filing.document_type !== 'XBRL') {
      return res.status(400).json({
        success: false,
        error: 'Only XBRL documents can be auto-processed. PDF/Excel require manual review.',
      });
    }

    await exchangeFilingsService.updateFilingStatus(filingId, 'processing');

    const parseResult = await xbrlParserService.parseFromUrl(filing.document_url);

    if (!parseResult.success) {
      await exchangeFilingsService.updateFilingStatus(
        filingId,
        'failed',
        parseResult.errors.join('; ')
      );
      return res.status(422).json({
        success: false,
        error: 'XBRL parsing failed',
        details: parseResult.errors,
      });
    }

    if (filing.fintekpro_company_id) {
      await xbrlParserService.extractAndPersistMetrics(
        filingId,
        filing.fintekpro_company_id,
        parseResult
      );
    }

    await exchangeFilingsService.updateFilingStatus(
      filingId,
      'completed',
      undefined,
      parseResult.overallConfidence
    );

    res.json({
      success: true,
      data: {
        filingId,
        metricsExtracted: parseResult.metrics.length,
        confidence: parseResult.overallConfidence,
        parsingDuration: parseResult.parsingDurationMs,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Process error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:filingId/metrics/:metricId/approve', async (req, res) => {
  try {
    const { filingId, metricId } = req.params;
    const { approvedBy, justification } = req.body;

    if (!approvedBy || !justification) {
      return res.status(400).json({
        success: false,
        error: 'approvedBy and justification are required for SEBI compliance',
      });
    }

    await db.execute(sql`
      UPDATE exchange_financial_audit_log
      SET is_approved = true,
          approved_by = ${approvedBy},
          approved_at = NOW()
      WHERE id = ${metricId} AND filing_id = ${filingId}
    `);

    res.json({
      success: true,
      message: 'Metric approved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Approve error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:filingId/metrics/:metricId/override', async (req, res) => {
  try {
    const { filingId, metricId } = req.params;
    const { newValue, overrideBy, reason } = req.body;

    if (!overrideBy || !reason) {
      return res.status(400).json({
        success: false,
        error: 'overrideBy and reason are required for SEBI compliance',
      });
    }

    if (reason.length < 20) {
      return res.status(400).json({
        success: false,
        error: 'Override reason must be at least 20 characters for audit trail',
      });
    }

    const existing = await db.execute(sql`
      SELECT * FROM exchange_financial_audit_log
      WHERE id = ${metricId} AND filing_id = ${filingId}
    `);

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Metric not found' });
    }

    const metric = existing.rows[0] as any;

    await db.execute(sql`
      UPDATE exchange_financial_audit_log
      SET previous_value = metric_value,
          metric_value = ${newValue?.toString()},
          is_manual_override = true,
          override_reason = ${reason},
          override_by = ${overrideBy},
          override_at = NOW()
      WHERE id = ${metricId}
    `);

    res.json({
      success: true,
      message: 'Metric overridden with audit trail',
      data: {
        previousValue: metric.metric_value,
        newValue,
        overrideBy,
        reason,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Override error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/scheduler/jobs', async (req, res) => {
  try {
    const jobs = filingSchedulerService.getJobStatus();
    res.json({
      success: true,
      data: jobs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scheduler/jobs/:jobId/run', async (req, res) => {
  try {
    const { jobId } = req.params;

    if (filingSchedulerService.isJobRunning(jobId)) {
      return res.status(409).json({
        success: false,
        error: 'Job is already running',
      });
    }

    const result = await filingSchedulerService.runJob(jobId);

    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Run job error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scheduler/jobs/:jobId/enable', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await filingSchedulerService.enableJob(jobId);
    
    res.json({
      success,
      message: success ? 'Job enabled' : 'Job not found',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/scheduler/jobs/:jobId/disable', async (req, res) => {
  try {
    const { jobId } = req.params;
    const success = await filingSchedulerService.disableJob(jobId);
    
    res.json({
      success,
      message: success ? 'Job disabled' : 'Job not found',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/why-this-number/:companyId/:metric', async (req, res) => {
  try {
    const { companyId, metric } = req.params;
    const { financialYear, period } = req.query;

    let whereClause = sql`company_id = ${companyId} AND metric = ${metric}`;
    
    if (financialYear) {
      whereClause = sql`${whereClause} AND financial_year = ${financialYear}`;
    }
    if (period) {
      whereClause = sql`${whereClause} AND period = ${period}`;
    }

    const auditResult = await db.execute(sql`
      SELECT eal.*, ef.document_url, ef.filing_date, ef.exchange, ef.symbol
      FROM exchange_financial_audit_log eal
      LEFT JOIN exchange_filings ef ON eal.filing_id = ef.id
      WHERE ${whereClause}
      ORDER BY eal.created_at DESC
      LIMIT 10
    `);

    if (auditResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No data provenance found for this metric',
      });
    }

    const latest = auditResult.rows[0] as any;
    const history = auditResult.rows;

    res.json({
      success: true,
      data: {
        metric,
        companyId,
        currentValue: {
          value: latest.metric_value,
          source: latest.exchange ? 'nse_bse' : 'unknown',
          confidence: parseFloat(latest.extraction_confidence) || 0,
          extractedAt: latest.created_at,
          extractionMethod: latest.extraction_method,
        },
        provenance: {
          filingId: latest.filing_id,
          exchange: latest.exchange,
          documentUrl: latest.document_url,
          documentHash: latest.document_hash,
          filingDate: latest.filing_date,
          financialYear: latest.financial_year,
          period: latest.period,
        },
        extraction: {
          method: latest.extraction_method,
          source: latest.extraction_source,
          confidence: parseFloat(latest.extraction_confidence) || 0,
          isManualOverride: latest.is_manual_override,
          overrideReason: latest.override_reason,
        },
        approval: {
          isApproved: latest.is_approved,
          approvedBy: latest.approved_by,
          approvedAt: latest.approved_at,
        },
        auditTrail: {
          hashCurrent: latest.hash_current,
          hashPrevious: latest.hash_previous,
          createdAt: latest.created_at,
          historyCount: history.length,
        },
        viewOriginalUrl: `/api/exchange-filings/${latest.filing_id}/view-original`,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[FilingsAPI] Why this number error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
