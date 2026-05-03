CREATE TYPE "public"."instrument_asset_class" AS ENUM('equity', 'mutual_fund', 'bond', 'etf', 'mld', 'unlisted', 'aif', 'pms', 'fd', 'gold', 'real_estate', 'other');--> statement-breakpoint
CREATE TABLE "admin_approval_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"requested_by" varchar NOT NULL,
	"checker_id" varchar,
	"entity_type" varchar NOT NULL,
	"entity_id" varchar,
	"action" varchar NOT NULL,
	"data" jsonb NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "amfi_distributors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"arn_code" varchar(20) NOT NULL,
	"euin_number" varchar(20),
	"distributor_name" varchar(255),
	"distributor_type" varchar(50),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"arn_expiry_date" timestamp,
	"registration_date" timestamp,
	"city" varchar(100),
	"state" varchar(100),
	"email" varchar(255),
	"mobile" varchar(15),
	"last_synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "amfi_distributors_arn_code_unique" UNIQUE("arn_code"),
	CONSTRAINT "amfi_distributors_euin_number_unique" UNIQUE("euin_number")
);
--> statement-breakpoint
CREATE TABLE "audit_trail" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"action" varchar NOT NULL,
	"category" varchar NOT NULL,
	"details" text,
	"ip_address" varchar,
	"user_agent" text,
	"outcome" varchar,
	"risk_level" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fintekpro_ca_registry" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"icai_membership_number" varchar(20) NOT NULL,
	"name_at_icai" varchar(255),
	"membership_type" varchar(10),
	"membership_status" varchar(20),
	"cop_status" varchar(20),
	"is_fintekpro_partner" boolean DEFAULT false,
	"partners_table_id" varchar,
	"user_id" varchar,
	"firm_name" varchar(255),
	"city" varchar(100),
	"state" varchar(100),
	"specializations" jsonb,
	"experience_years" integer,
	"availability" varchar(20) DEFAULT 'unknown',
	"max_cases_per_month" integer,
	"average_rating" numeric(3, 2),
	"total_cases_completed" integer DEFAULT 0,
	"response_time_hours" integer,
	"tier" varchar(20) DEFAULT 'bronze',
	"tier_upgraded_at" timestamp,
	"referral_code" varchar(20),
	"referred_by_code" varchar(20),
	"referral_count" integer DEFAULT 0,
	"verified_at" timestamp,
	"verified_by" varchar(50),
	"confidence_score" numeric(4, 2),
	"verification_source" varchar(50),
	"raw_verification_response" jsonb,
	"last_revalidated_at" timestamp,
	"next_revalidation_due" timestamp,
	"revalidation_failure_count" integer DEFAULT 0,
	"revalidation_status" varchar(20) DEFAULT 'ok',
	"source" varchar(30) DEFAULT 'self_registered',
	"is_publicly_listed" boolean DEFAULT false,
	"listed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fintekpro_ca_registry_icai_membership_number_unique" UNIQUE("icai_membership_number"),
	CONSTRAINT "fintekpro_ca_registry_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "iris_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"refreshed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lrs_remittance_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alpaca_account_id" varchar,
	"transfer_id" varchar,
	"amount_usd" numeric(15, 2) NOT NULL,
	"amount_inr" numeric(15, 2),
	"usd_inr_rate" numeric(10, 4),
	"financial_year" varchar(7) NOT NULL,
	"purpose" varchar(100) DEFAULT 'S0001',
	"transfer_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lrs_remittance_logs_transfer_id_unique" UNIQUE("transfer_id")
);
--> statement-breakpoint
CREATE TABLE "platform_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ca_platform_fee_pct" numeric(5, 2) DEFAULT '10.00',
	"ca_referral_bonus_pct" numeric(5, 2) DEFAULT '5.00',
	"default_commission_strategy" varchar(50) DEFAULT 'standard_waterfall',
	"auto_approve_commissions_below" numeric(12, 2) DEFAULT '500.00',
	"is_ca_marketplace_active" boolean DEFAULT true,
	"enable_ai_alpha_recommendations" boolean DEFAULT true,
	"enforce_strict_suitability" boolean DEFAULT false,
	"iris_partner_code" varchar(50) DEFAULT 'FINTEKPRO',
	"alpaca_referrer_code" varchar(50) DEFAULT 'fintekpro_app',
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulatory_audit_packs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"pack_type" varchar NOT NULL,
	"transaction_id" varchar,
	"kyc_snapshot" jsonb NOT NULL,
	"suitability_snapshot" jsonb NOT NULL,
	"order_snapshot" jsonb,
	"platform_config_snapshot" jsonb,
	"audit_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_idempotency_keys" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"gateway" varchar NOT NULL,
	"response_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alpaca_accounts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alpaca_account_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"account_number" varchar,
	"currency" varchar DEFAULT 'USD',
	"crypto_status" varchar,
	"buying_power" numeric(15, 2),
	"cash" numeric(15, 2),
	"portfolio_value" numeric(15, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "alpaca_accounts_alpaca_account_id_unique" UNIQUE("alpaca_account_id")
);
--> statement-breakpoint
CREATE TABLE "alpaca_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alpaca_account_id" varchar NOT NULL,
	"provider_order_id" varchar NOT NULL,
	"client_order_id" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"qty" numeric(15, 4),
	"notional" numeric(15, 2),
	"side" varchar NOT NULL,
	"type" varchar NOT NULL,
	"time_in_force" varchar NOT NULL,
	"status" varchar NOT NULL,
	"filled_qty" numeric(15, 4),
	"filled_avg_price" numeric(15, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "alpaca_orders_provider_order_id_unique" UNIQUE("provider_order_id"),
	CONSTRAINT "alpaca_orders_client_order_id_unique" UNIQUE("client_order_id")
);
--> statement-breakpoint
CREATE TABLE "alpaca_positions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alpaca_account_id" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"qty" numeric(15, 4) NOT NULL,
	"avg_entry_price" numeric(15, 2) NOT NULL,
	"current_price" numeric(15, 2) NOT NULL,
	"market_value" numeric(15, 2) NOT NULL,
	"unrealized_pl" numeric(15, 2) NOT NULL,
	"unrealized_plpc" numeric(15, 4) NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alpaca_trade_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"alpaca_account_id" varchar NOT NULL,
	"symbol" varchar NOT NULL,
	"side" varchar NOT NULL,
	"quantity" numeric(15, 4),
	"notional" numeric(15, 2),
	"status" varchar NOT NULL,
	"provider_order_id" varchar,
	"commission" numeric(12, 2) DEFAULT '0.00',
	"error_message" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_subscriptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"plan_tier" varchar NOT NULL,
	"billing_cycle" varchar NOT NULL,
	"amount_paise" integer NOT NULL,
	"currency" varchar DEFAULT 'INR' NOT NULL,
	"cashfree_order_id" varchar,
	"cashfree_payment_id" varchar,
	"cashfree_payment_session_id" varchar,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"starts_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aadhaar_consent_artifacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"aadhaar_last4" varchar(4),
	"purpose" varchar(255) NOT NULL,
	"consent_text" text NOT NULL,
	"consent_given_at" timestamp DEFAULT now() NOT NULL,
	"otp_reference" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"session_id" varchar(100),
	"verification_outcome" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kyc_regulatory_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"service_provider" varchar NOT NULL,
	"api_endpoint" text NOT NULL,
	"request_type" varchar NOT NULL,
	"request_hash" text NOT NULL,
	"response_hash" text NOT NULL,
	"status" varchar NOT NULL,
	"latency_ms" integer,
	"trace_id" varchar NOT NULL,
	"regulatory_reference" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"provider_ref" varchar,
	"amount_requested" numeric(15, 2),
	"tenure_months" integer,
	"status" varchar NOT NULL,
	"provider_response" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"product_type" varchar NOT NULL,
	"name" varchar NOT NULL,
	"description" text,
	"interest_rate" numeric(5, 2),
	"max_tenure_months" integer,
	"min_loan_amount" numeric(15, 2),
	"max_loan_amount" numeric(15, 2),
	"eligibility_criteria" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credit_provider_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" varchar NOT NULL,
	"application_id" varchar,
	"action" varchar NOT NULL,
	"payload" jsonb,
	"response" jsonb,
	"status_code" integer,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "financial_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"net_worth" numeric(15, 2) DEFAULT '0',
	"total_assets" numeric(15, 2) DEFAULT '0',
	"total_liabilities" numeric(15, 2) DEFAULT '0',
	"credit_utilization" numeric(5, 2) DEFAULT '0',
	"internal_risk_score" integer,
	"last_calculated_at" timestamp DEFAULT now(),
	CONSTRAINT "financial_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "alpaca_commission_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_type" varchar NOT NULL,
	"asset_class" varchar NOT NULL,
	"commission_rate" numeric(10, 4) NOT NULL,
	"commission_type" varchar DEFAULT 'percentage',
	"min_commission" numeric(10, 2) DEFAULT '0.00',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alpaca_rebalancing_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"portfolio_id" varchar NOT NULL,
	"drift_threshold" numeric(5, 2) DEFAULT '5.00',
	"auto_rebalance" boolean DEFAULT false,
	"last_rebalanced_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ca_professional_verification" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"icai_membership_number" varchar NOT NULL,
	"icai_verified" boolean DEFAULT false,
	"icai_verified_at" timestamp,
	"icai_verified_by" varchar,
	"cop_number" varchar,
	"cop_valid_from" date,
	"cop_valid_to" date,
	"cop_verified" boolean DEFAULT false,
	"cop_verified_at" timestamp,
	"pan_number" varchar NOT NULL,
	"pan_verified" boolean DEFAULT false,
	"pan_verified_at" timestamp,
	"dsc_available" boolean DEFAULT false,
	"dsc_serial_number" varchar,
	"dsc_valid_from" date,
	"dsc_valid_to" date,
	"dsc_verified_at" timestamp,
	"overall_status" varchar DEFAULT 'pending',
	"can_sign_form_15cb" boolean DEFAULT false,
	"approved_at" timestamp,
	"approved_by" varchar,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ca_professional_verification_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "ai_governance_audit_logs" (
	"audit_id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"input_query" text NOT NULL,
	"ai_raw_output" jsonb NOT NULL,
	"final_output" jsonb NOT NULL,
	"decision" varchar(50) NOT NULL,
	"violations" jsonb DEFAULT '[]'::jsonb,
	"risk_flags" jsonb DEFAULT '[]'::jsonb,
	"model_version" varchar(100) NOT NULL,
	"trace_id" varchar(255),
	"partner_ria_id" varchar(255),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt_name" varchar(255) NOT NULL,
	"version" varchar(50) NOT NULL,
	"used_at" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar,
	"feature" varchar(255),
	"response_preview_hash" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "amse_model_registry" (
	"model_id" varchar(255) PRIMARY KEY NOT NULL,
	"type" varchar(50) NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avg_score" numeric DEFAULT '0',
	"latency_ms" integer DEFAULT 0,
	"cost_per_call" numeric DEFAULT '0',
	"compliance_score" numeric DEFAULT '100',
	"specialization_weights" jsonb DEFAULT '{}'::jsonb,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "amse_selection_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"query_id" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"selected_model" varchar(255) NOT NULL,
	"alternative_models" jsonb DEFAULT '[]'::jsonb,
	"selection_score" numeric NOT NULL,
	"selection_reason" text NOT NULL,
	"fallback_triggered" boolean DEFAULT false,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "apre_audit_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"portfolio_id" varchar(255) NOT NULL,
	"trigger_type" varchar(50) NOT NULL,
	"generated_plan" jsonb NOT NULL,
	"simulation_summary" jsonb NOT NULL,
	"governance_decision" varchar(50) NOT NULL,
	"approval_status" varchar(50) DEFAULT 'pending',
	"execution_status" varchar(50) DEFAULT 'not_started',
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "apse_simulation_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recommendation_id" varchar(255) NOT NULL,
	"execution_time_ms" integer NOT NULL,
	"input_portfolio_map" jsonb NOT NULL,
	"assumptions_vectors" jsonb NOT NULL,
	"output_distributions" jsonb NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ar_model_metrics" (
	"model_version" varchar(100) PRIMARY KEY NOT NULL,
	"average_score" numeric NOT NULL,
	"consistency_score" numeric NOT NULL,
	"total_evaluations" integer DEFAULT 0 NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ar_outcomes" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recommendation_id" varchar(255) NOT NULL,
	"entry_price" numeric,
	"current_price" numeric,
	"holding_period_days" integer,
	"volatility" numeric,
	"actual_outcome_data" jsonb NOT NULL,
	"recorded_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ar_recommendations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"asset" varchar(255) NOT NULL,
	"type" varchar(50) NOT NULL,
	"expected_outcome" jsonb NOT NULL,
	"model_version" varchar(100),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ar_scores" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"recommendation_id" varchar(255) NOT NULL,
	"accuracy_score" numeric,
	"risk_alignment_score" numeric,
	"outcome_quality_score" numeric,
	"time_horizon_score" numeric,
	"compliance_score" numeric,
	"total_score" numeric NOT NULL,
	"evaluated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fail_system_state" (
	"config_key" varchar(255) PRIMARY KEY NOT NULL,
	"is_globally_disabled" boolean DEFAULT false NOT NULL,
	"last_trigger_reason" text,
	"triggered_at" timestamp,
	"status_override" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "urcae_allocation_logs" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"model_used" varchar(150) NOT NULL,
	"inputs_detected" jsonb NOT NULL,
	"active_constraints" jsonb NOT NULL,
	"final_weights_vector" jsonb NOT NULL,
	"optimistic_fallback_triggered" boolean DEFAULT false,
	"partner_ria_id" varchar(255),
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pre_ipo_market_insights" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "pre_ipo_analytics" CASCADE;--> statement-breakpoint
DROP TABLE "pre_ipo_investments" CASCADE;--> statement-breakpoint
DROP TABLE "pre_ipo_market_insights" CASCADE;--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP CONSTRAINT "ca_verification_status_user_id_unique";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP CONSTRAINT "esign_requests_transaction_id_unique";--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_slug_unique";--> statement-breakpoint
ALTER TABLE "advisory_sessions" DROP CONSTRAINT "advisory_sessions_proposal_id_investment_proposals_id_fk";
--> statement-breakpoint
ALTER TABLE "ai_talking_points" DROP CONSTRAINT "ai_talking_points_profit_pick_id_ai_profit_picks_id_fk";
--> statement-breakpoint
ALTER TABLE "amfi_verification_log" DROP CONSTRAINT "amfi_verification_log_verified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP CONSTRAINT "ca_verification_status_icai_verified_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP CONSTRAINT "ca_verification_status_approved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" DROP CONSTRAINT "compliance_audit_trail_created_by_agent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP CONSTRAINT "esign_certificates_created_by_agent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP CONSTRAINT "global_advisory_acknowledgments_market_code_markets_master_market_code_fk";
--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP CONSTRAINT "global_advisory_recommendations_instrument_id_global_instruments_id_fk";
--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" DROP CONSTRAINT "goal_benchmark_mapping_overridden_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "master_dsa_claims" DROP CONSTRAINT "master_dsa_claims_lead_id_lead_registry_lead_id_fk";
--> statement-breakpoint
ALTER TABLE "payout_claims" DROP CONSTRAINT "payout_claims_lead_id_lead_registry_lead_id_fk";
--> statement-breakpoint
ALTER TABLE "pms_master" DROP CONSTRAINT "pms_master_manager_id_fund_managers_id_fk";
--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP CONSTRAINT "product_account_preferences_created_by_agent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP CONSTRAINT "product_account_preferences_bank_account_id_user_bank_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP CONSTRAINT "product_account_preferences_demat_account_id_user_demat_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "product_applications" DROP CONSTRAINT "product_applications_created_by_agent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "product_applications" DROP CONSTRAINT "product_applications_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "product_applications" DROP CONSTRAINT "product_applications_reviewed_by_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP CONSTRAINT "referral_payout_config_provider_id_loan_providers_id_fk";
--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP CONSTRAINT "referral_payout_config_product_id_loan_products_id_fk";
--> statement-breakpoint
ALTER TABLE "tax_sessions" DROP CONSTRAINT "tax_sessions_created_by_agent_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "us_orders" DROP CONSTRAINT "us_orders_broker_account_id_us_broker_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "idx_ca_verification_user";--> statement-breakpoint
DROP INDEX "idx_ca_verification_icai";--> statement-breakpoint
DROP INDEX "idx_ca_verification_status";--> statement-breakpoint
DROP INDEX "idx_campaign_recipient_campaign";--> statement-breakpoint
DROP INDEX "idx_campaign_recipient_user";--> statement-breakpoint
DROP INDEX "idx_campaign_recipient_status";--> statement-breakpoint
DROP INDEX "idx_esign_audit_transaction";--> statement-breakpoint
DROP INDEX "idx_esign_audit_user";--> statement-breakpoint
DROP INDEX "idx_esign_audit_action";--> statement-breakpoint
DROP INDEX "idx_esign_certificates_user";--> statement-breakpoint
DROP INDEX "idx_esign_certificates_transaction";--> statement-breakpoint
DROP INDEX "idx_esign_certificates_serial";--> statement-breakpoint
DROP INDEX "idx_esign_certificates_status";--> statement-breakpoint
DROP INDEX "idx_esign_certificates_provider";--> statement-breakpoint
DROP INDEX "idx_esign_requests_user";--> statement-breakpoint
DROP INDEX "idx_esign_requests_transaction";--> statement-breakpoint
DROP INDEX "idx_esign_requests_status";--> statement-breakpoint
DROP INDEX "idx_esign_requests_provider";--> statement-breakpoint
DROP INDEX "idx_fund_ratios_scheme_code";--> statement-breakpoint
DROP INDEX "idx_fund_ratios_category";--> statement-breakpoint
DROP INDEX "idx_fund_ratios_fund_house";--> statement-breakpoint
DROP INDEX "idx_fund_ratios_ai_signal";--> statement-breakpoint
DROP INDEX "idx_gaa_user";--> statement-breakpoint
DROP INDEX "idx_gaa_market";--> statement-breakpoint
DROP INDEX "idx_gaa_type";--> statement-breakpoint
DROP INDEX "idx_gaa_acknowledged";--> statement-breakpoint
DROP INDEX "idx_gaal_user";--> statement-breakpoint
DROP INDEX "idx_gaal_event";--> statement-breakpoint
DROP INDEX "idx_gaal_market";--> statement-breakpoint
DROP INDEX "idx_gaal_timestamp";--> statement-breakpoint
DROP INDEX "idx_gar_user";--> statement-breakpoint
DROP INDEX "idx_gar_symbol";--> statement-breakpoint
DROP INDEX "idx_gar_asset_class";--> statement-breakpoint
DROP INDEX "idx_gar_market";--> statement-breakpoint
DROP INDEX "idx_gar_recommendation";--> statement-breakpoint
DROP INDEX "idx_gar_created";--> statement-breakpoint
DROP INDEX "idx_goal_investment_links_goal";--> statement-breakpoint
DROP INDEX "idx_goal_investment_links_user";--> statement-breakpoint
DROP INDEX "idx_goal_investment_links_type";--> statement-breakpoint
DROP INDEX "idx_goal_progress_snapshots_goal";--> statement-breakpoint
DROP INDEX "idx_goal_progress_snapshots_date";--> statement-breakpoint
DROP INDEX "idx_historical_nav_lookup";--> statement-breakpoint
DROP INDEX "idx_instrument_master_isin";--> statement-breakpoint
DROP INDEX "idx_instrument_master_name";--> statement-breakpoint
DROP INDEX "idx_instrument_master_asset_class";--> statement-breakpoint
DROP INDEX "idx_instrument_master_symbol";--> statement-breakpoint
DROP INDEX "idx_instrument_master_prefix";--> statement-breakpoint
DROP INDEX "idx_instrument_master_regulator";--> statement-breakpoint
DROP INDEX "idx_instrument_master_issuer_type";--> statement-breakpoint
DROP INDEX "idx_instrument_master_region";--> statement-breakpoint
DROP INDEX "idx_instrument_master_country";--> statement-breakpoint
DROP INDEX "idx_instrument_master_exchange";--> statement-breakpoint
DROP INDEX "idx_kyc_consent_user";--> statement-breakpoint
DROP INDEX "idx_kyc_consent_type";--> statement-breakpoint
DROP INDEX "idx_kyc_consent_given";--> statement-breakpoint
DROP INDEX "idx_kyc_reuse_token_id";--> statement-breakpoint
DROP INDEX "idx_kyc_reuse_user";--> statement-breakpoint
DROP INDEX "idx_kyc_reuse_active";--> statement-breakpoint
DROP INDEX "idx_master_dsa_claims_lead";--> statement-breakpoint
DROP INDEX "idx_mf_order_audit_order";--> statement-breakpoint
DROP INDEX "idx_mf_order_audit_actor";--> statement-breakpoint
DROP INDEX "idx_mf_order_audit_action";--> statement-breakpoint
DROP INDEX "idx_report_access_logs_user_id";--> statement-breakpoint
DROP INDEX "idx_report_access_logs_accessed_at";--> statement-breakpoint
DROP INDEX "idx_suitability_checks_passed";--> statement-breakpoint
DROP INDEX "idx_pms_master_status";--> statement-breakpoint
ALTER TABLE "ca_verification_status" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ALTER COLUMN "old_value" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ALTER COLUMN "new_value" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ALTER COLUMN "performed_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ALTER COLUMN "status" SET DEFAULT 'valid';--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ALTER COLUMN "sharpe_ratio" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ALTER COLUMN "sortino_ratio" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ALTER COLUMN "alpha" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ALTER COLUMN "beta" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ALTER COLUMN "standard_deviation" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ALTER COLUMN "acknowledgment_type" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ALTER COLUMN "acknowledged_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ALTER COLUMN "ip_address" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ALTER COLUMN "session_id" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ALTER COLUMN "ip_address" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ALTER COLUMN "confidence_score" SET DATA TYPE numeric(3, 2);--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ALTER COLUMN "horizon_years_min" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ALTER COLUMN "horizon_years_min" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ALTER COLUMN "horizon_years_max" SET DEFAULT 99;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ALTER COLUMN "benchmark_code" SET DATA TYPE varchar;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ALTER COLUMN "benchmark_code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ALTER COLUMN "benchmark_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ALTER COLUMN "snapshot_date" SET DATA TYPE date;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ALTER COLUMN "snapshot_date" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ALTER COLUMN "snapshot_date" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ALTER COLUMN "target_amount" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ALTER COLUMN "on_track_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instrument_master" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "instrument_master" ALTER COLUMN "updated_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ALTER COLUMN "consent_given" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ALTER COLUMN "consent_given" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ALTER COLUMN "consent_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ALTER COLUMN "purpose" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "master_dsa_claims" ALTER COLUMN "outstanding_amount" SET DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE "master_dsa_claims" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ALTER COLUMN "purchase_date" SET DATA TYPE timestamp;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ALTER COLUMN "source" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ALTER COLUMN "source" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_applications" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_applications" ALTER COLUMN "application_data" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "product_applications" ALTER COLUMN "application_data" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_applications" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "referral_payout_config" ALTER COLUMN "payout_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "tax_sessions" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "annual_income" SET DATA TYPE numeric(15, 2);--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "video_kyc_status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "kyc_tier" SET DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "user_profiles" ALTER COLUMN "accredited_investor_status" SET DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "yield_tracker" ALTER COLUMN "strategy_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "yield_tracker" ALTER COLUMN "strategy_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "yield_tracker" ALTER COLUMN "start_date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_notifications" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "ca_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "verification_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "status" varchar DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "document_id" varchar;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "certificate_number" varchar;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "issue_date" date;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "expiry_date" date;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "verified_networth" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "verified_income" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "financial_year" varchar;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "udin" varchar;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "udin_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "udin_verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD COLUMN "last_synced_at" timestamp;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "error_code" varchar;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD COLUMN "external_message_id" varchar;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD COLUMN "entity_id" varchar;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD COLUMN "entity_type" varchar;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD COLUMN "timestamp" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "currency" varchar(10) DEFAULT 'INR';--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "is_adr" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "exchange_mic" varchar(20);--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "last_enriched_at" timestamp;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD COLUMN "enrichment_source" varchar(50);--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "signed_document_url" text;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "certificate_serial" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "signer_aadhaar_masked" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "signed_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "valid_from" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "valid_to" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "signature_algorithm" varchar DEFAULT 'SHA256withRSA';--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "revoked_reason" text;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_certificate_class" varchar;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_certificate_type" varchar;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_issuer" text;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_subject_dn" text;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_timestamp_authority" text;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_timestamp" timestamp;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_ocsp_status" varchar;--> statement-breakpoint
ALTER TABLE "esign_requests" ADD COLUMN "dsc_crl_status" varchar;--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ADD COLUMN "pe_ratio" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ADD COLUMN "pb_ratio" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ADD COLUMN "portfolio_turnover" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" ADD COLUMN "avg_market_cap" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ADD COLUMN "acknowledgment_text" text NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD COLUMN "action" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD COLUMN "actor_id" varchar;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD COLUMN "actor_role" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD COLUMN "timestamp" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD COLUMN "recommendation_type" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD COLUMN "product_category" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD COLUMN "product_id" varchar;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" ADD COLUMN "status" varchar DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ADD COLUMN "benchmark_index" varchar;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ADD COLUMN "is_active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "goal_benchmark_mapping" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ADD COLUMN "user_id" varchar;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ADD COLUMN "progress_percent" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ADD COLUMN "monthly_contribution" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "partner_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "data_shared" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "consent_timestamp" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "is_revoked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD COLUMN "session_outcome" varchar;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ADD COLUMN "form15ca_filed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" ADD COLUMN "form15cb_obtained" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD COLUMN "form15ca_number" varchar(50);--> statement-breakpoint
ALTER TABLE "lrs_transactions" ADD COLUMN "form15cb_number" varchar(50);--> statement-breakpoint
ALTER TABLE "market_data_cache" ADD COLUMN "market_cap" numeric;--> statement-breakpoint
ALTER TABLE "market_data_cache" ADD COLUMN "beta" numeric;--> statement-breakpoint
ALTER TABLE "market_data_cache" ADD COLUMN "dividend_yield" numeric;--> statement-breakpoint
ALTER TABLE "market_data_cache" ADD COLUMN "pe_ratio" numeric;--> statement-breakpoint
ALTER TABLE "mca_financial_snapshot" ADD COLUMN "data_completeness" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" ADD COLUMN "old_status" varchar;--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" ADD COLUMN "remarks" text;--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "kfintech_id" varchar(100);--> statement-breakpoint
ALTER TABLE "mutual_funds" ADD COLUMN "folio_nature" varchar(50);--> statement-breakpoint
ALTER TABLE "nri_kyc_progress" ADD COLUMN "tax_residency_country" varchar;--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "amc_name" text;--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "market_cap_bias" text;--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "nav_frequency" text DEFAULT 'MONTHLY';--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "suitability_score" integer;--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "ai_recommendation" text;--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "isin" text;--> statement-breakpoint
ALTER TABLE "pms_master" ADD COLUMN "apmi_id" text;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD COLUMN "return_percentage" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "product_category" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "product_sub_category" varchar;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "preferred_bank_account_id" varchar;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "preferred_demat_account_id" varchar;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "distribution_mode" varchar DEFAULT 'physical';--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "enable_notifications" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD COLUMN "preferred_contact_method" varchar DEFAULT 'email';--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "application_number" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "submission_date" timestamp;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "suitability_score" integer;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "ai_recommendation" text;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "kyc_verified" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "esign_status" varchar DEFAULT 'not_started';--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "esign_request_ids" text[];--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "payment_status" varchar DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "payment_amount" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "payment_reference" varchar;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "required_documents" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "product_applications" ADD COLUMN "uploaded_documents" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "referral_payout_config" ADD COLUMN "product_type" varchar;--> statement-breakpoint
ALTER TABLE "referral_payout_config" ADD COLUMN "payout_rate" numeric(5, 4);--> statement-breakpoint
ALTER TABLE "suitability_checks" ADD COLUMN "last_assessed_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" ADD COLUMN "cashfree_subscription_id" varchar;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "from_date" timestamp;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "to_date" timestamp;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "transaction_count" integer;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "total_inflow" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "total_outflow" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "net_cash_flow" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "average_monthly_income" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "average_monthly_expense" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "spending_patterns" jsonb;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "income_patterns" jsonb;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "timing_patterns" jsonb;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "frequency_patterns" jsonb;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "risk_factors" jsonb;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "risk_score" integer;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "risk_category" varchar;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "creditworthiness_score" integer;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "disposable_income" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "investment_capacity" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "emergency_fund_status" varchar;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "debt_to_income_ratio" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "ai_model_version" varchar;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "analysis_confidence" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD COLUMN "next_analysis_date" timestamp;--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD COLUMN "stamp_duty" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD COLUMN "fmv_at_transaction" numeric(20, 2);--> statement-breakpoint
ALTER TABLE "unlisted_deals" ADD COLUMN "valuation_deviation" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "unlisted_regulatory_audit_log" ADD COLUMN "forensic_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "unlisted_regulatory_audit_log" ADD COLUMN "prev_hash" varchar(64);--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "alpaca_account_number" varchar;--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "alpaca_status" varchar DEFAULT 'not_applied';--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "action_required" text;--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "application_step" varchar DEFAULT 'identity';--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "application_data" text;--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "agreements_signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "cip_submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "us_broker_accounts" ADD COLUMN "account_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "minor_identity" jsonb;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "net_worth" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "liquid_net_worth" numeric(15, 2);--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "liquidity_needs" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "investment_risk_tolerance" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "investment_time_horizon" varchar;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "number_of_dependents" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_tier" varchar DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cashfree_subscription_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "kyc_status" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ckyc_status" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "iris_investor_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alpaca_account_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "alpaca_account_type" varchar DEFAULT 'individual';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "referral_code" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "shareable_profile_enabled" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD COLUMN "suggested_action" text;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD COLUMN "is_resolved" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "portfolio_id" varchar;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "investment_id" varchar;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "symbol" varchar;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "instrument_type" varchar DEFAULT 'equity';--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "initial_investment" numeric(15, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "units_held" numeric(15, 6);--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "average_purchase_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "current_price" numeric(15, 4);--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "total_dividends" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "total_interest" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "total_charges" numeric(15, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "target_yield" numeric(6, 4);--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "benchmark" varchar DEFAULT 'NIFTY50';--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "risk_profile" varchar DEFAULT 'moderate';--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "price_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "performance_history" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD COLUMN "purchase_date" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "admin_approval_requests" ADD CONSTRAINT "admin_approval_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_approval_requests" ADD CONSTRAINT "admin_approval_requests_checker_id_users_id_fk" FOREIGN KEY ("checker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lrs_remittance_logs" ADD CONSTRAINT "lrs_remittance_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulatory_audit_packs" ADD CONSTRAINT "regulatory_audit_packs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_idempotency_keys" ADD CONSTRAINT "payment_idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpaca_accounts" ADD CONSTRAINT "alpaca_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpaca_orders" ADD CONSTRAINT "alpaca_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpaca_positions" ADD CONSTRAINT "alpaca_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alpaca_trade_logs" ADD CONSTRAINT "alpaca_trade_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_subscriptions" ADD CONSTRAINT "platform_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aadhaar_consent_artifacts" ADD CONSTRAINT "aadhaar_consent_artifacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_regulatory_audit_logs" ADD CONSTRAINT "kyc_regulatory_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_applications" ADD CONSTRAINT "credit_applications_product_id_credit_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."credit_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_provider_logs" ADD CONSTRAINT "credit_provider_logs_application_id_credit_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."credit_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_profiles" ADD CONSTRAINT "financial_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_professional_verification" ADD CONSTRAINT "ca_professional_verification_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_professional_verification" ADD CONSTRAINT "ca_professional_verification_icai_verified_by_users_id_fk" FOREIGN KEY ("icai_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_professional_verification" ADD CONSTRAINT "ca_professional_verification_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amse_selection_logs" ADD CONSTRAINT "amse_selection_logs_selected_model_amse_model_registry_model_id_fk" FOREIGN KEY ("selected_model") REFERENCES "public"."amse_model_registry"("model_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_outcomes" ADD CONSTRAINT "ar_outcomes_recommendation_id_ar_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ar_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ar_scores" ADD CONSTRAINT "ar_scores_recommendation_id_ar_recommendations_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ar_recommendations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_amfi_distributors_arn" ON "amfi_distributors" USING btree ("arn_code");--> statement-breakpoint
CREATE INDEX "idx_amfi_distributors_euin" ON "amfi_distributors" USING btree ("euin_number");--> statement-breakpoint
CREATE INDEX "idx_amfi_distributors_status" ON "amfi_distributors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_icai" ON "fintekpro_ca_registry" USING btree ("icai_membership_number");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_partner" ON "fintekpro_ca_registry" USING btree ("partners_table_id");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_user" ON "fintekpro_ca_registry" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_city_state" ON "fintekpro_ca_registry" USING btree ("city","state");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_tier" ON "fintekpro_ca_registry" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_revalidation" ON "fintekpro_ca_registry" USING btree ("next_revalidation_due");--> statement-breakpoint
CREATE INDEX "idx_ca_registry_referral" ON "fintekpro_ca_registry" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "idx_lrs_logs_user_fy" ON "lrs_remittance_logs" USING btree ("user_id","financial_year");--> statement-breakpoint
CREATE INDEX "idx_lrs_logs_transfer" ON "lrs_remittance_logs" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "idx_audit_pack_user" ON "regulatory_audit_packs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_pack_type" ON "regulatory_audit_packs" USING btree ("pack_type");--> statement-breakpoint
CREATE INDEX "idx_audit_pack_tx" ON "regulatory_audit_packs" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_payment_idempotency_scope" ON "payment_idempotency_keys" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_payment_idempotency_expires" ON "payment_idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_aadhaar_consent_user" ON "aadhaar_consent_artifacts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aadhaar_consent_date" ON "aadhaar_consent_artifacts" USING btree ("consent_given_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_user" ON "kyc_regulatory_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_provider" ON "kyc_regulatory_audit_logs" USING btree ("service_provider");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_created_at" ON "kyc_regulatory_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ca_prof_verification_user" ON "ca_professional_verification" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ca_prof_verification_icai" ON "ca_professional_verification" USING btree ("icai_membership_number");--> statement-breakpoint
CREATE INDEX "idx_ca_prof_verification_status" ON "ca_professional_verification" USING btree ("overall_status");--> statement-breakpoint
CREATE INDEX "idx_ai_prompt_versions_name" ON "ai_prompt_versions" USING btree ("prompt_name");--> statement-breakpoint
CREATE INDEX "idx_ai_prompt_versions_used_at" ON "ai_prompt_versions" USING btree ("used_at");--> statement-breakpoint
CREATE INDEX "idx_ai_prompt_versions_user_id" ON "ai_prompt_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_amse_model_type" ON "amse_model_registry" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_amse_model_status" ON "amse_model_registry" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_amse_selection_query" ON "amse_selection_logs" USING btree ("query_id");--> statement-breakpoint
CREATE INDEX "idx_amse_selection_model" ON "amse_selection_logs" USING btree ("selected_model");--> statement-breakpoint
CREATE INDEX "idx_apre_portfolio" ON "apre_audit_logs" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_apse_sim_rec_id" ON "apse_simulation_logs" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "idx_ar_outcomes_rec" ON "ar_outcomes" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "idx_ar_recommendations_user" ON "ar_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ar_recommendations_asset" ON "ar_recommendations" USING btree ("asset");--> statement-breakpoint
CREATE INDEX "idx_ar_scores_rec" ON "ar_scores" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "idx_ar_scores_total" ON "ar_scores" USING btree ("total_score");--> statement-breakpoint
CREATE INDEX "idx_urcae_user" ON "urcae_allocation_logs" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "ca_verification_status" ADD CONSTRAINT "ca_verification_status_ca_id_users_id_fk" FOREIGN KEY ("ca_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" ADD CONSTRAINT "global_advisory_acknowledgments_session_id_advisory_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."advisory_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" ADD CONSTRAINT "global_advisory_audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" ADD CONSTRAINT "goal_progress_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_recipient_campaign" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_user" ON "campaign_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_recipient_status" ON "campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_comprehensive_holdings_unique" ON "comprehensive_holdings" USING btree ("user_id","isin","folio");--> statement-breakpoint
CREATE INDEX "idx_comprehensive_holdings_user_date" ON "comprehensive_holdings" USING btree ("user_id","holding_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_daily_picks_unique_reco" ON "daily_picks" USING btree ("category","reco_date","instrument_id","symbol");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_user" ON "esign_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_transaction" ON "esign_requests" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_serial" ON "esign_requests" USING btree ("certificate_serial");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_status" ON "esign_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_esign_certificates_provider" ON "esign_requests" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_fin_cache_type_symbol_exchange" ON "financial_instruments_cache" USING btree ("instrument_type","symbol","exchange");--> statement-breakpoint
CREATE INDEX "idx_fund_ratios_scheme" ON "fund_financial_ratios" USING btree ("scheme_code");--> statement-breakpoint
CREATE INDEX "idx_global_advisory_ack_user" ON "global_advisory_acknowledgments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_global_advisory_audit_user" ON "global_advisory_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_global_advisory_audit_action" ON "global_advisory_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_global_advisory_rec_user" ON "global_advisory_recommendations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goal_invest_goal" ON "goal_investment_links" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_goal_invest_user" ON "goal_investment_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_goal_progress_goal" ON "goal_progress_snapshots" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_goal_progress_date" ON "goal_progress_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_historical_nav_unique" ON "historical_nav_data" USING btree ("identifier","identifier_type","date");--> statement-breakpoint
CREATE INDEX "idx_kyc_consent_user_partner" ON "kyc_consent_logs" USING btree ("user_id","partner_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_consent_prospect" ON "kyc_consent_logs" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "idx_product_apps_user" ON "product_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_product_apps_product" ON "product_applications" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_product_apps_status" ON "product_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_user" ON "report_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_type" ON "report_access_logs" USING btree ("access_type");--> statement-breakpoint
CREATE INDEX "idx_pms_master_status" ON "pms_master" USING btree ("status");--> statement-breakpoint
ALTER TABLE "ai_talking_points" DROP COLUMN "profit_pick_id";--> statement-breakpoint
ALTER TABLE "amfi_verification_log" DROP COLUMN "registration_date";--> statement-breakpoint
ALTER TABLE "amfi_verification_log" DROP COLUMN "verified_by";--> statement-breakpoint
ALTER TABLE "amfi_verification_log" DROP COLUMN "ip_address";--> statement-breakpoint
ALTER TABLE "amfi_verification_log" DROP COLUMN "user_agent";--> statement-breakpoint
ALTER TABLE "apy_accounts" DROP COLUMN "remarks";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "icai_membership_number";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "icai_verified";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "icai_verified_at";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "icai_verified_by";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "cop_number";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "cop_valid_from";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "cop_valid_to";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "cop_verified";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "cop_verified_at";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "pan_number";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "pan_verified";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "pan_verified_at";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "dsc_available";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "dsc_serial_number";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "dsc_valid_from";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "dsc_valid_to";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "dsc_verified_at";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "overall_status";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "can_sign_form_15cb";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "approved_at";--> statement-breakpoint
ALTER TABLE "ca_verification_status" DROP COLUMN "approved_by";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "mobile";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "full_name";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "sent_at";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "unsubscribed_at";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "converted";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "converted_at";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "conversion_value";--> statement-breakpoint
ALTER TABLE "campaign_recipients" DROP COLUMN "retry_count";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "fatca_reason_code";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "pep_status";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "pep_related_person_status";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "pep_details";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "risk_category";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "resident_status";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "country_of_residence";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "country_of_citizenship";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "aml_status";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "aml_last_checked";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "sanction_list_status";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "sanction_list_last_checked";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "cdd_level";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "edd_required";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "edd_completed_date";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "compliance_score";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "last_compliance_review";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "next_compliance_review";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "profile_completeness";--> statement-breakpoint
ALTER TABLE "ckyc_records" DROP COLUMN "last_updated";--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" DROP COLUMN "prospect_id";--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" DROP COLUMN "created_by_agent_id";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "prospect_id";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "created_by_agent_id";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_certificate_class";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_certificate_type";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_issuer";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_subject_dn";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_certificate_fingerprint";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_timestamp_authority";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_timestamp";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_ocsp_status";--> statement-breakpoint
ALTER TABLE "esign_certificates" DROP COLUMN "dsc_crl_status";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "document_url";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "aadhaar_masked";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "error_message";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "otp_sent_at";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "certificate_id";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "api_response";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "dsc_token_info";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "dsc_signing_method";--> statement-breakpoint
ALTER TABLE "esign_requests" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "scheme_name";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "fund_house";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "portfolio_pe";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "portfolio_pb";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "category_avg_pe";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "category_avg_pb";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "pe_vs_category";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "avg_roe";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "avg_roce";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "upside_capture_ratio";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "downside_capture_ratio";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "cagr_1y";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "cagr_3y";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "cagr_5y";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "category_cagr_1y";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "category_cagr_3y";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "cagr_vs_category";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "current_aum";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "aum_6_months_ago";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "aum_1_year_ago";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "aum_growth_yoy";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "expense_ratio";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "exit_load_percent";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "exit_load_days";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "exit_load_description";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "purchase_allowed";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "sip_allowed";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "redemption_allowed";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "scheme_status";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "fintekpro_rating";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "category_percentile";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "ai_signal";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "ai_confidence";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "ai_rationale";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "current_nav";--> statement-breakpoint
ALTER TABLE "fund_financial_ratios" DROP COLUMN "nav_date";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "market_code";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "disclaimer_version";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "disclaimer_text";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "is_revoked";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "revoked_at";--> statement-breakpoint
ALTER TABLE "global_advisory_acknowledgments" DROP COLUMN "revoked_reason";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "event_type";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "event_sub_type";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "market_code";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "product_category";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "event_data";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "ai_rationale";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "request_path";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "advisory_classification";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "disclaimer_shown";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "event_timestamp";--> statement-breakpoint
ALTER TABLE "global_advisory_audit_log" DROP COLUMN "checksum_hash";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "instrument_id";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "symbol";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "instrument_name";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "asset_class";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "market";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "exchange";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "recommendation";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "fintekpro_rating";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "risk_score";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "current_price";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "current_price_inr";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "target_price";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "target_price_inr";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "stop_loss";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "expected_return";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "time_horizon";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "time_horizon_days";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "fundamentals";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "technicals";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "sector_analysis";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "rationale";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "key_factors";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "risk_factors";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "tax_implications";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "lrs_considerations";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "suitability_score";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "alternative_options";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "is_personalized";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "generated_by";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "expires_at";--> statement-breakpoint
ALTER TABLE "global_advisory_recommendations" DROP COLUMN "view_count";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "current_value";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "sip_amount";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "sip_frequency";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "sip_start_date";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "sip_end_date";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "total_invested";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "absolute_returns";--> statement-breakpoint
ALTER TABLE "goal_investment_links" DROP COLUMN "xirr";--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" DROP COLUMN "progress_percentage";--> statement-breakpoint
ALTER TABLE "goal_progress_snapshots" DROP COLUMN "investments_value";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "source_table";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "source_id";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "is_edge_case_instrument";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "validation_status";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "validation_notes";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "first_seen_at";--> statement-breakpoint
ALTER TABLE "instrument_master" DROP COLUMN "last_verified_at";--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" DROP COLUMN "third_party_name";--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" DROP COLUMN "consented_at";--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" DROP COLUMN "usage_count";--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" DROP COLUMN "max_usage_limit";--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" DROP COLUMN "last_used_at";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "total_conversions";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "total_disbursements";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "total_disbursed_amount";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "avg_processing_days";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "last_performance_review";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "specializations";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "certifications";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "lender_staff" DROP COLUMN "updated_at";--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" DROP COLUMN "form_15ca_filed";--> statement-breakpoint
ALTER TABLE "lrs_compliance_tracking" DROP COLUMN "form_15cb_obtained";--> statement-breakpoint
ALTER TABLE "lrs_transactions" DROP COLUMN "form_15ca_number";--> statement-breakpoint
ALTER TABLE "lrs_transactions" DROP COLUMN "form_15cb_number";--> statement-breakpoint
ALTER TABLE "master_dsa_claims" DROP COLUMN "email_subject";--> statement-breakpoint
ALTER TABLE "master_dsa_claims" DROP COLUMN "email_body";--> statement-breakpoint
ALTER TABLE "master_dsa_claims" DROP COLUMN "master_dsa_email";--> statement-breakpoint
ALTER TABLE "master_dsa_claims" DROP COLUMN "master_dsa_name";--> statement-breakpoint
ALTER TABLE "master_dsa_claims" DROP COLUMN "created_by_admin_id";--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" DROP COLUMN "previous_status";--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" DROP COLUMN "details";--> statement-breakpoint
ALTER TABLE "mf_order_audit_log" DROP COLUMN "notes";--> statement-breakpoint
ALTER TABLE "nri_kyc_progress" DROP COLUMN "step4_tax_residency_country";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "fund_house_name";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "sponsor";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "lock_in";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "fee_structure";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "management_fee";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "performance_fee";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "fund_status";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "alpha";--> statement-breakpoint
ALTER TABLE "pms_master" DROP COLUMN "beta";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "broker";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "market_cap";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "beta";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "dividend_yield";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "pe_ratio";--> statement-breakpoint
ALTER TABLE "portfolio_holdings" DROP COLUMN "confidence_score";--> statement-breakpoint
ALTER TABLE "portfolios" DROP COLUMN "source_file_name";--> statement-breakpoint
ALTER TABLE "portfolios" DROP COLUMN "last_fetch_status";--> statement-breakpoint
ALTER TABLE "portfolios" DROP COLUMN "last_fetch_error";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "total_investment_slots";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "available_slots";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "logo_url";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "documents";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "last_updated";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "broad_sector";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "company_pan";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "enrichment_status";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "last_enriched_at";--> statement-breakpoint
ALTER TABLE "pre_ipo_companies" DROP COLUMN "enrichment_source";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "prospect_id";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "created_by_agent_id";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "product_type";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "bank_account_id";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "demat_account_id";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "product_account_preferences" DROP COLUMN "is_default";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "prospect_id";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "created_by_agent_id";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "partner_id";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "documents";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "review_notes";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "reviewed_by";--> statement-breakpoint
ALTER TABLE "product_applications" DROP COLUMN "reviewed_at";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "priority";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "image_url";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "last_performance_update";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "data_source";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "provider_id";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "product_id";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "agent_id";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "partner_id";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "payout_base";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "agent_payout_rate";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "partner_payout_rate";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "tiered_payouts";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "level1_override_rate";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "level2_override_rate";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "level3_override_rate";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "monthly_target_bonus";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "quarterly_target_bonus";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "annual_target_bonus";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "effective_from";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "effective_to";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "approved_by";--> statement-breakpoint
ALTER TABLE "referral_payout_config" DROP COLUMN "approval_date";--> statement-breakpoint
ALTER TABLE "suitability_checks" DROP COLUMN "regulatory_compliance_check";--> statement-breakpoint
ALTER TABLE "suitability_checks" DROP COLUMN "red_flags";--> statement-breakpoint
ALTER TABLE "suitability_checks" DROP COLUMN "warnings_generated";--> statement-breakpoint
ALTER TABLE "suitability_checks" DROP COLUMN "engine_version";--> statement-breakpoint
ALTER TABLE "suitability_checks" DROP COLUMN "processing_time_ms";--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" DROP COLUMN "stripe_subscription_id";--> statement-breakpoint
ALTER TABLE "tax_sessions" DROP COLUMN "prospect_id";--> statement-breakpoint
ALTER TABLE "tax_sessions" DROP COLUMN "created_by_agent_id";--> statement-breakpoint
ALTER TABLE "tax_sessions" DROP COLUMN "pan_number";--> statement-breakpoint
ALTER TABLE "user_demat_accounts" DROP COLUMN "is_verified";--> statement-breakpoint
ALTER TABLE "user_demat_accounts" DROP COLUMN "verification_status";--> statement-breakpoint
ALTER TABLE "user_demat_accounts" DROP COLUMN "verification_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "cdd_level";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "edd_required";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "edd_reason";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "edd_completed_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "edd_next_review_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "edd_completed_by";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "source_of_funds";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "source_of_wealth_documentation";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "source_of_wealth_verified";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "source_of_wealth_verification_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "risk_category";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "risk_category_reason";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "risk_last_assessed";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "risk_next_review";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "risk_review_frequency";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "is_high_risk_customer";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "compliance_score";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "last_compliance_review";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "next_compliance_review";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "compliance_officer";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "is_us_person";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "is_eu_resident";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "gdpr_consent";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "gdpr_consent_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "data_processing_consent";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "marketing_consent";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "investor_type";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "investor_category";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "financial_situation";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_completed";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_completed_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_provider";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_session_id";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_technician_id";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "is_video_kyc_equivalent_to_face_to_face";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_onboarding_method";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "requires_enhanced_due_diligence";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "face_to_face_verification_required";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "face_to_face_verification_completed";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "face_to_face_verification_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ubo_declaration_completed";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ubo_details";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ubo_verification_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ubo_last_updated";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ubo_next_review_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_update_due_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_update_reminders_sent";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_last_updated_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_update_method";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_update_notification_preference";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bc_assisted_kyc";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bc_id";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bc_name";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bc_assisted_date";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_tier_upgraded_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_tier_upgrade_requested_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_tier_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_level";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kyc_level_upgraded_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "aml_risk_level";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "aml_screened_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "aml_screening_id";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_required";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "video_kyc_completed_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "entity_type_locked";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "entity_type_locked_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "entity_type_override_by";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "entity_type_override_reason";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "entity_type_override_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bse_ucc_code";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bse_client_code";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bse_ucc_created_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "bse_ucc_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "pan_verification_provider";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "pan_verified_via_sandbox";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "pan_sandbox_verified_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "pan_sandbox_response";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "pan_sandbox_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ckyc_provider";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ckyc_fetched_via_authbridge";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ckyc_authbridge_fetched_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ckyc_authbridge_kin";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ckyc_authbridge_response";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ckyc_authbridge_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kra_provider";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kra_verified_via_protean";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kra_protean_verified_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kra_protean_response";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "kra_protean_status";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "accredited_investor_verified_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "accredited_investor_verified_by";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "annual_income_currency";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "net_worth_amount";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "net_worth_currency";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "portfolio_value_currency";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "professional_qualification_number";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ca_certificate_verified_at";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "ca_certificate_name";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "net_worth_statement_url";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "accredited_investor_rejection_reason";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "products_unlocked";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "products_access_matrix";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "last_product_access_update";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "last_updated";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "aadhaar_verified_via_smart_kyc";--> statement-breakpoint
ALTER TABLE "user_profiles" DROP COLUMN "pan_verified_via_smart_kyc";--> statement-breakpoint
ALTER TABLE "validation_issues" DROP COLUMN "fix_hint";--> statement-breakpoint
ALTER TABLE "validation_issues" DROP COLUMN "auto_fixable";--> statement-breakpoint
ALTER TABLE "validation_issues" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "validation_issues" DROP COLUMN "resolved_by";--> statement-breakpoint
ALTER TABLE "esign_requests" ADD CONSTRAINT "esign_requests_certificate_serial_unique" UNIQUE("certificate_serial");--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_application_number_unique" UNIQUE("application_number");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_referral_code_unique" UNIQUE("referral_code");