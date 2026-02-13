import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

function escapeStr(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

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
        const valuesList = batch.map(r =>
          `(${escapeStr(r.id)},${escapeStr(r.identifier)},${escapeStr(r.identifier_type)},${escapeStr(r.date)},${escapeStr(r.nav)},${escapeStr(r.open)},${escapeStr(r.high)},${escapeStr(r.low)},${escapeStr(r.close)},${escapeStr(r.volume)},${escapeStr(r.source)},${escapeStr(r.fetched_at)},${escapeStr(r.created_at)})`
        ).join(',');
        
        try {
          await prodDb.execute(sql.raw(
            `INSERT INTO historical_nav_data (id,identifier,identifier_type,date,nav,open,high,low,close,volume,source,fetched_at,created_at) VALUES ${valuesList} ON CONFLICT (id) DO NOTHING`
          ));
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
