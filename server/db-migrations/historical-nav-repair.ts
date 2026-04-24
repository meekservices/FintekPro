/**
 * Boot-time migration to optimize historical_nav_data indexes.
 * Large tables without indexes cause statement timeouts.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runHistoricalNavIndexRepair(): Promise<void> {
  try {
    console.log("[HistoricalNavRepair] Checking for index repairs...");

    // 1. Basic index for identifier lookups
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_historical_nav_identifier 
      ON historical_nav_data (identifier, identifier_type);
    `);

    // 2. Index for date-range queries
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_historical_nav_date 
      ON historical_nav_data (identifier, date);
    `);

    // 3. Deduplicate before creating unique index
    // This is critical for data integrity and performance of ON CONFLICT
    console.log("[HistoricalNavRepair] Deduplicating records...");
    await db.execute(sql`
      DELETE FROM historical_nav_data a USING historical_nav_data b
      WHERE a.id < b.id
        AND a.identifier = b.identifier
        AND a.identifier_type = b.identifier_type
        AND a.date = b.date;
    `);

    // 4. Create unique index for ON CONFLICT support
    await db.execute(sql`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE c.relname = 'idx_historical_nav_unique' AND n.nspname = 'public'
          ) THEN
              CREATE UNIQUE INDEX idx_historical_nav_unique 
              ON historical_nav_data (identifier, identifier_type, date);
          END IF;
      END $$;
    `);

    console.log("✅ [HistoricalNavRepair] Indexes optimized and duplicates removed");
  } catch (e: any) {
    console.error("❌ [HistoricalNavRepair] Migration error:", e?.message);
    // Non-blocking: don't crash the server if index creation times out, 
    // it will try again on next boot or can be run manually.
  }
}
