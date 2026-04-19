import pg from 'pg';
const { Pool } = pg;
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function main() {
  const selectedDbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  
  if (!selectedDbUrl) {
    console.error("❌ No database URL found in environment.");
    process.exit(1);
  }

  function toDirectUrl(url: string) {
    return url.replace(/\.c-\d+\./, ".");
  }

  const isProd = !!process.env.PRODUCTION_DATABASE_URL;
  const dbUrl = isProd ? toDirectUrl(selectedDbUrl) : selectedDbUrl;
  const needsSsl = isProd || dbUrl.includes('.neon.') || dbUrl.includes('rlwy.net');

  console.log(`[Sync] Connecting to ${isProd ? 'Production' : 'Development'} Database...`);
  
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: needsSsl ? { rejectUnauthorized: false } : false,
  });

  try {
    const sqlPath = path.join(process.cwd(), "scripts", "apply-public-schema-updates.sql");
    console.log(`[Sync] Reading migration script from ${sqlPath}`);
    
    const sql = fs.readFileSync(sqlPath, "utf-8");
    
    console.log("[Sync] Executing schema updates...");
    
    await pool.query(sql);
    
    console.log("✅ [Sync] Schema updates applied successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ [Sync] Schema update failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
