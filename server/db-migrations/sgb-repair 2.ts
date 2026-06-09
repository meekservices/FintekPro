import { pool } from "../db";

/**
 * Boot-time migration for SGB schema repairs.
 * Ensures issue_name column exists in sgb_primary_issues and sovereign_gold_bonds.
 */
export async function runSgbRepair(): Promise<void> {
	let client: import("pg").PoolClient | null = null;
	try {
		console.log("[SGBRepair] Checking for schema repairs...");

		// Acquire a dedicated client and disable statement_timeout for this session
		client = await pool.connect();
		await client.query("SET statement_timeout = 0");

		// 1. Repair sgb_primary_issues
		await client.query(`
      DO $$
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sgb_primary_issues') THEN
              IF NOT EXISTS (
                  SELECT FROM information_schema.columns 
                  WHERE table_name = 'sgb_primary_issues' AND column_name = 'issue_name'
              ) THEN
                  ALTER TABLE "sgb_primary_issues" ADD COLUMN "issue_name" text;
                  -- Backfill from series_name as a sane default
                  UPDATE "sgb_primary_issues" SET "issue_name" = "series_name" WHERE "issue_name" IS NULL;
                  RAISE NOTICE 'Added issue_name column to sgb_primary_issues';
              END IF;
          END IF;
      END $$;
    `);

		// 2. Repair sovereign_gold_bonds
		await client.query(`
      DO $$
      BEGIN
          IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sovereign_gold_bonds') THEN
              IF NOT EXISTS (
                  SELECT FROM information_schema.columns 
                  WHERE table_name = 'sovereign_gold_bonds' AND column_name = 'issue_name'
              ) THEN
                  ALTER TABLE "sovereign_gold_bonds" ADD COLUMN "issue_name" text;
                  -- Backfill from series_name as a sane default
                  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'sovereign_gold_bonds' AND column_name = 'series_name') THEN
                      UPDATE "sovereign_gold_bonds" SET "issue_name" = "series_name" WHERE "issue_name" IS NULL;
                  END IF;
                  RAISE NOTICE 'Added issue_name column to sovereign_gold_bonds';
              END IF;
          END IF;
      END $$;
    `);

		console.log(
			"✅ [SGBRepair] DB repair complete (sgb_primary_issues, sovereign_gold_bonds)",
		);
	} catch (e: any) {
		console.error("❌ [SGBRepair] Migration error:", e?.message);
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
