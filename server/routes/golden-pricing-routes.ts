/**
 * Golden Source Pricing Engine — REST API
 *
 * ROUTE ORDER: Specific named paths MUST come before /:isin wildcard
 *
 * GET  /api/pricing/stats                     → daily run statistics
 * GET  /api/pricing/flagged                   → list flagged prices (deviation > 20%) with pagination
 * POST /api/pricing/batch                     → batch lookup (array of ISINs)
 * POST /api/pricing/price-now                 → price a single instrument on demand with explainability
 * POST /api/pricing/override                  → manual price override (admin, SEBI audit)
 * POST /api/pricing/run-daily                 → trigger full daily pricing run (admin)
 * GET  /api/pricing/audit/:isin               → audit log for an ISIN with pagination
 * GET  /api/pricing/:isin/history             → price history (date range) with pagination
 * GET  /api/pricing/:isin                     → latest golden price for an ISIN
 *
 * Layer: Controller / Route (delegates business logic to GoldenPricingEngine)
 * Compliance: FintekPro GCR v1.0 & FASP-AI v1.0
 */

import { Router, type Request, type Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
	priceInstrument,
	runDailyGoldenPricing,
	getGoldenPrice,
	getLatestGoldenPrice,
	batchGetGoldenPrices,
	GOLDEN_PRICING_ENGINE_VERSION,
	type AssetClass,
	type GoldenPriceRow,
} from "../services/golden-pricing/GoldenPricingEngine";
import { logger } from "../logger";

export const goldenPricingRouter = Router();

interface AuthRequest extends Request {
	user?: {
		id: string;
		email?: string;
	};
}

// ── GET /api/pricing/stats — daily run statistics ───────────────────────────
goldenPricingRouter.get("/stats", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { date } = req.query as { date?: string };
	const priceDate = date ?? new Date().toISOString().slice(0, 10);

	try {
		const stats = await db.execute(sql`
      SELECT
        asset_class,
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_validated = true) AS validated,
        COUNT(*) FILTER (WHERE is_flagged = true) AS flagged,
        COUNT(*) FILTER (WHERE is_stale = true) AS stale,
        COUNT(*) FILTER (WHERE source = 'UPSTOX') AS from_upstox,
        COUNT(*) FILTER (WHERE source = 'NSE_BHAVCOPY') AS from_nse,
        COUNT(*) FILTER (WHERE source = 'INDIAN_API') AS from_indian_api,
        COUNT(*) FILTER (WHERE source = 'FMP') AS from_fmp,
        COUNT(*) FILTER (WHERE source = 'AMFI_NAV') AS from_amfi,
        COUNT(*) FILTER (WHERE source = 'YIELD_CURVE') AS from_yield_curve,
        COUNT(*) FILTER (WHERE source = 'MODEL_PRICE') AS from_model,
        COUNT(*) FILTER (WHERE source = 'LAST_TRADE') AS from_last_trade,
        COUNT(*) FILTER (WHERE source = 'YAHOO_FINANCE') AS from_yahoo,
        COUNT(*) FILTER (WHERE source = 'BLACK_SCHOLES') AS from_black_scholes,
        COUNT(*) FILTER (WHERE source = 'BROKER_QUOTE') AS from_broker_quote,
        ROUND(AVG(confidence_score::numeric), 1) AS avg_confidence
      FROM golden_prices WHERE price_date = ${priceDate}
      GROUP BY asset_class
    `);

		const auditCount = await db.execute(sql`
      SELECT COUNT(*) AS total FROM price_audit_log WHERE price_date = ${priceDate}
    `);

		res.json({
			success: true,
			data: {
				date: priceDate,
				byAssetClass: stats.rows,
				auditEntriesTotal: Number.parseInt(
					(auditCount.rows[0] as { total?: string })?.total ?? "0",
					10,
				),
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] Failed to fetch stats", {
			event: "GOLDEN_PRICING_STATS_ERROR",
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICING_STATS_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── GET /api/pricing/flagged — prices flagged for large deviation ────────────
goldenPricingRouter.get("/flagged", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const {
		date,
		page = "1",
		limit = "50",
	} = req.query as {
		date?: string;
		page?: string;
		limit?: string;
	};

	const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
	const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
	const offset = (pageNum - 1) * limitNum;

	try {
		const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total FROM golden_prices WHERE is_flagged = true
      ${date ? sql`AND price_date = ${date}` : sql``}
    `);
		const total = Number.parseInt(
			(countResult.rows[0] as { total?: string })?.total ?? "0",
			10,
		);

		const rows = await db.execute(sql`
      SELECT isin, symbol, price_date, price, previous_price, deviation_pct, flag_reason, source, confidence_score
      FROM golden_prices WHERE is_flagged = true
      ${date ? sql`AND price_date = ${date}` : sql``}
      ORDER BY price_date DESC, ABS(deviation_pct::numeric) DESC
      LIMIT ${limitNum} OFFSET ${offset}
    `);

		res.json({
			success: true,
			data: rows.rows,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages: Math.ceil(total / limitNum),
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] Failed to fetch flagged prices", {
			event: "GOLDEN_PRICING_FLAGGED_ERROR",
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICING_FLAGGED_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── POST /api/pricing/batch — multi-ISIN lookup ─────────────────────────────
goldenPricingRouter.post("/batch", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { isins, date } = req.body as { isins: string[]; date?: string };

	if (!Array.isArray(isins) || isins.length === 0) {
		res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_INPUT",
				message: "isins must be a non-empty array",
				retryable: false,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
		return;
	}
	if (isins.length > 500) {
		res.status(400).json({
			success: false,
			error: {
				error_code: "BATCH_LIMIT_EXCEEDED",
				message: "Maximum 500 ISINs per batch request",
				retryable: false,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
		return;
	}

	try {
		const prices = await batchGetGoldenPrices(isins, date);
		const result: Record<string, ReturnType<typeof formatRow> | null> = {};
		for (const isin of isins) {
			result[isin] = prices[isin] ? formatRow(prices[isin]) : null;
		}

		res.json({
			success: true,
			data: {
				date: date ?? new Date().toISOString().slice(0, 10),
				count: Object.keys(result).length,
				prices: result,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] Batch lookup failed", {
			event: "GOLDEN_PRICING_BATCH_ERROR",
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICING_BATCH_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── POST /api/pricing/price-now — on-demand pricing ─────────────────────────
goldenPricingRouter.post("/price-now", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const {
		isin,
		symbol,
		assetClass = "equity",
		couponRate,
		maturityDate,
		faceValue,
		strikePrice,
		underlying,
		lastRoundPrice,
		date,
		dryRun = false,
	} = req.body as {
		isin: string;
		symbol?: string;
		assetClass?: AssetClass;
		couponRate?: number;
		maturityDate?: string;
		faceValue?: number;
		strikePrice?: number;
		underlying?: string;
		lastRoundPrice?: number;
		date?: string;
		dryRun?: boolean;
	};

	if (!isin) {
		res.status(400).json({
			success: false,
			error: {
				error_code: "MISSING_ISIN",
				message: "isin is required",
				retryable: false,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
		return;
	}

	const priceDate = date ?? new Date().toISOString().slice(0, 10);
	const job = {
		isin,
		symbol,
		assetClass,
		couponRate,
		maturityDate,
		faceValue,
		strikePrice,
		underlying,
		lastRoundPrice,
	};

	try {
		const result = await priceInstrument(job, priceDate, { dryRun });
		if (!result) {
			res.status(422).json({
				success: false,
				error: {
					error_code: "PRICE_DISCOVERY_UNAVAILABLE",
					message: `Could not determine authoritative golden price for ISIN ${isin} on ${priceDate}`,
					retryable: true,
				},
				meta: {
					timestamp: new Date().toISOString(),
					version: GOLDEN_PRICING_ENGINE_VERSION,
				},
			});
			return;
		}

		res.json({
			success: true,
			data: { ...result, dryRun },
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] On-demand pricing error", {
			event: "GOLDEN_PRICING_ON_DEMAND_ERROR",
			isin,
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICING_EXECUTION_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── POST /api/pricing/override — admin manual override (SEBI audit) ─────────
goldenPricingRouter.post("/override", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { isin, priceDate, price, reason, changedBy } = req.body as {
		isin: string;
		priceDate: string;
		price: number;
		reason: string;
		changedBy?: string;
	};

	if (!isin || !priceDate || !price || !reason) {
		res.status(400).json({
			success: false,
			error: {
				error_code: "INVALID_OVERRIDE_PAYLOAD",
				message: "isin, priceDate, price, and reason are mandatory for SEBI audit logging",
				retryable: false,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
		return;
	}

	const actor = changedBy ?? (req as AuthRequest).user?.email ?? "admin";

	try {
		const existing = await db.execute(sql`
      SELECT id, price, source FROM golden_prices WHERE isin = ${isin} AND price_date = ${priceDate} LIMIT 1
    `);
		const ex = existing.rows?.[0] as
			| { price?: string; source?: string }
			| undefined;

		const auditMetadata = {
			engine_version: GOLDEN_PRICING_ENGINE_VERSION,
			action: "MANUAL_PRICE_OVERRIDE",
			actor,
			reason,
			timestamp: new Date().toISOString(),
		};

		if (ex) {
			await db.execute(sql`
        UPDATE golden_prices SET
          price = ${price}, source = 'BROKER_QUOTE', confidence_score = 50,
          is_validated = true, is_flagged = false, flag_reason = NULL,
          metadata = ${JSON.stringify(auditMetadata)}::jsonb, updated_at = NOW()
        WHERE isin = ${isin} AND price_date = ${priceDate}
      `);
			await db.execute(sql`
        INSERT INTO price_audit_log (
          isin, price_date, old_price, new_price, old_source, new_source,
          change_reason, changed_by, confidence_score, metadata
        ) VALUES (
          ${isin}, ${priceDate}, ${ex.price}, ${price}, ${ex.source}, 'BROKER_QUOTE',
          ${reason}, ${actor}, 50, ${JSON.stringify(auditMetadata)}::jsonb
        )
      `);
		} else {
			await db.execute(sql`
        INSERT INTO golden_prices (
          isin, price_date, asset_class, price, source, confidence_score,
          is_validated, is_flagged, currency, metadata
        ) VALUES (
          ${isin}, ${priceDate}, 'equity', ${price}, 'BROKER_QUOTE', 50,
          true, false, 'INR', ${JSON.stringify(auditMetadata)}::jsonb
        )
      `);
			await db.execute(sql`
        INSERT INTO price_audit_log (
          isin, price_date, new_price, new_source, change_reason, changed_by,
          confidence_score, metadata
        ) VALUES (
          ${isin}, ${priceDate}, ${price}, 'BROKER_QUOTE', ${reason}, ${actor},
          50, ${JSON.stringify(auditMetadata)}::jsonb
        )
      `);
		}

		logger.info("[GoldenPricingRoutes] Admin price override committed", {
			event: "PRICE_OVERRIDE_APPLIED",
			isin,
			price_date: priceDate,
			price,
			actor,
		});

		res.json({
			success: true,
			data: {
				isin,
				priceDate,
				price,
				source: "BROKER_QUOTE",
				changedBy: actor,
				reason,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] Override failed", {
			event: "PRICE_OVERRIDE_ERROR",
			isin,
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICE_OVERRIDE_ERROR",
				message: msg,
				retryable: false,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── POST /api/pricing/run-daily — trigger full daily run ────────────────────
goldenPricingRouter.post("/run-daily", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { date, batchSize, delayMs } = req.body as {
		date?: string;
		batchSize?: number;
		delayMs?: number;
	};

	const targetDate = date ?? new Date().toISOString().slice(0, 10);

	// Start daily pricing run in background and return immediate acknowledgement
	runDailyGoldenPricing(targetDate, { batchSize, delayMs })
		.then((result) => {
			logger.info("[GoldenPricingRoutes] Daily run finished", {
				event: "DAILY_RUN_ASYNC_SUCCESS",
				price_date: targetDate,
				succeeded: result.succeeded,
				failed: result.failed,
			});
		})
		.catch((e) => {
			const msg = e instanceof Error ? e.message : String(e);
			logger.error("[GoldenPricingRoutes] Daily run failed", {
				event: "DAILY_RUN_ASYNC_ERROR",
				error: msg,
			});
		});

	res.json({
		success: true,
		data: {
			status: "started",
			date: targetDate,
			message: "Authoritative daily golden pricing run initiated in background",
		},
		meta: {
			timestamp: new Date().toISOString(),
			version: GOLDEN_PRICING_ENGINE_VERSION,
			latency_ms: Date.now() - t0,
		},
	});
});

// ── GET /api/pricing/audit/:isin — SEBI audit trail ─────────────────────────
goldenPricingRouter.get("/audit/:isin", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { isin } = req.params;
	const {
		page = "1",
		limit = "50",
	} = req.query as { page?: string; limit?: string };

	const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
	const limitNum = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
	const offset = (pageNum - 1) * limitNum;

	try {
		const countResult = await db.execute(sql`
      SELECT COUNT(*) AS total FROM price_audit_log WHERE isin = ${isin}
    `);
		const total = Number.parseInt(
			(countResult.rows[0] as { total?: string })?.total ?? "0",
			10,
		);

		const rows = await db.execute(sql`
      SELECT * FROM price_audit_log WHERE isin = ${isin}
      ORDER BY created_at DESC LIMIT ${limitNum} OFFSET ${offset}
    `);

		res.json({
			success: true,
			data: rows.rows,
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages: Math.ceil(total / limitNum),
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] Audit lookup failed", {
			event: "PRICE_AUDIT_LOOKUP_ERROR",
			isin,
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "AUDIT_LOOKUP_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── GET /api/pricing/:isin/history — historical golden prices ───────────────
goldenPricingRouter.get("/:isin/history", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { isin } = req.params;
	const {
		from,
		to,
		page = "1",
		limit = "90",
	} = req.query as {
		from?: string;
		to?: string;
		page?: string;
		limit?: string;
	};

	const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
	const limitNum = Math.min(365, Math.max(1, Number.parseInt(limit, 10) || 90));
	const offset = (pageNum - 1) * limitNum;

	try {
		let countQuery;
		let rowsQuery;

		if (from && to) {
			countQuery = sql`
        SELECT COUNT(*) AS total FROM golden_prices
        WHERE isin = ${isin} AND price_date BETWEEN ${from} AND ${to}
      `;
			rowsQuery = sql`
        SELECT * FROM golden_prices
        WHERE isin = ${isin} AND price_date BETWEEN ${from} AND ${to}
        ORDER BY price_date DESC LIMIT ${limitNum} OFFSET ${offset}
      `;
		} else {
			countQuery = sql`
        SELECT COUNT(*) AS total FROM golden_prices WHERE isin = ${isin}
      `;
			rowsQuery = sql`
        SELECT * FROM golden_prices WHERE isin = ${isin}
        ORDER BY price_date DESC LIMIT ${limitNum} OFFSET ${offset}
      `;
		}

		const countResult = await db.execute(countQuery);
		const total = Number.parseInt(
			(countResult.rows[0] as { total?: string })?.total ?? "0",
			10,
		);
		const rows = await db.execute(rowsQuery);

		res.json({
			success: true,
			data: (rows.rows as any[]).map(formatRow),
			pagination: {
				page: pageNum,
				limit: limitNum,
				total,
				totalPages: Math.ceil(total / limitNum),
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] History lookup failed", {
			event: "PRICE_HISTORY_LOOKUP_ERROR",
			isin,
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICE_HISTORY_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ── GET /api/pricing/:isin — latest golden price ────────────────────────────
// NOTE: This MUST be last among GET routes to avoid capturing /stats, /flagged, /audit
goldenPricingRouter.get("/:isin", async (req: Request, res: Response): Promise<void> => {
	const t0 = Date.now();
	const { isin } = req.params;
	const { date } = req.query as { date?: string };

	try {
		if (date) {
			const row = await getGoldenPrice(isin, date);
			if (!row) {
				res.status(404).json({
					success: false,
					error: {
						error_code: "GOLDEN_PRICE_NOT_FOUND",
						message: `No golden price found for ISIN ${isin} on date ${date}`,
						retryable: false,
					},
					meta: {
						timestamp: new Date().toISOString(),
						version: GOLDEN_PRICING_ENGINE_VERSION,
					},
				});
				return;
			}
			res.json({
				success: true,
				data: { isin, ...formatRow(row as any) },
				meta: {
					timestamp: new Date().toISOString(),
					version: GOLDEN_PRICING_ENGINE_VERSION,
					latency_ms: Date.now() - t0,
				},
			});
			return;
		}

		const row = await getLatestGoldenPrice(isin);
		if (!row) {
			res.status(404).json({
				success: false,
				error: {
					error_code: "GOLDEN_PRICE_NOT_FOUND",
					message: `No golden price found for ISIN ${isin}`,
					retryable: false,
				},
				meta: {
					timestamp: new Date().toISOString(),
					version: GOLDEN_PRICING_ENGINE_VERSION,
				},
			});
			return;
		}
		res.json({
			success: true,
			data: { isin, ...formatRow(row) },
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
				latency_ms: Date.now() - t0,
			},
		});
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		logger.error("[GoldenPricingRoutes] ISIN lookup error", {
			event: "PRICE_LOOKUP_ERROR",
			isin,
			error: msg,
		});
		res.status(500).json({
			success: false,
			error: {
				error_code: "PRICE_LOOKUP_ERROR",
				message: msg,
				retryable: true,
			},
			meta: {
				timestamp: new Date().toISOString(),
				version: GOLDEN_PRICING_ENGINE_VERSION,
			},
		});
	}
});

// ─── Row Formatter Helper ─────────────────────────────────────────────────────

function formatRow(r: GoldenPriceRow) {
	return {
		date: r.price_date ?? (r as any).priceDate,
		assetClass: r.asset_class ?? (r as any).assetClass,
		price: r.price ? Number.parseFloat(String(r.price)) : null,
		open: r.open_price ? Number.parseFloat(String(r.open_price)) : null,
		high: r.high_price ? Number.parseFloat(String(r.high_price)) : null,
		low: r.low_price ? Number.parseFloat(String(r.low_price)) : null,
		volume: r.volume ? Number.parseFloat(String(r.volume)) : null,
		changePercent: r.change_percent
			? Number.parseFloat(String(r.change_percent))
			: null,
		source: r.source,
		confidence: r.confidence_score ?? (r as any).confidence,
		isValidated: r.is_validated ?? (r as any).isValidated,
		isFlagged: r.is_flagged ?? (r as any).isFlagged,
		flagReason: r.flag_reason ?? (r as any).flagReason,
		previousPrice: r.previous_price
			? Number.parseFloat(String(r.previous_price))
			: null,
		deviationPct: r.deviation_pct
			? Number.parseFloat(String(r.deviation_pct))
			: null,
		currency: r.currency ?? "INR",
		metadata: r.metadata,
		updatedAt: r.updated_at ?? (r as any).updatedAt,
	};
}

export default goldenPricingRouter;
