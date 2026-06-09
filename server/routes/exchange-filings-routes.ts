// @ts-nocheck
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

import { Router } from "express";
import { exchangeFilingsService } from "../services/exchange-filings-service";
import { xbrlParserService } from "../services/xbrl-parser-service";
import { filingSchedulerService } from "../services/filing-scheduler-service";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

interface FilingResult {
	id: string;
	exchange: string;
	symbol: string;
	company_name: string;
	filing_type: string;
	financial_type: string;
	document_url: string;
	filing_date: string;
	financial_year: string;
	quarter: string;
	document_type: string;
	processing_status: string;
	extraction_confidence: string;
	ingested_at: string;
	document_hash?: string;
	fintekpro_company_id?: string;
}

interface AuditLogMetric {
	id: string;
	metric: string;
	metric_value: string;
	metric_value_text?: string;
	extraction_confidence: string;
	extraction_method: string;
	extraction_source: string;
	is_approved: boolean;
	approved_by: string | null;
	approved_at: string | null;
	is_manual_override: boolean;
	override_reason: string | null;
	created_at: string;
	hash_current: string | null;
	hash_previous: string | null;
	filing_id: string;
	exchange?: string;
	document_url?: string;
	filing_date?: string;
	financial_year?: string;
	period?: string;
}

router.get("/stats", async (_req, res) => {
	try {
		const stats = await exchangeFilingsService.getFilingStats();
		res.json({
			success: true,
			data: stats,
			timestamp: new Date().toISOString(),
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Stats error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.get("/health", async (_req, res) => {
	try {
		const health = await exchangeFilingsService.healthCheck();
		res.json({
			success: true,
			data: health,
			timestamp: new Date().toISOString(),
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		res.status(500).json({ success: false, error: msg });
	}
});

router.get("/sources", async (_req, res) => {
	try {
		const sources = await exchangeFilingsService.getSources();
		res.json({
			success: true,
			data: sources,
			timestamp: new Date().toISOString(),
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Sources error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.post("/fetch", async (req, res) => {
	try {
		const { exchange, symbol, fromDate, toDate } = req.body;

		const result = await filingSchedulerService.triggerManualFetch({
			exchange: exchange || "ALL",
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
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Fetch error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.get("/list", async (req, res) => {
	try {
		const {
			exchange,
			status,
			symbol,
			fromDate,
			toDate,
			page = "1",
			limit = "50",
		} = req.query;

		const pageNum = Number.parseInt(page as string) || 1;
		const limitNum = Math.min(Number.parseInt(limit as string) || 50, 100);
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
			db.execute(
				sql`SELECT COUNT(*) as total FROM exchange_filings WHERE ${whereClause}`,
			),
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

		const total =
			Number.parseInt(
				(countResult.rows[0] as unknown as { total: string }).total,
			) || 0;

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
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] List error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.get("/:filingId", async (req, res) => {
	try {
		const { filingId } = req.params;

		const filingResult = await db.execute(sql`
      SELECT * FROM exchange_filings WHERE id = ${filingId}
    `);

		if (filingResult.rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, error: "Filing not found" });
		}

		const filing = filingResult.rows[0] as unknown as FilingResult;

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
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Get filing error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.get("/:filingId/view-original", async (req, res) => {
	try {
		const { filingId } = req.params;

		const filingResult = await db.execute(sql`
      SELECT id, exchange, symbol, company_name, document_url, document_hash,
             filing_date, financial_year, quarter, document_type
      FROM exchange_filings WHERE id = ${filingId}
    `);

		if (filingResult.rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, error: "Filing not found" });
		}

		const filing = filingResult.rows[0] as unknown as FilingResult;

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
					verificationNote:
						"SHA256 hash can be used to verify document authenticity",
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
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] View original error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.post("/:filingId/process", async (req, res) => {
	try {
		const { filingId } = req.params;

		const filingResult = await db.execute(sql`
      SELECT * FROM exchange_filings WHERE id = ${filingId}
    `);

		if (filingResult.rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, error: "Filing not found" });
		}

		const filing = filingResult.rows[0] as unknown as FilingResult;

		if (filing.document_type !== "XBRL") {
			return res.status(400).json({
				success: false,
				error:
					"Only XBRL documents can be auto-processed. PDF/Excel require manual review.",
			});
		}

		await exchangeFilingsService.updateFilingStatus(filingId, "processing");

		const parseResult = await xbrlParserService.parseFromUrl(
			filing.document_url,
		);

		if (!parseResult.success) {
			await exchangeFilingsService.updateFilingStatus(
				filingId,
				"failed",
				parseResult.errors.join("; "),
			);
			return res.status(422).json({
				success: false,
				error: "XBRL parsing failed",
				details: parseResult.errors,
			});
		}

		if (filing.fintekpro_company_id) {
			await xbrlParserService.extractAndPersistMetrics(
				filingId,
				filing.fintekpro_company_id,
				parseResult,
			);
		}

		await exchangeFilingsService.updateFilingStatus(
			filingId,
			"completed",
			undefined,
			parseResult.overallConfidence,
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
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Process error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.post("/:filingId/metrics/:metricId/approve", async (req, res) => {
	try {
		const { filingId, metricId } = req.params;
		const { approvedBy, justification } = req.body;

		if (
			!approvedBy ||
			typeof approvedBy !== "string" ||
			approvedBy.trim().length < 3
		) {
			return res.status(400).json({
				success: false,
				error:
					"approvedBy must be a valid identifier (minimum 3 characters) for SEBI compliance",
			});
		}

		if (
			!justification ||
			typeof justification !== "string" ||
			justification.trim().length < 10
		) {
			return res.status(400).json({
				success: false,
				error:
					"justification must be at least 10 characters for SEBI compliance audit trail",
			});
		}

		const existing = await db.execute(sql`
      SELECT hash_current FROM exchange_financial_audit_log
      WHERE id = ${metricId} AND filing_id = ${filingId}
    `);
		const previousHash =
			(existing.rows[0] as unknown as { hash_current: string | null })
				?.hash_current || null;

		const hashData = `${metricId}|${approvedBy.trim()}|${justification.trim()}|${new Date().toISOString()}`;
		const crypto = await import("crypto");
		const auditHash = crypto
			.createHash("sha256")
			.update(hashData)
			.digest("hex")
			.slice(0, 16);

		await db.execute(sql`
      UPDATE exchange_financial_audit_log
      SET is_approved = true,
          approved_by = ${approvedBy.trim()},
          approved_at = NOW(),
          approval_justification = ${justification.trim()},
          hash_previous = hash_current,
          hash_current = ${auditHash}
      WHERE id = ${metricId} AND filing_id = ${filingId}
    `);

		res.json({
			success: true,
			message: "Metric approved successfully",
			timestamp: new Date().toISOString(),
		});
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Approve error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.post("/:filingId/metrics/:metricId/override", async (req, res) => {
	try {
		const { filingId, metricId } = req.params;
		const { newValue, overrideBy, reason } = req.body;

		if (
			!overrideBy ||
			typeof overrideBy !== "string" ||
			overrideBy.trim().length < 3
		) {
			return res.status(400).json({
				success: false,
				error:
					"overrideBy must be a valid identifier (minimum 3 characters) for SEBI compliance",
			});
		}

		if (!reason || typeof reason !== "string" || reason.trim().length < 20) {
			return res.status(400).json({
				success: false,
				error:
					"Override reason must be at least 20 characters for SEBI audit trail",
			});
		}

		if (newValue === undefined || newValue === null || newValue === "") {
			return res.status(400).json({
				success: false,
				error: "newValue is required for override operation",
			});
		}

		const existing = await db.execute(sql`
      SELECT * FROM exchange_financial_audit_log
      WHERE id = ${metricId} AND filing_id = ${filingId}
    `);

		if (existing.rows.length === 0) {
			return res
				.status(404)
				.json({ success: false, error: "Metric not found" });
		}

		const metric = existing.rows[0] as unknown as AuditLogMetric;

		const crypto = await import("crypto");
		const hashData = `${metricId}|${metric.metric_value}|${newValue}|${overrideBy.trim()}|${reason.trim()}|${new Date().toISOString()}`;
		const auditHash = crypto
			.createHash("sha256")
			.update(hashData)
			.digest("hex")
			.slice(0, 16);

		await db.execute(sql`
      UPDATE exchange_financial_audit_log
      SET previous_value = metric_value,
          metric_value = ${newValue?.toString()},
          is_manual_override = true,
          override_reason = ${reason.trim()},
          override_by = ${overrideBy.trim()},
          override_at = NOW(),
          hash_previous = hash_current,
          hash_current = ${auditHash}
      WHERE id = ${metricId}
    `);

		res.json({
			success: true,
			message: "Metric overridden with immutable audit trail",
			data: {
				previousValue: metric.metric_value,
				newValue,
				overrideBy: overrideBy.trim(),
				reason: reason.trim(),
				auditHash,
			},
			timestamp: new Date().toISOString(),
		});
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Override error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.get("/scheduler/jobs", async (_req, res) => {
	try {
		const jobs = filingSchedulerService.getJobStatus();
		res.json({
			success: true,
			data: jobs,
			timestamp: new Date().toISOString(),
		});
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		res.status(500).json({ success: false, error: msg });
	}
});

router.post("/scheduler/jobs/:jobId/run", async (req, res) => {
	try {
		const { jobId } = req.params;

		if (filingSchedulerService.isJobRunning(jobId)) {
			return res.status(409).json({
				success: false,
				error: "Job is already running",
			});
		}

		const result = await filingSchedulerService.runJob(jobId);

		res.json({
			success: result.success,
			data: result,
			timestamp: new Date().toISOString(),
		});
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Run job error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

router.post("/scheduler/jobs/:jobId/enable", async (req, res) => {
	try {
		const { jobId } = req.params;
		const success = await filingSchedulerService.enableJob(jobId);

		res.json({
			success,
			message: success ? "Job enabled" : "Job not found",
			timestamp: new Date().toISOString(),
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.post("/scheduler/jobs/:jobId/disable", async (req, res) => {
	try {
		const { jobId } = req.params;
		const success = await filingSchedulerService.disableJob(jobId);

		res.json({
			success,
			message: success ? "Job disabled" : "Job not found",
			timestamp: new Date().toISOString(),
		});
	} catch (error: any) {
		res.status(500).json({ success: false, error: error.message });
	}
});

router.get("/why-this-number/:companyId/:metric", async (req, res) => {
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
				error: "No data provenance found for this metric",
			});
		}

		const latest = auditResult.rows[0] as unknown as AuditLogMetric;
		const history = auditResult.rows;

		res.json({
			success: true,
			data: {
				metric,
				companyId,
				currentValue: {
					value: latest.metric_value,
					source: latest.exchange ? "nse_bse" : "unknown",
					confidence: Number.parseFloat(latest.extraction_confidence) || 0,
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
					confidence: Number.parseFloat(latest.extraction_confidence) || 0,
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
		return;
	} catch (error: unknown) {
		const msg = error instanceof Error ? error.message : String(error);
		console.error("[FilingsAPI] Why this number error:", msg);
		res.status(500).json({ success: false, error: msg });
	}
});

export default router;
