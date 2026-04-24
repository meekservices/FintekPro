/**
 * Boot-time migration for Governance and NCD schema repairs.
 * Repairs the missing ai_governance_audit_logs table and adds the missing issue_name column.
 */

import { db } from "../db";
import { sql } from "drizzle-orm";

export async function runGovernanceNcdRepair(): Promise<void> {
  try {
    console.log("[GovernanceNCD] Checking for schema repairs...");

    // 1. Repair ai_governance_audit_logs
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ai_governance_audit_logs (
        audit_id varchar(255) PRIMARY KEY,
        user_id varchar(255) NOT NULL,
        input_query text NOT NULL,
        ai_raw_output jsonb NOT NULL,
        final_output jsonb NOT NULL,
        decision varchar(50) NOT NULL,
        violations jsonb DEFAULT '[]',
        risk_flags jsonb DEFAULT '[]',
        model_version varchar(100) NOT NULL,
        trace_id varchar(255),
        partner_ria_id varchar(255),
        timestamp timestamp DEFAULT now()
      )
    `);

    // 2. Add issue_name to ncd_public_issues if missing
    // PostgreSQL ADD COLUMN IF NOT EXISTS is 9.6+, using DO block for compatibility
    await db.execute(sql`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_name = 'ncd_public_issues' AND column_name = 'issue_name'
          ) THEN
              ALTER TABLE "ncd_public_issues" ADD COLUMN "issue_name" text;
              -- Backfill from issuer_name as a sane default
              UPDATE "ncd_public_issues" SET "issue_name" = "issuer_name" WHERE "issue_name" IS NULL;
              -- Now we can safely make it NOT NULL if desired by the schema
              ALTER TABLE "ncd_public_issues" ALTER COLUMN "issue_name" SET NOT NULL;
              RAISE NOTICE 'Added issue_name column to ncd_public_issues';
          END IF;
      END $$;
    `);

    console.log("✅ [GovernanceNCD] DB repair complete (ai_governance_audit_logs, ncd_public_issues.issue_name)");
  } catch (e: any) {
    console.error("❌ [GovernanceNCD] Migration error:", e?.message);
  }
}
