/**
 * Boot-time migration to optimize historical_nav_data indexes.
 * Large tables without indexes cause statement timeouts.
 *
 * Uses a raw pg client with statement_timeout disabled so that
 * heavy deduplication DELETEs and CREATE INDEX operations are
 * not killed by the pool-level 30-second timeout.
 */

import { pool } from "../db";

export async function runHistoricalNavIndexRepair(): Promise<void> {
  let client: import("pg").PoolClient | null = null;
  try {
    console.log("[HistoricalNavRepair] Checking for index repairs...");

    // Acquire a dedicated client and disable statement_timeout for this session
    client = await pool.connect();
    await client.query("SET statement_timeout = 0");

    // 1. Basic index for identifier lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_historical_nav_identifier 
      ON historical_nav_data (identifier, identifier_type);
    `);

    // 2. Index for date-range queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_historical_nav_date 
      ON historical_nav_data (identifier, date);
    `);

    // 3. Deduplicate before creating unique index
    // This is critical for data integrity and performance of ON CONFLICT
    console.log("[HistoricalNavRepair] Deduplicating records...");
    const dedup = await client.query(`
      DELETE FROM historical_nav_data a USING historical_nav_data b
      WHERE a.id < b.id
        AND a.identifier = b.identifier
        AND a.identifier_type = b.identifier_type
        AND a.date = b.date;
    `);
    console.log(`[HistoricalNavRepair] Deduplication complete. Rows removed: ${dedup.rowCount}`);

    // 4. Create unique index for ON CONFLICT support
    await client.query(`
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
  } finally {
    if (client) {
      try {
        await client.query("RESET statement_timeout");
      } catch (_) {
        // Ignore — client may already be dead
      }
      client.release();
    }
  }
}
