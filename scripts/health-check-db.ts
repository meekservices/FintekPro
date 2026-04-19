import pg from 'pg';
const { Pool } = pg;
import dotenv from "dotenv";

dotenv.config();

async function check() {
  const selectedDbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  if (!selectedDbUrl) { console.error("No DB URL"); process.exit(1); }
  
  function toDirectUrl(url) { return url.replace(/\.c-\d+\./, "."); }
  const isProd = !!process.env.PRODUCTION_DATABASE_URL;
  const dbUrl = isProd ? toDirectUrl(selectedDbUrl) : selectedDbUrl;
  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    const res = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('user_profiles', 'transaction_enrichment_analysis')
      AND column_name IN ('kyc_tier', 'accredited_investor_status', 'net_cash_flow', 'risk_score')
      ORDER BY table_name, column_name;
    `);
    
    console.log("--- Database Health Check ---");
    if (res.rows.length === 0) {
      console.log("❌ New columns NOT found.");
    } else {
      console.log(`✅ Found ${res.rows.length} of requested columns across the tables.`);
      res.rows.forEach(r => console.log(`   - ${r.table_name}.${r.column_name}`));
    }
  } catch (e) {
    console.error("❌ DB Check failed:", e.message);
  } finally {
    await pool.end();
  }
}

check();
