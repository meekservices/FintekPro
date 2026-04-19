import { pool } from "../server/db";
import fs from "fs";
import path from "path";
import { logger } from "../server/logger";

async function main() {
  try {
    const sqlPath = path.join(process.cwd(), "scripts", "apply-public-schema-updates.sql");
    logger.info(`[Sync] Reading migration script from ${sqlPath}`);
    
    const sql = fs.readFileSync(sqlPath, "utf-8");
    
    logger.info("[Sync] Executing schema updates against production database...");
    
    // Execute as raw SQL using the pool directly to avoid schema compilation issues
    await pool.query(sql);
    
    logger.info("✅ [Sync] Schema updates applied successfully!");
    process.exit(0);
  } catch (error) {
    logger.error("❌ [Sync] Schema update failed", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  } finally {
    // Release the pool
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
