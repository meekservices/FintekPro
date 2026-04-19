import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/roleMiddleware';
import * as schema from "@shared/schema";

async function resolveTableName(tableName: string): Promise<string | null> {
  if (!isValidTableName(tableName)) return null;
  const check = await db.execute(
    sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${tableName} LIMIT 1`
  );
  if (check.rows.length === 0) return null;
  return (check.rows[0] as any).table_name as string;
}

const router = Router();

interface TableInfo {
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeFormatted: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

router.get('/tables', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT 
        schemaname,
        relname as table_name,
        n_live_tup as row_count,
        pg_total_relation_size(schemaname || '.' || relname) as size_bytes
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY n_live_tup DESC
    `);

    const tables: TableInfo[] = (result.rows as any[]).map(row => ({
      tableName: row.table_name,
      rowCount: parseInt(row.row_count) || 0,
      sizeBytes: parseInt(row.size_bytes) || 0,
      sizeFormatted: formatBytes(parseInt(row.size_bytes) || 0)
    }));

    res.json({ success: true, tables });
  } catch (error: any) {
    console.error('Error fetching tables:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tables/:tableName/columns', requireAdmin, async (req: Request, res: Response) => {
  try {
    const safeTableName = await resolveTableName(req.params.tableName);
    if (!safeTableName) {
      return res.status(400).json({ success: false, error: 'Invalid table name' });
    }

    const result = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${safeTableName}
      ORDER BY ordinal_position
    `);

    const columns: ColumnInfo[] = (result.rows as any[]).map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default
    }));

    res.json({ success: true, columns });
  } catch (error: any) {
    console.error('Error fetching columns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/tables/:tableName/data', requireAdmin, async (req: Request, res: Response) => {
  try {
    const safeTableName = await resolveTableName(req.params.tableName);
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 100);
    const offset = (page - 1) * limit;

    if (!safeTableName) {
      return res.status(400).json({ success: false, error: 'Invalid table name' });
    }

    const countResult = await db.execute(
      sql`SELECT COUNT(*) as total FROM ${sql.identifier(safeTableName)}`
    );
    const totalRows = parseInt((countResult.rows[0] as any).total) || 0;

    const dataResult = await db.execute(
      sql`SELECT * FROM ${sql.identifier(safeTableName)} ORDER BY 1 DESC LIMIT ${limit} OFFSET ${offset}`
    );
    const rows = dataResult.rows as any[];

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        totalRows,
        totalPages: Math.ceil(totalRows / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const dbSizeResult = await db.execute(sql`
      SELECT pg_size_pretty(pg_database_size(current_database())) as db_size
    `);

    const tableCountResult = await db.execute(sql`
      SELECT COUNT(*) as count FROM pg_stat_user_tables WHERE schemaname = 'public'
    `);

    const connectionResult = await db.execute(sql`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);

    res.json({
      success: true,
      stats: {
        databaseSize: (dbSizeResult.rows[0] as any).db_size,
        tableCount: parseInt((tableCountResult.rows[0] as any).count) || 0,
        activeConnections: parseInt((connectionResult.rows[0] as any).active_connections) || 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function isValidTableName(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default router;
