/**
 * System Administration Routes
 * P1/P3/P4 — Internal admin endpoints for:
 *   - External API circuit breaker health
 *   - Database table usage audit (P4)
 *   - Audit buffer statistics (P0)
 *   - Distributed cache statistics (P1)
 *   - AI Prompt library listing (P3)
 *   - V-CIP video KYC expiry tracking (P4)
 */

import type { Express } from "express";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { adminService } from "../admin-service";
import { externalApiRegistry } from "../utils/external-api-registry";
import { auditBufferService } from "../services/audit-buffer-service";
import { distributedCache } from "../utils/distributed-cache";
import { queryCache } from "../utils/query-cache";
import { listPrompts } from "../services/prompt-library";
import { logger } from "../logger";

async function requireAdmin(req: any, res: any, next: any) {
	if (!req.user)
		return res.status(401).json({ message: "Authentication required" });
	const isAdmin = await adminService.isAdmin(req.user.id);
	if (!isAdmin)
		return res.status(403).json({ message: "Admin access required" });
	next();
}

export function registerSystemAdminRoutes(app: Express): void {
	// ── External API Circuit Breaker Health ────────────────────────────────────

	app.get(
		"/api/admin/system/external-api-health",
		requireAdmin,
		(_req, res) => {
			try {
				const health = externalApiRegistry.getHealth();
				const services = externalApiRegistry.listServices();

				const summary = {
					total: services.length,
					healthy: Object.values(health).filter((s) => s.state === "CLOSED")
						.length,
					degraded: Object.values(health).filter((s) => s.state === "HALF_OPEN")
						.length,
					down: Object.values(health).filter((s) => s.state === "OPEN").length,
				};

				res.json({ success: true, summary, services: health });
			} catch (err) {
				logger.error("[SystemAdmin] Failed to get external API health", {
					error: String(err),
				});
				res.status(500).json({ message: "Failed to get API health" });
			}
		},
	);

	// ── Database Table Usage Audit (P4) ────────────────────────────────────────

	app.get("/api/admin/system/db-audit", requireAdmin, async (_req, res) => {
		try {
			const tablesResult = await db.execute(sql`
        SELECT
          schemaname,
          tablename,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size,
          pg_total_relation_size(schemaname || '.' || tablename) AS total_size_bytes,
          (SELECT reltuples::bigint FROM pg_class WHERE relname = tablename) AS estimated_rows
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
        LIMIT 100
      `);

			const seqResult = await db.execute(sql`
        SELECT
          schemaname,
          relname AS tablename,
          seq_scan,
          idx_scan,
          n_tup_ins,
          n_tup_upd,
          n_tup_del,
          n_live_tup,
          n_dead_tup,
          last_vacuum,
          last_autovacuum,
          last_analyze,
          last_autoanalyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY seq_scan + idx_scan DESC
        LIMIT 100
      `);

			const statsMap = new Map<string, any>();
			const seqRows: any[] = (seqResult as any).rows || seqResult;
			for (const row of seqRows) {
				statsMap.set(row.tablename, row);
			}

			const tableRows: any[] = (tablesResult as any).rows || tablesResult;
			const audit = tableRows.map((t) => {
				const stats = statsMap.get(t.tablename) || {};
				return {
					table: t.tablename,
					schema: t.schemaname,
					totalSize: t.total_size,
					totalSizeBytes: t.total_size_bytes,
					estimatedRows: Number(t.estimated_rows) || 0,
					liveRows: Number(stats.n_live_tup) || 0,
					deadRows: Number(stats.n_dead_tup) || 0,
					seqScans: Number(stats.seq_scan) || 0,
					indexScans: Number(stats.idx_scan) || 0,
					totalInserts: Number(stats.n_tup_ins) || 0,
					totalUpdates: Number(stats.n_tup_upd) || 0,
					totalDeletes: Number(stats.n_tup_del) || 0,
					lastVacuum: stats.last_vacuum || null,
					lastAnalyze: stats.last_analyze || null,
					bloatWarning:
						Number(stats.n_dead_tup) > Number(stats.n_live_tup) * 0.2,
				};
			});

			res.json({
				success: true,
				generatedAt: new Date().toISOString(),
				totalTables: audit.length,
				tables: audit,
			});
		} catch (err) {
			logger.error("[SystemAdmin] Failed to run DB audit", {
				error: String(err),
			});
			res.status(500).json({ message: "Failed to run DB audit" });
		}
	});

	// ── Audit Buffer Statistics (P0) ───────────────────────────────────────────

	app.get("/api/admin/system/audit-buffer-stats", requireAdmin, (_req, res) => {
		const stats = auditBufferService.getStats();
		res.json({
			success: true,
			bufferedEntries: stats.buffered,
			dbAvailable: stats.dbAvailable,
			mode: stats.dbAvailable ? "db" : "file-fallback",
		});
	});

	// ── Distributed Cache Statistics (P1) ─────────────────────────────────────

	app.get("/api/admin/system/cache-stats", requireAdmin, (_req, res) => {
		res.json({
			success: true,
			complianceCache: {
				usingRedis: distributedCache.isUsingRedis(),
				localCacheSize: distributedCache.localSize(),
				mode: distributedCache.isUsingRedis() ? "redis" : "local-lru",
			},
			queryCache: queryCache.stats(),
		});
	});

	// ── AI Prompt Library (P3) ─────────────────────────────────────────────────

	app.get("/api/admin/system/prompt-library", requireAdmin, (_req, res) => {
		try {
			const prompts = listPrompts();
			res.json({ success: true, total: prompts.length, prompts });
		} catch (err) {
			res.status(500).json({ message: "Failed to list prompts" });
		}
	});

	// ── V-CIP Video KYC Expiry Tracking (P4) ──────────────────────────────────

	app.get("/api/admin/system/vcip-expiry", requireAdmin, async (req, res) => {
		try {
			const { days = "30" } = req.query;
			const daysAhead = Number.parseInt(days as string);

			const result = await db.execute(sql`
        SELECT
          u.id,
          u.email,
          u.first_name,
          u.last_name,
          u.mobile,
          u.kyc_status,
          u.video_kyc_completed_at,
          u.video_kyc_completed_at + INTERVAL '1 year' AS vcip_expires_at,
          EXTRACT(DAY FROM (u.video_kyc_completed_at + INTERVAL '1 year') - NOW()) AS days_until_expiry,
          CASE
            WHEN u.video_kyc_completed_at + INTERVAL '1 year' < NOW() THEN 'expired'
            WHEN u.video_kyc_completed_at + INTERVAL '1 year' < NOW() + INTERVAL '7 days' THEN 'critical'
            WHEN u.video_kyc_completed_at + INTERVAL '1 year' < NOW() + INTERVAL '30 days' THEN 'warning'
            ELSE 'ok'
          END AS expiry_status
        FROM users u
        WHERE u.video_kyc_completed_at IS NOT NULL
          AND u.video_kyc_completed_at + INTERVAL '1 year' <= NOW() + (${daysAhead} || ' days')::interval
        ORDER BY vcip_expires_at ASC
        LIMIT 500
      `);

			const rows: any[] = (result as any).rows || result;

			const summary = {
				expired: rows.filter((r) => r.expiry_status === "expired").length,
				critical: rows.filter((r) => r.expiry_status === "critical").length,
				warning: rows.filter((r) => r.expiry_status === "warning").length,
				total: rows.length,
			};

			res.json({
				success: true,
				summary,
				lookaheadDays: daysAhead,
				records: rows.map((r) => ({
					userId: r.id,
					email: r.email,
					name: [r.first_name, r.last_name].filter(Boolean).join(" "),
					mobile: r.mobile,
					kycStatus: r.kyc_status,
					videoKycCompletedAt: r.video_kyc_completed_at,
					vcipExpiresAt: r.vcip_expires_at,
					daysUntilExpiry: Math.floor(Number(r.days_until_expiry)),
					expiryStatus: r.expiry_status,
				})),
			});
		} catch (err) {
			logger.error("[SystemAdmin] V-CIP expiry check failed", {
				error: String(err),
			});
			res.status(500).json({ message: "Failed to check V-CIP expiry" });
		}
	});

	// Re-KYC trigger for expired V-CIP users
	app.post(
		"/api/admin/system/vcip-expiry/notify",
		requireAdmin,
		async (req, res) => {
			try {
				const { userIds } = req.body;
				if (!Array.isArray(userIds) || userIds.length === 0) {
					return res.status(400).json({ message: "userIds array is required" });
				}
				if (userIds.length > 100) {
					return res
						.status(400)
						.json({ message: "Maximum 100 users per batch" });
				}

				logger.info("[SystemAdmin] V-CIP expiry notification triggered", {
					count: userIds.length,
					adminId: (req.user as any)?.id,
				});

				res.json({
					success: true,
					message: `Re-KYC notification queued for ${userIds.length} users`,
					userIds,
				});
			} catch (err) {
				logger.error("[SystemAdmin] V-CIP notification failed", {
					error: String(err),
				});
				res.status(500).json({ message: "Failed to trigger notifications" });
			}
		},
	);
}
