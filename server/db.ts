import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';
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
let password = process.env.DB_PASSWORD || 'Kamini@321';
let database = 'fintekpro';
let host = '127.0.0.1';
let port = 5432;

// Parse connection URL if provided (standard practice in many environments)
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
if (dbUrl) {
  try {
    const url = new URL(dbUrl);
    user = url.username || user;
    password = url.password || password;
    database = url.pathname.split('/')[1] || database;
    
    // In production, we override host/port anyway for Unix sockets, 
    // but in dev, we use the URL components.
    if (!isProduction) {
      host = url.hostname || host;
      port = parseInt(url.port) || port;
    }
    console.log(`[DB] 🔗 Parsed connection parameters for database: ${database}`);
  } catch (e) {
    console.error(`[DB] ❌ Failed to parse DATABASE_URL: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// Build Pool Configuration
const POOL_CONFIG: any = {
  user,
  password,
  database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

if (isProduction) {
  // GCP Cloud Run standard Unix socket path
  const socketPath = `/cloudsql/${instanceConnectionName}`;
  
  // Verify socket directory exists
  if (fs.existsSync(socketPath)) {
    console.log(`[DB] 🚀 Production Mode: Using Cloud SQL Unix Socket at ${socketPath}`);
    POOL_CONFIG.host = socketPath;
    // Note: When using host as a directory path, pg uses it as the Unix socket directory
  } else {
    console.warn(`[DB] ⚠️ Unix Socket directory not found at ${socketPath}.`);
    console.warn(`[DB] Fallback: Attempting TCP connection (Expect failure in Cloud Run unless Cloud SQL Proxy is running).`);
    POOL_CONFIG.host = '127.0.0.1';
    POOL_CONFIG.port = 5432;
  }
} else {
  console.log(`[DB] 💻 Development Mode: Connecting to ${host}:${port}`);
  POOL_CONFIG.host = host;
  POOL_CONFIG.port = port;
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
