import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { logger } from './logger';

// Determine environment first — URL selection depends on it.
const isProduction = process.env.NODE_ENV === 'production';

// Connection strategy:
//   PRODUCTION_DATABASE_URL set → always use Railway/Neon Postgres (both dev and prod)
//   PRODUCTION_DATABASE_URL absent → fall back to DATABASE_URL (Replit Helium / local)
const selectedDbUrl =
  process.env.PRODUCTION_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!selectedDbUrl) {
  throw new Error(
    "No database URL found. Set PRODUCTION_DATABASE_URL (Railway Postgres) or DATABASE_URL in your environment secrets."
  );
}

export const isUsingProductionDb = isProduction || !!process.env.PRODUCTION_DATABASE_URL;

// SSL config based on URL type:
//   Neon (neon.tech)               → SSL with cert verification (managed CA)
//   Railway public (rlwy.net)      → SSL with cert verification (managed CA)
//   Railway internal (.internal)   → no SSL (private network, no cert needed)
//   Local / Replit Helium          → no SSL
const isRailwayInternal = selectedDbUrl.includes('.railway.internal');
const needsSsl =
  !isRailwayInternal && (
    selectedDbUrl.includes('neon.tech') ||
    selectedDbUrl.includes('.neon.') ||
    selectedDbUrl.includes('neon.database') ||
    selectedDbUrl.includes('rlwy.net') ||
    selectedDbUrl.includes('railway.app')
  );

const dbUrlSource = process.env.PRODUCTION_DATABASE_URL
  ? 'PRODUCTION_DATABASE_URL'
  : 'DATABASE_URL';

logger.info(`[DB] Connected to ${dbUrlSource} (${needsSsl ? 'SSL' : isRailwayInternal ? 'TCP/internal' : 'TCP'})`);

const POOL_CONFIG = {
  connectionString: selectedDbUrl,
  // Raised from 5 → 15: 200+ API routes + AI calls + KYC checks compete under load.
  // Railway Postgres supports 100+ connections; 15 provides headroom with safety margin.
  max: isProduction ? 15 : 5,
  min: isProduction ? 2 : 0,
  idleTimeoutMillis: isProduction ? 60000 : 30000,
  connectionTimeoutMillis: 15000,
  // Prevent runaway queries (complex reports, AI joins) from holding a connection indefinitely.
  // 30s is generous enough for any legitimate query; catches infinite loops / missing indexes.
  statement_timeout: isProduction ? 30000 : 60000,
  allowExitOnIdle: false,
  ssl: needsSsl ? true : false,
};

export const pool = new Pool(POOL_CONFIG);

// Track pool health metrics
let poolHealthWarnings = 0;
let waitingWarnings = 0;
const MAX_WARNINGS_BEFORE_LOG = 5;

let lastPoolErrorTime = 0;
let poolErrorCount = 0;
pool.on('error', (err) => {
  const now = Date.now();
  poolErrorCount++;
  if (now - lastPoolErrorTime > 10000) {
    const suffix = poolErrorCount > 1 ? ` (${poolErrorCount} errors in last batch)` : '';
    logger.warn(`[DB Pool] Connection error (auto-recovering): ${err?.message || err}${suffix}`);
    lastPoolErrorTime = now;
    poolErrorCount = 0;
  }
});

let connectCount = 0;
pool.on('connect', () => {
  connectCount++;
  if (connectCount <= 5 || connectCount % 10 === 0) {
    logger.debug(`[DB Pool] Client connected (total: ${connectCount})`);
  }
});

function checkPoolHealth() {
  const waiting = pool.waitingCount;
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const maxConnections = POOL_CONFIG.max;

  if (total > 0 && (total - idle) / maxConnections > 0.8) {
    poolHealthWarnings++;
    if (poolHealthWarnings >= MAX_WARNINGS_BEFORE_LOG) {
      logger.warn(`[DB Pool] Pool health warning: ${total - idle}/${maxConnections} connections in use, ${waiting} waiting, ${idle} idle`);
      poolHealthWarnings = 0;
    }
  } else {
    poolHealthWarnings = 0;
  }

  if (waiting > 0) {
    waitingWarnings++;
    if (waitingWarnings >= MAX_WARNINGS_BEFORE_LOG) {
      logger.warn(`[DB Pool] ${waiting} clients waiting for connections (pool: ${total - idle}/${maxConnections} active, ${idle} idle)`);
      waitingWarnings = 0;
    }
  } else {
    waitingWarnings = 0;
  }
}

setInterval(checkPoolHealth, 30000);

export const db = drizzle({ client: pool, schema });

export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    maxConnections: POOL_CONFIG.max,
    utilizationPercent: pool.totalCount > 0
      ? Math.round(((pool.totalCount - pool.idleCount) / POOL_CONFIG.max) * 100)
      : 0
  };
}

export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    logger.info('[DB] Database connection verified');
    return true;
  } catch (err: any) {
    logger.error('[DB] Connection test failed', { error: err?.message || 'Unknown error' });
    return false;
  }
}

// Tracks whether pool.end() has been called — background jobs check this
// before making DB calls during shutdown so they can bail gracefully.
let _poolClosing = false;

export function isPoolClosed(): boolean {
  return _poolClosing;
}

export async function closePool(): Promise<void> {
  // Set flag BEFORE calling pool.end() so in-flight jobs see it immediately
  _poolClosing = true;
  try {
    await pool.end();
    logger.info('[DB Pool] Pool closed gracefully');
  } catch (err: any) {
    // Ignore "pool already ended" errors — can happen on repeated SIGTERM
    if (!(err?.message || '').includes('end on the pool')) {
      logger.error('[DB Pool] Error closing pool', { error: err?.message || String(err) });
    }
  }
}
