import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '../shared/schema.ts';
import fs from 'fs';

/**
 * DATABASE CONNECTION LOGIC
 * 
 * Production: Uses Google Cloud SQL Unix Sockets via /cloudsql mount.
 * Development: Uses TCP (127.0.0.1:5432).
 */

const isProduction = process.env.NODE_ENV === "production";
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || "fintekpro:asia-south1:fintekpro-db";

// Configuration defaults
let user = 'postgres';
let password = process.env.DB_PASSWORD || 'postgres';
let database = 'fintekpro';
let host = '127.0.0.1';
let port = 5432;

// 1. Initial Load of DATABASE_URL
let dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

// 3. Build Pool Configuration
const POOL_CONFIG: any = {
  max: isProduction ? 3 : 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
};

// The `pg` library does NOT support `?host=` as a URL query parameter.
// The Cloud SQL URL format `postgresql://user:pass@/db?host=/cloudsql/...` is also
// non-standard and causes `new URL()` to throw. Use regex parsing instead.
if (dbUrl) {
  // Match: postgresql://user:pass@/dbname?host=/cloudsql/...
  // OR standard: postgresql://user:pass@host:port/dbname
  const cloudSqlMatch = dbUrl.match(
    /^(?:postgres(?:ql)?):\/\/([^:@]+)?(?::([^@]*))?@\/([^?]+)(?:\?host=(.+))?$/
  );
  if (cloudSqlMatch && cloudSqlMatch[4]?.startsWith('/')) {
    // Cloud SQL Unix socket format
    POOL_CONFIG.user = cloudSqlMatch[1] || 'postgres';
    POOL_CONFIG.password = cloudSqlMatch[2] || undefined;
    POOL_CONFIG.database = cloudSqlMatch[3] || 'fintekpro';
    POOL_CONFIG.host = cloudSqlMatch[4]; // e.g. /cloudsql/fintekpro:asia-south1:fintekpro-db
    delete POOL_CONFIG.port;
    console.log(`[DB] 🔧 Cloud SQL socket mode: user=${POOL_CONFIG.user} db=${POOL_CONFIG.database} socket=${POOL_CONFIG.host}`);
  } else {
    // Standard TCP connection string
    POOL_CONFIG.connectionString = dbUrl;
  }
} else {
  POOL_CONFIG.user = user;
  POOL_CONFIG.password = password;
  POOL_CONFIG.database = database;
  POOL_CONFIG.host = host;
  POOL_CONFIG.port = port;
}

// 4. Unix Socket Override — if /cloudsql socket exists and no socket set yet
if (isProduction) {
  try {
    const rootDir = '/cloudsql';
    const socketPath = `/cloudsql/${instanceConnectionName}`;

    if (fs.existsSync(rootDir)) {
      const contents = fs.readdirSync(rootDir);
      console.log(`[DB] ✅ ${rootDir} exists. Found: ${contents.join(', ')}`);
    } else {
      console.warn(`[DB] ⚠️ ${rootDir} directory does NOT exist. This usually means the Cloud SQL instance is not attached to the Cloud Run service.`);
    }

    if (POOL_CONFIG.host && POOL_CONFIG.host.startsWith('/')) {
      console.log(`[DB] 🚀 Unix socket already configured: ${POOL_CONFIG.host}`);
    } else if (fs.existsSync(socketPath)) {
      console.log(`[DB] 🔧 Injecting Unix Socket host override: ${socketPath}`);
      POOL_CONFIG.host = socketPath;
      delete POOL_CONFIG.port;
      delete POOL_CONFIG.connectionString; // Prefer explicit host if socket is found
    } else {
      console.warn(`[DB] ⚠️ No socket found at ${socketPath}. Attempting to proceed with current configuration...`);
      
      // Fallback: If no socket, and we have a connection string, check if it's usable
      if (!dbUrl) {
        console.error(`[DB] ❌ CRITICAL: No DATABASE_URL and no Unix Socket found. Connection will likely fail.`);
      }
    }
  } catch (err) {
    console.error(`[DB] ❌ Error in socket diagnostic: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Initialize the Pool
export const pool = new Pool(POOL_CONFIG);

// Error handling for the pool
pool.on('error', (err) => {
  console.error('[DB] ❌ Unexpected error on idle client', err);
});

// Initialize Drizzle
export const db = drizzle(pool, { schema });

// Export connection tester
export const testConnection = async () => {
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT NOW()');
    return { success: true, timestamp: res.rows[0].now };
  } finally {
    client.release();
  }
};

let _poolClosing = false;

export function isPoolClosed(): boolean {
  return _poolClosing;
}

export async function closePool(): Promise<void> {
  _poolClosing = true;
  try {
    await pool.end();
    console.log('[DB Pool] Pool closed gracefully');
  } catch (err) {
    if (!((err as Error)?.message || '').includes('end on the pool')) {
      console.error('[DB Pool] Error closing pool', err);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PRODUCTION DB ENRICHMENT UTILITIES (Merged from db-production.ts)
// ─────────────────────────────────────────────────────────────────────────────

let prodPool: InstanceType<typeof Pool> | null = null;
let prodDb: ReturnType<typeof drizzle> | null = null;

export function getProductionDb() {
  if (prodDb) return prodDb;

  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    throw new Error(
      '[ProductionDB] PRODUCTION_DATABASE_URL not set. Enrichment runs on production only.'
    );
  }

  const isRailwayInternal = prodUrl.includes('.railway.internal');
  const needsSsl = !isRailwayInternal && (
    prodUrl.includes('neon.tech') ||
    prodUrl.includes('.neon.') ||
    prodUrl.includes('neon.database') ||
    prodUrl.includes('rlwy.net') ||
    prodUrl.includes('railway.app')
  );

  prodPool = new Pool({
    connectionString: prodUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
    ssl: needsSsl ? true : false,
  });

  prodPool.on('error', (err) => {
    console.warn(`[ProductionDB] Pool error (auto-recovering): ${err?.message || err}`);
  });

  prodDb = drizzle(prodPool, { schema });
  console.log('[ProductionDB] Production database connection initialized for enrichment');
  return prodDb;
}

export function hasProductionDb(): boolean {
  return !!process.env.PRODUCTION_DATABASE_URL;
}

export function getEnrichmentWriteDb() {
  if (!hasProductionDb()) {
    throw new Error('[ProductionDB] PRODUCTION_DATABASE_URL not set. Enrichment writes require production DB.');
  }
  return getProductionDb();
}

export function getEnrichmentReadDb(devDb: any) {
  return hasProductionDb() ? getProductionDb() : devDb;
}

export function requireProductionDb(serviceName: string): boolean {
  if (!hasProductionDb()) {
    console.error(`[${serviceName}] ❌ PRODUCTION_DATABASE_URL not set. Enrichment runs on production only. Aborting.`);
    return false;
  }
  console.log(`[${serviceName}] ✅ Connected to PRODUCTION database`);
  return true;
}

export async function closeProductionPool(): Promise<void> {
  if (prodPool) {
    try {
      await prodPool.end();
      prodPool = null;
      prodDb = null;
      console.log('[ProductionDB] Pool closed');
    } catch (err: any) {
      console.error('[ProductionDB] Error closing pool:', err?.message || err);
    }
  }
}

