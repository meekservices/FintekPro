import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-optimized connection pool configuration
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: process.env.NODE_ENV === 'production' ? 20 : 10, // Max connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for establishing connection (10s)
});

export const db = drizzle({ client: pool, schema });