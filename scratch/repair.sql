-- Create ai_governance_audit_logs
CREATE TABLE IF NOT EXISTS "ai_governance_audit_logs" (
  "audit_id" varchar(255) PRIMARY KEY,
  "user_id" varchar(255) NOT NULL,
  "input_query" text NOT NULL,
  "ai_raw_output" jsonb NOT NULL,
  "final_output" jsonb NOT NULL,
  "decision" varchar(50) NOT NULL,
  "violations" jsonb DEFAULT '[]',
  "risk_flags" jsonb DEFAULT '[]',
  "model_version" varchar(100) NOT NULL,
  "trace_id" varchar(255),
  "partner_ria_id" varchar(255),
  "timestamp" timestamp DEFAULT now()
);

-- Add issue_name to ncd_public_issues
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ncd_public_issues' AND column_name = 'issue_name'
    ) THEN
        ALTER TABLE "ncd_public_issues" ADD COLUMN "issue_name" text;
        UPDATE "ncd_public_issues" SET "issue_name" = "issuer_name" WHERE "issue_name" IS NULL;
        ALTER TABLE "ncd_public_issues" ALTER COLUMN "issue_name" SET NOT NULL;
    END IF;
END $$;
