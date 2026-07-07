/**
 * MF Analytics Operations Admin Routes
 *
 * Provides:
 *   GET  /api/admin/mf-analytics/coverage  — null coverage stats across key columns
 *   POST /api/admin/mf-analytics/run/:job  — proxy to Python sidecar for named bulk jobs
 *
 * All routes are admin/agent only.
 */
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { callPython } from "../clients/python-client";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();

const ALLOWED_JOBS = [
	"nav-backfill",
	"amfi-enrich",
	"bulk-compute-db",
	"cross-sectional-rank",
	"risk-from-monthly",
	"sync-change-pct",
	"derived-metrics",
	"monthly-pipeline",
];

// ── Coverage stats ───────────────────────────────────────────────────────────
router.get(
	"/api/admin/mf-analytics/coverage",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const role = (req as any).user?.role;
			if (!["admin", "superadmin", "agent"].includes(role)) {
				return res.status(403).json({ error: "Insufficient permissions" });
			}

			const result = await db.execute(sql`
      SELECT
        (SELECT COUNT(*) FROM mutual_fund_metrics) AS mfm_total,
        (SELECT ROUND(100.0 * COUNT(return_1y) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_1y,
        (SELECT ROUND(100.0 * COUNT(return_3y) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_3y,
        (SELECT ROUND(100.0 * COUNT(return_5y) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_5y,
        (SELECT ROUND(100.0 * COUNT(sharpe_ratio) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_sharpe,
        (SELECT ROUND(100.0 * COUNT(alpha) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_alpha,
        (SELECT ROUND(100.0 * COUNT(beta) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_beta,
        (SELECT ROUND(100.0 * COUNT(category_rank) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_cat_rank,
        (SELECT ROUND(100.0 * COUNT(var_95) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_var95,
        (SELECT ROUND(100.0 * COUNT(treynor_ratio) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_treynor,
        (SELECT ROUND(100.0 * COUNT(consistency_score) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_consistency,
        (SELECT ROUND(100.0 * COUNT(volatility) / NULLIF(COUNT(*),0), 1) FROM mutual_fund_metrics) AS pct_volatility,
        (SELECT COUNT(*) FROM mutual_funds) AS mf_total,
        (SELECT ROUND(100.0 * COUNT(change_percent) / NULLIF(COUNT(*),0), 1) FROM mutual_funds) AS pct_change_pct,
        (SELECT ROUND(100.0 * COUNT(scheme_sub_category) / NULLIF(COUNT(*),0), 1) FROM mutual_funds) AS pct_subcat,
        (SELECT ROUND(100.0 * COUNT(amc_code) / NULLIF(COUNT(*),0), 1) FROM mutual_funds) AS pct_amc_code,
        (SELECT ROUND(100.0 * COUNT(launch_date) / NULLIF(COUNT(*),0), 1) FROM mutual_funds) AS pct_launch_date,
        (SELECT ROUND(100.0 * COUNT(benchmark_index_code) / NULLIF(COUNT(*),0), 1) FROM mutual_funds) AS pct_benchmark,
        (SELECT COUNT(DISTINCT scheme_code) FROM mf_nav_history) AS nav_schemes,
        (SELECT ROUND(AVG(cnt)::numeric, 1) FROM (SELECT COUNT(*) cnt FROM mf_nav_history GROUP BY scheme_code) s) AS nav_avg_days,
        (SELECT MAX(cnt) FROM (SELECT COUNT(*) cnt FROM mf_nav_history GROUP BY scheme_code) s) AS nav_max_days,
        (SELECT COUNT(*) FROM (SELECT scheme_code FROM mf_nav_history GROUP BY scheme_code HAVING COUNT(*) >= 100) s) AS nav_schemes_100plus,
        (SELECT COUNT(*) FROM (SELECT scheme_code FROM mf_nav_history GROUP BY scheme_code HAVING COUNT(*) >= 365) s) AS nav_schemes_365plus,
        (SELECT COUNT(DISTINCT scheme_code) FROM mf_monthwise_performance) AS monthly_returns_schemes,
        (SELECT COUNT(*) FROM historical_nav_data WHERE identifier_type = 'mutual_fund') AS historical_nav_rows
    `);

			const row = result.rows[0];
			return res.json({
				mutualFundMetrics: {
					total: Number(row.mfm_total),
					return1y: Number(row.pct_1y),
					return3y: Number(row.pct_3y),
					return5y: Number(row.pct_5y),
					sharpe: Number(row.pct_sharpe),
					alpha: Number(row.pct_alpha),
					beta: Number(row.pct_beta),
					categoryRank: Number(row.pct_cat_rank),
					var95: Number(row.pct_var95),
					treynor: Number(row.pct_treynor),
					consistency: Number(row.pct_consistency),
					volatility: Number(row.pct_volatility),
				},
				mutualFunds: {
					total: Number(row.mf_total),
					changePercent: Number(row.pct_change_pct),
					schemeSubCategory: Number(row.pct_subcat),
					amcCode: Number(row.pct_amc_code),
					launchDate: Number(row.pct_launch_date),
					benchmark: Number(row.pct_benchmark),
				},
				navDepth: {
					schemes: Number(row.nav_schemes),
					avgDays: Number(row.nav_avg_days),
					maxDays: Number(row.nav_max_days),
					schemes100Plus: Number(row.nav_schemes_100plus),
					schemes365Plus: Number(row.nav_schemes_365plus),
				},
				monthlyReturns: {
					schemes: Number(row.monthly_returns_schemes),
				},
				historicalNav: {
					rows: Number(row.historical_nav_rows),
				},
				generatedAt: new Date().toISOString(),
			});
		} catch (error: any) {
			return res.status(500).json({ error: error.message });
		}
	},
);

// ── Run a named job ──────────────────────────────────────────────────────────
router.post(
	"/api/admin/mf-analytics/run/:job",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const role = (req as any).user?.role;
			if (!["admin", "superadmin"].includes(role)) {
				return res.status(403).json({ error: "Admin access required" });
			}

			const { job } = req.params;
			if (!ALLOWED_JOBS.includes(job)) {
				return res.status(400).json({
					error: `Unknown job: ${job}. Allowed: ${ALLOWED_JOBS.join(", ")}`,
				});
			}

			const startTime = Date.now();
			const result = await callPython<any>(
				`/api/mf/${job}`,
				"POST",
				req.body || {},
				(req as any).user,
			);
			const elapsed = Date.now() - startTime;

			return res.json({
				job,
				elapsedMs: elapsed,
				result,
			});
		} catch (error: any) {
			return res.status(500).json({ error: error.message });
		}
	},
);

export default router;
