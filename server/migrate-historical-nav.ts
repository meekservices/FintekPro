import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { historicalNavData } from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const devPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const prodPool = new Pool({ connectionString: process.env.PRODUCTION_DATABASE_URL, max: 3 });
  const devDb = drizzle(devPool);
  const prodDb = drizzle(prodPool);

  try {
    const devSchemes = await devDb.execute(sql.raw('SELECT DISTINCT identifier FROM historical_nav_data'));
    const prodSchemes = await prodDb.execute(sql.raw('SELECT DISTINCT identifier FROM historical_nav_data'));
    
    const prodSet = new Set((prodSchemes.rows as any[]).map(r => r.identifier));
    const missing = (devSchemes.rows as any[]).map(r => r.identifier).filter(s => !prodSet.has(s));
    
    console.log(`📋 Missing identifiers: ${missing.length}`);
    
    let totalMigrated = 0;
    let totalErrors = 0;
    const CHUNK = 20;
    const BATCH_INSERT = 200;

    for (let chunk = 0; chunk < missing.length; chunk += CHUNK) {
      const schemeChunk = missing.slice(chunk, chunk + CHUNK);
      const inClause = schemeChunk.map(s => `'${String(s).replace(/'/g, "''")}'`).join(',');
      
      const rows = await devDb.execute(sql.raw(
        `SELECT id, identifier, identifier_type, date, nav, open, high, low, close, volume, source, fetched_at, created_at FROM historical_nav_data WHERE identifier IN (${inClause}) ORDER BY identifier, date`
      ));
      
      const data = rows.rows as any[];
      
      for (let i = 0; i < data.length; i += BATCH_INSERT) {
        const batch = data.slice(i, i + BATCH_INSERT);
        
        try {
          await prodDb.insert(historicalNavData).values(
            batch.map((r: any) => ({
              id: r.id,
              identifier: r.identifier,
              identifierType: r.identifier_type,
              date: r.date,
              nav: r.nav,
              open: r.open ?? null,
              high: r.high ?? null,
              low: r.low ?? null,
              close: r.close ?? null,
              volume: r.volume ?? null,
              source: r.source,
              fetchedAt: r.fetched_at ? new Date(r.fetched_at) : new Date(),
              createdAt: r.created_at ? new Date(r.created_at) : new Date(),
            }))
          ).onConflictDoNothing();
          totalMigrated += batch.length;
        } catch {
          totalErrors += batch.length;
        }
      }
      
      const done = Math.min(chunk + CHUNK, missing.length);
      console.log(`   Schemes ${done}/${missing.length}: ${totalMigrated} rows, ${totalErrors} errors`);
    }

    const finalRes = await prodDb.execute(sql.raw('SELECT COUNT(*) as cnt FROM historical_nav_data'));
    console.log(`\n✅ Done! Migrated: ${totalMigrated}, Errors: ${totalErrors}, Prod total: ${(finalRes.rows[0] as any).cnt}`);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

main();
