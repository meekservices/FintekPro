import "dotenv/config";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function checkDbHealth() {
  console.log("--- Checking Database Health ---");

  try {
    // 1. Check if indexes exist on historical_nav_data
    console.log("\n1. Checking indexes on historical_nav_data...");
    const indexes = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'historical_nav_data';
    `);
    console.log("Indexes found:", JSON.stringify(indexes.rows, null, 2));

    // 2. Check for duplicate rows in historical_nav_data
    console.log("\n2. Checking for duplicates in historical_nav_data...");
    const duplicates = await db.execute(sql`
      SELECT identifier, identifier_type, date, COUNT(*) 
      FROM historical_nav_data 
      GROUP BY identifier, identifier_type, date 
      HAVING COUNT(*) > 1 
      LIMIT 10;
    `);
    console.log("Duplicate samples:", JSON.stringify(duplicates.rows, null, 2));

    // 3. Check table size
    console.log("\n3. Checking table size...");
    const size = await db.execute(sql`
      SELECT count(*) FROM historical_nav_data;
    `);
    console.log("Total rows in historical_nav_data:", size.rows[0].count);

    // 4. Check query performance for a sample scheme
    console.log("\n4. Checking query performance for sample scheme...");
    const start = Date.now();
    const sample = await db.execute(sql`
      EXPLAIN ANALYZE 
      SELECT * FROM historical_nav_data 
      WHERE identifier = '119063' AND identifier_type = 'mutual_fund' 
      ORDER BY date ASC;
    `);
    const duration = Date.now() - start;
    console.log("Query duration:", duration, "ms");
    console.log("Explain Analyze output:", JSON.stringify(sample.rows, null, 2));

    // 5. Check if ai_governance_audit_logs table exists
    console.log("\n5. Checking for ai_governance_audit_logs table...");
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'ai_governance_audit_logs'
      );
    `);
    console.log("Table ai_governance_audit_logs exists:", tableCheck.rows[0].exists);

  } catch (error) {
    console.error("Error checking health:", error);
  } finally {
    process.exit(0);
  }
}

checkDbHealth();
