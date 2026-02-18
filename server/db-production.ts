import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;
neonConfig.pipelineConnect = false;

let prodPool: Pool | null = null;
let prodDb: ReturnType<typeof drizzle> | null = null;

export function getProductionDb() {
  if (prodDb) return prodDb;

  const prodUrl = process.env.PRODUCTION_DATABASE_URL;
  if (!prodUrl) {
    throw new Error(
      '[ProductionDB] PRODUCTION_DATABASE_URL not set. Enrichment runs on production only.'
    );
  }

  prodPool = new Pool({
    connectionString: prodUrl,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 20000,
  });

  prodPool.on('error', (err) => {
    console.warn(`[ProductionDB] Pool error (auto-recovering): ${err?.message || err}`);
  });

  prodDb = drizzle({ client: prodPool, schema });
  console.log('[ProductionDB] Production database connection initialized for enrichment');
  return prodDb;
}

export function hasProductionDb(): boolean {
  return !!process.env.PRODUCTION_DATABASE_URL;
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
