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
const cloudSqlSocketPath = `/cloudsql/${instanceConnectionName}`;
const isCloudSqlSocketAvailable = fs.existsSync(cloudSqlSocketPath);

// SSL is ONLY needed if:
// 1. Not using a Unix socket
// 2. Not connecting to localhost/127.0.0.1 (proxy)
// 3. The URL actually supports/needs it (contains google.com or is a remote host)
const needsSsl = 
  !isCloudSqlSocketAvailable && 
  !selectedDbUrl.includes('localhost') && 
  !selectedDbUrl.includes('127.0.0.1') &&
  !selectedDbUrl.includes('host=');

const dbUrlSource = 'PRODUCTION_DATABASE_URL';

if (isCloudSqlSocketAvailable) {
  logger.info(`[DB] Detected Cloud SQL Unix Socket: ${cloudSqlSocketPath}`);
} else {
  logger.info(`[DB] Unix Socket not found at ${cloudSqlSocketPath}. Using ${needsSsl ? 'SSL' : 'TCP'} connection strategy.`);
}

const POOL_CONFIG: any = {
  connectionString: selectedDbUrl,
  max: isProduction ? 20 : 5,
  min: isProduction ? 2 : 0,
  idleTimeoutMillis: isProduction ? 60000 : 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: isProduction ? 30000 : 60000,
  allowExitOnIdle: false,
  ssl: needsSsl ? { 
    rejectUnauthorized: false,
    servername: new URL(selectedDbUrl).hostname 
  } : false,
};


// If Cloud SQL Unix socket is available, leverage it for maximum performance and security
if (isCloudSqlSocketAvailable) {
  // Extract user, password, and database from the connection string
  try {
    const url = new URL(selectedDbUrl);
    POOL_CONFIG.host = cloudSqlSocketPath;
    POOL_CONFIG.port = 5432;
    POOL_CONFIG.user = url.username;
    POOL_CONFIG.password = url.password;
    POOL_CONFIG.database = url.pathname.split('/')[1] || 'fintekpro';
    // Delete connectionString to ensure host/user/password win
    delete POOL_CONFIG.connectionString;
  } catch (e: any) {
    logger.warn(`[DB] Failed to parse connection string for Unix socket optimization: ${e.message}`);
  }
} else if (selectedDbUrl.includes('host=')) {
  // Fallback: If socket path doesn't exist (local dev), connect to 127.0.0.1 (Cloud SQL Proxy default)
  try {
    const url = new URL(selectedDbUrl);
    POOL_CONFIG.host = '127.0.0.1';
    POOL_CONFIG.port = 5432;
    POOL_CONFIG.user = url.username;
    POOL_CONFIG.password = url.password;
    POOL_CONFIG.database = url.pathname.split('/')[1] || 'fintekpro';
    POOL_CONFIG.ssl = false; // Proxy handles encryption, local connection must be plain
    delete POOL_CONFIG.connectionString;
    logger.info(`[DB] Unix socket not found. Falling back to 127.0.0.1 for Cloud SQL Auth Proxy (SSL disabled).`);
  } catch (e) {
    // Fall back to raw connection string
  }
}

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
  const source = 'PRODUCTION_DATABASE_URL';
  logger.info(`[DB] Attempting to verify connection to ${source}...`);

  return new Promise((resolve) => {
    // 15-second safety timeout for the connection test itself
    const timeout = setTimeout(() => {
      logger.error(`[DB] Connection test TIMED OUT after 15s. Format may be incorrect or database unreachable.`);
      resolve(false);
    }, 15000);

    pool.connect()
      .then((client) => {
        return client.query('SELECT 1')
          .then(() => {
            client.release();
            clearTimeout(timeout);
            logger.info('[DB] Connection verified successfully');
            resolve(true);
          })
          .catch((err) => {
            client.release();
            clearTimeout(timeout);
            logger.error(`[DB] Query failed during connection test: ${err.message}`);
            resolve(false);
          });
      })
      .catch((err) => {
        clearTimeout(timeout);
        logger.error(`[DB] Pool connection failed: ${err.message}`);
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
    // Ignore "pool already ended" errors — can happen on repeated SIGTERM
    if (!(err?.message || '').includes('end on the pool')) {
      logger.error('[DB Pool] Error closing pool', { error: err?.message || String(err) });
    }
  }
}
