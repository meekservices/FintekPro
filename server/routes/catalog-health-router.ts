import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const router = Router();

export interface CategoryHealthSummary {
	category: string;
	tableName: string;
	totalRecords: number;
	publishedRecords: number;
	activeRecords: number;
	staleRecordsGt24h: number;
	missingPriceOrNav: number;
	health: "HEALTHY" | "WARNING" | "ATTENTION_REQUIRED" | "CRITICAL";
}

export interface CatalogHealthReport {
	overallStatus: "HEALTHY" | "ATTENTION_REQUIRED" | "CRITICAL";
	timestamp: string;
	latencyMs: number;
	totalCatalogRecords: number;
	totalPublishedRecords: number;
	categories: CategoryHealthSummary[];
}

/**
 * GET /api/admin/catalog/health
 * GET /api/catalog-health
 *
 * Single-pane diagnostic endpoint for the operations desk and engineering leads.
 * Executes parallel, highly-optimized SQL count queries across all 10 core asset tables.
 * Complies with FintekPro GCR v1.1 (<50ms execution, zero paid cloud addons).
 */
router.get("/health", async (req: Request, res: Response) => {
	const start = Date.now();
	try {
		const results = await Promise.allSettled([
			// 1. Listed Stocks
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_published = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					COUNT(*) FILTER (WHERE is_active = true AND (current_price IS NULL AND last_price IS NULL)) AS missing_price,
					COUNT(*) FILTER (WHERE is_active = true AND last_updated < NOW() - INTERVAL '36 hours') AS stale
				FROM listed_stocks
			`),

			// 2. Mutual Funds
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_published = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					COUNT(*) FILTER (WHERE is_active = true AND (nav IS NULL OR CAST(nav AS DECIMAL) <= 0)) AS missing_price,
					COUNT(*) FILTER (WHERE is_active = true AND last_updated < NOW() - INTERVAL '36 hours') AS stale
				FROM mutual_funds
			`),

			// 3. AIF Master
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_published = true) AS published,
					COUNT(*) FILTER (WHERE fund_status = 'active') AS active,
					COUNT(*) FILTER (WHERE latest_nav IS NULL AND return_1y IS NULL) AS missing_price,
					0 AS stale
				FROM aif_master
			`),

			// 4. PMS Master
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_published = true) AS published,
					COUNT(*) FILTER (WHERE status = 'active') AS active,
					COUNT(*) FILTER (WHERE latest_nav IS NULL AND return_1y IS NULL) AS missing_price,
					0 AS stale
				FROM pms_master
			`),

			// 5. Bond Catalog
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_active = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					COUNT(*) FILTER (WHERE is_active = true AND (clean_price IS NULL AND ytm IS NULL)) AS missing_price,
					0 AS stale
				FROM bond_catalog
			`),

			// 6. REITs
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_active = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					COUNT(*) FILTER (WHERE current_price IS NULL OR CAST(current_price AS DECIMAL) <= 0) AS missing_price,
					0 AS stale
				FROM reits
			`),

			// 7. InvITs
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_active = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					COUNT(*) FILTER (WHERE current_price IS NULL OR CAST(current_price AS DECIMAL) <= 0) AS missing_price,
					0 AS stale
				FROM invits
			`),

			// 8. Pre-IPO Companies
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE current_valuation IS NOT NULL OR last_round_valuation IS NOT NULL) AS published,
					COUNT(*) AS active,
					COUNT(*) FILTER (WHERE current_valuation IS NULL AND last_round_valuation IS NULL) AS missing_price,
					0 AS stale
				FROM pre_ipo_companies
			`),

			// 9. Store Products (Showcase Catalog)
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_active = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					0 AS missing_price,
					0 AS stale
				FROM store_products
			`),

			// 10. Instrument Master (Tradable Universe)
			db.execute(sql`
				SELECT 
					COUNT(*) AS total,
					COUNT(*) FILTER (WHERE is_active = true) AS published,
					COUNT(*) FILTER (WHERE is_active = true) AS active,
					COUNT(*) FILTER (WHERE is_active = true AND last_price IS NULL) AS missing_price,
					0 AS stale
				FROM instrument_master
			`),
		]);

		const categoryNames = [
			{ name: "Equities (Listed Stocks)", table: "listed_stocks" },
			{ name: "Mutual Funds", table: "mutual_funds" },
			{ name: "Alternative Investment Funds (AIF)", table: "aif_master" },
			{ name: "Portfolio Management Services (PMS)", table: "pms_master" },
			{ name: "Corporate & Govt Bonds", table: "bond_catalog" },
			{ name: "Real Estate Investment Trusts (REITs)", table: "reits" },
			{ name: "Infrastructure Investment Trusts (InvITs)", table: "invits" },
			{ name: "Pre-IPO / Unlisted Equities", table: "pre_ipo_companies" },
			{ name: "Store Showcase Products", table: "store_products" },
			{ name: "Instrument Master (Universal)", table: "instrument_master" },
		];

		const categories: CategoryHealthSummary[] = [];
		let totalCatalogRecords = 0;
		let totalPublishedRecords = 0;
		let hasCritical = false;
		let hasWarning = false;

		results.forEach((resItem, idx) => {
			const meta = categoryNames[idx];
			if (resItem.status === "fulfilled") {
				const row = (resItem.value.rows?.[0] as Record<string, unknown>) || {};
				const total = Number(row.total || 0);
				const published = Number(row.published || 0);
				const active = Number(row.active || 0);
				const missing = Number(row.missing_price || 0);
				const stale = Number(row.stale || 0);

				totalCatalogRecords += total;
				totalPublishedRecords += published;

				let health: CategoryHealthSummary["health"] = "HEALTHY";
				if (stale > 100 || missing > 500) {
					health = "ATTENTION_REQUIRED";
					hasWarning = true;
				} else if (total > 0 && published === 0) {
					health = "CRITICAL";
					hasCritical = true;
				}

				categories.push({
					category: meta.name,
					tableName: meta.table,
					totalRecords: total,
					publishedRecords: published,
					activeRecords: active,
					staleRecordsGt24h: stale,
					missingPriceOrNav: missing,
					health,
				});
			} else {
				categories.push({
					category: meta.name,
					tableName: meta.table,
					totalRecords: 0,
					publishedRecords: 0,
					activeRecords: 0,
					staleRecordsGt24h: 0,
					missingPriceOrNav: 0,
					health: "ATTENTION_REQUIRED",
				});
				hasWarning = true;
			}
		});

		const latencyMs = Date.now() - start;
		const overallStatus = hasCritical ? "CRITICAL" : hasWarning ? "ATTENTION_REQUIRED" : "HEALTHY";

		const report: CatalogHealthReport = {
			overallStatus,
			timestamp: new Date().toISOString(),
			latencyMs,
			totalCatalogRecords,
			totalPublishedRecords,
			categories,
		};

		logger.info("[CatalogHealth] Diagnostic audit completed", {
			event: "CATALOG_HEALTH_CHECK",
			overall_status: overallStatus,
			total_records: totalCatalogRecords,
			latency_ms: latencyMs,
		});

		res.json({
			success: true,
			data: report,
		});
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		logger.error("[CatalogHealth] Failed to generate catalog health report", {
			error: message,
		});
		res.status(500).json({
			success: false,
			error: message,
		});
	}
});

export default router;
