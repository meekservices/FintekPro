import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';

const POOL_CONFIG = {
  connectionString: process.env.DATABASE_URL,
  max: isProduction ? 40 : 20,
  idleTimeoutMillis: isProduction ? 60000 : 30000,
  connectionTimeoutMillis: 20000,
  allowExitOnIdle: false,
};

export const pool = new Pool(POOL_CONFIG);

// Track pool health metrics
let poolHealthWarnings = 0;
const MAX_WARNINGS_BEFORE_LOG = 5;

pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err?.message || err);
  // Don't crash the server on pool errors - the pool will auto-recover
});

pool.on('connect', () => {
  console.log('[DB Pool] New client connected');
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
  
  // Critical warning if clients are waiting for connections
  if (waiting > 0) {
    console.warn(`[DB Pool] ⚠️ ${waiting} clients waiting for connections - consider increasing pool size`);
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