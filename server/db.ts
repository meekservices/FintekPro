import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';
import fs from 'fs';
import path from 'path';

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

// 1. Initial Load of DATABASE_URL
let dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

// 2. Production Fallback for missing environment variables
if (isProduction) {
  console.log(`[DB] 🔍 Production Diagnostics:`);
  console.log(`[DB] - INSTANCE_CONNECTION_NAME: ${instanceConnectionName}`);
  
  if (!dbUrl || !process.env.SESSION_SECRET) {
    try {
      const envPath = path.resolve(process.cwd(), 'cloudrun-env.yaml');
      if (fs.existsSync(envPath)) {
        console.log(`[DB] 💡 Loading config from ${envPath}...`);
        const content = fs.readFileSync(envPath, 'utf8');
        content.split('\n').forEach(line => {
          const match = line.match(/^([^:]+):\s*"([^"]+)"/);
          if (match) {
            const [, key, value] = match;
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        });
        // Re-sync local variable
        dbUrl = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
        console.log(`[DB] ✅ Reloaded DATABASE_URL: ${!!dbUrl}`);
      }
    } catch (e) {
      console.error(`[DB] ❌ Failed to load cloudrun-env.yaml:`, e);
    }
  }
}

// 3. Build Pool Configuration
const POOL_CONFIG: any = {
  max: 50,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
};

if (dbUrl) {
  POOL_CONFIG.connectionString = dbUrl;
  console.log(`[DB] 🔗 Using DATABASE_URL connection string.`);
} else {
  POOL_CONFIG.user = user;
  POOL_CONFIG.password = password;
  POOL_CONFIG.database = database;
  POOL_CONFIG.host = host;
  POOL_CONFIG.port = port;
  console.log(`[DB] ⚠️ No DATABASE_URL found. Using default parameters.`);
}

// 4. Unix Socket Overrides (Only if connectionString doesn't already specify it)
if (isProduction) {
  try {
    const rootDir = '/cloudsql';
    const socketPath = `/cloudsql/${instanceConnectionName}`;

    console.log(`[DB] 🔍 Checking for Cloud SQL Socket at: ${socketPath}`);

    if (fs.existsSync(rootDir)) {
      const contents = fs.readdirSync(rootDir);
      console.log(`[DB] ✅ ${rootDir} exists. Found: ${contents.join(', ')}`);
    } else {
      console.warn(`[DB] ⚠️ ${rootDir} directory does NOT exist. This usually means the Cloud SQL instance is not attached to the Cloud Run service.`);
    }

    if (dbUrl && (dbUrl.includes('/cloudsql/') || dbUrl.includes('host='))) {
      console.log(`[DB] 🚀 Socket path detected in connection string.`);
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
