/**
 * Database Governance Routes
 *
 * Admin-only endpoints for:
 *   GET  /api/admin/db/table-audit    — table usage audit with row counts and status classification
 *   POST /api/admin/db/archive-table  — superadmin-only: move a public table to _archive schema
 *
 * Protected tables (application schema from shared/schema.ts + drizzle internals) cannot be archived.
 */

import { Express, Response } from 'express';
import { db, pool } from '../../db';
import { sql } from 'drizzle-orm';
import { adminService } from '../../admin-service';
import { logger } from '../../logger';

const requireAdmin = async (req: any, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const isAdmin = await adminService.isAdmin(req.user.id);
  if (!isAdmin) {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

const requireSuperAdmin = async (req: any, res: Response, next: any) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const isSuperAdmin = await adminService.isSuperAdmin(req.user.id);
  if (!isSuperAdmin) {
    return res.status(403).json({ message: "Superadmin access required" });
  }
  next();
};

/**
 * Derive a usageStatus classification from pg_stat_user_tables metrics.
 *
 * active              — n_live_tup > 0 AND (seq_scan + idx_scan) > 0 in last 90 days
 * low_activity        — n_live_tup > 0 BUT very few scans
 * zero_reads_90d      — n_live_tup > 0 but last_autovacuum NULL or > 90 days AND no scans
 * candidate_for_archive — n_live_tup = 0 AND no scans at all
 */
function classifyTable(row: any): string {
  const liveTup = parseInt(row.n_live_tup ?? '0', 10);
  const seqScan = parseInt(row.seq_scan ?? '0', 10);
  const idxScan = parseInt(row.idx_scan ?? '0', 10);
  const totalScans = seqScan + idxScan;
  const lastVacuumDate = row.last_autovacuum ? new Date(row.last_autovacuum) : null;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const vacuumedRecently = lastVacuumDate && lastVacuumDate > ninetyDaysAgo;

  if (liveTup === 0 && totalScans === 0) return 'candidate_for_archive';
  if (totalScans === 0 && !vacuumedRecently) return 'zero_reads_90d';
  if (totalScans > 0 && totalScans < 10) return 'low_activity';
  if (totalScans >= 10) return 'active';
  return 'low_activity';
}

const STATUS_SEVERITY: Record<string, number> = {
  candidate_for_archive: 4,
  zero_reads_90d: 3,
  low_activity: 2,
  active: 1,
};

/**
 * Canonical table names from shared/schema.ts (application schema).
 * This list is extracted at startup by querying information_schema.
 * We also always protect tables in the drizzle internal schema.
 */
let _protectedTableNames: Set<string> | null = null;

async function getProtectedTableNames(): Promise<Set<string>> {
  if (_protectedTableNames) return _protectedTableNames;

  // Import all exported table objects from shared/schema
  const schema = await import('@shared/schema');
  const names = new Set<string>();

  for (const value of Object.values(schema)) {
    if (value && typeof value === 'object' && (value as any)[Symbol.for('drizzle:Name')]) {
      names.add((value as any)[Symbol.for('drizzle:Name')] as string);
    }
  }

  // Also add the drizzle migration table
  names.add('__drizzle_migrations');
  names.add('drizzle_migrations');

  _protectedTableNames = names;
  return names;
}

export async function tableAuditQuery(): Promise<any[]> {
  const result = await pool.query(`
    SELECT
      schemaname,
      relname                                         AS table_name,
      n_live_tup,
      n_dead_tup,
      seq_scan,
      idx_scan,
      last_autovacuum,
      last_autoanalyze,
      CASE
        WHEN n_live_tup + n_dead_tup > 0
        THEN ROUND((n_dead_tup::numeric / (n_live_tup + n_dead_tup)) * 100, 2)
        ELSE 0
      END                                             AS dead_tuple_pct
    FROM pg_stat_user_tables
    WHERE schemaname = 'public'
    ORDER BY table_name
  `);
  return result.rows;
}

export function registerDbGovernanceRoutes(app: Express): void {

  // ── GET /api/admin/db/table-audit ──────────────────────────────────────────
  app.get('/api/admin/db/table-audit', requireAdmin, async (_req, res) => {
    try {
      const rows = await tableAuditQuery();

      const enriched = rows.map((row) => ({
        tableName: row.table_name,
        schemaName: row.schemaname,
        rowCount: parseInt(row.n_live_tup ?? '0', 10),
        deadTuples: parseInt(row.n_dead_tup ?? '0', 10),
        deadTuplePct: parseFloat(row.dead_tuple_pct ?? '0'),
        seqScans: parseInt(row.seq_scan ?? '0', 10),
        idxScans: parseInt(row.idx_scan ?? '0', 10),
        lastAutovacuum: row.last_autovacuum ?? null,
        lastAutoanalyze: row.last_autoanalyze ?? null,
        usageStatus: classifyTable(row),
      }));

      enriched.sort(
        (a, b) =>
          (STATUS_SEVERITY[b.usageStatus] ?? 0) - (STATUS_SEVERITY[a.usageStatus] ?? 0)
      );

      res.json({ success: true, count: enriched.length, tables: enriched });
    } catch (error: any) {
      logger.error('[DbGovernance] Table audit failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ── POST /api/admin/db/archive-table ──────────────────────────────────────
  app.post('/api/admin/db/archive-table', requireSuperAdmin, async (req: any, res) => {
    const { tableName, reason } = req.body ?? {};

    if (!tableName || typeof tableName !== 'string') {
      return res.status(400).json({ success: false, error: 'tableName is required' });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'reason is required (min 5 characters)' });
    }

    // Sanitise: only allow valid identifiers (letters, digits, underscores)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return res.status(400).json({ success: false, error: 'Invalid table name' });
    }

    try {
      // 1. Ensure table exists in public schema
      const existsResult = await pool.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.tables
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      );
      if (parseInt(existsResult.rows[0]?.cnt ?? '0', 10) === 0) {
        return res.status(404).json({ success: false, error: `Table '${tableName}' not found in public schema` });
      }

      // 2. Check against protected table list
      const protectedTables = await getProtectedTableNames();
      if (protectedTables.has(tableName)) {
        return res.status(403).json({
          success: false,
          error: `Table '${tableName}' is a protected application table and cannot be archived`,
        });
      }

      // 3. Ensure _archive schema exists
      await pool.query(`CREATE SCHEMA IF NOT EXISTS _archive`);

      // 4. Build archive name with date suffix (YYYYMMDD)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const archiveName = `${tableName}_${dateStr}`;

      // 5. Move table in a transaction: change schema, then rename
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`ALTER TABLE public.${tableName} SET SCHEMA _archive`);
        await client.query(`ALTER TABLE _archive.${tableName} RENAME TO ${archiveName}`);
        await client.query('COMMIT');
      } catch (txErr: any) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      // 6. Write audit log row to kyc_audit_logs
      const adminId = req.user?.id ?? 'unknown';
      await pool.query(
        `INSERT INTO kyc_audit_logs
           (id, accessed_by, access_type, purpose, access_status, accessed_at)
         VALUES
           (gen_random_uuid(), $1, 'write',
            $2,
            'success', NOW())`,
        [
          adminId,
          `DB Archive: public.${tableName} → _archive.${archiveName}. Reason: ${reason.trim()}`,
        ]
      );

      logger.info(`[DbGovernance] Table archived: public.${tableName} → _archive.${archiveName}`, {
        archivedBy: adminId,
        reason: reason.trim(),
      });

      res.json({
        success: true,
        message: `Table '${tableName}' moved to _archive schema as '${archiveName}'`,
        archiveName,
      });
    } catch (error: any) {
      logger.error('[DbGovernance] Archive operation failed', { error: error.message, tableName });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  console.log('✅ [DbGovernance] Table audit + archive routes registered');
}
