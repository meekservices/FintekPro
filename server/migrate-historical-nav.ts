import { drizzle } from "drizzle-orm/neon-serverless";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { sql, inArray, asc, count } from "drizzle-orm";
import { historicalNavData } from "@shared/schema";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function main() {
  const devPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  const prodPool = new Pool({ connectionString: process.env.PRODUCTION_DATABASE_URL, max: 3 });
  const devDb = drizzle(devPool);
  const prodDb = drizzle(prodPool);

  try {
    const devSchemes = await devDb.selectDistinct({ identifier: historicalNavData.identifier }).from(historicalNavData);
    const prodSchemes = await prodDb.selectDistinct({ identifier: historicalNavData.identifier }).from(historicalNavData);

    const prodSet = new Set(prodSchemes.map(r => r.identifier));
    const missing = devSchemes.map(r => r.identifier).filter(s => !prodSet.has(s));

    console.log(`📋 Missing identifiers: ${missing.length}`);

    let totalMigrated = 0;
    let totalErrors = 0;
    const CHUNK = 20;
    const BATCH_INSERT = 200;

    for (let chunk = 0; chunk < missing.length; chunk += CHUNK) {
      const schemeChunk = missing.slice(chunk, chunk + CHUNK);

      const rows = await devDb
        .select()
        .from(historicalNavData)
        .where(inArray(historicalNavData.identifier, schemeChunk))
        .orderBy(asc(historicalNavData.identifier), asc(historicalNavData.date));

      for (let i = 0; i < rows.length; i += BATCH_INSERT) {
        const batch = rows.slice(i, i + BATCH_INSERT);

        try {
          await prodDb.insert(historicalNavData).values(
            batch.map((r) => ({
              id: r.id,
              identifier: r.identifier,
              identifierType: r.identifierType,
              date: r.date,
              nav: r.nav,
              open: r.open ?? null,
              high: r.high ?? null,
              low: r.low ?? null,
              close: r.close ?? null,
              volume: r.volume ?? null,
              source: r.source,
              fetchedAt: r.fetchedAt,
              createdAt: r.createdAt,
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

    const [{ cnt }] = await prodDb.select({ cnt: count() }).from(historicalNavData);
    console.log(`\n✅ Done! Migrated: ${totalMigrated}, Errors: ${totalErrors}, Prod total: ${cnt}`);
  } finally {
    await devPool.end();
    await prodPool.end();
  }
}

main();
