import pg from 'pg';
const { Pool } = pg;
import dotenv from "dotenv";

dotenv.config();

async function check() {
  const selectedDbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;
  if (!selectedDbUrl) { console.error("No DB URL"); process.exit(1); }
  
  const poolConfig: any = {
    connectionString: selectedDbUrl,
    ssl: false
  };

  // Optimization: use 127.0.0.1 if host= is present but we are local
  if (selectedDbUrl.includes('host=')) {
    try {
      const url = new URL(selectedDbUrl);
      console.log(`📡 Detected Cloud SQL URL. Redirecting to local proxy at 127.0.0.1:5432...`);
      poolConfig.host = '127.0.0.1';
      poolConfig.port = 5432;
      poolConfig.user = url.username;
      poolConfig.password = url.password;
      poolConfig.database = url.pathname.split('/')[1] || 'fintekpro';
      delete poolConfig.connectionString;
    } catch (e: any) {
      console.warn(`⚠️  Failed to parse DB URL: ${e.message}`);
    }
  } else {
    console.log(`📡 Using standard connection string: ${selectedDbUrl.split('@')[1] || '...'}`);
  }

  const pool = new Pool(poolConfig);

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
