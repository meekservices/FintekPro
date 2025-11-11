CREATE TYPE "public"."ai_verification_status" AS ENUM('pending', 'ca_uploaded', 'esign_pending', 'esign_completed', 'submitted', 'approved', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ai_workflow_step" AS ENUM('ca_upload', 'esign', 'bse_submission', 'completed');--> statement-breakpoint
CREATE TABLE "aa_consents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "consent_id" varchar NOT NULL,
        "consent_handle" varchar,
        "purpose" varchar NOT NULL,
        "consent_mode" varchar DEFAULT 'view',
        "fi_types" text[] NOT NULL,
        "data_range_from" timestamp NOT NULL,
        "data_range_to" timestamp NOT NULL,
        "consent_status" varchar DEFAULT 'requested' NOT NULL,
        "consent_expiry" timestamp NOT NULL,
        "frequency" jsonb NOT NULL,
        "data_life_period" jsonb,
        "fiu_id" varchar DEFAULT 'FintekPro-FIU',
        "fiu_name" varchar DEFAULT 'FintekPro',
        "aa_id" varchar,
        "aa_name" varchar,
        "consent_artefact" jsonb,
        "digital_signature" text,
        "customer_vua" varchar,
        "discovered_accounts" jsonb DEFAULT '[]'::jsonb,
        "linked_account_ids" text[],
        "requested_at" timestamp DEFAULT now(),
        "approved_at" timestamp,
        "activated_at" timestamp,
        "paused_at" timestamp,
        "revoked_at" timestamp,
        "expired_at" timestamp,
        "revocation_reason" text,
        "revoked_by" varchar,
        "last_data_fetch_at" timestamp,
        "total_data_fetches" integer DEFAULT 0,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "aa_consents_consent_id_unique" UNIQUE("consent_id"),
        CONSTRAINT "aa_consents_consent_handle_unique" UNIQUE("consent_handle")
);
--> statement-breakpoint
CREATE TABLE "aa_data_fetch_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "consent_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "aa_consent_handle" varchar,
        "session_id" varchar NOT NULL,
        "correlation_id" varchar,
        "fetch_type" varchar NOT NULL,
        "fi_types" text[],
        "accounts_requested" integer,
        "accounts_fetched" integer,
        "accounts_failed" integer,
        "data_range_from" timestamp,
        "data_range_to" timestamp,
        "fetch_status" varchar NOT NULL,
        "response_code" varchar,
        "response_message" text,
        "records_received" integer DEFAULT 0,
        "records_processed" integer DEFAULT 0,
        "records_failed" integer DEFAULT 0,
        "data_completeness" numeric(5, 2),
        "initiated_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "latency_ms" integer,
        "errors" jsonb,
        "error_summary" text,
        "encryption_key_id" varchar,
        "is_data_encrypted" boolean DEFAULT true,
        "data_storage_ref" varchar,
        "data_retention_until" timestamp,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aa_discovered_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "consent_id" varchar,
        "fiu_account_id" varchar,
        "aa_account_id" varchar NOT NULL,
        "masked_account_number" varchar,
        "fip_id" varchar NOT NULL,
        "fip_name" varchar NOT NULL,
        "account_type" varchar NOT NULL,
        "fi_type" varchar NOT NULL,
        "account_status" varchar DEFAULT 'discovered',
        "is_linked" boolean DEFAULT false,
        "account_name" varchar,
        "account_holder_name" varchar,
        "currency" varchar DEFAULT 'INR',
        "current_balance" numeric(15, 2),
        "available_balance" numeric(15, 2),
        "balance_as_of" timestamp,
        "linked_at" timestamp,
        "linked_to_portfolio_id" varchar,
        "last_data_fetch_at" timestamp,
        "last_successful_fetch_at" timestamp,
        "discovered_at" timestamp DEFAULT now(),
        "discovery_source" varchar DEFAULT 'account_aggregator',
        "account_metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "accredited_investor_verifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "session_id" varchar,
        "status" "ai_verification_status" DEFAULT 'pending',
        "current_step" "ai_workflow_step" DEFAULT 'ca_upload',
        "ca_certificate_url" varchar,
        "ca_certificate_name" varchar,
        "ca_certificate_number" varchar,
        "ca_certificate_uploaded_at" timestamp,
        "income_docs" jsonb DEFAULT '[]'::jsonb,
        "net_worth_amount" numeric(15, 2),
        "annual_income_amount" numeric(15, 2),
        "verification_basis" varchar,
        "risk_declaration_url" varchar,
        "esign_provider" varchar,
        "esign_transaction_id" varchar,
        "esign_status" varchar,
        "esign_request_payload" jsonb,
        "esign_response_payload" jsonb,
        "esign_completed_at" timestamp,
        "esign_failure_reason" text,
        "bse_submission_id" varchar,
        "bse_submission_status" varchar,
        "bse_submitted_at" timestamp,
        "bse_request_payload" jsonb,
        "bse_response_payload" jsonb,
        "ai_certificate_number" varchar,
        "ai_certificate_id" varchar,
        "ai_certificate_issued_at" timestamp,
        "ai_certificate_expiry_date" timestamp,
        "ai_certificate_url" varchar,
        "approved_at" timestamp,
        "rejected_at" timestamp,
        "rejection_reason" text,
        "verified_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "achievement_categories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "icon" varchar(50),
        "color" varchar(20),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "achievements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "category_id" varchar,
        "name" varchar(200) NOT NULL,
        "description" text NOT NULL,
        "icon" varchar(50),
        "badge_image" varchar(255),
        "points" integer DEFAULT 0,
        "difficulty" varchar(20) DEFAULT 'beginner',
        "requirements" jsonb,
        "share_template" text,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "admin_settings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "key" varchar NOT NULL,
        "value" jsonb,
        "description" text,
        "updated_by" varchar,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "admin_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "agent_client_mapping" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "client_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "product_type" varchar,
        "start_date" timestamp DEFAULT now() NOT NULL,
        "end_date" timestamp,
        "assignment_type" varchar DEFAULT 'referral',
        "referral_source" varchar,
        "assigned_by" varchar,
        "status" varchar DEFAULT 'active',
        "is_active" boolean DEFAULT true,
        "replaced_by_mapping_id" varchar,
        "replacement_reason" text,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_commission_splits" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sub_agent_id" varchar NOT NULL,
        "master_agent_id" varchar NOT NULL,
        "split_model" varchar DEFAULT 'percentage',
        "product_type" varchar,
        "sub_agent_share" numeric(5, 2) NOT NULL,
        "master_agent_share" numeric(5, 2) NOT NULL,
        "fixed_sub_agent_amount" numeric(10, 2),
        "fixed_master_amount" numeric(10, 2),
        "tiered_rules" jsonb,
        "effective_from" timestamp DEFAULT now() NOT NULL,
        "effective_to" timestamp,
        "is_active" boolean DEFAULT true,
        "created_by" varchar,
        "approved_by" varchar,
        "approved_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_commissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" varchar NOT NULL,
        "master_agent_id" varchar,
        "client_id" varchar NOT NULL,
        "order_id" varchar NOT NULL,
        "product_type" varchar NOT NULL,
        "transaction_type" varchar NOT NULL,
        "transaction_amount" numeric(15, 2) NOT NULL,
        "total_commission_amount" numeric(15, 2) NOT NULL,
        "agent_commission_rate" numeric(5, 2) NOT NULL,
        "agent_commission_amount" numeric(15, 2) NOT NULL,
        "agent_tds_amount" numeric(15, 2) DEFAULT '0.00',
        "agent_net_commission" numeric(15, 2) NOT NULL,
        "master_commission_rate" numeric(5, 2) DEFAULT '0.00',
        "master_commission_amount" numeric(15, 2) DEFAULT '0.00',
        "master_tds_amount" numeric(15, 2) DEFAULT '0.00',
        "master_net_commission" numeric(15, 2) DEFAULT '0.00',
        "split_rule_id" varchar,
        "agent_settlement_status" varchar DEFAULT 'pending',
        "master_settlement_status" varchar DEFAULT 'pending',
        "agent_settled_at" timestamp,
        "master_settled_at" timestamp,
        "transaction_date" timestamp DEFAULT now() NOT NULL,
        "month" varchar NOT NULL,
        "financial_year" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "document_name" varchar NOT NULL,
        "document_url" text NOT NULL,
        "document_number" varchar,
        "verification_status" varchar DEFAULT 'pending',
        "verified_by" varchar,
        "verified_at" timestamp,
        "rejection_reason" text,
        "file_size" integer,
        "mime_type" varchar,
        "uploaded_from" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agent_partner_mappings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" varchar NOT NULL,
        "partner_id" varchar NOT NULL,
        "is_active" boolean DEFAULT true,
        "priority" integer DEFAULT 1,
        "assigned_at" timestamp DEFAULT now(),
        "assigned_by" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "agents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "full_name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "phone" varchar,
        "address" text,
        "employee_id" varchar,
        "arn_code" varchar,
        "euin_number" varchar,
        "posp_number" varchar,
        "dsa_code" varchar,
        "pan_number" varchar,
        "aadhar_number" varchar,
        "bank_account_number" varchar,
        "ifsc_code" varchar,
        "upi_id" varchar,
        "agent_type" varchar DEFAULT 'individual',
        "status" varchar DEFAULT 'active',
        "is_active" boolean DEFAULT true,
        "is_default" boolean DEFAULT false,
        "active_clients" integer DEFAULT 0,
        "total_clients" integer DEFAULT 0,
        "total_revenue" numeric(15, 2) DEFAULT '0.00',
        "monthly_revenue" numeric(15, 2) DEFAULT '0.00',
        "total_commissions_earned" numeric(15, 2) DEFAULT '0.00',
        "reporting_to" varchar,
        "team_size" integer DEFAULT 0,
        "hierarchy_level" integer DEFAULT 1,
        "joining_date" timestamp,
        "termination_date" timestamp,
        "contract_type" varchar DEFAULT 'full_time',
        "commission_tier" varchar DEFAULT 'standard',
        "base_commission_rate" numeric(5, 2) DEFAULT '0.00',
        "nism_certificate_number" varchar,
        "nism_valid_till" timestamp,
        "nism_certificate_url" text,
        "nism_status" varchar DEFAULT 'pending',
        "kyd_verification_status" varchar DEFAULT 'pending',
        "kyd_verified_at" timestamp,
        "kyd_reference_number" varchar,
        "kyd_document_url" text,
        "arn_valid_till" timestamp,
        "euin_valid_till" timestamp,
        "arn_status" varchar DEFAULT 'pending',
        "euin_status" varchar DEFAULT 'pending',
        "compliance_status" varchar DEFAULT 'incomplete',
        "certification_documents" jsonb,
        "last_compliance_check_at" timestamp,
        "compliance_remarks" text,
        "referral_code" varchar,
        "referral_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "agents_email_unique" UNIQUE("email"),
        CONSTRAINT "agents_employee_id_unique" UNIQUE("employee_id"),
        CONSTRAINT "agents_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "ai_fix_suggestions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "error_type" varchar NOT NULL,
        "endpoint" varchar,
        "error_message" text NOT NULL,
        "stack_trace" text,
        "affected_users" integer DEFAULT 0,
        "occurrence_count" integer DEFAULT 1,
        "severity" varchar NOT NULL,
        "first_seen_at" timestamp NOT NULL,
        "last_seen_at" timestamp NOT NULL,
        "ai_root_cause" text,
        "ai_confidence" integer,
        "ai_summary" text,
        "suggested_fix" text NOT NULL,
        "suggested_code" text,
        "fix_category" varchar,
        "status" varchar DEFAULT 'pending',
        "reviewed_by" varchar,
        "reviewed_at" timestamp,
        "review_notes" text,
        "deployed_by" varchar,
        "deployed_at" timestamp,
        "deployment_status" varchar,
        "deployment_notes" text,
        "resolved_at" timestamp,
        "resolution_method" varchar,
        "related_logs" jsonb,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_optimization_suggestions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "category" varchar NOT NULL,
        "suggestion_type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "potential_saving" numeric(10, 2),
        "confidence" numeric(3, 2),
        "action_required" text,
        "automatable" boolean DEFAULT false,
        "implementation_steps" jsonb DEFAULT '[]'::jsonb,
        "status" varchar DEFAULT 'pending' NOT NULL,
        "user_response" text,
        "responded_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_transaction_tracking" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "transaction_id" varchar NOT NULL,
        "external_transaction_id" varchar,
        "transaction_hash" varchar,
        "transaction_type" varchar NOT NULL,
        "transaction_category" varchar,
        "amount" numeric(15, 2) NOT NULL,
        "currency" varchar DEFAULT 'INR',
        "source_type" varchar NOT NULL,
        "source_account" varchar,
        "destination_type" varchar,
        "destination_account" varchar,
        "is_on_site_transaction" boolean DEFAULT false,
        "platform_source" varchar,
        "bank_transaction_id" varchar,
        "bank_name" varchar,
        "payment_method" varchar,
        "merchant_category" varchar,
        "merchant_name" varchar,
        "transaction_pattern" varchar,
        "risk_score" integer,
        "anomaly_score" integer,
        "behavior_analysis" jsonb,
        "income_category" varchar,
        "expense_category" varchar,
        "is_recurring" boolean DEFAULT false,
        "recurring_frequency" varchar,
        "aml_flag" boolean DEFAULT false,
        "compliance_status" varchar DEFAULT 'cleared',
        "compliance_notes" text,
        "requires_manual_review" boolean DEFAULT false,
        "transaction_location" varchar,
        "time_of_day" varchar,
        "day_of_week" varchar,
        "is_weekend" boolean DEFAULT false,
        "api_source" varchar,
        "api_call_id" varchar,
        "data_freshness" varchar,
        "transaction_date" timestamp NOT NULL,
        "processed_at" timestamp DEFAULT now(),
        "last_analyzed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "aif_funds" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "fund_name" text NOT NULL,
        "isin_number" varchar(12),
        "scheme_code" text,
        "category" varchar NOT NULL,
        "sub_category" text NOT NULL,
        "fund_type" varchar NOT NULL,
        "amc_name" text NOT NULL,
        "fund_manager" text NOT NULL,
        "fund_manager_experience" integer,
        "fund_manager_qualification" text,
        "investment_team" jsonb,
        "nav" numeric(15, 4),
        "face_value" numeric(10, 2),
        "aum" numeric(20, 2),
        "minimum_investment" numeric(15, 2),
        "additional_investment" numeric(15, 2),
        "management_fee" numeric(5, 2),
        "performance_fee" numeric(5, 2),
        "entry_load" numeric(5, 2),
        "exit_load" numeric(5, 2),
        "hurdle_rate" numeric(5, 2),
        "investment_objective" text NOT NULL,
        "investment_strategy" text NOT NULL,
        "stock_selection_process" text NOT NULL,
        "risk_management_process" text,
        "benchmark_index" text,
        "returns_1y" numeric(8, 4),
        "returns_3y" numeric(8, 4),
        "returns_5y" numeric(8, 4),
        "returns_since_inception" numeric(8, 4),
        "sharpe_ratio" numeric(6, 4),
        "alpha" numeric(6, 4),
        "beta" numeric(6, 4),
        "volatility" numeric(8, 4),
        "max_drawdown" numeric(8, 4),
        "asset_allocation" jsonb,
        "sector_allocation" jsonb,
        "market_cap_allocation" jsonb,
        "geographic_allocation" jsonb,
        "top_holdings" jsonb,
        "portfolio_turnover" numeric(5, 2),
        "risk_rating" varchar NOT NULL,
        "volatility_category" varchar,
        "suitability_profile" text,
        "sebi_registration_number" varchar NOT NULL,
        "trustee" text NOT NULL,
        "custodian" text NOT NULL,
        "auditor" text,
        "registrar" text,
        "risk_disclosures" text,
        "launch_date" date NOT NULL,
        "maturity_date" date,
        "lock_in_period" varchar,
        "subscription_period" varchar,
        "redemption_frequency" varchar,
        "status" varchar DEFAULT 'active',
        "is_open_for_subscription" boolean DEFAULT true,
        "is_open_for_redemption" boolean DEFAULT true,
        "exchange" varchar,
        "trading_symbol" varchar,
        "lot_size" integer,
        "factsheet_url" text,
        "prospectus_url" text,
        "website_url" text,
        "key_personnel" jsonb,
        "esg_rating" varchar,
        "sustainability_score" numeric(5, 2),
        "green_bond_allocation" numeric(5, 2),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "last_nav_update" timestamp,
        CONSTRAINT "aif_funds_isin_number_unique" UNIQUE("isin_number"),
        CONSTRAINT "aif_funds_scheme_code_unique" UNIQUE("scheme_code")
);
--> statement-breakpoint
CREATE TABLE "alert_history" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "alert_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "triggered_at" timestamp DEFAULT now(),
        "trigger_value" jsonb,
        "alert_snapshot" jsonb,
        "notification_status" varchar DEFAULT 'pending',
        "notification_channels" jsonb,
        "notification_sent_at" timestamp,
        "notification_error" text,
        "is_read" boolean DEFAULT false,
        "read_at" timestamp,
        "is_dismissed" boolean DEFAULT false,
        "dismissed_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "alert_templates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "template_name" text NOT NULL,
        "template_type" varchar NOT NULL,
        "category" varchar NOT NULL,
        "default_config" jsonb NOT NULL,
        "description" text,
        "is_popular" boolean DEFAULT false,
        "usage_count" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "display_order" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "amfi_verification_log" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" varchar,
        "verification_type" varchar NOT NULL,
        "arn_code" varchar,
        "euin_number" varchar,
        "api_request" jsonb,
        "api_response" jsonb,
        "verification_status" varchar NOT NULL,
        "error_message" text,
        "distributor_name" varchar,
        "distributor_status" varchar,
        "arn_expiry_date" timestamp,
        "registration_date" timestamp,
        "verified_by" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_integration_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "source_id" varchar NOT NULL,
        "api_endpoint" varchar NOT NULL,
        "http_method" varchar DEFAULT 'GET',
        "request_payload" jsonb,
        "response_payload" jsonb,
        "status_code" integer,
        "response_time_ms" integer,
        "success" boolean DEFAULT false,
        "error_message" text,
        "data_points" integer,
        "cost_incurred" numeric(10, 4),
        "rate_limit" jsonb,
        "data_quality" varchar,
        "data_completeness" integer,
        "confidence_score" integer,
        "enrichment_triggered" boolean DEFAULT false,
        "ai_processing_time_ms" integer,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_usage_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider" varchar NOT NULL,
        "api_endpoint" varchar NOT NULL,
        "api_method" varchar DEFAULT 'GET',
        "request_headers" jsonb,
        "request_body" jsonb,
        "status_code" integer,
        "response_body" jsonb,
        "response_time" integer,
        "status" varchar DEFAULT 'pending',
        "error_message" text,
        "error_code" varchar,
        "user_id" varchar,
        "feature" varchar,
        "estimated_cost" numeric(10, 4),
        "currency" varchar DEFAULT 'USD',
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "application_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "document_name" varchar NOT NULL,
        "document_category" varchar NOT NULL,
        "file_name" varchar NOT NULL,
        "file_format" varchar NOT NULL,
        "file_size" integer,
        "object_storage_key" varchar,
        "status" varchar DEFAULT 'uploaded',
        "verification_status" varchar DEFAULT 'pending',
        "verification_notes" text,
        "verified_by" varchar,
        "verified_at" timestamp,
        "provider_document_id" varchar,
        "sent_to_provider" boolean DEFAULT false,
        "sent_to_provider_at" timestamp,
        "is_required" boolean DEFAULT true,
        "uploaded_via" varchar DEFAULT 'web',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "apy_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "pran" varchar NOT NULL,
        "account_holder_name" text NOT NULL,
        "date_of_birth" date NOT NULL,
        "enrollment_date" date NOT NULL,
        "pension_amount" numeric(15, 2) NOT NULL,
        "monthly_contribution" numeric(15, 2) NOT NULL,
        "total_contribution" numeric(15, 2) DEFAULT '0',
        "government_contribution" numeric(15, 2) DEFAULT '0',
        "total_balance" numeric(15, 2) DEFAULT '0',
        "enrollment_age" integer NOT NULL,
        "maturity_age" integer DEFAULT 60 NOT NULL,
        "years_to_maturity" integer,
        "expected_maturity_date" date,
        "bank_name" text NOT NULL,
        "bank_account_number" varchar NOT NULL,
        "ifsc_code" varchar NOT NULL,
        "branch_name" text,
        "nominee" text,
        "nominee_relation" varchar,
        "nominee_age" integer,
        "status" varchar DEFAULT 'active' NOT NULL,
        "last_contribution_date" date,
        "exit_date" date,
        "exit_reason" text,
        "remarks" text,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "apy_accounts_pran_unique" UNIQUE("pran")
);
--> statement-breakpoint
CREATE TABLE "asset_allocation" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "asset_type" text NOT NULL,
        "asset_class" text,
        "target_percentage" numeric(5, 2),
        "current_percentage" numeric(5, 2),
        "target_value" numeric(15, 2),
        "current_value" numeric(15, 2),
        "rebalance_amount" numeric(15, 2),
        "risk_score" numeric(3, 1),
        "expected_return" numeric(5, 2),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "asset_forecasts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "holding_id" varchar,
        "symbol" varchar NOT NULL,
        "asset_type" varchar NOT NULL,
        "forecast_date" timestamp NOT NULL,
        "horizon" varchar NOT NULL,
        "current_price" numeric(20, 2),
        "predicted_price" numeric(20, 2),
        "price_change" numeric(10, 4),
        "expected_return" numeric(10, 4),
        "volatility" numeric(10, 4),
        "beta" numeric(10, 4),
        "support_level" numeric(20, 2),
        "resistance_level" numeric(20, 2),
        "trend_signal" varchar,
        "risk_rating" varchar,
        "probability_of_loss" numeric(5, 2),
        "recommendation" varchar,
        "recommendation_reason" text,
        "confidence_level" numeric(5, 2),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_hash_chain" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sequence_number" bigint NOT NULL,
        "previous_hash" varchar(64),
        "current_hash" varchar(64) NOT NULL,
        "audit_type" varchar NOT NULL,
        "audit_record_id" varchar NOT NULL,
        "audit_table" varchar NOT NULL,
        "record_snapshot" jsonb NOT NULL,
        "record_hash" varchar(64) NOT NULL,
        "user_id" varchar,
        "agent_id" varchar,
        "client_id" varchar,
        "regulatory_category" varchar,
        "compliance_event" varchar,
        "is_verified" boolean DEFAULT true,
        "verified_at" timestamp,
        "verification_status" varchar,
        "created_at" timestamp DEFAULT now(),
        "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "auto_population_status" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "workflow_id" varchar NOT NULL,
        "triggered_by" varchar NOT NULL,
        "status" varchar DEFAULT 'initiated' NOT NULL,
        "total_data_sources" integer DEFAULT 0,
        "successful_sources" integer DEFAULT 0,
        "failed_sources" integer DEFAULT 0,
        "source_status" jsonb,
        "source_errors" jsonb,
        "total_records_fetched" integer DEFAULT 0,
        "total_holdings_value" numeric(15, 2),
        "initiated_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "duration_ms" integer,
        "error_message" text,
        "retry_count" integer DEFAULT 0,
        CONSTRAINT "auto_population_status_workflow_id_unique" UNIQUE("workflow_id")
);
--> statement-breakpoint
CREATE TABLE "bbps_billers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "biller_name" varchar NOT NULL,
        "biller_code" varchar NOT NULL,
        "category_id" varchar NOT NULL,
        "biller_alias_name" varchar,
        "biller_coverage" varchar,
        "payment_amount_exactness" varchar DEFAULT 'EXACT_BILL_AMOUNT',
        "customer_param_name" varchar NOT NULL,
        "biller_effctv_from" timestamp,
        "biller_effctv_to" timestamp,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bbps_categories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "category_name" varchar NOT NULL,
        "category_code" varchar NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bbps_customer_bills" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "biller_id" varchar NOT NULL,
        "customer_param" varchar NOT NULL,
        "bill_amount" varchar,
        "due_date" varchar,
        "bill_date" varchar,
        "bill_period" varchar,
        "bill_fetch_status" varchar DEFAULT 'PENDING',
        "bill_data" text,
        "fetched_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bbps_transactions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "bill_id" varchar,
        "biller_code" varchar NOT NULL,
        "customer_param" varchar NOT NULL,
        "amount" varchar NOT NULL,
        "payment_amount" varchar NOT NULL,
        "transaction_id" varchar,
        "bbps_transaction_id" varchar,
        "cashfree_order_id" varchar,
        "payment_status" varchar DEFAULT 'PENDING',
        "payment_mode" varchar,
        "transaction_reference" varchar,
        "failure_reason" text,
        "commission_amount" varchar,
        "settlement_date" timestamp,
        "receipt_data" text,
        "initiated_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "bbps_transactions_transaction_id_unique" UNIQUE("transaction_id")
);
--> statement-breakpoint
CREATE TABLE "bond_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "portfolio_id" varchar,
        "bond_id" varchar,
        "bond_type" varchar NOT NULL,
        "isin" varchar NOT NULL,
        "bond_name" text NOT NULL,
        "issuer" varchar NOT NULL,
        "quantity" integer NOT NULL,
        "face_value" numeric(15, 2) NOT NULL,
        "total_face_value" numeric(15, 2) NOT NULL,
        "purchase_date" date NOT NULL,
        "purchase_price" numeric(15, 4) NOT NULL,
        "purchase_yield" numeric(8, 4),
        "total_invested_amount" numeric(15, 2) NOT NULL,
        "current_price" numeric(15, 4),
        "current_yield" numeric(8, 4),
        "current_value" numeric(15, 2),
        "unrealized_gain_loss" numeric(15, 2),
        "coupon_rate" numeric(8, 4),
        "maturity_date" date NOT NULL,
        "credit_rating" varchar,
        "total_coupons_received" numeric(15, 2) DEFAULT '0',
        "next_coupon_date" date,
        "next_coupon_amount" numeric(15, 4),
        "demat_account_id" varchar,
        "demat_account_number" varchar,
        "holding_status" varchar DEFAULT 'active',
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "bond_orders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "order_number" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "client_code" varchar,
        "bond_id" varchar,
        "bond_type" varchar NOT NULL,
        "isin" varchar NOT NULL,
        "bond_name" text NOT NULL,
        "order_type" varchar NOT NULL,
        "order_category" varchar NOT NULL,
        "quantity" integer NOT NULL,
        "face_value" numeric(15, 2) NOT NULL,
        "total_face_value" numeric(15, 2) NOT NULL,
        "order_price" numeric(15, 4),
        "limit_price" numeric(15, 4),
        "gross_amount" numeric(15, 2) NOT NULL,
        "accrued_interest" numeric(15, 4) DEFAULT '0',
        "net_amount" numeric(15, 2) NOT NULL,
        "order_status" varchar DEFAULT 'pending',
        "execution_price" numeric(15, 4),
        "execution_date" timestamp,
        "settlement_date" date,
        "exchange_order_id" varchar,
        "exchange_transaction_id" varchar,
        "exchange" varchar DEFAULT 'bse',
        "payment_status" varchar DEFAULT 'pending',
        "payment_method" varchar,
        "payment_reference" varchar,
        "payment_url" text,
        "demat_account_id" varchar,
        "demat_account_number" varchar,
        "kyc_level" varchar,
        "kyc_validated" boolean DEFAULT false,
        "order_placed_by" varchar,
        "remarks" text,
        "order_date" timestamp DEFAULT now(),
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "bond_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "bse_ucc_requests" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "kra_check_id" varchar,
        "ucc_number" varchar,
        "request_id" varchar,
        "status" varchar DEFAULT 'pending',
        "attempt_count" integer DEFAULT 0,
        "last_tried_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "request_payload" jsonb,
        "response_data" jsonb,
        "rejection_reason" text,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "bse_ucc_requests_ucc_number_unique" UNIQUE("ucc_number")
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "campaign_id" varchar NOT NULL,
        "user_id" varchar,
        "email" varchar,
        "mobile" varchar,
        "full_name" varchar,
        "status" varchar DEFAULT 'pending' NOT NULL,
        "sent_at" timestamp,
        "delivered_at" timestamp,
        "opened_at" timestamp,
        "clicked_at" timestamp,
        "unsubscribed_at" timestamp,
        "converted" boolean DEFAULT false,
        "converted_at" timestamp,
        "conversion_value" numeric(15, 2),
        "error_message" text,
        "retry_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capital_gains_reports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "report_type" varchar NOT NULL,
        "source" varchar NOT NULL,
        "total_short_term_gains" numeric(15, 2) DEFAULT '0',
        "total_long_term_gains" numeric(15, 2) DEFAULT '0',
        "total_dividend" numeric(15, 2) DEFAULT '0',
        "total_tds_deducted" numeric(15, 2) DEFAULT '0',
        "report_data" jsonb,
        "generated_at" timestamp DEFAULT now(),
        "fetched_at" timestamp,
        "status" varchar DEFAULT 'pending',
        "error_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capital_gains_tax_reminders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "subscription_id" varchar,
        "quarter" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "due_date" date NOT NULL,
        "estimated_stcg" numeric(15, 2) DEFAULT '0',
        "estimated_ltcg" numeric(15, 2) DEFAULT '0',
        "total_tax_liability" numeric(15, 2) DEFAULT '0',
        "reminder_sent_at" timestamp,
        "status" varchar DEFAULT 'pending' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cas_requests" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "portfolio_id" varchar,
        "provider" varchar NOT NULL,
        "request_id" varchar NOT NULL,
        "status" varchar DEFAULT 'requested' NOT NULL,
        "current_step" varchar DEFAULT 'generation',
        "pan_number" varchar,
        "email" varchar,
        "from_date" date,
        "to_date" date,
        "pdf_url" text,
        "pdf_size" integer,
        "generated_at" timestamp,
        "parsed_data" jsonb,
        "total_folios" integer DEFAULT 0,
        "total_value" numeric(15, 2),
        "parsed_at" timestamp,
        "imported_at" timestamp,
        "inserted_holdings" integer DEFAULT 0,
        "updated_holdings" integer DEFAULT 0,
        "skipped_duplicates" integer DEFAULT 0,
        "error_message" text,
        "error_step" varchar,
        "requested_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "metadata" jsonb,
        CONSTRAINT "cas_requests_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "cashfree_ekyc_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "cashfree_session_id" varchar,
        "aadhaar_number" varchar,
        "otp_sent_at" timestamp,
        "otp_verified_at" timestamp,
        "otp_attempts" integer DEFAULT 0,
        "consent_given" boolean DEFAULT false,
        "consent_ip_address" varchar,
        "consent_user_agent" text,
        "consent_timestamp" timestamp,
        "xml_url" varchar,
        "xml_hash" varchar,
        "xml_parsed" boolean DEFAULT false,
        "xml_parsed_at" timestamp,
        "parsed_data" jsonb,
        "status" varchar DEFAULT 'pending',
        "error_code" varchar,
        "error_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "cashfree_ekyc_sessions_cashfree_session_id_unique" UNIQUE("cashfree_session_id")
);
--> statement-breakpoint
CREATE TABLE "cashfree_transactions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "order_id" varchar NOT NULL,
        "cashfree_order_id" varchar,
        "payment_session_id" varchar,
        "amount" numeric(15, 2) NOT NULL,
        "currency" varchar DEFAULT 'INR',
        "payment_method" varchar,
        "payment_instrument_type" varchar,
        "customer_id" varchar,
        "mobile_number" varchar,
        "customer_name" varchar,
        "customer_email" varchar,
        "status" varchar DEFAULT 'PENDING' NOT NULL,
        "gateway_response" jsonb,
        "webhook_received_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "cashfree_transactions_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "cersai_submissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "ekyc_session_id" varchar,
        "submission_id" varchar,
        "package_version" varchar DEFAULT '3.0',
        "ckyc_number" varchar,
        "status" varchar DEFAULT 'pending',
        "submitted_at" timestamp,
        "acknowledged_at" timestamp,
        "verified_at" timestamp,
        "acknowledgment_data" jsonb,
        "rejection_code" varchar,
        "rejection_message" text,
        "xml_storage_url" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "cersai_submissions_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "chart_configurations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "symbols" text[] NOT NULL,
        "chart_type" varchar DEFAULT 'line',
        "indicator_settings" jsonb DEFAULT '[]'::jsonb,
        "date_range_type" varchar DEFAULT '1Y',
        "start_date" date,
        "end_date" date,
        "display_options" jsonb DEFAULT '{"showVolume":true,"showGrid":true,"colorScheme":"default"}'::jsonb,
        "share_token" varchar,
        "is_discoverable" boolean DEFAULT false,
        "view_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "chart_configurations_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "chat_actions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "message_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "action_type" varchar NOT NULL,
        "function_name" varchar NOT NULL,
        "status" varchar DEFAULT 'pending_confirmation',
        "user_confirmed_at" timestamp,
        "executed_at" timestamp,
        "action_params" jsonb NOT NULL,
        "action_result" jsonb,
        "error_message" text,
        "transaction_id" varchar,
        "order_id" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_functions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "function_name" varchar NOT NULL,
        "display_name" text NOT NULL,
        "description" text NOT NULL,
        "category" varchar NOT NULL,
        "parameters" jsonb NOT NULL,
        "required_roles" jsonb DEFAULT '[]'::jsonb,
        "requires_confirmation" boolean DEFAULT true,
        "is_enabled" boolean DEFAULT true,
        "usage_count" integer DEFAULT 0,
        "success_rate" numeric(5, 2),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "chat_functions_function_name_unique" UNIQUE("function_name")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "role" varchar NOT NULL,
        "content" text NOT NULL,
        "function_call" jsonb,
        "function_response" jsonb,
        "model" varchar DEFAULT 'gemini-1.5-flash',
        "tokens" integer,
        "attachments" jsonb,
        "metadata" jsonb,
        "is_edited" boolean DEFAULT false,
        "edited_at" timestamp,
        "user_rating" integer,
        "feedback_text" text,
        "is_flagged" boolean DEFAULT false,
        "flagged_reason" text,
        "flagged_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "title" text,
        "session_type" varchar DEFAULT 'general',
        "context_data" jsonb,
        "portfolio_id" varchar,
        "portfolio_snapshot_id" varchar,
        "is_active" boolean DEFAULT true,
        "last_message_at" timestamp,
        "message_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ckyc_action_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ckyc_record_id" varchar NOT NULL,
        "action_type" varchar NOT NULL,
        "action_by" varchar NOT NULL,
        "action_by_type" varchar NOT NULL,
        "action_details" text NOT NULL,
        "previous_value" jsonb,
        "new_value" jsonb,
        "ip_address" varchar,
        "user_agent" text,
        "action_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ckyc_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ckyc_record_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "document_number" varchar,
        "document_url" varchar,
        "verification_status" varchar DEFAULT 'pending',
        "uploaded_at" timestamp DEFAULT now(),
        "verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ckyc_notification_triggers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ckyc_record_id" varchar NOT NULL,
        "trigger_type" varchar NOT NULL,
        "notification_method" varchar NOT NULL,
        "recipient_email" varchar,
        "recipient_mobile" varchar,
        "subject" varchar NOT NULL,
        "message" text NOT NULL,
        "status" varchar DEFAULT 'pending',
        "scheduled_at" timestamp,
        "sent_at" timestamp,
        "failure_reason" text,
        "triggerred_by" varchar,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ckyc_progress_steps" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ckyc_record_id" varchar NOT NULL,
        "step_name" varchar NOT NULL,
        "step_status" varchar NOT NULL,
        "step_description" text,
        "completed_at" timestamp,
        "completed_by" varchar,
        "estimated_completion_time" integer,
        "actual_completion_time" integer,
        "step_order" integer NOT NULL,
        "is_active" boolean DEFAULT true,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ckyc_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ckyc_number" varchar,
        "application_number" varchar,
        "first_name" varchar NOT NULL,
        "middle_name" varchar,
        "last_name" varchar NOT NULL,
        "date_of_birth" date NOT NULL,
        "gender" varchar(1),
        "marital_status" varchar,
        "nationality" varchar DEFAULT 'Indian',
        "pan_number" varchar NOT NULL,
        "aadhar_number" varchar,
        "passport_number" varchar,
        "voter_id_number" varchar,
        "driving_license_number" varchar,
        "mobile_number" varchar NOT NULL,
        "email_address" varchar NOT NULL,
        "address_line1" text NOT NULL,
        "address_line2" text,
        "city" varchar NOT NULL,
        "district" varchar,
        "state" varchar NOT NULL,
        "pincode" varchar(6) NOT NULL,
        "country" varchar DEFAULT 'India',
        "address_type" varchar DEFAULT 'permanent',
        "occupation" varchar,
        "annual_income" varchar,
        "net_worth" varchar,
        "source_of_wealth" varchar,
        "status" varchar DEFAULT 'pending',
        "verification_level" varchar,
        "verification_method" varchar,
        "digilocker_verified" boolean DEFAULT false,
        "last_verified_at" timestamp,
        "expiry_date" date,
        "fatca_status" varchar,
        "fatca_declaration_date" timestamp,
        "fatca_tin_number" varchar,
        "fatca_country_of_tax_residence" varchar,
        "fatca_reason_code" varchar,
        "pep_status" varchar DEFAULT 'N',
        "pep_related_person_status" varchar DEFAULT 'N',
        "pep_details" text,
        "risk_category" varchar DEFAULT 'low',
        "resident_status" varchar DEFAULT 'resident',
        "country_of_residence" varchar DEFAULT 'India',
        "country_of_citizenship" varchar DEFAULT 'India',
        "aml_status" varchar DEFAULT 'clear',
        "aml_last_checked" timestamp,
        "sanction_list_status" varchar DEFAULT 'clear',
        "sanction_list_last_checked" timestamp,
        "cdd_level" varchar DEFAULT 'simplified',
        "edd_required" boolean DEFAULT false,
        "edd_completed_date" timestamp,
        "compliance_score" integer DEFAULT 100,
        "last_compliance_review" timestamp DEFAULT now(),
        "next_compliance_review" timestamp,
        "profile_completeness" integer DEFAULT 0,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "ckyc_records_ckyc_number_unique" UNIQUE("ckyc_number")
);
--> statement-breakpoint
CREATE TABLE "ckyc_status_history" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ckyc_record_id" varchar NOT NULL,
        "previous_status" varchar,
        "new_status" varchar NOT NULL,
        "changed_by" varchar,
        "reason" text,
        "metadata" jsonb,
        "changed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_agent_relationships" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "client_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "euin_number" varchar NOT NULL,
        "arn_code" varchar,
        "amc_code" varchar,
        "distributor_id" varchar,
        "relationship_type" varchar DEFAULT 'primary',
        "is_active" boolean DEFAULT true,
        "assigned_at" timestamp DEFAULT now(),
        "assigned_by" varchar,
        "commission_rate" numeric(5, 2),
        "fee_structure" jsonb,
        "auto_populate_euin" boolean DEFAULT true,
        "auto_populate_arn" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_enrichment_data" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "source_id" varchar NOT NULL,
        "enrichment_type" varchar NOT NULL,
        "data_category" varchar NOT NULL,
        "raw_data" jsonb,
        "processed_data" jsonb,
        "enrichment_score" integer,
        "confidence_level" varchar,
        "estimated_income" numeric(15, 2),
        "income_stability" varchar,
        "spending_pattern" jsonb,
        "creditworthiness" varchar,
        "risk_indicators" jsonb,
        "business_turnover" numeric(15, 2),
        "business_type" varchar,
        "industry_risk" varchar,
        "business_vintage_months" integer,
        "gst_compliance" varchar,
        "digital_footprint" jsonb,
        "social_connections" jsonb,
        "lifestyle_indicators" jsonb,
        "is_verified" boolean DEFAULT false,
        "verification_method" varchar,
        "last_updated" timestamp DEFAULT now(),
        "expiry_date" timestamp,
        "ai_model_used" varchar,
        "processing_time_ms" integer,
        "api_call_count" integer DEFAULT 1,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_intelligence" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "cin" varchar,
        "company_verified" boolean DEFAULT false,
        "probe42_score" integer,
        "financial_health_status" varchar,
        "annual_revenue" numeric(15, 2),
        "net_profit" numeric(15, 2),
        "total_assets" numeric(15, 2),
        "risk_level" varchar,
        "risk_factors" jsonb,
        "legal_cases" jsonb,
        "compliance_issues" jsonb,
        "cross_sell_score" integer DEFAULT 0,
        "upsell_potential" varchar,
        "recommended_products" jsonb,
        "group_companies" jsonb,
        "total_group_revenue" numeric(15, 2),
        "last_refreshed_at" timestamp,
        "next_refresh_due" timestamp,
        "refresh_frequency" varchar DEFAULT 'monthly',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "client_intelligence_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "client_statements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "statement_type" varchar NOT NULL,
        "statement_period" varchar NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "financial_year" varchar,
        "opening_balance" numeric(15, 2) DEFAULT '0',
        "closing_balance" numeric(15, 2) DEFAULT '0',
        "total_inflows" numeric(15, 2) DEFAULT '0',
        "total_outflows" numeric(15, 2) DEFAULT '0',
        "total_gains" numeric(15, 2) DEFAULT '0',
        "total_losses" numeric(15, 2) DEFAULT '0',
        "equity_holdings" jsonb DEFAULT '[]'::jsonb,
        "mf_holdings" jsonb DEFAULT '[]'::jsonb,
        "bond_holdings" jsonb DEFAULT '[]'::jsonb,
        "other_holdings" jsonb DEFAULT '[]'::jsonb,
        "transaction_ids" jsonb DEFAULT '[]'::jsonb,
        "transaction_count" integer DEFAULT 0,
        "pdf_url" text,
        "excel_url" text,
        "statement_number" varchar,
        "is_consolidated" boolean DEFAULT false,
        "portfolio_id" varchar,
        "generated_at" timestamp,
        "sent_to_client" boolean DEFAULT false,
        "sent_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "client_statements_statement_number_unique" UNIQUE("statement_number")
);
--> statement-breakpoint
CREATE TABLE "collateral_valuations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "loan_id" varchar NOT NULL,
        "valuation_date" timestamp DEFAULT now(),
        "total_collateral_value" numeric(15, 2) NOT NULL,
        "eligible_collateral_value" numeric(15, 2) NOT NULL,
        "haircut" numeric(5, 2),
        "current_ltv" numeric(5, 2),
        "max_allowed_ltv" numeric(5, 2),
        "margin_call" boolean DEFAULT false,
        "margin_call_date" timestamp,
        "valuation_method" varchar,
        "valued_by" varchar,
        "asset_breakdown" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "agent_id" varchar NOT NULL,
        "client_id" varchar NOT NULL,
        "order_id" varchar,
        "transaction_type" varchar,
        "product_type" varchar NOT NULL,
        "scheme_code" varchar,
        "scheme_name" varchar,
        "transaction_amount" numeric(20, 2) NOT NULL,
        "units" numeric(20, 4),
        "nav" numeric(20, 4),
        "commission_type" varchar NOT NULL,
        "commission_rate" numeric(5, 2) NOT NULL,
        "commission_amount" numeric(15, 2) NOT NULL,
        "trail_month" varchar,
        "trail_frequency" varchar,
        "tds_amount" numeric(15, 2) DEFAULT '0.00',
        "tds_rate" numeric(5, 2) DEFAULT '0.00',
        "gst_amount" numeric(15, 2) DEFAULT '0.00',
        "net_commission" numeric(15, 2) NOT NULL,
        "rta_report_date" timestamp,
        "rta_reference_number" varchar,
        "amc_name" varchar,
        "payout_status" varchar DEFAULT 'pending',
        "approved_by" varchar,
        "approved_at" timestamp,
        "payout_request_id" varchar,
        "payout_method" varchar,
        "payout_date" timestamp,
        "payout_reference_number" varchar,
        "payout_amount" numeric(15, 2),
        "cashfree_transfer_id" varchar,
        "cashfree_utr" varchar,
        "cashfree_status" varchar,
        "is_reconciled" boolean DEFAULT false,
        "reconciled_at" timestamp,
        "reconciled_by" varchar,
        "reconciliation_notes" text,
        "failure_reason" text,
        "retry_count" integer DEFAULT 0,
        "calculated_at" timestamp DEFAULT now(),
        "calculation_method" varchar,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "commodity_prices" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "symbol" text NOT NULL,
        "name" text NOT NULL,
        "category" text NOT NULL,
        "price" numeric(15, 4) NOT NULL,
        "price_unit" text NOT NULL,
        "change" numeric(15, 4),
        "change_percent" numeric(8, 4),
        "last_updated" timestamp DEFAULT now(),
        CONSTRAINT "commodity_prices_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "comparison_history" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "comparison_type" varchar NOT NULL,
        "comparison_id" varchar,
        "items_compared" jsonb,
        "view_duration" integer,
        "actions_performed" jsonb,
        "saved_comparison" boolean DEFAULT false,
        "shared_comparison" boolean DEFAULT false,
        "accessed_at" timestamp DEFAULT now(),
        "last_viewed_at" timestamp,
        "user_agent" varchar,
        "ip_address" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_audit_trail" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "action" varchar NOT NULL,
        "field_changed" varchar,
        "old_value" text,
        "new_value" text,
        "reason" text,
        "performed_by" varchar NOT NULL,
        "performed_by_role" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "risk_impact" varchar,
        "compliance_impact" varchar,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "compliance_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "document_number" varchar,
        "document_url" varchar,
        "original_file_name" varchar,
        "file_size" integer,
        "mime_type" varchar,
        "verification_status" varchar DEFAULT 'pending',
        "verification_date" timestamp,
        "verified_by" varchar,
        "expiry_date" timestamp,
        "is_active" boolean DEFAULT true,
        "rejection_reason" text,
        "metadata" jsonb,
        "uploaded_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "comprehensive_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "snapshot_id" varchar,
        "user_id" varchar NOT NULL,
        "holding_date" date NOT NULL,
        "symbol" text NOT NULL,
        "isin" varchar,
        "asset_name" text NOT NULL,
        "asset_type" text NOT NULL,
        "asset_class" text,
        "sub_asset_class" text,
        "quantity" numeric(15, 4),
        "units" numeric(15, 4),
        "avg_price" numeric(15, 4),
        "current_price" numeric(15, 4),
        "market_value" numeric(15, 2),
        "invested_value" numeric(15, 2),
        "gain_loss" numeric(15, 2),
        "gain_loss_percent" numeric(8, 4),
        "data_source" varchar NOT NULL,
        "source_account_number" varchar,
        "folio" varchar,
        "demat_account_number" varchar,
        "sector" text,
        "industry" text,
        "market_cap" numeric(20, 0),
        "beta" numeric(5, 3),
        "dividend_yield" numeric(5, 2),
        "pe_ratio" numeric(8, 2),
        "maturity_date" date,
        "interest_rate" numeric(5, 2),
        "contribution_frequency" varchar,
        "nominee_name" text,
        "nominee_relation" varchar,
        "metadata" jsonb,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "corporate_bonds" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "isin" varchar NOT NULL,
        "security_code" varchar,
        "bond_name" text NOT NULL,
        "issuer" varchar NOT NULL,
        "bond_type" varchar NOT NULL,
        "face_value" numeric(15, 2) DEFAULT '1000',
        "coupon_type" varchar NOT NULL,
        "coupon_rate" numeric(8, 4),
        "coupon_frequency" varchar,
        "issue_date" date,
        "maturity_date" date NOT NULL,
        "tenor_years" numeric(5, 2),
        "issue_price" numeric(15, 4),
        "current_price" numeric(15, 4),
        "yield_to_maturity" numeric(8, 4),
        "yield_to_call" numeric(8, 4),
        "listing_date" date,
        "trading_status" varchar DEFAULT 'active',
        "minimum_lot_size" integer DEFAULT 1,
        "minimum_investment" numeric(15, 2),
        "is_callable" boolean DEFAULT false,
        "call_date" date,
        "call_price" numeric(15, 4),
        "is_puttable" boolean DEFAULT false,
        "put_date" date,
        "put_price" numeric(15, 4),
        "secured" boolean DEFAULT false,
        "security_type" varchar,
        "collateral_type" text,
        "credit_rating" varchar,
        "rating_agency" varchar,
        "rating_date" date,
        "outlook_status" varchar,
        "duration" numeric(8, 4),
        "modified_duration" numeric(8, 4),
        "convexity" numeric(10, 4),
        "last_traded_price" numeric(15, 4),
        "last_traded_date" date,
        "volume" integer,
        "turnover" numeric(15, 2),
        "issuer_sector" varchar,
        "issuer_industry" varchar,
        "issuer_credit_rating" varchar,
        "tax_status" varchar DEFAULT 'taxable',
        "tax_benefit_section" varchar,
        "tax_benefit_details" text,
        "indexation_benefit" boolean DEFAULT false,
        "infrastructure_sector" varchar,
        "project_name" text,
        "utilization_purpose" text,
        "sebi_approved" boolean DEFAULT false,
        "special_features" jsonb DEFAULT '[]'::jsonb,
        "lockin_period" varchar,
        "markup" numeric(8, 4) DEFAULT '0',
        "markup_type" varchar DEFAULT 'percentage',
        "final_price" numeric(15, 4),
        "is_perpetual" boolean DEFAULT false,
        "data_source" varchar DEFAULT 'bse_bond',
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "corporate_bonds_isin_unique" UNIQUE("isin"),
        CONSTRAINT "corporate_bonds_security_code_unique" UNIQUE("security_code")
);
--> statement-breakpoint
CREATE TABLE "corporate_kyc_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "step1_corporate_pan_verified" boolean DEFAULT false,
        "step1_corporate_pan" varchar,
        "step1_company_name" varchar,
        "step1_company_type" varchar,
        "step1_completed_at" timestamp,
        "step1_data" jsonb,
        "step2_documents_uploaded" boolean DEFAULT false,
        "step2_coi_url" varchar,
        "step2_moa_url" varchar,
        "step2_aoa_url" varchar,
        "step2_board_resolution_url" varchar,
        "step2_completed_at" timestamp,
        "step2_data" jsonb,
        "step3_signatory_verified" boolean DEFAULT false,
        "step3_signatory_name" varchar,
        "step3_signatory_aadhaar_last_four" varchar,
        "step3_signatory_designation" varchar,
        "step3_digilocker_session_id" varchar,
        "step3_completed_at" timestamp,
        "step3_data" jsonb,
        "step4_accounts_discovered" boolean DEFAULT false,
        "step4_bank_accounts_found" integer DEFAULT 0,
        "step4_demat_accounts_found" integer DEFAULT 0,
        "step4_completed_at" timestamp,
        "step4_data" jsonb,
        "step5_review_completed" boolean DEFAULT false,
        "step5_completed_at" timestamp,
        "step5_confirmed_data" jsonb,
        "current_step" integer DEFAULT 1,
        "is_completed" boolean DEFAULT false,
        "completed_at" timestamp,
        "cin" varchar,
        "gstin" varchar,
        "started_at" timestamp DEFAULT now(),
        "last_updated_step" integer,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "corporate_kyc_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "credit_profiles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "cibil_score" integer,
        "experian_score" integer,
        "equifax_score" integer,
        "high_mark_score" integer,
        "last_credit_pull_date" timestamp,
        "monthly_income" numeric(15, 2),
        "annual_income" numeric(15, 2),
        "employment_type" varchar,
        "work_experience" integer,
        "company_type" varchar,
        "existing_emis" numeric(15, 2) DEFAULT '0',
        "existing_credit_cards" integer DEFAULT 0,
        "total_credit_limit" numeric(15, 2) DEFAULT '0',
        "credit_utilization" numeric(5, 2) DEFAULT '0',
        "net_worth" numeric(15, 2),
        "current_assets" numeric(15, 2),
        "total_liabilities" numeric(15, 2),
        "property_ownership" boolean DEFAULT false,
        "property_value" numeric(15, 2),
        "securities_portfolio" numeric(15, 2),
        "banking_history" integer DEFAULT 0,
        "primary_bank_name" varchar,
        "average_monthly_balance" numeric(15, 2),
        "total_loans_availed" integer DEFAULT 0,
        "loans_closed_successfully" integer DEFAULT 0,
        "any_default_history" boolean DEFAULT false,
        "last_loan_date" timestamp,
        "risk_profile" varchar DEFAULT 'medium',
        "debt_to_income_ratio" numeric(5, 2),
        "bureau_raw_data" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "credit_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "currency_rates" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "base_currency" varchar DEFAULT 'INR' NOT NULL,
        "target_currency" varchar NOT NULL,
        "exchange_rate" numeric(18, 8) NOT NULL,
        "last_updated" timestamp DEFAULT now(),
        "data_source" varchar DEFAULT 'exchangerate-api'
);
--> statement-breakpoint
CREATE TABLE "customer_care_agents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "full_name" varchar NOT NULL,
        "email" varchar NOT NULL,
        "phone" varchar,
        "employee_id" varchar,
        "euin_number" varchar,
        "arn_code" varchar,
        "distributor_id" varchar,
        "distributor_name" varchar,
        "password" text,
        "specializations" text[] DEFAULT '{}',
        "languages" text[] DEFAULT '{"en"}',
        "product_types" text[] DEFAULT '{}',
        "regulatory_category" varchar DEFAULT 'loan_dsa',
        "master_agent_id" varchar,
        "agent_level" varchar DEFAULT 'master',
        "hierarchy_path" varchar,
        "arn_verification_status" varchar DEFAULT 'pending',
        "euin_verification_status" varchar DEFAULT 'pending',
        "amfi_verified_at" timestamp,
        "amfi_verification_response" jsonb,
        "arn_expiry_date" timestamp,
        "commission_split_model" varchar DEFAULT 'standard',
        "default_commission_share" numeric(5, 2) DEFAULT '100.00',
        "master_agent_share" numeric(5, 2) DEFAULT '0.00',
        "onboarding_status" varchar DEFAULT 'pending',
        "verified_by" varchar,
        "verified_at" timestamp,
        "rejection_reason" text,
        "pan_number" varchar(10),
        "pan_name" varchar,
        "aadhar_number" varchar(12),
        "aadhar_name" varchar,
        "bank_account_number" varchar,
        "bank_ifsc_code" varchar,
        "bank_name" varchar,
        "bank_branch" varchar,
        "account_holder_name" varchar,
        "pan_verified" boolean DEFAULT false,
        "aadhar_verified" boolean DEFAULT false,
        "bank_account_verified" boolean DEFAULT false,
        "amfi_certificate_verified" boolean DEFAULT false,
        "euin_card_verified" boolean DEFAULT false,
        "status" varchar DEFAULT 'active',
        "is_default" boolean DEFAULT false,
        "max_tickets_per_day" integer DEFAULT 50,
        "current_ticket_count" integer DEFAULT 0,
        "total_tickets_handled" integer DEFAULT 0,
        "average_resolution_time" numeric(8, 2),
        "customer_satisfaction_rating" numeric(3, 2),
        "total_clients_assigned" integer DEFAULT 0,
        "active_clients_count" integer DEFAULT 0,
        "total_commissions_earned" numeric(15, 2) DEFAULT '0.00',
        "total_commissions_paid" numeric(15, 2) DEFAULT '0.00',
        "pending_commissions" numeric(15, 2) DEFAULT '0.00',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "customer_care_agents_email_unique" UNIQUE("email"),
        CONSTRAINT "customer_care_agents_employee_id_unique" UNIQUE("employee_id"),
        CONSTRAINT "customer_care_agents_euin_number_unique" UNIQUE("euin_number")
);
--> statement-breakpoint
CREATE TABLE "data_source_consents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "data_source" varchar NOT NULL,
        "provider" varchar,
        "consent_given" boolean NOT NULL,
        "consent_purpose" text NOT NULL,
        "consent_text" text NOT NULL,
        "ip_address" varchar,
        "user_agent" text,
        "consented_at" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL,
        "revoked_at" timestamp,
        "revoke_reason" text,
        "is_active" boolean DEFAULT true,
        "last_synced_at" timestamp,
        "next_sync_due" timestamp,
        "sync_frequency" varchar DEFAULT 'weekly',
        "deletion_warning_sent_at" timestamp,
        "consent_version" varchar DEFAULT 'v1.0',
        "regulatory_compliance" jsonb
);
--> statement-breakpoint
CREATE TABLE "digilocker_apps" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "app_name" varchar NOT NULL,
        "app_id" varchar NOT NULL,
        "api_key" varchar NOT NULL,
        "org_id" varchar NOT NULL,
        "domain" varchar NOT NULL,
        "environment" varchar DEFAULT 'development',
        "document_types_allowed" text[] DEFAULT ARRAY['issued', 'uploaded'],
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW(),
        CONSTRAINT "digilocker_apps_app_id_unique" UNIQUE("app_id")
);
--> statement-breakpoint
CREATE TABLE "digilocker_kyc_mappings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "digilocker_doc_id" varchar,
        "kyc_field_name" varchar NOT NULL,
        "verification_status" varchar DEFAULT 'pending',
        "verified_at" timestamp,
        "verified_by" varchar,
        "auto_populated" boolean DEFAULT false,
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "digilocker_shared_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "app_id" varchar NOT NULL,
        "document_uri" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "source" varchar,
        "transaction_id" varchar NOT NULL,
        "filename" varchar,
        "content_type" varchar,
        "shared_till" date,
        "document_content" text,
        "sharing_status" varchar DEFAULT 'shared',
        "shared_at" timestamp DEFAULT NOW(),
        "fetched_at" timestamp,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "digilocker_user_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "app_id" varchar NOT NULL,
        "session_token" varchar NOT NULL,
        "login_timestamp" timestamp NOT NULL,
        "callback_url" varchar,
        "widget_id" varchar,
        "session_status" varchar DEFAULT 'active',
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT NOW(),
        "updated_at" timestamp DEFAULT NOW()
);
--> statement-breakpoint
CREATE TABLE "epf_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "epf_account_number" varchar NOT NULL,
        "employer_name" text NOT NULL,
        "member_name" text NOT NULL,
        "employee_contribution" numeric(15, 2),
        "employer_contribution" numeric(15, 2),
        "pension_contribution" numeric(15, 2),
        "total_balance" numeric(15, 2),
        "interest_earned" numeric(15, 2),
        "interest_rate" numeric(5, 2),
        "date_of_joining" date,
        "date_of_exit" date,
        "is_active" boolean DEFAULT true,
        "nominee_name" text,
        "nominee_relationship" varchar,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "eps_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "epf_account_number" varchar NOT NULL,
        "pension_account_number" varchar NOT NULL,
        "employer_code" varchar NOT NULL,
        "current_employer" text NOT NULL,
        "service_start_date" date NOT NULL,
        "total_service_years" integer DEFAULT 0 NOT NULL,
        "total_service_months" integer DEFAULT 0 NOT NULL,
        "current_salary" numeric(15, 2) DEFAULT '0' NOT NULL,
        "pensionable_wage" numeric(15, 2) DEFAULT '0' NOT NULL,
        "contribution_rate" numeric(5, 2) DEFAULT '8.33' NOT NULL,
        "monthly_pension_contribution" numeric(15, 2) DEFAULT '0' NOT NULL,
        "total_contribution" numeric(15, 2) DEFAULT '0' NOT NULL,
        "accumulated_pension" numeric(15, 2) DEFAULT '0' NOT NULL,
        "estimated_monthly_pension" numeric(15, 2) DEFAULT '0' NOT NULL,
        "min_vesting_period" integer DEFAULT 10 NOT NULL,
        "is_vested" boolean DEFAULT false NOT NULL,
        "eligible_for_pension" boolean DEFAULT false NOT NULL,
        "expected_retirement_date" date,
        "scheme_type" varchar DEFAULT 'eps95' NOT NULL,
        "certificate_number" varchar,
        "nominee_name" text,
        "nominee_relationship" varchar,
        "nominee_share" numeric(5, 2) DEFAULT '100' NOT NULL,
        "status" varchar DEFAULT 'active' NOT NULL,
        "last_pension_calculation_date" date,
        "remarks" text,
        "apy_enrolled" boolean DEFAULT false NOT NULL,
        "apy_account_number" varchar,
        "apy_pension_amount" numeric(15, 2),
        "apy_monthly_contribution" numeric(15, 2),
        "apy_start_date" date,
        "apy_maturity_age" integer DEFAULT 60,
        "apy_current_age" integer,
        "apy_total_contribution" numeric(15, 2) DEFAULT '0',
        "apy_government_contribution" numeric(15, 2) DEFAULT '0',
        "apy_status" varchar DEFAULT 'active',
        "apy_bank_name" text,
        "apy_branch_code" varchar,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        "last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_insights" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "insight_type" varchar NOT NULL,
        "category" varchar,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "ai_analysis" jsonb NOT NULL,
        "recommendations" jsonb,
        "potential_savings" numeric(15, 2),
        "priority" varchar DEFAULT 'medium',
        "status" varchar DEFAULT 'new',
        "valid_from" timestamp DEFAULT now(),
        "valid_until" timestamp,
        "user_feedback" varchar,
        "feedback_notes" text,
        "created_at" timestamp DEFAULT now(),
        "dismissed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "external_data_sources" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "source_name" varchar NOT NULL,
        "source_type" varchar NOT NULL,
        "provider" varchar NOT NULL,
        "api_endpoint" varchar,
        "is_active" boolean DEFAULT true,
        "rate_limit_per_hour" integer,
        "cost_per_call" numeric(10, 4),
        "data_retention_days" integer DEFAULT 365,
        "last_used" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_activity_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "family_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "activity_type" varchar NOT NULL,
        "entity_type" varchar,
        "entity_id" varchar,
        "action" text NOT NULL,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_budgets" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "family_id" varchar NOT NULL,
        "budget_name" text NOT NULL,
        "category" varchar NOT NULL,
        "monthly_limit" numeric(15, 2) NOT NULL,
        "current_spend" numeric(15, 2) DEFAULT '0',
        "period" varchar DEFAULT 'monthly',
        "start_date" date NOT NULL,
        "end_date" date,
        "alert_threshold" numeric(5, 2) DEFAULT '80',
        "created_by" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_discussions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "family_id" varchar NOT NULL,
        "topic_type" varchar NOT NULL,
        "topic_id" varchar,
        "subject" text NOT NULL,
        "author_id" varchar NOT NULL,
        "content" text NOT NULL,
        "parent_message_id" varchar,
        "attachments" jsonb,
        "is_resolved" boolean DEFAULT false,
        "is_pinned" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_goal_contributions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "goal_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "amount" numeric(15, 2) NOT NULL,
        "contribution_date" timestamp DEFAULT now(),
        "note" text,
        "contribution_type" varchar DEFAULT 'manual'
);
--> statement-breakpoint
CREATE TABLE "family_goals" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "family_id" varchar NOT NULL,
        "goal_name" text NOT NULL,
        "goal_type" varchar NOT NULL,
        "target_amount" numeric(15, 2) NOT NULL,
        "current_amount" numeric(15, 2) DEFAULT '0',
        "target_date" date,
        "priority" varchar DEFAULT 'medium',
        "status" varchar DEFAULT 'active',
        "is_shared" boolean DEFAULT true,
        "owner_id" varchar,
        "description" text,
        "created_at" timestamp DEFAULT now(),
        "completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "family_groups" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "created_by" varchar NOT NULL,
        "group_type" varchar DEFAULT 'family',
        "description" text,
        "settings" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "family_members" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "family_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "role" varchar DEFAULT 'member',
        "display_name" varchar,
        "invitation_status" varchar DEFAULT 'pending',
        "invited_by" varchar,
        "invited_at" timestamp DEFAULT now(),
        "joined_at" timestamp,
        "left_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "family_portfolio_permissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "family_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "permission_level" varchar DEFAULT 'view',
        "can_view_transactions" boolean DEFAULT true,
        "can_add_funds" boolean DEFAULT false,
        "can_trade" boolean DEFAULT false,
        "can_withdraw" boolean DEFAULT false,
        "granted_at" timestamp DEFAULT now(),
        "granted_by" varchar
);
--> statement-breakpoint
CREATE TABLE "filing_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "acknowledgment_number" varchar,
        "receipt_number" varchar,
        "filing_date" timestamp NOT NULL,
        "itr_form" varchar NOT NULL,
        "tax_regime" varchar NOT NULL,
        "total_income" numeric(15, 2),
        "tax_liability" numeric(15, 2),
        "refund_amount" numeric(15, 2),
        "tax_payable" numeric(15, 2),
        "status" varchar DEFAULT 'filed' NOT NULL,
        "verification_date" timestamp,
        "itr_json_url" text,
        "itr_pdf_url" text,
        "itr_v_url" text,
        "processing_errors" jsonb DEFAULT '[]'::jsonb,
        "api_response" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "filing_records_acknowledgment_number_unique" UNIQUE("acknowledgment_number")
);
--> statement-breakpoint
CREATE TABLE "financial_goals" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "goal_type" varchar NOT NULL,
        "category" varchar NOT NULL,
        "target_amount" numeric(15, 2) NOT NULL,
        "current_amount" numeric(15, 2) DEFAULT '0',
        "monthly_contribution" numeric(10, 2) DEFAULT '0',
        "target_date" timestamp NOT NULL,
        "risk_profile" varchar NOT NULL,
        "priority" varchar DEFAULT 'medium',
        "investment_strategy" varchar DEFAULT 'sip',
        "recommended_monthly_contribution" numeric(10, 2) DEFAULT '0',
        "recommended_investments" text[],
        "current_progress" numeric(5, 2) DEFAULT '0',
        "is_active" boolean DEFAULT true,
        "tags" text[],
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fund_comparisons" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "fund_codes" jsonb NOT NULL,
        "comparison_type" varchar DEFAULT 'detailed',
        "time_period" varchar DEFAULT '1Y',
        "results" jsonb,
        "returns" jsonb,
        "risk_metrics" jsonb,
        "expense_analysis" jsonb,
        "performance_ranking" jsonb,
        "best_performer" varchar,
        "recommendation" text,
        "risk_level" varchar,
        "requested_at" timestamp DEFAULT now(),
        "status" varchar DEFAULT 'completed',
        "error_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "generated_reports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "report_type" varchar NOT NULL,
        "report_format" varchar NOT NULL,
        "report_status" varchar DEFAULT 'pending' NOT NULL,
        "date_from" date,
        "date_to" date,
        "transaction_types" jsonb,
        "filters" jsonb,
        "report_title" varchar,
        "total_transactions" integer DEFAULT 0,
        "total_amount" numeric(15, 2) DEFAULT '0',
        "file_url" text,
        "file_size" integer,
        "file_name" varchar,
        "generated_at" timestamp,
        "expires_at" timestamp,
        "error_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goal_contributions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "goal_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "amount" numeric(15, 2) NOT NULL,
        "contribution_date" date NOT NULL,
        "contribution_type" varchar DEFAULT 'manual' NOT NULL,
        "notes" text,
        "source" varchar,
        "transaction_id" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "government_scheme_consents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "pan_number" varchar NOT NULL,
        "scheme_type" varchar NOT NULL,
        "consent_granted" boolean DEFAULT false,
        "consent_date" timestamp,
        "consent_expiry_date" timestamp,
        "purpose" text,
        "ip_address" varchar,
        "user_agent" text,
        "is_active" boolean DEFAULT true,
        "revoked_at" timestamp,
        "revoked_reason" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "government_securities" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "isin" varchar NOT NULL,
        "security_name" text NOT NULL,
        "security_type" varchar NOT NULL,
        "issuer" varchar NOT NULL,
        "auction_date" date,
        "auction_number" varchar,
        "notified_amount" numeric(15, 2),
        "ncb_reserved_amount" numeric(15, 2),
        "face_value" numeric(15, 2) DEFAULT '100',
        "coupon_rate" numeric(8, 4),
        "issue_date" date,
        "maturity_date" date NOT NULL,
        "tenor_years" numeric(5, 2),
        "issue_price" numeric(15, 4),
        "current_price" numeric(15, 4),
        "yield_to_maturity" numeric(8, 4),
        "trading_status" varchar DEFAULT 'active',
        "minimum_investment" numeric(15, 2) DEFAULT '10000',
        "duration" numeric(8, 4),
        "modified_duration" numeric(8, 4),
        "credit_rating" varchar DEFAULT 'AAA',
        "gold_reference_price" numeric(15, 2),
        "gold_weight" numeric(10, 4),
        "max_investment_limit" numeric(15, 2),
        "early_redemption_allowed" boolean DEFAULT false,
        "early_redemption_period" varchar,
        "tax_status" varchar DEFAULT 'taxable',
        "tax_benefit_section" varchar,
        "tax_benefit_details" text,
        "indexation_benefit" boolean DEFAULT false,
        "infrastructure_sector" varchar,
        "project_name" text,
        "utilization_purpose" text,
        "special_features" jsonb DEFAULT '[]'::jsonb,
        "eligibility_criteria" text,
        "lockin_period" varchar,
        "markup" numeric(8, 4) DEFAULT '0',
        "markup_type" varchar DEFAULT 'percentage',
        "final_price" numeric(15, 4),
        "is_perpetual" boolean DEFAULT false,
        "data_source" varchar DEFAULT 'nse_ncb',
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "government_securities_isin_unique" UNIQUE("isin")
);
--> statement-breakpoint
CREATE TABLE "ib_account_summary" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ib_account_id" varchar NOT NULL,
        "account" varchar NOT NULL,
        "tag" varchar NOT NULL,
        "value" varchar NOT NULL,
        "currency" varchar NOT NULL,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ib_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "account_name" varchar NOT NULL,
        "account_number" varchar NOT NULL,
        "is_paper_trading" boolean DEFAULT true,
        "host" varchar DEFAULT '127.0.0.1',
        "port" integer DEFAULT 7497,
        "client_id" integer DEFAULT 1,
        "is_active" boolean DEFAULT true,
        "connection_status" varchar DEFAULT 'disconnected',
        "last_connected" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ib_market_data_subscriptions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ib_account_id" varchar NOT NULL,
        "symbol" varchar NOT NULL,
        "ticker_id" integer NOT NULL,
        "is_active" boolean DEFAULT true,
        "last_price" numeric(15, 4),
        "bid" numeric(15, 4),
        "ask" numeric(15, 4),
        "volume" numeric(20, 0),
        "market_data_snapshot" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ib_orders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ib_account_id" varchar NOT NULL,
        "order_id" integer NOT NULL,
        "client_id" integer NOT NULL,
        "symbol" varchar NOT NULL,
        "action" varchar NOT NULL,
        "order_type" varchar NOT NULL,
        "total_quantity" numeric(15, 4) NOT NULL,
        "limit_price" numeric(15, 4),
        "stop_price" numeric(15, 4),
        "status" varchar NOT NULL,
        "filled" numeric(15, 4) DEFAULT '0',
        "remaining" numeric(15, 4),
        "avg_fill_price" numeric(15, 4) DEFAULT '0',
        "commission" numeric(15, 4),
        "why_held" varchar,
        "order_data" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ib_positions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ib_account_id" varchar NOT NULL,
        "account" varchar NOT NULL,
        "symbol" varchar NOT NULL,
        "position" numeric(15, 4) NOT NULL,
        "market_price" numeric(15, 4),
        "market_value" numeric(15, 2),
        "average_cost" numeric(15, 4),
        "unrealized_pnl" numeric(15, 2),
        "realized_pnl" numeric(15, 2),
        "position_data" jsonb,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ib_trading_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ib_account_id" varchar NOT NULL,
        "session_start" timestamp NOT NULL,
        "session_end" timestamp,
        "connection_duration" integer,
        "orders_placed" integer DEFAULT 0,
        "orders_filled" integer DEFAULT 0,
        "orders_cancelled" integer DEFAULT 0,
        "total_pnl" numeric(15, 2),
        "status" varchar DEFAULT 'active',
        "disconnect_reason" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "icici_bank_credit_scores" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "cibil_score" integer,
        "score_date" timestamp,
        "factors" jsonb DEFAULT '[]'::jsonb,
        "recommendations" jsonb DEFAULT '[]'::jsonb,
        "requested_at" timestamp DEFAULT now(),
        "pan_number" varchar,
        "mobile_number" varchar,
        "status" varchar DEFAULT 'pending',
        "error_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "icici_bank_loan_applications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "application_id" varchar,
        "loan_type" varchar NOT NULL,
        "status" varchar DEFAULT 'submitted',
        "requested_amount" numeric(15, 2) NOT NULL,
        "sanctioned_amount" numeric(15, 2),
        "interest_rate" numeric(5, 2),
        "tenure" integer,
        "emi" numeric(15, 2),
        "processing_fee" numeric(15, 2),
        "applicant_details" jsonb NOT NULL,
        "address_details" jsonb NOT NULL,
        "employment_details" jsonb NOT NULL,
        "banking_details" jsonb NOT NULL,
        "loan_details" jsonb NOT NULL,
        "documents" jsonb DEFAULT '[]'::jsonb,
        "cibil_consent" boolean DEFAULT false,
        "terms_accepted" boolean DEFAULT false,
        "status_history" jsonb DEFAULT '[]'::jsonb,
        "application_date" timestamp DEFAULT now(),
        "expected_decision_date" timestamp,
        "decision_date" timestamp,
        "disbursement_date" timestamp,
        "next_steps" jsonb DEFAULT '[]'::jsonb,
        "documents_required" jsonb DEFAULT '[]'::jsonb,
        "remarks" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "icici_bank_loan_applications_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "insurance_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "policy_number" varchar NOT NULL,
        "policy_name" varchar NOT NULL,
        "insurance_company" varchar NOT NULL,
        "policy_type" varchar NOT NULL,
        "category" varchar NOT NULL,
        "sum_assured" numeric(15, 2) NOT NULL,
        "premium_amount" numeric(15, 2) NOT NULL,
        "premium_frequency" varchar DEFAULT 'yearly',
        "fund_value" numeric(15, 2),
        "policy_start_date" date NOT NULL,
        "policy_maturity_date" date,
        "premium_due_date" date,
        "last_premium_paid_date" date,
        "depository_name" varchar NOT NULL,
        "depository_account_number" varchar,
        "isin_number" varchar,
        "policy_status" varchar DEFAULT 'active',
        "paid_up_value" numeric(15, 2),
        "surrender_value" numeric(15, 2),
        "nominee_details" text,
        "nominee_relation" varchar,
        "agent_code" varchar,
        "branch_code" varchar,
        "servicing_branch" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "integration_health" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider" varchar NOT NULL,
        "display_name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "status" varchar DEFAULT 'active',
        "last_checked_at" timestamp,
        "uptime" numeric(5, 2) DEFAULT '100',
        "avg_response_time" integer,
        "error_rate" numeric(5, 2) DEFAULT '0',
        "total_requests_24h" integer DEFAULT 0,
        "successful_requests_24h" integer DEFAULT 0,
        "failed_requests_24h" integer DEFAULT 0,
        "is_enabled" boolean DEFAULT true,
        "has_api_key" boolean DEFAULT false,
        "has_webhook" boolean DEFAULT false,
        "webhook_url" varchar,
        "alerts_enabled" boolean DEFAULT true,
        "alert_threshold" integer DEFAULT 90,
        "last_alert_sent" timestamp,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "integration_health_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "investment_idea_alerts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "idea_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "alert_type" varchar NOT NULL,
        "alert_message" text NOT NULL,
        "trigger_price" numeric(10, 2),
        "actual_price" numeric(10, 2),
        "severity" varchar DEFAULT 'medium',
        "is_read" boolean DEFAULT false,
        "is_actionable" boolean DEFAULT false,
        "triggered_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "investment_idea_tracking" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "idea_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "tracking_date" timestamp NOT NULL,
        "open_price" numeric(10, 2),
        "close_price" numeric(10, 2) NOT NULL,
        "high_price" numeric(10, 2),
        "low_price" numeric(10, 2),
        "volume" bigint,
        "daily_return" numeric(8, 4),
        "cumulative_return" numeric(8, 4),
        "unrealized_pnl" numeric(12, 2),
        "rsi" numeric(5, 2),
        "macd" numeric(8, 4),
        "macd_signal" numeric(8, 4),
        "sma_20" numeric(10, 2),
        "sma_50" numeric(10, 2),
        "ema_12" numeric(10, 2),
        "ema_26" numeric(10, 2),
        "volatility" numeric(8, 4),
        "beta" numeric(6, 4),
        "events" jsonb,
        "notes" text,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "investment_ideas" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "symbol" varchar NOT NULL,
        "company_name" varchar NOT NULL,
        "idea_title" varchar NOT NULL,
        "idea_description" text NOT NULL,
        "entry_price" numeric(10, 2) NOT NULL,
        "current_price" numeric(10, 2),
        "target_price" numeric(10, 2) NOT NULL,
        "stop_loss" numeric(10, 2) NOT NULL,
        "recommended_quantity" integer,
        "actual_quantity" integer DEFAULT 0,
        "recommended_investment" numeric(12, 2),
        "actual_investment" numeric(12, 2) DEFAULT '0',
        "risk_level" varchar NOT NULL,
        "time_horizon" varchar NOT NULL,
        "sector" varchar,
        "market_cap" varchar,
        "technical_indicators" jsonb,
        "support_level" numeric(10, 2),
        "resistance_level" numeric(10, 2),
        "ai_confidence_score" numeric(3, 2),
        "ai_reasoning" text,
        "catalysts" jsonb,
        "risks" jsonb,
        "status" varchar DEFAULT 'suggested',
        "is_active" boolean DEFAULT true,
        "suggested_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "entered_at" timestamp,
        "exited_at" timestamp,
        "current_return" numeric(8, 4),
        "realized_return" numeric(8, 4),
        "max_drawdown" numeric(8, 4),
        "days_held" integer DEFAULT 0,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "investment_proposal_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "proposal_id" varchar NOT NULL,
        "product_type" varchar NOT NULL,
        "product_code" varchar NOT NULL,
        "product_name" varchar NOT NULL,
        "amc" varchar,
        "category" varchar,
        "sub_category" varchar,
        "recommended_amount" numeric(15, 2) NOT NULL,
        "allocation_percentage" numeric(5, 2) NOT NULL,
        "investment_type" varchar,
        "sip_amount" numeric(10, 2),
        "sip_frequency" varchar,
        "sip_duration_months" integer,
        "nav" numeric(10, 4),
        "one_year_returns" numeric(5, 2),
        "three_year_returns" numeric(5, 2),
        "five_year_returns" numeric(5, 2),
        "expense_ratio" numeric(5, 2),
        "exit_load" numeric(5, 2),
        "risk_rating" varchar,
        "volatility" numeric(5, 2),
        "beta" numeric(5, 4),
        "sharpe_ratio" numeric(5, 4),
        "selection_reason" text NOT NULL,
        "expected_outcome" text,
        "suitability_score" integer,
        "is_executed" boolean DEFAULT false,
        "executed_amount" numeric(15, 2),
        "executed_at" timestamp,
        "transaction_id" varchar,
        "folio_number" varchar,
        "is_added_to_cart" boolean DEFAULT false,
        "cart_item_id" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "investment_proposals" (
        "id" varchar PRIMARY KEY NOT NULL,
        "client_id" varchar NOT NULL,
        "agent_id" varchar,
        "portfolio_id" varchar,
        "proposal_source" varchar DEFAULT 'agent' NOT NULL,
        "ai_model_version" varchar,
        "ai_confidence_score" numeric(5, 2),
        "title" varchar NOT NULL,
        "description" text NOT NULL,
        "analysis_rationale" text,
        "current_allocation" jsonb,
        "target_allocation" jsonb,
        "recommendations" jsonb NOT NULL,
        "total_investment_amount" numeric(15, 2) NOT NULL,
        "risk_profile" varchar,
        "time_horizon" varchar,
        "expected_returns" numeric(5, 2),
        "expected_risk" varchar,
        "projected_value" numeric(15, 2),
        "status" varchar DEFAULT 'pending',
        "client_response" text,
        "approved_at" timestamp,
        "rejected_at" timestamp,
        "executed_at" timestamp,
        "added_to_cart_at" timestamp,
        "cart_item_id" varchar,
        "payment_method" varchar,
        "payment_status" varchar,
        "payment_id" varchar,
        "execution_status" varchar,
        "execution_details" jsonb,
        "priority" varchar DEFAULT 'medium',
        "valid_until" timestamp,
        "reminders_sent" integer DEFAULT 0,
        "last_reminder_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ipo_applications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ipo_id" varchar NOT NULL,
        "application_amount" numeric(15, 2) NOT NULL,
        "bid_price" numeric(10, 2) NOT NULL,
        "quantity" integer NOT NULL,
        "category" varchar NOT NULL,
        "application_status" varchar DEFAULT 'applied' NOT NULL,
        "allotment_quantity" integer,
        "allotment_amount" numeric(15, 2),
        "application_date" timestamp DEFAULT now(),
        "allotment_date" timestamp,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ipo_companies" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_name" text NOT NULL,
        "sector" varchar NOT NULL,
        "industry" varchar NOT NULL,
        "logo_url" text,
        "ipo_type" varchar NOT NULL,
        "issue_type" varchar,
        "price_band_min" numeric(10, 2),
        "price_band_max" numeric(10, 2),
        "issue_size" numeric(15, 2),
        "open_date" date,
        "close_date" date,
        "listing_date" date,
        "status" varchar DEFAULT 'upcoming' NOT NULL,
        "subscription_status" numeric(8, 2),
        "listing_price" numeric(10, 2),
        "listing_gain_percent" numeric(8, 4),
        "current_price" numeric(10, 2),
        "current_return_percent" numeric(8, 4),
        "rhp_url" text,
        "drhp_url" text,
        "description" text,
        "market_cap" numeric(20, 2),
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ipo_news" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "summary" text,
        "content" text,
        "category" varchar NOT NULL,
        "ipo_id" varchar,
        "source_url" text,
        "published_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "itr_data_sources_sync" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "itr_form_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "data_source" varchar NOT NULL,
        "sync_status" varchar DEFAULT 'pending',
        "records_processed" integer DEFAULT 0,
        "records_successful" integer DEFAULT 0,
        "records_failed" integer DEFAULT 0,
        "data_categories" jsonb,
        "synced_data" jsonb,
        "error_details" jsonb,
        "sync_started_at" timestamp,
        "sync_completed_at" timestamp,
        "next_sync_scheduled" timestamp,
        "api_response" jsonb,
        "sync_trigger" varchar DEFAULT 'manual',
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "itr_prefilled_forms" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "assessment_year" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "itr_form" varchar NOT NULL,
        "auto_selected_form" boolean DEFAULT true,
        "form_selection_reason" text,
        "tax_regime" varchar DEFAULT 'new',
        "form_26as_integrated" boolean DEFAULT false,
        "ais_integrated" boolean DEFAULT false,
        "cams_integrated" boolean DEFAULT false,
        "kfintech_integrated" boolean DEFAULT false,
        "nsdl_integrated" boolean DEFAULT false,
        "cdsl_integrated" boolean DEFAULT false,
        "form_16_integrated" boolean DEFAULT false,
        "personal_info" jsonb,
        "income_from_salary" jsonb,
        "income_from_house_property" jsonb,
        "income_from_capital_gains" jsonb,
        "income_from_other_sources" jsonb,
        "income_from_business_profession" jsonb,
        "deductions_chapter_6a" jsonb,
        "tax_computation" jsonb,
        "tds_details" jsonb,
        "advance_tax_details" jsonb,
        "schedule_cg" jsonb,
        "schedule_os" jsonb,
        "schedule_vda" jsonb,
        "schedule_fsi" jsonb,
        "completion_percentage" integer DEFAULT 0,
        "validation_status" varchar DEFAULT 'pending',
        "validation_errors" jsonb DEFAULT '[]'::jsonb,
        "data_conflicts" jsonb DEFAULT '[]'::jsonb,
        "tax_optimization_suggestions" jsonb,
        "missing_data_alerts" jsonb,
        "compliance_warnings" jsonb,
        "ready_for_filing" boolean DEFAULT false,
        "filing_status" varchar DEFAULT 'draft',
        "filed_at" timestamp,
        "acknowledgment_number" varchar,
        "itr_json_generated" boolean DEFAULT false,
        "itr_json_data" jsonb,
        "itr_pdf_url" text,
        "xml_upload_ready" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "last_data_sync" timestamp
);
--> statement-breakpoint
CREATE TABLE "kra_status_checks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "status" varchar NOT NULL,
        "kra_number" varchar,
        "protean_reference_id" varchar,
        "verification_date" timestamp,
        "kra_agency" varchar,
        "next_poll_at" timestamp,
        "poll_attempt" integer DEFAULT 0,
        "max_poll_attempts" integer DEFAULT 48,
        "finalized_at" timestamp,
        "response_payload" jsonb,
        "reason_code" varchar,
        "reason_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_audit_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "accessed_by" varchar,
        "access_type" varchar NOT NULL,
        "data_fields_accessed" jsonb,
        "purpose" text NOT NULL,
        "api_endpoint" varchar,
        "external_party" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "request_id" varchar,
        "access_status" varchar DEFAULT 'success',
        "failure_reason" text,
        "regulatory_purpose" varchar,
        "compliance_check_passed" boolean DEFAULT true,
        "accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_consent_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "consent_type" varchar NOT NULL,
        "consent_given" boolean NOT NULL,
        "consent_text" text NOT NULL,
        "purpose" text,
        "third_party_name" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "consent_signature" text,
        "consented_at" timestamp DEFAULT now(),
        "expires_at" timestamp,
        "revoked_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "kyc_form_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ckyc_record_id" varchar,
        "current_step" integer DEFAULT 1,
        "completed_steps" jsonb DEFAULT '[]'::jsonb,
        "completion_percentage" integer DEFAULT 0,
        "personal_details_data" jsonb,
        "address_details_data" jsonb,
        "bank_details_data" jsonb,
        "document_details_data" jsonb,
        "pan_data_source" varchar,
        "aadhar_data_source" varchar,
        "address_data_source" varchar,
        "auto_populated_fields" jsonb,
        "can_resume" boolean DEFAULT true,
        "last_saved_at" timestamp DEFAULT now(),
        "resume_url" varchar,
        "is_completed" boolean DEFAULT false,
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "kyc_form_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_reuse_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "token_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "encrypted_jwt_payload" text NOT NULL,
        "jwt_signature" text NOT NULL,
        "token_purpose" varchar,
        "issued_to" varchar,
        "scope" jsonb,
        "is_active" boolean DEFAULT true,
        "is_revoked" boolean DEFAULT false,
        "revoked_at" timestamp,
        "revoke_reason" text,
        "usage_count" integer DEFAULT 0,
        "max_usage_limit" integer,
        "last_used_at" timestamp,
        "issued_at" timestamp DEFAULT now(),
        "expires_at" timestamp NOT NULL,
        CONSTRAINT "kyc_reuse_tokens_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_state_transitions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "from_state" varchar NOT NULL,
        "to_state" varchar NOT NULL,
        "trigger" varchar NOT NULL,
        "performed_by" varchar,
        "performed_by_role" varchar,
        "metadata" jsonb,
        "ip_address" varchar,
        "user_agent" text,
        "occurred_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_tier_upgrade_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "session_id" varchar,
        "from_tier" "kyc_tier",
        "to_tier" "kyc_tier" NOT NULL,
        "triggered_by" varchar DEFAULT 'user',
        "triggered_by_user_id" varchar,
        "reason" text,
        "status" varchar DEFAULT 'pending',
        "completed_at" timestamp,
        "failure_reason" text,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_token_map" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "token" varchar NOT NULL,
        "encrypted_original_value" text NOT NULL,
        "field_type" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "expires_at" timestamp,
        CONSTRAINT "kyc_token_map_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "kyc_vault" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "encrypted_full_name" text,
        "encrypted_date_of_birth" text,
        "encrypted_gender" text,
        "encrypted_father_name" text,
        "encrypted_address" text,
        "encrypted_city" text,
        "encrypted_state" text,
        "encrypted_pincode" text,
        "encrypted_mobile" text,
        "encrypted_email" text,
        "tokenized_pan" varchar,
        "tokenized_aadhaar" varchar,
        "tokenized_ckyc_kin" varchar,
        "aadhaar_last_4" varchar(4),
        "face_image_hash" varchar,
        "face_image_hash_algorithm" varchar DEFAULT 'SHA-256',
        "kyc_status" varchar DEFAULT 'pending',
        "ckyc_status" varchar DEFAULT 'not_checked',
        "source" varchar NOT NULL,
        "verification_method" varchar,
        "is_reusable" boolean DEFAULT false,
        "encrypted_ckyc_kin" text,
        "ckyc_registration_date" timestamp,
        "ckyc_expiry_date" timestamp,
        "ckyc_verification_level" varchar,
        "cashfree_ref_id" varchar,
        "aadhaar_verified_at" timestamp,
        "pan_verified_at" timestamp,
        "address_verified_at" timestamp,
        "kyc_verified_at" timestamp DEFAULT now(),
        "kyc_expiry_date" timestamp,
        "kyc_next_renewal_date" timestamp,
        "is_expired" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "kyc_vault_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_verification_attempts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "workflow_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "verification_method" varchar NOT NULL,
        "provider" varchar,
        "request_payload_hash" varchar,
        "response_payload_hash" varchar,
        "correlation_id" varchar NOT NULL,
        "outcome" varchar NOT NULL,
        "response_code" varchar,
        "error_details" jsonb,
        "data_completeness" integer,
        "data_freshness" timestamp,
        "verification_score" integer,
        "latency_ms" integer,
        "retry_count" integer DEFAULT 0,
        "compliance_flags" jsonb,
        "regulatory_notes" text,
        "attempted_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "metadata" jsonb,
        CONSTRAINT "kyc_verification_attempts_correlation_id_unique" UNIQUE("correlation_id")
);
--> statement-breakpoint
CREATE TABLE "kyc_verification_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "session_type" varchar DEFAULT 'smart_kyc_wizard',
        "current_step" varchar DEFAULT 'pan_verification' NOT NULL,
        "step_status" jsonb DEFAULT '{}'::jsonb,
        "session_outcome" varchar,
        "pan_number" varchar,
        "pan_dob" date,
        "pan_verified" boolean DEFAULT false,
        "pan_verification_data" jsonb,
        "pan_verified_at" timestamp,
        "aadhaar_number" varchar,
        "aadhaar_otp_sent" boolean DEFAULT false,
        "aadhaar_otp_sent_at" timestamp,
        "aadhaar_otp_verified" boolean DEFAULT false,
        "aadhaar_verified_at" timestamp,
        "aadhaar_verification_data" jsonb,
        "ip_address" varchar,
        "user_agent" text,
        "started_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "is_active" boolean DEFAULT true,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kyc_workflows" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "status" varchar DEFAULT 'initiated' NOT NULL,
        "current_method" varchar,
        "successful_method" varchar,
        "ckyc_kin_number" varchar,
        "kra_verification_number" varchar,
        "video_kyc_session_id" varchar,
        "attempted_methods" jsonb DEFAULT '[]'::jsonb,
        "step_timestamps" jsonb,
        "verified_data" jsonb,
        "data_source" varchar,
        "verification_level" varchar DEFAULT 'basic',
        "error_message" text,
        "failed_at_method" varchar,
        "pan_number" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "initiated_at" timestamp DEFAULT now(),
        "verified_at" timestamp,
        "completed_at" timestamp,
        "lock_token" varchar,
        "locked_at" timestamp,
        "lock_expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "lead_activities" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "lead_id" varchar NOT NULL,
        "activity_type" varchar NOT NULL,
        "subject" varchar,
        "description" text,
        "outcome" varchar,
        "next_action" varchar,
        "next_action_date" timestamp,
        "performed_by" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_lessons" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "module_id" varchar NOT NULL,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "content_type" varchar NOT NULL,
        "order_index" integer DEFAULT 0 NOT NULL,
        "estimated_minutes" integer DEFAULT 10,
        "points_reward" integer DEFAULT 50,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_modules" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "difficulty" varchar NOT NULL,
        "category" varchar NOT NULL,
        "order_index" integer DEFAULT 0 NOT NULL,
        "estimated_minutes" integer DEFAULT 30,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "category" varchar(100) NOT NULL,
        "action" varchar(100) NOT NULL,
        "value" numeric(15, 2),
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_quizzes" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "lesson_id" varchar NOT NULL,
        "question" text NOT NULL,
        "options" text[] NOT NULL,
        "correct_answer" integer NOT NULL,
        "explanation" text,
        "points_reward" integer DEFAULT 25,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_applications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "requested_amount" numeric(15, 2) NOT NULL,
        "approved_amount" numeric(15, 2),
        "interest_rate" numeric(5, 2),
        "tenure" integer,
        "loan_to_value" numeric(5, 2),
        "collateral_value" numeric(15, 2) NOT NULL,
        "collateral_assets" jsonb NOT NULL,
        "margin_requirement" numeric(5, 2),
        "status" varchar DEFAULT 'pending',
        "application_number" varchar,
        "application_date" timestamp DEFAULT now(),
        "approval_date" timestamp,
        "disbursal_date" timestamp,
        "closure_date" timestamp,
        "risk_score" integer,
        "eligibility_score" numeric(5, 2),
        "credit_score" integer,
        "processing_fee" numeric(15, 2),
        "legal_charges" numeric(15, 2),
        "is_overdraft_facility" boolean DEFAULT false,
        "pre_closure_penalty" numeric(5, 2) DEFAULT '0',
        "approved_by" varchar,
        "rejection_reason" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "loan_applications_application_number_unique" UNIQUE("application_number")
);
--> statement-breakpoint
CREATE TABLE "loan_applications_marketplace" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "offer_id" varchar NOT NULL,
        "provider_id" varchar NOT NULL,
        "product_id" varchar NOT NULL,
        "application_number" varchar,
        "provider_application_ref" varchar,
        "status" varchar DEFAULT 'draft',
        "stage" varchar DEFAULT 'initiated',
        "kyc_status" varchar DEFAULT 'pending',
        "document_status" varchar DEFAULT 'pending',
        "final_amount" numeric(15, 2) NOT NULL,
        "final_interest_rate" numeric(5, 2) NOT NULL,
        "final_tenure" integer NOT NULL,
        "final_emi" numeric(15, 2) NOT NULL,
        "submitted_at" timestamp,
        "approved_at" timestamp,
        "rejected_at" timestamp,
        "disbursed_at" timestamp,
        "rejection_reason" text,
        "disbursal_amount" numeric(15, 2),
        "disbursal_method" varchar,
        "disbursal_account_number" varchar,
        "disbursal_ifsc" varchar,
        "checklist" jsonb DEFAULT '[]'::jsonb,
        "next_steps" jsonb DEFAULT '[]'::jsonb,
        "timeline" jsonb DEFAULT '[]'::jsonb,
        "last_communication_date" timestamp,
        "communication_preference" varchar DEFAULT 'email',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "loan_applications_marketplace_application_number_unique" UNIQUE("application_number")
);
--> statement-breakpoint
CREATE TABLE "loan_comparison_analytics" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "comparison_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "action" varchar NOT NULL,
        "action_details" jsonb,
        "session_id" varchar,
        "user_agent" text,
        "ip_address" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_comparisons" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "comparison_name" varchar NOT NULL,
        "description" text,
        "comparison_amount" numeric(15, 2) NOT NULL,
        "comparison_tenure" integer NOT NULL,
        "loan_type" varchar NOT NULL,
        "selected_offers" jsonb NOT NULL,
        "comparison_criteria" jsonb DEFAULT '{"interest_rate":30,"processing_fee":20,"total_cost":25,"approval_probability":15,"provider_rating":10}'::jsonb,
        "winner_offer_id" varchar,
        "comparison_score" jsonb,
        "is_public" boolean DEFAULT false,
        "shared_with" jsonb DEFAULT '[]'::jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_offers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "request_id" varchar NOT NULL,
        "provider_id" varchar NOT NULL,
        "product_id" varchar NOT NULL,
        "approved_amount" numeric(15, 2) NOT NULL,
        "interest_rate" numeric(5, 2) NOT NULL,
        "tenure" integer NOT NULL,
        "emi" numeric(15, 2) NOT NULL,
        "processing_fee" numeric(15, 2) NOT NULL,
        "legal_charges" numeric(15, 2) DEFAULT '0',
        "other_charges" numeric(15, 2) DEFAULT '0',
        "total_cost" numeric(15, 2) NOT NULL,
        "eligibility_score" numeric(5, 2) NOT NULL,
        "quality_score" numeric(5, 2) NOT NULL,
        "approval_probability" numeric(5, 2) DEFAULT '95',
        "offer_source" varchar NOT NULL,
        "rate_type" varchar DEFAULT 'floating',
        "ltv_ratio" numeric(5, 2),
        "terms" jsonb DEFAULT '[]'::jsonb,
        "special_offers" jsonb DEFAULT '[]'::jsonb,
        "valid_until" timestamp NOT NULL,
        "is_active" boolean DEFAULT true,
        "viewed_at" timestamp,
        "selected_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_products" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_key" varchar NOT NULL,
        "product_name" varchar NOT NULL,
        "category" varchar NOT NULL,
        "collateral_type" varchar,
        "description" text,
        "min_amount" numeric(15, 2) NOT NULL,
        "max_amount" numeric(15, 2) NOT NULL,
        "min_tenure" integer NOT NULL,
        "max_tenure" integer NOT NULL,
        "min_age" integer DEFAULT 18,
        "max_age" integer DEFAULT 65,
        "min_income" numeric(15, 2),
        "min_cibil_score" integer DEFAULT 600,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "loan_products_product_key_unique" UNIQUE("product_key")
);
--> statement-breakpoint
CREATE TABLE "loan_providers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider_key" varchar NOT NULL,
        "provider_name" varchar NOT NULL,
        "provider_type" varchar NOT NULL,
        "logo_url" varchar,
        "description" text,
        "has_api" boolean DEFAULT false,
        "supports_prequalification" boolean DEFAULT false,
        "supports_instant_offers" boolean DEFAULT false,
        "supports_webhooks" boolean DEFAULT false,
        "contact_email" varchar,
        "contact_phone" varchar,
        "website" varchar,
        "avg_processing_time" varchar,
        "processing_cutoff_time" varchar,
        "is_active" boolean DEFAULT true,
        "priority" integer DEFAULT 100,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "loan_providers_provider_key_unique" UNIQUE("provider_key")
);
--> statement-breakpoint
CREATE TABLE "loan_repayments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "loan_id" varchar NOT NULL,
        "payment_amount" numeric(15, 2) NOT NULL,
        "principal_amount" numeric(15, 2),
        "interest_amount" numeric(15, 2),
        "penalty_amount" numeric(15, 2) DEFAULT '0',
        "payment_date" timestamp DEFAULT now(),
        "due_date" timestamp,
        "payment_method" varchar,
        "transaction_id" varchar,
        "payment_status" varchar DEFAULT 'completed',
        "outstanding_principal" numeric(15, 2),
        "outstanding_interest" numeric(15, 2),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loan_requests" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "product_id" varchar NOT NULL,
        "requested_amount" numeric(15, 2) NOT NULL,
        "preferred_tenure" integer NOT NULL,
        "purpose" text,
        "collateral_details" jsonb,
        "estimated_collateral_value" numeric(15, 2),
        "status" varchar DEFAULT 'active',
        "validity_expiry" timestamp DEFAULT NOW() + INTERVAL '7 days',
        "source_channel" varchar DEFAULT 'web',
        "referral_code" varchar,
        "utm_source" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manual_kyc_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "submission_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "document_url" text NOT NULL,
        "file_name" varchar NOT NULL,
        "file_size" integer,
        "mime_type" varchar,
        "uploaded_at" timestamp DEFAULT now(),
        "verification_status" varchar DEFAULT 'pending',
        "verified_by" varchar,
        "verified_at" timestamp,
        "verification_notes" text
);
--> statement-breakpoint
CREATE TABLE "manual_kyc_submissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "applicant_type" varchar NOT NULL,
        "pan" varchar NOT NULL,
        "email" varchar NOT NULL,
        "mobile" varchar NOT NULL,
        "address" text NOT NULL,
        "city" varchar NOT NULL,
        "state" varchar NOT NULL,
        "pincode" varchar NOT NULL,
        "first_name" varchar,
        "middle_name" varchar,
        "last_name" varchar,
        "date_of_birth" varchar,
        "father_name" varchar,
        "mother_name" varchar,
        "company_name" varchar,
        "registration_number" varchar,
        "incorporation_date" varchar,
        "authorized_signatory_name" varchar,
        "country_of_residence" varchar,
        "passport_number" varchar,
        "visa_type" varchar,
        "documents" jsonb NOT NULL,
        "status" varchar DEFAULT 'pending_review',
        "reviewed_by" varchar,
        "reviewed_at" timestamp,
        "review_notes" text,
        "rejection_reason" text,
        "aml_status" varchar DEFAULT 'pending',
        "aml_checked_at" timestamp,
        "verification_score" integer,
        "submitted_from" varchar,
        "user_agent" text,
        "submission_channel" varchar DEFAULT 'web',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_data" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "symbol" text NOT NULL,
        "price" numeric(15, 4),
        "change" numeric(15, 4),
        "change_percent" numeric(8, 4),
        "volume" numeric(20, 0),
        "market_cap" numeric(20, 0),
        "currency" varchar DEFAULT 'INR',
        "data" jsonb,
        "last_updated" timestamp DEFAULT now(),
        CONSTRAINT "market_data_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "market_stories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "title" varchar(255) NOT NULL,
        "content" text NOT NULL,
        "summary" text NOT NULL,
        "sentiment" varchar(20) NOT NULL,
        "confidence" numeric(3, 2) NOT NULL,
        "key_points" text[] DEFAULT '{}',
        "market_data" jsonb,
        "generated_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketing_campaigns" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "campaign_type" varchar NOT NULL,
        "zoho_campaign_id" varchar,
        "aisensy_broadcast_id" varchar,
        "status" varchar DEFAULT 'draft' NOT NULL,
        "target_segment" varchar,
        "custom_filters" jsonb,
        "recipient_count" integer DEFAULT 0,
        "email_subject" varchar,
        "email_from_name" varchar,
        "email_reply_to" varchar,
        "email_html_content" text,
        "email_text_content" text,
        "whatsapp_template_id" varchar,
        "whatsapp_template_name" varchar,
        "whatsapp_message" text,
        "whatsapp_media_url" varchar,
        "whatsapp_buttons" jsonb,
        "scheduled_at" timestamp,
        "send_at" timestamp,
        "sent_count" integer DEFAULT 0,
        "delivered_count" integer DEFAULT 0,
        "opened_count" integer DEFAULT 0,
        "clicked_count" integer DEFAULT 0,
        "bounced_count" integer DEFAULT 0,
        "unsubscribed_count" integer DEFAULT 0,
        "conversion_goal" varchar,
        "conversions_count" integer DEFAULT 0,
        "revenue" numeric(15, 2),
        "created_by" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "mutual_funds" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "scheme_code" text NOT NULL,
        "scheme_name" text NOT NULL,
        "category" text,
        "fund_house" text,
        "nav" numeric(10, 4),
        "change" numeric(10, 4),
        "change_percent" numeric(8, 4),
        "expense_ratio" numeric(5, 2),
        "aum" numeric(15, 2),
        "risk_level" text,
        "returns_1y" numeric(8, 4),
        "returns_3y" numeric(8, 4),
        "returns_5y" numeric(8, 4),
        "crisil_rating" integer,
        "crisil_category" varchar,
        "crisil_percentile" numeric(5, 2),
        "crisil_evaluation_date" timestamp,
        "crisil_risk_adjusted_score" numeric(8, 4),
        "crisil_asset_quality_score" numeric(8, 4),
        "crisil_liquidity_score" numeric(8, 4),
        "crisil_concentration_score" numeric(8, 4),
        "crisil_overall_score" numeric(8, 4),
        "crisil_data_source" varchar DEFAULT 'calculated',
        "crisil_last_updated" timestamp DEFAULT now(),
        "extended_data" jsonb,
        "last_updated" timestamp DEFAULT now(),
        CONSTRAINT "mutual_funds_scheme_code_unique" UNIQUE("scheme_code")
);
--> statement-breakpoint
CREATE TABLE "nps_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "pran" varchar NOT NULL,
        "account_holder_name" text NOT NULL,
        "date_of_birth" date NOT NULL,
        "registration_date" date NOT NULL,
        "tier_i_balance" numeric(15, 2) DEFAULT '0',
        "tier_i_contributions" numeric(15, 2) DEFAULT '0',
        "tier_i_returns" numeric(15, 2) DEFAULT '0',
        "tier_i_asset_allocation" jsonb,
        "tier_ii_balance" numeric(15, 2) DEFAULT '0',
        "tier_ii_contributions" numeric(15, 2) DEFAULT '0',
        "tier_ii_returns" numeric(15, 2) DEFAULT '0',
        "tier_ii_asset_allocation" jsonb,
        "total_balance" numeric(15, 2) DEFAULT '0',
        "total_contributions" numeric(15, 2) DEFAULT '0',
        "total_returns" numeric(15, 2) DEFAULT '0',
        "returns_percentage" numeric(8, 2) DEFAULT '0',
        "fund_manager" text,
        "scheme" text,
        "tier" varchar NOT NULL,
        "nominee" text,
        "nominee_relation" varchar,
        "status" varchar DEFAULT 'active' NOT NULL,
        "last_contribution_date" date,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "nps_accounts_pran_unique" UNIQUE("pran")
);
--> statement-breakpoint
CREATE TABLE "nri_kyc_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "step1_verified" boolean DEFAULT false,
        "step1_pan_number" varchar,
        "step1_passport_number" varchar NOT NULL,
        "step1_passport_name" varchar,
        "step1_passport_expiry" date,
        "step1_country_of_residence" varchar,
        "step1_completed_at" timestamp,
        "step1_data" jsonb,
        "step2_address_verified" boolean DEFAULT false,
        "step2_overseas_address_line1" text,
        "step2_overseas_address_line2" text,
        "step2_overseas_city" varchar,
        "step2_overseas_state" varchar,
        "step2_overseas_country" varchar,
        "step2_overseas_postal_code" varchar,
        "step2_address_proof_doc_url" varchar,
        "step2_completed_at" timestamp,
        "step2_data" jsonb,
        "step3_pis_verified" boolean DEFAULT false,
        "step3_pis_permission_letter_url" varchar,
        "step3_pis_bank_name" varchar,
        "step3_pis_branch_name" varchar,
        "step3_foreign_bank_account_number" varchar,
        "step3_foreign_bank_name" varchar,
        "step3_foreign_bank_country" varchar,
        "step3_swift_code" varchar,
        "step3_completed_at" timestamp,
        "step3_data" jsonb,
        "step4_fatca_completed" boolean DEFAULT false,
        "step4_tax_residency_country" varchar,
        "step4_tax_identification_number" varchar,
        "step4_us_citizen" boolean DEFAULT false,
        "step4_green_card_holder" boolean DEFAULT false,
        "step4_fatca_declaration_url" varchar,
        "step4_crs_declaration_url" varchar,
        "step4_completed_at" timestamp,
        "step4_data" jsonb,
        "step5_review_completed" boolean DEFAULT false,
        "step5_completed_at" timestamp,
        "step5_confirmed_data" jsonb,
        "current_step" integer DEFAULT 1,
        "is_completed" boolean DEFAULT false,
        "completed_at" timestamp,
        "nri_status" varchar,
        "investment_type" varchar,
        "started_at" timestamp DEFAULT now(),
        "last_updated_step" integer,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "nri_kyc_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "order_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "order_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "document_name" text NOT NULL,
        "document_url" text,
        "file_size" integer,
        "mime_type" varchar,
        "status" varchar DEFAULT 'generated',
        "sent_to_client" boolean DEFAULT false,
        "sent_at" timestamp,
        "requires_signature" boolean DEFAULT false,
        "signed_by" varchar,
        "signed_at" timestamp,
        "signature_hash" varchar,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_lifecycle_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "order_id" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "event_name" varchar NOT NULL,
        "event_description" text,
        "previous_state" jsonb,
        "new_state" jsonb,
        "actor_id" varchar,
        "actor_type" varchar,
        "metadata" jsonb,
        "is_system_generated" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "otp_verifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "identifier" varchar NOT NULL,
        "otp" varchar(200) NOT NULL,
        "type" varchar NOT NULL,
        "expires_at" timestamp NOT NULL,
        "verified" boolean DEFAULT false,
        "attempt_count" integer DEFAULT 0 NOT NULL,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pan_consent_audit_log" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "consent_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "action" varchar NOT NULL,
        "action_details" jsonb,
        "ip_address" varchar,
        "user_agent" text,
        "session_id" varchar,
        "api_endpoint" varchar,
        "request_id" varchar,
        "access_reason" text,
        "data_minimized" boolean DEFAULT true,
        "timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pan_consents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "encrypted_pan" text NOT NULL,
        "pan_hash" varchar NOT NULL,
        "consent_given" boolean DEFAULT true NOT NULL,
        "consent_timestamp" timestamp DEFAULT now() NOT NULL,
        "consent_version" varchar DEFAULT '1.0' NOT NULL,
        "consent_ip_address" varchar,
        "consent_user_agent" text,
        "consent_purpose" text DEFAULT 'Tax data aggregation and ITR filing services' NOT NULL,
        "data_retention_period" varchar DEFAULT '7_years',
        "last_used" timestamp,
        "usage_count" integer DEFAULT 0,
        "is_active" boolean DEFAULT true NOT NULL,
        "revoked_at" timestamp,
        "revoked_reason" text,
        "kyc_verified" boolean DEFAULT false,
        "pan_verified" boolean DEFAULT false,
        "verification_date" timestamp,
        "verification_source" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pan_verification_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "pan_number" varchar NOT NULL,
        "full_name" varchar NOT NULL,
        "date_of_birth" varchar NOT NULL,
        "pan_type" varchar DEFAULT 'Individual',
        "verified" boolean DEFAULT false,
        "verified_at" timestamp,
        "verification_source" varchar DEFAULT 'sandbox_api',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_application_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "application_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "file_name" text NOT NULL,
        "file_size" integer,
        "mime_type" varchar,
        "file_path" text NOT NULL,
        "original_url" text,
        "uploaded_by" varchar NOT NULL,
        "is_verified" boolean DEFAULT false,
        "verified_by" varchar,
        "verified_at" timestamp,
        "uploaded_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "partner_applications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "lender" varchar NOT NULL,
        "loan_type" varchar DEFAULT 'personal' NOT NULL,
        "recommendation_id" varchar,
        "loan_amount" numeric(12, 2) NOT NULL,
        "tenure" integer NOT NULL,
        "interest_rate" numeric(5, 2),
        "emi" numeric(10, 2),
        "processing_fee" numeric(10, 2),
        "monthly_income" numeric(10, 2) NOT NULL,
        "existing_emis" numeric(10, 2),
        "employment_type" varchar NOT NULL,
        "work_experience" integer,
        "cibil_score" integer,
        "pan_number" varchar,
        "aadhar_number" varchar,
        "current_address" text,
        "employer_name" varchar,
        "company_category" varchar,
        "residence_type" varchar,
        "bank_name" varchar,
        "account_number" varchar,
        "ifsc_code" varchar,
        "net_salary_credit_bank" varchar,
        "document_refs" jsonb DEFAULT '[]'::jsonb,
        "required_documents" jsonb DEFAULT '[]'::jsonb,
        "provider_meta" jsonb DEFAULT '{}'::jsonb,
        "bureau_consent" boolean DEFAULT false,
        "ckyc_consent" boolean DEFAULT false,
        "terms_accepted" boolean DEFAULT false,
        "status" varchar DEFAULT 'draft',
        "provider_application_id" varchar,
        "submitted_at" timestamp,
        "status_updates" jsonb DEFAULT '[]'::jsonb,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "partner_commissions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" varchar NOT NULL,
        "client_id" varchar NOT NULL,
        "order_id" varchar,
        "product_type" varchar NOT NULL,
        "transaction_type" varchar NOT NULL,
        "transaction_amount" numeric(15, 2) NOT NULL,
        "commission_rate" numeric(5, 2) NOT NULL,
        "commission_amount" numeric(15, 2) NOT NULL,
        "volume_bonus" numeric(15, 2) DEFAULT '0.00',
        "total_commission" numeric(15, 2) NOT NULL,
        "tds_rate" numeric(5, 2) DEFAULT '0.00',
        "tds_amount" numeric(15, 2) DEFAULT '0.00',
        "net_commission" numeric(15, 2) NOT NULL,
        "status" varchar DEFAULT 'pending',
        "settlement_id" varchar,
        "settled_at" timestamp,
        "cashfree_order_id" varchar,
        "cashfree_split_id" varchar,
        "cashfree_split_status" varchar,
        "transaction_date" timestamp DEFAULT now(),
        "month" varchar NOT NULL,
        "financial_year" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_referrals" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" varchar NOT NULL,
        "client_id" varchar NOT NULL,
        "referral_code" varchar,
        "referral_source" varchar,
        "referral_date" timestamp DEFAULT now(),
        "client_status" varchar DEFAULT 'registered',
        "first_transaction_date" timestamp,
        "last_transaction_date" timestamp,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partner_settlements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" varchar NOT NULL,
        "settlement_period" varchar NOT NULL,
        "settlement_month" varchar NOT NULL,
        "settlement_date" timestamp NOT NULL,
        "total_transactions" integer DEFAULT 0,
        "total_commission_earned" numeric(15, 2) NOT NULL,
        "total_volume_bonus" numeric(15, 2) DEFAULT '0.00',
        "total_tds" numeric(15, 2) DEFAULT '0.00',
        "net_payable" numeric(15, 2) NOT NULL,
        "adjustments" numeric(15, 2) DEFAULT '0.00',
        "adjustment_reason" text,
        "previous_balance" numeric(15, 2) DEFAULT '0.00',
        "final_payout_amount" numeric(15, 2) NOT NULL,
        "status" varchar DEFAULT 'pending',
        "payment_method" varchar DEFAULT 'bank_transfer',
        "cashfree_payout_id" varchar,
        "cashfree_payout_status" varchar,
        "cashfree_utr" varchar,
        "cashfree_payout_initiated_at" timestamp,
        "cashfree_payout_completed_at" timestamp,
        "cashfree_failure_reason" text,
        "bank_account_number" varchar,
        "ifsc_code" varchar,
        "account_holder_name" varchar,
        "reconciled_at" timestamp,
        "reconciled_by" varchar,
        "reconciliation_notes" text,
        "invoice_number" varchar,
        "invoice_url" text,
        "statement_url" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "partners" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_name" varchar NOT NULL,
        "contact_email" varchar NOT NULL,
        "contact_phone" varchar,
        "address" text,
        "website" varchar,
        "password" text NOT NULL,
        "is_active" boolean DEFAULT true,
        "is_verified" boolean DEFAULT false,
        "partner_type" varchar NOT NULL,
        "permissions" jsonb DEFAULT '{}'::jsonb,
        "business_license" varchar,
        "tax_id" varchar,
        "gstin" varchar,
        "cin" varchar,
        "commission_rate" numeric(5, 2) DEFAULT '0.00',
        "product_types" text[] DEFAULT ARRAY[]::text[],
        "arn_code" varchar,
        "euin_number" varchar,
        "posp_number" varchar,
        "ria_number" varchar,
        "dsa_code" varchar,
        "pan_number" varchar,
        "aadhar_number" varchar,
        "bank_account_number" varchar,
        "ifsc_code" varchar,
        "bank_account_holder_name" varchar,
        "upi_id" varchar,
        "cashfree_vendor_id" varchar,
        "cashfree_vendor_status" varchar DEFAULT 'not_registered',
        "cashfree_bank_verified" boolean DEFAULT false,
        "cashfree_registered_at" timestamp,
        "commission_tier" varchar DEFAULT 'standard',
        "volume_bonus_enabled" boolean DEFAULT false,
        "volume_bonus_rate" numeric(5, 2),
        "volume_threshold" numeric(15, 2),
        "settlement_frequency" varchar DEFAULT 'monthly',
        "settlement_day" integer DEFAULT 1,
        "min_settlement_amount" numeric(10, 2) DEFAULT '1000.00',
        "total_clients_referred" integer DEFAULT 0,
        "active_clients_count" integer DEFAULT 0,
        "total_commissions_earned" numeric(15, 2) DEFAULT '0.00',
        "total_commissions_paid" numeric(15, 2) DEFAULT '0.00',
        "pending_commissions" numeric(15, 2) DEFAULT '0.00',
        "last_settlement_date" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "partners_contact_email_unique" UNIQUE("contact_email")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "identifier" varchar NOT NULL,
        "token" varchar(6) NOT NULL,
        "expires_at" timestamp NOT NULL,
        "is_used" boolean DEFAULT false,
        "used_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "phonepe_transactions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "order_id" varchar NOT NULL,
        "merchant_transaction_id" varchar NOT NULL,
        "transaction_id" varchar,
        "amount" numeric(15, 2) NOT NULL,
        "currency" varchar DEFAULT 'INR',
        "payment_method" varchar,
        "payment_instrument_type" varchar,
        "status" varchar DEFAULT 'initiated' NOT NULL,
        "state" varchar,
        "response_code" varchar,
        "customer_name" varchar,
        "customer_email" varchar,
        "customer_phone" varchar,
        "redirect_url" text,
        "callback_url" text,
        "payment_url" text,
        "cart_id" varchar,
        "item_type" varchar,
        "item_id" varchar,
        "gateway_response" jsonb,
        "metadata" jsonb,
        "failure_reason" text,
        "retry_count" integer DEFAULT 0,
        "initiated_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "callback_received_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "phonepe_transactions_order_id_unique" UNIQUE("order_id"),
        CONSTRAINT "phonepe_transactions_merchant_transaction_id_unique" UNIQUE("merchant_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "pi_chat_summaries" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "asset_class" text NOT NULL,
        "summary" text NOT NULL,
        "insights" jsonb,
        "recommendations" text[],
        "last_analyzed" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_comparisons" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "portfolio_ids" jsonb NOT NULL,
        "comparison_type" varchar DEFAULT 'comprehensive',
        "benchmark_index" varchar DEFAULT 'NIFTY_50',
        "time_period" varchar DEFAULT '1Y',
        "performance_metrics" jsonb,
        "risk_analysis" jsonb,
        "asset_allocation_comparison" jsonb,
        "correlation_matrix" jsonb,
        "diversification_analysis" jsonb,
        "sector_exposure" jsonb,
        "top_holdings_comparison" jsonb,
        "efficiency_metrics" jsonb,
        "best_portfolio" varchar,
        "worst_portfolio" varchar,
        "rebalancing_suggestions" jsonb,
        "risk_score" numeric(3, 1),
        "executive_summary" text,
        "key_findings" jsonb,
        "actionable_recommendations" jsonb,
        "requested_at" timestamp DEFAULT now(),
        "status" varchar DEFAULT 'completed',
        "error_message" text,
        "processing_time_ms" integer,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "symbol" text NOT NULL,
        "quantity" numeric(15, 4) NOT NULL,
        "avg_price" numeric(15, 4) NOT NULL,
        "currency" varchar DEFAULT 'INR',
        "asset_type" text NOT NULL,
        "asset_class" text,
        "sector" text,
        "market_cap" numeric(20, 0),
        "beta" numeric(5, 3),
        "dividend_yield" numeric(5, 2),
        "pe_ratio" numeric(8, 2),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_predictions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "portfolio_id" varchar,
        "prediction_date" timestamp NOT NULL,
        "prediction_horizon" varchar NOT NULL,
        "expected_return" numeric(10, 4),
        "expected_value" numeric(20, 2),
        "lower_bound" numeric(20, 2),
        "upper_bound" numeric(20, 2),
        "volatility" numeric(10, 4),
        "sharpe_ratio" numeric(10, 4),
        "beta" numeric(10, 4),
        "var_value" numeric(20, 2),
        "max_drawdown" numeric(10, 4),
        "trend_direction" varchar,
        "trend_strength" numeric(5, 2),
        "momentum" numeric(10, 4),
        "cagr" numeric(10, 4),
        "moving_average_50day" numeric(20, 2),
        "moving_average_200day" numeric(20, 2),
        "rsi" numeric(5, 2),
        "confidence_score" numeric(5, 2),
        "model_version" varchar,
        "data_quality_score" numeric(5, 2),
        "historical_accuracy" numeric(5, 2),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolio_snapshots" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "snapshot_date" date NOT NULL,
        "total_value" numeric(15, 2),
        "total_equity_value" numeric(15, 2),
        "total_debt_value" numeric(15, 2),
        "total_mutual_fund_value" numeric(15, 2),
        "total_government_scheme_value" numeric(15, 2),
        "total_alternative_value" numeric(15, 2),
        "total_cash_value" numeric(15, 2),
        "epf_value" numeric(15, 2),
        "ppf_value" numeric(15, 2),
        "eps_value" numeric(15, 2),
        "apy_value" numeric(15, 2),
        "nps_value" numeric(15, 2),
        "insurance_value" numeric(15, 2),
        "real_estate_value" numeric(15, 2),
        "commodity_value" numeric(15, 2),
        "crypto_value" numeric(15, 2),
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "name" text NOT NULL,
        "total_value" numeric(15, 2),
        "cash" numeric(15, 2) DEFAULT '0',
        "base_currency" varchar DEFAULT 'INR',
        "is_default" boolean DEFAULT false,
        "family_id" varchar,
        "is_shared" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ppf_holdings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "ppf_account_number" varchar NOT NULL,
        "bank_name" text NOT NULL,
        "branch_name" text,
        "account_holder_name" text NOT NULL,
        "total_balance" numeric(15, 2),
        "current_fy_contribution" numeric(15, 2),
        "total_contribution" numeric(15, 2),
        "total_interest_earned" numeric(15, 2),
        "current_interest_rate" numeric(5, 2),
        "maturity_amount" numeric(15, 2),
        "account_open_date" date NOT NULL,
        "maturity_date" date NOT NULL,
        "last_contribution_date" date,
        "next_contribution_due_date" date,
        "years_completed" integer DEFAULT 0,
        "min_contribution_met" boolean DEFAULT false,
        "max_contribution_allowed" numeric(15, 2) DEFAULT '150000',
        "contribution_remaining" numeric(15, 2),
        "loan_available" boolean DEFAULT false,
        "max_loan_amount" numeric(15, 2),
        "partial_withdrawal_available" boolean DEFAULT false,
        "max_withdrawal_amount" numeric(15, 2),
        "nominee_name" text,
        "nominee_relationship" varchar,
        "nominee_age" integer,
        "is_active" boolean DEFAULT true,
        "can_extend" boolean DEFAULT false,
        "has_extended" boolean DEFAULT false,
        "extension_period" integer,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pre_approved_loan_offers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "lender_name" varchar NOT NULL,
        "lender_logo" varchar,
        "lender_type" varchar DEFAULT 'nbfc',
        "product_type" varchar NOT NULL,
        "product_name" varchar NOT NULL,
        "offer_amount" numeric(15, 2) NOT NULL,
        "interest_rate" numeric(5, 2) NOT NULL,
        "processing_fee" numeric(15, 2) DEFAULT '0',
        "processing_fee_percentage" numeric(5, 2),
        "min_tenure_months" integer NOT NULL,
        "max_tenure_months" integer NOT NULL,
        "default_tenure_months" integer NOT NULL,
        "monthly_emi" numeric(15, 2) NOT NULL,
        "total_interest" numeric(15, 2),
        "total_repayment" numeric(15, 2),
        "eligibility_status" varchar DEFAULT 'pre_approved',
        "eligibility_criteria" jsonb,
        "offer_valid_until" timestamp NOT NULL,
        "offer_code" varchar,
        "features" jsonb,
        "benefits" text,
        "documents_required" jsonb,
        "application_status" varchar DEFAULT 'not_started',
        "application_id" varchar,
        "applied_at" timestamp,
        "approved_at" timestamp,
        "disbursed_at" timestamp,
        "disbursed_amount" numeric(15, 2),
        "display_priority" integer DEFAULT 0,
        "is_featured" boolean DEFAULT false,
        "is_recommended" boolean DEFAULT false,
        "recommendation_reason" text,
        "partner_offer_id" varchar,
        "partner_api_endpoint" varchar,
        "partner_application_url" varchar,
        "metadata" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "viewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "pre_ipo_analytics" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "portfolio_id" varchar,
        "total_investment" numeric(15, 2) DEFAULT '0',
        "total_current_value" numeric(15, 2) DEFAULT '0',
        "total_unrealized_gains" numeric(15, 2) DEFAULT '0',
        "total_realized_gains" numeric(15, 2) DEFAULT '0',
        "overall_roi" numeric(8, 4) DEFAULT '0',
        "risk_score" numeric(3, 1),
        "diversification_score" numeric(3, 1),
        "sector_concentration" jsonb,
        "best_performer" varchar,
        "worst_performer" varchar,
        "average_holding_period" integer,
        "success_rate" numeric(5, 2),
        "ai_insights" text,
        "recommendations" text[] DEFAULT '{}',
        "risk_warnings" text[] DEFAULT '{}',
        "last_analyzed" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pre_ipo_companies" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "company_name" text NOT NULL,
        "sector" varchar NOT NULL,
        "industry" varchar NOT NULL,
        "founded_year" integer,
        "headquarters" varchar,
        "website" varchar,
        "description" text,
        "business_model" text,
        "key_products" text[] DEFAULT '{}',
        "current_valuation" numeric(20, 2),
        "last_round_valuation" numeric(20, 2),
        "last_round_date" timestamp,
        "total_funding_raised" numeric(20, 2),
        "revenue" numeric(20, 2),
        "revenue_growth_rate" numeric(5, 2),
        "profitability" varchar,
        "burn_rate" numeric(15, 2),
        "ipo_status" varchar DEFAULT 'preparation' NOT NULL,
        "expected_ipo_date" timestamp,
        "expected_price_range" jsonb,
        "proposed_exchange" varchar,
        "lead_underwriters" text[] DEFAULT '{}',
        "employees" integer,
        "market_position" varchar,
        "competitive_advantage" text,
        "key_risks" text[] DEFAULT '{}',
        "key_opportunities" text[] DEFAULT '{}',
        "minimum_investment" numeric(15, 2),
        "investment_tier" varchar,
        "risk_rating" varchar,
        "expected_returns" numeric(5, 2),
        "lock_in_period" integer,
        "is_available_for_investment" boolean DEFAULT false,
        "investment_deadline" timestamp,
        "total_investment_slots" integer,
        "available_slots" integer,
        "logo_url" varchar,
        "documents" jsonb,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pre_ipo_investments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "company_id" varchar NOT NULL,
        "portfolio_id" varchar,
        "investment_amount" numeric(15, 2) NOT NULL,
        "share_price" numeric(15, 4),
        "shares_allocated" numeric(15, 4),
        "investment_date" timestamp DEFAULT now(),
        "status" varchar DEFAULT 'pending' NOT NULL,
        "allotment_status" varchar,
        "allotted_shares" numeric(15, 4),
        "allotment_date" timestamp,
        "listing_date" timestamp,
        "listing_price" numeric(15, 4),
        "current_price" numeric(15, 4),
        "unrealized_gains" numeric(15, 2),
        "realized_gains" numeric(15, 2),
        "roi" numeric(8, 4),
        "holding_period" integer,
        "is_exited" boolean DEFAULT false,
        "exit_date" timestamp,
        "exit_price" numeric(15, 4),
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pre_ipo_market_insights" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "sector" varchar NOT NULL,
        "average_valuation" numeric(20, 2),
        "valuation_trend" varchar,
        "average_time_to_ipo" integer,
        "success_rate" numeric(5, 2),
        "average_ipo_gains" numeric(8, 4),
        "market_sentiment" varchar,
        "key_trends" text[] DEFAULT '{}',
        "upcoming_ipos" integer,
        "hot_sectors" text[] DEFAULT '{}',
        "ai_analysis" text,
        "investment_recommendation" varchar,
        "confidence_score" numeric(3, 1),
        "analysis_date" timestamp DEFAULT now(),
        "data_source" varchar,
        "last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prediction_accuracy" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "prediction_id" varchar,
        "asset_forecast_id" varchar,
        "prediction_date" timestamp NOT NULL,
        "target_date" timestamp NOT NULL,
        "actual_date" timestamp NOT NULL,
        "predicted_value" numeric(20, 2),
        "actual_value" numeric(20, 2),
        "error_percentage" numeric(10, 4),
        "absolute_error" numeric(20, 2),
        "accuracy_score" numeric(5, 2),
        "prediction_quality" varchar,
        "model_version" varchar,
        "improvement_notes" text,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_account_preferences" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "product_type" varchar NOT NULL,
        "bank_account_id" varchar,
        "demat_account_id" varchar,
        "is_active" boolean DEFAULT true,
        "is_default" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_applications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "partner_id" varchar NOT NULL,
        "application_data" jsonb NOT NULL,
        "documents" jsonb DEFAULT '[]'::jsonb,
        "status" varchar DEFAULT 'submitted',
        "review_notes" text,
        "reviewed_by" varchar,
        "reviewed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_performance" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" varchar NOT NULL,
        "supplier_id" varchar NOT NULL,
        "cost_price" numeric(15, 2) NOT NULL,
        "selling_price" numeric(15, 2) NOT NULL,
        "profit_margin" numeric(5, 2) NOT NULL,
        "sales_volume" integer DEFAULT 0,
        "revenue" numeric(15, 2) DEFAULT '0.00',
        "monthly_performance" jsonb,
        "last_sale_date" timestamp,
        "is_promoted" boolean DEFAULT false,
        "promotion_start_date" timestamp,
        "promotion_end_date" timestamp,
        "notes" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "production_kyc_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "user_type" varchar DEFAULT 'individual',
        "current_step" varchar DEFAULT 'pan_verification' NOT NULL,
        "pan_number" varchar,
        "pan_verified" boolean DEFAULT false,
        "entity_type" varchar,
        "company_name" varchar,
        "cin" varchar,
        "gstin" varchar,
        "incorporation_date" varchar,
        "entity_registration_number" varchar,
        "resident_status" varchar,
        "passport_number" varchar,
        "country_of_residence" varchar,
        "overseas_address" text,
        "repatriation_type" varchar,
        "kra_verified" boolean DEFAULT false,
        "kra_verified_at" timestamp,
        "kra_check_timeout" boolean DEFAULT false,
        "cashfree_verified" boolean DEFAULT false,
        "cashfree_verified_at" timestamp,
        "cashfree_transaction_id" varchar,
        "cersai_submitted" boolean DEFAULT false,
        "cersai_submitted_at" timestamp,
        "ckyc_number" varchar,
        "ucc_created" boolean DEFAULT false,
        "ucc_created_at" timestamp,
        "ucc_number" varchar,
        "target_kyc_tier" "kyc_tier" DEFAULT 'tier_1',
        "previous_kyc_tier" "kyc_tier",
        "is_upgrade_session" boolean DEFAULT false,
        "kyc_status" "kyc_status" DEFAULT 'pending',
        "ai_certificate_id" varchar,
        "ai_esign_status" varchar,
        "ca_certificate_url" varchar,
        "risk_declaration_url" varchar,
        "ai_submission_status" varchar,
        "ai_submitted_at" timestamp,
        "ai_decision_at" timestamp,
        "started_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "expires_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "partner_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "category" varchar NOT NULL,
        "sub_category" varchar,
        "provider" varchar,
        "base_price" numeric(15, 2),
        "interest_rate" numeric(8, 4),
        "minimum_investment" numeric(15, 2),
        "features" jsonb DEFAULT '{}'::jsonb,
        "eligibility_criteria" jsonb DEFAULT '{}'::jsonb,
        "documents" jsonb DEFAULT '[]'::jsonb,
        "returns_1m" numeric(8, 4),
        "returns_3m" numeric(8, 4),
        "returns_6m" numeric(8, 4),
        "returns_1y" numeric(8, 4),
        "returns_3y" numeric(8, 4),
        "returns_5y" numeric(8, 4),
        "returns_since_inception" numeric(8, 4),
        "risk_level" varchar,
        "credit_rating" varchar,
        "performance_tag" varchar,
        "exit_load" jsonb,
        "entry_load" numeric(5, 2),
        "expense_ratio" numeric(5, 2),
        "total_expense_ratio" numeric(5, 2),
        "investment_style" varchar,
        "market_cap_focus" varchar,
        "strategy_factors" text[],
        "sector_focus" varchar,
        "investment_theme" varchar,
        "fund_fact_sheet_url" varchar,
        "fact_sheet_last_updated" timestamp,
        "portfolio_holdings" jsonb,
        "sector_allocation" jsonb,
        "asset_allocation_equity" numeric(5, 2),
        "asset_allocation_debt" numeric(5, 2),
        "asset_allocation_cash" numeric(5, 2),
        "fund_manager_name" varchar,
        "fund_manager_tenure" integer,
        "benchmark_index" varchar,
        "sharpe_ratio" numeric(8, 4),
        "alpha_ratio" numeric(8, 4),
        "beta_ratio" numeric(8, 4),
        "standard_deviation" numeric(8, 4),
        "is_featured" boolean DEFAULT false,
        "is_new" boolean DEFAULT false,
        "badge" varchar,
        "status" varchar DEFAULT 'draft',
        "is_public" boolean DEFAULT false,
        "priority" integer DEFAULT 0,
        "slug" varchar,
        "tags" text[] DEFAULT '{}',
        "image_url" varchar,
        "last_performance_update" timestamp,
        "data_source" varchar,
        "markup" numeric(8, 4) DEFAULT '0',
        "markup_type" varchar DEFAULT 'percentage',
        "final_price" numeric(15, 2),
        "is_perpetual" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "proposal_payments" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "proposal_id" varchar NOT NULL,
        "proposal_item_id" varchar,
        "gateway" varchar NOT NULL,
        "gateway_transaction_id" varchar,
        "payment_method" varchar,
        "amount" numeric(15, 2) NOT NULL,
        "currency" varchar DEFAULT 'INR',
        "status" varchar DEFAULT 'initiated',
        "status_message" text,
        "gateway_response" jsonb,
        "client_id" varchar NOT NULL,
        "agent_id" varchar NOT NULL,
        "bank_account" varchar,
        "ifsc_code" varchar,
        "settlement_status" varchar,
        "settlement_date" timestamp,
        "metadata" jsonb,
        "retry_count" integer DEFAULT 0,
        "max_retries" integer DEFAULT 3,
        "initiated_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prospect_leads" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "cin" varchar,
        "company_name" varchar NOT NULL,
        "registration_number" varchar,
        "primary_email" varchar,
        "primary_mobile" varchar,
        "website" varchar,
        "address" text,
        "city" varchar,
        "state" varchar,
        "pincode" varchar,
        "paid_up_capital" numeric(15, 2),
        "authorized_capital" numeric(15, 2),
        "annual_revenue" numeric(15, 2),
        "net_profit" numeric(15, 2),
        "ebitda" numeric(15, 2),
        "total_assets" numeric(15, 2),
        "debt_to_equity_ratio" numeric(10, 2),
        "current_ratio" numeric(10, 2),
        "roe" numeric(10, 2),
        "probe42_score" integer,
        "industry_segment" varchar,
        "company_category" varchar,
        "risk_level" varchar,
        "directors" jsonb,
        "authorized_signatories" jsonb,
        "lead_score" integer DEFAULT 0,
        "lead_quality" varchar,
        "investable_surplus" numeric(15, 2),
        "status" varchar DEFAULT 'new' NOT NULL,
        "assigned_to" varchar,
        "source" varchar DEFAULT 'probe42' NOT NULL,
        "import_batch_id" varchar,
        "last_contacted_at" timestamp,
        "next_follow_up_at" timestamp,
        "notes" text,
        "converted_to_user_id" varchar,
        "converted_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_integrations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider_id" varchar NOT NULL,
        "adapter_key" varchar NOT NULL,
        "integration_name" varchar NOT NULL,
        "integration_type" varchar NOT NULL,
        "base_url" varchar,
        "authentication_method" varchar,
        "auth_config" jsonb,
        "webhook_url" varchar,
        "webhook_secret" varchar,
        "webhook_events" jsonb DEFAULT '[]'::jsonb,
        "is_enabled" boolean DEFAULT true,
        "last_health_check" timestamp,
        "health_status" varchar DEFAULT 'unknown',
        "rate_limit_per_minute" integer DEFAULT 60,
        "rate_limit_per_day" integer DEFAULT 1000,
        "config_version" varchar DEFAULT '1.0',
        "supported_features" jsonb DEFAULT '[]'::jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "provider_products" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider_id" varchar NOT NULL,
        "product_id" varchar NOT NULL,
        "provider_product_name" varchar,
        "base_interest_rate" numeric(5, 2) NOT NULL,
        "min_interest_rate" numeric(5, 2) NOT NULL,
        "max_interest_rate" numeric(5, 2) NOT NULL,
        "rate_type" varchar DEFAULT 'floating',
        "processing_fee_type" varchar DEFAULT 'percentage',
        "processing_fee_value" numeric(8, 2) NOT NULL,
        "max_processing_fee" numeric(15, 2),
        "prepayment_charges" numeric(5, 2) DEFAULT '0',
        "late_payment_fee" numeric(15, 2),
        "min_amount" numeric(15, 2),
        "max_amount" numeric(15, 2),
        "min_tenure" integer,
        "max_tenure" integer,
        "eligibility_rules" jsonb DEFAULT '{}'::jsonb,
        "pricing_model" jsonb DEFAULT '{}'::jsonb,
        "documents_required" jsonb DEFAULT '[]'::jsonb,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rebalance_executions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "execution_date" timestamp DEFAULT now(),
        "status" varchar DEFAULT 'pending' NOT NULL,
        "portfolio_value_before" numeric(15, 2),
        "portfolio_value_after" numeric(15, 2),
        "transaction_count" integer DEFAULT 0,
        "successful_transactions" integer DEFAULT 0,
        "failed_transactions" integer DEFAULT 0,
        "total_transaction_cost" numeric(15, 2) DEFAULT '0',
        "rebalance_details" jsonb,
        "execution_notes" text,
        "completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rebalance_transactions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "rebalance_execution_id" varchar NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "asset_type" varchar NOT NULL,
        "symbol" varchar,
        "action" varchar NOT NULL,
        "quantity" numeric(15, 4),
        "price" numeric(15, 4),
        "amount" numeric(15, 2),
        "transaction_cost" numeric(15, 2),
        "status" varchar DEFAULT 'pending' NOT NULL,
        "order_id" varchar,
        "error_message" text,
        "executed_at" timestamp,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "rebalancing_preferences" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "tolerance_threshold" numeric(5, 2) DEFAULT '5.00',
        "minimum_transaction_amount" numeric(15, 2) DEFAULT '1000.00',
        "transaction_cost_percentage" numeric(5, 2) DEFAULT '0.10',
        "auto_rebalance_enabled" boolean DEFAULT false,
        "rebalance_frequency" varchar DEFAULT 'quarterly',
        "notify_on_drift" boolean DEFAULT true,
        "last_rebalance_date" timestamp,
        "next_scheduled_rebalance" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "rebalancing_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "rebalancing_suggestions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "portfolio_id" varchar NOT NULL,
        "suggestion_type" text NOT NULL,
        "priority" text NOT NULL,
        "title" text NOT NULL,
        "description" text NOT NULL,
        "actions" jsonb,
        "expected_impact" jsonb,
        "confidence_score" numeric(3, 1),
        "implementation_steps" text[],
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "report_access_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "report_id" varchar,
        "user_id" varchar NOT NULL,
        "access_type" varchar NOT NULL,
        "ip_address" varchar,
        "user_agent" text,
        "access_location" varchar,
        "purpose" text,
        "compliance_note" text,
        "is_authorized" boolean DEFAULT true,
        "accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_analysis" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "portfolio_id" varchar,
        "analysis_date" timestamp NOT NULL,
        "analysis_type" varchar NOT NULL,
        "overall_risk_score" numeric(5, 2),
        "risk_category" varchar,
        "diversification_score" numeric(5, 2),
        "concentration_risk" numeric(5, 2),
        "correlation_risk" numeric(5, 2),
        "market_risk" numeric(10, 4),
        "sector_risk" numeric(10, 4),
        "geographic_risk" numeric(10, 4),
        "market_crash_scenario" jsonb,
        "recession_scenario" jsonb,
        "interest_rate_rise" jsonb,
        "inflation_scenario" jsonb,
        "var_1day" numeric(20, 2),
        "var_1week" numeric(20, 2),
        "var_1month" numeric(20, 2),
        "risk_mitigation_suggestions" jsonb,
        "rebalancing_recommendations" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_assessment_questions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "category" varchar NOT NULL,
        "question" text NOT NULL,
        "question_type" varchar NOT NULL,
        "options" jsonb,
        "weightage" integer DEFAULT 1,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_profiles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "risk_tolerance" varchar NOT NULL,
        "investment_horizon" varchar NOT NULL,
        "investment_experience" varchar NOT NULL,
        "income_stability" varchar NOT NULL,
        "liquidity_needs" varchar NOT NULL,
        "age" integer,
        "dependents" integer DEFAULT 0,
        "monthly_income" numeric(15, 2),
        "monthly_expenses" numeric(15, 2),
        "existing_assets" numeric(15, 2),
        "existing_liabilities" numeric(15, 2),
        "questionnaire" jsonb,
        "risk_score" integer,
        "assessed_by" varchar,
        "assessment_date" timestamp DEFAULT now() NOT NULL,
        "review_date" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
        "sid" varchar PRIMARY KEY NOT NULL,
        "sess" jsonb NOT NULL,
        "expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_kyc_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "step1_pan_verified" boolean DEFAULT false,
        "step1_pan_number" varchar,
        "step1_pan_name" varchar,
        "step1_completed_at" timestamp,
        "step1_data" jsonb,
        "step2_aadhaar_verified" boolean DEFAULT false,
        "step2_digilocker_session_id" varchar,
        "step2_completed_at" timestamp,
        "step2_data" jsonb,
        "step3_accounts_discovered" boolean DEFAULT false,
        "step3_bank_accounts_found" integer DEFAULT 0,
        "step3_demat_accounts_found" integer DEFAULT 0,
        "step3_completed_at" timestamp,
        "step3_data" jsonb,
        "step4_review_completed" boolean DEFAULT false,
        "step4_completed_at" timestamp,
        "step4_confirmed_data" jsonb,
        "current_step" integer DEFAULT 1,
        "is_completed" boolean DEFAULT false,
        "completed_at" timestamp,
        "name_match_score" integer,
        "name_reconciliation_status" varchar,
        "started_at" timestamp DEFAULT now(),
        "last_updated_step" integer,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "smart_kyc_progress_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "social_shares" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "achievement_id" varchar,
        "platform" varchar(50) NOT NULL,
        "share_url" text,
        "share_content" text,
        "engagement_data" jsonb,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_categories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar NOT NULL,
        "description" text,
        "slug" varchar NOT NULL,
        "parent_category_id" varchar,
        "display_order" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "store_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "store_product_images" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" varchar NOT NULL,
        "image_url" varchar NOT NULL,
        "alt_text" varchar,
        "is_primary" boolean DEFAULT false,
        "display_order" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_product_tag_mappings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "product_id" varchar NOT NULL,
        "tag_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "store_product_tags" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar NOT NULL,
        "slug" varchar NOT NULL,
        "color" varchar DEFAULT '#3B82F6',
        "created_at" timestamp DEFAULT now(),
        CONSTRAINT "store_product_tags_name_unique" UNIQUE("name"),
        CONSTRAINT "store_product_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "store_products" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar NOT NULL,
        "short_description" text,
        "full_description" text,
        "category_id" varchar NOT NULL,
        "product_type" varchar NOT NULL,
        "price" numeric(15, 2),
        "currency" varchar DEFAULT 'INR',
        "minimum_investment" numeric(15, 2),
        "lock_in_period" integer,
        "risk_level" varchar,
        "expected_returns" numeric(5, 2),
        "features" jsonb,
        "eligibility" jsonb,
        "documents" jsonb,
        "provider" varchar,
        "provider_code" varchar,
        "regulatory" jsonb,
        "is_active" boolean DEFAULT true,
        "is_featured" boolean DEFAULT false,
        "display_order" integer DEFAULT 0,
        "launch_date" date,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "structured_tax_data" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "document_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "data_type" varchar NOT NULL,
        "data_category" varchar,
        "source_type" varchar,
        "taxable_amount" numeric(15, 2),
        "tax_deducted" numeric(15, 2),
        "net_amount" numeric(15, 2),
        "tax_rate" numeric(5, 2),
        "transaction_date" date,
        "deductor_pan" varchar,
        "deductor_name" varchar,
        "deductor_tan" varchar,
        "certificate_number" varchar,
        "income_nature" varchar,
        "employer_name" varchar,
        "employer_address" text,
        "bank_name" varchar,
        "account_number" varchar,
        "instrument_type" varchar,
        "remarks" text,
        "original_section" varchar,
        "metadata" jsonb,
        "is_verified" boolean DEFAULT false,
        "verification_source" varchar,
        "discrepancy_flags" jsonb DEFAULT '[]'::jsonb,
        "include_in_itr" boolean DEFAULT true,
        "itr_section" varchar,
        "itr_line_item" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "supplier_id" varchar NOT NULL,
        "product_name" varchar NOT NULL,
        "description" text,
        "price" numeric(15, 2) NOT NULL,
        "profit_margin" numeric(5, 2) NOT NULL,
        "category" varchar,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" varchar NOT NULL,
        "contact_email" varchar,
        "contact_phone" varchar,
        "address" text,
        "product_categories" text[],
        "performance_rating" numeric(3, 2) DEFAULT '0.00',
        "commission_rate" numeric(5, 2) DEFAULT '0.00',
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ticket_number" varchar NOT NULL,
        "user_id" varchar,
        "client_name" varchar NOT NULL,
        "client_email" varchar NOT NULL,
        "client_phone" varchar,
        "subject" varchar NOT NULL,
        "description" text NOT NULL,
        "category" varchar NOT NULL,
        "priority" varchar DEFAULT 'medium',
        "status" varchar DEFAULT 'open',
        "assigned_to" varchar,
        "assigned_by" varchar,
        "resolution" text,
        "resolved_at" timestamp,
        "source" varchar DEFAULT 'web',
        "attachments" jsonb DEFAULT '[]'::jsonb,
        "tags" text[] DEFAULT '{}',
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "support_tickets_ticket_number_unique" UNIQUE("ticket_number")
);
--> statement-breakpoint
CREATE TABLE "system_health_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "service_name" varchar NOT NULL,
        "service_category" varchar NOT NULL,
        "status" varchar NOT NULL,
        "status_code" integer,
        "latency_ms" integer,
        "error_rate" numeric(5, 2),
        "uptime" numeric(5, 2),
        "endpoint" varchar,
        "error_message" text,
        "metadata" jsonb,
        "checked_at" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_calculations" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "calculation_type" varchar DEFAULT 'comprehensive',
        "tax_regime" varchar DEFAULT 'new',
        "calculation_status" varchar DEFAULT 'draft',
        "total_income" numeric(15, 2),
        "exempt_income" numeric(15, 2),
        "taxable_income" numeric(15, 2),
        "standard_deduction" numeric(15, 2),
        "section_80c_deductions" numeric(15, 2),
        "other_deductions" numeric(15, 2),
        "total_deductions" numeric(15, 2),
        "gross_tax_liability" numeric(15, 2),
        "rebate_under_87a" numeric(15, 2),
        "net_tax_liability" numeric(15, 2),
        "education_cess" numeric(15, 2),
        "total_tax_payable" numeric(15, 2),
        "tds_deducted" numeric(15, 2),
        "advance_tax_paid" numeric(15, 2),
        "self_assessment_tax" numeric(15, 2),
        "total_tax_paid" numeric(15, 2),
        "refund_due" numeric(15, 2),
        "tax_payable" numeric(15, 2),
        "income_breakdown" jsonb,
        "deduction_breakdown" jsonb,
        "tax_breakdown" jsonb,
        "comparison_old_vs_new" jsonb,
        "itr_form" varchar,
        "itr_json_generated" boolean DEFAULT false,
        "itr_json_url" text,
        "tax_saving_suggestions" jsonb,
        "optimization_opportunities" jsonb,
        "next_year_projections" jsonb,
        "validation_warnings" jsonb DEFAULT '[]'::jsonb,
        "compliance_checks" jsonb,
        "last_validated_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_data_sources" (
        "id" varchar PRIMARY KEY NOT NULL,
        "session_id" varchar NOT NULL,
        "name" varchar NOT NULL,
        "status" varchar DEFAULT 'disconnected' NOT NULL,
        "last_sync" timestamp,
        "records_count" integer DEFAULT 0,
        "data_types" jsonb DEFAULT '[]'::jsonb,
        "sync_duration" integer,
        "error_message" text,
        "api_endpoint" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_document_access_log" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "document_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "action_type" varchar NOT NULL,
        "access_method" varchar,
        "access_source" varchar,
        "ip_address" varchar,
        "user_agent" text,
        "session_id" varchar,
        "purpose" varchar,
        "data_shared" boolean DEFAULT false,
        "export_format" varchar,
        "accessed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_documents" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "document_type" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "original_file_name" varchar NOT NULL,
        "file_format" varchar NOT NULL,
        "file_size" integer,
        "file_url" text,
        "encryption_key" varchar,
        "processing_status" varchar DEFAULT 'pending',
        "processing_started_at" timestamp,
        "processing_completed_at" timestamp,
        "processing_error" text,
        "document_password" varchar,
        "document_date" date,
        "pan_number" varchar,
        "assessment_year" varchar,
        "is_validated" boolean DEFAULT false,
        "validation_errors" jsonb DEFAULT '[]'::jsonb,
        "checksum_hash" varchar,
        "user_consent" boolean DEFAULT false,
        "consent_given_at" timestamp,
        "data_retention_period" integer DEFAULT 7,
        "auto_delete_at" timestamp,
        "uploaded_from_ip" varchar,
        "uploaded_user_agent" text,
        "accessed_count" integer DEFAULT 0,
        "last_accessed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_reminder_subscriptions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "itr_form_type" varchar NOT NULL,
        "subscription_status" varchar DEFAULT 'active' NOT NULL,
        "pricing_tier" varchar NOT NULL,
        "annual_price" numeric(10, 2) NOT NULL,
        "is_free" boolean DEFAULT false NOT NULL,
        "stripe_subscription_id" varchar,
        "valid_from" date NOT NULL,
        "valid_until" date NOT NULL,
        "reminder_channels" jsonb DEFAULT '["email"]' NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_rules" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "rule_type" varchar NOT NULL,
        "category" varchar NOT NULL,
        "value" numeric(10, 2) NOT NULL,
        "min_amount" numeric(15, 2),
        "max_amount" numeric(15, 2),
        "effective_from" date NOT NULL,
        "effective_to" date,
        "is_active" boolean DEFAULT true NOT NULL,
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tax_sessions" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "pan_number" varchar NOT NULL,
        "assessment_year" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "status" varchar DEFAULT 'created' NOT NULL,
        "current_step" integer DEFAULT 1,
        "suggested_itr_form" varchar,
        "suggested_tax_regime" varchar DEFAULT 'new',
        "auto_selection_reason" text,
        "completion_percentage" integer DEFAULT 0,
        "data_sources_connected" integer DEFAULT 0,
        "validation_issues_count" integer DEFAULT 0,
        "aggregation_started_at" timestamp,
        "aggregation_completed_at" timestamp,
        "validation_completed_at" timestamp,
        "filing_completed_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_messages" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "ticket_id" varchar NOT NULL,
        "sender_id" varchar,
        "sender_type" varchar NOT NULL,
        "sender_name" varchar NOT NULL,
        "message" text NOT NULL,
        "message_type" varchar DEFAULT 'text',
        "attachments" jsonb DEFAULT '[]'::jsonb,
        "is_internal" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_alerts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "transaction_id" varchar,
        "alert_type" varchar NOT NULL,
        "severity" varchar NOT NULL,
        "alert_category" varchar NOT NULL,
        "alert_title" varchar NOT NULL,
        "alert_description" text NOT NULL,
        "risk_score" integer,
        "confidence_level" integer,
        "trigger_conditions" jsonb,
        "threshold_exceeded" jsonb,
        "historical_comparison" jsonb,
        "status" varchar DEFAULT 'open',
        "assigned_to" varchar,
        "resolution_notes" text,
        "resolution_action" varchar,
        "notification_sent" boolean DEFAULT false,
        "notification_method" varchar,
        "client_notified" boolean DEFAULT false,
        "requires_client_response" boolean DEFAULT false,
        "follow_up_required" boolean DEFAULT false,
        "follow_up_date" timestamp,
        "escalation_level" integer DEFAULT 0,
        "regulatory_reporting_required" boolean DEFAULT false,
        "alert_source" varchar,
        "detected_at" timestamp DEFAULT now(),
        "acknowledged_at" timestamp,
        "resolved_at" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_enrichment_analysis" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "analysis_type" varchar NOT NULL,
        "from_date" date NOT NULL,
        "to_date" date NOT NULL,
        "transaction_count" integer DEFAULT 0,
        "total_inflow" numeric(15, 2),
        "total_outflow" numeric(15, 2),
        "net_cash_flow" numeric(15, 2),
        "average_monthly_income" numeric(15, 2),
        "average_monthly_expense" numeric(15, 2),
        "spending_patterns" jsonb,
        "income_patterns" jsonb,
        "timing_patterns" jsonb,
        "frequency_patterns" jsonb,
        "risk_factors" jsonb,
        "risk_score" integer,
        "risk_category" varchar,
        "creditworthiness_score" integer,
        "disposable_income" numeric(15, 2),
        "investment_capacity" numeric(15, 2),
        "emergency_fund_status" varchar,
        "debt_to_income_ratio" numeric(5, 2),
        "ai_model_version" varchar,
        "analysis_confidence" integer,
        "last_updated" timestamp DEFAULT now(),
        "next_analysis_date" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_records" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "report_id" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "transaction_date" date NOT NULL,
        "transaction_type" varchar NOT NULL,
        "fund_name" text NOT NULL,
        "fund_code" varchar,
        "folio" varchar,
        "units" numeric(15, 6),
        "nav" numeric(15, 4),
        "amount" numeric(15, 2),
        "brokerage" numeric(15, 2) DEFAULT '0',
        "stt" numeric(15, 2) DEFAULT '0',
        "stamp_duty" numeric(15, 2) DEFAULT '0',
        "gst" numeric(15, 2) DEFAULT '0',
        "tds" numeric(15, 2) DEFAULT '0',
        "net_amount" numeric(15, 2),
        "registrar" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transaction_reports" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "financial_year" varchar NOT NULL,
        "source" varchar NOT NULL,
        "asset_type" varchar NOT NULL,
        "total_purchases" numeric(15, 2) DEFAULT '0',
        "total_redemptions" numeric(15, 2) DEFAULT '0',
        "total_switches" numeric(15, 2) DEFAULT '0',
        "total_dividend_received" numeric(15, 2) DEFAULT '0',
        "total_brokerage" numeric(15, 2) DEFAULT '0',
        "total_taxes" numeric(15, 2) DEFAULT '0',
        "transaction_count" integer DEFAULT 0,
        "report_data" jsonb,
        "generated_at" timestamp DEFAULT now(),
        "fetched_at" timestamp,
        "status" varchar DEFAULT 'pending',
        "error_message" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "unified_orders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "order_number" varchar NOT NULL,
        "user_id" varchar NOT NULL,
        "product_type" varchar NOT NULL,
        "product_id" varchar,
        "product_name" text NOT NULL,
        "order_type" varchar NOT NULL,
        "quantity" numeric(18, 4),
        "amount" numeric(18, 2) NOT NULL,
        "currency" varchar DEFAULT 'INR',
        "cart_id" varchar,
        "proposal_id" varchar,
        "portfolio_id" varchar,
        "agent_id" varchar,
        "arn_code" varchar,
        "euin_number" varchar,
        "status" varchar DEFAULT 'initiated' NOT NULL,
        "payment_status" varchar DEFAULT 'pending',
        "payment_gateway" varchar,
        "payment_transaction_id" varchar,
        "payment_amount" numeric(18, 2),
        "payment_completed_at" timestamp,
        "kyc_status" varchar DEFAULT 'pending',
        "kyc_tier" varchar,
        "kyc_verified_at" timestamp,
        "kyc_rejection_reason" text,
        "execution_status" varchar DEFAULT 'pending',
        "external_order_id" varchar,
        "external_reference" varchar,
        "execution_price" numeric(18, 6),
        "executed_quantity" numeric(18, 4),
        "executed_at" timestamp,
        "execution_error" text,
        "settlement_status" varchar DEFAULT 'pending',
        "settlement_date" timestamp,
        "settlement_reference" varchar,
        "metadata" jsonb,
        "notes" text,
        "cancellation_reason" text,
        "created_by" varchar,
        "assigned_to" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        "completed_at" timestamp,
        "cancelled_at" timestamp,
        CONSTRAINT "unified_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "achievement_id" varchar,
        "earned_at" timestamp DEFAULT now(),
        "progress" numeric(5, 2) DEFAULT '0',
        "is_completed" boolean DEFAULT false,
        "shared_count" integer DEFAULT 0,
        "last_shared_at" timestamp,
        "metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "user_activities" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "action" varchar NOT NULL,
        "resource" varchar,
        "details" jsonb,
        "ip_address" varchar,
        "user_agent" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_alerts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "alert_name" text NOT NULL,
        "alert_type" varchar NOT NULL,
        "category" varchar NOT NULL,
        "symbol" varchar,
        "asset_type" varchar,
        "trigger_condition" jsonb NOT NULL,
        "spending_category" varchar,
        "spending_period" varchar,
        "notification_channels" jsonb DEFAULT '["email"]'::jsonb,
        "is_active" boolean DEFAULT true,
        "priority" varchar DEFAULT 'medium',
        "cooldown_period" integer DEFAULT 3600,
        "last_triggered_at" timestamp,
        "trigger_count" integer DEFAULT 0,
        "description" text,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_bank_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "bank_name" varchar NOT NULL,
        "account_number" varchar NOT NULL,
        "ifsc_code" varchar NOT NULL,
        "branch_name" varchar,
        "account_type" varchar DEFAULT 'savings',
        "account_holder_name" varchar,
        "is_default_for_mutual_funds" boolean DEFAULT false,
        "is_active" boolean DEFAULT true,
        "is_verified" boolean DEFAULT false,
        "verification_status" varchar DEFAULT 'pending',
        "verification_date" timestamp,
        "penny_drop_transaction_id" varchar,
        "penny_drop_amount" numeric(10, 2),
        "name_match_score" integer,
        "bank_account_status" varchar,
        "verification_method" varchar DEFAULT 'pending',
        "verification_attempts" integer DEFAULT 0,
        "last_verification_attempt" timestamp,
        "provider_response" jsonb,
        "verified_account_holder_name" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_budgets" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "budget_name" text NOT NULL,
        "category" varchar NOT NULL,
        "subcategory" varchar,
        "budget_amount" numeric(15, 2) NOT NULL,
        "period_type" varchar NOT NULL,
        "currency" varchar DEFAULT 'INR' NOT NULL,
        "spent_amount" numeric(15, 2) DEFAULT '0',
        "alert_threshold" numeric(5, 2) DEFAULT '80',
        "is_active" boolean DEFAULT true,
        "start_date" date NOT NULL,
        "end_date" date,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_cart" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_cart_items" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "cart_id" varchar NOT NULL,
        "product_id" varchar,
        "proposal_id" varchar,
        "investment_id" varchar,
        "item_type" varchar DEFAULT 'product' NOT NULL,
        "quantity" integer DEFAULT 1 NOT NULL,
        "investment_amount" numeric(15, 2),
        "proposal_item_ids" text[],
        "metadata" jsonb DEFAULT '{}'::jsonb,
        "added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_demat_accounts" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "demat_account_number" varchar NOT NULL,
        "demat_dp_id" varchar NOT NULL,
        "demat_dp_name" varchar NOT NULL,
        "depository_type" varchar NOT NULL,
        "account_holder_name" varchar NOT NULL,
        "nsdl_client_id" varchar,
        "cdsl_bo_id" varchar,
        "trading_account_number" varchar,
        "broker_name" varchar,
        "pan_number" varchar,
        "is_default_for_equity_transactions" boolean DEFAULT false,
        "is_default_for_mutual_fund_transactions" boolean DEFAULT false,
        "is_active" boolean DEFAULT true,
        "is_verified" boolean DEFAULT false,
        "verification_status" varchar DEFAULT 'pending',
        "verification_date" timestamp,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_expenses" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "amount" numeric(15, 2) NOT NULL,
        "currency" varchar DEFAULT 'INR' NOT NULL,
        "description" text NOT NULL,
        "transaction_date" timestamp NOT NULL,
        "category" varchar NOT NULL,
        "subcategory" varchar,
        "ai_categorized" boolean DEFAULT false,
        "ai_confidence" numeric(5, 2),
        "suggested_categories" jsonb,
        "payment_method" varchar,
        "merchant_name" varchar,
        "tags" jsonb,
        "receipt_url" varchar,
        "notes" text,
        "is_recurring" boolean DEFAULT false,
        "recurring_frequency" varchar,
        "recurring_group_id" varchar,
        "bbps_transaction_id" varchar,
        "is_bbps_payment" boolean DEFAULT false,
        "is_verified" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_notifications" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar,
        "type" varchar NOT NULL,
        "title" varchar NOT NULL,
        "message" text NOT NULL,
        "action_url" varchar,
        "is_read" boolean DEFAULT false,
        "priority" varchar DEFAULT 'medium',
        "expires_at" timestamp,
        "created_by" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "client_type" varchar DEFAULT 'individual',
        "entity_type" varchar,
        "first_name" varchar,
        "middle_name" varchar,
        "last_name" varchar,
        "gender" varchar,
        "company_name" varchar,
        "entity_registration_number" varchar,
        "incorporation_date" date,
        "business_nature" varchar,
        "company_pan_number" varchar,
        "authorized_persons" jsonb DEFAULT '[]'::jsonb,
        "board_of_directors" jsonb DEFAULT '[]'::jsonb,
        "beneficial_owners" jsonb DEFAULT '[]'::jsonb,
        "resident_status" varchar DEFAULT 'resident_indian',
        "nri_sub_type" varchar,
        "country_of_residence" varchar DEFAULT 'India',
        "country_of_citizenship" varchar DEFAULT 'India',
        "passport_country" varchar,
        "visa_type" varchar,
        "permanent_residence_status" varchar,
        "nri_exchange_rate" varchar,
        "nri_repatriation_type" varchar,
        "overseas_bank_details" jsonb,
        "local_guardian_details" text,
        "pan_number" varchar,
        "aadhar_number" varchar,
        "passport_number" varchar,
        "driving_license" varchar,
        "voter_id_number" varchar,
        "date_of_birth" varchar,
        "nationality" varchar,
        "father_name" varchar,
        "mother_name" varchar,
        "spouse_name" varchar,
        "marital_status" varchar,
        "address" text,
        "city" varchar,
        "state" varchar,
        "pincode" varchar,
        "country" varchar,
        "occupation" varchar,
        "annual_income" varchar,
        "investment_experience" varchar,
        "risk_tolerance" varchar,
        "bank_account_number" varchar,
        "ifsc_code" varchar,
        "nominee_details" text,
        "nominee_relation" varchar,
        "euin_number" varchar,
        "arn_code" varchar,
        "amc_code" varchar,
        "distributor_id" varchar,
        "is_agent" boolean DEFAULT false,
        "agent_type" varchar,
        "enable_cams_api" boolean DEFAULT false,
        "enable_kfintech_api" boolean DEFAULT false,
        "enable_nsdl_api" boolean DEFAULT false,
        "enable_cdsl_api" boolean DEFAULT false,
        "preferred_cams_registration" boolean DEFAULT false,
        "preferred_kfintech_registration" boolean DEFAULT false,
        "preferred_nsdl_registration" boolean DEFAULT false,
        "preferred_cdsl_registration" boolean DEFAULT false,
        "fatca_status" varchar,
        "fatca_declaration_date" timestamp,
        "fatca_tin_number" varchar,
        "fatca_country_of_tax_residence" varchar,
        "fatca_reason_code" varchar,
        "fatca_w8_ben_status" varchar,
        "fatca_w9_status" varchar,
        "fatca_taxpayer_id_type" varchar,
        "pep_status" varchar DEFAULT 'N',
        "pep_related_person_status" varchar DEFAULT 'N',
        "pep_details" text,
        "pep_country" varchar,
        "pep_position" varchar,
        "pep_relationship_type" varchar,
        "visa_status" varchar,
        "aml_status" varchar DEFAULT 'clear',
        "aml_last_checked" timestamp,
        "aml_risk_score" integer DEFAULT 0,
        "sanction_list_status" varchar DEFAULT 'clear',
        "sanction_list_last_checked" timestamp,
        "cdd_level" varchar DEFAULT 'simplified',
        "edd_required" boolean DEFAULT false,
        "edd_reason" text,
        "edd_completed_date" timestamp,
        "edd_next_review_date" timestamp,
        "edd_completed_by" varchar,
        "source_of_funds" varchar,
        "source_of_wealth_documentation" text,
        "source_of_wealth_verified" boolean DEFAULT false,
        "source_of_wealth_verification_date" timestamp,
        "risk_category" varchar DEFAULT 'low',
        "risk_category_reason" text,
        "risk_last_assessed" timestamp DEFAULT now(),
        "risk_next_review" timestamp,
        "risk_review_frequency" varchar DEFAULT '10_years',
        "is_high_risk_customer" boolean DEFAULT false,
        "compliance_score" integer DEFAULT 100,
        "last_compliance_review" timestamp DEFAULT now(),
        "next_compliance_review" timestamp,
        "compliance_officer" varchar,
        "is_us_person" boolean DEFAULT false,
        "is_eu_resident" boolean DEFAULT false,
        "gdpr_consent" boolean DEFAULT false,
        "gdpr_consent_date" timestamp,
        "data_processing_consent" boolean DEFAULT false,
        "marketing_consent" boolean DEFAULT false,
        "investor_type" varchar,
        "investor_category" varchar,
        "financial_situation" varchar,
        "investment_objective" varchar,
        "video_kyc_completed" boolean DEFAULT false,
        "video_kyc_completed_date" timestamp,
        "video_kyc_provider" varchar,
        "video_kyc_session_id" varchar,
        "video_kyc_status" varchar DEFAULT 'pending',
        "video_kyc_expiry_date" timestamp,
        "video_kyc_technician_id" varchar,
        "is_video_kyc_equivalent_to_face_to_face" boolean DEFAULT true,
        "kyc_onboarding_method" varchar DEFAULT 'non_face_to_face',
        "requires_enhanced_due_diligence" boolean DEFAULT true,
        "face_to_face_verification_required" boolean DEFAULT false,
        "face_to_face_verification_completed" boolean DEFAULT false,
        "face_to_face_verification_date" timestamp,
        "ubo_declaration_completed" boolean DEFAULT false,
        "ubo_details" jsonb DEFAULT '[]'::jsonb,
        "ubo_verification_status" varchar DEFAULT 'pending',
        "ubo_last_updated" timestamp,
        "ubo_next_review_date" timestamp,
        "kyc_update_due_date" timestamp,
        "kyc_update_reminders_sent" integer DEFAULT 0,
        "kyc_last_updated_date" timestamp DEFAULT now(),
        "kyc_update_method" varchar,
        "kyc_update_notification_preference" varchar DEFAULT 'email',
        "bc_assisted_kyc" boolean DEFAULT false,
        "bc_id" varchar,
        "bc_name" varchar,
        "bc_assisted_date" timestamp,
        "kyc_tier" varchar DEFAULT 'basic',
        "kyc_tier_upgraded_at" timestamp,
        "kyc_tier_upgrade_requested_at" timestamp,
        "accredited_investor_status" varchar DEFAULT 'not_applicable',
        "accredited_investor_type" varchar,
        "accredited_investor_verified_at" timestamp,
        "accredited_investor_verified_by" varchar,
        "accredited_investor_expiry_date" timestamp,
        "annual_income_amount" numeric(15, 2),
        "annual_income_currency" varchar DEFAULT 'INR',
        "net_worth_amount" numeric(15, 2),
        "net_worth_excluding_residence" numeric(15, 2),
        "net_worth_currency" varchar DEFAULT 'INR',
        "portfolio_value_amount" numeric(15, 2),
        "portfolio_value_currency" varchar DEFAULT 'INR',
        "professional_qualification" varchar,
        "professional_qualification_number" varchar,
        "professional_qualification_verified" boolean DEFAULT false,
        "professional_experience_years" integer,
        "ca_certificate_url" varchar,
        "ca_certificate_verified_at" timestamp,
        "ca_certificate_name" varchar,
        "income_proof_documents" jsonb DEFAULT '[]'::jsonb,
        "net_worth_statement_url" varchar,
        "portfolio_statement_url" varchar,
        "accredited_investor_rejection_reason" text,
        "ai_certificate_number" varchar,
        "ai_certificate_id" varchar,
        "ai_verified_at" timestamp,
        "risk_declaration_url" varchar,
        "ai_esign_status" varchar,
        "ai_status_source" varchar DEFAULT 'bse',
        "products_unlocked" jsonb DEFAULT '[]'::jsonb,
        "products_access_matrix" jsonb DEFAULT '{}'::jsonb,
        "last_product_access_update" timestamp DEFAULT now(),
        "profile_completeness" integer DEFAULT 0,
        "is_profile_completed" boolean DEFAULT false,
        "profile_completed_at" timestamp,
        "last_updated" timestamp DEFAULT now(),
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_progress" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "module_id" varchar,
        "lesson_id" varchar,
        "status" varchar NOT NULL,
        "score" integer DEFAULT 0,
        "completed_at" timestamp,
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_stats" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "total_points" integer DEFAULT 0,
        "current_streak" integer DEFAULT 0,
        "max_streak" integer DEFAULT 0,
        "modules_completed" integer DEFAULT 0,
        "lessons_completed" integer DEFAULT 0,
        "quizzes_completed" integer DEFAULT 0,
        "average_score" numeric(5, 2) DEFAULT '0',
        "last_activity_at" timestamp,
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "user_stats_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_wishlist" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "product_id" varchar NOT NULL,
        "added_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "email" varchar,
        "mobile" varchar,
        "password" text NOT NULL,
        "first_name" varchar,
        "middle_name" varchar,
        "last_name" varchar,
        "profile_image_url" varchar,
        "is_email_verified" boolean DEFAULT false,
        "is_mobile_verified" boolean DEFAULT false,
        "pan_number" varchar,
        "aadhar_number" varchar,
        "passport_number" varchar,
        "driving_license" varchar,
        "voter_id_number" varchar,
        "date_of_birth" varchar,
        "nationality" varchar,
        "father_name" varchar,
        "mother_name" varchar,
        "spouse_name" varchar,
        "marital_status" varchar,
        "address" text,
        "city" varchar,
        "state" varchar,
        "pincode" varchar,
        "country" varchar,
        "occupation" varchar,
        "annual_income" varchar,
        "investment_experience" varchar,
        "risk_tolerance" varchar,
        "source_of_wealth" varchar,
        "resident_status" varchar,
        "country_of_residence" varchar,
        "tax_residency_country" varchar,
        "fatca_status" varchar,
        "fatca_tin_number" varchar,
        "fatca_country_of_tax_residence" varchar,
        "pep_status" varchar,
        "pep_details" text,
        "is_ubo" boolean DEFAULT false,
        "ubo_details" text,
        "bank_account_number" varchar,
        "ifsc_code" varchar,
        "nominee_details" text,
        "nominee_relation" varchar,
        "euin_number" varchar,
        "enable_cams_api" boolean DEFAULT false,
        "enable_kfintech_api" boolean DEFAULT false,
        "enable_nsdl_api" boolean DEFAULT false,
        "enable_cdsl_api" boolean DEFAULT false,
        "nsdl_dp_id" varchar,
        "nsdl_client_id" varchar,
        "cdsl_bo_id" varchar,
        "cdsl_dp_id" varchar,
        "pan_verification_consent" boolean DEFAULT false,
        "pan_consent_given_at" timestamp,
        "pan_consent_ip_address" varchar,
        "pan_consent_user_agent" text,
        "pan_consent_version" varchar DEFAULT '1.0',
        "preferred_cams_registration" boolean DEFAULT false,
        "preferred_kfintech_registration" boolean DEFAULT false,
        "preferred_nsdl_registration" boolean DEFAULT false,
        "preferred_cdsl_registration" boolean DEFAULT false,
        "agent_id" varchar,
        "arn_code" varchar,
        "distributor_id" varchar,
        "compliance_officer" varchar,
        "client_type" varchar,
        "company_name" varchar,
        "entity_type" varchar,
        "entity_registration_number" varchar,
        "incorporation_date" varchar,
        "business_nature" varchar,
        "country_of_citizenship" varchar,
        "is_us_person" boolean DEFAULT false,
        "is_eu_resident" boolean DEFAULT false,
        "gdpr_consent" boolean DEFAULT false,
        "gdpr_consent_date" timestamp,
        "data_processing_consent" boolean DEFAULT false,
        "marketing_consent" boolean DEFAULT false,
        "investor_type" varchar,
        "investor_category" varchar,
        "financial_situation" varchar,
        "investment_objective" varchar,
        "profile_completeness" integer DEFAULT 0,
        "is_profile_completed" boolean DEFAULT false,
        "profile_completed_at" timestamp,
        "last_updated" timestamp DEFAULT now(),
        "digilocker_address" text,
        "digilocker_dob" varchar,
        "digilocker_gender" varchar,
        "digilocker_full_name" varchar,
        "aadhaar_last_four" varchar,
        "name_match_score" integer,
        "name_reconciliation_status" varchar,
        "name_reconciliation_note" text,
        "pan_verified_via_smart_kyc" boolean DEFAULT false,
        "pan_verification_date" timestamp,
        "aadhaar_verified_via_smart_kyc" boolean DEFAULT false,
        "aadhaar_verification_date" timestamp,
        "smart_kyc_completed_at" timestamp,
        "otp_preference_email" boolean DEFAULT true,
        "otp_preference_sms" boolean DEFAULT false,
        "otp_preference_whatsapp" boolean DEFAULT true,
        "roles" varchar[] DEFAULT ARRAY['user'],
        "is_active" boolean DEFAULT true,
        "last_login_at" timestamp,
        "previous_login_at" timestamp,
        "login_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "users_user_id_unique" UNIQUE("user_id"),
        CONSTRAINT "users_pan_number_unique" UNIQUE("pan_number"),
        CONSTRAINT "users_aadhar_number_unique" UNIQUE("aadhar_number")
);
--> statement-breakpoint
CREATE TABLE "validation_issues" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "session_id" varchar NOT NULL,
        "section" varchar NOT NULL,
        "field" varchar,
        "severity" varchar NOT NULL,
        "message" text NOT NULL,
        "fix_hint" text,
        "auto_fixable" boolean DEFAULT false,
        "status" varchar DEFAULT 'open' NOT NULL,
        "resolved_at" timestamp,
        "resolved_by" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "name" text NOT NULL,
        "symbols" text[],
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "provider" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "method" varchar DEFAULT 'POST',
        "endpoint" varchar NOT NULL,
        "headers" jsonb,
        "payload" jsonb NOT NULL,
        "status_code" integer,
        "response_body" jsonb,
        "response_time" integer,
        "processing_status" varchar DEFAULT 'pending',
        "processing_error" text,
        "retry_count" integer DEFAULT 0,
        "signature_verified" boolean DEFAULT false,
        "ip_address" varchar,
        "order_id" varchar,
        "transaction_id" varchar,
        "user_id" varchar,
        "received_at" timestamp DEFAULT now(),
        "processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "yield_tracker" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "idea_id" varchar,
        "strategy_name" varchar NOT NULL,
        "strategy_type" varchar NOT NULL,
        "total_investment" numeric(15, 2) NOT NULL,
        "current_value" numeric(15, 2),
        "total_return" numeric(15, 2),
        "total_return_percent" numeric(8, 4),
        "dividend_yield" numeric(6, 4),
        "capital_gains_yield" numeric(8, 4),
        "total_yield" numeric(8, 4),
        "annualized_return" numeric(8, 4),
        "sharpe_ratio" numeric(6, 4),
        "sortino_ratio" numeric(6, 4),
        "max_drawdown" numeric(8, 4),
        "volatility" numeric(8, 4),
        "benchmark_return" numeric(8, 4),
        "alpha" numeric(8, 4),
        "beta" numeric(6, 4),
        "start_date" timestamp NOT NULL,
        "end_date" timestamp,
        "days_active" integer,
        "is_active" boolean DEFAULT true,
        "last_updated" timestamp DEFAULT CURRENT_TIMESTAMP,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_categories" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "zoho_category_id" varchar,
        "local_category_id" varchar,
        "name" varchar NOT NULL,
        "description" text,
        "parent_id" varchar,
        "sort_order" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "seo_title" varchar,
        "seo_description" text,
        "image_url" varchar,
        "sync_status" varchar DEFAULT 'pending',
        "last_sync_at" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_commerce_config" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "client_id" varchar NOT NULL,
        "client_secret" varchar NOT NULL,
        "redirect_uri" varchar NOT NULL,
        "base_url" varchar NOT NULL,
        "scope" jsonb NOT NULL,
        "access_token" text,
        "refresh_token" text,
        "token_expiry" timestamp,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_commerce_sync_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "sync_type" varchar NOT NULL,
        "status" varchar NOT NULL,
        "records_processed" integer DEFAULT 0,
        "records_success" integer DEFAULT 0,
        "records_error" integer DEFAULT 0,
        "error_details" jsonb,
        "started_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "completed_at" timestamp,
        "duration" integer
);
--> statement-breakpoint
CREATE TABLE "zoho_commerce_webhooks" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "zoho_webhook_id" varchar,
        "event_type" varchar NOT NULL,
        "target_url" varchar NOT NULL,
        "is_active" boolean DEFAULT true,
        "secret_key" varchar,
        "last_triggered" timestamp,
        "success_count" integer DEFAULT 0,
        "failure_count" integer DEFAULT 0,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_connections" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "connection_name" varchar NOT NULL,
        "zoho_data_center" varchar DEFAULT 'com',
        "zoho_org_id" varchar,
        "access_token" text NOT NULL,
        "refresh_token" text NOT NULL,
        "token_type" varchar DEFAULT 'Bearer',
        "expires_at" timestamp NOT NULL,
        "scope" text,
        "services" text[] DEFAULT ARRAY[]::text[],
        "status" varchar DEFAULT 'active',
        "last_sync_at" timestamp,
        "last_error_at" timestamp,
        "last_error" text,
        "created_by" varchar,
        "is_production" boolean DEFAULT false,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zoho_customers" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "zoho_customer_id" varchar,
        "local_user_id" varchar,
        "email" varchar NOT NULL,
        "first_name" varchar,
        "last_name" varchar,
        "phone" varchar,
        "addresses" jsonb,
        "order_count" integer DEFAULT 0,
        "total_spent" numeric(10, 2) DEFAULT '0.00',
        "last_order_date" timestamp,
        "accepts_marketing" boolean DEFAULT false,
        "sync_status" varchar DEFAULT 'pending',
        "last_sync_at" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_entity_mappings" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "connection_id" varchar NOT NULL,
        "fintekpro_entity_type" varchar NOT NULL,
        "fintekpro_entity_id" varchar NOT NULL,
        "zoho_service" varchar NOT NULL,
        "zoho_module" varchar NOT NULL,
        "zoho_record_id" varchar NOT NULL,
        "zoho_record_data" jsonb,
        "sync_direction" varchar DEFAULT 'bidirectional',
        "last_synced_at" timestamp,
        "sync_status" varchar DEFAULT 'synced',
        "conflict_data" jsonb,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zoho_inventory" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "product_id" varchar NOT NULL,
        "variant_id" varchar,
        "sku" varchar,
        "quantity" integer DEFAULT 0,
        "reserved_quantity" integer DEFAULT 0,
        "available_quantity" integer DEFAULT 0,
        "reorder_level" integer DEFAULT 0,
        "reorder_quantity" integer DEFAULT 0,
        "cost" numeric(10, 2),
        "location" varchar,
        "sync_status" varchar DEFAULT 'pending',
        "last_sync_at" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_orders" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "zoho_order_id" varchar,
        "order_number" varchar,
        "customer_id" varchar,
        "customer_email" varchar,
        "billing_address" jsonb,
        "shipping_address" jsonb,
        "line_items" jsonb,
        "subtotal" numeric(10, 2),
        "total_tax" numeric(10, 2),
        "total_price" numeric(10, 2),
        "currency" varchar DEFAULT 'INR',
        "order_status" varchar DEFAULT 'pending',
        "payment_status" varchar DEFAULT 'pending',
        "fulfillment_status" varchar DEFAULT 'unfulfilled',
        "notes" text,
        "sync_status" varchar DEFAULT 'pending',
        "last_sync_at" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_products" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "user_id" varchar NOT NULL,
        "zoho_product_id" varchar,
        "local_product_id" varchar,
        "name" varchar NOT NULL,
        "description" text,
        "price" numeric(10, 2) NOT NULL,
        "compare_price" numeric(10, 2),
        "sku" varchar,
        "weight" numeric(8, 2),
        "weight_unit" varchar DEFAULT 'kg',
        "track_quantity" boolean DEFAULT true,
        "quantity" integer DEFAULT 0,
        "category_id" varchar,
        "brand" varchar,
        "tags" jsonb,
        "images" jsonb,
        "variants" jsonb,
        "seo_title" varchar,
        "seo_description" text,
        "status" varchar DEFAULT 'active',
        "sync_status" varchar DEFAULT 'pending',
        "last_sync_at" timestamp,
        "created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "zoho_sync_logs" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "connection_id" varchar,
        "operation" varchar NOT NULL,
        "entity_type" varchar NOT NULL,
        "direction" varchar NOT NULL,
        "zoho_service" varchar NOT NULL,
        "zoho_module" varchar,
        "zoho_api_endpoint" text,
        "zoho_request_payload" jsonb,
        "zoho_response_data" jsonb,
        "status" varchar NOT NULL,
        "records_processed" integer DEFAULT 0,
        "records_succeeded" integer DEFAULT 0,
        "records_failed" integer DEFAULT 0,
        "error_message" text,
        "error_details" jsonb,
        "duration_ms" integer,
        "api_credits_used" integer,
        "triggered_by" varchar,
        "user_id" varchar,
        "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "zoho_webhook_events" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "connection_id" varchar,
        "zoho_service" varchar NOT NULL,
        "zoho_module" varchar NOT NULL,
        "event_type" varchar NOT NULL,
        "zoho_record_id" varchar,
        "webhook_payload" jsonb NOT NULL,
        "headers" jsonb,
        "status" varchar DEFAULT 'pending',
        "processed_at" timestamp,
        "processing_error" text,
        "retry_count" integer DEFAULT 0,
        "next_retry_at" timestamp,
        "mapping_id" varchar,
        "zoho_event_id" varchar,
        "created_at" timestamp DEFAULT now(),
        "updated_at" timestamp DEFAULT now(),
        CONSTRAINT "zoho_webhook_events_zoho_event_id_unique" UNIQUE("zoho_event_id")
);
--> statement-breakpoint
ALTER TABLE "aa_consents" ADD CONSTRAINT "aa_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD CONSTRAINT "aa_data_fetch_logs_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_data_fetch_logs" ADD CONSTRAINT "aa_data_fetch_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_discovered_accounts" ADD CONSTRAINT "aa_discovered_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_discovered_accounts" ADD CONSTRAINT "aa_discovered_accounts_consent_id_aa_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."aa_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aa_discovered_accounts" ADD CONSTRAINT "aa_discovered_accounts_linked_to_portfolio_id_portfolios_id_fk" FOREIGN KEY ("linked_to_portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accredited_investor_verifications" ADD CONSTRAINT "accredited_investor_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accredited_investor_verifications" ADD CONSTRAINT "accredited_investor_verifications_session_id_production_kyc_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."production_kyc_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_category_id_achievement_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."achievement_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_settings" ADD CONSTRAINT "admin_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping" ADD CONSTRAINT "agent_client_mapping_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping" ADD CONSTRAINT "agent_client_mapping_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_client_mapping" ADD CONSTRAINT "agent_client_mapping_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_sub_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("sub_agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_master_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("master_agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commission_splits" ADD CONSTRAINT "agent_commission_splits_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_master_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("master_agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_commissions" ADD CONSTRAINT "agent_commissions_split_rule_id_agent_commission_splits_id_fk" FOREIGN KEY ("split_rule_id") REFERENCES "public"."agent_commission_splits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_documents" ADD CONSTRAINT "agent_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_partner_mappings" ADD CONSTRAINT "agent_partner_mappings_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_partner_mappings" ADD CONSTRAINT "agent_partner_mappings_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_partner_mappings" ADD CONSTRAINT "agent_partner_mappings_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_fix_suggestions" ADD CONSTRAINT "ai_fix_suggestions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_fix_suggestions" ADD CONSTRAINT "ai_fix_suggestions_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_optimization_suggestions" ADD CONSTRAINT "ai_optimization_suggestions_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_transaction_tracking" ADD CONSTRAINT "ai_transaction_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_alert_id_user_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."user_alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_history" ADD CONSTRAINT "alert_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amfi_verification_log" ADD CONSTRAINT "amfi_verification_log_agent_id_customer_care_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."customer_care_agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amfi_verification_log" ADD CONSTRAINT "amfi_verification_log_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_integration_logs" ADD CONSTRAINT "api_integration_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_integration_logs" ADD CONSTRAINT "api_integration_logs_source_id_external_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."external_data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_loan_applications_marketplace_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."loan_applications_marketplace"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apy_accounts" ADD CONSTRAINT "apy_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_allocation" ADD CONSTRAINT "asset_allocation_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD CONSTRAINT "asset_forecasts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_forecasts" ADD CONSTRAINT "asset_forecasts_holding_id_portfolio_holdings_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."portfolio_holdings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_hash_chain" ADD CONSTRAINT "audit_hash_chain_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_hash_chain" ADD CONSTRAINT "audit_hash_chain_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_population_status" ADD CONSTRAINT "auto_population_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_billers" ADD CONSTRAINT "bbps_billers_category_id_bbps_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."bbps_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD CONSTRAINT "bbps_customer_bills_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_customer_bills" ADD CONSTRAINT "bbps_customer_bills_biller_id_bbps_billers_id_fk" FOREIGN KEY ("biller_id") REFERENCES "public"."bbps_billers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD CONSTRAINT "bbps_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bbps_transactions" ADD CONSTRAINT "bbps_transactions_bill_id_bbps_customer_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bbps_customer_bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD CONSTRAINT "bond_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_holdings" ADD CONSTRAINT "bond_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bond_orders" ADD CONSTRAINT "bond_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bse_ucc_requests" ADD CONSTRAINT "bse_ucc_requests_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bse_ucc_requests" ADD CONSTRAINT "bse_ucc_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bse_ucc_requests" ADD CONSTRAINT "bse_ucc_requests_kra_check_id_kra_status_checks_id_fk" FOREIGN KEY ("kra_check_id") REFERENCES "public"."kra_status_checks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_marketing_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_reports" ADD CONSTRAINT "capital_gains_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD CONSTRAINT "capital_gains_tax_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capital_gains_tax_reminders" ADD CONSTRAINT "capital_gains_tax_reminders_subscription_id_tax_reminder_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."tax_reminder_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cas_requests" ADD CONSTRAINT "cas_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cas_requests" ADD CONSTRAINT "cas_requests_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashfree_ekyc_sessions" ADD CONSTRAINT "cashfree_ekyc_sessions_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashfree_ekyc_sessions" ADD CONSTRAINT "cashfree_ekyc_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cashfree_transactions" ADD CONSTRAINT "cashfree_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cersai_submissions" ADD CONSTRAINT "cersai_submissions_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cersai_submissions" ADD CONSTRAINT "cersai_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cersai_submissions" ADD CONSTRAINT "cersai_submissions_ekyc_session_id_cashfree_ekyc_sessions_id_fk" FOREIGN KEY ("ekyc_session_id") REFERENCES "public"."cashfree_ekyc_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_configurations" ADD CONSTRAINT "chart_configurations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_actions" ADD CONSTRAINT "chat_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_action_logs" ADD CONSTRAINT "ckyc_action_logs_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_documents" ADD CONSTRAINT "ckyc_documents_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_notification_triggers" ADD CONSTRAINT "ckyc_notification_triggers_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_progress_steps" ADD CONSTRAINT "ckyc_progress_steps_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_records" ADD CONSTRAINT "ckyc_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ckyc_status_history" ADD CONSTRAINT "ckyc_status_history_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_relationships" ADD CONSTRAINT "client_agent_relationships_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_relationships" ADD CONSTRAINT "client_agent_relationships_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_agent_relationships" ADD CONSTRAINT "client_agent_relationships_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ADD CONSTRAINT "client_enrichment_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_enrichment_data" ADD CONSTRAINT "client_enrichment_data_source_id_external_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."external_data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_intelligence" ADD CONSTRAINT "client_intelligence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_statements" ADD CONSTRAINT "client_statements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral_valuations" ADD CONSTRAINT "collateral_valuations_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comparison_history" ADD CONSTRAINT "comparison_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_audit_trail" ADD CONSTRAINT "compliance_audit_trail_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_documents" ADD CONSTRAINT "compliance_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_snapshot_id_portfolio_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."portfolio_snapshots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comprehensive_holdings" ADD CONSTRAINT "comprehensive_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "corporate_kyc_progress" ADD CONSTRAINT "corporate_kyc_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_profiles" ADD CONSTRAINT "credit_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_care_agents" ADD CONSTRAINT "customer_care_agents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_source_consents" ADD CONSTRAINT "data_source_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD CONSTRAINT "digilocker_kyc_mappings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_kyc_mappings" ADD CONSTRAINT "digilocker_kyc_mappings_digilocker_doc_id_digilocker_shared_documents_id_fk" FOREIGN KEY ("digilocker_doc_id") REFERENCES "public"."digilocker_shared_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD CONSTRAINT "digilocker_shared_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_shared_documents" ADD CONSTRAINT "digilocker_shared_documents_app_id_digilocker_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."digilocker_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD CONSTRAINT "digilocker_user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digilocker_user_sessions" ADD CONSTRAINT "digilocker_user_sessions_app_id_digilocker_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."digilocker_apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "epf_holdings" ADD CONSTRAINT "epf_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eps_holdings" ADD CONSTRAINT "eps_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_insights" ADD CONSTRAINT "expense_insights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_logs" ADD CONSTRAINT "family_activity_logs_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_activity_logs" ADD CONSTRAINT "family_activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_budgets" ADD CONSTRAINT "family_budgets_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_budgets" ADD CONSTRAINT "family_budgets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_discussions" ADD CONSTRAINT "family_discussions_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_discussions" ADD CONSTRAINT "family_discussions_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_discussions" ADD CONSTRAINT "family_discussions_parent_message_id_family_discussions_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."family_discussions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_goal_contributions" ADD CONSTRAINT "family_goal_contributions_goal_id_family_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."family_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_goal_contributions" ADD CONSTRAINT "family_goal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_goals" ADD CONSTRAINT "family_goals_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_goals" ADD CONSTRAINT "family_goals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_groups" ADD CONSTRAINT "family_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD CONSTRAINT "family_portfolio_permissions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD CONSTRAINT "family_portfolio_permissions_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD CONSTRAINT "family_portfolio_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_portfolio_permissions" ADD CONSTRAINT "family_portfolio_permissions_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filing_records" ADD CONSTRAINT "filing_records_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_goals" ADD CONSTRAINT "financial_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_comparisons" ADD CONSTRAINT "fund_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_goal_id_financial_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."financial_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_contributions" ADD CONSTRAINT "goal_contributions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "government_scheme_consents" ADD CONSTRAINT "government_scheme_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_account_summary" ADD CONSTRAINT "ib_account_summary_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_account_summary" ADD CONSTRAINT "ib_account_summary_ib_account_id_ib_accounts_id_fk" FOREIGN KEY ("ib_account_id") REFERENCES "public"."ib_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_accounts" ADD CONSTRAINT "ib_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_market_data_subscriptions" ADD CONSTRAINT "ib_market_data_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_market_data_subscriptions" ADD CONSTRAINT "ib_market_data_subscriptions_ib_account_id_ib_accounts_id_fk" FOREIGN KEY ("ib_account_id") REFERENCES "public"."ib_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_orders" ADD CONSTRAINT "ib_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_orders" ADD CONSTRAINT "ib_orders_ib_account_id_ib_accounts_id_fk" FOREIGN KEY ("ib_account_id") REFERENCES "public"."ib_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_positions" ADD CONSTRAINT "ib_positions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_positions" ADD CONSTRAINT "ib_positions_ib_account_id_ib_accounts_id_fk" FOREIGN KEY ("ib_account_id") REFERENCES "public"."ib_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_trading_sessions" ADD CONSTRAINT "ib_trading_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ib_trading_sessions" ADD CONSTRAINT "ib_trading_sessions_ib_account_id_ib_accounts_id_fk" FOREIGN KEY ("ib_account_id") REFERENCES "public"."ib_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icici_bank_credit_scores" ADD CONSTRAINT "icici_bank_credit_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "icici_bank_loan_applications" ADD CONSTRAINT "icici_bank_loan_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_holdings" ADD CONSTRAINT "insurance_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD CONSTRAINT "investment_idea_alerts_idea_id_investment_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."investment_ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_alerts" ADD CONSTRAINT "investment_idea_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD CONSTRAINT "investment_idea_tracking_idea_id_investment_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."investment_ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_idea_tracking" ADD CONSTRAINT "investment_idea_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_ideas" ADD CONSTRAINT "investment_ideas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_proposal_items" ADD CONSTRAINT "investment_proposal_items_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_proposals" ADD CONSTRAINT "investment_proposals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_proposals" ADD CONSTRAINT "investment_proposals_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_proposals" ADD CONSTRAINT "investment_proposals_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_applications" ADD CONSTRAINT "ipo_applications_ipo_id_ipo_companies_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ipo_news" ADD CONSTRAINT "ipo_news_ipo_id_ipo_companies_id_fk" FOREIGN KEY ("ipo_id") REFERENCES "public"."ipo_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itr_data_sources_sync" ADD CONSTRAINT "itr_data_sources_sync_itr_form_id_itr_prefilled_forms_id_fk" FOREIGN KEY ("itr_form_id") REFERENCES "public"."itr_prefilled_forms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itr_data_sources_sync" ADD CONSTRAINT "itr_data_sources_sync_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itr_prefilled_forms" ADD CONSTRAINT "itr_prefilled_forms_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kra_status_checks" ADD CONSTRAINT "kra_status_checks_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kra_status_checks" ADD CONSTRAINT "kra_status_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_audit_logs" ADD CONSTRAINT "kyc_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_consent_logs" ADD CONSTRAINT "kyc_consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_form_progress" ADD CONSTRAINT "kyc_form_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_form_progress" ADD CONSTRAINT "kyc_form_progress_ckyc_record_id_ckyc_records_id_fk" FOREIGN KEY ("ckyc_record_id") REFERENCES "public"."ckyc_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_reuse_tokens" ADD CONSTRAINT "kyc_reuse_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_state_transitions" ADD CONSTRAINT "kyc_state_transitions_session_id_kyc_verification_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."kyc_verification_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_state_transitions" ADD CONSTRAINT "kyc_state_transitions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_tier_upgrade_events" ADD CONSTRAINT "kyc_tier_upgrade_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_tier_upgrade_events" ADD CONSTRAINT "kyc_tier_upgrade_events_session_id_production_kyc_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."production_kyc_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_token_map" ADD CONSTRAINT "kyc_token_map_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_vault" ADD CONSTRAINT "kyc_vault_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification_attempts" ADD CONSTRAINT "kyc_verification_attempts_workflow_id_kyc_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."kyc_workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification_attempts" ADD CONSTRAINT "kyc_verification_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_verification_sessions" ADD CONSTRAINT "kyc_verification_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kyc_workflows" ADD CONSTRAINT "kyc_workflows_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_prospect_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."prospect_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_lessons" ADD CONSTRAINT "learning_lessons_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_progress" ADD CONSTRAINT "learning_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_quizzes" ADD CONSTRAINT "learning_quizzes_lesson_id_learning_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."learning_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_offer_id_loan_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."loan_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications_marketplace" ADD CONSTRAINT "loan_applications_marketplace_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD CONSTRAINT "loan_comparison_analytics_comparison_id_loan_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."loan_comparisons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparison_analytics" ADD CONSTRAINT "loan_comparison_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_comparisons" ADD CONSTRAINT "loan_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_request_id_loan_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."loan_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_offers" ADD CONSTRAINT "loan_offers_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_repayments" ADD CONSTRAINT "loan_repayments_loan_id_loan_applications_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loan_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_requests" ADD CONSTRAINT "loan_requests_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_documents" ADD CONSTRAINT "manual_kyc_documents_submission_id_manual_kyc_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."manual_kyc_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_documents" ADD CONSTRAINT "manual_kyc_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD CONSTRAINT "manual_kyc_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_kyc_submissions" ADD CONSTRAINT "manual_kyc_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nps_accounts" ADD CONSTRAINT "nps_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nri_kyc_progress" ADD CONSTRAINT "nri_kyc_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_order_id_unified_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."unified_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_documents" ADD CONSTRAINT "order_documents_signed_by_users_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lifecycle_events" ADD CONSTRAINT "order_lifecycle_events_order_id_unified_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."unified_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lifecycle_events" ADD CONSTRAINT "order_lifecycle_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD CONSTRAINT "pan_consent_audit_log_consent_id_pan_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."pan_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consent_audit_log" ADD CONSTRAINT "pan_consent_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_consents" ADD CONSTRAINT "pan_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pan_verification_records" ADD CONSTRAINT "pan_verification_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD CONSTRAINT "partner_application_documents_application_id_partner_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."partner_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD CONSTRAINT "partner_application_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD CONSTRAINT "partner_application_documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_application_documents" ADD CONSTRAINT "partner_application_documents_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_commissions" ADD CONSTRAINT "partner_commissions_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_referrals" ADD CONSTRAINT "partner_referrals_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_settlements" ADD CONSTRAINT "partner_settlements_reconciled_by_users_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD CONSTRAINT "phonepe_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phonepe_transactions" ADD CONSTRAINT "phonepe_transactions_cart_id_user_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."user_cart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pi_chat_summaries" ADD CONSTRAINT "pi_chat_summaries_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_comparisons" ADD CONSTRAINT "portfolio_comparisons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holdings" ADD CONSTRAINT "portfolio_holdings_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD CONSTRAINT "portfolio_predictions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_predictions" ADD CONSTRAINT "portfolio_predictions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_family_id_family_groups_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ppf_holdings" ADD CONSTRAINT "ppf_holdings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_approved_loan_offers" ADD CONSTRAINT "pre_approved_loan_offers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" ADD CONSTRAINT "pre_ipo_analytics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_analytics" ADD CONSTRAINT "pre_ipo_analytics_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ADD CONSTRAINT "pre_ipo_investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ADD CONSTRAINT "pre_ipo_investments_company_id_pre_ipo_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."pre_ipo_companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_ipo_investments" ADD CONSTRAINT "pre_ipo_investments_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_accuracy" ADD CONSTRAINT "prediction_accuracy_prediction_id_portfolio_predictions_id_fk" FOREIGN KEY ("prediction_id") REFERENCES "public"."portfolio_predictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prediction_accuracy" ADD CONSTRAINT "prediction_accuracy_asset_forecast_id_asset_forecasts_id_fk" FOREIGN KEY ("asset_forecast_id") REFERENCES "public"."asset_forecasts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_bank_account_id_user_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."user_bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_account_preferences" ADD CONSTRAINT "product_account_preferences_demat_account_id_user_demat_accounts_id_fk" FOREIGN KEY ("demat_account_id") REFERENCES "public"."user_demat_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_applications" ADD CONSTRAINT "product_applications_reviewed_by_partners_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performance" ADD CONSTRAINT "product_performance_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_performance" ADD CONSTRAINT "product_performance_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_kyc_sessions" ADD CONSTRAINT "production_kyc_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_proposal_item_id_investment_proposal_items_id_fk" FOREIGN KEY ("proposal_item_id") REFERENCES "public"."investment_proposal_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_payments" ADD CONSTRAINT "proposal_payments_agent_id_users_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_leads" ADD CONSTRAINT "prospect_leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospect_leads" ADD CONSTRAINT "prospect_leads_converted_to_user_id_users_id_fk" FOREIGN KEY ("converted_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_integrations" ADD CONSTRAINT "provider_integrations_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_provider_id_loan_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."loan_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_products" ADD CONSTRAINT "provider_products_product_id_loan_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."loan_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_executions" ADD CONSTRAINT "rebalance_executions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_executions" ADD CONSTRAINT "rebalance_executions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_transactions" ADD CONSTRAINT "rebalance_transactions_rebalance_execution_id_rebalance_executions_id_fk" FOREIGN KEY ("rebalance_execution_id") REFERENCES "public"."rebalance_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalance_transactions" ADD CONSTRAINT "rebalance_transactions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_preferences" ADD CONSTRAINT "rebalancing_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_suggestions" ADD CONSTRAINT "rebalancing_suggestions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_report_id_generated_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."generated_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_access_logs" ADD CONSTRAINT "report_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD CONSTRAINT "risk_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_analysis" ADD CONSTRAINT "risk_analysis_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_profiles" ADD CONSTRAINT "risk_profiles_assessed_by_users_id_fk" FOREIGN KEY ("assessed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_kyc_progress" ADD CONSTRAINT "smart_kyc_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_shares" ADD CONSTRAINT "social_shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_shares" ADD CONSTRAINT "social_shares_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_images" ADD CONSTRAINT "store_product_images_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_tag_mappings" ADD CONSTRAINT "store_product_tag_mappings_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_product_tag_mappings" ADD CONSTRAINT "store_product_tag_mappings_tag_id_store_product_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."store_product_tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_products" ADD CONSTRAINT "store_products_category_id_store_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."store_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD CONSTRAINT "structured_tax_data_document_id_tax_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tax_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_tax_data" ADD CONSTRAINT "structured_tax_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_to_partners_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_calculations" ADD CONSTRAINT "tax_calculations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_data_sources" ADD CONSTRAINT "tax_data_sources_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_document_access_log" ADD CONSTRAINT "tax_document_access_log_document_id_tax_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."tax_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_document_access_log" ADD CONSTRAINT "tax_document_access_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_documents" ADD CONSTRAINT "tax_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_reminder_subscriptions" ADD CONSTRAINT "tax_reminder_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_sessions" ADD CONSTRAINT "tax_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_support_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."support_tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_transaction_id_ai_transaction_tracking_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ai_transaction_tracking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_alerts" ADD CONSTRAINT "transaction_alerts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_enrichment_analysis" ADD CONSTRAINT "transaction_enrichment_analysis_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_report_id_transaction_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."transaction_reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_records" ADD CONSTRAINT "transaction_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_reports" ADD CONSTRAINT "transaction_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unified_orders" ADD CONSTRAINT "unified_orders_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activities" ADD CONSTRAINT "user_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_alerts" ADD CONSTRAINT "user_alerts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_bank_accounts" ADD CONSTRAINT "user_bank_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_budgets" ADD CONSTRAINT "user_budgets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cart" ADD CONSTRAINT "user_cart_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cart_items" ADD CONSTRAINT "user_cart_items_cart_id_user_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."user_cart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cart_items" ADD CONSTRAINT "user_cart_items_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_cart_items" ADD CONSTRAINT "user_cart_items_proposal_id_investment_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."investment_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_demat_accounts" ADD CONSTRAINT "user_demat_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_expenses" ADD CONSTRAINT "user_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_expenses" ADD CONSTRAINT "user_expenses_bbps_transaction_id_bbps_transactions_id_fk" FOREIGN KEY ("bbps_transaction_id") REFERENCES "public"."bbps_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_module_id_learning_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."learning_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_lesson_id_learning_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."learning_lessons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stats" ADD CONSTRAINT "user_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD CONSTRAINT "user_wishlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_wishlist" ADD CONSTRAINT "user_wishlist_product_id_store_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_session_id_tax_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tax_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD CONSTRAINT "yield_tracker_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "yield_tracker" ADD CONSTRAINT "yield_tracker_idea_id_investment_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."investment_ideas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_categories" ADD CONSTRAINT "zoho_categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_categories" ADD CONSTRAINT "zoho_categories_local_category_id_store_categories_id_fk" FOREIGN KEY ("local_category_id") REFERENCES "public"."store_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_categories" ADD CONSTRAINT "zoho_categories_parent_id_zoho_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."zoho_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_commerce_config" ADD CONSTRAINT "zoho_commerce_config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_commerce_sync_logs" ADD CONSTRAINT "zoho_commerce_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_commerce_webhooks" ADD CONSTRAINT "zoho_commerce_webhooks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_connections" ADD CONSTRAINT "zoho_connections_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_customers" ADD CONSTRAINT "zoho_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_customers" ADD CONSTRAINT "zoho_customers_local_user_id_users_id_fk" FOREIGN KEY ("local_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_entity_mappings" ADD CONSTRAINT "zoho_entity_mappings_connection_id_zoho_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."zoho_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_inventory" ADD CONSTRAINT "zoho_inventory_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_inventory" ADD CONSTRAINT "zoho_inventory_product_id_zoho_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."zoho_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_orders" ADD CONSTRAINT "zoho_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_products" ADD CONSTRAINT "zoho_products_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_products" ADD CONSTRAINT "zoho_products_local_product_id_store_products_id_fk" FOREIGN KEY ("local_product_id") REFERENCES "public"."store_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_products" ADD CONSTRAINT "zoho_products_category_id_zoho_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."zoho_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_sync_logs" ADD CONSTRAINT "zoho_sync_logs_connection_id_zoho_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."zoho_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_sync_logs" ADD CONSTRAINT "zoho_sync_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_webhook_events" ADD CONSTRAINT "zoho_webhook_events_connection_id_zoho_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."zoho_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zoho_webhook_events" ADD CONSTRAINT "zoho_webhook_events_mapping_id_zoho_entity_mappings_id_fk" FOREIGN KEY ("mapping_id") REFERENCES "public"."zoho_entity_mappings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aa_consents_user_id" ON "aa_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aa_consents_status" ON "aa_consents" USING btree ("consent_status");--> statement-breakpoint
CREATE INDEX "idx_aa_consents_expiry" ON "aa_consents" USING btree ("consent_expiry");--> statement-breakpoint
CREATE INDEX "idx_aa_consents_consent_id" ON "aa_consents" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_logs_consent" ON "aa_data_fetch_logs" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_logs_user" ON "aa_data_fetch_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_logs_session" ON "aa_data_fetch_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_logs_status" ON "aa_data_fetch_logs" USING btree ("fetch_status");--> statement-breakpoint
CREATE INDEX "idx_aa_fetch_logs_date" ON "aa_data_fetch_logs" USING btree ("initiated_at");--> statement-breakpoint
CREATE INDEX "idx_aa_accounts_user" ON "aa_discovered_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_aa_accounts_consent" ON "aa_discovered_accounts" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_aa_accounts_type" ON "aa_discovered_accounts" USING btree ("account_type");--> statement-breakpoint
CREATE INDEX "idx_aa_accounts_status" ON "aa_discovered_accounts" USING btree ("account_status");--> statement-breakpoint
CREATE INDEX "idx_aa_accounts_linked" ON "aa_discovered_accounts" USING btree ("is_linked");--> statement-breakpoint
CREATE INDEX "idx_ai_verif_user" ON "accredited_investor_verifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ai_verif_session" ON "accredited_investor_verifications" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_ai_verif_status" ON "accredited_investor_verifications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_verif_esign" ON "accredited_investor_verifications" USING btree ("esign_transaction_id");--> statement-breakpoint
CREATE INDEX "idx_ai_verif_bse" ON "accredited_investor_verifications" USING btree ("bse_submission_id");--> statement-breakpoint
CREATE INDEX "idx_agent_client_client" ON "agent_client_mapping" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_agent_client_agent" ON "agent_client_mapping" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_agent_client_product" ON "agent_client_mapping" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_agent_client_active" ON "agent_client_mapping" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_fix_status" ON "ai_fix_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_fix_severity" ON "ai_fix_suggestions" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_fix_created" ON "ai_fix_suggestions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_fix_endpoint" ON "ai_fix_suggestions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "idx_alert_history_alert_id" ON "alert_history" USING btree ("alert_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_user_id" ON "alert_history" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_alert_history_triggered" ON "alert_history" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "idx_alert_history_read" ON "alert_history" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_alert_templates_type" ON "alert_templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "idx_alert_templates_popular" ON "alert_templates" USING btree ("is_popular");--> statement-breakpoint
CREATE INDEX "idx_alert_templates_active" ON "alert_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_api_usage_provider" ON "api_usage_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_api_usage_status" ON "api_usage_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_api_usage_feature" ON "api_usage_logs" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "idx_api_usage_created" ON "api_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_asset_forecasts_user" ON "asset_forecasts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_asset_forecasts_symbol" ON "asset_forecasts" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_asset_forecasts_holding" ON "asset_forecasts" USING btree ("holding_id");--> statement-breakpoint
CREATE INDEX "idx_chain_sequence" ON "audit_hash_chain" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_chain_type" ON "audit_hash_chain" USING btree ("audit_type");--> statement-breakpoint
CREATE INDEX "idx_chain_record" ON "audit_hash_chain" USING btree ("audit_record_id");--> statement-breakpoint
CREATE INDEX "idx_chain_user" ON "audit_hash_chain" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chain_created" ON "audit_hash_chain" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_user" ON "auto_population_status" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_workflow" ON "auto_population_status" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_status" ON "auto_population_status" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_auto_pop_initiated" ON "auto_population_status" USING btree ("initiated_at");--> statement-breakpoint
CREATE INDEX "idx_bond_holdings_user_id" ON "bond_holdings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_holdings_portfolio_id" ON "bond_holdings" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_bond_holdings_status" ON "bond_holdings" USING btree ("holding_status");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_user_id" ON "bond_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_status" ON "bond_orders" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "idx_bond_orders_date" ON "bond_orders" USING btree ("order_date");--> statement-breakpoint
CREATE INDEX "idx_bse_session" ON "bse_ucc_requests" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_bse_user" ON "bse_ucc_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bse_ucc" ON "bse_ucc_requests" USING btree ("ucc_number");--> statement-breakpoint
CREATE INDEX "idx_bse_status" ON "bse_ucc_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipient_campaign" ON "campaign_recipients" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipient_user" ON "campaign_recipients" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_recipient_status" ON "campaign_recipients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_capital_gains_tax_reminders_user_id" ON "capital_gains_tax_reminders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_capital_gains_tax_reminders_due_date" ON "capital_gains_tax_reminders" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "idx_capital_gains_tax_reminders_status" ON "capital_gains_tax_reminders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cas_req_user" ON "cas_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cas_req_status" ON "cas_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cas_req_provider" ON "cas_requests" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_cas_req_external_id" ON "cas_requests" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "idx_cas_req_requested_at" ON "cas_requests" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "idx_cashfree_session" ON "cashfree_ekyc_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_cashfree_user" ON "cashfree_ekyc_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cashfree_status" ON "cashfree_ekyc_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cersai_session" ON "cersai_submissions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_cersai_user" ON "cersai_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cersai_status" ON "cersai_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cersai_ckyc" ON "cersai_submissions" USING btree ("ckyc_number");--> statement-breakpoint
CREATE INDEX "idx_chart_user_updated" ON "chart_configurations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_chart_share_token" ON "chart_configurations" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "idx_chat_actions_session_id" ON "chat_actions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_chat_actions_user_id" ON "chat_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_actions_status" ON "chat_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_chat_actions_action_type" ON "chat_actions" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "idx_chat_functions_category" ON "chat_functions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_chat_functions_enabled" ON "chat_functions" USING btree ("is_enabled");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_session_id" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_role" ON "chat_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_created" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_flagged" ON "chat_messages" USING btree ("is_flagged");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_active" ON "chat_sessions" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_last_message" ON "chat_sessions" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_portfolio" ON "chat_sessions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_client_intel_user" ON "client_intelligence" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_intel_score" ON "client_intelligence" USING btree ("probe42_score");--> statement-breakpoint
CREATE INDEX "idx_client_intel_risk" ON "client_intelligence" USING btree ("risk_level");--> statement-breakpoint
CREATE INDEX "idx_client_statements_user_id" ON "client_statements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_client_statements_period" ON "client_statements" USING btree ("statement_period");--> statement-breakpoint
CREATE INDEX "idx_client_statements_type" ON "client_statements" USING btree ("statement_type");--> statement-breakpoint
CREATE INDEX "idx_commissions_agent" ON "commissions" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_commissions_client" ON "commissions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_commissions_status" ON "commissions" USING btree ("payout_status");--> statement-breakpoint
CREATE INDEX "idx_commissions_month" ON "commissions" USING btree ("trail_month");--> statement-breakpoint
CREATE INDEX "idx_commissions_product" ON "commissions" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_currency_rates_base_target" ON "currency_rates" USING btree ("base_currency","target_currency");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_user" ON "data_source_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_source" ON "data_source_consents" USING btree ("data_source");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_active" ON "data_source_consents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_data_source_consent_expires" ON "data_source_consents" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_user" ON "expense_insights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_type" ON "expense_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_status" ON "expense_insights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_expense_insights_priority" ON "expense_insights" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_family_activity_logs_family" ON "family_activity_logs" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_family_activity_logs_type" ON "family_activity_logs" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_family_activity_logs_created" ON "family_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_family_budgets_family" ON "family_budgets" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_family_budgets_category" ON "family_budgets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_family_discussions_family" ON "family_discussions" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_family_discussions_topic" ON "family_discussions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_family_discussions_author" ON "family_discussions" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_family_goal_contributions_goal" ON "family_goal_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_family_goal_contributions_user" ON "family_goal_contributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_family_goals_family" ON "family_goals" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_family_goals_status" ON "family_goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_family_members_family_id" ON "family_members" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_family_members_user_id" ON "family_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_family_portfolio_permissions_portfolio" ON "family_portfolio_permissions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_family_portfolio_permissions_user" ON "family_portfolio_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_user_id" ON "generated_reports" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_status" ON "generated_reports" USING btree ("report_status");--> statement-breakpoint
CREATE INDEX "idx_generated_reports_type" ON "generated_reports" USING btree ("report_type");--> statement-breakpoint
CREATE INDEX "idx_contribution_goal" ON "goal_contributions" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "idx_contribution_user" ON "goal_contributions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_contribution_date" ON "goal_contributions" USING btree ("contribution_date");--> statement-breakpoint
CREATE INDEX "idx_integration_health_status" ON "integration_health" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_integration_health_category" ON "integration_health" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_kra_session" ON "kra_status_checks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_kra_user" ON "kra_status_checks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kra_poll_due" ON "kra_status_checks" USING btree ("next_poll_at");--> statement-breakpoint
CREATE INDEX "idx_kra_status" ON "kra_status_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_user" ON "kyc_audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_accessed_by" ON "kyc_audit_logs" USING btree ("accessed_by");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_type" ON "kyc_audit_logs" USING btree ("access_type");--> statement-breakpoint
CREATE INDEX "idx_kyc_audit_timestamp" ON "kyc_audit_logs" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_consent_user" ON "kyc_consent_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_consent_type" ON "kyc_consent_logs" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "idx_kyc_consent_given" ON "kyc_consent_logs" USING btree ("consent_given");--> statement-breakpoint
CREATE INDEX "idx_kyc_reuse_token_id" ON "kyc_reuse_tokens" USING btree ("token_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_reuse_user" ON "kyc_reuse_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_reuse_active" ON "kyc_reuse_tokens" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_transition_session" ON "kyc_state_transitions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_transition_user" ON "kyc_state_transitions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transition_time" ON "kyc_state_transitions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_tier_events_user" ON "kyc_tier_upgrade_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tier_events_session" ON "kyc_tier_upgrade_events" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_tier_events_status" ON "kyc_tier_upgrade_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_token_map_token" ON "kyc_token_map" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_kyc_token_map_user" ON "kyc_token_map" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vault_user" ON "kyc_vault" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_vault_status" ON "kyc_vault" USING btree ("kyc_status");--> statement-breakpoint
CREATE INDEX "idx_kyc_attempt_workflow" ON "kyc_verification_attempts" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_attempt_user" ON "kyc_verification_attempts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_attempt_method" ON "kyc_verification_attempts" USING btree ("verification_method");--> statement-breakpoint
CREATE INDEX "idx_kyc_attempt_outcome" ON "kyc_verification_attempts" USING btree ("outcome");--> statement-breakpoint
CREATE INDEX "idx_kyc_attempt_correlation" ON "kyc_verification_attempts" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_attempt_attempted_at" ON "kyc_verification_attempts" USING btree ("attempted_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_sessions_user" ON "kyc_verification_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_sessions_step" ON "kyc_verification_sessions" USING btree ("current_step");--> statement-breakpoint
CREATE INDEX "idx_kyc_workflow_user" ON "kyc_workflows" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_kyc_workflow_status" ON "kyc_workflows" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_kyc_workflow_pan" ON "kyc_workflows" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_kyc_workflow_initiated" ON "kyc_workflows" USING btree ("initiated_at");--> statement-breakpoint
CREATE INDEX "idx_kyc_workflow_method" ON "kyc_workflows" USING btree ("current_method");--> statement-breakpoint
CREATE INDEX "idx_lead_activity_lead" ON "lead_activities" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "idx_lead_activity_type" ON "lead_activities" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "idx_lead_activity_created" ON "lead_activities" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_campaign_type" ON "marketing_campaigns" USING btree ("campaign_type");--> statement-breakpoint
CREATE INDEX "idx_campaign_status" ON "marketing_campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaign_created" ON "marketing_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_order_documents_order" ON "order_documents" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_documents_type" ON "order_documents" USING btree ("document_type");--> statement-breakpoint
CREATE INDEX "idx_order_documents_status" ON "order_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_order_events_order" ON "order_lifecycle_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_order_events_type" ON "order_lifecycle_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_order_events_created" ON "order_lifecycle_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_pan_audit_consent_id" ON "pan_consent_audit_log" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "idx_pan_audit_user_id" ON "pan_consent_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pan_audit_timestamp" ON "pan_consent_audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_pan_consents_user_id" ON "pan_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pan_consents_active" ON "pan_consents" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_pan_records_user" ON "pan_verification_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pan_records_pan" ON "pan_verification_records" USING btree ("pan_number");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_user_pan" ON "pan_verification_records" USING btree ("user_id","pan_number");--> statement-breakpoint
CREATE INDEX "idx_portfolio_predictions_user" ON "portfolio_predictions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_predictions_portfolio" ON "portfolio_predictions" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_portfolio_predictions_date" ON "portfolio_predictions" USING btree ("prediction_date");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_user" ON "pre_approved_loan_offers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_lender" ON "pre_approved_loan_offers" USING btree ("lender_name");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_product_type" ON "pre_approved_loan_offers" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_eligibility" ON "pre_approved_loan_offers" USING btree ("eligibility_status");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_application" ON "pre_approved_loan_offers" USING btree ("application_status");--> statement-breakpoint
CREATE INDEX "idx_pre_approved_loan_offers_validity" ON "pre_approved_loan_offers" USING btree ("offer_valid_until");--> statement-breakpoint
CREATE INDEX "idx_production_kyc_user" ON "production_kyc_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_production_kyc_step" ON "production_kyc_sessions" USING btree ("current_step");--> statement-breakpoint
CREATE INDEX "idx_production_kyc_pan" ON "production_kyc_sessions" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_production_kyc_tier" ON "production_kyc_sessions" USING btree ("target_kyc_tier");--> statement-breakpoint
CREATE INDEX "idx_production_kyc_status" ON "production_kyc_sessions" USING btree ("kyc_status");--> statement-breakpoint
CREATE INDEX "idx_prospect_cin" ON "prospect_leads" USING btree ("cin");--> statement-breakpoint
CREATE INDEX "idx_prospect_company_name" ON "prospect_leads" USING btree ("company_name");--> statement-breakpoint
CREATE INDEX "idx_prospect_status" ON "prospect_leads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_prospect_score" ON "prospect_leads" USING btree ("lead_score");--> statement-breakpoint
CREATE INDEX "idx_prospect_assigned" ON "prospect_leads" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_prospect_created" ON "prospect_leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_report_id" ON "report_access_logs" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_user_id" ON "report_access_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_report_access_logs_accessed_at" ON "report_access_logs" USING btree ("accessed_at");--> statement-breakpoint
CREATE INDEX "idx_risk_analysis_user" ON "risk_analysis" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_risk_analysis_portfolio" ON "risk_analysis" USING btree ("portfolio_id");--> statement-breakpoint
CREATE INDEX "idx_risk_analysis_date" ON "risk_analysis" USING btree ("analysis_date");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_health_service" ON "system_health_logs" USING btree ("service_name");--> statement-breakpoint
CREATE INDEX "idx_health_status" ON "system_health_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_health_checked" ON "system_health_logs" USING btree ("checked_at");--> statement-breakpoint
CREATE INDEX "idx_tax_reminder_subscriptions_user_id" ON "tax_reminder_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_tax_reminder_subscriptions_status" ON "tax_reminder_subscriptions" USING btree ("subscription_status");--> statement-breakpoint
CREATE INDEX "idx_tax_rules_type_category" ON "tax_rules" USING btree ("rule_type","category");--> statement-breakpoint
CREATE INDEX "idx_tax_rules_effective_from" ON "tax_rules" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "idx_tax_rules_is_active" ON "tax_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_user" ON "unified_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_status" ON "unified_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_product_type" ON "unified_orders" USING btree ("product_type");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_payment_status" ON "unified_orders" USING btree ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_execution_status" ON "unified_orders" USING btree ("execution_status");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_created_at" ON "unified_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_unified_orders_order_number" ON "unified_orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_user_id" ON "user_alerts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_type" ON "user_alerts" USING btree ("alert_type");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_category" ON "user_alerts" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_active" ON "user_alerts" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_user_alerts_symbol" ON "user_alerts" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "idx_user_budgets_user" ON "user_budgets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_budgets_category" ON "user_budgets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_budgets_period" ON "user_budgets" USING btree ("period_type");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_user" ON "user_expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_category" ON "user_expenses" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_date" ON "user_expenses" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "idx_user_expenses_recurring" ON "user_expenses" USING btree ("recurring_group_id");--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_users_mobile" ON "users" USING btree ("mobile");--> statement-breakpoint
CREATE INDEX "idx_users_pan_number" ON "users" USING btree ("pan_number");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_provider" ON "webhook_logs" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_event" ON "webhook_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_status" ON "webhook_logs" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "idx_webhook_logs_received" ON "webhook_logs" USING btree ("received_at");