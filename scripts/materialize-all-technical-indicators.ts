/* eslint-disable no-console */
/**
 * @file materialize-all-technical-indicators.ts
 * @description Vectorized calculation of RSI-14, MACD, SMA 50/200, Bollinger Bands, ATR-14,
 *              and Technical Ratings for all stocks with OHLCV data in screener_price_history.
 *              Populates screener_technical_indicators_latest and refreshes screener_master_snapshots.
 */

import * as dotenv from "dotenv";
dotenv.config();

import { pool, db } from "../server/db";
import { sql } from "drizzle-orm";
import { computeTechnicalSnapshotForSymbol } from "../server/services/screener/screener-enrichment-engine";
import { screenerMasterSnapshotService } from "../server/services/screener/screener-master-snapshot-service";

async function main() {
  console.log("================================================================================");
  console.log("   FINTEKPRO: Vectorized Technical Indicators Materialization Engine");
  console.log("================================================================================\n");

  const t0 = Date.now();

  // Find all distinct symbols in screener_price_history
  const symbolsRes = await db.execute(sql`
    SELECT DISTINCT symbol
    FROM screener_price_history
    WHERE symbol IS NOT NULL
    ORDER BY symbol ASC
  `);

  const symbols = (symbolsRes.rows as Array<{ symbol: string }>).map((r) => r.symbol);
  console.log(`Found ${symbols.length} distinct symbols with price history.`);

  const CONCURRENCY = 25;
  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  const totalBatches = Math.ceil(symbols.length / CONCURRENCY);

  for (let b = 0; b < totalBatches; b++) {
    const batch = symbols.slice(b * CONCURRENCY, (b + 1) * CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (sym) => {
        return computeTechnicalSnapshotForSymbol(sym);
      }),
    );

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled") {
        if (r.value) succeeded++;
        else skipped++;
      } else {
        failed++;
      }
    }

    if ((b + 1) % 10 === 0 || b + 1 === totalBatches) {
      const pct = Math.round(((b + 1) / totalBatches) * 100);
      console.log(`[Batch ${b + 1}/${totalBatches} (${pct}%)] Processed: ${succeeded} updated, ${skipped} skipped (<14 bars), ${failed} failed`);
    }
  }

  const calcDuration = Date.now() - t0;
  console.log(`\n✅ Technical indicators materialization complete in ${Math.round(calcDuration / 1000)}s!`);
  console.log(`   Updated: ${succeeded} | Skipped: ${skipped} | Failed: ${failed}`);

  // Rebuilding screener_master_snapshots
  console.log("\n🔄 Rebuilding screener_master_snapshots with updated technical indicators...");
  const snapT0 = Date.now();
  const snapResult = await screenerMasterSnapshotService.rebuildFullSnapshot();
  console.log(`✅ Master snapshots rebuilt in ${Date.now() - snapT0}ms! Snapshots: ${snapResult.snapshotsCount}`);

  if (pool && typeof pool.end === "function") {
    await pool.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

