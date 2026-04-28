import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import { logger } from './logger';
import fs from 'fs';

// Determine environment first — URL selection depends on it.
const isProduction = process.env.NODE_ENV === 'production';

// Connection strategy:
//   PRODUCTION_DATABASE_URL MUST be set (GCP Cloud SQL)
const selectedDbUrl = process.env.PRODUCTION_DATABASE_URL;

if (!selectedDbUrl) {
  throw new Error("No database URL found. Set PRODUCTION_DATABASE_URL in your environment secrets.");
}

export const isUsingProductionDb = true; // Always true now since we only use the production DB

// SSL config based on URL type:
//   Neon (neon.tech)               → SSL with cert verification (managed CA)
//   Railway public (rlwy.net)      → SSL with cert verification (managed CA)
//   Railway internal (.internal)   → no SSL (private network, no cert needed)
//   Local / Replit Helium          → no SSL
// Force SSL for all non-local production URLs unless using Unix sockets
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || 'fintekpro:asia-south1:fintekpro-db';

// Cloud Run standard path for Cloud SQL sockets is /cloudsql/<INSTANCE_CONNECTION_NAME>
// However, the actual socket file is inside that directory as .s.PGSQL.5432
const cloudSqlSocketDir = `/cloudsql/${instanceConnectionName}`;
const isCloudSqlSocketAvailable = fs.existsSync(cloudSqlSocketDir);

// SSL is ONLY needed if:
// 1. Not using a Unix socket
// 2. Not connecting to localhost/127.0.0.1 (proxy)
// 3. The URL actually supports/needs it
const needsSsl = 
  !isCloudSqlSocketAvailable && 
  !selectedDbUrl.includes('localhost') && 
  !selectedDbUrl.includes('127.0.0.1') &&
  !selectedDbUrl.includes('host=');

if (isCloudSqlSocketAvailable) {
  console.log(`[DB] 🟢 Detected Cloud SQL Unix Socket directory: ${cloudSqlSocketDir}`);
} else {
  console.warn(`[DB] 🟡 Unix Socket directory not found at ${cloudSqlSocketDir}. (ENV: ${process.env.NODE_ENV}, INSTANCE: ${instanceConnectionName})`);
}

const POOL_CONFIG: any = {
  max: isProduction ? 20 : 5,
  min: isProduction ? 2 : 0,
  idleTimeoutMillis: isProduction ? 60000 : 30000,
  connectionTimeoutMillis: 15000, // Increased to 15s for Cloud SQL cold-start tolerance
  statement_timeout: isProduction ? 30000 : 60000,
  allowExitOnIdle: false,
  ssl: needsSsl ? { 
    rejectUnauthorized: false,
    servername: new URL(selectedDbUrl).hostname 
  } : false,
};


// If Cloud SQL Unix socket is available, leverage it for maximum performance and security
try {
  const url = new URL(selectedDbUrl);
  if (isCloudSqlSocketAvailable) {
    // On Cloud Run, the socket is inside the instance-named directory
    POOL_CONFIG.host = cloudSqlSocketDir;
    POOL_CONFIG.port = 5432;
    POOL_CONFIG.user = decodeURIComponent(url.username);
    POOL_CONFIG.password = decodeURIComponent(url.password);
    POOL_CONFIG.database = url.pathname.split('/')[1] || 'fintekpro';
    
    console.log(`[DB] Configured for Unix Socket: host=${POOL_CONFIG.host}, user=${POOL_CONFIG.user}, db=${POOL_CONFIG.database}`);
  } else {
    // Fallback to connection string or explicit host
    if (selectedDbUrl.includes('host=')) {
      // Special case: connection string already specifies host (e.g. for local proxy)
      POOL_CONFIG.connectionString = selectedDbUrl;
      console.log(`[DB] Using connection string with explicit host param`);
    } else {
      POOL_CONFIG.connectionString = selectedDbUrl;
      const maskedHost = url.hostname || 'localhost';
      console.log(`[DB] Using TCP connection to ${maskedHost}`);
    }
  }
} catch (e: any) {
  console.error(`[DB] ❌ Failed to parse connection string: ${e.message}`);
  // Last resort fallback
  POOL_CONFIG.connectionString = selectedDbUrl;
}

export const pool = new Pool(POOL_CONFIG);

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
  const source = 'PRODUCTION_DATABASE_URL';
  console.log(`[DB] Attempting to verify connection to ${source}...`);

  return new Promise((resolve) => {
    // 15-second safety timeout for the connection test itself
    const timeout = setTimeout(() => {
      console.error(`[DB] Connection test TIMED OUT after 15s. Format may be incorrect or database unreachable.`);
      resolve(false);
    }, 15000);

    pool.connect()
      .then((client) => {
        return client.query('SELECT 1')
          .then(() => {
            client.release();
            clearTimeout(timeout);
            console.log('[DB] Connection verified successfully');
            resolve(true);
          })
          .catch((err) => {
            client.release();
            clearTimeout(timeout);
            console.error(`[DB] Query failed during connection test: ${err.message}`);
            resolve(false);
          });
      })
      .catch((err) => {
        clearTimeout(timeout);
        console.error(`[DB] Pool connection failed: ${err.message}`);
        resolve(false);
      });
  });
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
    // Ignore \"pool already ended\" errors — can happen on repeated SIGTERM
    if (!(err?.message || '').includes('end on the pool')) {
      logger.error('[DB Pool] Error closing pool', { error: err?.message || String(err) });
    }
  }
}
