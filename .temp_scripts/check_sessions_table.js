import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function checkTable() {
  console.log("Checking sessions table structure...");
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sessions'
    `);
    console.log("Columns:", JSON.stringify(res.rows, null, 2));
    
    const countRes = await pool.query("SELECT COUNT(*) FROM sessions");
    console.log("Count:", countRes.rows[0].count);
  } catch (err) {
    console.error("Error checking table:", err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkTable();
