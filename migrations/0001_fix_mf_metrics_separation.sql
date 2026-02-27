CREATE TYPE "public"."dev_approval_status" AS ENUM('OBTAINED', 'APPLIED', 'PENDING', 'NOT_REQUIRED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."encumbrance_status" AS ENUM('CLEAR', 'ENCUMBERED', 'PARTIALLY_CLEAR', 'UNDER_VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."lead_processing_mode" AS ENUM('PLATFORM', 'EXTERNAL_FINANCIER');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('REGISTERED', 'LOGGED_IN', 'APPROVED', 'DISBURSED');--> statement-breakpoint
CREATE TYPE "public"."loan_sub_type" AS ENUM('BUILDER_FUNDING', 'PROJECT_FUNDING', 'CONSTRUCTION_FINANCE', 'LRD', 'LAND_FINANCE', 'INVENTORY_FINANCE', 'MEZZANINE', 'BRIDGE');--> statement-breakpoint
CREATE TYPE "public"."loan_vertical" AS ENUM('RETAIL', 'MSME', 'DEVELOPER');--> statement-breakpoint
CREATE TYPE "public"."master_dsa_claim_status" AS ENUM('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'PAID', 'PARTIALLY_PAID', 'DISPUTED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payout_claim_status" AS ENUM('PENDING_VERIFICATION', 'CONFIRMED_BY_FINANCIER', 'APPROVED', 'ON_HOLD_PDD', 'REJECTED', 'CLAWED_BACK');--> statement-breakpoint
CREATE TYPE "public"."pdd_status" AS ENUM('NOT_APPLICABLE', 'PENDING', 'CLEARED', 'EXCEPTION_ALLOWED');--> statement-breakpoint
CREATE TYPE "public"."project_stage" AS ENUM('LAND_ACQUISITION', 'APPROVALS', 'CONSTRUCTION_EARLY', 'CONSTRUCTION_MID', 'CONSTRUCTION_ADVANCED', 'NEAR_COMPLETION', 'COMPLETED', 'POSSESSION');--> statement-breakpoint
CREATE TYPE "public"."title_status" AS ENUM('CLEAR', 'DISPUTED', 'UNDER_LITIGATION', 'UNDER_VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."tranch_status" AS ENUM('PENDING', 'RELEASED', 'ON_HOLD', 'CANCELLED');--> statement-breakpoint
ALTER TYPE "public"."pick_category" ADD VALUE 'derivatives';--> statement-breakpoint
CREATE TABLE "agent_loan_actions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_name" varchar,
	"agent_email" varchar,
	"action_type" varchar NOT NULL,
	"action_description" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"affected_fields" text[] DEFAULT ARRAY[]::text[],
	"bank_code" varchar,
	"document_id" varchar,
	"remarks" text,
	"ip_address" varchar,
	"user_agent" varchar,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_loan_status_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"previous_status" varchar,
	"new_status" varchar NOT NULL,
	"changed_by" varchar NOT NULL,
	"changed_by_type" varchar NOT NULL,
	"remarks" text NOT NULL,
	"bank_code" varchar,
	"bank_reference" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_payout_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_number" varchar,
	"application_id" varchar NOT NULL,
	"routing_history_id" varchar,
	"commission_tracking_id" varchar,
	"agent_id" varchar NOT NULL,
	"claimed_amount" numeric(15, 2) NOT NULL,
	"approved_amount" numeric(15, 2),
	"disbursed_amount" numeric(15, 2) NOT NULL,
	"disbursement_date" date NOT NULL,
	"bank_confirmation_number" varchar,
	"disbursement_proof_url" varchar,
	"status" "payout_claim_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_remarks" text,
	"rejection_reason" text,
	"payment_reference" varchar,
	"payment_date" date,
	"payment_mode" varchar,
	"zoho_invoice_id" varchar,
	"zoho_payment_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agent_payout_claims_claim_number_unique" UNIQUE("claim_number")
);
--> statement-breakpoint
CREATE TABLE "ai_feature_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" varchar(100) NOT NULL,
	"asset_class" varchar(50) NOT NULL,
	"snapshot_date" date NOT NULL,
	"feature_json" jsonb NOT NULL,
	"regime_label" varchar(20),
	"scoring_weights" jsonb,
	"composite_score" numeric(8, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_model_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"model_version" varchar(20) NOT NULL,
	"asset_class" varchar(50),
	"model_type" varchar(50) NOT NULL,
	"parameters" jsonb NOT NULL,
	"performance_metrics" jsonb,
	"is_active" boolean DEFAULT false,
	"activated_at" timestamp,
	"deactivated_at" timestamp,
	"trained_on_window" varchar(50),
	"notes" text,
	"created_by" varchar(50) DEFAULT 'system',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_prediction_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"pick_id" integer,
	"model_name" varchar(100) NOT NULL,
	"model_version" varchar(20) NOT NULL,
	"asset_class" varchar(50) NOT NULL,
	"predicted_return" numeric(10, 4),
	"predicted_confidence" numeric(5, 2),
	"actual_return" numeric(10, 4),
	"feature_vector" jsonb NOT NULL,
	"prediction_date" date NOT NULL,
	"outcome_date" date,
	"is_correct_direction" boolean,
	"drift_score" numeric(8, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_price_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" varchar(100) NOT NULL,
	"asset_class" varchar(50) NOT NULL,
	"price_date" date NOT NULL,
	"open" numeric(18, 4),
	"high" numeric(18, 4),
	"low" numeric(18, 4),
	"close" numeric(18, 4) NOT NULL,
	"adj_close" numeric(18, 4),
	"volume" numeric(20, 0),
	"change_percent" numeric(10, 4),
	"source" varchar(50),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_regime_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"regime_date" date NOT NULL,
	"regime_label" varchar(20) NOT NULL,
	"confidence" numeric(5, 2) NOT NULL,
	"volatility_score" numeric(8, 4),
	"breadth_score" numeric(8, 4),
	"trend_score" numeric(8, 4),
	"momentum_score" numeric(8, 4),
	"signal_details" jsonb,
	"nifty_close" numeric(18, 4),
	"nifty_change" numeric(10, 4),
	"india_vix" numeric(8, 4),
	"advance_decline_ratio" numeric(8, 4),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_regime_history_regime_date_unique" UNIQUE("regime_date")
);
--> statement-breakpoint
CREATE TABLE "ai_user_interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"pick_id" integer NOT NULL,
	"interaction_type" varchar(30) NOT NULL,
	"metadata" jsonb,
	"session_id" varchar(100),
	"device_type" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_user_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"risk_tolerance_score" numeric(5, 2),
	"engagement_score" numeric(5, 2),
	"preferred_categories" jsonb,
	"avg_holding_days" numeric(8, 2),
	"avg_investment_amount" numeric(18, 2),
	"total_interactions" integer DEFAULT 0,
	"investment_count" integer DEFAULT 0,
	"profitable_trades_ratio" numeric(5, 2),
	"preferred_risk_level" varchar(20),
	"last_active_at" timestamp,
	"profile_version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "amfi_scheme_benchmarks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mf_isin" varchar(20),
	"scheme_code" varchar(20),
	"scheme_name" text,
	"scheme_category" varchar(100),
	"raw_benchmark" text,
	"normalized_benchmark" varchar(30),
	"normalization_status" varchar(20) DEFAULT 'pending',
	"parsed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "amfi_scheme_benchmarks_mf_isin_unique" UNIQUE("mf_isin")
);
--> statement-breakpoint
CREATE TABLE "bank_api_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"environment" varchar NOT NULL,
	"operation" varchar NOT NULL,
	"request_id" varchar NOT NULL,
	"endpoint" varchar,
	"http_method" varchar,
	"request_payload_hash" varchar,
	"response_status" integer,
	"response_time" integer,
	"success" boolean NOT NULL,
	"error_code" varchar,
	"error_message" text,
	"user_id" varchar,
	"application_id" varchar,
	"ip_address" varchar,
	"user_agent" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_credentials_vault" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"credential_type" varchar NOT NULL,
	"encrypted_value" text NOT NULL,
	"environment" varchar DEFAULT 'sandbox' NOT NULL,
	"key_version" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "bank_interaction_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" varchar NOT NULL,
	"bank_code" varchar NOT NULL,
	"event_type" "bank_interaction_event_type" NOT NULL,
	"reported_by" "bank_interaction_reporter" NOT NULL,
	"reported_by_id" varchar,
	"reference_id" varchar,
	"remarks" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_oauth_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"environment" varchar DEFAULT 'sandbox' NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"token_type" varchar DEFAULT 'Bearer',
	"scope" text,
	"expires_at" timestamp NOT NULL,
	"refresh_expires_at" timestamp,
	"issued_at" timestamp NOT NULL,
	"last_used" timestamp,
	"refresh_count" integer DEFAULT 0,
	"status" varchar DEFAULT 'active',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bank_product_appetite" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_code" varchar NOT NULL,
	"loan_sub_type" "loan_sub_type" NOT NULL,
	"is_active" boolean DEFAULT true,
	"min_ticket_size" numeric(18, 2),
	"max_ticket_size" numeric(18, 2),
	"min_dscr" numeric(8, 2),
	"max_ltv" numeric(5, 2),
	"max_ltc" numeric(5, 2),
	"min_promoter_contribution" numeric(5, 2),
	"required_escrow" boolean DEFAULT true,
	"allowed_project_stages" text[] DEFAULT ARRAY[]::text[],
	"allowed_cities" text[] DEFAULT ARRAY[]::text[],
	"allowed_states" text[] DEFAULT ARRAY[]::text[],
	"interest_rate_min" numeric(5, 2),
	"interest_rate_max" numeric(5, 2),
	"max_tenure_months" integer,
	"special_conditions" text,
	"min_track_record_projects" integer,
	"yield_expectation_min" numeric(5, 2),
	"yield_expectation_max" numeric(5, 2),
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "banker_confirmation_emails" (
	"email_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" varchar NOT NULL,
	"banker_email" varchar(200) NOT NULL,
	"senior_email" varchar(200),
	"cc_admin_email" varchar(200),
	"email_subject" text NOT NULL,
	"email_body" text NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"reply_received" boolean DEFAULT false,
	"reply_received_at" timestamp,
	"reply_content" text,
	"tagged_by_admin_id" varchar,
	"tagged_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "broker_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"broker_code" varchar(50) NOT NULL,
	"broker_name" varchar(200) NOT NULL,
	"broker_type" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"api_endpoint" varchar(500),
	"api_version" varchar(20),
	"required_env_vars" jsonb,
	"supported_products" jsonb,
	"features" jsonb,
	"health_status" varchar(20) DEFAULT 'unknown',
	"last_health_check" timestamp,
	"configuration" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "broker_configurations_broker_code_unique" UNIQUE("broker_code")
);
--> statement-breakpoint
CREATE TABLE "commission_config" (
	"config_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar NOT NULL,
	"agent_pct" numeric(5, 2) DEFAULT '70.00' NOT NULL,
	"platform_pct" numeric(5, 2) DEFAULT '15.00' NOT NULL,
	"upline_incentive_pct" numeric(5, 2) DEFAULT '5.00' NOT NULL,
	"min_residual_threshold" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commission_execution" (
	"transaction_id" varchar PRIMARY KEY NOT NULL,
	"executed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consent_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"session_id" varchar(100),
	"consent_type" varchar(50) NOT NULL,
	"action" varchar(20) NOT NULL,
	"version" varchar(20) DEFAULT '1.0',
	"source_screen" varchar(100),
	"source_component" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"consent_text" text,
	"additional_data" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"consent_type" varchar(50) NOT NULL,
	"purpose_code" varchar(50) NOT NULL,
	"purpose_description" text NOT NULL,
	"consent_given" boolean NOT NULL,
	"consent_timestamp" timestamp DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp,
	"withdrawal_reason" text,
	"ip_address" varchar(50),
	"user_agent" text,
	"data_retention_days" integer DEFAULT 365,
	"retention_expires_at" timestamp,
	"regulatory_basis" varchar(100),
	"version" varchar(20) DEFAULT '1.0',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversion_funnels" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"session_id" varchar(100),
	"funnel_type" varchar(50) NOT NULL,
	"product_type" varchar(50),
	"current_step" varchar(50) NOT NULL,
	"step_sequence" integer NOT NULL,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"dropped_at" timestamp,
	"drop_reason" varchar(200),
	"duration_ms" integer,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "developer_financials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"financial_year" varchar NOT NULL,
	"revenue" numeric(18, 2),
	"pat_profit" numeric(18, 2),
	"net_worth" numeric(18, 2),
	"total_debt" numeric(18, 2),
	"total_assets" numeric(18, 2),
	"current_ratio" numeric(8, 2),
	"debt_equity_ratio" numeric(8, 2),
	"dscr" numeric(8, 2),
	"interest_coverage" numeric(8, 2),
	"promoter_contribution" numeric(18, 2),
	"promoter_contribution_percent" numeric(5, 2),
	"escrow_balance" numeric(18, 2),
	"cash_and_equivalents" numeric(18, 2),
	"operating_cashflow" numeric(18, 2),
	"audited_by" varchar,
	"audit_report_url" varchar,
	"itr_filing_date" date,
	"remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "developer_projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" varchar,
	"developer_name" varchar NOT NULL,
	"developer_cin" varchar,
	"developer_pan" varchar,
	"promoter_name" varchar,
	"promoter_din" varchar,
	"contact_email" varchar,
	"contact_phone" varchar,
	"project_name" varchar NOT NULL,
	"rera_number" varchar,
	"rera_state" varchar,
	"project_city" varchar,
	"project_state" varchar,
	"project_address" text,
	"project_stage" "project_stage" DEFAULT 'LAND_ACQUISITION',
	"project_type" varchar,
	"total_units" integer,
	"units_sold" integer DEFAULT 0,
	"total_salable_area" numeric(15, 2),
	"total_project_cost" numeric(18, 2),
	"total_project_revenue" numeric(18, 2),
	"expected_completion_date" date,
	"project_tenure_months" integer,
	"land_cost" numeric(18, 2),
	"construction_cost" numeric(18, 2),
	"approval_cost" numeric(15, 2),
	"marketing_cost" numeric(15, 2),
	"finance_cost" numeric(15, 2),
	"contingency_cost" numeric(15, 2),
	"status" varchar DEFAULT 'active',
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dispute_cases" (
	"dispute_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"raised_by_partner_id" varchar NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"reason_code" varchar(100) NOT NULL,
	"description" text,
	"resolved_by" varchar,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enrichment_job_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"instrument_id" varchar,
	"symbol" varchar,
	"status" varchar(20) NOT NULL,
	"message" text,
	"records_processed" integer DEFAULT 0,
	"executed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "enrichment_retry_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"instrument_id" varchar NOT NULL,
	"symbol" varchar,
	"job_type" varchar(50) NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fmp_usage_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" varchar NOT NULL,
	"provider" varchar DEFAULT 'fmp' NOT NULL,
	"call_count" integer DEFAULT 0 NOT NULL,
	"daily_limit" integer DEFAULT 250 NOT NULL,
	"last_alert_level" varchar,
	"last_call_at" timestamp,
	"call_details" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_benchmark_mapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_type" varchar NOT NULL,
	"risk_profile" varchar NOT NULL,
	"horizon_years_min" integer NOT NULL,
	"horizon_years_max" integer,
	"benchmark_code" varchar(30) NOT NULL,
	"benchmark_name" varchar NOT NULL,
	"benchmark_rationale" text,
	"is_default" boolean DEFAULT true,
	"overridden_by" varchar,
	"overridden_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "governance_policy" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"potd_signal" text NOT NULL,
	"rebalance_signal" text NOT NULL,
	"resolved_action" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "governance_policy_rule_id_unique" UNIQUE("rule_id")
);
--> statement-breakpoint
CREATE TABLE "holding_lots_v2" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"holding_id" varchar,
	"user_id" varchar,
	"prospect_id" varchar,
	"created_by_agent_id" varchar,
	"isin" varchar(12) NOT NULL,
	"folio_number" varchar,
	"scheme_name" text,
	"amc_code" varchar,
	"purchase_date" date NOT NULL,
	"purchase_date_source" varchar,
	"purchase_date_confidence" numeric(5, 4),
	"transaction_type" varchar NOT NULL,
	"transaction_id" varchar,
	"units" numeric(15, 6) NOT NULL,
	"cost_per_unit" numeric(15, 4) NOT NULL,
	"total_cost" numeric(15, 2) NOT NULL,
	"stamp_duty" numeric(10, 2) DEFAULT '0',
	"purchase_nav" numeric(15, 4),
	"balance_after_transaction" numeric(15, 6),
	"transaction_description" text,
	"exit_load_text" text,
	"advisor_arn" varchar,
	"current_nav" numeric(15, 4),
	"current_value" numeric(15, 2),
	"unrealized_gain" numeric(15, 2),
	"unrealized_gain_percent" numeric(8, 4),
	"holding_period" integer,
	"capital_gains_type" varchar,
	"tax_rate_applicable" numeric(5, 2),
	"source_pdf_id" varchar,
	"source_page_number" integer,
	"parsing_confidence" numeric(5, 4),
	"status" varchar DEFAULT 'active',
	"remaining_units" numeric(15, 6),
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_reason" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "identity_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"identity_token_id" varchar(100) NOT NULL,
	"pan_number" varchar(10),
	"pan_verified" boolean DEFAULT false,
	"pan_verified_at" timestamp,
	"pan_provider" varchar(50),
	"aadhaar_last_four" varchar(4),
	"aadhaar_verified" boolean DEFAULT false,
	"aadhaar_verified_at" timestamp,
	"aadhaar_provider" varchar(50),
	"ckyc_number" varchar(20),
	"ckyc_verified" boolean DEFAULT false,
	"ckyc_verified_at" timestamp,
	"ckyc_provider" varchar(50),
	"bank_verified" boolean DEFAULT false,
	"bank_verified_at" timestamp,
	"bank_provider" varchar(50),
	"address_verified" boolean DEFAULT false,
	"address_verified_at" timestamp,
	"address_provider" varchar(50),
	"fatca_declared" boolean DEFAULT false,
	"fatca_declared_at" timestamp,
	"risk_category" varchar(20),
	"risk_score" integer,
	"risk_assessed_at" timestamp,
	"kyc_level" varchar(20) DEFAULT 'NONE',
	"kyc_version" integer DEFAULT 1,
	"overall_status" varchar(20) DEFAULT 'PENDING',
	"last_verified_at" timestamp,
	"expires_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "identity_profiles_identity_token_id_unique" UNIQUE("identity_token_id")
);
--> statement-breakpoint
CREATE TABLE "instrument_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"instrument_id" varchar NOT NULL,
	"price_date" date NOT NULL,
	"open_price" numeric(15, 2),
	"high_price" numeric(15, 2),
	"low_price" numeric(15, 2),
	"close_price" numeric(15, 2) NOT NULL,
	"adj_close" numeric(15, 2),
	"volume" numeric(20, 0),
	"change_percent" numeric(10, 4),
	"source" varchar DEFAULT 'fmp',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar,
	"user_id" varchar,
	"entity_type" varchar NOT NULL,
	"maker_id" varchar NOT NULL,
	"checker_id" varchar,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"maker_notes" text,
	"checker_notes" text,
	"rejection_reason" text,
	"checker_ip_address" varchar,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_audit_packs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"generated_by" varchar NOT NULL,
	"generated_by_role" varchar,
	"pack_type" varchar DEFAULT 'full',
	"checksum" varchar,
	"sections" text[] DEFAULT '{}'::text[],
	"file_path" text,
	"file_size" integer,
	"expires_at" timestamp,
	"download_count" integer DEFAULT 0,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_flow_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(20) NOT NULL,
	"flow_name" varchar(100) NOT NULL,
	"description" text,
	"steps" jsonb NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT false,
	"regulatory_basis" text,
	"created_by" varchar,
	"activated_at" timestamp,
	"deactivated_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_product_eligibility_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_code" varchar NOT NULL,
	"product_name" varchar NOT NULL,
	"required_tier" varchar NOT NULL,
	"required_tier_status" varchar DEFAULT 'final',
	"max_amount" numeric(15, 2),
	"conditions" text[] DEFAULT '{}'::text[],
	"require_video_kyc" boolean DEFAULT false,
	"require_maker_checker" boolean DEFAULT false,
	"aml_max_risk" varchar DEFAULT 'MEDIUM',
	"is_active" boolean DEFAULT true,
	"regulatory_basis" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_provider_priority" (
	"id" serial PRIMARY KEY NOT NULL,
	"kyc_step" varchar(50) NOT NULL,
	"provider_id" integer NOT NULL,
	"priority" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true,
	"product_scope" jsonb,
	"fallback_error_codes" jsonb,
	"max_retries" integer DEFAULT 3,
	"timeout_ms" integer DEFAULT 30000,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_providers" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_code" varchar(50) NOT NULL,
	"provider_name" varchar(200) NOT NULL,
	"provider_description" text,
	"provider_type" varchar(50) NOT NULL,
	"api_endpoint" varchar(500),
	"price_per_call" numeric(10, 2) DEFAULT '0',
	"is_enabled" boolean DEFAULT true,
	"is_configured" boolean DEFAULT false,
	"required_env_vars" jsonb,
	"features" jsonb,
	"health_status" varchar(20) DEFAULT 'unknown',
	"last_health_check" timestamp,
	"error_rate" real DEFAULT 0,
	"avg_latency_ms" integer DEFAULT 0,
	"total_calls" integer DEFAULT 0,
	"successful_calls" integer DEFAULT 0,
	"failed_calls" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "kyc_providers_provider_code_unique" UNIQUE("provider_code")
);
--> statement-breakpoint
CREATE TABLE "kyc_rate_limit_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"limit_key" varchar NOT NULL,
	"limit_type" varchar NOT NULL,
	"identifier_type" varchar NOT NULL,
	"identifier" varchar NOT NULL,
	"window_start" timestamp NOT NULL,
	"window_end" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"max_allowed" integer NOT NULL,
	"is_locked" boolean DEFAULT false,
	"locked_at" timestamp,
	"locked_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_rejection_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"reason_code" varchar NOT NULL,
	"reason_description" text,
	"rejected_by" varchar NOT NULL,
	"rejected_by_role" varchar,
	"rekyc_required" boolean DEFAULT false,
	"new_session_id" varchar,
	"dispute_notes" text,
	"dispute_status" varchar,
	"dispute_resolved_at" timestamp,
	"rejected_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_step_resets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"step" varchar NOT NULL,
	"previous_status" jsonb,
	"reset_by" varchar NOT NULL,
	"reset_by_role" varchar,
	"reason" text NOT NULL,
	"reason_code" varchar NOT NULL,
	"dependent_steps_reset" text[] DEFAULT '{}'::text[],
	"reset_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_video_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar,
	"user_id" varchar,
	"reason" varchar NOT NULL,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"provider" varchar DEFAULT 'internal',
	"scheduled_at" timestamp,
	"join_url" text,
	"recording_hash" varchar,
	"officer_id" varchar,
	"officer_notes" text,
	"completed_at" timestamp,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_webhook_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"reference_id" varchar,
	"session_id" varchar,
	"payload" jsonb,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 5,
	"next_retry_at" timestamp,
	"last_error" text,
	"processed_at" timestamp,
	"dlq_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar,
	"claim_id" varchar,
	"actor_id" varchar NOT NULL,
	"actor_role" varchar(30) NOT NULL,
	"action" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lead_registry" (
	"lead_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pan" varchar(10) NOT NULL,
	"mobile" varchar(15) NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"loan_type" varchar(50) NOT NULL,
	"approx_amount" numeric(15, 2),
	"first_agent_id" varchar NOT NULL,
	"first_partner_id" varchar NOT NULL,
	"partner_hierarchy_snapshot" jsonb DEFAULT '{}'::jsonb,
	"processing_mode" "lead_processing_mode",
	"financier_name" varchar(200),
	"banker_name" varchar(200),
	"banker_mobile" varchar(15),
	"banker_email" varchar(200),
	"financier_set_at" timestamp,
	"processing_mode_set_at" timestamp,
	"status" "lead_status" DEFAULT 'REGISTERED' NOT NULL,
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"first_touch_timestamp" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_disbursement_tranches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" varchar NOT NULL,
	"project_id" varchar,
	"tranche_number" integer NOT NULL,
	"milestone_name" varchar NOT NULL,
	"milestone_description" text,
	"expected_completion_percent" numeric(5, 2),
	"tranche_amount" numeric(18, 2) NOT NULL,
	"tranche_percent" numeric(5, 2),
	"status" "tranch_status" DEFAULT 'PENDING',
	"release_date" date,
	"released_amount" numeric(18, 2),
	"released_by" varchar,
	"hold_reason" text,
	"engineer_certificate_url" varchar,
	"ca_certificate_url" varchar,
	"photograph_url" varchar,
	"bank_reference" varchar,
	"remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_index_nav" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"index_id" varchar NOT NULL,
	"nav_date" date NOT NULL,
	"close_value" numeric(12, 4) NOT NULL,
	"daily_return" numeric(10, 6),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_indices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"index_code" varchar(30) NOT NULL,
	"index_name" varchar(100) NOT NULL,
	"provider" varchar(30),
	"description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "market_indices_index_code_unique" UNIQUE("index_code")
);
--> statement-breakpoint
CREATE TABLE "master_dsa_attachments" (
	"attachment_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dsa_claim_id" varchar NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"attachment_type" varchar(50) DEFAULT 'CONFIRMATION_EMAIL' NOT NULL,
	"uploaded_by_admin_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_dsa_claims" (
	"dsa_claim_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payout_claim_id" varchar NOT NULL,
	"lead_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"partner_id" varchar NOT NULL,
	"financier_name" varchar(200) NOT NULL,
	"disbursement_amount" numeric(15, 2) NOT NULL,
	"disbursement_date" date NOT NULL,
	"loan_account_number" varchar(50),
	"customer_name" varchar(200),
	"customer_pan" varchar(10),
	"claimed_amount" numeric(15, 2) NOT NULL,
	"paid_amount" numeric(15, 2) DEFAULT '0.00',
	"outstanding_amount" numeric(15, 2),
	"discrepancy_flag" boolean DEFAULT false,
	"discrepancy_notes" text,
	"email_subject" text,
	"email_body" text,
	"email_sent_at" timestamp,
	"email_message_id" varchar,
	"master_dsa_email" varchar(200),
	"master_dsa_name" varchar(200),
	"status" "master_dsa_claim_status" DEFAULT 'DRAFT' NOT NULL,
	"submitted_at" timestamp,
	"acknowledged_at" timestamp,
	"paid_at" timestamp,
	"disputed_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_by_admin_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "master_dsa_claims_payout_claim_id_unique" UNIQUE("payout_claim_id")
);
--> statement-breakpoint
CREATE TABLE "master_dsa_payments" (
	"payment_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dsa_claim_id" varchar NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"reference_number" varchar(100),
	"payment_mode" varchar(50),
	"notes" text,
	"recorded_by_admin_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_aum_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_code" text NOT NULL,
	"as_of_date" date NOT NULL,
	"aum" numeric(15, 2),
	"source" varchar,
	"day_over_day_change_percent" numeric(8, 4),
	"anomaly_flag" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_benchmark_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mf_isin" varchar(20) NOT NULL,
	"old_index_code" varchar(30),
	"new_index_code" varchar(30),
	"old_raw_benchmark" text,
	"new_raw_benchmark" text,
	"change_source" varchar(30),
	"changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_benchmark_lineage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mf_isin" varchar(20) NOT NULL,
	"previous_source" varchar(20),
	"new_source" varchar(20) NOT NULL,
	"previous_index" varchar(30),
	"new_index" varchar(30) NOT NULL,
	"reason" text,
	"changed_by" varchar,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_benchmark_map" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mf_isin" varchar(20) NOT NULL,
	"mf_scheme_code" varchar(20),
	"index_code" varchar(30) NOT NULL,
	"confidence_score" numeric(3, 2) DEFAULT '0.80' NOT NULL,
	"source" varchar(30) DEFAULT 'auto',
	"mapping_reason" text,
	"is_overridden" boolean DEFAULT false,
	"overridden_by" varchar,
	"overridden_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "mf_benchmark_map_mf_isin_unique" UNIQUE("mf_isin")
);
--> statement-breakpoint
CREATE TABLE "mf_category_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar NOT NULL,
	"sub_category" varchar NOT NULL,
	"sebi_circular_ref" varchar,
	"effective_date" date,
	"rules" jsonb,
	"is_active" boolean DEFAULT true,
	"version" integer DEFAULT 1,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_enrichment_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheme_code" text NOT NULL,
	"field_name" varchar,
	"old_value" text,
	"new_value" text,
	"change_type" varchar,
	"source" varchar,
	"enrichment_run_id" varchar,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "mf_monthwise_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme_code" text NOT NULL,
	"month_year" date NOT NULL,
	"nav_start" numeric(15, 4),
	"nav_end" numeric(15, 4),
	"return_percent" numeric(8, 4),
	"benchmark_return" numeric(8, 4),
	"excess_return" numeric(8, 4),
	"is_partial" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mf_scheme_stock_holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mf_isin" varchar(20) NOT NULL,
	"stock_symbol" varchar(30) NOT NULL,
	"stock_name" text,
	"stock_isin" varchar(20),
	"sector" varchar(100),
	"holding_percentage" numeric(8, 4) NOT NULL,
	"holding_date" date NOT NULL,
	"market_value" numeric(15, 2),
	"quantity" numeric(15, 4),
	"source" varchar(30) DEFAULT 'amfi',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" varchar NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" varchar NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_client_ownership" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"owner_partner_id" varchar NOT NULL,
	"first_transaction_at" timestamp,
	"is_locked" boolean DEFAULT false,
	"override_by" varchar,
	"override_reason" text,
	"override_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_commission_ledger" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"order_id" varchar,
	"product_type" varchar NOT NULL,
	"transaction_amount" numeric(15, 2) NOT NULL,
	"commission_amount" numeric(15, 2) NOT NULL,
	"commission_rule_id" varchar,
	"waterfall_level" varchar NOT NULL,
	"status" varchar DEFAULT 'PENDING' NOT NULL,
	"kyc_gated" boolean DEFAULT false,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_commission_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_type" varchar NOT NULL,
	"agent_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"sub_partner_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"master_partner_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"platform_pct" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"is_active" boolean DEFAULT true,
	"effective_from" timestamp DEFAULT now(),
	"effective_to" timestamp,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_hierarchy_agreements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" varchar NOT NULL,
	"agreement_type" varchar DEFAULT 'PARTNER' NOT NULL,
	"agreement_document" text,
	"agreement_status" varchar DEFAULT 'DRAFT',
	"effective_from" timestamp,
	"effective_to" timestamp,
	"approved_by" varchar,
	"approved_at" timestamp,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_wallets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" varchar NOT NULL,
	"balance" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_credited" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"total_debited" numeric(15, 2) DEFAULT '0.00' NOT NULL,
	"last_transaction_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "partner_wallets_partner_id_unique" UNIQUE("partner_id")
);
--> statement-breakpoint
CREATE TABLE "payout_claims" (
	"claim_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"partner_id" varchar NOT NULL,
	"disbursement_amount" numeric(15, 2) NOT NULL,
	"disbursement_date" date NOT NULL,
	"loan_account_number" varchar(50),
	"financier_name" varchar(200) NOT NULL,
	"pdd_status" "pdd_status" DEFAULT 'PENDING' NOT NULL,
	"pdd_exception_allowed_by_financier" boolean DEFAULT false,
	"pdd_cleared_at" timestamp,
	"subvention_flag" boolean DEFAULT false,
	"team_case" boolean DEFAULT false,
	"team_members" jsonb DEFAULT '[]'::jsonb,
	"transaction_status" varchar(50) DEFAULT 'ACTIVE',
	"status" "payout_claim_status" DEFAULT 'PENDING_VERIFICATION' NOT NULL,
	"banker_confirmation_email_id" varchar,
	"banker_confirmed_at" timestamp,
	"confirmed_by_admin_id" varchar,
	"approved_at" timestamp,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"commission_ledger_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdf_parsing_audit_trail" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" varchar,
	"upload_id" varchar,
	"user_id" varchar,
	"agent_id" varchar,
	"file_name" varchar,
	"file_size" integer,
	"fingerprint" varchar(64),
	"parser_version" varchar NOT NULL,
	"parsing_strategy" varchar,
	"parse_time_ms" integer,
	"success" boolean DEFAULT false,
	"holdings_extracted" integer DEFAULT 0,
	"transactions_extracted" integer DEFAULT 0,
	"total_value_extracted" numeric(15, 2),
	"confidence_score" numeric(5, 4),
	"validations_passed" integer DEFAULT 0,
	"validations_failed" integer DEFAULT 0,
	"validation_errors" jsonb,
	"dual_run_enabled" boolean DEFAULT false,
	"v1_holdings_count" integer,
	"v2_holdings_count" integer,
	"match_percentage" numeric(5, 2),
	"preferred_version" varchar,
	"comparison_discrepancies" jsonb,
	"errors" jsonb,
	"warnings" jsonb,
	"requires_enrichment" boolean DEFAULT false,
	"unresolved_items" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pdf_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"file_hash" varchar(64),
	"pdf_type" varchar NOT NULL,
	"layout_type" varchar NOT NULL,
	"page_count" integer DEFAULT 1,
	"text_density" integer,
	"has_table_structure" boolean DEFAULT false,
	"registrars" jsonb DEFAULT '[]'::jsonb,
	"header_patterns" jsonb DEFAULT '[]'::jsonb,
	"column_order" jsonb DEFAULT '[]'::jsonb,
	"parsing_strategy" varchar,
	"successful_patterns" jsonb,
	"confidence_score" numeric(5, 4),
	"parsing_success_rate" numeric(5, 4),
	"times_used" integer DEFAULT 0,
	"times_succeeded" integer DEFAULT 0,
	"times_failed" integer DEFAULT 0,
	"parser_version" varchar DEFAULT 'v2',
	"detected_at" timestamp DEFAULT now(),
	"last_used_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pdf_profiles_fingerprint_unique" UNIQUE("fingerprint")
);
--> statement-breakpoint
CREATE TABLE "platform_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(100) NOT NULL,
	"actor_id" varchar,
	"actor_role" varchar(50),
	"action" varchar(100) NOT NULL,
	"previous_state" jsonb,
	"new_state" jsonb,
	"change_details" jsonb,
	"ip_address" varchar(50),
	"user_agent" text,
	"session_id" varchar(100),
	"regulatory_tag" varchar(50),
	"severity" varchar(20) DEFAULT 'INFO',
	"is_immutable" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"portal_type" varchar(20) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_code" varchar(50) NOT NULL,
	"product_name" varchar(100) NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"required_kyc_level" varchar(20) DEFAULT 'BASIC',
	"required_kyc_steps" jsonb,
	"regulatory_requirements" jsonb,
	"default_broker_id" varchar(50),
	"configuration" jsonb,
	"updated_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "product_configurations_product_code_unique" UNIQUE("product_code")
);
--> statement-breakpoint
CREATE TABLE "progressive_commission_ledger" (
	"ledger_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" varchar NOT NULL,
	"partner_id" varchar,
	"role" varchar NOT NULL,
	"level_offset" integer,
	"amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_approvals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"approval_type" varchar NOT NULL,
	"approval_authority" varchar,
	"approval_number" varchar,
	"approval_date" date,
	"expiry_date" date,
	"status" "dev_approval_status" DEFAULT 'PENDING',
	"document_url" varchar,
	"is_mandatory" boolean DEFAULT false,
	"remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_cashflows" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"label" varchar,
	"inflow_sales" numeric(18, 2) DEFAULT '0',
	"inflow_disbursement" numeric(18, 2) DEFAULT '0',
	"inflow_other" numeric(18, 2) DEFAULT '0',
	"outflow_construction" numeric(18, 2) DEFAULT '0',
	"outflow_land" numeric(18, 2) DEFAULT '0',
	"outflow_interest" numeric(18, 2) DEFAULT '0',
	"outflow_admin" numeric(18, 2) DEFAULT '0',
	"outflow_other" numeric(18, 2) DEFAULT '0',
	"net_cashflow" numeric(18, 2) DEFAULT '0',
	"cumulative_cashflow" numeric(18, 2) DEFAULT '0',
	"remarks" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_land_details" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" varchar NOT NULL,
	"survey_number" varchar,
	"plot_number" varchar,
	"total_land_area" numeric(15, 2),
	"land_area_unit" varchar DEFAULT 'sqft',
	"land_use_zone" varchar,
	"encumbrance_status" "encumbrance_status" DEFAULT 'UNDER_VERIFICATION',
	"encumbrance_certificate_url" varchar,
	"title_status" "title_status" DEFAULT 'UNDER_VERIFICATION',
	"title_report_url" varchar,
	"title_report_date" date,
	"land_ownership" varchar,
	"registration_number" varchar,
	"registration_date" date,
	"market_value" numeric(18, 2),
	"guidance_value" numeric(18, 2),
	"purchase_value" numeric(18, 2),
	"remarks" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proof_uploads" (
	"proof_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"claim_id" varchar NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"file_type" varchar(20) NOT NULL,
	"file_size" integer NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"storage_path" varchar(1000) NOT NULL,
	"uploader_role" varchar(30) NOT NULL,
	"uploader_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"proposal_version" varchar(20),
	"event_type" varchar(50) NOT NULL,
	"event_action" varchar(50),
	"actor_id" varchar,
	"actor_role" varchar(30),
	"actor_name" varchar,
	"payload_before" jsonb,
	"payload_after" jsonb,
	"payload_diff" jsonb,
	"is_override" boolean DEFAULT false,
	"override_reason" text,
	"override_approved_by" varchar,
	"pdf_version" varchar(20),
	"pdf_hash" varchar(64),
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar,
	"request_path" varchar,
	"checksum" varchar(64) NOT NULL,
	"previous_checksum" varchar(64),
	"retention_years" integer DEFAULT 8,
	"retention_expires_at" timestamp,
	"is_archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"isin" varchar,
	"scheme_code" text,
	"scheme_name" text,
	"investment_type" varchar,
	"validation_status" varchar NOT NULL,
	"validation_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_backtest_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" varchar NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"includes_backtest" boolean DEFAULT false,
	"common_start_date" date,
	"common_end_date" date,
	"old_portfolio_metrics" jsonb,
	"proposed_portfolio_metrics" jsonb,
	"delta_summary" jsonb,
	"backtest_snapshot_hash" varchar,
	"assumptions" jsonb,
	"portfolio_difference_summary" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_flow_state" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"risk_profile_completed" boolean DEFAULT false,
	"investment_horizon_completed" boolean DEFAULT false,
	"goal_completed" boolean DEFAULT false,
	"portfolio_input_completed" boolean DEFAULT false,
	"analysis_completed" boolean DEFAULT false,
	"recommendation_completed" boolean DEFAULT false,
	"rebalancing_completed" boolean DEFAULT false,
	"verdict_completed" boolean DEFAULT false,
	"report_completed" boolean DEFAULT false,
	"risk_profile_completed_at" timestamp,
	"investment_horizon_completed_at" timestamp,
	"goal_completed_at" timestamp,
	"portfolio_input_completed_at" timestamp,
	"analysis_completed_at" timestamp,
	"recommendation_completed_at" timestamp,
	"rebalancing_completed_at" timestamp,
	"verdict_completed_at" timestamp,
	"report_completed_at" timestamp,
	"current_phase" varchar DEFAULT 'risk_profile',
	"locked_phases" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "proposal_flow_state_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
CREATE TABLE "proposal_pdf_metadata" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"version" varchar(20) NOT NULL,
	"major_version" integer DEFAULT 1,
	"minor_version" integer DEFAULT 0,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"generated_by" varchar,
	"generated_by_role" varchar,
	"engine_version" varchar(20) DEFAULT 'PB_ENGINE_2.5',
	"pdf_hash" varchar(64) NOT NULL,
	"previous_hash" varchar(64),
	"client_pan" varchar(64),
	"risk_profile_version" varchar(20),
	"benchmark_version" varchar(20),
	"sections_included" jsonb DEFAULT '[]'::jsonb,
	"total_pages" integer DEFAULT 0,
	"file_size_bytes" integer DEFAULT 0,
	"storage_key" varchar,
	"download_count" integer DEFAULT 0,
	"last_downloaded_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_report_sections" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"section_code" varchar NOT NULL,
	"section_name" varchar NOT NULL,
	"section_order" integer DEFAULT 0,
	"dependency_met" boolean DEFAULT false,
	"dependency_reason" text,
	"missing_dependencies" jsonb DEFAULT '[]'::jsonb,
	"is_enabled" boolean DEFAULT false,
	"enabled_by_agent" boolean DEFAULT false,
	"enabled_by_ai" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_sip_recommendations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"verdict_id" varchar,
	"instrument_type" varchar NOT NULL,
	"instrument_isin" varchar(20),
	"instrument_name" varchar NOT NULL,
	"sip_amount" numeric(15, 2) NOT NULL,
	"sip_frequency" varchar DEFAULT 'monthly',
	"sip_start_date" date,
	"sip_duration_months" integer,
	"sip_source" varchar NOT NULL,
	"source_rationale" text,
	"converted_from_lumpsum" boolean DEFAULT false,
	"original_lumpsum_amount" numeric(15, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_verdicts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"instrument_isin" varchar(20),
	"instrument_code" varchar,
	"instrument_name" varchar NOT NULL,
	"verdict" varchar(10) NOT NULL,
	"verdict_rationale" text,
	"ai_generated" boolean DEFAULT true,
	"agent_overridden" boolean DEFAULT false,
	"current_value" numeric(15, 2),
	"target_value" numeric(15, 2),
	"change_amount" numeric(15, 2),
	"change_percent" numeric(8, 4),
	"exit_load_applicable" boolean DEFAULT false,
	"exit_load_percent" numeric(5, 2),
	"capital_gains_type" varchar,
	"estimated_tax" numeric(15, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" varchar NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"change_reason" text,
	"changed_schemes" jsonb,
	"allocation_mode" varchar(20),
	"strategy_snapshot" jsonb,
	"strategy_locked" boolean DEFAULT false,
	"created_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proposal_what_if_scenarios" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"mode" varchar NOT NULL,
	"scenario_name" varchar NOT NULL,
	"return_delta" numeric(5, 2) DEFAULT '0',
	"volatility_multiplier" numeric(5, 2) DEFAULT '1',
	"inflation_rate" numeric(5, 2) DEFAULT '6',
	"projected_value_1y" numeric(15, 2),
	"projected_value_3y" numeric(15, 2),
	"projected_value_5y" numeric(15, 2),
	"projected_value_10y" numeric(15, 2),
	"max_drawdown" numeric(5, 2),
	"probability_of_loss" numeric(5, 2),
	"value_at_risk_95" numeric(15, 2),
	"include_in_report" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"metric_date" date NOT NULL,
	"total_calls" integer DEFAULT 0,
	"successful_calls" integer DEFAULT 0,
	"failed_calls" integer DEFAULT 0,
	"avg_latency_ms" integer DEFAULT 0,
	"p95_latency_ms" integer DEFAULT 0,
	"error_codes" jsonb,
	"total_cost_inr" numeric(10, 2) DEFAULT '0',
	"fallbacks_triggered" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "quant_governance_policy" (
	"id" serial PRIMARY KEY NOT NULL,
	"risk_profile" text NOT NULL,
	"use_mvo" boolean DEFAULT false NOT NULL,
	"use_black_litterman" boolean DEFAULT false NOT NULL,
	"use_ai_drift_prediction" boolean DEFAULT false NOT NULL,
	"risk_aversion" real DEFAULT 2.5 NOT NULL,
	"tau" real DEFAULT 0.05 NOT NULL,
	"tactical_budget" real DEFAULT 0.1 NOT NULL,
	"drift_probability_trigger" real DEFAULT 0.7 NOT NULL,
	"max_asset_weight" real DEFAULT 0.4 NOT NULL,
	"min_asset_weight" real DEFAULT 0 NOT NULL,
	"covariance_lookback_days" integer DEFAULT 250 NOT NULL,
	"ewma_span" integer DEFAULT 60 NOT NULL,
	"shrinkage_intensity" real DEFAULT 0.5 NOT NULL,
	"solver_max_iterations" integer DEFAULT 1000 NOT NULL,
	"solver_tolerance" real DEFAULT 1e-8 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quant_governance_policy_risk_profile_unique" UNIQUE("risk_profile")
);
--> statement-breakpoint
CREATE TABLE "quant_model_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_name" text NOT NULL,
	"version" text NOT NULL,
	"model_type" text NOT NULL,
	"training_date" timestamp DEFAULT now() NOT NULL,
	"validation_score" real,
	"backtest_sharpe" real,
	"status" text DEFAULT 'candidate' NOT NULL,
	"artifact_data" jsonb,
	"training_config" jsonb,
	"performance_metrics" jsonb,
	"promoted_at" timestamp,
	"archived_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quant_retraining_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_name" text NOT NULL,
	"old_version" text,
	"new_version" text,
	"status" text NOT NULL,
	"validation_score" real,
	"backtest_sharpe" real,
	"promotion_status" text,
	"training_duration_ms" integer,
	"error_message" text,
	"metrics" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quant_run_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" text,
	"model_type" text NOT NULL,
	"run_time_ms" integer,
	"status" text NOT NULL,
	"input_hash" text,
	"output_summary" jsonb,
	"error_message" text,
	"fallback_used" boolean DEFAULT false,
	"governance_policy_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quant_scheduler_locks" (
	"lock_key" text PRIMARY KEY NOT NULL,
	"locked_by" text NOT NULL,
	"acquired_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"heartbeat_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quant_scheduler_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"lock_key" text NOT NULL,
	"daily_count" integer DEFAULT 0 NOT NULL,
	"daily_count_date" text NOT NULL,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"last_success_at" timestamp,
	"backoff_until" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quant_scheduler_state_lock_key_unique" UNIQUE("lock_key")
);
--> statement-breakpoint
CREATE TABLE "quant_transition_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" text,
	"turnover" real NOT NULL,
	"max_weight" real NOT NULL,
	"sector_exposure" jsonb,
	"category_exposure" jsonb,
	"gamma_used" real NOT NULL,
	"lambda_used" real,
	"filtered_count" integer DEFAULT 0,
	"constraints_applied" text[],
	"weights_snapshot" jsonb,
	"previous_weights" jsonb,
	"sharpe_ratio" real,
	"portfolio_return" real,
	"portfolio_volatility" real,
	"escalation_rounds" integer DEFAULT 0,
	"model_version" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebalance_decision_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" text,
	"portfolio_value" real,
	"instrument_name" text NOT NULL,
	"asset_category" text NOT NULL,
	"current_weight_pct" real,
	"target_weight_pct" real,
	"drift_pct" real,
	"drift_status" text,
	"risk_flag" text,
	"cost_estimate" real,
	"cost_flag" text,
	"tactical_flag" text,
	"raw_action" text NOT NULL,
	"final_action" text NOT NULL,
	"change_amount" real,
	"rationale_code" text NOT NULL,
	"rationale_detail" text,
	"governance_config_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebalance_governance_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"risk_profile" text NOT NULL,
	"tolerance_band_pct" real DEFAULT 5 NOT NULL,
	"min_trade_value_inr" real DEFAULT 5000 NOT NULL,
	"brokerage_rate_pct" real DEFAULT 0.03 NOT NULL,
	"max_tactical_weight_pct" real DEFAULT 10 NOT NULL,
	"target_volatility_pct" real DEFAULT 15 NOT NULL,
	"risk_tolerance_band_pct" real DEFAULT 3 NOT NULL,
	"max_categories_in_buy" integer DEFAULT 3 NOT NULL,
	"review_frequency_days" integer DEFAULT 90 NOT NULL,
	"adaptive_tolerance_enabled" boolean DEFAULT false NOT NULL,
	"high_vol_tolerance_band_pct" real DEFAULT 3,
	"vix_threshold" real DEFAULT 25,
	"updated_by" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rebalance_governance_config_risk_profile_unique" UNIQUE("risk_profile")
);
--> statement-breakpoint
CREATE TABLE "regulatory_gaps" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"regulator" varchar(20) NOT NULL,
	"regulatory_reference" varchar(255),
	"reference_url" varchar(500),
	"risk_level" varchar(20) DEFAULT 'medium' NOT NULL,
	"category" varchar(100),
	"status" varchar(30) DEFAULT 'not_started' NOT NULL,
	"status_updated_at" timestamp,
	"status_updated_by" varchar(100),
	"estimated_effort" varchar(20),
	"target_completion_date" timestamp,
	"actual_completion_date" timestamp,
	"assigned_to" varchar(100),
	"notes" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar NOT NULL,
	"action" varchar NOT NULL,
	"agent_id" varchar NOT NULL,
	"agent_name" varchar,
	"previous_data" jsonb,
	"new_data" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_list_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"research_list_id" varchar NOT NULL,
	"instrument_id" varchar NOT NULL,
	"instrument_type" varchar NOT NULL,
	"instrument_name" text,
	"instrument_symbol" varchar,
	"instrument_isin" varchar,
	"added_source" varchar DEFAULT 'manual',
	"added_by_agent_id" varchar,
	"notes" text,
	"rating" integer,
	"snapshot_metrics" jsonb,
	"added_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_list_proposal_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"research_list_id" varchar NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"rationale" text,
	"attached_by_agent_id" varchar NOT NULL,
	"attached_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "research_lists" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"universe_type" varchar NOT NULL,
	"created_by_agent_id" varchar NOT NULL,
	"organization_id" varchar,
	"visibility" varchar DEFAULT 'private',
	"is_editable" boolean DEFAULT true,
	"is_archived" boolean DEFAULT false,
	"screener_config" jsonb,
	"cached_metrics" jsonb,
	"metrics_last_updated" timestamp,
	"tags" text[] DEFAULT '{}',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reversal_ledger" (
	"reversal_id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"original_ledger_id" varchar NOT NULL,
	"transaction_id" varchar NOT NULL,
	"partner_id" varchar,
	"reversal_amount" numeric(12, 2) NOT NULL,
	"reversal_type" varchar(30) DEFAULT 'FULL' NOT NULL,
	"wallet_debited" boolean DEFAULT false,
	"negative_carry_forward" numeric(12, 2) DEFAULT '0.00',
	"dispute_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "saved_screeners" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"universe_type" varchar NOT NULL,
	"filters" jsonb NOT NULL,
	"created_by_agent_id" varchar NOT NULL,
	"visibility" varchar DEFAULT 'private',
	"last_run_at" timestamp,
	"last_run_results" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scheme_rename_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"isin" varchar,
	"scheme_code" text NOT NULL,
	"old_name" text NOT NULL,
	"new_name" text NOT NULL,
	"detected_at" timestamp DEFAULT now(),
	"sync_source" varchar DEFAULT 'AMFI'
);
--> statement-breakpoint
CREATE TABLE "scheme_transaction_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"isin" varchar,
	"scheme_code" text NOT NULL,
	"scheme_name" text,
	"lumpsum_allowed" boolean DEFAULT true,
	"sip_allowed" boolean DEFAULT true,
	"min_lumpsum_amount" numeric(15, 2),
	"max_lumpsum_amount" numeric(15, 2),
	"min_sip_amount" numeric(15, 2),
	"subscription_status" varchar DEFAULT 'OPEN',
	"restriction_reason" text,
	"alternative_isin" varchar,
	"alternative_scheme_name" text,
	"effective_from" date,
	"last_checked_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_analyst_grades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"published_date" varchar,
	"grading_company" varchar,
	"previous_grade" varchar,
	"new_grade" varchar,
	"action" varchar,
	"price_when_posted" numeric(15, 2),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_analyst_targets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"published_date" varchar,
	"analyst_name" varchar,
	"analyst_company" varchar,
	"price_target" numeric(15, 2),
	"adj_price_target" numeric(15, 2),
	"price_when_posted" numeric(15, 2),
	"news_url" text,
	"news_title" text,
	"news_publisher" varchar,
	"news_base_url" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_company_ratings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"rating" varchar,
	"rating_score" integer,
	"rating_recommendation" varchar,
	"rating_details_dcf_score" integer,
	"rating_details_dcf_recommendation" varchar,
	"rating_details_roe_score" integer,
	"rating_details_roe_recommendation" varchar,
	"rating_details_roa_score" integer,
	"rating_details_roa_recommendation" varchar,
	"rating_details_de_score" integer,
	"rating_details_de_recommendation" varchar,
	"rating_details_pe_score" integer,
	"rating_details_pe_recommendation" varchar,
	"rating_details_pb_score" integer,
	"rating_details_pb_recommendation" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_dcf_valuations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"dcf" numeric(15, 4),
	"stock_price" numeric(15, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_derived_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"growth_score" numeric(5, 2),
	"quality_score" numeric(5, 2),
	"value_score" numeric(5, 2),
	"risk_score" numeric(5, 2),
	"composite_score" numeric(5, 2),
	"fintek_rating" integer,
	"momentum_score" numeric(5, 2),
	"revenue_growth_3y" numeric(10, 4),
	"earnings_growth_3y" numeric(10, 4),
	"scoring_metadata" jsonb,
	"last_calculated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "screener_derived_metrics_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "screener_dividend_calendar" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"label" varchar,
	"adj_dividend" numeric(15, 6),
	"dividend" numeric(15, 6),
	"record_date" varchar,
	"payment_date" varchar,
	"declaration_date" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_earnings_calendar" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"eps_estimated" numeric(15, 4),
	"eps_actual" numeric(15, 4),
	"revenue_estimated" numeric(20, 2),
	"revenue_actual" numeric(20, 2),
	"fiscal_date_ending" varchar,
	"updated_from_date" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_economic_calendar" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event" text NOT NULL,
	"date" varchar,
	"country" varchar,
	"actual" numeric(15, 4),
	"previous" numeric(15, 4),
	"change" numeric(15, 4),
	"change_percentage" numeric(10, 4),
	"estimate" numeric(15, 4),
	"impact" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_financials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"period" varchar DEFAULT 'annual' NOT NULL,
	"fiscal_year" integer,
	"fiscal_date" varchar,
	"pe_ratio" numeric(10, 2),
	"pb_ratio" numeric(10, 2),
	"ev_to_ebitda" numeric(10, 2),
	"price_to_sales" numeric(10, 2),
	"roe" numeric(10, 4),
	"roce" numeric(10, 4),
	"roa" numeric(10, 4),
	"net_profit_margin" numeric(10, 4),
	"operating_margin" numeric(10, 4),
	"gross_margin" numeric(10, 4),
	"debt_to_equity" numeric(10, 4),
	"current_ratio" numeric(10, 4),
	"quick_ratio" numeric(10, 4),
	"interest_coverage" numeric(10, 2),
	"eps" numeric(15, 2),
	"book_value" numeric(15, 2),
	"dividend_yield" numeric(8, 4),
	"dividend_payout" numeric(8, 4),
	"revenue_growth" numeric(10, 4),
	"earnings_growth" numeric(10, 4),
	"free_cash_flow_per_share" numeric(15, 2),
	"revenue" numeric(20, 2),
	"net_income" numeric(20, 2),
	"total_debt" numeric(20, 2),
	"total_equity" numeric(20, 2),
	"total_assets" numeric(20, 2),
	"operating_cash_flow" numeric(20, 2),
	"free_cash_flow" numeric(20, 2),
	"capital_expenditure" numeric(20, 2),
	"return_1y" numeric(10, 4),
	"return_2y" numeric(10, 4),
	"return_3y" numeric(10, 4),
	"return_5y" numeric(10, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_growth_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"period" varchar DEFAULT 'annual',
	"revenue_growth" numeric(10, 4),
	"net_income_growth" numeric(10, 4),
	"eps_growth" numeric(10, 4),
	"eps_diluted_growth" numeric(10, 4),
	"gross_profit_growth" numeric(10, 4),
	"operating_income_growth" numeric(10, 4),
	"free_cash_flow_growth" numeric(10, 4),
	"asset_growth" numeric(10, 4),
	"debt_growth" numeric(10, 4),
	"dividend_growth" numeric(10, 4),
	"book_value_growth" numeric(10, 4),
	"rd_expense_growth" numeric(10, 4),
	"sga_expense_growth" numeric(10, 4),
	"weighted_avg_shares_growth" numeric(10, 4),
	"operating_cash_flow_growth" numeric(10, 4),
	"receivables_growth" numeric(10, 4),
	"inventory_growth" numeric(10, 4),
	"ten_y_revenue_growth_per_share" numeric(10, 4),
	"five_y_revenue_growth_per_share" numeric(10, 4),
	"three_y_revenue_growth_per_share" numeric(10, 4),
	"ten_y_net_income_growth_per_share" numeric(10, 4),
	"five_y_net_income_growth_per_share" numeric(10, 4),
	"three_y_net_income_growth_per_share" numeric(10, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_insider_trades" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"filing_date" varchar,
	"transaction_date" varchar,
	"reporting_name" text,
	"transaction_type" varchar,
	"securities_owned" numeric(20, 0),
	"securities_transacted" numeric(20, 0),
	"price" numeric(15, 4),
	"form_type" varchar,
	"link" text,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_institutional_holders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"holder" text,
	"shares" numeric(20, 0),
	"date_reported" varchar,
	"change" numeric(20, 0),
	"weight_percent" numeric(10, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_ipo_calendar" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar,
	"company" text,
	"exchange" varchar,
	"date" varchar,
	"price_range" varchar,
	"shares" numeric(20, 0),
	"market_cap" numeric(20, 2),
	"actions" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_key_metrics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"period" varchar DEFAULT 'annual',
	"revenue_per_share" numeric(15, 4),
	"net_income_per_share" numeric(15, 4),
	"operating_cash_flow_per_share" numeric(15, 4),
	"free_cash_flow_per_share" numeric(15, 4),
	"cash_per_share" numeric(15, 4),
	"book_value_per_share" numeric(15, 4),
	"tangible_book_value_per_share" numeric(15, 4),
	"shareholders_equity_per_share" numeric(15, 4),
	"interest_debt_per_share" numeric(15, 4),
	"market_cap" numeric(20, 2),
	"enterprise_value" numeric(20, 2),
	"pe_ratio" numeric(10, 4),
	"price_to_sales_ratio" numeric(10, 4),
	"pocf_ratio" numeric(10, 4),
	"pfcf_ratio" numeric(10, 4),
	"pb_ratio" numeric(10, 4),
	"ptb_ratio" numeric(10, 4),
	"ev_to_sales" numeric(10, 4),
	"enterprise_value_over_ebitda" numeric(10, 4),
	"ev_to_operating_cash_flow" numeric(10, 4),
	"ev_to_free_cash_flow" numeric(10, 4),
	"earnings_yield" numeric(10, 4),
	"free_cash_flow_yield" numeric(10, 4),
	"debt_to_equity" numeric(10, 4),
	"debt_to_assets" numeric(10, 4),
	"net_debt_to_ebitda" numeric(10, 4),
	"current_ratio" numeric(10, 4),
	"interest_coverage" numeric(10, 4),
	"income_quality" numeric(10, 4),
	"dividend_yield" numeric(10, 4),
	"payout_ratio" numeric(10, 4),
	"sga_to_revenue" numeric(10, 4),
	"rd_to_revenue" numeric(10, 4),
	"intangible_to_total_assets" numeric(10, 4),
	"capex_to_operating_cash_flow" numeric(10, 4),
	"capex_to_revenue" numeric(10, 4),
	"capex_to_depreciation" numeric(10, 4),
	"sbc_to_revenue" numeric(10, 4),
	"graham_number" numeric(15, 4),
	"roic" numeric(10, 4),
	"return_on_tangible_assets" numeric(10, 4),
	"graham_net_net" numeric(15, 4),
	"working_capital" numeric(20, 2),
	"tangible_asset_value" numeric(20, 2),
	"net_current_asset_value" numeric(20, 2),
	"invested_capital" numeric(20, 2),
	"average_receivables" numeric(20, 2),
	"average_payables" numeric(20, 2),
	"average_inventory" numeric(20, 2),
	"days_sales_outstanding" numeric(10, 2),
	"days_payables_outstanding" numeric(10, 2),
	"days_of_inventory_on_hand" numeric(10, 2),
	"roe" numeric(10, 4),
	"capex_per_share" numeric(15, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar NOT NULL,
	"open" numeric(15, 2),
	"high" numeric(15, 2),
	"low" numeric(15, 2),
	"close" numeric(15, 2),
	"adj_close" numeric(15, 2),
	"volume" numeric(20, 0),
	"change_percent" numeric(10, 4),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_sector_performance" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector" varchar NOT NULL,
	"changes_percentage" numeric(10, 4),
	"date" varchar,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_split_calendar" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"label" varchar,
	"numerator" numeric(10, 4),
	"denominator" numeric(10, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_stock_news" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"published_date" varchar,
	"title" text,
	"image" text,
	"site" varchar,
	"text" text,
	"url" text,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "screener_stocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"company_name" text NOT NULL,
	"exchange" varchar DEFAULT 'NSE',
	"isin" varchar,
	"sector" varchar,
	"industry" varchar,
	"market_cap_category" varchar,
	"country" varchar DEFAULT 'IN',
	"currency" varchar DEFAULT 'INR',
	"is_active" boolean DEFAULT true,
	"current_price" numeric(15, 2),
	"market_cap_value" numeric(20, 2),
	"fmp_symbol" varchar,
	"last_fmp_sync" timestamp,
	"data_source" varchar DEFAULT 'fmp',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "screener_stocks_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "screener_technical_indicators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar NOT NULL,
	"date" varchar,
	"timeframe" varchar DEFAULT 'daily',
	"open" numeric(15, 4),
	"high" numeric(15, 4),
	"low" numeric(15, 4),
	"close" numeric(15, 4),
	"volume" numeric(20, 0),
	"sma_10" numeric(15, 4),
	"sma_20" numeric(15, 4),
	"sma_50" numeric(15, 4),
	"sma_200" numeric(15, 4),
	"ema_10" numeric(15, 4),
	"ema_20" numeric(15, 4),
	"ema_50" numeric(15, 4),
	"ema_200" numeric(15, 4),
	"rsi_14" numeric(10, 4),
	"macd" numeric(15, 4),
	"macd_signal" numeric(15, 4),
	"macd_hist" numeric(15, 4),
	"adx" numeric(10, 4),
	"williams" numeric(10, 4),
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sebi_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar,
	"advisor_id" varchar,
	"client_id" varchar,
	"prospect_id" varchar,
	"action_type" varchar(50) NOT NULL,
	"action_summary" text NOT NULL,
	"input_data" jsonb,
	"output_data" jsonb,
	"rationale" text,
	"template_id" varchar(30),
	"risk_disclosure" text,
	"compliance_flags" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_resolution_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"prospect_id" text,
	"instrument_name" text NOT NULL,
	"isin" text,
	"potd_signal" text,
	"rebalance_signal" text,
	"resolved_action" text NOT NULL,
	"reasoning_code" text NOT NULL,
	"governance_rule_id" text,
	"confidence_score" real,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_intersection_analysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" uuid,
	"prospect_id" uuid,
	"user_id" uuid,
	"analysis_date" timestamp DEFAULT now(),
	"total_funds_analyzed" integer DEFAULT 0,
	"total_stocks_found" integer DEFAULT 0,
	"overlapping_stocks_count" integer DEFAULT 0,
	"high_risk_stocks_count" integer DEFAULT 0,
	"medium_risk_stocks_count" integer DEFAULT 0,
	"stock_overlaps" jsonb,
	"sector_concentration" jsonb,
	"diversification_score" numeric(5, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "strategic_target_weights" (
	"id" serial PRIMARY KEY NOT NULL,
	"portfolio_id" text NOT NULL,
	"category" text NOT NULL,
	"weight" real NOT NULL,
	"model_version" text NOT NULL,
	"expected_return" real,
	"volatility" real,
	"sharpe_contribution" real,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_signatures" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"prospect_id" varchar,
	"created_by_agent_id" varchar,
	"name" varchar NOT NULL,
	"signature_type" varchar NOT NULL,
	"signature_data_url" text NOT NULL,
	"font_family" varchar,
	"typed_text" varchar,
	"width" integer,
	"height" integer,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_kyc_audit_user";--> statement-breakpoint
ALTER TABLE "aa_consent_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "aa_raw_payloads" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "active_investment_limit_overrides" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "advisory_subscriptions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_itr_activity_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_transaction_tracking" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_history" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "apy_accounts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_population_status" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_coupon_payments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_ncd_applications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_risk_disclosure_acknowledgments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_suitability_checks" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bond_watchlist" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capital_gains_reports" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_actions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ckyc_records" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ckyc_verification_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_statements" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "client_tasks" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comparison_history" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_documents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compound_alerts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "dashboard_widget_preferences" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "data_source_consents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "epf_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "eps_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_certificates" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "expense_insights" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "external_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "family_activity_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "family_goal_contributions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "family_members" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_goals" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_obligations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_income_audit_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_income_order_payments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_income_reports" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "fixed_income_settlements" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "form_15_audit_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "generated_reports" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "global_portfolio_positions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_investment_links" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "government_scheme_audit" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "government_scheme_consents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ib_account_summary" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ib_accounts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ib_market_data_subscriptions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ib_orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ib_positions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ib_trading_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "icici_bank_credit_scores" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "icici_bank_loan_applications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "income_streams" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "insurance_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investable_surplus" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_ideas" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ipo_applications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "itr_data_sources_sync" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "itr_prefilled_forms" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_token_map" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_upgrade_reminders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_applications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_comparisons" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "loan_requests" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lrs_limit_alerts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "nps_accounts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pan_consents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_applications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pending_appointments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pick_watchlist" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_metrics_daily" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_report_audit_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ppf_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pre_approved_loan_offers" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_applications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rebalancing_recommendations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "rebalancing_snapshots" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reit_invit_holdings" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reit_invit_orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "report_access_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "risk_analysis" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scheme_consents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_calculations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_document_access_log" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_documents" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_sessions" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_records" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transaction_reports" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "treasury_mandates" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unified_orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unlisted_cart" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unlisted_investor_tracking" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unlisted_risk_disclosure_acknowledgments" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "unlisted_share_lockin" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_alerts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_budgets" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_cart" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_demat_accounts" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_expenses" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_investor_classifications" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_progress" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user_wishlist" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "watchlists" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "yield_tracker" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_categories" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_commerce_config" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_commerce_sync_logs" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_commerce_webhooks" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_customers" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_inventory" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "zoho_products" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "aa_consent_sessions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "aa_consent_sessions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "aa_raw_payloads" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "aa_raw_payloads" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "active_investment_limit_overrides" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "active_investment_limit_overrides" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "advisory_subscriptions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "advisory_subscriptions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "agent_itr_activity_log" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "agent_itr_activity_log" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ai_transaction_tracking" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ai_transaction_tracking" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "alert_history" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "alert_history" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "appointment_audit_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "appointment_audit_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "apy_accounts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "apy_accounts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "auto_population_status" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "auto_population_status" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bank_connectors" ADD COLUMN "lender_category" "lender_category";--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_coupon_payments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_coupon_payments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_ncd_applications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_ncd_applications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_orders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_orders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_risk_disclosure_acknowledgments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_risk_disclosure_acknowledgments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_suitability_checks" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_suitability_checks" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_watchlist" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "bond_watchlist" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "capital_gains_reports" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "capital_gains_reports" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ckyc_records" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ckyc_records" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ckyc_verification_requests" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ckyc_verification_requests" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "client_statements" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "client_statements" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "client_tasks" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "client_tasks" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "comparison_history" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "comparison_history" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "compound_alerts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "compound_alerts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "nominee_details" jsonb;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "kyc_status" varchar;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "exit_load_rules" text;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "nav_date" date;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "opening_unit_balance" numeric(15, 6);--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "registrar_type" varchar;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "advisor_arn_code" varchar;--> statement-breakpoint
ALTER TABLE "daily_picks" ADD COLUMN "exchange" varchar(20);--> statement-breakpoint
ALTER TABLE "dashboard_widget_preferences" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "dashboard_widget_preferences" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "data_source_consents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "data_source_consents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "loan_vertical" "loan_vertical" DEFAULT 'RETAIL';--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "loan_sub_type" "loan_sub_type";--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "developer_project_id" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "assisted_by_agent" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "client_mode" "client_mode" DEFAULT 'new';--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "client_id" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "target_banks" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "routing_mode" "routing_mode" DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "status_remarks" text;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "last_status_update_by" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "last_status_update_at" timestamp;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "actual_disbursed_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "actual_disbursement_date" date;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "disbursement_proof_url" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "bank_confirmation_number" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "origination_mode" "origination_mode" DEFAULT 'SELF_SERVICE' NOT NULL;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "routing_intent" "routing_intent" DEFAULT 'MARKETPLACE' NOT NULL;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "workflow_owner" "workflow_owner" DEFAULT 'SYSTEM' NOT NULL;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "lender_disclaimer_at" timestamp;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "commission_policy_version" varchar DEFAULT 'v1';--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "processing_mode" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "financier_name" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "banker_name" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "banker_mobile" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "banker_email" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "lead_registry_id" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "sla_start_at" timestamp;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "sla_expected_by" timestamp;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD COLUMN "sla_breached_at" timestamp;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD COLUMN "uploaded_by" "document_uploader" DEFAULT 'client';--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD COLUMN "uploaded_by_id" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD COLUMN "visible_to_bank" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD COLUMN "bank_visibility_changed_by" varchar;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD COLUMN "bank_visibility_changed_at" timestamp;--> statement-breakpoint
ALTER TABLE "epf_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "epf_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "eps_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "eps_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "esign_certificates" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "esign_certificates" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "expense_insights" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "expense_insights" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "external_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "external_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "family_activity_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "family_activity_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "family_goal_contributions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "family_goal_contributions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "family_members" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "financial_obligations" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "financial_obligations" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_audit_log" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_audit_log" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_order_payments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_order_payments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_reports" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_reports" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_settlements" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "fixed_income_settlements" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "form_15_audit_log" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "form_15_audit_log" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "global_portfolio_positions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "global_portfolio_positions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "goal_investment_links" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "goal_investment_links" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "government_scheme_audit" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "government_scheme_audit" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "government_scheme_consents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "government_scheme_consents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_account_summary" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_account_summary" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_accounts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_accounts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_market_data_subscriptions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_market_data_subscriptions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_orders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_orders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_positions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_positions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_trading_sessions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ib_trading_sessions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "icici_bank_credit_scores" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "icici_bank_credit_scores" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "icici_bank_loan_applications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "icici_bank_loan_applications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "income_streams" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "income_streams" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "insurance_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "insurance_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "investable_surplus" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "investable_surplus" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_ideas" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_ideas" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "itr_data_sources_sync" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "itr_data_sources_sync" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "itr_prefilled_forms" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "itr_prefilled_forms" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "knowledge_audit_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "knowledge_audit_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_audit_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_audit_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_token_map" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_token_map" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_upgrade_reminders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_upgrade_reminders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "initiated_by" varchar DEFAULT 'customer';--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "entity_type_detected" varchar;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "entity_locked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "aml_risk_level" varchar;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "aml_screening_id" varchar;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "ckyc_confidence_score" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "ckyc_missing_fields" text[] DEFAULT '{}'::text[];--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "aadhaar_required" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "video_kyc_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "listed_stocks" ADD COLUMN "historical_start_date" date;--> statement-breakpoint
ALTER TABLE "listed_stocks" ADD COLUMN "historical_end_date" date;--> statement-breakpoint
ALTER TABLE "listed_stocks" ADD COLUMN "historical_complete" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "listed_stocks" ADD COLUMN "last_daily_update" date;--> statement-breakpoint
ALTER TABLE "listed_stocks" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_comparisons" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_comparisons" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "loan_routing_history" ADD COLUMN "routing_mode" "routing_mode" DEFAULT 'auto';--> statement-breakpoint
ALTER TABLE "loan_routing_history" ADD COLUMN "submitted_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "lrs_limit_alerts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "lrs_limit_alerts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "mf_holdings" ADD COLUMN "first_purchase_date" date;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "purchase_date" date;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "purchase_nav" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "purchase_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "sale_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "realized_gain" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "gain_type" varchar;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "holding_period_days" integer;--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "grandfathered_value" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "indexed_cost" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "taxable_gain" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "estimated_tax" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mf_orders" ADD COLUMN "fiscal_year" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "isin" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "isin_dividend_payout" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "isin_dividend_reinvest" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "isin_growth" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "repurchase_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "sale_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "launch_date" date;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "min_sip_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "min_lumpsum_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "amc_code" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "exit_load_percent" numeric(8, 4);--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "exit_load_days" integer;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "scheme_sub_category" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "benchmark_index" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "benchmark_index_code" varchar;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "benchmark_confidence_score" numeric(3, 2);--> statement-breakpoint
ALTER TABLE "nps_accounts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "nps_accounts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pan_consents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pan_consents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "parent_partner_id" varchar;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "partner_level" varchar DEFAULT 'L1';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "hierarchy_partner_type" varchar DEFAULT 'MASTER';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "hierarchy_status" varchar DEFAULT 'ACTIVE';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "kyc_status" varchar DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "approval_status" varchar DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "agreement_id" varchar;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "max_depth" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "created_by" varchar;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pending_appointments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pending_appointments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pick_watchlist" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pick_watchlist" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD COLUMN "purchase_date" date;--> statement-breakpoint
ALTER TABLE "portfolio_metrics_daily" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_metrics_daily" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_report_audit_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_report_audit_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "ppf_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "ppf_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pre_approved_loan_offers" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pre_approved_loan_offers" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD COLUMN "readiness_status" varchar DEFAULT 'INITIAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD COLUMN "readiness_status_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD COLUMN "investment_horizon" varchar;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD COLUMN "investment_goals" varchar;--> statement-breakpoint
ALTER TABLE "prospect_clients" ADD COLUMN "tax_profile" jsonb;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "allocation_policy" jsonb;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "proposal_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "parent_proposal_id" varchar;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "is_latest_version" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "is_public" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "watermark_advisor_name" varchar;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "public_view_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "compliance_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "proposal_sections" jsonb;--> statement-breakpoint
ALTER TABLE "prospect_proposals" ADD COLUMN "analytics_data" jsonb;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalancing_recommendations" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalancing_recommendations" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalancing_snapshots" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "rebalancing_snapshots" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "reit_invit_holdings" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "reit_invit_holdings" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "reit_invit_orders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "reit_invit_orders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "scheme_consents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "scheme_consents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_document_access_log" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_document_access_log" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_sessions" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "tax_sessions" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_reports" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_reports" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "treasury_mandates" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "treasury_mandates" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_cart" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_cart" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_investor_tracking" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_investor_tracking" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_risk_disclosure_acknowledgments" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_risk_disclosure_acknowledgments" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_share_lockin" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "unlisted_share_lockin" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD COLUMN "is_primary" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD COLUMN "regulatory_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "user_budgets" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_budgets" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_cart" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_cart" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_demat_accounts" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_demat_accounts" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_expenses" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_expenses" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_investor_classifications" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_investor_classifications" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "kyc_tier_status" varchar DEFAULT 'provisional';--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "aml_risk_level" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "aml_screened_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "aml_screening_id" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "video_kyc_required" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "video_kyc_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "entity_type_locked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "entity_type_locked_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "entity_type_override_by" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "entity_type_override_reason" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "entity_type_override_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "aadhaar_verified_via_smart_kyc" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "pan_verified_via_smart_kyc" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_progress" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_progress" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "watchlists" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "watchlists" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_categories" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_categories" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_commerce_config" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_commerce_config" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_commerce_sync_logs" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_commerce_sync_logs" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_commerce_webhooks" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_commerce_webhooks" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_customers" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_customers" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_inventory" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_inventory" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_orders" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_orders" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_products" ADD COLUMN "prospect_id" varchar;--> statement-breakpoint
ALTER TABLE "zoho_products" ADD COLUMN "created_by_agent_id" varchar;--> statement-breakpoint
ALTER TABLE "agent_loan_actions" ADD CONSTRAINT "agent_loan_actions_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_loan_actions" ADD CONSTRAINT "agent_loan_actions_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_loan_status_history" ADD CONSTRAINT "agent_loan_status_history_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_loan_status_history" ADD CONSTRAINT "agent_loan_status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_payout_claims" ADD CONSTRAINT "agent_payout_claims_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_payout_claims" ADD CONSTRAINT "agent_payout_claims_routing_history_id_loan_routing_history_id_fk" FOREIGN KEY ("routing_history_id") REFERENCES "public"."loan_routing_history"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_payout_claims" ADD CONSTRAINT "agent_payout_claims_commission_tracking_id_dsa_commission_tracking_id_fk" FOREIGN KEY ("commission_tracking_id") REFERENCES "public"."dsa_commission_tracking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_payout_claims" ADD CONSTRAINT "agent_payout_claims_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_payout_claims" ADD CONSTRAINT "agent_payout_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prediction_logs" ADD CONSTRAINT "ai_prediction_logs_pick_id_daily_picks_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."daily_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_interactions" ADD CONSTRAINT "ai_user_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_interactions" ADD CONSTRAINT "ai_user_interactions_pick_id_daily_picks_id_fk" FOREIGN KEY ("pick_id") REFERENCES "public"."daily_picks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_user_profiles" ADD CONSTRAINT "ai_user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_credentials_vault" ADD CONSTRAINT "bank_credentials_vault_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_interaction_events" ADD CONSTRAINT "bank_interaction_events_loan_id_dsa_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_interaction_events" ADD CONSTRAINT "bank_interaction_events_reported_by_id_users_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_oauth_tokens" ADD CONSTRAINT "bank_oauth_tokens_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_product_appetite" ADD CONSTRAINT "bank_product_appetite_bank_code_bank_connectors_bank_code_fk" FOREIGN KEY ("bank_code") REFERENCES "public"."bank_connectors"("bank_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banker_confirmation_emails" ADD CONSTRAINT "banker_confirmation_emails_claim_id_payout_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."payout_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversion_funnels" ADD CONSTRAINT "conversion_funnels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_financials" ADD CONSTRAINT "developer_financials_project_id_developer_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."developer_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "developer_projects" ADD CONSTRAINT "developer_projects_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrichment_retry_queue" ADD CONSTRAINT "enrichment_retry_queue_instrument_id_listed_stocks_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."listed_stocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ADD CONSTRAINT "goal_benchmark_mapping_overridden_by_users_id_fk" FOREIGN KEY ("overridden_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_lots_v2" ADD CONSTRAINT "holding_lots_v2_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_lots_v2" ADD CONSTRAINT "holding_lots_v2_holding_id_portfolio_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."portfolio_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_lots_v2" ADD CONSTRAINT "holding_lots_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_lots_v2" ADD CONSTRAINT "holding_lots_v2_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding_lots_v2" ADD CONSTRAINT "holding_lots_v2_source_pdf_id_pdf_profiles_id_fk" FOREIGN KEY ("source_pdf_id") REFERENCES "public"."pdf_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_prices" ADD CONSTRAINT "instrument_prices_instrument_id_listed_stocks_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."listed_stocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_approvals" ADD CONSTRAINT "kyc_approvals_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_approvals" ADD CONSTRAINT "kyc_approvals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_approvals" ADD CONSTRAINT "kyc_approvals_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_approvals" ADD CONSTRAINT "kyc_approvals_checker_id_users_id_fk" FOREIGN KEY ("checker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_packs" ADD CONSTRAINT "kyc_audit_packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_packs" ADD CONSTRAINT "kyc_audit_packs_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_packs" ADD CONSTRAINT "kyc_audit_packs_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_flow_versions" ADD CONSTRAINT "kyc_flow_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_provider_priority" ADD CONSTRAINT "kyc_provider_priority_provider_id_kyc_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."kyc_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_provider_priority" ADD CONSTRAINT "kyc_provider_priority_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_rejection_events" ADD CONSTRAINT "kyc_rejection_events_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_rejection_events" ADD CONSTRAINT "kyc_rejection_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_rejection_events" ADD CONSTRAINT "kyc_rejection_events_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_step_resets" ADD CONSTRAINT "kyc_step_resets_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_step_resets" ADD CONSTRAINT "kyc_step_resets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_step_resets" ADD CONSTRAINT "kyc_step_resets_reset_by_users_id_fk" FOREIGN KEY ("reset_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_video_sessions" ADD CONSTRAINT "kyc_video_sessions_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_video_sessions" ADD CONSTRAINT "kyc_video_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_video_sessions" ADD CONSTRAINT "kyc_video_sessions_officer_id_users_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_disbursement_tranches" ADD CONSTRAINT "loan_disbursement_tranches_application_id_dsa_loan_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."dsa_loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_disbursement_tranches" ADD CONSTRAINT "loan_disbursement_tranches_project_id_developer_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."developer_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_index_nav" ADD CONSTRAINT "market_index_nav_index_id_market_indices_id_fk" FOREIGN KEY ("index_id") REFERENCES "public"."market_indices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_dsa_attachments" ADD CONSTRAINT "master_dsa_attachments_dsa_claim_id_master_dsa_claims_dsa_claim_id_fk" FOREIGN KEY ("dsa_claim_id") REFERENCES "public"."master_dsa_claims"("dsa_claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_dsa_claims" ADD CONSTRAINT "master_dsa_claims_payout_claim_id_payout_claims_claim_id_fk" FOREIGN KEY ("payout_claim_id") REFERENCES "public"."payout_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_dsa_claims" ADD CONSTRAINT "master_dsa_claims_lead_id_lead_registry_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead_registry"("lead_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "master_dsa_payments" ADD CONSTRAINT "master_dsa_payments_dsa_claim_id_master_dsa_claims_dsa_claim_id_fk" FOREIGN KEY ("dsa_claim_id") REFERENCES "public"."master_dsa_claims"("dsa_claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mf_monthwise_performance" ADD CONSTRAINT "mf_monthwise_performance_scheme_code_mutual_funds_scheme_code_fk" FOREIGN KEY ("scheme_code") REFERENCES "public"."mutual_funds"("scheme_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_ownership" ADD CONSTRAINT "partner_client_ownership_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_client_ownership" ADD CONSTRAINT "partner_client_ownership_owner_partner_id_partners_id_fk" FOREIGN KEY ("owner_partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commission_ledger" ADD CONSTRAINT "partner_commission_ledger_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commission_ledger" ADD CONSTRAINT "partner_commission_ledger_commission_rule_id_partner_commission_rules_id_fk" FOREIGN KEY ("commission_rule_id") REFERENCES "public"."partner_commission_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_hierarchy_agreements" ADD CONSTRAINT "partner_hierarchy_agreements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_wallets" ADD CONSTRAINT "partner_wallets_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payout_claims" ADD CONSTRAINT "payout_claims_lead_id_lead_registry_lead_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."lead_registry"("lead_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_parsing_audit_trail" ADD CONSTRAINT "pdf_parsing_audit_trail_profile_id_pdf_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."pdf_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_parsing_audit_trail" ADD CONSTRAINT "pdf_parsing_audit_trail_upload_id_portfolio_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."portfolio_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_parsing_audit_trail" ADD CONSTRAINT "pdf_parsing_audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pdf_parsing_audit_trail" ADD CONSTRAINT "pdf_parsing_audit_trail_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_configurations" ADD CONSTRAINT "product_configurations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_approvals" ADD CONSTRAINT "project_approvals_project_id_developer_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."developer_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_cashflows" ADD CONSTRAINT "project_cashflows_project_id_developer_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."developer_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_land_details" ADD CONSTRAINT "project_land_details_project_id_developer_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."developer_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_uploads" ADD CONSTRAINT "proof_uploads_claim_id_payout_claims_claim_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."payout_claims"("claim_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_audit_events" ADD CONSTRAINT "proposal_audit_events_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_flow_state" ADD CONSTRAINT "proposal_flow_state_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_pdf_metadata" ADD CONSTRAINT "proposal_pdf_metadata_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_report_sections" ADD CONSTRAINT "proposal_report_sections_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sip_recommendations" ADD CONSTRAINT "proposal_sip_recommendations_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_sip_recommendations" ADD CONSTRAINT "proposal_sip_recommendations_verdict_id_proposal_verdicts_id_fk" FOREIGN KEY ("verdict_id") REFERENCES "public"."proposal_verdicts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_verdicts" ADD CONSTRAINT "proposal_verdicts_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_what_if_scenarios" ADD CONSTRAINT "proposal_what_if_scenarios_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_metrics" ADD CONSTRAINT "provider_metrics_provider_id_kyc_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."kyc_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_audit_log" ADD CONSTRAINT "research_audit_log_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_list_items" ADD CONSTRAINT "research_list_items_research_list_id_research_lists_id_fk" FOREIGN KEY ("research_list_id") REFERENCES "public"."research_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_list_items" ADD CONSTRAINT "research_list_items_added_by_agent_id_agents_id_fk" FOREIGN KEY ("added_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_list_proposal_attachments" ADD CONSTRAINT "research_list_proposal_attachments_research_list_id_research_lists_id_fk" FOREIGN KEY ("research_list_id") REFERENCES "public"."research_lists"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_list_proposal_attachments" ADD CONSTRAINT "research_list_proposal_attachments_attached_by_agent_id_agents_id_fk" FOREIGN KEY ("attached_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "research_lists" ADD CONSTRAINT "research_lists_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_screeners" ADD CONSTRAINT "saved_screeners_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_audit_logs" ADD CONSTRAINT "sebi_audit_logs_advisor_id_users_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_signatures" ADD CONSTRAINT "user_signatures_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_feature_snapshots_asset_date" ON "ai_feature_snapshots" USING btree ("asset_id","snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_ai_feature_snapshots_date" ON "ai_feature_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "idx_ai_feature_snapshots_class" ON "ai_feature_snapshots" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_ai_model_registry_name_version" ON "ai_model_registry" USING btree ("model_name","model_version");--> statement-breakpoint
CREATE INDEX "idx_ai_model_registry_active" ON "ai_model_registry" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_ai_model_registry_class" ON "ai_model_registry" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_ai_prediction_logs_model_date" ON "ai_prediction_logs" USING btree ("model_name","prediction_date");--> statement-breakpoint
CREATE INDEX "idx_ai_prediction_logs_pick" ON "ai_prediction_logs" USING btree ("pick_id");--> statement-breakpoint
CREATE INDEX "idx_ai_prediction_logs_class" ON "ai_prediction_logs" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_ai_prediction_logs_date" ON "ai_prediction_logs" USING btree ("prediction_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ai_price_history_asset_date_unique" ON "ai_price_history" USING btree ("asset_id","price_date");--> statement-breakpoint
CREATE INDEX "idx_ai_price_history_date" ON "ai_price_history" USING btree ("price_date");--> statement-breakpoint
CREATE INDEX "idx_ai_price_history_class" ON "ai_price_history" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "idx_ai_regime_history_date" ON "ai_regime_history" USING btree ("regime_date");--> statement-breakpoint
CREATE INDEX "idx_ai_regime_history_label" ON "ai_regime_history" USING btree ("regime_label");--> statement-breakpoint
CREATE INDEX "idx_ai_user_interactions_user_pick" ON "ai_user_interactions" USING btree ("user_id","pick_id");--> statement-breakpoint
CREATE INDEX "idx_ai_user_interactions_user_created" ON "ai_user_interactions" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_ai_user_interactions_type" ON "ai_user_interactions" USING btree ("interaction_type");--> statement-breakpoint
CREATE INDEX "idx_ai_user_profiles_user" ON "ai_user_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_user_profiles_risk" ON "ai_user_profiles" USING btree ("risk_tolerance_score");--> statement-breakpoint
CREATE INDEX "idx_amfi_scheme_benchmarks_isin" ON "amfi_scheme_benchmarks" USING btree ("mf_isin");--> statement-breakpoint
CREATE INDEX "idx_amfi_scheme_benchmarks_code" ON "amfi_scheme_benchmarks" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_amfi_scheme_benchmarks_normalized" ON "amfi_scheme_benchmarks" USING btree ("normalized_benchmark");--> statement-breakpoint
CREATE INDEX "idx_banker_emails_claim" ON "banker_confirmation_emails" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_consent_audit_user" ON "consent_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_consent_audit_type" ON "consent_audit_log" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "idx_consent_audit_created" ON "consent_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_enrichment_job_log_type" ON "enrichment_job_log" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_enrichment_job_log_status" ON "enrichment_job_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_enrichment_job_log_executed" ON "enrichment_job_log" USING btree ("executed_at");--> statement-breakpoint
CREATE INDEX "idx_retry_queue_instrument" ON "enrichment_retry_queue" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_retry_queue_job_type" ON "enrichment_retry_queue" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "idx_retry_queue_next_retry" ON "enrichment_retry_queue" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_fmp_usage_date" ON "fmp_usage_log" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_fmp_usage_provider" ON "fmp_usage_log" USING btree ("provider","date");--> statement-breakpoint
CREATE INDEX "idx_goal_benchmark_goal" ON "goal_benchmark_mapping" USING btree ("goal_type");--> statement-breakpoint
CREATE INDEX "idx_goal_benchmark_risk" ON "goal_benchmark_mapping" USING btree ("risk_profile");--> statement-breakpoint
CREATE INDEX "idx_holding_lots_v2_portfolio" ON "holding_lots_v2" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_holding_lots_v2_user" ON "holding_lots_v2" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_holding_lots_v2_isin" ON "holding_lots_v2" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_holding_lots_v2_purchase_date" ON "holding_lots_v2" USING btree ("purchase_date");--> statement-breakpoint
CREATE INDEX "idx_holding_lots_v2_status" ON "holding_lots_v2" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_instrument_price" ON "instrument_prices" USING btree ("instrument_id","price_date");--> statement-breakpoint
CREATE INDEX "idx_instrument_prices_date" ON "instrument_prices" USING btree ("price_date");--> statement-breakpoint
CREATE INDEX "idx_instrument_prices_instrument" ON "instrument_prices" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_approval_session" ON "kyc_approvals" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_approval_status" ON "kyc_approvals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_approval_maker" ON "kyc_approvals" USING btree ("maker_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_approval_checker" ON "kyc_approvals" USING btree ("checker_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_pack_user" ON "kyc_audit_packs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_pack_session" ON "kyc_audit_packs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_pack_generated_at" ON "kyc_audit_packs" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_eligibility_product" ON "kyc_product_eligibility_rules" USING btree ("product_code");--> statement-breakpoint
CREATE INDEX "idx_kyc_eligibility_tier" ON "kyc_product_eligibility_rules" USING btree ("required_tier");--> statement-breakpoint
CREATE INDEX "idx_kyc_rate_key" ON "kyc_rate_limit_counters" USING btree ("limit_key");--> statement-breakpoint
CREATE INDEX "idx_kyc_rate_type" ON "kyc_rate_limit_counters" USING btree ("limit_type");--> statement-breakpoint
CREATE INDEX "idx_kyc_rate_window" ON "kyc_rate_limit_counters" USING btree ("window_start","window_end");--> statement-breakpoint
CREATE INDEX "idx_kyc_rejection_session" ON "kyc_rejection_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_rejection_user" ON "kyc_rejection_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_rejection_code" ON "kyc_rejection_events" USING btree ("reason_code");--> statement-breakpoint
CREATE INDEX "idx_kyc_step_reset_session" ON "kyc_step_resets" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_step_reset_user" ON "kyc_step_resets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_step_reset_step" ON "kyc_step_resets" USING btree ("step");--> statement-breakpoint
CREATE INDEX "idx_video_kyc_user" ON "kyc_video_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_video_kyc_session" ON "kyc_video_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_video_kyc_status" ON "kyc_video_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_webhook_provider" ON "kyc_webhook_events" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_kyc_webhook_status" ON "kyc_webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_webhook_retry" ON "kyc_webhook_events" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_webhook_reference" ON "kyc_webhook_events" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "idx_lead_audit_lead" ON "lead_audit_logs" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_audit_claim" ON "lead_audit_logs" USING btree ("claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_lead_registry_pan_mobile" ON "lead_registry" USING btree ("pan","mobile");--> statement-breakpoint
CREATE INDEX "idx_lead_registry_agent" ON "lead_registry" USING btree ("first_agent_id");--> statement-breakpoint
CREATE INDEX "idx_lead_registry_partner" ON "lead_registry" USING btree ("first_partner_id");--> statement-breakpoint
CREATE INDEX "idx_lead_registry_status" ON "lead_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_market_index_nav_index_id" ON "market_index_nav" USING btree ("index_id");--> statement-breakpoint
CREATE INDEX "idx_market_index_nav_date" ON "market_index_nav" USING btree ("nav_date");--> statement-breakpoint
CREATE INDEX "idx_master_dsa_attachments_claim" ON "master_dsa_attachments" USING btree ("dsa_claim_id");--> statement-breakpoint
CREATE INDEX "idx_master_dsa_claims_payout" ON "master_dsa_claims" USING btree ("payout_claim_id");--> statement-breakpoint
CREATE INDEX "idx_master_dsa_claims_lead" ON "master_dsa_claims" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_master_dsa_claims_status" ON "master_dsa_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_master_dsa_payments_claim" ON "master_dsa_payments" USING btree ("dsa_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mf_aum_history_unique" ON "mf_aum_history" USING btree ("scheme_code","as_of_date");--> statement-breakpoint
CREATE INDEX "idx_mf_aum_history_scheme" ON "mf_aum_history" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_mf_aum_history_date" ON "mf_aum_history" USING btree ("as_of_date");--> statement-breakpoint
CREATE INDEX "idx_mf_benchmark_history_isin" ON "mf_benchmark_history" USING btree ("mf_isin");--> statement-breakpoint
CREATE INDEX "idx_mf_benchmark_history_changed" ON "mf_benchmark_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "idx_mf_benchmark_lineage_isin" ON "mf_benchmark_lineage" USING btree ("mf_isin");--> statement-breakpoint
CREATE INDEX "idx_mf_benchmark_lineage_changed_at" ON "mf_benchmark_lineage" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "idx_mf_benchmark_map_index_code" ON "mf_benchmark_map" USING btree ("index_code");--> statement-breakpoint
CREATE INDEX "idx_mf_benchmark_map_scheme_code" ON "mf_benchmark_map" USING btree ("mf_scheme_code");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_mf_category_rules_unique" ON "mf_category_rules" USING btree ("category","sub_category","version");--> statement-breakpoint
CREATE INDEX "idx_mf_enrichment_audit_scheme" ON "mf_enrichment_audit_logs" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_mf_enrichment_audit_created" ON "mf_enrichment_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_mf_enrichment_audit_run" ON "mf_enrichment_audit_logs" USING btree ("enrichment_run_id");--> statement-breakpoint
CREATE INDEX "idx_mf_monthwise_performance_scheme" ON "mf_monthwise_performance" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_mf_monthwise_performance_month" ON "mf_monthwise_performance" USING btree ("month_year");--> statement-breakpoint
CREATE INDEX "idx_mf_monthwise_performance_unique" ON "mf_monthwise_performance" USING btree ("scheme_code","month_year");--> statement-breakpoint
CREATE INDEX "mf_scheme_stock_holdings_mf_isin_idx" ON "mf_scheme_stock_holdings" USING btree ("mf_isin");--> statement-breakpoint
CREATE INDEX "mf_scheme_stock_holdings_stock_symbol_idx" ON "mf_scheme_stock_holdings" USING btree ("stock_symbol");--> statement-breakpoint
CREATE INDEX "mf_scheme_stock_holdings_holding_date_idx" ON "mf_scheme_stock_holdings" USING btree ("holding_date");--> statement-breakpoint
CREATE UNIQUE INDEX "mf_scheme_stock_holdings_unique_idx" ON "mf_scheme_stock_holdings" USING btree ("mf_isin","stock_symbol","holding_date");--> statement-breakpoint
CREATE INDEX "idx_payout_claims_lead" ON "payout_claims" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_payout_claims_agent" ON "payout_claims" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_payout_claims_status" ON "payout_claims" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pdf_parsing_audit_profile" ON "pdf_parsing_audit_trail" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_pdf_parsing_audit_user" ON "pdf_parsing_audit_trail" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pdf_parsing_audit_success" ON "pdf_parsing_audit_trail" USING btree ("success");--> statement-breakpoint
CREATE INDEX "idx_pdf_parsing_audit_version" ON "pdf_parsing_audit_trail" USING btree ("parser_version");--> statement-breakpoint
CREATE INDEX "idx_pdf_profiles_fingerprint" ON "pdf_profiles" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "idx_pdf_profiles_type" ON "pdf_profiles" USING btree ("pdf_type");--> statement-breakpoint
CREATE INDEX "idx_pdf_profiles_layout" ON "pdf_profiles" USING btree ("layout_type");--> statement-breakpoint
CREATE INDEX "idx_portal_access_log_user" ON "portal_access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_portal_access_log_portal" ON "portal_access_log" USING btree ("portal_type");--> statement-breakpoint
CREATE INDEX "idx_portal_access_log_date" ON "portal_access_log" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "idx_proof_uploads_claim" ON "proof_uploads" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_proposal" ON "proposal_audit_events" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_event_type" ON "proposal_audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_actor" ON "proposal_audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_checksum" ON "proposal_audit_events" USING btree ("checksum");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_created" ON "proposal_audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_log_proposal" ON "proposal_audit_log" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_log_event" ON "proposal_audit_log" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_proposal_audit_log_created" ON "proposal_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_proposal_backtest_proposal" ON "proposal_backtest_results" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_flow_state_proposal" ON "proposal_flow_state" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_pdf_metadata_proposal" ON "proposal_pdf_metadata" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_pdf_metadata_hash" ON "proposal_pdf_metadata" USING btree ("pdf_hash");--> statement-breakpoint
CREATE INDEX "idx_report_sections_proposal" ON "proposal_report_sections" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_sip_proposal" ON "proposal_sip_recommendations" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_sip_source" ON "proposal_sip_recommendations" USING btree ("sip_source");--> statement-breakpoint
CREATE INDEX "idx_proposal_verdicts_proposal" ON "proposal_verdicts" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_verdicts_isin" ON "proposal_verdicts" USING btree ("instrument_isin");--> statement-breakpoint
CREATE INDEX "idx_proposal_versions_proposal" ON "proposal_versions" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_proposal_versions_version" ON "proposal_versions" USING btree ("proposal_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_what_if_proposal" ON "proposal_what_if_scenarios" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_what_if_mode" ON "proposal_what_if_scenarios" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "idx_quant_model_registry_name_version" ON "quant_model_registry" USING btree ("model_name","version");--> statement-breakpoint
CREATE INDEX "idx_quant_model_registry_status" ON "quant_model_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quant_model_registry_type" ON "quant_model_registry" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "idx_quant_retraining_log_model" ON "quant_retraining_log" USING btree ("model_name");--> statement-breakpoint
CREATE INDEX "idx_quant_retraining_log_status" ON "quant_retraining_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_quant_retraining_log_created" ON "quant_retraining_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_quant_run_log_model" ON "quant_run_log" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "idx_quant_run_log_created" ON "quant_run_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_quant_run_log_portfolio" ON "quant_run_log" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_quant_scheduler_state_key" ON "quant_scheduler_state" USING btree ("lock_key");--> statement-breakpoint
CREATE INDEX "idx_quant_transition_log_portfolio" ON "quant_transition_log" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_quant_transition_log_created" ON "quant_transition_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_rebalance_log_proposal" ON "rebalance_decision_log" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_rebalance_log_created" ON "rebalance_decision_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_regulatory_gaps_regulator" ON "regulatory_gaps" USING btree ("regulator");--> statement-breakpoint
CREATE INDEX "idx_regulatory_gaps_status" ON "regulatory_gaps" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_regulatory_gaps_risk" ON "regulatory_gaps" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_research_audit_entity" ON "research_audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_research_audit_agent" ON "research_audit_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_research_audit_created" ON "research_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_research_list_items_list" ON "research_list_items" USING btree ("research_list_id");--> statement-breakpoint
CREATE INDEX "idx_research_list_items_instrument" ON "research_list_items" USING btree ("instrument_id","instrument_type");--> statement-breakpoint
CREATE INDEX "idx_research_list_items_added" ON "research_list_items" USING btree ("added_at");--> statement-breakpoint
CREATE INDEX "idx_research_list_proposal_proposal" ON "research_list_proposal_attachments" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_research_list_proposal_list" ON "research_list_proposal_attachments" USING btree ("research_list_id");--> statement-breakpoint
CREATE INDEX "idx_research_lists_agent" ON "research_lists" USING btree ("created_by_agent_id");--> statement-breakpoint
CREATE INDEX "idx_research_lists_visibility" ON "research_lists" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX "idx_research_lists_universe" ON "research_lists" USING btree ("universe_type");--> statement-breakpoint
CREATE INDEX "idx_research_lists_org" ON "research_lists" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_saved_screeners_agent" ON "saved_screeners" USING btree ("created_by_agent_id");--> statement-breakpoint
CREATE INDEX "idx_saved_screeners_universe" ON "saved_screeners" USING btree ("universe_type");--> statement-breakpoint
CREATE INDEX "idx_scheme_rename_log_isin" ON "scheme_rename_log" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_scheme_rename_log_scheme_code" ON "scheme_rename_log" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_scheme_rename_log_detected_at" ON "scheme_rename_log" USING btree ("detected_at");--> statement-breakpoint
CREATE INDEX "idx_scheme_txn_rules_isin" ON "scheme_transaction_rules" USING btree ("isin");--> statement-breakpoint
CREATE INDEX "idx_scheme_txn_rules_scheme_code" ON "scheme_transaction_rules" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_scheme_txn_rules_status" ON "scheme_transaction_rules" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "idx_screener_ag_symbol" ON "screener_analyst_grades" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_ag_date" ON "screener_analyst_grades" USING btree ("symbol","published_date");--> statement-breakpoint
CREATE INDEX "idx_screener_at_symbol" ON "screener_analyst_targets" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_at_date" ON "screener_analyst_targets" USING btree ("symbol","published_date");--> statement-breakpoint
CREATE INDEX "idx_screener_rating_symbol" ON "screener_company_ratings" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_rating_score" ON "screener_company_ratings" USING btree ("rating_score");--> statement-breakpoint
CREATE INDEX "idx_screener_dcf_symbol" ON "screener_dcf_valuations" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_derived_symbol" ON "screener_derived_metrics" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_derived_composite" ON "screener_derived_metrics" USING btree ("composite_score");--> statement-breakpoint
CREATE INDEX "idx_screener_derived_rating" ON "screener_derived_metrics" USING btree ("fintek_rating");--> statement-breakpoint
CREATE INDEX "idx_screener_dc_symbol" ON "screener_dividend_calendar" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_dc_date" ON "screener_dividend_calendar" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_screener_ec_symbol" ON "screener_earnings_calendar" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_ec_date" ON "screener_earnings_calendar" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_screener_econ_date" ON "screener_economic_calendar" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_screener_econ_country" ON "screener_economic_calendar" USING btree ("country");--> statement-breakpoint
CREATE INDEX "idx_screener_fin_symbol" ON "screener_financials" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_fin_period" ON "screener_financials" USING btree ("symbol","period");--> statement-breakpoint
CREATE INDEX "idx_screener_fin_pe" ON "screener_financials" USING btree ("pe_ratio");--> statement-breakpoint
CREATE INDEX "idx_screener_fin_roe" ON "screener_financials" USING btree ("roe");--> statement-breakpoint
CREATE INDEX "idx_screener_fin_de" ON "screener_financials" USING btree ("debt_to_equity");--> statement-breakpoint
CREATE INDEX "idx_screener_growth_symbol" ON "screener_growth_metrics" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_growth_date" ON "screener_growth_metrics" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "idx_screener_it_symbol" ON "screener_insider_trades" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_it_date" ON "screener_insider_trades" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_screener_ih_symbol" ON "screener_institutional_holders" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_ipo_date" ON "screener_ipo_calendar" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_screener_ipo_symbol" ON "screener_ipo_calendar" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_km_symbol" ON "screener_key_metrics" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_km_date" ON "screener_key_metrics" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "idx_screener_km_roic" ON "screener_key_metrics" USING btree ("roic");--> statement-breakpoint
CREATE INDEX "idx_screener_price_symbol" ON "screener_price_history" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_price_date" ON "screener_price_history" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "idx_screener_sp_sector" ON "screener_sector_performance" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_screener_sp_date" ON "screener_sector_performance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_screener_sc_symbol" ON "screener_split_calendar" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_sc_date" ON "screener_split_calendar" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_screener_news_symbol" ON "screener_stock_news" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_news_date" ON "screener_stock_news" USING btree ("published_date");--> statement-breakpoint
CREATE INDEX "idx_screener_stocks_symbol" ON "screener_stocks" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_stocks_sector" ON "screener_stocks" USING btree ("sector");--> statement-breakpoint
CREATE INDEX "idx_screener_stocks_market_cap" ON "screener_stocks" USING btree ("market_cap_category");--> statement-breakpoint
CREATE INDEX "idx_screener_stocks_active" ON "screener_stocks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_screener_ti_symbol" ON "screener_technical_indicators" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_screener_ti_date" ON "screener_technical_indicators" USING btree ("symbol","date");--> statement-breakpoint
CREATE INDEX "idx_sebi_audit_proposal" ON "sebi_audit_logs" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_audit_advisor" ON "sebi_audit_logs" USING btree ("advisor_id");--> statement-breakpoint
CREATE INDEX "idx_sebi_audit_action_type" ON "sebi_audit_logs" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_sebi_audit_created" ON "sebi_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "stock_intersection_portfolio_id_idx" ON "stock_intersection_analysis" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "stock_intersection_prospect_id_idx" ON "stock_intersection_analysis" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "stock_intersection_user_id_idx" ON "stock_intersection_analysis" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stock_intersection_analysis_date_idx" ON "stock_intersection_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "idx_strategic_weights_portfolio" ON "strategic_target_weights" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_strategic_weights_generated" ON "strategic_target_weights" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "idx_user_signatures_user" ON "user_signatures" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_signatures_default" ON "user_signatures" USING btree ("user_id","is_default");--> statement-breakpoint
ALTER TABLE "aa_consent_sessions" ADD CONSTRAINT "aa_consent_sessions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD CONSTRAINT "aa_data_fetch_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_raw_payloads" ADD CONSTRAINT "aa_raw_payloads_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_investment_limit_overrides" ADD CONSTRAINT "active_investment_limit_overrides_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisory_subscriptions" ADD CONSTRAINT "advisory_subscriptions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_itr_activity_log" ADD CONSTRAINT "agent_itr_activity_log_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_transaction_tracking" ADD CONSTRAINT "ai_transaction_tracking_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_audit_logs" ADD CONSTRAINT "appointment_audit_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apy_accounts" ADD CONSTRAINT "apy_accounts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD CONSTRAINT "asset_forecasts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_population_status" ADD CONSTRAINT "auto_population_status_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD CONSTRAINT "bbps_customer_bills_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD CONSTRAINT "bbps_transactions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_coupon_payments" ADD CONSTRAINT "bond_coupon_payments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD CONSTRAINT "bond_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_ncd_applications" ADD CONSTRAINT "bond_ncd_applications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_orders" ADD CONSTRAINT "bond_orders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_risk_disclosure_acknowledgments" ADD CONSTRAINT "bond_risk_disclosure_acknowledgments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_suitability_checks" ADD CONSTRAINT "bond_suitability_checks_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_watchlist" ADD CONSTRAINT "bond_watchlist_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_reports" ADD CONSTRAINT "capital_gains_reports_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD CONSTRAINT "capital_gains_tax_reminders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ADD CONSTRAINT "cashfree_transactions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_deferred_cases" ADD CONSTRAINT "ckyc_deferred_cases_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_records" ADD CONSTRAINT "ckyc_records_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_verification_requests" ADD CONSTRAINT "ckyc_verification_requests_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ADD CONSTRAINT "client_enrichment_data_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_statements" ADD CONSTRAINT "client_statements_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_tasks" ADD CONSTRAINT "client_tasks_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_history" ADD CONSTRAINT "comparison_history_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD CONSTRAINT "compliance_audit_trail_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compound_alerts" ADD CONSTRAINT "compound_alerts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_widget_preferences" ADD CONSTRAINT "dashboard_widget_preferences_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source_consents" ADD CONSTRAINT "data_source_consents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD CONSTRAINT "digilocker_kyc_mappings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD CONSTRAINT "digilocker_shared_documents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD CONSTRAINT "digilocker_user_sessions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD CONSTRAINT "dsa_loan_applications_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_applications" ADD CONSTRAINT "dsa_loan_applications_last_status_update_by_users_id_fk" FOREIGN KEY ("last_status_update_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD CONSTRAINT "dsa_loan_documents_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsa_loan_documents" ADD CONSTRAINT "dsa_loan_documents_bank_visibility_changed_by_users_id_fk" FOREIGN KEY ("bank_visibility_changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epf_holdings" ADD CONSTRAINT "epf_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eps_holdings" ADD CONSTRAINT "eps_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_certificates" ADD CONSTRAINT "esign_certificates_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD CONSTRAINT "esign_requests_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_insights" ADD CONSTRAINT "expense_insights_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_holdings" ADD CONSTRAINT "external_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_logs" ADD CONSTRAINT "family_activity_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_goal_contributions" ADD CONSTRAINT "family_goal_contributions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD CONSTRAINT "family_portfolio_permissions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_obligations" ADD CONSTRAINT "financial_obligations_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_audit_log" ADD CONSTRAINT "fixed_income_audit_log_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_order_payments" ADD CONSTRAINT "fixed_income_order_payments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_reports" ADD CONSTRAINT "fixed_income_reports_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_income_settlements" ADD CONSTRAINT "fixed_income_settlements_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_15_audit_log" ADD CONSTRAINT "form_15_audit_log_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_portfolio_positions" ADD CONSTRAINT "global_portfolio_positions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_investment_links" ADD CONSTRAINT "goal_investment_links_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_scheme_audit" ADD CONSTRAINT "government_scheme_audit_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_scheme_consents" ADD CONSTRAINT "government_scheme_consents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_account_summary" ADD CONSTRAINT "ib_account_summary_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_accounts" ADD CONSTRAINT "ib_accounts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_market_data_subscriptions" ADD CONSTRAINT "ib_market_data_subscriptions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_orders" ADD CONSTRAINT "ib_orders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_positions" ADD CONSTRAINT "ib_positions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_trading_sessions" ADD CONSTRAINT "ib_trading_sessions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icici_bank_credit_scores" ADD CONSTRAINT "icici_bank_credit_scores_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icici_bank_loan_applications" ADD CONSTRAINT "icici_bank_loan_applications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_streams" ADD CONSTRAINT "income_streams_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_holdings" ADD CONSTRAINT "insurance_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investable_surplus" ADD CONSTRAINT "investable_surplus_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD CONSTRAINT "investment_idea_alerts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD CONSTRAINT "investment_idea_tracking_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_ideas" ADD CONSTRAINT "investment_ideas_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_limit_override_proposals" ADD CONSTRAINT "investment_limit_override_proposals_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itr_data_sources_sync" ADD CONSTRAINT "itr_data_sources_sync_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itr_prefilled_forms" ADD CONSTRAINT "itr_prefilled_forms_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_audit_logs" ADD CONSTRAINT "knowledge_audit_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_logs" ADD CONSTRAINT "kyc_audit_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD CONSTRAINT "kyc_consent_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" ADD CONSTRAINT "kyc_reuse_tokens_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_token_map" ADD CONSTRAINT "kyc_token_map_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_upgrade_reminders" ADD CONSTRAINT "kyc_upgrade_reminders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD CONSTRAINT "kyc_verification_sessions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD CONSTRAINT "loan_comparison_analytics_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparisons" ADD CONSTRAINT "loan_comparisons_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_routing_history" ADD CONSTRAINT "loan_routing_history_submitted_by_agent_id_users_id_fk" FOREIGN KEY ("submitted_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ADD CONSTRAINT "lrs_compliance_tracking_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_limit_alerts" ADD CONSTRAINT "lrs_limit_alerts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD CONSTRAINT "lrs_transactions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD CONSTRAINT "manual_kyc_submissions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_accounts" ADD CONSTRAINT "nps_accounts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD CONSTRAINT "pan_consent_audit_log_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consents" ADD CONSTRAINT "pan_consents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD CONSTRAINT "partner_application_documents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_appointments" ADD CONSTRAINT "pending_appointments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD CONSTRAINT "phonepe_transactions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_watchlist" ADD CONSTRAINT "pick_watchlist_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_metrics_daily" ADD CONSTRAINT "portfolio_metrics_daily_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD CONSTRAINT "portfolio_predictions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_report_audit_logs" ADD CONSTRAINT "portfolio_report_audit_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppf_holdings" ADD CONSTRAINT "ppf_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approved_loan_offers" ADD CONSTRAINT "pre_approved_loan_offers_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" ADD CONSTRAINT "pre_ipo_analytics_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ADD CONSTRAINT "pre_ipo_investments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_summaries" ADD CONSTRAINT "rebalance_summaries_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_actions" ADD CONSTRAINT "rebalancing_actions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_recommendations" ADD CONSTRAINT "rebalancing_recommendations_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_snapshots" ADD CONSTRAINT "rebalancing_snapshots_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reit_invit_holdings" ADD CONSTRAINT "reit_invit_holdings_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reit_invit_orders" ADD CONSTRAINT "reit_invit_orders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD CONSTRAINT "risk_analysis_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_reports" ADD CONSTRAINT "scheduled_reports_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheme_consents" ADD CONSTRAINT "scheme_consents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_ai_risk_recommendations" ADD CONSTRAINT "sebi_ai_risk_recommendations_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_client_risk_assessments" ADD CONSTRAINT "sebi_client_risk_assessments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sebi_goal_risk_profiles" ADD CONSTRAINT "sebi_goal_risk_profiles_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD CONSTRAINT "structured_tax_data_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_document_access_log" ADD CONSTRAINT "tax_document_access_log_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" ADD CONSTRAINT "tax_reminder_subscriptions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_sessions" ADD CONSTRAINT "tax_sessions_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD CONSTRAINT "transaction_enrichment_analysis_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reports" ADD CONSTRAINT "transaction_reports_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasury_mandates" ADD CONSTRAINT "treasury_mandates_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_cart_items" ADD CONSTRAINT "unified_cart_items_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_cart" ADD CONSTRAINT "unlisted_cart_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_investor_tracking" ADD CONSTRAINT "unlisted_investor_tracking_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_risk_disclosure_acknowledgments" ADD CONSTRAINT "unlisted_risk_disclosure_acknowledgments_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unlisted_share_lockin" ADD CONSTRAINT "unlisted_share_lockin_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_budgets" ADD CONSTRAINT "user_budgets_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cart" ADD CONSTRAINT "user_cart_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_demat_accounts" ADD CONSTRAINT "user_demat_accounts_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_expenses" ADD CONSTRAINT "user_expenses_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_investor_classifications" ADD CONSTRAINT "user_investor_classifications_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD CONSTRAINT "user_wishlist_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD CONSTRAINT "yield_tracker_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_categories" ADD CONSTRAINT "zoho_categories_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_commerce_config" ADD CONSTRAINT "zoho_commerce_config_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_commerce_sync_logs" ADD CONSTRAINT "zoho_commerce_sync_logs_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_commerce_webhooks" ADD CONSTRAINT "zoho_commerce_webhooks_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_customers" ADD CONSTRAINT "zoho_customers_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_inventory" ADD CONSTRAINT "zoho_inventory_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_orders" ADD CONSTRAINT "zoho_orders_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_products" ADD CONSTRAINT "zoho_products_created_by_agent_id_users_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_log_user" ON "kyc_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_fiscal_year" ON "mf_orders" USING btree ("fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_mf_orders_gain_type" ON "mf_orders" USING btree ("gain_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mf_metrics_scheme_fy" ON "mutual_fund_metrics" USING btree ("scheme_code","fiscal_year");--> statement-breakpoint
CREATE INDEX "idx_prospect_clients_readiness" ON "prospect_clients" USING btree ("readiness_status");--> statement-breakpoint
ALTER TABLE "mutual_fund_metrics" DROP COLUMN "scheme_name";--> statement-breakpoint
ALTER TABLE "mutual_fund_metrics" DROP COLUMN "fund_category";