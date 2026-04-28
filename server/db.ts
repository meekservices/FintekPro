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
    servername: selectedDbUrl.split('@')[1]?.split('/')[0]?.split(':')[0] || ''
  } : false,
};


// Extract connection parameters robustly
let user = '';
let password = '';
let database = 'fintekpro';

try {
  // Manual parsing to handle missing hostnames (common for Unix socket URLs)
  // Format: postgresql://user:password@/database?options
  const protocolEnd = selectedDbUrl.indexOf('://');
  const pathStart = selectedDbUrl.indexOf('/', protocolEnd + 3);
  const lastAt = selectedDbUrl.lastIndexOf('@', pathStart === -1 ? undefined : pathStart);
  
  if (lastAt > protocolEnd) {
    const userinfo = selectedDbUrl.substring(protocolEnd + 3, lastAt);
    const colonIndex = userinfo.indexOf(':');
    if (colonIndex !== -1) {
      user = decodeURIComponent(userinfo.substring(0, colonIndex));
      password = decodeURIComponent(userinfo.substring(colonIndex + 1));
    } else {
      user = decodeURIComponent(userinfo);
    }
    
    if (pathStart !== -1) {
      const dbPart = selectedDbUrl.substring(pathStart + 1).split('?')[0];
      if (dbPart) database = dbPart;
    }
  } else {
    // Fallback to URL parser if simple parsing fails
    const url = new URL(selectedDbUrl.replace('postgresql://', 'http://').replace('postgres://', 'http://'));
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = url.pathname.split('/')[1] || 'fintekpro';
  }
} catch (e: any) {
  console.warn(`[DB] 🟡 Non-fatal: Manual URL parsing failed (${e.message}). Falling back to connection string.`);
}

if (isCloudSqlSocketAvailable) {
  // On Cloud Run, the socket is inside the instance-named directory
  POOL_CONFIG.host = cloudSqlSocketDir;
  POOL_CONFIG.port = 5432;
  POOL_CONFIG.user = user;
  POOL_CONFIG.password = password;
  POOL_CONFIG.database = database;
  
  console.log(`[DB] 🟢 Configured for Unix Socket: host=${POOL_CONFIG.host}, user=${POOL_CONFIG.user}, db=${POOL_CONFIG.database}`);
} else {
  // Fallback to connection string or explicit host
  if (selectedDbUrl.includes('host=')) {
    // Special case: connection string already specifies host (e.g. for local proxy)
    POOL_CONFIG.connectionString = selectedDbUrl;
    console.log(`[DB] Using connection string with explicit host param`);
  } else {
    POOL_CONFIG.connectionString = selectedDbUrl;
    const maskedHost = selectedDbUrl.split('@')[1]?.split('/')[0] || 'localhost';
    console.log(`[DB] Using TCP connection to ${maskedHost}`);
  }
}

export const pool = new Pool(POOL_CONFIG);

pool.on('error', (err: Error) => {
  if (err.message?.includes('terminating connection due to administrator command') || 
      err.message?.includes('closed by the server') ||
      (err as any).code === '57P01') {
    return;
  }
  console.error('[DB] Pool unexpected error:', err);
});

export const db = drizzle(pool, { schema });
