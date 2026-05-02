-- Production Schema Synchronization
-- Target Schema: public
-- Purpose: Add missing columns required by User Profiling and AI Transaction Tracking

-- 1. Update user_profiles table
ALTER TABLE "user_profiles" 
ADD COLUMN IF NOT EXISTS "kyc_tier" varchar DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS "accredited_investor_status" varchar DEFAULT 'none',
ADD COLUMN IF NOT EXISTS "accredited_investor_expiry_date" timestamp,
ADD COLUMN IF NOT EXISTS "accredited_investor_type" varchar,
ADD COLUMN IF NOT EXISTS "annual_income_amount" numeric(15,2),
ADD COLUMN IF NOT EXISTS "income_proof_documents" jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "net_worth_excluding_residence" numeric(15,2),
ADD COLUMN IF NOT EXISTS "ca_certificate_url" varchar,
ADD COLUMN IF NOT EXISTS "portfolio_value_amount" numeric(15,2),
ADD COLUMN IF NOT EXISTS "portfolio_statement_url" varchar,
ADD COLUMN IF NOT EXISTS "professional_qualification" varchar,
ADD COLUMN IF NOT EXISTS "professional_qualification_verified" boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS "professional_experience_years" integer;

-- 2. Update transaction_enrichment_analysis table
ALTER TABLE "transaction_enrichment_analysis"
ADD COLUMN IF NOT EXISTS "from_date" timestamp,
ADD COLUMN IF NOT EXISTS "to_date" timestamp,
ADD COLUMN IF NOT EXISTS "transaction_count" integer,
ADD COLUMN IF NOT EXISTS "total_inflow" numeric(15,2),
ADD COLUMN IF NOT EXISTS "total_outflow" numeric(15,2),
ADD COLUMN IF NOT EXISTS "net_cash_flow" numeric(15,2),
ADD COLUMN IF NOT EXISTS "average_monthly_income" numeric(15,2),
ADD COLUMN IF NOT EXISTS "average_monthly_expense" numeric(15,2),
ADD COLUMN IF NOT EXISTS "spending_patterns" jsonb,
ADD COLUMN IF NOT EXISTS "income_patterns" jsonb,
ADD COLUMN IF NOT EXISTS "timing_patterns" jsonb,
ADD COLUMN IF NOT EXISTS "frequency_patterns" jsonb,
ADD COLUMN IF NOT EXISTS "risk_factors" jsonb,
ADD COLUMN IF NOT EXISTS "risk_score" integer,
ADD COLUMN IF NOT EXISTS "risk_category" varchar,
ADD COLUMN IF NOT EXISTS "creditworthiness_score" integer,
ADD COLUMN IF NOT EXISTS "disposable_income" numeric(15,2),
ADD COLUMN IF NOT EXISTS "investment_capacity" numeric(15,2),
ADD COLUMN IF NOT EXISTS "emergency_fund_status" varchar,
ADD COLUMN IF NOT EXISTS "debt_to_income_ratio" numeric(5,2),

-- 3. Create unlisted_regulatory_audit_log table if not exists
CREATE TABLE IF NOT EXISTS "unlisted_regulatory_audit_log" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar REFERENCES "users"("id"),
  "user_email" varchar,
  "user_name" varchar,
  "user_role" varchar,
  "user_kyc_tier" varchar,
  "user_pan" varchar,
  "action" varchar NOT NULL,
  "action_category" varchar NOT NULL,
  "entity_type" varchar NOT NULL,
  "entity_id" varchar NOT NULL,
  "company_id" varchar REFERENCES "unlisted_companies"("id"),
  "company_cin" varchar,
  "company_name" varchar,
  "deal_id" varchar,
  "counterparty_user_id" varchar,
  "counterparty_pan" varchar,
  "quantity" bigint,
  "price_per_share" numeric(20,2),
  "total_value" numeric(20,2),
  "platform_fee" numeric(20,2),
  "gst_amount" numeric(20,2),
  "escrow_amount" numeric(20,2),
  "before_state" jsonb,
  "after_state" jsonb,
  "change_description" text,
  "compliance_related" boolean DEFAULT false,
  "compliance_flags" jsonb DEFAULT '[]',
  "risk_level" varchar,
  "compliance_officer" varchar,
  "compliance_notes" text,
  "sebi_reportable" boolean DEFAULT false,
  "sebi_reported_at" timestamp,
  "sebi_report_ref" varchar,
  "rbi_reportable" boolean DEFAULT false,
  "rbi_reported_at" timestamp,
  "rbi_report_ref" varchar,
  "ip_address" varchar,
  "user_agent" text,
  "session_id" varchar,
  "device_fingerprint" varchar,
  "geo_location" varchar,
  "document_ids" jsonb DEFAULT '[]',
  "timestamp" timestamp DEFAULT now(),
  "retention_expires_at" timestamp,
  "archived" boolean DEFAULT false,
  "archived_at" timestamp,
  "metadata" jsonb DEFAULT '{}',
  "forensic_hash" varchar(64),
  "prev_hash" varchar(64)
);

-- Indices for audit log
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_user" ON "unlisted_regulatory_audit_log" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_action" ON "unlisted_regulatory_audit_log" ("action");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_category" ON "unlisted_regulatory_audit_log" ("action_category");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_entity" ON "unlisted_regulatory_audit_log" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_company" ON "unlisted_regulatory_audit_log" ("company_id");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_deal" ON "unlisted_regulatory_audit_log" ("deal_id");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_timestamp" ON "unlisted_regulatory_audit_log" ("timestamp");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_retention" ON "unlisted_regulatory_audit_log" ("retention_expires_at");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_compliance" ON "unlisted_regulatory_audit_log" ("compliance_related");
CREATE INDEX IF NOT EXISTS "idx_unlisted_reg_audit_sebi" ON "unlisted_regulatory_audit_log" ("sebi_reportable");
