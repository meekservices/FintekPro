import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

const selectedDbUrl = process.env.PRODUCTION_DATABASE_URL;

if (!selectedDbUrl) {
  throw new Error(
    "PRODUCTION_DATABASE_URL is not set. Add it to your environment secrets.",
  );
}

const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';

export const isUsingProductionDb = true;

if (!isProduction) {
  console.log('🔗 [DB] Development using PRODUCTION database (shared read service, no mock data writes)');
}

if (isProduction) {
  console.log('🔗 [DB] Production: connected to Neon database (PRODUCTION_DATABASE_URL)');
}

// Autoscale: keep per-instance pool small so N concurrent instances stay within
// Neon's connection limit. At max=5, up to 20 autoscale instances = 100 connections.
// In dev, 5 is sufficient since only one process runs locally.
const POOL_CONFIG = {
  connectionString: selectedDbUrl,
  max: 5,
  min: isProduction ? 1 : 0,
  idleTimeoutMillis: isProduction ? 60000 : 30000,
  connectionTimeoutMillis: 15000,
  allowExitOnIdle: false,
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
    console.warn(`[DB Pool] Connection error (auto-recovering): ${err?.message || err}${suffix}`);
    lastPoolErrorTime = now;
    poolErrorCount = 0;
  }
});

let connectCount = 0;
pool.on('connect', () => {
  connectCount++;
  if (connectCount <= 5 || connectCount % 10 === 0) {
    console.log(`[DB Pool] Client connected (total: ${connectCount})`);
  }
});

// Monitor pool usage and warn before exhaustion
function checkPoolHealth() {
  const waiting = pool.waitingCount;
  const total = pool.totalCount;
  const idle = pool.idleCount;
  const maxConnections = POOL_CONFIG.max;
  
  // Warn if pool is approaching exhaustion (>80% used)
  if (total > 0 && (total - idle) / maxConnections > 0.8) {
    poolHealthWarnings++;
    if (poolHealthWarnings >= MAX_WARNINGS_BEFORE_LOG) {
      console.warn(`[DB Pool] ⚠️ Pool health warning: ${total - idle}/${maxConnections} connections in use, ${waiting} waiting, ${idle} idle`);
      poolHealthWarnings = 0;
    }
  } else {
    poolHealthWarnings = 0;
  }
  
  if (waiting > 0) {
    waitingWarnings++;
    if (waitingWarnings >= MAX_WARNINGS_BEFORE_LOG) {
      console.warn(`[DB Pool] ⚠️ ${waiting} clients waiting for connections (pool: ${total - idle}/${maxConnections} active, ${idle} idle)`);
      waitingWarnings = 0;
    }
  } else {
    waitingWarnings = 0;
  }
}

// Check pool health every 30 seconds
setInterval(checkPoolHealth, 30000);

export const db = drizzle({ client: pool, schema });

// Get current pool statistics
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
    console.log('[DB] Database connection verified');
    return true;
  } catch (err: any) {
    console.error('[DB] Connection test failed:', err?.message || 'Unknown error');
    return false;
  }
}

// Graceful shutdown helper
export async function closePool(): Promise<void> {
  try {
    await pool.end();
    console.log('[DB Pool] Pool closed gracefully');
  } catch (err: any) {
    console.error('[DB Pool] Error closing pool:', err?.message || err);
  }
}