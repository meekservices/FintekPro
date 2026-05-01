-- SQL Migration to add missing columns to compliance_audit_trail
-- Run this against your production database to resolve 'entity_id' errors

ALTER TABLE "compliance_audit_trail" 
ADD COLUMN IF NOT EXISTS "field_changed" varchar,
ADD COLUMN IF NOT EXISTS "entity_id" varchar,
ADD COLUMN IF NOT EXISTS "entity_type" varchar,
ADD COLUMN IF NOT EXISTS "performed_by" varchar,
ADD COLUMN IF NOT EXISTS "performed_by_role" varchar,
ADD COLUMN IF NOT EXISTS "old_value" jsonb,
ADD COLUMN IF NOT EXISTS "new_value" jsonb,
ADD COLUMN IF NOT EXISTS "risk_impact" varchar,
ADD COLUMN IF NOT EXISTS "compliance_impact" varchar,
ADD COLUMN IF NOT EXISTS "reason" text,
ADD COLUMN IF NOT EXISTS "metadata" jsonb,
ADD COLUMN IF NOT EXISTS "timestamp" timestamp DEFAULT NOW();

-- Also ensure regulatory audit logs have index for performance
CREATE INDEX IF NOT EXISTS "idx_kyc_audit_user" ON "kyc_regulatory_audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_kyc_audit_created_at" ON "kyc_regulatory_audit_logs" ("created_at");
