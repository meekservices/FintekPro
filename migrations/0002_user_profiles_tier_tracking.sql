-- Retroactive Migration: User Profiles Tier Tracking Columns
-- Created: 2025-11-15
-- Purpose: Document emergency hotfix columns added to support 3-tier KYC workflow system
--
-- Context: These 16 columns were added via emergency SQL patch to unblock tier-status endpoint.
-- This migration provides the auditable trail required for fintech compliance.
--
-- Idempotency: Uses ADD COLUMN IF NOT EXISTS to safely apply on databases with/without columns.

-- Net Worth & Currency Tracking (Tier 2→3 Requirements)
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "net_worth_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "net_worth_currency" varchar DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "base_currency" varchar DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "display_currency" varchar DEFAULT 'INR';--> statement-breakpoint

-- Accredited Investor Verification Tracking
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "accredited_investor_status" varchar DEFAULT 'not_verified';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "accredited_investor_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "accredited_investor_verified_by" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "accredited_investor_expiry_date" timestamp;--> statement-breakpoint

-- BSE Accreditation Certificate Tracking
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "ai_certificate_number" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "ai_certificate_id" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "ai_verified_at" timestamp;--> statement-breakpoint

-- eSign Risk Declaration Tracking
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "risk_declaration_url" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "ai_esign_status" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "ai_status_source" varchar;--> statement-breakpoint

-- Profile Completion Tracking
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "profile_completion_percentage" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "last_updated_at" timestamp DEFAULT now();--> statement-breakpoint

-- Compliance Note:
-- This migration captures schema changes from emergency hotfix (2025-11-14) that resolved
-- critical tier-status endpoint failures. All statements are idempotent for safe deployment
-- across environments with varying schema states.
