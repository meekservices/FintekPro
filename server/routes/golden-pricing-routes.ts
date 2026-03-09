/**
 * Golden Source Pricing Engine — REST API
 *
 * ROUTE ORDER: Specific named paths MUST come before /:isin wildcard
 *
 * GET  /api/pricing/stats                     → daily run statistics
 * GET  /api/pricing/flagged                   → list flagged prices (deviation > 20%)
 * POST /api/pricing/batch                     → batch lookup (array of ISINs)
 * POST /api/pricing/price-now                 → price a single instrument on demand
 * POST /api/pricing/override                  → manual price override (admin, SEBI audit)
 * POST /api/pricing/run-daily                 → trigger full daily pricing run (admin)
 * GET  /api/pricing/audit/:isin               → audit log for an ISIN
 * GET  /api/pricing/:isin/history             → price history (date range)
 * GET  /api/pricing/:isin                     → latest golden price for an ISIN
 */

import { Router } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  priceInstrument,
  runDailyGoldenPricing,
  getGoldenPrice,
  getLatestGoldenPrice,
  batchGetGoldenPrices,
  type AssetClass,
} from "../services/golden-pricing/GoldenPricingEngine";

const router = Router();

// ── GET /api/pricing/stats — daily run statistics ───────────────────────────
router.get("/stats", async (req, res) => {
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
        COUNT(*) FILTER (WHERE source = 'NSE_BHAVCOPY') AS from_nse,
        COUNT(*) FILTER (WHERE source = 'FMP') AS from_fmp,
        COUNT(*) FILTER (WHERE source = 'AMFI_NAV') AS from_amfi,
        COUNT(*) FILTER (WHERE source = 'YIELD_CURVE') AS from_yield_curve,
        COUNT(*) FILTER (WHERE source = 'MODEL_PRICE') AS from_model,
        COUNT(*) FILTER (WHERE source = 'LAST_TRADE') AS from_last_trade,
        COUNT(*) FILTER (WHERE source = 'PROBE42') AS from_probe42,
        COUNT(*) FILTER (WHERE source = 'BLACK_SCHOLES') AS from_black_scholes,
        COUNT(*) FILTER (WHERE source = 'BROKER_QUOTE') AS from_broker_quote,
        ROUND(AVG(confidence_score::numeric), 1) AS avg_confidence
      FROM golden_prices WHERE price_date = ${priceDate}
      GROUP BY asset_class
    `);

    const auditCount = await db.execute(sql`
      SELECT COUNT(*) AS total FROM price_audit_log WHERE price_date = ${priceDate}
    `);

    return res.json({
      date: priceDate,
      byAssetClass: stats.rows,
      auditEntriesTotal: parseInt((auditCount.rows[0] as any)?.total ?? "0"),
    });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── GET /api/pricing/flagged — prices flagged for large deviation ────────────
router.get("/flagged", async (req, res) => {
  const { date, limit = "100" } = req.query as { date?: string; limit?: string };

  try {
    const rows = await db.execute(sql`
      SELECT isin, symbol, price_date, price, previous_price, deviation_pct, flag_reason, source, confidence_score
      FROM golden_prices WHERE is_flagged = true
      ${date ? sql`AND price_date = ${date}` : sql``}
      ORDER BY price_date DESC, ABS(deviation_pct::numeric) DESC
      LIMIT ${parseInt(limit)}
    `);
    return res.json({ count: rows.rows.length, flagged: rows.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── POST /api/pricing/batch — multi-ISIN lookup ─────────────────────────────
router.post("/batch", async (req, res) => {
  const { isins, date } = req.body as { isins: string[]; date?: string };

  if (!Array.isArray(isins) || isins.length === 0) {
    return res.status(400).json({ error: "isins must be a non-empty array" });
  }
  if (isins.length > 200) {
    return res.status(400).json({ error: "Maximum 200 ISINs per batch request" });
  }

  try {
    const prices = await batchGetGoldenPrices(isins, date);
    const result: Record<string, any> = {};
    for (const isin of isins) {
      result[isin] = prices[isin] ? formatRow(prices[isin]) : null;
    }
    return res.json({ date: date ?? new Date().toISOString().slice(0, 10), count: Object.keys(result).length, prices: result });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── POST /api/pricing/price-now — on-demand pricing ─────────────────────────
router.post("/price-now", async (req, res) => {
  const {
    isin, symbol, assetClass = "equity",
    couponRate, maturityDate, faceValue, strikePrice, underlying, lastRoundPrice,
    date, dryRun = false,
  } = req.body as {
    isin: string; symbol?: string; assetClass?: AssetClass;
    couponRate?: number; maturityDate?: string; faceValue?: number;
    strikePrice?: number; underlying?: string; lastRoundPrice?: number;
    date?: string; dryRun?: boolean;
  };

  if (!isin) return res.status(400).json({ error: "isin is required" });

  const priceDate = date ?? new Date().toISOString().slice(0, 10);
  const job = { isin, symbol, assetClass, couponRate, maturityDate, faceValue, strikePrice, underlying, lastRoundPrice };

  try {
    const result = await priceInstrument(job, priceDate, { dryRun });
    if (!result) return res.status(422).json({ error: "Could not determine price from any source" });
    return res.json({ ...result, dryRun });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── POST /api/pricing/override — admin manual override (SEBI audit) ─────────
router.post("/override", async (req, res) => {
  const { isin, priceDate, price, reason, changedBy } = req.body as {
    isin: string; priceDate: string; price: number; reason: string; changedBy?: string;
  };

  if (!isin || !priceDate || !price || !reason) {
    return res.status(400).json({ error: "isin, priceDate, price, and reason are required" });
  }

  const actor = changedBy ?? (req as any).user?.email ?? "admin";

  try {
    const existing = await db.execute(sql`
      SELECT id, price, source FROM golden_prices WHERE isin = ${isin} AND price_date = ${priceDate} LIMIT 1
    `);
    const ex = existing.rows?.[0] as any;

    if (ex) {
      await db.execute(sql`
        UPDATE golden_prices SET
          price = ${price}, source = 'BROKER_QUOTE', confidence_score = 50,
          is_validated = true, is_flagged = false, flag_reason = NULL, updated_at = NOW()
        WHERE isin = ${isin} AND price_date = ${priceDate}
      `);
      await db.execute(sql`
        INSERT INTO price_audit_log (isin, price_date, old_price, new_price, old_source, new_source, change_reason, changed_by, confidence_score)
        VALUES (${isin}, ${priceDate}, ${ex.price}, ${price}, ${ex.source}, 'BROKER_QUOTE', ${reason}, ${actor}, 50)
      `);
    } else {
      await db.execute(sql`
        INSERT INTO golden_prices (isin, price_date, asset_class, price, source, confidence_score, is_validated, is_flagged, currency)
        VALUES (${isin}, ${priceDate}, 'equity', ${price}, 'BROKER_QUOTE', 50, true, false, 'INR')
      `);
      await db.execute(sql`
        INSERT INTO price_audit_log (isin, price_date, new_price, new_source, change_reason, changed_by, confidence_score)
        VALUES (${isin}, ${priceDate}, ${price}, 'BROKER_QUOTE', ${reason}, ${actor}, 50)
      `);
    }

    return res.json({ success: true, isin, priceDate, price, source: "BROKER_QUOTE", changedBy: actor });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── POST /api/pricing/run-daily — trigger full daily run ────────────────────
router.post("/run-daily", async (req, res) => {
  const { date, batchSize, delayMs } = req.body as { date?: string; batchSize?: number; delayMs?: number };

  res.json({ status: "started", date: date ?? new Date().toISOString().slice(0, 10), message: "Daily golden pricing run initiated" });
  runDailyGoldenPricing(date, { batchSize, delayMs }).then(result => {
    console.log("[GoldenPricing] Admin-triggered daily run complete:", result);
  }).catch(e => {
    console.error("[GoldenPricing] Admin-triggered daily run error:", e?.message);
  });
});

// ── GET /api/pricing/audit/:isin — SEBI audit trail ─────────────────────────
router.get("/audit/:isin", async (req, res) => {
  const { isin } = req.params;
  const { limit = "50" } = req.query as { limit?: string };

  try {
    const rows = await db.execute(sql`
      SELECT * FROM price_audit_log WHERE isin = ${isin}
      ORDER BY created_at DESC LIMIT ${parseInt(limit)}
    `);
    return res.json({ isin, count: rows.rows.length, audit: rows.rows });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── GET /api/pricing/:isin/history — historical golden prices ───────────────
router.get("/:isin/history", async (req, res) => {
  const { isin } = req.params;
  const { from, to, limit = "90" } = req.query as { from?: string; to?: string; limit?: string };

  try {
    let rows;
    if (from && to) {
      rows = await db.execute(sql`
        SELECT * FROM golden_prices
        WHERE isin = ${isin} AND price_date BETWEEN ${from} AND ${to}
        ORDER BY price_date DESC LIMIT ${parseInt(limit)}
      `);
    } else {
      rows = await db.execute(sql`
        SELECT * FROM golden_prices WHERE isin = ${isin}
        ORDER BY price_date DESC LIMIT ${parseInt(limit)}
      `);
    }
    return res.json({ isin, count: rows.rows.length, prices: rows.rows.map(formatRow) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ── GET /api/pricing/:isin — latest golden price ────────────────────────────
// NOTE: This MUST be last among GET routes to avoid capturing /stats, /flagged, /audit
router.get("/:isin", async (req, res) => {
  const { isin } = req.params;
  const { date } = req.query as { date?: string };

  try {
    if (date) {
      const row = await getGoldenPrice(isin, date);
      if (!row) return res.status(404).json({ error: "No golden price found for this ISIN and date" });
      return res.json({ isin, ...formatRow(row) });
    }

    const row = await getLatestGoldenPrice(isin);
    if (!row) return res.status(404).json({ error: "No golden price found for this ISIN" });
    return res.json({ isin, ...formatRow(row) });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message });
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatRow(r: any) {
  return {
    date: r.price_date ?? r.priceDate,
    assetClass: r.asset_class ?? r.assetClass,
    price: r.price ? parseFloat(r.price) : null,
    open: r.open_price ? parseFloat(r.open_price) : null,
    high: r.high_price ? parseFloat(r.high_price) : null,
    low: r.low_price ? parseFloat(r.low_price) : null,
    volume: r.volume ? parseFloat(r.volume) : null,
    changePercent: r.change_percent ? parseFloat(r.change_percent) : null,
    source: r.source,
    confidence: r.confidence_score ?? r.confidence,
    isValidated: r.is_validated ?? r.isValidated,
    isFlagged: r.is_flagged ?? r.isFlagged,
    flagReason: r.flag_reason ?? r.flagReason,
    previousPrice: r.previous_price ? parseFloat(r.previous_price) : null,
    deviationPct: r.deviation_pct ? parseFloat(r.deviation_pct) : null,
    currency: r.currency ?? "INR",
    updatedAt: r.updated_at ?? r.updatedAt,
  };
}

export default router;
