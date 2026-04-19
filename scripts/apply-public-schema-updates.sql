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
ADD COLUMN IF NOT EXISTS "ai_model_version" varchar,
ADD COLUMN IF NOT EXISTS "analysis_confidence" numeric(5,2),
ADD COLUMN IF NOT EXISTS "next_analysis_date" timestamp;
